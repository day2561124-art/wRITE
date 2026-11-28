[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true)][string]$IssuerAccount,
    [Parameter(Mandatory=$true)][string]$SupervisorAccount
)
# Operator-only, create-only preparation. No key, credential, service,
# launcher pin, grant, receipt, or execution capability is created.
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if ($PSVersionTable.PSEdition -ne 'Desktop' -or -not [Environment]::Is64BitProcess) {
    throw 'Use elevated 64-bit Windows PowerShell.'
}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Operator elevation required.'
}
$admins=[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$ownerRights=[Security.Principal.SecurityIdentifier]::new('S-1-3-4')
$inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$prop=[Security.AccessControl.PropagationFlags]::None
$allow=[Security.AccessControl.AccessControlType]::Allow
$sections=[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Group -bor [Security.AccessControl.AccessControlSections]::Access

function Assert-RegularDirectory([string]$Path) {
    $item=Get-Item -LiteralPath $Path -Force
    if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Not a regular directory: $Path"
    }
    return $item
}
function RuleKeys($Acl) {
    return @($Acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object {
        @($_.IdentityReference.Value,[int]$_.FileSystemRights,[int]$_.AccessControlType,
          [int]$_.InheritanceFlags,[int]$_.PropagationFlags,$_.IsInherited) -join ':'
    } | Sort-Object)
}
function New-DirectoryAcl([Security.Principal.SecurityIdentifier[]]$Readers,
                          [Security.Principal.SecurityIdentifier[]]$Writers) {
    $acl=[Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($admins)
    $acl.SetAccessRuleProtection($true,$false)
    foreach ($sid in @($admins,$system)) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,$prop,$allow))
    }
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
        $ownerRights,[Security.AccessControl.FileSystemRights]::ReadPermissions,$inherit,$prop,$allow))
    foreach ($sid in $Readers) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid,[Security.AccessControl.FileSystemRights]::ReadAndExecute,$inherit,$prop,$allow))
    }
    foreach ($sid in $Writers) {
        # A writer may publish files in its own exchange directory, but must
        # not change the exchange directory ACL or delete the directory itself.
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid,[Security.AccessControl.FileSystemRights]'ReadAndExecute, Write, DeleteSubdirectoriesAndFiles',$allow))
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid,[Security.AccessControl.FileSystemRights]::Modify,[Security.AccessControl.InheritanceFlags]::ObjectInherit,
            [Security.AccessControl.PropagationFlags]::InheritOnly,$allow))
    }
    return $acl
}
function Assert-Acl([string]$Path,$Expected) {
    $actual=(Assert-RegularDirectory $Path).GetAccessControl()
    if (-not $actual.AreAccessRulesProtected -or
        $actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $admins.Value -or
        ((RuleKeys $actual) -join ';') -cne ((RuleKeys $Expected) -join ';')) {
        throw "ACL mismatch: $Path"
    }
}
function Get-Sha256Text([string]$Value) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

$maintenance=Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFiles)) 'WriterWorkbench-PiMaintenance-v3'
# Verify each existing ancestor; no path override, junction or repair.
$walk=$maintenance
while ($walk) {
    $null=Assert-RegularDirectory $walk
    $next=[IO.Path]::GetDirectoryName($walk)
    if (-not $next -or $next -eq $walk) { break }
    $walk=$next
}
$configPath=Join-Path $maintenance 'config.json'
$file=Get-Item -LiteralPath $configPath -Force
if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $file.Length -gt 65536) {
    throw 'Existing maintenance configuration is not a regular bounded file.'
}
$cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if ($cfg.schema_version -ne 3 -or $cfg.approved_scripts -ne $true -or $cfg.dispatcher_sid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$') {
    throw 'Existing scoped maintenance configuration is not recognized.'
}
$dispatcher=[Security.Principal.SecurityIdentifier]::new([string]$cfg.dispatcher_sid)
Assert-Acl $maintenance (New-DirectoryAcl @($dispatcher) @())

$adminMembers=@(Get-LocalGroupMember -SID $admins | ForEach-Object {$_.SID.Value})
function Resolve-LocalStandard([string]$Name) {
    if ($Name -cnotmatch '^[A-Za-z0-9_.-]{1,20}$') { throw 'Use an existing local account name.' }
    $users=@(Get-LocalUser -Name $Name | Where-Object {$_.Name -ieq $Name})
    if ($users.Count -ne 1 -or -not $users[0].Enabled -or $adminMembers -contains $users[0].SID.Value) {
        throw 'Account must be a distinct enabled local standard account.'
    }
    return $users[0].SID
}
$issuer=Resolve-LocalStandard $IssuerAccount
$supervisor=Resolve-LocalStandard $SupervisorAccount
$dispatchUser=@(Get-LocalUser -SID $dispatcher)
if ($dispatchUser.Count -ne 1 -or -not $dispatchUser[0].Enabled -or $adminMembers -contains $dispatcher.Value) {
    throw 'Dispatcher must remain a standard enabled local account.'
}
if (@($issuer.Value,$supervisor.Value,$dispatcher.Value,$identity.User.Value | Sort-Object -Unique).Count -ne 4) {
    throw 'Operator, dispatcher, issuer and supervisor identities must be distinct.'
}
$root=Join-Path $maintenance 'independent-verification'
if (Test-Path -LiteralPath $root) { throw 'Independent verification path already exists. No repair or overwrite.' }
$layout=@(
    [pscustomobject]@{Path=$root;Acl=(New-DirectoryAcl @($dispatcher,$issuer,$supervisor) @())},
    [pscustomobject]@{Path=(Join-Path $root 'receipts');Acl=(New-DirectoryAcl @($dispatcher) @($issuer))},
    [pscustomobject]@{Path=(Join-Path $root 'outcomes');Acl=(New-DirectoryAcl @($issuer) @($supervisor))}
)
if (-not $PSCmdlet.ShouldProcess($root,'Create new protected independent evidence exchange directories')) {
    return [pscustomobject]@{status='PLAN_ONLY';root=$root;dispatcher_sid=$dispatcher.Value;issuer_sid=$issuer.Value;supervisor_sid=$supervisor.Value;activation=$false}
}
# No existing directory is changed or removed. On interruption stop and
# report the partial state for operator review; never recursively clean up.
foreach ($entry in $layout) {
    if (Test-Path -LiteralPath $entry.Path) { throw "Unexpected existing target: $($entry.Path)" }
    $null=[IO.Directory]::CreateDirectory($entry.Path,$entry.Acl)
    Assert-Acl $entry.Path $entry.Acl
}
Assert-Acl $maintenance (New-DirectoryAcl @($dispatcher) @())
$result=@(foreach($entry in $layout) {
    Assert-Acl $entry.Path $entry.Acl
    $acl=(Assert-RegularDirectory $entry.Path).GetAccessControl()
    [pscustomobject]@{path=$entry.Path;acl_sha256=(Get-Sha256Text ($acl.GetSecurityDescriptorSddlForm($sections)))}
})
[pscustomobject]@{status='DIRECTORIES_PREPARED_ONLY';root=$root;dispatcher_sid=$dispatcher.Value;
    issuer_sid=$issuer.Value;supervisor_sid=$supervisor.Value;directories=$result;
    activation=$false;operator_review_required=$true} | ConvertTo-Json -Depth 5
