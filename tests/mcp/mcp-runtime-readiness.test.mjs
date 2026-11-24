import assert from 'node:assert/strict';
import { createRuntimeReadiness } from '../../server/src/mcp-runtime-readiness.mjs';

let releaseCheckpoint;
const checkpointDelay = new Promise(resolve => { releaseCheckpoint = resolve; });
const statuses = [];
let bridgeAttempts = 0;
const scoped = createRuntimeReadiness([
  ['journal', async () => ({ health: 'healthy' })],
  ['checkpoint', async () => checkpointDelay],
  ['trpg', async () => {
    if (++bridgeAttempts === 1) throw new Error('TRPG_GATEWAY_UNAVAILABLE');
    return { initialized: true };
  }],
], status => statuses.push(status));
const checkpoint = scoped.ensure('checkpoint');
assert.equal(scoped.ensure('checkpoint'), checkpoint);
assert.deepEqual(await scoped.ensure('journal'), { health: 'healthy' });
await assert.rejects(scoped.ensure('trpg'), /TRPG_GATEWAY_UNAVAILABLE/u);
await assert.rejects(scoped.ensure('trpg'), /TRPG_GATEWAY_UNAVAILABLE/u);
assert.equal(bridgeAttempts, 1);
await new Promise(resolve => setTimeout(resolve, 300));
assert.deepEqual(await scoped.ensure('trpg'), { initialized: true });
assert.equal(bridgeAttempts, 2);
assert.equal(statuses.at(-1).components.checkpoint.state, 'recovering');
releaseCheckpoint({ initialized: true });
await checkpoint;
assert.equal(statuses.at(-1).state, 'ready');
scoped.invalidate('trpg', new Error('TRPG_GATEWAY_CREDENTIAL_REJECTED'));
assert.equal(scoped.getStatus().components.trpg.state, 'unavailable');
assert.deepEqual(await scoped.ensure('journal'), { health: 'healthy' });
await assert.rejects(scoped.ensure('trpg'), /TRPG_GATEWAY_CREDENTIAL_REJECTED/u);
await new Promise(resolve => setTimeout(resolve, 300));
assert.deepEqual(await scoped.ensure('trpg'), { initialized: true });
assert.equal(bridgeAttempts, 3);
assert.equal(scoped.getStatus().components.trpg.state, 'ready');

let finishCheckpoint;
let transactionStarts = 0;
const ordered = createRuntimeReadiness([
  ['journal', async () => ({ health: 'healthy' })],
  ['checkpoint', () => new Promise(resolve => { finishCheckpoint = resolve; })],
  ['transaction', async () => { transactionStarts++; return { health: 'healthy' }; }],
  ['trpg', async () => ({ initialized: true })],
], null, { dependencies: { transaction: ['checkpoint'] } });
const all = ordered.start();
await ordered.ensure('journal');
await ordered.ensure('trpg');
assert.equal(transactionStarts, 0);
assert.equal(ordered.getStatus().components.checkpoint.state, 'recovering');
finishCheckpoint({ initialized: true });
await all;
assert.equal(transactionStarts, 1);
assert.equal(ordered.getStatus().state, 'ready');

let now = 0;
let healthy = false;
const gated = createRuntimeReadiness([
  ['checkpoint', async () => healthy ? { initialized: true } : { reconciliation_required: 1 }],
  ['transaction', async () => { transactionStarts++; return { health: 'healthy' }; }],
], null, { clock: () => now, dependencies: { transaction: ['checkpoint'] } });
assert.equal((await gated.ensure('transaction')).health, 'degraded');
assert.equal(transactionStarts, 1);
now = 30_001;
healthy = true;
assert.equal((await gated.ensure('transaction')).health, 'healthy');
assert.equal(transactionStarts, 2);
assert.throws(() => createRuntimeReadiness([
  ['checkpoint', async () => ({})], ['transaction', async () => ({})],
], null, { dependencies: { checkpoint: ['transaction'] } }), /INVALID_RUNTIME_COMPONENT_DEPENDENCY/u);

console.log('MCP runtime readiness regression passed.');
