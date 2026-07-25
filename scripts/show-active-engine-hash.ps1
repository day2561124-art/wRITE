$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$activeEnginePath = Join-Path $projectRoot "data\canon_db\active_engine.md"
$expectedHash = "238B287A32342C55C6D95E32953D1D681DD8A0F4F8F31FE9DF24985B2EB7A2A8"
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