import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createStdioSession, createReadonlyRetryBudget } from '../../server/src/mcp-http-stdio-adapter.mjs';

function waitUntil(predicate, message, timeoutMs = 3_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(message));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

function createFakeSpawn(scenario) {
  const children = [];
  let nextPid = 90_000;

  const spawnProcess = () => {
    const generation = children.length + 1;
    const child = new EventEmitter();
    child.pid = nextPid++;
    child.exitCode = null;
    child.signalCode = null;
    child.connected = true;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.messages = [];

    const emitResponse = (message) => {
      const payload = message.method === 'initialize'
        ? {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            serverInfo: { name: 'fake-mcp', version: '1.0.0' },
          },
        }
        : {
          jsonrpc: '2.0',
          id: message.id,
          result: message.method === 'tools/list'
            ? { tools: [{ name: 'safe_read', annotations: { readOnlyHint: !(scenario === 'read-flips' && generation > 1) } },
              { name: 'unsafe_write', annotations: { readOnlyHint: false } },
              { name: 'dev_run_tests', annotations: { readOnlyHint: false } },
              { name: 'dev_workspace_validate_integration', annotations: { readOnlyHint: false } }] }
            : { ok: true, generation },
        };
      setImmediate(() => child.stdout.emit('data', `${JSON.stringify(payload)}\n`));
    };

    child.stdin = {
      writable: true,
      write(frame, callback) {
        callback?.(null);
        const message = JSON.parse(String(frame).trim());
        child.messages.push(structuredClone(message));
        if (message.method === 'notifications/initialized') return true;
        if (message.method === 'tools/call' && (generation === 1 || scenario === 'read-always')) {
          if (message.params.name === 'safe_read' && ['read-hang', 'read-always', 'read-flips'].includes(scenario)) return true;
          if (message.params.name === 'unsafe_write') {
            if (scenario === 'mutation-hang') return true;
            if (scenario === 'mutation-crash') {
              setImmediate(() => { child.exitCode = 17; child.stdin.writable = false; child.emit('exit', 17, null); });
              return true;
            }
            if (scenario === 'mutation-overflow') {
              setImmediate(() => child.stdout.emit('data', Buffer.alloc((64 * 1024) + 1, 0x61)));
              return true;
            }
          }
        }
        if (message.method === 'test/hang' && scenario === 'hang' && generation === 1) {
          return true;
        }
        if (message.method === 'test/crash' && scenario === 'crash' && generation === 1) {
          setImmediate(() => {
            child.exitCode = 17;
            child.stdin.writable = false;
            child.emit('exit', 17, null);
          });
          return true;
        }
        if (message.method === 'test/overflow' && scenario === 'overflow' && generation === 1) {
          setImmediate(() => child.stdout.emit('data', Buffer.alloc((64 * 1024) + 1, 0x61)));
          return true;
        }
        if (message.method === 'tools/call' && scenario === 'long-tool-slow'
          && message.params?.name === 'dev_run_tests') {
          setTimeout(() => emitResponse(message), 175);
          return true;
        }
        if (message.method === 'test/header-unicode' && scenario === 'header-unicode') {
          const payload = JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: { text: '中文🙂', generation },
          });
          const payloadBytes = Buffer.from(payload, 'utf8');
          const header = Buffer.from(`Content-Length: ${payloadBytes.length}\r\n\r\n`, 'ascii');
          setImmediate(() => child.stdout.emit('data', Buffer.concat([header, payloadBytes])));
          return true;
        }
        if (message.id !== undefined) emitResponse(message);
        return true;
      },
    };

    child.kill = (signal = 'SIGTERM') => {
      if (child.exitCode !== null || child.signalCode !== null) return false;
      child.signalCode = signal;
      child.stdin.writable = false;
      setImmediate(() => child.emit('exit', null, signal));
      return true;
    };

    children.push(child);
    return child;
  };

  return { spawnProcess, children };
}

