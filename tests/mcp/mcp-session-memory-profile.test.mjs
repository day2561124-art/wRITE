import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readFile,writeFile,cp,symlink,realpath,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
import {controlledProcessEnvironment} from '../../server/src/process-control.mjs';
const exec=promisify(execFile),source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const shared='dev_workspace_shared_repository_v1';
const windowsOnly=process.platform==='win32'?{}:{skip:'Windows PowerShell profile and Windows process-memory observations'};
async function until(check,label,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){const value=await check();if(value)return value;await sleep(25);}throw Error(label);}
const exists=async file=>readFile(file,'utf8').then(JSON.parse,e=>{if(e.code!=='ENOENT')throw e;return null;});
function cleanEnvironment(){const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_')||key==='WRITER_WORKBENCH_TEST_JOURNAL_GROUP')delete env[key];return env;}
function encodedPowerShell(script){return exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:15000,maxBuffer:1024*1024,env:controlledProcessEnvironment()});}
async function profile(){const file=path.join(source,'config/mcp-session-memory-profile.json').replaceAll("'","''");
 const {stdout}=await encodedPowerShell(`$ErrorActionPreference='Stop';$env:MCP_HTTP_MAX_TOTAL_SESSION_COUNT='23';$sessionProfile=Get-Content -LiteralPath '${file}' -Raw|ConvertFrom-Json;$env:MCP_HTTP_SESSION_IDLE_TIMEOUT_MS=[string]$sessionProfile.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS;$env:MCP_HTTP_MAX_IDLE_SESSION_COUNT=[string]$sessionProfile.MCP_HTTP_MAX_IDLE_SESSION_COUNT;[ordered]@{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS=$env:MCP_HTTP_SESSION_IDLE_TIMEOUT_MS;MCP_HTTP_MAX_IDLE_SESSION_COUNT=$env:MCP_HTTP_MAX_IDLE_SESSION_COUNT;total=$env:MCP_HTTP_MAX_TOTAL_SESSION_COUNT}|ConvertTo-Json -Compress`);
 return JSON.parse(stdout.trim());}
