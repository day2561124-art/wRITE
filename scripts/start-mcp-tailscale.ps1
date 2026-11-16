param(
  [ValidateRange(1, 65535)]
  [int]$McpPort = 8787,
  [switch]$Status,
  [switch]$StopFunnel,
  [switch]$EnsureMcpOnly,
  [string]$TailscalePath,
  [ValidateRange(1, 60)]
  [int]$PublicReadyTimeoutSeconds = 60,
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
$OriginUrl = "http://127.0.0.1:$McpPort"
$OAuthProxyUrl = "http://127.0.0.1:8788"
# Listener admission: 15s. Local health and separate protocol probes are bounded.

function Invoke-McpProbe {
  param(
    [string]$Endpoint,
    [string]$Mode = "probe",
    [string]$ExpectedInstance = "",
    [int]$BudgetMilliseconds = 60000
  )
  $script:LastMcpProbeFailure = $null
  $probeScript = Join-Path $Root "scripts\probe-mcp.mjs"
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $failure = [ordered]@{ code = "PROBE_PROCESS_FAILED"; phase = "spawn" }
  $result = $null
  $process = New-Object Diagnostics.Process
  try {
    if ($BudgetMilliseconds -lt 2000) { throw "Insufficient probe budget" }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = (Get-Command node -ErrorAction Stop).Source
    $start.Arguments = '"' + $probeScript + '" "' + $Endpoint + '" "' + $Mode + '" "' + $ExpectedInstance + '"'
    $start.WorkingDirectory = $Root
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    # Child-local settings avoid leaking temporary probe deadlines into Pi or MCP.
    $hard = [Math]::Min(60000, $BudgetMilliseconds - 1000)
    $start.EnvironmentVariables['PROBE_OP_TIMEOUT_MS'] = '30000'
    $start.EnvironmentVariables['PROBE_STARTUP_BUDGET_MS'] = [string][Math]::Min(45000, $hard - 1000)
    $start.EnvironmentVariables['PROBE_HARD_DEADLINE_MS'] = [string]$hard
    $process.StartInfo = $start
    $null = $process.Start()
    $output = $process.StandardOutput.ReadToEndAsync()
    $errors = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($BudgetMilliseconds)) {
      $failure.code = 'PROBE_PROCESS_TIMEOUT'
      $failure.phase = 'process'
      # This process object is the probe we just created, never a port owner.
      $process.Kill()
      $null = $process.WaitForExit(1000)
    } else {
      $failure['exitCode'] = $process.ExitCode
      $stderr = $errors.GetAwaiter().GetResult()
      if ($process.ExitCode -eq 0) {
        try {
          $candidate = $output.GetAwaiter().GetResult() | ConvertFrom-Json
          if (($Mode -eq 'identity' -and $candidate.service -eq 'writer-workbench-mcp' -and $candidate.pid -gt 0 -and $candidate.instanceId) -or
              ($Mode -eq 'local-health' -and $candidate.current -eq $true -and $candidate.ok -eq $true -and
                $candidate.ready -eq $true -and $candidate.pid -gt 0 -and $candidate.instanceId) -or
              ($Mode -eq 'probe' -and $candidate.ok -eq $true -and $candidate.ready -eq $true -and $candidate.runtimeReadiness -eq 'ready' -and $candidate.toolCount -gt 0 -and $null -ne $candidate.resourceCount)) {
            $result = $candidate
          } else { $failure.code = 'INVALID_PROBE_RESULT'; $failure.phase = 'result' }
        } catch { $failure.code = 'INVALID_PROBE_JSON'; $failure.phase = 'result' }
      } else {
        # Never log arbitrary native stderr or response bodies: they may contain
        # credentials. Keep only the probe's structured, bounded diagnostic fields.
        try {
          $diagnostic = ($stderr.Trim() -split "\r?\n" | Select-Object -Last 1) | ConvertFrom-Json
          if ($diagnostic.code -cmatch '^[A-Z][A-Z0-9_]{0,63}$') { $failure.code = $diagnostic.code }
          if ($diagnostic.phase -cmatch '^[a-z/]{1,32}$') { $failure.phase = $diagnostic.phase }
          foreach ($key in @('elapsedMs', 'startupBudgetMs', 'hardDeadlineMs', 'operationTimeoutMs', 'httpStatus')) {
            if ($diagnostic.$key -is [ValueType] -and $diagnostic.$key -ge 0 -and $diagnostic.$key -le 120000) { $failure[$key] = $diagnostic.$key }
          }
          if ($diagnostic.runtimeState -cin @('idle','unverified','running','ready','failed','unknown')) { $failure['runtimeState'] = $diagnostic.runtimeState }
          if ($diagnostic.runtimeStep -cin @('journal','checkpoint','transaction')) { $failure['runtimeStep'] = $diagnostic.runtimeStep }
        } catch {}
      }
    }
  } catch {
    # The error itself can contain command arguments. The stable code is enough
    # to diagnose spawn/configuration failure without exposing environment data.
  } finally { $process.Dispose() }
  if ($result) { return $result }
  $failure['wallMs'] = $watch.ElapsedMilliseconds
  $script:LastMcpProbeFailure = [pscustomobject]$failure
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $diagnosticPath = Join-Path $LogDir 'mcp-probe.failures.jsonl'
  $failure | ConvertTo-Json -Compress | Add-Content -LiteralPath $diagnosticPath -Encoding UTF8
  Write-Host "MCP_PROBE_FAILED=$($failure.code) PHASE=$($failure.phase) ELAPSED_MS=$($failure.wallMs) DIAGNOSTICS=$diagnosticPath"
  return $null
}

