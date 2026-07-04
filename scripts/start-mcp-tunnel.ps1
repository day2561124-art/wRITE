param(
  [ValidateRange(1, 65535)]
  [int]$McpPort = 8787
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $Root "data\outputs\logs"

function Get-McpListener {
  try {
    Get-NetTCPConnection -State Listen -LocalPort $McpPort -ErrorAction Stop | Select-Object -First 1
  } catch {
    $null
  }
}

function Find-LatestTryCloudflareUrl {
  $candidateLogs = @()

  $candidateLogs += Get-ChildItem -Path $LogDir -Filter "cloudflared.*.stderr.log" -ErrorAction SilentlyContinue
  $candidateLogs += Get-ChildItem -Path $env:TEMP -Filter "phase19*-cloudflared-*.err.log" -ErrorAction SilentlyContinue
  $candidateLogs += Get-ChildItem -Path $env:TEMP -Filter "*cloudflared*.err.log" -ErrorAction SilentlyContinue

  $logs = $candidateLogs | Sort-Object LastWriteTime -Descending
  foreach ($log in $logs) {
    try {
      $raw = Get-Content -LiteralPath $log.FullName -Raw -ErrorAction Stop
      $matches = [regex]::Matches($raw, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
      if ($matches.Count -gt 0) {
        $baseUrl = $matches[$matches.Count - 1].Value
        return [pscustomobject]@{
          BaseUrl = $baseUrl
          McpUrl = "$baseUrl/mcp"
          Log = $log.FullName
        }
      }
    } catch {
      # Ignore unreadable log files.
    }
  }

  return $null
}

function Require-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "$Name was not found. $InstallHint" -ForegroundColor Red
    return $null
  }

  return $cmd
}

function Set-BackendGenerationProviderDefaults {
  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER) {
    $env:WRITER_BACKEND_GENERATION_PROVIDER = "local_http"
  }

  if (-not $env:WRITER_BACKEND_GENERATION_PROVIDER_ID) {
    $env:WRITER_BACKEND_GENERATION_PROVIDER_ID = "local-smoke-provider"
  }

  if (-not $env:WRITER_BACKEND_GENERATION_ENDPOINT) {
    $env:WRITER_BACKEND_GENERATION_ENDPOINT = "http://127.0.0.1:8799/writer"
  }

  if (-not $env:WRITER_BACKEND_GENERATION_MODEL) {
    $env:WRITER_BACKEND_GENERATION_MODEL = "writer-local-provider-smoke"
  }

  if (-not $env:WRITER_BACKEND_GENERATION_VERSION) {
    $env:WRITER_BACKEND_GENERATION_VERSION = "smoke-1"
  }

  if (-not $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS) {
    $env:WRITER_BACKEND_GENERATION_TIMEOUT_MS = "60000"
  }

  Write-Host "`n=== Backend generation provider ==="
  Write-Host "WRITER_BACKEND_GENERATION_PROVIDER=$env:WRITER_BACKEND_GENERATION_PROVIDER"
  Write-Host "WRITER_BACKEND_GENERATION_PROVIDER_ID=$env:WRITER_BACKEND_GENERATION_PROVIDER_ID"
  Write-Host "WRITER_BACKEND_GENERATION_ENDPOINT=$env:WRITER_BACKEND_GENERATION_ENDPOINT"
  Write-Host "WRITER_BACKEND_GENERATION_MODEL=$env:WRITER_BACKEND_GENERATION_MODEL"
  Write-Host "WRITER_BACKEND_GENERATION_VERSION=$env:WRITER_BACKEND_GENERATION_VERSION"
  Write-Host "WRITER_BACKEND_GENERATION_TIMEOUT_MS=$env:WRITER_BACKEND_GENERATION_TIMEOUT_MS"
}

