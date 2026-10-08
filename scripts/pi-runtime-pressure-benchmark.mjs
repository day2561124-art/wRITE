import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile, rm, open} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';
import {createDevCheckpointService} from '../server/src/mcp-development-checkpoint-tools.mjs';
import {canonicalJson} from '../server/src/mcp-development-journal-tools.mjs';

const exec = promisify(execFile);
const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// All writes, locks and cleanup belong to a newly created temporary fixture.
// Seed repeated valid immutable identities to model a populated deduplicated store.
export async function createPressureFixture(checkpointCount = 200) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pi-pressure-'));
  const repositoryRoot = path.join(root, 'repo'), storageRoot = path.join(root, 'checkpoints');
  await mkdir(path.join(repositoryRoot, 'tests'), {recursive:true});
  const git = args => exec(process.platform === 'win32' ? 'git.exe' : 'git', args,
    {cwd:repositoryRoot, windowsHide:true, shell:false, timeout:30000});
  await git(['init', '-b', 'main']);
  await writeFile(path.join(repositoryRoot, 'tests', 'base.txt'), 'base\n');
  await git(['add', '.']);
  await git(['-c', 'user.name=Pi pressure fixture', '-c', 'user.email=pi-pressure@example.invalid',
    '-c', 'core.hooksPath=NUL', 'commit', '-m', 'Fixture baseline']);
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const workspace_id = 'dev_workspace_' + randomUUID().replaceAll('-', '').slice(0,24);
  const workstream_id = 'dev_workstream_20261008-000000_' + randomUUID().replaceAll('-', '').slice(0,12);
  const context = {workspace_id, workstream_id, workspace_type:'isolated_worktree', root:repositoryRoot,
    branch:'main', base_head:head, current_head:head, git_dir:path.join(repositoryRoot,'.git'),
    git_common_dir:path.join(repositoryRoot,'.git'), lifecycle_state:'active', workstream_state:'active',
    healthy:true, mutation_allowed:true};
  let sequence = 0;
  const journal = {begin:async()=>({operation_id:'dev_operation_' + (++sequence).toString(16).padStart(32,'0')}),
    complete:async()=>{}, fail:async()=>{}, markDegraded:async()=>{}};
  const serviceOptions = {storageRoot, repositoryRoot, workspaceContextResolver:async()=>context, journal};
  for (let i=0;i<8;i++) await writeFile(path.join(repositoryRoot,'tests',`overlay-${i}.txt`), String(i).repeat(64*1024));
  const service = createDevCheckpointService(serviceOptions);
  const checkpoint = await service.create({workspace_id, label:'pressure fixture'});
  const identityDir = path.join(storageRoot,'manifests','checkpoints');
  const identity = JSON.parse(await readFile(path.join(identityDir, checkpoint.checkpoint_id+'.json'), 'utf8'));
  const registryPath = path.join(storageRoot,'registry.json');
  const registry = JSON.parse(await readFile(registryPath,'utf8'));
  for (let i=1;i<checkpointCount;i++) {
    const copy = {...identity, checkpoint_id:'dev_checkpoint_'+randomUUID().replaceAll('-','')};
    const {manifest_identity, ...body} = copy;
    copy.manifest_identity = hash(body);
    await writeFile(path.join(identityDir,copy.checkpoint_id+'.json'), canonicalJson(copy)+'\n');
    registry.checkpoints.push({...registry.checkpoints[0], checkpoint_id:copy.checkpoint_id,
      manifest_identity:copy.manifest_identity});
  }
  const {checksum_sha256, ...payload} = registry;
  registry.checksum_sha256 = hash(payload);
  await writeFile(registryPath, canonicalJson(registry)+'\n');
  return {root, storageRoot, repositoryRoot, serviceOptions, checkpoint, service,
    cleanup:async()=>{
      assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
      assert(path.basename(root).startsWith('pi-pressure-'));
      await rm(root,{recursive:true,force:true});
    }};
}

export async function holdFixtureLock(fixture) {
  assert.equal(path.dirname(fixture.storageRoot), fixture.root);
  const lockPath = path.join(fixture.storageRoot,'maintenance.lock');
  const handle = await open(lockPath,'wx');
  await handle.writeFile(JSON.stringify({pid:process.pid,hostname:os.hostname(),acquired_at:new Date().toISOString()}));
  return async()=>{await handle.close();await rm(lockPath);};
}

function summarize(samples) {
  const durations = samples.map(s=>s.ms).sort((a,b)=>a-b);
  const percentile = p => durations[Math.ceil(durations.length*p)-1];
  return {calls:samples.length, successes:samples.filter(s=>s.ok).length,
    success_rate:samples.filter(s=>s.ok).length/samples.length,
    p50_ms:percentile(.5), p95_ms:percentile(.95), max_ms:durations.at(-1),
    errors:samples.filter(s=>!s.ok).map(s=>s.error)};
}

export async function benchmark(factory, fixture) {
  const service = factory(fixture.serviceOptions), result = {};
  const queries = {list:()=>service.list({limit:100}),
    get:()=>service.get({checkpoint_id:fixture.checkpoint.checkpoint_id}), status:()=>service.status()};
  async function timed(query) {
    const start = performance.now();
    try {const value=await query();return {ms:performance.now()-start,
      ok:!value.health||value.health==='healthy', error:value.last_health_error??null};}
    catch(error){return {ms:performance.now()-start,ok:false,error:error.code??error.message};}
  }
  for (const [name,query] of Object.entries(queries)) {
    await query(); // Exclude first-touch initialization from warm measurements.
    const normal=[];
    for(let i=0;i<20;i++)normal.push(await timed(query));
    result[name+'_normal']=summarize(normal);
    const burst=[];
    for(let i=0;i<3;i++)burst.push(...await Promise.all(Array.from({length:8},()=>timed(query))));
    result[name+'_concurrent_8']=summarize(burst);
  }
  const contended=[];
  for(let i=0;i<20;i++) {
    const release=await holdFixtureLock(fixture);
    const waiter=timed(queries.list);
    await delay(150); await release(); contended.push(await waiter);
  }
  result.list_external_lock_150ms=summarize(contended);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const fixture = await createPressureFixture();
  try {
    const source = process.argv[2] ? await import(pathToFileURL(path.resolve(process.argv[2])).href)
      : {createDevCheckpointService};
    const result = {fixture:{checkpoints:200,distinct_contents:1,blobs:8,blob_bytes:65536},
      timestamp:new Date().toISOString(), measurements:await benchmark(source.createDevCheckpointService,fixture)};
    const output = JSON.stringify(result,null,2)+'\n';
    if(process.argv[3])await writeFile(process.argv[3],output);
    process.stdout.write(output);
  } finally {await fixture.cleanup();}
}
