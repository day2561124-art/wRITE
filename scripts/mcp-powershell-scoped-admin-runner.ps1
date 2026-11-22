[CmdletBinding()]
param([Parameter(Mandatory)][string]$ConfigPath)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:PSModulePath = [IO.Path]::Combine($PSHOME, 'Modules')
$env:PATH = @([IO.Path]::Combine($env:SystemRoot, 'System32'), $env:SystemRoot, $PSHOME) -join [IO.Path]::PathSeparator
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

function Confirm-MaintenanceGrant([string]$GrantId, [string]$Binding, [long]$CreatedAt, [string]$GrantRoot, [bool]$ScriptRequest) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($CreatedAt -gt $now -or $now - $CreatedAt -gt 45000) { throw 'Stale scoped maintenance request.' }
    $grant = Read-ProtectedJson ([IO.Path]::Combine($GrantRoot, "$GrantId.grant.json"))
    if ($grant.schema_version -ne 1 -or $grant.project_id -cne 'writer_workbench' -or $grant.task_authorization_id -cne $GrantId -or
        $grant.workspace_id -isnot [string] -or $grant.workspace_id -cnotmatch '^dev_workspace_[a-f0-9]{24}$' -or
        $grant.workstream_id -isnot [string] -or $grant.workstream_id -cnotmatch '^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$' -or
        $grant.goal -isnot [string] -or $grant.issued_at_ms -isnot [long] -or $grant.expires_at_ms -isnot [long] -or
        $now -lt $grant.issued_at_ms -or $now -ge $grant.expires_at_ms -or $grant.capabilities -isnot [array]) {
        throw 'The protected grant does not authorize scoped maintenance.'
    }
    if ($ScriptRequest) {
        if ($grant.permission_level -cne 'workspace_with_admin_script' -or $grant.capabilities -cnotcontains 'windows.powershell.run_approved' -or
            $grant.windows_scripts -isnot [array] -or $grant.windows_scripts.Count -lt 1 -or $grant.windows_scripts.Count -gt 8) {
            throw 'The protected grant does not authorize an approved script.'
        }
    } elseif ($grant.permission_level -cnotin @('workspace_with_admin_service','workspace_with_admin_script') -or
        $grant.capabilities -cnotcontains 'windows.service.ensure_running' -or
        $grant.windows_services -isnot [array] -or $grant.windows_services.Count -lt 1 -or $grant.windows_services.Count -gt 16) {
        throw 'The protected grant does not authorize scoped service maintenance.'
    }

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $targets = @(
            $registered = if ($ScriptRequest) { $grant.windows_scripts } else { $grant.windows_services }
            foreach ($target in $registered) {
                if ($ScriptRequest) {
                    if ($target.script_id -isnot [string] -or $target.script_id -cnotmatch '^(?!(?:aux|con|nul|prn|com[0-9]|lpt[0-9])$)[a-z0-9][a-z0-9_-]{0,63}$' -or
                        $target.script_sha256 -isnot [string] -or $target.script_sha256 -cnotmatch '^[a-f0-9]{64}$') {
                        throw 'Invalid approved script in protected grant.'
                    }
                    $suffix = @('approved_script', $target.script_id, $target.script_sha256)
                } else {
                    if ($target -isnot [string] -or $target -cnotmatch '^[a-z0-9][a-z0-9_.-]{0,79}$') { throw 'Invalid service in protected grant.' }
                    $suffix = @($target)
                }
                $scope = (@($grant.workspace_id, $grant.workstream_id, $grant.goal) + $suffix) -join "`n"
                $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($scope))).Replace('-', '').ToLowerInvariant()
                if ($hash.Substring(0, 32) -ceq $Binding) { $target }
            }
        )
    } finally { $sha.Dispose() }
    if ($targets.Count -ne 1) { throw 'Request scope does not match a protected maintenance target.' }

    $revocation = [IO.Path]::Combine($GrantRoot, "$GrantId.revocation.json")
    try {
        $null = [IO.File]::GetAttributes($revocation)
        throw 'The protected grant has been revoked.'
    } catch [IO.FileNotFoundException] {
        return [pscustomobject]@{ grant = $grant; target = $targets[0] }
    }
}

