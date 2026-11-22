import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';

test("a reopened Journal isolates a conflicting path while other paths and workspaces remain writable", () => fixture(async root => {
  const workspaceA = "dev_workspace_" + "1".repeat(24);
  const workspaceB = "dev_workspace_" + "2".repeat(24);
  const target = (workspaceId, file) => ({ operation_type: "filesystem_patch", tool_name: "dev_apply_patch",
    workspace_id: workspaceId, targets: [{ path: file }] });
  const original = createDevOperationJournalService({ storageRoot: root });
  const incident = await original.begin(target(workspaceA, "src/broken.txt"));
  await original.fail(incident.operation_id, { result: { outcome: "ambiguous_effect", reconciliation_required: true } });
  const before = await original.verify();

  const reopened = createDevOperationJournalService({ storageRoot: root });
  const pending = await reopened.status();
  assert.equal(pending.health, "degraded");
  assert.equal(pending.isolated_operation_count, 1);
  assert.equal(pending.isolated_operations[0].operation_id, incident.operation_id);
  await assert.rejects(reopened.begin(target(workspaceA, "src/broken.txt")), error =>
    error.code === "JOURNAL_SCOPE_ISOLATED" && error.isolation.operation_id === incident.operation_id);
  for (const args of [target(workspaceA, "src/unrelated.txt"), target(workspaceB, "src/broken.txt")]) {
    const operation = await reopened.begin(args);
    await reopened.complete(operation.operation_id);
  }
  const after = await reopened.verify();
  assert.deepEqual(after.events.slice(0, 2).map(event => event.event_hash), before.events.map(event => event.event_hash));
  assert.equal(after.isolated_operations.length, 1);
  assert.equal(after.head.latest_sequence, 6);
}));

