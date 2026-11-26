import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDevCheckpointService } from '../../server/src/mcp-development-checkpoint-tools.mjs';
import { createRuntimeReadiness } from '../../server/src/mcp-runtime-readiness.mjs';
import { projectRoot } from '../../server/src/project-paths.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Match the managed project's canonical path contract even when the hosted
// Windows TEMP directory is presented using a short-name alias.
const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'checkpoint-readiness-contention-')));
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
  const first = ready.ensure('checkpoint');
  first.catch(() => {});
  assert.equal(ready.ensure('checkpoint'), first, 'Checkpoint callers share one recovery attempt');
  await ready.ensure('journal');
  await ready.ensure('transaction');
  await delay(500);
  assert.deepEqual(order, ['checkpoint', 'journal', 'transaction']);
  assert.equal(recovered, 0, 'No recovery may run while the live holder owns the lock');
  assert.equal(ready.getStatus().state, 'running');
  const owner = JSON.parse(await readFile(lockPath, 'utf8'));
  assert.equal(owner.pid, holder.pid, 'A waiting initializer must not revoke or replace a live owner');
  await first;
  assert.equal(ready.getStatus().state, 'ready');
  assert.deepEqual(order, ['checkpoint', 'journal', 'transaction']);
  assert.equal(recovered, 1);
  assert.deepEqual(await exited, {code:0, signal:null});
  await ready.ensure('checkpoint');
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
    ['transaction', async () => ({ initialized: true })],
  ], undefined, { maxAttempts: 1 });
  const started = performance.now();
  const blocked = assert.rejects(failed.ensure('checkpoint'), {code:'CHECKPOINT_STORE_BUSY'});
  assert.deepEqual(await failed.ensure('transaction'), { initialized: true });
  await blocked;
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 29000 && elapsed < 45000, `Readiness lock wait must be bounded, observed ${elapsed}ms`);
  assert.equal(failed.getStatus().components.checkpoint.state, 'unavailable');
  await assert.rejects(failed.ensure('checkpoint'), {code:'CHECKPOINT_STORE_BUSY'});
  assert.equal(attempts, 1, 'The same component respects its cooldown');
  assert.equal(await readFile(busyLock, 'utf8'), ownerBytes, 'Timeout must preserve the live lock');
  await verifyIndependentMutation(root);
  console.log(JSON.stringify({result:'PASS', released_live_owner:true, independent_recovery:true, ordinary_budget_preserved:true, bounded_retry:true, persistent_wait_ms:Math.round(elapsed)}));
} finally {
  if (holder && holder.exitCode === null && holder.signalCode === null) {
    holder.kill();
    await new Promise(resolve => holder.once('exit', resolve));
  }
  await rm(root, {recursive:true, force:true});
}

async function verifyIndependentMutation(parent) {
  const repository = path.join(parent, 'mcp-fixture');
  await mkdir(repository);
  for (const name of ['server', 'scripts', 'package.json']) {
    await cp(path.join(projectRoot, name), path.join(repository, name), {
      recursive: true, filter: p => !['node_modules', '.tmp'].includes(path.basename(p)),
    });
  }
  await symlink(await realpath(path.join(projectRoot, 'node_modules')), path.join(repository, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir');
  const git = (...argv) => execFileSync('git', argv, { cwd: repository, stdio: 'ignore', windowsHide: true });
  git('init', '-qb', 'main');
  git('add', 'package.json');
  git('-c', 'user.name=Checkpoint fixture', '-c', 'user.email=checkpoint@example.invalid', 'commit', '-qm', 'Baseline');
  const storage = path.join(repository, 'data/outputs/logs/development_runtime/checkpoints');
  const lock = path.join(storage, 'maintenance.lock');
  const bytes = JSON.stringify({ pid: process.pid, hostname: os.hostname() });
  await mkdir(storage, { recursive: true });
  await writeFile(lock, bytes);
  const client = new Client({ name: 'checkpoint-component-isolation', version: '1' });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [path.join(repository, 'server/src/mcp-server.mjs')], cwd: repository,
      stderr: 'ignore', env: { ...process.env, MCP_TOOL_PROFILE: 'chatgpt_developer',
        WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL: '0', WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT: '0',
        WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION: '0' },
    }));
    const begun = await client.callTool({ name: 'dev_workspace_begin_workstream',
      arguments: { label: 'History during checkpoint contention' } });
    assert.equal(begun.isError, undefined);
    const { workstream_id, revision } = JSON.parse(begun.content[0].text);
    const isolated = await client.callTool({ name: 'dev_workspace_create_isolated',
      arguments: { workstream_id, expected_workstream_revision: revision } });
    assert.equal(isolated.isError, undefined, isolated.content[0].text);
    const { workspace_id } = JSON.parse(isolated.content[0].text);
    let checkpointFinished = false;
    const checkpoint = client.callTool({ name: 'dev_workspace_create_checkpoint',
      arguments: { workspace_id: 'dev_workspace_' + 'e'.repeat(24) } }, undefined, { timeout: 10_000 })
      .then(value => { checkpointFinished = true; return value; }, error => { checkpointFinished = true; return error; });
    await delay(250);
    const file = 'scripts/independent-checkpoint-proof.mjs';
    const text = 'export const proof = true;';
    const written = await client.callTool({ name: 'dev_create_file', arguments: { path: file, content: text } },
      undefined, { timeout: 5000 });
    assert.equal(written.isError, undefined);
    assert.equal(checkpointFinished, false);
    assert.equal(await readFile(path.join(repository, file), 'utf8'), text);
    assert.equal(await readFile(lock, 'utf8'), bytes);
    const history = await client.callTool({ name: 'dev_pi_execution_status',
      arguments: { workstream_id, workspace_id } }, undefined, { timeout: 7000 });
    assert.equal(history.isError, undefined, history.content[0].text);
    const page = JSON.parse(history.content[0].text);
    assert.equal(page.workstream.workstream_id, workstream_id);
    assert.deepEqual(page.operations, []);
    assert.deepEqual(page.checkpoint_status, { available: false, code: 'CHECKPOINT_STORE_BUSY' });
    assert.equal(page.checkpoints, null);
    await rm(lock);
    const unregistered = await checkpoint;
    assert(unregistered instanceof Error || unregistered.isError, 'The unregistered fixture workspace must not produce a checkpoint');
  } finally {
    await client.close();
  }
}
