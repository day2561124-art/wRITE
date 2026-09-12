import assert from 'node:assert/strict';
import { createRuntimeReadiness } from '../../server/src/mcp-runtime-readiness.mjs';
const order = [];
let release;
const blocked = new Promise(resolve => { release = resolve; });
const ready = createRuntimeReadiness([
  ['journal', async () => { order.push('journal'); await blocked; }],
  ['checkpoint', async () => order.push('checkpoint')],
  ['transaction', async () => order.push('transaction')],
], () => {});
assert.deepEqual(order, [], 'Discovery must not start disk recovery');
const first = ready();
assert.equal(ready(), first, 'Concurrent operations share one readiness barrier');
assert.deepEqual(order, ['journal']);
let ran = false;
first.then(() => { ran = true; });
await new Promise(resolve => setImmediate(resolve));
assert.equal(ran, false, 'Tool operations cannot run before recovery');
release();
await first;
assert.deepEqual(order, ['journal', 'checkpoint', 'transaction']);
await ready();
assert.equal(order.length, 3);
let attempts = 0;
const failure = createRuntimeReadiness([
  ['journal', async () => { attempts++; throw new Error('recovery failed'); }],
  ['checkpoint', async () => assert.fail('Must not proceed past failed recovery')],
], () => {});
await assert.rejects(failure(), /recovery failed/);
await assert.rejects(failure(), /recovery failed/);
assert.equal(attempts, 1, 'Failed readiness cannot be bypassed by retry');
console.log('MCP runtime readiness regression passed.');
