import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDevOperationJournalService,DEV_JOURNAL_MAX_EVENT_BYTES,DEV_JOURNAL_MAX_EXECUTION_EVENT_BYTES} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
import {REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
async function fixture(t) {
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-keyed-reader-'));
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 const journal=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 const intent={schema_version:1,intent_id:'keyed-reader-large-typed-event',goal:'Read isolated package',context:{project_id:'writer_workbench',workstream_id:'dev_workstream_20261004-030000_'+'a'.repeat(12),workspace_id:'dev_workspace_'+'a'.repeat(24)},constraints:Array.from({length:80},(_,i)=>String(i)+'x'.repeat(2000)),requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'}}],mutation_plan:[],verification:{focused:[],affected:[],full:[]},completion_conditions:['Durable read evidence'],permissions:{read:true,workspace_create:false,write:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
 await createPiReliableExecutionStore({journal}).admit(intent);
 const events=path.join(root,'journal','events');
 const names=await readdir(events);let largest={bytes:Buffer.alloc(0)};
 for(const name of names){const bytes=await readFile(path.join(events,name));if(bytes.length>largest.bytes.length)largest={name,bytes};}
 const bytes=largest.bytes;names.splice(names.indexOf(largest.name),1);names.unshift(largest.name);
 assert(bytes.length>DEV_JOURNAL_MAX_EVENT_BYTES);assert(bytes.length<DEV_JOURNAL_MAX_EXECUTION_EVENT_BYTES);
 return {root,journal,events,names};
}
const admission=(journal,key='reader-regression-001',fingerprint='a'.repeat(64))=>journal.begin({operation_type:'reader_regression',tool_name:'reader.regression',reconciliation_key:key,request_fingerprint_sha256:fingerprint});
test('legal large typed Pi event does not block new keyed admission or its duplicate lookup',async t=>{
 const f=await fixture(t),started=await admission(f.journal);await f.journal.complete(started.operation_id);
 await assert.rejects(admission(f.journal),{code:'RECONCILIATION_EXISTING_OPERATION'});
 assert.equal((await f.journal.status()).chain_verified,true);
});
test('same key with a different fingerprint retains conflict protection after a large typed event',async t=>{
 const f=await fixture(t),started=await admission(f.journal);await f.journal.complete(started.operation_id);
 await assert.rejects(admission(f.journal,'reader-regression-001','b'.repeat(64)),/conflict|fingerprint/i);
});
test('normal event physical 128 KiB bound remains enforced',async t=>{
 const f=await fixture(t),started=await f.journal.begin({operation_type:'normal_regression',tool_name:'normal.regression'});await f.journal.complete(started.operation_id);
 const names=await readdir(f.events);let target;
 for(const name of names){const bytes=await readFile(path.join(f.events,name));if(JSON.parse(bytes).operation_type==='normal_regression'){target={name,bytes};break;}}
 assert(target);await writeFile(path.join(f.events,target.name),Buffer.concat([Buffer.alloc(DEV_JOURNAL_MAX_EVENT_BYTES,32),target.bytes]));
 const cold=createDevOperationJournalService({storageRoot:path.join(f.root,'journal')});
 await assert.rejects(admission(cold,'reader-normal-bound-001'),/limit|size|unsafe|invalid|corrupt/i);
});
test('physical typed event above 1 MiB is still rejected before keyed lookup',async t=>{
 const f=await fixture(t),target=path.join(f.events,f.names[0]),bytes=await readFile(target);
 await writeFile(target,Buffer.concat([Buffer.alloc(DEV_JOURNAL_MAX_EXECUTION_EVENT_BYTES,32),bytes]));
 const cold=createDevOperationJournalService({storageRoot:path.join(f.root,'journal')});
 await assert.rejects(admission(cold,'reader-typed-bound-001'),/unsafe|limit|size|corrupt/i);
});
