param(
  [string]$Endpoint = $env:WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT,
  [string]$Model = $env:WRITER_LOCAL_GENERATION_MODEL,
  [string]$ApiKey = $env:WRITER_LOCAL_GENERATION_API_KEY,
  [string]$HostAddress = "127.0.0.1",
  [ValidateRange(1, 65535)]
  [int]$Port = 8799,
  [int]$TimeoutMs = 120000,
  [int]$MaxTokens = 4096,
  [double]$Temperature = 0.7
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Require-Command {
  param([string]$Name)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required command not found: $Name"
  }

  return $cmd
}

Push-Location $Root
try {
  Require-Command "node" | Out-Null

  if (-not $Endpoint) {
    Write-Host "WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT is required."
    Write-Host ""
    Write-Host "Examples:"
    Write-Host '  .\scripts\start-local-generation-provider.ps1 -Endpoint "http://127.0.0.1:1234/v1/chat/completions" -Model "local-model"'
    Write-Host '  .\scripts\start-local-generation-provider.ps1 -Endpoint "http://127.0.0.1:11434/v1/chat/completions" -Model "llama3.1"'
    exit 1
  }

  if (-not $Model) {
    $Model = "local-generation-model"
  }

  $env:WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT = $Endpoint
  $env:WRITER_LOCAL_GENERATION_MODEL = $Model
  $env:WRITER_LOCAL_GENERATION_HOST = $HostAddress
  $env:WRITER_LOCAL_GENERATION_PORT = [string]$Port
  $env:WRITER_LOCAL_GENERATION_TIMEOUT_MS = [string]$TimeoutMs
  $env:WRITER_LOCAL_GENERATION_MAX_TOKENS = [string]$MaxTokens
  $env:WRITER_LOCAL_GENERATION_TEMPERATURE = [string]$Temperature

  if ($ApiKey) {
    $env:WRITER_LOCAL_GENERATION_API_KEY = $ApiKey
  }

  Write-Host "`n=== Local generation provider ==="
  Write-Host "LISTEN=http://$HostAddress`:$Port/writer"
  Write-Host "WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT=$env:WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT"
  Write-Host "WRITER_LOCAL_GENERATION_MODEL=$env:WRITER_LOCAL_GENERATION_MODEL"
  Write-Host "WRITER_LOCAL_GENERATION_TIMEOUT_MS=$env:WRITER_LOCAL_GENERATION_TIMEOUT_MS"
  Write-Host "WRITER_LOCAL_GENERATION_MAX_TOKENS=$env:WRITER_LOCAL_GENERATION_MAX_TOKENS"
  Write-Host "WRITER_LOCAL_GENERATION_TEMPERATURE=$env:WRITER_LOCAL_GENERATION_TEMPERATURE"

  node .\server\src\local-generation-provider.mjs
} finally {
  Pop-Location
}
