import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getMcpIdentity } from '../server/src/mcp-http-identity.mjs';
const [endpoint, mode = 'probe', expectedInstance] = process.argv.slice(2);
const timeoutMs = 10000;
const boundedFetch = (url, init = {}) => fetch(url, { ...init, redirect: 'error',
  signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(timeoutMs)]) });
let transport;
let client;
const deadline = setTimeout(() => { console.error('MCP probe exceeded 15s'); process.exit(1); }, 15000);
try {
  const health = await boundedFetch(new URL('/health', endpoint));
  if (health.status !== 200) throw new Error(`identity HTTP ${health.status}`);
  const identity = await health.json();
  const expected = getMcpIdentity();
  if (identity.service !== expected.service || identity.repositoryId !== expected.repositoryId)
    throw new Error('Endpoint is not this repository Writer Workbench MCP');
  if (mode === 'identity') {
    console.log(JSON.stringify({ ...identity, current: identity.revision === expected.revision }));
  } else {
    if (identity.revision !== expected.revision) throw new Error('Stale MCP server revision');
    if (expectedInstance && identity.instanceId !== expectedInstance) throw new Error('Tunnel points to another MCP instance');
    const started = performance.now();
    client = new Client({ name: 'writer-workbench-launcher-probe', version: '1.0.0' });
    transport = new StreamableHTTPClientTransport(new URL(endpoint), { fetch: boundedFetch });
    await client.connect(transport, { timeout: timeoutMs });
    if (client.getServerVersion()?.name !== 'armed-academy-fiction-engine') throw new Error('Unexpected MCP serverInfo');
    const tools = await client.listTools({}, { timeout: timeoutMs });
    if (!tools.tools.length) throw new Error('MCP tools/list is empty');
    await client.ping({ timeout: timeoutMs });
    const after = await (await boundedFetch(new URL('/health', endpoint))).json();
    if (after.instanceId !== identity.instanceId) throw new Error('MCP instance changed during probe');
    console.log(JSON.stringify({ ...identity, current: true, ok: true,
      toolCount: tools.tools.length, discoveryMs: Math.round(performance.now() - started) }));
  }
} catch (error) {
  console.error(`MCP probe failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (transport?.sessionId) await transport.terminateSession().catch(() => {});
  await client?.close().catch(() => {});
  clearTimeout(deadline);
}
