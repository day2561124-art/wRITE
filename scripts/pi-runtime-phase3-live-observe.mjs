// Read only the exact owned bootstrap events. No initialize, recovery or locks.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('..',import.meta.url));
const journal=path.resolve(source,'..','data/outputs/logs/development_runtime/operation-journal');
const intent_id='phase3-live-bootstrap-20261008-2146';
const before=await readFile(path.join(journal,'head.json'),'utf8');
const names=(await readdir(path.join(journal,'events'))).filter(name=>/^0000000513(5[5-9]|6[0-9])-dev_journal_event_[a-f0-9]{32}\.json$/u.test(name)).sort();
const events=[];
for(const name of names) {
  const event=JSON.parse(await readFile(path.join(journal,'events',name),'utf8'));
  if(event.result?.intent_id!==intent_id)continue;
  const projection=event.execution_projection;
  events.push({sequence:event.sequence,event_hash:event.event_hash,previous_event_hash:event.previous_event_hash,
    timestamp:event.timestamp,stage:event.stage,result:event.result,
    ...(projection?{state:projection.state.status,revision:projection.revision,owner:projection.runtime.owner,
      active_call:projection.runtime.active_call,lifecycle_binding:projection.runtime.lifecycle_binding}:{}),});
}
const latest=events.filter(row=>row.state).at(-1);
let owner_alive=null;
if(latest?.owner?.pid)try {process.kill(latest.owner.pid,0);owner_alive=true;}catch(error){owner_alive=error.code==='EPERM'?null:false;}
const result={scope:'local read-only observation of exact own live bootstrap event files; not authoritative full-chain status',
  observed_sequence_range:[51355,51369],head_sequence:JSON.parse(before).latest_sequence,
  bounded_range_truncated:JSON.parse(before).latest_sequence>51369,
  intent_id,events,latest_observed:latest,owner_alive_local_pid_only:owner_alive,
  head_unchanged:before===await readFile(path.join(journal,'head.json'),'utf8'),
  chain_verified:false,mutation_retries:0,blocker:'bootstrap and durable API query both HTTP 504; do not infer failed mutation',
  next_action:'Restore authoritative status query for the exact intent/operation; verify owner and history, then let Pi decide safe resume.'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({intent_id,state:latest?.state,operation_id:latest?.result.logical_operation_id,owner_alive},null,2));
