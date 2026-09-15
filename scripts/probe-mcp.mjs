import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getMcpIdentity } from '../server/src/mcp-http-identity.mjs';

const [endpoint, mode = 'probe', expectedInstance] = process.argv.slice(2);
const timeoutMs = 10_000;
const endpointUrl = new URL(endpoint);

class ProbeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProbeError';
    this.code = code;
    this.details = details;
  }
}

function transportFailureCode() {
  return ['127.0.0.1', 'localhost', '::1'].includes(endpointUrl.hostname)
    ? 'ORIGIN_UNREACHABLE'
    : 'REMOTE_TRANSPORT_UNREACHABLE';
}

const boundedFetch = async (url, init = {}) => {
  try {
    return await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.any([
        ...(init.signal ? [init.signal] : []),
        AbortSignal.timeout(timeoutMs),
      ]),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ProbeError('HTTP_TIMEOUT', `HTTP request timed out after ${timeoutMs}ms`, {
        cause: error?.message ?? String(error),
      });
    }
    throw new ProbeError(transportFailureCode(), error?.message ?? String(error), {
      cause: error?.cause?.message ?? null,
    });
  }
};

async function fetchJson(pathname, init = {}) {
  const response = await boundedFetch(new URL(pathname, endpointUrl), init);
  let payload = null;
  try {
    payload = await response.json();
  } catch {}
  return { response, payload };
}

let transport;
let client;
const deadline = setTimeout(() => {
  console.error('MCP probe failed [HTTP_TIMEOUT]: probe exceeded 15s');
  process.exit(1);
}, 15_000);
deadline.unref?.();

try {
  const { response: health, payload: identity } = await fetchJson('/health');
  if (health.status !== 200) {
    throw new ProbeError('HTTP_HEALTH_FAILED', `identity HTTP ${health.status}`);
  }
  const expected = getMcpIdentity();
  if (identity?.service !== expected.service || identity?.repositoryId !== expected.repositoryId) {
    throw new ProbeError('MCP_HANDSHAKE_FAILED', 'Endpoint is not this repository Writer Workbench MCP');
  }

  if (mode === 'identity') {
    console.log(JSON.stringify({ ...identity, current: identity.revision === expected.revision }));
  } else {
    if (identity.revision !== expected.revision) {
      throw new ProbeError('STALE_REVISION', 'Stale MCP server revision');
    }
    if (expectedInstance && identity.instanceId !== expectedInstance) {
      throw new ProbeError('INSTANCE_CHANGED', 'Tunnel points to another MCP instance');
    }

    const started = performance.now();
    client = new Client({ name: 'writer-workbench-launcher-probe', version: '1.0.0' });
    transport = new StreamableHTTPClientTransport(endpointUrl, { fetch: boundedFetch });
    try {
      await client.connect(transport, { timeout: timeoutMs });
    } catch (error) {
      if (error instanceof ProbeError) throw error;
      throw new ProbeError('MCP_HANDSHAKE_FAILED', error?.message ?? String(error));
    }
    if (client.getServerVersion()?.name !== 'armed-academy-fiction-engine') {
      throw new ProbeError('MCP_HANDSHAKE_FAILED', 'Unexpected MCP serverInfo');
    }

    let tools;
    try {
      tools = await client.listTools({}, { timeout: timeoutMs });
    } catch (error) {
      throw new ProbeError('TOOLS_DISCOVERY_FAILED', error?.message ?? String(error));
    }
    if (!tools.tools.length) {
      throw new ProbeError('TOOLS_DISCOVERY_FAILED', 'MCP tools/list is empty');
    }

    try {
      await client.listResources({}, { timeout: timeoutMs });
    } catch (error) {
      throw new ProbeError('RUNTIME_NOT_READY', error?.message ?? String(error));
    }

    if (!transport.sessionId) {
      throw new ProbeError('SESSION_NOT_FOUND', 'MCP transport did not establish a session ID');
    }
    const { response: readyResponse, payload: readiness } = await fetchJson('/ready', {
      headers: { 'Mcp-Session-Id': transport.sessionId },
    });
    if (readyResponse.status !== 200 || readiness?.ready !== true) {
      throw new ProbeError(
        readiness?.code ?? (readyResponse.status === 404 ? 'SESSION_NOT_FOUND' : 'RUNTIME_NOT_READY'),
        readiness?.reason ?? `readiness HTTP ${readyResponse.status}`,
        { readiness },
      );
    }

    await client.ping({ timeout: timeoutMs });
    const { response: afterResponse, payload: after } = await fetchJson('/health');
    if (afterResponse.status !== 200) {
      throw new ProbeError('HTTP_HEALTH_FAILED', `identity recheck HTTP ${afterResponse.status}`);
    }
    if (after.instanceId !== identity.instanceId) {
      throw new ProbeError('INSTANCE_CHANGED', 'MCP instance changed during probe');
    }

    console.log(JSON.stringify({
      ...identity,
      current: true,
      ok: true,
      ready: true,
      toolCount: tools.tools.length,
      runtimeReadiness: readiness.child?.runtime_readiness?.state ?? 'unknown',
      childGeneration: readiness.child?.generation ?? null,
      discoveryMs: Math.round(performance.now() - started),
    }));
  }
} catch (error) {
  const code = error?.code ?? 'MCP_PROBE_FAILED';
  console.error(`MCP probe failed [${code}]: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  if (transport?.sessionId) await transport.terminateSession().catch(() => {});
  await client?.close().catch(() => {});
  clearTimeout(deadline);
}
