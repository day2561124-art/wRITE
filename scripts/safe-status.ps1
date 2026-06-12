[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$activeEngine = Join-Path $projectRoot "data\canon_db\active_engine.md"

Push-Location $projectRoot
try {
    Write-Host "== Full status (includes untracked files) =="
    & git status --short
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n== Tracked status =="
    & git status --short --untracked-files=no
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n== Diff stat =="
    & git diff --stat
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n== Active engine SHA256 =="
    Get-FileHash -LiteralPath $activeEngine -Algorithm SHA256

    Write-Host "`nSafety notes:"
    Write-Host "- Untracked visual assets may be intentional."
    Write-Host "- Stage files by explicit path."
    Write-Host "- Do not stage data/visual_db/assets/, data/backups/, or data/outputs/ by default."
} finally {
    Pop-Location
}
