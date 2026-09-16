import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { once } from 'events';
import { attachWorldSimulationPreparedTurnBrokerIpc } from './world-simulation-prepared-turn-broker-ipc.mjs';
import { attachWorkspaceSnapshotAuthorityIpc } from './mcp-workspace-snapshot-authority-ipc.mjs';
import { createMcpRuntimeDiagnostics } from './mcp-runtime-diagnostics.mjs';
import { terminateProcessTree } from './process-control.mjs';

// Minimal stdio proxy: spawn a per-connection child process running mcp-server.mjs
// and provide helpers to forward JSON-RPC messages via newline framing.

const DEFAULT_CHILD_CALL_TIMEOUT_MS = 120_000;
const DEFAULT_RECOVERY_MAX_ATTEMPTS = 3;
const DEFAULT_RECOVERY_WINDOW_MS = 60_000;
const DEFAULT_RECOVERY_BASE_DELAY_MS = 100;
const DEFAULT_RECOVERY_MAX_DELAY_MS = 2_000;
const DEFAULT_MAX_FRAME_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_HEADER_BYTES = 16 * 1024;
const RUNTIME_READINESS_PROTOCOL = 'writer-workbench/runtime-readiness/v1';
const HEADER_DELIMITER = Buffer.from('\r\n\r\n', 'ascii');

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function reliabilityError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function encodeMessage(message, framing = 'line') {
  const json = JSON.stringify(message);
  if (framing === 'header') {
    return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  }
  return `${json}\n`;
}

