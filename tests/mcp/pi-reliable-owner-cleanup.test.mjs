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
  t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith("pi-reliable-"));await rm(root,{recursive:true,force:true});});
  const journal=createDevOperationJournalService({storageRoot:path.join(root,"journal")});
  const store=createPiReliableExecutionStore({journal,...options});
  return {root,journal,store};
}
function adapter(callTool, queryOperation=async()=>({reconciliation_state:"not_admitted",safe_same_key_retry:true}), extra={}) {
  return createPiReliableMcpAdapter({callTool,queryOperation,
    resolveWorkspace:async()=>({...context,workspace_type:"isolated_worktree",state:"active"}),...extra});
}
const timeout=()=>Object.assign(new Error("secret transport details"),{code:"TIMEOUT"});

function engine(store,a,options={}) { return createPiReliableExecutionEngine({store,adapter:a,...options}); }
const failure=()=>Object.assign(new Error('injected append lock failure'),{code:'JOURNAL_APPEND_BUSY'});
async function latest(f){return (await f.store.readHistory()).at(-1).execution_projection;}
test('pre-dispatch persistence failure releases only the executing worker and preserves original error',async t=>{
 const f=await fixture(t);const err=failure();let dispatched=0;
 const s={...f.store,command:async args=>{if(args.command.type==='phase_changed'&&args.command.status==='PREPARING')throw err;return f.store.command(args);}};
 await assert.rejects(engine(s,adapter(async()=>{dispatched++;})).execute(intent()),e=>e===err);
 const r=await latest(f);assert.equal(r.state.status,'ADMITTED');assert.equal(r.runtime.owner,null);assert.equal(r.runtime.active_call,null);
 assert.equal(dispatched,0);assert.deepEqual(r.state.tool_calls,[]);assert.equal(r.command.type,'owner_released');
 assert.equal((await f.journal.status()).health,'healthy');
});
test('failure after a durable claim never releases or rewrites the unknown call',async t=>{
 const f=await fixture(t);const err=failure();let dispatched=0;
 await assert.rejects(engine(f.store,adapter(async()=>{dispatched++;}),{executionHook:async point=>{if(point==='after_claim')throw err;}}).execute(intent([write])),e=>e===err);
 const r=await latest(f);assert.ok(r.runtime.owner);assert.ok(r.runtime.active_call?.mutation);assert.equal(r.command.type,'tool_call_started');assert.equal(dispatched,0);
 assert.equal(r.receipts,undefined);assert.deepEqual(r.state.tool_results,[]);
});
test('committed claim with a lost publication response is discovered before cleanup',async t=>{
 const f=await fixture(t);const err=failure();let dispatched=0;
 const s={...f.store,command:async args=>{const r=await f.store.command(args);if(args.command.type==='tool_call_started')throw err;return r;}};
 await assert.rejects(engine(s,adapter(async()=>{dispatched++;})).execute(intent([write])),e=>e===err);
 const r=await latest(f);assert.ok(r.runtime.owner);assert.ok(r.runtime.active_call?.mutation);assert.equal(r.command.type,'tool_call_started');assert.equal(dispatched,0);
});
test('a fresh foreign owner is never released by exception cleanup',async t=>{
 const f=await fixture(t,{isOwnerAlive:async()=>false});const err=failure();const foreign={worker_id:'pi_worker_'+'b'.repeat(32),pid:1,hostname:os.hostname()};
 const s={...f.store,command:async args=>{if(args.command.type==='phase_changed'){
  const r=await f.store.inspect(args);await f.store.command({...args,command:{type:'owner_acquired',owner:foreign,replaced_worker_id:r.runtime.owner.worker_id}});throw err;
 }return f.store.command(args);}};
 await assert.rejects(engine(s,adapter(async()=>{throw Error('unexpected dispatch');})).execute(intent()),e=>e===err);
 assert.deepEqual((await latest(f)).runtime.owner,foreign);
});
test('cleanup append failure retains the owner and does not replace the original exception',async t=>{
 const f=await fixture(t);const err=failure();let releases=0;
 const s={...f.store,command:async args=>{if(args.command.type==='phase_changed')throw err;if(args.command.type==='owner_released'){releases++;throw Error('cleanup unavailable');}return f.store.command(args);}};
 await assert.rejects(engine(s,adapter(async()=>{})).execute(intent()),e=>e===err);
 assert.equal(releases,1);assert.ok((await latest(f)).runtime.owner);
});
test('cleanup revision CAS refuses a new claim arriving after inspection',async t=>{
 const f=await fixture(t);const err=failure();let releases=0;
 const s={...f.store,command:async args=>{
  if(args.command.type==='phase_changed'&&args.command.status==='PREPARING')throw err;
  if(args.command.type==='owner_released'){
   releases++;let r=await f.store.inspect(args);
   for(const status of ['PREPARING','EXECUTING'])r=await f.store.command({...args,expected_revision:r.revision,command:{type:'phase_changed',worker_id:r.runtime.owner.worker_id,status}});
   await f.store.command({...args,expected_revision:r.revision,command:{type:'tool_call_started',worker_id:r.runtime.owner.worker_id,call_id:'pi_call_'+'c'.repeat(32),step_id:'write'}});
  }return f.store.command(args);
 }};
 await assert.rejects(engine(s,adapter(async()=>{})).execute(intent([write])),e=>e===err);
 const r=await latest(f);assert.equal(releases,1);assert.ok(r.runtime.owner);assert.ok(r.runtime.active_call?.mutation);assert.equal(r.command.type,'tool_call_started');
});
test('failed owner acquisition response can release its own committed unclaimed worker',async t=>{
 const f=await fixture(t);const err=failure();let dispatched=0;
 const s={...f.store,command:async args=>{const r=await f.store.command(args);if(args.command.type==='owner_acquired')throw err;return r;}};
 await assert.rejects(engine(s,adapter(async()=>{dispatched++;})).execute(intent()),e=>e===err);
 const r=await latest(f);assert.equal(r.runtime.owner,null);assert.equal(r.runtime.active_call,null);assert.equal(dispatched,0);
});
