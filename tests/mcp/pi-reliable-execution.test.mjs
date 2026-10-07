import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPiExecutionStateStore } from "../../server/src/pi-execution-state-store.mjs";
import { createPiReliableExecutionStore } from "../../server/src/pi-reliable-execution-store.mjs";
import { createPiReliableExecutionEngine } from "../../server/src/pi-reliable-execution-engine.mjs";
import { createPiReliableMcpAdapter } from "../../server/src/pi-mcp-reliable-adapter.mjs";
import { REQUIRED_DECISION_BOUNDARIES, hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
import { reduceReliableProjection, receiptOf } from "../../server/src/pi-reliable-execution-state.mjs";
const context = { project_id:"writer_workbench", workstream_id:"dev_workstream_20261003-100124_6f779341a426",
  workspace_id:"dev_workspace_86a7ddd3980944b0902ac022" };
function intent(actions = [{step_id:"read",capability:"filesystem.read",input:{path:"package.json"},depends_on:[]}], overrides={}) {
  return {schema_version:1,intent_id:"reliable-intent-001",goal:"Execute GPT supplied actions",context,
    constraints:["Keep production routing unchanged"],requested_actions:actions,
    mutation_plan:actions.filter(x=>x.idempotency_key).map(x=>({step_id:x.step_id,target:x.input.path ?? "workspace",
      expected_change:"Apply the exact GPT input",input_sha256:hashExecutionInput(x.input)})),
    verification:{focused:[],affected:[],full:[]},completion_conditions:["GPT reviews evidence"],
    permissions:{read:true,workspace_create:false,write:true,tests:true,commit:false,integrate:false,push:false},
    decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES],...overrides};
}
const write = {step_id:"write",capability:"filesystem.write",input:{path:"tests/.tmp/output.txt",content:"GPT text"},
  idempotency_key:"mutation-key-001",depends_on:[]};
