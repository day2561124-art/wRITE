// Read-only controller diagnostic on the existing journal. No initialize,
// publication recovery, append, dispatch, route change or persistent cache.
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {randomUUID, createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDevOperationJournalService} from '../server/src/mcp-development-journal-tools.mjs';
import {createPiProductionRouteStore} from '../server/src/pi-production-execution-route.mjs';
import {createPiProductionExecutionController} from '../server/src/pi-production-execution-controller.mjs';
import {runRequestTrace, requestTraceChannel} from '../server/src/mcp-request-tracing.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const storage=path.resolve(root,'../data/outputs/logs/development_runtime/operation-journal');
await realpath(path.join(storage,'events')); // Require existing storage; never initialize it.
const phase3=JSON.parse(await readFile(path.join(root,'docs/PI-RUNTIME-PRESSURE-PHASE3.evidence.json'),'utf8'));
const args={operation_id:'pi_operation_ab4776c172b84bfa921ee99117a6728d',context:phase3.submitted_live_intent.context};
const journal=createDevOperationJournalService({storageRoot:storage});
const stages=[],spans=[],requests=[];
const denied=()=>{throw Error('READONLY_DIAGNOSTIC_WRITE_OR_DISPATCH_DENIED');};
const binding={appendExecutionProjection:denied,appendProductionRoute:denied,recoverExecutionPublication:denied};
for(const method of ['readExecutionProjections','readProductionRoutes'])binding[method]=async()=>{
  const start=performance.now();let ok=false;
  let errorCode;
  try{const result=await journal[method]();ok=true;return result;}
  catch(error){errorCode=error.code??error.name;throw error;}
  finally{stages.push({method,duration_ms:performance.now()-start,ok,...(errorCode?{error_code:errorCode}:{})});}
};
const controller=createPiProductionExecutionController({journal:binding,route:createPiProductionRouteStore({journal:binding}),
  transport:{callTool:denied,resolveWorkspace:denied,queryOperation:denied}});
const listener=row=>spans.push(row);requestTraceChannel.subscribe(listener);
const output=path.resolve(process.argv[2]??path.join(root,'tests/.tmp/pi-pressure-evidence/phase3c-status-baseline.json'));
const evidence={scope:'read-only candidate controller on live journal, not HTTP or ChatGPT E2E',
  controller_sha256:createHash('sha256').update(await readFile(new URL('../server/src/pi-production-execution-controller.mjs',import.meta.url))).digest('hex'),
  stages,spans,requests,mutations_submitted:0};
try{
  for(let i=0;i<Number(process.argv[3]??2);i++){
    const correlation_id=randomUUID(),start=performance.now(),firstStage=stages.length;
    const result=await runRequestTrace(correlation_id,async()=>{
      if(controller.inspectStatus)return controller.inspectStatus(args);
      return {route:await controller.status(),operation:await controller.inspect(args)};
    });
    requests.push({correlation_id,duration_ms:performance.now()-start,stage_range:[firstStage,stages.length],
      operation_id:result.operation.state.operation_id,revision:result.operation.revision,status:result.operation.state.status,
      route_hash:result.route.route_hash,result_sha256:createHash('sha256').update(JSON.stringify(result)).digest('hex')});
    await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
  }
}catch(error){evidence.blocker={code:error.code??error.name};throw error;}
finally{requestTraceChannel.unsubscribe(listener);await writeFile(output,JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({output,requests,reads:stages.length},null,2));
