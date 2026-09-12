param(
  [ValidateRange(1, 65535)]
  [int]$McpPort = 8787,
  [switch]$Status,
  [switch]$StopTunnel,
  [string]$CloudflaredPath,
  [string[]]$CloudflaredPrefixArguments = @(),
  [ValidateRange(1, 300)]
  [int]$RegistrationTimeoutSeconds = 30,
  [ValidateRange(50, 5000)]
  [int]$PollIntervalMilliseconds = 250,
  [string]$LogDirectory
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$LogDir = if ($LogDirectory) {
  [IO.Path]::GetFullPath($LogDirectory)
} else {
  Join-Path $Root "data\outputs\logs"
}
$StatePath = Join-Path $LogDir "cloudflared-tunnel.state.json"
$LauncherLog = Join-Path $LogDir "cloudflared-launcher.log"
$OriginUrl = "http://127.0.0.1:$McpPort"
$RegistrationPattern = "Registered tunnel connection"
$QuicFailurePattern = "Failed to dial a quic connection|QUIC connection failed|UDP Connectivity[^\r\n]*FAIL"
$QuickTunnelUrlPattern = "https://[a-zA-Z0-9-]+\.trycloudflare\.com"

function Invoke-McpProbe {
  param([string]$Endpoint, [string]$Mode = "probe", [string]$ExpectedInstance = "")
  $probeScript = Join-Path $Root "scripts\probe-mcp.mjs"
  $probeOutput = & node $probeScript $Endpoint $Mode $ExpectedInstance
  if ($LASTEXITCODE -ne 0) { return $null }
  try { return ($probeOutput | ConvertFrom-Json) } catch { return $null }
}

function Write-TunnelEvent {
  param([string]$Message)

  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $line = "{0} {1}" -f (Get-Date).ToUniversalTime().ToString("o"), $Message
  Add-Content -LiteralPath $LauncherLog -Value $line -Encoding UTF8
}

function Read-TunnelState {
  if (-not (Test-Path -LiteralPath $StatePath -PathType Leaf)) { return $null }
  try {
    return Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Write-TunnelState {
  param($State)

  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $State.updatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

function Get-ManagedProcess {
  param($State)

  if (-not $State -or -not $State.pid -or -not $State.processStartedAtUtc) { return $null }
  $process = Get-Process -Id ([int]$State.pid) -ErrorAction SilentlyContinue
  if (-not $process) { return $null }

  if ($State.processStartedAtUtc) {
    try {
      $recorded = [DateTime]::Parse([string]$State.processStartedAtUtc).ToUniversalTime()
      $actual = $process.StartTime.ToUniversalTime()
      if ([Math]::Abs(($actual - $recorded).TotalSeconds) -gt 2) { return $null }
    } catch {
      return $null
    }
  }

  $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)" -ErrorAction SilentlyContinue
  if (-not $cim -or -not $cim.CommandLine -or -not $State.originUrl) { return $null }
  $originPattern = '--url\s+"?' + [regex]::Escape([string]$State.originUrl) + '(?:"|\s|$)'
  if ($cim.CommandLine -notmatch $originPattern) { return $null }
  if ($State.executablePath) {
    if (-not [string]::Equals($cim.ExecutablePath, $State.executablePath, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  } elseif ($cim.Name -ne 'cloudflared.exe') { return $null }
  return $process
}

function Get-AttemptLogText {
  param($State)

  $parts = @()
  foreach ($path in @($State.stdoutLog, $State.stderrLog)) {
    if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
      try { $parts += Get-Content -LiteralPath $path -Raw -ErrorAction Stop } catch { }
    }
  }
  return ($parts -join "`n")
}

function Get-Registration {
  param([string]$LogText)

  if (-not $LogText -or $LogText -notmatch $RegistrationPattern) { return $null }

  $registeredLine = ($LogText -split "`r?`n" | Where-Object { $_ -match $RegistrationPattern } | Select-Object -Last 1)
  $protocol = $null
  if ($registeredLine -match "protocol=(quic|http2)") {
    $protocol = $Matches[1].ToLowerInvariant()
  } elseif ($LogText -match "Initial protocol (quic|http2)") {
    $protocol = $Matches[1].ToLowerInvariant()
  }

  $urlMatches = [regex]::Matches($LogText, $QuickTunnelUrlPattern)
  $baseUrl = if ($urlMatches.Count -gt 0) { $urlMatches[$urlMatches.Count - 1].Value } else { $null }
  return [pscustomobject]@{
    Protocol = $protocol
    BaseUrl = $baseUrl
    McpUrl = if ($baseUrl) { "$baseUrl/mcp" } else { $null }
  }
}

function Get-TunnelStatusInfo {
  $state = Read-TunnelState
  if (-not $state) {
    $unmanaged = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
    return [pscustomobject]@{
      ProcessRunning = [bool]$unmanaged
      Pid = if ($unmanaged) { $unmanaged.Id } else { $null }
      Status = if ($unmanaged) { "unverified" } else { "failed" }
      Protocol = $null
      McpUrl = $null
      State = $null
    }
  }

  $process = Get-ManagedProcess $state
  $logText = Get-AttemptLogText $state
  $registration = Get-Registration $logText
  $hasFailure = ($logText -match $QuicFailurePattern)

  if ($process -and $registration) {
    $statusName = "registered / unverified"
    if ($state.originUrl -eq $OriginUrl -and $state.mcpInstanceId -and $registration.McpUrl) {
      $verified = Invoke-McpProbe $registration.McpUrl "probe" $state.mcpInstanceId
      if ($verified) { $statusName = "registered / healthy" }
    }
  } elseif ($process -and -not $hasFailure -and $state.status -eq "connecting") {
    $statusName = "connecting"
  } else {
    $statusName = "failed"
  }

  return [pscustomobject]@{
    ProcessRunning = [bool]$process
    Pid = if ($process) { $process.Id } else { $state.pid }
    Status = $statusName
    Protocol = if ($registration.Protocol) { $registration.Protocol } else { $state.protocol }
    McpUrl = if ($statusName -eq "registered / healthy") { $registration.McpUrl } else { $null }
    State = $state
  }
}

function Show-TunnelStatus {
  $info = Get-TunnelStatusInfo
  Write-Host "Cloudflare process: $(if ($info.ProcessRunning) { "running (PID $($info.Pid))" } else { "stopped" })"
  Write-Host "Tunnel status: $($info.Status)" -ForegroundColor $(if ($info.Status -eq "registered / healthy") { "Green" } elseif ($info.Status -eq "connecting") { "Yellow" } else { "Red" })
  if ($info.Protocol) { Write-Host "Tunnel protocol: $($info.Protocol)" }
  if ($info.McpUrl) {
    Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
    Write-Host $info.McpUrl -ForegroundColor Cyan
  } elseif ($info.Status -eq "unverified") {
    Write-Host "A cloudflared process exists, but this launcher has no Registered tunnel connection evidence for it." -ForegroundColor Yellow
  }
  return ($info.Status -eq "registered / healthy")
}

function Stop-ManagedTunnel {
  param([string]$Reason = "requested")

  $state = Read-TunnelState
  $process = Get-ManagedProcess $state
  if ($process) {
    Write-TunnelEvent "action=stop pid=$($process.Id) reason=$Reason"
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    try { $process.WaitForExit(5000) | Out-Null } catch { }
  }

  if ($state) {
    $state.status = "failed"
    $state.failureReason = $Reason
    $state.mcpUrl = $null
    $state.baseUrl = $null
    Write-TunnelState $state
  }
  return [bool]$process
}

function Test-McpPortOpen {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync("127.0.0.1", $McpPort)
    if (-not $task.Wait(750)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-McpOwningProcess {
  try {
    return (Get-NetTCPConnection -State Listen -LocalPort $McpPort -ErrorAction Stop | Select-Object -First 1).OwningProcess
  } catch {
    return $null
  }
}

function Require-Command {
  param([string]$Name, [string]$InstallHint)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "$Name was not found. $InstallHint" -ForegroundColor Red
    return $null
  }
  return $cmd
}

function Resolve-Cloudflared {
  if ($CloudflaredPath) {
    if (-not (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf)) {
      Write-Host "cloudflared was not found: $CloudflaredPath" -ForegroundColor Red
      return $null
    }
    return [pscustomobject]@{ Source = [IO.Path]::GetFullPath($CloudflaredPath) }
  }
  $command = Get-Command "cloudflared" -ErrorAction SilentlyContinue
  if ($command) { return $command }

  $standardPaths = @(
    (Join-Path ${env:ProgramFiles(x86)} "cloudflared\cloudflared.exe"),
    (Join-Path $env:ProgramFiles "cloudflared\cloudflared.exe")
  )
  foreach ($candidate in $standardPaths) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return [pscustomobject]@{ Source = $candidate }
    }
  }

  Write-Host "cloudflared was not found. Install cloudflared first." -ForegroundColor Red
  return $null
}

function Set-BackendGenerationProviderDefaults {
  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER) { $env:WRITER_BACKEND_GENERATION_PROVIDER = "local_http" }
  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER_ID) { $env:WRITER_BACKEND_GENERATION_PROVIDER_ID = "local-smoke-provider" }
  if (-not $env:WRITER_BACKEND_GENERATION_ENDPOINT) { $env:WRITER_BACKEND_GENERATION_ENDPOINT = "http://127.0.0.1:8799/writer" }
  if (-not $env:WRITER_BACKEND_GENERATION_MODEL) { $env:WRITER_BACKEND_GENERATION_MODEL = "writer-local-provider-smoke" }
  if (-not $env:WRITER_BACKEND_GENERATION_VERSION) { $env:WRITER_BACKEND_GENERATION_VERSION = "smoke-1" }
  if (-not $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS) { $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS = "60000" }

  Write-Host "`n=== Backend generation provider ==="
  Write-Host "WRITER_BACKEND_GENERATION_PROVIDER=$env:WRITER_BACKEND_GENERATION_PROVIDER"
  Write-Host "WRITER_BACKEND_GENERATION_PROVIDER_ID=$env:WRITER_BACKEND_GENERATION_PROVIDER_ID"
  Write-Host "WRITER_BACKEND_GENERATION_ENDPOINT=$env:WRITER_BACKEND_GENERATION_ENDPOINT"
  Write-Host "WRITER_BACKEND_GENERATION_MODEL=$env:WRITER_BACKEND_GENERATION_MODEL"
  Write-Host "WRITER_BACKEND_GENERATION_VERSION=$env:WRITER_BACKEND_GENERATION_VERSION"
  Write-Host "WRITER_BACKEND_GENERATION_TIMEOUT_MS=$env:WRITER_BACKEND_GENERATION_TIMEOUT_MS"
}

function Start-CloudflaredAttempt {
  param(
    $Cloudflared,
    [ValidateSet("auto", "http2")]
    [string]$Protocol,
    [string]$Fallback
  )

  $attemptId = "{0}-{1}-{2}" -f (Get-Date -Format "yyyyMMdd-HHmmssfff"), $Protocol, ([Guid]::NewGuid().ToString("N").Substring(0, 8))
  $cfOut = Join-Path $LogDir "cloudflared.$attemptId.stdout.log"
  $cfErr = Join-Path $LogDir "cloudflared.$attemptId.stderr.log"

  Write-Host "Starting Cloudflare quick tunnel with protocol=$Protocol..." -ForegroundColor Cyan
  Write-TunnelEvent "action=start attempt=$attemptId requested_protocol=$Protocol fallback=$Fallback origin=$OriginUrl"
  $cloudflaredArguments = @($CloudflaredPrefixArguments) + @("tunnel", "--protocol", $Protocol, "--url", $OriginUrl)
  $process = Start-Process `
    -FilePath $Cloudflared.Source `
    -ArgumentList $cloudflaredArguments `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $cfOut `
    -RedirectStandardError $cfErr `
    -PassThru

  $state = [pscustomobject]@{
    version = 2
    executablePath = $Cloudflared.Source
    attemptId = $attemptId
    pid = $process.Id
    processStartedAtUtc = $process.StartTime.ToUniversalTime().ToString("o")
    status = "connecting"
    requestedProtocol = $Protocol
    protocol = $null
    fallback = $Fallback
    mcpInstanceId = $current.instanceId
    originUrl = $OriginUrl
    baseUrl = $null
    mcpUrl = $null
    stdoutLog = $cfOut
    stderrLog = $cfErr
    failureReason = $null
    updatedAtUtc = $null
  }
  Write-TunnelState $state

  Write-Host "CLOUDFLARED_PID=$($process.Id)"
  Write-Host "CLOUDFLARED_OUT_LOG=$cfOut"
  Write-Host "CLOUDFLARED_ERR_LOG=$cfErr"
  return [pscustomobject]@{ Process = $process; State = $state }
}

function Wait-ForTunnelRegistration {
  param($Attempt)

  $deadline = (Get-Date).AddSeconds($RegistrationTimeoutSeconds)
  do {
    Start-Sleep -Milliseconds $PollIntervalMilliseconds
    $Attempt.Process.Refresh()
    if ($Attempt.Process.HasExited) {
      return [pscustomobject]@{ Registered = $false; Reason = "process-exited-$($Attempt.Process.ExitCode)"; Registration = $null }
    }
    $logText = Get-AttemptLogText $Attempt.State
    $registration = Get-Registration $logText
    if ($registration) {
      return [pscustomobject]@{ Registered = $true; Reason = $null; Registration = $registration }
    }
    if ($logText -match $QuicFailurePattern) {
      return [pscustomobject]@{ Registered = $false; Reason = "quic-connectivity-failure"; Registration = $null }
    }
    $Attempt.Process.Refresh()
    if ($Attempt.Process.HasExited) {
      return [pscustomobject]@{ Registered = $false; Reason = "process-exited-$($Attempt.Process.ExitCode)"; Registration = $null }
    }
  } while ((Get-Date) -lt $deadline)

  return [pscustomobject]@{ Registered = $false; Reason = "registration-timeout"; Registration = $null }
}

function Complete-TunnelAttempt {
  param($Attempt, $Registration)

  $actualProtocol = if ($Registration.Protocol) { $Registration.Protocol } else { $Attempt.State.requestedProtocol }
  $Attempt.State.status = "registered"
  $Attempt.State.protocol = $actualProtocol
  $Attempt.State.baseUrl = $Registration.BaseUrl
  $Attempt.State.mcpUrl = $Registration.McpUrl
  $Attempt.State.failureReason = $null
  Write-TunnelState $Attempt.State
  Write-TunnelEvent "action=registered attempt=$($Attempt.State.attemptId) pid=$($Attempt.Process.Id) protocol=$actualProtocol fallback=$($Attempt.State.fallback) url=$($Registration.BaseUrl)"
}

$mutexIdentity = [Text.Encoding]::UTF8.GetBytes("$Root|$LogDir")
$mutexHasher = [System.Security.Cryptography.SHA256]::Create()
try {
  $mutexHash = -join ($mutexHasher.ComputeHash($mutexIdentity) | ForEach-Object { $_.ToString("x2") })
} finally {
  $mutexHasher.Dispose()
}
$launchMutex = New-Object System.Threading.Mutex($false, "Local\WriterMcp-$mutexHash")
$hasMutex = $false
Push-Location $Root
try {
  try { $hasMutex = $launchMutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $hasMutex = $true }
  if (-not $hasMutex) { throw "Another MCP launcher operation is in progress." }
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

  if ($Status) {
    if (Show-TunnelStatus) { exit 0 } else { exit 1 }
  }
  if ($StopTunnel) {
    $stopped = Stop-ManagedTunnel "requested-stop"
    Write-Host $(if ($stopped) { "Managed Cloudflare tunnel process stopped." } else { "No managed Cloudflare tunnel process is running." })
    exit 0
  }

  $cloudflared = Resolve-Cloudflared
  if (-not $cloudflared) { exit 1 }
  Set-BackendGenerationProviderDefaults

  Write-Host "`n=== 1. MCP HTTP server ==="
  $node = Require-Command "node" "Install Node.js 18 or newer first."
  if (-not $node) { exit 1 }
  $mcpScript = [IO.Path]::GetFullPath((Join-Path $Root "server\src\mcp-http-server.mjs"))
  $current = $null
  if (Test-McpPortOpen) {
    $owner = Get-McpOwningProcess
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $owner" -ErrorAction SilentlyContinue
    $identity = Invoke-McpProbe "$OriginUrl/mcp" "identity"
    # Unknown listeners are never stopped. Legacy relative command lines require
    # an operator migration; matching a filename alone cannot establish ownership.
    $owned = $info -and $info.Name -eq "node.exe" -and $info.CommandLine -and
      $info.CommandLine.Replace("/", "\").IndexOf($mcpScript, [StringComparison]::OrdinalIgnoreCase) -ge 0
    if (-not $owned -or -not $identity -or [int]$identity.pid -ne [int]$owner) {
      throw "Port $McpPort is occupied by an unverified process (PID $owner); it was not stopped."
    }
    if ($identity.current) { $current = Invoke-McpProbe "$OriginUrl/mcp" "probe" }
    if (-not $current) {
      # Recheck both PID and start time before stopping our verified instance.
      $again = Get-CimInstance Win32_Process -Filter "ProcessId = $owner"
      if ((Get-McpOwningProcess) -ne $owner -or $again.CreationDate -ne $info.CreationDate) {
        throw "MCP owner changed during validation; refusing to stop it."
      }
      Write-TunnelEvent "action=mcp-restart pid=$owner reason=stale-or-unhealthy"
      & taskkill.exe /PID $owner /T /F | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Could not stop verified MCP PID $owner" }
      $releaseDeadline = (Get-Date).AddSeconds(5)
      while ((Test-McpPortOpen) -and (Get-Date) -lt $releaseDeadline) { Start-Sleep -Milliseconds 100 }
      if (Test-McpPortOpen) { throw "MCP port did not become available." }
    } else {
      Write-Host "Verified current repository MCP server; initialize and tools/list passed."
      Write-Host "MCP_OWNING_PROCESS=$owner"
    }
  }
  if (-not $current) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
    $mcpOut = Join-Path $LogDir "mcp-http.$stamp.stdout.log"
    $mcpErr = Join-Path $LogDir "mcp-http.$stamp.stderr.log"
    $originalMcpToolProfile = $env:MCP_TOOL_PROFILE
    $effectiveMcpToolProfile = if (Test-Path Env:\MCP_TOOL_PROFILE) { $originalMcpToolProfile } else { "chatgpt_developer" }
    try {
      $env:MCP_TOOL_PROFILE = $effectiveMcpToolProfile
      $mcpProcess = Start-Process -FilePath $node.Source `
        -ArgumentList @("`"$mcpScript`"", "--config", "`"$(Join-Path $Root 'config\mcp-http.example.json')`"", "--port", [string]$McpPort) `
        -WorkingDirectory $Root -WindowStyle Hidden `
        -RedirectStandardOutput $mcpOut -RedirectStandardError $mcpErr -PassThru
    } finally {
      if ($null -eq $originalMcpToolProfile) { Remove-Item Env:\MCP_TOOL_PROFILE -ErrorAction SilentlyContinue }
      else { $env:MCP_TOOL_PROFILE = $originalMcpToolProfile }
    }
    Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
    Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
    Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
    Write-Host "MCP_TOOL_PROFILE=$effectiveMcpToolProfile"
    $deadline = (Get-Date).AddSeconds(15)
    do {
      Start-Sleep -Milliseconds 250
      $mcpProcess.Refresh()
      if ($mcpProcess.HasExited) { throw "MCP exited before readiness; see $mcpErr" }
      if (Test-McpPortOpen) { break }
    } while ((Get-Date) -lt $deadline)
    $current = Invoke-McpProbe "$OriginUrl/mcp" "probe"
    if (-not $current -or [int]$current.pid -ne $mcpProcess.Id -or (Get-McpOwningProcess) -ne $mcpProcess.Id) {
      if (-not $mcpProcess.HasExited) { & taskkill.exe /PID $mcpProcess.Id /T /F | Out-Null }
      throw "MCP failed identity / protocol readiness; see $mcpErr"
    }
    Write-Host "MCP HTTP server started and protocol verified."
  }
  Write-Host "MCP_PORT=$McpPort"

  Write-Host "`n=== 2. Cloudflare quick tunnel ==="
  Stop-ManagedTunnel "restart-before-new-attempt" | Out-Null

  $autoAttempt = Start-CloudflaredAttempt $cloudflared "auto" "none"
  $autoResult = Wait-ForTunnelRegistration $autoAttempt
  if ($autoResult.Registered) {
    Complete-TunnelAttempt $autoAttempt $autoResult.Registration
    $successfulAttempt = $autoAttempt
    $successfulRegistration = $autoResult.Registration
  } else {
    Write-Host "Auto/QUIC attempt did not register ($($autoResult.Reason)); falling back to HTTP/2." -ForegroundColor Yellow
    Write-TunnelEvent "action=fallback fallback=quic->http2 failed_attempt=$($autoAttempt.State.attemptId) reason=$($autoResult.Reason)"
    Stop-ManagedTunnel "fallback=quic->http2" | Out-Null

    $http2Attempt = Start-CloudflaredAttempt $cloudflared "http2" "quic->http2"
    $http2Result = Wait-ForTunnelRegistration $http2Attempt
    if (-not $http2Result.Registered) {
      $http2Attempt.State.status = "failed"
      $http2Attempt.State.failureReason = $http2Result.Reason
      $http2Attempt.State.baseUrl = $null
      $http2Attempt.State.mcpUrl = $null
      Write-TunnelState $http2Attempt.State
      Write-TunnelEvent "action=failed attempt=$($http2Attempt.State.attemptId) requested_protocol=http2 fallback=quic->http2 reason=$($http2Result.Reason)"
      Stop-ManagedTunnel "http2-registration-failed" | Out-Null
      Write-Host "Cloudflare tunnel failed to register with HTTP/2: $($http2Result.Reason)" -ForegroundColor Red
      exit 1
    }
    Complete-TunnelAttempt $http2Attempt $http2Result.Registration
    $successfulAttempt = $http2Attempt
    $successfulRegistration = $http2Result.Registration
  }

  Write-Host "`n=== 3. ChatGPT MCP URL ==="
  Write-Host "Tunnel registered; checking public MCP protocol..." -ForegroundColor Cyan
  Write-Host "TUNNEL_PROTOCOL=$($successfulAttempt.State.protocol)"
  Write-Host "TUNNEL_FALLBACK=$($successfulAttempt.State.fallback)"
  if (-not $successfulRegistration.McpUrl) {
    Write-Host "Tunnel registered, but this attempt did not emit a Quick Tunnel URL." -ForegroundColor Red
    exit 1
  }
  $public = $null
  $publicDeadline = (Get-Date).AddSeconds(45)
  do {
    $public = Invoke-McpProbe $successfulRegistration.McpUrl "probe" $current.instanceId
    if ($public) { break }
    Start-Sleep -Milliseconds 1000
  } while ((Get-Date) -lt $publicDeadline)
  if (-not $public) {
    $successfulAttempt.State.status = "unverified"
    $successfulAttempt.State.failureReason = "public-mcp-probe-failed"
    Write-TunnelState $successfulAttempt.State
    throw "Tunnel registered but public MCP verification failed; URL is not ready for ChatGPT."
  }
  Write-TunnelEvent "action=public-mcp-verified instance=$($public.instanceId) tools=$($public.toolCount) discovery_ms=$($public.discoveryMs)"
  Write-Host "Tunnel registered / healthy; public initialize, tools/list and ping passed." -ForegroundColor Green
  Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
  Write-Host $successfulRegistration.McpUrl -ForegroundColor Cyan
  Write-Host "URL_LOG=$($successfulAttempt.State.stderrLog)"
  exit 0
} finally {
  Pop-Location
  if ($hasMutex) { $launchMutex.ReleaseMutex() }
  $launchMutex.Dispose()
}
