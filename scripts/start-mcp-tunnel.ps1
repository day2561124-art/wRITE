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

  if (-not $State -or -not $State.pid) { return $null }
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
    $statusName = "registered / healthy"
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
    return (Get-NetTCPConnection -State Listen -LocalAddress "127.0.0.1" -LocalPort $McpPort -ErrorAction Stop | Select-Object -First 1).OwningProcess
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
    version = 1
    attemptId = $attemptId
    pid = $process.Id
    processStartedAtUtc = $process.StartTime.ToUniversalTime().ToString("o")
    status = "connecting"
    requestedProtocol = $Protocol
    protocol = $null
    fallback = $Fallback
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

Push-Location $Root
try {
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
  if (Test-McpPortOpen) {
    Write-Host "MCP HTTP server is already listening; it will not be restarted." -ForegroundColor Green
    Write-Host "MCP_PORT=$McpPort"
    $owner = Get-McpOwningProcess
    if ($owner) { Write-Host "MCP_OWNING_PROCESS=$owner" }
  } else {
    $node = Require-Command "node" "Install Node.js 18 or newer first."
    $npm = Require-Command "npm.cmd" "Install Node.js/npm first."
    if (-not $node -or -not $npm) { exit 1 }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $mcpOut = Join-Path $LogDir "mcp-http.$stamp.stdout.log"
    $mcpErr = Join-Path $LogDir "mcp-http.$stamp.stderr.log"
    $mcpToolProfileWasSet = Test-Path Env:\MCP_TOOL_PROFILE
    $originalMcpToolProfile = $env:MCP_TOOL_PROFILE
    $effectiveMcpToolProfile = if ($mcpToolProfileWasSet) {
      $originalMcpToolProfile
    } else {
      "chatgpt_developer"
    }
    Write-Host "Starting MCP HTTP server..." -ForegroundColor Cyan
    try {
      $env:MCP_TOOL_PROFILE = $effectiveMcpToolProfile
      $mcpProcess = Start-Process `
        -FilePath $npm.Source `
        -ArgumentList @("run", "mcp:http") `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $mcpOut `
        -RedirectStandardError $mcpErr `
        -PassThru
    } finally {
      if ($mcpToolProfileWasSet) {
        $env:MCP_TOOL_PROFILE = $originalMcpToolProfile
      } else {
        Remove-Item Env:\MCP_TOOL_PROFILE -ErrorAction SilentlyContinue
      }
    }

    $mcpDeadline = (Get-Date).AddSeconds(12)
    do {
      Start-Sleep -Milliseconds 500
      if (Test-McpPortOpen) { break }
    } while ((Get-Date) -lt $mcpDeadline)

    if (-not (Test-McpPortOpen)) {
      Write-Host "MCP HTTP server did not start listening on 127.0.0.1:$McpPort in time." -ForegroundColor Red
      Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
      Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
      Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
      if (Test-Path -LiteralPath $mcpErr) { Get-Content -LiteralPath $mcpErr -Tail 40 }
      exit 1
    }

    Write-Host "MCP HTTP server started." -ForegroundColor Green
    Write-Host "MCP_TOOL_PROFILE=$effectiveMcpToolProfile"
    Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
    Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
    Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
  }

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
  Write-Host "Tunnel registered / healthy." -ForegroundColor Green
  Write-Host "TUNNEL_PROTOCOL=$($successfulAttempt.State.protocol)"
  Write-Host "TUNNEL_FALLBACK=$($successfulAttempt.State.fallback)"
  if (-not $successfulRegistration.McpUrl) {
    Write-Host "Tunnel registered, but this attempt did not emit a Quick Tunnel URL." -ForegroundColor Red
    exit 1
  }
  Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
  Write-Host $successfulRegistration.McpUrl -ForegroundColor Cyan
  Write-Host "URL_LOG=$($successfulAttempt.State.stderrLog)"
  exit 0
} finally {
  Pop-Location
}
