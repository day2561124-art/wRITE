import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdir,mkdtemp,copyFile,writeFile,readFile,access,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const gmNames=['get_round_context','get_pending_actions','get_character_context','get_scenario_context','get_asset_metadata','claim_round','commit_round_result'].map(name=>'trpg.gm.'+name);
const files=['mcp-session-profile.mjs','mcp-http-server.mjs','mcp-http-sse-keepalive.mjs','mcp-http-identity.mjs','mcp-http-integration-control.mjs','mcp-http-stdio-adapter.mjs','mcp-runtime-diagnostics.mjs','mcp-runtime-readiness.mjs','mcp-request-tracing.mjs','pi-durable-worker-supervisor.mjs','pi-durable-worker-protocol.mjs','mcp-workspace-snapshot-authority.mjs','mcp-workspace-snapshot-authority-ipc.mjs','mcp-workspace-change-clock.mjs','mcp-workspace-change-clock-provider.mjs','git-status-porcelain.mjs','world-simulation-prepared-turn-ephemeral-broker.mjs', 'world-simulation-formal-goal-plan-intent-contract.mjs','world-simulation-prepared-turn-broker-ipc.mjs','world-simulation-formal-experiential-deliberation-contract.mjs','canonical-json-hash-service.mjs','process-control.mjs','file-transactions.mjs','project-paths.mjs'];
async function fixture(){
 const parent=path.join(root,'tests','.tmp');await mkdir(parent,{recursive:true});const directory=await mkdtemp(path.join(parent,'trpg-gm-parent-'));let child;const clients=[];
 const stop=async()=>{for(const client of clients)await client.close().catch(()=>{});if(child&&child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill();await done;}const resolved=path.resolve(directory);assert.ok(resolved.startsWith(path.resolve(parent)+path.sep));await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});};
 try{
  await mkdir(path.join(directory,'server','src'),{recursive:true});await mkdir(path.join(directory,'scripts'));await mkdir(path.join(directory,'config'));
  for(const file of files)await copyFile(path.join(root,'server','src',file),path.join(directory,'server','src',file));
  await copyFile(path.join(root,'scripts/mcp-workspace-change-watch.ps1'),path.join(directory,'scripts/mcp-workspace-change-watch.ps1'));
  await copyFile(path.join(root,'config/mcp-session-memory-profile.json'),path.join(directory,'config/mcp-session-memory-profile.json'));
  await copyFile(path.join(root,'package-lock.json'),path.join(directory,'package-lock.json'));
  await writeFile(path.join(directory,'server/src/mcp-development-integration-tools.mjs'),"import fs from 'node:fs';export async function dev_workspace_integrate(){fs.writeFileSync('unexpected-parent-integration','called');return {state:'integrated'};}\n");
  const stub=`import readline from 'node:readline';import {PI_DURABLE_WORKER_PROTOCOL} from './pi-durable-worker-protocol.mjs';
if(process.argv.includes('--pi-worker')){process.on('message',m=>{if(m?.kind==='drain')process.exit(0);});process.once('disconnect',()=>process.exit(0));process.send({protocol:PI_DURABLE_WORKER_PROTOCOL,kind:'ready',pid:process.pid});await new Promise(()=>{});}
let gm=false;const names=${JSON.stringify(gmNames)};for await(const line of readline.createInterface({input:process.stdin})){const m=JSON.parse(line);if(m.params?._meta?.workbench_purpose==='GM'||m.params?.name?.startsWith('trpg.gm.'))gm=true;if(m.id===undefined)continue;let result;if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'synthetic-gm-parent-child',version:'1'}};else if(m.method==='tools/list')result={tools:(m.params?.cursor==='SYNTHETIC_EMPTY'?[]:gm?names:[]).map(name=>({name,inputSchema:{type:'object'},annotations:{readOnlyHint:true}}))};else result={content:[{type:'text',text:JSON.stringify({synthetic:true,child_pid:process.pid})}]};console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));}`;
  await writeFile(path.join(directory,'server/src/mcp-server.mjs'),stub);
  await writeFile(path.join(directory,'.gitignore'),'data/outputs/\ntests/.tmp/\n');
  const git=args=>execFileSync('git',['-c','core.hooksPath=',...args],{cwd:directory,windowsHide:true,encoding:'utf8',stdio:'pipe'});
  git(['init','-b','main']);git(['config','user.name','Synthetic GM parent']);git(['config','user.email','synthetic@test.invalid']);git(['add','.']);git(['commit','-m','synthetic parent baseline']);
  const probe=createServer();await new Promise(ok=>probe.listen(0,'127.0.0.1',ok));const port=probe.address().port;await new Promise(ok=>probe.close(ok));
  child=spawn(process.execPath,['server/src/mcp-http-server.mjs','--port',String(port)],{cwd:directory,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,MCP_TOOL_PROFILE:'chatgpt_developer'}});
  let logs='';await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Synthetic parent startup timeout: '+logs)),15000);child.stderr.on('data',part=>{logs+=part;if(logs.includes('MCP Streamable HTTP Server listening')){clearTimeout(timer);ok();}});child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',()=>{clearTimeout(timer);fail(Error('Synthetic parent exited: '+logs));});});
  const connect=async()=>{const client=new Client({name:'synthetic-gm-parent',version:'1'});clients.push(client);await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+port+'/mcp')));return client;};
  return{directory,connect,stop};
 }catch(e){await stop();throw e;}
}

