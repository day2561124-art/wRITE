// Narrow typed host evidence for an actual metadata-cardinality rejection.
// No dispatch, generic no-child inference, registry write or journal mutation.
import{createHash}from'node:crypto';import{lstat,readFile,readdir,realpath}from'node:fs/promises';import path from'node:path';
import{fingerprintMcpMutationRequest}from'./mcp-operation-reconciliation-context.mjs';
export const WORKSTREAM_METADATA_LIMIT_RESOLUTION='workstream_metadata_limit_before_write';
const sourcePin='e492e273eb53c5f5d9535521eea1bda209d2d58eb8de43b8be2ffd0e7509f5a1',transactionPin='8245ed446c6a5731c4a48ee4edd6ae1014b1a244456e18dd3b92a1386a773845',message='metadata must contain at most 16 properties.';
const sha=x=>createHash('sha256').update(x).digest('hex'),digest=/^[a-f0-9]{64}$/,txPattern=/^TX-\d{8}-\d{9}-[A-F0-9]{8}$/,stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),within=(v,a,b)=>Number.isFinite(Date.parse(v))&&Date.parse(v)>=Date.parse(a)&&Date.parse(v)<=Date.parse(b),fail=()=>{throw Error('UNSAFE_WORKSTREAM_METADATA_LIMIT_RESOLUTION');};
export function validateWorkstreamMetadataLimitResolution(events,input){
 const own=events.filter(e=>e.operation_id===input.operation_id),started=own.find(e=>e.stage==='operation_started'),terminal=own.find(e=>e.stage!=='operation_started'),r=input.original_request;
 if(!started||!terminal||own.length!==2||started.operation_type!=='mcp_mutation'||started.tool_name!=='dev_workspace_update_workstream'||terminal.stage!=='operation_failed'||terminal.result?.outcome!=='ambiguous_effect'||terminal.result?.reconciliation_required!==true
  ||['operation_type','tool_name','workspace_id','workstream_id','reconciliation_key','request_fingerprint_sha256'].some(k=>terminal[k]!==started[k])||started.targets.length||terminal.targets.length
  ||terminal.event_hash!==input.expected_terminal_hash||started.request_fingerprint_sha256!==input.request_fingerprint_sha256
  ||!r||Object.keys(r).sort().join(',')!=='declared_scope,expected_revision,metadata,state,workstream_id'||r.workstream_id!==started.workstream_id||r.state!=='active'||!Array.isArray(r.declared_scope)||!r.declared_scope.length||r.declared_scope.some(p=>typeof p!=='string')
  ||!Number.isSafeInteger(r.expected_revision)||r.expected_revision<1||input.observed_workstream_revision!==r.expected_revision||!r.metadata||Array.isArray(r.metadata)||typeof r.metadata!=='object'||Object.keys(r.metadata).length<=16
  ||fingerprintMcpMutationRequest(started.tool_name,r)!==input.request_fingerprint_sha256||input.source_contract_sha256!==sourcePin
  ||![input.transaction_id,input.audit_transaction_id].every(x=>txPattern.test(x??''))||![input.transaction_sha256,input.audit_transaction_sha256,input.audit_line_sha256,input.registry_sha256].every(x=>digest.test(x??''))
  ||started.diagnostic?.hostname!==terminal.diagnostic?.hostname||started.diagnostic?.owner_pid!==terminal.diagnostic?.owner_pid
  ||!Number.isFinite(Date.parse(started.timestamp))||!within(terminal.timestamp,started.timestamp,new Date(Date.parse(started.timestamp)+120000).toISOString())
  ||events.some(e=>e.parent_operation_id===started.operation_id&&e.stage==='operation_started'&&e.operation_type!=='pi_terminal_resolution')
  ||input.decision_owner!=='GPT'||!/^gpt-[A-Za-z0-9._:-]{1,120}$/.test(input.decision_id??'')||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1024)fail();
 return{started,terminal};
}
export async function inspectWorkstreamMetadataLimitResolution(root,started,terminal,input){
 const base=await realpath(root),read=async(relative,max=4*1024*1024)=>{let current=base;const parts=relative.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))fail();for(const[i,p]of parts.entries()){current=path.join(current,p);const info=await lstat(current);if(info.isSymbolicLink()||(i<parts.length-1?!info.isDirectory():!info.isFile()||info.size>max))fail();}return readFile(current);};
 if(sha((await read('server/src/mcp-development-workstream-tools.mjs')).toString().replaceAll('\r\n','\n'))!==sourcePin||sha((await read('server/src/file-transactions.mjs')).toString().replaceAll('\r\n','\n'))!==transactionPin)fail();
 const registryPath='data/outputs/logs/development_runtime/workstream_registry.json',bytes=await read(registryPath);if(sha(bytes)!==input.registry_sha256)fail();const registry=JSON.parse(bytes),{schema_version,revision,updated_at,workstreams}=registry;
 if(schema_version!==1||!Array.isArray(workstreams)||sha(JSON.stringify({schema_version,revision,updated_at,workstreams}))!==registry.checksum_sha256)fail();
 const records=workstreams.filter(w=>w.workstream_id===input.original_request.workstream_id),w=records[0];if(records.length!==1||w.revision!==input.observed_workstream_revision||w.workspace_id!==started.workspace_id||!Number.isFinite(Date.parse(w.updated_at))||Date.parse(w.updated_at)>=Date.parse(started.timestamp))fail();
 const txBytes=await read('data/outputs/logs/transactions/'+input.transaction_id+'.json'),tx=JSON.parse(txBytes);
 if(sha(txBytes)!==input.transaction_sha256||tx.transaction_id!==input.transaction_id||tx.name!=='dev-workstream-registry'||tx.status!=='rolled_back'||tx.pid!==started.diagnostic.owner_pid||tx.error!==message||tx.rollback_available!==true||!Array.isArray(tx.rollback_errors)||tx.rollback_errors.length
  ||tx.metadata?.tool!==started.tool_name||tx.metadata?.runtime!=='development_workstream_registry'||stable(tx.affected_paths)!==stable([registryPath])
  ||!within(tx.started_at,started.timestamp,terminal.timestamp)||!within(tx.completed_at,tx.started_at,terminal.timestamp))fail();
 const names=await readdir(path.join(base,'data/outputs/logs/transactions'));if(names.length>500000)fail();
 for(const name of names.filter(n=>n.endsWith('.json')&&txPattern.test(n.slice(0,-5))&&n.slice(3,11)>=started.timestamp.slice(0,10).replaceAll('-','')&&n.slice(3,11)<=terminal.timestamp.slice(0,10).replaceAll('-',''))){
  const other=JSON.parse(await read('data/outputs/logs/transactions/'+name));if(other.transaction_id!==tx.transaction_id&&other.affected_paths?.includes(registryPath)&&within(other.started_at,started.timestamp,terminal.timestamp))fail();
 }
 const ackBytes=await read('data/outputs/logs/transactions/'+input.audit_transaction_id+'.json'),ack=JSON.parse(ackBytes),auditPath='data/outputs/logs/mcp_tool_audit.jsonl',intentPath='data/outputs/logs/mcp_audit_intents/'+ack.metadata?.audit_id+'.json';
 if(sha(ackBytes)!==input.audit_transaction_sha256||ack.transaction_id!==input.audit_transaction_id||ack.name!=='mcp-audit-complete'||ack.status!=='committed'||ack.pid!==tx.pid||ack.metadata?.tool_name!==started.tool_name||ack.rollback_available!==true||ack.error
  ||!within(ack.started_at,tx.completed_at,terminal.timestamp)||!within(ack.completed_at,ack.started_at,terminal.timestamp)||stable(ack.affected_paths)!==stable([auditPath,intentPath])||ack.operations?.length!==2||!ack.operations.some(o=>o.type==='delete'&&o.path===intentPath&&o.previous_exists===true&&o.next_bytes===0))fail();
 const append=ack.operations.find(o=>o.type==='append'&&o.path===auditPath);if(!append||!Number.isSafeInteger(append.previous_bytes)||append.previous_bytes<0||!Number.isSafeInteger(append.next_bytes)||append.next_bytes<=append.previous_bytes)fail();
 const log=await read(auditPath,128*1024*1024);if(log.length<append.next_bytes)fail();const line=log.subarray(append.previous_bytes,append.next_bytes).toString();if(!line.endsWith('\n')||line.trim().includes('\n')||sha(line.trim())!==input.audit_line_sha256)fail();
 const audit=JSON.parse(line);if(audit.audit_id!==ack.metadata.audit_id||audit.tool_name!==started.tool_name||audit.status!=='tool_error'||audit.result?.is_error!==true||audit.result.text_sha256!==sha(message)||audit.result.text_preview!==message||!within(audit.created_at,started.timestamp,tx.started_at))fail();
 const summary=v=>typeof v==='string'?{type:'string',length:v.length,sha256:sha(v),preview:v}:Array.isArray(v)?v.map(summary):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,summary(x)])):v;
 if(stable(Object.fromEntries(Object.entries(input.original_request).map(([k,v])=>[k,summary(v)])))!==stable(audit.input_summary))fail();
 return{verified:true,transaction_id:tx.transaction_id,audit_id:audit.audit_id,observed_target_effect:'metadata_validation_rejected_before_registry_write'};
}
