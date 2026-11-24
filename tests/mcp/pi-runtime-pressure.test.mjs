import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {readFile, readdir, writeFile, lstat, rm} from 'node:fs/promises';
import path from 'node:path';
import {createPressureFixture, holdFixtureLock, delay} from '../../scripts/pi-runtime-pressure-benchmark.mjs';
import {DEV_CHECKPOINT_VERIFY_CONCURRENCY, DEV_CHECKPOINT_MANIFEST_CACHE_ENTRIES} from '../../server/src/mcp-development-checkpoint-tools.mjs';

async function fixture(t, count=24) {
  const f=await createPressureFixture(count);
  t.after(()=>f.cleanup());
  return f;
}

test('parallel reads retain exact deduplication statistics and public bounded shape', async t=>{
  const f=await fixture(t), s=await f.service.status();
  assert.equal(s.health,'healthy');
  assert.equal(s.active_count,24);
  assert.equal(s.physical_blob_bytes,8*65536);
  assert.equal(s.logical_checkpoint_bytes,24*8*65536);
  assert.equal(s.deduplicated_bytes_saved,23*8*65536);
  assert.equal('blobs' in s,false);
  assert.equal('reclaimable' in s,false);
  const reads=await Promise.all(Array.from({length:8},()=>f.service.get({checkpoint_id:f.checkpoint.checkpoint_id})));
  for(const read of reads)assert.equal(read.health,'healthy');
  assert.equal((await f.service.readCheckpointFile({checkpoint_id:f.checkpoint.checkpoint_id,path:'tests/overlay-0.txt'})).content,'0'.repeat(65536));
});

test('request-local reuse never hides content corruption on a later request', async t=>{
  const f=await fixture(t);
  assert.equal((await f.service.status()).health,'healthy');
  const contentPath=path.join(f.storageRoot,'manifests','content',f.checkpoint.checkpoint_content_id+'.json');
  const bytes=await readFile(contentPath);
  await writeFile(contentPath,'{}\n');
  assert.equal((await f.service.status()).health,'corrupt');
  await assert.rejects(f.service.get({checkpoint_id:f.checkpoint.checkpoint_id}),{code:'CHECKPOINT_STORE_CORRUPT'});
  await writeFile(contentPath,bytes);
  assert.equal((await f.service.status()).health,'healthy');
});

test('statistics read each identity once and each distinct content once without skipping deleted content', async t=>{
  const f=await fixture(t);
  await writeFile(path.join(f.repositoryRoot,'tests','overlay-0.txt'),'a different checkpoint\n');
  const distinct=await f.service.create({workspace_id:f.checkpoint.workspace_id});
  await f.service.deleteCheckpoint({checkpoint_id:distinct.checkpoint_id});
  const original=fs.promises.readFile;
  const identityDir=path.join(f.storageRoot,'manifests','checkpoints');
  const contentDir=path.join(f.storageRoot,'manifests','content');
  let identities=0,contents=0;
  fs.promises.readFile=async function(file,...args) {
    if(typeof file==='string') {
      if(path.dirname(file)===identityDir)identities++;
      if(path.dirname(file)===contentDir)contents++;
    }
    return original.call(this,file,...args);
  };
  syncBuiltinESMExports();
  try {
    const status=await f.service.status();
    assert.equal(status.health,'healthy');
    assert.equal(identities,25);
    assert.equal(contents,2);
  } finally {fs.promises.readFile=original;syncBuiltinESMExports();}
  await writeFile(path.join(contentDir,distinct.checkpoint_content_id+'.json'),'{}\n');
  assert.equal((await f.service.status()).health,'corrupt');
});

test('hash-valid identity under the wrong filename fails closed', async t=>{
  const f=await fixture(t), dir=path.join(f.storageRoot,'manifests','checkpoints');
  const names=(await readdir(dir)).sort();
  await writeFile(path.join(dir,names[0]),await readFile(path.join(dir,names[1])));
  await assert.rejects(f.service.list({}),{code:'CHECKPOINT_STORE_CORRUPT'});
  assert.equal((await f.service.status()).health,'corrupt');
});

test('cache overflow still verifies every identity and supports an uncached checkpoint read', async t=>{
  const count=DEV_CHECKPOINT_MANIFEST_CACHE_ENTRIES+6;
  const f=await fixture(t,count), dir=path.join(f.storageRoot,'manifests','checkpoints');
  const name=(await readdir(dir)).sort().at(-1), checkpoint_id=name.slice(0,-5);
  assert.equal((await f.service.status()).active_count,count);
  assert.equal((await f.service.get({checkpoint_id})).health,'healthy');
  await writeFile(path.join(dir,name),'{}\n');
  assert.equal((await f.service.status()).health,'corrupt');
});

