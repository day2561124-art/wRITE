import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createIndependentTestOutcomeObserver } from "../../server/src/mcp-independent-verification-outcome.mjs";

test("independent process attestation requires a distinct supervisor key and exact fresh outcome",async()=>{
  const supervisor=generateKeyPairSync("ed25519"),issuer=generateKeyPairSync("ed25519");
  const now=1795755600000;
  const binding={suite:"all",platform:"linux",workflow_sha256:"1".repeat(64),commit:"2".repeat(40),
    run_id:111,job_id:222,run_attempt:2,completed_at_ms:now-2000};
  const outcome={execution_ok:true,passed:true,timed_out:false,skipped:false,exit_code:0};
  const body={schema_version:1,supervisor:"fixture-supervisor",repository:"owner/disposable",
    binding,observed_at_ms:now-1000,expires_at_ms:now+1000,outcome};
  const envelope=(value=body,key=supervisor.privateKey)=>{
    const payload=typeof value==="string"?value:JSON.stringify(value);
    return {payload,signature:sign(null,Buffer.from(payload),key).toString("base64url")};
  };
  let selected=envelope(),reads=0;
  const opts={repository:body.repository,supervisor:body.supervisor,pinnedSupervisorKey:supervisor.publicKey,
    pinnedIssuerKey:issuer.publicKey,maxAgeMs:60000,clock:()=>now,
    readAttestation:async b=>{reads++;assert.deepEqual(b,binding);assert.equal(Object.isFrozen(b),true);return selected;}};
  assert.throws(()=>createIndependentTestOutcomeObserver({...opts,pinnedIssuerKey:supervisor.publicKey}),/INDEPENDENT_OUTCOME_KEY_INVALID/);
  assert.throws(()=>createIndependentTestOutcomeObserver({...opts,readAttestation:undefined}),/INDEPENDENT_OUTCOME_HOST_UNBOUND/);
  const observe=createIndependentTestOutcomeObserver(opts);
  await assert.rejects(observe({...binding,exit_code:0}),/INDEPENDENT_OUTCOME_BINDING_INVALID/);
  assert.equal(reads,0);
  assert.deepEqual(await observe(binding),{...binding,...outcome});
  for(const [changed,code] of [
    [envelope(body,issuer.privateKey),"INDEPENDENT_OUTCOME_SIGNATURE_INVALID"],
    [envelope({...body,binding:{...binding,run_attempt:1}}),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [envelope({...body,binding:{...binding,job_id:223}}),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [envelope({...body,binding:{...binding,commit:"3".repeat(40)}}),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [envelope({...body,repository:"other/repo"}),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [envelope({...body,supervisor:"other"}),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [envelope({...body,expires_at_ms:now}),"INDEPENDENT_OUTCOME_EXPIRED"],
    [envelope({...body,observed_at_ms:now+1}),"INDEPENDENT_OUTCOME_EXPIRED"],
    [envelope({...body,expires_at_ms:binding.completed_at_ms+60001}),"INDEPENDENT_OUTCOME_EXPIRED"],
    [envelope({...body,outcome:{...outcome,exit_code:1}}),"INDEPENDENT_OUTCOME_RESULT_INVALID"],
    [envelope({...body,outcome:{...outcome,exit_code:"0"}}),"INDEPENDENT_OUTCOME_RESULT_INVALID"],
    [envelope(JSON.stringify(body).replace('"schema_version":1','"schema_version":1,"schema_version":1')),"INDEPENDENT_OUTCOME_BINDING_MISMATCH"],
    [{provider_job_conclusion:"success"},"INDEPENDENT_OUTCOME_ENVELOPE_INVALID"],
  ]){
    selected=changed;await assert.rejects(observe(binding),{code});
  }
  selected=envelope({...body,outcome:{...outcome,passed:false,exit_code:7}});
  assert.deepEqual(await observe(binding),{...binding,...outcome,passed:false,exit_code:7});
  selected=envelope({...body,outcome:{execution_ok:false,passed:false,timed_out:true,skipped:false,exit_code:null}});
  assert.deepEqual(await observe(binding),{...binding,execution_ok:false,passed:false,timed_out:true,skipped:false,exit_code:null});
  await assert.rejects(createIndependentTestOutcomeObserver({...opts,readAttestation:async()=>{throw Error("untrusted detail");}})(binding),
    {code:"INDEPENDENT_OUTCOME_SOURCE_UNAVAILABLE"});
});
