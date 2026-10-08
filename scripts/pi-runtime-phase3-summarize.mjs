import {readFile,writeFile} from 'node:fs/promises';
const [httpFile,liveFile,output]=process.argv.slice(2);
const http=JSON.parse(await readFile(httpFile)),live=JSON.parse(await readFile(liveFile));
function stats(values) {
  const sorted=values.slice().sort((a,b)=>a-b),p=value=>sorted[Math.max(0,Math.ceil(sorted.length*value)-1)]??null;
  return {count:values.length,p50_ms:p(.5),p95_ms:p(.95),max_ms:sorted.at(-1)??null};
}
function calls(ids) {
  const rows=http.samples.filter(row=>ids.includes(Number(row.request_id)));
  return {...stats(rows.map(row=>row.ms)),successes:rows.filter(row=>row.ok).length,
    success_rate:rows.filter(row=>row.ok).length/rows.length};
}
const groups={};
for(const row of http.trace)(groups[row.stage]??=[]).push(row.duration_ms);
const stages=Object.fromEntries(Object.entries(groups).map(([name,values])=>[name,stats(values)]));
const evidence={schema_version:1,baseline_commit:'bf946c6f7c1e0033fef1525b924973d35cbf7daa',
  lease:{start_utc:'2026-10-08 13:46:19 UTC',deadline_utc:'2026-10-08 14:11:19 UTC'},
  verification_levels:{isolated_http_fixture:'verified',local_mcp_live_powershell:'blocked',chatgpt_http_production_e2e:'partial'},
  correlation:{status:'verified in fixture; candidate not deployed',protocol:'writer-workbench/request-trace/v1',
    privacy:'fixed allowlist only; no parameters, outputs, errors, paths or original request IDs',
    clock:'performance.now duration inside each process; no cross-process timestamp subtraction',
    collection:'256 record memory rings, async existing IPC batches <=64, pending <=256; no trace disk I/O',
    boundary:'HTTP body ingress to server response finish; external client/platform timing and TCP delivery unobserved'},
  benchmark:{normal:calls([3,4,5]),concurrent4:calls([9,10,11,12]),metadata_competition:calls([14,15,16]),
    retained_span_population:stages,caveat:'Quantiles per retained span, not complete request phase partitions; rings evict old spans, nested stages cannot be added. No causal performance improvement claim.'},
  http_fixture:http,live_observation:live,
  live_api:{route_status:{status:'verified',mode:'pi_default',wall_ms:61906,clock:'wall-only observation; not a monotonic benchmark'},
    bootstrap:{status:'partial',http_error:504,intent_id:live.intent_id,blind_retries:0},
    durable_query:{status:'blocked',http_error:504},production_routing_changed:false},
  timeout_recovery:{status:'partial',classification:'process timeout -> ambiguous effect -> JOURNAL_DEGRADED; same-intent retry refused without extra command',
    reconciliation_restored:'not tested; unknown command outcome must remain unresolved'},
  completed_response_loss:{status:'verified in isolated real HTTP fixture',...http.lost_response},
  transport_disconnect:{status:'verified by affected regression; fixture fault injection is completed HTTP response loss, not a physical network outage'},
  journal_cost:{status:'not tested this lease; active Journal owner avoided',previous_phase_metadata_only:true,
    authoritative_hash_chain:'verified only in isolated fixture'},
  tests:{focused:{passed:61,failed:0},http_affected:{passed:5,failed:0},final_http_privacy_reliability:'pending'},
  git_diff_check:'pending',
  next_action:'Restore authoritative status for phase3-live-bootstrap-20261008-2146 / pi_operation_ab4776c172b84bfa921ee99117a6728d, verify full history and owner, then use Pi safe resume; do not submit a new bootstrap or bypass routing.'};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence.benchmark,null,2));
