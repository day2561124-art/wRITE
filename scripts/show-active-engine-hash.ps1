[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$expectedHash = "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$activeEngine = Join-Path $projectRoot "data\canon_db\active_engine.md"
$result = Get-FileHash -LiteralPath $activeEngine -Algorithm SHA256

$result
if ($result.Hash -ne $expectedHash) {
    Write-Error "Active engine SHA256 mismatch. Expected $expectedHash but found $($result.Hash)."
    exit 1
}

Write-Host "Active engine SHA256 matches the Phase 12A baseline."
