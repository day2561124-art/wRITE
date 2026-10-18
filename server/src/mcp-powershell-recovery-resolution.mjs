// General fail-closed classification; narrow, reviewed detached-effect adjudication.
// A completed test effect is evidence of dispatch, never evidence of a shell exit code.
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fingerprintMcpMutationRequest} from './mcp-operation-reconciliation-context.mjs';
export const POWERSHELL_EFFECT_RESOLUTION='powershell_observed_test_effect';
const sha=b=>createHash('sha256').update(b).digest('hex');
const digest=/^[a-f0-9]{64}$/u;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const fail=()=>{throw new Error('UNSAFE_POWERSHELL_EFFECT_RESOLUTION');};
const home='C:/Users/day25/Documents/Codex/2026-10-15/new-chat/';
// Trusted-host admission profile, reviewed against the original frozen command,
// worker implementation and durable receipt. It grants no arbitrary shell authority.
export const REVIEWED_POWERSHELL_EFFECT_PROFILE=Object.freeze({
 profile_id:'reviewed-detached-all-gate-20261015-v1',command_sha256:'04b1846cea30078f531cf40406d8294707a106d81dd47f6a472ea5c074146cb2',
 artifacts:{
  launcher:{path:home+'work/start-full-gate-once.ps1',sha256:'692917680967e2debe7ce8b64712350d51850a9cf9e4dd04d2acfd26e839b30c'},
  worker:{path:home+'work/run-full-gate-once.mjs',sha256:'0c0158a33de4d0b6d97ca138db2ca4ea0f02d4aee2b9b2e56bdabae9269ac38c'},
  transfer:{path:home+'outputs/formal-transfer-manifest.json',sha256:'1426f6b9e2c7c9f2fff95db3adb30367b4f8b42f5fc620e4443c7b4ed60a1f4c'},
  claim:{path:home+'outputs/formal-full-gate-claim.json',sha256:'4299b3be28c03ae084e8c44dd892bd054644468c679455d3df67b2211531f4da'},
  receipt:{path:home+'outputs/formal-full-gate-receipt.json',sha256:'dd600af6a71b73ae9eea99f6fec5a2bd4eb1c140a74fcfc1b6ce8475b77657a8'},
  runner:{path:'E:/.writer-workbench-worktrees/dev_workspace_59e4a6e32b7a4a798637acfa/server/src/mcp-development-test-tools.mjs',sha256:'ed1fff8bc2257ec31abad86496c16192d484afb2e5b6e0636648337396f0f656'},
  shell:{path:'E:/武裝學院的二三事/server/src/mcp-powershell-maintenance-tools.mjs',sha256:'b36f7555ce4064c0adfd88df9db875d8c291ee71ae8c229f2c47e9956e6ef4f5'},
 }
});
export const isPowerShellOperation=e=>['powershell_run','powershell_admin_run'].includes(e?.tool_name)
 &&['mcp_mutation','powershell_maintenance','powershell_admin_maintenance'].includes(e?.operation_type);
export const isUnprovenPowerShellRecovery=e=>isPowerShellOperation(e)&&e.stage==='operation_recovered'
 &&e.result?.outcome==='no_effect_observed';

