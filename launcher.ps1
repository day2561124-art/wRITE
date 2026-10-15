param(
  [switch]$StartUi,
  [switch]$StopUi,
  [switch]$OpenUi,
  [switch]$OpenVisuals,
  [switch]$RunTests,
  [switch]$CreateShortcut,
  [switch]$Status,
  [switch]$StartMcpTunnel,
  [switch]$McpTunnelStatus,
  [switch]$StartMcpTailscale,
  [switch]$McpTailscaleStatus,
  [switch]$StartSecureTunnel,
  [switch]$RestartSecureTunnel,
  [switch]$SecureTunnelStatus,
  [switch]$StopSecureTunnel,
  [switch]$NoOpen,
  [ValidateRange(1, 65535)]
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$UiScriptPath = [IO.Path]::GetFullPath((Join-Path $Root "server\src\ui-server.mjs"))
$Url = "http://127.0.0.1:$Port/"
$HealthUrl = "${Url}api/health"
$LogDir = Join-Path $Root "data\outputs\logs"
$LogStem = if ($Port -eq 4173) { "ui-server" } else { "ui-server.$Port" }
$StdoutLog = Join-Path $LogDir "$LogStem.stdout.log"
$StderrLog = Join-Path $LogDir "$LogStem.stderr.log"
$PidFile = Join-Path $LogDir "$LogStem.pid"

function Write-Title {
  Clear-Host
  Write-Host ""
  Write-Host "  Armed Academy Workbench Launcher" -ForegroundColor Cyan
  Write-Host "  $Root" -ForegroundColor DarkGray
  Write-Host ""
}

function Test-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Host "Node.js was not found. Install Node.js 18 or newer first." -ForegroundColor Red
    return $false
  }
  return $true
}

function Get-UiListener {
  try {
    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
  } catch {
    $null
  }
}

