import http from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createStdioSession } from './mcp-http-stdio-adapter.mjs';
import fs from 'fs';

function safeTransportSend(transport, payload, label = 'transport.send') {
  try {
    const result = transport.send(payload);

    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        const message = err && err.message ? err.message : String(err);

        if (message.includes('No connection established for request ID')) {
          console.warn(
            '[mcp-http] ' +
              label +
              ' skipped: closed request connection: ' +
              message,
          );
          return;
        }

        console.error('[mcp-http] ' + label + ' rejected', err);
      });
    }

    return result;
  } catch (err) {
    const message = err && err.message ? err.message : String(err);

    if (message.includes('No connection established for request ID')) {
      console.warn(
        '[mcp-http] ' +
          label +
          ' skipped: closed request connection: ' +
          message,
      );
      return undefined;
    }

    console.error('[mcp-http] ' + label + ' threw', err);
    return undefined;
  }
}

const DEFAULT_PORT = 8787;

function readConfig(configPath) {
  try {
    const txt = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {
      host: '127.0.0.1',
      port: DEFAULT_PORT,
    };
  }
}

function getSessionId(req) {
  const value = req.headers['mcp-session-id'];
  return Array.isArray(value) ? value[0] : value;
}

function writeJsonRpcError(res, statusCode, code, message) {
  if (res.headersSent) {
    if (!res.writableEnded) {
      res.end();
    }
    return;
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id: null,
    }),
  );
}

function readPostBody(req) {
  return new Promise((resolve) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(undefined);
      }
    });
  });
}

const configPath = process.argv.includes('--config')
  ? process.argv[process.argv.indexOf('--config') + 1]
  : 'config/mcp-http.example.json';

const config = readConfig(configPath);
const sessions = new Map();

function closeBridgeSession(entry) {
  if (!entry || entry.closed) {
    return;
  }

  entry.closed = true;

  const sessionId = entry.transport.sessionId;

  if (sessionId && sessions.get(sessionId) === entry) {
    sessions.delete(sessionId);
  }

  try {
    entry.session.close();
  } catch (error) {
    console.error(
      '[mcp-http] failed to close stdio child',
      error,
    );
  }
}

function bindBridge(entry) {
  const { transport, session } = entry;

  transport.onmessage = (message) => {
    try {
      if (message.id === undefined) {
        session.send(message);
        return;
      }

      session.call(message, (err, reply) => {
        if (err) {
          console.error(
            '[mcp-http] stdio call error',
            err,
          );

          safeTransportSend(
            transport,
            {
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32000,
                message: String(err),
              },
            },
            'transport.send(error)',
          );

          return;
        }

        safeTransportSend(
          transport,
          reply,
          'transport.send(reply)',
        );
      });
    } catch (error) {
      console.error(
        '[mcp-http] bridge relay threw',
        error,
      );

      if (message.id !== undefined) {
        safeTransportSend(
          transport,
          {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32000,
              message: String(error),
            },
          },
          'transport.send(relay-error)',
        );
      }
    }
  };

  transport.onerror = (error) => {
    console.error(
      '[mcp-http] transport error',
      error,
    );
  };

  transport.onclose = () => {
    closeBridgeSession(entry);
  };
}

function createBridgeSession() {
  const session = createStdioSession();
  let entry;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),

    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, entry);

      console.error(
        '[mcp-http] session initialized id=' +
          sessionId,
      );
    },

    onsessionclosed: (sessionId) => {
      console.error(
        '[mcp-http] session closed id=' +
          sessionId,
      );

      const current = sessions.get(sessionId);

      if (current) {
        closeBridgeSession(current);
      }
    },
  });

  entry = {
    transport,
    session,
    closed: false,
  };

  bindBridge(entry);

  return entry;
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://127.0.0.1',
      'Access-Control-Allow-Methods':
        'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
        'Accept',
        'Mcp-Session-Id',
        'MCP-Protocol-Version',
        'Last-Event-ID',
      ].join(','),
      'Access-Control-Expose-Headers':
        'Mcp-Session-Id',
    });

    res.end();
    return;
  }

  const sessionId = getSessionId(req);

  if (req.method === 'POST') {
    const parsed = await readPostBody(req);
    let entry;

    if (sessionId) {
      entry = sessions.get(sessionId);

      if (!entry) {
        writeJsonRpcError(
          res,
          404,
          -32001,
          'Session not found',
        );
        return;
      }
    } else if (
      parsed !== undefined &&
      isInitializeRequest(parsed)
    ) {
      entry = createBridgeSession();
    } else {
      writeJsonRpcError(
        res,
        400,
        -32000,
        'Bad Request: No valid session ID provided',
      );
      return;
    }

    try {
      await entry.transport.handleRequest(
        req,
        res,
        parsed,
      );
    } catch (error) {
      console.error(
        '[mcp-http] transport.handleRequest (POST) threw',
        error,
      );

      writeJsonRpcError(
        res,
        500,
        -32603,
        'Internal Server Error',
      );

      closeBridgeSession(entry);
    }

    return;
  }

  if (
    req.method === 'GET' ||
    req.method === 'DELETE'
  ) {
    if (!sessionId) {
      writeJsonRpcError(
        res,
        400,
        -32000,
        'Bad Request: Mcp-Session-Id header is required',
      );
      return;
    }

    const entry = sessions.get(sessionId);

    if (!entry) {
      writeJsonRpcError(
        res,
        404,
        -32001,
        'Session not found',
      );
      return;
    }

    try {
      await entry.transport.handleRequest(
        req,
        res,
      );
    } catch (error) {
      console.error(
        '[mcp-http] transport.handleRequest (' +
          req.method +
          ') threw',
        error,
      );

      writeJsonRpcError(
        res,
        500,
        -32603,
        'Internal Server Error',
      );
    }

    return;
  }

  res.writeHead(405, {
    Allow: 'GET,POST,DELETE,OPTIONS',
  });

  res.end('Method Not Allowed');
});

async function shutdown(signal) {
  console.error(
    '[mcp-http] received ' +
      signal +
      '; closing sessions',
  );

  const entries = [
    ...new Set(sessions.values()),
  ];

  for (const entry of entries) {
    try {
      await entry.transport.close();
    } catch (error) {
      console.error(
        '[mcp-http] transport close failed',
        error,
      );

      closeBridgeSession(entry);
    }
  }

  server.close(() => {
    process.exit(0);
  });
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

server.listen(
  config.port ?? DEFAULT_PORT,
  config.host ?? '127.0.0.1',
  () => {
    const host =
      config.host ?? '127.0.0.1';

    const port =
      config.port ?? DEFAULT_PORT;

    console.error(
      'MCP Streamable HTTP Server listening on http://' +
        host +
        ':' +
        port +
        '/mcp',
    );
  },
);