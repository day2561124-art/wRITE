// Fixed-fixture status comparison; never reads or modifies the live journal.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createDevOperationJournalService} from '../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController as candidate} from '../server/src/pi-production-execution-controller.mjs';
import {REQUIRED_DECISION_BOUNDARIES} from '../server/src/pi-execution-contract.mjs';
import {requestTraceChannel,runRequestTrace} from '../server/src/mcp-request-tracing.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const tempParent=path.join(root,'tests/.tmp/pi-pressure-evidence');
const temp=await mkdtemp(path.join(tempParent,'phase3c-benchmark-'));
const exec=promisify(execFile),baselineSha='a88f09d7344f0b624b2cc39fef1a070f3d271a3c';
const source=(await exec('git',['show',baselineSha+':server/src/pi-production-execution-controller.mjs'],{cwd:root,windowsHide:true})).stdout;
const baselineFile=path.join(temp,'baseline.mjs');
await writeFile(baselineFile,source.replace(/from "\.\/([^"\n]+)"/g,(_,name)=>'from '+JSON.stringify(new URL('../server/src/'+name,import.meta.url).href)));
const {createPiProductionExecutionController:baseline}=await import(pathToFileURL(baselineFile).href);
const context={project_id:'writer_workbench',workstream_id:'dev_workstream_20261003-153931_7730524b821e',workspace_id:'dev_workspace_65ed265de3494399b7ad40b2'};
const intent={schema_version:1,intent_id:'phase3c-status-benchmark-fixture',goal:'Status fixture only',context,
  constraints:['No live state'],requested_actions:[{step_id:'read',capability:'filesystem.read',input:{path:'package.json'},depends_on:[]}],
  mutation_plan:[],verification:{focused:[],affected:[],full:[]},completion_conditions:['Validate status'],
  permissions:{read:true,write:false,workspace_create:false,tests:false,commit:false,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
const evidence={scope:'isolated real-journal controller fixture; not local live MCP/HTTP/ChatGPT E2E',
  baseline_commit:baselineSha,requests:[],traces:[]};
const listener=row=>evidence.traces.push(row);requestTraceChannel.subscribe(listener);
try{
  const journal=createDevOperationJournalService({storageRoot:path.join(temp,'journal')});
  await createPiProductionRouteStore({journal}).change({mode:'pi_default',expected_revision:0,decision_id:'gpt-phase3c-benchmark',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
  const denied=()=>{throw Error('FIXTURE_STATUS_DISPATCH_DENIED');};
  const transport={callTool:denied,resolveWorkspace:denied,queryOperation:denied};
  const created=await baseline({journal,route:createPiProductionRouteStore({journal}),transport}).admit(intent);
  const args={operation_id:created.state.operation_id,context};
  let expected;
  for(let i=0;i<16;i++){
    const variant=i%2===0?'baseline':'candidate',stages=[];
    const binding={...journal};
    for(const method of ['readExecutionProjections','readProductionRoutes'])binding[method]=async()=>{
      const start=performance.now();try{return await journal[method]();}
      finally{stages.push({method,duration_ms:performance.now()-start});}
    };
    const host=(variant==='baseline'?baseline:candidate)({journal:binding,route:createPiProductionRouteStore({journal:binding}),transport});
    const correlation_id=randomUUID(),start=performance.now();
    const result=await runRequestTrace(correlation_id,async()=>host.inspectStatus?host.inspectStatus(args):
      {route:await host.status(),operation:await host.inspect(args)});
    const duration_ms=performance.now()-start;
    expected??=result;assert.deepEqual(result,expected);
    evidence.requests.push({variant,correlation_id,duration_ms,ok:true,stages});
  }
  const stats=rows=>{const a=rows.map(r=>r.duration_ms).sort((x,y)=>x-y);return {calls:rows.length,successes:rows.length,
    success_rate:1,p50_ms:a[Math.ceil(a.length*.5)-1],p95_ms:a[Math.ceil(a.length*.95)-1],max_ms:a.at(-1),
    projection_reads_per_request:rows[0].stages.filter(r=>r.method==='readExecutionProjections').length,
    route_reads_per_request:rows[0].stages.filter(r=>r.method==='readProductionRoutes').length};};
  evidence.baseline=stats(evidence.requests.filter(r=>r.variant==='baseline'));
  evidence.candidate=stats(evidence.requests.filter(r=>r.variant==='candidate'));
  evidence.exact_result_equality=true;
  const output=path.join(tempParent,'phase3c-status-fixture.json');
  await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({output,baseline:evidence.baseline,candidate:evidence.candidate},null,2));
}finally{
  requestTraceChannel.unsubscribe(listener);
  assert.equal(path.dirname(temp),tempParent);await rm(temp,{recursive:true,force:true});
}
