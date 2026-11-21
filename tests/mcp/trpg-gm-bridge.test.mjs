import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTRPGGMBridgeRegistration,loadTRPGGMBridge,trpgPublicToolDefinition,isTRPGTransportTrusted,createWorkbenchTransportBoundary} from '../../server/src/mcp-trpg-gm-bridge.mjs';
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
const source=readFileSync(new URL('../../server/src/mcp-server.mjs',import.meta.url),'utf8');
assert.ok(source.includes('chatgptDeveloperToolNames.add(tool.name)'));
assert.ok(source.indexOf('return trpgGMRegistration.current.callTool(name, args)')<source.indexOf('const mutationArgs = args;'));
assert.ok(source.includes('if (trpgGMToolNames.has(tool.name)) return trpgPublicToolDefinition(tool)'));

const registered=new Map();
const failures=[];
let attempts=0;
const registration=createTRPGGMBridgeRegistration({enabled:true,
 register:tools=>{for(const t of tools){assert.equal(registered.has(t.name),false);registered.set(t.name,t);}},
 load:()=>loadTRPGGMBridge({disabled:false,onDisabled:reason=>failures.push(reason),load:async()=>{
  attempts++;
  if(attempts===1)throw Error('GATEWAY_AUTHORIZATION_FAILED');
  if(attempts===2)throw Error('SYNTHETIC_PRIVATE_CONFIGURATION');
  return provider([tool(),tool(write)])();
 }}),
});
assert.equal(registration.current.status,'disabled');
const [first,concurrent]=await Promise.all([registration.ensure(),registration.ensure()]);
assert.equal(first,concurrent);
assert.equal(first.status,'unavailable');
assert.equal(attempts,1);
assert.equal(registered.size,0);
assert.equal((await registration.ensure()).status,'unavailable');
assert.deepEqual(failures,['GATEWAY_AUTHORIZATION_FAILED','BRIDGE_LOAD_FAILED']);
assert.equal((await registration.ensure()).status,'ready');
assert.deepEqual([...registered.keys()],[name,write]);
assert.equal((await registration.current.callTool(name,{})).isError,undefined);
assert.equal(await registration.ensure(),registration.current);
assert.equal(attempts,3);

const excluded=createTRPGGMBridgeRegistration({enabled:false,load:()=>assert.fail('disabled profile loaded GM provider'),register:()=>assert.fail('disabled profile registered GM tools')});
assert.equal((await excluded.ensure()).status,'disabled');
assert.deepEqual(excluded.current.tools,[]);
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
