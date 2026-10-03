import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createDevOperationJournalService, canonicalJson } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPiShadowExecutionObserver, createPiShadowLegacyBridge } from "../../server/src/pi-shadow-execution-observer.mjs";
import { createPiExecutionStateStore } from "../../server/src/pi-execution-state-store.mjs";
import { createPiReliableExecutionStore } from "../../server/src/pi-reliable-execution-store.mjs";
import { REQUIRED_DECISION_BOUNDARIES, hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
const exec = promisify(execFile);
const context = { project_id:"writer_workbench", workstream_id:"dev_workstream_20261003-114241_91643599324a",
  workspace_id:"dev_workspace_3170619a970d43a7bba9a98f" };
function intent(actions = [{step_id:"read",capability:"filesystem.read",input:{path:"package.json"},depends_on:[]}], id="shadow-intent-001") {
  return {schema_version:1,intent_id:id,goal:"Observe exact legacy scheduling",context,
    constraints:["Keep legacy execution"],requested_actions:actions,
    mutation_plan:actions.filter(x=>x.idempotency_key).map(x=>({step_id:x.step_id,target:x.input.path??"verification",
      expected_change:"GPT specified action",input_sha256:hashExecutionInput(x.input)})),
    verification:{focused:actions.filter(x=>x.capability==="verification.focused").map(x=>x.step_id),affected:[],full:[]},
    completion_conditions:["GPT evaluates comparison"],permissions:{read:true,workspace_create:false,write:true,tests:true,commit:false,integrate:false,push:false},
    decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
}
const readParams = {name:"dev_read_file",arguments:{path:"package.json",workspace_id:context.workspace_id}};
const callId = "pi_shadow_call_"+"a".repeat(32);
async function fixture(t, options={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),"pi-shadow-"));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal"),...options});
  const observer=createPiShadowExecutionObserver({journal});
  const record=await observer.admit(intent());
  return {root,journal,observer,record,binding:{operation_id:record.state.operation_id,context}};
}
async function observe(f,params=readParams,response={ok:true}) {
  await f.observer.started({...f.binding,observation_id:callId,step_id:"read",params});
  await f.observer.completed({...f.binding,observation_id:callId,response});
}
test("passive bridge preserves exact legacy input/result identity and executes once",async t=>{
  const f=await fixture(t);const response={ok:true,value:7};let count=0;
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...f.binding,callLegacyTool:async params=>{
    assert.equal(params,readParams);count++;return response;}});
  assert.equal(await bridge.call("read",readParams),response);
  const result=await bridge.finish();
  assert.equal(count,1);assert.equal(result.result.status,"MATCHED");
  assert.equal(result.result.execution_enabled,false);assert.equal(result.result.mutation_dispatch_count,0);
  assert.equal(result.result.production_default_changed,false);assert.equal(result.result.model_requests,0);
  assert.equal(result.result.engineering_review_required,true);
  assert.equal(result.state.completed_steps.length,0,"Observed legacy completion is not Pi dispatch");
  assert.equal(bridge.diagnostics().coverage_healthy,true);
});
test("observer only plans/persists and does not accept a dispatcher",async t=>{
  const f=await fixture(t);let calls=0;
  const observer=createPiShadowExecutionObserver({journal:f.journal,callTool:()=>calls++});
  await observer.inspect(f.binding);await observer.close(f.binding);
  assert.equal(calls,0);assert.equal((await f.journal.status()).active_operation_count,0);
});
for(const [label,params,reason] of [
  ["tool",{...readParams,name:"dev_git_push"},"TOOL_MISMATCH"],
  ["arguments",{...readParams,arguments:{...readParams.arguments,path:"other.md"}},"INPUT_MISMATCH"],
  ["workspace",{...readParams,arguments:{...readParams.arguments,workspace_id:"dev_workspace_shared_repository_v1"}},"WORKSPACE_MISMATCH"],
  ["extra argument",{...readParams,arguments:{...readParams.arguments,arbitrary:true}},"INPUT_MISMATCH"],
]) test("reports "+label+" difference without executing or correcting it",async t=>{
  const f=await fixture(t);await observe(f,params);
  const result=await f.observer.close(f.binding);
  assert.equal(result.result.status,"DECISION_REQUIRED");assert(result.result.differences.some(x=>x.reason===reason));
});
test("missing and in-flight calls never imply execution completion",async t=>{
  const f=await fixture(t);await f.observer.started({...f.binding,observation_id:callId,step_id:"read",params:readParams});
  const result=await f.observer.close(f.binding);
  assert(result.result.differences.some(x=>x.reason==="INCOMPLETE_CALL"));
  assert(result.result.differences.some(x=>x.reason==="MISSING_STEP"));
  assert.equal(result.result.observation_complete,false);
});
test("duplicate observation identity is durable and conflicting replay fails",async t=>{
  const f=await fixture(t);
  const args={...f.binding,observation_id:callId,step_id:"read",params:readParams};
  const first=await f.observer.started(args),second=await f.observer.started(args);
  assert.equal(first.revision,second.revision);await observe(f);
  const done=await f.observer.completed({...f.binding,observation_id:callId,response:{ok:true}});
  assert.equal(done.shadow.observations.length,1);
  await assert.rejects(f.observer.started({...args,params:{...readParams,name:"other"}}),/OBSERVATION_ID_CONFLICT/);
  await assert.rejects(f.observer.completed({...f.binding,observation_id:callId,response:{ok:false}}),/OBSERVATION_ID_CONFLICT/);
});
test("repeated actual legacy call is a scheduling difference, not observer dedupe",async t=>{
  const f=await fixture(t);let count=0;
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...f.binding,callLegacyTool:async()=>{count++;return {ok:true};}});
  await bridge.call("read",readParams);await bridge.call("read",readParams);
  const result=await bridge.finish();assert.equal(count,2);
  assert(result.result.differences.some(x=>x.reason==="DUPLICATE_STEP"));
});
test("order and dependency completion are checked at actual start",async t=>{
  const f=await fixture(t);
  const source=intent([{step_id:"first",capability:"filesystem.read",input:{path:"a"},depends_on:[]},
    {step_id:"second",capability:"filesystem.read",input:{path:"b"},depends_on:["first"]}],"ordered-shadow-001");
  const r=await f.observer.admit(source),binding={operation_id:r.state.operation_id,context};
  await f.observer.started({...binding,observation_id:callId,step_id:"second",params:{...readParams,arguments:{path:"b",workspace_id:context.workspace_id}}});
  const result=await f.observer.close(binding);
  assert(result.result.differences.some(x=>x.reason==="ORDER_MISMATCH"));
  assert(result.result.differences.some(x=>x.reason==="DEPENDENCY_NOT_COMPLETED"));
});
test("unrequested step is captured, never selected as an alternative implementation",async t=>{
  const f=await fixture(t);
  await f.observer.started({...f.binding,observation_id:callId,step_id:"unrequested",params:readParams});
  const result=await f.observer.close(f.binding);
  assert(result.result.differences.some(x=>x.reason==="UNREQUESTED_STEP"));
});
test("overlapping legacy calls are observed without imposing Pi scheduling",async t=>{
  const f=await fixture(t);let release;const gate=new Promise(resolve=>release=resolve);let entered=0;
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...f.binding,callLegacyTool:async()=>{entered++;await gate;return {ok:true};}});
  const first=bridge.call("read",readParams);
  while(entered<1)await new Promise(resolve=>setTimeout(resolve,1));
  const second=bridge.call("read",readParams);
  while(entered<2)await new Promise(resolve=>setTimeout(resolve,1));
  release();await Promise.all([first,second]);const result=await bridge.finish();
  assert.equal(entered,2);assert(result.result.differences.some(x=>x.reason==="OVERLAPPING_CALL"));
});
for(const response of [{isError:true},{ok:false},{execution_ok:false},{passed:false},
  {content:[{type:"text",text:'{"passed":false}'}]}]) test("legacy failure is evidence, never rewritten as PASS: "+JSON.stringify(response),async t=>{
  const f=await fixture(t);await observe(f,readParams,response);
  const result=await f.observer.close(f.binding);
  assert(result.result.differences.some(x=>x.reason==="LEGACY_FAILURE"));
});
for(const passed of [true,false,null]) test("verification requires actual explicit PASS: "+passed,async t=>{
  const f=await fixture(t);
  const action={step_id:"test",capability:"verification.focused",input:{suite:"mcp_core"},depends_on:[],idempotency_key:"shadow-tests-key-001"};
  const record=await f.observer.admit(intent([action],"verification-shadow-001"));
  const binding={operation_id:record.state.operation_id,context};
  await f.observer.started({...binding,observation_id:callId,step_id:"test",params:{name:"dev_run_tests",
    arguments:{suite:"mcp_core",workspace_id:context.workspace_id},_meta:{reconciliation_key:action.idempotency_key}}});
  await f.observer.completed({...binding,observation_id:callId,response:passed===null?{ok:true}:{passed}});
  const result=await f.observer.close(binding);
  assert.equal(result.result.status,passed===true?"MATCHED":"DECISION_REQUIRED");
});
test("mutation key mismatch is reported; bridge preserves legacy key without generating another",async t=>{
  const f=await fixture(t);const action={step_id:"write",capability:"filesystem.write",input:{path:"server/src/exact.mjs",content:"GPT bytes"},
    depends_on:[],idempotency_key:"shadow-write-key-001"};
  const record=await f.observer.admit(intent([action],"mutation-shadow-001"));const binding={operation_id:record.state.operation_id,context};
  const params={name:"dev_create_file",arguments:{...action.input,workspace_id:context.workspace_id},_meta:{reconciliation_key:"legacy-different-key"}};
  let seen;const bridge=createPiShadowLegacyBridge({observer:f.observer,...binding,callLegacyTool:async p=>{seen=p;return {ok:true};}});
  await bridge.call("write",params);assert.equal(seen,params);const result=await bridge.finish();
  assert(result.result.differences.some(x=>x.reason==="IDEMPOTENCY_KEY_MISMATCH"));
});
test("exact thrown legacy error survives observer failure and is never retried",async()=>{
  const thrown=new Error("physical timeout");let count=0;
  const observer={started:async()=>{throw new Error("journal unavailable");},completed:async()=>{throw new Error("should not run");},close:async()=>{throw new Error("unavailable");}};
  const bridge=createPiShadowLegacyBridge({observer,operation_id:"pi_operation_"+"a".repeat(32),context,
    onObservationError:()=>{throw new Error("diagnostic callback failed");},callLegacyTool:async()=>{count++;throw thrown;}});
  await assert.rejects(bridge.call("read",readParams),e=>e===thrown);assert.equal(count,1);
  assert.equal(bridge.diagnostics().coverage_healthy,false);assert.equal((await bridge.finish()).coverage_healthy,false);
});
test("response hash failure cannot turn successful legacy mutation into a retry",async t=>{
  const f=await fixture(t);let count=0;const response={content:"x".repeat(70*1024)};
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...f.binding,callLegacyTool:async()=>{count++;return response;}});
  assert.equal(await bridge.call("read",readParams),response);assert.equal(count,1);
  const result=await bridge.finish();assert.equal(bridge.diagnostics().coverage_healthy,false);
  assert.equal(result.result.status,"DECISION_REQUIRED");
});
test("workspace identity and intent identity cannot change across durable admission",async t=>{
  const f=await fixture(t);
  const duplicate=await f.observer.admit(intent());assert.equal(duplicate.state.operation_id,f.record.state.operation_id);
  await assert.rejects(f.observer.admit({...intent(),goal:"different"}),/INTENT_ID_CONFLICT/);
  await assert.rejects(f.observer.inspect({...f.binding,context:{...context,workspace_id:"dev_workspace_shared_repository_v1"}}),/WORKSPACE_CONTEXT_MISMATCH/);
});
test("A/B/C and shadow states coexist without migration or enabling dispatch",async t=>{
  const f=await fixture(t);
  const b=createPiExecutionStateStore({journal:f.journal}),c=createPiReliableExecutionStore({journal:f.journal});
  await b.admit(intent(undefined,"b-plan-001"));await c.admit(intent(undefined,"c-plan-001"));
  await assert.rejects(f.observer.admit(intent(undefined,"b-plan-001")),/LEGACY_OPERATION_NOT_MIGRATED/);
  await assert.rejects(c.admit(intent()),/LEGACY_OPERATION_NOT_MIGRATED/);
  await observe(f);assert.equal((await f.observer.close(f.binding)).result.status,"MATCHED");
  assert.equal((await f.journal.status()).health,"healthy");
});
test("close is idempotent and late observations cannot reopen a comparison",async t=>{
  const f=await fixture(t);await observe(f);const closed=await f.observer.close(f.binding);
  assert.equal((await f.observer.close(f.binding)).revision,closed.revision);
  await assert.rejects(f.observer.started({...f.binding,observation_id:"pi_shadow_call_"+"b".repeat(32),step_id:"read",params:readParams}),/SHADOW_CLOSED/);
});
test("fresh process restores completed comparison from the existing journal",async t=>{
  const f=await fixture(t);await observe(f);await f.observer.close(f.binding);
  const moduleUrl=new URL("../../server/src/pi-shadow-execution-observer.mjs",import.meta.url).href;
  const journalUrl=new URL("../../server/src/mcp-development-journal-tools.mjs",import.meta.url).href;
  const code='import {createPiShadowExecutionObserver} from '+JSON.stringify(moduleUrl)+';import {createDevOperationJournalService} from '+JSON.stringify(journalUrl)+
    ';const observer=createPiShadowExecutionObserver({journal:createDevOperationJournalService({storageRoot:process.argv[1]})});console.log(JSON.stringify(await observer.inspect(JSON.parse(process.argv[2]))));';
  const restored=JSON.parse((await exec(process.execPath,["--input-type=module","-e",code,path.join(f.root,"journal"),JSON.stringify(f.binding)],
    {windowsHide:true,timeout:30000})).stdout);
  assert.equal(restored.result.status,"MATCHED");assert.equal(restored.projection_hash,(await f.observer.inspect(f.binding)).projection_hash);
});
test("restart with in-flight observation remains unknown and never dispatches",async t=>{
  const f=await fixture(t);
  await f.observer.started({...f.binding,observation_id:callId,step_id:"read",params:readParams});
  const fresh=createPiShadowExecutionObserver({journal:createDevOperationJournalService({storageRoot:path.join(f.root,"journal")})});
  const result=await fresh.close(f.binding);assert.equal(result.result.status,"DECISION_REQUIRED");
  assert.equal(result.result.mutation_dispatch_count,0);
});
test("actual Workbench read path is observed with original filesystem policy",async t=>{
  const f=await fixture(t);await writeFile(path.join(f.root,"package.json"),'{"actual":true}');
  const {dev_read_file}=await import("../../server/src/mcp-development-readonly-tools.mjs");
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...f.binding,
    callLegacyTool:params=>dev_read_file(params.arguments,{workspaceContextResolver:async()=>({...context,root:f.root,workspace_type:"fixture",current_head:"1".repeat(40),branch:"fixture",base_head:"1".repeat(40)})})});
  const response=await bridge.call("read",readParams);assert.equal(JSON.parse(response.content).actual,true);
  assert.equal((await bridge.finish()).result.status,"MATCHED");
});
test("legacy journalled physical mutation happens exactly once; shadow only observes",async t=>{
  const f=await fixture(t);const action={step_id:"write",capability:"filesystem.write",
    input:{path:"server/src/physical.mjs",content:"exact GPT content"},depends_on:[],idempotency_key:"physical-shadow-key-001"};
  const record=await f.observer.admit(intent([action],"physical-shadow-001"));const binding={operation_id:record.state.operation_id,context};
  let calls=0;const params={name:"dev_create_file",arguments:{...action.input,workspace_id:context.workspace_id},
    _meta:{reconciliation_key:action.idempotency_key}};
  const bridge=createPiShadowLegacyBridge({observer:f.observer,...binding,callLegacyTool:async p=>{
    calls++;const outcome=await f.journal.executeReconciled({reconciliation_key:p._meta.reconciliation_key,
      request_fingerprint_sha256:hashExecutionInput({tool_name:p.name,arguments:p.arguments}),tool_name:p.name},async()=>{
        await writeFile(path.join(f.root,"physical.mjs"),p.arguments.content,{flag:"wx"});return {ok:true};});
    return {...outcome.value,_meta:{operation_id:outcome.operation.operation_id}};}});
  await bridge.call("write",params);const result=await bridge.finish();
  assert.equal(calls,1);assert.equal(await readFile(path.join(f.root,"physical.mjs"),"utf8"),action.input.content);
  assert.equal(result.result.status,"MATCHED");
  assert.match(result.shadow.observations[0].legacy_operation_id,/^dev_operation_/);
  assert.equal((await f.journal.status()).health,"healthy");assert.equal((await f.journal.status()).active_operation_count,0);
});
test("hash-valid fabricated matched comparison is rejected by semantic history",async t=>{
  const f=await fixture(t);await observe(f);await f.observer.close(f.binding);
  const events=(await f.journal.verify()).events;const event=events.at(-1);
  const forged=JSON.parse(JSON.stringify(event));forged.execution_projection.shadow.observations[0].tool="dev_git_push";
  const {projection_hash,...body}=forged.execution_projection;
  forged.execution_projection.projection_hash=createHash("sha256").update(canonicalJson(body)).digest("hex");
  forged.result.projection_hash=forged.execution_projection.projection_hash;
  const {event_hash,...eventBody}=forged;forged.event_hash=createHash("sha256").update(canonicalJson(eventBody)).digest("hex");
  const broken=createPiShadowExecutionObserver({journal:{readExecutionProjections:async()=>[...events.filter(x=>x.execution_projection).slice(0,-1),forged],
    appendExecutionProjection:()=>assert.fail("must not publish")}});
  await assert.rejects(broken.inspect(f.binding),/CORRUPT_STATE/);
});