function Get-McpProbeFailureSummary {
  if ($script:LastMcpProbeFailure) {
    return "$($script:LastMcpProbeFailure.code) phase=$($script:LastMcpProbeFailure.phase) elapsed_ms=$($script:LastMcpProbeFailure.wallMs)"
  }
  return 'IDENTITY_OR_OWNER_MISMATCH'
}

function Stop-CreatedMcpServer {
  param($Process, $OriginalInfo, [string]$ScriptPath)
  $Process.Refresh()
  if ($Process.HasExited) { return }
  $now = Get-CimInstance Win32_Process -Filter "ProcessId = $($Process.Id)" -ErrorAction SilentlyContinue
  if (-not $OriginalInfo -or -not $now -or $now.CreationDate -ne $OriginalInfo.CreationDate -or
      $now.Name -ne 'node.exe' -or -not $now.CommandLine -or
      $now.CommandLine.Replace('/', '\').IndexOf($ScriptPath, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    Write-Host 'MCP_CLEANUP_REFUSED=OWNER_CHANGED'
    return
  }
  & taskkill.exe /PID $Process.Id /T /F | Out-Null
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

function Resolve-Tailscale {
  if ($TailscalePath) {
    if (-not (Test-Path -LiteralPath $TailscalePath -PathType Leaf)) {
      return $null
    }
    return [pscustomobject]@{ Source = [IO.Path]::GetFullPath($TailscalePath) }
  }

  $command = Get-Command "tailscale.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command }

  $candidate = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    return [pscustomobject]@{ Source = $candidate }
  }

  return $null
}

function Get-TailscaleServiceState {
  try {
    $service = Get-Service -Name "Tailscale" -ErrorAction Stop
    return [pscustomobject]@{
      Present = $true
      Running = ($service.Status -eq "Running")
      Status = [string]$service.Status
      StartType = [string]$service.StartType
    }
  } catch {
    return [pscustomobject]@{
      Present = $false
      Running = $false
      Status = "missing"
      StartType = $null
    }
  }
}

function Test-WorkbenchOAuthProxy {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$OAuthProxyUrl/health" -TimeoutSec 2 -MaximumRedirection 0
    $health = $response.Content | ConvertFrom-Json
    return ($response.StatusCode -eq 200 -and
      $response.Headers["x-workbench-security-protocol"] -eq "trpg-workbench-security/1.0" -and
      $health.service -eq "workbench-mcp-security" -and
      $health.protocol -eq "trpg-workbench-security/1.0" -and $health.mode -ne "shield")
  } catch {
    return $false
  }
}

function Test-PublicOAuthDiscovery {
  param([string]$BaseUrl, [int]$TimeoutSeconds)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/.well-known/oauth-protected-resource/mcp" -TimeoutSec $TimeoutSeconds -MaximumRedirection 0
    $metadata = $response.Content | ConvertFrom-Json
    $issuers = @($metadata.authorization_servers)
    return ($response.StatusCode -eq 200 -and
      $response.Headers["x-workbench-security-protocol"] -eq "trpg-workbench-security/1.0" -and
      $metadata.resource -ceq "$BaseUrl/mcp" -and $issuers.Count -eq 1 -and $issuers[0] -ceq "$BaseUrl/oauth")
  } catch {
    return $false
  }
}

