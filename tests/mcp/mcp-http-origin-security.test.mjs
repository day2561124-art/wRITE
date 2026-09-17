import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { terminateProcessTree } from '../../server/src/process-control.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

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

function requestHttp({ port, method, pathName, headers = {}, body = '' }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathName,
      method,
      headers: {
        ...headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.once('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        text,
      }));
    });
    request.once('error', reject);
    request.end(body);
  });
}

function initializeMessage(id) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: `origin-security-${id}`, version: '1.0.0' },
    },
  };
}

async function initialize({ port, id, origin }) {
  const body = JSON.stringify(initializeMessage(id));
  return requestHttp({
    port,
    method: 'POST',
    pathName: '/mcp',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(origin === undefined ? {} : { Origin: origin }),
    },
    body,
  });
}

async function liveStatus(port) {
  const response = await requestHttp({ port, method: 'GET', pathName: '/live' });
  assert.equal(response.statusCode, 200, response.text);
  return JSON.parse(response.text);
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
  assert.equal((await liveStatus(port)).session_count, 0);

  for (const origin of [
    'https://attacker.example',
    'http://localhost.attacker.example',
    'null',
    'not a url',
    'http://user:pass@localhost',
    'http://localhost/has-a-path',
  ]) {
    const rejected = await initialize({ port, id: `rejected-${origin}`, origin });
    assert.equal(rejected.statusCode, 403, `Origin ${origin} should be rejected. body=${rejected.text}`);
    assert.equal(rejected.headers['mcp-session-id'], undefined);
    assert.match(rejected.text, /Forbidden: invalid Origin/u);
    assert.equal((await liveStatus(port)).session_count, 0, `Rejected Origin ${origin} created a session.`);
    assert.doesNotMatch(stderr, /session initialized id=/u, `Rejected Origin ${origin} reached session initialization.`);
  }

  const rejectedGet = await requestHttp({
    port,
    method: 'GET',
    pathName: '/mcp',
    headers: { Origin: 'https://attacker.example', Accept: 'text/event-stream' },
  });
  assert.equal(rejectedGet.statusCode, 403, rejectedGet.text);

  const rejectedOptions = await requestHttp({
    port,
    method: 'OPTIONS',
    pathName: '/mcp',
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(rejectedOptions.statusCode, 403, rejectedOptions.text);
  assert.equal((await liveStatus(port)).session_count, 0);

  const noOrigin = await initialize({ port, id: 'no-origin' });
  assert.equal(noOrigin.statusCode, 200, noOrigin.text);
  assert.ok(noOrigin.headers['mcp-session-id'], 'Server-to-server initialize without Origin must remain supported.');

  const localhostOrigin = 'http://localhost:5173';
  const allowedOptions = await requestHttp({
    port,
    method: 'OPTIONS',
    pathName: '/mcp',
    headers: { Origin: localhostOrigin },
  });
  assert.equal(allowedOptions.statusCode, 204, allowedOptions.text);
  assert.equal(allowedOptions.headers['access-control-allow-origin'], localhostOrigin);

  const allowed = await initialize({ port, id: 'localhost-origin', origin: localhostOrigin });
  assert.equal(allowed.statusCode, 200, allowed.text);
  assert.ok(allowed.headers['mcp-session-id'], 'Loopback browser Origin should be accepted.');

  const ipv4Origin = await initialize({ port, id: 'ipv4-origin', origin: 'https://127.0.0.1:9443' });
  assert.equal(ipv4Origin.statusCode, 200, ipv4Origin.text);
  assert.ok(ipv4Origin.headers['mcp-session-id']);

  const live = await liveStatus(port);
  assert.equal(live.session_count, 3);
} finally {
  terminateProcessTree(child);
  await waitForPortAvailable(port);
}

console.log('MCP HTTP Origin validation security tests passed.');
