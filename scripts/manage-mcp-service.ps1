param(
  [ValidateSet("Render", "Install", "Refresh", "Start", "Stop", "Restart", "Status", "Uninstall")]
  [string]$Action = "Status",
  [string]$WinSWPath,
  [string]$Hostname,
  [string]$TokenFile,
  [ValidateRange(1, 65535)]
  [int]$McpPort = 8787,
  [string]$ConfigPath,
  [string]$LogDirectory
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$ServiceId = "WriterWorkbenchMcp"
$ServiceName = "Writer Workbench MCP"
$DefaultServiceDir = Join-Path $Root "data\outputs\service"
$ServiceDir = if ($ConfigPath) { Split-Path -Parent ([IO.Path]::GetFullPath($ConfigPath)) } else { $DefaultServiceDir }
$ResolvedConfigPath = if ($ConfigPath) { [IO.Path]::GetFullPath($ConfigPath) } else { Join-Path $ServiceDir "$ServiceId.xml" }
$ResolvedLogDirectory = if ($LogDirectory) { [IO.Path]::GetFullPath($LogDirectory) } else { Join-Path $Root "data\outputs\logs" }
$TunnelScript = [IO.Path]::GetFullPath((Join-Path $Root "scripts\start-mcp-tunnel.ps1"))

function Escape-XmlValue {
  param([string]$Value)
  return [System.Security.SecurityElement]::Escape($Value)
}

function Assert-NoRawTokenEnvironment {
  if ($env:TUNNEL_TOKEN -or $env:WRITER_MCP_TUNNEL_TOKEN) {
    throw "Raw tunnel token environment variables are not accepted by the service manager. Use a token file instead."
  }
}

function Resolve-TokenFile {
  if ([string]::IsNullOrWhiteSpace($TokenFile)) {
    throw "-TokenFile is required when rendering or installing the MCP service."
  }
  $resolved = [IO.Path]::GetFullPath($TokenFile)
  if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
    throw "Tunnel token file does not exist: $resolved"
  }
  if ($resolved.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Tunnel token file must be stored outside the repository."
  }
  return $resolved
}

function Resolve-Hostname {
  if ([string]::IsNullOrWhiteSpace($Hostname)) {
    throw "-Hostname is required when rendering or installing the MCP service."
  }
  $value = $Hostname.Trim().TrimEnd(".").ToLowerInvariant()
  if ([Uri]::CheckHostName($value) -ne [UriHostNameType]::Dns) {
    throw "-Hostname must be a DNS hostname without scheme, path, or port."
  }
  return $value
}

function Write-ServiceConfiguration {
  Assert-NoRawTokenEnvironment
  $resolvedHostname = Resolve-Hostname
  $resolvedTokenFile = Resolve-TokenFile
  New-Item -ItemType Directory -Path $ServiceDir -Force | Out-Null
  New-Item -ItemType Directory -Path $ResolvedLogDirectory -Force | Out-Null

  $powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$TunnelScript`" -ServiceHost -McpPort $McpPort -LogDirectory `"$ResolvedLogDirectory`""
  $xml = @"
<service>
  <id>$(Escape-XmlValue $ServiceId)</id>
  <name>$(Escape-XmlValue $ServiceName)</name>
  <description>Runs Writer Workbench MCP and its stable Cloudflare named tunnel under Windows SCM recovery.</description>
  <executable>$(Escape-XmlValue $powershell)</executable>
  <arguments>$(Escape-XmlValue $arguments)</arguments>
  <workingdirectory>$(Escape-XmlValue $Root)</workingdirectory>
  <env name="WRITER_MCP_TUNNEL_MODE" value="named" />
  <env name="WRITER_MCP_TUNNEL_HOSTNAME" value="$(Escape-XmlValue $resolvedHostname)" />
  <env name="WRITER_MCP_TUNNEL_TOKEN_FILE" value="$(Escape-XmlValue $resolvedTokenFile)" />
  <startmode>Automatic</startmode>
  <onfailure action="restart" delay="15 sec" />
  <onfailure action="restart" delay="60 sec" />
  <onfailure action="none" />
  <resetfailure>15 min</resetfailure>
  <stoptimeout>30 sec</stoptimeout>
  <logpath>$(Escape-XmlValue $ResolvedLogDirectory)</logpath>
  <log mode="roll" />
</service>
"@
  Set-Content -LiteralPath $ResolvedConfigPath -Value $xml -Encoding UTF8
  Write-Host "SERVICE_CONFIG=$ResolvedConfigPath"
  Write-Host "SERVICE_HOSTNAME=$resolvedHostname"
  Write-Host "SERVICE_TOKEN_FILE=$resolvedTokenFile"
  return $ResolvedConfigPath
}

function Resolve-WinSW {
  if ([string]::IsNullOrWhiteSpace($WinSWPath)) {
    throw "-WinSWPath is required for $Action. Download WinSW separately and provide its executable path."
  }
  $resolved = [IO.Path]::GetFullPath($WinSWPath)
  if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
    throw "WinSW executable was not found: $resolved"
  }
  return $resolved
}

function Invoke-WinSW {
  param([string]$Command)
  $winsw = Resolve-WinSW
  if (-not (Test-Path -LiteralPath $ResolvedConfigPath -PathType Leaf)) {
    throw "Service config was not found: $ResolvedConfigPath"
  }
  & $winsw $Command $ResolvedConfigPath
  if ($LASTEXITCODE -ne 0) {
    throw "WinSW $Command failed with exit code $LASTEXITCODE."
  }
}

switch ($Action) {
  "Render" {
    Write-ServiceConfiguration | Out-Null
  }
  "Install" {
    Write-ServiceConfiguration | Out-Null
    Invoke-WinSW "install"
  }
  "Refresh" {
    Write-ServiceConfiguration | Out-Null
    Invoke-WinSW "refresh"
  }
  "Start" { Invoke-WinSW "start" }
  "Stop" { Invoke-WinSW "stop" }
  "Restart" { Invoke-WinSW "restart" }
  "Status" { Invoke-WinSW "status" }
  "Uninstall" { Invoke-WinSW "uninstall" }
}
