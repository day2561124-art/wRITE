import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createMcpRuntimeDiagnostics } from '../../server/src/mcp-runtime-diagnostics.mjs';
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

async function waitUntil(predicate, message, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

async function waitForPortListening(port) {
  await waitUntil(
    () => new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    }),
    `MCP HTTP server did not listen on port ${port}.`,
  );
}

async function waitForPortAvailable(port) {
  await waitUntil(
    () => new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => resolve(true));
    }),
    `MCP HTTP server did not release port ${port}.`,
  );
}

function requestHttp({ port, method = 'GET', pathName = '/live', headers = {}, chunks = [] }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathName,
      method,
      headers,
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
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

async function withServer(environment, callback) {
  const port = await freePort();
  let stderrText = '';
  const serverProcess = spawn(
    process.execPath,
    ['server/src/mcp-http-server.mjs', '--port', String(port)],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: 'chatgpt_developer',
        ...environment,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    },
  );
  serverProcess.stderr.on('data', (chunk) => { stderrText += chunk.toString('utf8'); });
  try {
    await waitForPortListening(port);
    await callback({ port, stderr: () => stderrText });
  } finally {
    terminateProcessTree(serverProcess);
    await waitForPortAvailable(port);
  }
}

async function verifyDiagnosticsRedactionAndRetention() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'writer-mcp-diagnostics-'));
  try {
    const diagnostics = createMcpRuntimeDiagnostics({ directory, maxFiles: 3 });
    for (let index = 0; index < 4; index += 1) {
      diagnostics.captureIncident('retention-test', {
        index,
        api_token: `secret-token-${index}`,
        nested: { password: `secret-password-${index}`, safe: 'visible' },
      });
    }
    const files = (await readdir(directory)).filter((name) => /^mcp-(incident|report)-/u.test(name));
    assert.ok(files.length <= 3, `Diagnostics retention exceeded maxFiles: ${files.join(', ')}`);
    const contents = await Promise.all(files.map((name) => readFile(path.join(directory, name), 'utf8')));
    const combined = contents.join('\n');
    assert.equal(combined.includes('secret-token-'), false, 'Diagnostic files leaked an API token.');
    assert.equal(combined.includes('secret-password-'), false, 'Diagnostic files leaked a password.');
    assert.ok(combined.includes('[redacted]'), 'Diagnostic redaction marker was not persisted.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function verifyHttpBodyHardLimit() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'writer-mcp-http-bounds-'));
  const secret = 'request-body-secret-token-value';
  try {
    await withServer({
      MCP_HTTP_MAX_POST_BODY_BYTES: '1024',
      MCP_DIAGNOSTICS_DIRECTORY: directory,
      MCP_DIAGNOSTICS_MAX_FILES: '6',
    }, async ({ port }) => {
      const declaredBody = Buffer.from(JSON.stringify({ payload: `${secret}${'x'.repeat(1800)}` }), 'utf8');
      const declared = await requestHttp({
        port,
        method: 'POST',
        pathName: '/mcp',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': String(declaredBody.length),
        },
        chunks: [declaredBody],
      });
      assert.equal(declared.statusCode, 413, declared.text);
      assert.match(declared.text, /Payload Too Large/u);

      const streamed = await requestHttp({
        port,
        method: 'POST',
        pathName: '/mcp',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Transfer-Encoding': 'chunked',
        },
        chunks: [Buffer.alloc(700, 0x61), Buffer.alloc(700, 0x62)],
      });
      assert.equal(streamed.statusCode, 413, streamed.text);

      const live = await requestHttp({ port });
      assert.equal(live.statusCode, 200, live.text);
      const livePayload = JSON.parse(live.text);
      assert.equal(livePayload.live, true);

      const initializeBody = Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        id: 'resource-bounds-initialize',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'resource-bounds', version: '1.0.0' },
        },
      }), 'utf8');
      assert.ok(initializeBody.length < 1024, 'Initialize fixture unexpectedly exceeds test body cap.');
      const initialize = await requestHttp({
        port,
        method: 'POST',
        pathName: '/mcp',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': String(initializeBody.length),
        },
        chunks: [initializeBody],
      });
      assert.equal(initialize.statusCode, 200, initialize.text);
    });

    const files = (await readdir(directory)).filter((name) => /^mcp-(incident|report)-/u.test(name));
    assert.ok(files.length >= 2, 'HTTP payload overflow did not capture diagnostics.');
    assert.ok(files.length <= 6, `HTTP diagnostics exceeded configured retention: ${files.length}`);
    const contents = await Promise.all(files.map((name) => readFile(path.join(directory, name), 'utf8')));
    assert.equal(contents.join('\n').includes(secret), false, 'HTTP diagnostic files leaked request body content.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

await verifyDiagnosticsRedactionAndRetention();
await verifyHttpBodyHardLimit();
console.log('MCP HTTP resource bounds and diagnostic retention tests passed.');