function rpcCall(session, message) {
  return new Promise((resolve, reject) => {
    session.call(structuredClone(message), (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

async function initializeSession(session, label) {
  const initialize = await rpcCall(session, {
    jsonrpc: '2.0',
    id: `initialize-${label}`,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: label, version: '1.0.0' },
    },
  });
  assert.equal(initialize.error, undefined);
  session.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
}

async function waitForRecovered(session, expectedGeneration) {
  await waitUntil(
    () => {
      const status = session.getStatus();
      return status.generation === expectedGeneration
        && status.recovering === false
        && status.last_recovery?.ok === true;
    },
    `Session did not recover to generation ${expectedGeneration}: ${JSON.stringify(session.getStatus())}`,
  );
}

async function verifyHungCallFailsOnceAndRecoversWithoutReplay() {
  const fake = createFakeSpawn('hang');
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess,
    callTimeoutMs: 100,
    recoveryMaxAttempts: 1,
    recoveryBaseDelayMs: 0,
    recoveryMaxDelayMs: 0,
  });
  try {
    await initializeSession(session, 'hang-test');
    await assert.rejects(
      rpcCall(session, {
        jsonrpc: '2.0',
        id: 'hung-call',
        method: 'test/hang',
        params: {},
      }),
      (error) => error?.code === 'CHILD_HUNG',
    );
    assert.equal(session.pendingCallCount(), 0, 'Timed-out listener was not cleaned up.');
    await waitForRecovered(session, 2);
    assert.equal(fake.children.length, 2, 'Hang triggered more than one replacement child.');
    assert.equal(
      fake.children[1].messages.some((message) => message.method === 'test/hang'),
      false,
      'Timed-out request was replayed on the replacement child.',
    );
    const safe = await rpcCall(session, {
      jsonrpc: '2.0',
      id: 'safe-after-hang',
      method: 'test/safe',
      params: {},
    });
    assert.equal(safe.result.generation, 2);
    assert.equal(session.pendingCallCount(), 0);
  } finally {
    if (session.child) session.child.exitCode = 0;
    session.close();
  }
}

async function verifyCrashFailsInflightOnceAndRecoversWithoutReplay() {
  const fake = createFakeSpawn('crash');
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess,
    callTimeoutMs: 500,
    recoveryMaxAttempts: 1,
    recoveryBaseDelayMs: 0,
    recoveryMaxDelayMs: 0,
  });
  try {
    await initializeSession(session, 'crash-test');
    await assert.rejects(
      rpcCall(session, {
        jsonrpc: '2.0',
        id: 'crashing-call',
        method: 'test/crash',
        params: {},
      }),
      (error) => error?.code === 'CHILD_DEAD',
    );
    await waitForRecovered(session, 2);
    assert.equal(
      session.pendingCallCount(),
      0,
      'Recovery completed but a listener remained pending.',
    );
    assert.equal(fake.children.length, 2, 'Crash triggered more than one replacement child.');
    assert.equal(
      fake.children[1].messages.some((message) => message.method === 'test/crash'),
      false,
      'Crashed in-flight request was replayed on the replacement child.',
    );
    const safe = await rpcCall(session, {
      jsonrpc: '2.0',
      id: 'safe-after-crash',
      method: 'test/safe',
      params: {},
    });
    assert.equal(safe.result.generation, 2);
  } finally {
    if (session.child) session.child.exitCode = 0;
    session.close();
  }
}

