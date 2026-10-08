import assert from "node:assert/strict";
import test from "node:test";
// Keep policy regressions in the existing Pi production test entrypoint.
import "./pi-execution-policy.test.mjs";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createDevOperationJournalService} from "../../server/src/mcp-development-journal-tools.mjs";
import {createPiProductionRouteStore,validatePiProductionRouteHistory} from "../../server/src/pi-production-execution-route.mjs";
import {createPiProductionExecutionController,guardPiDirectExecution} from "../../server/src/pi-production-execution-controller.mjs";
import {createPiReliableExecutionStore} from "../../server/src/pi-reliable-execution-store.mjs";
import {REQUIRED_DECISION_BOUNDARIES,hashExecutionInput,createExecutionIntent} from "../../server/src/pi-execution-contract.mjs";
const context={project_id:"writer_workbench",workstream_id:"dev_workstream_20261003-153931_7730524b821e",workspace_id:"dev_workspace_65ed265de3494399b7ad40b2"};
function intent(id="default-intent-001",write=false){const input=write?{path:"scripts/probe.mjs",content:"// GPT exact content"}:{path:"package.json"};
 const action={step_id:"requested",capability:write?"filesystem.write":"filesystem.read",input,depends_on:[],...(write?{idempotency_key:"production-key-"+id}:{})};
 return {schema_version:1,intent_id:id,goal:"Execute exact GPT request",context,constraints:["Preserve scope"],requested_actions:[action],
 mutation_plan:write?[{step_id:"requested",target:input.path,expected_change:"Exact GPT content",input_sha256:hashExecutionInput(input)}]:[],
 verification:{focused:[],affected:[],full:[]},completion_conditions:["GPT reviews facts"],permissions:{read:true,write:true,tests:false,commit:false,integrate:false,push:false,workspace_create:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};}
test("legacy workspace.create target remains readable while workspace.create_isolated stays strict",()=>{
 const input={workstream_id:context.workstream_id,expected_workstream_revision:1};
 const legacy={schema_version:1,intent_id:"legacy-workspace-create-history-001",goal:"Read pre-Phase F workspace create history",context,constraints:["Preserve historical contract"],requested_actions:[{step_id:"create",capability:"workspace.create",input,depends_on:[],idempotency_key:"legacy-workspace-create-history-001"}],
  mutation_plan:[{step_id:"create",target:"isolated-workspace",expected_change:"Create isolated workspace",input_sha256:hashExecutionInput(input)}],
  verification:{focused:[],affected:[],full:[]},completion_conditions:["Historical intent remains valid"],permissions:{read:true,write:false,tests:false,commit:false,integrate:false,push:false,workspace_create:true},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
 assert.equal(createExecutionIntent(legacy).mutation_plan[0].target,"isolated-workspace");
 const strict=JSON.parse(JSON.stringify(legacy));strict.intent_id="strict-workspace-create-isolated-001";strict.requested_actions[0].capability="workspace.create_isolated";strict.requested_actions[0].idempotency_key="strict-workspace-create-isolated-001";
 assert.throws(()=>createExecutionIntent(strict),{code:"MUTATION_TARGET_MISMATCH"});
});
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),"pi-production-"));t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});return {journal,route:createPiProductionRouteStore({journal})};}
const decision={mode:"pi_default",decision_id:"gpt-cutover-001",gate_hash:"a".repeat(64)};
async function enable(f){return f.route.change({...decision,expected_revision:0},{validateGate:async()=>true});}
function controller(f,callTool=async()=>({ok:true}),extra={}){return createPiProductionExecutionController({journal:f.journal,route:f.route,
 transport:{callTool,resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),queryOperation:async a=>({...a,reconciliation_state:"unknown"}),...extra}});}
test("production route begins legacy and does not cut over implicitly",async t=>{const f=await fixture(t);assert.equal((await f.route.inspect()).mode,"legacy_direct");
 await assert.rejects(controller(f).execute(intent()),{code:"PRODUCTION_ROUTE_DISABLED"});assert.equal((await f.journal.readExecutionProjections()).length,0);});
