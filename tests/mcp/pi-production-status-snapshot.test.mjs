import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController,projectVerifiedPiJournalHistory} from '../../server/src/pi-production-execution-controller.mjs';
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
  let fullHistoryValidations=0;
  // Instrument full-history iteration without altering event contents or hashes.
  // A filtered operation chain has the standard Array species, not this tracker.
  class TrackedHistory extends Array {
    static get [Symbol.species]() { return Array; }
    [Symbol.iterator]() { fullHistoryValidations++; return super[Symbol.iterator](); }
  }
  const bound={...journal,readExecutionProjections:async()=>{
    counts.projections++;const events=await journal.readExecutionProjections();
    if(corrupt&&events.length)events[0].execution_projection.projection_hash='f'.repeat(64);
    return TrackedHistory.from(events);
  },readProductionRoutes:async()=>{counts.routes++;return journal.readProductionRoutes();}};
  const route=createPiProductionRouteStore({journal:bound});
  await route.change({mode:'pi_default',expected_revision:0,decision_id:'gpt-status-snapshot',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
  const host=createPiProductionExecutionController({journal:bound,route,transport:{
    callTool:async()=>{counts.dispatch++;return {ok:true};},resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'}),
    queryOperation:async()=>({reconciliation_state:'unknown'})}});
  return {journal,host,counts,corrupt:()=>corrupt=true,
    fullHistoryValidations:()=>fullHistoryValidations,
    reset:()=>{counts.projections=0;counts.routes=0;counts.dispatch=0;fullHistoryValidations=0;}};
}
test('status validates one fresh execution and route snapshot without dispatch',async t=>{
  const f=await fixture(t),i=intent('status-snapshot-once'),created=await f.host.admit(i);f.reset();
  const result=await f.host.inspectStatus({operation_id:created.state.operation_id,context});
  assert.equal(result.operation.state.intent_hash,created.state.intent_hash);
  assert.equal(result.operation.state.status,'CREATED');assert.equal(result.route.mode,'pi_default');
  assert.deepEqual(f.counts,{projections:1,routes:1,dispatch:0});
});
test('status validates the full fresh history once per request, not twice',async t=>{
  const f=await fixture(t);
  const target=await f.host.admit(intent('status-full-scan-target'));
  await f.host.admit(intent('status-full-scan-unrelated'));
  f.reset();
  const first=await f.host.inspectStatus({operation_id:target.state.operation_id,context});
  assert.equal(first.operation.state.operation_id,target.state.operation_id);
  assert.equal(f.fullHistoryValidations(),1);
  assert.deepEqual(f.counts,{projections:1,routes:1,dispatch:0});
  f.reset();
  const second=await f.host.inspectStatus({operation_id:target.state.operation_id,context});
  assert.equal(second.operation.projection_hash,first.operation.projection_hash);
  assert.equal(f.fullHistoryValidations(),1,'a new request must verify its own fresh snapshot');
  f.corrupt();
  await assert.rejects(f.host.inspectStatus({operation_id:target.state.operation_id,context}),{code:'CORRUPT_STATE'});
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

test('real default production Journal uses one verified snapshot, preserves route updates and read-only failure',async t=>{
  // The test-only env variable is set BEFORE dynamic imports in a separate
  // process; no production Journal root is opened by this fixture.
  const serverSource=await readFile(new URL('../../server/src/mcp-server.mjs',import.meta.url),'utf8');
  assert.match(serverSource,/createPiProductionExecutionController\(\{\s*transport:/u,
    'production MCP entry must actually select the default authoritative route');
  const group=randomUUID();
  const containerRoot=path.join(os.tmpdir(),`writer-workbench-operation-journal-test-${group}`);
  t.after(async()=>{assert.equal(path.dirname(containerRoot),os.tmpdir());await rm(containerRoot,{recursive:true,force:true});});
  const source=`import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {initializeDevJournalRuntime,createDevOperationJournalService,DEV_JOURNAL_STORAGE_ROOT} from ${JSON.stringify(new URL('../../server/src/mcp-development-journal-tools.mjs',import.meta.url).href)};
import {createPiProductionRouteStore} from ${JSON.stringify(new URL('../../server/src/pi-production-execution-route.mjs',import.meta.url).href)};
import {createPiProductionExecutionController} from ${JSON.stringify(new URL('../../server/src/pi-production-execution-controller.mjs',import.meta.url).href)};
import {REQUIRED_DECISION_BOUNDARIES} from ${JSON.stringify(new URL('../../server/src/pi-execution-contract.mjs',import.meta.url).href)};
import {requestTraceChannel,runRequestTrace} from ${JSON.stringify(new URL('../../server/src/mcp-request-tracing.mjs',import.meta.url).href)};
await initializeDevJournalRuntime();
const journal=createDevOperationJournalService({storageRoot:DEV_JOURNAL_STORAGE_ROOT});
const route=createPiProductionRouteStore();
await route.change({mode:'pi_default',expected_revision:0,decision_id:'gpt-test-default-snapshot',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
const context=${JSON.stringify(context)};
const sourceIntent={schema_version:1,intent_id:'production-default-snapshot-test',goal:'No mutation; inspect one snapshot',context,
 constraints:['Fixture only'],requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'},depends_on:[]}],mutation_plan:[],
 verification:{focused:[],affected:[],full:[]},completion_conditions:['Inspect durable state'],
 permissions:{read:true,write:false,workspace_create:false,tests:false,commit:false,integrate:false,push:false},
 decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
const transport={callTool:async()=>{throw Error('STATUS_MUST_NOT_DISPATCH');},
 resolveWorkspace:async()=>({...context,state:'active',workspace_type:'isolated_worktree'}),
 queryOperation:async()=>({reconciliation_state:'unknown'})};
const host=createPiProductionExecutionController({transport});
const created=await host.admit(sourceIntent);
const trace=[];const listener=e=>trace.push(e);requestTraceChannel.subscribe(listener);
let before;
try{before=await runRequestTrace(randomUUID(),()=>host.inspectStatus({operation_id:created.state.operation_id,context}));}
finally{requestTraceChannel.unsubscribe(listener);}
assert.equal(before.operation.state.status,'CREATED');assert.equal(before.route.mode,'pi_default');
assert.equal(trace.filter(e=>e.stage==='journal.projection_read').length,1,'single verify() via default Journal');
assert.equal(trace.filter(e=>e.stage==='journal.route_read').length,0,'no independent route.verify()');
const injected=createPiProductionExecutionController({route:createPiProductionRouteStore(),transport});
const customTraces=[];const customListener=e=>customTraces.push(e);requestTraceChannel.subscribe(customListener);
try{await runRequestTrace(randomUUID(),()=>injected.inspectStatus({operation_id:created.state.operation_id,context}));}
finally{requestTraceChannel.unsubscribe(customListener);}
assert(customTraces.some(e=>e.stage==='journal.route_read'),'explicit route does NOT silently use the default Journal fast path');
await route.change({mode:'pi_paused',expected_revision:1,decision_id:'gpt-test-default-snapshot-pause',gate_hash:null},{validateGate:async()=>true});
const later=await host.inspectStatus({operation_id:created.state.operation_id,context});
assert.equal(later.route.mode,'pi_paused','fresh request sees new authoritative route');
const headPath=path.join(DEV_JOURNAL_STORAGE_ROOT,'head.json');
const headBefore=await readFile(headPath,'utf8');
const files=(await readdir(path.join(DEV_JOURNAL_STORAGE_ROOT,'events'))).sort();
const first=path.join(DEV_JOURNAL_STORAGE_ROOT,'events',files[0]);
await writeFile(first,(await readFile(first,'utf8'))+' ');
await assert.rejects(host.inspectStatus({operation_id:created.state.operation_id,context}));
assert.equal(await readFile(headPath,'utf8'),headBefore,'observational failure does not publish a new Journal head');
console.log(JSON.stringify({single_snapshot_traces:trace,route_updated:true,custom_route_uses_original_path:true,corruption_refused:true}));`;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',source],{
    env:{...process.env,WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL:'1',WRITER_WORKBENCH_TEST_JOURNAL_GROUP:group},
    windowsHide:true,timeout:120000,maxBuffer:1024*1024,
  });
  const observed=JSON.parse(stdout.trim());
  assert.equal(observed.route_updated,true);
  assert.equal(observed.custom_route_uses_original_path,true);
  assert.equal(observed.corruption_refused,true);
});

test('one verified Journal snapshot preserves execution and route semantics',async t=>{
  const f=await fixture(t),source=intent('unified-history-semantics');
  await f.host.admit(source);
  const before=await f.journal.status();
  const {projections,routes,route}=projectVerifiedPiJournalHistory((await f.journal.verify()).events);
  assert.deepEqual(projections,await f.journal.readExecutionProjections());
  assert.deepEqual(routes,await f.journal.readProductionRoutes());
  assert.equal(route.mode,'pi_default');
  const after=await f.journal.status();
  assert.equal(after.latest_sequence,before.latest_sequence);
  assert.equal(after.latest_event_hash,before.latest_event_hash);
  assert.equal(after.chain_verified,true);
});

test('snapshot semantic projection rejects changed data even after physical verification',async t=>{
  const f=await fixture(t);await f.host.admit(intent('unified-snapshot-corruption'));
  const raw=(await f.journal.verify()).events;
  const corruptPi=structuredClone(raw);
  const pi=corruptPi.find(e=>e.operation_type==='pi_execution_projection'&&e.stage==='operation_completed');
  assert(pi);pi.execution_projection.projection_hash='0'.repeat(64);
  assert.throws(()=>projectVerifiedPiJournalHistory(corruptPi),{code:'CORRUPT_STATE'});
  const missing=structuredClone(raw);
  delete missing.find(e=>e.operation_type==='pi_execution_projection'&&e.stage==='operation_completed').execution_projection;
  assert.throws(()=>projectVerifiedPiJournalHistory(missing),{code:'CORRUPT_STATE'});
  const corruptRoute=structuredClone(raw);
  const route=corruptRoute.find(e=>e.operation_type==='pi_production_route'&&e.stage==='operation_completed');
  assert(route);route.result.route_record='{}';
  assert.throws(()=>projectVerifiedPiJournalHistory(corruptRoute),{code:'CORRUPT_ROUTE_STATE'});
});

test('explicitly injected route remains authoritative, not the production default snapshot',async t=>{
  const f=await fixture(t),i=intent('injected-route-remains-authoritative');
  await f.host.admit(i);f.reset();
  const result=await f.host.inspectStatus({intent_id:i.intent_id,context});
  assert.equal(result.route.mode,'pi_default');
  assert.deepEqual(f.counts,{projections:1,routes:1,dispatch:0});
});
