import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
import {validatePiExecutionHistory} from '../../server/src/pi-execution-state-store.mjs';
import {REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
const context={project_id:'writer_workbench',workspace_id:'dev_workspace_'+'a'.repeat(24),workstream_id:'dev_workstream_20261014-160517_e72422759c8d'};
const intent=()=>({schema_version:1,intent_id:'publication-lock-private-001',goal:'Test only private publication boundaries',context,constraints:['Private temp Journal only'],requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'},depends_on:[]}],mutation_plan:[],verification:{focused:[],affected:[],full:[]},completion_conditions:['Review exact evidence'],permissions:{read:true,write:false,workspace_create:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]});
async function scope(t,options={}){const root=await mkdtemp(path.join(os.tmpdir(),'pi-projection-lock-'));t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('pi-projection-lock-'));await rm(root,{recursive:true,force:true});});return{root,journal:createDevOperationJournalService({storageRoot:root,...options})};}
test('current and candidate history validation run without holding append lock',async t=>{
 const f=await scope(t);let calls=0;
 const j={...f.journal,appendExecutionProjection:(record,options)=>f.journal.appendExecutionProjection(record,{...options,validateHistory:events=>{calls++;assert.equal(fs.existsSync(path.join(f.root,'append.lock')),false,'whole-history validation must run outside append lock');return validatePiExecutionHistory(events);}})};
 const p=await createPiReliableExecutionStore({journal:j}).admit(intent());assert.equal(p.revision,1);assert(calls>=2);assert.equal((await f.journal.status()).health,'healthy');
});
test('admission stays inside lock and duplicate intent still returns exact existing projection',async t=>{
 const f=await scope(t);let admissions=0;
 const store=createPiReliableExecutionStore({journal:f.journal,admissionGuard:async()=>{admissions++;assert.equal(fs.existsSync(path.join(f.root,'append.lock')),true);}});
 const a=await store.admit(intent()),b=await store.admit(intent());assert.equal(a.projection_hash,b.projection_hash);assert.equal(a.revision,b.revision);assert.equal(admissions,2);assert.equal((await f.journal.verify()).events.length,2);
});
test('head change after pure validation is caught up before publication without losing competitor events',async t=>{
 const f=await scope(t);const b=createDevOperationJournalService({storageRoot:f.root});
 const seed=await b.begin({operation_type:'private_competitor',tool_name:'private_test'});await b.complete(seed.operation_id);
 const original=fs.promises.open;let injected=false,inside=false;
 fs.promises.open=async function(file,...args){if(!inside&&!injected&&String(file)===path.join(f.root,'append.lock')&&args[0]==='wx'){injected=true;inside=true;try{const x=await b.begin({operation_type:'private_competitor',tool_name:'private_test'});await b.complete(x.operation_id);}finally{inside=false;}}return original.call(this,file,...args);};syncBuiltinESMExports();
 try{const p=await createPiReliableExecutionStore({journal:f.journal}).admit(intent());assert.equal(p.revision,1);}finally{fs.promises.open=original;syncBuiltinESMExports();}
 assert(injected);const v=await f.journal.verify();assert.equal(v.events.length,6);assert.equal((await f.journal.status()).health,'healthy');
});
test('a new isolated incident during the head race leaves unrelated projections writable',async t=>{
 const f=await scope(t);const b=createDevOperationJournalService({storageRoot:f.root});
 const seed=await b.begin({operation_type:'private_seed',tool_name:'private_test'});await b.complete(seed.operation_id);
 const original=fs.promises.open;let injected=false,inside=false;
 fs.promises.open=async function(file,...args){if(!inside&&!injected&&String(file)===path.join(f.root,'append.lock')&&args[0]==='wx'){injected=true;inside=true;try{const x=await b.begin({operation_type:'private_ambiguous',tool_name:'private_test'});await b.fail(x.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});}finally{inside=false;}}return original.call(this,file,...args);};syncBuiltinESMExports();
 try{const admitted=await createPiReliableExecutionStore({journal:f.journal}).admit(intent());assert.equal(admitted.revision,1);}finally{fs.promises.open=original;syncBuiltinESMExports();}
 assert(injected);const v=await f.journal.verify();assert.equal(v.events.length,6);assert.equal(v.events.filter(e=>e.execution_projection).length,1);
});
test('rejected candidate cannot publish and preserves locked Admission order',async t=>{
 const f=await scope(t);let admissions=0;
 const j={...f.journal,appendExecutionProjection:(record,options)=>f.journal.appendExecutionProjection(record,{...options,validateHistory:events=>{if(events.length)throw new Error('candidate rejected');return validatePiExecutionHistory(events);}})};
 await assert.rejects(createPiReliableExecutionStore({journal:j,admissionGuard:async()=>{admissions++;}}).admit(intent()),/candidate rejected/);
 assert.equal(admissions,1);assert.equal((await f.journal.verify()).events.length,0);
});