test("cutover requires exact GPT decision and trusted successful gate",async t=>{const f=await fixture(t);
 await assert.rejects(f.route.change({...decision,expected_revision:0}),{code:"CUTOVER_GATE_REQUIRED"});
 await assert.rejects(f.route.change({...decision,expected_revision:0},{validateGate:async()=>false}),{code:"CUTOVER_GATE_FAILED"});
 assert.equal((await f.route.inspect()).revision,0);const r=await enable(f);assert.equal(r.mode,"pi_default");assert.equal(r.decision_owner,"GPT");});
test("route persists in Development Journal and fresh store recovers hash",async t=>{const f=await fixture(t);const r=await enable(f);
 const again=createPiProductionRouteStore({journal:createDevOperationJournalService({storageRoot:f.journal.storageRoot})});assert.deepEqual(await again.inspect(),r);assert.equal((await f.journal.status()).active_operation_count,0);});
test("route CAS prevents concurrent contradictory cutover",async t=>{const f=await fixture(t);const results=await Promise.allSettled([enable(f),f.route.change({...decision,decision_id:"gpt-cutover-002",expected_revision:0},{validateGate:async()=>true})]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);assert.equal(results.find(x=>x.status==="rejected").reason.code,"ROUTE_REVISION_CONFLICT");});
test("default executes precise GPT intent and duplicate does not dispatch",async t=>{const f=await fixture(t);await enable(f);let calls=0;
 const host=controller(f,async p=>{calls++;assert.equal(p.name,"dev_create_file");assert.equal(p.arguments.content,"// GPT exact content");return {ok:true};});
 const r=await host.execute(intent("default-write",true)),d=await host.execute(intent("default-write",true));assert.equal(calls,1);assert.equal(r.state.status,"COMPLETED");
 assert.equal(d.projection_hash,r.projection_hash);assert.equal(r.result.production_default_changed,true);assert.equal(r.result.model_requests,0);});
test("production admission is unbounded by canary cohort capacity",async t=>{const f=await fixture(t);await enable(f);
 const host=controller(f);for(let n=0;n<11;n++)await host.admit(intent("production-new-"+n));assert.equal((await f.journal.readExecutionProjections()).length,11);});
test("old explicit reliable operation is not migrated",async t=>{const f=await fixture(t);const i=intent("old-explicit");
 await createPiReliableExecutionStore({journal:f.journal}).admit(i);await enable(f);
 await assert.rejects(controller(f).execute(i),{code:"LEGACY_OPERATION_NOT_MIGRATED"});});
test("generic reliable store cannot bypass production authority",async t=>{const f=await fixture(t);await enable(f);const i=intent(),r=await controller(f).admit(i);
 await assert.rejects(createPiReliableExecutionStore({journal:f.journal}).admit(i),{code:"PRODUCTION_AUTHORITY_REQUIRED"});
 await assert.rejects(createPiReliableExecutionStore({journal:f.journal}).command({operation_id:r.state.operation_id,context,expected_revision:r.revision,command:{type:"phase_changed",status:"ADMITTED"}}),{code:"PRODUCTION_AUTHORITY_REQUIRED"});});
test("fallback never dispatches automatically after validation failure",async t=>{const f=await fixture(t);await enable(f);let calls=0;
 const r=await controller(f,async()=>{calls++;return {isError:true};}).execute(intent());
 assert.equal(r.state.status,"DECISION_REQUIRED");assert.equal(calls,1);assert.equal(r.result.engineering_review_required,true);});
test("disabled route stops a pending effect and completed duplicate stays readable",async t=>{const f=await fixture(t);await enable(f);
 const host=controller(f),i=intent("complete-before-disable");const r=await host.execute(i);
 await f.route.change({mode:"pi_paused",decision_id:"gpt-emergency-001",gate_hash:null,expected_revision:1},{validateGate:async()=>true});
 assert.equal((await host.execute(i)).projection_hash,r.projection_hash);await assert.rejects(host.admit(intent("new-disabled")),{code:"PRODUCTION_ROUTE_DISABLED"});});
