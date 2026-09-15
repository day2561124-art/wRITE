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

await verifyHungCallFailsOnceAndRecoversWithoutReplay();
await verifyCrashFailsInflightOnceAndRecoversWithoutReplay();
console.log('MCP HTTP reliability crash/hang recovery regressions passed.');
