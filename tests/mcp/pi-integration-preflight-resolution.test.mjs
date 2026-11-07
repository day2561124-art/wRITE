import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {projectRoot} from '../../server/src/project-paths.mjs';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {reconcileDevelopmentIntegrationPreflight} from '../../scripts/reconcile-development-git-commit.mjs';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');

async function fixture(t,{pending=false,live=false}={}) {
  const parent=path.join(projectRoot,'tests/.tmp');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(path.join(parent,'preflight-resolution-'));
  t.after(async()=>{assert(root.startsWith(parent+path.sep));await rm(root,{recursive:true,force:true});});
  const runtime=path.join(root,'data/outputs/logs/development_runtime'),storageRoot=path.join(root,'journal');
  await mkdir(runtime,{recursive:true});await mkdir(path.join(root,'server/src'),{recursive:true});
  const source=await readFile(path.join(projectRoot,'server/src/mcp-development-integration-tools.mjs'));
  await writeFile(path.join(root,'server/src/mcp-development-integration-tools.mjs'),source);
  const request={workstream_id:'dev_workstream_20261107-000000_123456789012',expected_workstream_revision:3};
  const observed={workstream_id:request.workstream_id,revision:3,state:'active',updated_at:new Date(Date.now()-60000).toISOString()};
  const registry=async(name,field,records)=>{
    const payload={schema_version:1,revision:1,updated_at:observed.updated_at,[field]:records};
    const bytes=Buffer.from(JSON.stringify({...payload,checksum_sha256:sha(JSON.stringify(payload))}));
    await writeFile(path.join(runtime,name+'_registry.json'),bytes);return sha(bytes);
  };
  const registry_sha256=await registry('workstream','workstreams',[observed]);
  const integration_registry_sha256=await registry('integration','candidates',[]);
  const module=pathToFileURL(path.join(projectRoot,'server/src/mcp-development-journal-tools.mjs')).href;
  const fp=pathToFileURL(path.join(projectRoot,'server/src/mcp-operation-reconciliation-context.mjs')).href;
  const program=`import {createDevOperationJournalService} from ${JSON.stringify(module)};
    import {fingerprintMcpMutationRequest} from ${JSON.stringify(fp)};
    const j=createDevOperationJournalService({storageRoot:${JSON.stringify(storageRoot)}});
    const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_workspace_integration_preflight',
      workspace_id:'dev_workspace_shared_repository_v1',reconciliation_key:'fixture-preflight-001',
      request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_integration_preflight',${JSON.stringify(request)})});
    ${pending?"await j.begin({operation_type:'fixture_pending',tool_name:'probe'});":''}
    const terminal=await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
    console.log(JSON.stringify({a,terminal}));${live?'setTimeout(()=>{},30000);':''}`;
  let result;
  if(live){
    const child=spawn(process.execPath,['--input-type=module','-e',program],{windowsHide:true});
    t.after(()=>child.kill());result=await new Promise((resolve,reject)=>{let out='';child.stdout.on('data',b=>{out+=b;if(out.includes('\n'))resolve(JSON.parse(out));});child.on('error',reject);child.on('exit',code=>{if(!out)reject(Error('fixture producer exited '+code));});});
  }else result=JSON.parse((await exec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:15000})).stdout);
  const options={storageRoot,resolutionEvidenceRoot:root},j=createDevOperationJournalService(options);
  const input={resolution_kind:'integration_preflight_before_completion',operation_id:result.a.operation_id,
    expected_terminal_hash:result.terminal.event_hash,request_fingerprint_sha256:(await j.verify()).events[0].request_fingerprint_sha256,
    original_request:request,observed_workstream:observed,registry_sha256,integration_registry_sha256,
    source_contract_sha256:sha(source.toString('utf8').replaceAll('\r\n','\n')),
    decision_owner:'GPT',decision_id:'gpt-fixture-integration-preflight',reason:'Exact source guard rejects active revision before candidate creation'};
  return {root,runtime,j,options,input,registry};
}
async function unchanged(f,count=2){const s=await f.j.status();assert.equal(s.latest_sequence,count);assert.equal(s.health,'degraded');}