test("default direct calls require explicit audited fallback and reject forged internal metadata",async t=>{const f=await fixture(t);await enable(f);let calls=0;
 await assert.rejects(guardPiDirectExecution({route:f.route,tool:"dev_create_file",params:{_meta:{pi_internal:true}},auditFallback:async()=>{calls++;}}),{code:"PI_EXECUTION_INTENT_REQUIRED"});
 await guardPiDirectExecution({route:f.route,tool:"dev_read_file",params:{_meta:{pi_fallback:{purpose:"diagnostic",reason:"Inspect physical state",decision_id:"gpt-diagnostic-001"}}},auditFallback:async r=>{calls++;assert.equal(r.decision_owner,"GPT");}});
 assert.equal(calls,1);});
test("fallback requires mutation idempotency and fails closed when audit fails",async t=>{const f=await fixture(t);await enable(f);const params={_meta:{pi_fallback:{purpose:"emergency",reason:"Explicit GPT action",decision_id:"gpt-emergency-002"}}};
 await assert.rejects(guardPiDirectExecution({route:f.route,tool:"dev_create_file",mutation:true,params,auditFallback:async()=>{}}),{code:"FALLBACK_IDEMPOTENCY_REQUIRED"});
 params._meta.reconciliation_key="fallback-key-001";await assert.rejects(guardPiDirectExecution({route:f.route,tool:"dev_create_file",mutation:true,params,auditFallback:async()=>{throw new Error("audit failed");}}),/audit failed/);});
test("hash-valid malformed route history fails safe",async t=>{const f=await fixture(t);await enable(f);const events=await f.journal.readProductionRoutes();events[0].result.route_record="{}";
 assert.throws(()=>validatePiProductionRouteHistory(events),{code:"CORRUPT_ROUTE_STATE"});});

test("route decision retransmission returns original durable result",async t=>{const f=await fixture(t),first=await enable(f);
 const repeat=await enable(f);assert.deepEqual(repeat,first);assert.equal((await f.journal.readProductionRoutes()).length,1);
 await f.route.change({mode:"pi_paused",decision_id:"gpt-pause-001",gate_hash:null,expected_revision:1},{validateGate:async()=>true});
 assert.deepEqual(await enable(f),first);assert.equal((await f.route.inspect()).mode,"pi_paused");
 await assert.rejects(f.route.change({mode:"pi_paused",decision_id:decision.decision_id,gate_hash:null,expected_revision:0},{validateGate:async()=>true}),{code:"ROUTE_DECISION_CONFLICT"});});
test("active Pi worker fences a route change",async t=>{const f=await fixture(t);await enable(f);let fenced=false;
 const host=createPiProductionExecutionController({journal:f.journal,route:f.route,transport:{callTool:async()=>({ok:true}),queryOperation:a=>f.journal.getOperation(a),
 resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"})},executionHook:async point=>{
 if(point==="after_claim"){await assert.rejects(f.route.change({mode:"pi_paused",decision_id:"gpt-pause-active",gate_hash:null,expected_revision:1},{validateGate:async()=>true}),{code:"ROUTE_ACTIVE_EXECUTION"});fenced=true;}}});
 assert.equal((await host.execute(intent("active-worker"))).state.status,"COMPLETED");assert.equal(fenced,true);assert.equal((await f.route.inspect()).mode,"pi_default");});
test("production project and inspection context remain authoritative",async t=>{const f=await fixture(t);await enable(f);const host=controller(f),i=intent("inspect-by-intent"),r=await host.admit(i);
 assert.equal((await host.inspect({intent_id:i.intent_id,context})).projection_hash,r.projection_hash);
 await assert.rejects(host.inspect({intent_id:i.intent_id,context:{...context,workspace_id:"dev_workspace_"+"0".repeat(24)}}),{code:"WORKSPACE_CONTEXT_MISMATCH"});
 await assert.rejects(host.admit({...intent("foreign-project"),context:{...context,project_id:"foreign"}}),{code:"INVALID_EXECUTION_CONTEXT"});});
test("paused default still requires fallback authority",async t=>{const f=await fixture(t);await enable(f);
 await f.route.change({mode:"pi_paused",decision_id:"gpt-pause-guard",gate_hash:null,expected_revision:1},{validateGate:async()=>true});
 await assert.rejects(guardPiDirectExecution({route:f.route,tool:"dev_read_file",params:{},auditFallback:async()=>{}}),{code:"PI_EXECUTION_INTENT_REQUIRED"});});
