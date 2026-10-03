import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDevOperationJournalService } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPiCanaryExecutionController, createPiCanaryStdioTransport, readPiCanaryEnrollment } from "../../server/src/pi-canary-execution-controller.mjs";
import { createPiReliableExecutionStore } from "../../server/src/pi-reliable-execution-store.mjs";
import { createPiExecutionStateStore } from "../../server/src/pi-execution-state-store.mjs";
import { createPiShadowExecutionObserver } from "../../server/src/pi-shadow-execution-observer.mjs";
import { REQUIRED_DECISION_BOUNDARIES, hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
const context={project_id:"writer_workbench",workstream_id:"dev_workstream_20261003-133510_1d6d8a9c4e9f",workspace_id:"dev_workspace_b4cf50c9846643a09d79f584"};
function intent(id="canary-new-001",actions=[{step_id:"read",capability:"filesystem.read",input:{path:"package.json"},depends_on:[]}]) {
 return {schema_version:1,intent_id:id,goal:"Execute exact GPT canary action",context,constraints:["Keep production default"],
 requested_actions:actions,mutation_plan:actions.filter(x=>x.idempotency_key).map(x=>({step_id:x.step_id,target:x.input.path??"verification",expected_change:"Exact GPT input",input_sha256:hashExecutionInput(x.input)})),
 verification:{focused:actions.filter(x=>x.capability==="verification.focused").map(x=>x.step_id),affected:[],full:[]},
 completion_conditions:["GPT reviews"],permissions:{read:true,workspace_create:false,write:true,tests:true,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
}
const write={step_id:"write",capability:"filesystem.write",input:{path:"tests/.tmp/canary.txt",content:"GPT exact content"},depends_on:[],idempotency_key:"canary-key-001"};
function policy(intents=[intent()],max=1) {return {schema_version:1,cohort_id:"canary-cohort-001",max_operations:max,
 authorized_intents:intents.map(i=>({intent_id:i.intent_id,intent_hash:hashExecutionInput(i)}))};}
async function fixture(t) {const root=await mkdtemp(path.join(os.tmpdir(),"pi-canary-"));
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 return {root,journal:createDevOperationJournalService({storageRoot:path.join(root,"journal")})};}
function host(f,options={}) {return createPiCanaryExecutionController({journal:f.journal,policy:options.policy??policy(),
 isEnabled:options.isEnabled??(async()=>true),retryPolicy:{max_attempts:2,base_delay_ms:1,max_delay_ms:2},
 transport:{callTool:options.callTool??(async()=>({ok:true})),queryOperation:options.queryOperation??(async p=>({...p,reconciliation_state:"unknown"})),
 resolveWorkspace:options.resolveWorkspace??(async()=>({...context,workspace_type:"isolated_worktree",state:"active"}))},
 executionHook:options.executionHook});}
test("canary runs exact intent with durable enrollment and GPT review",async t=>{const f=await fixture(t);let calls=0;
 const r=await host(f,{callTool:async p=>{calls++;assert.equal(p.name,"dev_read_file");return {ok:true};}}).execute(intent());
 assert.equal(r.state.status,"COMPLETED");assert.equal(r.result.phase,"E");assert.equal(r.result.canary_enrolled,true);
 assert.equal(r.result.production_default_changed,false);assert.equal(r.result.model_requests,0);assert.equal(r.result.engineering_review_required,true);assert.equal(calls,1);
 assert.equal((await f.journal.status()).active_operation_count,0);});
test("duplicate request under fresh controller does not repeat mutation",async t=>{const f=await fixture(t);const i=intent("canary-write",[write]);let calls=0;
 const opts={policy:policy([i]),callTool:async p=>{calls++;assert.equal(p._meta.reconciliation_key,write.idempotency_key);return {ok:true};}};
 const first=await host(f,opts).execute(i),again=await host(f,opts).execute(i);
 assert.equal(first.state.operation_id,again.state.operation_id);assert.equal(calls,1);assert.equal(first.projection_hash,again.projection_hash);});
for(const schema of ["planning","reliable","shadow"])test("pre-existing "+schema+" operation cannot join canary",async t=>{
 const f=await fixture(t),i=intent();const s=schema==="planning"?createPiExecutionStateStore({journal:f.journal}):schema==="shadow"?createPiShadowExecutionObserver({journal:f.journal}):createPiReliableExecutionStore({journal:f.journal});
 await s.admit(i);let calls=0;await assert.rejects(host(f,{callTool:async()=>calls++}).execute(i),/LEGACY_OPERATION_NOT_MIGRATED/);assert.equal(calls,0);});
test("unknown intent is refused before publication",async t=>{const f=await fixture(t);await assert.rejects(host(f).execute(intent("unapproved")),/CANARY_INTENT_NOT_AUTHORIZED/);
 assert.equal((await f.journal.readExecutionProjections()).length,0);});
test("same id with altered GPT content is refused before dispatch",async t=>{const f=await fixture(t);const i=intent();i.goal="different";await assert.rejects(host(f).execute(i),/CANARY_INTENT_NOT_AUTHORIZED/);});
test("cohort capacity is atomic across competing controllers",async t=>{const f=await fixture(t),a=intent("canary-a"),b=intent("canary-b"),p=policy([a,b],1);
 const results=await Promise.allSettled([host(f,{policy:p}).admit(a),host(f,{policy:p}).admit(b)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);assert.match(results.find(x=>x.status==="rejected").reason.message,/CANARY_CAPACITY_EXCEEDED/);
 assert.equal((await f.journal.readExecutionProjections()).length,1);});
test("completed duplicate uses same cohort slot",async t=>{const f=await fixture(t),i=intent();await host(f).execute(i);await host(f).execute(i);
 assert.equal((await f.journal.readExecutionProjections()).filter(e=>e.execution_projection.revision===1).length,1);});
test("different cohort cannot adopt an enrolled operation",async t=>{const f=await fixture(t);await host(f).admit(intent());const p=policy();p.cohort_id="canary-other-cohort";
 await assert.rejects(host(f,{policy:p}).execute(intent()),/CANARY_ENROLLMENT_CONFLICT/);});
test("changing cohort policy cannot silently widen authority",async t=>{const f=await fixture(t);await host(f).admit(intent());
 await assert.rejects(host(f,{policy:policy([intent()],2)}).execute(intent()),/CANARY_ENROLLMENT_CONFLICT/);});
test("disabled canary admits no new operation",async t=>{const f=await fixture(t);await assert.rejects(host(f,{isEnabled:async()=>false}).admit(intent()),/CANARY_DISABLED/);
 assert.equal((await f.journal.readExecutionProjections()).length,0);});
test("switch disabled after durable claim stops before MCP",async t=>{const f=await fixture(t);let enabled=true,calls=0;
 const h=host(f,{isEnabled:async()=>enabled,callTool:async()=>{calls++;return {ok:true};},executionHook:async point=>{if(point==="after_claim")enabled=false;}});
 const r=await h.execute(intent());assert.equal(r.state.status,"BLOCKED");assert.equal(calls,0);assert.equal(r.state.last_error.code,"PERMISSION_DENIED");
 const saved=await h.inspect({operation_id:r.state.operation_id,context});assert.equal(saved.projection_hash,r.projection_hash);});
test("terminal result can be read while canary is disabled",async t=>{const f=await fixture(t);const r=await host(f).execute(intent());
 const saved=await host(f,{isEnabled:async()=>false,callTool:async()=>assert.fail("replay")}).execute(intent());assert.equal(saved.projection_hash,r.projection_hash);});
test("shared main is rejected even for authorized intent",async t=>{const f=await fixture(t),i=intent();i.context={...context,workspace_id:"dev_workspace_shared_repository_v1"};
 await assert.rejects(host(f,{policy:policy([i])}).execute(i),/CANARY_WORKSPACE_REQUIRED/);});
test("workspace identity mismatch blocks dispatch",async t=>{const f=await fixture(t);let calls=0;const r=await host(f,{resolveWorkspace:async()=>({...context,workstream_id:"wrong"}),callTool:async()=>calls++}).execute(intent());
 assert.equal(r.state.status,"BLOCKED");assert.equal(calls,0);});
test("high risk production authority cannot be enabled by intent permission",async t=>{const f=await fixture(t),i=intent();i.permissions.push=true;
 await assert.rejects(host(f,{policy:policy([i])}).execute(i),/CANARY_SCOPE_NOT_ALLOWED/);});
test("explicit validation failure preserves evidence for GPT",async t=>{const f=await fixture(t);const r=await host(f,{callTool:async()=>({ok:false})}).execute(intent());
 assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(r.receipts.at(-1).evidence.ok,false);});
test("missing explicit test PASS escalates",async t=>{const f=await fixture(t),i=intent("canary-test",[{step_id:"test",capability:"verification.focused",input:{suite:"mcp_core"},idempotency_key:"canary-test-key",depends_on:[]}]);
 const r=await host(f,{policy:policy([i]),callTool:async()=>({ok:true})}).execute(i);assert.equal(r.state.status,"DECISION_REQUIRED");});
test("ambiguous mutation never falls through to legacy dispatch",async t=>{const f=await fixture(t),i=intent("canary-ambiguous",[write]);let calls=0;
 const r=await host(f,{policy:policy([i]),callTool:async()=>{calls++;throw Object.assign(new Error("timeout"),{code:"TIMEOUT"});}}).execute(i);
 assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,1);});
test("actual keyed provider persists physical write once across controller restart",async t=>{const f=await fixture(t),i=intent("canary-physical",[write]);let calls=0;const target=path.join(f.root,"actual.txt");
 const opts={policy:policy([i]),callTool:async p=>{const r=await f.journal.executeReconciled({tool_name:p.name,reconciliation_key:p._meta.reconciliation_key,
 request_fingerprint_sha256:hashExecutionInput({tool_name:p.name,arguments:p.arguments})},async()=>{calls++;await writeFile(target,p.arguments.content);return {ok:true};});return r.reconciled?{reconciled:true,...r.operation}:r.value;},
 queryOperation:p=>f.journal.getOperation(p)};
 await host(f,opts).execute(i);await host(f,opts).execute(i);assert.equal(calls,1);assert.equal(await readFile(target,"utf8"),write.input.content);});
test("policy source mutation does not alter admitted authority",async t=>{const f=await fixture(t),p=policy(),h=host(f,{policy:p});p.authorized_intents[0].intent_hash="a".repeat(64);
 const r=await h.execute(intent());assert.equal(r.state.status,"COMPLETED");});
test("inspect checks original cohort context and never dispatches",async t=>{const f=await fixture(t),r=await host(f).admit(intent());
 await assert.rejects(host(f).inspect({operation_id:r.state.operation_id,context:{...context,workspace_id:"dev_workspace_"+"a".repeat(24)}}),/WORKSPACE_CONTEXT_MISMATCH/);});
test("malformed host policy fails closed",async t=>{const f=await fixture(t);assert.throws(()=>host(f,{policy:{...policy(),max_operations:0}}),/INVALID_CANARY_POLICY/);});

test("ordinary reliable admission cannot bypass canary authority",async t=>{const f=await fixture(t);await host(f).admit(intent());
 await assert.rejects(createPiReliableExecutionStore({journal:f.journal}).admit(intent()),/CANARY_AUTHORITY_REQUIRED/);});
test("ordinary reliable command cannot resume canary operation",async t=>{const f=await fixture(t),r=await host(f).admit(intent());
 await assert.rejects(createPiReliableExecutionStore({journal:f.journal}).command({operation_id:r.state.operation_id,context,expected_revision:r.revision,
 command:{type:"owner_acquired",owner:{worker_id:"pi_worker_"+"a".repeat(32),pid:process.pid,hostname:os.hostname()},replaced_worker_id:null}}),/CANARY_AUTHORITY_REQUIRED/);});
test("inactive isolated workspace blocks even read canary",async t=>{const f=await fixture(t);const r=await host(f,{resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"removed"})}).execute(intent());
 assert.equal(r.state.status,"BLOCKED");});
async function child(f,i,p,point) {
 const {execFile}=await import("node:child_process");const {promisify}=await import("node:util");const {fileURLToPath}=await import("node:url");
 const code=`
 import {createDevOperationJournalService} from "./server/src/mcp-development-journal-tools.mjs";
 import {createPiCanaryExecutionController} from "./server/src/pi-canary-execution-controller.mjs";
 import {hashExecutionInput} from "./server/src/pi-execution-contract.mjs";
 import {writeFile} from "node:fs/promises";
 const i=${JSON.stringify(i)},p=${JSON.stringify(p)},point=${JSON.stringify(point)};
 const journal=createDevOperationJournalService({storageRoot:${JSON.stringify(path.join(f.root,"journal"))},
 executionPublicationHook:point==="publication"?async x=>{if(x==="after_completed")process.exit(73);}:undefined});
 const transport={resolveWorkspace:async()=>({...i.context,workspace_type:"isolated_worktree",state:"active"}),
 callTool:async params=>{const result=await journal.executeReconciled({tool_name:params.name,reconciliation_key:params._meta.reconciliation_key,
 request_fingerprint_sha256:hashExecutionInput({tool_name:params.name,arguments:params.arguments})},
 async()=>{await writeFile(${JSON.stringify(path.join(f.root,"physical.txt"))},params.arguments.content);return {ok:true};});
 return result.reconciled?{reconciled:true,...result.operation}:result.value;},queryOperation:a=>journal.getOperation(a)};
 const h=createPiCanaryExecutionController({journal,policy:p,isEnabled:async()=>true,transport,
 executionHook:async x=>{if(x===point)process.exit(73);}});
 const r=point==="admit"||point==="publication"?await h.admit(i):await h.execute(i);
 process.stdout.write(JSON.stringify({operation_id:r.state.operation_id,hash:r.projection_hash}));
 `;
 return promisify(execFile)(process.execPath,["--input-type=module","-e",code],{cwd:fileURLToPath(new URL("../..",import.meta.url)),windowsHide:true,timeout:30000});
}
test("fresh process admission resumes same enrolled operation",async t=>{const f=await fixture(t),i=intent("canary-child",[write]),p=policy([i]);
 const original=JSON.parse((await child(f,i,p,"admit")).stdout);const r=await host(f,{policy:p}).execute(i);
 assert.equal(r.state.operation_id,original.operation_id);assert.equal(r.state.status,"COMPLETED");});
for(const point of ["after_claim","after_dispatch","after_receipt"])test("real canary process exit "+point+" resumes without duplicate physical effect",async t=>{
 const f=await fixture(t),i=intent("canary-exit-"+point,[write]),p=policy([i]);await assert.rejects(child(f,i,p,point),e=>e.code===73);
 const r=await host(f,{policy:p,queryOperation:a=>f.journal.getOperation(a),callTool:async params=>{
 const result=await f.journal.executeReconciled({tool_name:params.name,reconciliation_key:params._meta.reconciliation_key,
 request_fingerprint_sha256:hashExecutionInput({tool_name:params.name,arguments:params.arguments})},
 async()=>{await writeFile(path.join(f.root,"physical.txt"),params.arguments.content);return {ok:true};});
 return result.reconciled?{reconciled:true,...result.operation}:result.value;}}).execute(i);
 assert.equal(r.state.status,"COMPLETED");assert.equal(await readFile(path.join(f.root,"physical.txt"),"utf8"),write.input.content);
 const events=(await f.journal.verify()).events;assert.equal(events.filter(e=>e.stage==="operation_started"&&e.reconciliation_key===write.idempotency_key).length,1);
});
test("admission publication exit restores original canary binding",async t=>{const f=await fixture(t),i=intent(),p=policy([i]);
 await assert.rejects(child(f,i,p,"publication"),e=>e.code===73);
 const r=await host(f,{policy:p}).execute(i);assert.equal(r.state.status,"COMPLETED");
 assert.equal((await f.journal.readExecutionProjections()).filter(e=>e.execution_projection.revision===1).length,1);
 assert.equal((await f.journal.status()).dangling_operation_count,0);});

test("host switch lookup is bounded and late enable cannot admit",async t=>{const f=await fixture(t);const started=Date.now();
 await assert.rejects(host(f,{isEnabled:()=>new Promise(()=>{})}).admit(intent()),/CANARY_DISABLED/);assert(Date.now()-started<2500);
 assert.equal((await f.journal.readExecutionProjections()).length,0);});
test("stdio binding preserves exact tool request and mutation identity",async()=>{
 let seen;const response={content:[{type:"text",text:"facts"}]};
 const transport=createPiCanaryStdioTransport({call:(request,callback)=>{seen=request;callback(null,{result:response});}});
 const params={name:"dev_create_file",arguments:{path:"tests/example.mjs",content:"GPT content"},_meta:{reconciliation_key:"canary-wire-key"}};
 assert.equal(await transport.callTool(params),response);assert.deepEqual(seen.params,params);assert.equal(seen.method,"tools/call");
});
test("stdio scope and reconciliation observations use existing concrete tools",async()=>{
 const seen=[];const transport=createPiCanaryStdioTransport({call:(request,callback)=>{seen.push(request.params);
 callback(null,{result:{content:[{type:"text",text:JSON.stringify(request.params.name==="dev_workspace_get_workspace"?{...context,workspace_type:"isolated_worktree",state:"active"}:{reconciliation_state:"not_admitted"})}]}});}});
 assert.equal((await transport.resolveWorkspace({workspace_id:context.workspace_id})).workspace_id,context.workspace_id);
 const args={reconciliation_key:"canary-query-key",request_fingerprint_sha256:"a".repeat(64)};
 assert.equal((await transport.queryOperation(args)).reconciliation_state,"not_admitted");
 assert.deepEqual(seen,[{name:"dev_workspace_get_workspace",arguments:{workspace_id:context.workspace_id}},{name:"dev_workspace_get_operation",arguments:args}]);
});
for(const [raw,mapped] of [["CHILD_HUNG","TIMEOUT"],["CHILD_DEAD","TRANSPORT_ERROR"]])test("stdio "+raw+" preserves reliability classification",async()=>{
 const transport=createPiCanaryStdioTransport({call:(r,cb)=>cb(Object.assign(new Error("details"),{code:raw}))});
 await assert.rejects(transport.callTool({name:"dev_read_file",arguments:{}}),e=>e.code===mapped);});
test("stdio semantic RPC failure does not become a transport retry",async()=>{
 const transport=createPiCanaryStdioTransport({call:(r,cb)=>cb(null,{error:{message:"bad arguments"}})});
 await assert.rejects(transport.callTool({name:"dev_read_file",arguments:{}}),e=>e.code==="IMPLEMENTATION_FAILURE");});
test("stdio malformed observation fails safe",async()=>{
 const transport=createPiCanaryStdioTransport({call:(r,cb)=>cb(null,{result:{content:[{type:"text",text:"invalid JSON"}]}})});
 await assert.rejects(transport.resolveWorkspace({workspace_id:context.workspace_id}),e=>e.code==="CORRUPT_STATE");});

test("separate canary bindings sharing one stdio session use distinct RPC identities",async()=>{
 const ids=[];const session={call:(r,cb)=>{ids.push(r.id);cb(null,{result:{ok:true}});}};
 await Promise.all([createPiCanaryStdioTransport(session).callTool({name:"dev_read_file",arguments:{}}),
 createPiCanaryStdioTransport(session).callTool({name:"dev_read_file",arguments:{}})]);
 assert.equal(new Set(ids).size,2);
});

test("journal alone reconstructs approved policy and Intent without dispatch",async t=>{const f=await fixture(t),i=intent(),r=await host(f).admit(i);
 const enrollment=await readPiCanaryEnrollment({operation_id:r.state.operation_id,context},{journal:f.journal});
 assert.deepEqual(enrollment.policy,policy());assert.deepEqual(enrollment.intent,i);assert.equal(enrollment.execution_enabled,false);
 assert(enrollment.admission_receipt.event_hash);assert(Object.isFrozen(enrollment.policy));
 assert.equal((await host(f,{policy:enrollment.policy}).execute(enrollment.intent)).state.operation_id,r.state.operation_id);
});
for(const changedPolicy of [false,true])test("semantic journal refuses bypassed "+(changedPolicy?"cohort policy":"cohort capacity"),async t=>{
 const f=await fixture(t),a=intent("canary-first"),b=intent("canary-second"),p=policy([a,b],1);await host(f,{policy:p}).admit(a);
 const boundPolicy=changedPolicy?{...p,max_operations:2}:p;
 const binding={cohort_id:p.cohort_id,policy_hash:hashExecutionInput(boundPolicy),policy:boundPolicy};
 const bypass=createPiReliableExecutionStore({journal:f.journal,admissionBinding:binding,admissionGuard:async()=>{}});
 await assert.rejects(bypass.admit(b),/CORRUPT_STATE/);
 assert.equal((await f.journal.readExecutionProjections()).length,1);
});
test("semantic journal rejects altered policy hash before publication",async t=>{const f=await fixture(t),p=policy();
 const bypass=createPiReliableExecutionStore({journal:f.journal,admissionBinding:{cohort_id:p.cohort_id,policy_hash:"0".repeat(64),policy:p},admissionGuard:async()=>{}});
 await assert.rejects(bypass.admit(intent()),/CORRUPT_STATE/);assert.equal((await f.journal.readExecutionProjections()).length,0);});
test("semantic journal rejects non-authorized bound Intent before publication",async t=>{const f=await fixture(t),p=policy();
 const bypass=createPiReliableExecutionStore({journal:f.journal,admissionBinding:{cohort_id:p.cohort_id,policy_hash:hashExecutionInput(p),policy:p},admissionGuard:async()=>{}});
 await assert.rejects(bypass.admit(intent("not-approved")),/CORRUPT_STATE/);assert.equal((await f.journal.readExecutionProjections()).length,0);});
