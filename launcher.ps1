param(
  [switch]$StartUi,
  [switch]$StopUi,
  [switch]$OpenUi,
  [switch]$OpenVisuals,
  [switch]$RunTests,
  [switch]$CreateShortcut,
  [switch]$Status,
  [switch]$StartMcpTunnel,
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
  $listener = Get-UiListener
  if (-not $listener) { return $null }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
  [pscustomobject]@{
    Pid = $listener.OwningProcess
    Name = $process.Name
    CommandLine = $process.CommandLine
    IsWorkbench = (Test-IsWorkbenchProcess $process)
  }
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
    if (-not (Get-UiListener)) { return $true }
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


function Start-McpTunnel {
  $script = Join-Path $Root "scripts\start-mcp-tunnel.ps1"
  if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    Write-Host "MCP tunnel script was not found: $script" -ForegroundColor Red
    return $false
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File $script
  return ($LASTEXITCODE -eq 0)
}

function Show-Menu {
  while ($true) {
    Write-Title
    Show-Status | Out-Null
    Write-Host ""
    Write-Host "  1. Start / restart UI"
    Write-Host "  2. Open UI in browser"
    Write-Host "  3. Open visual gallery assets folder"
    Write-Host "  4. Run full validation"
    Write-Host "  5. Create desktop shortcut"
    Write-Host "  6. Stop UI"
    Write-Host "  7. Start MCP + Cloudflare tunnel"
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
      "7" { Start-McpTunnel }
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
  if ($Status) { if (Show-Status) { exit 0 } else { exit 1 } }

  Show-Menu
} catch {
  Write-Host "Launcher failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