function Test-PortOpen {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    if (-not $task.Wait(750)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-WorkbenchHealth {
  try {
    $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
    return ($health.ok -eq $true)
  } catch {
    return $false
  }
}

function Test-IsWorkbenchProcess {
  param($Process)

  if (-not $Process -or $Process.Name -ne "node.exe" -or -not $Process.CommandLine) {
    return $false
  }

  $commandLine = ([string]$Process.CommandLine).Replace("/", "\")
  $scriptPath = $UiScriptPath.Replace("/", "\")
  return $commandLine.IndexOf($scriptPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-ProcessLabel {
  param($Info)

  if ($Info.CommandLine) { return $Info.CommandLine }
  return "PID $($Info.Pid)"
}

function Get-UiProcessInfo {
  if (Test-Path -LiteralPath $PidFile -PathType Leaf) {
    $recordedPid = 0
    $pidText = (Get-Content -LiteralPath $PidFile -Raw).Trim()
    if ([int]::TryParse($pidText, [ref]$recordedPid)) {
      $recordedProcess = Get-Process -Id $recordedPid -ErrorAction SilentlyContinue
      if (
        $recordedProcess -and
        $recordedProcess.ProcessName -eq "node" -and
        (Test-WorkbenchHealth)
      ) {
        return [pscustomobject]@{
          Pid = $recordedPid
          Name = "node.exe"
          CommandLine = $UiScriptPath
          IsWorkbench = $true
        }
      }
    }
  }

  if (Test-PortOpen) {
    return [pscustomobject]@{
      Pid = $null
      Name = $null
      CommandLine = $null
      IsWorkbench = $false
    }
  }
  return $null
}

function Wait-ForHealth {
  param([int]$Seconds = 15)

  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    Start-Sleep -Milliseconds 250
    try {
      $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2
      if ($health.ok) { return $true }
    } catch {
      # Keep waiting until the server is ready.
    }
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Wait-ForPortRelease {
  param([int]$Seconds = 5)

  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    if (-not (Test-PortOpen)) { return $true }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Show-Status {
  $info = Get-UiProcessInfo
  if ($info -and $info.IsWorkbench) {
    Write-Host "UI server is running." -ForegroundColor Green
    Write-Host "PID: $($info.Pid)"
    Write-Host "URL: $Url"
    return $true
  }

  if ($info) {
    Write-Host "Port $Port is occupied by another process:" -ForegroundColor Yellow
    Write-Host (Get-ProcessLabel $info)
    return $false
  }

  Write-Host "UI server is stopped." -ForegroundColor DarkYellow
  return $false
}

function Start-Workbench {
  if (-not (Test-Node)) { return $false }
  if (-not (Test-Path -LiteralPath $UiScriptPath -PathType Leaf)) {
    Write-Host "UI server script was not found: $UiScriptPath" -ForegroundColor Red
    return $false
  }

  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

  $info = Get-UiProcessInfo
  if ($info -and $info.IsWorkbench) {
    Write-Host "Existing UI server found. Restarting PID $($info.Pid)..." -ForegroundColor Yellow
    Stop-Process -Id $info.Pid -Force
    if (-not (Wait-ForPortRelease)) {
      Write-Host "Port $Port did not become available after stopping the UI." -ForegroundColor Red
      return $false
    }
  } elseif ($info) {
    Write-Host "Port $Port is occupied by another process. Cannot start UI." -ForegroundColor Red
    Write-Host (Get-ProcessLabel $info)
    return $false
  }

  $quotedUiScriptPath = "`"$UiScriptPath`""
  $process = Start-Process -FilePath "node" `
    -ArgumentList @($quotedUiScriptPath, "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

  if (Wait-ForHealth) {
    Set-Content -LiteralPath $PidFile -Value "$($process.Id)" -Encoding Ascii
    Write-Host "UI server started. PID: $($process.Id)" -ForegroundColor Green
    if (-not $NoOpen) {
      try {
        Start-Process -FilePath $Url
      } catch {
        Write-Host "UI is running, but the browser could not be opened: $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }
    return $true
  }

  Write-Host "UI server did not become healthy in time." -ForegroundColor Red
  try {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
    }
  } catch {
    # The process may have exited between the health check and cleanup.
  }
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $StderrLog) {
    Write-Host ""
    Get-Content -LiteralPath $StderrLog -Tail 20
  }
  return $false
}

function Stop-Workbench {
  $info = Get-UiProcessInfo
  if ($info -and $info.IsWorkbench) {
    Stop-Process -Id $info.Pid -Force
    if (-not (Wait-ForPortRelease)) {
      Write-Host "UI process was stopped, but port $Port is still occupied." -ForegroundColor Red
      return $false
    }
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "UI server stopped. PID: $($info.Pid)" -ForegroundColor Green
    return $true
  }

  if ($info) {
    Write-Host "Port $Port is occupied by another process; not stopping it." -ForegroundColor Yellow
    Write-Host (Get-ProcessLabel $info)
    return $false
  }

  Write-Host "UI server is already stopped." -ForegroundColor DarkYellow
  return $true
}

function Open-Workbench {
  if (-not (Show-Status)) {
    Write-Host "Start the UI first." -ForegroundColor Yellow
    return $false
  }

  Start-Process -FilePath $Url
  return $true
}

function Open-VisualFolder {
  $folder = Join-Path $Root "data\visual_db\assets"
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  Start-Process -FilePath "explorer.exe" -ArgumentList $folder
  return $true
}

function Run-Validation {
  if (-not (Test-Node)) { return $false }

  Push-Location $Root
  try {
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
      & npm.cmd test
    } else {
      & node tests/run-all.mjs
    }
    return ($LASTEXITCODE -eq 0)
  } finally {
    Pop-Location
  }
}

function New-DesktopShortcut {
  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) {
    Write-Host "Desktop folder could not be resolved." -ForegroundColor Red
    return $false
  }

  $shortcutPath = Join-Path $desktop "Armed Academy Workbench.lnk"
  $launcherPath = Join-Path $Root "launcher.cmd"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $Root
  $shortcut.Description = "Open the Armed Academy Workbench launcher"
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
  $shortcut.Save()
  Write-Host "Desktop shortcut created:" -ForegroundColor Green
  Write-Host $shortcutPath
  return $true
}


function Invoke-McpTunnelLauncher {
  param([string]$ScriptPath, [switch]$QueryStatus, [string[]]$ExtraArguments = @())
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  $stamp = [Guid]::NewGuid().ToString("N")
  $out = Join-Path $LogDir "mcp-launcher.$stamp.stdout.log"
  $err = Join-Path $LogDir "mcp-launcher.$stamp.stderr.log"
  $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$ScriptPath`"")
  if ($QueryStatus) { $arguments += "-Status" }
  $arguments += $ExtraArguments
  $runner = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments `
    -WorkingDirectory $Root -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
  # Retain the Windows process handle so ExitCode remains available after exit.
  $runner.Handle | Out-Null
  # Wait for the script itself, not its long-lived Node/cloudflared descendants.
  while (-not $runner.WaitForExit(500)) { }
  $runner.Refresh()
  $exitCode = $runner.ExitCode
  if (Test-Path -LiteralPath $out) { Get-Content -LiteralPath $out | ForEach-Object { Write-Host $_ } }
  if (Test-Path -LiteralPath $err) { Get-Content -LiteralPath $err | ForEach-Object { Write-Host $_ -ForegroundColor Yellow } }
  $runner.Dispose()
  return ($exitCode -eq 0)
}

function Start-McpTunnel {
  $script = Join-Path $Root "scripts\start-mcp-tunnel.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "MCP tunnel script was not found: $script" -ForegroundColor Red
    return $false
  }

  return (Invoke-McpTunnelLauncher $script)
}

function Show-McpTunnelStatus {
  $script = Join-Path $Root "scripts\start-mcp-tunnel.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "MCP tunnel script was not found: $script" -ForegroundColor Red
    return $false
  }

  return (Invoke-McpTunnelLauncher $script -QueryStatus)
}

function Start-McpTailscale {
  $script = Join-Path $Root "scripts\start-mcp-tailscale.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "MCP Tailscale script was not found: $script" -ForegroundColor Red
    return $false
  }

  return (Invoke-McpTunnelLauncher $script)
}

function Show-McpTailscaleStatus {
  $script = Join-Path $Root "scripts\start-mcp-tailscale.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "MCP Tailscale script was not found: $script" -ForegroundColor Red
    return $false
  }

  return (Invoke-McpTunnelLauncher $script -QueryStatus)
}

function Show-CloudflareBackupQuickStatus {
  $statePath = Join-Path $LogDir "cloudflared-tunnel.state.json"
  $state = $null
  if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    try { $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } catch { $state = $null }
  }

  $process = $null
  if ($state -and $state.pid) {
    $candidate = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.ProcessName -eq "cloudflared") { $process = $candidate }
  }
  if (-not $process) {
    $process = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
  }

  Write-Host "Cloudflare process: $(if ($process) { "running (PID $($process.Id))" } else { "stopped" })"
  if ($state -and $state.mode) { Write-Host "Tunnel mode: $($state.mode)" }
  if ($state -and $state.mcpUrl) {
    Write-Host "Backup MCP URL:"
    Write-Host ([string]$state.mcpUrl) -ForegroundColor DarkCyan
  }
  Write-Host "Backup validation: on demand (option 8)" -ForegroundColor DarkGray
  return [bool]$process
}

function Invoke-SecureTunnelLauncher {
  param([string]$Action = "Status", [switch]$ProbeSession)
  $script = Join-Path $Root "scripts\manage-secure-tunnel.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "Secure Tunnel manager was not found." -ForegroundColor Yellow
    return $false
  }
  $extra = @("-Action", $Action)
  if ($ProbeSession) { $extra += "-ProbeSession" }
  return (Invoke-McpTunnelLauncher $script -ExtraArguments $extra)
}

