$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$activeEnginePath = Join-Path $projectRoot "data\canon_db\active_engine.md"
$expectedHash = "9FC2984B3126B12FD35D6CA57B1C05F7038F7FD7414726AB6C12A9C2F308DD55"
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