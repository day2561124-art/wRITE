import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

// Minimal stdio proxy: spawn a per-connection child process running mcp-server.mjs
// and provide helpers to forward JSON-RPC messages via newline framing.

function encodeMessage(message, framing = 'line') {
  const json = JSON.stringify(message);
  if (framing === 'header') {
    return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  }
  return `${json}\n`;
}

export function createStdioSession() {
  const child = spawn(process.execPath, ['server/src/mcp-server.mjs'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';

  const listeners = new Map();

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8');
    let idx;
    while ((idx = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, idx).trim();
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        const id = msg.id ?? randomUUID();
        const cb = listeners.get(id);
        if (cb) cb(null, msg);
      } catch (e) {
        // ignore non-json lines
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const s = chunk.toString('utf8');
    console.error('[mcp-server stderr]', s);
  });

  function send(message) {
    const frame = encodeMessage(message, 'line');
    child.stdin.write(frame);
  }

  function call(message, cb) {
    const id = message.id ?? randomUUID();
    message.id = id;
    listeners.set(id, (err, res) => {
      listeners.delete(id);
      cb(err, res);
    });
    send(message);
  }

  function close() {
    try { child.kill(); } catch (e) {}
  }

  return { child, send, call, close };
}