export function validatePowershellEffectResolution(events,input,profile=REVIEWED_POWERSHELL_EFFECT_PROFILE) {
 const one=(id,stage)=>{const matches=events.filter(e=>e.operation_id===id&&(stage?e.stage===stage:e.stage!=='operation_started'));if(matches.length!==1)fail();return matches[0];};
 const parent=one(input.parent_operation_id,'operation_started'),parentTerminal=one(input.parent_operation_id);
 const child=one(input.child_operation_id,'operation_started'),childTerminal=one(input.child_operation_id);
 const started=input.operation_id===parent.operation_id?parent:input.operation_id===child.operation_id?child:null;
 const terminal=started===parent?parentTerminal:childTerminal;
 const claim=events.find(e=>e.event_hash===input.pi_claim_event_hash),p=claim?.execution_projection;
 const action=p?.intent?.requested_actions?.find(a=>a.step_id===p.runtime?.active_call?.step_id);
 const testStarted=events.find(e=>e.event_hash===input.test_started_event_hash),testDone=events.find(e=>e.event_hash===input.test_terminal_event_hash);
 if(!started||input.profile_id!==profile.profile_id||!digest.test(profile.command_sha256??'')
  ||parent.operation_type!=='mcp_mutation'||parent.tool_name!=='powershell_run'||parent.parent_operation_id!==null
  ||child.operation_type!=='powershell_maintenance'||child.tool_name!==parent.tool_name||child.parent_operation_id!==parent.operation_id
  ||child.sequence<=parent.sequence||parent.targets.length||child.targets.length
  ||parentTerminal.event_hash!==input.parent_terminal_hash||childTerminal.event_hash!==input.child_terminal_hash
  ||terminal.event_hash!==input.expected_terminal_hash||started.request_fingerprint_sha256!==input.request_fingerprint_sha256
  ||[parentTerminal,childTerminal].some((t,i)=>{const s=i===0?parent:child;return t.stage!=='operation_recovered'
   ||!['ambiguous_effect','no_effect_observed'].includes(t.result?.outcome)||t.result?.reconciliation_required!==(t.result?.outcome==='ambiguous_effect')
   ||t.reconciles_event_id!==s.journal_event_id||t.result?.recovered_from_started_event_id!==s.journal_event_id
   ||t.sequence<=s.sequence||['tool_name','operation_type','workspace_id','workstream_id','reconciliation_key','request_fingerprint_sha256'].some(k=>t[k]!==s[k]);})
  ||child.workspace_id!==parent.workspace_id||child.workstream_id!==parent.workstream_id
  ||child.diagnostic?.owner_pid!==parent.diagnostic?.owner_pid||child.diagnostic?.hostname!==parent.diagnostic?.hostname
  ||child.result?.command_sha256!==profile.command_sha256||child.result?.elevated!==false
  ||!p||claim.stage!=='operation_completed'||claim.sequence>=parent.sequence||p.command?.type!=='tool_call_started'
  ||p.runtime?.active_call?.mutation!==true||p.runtime.active_call.idempotency_key!==parent.reconciliation_key
  ||p.runtime.owner?.pid!==parent.diagnostic.owner_pid||p.runtime.owner.hostname!==parent.diagnostic.hostname
  ||p.intent.context.workspace_id!==parent.workspace_id||p.intent.context.workstream_id!==parent.workstream_id
  ||action?.capability!=='workspace.powershell'||action.idempotency_key!==parent.reconciliation_key
  ||action.input?.cwd!=='.'||action.input?.timeoutMs!==child.result?.timeout_ms||sha(action.input?.command??'')!==profile.command_sha256
  ||fingerprintMcpMutationRequest('powershell_run',{...action.input,workspace_id:parent.workspace_id})!==parent.request_fingerprint_sha256
  ||testStarted?.stage!=='operation_started'||testStarted.operation_type!=='test_evidence'||testStarted.tool_name!=='dev_run_tests'
  ||testStarted.sequence<=child.sequence||testStarted.result?.suite!=='all'
  ||testDone?.stage!=='operation_completed'||testDone.operation_id!==testStarted.operation_id||testDone.sequence<=testStarted.sequence
  ||testDone.operation_type!==testStarted.operation_type||testDone.tool_name!==testStarted.tool_name
  ||[testStarted,testDone].some(e=>e.workspace_id!==parent.workspace_id||e.workstream_id!==parent.workstream_id)
  ||testDone.result?.suite!=='all'||testDone.result?.passed!==true||testDone.result?.execution_ok!==true||testDone.result?.timed_out!==false
  ||!digest.test(testDone.result.workspace_snapshot_id??'')||!digest.test(testDone.result.verification_manifest_sha256??'')
  ||events.some(e=>e.parent_operation_id===child.operation_id&&e.stage==='operation_started'&&e.operation_type!=='pi_terminal_resolution')
  ||events.filter(e=>e.parent_operation_id===parent.operation_id&&e.stage==='operation_started'&&e.operation_type!=='pi_terminal_resolution').length!==1
  ||input.decision_owner!=='GPT'||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(input.decision_id??'')
  ||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1024)fail();
 if(started===parent) {
  const resolution=events.find(e=>e.operation_type==='pi_terminal_resolution'&&e.stage==='operation_completed'&&e.parent_operation_id===child.operation_id);
  if(!resolution||resolution.result?.outcome!=='intended_effect_observed'||resolution.reconciles_event_id!==childTerminal.journal_event_id)fail();
  const childProof=JSON.parse(resolution.result?.resolution_record??'null');
  if(!childProof||childProof.operation_id!==child.operation_id||childProof.resolution_kind!==POWERSHELL_EFFECT_RESOLUTION
   ||['parent_operation_id','child_operation_id','parent_terminal_hash','child_terminal_hash','pi_claim_event_hash','test_started_event_hash','test_terminal_event_hash','profile_id'].some(k=>childProof[k]!==input[k]))fail();
  validatePowershellEffectResolution(events,childProof,profile);
  const admission=events.find(e=>e.stage==='operation_started'&&e.reconciliation_key==='resolution:'+parent.operation_id);
  if(admission&&resolution.sequence>=admission.sequence)fail();
 }
 return {started,terminal,parent,parentTerminal,child,childTerminal,claim,testStarted,testDone};
}

