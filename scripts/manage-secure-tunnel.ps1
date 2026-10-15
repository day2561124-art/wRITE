param(
  [ValidateSet('Start','Restart','Status','Stop','Reconcile','Uninstall')]
  [string]$Action = 'Status',
  [switch]$Json,
  [switch]$ProbeSession,
  [string]$DataDirectory = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ArmedAcademy\SecureTunnel')
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ManagerPath = Join-Path $PSScriptRoot 'manage-secure-tunnel.ps1'
$Alias = 'writer-workbench'
$TaskName = 'ArmedAcademy.WriterWorkbench.SecureTunnel'
$ConfigPath = Join-Path $DataDirectory 'launcher.json'
$DesiredPath = Join-Path $DataDirectory 'enabled'
$CredentialPath = Join-Path $DataDirectory 'runtime-key.dpapi'
$KeyVariable = 'WRITER_WORKBENCH_TUNNEL_API_KEY'

function Invoke-Native {
  param([string[]]$Arguments)
  # Never return raw native output: it may contain remote error bodies/log tails.
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $script:Config.client
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.WorkingDirectory = $script:Config.root
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  foreach ($value in $Arguments) {
    if ($value -match '["\r\n\x00]' -or $value.EndsWith('\')) { throw 'UNSAFE_NATIVE_ARGUMENT' }
  }
  $start.Arguments = ($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
  $process = New-Object Diagnostics.Process
  $process.StartInfo = $start
  try {
    $null = $process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(60000)) {
      # Kill only our short-lived CLI invocation, never its Runtime descendants.
      $process.Kill()
      throw 'NATIVE_COMMAND_TIMEOUT'
    }
    $raw = $stdout.GetAwaiter().GetResult()
    $null = $stderr.GetAwaiter().GetResult()
    $value = $null
    if ($raw.Length -le 2097152) {
      try { $value = $raw | ConvertFrom-Json } catch { }
    }
    return [pscustomobject]@{ code = $process.ExitCode; value = $value }
  } finally { $process.Dispose() }
}

function Read-Configuration {
  if (Test-Path -LiteralPath $ConfigPath) {
    $saved = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($saved.root -ne $Root -or $saved.alias -ne $Alias -or
        -not (Test-Path -LiteralPath $saved.client -PathType Leaf)) { throw 'CONFIGURATION_IDENTITY_MISMATCH' }
    return $saved
  }
  $client = Get-Command tunnel-client.exe -ErrorAction Stop
  $profile = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'tunnel-client\writer-workbench.yaml'
  if (-not (Test-Path -LiteralPath $profile -PathType Leaf)) { throw 'EXISTING_WRITER_PROFILE_REQUIRED' }
  $source = Get-Content -LiteralPath $profile -Raw
  # Import only the supported simple HTTP profile. Advanced authentication/TLS
  # settings must never be silently dropped by runtimes connect's generator.
  $allowed = @('config_version','control_plane','base_url','tunnel_id','api_key','health','listen_addr','url_file','admin_ui','open_browser','log','level','format','mcp','server_urls','channel','url')
  foreach ($line in ($source -split '\r?\n')) {
    if ($line -match '^\s*(?:-\s*)?([a-z_]+)\s*:') {
      if ($Matches[1] -notin $allowed) { throw 'ADVANCED_PROFILE_REQUIRES_EXPLICIT_REVIEW' }
    } elseif ($line.Trim() -and -not $line.Trim().StartsWith('#')) { throw 'UNSUPPORTED_PROFILE_FORMAT' }
  }
  $ids = [regex]::Matches($source, '(?m)^\s+tunnel_id:\s*"?(tunnel_[a-f0-9]{32})"?\s*$')
  $urls = [regex]::Matches($source, '(?m)^\s+url:\s*"?(http://127\.0\.0\.1:[0-9]+/mcp)"?\s*$')
  if ($ids.Count -ne 1 -or $urls.Count -ne 1 -or
      $source -notmatch '(?m)^\s+base_url:\s*"?https://api\.openai\.com"?\s*$' -or
      $source -notmatch '(?m)^\s+api_key:\s*"?env:[A-Z_0-9]+"?\s*$') { throw 'UNSUPPORTED_PROFILE_IDENTITY' }
  return [pscustomobject]@{ version = 1; root = $Root; alias = $Alias; client = $client.Source;
    tunnelId = $ids[0].Groups[1].Value; mcpUrl = $urls[0].Groups[1].Value;
    profileDirectory = (Join-Path $DataDirectory 'profiles'); sourceProfile = $profile }
}

function Use-Credential {
  param([scriptblock]$Callback)
  if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) { throw 'RUNTIME_CREDENTIAL_REQUIRED' }
  $secure = $null
  $pointer = [IntPtr]::Zero
  $previous = [Environment]::GetEnvironmentVariable($KeyVariable, 'Process')
  try {
    # Node/pwsh parents can pass a PSModulePath containing incompatible PS7
    # modules. Load this Windows PowerShell host's own DPAPI cmdlets explicitly.
    Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
    $secure = ConvertTo-SecureString ((Get-Content -LiteralPath $CredentialPath -Raw).Trim())
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    [Environment]::SetEnvironmentVariable($KeyVariable, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), 'Process')
    & $Callback
  } finally {
    [Environment]::SetEnvironmentVariable($KeyVariable, $previous, 'Process')
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($secure) { $secure.Dispose() }
  }
}

function Get-Runtime {
  $reply = Invoke-Native -Arguments @('runtimes','status',$Alias,'--json')
  if (-not $reply.value) {
    # Distinguish unknown alias from CLI failure using the native local registry.
    $list = Invoke-Native -Arguments @('runtimes','list','--json')
    if ($list.code -ne 0 -or -not $list.value -or $null -eq $list.value.aliases) { throw 'NATIVE_STATUS_UNAVAILABLE' }
    if (@($list.value.aliases | Where-Object { $_.alias -eq $Alias }).Count -gt 0) { throw 'NATIVE_STATUS_UNAVAILABLE' }
    return $null
  }
  $status = $reply.value
  $id = if ($status.tunnel.id) { $status.tunnel.id } else { $status.process.tunnel_id }
  if ($id -ne $script:Config.tunnelId) { throw 'EXISTING_RUNTIME_IDENTITY_MISMATCH' }
  if ($status.process.target_value -and $status.process.target_value -ne $script:Config.mcpUrl) { throw 'EXISTING_RUNTIME_TARGET_MISMATCH' }
  return $status
}

function Get-HttpCheck {
  param([string]$Url, [string]$ExpectedProperty)
  try {
    $reply = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3 -MaximumRedirection 0
    $valid = $reply.StatusCode -eq 200
    if ($ExpectedProperty) {
      $body = $reply.Content | ConvertFrom-Json
      $valid = $valid -and ($body.service -eq 'writer-workbench-mcp') -and [bool]$body.repositoryId -and [bool]$body.instanceId
    }
    return $(if ($valid) { 'PASS' } else { 'FAIL' })
  } catch { return 'FAIL' }
}

function Get-Diagnostics {
  param($Runtime)
  $origin = ([uri]$script:Config.mcpUrl).GetLeftPart([UriPartial]::Authority)
  $socket = New-Object Net.Sockets.TcpClient
  $listener = 'FAIL'
  try {
    if ($socket.ConnectAsync('127.0.0.1', ([uri]$origin).Port).Wait(750) -and $socket.Connected) { $listener = 'PASS' }
  } catch { } finally { $socket.Dispose() }
  $live = $false; $ready = $false; $poll = 'unknown'
  if ($Runtime) {
    # Native healthy/ready are actual endpoint observations, never PID inference.
    $live = $Runtime.healthy -eq $true -and $Runtime.local.effective_health.healthz.ok -eq $true
    $ready = $Runtime.ready -eq $true -and $Runtime.local.effective_health.readyz.ok -eq $true
    $poll = [string]$Runtime.local.control_plane_poll_health.state
    $detailsUrl = [string]$Runtime.local.effective_health.health_details_url
    # 0.0.15 may omit the admin UI system snapshot from native status while
    # exposing the authoritative control-plane observation on detailed health.
    if ($detailsUrl) {
      $uri = [uri]$detailsUrl
      if ($uri.Scheme -eq 'http' -and $uri.Host -eq '127.0.0.1') {
        try {
          $details = Invoke-RestMethod -Uri $uri -TimeoutSec 3
          $control = $details.components.'control-plane'
          $age = ((Get-Date).ToUniversalTime() - [DateTime]::Parse($control.details.last_success).ToUniversalTime()).TotalSeconds
          if ($details.live -eq $true -and $control.status -eq 'ok' -and
              $control.details.consecutive_failures -eq 0 -and $age -ge 0 -and $age -le 90) { $poll = 'healthy' }
          else { $poll = 'degraded' }
        } catch { $poll = 'unknown' }
      }
    }
  }
  $session = 'UNVERIFIED (initialize + tools/list required)'
  if ($ProbeSession) {
    $priorTimeout = $env:PROBE_OP_TIMEOUT_MS
    try {
      $env:PROBE_OP_TIMEOUT_MS = '30000'
      $probe = Join-Path $Root 'scripts\probe-mcp.mjs'
      $probeOutput = & node $probe $script:Config.mcpUrl 'probe' 2>$null
      if ($LASTEXITCODE -eq 0 -and ($probeOutput | ConvertFrom-Json).pid) { $session = 'PASS' }
      else { $session = 'FAIL' }
    } catch { $session = 'FAIL' }
    finally {
      if ($null -eq $priorTimeout) { Remove-Item Env:\PROBE_OP_TIMEOUT_MS -ErrorAction SilentlyContinue }
      else { $env:PROBE_OP_TIMEOUT_MS = $priorTimeout }
    }
  }
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  return [pscustomobject][ordered]@{
    alias = $Alias; desiredRunning = (Test-Path -LiteralPath $DesiredPath);
    credentialStored = (Test-Path -LiteralPath $CredentialPath);
    localListener = $listener;
    localHealth = Get-HttpCheck "$origin/health" 'identity';
    localHealthz = 'UNSUPPORTED (MCP uses /health)';
    localReadyz = 'UNSUPPORTED (MCP uses session-scoped /ready)';
    localSession = $session;
    runtimeRunning = [bool]($Runtime -and $Runtime.process_running);
    runtimeHealthz = $(if ($live) { 'PASS' } else { 'FAIL' });
    runtimeReadyz = $(if ($ready) { 'PASS' } else { 'FAIL' });
    controlPlanePolling = $poll;
    remoteReachability = 'UNVERIFIED (requires OpenAI-origin MCP request)';
    chatgptMcpCall = 'UNVERIFIED (verify in ChatGPT)';
    loginRecovery = $(if ($task -and $task.State -ne 'Disabled') { 'CONFIGURED; actual login UNVERIFIED' } else { 'DISABLED' });
    healthUrl = $(if ($Runtime) { [string]$Runtime.health_url } else { '' });
    ready = [bool]($live -and $ready -and $poll -eq 'healthy')
  }
}

function Register-RecoveryTask {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $ManagerPath + '" -Action Reconcile -DataDirectory "' + $DataDirectory + '"'
  $taskAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $arguments -WorkingDirectory $Root
  $login = New-ScheduledTaskTrigger -AtLogOn -User $sid
  $periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
  $principal = New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -Hidden -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  $null = Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger @($login,$periodic) -Principal $principal -Settings $settings -Description 'Restore only the existing Writer Workbench Secure Tunnel; native tunnel-client owns Runtime processes.' -Force
}

function Connect-Runtime {
  # A foreground `run` not registered with native lifecycle metadata cannot
  # safely be adopted/stopped by PID. Refuse ambiguity rather than duplicating it.
  $foreground = @(Get-CimInstance Win32_Process -Filter "Name = 'tunnel-client.exe'" -ErrorAction Stop | Where-Object {
    $_.CommandLine -match '(?:^|[\s"])run(?:[\s"]|$)'
  })
  if ($foreground.Count -gt 0) { throw 'UNMANAGED_TUNNEL_RUNTIME_PRESENT' }
  $reply = Use-Credential {
    Invoke-Native -Arguments @('runtimes','connect','--alias',$Alias,'--tunnel-id',$script:Config.tunnelId,
      '--profile','writer-workbench-launcher','--profile-dir',$script:Config.profileDirectory,
      '--mcp-server-url',$script:Config.mcpUrl,'--runtime-api-key',"env:$KeyVariable",'--json')
  }
  if ($reply.code -ne 0 -or -not $reply.value) { throw 'NATIVE_CONNECT_FAILED' }
}

function Ensure-LocalMcp {
  # Reuse the existing launcher startup/identity mechanism. This mode never
  # changes Funnel and refuses to restart any occupied Listener.
  $helper = Join-Path $Root 'scripts\start-mcp-tailscale.ps1'
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $start.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $helper + '" -EnsureMcpOnly -McpPort ' + ([uri]$script:Config.mcpUrl).Port
  $start.WorkingDirectory = $Root
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = New-Object Diagnostics.Process
  $process.StartInfo = $start
  try {
    $null = $process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(45000)) { $process.Kill(); throw 'LOCAL_MCP_START_TIMEOUT' }
    $null = $stdout.GetAwaiter().GetResult()
    $null = $stderr.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { throw 'LOCAL_MCP_START_FAILED' }
  } finally { $process.Dispose() }
}

