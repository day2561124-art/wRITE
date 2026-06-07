param(
  [switch]$StartUi,
  [switch]$StopUi,
  [switch]$OpenUi,
  [switch]$OpenVisuals,
  [switch]$RunTests,
  [switch]$CreateShortcut,
  [switch]$Status
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 4173
$Url = "http://127.0.0.1:$Port/"
$HealthUrl = "${Url}api/health"
$UiScriptPattern = "server[\\/]src[\\/]ui-server\.mjs"
$LogDir = Join-Path $Root "data\outputs\logs"
$StdoutLog = Join-Path $LogDir "ui-server.stdout.log"
$StderrLog = Join-Path $LogDir "ui-server.stderr.log"

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

function Get-UiProcessInfo {
  $listener = Get-UiListener
  if (-not $listener) { return $null }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
  [pscustomobject]@{
    Pid = $listener.OwningProcess
    Name = $process.Name
    CommandLine = $process.CommandLine
    IsWorkbench = ($process.Name -eq "node.exe" -and $process.CommandLine -match $UiScriptPattern)
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
    Write-Host $info.CommandLine
    return $false
  }

  Write-Host "UI server is stopped." -ForegroundColor DarkYellow
  return $false
}

function Start-Workbench {
  if (-not (Test-Node)) { return }
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

  $info = Get-UiProcessInfo
  if ($info -and $info.IsWorkbench) {
    Write-Host "Existing UI server found. Restarting PID $($info.Pid)..." -ForegroundColor Yellow
    Stop-Process -Id $info.Pid -Force
    Start-Sleep -Milliseconds 600
  } elseif ($info) {
    Write-Host "Port $Port is occupied by another process. Cannot start UI." -ForegroundColor Red
    Write-Host $info.CommandLine
    return
  }

  $process = Start-Process -FilePath "node" `
    -ArgumentList @("server/src/ui-server.mjs", "--host", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

  if (Wait-ForHealth) {
    Write-Host "UI server started. PID: $($process.Id)" -ForegroundColor Green
    Start-Process $Url
  } else {
    Write-Host "UI server did not become healthy in time." -ForegroundColor Red
    if (Test-Path $StderrLog) {
      Write-Host ""
      Get-Content -LiteralPath $StderrLog -Tail 20
    }
  }
}

function Stop-Workbench {
  $info = Get-UiProcessInfo
  if ($info -and $info.IsWorkbench) {
    Stop-Process -Id $info.Pid -Force
    Write-Host "UI server stopped. PID: $($info.Pid)" -ForegroundColor Green
    return
  }

  if ($info) {
    Write-Host "Port $Port is occupied by another process; not stopping it." -ForegroundColor Yellow
    Write-Host $info.CommandLine
    return
  }

  Write-Host "UI server is already stopped." -ForegroundColor DarkYellow
}

function Open-Workbench {
  if (-not (Show-Status)) {
    Write-Host "Start the UI first." -ForegroundColor Yellow
    return
  }

  Start-Process $Url
}

function Open-VisualFolder {
  $folder = Join-Path $Root "data\visual_db\assets"
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  Start-Process -FilePath "explorer.exe" -ArgumentList $folder
}

function Run-Validation {
  if (-not (Test-Node)) { return }
  Push-Location $Root
  try {
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
      & npm.cmd test
    } else {
      & node tests/run-all.mjs
    }
  } finally {
    Pop-Location
  }
}

function New-DesktopShortcut {
  $desktop = [Environment]::GetFolderPath("Desktop")
  if (-not $desktop) {
    Write-Host "Desktop folder could not be resolved." -ForegroundColor Red
    return
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
    Write-Host "  0. Exit"
    Write-Host ""
    $choice = Read-Host "Choose"
    Write-Host ""

    switch ($choice) {
      "1" { Start-Workbench }
      "2" { Open-Workbench }
      "3" { Open-VisualFolder }
      "4" { Run-Validation }
      "5" { New-DesktopShortcut }
      "6" { Stop-Workbench }
      "0" { return }
      default { Write-Host "Unknown option." -ForegroundColor Yellow }
    }

    Write-Host ""
    Read-Host "Press Enter to return to the menu"
  }
}

if ($StartUi) { Start-Workbench; exit }
if ($StopUi) { Stop-Workbench; exit }
if ($OpenUi) { Open-Workbench; exit }
if ($OpenVisuals) { Open-VisualFolder; exit }
if ($RunTests) { Run-Validation; exit $LASTEXITCODE }
if ($CreateShortcut) { New-DesktopShortcut; exit }
if ($Status) { Show-Status | Out-Null; exit }

Show-Menu