function Get-FunnelStatusInfo {
  param($Tailscale)

  $service = Get-TailscaleServiceState
  $baseUrl = $null
  $proxyMatches = $false
  if ($Tailscale) {
    try {
      $inDefaultFunnel = $false
      $statusLines = @(& $Tailscale.Source funnel status 2>&1)
      if ($LASTEXITCODE -ne 0) { throw "Could not read Funnel status." }
      foreach ($line in $statusLines) {
        if ([string]$line -match '^https://') {
          $inDefaultFunnel = [string]$line -match '^(https://[a-zA-Z0-9.-]+\.ts\.net)(?::443)?/?[ \t]+\(Funnel on\)[ \t]*$'
          if ($inDefaultFunnel) {
            if ($baseUrl) { throw "More than one default Funnel was reported." }
            $baseUrl = $Matches[1]
          }
        } elseif ($inDefaultFunnel -and [string]$line -match '^\s*\|--\s+/?\s*proxy\s+http://127\.0\.0\.1:8788/?\s*$') {
          $proxyMatches = $true
        }
      }
    } catch {
      $baseUrl = $null
      $proxyMatches = $false
    }
  }

  $statusName = if (-not $Tailscale) {
    "tailscale-not-found"
  } elseif (-not $service.Present) {
    "tailscale-service-missing"
  } elseif (-not $service.Running) {
    "tailscale-service-stopped"
  } elseif (-not $baseUrl) {
    "funnel-stopped"
  } elseif (-not $proxyMatches) {
    "funnel-target-mismatch"
  } else {
    "registered"
  }

  return [pscustomobject]@{
    Service = $service
    BaseUrl = $baseUrl
    McpUrl = $(if ($baseUrl) { "$baseUrl/mcp" })
    ProxyMatches = $proxyMatches
    Status = $statusName
  }
}

function Set-BackendGenerationProviderDefaults {
  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER) { $env:WRITER_BACKEND_GENERATION_PROVIDER = "local_http" }
  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER_ID) { $env:WRITER_BACKEND_GENERATION_PROVIDER_ID = "local-smoke-provider" }
  if (-not $env:WRITER_BACKEND_GENERATION_ENDPOINT) { $env:WRITER_BACKEND_GENERATION_ENDPOINT = "http://127.0.0.1:8799/writer" }
  if (-not $env:WRITER_BACKEND_GENERATION_MODEL) { $env:WRITER_BACKEND_GENERATION_MODEL = "writer-local-provider-smoke" }
  if (-not $env:WRITER_BACKEND_GENERATION_VERSION) { $env:WRITER_BACKEND_GENERATION_VERSION = "smoke-1" }
  if (-not $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS) { $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS = "60000" }
}

