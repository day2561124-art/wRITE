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
  t.after(() => fs.rm(dir, {recursive:true,force:true}));
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