async function verifyProtocolOverflowFailsOnceAndRecoversWithoutReplay() {
  const fake = createFakeSpawn('overflow');
  const incidents = [];
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess,
    maxFrameBytes: 64 * 1024,
    maxHeaderBytes: 1024,
    callTimeoutMs: 1_000,
    recoveryMaxAttempts: 1,
    recoveryBaseDelayMs: 0,
    recoveryMaxDelayMs: 0,
    diagnostics: {
      captureIncident(type, details, error) {
        incidents.push({ type, details, code: error?.code ?? null });
        return null;
      },
    },
  });
  try {
    await initializeSession(session, 'overflow-test');
    const statusBefore = session.getStatus();
    assert.equal(statusBefore.max_frame_bytes, 64 * 1024);
    assert.equal(statusBefore.max_header_bytes, 1024);
    await assert.rejects(
      rpcCall(session, {
        jsonrpc: '2.0',
        id: 'overflow-call',
        method: 'test/overflow',
        params: {},
      }),
      (error) => error?.code === 'CHILD_PROTOCOL_OVERFLOW',
    );
    assert.equal(session.pendingCallCount(), 0, 'Protocol overflow listener was not cleaned up.');
    assert.equal(incidents.length, 1, 'Protocol overflow did not capture exactly one incident.');
    assert.equal(incidents[0].type, 'child_protocol_overflow');
    assert.equal(incidents[0].code, 'CHILD_PROTOCOL_OVERFLOW');
    await waitForRecovered(session, 2);
    assert.equal(fake.children.length, 2, 'Protocol overflow triggered more than one replacement child.');
    assert.equal(
      fake.children[1].messages.some((message) => message.method === 'test/overflow'),
      false,
      'Overflowing in-flight request was replayed on the replacement child.',
    );
    const safe = await rpcCall(session, {
      jsonrpc: '2.0',
      id: 'safe-after-overflow',
      method: 'test/safe',
      params: {},
    });
    assert.equal(safe.result.generation, 2);
  } finally {
    if (session.child) session.child.exitCode = 0;
    session.close();
  }
}

async function verifyHeaderFramingUsesUtf8ByteLength() {
  const fake = createFakeSpawn('header-unicode');
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess,
    maxFrameBytes: 64 * 1024,
    maxHeaderBytes: 1024,
  });
  try {
    await initializeSession(session, 'header-unicode-test');
    const response = await rpcCall(session, {
      jsonrpc: '2.0',
      id: 'header-unicode-call',
      method: 'test/header-unicode',
      params: {},
    });
    assert.equal(response.result.text, '中文🙂');
    assert.equal(response.result.generation, 1);
    assert.equal(session.getStatus().buffered_stdout_bytes, 0);
  } finally {
    if (session.child) session.child.exitCode = 0;
    session.close();
  }
}

await verifyHungCallFailsOnceAndRecoversWithoutReplay();
await verifyCrashFailsInflightOnceAndRecoversWithoutReplay();
await verifyProtocolOverflowFailsOnceAndRecoversWithoutReplay();
await verifyHeaderFramingUsesUtf8ByteLength();

async function verifyLongRunningDevelopmentToolUsesExtendedTimeoutOnly() {
  const fake = createFakeSpawn('long-tool-slow');
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess,
    callTimeoutMs: 100,
    longToolCallTimeoutMs: 300,
    recoveryMaxAttempts: 1,
    recoveryBaseDelayMs: 0,
    recoveryMaxDelayMs: 0,
  });
  try {
    await initializeSession(session, 'long-tool-timeout-test');
    await rpcCall(session, { jsonrpc: '2.0', id: 'catalog-long-tool', method: 'tools/list' });
    const before = session.getStatus();
    assert.equal(before.call_timeout_ms, 100);
    assert.equal(before.long_tool_call_timeout_ms, 300);
    assert.deepEqual(before.long_running_tools, ['dev_run_tests', 'dev_workspace_validate_integration']);
    const reply = await rpcCall(session, {
      jsonrpc: '2.0',
      id: 'long-tool',
      method: 'tools/call',
      params: { name: 'dev_run_tests', arguments: { suite: 'mcp' } },
    });
    assert.equal(reply.result.generation, 1);
    assert.equal(session.getStatus().generation, 1, 'legitimate long-running tool triggered child recovery');
    assert.equal(session.pendingCallCount(), 0);
  } finally {
    if (session.child) session.child.exitCode = 0;
    session.close();
  }
}

await verifyLongRunningDevelopmentToolUsesExtendedTimeoutOnly();
console.log('MCP HTTP reliability crash/hang/overflow, framing, and long-tool timeout regressions passed.');


