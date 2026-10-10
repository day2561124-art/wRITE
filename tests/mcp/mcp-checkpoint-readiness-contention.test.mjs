import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDevCheckpointService } from '../../server/src/mcp-development-checkpoint-tools.mjs';
import { createRuntimeReadiness } from '../../server/src/mcp-runtime-readiness.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'checkpoint-readiness-contention-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let holder;
try {
  const storageRoot = path.join(root, 'released');
  await mkdir(storageRoot);
  const lockPath = path.join(storageRoot, 'maintenance.lock');
  holder = spawn(process.execPath, ['--input-type=module', '-e', `
    import { open, rm } from 'node:fs/promises';
    import os from 'node:os';
    const lock = process.argv[1];
    const handle = await open(lock, 'wx');
    await handle.writeFile(JSON.stringify({pid:process.pid,hostname:os.hostname()}));
    await handle.sync();
    process.stdout.write('LOCKED\\n');
    await new Promise(resolve => setTimeout(resolve, 3500));
    await handle.close(); await rm(lock);
  `, lockPath], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const exited = new Promise(resolve => holder.once('exit', (code, signal) => resolve({code, signal})));
  await new Promise((resolve, reject) => {
    holder.once('error', reject);
    holder.stdout.once('data', resolve);
    holder.once('exit', code => reject(new Error(`Lock holder exited early: ${code}`)));
  });
  let recovered = 0;
  const order = [];
  const service = createDevCheckpointService({storageRoot, listRecoveryWorkspaces: async () => { recovered++; return []; }});
  const ready = createRuntimeReadiness([
    ['journal', async () => order.push('journal')],
    ['checkpoint', async () => { order.push('checkpoint'); await service.initialize(); }],
    ['transaction', async () => order.push('transaction')],
  ]);
  const first = ready();
  first.catch(() => {});
  assert.equal(ready(), first, 'All callers must share the same ordered recovery');
  await delay(500);
  assert.deepEqual(order, ['journal', 'checkpoint']);
  assert.equal(recovered, 0, 'No recovery may run while the live holder owns the lock');
  assert.equal(ready.getStatus().state, 'running');
  const owner = JSON.parse(await readFile(lockPath, 'utf8'));
  assert.equal(owner.pid, holder.pid, 'A waiting initializer must not revoke or replace a live owner');
  await first;
  assert.equal(ready.getStatus().state, 'ready');
  assert.deepEqual(order, ['journal', 'checkpoint', 'transaction']);
  assert.equal(recovered, 1);
  assert.deepEqual(await exited, {code:0, signal:null});
  await ready();
  assert.equal(recovered, 1, 'Readiness runs once after legitimate lock release');

  const busyRoot = path.join(root, 'persistent');
  await mkdir(busyRoot);
  const busyLock = path.join(busyRoot, 'maintenance.lock');
  const ownerBytes = JSON.stringify({pid:process.pid,hostname:os.hostname()});
  await writeFile(busyLock, ownerBytes);
  const busy = createDevCheckpointService({storageRoot:busyRoot, listRecoveryWorkspaces:async()=>assert.fail('Recovery cannot run without the lock')});
  const ordinaryStarted = performance.now();
  const status = await busy.status();
  assert.equal(status.health, 'degraded');
  assert.equal(status.last_health_error_code, 'CHECKPOINT_STORE_BUSY');
  assert.ok(performance.now() - ordinaryStarted < 10000, 'Ordinary status retains the short lock budget');
  let attempts = 0;
  const failed = createRuntimeReadiness([
    ['checkpoint', async () => { attempts++; await busy.initialize(); }],
    ['transaction', async () => assert.fail('Transaction must stay blocked')],
  ]);
  const started = performance.now();
  await assert.rejects(failed(), {code:'CHECKPOINT_STORE_BUSY'});
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 29000 && elapsed < 45000, `Readiness lock wait must be bounded, observed ${elapsed}ms`);
  assert.equal(failed.getStatus().state, 'failed');
  await assert.rejects(failed(), {code:'CHECKPOINT_STORE_BUSY'});
  assert.equal(attempts, 1, 'Failed readiness stays failed rather than rerunning recovery');
  assert.equal(await readFile(busyLock, 'utf8'), ownerBytes, 'Timeout must preserve the live lock');
  console.log(JSON.stringify({result:'PASS', released_live_owner:true, ordered_recovery:true, ordinary_budget_preserved:true, sticky_failure:true, persistent_wait_ms:Math.round(elapsed)}));
} finally {
  if (holder && holder.exitCode === null && holder.signalCode === null) {
    holder.kill();
    await new Promise(resolve => holder.once('exit', resolve));
  }
  await rm(root, {recursive:true, force:true});
}
