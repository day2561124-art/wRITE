import test from 'node:test';
import {LOCK_EXCLUSION_SOURCES} from '../../server/src/mcp-isolation-lock-exclusion.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {ISOLATION_RESOLUTION,isolationHash,isolationJson,validateIsolationResolution} from '../../server/src/mcp-workspace-isolation-resolution.mjs';
const exec=promisify(execFile),moduleRoot=fileURLToPath(new URL('../../',import.meta.url));
const ws='dev_workspace_1234567890abcdef12345678',wid='dev_workstream_20261015-102435_8d5d489be767';
const urls=Object.fromEntries(['mcp-development-journal-tools','mcp-operation-reconciliation-context','mcp-workstream-prewrite-failure'].map(n=>[n,new URL('../../server/src/'+n+'.mjs',import.meta.url).href]));
const git=async(root,...args)=>(await exec(process.platform==='win32'?'git.exe':'git',args,{cwd:root,windowsHide:true,timeout:20000})).stdout.trim();
const authority=(input,body)=>body({assertExclusive:async()=>true,authorityReceipt:{approval_sha256:'a'.repeat(64),audit_reference:'fixture-host-approval-ONLY',
 decision_id:input.decision_id,operation_id:input.operation_id,scope:ISOLATION_RESOLUTION,terminal_hash:input.expected_terminal_hash,observation_sha256:input.observation_sha256}});
