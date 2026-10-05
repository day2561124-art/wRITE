import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createExecutionIntent,hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
import {createPiReliableExecutionEngine} from '../../server/src/pi-reliable-execution-engine.mjs';
import {createPiReliableMcpAdapter} from '../../server/src/pi-mcp-reliable-adapter.mjs';
import {piBootstrapBinding} from '../../server/src/pi-workstream-bootstrap.mjs';
import {createPiLifecycleScopeVerifier} from '../../server/src/pi-lifecycle-scope.mjs';
const shared='dev_workspace_shared_repository_v1';
const wid='dev_workstream_20261004-100000_123456789abc',ws='dev_workspace_'+'a'.repeat(24),base='1'.repeat(40);
const begin={workstream_id:wid,workspace_id:shared,revision:1,base_head:base};
const isolate={workstream_id:wid,workspace_id:ws,workstream_revision:2,base_head:base,state:'active'};
export function intent(extra=[]){
 const actions=[{step_id:'begin',capability:'workspace.begin_workstream',input:{label:'GPT bootstrap',declared_scope:['tests/.tmp/*']},depends_on:[],idempotency_key:'bootstrap-start-0001'},
  {step_id:'isolate',capability:'workspace.create_isolated',input:{},depends_on:['begin'],idempotency_key:'bootstrap-isolate-0001'},...extra];
 return {schema_version:1,bootstrap:true,intent_id:'bootstrap-binding-001',goal:'GPT-authored deterministic lifecycle',context:{project_id:'writer_workbench',workstream_id:null,workspace_id:shared},constraints:['No semantic decisions or shared-main mutation'],requested_actions:actions,
  mutation_plan:actions.filter(a=>a.idempotency_key).map(a=>({step_id:a.step_id,target:a.capability==='workspace.create_checkpoint'?'bootstrap_workspace':a.input.path??'bootstrap_workstream',expected_change:'Exact GPT action',input_sha256:hashExecutionInput(a.input)})),
  verification:{focused:[],affected:[],full:[]},completion_conditions:['GPT reviews'],permissions:{read:true,workspace_create:true,write:true,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
}
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'pi-bootstrap-'));t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});const journal=createDevOperationJournalService({storageRoot:path.join(root,'journal')});return {root,journal,store:createPiReliableExecutionStore({journal})};}
function adapter(callTool,queryOperation=async()=>{throw Error('unexpected reconciliation');}){return createPiReliableMcpAdapter({callTool,queryOperation,verifyScope:async()=>true,resolveWorkspace:async args=>({...args,workstream_id:wid,workspace_type:'isolated_worktree',state:'active'})});}
test('admission requires explicit inception context, ordered singleton bootstrap and exact permissions',()=>{
 assert.equal(createExecutionIntent(intent()).bootstrap,true);
 for(const edit of [v=>v.bootstrap=false,v=>v.context.workstream_id=wid,v=>v.context.workspace_id=ws,v=>v.requested_actions[1].input.workspace_id=ws,v=>v.permissions.workspace_create=false,v=>v.requested_actions.reverse(),v=>v.mutation_plan[1].target='caller-workstream',v=>v.requested_actions[0].input.command='git init']){
  const v=intent();edit(v);assert.throws(()=>createExecutionIntent(v));
 }
 const normal=intent();delete normal.bootstrap;assert.throws(()=>createExecutionIntent(normal));
});
test('physical checkpoint is admitted only against the symbolic future isolated identity',()=>{
 const v=intent([{step_id:'checkpoint',capability:'workspace.create_checkpoint',input:{label:'GPT checkpoint'},depends_on:['isolate'],idempotency_key:'bootstrap-checkpoint-0001'}]);
 assert.equal(createExecutionIntent(v).requested_actions.length,3);
 v.mutation_plan[2].target=shared;assert.throws(()=>createExecutionIntent(v),/MUTATION_TARGET_MISMATCH/);
});
test('receipt-derived binding rejects wrong workspace/base/revision and requires ordered transition',()=>{
 const b=piBootstrapBinding(null,'workspace.begin_workstream',begin);assert.equal(b.workstream_revision,1);
 assert.deepEqual(piBootstrapBinding(b,'workspace.create_isolated',isolate),{project_id:'writer_workbench',workstream_id:wid,workspace_id:ws,workstream_revision:2,base_head:base});
 for(const bad of [{...isolate,base_head:'2'.repeat(40)},{...isolate,workspace_id:shared},{...isolate,workstream_revision:1},{...isolate,state:'creating'}])assert.throws(()=>piBootstrapBinding(b,'workspace.create_isolated',bad));
 assert.throws(()=>piBootstrapBinding(null,'workspace.create_isolated',isolate));assert.throws(()=>piBootstrapBinding(b,'workspace.begin_workstream',begin));
});
test('one durable operation binds downstream mutation and returns duplicate with zero new dispatch',async t=>{
 const {store}=await fixture(t);const calls=[];
 const a=adapter(async p=>{calls.push(p);return p.name==='dev_workspace_begin_workstream'?begin:p.name==='dev_workspace_create_isolated'?isolate:{ok:true};});
 const v=intent([{step_id:'write',capability:'filesystem.write',input:{path:'tests/.tmp/new.txt',content:'GPT exact'},depends_on:['isolate'],idempotency_key:'bootstrap-write-0001'}]);
 const r=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);
 assert.equal(r.state.status,'COMPLETED');assert.equal(calls.length,3);
 assert.equal(calls[1].arguments.workstream_id,wid);assert.equal(calls[1].arguments.expected_workstream_revision,1);assert.equal(calls[2].arguments.workspace_id,ws);
 assert.equal(r.result.execution_context.workspace_id,ws);assert.equal(r.intent.context.workspace_id,shared);assert.equal(r.intent.requested_actions[2].input.content,'GPT exact');
 const second=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);assert.equal(second.state.operation_id,r.state.operation_id);assert.equal(calls.length,3);
});
test('lost bootstrap response reconciles exact durable facts and never repeats physical creation',async t=>{
 const {store}=await fixture(t);const calls=[];
 const a=adapter(async p=>{calls.push(p);if(p.name==='dev_workspace_begin_workstream')throw Object.assign(Error('lost'),{code:'TIMEOUT'});return isolate;},async p=>({...p,reconciliation_state:'completed',operation_id:'dev_operation_'+'b'.repeat(32),original_result:begin}));
 const r=await createPiReliableExecutionEngine({store,adapter:a}).execute(intent());assert.equal(r.state.status,'COMPLETED');assert.equal(calls.length,2);assert.equal(r.receipts[0].kind,'reconciled_facts');assert.equal(r.runtime.lifecycle_binding.workspace_id,ws);
});
test('partial or unknown bootstrap effect requires GPT and creates no isolated workspace',async t=>{
 for(const kind of ['unknown','partial']){const {store}=await fixture(t);let calls=0;const v=intent();v.intent_id+='-'+kind;v.requested_actions[0].idempotency_key+='-'+kind;v.requested_actions[1].idempotency_key+='-'+kind;
  const a=adapter(async()=>{calls++;throw Object.assign(Error('lost'),{code:'TIMEOUT'});},async p=>({...p,reconciliation_state:kind}));
  const r=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);assert.equal(r.state.status,'DECISION_REQUIRED');assert.equal(calls,1);assert.equal(r.runtime.lifecycle_binding,null);
 }
});
test('GPT terminal workstream action is revision-bound and its completed duplicate never reopens it',async t=>{
 const {store}=await fixture(t);let calls=0;let current={workstream_id:wid,workspace_id:ws,state:'active',revision:2,base_head:base};
 const verifyScope=createPiLifecycleScopeVerifier({getWorkstream:async()=>current,getCheckpoint:async()=>null,getOperation:async()=>null});
 const a=createPiReliableMcpAdapter({callTool:async()=>{calls++;current={...current,state:'completed',revision:3};return current;},verifyScope,resolveWorkspace:async()=>{throw Error('unexpected workspace mutation');},queryOperation:async()=>{throw Error('unexpected reconciliation');}});
 const v=intent();delete v.bootstrap;v.context={project_id:'writer_workbench',workstream_id:wid,workspace_id:ws};v.intent_id='terminal-workstream-001';v.requested_actions=[{step_id:'end',capability:'workspace.end_workstream',input:{workstream_id:wid,expected_revision:2,outcome:'completed'},depends_on:[],idempotency_key:'terminal-workstream-key-001'}];v.mutation_plan=[{step_id:'end',target:wid,expected_change:'GPT closes this workstream',input_sha256:hashExecutionInput(v.requested_actions[0].input)}];
 const first=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);assert.equal(first.state.status,'COMPLETED');
 const duplicate=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);assert.equal(duplicate.state.operation_id,first.state.operation_id);assert.equal(calls,1);
 v.intent_id+='-forged';v.requested_actions[0].idempotency_key+='-forged';const refused=await createPiReliableExecutionEngine({store,adapter:a}).execute(v);assert.equal(refused.state.status,'BLOCKED');assert.equal(calls,1);
});