test("a single terminal publication failure records only the affected operation as isolated", () => fixture(async root => {
  const service = createDevOperationJournalService({ storageRoot: root });
  const input = (workspace, file) => ({ operation_type: "filesystem_patch", tool_name: "dev_apply_patch",
    workspace_id: "dev_workspace_" + workspace.repeat(24), targets: [{ path: file }] });
  const began = await service.begin(input("1", "src/affected.txt"));
  const nativeOpen = fs.promises.open;
  let injected = false;
  fs.promises.open = async (file, flags, ...args) => {
    if (!injected && flags === "wx" && path.basename(String(file)).startsWith("000000000002-")) {
      injected = true;
      throw Object.assign(new Error("temporary terminal write fixture"), { code: "EIO" });
    }
    return nativeOpen(file, flags, ...args);
  };
  syncBuiltinESMExports();
  try {
    await assert.rejects(service.complete(began.operation_id), /temporary terminal write fixture/u);
  } finally {
    fs.promises.open = nativeOpen;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  await service.markDegraded("fixture terminal could not publish", began.operation_id);
  const reopened = createDevOperationJournalService({ storageRoot: root });
  const health = await reopened.status();
  assert.equal(health.writes_available, true);
  assert.equal(health.isolated_operation_count, 1);
  assert.equal((await reopened.getOperation({ operation_id: began.operation_id })).original_result.failure_code,
    "TERMINAL_PUBLICATION_FAILED");
  const independent = await reopened.begin(input("2", "src/affected.txt"));
  await reopened.complete(independent.operation_id);
  assert.equal((await reopened.status()).chain_verified, true);
}));

const input=(key,fp='a'.repeat(64))=>({operation_type:'isolated_cas_test',tool_name:'dev_test',workspace_id:'dev_workspace_shared_repository_v1',reconciliation_key:key.length<8?key+'-key':key,request_fingerprint_sha256:fp});
test('a new overlapping incident discovered before publication rejects admission',()=>fixture(async root=>{const a=createDevOperationJournalService({storageRoot:root}),b=createDevOperationJournalService({storageRoot:root});await seed(a);let count=0,injected=false,inside=false;const original=fs.promises.open;const trigger=process.env.APPEND_CAS_BASELINE==='1'?3:5;fs.promises.open=async function(file,...args){if(!inside&&String(file)===path.join(root,'append.lock')&&++count===trigger){inside=true;try{const x=await b.begin(input('ambiguous-race'));await b.fail(x.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});injected=true;}finally{inside=false;}}return original.call(this,file,...args);};syncBuiltinESMExports();try{await assert.rejects(a.begin(input('must-not-admit')),e=>e.code==='JOURNAL_SCOPE_ISOLATED');}finally{fs.promises.open=original;syncBuiltinESMExports();}assert.equal(injected,true);const v=await a.verify();assert.equal(v.events.length,4);assert.equal(v.events.some(e=>e.reconciliation_key==='must-not-admit'),false);}));
async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'pi-journal-append-cas-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
async function seed(service){const x=await service.begin(input('seed'));await service.complete(x.operation_id,{result:{outcome:'intended_effect_observed'}});}
async function trackBodyIO(root,fn){const original=fs.promises.readFile;let lockedReads=0;fs.promises.readFile=async function(file,...args){if(String(file).startsWith(path.join(root,'events')+path.sep)&&fs.existsSync(path.join(root,'append.lock')))lockedReads++;return original.call(this,file,...args);};syncBuiltinESMExports();try{await fn();}finally{fs.promises.readFile=original;syncBuiltinESMExports();}assert.equal(lockedReads,0,'immutable event bodies must be verified outside publication lock');}
test('new reconciliation key never hashes or reads event bodies under append lock',()=>fixture(async root=>{const s=createDevOperationJournalService({storageRoot:root});await seed(s);await trackBodyIO(root,async()=>{const x=await s.begin(input('new-key'));await s.complete(x.operation_id);});}));
test('terminal validation never scans event bodies under append lock',()=>fixture(async root=>{const s=createDevOperationJournalService({storageRoot:root});const target=await s.begin(input('target'));await seed(s);await trackBodyIO(root,()=>s.complete(target.operation_id));}));
test('concurrent same-key admissions produce exactly one STARTED and conflict identifies it',()=>fixture(async root=>{const a=createDevOperationJournalService({storageRoot:root}),b=createDevOperationJournalService({storageRoot:root});const result=await Promise.allSettled([a.begin(input('same-key')),b.begin(input('same-key'))]);const ok=result.filter(x=>x.status==='fulfilled'),bad=result.filter(x=>x.status==='rejected');assert.equal(ok.length,1);assert.equal(bad.length,1);assert.equal(bad[0].reason.code,'RECONCILIATION_EXISTING_OPERATION');assert.equal(bad[0].reason.operation_id,ok[0].value.operation_id);await a.complete(ok[0].value.operation_id);const v=await a.verify();assert.equal(v.events.length,2);assert.equal(v.events.filter(e=>e.reconciliation_key==='same-key'&&e.stage==='operation_started').length,1);}));
test('same key with changed fingerprint is rejected without new event',()=>fixture(async root=>{const s=createDevOperationJournalService({storageRoot:root});await seed(s);const h=await readFile(path.join(root,'head.json'),'utf8');await assert.rejects(s.begin(input('seed','b'.repeat(64))),e=>e.code==='RECONCILIATION_KEY_CONFLICT');assert.equal(await readFile(path.join(root,'head.json'),'utf8'),h);}));
test('competing terminal publications append exactly one terminal event',()=>fixture(async root=>{const a=createDevOperationJournalService({storageRoot:root}),b=createDevOperationJournalService({storageRoot:root});const x=await a.begin(input('terminal-race'));const r=await Promise.allSettled([a.complete(x.operation_id),b.complete(x.operation_id)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.match(r.find(x=>x.status==='rejected').reason.message,/already has a terminal/);assert.equal((await a.verify()).events.length,2);}));
test('corrupt immutable prefix blocks append without changing head',()=>fixture(async root=>{const s=createDevOperationJournalService({storageRoot:root});await seed(s);const names=await readdir(path.join(root,'events'));const file=path.join(root,'events',names.sort()[0]);const e=JSON.parse(await readFile(file,'utf8'));e.tool_name='tampered';await writeFile(file,JSON.stringify(e));const head=await readFile(path.join(root,'head.json'),'utf8');await assert.rejects(s.begin(input('must-deny')),/hash mismatch|changed a previously verified/);assert.equal(await readFile(path.join(root,'head.json'),'utf8'),head);}));
test('legal publication between verification and lock acquisition is caught up without lost events',()=>fixture(async root=>{const a=createDevOperationJournalService({storageRoot:root}),b=createDevOperationJournalService({storageRoot:root});await seed(a);let count=0,injected=false,inside=false;const original=fs.promises.open;const trigger=process.env.APPEND_CAS_BASELINE==='1'?3:5;fs.promises.open=async function(file,...args){if(!inside&&String(file)===path.join(root,'append.lock')&&++count===trigger){inside=true;try{const x=await b.begin(input('competing-key'));await b.complete(x.operation_id);injected=true;}finally{inside=false;}}return original.call(this,file,...args);};syncBuiltinESMExports();try{const x=await a.begin(input('target-after-race'));await a.complete(x.operation_id);}finally{fs.promises.open=original;syncBuiltinESMExports();}assert.equal(injected,true);const v=await a.verify();assert.equal(v.events.length,6);assert.equal(v.events.filter(e=>e.reconciliation_key==='competing-key'&&e.stage==='operation_started').length,1);assert.equal(v.events.filter(e=>e.reconciliation_key==='target-after-race'&&e.stage==='operation_started').length,1);}));
