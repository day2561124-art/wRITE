import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {projectRoot} from '../../server/src/project-paths.mjs';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {reconcileDevelopmentWorkstreamStale} from '../../scripts/reconcile-development-git-commit.mjs';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');

async function fixture(t) {
  const parent=path.join(projectRoot,'tests/.tmp');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(path.join(parent,'stale-resolution-'));
  t.after(async()=>{assert(root.startsWith(parent+path.sep));await rm(root,{recursive:true,force:true});});
  const journalRoot=path.join(root,'events'),runtime=path.join(root,'data/outputs/logs/development_runtime');
  const source=await readFile(path.join(projectRoot,'server/src/mcp-development-workstream-tools.mjs'));
  await mkdir(path.join(root,'server/src'),{recursive:true});await writeFile(path.join(root,'server/src/mcp-development-workstream-tools.mjs'),source);
  const request={workstream_id:'dev_workstream_20261009-000000_123456789012',expected_revision:16,metadata:{return_ack:'Reviewed fixture CAS'}};
  const record={workstream_id:request.workstream_id,workspace_id:'dev_workspace_123456789012345678901234',revision:17,updated_at:new Date(Date.now()-60000).toISOString()};
  const payload={schema_version:1,revision:1,updated_at:record.updated_at,workstreams:[record]};
  const registryBytes=Buffer.from(JSON.stringify({...payload,checksum_sha256:sha(JSON.stringify(payload))}));
  await mkdir(runtime,{recursive:true});await writeFile(path.join(runtime,'workstream_registry.json'),registryBytes);
  const module=pathToFileURL(path.join(projectRoot,'server/src/mcp-development-journal-tools.mjs')).href;
  const fingerprintModule=pathToFileURL(path.join(projectRoot,'server/src/mcp-operation-reconciliation-context.mjs')).href;
  // A real owned producer exits after creating immutable ambiguous events.
  // Transaction fixture facts are explicit; real production facts use inspect.
  const program=`import {createDevOperationJournalService} from ${JSON.stringify(module)};
    import {fingerprintMcpMutationRequest} from ${JSON.stringify(fingerprintModule)};
    const request=${JSON.stringify(request)};
    const j=createDevOperationJournalService({storageRoot:${JSON.stringify(journalRoot)}});
    if(Date.now()%60000>59000)await new Promise(r=>setTimeout(r,60000-Date.now()%60000));
    const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_workspace_update_workstream',reconciliation_key:'fixture-stale-resolution-0001',request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_update_workstream',request)});
    await new Promise(r=>setTimeout(r,30));
    const terminal=await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
    console.log(JSON.stringify({a,terminal}));`;
  const {stdout}=await exec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:15000});
  const {a,terminal}=JSON.parse(stdout);
  const options={storageRoot:journalRoot,resolutionEvidenceRoot:root};
  const j=createDevOperationJournalService(options),snapshot=await j.verify();const started=snapshot.events[0];
  const txAt=new Date(Date.parse(started.timestamp)+1).toISOString();
  const txId='TX-'+txAt.replaceAll('-','').replace('T','-').replaceAll(':','').replace('.','').slice(0,18)+'-0000DEAD';
  const tx={transaction_id:txId,name:'dev-workstream-registry',status:'rolled_back',pid:started.diagnostic.owner_pid,
    started_at:txAt,completed_at:new Date(Date.parse(txAt)+1).toISOString(),affected_paths:['data/outputs/logs/development_runtime/workstream_registry.json'],
    metadata:{tool:started.tool_name,runtime:'development_workstream_registry'},error:'stale workstream revision: expected 16, current 17.',rollback_errors:[],rollback_available:true};
  const txPath=path.join(root,'data/outputs/logs/transactions',txId+'.json');await mkdir(path.dirname(txPath),{recursive:true});await writeFile(txPath,JSON.stringify(tx));
  const input={resolution_kind:'workstream_stale_before_write',operation_id:a.operation_id,expected_terminal_hash:terminal.event_hash,
    request_fingerprint_sha256:started.request_fingerprint_sha256,original_request:request,transaction_id:txId,transaction_sha256:sha(JSON.stringify(tx)),
    registry_sha256:sha(registryBytes),observed_workstream_revision:17,source_contract_sha256:sha(source.toString('utf8').replaceAll('\r\n','\n')),
    decision_owner:'GPT',decision_id:'gpt-fixture-stale-cas',reason:'Exact pre-write CAS transaction and immutable request fingerprint'};
  return {j,options,input,root,tx,txPath,terminal,registryBytes};
}
async function unchanged(f) {assert.equal((await f.j.status()).latest_sequence,2);assert.equal((await f.j.status()).health,'degraded');}

