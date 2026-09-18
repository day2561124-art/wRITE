[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path $env:ProgramData 'WriterWorkbench\AdminPowerShell\config.json')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest
$MaxOutputBytes = 65536

function Test-PathInside {
    param([string]$Candidate, [string]$Root)
    $candidateFull = [IO.Path]::GetFullPath($Candidate).TrimEnd('\', '/')
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    if ($candidateFull.Equals($rootFull, [StringComparison]::OrdinalIgnoreCase)) { return $true }
    return $candidateFull.StartsWith(
        $rootFull + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase
    )
}

function Assert-MaintenanceCommand {
    param([string]$Command)
    if ([string]::IsNullOrWhiteSpace($Command)) { throw 'command is required.' }
    if ($Command.Length -gt 32768) { throw 'command exceeds the maintenance limit.' }

    $rules = @(
        '(?i)\b(?:Format-Volume|Clear-Disk|Initialize-Disk|Remove-Partition|New-Partition|Set-Partition|diskpart(?:\.exe)?|bcdedit(?:\.exe)?|bootrec(?:\.exe)?)\b',
        '(?i)\b(?:shutdown(?:\.exe)?|Stop-Computer|Restart-Computer|Remove-Computer)\b',
        '(?i)\b(?:Disable-WindowsOptionalFeature|Uninstall-WindowsFeature|Remove-WindowsFeature)\b',
        '(?i)\b(?:sc(?:\.exe)?\s+delete|Unregister-ScheduledTask)\b',
        '(?i)\bschtasks(?:\.exe)?\b[^\r\n;|]*/Delete\b',
        '(?i)\breg(?:\.exe)?\s+delete\s+(?:HKLM|HKEY_LOCAL_MACHINE|HKCR|HKEY_CLASSES_ROOT|HKU|HKEY_USERS)\b',
        '(?i)\b(?:Set-ItemProperty|New-ItemProperty|reg(?:\.exe)?\s+add)\b[^\r\n;|]*\bEnableLUA\b',
        '(?i)\b(?:Set-MpPreference|Add-MpPreference)\b[^\r\n;|]*(?:DisableRealtimeMonitoring|ExclusionPath|ExclusionProcess)',
        '(?i)\bnetsh(?:\.exe)?\b[^\r\n;|]*advfirewall[^\r\n;|]*\bstate\s+off\b',
        '(?i)\bSet-NetFirewallProfile\b[^\r\n;|]*-Enabled\s+(?:False|\$false)\b',
        '(?i)\b(?:Remove-Item|Clear-Content|Set-Content|Move-Item|Rename-Item|del|erase|rd|rmdir)\b[^\r\n;|]*(?:[A-Za-z]:\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:\\|\b)|\\\\\.\\PhysicalDrive\d+|HKLM:|HKCR:|HKU:)',
        '(?i)\b(?:takeown(?:\.exe)?|icacls(?:\.exe)?)\b[^\r\n;|]*[A-Za-z]:\\(?:Windows|Program Files(?: \(x86\))?|ProgramData)(?:\\|\b)'
    )
    foreach ($rule in $rules) {
        if ($Command -match $rule) { throw 'command is outside the bounded PowerShell maintenance policy.' }
    }
}

function Read-BoundedUtf8 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return @{ text = ''; truncated = $false }
    }

    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    try {
        $length = $stream.Length
        if ($length -le $MaxOutputBytes) {
            $bytes = New-Object byte[] ([int]$length)
            [void]$stream.Read($bytes, 0, $bytes.Length)
            return @{ text = [Text.Encoding]::UTF8.GetString($bytes); truncated = $false }
        }

        $headBytes = 16384
        $tailBytes = $MaxOutputBytes - $headBytes
        $head = New-Object byte[] $headBytes
        [void]$stream.Read($head, 0, $head.Length)
        [void]$stream.Seek(-$tailBytes, [IO.SeekOrigin]::End)
        $tail = New-Object byte[] $tailBytes
        [void]$stream.Read($tail, 0, $tail.Length)
        return @{
            text = [Text.Encoding]::UTF8.GetString($head) + [Environment]::NewLine +
                '...[output truncated; tail follows]...' + [Environment]::NewLine +
                [Text.Encoding]::UTF8.GetString($tail)
            truncated = $true
        }
    }
    finally { $stream.Dispose() }
}

