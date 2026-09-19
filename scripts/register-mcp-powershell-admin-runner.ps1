[CmdletBinding()]
param(
    [string]$TaskName = 'WriterWorkbench-PowerShellAdminRunner'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$windowsPrincipal = New-Object Security.Principal.WindowsPrincipal $identity
if (-not $windowsPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this registration script once from an elevated (Run as administrator) PowerShell window.'
}

$repoRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceRunner = Join-Path $PSScriptRoot 'mcp-powershell-admin-runner.ps1'
if (-not (Test-Path -LiteralPath $sourceRunner -PathType Leaf)) {
    throw "Runner source is missing: $sourceRunner"
}

$protectedRoot = Join-Path $env:ProgramData 'WriterWorkbench\AdminPowerShell'
$protectedRunner = Join-Path $protectedRoot 'mcp-powershell-admin-runner.ps1'
$configPath = Join-Path $protectedRoot 'config.json'
$requestRoot = Join-Path $env:LOCALAPPDATA 'WriterWorkbench\PowerShellMaintenance'
$worktreesRoot = Join-Path (Split-Path -Parent $repoRoot) '.writer-workbench-worktrees'

New-Item -ItemType Directory -Path $protectedRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $requestRoot 'requests') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $requestRoot 'results') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $requestRoot 'temp') -Force | Out-Null

Copy-Item -LiteralPath $sourceRunner -Destination $protectedRunner -Force

$config = [ordered]@{
    schema_version = 1
    expected_user_sid = $identity.User.Value
    expected_user_name = $identity.Name
    request_root = [IO.Path]::GetFullPath($requestRoot)
    allowed_roots = @(
        $repoRoot,
        [IO.Path]::GetFullPath($worktreesRoot)
    )
    registered_at = [DateTime]::UtcNow.ToString('o')
}
$configJson = $config | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText(
    $configPath,
    $configJson + [Environment]::NewLine,
    (New-Object Text.UTF8Encoding $false)
)

# The scheduled task must never execute a runner that the normal user can rewrite.
# Protect the directory first, then repair the two existing files explicitly.
# /T is intentionally avoided here: applying inheritable directory ACEs recursively
# can leave existing files without effective file ACEs on Windows.
& icacls.exe $protectedRoot /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' "*$($identity.User.Value):(OI)(CI)RX" /C | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Could not protect the elevated runner directory ACL.'
}

foreach ($protectedFile in @($protectedRunner, $configPath)) {
    & icacls.exe $protectedFile /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' "*$($identity.User.Value):RX" /C | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not protect elevated runner file ACL: $protectedFile"
    }
}

$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$quote = [char]34
$actionArgs = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' +
    $quote + $protectedRunner + $quote +
    ' -ConfigPath ' + $quote + $configPath + $quote

$action = New-ScheduledTaskAction -Execute $powershellExe -Argument $actionArgs -WorkingDirectory $repoRoot
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Principal $taskPrincipal -Settings $settings -Description 'Bounded elevated PowerShell maintenance runner for Writer Workbench MCP. No trigger; on-demand only.'

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

$registered = Get-ScheduledTask -TaskName $TaskName
if ([string]$registered.Principal.RunLevel -ne 'Highest') {
    throw 'Scheduled task registration did not retain RunLevel=Highest.'
}
if ([IO.Path]::GetFullPath([string]$registered.Actions.Execute) -ne [IO.Path]::GetFullPath($powershellExe)) {
    throw 'Scheduled task executable does not match the protected registration plan.'
}
if ([string]$registered.Actions.Arguments -notlike "*$protectedRunner*") {
    throw 'Scheduled task does not reference the protected runner copy.'
}

[ordered]@{
    registered = $true
    task_name = $TaskName
    run_level = [string]$registered.Principal.RunLevel
    logon_type = [string]$registered.Principal.LogonType
    user = $identity.Name
    protected_runner = $protectedRunner
    config_path = $configPath
    request_root = $requestRoot
    uac_disabled = $false
} | ConvertTo-Json -Depth 3
