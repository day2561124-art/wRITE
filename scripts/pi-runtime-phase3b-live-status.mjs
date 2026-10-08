// Formal read-only MCP status calls against the existing loopback HTTP service.
// No ExecutionIntent submission, mutation, restart or production config change.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {performance} from 'node:perf_hooks';
import {writeFile,mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(process.argv[2]??path.join(root,'tests/.tmp/pi-pressure-evidence/phase3b-local-status.json'));
const base='http://127.0.0.1:8787';
const evidence={schema_version:1,scope:'formal local HTTP MCP status for the same original live operation',
  operation_id:'pi_operation_ab4776c172b84bfa921ee99117a6728d',intent_id:'phase3-live-bootstrap-20261008-2146',
  calls:[],readiness:[],health:[],mutations_submitted:0,source_boundary:'existing deployed service; candidate tracing not deployed'};
await mkdir(path.dirname(output),{recursive:true});
const save=()=>writeFile(output,JSON.stringify(evidence,null,2)+'\n');
async function get(endpoint,headers={}) {
  const started=performance.now();
  const response=await fetch(base+endpoint,{headers,signal:AbortSignal.timeout(5000)});
  return {endpoint,http_status:response.status,duration_ms:performance.now()-started,value:await response.json()};
}
const transport=new StreamableHTTPClientTransport(new URL(base+'/mcp'));
const client=new Client({name:'pi-phase3b-owned-status-reader',version:'1'});
let polling=false,poller,connectOrigin;
try {
  evidence.health.push(await get('/health'));evidence.health.push(await get('/live'));await save();
  const started=performance.now();connectOrigin=started;await client.connect(transport);
  evidence.connect_ms=performance.now()-started;evidence.own_session_id=transport.sessionId;await save();
  polling=true;
  poller=(async()=>{while(polling){
    try{const sample=await get('/ready',{'Mcp-Session-Id':transport.sessionId});
      // Readiness only; do not collect unrelated operations, environment or logs.
      evidence.readiness.push({elapsed_ms:performance.now()-started,http_status:sample.http_status,
        ready:sample.value.ready,code:sample.value.code,child_pid:sample.value.child?.child_pid,
        pending_calls:sample.value.child?.pending_calls,runtime:sample.value.child?.runtime_readiness,
        last_exit:sample.value.child?.last_exit,call_timeout_ms:sample.value.child?.call_timeout_ms,
        long_tool_call_timeout_ms:sample.value.child?.long_tool_call_timeout_ms});await save();
    }catch(error){evidence.readiness.push({error:error.name});}
    await delay(5000);
  }})();
  async function call(name,args) {
    const entry={name,arguments:args,started_utc:new Date().toISOString()};evidence.calls.push(entry);await save();
    const started=performance.now();
    entry.started_elapsed_ms=started-connectOrigin;
    try{const response=await client.callTool({name,arguments:args},undefined,{timeout:300000});
      entry.duration_ms=performance.now()-started;entry.response=response;
      entry.ok=response.isError!==true;await save();return response;
    }catch(error){entry.duration_ms=performance.now()-started;entry.error={name:error.name,code:error.code,message:error.message};await save();throw error;}
  }
  await call('dev_pi_execution_status',{operation_id:evidence.operation_id,bootstrap:true});
  await call('dev_workspace_journal_status',{});
  await call('dev_workspace_checkpoint_status',{});
  evidence.completed_status_queries=true;
}catch(error){evidence.blocker={name:error.name,code:error.code,message:error.message};await save();}
finally {
  polling=false;await poller?.catch(()=>{});
  // DELETE closes only the read-only session created by this script. It never
  // closes the original Pi worker/session or another engineer's session.
  try { await transport.terminateSession();evidence.own_read_session_closed=true; }
  catch(error) { evidence.own_read_session_closed=false;evidence.cleanup_error={name:error.name,code:error.code}; }
  await client.close().catch(error=>{evidence.client_close_error={name:error.name,code:error.code};});
  await save();
}
console.log(JSON.stringify({output,completed:evidence.completed_status_queries??false,
  calls:evidence.calls.map(row=>({name:row.name,ms:row.duration_ms,ok:row.ok,error:row.error})),blocker:evidence.blocker},null,2));
