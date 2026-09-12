import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'win32') { console.log('Launcher wrapper skipped (Windows only).'); }
else {
  const root = process.cwd();
  await mkdir('tests/.tmp', { recursive: true });
  const dir = await mkdtemp(path.join(root, 'tests/.tmp/wrapper-'));
  const text = await readFile('launcher.ps1', 'utf8');
  const start = text.indexOf('function Invoke-McpTunnelLauncher {');
  const wrapper = text.slice(start, text.indexOf('function Start-McpTunnel {', start));
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  try {
    for (const code of [0, 7]) {
      const fixture = path.join(dir, `fixture ${code}.ps1`);
      await writeFile(fixture, `Write-Host 'wrapper fixture completed'\nexit ${code}\n`);
      const run = path.join(dir, 'run.ps1');
      await writeFile(run, `\uFEFF$ErrorActionPreference="Stop"\n$Root=${quote(root)}\n$LogDir=${quote(dir)}\n${wrapper}\nif (Invoke-McpTunnelLauncher ${quote(fixture)}) { exit 0 } else { exit 1 }\n`, 'utf8');
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', run], {
        encoding: 'utf8', windowsHide: true, timeout: 10000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, code === 0 ? 0 : 1, result.stdout + result.stderr);
      assert.match(result.stdout, /wrapper fixture completed/);
    }
    console.log('Launcher wrapper return-code regression passed.');
  } finally { await rm(dir, { recursive: true, force: true }); }
}
