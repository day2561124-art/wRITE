import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {projectRoot} from '../../server/src/project-paths.mjs';
import {createPiReliableExecutionStore} from '../../server/src/pi-reliable-execution-store.mjs';
import {createPiReliableExecutionEngine} from '../../server/src/pi-reliable-execution-engine.mjs';
import {createPiReliableMcpAdapter} from '../../server/src/pi-mcp-reliable-adapter.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {createDevOperationJournalService,canonicalJson} from '../../server/src/mcp-development-journal-tools.mjs';
import {validatePowershellEffectResolution,POWERSHELL_EFFECT_RESOLUTION} from '../../server/src/mcp-powershell-recovery-resolution.mjs';

// Hermetic, independent Journal fixtures; never load the production Journal store.
const sourceUrl=new URL('../../server/src/mcp-development-journal-tools.mjs',import.meta.url).href;
const workspaceId='dev_workspace_123456789012345678901234';
const workstreamId='dev_workstream_20261015-000000_123456789012';
const workerCode=[
 "import {writeFile} from 'node:fs/promises';",
 "import {createDevOperationJournalService} from "+JSON.stringify(sourceUrl)+";",
 "const [root,sideEffect,mode]=process.argv.slice(1);",
 "const j=createDevOperationJournalService({storageRoot:root});",
 "const parent=await j.begin({operation_type:'mcp_mutation',tool_name:'powershell_run',workspace_id:"+JSON.stringify(workspaceId)+",workstream_id:"+JSON.stringify(workstreamId)+",reconciliation_key:'fixture-shell-'+mode,request_fingerprint_sha256:'a'.repeat(64)});",
 "const child=await j.begin({operation_type:'powershell_maintenance',tool_name:'powershell_run',workspace_id:"+JSON.stringify(workspaceId)+",workstream_id:"+JSON.stringify(workstreamId)+",parent_operation_id:parent.operation_id,result:{command_sha256:'b'.repeat(64),timeout_ms:120000,elevated:false}});",
 "if(mode==='effect')await writeFile(sideEffect,'durable effect was executed\\n');",
 "console.log(JSON.stringify({parent:parent.operation_id,child:child.operation_id}));",
 "if(mode==='live')await new Promise(()=>{setInterval(()=>{},10000)});"
].join('\n');
async function fixture(t) {
 const dir=await mkdtemp(path.join(os.tmpdir(),'pi-powershell-recovery-fixture-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 return {dir,storageRoot:path.join(dir,'journal'),effect:path.join(dir,'durable-effect.txt')};
}
async function worker(f,mode) {
 const child=spawn(process.execPath,['--input-type=module','--eval',workerCode,f.storageRoot,f.effect,mode],
  {stdio:['ignore','pipe','pipe'],windowsHide:true});
 let out='',err='';
 child.stdout.on('data',d=>out+=d.toString());child.stderr.on('data',d=>err+=d.toString());
 const ready=new Promise((resolve,reject)=>{
  child.on('error',reject);
  child.stdout.on('data',()=>{
   const line=out.trim().split(/\r?\n/).find(s=>s.startsWith('{"parent":'));
   if(line){try{resolve(JSON.parse(line));}catch(e){reject(e);}}
  });
  child.on('close',code=>{if(!out.includes('{"parent":'))reject(Error('fixture ended before ready '+code+': '+err));});
 });
 const ids=await ready;
 const finished=new Promise((resolve,reject)=>{
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('fixture exit '+code+': '+err)));
 });
 return {child,ids,finished};
}
async function eventBytes(root) {
 const files=(await readdir(path.join(root,'events'))).sort();
 return Promise.all(files.map(file=>readFile(path.join(root,'events',file),'utf8')));
}
test('crashed PowerShell with detached side effect stays ambiguous through child, parent and cold reload',async t=>{
 const f=await fixture(t);const run=await worker(f,'effect');await run.finished;
 assert.equal(await readFile(f.effect,'utf8'),'durable effect was executed\n');
 const j=createDevOperationJournalService({storageRoot:f.storageRoot});
 assert.equal((await j.initialize()).health,'degraded');
 const inner=await j.getOperation({operation_id:run.ids.child});
 assert.equal(inner.events.at(-1).stage,'operation_recovered');
 assert.equal(inner.events.at(-1).result.outcome,'ambiguous_effect');
 assert.equal(inner.automatic_replay_allowed,false);
 const two=await j.initialize();assert.equal(two.health,'degraded');
 assert.equal(two.dangling_operation_count,0);
 const outer=await j.getOperation({operation_id:run.ids.parent});
 assert.equal(outer.events.at(-1).result.outcome,'ambiguous_effect');
 const before=await eventBytes(f.storageRoot);
 const cold=createDevOperationJournalService({storageRoot:f.storageRoot});
 assert.equal((await cold.initialize()).health,'degraded');
 assert.deepEqual(await eventBytes(f.storageRoot),before);
 assert.equal((await cold.getOperation({operation_id:run.ids.child})).events.length,2);
 assert.equal((await cold.getOperation({operation_id:run.ids.parent})).events.length,2);
});
test('dead PowerShell without observed artifact still cannot be called no-effect',async t=>{
 const f=await fixture(t);const run=await worker(f,'none');await run.finished;
 const j=createDevOperationJournalService({storageRoot:f.storageRoot});
 await j.initialize();await j.initialize();
 assert.equal((await j.status()).health,'degraded');
 for(const id of [run.ids.parent,run.ids.child])
  assert.equal((await j.getOperation({operation_id:id})).events.at(-1).result.outcome,'ambiguous_effect');
});
test('live PowerShell owner is never recovered while it remains alive',async t=>{
 const f=await fixture(t);const run=await worker(f,'live');
 t.after(async()=>{const settled=run.finished.catch(()=>{});if(run.child.exitCode===null)run.child.kill();await settled;});
 const j=createDevOperationJournalService({storageRoot:f.storageRoot});
 const first=await j.initialize();
 assert.equal(first.active_operation_count,2);
 assert.equal(first.dangling_operation_count,0);
 assert.equal((await j.status()).latest_sequence,2);
 const terminated=assert.rejects(run.finished,/fixture exit/);run.child.kill();await terminated;
});
test('PowerShell adjudication rejects forged event hashes and does not append',async t=>{
 const f=await fixture(t);const run=await worker(f,'effect');await run.finished;
 const j=createDevOperationJournalService({storageRoot:f.storageRoot});
 await j.initialize();await j.initialize();
 const events=(await j.verify()).events;
 const before=(await j.status()).latest_sequence;
 const fake={resolution_kind:POWERSHELL_EFFECT_RESOLUTION,operation_id:run.ids.child,
   parent_operation_id:run.ids.parent,child_operation_id:run.ids.child,
   expected_terminal_hash:'f'.repeat(64),parent_terminal_hash:'f'.repeat(64),
   child_terminal_hash:'f'.repeat(64),pi_claim_event_hash:'f'.repeat(64),
   test_started_event_hash:'f'.repeat(64),test_terminal_event_hash:'f'.repeat(64),
   request_fingerprint_sha256:'a'.repeat(64),
   profile_id:'reviewed-detached-all-gate-20261015-v1',
   decision_owner:'GPT',decision_id:'gpt-powershell-fixture',reason:'fixture'};
 assert.throws(()=>validatePowershellEffectResolution(events,fake),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);
 await assert.rejects(j.inspectPowershellEffectMutation(fake),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);
 assert.equal((await j.status()).latest_sequence,before);
});

