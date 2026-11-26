[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$DispatcherAccount,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSourceSha256
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

# Explicit host-operator installation only. No MCP, Pi, standing-policy,
# general maintenance-dispatcher or unattended-update entry point.
if ($PSVersionTable.PSEdition -ne 'Desktop' -or -not [Environment]::Is64BitProcess) {
    throw 'Use elevated 64-bit Windows PowerShell.'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Explicit elevated operator installation is required.'
}
$admins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$ownerRights = [Security.Principal.SecurityIdentifier]::new('S-1-3-4')
$users = @(Get-LocalUser -Name $DispatcherAccount | Where-Object { $_.Name -ceq $DispatcherAccount })
if ($users.Count -ne 1 -or -not $users[0].Enabled) { throw 'Select one enabled local dispatcher account.' }
$dispatcher = $users[0].SID
if ($dispatcher -eq $identity.User -or $dispatcher -eq $system -or
    @(Get-LocalGroupMember -SID $admins | Where-Object { $_.SID -eq $dispatcher }).Count -ne 0) {
    throw 'The dispatcher must be a separate standard local account.'
}

$taskName = 'WriterWorkbench-NexaStationLeaseV1'
$root = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)) 'WriterWorkbench-NexaStationLease-v1'
$source = Join-Path $PSScriptRoot 'mcp-session0-station-lease-provider.cs'
$compiler = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::Windows)) 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue) { throw 'Existing task; explicit maintenance required.' }
if (Test-Path -LiteralPath $root) { throw 'Existing provider directory; explicit maintenance required.' }
$sourceItem = Get-Item -LiteralPath $source -Force
if ($sourceItem.PSIsContainer -or ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Provider source must be a regular file.'
}
if ($sourceItem.Length -gt 65536) { throw 'Unexpected provider source size.' }
$bytes = [IO.File]::ReadAllBytes($sourceItem.FullName)
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','') }
finally { $sha.Dispose() }
if ($digest -cne $ExpectedSourceSha256.ToUpperInvariant()) { throw 'Reviewed provider source hash mismatch.' }

$inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$none = [Security.AccessControl.PropagationFlags]::None
$allow = [Security.AccessControl.AccessControlType]::Allow
$acl = [Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($admins)
$acl.SetAccessRuleProtection($true,$false)
foreach ($sid in @($admins,$system)) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,$none,$allow))
}
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($ownerRights,[Security.AccessControl.FileSystemRights]::ReadPermissions,$inherit,$none,$allow))
# The standard account has no write or task-configuration permission.
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($dispatcher,[Security.AccessControl.FileSystemRights]::ReadAndExecute,$inherit,$none,$allow))

function RuleKeys($security) {
    @($security.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object {
        @($_.IdentityReference.Value,[int]$_.FileSystemRights,[int]$_.AccessControlType,[int]$_.InheritanceFlags,[int]$_.PropagationFlags,$_.IsInherited) -join ':'
    } | Sort-Object)
}
function AssertProtectedRoot {
    $item = Get-Item -LiteralPath $root -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Provider root mismatch.' }
    $actual = $item.GetAccessControl()
    if (-not $actual.AreAccessRulesProtected -or $actual.GetOwner([Security.Principal.SecurityIdentifier]) -ne $admins -or
        ((RuleKeys $actual) -join ';') -cne ((RuleKeys $acl) -join ';')) { throw 'Provider root ACL mismatch.' }
}
$createdTask = $false
$createdRoot = $false
try {
    $null = [IO.Directory]::CreateDirectory($root,$acl)
    $createdRoot = $true
    AssertProtectedRoot
    $trustedSource = Join-Path $root 'station-lease-provider.cs'
    $exe = Join-Path $root 'station-lease-provider.exe'
    [IO.File]::WriteAllBytes($trustedSource,$bytes)
    if ((Get-FileHash -LiteralPath $trustedSource -Algorithm SHA256).Hash -cne $digest) { throw 'Protected source mismatch.' }
    & $compiler /nologo /target:exe /platform:x64 "/out:$exe" $trustedSource
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Provider compilation failed.' }
    AssertProtectedRoot
    $exeItem = Get-Item -LiteralPath $exe -Force
    if ($exeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid provider executable.' }
    $action = New-ScheduledTaskAction -Execute $exe -Argument $dispatcher.Value -WorkingDirectory $root
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 85) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $task = New-ScheduledTask -Action $action -Principal $taskPrincipal -Settings $settings -Description 'Nexa fixed station/desktop resource provider; on demand only; no guest execution.'
    $null = Register-ScheduledTask -TaskName $taskName -TaskPath '\' -InputObject $task
    $createdTask = $true
    $scheduler = New-Object -ComObject 'Schedule.Service'
    $scheduler.Connect()
    $registeredTask = $scheduler.GetFolder('\').GetTask($taskName)
    $registeredTask.SetSecurityDescriptor("D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;GRGX;;;$($dispatcher.Value))",0x10)
    $registered = Get-ScheduledTask -TaskName $taskName -TaskPath '\'
    if (@($registered.Actions).Count -ne 1 -or @($registered.Triggers | Where-Object { $null -ne $_ }).Count -ne 0 -or
        [string]$registered.Principal.LogonType -ne 'ServiceAccount' -or [string]$registered.Principal.RunLevel -ne 'Highest' -or
        [string]$registered.Actions.Execute -cne $exe -or [string]$registered.Actions.Arguments -cne $dispatcher.Value -or
        [string]$registered.Actions.WorkingDirectory -cne $root -or [string]$registered.Settings.MultipleInstances -ne 'IgnoreNew') {
        throw 'Registered provider task does not match the installation plan.'
    }
    $taskIdentity = [string]$registered.Principal.UserId
    if ($taskIdentity -ne 'SYSTEM' -and $taskIdentity -ne 'S-1-5-18' -and $taskIdentity -ne 'NT AUTHORITY\SYSTEM') {
        throw 'Unexpected task principal.'
    }
    # No task start: the first authorized fixed-verification runner starts it.
    [pscustomobject]@{
        task_name = $taskName
        provider_root = $root
        source_sha256 = $digest
        executable_sha256 = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
        dispatcher_sid = $dispatcher.Value
        started = $false
        installed = $true
    } | ConvertTo-Json -Compress
} catch {
    if ($createdTask) {
        Unregister-ScheduledTask -TaskName $taskName -TaskPath '\' -Confirm:$false
    }
    if ($createdRoot) {
        # Remove only the newly created, verified protected directory. Do not
        # recursively remove an unknown or replaced directory.
        AssertProtectedRoot
        foreach ($name in @('station-lease-provider.exe','station-lease-provider.cs')) {
            $file = Join-Path $root $name
            if (Test-Path -LiteralPath $file) {
                $item = Get-Item -LiteralPath $file -Force
                if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Rollback path mismatch.' }
                Remove-Item -LiteralPath $file -Force
            }
        }
        [IO.Directory]::Delete($root,$false)
    }
    throw
}