function Ensure-McpServer {
  param([switch]$NoRestart, [switch]$ListenerOnly)
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "Node.js was not found. Install Node.js 18 or newer first."
  }

  $mcpScript = [IO.Path]::GetFullPath((Join-Path $Root "server\src\mcp-http-server.mjs"))
  $current = $null

  if (Test-McpPortOpen) {
    $owner = Get-McpOwningProcess
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $owner" -ErrorAction SilentlyContinue
    $identity = Invoke-McpProbe "$OriginUrl/mcp" "identity"
    $owned = $info -and $info.Name -eq "node.exe" -and $info.CommandLine -and
      $info.CommandLine.Replace("/", "\").IndexOf($mcpScript, [StringComparison]::OrdinalIgnoreCase) -ge 0

    if (-not $owned -or -not $identity -or [int]$identity.pid -ne [int]$owner) {
      throw "Port $McpPort is occupied by an unverified process (PID $owner); it was not stopped."
    }

    if ($identity.current) {
      $current = if ($ListenerOnly) { $identity } else { Invoke-McpProbe "$OriginUrl/mcp" "local-health" ([string]$identity.instanceId) }
    }

    if ($current -and ([int]$current.pid -ne [int]$owner -or $current.instanceId -ne $identity.instanceId -or (Get-McpOwningProcess) -ne $owner)) { throw "MCP owner changed during health verification; listener left running." }

    if ($current) {
      if ($ListenerOnly) { Write-Host "Verified current repository MCP listener identity." }
      else { Write-Host "Verified current repository MCP listener health." }
      Write-Host "MCP_OWNING_PROCESS=$owner"
      return $current
    }

    if ($identity.current -and -not $current) { throw "Existing MCP health verification failed: $(Get-McpProbeFailureSummary); listener left running." }

    if ($NoRestart) { throw "Existing MCP listener was not restarted; explicit operator review is required." }

    $again = Get-CimInstance Win32_Process -Filter "ProcessId = $owner" -ErrorAction SilentlyContinue
    if (-not $again -or (Get-McpOwningProcess) -ne $owner -or $again.CreationDate -ne $info.CreationDate) {
      throw "MCP owner changed during validation; refusing to stop it."
    }

    & taskkill.exe /PID $owner /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Could not stop verified MCP PID $owner."
    }

    $releaseDeadline = (Get-Date).AddSeconds(5)
    while ((Test-McpPortOpen) -and (Get-Date) -lt $releaseDeadline) {
      Start-Sleep -Milliseconds 100
    }
    if (Test-McpPortOpen) {
      throw "MCP port did not become available."
    }
  }

  Set-BackendGenerationProviderDefaults
  $stamp = Get-Date -Format "yyyyMMdd-HHmmssfff"
  $mcpOut = Join-Path $LogDir "mcp-http.$stamp.stdout.log"
  $mcpErr = Join-Path $LogDir "mcp-http.$stamp.stderr.log"
  $originalMcpToolProfile = $env:MCP_TOOL_PROFILE
  $effectiveMcpToolProfile = if (Test-Path Env:\MCP_TOOL_PROFILE) { $originalMcpToolProfile } else { "chatgpt_developer" }

  try {
    $env:MCP_TOOL_PROFILE = $effectiveMcpToolProfile
    # Restrict inheritance to NUL input and the listener's two log files.
    # Detached Node helpers can still inherit unused ancestor pipe handles.
    if (-not ('WriterWorkbench.McpHttpOwnedProcessV1' -as [type])) {
      Add-Type -Path (Join-Path $Root 'scripts\mcp-http-owned-process.cs')
    }
    $listenerPid = [WriterWorkbench.McpHttpOwnedProcessV1]::Start($node.Source, $Root, $McpPort, $mcpOut, $mcpErr)
    $mcpProcess = Get-Process -Id ([int]$listenerPid) -ErrorAction Stop
  } finally {
    if ($null -eq $originalMcpToolProfile) { Remove-Item Env:\MCP_TOOL_PROFILE -ErrorAction SilentlyContinue }
    else { $env:MCP_TOOL_PROFILE = $originalMcpToolProfile }
  }

  Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
  Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
  Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
  Write-Host "MCP_TOOL_PROFILE=$effectiveMcpToolProfile"

  $createdInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $($mcpProcess.Id)" -ErrorAction SilentlyContinue
  $listenerWatch = [Diagnostics.Stopwatch]::StartNew()
  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 250
    $mcpProcess.Refresh()
    if ($mcpProcess.HasExited) {
      throw "MCP exited before readiness; see $mcpErr"
    }
    if (Test-McpPortOpen) { break }
  } while ((Get-Date) -lt $deadline)

  if (-not (Test-McpPortOpen)) {
    Stop-CreatedMcpServer $mcpProcess $createdInfo $mcpScript
    throw "MCP_LISTENER_TIMEOUT after $($listenerWatch.ElapsedMilliseconds)ms; see $mcpErr"
  }

  $current = if ($ListenerOnly) {
    Invoke-McpProbe "$OriginUrl/mcp" "identity"
  } else {
    Invoke-McpProbe "$OriginUrl/mcp" "local-health" "" 60000
  }
  if (-not $current -or -not $current.current -or [int]$current.pid -ne $mcpProcess.Id -or (Get-McpOwningProcess) -ne $mcpProcess.Id) {
    Stop-CreatedMcpServer $mcpProcess $createdInfo $mcpScript
    throw "MCP failed identity / local health: $(Get-McpProbeFailureSummary); see $mcpErr"
  }

  if ($ListenerOnly) { Write-Host "MCP HTTP listener started and identity verified." -ForegroundColor Green }
  else { Write-Host "MCP HTTP listener started and health verified." -ForegroundColor Green }
  return $current
}

