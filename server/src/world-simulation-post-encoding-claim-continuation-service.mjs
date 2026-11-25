import { randomBytes } from "node:crypto";

export const postEncodingClaimDecisionKind = "post_encoding_subjective_claim";
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
    const view = packet?.native_subjective_claim_decision;
    if (view?.character !== packet?.character || view?.bounded_view_only !== true
        || view?.world_truth_exposed !== false || !Array.isArray(view?.memory_sources)) fail(invalid);
    return new Promise((resolve, reject) => {
      const decision = {
        decision_index: sequence++, decision_handle: "world_decision_" + randomBytes(16).toString("hex"),
        decision_kind: postEncodingClaimDecisionKind, character_input: clone(packet),
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
    const validated = validateReply(reply, pending.decision.character_input.native_subjective_claim_decision);
    const waiting = pending;
    pending = null; state = "running";
    waiting.resolve(validated);
    return wait();
  }
  return Object.freeze({ start, submit, wait, cancel, current, state: () => state });
}
