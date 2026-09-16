import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { terminateProcessTree } from '../server/src/process-control.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitUntil(predicate, message, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

async function waitForPortListening(port) {
  await waitUntil(() => new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  }), `MCP HTTP server did not listen on port ${port}.`);
}

async function waitForPortAvailable(port) {
  await waitUntil(() => new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(true));
  }), `MCP HTTP server did not release port ${port}.`);
}

if (process.platform === 'win32') {
  // Node documents that child.kill('SIGTERM') on Windows forcefully terminates
  // the target instead of delivering the listenable SIGTERM event. Keep the
  // live signal-path assertion for POSIX, and on Windows verify the shutdown
  // ordering directly so the regression remains meaningful without pretending
  // that child.kill exercises graceful shutdown there.
  const source = await readFile(path.join(rootDir, 'server', 'src', 'mcp-http-server.mjs'), 'utf8');
  const closeIndex = source.indexOf('server.close(() =>');
  const idleCloseIndex = source.indexOf('server.closeIdleConnections?.();');
  assert(closeIndex >= 0, 'expected graceful server.close() shutdown path');
  assert(idleCloseIndex > closeIndex, 'idle connections must be reaped after server.close() starts');
  console.log('MCP HTTP origin lifecycle shutdown regression test passed (Windows structural assertion).');
  process.exit(0);
}

const port = await freePort();
let stderr = '';
const child = spawn(process.execPath, ['server/src/mcp-http-server.mjs', '--port', String(port)], {
  cwd: rootDir,
  env: { ...process.env, MCP_TOOL_PROFILE: 'chatgpt_developer' },
  stdio: ['ignore', 'ignore', 'pipe'],
  windowsHide: true,
});
child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

try {
  await waitForPortListening(port);
  const idleSocket = net.connect({ host: '127.0.0.1', port });
  await new Promise((resolve, reject) => {
    idleSocket.once('connect', resolve);
    idleSocket.once('error', reject);
  });

  child.kill('SIGTERM');
  await waitForPortAvailable(port);
  await waitUntil(() => child.exitCode !== null, `HTTP parent did not exit after SIGTERM. stderr=${stderr}`);
  assert.equal(child.exitCode, 0, stderr);
  assert.match(stderr, /received SIGTERM; closing sessions/u);
  idleSocket.destroy();
} finally {
  if (child.exitCode === null) terminateProcessTree(child);
  await waitForPortAvailable(port);
}

console.log('MCP HTTP origin lifecycle shutdown regression test passed.');
