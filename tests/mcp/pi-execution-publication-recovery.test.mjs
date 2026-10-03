import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { createDevOperationJournalService, canonicalJson } from "../../server/src/mcp-development-journal-tools.mjs";
import { createPiReliableExecutionStore } from "../../server/src/pi-reliable-execution-store.mjs";
import { createPiReliableExecutionEngine } from "../../server/src/pi-reliable-execution-engine.mjs";
import { createPiReliableMcpAdapter } from "../../server/src/pi-mcp-reliable-adapter.mjs";
import { REQUIRED_DECISION_BOUNDARIES, hashExecutionInput } from "../../server/src/pi-execution-contract.mjs";
const exec=promisify(execFile);
const context={project_id:"writer_workbench",workstream_id:"dev_workstream_20261003-100124_6f779341a426",
  workspace_id:"dev_workspace_86a7ddd3980944b0902ac022"};
const action={step_id:"write",capability:"filesystem.write",input:{path:"tests/.tmp/physical.txt",content:"exact GPT bytes"},
  depends_on:[],idempotency_key:"restart-mutation-001"};
const sourceIntent={schema_version:1,intent_id:"restart-intent-001",goal:"Apply exact GPT mutation",context,
  constraints:["No production route change"],requested_actions:[action],
  mutation_plan:[{step_id:"write",target:action.input.path,expected_change:"Create exact content",input_sha256:hashExecutionInput(action.input)}],
  verification:{focused:[],affected:[],full:[]},completion_conditions:["GPT reviews execution facts"],
  permissions:{read:true,workspace_create:false,write:true,tests:false,commit:false,integrate:false,push:false},
  decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
const urls=Object.fromEntries(["mcp-development-journal-tools","pi-reliable-execution-store","pi-reliable-execution-engine",
  "pi-mcp-reliable-adapter","pi-execution-contract"].map(x=>[x,new URL("../../server/src/"+x+".mjs",import.meta.url).href]));
async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),"pi-restart-"));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  return root;
}
async function child(root,point="none",extra="") {
  const code=`import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {createDevOperationJournalService} from ${JSON.stringify(urls["mcp-development-journal-tools"])};
import {createPiReliableExecutionStore} from ${JSON.stringify(urls["pi-reliable-execution-store"])};
import {createPiReliableExecutionEngine} from ${JSON.stringify(urls["pi-reliable-execution-engine"])};
import {createPiReliableMcpAdapter} from ${JSON.stringify(urls["pi-mcp-reliable-adapter"])};
import {hashExecutionInput} from ${JSON.stringify(urls["pi-execution-contract"])};
const root=process.argv[1],point=process.argv[2];
const context=${JSON.stringify(context)},intent=${JSON.stringify(sourceIntent)};
const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal"),
  executionPublicationHook:async stage=>{
    if(point==="publication:"+stage)process.exit(73);
    if(point==="receipt_publication:"+stage) {
      try {await readFile(path.join(root,"count"));process.exit(73);}catch(e){if(e.code!=="ENOENT")throw e;}
    }
  }});
const store=createPiReliableExecutionStore({journal});
const adapter=createPiReliableMcpAdapter({
 resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),
 queryOperation:async params=>journal.getOperation(params),
 callTool:async params=>{
   if(point==="retry_scheduled")throw Object.assign(new Error("TIMEOUT"),{code:"TIMEOUT"});
   const result=await journal.executeReconciled({reconciliation_key:params._meta.reconciliation_key,
     request_fingerprint_sha256:hashExecutionInput({tool_name:params.name,arguments:params.arguments}),tool_name:params.name},async()=>{
       let count=0;try{count=Number(await readFile(path.join(root,"count"),"utf8"));}catch{}
       await writeFile(path.join(root,"count"),String(count+1));
       await writeFile(path.join(root,"physical.txt"),params.arguments.content);
       if(point==="inside_effect")process.exit(73);
       return {content:[{type:"text",text:JSON.stringify({ok:true})}]};
     });
   return result.reconciled?{content:[{type:"text",text:JSON.stringify(result.operation)}]}:
     {...result.value,_meta:{reconciliation_key:params._meta.reconciliation_key,operation_id:result.operation.operation_id}};
 }});
const engine=createPiReliableExecutionEngine({store,adapter,retryPolicy:{max_attempts:3,base_delay_ms:1,max_delay_ms:4},
 executionHook:async stage=>{if(point===stage)process.exit(73);}});
${extra||"console.log(JSON.stringify(await engine.execute(intent)));"}`;
  return exec(process.execPath,["--input-type=module","-e",code,root,point],{windowsHide:true,timeout:30000,maxBuffer:2*1024*1024});
}
for(const point of ["after_claim","before_dispatch","after_dispatch","after_receipt","retry_scheduled"]) {
  test("fresh process resumes after actual exit: "+point,async t=>{
    const root=await fixture(t);
    await assert.rejects(child(root,point),e=>e.code===73);
    const restored=JSON.parse((await child(root)).stdout);
    assert.equal(restored.state.status,"COMPLETED");
    assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
    assert.equal(await readFile(path.join(root,"physical.txt"),"utf8"),action.input.content);
    assert.equal(restored.receipts.length,1);
    if(point==="after_dispatch")assert.equal(restored.receipts[0].kind,"reconciled_facts");
    if(point==="after_receipt")assert.equal(restored.receipts[0].kind,"tool_response");
    const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
    assert.equal((await journal.status()).active_operation_count,0);
    assert.equal((await journal.status()).dangling_operation_count,0);
  });
}
test("concurrent processes admit and dispatch one physical mutation",async t=>{
  const root=await fixture(t);
  const results=await Promise.all([child(root),child(root)]);
  const records=results.map(x=>JSON.parse(x.stdout));
  assert.equal(records[0].state.operation_id,records[1].state.operation_id);
  const final=JSON.parse((await child(root)).stdout);
  assert.equal(final.state.status,"COMPLETED");assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
});
test("restart of both Pi and reconciliation provider retains original terminal receipt",async t=>{
  const root=await fixture(t);
  const first=JSON.parse((await child(root)).stdout),second=JSON.parse((await child(root)).stdout);
  assert.equal(first.revision,second.revision);assert.deepEqual(first.receipts,second.receipts);
  assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
});
for(const stage of ["before_events","after_started","after_completed","after_head"]) {
  test("publication interruption is proven and recovered: "+stage,async t=>{
    const root=await fixture(t);
    await assert.rejects(child(root,"publication:"+stage),e=>e.code===73);
    const r=JSON.parse((await child(root)).stdout);assert.equal(r.state.status,"COMPLETED");
    assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
    const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
    const status=await journal.status();assert.equal(status.health,"healthy");
    assert.equal(status.dangling_operation_count,0);
  });
}
test("physical effect without an MCP terminal acknowledgement never authorizes replay",async t=>{
  const root=await fixture(t);
  await assert.rejects(child(root,"inside_effect"),e=>e.code===73);
  try {
    const r=JSON.parse((await child(root)).stdout);
    assert(["DECISION_REQUIRED","BLOCKED","FAILED"].includes(r.state.status));
  } catch(e) {assert.match(e.message,/CORRUPT_STATE|degraded|reconciliation|recovery/i);}
  assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
});
test("live owner receives duplicate requests without parallel dispatch",async t=>{
  const root=await fixture(t),journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
  const store=createPiReliableExecutionStore({journal});let calls=0,release,announce;
  const waiting=new Promise(r=>{release=r;}),entered=new Promise(r=>{announce=r;});
  const a=createPiReliableMcpAdapter({resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),
    queryOperation:async p=>journal.getOperation(p),callTool:async()=>{calls++;announce();await waiting;return{ok:true};}});
  const running=createPiReliableExecutionEngine({store,adapter:a}).execute(sourceIntent);
  await entered;
  const duplicate=await createPiReliableExecutionEngine({store,adapter:a}).execute(sourceIntent);
  assert.equal(duplicate.state.status,"EXECUTING");assert.equal(calls,1);
  release();assert.equal((await running).state.status,"COMPLETED");
});
test("a late response cannot reuse a completed claim or change a terminal result",async t=>{
  const root=await fixture(t),result=JSON.parse((await child(root)).stdout);
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
  const store=createPiReliableExecutionStore({journal});
  await assert.rejects(store.command({operation_id:result.state.operation_id,context,expected_revision:result.revision,
    command:{type:"tool_call_completed",worker_id:"pi_worker_"+"a".repeat(32),
      call_id:result.state.tool_calls[0].call_id,receipt:result.receipts[0]}}),/TERMINAL_OPERATION/);
  assert.deepEqual((await store.inspect({operation_id:result.state.operation_id,context})).state,result.state);
});