function Show-AllStatus {
  $uiRunning = Show-Status
  Write-Host ""
  Write-Host "MCP / Tailscale Funnel (primary):"
  Show-McpTailscaleStatus | Out-Null
  Write-Host ""
  Write-Host "Cloudflare Quick Tunnel (backup):"
  Show-CloudflareBackupQuickStatus | Out-Null
  Write-Host ""
  Write-Host "Writer Workbench Secure Tunnel:"
  Invoke-SecureTunnelLauncher | Out-Null
  return $uiRunning
}

function Show-Menu {
  while ($true) {
    Write-Title
    Show-AllStatus | Out-Null
    Write-Host ""
    Write-Host "  1. Start / restart UI"
    Write-Host "  2. Open UI in browser"
    Write-Host "  3. Open visual gallery assets folder"
    Write-Host "  4. Run full validation"
    Write-Host "  5. Create desktop shortcut"
    Write-Host "  6. Stop UI"
    Write-Host "  7. Start MCP + Tailscale Funnel (primary)"
    Write-Host "  8. Start / restart Cloudflare Quick Tunnel (backup)"
    Write-Host "  9. Start / Restart Writer Workbench Secure Tunnel"
    Write-Host "  10. Show Writer Workbench Secure Tunnel Status"
    Write-Host "  11. Stop Writer Workbench Secure Tunnel"
    Write-Host "  0. Exit"
    Write-Host ""
    $choice = Read-Host "Choose"
    Write-Host ""

    switch ($choice) {
      "1" { Start-Workbench | Out-Null }
      "2" { Open-Workbench | Out-Null }
      "3" { Open-VisualFolder | Out-Null }
      "4" { Run-Validation | Out-Null }
      "5" { New-DesktopShortcut | Out-Null }
      "6" { Stop-Workbench | Out-Null }
      "7" { Start-McpTailscale }
      "8" { Start-McpTunnel }
      "9" { Invoke-SecureTunnelLauncher -Action "Restart" | Out-Null }
      "10" { Invoke-SecureTunnelLauncher -ProbeSession | Out-Null }
      "11" { Invoke-SecureTunnelLauncher -Action "Stop" | Out-Null }
      "0" { return }
      default { Write-Host "Unknown option." -ForegroundColor Yellow }
    }

    Write-Host ""
    Read-Host "Press Enter to return to the menu"
  }
}