test("MCP mutation boundary uses resolved physical scope and duplicate skips resolver",async t=>{const f=await fixture(t);
 const request={tool_name:"dev_create_file",reconciliation_key:"scope-bound-key-001",request_fingerprint_sha256:"b".repeat(64),resolve_workspace_scope:async()=>context};let effects=0;
 const r=await f.journal.executeReconciled(request,async()=>{effects++;return {content:[{type:"text",text:JSON.stringify({ok:true})}]};});
 assert.equal(r.operation.events[0].workspace_id,context.workspace_id);assert.equal(r.operation.events[0].workstream_id,context.workstream_id);
 const duplicate=await f.journal.executeReconciled({...request,resolve_workspace_scope:async()=>{throw new Error("removed workspace");}},()=>{throw new Error("duplicate effect");});
 assert.equal(duplicate.reconciled,true);assert.equal(effects,1);});
test("partial route publication fails closed",async t=>{const f=await fixture(t);
 const broken=createDevOperationJournalService({storageRoot:f.journal.storageRoot,executionPublicationHook:async p=>{if(p==="route_after_completed")throw new Error("route interruption");}});
 await assert.rejects(createPiProductionRouteStore({journal:broken}).change({...decision,expected_revision:0},{validateGate:async()=>true}),/route interruption/);
 await assert.rejects(f.route.inspect());await assert.rejects(guardPiDirectExecution({route:f.route,tool:"dev_create_file",params:{},auditFallback:async()=>{throw new Error("must not fall back");}}));});

import {execFile as execFileCallback} from "node:child_process";
import {promisify} from "node:util";
import {writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {randomUUID} from "node:crypto";
import {submitPiExecutionIntent} from "../../scripts/pi-execution.mjs";
const execFile=promisify(execFileCallback);
async function worker(f,i,point,publication=false){
 const journalUrl=new URL("../../server/src/mcp-development-journal-tools.mjs",import.meta.url).href;
 const controllerUrl=new URL("../../server/src/pi-production-execution-controller.mjs",import.meta.url).href;
 const routeUrl=new URL("../../server/src/pi-production-execution-route.mjs",import.meta.url).href;
 const contractUrl=new URL("../../server/src/pi-execution-contract.mjs",import.meta.url).href;
 const code=`import {createDevOperationJournalService} from ${JSON.stringify(journalUrl)};
 import {createPiProductionExecutionController} from ${JSON.stringify(controllerUrl)};
 import {createPiProductionRouteStore} from ${JSON.stringify(routeUrl)};
 import {hashExecutionInput} from ${JSON.stringify(contractUrl)};
 import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
 const root=${JSON.stringify(f.root)},i=${JSON.stringify(i)},point=${JSON.stringify(point)};
 const journal=createDevOperationJournalService({storageRoot:${JSON.stringify(f.journal.storageRoot)},
 executionPublicationHook:async p=>{if(${publication}&&p===point)process.exit(73);}});
 const host=createPiProductionExecutionController({journal,route:createPiProductionRouteStore({journal}),
 executionHook:async p=>{if(!${publication}&&p===point)process.exit(73);},
 transport:{resolveWorkspace:async()=>({...i.context,workspace_type:'isolated_worktree',state:'active'}),
 queryOperation:a=>journal.getOperation(a),callTool:async params=>{
 const result=await journal.executeReconciled({tool_name:params.name,reconciliation_key:params._meta.reconciliation_key,
 request_fingerprint_sha256:hashExecutionInput({tool_name:params.name,arguments:params.arguments}),resolve_workspace_scope:async()=>i.context},
 async()=>{let n=0;try{n=Number(await readFile(path.join(root,'effects.txt'),'utf8'));}catch{}
 await writeFile(path.join(root,'effects.txt'),String(n+1));return {content:[{type:'text',text:JSON.stringify({ok:true})}]};});
 return result.reconciled?{reconciled:true,...result.operation}:result.value;}}});
 const r=await host.execute(i);console.log(JSON.stringify(r));`;
 return execFile(process.execPath,["--input-type=module","-e",code],{windowsHide:true,timeout:60000,maxBuffer:1048576});
}
for(const point of ["after_claim","after_dispatch","after_receipt"])test("production worker process exit "+point+" recovers once",async t=>{
 const f=await fixture(t);f.root=path.dirname(f.journal.storageRoot);await enable(f);const i=intent("worker-"+point,true);
 await assert.rejects(worker(f,i,point),e=>e.code===73);const result=JSON.parse((await worker(f,i,"none")).stdout);
 assert.equal(result.state.status,"COMPLETED");assert.equal(await readFile(path.join(f.root,"effects.txt"),"utf8"),"1");
 assert.equal((await f.journal.listOperations({operation_type:"mcp_mutation"})).total,1);});
for(const point of ["after_started","after_completed"])test("production publication exit "+point+" restores default enrollment",async t=>{
 const f=await fixture(t);f.root=path.dirname(f.journal.storageRoot);await enable(f);const i=intent("publication-"+point,true);
 await assert.rejects(worker(f,i,point,true),e=>e.code===73);const result=JSON.parse((await worker(f,i,"none")).stdout);
 assert.equal(result.state.status,"COMPLETED");assert.equal(await readFile(path.join(f.root,"effects.txt"),"utf8"),"1");});

function fakeSessionFactory(callback,onClose=()=>{}){return ()=>({send(){},close:onClose,call(message,done){
 if(message.method==="initialize"){done(null,{result:{}});return;}callback(message,done);}});}
test("submission host reconnects using exact same Intent",async t=>{const f=await fixture(t);await enable(f);const i=intent("submission-reconnect"),r=await controller(f).execute(i);let calls=0,closed=0;
 const requests=[];const result=await submitPiExecutionIntent(i,{sleep:async()=>{},sessionFactory:fakeSessionFactory((m,done)=>{
 requests.push(m.params);if(++calls===1){done(Object.assign(new Error("lost transport"),{code:"TRANSPORT_ERROR"}));return;}
 done(null,{result:{structuredContent:r}});},()=>closed++)});
 assert.equal(result.projection_hash,r.projection_hash);assert.equal(calls,2);assert.equal(closed,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].name,"dev_pi_execute_intent");});
