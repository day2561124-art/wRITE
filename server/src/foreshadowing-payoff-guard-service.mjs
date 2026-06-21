import { createHash } from "node:crypto";

export const foreshadowingPayoffGuardVersion = "foreshadowing_payoff_guard_v1";

const TRUE_PAYOFF_TYPES = new Set([
  "action",
  "cost",
  "reveal",
  "changed_state",
  "irreversible_consequence",
  "route_loss",
  "relationship_shift",
  "knowledge_boundary_change",
  "tactical_state_change",
]);

const FAKE_PAYOFF_TYPES = new Set([
  "fake_payoff",
  "pure_explanation_payoff",
  "decorative_callback",
  "no_consequence_callback",
  "pretty_sentence_callback",
  "promise_without_cost",
  "payoff_without_state_change",
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 800) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 16, itemMaximum = 300) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function boolEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function shouldUseForeshadowingPayoffGuard(rawInput = {}, options = {}) {
  return rawInput.include_foreshadowing_payoff_guard === true
    || rawInput.includeForeshadowingPayoffGuard === true
    || boolEnabled(options.foreshadowingPayoffGuard)
    || boolEnabled(options.foreshadowing_payoff_guard);
}

function disabledContext(status = "disabled") {
  return {
    used: false,
    phase: "27B",
    version: foreshadowingPayoffGuardVersion,
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    detected_payoffs: [],
    fake_payoffs: [],
    unpaid_required_debts: [],
    unresolved_promises: [],
    payoff_quality_score: 0,
    blocking: false,
    warnings: [],
  };
}

function sourceConfig(rawInput = {}, options = {}) {
  return object(
    options.foreshadowingPayoffGuard
      ?? options.foreshadowing_payoff_guard
      ?? rawInput.foreshadowing_payoff_guard
      ?? rawInput.foreshadowingPayoffGuard
      ?? {},
  );
}

function sourceGraph(rawInput = {}, options = {}, config = {}) {
  const generation = object(rawInput.generation_context ?? rawInput.generationContext);
  const retrieval = object(rawInput.retrieval_context ?? rawInput.retrievalContext);
  const explicit = object(
    config.foreshadowing_causal_graph
      ?? config.foreshadowingCausalGraph
      ?? options.foreshadowingCausalGraph
      ?? options.foreshadowing_causal_graph
      ?? rawInput.foreshadowing_causal_graph
      ?? rawInput.foreshadowingCausalGraph
      ?? {},
  );
  if (Object.keys(explicit).length) return object(explicit.graph ?? explicit);
  return object(
    generation.foreshadowing_causal_graph?.graph
      ?? generation.foreshadowingCausalGraph?.graph
      ?? retrieval.foreshadowing_causal_graph?.graph
      ?? retrieval.foreshadowingCausalGraph?.graph
      ?? generation.foreshadowing_causal_graph
      ?? generation.foreshadowingCausalGraph
      ?? retrieval.foreshadowing_causal_graph
      ?? retrieval.foreshadowingCausalGraph
      ?? {},
  );
}

function normalizeDebt(entry, index) {
  const raw = object(entry);
  const id = text(raw.id ?? raw.debt_id ?? raw.debtId ?? raw.key, 160) || `debt_${index + 1}`;
  const status = text(raw.status ?? raw.state, 80) || "open";
  return {
    id,
    label: text(raw.label ?? raw.name ?? raw.promise ?? id, 260),
    status,
    promise: text(raw.promise ?? raw.reader_promise ?? raw.readerPromise, 360),
    payoff_requirements: list(raw.payoff_requirements ?? raw.payoffRequirements, 10, 260),
  };
}

function normalizePromise(entry, index) {
  const raw = object(entry);
  return {
    id: text(raw.id ?? raw.promise_id ?? raw.promiseId ?? raw.key, 160) || `promise_${index + 1}`,
    promise: text(raw.promise ?? raw.label ?? raw.name, 360),
    current_status: text(raw.current_status ?? raw.currentStatus ?? raw.status, 80) || "open",
    expected_motion: text(raw.expected_motion ?? raw.expectedMotion, 260),
    must_not_fake_payoff: raw.must_not_fake_payoff !== false && raw.mustNotFakePayoff !== false,
  };
}