test("coverage gap is durable even if every planned step has a successful receipt",async t=>{
  const f=await fixture(t);
  await observe(f);
  const real=f.observer;
  const observer={...real,started:async()=>{throw new Error("missed extra legacy call");}};
  const bridge=createPiShadowLegacyBridge({observer,...f.binding,callLegacyTool:async()=>({ok:true})});
  await bridge.call("unrecorded",readParams);const result=await bridge.finish();
  assert.equal(result.coverage_healthy,false);
  assert.equal((await real.inspect(f.binding)).result.status,"DECISION_REQUIRED");
  assert(result.result.differences.some(x=>x.reason==="OBSERVATION_GAP"));
});
test("observer deadline cannot indefinitely stall or duplicate a legacy call",async()=>{
  let count=0;const response={ok:true};
  const observer={started:()=>new Promise(()=>{}),completed:async()=>{},close:()=>new Promise(()=>{})};
  const bridge=createPiShadowLegacyBridge({observer,operation_id:"pi_operation_"+"b".repeat(32),context,
    observerTimeoutMs:5,onObservationError:async()=>{throw new Error("async callback");},callLegacyTool:async()=>{count++;return response;}});
  assert.equal(await bridge.call("read",readParams),response);assert.equal(count,1);
  assert.equal((await bridge.finish()).coverage_healthy,false);
  assert(bridge.diagnostics().errors.every(x=>x.code==="SHADOW_OBSERVER_TIMEOUT"));
});
test("permission and unexpected intent configuration are rejected before observation",async t=>{
  const f=await fixture(t);
  const action={step_id:"write",capability:"filesystem.write",input:{path:"server/src/a.mjs",content:"x"},
    depends_on:[],idempotency_key:"denied-shadow-write"};
  const source=intent([action],"denied-shadow-001");source.permissions.write=false;
  const before=(await f.journal.status()).latest_sequence;
  await assert.rejects(f.observer.admit(source));
  await assert.rejects(f.observer.admit({...intent(),production_cutover:true}));
  assert.equal((await f.journal.status()).latest_sequence,before);
});
const shadowModuleUrl=new URL("../../server/src/pi-shadow-execution-observer.mjs",import.meta.url).href;
const shadowJournalUrl=new URL("../../server/src/mcp-development-journal-tools.mjs",import.meta.url).href;
for(const point of ["before_events","after_started","after_completed","after_head"]) {
  test("fresh process recovers shadow publication after actual exit: "+point,async t=>{
    const root=await mkdtemp(path.join(os.tmpdir(),"pi-shadow-publication-"));
    t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
    const source=intent();
    const code='import {createPiShadowExecutionObserver} from '+JSON.stringify(shadowModuleUrl)+
      ';import {createDevOperationJournalService} from '+JSON.stringify(shadowJournalUrl)+
      ';const journal=createDevOperationJournalService({storageRoot:process.argv[1],executionPublicationHook:async stage=>{if(stage===process.argv[2])process.exit(73);}});'+
      'const observer=createPiShadowExecutionObserver({journal});console.log(JSON.stringify(await observer.admit(JSON.parse(process.argv[3]))));';
    await assert.rejects(exec(process.execPath,["--input-type=module","-e",code,path.join(root,"journal"),point,JSON.stringify(source)],
      {windowsHide:true,timeout:30000}),e=>e.code===73);
    const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
    const observer=createPiShadowExecutionObserver({journal});
    const record=await observer.admit(source);
    assert.equal(record.schema_version,3);assert.equal(record.shadow.observations.length,0);
    assert.equal(record.result.execution_enabled,false);assert.equal((await journal.status()).health,"healthy");
    assert.equal((await journal.status()).dangling_operation_count,0);
  });
}
test("unknown publication owner is not repaired by a passive observer",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pi-shadow-live-owner-"));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  let failOnce=true;
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal"),executionPublicationHook:async stage=>{
    if(stage==="after_started"&&failOnce){failOnce=false;throw new Error("live interrupted publisher");}}});
  const observer=createPiShadowExecutionObserver({journal});
  await assert.rejects(observer.admit(intent()));
  await assert.rejects(observer.admit(intent()),/CORRUPT_STATE/);
});

