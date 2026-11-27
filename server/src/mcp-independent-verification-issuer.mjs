import { createPublicKey } from "node:crypto";
import { reviewIndependentVerification } from "./mcp-independent-verification-evidence.mjs";

// Independent verifier process only. No MCP endpoint and no key generation,
// secret loading, candidate-selected signer, dispatch, or integration grant.
// All dependencies belong to the already trusted verifier host. The caller
// can identify only a server-owned candidate and its exact revision.
const positive = n => Number.isSafeInteger(n) && n > 0;
const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const id = /^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const identityKeys = ["integration_candidate_id", "revision", "integration_commit", "source_head", "target_head"];
const identity = c => Object.fromEntries(identityKeys.map(k => [k, c[k]]));
const rowKey = v => v.suite + ":" + v.platform;
const reject = code => ({ issued: false, code, execution_authorized: false });
const planKeys = ["suite", "platform", "workflow_sha256"];
const bindingKeys = [...planKeys, "commit", "run_id", "job_id", "run_attempt", "completed_at_ms"];
const resultKeys = [...bindingKeys, "execution_ok", "passed", "timed_out", "skipped", "exit_code"];
function validContext(context, request) {
  const c = context?.candidate;
  return context?.observation_only === true && context.execution_authorized === false
    && c?.integration_candidate_id === request.integration_candidate_id && c.revision === request.expected_revision
    && ["integration_commit", "source_head", "target_head"].every(k => typeof c[k] === "string" && sha.test(c[k]))
    && Array.isArray(context.plan?.required_suites) && context.plan.required_suites.length > 0
    && context.plan.required_suites.every(s => typeof s === "string")
    && new Set(context.plan.required_suites).size === context.plan.required_suites.length;
}

