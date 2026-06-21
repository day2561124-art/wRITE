import { createHash } from "node:crypto";

export const foreshadowingSettlementProposalBridgeVersion = "foreshadowing_settlement_proposal_bridge_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function boolEnabled(value) {
  if (value === true) return true;
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

export function shouldUseForeshadowingSettlementProposalBridge(rawInput = {}, options = {}) {
  return rawInput.include_foreshadowing_settlement_proposal_bridge === true
    || rawInput.includeForeshadowingSettlementProposalBridge === true
    || boolEnabled(options.foreshadowingSettlementProposalBridge)
    || boolEnabled(options.foreshadowing_settlement_proposal_bridge)
    || Boolean(object(rawInput.foreshadowing_settlement_diff_preview).used)
    || Boolean(object(rawInput.foreshadowingSettlementDiffPreview).used);
}

function emptyPreview() {
  return {
    paid_foreshadowing_debts: [],
    kept_open_debts: [],
    blocked_canon_intake_items: [],
    allowed_candidate_settlement_items: [],
  };
}

function disabledContext(status = "disabled") {
  return {
    used: false,
    phase: "27F",
    version: foreshadowingSettlementProposalBridgeVersion,
    status,
    bridge_kind: "foreshadowing_settlement_proposal_bridge",
    preview_only: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    settlement_proposal_ready: false,
    settlement_diff_preview: emptyPreview(),
    settlement_proposal_bridge: {
      paid_count: 0,
      kept_open_count: 0,
      blocked_count: 0,
      allowed_candidate_item_count: 0,
      requires_human_settlement_review: true,
      direct_canon_write_allowed: false,
    },
    chat_markdown: "",
    warnings: [],
  };
}

function sourceConfig(rawInput = {}, options = {}) {
  return object(
    options.foreshadowingSettlementProposalBridge
      ?? options.foreshadowing_settlement_proposal_bridge
      ?? rawInput.foreshadowing_settlement_proposal_bridge
      ?? rawInput.foreshadowingSettlementProposalBridge
      ?? {},
  );
}

function sourcePreview(rawInput = {}, options = {}, config = {}) {
  return object(
    config.foreshadowing_settlement_diff_preview
      ?? config.foreshadowingSettlementDiffPreview
      ?? options.foreshadowingSettlementDiffPreview
      ?? options.foreshadowing_settlement_diff_preview
      ?? rawInput.foreshadowing_settlement_diff_preview
      ?? rawInput.foreshadowingSettlementDiffPreview
      ?? {},
  );
}

function normalizePaid(entry, index) {
  const item = object(entry);
  return {
    debt_id: text(item.debt_id ?? item.debtId, 160) || null,
    promise_id: text(item.promise_id ?? item.promiseId, 160) || null,
    label: text(item.label ?? item.name, 240),
    payoff_id: text(item.payoff_id ?? item.payoffId ?? item.id, 160) || `payoff_${index + 1}`,
    payoff_types: array(item.payoff_types ?? item.payoffTypes).map((value) => text(value, 120)).filter(Boolean),
    consequence: text(item.consequence ?? item.summary ?? item.changed_state ?? item.changedState, 500),
    settlement_action: text(item.settlement_action ?? item.settlementAction, 160)
      || "mark_paid_in_candidate_settlement_preview",
    canon_write_allowed: false,
    requires_settlement_review: true,
  };
}

