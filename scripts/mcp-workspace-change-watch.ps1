param(
    [Parameter(Mandatory = $true)]
    [string]$WatchRootsJson,

    [int]$InternalBufferSize = 65536
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

function Write-WatcherMessage {
    param([hashtable]$Payload)
    [Console]::Out.WriteLine(($Payload | ConvertTo-Json -Compress -Depth 6))
    [Console]::Out.Flush()
}

function Normalize-FullPath {
    param([string]$Value)
    return [System.IO.Path]::GetFullPath($Value)
}

$rawRoots = @($WatchRootsJson | ConvertFrom-Json)
if ($rawRoots.Count -lt 1 -or $rawRoots.Count -gt 8) {
    throw 'WatchRootsJson must contain between 1 and 8 roots.'
}
if ($InternalBufferSize -lt 4096 -or $InternalBufferSize -gt 65536) {
    throw 'InternalBufferSize must be between 4096 and 65536 bytes.'
}

$roots = New-Object System.Collections.Generic.List[string]
foreach ($rawRoot in $rawRoots) {
    if ($null -eq $rawRoot -or [string]::IsNullOrWhiteSpace([string]$rawRoot)) {
        throw 'WatchRootsJson contains an invalid root.'
    }
    $root = Normalize-FullPath ([string]$rawRoot)
    if (-not [System.IO.Directory]::Exists($root)) {
        throw "Watcher root does not exist: $root"
    }
    if (-not $roots.Contains($root)) {
        $roots.Add($root)
    }
}

$watchers = New-Object System.Collections.Generic.List[System.IO.FileSystemWatcher]
$sourceIdentifiers = New-Object System.Collections.Generic.List[string]
$sequence = [int64]0

try {
    for ($index = 0; $index -lt $roots.Count; $index += 1) {
        $root = $roots[$index]
        $watcher = [System.IO.FileSystemWatcher]::new()
        $watcher.Path = $root
        $watcher.Filter = '*'
        $watcher.IncludeSubdirectories = $true
        $watcher.InternalBufferSize = $InternalBufferSize
        $watcher.NotifyFilter = (
            [System.IO.NotifyFilters]::FileName -bor
            [System.IO.NotifyFilters]::DirectoryName -bor
            [System.IO.NotifyFilters]::LastWrite -bor
            [System.IO.NotifyFilters]::Size -bor
            [System.IO.NotifyFilters]::Attributes -bor
            [System.IO.NotifyFilters]::CreationTime -bor
            [System.IO.NotifyFilters]::Security
        )

        foreach ($eventName in @('Changed', 'Created', 'Deleted', 'Renamed', 'Error')) {
            $sourceIdentifier = "writer-workbench.$index.$eventName"
            Register-ObjectEvent -InputObject $watcher -EventName $eventName -SourceIdentifier $sourceIdentifier | Out-Null
            $sourceIdentifiers.Add($sourceIdentifier)
        }
        $watchers.Add($watcher)
    }

    foreach ($watcher in $watchers) {
        $watcher.EnableRaisingEvents = $true
    }

    Write-WatcherMessage @{
        kind = 'ready'
        watcher_count = $watchers.Count
        roots = @($roots)
        process_id = $PID
    }

    while ($true) {
        $event = Wait-Event -Timeout 1
        if ($null -eq $event) {
            for ($index = 0; $index -lt $roots.Count; $index += 1) {
                if (-not [System.IO.Directory]::Exists($roots[$index])) {
                    Write-WatcherMessage @{
                        kind = 'root_lost'
                        watch_index = $index
                        root = $roots[$index]
                        reason = 'watch_root_missing'
                    }
                    exit 3
                }
            }
            continue
        }

        try {
            $parts = $event.SourceIdentifier.Split('.')
            if ($parts.Length -lt 3) {
                continue
            }
            $watchIndex = [int]$parts[$parts.Length - 2]
            $eventName = $parts[$parts.Length - 1]
            $root = $roots[$watchIndex]

            if ($eventName -eq 'Error') {
                $exception = $event.SourceEventArgs.GetException()
                $kind = if ($exception -is [System.IO.InternalBufferOverflowException]) { 'overflow' } else { 'error' }
                Write-WatcherMessage @{
                    kind = $kind
                    watch_index = $watchIndex
                    root = $root
                    exception_type = if ($null -ne $exception) { $exception.GetType().FullName } else { $null }
                    message = if ($null -ne $exception) { $exception.Message } else { 'filesystem watcher error' }
                }
                exit 2
            }

            $args = $event.SourceEventArgs
            if ($eventName -eq 'Changed' -and [System.IO.Directory]::Exists([string]$args.FullPath)) {
                # Directory metadata/LastWrite notifications are redundant with the
                # child Created/Deleted/Renamed events that can change snapshot
                # content, and fence-cookie writes can otherwise generate a chain
                # of ancestor-directory Changed noise on Windows.
                continue
            }

            $sequence += 1
            $payload = @{
                kind = 'event'
                sequence = $sequence
                watch_index = $watchIndex
                root = $root
                change_type = [string]$args.ChangeType
                full_path = [string]$args.FullPath
            }
            if ($eventName -eq 'Renamed') {
                $payload.old_full_path = [string]$args.OldFullPath
            }
            Write-WatcherMessage $payload
        }
        finally {
            Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
        }
    }
}
catch {
    Write-WatcherMessage @{
        kind = 'fatal'
        exception_type = $_.Exception.GetType().FullName
        message = $_.Exception.Message
    }
    exit 1
}
finally {
    foreach ($watcher in $watchers) {
        try { $watcher.EnableRaisingEvents = $false } catch {}
        try { $watcher.Dispose() } catch {}
    }
    foreach ($sourceIdentifier in $sourceIdentifiers) {
        Unregister-Event -SourceIdentifier $sourceIdentifier -ErrorAction SilentlyContinue
    }
}
