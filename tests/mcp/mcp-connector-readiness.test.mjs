import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { getMcpIdentity } from '../../server/src/mcp-http-identity.mjs';
const identity = { ...getMcpIdentity(), pid: process.pid, instanceId: 'fixture-instance' };
let mode;
const fake = http.createServer((req, res) => {
  if (mode === 'redirect') { res.writeHead(302, { Location: '/elsewhere' }); res.end(); return; }
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...identity,
      ...(mode === 'foreign' ? { repositoryId: 'another-repository' } : {}),
      ...(mode === 'stale' ? { revision: 'old-revision' } : {}),
    }));
  } else { res.writeHead(503); res.end('origin not ready'); }
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
async function probe(extra = []) {
  const child = spawn(process.execPath, ['scripts/probe-mcp.mjs',
    `http://127.0.0.1:${fake.address().port}/mcp`, ...extra], { windowsHide: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => resolve({ code, output }));
  });
}
try {
  mode = 'foreign';
  let result = await probe();
  assert.equal(result.code, 1); assert.match(result.output, /not this repository/);
  mode = 'stale';
  result = await probe();
  assert.equal(result.code, 1); assert.match(result.output, /Stale MCP/);
  result = await probe(['identity']);
  assert.equal(result.code, 0); assert.equal(JSON.parse(result.output).current, false);
  mode = 'current';
  result = await probe(['probe', 'wrong-instance']);
  assert.equal(result.code, 1); assert.match(result.output, /another MCP instance/);
  result = await probe();
  assert.equal(result.code, 1); assert.match(result.output, /origin not ready/);
  mode = 'redirect';
  result = await probe();
  assert.equal(result.code, 1, 'Redirected endpoints must not pass readiness');
  console.log('MCP connector readiness negatives passed (foreign, stale, wrong instance, 503, redirect).');
} finally { await new Promise(resolve => fake.close(resolve)); }
