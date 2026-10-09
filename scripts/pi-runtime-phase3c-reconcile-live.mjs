// Recover only the exact previously admitted intent, through formal Pi ingress.
// Refuse submission unless current durable status and MCP dedup lookup agree.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {hostname} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createExecutionIntent,hashExecutionInput,validateOperationState} from '../server/src/pi-execution-contract.mjs';
import {localOwnerAlive} from '../server/src/pi-reliable-execution-store.mjs';
import {createMcpCapabilityAdapter} from '../server/src/pi-mcp-adapter.mjs';

const root=new URL('../',import.meta.url);
const prior=JSON.parse(await readFile(new URL('docs/PI-RUNTIME-PRESSURE-PHASE3.evidence.json',root),'utf8'));
const current=JSON.parse(await readFile(new URL('tests/.tmp/pi-pressure-evidence/phase3c-local-status.json',root),'utf8'));
const decode=r=>{assert.notEqual(r.isError,true);return JSON.parse(r.content.find(c=>c.type==='text').text);};
const record=decode(current.calls[0].response).operation;
const state=validateOperationState(record.state),intent=createExecutionIntent(prior.submitted_live_intent);
assert.deepEqual(record.intent,intent);assert.equal(state.intent_hash,hashExecutionInput(intent));
assert.equal(state.operation_id,'pi_operation_ab4776c172b84bfa921ee99117a6728d');
assert.equal(state.status,'PREPARING');assert.equal(record.runtime.active_call,null);
assert.deepEqual(record.receipts,[]);assert.deepEqual(state.tool_calls,[]);assert.deepEqual(state.tool_results,[]);
assert.equal(record.runtime.owner.hostname,hostname());
// Positive control prevents sandbox process invisibility from authorizing recovery.
assert.equal(localOwnerAlive({hostname:hostname(),pid:current.health[0].value.pid}),true);
assert.equal(localOwnerAlive(record.runtime.owner),false);
const output=new URL('tests/.tmp/pi-pressure-evidence/phase3c-live-recovery.json',root);
const evidence={scope:'same original operation, official deployed loopback HTTP MCP Pi ingress',
  intent_id:intent.intent_id,operation_id:state.operation_id,intent_hash:state.intent_hash,
  prior_status:record,owner_liveness_verified:false,calls:[],mutation_submissions:0,
  replacement_intents:0,production_routing_changed:false};
evidence.owner_liveness_verified=true;
const save=()=>writeFile(output,JSON.stringify(evidence,null,2)+'\n');
const transport=new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8787/mcp'));
const client=new Client({name:'pi-phase3c-same-intent-recovery',version:'1'});
let safeToClose=true;
await save();
try{
  await client.connect(transport);evidence.own_session_id=transport.sessionId;
  async function call(name,args,timeout=300000){
    const row={name,started_utc:new Date().toISOString()};evidence.calls.push(row);await save();
    const start=performance.now();
    try{const result=decode(await client.callTool({name,arguments:args},undefined,{timeout}));
      row.duration_ms=performance.now()-start;row.result=result;row.ok=true;await save();return result;
    }catch(error){row.duration_ms=performance.now()-start;row.error={name:error.name,code:error.code,message:error.message};await save();throw error;}
  }
  const health=await call('dev_workspace_journal_status',{});
  assert.equal(health.health,'healthy');assert.equal(health.chain_verified,true);assert.equal(health.dangling_operation_count,0);
  const planner=createMcpCapabilityAdapter();
  for(const action of intent.requested_actions){
    const args={reconciliation_key:action.idempotency_key};
    if(action.step_id==='begin'){
      const step=planner.describe(intent,action.step_id);
      args.request_fingerprint_sha256=hashExecutionInput({tool_name:step.tool,arguments:step.arguments});
    }
    const observation=await call('dev_workspace_get_operation',args);
    assert.equal(observation.reconciliation_key,action.idempotency_key);
    assert.equal(observation.reconciliation_state,'not_admitted');
    assert.equal(observation.safe_to_reinitiate,true);assert.equal(observation.reinitiate_requires_same_key,true);
  }
  // Pi will re-read/validate history, enforce owner liveness and revision CAS,
  // and reconcile a durable claim if another worker changed the state meanwhile.
  safeToClose=false;evidence.mutation_submissions=1;await save();
  const result=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(prior.submitted_live_intent)},900000);
  assert.equal(result.state.operation_id,state.operation_id);
  assert.equal(result.state.intent_hash,state.intent_hash);
  evidence.resume_result=result;
  const observed=await call('dev_pi_execution_status',{operation_id:state.operation_id,bootstrap:true});
  evidence.authoritative_post_status=observed;
  assert.equal(observed.operation.state.operation_id,state.operation_id);
  evidence.journal=await call('dev_workspace_journal_status',{});
  evidence.checkpoint=await call('dev_workspace_checkpoint_status',{});
  evidence.terminal_status=observed.operation.state.status;
  safeToClose=['COMPLETED','FAILED','CANCELLED','DECISION_REQUIRED','BLOCKED'].includes(evidence.terminal_status)
    &&observed.operation.runtime.active_call===null;
  evidence.completed_status_retrieval=true;
}catch(error){evidence.blocker={name:error.name,code:error.code,message:error.message};}
finally{
  if(safeToClose){
    await transport.terminateSession().then(()=>evidence.own_session_closed=true).catch(()=>evidence.own_session_closed=false);
    await client.close();
  }else{
    // Never DELETE an executing/unknown mutation session merely to end a caller.
    evidence.session_retained_for_unknown_outcome=true;
    evidence.next_action='Query the SAME original operation; preserve this HTTP session until Pi reconciliation proves safe closure. Never resubmit a mutation blindly.';
  }
  await save();
}
console.log(JSON.stringify({output:output.href,status:evidence.terminal_status,blocker:evidence.blocker,
  session_retained:evidence.session_retained_for_unknown_outcome,mutation_submissions:evidence.mutation_submissions},null,2));