test('locked authority rejection wins over a precomputed candidate error without publication',async t=>{
 const f=await scope(t),candidateError=new Error('candidate rejected'),authorityError=new Error('authority denied');let admissions=0;
 const j={...f.journal,appendExecutionProjection:(record,options)=>f.journal.appendExecutionProjection(record,{...options,validateHistory:events=>{assert.equal(fs.existsSync(path.join(f.root,'append.lock')),false);if(events.length)throw candidateError;return validatePiExecutionHistory(events);}})};
 await assert.rejects(createPiReliableExecutionStore({journal:j,admissionGuard:async()=>{admissions++;assert.equal(fs.existsSync(path.join(f.root,'append.lock')),true);throw authorityError;}}).admit(intent()),e=>e===authorityError);
 assert.equal(admissions,1);assert.equal((await f.journal.verify()).events.length,0);
});

test('a stale precomputed candidate error is discarded on exact head drift',async t=>{
 const f=await scope(t),competitor=createDevOperationJournalService({storageRoot:f.root});
 const seed=await competitor.begin({operation_type:'private_seed',tool_name:'private_test'});await competitor.complete(seed.operation_id);
 const original=fs.promises.open;let injected=false,inside=false,admissions=0;
 const j={...f.journal,appendExecutionProjection:(record,options)=>f.journal.appendExecutionProjection(record,{...options,validateHistory:events=>{assert.equal(fs.existsSync(path.join(f.root,'append.lock')),false);if(events.length&&!injected)throw new Error('stale candidate rejected');return validatePiExecutionHistory(events);}})};
 fs.promises.open=async function(file,...args){if(!inside&&!injected&&String(file)===path.join(f.root,'append.lock')&&args[0]==='wx'){injected=true;inside=true;try{const op=await competitor.begin({operation_type:'private_competitor',tool_name:'private_test'});await competitor.complete(op.operation_id);}finally{inside=false;}}return original.call(this,file,...args);};syncBuiltinESMExports();
 try{const r=await createPiReliableExecutionStore({journal:j,admissionGuard:async()=>{admissions++;assert.equal(fs.existsSync(path.join(f.root,'append.lock')),true);}}).admit(intent());assert.equal(r.revision,1);}finally{fs.promises.open=original;syncBuiltinESMExports();}
 assert(injected);assert.equal(admissions,1);assert.equal((await f.journal.verify()).events.length,6);
});

