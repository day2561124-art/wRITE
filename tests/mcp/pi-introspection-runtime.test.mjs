import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController} from '../../server/src/pi-production-execution-controller.mjs';
import {createPiCapabilityIntrospection} from '../../server/src/pi-capability-introspection.mjs';
import {createPiLifecycleScopeVerifier} from '../../server/src/pi-lifecycle-scope.mjs';
import {createExecutionIntent,REQUIRED_DECISION_BOUNDARIES,hashExecutionInput} from '../../server/src/pi-execution-contract.mjs';
const context={project_id:'writer_workbench',workstream_id:'dev_workstream_20261003-153931_7730524b821e',workspace_id:'dev_workspace_65ed265de3494399b7ad40b2'};
const opId='dev_operation_'+'a'.repeat(32);
function request(pins={}){const input={path:'scripts/probe.mjs',content:'// GPT exact bytes\n'};
return {schema_version:1,intent_id:'runtime-pin-'+hashExecutionInput(pins).slice(0,12),goal:'Apply GPT-selected bytes with explicit capability expectations',context,
 constraints:['No tool replacement'],requested_actions:[{step_id:'write',capability:'filesystem.write',input,idempotency_key:'runtime-write-key-001',...pins}],
 mutation_plan:[{step_id:'write',target:input.path,expected_change:'Exact authored bytes',input_sha256:hashExecutionInput(input)}],verification:{focused:[],affected:[],full:[]},completion_conditions:['GPT reviews facts'],
 permissions:{read:true,workspace_create:false,write:true,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};}
function metadata(overrides={}){return createPiCapabilityIntrospection({definitions:[{capability_name:'filesystem.write',active_version:'1',versions:[{capability_version:'1',risk_class:'low-risk-write',input_schema:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false},output_schema:{type:'object',additionalProperties:true},deprecated:false,replacement_capability:null,route_policy:'pi_default_intent',pi_dispatchable:true,...overrides}]}]});}
async function fixture(api){const root=await mkdtemp(path.join(os.tmpdir(),'pi-schema-pins-'));const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});const route=createPiProductionRouteStore({journal:j});
 await route.change({mode:'pi_default',decision_id:'gpt-pinned-fixture',gate_hash:'a'.repeat(64),expected_revision:0},{validateGate:async()=>true});
 let calls=0;const controller=createPiProductionExecutionController({journal:j,route,transport:{callTool:async()=>{calls++;return {ok:true};},queryOperation:async args=>({...args,reconciliation_state:'unknown'}),resolveWorkspace:async()=>({...context,workspace_type:'isolated_worktree',state:'active'}),validateCapabilityExpectation:args=>api.validateExpectation(args)}});
 return {j,route,controller,calls:()=>calls};}
test('matching schema pins execute once and terminal duplicate has zero dispatch',async()=>{
 const api=metadata();const s=api.getSchema({capability_name:'filesystem.write'});const f=await fixture(api);const i=request({expected_capability_version:s.capability_version,expected_schema_hash:s.schema_hash});
 const r=await f.controller.execute(i);assert.equal(r.state.status,'COMPLETED');assert.equal(f.calls(),1);const duplicate=await f.controller.execute(i);assert.equal(duplicate.projection_hash,r.projection_hash);assert.equal(f.calls(),1);
 assert.equal((await f.j.status()).health,'healthy');assert.equal((await f.route.inspect()).mode,'pi_default');
});
for(const [code,pins,override] of [
 ['CAPABILITY_SCHEMA_DRIFT',{expected_capability_version:'1',expected_schema_hash:'b'.repeat(64)},{}],
 ['CAPABILITY_VERSION_DRIFT',{expected_capability_version:'2',expected_schema_hash:'b'.repeat(64)},{}],
 ['CAPABILITY_DEPRECATED',{expected_capability_version:'1',expected_schema_hash:'b'.repeat(64)},{deprecated:true}],
])test(code+' escalates before mutation without argument repair or replay',async()=>{const f=await fixture(metadata(override));const r=await f.controller.execute(request(pins));assert.equal(r.state.status,'DECISION_REQUIRED');assert.equal(r.state.last_error.code,code);assert.equal(f.calls(),0);assert.deepEqual(r.state.completed_steps,[]);});
test('historical intent without pins retains normal execution',async()=>{const f=await fixture(metadata());assert.equal((await f.controller.execute(request())).state.status,'COMPLETED');assert.equal(f.calls(),1);});
test('incomplete pins and unknown capability fail admission without auto-selection',()=>{
 assert.throws(()=>createExecutionIntent(request({expected_capability_version:'1'})),/CAPABILITY_EXPECTATION_REQUIRED/);
 const i=request();i.requested_actions[0].capability='filesystem.guess_fix';assert.throws(()=>createExecutionIntent(i),/UNKNOWN_CAPABILITY/);
});
test('blocked recovery requires matching durable resolution; paused remains legal',async()=>{
 const workstream={...context,state:'blocked',revision:5,metadata:{blocker_operation_id:opId}};
 const proof={...context,operation_id:opId,terminal:true,reconciliation_state:'no_effect',resolution_event_id:'dev_journal_event_'+'b'.repeat(32)};
 const make=(p=proof)=>createPiLifecycleScopeVerifier({getWorkstream:async()=>workstream,getCheckpoint:async()=>null,getOperation:async()=>p});
 const step={tool:'dev_workspace_update_workstream',scope:'workstream_update',arguments:{workstream_id:context.workstream_id,expected_revision:5,state:'active'}};
 assert.equal(await make()({context,step}),false);
 const authorized={...step,arguments:{...step.arguments,blocker_resolution_operation_id:opId}};
 assert.equal(await make()({context,step:authorized}),true);
 for(const p of [{...proof,reconciliation_state:'recovery_required'},{...proof,resolution_event_id:null},{...proof,workspace_id:'other'},{...proof,terminal:false}])assert.equal(await make(p)({context,step:authorized}),false);
 workstream.state='paused';assert.equal(await make()({context,step}),true);
});
