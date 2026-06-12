[CmdletBinding()]
param(
    [switch]$ConfirmClean
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupsRoot = Join-Path $projectRoot "data\backups"
$allowedRelativePaths = @(
    "project_backups",
    "exports",
    "restore_previews"
)

function Assert-AllowedTarget {
    param([string]$TargetPath)

    $rootFull = [System.IO.Path]::GetFullPath($backupsRoot)
    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
    $allowedFullPaths = @($allowedRelativePaths | ForEach-Object {
        [System.IO.Path]::GetFullPath((Join-Path $backupsRoot $_))
    })
    if (-not ($allowedFullPaths -contains $targetFull)) {
        throw "Refusing to clean non-allowlisted path: $targetFull"
    }
    if (-not $targetFull.StartsWith($rootFull + [System.IO.Path]::DirectorySeparatorChar)) {
        throw "Refusing to clean a path outside data/backups: $targetFull"
    }
}

foreach ($relativePath in $allowedRelativePaths) {
    $target = Join-Path $backupsRoot $relativePath
    Assert-AllowedTarget -TargetPath $target
    $items = @(Get-ChildItem -LiteralPath $target -Force -ErrorAction SilentlyContinue)
    if (-not $ConfirmClean) {
        Write-Host "[DRY RUN] $target"
        foreach ($item in $items) {
            Write-Host "  would remove: $($item.FullName)"
        }
        continue
    }

    foreach ($item in $items) {
        Remove-Item -LiteralPath $item.FullName -Recurse -Force
        Write-Host "Removed: $($item.FullName)"
    }
}

if (-not $ConfirmClean) {
    Write-Host "Dry run only. Re-run with -ConfirmClean to remove listed runtime backup entries."
} else {
    Write-Host "Runtime backup cleanup completed for allowlisted directories only."
}
