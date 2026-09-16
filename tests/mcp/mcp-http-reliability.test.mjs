import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createStdioSession } from '../../server/src/mcp-http-stdio-adapter.mjs';

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
          result: { ok: true, generation },
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
console.log('MCP HTTP reliability crash/hang/overflow and framing regressions passed.');