function Assert-JournalAdmission($Marker, [string]$JournalRoot, $Authorization, [bool]$ScriptRequest) {
    $events = [IO.Path]::Combine($JournalRoot, 'events')
    for ($directory = [IO.DirectoryInfo]::new($events); $null -ne $directory; $directory = $directory.Parent) {
        Assert-PlainDirectory $directory.FullName
    }
    $sequenceText = $Marker.Groups['sequence'].Value
    $sequence = [long]$sequenceText
    $eventId = 'dev_journal_event_' + $Marker.Groups['event'].Value
    $event = Read-ProtectedJson ([IO.Path]::Combine($events, "$sequenceText-$eventId.json"))
    $head = Read-ProtectedJson ([IO.Path]::Combine($JournalRoot, 'head.json'))
    $grant = $Authorization.grant
    $result = $event.result
    if ($head.schema_version -ne 1 -or $sequence -lt 1 -or $head.latest_sequence -lt $sequence -or
        $event.schema_version -ne 1 -or $event.sequence -ne $sequence -or $event.journal_event_id -cne $eventId -or
        $event.event_hash -cnotmatch '^[a-f0-9]{64}$' -or
        ($head.latest_sequence -eq $sequence -and ($head.latest_event_id -cne $eventId -or $head.latest_event_hash -cne $event.event_hash)) -or
        $event.operation_id -cne ('dev_operation_' + $Marker.Groups['id'].Value) -or
        $event.parent_operation_id -cnotmatch '^dev_operation_[a-f0-9]{32}$' -or
        $event.stage -cne 'operation_started' -or $event.tool_name -cne 'powershell_admin_run' -or
        $event.operation_type -cne 'powershell_admin_maintenance' -or
        $event.workspace_id -cne $grant.workspace_id -or $event.workstream_id -cne $grant.workstream_id -or
        $result.elevated -ne $true -or $result.scoped_admin_dispatch_protocol -ne 3 -or
        $result.task_authorization_id -cne $grant.task_authorization_id -or
        $result.scoped_admin_scope_binding -cne $Marker.Groups['binding'].Value) {
        throw 'The scoped maintenance request has no matching committed Journal admission.'
    }
    if ($ScriptRequest) {
        if ($result.script_id -cne $Authorization.target.script_id -or $result.script_sha256 -cne $Authorization.target.script_sha256) {
            throw 'The Journal admission does not authorize this script.'
        }
    } elseif ($result.service_name -cne $Authorization.target) {
        throw 'The Journal admission does not authorize this service.'
    }
}

