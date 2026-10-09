// Pure filesystem metadata observation of the canonical live journal.
// No initialize/verify call, lock creation, recovery, event read or mutation.
import {readdir,lstat,readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const workspace=fileURLToPath(new URL('..',import.meta.url));
const canonical=await realpath(path.resolve(workspace,'..'));
const root=path.join(canonical,'data/outputs/logs/development_runtime/operation-journal');
const events=path.join(root,'events');
const headBefore=await readFile(path.join(root,'head.json'),'utf8');
const start=performance.now();
const names=(await readdir(events)).sort();
const directory_ms=performance.now()-start;
const samples=[];
for(let pass=0;pass<5;pass++) {
  let next=0,files=0,bytes=0;
  const started=performance.now();
  await Promise.all(Array.from({length:8},async()=>{
    while(next<names.length) {
      const name=names[next++];
      if(!/^\d{12}-dev_journal_event_[a-f0-9]{32}\.json$/u.test(name))throw Error('UNEXPECTED_LIVE_EVENT_NAME');
      const info=await lstat(path.join(events,name),{bigint:true});
      if(!info.isFile()||info.isSymbolicLink())throw Error('UNSAFE_LIVE_EVENT_TYPE');
      files++;bytes+=Number(info.size);
    }
  }));
  samples.push({pass,ms:performance.now()-started,files,bytes});
}
const afterNames=(await readdir(events)).sort();
const headAfter=await readFile(path.join(root,'head.json'),'utf8');
const evidence={scope:'live filesystem metadata only; no chain verification/admission/queue measurement',
  event_count:names.length,directory_ms,samples,
  snapshot_unchanged:headBefore===headAfter&&JSON.stringify(names)===JSON.stringify(afterNames),
  prohibited_inference:'Do not treat these lstat-only measurements as actual Journal verify() duration or infer missing stages.'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
