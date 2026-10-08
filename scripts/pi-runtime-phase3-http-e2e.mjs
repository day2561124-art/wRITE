import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {terminateProcessTree} from '../server/src/process-control.mjs';
import {runPhase2E2E} from './pi-runtime-phase2-e2e.mjs';
import {REQUEST_TRACE_META_KEY} from '../server/src/mcp-request-tracing.mjs';

async function freePort() {
  const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
export async function runPhase3HttpE2E(outputPath=null) {
  let snapshot,closed=false,lostResponse=null,dropNext=true;
  const evidence=await runPhase2E2E({normalCalls:3,beforeFaults:async({call,powershell,receipt,context})=>{
    const intent=powershell('phase3-response-lost-0001',"[Console]::Error.WriteLine('PI_PHASE3_STDERR'); Write-Output 'PI_PHASE2_OK'");
    const lost=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(intent)},true);
    assert.match(lost.error,/PHASE3_RESPONSE_LOST/);
    const state=await call('dev_pi_execution_status',{intent_id:intent.intent_id,
      workspace_id:context.workspace_id,workstream_id:context.workstream_id});
    assert.equal(state.operation.state.status,'COMPLETED');
    const recovered=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(intent)});
    assert.equal(recovered.state.operation_id,state.operation.state.operation_id);
    const fact=receipt(recovered);assert.equal(fact.exit_code,0);assert.match(fact.stdout,/PI_PHASE2_OK/);
    assert.match(fact.stderr,/PI_PHASE3_STDERR/);
    lostResponse={classification:'client-injected response loss after HTTP body completed; real durable operation',
      caller_error:lost.error,intent_id:intent.intent_id,operation_id:recovered.state.operation_id,
      child_operation_id:fact.operation_id,state:'COMPLETED',duplicate_same_operation:true,
      stdout:fact.stdout.trim(),stderr:fact.stderr.trim(),exit_code:fact.exit_code,elevated:fact.elevated};
    return 1;
  },transportFactory:async({repo,root,env})=>{
    const port=await freePort(),base='http://127.0.0.1:'+port;
    const config=path.join(root,'http-config.json');await writeFile(config,JSON.stringify({host:'127.0.0.1',port}));
    const child=spawn(process.execPath,['server/src/mcp-http-server.mjs','--config',config],
      {cwd:repo,env:{...env,MCP_DIAGNOSTICS_DIRECTORY:path.join(root,'incidents')},windowsHide:true,stdio:['ignore','ignore','pipe']});
    const exit=new Promise(resolve=>child.once('exit',resolve));let stderr='';
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-16000);});
    const stop=async()=>{if(child.exitCode===null){terminateProcessTree(child);await exit;}closed=true;};
    try {
      let ready=false;
      for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('HTTP_FIXTURE_START_FAILED: '+stderr);
        ready=await fetch(base+'/health').then(r=>r.ok).catch(()=>false);if(ready)break;await delay(100);}
      assert(ready,'own HTTP fixture must start');
      const transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'),{fetch:async(url,options)=>{
        const response=await fetch(url,options);
        if(dropNext&&options?.method==='POST'&&typeof options.body==='string') {
          const message=JSON.parse(options.body);
          if(message.params?.name==='dev_pi_execute_intent'
            &&JSON.parse(message.params.arguments.intent_json).intent_id==='phase3-response-lost-0001') {
            dropNext=false;await response.text();throw Error('PHASE3_RESPONSE_LOST');
          }
        }
        return response;
      }});
      // Capture the existing readiness endpoint before the SDK ends its session.
      const close=transport.close.bind(transport);
      transport.close=async()=>{
        if(transport.sessionId)snapshot=await fetch(base+'/ready',{headers:{'Mcp-Session-Id':transport.sessionId}}).then(r=>r.json());
        await transport.terminateSession().catch(()=>{});await close();
      };
      transport.readFixtureTrace=async()=>[];
      transport.cleanupFixture=stop;
      return transport;
    } catch(error){await stop();throw error;}
  }});
  assert(closed,'own HTTP parent and child must be drained');
  const rows=snapshot.http_request_traces.records;
  const childRows=snapshot.child.request_traces.records;
  assert(rows.some(row=>row.stage==='http.body_read'));
  assert(childRows.some(row=>row.stage==='powershell.process'));
  if(outputPath)await writeFile(outputPath,JSON.stringify({scope:'HTTP fixture observation before validation',evidence,snapshot},null,2)+'\n');
  const required=['http.body_read','http.response_finish','transport.round_trip','mcp.queue_wait',
    'runtime.readiness','pi.admission','pi.state_transition','pi.capability_dispatch','powershell.process','mcp.serialize_write'];
  // Earlier body spans may have been evicted from the bounded ring. Validate a
  // complete retained request, never infer missing spans from another request.
  const processRow=childRows.find(row=>row.stage==='powershell.process'&&required.every(stage=>
    rows.some(other=>other.correlation_id===row.correlation_id&&other.stage===stage)));
  assert(processRow,'no complete retained cross-layer PowerShell request');
  const serialized=JSON.stringify(rows);
  for(const privateValue of ['PI_PHASE2_OK','Start-Sleep','Write-Output','intent_json','authorization'])assert(!serialized.includes(privateValue));
  const result={scope:'isolated HTTP → adapter → actual MCP → Pi → PowerShell fixture; not deployed live/ChatGPT production',
    source_baseline:'bf946c6f7c1e0033fef1525b924973d35cbf7daa',runs:evidence.runs,samples:evidence.samples,
    concurrent:evidence.concurrent_statuses,nonzero:evidence.nonzero,timeout:evidence.timeout,journal:evidence.journal,
    physical_dispatches:evidence.physical_dispatches,lost_response:lostResponse,trace:rows,child_trace:childRows,
    trace_buffer:{http_limit:snapshot.http_request_traces.limit,http_dropped:snapshot.http_request_traces.dropped,
      child_limit:snapshot.child.request_traces.limit,child_dropped:snapshot.child.request_traces.dropped},
    privacy_verified:true,correlation_verified:true,owned_processes_drained:closed,
    observation_boundary:'monotonic durations within each process; no cross-process timestamp subtraction; no external ChatGPT timing'};
  if(outputPath)await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await runPhase3HttpE2E(process.argv[2]);
  console.log(JSON.stringify({scope:result.scope,correlation:result.correlation_verified,privacy:result.privacy_verified,
    drained:result.owned_processes_drained,runs:result.runs.length,dispatches:result.physical_dispatches},null,2));
}