async function fixture(t, options={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),"pi-reliable-"));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
  const store=createPiReliableExecutionStore({journal,...options});
  return {root,journal,store};
}
function adapter(callTool, queryOperation=async()=>({reconciliation_state:"not_admitted",safe_same_key_retry:true}), extra={}) {
  return createPiReliableMcpAdapter({callTool,queryOperation,
    resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),...extra});
}
const timeout=()=>Object.assign(new Error("secret transport details"),{code:"TIMEOUT"});
function engine(store,a,options={}) {
  return createPiReliableExecutionEngine({store,adapter:a,retryPolicy:{max_attempts:3,base_delay_ms:1,max_delay_ms:4},...options});
}
test("normal execution persists exact receipts, checkpoints and GPT review boundary",async t=>{
  const {store,journal}=await fixture(t);let calls=0;
  const a=adapter(async()=>{calls++;return {content:[{type:"text",text:"facts"}]};});
  const r=await engine(store,a).execute(intent());
  assert.equal(r.state.status,"COMPLETED");assert.deepEqual(r.state.completed_steps,["read"]);
  assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].evidence.content[0].text,"facts");
  assert.equal(r.result.engineering_review_required,true);assert.equal(r.result.production_default_changed,false);
  assert.equal(r.state.checkpoint.step_id,"read");assert.equal(calls,1);
  assert.equal((await journal.status()).active_operation_count,0);
});
test("duplicate intent returns stored terminal result without another mutation",async t=>{
  const {store}=await fixture(t);let calls=0;const a=adapter(async()=>{calls++;return {ok:true};});
  const e=engine(store,a);const first=await e.execute(intent([write]));const second=await engine(store,a).execute(intent([write]));
  assert.equal(second.state.operation_id,first.state.operation_id);assert.equal(calls,1);
  await assert.rejects(e.execute(intent([write],{goal:"changed"})),/INTENT_ID_CONFLICT/);
});
test("same mutation key under a different intent is refused before dispatch",async t=>{
  const {store}=await fixture(t);let calls=0;const a=adapter(async()=>{calls++;return {ok:true};});
  await engine(store,a).execute(intent([write]));
  await assert.rejects(engine(store,a).execute(intent([{...write,input:{...write.input,content:"different"}}],
    {intent_id:"different-intent"})),/IDEMPOTENCY_KEY_CONFLICT/);assert.equal(calls,1);
});
test("safe reads retry with durable bounded backoff and no engineering choices",async t=>{
  const {store}=await fixture(t);let calls=0;const delays=[];
  const r=await engine(store,adapter(async()=>{if(++calls<3)throw timeout();return {ok:true};}),
    {sleep:async ms=>{delays.push(ms);await new Promise(r=>setTimeout(r,ms));}}).execute(intent());
  assert.equal(r.state.status,"COMPLETED");assert.equal(calls,3);assert.equal(r.state.retry_count,2);
  assert.equal(delays.length,2);assert(delays.every(x=>x>=0&&x<=4));
});
test("retry exhaustion requests GPT and preserves failure facts",async t=>{
  const {store}=await fixture(t);let calls=0;
  const r=await engine(store,adapter(async()=>{calls++;throw timeout();})).execute(intent());
  assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,3);
  assert.equal(r.state.last_error.code,"RETRY_EXHAUSTED");assert(!JSON.stringify(r).includes("secret transport"));
});
test("mutation timeout reconciles a completed effect instead of blind retry",async t=>{
  const {store,root}=await fixture(t);let calls=0;let request;
  const a=adapter(async params=>{request=params;calls++;await writeFile(path.join(root,"physical.txt"),"once");throw timeout();},
    async params=>({reconciliation_key:params.reconciliation_key,request_fingerprint_sha256:params.request_fingerprint_sha256,
      reconciliation_state:"completed",operation_id:"dev_operation_"+"a".repeat(32)}));
  const r=await engine(store,a).execute(intent([write]));assert.equal(r.state.status,"COMPLETED");assert.equal(calls,1);
  assert.equal(request._meta.reconciliation_key,write.idempotency_key);
  assert.equal(await readFile(path.join(root,"physical.txt"),"utf8"),"once");
  assert.equal(r.receipts[0].kind,"reconciled_facts");assert.equal(r.receipts[0].original_response_available,false);
});
test("only verified not-admitted mutation can retry with the original key",async t=>{
  const {store}=await fixture(t);let calls=0;const keys=[];
  const a=adapter(async p=>{keys.push(p._meta.reconciliation_key);if(++calls===1)throw timeout();return {ok:true};},
    async p=>({...p,reconciliation_state:"not_admitted",safe_same_key_retry:true}));
  const r=await engine(store,a).execute(intent([write]));
  assert.equal(r.state.status,"COMPLETED");assert.equal(calls,2);assert.deepEqual(keys,[write.idempotency_key,write.idempotency_key]);
});
test("host maintenance not-admitted reconciliation retries with the dispatch fingerprint",async t=>{
  const {store}=await fixture(t);let calls=0;const keys=[];
  const host={step_id:"host",capability:"host.powershell",input:{command:"Write-Output ok",cwd:".",timeoutMs:30000},
    idempotency_key:"host-maintenance-key-001",depends_on:[]};
  const a=createPiReliableMcpAdapter({
    callTool:async p=>{keys.push(p._meta.reconciliation_key);if(++calls===1)throw timeout();return {ok:true};},
    queryOperation:async p=>({...p,reconciliation_state:"not_admitted",safe_same_key_retry:true}),
    resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),
    verifyScope:async({step})=>step.scope==="host_maintenance"&&step.arguments.workspace_id==="dev_workspace_shared_repository_v1"
  });
  const r=await engine(store,a).execute(intent([host]));
  assert.equal(r.state.status,"COMPLETED");assert.equal(calls,2);
  assert.deepEqual(keys,[host.idempotency_key,host.idempotency_key]);
});
for(const state of ["no_effect","recovery_required","unknown","partial","active"]) {
  test("ambiguous mutation "+state+" escalates without replay",async t=>{
    const {store}=await fixture(t);let calls=0;
    const r=await engine(store,adapter(async()=>{calls++;throw timeout();},
      async p=>({...p,reconciliation_state:state,reinitiate_requires_new_key:state==="no_effect"}))).execute(intent([write]));
    assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,1);
  });
}
test("unbound or mismatched reconciliation observation fails safe",async t=>{
  const {store}=await fixture(t);let calls=0;
  const r=await engine(store,adapter(async()=>{calls++;throw timeout();},
    async()=>({reconciliation_state:"completed",reconciliation_key:"foreign-key"}))).execute(intent([write]));
  assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,1);
});
for(const payload of [{isError:true},{passed:false},{content:[{type:"text",text:'{"passed":false}'}]}]) {
  test("tool validation failure is persisted and never retried "+JSON.stringify(payload),async t=>{
    const {store}=await fixture(t);let calls=0;
    const r=await engine(store,adapter(async()=>{calls++;return payload;})).execute(intent());
    assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,1);
  });
}
test("permission and shared-main guards stop all dispatch",async t=>{
  const {store}=await fixture(t);let calls=0;
  await assert.rejects(engine(store,adapter(async()=>{calls++;return{};})).execute(intent([write],
    {permissions:{read:true,workspace_create:false,write:false,tests:false,commit:false,integrate:false,push:false}})));
  assert.equal(calls,0);
  const blocked=adapter(async()=>{calls++;return{};},undefined,
    {resolveWorkspace:async()=>({...context,workspace_type:"shared",state:"active"})});
  const r=await engine(store,blocked).execute(intent([write]));assert.equal(r.state.status,"BLOCKED");assert.equal(calls,0);
});
test("schema 1 stays non-dispatchable and coexists with schema 2",async t=>{
  const {journal,store}=await fixture(t);
  const b=createPiExecutionStateStore({journal});const legacy=await b.admit(intent(undefined, {intent_id:"legacy-intent"}));
  await assert.rejects(engine(store,adapter(async()=>({}))).execute(intent(undefined,{intent_id:"legacy-intent"})),/LEGACY_OPERATION_NOT_MIGRATED/);
  const r=await engine(store,adapter(async()=>({}))).execute(intent());assert.equal(r.state.status,"COMPLETED");
  assert.equal((await b.inspect({operation_id:legacy.state.operation_id,context})).schema_version,1);
});
test("workspace mismatch and stale CAS cannot modify progress",async t=>{
  const {store}=await fixture(t);const r=await store.admit(intent());
  await assert.rejects(store.inspect({operation_id:r.state.operation_id,context:{...context,workspace_id:"shared"}}),/WORKSPACE_CONTEXT_MISMATCH/);
  await assert.rejects(store.command({operation_id:r.state.operation_id,context,expected_revision:0,
    command:{type:"phase_changed",status:"ADMITTED"}}),/STATE_REVISION_CONFLICT/);
});