try {
  if ($StartUi) { if (Start-Workbench) { exit 0 } else { exit 1 } }
  if ($StopUi) { if (Stop-Workbench) { exit 0 } else { exit 1 } }
  if ($OpenUi) { if (Open-Workbench) { exit 0 } else { exit 1 } }
  if ($OpenVisuals) { if (Open-VisualFolder) { exit 0 } else { exit 1 } }
  if ($RunTests) { if (Run-Validation) { exit 0 } else { exit 1 } }
  if ($CreateShortcut) { if (New-DesktopShortcut) { exit 0 } else { exit 1 } }
  if ($StartMcpTunnel) { if (Start-McpTunnel) { exit 0 } else { exit 1 } }
  if ($McpTunnelStatus) { if (Show-McpTunnelStatus) { exit 0 } else { exit 1 } }
  if ($StartMcpTailscale) { if (Start-McpTailscale) { exit 0 } else { exit 1 } }
  if ($McpTailscaleStatus) { if (Show-McpTailscaleStatus) { exit 0 } else { exit 1 } }
  if ($StartSecureTunnel) { if (Invoke-SecureTunnelLauncher -Action "Start") { exit 0 } else { exit 1 } }
  if ($RestartSecureTunnel) { if (Invoke-SecureTunnelLauncher -Action "Restart") { exit 0 } else { exit 1 } }
  if ($SecureTunnelStatus) { if (Invoke-SecureTunnelLauncher -ProbeSession) { exit 0 } else { exit 1 } }
  if ($StopSecureTunnel) { if (Invoke-SecureTunnelLauncher -Action "Stop") { exit 0 } else { exit 1 } }
  if ($Status) { if (Show-AllStatus) { exit 0 } else { exit 1 } }

  Show-Menu
} catch {
  Write-Host "Launcher failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
