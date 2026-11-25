import { randomBytes } from "node:crypto";

export const postEncodingClaimDecisionKind = "post_encoding_subjective_claim";
export const postEncodingClaimRelationDecisionKind = "post_encoding_subjective_claim_relation";
export const isPostEncodingDecisionKind = kind => [postEncodingClaimDecisionKind, postEncodingClaimRelationDecisionKind].includes(kind);
const clone = value => JSON.parse(JSON.stringify(value));
function fail(code) { const error = new Error(code); error.code = code; throw error; }
const invalid = "WORLD_SIMULATION_NATIVE_SUBJECTIVE_CLAIM_INTENT_INVALID";
const inactive = "WORLD_SIMULATION_POST_ENCODING_LEASE_INACTIVE";
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export const formalClaimResponseProperties = Object.freeze({
  claim_context_token: { type: "string", maxLength: 128 },
  claim_intents: { type: "array", maxItems: 8, items: {
    type: "object", additionalProperties: false, required: ["proposition", "evidence"],
    properties: {
      proposition: { type: "string", minLength: 1, maxLength: 2000 },
      evidence: { type: "array", minItems: 1, maxItems: 12, items: {
        type: "object", additionalProperties: false, required: ["source_token", "relation"],
        properties: {
          source_token: { type: "string", maxLength: 128 },
          relation: { type: "string", enum: ["supports", "conflicts"] },
        },
      } },
    },
  } },
});

export const formalClaimRelationResponseProperties = Object.freeze({
  relation_context_token: { type: "string", maxLength: 128 },
  relation_intents: { type: "array", maxItems: 8, items: {
    type: "object", additionalProperties: false, required: ["source_claim_token", "target_claim_token", "relation"],
    properties: {
      source_claim_token: { type: "string", maxLength: 128 },
      target_claim_token: { type: "string", maxLength: 128 },
      relation: { type: "string", enum: ["challenges", "supersedes"] },
    },
  } },
});
const invalidRelation = "WORLD_SIMULATION_NATIVE_SUBJECTIVE_CLAIM_RELATION_INTENT_INVALID";
function validateRelationReply(reply, view) {
  if (!isObject(reply) || Object.keys(reply).some(key => !Object.hasOwn(formalClaimRelationResponseProperties, key))
      || reply.relation_context_token !== view.context_token || !Array.isArray(reply.relation_intents)
      || reply.relation_intents.length > 8) fail(invalidRelation);
  const current = new Set(view.current_claims.map(claim => claim.claim_token));
  const prior = new Set(view.prior_claims.map(claim => claim.claim_token));
  for (const item of reply.relation_intents) {
    if (!isObject(item) || Object.keys(item).some(key => !["source_claim_token", "target_claim_token", "relation"].includes(key))
        || !["challenges", "supersedes"].includes(item.relation) || !current.has(item.source_claim_token)
        || item.source_claim_token === item.target_claim_token
        || (!prior.has(item.target_claim_token) && !(item.relation === "challenges" && current.has(item.target_claim_token)))) fail(invalidRelation);
  }
  return clone(reply);
}

function validateReply(reply, view) {
  if (!isObject(reply) || Object.keys(reply).some(key => !Object.hasOwn(formalClaimResponseProperties, key))
      || reply.claim_context_token !== view.context_token || !Array.isArray(reply.claim_intents)
      || reply.claim_intents.length > 8) fail(invalid);
  const tokens = new Set(view.memory_sources.map(source => source.source_token));
  for (const item of reply.claim_intents) {
    if (!isObject(item) || Object.keys(item).some(key => !["proposition", "evidence"].includes(key))
        || typeof item.proposition !== "string" || !item.proposition.trim() || item.proposition.length > 2000
        || !Array.isArray(item.evidence) || !item.evidence.length || item.evidence.length > 12) fail(invalid);
    for (const evidence of item.evidence) {
      if (!isObject(evidence) || Object.keys(evidence).some(key => !["source_token", "relation"].includes(key))
          || !tokens.has(evidence.source_token) || !["supports", "conflicts"].includes(evidence.relation)) fail(invalid);
    }
  }
  return clone(reply);
}

