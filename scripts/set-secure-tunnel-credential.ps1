param()

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
# Run interactively as the Windows user who will run the Launcher/task.
# ConvertFrom-SecureString uses Windows DPAPI CurrentUser; no plaintext file.
$directory = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'ArmedAcademy\SecureTunnel'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetOwner($identity)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity, [Security.Principal.SecurityIdentifier]'S-1-5-18')) {
  $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $directory -AclObject $acl
$secret = Read-Host 'Writer Workbench Runtime API Key (hidden; never paste into chat)' -AsSecureString
try {
  if ($secret.Length -eq 0) { throw 'An empty Runtime API Key was not saved.' }
  $path = Join-Path $directory 'runtime-key.dpapi'
  $encrypted = ConvertFrom-SecureString -SecureString $secret
  [IO.File]::WriteAllText($path, $encrypted, [Text.Encoding]::ASCII)
  # Reset an existing file ACL too; directory inheritance alone is insufficient.
  $fileAcl = New-Object Security.AccessControl.FileSecurity
  $fileAcl.SetOwner($identity)
  $fileAcl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($identity, [Security.Principal.SecurityIdentifier]'S-1-5-18')) {
    $fileAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')))
  }
  Set-Acl -LiteralPath $path -AclObject $fileAcl
  Write-Host 'Runtime key saved with Windows DPAPI CurrentUser and a private ACL. No key was printed.'
} finally {
  $secret.Dispose()
  $encrypted = $null
}
