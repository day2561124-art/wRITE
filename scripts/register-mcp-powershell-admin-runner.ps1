[CmdletBinding()]
param(
    [string]$TaskName,
    [switch]$ScopedTaskAuthorizations
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
if (-not $PSBoundParameters.ContainsKey('TaskName')) {
    $TaskName = if ($ScopedTaskAuthorizations) { 'WriterWorkbench-PowerShellScopedAdminRunner' } else { 'WriterWorkbench-PowerShellAdminRunner' }
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$windowsPrincipal = New-Object Security.Principal.WindowsPrincipal $identity
if (-not $windowsPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this registration script once from an elevated (Run as administrator) PowerShell window.'
}

$repoRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourceRunner = Join-Path $PSScriptRoot $(if ($ScopedTaskAuthorizations) { 'mcp-powershell-scoped-admin-runner.ps1' } else { 'mcp-powershell-admin-runner.ps1' })
if (-not (Test-Path -LiteralPath $sourceRunner -PathType Leaf)) {
    throw "Runner source is missing: $sourceRunner"
}

$protectedRoot = if ($ScopedTaskAuthorizations) {
    Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)) 'WriterWorkbench-PiMaintenance'
} else { Join-Path $env:ProgramData 'WriterWorkbench\AdminPowerShell' }
$protectedRunner = Join-Path $protectedRoot 'mcp-powershell-admin-runner.ps1'
$configPath = Join-Path $protectedRoot 'config.json'
$requestRoot = Join-Path $env:LOCALAPPDATA 'WriterWorkbench\PowerShellMaintenance'
$worktreesRoot = Join-Path (Split-Path -Parent $repoRoot) '.writer-workbench-worktrees'

