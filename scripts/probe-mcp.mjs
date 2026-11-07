import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getMcpIdentity } from '../server/src/mcp-http-identity.mjs';
import { fileURLToPath } from 'node:url';

const DEFAULT_OP_TIMEOUT_MS = 10_000;
const MAX_OP_TIMEOUT_MS = 30_000;
const DEFAULT_STARTUP_READINESS_BUDGET_MS = 45_000;
const GLOBAL_HARD_CAP_MS = 60_000;
export const DEFAULT_OP_TIMEOUT = DEFAULT_OP_TIMEOUT_MS;

export function normalizeOperationTimeout(value) {
  const parsed = Math.trunc(Number(value ?? DEFAULT_OP_TIMEOUT_MS));
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error('Invalid PROBE_OP_TIMEOUT_MS');
  return Math.min(parsed, MAX_OP_TIMEOUT_MS);
}

export function normalizeTimings(startupBudgetEnv, hardDeadlineEnv) {
  let startup = Math.trunc(Number(startupBudgetEnv ?? DEFAULT_STARTUP_READINESS_BUDGET_MS));
  let hard = Math.trunc(Number(hardDeadlineEnv ?? GLOBAL_HARD_CAP_MS));
  if (!Number.isFinite(startup) || startup < 1) throw new Error('Invalid PROBE_STARTUP_BUDGET_MS');
  if (!Number.isFinite(hard) || hard <= 1000) throw new Error('Invalid PROBE_HARD_DEADLINE_MS');
  hard = Math.min(hard, GLOBAL_HARD_CAP_MS);
  startup = Math.min(startup, hard - 1000);
  return { startup, hard };
}

export class ProbeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProbeError';
    this.code = code;
    this.details = details;
  }
}

function httpStatus(error) {
  const status = Number(error?.response?.status ?? error?.status ?? error?.statusCode ?? error?.code);
  // The SDK's StreamableHTTPError stores the HTTP status in .code. JSON-RPC
  // error codes are negative and must keep their separate timeout semantics.
  return Number.isInteger(status) && status >= 100 && status < 600 ? status : null;
}

function transient(error) {
  if (error instanceof ProbeError) return error.code === 'HTTP_TIMEOUT';
  const status = httpStatus(error);
  if (status !== null) return status >= 500;
  return /timeout|timed out|HTTP\s*5\d\d/i.test(String(error?.message ?? '')) || error?.code === -32001;
}

// Only server-owned enum fields enter diagnostics. Never echo response bodies,
// endpoint credentials, session IDs, native stderr, or arbitrary exception text.
function readinessFacts(payload) {
  const runtime = payload?.child?.runtime_readiness;
  return {
    runtimeState: ['idle', 'unverified', 'running', 'ready', 'failed'].includes(runtime?.state) ? runtime.state : 'unknown',
    runtimeStep: ['journal', 'checkpoint', 'transaction'].includes(runtime?.current_step) ? runtime.current_step : null,
  };
}

