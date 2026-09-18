import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getMcpIdentity } from '../server/src/mcp-http-identity.mjs';
import { fileURLToPath } from 'node:url';

// Configuration defaults and caps
const DEFAULT_OP_TIMEOUT_MS = 10_000;
const DEFAULT_STARTUP_READINESS_BUDGET_MS = 30_000;
const HARD_DEADLINE_HEADROOM_MS = 5_000;
const GLOBAL_HARD_CAP_MS = 60_000;

export function normalizeTimings(startupBudgetEnv, hardDeadlineEnv) {
  let startup = Number(startupBudgetEnv ?? DEFAULT_STARTUP_READINESS_BUDGET_MS);
  if (!Number.isFinite(startup) || startup <= 0) throw new Error('Invalid PROBE_STARTUP_BUDGET_MS');
  // Ensure startup does not exceed cap-headroom
  const maxStartup = GLOBAL_HARD_CAP_MS - HARD_DEADLINE_HEADROOM_MS;
  if (startup > maxStartup) {
    // clamp silently to maintain invariant
    startup = maxStartup;
  }
  let hard = null;
  if (hardDeadlineEnv !== undefined) {
    hard = Number(hardDeadlineEnv);
    if (!Number.isFinite(hard) || hard <= 0) throw new Error('Invalid PROBE_HARD_DEADLINE_MS');
    // If operator supplied a hard deadline that's too small, clamp startup to preserve headroom
    if (hard < startup + 1000) {
      // clamp startup down to hard - headroom, but ensure positive
      const clampedStartup = Math.max(1000, hard - HARD_DEADLINE_HEADROOM_MS);
      // If clampedStartup is less than 1000, fail closed
      if (clampedStartup < 1000) throw new Error('PROBE_HARD_DEADLINE_MS too small to allow startup headroom');
      startup = clampedStartup;
    }
    // finally ensure hard respects global cap
    if (hard > GLOBAL_HARD_CAP_MS) hard = GLOBAL_HARD_CAP_MS;
  }
  // derive hard if not explicitly given
  if (hard === null) {
    hard = Math.min(startup + HARD_DEADLINE_HEADROOM_MS, GLOBAL_HARD_CAP_MS);
  }
  // Final guarantee invariant
  if (!(hard > startup)) throw new Error('Invariant: global hard deadline must exceed startup budget');
  return { startup, hard };
}

// Exported probe function (core logic) — tests can import and inject a client factory.
export class ProbeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProbeError';
    this.code = code;
    this.details = details;
  }
}


function transportFailureCode(endpointUrl) {
  return ['127.0.0.1', 'localhost', '::1'].includes(endpointUrl.hostname)
    ? 'ORIGIN_UNREACHABLE'
    : 'REMOTE_TRANSPORT_UNREACHABLE';
}

// Decide whether a listResources / ready error is transient and merits retry.
// Transient cases: HTTP request timeout, HTTP 5xx, or textual timeouts from
// underlying transport. Non-transient: 4xx (client), protocol/handshake errors,
// session missing, invalid responses — those must fail closed.
function isTransientResourceError(err) {
  if (!err) return false;
  // ProbeError with explicit HTTP_TIMEOUT should be retried
  if (err instanceof ProbeError) {
    if (err.code === 'HTTP_TIMEOUT') return true;
    // If a ProbeError was created from a transport failure code mapping that
    // indicates origin unreachable, treat as transient only for timeouts.
    return false;
  }

  // Structured response-like errors: check status if present
  const status = Number(err?.response?.status || err?.status || 0) || null;
  if (status) {
    if (status >= 500 && status < 600) return true; // server-side transient
    return false; // 4xx and others are non-transient
  }

  const msg = String(err?.message ?? err).toLowerCase();
  if (/\btimeout\b|timed out/.test(msg)) return true;
  if (/http\s*\d{3}/.test(msg)) {
    const m = msg.match(/http\s*(\d{3})/);
    if (m) {
      const s = Number(m[1]);
      return s >= 500 && s < 600;
    }
  }
  return false;
}

