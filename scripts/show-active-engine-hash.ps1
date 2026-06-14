$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$activeEnginePath = Join-Path $projectRoot "data\canon_db\active_engine.md"
$expectedHash = "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB"

$text = [System.IO.File]::ReadAllText($activeEnginePath)
$normalized = $text -replace "`r`n", "`n" -replace "`r", "`n"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $hash = [BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace("-", "")
} finally {
  $sha256.Dispose()
}

[PSCustomObject]@{
  Algorithm = "SHA256"
  Hash = $hash
  Normalization = "LF"
  Path = $activeEnginePath
} | Format-Table -AutoSize

if ($hash -ne $expectedHash) {
  Write-Error "Active engine SHA256 mismatch. Expected $expectedHash but found $hash."
  exit 1
}

Write-Host "Active engine SHA256 matches the Phase 12A baseline."
exit 0