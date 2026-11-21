[CmdletBinding()]
param([Parameter(Mandatory)][string]$ConfigPath)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')
Set-StrictMode -Version Latest

function Read-ProtectedJson([string]$Path) {
    $item = [IO.FileInfo]::new($Path)
    if (-not $item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        $item.Length -lt 1 -or $item.Length -gt 16384) { throw 'Invalid protected maintenance record.' }
    return ([IO.File]::ReadAllText($Path, [Text.UTF8Encoding]::new($false, $true)) | ConvertFrom-Json)
}

function Assert-PlainDirectory([string]$Path) {
    $item = [IO.DirectoryInfo]::new($Path)
    if (-not $item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Invalid protected maintenance directory.' }
}

function Confirm-ServiceGrant([string]$GrantId, [string]$Binding, [long]$CreatedAt, [string]$GrantRoot) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($CreatedAt -gt $now -or $now - $CreatedAt -gt 45000) { throw 'Stale scoped maintenance request.' }
    $grant = Read-ProtectedJson ([IO.Path]::Combine($GrantRoot, "$GrantId.grant.json"))
    if ($grant.schema_version -ne 1 -or $grant.project_id -cne 'writer_workbench' -or
        $grant.permission_level -cne 'workspace_with_admin_service' -or $grant.task_authorization_id -cne $GrantId -or
        $grant.workspace_id -isnot [string] -or $grant.workspace_id -cnotmatch '^dev_workspace_[a-f0-9]{24}$' -or
        $grant.workstream_id -isnot [string] -or $grant.workstream_id -cnotmatch '^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$' -or
        $grant.goal -isnot [string] -or $grant.issued_at_ms -isnot [long] -or $grant.expires_at_ms -isnot [long] -or
        $now -lt $grant.issued_at_ms -or $now -ge $grant.expires_at_ms -or
        $grant.capabilities -isnot [array] -or $grant.capabilities -cnotcontains 'windows.service.ensure_running' -or
        $grant.windows_services -isnot [array] -or $grant.windows_services.Count -lt 1 -or $grant.windows_services.Count -gt 16) {
        throw 'The protected grant does not authorize scoped service maintenance.'
    }

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $targets = @(
            foreach ($service in $grant.windows_services) {
                if ($service -isnot [string] -or $service -cnotmatch '^[a-z0-9][a-z0-9_.-]{0,79}$') { throw 'Invalid service in protected grant.' }
                $scope = @($grant.workspace_id, $grant.workstream_id, $grant.goal, $service) -join "`n"
                $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($scope))).Replace('-', '').ToLowerInvariant()
                if ($hash.Substring(0, 32) -ceq $Binding) { $service }
            }
        )
    } finally { $sha.Dispose() }
    if ($targets.Count -ne 1) { throw 'Request scope does not match a protected service target.' }

    $revocation = [IO.Path]::Combine($GrantRoot, "$GrantId.revocation.json")
    try {
        $null = [IO.File]::GetAttributes($revocation)
        throw 'The protected grant has been revoked.'
    } catch [IO.FileNotFoundException] {
        return $targets[0]
    }
}

$config = Read-ProtectedJson $ConfigPath
if ($config.schema_version -ne 2 -or $config.expected_user_sid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) {
    throw 'Protected runner identity or configuration mismatch.'
}
$root = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ConfigPath))
Assert-PlainDirectory $root
$requests = [IO.Path]::Combine($root, 'requests')
$processing = [IO.Path]::Combine($root, 'processing')
$results = [IO.Path]::Combine($root, 'results')
$grants = [IO.Path]::Combine($root, 'grants')
foreach ($directory in @($requests, $processing, $results, $grants)) { Assert-PlainDirectory $directory }

# Only the marker's name is input. The elevated runner never opens or executes
# a file supplied through the writable inbox.
$markerPattern = '^(?<id>[a-f0-9]{32})~(?<grant>pi_task_[a-f0-9]{32})~(?<binding>[a-f0-9]{32})~(?<time>[0-9]{13})\.scoped-request$'
$pending = [IO.Directory]::EnumerateFiles($requests, '*.scoped-request') |
    Where-Object { [IO.Path]::GetFileName($_) -cmatch $markerPattern } | Select-Object -First 1
if (-not $pending) { exit 0 }
$marker = [regex]::Match([IO.Path]::GetFileName($pending), $markerPattern)
$requestId = $marker.Groups['id'].Value
$grantId = $marker.Groups['grant'].Value
$binding = $marker.Groups['binding'].Value
$claimed = [IO.Path]::Combine($processing, "$requestId.claim")
$resultPath = [IO.Path]::Combine($results, "$requestId.result.json")
if ([IO.File]::Exists($resultPath)) {
    [IO.File]::Delete($pending)
    exit 0
}

# An interrupted claim stays fenced. Only the producer of an exact completed
# result may retire the protected claim.
$lock = [IO.File]::Open($claimed, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
$lock.Dispose()
[IO.File]::Delete($pending)
$timer = [Diagnostics.Stopwatch]::StartNew()
$result = @{ schema_version = 2; request_id = $requestId; task_authorization_id = $grantId; scope_binding = $binding;
    service_name = $null; execution_ok = $false; exit_code = $null; timed_out = $false; stdout = ''; stderr = '';
    stdout_truncated = $false; stderr_truncated = $false; dispatch_started = $false; reason = 'SCOPED_ADMIN_AUTHORIZATION_DENIED' }
try {
    $serviceName = Confirm-ServiceGrant $grantId $binding ([long]$marker.Groups['time'].Value) $grants
    $result.service_name = $serviceName
    $result.reason = 'SCOPED_ADMIN_SERVICE_FAILED'
    $service = Microsoft.PowerShell.Management\Get-Service -Name $serviceName -ErrorAction Stop
    if ($service.Status -eq 'Stopped') {
        $result.dispatch_started = $true
        Microsoft.PowerShell.Management\Start-Service -InputObject $service -ErrorAction Stop
    }
    $service.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(15))
    $result.execution_ok = $true
    $result.exit_code = 0
    $result.stdout = 'service_running'
    $result.reason = $null
} catch {
    $result.stderr = [string]$result.reason
}
$result.duration_ms = $timer.ElapsedMilliseconds
# Stage on the receipt ACL so the atomic rename preserves normal-token read access.
$staged = [IO.Path]::Combine($results, "$requestId.result.tmp")
$bytes = [Text.UTF8Encoding]::new($false).GetBytes(($result | ConvertTo-Json -Compress) + "`n")
$out = [IO.File]::Open($staged, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try { $out.Write($bytes, 0, $bytes.Length); $out.Flush($true) }
finally { $out.Dispose() }
[IO.File]::Move($staged, $resultPath)
[IO.File]::Delete($claimed)