function Read-ApprovedScript([string]$Directory, $Target) {
    Assert-PlainDirectory $Directory
    $file = [IO.FileInfo]::new([IO.Path]::Combine($Directory, "$($Target.script_id).ps1"))
    if (-not $file.Exists -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        $file.Length -lt 1 -or $file.Length -gt 8192) { throw 'Invalid approved script file.' }
    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    if ($bytes.Length -gt 8192) { throw 'Approved script exceeds the source limit.' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($hash -cne $Target.script_sha256) { throw 'Approved script content does not match the task grant.' }
    return [Text.UTF8Encoding]::new($false, $true).GetString($bytes).TrimStart([char]0xFEFF)
}

function Get-ScriptOutputSample([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    try {
        $bytes = [byte[]]::new(4096)
        $count = $stream.Read($bytes, 0, $bytes.Length)
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($bytes, 0, $count)).Replace('-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
        return @{ sha256 = $hash; truncated = $stream.Length -gt $count }
    } finally { $stream.Dispose() }
}

function Invoke-ApprovedScript([string]$Source, [string]$Root, [string]$Processing, [string]$Id, [hashtable]$Result) {
    $process = $null
    $stdout = [IO.Path]::Combine($Processing, "$Id.stdout")
    $stderr = [IO.Path]::Combine($Processing, "$Id.stderr")
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Source))
    $system = [IO.Path]::Combine($env:SystemRoot, 'System32')
    $powershell = [IO.Path]::Combine($system, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    $taskkill = [IO.Path]::Combine($system, 'taskkill.exe')
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        $Result.dispatch_started = $true
        $process = Start-Process -FilePath $powershell -ArgumentList "-NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded" `
            -WorkingDirectory $Root -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
        $null = $process.Handle
        while (-not $process.WaitForExit(125)) {
            if ($timer.ElapsedMilliseconds -ge 45000) {
                $Result.timed_out = $true
                $Result.reason = 'SCOPED_ADMIN_SCRIPT_TIMEOUT'
                return
            }
            if (([IO.FileInfo]::new($stdout).Length + [IO.FileInfo]::new($stderr).Length) -gt 1048576) { return }
        }
        $process.WaitForExit()
        $process.Refresh()
        if ($null -eq $process.ExitCode) { return }
        $output = Get-ScriptOutputSample $stdout
        $errorOutput = Get-ScriptOutputSample $stderr
        $Result.script_stdout_sample_sha256 = $output.sha256
        $Result.script_stderr_sample_sha256 = $errorOutput.sha256
        $Result.stdout_truncated = $output.truncated
        $Result.stderr_truncated = $errorOutput.truncated
        $Result.exit_code = [int]$process.ExitCode
        if ($Result.exit_code -eq 0) {
            $Result.execution_ok = $true
            $Result.reason = $null
            $Result.stdout = 'approved_script_completed'
        } else {
            $Result.stderr = [string]$Result.reason
        }
    } finally {
        if ($null -ne $process) {
            if (-not $process.HasExited) {
                & $taskkill /PID $process.Id /T /F *> $null
                $null = $process.WaitForExit(5000)
            }
            $process.Dispose()
        }
        foreach ($file in @($stdout, $stderr)) {
            Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        }
    }
}

$config = Read-ProtectedJson $ConfigPath
if ($config.schema_version -ne 3 -or $config.expected_user_sid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or
    $config.dispatcher_sid -cnotmatch '^S-1-5-21-(?:\d+-){3}\d+$' -or $config.dispatcher_sid -ceq $config.expected_user_sid -or
    $config.journal_root -isnot [string] -or $config.journal_root -cnotmatch '^[A-Za-z]:\\') {
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
$markerPattern = '^(?<id>[a-f0-9]{32})~(?<grant>pi_task_[a-f0-9]{32})~(?<binding>[a-f0-9]{32})~(?<time>[0-9]{13})~(?<sequence>[0-9]{12})~(?<event>[a-f0-9]{32})(?<kind>~script)?\.scoped-request$'
$pending = [IO.Directory]::EnumerateFiles($requests, '*.scoped-request') |
    Where-Object { [IO.Path]::GetFileName($_) -cmatch $markerPattern } | Select-Object -First 1
if (-not $pending) { exit 0 }
$marker = [regex]::Match([IO.Path]::GetFileName($pending), $markerPattern)
$requestId = $marker.Groups['id'].Value
$grantId = $marker.Groups['grant'].Value
$binding = $marker.Groups['binding'].Value
$scriptRequest = $marker.Groups['kind'].Success
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
    service_name = $null; script_id = $null; script_sha256 = $null; execution_ok = $false; exit_code = $null; timed_out = $false; stdout = ''; stderr = '';
    stdout_truncated = $false; stderr_truncated = $false; dispatch_started = $false; reason = 'SCOPED_ADMIN_AUTHORIZATION_DENIED' }
try {
    $authorization = Confirm-MaintenanceGrant $grantId $binding ([long]$marker.Groups['time'].Value) $grants $scriptRequest
    Assert-JournalAdmission $marker $config.journal_root $authorization $scriptRequest
    $target = $authorization.target
    if ($scriptRequest) {
        if ($config.approved_scripts -ne $true) { throw 'Approved scripts are unavailable.' }
        $source = Read-ApprovedScript ([IO.Path]::Combine($root, 'approved-scripts')) $target
        $result.script_id = $target.script_id
        $result.script_sha256 = $target.script_sha256
        $result.reason = 'SCOPED_ADMIN_SCRIPT_FAILED'
        Invoke-ApprovedScript $source $root $processing $requestId $result
    } else {
        $result.service_name = $target
        $result.reason = 'SCOPED_ADMIN_SERVICE_FAILED'
        $service = Microsoft.PowerShell.Management\Get-Service -Name $target -ErrorAction Stop
        if ($service.Status -eq 'Stopped') {
            $result.dispatch_started = $true
            Microsoft.PowerShell.Management\Start-Service -InputObject $service -ErrorAction Stop
        }
        $service.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(15))
        $result.execution_ok = $true
        $result.exit_code = 0
        $result.stdout = 'service_running'
        $result.reason = $null
    }
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
