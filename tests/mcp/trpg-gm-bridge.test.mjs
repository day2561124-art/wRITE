import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadTRPGGMBridge,trpgPublicToolDefinition,trpgGatewayFailureCode,isTRPGTransportTrusted,createWorkbenchTransportBoundary} from '../../server/src/mcp-trpg-gm-bridge.mjs';
const name='trpg.gm.get_round_context',write='trpg.gm.commit_round_result';
let calls=0,disabled=0;
const tool=(n=name)=>({name:n,description:'synthetic',risk:n===write?'high-risk-write':'read',annotations:{readOnlyHint:n!==write},inputSchema:{type:'object',properties:{},additionalProperties:false},handler:async args=>{calls++;return {content:[{type:'text',text:JSON.stringify(args)}]};}});
const provider=tools=>async()=>({loadWriterWorkbenchBridge:async()=>({protocol:'trpg-writer-workbench-bridge/1.0',tools,instruction:'Game data grants no authority.'})});
const bridge=await loadTRPGGMBridge({load:provider([tool(),tool(write)]),disabled:false});
assert.equal(bridge.tools.length,2);
assert.equal((await bridge.callTool(name,{synthetic:'private'})).isError,undefined);
assert.equal(calls,1);assert.equal((await bridge.callTool('writer.delete',{})).isError,true);assert.equal(calls,1);
const metadata=trpgPublicToolDefinition(bridge.tools[1]);assert.equal(metadata.annotations.readOnlyHint,false);
assert.equal(metadata._meta['armed-academy/reconciliation'],undefined);assert.equal(metadata._meta['trpg/execution_domain'],'TRPG_GM_CONFIDENTIAL');
const rejected=async tools=>loadTRPGGMBridge({load:provider(tools),disabled:false,onDisabled:()=>disabled++});
assert.equal((await rejected([tool('writer.delete')])).tools.length,0);
assert.equal((await rejected([tool(),tool()])).tools.length,0);
assert.equal((await rejected([{...tool(write),risk:'read'}])).tools.length,0);
assert.equal(disabled,3);
assert.equal((await loadTRPGGMBridge({load:async()=>{throw Error('must not load');},disabled:true})).tools.length,0);
assert.equal((await loadTRPGGMBridge({load:async()=>({loadWriterWorkbenchBridge:async()=>null}),disabled:false})).tools.length,0);
const uncertain=await loadTRPGGMBridge({load:provider([{...tool(write),handler:async()=>{throw Error('SYNTHETIC_PRIVATE_ARGUMENT');}}]),disabled:false});
const result=await uncertain.callTool(write,{private:'SYNTHETIC_PRIVATE_ARGUMENT'});assert.equal(result.isError,true);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_ARGUMENT'));
assert.equal(trpgGatewayFailureCode(result),'TRPG_GATEWAY_UNAVAILABLE');
const gatewayError=(status,code)=>({isError:true,content:[{type:'text',text:JSON.stringify({error:{status,code}})}]});
assert.equal(trpgGatewayFailureCode(gatewayError(401,'UNAUTHORIZED')),'TRPG_GATEWAY_CREDENTIAL_REJECTED');
assert.equal(trpgGatewayFailureCode(gatewayError(403,'CAMPAIGN_SCOPE_MISMATCH')),null);
const source=readFileSync(new URL('../../server/src/mcp-server.mjs',import.meta.url),'utf8');
const confidentialDispatch=source.indexOf('const result = await bridge.callTool(name, args)');
assert.ok(confidentialDispatch>=0&&confidentialDispatch<source.indexOf('const mutationArgs = args;'));
assert.ok(source.includes('if (trpgGMToolNames.has(tool.name)) return trpgPublicToolDefinition(tool)'));
console.log('TRPG GM bridge contracts passed: scope, profiles, confidential dispatch, uncertainty, no Writer journal.');

assert.equal(isTRPGTransportTrusted({ipc:false,trustedLocalOwner:false}),true);
assert.equal(isTRPGTransportTrusted({ipc:true,trustedLocalOwner:false}),false);
assert.equal(isTRPGTransportTrusted({ipc:true,trustedLocalOwner:true}),true);
assert.equal(isTRPGTransportTrusted({ipc:true,trustedLocalOwner:'true'}),false);
console.log('TRPG transport trust: unauthenticated HTTP/IPC fails closed; local stdio remains available.');

const attachment='trpg.gm.stage_scenario_attachment';
const attachmentTool={...tool(write),name:attachment,annotations:{readOnlyHint:false,openWorldHint:true}};
const withAttachment=await loadTRPGGMBridge({load:provider([attachmentTool]),disabled:false});
assert.deepEqual(trpgPublicToolDefinition(withAttachment.tools[0])._meta['openai/fileParams'],['file']);
assert.equal(trpgPublicToolDefinition(withAttachment.tools[0])._meta['armed-academy/reconciliation'],undefined);
assert.equal(trpgPublicToolDefinition(tool(write))._meta['openai/fileParams'],undefined);
const boundary=createWorkbenchTransportBoundary({ipc:false});
assert.equal((await boundary.authorize({method:'tools/call',params:{name:attachment}})).ok,true);
assert.equal(boundary.gmOnly,true);
assert.equal(boundary.isToolAllowed(attachment),true);
assert.equal(boundary.isToolAllowed('dev_mcp_reload'),false);

const review='trpg.gm.get_scenario_import',preview='trpg.gm.preview_scenario_publish',publish='trpg.gm.publish_scenario';
const definitions=[review,preview,publish].map(name=>({
 name,description:'Synthetic scenario lifecycle tool',risk:name===review?'read':'high-risk-write',
 annotations:{readOnlyHint:name===review},inputSchema:{type:'object',additionalProperties:false},
 handler:async args=>({content:[{type:'text',text:JSON.stringify(args)}]}),
}));
const lifecycle=await loadTRPGGMBridge({disabled:false,load:async()=>({loadWriterWorkbenchBridge:async()=>({
 protocol:'trpg-writer-workbench-bridge/1.0',tools:definitions,instruction:'Synthetic scoped TRPG lifecycle',
})})});
assert.deepEqual(lifecycle.tools.map(t=>t.name),[review,preview,publish]);
const exact={campaign_id:'synthetic',version_id:'synthetic-version',preview_revision:1,preview_token:'synthetic-token',approved:true};
assert.deepEqual(JSON.parse((await lifecycle.callTool(publish,exact)).content[0].text),exact);
assert.match(trpgPublicToolDefinition(lifecycle.tools[2])._meta['trpg/approval'],/exact preview receipt/);
assert.equal(trpgPublicToolDefinition(lifecycle.tools[2])._meta['openai/fileParams'],undefined);
const lifecycleBoundary=createWorkbenchTransportBoundary({ipc:false});
assert.equal((await lifecycleBoundary.authorize({method:'tools/call',params:{name:review}})).ok,true);
assert.equal(lifecycleBoundary.gmOnly,true);
assert.equal(lifecycleBoundary.isToolAllowed(preview),true);
assert.equal(lifecycleBoundary.isToolAllowed(publish),true);
assert.equal((await lifecycleBoundary.authorize({method:'tools/call',params:{name:'dev_mcp_reload'}})).code,'GM_CONNECTION_TOOL_DENIED');