function New-OperationMutex {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  return (New-Object Threading.Mutex($false, "Global\ArmedAcademy.SecureTunnel.$sid"))
}

function Invoke-ManagedAction {
 $mutex = $null; $held = $false
 try {
  $script:Config = Read-Configuration
  if ($Action -eq 'Status') {
    $runtime = Get-Runtime
    $diagnostics = Get-Diagnostics $runtime
  } else {
    # Global per-user lock also fences Launcher versus Task Scheduler sessions.
    $mutex = New-OperationMutex
    try { $held = $mutex.WaitOne(10000) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'SECURE_TUNNEL_OPERATION_BUSY' }
    if ($Action -eq 'Reconcile' -and -not (Test-Path -LiteralPath $DesiredPath)) { return [pscustomobject]@{ skipped = $true; ready = $false } }
    $runtime = Get-Runtime
    if ($Action -in @('Stop','Uninstall')) {
      # Disable intent before stop, so a periodic invocation cannot resurrect it.
      Remove-Item -LiteralPath $DesiredPath -Force -ErrorAction SilentlyContinue
      $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
      if ($task) { $null = Disable-ScheduledTask -TaskName $TaskName }
      if ($runtime -and $runtime.process_running) {
        $stopped = Invoke-Native -Arguments @('runtimes','stop',$Alias,'--json')
        if ($stopped.code -ne 0) { throw 'NATIVE_STOP_FAILED' }
      }
      $runtime = Get-Runtime
      if ($runtime -and $runtime.process_running) { throw 'RUNTIME_STILL_RUNNING' }
      if ($Action -eq 'Uninstall' -and $task) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
    } else {
      if (-not (Test-Path -LiteralPath $CredentialPath)) { throw 'RUNTIME_CREDENTIAL_REQUIRED' }
      if ($Action -ne 'Reconcile') {
        New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
        $script:Config | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
        Register-RecoveryTask
        [IO.File]::WriteAllText($DesiredPath, 'running')
      }
      Ensure-LocalMcp
      # Adopt an existing managed Runtime without killing it. Explicit restart
      # applies only to the exact alias/tunnel/target already verified above.
      if ($Action -eq 'Restart' -and $runtime -and $runtime.process_running) {
        $reply = Invoke-Native -Arguments @('runtimes','stop',$Alias,'--json')
        if ($reply.code -ne 0) { throw 'NATIVE_STOP_FAILED' }
        $runtime = Get-Runtime
        if ($runtime -and $runtime.process_running) { throw 'RUNTIME_STILL_RUNNING' }
      }
      $launched = -not $runtime -or -not $runtime.process_running
      if ($launched) { Connect-Runtime }
      # A live but degraded Runtime is never killed for transient network errors.
      $runtime = Get-Runtime
    }
    $diagnostics = Get-Diagnostics $runtime
    if ($launched) {
      # The first successful long poll can take the full native 30 s wait.
      $deadline = (Get-Date).AddSeconds(45)
      while (-not $diagnostics.ready -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 1000
        $runtime = Get-Runtime
        $diagnostics = Get-Diagnostics $runtime
      }
    }
  }
  return $diagnostics
 } finally {
   if ($held) { $mutex.ReleaseMutex() }
   if ($mutex) { $mutex.Dispose() }
 }
}

try {
  $diagnostics = Invoke-ManagedAction
  if ($Json) { $diagnostics | ConvertTo-Json -Compress }
  else { $diagnostics | Format-List | Out-Host }
  if ($Action -in @('Stop','Uninstall','Reconcile')) { exit 0 }
  if ($diagnostics.ready) { exit 0 } else { exit 1 }
} catch {
  # Fixed error classes only. No raw exception, native log, key or HTTP body.
  $code = [string]$_.Exception.Message
  if ($code -notmatch '^[A-Z][A-Z0-9_]{3,80}$') { $code = 'SECURE_TUNNEL_OPERATION_FAILED' }
  $line = $_.InvocationInfo.ScriptLineNumber
  $type = $_.Exception.GetType().Name
  $command = [string]$_.InvocationInfo.MyCommand.Name
  if ($command -notmatch '^[A-Za-z][A-Za-z0-9-]{0,80}$') { $command = 'unknown' }
  if ($Json) { @{ error = $code; ready = $false; errorLine = $line; errorType = $type; errorCommand = $command } | ConvertTo-Json -Compress }
  else { Write-Host "Secure Tunnel: $code ($type, line $line, command $command)" -ForegroundColor Red }
  exit 1
}
