param(
  [string]$NodeScript,
  [string]$ReportDirectory,
  [string]$Label='MCP Windows interactive acceptance'
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $NodeScript){$NodeScript=Join-Path $root 'tests\mcp\mcp-windows-console.test.mjs'}
if(-not $ReportDirectory){$ReportDirectory=Join-Path $root ('outputs\mcp-windows-console-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))}
$null=New-Item -ItemType Directory -Path $ReportDirectory -Force
$report=Join-Path $ReportDirectory 'acceptance'
foreach($value in @($NodeScript,$root,$report)){if($value -match '["\r\n\x00]'){throw 'UNSAFE_ACCEPTANCE_PATH'}}
Add-Type -Path (Join-Path $PSScriptRoot 'secure-tunnel-window-observer.cs')
[SecureTunnelWindowObserver]::VerifyHook()
# Record every top-level Terminal HWND: one Terminal process may own many windows.
Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class McpTerminalBaseline {
 delegate bool Visit(IntPtr w, IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(Visit v,IntPtr p);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr w);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);
 public static string[] Read(){var rows=new List<string>();EnumWindows((w,p)=>{var c=new StringBuilder(256);var s=new StringBuilder(512);GetClassName(w,c,256);GetWindowText(w,s,512);if(c.ToString()=="CASCADIA_HOSTING_WINDOW_CLASS"||c.ToString()=="ConsoleWindowClass"){uint id;GetWindowThreadProcessId(w,out id);rows.Add(w+"|"+id+"|"+IsWindowVisible(w)+"|"+c+"|"+s);}return true;},IntPtr.Zero);return rows.ToArray();}
}
'@
$before=@([McpTerminalBaseline]::Read())
$observer=New-Object SecureTunnelWindowObserver
$start=New-Object Diagnostics.ProcessStartInfo
$start.FileName=(Get-Command node.exe -ErrorAction Stop).Source
$start.Arguments='"'+$NodeScript+'" --detached-parent "'+$report+'.node.json"'
$start.WorkingDirectory=$root
$start.UseShellExecute=$false; $start.CreateNoWindow=$true
$start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
$process=New-Object Diagnostics.Process
$process.StartInfo=$start
try {
  $null=$process.Start()
  $out=$process.StandardOutput.ReadToEndAsync(); $err=$process.StandardError.ReadToEndAsync()
  if(-not $process.WaitForExit(240000)){
    # Only the owned acceptance tree; no global Node/Terminal cleanup.
    $kill=New-Object Diagnostics.ProcessStartInfo
    $kill.FileName=Join-Path $env:SystemRoot 'System32\taskkill.exe'
    $kill.Arguments='/pid '+$process.Id+' /t /f'
    $kill.UseShellExecute=$false; $kill.CreateNoWindow=$true
    $cleanup=[Diagnostics.Process]::Start($kill); $null=$cleanup.WaitForExit(10000); $cleanup.Dispose()
    throw 'OWNED_ACCEPTANCE_PARENT_TIMEOUT'
  }
  Start-Sleep -Milliseconds 300
  $out.GetAwaiter().GetResult() | Set-Content -LiteralPath ($report+'.stdout.txt')
  $err.GetAwaiter().GetResult() | Set-Content -LiteralPath ($report+'.stderr.txt')
  $events=@($observer.Events)
  $evidence=@{label=$Label;observerSelfTest='PASS';parentCreateNoWindow=$true;listenerParentDetached=$true;exitCode=$process.ExitCode;events=$events;visibleConsoleEvents=$events.Count;baseline=$before;after=@([McpTerminalBaseline]::Read());observedAt=[DateTime]::UtcNow.ToString('o')}
  $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath ($report+'.windows.json') -Encoding UTF8
  if($process.ExitCode -ne 0){throw 'MCP_FUNCTIONAL_ACCEPTANCE_FAILED'}
  if($events.Count -ne 0){throw 'VISIBLE_CONSOLE_EVENTS_OBSERVED'}
  Write-Output ('PASS: functional acceptance; new visible terminal events 0; '+$report+'.windows.json')
} finally { $observer.Dispose(); $process.Dispose() }
