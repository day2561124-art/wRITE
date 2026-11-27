// Experimental control-plane probe, not an enrolled verifier or an execution
// authorization. Azure Batch task identities are not GitHub job identities.
// Do not feed this observation into the current GitHub receipt schema.
const id=/^[A-Za-z0-9_-]{1,64}$/u;
const sha=/^[a-f0-9]{40}$/u;
const digest=/^[a-f0-9]{64}$/u;
const label=/^[A-Za-z0-9_.-]{1,100}$/u;
const exact=(v,keys)=>v!==null&&typeof v==="object"&&!Array.isArray(v)
  &&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length
  &&keys.every(k=>Object.hasOwn(v,k));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const denial=code=>Object.freeze({observed:false,code,execution_authorized:false});
const date=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T/u.test(v)?Date.parse(v):NaN;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const version="2025-06-01";

export function createAzureBatchTaskReadClient({endpoint,readCredential,fetchImpl=globalThis.fetch}={}) {
  if(typeof endpoint!=="string"||!/^https:\/\/[a-z0-9]+\.[a-z0-9-]+\.batch\.azure\.com$/u.test(endpoint)
    ||typeof readCredential!=="function"||typeof fetchImpl!=="function") fail("AZURE_BATCH_HOST_UNBOUND");
  return async function readTask({job_id,task_id,if_match}={}) {
    if(typeof job_id!=="string"||!id.test(job_id)||typeof task_id!=="string"||!id.test(task_id)
      ||(if_match!==undefined&&(typeof if_match!=="string"||!if_match.length||if_match.length>256||/[\r\n]/u.test(if_match))))
      fail("AZURE_BATCH_TASK_IDENTITY_INVALID");
    try {
      const token=await readCredential();
      if(typeof token!=="string"||!/^[-A-Za-z0-9_.~+/=]{20,16384}$/u.test(token)) fail("AZURE_BATCH_READ_UNAVAILABLE");
      const url=endpoint+"/jobs/"+encodeURIComponent(job_id)+"/tasks/"+encodeURIComponent(task_id)+"?api-version="+version;
      const response=await fetchImpl(url,{method:"GET",redirect:"error",cache:"no-store",
        headers:{Authorization:"Bearer "+token,Accept:"application/json",...(if_match?{"If-Match":if_match}:{})},
        signal:AbortSignal.timeout(15000)});
      if(response.status!==200||response.redirected||!response.body
        ||Number(response.headers.get("content-length")??0)>1024*1024) fail("AZURE_BATCH_READ_UNAVAILABLE");
      const reader=response.body.getReader(),chunks=[];let size=0;
      try {
        for(;;){const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;if(size>1024*1024){await reader.cancel();fail("AZURE_BATCH_READ_UNAVAILABLE");}
          chunks.push(Buffer.from(value));}
      }finally{reader.releaseLock();}
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }catch{fail("AZURE_BATCH_READ_UNAVAILABLE");}
  };
}

const bindingFields=["job_id","task_id","pool_id","creation_time","commit","suite","platform",
  "definition_sha256","command_line","max_wall_clock_time"];
const validBinding=b=>exact(b,bindingFields)
  &&["job_id","task_id","pool_id"].every(k=>typeof b[k]==="string"&&id.test(b[k]))
  &&positive(date(b.creation_time))&&typeof b.commit==="string"&&sha.test(b.commit)
  &&typeof b.suite==="string"&&label.test(b.suite)&&["windows","linux"].includes(b.platform)
  &&typeof b.definition_sha256==="string"&&digest.test(b.definition_sha256)
  &&typeof b.command_line==="string"&&b.command_line.length>0&&b.command_line.length<=4096&&!/[\r\n\0]/u.test(b.command_line)
  &&typeof b.max_wall_clock_time==="string"&&/^PT(?:[1-9]\d*H)?(?:[1-9]\d*M)?(?:[1-9]\d*S)?$/u.test(b.max_wall_clock_time)
  &&b.max_wall_clock_time!=="PT";

