import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temp = path.join(root, 'tests/.tmp', `headless 中文 & '${process.pid}`);
  await mkdir(temp, { recursive: true });
  const q = value => `'${value.replaceAll("'", "''")}'`;
  const ps = script => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); ' + script], {
      windowsHide: true, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    return result.stdout.trim();
  };
  // Stop the fixture's own child and wait on the same process handle.
  // Windows releases a child's working directory and file handles on exit,
  // not necessarily when the termination request returns.
  const stopFixture = pid => {
    assert(Number.isSafeInteger(pid) && pid > 0, 'Invalid fixture child PID');
    ps(`$ErrorActionPreference='Stop';
      Microsoft.PowerShell.Core\\Import-Module ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Management','Microsoft.PowerShell.Management.psd1')) -ErrorAction Stop;
      $p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;
      if ($null -ne $p) { try {
        $null=$p.Handle;
        if (-not $p.HasExited) { $p.Kill() }
        if (-not $p.WaitForExit(5000)) { throw 'Fixture child did not terminate' }
      } finally { $p.Dispose() } }`);
  };
  let primaryError;
  try {
    // Use the actual builder, not a separate test-only compilation path.
    const manager = path.join(root, 'scripts/manage-secure-tunnel.ps1');
    const host = ps(`$ErrorActionPreference='Stop'; $Root=${q(root)}; $DataDirectory=${q(temp)};
      $ast=[Management.Automation.Language.Parser]::ParseFile(${q(manager)},[ref]$null,[ref]$null);
      $fn=$ast.Find({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq 'Ensure-RecoveryHost'},$false);
      Invoke-Expression $fn.Extent.Text; Ensure-RecoveryHost`);
    const binary = await readFile(host);
    const pe = binary.readUInt32LE(0x3c);
    assert.equal(binary.readUInt16LE(pe + 24 + 68), 2, 'PE must be Windows GUI subsystem, never console');
    const fixture = path.join(temp, 'manager.ps1');
    await writeFile(fixture, '\ufeff' + `param($Action,[switch]$Json,$DataDirectory)
      Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class ConsoleProbe { [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); }'
      @{console=[ConsoleProbe]::GetConsoleWindow().ToInt64(); action=$Action; data=$DataDirectory} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DataDirectory 'observation.json') -Encoding UTF8
      1..10000 | ForEach-Object { [Console]::Out.WriteLine('discard stdout'); [Console]::Error.WriteLine('discard stderr') }
      exit 7`);
    // Deliberately do not pass windowsHide: the executable itself must have no console.
    const result = spawnSync(host, [fixture, temp], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 7, 'Host waits and propagates manager failure');
    const observed = JSON.parse((await readFile(path.join(temp, 'observation.json'), 'utf8')).replace(/^\ufeff/u, ''));
    assert.equal(observed.console, 0, 'PowerShell has no console, including a hidden one');
    assert.equal(observed.action, 'Reconcile');
    assert.equal(observed.data, temp, 'Unicode, spaces, apostrophe and ampersand survive argv');
    await writeFile(fixture, '\ufeff' + `param($Action,[switch]$Json,$DataDirectory)
      $ErrorActionPreference='Stop'
      [IO.File]::WriteAllText(([IO.Path]::Combine($DataDirectory,'phase-enter.txt')),[DateTime]::UtcNow.ToString('o'))
      Microsoft.PowerShell.Core\\Import-Module ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Utility','Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop
      Microsoft.PowerShell.Core\\Import-Module ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Management','Microsoft.PowerShell.Management.psd1')) -ErrorAction Stop
      [IO.File]::WriteAllText(([IO.Path]::Combine($DataDirectory,'phase-modules.txt')),[DateTime]::UtcNow.ToString('o'))
      $s=[Diagnostics.ProcessStartInfo]::new()
      $s.FileName="$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
      $s.Arguments='-NoProfile -NonInteractive -Command Start-Sleep -Seconds 20'
      $s.UseShellExecute=$false; $s.CreateNoWindow=$true; $s.RedirectStandardError=$true
      [IO.File]::WriteAllText(([IO.Path]::Combine($DataDirectory,'phase-start.txt')),[DateTime]::UtcNow.ToString('o'))
      $child=[Diagnostics.Process]::Start($s)
      [IO.File]::WriteAllText((Join-Path $DataDirectory 'descendant.pid'),[string]$child.Id)
      $child.Dispose()
      [IO.File]::WriteAllText(([IO.Path]::Combine($DataDirectory,'phase-exit.txt')),[DateTime]::UtcNow.ToString('o'))
      exit 8`);
    try {
      const started=Date.now();
      const inherited = spawnSync(host, [fixture, temp], { timeout: 8000 });
      if (inherited.status !== 8) {
        const phases={};
        for (const name of ['phase-enter','phase-modules','phase-start','phase-exit']) {
          phases[name]=await readFile(path.join(temp,name+'.txt'),'utf8').catch(error=>{
            if(error.code==='ENOENT') return null;
            throw error;
          });
        }
        console.error('HEADLESS_PHASES '+JSON.stringify({elapsed_ms:Date.now()-started,status:inherited.status,error:inherited.error?.code,phases}));
      }
      assert.equal(inherited.status, 8, inherited.error?.message || 'Detached descendants retaining a pipe must not keep the task running');
    } finally {
      // Missing PID must not obscure an earlier launch failure.
      const pidText = await readFile(path.join(temp, 'descendant.pid'), 'utf8').catch(error => {
        if (error.code === 'ENOENT') return '';
        throw error;
      });
      if (pidText) stopFixture(Number(pidText));
    }
    assert.equal(spawnSync(host, [], { timeout: 10000 }).status, 2, 'Invalid args fail silently');
    const listener = path.join(temp, 'listener.mjs');
    await writeFile(listener, 'setInterval(() => {}, 1000);\n');
    const launched = spawnSync(process.execPath, [path.join(root, 'scripts/start-headless-mcp.mjs'),
      listener, 'unused-config', '1', path.join(temp, 'out.log'), path.join(temp, 'err.log')], {
      windowsHide: true, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(launched.status, 0, 'Actual Listener helper must exit independently');
    const listenerPid = Number(launched.stdout);
    assert(Number.isSafeInteger(listenerPid) && listenerPid > 0);
    try {
      process.kill(listenerPid, 0);
      // Attaching to an existing hidden console would succeed. Error 6 proves
      // this detached Listener has no console at all, rather than hiding one.
      ps(`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class ListenerConsoleProbe {
        [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
        [DllImport("kernel32.dll",SetLastError=true)] public static extern bool AttachConsole(uint pid);
        [DllImport("kernel32.dll")] public static extern bool FreeConsole();
        public static int Check(uint pid) {
          if(GetConsoleWindow() != IntPtr.Zero) return 2;
          FreeConsole(); // CREATE_NO_WINDOW may still have console bookkeeping.
          bool attached=AttachConsole(pid); int error=Marshal.GetLastWin32Error();
          if(attached) { FreeConsole(); return 3; }
          return error == 6 ? 0 : 100 + error;
        } }';
        exit [ListenerConsoleProbe]::Check(${listenerPid})`);
    } finally { stopFixture(listenerPid); }
    console.log('Headless host passed: GUI PE, actual console absence, exact argv, pipe draining, exit propagation.');
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch (cleanupError) {
      if (primaryError) throw new AggregateError([primaryError, cleanupError], 'Headless assertion and fixture cleanup both failed');
      throw cleanupError;
    }
  }
}