function Show-TailscaleStatus {
  # Menu status stays local. Only startup checks public OAuth discovery.
  $localListening = ($McpPort -eq 8787) -and (Test-McpPortOpen)
  $oauthReady = Test-WorkbenchOAuthProxy
  $tailscale = Resolve-Tailscale
  $funnel = Get-FunnelStatusInfo $tailscale

  Write-Host "Local MCP: $(if ($localListening) { "listening" } else { "stopped" })"
  Write-Host "Tailscale service: $(if ($funnel.Service.Running) { "running" } else { $funnel.Service.Status })"

  $configured = $localListening -and $oauthReady -and $funnel.Service.Running -and $funnel.ProxyMatches
  $displayStatus = if ($configured) {
    "configured / OAuth proxy ready"
  } elseif ($funnel.Status -eq "registered" -and -not $oauthReady) {
    "registered / OAuth proxy not ready"
  } elseif ($funnel.Status -eq "registered" -and -not $localListening) {
    "registered / local MCP stopped"
  } else {
    $funnel.Status
  }
  Write-Host "Funnel status: $displayStatus" -ForegroundColor $(if ($configured) { "Green" } else { "Yellow" })

  if ($funnel.ProxyMatches -and $funnel.McpUrl) {
    Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
    Write-Host $funnel.McpUrl -ForegroundColor Cyan
  }
  return $configured
}

if ($EnsureMcpOnly) {
  Ensure-McpServer -NoRestart -ListenerOnly | Out-Null
  exit 0
}

$tailscale = Resolve-Tailscale

if ($Status) {
  if (Show-TailscaleStatus) { exit 0 } else { exit 1 }
}

if ($StopFunnel) {
  if (-not $tailscale) {
    Write-Host "tailscale.exe was not found." -ForegroundColor Red
    exit 1
  }
  & $tailscale.Source funnel --https=443 off
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  Write-Host "Tailscale Funnel stopped. Writer Workbench MCP was left running."
  exit 0
}

if ($McpPort -ne 8787) {
  throw "The primary OAuth Funnel requires local MCP on port 8787. Use -EnsureMcpOnly for a separate local listener."
}

if (-not $tailscale) {
  throw "tailscale.exe was not found. Install Tailscale first."
}

$service = Get-TailscaleServiceState
if (-not $service.Present) {
  throw "The Tailscale Windows service was not found."
}
if (-not $service.Running) {
  try {
    Start-Service -Name "Tailscale" -ErrorAction Stop
    Start-Sleep -Milliseconds 500
  } catch {
    throw "The Tailscale service is stopped and could not be started: $($_.Exception.Message)"
  }
}

if (-not (Test-WorkbenchOAuthProxy)) {
  throw "Writer Workbench OAuth is not ready on 127.0.0.1:8788. Start it with launcher option 8. Tailscale Funnel was left unchanged."
}

Ensure-McpServer | Out-Null
Write-Host "MCP_PORT=$McpPort"

Write-Host "`n=== Tailscale Funnel (primary, OAuth) ==="
$funnel = Get-FunnelStatusInfo $tailscale
if (-not $funnel.ProxyMatches) {
  & $tailscale.Source funnel --bg --https=443 $OAuthProxyUrl
  if ($LASTEXITCODE -ne 0) {
    throw "tailscale funnel failed with exit code $LASTEXITCODE."
  }
}

$publicWatch = [Diagnostics.Stopwatch]::StartNew()
$publicVerified = $false
do {
  $remainingSeconds = [int][Math]::Floor($PublicReadyTimeoutSeconds - $publicWatch.Elapsed.TotalSeconds)
  $funnel = Get-FunnelStatusInfo $tailscale
  if ($funnel.ProxyMatches -and $funnel.BaseUrl) {
    $publicVerified = Test-PublicOAuthDiscovery $funnel.BaseUrl ([Math]::Max(1, [Math]::Min(5, $remainingSeconds)))
    if ($publicVerified) { break }
  }
  if (($PublicReadyTimeoutSeconds - $publicWatch.Elapsed.TotalSeconds) -lt 1) { break }
  Start-Sleep -Milliseconds 1000
} while ($publicWatch.Elapsed.TotalSeconds -lt $PublicReadyTimeoutSeconds)

if (-not $funnel.ProxyMatches -or -not $funnel.McpUrl) {
  throw "Tailscale Funnel does not show the expected OAuth proxy target on 127.0.0.1:8788."
}

Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
Write-Host $funnel.McpUrl -ForegroundColor Cyan

if (-not $publicVerified) {
  Write-Host "Funnel targets the OAuth proxy, but public OAuth discovery could not be verified." -ForegroundColor Yellow
  exit 1
}

Write-Host "Funnel and public OAuth discovery verified. Confirm tool access with a read-only call from ChatGPT." -ForegroundColor Green
exit 0