test('typed host repair preserves failed prefix, appends once, reopens healthy and never replays',async t=>{
  const f=await fixture(t);const names=await readdir(path.join(f.options.storageRoot,'events'));const prefix=await Promise.all(names.map(n=>readFile(path.join(f.options.storageRoot,'events',n))));
  assert.equal((await reconcileDevelopmentWorkstreamStale(f.input,{journal:f.j})).verified,true);await unchanged(f);
  await reconcileDevelopmentWorkstreamStale(f.input,{apply:true,journal:f.j});
  const reopened=createDevOperationJournalService(f.options);assert.equal((await reopened.status()).health,'healthy');assert.equal((await reopened.status()).latest_sequence,4);
  assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(f.options.storageRoot,'events',n)))),prefix);
  const op=await reopened.getOperation({operation_id:f.input.operation_id});assert.equal(op.reconciliation_state,'no_effect');assert.equal(op.automatic_replay_allowed,false);assert.equal(op.events.at(-1).result.outcome,'ambiguous_effect');
  assert.equal((await reopened.resolveWorkstreamStaleMutation(f.input)).reconciled,true);
  await assert.rejects(reopened.resolveWorkstreamStaleMutation({...f.input,decision_id:'gpt-other'}),/RESOLUTION_DECISION_CONFLICT/);
});
test('wrong request, fingerprint, terminal or non-GPT decision never appends',async t=>{
  const f=await fixture(t);
  for(const change of [{original_request:{...f.input.original_request,metadata:{return_ack:'different'}}},{request_fingerprint_sha256:'b'.repeat(64)},{expected_terminal_hash:'b'.repeat(64)},{decision_owner:'Pi'}])await assert.rejects(f.j.resolveWorkstreamStaleMutation({...f.input,...change}),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);
  await unchanged(f);
});
test('unknown fields and broader update shapes fail closed',async t=>{
  const f=await fixture(t);await assert.rejects(f.j.resolveWorkstreamStaleMutation({...f.input,force:true}),/INVALID_TERMINAL_RESOLUTION/);
  await assert.rejects(f.j.resolveWorkstreamStaleMutation({...f.input,original_request:{...f.input.original_request,state:'active'}}),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);await unchanged(f);
});
test('changed transaction bytes and registry bytes never append',async t=>{
  const f=await fixture(t);await writeFile(f.txPath,JSON.stringify({...f.tx,error:'different'}));await assert.rejects(f.j.resolveWorkstreamStaleMutation(f.input),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);
  await writeFile(f.txPath,JSON.stringify(f.tx));await writeFile(path.join(f.root,'data/outputs/logs/development_runtime/workstream_registry.json'),'{}');await assert.rejects(f.j.resolveWorkstreamStaleMutation(f.input),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);await unchanged(f);
});
test('rollback failure, wrong producer or extra same-owner transaction is rejected',async t=>{
  const f=await fixture(t);
  for(const change of [{status:'rollback_failed',rollback_errors:['failure']},{pid:process.pid},{completed_at:'2000-01-01T00:00:00.000Z'}]) {
    const tx={...f.tx,...change};await writeFile(f.txPath,JSON.stringify(tx));await assert.rejects(f.j.resolveWorkstreamStaleMutation({...f.input,transaction_sha256:sha(JSON.stringify(tx))}),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);
  }
  await writeFile(f.txPath,JSON.stringify(f.tx));const extra=f.input.transaction_id.replace('0000DEAD','0000BEEF');await writeFile(path.join(path.dirname(f.txPath),extra+'.json'),JSON.stringify({...f.tx,transaction_id:extra}));
  await assert.rejects(f.j.resolveWorkstreamStaleMutation(f.input),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);await unchanged(f);
});
test('unreviewed source implementation is rejected',async t=>{
  const f=await fixture(t);await writeFile(path.join(f.root,'server/src/mcp-development-workstream-tools.mjs'),'unreviewed source');await assert.rejects(f.j.resolveWorkstreamStaleMutation(f.input),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);await unchanged(f);
});
test('unrelated pending work prevents resolution admission',async t=>{
  const f=await fixture(t);const fresh=createDevOperationJournalService({storageRoot:path.join(f.root,'pending')});const a=await fresh.begin({operation_type:'test_pending',tool_name:'probe'});
  const b=await readFile(path.join(f.root,'pending/events',(await readdir(path.join(f.root,'pending/events')))[0]),'utf8');const e=JSON.parse(b);const snapshot=await f.j.verify();
  e.sequence=3;e.previous_event_hash=snapshot.head.latest_event_hash;const {event_hash,...body}=e;const {canonicalJson}=await import('../../server/src/mcp-development-journal-tools.mjs');e.event_hash=sha(canonicalJson(body));
  await writeFile(path.join(f.options.storageRoot,'events','000000000003-'+e.journal_event_id+'.json'),canonicalJson(e)+'\n');await writeFile(path.join(f.options.storageRoot,'head.json'),canonicalJson({schema_version:1,latest_sequence:3,latest_event_id:e.journal_event_id,latest_event_hash:e.event_hash}));
  await assert.rejects(createDevOperationJournalService(f.options).resolveWorkstreamStaleMutation(f.input),/RESOLUTION_OWNER_STILL_ACTIVE/);
});
test('concurrent identical resolutions deduplicate to one durable pair',async t=>{
  const f=await fixture(t);await Promise.all([f.j.resolveWorkstreamStaleMutation(f.input),createDevOperationJournalService(f.options).resolveWorkstreamStaleMutation(f.input)]);assert.equal((await f.j.status()).latest_sequence,4);assert.equal((await f.j.status()).health,'healthy');
});
test('interrupted repair resumes only its admitted proof after physical facts are restored',async t=>{
  const f=await fixture(t);let changed=false;
  const registry=path.join(f.root,'data/outputs/logs/development_runtime/workstream_registry.json');
  const j=createDevOperationJournalService({...f.options,eventReader:async(p,encoding)=>{
    const raw=await readFile(p,encoding),e=JSON.parse(raw);
    if(!changed&&e.operation_type==='pi_terminal_resolution'&&e.stage==='operation_started'){changed=true;await writeFile(registry,'{}');}
    return raw;
  }});
  await assert.rejects(j.resolveWorkstreamStaleMutation(f.input),/UNSAFE_WORKSTREAM_STALE_RESOLUTION/);
  assert.equal((await createDevOperationJournalService(f.options).status()).latest_sequence,3);
  await writeFile(registry,f.registryBytes);
  const reopened=createDevOperationJournalService(f.options);await reopened.resolveWorkstreamStaleMutation(f.input);
  assert.equal((await reopened.status()).health,'healthy');assert.equal((await reopened.status()).latest_sequence,4);
});