test('GM-only child tool lists do not acquire parent engineering actions; parent calls are denied before effects and stay denied across forged purpose changes',async()=>{
 const f=await fixture();try{
  const gm=await f.connect();const first=await gm.callTool({name:gmNames[0],arguments:{}});assert.ok(!first.isError);const pid=JSON.parse(first.content[0].text).child_pid;
  assert.deepEqual((await gm.listTools()).tools.map(t=>t.name),gmNames,'GM tools/list must contain exactly seven game tools');
  for(const name of ['dev_mcp_reload','dev_workspace_integrate'])for(const meta of [{},{workbench_purpose:'WORKBENCH'},{reconciliation_key:'synthetic-gm-parent-denial-001'}]){
   await assert.rejects(gm.callTool({name,arguments:name==='dev_mcp_reload'?{}:{integration_candidate_id:'dev_integration_20260902-120000_123456789abc',expected_revision:1},_meta:meta}),/GM_CONNECTION_TOOL_DENIED/);
  }
  assert.equal(JSON.parse((await gm.callTool({name:gmNames[0],arguments:{}})).content[0].text).child_pid,pid,'denied reload must preserve the child');
  assert.equal(await access(path.join(f.directory,'unexpected-parent-integration')).then(()=>true,()=>false),false);
  assert.deepEqual((await gm.listTools()).tools.map(t=>t.name),gmNames);
  const engineering=await f.connect();const names=(await engineering.listTools()).tools.map(t=>t.name);assert.ok(names.includes('dev_mcp_reload'));assert.ok(names.includes('dev_workspace_integrate'));
  const reloaded=await engineering.callTool({name:'dev_mcp_reload',arguments:{}});assert.equal(JSON.parse(reloaded.content[0].text).reloaded,true,'independent engineering connection keeps its existing parent reload');
 }finally{await f.stop();}
});

test('GM purpose on tools/list keeps the exact empty/nonempty child projection and never restores parent actions',async()=>{
 const f=await fixture();try{const gm=await f.connect();assert.deepEqual((await gm.listTools({_meta:{workbench_purpose:'GM'}})).tools.map(t=>t.name),gmNames);assert.deepEqual((await gm.listTools({cursor:'SYNTHETIC_EMPTY'})).tools,[]);await assert.rejects(gm.callTool({name:'dev_mcp_reload',arguments:{}}),/GM_CONNECTION_TOOL_DENIED/);assert.deepEqual((await gm.listTools()).tools.map(t=>t.name),gmNames);}finally{await f.stop();}
});
