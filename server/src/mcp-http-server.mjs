import http from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createStdioSession } from './mcp-http-stdio-adapter.mjs';
import fs from 'fs';
import path from 'path';

const DEFAULT_PORT = 8787;

function readConfig(configPath) {
  try {
    const txt = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    return { host: '127.0.0.1', port: DEFAULT_PORT };
  }
}

const configPath = process.argv.includes('--config')
  ? process.argv[process.argv.indexOf('--config') + 1]
  : 'config/mcp-http.example.json';

const config = readConfig(configPath);

const server = http.createServer(async (req, res) => {
  if (req.url !== '/mcp') {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://127.0.0.1',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    res.end();
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const session = createStdioSession();

  transport.onmessage = (message, options) => {
    // forward to child process
    session.call(message, (err, reply) => {
      if (err) {
        console.error('stdio call error', err);
        try {
          transport.send({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32000, message: String(err) } });
        } catch (e) {}
        return;
      }
      try {
        transport.send(reply);
      } catch (e) {
        console.error('transport.send failed', e);
      }
    });
  };

  transport.onerror = (err) => console.error('transport error', err);
  transport.onclose = () => session.close();

  // Collect body if POST
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString('utf8'); });
    req.on('end', async () => {
      let parsed = undefined;
      try { parsed = JSON.parse(body); } catch (e) { parsed = undefined; }
      await transport.handleRequest(req, res, parsed);
    });
    return;
  }

  // For GET (SSE) and others
  await transport.handleRequest(req, res);
});

server.listen(config.port ?? DEFAULT_PORT, config.host ?? '127.0.0.1', () => {
  console.log(`MCP Streamable HTTP Server listening on http://${config.host ?? '127.0.0.1'}:${config.port ?? DEFAULT_PORT}/mcp`);
});
