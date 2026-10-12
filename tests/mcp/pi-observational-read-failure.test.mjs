import assert from 'node:assert/strict';
import test from 'node:test';
import {createPiProductionExecutionController} from '../../server/src/pi-production-execution-controller.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
const args={operation_id:'pi_operation_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',context:{project_id:'writer_workbench',workstream_id:null,workspace_id:'dev_workspace_shared_repository_v1'}};
function fault({code='EIO',recoverMakesReadable=false}={}){
 const failure=Object.assign(new Error('precise isolated projection read failure'),{code});
 const counts={reads:0,recovery:0,append:0,dispatch:0,route:0};let recovered=false;
 const journal={
  readExecutionProjections:async()=>{counts.reads++;if(recovered&&recoverMakesReadable)return [];throw failure;},
  appendExecutionProjection:async()=>{counts.append++;throw new Error('Unexpected append');},
  recoverExecutionPublication:async options=>{counts.recovery++;assert.equal(typeof options.validateHistory,'function');recovered=true;}
 };
 const route={inspect:async()=>{counts.route++;throw new Error('Unexpected route read');},history:async()=>{counts.route++;throw new Error('Unexpected route read');}};
 const host=createPiProductionExecutionController({journal,route,transport:{callTool:async()=>{counts.dispatch++;throw new Error('Unexpected dispatch');},resolveWorkspace:async()=>{throw new Error('Unexpected scope dispatch');}}});
 return {failure,counts,journal,host};
}
for(const method of ['status','inspectStatus','inspect']){
 test(`observational ${method} never repairs after projection EIO`,async()=>{
  const f=fault();let caught;
  try{await f.host[method](args);}catch(e){caught=e;}
  assert.equal(f.counts.recovery,0,'Read-only entry invoked publication recovery');
  assert.equal(caught,f.failure,'Preserve exact cause for authorized diagnostics');
  assert.deepEqual(f.counts,{reads:1,recovery:0,append:0,dispatch:0,route:0});
 });
}
test('observational store option refuses implicit recovery and preserves exact error',async()=>{
 const f=fault();const store=createPiReliableExecutionStore({journal:f.journal,recoverOnReadFailure:false});let caught;
 try{await store.readHistory();}catch(e){caught=e;}
 assert.equal(f.counts.recovery,0);assert.equal(caught,f.failure);assert.equal(f.counts.reads,1);
});
test('observational status lock contention remains an unrecovered read failure',async()=>{
 const f=fault({code:'JOURNAL_LOCK_CONTENDED'});await assert.rejects(f.host.status(),e=>e===f.failure);
 assert.deepEqual(f.counts,{reads:1,recovery:0,append:0,dispatch:0,route:0});
});
test('existing explicit writer store recovery remains available',async()=>{
 const f=fault({recoverMakesReadable:true});const store=createPiReliableExecutionStore({journal:f.journal});
 assert.deepEqual(await store.readHistory(),[]);
 assert.deepEqual(f.counts,{reads:2,recovery:1,append:0,dispatch:0,route:0});
});
test('explicit mutating reconciliation preserves its prior publication recovery path',async()=>{
 const f=fault({recoverMakesReadable:true});await assert.rejects(f.host.reconcileOnly(args),{code:'UNKNOWN_PI_OPERATION'});
 assert.deepEqual(f.counts,{reads:2,recovery:1,append:0,dispatch:0,route:0});
});
test('invalid recovery read policy cannot become a truthy recovery switch',()=>{
 const f=fault();assert.throws(()=>createPiReliableExecutionStore({journal:f.journal,recoverOnReadFailure:'false'}),{code:'INVALID_STATE_STORE_BINDING'});
 assert.deepEqual(f.counts,{reads:0,recovery:0,append:0,dispatch:0,route:0});
});