function live(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function freePort(){const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const port=server.address().port;await new Promise((r,j)=>server.close(e=>e?j(e):r()));return port;}
function facts(raw){if(raw.error)throw Error(JSON.stringify(raw.error));const result=raw.result??raw;if(result.isError)throw Error(result.content?.[0]?.text??'MCP_ERROR');return result.structuredContent??JSON.parse(result.content.find(c=>c.type==='text').text);}
async function fixture(t,environment={},seed=false){
 const container=await mkdtemp(path.join(os.tmpdir(),'mcp-memory-')),repo=path.join(container,'repo');await mkdir(repo);
 const control=path.join(repo,'test-control');await mkdir(control);
 for(const dir of ['server','scripts'])await cp(path.join(source,dir),path.join(repo,dir),{recursive:true,filter:p=>!['node_modules','.tmp'].includes(path.basename(p))});
 // Real HTTP startup now requires the versioned profile. Keep the fixture
 // deployment complete; existing lifecycle assertions and override values stand.
 await cp(path.join(source,'config'),path.join(repo,'config'),{recursive:true});
 await cp(path.join(source,'package.json'),path.join(repo,'package.json'));
 await cp(path.join(source,'package-lock.json'),path.join(repo,'package-lock.json'));
 await mkdir(path.join(repo,'tests'));await writeFile(path.join(repo,'tests/session-memory-slow.txt'),'real fixture read\n');
 await symlink(await realpath(path.join(source,'node_modules')),path.join(repo,'node_modules'),process.platform==='win32'?'junction':'dir');
 await cp(path.join(source,'tests/mcp/fixtures/mcp-session-memory-hooks.mjs'),path.join(repo,'server/src/session-memory-fixture-hooks.mjs'));
 await cp(path.join(repo,'server/src/mcp-server.mjs'),path.join(repo,'server/src/mcp-server-memory-original.mjs'));
 await writeFile(path.join(repo,'server/src/mcp-server.mjs'),"import './session-memory-fixture-hooks.mjs';await import('./mcp-server-memory-original.mjs');\n");
 await writeFile(path.join(repo,'server/src/session-memory-http-fixture.mjs'),"import './session-memory-fixture-hooks.mjs';await import('./mcp-http-server.mjs');process.on('message',m=>{if(m==='fixture-shutdown')process.emit('SIGTERM');});\n");
 await writeFile(path.join(repo,'.gitignore'),'node_modules/\ndata/outputs/\ntest-control/\n');
 const env={...cleanEnvironment(),MCP_TOOL_PROFILE:'chatgpt_developer',...environment};
 const git=async(...args)=>exec('git',args,{cwd:repo,env,windowsHide:true,timeout:30000,maxBuffer:1024*1024});
 await git('init','-q','-b','main');await git('config','core.longpaths','true');await git('config','core.autocrlf','false');await git('add','.');
 await git('-c','user.name=Session fixture','-c','user.email=session@example.invalid','commit','-qm','Exact disposable session fixture');
 let workstream;
 if(seed){
  const script="import {dev_workspace_begin_workstream,dev_workspace_create_isolated} from './server/src/mcp-development-workstream-tools.mjs';import {createPiProductionRouteStore} from './server/src/pi-production-execution-route.mjs';const w=await dev_workspace_begin_workstream({label:'Session durable read fixture',declared_scope:['package.json']});const isolated=await dev_workspace_create_isolated({workstream_id:w.workstream_id,expected_workstream_revision:w.revision});await createPiProductionRouteStore().change({mode:'pi_default',expected_revision:0,decision_id:'gpt-session-memory-fixture',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});console.log(JSON.stringify({...w,workspace_id:isolated.workspace_id}));";
  workstream=JSON.parse((await exec(process.execPath,['--input-type=module','-e',script],{cwd:repo,env,windowsHide:true,timeout:30000,maxBuffer:1024*1024})).stdout);
  await writeFile(path.join(control,'gate-worker'),'1');
 }
 const port=await freePort(),agent=new http.Agent({keepAlive:true});let stderr='',knownWorker=null;
 const child=spawn(process.execPath,['server/src/session-memory-http-fixture.mjs','--port',String(port)],{cwd:repo,env,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
 child.stderr.on('data',b=>stderr+=b);
 let sequence=0;
 const request=(method,url,{session,body,headers={}}={})=>new Promise((resolve,reject)=>{
  const bytes=body===undefined?null:JSON.stringify(body);
  const req=http.request({hostname:'127.0.0.1',port,path:url,method,agent,headers:{...headers,
   ...(bytes?{'Content-Type':'application/json',Accept:'application/json, text/event-stream','Content-Length':Buffer.byteLength(bytes)}:{}),
   ...(session?{'Mcp-Session-Id':session.id,'MCP-Protocol-Version':session.protocol}:{})}},res=>{
    let text='';res.setEncoding('utf8');res.on('data',b=>text+=b);res.once('end',()=>{let payload;
     try{payload=JSON.parse(text);}catch{const data=text.split(/\r?\n/).find(l=>l.startsWith('data: '));if(data)payload=JSON.parse(data.slice(6));}
     resolve({status:res.statusCode,headers:res.headers,text,payload});});
  });req.once('error',reject);req.end(bytes);
 });
 const get=async(url,session)=>(await request('GET',url,{session})).payload;
 const post=(session,message)=>request('POST','/mcp',{session,body:{jsonrpc:'2.0',...message}});
 const call=async(session,name,args={})=>{const response=await post(session,{id:++sequence,method:'tools/call',params:{name,arguments:args}});assert.equal(response.status,200,response.text);return facts(response.payload);};
 const initialize=async()=>{
  const started=performance.now(),r=await post(null,{id:++sequence,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'session-memory-fixture',version:'1'}}});
  assert.equal(r.status,200,r.text);assert(!r.payload.error,r.text);
  const session={id:r.headers['mcp-session-id'],protocol:r.payload.result.protocolVersion};assert(session.id);
  const notified=await post(session,{method:'notifications/initialized'});assert([200,202].includes(notified.status));
  const tools=await post(session,{id:++sequence,method:'tools/list',params:{}});assert.equal(tools.status,200,tools.text);assert(tools.payload.result.tools.length>0);
  session.cold_ms=performance.now()-started;return session;
 };
 const pid=session=>{const line=stderr.split(/\r?\n/).find(l=>l.includes('session initialized id='+session.id+' '));return Number(line?.match(/child_pid=(\d+)/)?.[1]);};
 const allPids=()=>[...new Set([...stderr.matchAll(/session initialized .*child_pid=(\d+)/g)].map(m=>Number(m[1])))];
 t.after(async()=>{
  // Release only our fixture gates so a failed assertion cannot strand a worker.
  await writeFile(path.join(control,'release-read'),'1');await writeFile(path.join(control,'release-worker'),'1');
  const health=await get('/health').catch(()=>null);agent.destroy();
  if(child.exitCode===null){child.send('fixture-shutdown');await until(()=>child.exitCode!==null,'Fixture parent did not exit',10000);}
  const pids=[...allPids(),health?.pi_durable_worker?.pid,knownWorker].filter(Number.isInteger);
  await until(()=>pids.every(p=>!live(p)),'Fixture child or worker survived graceful shutdown',10000);
  assert.equal(path.dirname(path.resolve(container)),path.resolve(os.tmpdir()));assert.match(path.basename(container),/^mcp-memory-[A-Za-z0-9]+$/);
  await rm(container,{recursive:true,force:true});
 });
 await until(async()=>{if(child.exitCode!==null)throw Error('Fixture listener exited '+child.exitCode+': '+stderr);try{return (await get('/live'))?.pid===child.pid;}catch{return false;}},'Fixture listener did not start');
 await until(async()=>{const worker=(await get('/health')).pi_durable_worker;if(!['ready','idle'].includes(worker.state))return false;knownWorker=worker.pid;return true;},'Fixture worker did not initialize');
 return {repo,control,port,child,get,post,call,initialize,pid,stderr:()=>stderr,workstream,allPids};
}
async function memory(pids){
 assert(pids.every(p=>Number.isSafeInteger(p)&&p>0));
 const code=`$ErrorActionPreference='Stop';@(Get-Process -Id ${pids.join(',')}|ForEach-Object {[ordered]@{pid=$_.Id;working_set_bytes=$_.WorkingSet64;private_bytes=$_.PrivateMemorySize64}})|ConvertTo-Json -Compress`;
 const rows=JSON.parse((await encodedPowerShell(code)).stdout);
 return {processes:rows,working_set_bytes:rows.reduce((n,p)=>n+p.working_set_bytes,0),private_bytes:rows.reduce((n,p)=>n+p.private_bytes,0)};
}

test('session memory profile sets 15 minutes and four idle slots without changing total cap',windowsOnly,async()=>{
 const values=await profile();assert.equal(values.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS,'900000');assert.equal(values.MCP_HTTP_MAX_IDLE_SESSION_COUNT,'4');assert.equal(values.total,'23');
});

test('memory fixture hooks refuse a normal engineering checkout',async()=>{
 await assert.rejects(import('./fixtures/mcp-session-memory-hooks.mjs'),/DISPOSABLE_MEMORY_FIXTURE_REQUIRED/);
});

test('actual idle-session cap reclaims process memory while preserving listener and worker',{...windowsOnly,timeout:120000},async t=>{
 const target=await profile(),rows=[];
 for(const proposed of [false,true]){
  const env={MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:proposed?target.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:String(2*60*60*1000),
   MCP_HTTP_MAX_IDLE_SESSION_COUNT:proposed?target.MCP_HTTP_MAX_IDLE_SESSION_COUNT:'16',MCP_HTTP_MAX_TOTAL_SESSION_COUNT:'32'};
  await t.test(proposed?'proposed profile':'previous defaults',async st=>{
   const f=await fixture(st,env),worker=(await f.get('/health')).pi_durable_worker.pid;
   const sessions=[];for(let i=0;i<8;i++)sessions.push(await f.initialize());
   const expected=proposed?4:8;
   await until(async()=>(await f.get('/live')).session_count===expected,'Idle cap did not settle');
   await until(()=>sessions.filter(s=>live(f.pid(s))).length===expected,'Evicted child did not exit');
   const retained=sessions.filter(s=>live(f.pid(s))),pids=[f.child.pid,worker,...retained.map(f.pid)];
   assert.equal((await f.get('/health')).pi_durable_worker.pid,worker);assert(live(worker));
   rows.push({profile:proposed?'15m/4':'2h/16',initialized:8,retained:expected,cold_start_ms:sessions.map(s=>s.cold_ms),...await memory(pids)});
  });
 }
 assert(rows[1].private_bytes<rows[0].private_bytes,JSON.stringify(rows));
 console.log('SESSION_MEMORY_EVIDENCE '+JSON.stringify({rows,private_reduction_percent:100*(1-rows[1].private_bytes/rows[0].private_bytes),production_measurement:false}));
});

test('pending MCP read survives TTL and cap pressure; idle expiry permits cold reconnect',{...windowsOnly,timeout:60000},async t=>{
 const f=await fixture(t,{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'350',MCP_HTTP_SESSION_REAPER_INTERVAL_MS:'50',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'1',MCP_HTTP_MAX_TOTAL_SESSION_COUNT:'2'});
 await writeFile(path.join(f.control,'gate-read'),'1');
 const session=await f.initialize(),original=f.pid(session),worker=(await f.get('/health')).pi_durable_worker.pid;
 const pending=f.call(session,'dev_read_file',{workspace_id:shared,path:'tests/session-memory-slow.txt'});
 pending.catch(()=>{}); // Observe below after exercising cap pressure; retain errors.
 await until(()=>exists(path.join(f.control,'entered-read.json')),'Read never entered real MCP dispatch');
 await sleep(750);assert(live(original));
 assert((await f.get('/ready',session)).child.pending_calls>=1,'The actual adapter must still own the pending MCP call');
 const ready=await f.get('/live');assert.equal(ready.pid,f.child.pid);
 let second;for(let i=0;i<3;i++)second=await f.initialize();
 assert(live(original),'Pending call was evicted under cap pressure');
 const secondPending=f.call(second,'dev_read_file',{workspace_id:shared,path:'tests/session-memory-slow.txt'});secondPending.catch(()=>{});
 await until(async()=>(await f.get('/ready',second)).child?.pending_calls>=1,'Second actual call was not pending');
 const refused=await f.post(null,{id:901,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'busy-capacity-probe',version:'1'}}});
 assert.equal(refused.status,503,refused.text);assert(live(original));assert(live(f.pid(second)));
 await writeFile(path.join(f.control,'release-read'),'1');
 for(const result of await Promise.all([pending,secondPending]))assert.equal(result.content,'real fixture read\n');
 await until(()=>!live(original),'Completed idle child did not expire');
 const old=await f.post(session,{id:900,method:'ping'});assert.equal(old.status,404);
 const replacement=await f.initialize();assert.notEqual(replacement.id,session.id);assert.notEqual(f.pid(replacement),original);
 assert.equal((await f.call(replacement,'dev_read_file',{workspace_id:shared,path:'tests/session-memory-slow.txt'})).content,'real fixture read\n');
 assert.equal((await f.get('/health')).pi_durable_worker.pid,worker);assert(live(worker));
 console.log('SESSION_RECONNECT_EVIDENCE '+JSON.stringify({cold_start_ms:replacement.cold_ms,pending_survived:true,listener_unchanged:true,worker_unchanged:true}));
});

