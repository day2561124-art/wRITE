param(
  [ValidateSet('Scheduled','ArmLogin','Logon','Complete')][string]$Mode = 'Scheduled',
  [string]$Action,
  [switch]$Json,
  [string]$DataDirectory
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1')
$Root = Split-Path -Parent $PSScriptRoot
$private = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ArmedAcademy\SecureTunnel'
$evidencePath = Join-Path $private 'login-recovery-acceptance.json'
$armPath = Join-Path $private 'login-recovery-armed.json'
$loginMarker = Join-Path $private 'actual-logon'
$taskName = 'ArmedAcademy.WriterWorkbench.SecureTunnel.Acceptance'
$productionName = 'ArmedAcademy.WriterWorkbench.SecureTunnel'
$manager = Join-Path $Root 'scripts\manage-secure-tunnel.ps1'
$testScript = $PSCommandPath
function Assert($condition,$message) { if (-not $condition) { throw $message } }
function Invoke-HiddenPowerShell([string]$arguments) {
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $start.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass ' + $arguments
  $start.WorkingDirectory = $Root
  $start.UseShellExecute = $false; $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
  $process = New-Object Diagnostics.Process
  $process.StartInfo = $start
  try {
    $null = $process.Start()
    $output = $process.StandardOutput.ReadToEndAsync(); $errors = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'ACCEPTANCE_CHILD_TIMEOUT' }
    $raw = $output.GetAwaiter().GetResult(); $null = $errors.GetAwaiter().GetResult()
    Assert ($process.ExitCode -eq 0) 'ACCEPTANCE_CHILD_FAILED'
    return $raw
  } finally { $process.Dispose() }
}
function Get-RecoveryHashes {
  $hashes = [ordered]@{}
  foreach ($name in @('scripts/manage-secure-tunnel.ps1','scripts/secure-tunnel-recovery-host.cs','scripts/start-headless-mcp.mjs','scripts/start-mcp-tailscale.ps1','tests/secure-tunnel-recovery-windows.ps1','tests/secure-tunnel-window-observer.cs','server/src/mcp-http-server.mjs','server/src/mcp-http-identity.mjs','server/src/mcp-http-sse-keepalive.mjs','server/src/mcp-http-stdio-adapter.mjs','server/src/mcp-server.mjs','server/src/mcp-runtime-readiness.mjs','package-lock.json')) {
    $hashes[$name] = (Get-FileHash -LiteralPath (Join-Path $Root $name)).Hash
  }
  return $hashes
}