// The independent host resolves an immutable submission record. This probe
// only reads provider-owned task observations. It does not establish image,
// pool, launcher or artifact provenance, or certify that a suite was run.
export function createAzureBatchTaskOutcomeProbe({readTask,resolveSubmission,clock=Date.now,maxAgeMs=600000}={}) {
  if([readTask,resolveSubmission,clock].some(f=>typeof f!=="function")
    ||!positive(maxAgeMs)||maxAgeMs>604800000) fail("AZURE_BATCH_HOST_UNBOUND");
  return async function observe(submissionId) {
    if(typeof submissionId!=="string"||!id.test(submissionId))return denial("AZURE_BATCH_SUBMISSION_INVALID");
    try {
      const b=structuredClone(await resolveSubmission(submissionId));
      if(!validBinding(b))return denial("AZURE_BATCH_SUBMISSION_UNVERIFIED");
      const args={job_id:b.job_id,task_id:b.task_id};
      const t=await readTask(args);
      if(t?.id!==b.task_id||t?.creationTime!==b.creation_time||t?.commandLine!==b.command_line
        ||t?.nodeInfo?.poolId!==b.pool_id||typeof t.nodeInfo?.nodeId!=="string"
        ||!t.nodeInfo.nodeId||t.userIdentity?.autoUser?.scope!=="task"
        ||t.userIdentity?.autoUser?.elevationLevel!=="nonadmin"||t.userIdentity?.username!==undefined
        ||t.multiInstanceSettings!==undefined||t.containerSettings!==undefined
        ||t.constraints?.maxTaskRetryCount!==0||t.constraints?.maxWallClockTime!==b.max_wall_clock_time
        ||typeof t.eTag!=="string"||!t.eTag||t.eTag.length>256)
        return denial("AZURE_BATCH_TASK_BINDING_MISMATCH");
      if(t.state!=="completed")return denial("AZURE_BATCH_TASK_NOT_COMPLETE");
      const x=t.executionInfo,now=clock(),start=date(x?.startTime),end=date(x?.endTime);
      if(x?.retryCount!==0||x?.requeueCount!==0||x?.lastRetryTime!==undefined||x?.lastRequeueTime!==undefined)
        return denial("AZURE_BATCH_ATTEMPT_UNVERIFIED");
      if(!positive(now)||!positive(start)||!positive(end)||start<date(b.creation_time)
        ||end<start||end>now||now-end>maxAgeMs)
        return denial("AZURE_BATCH_TASK_TIME_UNVERIFIED");
      if(!Number.isInteger(x.exitCode)||x.exitCode< -2147483648||x.exitCode>2147483647
        ||!["success","failure"].includes(x.result))
        return denial("AZURE_BATCH_PROCESS_RESULT_UNAVAILABLE");
      const again=await readTask({...args,if_match:t.eTag});
      const stable=JSON.stringify(again)===JSON.stringify(t);
      if(!stable||JSON.stringify(await resolveSubmission(submissionId))!==JSON.stringify(b))
        return denial("AZURE_BATCH_TASK_CHANGED");
      // No pass inference. Even an exit code of zero does not prove the
      // candidate's exact mandatory suite, immutable launcher or cleanup.
      return Object.freeze({observed:true,code:"AZURE_BATCH_TASK_EXIT_OBSERVED",
        provider:"azure_batch",submission_id:submissionId,job_id:b.job_id,task_id:b.task_id,
        pool_id:b.pool_id,node_id:t.nodeInfo.nodeId,etag:t.eTag,commit:b.commit,suite:b.suite,
        platform:b.platform,definition_sha256:b.definition_sha256,started_at_ms:start,completed_at_ms:end,
        exit_code:x.exitCode,provider_result:x.result,provider_failure_code:typeof x.failureInfo?.code==="string"
          ? x.failureInfo.code.slice(0,128):null,execution_authorized:false,validation_certified:false});
    }catch{return denial("AZURE_BATCH_TASK_OBSERVATION_UNAVAILABLE");}
  };
}