// One parent-owned, process-local suspended execution. No replay of causal
// execution, no exposure of resolver closures or raw staged World state.
// A public response may only resume the exact currently published decision.
export function createPostEncodingClaimContinuation({ leaseMs = 120_000, onTerminal = () => {} } = {}) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1 || leaseMs > 600_000) fail(inactive);
  let state = "idle", pending = null, terminal = null, timer = null, sequence = 0;
  const waiters = new Set();
  const notify = () => { for (const wake of waiters) wake(); waiters.clear(); };
  const current = () => pending ? clone(pending.decision) : null;
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  const finish = () => { clear(); onTerminal(clone(terminal)); notify(); };
  function cancel(code = inactive) {
    if (state === "committing") fail("WORLD_SIMULATION_POST_ENCODING_COMMIT_IN_PROGRESS");
    if (["complete", "failed", "cancelled"].includes(state)) return false;
    state = "cancelled";
    terminal = { error_code: code };
    clear();
    const waiting = pending;
    pending = null;
    if (waiting) { const error = new Error(code); error.code = code; waiting.reject(error); }
    finish();
    return true;
  }
  function permitCommit() {
    if (state !== "running" || pending) fail(inactive);
    clear();
    state = "committing";
    return true;
  }
  async function interpretClaim(packet) {
    if (state !== "running" || pending) fail(inactive);
    const relation = packet?.native_subjective_claim_relation_decision;
    const claim = packet?.native_subjective_claim_decision;
    if (Boolean(relation) === Boolean(claim)) fail(invalid);
    const view = relation ?? claim;
    if (view?.character !== packet?.character || view?.bounded_view_only !== true
        || view?.world_truth_exposed !== false
        || (relation ? (!Array.isArray(view.current_claims) || !Array.isArray(view.prior_claims)) : !Array.isArray(view.memory_sources))) fail(relation ? invalidRelation : invalid);
    return new Promise((resolve, reject) => {
      const decision = {
        decision_index: sequence++, decision_handle: "world_decision_" + randomBytes(16).toString("hex"),
        decision_kind: relation ? postEncodingClaimRelationDecisionKind : postEncodingClaimDecisionKind, character_input: clone(packet),
      };
      pending = { decision, resolve, reject };
      state = "pending";
      notify();
    });
  }
  function wait() {
    if (pending || terminal) return Promise.resolve({ decision: current(), terminal: terminal ? clone(terminal) : null });
    return new Promise(resolve => {
      const wake = () => resolve({ decision: current(), terminal: terminal ? clone(terminal) : null });
      waiters.add(wake);
    });
  }
  function start(run) {
    if (state !== "idle" || typeof run !== "function") fail(inactive);
    state = "running";
    timer = setTimeout(() => cancel("WORLD_SIMULATION_POST_ENCODING_LEASE_EXPIRED"), leaseMs);
    timer.unref?.();
    // The host owns the execution lifetime; handle both settlement paths.
    Promise.resolve().then(() => run({ interpretClaim, permitCommit })).then(result => {
      if (state === "cancelled") return;
      if (state !== "committing" && result?.committed === true) fail(inactive);
      state = "complete"; terminal = { result: clone(result) }; finish();
    }).catch(error => {
      if (state === "cancelled") return;
      state = "failed"; terminal = { error_code: error?.code ?? "WORLD_SIMULATION_POST_ENCODING_FAILED" };
      pending = null; finish();
    });
    return wait();
  }
  function submit(decisionHandle, reply) {
    if (state !== "pending" || !pending || pending.decision.decision_handle !== decisionHandle) fail("WORLD_SIMULATION_DECISION_ORDER_VIOLATION");
    const validated = pending.decision.decision_kind === postEncodingClaimRelationDecisionKind
      ? validateRelationReply(reply, pending.decision.character_input.native_subjective_claim_relation_decision)
      : validateReply(reply, pending.decision.character_input.native_subjective_claim_decision);
    const waiting = pending;
    pending = null; state = "running";
    waiting.resolve(validated);
    return wait();
  }
  return Object.freeze({ start, submit, wait, cancel, current, state: () => state });
}