test('ordinary reliable transitions derive and publish from one fresh physical verification',async t=>{
 const samples=[];
 const f=await scope(t,{verificationTimingObserver:record=>samples.push(record)});
 const store=createPiReliableExecutionStore({journal:f.journal});
 const admitted=await store.admit(intent());
 const owner={worker_id:'pi_worker_'+'a'.repeat(32),pid:process.pid,hostname:os.hostname()};
 const args={operation_id:admitted.state.operation_id,context,expected_revision:admitted.revision};
 samples.length=0;
 const claimed=await store.command({...args,command:{type:'owner_acquired',owner,replaced_worker_id:null}});
 assert.equal(samples.length,1);
 assert.equal(samples[0].completed,true);
 assert.equal(claimed.revision,2);
 assert.deepEqual(claimed.runtime.owner,owner);
 samples.length=0;
 const next=await store.command({...args,expected_revision:claimed.revision,command:{type:'phase_changed',status:'ADMITTED',worker_id:owner.worker_id}});
 assert.equal(samples.length,1);
 assert.equal(samples[0].completed,true);
 assert.equal(next.state.status,'ADMITTED');
 assert.equal(next.revision,3);
 const v=await f.journal.verify();
 assert.equal(v.events.length,6);
 assert.equal(v.events.at(-1).execution_projection.projection_hash,next.projection_hash);
});
test('ordinary transition loses exact revision CAS to a competing owner and never publishes stale claim',async t=>{
 let armed=false,verified=false,injected=false,inside=false;
 const samples=[];
 const f=await scope(t,{verificationTimingObserver:r=>{samples.push(r);if(armed&&r.completed)verified=true;}});
 const a=createPiReliableExecutionStore({journal:f.journal});
 const admitted=await a.admit(intent());
 const b=createPiReliableExecutionStore({journal:createDevOperationJournalService({storageRoot:f.root})});
 const args={operation_id:admitted.state.operation_id,context,expected_revision:1};
 const owner=id=>({worker_id:'pi_worker_'+id.repeat(32),pid:process.pid,hostname:os.hostname()});
 const original=fs.promises.open;let winner;
 armed=true;samples.length=0;
 fs.promises.open=async function(file,...rest){
  if(!inside&&!injected&&verified&&String(file)===path.join(f.root,'append.lock')&&rest[0]==='wx'){
   injected=true;inside=true;
   try{winner=await b.command({...args,command:{type:'owner_acquired',owner:owner('b'),replaced_worker_id:null}});}
   finally{inside=false;}
  }
  return original.call(this,file,...rest);
 };syncBuiltinESMExports();
 try{await assert.rejects(a.command({...args,command:{type:'owner_acquired',owner:owner('a'),replaced_worker_id:null}}),e=>e.code==='STATE_REVISION_CONFLICT');}
 finally{fs.promises.open=original;syncBuiltinESMExports();}
 assert.equal(injected,true);
 assert.equal(samples.length,2,'head drift must cause a new full verification');
 assert.equal(winner.revision,2);
 const v=await f.journal.verify();
 assert.equal(v.events.length,4);
 assert.equal(v.events.at(-1).execution_projection.projection_hash,winner.projection_hash);
 assert.equal(v.events.at(-1).execution_projection.runtime.owner.worker_id,owner('b').worker_id);
});
test('ordinary transition rejects a changed physical prefix before deriving or publishing',async t=>{
 const f=await scope(t);
 const store=createPiReliableExecutionStore({journal:f.journal,recoverOnReadFailure:false});
 const admitted=await store.admit(intent());
 const before=await f.journal.verify();
 const first=before.events[0];
 const file=path.join(f.root,'events',String(first.sequence).padStart(12,'0')+'-'+first.journal_event_id+'.json');
 const headBefore=await readFile(path.join(f.root,'head.json'),'utf8');
 const {writeFile}=await import('node:fs/promises');
 await writeFile(file,'tampered\n');
 await assert.rejects(store.command({operation_id:admitted.state.operation_id,context,expected_revision:1,
  command:{type:'owner_acquired',owner:{worker_id:'pi_worker_'+'a'.repeat(32),pid:process.pid,hostname:os.hostname()},replaced_worker_id:null}}),/changed a previously verified immutable prefix/);
 assert.equal(await readFile(path.join(f.root,'head.json'),'utf8'),headBefore);
 assert.equal((await f.journal.status()).chain_verified,false);
});