function normalizeGraph(rawGraph = {}) {
  const graph = object(rawGraph);
  const debts = Array.isArray(graph.debts)
    ? graph.debts.map(normalizeDebt)
    : Array.isArray(graph.foreshadowing_debts)
      ? graph.foreshadowing_debts.map(normalizeDebt)
      : [];
  const chapterPromises = Array.isArray(graph.chapter_promises)
    ? graph.chapter_promises.map(normalizePromise)
    : Array.isArray(graph.promises)
      ? graph.promises.map(normalizePromise)
      : [];
  const payableIds = new Set([
    ...list(graph.payable_now_debt_ids ?? graph.payableNowDebtIds, 100, 160),
    ...debts.filter((debt) => ["payoff_ready", "payable_now"].includes(debt.status)).map((debt) => debt.id),
  ]);
  return {
    graph_id: text(graph.graph_id ?? graph.id, 160) || null,
    debts,
    chapter_promises: chapterPromises,
    payable_now_debt_ids: Array.from(payableIds),
    unresolved_promise_ids: chapterPromises
      .filter((promise) => !["paid", "closed", "resolved"].includes(promise.current_status))
      .map((promise) => promise.id),
  };
}

function normalizePayoff(entry, index) {
  const raw = object(entry);
  const payoffTypes = list(raw.payoff_types ?? raw.payoffTypes ?? raw.types, 12, 120);
  const fakeTypes = list(raw.fake_types ?? raw.fakeTypes ?? raw.fake_payoff_types ?? raw.fakePayoffTypes, 12, 120);
  const consequence = text(
    raw.consequence
      ?? raw.changed_state
      ?? raw.changedState
      ?? raw.state_change_summary
      ?? raw.stateChangeSummary,
    420,
  );
  return {
    id: text(raw.id ?? raw.payoff_id ?? raw.payoffId, 160) || `payoff_${index + 1}`,
    debt_id: text(raw.debt_id ?? raw.debtId ?? raw.target_debt_id ?? raw.targetDebtId, 160),
    promise_id: text(raw.promise_id ?? raw.promiseId ?? raw.target_promise_id ?? raw.targetPromiseId, 160),
    summary: text(raw.summary ?? raw.description, 500),
    payoff_types: payoffTypes,
    fake_types: fakeTypes,
    consequence,
    evidence_refs: list(raw.evidence_refs ?? raw.evidenceRefs, 10, 240),
  };
}

function sourcePayoffs(rawInput = {}, options = {}, config = {}) {
  const raw = config.payoffs
    ?? config.detected_payoffs
    ?? config.detectedPayoffs
    ?? rawInput.foreshadowing_payoffs
    ?? rawInput.foreshadowingPayoffs
    ?? [];
  return Array.isArray(raw) ? raw.map(normalizePayoff) : [];
}

function classifyPayoff(payoff) {
  const trueTypes = payoff.payoff_types.filter((type) => TRUE_PAYOFF_TYPES.has(type));
  const fakeTypes = [
    ...payoff.payoff_types.filter((type) => FAKE_PAYOFF_TYPES.has(type)),
    ...payoff.fake_types.filter((type) => FAKE_PAYOFF_TYPES.has(type)),
  ];
  const hasConsequence = Boolean(payoff.consequence);
  const truePayoff = trueTypes.length > 0 && hasConsequence && fakeTypes.length === 0;
  const fakePayoff = fakeTypes.length > 0 || (payoff.payoff_types.length > 0 && !hasConsequence);
  return {
    ...payoff,
    true_payoff: truePayoff,
    fake_payoff: fakePayoff,
    accepted_payoff_types: trueTypes,
    rejected_payoff_types: fakeTypes,
    rejection_reason: fakePayoff
      ? fakeTypes[0] ?? "payoff_without_state_change"
      : null,
  };
}

