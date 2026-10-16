// Narrow legacy evidence rule. Never dispatches, replays, edits history or grants authority.
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const LOCK_EXCLUSION_SOURCES={
 'server/src/mcp-server.mjs':'a2db7fec964bd6ff0dca87ab980ce853c325ff8363106958836fe4b46064817d',
 'server/src/file-transactions.mjs':'8245ed446c6a5731c4a48ee4edd6ae1014b1a244456e18dd3b92a1386a773845',
};
export function isolationLockExclusion(started,terminal,request,evidence){
 try {
  const e=evidence, tx=JSON.parse(e.transaction_text),r=JSON.parse(e.request_line),error=JSON.parse(e.error_line);
  const time=s=>{const n=Date.parse(s);if(!Number.isFinite(n))throw Error('invalid time');return n;};
  const begin=time(started.timestamp),end=time(terminal.timestamp),heldFrom=time(tx.started_at),heldUntil=time(tx.completed_at);
  // This is a *positive foreign lock interval*, not absence of workspace/trace.
  // Source-pinned audit-intent precedes the handler; a post-handler uncaught
  // lock error needs another complete 15s acquisition after that gate opens.
  if(started.tool_name!=='dev_workspace_create_isolated'||terminal.operation_id!==started.operation_id
   ||e.operation_id!==started.operation_id||e.terminal_hash!==terminal.event_hash
   ||hash(e.transaction_text)!==e.transaction_sha256
   ||tx.name!=='dev-workstream-registry'||tx.status!=='committed'||tx.pid===started.diagnostic.owner_pid
   ||!Number.isSafeInteger(tx.pid)||tx.pid<1||tx.rollback_available!==true||tx.error
   ||tx.metadata?.tool!=='dev_workspace_create_isolated'||tx.metadata?.runtime!=='development_workstream_registry'
   ||JSON.stringify(tx.affected_paths)!==JSON.stringify(['data/outputs/logs/development_runtime/workstream_registry.json'])
   ||tx.operations?.length!==1||tx.operations[0].type!=='write'
   ||tx.operations[0].path!==tx.affected_paths[0]
   ||heldFrom>begin||heldUntil<=begin||heldUntil>=end||heldUntil-heldFrom>=600000
   ||end-heldUntil>=15000||end<=begin
   ||r.kind!=='request'||r.name!==started.tool_name||time(r.time)>begin
   ||r.meta?.reconciliation_key!==started.reconciliation_key
   ||r.args?.workstream_id!==request.workstream_id||r.args.expected_workstream_revision!==request.expected_workstream_revision
   ||Object.keys(r.args).sort().join(',')!=='expected_workstream_revision,workstream_id'
   ||error.kind!=='mutation_transport_error'||error.code!=='RPC_ERROR'||error.attempt!==1
   ||error.message!=='Could not acquire the project write lock within 15 seconds.'
   ||time(error.time)<end||time(error.time)-end>1000
   ||e.hostname!==started.diagnostic.hostname||e.owner_pid!==started.diagnostic.owner_pid
   ||!Array.isArray(e.sources)||e.sources.length!==2
   ||Object.entries(LOCK_EXCLUSION_SOURCES).some(([file,expected])=>{
     const source=e.sources.find(s=>s.path===file);return !source||source.normalized_sha256!==expected;
   }))return null;
  // Windows event logs must positively cover the interval. No log clearance,
  // disabled log, missing read, or recorded clock discontinuity is accepted.
  if(e.clock?.protocol!=='windows-event-log-clock-coverage/v1'||e.clock.hostname!==e.hostname
   ||time(e.clock.from)>heldFrom||time(e.clock.to)<time(error.time)
   ||!Array.isArray(e.clock.logs)||e.clock.logs.length!==2
   ||e.clock.logs.some(log=>log.enabled!==true||!Number.isSafeInteger(log.oldest_record_id)
      ||!Number.isSafeInteger(log.newest_record_id)||log.oldest_record_id>=log.newest_record_id
      ||time(log.oldest_utc)>heldFrom||time(log.newest_utc)<end||log.error!==null||log.events.length!==0)
   ||!['System','Microsoft-Windows-Time-Service/Operational'].every(n=>e.clock.logs.some(l=>l.name===n)))return null;
  return {kind:'audit_intent_lock_exclusion_v1',archive:evidence};
 } catch {return null;}
}
