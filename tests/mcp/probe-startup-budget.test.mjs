import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import {runMcpProbe, normalizeTimings, normalizeOperationTimeout, formatProbeFailure} from '../../scripts/probe-mcp.mjs';
import {getMcpIdentity} from '../../server/src/mcp-http-identity.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(t, options = {}) {
  const counts = {health: 0, resources: 0, ready: 0, ping: 0, closed: 0};
  const identity = {...getMcpIdentity(), pid: process.pid, instanceId: 'startup-fixture', ...options.identity};
  const ready = () => ({ready: true, child: {generation: 1, runtime_readiness: {state: 'ready'}}, ...options.readiness});
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      counts.health++;
      res.end(JSON.stringify({...identity, ...(options.changePid && counts.health > 1 ? {pid: identity.pid + 1} : {})}));
    } else if (req.url === '/ready') {
      counts.ready++;
      assert.equal(req.headers['mcp-session-id'], 'fixture-session');
      const payload = options.ready?.() ?? ready();
      res.writeHead(payload.ready ? 200 : 503);
      res.end(JSON.stringify(payload));
    } else {res.writeHead(404);res.end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections();server.close();});
  const factory = async () => ({
    transport: {sessionId: 'fixture-session', async terminateSession() {counts.closed++;}},
    client: {
      async connect() {await options.connect?.();},
      getServerVersion: () => ({name: options.serverName ?? 'armed-academy-fiction-engine'}),
      async listTools() {return options.tools ?? {tools: [{name: 'fixture'}]};},
      async listResources() {counts.resources++; return options.resources ? options.resources(counts.resources) : {resources: []};},
      async ping() {counts.ping++;}, async close() {},
    },
  });
  return {counts, run: extra => runMcpProbe({endpoint: `http://127.0.0.1:${server.address().port}/mcp`,
    expectedInstance: 'startup-fixture', createClientFactory: factory, startupBudgetMs: 2000,
    hardDeadlineMs: 4000, operationTimeoutMs: 500, ...extra})};
}

test('cold protocol and reuse require tools, resources, ready, ping and stable identity', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 2; i++) {
    const result = await f.run();
    assert.equal(result.ok, true);assert.equal(result.runtimeReadiness, 'ready');
    assert.equal(result.resourceCount, 0);assert.equal(result.toolCount, 1);
    assert.ok(Object.hasOwn(result.phaseTimingsMs, 'resources/list'));
  }
  assert.equal(f.counts.resources, 2);assert.equal(f.counts.ping, 2);assert.equal(f.counts.closed, 2);
});

test('slow initialize within the operation deadline succeeds', async t => {
  const f = await fixture(t, {connect: () => sleep(150)});
  assert.equal((await f.run()).ready, true);
});

test('startup operation headroom permits initialize beyond the steady-state 10s default', async t => {
  const f = await fixture(t, {connect: () => sleep(11_000)});
  assert.equal((await f.run({operationTimeoutMs:30_000,startupBudgetMs:45_000,hardDeadlineMs:60_000})).ready,true);
});

