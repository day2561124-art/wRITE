// Trusted-host inspection only. No caller-selected paths, Git argv, dispatch or replay.
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {controlledProcessEnvironment} from './process-control.mjs';
import {fingerprintMcpMutationRequest} from './mcp-operation-reconciliation-context.mjs';
import {isolationLockExclusion} from './mcp-isolation-lock-exclusion.mjs';

export const ISOLATION_RESOLUTION='workspace_isolation_terminal_v1';
export const ISOLATION_RESOLUTION_TOOL='pi.journal.resolve_workspace_isolation';
export const ISOLATION_BARRIER='writer-workbench/isolation-before-handler/v1';
const hex=/^[a-f0-9]{64}$/u,ws=/^dev_workspace_[a-f0-9]{24}$/u;
const txName=/^TX-\d{8}-\d{9}-[A-F0-9]{8}\.json$/u;
const registryPath='data/outputs/logs/development_runtime/workstream_registry.json';
const exec=promisify(execFile);
const gitExecutable=process.platform==='win32'?'git.exe':'git';
export const isolationJson=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)
 ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const isolationHash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:isolationJson(v)).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const registryDecoderSourceHash='e492e273eb53c5f5d9535521eea1bda209d2d58eb8de43b8be2ffd0e7509f5a1';
const sourceContracts={
 'server/src/mcp-development-workstream-tools.mjs':'1a1a5a0e6bf9ec9a1bbfd505c3b4189a79153a87b964965fba5e33ba0c189bc3',
 'server/src/file-transactions.mjs':'8245ed446c6a5731c4a48ee4edd6ae1014b1a244456e18dd3b92a1386a773845',
};
export function isolationTarget(events,input){
 const own=events.filter(e=>e.operation_id===input?.operation_id);
 const started=own.find(e=>e.stage==='operation_started'),terminal=own.find(e=>e.stage!=='operation_started');
 if(!started||!terminal||own.length!==2||started.tool_name!=='dev_workspace_create_isolated'
  ||started.operation_type!=='mcp_mutation'||!['operation_failed','operation_recovered'].includes(terminal.stage)
  ||terminal.result?.outcome!=='ambiguous_effect'||terminal.result?.reconciliation_required!==true
  ||terminal.event_hash!==input.expected_terminal_hash||started.request_fingerprint_sha256!==input.request_fingerprint_sha256
  ||started.targets.length||terminal.targets.length||started.sequence>=terminal.sequence
  ||['operation_type','tool_name','workspace_id','workstream_id','reconciliation_key','request_fingerprint_sha256']
   .some(k=>started[k]!==terminal[k])||started.diagnostic?.hostname!==terminal.diagnostic?.hostname
  ||!exact(input.original_request,['workstream_id','expected_workstream_revision'])
  ||input.original_request.workstream_id!==started.workstream_id
  ||!Number.isSafeInteger(input.original_request.expected_workstream_revision)||input.original_request.expected_workstream_revision<1
  ||fingerprintMcpMutationRequest(started.tool_name,input.original_request)!==input.request_fingerprint_sha256
  ||input.decision_owner!=='GPT'||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(input.decision_id??'')
  ||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1024)fail('UNSAFE_ISOLATION_TARGET');
 return {started,terminal};
}
export function assertIsolationOwnerDead(started,terminal){
 for(const e of [started,terminal]){
  if(e.diagnostic?.hostname!==os.hostname()||!Number.isSafeInteger(e.diagnostic.owner_pid)||e.diagnostic.owner_pid<1)fail('ISOLATION_OWNER_UNCERTAIN');
  try{process.kill(e.diagnostic.owner_pid,0);}catch(error){if(error.code==='ESRCH')continue;fail('ISOLATION_OWNER_UNCERTAIN');}
  fail('ISOLATION_OWNER_ACTIVE');
 }
}
const summarize=v=>typeof v==='string'?{type:'string',length:v.length,sha256:isolationHash(v),preview:v}:v;
function barrierWitness(events,started){
 const terminal=events.find(e=>e.operation_id===started.operation_id&&e.stage!=='operation_started');
 const children=events.filter(e=>e.parent_operation_id===started.operation_id&&e.stage==='operation_completed'
  &&e.operation_type==='workspace_isolation_dispatch_barrier');
 if(children.length!==1)return null;
 const done=children[0],admission=events.find(e=>e.operation_id===done.operation_id&&e.stage==='operation_started');
 let proof;try{proof=JSON.parse(done.result.pre_dispatch_record);}catch{return null;}
 if(!terminal||!admission||done.tool_name!=='mcp.isolation.before_dispatch'||admission.tool_name!==done.tool_name
  ||admission.parent_operation_id!==started.operation_id||admission.result.pre_dispatch_record!==done.result.pre_dispatch_record
  ||admission.sequence<=started.sequence||done.sequence<=admission.sequence||done.sequence>=terminal.sequence
  ||Date.parse(admission.timestamp)<Date.parse(started.timestamp)||Date.parse(done.timestamp)>Date.parse(terminal.timestamp)
  ||proof.protocol!==ISOLATION_BARRIER||proof.operation_id!==started.operation_id
  ||proof.reconciliation_key!==started.reconciliation_key||proof.request_fingerprint_sha256!==started.request_fingerprint_sha256
  ||proof.hostname!==started.diagnostic.hostname||proof.pid!==started.diagnostic.owner_pid
  ||done.diagnostic.owner_pid!==proof.pid||admission.diagnostic.owner_pid!==proof.pid)return null;
 return {kind:'before_handler',event_hash:done.event_hash};
}
function completedWitness(events,started,terminal,record,registry,transactions,audits,archivedResponseText=null){
 if(record.mode!=='isolated'||record.revision!==started.expected_revision+1||!record.workspace)return null;
 const response={...record.workspace,registry_revision:registry.revision,workstream_revision:record.revision,
  isolated_from_committed_state_only:true,main_uncommitted_changes_copied:false};
 const responseText=archivedResponseText??JSON.stringify(response,null,2);
 let parsed;try{parsed=JSON.parse(responseText);}catch{return null;}
 if(isolationJson(parsed)!==isolationJson(response))return null;
 const request={workstream_id:record.workstream_id,expected_workstream_revision:started.expected_revision};
 const summary=Object.fromEntries(Object.entries(request).map(([k,v])=>[k,summarize(v)]));
 const between=v=>Date.parse(v)>=Date.parse(started.timestamp)&&Date.parse(v)<=Date.parse(terminal.timestamp);
 const tx=transactions.filter(t=>t.record.name==='dev-workstream-registry'&&t.record.pid===started.diagnostic.owner_pid
  &&t.record.status==='committed'&&t.record.metadata?.tool===started.tool_name&&between(t.record.started_at)&&between(t.record.completed_at)
  &&isolationJson(t.record.affected_paths)===isolationJson([registryPath])&&t.record.operations?.length===1
  &&t.record.operations[0].type==='write'&&t.record.operations[0].path===registryPath&&t.record.rollback_available===true&&!t.record.error);
 const ack=audits.filter(a=>a.tool_name===started.tool_name&&a.status==='completed'&&a.result?.is_error===false
  &&between(a.created_at)&&isolationJson(a.input_summary)===isolationJson(summary)
  &&a.result.text_sha256===isolationHash(responseText));
 if(tx.length!==1||ack.length!==1)return null;
 const committedAudit=transactions.filter(t=>t.record.name==='mcp-audit-complete'&&t.record.status==='committed'
  &&t.record.pid===started.diagnostic.owner_pid&&t.record.metadata?.audit_id===ack[0].audit_id
  &&t.record.metadata?.tool_name===started.tool_name&&between(t.record.completed_at));
 if(committedAudit.length!==1)return null;
 return {kind:'audited_completed',transaction_sha256:tx[0].sha256,audit_transaction_sha256:committedAudit[0].sha256,
  audit_line_sha256:isolationHash(isolationJson(ack[0])),archive:{transaction:tx[0].record,audit_transaction:committedAudit[0].record,audit:ack[0],registry_revision:registry.revision,response_text:responseText},binding:{workstream_id:record.workstream_id,
   workspace_id:record.workspace_id,workstream_revision:record.revision,base_head:record.base_head,state:'active'}};
}
// Legacy recovery can also use a positive, acknowledged pre-write CAS rollback.
// The pinned createIsolated implementation checks this revision before any
// directory/branch/worktree creation. Absence of a transaction is never proof.
function prewriteWitness(started,terminal,record,request,transactions,audits){
 if(record.revision===request.expected_workstream_revision)return null;
 const message=`stale workstream revision: expected ${request.expected_workstream_revision}, current ${record.revision}.`;
 const between=v=>Date.parse(v)>=Date.parse(started.timestamp)&&Date.parse(v)<=Date.parse(terminal.timestamp);
 const own=transactions.filter(t=>t.record.pid===started.diagnostic.owner_pid&&t.record.name==='dev-workstream-registry');
 const tx=own[0];if(own.length!==1||tx.record.status!=='rolled_back'||tx.record.error!==message
  ||tx.record.metadata?.tool!==started.tool_name||tx.record.metadata?.runtime!=='development_workstream_registry'
  ||isolationJson(tx.record.affected_paths)!==isolationJson([registryPath])||tx.record.rollback_available!==true
  ||!Array.isArray(tx.record.rollback_errors)||tx.record.rollback_errors.length
  ||!between(tx.record.started_at)||!between(tx.record.completed_at)||Date.parse(tx.record.completed_at)<Date.parse(tx.record.started_at)
  ||Date.parse(record.updated_at)>=Date.parse(tx.record.started_at))return null;
 const summary=Object.fromEntries(Object.entries(request).map(([k,v])=>[k,summarize(v)]));
 const audit=audits.filter(a=>a.status==='tool_error'&&a.tool_name===started.tool_name&&a.result?.is_error===true
  &&a.result.text_sha256===isolationHash(message)&&isolationJson(a.input_summary)===isolationJson(summary)
  &&between(a.created_at)&&Date.parse(a.created_at)<=Date.parse(tx.record.started_at));
 if(audit.length!==1)return null;
 const ack=transactions.filter(t=>t.record.name==='mcp-audit-complete'&&t.record.status==='committed'
  &&t.record.pid===started.diagnostic.owner_pid&&t.record.metadata?.tool_name===started.tool_name
  &&t.record.metadata?.audit_id===audit[0].audit_id&&between(t.record.completed_at)
  &&Date.parse(t.record.started_at)>=Date.parse(tx.record.completed_at));
 if(ack.length!==1)return null;
 return {kind:'prewrite_stale_cas',transaction_sha256:tx.sha256,audit_transaction_sha256:ack[0].sha256,
  archive:{transaction:tx.record,audit_transaction:ack[0].record,audit:audit[0]}};
}

