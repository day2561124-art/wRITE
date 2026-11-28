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


test("protected supervisor publishes actual fixture process outcomes once, preserves failures and rejects drift",async t=>{
  const {mkdtemp,rm,readdir,readFile}=await import("node:fs/promises");
  const {default:os}=await import("node:os");
  const {default:path}=await import("node:path");
  const {spawnSync}=await import("node:child_process");
  const {createIndependentOutcomeAttestationPublisher,createIndependentOutcomeAttestationReader,
    independentOutcomeAttestationFilename}=await import("../../server/src/mcp-independent-verification-receipt-store.mjs");
  const root=await mkdtemp(path.join(os.tmpdir(),"r16-outcome-publish-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const {realpath}=await import("node:fs/promises");
  const directory=await realpath(root);
  const supervisor=generateKeyPairSync("ed25519"),issuer=generateKeyPairSync("ed25519");
  const now=1795755600000;
  let time=now,allowed=true,signs=0,reads=0,mutate=false;
  const records=new Map();
  function fixture(id,code,attempt) {
    const child=spawnSync(process.execPath,["-e","process.exit("+code+")"],{timeout:15000,windowsHide:true});
    assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,code);
    const binding={suite:"fixture",platform:process.platform==="win32"?"windows":"linux",
      workflow_sha256:"1".repeat(64),commit:"2".repeat(40),run_id:111,job_id:222,
      run_attempt:attempt,completed_at_ms:now-1000};
    records.set(id,{binding,outcome:{execution_ok:true,passed:child.status===0,
      timed_out:false,skipped:false,exit_code:child.status}});
    return binding;
  }
  const good=fixture("success",0,1),bad=fixture("failure",7,2),drift=fixture("drift",0,3);
  const assertProtectedDirectory=async a=>allowed&&a.directory===directory
    &&["outcome_supervisor","outcome_consumer"].includes(a.role);
  const opts={root:directory,assertProtectedDirectory,repository:"owner/disposable",supervisor:"fixture-supervisor",
    pinnedSupervisorKey:supervisor.publicKey,pinnedIssuerKey:issuer.publicKey,maxAgeMs:60000,ttlMs:10000,clock:()=>time,
    readObservation:async id=>{reads++;const v=structuredClone(records.get(id));if(mutate&&reads>1)v.outcome.passed=false;return v;},
    signPayload:async payload=>{signs++;return sign(null,payload,supervisor.privateKey);}};
  const publish=createIndependentOutcomeAttestationPublisher(opts);
  const observe=createIndependentTestOutcomeObserver({...opts,
    readAttestation:createIndependentOutcomeAttestationReader({root:directory,assertProtectedDirectory})});
  assert.throws(()=>createIndependentOutcomeAttestationPublisher({...opts,pinnedIssuerKey:supervisor.publicKey}),/KEY_INVALID/);
  await assert.rejects(publish({...good,exit_code:0}),/OBSERVATION_ID_INVALID/);
  assert.equal(signs,0);
  const result=await publish("success");
  assert.equal(result.created,true);assert.equal(result.execution_authorized,false);
  const name=independentOutcomeAttestationFilename(good),bytes=await readFile(path.join(directory,name));
  assert.equal((await observe(good)).exit_code,0);
  time+=100;
  assert.equal((await publish("success")).created,false);assert.equal(signs,1);
  assert.deepEqual(await readFile(path.join(directory,name)),bytes);
  await publish("failure");
  assert.equal((await observe(bad)).exit_code,7);assert.equal((await observe(bad)).passed,false);
  records.get("success").outcome.passed=false;
  await assert.rejects(publish("success"),/PUBLICATION_CONFLICT/);
  assert.deepEqual(await readFile(path.join(directory,name)),bytes);
  allowed=false;
  await assert.rejects(publish("drift"),/DIRECTORY_UNVERIFIED/);
  allowed=true;mutate=true;reads=0;
  await assert.rejects(publish("drift"),/OBSERVATION_CHANGED/);
  assert.ok(!(await readdir(directory)).includes(independentOutcomeAttestationFilename(drift)));
  mutate=false;
  const wrong=createIndependentOutcomeAttestationPublisher({...opts,signPayload:async payload=>sign(null,payload,issuer.privateKey)});
  await assert.rejects(wrong("drift"),/SIGNATURE_INVALID/);
  assert.equal((await readdir(directory)).length,2);
  time=now+10001;
  await assert.rejects(publish("success"),/EXPIRED/);
  assert.deepEqual(await readFile(path.join(directory,name)),bytes);
});