test("submission host does not retry semantic rejection",async t=>{const f=await fixture(t);await enable(f);let calls=0;
 await assert.rejects(submitPiExecutionIntent(intent(),{sleep:async()=>{},sessionFactory:fakeSessionFactory((m,done)=>{calls++;done(null,{error:{code:-32602}});})}),{code:"PI_REQUEST_REJECTED"});assert.equal(calls,1);});
test("submission host rejects a completed result for a different Intent",async t=>{const f=await fixture(t);await enable(f);const r=await controller(f).execute(intent("different-result"));
 await assert.rejects(submitPiExecutionIntent(intent("requested-result"),{sessionFactory:fakeSessionFactory((m,done)=>done(null,{result:{structuredContent:r}}))}),{code:"INVALID_PI_RESPONSE"});});
test("submission host polls pending state and preserves completion semantics on deadline",async t=>{const f=await fixture(t);await enable(f);const i=intent("submission-poll"),host=controller(f);
 const pending=await host.admit(i),complete=await host.execute(i);let n=0,tick=0;
 const result=await submitPiExecutionIntent(i,{clock:()=>tick,deadlineMs:3000,sleep:async()=>{tick+=1000;},sessionFactory:fakeSessionFactory((m,done)=>done(null,{result:{structuredContent:++n===1?pending:complete}}))});
 assert.equal(result.state.status,"COMPLETED");assert.equal(n,2);tick=0;
 const stopped=await submitPiExecutionIntent(i,{clock:()=>tick,deadlineMs:500,sleep:async()=>{tick+=1000;},sessionFactory:fakeSessionFactory((m,done)=>done(null,{result:{structuredContent:pending}}))});
 assert.equal(stopped.submission_pending,true);assert.equal(stopped.operation.projection_hash,pending.projection_hash);assert.equal(stopped.operation.state.status,"CREATED");});