function Get-LoginIdentity {
  return [pscustomobject]@{
    launcherSha256=(Get-FileHash -LiteralPath (Join-Path $private 'launcher.json') -Algorithm SHA256).Hash
    credentialSha256=(Get-FileHash -LiteralPath (Join-Path $private 'runtime-key.dpapi') -Algorithm SHA256).Hash
  }
}
function Assert-LoginIdentity($expected) {
  Assert ($expected -and $expected.launcherSha256 -match '^[A-Fa-f0-9]{64}$' -and $expected.credentialSha256 -match '^[A-Fa-f0-9]{64}$') 'ARMED_IDENTITY_REQUIRED'
  $current=Get-LoginIdentity
  Assert ($current.launcherSha256 -eq $expected.launcherSha256) 'ARMED_CONFIGURATION_CHANGED'
  Assert ($current.credentialSha256 -eq $expected.credentialSha256) 'ARMED_CREDENTIAL_CHANGED'
}
function Invoke-McpSessionProbe([int]$probePort) {
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=(Get-Command node.exe -ErrorAction Stop).Source
  $start.Arguments='"'+(Join-Path $Root 'scripts\probe-mcp.mjs')+'" "http://127.0.0.1:'+$probePort+'/mcp" probe'
  $start.WorkingDirectory=$Root
  $start.UseShellExecute=$false; $start.CreateNoWindow=$true
  $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
  $child=New-Object Diagnostics.Process
  $child.StartInfo=$start
  try {
    $null=$child.Start()
    $out=$child.StandardOutput.ReadToEndAsync(); $err=$child.StandardError.ReadToEndAsync()
    if(-not $child.WaitForExit(65000)){ $child.Kill(); throw 'MCP_LOGIN_PROBE_TIMEOUT' }
    $raw=$out.GetAwaiter().GetResult(); $null=$err.GetAwaiter().GetResult()
    Assert ($child.ExitCode -eq 0) 'MCP_LOGIN_PROBE_FAILED'
    $result=$raw | ConvertFrom-Json
    Assert ($result.current -and $result.ok -and $result.ready -and $result.runtimeReadiness -eq 'ready' -and $result.toolCount -gt 0) 'MCP_LOGIN_SESSION_NOT_READY'
    return $result
  } finally { $child.Dispose() }
}
if ($Mode -eq 'Complete') {
  $receipt = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
  $armed = Get-Content -LiteralPath $armPath -Raw | ConvertFrom-Json
  Assert ($receipt.pass -and $receipt.actualLogin -eq 'PASS' -and $receipt.mode -eq 'Logon') 'ACTUAL_LOGIN_ACCEPTANCE_REQUIRED'
  Assert ([DateTime]::Parse($receipt.startedAt) -gt [DateTime]::Parse($armed.armedAt)) 'STALE_LOGIN_RECEIPT'
  foreach ($name in (Get-RecoveryHashes).Keys) {
    Assert ((Get-RecoveryHashes)[$name] -eq $receipt.hashes.$name -and $receipt.hashes.$name -eq $armed.hashes.$name) 'ACCEPTED_SOURCE_CHANGED'
  }
  Assert-LoginIdentity $armed.identity
  Assert ($receipt.identity.launcherSha256 -eq $armed.identity.launcherSha256 -and $receipt.identity.credentialSha256 -eq $armed.identity.credentialSha256) 'LOGIN_IDENTITY_RECEIPT_MISMATCH'
  $task = Get-ScheduledTask -TaskName $productionName
  $expectedHost = 'recovery-host-' + ((Get-RecoveryHashes)['scripts/secure-tunnel-recovery-host.cs']).ToLowerInvariant() + '.exe'
  Assert ((Split-Path -Leaf $task.Actions.Execute) -eq $expectedHost) 'ACCEPTED_TASK_HOST_CHANGED'
  $status = Invoke-HiddenPowerShell ('-File "' + $manager + '" -Action Status -Json') | ConvertFrom-Json
  Assert ($status.ready -and $status.localHealth -eq 'PASS' -and $status.desiredRunning) 'CURRENT_RECOVERY_NOT_READY'
  $hold = Join-Path $private 'recovery-validation-pending'
  Remove-Item -LiteralPath $hold -Force -ErrorAction Stop
  try { $null = Enable-ScheduledTask -TaskName $productionName }
  catch { [IO.File]::WriteAllText($hold,'Enable failed; acceptance hold retained.'); throw }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output 'PASS: actual login and source hashes verified; production recovery enabled.'
  exit 0
}
if ($Mode -eq 'ArmLogin') {
  Assert ((Get-ScheduledTask -TaskName $productionName).State -eq 'Disabled') 'PRODUCTION_MUST_STAY_DISABLED'
  $ast = [Management.Automation.Language.Parser]::ParseFile($manager,[ref]$null,[ref]$null)
  $fn = $ast.Find({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq 'Ensure-RecoveryHost'},$false)
  Invoke-Expression $fn.Extent.Text
  $DataDirectory = $private
  $hostPath = Ensure-RecoveryHost
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  # Host's fixed -Action Reconcile arguments bind to the test script. DataDirectory
  # is an explicit mode marker; normal scheduled validation never claims logon.
  $taskAction = New-ScheduledTaskAction -Execute $hostPath -Argument ('"' + $testScript + '" "' + $loginMarker + '"') -WorkingDirectory $Root
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $sid
  $principal = New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
  @{armedAt=[DateTime]::UtcNow.ToString('o');hashes=Get-RecoveryHashes;identity=Get-LoginIdentity} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $armPath -Encoding UTF8
  $null = Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Force
  Write-Output 'ARMED: next actual Windows login; production task remains DISABLED.'
  exit 0
}
if ($DataDirectory -eq $loginMarker) { $Mode = 'Logon' }
$evidence = [ordered]@{ startedAt=[DateTime]::UtcNow.ToString('o'); mode=$Mode; actualLogin='UNVERIFIED'; pass=$false; hashes=Get-RecoveryHashes }
$observer = $null
$fixtureTask = 'ArmedAcademy.SecureTunnel.WindowRegression.' + $PID
$fixtureDir = Join-Path $Root ("tests\.tmp\secure-recovery-$PID")
$listenerPid = $null
try {
  Assert ((Get-ScheduledTask -TaskName $productionName).State -eq 'Disabled') 'PRODUCTION_MUST_STAY_DISABLED'
  if ($Mode -eq 'Logon') {
    $armed = Get-Content -LiteralPath $armPath -Raw | ConvertFrom-Json
    # The process token's AuthenticationId identifies this actual Windows logon,
    # rather than a recent unrelated network/service logon on the machine.
    Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class AcceptanceLogon {
 [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr t,int c,byte[] b,int n,out int r);
 public static long Id(IntPtr token) { var b=new byte[128]; int n; if(!GetTokenInformation(token,10,b,b.Length,out n)) throw new Exception(); return BitConverter.ToInt64(b,8); }
}
'@
    $logonId = [AcceptanceLogon]::Id([Security.Principal.WindowsIdentity]::GetCurrent().Token)
    $session = Get-CimInstance Win32_LogonSession -Filter ("LogonId='$logonId'")
    Assert ($session -and $session.LogonType -in @(2,10,11) -and $session.StartTime.ToUniversalTime() -gt [DateTime]::Parse($armed.armedAt).ToUniversalTime()) 'FRESH_INTERACTIVE_LOGIN_REQUIRED'
    foreach ($name in $evidence.hashes.Keys) { Assert ($evidence.hashes[$name] -eq $armed.hashes.$name) 'ARMED_SOURCE_CHANGED' }
    Assert-LoginIdentity $armed.identity
    $evidence.actualLogin = 'PASS'
    $evidence.logonStartedAt = $session.StartTime.ToUniversalTime().ToString('o')
  }
  Add-Type -Path (Join-Path $PSScriptRoot 'secure-tunnel-window-observer.cs')
  [SecureTunnelWindowObserver]::VerifyHook()
  $evidence.windowObserverSelfTest = 'PASS'
  $observer = New-Object SecureTunnelWindowObserver
  $evidence.identity=Get-LoginIdentity
  $before = Get-Content -LiteralPath (Join-Path $private 'launcher.json') -Raw
  $credentialBefore = (Get-FileHash -LiteralPath (Join-Path $private 'runtime-key.dpapi')).Hash
  # Exercise the registered GUI action through the real scheduler, while keeping
  # the disabled production task untouched. Reconcile retains the existing ID.
  $production = Get-ScheduledTask -TaskName $productionName
  Assert ($production.Actions.Execute -like '*recovery-host-*.exe') 'REPAIR_DISABLED_TASK_FIRST'
  $settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
  $null = Register-ScheduledTask -TaskName $fixtureTask -Action $production.Actions -Principal $production.Principal -Settings $settings -Force
  function Run-FixtureTask {
    Write-Host 'Running temporary recovery task.'
    $lastRun = (Get-ScheduledTaskInfo -TaskName $fixtureTask).LastRunTime
    Start-ScheduledTask -TaskName $fixtureTask
    $deadline = (Get-Date).AddSeconds(110)
    do { Start-Sleep -Milliseconds 200; $task = Get-ScheduledTask -TaskName $fixtureTask; $info = Get-ScheduledTaskInfo -TaskName $fixtureTask } while (($info.LastRunTime -le $lastRun -or $task.State -in @('Running','Queued') -or $info.LastTaskResult -eq 267009) -and (Get-Date) -lt $deadline)
    Assert ($info.LastRunTime -gt $lastRun -and $task.State -notin @('Running','Queued') -and $info.LastTaskResult -eq 0) 'SCHEDULED_RECOVERY_FAILED'
    Write-Host 'Temporary recovery task exited successfully.'
  }
  Run-FixtureTask
  $status = Invoke-HiddenPowerShell ('-File "' + $manager + '" -Action Status -Json') | ConvertFrom-Json
  Assert ($status.ready -and $status.localHealth -eq 'PASS') 'RECOVERED_RUNTIME_AND_MCP_REQUIRED'
  $config = $before | ConvertFrom-Json
  $nativeBefore = & $config.client runtimes status writer-workbench --json 2>$null | ConvertFrom-Json
  Assert ($nativeBefore.tunnel.id -eq $config.tunnelId -or $nativeBefore.process.tunnel_id -eq $config.tunnelId) 'RUNTIME_IDENTITY_CHANGED'
  # Stop only the verified native alias, retaining the enabled intent marker.
  # The shared MCP Listener and its Pi worker remain running.
  $stopScript = Join-Path $private 'acceptance-native-stop.ps1'
  @"
`$c=Get-Content -LiteralPath '$($private.Replace("'","''"))\launcher.json' -Raw | ConvertFrom-Json
`$r=& `$c.client runtimes status writer-workbench --json 2>`$null | ConvertFrom-Json
if(`$r.tunnel.id -ne `$c.tunnelId -and `$r.process.tunnel_id -ne `$c.tunnelId){exit 2}
& `$c.client runtimes stop writer-workbench --json 2>`$null | Out-Null
exit `$LASTEXITCODE
"@ | Set-Content -LiteralPath $stopScript -Encoding UTF8
  try { $null = Invoke-HiddenPowerShell ('-File "' + $stopScript + '"') }
  finally { Remove-Item -LiteralPath $stopScript -Force -ErrorAction SilentlyContinue }
  Run-FixtureTask
  $nativeRecovered = & $config.client runtimes status writer-workbench --json 2>$null | ConvertFrom-Json
  Assert ($nativeRecovered.process_running -and $nativeRecovered.process.pid -ne $nativeBefore.process.pid -and $nativeRecovered.healthy -and $nativeRecovered.ready) 'RUNTIME_NOT_RECOVERED'
  $evidence.stoppedRuntimeRecovered = 'PASS'
  Run-FixtureTask
  $nativeAfter = & $config.client runtimes status writer-workbench --json 2>$null | ConvertFrom-Json
  Assert ($nativeRecovered.process.pid -eq $nativeAfter.process.pid) 'DUPLICATE_RUNTIME'
  $evidence.scheduledReconcile = 'PASS'
  $evidence.duplicateRuntime = 'PASS'
  # Fresh Listener on a free fixture port with isolated developer stores.
  $socket = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
  $socket.Start(); $port = $socket.LocalEndpoint.Port; $socket.Stop()
  $evidence.fixturePort = $port
  New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
  $fixtureScript = Join-Path $fixtureDir 'listener.ps1'
  @"
param(`$Action,[switch]`$Json,`$DataDirectory)
`$env:WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1'
`$env:WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1'
`$env:WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1'
`$env:MCP_TOOL_PROFILE='chatgpt_public'
& '$($Root.Replace("'","''"))\scripts\start-mcp-tailscale.ps1' -EnsureMcpOnly -McpPort $port -LogDirectory '$($fixtureDir.Replace("'","''"))'
exit `$LASTEXITCODE
"@ | Set-Content -LiteralPath $fixtureScript -Encoding UTF8
  $fixtureAction = New-ScheduledTaskAction -Execute $production.Actions.Execute -Argument ('"' + $fixtureScript + '" "' + $fixtureDir + '"') -WorkingDirectory $Root
  $null = Register-ScheduledTask -TaskName $fixtureTask -Action $fixtureAction -Principal $production.Principal -Settings $settings -Force
  Run-FixtureTask
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 5
  $listenerPid = $health.pid
  if (-not $listenerPid) { $listenerPid = (Get-NetTCPConnection -State Listen -LocalPort $port).OwningProcess }
  Run-FixtureTask
  Assert ((Get-NetTCPConnection -State Listen -LocalPort $port).OwningProcess -eq $listenerPid) 'DUPLICATE_LISTENER'
  $sessionProbe=Invoke-McpSessionProbe $port
  Assert ($sessionProbe.pid -eq $listenerPid -and $sessionProbe.toolCount -eq 40) 'FRESH_LISTENER_SESSION_IDENTITY_CHANGED'
  $secondProbe=Invoke-McpSessionProbe $port
  Assert ($secondProbe.pid -eq $listenerPid -and $secondProbe.toolCount -eq 40) 'FRESH_LISTENER_SESSION_DUPLICATE'
  $evidence.freshMcpSessions='PASS: initialize, tools/list, resources/list, ready and ping twice'
  $evidence.freshListenerSurvivesScheduler = 'PASS'
  $evidence.duplicateListener = 'PASS'
  Start-Sleep -Milliseconds 500
  $evidence.visibleConsoleEvents = @($observer.Events)
  Assert ($evidence.visibleConsoleEvents.Count -eq 0) 'VISIBLE_CONSOLE_DETECTED'
  Assert ((Get-Content -LiteralPath (Join-Path $private 'launcher.json') -Raw) -eq $before) 'CONFIG_CHANGED'
  Assert ((Get-FileHash -LiteralPath (Join-Path $private 'runtime-key.dpapi')).Hash -eq $credentialBefore) 'CREDENTIAL_CHANGED'
  Assert ((Get-ScheduledTask -TaskName $productionName).State -eq 'Disabled') 'PRODUCTION_WAS_ENABLED'
  Assert-LoginIdentity $evidence.identity
  if($Mode -eq 'Logon'){Assert-LoginIdentity $armed.identity}
  $evidence.credentialsAndIdentityPreserved = 'PASS'
  $evidence.productionRemainsDisabled = $true
  $evidence.pass = $true
} catch {
  $evidence.error = 'RECOVERY_ACCEPTANCE_FAILED'
  $evidence.errorLine = $_.InvocationInfo.ScriptLineNumber
  # Fixed reason codes only; never save raw HTTP/native/credential exceptions.
  if ($_.Exception.Message -match '^[A-Z_]{5,80}$') { $evidence.error = $_.Exception.Message }
} finally {
  if ($observer) { $observer.Dispose() }
  Unregister-ScheduledTask -TaskName $fixtureTask -Confirm:$false -ErrorAction SilentlyContinue
  if (-not $listenerPid -and $port) {
    $candidate = (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess
    if ($candidate) {
      $identity = Get-CimInstance Win32_Process -Filter ("ProcessId=$candidate") -ErrorAction SilentlyContinue
      if ($identity.CommandLine -like ('*' + $Root + '\server\src\mcp-http-server.mjs*--port ' + $port)) { $listenerPid = $candidate }
    }
  }
  if ($listenerPid) { Stop-Process -Id $listenerPid -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $fixtureDir) { Remove-Item -LiteralPath $fixtureDir -Recurse -Force }
  $evidence.finishedAt = [DateTime]::UtcNow.ToString('o')
  $destination = if ($Mode -eq 'Logon') { $evidencePath } else { Join-Path $Root 'outputs\secure-tunnel-window-acceptance.json' }
  $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $destination -Encoding UTF8
  if ($Mode -eq 'Logon') { $null = Disable-ScheduledTask -TaskName $taskName }
}
$evidence | ConvertTo-Json -Depth 6
if (-not $evidence.pass) { exit 1 }
