import test from "node:test";
import assert from "node:assert/strict";
import {createAzureBatchTaskReadClient,createAzureBatchTaskOutcomeProbe} from "../../server/src/mcp-independent-verification-azure-batch-probe.mjs";
test("Azure Batch probe reads stable task outcomes and never claims suite certification",async()=>{
  const now=Date.parse("2026-11-27T12:00:00Z");
  const binding={job_id:"job-1",task_id:"task-1",pool_id:"pool-1",creation_time:"2026-11-27T11:59:00Z",
    commit:"1".repeat(40),suite:"all",platform:"windows",definition_sha256:"2".repeat(64),
    command_line:"C:\\NexaProbe\\fixed-gate.exe",max_wall_clock_time:"PT30M"};
  const task={id:binding.task_id,creationTime:binding.creation_time,commandLine:binding.command_line,
    nodeInfo:{poolId:binding.pool_id,nodeId:"node-1"},userIdentity:{autoUser:{scope:"task",elevationLevel:"nonadmin"}},
    constraints:{maxTaskRetryCount:0,maxWallClockTime:"PT30M"},eTag:"etag-1",state:"completed",
    executionInfo:{startTime:"2026-11-27T11:59:10Z",endTime:"2026-11-27T11:59:50Z",retryCount:0,requeueCount:0,result:"success",exitCode:0}};
  const endpoint="https://fixture.westeurope.batch.azure.com",token="fixture_readonly_token_12345";
  let calls=[],current=structuredClone(task),changeSecond=false,code=200;
  const readTask=createAzureBatchTaskReadClient({endpoint,readCredential:async()=>token,fetchImpl:async(url,opts)=>{
    assert.equal(url,endpoint+"/jobs/job-1/tasks/task-1?api-version=2025-06-01");
    assert.equal(opts.method,"GET");assert.equal(opts.redirect,"error");assert.equal(opts.headers.Authorization,"Bearer "+token);
    calls.push(opts.headers["If-Match"]??null);
    const value=structuredClone(current);
    if(changeSecond&&opts.headers["If-Match"])value.eTag="changed";
    return new Response(JSON.stringify(value),{status:code});
  }});
  const probe=createAzureBatchTaskOutcomeProbe({readTask,resolveSubmission:async id=>{
    assert.equal(id,"submission-1");return binding;
  },clock:()=>now});
  const accepted=await probe("submission-1");
  assert.equal(accepted.observed,true);
  assert.equal(accepted.exit_code,0);assert.equal(accepted.provider_result,"success");
  assert.equal(accepted.validation_certified,false);assert.equal(accepted.execution_authorized,false);
  assert.equal(accepted.passed,undefined);assert.deepEqual(calls,[null,"etag-1"]);
  current.executionInfo={...task.executionInfo,exitCode:7,result:"failure",failureInfo:{code:"TaskFailure"}};
  const failed=await probe("submission-1");assert.equal(failed.observed,true);assert.equal(failed.exit_code,7);
  assert.equal(failed.provider_failure_code,"TaskFailure");assert.equal(failed.validation_certified,false);
  for(const [mutate,expected] of [
    [t=>t.executionInfo.retryCount=1,"AZURE_BATCH_ATTEMPT_UNVERIFIED"],
    [t=>t.executionInfo.requeueCount=1,"AZURE_BATCH_ATTEMPT_UNVERIFIED"],
    [t=>delete t.executionInfo.exitCode,"AZURE_BATCH_PROCESS_RESULT_UNAVAILABLE"],
    [t=>t.state="running","AZURE_BATCH_TASK_NOT_COMPLETE"],
    [t=>t.commandLine="substituted","AZURE_BATCH_TASK_BINDING_MISMATCH"],
    [t=>t.userIdentity.autoUser.elevationLevel="admin","AZURE_BATCH_TASK_BINDING_MISMATCH"],
    [t=>t.nodeInfo.poolId="other","AZURE_BATCH_TASK_BINDING_MISMATCH"],
    [t=>t.executionInfo.endTime="2026-11-27T12:00:01Z","AZURE_BATCH_TASK_TIME_UNVERIFIED"],
  ]){
    current=structuredClone(task);mutate(current);
    assert.equal((await probe("submission-1")).code,expected);
  }
  current=structuredClone(task);changeSecond=true;
  assert.equal((await probe("submission-1")).code,"AZURE_BATCH_TASK_CHANGED");
  changeSecond=false;code=412;
  assert.equal((await probe("submission-1")).code,"AZURE_BATCH_TASK_OBSERVATION_UNAVAILABLE");
  assert.equal((await probe("../other")).code,"AZURE_BATCH_SUBMISSION_INVALID");
  assert.throws(()=>createAzureBatchTaskReadClient({endpoint:"https://untrusted.example",readCredential:async()=>token}),/AZURE_BATCH_HOST_UNBOUND/);
  await assert.rejects(readTask({job_id:"../other",task_id:"task-1"}),/AZURE_BATCH_TASK_IDENTITY_INVALID/);
});
