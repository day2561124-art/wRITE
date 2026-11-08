import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
const root = fileURLToPath(new URL('../..', import.meta.url));
const launcher = await fs.readFile(path.join(root, 'scripts/start-mcp-tailscale.ps1'), 'utf8');
const definitions = launcher.slice(launcher.indexOf('function Invoke-McpProbe'), launcher.indexOf('if ($EnsureMcpOnly)'));
const quote = value => "'" + value.replaceAll("'", "''") + "'";
async function powershell(script, cwd = root) {
  const file = path.join(cwd, 'case.ps1');
  await fs.writeFile(file, '\uFEFF' + script, 'utf8');
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], {cwd, windowsHide: true});
    let output = '';const timer=setTimeout(()=>{child.kill();reject(Error('PowerShell fixture exceeded deadline'));},120_000);
    child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
    child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);resolve({code,output});});
  });
}

test('actual Ensure-McpServer cold start, reuse and restart pass full protocol', {skip:process.platform!=='win32'}, async t => {
  const f=await fixture(t);
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const script=f.prefix+`
$Root=${quote(root)}
$McpPort=${port}
$OriginUrl="http://127.0.0.1:$McpPort"
$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1'
$owned=$null
try {
 for($cycle=0;$cycle -lt 2;$cycle++) {
  $fresh=Ensure-McpServer
  $owned=Get-Process -Id $fresh.pid
  if(-not $fresh.ok -or $fresh.runtimeReadiness -ne 'ready' -or $null -eq $fresh.resourceCount){throw 'cold protocol incomplete'}
  $reused=Ensure-McpServer -NoRestart
  if($reused.pid -ne $fresh.pid -or $reused.instanceId -ne $fresh.instanceId){throw 'reuse changed owner'}
  $info=Get-CimInstance Win32_Process -Filter "ProcessId = $($owned.Id)"
  Stop-CreatedMcpServer $owned $info ([IO.Path]::GetFullPath((Join-Path $Root 'server\\src\\mcp-http-server.mjs')))
  $owned=$null
  $watch=[Diagnostics.Stopwatch]::StartNew()
  while((Test-McpPortOpen) -and $watch.ElapsedMilliseconds -lt 5000){Start-Sleep -Milliseconds 100}
  if(Test-McpPortOpen){throw 'restart port not released'}
 }
 Write-Host 'COLD_REUSE_RESTART_PROTOCOL_PASSED'
} finally {
 if($owned){$info=Get-CimInstance Win32_Process -Filter "ProcessId = $($owned.Id)"; Stop-CreatedMcpServer $owned $info ([IO.Path]::GetFullPath((Join-Path $Root 'server\\src\\mcp-http-server.mjs')))}
}
`;
  const result=await powershell(script,f.dir);
  assert.equal(result.code,0,result.output);assert.match(result.output,/COLD_REUSE_RESTART_PROTOCOL_PASSED/);
});
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-launch-readiness-'));
  await fs.mkdir(path.join(dir, 'scripts'));await fs.mkdir(path.join(dir, 'logs'));
  t.after(async () => { const resolved=await fs.realpath(dir); assert.equal(path.dirname(resolved).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase()); assert.match(path.basename(resolved),/^mcp-launch-readiness-/); await fs.rm(resolved,{recursive:true,force:true}); });
  return {dir,prefix:`$ErrorActionPreference='Stop'\n$Root=${quote(dir)}\n$LogDir=Join-Path $Root 'logs'\n$McpPort=18787\n$OriginUrl='http://127.0.0.1:18787'\n${definitions}\n`};
}

test('PowerShell captures stderr without rejecting a successful native probe', {skip: process.platform !== 'win32'}, async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.dir,'scripts/probe-mcp.mjs'), `console.error('Bearer DO_NOT_LOG');console.log(JSON.stringify({ok:true,ready:true,runtimeReadiness:'ready',toolCount:1,resourceCount:0,pid:123,opTimeout:Number(process.env.PROBE_OP_TIMEOUT_MS)}));`);
  const result=await powershell(f.prefix+`$env:PROBE_OP_TIMEOUT_MS='1234'\n$r=Invoke-McpProbe 'http://fixture/mcp'\nif(-not $r.ok -or $r.opTimeout -ne 30000 -or $env:PROBE_OP_TIMEOUT_MS -ne '1234'){throw 'success was rejected or startup headroom/environment invalid'}\n`,f.dir);
  assert.equal(result.code,0,result.output);assert.ok(!result.output.includes('DO_NOT_LOG'));
});