export function createStdioSession(options = {}) {
  const listeners = new Map();
  const spawnProcess = options.spawnProcess ?? spawn;
  const diagnostics = options.diagnostics ?? createMcpRuntimeDiagnostics();
  let child = null;
  let stdoutBuffer = Buffer.alloc(0);
  let initializeRequest = null;
  let initializedNotification = null;
  let generation = 0;
  let restarting = false;
  let recovering = false;
  let recoveryPromise = null;
  let recoveryBlockedReason = null;
  let lastRecovery = null;
  const recoveryAttemptTimestamps = [];
  let closed = false;
  let lastExit = null;
  let runtimeReadiness = {
    state: 'unverified',
    current_step: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_error: null,
    generation: 0,
  };
  const callTimeoutMs = boundedInteger(
    options.callTimeoutMs ?? process.env.MCP_HTTP_CHILD_CALL_TIMEOUT_MS,
    DEFAULT_CHILD_CALL_TIMEOUT_MS,
    100,
    30 * 60 * 1000,
  );
  const maxFrameBytes = boundedInteger(
    options.maxFrameBytes ?? process.env.MCP_HTTP_CHILD_MAX_FRAME_BYTES,
    DEFAULT_MAX_FRAME_BYTES,
    64 * 1024,
    64 * 1024 * 1024,
  );
  const maxHeaderBytes = boundedInteger(
    options.maxHeaderBytes ?? process.env.MCP_HTTP_CHILD_MAX_HEADER_BYTES,
    DEFAULT_MAX_HEADER_BYTES,
    1_024,
    1024 * 1024,
  );
  const maxBufferedBytes = maxFrameBytes * 2 + maxHeaderBytes;
  const recoveryMaxAttempts = boundedInteger(
    options.recoveryMaxAttempts ?? process.env.MCP_HTTP_CHILD_RECOVERY_MAX_ATTEMPTS,
    DEFAULT_RECOVERY_MAX_ATTEMPTS,
    1,
    10,
  );
  const recoveryWindowMs = boundedInteger(
    options.recoveryWindowMs ?? process.env.MCP_HTTP_CHILD_RECOVERY_WINDOW_MS,
    DEFAULT_RECOVERY_WINDOW_MS,
    1_000,
    60 * 60 * 1000,
  );
  const recoveryBaseDelayMs = boundedInteger(
    options.recoveryBaseDelayMs ?? process.env.MCP_HTTP_CHILD_RECOVERY_BASE_DELAY_MS,
    DEFAULT_RECOVERY_BASE_DELAY_MS,
    0,
    60_000,
  );
  const recoveryMaxDelayMs = boundedInteger(
    options.recoveryMaxDelayMs ?? process.env.MCP_HTTP_CHILD_RECOVERY_MAX_DELAY_MS,
    DEFAULT_RECOVERY_MAX_DELAY_MS,
    recoveryBaseDelayMs,
    60_000,
  );

  function settleListener(id, error, response) {
    const entry = listeners.get(id);
    if (!entry) return false;
    listeners.delete(id);
    if (entry.timer) clearTimeout(entry.timer);
    try {
      entry.callback(error, response);
    } catch (listenerError) {
      console.error('listener callback threw', listenerError);
    }
    return true;
  }

  function notifyPendingListeners(error) {
    for (const id of [...listeners.keys()]) {
      settleListener(id, error, null);
    }
  }

  function registerListener(id, callback, options = {}) {
    const timeoutMs = boundedInteger(options.timeoutMs, callTimeoutMs, 100, 30 * 60 * 1000);
    const listenerGeneration = generation;
    const timer = setTimeout(() => {
      const entry = listeners.get(id);
      if (!entry || entry.generation !== listenerGeneration) return;
      const error = reliabilityError(
        'CHILD_HUNG',
        `MCP child call timed out after ${timeoutMs}ms`,
        { request_id: id, generation: listenerGeneration, timeout_ms: timeoutMs },
      );
      notifyPendingListeners(error);
      if (options.recoverOnTimeout !== false && initializedNotification) {
        void scheduleRecovery('call_timeout');
      }
    }, timeoutMs);
    listeners.set(id, {
      callback,
      timer,
      generation: listenerGeneration,
      internal: options.internal === true,
    });
  }

  function bindChild(nextChild, childGeneration) {
    const detachPreparedTurnBrokerIpc = options.preparedTurnBroker
      ? attachWorldSimulationPreparedTurnBrokerIpc(
        nextChild,
        options.preparedTurnBroker,
      )
      : () => {};
    const detachWorkspaceSnapshotAuthorityIpc = options.workspaceSnapshotAuthority
      ? attachWorkspaceSnapshotAuthorityIpc(
        nextChild,
        options.workspaceSnapshotAuthority,
        {
          change_clock_provider: options.workspaceChangeClockProvider ?? null,
        },
      )
      : () => {};
    const onRuntimeReadinessMessage = (message) => {
      if (
        message?.protocol !== RUNTIME_READINESS_PROTOCOL
        || message?.kind !== 'status'
        || child !== nextChild
      ) return;
      runtimeReadiness = {
        ...message.status,
        generation: childGeneration,
      };
      try {
        options.onRuntimeReadiness?.({ ...runtimeReadiness });
      } catch (error) {
        console.error('[mcp-server] runtime readiness observer threw', error);
      }
    };
    nextChild.on('message', onRuntimeReadinessMessage);

    let protocolOverflowed = false;
    const failProtocolOverflow = (reason, details = {}) => {
      if (protocolOverflowed || child !== nextChild || closed) return;
      protocolOverflowed = true;
      const error = reliabilityError(
        'CHILD_PROTOCOL_OVERFLOW',
        `MCP child stdout exceeded protocol bounds: ${reason}`,
        {
          reason,
          child_pid: nextChild.pid ?? null,
          generation: childGeneration,
          max_frame_bytes: maxFrameBytes,
          max_header_bytes: maxHeaderBytes,
          max_buffered_bytes: maxBufferedBytes,
          ...details,
        },
      );
      diagnostics.captureIncident('child_protocol_overflow', error.details, error);
      stdoutBuffer = Buffer.alloc(0);
      notifyPendingListeners(error);
      void stopChild(nextChild).catch((stopError) => {
        console.error('[mcp-server] failed to stop protocol-overflow child', stopError);
        try { terminateProcessTree(nextChild); } catch { }
      });
    };

    nextChild.stdout.on('data', (chunk) => {
      if (protocolOverflowed) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (stdoutBuffer.length + bytes.length > maxBufferedBytes) {
        failProtocolOverflow('aggregate_buffer_limit', {
          buffered_bytes: stdoutBuffer.length,
          incoming_bytes: bytes.length,
        });
        return;
      }
      stdoutBuffer = stdoutBuffer.length === 0
        ? Buffer.from(bytes)
        : Buffer.concat([stdoutBuffer, bytes], stdoutBuffer.length + bytes.length);

      // Parse as many complete frames as possible. Content-Length is byte-based,
      // so header framing is parsed from Buffer slices rather than JS string length.
      while (!protocolOverflowed && stdoutBuffer.length > 0) {
        const headerEnd = stdoutBuffer.indexOf(HEADER_DELIMITER);
        if (headerEnd !== -1) {
          if (headerEnd > maxHeaderBytes) {
            failProtocolOverflow('header_limit', { header_bytes: headerEnd });
            return;
          }
          const headerText = stdoutBuffer.subarray(0, headerEnd).toString('ascii');
          const match = headerText.match(/Content-Length:\s*(\d+)/i);
          if (!match) {
            stdoutBuffer = stdoutBuffer.subarray(headerEnd + HEADER_DELIMITER.length);
            continue;
          }
          const frameBytes = Number.parseInt(match[1], 10);
          if (!Number.isSafeInteger(frameBytes) || frameBytes < 0 || frameBytes > maxFrameBytes) {
            failProtocolOverflow('declared_frame_limit', {
              declared_frame_bytes: Number.isSafeInteger(frameBytes) ? frameBytes : null,
            });
            return;
          }
          const bodyStart = headerEnd + HEADER_DELIMITER.length;
          const totalNeeded = bodyStart + frameBytes;
          if (stdoutBuffer.length < totalNeeded) break;
          const jsonText = stdoutBuffer.subarray(bodyStart, totalNeeded).toString('utf8');
          stdoutBuffer = stdoutBuffer.subarray(totalNeeded);
          if (!jsonText) continue;
          try {
            const msg = JSON.parse(jsonText);
            const id = msg.id ?? randomUUID();
            settleListener(id, null, msg);
          } catch (error) {
            console.error('[mcp-server] JSON parse error (header frame):', error);
          }
          continue;
        }

        const newlineIndex = stdoutBuffer.indexOf(0x0a);
        if (newlineIndex === -1) {
          const asciiPrefix = stdoutBuffer.subarray(0, Math.min(stdoutBuffer.length, 32)).toString('ascii');
          if (/^Content-Length:/iu.test(asciiPrefix) && stdoutBuffer.length > maxHeaderBytes) {
            failProtocolOverflow('unterminated_header_limit', { buffered_bytes: stdoutBuffer.length });
            return;
          }
          if (stdoutBuffer.length > maxFrameBytes) {
            failProtocolOverflow('unterminated_line_frame_limit', { buffered_bytes: stdoutBuffer.length });
            return;
          }
          break;
        }
        if (newlineIndex > maxFrameBytes) {
          failProtocolOverflow('line_frame_limit', { frame_bytes: newlineIndex });
          return;
        }
        let lineBuffer = stdoutBuffer.subarray(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.subarray(newlineIndex + 1);
        if (lineBuffer.at(-1) === 0x0d) lineBuffer = lineBuffer.subarray(0, -1);
        const line = lineBuffer.toString('utf8').trim();
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          const id = msg.id ?? randomUUID();
          settleListener(id, null, msg);
        } catch (error) {
          console.warn('[mcp-server] ignoring non-JSON stdout line:', line.slice(0, 200));
        }
      }
    });

    nextChild.stderr.on('data', (chunk) => {
      const s = chunk.toString('utf8');
      console.error(`[mcp-server stderr pid=${nextChild.pid ?? 'unknown'} generation=${childGeneration}]`, s);
    });

    nextChild.on('error', (err) => {
      console.error(
        `[mcp-server child error pid=${nextChild.pid ?? 'unknown'} generation=${childGeneration}]`,
        err,
      );
      if (child === nextChild && !closed) {
        notifyPendingListeners(reliabilityError(
          'CHILD_DEAD',
          `MCP child process error pid=${nextChild.pid ?? 'unknown'} generation=${childGeneration}: ${err?.message ?? String(err)}`,
          { child_pid: nextChild.pid ?? null, generation: childGeneration },
        ));
        if (!restarting && !recovering && initializedNotification) void scheduleRecovery('child_error');
      }
    });

    nextChild.on('exit', (code, signal) => {
      detachPreparedTurnBrokerIpc();
      detachWorkspaceSnapshotAuthorityIpc();
      nextChild.off('message', onRuntimeReadinessMessage);
      lastExit = {
        child_pid: nextChild.pid ?? null,
        generation: childGeneration,
        exit_code: code,
        signal: signal ?? null,
        restarting,
        recovering,
        closed,
        exited_at: new Date().toISOString(),
      };
      console.error(
        `[mcp-server] child exited pid=${lastExit.child_pid} generation=${lastExit.generation} code=${lastExit.exit_code} signal=${lastExit.signal} restarting=${lastExit.restarting} recovering=${lastExit.recovering} closed=${lastExit.closed}`,
      );
      if (child === nextChild && !restarting && !recovering && !closed) {
        notifyPendingListeners(reliabilityError(
          'CHILD_DEAD',
          `MCP child process exited pid=${lastExit.child_pid} generation=${lastExit.generation} code=${lastExit.exit_code} signal=${lastExit.signal}`,
          { ...lastExit },
        ));
        if (initializedNotification) void scheduleRecovery('child_exit');
      }
    });
  }

  function spawnChild() {
    stdoutBuffer = Buffer.alloc(0);
    const nextChild = spawnProcess(process.execPath, ['server/src/mcp-server.mjs'], {
      // fd 3 is Node's internal IPC channel for the world-simulation prepared-turn
      // broker. stdout remains exclusively MCP JSON-RPC framing.
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: process.env.MCP_TOOL_PROFILE ?? 'chatgpt_public',
        ...(options.workspaceSnapshotAuthority
          ? { WRITER_WORKBENCH_PARENT_SNAPSHOT_AUTHORITY: '1' }
          : {}),
      },
    });
    generation += 1;
    child = nextChild;
    runtimeReadiness = {
      state: 'unverified',
      current_step: null,
      started_at: null,
      completed_at: null,
      failed_at: null,
      last_error: null,
      generation,
    };
    bindChild(nextChild, generation);
    return nextChild;
  }

  async function stopChild(nextChild) {
    if (!nextChild || nextChild.exitCode !== null || nextChild.signalCode !== null) return;
    const exited = once(nextChild, 'exit');
    try { nextChild.kill('SIGTERM'); } catch {}
    let timer;
    const graceful = await Promise.race([
      exited.then(() => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), 5_000);
        timer.unref?.();
      }),
    ]);
    if (timer) clearTimeout(timer);
    if (!graceful && nextChild.exitCode === null && nextChild.signalCode === null) {
      terminateProcessTree(nextChild);
      await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(resolve, 1_000)),
      ]);
    }
  }

  function trimRecoveryBudget(now = Date.now()) {
    while (
      recoveryAttemptTimestamps.length > 0
      && now - recoveryAttemptTimestamps[0] >= recoveryWindowMs
    ) {
      recoveryAttemptTimestamps.shift();
    }
  }

  function recoveryDelayMs(attemptNumber) {
    if (attemptNumber <= 1 || recoveryBaseDelayMs === 0) return 0;
    const exponential = Math.min(
      recoveryMaxDelayMs,
      recoveryBaseDelayMs * (2 ** (attemptNumber - 2)),
    );
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponential * 0.25)));
    return Math.min(recoveryMaxDelayMs, exponential + jitter);
  }

  async function waitForRecoveryDelay(delayMs) {
    if (delayMs <= 0) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, delayMs);
      timer.unref?.();
    });
  }

  async function replayLifecycleAfterSpawn() {
    if (!initializeRequest || !initializedNotification) {
      throw reliabilityError(
        'CHILD_RECOVERY_UNAVAILABLE',
        'MCP session lifecycle is incomplete and cannot be recovered.',
      );
    }
    const replayInitialize = structuredClone(initializeRequest);
    replayInitialize.id = `recovery-${randomUUID()}`;
    const initializeResponse = await internalCall(replayInitialize, {
      timeoutMs: callTimeoutMs,
      recoverOnTimeout: false,
    });
    if (initializeResponse?.error) {
      throw reliabilityError(
        'CHILD_RECOVERY_FAILED',
        `Recovered MCP child initialize failed: ${initializeResponse.error.message ?? 'unknown error'}`,
      );
    }
    const frame = encodeMessage(structuredClone(initializedNotification), 'line');
    child.stdin.write(frame);
  }

  function scheduleRecovery(trigger) {
    if (closed) return Promise.resolve(null);
    if (runtimeReadiness.state === 'failed') {
      recoveryBlockedReason = 'runtime_readiness_failed';
      lastRecovery = {
        ok: false,
        trigger,
        blocked_reason: recoveryBlockedReason,
        attempts: 0,
        completed_at: new Date().toISOString(),
      };
      return Promise.resolve(lastRecovery);
    }
    if (!initializeRequest || !initializedNotification) {
      recoveryBlockedReason = 'session_lifecycle_incomplete';
      return Promise.resolve(null);
    }
    if (restarting) {
      recoveryBlockedReason = 'manual_restart_in_progress';
      return Promise.resolve(null);
    }
    if (recoveryPromise) return recoveryPromise;

    recoveryPromise = (async () => {
      recovering = true;
      recoveryBlockedReason = null;
      const startedAt = new Date().toISOString();
      let attempts = 0;
      let lastError = null;

      try {
        while (attempts < recoveryMaxAttempts && !closed) {
          const now = Date.now();
          trimRecoveryBudget(now);
          if (recoveryAttemptTimestamps.length >= recoveryMaxAttempts) {
            recoveryBlockedReason = 'recovery_budget_exhausted';
            break;
          }

          recoveryAttemptTimestamps.push(now);
          attempts += 1;
          await waitForRecoveryDelay(recoveryDelayMs(attempts));

          const previousChild = child;
          try {
            await stopChild(previousChild);
            spawnChild();
            await replayLifecycleAfterSpawn();
            lastRecovery = {
              ok: true,
              trigger,
              attempts,
              started_at: startedAt,
              completed_at: new Date().toISOString(),
              child_pid: child?.pid ?? null,
              generation,
            };
            recoveryBlockedReason = null;
            return lastRecovery;
          } catch (error) {
            lastError = error;
            console.error(
              `[mcp-server] child recovery attempt failed trigger=${trigger} attempt=${attempts} generation=${generation}`,
              error,
            );
            const failedChild = child;
            await stopChild(failedChild).catch(() => {});
          }
        }

        if (!recoveryBlockedReason) recoveryBlockedReason = 'recovery_attempts_exhausted';
        lastRecovery = {
          ok: false,
          trigger,
          attempts,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          blocked_reason: recoveryBlockedReason,
          error: lastError?.message ?? null,
        };
        return lastRecovery;
      } finally {
        recovering = false;
      }
    })().finally(() => {
      recoveryPromise = null;
    });

    return recoveryPromise;
  }

  function captureLifecycleMessage(message) {
    if (!initializeRequest && message?.method === 'initialize' && message.id !== undefined) {
      initializeRequest = structuredClone(message);
    }
    if (!initializedNotification && message?.method === 'notifications/initialized') {
      initializedNotification = structuredClone(message);
    }
  }

  function send(message) {
    captureLifecycleMessage(message);
    const frame = encodeMessage(message, 'line');
    const activeChild = child;
    if (
      !activeChild
      || activeChild.exitCode !== null
      || activeChild.signalCode !== null
      || !activeChild.stdin?.writable
    ) {
      const error = reliabilityError(
        'CHILD_DEAD',
        'MCP child is not writable.',
        { generation, child_pid: activeChild?.pid ?? null },
      );
      const id = message.id ?? null;
      if (id !== null) settleListener(id, error, null);
      if (initializedNotification) void scheduleRecovery('write_unavailable');
      return false;
    }
    try {
      activeChild.stdin.write(frame, (error) => {
        if (!error) return;
        console.error('failed to write to child.stdin', error);
        const id = message.id ?? null;
        if (id !== null) settleListener(id, reliabilityError(
          'CHILD_DEAD',
          `Failed to write to MCP child: ${error.message ?? String(error)}`,
          { generation, child_pid: activeChild.pid ?? null },
        ), null);
        if (initializedNotification) void scheduleRecovery('write_failure');
      });
      return true;
    } catch (error) {
      console.error('failed to write to child.stdin', error);
      const id = message.id ?? null;
      if (id !== null) settleListener(id, reliabilityError(
        'CHILD_DEAD',
        `Failed to write to MCP child: ${error.message ?? String(error)}`,
        { generation, child_pid: activeChild.pid ?? null },
      ), null);
      if (initializedNotification) void scheduleRecovery('write_failure');
      return false;
    }
  }

  function call(message, cb) {
    captureLifecycleMessage(message);
    const id = message.id ?? randomUUID();
    message.id = id;
    registerListener(id, cb, { timeoutMs: callTimeoutMs, recoverOnTimeout: true });
    send(message);
  }

  function internalCall(message, options = {}) {
    return new Promise((resolve, reject) => {
      const id = message.id ?? randomUUID();
      message.id = id;
      registerListener(id, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }, {
        timeoutMs: options.timeoutMs ?? callTimeoutMs,
        internal: true,
        recoverOnTimeout: options.recoverOnTimeout === true,
      });
      const frame = encodeMessage(message, 'line');
      const activeChild = child;
      try {
        if (!activeChild?.stdin?.writable) {
          throw reliabilityError('CHILD_DEAD', 'MCP child is not writable.');
        }
        activeChild.stdin.write(frame, (error) => {
          if (!error) return;
          settleListener(id, reliabilityError(
            'CHILD_DEAD',
            `Failed to write internal MCP child request: ${error.message ?? String(error)}`,
            { generation, child_pid: activeChild.pid ?? null },
          ), null);
        });
      } catch (error) {
        settleListener(id, error, null);
      }
    });
  }

  async function restart() {
    if (closed) throw new Error('MCP stdio session is closed.');
    if (restarting) throw new Error('MCP stdio session reload is already in progress.');
    if (recovering || recoveryPromise) throw new Error('MCP stdio session recovery is already in progress.');
    if (listeners.size > 0) throw new Error('MCP child has active tool calls and cannot be reloaded.');
    if (!initializeRequest) throw new Error('MCP session has not completed initialize and cannot be reloaded.');

    restarting = true;
    const previousChild = child;
    const previousChildPid = previousChild?.pid ?? null;
    try {
      await stopChild(previousChild);
      const nextChild = spawnChild();
      const replayInitialize = structuredClone(initializeRequest);
      replayInitialize.id = `reload-${randomUUID()}`;
      const initializeResponse = await internalCall(replayInitialize, {
        timeoutMs: callTimeoutMs,
        recoverOnTimeout: false,
      });
      if (initializeResponse?.error) {
        throw new Error(`Reloaded MCP child initialize failed: ${initializeResponse.error.message ?? 'unknown error'}`);
      }
      if (initializedNotification) {
        const frame = encodeMessage(structuredClone(initializedNotification), 'line');
        nextChild.stdin.write(frame);
      }
      recoveryAttemptTimestamps.length = 0;
      recoveryBlockedReason = null;
      lastRecovery = null;
      return {
        previous_child_pid: previousChildPid,
        child_pid: nextChild.pid,
        generation,
      };
    } finally {
      restarting = false;
    }
  }

  function pendingCallCount() {
    return listeners.size;
  }

  function getStatus() {
    trimRecoveryBudget();
    const activeChild = child;
    const childAlive = Boolean(
      activeChild
      && activeChild.exitCode === null
      && activeChild.signalCode === null
      && !closed
    );
    return {
      child_pid: activeChild?.pid ?? null,
      child_alive: childAlive,
      generation,
      pending_calls: listeners.size,
      call_timeout_ms: callTimeoutMs,
      max_frame_bytes: maxFrameBytes,
      max_header_bytes: maxHeaderBytes,
      max_buffered_bytes: maxBufferedBytes,
      buffered_stdout_bytes: stdoutBuffer.length,
      restarting,
      recovering,
      recovery_blocked_reason: recoveryBlockedReason,
      recovery_budget: {
        max_attempts: recoveryMaxAttempts,
        window_ms: recoveryWindowMs,
        attempts_in_window: recoveryAttemptTimestamps.length,
        remaining_attempts: Math.max(0, recoveryMaxAttempts - recoveryAttemptTimestamps.length),
      },
      last_recovery: lastRecovery,
      runtime_readiness: { ...runtimeReadiness },
      closed,
      initialized: initializeRequest !== null,
      last_exit: lastExit,
    };
  }

  function close() {
    if (closed) return;
    closed = true;
    notifyPendingListeners(new Error('MCP stdio session closed.'));
    const currentChild = child;
    if (!currentChild || currentChild.exitCode !== null || currentChild.signalCode !== null) return;
    try {
      terminateProcessTree(currentChild);
    } catch {
      try { currentChild.kill(); } catch {}
    }
  }

  spawnChild();
  return {
    get child() { return child; },
    send,
    call,
    close,
    restart,
    pendingCallCount,
    getStatus,
  };
}
