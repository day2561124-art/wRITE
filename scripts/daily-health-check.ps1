[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$activeEngine = Join-Path $projectRoot "data\canon_db\active_engine.md"

Push-Location $projectRoot
try {
    & git --no-pager log --oneline --decorate -5
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & git tag --list "phase-*"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & git status --short --untracked-files=no
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & npm.cmd test
    $testExitCode = $LASTEXITCODE
    if ($testExitCode -ne 0) {
        Write-Error "Health check stopped because npm.cmd test failed with exit code $testExitCode."
        exit $testExitCode
    }

    Get-FileHash -LiteralPath $activeEngine -Algorithm SHA256
    Write-Host "Daily health check passed. No commit or tag was created."
} finally {
    Pop-Location
}