test('PowerShell exposes bounded phase diagnostics and filters native secrets', {skip: process.platform !== 'win32'}, async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.dir,'scripts/probe-mcp.mjs'), `console.error('Bearer PRIVATE_SECRET');console.error(JSON.stringify({ok:false,code:'RUNTIME_NOT_READY',phase:'runtime/readiness',elapsedMs:33001,runtimeState:'failed',runtimeStep:'journal',message:'PRIVATE_SECRET',body:'PRIVATE_SECRET'}));process.exit(1);`);
  const result=await powershell(f.prefix+`$r=Invoke-McpProbe 'http://fixture/mcp'\nif($r){throw 'failure accepted'}\nWrite-Host (Get-McpProbeFailureSummary)\n`,f.dir);
  assert.equal(result.code,0,result.output);assert.match(result.output,/RUNTIME_NOT_READY.*phase=runtime\/readiness/);
  const log=await fs.readFile(path.join(f.dir,'logs/mcp-probe.failures.jsonl'),'utf8');
  assert.match(log,/"runtimeStep":"journal"/);assert.ok(!log.includes('PRIVATE_SECRET'));
});

test('PowerShell kills a hung probe within its parent budget', {skip: process.platform !== 'win32'}, async t => {
  const f=await fixture(t);
  await fs.writeFile(path.join(f.dir,'scripts/probe-mcp.mjs'), 'setInterval(()=>{},1000);');
  const begin=Date.now();const result=await powershell(f.prefix+`$r=Invoke-McpProbe 'http://fixture/mcp' 'probe' '' 2000\nif($r){throw 'hung probe accepted'}\n`,f.dir);
  assert.equal(result.code,0,result.output);assert.match(result.output,/PROBE_PROCESS_TIMEOUT/);assert.ok(Date.now()-begin<8000);
});

test('PowerShell refuses malformed successful stdout', {skip: process.platform !== 'win32'}, async t => {
  const f=await fixture(t);
  await fs.writeFile(path.join(f.dir,'scripts/probe-mcp.mjs'), `console.log('not JSON');`);
  const result=await powershell(f.prefix+`$r=Invoke-McpProbe 'http://fixture/mcp'\nif($r){throw 'malformed output accepted'}\n`,f.dir);
  assert.equal(result.code,0,result.output);assert.match(result.output,/INVALID_PROBE_JSON/);
});

for(const scenario of ['verified','wrong-pid','foreign-process','owner-changed','protocol-failed']) {
  test('existing listener ownership: '+scenario, {skip:process.platform!=='win32'}, async t=>{
    const f=await fixture(t);
    const script=f.prefix+String.raw`
function Test-McpPortOpen { return $true }
function Get-McpOwningProcess { return 4321 }
function Get-CimInstance { return [pscustomobject]@{Name=${scenario==='foreign-process'?"'other.exe'":"'node.exe'"};CommandLine=(Join-Path $Root 'server\src\mcp-http-server.mjs');CreationDate='fixed'} }
function taskkill.exe { throw 'UNKNOWN_PROCESS_WAS_KILLED' }
function Invoke-McpProbe {
 param($Endpoint,$Mode,$ExpectedInstance,$BudgetMilliseconds)
 if($Mode -eq 'identity') {return [pscustomobject]@{pid=${scenario==='wrong-pid'?'9999':'4321'};current=$true;instanceId='fixture'}}
 ${scenario==='protocol-failed'?'return $null':`return [pscustomobject]@{pid=${scenario==='owner-changed'?'9999':'4321'};instanceId='fixture';ok=$true}`}
}
try {
 $r=Ensure-McpServer
 ${scenario==='verified'?"if($r.pid -ne 4321){throw 'verified owner rejected'}":"throw 'INVALID_OWNER_ACCEPTED'"}
} catch {
 ${scenario==='verified'?"throw":"if($_.Exception.Message -match 'UNKNOWN_PROCESS_WAS_KILLED|INVALID_OWNER_ACCEPTED'){throw}; Write-Host $_.Exception.Message"}
}
`;
    const result=await powershell(script,f.dir);assert.equal(result.code,0,result.output);
    if(scenario==='verified')assert.match(result.output,/resources\/list/);
    else assert.match(result.output,/unverified process|owner changed|protocol verification failed/);
  });
}

