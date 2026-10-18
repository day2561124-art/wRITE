import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {projectRoot} from '../../server/src/project-paths.mjs';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {validateWorkstreamCommittedResolution} from '../../server/src/mcp-workstream-committed-resolution.mjs';
import {reconcileDevelopmentWorkstreamCommitted} from '../../scripts/reconcile-development-git-commit.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
import {createPiReliableExecutionEngine} from '../../server/src/pi-reliable-execution-engine.mjs';
import {createPiReliableMcpAdapter} from '../../server/src/pi-mcp-reliable-adapter.mjs';
const exec=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const txid='TX-20261015-000000001-0000CAFE',ackid='TX-20261015-000000002-0000CAFE';
const reg='data/outputs/logs/development_runtime/workstream_registry.json',auditPath='data/outputs/logs/mcp_tool_audit.jsonl';

async function fixture(t,{holdOwner=false,pending=false}={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'committed-resolution-'));
  let releaseOwner=async()=>{};
  t.after(async()=>{await releaseOwner();assert.equal(path.dirname(root),os.tmpdir());await rm(root,{recursive:true,force:true});});
  const put=async(p,b)=>{await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),b);};
  for(const f of ['mcp-development-workstream-tools.mjs','file-transactions.mjs'])
    await put('server/src/'+f,await readFile(path.join(projectRoot,'server/src',f)));
  const journalRoot=path.join(root,'journal');
  const request={workstream_id:'dev_workstream_20261015-000000_123456789012',expected_revision:2,state:'active',declared_scope:['server/src/example.mjs']};
  const module=f=>pathToFileURL(path.join(projectRoot,'server/src',f)).href;
  const program=`import {createDevOperationJournalService} from ${JSON.stringify(module('mcp-development-journal-tools.mjs'))};
    import {createPiReliableExecutionStore} from ${JSON.stringify(module('pi-reliable-execution-store.mjs'))};
    import {REQUIRED_DECISION_BOUNDARIES,hashExecutionInput} from ${JSON.stringify(module('pi-execution-contract.mjs'))};
    import {fingerprintMcpMutationRequest} from ${JSON.stringify(module('mcp-operation-reconciliation-context.mjs'))};
    import {hostname} from 'node:os';
    const request=${JSON.stringify(request)},j=createDevOperationJournalService({storageRoot:${JSON.stringify(journalRoot)}});
    const context={project_id:'writer_workbench',workstream_id:request.workstream_id,workspace_id:'dev_workspace_123456789012345678901234'};
    const intent={schema_version:1,intent_id:'fixture-committed-workstream-update',goal:'Record a committed workstream update',context,
      constraints:['No replay'],requested_actions:[{step_id:'scope',capability:'workspace.update_workstream',input:request,depends_on:[],idempotency_key:'fixture-committed-update-0001'}],
      mutation_plan:[{step_id:'scope',target:request.workstream_id,expected_change:'Declare exact scope',input_sha256:hashExecutionInput(request)}],verification:{focused:[],affected:[],full:[]},
      completion_conditions:['Verified durable result'],permissions:{read:true,write:true,workspace_create:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
    const store=createPiReliableExecutionStore({journal:j});let r=await store.admit(intent);
    const worker={worker_id:'pi_worker_'+'a'.repeat(32),pid:process.pid,hostname:hostname()};
    const send=async command=>r=await store.command({operation_id:r.state.operation_id,context,expected_revision:r.revision,command});
    await send({type:'owner_acquired',owner:worker,replaced_worker_id:null});
    for(const status of ['ADMITTED','PREPARING','EXECUTING'])await send({type:'phase_changed',status,worker_id:worker.worker_id});
    await send({type:'tool_call_started',call_id:'pi_call_'+'b'.repeat(32),step_id:'scope',worker_id:worker.worker_id});
    const claim=(await store.readHistory()).at(-1);
    ${pending?"await j.begin({operation_type:'test_pending',tool_name:'pending_fixture'});":''}
    const admission=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_workspace_update_workstream',workspace_id:context.workspace_id,workstream_id:context.workstream_id,
      reconciliation_key:'fixture-committed-update-0001',request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_update_workstream',request)});
    const started=(await j.verify()).events.find(e=>e.journal_event_id===admission.started_event_id);
    await new Promise(r=>setTimeout(r,50));
    const terminal=await j.recover(started.operation_id,{reconciles_event_id:started.journal_event_id,
      result:{outcome:'ambiguous_effect',reconciliation_required:true,recovered_from_started_event_id:started.journal_event_id}});
    console.log(JSON.stringify({started,terminal,claim}));
    ${holdOwner?"await new Promise(resolve=>{const timer=setTimeout(resolve,20000);process.stdin.once('data',()=>{clearTimeout(timer);resolve();});});process.stdin.destroy();":''}`;
  let stdout;
  if(holdOwner) {
    const child=spawn(process.execPath,['--input-type=module','-e',program],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error('fixture owner failed: '+code)));});
    releaseOwner=async()=>{child.stdin.end('release\n');await exited;};
    stdout=await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',b=>{output+=b;if(output.includes('\n'))resolve(output.trim());});child.once('error',reject);child.once('exit',code=>{if(!output.includes('\n'))reject(new Error('fixture exited: '+code));});});
  } else ({stdout}=await exec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:20000,maxBuffer:1024*1024}));
  const {started,terminal,claim}=JSON.parse(stdout),time=n=>new Date(Date.parse(started.timestamp)+n).toISOString();
  const w={workstream_id:request.workstream_id,workspace_id:started.workspace_id,revision:3,state:'active',declared_scope:request.declared_scope,updated_at:time(2)};
  const payload={schema_version:1,revision:7,updated_at:time(2),workstreams:[w]};
  const registryBytes=Buffer.from(JSON.stringify({...payload,checksum_sha256:sha(JSON.stringify(payload))},null,2));
  await put(reg,registryBytes);
  const summary=v=>typeof v==='string'?{type:'string',length:v.length,sha256:sha(v),preview:v}:Array.isArray(v)?v.map(summary):v;
  const audit={audit_id:'MCP-AUDIT-fixture',created_at:time(0),status:'completed',tool_name:started.tool_name,
    input_summary:Object.fromEntries(Object.entries(request).map(([k,v])=>[k,summary(v)])),
    result:{is_error:false,text_sha256:sha(JSON.stringify({...w,potential_overlap:false,overlap_workstream_ids:[],registry_revision:7},null,2))}};
  const line=JSON.stringify(audit)+'\n';await put(auditPath,'prefix\n'+line);
  const tx={transaction_id:txid,name:'dev-workstream-registry',status:'committed',pid:started.diagnostic.owner_pid,started_at:time(1),completed_at:time(3),
    affected_paths:[reg],operations:[{type:'write',path:reg,previous_exists:true,previous_bytes:1,next_bytes:registryBytes.length}],
    metadata:{tool:started.tool_name,runtime:'development_workstream_registry'},rollback_available:true};
  const intentPath='data/outputs/logs/mcp_audit_intents/'+audit.audit_id+'.json';
  const ack={transaction_id:ackid,name:'mcp-audit-complete',status:'committed',pid:tx.pid,started_at:time(4),completed_at:time(5),affected_paths:[auditPath,intentPath],
    operations:[{type:'append',path:auditPath,previous_bytes:7,next_bytes:7+Buffer.byteLength(line)},
      {type:'delete',path:intentPath,previous_exists:true,next_bytes:0}],metadata:{audit_id:audit.audit_id,tool_name:started.tool_name},rollback_available:true};
  await put('data/outputs/logs/transactions/'+txid+'.json',JSON.stringify(tx));
  await put('data/outputs/logs/transactions/'+ackid+'.json',JSON.stringify(ack));
  const input={resolution_kind:'workstream_committed_update',operation_id:started.operation_id,expected_terminal_hash:terminal.event_hash,
    request_fingerprint_sha256:started.request_fingerprint_sha256,original_request:request,transaction_id:txid,transaction_sha256:sha(JSON.stringify(tx)),
    audit_transaction_id:ackid,audit_transaction_sha256:sha(JSON.stringify(ack)),audit_line_sha256:sha(line.trim()),registry_sha256:sha(registryBytes),
    pi_claim_event_hash:claim.event_hash,decision_owner:'GPT',decision_id:'gpt-fixture-committed-update',reason:'Verified committed transaction and complete audit response'};
  const options={storageRoot:journalRoot,resolutionEvidenceRoot:root},j=createDevOperationJournalService(options),events=(await j.verify()).events;
  return {root,put,input,j,options,started,terminal,claim,events,tx,ack,audit,registryBytes};
}
const unchanged=async(f,sequence)=>{const s=await f.j.status();assert.equal(s.health,'degraded');assert.equal(s.latest_sequence,sequence??f.events.at(-1).sequence);};

