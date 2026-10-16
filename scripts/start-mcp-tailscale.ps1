param(
  [ValidateRange(1, 65535)]
  [int]$McpPort = 8787,
  [switch]$Status,
  [switch]$StopFunnel,
  [switch]$EnsureMcpOnly,
  [string]$TailscalePath,
  [ValidateRange(1, 60)]
  [int]$PublicReadyTimeoutSeconds = 30,
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
$FreshMcpProbeOperationTimeoutMilliseconds = 30000

function Invoke-McpProbe {
  param(
    [string]$Endpoint,
    [string]$Mode = "probe",
    [string]$ExpectedInstance = "",
    [int]$OperationTimeoutMilliseconds = 0
  )

  $probeScript = Join-Path $Root "scripts\probe-mcp.mjs"
  $hadOperationTimeout = Test-Path Env:\PROBE_OP_TIMEOUT_MS
  $originalOperationTimeout = $env:PROBE_OP_TIMEOUT_MS
  try {
    if ($OperationTimeoutMilliseconds -gt 0) {
      $env:PROBE_OP_TIMEOUT_MS = [string]$OperationTimeoutMilliseconds
    }
    try {
      $probeOutput = & node $probeScript $Endpoint $Mode $ExpectedInstance 2>$null
      $probeExitCode = $LASTEXITCODE
    } catch {
      return $null
    }
  } finally {
    if ($hadOperationTimeout) { $env:PROBE_OP_TIMEOUT_MS = $originalOperationTimeout }
    else { Remove-Item Env:\PROBE_OP_TIMEOUT_MS -ErrorAction SilentlyContinue }
  }

  if ($probeExitCode -ne 0) { return $null }
  try { return ($probeOutput | ConvertFrom-Json) } catch { return $null }
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

function Get-FunnelStatusInfo {
  param(
    $Tailscale,
    [string]$ExpectedInstance = ""
  )

  $service = Get-TailscaleServiceState
  if (-not $Tailscale) {
    return [pscustomobject]@{
      Service = $service
      BaseUrl = $null
      McpUrl = $null
      ProxyMatches = $false
      PublicHealthy = $false
      Status = "tailscale-not-found"
      Raw = ""
    }
  }

  $statusText = ""
  try {
    $statusText = (& $Tailscale.Source funnel status 2>&1 | Out-String)
  } catch {
    $statusText = [string]$_.Exception.Message
  }

  $urls = @(
    [regex]::Matches($statusText, 'https://[a-zA-Z0-9.-]+\.ts\.net') |
      ForEach-Object { $_.Value.TrimEnd("/") } |
      Select-Object -Unique
  )
  $baseUrl = if ($urls.Count -gt 0) { [string]$urls[0] } else { $null }
  $proxyPattern = 'proxy\s+http://127\.0\.0\.1:' + [regex]::Escape([string]$McpPort) + '(?:/|\s|$)'
  $proxyMatches = [bool]($statusText -match $proxyPattern)
  $mcpUrl = if ($baseUrl) { "$baseUrl/mcp" } else { $null }

  $publicHealthy = $false
  if ($service.Running -and $proxyMatches -and $mcpUrl -and $ExpectedInstance) {
    $publicProbe = Invoke-McpProbe $mcpUrl "probe" $ExpectedInstance 8000
    $publicHealthy = [bool]$publicProbe
  }

  $statusName = if (-not $service.Present) {
    "tailscale-service-missing"
  } elseif (-not $service.Running) {
    "tailscale-service-stopped"
  } elseif (-not $baseUrl) {
    "funnel-stopped"
  } elseif (-not $proxyMatches) {
    "funnel-target-mismatch"
  } elseif ($ExpectedInstance -and $publicHealthy) {
    "registered / healthy"
  } elseif ($ExpectedInstance) {
    "registered / unverified"
  } else {
    "registered"
  }

  return [pscustomobject]@{
    Service = $service
    BaseUrl = $baseUrl
    McpUrl = $mcpUrl
    ProxyMatches = $proxyMatches
    PublicHealthy = $publicHealthy
    Status = $statusName
    Raw = $statusText
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
      $current = if ($ListenerOnly) { $identity } else { Invoke-McpProbe "$OriginUrl/mcp" "probe" }
    }

    if ($current) {
      if ($ListenerOnly) { Write-Host "Verified current repository MCP listener identity." }
      else { Write-Host "Verified current repository MCP server; initialize and tools/list passed." }
      Write-Host "MCP_OWNING_PROCESS=$owner"
      return $current
    }

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
    if ($ListenerOnly) {
      $start = New-Object Diagnostics.ProcessStartInfo
      $start.FileName = $node.Source
      $start.Arguments = '"' + (Join-Path $Root 'scripts\start-headless-mcp.mjs') + '" "' + $mcpScript + '" "' + (Join-Path $Root 'config\mcp-http.example.json') + '" ' + $McpPort + ' "' + $mcpOut + '" "' + $mcpErr + '"'
      $start.WorkingDirectory = $Root
      $start.UseShellExecute = $false
      $start.CreateNoWindow = $true
      $start.RedirectStandardOutput = $true
      $start.RedirectStandardError = $true
      $helper = New-Object Diagnostics.Process
      $helper.StartInfo = $start
      try {
        $null = $helper.Start()
        $output = $helper.StandardOutput.ReadToEndAsync()
        $errors = $helper.StandardError.ReadToEndAsync()
        if (-not $helper.WaitForExit(10000)) { $helper.Kill(); throw 'HEADLESS_MCP_START_TIMEOUT' }
        $listenerPid = $output.GetAwaiter().GetResult()
        $null = $errors.GetAwaiter().GetResult()
        if ($helper.ExitCode -ne 0 -or $listenerPid -notmatch '^\d+$') { throw 'HEADLESS_MCP_START_FAILED' }
        $mcpProcess = Get-Process -Id ([int]$listenerPid) -ErrorAction Stop
      } finally { $helper.Dispose() }
    } else {
    $mcpProcess = Start-Process -FilePath $node.Source `
      -ArgumentList @("`"$mcpScript`"", "--config", "`"$(Join-Path $Root 'config\mcp-http.example.json')`"", "--port", [string]$McpPort) `
      -WorkingDirectory $Root -WindowStyle Hidden `
      -RedirectStandardOutput $mcpOut -RedirectStandardError $mcpErr -PassThru
    }
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
    if ($mcpProcess.HasExited) {
      throw "MCP exited before readiness; see $mcpErr"
    }
    if (Test-McpPortOpen) { break }
  } while ((Get-Date) -lt $deadline)

  $current = if ($ListenerOnly) {
    Invoke-McpProbe "$OriginUrl/mcp" "identity"
  } else {
    Invoke-McpProbe "$OriginUrl/mcp" "probe" "" $FreshMcpProbeOperationTimeoutMilliseconds
  }
  if (-not $current -or [int]$current.pid -ne $mcpProcess.Id -or (Get-McpOwningProcess) -ne $mcpProcess.Id) {
    if (-not $mcpProcess.HasExited) {
      & taskkill.exe /PID $mcpProcess.Id /T /F | Out-Null
    }
    throw "MCP failed identity / protocol readiness; see $mcpErr"
  }

  if ($ListenerOnly) { Write-Host "MCP HTTP listener started and identity verified." -ForegroundColor Green }
  else { Write-Host "MCP HTTP server started and protocol verified." -ForegroundColor Green }
  return $current
}

