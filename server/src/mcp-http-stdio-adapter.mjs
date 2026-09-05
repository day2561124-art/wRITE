import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { once } from 'events';
import { attachWorldSimulationPreparedTurnBrokerIpc } from './world-simulation-prepared-turn-broker-ipc.mjs';
import { attachWorkspaceSnapshotAuthorityIpc } from './mcp-workspace-snapshot-authority-ipc.mjs';
import { terminateProcessTree } from './process-control.mjs';

// Minimal stdio proxy: spawn a per-connection child process running mcp-server.mjs
// and provide helpers to forward JSON-RPC messages via newline framing.

function encodeMessage(message, framing = 'line') {
  const json = JSON.stringify(message);
  if (framing === 'header') {
    return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  }
  return `${json}\n`;
}

export function createStdioSession(options = {}) {
  const listeners = new Map();
  let child = null;
  let stdoutBuffer = '';
  let initializeRequest = null;
  let initializedNotification = null;
  let generation = 0;
  let restarting = false;
  let closed = false;
  let lastExit = null;

  function notifyPendingListeners(error) {
    for (const [id, cb] of listeners.entries()) {
      try { cb(error, null); } catch (listenerError) { console.error('listener threw while handling child failure', listenerError); }
      listeners.delete(id);
    }
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
      )
      : () => {};

    nextChild.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString('utf8');

      // Parse as many complete frames as possible. Support header (Content-Length) framing
      // and fallback to newline-delimited JSON objects.
      while (true) {
        const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const header = stdoutBuffer.slice(0, headerEnd);
          const m = header.match(/Content-Length:\s*(\d+)/i);
          if (!m) {
            stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
            continue;
          }
          const len = parseInt(m[1], 10);
          const totalNeeded = headerEnd + 4 + len;
          if (stdoutBuffer.length < totalNeeded) break;
          const jsonText = stdoutBuffer.slice(headerEnd + 4, totalNeeded);
          stdoutBuffer = stdoutBuffer.slice(totalNeeded);
          if (!jsonText) continue;
          try {
            const msg = JSON.parse(jsonText);
            const id = msg.id ?? randomUUID();
            const cb = listeners.get(id);
            if (cb) {
              try { cb(null, msg); } catch (err) { console.error('listener callback threw', err); }
            }
          } catch (e) {
            console.error('[mcp-server] JSON parse error (header frame):', e);
          }
          continue;
        }

        const idx = stdoutBuffer.indexOf('\n');
        if (idx === -1) break;
        const line = stdoutBuffer.slice(0, idx).trim();
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          const id = msg.id ?? randomUUID();
          const cb = listeners.get(id);
          if (cb) {
            try { cb(null, msg); } catch (err) { console.error('listener callback threw', err); }
          }
        } catch (e) {
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
      if (child === nextChild) {
        notifyPendingListeners(new Error(
          `child process error pid=${nextChild.pid ?? 'unknown'} generation=${childGeneration}: ${err?.message ?? String(err)}`,
        ));
      }
    });

    nextChild.on('exit', (code, signal) => {
      detachPreparedTurnBrokerIpc();
      detachWorkspaceSnapshotAuthorityIpc();
      lastExit = {
        child_pid: nextChild.pid ?? null,
        generation: childGeneration,
        exit_code: code,
        signal: signal ?? null,
        restarting,
        closed,
        exited_at: new Date().toISOString(),
      };
      console.error(
        `[mcp-server] child exited pid=${lastExit.child_pid} generation=${lastExit.generation} code=${lastExit.exit_code} signal=${lastExit.signal} restarting=${lastExit.restarting} closed=${lastExit.closed}`,
      );
      if (child === nextChild && !restarting && !closed) {
        notifyPendingListeners(new Error(
          `child process exited pid=${lastExit.child_pid} generation=${lastExit.generation} code=${lastExit.exit_code} signal=${lastExit.signal}`,
        ));
      }
    });
  }

  function spawnChild() {
    stdoutBuffer = '';
    const nextChild = spawn(process.execPath, ['server/src/mcp-server.mjs'], {
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
    try {
      child.stdin.write(frame);
    } catch (e) {
      console.error('failed to write to child.stdin', e);
      try {
        const id = message.id ?? null;
        if (id) {
          const cb = listeners.get(id);
          if (cb) { cb(new Error('failed to write to child.stdin'), null); listeners.delete(id); }
        }
      } catch (e2) { console.error('error notifying listener after write failure', e2); }
    }
  }

  function call(message, cb) {
    captureLifecycleMessage(message);
    const id = message.id ?? randomUUID();
    message.id = id;
    listeners.set(id, (err, res) => {
      listeners.delete(id);
      cb(err, res);
    });
    send(message);
  }

  function internalCall(message) {
    return new Promise((resolve, reject) => {
      const id = message.id ?? randomUUID();
      message.id = id;
      listeners.set(id, (err, res) => {
        listeners.delete(id);
        if (err) reject(err);
        else resolve(res);
      });
      const frame = encodeMessage(message, 'line');
      try {
        child.stdin.write(frame);
      } catch (error) {
        listeners.delete(id);
        reject(error);
      }
    });
  }

  async function restart() {
    if (closed) throw new Error('MCP stdio session is closed.');
    if (restarting) throw new Error('MCP stdio session reload is already in progress.');
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
      const initializeResponse = await internalCall(replayInitialize);
      if (initializeResponse?.error) {
        throw new Error(`Reloaded MCP child initialize failed: ${initializeResponse.error.message ?? 'unknown error'}`);
      }
      if (initializedNotification) {
        const frame = encodeMessage(structuredClone(initializedNotification), 'line');
        nextChild.stdin.write(frame);
      }
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
    return {
      child_pid: child?.pid ?? null,
      generation,
      pending_calls: listeners.size,
      restarting,
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
