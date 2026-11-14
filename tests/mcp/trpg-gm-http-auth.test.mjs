import assert from 'node:assert/strict';
import {createWorkbenchTransportBoundary,isTRPGTransportTrusted} from '../../server/src/mcp-trpg-gm-bridge.mjs';
let loads=0,checks=0,active=true,closed=0;
const loadSecurity=async()=>{loads++;return {verifier:{authorize:async({authorization})=>{checks++;return active&&authorization==='Bearer SYNTHETIC_VALID_PROOF'?{ok:true,principal:{key:'opaque-owner'}}:{ok:false,code:'INVALID_TOKEN'};}},close(){closed++;}};};
const message=(name,meta={})=>({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{},_meta:meta}}),proof={workbench_http_access_token:'SYNTHETIC_VALID_PROOF'};
const remote=createWorkbenchTransportBoundary({ipc:true,trustedLocalOwner:false,loadSecurity});
assert.equal(remote.local,false);
assert.equal((await remote.authorize(message('dev_read_file',{authenticatedHttp:true,trustedLocalOwner:true}))).ok,false);assert.equal(loads,0);
assert.equal((await remote.authorize(message('dev_read_file',{workbench_http_access_token:'FORGED'}))).ok,false);assert.equal(checks,1);
assert.equal((await remote.authorize(message('dev_read_file',proof))).ok,true);assert.equal(loads,1);assert.equal(remote.gmOnly,false);
active=false;assert.equal((await remote.authorize(message('dev_read_file',proof))).ok,false);active=true;
assert.equal((await remote.authorize(message('trpg.gm.get_round_context',proof))).ok,true);assert.equal(remote.gmOnly,true);
assert.equal((await remote.authorize(message('dev_read_file',{...proof,workbench_purpose:'WORKBENCH'}))).code,'GM_CONNECTION_TOOL_DENIED');assert.equal(remote.isToolAllowed('dev_read_file'),false);
assert.equal((await remote.authorize({jsonrpc:'2.0',id:2,method:'resources/read',params:{_meta:proof}})).code,'GM_CONNECTION_METHOD_DENIED');
assert.equal((await remote.authorize(message('trpg.gm.commit_round_result',proof))).ok,true);remote.close();assert.equal(closed,1);
for(const loader of [async()=>null,async()=>{throw Error('SYNTHETIC_PRIVATE_DIAGNOSTICS');}]){
 const boundary=createWorkbenchTransportBoundary({ipc:true,trustedLocalOwner:false,loadSecurity:loader});assert.deepEqual(await boundary.authorize(message('dev_read_file',proof)),{ok:false,code:'AUTHENTICATION_UNAVAILABLE'});
}
const local=createWorkbenchTransportBoundary({ipc:true,trustedLocalOwner:true,loadSecurity:async()=>{throw Error('MUST_NOT_LOAD');}});assert.equal((await local.authorize(message('dev_read_file'))).ok,true);
assert.equal(isTRPGTransportTrusted({ipc:true,authenticatedHttp:true}),false);
let principal='first';const bound=createWorkbenchTransportBoundary({ipc:true,trustedLocalOwner:false,loadSecurity:async()=>({verifier:{authorize:async()=>({ok:true,principal:{key:principal}})}})});
assert.equal((await bound.authorize(message('dev_read_file',proof))).ok,true);principal='second';assert.equal((await bound.authorize(message('dev_read_file',proof))).code,'MCP_SESSION_OWNER_MISMATCH');
console.log('Workbench IPC OAuth boundary: proof per request, revocation, owner binding, GM tool/method lock, fail closed, local CLI trust only.');

const {createWorkbenchTransportContext}=await import('../../server/src/mcp-http-stdio-adapter.mjs');
const context=createWorkbenchTransportContext(),lifecycle={jsonrpc:'2.0',id:'synthetic-recovery',method:'initialize',params:{_meta:{workbench_http_access_token:'OLD'}}};
assert.equal(context.apply(lifecycle),lifecycle);
context.capture({params:{_meta:{workbench_http_access_token:'FIRST',workbench_purpose:'GM'}}});
context.capture({params:{_meta:{workbench_http_access_token:'REFRESHED',workbench_purpose:'WORKBENCH'}}});
const recovered=context.apply(lifecycle);assert.equal(recovered.params._meta.workbench_http_access_token,'REFRESHED');assert.equal(recovered.params._meta.workbench_purpose,'GM');assert.equal(lifecycle.params._meta.workbench_http_access_token,'OLD');
assert.equal(context.apply({method:'tools/list'}).params._meta.workbench_http_access_token,'REFRESHED');
console.log('Lifecycle replay uses latest proof and preserves monotonic GM purpose without mutating original requests.');
