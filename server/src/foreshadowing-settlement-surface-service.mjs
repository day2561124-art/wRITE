import { createHash } from "node:crypto";

export const foreshadowingSettlementSurfaceVersion = "foreshadowing_settlement_surface_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function normalizePaid(entry, index) {
  const item = object(entry);
  return {
    debt_id: text(item.debt_id ?? item.debtId, 160) || null,
    payoff_id: text(item.payoff_id ?? item.payoffId ?? item.id, 160) || `payoff_${index + 1}`,
    promise_id: text(item.promise_id ?? item.promiseId, 160) || null,
    payoff_types: array(item.payoff_types ?? item.payoffTypes).map((value) => text(value, 120)).filter(Boolean),
    consequence: text(item.consequence ?? item.summary ?? item.changed_state ?? item.changedState, 500),
    settlement_action: text(item.settlement_action ?? item.settlementAction, 180)
      || "mark_paid_in_candidate_settlement_preview",
    canon_write_allowed: item.canon_write_allowed === true ? true : false,
    requires_settlement_review: item.requires_settlement_review !== false,
  };
}

function normalizeOpen(entry, index) {
  const item = object(entry);
  return {
    debt_id: text(item.debt_id ?? item.debtId ?? item.id, 160) || `open_debt_${index + 1}`,
    label: text(item.label ?? item.name, 240),
    reason: text(item.reason, 240) || "keep_open",
    promise: text(item.promise ?? item.summary, 500),
    settlement_action: text(item.settlement_action ?? item.settlementAction, 180) || "keep_open",
  };
}

function normalizeBlocked(entry, index) {
  const item = object(entry);
  return {
    source_type: text(item.source_type ?? item.sourceType, 160) || "blocked_canon_intake_item",
    id: text(item.id, 180) || `blocked_${index + 1}`,
    debt_id: text(item.debt_id ?? item.debtId, 160) || null,
    reason: text(item.reason, 240) || "blocked",
    summary: text(item.summary ?? item.promise, 500),
    canon_intake_allowed: false,
  };
}

function normalizeCandidate(entry, index) {
  const item = object(entry);
  return {
    type: text(item.type, 180) || "foreshadowing_payoff_paid",
    debt_id: text(item.debt_id ?? item.debtId, 160) || null,
    payoff_id: text(item.payoff_id ?? item.payoffId ?? item.id, 160) || `candidate_item_${index + 1}`,
    requires_settlement_review: item.requires_settlement_review !== false,
    canon_write_allowed: false,
  };
}

function normalizeDiff(diffSource = {}) {
  const diff = object(diffSource);
  return {
    paid_foreshadowing_debts: array(diff.paid_foreshadowing_debts).map(normalizePaid),
    kept_open_debts: array(diff.kept_open_debts).map(normalizeOpen),
    blocked_canon_intake_items: array(diff.blocked_canon_intake_items).map(normalizeBlocked),
    allowed_candidate_settlement_items: array(diff.allowed_candidate_settlement_items).map(normalizeCandidate),
  };
}