// Both inspect and apply use this same complete collector. The host root is a
// constructor binding, never an MCP input. Absence alone is never no_effect.
export async function inspectIsolationEvidence(root,events,input,{readOnlyLockEvidence=null}={}){
 const {started,terminal}=isolationTarget(events,input);assertIsolationOwnerDead(started,terminal);
 const piEvents=events.filter(e=>e.execution_projection&&e.stage==='operation_completed');
 if(piEvents.length){const {validatePiExecutionHistory}=await import('./pi-execution-state-store.mjs');validatePiExecutionHistory(piEvents);}
 const piLatest=new Map();
 for(const e of events)if(e.execution_projection?.intent?.requested_actions?.some(a=>a.idempotency_key===started.reconciliation_key))
  piLatest.set(e.execution_projection.state.operation_id,e);
 const piClaims=[...piLatest.values()].map(e=>({event_hash:e.event_hash,projection_hash:e.execution_projection.projection_hash,
  operation_id:e.execution_projection.state.operation_id,revision:e.execution_projection.revision,owner:e.execution_projection.runtime.owner}));
 for(const c of piClaims)if(c.owner)assertIsolationOwnerDead({diagnostic:{hostname:c.owner.hostname,owner_pid:c.owner.pid}},{diagnostic:{hostname:c.owner.hostname,owner_pid:c.owner.pid}});
 const base=await realpath(root),worktreeRoot=path.join(path.dirname(base),'.writer-workbench-worktrees');
 const safeRead=async(file,max=8*1024*1024)=>{
  const resolved=path.resolve(file);let cursor=path.parse(resolved).root;
  for(const component of resolved.slice(cursor.length).split(path.sep).filter(Boolean)){
   cursor=path.join(cursor,component);const info=await lstat(cursor);if(info.isSymbolicLink())fail('ISOLATION_UNSAFE_PATH');
  }
  const info=await lstat(resolved);if(!info.isFile()||info.size>max)fail('ISOLATION_UNSAFE_FILE');return readFile(resolved);
 };
 const optional=async(file,max)=>{try{return await safeRead(file,max);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const list=async(dir,limit=100000)=>{try{const s=await lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())fail('ISOLATION_UNSAFE_DIRECTORY');
  const rows=await readdir(dir);if(rows.length>limit)fail('ISOLATION_SCAN_LIMIT');return rows.sort();}catch(e){if(e.code==='ENOENT')return [];throw e;}};
 const git=async(args,cwd=base)=>(await exec(gitExecutable,['-c','core.fsmonitor=false',...args],{cwd,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024,
  env:controlledProcessEnvironment({GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'})})).stdout;
 if(await realpath((await git(['rev-parse','--show-toplevel'])).trim())!==base)fail('ISOLATION_REPOSITORY_ROOT_MISMATCH');
 const bytes=await safeRead(path.join(base,registryPath));
 const {decodeWorkstreamRegistryBytes}=await import('./mcp-development-workstream-tools.mjs');
 let registry;try{registry=decodeWorkstreamRegistryBytes(bytes);}catch{fail('ISOLATION_REGISTRY_CORRUPT');}
 const matches=registry.workstreams.filter(w=>w.workstream_id===started.workstream_id),record=matches[0];
 if(matches.length!==1)fail('ISOLATION_WORKSTREAM_MISMATCH');
 const contracts={};for(const [file,expected]of Object.entries(sourceContracts)){
  contracts[file]=isolationHash((await safeRead(path.join(base,file))).toString('utf8').replaceAll('\r\n','\n'));
  if(contracts[file]!==expected&&!(file==='server/src/mcp-development-workstream-tools.mjs'&&contracts[file]===registryDecoderSourceHash))fail('ISOLATION_UNREVIEWED_SOURCE');
 }
 const mapping=(await git(['worktree','list','--porcelain','-z'])).split('\0\0').filter(Boolean).map(group=>{
  const out={};for(const line of group.split('\0').filter(Boolean)){const i=line.indexOf(' ');out[i<0?line:line.slice(0,i)]=i<0?'':line.slice(i+1);}return out;
 });
 const refs=(await git(['for-each-ref','--format=%(refname)%00%(objectname)','refs/heads/dev-ws/'])).trim().split(/\r?\n/).filter(Boolean).map(l=>l.split('\0'));
 const common=path.resolve(base,(await git(['rev-parse','--git-common-dir'])).trim());
 const admin=[];for(const name of await list(path.join(common,'worktrees'))){
  const directory=path.join(common,'worktrees',name),entry={name};
  for(const f of ['gitdir','commondir','HEAD','locked']){const b=await optional(path.join(directory,f));entry[f]=b?.toString('utf8').trim()??null;}
  admin.push(entry);
 }
 const physical=[];for(const name of await list(worktreeRoot)){
  const dir=path.join(worktreeRoot,name),info=await lstat(dir);
  if(!info.isDirectory()||info.isSymbolicLink()){physical.push({name,unsafe:true});continue;}
  physical.push({name,git:(await optional(path.join(dir,'.git')))?.toString('utf8').trim()??null});
 }
 const residuals=[],legacyResiduals=[];
 for(const p of physical){const w=registry.workstreams.find(w=>w.workspace_id===p.name&&w.workspace?.state!=='removed');
  const m=mapping.find(m=>path.resolve(m.worktree??'')===path.join(worktreeRoot,p.name));
  if(!ws.test(p.name)||p.unsafe||!p.git||!w||!m||m.branch!==`refs/heads/dev-ws/${p.name.slice(14)}`)residuals.push('directory:'+p.name);
 }
 for(const [ref]of refs)if(!registry.workstreams.some(w=>`refs/heads/dev-ws/${w.workspace_id?.slice(14)}`===ref))residuals.push('branch:'+ref);
 for(const m of mapping.filter(m=>path.dirname(path.resolve(m.worktree??''))===worktreeRoot))
  if(!physical.some(p=>path.join(worktreeRoot,p.name)===path.resolve(m.worktree))||!registry.workstreams.some(w=>path.join(worktreeRoot,w.workspace_id)===path.resolve(m.worktree)))residuals.push('mapping:'+m.worktree);
 for(const a of admin){const m=mapping.find(m=>path.resolve(m.worktree??'')===path.dirname(path.resolve(a.gitdir??'')));
  if(!m)residuals.push('admin:'+a.name);
 }
 const reflogs=[];for(const name of await list(path.join(common,'logs/refs/heads/dev-ws'))){
  const b=await safeRead(path.join(common,'logs/refs/heads/dev-ws',name));reflogs.push({name,sha256:isolationHash(b)});
  if(!refs.some(([ref])=>ref==='refs/heads/dev-ws/'+name))residuals.push('reflog:'+name);
 }
 const managedMetadata={reflogs,packed_refs_sha256:await optional(path.join(common,'packed-refs')).then(b=>b?isolationHash(b):null)};
 for(const file of ['index.lock','HEAD.lock','packed-refs.lock'])if(await optional(path.join(common,file)))residuals.push('git_lock:'+file);
 for(const name of await list(path.join(common,'refs/heads/dev-ws')))if(name.endsWith('.lock'))residuals.push('git_ref_lock:'+name);
 const projectLock=await optional(path.join(base,'data/outputs/logs/locks/project-write.lock'));
 if(projectLock){let owner;try{owner=JSON.parse(projectLock);}catch{fail('ISOLATION_UNREADABLE_PROJECT_LOCK');}
  if(owner.pid!==process.pid)residuals.push('project_write_lock_present');}
 const transactionNames=await list(path.join(base,'data/outputs/logs/transactions'),500000);
 for(const name of transactionNames)if(!txName.test(name))residuals.push('transaction_residue:'+name);
 const registryTemps=(await list(path.dirname(path.join(base,registryPath)))).filter(n=>n.startsWith('.workstream_registry.json.')&&n.endsWith('.tmp'));
 for(const name of registryTemps)residuals.push('registry_temp:'+name);
 const transactions=[];for(const name of transactionNames.filter(n=>txName.test(n))){
  const day=name.slice(3,11);if(day<started.timestamp.slice(0,10).replaceAll('-','')||day>terminal.timestamp.slice(0,10).replaceAll('-',''))continue;
  const b=await safeRead(path.join(base,'data/outputs/logs/transactions',name)),t=JSON.parse(b);
  if((Date.parse(t.started_at)<=Date.parse(terminal.timestamp)&&Date.parse(t.completed_at??terminal.timestamp)>=Date.parse(started.timestamp))
   ||t.pid===started.diagnostic.owner_pid)transactions.push({sha256:isolationHash(b),record:t});
 }
 const pending=[];for(const name of await list(path.join(base,'data/outputs/logs/mcp_audit_intents'))){
  const b=await safeRead(path.join(base,'data/outputs/logs/mcp_audit_intents',name));const a=JSON.parse(b);
  if(a.tool_name===started.tool_name&&isolationJson(a.input_summary)?.includes(started.workstream_id))pending.push(isolationHash(b));
 }
 const audit=await optional(path.join(base,'data/outputs/logs/mcp_tool_audit.jsonl'),128*1024*1024);
 const audits=(audit?.toString('utf8').trim().split('\n').filter(Boolean)??[]).map(l=>JSON.parse(l));
 if(audits.length>500000)fail('ISOLATION_SCAN_LIMIT');
 const matching=audits.filter(a=>a.tool_name===started.tool_name&&isolationJson(a.input_summary)?.includes(started.workstream_id));
 const ownTransactions=transactions.filter(t=>t.record.pid===started.diagnostic.owner_pid);
 if(pending.length||ownTransactions.some(t=>!['committed','rolled_back'].includes(t.record.status)||t.record.rollback_errors?.length))residuals.push('unfinished_transaction');
 let lockEvidence=null;
 const lockBytes=await optional(path.join(base,'data/outputs/logs/development_runtime/recovery_evidence',terminal.event_hash+'.json'));
 if(lockBytes){try{lockEvidence=JSON.parse(lockBytes);}catch{fail('ISOLATION_LOCK_EVIDENCE_CORRUPT');}}
 let witness=barrierWitness(events,started),classification='unknown';
 const shared=record.mode==='shared'&&!record.workspace&&record.revision===input.original_request.expected_workstream_revision;
 const lockCandidate=lockEvidence??readOnlyLockEvidence;
 let lockWitness=isolationLockExclusion(started,terminal,input.original_request,lockCandidate);
 if(lockWitness&&!transactions.some(t=>t.sha256===lockCandidate.transaction_sha256
   &&isolationJson(t.record)===isolationJson(JSON.parse(lockCandidate.transaction_text))))lockWitness=null;
 if(lockWitness&&shared&&!matching.length&&!pending.length&&!ownTransactions.length){
  // Keep positively unrelated legacy artifacts in the observation. Never clean
  // them or turn arbitrary missing workspace artifacts into a no-effect proof.
  for(const item of [...residuals]){
   let evidence=null;
   if(item.startsWith('directory:.writer-workbench-')){
    const name=item.slice('directory:'.length),info=await lstat(path.join(worktreeRoot,name));
    if(['.writer-workbench-worktrees','.writer-workbench-integrations'].includes(name)
      &&info.isDirectory()&&!info.isSymbolicLink()&&info.birthtimeMs<Date.parse(started.timestamp))
     evidence={kind:'reserved_root_outside_workspace_id_namespace',created_at:info.birthtime.toISOString()};
   }else if(item.startsWith('branch:')){
    const ref=item.slice(7),head=refs.find(([name])=>name===ref)?.[1];
    const file=path.join(common,'logs',ref);let info;try{info=await lstat(file);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(info?.isFile()&&!info.isSymbolicLink()&&info.birthtimeMs<Date.parse(started.timestamp)
      &&head!==record.base_head&&info.size===0)
     evidence={kind:'older_branch_with_different_pinned_base',head,reflog_created_at:info.birthtime.toISOString(),reflog_sha256:isolationHash('')};
   }
   if(evidence){legacyResiduals.push({residual:item,...evidence});residuals.splice(residuals.indexOf(item),1);}
  }
  witness=lockWitness;if(!residuals.length)classification='no_effect';
 }
 if(witness&&shared&&!residuals.length&&!matching.length&&!ownTransactions.some(t=>t.record.name==='dev-workstream-registry'))classification='no_effect';
 if(!witness){witness=prewriteWitness(started,terminal,record,input.original_request,transactions,matching);
  if(witness&&!residuals.length)classification='no_effect';}
 if(record.mode==='isolated'&&classification!=='no_effect'){
  witness=completedWitness(events,{...started,expected_revision:input.original_request.expected_workstream_revision},terminal,record,registry,transactions,matching);
  const p=physical.find(p=>p.name===record.workspace_id),m=mapping.find(m=>m.worktree&&path.resolve(m.worktree)===path.join(worktreeRoot,record.workspace_id));
  const a=admin.find(a=>a.gitdir&&path.resolve(a.gitdir)===path.join(worktreeRoot,record.workspace_id,'.git'));
  const adminDir=a?path.join(common,'worktrees',a.name):null;
  const links=p?.git?.startsWith('gitdir: ')&&path.resolve(path.join(worktreeRoot,record.workspace_id),p.git.slice(8))===adminDir
   &&a&&path.resolve(adminDir,a.commondir)===common&&a.HEAD===`ref: refs/heads/dev-ws/${record.workspace_id.slice(14)}`;
  if(witness&&links&&!residuals.length&&record.workspace.state==='active'&&record.workspace.locked===true
   &&m?.HEAD===record.base_head&&m.branch===a.HEAD.slice(5)&&Object.hasOwn(m,'locked')&&a.locked===record.workspace.lock_reason&&m.locked===record.workspace.lock_reason
   &&refs.some(([ref,head])=>ref===m.branch&&head===record.base_head)
   &&!(await git(['status','--porcelain=v1','--untracked-files=all'],path.join(worktreeRoot,record.workspace_id))).trim())classification='completed';
 }
 if(residuals.length||(!shared&&!['completed','no_effect'].includes(classification)))classification='partial';
 const inventory={registry_sha256:isolationHash(bytes),registry_revision:registry.revision,target:record,pi_claims:piClaims,
  git_common_dir_sha256:isolationHash(common),worktrees_sha256:isolationHash(mapping),branches_sha256:isolationHash(refs),
  git_admin_sha256:isolationHash(admin),physical_directories_sha256:isolationHash(physical),transactions_sha256:isolationHash(transactions),
  git_managed_metadata_sha256:isolationHash(managedMetadata),
  pending_audits_sha256:isolationHash(pending),matching_audits_sha256:isolationHash(matching),source_contracts:contracts,
  counts:{worktrees:mapping.length,branches:refs.length,git_admin:admin.length,directories:physical.length,transactions:transactions.length,reflogs:reflogs.length},
  residuals,...(legacyResiduals.length?{legacy_residuals:legacyResiduals}:{}),classification,witness};
 return {classification,observation:inventory,observation_sha256:isolationHash(inventory),
  missing:classification==='unknown'?['positive_invocation_bound_effect_witness']:classification==='partial'?['coherent_complete_physical_state']:[]};
}

export function validateIsolationResolution(events,input){
 const {started,terminal}=isolationTarget(events,input),o=input.observation,a=input.authority_receipt;
 if(input.resolution_kind!==ISOLATION_RESOLUTION||!o||!['completed','no_effect'].includes(o.classification)
  ||!hex.test(input.observation_sha256??'')||isolationHash(o)!==input.observation_sha256||o.residuals?.length!==0
  ||o.target?.workstream_id!==started.workstream_id||!o.counts||Object.values(o.counts).some(n=>!Number.isSafeInteger(n)||n<0)
  ||!Array.isArray(o.pi_claims)||o.pi_claims.some(c=>!events.some(e=>e.event_hash===c.event_hash
    &&e.execution_projection?.projection_hash===c.projection_hash&&e.execution_projection.state.operation_id===c.operation_id
    &&e.execution_projection.revision===c.revision&&isolationJson(e.execution_projection.runtime.owner)===isolationJson(c.owner)
    &&e.execution_projection.intent.requested_actions.some(a=>a.idempotency_key===started.reconciliation_key)))
  ||!exact(o.source_contracts,Object.keys(sourceContracts))||Object.entries(sourceContracts).some(([file,hash])=>o.source_contracts[file]!==hash
    &&!(file==='server/src/mcp-development-workstream-tools.mjs'&&o.source_contracts[file]===registryDecoderSourceHash))
  ||['registry_sha256','git_common_dir_sha256','worktrees_sha256','branches_sha256','git_admin_sha256','git_managed_metadata_sha256','physical_directories_sha256','transactions_sha256','pending_audits_sha256','matching_audits_sha256'].some(k=>!hex.test(o[k]??''))
  ||!exact(a,['approval_sha256','audit_reference','decision_id','operation_id','scope','terminal_hash','observation_sha256'])
  ||!hex.test(a.approval_sha256??'')||typeof a.audit_reference!=='string'||!a.audit_reference.trim()||a.audit_reference.length>256
  ||a.scope!==ISOLATION_RESOLUTION||a.operation_id!==started.operation_id||a.terminal_hash!==terminal.event_hash
  ||a.decision_id!==input.decision_id||a.observation_sha256!==input.observation_sha256)fail('UNSAFE_ISOLATION_RESOLUTION');
 if(o.classification==='no_effect'){
  let witness;
  if(o.witness?.kind==='before_handler'){
   witness=barrierWitness(events,started);
   if(o.target.mode!=='shared'||o.target.workspace||o.target.revision!==input.original_request.expected_workstream_revision)fail('UNSAFE_ISOLATION_NO_EFFECT');
  }else if(o.witness?.kind==='prewrite_stale_cas'){
   const w=o.witness,a=w.archive;
   if(!a||!hex.test(w.transaction_sha256??'')||!hex.test(w.audit_transaction_sha256??''))fail('UNSAFE_ISOLATION_NO_EFFECT');
   witness=prewriteWitness(started,terminal,o.target,input.original_request,[{record:a.transaction,sha256:w.transaction_sha256},
    {record:a.audit_transaction,sha256:w.audit_transaction_sha256}],[a.audit]);
  }else if(o.witness?.kind==='audit_intent_lock_exclusion_v1'){
   witness=isolationLockExclusion(started,terminal,input.original_request,o.witness.archive);
   if(o.target.mode!=='shared'||o.target.workspace||o.target.revision!==input.original_request.expected_workstream_revision)fail('UNSAFE_ISOLATION_NO_EFFECT');
   for(const item of o.legacy_residuals??[]){
    if(item.kind==='reserved_root_outside_workspace_id_namespace'){
     if(!['directory:.writer-workbench-worktrees','directory:.writer-workbench-integrations'].includes(item.residual)
       ||!(Date.parse(item.created_at)<Date.parse(started.timestamp)))fail('UNSAFE_ISOLATION_LEGACY_RESIDUE');
    }else if(item.kind==='older_branch_with_different_pinned_base'){
     if(!/^branch:refs\/heads\/dev-ws\/[a-f0-9]{24}$/u.test(item.residual)||!/^[a-f0-9]{40}$/u.test(item.head??'')
       ||item.head===o.target.base_head||!(Date.parse(item.reflog_created_at)<Date.parse(started.timestamp))
       ||item.reflog_sha256!==isolationHash(''))fail('UNSAFE_ISOLATION_LEGACY_RESIDUE');
    }else fail('UNSAFE_ISOLATION_LEGACY_RESIDUE');
   }
  }
  if(!witness||isolationJson(witness)!==isolationJson(o.witness))fail('UNSAFE_ISOLATION_NO_EFFECT');
 }else{
  const w=o.witness,archive=w?.archive;
  if(w?.kind!=='audited_completed'||!['transaction_sha256','audit_transaction_sha256','audit_line_sha256'].every(k=>hex.test(w[k]??''))
   ||o.target.mode!=='isolated'||o.target.revision!==input.original_request.expected_workstream_revision+1
   ||!ws.test(w.binding?.workspace_id??'')||w.binding.workstream_id!==started.workstream_id
   ||o.target.workspace_id!==w.binding.workspace_id||o.target.base_head!==w.binding.base_head
   ||w.binding.workstream_revision!==o.target.revision||!archive)fail('UNSAFE_ISOLATION_COMPLETED');
  // Re-evaluate the archived success proof on every cold Journal decode. Live
  // workspace evolution never rewrites the accepted historical observation.
  const replay=completedWitness(events,{...started,expected_revision:input.original_request.expected_workstream_revision},terminal,o.target,
   {revision:archive.registry_revision},[{record:archive.transaction,sha256:w.transaction_sha256},
    {record:archive.audit_transaction,sha256:w.audit_transaction_sha256}],[archive.audit],archive.response_text);
  if(!replay||isolationJson(replay)!==isolationJson(w))fail('UNSAFE_ISOLATION_COMPLETED');
 }
 return {started,terminal};
}