test("expected shadow schedule retains the reliability engine phase boundary",async t=>{
  const f=await fixture(t);
  const actions=[{step_id:"verify",capability:"verification.focused",input:{suite:"mcp_core"},depends_on:[],idempotency_key:"phase-test-key-001"},
    {step_id:"write",capability:"filesystem.write",input:{path:"server/src/after-test.mjs",content:"GPT content"},
      depends_on:["verify"],idempotency_key:"phase-write-key-001"}];
  const record=await f.observer.admit(intent(actions,"phase-shadow-001"));
  assert.equal(record.result.status,"DECISION_REQUIRED");
  assert(record.result.differences.some(x=>x.reason==="PHASE_ORDER_CONFLICT"));
  assert.deepEqual(record.result.planned_schedule.map(x=>x.expected_phase),["VERIFYING","VERIFYING"]);
});
const sourceRoot=path.resolve(fileURLToPath(new URL("../..",import.meta.url)));
async function stdioTool(params,group) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(sourceRoot,"server","src","mcp-server.mjs")],{
      cwd:sourceRoot,windowsHide:true,env:{...process.env,MCP_TOOL_PROFILE:"chatgpt_developer",
        WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL:"1",WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT:"1",
        WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION:"1",WRITER_WORKBENCH_TEST_JOURNAL_GROUP:group},
      stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="";
    const timer=setTimeout(()=>{child.kill();reject(new Error("STDIO_TEST_TIMEOUT"));},30000);
    child.stdout.on("data",chunk=>stdout+=chunk);child.stderr.on("data",chunk=>stderr+=chunk);
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("close",code=>{
      clearTimeout(timer);if(code!==0){reject(new Error("MCP stdio exit "+code+": "+stderr));return;}
      try {
        const reply=stdout.split(/\r?\n/u).filter(Boolean).map(line=>JSON.parse(line)).find(row=>row.id===1);
        if(reply?.error)throw new Error(JSON.stringify(reply.error));
        assert(reply?.result);resolve(reply.result);
      }catch(error){reject(error);}
    });
    child.stdin.end(JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params})+"\n");
  });
}
for(const mutation of [false,true]) test("actual legacy MCP stdio "+(mutation?"write":"read")+" is compared without Pi dispatch",async t=>{
  const f=await fixture(t),group=randomUUID();
  const shared={...context,workspace_id:"dev_workspace_shared_repository_v1"};
  const file="tests/.tmp/pi-shadow-stdio-"+group+".mjs";
  const action=mutation?{step_id:"write",capability:"filesystem.write",input:{path:file,content:"export const physical = true;\n"},
    depends_on:[],idempotency_key:"stdio-shadow-write-key-001"}:
    {step_id:"read",capability:"filesystem.read",input:{path:"package.json",maxBytes:8192},depends_on:[]};
  const source={...intent([action],"stdio-shadow-"+group),context:shared};
  const record=await f.observer.admit(source);
  const journalRoot=path.join(os.tmpdir(),"writer-workbench-operation-journal-test-"+group);
  t.after(async()=>{
    assert.equal(path.dirname(journalRoot),os.tmpdir());await rm(journalRoot,{recursive:true,force:true});
    const physical=path.join(sourceRoot,file);
    assert.equal(path.dirname(physical),path.join(sourceRoot,"tests",".tmp"));
    await rm(physical,{force:true});
  });
  if(mutation)await mkdir(path.join(sourceRoot,"tests",".tmp"),{recursive:true});
  let calls=0;
  const bridge=createPiShadowLegacyBridge({observer:f.observer,operation_id:record.state.operation_id,context:shared,
    callLegacyTool:params=>{calls++;return stdioTool(params,group);}});
  const response=await bridge.call(action.step_id,{name:mutation?"dev_create_file":"dev_read_file",
    arguments:{...action.input,workspace_id:shared.workspace_id},
    ...(mutation?{_meta:{reconciliation_key:action.idempotency_key}}:{})});
  assert.equal(response.isError===true,false);
  const payload=JSON.parse(response.content.find(row=>row.type==="text").text);
  if(mutation) {
    assert.equal(payload.created,true);
    assert.equal(await readFile(path.join(sourceRoot,file),"utf8"),action.input.content);
  }else assert(JSON.parse(payload.content).name);
  const result=await bridge.finish();assert.equal(result.result.status,"MATCHED");
  assert.equal(calls,1);assert.equal(result.result.mutation_dispatch_count,0);
});
for(const point of ["before_shadow_receipt","after_shadow_receipt"]) test("actual exit "+point+" never makes shadow replay legacy mutation",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"pi-shadow-physical-exit-"));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  const action={step_id:"write",capability:"filesystem.write",input:{path:"server/src/physical.mjs",content:"exact mutation bytes"},
    depends_on:[],idempotency_key:"shadow-exit-mutation-key"};
  const source=intent([action],"shadow-exit-001");
  const operationId="pi_operation_"+"d".repeat(32),binding={operation_id:operationId,context};
  const code='import {writeFile} from "node:fs/promises";import path from "node:path";'+
    'import {createPiShadowExecutionObserver,createPiShadowLegacyBridge} from '+JSON.stringify(shadowModuleUrl)+
    ';import {createDevOperationJournalService} from '+JSON.stringify(shadowJournalUrl)+
    ';const root=process.argv[1],point=process.argv[2];const source='+JSON.stringify(source)+';'+
    'const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});'+
    'const observer=createPiShadowExecutionObserver({journal});const record=await observer.admit(source,{operation_id:'+JSON.stringify(operationId)+'});'+
    'const bridge=createPiShadowLegacyBridge({observer,operation_id:record.state.operation_id,context:source.context,'+
    'callLegacyTool:async params=>{const outcome=await journal.executeReconciled({reconciliation_key:params._meta.reconciliation_key,'+
    'request_fingerprint_sha256:'+JSON.stringify(hashExecutionInput({tool_name:"dev_create_file",arguments:{...action.input,workspace_id:context.workspace_id}}))+
    ',tool_name:params.name},async()=>{await writeFile(path.join(root,"physical.mjs"),params.arguments.content,{flag:"wx"});return {ok:true};});'+
    'if(point==="before_shadow_receipt")process.exit(73);return {...outcome.value,_meta:{operation_id:outcome.operation.operation_id}};}});'+
    'await bridge.call("write",'+JSON.stringify({name:"dev_create_file",arguments:{...action.input,workspace_id:context.workspace_id},
      _meta:{reconciliation_key:action.idempotency_key}})+');process.exit(73);';
  await assert.rejects(exec(process.execPath,["--input-type=module","-e",code,root,point],{windowsHide:true,timeout:30000}),e=>e.code===73);
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
  const observer=createPiShadowExecutionObserver({journal});
  const result=await observer.close(binding);
  assert.equal(result.result.status,point==="after_shadow_receipt"?"MATCHED":"DECISION_REQUIRED");
  assert.equal(await readFile(path.join(root,"physical.mjs"),"utf8"),action.input.content);
  assert.equal((await journal.verify()).events.filter(event=>event.stage==="operation_started"
    &&event.reconciliation_key===action.idempotency_key).length,1);
  assert.equal(result.result.execution_enabled,false);assert.equal((await journal.status()).health,"healthy");
});

