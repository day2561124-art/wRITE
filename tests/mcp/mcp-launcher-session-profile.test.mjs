import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,symlink,realpath,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import {readSessionMemoryProfile} from '../../server/src/mcp-session-profile.mjs';
import {controlledProcessEnvironment} from '../../server/src/process-control.mjs';
const exec=promisify(execFile),source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const expected={MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'900000',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'4'};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const windows=process.platform==='win32'?{}:{skip:'Windows launcher and WinSW renderer'};
function cleanEnv(){const env=controlledProcessEnvironment();for(const k of Object.keys(env))if(k.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_')||k==='WRITER_WORKBENCH_TEST_JOURNAL_GROUP')delete env[k];for(const k of ['MCP_HTTP_SESSION_IDLE_TIMEOUT_MS','MCP_HTTP_MAX_IDLE_SESSION_COUNT','MCP_HTTP_MAX_TOTAL_SESSION_COUNT','TUNNEL_TOKEN','WRITER_MCP_TUNNEL_TOKEN'])delete env[k];return env;}
async function temp(t){const dir=await mkdtemp(path.join(os.tmpdir(),'mcp-launcher-profile-'));t.after(async()=>{assert.equal(path.dirname(dir),os.tmpdir());await rm(dir,{recursive:true,force:true});});return dir;}
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function until(fn,label,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const v=await fn();if(v)return v;await pause(50);}throw Error(label);}

test('formal versioned profile supplies both defaults and leaves total cap untouched',async()=>{
 const env={MCP_HTTP_MAX_TOTAL_SESSION_COUNT:'23'};
 assert.deepEqual(readSessionMemoryProfile(path.join(source,'config/mcp-session-memory-profile.json'),env),expected);
 assert.deepEqual(env,{MCP_HTTP_MAX_TOTAL_SESSION_COUNT:'23'});
});

test('explicit valid environment wins, but neither malformed profile nor invalid override falls back',async t=>{
 const dir=await temp(t),file=path.join(dir,'profile.json');
 await writeFile(file,JSON.stringify(expected));
 assert.deepEqual(readSessionMemoryProfile(file,{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'350',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'2'}),{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'350',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'2'});
 for(const value of ['', '0', '99', '90000100', '1e3', '-1', 'NaN', undefined])assert.throws(()=>readSessionMemoryProfile(file,{MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:value}),/Invalid session memory profile/);
 for(const value of ['', '0', '10001', '4.5', '-1'])assert.throws(()=>readSessionMemoryProfile(file,{MCP_HTTP_MAX_IDLE_SESSION_COUNT:value}),/Invalid session memory profile/);
 for(const value of [null,[],{}, {...expected,extra:'1'},{...expected,MCP_HTTP_MAX_IDLE_SESSION_COUNT:4},{...expected,MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'bad'}]){
  await writeFile(file,JSON.stringify(value));assert.throws(()=>readSessionMemoryProfile(file,expected),/Invalid session memory profile/);
 }
 await writeFile(file,'{bad json');assert.throws(()=>readSessionMemoryProfile(file,expected),/Cannot load session memory profile/);
 assert.throws(()=>readSessionMemoryProfile(path.join(dir,'missing.json'),expected),/Cannot load session memory profile/);
});

async function fixture(t){
 const container=await temp(t),repo=path.join(container,'中文 MCP path with spaces');await mkdir(repo);
 for(const dir of ['server','scripts'])await cp(path.join(source,dir),path.join(repo,dir),{recursive:true,filter:p=>!['node_modules','.tmp'].includes(path.basename(p))});
 await mkdir(path.join(repo,'config'));for(const f of ['mcp-session-memory-profile.json','mcp-http.example.json'])await cp(path.join(source,'config',f),path.join(repo,'config',f));
 for(const f of ['package.json','package-lock.json'])await cp(path.join(source,f),path.join(repo,f));
 await symlink(await realpath(path.join(source,'node_modules')),path.join(repo,'node_modules'),process.platform==='win32'?'junction':'dir');
 await writeFile(path.join(repo,'.gitignore'),'node_modules/\ndata/outputs/\n');
 const git=async(...a)=>exec('git',a,{cwd:repo,env:cleanEnv(),windowsHide:true,timeout:30000});
 await git('init','-q','-b','main');await git('config','core.autocrlf','false');await git('config','core.longpaths','true');await git('add','.');await git('-c','user.name=Launcher fixture','-c','user.email=launcher@example.invalid','commit','-qm','Disposable launcher fixture');
 await writeFile(path.join(repo,'server/src/launcher-test-entry.mjs'),"import './mcp-http-server.mjs';process.on('message',m=>{if(m==='fixture-shutdown')process.emit('SIGTERM');});\n");
 return {repo,container};
}

test('WinSW renderer shares versioned profile across working directories and preserves service identity',windows,async t=>{
 const {repo,container}=await fixture(t),token=path.join(container,'outside token.txt'),xml=path.join(container,'service output','WriterWorkbenchMcp.xml');await writeFile(token,'fixture-only-token');
 // Match the existing project's WinSW renderer test invocation; no service
 // installation, elevated token or persistent machine/user policy changes.
 const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(repo,'scripts/manage-mcp-service.ps1'),'-Action','Render','-Hostname','fixture.example.invalid','-TokenFile',token,'-ConfigPath',xml];
 const env={...cleanEnv(),MCP_HTTP_SESSION_IDLE_TIMEOUT_MS:'7200000',MCP_HTTP_MAX_IDLE_SESSION_COUNT:'16'};
 await exec('powershell.exe',args,{cwd:os.tmpdir(),env,windowsHide:true,timeout:30000});
 const quote=p=>"'"+p.replaceAll("'","''")+"'";
 const script=`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[xml]$x=Get-Content -LiteralPath ${quote(xml)} -Raw;[ordered]@{id=[string]$x.service.id;arguments=[string]$x.service.arguments;directory=[string]$x.service.workingdirectory;env=@($x.service.env|ForEach-Object {[ordered]@{name=$_.name;value=$_.value}});failures=@($x.service.onfailure|ForEach-Object {$_.action})}|ConvertTo-Json -Depth 5 -Compress`;
 const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:os.tmpdir(),env:cleanEnv(),windowsHide:true,timeout:15000});
 const parsed=JSON.parse(stdout.trim()),values=Object.fromEntries(parsed.env.map(p=>[p.name,p.value]));
 assert.equal(parsed.id,'WriterWorkbenchMcp');assert.equal(parsed.directory,repo);assert.match(parsed.arguments,/-ServiceHost/);assert.match(parsed.arguments,/-McpPort 8787/);assert.deepEqual(parsed.failures,['restart','restart','none']);
 for(const [k,v] of Object.entries(expected))assert.equal(values[k],v);
 assert.equal(values.MCP_HTTP_MAX_TOTAL_SESSION_COUNT,undefined);assert.equal(values.WRITER_MCP_TUNNEL_MODE,'named');assert.equal(values.WRITER_MCP_TUNNEL_TOKEN_FILE,token);
 // The real Node child inherits the XML-produced values; not a mocked env reader.
 const child=await exec(process.execPath,['-e','console.log(JSON.stringify({timeout:process.env.MCP_HTTP_SESSION_IDLE_TIMEOUT_MS,idle:process.env.MCP_HTTP_MAX_IDLE_SESSION_COUNT}))'],{cwd:os.tmpdir(),env:{...cleanEnv(),...values},windowsHide:true,timeout:10000});
 assert.deepEqual(JSON.parse(child.stdout),{timeout:'900000',idle:'4'});
 const before=await readFile(xml);await writeFile(path.join(repo,'config/mcp-session-memory-profile.json'),'{}');
 await assert.rejects(exec('powershell.exe',args,{cwd:os.tmpdir(),env,windowsHide:true,timeout:30000}),/Invalid session memory profile|Cannot load MCP session memory profile/);
 assert.deepEqual(await readFile(xml),before,'bad profile must not replace a previously reviewed XML');
});