// Real cross-process, profile-bound fixtures. Their injected `all` definition is
// one actual Node assertion in an independent tiny repository; these receipts
// are unit-test artifacts and never claim a production repository full Gate.
const psExec=promisify(execFile),psSha=b=>createHash('sha256').update(b).digest('hex');
const psUrl=name=>pathToFileURL(path.join(projectRoot,'server/src',name+'.mjs')).href;
async function psEffectFixture(t,{legacy=false,holdOwner=false}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'pi-ps-')),root=path.join(dir,'repo'),artifacts=path.join(dir,'proof'),storageRoot=path.join(dir,'journal');
 let release=async()=>{};
 t.after(async()=>{await release();assert.equal(path.dirname(dir),os.tmpdir());assert.match(path.basename(dir),/^pi-ps-/);await rm(dir,{recursive:true,force:true});});
 await mkdir(root,{recursive:true});await mkdir(artifacts);
 const git=async args=>(await psExec('git.exe',args,{cwd:root,windowsHide:true})).stdout.trim();
 await git(['init','--initial-branch=main']);await git(['config','user.name','PowerShell resolution fixture']);await git(['config','user.email','fixture@local.invalid']);
 await writeFile(path.join(root,'.gitignore'),'node_modules/\n');await writeFile(path.join(root,'effect.txt'),'before fixture\n');await git(['add','--','.gitignore','effect.txt']);await git(['commit','-m','fixture baseline']);
 const head=await git(['rev-parse','HEAD']);
 const context={root,workspace_id:workspaceId,workstream_id:workstreamId,current_head:head,base_head:head,branch:'main',workspace_type:'isolated_worktree',lifecycle_state:'active',state:'active',healthy:true,mutation_allowed:true};
 const effect='actual reviewed fixture effect\n',workerFile=path.join(artifacts,'worker.mjs'),launcherFile=path.join(artifacts,'launcher.ps1'),transferFile=path.join(artifacts,'transfer.json'),claimFile=path.join(artifacts,'claim.json'),receiptFile=path.join(artifacts,'receipt.json');
 await writeFile(transferFile,JSON.stringify({workspace_id:workspaceId,workstream_id:workstreamId,files:[{path:'effect.txt',after_sha256:psSha(effect)}]},null,2)+'\n');
 const command="node '"+workerFile.replaceAll("'","''")+"'";
 await writeFile(launcherFile,command+'\n');
 const workerProgram=`import {readFile,writeFile} from 'node:fs/promises';
 import {createHash} from 'node:crypto';
 import {createDevOperationJournalService} from ${JSON.stringify(psUrl('mcp-development-journal-tools'))};
 import {createDevTestRunner} from ${JSON.stringify(psUrl('mcp-development-test-tools'))};
 const j=createDevOperationJournalService({storageRoot:${JSON.stringify(storageRoot)}}),context=${JSON.stringify(context)};
 await writeFile(${JSON.stringify(path.join(root,'effect.txt'))},${JSON.stringify(effect)});
 const transfer=await readFile(${JSON.stringify(transferFile)}),claim={gate_id:'fixture-detached-all',workspace_id:context.workspace_id,workstream_id:context.workstream_id,pid:process.pid,started_at:new Date().toISOString(),transfer_manifest_sha256:createHash('sha256').update(transfer).digest('hex')};
 await writeFile(${JSON.stringify(claimFile)},JSON.stringify(claim));
 const runner=createDevTestRunner({journal:j,lockPath:${JSON.stringify(path.join(artifacts,'unit-all.lock'))},resultPath:${JSON.stringify(path.join(artifacts,'unit-all-last.json'))},dependencyRoot:${JSON.stringify(process.env.WRITER_WORKBENCH_DEPENDENCY_ROOT?.trim() || projectRoot)},workspaceContextResolver:async()=>context,
 suiteDefinitions:{all:{executable:process.execPath,argv:['--input-type=module','-e',${JSON.stringify("import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';assert.equal(readFileSync('effect.txt','utf8'),"+JSON.stringify(effect)+");console.log('actual independent fixture assertion PASS');")}],timeoutMs:10000}}});
 const result=await runner({suite:'all',workspace_id:context.workspace_id});
 if(!result.passed||result.exit_code!==0)throw Error('REAL_FIXTURE_ASSERTION_FAILED:'+result.stderr);
 await writeFile(${JSON.stringify(receiptFile)},JSON.stringify({gate_id:claim.gate_id,claim,full_gate_executed:true,passed:true,result}));`;
 await writeFile(workerFile,workerProgram);
 const ownerProgram=`import {readFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {hostname} from 'node:os';
 import {createDevOperationJournalService} from ${JSON.stringify(psUrl('mcp-development-journal-tools'))};
 import {createPiReliableExecutionStore} from ${JSON.stringify(psUrl('pi-reliable-execution-store'))};
 import {REQUIRED_DECISION_BOUNDARIES,hashExecutionInput} from ${JSON.stringify(psUrl('pi-execution-contract'))};
 import {fingerprintMcpMutationRequest} from ${JSON.stringify(psUrl('mcp-operation-reconciliation-context'))};
 const j=createDevOperationJournalService({storageRoot:${JSON.stringify(storageRoot)}}),context=${JSON.stringify(context)},input={command:${JSON.stringify(command)},cwd:'.',timeoutMs:120000};
 const scope={project_id:'writer_workbench',workspace_id:context.workspace_id,workstream_id:context.workstream_id},key='fixture-powershell-reviewed-0001';
 const intent={schema_version:1,intent_id:'fixture-powershell-reviewed-effect',goal:'Verify actual detached fixture effect',context:scope,constraints:['Independent unit fixture only; no production Journal'],requested_actions:[{step_id:'launch',capability:'workspace.powershell',input,depends_on:[],idempotency_key:key}],mutation_plan:[{step_id:'launch',target:context.workspace_id,input_sha256:hashExecutionInput(input),expected_change:'Execute the bounded fixture worker'}],verification:{focused:[],affected:[],full:[]},completion_conditions:['Verified fixture receipt'],permissions:{read:true,write:true,workspace_create:false,tests:true,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
 const store=createPiReliableExecutionStore({journal:j});let r=await store.admit(intent);const owner={worker_id:'pi_worker_'+'c'.repeat(32),pid:process.pid,hostname:hostname()};
 const send=async command=>r=await store.command({operation_id:r.state.operation_id,context:scope,expected_revision:r.revision,command});
 await send({type:'owner_acquired',owner,replaced_worker_id:null});for(const status of ['ADMITTED','PREPARING','EXECUTING'])await send({type:'phase_changed',status,worker_id:owner.worker_id});
 await send({type:'tool_call_started',call_id:'pi_call_'+'d'.repeat(32),step_id:'launch',worker_id:owner.worker_id});const claim=(await store.readHistory()).at(-1);
 const parent=await j.begin({operation_type:'mcp_mutation',tool_name:'powershell_run',workspace_id:context.workspace_id,workstream_id:context.workstream_id,reconciliation_key:key,request_fingerprint_sha256:fingerprintMcpMutationRequest('powershell_run',{...input,workspace_id:context.workspace_id})});
 const child=await j.begin({operation_type:'powershell_maintenance',tool_name:'powershell_run',workspace_id:context.workspace_id,workstream_id:context.workstream_id,parent_operation_id:parent.operation_id,result:{command_sha256:${JSON.stringify(psSha(command))},timeout_ms:input.timeoutMs,elevated:false}});
 await promisify(execFile)(process.execPath,[${JSON.stringify(workerFile)}],{windowsHide:true,timeout:20000,maxBuffer:1024*1024});
 for(const id of [child.operation_id,parent.operation_id]){const started=(await j.verify()).events.find(e=>e.operation_id===id&&e.stage==='operation_started');await j.recover(id,{reconciles_event_id:started.journal_event_id,result:{outcome:${JSON.stringify(legacy?'no_effect_observed':'ambiguous_effect')},reconciliation_required:${!legacy},recovered_from_started_event_id:started.journal_event_id}});}
 console.log(JSON.stringify({parent:parent.operation_id,child:child.operation_id,claim}));
 ${holdOwner?"await new Promise(resolve=>{const timer=setTimeout(resolve,20000);process.stdin.once('data',()=>{clearTimeout(timer);resolve()})});process.stdin.destroy();":''}`;
 let output;
 if(holdOwner){
  const child=spawn(process.execPath,['--input-type=module','-e',ownerProgram],{windowsHide:true,stdio:['pipe','pipe','pipe']});let text='',stderr='';child.stderr.on('data',d=>stderr+=d);
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('fixture owner exit '+code+': '+stderr)));});
  release=async()=>{if(child.exitCode===null)child.stdin.end('release\n');await exited;};
  output=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{text+=d;if(text.includes('\n'))resolve(text.trim());});child.once('error',reject);child.once('exit',code=>{if(!text.includes('\n'))reject(Error('fixture owner ended before proof '+code+': '+stderr));});});
 }else output=(await psExec(process.execPath,['--input-type=module','-e',ownerProgram],{windowsHide:true,timeout:30000,maxBuffer:2*1024*1024})).stdout.trim();
 const ids=JSON.parse(output),profile={profile_id:'reviewed-fixture-detached-all-v1',command_sha256:psSha(command),artifacts:{}};
 for(const [name,file]of Object.entries({launcher:launcherFile,worker:workerFile,transfer:transferFile,claim:claimFile,receipt:receiptFile,runner:path.join(projectRoot,'server/src/mcp-development-test-tools.mjs'),shell:path.join(projectRoot,'server/src/mcp-powershell-maintenance-tools.mjs')}))profile.artifacts[name]={path:file,sha256:psSha(await readFile(file))};
 const options={storageRoot,powershellEffectProfile:profile,resolutionContextResolver:async()=>context},j=createDevOperationJournalService(options),events=(await j.verify()).events;
 const parentStart=events.find(e=>e.operation_id===ids.parent&&e.stage==='operation_started'),parentTerminal=events.find(e=>e.operation_id===ids.parent&&e.stage==='operation_recovered'),childStart=events.find(e=>e.operation_id===ids.child&&e.stage==='operation_started'),childTerminal=events.find(e=>e.operation_id===ids.child&&e.stage==='operation_recovered'),testStart=events.find(e=>e.operation_type==='test_evidence'&&e.stage==='operation_started'),testDone=events.find(e=>e.operation_type==='test_evidence'&&e.stage==='operation_completed');
 const common={resolution_kind:POWERSHELL_EFFECT_RESOLUTION,parent_operation_id:ids.parent,child_operation_id:ids.child,parent_terminal_hash:parentTerminal.event_hash,child_terminal_hash:childTerminal.event_hash,pi_claim_event_hash:ids.claim.event_hash,test_started_event_hash:testStart.event_hash,test_terminal_event_hash:testDone.event_hash,profile_id:profile.profile_id,decision_owner:'GPT',decision_id:'gpt-reviewed-ps-fixture',reason:'Verified real independent test worker, frozen snapshot and seven pinned fixture artifacts; no shell exit code inferred.'};
 return {dir,root,storageRoot,context,profile,options,j,ids,claim:ids.claim,release,child:{...common,operation_id:ids.child,expected_terminal_hash:childTerminal.event_hash,request_fingerprint_sha256:childStart.request_fingerprint_sha256},parent:{...common,operation_id:ids.parent,expected_terminal_hash:parentTerminal.event_hash,request_fingerprint_sha256:parentStart.request_fingerprint_sha256}};
}
for(const legacy of [false,true])test('reviewed real detached fixture resolves child then parent, preserves '+(legacy?'legacy':'ambiguous')+' history and cold idempotency',async t=>{
 const f=await psEffectFixture(t,{legacy}),before=await eventBytes(f.storageRoot);
 if(legacy){assert.equal((await f.j.initialize()).health,'healthy');assert.deepEqual(await eventBytes(f.storageRoot),before);for(const id of [f.ids.child,f.ids.parent]){const op=await f.j.getOperation({operation_id:id});assert.equal(op.reconciliation_state,'recovery_required');assert.equal(op.safe_to_reinitiate,false);assert.equal(op.automatic_replay_allowed,false);}}
 const seq=(await f.j.status()).latest_sequence;
 await assert.rejects(f.j.resolvePowershellEffectMutation(f.parent),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);assert.equal((await f.j.status()).latest_sequence,seq);
 await f.j.resolvePowershellEffectMutation(f.child);await f.j.resolvePowershellEffectMutation(f.parent);
 const after=await eventBytes(f.storageRoot);assert.deepEqual(after.slice(0,before.length),before);assert.equal(after.length,before.length+4);
 const cold=createDevOperationJournalService(f.options);assert.equal((await cold.initialize()).health,'healthy');
 for(const input of [f.child,f.parent]){const op=await cold.getOperation({operation_id:input.operation_id});assert.equal(op.reconciliation_state,'completed');assert.equal(op.original_result.observed_effect,'detached_all_gate_completed');assert.equal(op.original_result.shell_exit_code_observed,false);assert.equal(Object.hasOwn(op.original_result,'exit_code'),false);assert.equal(op.automatic_replay_allowed,false);assert.equal((await cold.resolvePowershellEffectMutation(input)).reconciled,true);}
 assert.deepEqual(await eventBytes(f.storageRoot),after);await assert.rejects(cold.resolvePowershellEffectMutation({...f.child,decision_id:'gpt-conflicting-ps-decision'}),/RESOLUTION_DECISION_CONFLICT/);
});
test('positive reviewed shell receipt reconciles the original Pi call with zero dispatch',async t=>{
 const f=await psEffectFixture(t);await f.j.resolvePowershellEffectMutation(f.child);await f.j.resolvePowershellEffectMutation(f.parent);
 const p=f.claim.execution_projection,store=createPiReliableExecutionStore({journal:f.j});let dispatches=0;
 const adapter=createPiReliableMcpAdapter({callTool:async()=>{dispatches++;throw Error('unexpected replay')},resolveWorkspace:async()=>({...p.intent.context,state:'active',workspace_type:'isolated_worktree'}),queryOperation:async args=>({content:[{type:'text',text:JSON.stringify(await f.j.getOperation(args))}]})});
 const engine=createPiReliableExecutionEngine({store,adapter}),settled=await engine.reconcileOnly({operation_id:p.state.operation_id,context:p.intent.context,expected_revision:p.revision,expected_owner:p.runtime.owner});
 assert.deepEqual(settled.state.completed_steps,['launch']);assert.equal(settled.runtime.owner,null);assert.equal(settled.runtime.active_call,null);assert.equal((await engine.execute(p.intent)).state.status,'COMPLETED');assert.equal(dispatches,0);
});
test('reviewed fixture rejects forged identity/profile/context/artifact before append',async t=>{
 const f=await psEffectFixture(t),before=await eventBytes(f.storageRoot);
 for(const delta of [{expected_terminal_hash:'f'.repeat(64)},{parent_terminal_hash:'f'.repeat(64)},{request_fingerprint_sha256:'f'.repeat(64)},{profile_id:'forged-profile'}])await assert.rejects(f.j.inspectPowershellEffectMutation({...f.child,...delta}),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);
 const wrong=createDevOperationJournalService({...f.options,resolutionContextResolver:async()=>({...f.context,workstream_id:'dev_workstream_20261015-000001_123456789012'})});await assert.rejects(wrong.resolvePowershellEffectMutation(f.child),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);
 const file=f.profile.artifacts.claim.path,bytes=await readFile(file);await writeFile(file,'forged fixture artifact');await assert.rejects(f.j.resolvePowershellEffectMutation(f.child),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);await writeFile(file,bytes);
 assert.deepEqual(await eventBytes(f.storageRoot),before);await f.j.resolvePowershellEffectMutation(f.child);
});
test('reviewed physical fixture cannot adjudicate a live original owner',async t=>{
 const f=await psEffectFixture(t,{holdOwner:true}),before=await eventBytes(f.storageRoot);await assert.rejects(f.j.resolvePowershellEffectMutation(f.child),/RESOLUTION_OWNER_STILL_ACTIVE/);assert.deepEqual(await eventBytes(f.storageRoot),before);await f.release();
});
test('long typed shell resolution metadata survives serialization and cold validation',async t=>{
 const f=await psEffectFixture(t),child={...f.child,reason:'證'.repeat(1024)},parent={...f.parent,reason:'證'.repeat(1024)};
 await f.j.resolvePowershellEffectMutation(child);await f.j.resolvePowershellEffectMutation(parent);
 const cold=createDevOperationJournalService(f.options);assert.equal((await cold.status()).health,'healthy');const op=await cold.getOperation({operation_id:child.operation_id});assert.equal(JSON.parse(op.original_result.resolution_record).reason,child.reason);
});
for(const boundary of ['after_admission','after_completed','before_head_admission','before_head_completed'])test('actual PowerShell resolver process interruption '+boundary+' retains one decision',async t=>{
 const f=await psEffectFixture(t),before=await eventBytes(f.storageRoot),inputFile=path.join(f.dir,'input.json');await writeFile(inputFile,JSON.stringify(f.child));
 const program=`import {readFile} from 'node:fs/promises';import {createDevOperationJournalService} from ${JSON.stringify(psUrl('mcp-development-journal-tools'))};
 const j=createDevOperationJournalService({storageRoot:${JSON.stringify(f.storageRoot)},powershellEffectProfile:${JSON.stringify(f.profile)},resolutionContextResolver:async()=>(${JSON.stringify(f.context)}),powershellResolutionPublicationHook:async(stage,event)=>{if(stage===${JSON.stringify(boundary)}||${JSON.stringify(boundary)}==='before_head_admission'&&stage==='after_event_before_head'&&event.stage==='operation_started'||${JSON.stringify(boundary)}==='before_head_completed'&&stage==='after_event_before_head'&&event.stage==='operation_completed')process.exit(73)}});
 await j.resolvePowershellEffectMutation(JSON.parse(await readFile(${JSON.stringify(inputFile)},'utf8')));`;
 await assert.rejects(psExec(process.execPath,['--input-type=module','-e',program],{windowsHide:true,timeout:30000}),e=>e.code===73);
 const cold=createDevOperationJournalService(f.options);
 if(boundary==='after_admission'){const bytes=await eventBytes(f.storageRoot);await cold.initialize();assert.deepEqual(await eventBytes(f.storageRoot),bytes);}
 await cold.resolvePowershellEffectMutation(f.child);await cold.resolvePowershellEffectMutation(f.parent);assert.equal((await cold.status()).health,'healthy');
 const after=await eventBytes(f.storageRoot);assert.deepEqual(after.slice(0,before.length),before);assert.equal(after.length,before.length+4);const events=(await cold.verify()).events.filter(e=>e.operation_type==='pi_terminal_resolution');assert.equal(events.length,4);assert.ok(events.every(e=>e.stage!=='operation_recovered'));
});
test('physical change after shell adjudication admission fails closed and resumes same proof only after restoration',async t=>{
 const f=await psEffectFixture(t),file=path.join(f.root,'effect.txt'),bytes=await readFile(file);let changed=false;
 const j=createDevOperationJournalService({...f.options,powershellResolutionPublicationHook:async stage=>{if(stage==='after_admission'&&!changed){changed=true;await writeFile(file,'competing physical fixture change')}}});
 await assert.rejects(j.resolvePowershellEffectMutation(f.child),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION/);await writeFile(file,bytes);await createDevOperationJournalService(f.options).resolvePowershellEffectMutation(f.child);await f.j.resolvePowershellEffectMutation(f.parent);assert.equal((await f.j.status()).health,'healthy');
});
test('future outer shell recovery cannot reuse a legacy child no-effect declaration',async t=>{
 const f=await fixture(t),run=await worker(f,'none');await run.finished;const j=createDevOperationJournalService({storageRoot:f.storageRoot}),started=(await j.verify()).events.find(e=>e.operation_id===run.ids.child);
 await j.recover(run.ids.child,{reconciles_event_id:started.journal_event_id,result:{outcome:'no_effect_observed',reconciliation_required:false,recovered_from_started_event_id:started.journal_event_id}});const prefix=await eventBytes(f.storageRoot);await j.initialize();assert.deepEqual((await eventBytes(f.storageRoot)).slice(0,prefix.length),prefix);assert.equal((await j.getOperation({operation_id:run.ids.parent})).events.at(-1).result.outcome,'ambiguous_effect');
});
test('a competing active operation after shell resolution admission prevents publication',async t=>{
 const f=await psEffectFixture(t,{legacy:true});let pending;
 const j=createDevOperationJournalService({...f.options,powershellResolutionPublicationHook:async stage=>{if(stage==='after_admission'&&!pending)pending=await f.j.begin({operation_type:'fixture_pending',tool_name:'fixture.pending'});}});
 await assert.rejects(j.resolvePowershellEffectMutation(f.child),/RESOLUTION_OWNER_STILL_ACTIVE/);
 assert.equal((await f.j.verify()).events.filter(e=>e.parent_operation_id===f.child.operation_id&&e.stage==='operation_completed').length,0);
 await f.j.complete(pending.operation_id,{result:{outcome:'no_effect_observed'}});await f.j.resolvePowershellEffectMutation(f.child);await f.j.resolvePowershellEffectMutation(f.parent);assert.equal((await f.j.status()).health,'healthy');
});
test('cold historical validator rejects a hash-valid forged terminal reference in a private fixture',async t=>{
 const f=await psEffectFixture(t);await f.j.resolvePowershellEffectMutation(f.child);await f.j.resolvePowershellEffectMutation(f.parent);
 // Fault injection is confined to this owned temporary Journal, never production.
 assert.equal(path.dirname(f.dir),os.tmpdir());assert.match(path.basename(f.dir),/^pi-ps-/);
 const events=structuredClone((await f.j.verify()).events),forged={...f.parent,expected_terminal_hash:'f'.repeat(64)},record=canonicalJson(forged);
 const names=await readdir(path.join(f.storageRoot,'events'));let previous=null;
 for(const event of events){
  if(event.operation_type==='pi_terminal_resolution'&&event.parent_operation_id===f.parent.operation_id){event.result.resolution_record=record;event.request_fingerprint_sha256=psSha(record);}
  event.previous_event_hash=previous;const {event_hash,...body}=event;event.event_hash=psSha(canonicalJson(body));previous=event.event_hash;
  const name=names.find(n=>n.includes(event.journal_event_id));assert.ok(name);await writeFile(path.join(f.storageRoot,'events',name),canonicalJson(event)+'\n');
 }
 const head=JSON.parse(await readFile(path.join(f.storageRoot,'head.json'),'utf8'));head.latest_event_hash=previous;await writeFile(path.join(f.storageRoot,'head.json'),JSON.stringify(head));
 await assert.rejects(createDevOperationJournalService(f.options).verify(),/UNSAFE_POWERSHELL_EFFECT_RESOLUTION|INVALID_TERMINAL_RESOLUTION|CORRUPT/);
});