test("caller mutation during observation creates a durable gap while preserving legacy input",async t=>{
  const f=await fixture(t),params=JSON.parse(JSON.stringify(readParams));
  const observer={...f.observer,started:async args=>{
    const record=await f.observer.started(args);params.arguments.path="caller-changed.md";return record;}};
  let seen;
  const bridge=createPiShadowLegacyBridge({observer,...f.binding,callLegacyTool:async p=>{seen=p.arguments.path;return {ok:true};}});
  await bridge.call("read",params);assert.equal(seen,"caller-changed.md");const result=await bridge.finish();
  assert.equal(result.coverage_healthy,false);assert.equal(result.result.status,"DECISION_REQUIRED");
  assert(bridge.diagnostics().errors.some(error=>error.code==="SHADOW_INPUT_CHANGED"));
});
for(const [response,reason] of [
  [{ok:true,workspace_context:{workspace_id:"dev_workspace_shared_repository_v1"}},"RESULT_WORKSPACE_MISMATCH"],
  [{ok:true,workspace_context:{workstream_id:"dev_workstream_20261003-100124_6f779341a426"}},"RESULT_WORKSTREAM_MISMATCH"],
  [{ok:true,_meta:{reconciliation_key:"unexpected-reply-key"}},"RESULT_IDEMPOTENCY_KEY_MISMATCH"],
]) test("response identity discrepancy is saved for GPT: "+reason,async t=>{
  const f=await fixture(t);await observe(f,readParams,response);
  const result=await f.observer.close(f.binding);assert.equal(result.result.status,"DECISION_REQUIRED");
  assert(result.result.differences.some(x=>x.reason===reason));
});