export async function runMcpProbe({ endpoint, mode = 'probe', expectedInstance,
  startupBudgetMs, hardDeadlineMs, operationTimeoutMs, createClientFactory = null } = {}) {
  if (!endpoint) throw new ProbeError('INVALID_ARGS', 'endpoint is required');
  let endpointUrl, operation, startup, hard;
  try {
    endpointUrl = new URL(endpoint);
    operation = normalizeOperationTimeout(operationTimeoutMs ?? process.env.PROBE_OP_TIMEOUT_MS);
    ({ startup, hard } = normalizeTimings(startupBudgetMs ?? process.env.PROBE_STARTUP_BUDGET_MS,
      hardDeadlineMs ?? process.env.PROBE_HARD_DEADLINE_MS));
  } catch { throw new ProbeError('INVALID_TIMING_CONFIG', 'Invalid endpoint or probe timing configuration'); }
  const started = performance.now();
  const deadlineAt = started + startup;
  const controller = new AbortController();
  const phases = {};
  let phase = 'identity', transport, client, lastReadiness = {}, closing = false;
  const remaining = () => closing ? 400 : Math.max(1, Math.min(operation, deadlineAt - performance.now()));
  const failure = (code, message, cause) => new ProbeError(code, message, {
    phase, elapsedMs: Math.round(performance.now() - started), startupBudgetMs: startup,
    hardDeadlineMs: hard, operationTimeoutMs: operation, ...lastReadiness,
    ...(httpStatus(cause) === null ? {} : {httpStatus: httpStatus(cause)}),
  });
  const boundedFetch = async (url, init = {}) => {
    try {
      return await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([
        ...(!closing ? [controller.signal] : []), ...(init.signal ? [init.signal] : []), AbortSignal.timeout(Math.ceil(remaining())),
      ]) });
    } catch (error) {
      if (controller.signal.aborted || ['TimeoutError', 'AbortError'].includes(error?.name)) {
        throw failure('HTTP_TIMEOUT', 'HTTP operation exceeded its bounded deadline');
      }
      throw failure(['127.0.0.1', 'localhost', '[::1]'].includes(endpointUrl.hostname)
        ? 'ORIGIN_UNREACHABLE' : 'REMOTE_TRANSPORT_UNREACHABLE', 'MCP endpoint could not be reached');
    }
  };
  async function stage(name, fn) {
    phase = name;
    if (performance.now() >= deadlineAt) throw failure('HTTP_TIMEOUT', 'Probe startup budget exhausted');
    const begin = performance.now();
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(fn), new Promise((_, reject) => {
        timer = setTimeout(() => reject(failure('HTTP_TIMEOUT', 'Probe operation deadline exceeded')), Math.ceil(remaining()));
      })]);
    } finally { clearTimeout(timer); phases[name] = (phases[name] ?? 0) + Math.round(performance.now() - begin); }
  }
  async function json(pathname, headers) {
    const response = await boundedFetch(new URL(pathname, endpointUrl), { headers });
    let payload;
    try { payload = await response.json(); } catch { /* Invalid JSON fails validation below. */ }
    return { response, payload };
  }
  const headers = () => ({ 'Mcp-Session-Id': transport.sessionId });
  let deadlineTimer;
  const hardDeadline = new Promise((_, reject) => {
    deadlineTimer = setTimeout(() => {
      controller.abort();
      reject(failure('HTTP_TIMEOUT', 'Probe hard deadline exceeded'));
    }, hard - 500); // Reserve bounded cleanup time inside the hard cap.
  });
  try {
    return await Promise.race([hardDeadline, (async () => {
      const { response: health, payload: identity } = await stage('identity', () => json('/health'));
      if (health.status !== 200) throw failure('HTTP_HEALTH_FAILED', 'Identity endpoint did not return HTTP 200', {status:health.status});
      const expected = getMcpIdentity();
      if (identity?.service !== expected.service || identity?.repositoryId !== expected.repositoryId
        || !Number.isSafeInteger(identity?.pid) || identity.pid < 1 || typeof identity?.instanceId !== 'string' || !identity.instanceId) {
        throw failure('MCP_HANDSHAKE_FAILED', 'Endpoint is not this repository Writer Workbench MCP');
      }
      if (expectedInstance && identity.instanceId !== expectedInstance) throw failure('INSTANCE_CHANGED', 'Tunnel points to another MCP instance');
      if (mode === 'identity') return { identity: { ...identity, current: identity.revision === expected.revision } };
      if (mode !== 'probe') throw failure('INVALID_MODE', 'Unknown probe mode');
      if (identity.revision !== expected.revision) throw failure('STALE_REVISION', 'Stale MCP server revision');
      const discoveryStarted = performance.now();
      if (createClientFactory) ({ client, transport } = await stage('client', () => createClientFactory({ endpointUrl, boundedFetch })));
      else {
        client = new Client({ name: 'writer-workbench-launcher-probe', version: '1.0.0' });
        transport = new StreamableHTTPClientTransport(endpointUrl, { fetch: boundedFetch });
      }
      try { await stage('initialize', () => client.connect(transport, { timeout: Math.ceil(remaining()) })); }
      catch (e) { if (e instanceof ProbeError) throw e; throw failure('MCP_HANDSHAKE_FAILED', transient(e) ? 'MCP initialize failed: origin not ready' : 'MCP initialize failed', e); }
      if (client.getServerVersion?.()?.name !== 'armed-academy-fiction-engine') throw failure('MCP_HANDSHAKE_FAILED', 'Unexpected MCP serverInfo');
      if (!transport?.sessionId) throw failure('SESSION_NOT_FOUND', 'MCP initialize did not establish a session');
      let tools;
      try { tools = await stage('tools/list', () => client.listTools({}, { timeout: Math.ceil(remaining()) })); }
      catch (e) { if (e instanceof ProbeError) throw e; throw failure('TOOLS_DISCOVERY_FAILED', 'MCP tools/list failed', e); }
      if (!Array.isArray(tools?.tools) || !tools.tools.length) throw failure('TOOLS_DISCOVERY_FAILED', 'MCP tools/list is empty or invalid');
      let resources;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          resources = await stage('resources/list', () => client.listResources({}, { timeout: Math.ceil(remaining()) }));
          break;
        } catch (error) {
          if (!transient(error)) throw failure('RESOURCES_DISCOVERY_FAILED', 'MCP resources/list failed', error);
          if (attempt === 2) throw failure('RESOURCES_DISCOVERY_FAILED', 'MCP resources/list retry limit reached', error);
          let ready = false;
          for (let poll = 0; poll < 100 && performance.now() < deadlineAt; poll++) {
            const { response, payload } = await stage('runtime/readiness', () => json('/ready', headers()));
            lastReadiness = readinessFacts(payload);
            if (response.status === 404) throw failure('SESSION_NOT_FOUND', 'Session disappeared during readiness validation');
            if (payload?.child?.runtime_readiness?.state === 'failed') throw failure('RUNTIME_NOT_READY', 'Runtime recovery failed');
            if (response.status === 200 && payload?.ready === true) { ready = true; break; }
            if (response.status !== 503) throw failure('RUNTIME_NOT_READY', 'Invalid runtime readiness response');
            await new Promise(resolve => setTimeout(resolve, Math.min(500, Math.max(1, deadlineAt - performance.now()))));
          }
          if (!ready) throw failure('RUNTIME_NOT_READY', 'Runtime did not become ready within the startup budget');
          // /ready is evidence to retry discovery, never a substitute for it.
        }
      }
      if (!Array.isArray(resources?.resources)) throw failure('RESOURCES_DISCOVERY_FAILED', 'MCP resources/list response is invalid');
      const { response: readyResponse, payload: readiness } = await stage('ready', () => json('/ready', headers()));
      lastReadiness = readinessFacts(readiness);
      if (readyResponse.status !== 200 || readiness?.ready !== true || lastReadiness.runtimeState !== 'ready') {
        throw failure(readyResponse.status === 404 ? 'SESSION_NOT_FOUND' : 'RUNTIME_NOT_READY', 'Session runtime readiness validation failed');
      }
      try { await stage('ping', () => client.ping({ timeout: Math.ceil(remaining()) })); }
      catch (e) { if (e instanceof ProbeError) throw e; throw failure('MCP_PING_FAILED', 'MCP ping failed', e); }
      const { response: afterResponse, payload: after } = await stage('identity/recheck', () => json('/health'));
      if (afterResponse.status !== 200 || after?.instanceId !== identity.instanceId || after?.pid !== identity.pid
        || after?.service !== expected.service || after?.repositoryId !== expected.repositoryId || after?.revision !== expected.revision) {
        throw failure('INSTANCE_CHANGED', 'MCP identity changed during protocol verification');
      }
      return { ...identity, current: true, ok: true, ready: true, toolCount: tools.tools.length,
        resourceCount: resources.resources.length, runtimeReadiness: lastReadiness.runtimeState,
        childGeneration: readiness.child?.generation ?? null,
        discoveryMs: Math.round(performance.now() - discoveryStarted), phaseTimingsMs: phases };
    })()]);
  } catch (error) {
    if (error instanceof ProbeError) throw error;
    throw failure('MCP_PROBE_FAILED', 'MCP protocol verification failed');
  } finally {
    clearTimeout(deadlineTimer);
    // Cancel outstanding fetches and close even when a deadline wins the race.
    closing = true;
    controller.abort();
    let cleanupTimer;
    await Promise.race([(async () => {
      try { if (transport?.sessionId) await transport.terminateSession?.(); } catch {}
      try { await client?.close?.(); } catch {}
    })(), new Promise(resolve => { cleanupTimer = setTimeout(resolve, 500); })]);
    clearTimeout(cleanupTimer);
  }
}

export function formatProbeFailure(error) {
  return JSON.stringify({ ok: false, code: error instanceof ProbeError ? error.code : 'MCP_PROBE_FAILED',
    ...(error instanceof ProbeError ? {message: error.message} : {}),
    ...(error instanceof ProbeError ? error.details : {}) });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [endpoint, mode = 'probe', expectedInstance] = process.argv.slice(2);
    const result = await runMcpProbe({ endpoint, mode, expectedInstance });
    console.log(JSON.stringify(mode === 'identity' ? result.identity : result));
    process.exit(0);
  } catch (error) {
    console.error(formatProbeFailure(error));
    process.exit(1);
  }
}
