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

    // Parse as many complete frames as possible. Support header (Content-Length) framing
    // and fallback to newline-delimited JSON objects.
    while (true) {
      // Header-framed: look for \r\n\r\n separator
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const header = stdoutBuffer.slice(0, headerEnd);
        const m = header.match(/Content-Length:\s*(\d+)/i);
        if (!m) {
          // malformed header, drop it and continue
          stdoutBuffer = stdoutBuffer.slice(headerEnd + 4);
          continue;
        }
        const len = parseInt(m[1], 10);
        const totalNeeded = headerEnd + 4 + len;
        if (stdoutBuffer.length < totalNeeded) break; // wait for more
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
          // continue processing remaining buffered data
        }
        continue; // try parse next frame
      }

      // Fallback to newline-delimited JSON
      const idx = stdoutBuffer.indexOf('\n');
      if (idx === -1) break; // incomplete line
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
        // likely a log line or partial JSON; don't crash, just log for debugging
        console.warn('[mcp-server] ignoring non-JSON stdout line:', line.slice(0, 200));
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const s = chunk.toString('utf8');
    console.error('[mcp-server stderr]', s);
  });

  child.on('error', (err) => {
    console.error('[mcp-server child error]', err);
    // Notify pending listeners of the failure
    for (const [id, cb] of listeners.entries()) {
      try { cb(new Error('child process error'), null); } catch (e) { console.error('listener threw on child error', e); }
      listeners.delete(id);
    }
  });

  child.on('exit', (code, signal) => {
    console.error(`[mcp-server] child exited code=${code} signal=${signal}`);
    for (const [id, cb] of listeners.entries()) {
      try { cb(new Error('child process exited'), null); } catch (e) { console.error('listener threw on child exit', e); }
      listeners.delete(id);
    }
  });

  function send(message) {
    const frame = encodeMessage(message, 'line');
    try {
      child.stdin.write(frame);
    } catch (e) {
      console.error('failed to write to child.stdin', e);
      // If writing fails, notify any listener for this id if present
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