test("real MCP production ingress and explicit direct diagnostic share durable route",async t=>{
 const group=randomUUID(),root=path.join(os.tmpdir(),"writer-workbench-operation-journal-test-"+group);
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 const journal=createDevOperationJournalService({storageRoot:path.join(root,"operation-journal")});
 await createPiProductionRouteStore({journal}).change({...decision,expected_revision:0},{validateGate:async()=>true});
 const sessionUrl=new URL("../../server/src/mcp-http-stdio-adapter.mjs",import.meta.url).href;
 const code=`import {createStdioSession} from ${JSON.stringify(sessionUrl)};
 const s=createStdioSession({readonlyRetryMaxAttempts:0});const call=m=>new Promise((r,j)=>s.call(m,(e,v)=>e?j(e):r(v)));
 try{await call({jsonrpc:'2.0',id:'init',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pi-wire',version:'1'}}});
 s.send({jsonrpc:'2.0',method:'notifications/initialized',params:{}});
 const status=await call({jsonrpc:'2.0',id:'status',method:'tools/call',params:{name:'dev_pi_execution_status',arguments:{}}});
 const direct=await call({jsonrpc:'2.0',id:'direct',method:'tools/call',params:{name:'dev_read_file',arguments:{path:'package.json'}}});
 const directPowerShell=await call({jsonrpc:'2.0',id:'direct-powershell',method:'tools/call',params:{name:'powershell_run',arguments:{command:"Write-Output 'must-not-run'",workspace_id:'dev_workspace_shared_repository_v1'}}});
 const forged=await call({jsonrpc:'2.0',id:'forged',method:'tools/call',params:{name:'dev_read_file',arguments:{path:'package.json'},_meta:{pi_internal:true}}});
 const diagnostic=await call({jsonrpc:'2.0',id:'diag',method:'tools/call',params:{name:'dev_read_file',arguments:{path:'package.json'},
 _meta:{pi_fallback:{purpose:'diagnostic',reason:'Inspect physical package',decision_id:'gpt-wire-diag'}}}});
 const bad=await call({jsonrpc:'2.0',id:'bad',method:'tools/call',params:{name:'dev_pi_execute_intent',arguments:{intent_json:'{'}}});
 console.log(JSON.stringify({status,direct,directPowerShell,forged,diagnostic,bad}));
 }finally{s.close();}`;
 const {stdout}=await execFile(process.execPath,["--input-type=module","-e",code],{cwd:fileURLToPath(new URL("../..",import.meta.url)),
 windowsHide:true,timeout:120000,maxBuffer:1048576,env:{...process.env,MCP_TOOL_PROFILE:"chatgpt_developer",WRITER_WORKBENCH_TEST_JOURNAL_GROUP:group,
 WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL:"1",WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT:"1",WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION:"1"}});
 const r=JSON.parse(stdout);assert.equal(JSON.parse(r.status.result.content[0].text).route.mode,"pi_default");
 assert.equal(r.direct.error.message,"PI_EXECUTION_INTENT_REQUIRED");assert.equal(r.directPowerShell.error.message,"PI_EXECUTION_INTENT_REQUIRED");
 assert.equal(r.forged.error.message,"PI_EXECUTION_INTENT_REQUIRED");
 assert.notEqual(r.diagnostic.result.isError,true);assert.equal(r.bad.result.isError,true);
 assert.equal((await journal.listOperations({operation_type:"pi_diagnostic_fallback"})).total,1);});

