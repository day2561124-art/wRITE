import { createPublicKey, verify } from "node:crypto";

// Independent process supervisor evidence. The pinned supervisor key must
// belong to the independently operated execution boundary, not the candidate
// or the receipt issuer. The source must be bound by the trusted verifier
// host; neither candidate output nor provider status may manufacture it.
const exact = (v, keys) => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length
  && keys.every(k => Object.hasOwn(v,k));
const positive = n => Number.isSafeInteger(n) && n > 0;
const label = /^[A-Za-z0-9_.-]{1,100}$/u;
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const repo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const bindingFields = ["suite","platform","workflow_sha256","commit","run_id","job_id","run_attempt","completed_at_ms"];
const outcomeFields = ["execution_ok","passed","timed_out","skipped","exit_code"];
const bodyFields = ["schema_version","supervisor","repository","binding","observed_at_ms","expires_at_ms","outcome"];
const validBinding = b => exact(b,bindingFields)
  && typeof b.suite === "string" && label.test(b.suite)
  && ["windows","linux"].includes(b.platform)
  && typeof b.workflow_sha256 === "string" && digest.test(b.workflow_sha256)
  && typeof b.commit === "string" && sha.test(b.commit)
  && ["run_id","job_id","run_attempt","completed_at_ms"].every(k=>positive(b[k]));
const fail = code => { throw Object.assign(new Error(code),{code}); };
const asKey = k => k?.type === "public" ? k : createPublicKey(k);

export function createIndependentTestOutcomeObserver({repository, supervisor, pinnedSupervisorKey,
  pinnedIssuerKey, readAttestation, maxAgeMs, clock = Date.now} = {}) {
  if (typeof repository !== "string" || !repo.test(repository) || typeof supervisor !== "string"
    || !label.test(supervisor) || !positive(maxAgeMs) || maxAgeMs > 604800000
    || typeof readAttestation !== "function" || typeof clock !== "function"
    || !pinnedSupervisorKey || !pinnedIssuerKey)
    fail("INDEPENDENT_OUTCOME_HOST_UNBOUND");
  const key = asKey(pinnedSupervisorKey), issuer = asKey(pinnedIssuerKey);
  if (key.asymmetricKeyType !== "ed25519" || issuer.asymmetricKeyType !== "ed25519"
    || key.export({type:"spki",format:"der"}).equals(issuer.export({type:"spki",format:"der"})))
    fail("INDEPENDENT_OUTCOME_KEY_INVALID");

  return async function observeTestOutcome(binding) {
    if (!validBinding(binding)) fail("INDEPENDENT_OUTCOME_BINDING_INVALID");
    const expected = structuredClone(binding);
    let envelope;
    try { envelope = await readAttestation(Object.freeze({...expected})); }
    catch { fail("INDEPENDENT_OUTCOME_SOURCE_UNAVAILABLE"); }
    if (!exact(envelope,["payload","signature"]) || typeof envelope.payload !== "string"
      || Buffer.byteLength(envelope.payload,"utf8") > 16384 || typeof envelope.signature !== "string"
      || !/^[A-Za-z0-9_-]{86}$/u.test(envelope.signature))
      fail("INDEPENDENT_OUTCOME_ENVELOPE_INVALID");
    const bytes = Buffer.from(envelope.payload,"utf8"), signature = Buffer.from(envelope.signature,"base64url");
    if (signature.length !== 64 || signature.toString("base64url") !== envelope.signature
      || !verify(null,bytes,key,signature)) fail("INDEPENDENT_OUTCOME_SIGNATURE_INVALID");
    let body;
    try { body=JSON.parse(envelope.payload); }
    catch { fail("INDEPENDENT_OUTCOME_PAYLOAD_INVALID"); }
    if (!exact(body,bodyFields) || JSON.stringify(body)!==envelope.payload || body.schema_version!==1
      || body.supervisor!==supervisor || body.repository!==repository || !validBinding(body.binding)
      || bindingFields.some(k=>body.binding[k]!==expected[k]))
      fail("INDEPENDENT_OUTCOME_BINDING_MISMATCH");
    const now=clock();
    if (!positive(now) || !positive(body.observed_at_ms) || !positive(body.expires_at_ms)
      || body.observed_at_ms<expected.completed_at_ms || body.observed_at_ms>now
      || body.expires_at_ms<=now || body.expires_at_ms<=body.observed_at_ms
      || body.expires_at_ms-body.observed_at_ms>maxAgeMs || now-expected.completed_at_ms>maxAgeMs
      || body.expires_at_ms-expected.completed_at_ms>maxAgeMs)
      fail("INDEPENDENT_OUTCOME_EXPIRED");
    const outcome=body.outcome;
    // Preserve the signed raw exit code and flags, including failures.
    // The receipt issuer, not this observer, determines positive acceptance.
    if (!exact(outcome,outcomeFields)
      || outcomeFields.slice(0,4).some(k=>typeof outcome[k]!=="boolean")
      || !(outcome.exit_code===null || Number.isSafeInteger(outcome.exit_code))
      || (outcome.passed && (!outcome.execution_ok || outcome.timed_out || outcome.skipped || outcome.exit_code!==0)))
      fail("INDEPENDENT_OUTCOME_RESULT_INVALID");
    return Object.freeze({...expected,...outcome});
  };
}