test('durable Pi operation completes after the submitting HTTP session is reclaimed',{...windowsOnly,timeout:60000},async t=>{
 const f=await fixture(t,{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'350',MCP_HTTP_SESSION_REAPER_INTERVAL_MS:'50',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'4',MCP_HTTP_MAX_TOTAL_SESSION_COUNT:'32'},true);
 const producer=await f.initialize(),producerPid=f.pid(producer),worker=(await f.get('/health')).pi_durable_worker.pid;
 const context={project_id:'writer_workbench',workstream_id:f.workstream.workstream_id,workspace_id:f.workstream.workspace_id};
 const intent={schema_version:1,intent_id:'session-memory-durable-read',goal:'Actual read survives producer session eviction',context,
  constraints:['Disposable fixture only'],requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'},depends_on:[]}],mutation_plan:[],
  verification:{focused:[],affected:[],full:[]},completion_conditions:['Read receipt and cleared owner'],permissions:{read:true,write:false,workspace_create:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
 const admitted=await f.call(producer,'dev_pi_execute_intent',{intent_json:JSON.stringify(intent)});
 assert.equal(admitted.state.status,'CREATED');
 const entered=await until(()=>exists(path.join(f.control,'entered-worker.json')),'Persistent worker did not claim actual operation',15000);
 assert.equal(entered.pid,worker);assert.equal(entered.operation_id,admitted.state.operation_id);
 await until(()=>!live(producerPid),'Submitting session was not reclaimed');
 const health=await f.get('/health');assert.equal(health.pid,f.child.pid);assert.equal(health.pi_durable_worker.pid,worker);assert(live(worker));
 await writeFile(path.join(f.control,'release-worker'),'1');
 const observer=await f.initialize();
 const done=await until(async()=>{const result=await f.call(observer,'dev_pi_execution_status',{operation_id:admitted.state.operation_id,workstream_id:context.workstream_id,workspace_id:context.workspace_id});
  if(result.operation.state.status==='COMPLETED')return result.operation;
  assert(!['FAILED','BLOCKED','DECISION_REQUIRED'].includes(result.operation.state.status),JSON.stringify(result.operation.state));return null;
 },'Durable read did not complete after producer eviction',15000);
 assert.equal(done.runtime.owner,null);assert.equal(done.runtime.active_call,null);
 const read=facts(done.receipts.find(r=>r.step_id==='read').evidence);
 assert.equal(JSON.parse(read.content).name,JSON.parse(await readFile(path.join(f.repo,'package.json'),'utf8')).name);
 assert.equal((await f.get('/health')).pi_durable_worker.pid,worker);
 console.log('SESSION_DURABLE_EVIDENCE '+JSON.stringify({operation_id:done.state.operation_id,status:done.state.status,producer_reclaimed:true,worker_unchanged:true,actual_read:true}));
});
