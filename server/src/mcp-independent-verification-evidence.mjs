import { createHash, createPublicKey, verify } from "node:crypto";

// Read-only evidence review. A trusted host must supply the pinned issuer key,
// immutable candidate and required suite plan. Neither the candidate, Pi nor
// MCP arguments may select the key, plan or freshness policy. A valid receipt
// is not an integration permission and does not perform any mutation.
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const candidateId = /^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const label = /^[A-Za-z0-9_.-]{1,100}$/u;
const repository = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const platforms = new Set(["windows", "linux"]);
const MAX_BYTES = 64 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const positive = n => Number.isSafeInteger(n) && n > 0;
const exact = (v, keys) => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fail = code => ({ verified: false, code, execution_authorized: false });
const identityKeys = ["integration_candidate_id", "revision", "integration_commit", "source_head", "target_head"];
const validIdentity = v => exact(v, identityKeys) && candidateId.test(v.integration_candidate_id)
  && positive(v.revision) && [v.integration_commit, v.source_head, v.target_head].every(s => typeof s === "string" && sha.test(s));
const planKeys = ["suite", "platform", "workflow_sha256"];
const validPlanEntry = v => exact(v, planKeys) && typeof v.suite === "string" && label.test(v.suite)
  && platforms.has(v.platform) && typeof v.workflow_sha256 === "string" && digest.test(v.workflow_sha256);
const rowKey = v => v.suite + ":" + v.platform;
const resultKeys = [...planKeys, "commit", "run_id", "job_id", "run_attempt", "completed_at_ms",
  "execution_ok", "passed", "timed_out", "skipped", "exit_code"];
const bodyKeys = ["schema_version", "issuer", "repository", "candidate", "issued_at_ms", "expires_at_ms", "results"];
const expectedKeys = ["repository", "candidate", "required", "issuer", "max_age_ms"];
const signaturePattern = /^[A-Za-z0-9_-]{86}$/u;

export function reviewIndependentVerification({ envelope, expected, pinnedPublicKey, nowMs } = {}) {
  if (!exact(expected, expectedKeys) || typeof expected.repository !== "string" || !repository.test(expected.repository)
    || !validIdentity(expected.candidate) || typeof expected.issuer !== "string" || !label.test(expected.issuer)
    || !positive(expected.max_age_ms) || expected.max_age_ms > MAX_AGE_MS
    || !positive(nowMs) || !Array.isArray(expected.required) || !expected.required.length || expected.required.length > 64
    || !expected.required.every(validPlanEntry)
    || new Set(expected.required.map(rowKey)).size !== expected.required.length) return fail("INVALID_TRUSTED_VERIFICATION_PLAN");
  if (!exact(envelope, ["payload", "signature"]) || typeof envelope.payload !== "string"
    || Buffer.byteLength(envelope.payload, "utf8") > MAX_BYTES
    || typeof envelope.signature !== "string" || !signaturePattern.test(envelope.signature))
    return fail("INVALID_VERIFICATION_ENVELOPE");
  // Signature covers exact UTF-8 bytes. Parse only after verification; do not
  // accept any candidate-provided public key or caller-declared trusted flag.
  try {
    const key = pinnedPublicKey?.type === "public" ? pinnedPublicKey : createPublicKey(pinnedPublicKey);
    const signature = Buffer.from(envelope.signature, "base64url");
    if (key.asymmetricKeyType !== "ed25519" || signature.length !== 64
      || signature.toString("base64url") !== envelope.signature
      || !verify(null, Buffer.from(envelope.payload, "utf8"), key, signature))
      return fail("VERIFICATION_SIGNATURE_INVALID");
  } catch { return fail("VERIFICATION_SIGNATURE_INVALID"); }
  let body;
  try { body = JSON.parse(envelope.payload); }
  catch { return fail("INVALID_VERIFICATION_PAYLOAD"); }
  // Require canonical serialization from the trusted issuer (no duplicate
  // keys, ignored trailing data or alternative JSON byte representations).
  if (JSON.stringify(body) !== envelope.payload || !exact(body, bodyKeys) || body.schema_version !== 1
    || !validIdentity(body.candidate) || !Array.isArray(body.results) || body.results.length > 64)
    return fail("INVALID_VERIFICATION_PAYLOAD");
  if (body.issuer !== expected.issuer || body.repository !== expected.repository
    || identityKeys.some(k => body.candidate[k] !== expected.candidate[k]))
    return fail("VERIFICATION_CANDIDATE_MISMATCH");
  if (!positive(body.issued_at_ms) || !positive(body.expires_at_ms)
    || body.issued_at_ms > nowMs || body.expires_at_ms <= nowMs
    || body.expires_at_ms <= body.issued_at_ms || body.expires_at_ms - body.issued_at_ms > expected.max_age_ms
    || nowMs - body.issued_at_ms > expected.max_age_ms) return fail("VERIFICATION_RECEIPT_EXPIRED");
  if (body.results.length !== expected.required.length) return fail("VERIFICATION_COVERAGE_MISMATCH");
  const required = new Map(expected.required.map(v => [rowKey(v), v]));
  const seen = new Set();
  for (const row of body.results) {
    if (!exact(row, resultKeys) || typeof row.suite !== "string" || !platforms.has(row.platform)
      || !positive(row.run_id) || !positive(row.job_id) || !positive(row.run_attempt)
      || !positive(row.completed_at_ms) || row.completed_at_ms > body.issued_at_ms
      || nowMs - row.completed_at_ms > expected.max_age_ms)
      return fail("INVALID_VERIFICATION_JOB");
    const key = rowKey(row), plan = required.get(key);
    if (!plan || seen.has(key) || row.workflow_sha256 !== plan.workflow_sha256)
      return fail("VERIFICATION_COVERAGE_MISMATCH");
    if (row.commit !== expected.candidate.integration_commit) return fail("VERIFICATION_CANDIDATE_MISMATCH");
    if (row.execution_ok !== true || row.passed !== true || row.timed_out !== false
      || row.skipped !== false || row.exit_code !== 0) return fail("VERIFICATION_SUITE_FAILED");
    seen.add(key);
  }
  return Object.freeze({ verified: true, code: "EXACT_CANDIDATE_EVIDENCE_VERIFIED",
    execution_authorized: false, integration_candidate_id: body.candidate.integration_candidate_id,
    candidate_revision: body.candidate.revision, integration_commit: body.candidate.integration_commit,
    receipt_sha256: createHash("sha256").update(envelope.payload, "utf8").digest("hex"),
    suite_count: seen.size, issuer: body.issuer, expires_at_ms: body.expires_at_ms });
}