test('preflight host repair preserves prefix, appends once, reopens healthy without replay',async t=>{
  const f=await fixture(t),dir=path.join(f.options.storageRoot,'events'),names=await readdir(dir),prefix=await Promise.all(names.map(n=>readFile(path.join(dir,n))));
  assert.equal((await reconcileDevelopmentIntegrationPreflight(f.input,{journal:f.j})).verified,true);await unchanged(f);
  await reconcileDevelopmentIntegrationPreflight(f.input,{journal:f.j,apply:true});
  const reopened=createDevOperationJournalService(f.options),s=await reopened.status();assert.equal(s.health,'healthy');assert.equal(s.latest_sequence,4);
  assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(dir,n)))),prefix);
  const op=await reopened.getOperation({operation_id:f.input.operation_id});assert.equal(op.reconciliation_state,'no_effect');assert.equal(op.automatic_replay_allowed,false);assert.equal(op.events.at(-1).result.outcome,'ambiguous_effect');
  assert.equal((await reopened.resolveIntegrationPreflightMutation(f.input)).reconciled,true);
  await assert.rejects(reopened.resolveIntegrationPreflightMutation({...f.input,decision_id:'gpt-different'}),/RESOLUTION_DECISION_CONFLICT/);
});
test('preflight wrong request, terminal, fingerprint, proof, owner and fields fail closed',async t=>{
  const f=await fixture(t);
  for(const change of [{original_request:{...f.input.original_request,expected_workstream_revision:4}},{expected_terminal_hash:'b'.repeat(64)},{request_fingerprint_sha256:'b'.repeat(64)},
    {observed_workstream:{...f.input.observed_workstream,state:'completed'}},{source_contract_sha256:'b'.repeat(64)},{decision_owner:'Pi'},{force:true}]){
    await assert.rejects(f.j.resolveIntegrationPreflightMutation({...f.input,...change}),/UNSAFE_INTEGRATION_PREFLIGHT_RESOLUTION|INVALID_TERMINAL_RESOLUTION/);await unchanged(f);
  }
});
test('preflight source, registry drift and existing candidates prevent repair',async t=>{
  const f=await fixture(t),file=path.join(f.root,'server/src/mcp-development-integration-tools.mjs'),source=await readFile(file);
  await writeFile(file,'unreviewed');await assert.rejects(f.j.resolveIntegrationPreflightMutation(f.input),/UNSAFE_INTEGRATION_PREFLIGHT_RESOLUTION/);await writeFile(file,source);
  const digest=await f.registry('workstream','workstreams',[{...f.input.observed_workstream,revision:4}]);
  for(const input of [f.input,{...f.input,registry_sha256:digest}])await assert.rejects(f.j.resolveIntegrationPreflightMutation(input),/UNSAFE_INTEGRATION_PREFLIGHT_RESOLUTION/);
  await f.registry('workstream','workstreams',[f.input.observed_workstream]);
  const integration_registry_sha256=await f.registry('integration','candidates',[{workstream_id:f.input.original_request.workstream_id}]);
  await assert.rejects(f.j.resolveIntegrationPreflightMutation({...f.input,integration_registry_sha256}),/UNSAFE_INTEGRATION_PREFLIGHT_RESOLUTION/);await unchanged(f);
});
test('preflight live producer and unrelated pending work prevent admission',async t=>{
  for(const mode of [{live:true},{pending:true}]){const f=await fixture(t,mode);await assert.rejects(f.j.resolveIntegrationPreflightMutation(f.input),/RESOLUTION_OWNER_STILL_ACTIVE/);await unchanged(f,mode.pending?3:2);}
});
test('preflight concurrent identical repairs append one pair',async t=>{
  const f=await fixture(t);await Promise.all([f.j.resolveIntegrationPreflightMutation(f.input),createDevOperationJournalService(f.options).resolveIntegrationPreflightMutation(f.input)]);assert.equal((await f.j.status()).latest_sequence,4);assert.equal((await f.j.status()).health,'healthy');
});
test('preflight interrupted repair can resume only the same proof after evidence restoration',async t=>{
  const f=await fixture(t),file=path.join(f.runtime,'workstream_registry.json'),bytes=await readFile(file);let changed=false;
  const j=createDevOperationJournalService({...f.options,eventReader:async(p,encoding)=>{const raw=await readFile(p,encoding),e=JSON.parse(raw);if(!changed&&e.operation_type==='pi_terminal_resolution'&&e.stage==='operation_started'){changed=true;await writeFile(file,'{}');}return raw;}});
  await assert.rejects(j.resolveIntegrationPreflightMutation(f.input),/UNSAFE_INTEGRATION_PREFLIGHT_RESOLUTION/);assert.equal((await createDevOperationJournalService(f.options).status()).latest_sequence,3);
  await writeFile(file,bytes);const reopened=createDevOperationJournalService(f.options);await reopened.resolveIntegrationPreflightMutation(f.input);assert.equal((await reopened.status()).health,'healthy');assert.equal((await reopened.status()).latest_sequence,4);
});