test('committed proof dry run, append-only resolution, fresh reopen and idempotent retry',async t=>{
  const f=await fixture(t),dir=path.join(f.options.storageRoot,'events'),names=await readdir(dir),prefix=await Promise.all(names.map(n=>readFile(path.join(dir,n))));
  assert.equal((await reconcileDevelopmentWorkstreamCommitted(f.input,{journal:f.j})).verified,true);await unchanged(f);
  await reconcileDevelopmentWorkstreamCommitted(f.input,{apply:true,journal:f.j});
  const reopened=createDevOperationJournalService(f.options),s=await reopened.status();
  assert.equal(s.health,'healthy');assert.equal(s.chain_verified,true);assert.equal(s.reconciliation_required,false);
  assert.equal(s.active_operation_count,0);assert.equal(s.dangling_operation_count,0);assert.equal(s.latest_sequence,f.events.at(-1).sequence+2);
  assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(dir,n)))),prefix);
  const op=await reopened.getOperation({operation_id:f.input.operation_id});assert.equal(op.reconciliation_state,'completed');
  assert.equal(op.automatic_replay_allowed,false);assert.equal(op.safe_to_reinitiate,false);assert.equal(op.events.at(-1).event_hash,f.terminal.event_hash);
  assert.equal((await reopened.resolveWorkstreamCommittedMutation(f.input)).reconciled,true);
  await assert.rejects(reopened.resolveWorkstreamCommittedMutation({...f.input,decision_id:'gpt-other'}),/RESOLUTION_DECISION_CONFLICT/);
});
test('wrong request, terminal, Pi claim, decision and unknown fields are rejected before append',async t=>{
  const f=await fixture(t);
  for(const change of [{original_request:{...f.input.original_request,state:'blocked'}},{expected_terminal_hash:'f'.repeat(64)},
    {pi_claim_event_hash:'f'.repeat(64)},{decision_owner:'Pi'},{transaction_id:'../escape'}])
    await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,...change}),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,force:true}),/INVALID_TERMINAL_RESOLUTION/);await unchanged(f);
});
test('failed terminal cannot be mistaken for the recovered terminal contract',async t=>{
  const f=await fixture(t);assert.throws(()=>validateWorkstreamCommittedResolution(f.events.map(e=>e.event_hash===f.terminal.event_hash?{...e,stage:'operation_failed'}:e),f.input),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);await unchanged(f);
});
test('rolled back, wrong producer, wrong byte length or invalid transaction times fail closed',async t=>{
  const f=await fixture(t);
  for(const change of [{status:'rolled_back'},{pid:process.pid},{completed_at:'2000-01-01T00:00:00Z'},
    {operations:[{...f.tx.operations[0],next_bytes:1}]},{rollback_errors:['failed']}]) {
    const tx={...f.tx,...change};await f.put('data/outputs/logs/transactions/'+txid+'.json',JSON.stringify(tx));
    await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,transaction_sha256:sha(JSON.stringify(tx))}),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);
  }await unchanged(f);
});
test('changed registry, source, audit bytes and missing transaction are rejected',async t=>{
  for(const target of [reg,'server/src/file-transactions.mjs',auditPath,'data/outputs/logs/transactions/'+txid+'.json']) {
    const f=await fixture(t);await f.put(target,'{}');await assert.rejects(f.j.resolveWorkstreamCommittedMutation(f.input));await unchanged(f);
  }
});
test('recomputed registry checksum and proof cannot replace the acknowledged response',async t=>{
  const f=await fixture(t),r=JSON.parse(f.registryBytes);r.workstreams[0].unexpected='tampered';
  const {checksum_sha256,...payload}=r;r.checksum_sha256=sha(JSON.stringify(payload));const bytes=Buffer.from(JSON.stringify(r));await f.put(reg,bytes);
  const tx={...f.tx,operations:[{...f.tx.operations[0],next_bytes:bytes.length}]};await f.put('data/outputs/logs/transactions/'+txid+'.json',JSON.stringify(tx));
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,registry_sha256:sha(bytes),transaction_sha256:sha(JSON.stringify(tx))}),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);await unchanged(f);
});
test('competing registry transaction prevents attribution even from another owner',async t=>{
  const f=await fixture(t),other='TX-'+f.started.timestamp.slice(0,10).replaceAll('-','')+'-235959999-0000BEEF';
  await f.put('data/outputs/logs/transactions/'+other+'.json',JSON.stringify({...f.tx,transaction_id:other,pid:123}));
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation(f.input),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);await unchanged(f);
});
test('audit acknowledgement offset and failure status cannot be forged by updating proof hash',async t=>{
  const f=await fixture(t);
  for(const change of [{status:'rolled_back'},{operations:[{...f.ack.operations[0],previous_bytes:0},f.ack.operations[1]]}]) {
    const ack={...f.ack,...change};await f.put('data/outputs/logs/transactions/'+ackid+'.json',JSON.stringify(ack));
    await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,audit_transaction_sha256:sha(JSON.stringify(ack))}),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);
  }await unchanged(f);
});
test('live owner cannot append a resolution',async t=>{
  const f=await fixture(t,{holdOwner:true});
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation(f.input),/RESOLUTION_OWNER_STILL_ACTIVE/);
  await unchanged(f);
});
test('unrelated pending Journal operation prevents admission',async t=>{
  const f=await fixture(t,{pending:true});
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation(f.input),/RESOLUTION_OWNER_STILL_ACTIVE/);await unchanged(f);
});
test('checksum and original terminal linkage are independently required',async t=>{
  const f=await fixture(t),r=JSON.parse(f.registryBytes);r.checksum_sha256='f'.repeat(64);
  const bytes=Buffer.from(JSON.stringify(r,null,2));await f.put(reg,bytes);
  await assert.rejects(f.j.resolveWorkstreamCommittedMutation({...f.input,registry_sha256:sha(bytes)}),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);
  assert.throws(()=>validateWorkstreamCommittedResolution(f.events.map(e=>e.event_hash===f.terminal.event_hash
    ?{...e,reconciles_event_id:'dev_journal_event_'+'f'.repeat(32)}:e),f.input),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);await unchanged(f);
});
test('concurrent identical decisions publish one resolution pair',async t=>{
  const f=await fixture(t);await Promise.all([f.j.resolveWorkstreamCommittedMutation(f.input),createDevOperationJournalService(f.options).resolveWorkstreamCommittedMutation(f.input)]);
  assert.equal((await f.j.status()).latest_sequence,f.events.at(-1).sequence+2);assert.equal((await f.j.status()).health,'healthy');
});
test('existing Pi reconcile-only consumes resolved receipt and continuation never repeats the update',async t=>{
  const f=await fixture(t);await f.j.resolveWorkstreamCommittedMutation(f.input);
  const p=f.claim.execution_projection,store=createPiReliableExecutionStore({journal:f.j});let dispatches=0;
  const adapter=createPiReliableMcpAdapter({callTool:async()=>{dispatches++;throw new Error('unexpected replay');},
    resolveWorkspace:async()=>({...p.intent.context,state:'active',workspace_type:'isolated_worktree'}),
    queryOperation:async args=>({content:[{type:'text',text:JSON.stringify(await f.j.getOperation(args))}]})});
  const engine=createPiReliableExecutionEngine({store,adapter});
  const settled=await engine.reconcileOnly({operation_id:p.state.operation_id,context:p.intent.context,expected_revision:p.revision,expected_owner:p.runtime.owner});
  assert.deepEqual(settled.state.completed_steps,['scope']);assert.equal(settled.runtime.owner,null);assert.equal(settled.runtime.active_call,null);
  const done=await engine.execute(p.intent);assert.equal(done.state.status,'COMPLETED');assert.equal(dispatches,0);
  assert.equal((await createDevOperationJournalService(f.options).status()).health,'healthy');
});
test('a later valid registry revision does not invalidate the immutable resolved history on cold reopen',async t=>{
  const f=await fixture(t);await f.j.resolveWorkstreamCommittedMutation(f.input);
  const registry=JSON.parse(f.registryBytes);registry.revision+=1;registry.workstreams[0].revision+=1;
  registry.updated_at=new Date().toISOString();registry.workstreams[0].updated_at=registry.updated_at;
  const {checksum_sha256,...payload}=registry;registry.checksum_sha256=sha(JSON.stringify(payload));
  await f.put(reg,JSON.stringify(registry));
  const fresh=createDevOperationJournalService(f.options),status=await fresh.status();
  assert.equal(status.health,'healthy');assert.equal(status.chain_verified,true);assert.equal(status.reconciliation_required,false);
  assert.equal((await fresh.getOperation({operation_id:f.input.operation_id})).reconciliation_state,'completed');
  assert.equal((await fresh.resolveWorkstreamCommittedMutation(f.input)).reconciled,true);
  assert.equal((await fresh.status()).latest_sequence,f.events.at(-1).sequence+2);
});
test('interrupted resolution resumes its same proof after facts are restored',async t=>{
  const f=await fixture(t);let changed=false;
  const j=createDevOperationJournalService({...f.options,eventReader:async(p,encoding)=>{
    const raw=await readFile(p,encoding),e=JSON.parse(raw);
    if(!changed&&e.operation_type==='pi_terminal_resolution'&&e.stage==='operation_started'){changed=true;await f.put(reg,'{}');}
    return raw;
  }});
  await assert.rejects(j.resolveWorkstreamCommittedMutation(f.input),/UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION/);
  await f.put(reg,f.registryBytes);const fresh=createDevOperationJournalService(f.options);await fresh.resolveWorkstreamCommittedMutation(f.input);
  assert.equal((await fresh.status()).health,'healthy');assert.equal((await fresh.status()).latest_sequence,f.events.at(-1).sequence+2);
});