function normalizeKeptOpen(entry, index) {
  const item = object(entry);
  return {
    debt_id: text(item.debt_id ?? item.debtId ?? item.id, 160) || `open_debt_${index + 1}`,
    label: text(item.label ?? item.name, 240),
    reason: text(item.reason, 240) || "keep_open",
    promise: text(item.promise ?? item.summary, 500),
    settlement_action: "keep_open",
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

function normalizeAllowedCandidate(entry, index) {
  const item = object(entry);
  return {
    type: text(item.type, 180) || "foreshadowing_payoff_paid",
    debt_id: text(item.debt_id ?? item.debtId, 160) || null,
    payoff_id: text(item.payoff_id ?? item.payoffId ?? item.id, 160) || `candidate_item_${index + 1}`,
    requires_settlement_review: true,
    canon_write_allowed: false,
  };
}

function normalizedDiff(previewSource) {
  const preview = object(previewSource.settlement_diff_preview ?? previewSource);
  return {
    paid_foreshadowing_debts: array(preview.paid_foreshadowing_debts)
      .map(normalizePaid),
    kept_open_debts: array(preview.kept_open_debts)
      .map(normalizeKeptOpen),
    blocked_canon_intake_items: array(preview.blocked_canon_intake_items)
      .map(normalizeBlocked),
    allowed_candidate_settlement_items: array(preview.allowed_candidate_settlement_items)
      .map(normalizeAllowedCandidate),
  };
}

function chatMarkdownFor(result) {
  const diff = result.settlement_diff_preview;
  const paidLines = diff.paid_foreshadowing_debts.length
    ? diff.paid_foreshadowing_debts.map((item) => (
      `- PAID debt=${item.debt_id ?? "none"} payoff=${item.payoff_id}; types=${item.payoff_types.join(", ") || "none"}; consequence=${item.consequence || "none"}`
    ))
    : ["- none"];
  const openLines = diff.kept_open_debts.length
    ? diff.kept_open_debts.map((item) => (
      `- OPEN debt=${item.debt_id}; reason=${item.reason}; promise=${item.promise || "none"}`
    ))
    : ["- none"];
  const blockedLines = diff.blocked_canon_intake_items.length
    ? diff.blocked_canon_intake_items.map((item) => (
      `- BLOCKED source=${item.source_type}; id=${item.id}; reason=${item.reason}; canon_intake_allowed=false`
    ))
    : ["- none"];

  return [
    "## Foreshadowing Settlement Proposal Bridge",
    "",
    `- phase: ${result.phase}`,
    `- status: ${result.status}`,
    `- preview_only: ${result.preview_only}`,
    `- candidate_only: ${result.candidate_only}`,
    `- no_auto_persist: ${result.no_auto_persist}`,
    `- no_canon_update: ${result.no_canon_update}`,
    `- no_active_engine_update: ${result.no_active_engine_update}`,
    `- pending_engine_candidate_created: ${result.pending_engine_candidate_created}`,
    `- requires_human_settlement_review: ${result.settlement_proposal_bridge.requires_human_settlement_review}`,
    "",
    "### Paid Foreshadowing Debts",
    ...paidLines,
    "",
    "### Kept Open Debts",
    ...openLines,
    "",
    "### Blocked Canon Intake Items",
    ...blockedLines,
    "",
    "### Settlement Rule",
    "- Use this section only as a settlement proposal aid.",
    "- Do not directly update Canon DB or active_engine from this preview.",
    "- Any Canon intake still requires human settlement review and the existing pending engine candidate flow.",
    "",
  ].join("\n");
}

export async function buildForeshadowingSettlementProposalBridgeContext(rawInput = {}, options = {}) {
  if (!shouldUseForeshadowingSettlementProposalBridge(rawInput, options)) return disabledContext();

  const config = sourceConfig(rawInput, options);
  const previewSource = sourcePreview(rawInput, options, config);
  const diff = normalizedDiff(previewSource);
  const warnings = [];

  if (diff.blocked_canon_intake_items.length) {
    warnings.push("foreshadowing_settlement_bridge_blocked_canon_intake_items_present");
  }
  if (!diff.paid_foreshadowing_debts.length && !diff.kept_open_debts.length && !diff.blocked_canon_intake_items.length) {
    warnings.push("foreshadowing_settlement_bridge_empty_diff_preview");
  }

  const result = {
    used: true,
    phase: "27F",
    version: foreshadowingSettlementProposalBridgeVersion,
    status: diff.blocked_canon_intake_items.length ? "blocked_preview_bridged" : "proposal_bridge_ready",
    bridge_kind: "foreshadowing_settlement_proposal_bridge",
    preview_only: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    settlement_proposal_ready: diff.blocked_canon_intake_items.length === 0,
    settlement_diff_preview: diff,
    settlement_proposal_bridge: {
      paid_count: diff.paid_foreshadowing_debts.length,
      kept_open_count: diff.kept_open_debts.length,
      blocked_count: diff.blocked_canon_intake_items.length,
      allowed_candidate_item_count: diff.allowed_candidate_settlement_items.length,
      requires_human_settlement_review: true,
      direct_canon_write_allowed: false,
      active_engine_update_allowed: false,
      pending_engine_candidate_created: false,
    },
    canon_intake_bridge_contract: {
      direct_canon_write_allowed: false,
      direct_active_engine_update_allowed: false,
      pending_engine_candidate_creation_allowed_here: false,
      settlement_report_may_reference_preview: true,
      existing_human_review_flow_required: true,
    },
    warnings,
  };

  result.chat_markdown = chatMarkdownFor(result);
  result.trace_id = `foreshadowing_settlement_proposal_bridge_${sha256(JSON.stringify({
    status: result.status,
    settlement_diff_preview: result.settlement_diff_preview,
    warnings,
  })).slice(0, 16)}`;
  return result;
}

export default buildForeshadowingSettlementProposalBridgeContext;
