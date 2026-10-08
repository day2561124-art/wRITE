import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController} from '../../server/src/pi-production-execution-controller.mjs';
import {REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';

const context={project_id:'writer_workbench',workstream_id:'dev_workstream_20261003-153931_7730524b821e',workspace_id:'dev_workspace_65ed265de3494399b7ad40b2'};
const intent=id=>({schema_version:1,intent_id:id,goal:'Inspect precise durable state',context,constraints:['Preserve scope'],
  requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'},depends_on:[]}],
  mutation_plan:[],verification:{focused:[],affected:[],full:[]},completion_conditions:['Observe durable state'],
  permissions:{read:true,write:false,workspace_create:false,tests:false,commit:false,integrate:false,push:false},
  decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]});
async function fixture(t){
  const root=await mkdtemp(path.join(os.tmpdir(),'pi-status-snapshot-'));
  t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  const journal=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
  const counts={projections:0,routes:0,dispatch:0};let corrupt=false;
  const bound={...journal,readExecutionProjections:async()=>{
    counts.projections++;const events=await journal.readExecutionProjections();
    if(corrupt&&events.length)events[0].execution_projection.projection_hash='f'.repeat(64);
    return events;
  },readProductionRoutes:async()=>{counts.routes++;return journal.readProductionRoutes();}};
  const route=createPiProductionRouteStore({journal:bound});
  await route.change({mode:'pi_default',expected_revision:0,decision_id:'gpt-status-snapshot',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
  const host=createPiProductionExecutionController({journal:bound,route,transport:{
    callTool:async()=>{counts.dispatch++;return {ok:true};},resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'}),
    queryOperation:async()=>({reconciliation_state:'unknown'})}});
  return {journal,host,counts,corrupt:()=>corrupt=true,reset:()=>{counts.projections=0;counts.routes=0;counts.dispatch=0;}};
}
test('status validates one fresh execution and route snapshot without dispatch',async t=>{
  const f=await fixture(t),i=intent('status-snapshot-once'),created=await f.host.admit(i);f.reset();
  const result=await f.host.inspectStatus({operation_id:created.state.operation_id,context});
  assert.equal(result.operation.state.intent_hash,created.state.intent_hash);
  assert.equal(result.operation.state.status,'CREATED');assert.equal(result.route.mode,'pi_default');
  assert.deepEqual(f.counts,{projections:1,routes:1,dispatch:0});
});
test('a later status sees completed durable state rather than an earlier snapshot',async t=>{
  const f=await fixture(t),i=intent('status-snapshot-fresh'),created=await f.host.admit(i);
  const before=await f.host.inspectStatus({intent_id:i.intent_id,context});assert.equal(before.operation.state.status,'CREATED');
  const completed=await f.host.execute(i);f.reset();
  const after=await f.host.inspectStatus({intent_id:i.intent_id,context});
  assert.equal(after.operation.state.operation_id,created.state.operation_id);
  assert.equal(after.operation.revision,completed.revision);assert.equal(after.operation.state.status,'COMPLETED');
  assert.deepEqual(f.counts,{projections:1,routes:1,dispatch:0});
});
test('parallel status calls have independent snapshots and context remains enforced',async t=>{
  const f=await fixture(t),i=intent('status-snapshot-parallel');await f.host.admit(i);f.reset();
  const results=await Promise.all([f.host.inspectStatus({intent_id:i.intent_id,context}),f.host.inspectStatus({intent_id:i.intent_id,context})]);
  assert.equal(results[0].operation.projection_hash,results[1].operation.projection_hash);
  assert.deepEqual(f.counts,{projections:2,routes:2,dispatch:0});
  await assert.rejects(f.host.inspectStatus({intent_id:i.intent_id,context:{...context,workspace_id:'dev_workspace_000000000000000000000000'}}),{code:'WORKSPACE_CONTEXT_MISMATCH'});
});
test('a subsequent corrupt history still fails closed; no cached success',async t=>{
  const f=await fixture(t),i=intent('status-snapshot-corruption');await f.host.admit(i);
  await f.host.inspectStatus({intent_id:i.intent_id,context});f.corrupt();
  await assert.rejects(f.host.inspectStatus({intent_id:i.intent_id,context}),{code:'CORRUPT_STATE'});
});
