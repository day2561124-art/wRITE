import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const managerPath = path.join(root, 'scripts/manage-secure-tunnel.ps1');
const manager = await readFile(managerPath, 'utf8');
const launcher = await readFile(path.join(root, 'launcher.ps1'), 'utf8');
const credential = await readFile(path.join(root, 'scripts/set-secure-tunnel-credential.ps1'), 'utf8');
for (const [choice, label] of [[9,'Start / Restart'],[10,'Show'],[11,'Stop']]) {
  assert(launcher.includes(`${choice}. ${label} Writer Workbench Secure Tunnel`));
  assert(launcher.includes(`"${choice}" { Invoke-SecureTunnelLauncher`));
}
for (const name of ['StartUi','StopUi','OpenUi','OpenVisuals','RunTests','CreateShortcut','StartMcpTunnel','McpTunnelStatus']) {
  assert(launcher.includes(`[switch]$${name}`), `Legacy switch ${name}`);
}
assert(!manager.includes('Stop-Process'), 'Runtime termination must belong to native stop');
assert(!/runtimes['",\s]+create/u.test(manager), 'Never create a remote Tunnel');
assert(!manager.includes('taskkill') && !manager.includes('cloudflared.exe') && !manager.includes('tailscale.exe'));
assert(manager.includes('--tunnel-id') && manager.includes('env:$KeyVariable'));
assert(credential.includes('Read-Host') && credential.includes('-AsSecureString'));
assert(credential.includes('ConvertFrom-SecureString') && !credential.includes('-Key '));
assert(credential.includes('SetAccessRuleProtection($true, $false)'));
assert(manager.includes('ZeroFreeBSTR') && manager.includes("'Process'"));
assert(!/sk-[A-Za-z0-9_-]{12,}/u.test(manager + launcher + credential));

if (process.platform !== 'win32') {
  console.log('Secure Tunnel source contracts passed; Windows runtime checks skipped.');
} else {
  const temp = path.join(root, 'tests/.tmp', `secure-tunnel-${process.pid}`);
  await mkdir(temp, { recursive: true });
  const q = value => `'${value.replaceAll("'", "''")}'`;
  const harness = `
$ErrorActionPreference='Stop'
$ast=[Management.Automation.Language.Parser]::ParseFile(${q(managerPath)},[ref]$null,[ref]$null)
foreach($fn in $ast.FindAll({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)) {
  Invoke-Expression $fn.Extent.Text
}
function Assert($value,$message) { if(-not $value){throw $message} }
function New-OperationMutex {return (New-Object Threading.Mutex($false, 'Local\\SecureTunnelFixture-${process.pid}'))}
$Root=${q(root.replace(/[\\/]$/u, ''))}
$ManagerPath=${q(managerPath)}
$DataDirectory=${q(temp)}
$Alias='writer-workbench'
$TaskName='fixture-task'
$ConfigPath=Join-Path $DataDirectory 'launcher.json'
$DesiredPath=Join-Path $DataDirectory 'enabled'
$CredentialPath=Join-Path $DataDirectory 'fixture.dpapi'
$RecoveryHoldPath=Join-Path $DataDirectory 'recovery-validation-pending'
$KeyVariable='SECURE_TUNNEL_FIXTURE_KEY'
$script:Config=[pscustomobject]@{root=$Root;alias=$Alias;client='fixture.exe';tunnelId='tunnel_00000000000000000000000000000000';mcpUrl='http://127.0.0.1:1/mcp';profileDirectory=$DataDirectory}

# Real DPAPI roundtrip under the same Node -> Windows PowerShell environment.
Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$fixture=ConvertTo-SecureString 'fixture-only-never-a-runtime-key' -AsPlainText -Force
ConvertFrom-SecureString $fixture | Set-Content $CredentialPath
$fixture.Dispose()
[Environment]::SetEnvironmentVariable($KeyVariable,'prior-fixture','Process')
Use-Credential {Assert ([Environment]::GetEnvironmentVariable($KeyVariable,'Process') -eq 'fixture-only-never-a-runtime-key') 'DPAPI decrypt for native child'}
Assert ([Environment]::GetEnvironmentVariable($KeyVariable,'Process') -eq 'prior-fixture') 'Restore caller environment'
try {Use-Credential {throw 'fixture failure'}} catch {}
Assert ([Environment]::GetEnvironmentVariable($KeyVariable,'Process') -eq 'prior-fixture') 'Restore environment on exception'
[Environment]::SetEnvironmentVariable($KeyVariable,$null,'Process')

# Recovery registration uses the current interactive user and limited privilege.
$script:registered=$null
function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory) return @{arguments=$Argument}}
function Ensure-RecoveryHost {return 'fixture-headless.exe'}
function New-ScheduledTaskTrigger {param([switch]$AtLogOn,$User,[switch]$Once,$At,$RepetitionInterval) return @{login=[bool]$AtLogOn;interval=$RepetitionInterval}}
function New-ScheduledTaskPrincipal {param($UserId,$LogonType,$RunLevel) return @{logon=$LogonType;level=$RunLevel}}
function New-ScheduledTaskSettingsSet {param([switch]$Hidden,$MultipleInstances,[switch]$StartWhenAvailable,[switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries,$ExecutionTimeLimit,$RestartCount,$RestartInterval) return @{hidden=[bool]$Hidden;instances=$MultipleInstances;restart=$RestartCount}}
function Register-ScheduledTask {param($TaskName,$Action,$Trigger,$Principal,$Settings,$Description,[switch]$Force) $script:registered=@{action=$Action;triggers=$Trigger;principal=$Principal;settings=$Settings}}
Register-RecoveryTask
Assert ($script:registered.principal.level -eq 'Limited' -and $script:registered.principal.logon -eq 'Interactive') 'No elevation or password storage'
Assert ($script:registered.settings.hidden -and $script:registered.settings.instances -eq 'IgnoreNew') 'Hidden single task instance'
Assert ($script:registered.triggers[0].login -and $script:registered.triggers[1].interval.TotalMinutes -eq 1) 'Login plus periodic recovery'
Assert ($script:registered.action.arguments.Contains($ManagerPath) -and -not $script:registered.action.arguments.Contains('fixture-only')) 'Task arguments contain paths only'
Register-RecoveryTask -KeepDisabled
Assert ($script:registered.settings.Enabled -eq $false) 'Repair registers disabled without enabling briefly'
Set-Content $RecoveryHoldPath 'pending acceptance'
Register-RecoveryTask
Assert ($script:registered.settings.Enabled -eq $false) 'Launcher cannot bypass the patch acceptance hold'
Remove-Item $RecoveryHoldPath

# Native connect gets the existing ID and an environment REFERENCE only.
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) return @()}
function Invoke-Native {param([string[]]$Arguments)
 Assert ($Arguments.Contains('--tunnel-id') -and $Arguments.Contains($script:Config.tunnelId)) 'Attach existing Tunnel'
 Assert ($Arguments.Contains('env:SECURE_TUNNEL_FIXTURE_KEY') -and -not $Arguments.Contains('fixture-only-never-a-runtime-key')) 'Key never enters argv'
 return [pscustomobject]@{code=0;value=@{started=$true}}
}
Connect-Runtime

# Test real native-status interpretation before replacing it for lifecycle tests.
function Invoke-Native { param([string[]]$Arguments)
 if($Arguments[1] -eq 'list'){return [pscustomobject]@{code=0;value=[pscustomobject]@{aliases=@()}}}
 return [pscustomobject]@{code=1;value=$null}
}
Assert ($null -eq (Get-Runtime)) 'Unknown alias must be stopped, not healthy'
function Invoke-Native {param([string[]]$Arguments) return [pscustomobject]@{code=0;value=[pscustomobject]@{tunnel=[pscustomobject]@{id='wrong'}}}}
$rejected=$false
try {Get-Runtime | Out-Null} catch {$rejected=$_.Exception.Message -eq 'EXISTING_RUNTIME_IDENTITY_MISMATCH'}
Assert $rejected 'Mismatched alias must fail closed'

# Test native health and detailed polling, with no real network or scheduler writes.
function Get-ScheduledTask {param($TaskName,$ErrorAction) return $null}
function Get-HttpCheck {param($Url,$ExpectedProperty) return 'PASS'}
function Invoke-RestMethod {param($Uri,$TimeoutSec) return [pscustomobject]@{live=$true;components=[pscustomobject]@{'control-plane'=[pscustomobject]@{status='ok';details=[pscustomobject]@{last_success=[DateTime]::UtcNow.ToString('o');consecutive_failures=0}}}}}
$runtime=[pscustomobject]@{process_running=$true;healthy=$false;ready=$false;local=[pscustomobject]@{effective_health=[pscustomobject]@{healthz=[pscustomobject]@{ok=$false};readyz=[pscustomobject]@{ok=$false}}}}
$d=Get-Diagnostics $runtime
Assert (-not $d.ready -and $d.runtimeHealthz -eq 'FAIL') 'PID presence must never imply health'
$runtime.healthy=$true; $runtime.ready=$true
$runtime.local.effective_health.healthz.ok=$true
$runtime.local.effective_health.readyz.ok=$true
$runtime.local.effective_health | Add-Member health_details_url 'http://127.0.0.1:1/health?details=true'
$d=Get-Diagnostics $runtime
Assert ($d.ready -and $d.controlPlanePolling -eq 'healthy') 'Detailed actual polling must supply health'
Assert ($d.chatgptMcpCall -like 'UNVERIFIED*' -and $d.remoteReachability -like 'UNVERIFIED*') 'Local readiness cannot certify remote session'
function Invoke-RestMethod {param($Uri,$TimeoutSec) throw 'offline'}
Assert (-not (Get-Diagnostics $runtime).ready) 'Unavailable polling evidence must not PASS'

# Exercise actual orchestration, mock only OS/native boundaries.
$script:running=$false; $script:connects=0; $script:stops=0; $script:registrations=0; $script:disabled=0; $script:localEnsures=0
function Read-Configuration {return $script:Config}
function Ensure-LocalMcp { $script:localEnsures++ }
function Get-Runtime {if($script:running){return [pscustomobject]@{process_running=$true}}; return $null}
function Get-Diagnostics {param($Runtime) return [pscustomobject]@{ready=[bool]$Runtime}}
function Register-RecoveryTask {$script:registrations++}
function Connect-Runtime {$script:connects++; $script:running=$true}
function Disable-ScheduledTask {param($TaskName) $script:disabled++}
function Get-ScheduledTask {param($TaskName,$ErrorAction) return [pscustomobject]@{State='Ready'}}
function Invoke-Native {param([string[]]$Arguments)
 Assert ($Arguments[0] -eq 'runtimes' -and $Arguments[1] -eq 'stop' -and $Arguments[2] -eq 'writer-workbench') 'Only exact native alias may stop'
 if($Action -eq 'Stop'){Assert (-not(Test-Path $DesiredPath)) 'Disable recovery before stopping'}
 $script:stops++; $script:running=$false
 return [pscustomobject]@{code=0;value=@{}}
}
Set-Content $CredentialPath 'DPAPI test placeholder (never a credential)'
$Action='Start'; $null=Invoke-ManagedAction
Assert ($script:connects -eq 1 -and (Test-Path $DesiredPath)) 'Start and persist recovery intent'
$null=Invoke-ManagedAction
Assert ($script:connects -eq 1 -and $script:stops -eq 0) 'Repeated Start safely adopts existing runtime'
$Action='Restart'; $null=Invoke-ManagedAction
Assert ($script:connects -eq 2 -and $script:stops -eq 1) 'Explicit Restart uses native stop/connect'
$ensuresBeforeStop=$script:localEnsures
$Action='Stop'; $null=Invoke-ManagedAction
Assert (-not $script:running -and $script:disabled -eq 1) 'Stop disables only owned recovery'
Assert ($script:localEnsures -eq $ensuresBeforeStop) 'Stop leaves the shared MCP Listener untouched'
$Action='Reconcile'; $result=Invoke-ManagedAction
Assert ($result.skipped -and $script:connects -eq 2) 'Intentional stop cannot resurrect'
Set-Content $DesiredPath 'running'
$null=Invoke-ManagedAction
Assert ($script:connects -eq 3 -and $script:registrations -eq 3) 'Crash recovery reconnects without registering tasks again'
$null=Invoke-ManagedAction
Assert ($script:connects -eq 3) 'Periodic recovery is idempotent'
Remove-Item $CredentialPath
$Action='Start'; $rejected=$false
try {$null=Invoke-ManagedAction} catch {$rejected=$_.Exception.Message -eq 'RUNTIME_CREDENTIAL_REQUIRED'}
Assert $rejected 'Missing credentials fail closed'
Write-Output 'Secure Tunnel behavioral tests passed (status, identity, start, duplicate, restart, stop, recovery, credentials).'
`;
  const harnessPath = path.join(temp, 'behavior.ps1');
  await writeFile(harnessPath, '\ufeff' + harness);
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',harnessPath], {
      cwd: root, encoding: 'utf8', windowsHide: true, timeout: 45_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    console.log(result.stdout.trim());
  } finally { await rm(temp, { recursive: true, force: true }); }
}
await import('./secure-tunnel-headless.test.mjs');
