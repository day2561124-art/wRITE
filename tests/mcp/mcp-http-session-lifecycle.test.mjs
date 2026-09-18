import { randomUUID } from 'node:crypto';
import { rm, readFile } from 'node:fs/promises';
import os from 'node:os';
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


async function verifyCrossSessionReconciliation() {
  const group = randomUUID();
  const artifact = 'tests/r5-reconciliation-' + group + '.txt';
  const journalRoot = path.join(os.tmpdir(), 'writer-workbench-operation-journal-test-' + group);
  try {
    await withServer({
      WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL: '1', WRITER_WORKBENCH_TEST_JOURNAL_GROUP: group,
      WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT: '1', WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION: '1',
      MCP_HTTP_SESSION_IDLE_TIMEOUT_MS: '60000', MCP_HTTP_CHILD_CALL_TIMEOUT_MS: '120000',
    }, async ({ port, stderr }) => {
      const sessions = await Promise.all([initializeSession(port, 'r5-first'), initializeSession(port, 'r5-second')]);
      let id = 0;
      const call = async (session, name, args) => {
        const { reconciliation_key, ...mutationArgs } = args;
        const lookup = name === 'dev_workspace_get_operation';
        const response = await postMcp({ port, ...session, message: { jsonrpc: '2.0', id: ++id,
          method: 'tools/call', params: { name, arguments: lookup ? args : mutationArgs,
            ...(!lookup && reconciliation_key ? { _meta: { reconciliation_key } } : {}) } } });
        assert.equal(response.statusCode, 200, response.text);
        return response.payload;
      };
      const payload = (reply) => JSON.parse(reply.result.content[0].text);
      await Promise.all(sessions.map((session) => call(session, 'dev_workspace_journal_status', {})));
      const key = 'r5-session-' + group;
      const args = { path: artifact, content: 'exactly one mutation\n', reconciliation_key: key };
      const replies = await Promise.all(sessions.map((session) => call(session, 'dev_create_file', args)));
      assert.equal(replies.filter((reply) => payload(reply).created === true).length, 1);
      assert.equal(replies.filter((reply) => payload(reply).reconciled === true).length, 1);
      assert.equal(await readFile(path.join(rootDir, artifact), 'utf8'), args.content);
      const lookup = payload(await call(sessions[1], 'dev_workspace_get_operation', { reconciliation_key: key }));
      assert.equal(lookup.reconciliation_state, 'completed');
      assert.equal(lookup.events.length, 2);
      // Simulate a caller that never received the original successful response.
      const resend = payload(await call(sessions[1], 'dev_create_file', args));
      assert.equal(resend.reconciliation_state, 'completed');
      assert.equal(resend.operation_id, lookup.operation_id);
      const conflict = await call(sessions[0], 'dev_create_file', { ...args, content: 'different' });
      assert.match(conflict.error.message, /RECONCILIATION_KEY_CONFLICT/u);
      const wrongTool = await call(sessions[0], 'dev_delete_file', { path: artifact, reconciliation_key: key });
      assert.match(wrongTool.error.message, /RECONCILIATION_KEY_CONFLICT/u);
      const invalidKey = 'r5-invalid-' + group;
      const rejected = await call(sessions[0], 'dev_create_file', { path: artifact, content: 42, reconciliation_key: invalidKey });
      assert(rejected.error);
      assert.equal(payload(await call(sessions[0], 'dev_workspace_get_operation', { reconciliation_key: invalidKey })).reconciliation_state, 'not_admitted');
      const operations = payload(await call(sessions[0], 'dev_workspace_list_operations', { operation_type: 'filesystem_create', limit: 100 }));
      assert.equal(operations.operations.length, 1, 'Cross-session requests admitted a second filesystem mutation.');
      const health = payload(await call(sessions[0], 'dev_workspace_journal_status', {}));
      assert.equal(health.health, 'healthy');
      assert.equal(health.chain_verified, true);
      assert.equal(health.dangling_operation_count, 0);
      const reloadKey = 'r5-reload-' + group;
      const reloaded = payload(await call(sessions[0], 'dev_mcp_reload', { reconciliation_key: reloadKey }));
      assert.equal(reloaded.reloaded, true);
      const replayReload = payload(await call(sessions[1], 'dev_mcp_reload', { reconciliation_key: reloadKey }));
      assert.equal(replayReload.reconciliation_state, 'completed');
      assert.equal((stderr().match(/dev_mcp_reload requested/g) ?? []).length, 1);
      const parentConflict = await call(sessions[0], 'dev_workspace_integrate', {
        integration_candidate_id: 'dev_integration_20260917-010000_000000000001', expected_revision: 1,
        reconciliation_key: key,
      });
      assert.match(parentConflict.error.message, /RECONCILIATION_KEY_CONFLICT/u);
      const finalHealth = payload(await call(sessions[1], 'dev_workspace_journal_status', {}));
      assert.equal(finalHealth.health, 'healthy');
      assert.equal(finalHealth.active_operation_count, 0);
      const deleted = payload(await call(sessions[0], 'dev_delete_file', { path: artifact }));
      assert.equal(deleted.deleted, true);
    });
  } finally {
    await rm(path.join(rootDir, artifact), { force: true });
    assert.equal(path.dirname(journalRoot), os.tmpdir());
    assert(path.basename(journalRoot).startsWith('writer-workbench-operation-journal-test-'));
    await rm(journalRoot, { recursive: true, force: true });
  }
}
await verifyCrossSessionReconciliation();
console.log('R5 cross-session HTTP reconciliation acceptance passed.');