function Write-Result {
    param([string]$ResultPath, [hashtable]$Payload)
    $tempPath = "$ResultPath.$PID.tmp"
    $json = $Payload | ConvertTo-Json -Depth 5 -Compress
    [IO.File]::WriteAllText($tempPath, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath $tempPath -Destination $ResultPath -Force
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "Protected admin runner config is missing: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($config.schema_version -ne 1) { throw 'Unsupported admin runner config schema.' }

$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($currentSid -ne [string]$config.expected_user_sid) {
    throw 'Admin runner identity does not match the registered user.'
}

$requestRoot = [IO.Path]::GetFullPath([string]$config.request_root)
$requestsDir = Join-Path $requestRoot 'requests'
$resultsDir = Join-Path $requestRoot 'results'
$tempDir = Join-Path $requestRoot 'temp'
New-Item -ItemType Directory -Path $requestsDir, $resultsDir, $tempDir -Force | Out-Null

$requestFile = Get-ChildItem -LiteralPath $requestsDir -Filter '*.request.json' -File |
    Sort-Object LastWriteTimeUtc, Name |
    Select-Object -First 1
if (-not $requestFile) { exit 0 }

$workingPath = $requestFile.FullName -replace '\.request\.json$', '.working.json'
Move-Item -LiteralPath $requestFile.FullName -Destination $workingPath -ErrorAction Stop

$request = $null
$requestId = $null
$resultPath = $null
$stdoutPath = $null
$stderrPath = $null
$startedAt = [Diagnostics.Stopwatch]::StartNew()

try {
    $request = Get-Content -LiteralPath $workingPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $requestId = [string]$request.request_id
    if ($request.schema_version -ne 1 -or $requestId -notmatch '^[a-f0-9]{32}$') {
        throw 'Invalid admin maintenance request schema or request id.'
    }

    $resultPath = Join-Path $resultsDir "$requestId.result.json"
    $stdoutPath = Join-Path $tempDir "$requestId.stdout.log"
    $stderrPath = Join-Path $tempDir "$requestId.stderr.log"

    $timeoutMs = [int]$request.timeout_ms
    if ($timeoutMs -lt 1000 -or $timeoutMs -gt 120000) { throw 'timeout_ms is outside the allowed range.' }

    $cwd = [IO.Path]::GetFullPath([string]$request.cwd)
    $cwdResolved = (Get-Item -LiteralPath $cwd -Force).FullName
    $allowed = $false
    foreach ($root in @($config.allowed_roots)) {
        if (Test-PathInside -Candidate $cwdResolved -Root ([string]$root)) {
            $allowed = $true
            break
        }
    }
    if (-not $allowed) { throw 'cwd is outside the registered Writer Workbench maintenance roots.' }

    $command = [string]$request.command
    Assert-MaintenanceCommand -Command $command

    $prefix = '$ProgressPreference = ''SilentlyContinue''; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding;'
    $wrappedCommand = $prefix + [Environment]::NewLine + $command
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($wrappedCommand))
    $powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $argumentString = "-NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded"

    $process = Start-Process -FilePath $powershellExe -ArgumentList $argumentString -WorkingDirectory $cwdResolved -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru

    $finished = $process.WaitForExit($timeoutMs)
    $timedOut = -not $finished
    if ($timedOut) {
        & taskkill.exe /PID $process.Id /T /F *> $null
        try { [void]$process.WaitForExit(5000) } catch {}
    }
    else {
        $process.WaitForExit()
    }

    $stdout = Read-BoundedUtf8 -Path $stdoutPath
    $stderr = Read-BoundedUtf8 -Path $stderrPath
    if (-not $timedOut) { $process.Refresh() }
    $exitCode = if ($timedOut -or -not $process.HasExited) { $null } else { [int]$process.ExitCode }

    Write-Result -ResultPath $resultPath -Payload @{
        schema_version = 1
        request_id = $requestId
        execution_ok = $true
        exit_code = $exitCode
        timed_out = $timedOut
        duration_ms = [int64]$startedAt.ElapsedMilliseconds
        stdout = $stdout.text
        stderr = $stderr.text
        stdout_truncated = [bool]$stdout.truncated
        stderr_truncated = [bool]$stderr.truncated
        reason = if ($timedOut) { 'PROCESS_TIMEOUT' } else { $null }
    }
}
catch {
    if ($requestId -and -not $resultPath) { $resultPath = Join-Path $resultsDir "$requestId.result.json" }
    if ($resultPath) {
        Write-Result -ResultPath $resultPath -Payload @{
            schema_version = 1
            request_id = $requestId
            execution_ok = $false
            exit_code = $null
            timed_out = $false
            duration_ms = [int64]$startedAt.ElapsedMilliseconds
            stdout = ''
            stderr = $_.Exception.Message
            stdout_truncated = $false
            stderr_truncated = $false
            reason = 'ADMIN_RUNNER_REJECTED_OR_FAILED'
        }
    }
}
finally {
    Remove-Item -LiteralPath $workingPath -Force -ErrorAction SilentlyContinue
    if ($stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue }
    if ($stderrPath) { Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue }
}