const untilFile=async file=>{for(let i=0;i<200;i++){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}await new Promise(r=>setTimeout(r,25));}throw Error('PRODUCER_NOT_READY');};
async function fixture(t,{kind='no_effect',live=false}={}){
 // Keep real Git worktrees below Windows Git's path bound even inside the wire fixture.
 const parent=path.resolve(os.tmpdir());
 const container=await mkdtemp(path.join(parent,'pi-iso-')),root=path.join(container,'project');await mkdir(root);
 t.after(async()=>{assert.equal(path.dirname(path.resolve(container)),parent);assert.match(path.basename(container),/^pi-iso-[A-Za-z0-9]+$/);await rm(container,{recursive:true,force:true});});
 await git(root,'init','-q','-b','main');await writeFile(path.join(root,'seed.txt'),'fixture\n');await git(root,'add','seed.txt');
 await git(root,'-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');const head=await git(root,'rev-parse','HEAD');
 for(const name of ['mcp-development-workstream-tools','file-transactions']){
  const target=path.join(root,'server/src',name+'.mjs');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,await readFile(path.join(moduleRoot,'server/src',name+'.mjs')));
 }
 const registryFile=path.join(root,'data/outputs/logs/development_runtime/workstream_registry.json');
 const created=new Date().toISOString();
 let record={workstream_id:wid,schema_version:1,revision:kind==='prewrite_stale'?2:1,label:'isolated recovery fixture',purpose:'primary',mode:'shared',state:'active',
  created_at:created,updated_at:created,last_activity_at:created,parent_workstream_id:null,depends_on:[],declared_scope:[],metadata:{},
  workspace_id:'dev_workspace_shared_repository_v1',base_head:head,workspace:null};
 let registry;
 const saveRegistry=async()=>{const body={schema_version:1,revision:1,updated_at:new Date().toISOString(),workstreams:[record]};registry={...body,checksum_sha256:isolationHash(JSON.stringify(body))};
  await mkdir(path.dirname(registryFile),{recursive:true});await writeFile(registryFile,JSON.stringify(registry));};
 await saveRegistry();
 const storageRoot=path.join(root,'journal'),startFile=path.join(root,'producer-start.json'),finishFile=path.join(root,'producer-finish');
 const request={workstream_id:wid,expected_workstream_revision:1};
 const program=`import {readFile,writeFile} from 'node:fs/promises';
 import {createDevOperationJournalService,canonicalJson} from ${JSON.stringify(urls['mcp-development-journal-tools'])};
 import {runWithMcpOperationReconciliationContext,fingerprintMcpMutationRequest} from ${JSON.stringify(urls['mcp-operation-reconciliation-context'])};
 import {markIsolationBeforeDispatch,readIsolationBeforeDispatchProof} from ${JSON.stringify(urls['mcp-workstream-prewrite-failure'])};
 const j=createDevOperationJournalService({storageRoot:${JSON.stringify(storageRoot)}}),request=${JSON.stringify(request)};
 await runWithMcpOperationReconciliationContext({tool_name:'dev_workspace_create_isolated',reconciliation_key:'original-isolate-fixture-key',request_fingerprint_sha256:fingerprintMcpMutationRequest('dev_workspace_create_isolated',request)},async()=>{
 const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_workspace_create_isolated',workstream_id:request.workstream_id,workspace_id:'dev_workspace_shared_repository_v1'});
 if(${JSON.stringify(kind)}==='no_effect'){
 const p=readIsolationBeforeDispatchProof(markIsolationBeforeDispatch(new Error('injected audit preparation failure')));
 const c=await j.begin({operation_type:'workspace_isolation_dispatch_barrier',tool_name:'mcp.isolation.before_dispatch',result:{pre_dispatch_record:canonicalJson(p)}});
 await j.complete(c.operation_id,{result:{pre_dispatch_record:canonicalJson(p),outcome:'no_effect_observed'}});
 }
 await writeFile(${JSON.stringify(startFile)},JSON.stringify({a,event:(await j.verify()).events[0],pid:process.pid}));
 for(;;){try{await readFile(${JSON.stringify(finishFile)});break;}catch{}await new Promise(r=>setTimeout(r,10));}
 const terminal=await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 console.log(JSON.stringify({a,terminal}));});`;
 let producerError;const producer=exec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:20000,maxBuffer:1024*1024});producer.catch(e=>{producerError=e;});
 const started=await untilFile(startFile);if(producerError)throw producerError;
 const finish=async()=>{await writeFile(finishFile,'finish');return JSON.parse((await producer).stdout);};
 t.after(async()=>{try{await writeFile(finishFile,'finish');await producer;}catch{}});
 if(kind==='completed'){
  const worktree=path.join(container,'.writer-workbench-worktrees',ws),branch='dev-ws/'+ws.slice(14);
  await mkdir(path.dirname(worktree),{recursive:true});await git(root,'worktree','add','-b',branch,worktree,head);await git(root,'worktree','lock','--reason','fixture owned workspace',worktree);
  record={...record,revision:2,mode:'isolated',workspace_id:ws,workspace:{workspace_id:ws,workstream_id:wid,state:'active',locked:true,base_head:head,branch_name:branch,
   workspace_type:'isolated_worktree',repository_root:'.',worktree_relative_path:'../.writer-workbench-worktrees/'+ws,
   created_at:created,updated_at:new Date().toISOString(),lock_reason:'fixture owned workspace',git_worktree_head:head,revision:2,last_error:null}};await saveRegistry();
  const now=new Date().toISOString(),id=now.replaceAll('-','').replace('T','-').replaceAll(':','').replace('.','').slice(0,18);
  const txId='TX-'+id+'-0000AAAA',ackId='TX-'+id+'-0000BBBB',auditId='MCP-AUDIT-fixture';
  const dir=path.join(root,'data/outputs/logs/transactions');await mkdir(dir,{recursive:true});
  const tx={transaction_id:txId,name:'dev-workstream-registry',status:'committed',pid:started.pid,started_at:now,completed_at:now,
   metadata:{tool:'dev_workspace_create_isolated'},affected_paths:['data/outputs/logs/development_runtime/workstream_registry.json'],operations:[{type:'write',path:'data/outputs/logs/development_runtime/workstream_registry.json'}],rollback_available:true};
  await writeFile(path.join(dir,txId+'.json'),JSON.stringify(tx));
  const response={...record.workspace,registry_revision:registry.revision,workstream_revision:record.revision,isolated_from_committed_state_only:true,main_uncommitted_changes_copied:false};
  const audit={audit_id:auditId,created_at:now,tool_name:'dev_workspace_create_isolated',status:'completed',input_summary:{workstream_id:{type:'string',length:wid.length,sha256:isolationHash(wid),preview:wid},expected_workstream_revision:1},result:{is_error:false,text_sha256:isolationHash(JSON.stringify(response,null,2))}};
  await writeFile(path.join(root,'data/outputs/logs/mcp_tool_audit.jsonl'),JSON.stringify(audit)+'\n');
  await writeFile(path.join(dir,ackId+'.json'),JSON.stringify({transaction_id:ackId,name:'mcp-audit-complete',status:'committed',pid:started.pid,started_at:now,completed_at:now,metadata:{audit_id:auditId,tool_name:'dev_workspace_create_isolated'}}));
 }
 if(kind==='prewrite_stale'){
  const now=new Date().toISOString(),id=now.replaceAll('-','').replace('T','-').replaceAll(':','').replace('.','').slice(0,18);
  const txId='TX-'+id+'-0000CCCC',ackId='TX-'+id+'-0000DDDD',auditId='MCP-AUDIT-stale-fixture';
  const dir=path.join(root,'data/outputs/logs/transactions');await mkdir(dir,{recursive:true});
  const message='stale workstream revision: expected 1, current 2.';
  const tx={transaction_id:txId,name:'dev-workstream-registry',status:'rolled_back',pid:started.pid,started_at:now,completed_at:now,
   metadata:{tool:'dev_workspace_create_isolated',runtime:'development_workstream_registry'},affected_paths:['data/outputs/logs/development_runtime/workstream_registry.json'],
   error:message,rollback_errors:[],rollback_available:true};
  await writeFile(path.join(dir,txId+'.json'),JSON.stringify(tx));
  const audit={audit_id:auditId,created_at:started.event.timestamp,tool_name:'dev_workspace_create_isolated',status:'tool_error',
   input_summary:{workstream_id:{type:'string',length:wid.length,sha256:isolationHash(wid),preview:wid},expected_workstream_revision:1},
   result:{is_error:true,text_sha256:isolationHash(message)}};
  await writeFile(path.join(root,'data/outputs/logs/mcp_tool_audit.jsonl'),JSON.stringify(audit)+'\n');
  await writeFile(path.join(dir,ackId+'.json'),JSON.stringify({transaction_id:ackId,name:'mcp-audit-complete',status:'committed',pid:started.pid,started_at:now,completed_at:now,metadata:{audit_id:auditId,tool_name:'dev_workspace_create_isolated'}}));
 }
 const options={storageRoot,resolutionEvidenceRoot:root,isolationRecoveryAuthority:authority},j=createDevOperationJournalService(options);
 const selector={operation_id:started.a.operation_id,expected_terminal_hash:null,request_fingerprint_sha256:started.event.request_fingerprint_sha256,original_request:request,
  decision_owner:'GPT',decision_id:'gpt-isolate-fixture-recovery',reason:'Reviewed isolated fixture evidence, never production'};
 const done=live?null:await finish();if(done)selector.expected_terminal_hash=done.terminal.event_hash;
 if(kind==='lock_exclusion'){
  const tx={transaction_id:'TX-20261015-104608810-0000EEEE',name:'dev-workstream-registry',status:'committed',pid:started.pid+100000,
   started_at:new Date(Date.parse(started.event.timestamp)-1000).toISOString(),completed_at:new Date(Date.parse(started.event.timestamp)+1).toISOString(),
   metadata:{tool:'dev_workspace_create_isolated',runtime:'development_workstream_registry'},affected_paths:['data/outputs/logs/development_runtime/workstream_registry.json'],
   operations:[{type:'write',path:'data/outputs/logs/development_runtime/workstream_registry.json'}],rollback_available:true};
  const transaction_text=JSON.stringify(tx),from=new Date(Date.parse(tx.started_at)-1000).toISOString(),to=new Date(Date.parse(done.terminal.timestamp)+1000).toISOString();
  const evidence={operation_id:started.a.operation_id,terminal_hash:done.terminal.event_hash,hostname:started.event.diagnostic.hostname,owner_pid:started.pid,
   transaction_text,transaction_sha256:isolationHash(transaction_text),
   request_line:JSON.stringify({kind:'request',time:started.event.timestamp,name:'dev_workspace_create_isolated',args:request,meta:{reconciliation_key:'original-isolate-fixture-key'}}),
   error_line:JSON.stringify({kind:'mutation_transport_error',code:'RPC_ERROR',message:'Could not acquire the project write lock within 15 seconds.',time:done.terminal.timestamp,attempt:1}),
   sources:Object.entries(LOCK_EXCLUSION_SOURCES).map(([path,normalized_sha256])=>({path,normalized_sha256})),
   clock:{protocol:'windows-event-log-clock-coverage/v1',hostname:started.event.diagnostic.hostname,from,to,logs:['System','Microsoft-Windows-Time-Service/Operational'].map(name=>({name,enabled:true,oldest_record_id:1,newest_record_id:100,oldest_utc:from,newest_utc:to,error:null,events:[]}))}};
  const txDirectory=path.join(root,'data/outputs/logs/transactions');await mkdir(txDirectory,{recursive:true});
  const stamp=tx.started_at.replaceAll('-','').replace('T','-').replaceAll(':','').replace('.','').replace('Z','');
  await writeFile(path.join(txDirectory,'TX-'+stamp+'-0000EEEE.json'),transaction_text);
  const file=path.join(root,'data/outputs/logs/development_runtime/recovery_evidence',done.terminal.event_hash+'.json');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(evidence));
 }

 const f={container,root,storageRoot,options,j,selector,started,finish,record,registryFile,saveRegistry,producer};
 f.proposal=async()=>{const inspected=await j.inspectWorkspaceIsolationMutation(selector);return {...selector,resolution_kind:ISOLATION_RESOLUTION,observation:inspected.observation,observation_sha256:inspected.observation_sha256};};
 return f;
}
test('no_effect requires a positive durable pre-dispatch witness, appends once and reopens healthy',async t=>{
 const f=await fixture(t),p=await f.proposal();assert.equal(p.observation.classification,'no_effect');
 const names=await readdir(path.join(f.storageRoot,'events')),before=await Promise.all(names.map(n=>readFile(path.join(f.storageRoot,'events',n))));
 await f.j.resolveWorkspaceIsolationMutation(p);const cold=createDevOperationJournalService(f.options);
 assert.equal((await cold.status()).health,'healthy');assert.equal((await cold.status()).latest_sequence,6);
 const op=await cold.getOperation({operation_id:p.operation_id});assert.equal(op.reconciliation_state,'no_effect');assert.equal(op.reinitiate_requires_new_key,true);assert.equal(op.automatic_replay_allowed,false);
 assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(f.storageRoot,'events',n)))),before);
 assert.equal((await cold.resolveWorkspaceIsolationMutation(p)).reconciled,true);assert.equal((await cold.status()).latest_sequence,6);
 await assert.rejects(cold.resolveWorkspaceIsolationMutation({...p,decision_id:'gpt-different-decision'}),/RESOLUTION_DECISION_CONFLICT/);
});
test('completed requires registry, real worktree, branch, admin links and exact audited success',async t=>{
 const f=await fixture(t,{kind:'completed'}),p=await f.proposal();assert.equal(p.observation.classification,'completed');
 await f.j.resolveWorkspaceIsolationMutation(p);const op=await createDevOperationJournalService(f.options).getOperation({operation_id:p.operation_id});
 assert.equal(op.reconciliation_state,'completed');assert.equal(op.original_result.workspace_id,ws);assert.equal(op.original_result.base_head,f.record.base_head);
 assert.equal((await f.j.status()).health,'healthy');
});
test('shared, dead owner and missing trace are unknown without positive invocation evidence',async t=>{
 const f=await fixture(t,{kind:'unknown'}),p=await f.proposal();assert.equal(p.observation.classification,'unknown');
 await assert.rejects(f.j.resolveWorkspaceIsolationMutation(p),/UNSAFE_ISOLATION_RESOLUTION/);assert.equal((await f.j.status()).latest_sequence,2);
});
test('no default Host Recovery Authority exists; caller authority metadata is refused',async t=>{
 const f=await fixture(t),p=await f.proposal();const j=createDevOperationJournalService({...f.options,isolationRecoveryAuthority:undefined});
 await assert.rejects(j.resolveWorkspaceIsolationMutation(p),/HOST_RECOVERY_AUTHORITY_REQUIRED/);
 await assert.rejects(f.j.resolveWorkspaceIsolationMutation({...p,authority_receipt:{approval_sha256:'a'.repeat(64)}}),/INVALID_ISOLATION_RESOLUTION_INPUT/);
});
test('forged terminal, fingerprint, wrong workstream and forged observation never append',async t=>{
 const f=await fixture(t),p=await f.proposal();
 for(const change of [{expected_terminal_hash:'b'.repeat(64)},{request_fingerprint_sha256:'b'.repeat(64)},
  {original_request:{...p.original_request,workstream_id:'dev_workstream_20261015-102435_aaaaaaaaaaaa'}},
  {observation_sha256:'b'.repeat(64)},{observation:{...p.observation,classification:'completed'}}])
  await assert.rejects(f.j.resolveWorkspaceIsolationMutation({...p,...change}),/UNSAFE_ISOLATION/);
 assert.equal((await f.j.status()).latest_sequence,4);
});
test('live original owner is rejected even with a real failure-shaped record',async t=>{
 const f=await fixture(t,{live:true});const done=await f.finish();f.selector.expected_terminal_hash=done.terminal.event_hash;
 // A separate healthy operation created by this live test process is not a dead owner.
 const liveJournal=createDevOperationJournalService({storageRoot:path.join(f.root,'live-journal'),resolutionEvidenceRoot:f.root});
 const a=await liveJournal.begin({operation_type:'mcp_mutation',tool_name:'dev_workspace_create_isolated',workstream_id:wid,
  reconciliation_key:'live-owner-isolate-key',request_fingerprint_sha256:f.selector.request_fingerprint_sha256});
 const terminal=await liveJournal.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 await assert.rejects(liveJournal.inspectWorkspaceIsolationMutation({...f.selector,operation_id:a.operation_id,expected_terminal_hash:terminal.event_hash}),/ISOLATION_OWNER_ACTIVE/);
});
test('orphan directory, branch and Git admin residue classify partial and cannot be resolved',async t=>{
 for(const kind of ['directory','branch','admin']){
  const f=await fixture(t);if(kind==='directory')await mkdir(path.join(f.container,'.writer-workbench-worktrees','dev_workspace_'+'f'.repeat(24)),{recursive:true});
  if(kind==='branch')await git(f.root,'branch','dev-ws/'+'f'.repeat(24));
  if(kind==='admin'){const dir=path.join(f.root,'.git/worktrees/orphan');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'gitdir'),path.join(f.container,'missing/.git'));}
  const p=await f.proposal();assert.equal(p.observation.classification,'partial');await assert.rejects(f.j.resolveWorkspaceIsolationMutation(p),/UNSAFE_ISOLATION_RESOLUTION/);
 }
});
test('competing registry update between observation and apply is detected before append',async t=>{
 const f=await fixture(t),p=await f.proposal();const registry=JSON.parse(await readFile(f.registryFile,'utf8'));registry.workstreams[0].revision++;
 const {checksum_sha256,...body}=registry;await writeFile(f.registryFile,JSON.stringify({...body,checksum_sha256:isolationHash(JSON.stringify(body))}));
 await assert.rejects(f.j.resolveWorkspaceIsolationMutation(p),/ISOLATION_PHYSICAL_STATE_CHANGED/);assert.equal((await f.j.status()).latest_sequence,4);
});
for(const boundary of ['after_admission','after_completed','before_head_admission','before_head_completed'])test('actual process interruption '+boundary+' safely reopens without duplicate adjudication',async t=>{
 const f=await fixture(t),p=await f.proposal();const inputFile=path.join(f.root,'resolution.json');await writeFile(inputFile,JSON.stringify(p));
 const program=`import {readFile} from 'node:fs/promises';import {createDevOperationJournalService} from ${JSON.stringify(urls['mcp-development-journal-tools'])};
 const authority=${authority.toString().replaceAll('ISOLATION_RESOLUTION',JSON.stringify(ISOLATION_RESOLUTION))};
 const j=createDevOperationJournalService({storageRoot:${JSON.stringify(f.storageRoot)},resolutionEvidenceRoot:${JSON.stringify(f.root)},isolationRecoveryAuthority:authority,
 isolationResolutionPublicationHook:async(stage,event)=>{if(stage===${JSON.stringify(boundary)}
  ||${JSON.stringify(boundary)}==='before_head_admission'&&stage==='after_event_before_head'&&event.stage==='operation_started'
  ||${JSON.stringify(boundary)}==='before_head_completed'&&stage==='after_event_before_head'&&event.stage==='operation_completed')process.exit(73);}});
 await j.resolveWorkspaceIsolationMutation(JSON.parse(await readFile(${JSON.stringify(inputFile)},'utf8')));`;
 await assert.rejects(exec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:20000}),e=>e.code===73);
 const cold=createDevOperationJournalService(f.options);await cold.resolveWorkspaceIsolationMutation(p);
 assert.equal((await cold.status()).health,'healthy');assert.equal((await cold.status()).latest_sequence,6);
});
test('forged JSON/error text cannot mint process-local pre-handler proof',async()=>{
 const {readIsolationBeforeDispatchProof}=await import('../../server/src/mcp-workstream-prewrite-failure.mjs');
 assert.equal(readIsolationBeforeDispatchProof(Object.assign(new Error('Could not acquire the project write lock within 15 seconds.'),{protocol:'writer-workbench/isolation-before-handler/v1'})),null);
});
test('competing real worktree creation after resolution admission prevents completion',async t=>{
 const f=await fixture(t),p=await f.proposal();let created=false;
 const j=createDevOperationJournalService({...f.options,isolationResolutionPublicationHook:async stage=>{
  if(stage!=='after_admission'||created)return;created=true;
  const directory=path.join(f.container,'.writer-workbench-worktrees','dev_workspace_'+'e'.repeat(24));
  await mkdir(path.dirname(directory),{recursive:true});await git(f.root,'worktree','add','-b','dev-ws/'+'e'.repeat(24),directory,f.record.base_head);
 }});
 await assert.rejects(j.resolveWorkspaceIsolationMutation(p),/ISOLATION_PHYSICAL_STATE_CHANGED/);
 const op=await j.getOperation({operation_id:p.operation_id});assert.equal(op.reconciliation_state,'recovery_required');assert.equal(op.resolution_event_id,null);
 assert.equal((await j.status()).latest_sequence,5);
});
test('cold historical validation re-evaluates archived audit proof and tolerates later legitimate workspace edits',async t=>{
 const f=await fixture(t,{kind:'completed'}),p=await f.proposal();await f.j.resolveWorkspaceIsolationMutation(p);
 const snapshot=await f.j.verify(),proof=JSON.parse(snapshot.events.at(-1).result.resolution_record);
 const forged=structuredClone(proof);forged.observation.witness.archive.audit.result.text_sha256='f'.repeat(64);
 forged.observation_sha256=isolationHash(forged.observation);forged.authority_receipt.observation_sha256=forged.observation_sha256;
 assert.throws(()=>validateIsolationResolution(snapshot.events,forged),/UNSAFE_ISOLATION_COMPLETED/);
 await writeFile(path.join(f.container,'.writer-workbench-worktrees',ws,'seed.txt'),'later legitimate work\n');
 assert.equal((await createDevOperationJournalService(f.options).status()).health,'healthy');
 assert.equal((await createDevOperationJournalService(f.options).getOperation({operation_id:p.operation_id})).reconciliation_state,'completed');
});
test('foreign host authority receipt, unreviewed source and dangling transaction residue fail closed',async t=>{
 const f=await fixture(t),p=await f.proposal();
 const bad=createDevOperationJournalService({...f.options,isolationRecoveryAuthority:(input,body)=>authority(input,lease=>body({...lease,
  authorityReceipt:{...lease.authorityReceipt,operation_id:'dev_operation_'+'f'.repeat(32)}}))});
 await assert.rejects(bad.resolveWorkspaceIsolationMutation(p),/UNSAFE_ISOLATION_RESOLUTION/);
 const source=path.join(f.root,'server/src/file-transactions.mjs'),original=await readFile(source);
 await writeFile(source,'unreviewed source');await assert.rejects(f.j.inspectWorkspaceIsolationMutation(f.selector),/ISOLATION_UNREVIEWED_SOURCE/);await writeFile(source,original);
 const dir=path.join(f.root,'data/outputs/logs/transactions');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'.unfinished.tmp'),'partial');
 const observed=await f.j.inspectWorkspaceIsolationMutation(f.selector);assert.equal(observed.classification,'partial');assert(observed.observation.residuals.includes('transaction_residue:.unfinished.tmp'));
 assert.equal((await f.j.status()).latest_sequence,4);
});
test('concurrent identical host decisions append exactly one audited resolution pair',async t=>{
 const f=await fixture(t),p=await f.proposal();await Promise.all([f.j.resolveWorkspaceIsolationMutation(p),createDevOperationJournalService(f.options).resolveWorkspaceIsolationMutation(p)]);
 assert.equal((await f.j.status()).latest_sequence,6);assert.equal((await f.j.status()).health,'healthy');
});
test('ordinary host CLI rejects apply instead of creating recovery authority',async()=>{
 await assert.rejects(exec(process.execPath,[path.join(moduleRoot,'scripts/reconcile-workspace-isolation.mjs'),'--apply'],{windowsHide:true,timeout:10000}),
  error=>error.code===1&&error.stderr.includes('HOST_RECOVERY_AUTHORITY_REQUIRED'));
});
test('legacy isolate CAS rollback plus exact acknowledged audit proves no_effect without inventing a new dispatch marker',async t=>{
 const f=await fixture(t,{kind:'prewrite_stale'}),p=await f.proposal();assert.equal(p.observation.classification,'no_effect');
 assert.equal(p.observation.witness.kind,'prewrite_stale_cas');await f.j.resolveWorkspaceIsolationMutation(p);
 const cold=createDevOperationJournalService(f.options);assert.equal((await cold.status()).health,'healthy');
 assert.equal((await cold.getOperation({operation_id:p.operation_id})).reconciliation_state,'no_effect');
 const snapshot=await cold.verify(),proof=JSON.parse(snapshot.events.at(-1).result.resolution_record),forged=structuredClone(proof);
 forged.observation.witness.archive.transaction.error='a post-dispatch failure';forged.observation_sha256=isolationHash(forged.observation);
 forged.authority_receipt.observation_sha256=forged.observation_sha256;assert.throws(()=>validateIsolationResolution(snapshot.events,forged),/UNSAFE_ISOLATION_NO_EFFECT/);
});
test('an unaudited rollback string or missing acknowledgement never proves legacy no_effect',async t=>{
 const f=await fixture(t,{kind:'prewrite_stale'}),p=await f.proposal();
 await writeFile(path.join(f.root,'data/outputs/logs/mcp_tool_audit.jsonl'),'');
 const observed=await f.j.inspectWorkspaceIsolationMutation(f.selector);assert.notEqual(observed.classification,'no_effect');
 await assert.rejects(f.j.resolveWorkspaceIsolationMutation(p),/ISOLATION_PHYSICAL_STATE_CHANGED/);assert.equal((await f.j.status()).latest_sequence,2);
});