test("Pi request deadline catches a tool that never settles",async t=>{
  const {store}=await fixture(t);let calls=0;
  const r=await engine(store,adapter(async()=>{calls++;return new Promise(()=>{});},undefined,{requestTimeoutMs:5})).execute(intent());
  assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,3);assert.equal(r.state.last_error.code,"RETRY_EXHAUSTED");
});
test("late read response cannot replace a newer stored receipt",async t=>{
  const {store}=await fixture(t);let resolveLate,calls=0;
  const a=adapter(async()=>++calls===1?new Promise(r=>{resolveLate=r;}):{value:"current"},undefined,{requestTimeoutMs:5});
  const r=await engine(store,a).execute(intent());resolveLate({value:"late"});await new Promise(r=>setImmediate(r));
  const restored=await store.inspect({operation_id:r.state.operation_id,context});
  assert.deepEqual(restored.receipts,r.receipts);assert.equal(restored.receipts[0].evidence.value,"current");assert.equal(calls,2);
});
test("transport reconnect is scheduled and journaled by Pi",async t=>{
  const {store,journal}=await fixture(t);let connected=false,calls=0,reconnects=0;
  const a=adapter(async()=>{calls++;if(!connected)throw Object.assign(new Error("disconnect"),{code:"TRANSPORT_ERROR"});return {ok:true};},
    undefined,{reconnect:async()=>{reconnects++;connected=true;}});
  const r=await engine(store,a).execute(intent());assert.equal(r.state.status,"COMPLETED");assert.equal(calls,2);assert.equal(reconnects,1);
  const actions=(await journal.readExecutionProjections()).map(x=>x.execution_projection.action_type);
  assert(actions.includes("connection_reconnect_requested"));assert(actions.includes("connection_reconnected"));
});
test("known active MCP execution is polled without another mutation",async t=>{
  const {store}=await fixture(t);let calls=0,queries=0;
  const a=adapter(async()=>{calls++;throw timeout();},async p=>({...p,
    reconciliation_state:++queries===1?"active":"completed",operation_id:"dev_operation_"+"b".repeat(32)}));
  const r=await engine(store,a).execute(intent([write]));assert.equal(r.state.status,"COMPLETED");assert.equal(calls,1);assert.equal(queries,2);
});
test("transient reconciliation read retries preserve the mutation claim",async t=>{
  const {store}=await fixture(t);let calls=0,queries=0;
  const a=adapter(async()=>{calls++;throw timeout();},async p=>{
    if(++queries===1)throw timeout();return {...p,reconciliation_state:"completed",operation_id:"dev_operation_"+"b".repeat(32)};});
  const r=await engine(store,a).execute(intent([write]));assert.equal(r.state.status,"COMPLETED");assert.equal(calls,1);assert.equal(queries,2);
  assert.equal(r.state.resume_point,null);
});
test("write then verification then commit follows GPT order and declared PASS facts",async t=>{
  const {store}=await fixture(t);const names=[];
  const verify={step_id:"verify",capability:"verification.focused",input:{suite:"mcp_core"},depends_on:["write"],idempotency_key:"verification-key-001"};
  const commit={step_id:"commit",capability:"git.commit",input:{message:"GPT commit",paths:[write.input.path],expectedHead:"a".repeat(40)},
    depends_on:["verify"],idempotency_key:"commit-key-001"};
  const source=intent([write,verify,commit],{verification:{focused:["verify"],affected:[],full:[]},
    permissions:{...intent().permissions,commit:true}});
  const r=await engine(store,adapter(async p=>{names.push(p.name);return {ok:true,passed:true};})).execute(source);
  assert.deepEqual(names,["dev_create_file","dev_run_tests","dev_git_commit"]);assert.equal(r.state.status,"COMPLETED");
  assert.equal(r.state.verification_state.focused,"passed");assert.equal(r.state.checkpoint.at_revision,r.revision-1);
  assert(Object.isFrozen(r.intent.requested_actions));assert(Object.isFrozen(r.receipts));
});
test("completed MCP testing without PASS evidence escalates to GPT",async t=>{
  const {store}=await fixture(t);let calls=0;
  const verify={step_id:"verify",capability:"verification.focused",input:{suite:"mcp_core"},depends_on:[],idempotency_key:"verification-key-001"};
  const a=adapter(async()=>{calls++;throw timeout();},async p=>({...p,reconciliation_state:"completed",
    operation_id:"dev_operation_"+"b".repeat(32),original_result:{outcome:"intended_effect_observed"}}));
  const r=await engine(store,a).execute(intent([verify],{verification:{focused:["verify"],affected:[],full:[]}}));
  assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(r.state.last_error.code,"VALIDATION_EVIDENCE_REQUIRED");assert.equal(calls,1);
});
test("Pi refuses a phase conflict without reordering or changing GPT content",async t=>{
  const {store}=await fixture(t);let calls=0;
  const verify={step_id:"verify",capability:"verification.focused",input:{suite:"mcp_core"},depends_on:[],idempotency_key:"verification-key-001"};
  const r=await engine(store,adapter(async()=>{calls++;return {passed:true};})).execute(intent([verify,write],
    {verification:{focused:["verify"],affected:[],full:[]}}));
  assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(r.state.last_error.code,"PHASE_ORDER_CONFLICT");
  assert.equal(calls,1);assert.deepEqual(r.state.pending_steps,["write"]);
});
test("unknown owner liveness never permits takeover",async t=>{
  const {store}=await fixture(t,{isOwnerAlive:()=>null});let calls=0;
  let r=await store.admit(intent());
  r=await store.command({operation_id:r.state.operation_id,context,expected_revision:r.revision,
    command:{type:"owner_acquired",owner:{worker_id:"pi_worker_"+"a".repeat(32),pid:123456789,hostname:"unknown-host"},replaced_worker_id:null}});
  const result=await engine(store,adapter(async()=>{calls++;return{};})).execute(intent());
  assert.equal(result.result.pause_reason,"OWNER_LIVENESS_UNCERTAIN");assert.equal(result.revision,r.revision);assert.equal(calls,0);
});
test("a deduplicated MCP response is labeled as facts rather than original response",async t=>{
  const {store}=await fixture(t);
  const a=adapter(async p=>({content:[{type:"text",text:JSON.stringify({reconciled:true,
    reconciliation_key:p._meta.reconciliation_key,request_fingerprint_sha256:hashExecutionInput({tool_name:p.name,arguments:p.arguments}),
    reconciliation_state:"completed",operation_id:"dev_operation_"+"b".repeat(32)})}]}));
  const r=await engine(store,a).execute(intent([write]));
  assert.equal(r.state.status,"COMPLETED");assert.equal(r.receipts[0].kind,"reconciled_facts");assert.equal(r.receipts[0].original_response_available,false);
});
test("history reducer rejects a failure relabeled as success and phase bypass of backoff",async t=>{
  const {store}=await fixture(t);let claim,waiting,calls=0;
  await engine(store,adapter(async()=>{if(++calls===1)throw timeout();return{ok:true};}),
    {executionHook:async(stage,r)=>{if(stage==="after_claim"&&!claim)claim=r;if(stage==="retry_scheduled")waiting=r;}}).execute(intent());
  assert.throws(()=>reduceReliableProjection(claim,{type:"tool_call_completed",worker_id:claim.runtime.owner.worker_id,
    call_id:claim.runtime.active_call.call_id,receipt:receiptOf(claim.intent.requested_actions[0],{passed:false})},claim.state.updated_at),
    /INVALID_SUCCESS_RECEIPT/);
  assert.throws(()=>reduceReliableProjection(waiting,{type:"phase_changed",worker_id:waiting.runtime.owner.worker_id,status:"EXECUTING"},
    waiting.state.updated_at),/INVALID_PHASE_COMMAND/);
});