test('real SDK HTTP 503 retains safe origin diagnostics without echoing the body', async t => {
  const identity={...getMcpIdentity(),pid:process.pid,instanceId:'sdk-503-fixture'};
  const server=http.createServer((req,res)=>{
    if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(identity));}
    else {res.writeHead(503);res.end('origin not ready Bearer PRIVATE_SECRET');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  await assert.rejects(runMcpProbe({endpoint:`http://127.0.0.1:${server.address().port}/mcp`}),e=>{
    assert.equal(e.code,'MCP_HANDSHAKE_FAILED');assert.equal(e.details.httpStatus,503);assert.match(e.message,/origin not ready/);
    assert.ok(!formatProbeFailure(e).includes('PRIVATE_SECRET'));return true;
  });
});

test('cold recovery beyond 30 seconds succeeds and resources discovery is retried', async t => {
  let begin;
  const f = await fixture(t, {
    resources: async n => {begin ??= Date.now(); if (n === 1) await sleep(32_000);return {resources: [{uri: 'fixture://ready'}]};},
    ready: () => ({ready: Date.now() - begin >= 32_000,
      child: {generation: 1, runtime_readiness: {state: Date.now() - begin >= 32_000 ? 'ready' : 'running', current_step: 'journal'}}}),
  });
  const result = await f.run({operationTimeoutMs: 10_000, startupBudgetMs: 45_000, hardDeadlineMs: 60_000});
  assert.equal(result.resourceCount, 1);assert.equal(f.counts.resources, 2);assert.equal(f.counts.ping, 1);
  assert.ok(result.discoveryMs >= 32_000 && result.discoveryMs < 45_000);
});

test('ready never substitutes for failed resources/list', async t => {
  const f = await fixture(t, {resources: async () => {throw Object.assign(new Error('HTTP 503 private token'), {status: 503});}});
  await assert.rejects(f.run(), e => e.code === 'RESOURCES_DISCOVERY_FAILED');
  assert.equal(f.counts.resources, 3);assert.equal(f.counts.ping, 0);assert.equal(f.counts.closed, 1);
});

test('nontransient resources errors fail immediately and omit secrets', async t => {
  const secret = 'Bearer SECRET_KEY_123 https://user:password@example.invalid/?token=private';
  const f = await fixture(t, {resources: async () => {throw Object.assign(new Error(secret), {status: 401});}});
  await assert.rejects(f.run(), e => {
    const diagnostic = formatProbeFailure(e);
    assert.match(diagnostic, /RESOURCES_DISCOVERY_FAILED/);assert.match(diagnostic, /resources\/list/);
    assert.ok(!diagnostic.includes('SECRET') && !diagnostic.includes('password'));
    return true;
  });
  assert.equal(f.counts.ready, 0);assert.equal(f.counts.resources, 1);
});

test('hung runtime is bounded, reports runtime phase, and closes session', async t => {
  const f = await fixture(t, {resources: async () => {throw new Error('timeout');},
    readiness: {ready: false, child: {runtime_readiness: {state: 'running', current_step: 'journal'}}}});
  const begin = Date.now();
  await assert.rejects(f.run({startupBudgetMs: 600, hardDeadlineMs: 2000}), e => {
    assert.equal(e.code, 'RUNTIME_NOT_READY');assert.equal(e.details.runtimeStep, 'journal');return true;
  });
  assert.ok(Date.now() - begin < 2000);assert.equal(f.counts.closed, 1);
});

test('failed runtime fails immediately with safe readiness diagnostics', async t => {
  const f = await fixture(t, {resources: async () => {throw new Error('timeout');},
    readiness: {ready: false, child: {runtime_readiness: {state: 'failed', current_step: 'checkpoint', last_error: 'SECRET'}}}});
  await assert.rejects(f.run(), e => e.code === 'RUNTIME_NOT_READY' && e.details.runtimeState === 'failed'
    && e.details.runtimeStep === 'checkpoint' && !formatProbeFailure(e).includes('SECRET'));
  assert.equal(f.counts.ready, 1);
});

for (const [name, options, code] of [
  ['foreign identity', {identity: {repositoryId: 'foreign'}}, 'MCP_HANDSHAKE_FAILED'],
  ['invalid PID', {identity: {pid: 0}}, 'MCP_HANDSHAKE_FAILED'],
  ['stale revision', {identity: {revision: 'stale'}}, 'STALE_REVISION'],
  ['wrong instance', {identity: {instanceId: 'other'}}, 'INSTANCE_CHANGED'],
  ['wrong serverInfo', {serverName: 'other'}, 'MCP_HANDSHAKE_FAILED'],
  ['empty tools', {tools: {tools: []}}, 'TOOLS_DISCOVERY_FAILED'],
  ['invalid resources', {resources: async () => ({})}, 'RESOURCES_DISCOVERY_FAILED'],
  ['unready runtime', {readiness: {ready: false}}, 'RUNTIME_NOT_READY'],
  ['PID change after protocol', {changePid: true}, 'INSTANCE_CHANGED'],
]) test(name + ' safely fails', async t => {
  const f = await fixture(t, options);await assert.rejects(f.run(), e => e.code === code);
});

test('hung initialize obeys deadline even with an uncooperative client', async t => {
  const f = await fixture(t, {connect: () => new Promise(() => {})});
  const begin = Date.now();
  await assert.rejects(f.run({operationTimeoutMs: 100}), e => e.code === 'HTTP_TIMEOUT' && e.details.phase === 'initialize');
  assert.ok(Date.now() - begin < 1500);assert.equal(f.counts.closed, 1);
});

test('timing normalization is bounded and preserves headroom', () => {
  assert.equal(normalizeOperationTimeout(), 10_000);assert.equal(normalizeOperationTimeout(100_000), 30_000);
  assert.throws(() => normalizeOperationTimeout(0.5));assert.throws(() => normalizeOperationTimeout(Infinity));
  assert.deepEqual(normalizeTimings(), {startup: 45_000, hard: 60_000});
  assert.deepEqual(normalizeTimings(100_000, 100_000), {startup: 59_000, hard: 60_000});
  assert.throws(() => normalizeTimings(3000, 1000));
  assert.ok(normalizeTimings(3000, 2000).startup < normalizeTimings(3000, 2000).hard);
});
