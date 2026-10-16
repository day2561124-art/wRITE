// Short-lived helper. The Listener owns file handles, rather than pipes to a
// scheduler parent, and survives that parent's exit. No shell/console is used.
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';

const [script, config, port, stdout, stderr] = process.argv.slice(2);
const handles = [];
try {
  if (!script || !config || !/^\d+$/u.test(port) || !stdout || !stderr) throw new Error();
  handles.push(openSync(stdout, 'a'), openSync(stderr, 'a'));
  const child = spawn(process.execPath, [script, '--config', config, '--port', port], {
    cwd: process.cwd(), detached: true, windowsHide: true,
    stdio: ['ignore', ...handles],
  });
  child.once('error', () => { process.exitCode = 1; });
  child.once('spawn', () => { process.stdout.write(String(child.pid)); child.unref(); });
} catch { process.exitCode = 1; }
finally { for (const handle of handles) closeSync(handle); }