test('read fanout is bounded and failure drains pending reads before releasing the maintenance lock', async t=>{
  const f=await fixture(t), dir=path.join(f.storageRoot,'manifests','checkpoints');
  const names=(await readdir(dir)).sort(), broken=path.join(dir,names[0]);
  await writeFile(broken,'{}\n');
  const original=fs.promises.readFile;
  let active=0,peak=0,completed=0,unblock;
  const gate=new Promise(resolve=>{unblock=resolve;});
  fs.promises.readFile=async function(file,...args) {
    if(typeof file!=='string'||path.dirname(file)!==dir)return original.call(this,file,...args);
    active++; peak=Math.max(peak,active);
    try {
      if(file!==broken)await gate;
      return await original.call(this,file,...args);
    } finally {active--;completed++;}
  };
  syncBuiltinESMExports();
  try {
    // Attach rejection handling immediately while the workers are paused.
    const pending=f.service.list({}).then(()=>({ok:true}),error=>({error}));
    for(let i=0;i<100 && completed===0;i++)await delay(5);
    assert(completed>0,'corrupt worker must finish');
    assert(active>0,'other workers must still be pending');
    assert.equal((await lstat(path.join(f.storageRoot,'maintenance.lock'))).isFile(),true);
    assert(peak<=DEV_CHECKPOINT_VERIFY_CONCURRENCY);
    unblock();
    assert.equal((await pending).error.code,'CHECKPOINT_STORE_CORRUPT');
    assert.equal(active,0);
    await assert.rejects(lstat(path.join(f.storageRoot,'maintenance.lock')),{code:'ENOENT'});
  } finally {unblock();fs.promises.readFile=original;syncBuiltinESMExports();}
});

test('a busy live owner is preserved and status reports degraded with a typed diagnostic', async t=>{
  const f=await fixture(t,1), release=await holdFixtureLock(f);
  try {
    const status=await f.service.status();
    assert.equal(status.health,'degraded');
    assert.equal(status.last_health_error_code,'CHECKPOINT_STORE_BUSY');
    assert.equal(status.active_count,null);
    assert.equal((await lstat(path.join(f.storageRoot,'maintenance.lock'))).isFile(),true);
    await assert.rejects(f.service.list({}),{code:'CHECKPOINT_STORE_BUSY'});
  } finally {await release();}
  assert.equal((await f.service.status()).health,'healthy');
});

test('lock metadata sync failure closes its own handle and releases only its newly acquired lock', async t=>{
  const f=await fixture(t,1), lockPath=path.join(f.storageRoot,'maintenance.lock');
  const original=fs.promises.open;
  let captured;
  fs.promises.open=async function(file,...args) {
    const handle=await original.call(this,file,...args);
    if(file===lockPath) {
      captured=handle;
      handle.sync=async()=>{throw Object.assign(new Error('fixture disk full'),{code:'ENOSPC'});};
    }
    return handle;
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(f.service.list({}),{code:'ENOSPC'});
    assert.equal(captured.fd,-1);
    await assert.rejects(lstat(lockPath),{code:'ENOENT'});
  } finally {fs.promises.open=original;syncBuiltinESMExports();}
  assert.equal((await f.service.status()).health,'healthy');
});

test('orphan identity reconciliation and a concurrent logical delete retain lifecycle consistency', async t=>{
  const f=await fixture(t,24), registryPath=path.join(f.storageRoot,'registry.json');
  // Simulate fixture-only crash after identities became durable, before registry publication.
  await rm(registryPath);
  const results=await Promise.all([
    f.service.deleteCheckpoint({checkpoint_id:f.checkpoint.checkpoint_id}),
    ...Array.from({length:4},()=>f.service.list({}))]);
  for(const read of results.slice(1))assert.equal(read.total,24);
  const detail=await f.service.get({checkpoint_id:f.checkpoint.checkpoint_id});
  assert.equal(detail.state,'deleted');
  await assert.rejects(f.service.readCheckpointFile({checkpoint_id:f.checkpoint.checkpoint_id,path:'tests/overlay-0.txt'}),{code:'CHECKPOINT_DELETED'});
  const status=await f.service.status();
  assert.equal(status.health,'healthy');
  assert.equal(status.active_count,23);
  assert.equal(status.deleted_count,1);
  assert.equal(status.reclaimable_blob_count,0);
});

