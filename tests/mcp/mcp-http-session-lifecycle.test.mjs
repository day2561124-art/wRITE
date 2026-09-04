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

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function parsePayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const dataLine = trimmed.split(/\r?\n/u).find((line) => line.startsWith('data: '));
    return dataLine ? JSON.parse(dataLine.slice(6)) : null;
  }
}

function postMcp({ port, sessionId, protocolVersion, message }) {
  const payload = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(payload),
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
        ...(protocolVersion ? { 'MCP-Protocol-Version': protocolVersion } : {}),
      },
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.once('end', () => resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        text,
        payload: parsePayload(text),
      }));
    });
    request.once('error', reject);
    request.end(payload);
  });
}

async function initializeSession(port, clientName) {
  const initialize = await postMcp({
    port,
    message: {
      jsonrpc: '2.0',
      id: `initialize-${clientName}`,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: clientName, version: '1.0.0' },
      },
    },
  });
  assert.equal(initialize.statusCode, 200, initialize.text);
  const sessionHeader = initialize.headers['mcp-session-id'];
  const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
  assert.ok(sessionId, 'Initialize response did not include Mcp-Session-Id.');
  const protocolVersion = initialize.payload?.result?.protocolVersion ?? '2025-03-26';
  const initialized = await postMcp({
    port,
    sessionId,
    protocolVersion,
    message: { jsonrpc: '2.0', method: 'notifications/initialized' },
  });
  assert.ok([200, 202].includes(initialized.statusCode), initialized.text);
  return { sessionId, protocolVersion };
}

function openSseStream({ port, sessionId, protocolVersion }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/mcp',
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Mcp-Session-Id': sessionId,
        'MCP-Protocol-Version': protocolVersion,
      },
    }, (response) => {
      response.on('data', () => {});
      resolve({ request, response });
    });
    request.once('error', reject);
    request.end();
  });
}

function childPidForSession(stderrText, sessionId) {
  const line = stderrText
    .split(/\r?\n/u)
    .find((candidate) => candidate.includes(`session initialized id=${sessionId} `));
  const match = line?.match(/child_pid=(\d+)/u);
  return match ? Number.parseInt(match[1], 10) : null;
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

async function verifyOpenSseDoesNotDefeatIdleCap() {
  await withServer({
    MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: '60000',
    MCP_HTTP_SESSION_REAPER_INTERVAL_MS: '50',
    MCP_HTTP_MAX_IDLE_SESSION_COUNT: '2',
    MCP_HTTP_MAX_TOTAL_SESSION_COUNT: '4',
  }, async ({ port, stderr }) => {
    const first = await initializeSession(port, 'sse-cap-first');
    const second = await initializeSession(port, 'sse-cap-second');
    const firstStream = await openSseStream({ port, ...first });
    const secondStream = await openSseStream({ port, ...second });
    assert.equal(firstStream.response.statusCode, 200);
    assert.equal(secondStream.response.statusCode, 200);

    const firstPid = childPidForSession(stderr(), first.sessionId);
    assert.ok(Number.isInteger(firstPid) && firstPid > 0, stderr());

    const third = await initializeSession(port, 'sse-cap-third');
    assert.ok(third.sessionId);

    await waitUntil(
      () => !isProcessRunning(firstPid),
      `Oldest SSE-backed idle session child was not reclaimed. stderr=${stderr()}`,
    );
    await waitUntil(
      () => stderr().includes('reason=max_idle_session_count'),
      `Idle-session cap eviction log did not arrive after child reclamation. stderr=${stderr()}`,
    );

    const oldSession = await postMcp({
      port,
      sessionId: first.sessionId,
      protocolVersion: first.protocolVersion,
      message: { jsonrpc: '2.0', id: 'old-session-check', method: 'tools/list', params: {} },
    });
    assert.equal(oldSession.statusCode, 404, oldSession.text);

    firstStream.request.destroy();
    secondStream.request.destroy();
  });
}

async function verifyOpenSseDoesNotDefeatIdleTimeout() {
  await withServer({
    MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: '350',
    MCP_HTTP_SESSION_REAPER_INTERVAL_MS: '50',
    MCP_HTTP_MAX_IDLE_SESSION_COUNT: '16',
    MCP_HTTP_MAX_TOTAL_SESSION_COUNT: '32',
  }, async ({ port, stderr }) => {
    const session = await initializeSession(port, 'sse-timeout');
    const stream = await openSseStream({ port, ...session });
    assert.equal(stream.response.statusCode, 200);
    const childPid = childPidForSession(stderr(), session.sessionId);
    assert.ok(Number.isInteger(childPid) && childPid > 0, stderr());

    await waitUntil(
      () => !isProcessRunning(childPid),
      `SSE-backed idle session child survived configured TTL. stderr=${stderr()}`,
    );
    await waitUntil(
      () => stderr().includes('reason=idle_timeout'),
      `Idle-timeout eviction log did not arrive after child reclamation. stderr=${stderr()}`,
    );
    stream.request.destroy();
  });
}

async function verifySseReconnectsDoNotRefreshIdleTimeout() {
  await withServer({
    MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: '350',
    MCP_HTTP_SESSION_REAPER_INTERVAL_MS: '50',
    MCP_HTTP_MAX_IDLE_SESSION_COUNT: '16',
    MCP_HTTP_MAX_TOTAL_SESSION_COUNT: '32',
  }, async ({ port, stderr }) => {
    const session = await initializeSession(port, 'sse-reconnect-timeout');
    const childPid = childPidForSession(stderr(), session.sessionId);
    assert.ok(Number.isInteger(childPid) && childPid > 0, stderr());

    const deadline = Date.now() + 1_500;
    while (Date.now() < deadline && isProcessRunning(childPid)) {
      const stream = await openSseStream({ port, ...session });
      await new Promise((resolve) => setTimeout(resolve, 80));
      stream.request.destroy();
      stream.response.destroy();
    }

    assert.equal(
      isProcessRunning(childPid),
      false,
      `Repeated SSE GET reconnects refreshed session liveness and prevented idle eviction. stderr=${stderr()}`,
    );
    await waitUntil(
      () => stderr().includes('reason=idle_timeout'),
      `Idle-timeout eviction log did not arrive after reconnect-driven child reclamation. stderr=${stderr()}`,
    );
  });
}

await verifyOpenSseDoesNotDefeatIdleCap();
await verifyOpenSseDoesNotDefeatIdleTimeout();
await verifySseReconnectsDoNotRefreshIdleTimeout();
console.log('MCP HTTP session lifecycle SSE regression tests passed.');