export function createIndependentVerificationIssuer({ readContext, resolvePolicy, collectProviderObservation,
  observeTestOutcome, signPayload, pinnedPublicKey, clock = Date.now } = {}) {
  if ([readContext, resolvePolicy, collectProviderObservation, observeTestOutcome, signPayload, clock]
    .some(f => typeof f !== "function")) throw new Error("INDEPENDENT_ISSUER_HOST_UNBOUND");
  const key = pinnedPublicKey?.type === "public" ? pinnedPublicKey : createPublicKey(pinnedPublicKey);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("INDEPENDENT_ISSUER_KEY_INVALID");

  async function current(request) {
    const context = structuredClone(await readContext(Object.freeze({ ...request })));
    if (!validContext(context, request)) return null;
    const policy = structuredClone(await resolvePolicy(structuredClone(context)));
    if (!exact(policy, ["repository", "issuer", "required", "max_age_ms", "receipt_ttl_ms"])
      || typeof policy.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(policy.repository)
      || typeof policy.issuer !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/u.test(policy.issuer)
      || !positive(policy.max_age_ms) || policy.max_age_ms > 604800000
      || !positive(policy.receipt_ttl_ms) || policy.receipt_ttl_ms > policy.max_age_ms
      || !Array.isArray(policy.required) || !policy.required.length || policy.required.length > 64
      || !policy.required.every(r => exact(r, planKeys) && typeof r.suite === "string"
        && /^[A-Za-z0-9_.-]{1,100}$/u.test(r.suite) && ["windows", "linux"].includes(r.platform)
        && typeof r.workflow_sha256 === "string" && digest.test(r.workflow_sha256))
      || new Set(policy.required.map(rowKey)).size !== policy.required.length
      || !context.plan.required_suites.every(suite => policy.required.some(r => r.suite === suite))) return null;
    return { context, policy };
  }

  return async function issue(request) {
    if (!exact(request, ["integration_candidate_id", "expected_revision"])
      || typeof request.integration_candidate_id !== "string" || !id.test(request.integration_candidate_id)
      || !positive(request.expected_revision)) return reject("INVALID_INDEPENDENT_ISSUER_REQUEST");
    request = structuredClone(request);
    try {
      const initial = await current(request);
      if (!initial) return reject("INDEPENDENT_ISSUER_CONTEXT_UNVERIFIED");
      const { context, policy } = initial;
      const candidate = identity(context.candidate);
      const observed = await collectProviderObservation(Object.freeze(candidate), structuredClone(policy.required));
      if (observed?.observed !== true || observed.execution_authorized !== false
        || observed.commit !== candidate.integration_commit || !Array.isArray(observed.observations)
        || observed.observations.length !== policy.required.length
        || new Set(observed.observations.map(rowKey)).size !== policy.required.length)
        return reject("INDEPENDENT_ISSUER_PROVIDER_EVIDENCE_REQUIRED");
      const results = [];
      for (const required of policy.required) {
        const row = observed.observations.find(r => rowKey(r) === rowKey(required));
        if (!row || row.workflow_sha256 !== required.workflow_sha256 || row.commit !== candidate.integration_commit
          || !positive(row.run_id) || !positive(row.job_id) || !positive(row.run_attempt) || !positive(row.completed_at_ms)
          || row.provider_job_conclusion !== "success")
          return reject("INDEPENDENT_ISSUER_PROVIDER_EVIDENCE_REQUIRED");
        // A provider status is not a raw process exit code. The separately
        // bound trusted observer must establish the original mandatory gate's
        // semantics and outcome, without accepting candidate stdout/artifacts.
        const binding = Object.freeze(Object.fromEntries(bindingKeys.map(k => [k, row[k]])));
        const result = structuredClone(await observeTestOutcome(binding));
        if (!exact(result, resultKeys) || bindingKeys.some(k => result[k] !== binding[k])
          || result.execution_ok !== true || result.passed !== true || result.timed_out !== false
          || result.skipped !== false || result.exit_code !== 0)
          return reject("INDEPENDENT_ISSUER_TEST_OUTCOME_UNVERIFIED");
        results.push(result);
      }
      if (!same(initial, await current(request))) return reject("INDEPENDENT_ISSUER_CONTEXT_CHANGED");
      const now = clock();
      if (!positive(now) || results.some(r => r.completed_at_ms > now || now - r.completed_at_ms > policy.max_age_ms))
        return reject("INDEPENDENT_ISSUER_EVIDENCE_EXPIRED");
      // No refreshed receipt may extend the lifetime of the observed runs.
      const expires = Math.min(now + policy.receipt_ttl_ms,
        ...results.map(r => r.completed_at_ms + policy.max_age_ms));
      if (expires <= now) return reject("INDEPENDENT_ISSUER_EVIDENCE_EXPIRED");
      const payload = JSON.stringify({ schema_version: 1, issuer: policy.issuer, repository: policy.repository,
        candidate, issued_at_ms: now, expires_at_ms: expires, results });
      if (Buffer.byteLength(payload, "utf8") > 65536) return reject("INDEPENDENT_ISSUER_PAYLOAD_TOO_LARGE");
      const signature = await signPayload(Buffer.from(payload, "utf8"));
      if (!Buffer.isBuffer(signature) || signature.length !== 64) return reject("INDEPENDENT_ISSUER_SIGNATURE_INVALID");
      const envelope = { payload, signature: signature.toString("base64url") };
      const { receipt_ttl_ms: _ttl, ...expectedPolicy } = policy;
      const proof = reviewIndependentVerification({ envelope, expected: { ...expectedPolicy, candidate },
        pinnedPublicKey: key, nowMs: clock() });
      if (!proof.verified) return reject(proof.code);
      if (!same(initial, await current(request))) return reject("INDEPENDENT_ISSUER_CONTEXT_CHANGED");
      if (clock() >= proof.expires_at_ms) return reject("INDEPENDENT_ISSUER_EVIDENCE_EXPIRED");
      return Object.freeze({ issued: true, execution_authorized: false, envelope: Object.freeze(envelope),
        receipt_sha256: proof.receipt_sha256, expires_at_ms: proof.expires_at_ms });
    } catch { return reject("INDEPENDENT_ISSUER_SOURCE_UNAVAILABLE"); }
  };
}
