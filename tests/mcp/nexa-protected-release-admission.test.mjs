import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import test from "node:test";
import { admitProtectedRelease, canonicalReleaseTicket } from "../../server/src/nexa-protected-release-admission.mjs";

const {publicKey, privateKey} = generateKeyPairSync("ed25519");
const trustedKey = publicKey.export({type:"spki", format:"pem"});
const nowMs = 1795550000000;
const ticket = Object.freeze({
  schema_version:1, repository:"day2561124-art/wRITE", channel:"protected-stable",
  sequence:10, from_commit:"a".repeat(40), to_commit:"b".repeat(40),
  artifact_sha256:"c".repeat(64), artifact_bytes:123456, ci_run_id:45441525554,
  issued_at_ms:nowMs-1000, expires_at_ms:nowMs+1000,
});
const state = Object.freeze({active_commit:ticket.from_commit,last_reserved_sequence:9,pending_release:null});
function input(overrides={}, signingKey=privateKey) {
  const ticketBytes=canonicalReleaseTicket({...ticket,...overrides});
  return {ticketBytes, signature:sign(null,ticketBytes,signingKey).toString("base64"),trustedKey,state,nowMs};
}
function refuses(args,code) { assert.throws(()=>admitProtectedRelease(args),{code}); }

test("independently signed exact candidate is admitted only as a verification result, not execution authority",()=>{
  const args=input(), admitted=admitProtectedRelease(args);
  assert.equal(admitted.admission,"verified_ticket_only");
  assert.equal(admitted.deployment_authorized,false);
  assert.equal(admitted.to_commit,ticket.to_commit);
  assert.equal(admitted.ticket_sha256,createHash("sha256").update(args.ticketBytes).digest("hex"));
  assert(Object.isFrozen(admitted));
});
test("signature cannot be reused for changed commit, digest, sequence or CI run",()=>{
  for(const overrides of [{to_commit:"d".repeat(40)},{artifact_sha256:"d".repeat(64)},{sequence:11},{ci_run_id:1}]) {
    refuses({...input(overrides),signature:input().signature},"RELEASE_SIGNATURE_INVALID");
  }
});
test("dispatcher-controlled signing key and malformed or wrong algorithm trust keys are rejected",()=>{
  const other=generateKeyPairSync("ed25519");
  refuses(input({},other.privateKey),"RELEASE_SIGNATURE_INVALID");
  refuses({...input(),trustedKey:"not a key"},"RELEASE_TRUST_KEY_INVALID");
  const rsa=generateKeyPairSync("rsa",{modulusLength:2048});
  refuses({...input(),trustedKey:rsa.publicKey.export({format:"pem",type:"spki"})},"RELEASE_TRUST_KEY_INVALID");
});
test("no ambiguous JSON, extra fields, wrong channel, unrelated repository, URLs or arbitrary script inputs",()=>{
  const args=input();
  const extra=Buffer.from(args.ticketBytes.toString().replace(/}$/,',"command":"anything"}'));
  refuses({...args,ticketBytes:extra},"RELEASE_TICKET_INVALID");
  for(const bytes of [
    Buffer.concat([args.ticketBytes,Buffer.from("\n")]),
    Buffer.from(args.ticketBytes.toString().replace(/}$/,',"sequence":10}')),
    Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(ticket).reverse()))),
  ]) refuses({...args,ticketBytes:bytes},"RELEASE_TICKET_NONCANONICAL");
  for(const overrides of [{repository:"other/repo"},{channel:"dev"},{from_commit:"HEAD"},{to_commit:ticket.from_commit},{artifact_bytes:0},{artifact_bytes:2**31},{ci_run_id:0},{sequence:0},{expires_at_ms:nowMs+86400001}]) {
    assert.throws(()=>input(overrides),{code:"RELEASE_TICKET_INVALID"});
  }
});
test("expired, future, stale sequence, wrong current version and pending release remain fail-closed",()=>{
  refuses({...input(),nowMs:ticket.expires_at_ms},"RELEASE_TICKET_EXPIRED");
  refuses({...input(),nowMs:ticket.issued_at_ms-1},"RELEASE_TICKET_EXPIRED");
  refuses({...input(),state:{...state,last_reserved_sequence:10}},"RELEASE_SEQUENCE_REPLAY");
  refuses({...input(),state:{...state,active_commit:"d".repeat(40)}},"RELEASE_ACTIVE_COMMIT_MISMATCH");
  refuses({...input(),state:{...state,pending_release:{sequence:9}}},"RELEASE_RECONCILIATION_REQUIRED");
  refuses({...input(),state:{...state,last_reserved_sequence:-1}},"RELEASE_HOST_STATE_INVALID");
});
test("bounded bytes and canonical Ed25519 signature encoding are mandatory",()=>{
  refuses({...input(),ticketBytes:Buffer.alloc(8193)},"RELEASE_TICKET_INVALID");
  refuses({...input(),signature:input().signature.trimEnd().slice(0,-2)},"RELEASE_SIGNATURE_INVALID");
  refuses({...input(),signature:"A".repeat(86)+"=="},"RELEASE_SIGNATURE_INVALID");
});