export const DEFAULT_OP_TIMEOUT = DEFAULT_OP_TIMEOUT_MS;

export async function runMcpProbe({ endpoint, mode = 'probe', expectedInstance = undefined, startupBudgetMs = undefined, hardDeadlineMs = undefined, createClientFactory = null } = {}) {
  if (!endpoint) throw new ProbeError('INVALID_ARGS', 'endpoint is required');
  const endpointUrl = new URL(endpoint);

  // normalize timings and enforce invariants
  let { startup: STARTUP_READINESS_BUDGET_MS, hard: GLOBAL_HARD_DEADLINE_MS } = (function () {
    try {
      return normalizeTimings(startupBudgetMs ?? process.env.PROBE_STARTUP_BUDGET_MS, hardDeadlineMs ?? process.env.PROBE_HARD_DEADLINE_MS);
    } catch (err) {
      throw new ProbeError('INVALID_TIMING_CONFIG', String(err.message ?? err));
    }
  })();

  // bounded fetch uses the local DEFAULT_OP_TIMEOUT_MS
  const boundedFetch = async (url, init = {}) => {
    try {
      return await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.any([
          ...(init.signal ? [init.signal] : []),
          AbortSignal.timeout(DEFAULT_OP_TIMEOUT_MS),
        ]),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new ProbeError('HTTP_TIMEOUT', `HTTP request timed out after ${DEFAULT_OP_TIMEOUT_MS}ms`, {
          cause: error?.message ?? String(error),
        });
      }
      throw new ProbeError(transportFailureCode(endpointUrl), error?.message ?? String(error), {
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
  // enforce global hard deadline by a timer
  let deadlineTimer;
  const deadlinePromise = new Promise((_, rej) => {
    deadlineTimer = setTimeout(() => {
      rej(new ProbeError('HTTP_TIMEOUT', `probe exceeded ${GLOBAL_HARD_DEADLINE_MS}ms`));
    }, GLOBAL_HARD_DEADLINE_MS);
    deadlineTimer.unref?.();
  });

  // run the probe logic with race against deadlinePromise
  return await Promise.race([ (async () => {
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
        return { identity: { ...identity, current: identity.revision === expected.revision } };
      }

      if (mode !== 'probe') {
        throw new ProbeError('INVALID_MODE', `Unknown probe mode ${mode}`);
      }

      if (identity.revision !== expected.revision) {
        throw new ProbeError('STALE_REVISION', 'Stale MCP server revision');
      }
      if (expectedInstance && identity.instanceId !== expectedInstance) {
        throw new ProbeError('INSTANCE_CHANGED', 'Tunnel points to another MCP instance');
      }

      const started = performance.now();

      // create client/transport either from injected factory (tests) or SDK
      if (typeof createClientFactory === 'function') {
        const created = await createClientFactory({ endpointUrl, boundedFetch });
        client = created.client; transport = created.transport;
      } else {
        client = new Client({ name: 'writer-workbench-launcher-probe', version: '1.0.0' });
        transport = new StreamableHTTPClientTransport(endpointUrl, { fetch: boundedFetch });
      }

      try {
        await client.connect(transport, { timeout: DEFAULT_OP_TIMEOUT_MS });
      } catch (error) {
        if (error instanceof ProbeError) throw error;
        throw new ProbeError('MCP_HANDSHAKE_FAILED', error?.message ?? String(error));
      }
      if (client.getServerVersion?.()?.name !== 'armed-academy-fiction-engine') {
        throw new ProbeError('MCP_HANDSHAKE_FAILED', 'Unexpected MCP serverInfo');
      }

      let tools;
      try {
        tools = await client.listTools?.({}, { timeout: DEFAULT_OP_TIMEOUT_MS });
      } catch (error) {
        throw new ProbeError('TOOLS_DISCOVERY_FAILED', error?.message ?? String(error));
      }
      if (!tools?.tools?.length) {
        throw new ProbeError('TOOLS_DISCOVERY_FAILED', 'MCP tools/list is empty');
      }

      // Attempt one fast resources discovery via client. If it fails due to the
      // runtime being cold (timeout/temporary), fall back to bounded read-only
      // readiness polling against /ready until the startup budget expires.
      let resourcesOk = false;
      try {
        await client.listResources?.({}, { timeout: DEFAULT_OP_TIMEOUT_MS });
        resourcesOk = true;
      } catch (error) {
        if (!isTransientResourceError(error)) {
          throw error;
        }
        const start = Date.now();
        const deadlineAt = start + STARTUP_READINESS_BUDGET_MS;
        const backoffs = [200, 500, 1000, 2000];
        let attempt = 0;
        while (Date.now() < deadlineAt) {
          const headers = transport?.sessionId ? { 'Mcp-Session-Id': transport.sessionId } : {};
          try {
            const { response: readyResponse, payload } = await fetchJson('/ready', { headers });
            if (readyResponse.status === 200 && payload?.ready === true) {
              resourcesOk = true; break;
            }
            if (readyResponse.status === 404) throw new ProbeError('SESSION_NOT_FOUND', 'Session not found during readiness polling');
          } catch (err) {
            if (!isTransientResourceError(err)) {
              if (err instanceof ProbeError) throw err;
              throw new ProbeError('RUNTIME_NOT_READY', err?.message ?? String(err));
            }
          }
          const wait = backoffs[Math.min(attempt, backoffs.length - 1)];
          await new Promise(r => setTimeout(r, wait));
          attempt++;
        }
        if (!resourcesOk) throw new ProbeError('RUNTIME_NOT_READY', 'Runtime did not become ready within startup budget');
      }

      if (!transport?.sessionId) throw new ProbeError('SESSION_NOT_FOUND', 'MCP transport did not establish a session ID');
      const { response: readyResponse, payload: readiness } = await fetchJson('/ready', { headers: { 'Mcp-Session-Id': transport.sessionId } });
      if (readyResponse.status !== 200 || readiness?.ready !== true) {
        throw new ProbeError(readiness?.code ?? (readyResponse.status === 404 ? 'SESSION_NOT_FOUND' : 'RUNTIME_NOT_READY'), readiness?.reason ?? `readiness HTTP ${readyResponse.status}`, { readiness });
      }

      await client.ping?.({ timeout: DEFAULT_OP_TIMEOUT_MS });
      const { response: afterResponse, payload: after } = await fetchJson('/health');
      if (afterResponse.status !== 200) throw new ProbeError('HTTP_HEALTH_FAILED', `identity recheck HTTP ${afterResponse.status}`);
      if (after.instanceId !== identity.instanceId) throw new ProbeError('INSTANCE_CHANGED', 'MCP instance changed during probe');

      return {
        ...identity,
        current: true,
        ok: true,
        ready: true,
        toolCount: tools.tools.length,
        runtimeReadiness: readiness.child?.runtime_readiness?.state ?? 'unknown',
        childGeneration: readiness.child?.generation ?? null,
        discoveryMs: Math.round(performance.now() - started),
      };
    } finally {
      if (transport?.sessionId && typeof transport.terminateSession === 'function') await transport.terminateSession().catch(() => {});
      await client?.close?.().catch(() => {});
      clearTimeout(deadlineTimer);
    }
  })(), deadlinePromise]);
}

// CLI entrypoint when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const [endpoint, mode = 'probe', expectedInstance] = process.argv.slice(2);
    try {
      const result = await runMcpProbe({ endpoint, mode, expectedInstance });
      // Preserve historical CLI behavior: when invoked in identity mode, the
      // original script printed the identity object (with `current`) at top-level.
      if (mode === 'identity' && result && typeof result === 'object' && 'identity' in result) {
        console.log(JSON.stringify(result.identity));
      } else {
        console.log(JSON.stringify(result));
      }
      process.exit(0);
    } catch (err) {
      const code = err?.code ?? 'MCP_PROBE_FAILED';
      console.error(`MCP probe failed [${code}]: ${err?.message ?? String(err)}`);
      process.exit(1);
    }
  })();
}