Push-Location $Root
try {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

  $node = Require-Command "node" "Install Node.js 18 or newer first."
  if (-not $node) { exit 1 }

  $npm = Require-Command "npm.cmd" "Install Node.js/npm first."
  if (-not $npm) { exit 1 }

  $cloudflared = Require-Command "cloudflared" "Install cloudflared first."
  if (-not $cloudflared) { exit 1 }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"

  Set-BackendGenerationProviderDefaults

  Write-Host "`n=== 1. MCP HTTP server ==="
  $mcpListener = Get-McpListener
  if ($mcpListener) {
    Write-Host "MCP HTTP server appears to be running." -ForegroundColor Green
    Write-Host "MCP_PORT=$McpPort"
    Write-Host "MCP_OWNING_PROCESS=$($mcpListener.OwningProcess)"
  } else {
    $mcpOut = Join-Path $LogDir "mcp-http.$stamp.stdout.log"
    $mcpErr = Join-Path $LogDir "mcp-http.$stamp.stderr.log"

    Write-Host "Starting MCP HTTP server..." -ForegroundColor Cyan
    $mcpProcess = Start-Process `
      -FilePath $npm.Source `
      -ArgumentList @("run", "mcp:http") `
      -WorkingDirectory $Root `
      -WindowStyle Hidden `
      -RedirectStandardOutput $mcpOut `
      -RedirectStandardError $mcpErr `
      -PassThru

    $deadline = (Get-Date).AddSeconds(12)
    do {
      Start-Sleep -Milliseconds 500
      $mcpListener = Get-McpListener
      if ($mcpListener) { break }
    } while ((Get-Date) -lt $deadline)

    if (-not $mcpListener) {
      Write-Host "MCP HTTP server did not start listening on 127.0.0.1:$McpPort in time." -ForegroundColor Red
      Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
      Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
      Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
      if (Test-Path -LiteralPath $mcpErr) {
        Get-Content -LiteralPath $mcpErr -Tail 40
      }
      exit 1
    }

    Write-Host "MCP HTTP server started." -ForegroundColor Green
    Write-Host "MCP_HTTP_PID=$($mcpProcess.Id)"
    Write-Host "MCP_OWNING_PROCESS=$($mcpListener.OwningProcess)"
    Write-Host "MCP_HTTP_OUT_LOG=$mcpOut"
    Write-Host "MCP_HTTP_ERR_LOG=$mcpErr"
  }

  Write-Host "`n=== 2. Cloudflare quick tunnel ==="
  $cloudflaredProcess = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cloudflaredProcess) {
    Write-Host "cloudflared already appears to be running." -ForegroundColor Green
    Write-Host "CLOUDFLARED_PID=$($cloudflaredProcess.Id)"
  } else {
    $cfOut = Join-Path $LogDir "cloudflared.$stamp.stdout.log"
    $cfErr = Join-Path $LogDir "cloudflared.$stamp.stderr.log"

    Write-Host "Starting Cloudflare quick tunnel..." -ForegroundColor Cyan
    $cloudflaredProcess = Start-Process `
      -FilePath $cloudflared.Source `
      -ArgumentList @("tunnel", "--url", "http://127.0.0.1:$McpPort") `
      -WorkingDirectory $Root `
      -WindowStyle Hidden `
      -RedirectStandardOutput $cfOut `
      -RedirectStandardError $cfErr `
      -PassThru

    Write-Host "CLOUDFLARED_PID=$($cloudflaredProcess.Id)"
    Write-Host "CLOUDFLARED_OUT_LOG=$cfOut"
    Write-Host "CLOUDFLARED_ERR_LOG=$cfErr"
  }

  Write-Host "`n=== 3. ChatGPT MCP URL ==="
  $urlInfo = $null
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Seconds 1
    $urlInfo = Find-LatestTryCloudflareUrl
    if ($urlInfo) { break }
  } while ((Get-Date) -lt $deadline)

  if (-not $urlInfo) {
    Write-Host "Cloudflare tunnel started, but no trycloudflare URL was found yet." -ForegroundColor Yellow
    Write-Host "Wait a few seconds and run this again:"
    Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mcp-tunnel.ps1"
    exit 1
  }

  Write-Host "ChatGPT MCP URL:" -ForegroundColor Green
  Write-Host $urlInfo.McpUrl -ForegroundColor Cyan
  Write-Host "URL_LOG=$($urlInfo.Log)"
  exit 0
} finally {
  Pop-Location
}