async function safeRead(file,max=4*1024*1024) {
 const parsed=path.parse(path.resolve(file));let current=parsed.root;
 for(const part of path.relative(parsed.root,path.resolve(file)).split(path.sep)) {current=path.join(current,part);const s=await lstat(current);if(s.isSymbolicLink())fail();}
 const s=await lstat(file);if(!s.isFile()||s.size>max)fail();return readFile(file);
}
export async function inspectPowershellEffectResolution(facts,profile,events,{context,snapshot}) {
 const {parent,child,testStarted,testDone}=facts;
 const {validatePiExecutionHistory}=await import('./pi-execution-state-store.mjs');
 validatePiExecutionHistory(events.filter(e=>e.execution_projection&&e.stage==='operation_completed'));
 const data={};for(const [key,artifact] of Object.entries(profile.artifacts)) {const b=await safeRead(artifact.path);if(sha(b)!==artifact.sha256)fail();data[key]=b;}
 const claim=JSON.parse(data.claim),receipt=JSON.parse(data.receipt),transfer=JSON.parse(data.transfer);
 const r=receipt.result;
 if(context.workspace_id!==parent.workspace_id||context.workstream_id!==parent.workstream_id
  ||snapshot.workspace_snapshot_id!==testDone.result.workspace_snapshot_id||context.current_head!==testDone.result.head
  ||claim.workspace_id!==parent.workspace_id||claim.workstream_id!==parent.workstream_id
  ||claim.pid!==testStarted.diagnostic.owner_pid||testDone.diagnostic.owner_pid!==claim.pid
  ||claim.transfer_manifest_sha256!==sha(data.transfer)||claim.gate_id!==receipt.gate_id
  ||Date.parse(claim.started_at)<Date.parse(child.timestamp)||Date.parse(claim.started_at)>Date.parse(testStarted.timestamp)
  ||!Number.isFinite(Date.parse(claim.started_at))||receipt.full_gate_executed!==true||receipt.passed!==true
  ||stable(receipt.claim)!==stable(claim)||r?.operation_id!==testStarted.operation_id
  ||r.suite!=='all'||r.passed!==true||r.execution_ok!==true||r.exit_code!==0||r.timed_out!==false
  ||r.workspace_snapshot_id!==testDone.result.workspace_snapshot_id||r.verification_manifest_sha256!==testDone.result.verification_manifest_sha256
  ||transfer.workspace_id!==parent.workspace_id||transfer.workstream_id!==parent.workstream_id||!Array.isArray(transfer.files)||!transfer.files.length)fail();
 for(const f of transfer.files) {
  if(typeof f.path!=='string'||path.isAbsolute(f.path)||f.path.includes('\\')||f.path.split('/').some(p=>!p||p==='.'||p==='..')||!digest.test(f.after_sha256??''))fail();
  if(sha(await safeRead(path.join(context.root,f.path)))!==f.after_sha256)fail();
 }
 return {verified:true,test_operation_id:testStarted.operation_id,observed_effect:'detached_all_gate_completed',shell_exit_code_observed:false};
}
