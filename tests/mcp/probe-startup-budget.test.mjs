import assert from 'node:assert/strict';
import http from 'node:http';
import { getMcpIdentity } from '../../server/src/mcp-http-identity.mjs';
import { runMcpProbe, DEFAULT_OP_TIMEOUT } from '../../scripts/probe-mcp.mjs';
import { createProbeClient } from './probe-fake-client.mjs';

async function runProbe(port, extraEnv = {}) {
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  // create client via test helper and inject into runMcpProbe
  const createClientFactory = async ({ endpointUrl, boundedFetch }) => {
    return await createProbeClient({ endpointUrl, boundedFetch });
  };
  try {
    const result = await runMcpProbe({ endpoint, mode: 'probe', expectedInstance: 'fixture-instance', createClientFactory });
    return { code: 0, output: JSON.stringify(result) };
  } catch (err) {
    return { code: 1, output: `MCP probe failed [${err?.code ?? 'UNKNOWN'}]: ${err?.message ?? String(err)}` };
  }
}

async function listenFixture(handler) {
  const server = http.createServer(handler);
  await new Promise((r, rej) => server.listen(0, '127.0.0.1', (err) => err ? rej(err) : r()));
  return server;
}

// 1) Slow cold-start but eventually ready: probe should wait (within budget) and succeed
{
  let readyState = false;
  const server = await listenFixture((req, res) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...getMcpIdentity(), pid: process.pid, instanceId: 'fixture-instance' }));
    } else if (req.url === '/tools') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ tools: [{ name: 't1' }] }));
    } else if (req.url === '/resources') {
      // simulate a runtime that is not ready yet
      res.writeHead(503); res.end('not ready');
    } else if (req.url === '/ready') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ready: readyState }));
    } else if (req.url === '/ping') {
      res.end('pong');
    } else {
      res.writeHead(404); res.end();
    }
  });
  try {
    // Flip to ready after 12s (longer than per-op 10s but within startup budget 20s)
    setTimeout(() => { readyState = true; }, 12000);
    // Use production defaults (no env override) to validate default behavior.
    const result = await runProbe(server.address().port);
    assert.equal(result.code, 0, `probe should succeed for slow cold start; output=${result.output}`);
    assert.match(result.output, /"ready":true/);
    console.log('probe-startup-budget: slow cold-start success passed');
  } finally {
    await new Promise(r => server.close(r));
  }
}

// 2) Truly hung runtime: /ready never becomes true -> probe should fail within budget
{
  let readyHits = 0;
  const server = await listenFixture((req, res) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...getMcpIdentity(), pid: process.pid, instanceId: 'fixture-instance' }));
    } else if (req.url === '/tools') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ tools: [{ name: 't1' }] }));
    } else if (req.url === '/resources') {
      // hang /resources by never responding -> simulate long timeout
      // to emulate hanging, simply do not write response and keep socket open
      // but to avoid test suite hanging forever, we will respond with 503 after a short delay
      setTimeout(() => {
        try { res.writeHead(503); res.end('hung'); } catch (e) {}
      }, 10000);
    } else if (req.url === '/ready') {
      readyHits++;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ready: false }));
    } else if (req.url === '/ping') {
      res.end('pong');
    } else {
      res.writeHead(404); res.end();
    }
  });
  try {
    // Run with a small startup budget by overriding env for this test only
    process.env.PROBE_STARTUP_BUDGET_MS = '3000';
    process.env.PROBE_HARD_DEADLINE_MS = '5000';
    const result = await runProbe(server.address().port);
    delete process.env.PROBE_STARTUP_BUDGET_MS; delete process.env.PROBE_HARD_DEADLINE_MS;
    assert.notEqual(result.code, 0, 'probe should fail for truly hung runtime');
    // limited retry count: should have polled /ready only a few times within 3s
    assert(readyHits <= 10, `expected limited readiness polls, got ${readyHits}`);
    console.log('probe-startup-budget: hung-runtime fail + limited retries passed');
  } finally {
    await new Promise(r => server.close(r));
  }
}

// 3) Non-transient listResources error should fail immediately (no readiness polling)
{
  let readyHits = 0;
  const server = await listenFixture((req, res) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...getMcpIdentity(), pid: process.pid, instanceId: 'fixture-instance' }));
    } else if (req.url === '/tools') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ tools: [{ name: 't1' }] }));
    } else if (req.url === '/resources') {
      // non-transient client/protocol error: return 400 Bad Request
      res.writeHead(400); res.end('bad request');
    } else if (req.url === '/ready') {
      readyHits++;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ready: false }));
    } else if (req.url === '/ping') {
      res.end('pong');
    } else {
      res.writeHead(404); res.end();
    }
  });
  try {
    process.env.PROBE_STARTUP_BUDGET_MS = '10000';
    process.env.PROBE_HARD_DEADLINE_MS = '15000';
    const result = await runProbe(server.address().port);
    delete process.env.PROBE_STARTUP_BUDGET_MS; delete process.env.PROBE_HARD_DEADLINE_MS;
    assert.notEqual(result.code, 0, 'probe should fail immediately on non-transient resources error');
    assert.equal(readyHits, 0, 'should not have polled /ready when resources error is non-transient');
    console.log('probe-startup-budget: non-transient resources error immediate fail passed');
  } finally {
    await new Promise(r => server.close(r));
  }
}

// 4) Fast success path: resources available immediately and all checks pass
{
  const server = await listenFixture((req, res) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...getMcpIdentity(), pid: process.pid, instanceId: 'fixture-instance' }));
    } else if (req.url === '/tools') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ tools: [{ name: 't1' }, { name: 't2' }] }));
    } else if (req.url === '/resources') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ resources: [{ id: 'r1' }] }));
    } else if (req.url === '/ready') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ready: true, child: { runtime_readiness: { state: 'ready' }, generation: 1 } }));
    } else if (req.url === '/ping') {
      res.end('pong');
    } else {
      res.writeHead(404); res.end();
    }
  });
  try {
    // Verify production defaults also pass for fast path
    const result = await runProbe(server.address().port);
    assert.equal(result.code, 0, `fast success path should exit 0; output=${result.output}`);
    assert.match(result.output, /"toolCount":2/);
    assert.match(result.output, /"runtimeReadiness":"ready"/);
    console.log('probe-startup-budget: fast success path passed');
  } finally {
    await new Promise(r => server.close(r));
  }
}

// 5) Verify timings: global hard deadline is greater than startup budget (production defaults)
{
  const { startup, hard } = await (async () => {
    // call runMcpProbe in timings mode
    const endpoint = 'http://127.0.0.1:0/mcp';
    try {
      const res = await runMcpProbe({ endpoint, mode: 'identity' });
      // identity mode shouldn't reach timing print; use normalize logic via requiring module timings
    } catch (e) {}
    // Instead compute using normalizeTimings via process env defaults
    const mod = await import('../../scripts/probe-mcp.mjs');
    const normalized = mod.normalizeTimings?.(undefined, undefined);
    return { startup: normalized.startup, hard: normalized.hard };
  })();
  if (!(hard > startup)) throw new Error('global hard deadline should exceed startup budget');
  console.log('probe-startup-budget: timings verification passed');
}