test('full status hashes each physical blob once, including unreferenced blobs', async t=>{
  const f=await fixture(t), blobRoot=path.join(f.storageRoot,'blobs','sha256');
  await writeFile(path.join(f.repositoryRoot,'tests','overlay-0.txt'),'distinct retired blob\n');
  const retired=await f.service.create({workspace_id:f.checkpoint.workspace_id});
  await f.service.deleteCheckpoint({checkpoint_id:retired.checkpoint_id});
  const original=fs.promises.readFile, counts=new Map();
  fs.promises.readFile=async function(file,...args) {
    if(typeof file==='string'&&path.dirname(path.dirname(file))===blobRoot)
      counts.set(file,(counts.get(file)??0)+1);
    return original.call(this,file,...args);
  };
  syncBuiltinESMExports();
  try {
    const status=await f.service.status();
    assert.equal(status.health,'healthy');
    assert.equal(status.reclaimable_blob_count,1);
    assert.equal(counts.size,9);
    assert.deepEqual([...counts.values()],Array(9).fill(1));
  } finally {fs.promises.readFile=original;syncBuiltinESMExports();}
});

test('full status detects missing active blobs and corrupt retired-only blobs', async t=>{
  const f=await fixture(t), blobRoot=path.join(f.storageRoot,'blobs','sha256');
  const before=new Set();
  for(const prefix of await readdir(blobRoot))
    for(const name of await readdir(path.join(blobRoot,prefix)))before.add(path.join(blobRoot,prefix,name));
  await writeFile(path.join(f.repositoryRoot,'tests','overlay-0.txt'),'distinct retired blob\n');
  const retired=await f.service.create({workspace_id:f.checkpoint.workspace_id});
  await f.service.deleteCheckpoint({checkpoint_id:retired.checkpoint_id});
  const retiredFiles=[];
  for(const prefix of await readdir(blobRoot))
    for(const name of await readdir(path.join(blobRoot,prefix))) {
      const file=path.join(blobRoot,prefix,name);
      if(!before.has(file))retiredFiles.push(file);
    }
  assert.equal(retiredFiles.length,1);
  const retiredFile=retiredFiles[0], original=await readFile(retiredFile);
  const corrupted=Buffer.from(original);corrupted[0]^=1;
  await writeFile(retiredFile,corrupted);
  assert.equal((await f.service.status()).health,'corrupt');
  await writeFile(retiredFile,original);
  assert.equal((await f.service.status()).health,'healthy');
  const activeFile=[...before][0], active=await readFile(activeFile);
  await rm(activeFile);
  const missing=await f.service.status();
  assert.equal(missing.health,'corrupt');
  assert.equal(missing.last_health_error_code,'CHECKPOINT_STORE_CORRUPT');
  await writeFile(activeFile,active);
  assert.equal((await f.service.status()).health,'healthy');
});


test('production-sized shared health observation reads identities once and never caches corruption', async t=>{
  const f=await fixture(t,314);
  const identityDir=path.join(f.storageRoot,'manifests','checkpoints');
  const original=fs.promises.readFile;
  let identityReads=0;
  fs.promises.readFile=async function(file,...args) {
    if(typeof file==='string'&&path.dirname(file)===identityDir)identityReads++;
    return original.call(this,file,...args);
  };
  syncBuiltinESMExports();
  try {
    const observation=await f.service.inspectStatusWithRecoveryOwners();
    assert.equal(observation.status.health,'healthy');
    assert.equal(observation.status.checkpoint_count,314);
    assert.equal(observation.activeRecoveryOwners.size,0);
    assert.equal(identityReads,314);
    assert.equal('activeRecoveryOwners' in observation.status,false);
    const name=(await readdir(identityDir))[0];
    const file=path.join(identityDir,name), saved=await readFile(file);
    await writeFile(file,'{}\\n'.replace('\\n','\n'));
    const failed=await f.service.inspectStatusWithRecoveryOwners();
    assert.equal(failed.status.health,'corrupt');
    assert.equal(failed.activeRecoveryOwners,null);
    await writeFile(file,saved);
    assert.equal((await f.service.status()).health,'healthy');
  } finally {fs.promises.readFile=original;syncBuiltinESMExports();}
});
