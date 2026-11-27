import { createHash, createPublicKey } from "node:crypto";
import { reviewIndependentVerification } from "./mcp-independent-verification-evidence.mjs";
import { createIndependentVerificationObserver } from "./mcp-independent-verification-observer.mjs";

// Host-owned wiring only. The integration service derives required suites
// from the exact candidate delta; no caller may supply a plan, issuer,
// public key, source/target commit or arbitrary test command.
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const label = /^[A-Za-z0-9_.-]{1,100}$/u;
const digest = /^[a-f0-9]{64}$/u;
const validRow = v => exact(v, ["suite", "platform", "workflow_sha256"])
  && typeof v.suite === "string" && label.test(v.suite)
  && ["windows", "linux"].includes(v.platform)
  && typeof v.workflow_sha256 === "string" && digest.test(v.workflow_sha256);
const rowKey = v => v.suite + ":" + v.platform;
const fail = code => { throw Object.assign(new Error(code), { code }); };

function trustedPolicy(policy) {
  if (!exact(policy, ["repository", "issuer", "max_age_ms", "suite_workflows", "additional_required"])
    || !Array.isArray(policy.suite_workflows) || !policy.suite_workflows.length
    || policy.suite_workflows.length > 64 || !policy.suite_workflows.every(validRow)
    || new Set(policy.suite_workflows.map(rowKey)).size !== policy.suite_workflows.length
    || !Array.isArray(policy.additional_required) || policy.additional_required.length > 64
    || !policy.additional_required.every(s => typeof s === "string" && label.test(s))
    || new Set(policy.additional_required).size !== policy.additional_required.length)
    fail("INDEPENDENT_VERIFICATION_HOST_POLICY_INVALID");
  return structuredClone(policy);
}

function requiredPolicy(trusted, plan) {
  const suites = plan?.required_suites;
  if (!Array.isArray(suites) || !suites.length || !suites.every(s => typeof s === "string" && label.test(s))
    || new Set(suites).size !== suites.length)
    fail("INDEPENDENT_VERIFICATION_PLAN_INVALID");
  const required = new Set([...suites, ...trusted.additional_required]);
  const rows = trusted.suite_workflows.filter(row => required.has(row.suite));
  // Additional policy gates never replace an original risk-routed suite.
  for (const suite of required) {
    if (!rows.some(row => row.suite === suite)) fail("INDEPENDENT_VERIFICATION_SUITE_UNAVAILABLE");
  }
  return { repository: trusted.repository, issuer: trusted.issuer,
    max_age_ms: trusted.max_age_ms, required: rows };
}

const identity = (candidate, revision = candidate.revision) => ({
  integration_candidate_id: candidate.integration_candidate_id, revision,
  integration_commit: candidate.integration_commit, source_head: candidate.source_head, target_head: candidate.target_head,
});

export function createIndependentCandidateObserver({
  integrationService, policy, pinnedPublicKey, readEnvelope, journal, clock,
} = {}) {
  if (typeof integrationService?.getCandidate !== "function"
    || typeof integrationService?.getIndependentVerificationContext !== "function")
    fail("INDEPENDENT_VERIFICATION_HOST_UNBOUND");
  const trusted = trustedPolicy(policy);
  async function resolvePolicy(candidate) {
    const context = await integrationService.getIndependentVerificationContext({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });
    if (context.observation_only !== true || context.execution_authorized !== false
      || ["integration_candidate_id", "revision", "workspace_id", "workstream_id",
        "integration_commit", "source_head", "target_head"].some(key => context.candidate?.[key] !== candidate[key]))
      fail("INDEPENDENT_VERIFICATION_CONTEXT_MISMATCH");
    return requiredPolicy(trusted, context.plan);
  }
  return createIndependentVerificationObserver({
    getCandidate: input => integrationService.getCandidate(input),
    resolvePolicy, pinnedPublicKey, readEnvelope, journal, ...(clock ? { clock } : {}),
  });
}

// This gate is constructed by the independently trusted integration host.
// It consumes raw signed envelopes, never the previous observer's boolean
// or a caller-selected Journal operation. The service supplies the exact
// candidate and independently derived Git plan at each phase. It does not
// mutate the candidate or authorize an integration.
export function createIndependentCandidateEvidenceGate({ policy, pinnedPublicKey, readEnvelope, clock = Date.now } = {}) {
  const trusted = trustedPolicy(policy);
  if (typeof readEnvelope !== "function" || typeof clock !== "function") fail("INDEPENDENT_VERIFICATION_HOST_UNBOUND");
  const key = pinnedPublicKey?.type === "public" ? pinnedPublicKey : createPublicKey(pinnedPublicKey);
  if (key.asymmetricKeyType !== "ed25519") fail("INDEPENDENT_VERIFICATION_KEY_INVALID");
  const deny = code => ({ verified: false, code, execution_authorized: false });
  async function verify(candidate, plan, recorded) {
    try {
      const previous = recorded !== undefined;
      if (!candidate || (!previous && candidate.state !== "preflight_passed")
        || (previous && !["ready", "blocked"].includes(candidate.state)))
        return deny("INDEPENDENT_EVIDENCE_STATE_MISMATCH");
      if (previous && (!exact(recorded, ["candidate_revision", "receipt_sha256", "policy_sha256"])
        || !Number.isSafeInteger(recorded.candidate_revision) || recorded.candidate_revision < 1
        || recorded.candidate_revision >= candidate.revision
        || !digest.test(recorded.receipt_sha256) || !digest.test(recorded.policy_sha256)))
        return deny("INDEPENDENT_EVIDENCE_REFERENCE_INVALID");
      const selected = requiredPolicy(trusted, plan);
      const expected = { ...selected, candidate: identity(candidate, previous ? recorded.candidate_revision : candidate.revision) };
      const policyHash = createHash("sha256").update(JSON.stringify(selected), "utf8").digest("hex");
      if (previous && recorded.policy_sha256 !== policyHash) return deny("INDEPENDENT_EVIDENCE_POLICY_CHANGED");
      const envelope = await readEnvelope(Object.freeze(expected.candidate));
      const proof = reviewIndependentVerification({ envelope, expected, pinnedPublicKey: key, nowMs: clock() });
      if (!proof.verified) return proof;
      if (previous && recorded.receipt_sha256 !== proof.receipt_sha256)
        return deny("INDEPENDENT_EVIDENCE_RECEIPT_CHANGED");
      return Object.freeze({ ...proof, policy_sha256: policyHash, evidence_source: "independent_signed",
        required_suites: Object.freeze([...plan.required_suites]),
        verified_results: Object.freeze(JSON.parse(envelope.payload).results.map(Object.freeze)),
        evidence_reference: Object.freeze({ candidate_revision: proof.candidate_revision,
          receipt_sha256: proof.receipt_sha256, policy_sha256: policyHash }) });
    } catch { return deny("INDEPENDENT_EVIDENCE_UNAVAILABLE"); }
  }
  return Object.freeze({
    reviewForValidation: (candidate, plan) => verify(candidate, plan),
    reviewForApply: (candidate, plan, reference) => reference === undefined
      ? Promise.resolve(deny("INDEPENDENT_EVIDENCE_REFERENCE_INVALID")) : verify(candidate, plan, reference),
  });
}
