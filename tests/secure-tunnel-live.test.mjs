// Explicit operator acceptance: changes ONLY the existing writer-workbench alias.
// Never run implicitly from the regression gate.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.env.RUN_WRITER_SECURE_TUNNEL_LIVE !== '1') {
  console.log('SKIP Secure Tunnel live acceptance: requires explicit RUN_WRITER_SECURE_TUNNEL_LIVE=1.');
} else {
const root = fileURLToPath(new URL('../', import.meta.url));
const ps = command => {
  const r = spawnSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-Command',command], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 90_000,
  });
  assert.equal(r.status, 0, `PowerShell acceptance step failed (exit ${r.status}).`);
  return r.stdout.trim();
};
const native = () => JSON.parse(ps('tunnel-client runtimes status writer-workbench --json 2>$null'));
const quote = value => `'${value.replaceAll("'", "''")}'`;
const launcher = path.join(root, 'launcher.ps1');
const invoke = flag => ps(`& ${quote(launcher)} -${flag}; exit $LASTEXITCODE`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evidence = { startedAt: new Date().toISOString(), checks: {}, failures: [], manualLogin: 'UNVERIFIED', chatgptUi: 'UNVERIFIED' };
const out = path.join(root, 'outputs/secure-tunnel-live-evidence.json');
await mkdir(path.dirname(out), {recursive:true});
const save = () => writeFile(out, JSON.stringify(evidence, null, 2) + '\n');
const otherTransports = () => ps(`
$p=@(Get-Process cloudflared,tailscaled -ErrorAction SilentlyContinue | Sort-Object Id | ForEach-Object { $_.ProcessName+':'+$_.Id })
$f=if(Get-Command tailscale.exe -ErrorAction SilentlyContinue){ & tailscale.exe funnel status 2>$null | Out-String }else{''}
@{processes=$p;funnel=$f} | ConvertTo-Json -Compress
`);
const before = otherTransports();
let parent;
const fixtureTask = `ArmedAcademy.SecureTunnel.Acceptance.${process.pid}`;
let fixturePid;
const fixtureScript = path.join(root, 'outputs', `secure-tunnel-mcp-acceptance-${process.pid}.ps1`);
try {
  const baseline = native();
  const oldPid = baseline.process?.pid;
  parent = spawn('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-Command',
    `& ${quote(launcher)} -RestartSecureTunnel; if($LASTEXITCODE -ne 0){exit 1}; Write-Output 'LAUNCHER_EXITED'; Start-Sleep -Seconds 120`],
    {cwd:root, windowsHide:true, stdio:['ignore','pipe','pipe']});
  let stdout = '';
  parent.stdout.setEncoding('utf8'); parent.stdout.on('data', chunk => {stdout += chunk;});
  parent.stderr.resume();
  const deadline = Date.now()+75_000;
  while (!stdout.includes('LAUNCHER_EXITED') && Date.now()<deadline && parent.exitCode===null) await sleep(250);
  assert(stdout.includes('LAUNCHER_EXITED'), `Launcher must exit successfully before closing its PowerShell. ${stdout.slice(-1500)}`);
  const launched = native();
  assert(launched.process_running && launched.healthy && launched.ready);
  assert.notEqual(launched.process.pid, oldPid);
  evidence.checks.launcherExit = {pass:true, runtimePid:launched.process.pid};
  const parentExit = new Promise(resolve=>parent.once('exit',resolve));
  parent.kill(); // Close only the originating shell, never its process tree.
  await parentExit;
  await sleep(1500);
  const independent = native();
  assert.equal(independent.process.pid,launched.process.pid);
  assert(independent.process_running && independent.healthy && independent.ready);
  evidence.checks.powerShellExit = {pass:true, runtimePid:independent.process.pid};
  invoke('StartSecureTunnel');
  const adopted=native();
  assert.equal(adopted.process.pid,independent.process.pid);
  evidence.checks.reopenAndDuplicateStart = {pass:true};
  invoke('StopSecureTunnel');
  assert.equal(native().process_running,false);
  assert.equal(ps("(Get-ScheduledTask -TaskName ArmedAcademy.WriterWorkbench.SecureTunnel).State"),'Disabled');
  evidence.checks.stopDisablesRecovery={pass:true};
  invoke('StartSecureTunnel');
  const running=native();
  assert(running.process_running && running.healthy && running.ready);
  evidence.checks.restartAfterStop={pass:true};
  // Crash the exact Runtime returned by native status; preserve recovery intent.
  ps(`$r=tunnel-client runtimes status writer-workbench --json 2>$null | ConvertFrom-Json; if($r.process.pid -ne ${running.process.pid} -or -not $r.process_running){throw 'Runtime changed'}; Stop-Process -Id $r.process.pid -ErrorAction Stop`);
  let recovered;
  const recoveryDeadline=Date.now()+110_000;
  while(Date.now()<recoveryDeadline){
    await sleep(5000);
    const value=native();
    if(value.process_running && value.healthy && value.ready && value.process.pid!==running.process.pid){recovered=value;break;}
  }
  assert(recovered,'Periodic Task Scheduler reconciliation must recover a terminated Runtime.');
  evidence.checks.scheduledCrashRecovery={pass:true,oldPid:running.process.pid,newPid:recovered.process.pid};
  assert.equal(otherTransports(),before,'Existing Tailscale/Cloudflare processes and Funnel config must remain unchanged.');
  evidence.checks.otherTransportsUnchanged={pass:true};
  const task=JSON.parse(ps("$t=Get-ScheduledTask -TaskName ArmedAcademy.WriterWorkbench.SecureTunnel; @{runLevel=[string]$t.Principal.RunLevel;logonType=[string]$t.Principal.LogonType;hidden=$t.Settings.Hidden;multipleInstances=[string]$t.Settings.MultipleInstances;triggerCount=@($t.Triggers).Count} | ConvertTo-Json -Compress"));
  assert.equal(task.runLevel,'Limited'); assert.equal(task.logonType,'Interactive');
  assert.equal(task.hidden,true); assert.equal(task.multipleInstances,'IgnoreNew'); assert.equal(task.triggerCount,2);
  evidence.checks.loginRecoveryConfiguration={pass:true,...task,actualLogin:'UNVERIFIED'};
  await save();
  // A fresh Listener must survive its Task Scheduler parent too. Use a free
  // fixture port and isolated developer stores; never stop the real MCP origin.
  const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const helper=path.join(root,'scripts/start-mcp-tailscale.ps1');
  await writeFile(fixtureScript, '\ufeff'+[
    "$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1'",
    "$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1'",
    "$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1'",
    "$env:MCP_TOOL_PROFILE='chatgpt_public'",
    `& ${quote(helper)} -EnsureMcpOnly -McpPort ${port}`,
    'exit $LASTEXITCODE',
  ].join('\n'));
  ps(`$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $a=New-ScheduledTaskAction -Execute "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${fixtureScript}"'; $p=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited; $s=New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit (New-TimeSpan -Minutes 2); Register-ScheduledTask -TaskName '${fixtureTask}' -Action $a -Principal $p -Settings $s -Force | Out-Null; Start-ScheduledTask -TaskName '${fixtureTask}'`);
  let localTask;
  const listenerDeadline=Date.now()+45_000;
  while(Date.now()<listenerDeadline){
    await sleep(1000);
    try {
      const response=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)});
      const health=await response.json();
      assert.equal(health.service,'writer-workbench-mcp'); fixturePid=health.pid;
      localTask=JSON.parse(ps(`$t=Get-ScheduledTask -TaskName '${fixtureTask}'; $i=Get-ScheduledTaskInfo -TaskName '${fixtureTask}'; @{state=[string]$t.State;result=$i.LastTaskResult} | ConvertTo-Json -Compress`));
      if(localTask.state==='Ready' && localTask.result===0)break;
    } catch { }
  }
  assert(fixturePid && localTask?.state==='Ready' && localTask?.result===0,'Fresh MCP Listener must outlive a successfully completed scheduled startup.');
  const afterTask=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(2000)});
  assert.equal((await afterTask.json()).pid,fixturePid);
  evidence.checks.scheduledMcpListenerSurvival={pass:true,taskResult:localTask.result};
  assert.equal(otherTransports(),before,'Listener recovery must not change existing transports.');
  evidence.finishedAt=new Date().toISOString();
  await save();
  console.log('Secure Tunnel live acceptance passed; actual Windows login and ChatGPT UI remain unverified.');
} catch(error) {
  evidence.failures.push(error.message); await save(); throw error;
} finally {
  if(parent && parent.exitCode===null)parent.kill();
  ps(`$t=Get-ScheduledTask -TaskName '${fixtureTask}' -ErrorAction SilentlyContinue; if($t){Stop-ScheduledTask -TaskName '${fixtureTask}' -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName '${fixtureTask}' -Confirm:$false}`);
  if(fixturePid)ps(`$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${fixturePid}'; if($p -and $p.CommandLine -like '*mcp-http-server.mjs*'){Stop-Process -Id ${fixturePid} -ErrorAction SilentlyContinue}`);
  await rm(fixtureScript,{force:true});
}
}