function Show-TailscaleStatus {
  # Launcher/menu status must stay fast. Full MCP protocol validation is performed
  # when the primary tunnel is started or restarted, not on every menu refresh.
  $localListening = Test-McpPortOpen
  $tailscale = Resolve-Tailscale
  $funnel = Get-FunnelStatusInfo $tailscale ""

  Write-Host "Local MCP: $(if ($localListening) { "listening" } else { "stopped" })"
  Write-Host "Tailscale service: $(if ($funnel.Service.Running) { "running" } else { $funnel.Service.Status })"

  $displayStatus = if (
    $localListening -and
    $funnel.Service.Running -and
    $funnel.ProxyMatches -and
    $funnel.McpUrl
  ) {
    "configured / ready"
  } else {
    $funnel.Status
  }
  Write-Host "Funnel status: $displayStatus" -ForegroundColor $(if ($displayStatus -eq "configured / ready") { "Green" } elseif ($displayStatus -like "registered*") { "Yellow" } else { "Red" })

  if ($funnel.McpUrl) {
    Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
    Write-Host $funnel.McpUrl -ForegroundColor Cyan
  }

  return (
    $localListening -and
    $funnel.Service.Running -and
    $funnel.ProxyMatches -and
    [bool]$funnel.McpUrl
  )
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

$current = Ensure-McpServer
Write-Host "MCP_PORT=$McpPort"

Write-Host "`n=== Tailscale Funnel (primary) ==="
& $tailscale.Source funnel --bg $McpPort
if ($LASTEXITCODE -ne 0) {
  throw "tailscale funnel failed with exit code $LASTEXITCODE."
}

$deadline = (Get-Date).AddSeconds($PublicReadyTimeoutSeconds)
$funnel = $null
do {
  $funnel = Get-FunnelStatusInfo $tailscale ([string]$current.instanceId)
  if ($funnel.Status -eq "registered / healthy") { break }
  Start-Sleep -Milliseconds 1000
} while ((Get-Date) -lt $deadline)

if (-not $funnel -or -not $funnel.McpUrl) {
  throw "Tailscale Funnel started, but no public ts.net URL was reported."
}

Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
Write-Host $funnel.McpUrl -ForegroundColor Cyan

if ($funnel.Status -ne "registered / healthy") {
  Write-Host "Funnel is configured, but the public MCP probe is not healthy yet." -ForegroundColor Yellow
  exit 1
}

Write-Host "Tailscale Funnel registered / healthy; public initialize, tools/list and ping passed." -ForegroundColor Green
exit 0
