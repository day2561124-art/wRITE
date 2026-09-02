import http from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createStdioSession } from './mcp-http-stdio-adapter.mjs';
import { createEphemeralWorldSimulationPreparedTurnBroker } from './world-simulation-prepared-turn-ephemeral-broker.mjs';
import fs from 'fs';
import { createParentIntegrationControl, INTEGRATE_TOOL_NAME } from './mcp-http-integration-control.mjs';

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
const portArgumentIndex = process.argv.indexOf('--port');
const portOverride = portArgumentIndex >= 0
  ? Number.parseInt(process.argv[portArgumentIndex + 1], 10)
  : null;
if (portArgumentIndex >= 0 && (!Number.isInteger(portOverride) || portOverride < 1 || portOverride > 65535)) {
  throw new Error('--port must be an integer between 1 and 65535.');
}

const config = {
  ...readConfig(configPath),
  ...(portOverride === null ? {} : { port: portOverride }),
};
const sessions = new Map();
// The long-lived HTTP parent owns the world-simulation prepared-turn broker
// and the bounded developer reload/integration control routes.
// Legacy raw-story payloads no longer cross MCP child boundaries.
const preparedTurnBroker = createEphemeralWorldSimulationPreparedTurnBroker({
  ownership: 'mcp_http_parent',
  storage_scope: 'mcp_http_parent_process_ephemeral_memory',
});

const activeToolProfileName = process.env.MCP_TOOL_PROFILE?.trim() || 'chatgpt_public';
const integrationControl = createParentIntegrationControl({ profile: activeToolProfileName });
const DEV_MCP_RELOAD_TOOL_NAME = 'dev_mcp_reload';
const devMcpReloadToolDefinition = Object.freeze({
  name: DEV_MCP_RELOAD_TOOL_NAME,
  description: '[low-risk-write] Reload only the current ChatGPT MCP stdio child inside the long-lived HTTP parent. The HTTP listener, Cloudflare tunnel, and parent-owned world prepared-turn broker remain running; child-local ephemeral session state is intentionally reset. Reload is rejected while another child tool call is active.',
  inputSchema: Object.freeze({
    type: 'object',
    properties: Object.freeze({}),
    additionalProperties: false,
  }),
  annotations: Object.freeze({ readOnlyHint: false }),
  _meta: Object.freeze({
    'armed-academy/permission': Object.freeze({
      risk_level: 'low-risk-write',
      permission_level: 'write_low_risk',
      read_or_write: 'write',
      requires_user_confirmation: false,
      log_required: true,
      can_modify_canon: false,
      can_modify_active_engine: false,
      can_modify_story_graph: false,
      can_modify_memory: false,
      allowed_sources: Object.freeze([
        'mcp_http_current_session',
        'mcp_client_reload_request',
      ]),
    }),
  }),
});

function isDeveloperReloadAllowed() {
  return activeToolProfileName === 'chatgpt_developer';
}

function decorateParentOwnedTools(message, reply) {
  if (
    message?.method !== 'tools/list' ||
    !isDeveloperReloadAllowed() ||
    !Array.isArray(reply?.result?.tools)
  ) {
    return reply;
  }

  if (reply.result.tools.some((tool) => tool?.name === DEV_MCP_RELOAD_TOOL_NAME)) {
    return reply;
  }

  return {
    ...reply,
    result: {
      ...reply.result,
      tools: [
        ...reply.result.tools,
        devMcpReloadToolDefinition,
      ],
    },
  };
}

function reloadToolResult(id, payload, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload),
        },
      ],
      ...(isError ? { isError: true } : {}),
    },
  };
}

