// Trusted-host proof for an acknowledged registry write whose Journal terminal
// was recovered as ambiguous. No dispatch, registry mutation or replay authority.
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fingerprintMcpMutationRequest} from './mcp-operation-reconciliation-context.mjs';

export const WORKSTREAM_COMMITTED_RESOLUTION='workstream_committed_update';
const sha=b=>createHash('sha256').update(b).digest('hex');
const digest=/^[a-f0-9]{64}$/u;
const txPattern=/^TX-\d{8}-\d{9}-[A-F0-9]{8}$/u;
const registryPath='data/outputs/logs/development_runtime/workstream_registry.json';
const auditPath='data/outputs/logs/mcp_tool_audit.jsonl';
const fail=()=>{throw new Error('UNSAFE_WORKSTREAM_COMMITTED_RESOLUTION');};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)
  ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const within=(v,a,b)=>Number.isFinite(Date.parse(v))&&Date.parse(v)>=Date.parse(a)&&Date.parse(v)<=Date.parse(b);

export function validateWorkstreamCommittedResolution(events,input) {
  const own=events.filter(e=>e.operation_id===input.operation_id);
  const started=own.find(e=>e.stage==='operation_started');
  const terminal=own.find(e=>['operation_failed','operation_recovered','operation_completed'].includes(e.stage));
  const request=input.original_request;
  const claim=events.find(e=>e.event_hash===input.pi_claim_event_hash);
  const p=claim?.execution_projection;
  const action=p?.intent?.requested_actions?.find(a=>a.step_id===p.runtime?.active_call?.step_id);
  if(!started||!terminal||own.length!==2||started.operation_type!=='mcp_mutation'
    ||started.tool_name!=='dev_workspace_update_workstream'||terminal.stage!=='operation_recovered'
    ||terminal.result?.outcome!=='ambiguous_effect'||terminal.result?.reconciliation_required!==true
    ||terminal.reconciles_event_id!==started.journal_event_id
    ||terminal.result?.recovered_from_started_event_id!==started.journal_event_id
    ||terminal.event_hash!==input.expected_terminal_hash||started.request_fingerprint_sha256!==input.request_fingerprint_sha256
    ||['operation_type','tool_name','workspace_id','workstream_id','reconciliation_key','request_fingerprint_sha256']
      .some(k=>started[k]!==terminal[k])||started.targets.length||terminal.targets.length
    ||!within(terminal.timestamp,started.timestamp,new Date(Date.parse(started.timestamp)+3600000).toISOString())
    ||started.diagnostic?.hostname!==terminal.diagnostic?.hostname
    ||!request||Object.keys(request).sort().join(',')!=='declared_scope,expected_revision,state,workstream_id'
    ||request.workstream_id!==started.workstream_id||request.state!=='active'
    ||!Number.isSafeInteger(request.expected_revision)||request.expected_revision<1
    ||!Array.isArray(request.declared_scope)||!request.declared_scope.length||request.declared_scope.length>100
    ||request.declared_scope.some(s=>typeof s!=='string'||!s.trim()||s!==s.trim()||s.length>256)
    ||new Set(request.declared_scope).size!==request.declared_scope.length
    ||fingerprintMcpMutationRequest(started.tool_name,request)!==input.request_fingerprint_sha256
    ||!p||claim.stage!=='operation_completed'||claim.sequence>=started.sequence||p.schema_version!==2
    ||p.command?.type!=='tool_call_started'||p.runtime?.owner?.pid!==started.diagnostic.owner_pid
    ||p.runtime.owner.hostname!==started.diagnostic.hostname||!p.runtime.active_call?.mutation
    ||p.intent.context.workspace_id!==started.workspace_id||p.intent.context.workstream_id!==started.workstream_id
    ||action?.capability!=='workspace.update_workstream'||action.idempotency_key!==started.reconciliation_key
    ||stable(action.input)!==stable(request)||p.runtime.active_call.idempotency_key!==started.reconciliation_key
    ||!txPattern.test(input.transaction_id??'')||!txPattern.test(input.audit_transaction_id??'')
    ||['transaction_sha256','audit_transaction_sha256','audit_line_sha256','registry_sha256','pi_claim_event_hash']
      .some(k=>!digest.test(input[k]??''))
    ||events.some(e=>e.parent_operation_id===started.operation_id&&e.stage==='operation_started'&&e.operation_type!=='pi_terminal_resolution')
    ||input.decision_owner!=='GPT'||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(input.decision_id??'')
    ||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1024)fail();
  return {started,terminal};
}

