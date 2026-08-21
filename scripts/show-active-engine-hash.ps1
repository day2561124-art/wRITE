$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$activeEnginePath = Join-Path $projectRoot "data\canon_db\active_engine.md"
$engineComponentsPath = Join-Path $projectRoot "config\engine-components.json"
$engineComponents = Get-Content -LiteralPath $engineComponentsPath -Raw | ConvertFrom-Json
$expectedHash = $engineComponents.components.canon_data.expected_sha256_lf
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

Write-Host "Active engine SHA256 matches the current engine component registry."
exit 0
