import assert from "node:assert/strict";
import test from "node:test";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
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
async function interruptedClaim(t,{alive=false,query,actions=[write]}={}) {
  const f=await fixture(t,{isOwnerAlive:async()=>alive});let sends=0;
  const a=adapter(async()=>{sends++;throw Error("must not dispatch");},query??(async p=>({...p,
    reconciliation_state:"completed",operation_id:"dev_operation_"+"a".repeat(32)})));
  await assert.rejects(engine(f.store,a,{executionHook:async point=>{
    if(point==="after_claim")throw Error("worker disappeared");
  }}).execute(intent(actions)),/worker disappeared/);
  const claim=(await f.store.readHistory()).at(-1).execution_projection;
  const args={operation_id:claim.state.operation_id,context:claim.intent.context,
    expected_revision:claim.revision,expected_owner:claim.runtime.owner};
  return {...f,a,args,claim,sends:()=>sends};
}
test("reconcile-only persists a completed receipt and stops before dependent dispatch",async t=>{
  const f=await interruptedClaim(t,{actions:[write,{step_id:"read",capability:"filesystem.read",
    input:{path:"package.json"},depends_on:["write"]}]});
  const r=await engine(f.store,f.a).reconcileOnly(f.args);
  assert.deepEqual(r.state.completed_steps,["write"]);assert.deepEqual(r.state.pending_steps,["read"]);
  assert.equal(r.runtime.owner,null);assert.equal(r.runtime.active_call,null);assert.equal(f.sends(),0);
  assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].kind,"reconciled_facts");
  assert.equal(r.result.pause_reason,"GPT_CONTINUATION_REQUIRED");
  await assert.rejects(engine(f.store,f.a).reconcileOnly(f.args),{code:"STATE_REVISION_CONFLICT"});
  assert.equal((await f.journal.status()).health,"healthy");
});
for(const state of ["not_admitted","active","unknown","partial"]) {
  test("reconcile-only preserves unknown claim and owner for "+state,async t=>{
    const f=await interruptedClaim(t,{query:async p=>({...p,reconciliation_state:state,safe_same_key_retry:true})});
    const r=await engine(f.store,f.a).reconcileOnly(f.args);
    assert.equal(r.projection_hash,f.claim.projection_hash);assert.equal(r.revision,f.claim.revision);
    assert.deepEqual(r.runtime.owner,f.claim.runtime.owner);assert.deepEqual(r.runtime.active_call,f.claim.runtime.active_call);
    assert.equal(r.result.dispatch_paused,true);assert.equal(f.sends(),0);
  });
}
for(const alive of [true,null])test("reconcile-only refuses active or uncertain owner "+alive,async t=>{
  const f=await interruptedClaim(t,{alive,query:async()=>{throw Error("must not query");}});
  const r=await engine(f.store,f.a).reconcileOnly(f.args);
  assert.equal(r.projection_hash,f.claim.projection_hash);assert.equal(f.sends(),0);
  assert.equal(r.result.pause_reason,alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN");
});
test("reconcile-only requires exact owner, revision and operation context",async t=>{
  const f=await interruptedClaim(t);
  for(const [edit,code] of [[{expected_owner:{...f.args.expected_owner,pid:1}},"OWNER_CONFLICT"],
    [{expected_revision:1},"STATE_REVISION_CONFLICT"],[{context:{...context,workstream_id:null}},"WORKSPACE_CONTEXT_MISMATCH"],
    [{operation_id:"pi_operation_"+"f".repeat(32)},"UNKNOWN_PI_OPERATION"],
    [{expected_revision:undefined},"INVALID_RECONCILIATION_REQUEST"]])
    await assert.rejects(engine(f.store,f.a).reconcileOnly({...f.args,...edit}),{code});
  assert.equal((await f.store.inspect(f.args)).projection_hash,f.claim.projection_hash);
});
test("reconcile-only rejects forged completed receipt without transferring ownership",async t=>{
  const f=await interruptedClaim(t,{query:async p=>({...p,reconciliation_key:"foreign-key",reconciliation_state:"completed",
    operation_id:"dev_operation_"+"a".repeat(32)})});
  const r=await engine(f.store,f.a).reconcileOnly(f.args);assert.equal(r.projection_hash,f.claim.projection_hash);
});
test("reconcile-only validates receipt before writes and fences races after lookup",async t=>{
  const f=await interruptedClaim(t);const broken={...f.a,reconcile:async()=>({verdict:"completed",receipt:{}})};
  await assert.rejects(engine(f.store,broken).reconcileOnly(f.args));
  assert.equal((await f.store.inspect(f.args)).projection_hash,f.claim.projection_hash);
  const racing={...f.a,reconcile:async(...args)=>{
    const result=await f.a.reconcile(...args);
    await f.store.command({...f.args,command:{type:"owner_acquired",owner:{...f.args.expected_owner,
      worker_id:"pi_worker_"+"b".repeat(32)},replaced_worker_id:f.args.expected_owner.worker_id}});
    return result;
  }};
  await assert.rejects(engine(f.store,racing).reconcileOnly(f.args),{code:"STATE_REVISION_CONFLICT"});
  assert.equal((await f.store.inspect({operation_id:f.args.operation_id,context})).runtime.active_call.call_id,f.claim.runtime.active_call.call_id);
});
test("reconcile-only lookup failure leaves durable history unchanged",async t=>{
  const f=await interruptedClaim(t,{query:async()=>{throw timeout();}});
  const r=await engine(f.store,f.a).reconcileOnly(f.args);
  assert.equal(r.projection_hash,f.claim.projection_hash);assert.equal(r.result.pause_reason,"RECONCILIATION_UNAVAILABLE");
});
function engine(store,a,options={}) {
  return createPiReliableExecutionEngine({store,adapter:a,retryPolicy:{max_attempts:3,base_delay_ms:1,max_delay_ms:4},...options});
}

function isolationRequest(f) {
  return {...f.args,expected_projection_hash:f.claim.projection_hash,
    decision_id:"gpt-isolate-reviewed-001",reason:"Unknown outcome retained; independent host proof confirms no live executor or pending dispatch."};
}
function isolationStore(f,extra={}) {
  return createPiReliableExecutionStore({journal:f.journal,isOwnerAlive:async()=>false,
    isolationAuthority:async()=>true,...extra});
}
test("durable isolation preserves UNKNOWN evidence and fences owners, claims and replay after restart",async t=>{
  const f=await interruptedClaim(t),before=await f.store.readHistory();
  const s=isolationStore(f),r=await s.isolate(isolationRequest(f));
  assert.equal(r.state.status,"EXECUTING");assert.equal(r.revision,f.claim.revision+1);
  assert.deepEqual(r.runtime.owner,f.claim.runtime.owner);assert.deepEqual(r.runtime.active_call,f.claim.runtime.active_call);
  assert.deepEqual(r.state.checkpoint,f.claim.state.checkpoint);assert.deepEqual(r.state.tool_results,[]);
  assert.deepEqual(r.receipts,[]);assert.equal(r.result.execution_enabled,false);
  assert.equal(r.runtime.isolation.anchor_projection_hash,f.claim.projection_hash);
  assert.deepEqual((await s.readHistory()).slice(0,before.length),before);
  const restarted=createPiReliableExecutionStore({journal:createDevOperationJournalService({storageRoot:path.join(f.root,"journal")}),isOwnerAlive:async()=>false});
  const replay=await engine(restarted,f.a).execute(f.claim.intent);
  assert.equal(replay.projection_hash,r.projection_hash);assert.equal(f.sends(),0);
  await assert.rejects(restarted.assertMutationAuthorized(write.idempotency_key),{code:"OPERATION_ISOLATED"});
  assert.equal(await restarted.assertMutationAuthorized("unrelated-mutation-key"),true);
  assert.equal((await engine(restarted,f.a).reconcileOnly({...f.args,expected_revision:r.revision})).result.pause_reason,"OPERATION_ISOLATED");
  const current={...f.args,expected_revision:r.revision};
  for(const command of [{type:"owner_acquired",owner:f.claim.runtime.owner,replaced_worker_id:f.claim.runtime.owner.worker_id},
    {type:"tool_call_completed",worker_id:f.claim.runtime.owner.worker_id,call_id:f.claim.runtime.active_call.call_id,receipt:{}},
    {type:"owner_released",worker_id:f.claim.runtime.owner.worker_id}])
    await assert.rejects(restarted.command({...current,command}),{code:"OPERATION_ISOLATED"});
  await assert.rejects(restarted.command({...f.args,command:{type:"owner_released"}}),{code:"STATE_REVISION_CONFLICT"});
  const health=await f.journal.status();assert.equal(health.health,"healthy");assert.equal(health.dangling_operations.length,0);
});
test("isolation requires independent host authority and exact revision, projection, context and owner",async t=>{
  const f=await interruptedClaim(t),args=isolationRequest(f),s=isolationStore(f);
  await assert.rejects(f.store.isolate(args),{code:"ISOLATION_AUTHORITY_REQUIRED"});
  await assert.rejects(isolationStore(f,{isolationAuthority:async()=>false}).isolate(args),{code:"ISOLATION_AUTHORITY_REQUIRED"});
  await assert.rejects(f.store.command({...f.args,command:{type:"execution_isolated"}}),{code:"ISOLATION_AUTHORITY_REQUIRED"});
  for(const [edit,code] of [[{expected_revision:1},"STATE_REVISION_CONFLICT"],
    [{expected_projection_hash:"0".repeat(64)},"STATE_PROJECTION_CONFLICT"],
    [{expected_owner:{...args.expected_owner,pid:1}},"OWNER_CONFLICT"],
    [{context:{...context,workstream_id:null}},"WORKSPACE_CONTEXT_MISMATCH"],
    [{decision_id:"worker-approved"},"INVALID_ISOLATION_COMMAND"]])
    await assert.rejects(s.isolate({...args,...edit}),{code});
  for(const alive of [true,null])await assert.rejects(isolationStore(f,{isOwnerAlive:async()=>alive}).isolate(args),
    {code:alive===true?"OWNER_ACTIVE":"OWNER_LIVENESS_UNCERTAIN"});
  assert.equal((await f.store.inspect(f.args)).projection_hash,f.claim.projection_hash);
});
test("isolation publication CAS rejects an authority check that races an owner transition",async t=>{
  const f=await interruptedClaim(t),args=isolationRequest(f);
  const s=isolationStore(f,{isolationAuthority:async()=>{
    await f.store.command({...f.args,command:{type:"owner_acquired",owner:{...args.expected_owner,worker_id:"pi_worker_"+"f".repeat(32)},replaced_worker_id:args.expected_owner.worker_id}});
    return true;
  }});
  await assert.rejects(s.isolate(args),{code:"STATE_REVISION_CONFLICT"});
  assert.equal((await f.store.inspect({...f.args,expected_revision:undefined})).runtime.isolation,undefined);
});
for(const point of ["after_started","after_completed"])test("isolation process exit "+point+" recovers through existing Journal authority",async t=>{
  const f=await interruptedClaim(t),args=isolationRequest(f);
  const source=`import {createDevOperationJournalService} from ${JSON.stringify(new URL("../../server/src/mcp-development-journal-tools.mjs",import.meta.url).href)};
import {createPiReliableExecutionStore} from ${JSON.stringify(new URL("../../server/src/pi-reliable-execution-store.mjs",import.meta.url).href)};
const journal=createDevOperationJournalService({storageRoot:process.argv[1],executionPublicationHook:async stage=>{if(stage===process.argv[3])process.exit(73);}});
await createPiReliableExecutionStore({journal,isOwnerAlive:async()=>false,isolationAuthority:async()=>true}).isolate(JSON.parse(process.argv[2]));`;
  await assert.rejects(promisify(execFile)(process.execPath,["--input-type=module","-e",source,path.join(f.root,"journal"),JSON.stringify(args),point],
    {windowsHide:true,timeout:30000}),e=>e.code===73);
  const restarted=createPiReliableExecutionStore({journal:f.journal});
  let r=await restarted.inspect({...f.args,expected_revision:undefined});
  if(point==="after_started") {
    assert.equal(r.projection_hash,f.claim.projection_hash);assert.equal(r.runtime.isolation,undefined);
    // Only the separately authorized host retries publication; no begin replay.
    r=await isolationStore(f).isolate(args);
  }
  assert.equal(r.runtime.isolation.anchor_projection_hash,f.claim.projection_hash);
  assert.deepEqual(r.state.checkpoint,f.claim.state.checkpoint);assert.equal(r.state.status,"EXECUTING");
  assert.equal((await f.journal.status()).health,"healthy");
  await assert.rejects(isolationStore(f).isolate(args),{code:"STATE_REVISION_CONFLICT"});
  assert.equal((await engine(restarted,f.a).execute(f.claim.intent)).projection_hash,r.projection_hash);
  assert.equal(f.sends(),0);
});
test("dispatch rechecks durable fencing after asynchronous scope checks",async t=>{
  const f=await fixture(t,{isOwnerAlive:async()=>false});let sends=0,claim;
  const s=isolationStore(f);
  const a=adapter(async()=>{sends++;return {};},undefined,{resolveWorkspace:async()=>{
    await s.isolate(isolationRequest({args:{operation_id:claim.state.operation_id,context:claim.intent.context,
      expected_revision:claim.revision,expected_owner:claim.runtime.owner},claim}));
    return {...context,workspace_type:"isolated_worktree",state:"active"};
  }});
  const r=await engine(f.store,a,{executionHook:async(point,record)=>{if(point==="after_claim")claim=record;}}).execute(intent([write]));
  assert.equal(sends,0);assert.equal(r.result.pause_reason,"OPERATION_ISOLATED");
  assert.equal(r.state.status,"EXECUTING");assert.equal(r.state.tool_results.length,0);
});
test("isolated unknown does not globally block unrelated workstreams or weaken real conflicts",async t=>{
  const f=await interruptedClaim(t),s=isolationStore(f);await s.isolate(isolationRequest(f));let sends=0;
  const other={...context,workstream_id:"dev_workstream_20261003-100124_aaaaaaaaaaaa",workspace_id:"dev_workspace_"+"b".repeat(24)};
  const otherIntent=intent([{...write,idempotency_key:"unrelated-mutation-001"}],{intent_id:"unrelated-intent-001",context:other});
  const a=adapter(async()=>{sends++;return {};},undefined,{resolveWorkspace:async()=>({...other,workspace_type:"isolated_worktree",state:"active"})});
  assert.equal((await engine(s,a).execute(otherIntent)).state.status,"COMPLETED");assert.equal(sends,1);
  await assert.rejects(s.admit(intent([write],{intent_id:"conflicting-intent-001",context:other})),{code:"IDEMPOTENCY_KEY_CONFLICT"});
  const unsafe=intent([{...write,idempotency_key:"unsafe-mutation-001"}],{intent_id:"unsafe-intent-001",context:other});
  const unsafeAdapter=adapter(async()=>{throw Error("must not send");},undefined,{resolveWorkspace:async()=>({...other,workspace_type:"shared_repository",state:"active"})});
  assert.equal((await engine(s,unsafeAdapter).execute(unsafe)).state.status,"BLOCKED");
  assert.equal((await f.journal.status()).health,"healthy");
});
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