test('real Listener cold start and controlled restart load profile without caller environment', {timeout:90000},async t=>{
 let child,stderr='',worker;
 const stop=async()=>{if(!child||child.exitCode!==null)return;const held=child;held.send('fixture-shutdown');await until(()=>held.exitCode!==null,'owned fixture Listener did not stop');child=null;};
 t.after(async()=>{await stop();});
 const {repo}=await fixture(t);
 for(let generation=0;generation<2;generation++){
  const p=await port();stderr='';child=spawn(process.execPath,[path.join(repo,'server/src/launcher-test-entry.mjs'),'--config',path.join(repo,'config/mcp-http.example.json'),'--port',String(p)],{cwd:os.tmpdir(),env:{...cleanEnv(),MCP_TOOL_PROFILE:'chatgpt_developer'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});child.stderr.on('data',b=>stderr+=b);
  const endpoint=`http://127.0.0.1:${p}`;
  const health=await until(async()=>{if(child.exitCode!==null)throw Error(stderr);return fetch(endpoint+'/health').then(async r=>{if(!r.ok)return null;const h=await r.json();return Number.isInteger(h.pi_durable_worker?.pid)&&['ready','idle'].includes(h.pi_durable_worker.state)?h:null;}).catch(()=>null);},'fixture Listener not ready');worker=health.pi_durable_worker.pid;
  assert.match(stderr,/session lifecycle idle_timeout_ms=900000 max_idle_sessions=4 max_total_sessions=32/);
  assert.equal(health.pi_execution_protocol,'writer-workbench/pi-production/v1');assert(Number.isInteger(worker));
  const live=await fetch(endpoint+'/live').then(r=>r.json());assert.equal(live.live,true);assert.equal(live.session_count,0);
  await stop();await until(()=>{try{process.kill(worker,0);return false;}catch(e){if(e.code==='ESRCH')return true;throw e;}},'owned fixture Worker survived graceful Listener shutdown');
 }
 // Startup failure is before listener/worker creation, with no fallback even
 // when inherited values would otherwise be valid.
 await writeFile(path.join(repo,'config/mcp-session-memory-profile.json'),'{}');
 await assert.rejects(exec(process.execPath,[path.join(repo,'server/src/mcp-http-server.mjs'),'--port',String(await port())],{cwd:os.tmpdir(),env:{...cleanEnv(),...expected},windowsHide:true,timeout:10000}),/Invalid session memory profile/);
});
