import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,appendFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {EventEmitter} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController} from '../../server/src/pi-production-execution-controller.mjs';
import {createPiExecutionHistoryValidator} from '../../server/src/pi-execution-state-store.mjs';
import {createPiReliableMcpAdapter} from '../../server/src/pi-mcp-reliable-adapter.mjs';
import {runPiDurableWorker,PI_DURABLE_WORKER_PROTOCOL} from '../../server/src/pi-durable-worker.mjs';
import {createPiDurableWorkerSupervisor} from '../../server/src/pi-durable-worker-supervisor.mjs';
import {fingerprintMcpMutationRequest} from '../../server/src/mcp-operation-reconciliation-context.mjs';
import {hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
const exec=promisify(execFile);
const context={project_id:'writer_workbench',workstream_id:'dev_workstream_20261015-000000_123456789012',workspace_id:'dev_workspace_123456789012345678901234'};
function intent(id,write=false){const input=write?{path:'scripts/async-once.mjs',content:'// once\n'}:{path:'package.json'};
 return {schema_version:1,intent_id:id,goal:'Durable dispatch acceptance',context,constraints:['Fixture only'],
  requested_actions:[{step_id:'action',capability:write?'filesystem.write':'filesystem.read',input,depends_on:[],...(write?{idempotency_key:'async-'+id}:{})}],
  mutation_plan:write?[{step_id:'action',target:input.path,expected_change:'Exact fixture effect',input_sha256:hashExecutionInput(input)}]:[],
  verification:{focused:[],affected:[],full:[]},completion_conditions:['Inspect durable facts'],
  permissions:{read:true,write:true,workspace_create:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
}
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'pi-durable-'));
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 const storageRoot=path.join(root,'journal'),journal=createDevOperationJournalService({storageRoot});
 const route=createPiProductionRouteStore({journal});
 await route.change({mode:'pi_default',decision_id:'gpt-durable-fixture',gate_hash:'a'.repeat(64),expected_revision:0},{validateGate:async()=>true});
 return {root,journal,route,storageRoot};
}
function host(f,callTool=async()=>({ok:true}),extra={}){return createPiProductionExecutionController({journal:f.journal,route:f.route,
 transport:{callTool,queryOperation:args=>f.journal.getOperation(args),resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'})},...extra});}
test('submit durably publishes an enrolled operation without dispatch or an owner',async t=>{
 const f=await fixture(t);let calls=0;const h=host(f,async()=>{calls++;return {};});
 const r=await h.submit(intent('submit-before-dispatch',true));
 assert.equal(r.state.status,'CREATED');assert.equal(r.runtime.owner,null);assert.equal(calls,0);
 assert.equal(r.command.production_binding.worker_protocol,PI_DURABLE_WORKER_PROTOCOL);
 const cold=host({...f,journal:createDevOperationJournalService({storageRoot:f.storageRoot})});
 assert.equal((await cold.discover())[0].state.operation_id,r.state.operation_id);
 assert.equal((await cold.inspect({operation_id:r.state.operation_id,context})).projection_hash,r.projection_hash);
});
test('a fresh worker discovers a lost wake and completes exact prior admission',async t=>{
 const f=await fixture(t),i=intent('restart-discovery',true),original=await host(f).submit(i);
 const abort=new AbortController();let calls=0;
 const h=host(f,async()=>{calls++;return {ok:true};});
 await runPiDurableWorker({controller:h,signal:abort.signal,intervalMs:10,observe:e=>{if(e.kind==='idle')abort.abort();}});
 const r=await h.inspect({operation_id:original.state.operation_id,context});
 assert.equal(r.state.status,'COMPLETED');assert.equal(calls,1);assert.equal(r.runtime.owner,null);
 assert.equal((await h.discover()).length,0);
});
test('duplicate submit preserves identity and terminal receipt without another dispatch',async t=>{
 const f=await fixture(t),i=intent('duplicate-durable',true);let calls=0;const h=host(f,async()=>{calls++;return {ok:true};});
 const first=await h.submit(i),duplicate=await h.submit(i);assert.equal(duplicate.projection_hash,first.projection_hash);
 const done=await h.execute(i);assert.equal(done.state.operation_id,first.state.operation_id);
 assert.equal((await h.submit(i)).projection_hash,done.projection_hash);assert.equal(calls,1);
 await assert.rejects(h.submit({...i,goal:'Altered original request'}),{code:'INTENT_ID_CONFLICT'});
});
test('legacy production operations are not discovered until explicitly enrolled',async t=>{
 const f=await fixture(t),h=host(f),i=intent('legacy-selected'),other=intent('legacy-unselected');
 const r=await h.admit(i),untouched=await h.admit(other);assert.deepEqual(await h.discover(),[]);
 const selected=await h.submit(i);assert.equal(selected.state.operation_id,r.state.operation_id);assert.equal(selected.runtime.durable_worker,true);
 assert.deepEqual((await h.discover()).map(x=>x.state.operation_id),[r.state.operation_id]);
 assert.equal((await h.inspect({operation_id:untouched.state.operation_id,context})).projection_hash,untouched.projection_hash);
});
test('concurrent workers execute one physical effect under journal owner CAS',async t=>{
 const f=await fixture(t),i=intent('two-workers',true);const once=path.join(f.root,'effects');
 const h=host(f,async()=>{await appendFile(once,'X');await new Promise(r=>setTimeout(r,20));return {ok:true};});
 await h.submit(i);await Promise.all([h.execute(i),host(f,async()=>{await appendFile(once,'X');return {ok:true};}).execute(i)]);
 assert.equal(await readFile(once,'utf8'),'X');
 assert.equal((await h.inspect({intent_id:i.intent_id,context})).state.status,'COMPLETED');
});
test('durable admission enforces backpressure under concurrent submissions',async t=>{
 const f=await fixture(t),h=host(f,undefined,{pendingLimit:2});
 const results=await Promise.allSettled([h.submit(intent('capacity-one')),h.submit(intent('capacity-two')),h.submit(intent('capacity-three'))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'PI_DURABLE_QUEUE_FULL');
 assert.equal((await h.discover()).length,2);
});
test('worker drain waits for the active effect and starts no subsequent operation',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('drain-first'));await h.submit(intent('drain-second'));
 const abort=new AbortController();let calls=0;const events=[];
 const running=host(f,async()=>{calls++;abort.abort();await new Promise(r=>setTimeout(r,10));return {ok:true};});
 await runPiDurableWorker({controller:running,signal:abort.signal,intervalMs:10,observe:e=>events.push(e.kind)});
 assert.equal(calls,1);assert.equal(events.at(-1),'drained');assert.equal((await h.discover()).length,1);
});
test('worker failure propagates rather than leaving a live abandoned owner loop',async()=>{
 const failure=Object.assign(Error('fixture'),{code:'JOURNAL_LOCK_CONTENDED'}),events=[];
 await assert.rejects(runPiDurableWorker({controller:{discover:async()=>{throw failure;},execute:async()=>{}},observe:e=>events.push(e.kind)}),failure);
 assert.equal(events.at(-1),'failed');
});
test('a pre-aborted worker performs no discovery or dispatch',async()=>{
 const abort=new AbortController();abort.abort();let calls=0;
 await runPiDurableWorker({controller:{discover:async()=>{calls++;return [];},execute:async()=>{calls++;}},signal:abort.signal,observe:()=>{}});
 assert.equal(calls,0);
});
test('the host supervisor restarts a failed worker and never restarts after drain',async()=>{
 const workers=[],messages=[];
 const supervisor=createPiDurableWorkerSupervisor({minRestartMs:10,maxRestartMs:20,spawnProcess:(_node,argv,options)=>{
  assert.equal(argv.at(-1),'--pi-worker');assert.equal(options.windowsHide,true);assert.equal(options.stdio[3],'ipc');
  const child=new EventEmitter();child.pid=40000+workers.length;child.stderr=new EventEmitter();child.connected=true;
  child.send=(message,callback)=>{messages.push(message);callback();};workers.push(child);return child;
 }});
 try{
  workers[0].emit('close',73,null);await new Promise(r=>setTimeout(r,30));assert.equal(workers.length,2);
  workers[1].emit('message',{protocol:PI_DURABLE_WORKER_PROTOCOL,kind:'ready',pid:workers[1].pid});
  assert.equal(supervisor.getStatus().state,'ready');assert.equal(supervisor.getStatus().restarts,1);
  supervisor.drain();assert.equal(messages.at(-1).kind,'drain');workers[1].emit('close',0,null);
  await new Promise(r=>setTimeout(r,30));assert.equal(workers.length,2);assert.equal(supervisor.getStatus().state,'stopped');
 }finally{supervisor.drain();}
});
test('semantic snapshot reuse rejects altered prior bytes despite unchanged event hashes',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('semantic-prefix'));
 const history=await f.journal.readExecutionProjections(),validate=createPiExecutionHistoryValidator({minimumCacheEvents:0});
 validate(history);const changed=structuredClone(history);changed[0].execution_projection.state.last_error={code:'FORGED'};
 assert.throws(()=>validate(changed),{code:'CORRUPT_STATE'});
 const envelope=structuredClone(history);envelope[0].workspace_id='dev_workspace_'+'f'.repeat(24);
 assert.throws(()=>validate(envelope),{code:'CORRUPT_STATE'});
 assert.equal(validate(history).size,1);
});
test('semantic cache cannot be corrupted by a caller changing the returned map or events',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('semantic-isolation'));
 const history=await f.journal.readExecutionProjections(),validate=createPiExecutionHistoryValidator({minimumCacheEvents:0});
 const first=validate(history);const saved=[...first.values()][0];saved.execution_projection.state.status='FORGED';first.clear();
 const fresh=await f.journal.readExecutionProjections();assert.equal([...validate(fresh).values()][0].execution_projection.state.status,'CREATED');
 await h.execute(intent('semantic-isolation'));
 const later=validate(await f.journal.readExecutionProjections());assert.equal([...later.values()][0].execution_projection.state.status,'COMPLETED');
});
test('incremental validation rejects an invalid append and still accepts the prior verified prefix',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('semantic-bad-suffix'));
 const history=await f.journal.readExecutionProjections(),validate=createPiExecutionHistoryValidator({minimumCacheEvents:0});validate(history);
 assert.throws(()=>validate([...history,history[0]]),{code:'CORRUPT_STATE'});assert.equal(validate(history).size,1);
});
test('disabled production route rejects a durable submit before operation admission',async t=>{
 const f=await fixture(t);await f.route.change({mode:'pi_paused',expected_revision:1,decision_id:'gpt-durable-pause',gate_hash:null},{validateGate:async()=>true});
 await assert.rejects(host(f).submit(intent('disabled-submit')),{code:'PRODUCTION_ROUTE_DISABLED'});
 assert.equal((await f.journal.readExecutionProjections()).length,0);
});
test('corrupt physical journal blocks worker discovery without publishing a head',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('physical-corruption'));
 const head=await readFile(path.join(f.storageRoot,'head.json'),'utf8');
 const first=(await readdir(path.join(f.storageRoot,'events'))).sort()[0];await appendFile(path.join(f.storageRoot,'events',first),' ');
 await assert.rejects(h.discover());assert.equal(await readFile(path.join(f.storageRoot,'head.json'),'utf8'),head);
});
test('verification dispatch owns a separate bounded deadline while ordinary reads retain theirs',async()=>{
 let calls=0;const adapter=createPiReliableMcpAdapter({requestTimeoutMs:5,longRequestTimeoutMs:100,queryTimeoutMs:100,
  callTool:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return {passed:true};},
  queryOperation:async()=>({}),resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'})});
 const i=intent('verification-deadline');i.permissions.tests=true;
 i.requested_actions=[{step_id:'action',capability:'verification.full',input:{suite:'all'},depends_on:[],idempotency_key:'async-verification-deadline'}];
 i.mutation_plan=[{step_id:'action',target:context.workspace_id,expected_change:'Bounded verification',input_sha256:hashExecutionInput({suite:'all'})}];i.verification.full=['action'];
 assert.equal((await adapter.execute(i,'action')).failed,false);
 await assert.rejects(adapter.execute(intent('ordinary-deadline'),'action'),{code:'TIMEOUT'});assert.equal(calls,2);
});
const urls=Object.fromEntries(['mcp-development-journal-tools','pi-production-execution-route','pi-production-execution-controller','mcp-operation-reconciliation-context'].map(name=>[name,new URL('../../server/src/'+name+'.mjs',import.meta.url).href]));
async function child(f,mode){
 const code=`import {appendFile} from 'node:fs/promises';
import {createDevOperationJournalService} from ${JSON.stringify(urls['mcp-development-journal-tools'])};
import {createPiProductionRouteStore} from ${JSON.stringify(urls['pi-production-execution-route'])};
import {createPiProductionExecutionController} from ${JSON.stringify(urls['pi-production-execution-controller'])};
import {fingerprintMcpMutationRequest} from ${JSON.stringify(urls['mcp-operation-reconciliation-context'])};
const [storageRoot,effects,mode]=process.argv.slice(1),context=${JSON.stringify(context)};
const journal=createDevOperationJournalService({storageRoot}),route=createPiProductionRouteStore({journal});
await journal.initialize();
const host=createPiProductionExecutionController({journal,route,transport:{
 resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'}),queryOperation:args=>journal.getOperation(args),
 callTool:async p=>{
 const started=await journal.begin({operation_type:'mcp_mutation',tool_name:p.name,workspace_id:context.workspace_id,workstream_id:context.workstream_id,
 reconciliation_key:p._meta.reconciliation_key,request_fingerprint_sha256:fingerprintMcpMutationRequest(p.name,p.arguments)});
 await appendFile(effects,'X');await journal.complete(started.operation_id,{result:{ok:true}});return {ok:true};
 }},executionHook:async stage=>{if(stage===mode)process.exit(73);}});
const pending=await host.discover();for(const r of pending)await host.execute(r.intent);
console.log(JSON.stringify({count:pending.length}));`;
 return exec(process.execPath,['--input-type=module','-e',code,f.storageRoot,path.join(f.root,'physical-once'),mode],{windowsHide:true,timeout:30000,maxBuffer:1024*1024});
}
for(const boundary of ['after_claim','after_dispatch','after_receipt'])test('actual worker exit at '+boundary+' safely resumes in a fresh process',async t=>{
 const f=await fixture(t),h=host(f),i=intent('process-'+boundary,true);const submitted=await h.submit(i);
 await assert.rejects(child(f,boundary),error=>error.code===73);
 await child(f,'finish');assert.equal(await readFile(path.join(f.root,'physical-once'),'utf8'),'X');
 const cold=host({...f,journal:createDevOperationJournalService({storageRoot:f.storageRoot})});
 const done=await cold.inspect({operation_id:submitted.state.operation_id,context});assert.equal(done.state.status,'COMPLETED');
 assert.equal(done.state.tool_results.length,1);assert.equal(done.runtime.owner,null);
 const before=await readFile(path.join(f.root,'physical-once'),'utf8');await child(f,'finish');assert.equal(await readFile(path.join(f.root,'physical-once'),'utf8'),before);
});
test('competing independent processes preserve a single physical effect',async t=>{
 const f=await fixture(t),h=host(f);await h.submit(intent('two-process-workers',true));
 await Promise.all([child(f,'finish'),child(f,'finish')]);
 assert.equal(await readFile(path.join(f.root,'physical-once'),'utf8'),'X');
 assert.equal((await h.discover()).length,0);
});
