[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$activeEngine = Join-Path $projectRoot "data\canon_db\active_engine.md"
$forbiddenPrefixes = @(
    "data/backups/",
    "data/feedback_loop/",
    "data/visual_db/assets/",
    "data/outputs/"
)
$forbiddenExactPaths = @(
    "data/canon_db/active_engine.md"
)

Push-Location $projectRoot
try {
    & npm.cmd test
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -ne 0) {
        Write-Error "Pre-commit check stopped because npm.cmd test failed with exit code $testExitCode."
        exit $testExitCode
    }

    Write-Host "`n== Staged stat =="
    & git diff --cached --stat
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $stagedPaths = @(& git diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $normalizedPaths = @($stagedPaths | ForEach-Object { $_.Replace("\", "/") })
    $blocked = @($normalizedPaths | Where-Object {
        $candidate = $_
        ($forbiddenExactPaths -contains $candidate) -or
        ($forbiddenPrefixes | Where-Object { $candidate.StartsWith($_) }).Count -gt 0
    })

    if ($blocked.Count -gt 0) {
        Write-Error ("Forbidden staged paths detected:`n- " + ($blocked -join "`n- "))
        exit 1
    }

    Write-Host "`n== Working tree status =="
    & git status --short
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n== Active engine SHA256 =="
    Get-FileHash -LiteralPath $activeEngine -Algorithm SHA256
    Write-Host "Pre-commit check passed. Review the staged diff before committing."
} finally {
    Pop-Location
}
