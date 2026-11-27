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

export function createIndependentCandidateObserver({
  integrationService, policy, pinnedPublicKey, readEnvelope, journal, clock,
} = {}) {
  if (typeof integrationService?.getCandidate !== "function"
    || typeof integrationService?.getIndependentVerificationContext !== "function"
    || !exact(policy, ["repository", "issuer", "max_age_ms", "suite_workflows", "additional_required"])
    || !Array.isArray(policy.suite_workflows) || !policy.suite_workflows.length
    || policy.suite_workflows.length > 64 || !policy.suite_workflows.every(validRow)
    || new Set(policy.suite_workflows.map(rowKey)).size !== policy.suite_workflows.length
    || !Array.isArray(policy.additional_required) || policy.additional_required.length > 64
    || !policy.additional_required.every(s => typeof s === "string" && label.test(s))
    || new Set(policy.additional_required).size !== policy.additional_required.length)
    fail("INDEPENDENT_VERIFICATION_HOST_POLICY_INVALID");
  const trusted = structuredClone(policy);
  async function resolvePolicy(candidate) {
    const context = await integrationService.getIndependentVerificationContext({
      integration_candidate_id: candidate.integration_candidate_id,
      expected_revision: candidate.revision,
    });
    if (context.observation_only !== true || context.execution_authorized !== false
      || ["integration_candidate_id", "revision", "workspace_id", "workstream_id",
        "integration_commit", "source_head", "target_head"].some(key => context.candidate?.[key] !== candidate[key]))
      fail("INDEPENDENT_VERIFICATION_CONTEXT_MISMATCH");
    const suites = context.plan?.required_suites;
    if (!Array.isArray(suites) || !suites.length || !suites.every(s => typeof s === "string" && label.test(s))
      || new Set(suites).size !== suites.length)
      fail("INDEPENDENT_VERIFICATION_PLAN_INVALID");
    const required = new Set([...suites, ...trusted.additional_required]);
    const rows = trusted.suite_workflows.filter(row => required.has(row.suite));
    // A policy can add gates or require multiple platforms, but never remove
    // the risk router's original suite. 'all' does not silently replace a
    // named gate, nor does a focused result imply all.
    for (const suite of required) {
      if (!rows.some(row => row.suite === suite)) fail("INDEPENDENT_VERIFICATION_SUITE_UNAVAILABLE");
    }
    return { repository: trusted.repository, issuer: trusted.issuer,
      max_age_ms: trusted.max_age_ms, required: rows };
  }
  return createIndependentVerificationObserver({
    getCandidate: input => integrationService.getCandidate(input),
    resolvePolicy, pinnedPublicKey, readEnvelope, journal, ...(clock ? { clock } : {}),
  });
}
