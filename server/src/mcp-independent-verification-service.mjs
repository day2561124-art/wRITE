import { createGitHubVerificationCollector } from "./mcp-independent-verification-github.mjs";
import { createGitHubVerificationReadClient } from "./mcp-independent-verification-github-read.mjs";
import { createIndependentVerificationIssuer } from "./mcp-independent-verification-issuer.mjs";
import { createIndependentReceiptPublisher } from "./mcp-independent-verification-receipt-store.mjs";

// Composition root for an independently operated verifier, not an MCP tool.
// Enrollment, credentials, independent process outcome observation, signing
// and directory ACL verification must be supplied by that trusted host.
// No worker-controlled configuration, implicit trust or execution authority.
const exact = (v, keys) => v !== null && typeof v === "object" && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype && Object.keys(v).length === keys.length
  && keys.every(k => Object.hasOwn(v, k));
const fields = ["integration_candidate_id", "revision", "integration_commit", "source_head", "target_head"];
const identity = c => Object.fromEntries(fields.map(k => [k, c[k]]));
const sameIdentity = (a,b) => a && b && fields.every(k => a[k] === b[k]);
const positive = n => Number.isSafeInteger(n) && n > 0;
const label = /^[A-Za-z0-9_.-]{1,100}$/u;
const fail = code => { throw Object.assign(new Error(code), {code}); };

export function createIndependentVerifierService({ policy, readContext, readRunSelection,
  observeTestOutcome, signPayload, pinnedPublicKey, readCredential, fetchImpl,
  receiptRoot, assertProtectedDirectory, clock = Date.now } = {}) {
  if ([readContext, readRunSelection, observeTestOutcome, signPayload, readCredential,
    assertProtectedDirectory, clock].some(f => typeof f !== "function") || !pinnedPublicKey)
    fail("INDEPENDENT_VERIFIER_HOST_UNBOUND");
  const policyFields = ["repository", "repository_id", "issuer", "max_age_ms", "receipt_ttl_ms", "workflows", "additional_required"];
  const separateSupervisor = exact(policy, [...policyFields, "supervisor_commit"]);
  if ((!separateSupervisor && !exact(policy, policyFields)) || !label.test(policy.issuer ?? "")
    || !positive(policy.receipt_ttl_ms) || policy.receipt_ttl_ms > policy.max_age_ms
    || !Array.isArray(policy.additional_required) || policy.additional_required.length > 64
    || !policy.additional_required.every(s => typeof s === "string" && label.test(s))
    || new Set(policy.additional_required).size !== policy.additional_required.length)
    fail("INDEPENDENT_VERIFIER_HOST_POLICY_INVALID");
  const trusted = structuredClone(policy);
  const reader = createGitHubVerificationReadClient({repository:trusted.repository, readCredential,
    ...(fetchImpl === undefined ? {} : {fetchImpl})});
  const collector = required => createGitHubVerificationCollector({policy:{repository:trusted.repository,
    repository_id:trusted.repository_id, required, max_age_ms:trusted.max_age_ms,
    ...(separateSupervisor ? {supervisor_commit:trusted.supervisor_commit} : {})}, ...reader, clock});
  // Validate the complete host-owned definition before serving any requests.
  collector(trusted.workflows);
  const rows = workflows => workflows.map(({suite,platform,workflow_sha256}) => ({suite,platform,workflow_sha256}));
  function select(context) {
    const suites = context?.plan?.required_suites;
    if (context?.observation_only !== true || context.execution_authorized !== false
      || !Array.isArray(suites) || !suites.length || suites.length > 64
      || !suites.every(s => typeof s === "string" && label.test(s))
      || new Set(suites).size !== suites.length)
      fail("INDEPENDENT_VERIFIER_PLAN_INVALID");
    const wanted = new Set([...suites,...trusted.additional_required]);
    const required = trusted.workflows.filter(w => wanted.has(w.suite));
    for (const suite of wanted)
      if (!required.some(r => r.suite === suite)) fail("INDEPENDENT_VERIFIER_SUITE_UNAVAILABLE");
    return required;
  }
  const resolvePolicy = context => ({
    repository:trusted.repository, issuer:trusted.issuer, max_age_ms:trusted.max_age_ms,
    required:rows(select(context)), receipt_ttl_ms:trusted.receipt_ttl_ms
  });
  const issue = createIndependentVerificationIssuer({readContext, resolvePolicy,
    collectProviderObservation: async (candidate, required) => {
      const context = await readContext(Object.freeze({integration_candidate_id:candidate.integration_candidate_id,
        expected_revision:candidate.revision}));
      if (!sameIdentity(context?.candidate,candidate)) fail("INDEPENDENT_VERIFIER_CONTEXT_CHANGED");
      const workflows = select(context);
      if (JSON.stringify(rows(workflows)) !== JSON.stringify(required)) fail("INDEPENDENT_VERIFIER_PLAN_CHANGED");
      // Only the independent host selects observed provider run IDs. The
      // caller cannot choose run, attempt, suite, workflow or outcome.
      const runs = await readRunSelection(Object.freeze({...candidate}), structuredClone(required));
      const observed = await collector(workflows)({commit:candidate.integration_commit,runs});
      if (separateSupervisor && observed.observed === true
        && (observed.code !== "GITHUB_SUPERVISOR_RUN_OBSERVED" || observed.supervisor_commit !== trusted.supervisor_commit
          || observed.candidate_binding_pending !== true)) fail("INDEPENDENT_SUPERVISOR_PROVENANCE_UNVERIFIED");
      // The issuer still requires independently signed raw outcomes for each
      // exact candidate/suite/run/attempt binding. Provider success is not proof.
      return observed;
    },
    observeTestOutcome, signPayload, pinnedPublicKey, clock});
  const publish = createIndependentReceiptPublisher({root:receiptRoot, assertProtectedDirectory, pinnedPublicKey, clock,
    resolveExpected:async candidate => {
      const context = await readContext(Object.freeze({integration_candidate_id:candidate.integration_candidate_id,
        expected_revision:candidate.revision}));
      if (!sameIdentity(context?.candidate,candidate)) fail("INDEPENDENT_VERIFIER_CONTEXT_CHANGED");
      const {receipt_ttl_ms:_,...expected} = resolvePolicy(context);
      return {...expected,candidate:identity(context.candidate)};
    }});
  return Object.freeze({
    verifyAndPublish:async request => {
      const issued = await issue(request);
      if (!issued.issued) return Object.freeze({published:false,code:issued.code,execution_authorized:false});
      const candidate = identity(JSON.parse(issued.envelope.payload).candidate);
      try {
        const result = await publish(candidate,issued.envelope);
        return Object.freeze({published:true,created:result.created,receipt_sha256:result.receipt_sha256,
          expires_at_ms:issued.expires_at_ms,execution_authorized:false});
      } catch {
        // Publication can have taken effect before final verification failed.
        // Do not automatically retry, overwrite, or claim it did not occur.
        return Object.freeze({published:false,publication_unconfirmed:true,
          code:"INDEPENDENT_VERIFIER_PUBLICATION_UNCONFIRMED",execution_authorized:false});
      }
    }
  });
}