export async function inspectWorkstreamCommittedResolution(root,started,terminal,input,events) {
  const base=await realpath(root);
  const read=async(relative,max=4*1024*1024)=>{
    let current=base;
    const parts=relative.split('/');
    for(const [i,part] of parts.entries()) {
      current=path.join(current,part);const s=await lstat(current);
      if(s.isSymbolicLink()||(i<parts.length-1?!s.isDirectory():!s.isFile()||s.size>max))fail();
    }
    return readFile(current);
  };
  // These reviewed implementations perform the locked revision CAS before their
  // sole write; manifests are emitted after the write and before lock release.
  for(const [file,hash] of [
    ['mcp-development-workstream-tools.mjs','1a1a5a0e6bf9ec9a1bbfd505c3b4189a79153a87b964965fba5e33ba0c189bc3'],
    ['file-transactions.mjs','8245ed446c6a5731c4a48ee4edd6ae1014b1a244456e18dd3b92a1386a773845'],
  ]){const observed=sha((await read('server/src/'+file)).toString('utf8').replaceAll('\r\n','\n'));
    if(observed!==hash&&!(file==='mcp-development-workstream-tools.mjs'&&observed==='e492e273eb53c5f5d9535521eea1bda209d2d58eb8de43b8be2ffd0e7509f5a1'))fail();}
  const {validatePiExecutionHistory}=await import('./pi-execution-state-store.mjs');
  validatePiExecutionHistory(events.filter(e=>e.execution_projection&&e.stage==='operation_completed'));
  const bytes=await read(registryPath);if(sha(bytes)!==input.registry_sha256)fail();
  const registry=JSON.parse(bytes),{schema_version,revision,updated_at,workstreams}=registry;
  if(schema_version!==1||!Number.isSafeInteger(revision)||!Array.isArray(workstreams)
    ||sha(JSON.stringify({schema_version,revision,updated_at,workstreams}))!==registry.checksum_sha256)fail();
  const matches=workstreams.filter(w=>w.workstream_id===input.original_request.workstream_id),w=matches[0];
  if(matches.length!==1||w.workspace_id!==started.workspace_id||w.revision!==input.original_request.expected_revision+1
    ||w.state!==input.original_request.state||stable(w.declared_scope)!==stable(input.original_request.declared_scope))fail();
  const txBytes=await read('data/outputs/logs/transactions/'+input.transaction_id+'.json');
  const tx=JSON.parse(txBytes);
  if(sha(txBytes)!==input.transaction_sha256||tx.transaction_id!==input.transaction_id||tx.status!=='committed'
    ||tx.name!=='dev-workstream-registry'||tx.pid!==started.diagnostic.owner_pid
    ||tx.metadata?.tool!==started.tool_name||tx.metadata?.runtime!=='development_workstream_registry'
    ||stable(tx.affected_paths)!==stable([registryPath])||tx.operations?.length!==1
    ||tx.operations[0].type!=='write'||tx.operations[0].path!==registryPath||tx.operations[0].previous_exists!==true
    ||tx.operations[0].next_bytes!==bytes.length||tx.rollback_available!==true||tx.error
    ||(tx.rollback_errors!==undefined&&(!Array.isArray(tx.rollback_errors)||tx.rollback_errors.length))
    ||!within(tx.started_at,started.timestamp,terminal.timestamp)||!within(tx.completed_at,tx.started_at,terminal.timestamp)
    ||!within(w.updated_at,tx.started_at,tx.completed_at)||updated_at!==w.updated_at)fail();
  // Reject competing registry transactions, including other producers. The
  // current registry must still be the exact acknowledged response snapshot.
  const names=await readdir(path.join(base,'data/outputs/logs/transactions'));
  if(names.length>500000)fail();
  for(const name of names.filter(n=>txPattern.test(n.slice(0,-5))&&n.endsWith('.json')
    &&n.slice(3,11)>=started.timestamp.slice(0,10).replaceAll('-','')
    &&n.slice(3,11)<=terminal.timestamp.slice(0,10).replaceAll('-',''))) {
    const other=JSON.parse(await read('data/outputs/logs/transactions/'+name));
    if(other.transaction_id!==tx.transaction_id&&other.affected_paths?.includes(registryPath)
      &&within(other.started_at,started.timestamp,terminal.timestamp))fail();
  }
  const ackBytes=await read('data/outputs/logs/transactions/'+input.audit_transaction_id+'.json'),ack=JSON.parse(ackBytes);
  if(sha(ackBytes)!==input.audit_transaction_sha256||ack.transaction_id!==input.audit_transaction_id
    ||ack.name!=='mcp-audit-complete'||ack.status!=='committed'||ack.pid!==tx.pid
    ||ack.metadata?.tool_name!==started.tool_name||ack.rollback_available!==true||ack.error
    ||(ack.rollback_errors!==undefined&&(!Array.isArray(ack.rollback_errors)||ack.rollback_errors.length))
    ||!within(ack.started_at,tx.completed_at,terminal.timestamp)||!within(ack.completed_at,ack.started_at,terminal.timestamp))fail();
  const append=ack.operations?.find(o=>o.type==='append'&&o.path===auditPath);
  const intentPath='data/outputs/logs/mcp_audit_intents/'+ack.metadata.audit_id+'.json';
  if(ack.operations?.length!==2||stable(ack.affected_paths)!==stable([auditPath,intentPath])
    ||!ack.operations.some(o=>o.type==='delete'&&o.path===intentPath&&o.previous_exists===true&&o.next_bytes===0)
    ||!append||!Number.isSafeInteger(append.previous_bytes)||append.previous_bytes<0
    ||!Number.isSafeInteger(append.next_bytes)||append.next_bytes<=append.previous_bytes)fail();
  const auditBytes=await read(auditPath,128*1024*1024);
  if(auditBytes.length<append.next_bytes)fail();
  const line=auditBytes.subarray(append.previous_bytes,append.next_bytes).toString('utf8');
  if(!line.endsWith('\n')||line.trim().includes('\n')||sha(line.trim())!==input.audit_line_sha256)fail();
  const audit=JSON.parse(line);
  if(audit.audit_id!==ack.metadata.audit_id||audit.tool_name!==started.tool_name||audit.status!=='completed'
    ||audit.result?.is_error!==false||!within(audit.created_at,started.timestamp,tx.started_at))fail();
  const summary=v=>typeof v==='string'?{type:'string',length:v.length,sha256:sha(v),preview:v}
    :Array.isArray(v)?v.map(summary):v;
  const summarized=Object.fromEntries(Object.entries(input.original_request).map(([k,v])=>[k,summary(v)]));
  if(stable(summarized)!==stable(audit.input_summary))fail();
  const scope=new Set(w.declared_scope.map(s=>s.toLowerCase()));
  const overlap=workstreams.filter(c=>c.workstream_id!==w.workstream_id&&!['completed','abandoned'].includes(c.state))
    .filter(c=>c.declared_scope.some(s=>scope.has(s.toLowerCase()))).map(c=>c.workstream_id).slice(0,100);
  const response={...w,potential_overlap:overlap.length>0,overlap_workstream_ids:overlap,registry_revision:revision};
  if(sha(JSON.stringify(response,null,2))!==audit.result.text_sha256)fail();
  return {verified:true,transaction_id:tx.transaction_id,audit_id:audit.audit_id};
}