if ($ScopedTaskAuthorizations) {
    if ($PSVersionTable.PSEdition -ne 'Desktop' -or -not [Environment]::Is64BitProcess) {
        throw 'Use elevated 64-bit Windows PowerShell for scoped admin runner registration.'
    }
    $currentTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($currentTask -and $currentTask.State -eq 'Running') { throw 'Wait for the active maintenance execution to finish before registering.' }

    $administrators = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $ownerRights = [Security.Principal.SecurityIdentifier]::new('S-1-3-4')
    $inheritBoth = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    $noPropagation = [Security.AccessControl.PropagationFlags]::None
    $allow = [Security.AccessControl.AccessControlType]::Allow
    $serviceIdentity = $identity.User

    function Get-AccessRuleKeys([Security.AccessControl.DirectorySecurity]$Acl) {
        return @($Acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object {
            @($_.IdentityReference.Value, [int]$_.FileSystemRights, [int]$_.AccessControlType, [int]$_.InheritanceFlags,
                [int]$_.PropagationFlags, $_.IsInherited) -join ':'
        } | Sort-Object)
    }

    function Initialize-ScopedDirectory([string]$Directory, [switch]$Inbox, [switch]$Private) {
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $acl.SetOwner($administrators)
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($principal in @($administrators, $system)) {
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
                $principal, [Security.AccessControl.FileSystemRights]::FullControl, $inheritBoth, $noPropagation, $allow))
        }
        # A file created by the elevated operator can retain the logged-in
        # user's SID as owner. Apply the ordinary token's rights to owners too.
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $ownerRights, [Security.AccessControl.FileSystemRights]::ReadPermissions, $inheritBoth, $noPropagation, $allow))
        if ($Inbox) {
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
                $serviceIdentity, [Security.AccessControl.FileSystemRights]'ReadAndExecute, Write', $allow))
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
                $serviceIdentity, [Security.AccessControl.FileSystemRights]::Modify, [Security.AccessControl.InheritanceFlags]::ObjectInherit,
                [Security.AccessControl.PropagationFlags]::InheritOnly, $allow))
        } elseif (-not $Private) {
            $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
                $serviceIdentity, [Security.AccessControl.FileSystemRights]::ReadAndExecute, $inheritBoth, $noPropagation, $allow))
        }

        $existing = Get-Item -LiteralPath $Directory -Force -ErrorAction SilentlyContinue
        if ($existing) {
            if (-not $existing.PSIsContainer -or ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "The scoped authorization path is not a regular directory: $Directory"
            }
            $actual = $existing.GetAccessControl()
            if (-not $actual.AreAccessRulesProtected -or
                $actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $administrators.Value -or
                ((Get-AccessRuleKeys $actual) -join ';') -cne ((Get-AccessRuleKeys $acl) -join ';')) {
                throw "The existing directory does not match the scoped authorization ACL: $Directory"
            }
        } else {
            $null = [IO.Directory]::CreateDirectory($Directory, $acl)
        }
    }

    Initialize-ScopedDirectory $protectedRoot
    foreach ($folder in @('results', 'grants', 'approved-scripts')) {
        Initialize-ScopedDirectory ([IO.Path]::Combine($protectedRoot, $folder))
    }
    Initialize-ScopedDirectory ([IO.Path]::Combine($protectedRoot, 'processing')) -Private
    Initialize-ScopedDirectory ([IO.Path]::Combine($protectedRoot, 'requests')) -Inbox
    foreach ($target in @($protectedRunner, $configPath)) {
        $existing = Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
        if ($existing -and ($existing.PSIsContainer -or ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint))) {
            throw 'The scoped runner installation target is invalid.'
        }
    }
    $config = [ordered]@{ schema_version = 2; expected_user_sid = $identity.User.Value; approved_scripts = $true }
    $requestRoot = $protectedRoot
}
else {
    New-Item -ItemType Directory -Path $protectedRoot -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $requestRoot 'requests') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $requestRoot 'results') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $requestRoot 'temp') -Force | Out-Null

    # Protect the directory before creating or replacing protected files.
    & icacls.exe $protectedRoot /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' "*$($identity.User.Value):(OI)(CI)RX" /C | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not protect the elevated runner directory ACL.'
    }

    # Upgrade path for registrations created by an older ACL layout.
    # Only these two fixed files are ever taken over; recursion is intentionally forbidden.
    foreach ($protectedFile in @($protectedRunner, $configPath)) {
        if (-not (Test-Path -LiteralPath $protectedFile -PathType Leaf)) { continue }

        & takeown.exe /F $protectedFile /A | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not take ownership of existing elevated runner file: $protectedFile"
        }

        & icacls.exe $protectedFile /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' "*$($identity.User.Value):RX" /C | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not repair existing elevated runner file ACL: $protectedFile"
        }
    }

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
}

Copy-Item -LiteralPath $sourceRunner -Destination $protectedRunner -Force
$configJson = $config | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText(
    $configPath,
    $configJson + [Environment]::NewLine,
    (New-Object Text.UTF8Encoding $false)
)

# Reassert explicit file ACLs after replacement. The normal user receives RX only.
if (-not $ScopedTaskAuthorizations) {
    foreach ($protectedFile in @($protectedRunner, $configPath)) {
        & icacls.exe $protectedFile /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' "*$($identity.User.Value):RX" /C | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not protect elevated runner file ACL: $protectedFile"
        }
    }
}

$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$quote = [char]34
$actionArgs = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' +
    $quote + $protectedRunner + $quote +
    ' -ConfigPath ' + $quote + $configPath + $quote

$action = New-ScheduledTaskAction -Execute $powershellExe -Argument $actionArgs -WorkingDirectory $(if ($ScopedTaskAuthorizations) { $protectedRoot } else { $repoRoot })
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
    scoped_task_authorizations = [bool]$ScopedTaskAuthorizations
    task_authorization_root = if ($ScopedTaskAuthorizations) { Join-Path $protectedRoot 'grants' } else { $null }
    uac_disabled = $false
} | ConvertTo-Json -Depth 3
