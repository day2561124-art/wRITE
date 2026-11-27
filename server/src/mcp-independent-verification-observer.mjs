import { createHash, createPublicKey } from "node:crypto";
import { reviewIndependentVerification } from "./mcp-independent-verification-evidence.mjs";

const candidatePattern = /^dev_integration_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const workspacePattern = /^dev_workspace_[a-f0-9]{24}$/u;
const workstreamPattern = /^dev_workstream_[0-9]{8}-[0-9]{6}_[a-f0-9]{12}$/u;
const positive = n => Number.isSafeInteger(n) && n > 0;
const exact = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const reject = code => ({ verified: false, code, execution_authorized: false });
const identity = c => ({
  integration_candidate_id: c.integration_candidate_id, revision: c.revision,
  integration_commit: c.integration_commit, source_head: c.source_head, target_head: c.target_head,
});
const scope = c => ({ ...identity(c), workspace_id: c.workspace_id, workstream_id: c.workstream_id, state: c.state });
const same = (a, b) => JSON.stringify(scope(a)) === JSON.stringify(scope(b));
const tool = "verification.independent.observe";
const observationType = "independent_verification_observation";

// Host-only consumer, not exposed as an MCP tool. Dependency functions and key
// must be bound by an independently trusted host. In particular resolvePolicy
// must derive the required suites from the actual immutable candidate delta
// and an independently reviewed release policy, not the signed envelope.
export function createIndependentVerificationObserver({
  getCandidate, resolvePolicy, readEnvelope, pinnedPublicKey, journal, clock = Date.now,
} = {}) {
  if ([getCandidate, resolvePolicy, readEnvelope, clock, journal?.begin, journal?.complete]
      .some(fn => typeof fn !== "function")) throw new Error("INDEPENDENT_VERIFICATION_HOST_UNBOUND");
  const key = pinnedPublicKey?.type === "public" ? pinnedPublicKey : createPublicKey(pinnedPublicKey);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("INDEPENDENT_VERIFICATION_KEY_INVALID");

  async function current(input) {
    const candidate = await getCandidate({ integration_candidate_id: input.integration_candidate_id });
    if (candidate?.integration_candidate_id !== input.integration_candidate_id
      || candidate.revision !== input.expected_revision || candidate.state !== "preflight_passed"
      || !workspacePattern.test(candidate.workspace_id ?? "")
      || !workstreamPattern.test(candidate.workstream_id ?? "")) return null;
    return structuredClone(candidate);
  }

  return async function observe(input) {
    if (!exact(input, ["integration_candidate_id", "expected_revision"])
      || typeof input.integration_candidate_id !== "string" || !candidatePattern.test(input.integration_candidate_id)
      || !positive(input.expected_revision)) return reject("INVALID_VERIFICATION_CANDIDATE_REQUEST");
    let candidate, policy, envelope;
    try {
      candidate = await current(input);
      if (!candidate) return reject("VERIFICATION_CANDIDATE_STALE");
      policy = structuredClone(await resolvePolicy(structuredClone(candidate)));
      if (!exact(policy, ["repository", "issuer", "required", "max_age_ms"])) return reject("INVALID_TRUSTED_VERIFICATION_PLAN");
      envelope = await readEnvelope(Object.freeze(identity(candidate)));
    } catch { return reject("VERIFICATION_SOURCE_UNAVAILABLE"); }
    const expected = { ...policy, candidate: identity(candidate) };
    let proof = reviewIndependentVerification({ envelope, expected, pinnedPublicKey: key, nowMs: clock() });
    if (!proof.verified) return proof;
    // Re-read registry and trusted plan after the external observation. No
    // evidence is recorded for an already stale candidate or changed policy.
    try {
      const latest = await current(input);
      if (!latest || !same(candidate, latest)) return reject("VERIFICATION_CANDIDATE_STALE");
      const latestPolicy = await resolvePolicy(structuredClone(latest));
      if (JSON.stringify(latestPolicy) !== JSON.stringify(policy)) return reject("VERIFICATION_POLICY_CHANGED");
    } catch { return reject("VERIFICATION_SOURCE_UNAVAILABLE"); }
    proof = reviewIndependentVerification({ envelope, expected, pinnedPublicKey: key, nowMs: clock() });
    if (!proof.verified) return proof;
    const facts = {
      ...proof, source_head: candidate.source_head, target_head: candidate.target_head,
      policy_sha256: createHash("sha256").update(JSON.stringify(policy), "utf8").digest("hex"),
      observation_only: true,
    };
    const links = [{ relation: "related_to", integration_candidate_id: candidate.integration_candidate_id },
      { relation: "used", commit: candidate.integration_commit }];
    // An observation is not a test_evidence or integration_validation
    // operation. It cannot satisfy the existing local test/ready gates.
    // Multiple observations are audit records, not repeated candidate effects.
    // A Journal failure is propagated; never return success without a terminal.
    const op = await journal.begin({ operation_type: observationType, tool_name: tool,
      workspace_id: candidate.workspace_id, workstream_id: candidate.workstream_id, links,
      result: { integration_candidate_id: candidate.integration_candidate_id, candidate_revision: candidate.revision,
        integration_commit: candidate.integration_commit, observation_only: true } });
    await journal.complete(op.operation_id, { result: facts, links });
    const latest = await current(input).catch(() => null);
    if (!latest || !same(candidate, latest)) return reject("VERIFICATION_CANDIDATE_STALE");
    if (!reviewIndependentVerification({ envelope, expected, pinnedPublicKey: key, nowMs: clock() }).verified)
      return reject("VERIFICATION_RECEIPT_EXPIRED");
    return Object.freeze({ ...facts, operation_id: op.operation_id });
  };
}