function markdownFor(surface) {
  const paidLines = surface.paid_foreshadowing_debts.length
    ? surface.paid_foreshadowing_debts.map((item) => (
      `- PAID debt=${item.debt_id ?? "none"} payoff=${item.payoff_id}; types=${item.payoff_types.join(", ") || "none"}; consequence=${item.consequence || "none"}`
    ))
    : ["- none"];
  const openLines = surface.kept_open_debts.length
    ? surface.kept_open_debts.map((item) => (
      `- OPEN debt=${item.debt_id}; reason=${item.reason}; promise=${item.promise || "none"}`
    ))
    : ["- none"];
  const blockedLines = surface.blocked_canon_intake_items.length
    ? surface.blocked_canon_intake_items.map((item) => (
      `- BLOCKED source=${item.source_type}; id=${item.id}; reason=${item.reason}; canon_intake_allowed=false`
    ))
    : ["- none"];

  return [
    "## Foreshadowing Settlement Surface",
    "",
    `- phase: ${surface.phase}`,
    `- version: ${surface.version}`,
    `- status: ${surface.status}`,
    `- settlement_context_id: ${surface.settlement_context_id ?? "none"}`,
    `- source_phase: ${surface.source_phase ?? "none"}`,
    `- preview_only: ${surface.safety.preview_only}`,
    `- candidate_only: ${surface.safety.candidate_only}`,
    `- read_only: ${surface.safety.read_only}`,
    `- no_auto_persist: ${surface.safety.no_auto_persist}`,
    `- no_canon_update: ${surface.safety.no_canon_update}`,
    `- no_active_engine_update: ${surface.safety.no_active_engine_update}`,
    `- pending_engine_candidate_created: ${surface.safety.pending_engine_candidate_created}`,
    "",
    "### Counts",
    `- paid: ${surface.counts.paid}`,
    `- kept_open: ${surface.counts.kept_open}`,
    `- blocked: ${surface.counts.blocked}`,
    `- allowed_candidate_items: ${surface.counts.allowed_candidate_items}`,
    "",
    "### Paid Foreshadowing Debts",
    ...paidLines,
    "",
    "### Kept Open Foreshadowing Debts",
    ...openLines,
    "",
    "### Blocked Canon Intake Items",
    ...blockedLines,
    "",
    "### Operator Summary",
    `- decision: ${surface.operator_summary.decision}`,
    `- next_action: ${surface.operator_summary.next_action}`,
    "- This surface is read-only. It must not write Canon DB or active_engine.",
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementSurface(settlementContextBundle = {}) {
  const bundle = object(settlementContextBundle);
  const context = object(bundle.context ?? bundle);
  const bridge = object(context.foreshadowing_settlement_proposal_bridge);
  const diff = normalizeDiff(
    context.foreshadowing_settlement_diff_preview
      ?? bridge.settlement_diff_preview
      ?? {},
  );
  const used = bridge.used === true || context.foreshadowing_settlement_proposal_bridge_used === true;
  const counts = {
    paid: diff.paid_foreshadowing_debts.length,
    kept_open: diff.kept_open_debts.length,
    blocked: diff.blocked_canon_intake_items.length,
    allowed_candidate_items: diff.allowed_candidate_settlement_items.length,
  };
  const hasAny = counts.paid + counts.kept_open + counts.blocked + counts.allowed_candidate_items > 0;
  const status = !used && !hasAny
    ? "not_available"
    : counts.blocked > 0
      ? "blocked_surface"
      : "surface_ready";
  const decision = status === "not_available"
    ? "no_foreshadowing_settlement_preview"
    : status === "blocked_surface"
      ? "review_blocked_canon_intake_items"
      : "ready_for_human_settlement_review";
  const nextAction = status === "not_available"
    ? "Build settlement context with Phase 27F bridge input if foreshadowing payoff review is needed."
    : status === "blocked_surface"
      ? "Review blocked canon intake items before creating or accepting a settlement report."
      : "Review paid and kept-open debts in the settlement proposal before any Canon intake.";

  const safety = {
    preview_only: bridge.preview_only !== false,
    candidate_only: bridge.candidate_only !== false,
    read_only: true,
    no_auto_persist: bridge.no_auto_persist !== false,
    no_canon_update: bridge.no_canon_update !== false,
    no_active_engine_update: bridge.no_active_engine_update !== false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    requires_human_settlement_review: true,
    direct_canon_write_allowed: false,
  };

  const surface = {
    used,
    phase: "27G",
    version: foreshadowingSettlementSurfaceVersion,
    surface_kind: "foreshadowing_settlement_ui_mcp_surface",
    source_phase: bridge.phase ?? null,
    status,
    settlement_context_id: context.settlement_context_id ?? null,
    adopted_chapter_id: context.adopted_chapter_id ?? null,
    settlement_mode: context.settlement_mode ?? null,
    counts,
    paid_foreshadowing_debts: diff.paid_foreshadowing_debts,
    kept_open_debts: diff.kept_open_debts,
    blocked_canon_intake_items: diff.blocked_canon_intake_items,
    allowed_candidate_settlement_items: diff.allowed_candidate_settlement_items,
    operator_summary: {
      decision,
      next_action: nextAction,
      requires_human_settlement_review: true,
      direct_canon_write_allowed: false,
      direct_active_engine_update_allowed: false,
    },
    safety,
    warnings: [
      ...array(bridge.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(status === "not_available" ? ["foreshadowing_settlement_surface_not_available"] : []),
      ...(counts.blocked > 0 ? ["foreshadowing_settlement_surface_blocked_items_present"] : []),
    ],
  };

  surface.surface_markdown = markdownFor(surface);
  surface.trace_id = `foreshadowing_settlement_surface_${sha256(JSON.stringify({
    status,
    counts,
    settlement_context_id: surface.settlement_context_id,
    warnings: surface.warnings,
  })).slice(0, 16)}`;
  return surface;
}

export default buildForeshadowingSettlementSurface;
