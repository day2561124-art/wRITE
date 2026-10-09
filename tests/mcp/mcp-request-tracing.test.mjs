import assert from 'node:assert/strict';
import test from 'node:test';
import {setImmediate as turn} from 'node:timers/promises';
import {createTraceBuffer,requestTraceChannel,runRequestTrace,traceId,traceSpan,publishTrace,
  sanitizeTrace,attachTraceIpc,withTraceId,REQUEST_TRACE_META_KEY} from '../../server/src/mcp-request-tracing.mjs';

test('fixed diagnostic shape strips commands, secrets, paths, request IDs and error text',()=>{
  const safe=sanitizeTrace({correlation_id:traceId(),stage:'powershell.process',duration_ms:2,ok:false,
    command:'SECRET_COMMAND',authorization:'SECRET_TOKEN',output:'PRIVATE_OUTPUT',request_id:'PRIVATE_ID',error:'PRIVATE_ERROR'});
  assert.deepEqual(Object.keys(safe),['correlation_id','stage','duration_ms','ok']);
  assert(!JSON.stringify(safe).includes('SECRET'));
  assert.equal(sanitizeTrace({...safe,stage:'SECRET_COMMAND'}),null);
  assert.equal(sanitizeTrace({...safe,correlation_id:'PRIVATE_ID'}),null);
  assert.equal(sanitizeTrace({...safe,duration_ms:Infinity}),null);
});
test('concurrent scopes preserve correlation and original results/errors',async()=>{
  const buffer=createTraceBuffer(),observe=row=>buffer.accept(row);
  requestTraceChannel.subscribe(observe);
  try {
    const ids=[traceId(),traceId()];
    const results=await Promise.all(ids.map((id,i)=>runRequestTrace(id,()=>traceSpan('pi.admission',async()=>{await turn();return i;}))));
    assert.deepEqual(results,[0,1]);
    const rows=buffer.snapshot().records;
    assert.deepEqual(rows.map(row=>row.correlation_id).sort(),ids.sort());
    assert(rows.every(row=>row.duration_ms>=0&&row.ok));
    const original=Error('PRIVATE_ERROR');
    await assert.rejects(runRequestTrace(traceId(),()=>traceSpan('pi.prepare',async()=>{throw original;})),error=>error===original);
    assert.equal(buffer.snapshot().records.at(-1).ok,false);
  } finally {requestTraceChannel.unsubscribe(observe);}
});
test('bounded buffer and asynchronous IPC never retain arbitrary payloads or unbounded pending data',async()=>{
  const buffer=createTraceBuffer(2),id=traceId();
  for(let i=0;i<5;i++)buffer.accept({correlation_id:id,stage:'mcp.queue_wait',duration_ms:i,ok:true});
  assert.equal(buffer.snapshot().dropped,3);assert.equal(buffer.snapshot().records.length,2);
  const batches=[],callbacks=[];
  const detach=attachTraceIpc({send:(value,callback)=>{batches.push(value);callbacks.push(callback);},connected:()=>true});
  try {
    for(let i=0;i<1000;i++)publishTrace(id,'mcp.queue_wait',i);
    assert.equal(batches.length,0,'IPC must not send synchronously in the request path');
    await turn();assert.equal(batches.length,1);assert.equal(batches[0].records.length,64);
    assert(batches.every(batch=>batch.records.length<=64));
    while(callbacks.length){callbacks.shift()();await turn();}
    assert.equal(batches.reduce((sum,batch)=>sum+batch.records.length,0),256);
  } finally {detach();}
});
test('transport trace metadata preserves authored arguments and security metadata',()=>{
  const message={params:{name:'dev_pi_execute_intent',arguments:{intent_json:'EXACT_INTENT'},_meta:{reconciliation_key:'EXACT_KEY'}}};
  const traced=withTraceId(message,traceId());
  assert.equal(traced.params.arguments,message.params.arguments);
  assert.equal(traced.params._meta.reconciliation_key,'EXACT_KEY');
  assert.equal(message.params._meta[REQUEST_TRACE_META_KEY],undefined);
});