import {Readable} from "node:stream";
import {readPiIntentJson} from "../../scripts/pi-execution.mjs";
import {createParentIntegrationControl} from "../../server/src/mcp-http-integration-control.mjs";
test("Intent stdin preserves UTF-8 split across transport chunks",async()=> {
 const bytes=Buffer.from(JSON.stringify({goal:"繁體中文工程",intent_id:"unicode-input"}));
 const chunks=Array.from(bytes,b=>Buffer.from([b]));
 assert.deepEqual(await readPiIntentJson(Readable.from(chunks)),{goal:"繁體中文工程",intent_id:"unicode-input"});
});
test("parent integration rejects unauthorised direct calls before runtime dispatch",async t=>{
 const f=await fixture(t);await enable(f);let loads=0,effects=0,audits=0;
 const parent=createParentIntegrationControl({profile:"chatgpt_developer",
 guardRoute:params=>guardPiDirectExecution({route:f.route,tool:"dev_workspace_integrate",mutation:true,params,auditFallback:async()=>{audits++;}}),
 loadRuntime:async()=>{loads++;return {dev_workspace_integrate:async()=>{effects++;return {state:"integrated"};}};},
 audit:async(fn,args)=>({content:[{type:"text",text:JSON.stringify(await fn(args))}]})});
 const message={jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"dev_workspace_integrate",arguments:{integration_candidate_id:"dev_integration_20261003-142354_8d2e6c93a9e5",expected_revision:6}}};
 for(const meta of [undefined,{pi_internal:true},{pi_fallback:{purpose:"emergency",reason:"GPT authorised diagnostic",decision_id:"gpt-parent-fallback"}}]){
 const r=await parent.call({...message,params:{...message.params,_meta:meta}});assert.equal(r.result.isError,true);}
 assert.equal(loads,0);assert.equal(effects,0);assert.equal(audits,0);
 const r=await parent.call({...message,params:{...message.params,_meta:{reconciliation_key:"parent-fallback-20261004",pi_fallback:{purpose:"emergency",reason:"GPT authorised controlled integration",decision_id:"gpt-parent-fallback"}}}});
 assert.notEqual(r.result.isError,true);assert.equal(effects,1);assert.equal(audits,1);
});

test("production engineering cutover preserves public product reads and profile authority",async t=>{
 const group=randomUUID(),root=path.join(os.tmpdir(),"writer-workbench-operation-journal-test-"+group);
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
 const journal=createDevOperationJournalService({storageRoot:path.join(root,"operation-journal")});
 await createPiProductionRouteStore({journal}).change({...decision,expected_revision:0},{validateGate:async()=>true});
 const sessionUrl=new URL("../../server/src/mcp-http-stdio-adapter.mjs",import.meta.url).href;
 const code=`import {createStdioSession} from ${JSON.stringify(sessionUrl)};
 const s=createStdioSession({readonlyRetryMaxAttempts:0});const call=m=>new Promise((r,j)=>s.call(m,(e,v)=>e?j(e):r(v)));
 try{await call({jsonrpc:'2.0',id:'init',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'pi-public-product',version:'1'}}});
 s.send({jsonrpc:'2.0',method:'notifications/initialized',params:{}});
 const read=await call({jsonrpc:'2.0',id:'read',method:'tools/call',params:{name:'dev_read_file',arguments:{path:'config/engine-components.json'}}});
 const intent=await call({jsonrpc:'2.0',id:'intent',method:'tools/call',params:{name:'dev_pi_execute_intent',arguments:{intent_json:'{}'}}});
 const write=await call({jsonrpc:'2.0',id:'write',method:'tools/call',params:{name:'dev_create_file',arguments:{path:'scripts/forbidden.mjs',content:'forbidden'}}});
 console.log(JSON.stringify({read,intent,write}));}finally{s.close();}`;
 const {stdout}=await execFile(process.execPath,["--input-type=module","-e",code],{cwd:fileURLToPath(new URL("../..",import.meta.url)),
 windowsHide:true,timeout:120000,maxBuffer:1048576,env:{...process.env,MCP_TOOL_PROFILE:"chatgpt_public",WRITER_WORKBENCH_TEST_JOURNAL_GROUP:group,
 WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL:"1",WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT:"1",WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION:"1"}});
 const r=JSON.parse(stdout);assert.equal(r.read.error,undefined);assert.notEqual(r.read.result.isError,true);
 assert.match(r.intent.error.message,/Tool not allowed by MCP tool profile chatgpt_public/u);
 assert.match(r.write.error.message,/Tool not allowed by MCP tool profile chatgpt_public/u);
 assert.equal((await journal.listOperations({operation_type:"pi_diagnostic_fallback"})).total,0);
});
