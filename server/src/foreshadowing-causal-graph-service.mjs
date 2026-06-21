import { createHash } from "node:crypto";

export const foreshadowingCausalGraphVersion = "foreshadowing_causal_graph_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 600) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 12, itemMaximum = 280) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function normalizedId(value, fallbackPrefix, index) {
  const raw = text(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
  return raw || `${fallbackPrefix}_${index + 1}`;
}

function normalizeDebt(entry, index) {
  const raw = object(entry);
  const id = normalizedId(raw.id ?? raw.debt_id ?? raw.key, "debt", index);
  const status = text(raw.status ?? raw.state, 60) || "open";
  return {
    id,
    label: text(raw.label ?? raw.name ?? raw.promise ?? id, 220),
    type: text(raw.type ?? raw.kind, 80) || "foreshadowing_debt",
    status,
    introduced_at: text(raw.introduced_at ?? raw.introducedAt ?? raw.setup_chapter, 160) || null,
    due_by: text(raw.due_by ?? raw.dueBy ?? raw.expected_payoff, 160) || null,
    promise: text(raw.promise ?? raw.reader_promise ?? raw.readerPromise, 320),
    payoff_requirements: list(raw.payoff_requirements ?? raw.payoffRequirements, 8, 240),
    blockers: list(raw.blockers, 8, 220),
    risk_if_ignored: text(raw.risk_if_ignored ?? raw.riskIfIgnored, 260),
    evidence_refs: list(raw.evidence_refs ?? raw.evidenceRefs, 8, 220),
  };
}

function normalizeEdge(entry, index) {
  const raw = object(entry);
  return {
    id: normalizedId(raw.id ?? raw.edge_id ?? raw.key, "edge", index),
    from: text(raw.from ?? raw.source ?? raw.cause, 160),
    to: text(raw.to ?? raw.target ?? raw.effect, 160),
    relation: text(raw.relation ?? raw.type, 120) || "causes",
    reason: text(raw.reason ?? raw.description, 320),
    evidence_refs: list(raw.evidence_refs ?? raw.evidenceRefs, 6, 220),
  };
}

function normalizePromise(entry, index) {
  const raw = object(entry);
  return {
    id: normalizedId(raw.id ?? raw.promise_id ?? raw.key, "promise", index),
    promise: text(raw.promise ?? raw.label ?? raw.name, 320),
    made_to_reader_by: text(raw.made_to_reader_by ?? raw.madeToReaderBy ?? raw.source, 160) || null,
    expected_motion: text(raw.expected_motion ?? raw.expectedMotion, 260),
    current_status: text(raw.current_status ?? raw.currentStatus ?? raw.status, 80) || "open",
    must_not_fake_payoff: raw.must_not_fake_payoff !== false && raw.mustNotFakePayoff !== false,
    evidence_refs: list(raw.evidence_refs ?? raw.evidenceRefs, 6, 220),
  };
}

function sourceGraph(rawInput = {}, options = {}) {
  const generation = object(rawInput.generation_context ?? rawInput.generationContext);
  const retrieval = object(rawInput.retrieval_context ?? rawInput.retrievalContext);
  return object(
    options.foreshadowingCausalGraph
      ?? rawInput.foreshadowing_causal_graph
      ?? rawInput.foreshadowingCausalGraph
      ?? generation.foreshadowing_causal_graph
      ?? generation.foreshadowingCausalGraph
      ?? retrieval.foreshadowing_causal_graph
      ?? retrieval.foreshadowingCausalGraph
      ?? {},
  );
}

function normalizeGraph(rawGraph) {
  const graph = object(rawGraph);
  const debts = Array.isArray(graph.debts)
    ? graph.debts.map(normalizeDebt)
    : Array.isArray(graph.foreshadowing_debts)
      ? graph.foreshadowing_debts.map(normalizeDebt)
      : [];
  const causalEdges = Array.isArray(graph.causal_edges)
    ? graph.causal_edges.map(normalizeEdge)
    : Array.isArray(graph.edges)
      ? graph.edges.map(normalizeEdge)
      : [];
  const chapterPromises = Array.isArray(graph.chapter_promises)
    ? graph.chapter_promises.map(normalizePromise)
    : Array.isArray(graph.promises)
      ? graph.promises.map(normalizePromise)
      : [];
  const openDebts = debts.filter((item) => !["paid", "closed", "resolved"].includes(item.status));
  return {
    graph_id: text(graph.graph_id ?? graph.id, 160) || null,
    source_version: text(graph.version, 120) || null,
    updated_at: text(graph.updated_at ?? graph.updatedAt, 160) || null,
    debts,
    causal_edges: causalEdges,
    chapter_promises: chapterPromises,
    open_debt_ids: openDebts.map((item) => item.id),
    payable_now_debt_ids: debts
      .filter((item) => ["payoff_ready", "payable_now"].includes(item.status))
      .map((item) => item.id),
    unresolved_promise_ids: chapterPromises
      .filter((item) => !["paid", "closed", "resolved"].includes(item.current_status))
      .map((item) => item.id),
  };
}

function buildProviderGuidance(graph) {
  return {
    purpose: "Use this as candidate-writing continuity guidance for foreshadowing, causal payoff, and chapter promises.",
    must_do: [
      "Respect causal order before paying off any setup.",
      "Do not create fake payoff for promises that have not earned a consequence.",
      "If a debt is payable now, pay it through action, cost, reveal, or changed state.",
      "If a debt is not payable yet, keep it alive without turning it into exposition.",
    ],
    must_not_do: [
      "Do not mark debts as paid automatically.",
      "Do not update Canon, active_engine, or long-term graph state.",
      "Do not replace scene conflict with a list of explanations.",
    ],
    payable_now_debt_ids: graph.payable_now_debt_ids,
    open_debt_ids: graph.open_debt_ids,
    unresolved_promise_ids: graph.unresolved_promise_ids,
  };
}

function warningsForGraph(graph) {
  const warnings = [];
  if (!graph.debts.length && !graph.causal_edges.length && !graph.chapter_promises.length) {
    warnings.push("foreshadowing_causal_graph_empty");
  }
  if (graph.unresolved_promise_ids.length) warnings.push("chapter_promises_unresolved");
  if (graph.open_debt_ids.length) warnings.push("foreshadowing_debts_open");
  return warnings;
}

export async function buildForeshadowingCausalGraphContext(rawInput = {}, options = {}) {
  const graph = normalizeGraph(sourceGraph(rawInput, options));
  const warnings = warningsForGraph(graph);
  const status = warnings.includes("foreshadowing_causal_graph_empty") ? "empty" : "completed";
  const context = {
    used: true,
    phase: "27A",
    version: foreshadowingCausalGraphVersion,
    status,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    graph,
    provider_guidance: buildProviderGuidance(graph),
    provider_contract: {
      generation_payload_key: "foreshadowing_causal_graph",
      revision_payload_key: "foreshadowing_causal_graph",
      final_polisher_payload_key: "foreshadowing_causal_graph",
      candidate_report_key: "foreshadowing_causal_graph",
    },
    warnings,
  };
  context.trace_id = `foreshadowing_causal_${sha256(JSON.stringify({
    status,
    graph,
    warnings,
  })).slice(0, 16)}`;
  return context;
}

export default buildForeshadowingCausalGraphContext;
