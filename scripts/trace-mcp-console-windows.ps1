param([string]$Output)
if(-not $Output){
  $outputRoot=Join-Path (Split-Path -Parent $PSScriptRoot) 'outputs'
  $null=New-Item -ItemType Directory -Path $outputRoot -Force
  $Output=Join-Path $outputRoot ('mcp-console-window-attribution-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.json')
}
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public class McpAttributedWindow {public long hwnd,owner,rootOwner;public uint pid,thread;public bool visible;public string windowClass,title;}
public static class McpAttributedWindows {
 delegate bool Visit(IntPtr w, IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(Visit v,IntPtr p);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr w);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr w,uint kind);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr w,uint kind);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);
 public static McpAttributedWindow[] Read(){var rows=new List<McpAttributedWindow>();EnumWindows((w,p)=>{var c=new StringBuilder(256);var s=new StringBuilder(512);GetClassName(w,c,256);GetWindowText(w,s,512);if(c.ToString()=="CASCADIA_HOSTING_WINDOW_CLASS"||c.ToString()=="ConsoleWindowClass"||c.ToString()=="PseudoConsoleWindow"){uint id;var tid=GetWindowThreadProcessId(w,out id);rows.Add(new McpAttributedWindow{hwnd=w.ToInt64(),owner=GetWindow(w,4).ToInt64(),rootOwner=GetAncestor(w,3).ToInt64(),pid=id,thread=tid,visible=IsWindowVisible(w),windowClass=c.ToString(),title=s.ToString()});}return true;},IntPtr.Zero);return rows.ToArray();}
}
'@
$windows=@([McpAttributedWindows]::Read())
$processes=@(Get-CimInstance Win32_Process)
$byId=@{}; foreach($entry in $processes){$byId[[int]$entry.ProcessId]=$entry}
$terminalRows=@()
foreach($window in $windows | Where-Object { $_.visible -and $_.windowClass -in @('CASCADIA_HOSTING_WINDOW_CLASS','ConsoleWindowClass') }){
  $associated=@($windows | Where-Object {$_.windowClass -eq 'PseudoConsoleWindow' -and ($_.owner -eq $window.hwnd -or $_.rootOwner -eq $window.hwnd)})
  $ids=@($associated | ForEach-Object {[int]$_.pid})
  if($window.windowClass -eq 'ConsoleWindowClass'){
    $hostProcess=$byId[[int]$window.pid]
    if($hostProcess){$ids+=@([int]$hostProcess.ParentProcessId)}
  }
  $sources=@()
  foreach($id in $ids | Select-Object -Unique){
    $entry=$byId[$id];if(-not $entry){continue};$parent=$byId[[int]$entry.ParentProcessId]
    $sources+=@([pscustomobject]@{pid=$entry.ProcessId;parentPid=$entry.ParentProcessId;created=$entry.CreationDate;name=$entry.Name;commandLine=$entry.CommandLine;parentName=$parent.Name;parentCommandLine=$parent.CommandLine})
  }
  $terminalRows+=@([pscustomobject]@{hwnd=$window.hwnd;terminalPid=$window.pid;title=$window.title;windowClass=$window.windowClass;pseudoConsoles=$associated;sources=$sources;attribution=$(if($sources.Count){'WIN32_OWNER_CHAIN'}else{'UNRESOLVED'})})
}
$evidence=[pscustomobject]@{observedAt=[DateTime]::UtcNow.ToString('o');allConsoleWindows=$windows;visibleTerminals=$terminalRows;visibleNodeTerminalCount=@($terminalRows | Where-Object {$_.title -like '*node.exe*'}).Count;nodeProcesses=@($processes | Where-Object Name -eq 'node.exe' | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine)}
$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding UTF8
$terminalRows | ForEach-Object {[pscustomobject]@{hwnd=$_.hwnd;terminalPid=$_.terminalPid;title=$_.title;sourcePids=@($_.sources.pid);sourceParents=@($_.sources.parentPid);attribution=$_.attribution}} | ConvertTo-Json -Depth 4