async function retryFixture(scenario, overrides = {}) {
  const fake = createFakeSpawn(scenario);
  const delays = [];
  const session = createStdioSession({
    spawnProcess: fake.spawnProcess, callTimeoutMs: 100,
    recoveryMaxAttempts: 5, recoveryBaseDelayMs: 0, recoveryMaxDelayMs: 0,
    readonlyRetryBaseDelayMs: 100, readonlyRetryMaxDelayMs: 200,
    retryRandom: () => 0.5, retrySleep: async (ms) => {
      assert.equal(session.getStatus().recovering, false);
      assert.equal(session.getStatus().last_recovery.ok, true);
      delays.push(ms);
    }, ...overrides,
  });
  await initializeSession(session, scenario);
  await rpcCall(session, { jsonrpc: '2.0', id: 'catalog', method: 'tools/list' });
  return { fake, session, delays, close() { session.child.exitCode = 0; session.close(); } };
}
const readRequest = (id) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'safe_read', arguments: {} } });
{
  const fixture = await retryFixture('read-hang');
  try {
    const reply = await rpcCall(fixture.session, readRequest('read-recovered'));
    assert.equal(reply.id, 'read-recovered');
    assert.equal(reply.result.generation, 2);
    assert.deepEqual(fixture.delays, [75]);
    assert.equal(fixture.session.pendingCallCount(), 0);
  } finally { fixture.close(); }
}
{
  const fixture = await retryFixture('read-always');
  try {
    await assert.rejects(rpcCall(fixture.session, readRequest('exhausted')), (error) =>
      error.code === 'READ_ONLY_RETRY_EXHAUSTED' && error.details.retries === 2);
    assert.deepEqual(fixture.delays, [75, 150]);
    assert.equal(fixture.fake.children.flatMap((child) => child.messages).filter((m) => m.params?.name === 'safe_read').length, 3);
    await waitUntil(() => !fixture.session.getStatus().recovering, 'last recovery did not finish');
  } finally { fixture.close(); }
}
// A common budget spans sessions, limits amplification and bounds concurrent retry waiters.
{
  const budget = createReadonlyRetryBudget({ maxRetries: 2, maxConcurrent: 2 });
  const fixtures = await Promise.all([retryFixture('read-hang', { readonlyRetryBudget: budget }),
    retryFixture('read-hang', { readonlyRetryBudget: budget })]);
  try {
    const results = await Promise.allSettled(fixtures.flatMap((f, index) =>
      Array.from({ length: 4 }, (_, i) => rpcCall(f.session, readRequest('storm-' + index + '-' + i)))));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
    assert(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'READ_ONLY_RETRY_EXHAUSTED'));
    assert.equal(budget.status().used, 2);
    assert.equal(budget.status().active, 0);
    assert.equal(fixtures.flatMap((f) => f.fake.children.slice(1).flatMap((c) => c.messages))
      .filter((m) => m.params?.name === 'safe_read').length, 2);
  } finally { fixtures.forEach((f) => f.close()); }
}
for (const failure of ['hang', 'crash', 'overflow']) {
  const fixture = await retryFixture('mutation-' + failure, { maxFrameBytes: 64 * 1024, diagnostics: { captureIncident() {} } });
  try {
    await assert.rejects(rpcCall(fixture.session, { jsonrpc: '2.0', id: 'mutation', method: 'tools/call',
      params: { name: 'unsafe_write', arguments: { reconciliation_key: 'stable-mutation-key' }, readOnlyHint: true } }),
    (error) => error.code === ({ hang: 'CHILD_HUNG', crash: 'CHILD_DEAD', overflow: 'CHILD_PROTOCOL_OVERFLOW' })[failure]);
    await waitForRecovered(fixture.session, 2);
    assert.equal(fixture.fake.children.flatMap((c) => c.messages).filter((m) => m.params?.name === 'unsafe_write').length, 1);
    assert.deepEqual(fixture.delays, []);
  } finally { fixture.close(); }
}
console.log('R5 bounded read retry, deterministic jitter, shared storm budget and mutation no-replay passed.');

{
  const fixture = await retryFixture('read-flips');
  try {
    await assert.rejects(rpcCall(fixture.session, readRequest('changed-catalog')), (error) =>
      error.code === 'READ_ONLY_RETRY_EXHAUSTED' && error.details.reason === 'read_only_classification_changed');
    assert.equal(fixture.fake.children[1].messages.some((m) => m.params?.name === 'safe_read'), false);
  } finally { fixture.close(); }
}
