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
console.log('MCP runtime readiness regression passed.');
