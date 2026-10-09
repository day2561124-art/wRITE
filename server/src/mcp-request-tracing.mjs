import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {channel} from 'node:diagnostics_channel';

export const REQUEST_TRACE_PROTOCOL='writer-workbench/request-trace/v1';
export const REQUEST_TRACE_META_KEY='writer_workbench_trace_id';
export const requestTraceChannel=channel(REQUEST_TRACE_PROTOCOL);
const context=new AsyncLocalStorage();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const stages=new Set(['http.body_read','http.response_finish','transport.round_trip','mcp.queue_wait',
  'mcp.dispatch','runtime.readiness','journal.readiness','checkpoint.readiness','transaction.readiness',
  'pi.prepare','pi.admission','pi.state_transition','pi.capability_dispatch','pi.reconciliation',
  'journal.projection_read','journal.projection_append','journal.route_read','checkpoint.lock_wait',
  'capability.execution','powershell.process','mcp.serialize_write']);
export const traceId=value=>typeof value==='string'&&uuid.test(value)?value:randomUUID();
export function withTraceId(message,id=traceId()) {
  if(!message||typeof message!=='object'||Array.isArray(message))return message;
  return {...message,params:{...message.params,_meta:{...message.params?._meta,[REQUEST_TRACE_META_KEY]:id}}};
}
// Only fixed identifiers and measured durations may cross the diagnostic boundary.
export function sanitizeTrace(record) {
  if(!record||!uuid.test(record.correlation_id??'')||!stages.has(record.stage)
    ||!Number.isFinite(record.duration_ms)||record.duration_ms<0||typeof record.ok!=='boolean')return null;
  return {correlation_id:record.correlation_id,stage:record.stage,duration_ms:record.duration_ms,ok:record.ok};
}
export function publishTrace(correlation_id,stage,duration_ms,ok=true) {
  const record=sanitizeTrace({correlation_id,stage,duration_ms,ok});
  if(record&&requestTraceChannel.hasSubscribers)requestTraceChannel.publish(record);
  return record;
}
export function runRequestTrace(id,callback) {
  if(!requestTraceChannel.hasSubscribers)return callback();
  return context.run({correlation_id:traceId(id)},callback);
}
export async function traceSpan(stage,callback) {
  const current=context.getStore();
  if(!current||!requestTraceChannel.hasSubscribers)return callback();
  const started=performance.now();let ok=false;
  try {const value=await callback();ok=true;return value;}
  finally {publishTrace(current.correlation_id,stage,performance.now()-started,ok);}
}
export function createTraceBuffer(limit=256) {
  if(!Number.isSafeInteger(limit)||limit<1||limit>4096)throw Error('INVALID_TRACE_LIMIT');
  const records=[];let dropped=0;
  return {accept(record){const safe=sanitizeTrace(record);if(!safe)return false;
    if(records.length===limit){records.shift();dropped++;}records.push(safe);return true;},
    snapshot(){return {limit,dropped,records:records.map(row=>({...row}))};}};
}
// Child telemetry uses existing IPC, bounded batches and no synchronous disk I/O.
export function attachTraceIpc({send=process.send?.bind(process),connected=()=>process.connected!==false}={}) {
  if(typeof send!=='function')return ()=>{};
  let pending=[],scheduled=false,inFlight=false,closed=false;
  const flush=()=>{
    scheduled=false;if(closed||inFlight||!connected())return;
    const records=pending.splice(0,64);if(!records.length)return;
    inFlight=true;
    try {send({protocol:REQUEST_TRACE_PROTOCOL,records},()=>{inFlight=false;schedule();});}
    catch {inFlight=false;}
  };
  const schedule=()=>{if(pending.length&&!scheduled&&!inFlight&&!closed){scheduled=true;setImmediate(flush);}};
  const observe=record=>{if(pending.length<256)pending.push(record);schedule();};
  requestTraceChannel.subscribe(observe);
  return ()=>{closed=true;pending=[];requestTraceChannel.unsubscribe(observe);};
}
