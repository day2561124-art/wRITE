import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const percentile=(values,p)=>values[Math.max(0,Math.ceil(values.length*p)-1)]??null;
function stats(samples) {
  const sorted=samples.map(row=>row.ms).sort((a,b)=>a-b);
  const successes=samples.filter(row=>row.ok).length;
  return {calls:samples.length,successes,success_rate:samples.length?successes/samples.length:null,p50_ms:percentile(sorted,.5),
    p95_ms:percentile(sorted,.95),max_ms:sorted.at(-1)??null};
}
async function summarize(file) {
  const bytes=await readFile(file),e=JSON.parse(bytes);
  if(e.error)throw Error('INCOMPLETE_E2E_EVIDENCE');
  const queue=e.trace.filter(row=>row.kind==='queue'&&row.tool);
  const requests=e.samples.map((sample,index)=>{
    const request=sample.request_id??queue[index]?.request;
    const q=queue.find(row=>row.request===request);
    if(q?.tool!==sample.name)throw Error('TRACE_REQUEST_CORRELATION_FAILED');
    const stages={};
    for(const row of e.trace.filter(row=>row.kind==='span'&&row.request===request)) {
      const aggregate=stages[row.label]??={calls:0,inclusive_ms:0,exclusive_ms:0};
      aggregate.calls++;aggregate.inclusive_ms+=row.ms;aggregate.exclusive_ms+=row.exclusive_ms;
    }
    return {...sample,request_id:request,queue_wait_ms:q.ms,stages};
  });
  const group=ids=>stats(requests.filter(row=>ids.includes(Number(row.request_id))));
  return {raw_sha256:createHash('sha256').update(bytes).digest('hex'),scope:e.scope,
    baseline_commit:e.source_commit,server_sha256:e.server_sha256,
    normal:group([3,4,5,6,7,8,9,10]),concurrent4:group([14,15,16,17]),metadata_competition:group([19,20,21]),
    normal_metadata:group([1]),requests,runs:e.runs,context:e.context,
    duplicate_same_operation:e.duplicate_same_operation,unauthorized_no_dispatch:e.unauthorized_no_dispatch,
    nonzero:e.nonzero,timeout:e.timeout,physical_dispatches:e.physical_dispatches,journal:e.journal,
    uncorrelated_response_spans:e.trace.filter(row=>row.label==='mcp.serialize_and_write'),
    caveat:'Inclusive stages nest; do not add them. Response spans are aggregate only. SDK ingress is not ChatGPT/HTTP ingress.'};
}
const [baseline,candidate,live,output]=process.argv.slice(2);
const evidence={schema_version:1,baseline:await summarize(baseline),candidate:await summarize(candidate),
  live_metadata:JSON.parse(await readFile(live,'utf8')),
  phase1_preserved:{status_p50_ms:[1120,141],status_p95_ms:[1332,191],concurrent8_successes:['6/24','24/24']},
  online_e2e:'UNVERIFIED: no connector ingress/transport correlation or owned live ExecutionIntent operation',
  tests:{pre_change_focused:{passed:71,failed:0},final_affected:'pending'},
  remaining:['Correlate ChatGPT/HTTP transport and live readiness spans','Repeat online E2E in owned registered workspace',
    'Authoritative timeout reconciliation without replay','Quantify full Journal history growth with its active owner'],
};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({baseline:{normal:evidence.baseline.normal,concurrent:evidence.baseline.concurrent4,metadata:evidence.baseline.metadata_competition},
  candidate:{normal:evidence.candidate.normal,concurrent:evidence.candidate.concurrent4,metadata:evidence.candidate.metadata_competition}},null,2));