async function handleDevMcpReload(entry, message) {
  const id = message?.id;
  if (id === undefined) return;

  if (!isDeveloperReloadAllowed()) {
    safeTransportSend(
      entry.transport,
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Tool not allowed by MCP tool profile ${activeToolProfileName}: ${DEV_MCP_RELOAD_TOOL_NAME}`,
        },
      },
      'transport.send(dev_mcp_reload-profile-error)',
    );
    return;
  }

  const args = message?.params?.arguments ?? {};
  if (
    args === null ||
    typeof args !== 'object' ||
    Array.isArray(args) ||
    Object.keys(args).length > 0
  ) {
    safeTransportSend(
      entry.transport,
      {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'dev_mcp_reload does not accept arguments.',
        },
      },
      'transport.send(dev_mcp_reload-argument-error)',
    );
    return;
  }

  const before = entry.session.getStatus();
  if (before.pending_calls > 0) {
    safeTransportSend(
      entry.transport,
      reloadToolResult(id, {
        ok: false,
        reloaded: false,
        reason: 'active_child_tool_calls',
        pending_calls: before.pending_calls,
        child_pid: before.child_pid,
      }, true),
      'transport.send(dev_mcp_reload-busy)',
    );
    return;
  }

  try {
    console.error(
      `[mcp-http] dev_mcp_reload requested profile=${activeToolProfileName} parent_pid=${process.pid} child_pid=${before.child_pid}`,
    );
    // Capture the fixed integration service while bootstrap is still installed.
    // Child replacement and subsequent bootstrap cleanup cannot revoke this route.
    await integrationControl.prepare();
    const reloaded = await entry.session.restart();
    const after = entry.session.getStatus();
    console.error(
      `[mcp-http] dev_mcp_reload completed profile=${activeToolProfileName} parent_pid=${process.pid} previous_child_pid=${reloaded.previous_child_pid} child_pid=${reloaded.child_pid} generation=${reloaded.generation}`,
    );
    safeTransportSend(
      entry.transport,
      reloadToolResult(id, {
        ok: true,
        reloaded: true,
        profile: activeToolProfileName,
        http_parent_pid: process.pid,
        previous_child_pid: reloaded.previous_child_pid,
        child_pid: reloaded.child_pid,
        generation: reloaded.generation,
        pending_calls: after.pending_calls,
        http_parent_preserved: true,
        tunnel_preserved: true,
        prepared_turn_broker_preserved: true,
        child_ephemeral_state_reset: true,
      }),
      'transport.send(dev_mcp_reload-success)',
    );
  } catch (error) {
    console.error(
      `[mcp-http] dev_mcp_reload failed profile=${activeToolProfileName} parent_pid=${process.pid} child_pid=${before.child_pid} error=${error?.message ?? String(error)}`,
    );
    safeTransportSend(
      entry.transport,
      reloadToolResult(id, {
        ok: false,
        reloaded: false,
        reason: 'reload_failed',
        error: error?.message ?? String(error),
      }, true),
      'transport.send(dev_mcp_reload-failure)',
    );
  }
}

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
      if (
        message?.method === 'tools/call' &&
        message?.params?.name === DEV_MCP_RELOAD_TOOL_NAME
      ) {
        void handleDevMcpReload(entry, message);
        return;
      }

      if (message?.method === 'tools/call' && message?.params?.name === INTEGRATE_TOOL_NAME) {
        void integrationControl.call(message).then((reply) => {
          if (reply) safeTransportSend(transport, reply, 'transport.send(dev_workspace_integrate)');
        });
        return;
      }

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

        if (message.method === 'tools/list') {
          void integrationControl.prepare().then(() => {
            safeTransportSend(transport, integrationControl.decorate(decorateParentOwnedTools(message, reply)), 'transport.send(tools/list)');
          }).catch((error) => {
            safeTransportSend(transport, { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error.message } }, 'transport.send(integration-control-error)');
          });
          return;
        }
        safeTransportSend(transport, reply, 'transport.send(reply)');
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
  const session = createStdioSession({
    preparedTurnBroker,
  });
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

// Compatibility workaround for @modelcontextprotocol/sdk 1.29.0: an MCP
// session is keyed by Mcp-Session-Id and must outlive any one HTTP/1.1 TCP
// connection. The SDK can currently treat Node's default 5s idle keep-alive
// socket close as a transport/session close, so keep the parent-side socket
// alive until the upstream transport lifecycle no longer couples the two.
server.keepAliveTimeout = 0;

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