async function events(root) {
  const directory=path.join(root,"journal","events");
  const names=(await readdir(directory)).sort();
  assert(names.every(x=>/^\d{12}-dev_journal_event_[a-f0-9]{32}\.json$/u.test(x)));
  return Promise.all(names.map(async name=>({file:path.join(directory,name),value:JSON.parse(await readFile(path.join(directory,name),"utf8"))})));
}
function eventHash(event) {
  const {event_hash,...body}=event;
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}
async function rewrite(entry) {
  entry.value.event_hash=eventHash(entry.value);
  await writeFile(entry.file,canonicalJson(entry.value)+"\n","utf8");
}
for(const point of ["after_recovery_event","before_recovery_head","after_recovery_head"]) {
  test("recovery itself can restart after "+point,async t=>{
    const root=await fixture(t);
    await assert.rejects(child(root,"publication:after_started"),e=>e.code===73);
    await assert.rejects(child(root,"publication:"+point),e=>e.code===73);
    const r=JSON.parse((await child(root)).stdout);assert.equal(r.state.status,"COMPLETED");
    assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
  });
}
test("schema-1 unpublished operations are not migrated or repaired",async t=>{
  const root=await fixture(t),legacyUrl=new URL("../../server/src/pi-execution-state-store.mjs",import.meta.url).href;
  await assert.rejects(child(root,"publication:after_started",
    `const {createPiExecutionStateStore}=await import(${JSON.stringify(legacyUrl)});await createPiExecutionStateStore({journal}).admit(intent);`),
    e=>e.code===73);
  await assert.rejects(child(root),/CORRUPT_STATE/);
  await assert.rejects(readFile(path.join(root,"count")),e=>e.code==="ENOENT");
});
for(const mode of ["live_owner","foreign_operation","truncated"]) {
  test("unproven publication tail stays fail-safe: "+mode,async t=>{
    const root=await fixture(t);await assert.rejects(child(root,"publication:after_started"),e=>e.code===73);
    const [entry]=await events(root);
    if(mode==="live_owner"){entry.value.diagnostic={owner_pid:process.pid,hostname:os.hostname()};await rewrite(entry);}
    else if(mode==="foreign_operation"){entry.value.operation_type="mcp_mutation";await rewrite(entry);}
    else await writeFile(entry.file,"{");
    await assert.rejects(child(root),/CORRUPT_STATE/);
    await assert.rejects(readFile(path.join(root,"count")),e=>e.code==="ENOENT");
  });
}
test("hash-valid unpublished pair cannot invent completed steps",async t=>{
  const root=await fixture(t);await assert.rejects(child(root,"publication:after_completed"),e=>e.code===73);
  const [started,completed]=await events(root),record=completed.value.execution_projection;
  record.state.pending_steps=[];record.state.completed_steps=["write"];
  const {projection_hash,...body}=record;
  record.projection_hash=createHash("sha256").update(canonicalJson(body)).digest("hex");
  const result={...completed.value.result,projection_hash:record.projection_hash,result_hash:hashExecutionInput(record.state)};
  started.value.result=result;completed.value.result=result;await rewrite(started);
  completed.value.previous_event_hash=started.value.event_hash;await rewrite(completed);
  await assert.rejects(child(root),/CORRUPT_STATE/);
  await assert.rejects(readFile(path.join(root,"count")),e=>e.code==="ENOENT");
});

for(const stage of ["after_started","after_completed"]) {
  test("mutation receipt publication resumes exactly once after "+stage,async t=>{
    const root=await fixture(t);
    await assert.rejects(child(root,"receipt_publication:"+stage),e=>e.code===73);
    const result=JSON.parse((await child(root)).stdout);
    assert.equal(result.state.status,"COMPLETED");assert.equal(result.receipts.length,1);
    assert.equal(await readFile(path.join(root,"count"),"utf8"),"1");
    assert.equal(result.receipts[0].kind,stage==="after_started"?"reconciled_facts":"tool_response");
    const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
    assert.equal((await journal.status()).dangling_operation_count,0);
  });
}