test('default startup closes caller pipes while verified HTTP listener stays alive', {skip:process.platform!=='win32'}, async t=>{
 const f=await fixture(t),recordFile=path.join(f.dir,'owned.json');
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const script=f.prefix+`
$Root=${quote(root)}
$McpPort=${port}
$OriginUrl="http://127.0.0.1:$McpPort"
$ListenerOnly=$false
$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1'
$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1'
$fresh=Ensure-McpServer
$info=Get-CimInstance Win32_Process -Filter "ProcessId = $($fresh.pid)"
@{pid=$fresh.pid; instanceId=$fresh.instanceId; creationTicks=$info.CreationDate.Ticks.ToString(); ready=$fresh.ready} | ConvertTo-Json -Compress | Set-Content -LiteralPath ${quote(recordFile)} -Encoding UTF8
Write-Host 'DEFAULT_STARTUP_PROTOCOL_PASSED'
`;
 const file=path.join(f.dir,'default-parent.ps1');await fs.writeFile(file,'\uFEFF'+script);
 try{
  const observed=await new Promise((resolve,reject)=>{
   const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',file],{cwd:f.dir,windowsHide:true,stdio:['ignore','pipe','pipe']});
   let output='',exitAt=null,drain=null;const started=Date.now();
   const deadline=setTimeout(()=>{child.kill();reject(Error('DEFAULT_PARENT_DEADLINE'));},120000);
   child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
   child.once('error',e=>{clearTimeout(deadline);clearTimeout(drain);reject(e);});
   child.once('exit',()=>{exitAt=Date.now();clearTimeout(deadline);drain=setTimeout(()=>reject(Error('MCP_CALLER_PIPE_NOT_CLOSED_AFTER_EXIT')),2000);});
   child.once('close',code=>{clearTimeout(deadline);clearTimeout(drain);resolve({code,output,exitMs:exitAt-started,captureDelayMs:Date.now()-exitAt});});
  });
  assert.equal(observed.code,0,observed.output);assert.match(observed.output,/DEFAULT_STARTUP_PROTOCOL_PASSED/);assert.ok(observed.captureDelayMs<2000);
  const owned=JSON.parse((await fs.readFile(recordFile,'utf8')).replace(/^\uFEFF/,''));assert.equal(owned.ready,true);
  const health=await(await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(5000)})).json();assert.equal(health.pid,owned.pid);assert.equal(health.instanceId,owned.instanceId);
  const probe=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts/probe-mcp.mjs'),`http://127.0.0.1:${port}/mcp`,'probe',owned.instanceId],{cwd:root,windowsHide:true,env:{...process.env,WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL:'1',WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT:'1',WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION:'1'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('POST_PARENT_PROTOCOL_DEADLINE'));},65000);child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',reject);child.once('close',code=>{clearTimeout(timer);code===0?resolve(JSON.parse(stdout)):reject(Error('POST_PARENT_PROTOCOL_FAILED:'+stderr));});});
  assert.equal(probe.ok,true);assert.equal(probe.ready,true);assert.ok(probe.toolCount>0);assert.equal(typeof probe.resourceCount,'number');
 }finally{
  let owned;try{owned=JSON.parse((await fs.readFile(recordFile,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(owned){const cleanup=f.prefix+`
$Root=${quote(root)}
$McpPort=${port}
$OriginUrl="http://127.0.0.1:$McpPort"
$info=Get-CimInstance Win32_Process -Filter "ProcessId = ${owned.pid}"
if($info){
 $health=Invoke-RestMethod "$OriginUrl/health"
 if($health.pid -ne ${owned.pid} -or $health.instanceId -ne ${quote(owned.instanceId)} -or $info.CreationDate.Ticks.ToString() -ne ${quote(owned.creationTicks)}){throw 'FIXTURE_OWNER_CHANGED'}
 Stop-CreatedMcpServer (Get-Process -Id ${owned.pid}) $info ([IO.Path]::GetFullPath((Join-Path $Root 'server/src/mcp-http-server.mjs')))
}
`;
   const result=await powershell(cleanup,f.dir);assert.equal(result.code,0,result.output);
  }
 }
});