function buildProviderGuidance(guard) {
  return {
    purpose: "Detect whether foreshadowing debts are actually paid through consequence, not merely mentioned.",
    must_accept_as_payoff_only_when: [
      "A payoff creates action, cost, reveal, changed state, irreversible consequence, route loss, relationship shift, knowledge boundary change, or tactical state change.",
      "The scene world-state changes because of the payoff.",
      "The payoff can be evidenced in candidate text or provider-reported payoff entries.",
    ],
    must_reject: [
      "fake_payoff",
      "pure_explanation_payoff",
      "decorative_callback",
      "no_consequence_callback",
      "pretty_sentence_callback",
      "promise_without_cost",
      "payoff_without_state_change",
    ],
    unpaid_required_debt_ids: guard.unpaid_required_debts.map((item) => item.id),
    fake_payoff_ids: guard.fake_payoffs.map((item) => item.id),
  };
}

function buildProviderContract() {
  return {
    generation_payload_key: "foreshadowing_payoff_guard",
    revision_payload_key: "foreshadowing_payoff_guard",
    final_polisher_payload_key: "foreshadowing_payoff_guard",
    candidate_proof_report_key: "foreshadowing_payoff_guard",
    pipeline_report_key: "foreshadowing_payoff_guard",
    candidate_report_key: "foreshadowing_payoff_guard",
  };
}

export async function buildForeshadowingPayoffGuardContext(rawInput = {}, options = {}) {
  if (!shouldUseForeshadowingPayoffGuard(rawInput, options)) return disabledContext();

  const config = sourceConfig(rawInput, options);
  const graph = normalizeGraph(sourceGraph(rawInput, options, config));
  const payoffs = sourcePayoffs(rawInput, options, config).map(classifyPayoff);
  const payableDebts = graph.debts.filter((debt) => graph.payable_now_debt_ids.includes(debt.id));
  const truePayoffDebtIds = new Set(payoffs.filter((item) => item.true_payoff && item.debt_id).map((item) => item.debt_id));
  const fakePayoffs = payoffs.filter((item) => item.fake_payoff);
  const unpaidRequiredDebts = payableDebts.filter((debt) => !truePayoffDebtIds.has(debt.id));
  const unresolvedPromises = graph.chapter_promises.filter((promise) => graph.unresolved_promise_ids.includes(promise.id));
  const warnings = [];
  if (!graph.debts.length && !graph.chapter_promises.length) warnings.push("foreshadowing_payoff_guard_graph_empty");
  if (fakePayoffs.length) warnings.push("fake_foreshadowing_payoff_detected");
  if (unpaidRequiredDebts.length) warnings.push("payable_foreshadowing_debt_unpaid");
  if (unresolvedPromises.length) warnings.push("chapter_promise_unresolved_by_payoff_guard");
  const totalChecks = payableDebts.length + fakePayoffs.length;
  const payoffQualityScore = totalChecks === 0
    ? 0
    : Math.max(0, Math.round(((payableDebts.length - unpaidRequiredDebts.length) / totalChecks) * 100));
  const guard = {
    used: true,
    phase: "27B",
    version: foreshadowingPayoffGuardVersion,
    status: warnings.length ? "needs_revision" : "passed",
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    graph_summary: {
      payable_now_debt_ids: graph.payable_now_debt_ids,
      unresolved_promise_ids: graph.unresolved_promise_ids,
    },
    detected_payoffs: payoffs,
    fake_payoffs: fakePayoffs,
    unpaid_required_debts: unpaidRequiredDebts,
    unresolved_promises: unresolvedPromises,
    payoff_quality_score: payoffQualityScore,
    blocking: fakePayoffs.length > 0 || unpaidRequiredDebts.length > 0,
    warnings,
    provider_contract: buildProviderContract(),
  };
  guard.provider_guidance = buildProviderGuidance(guard);
  guard.trace_id = `foreshadowing_payoff_${sha256(JSON.stringify({
    status: guard.status,
    fake_payoffs: guard.fake_payoffs,
    unpaid_required_debts: guard.unpaid_required_debts,
    warnings,
  })).slice(0, 16)}`;
  return guard;
}

export default buildForeshadowingPayoffGuardContext;