test('positive legacy lock exclusion recovers append-only, duplicate is stable and cold decoder revalidates',async t=>{
 const f=await fixture(t,{kind:'lock_exclusion'}),p=await f.proposal();assert.equal(p.observation.classification,'no_effect');
 assert.equal(p.observation.witness.kind,'audit_intent_lock_exclusion_v1');
 const names=await readdir(path.join(f.storageRoot,'events')),bytes=await Promise.all(names.map(n=>readFile(path.join(f.storageRoot,'events',n))));
 await f.j.resolveWorkspaceIsolationMutation(p);const cold=createDevOperationJournalService(f.options);
 assert.equal((await cold.status()).health,'healthy');assert.equal((await cold.getOperation({operation_id:p.operation_id})).reconciliation_state,'no_effect');
 assert.equal((await cold.resolveWorkspaceIsolationMutation(p)).reconciled,true);
 assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(f.storageRoot,'events',n)))),bytes);
 const proof={...p,authority_receipt:authority(p,l=>l.authorityReceipt)};proof.observation=structuredClone(proof.observation);
 proof.observation.witness.archive.clock.logs[0].events.push({id:1});proof.observation_sha256=isolationHash(proof.observation);
 proof.authority_receipt.observation_sha256=proof.observation_sha256;const history=await cold.verify();assert.throws(()=>validateIsolationResolution(history.events,proof),/UNSAFE_ISOLATION_NO_EFFECT/);
});

test('new orphan residue blocks recovery even with positive lock evidence',async t=>{
 const f=await fixture(t,{kind:'lock_exclusion'});
 await mkdir(path.join(f.container,'.writer-workbench-worktrees','dev_workspace_'+'e'.repeat(24)),{recursive:true});
 const p=await f.proposal();assert.equal(p.observation.classification,'partial');
 await assert.rejects(f.j.resolveWorkspaceIsolationMutation(p),/UNSAFE_ISOLATION_RESOLUTION/);
 assert.equal((await f.j.status()).latest_sequence,2);
});
