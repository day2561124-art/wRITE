$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$activeEnginePath = Join-Path $projectRoot "data\canon_db\active_engine.md"
$expectedHash = "514B71736D4B4C3C098520D8CF8683F6B28FC55D028774150A77CABD37EC3A0B"
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