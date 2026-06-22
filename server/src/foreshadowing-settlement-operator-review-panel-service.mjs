import { createHash } from "node:crypto";

export const foreshadowingSettlementOperatorReviewPanelVersion =
  "foreshadowing_settlement_operator_review_panel_v1";

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

function normalizeBridgeSafety(value = {}) {
  const safety = object(value);
  const reportedAllowed = [
    "bridge_can_approve",
    "bridge_can_confirm_adoption",
    "bridge_can_activate_engine",
    "bridge_can_modify_active_engine",
    "bridge_can_modify_compressed_rules",
  ].filter((key) => safety[key] === true);
  return {
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
    reported_allowed_operations_normalized_to_denied: reportedAllowed,
  };
}

function normalizeCounts(surface, paid, keptOpen, blocked, allowedCandidate) {
  const source = object(surface.counts);
  return {
    paid: Number.isInteger(source.paid) ? source.paid : paid.length,
    kept_open: Number.isInteger(source.kept_open) ? source.kept_open : keptOpen.length,
    blocked: Number.isInteger(source.blocked) ? source.blocked : blocked.length,
    allowed_candidate_items: Number.isInteger(source.allowed_candidate_items)
      ? source.allowed_candidate_items
      : allowedCandidate.length,
  };
}

function normalizeReason(value, index) {
  const item = object(value);
  return {
    reason: text(item.reason ?? value, 240) || `blocked_reason_${index + 1}`,
    source: text(item.source ?? item.code, 160) || "approval_queue_readiness",
  };
}

function section(key, title, items, summary = "") {
  return {
    key,
    title,
    count: items.length,
    items,
    summary,
  };
}

function nextActionFor(status, blockedReasons) {
  if (status === "not_available") {
    return {
      key: "build_foreshadowing_settlement_surface",
      label: "Build foreshadowing settlement preview surface",
      route: "#settlement",
      reason: "No foreshadowing settlement preview is available for operator review.",
    };
  }
  if (status === "blocked_review") {
    return {
      key: "review_blocked_guard",
      label: "Review blocked Approval Queue guard state",
      route: "#approval",
      reason: blockedReasons.map((item) => item.reason).join("; ") || "Approval readiness is blocked.",
    };
  }
  return {
    key: "review_settlement_preview",
    label: "Review foreshadowing settlement preview before Canon intake",
    route: "#settlement",
    reason: "Paid and kept-open debts are ready for explicit human settlement review.",
  };
}

function markdownFor(panel) {
  const reasonLines = panel.blocked_reasons.length
    ? panel.blocked_reasons.map((item) => `- BLOCKED reason=${item.reason}; source=${item.source}`)
    : ["- none"];
  const paidLines = panel.paid_foreshadowing_debts.length
    ? panel.paid_foreshadowing_debts.map((item) => (
      `- PAID debt=${item.debt_id ?? "none"} payoff=${item.payoff_id ?? "none"}; consequence=${item.consequence || "none"}`
    ))
    : ["- none"];
  const openLines = panel.kept_open_debts.length
    ? panel.kept_open_debts.map((item) => (
      `- OPEN debt=${item.debt_id ?? "none"}; reason=${item.reason || "keep_open"}; promise=${item.promise || "none"}`
    ))
    : ["- none"];
  const candidateLines = panel.allowed_candidate_settlement_items.length
    ? panel.allowed_candidate_settlement_items.map((item) => (
      `- CANDIDATE type=${item.type ?? "foreshadowing_payoff_paid"}; debt=${item.debt_id ?? "none"}; payoff=${item.payoff_id ?? "none"}`
    ))
    : ["- none"];

  return [
    "## Foreshadowing Settlement Operator Review Panel",
    "",
    `- phase: ${panel.phase}`,
    `- version: ${panel.version}`,
    `- status: ${panel.status}`,
    `- source_phase: ${panel.source_phase ?? "none"}`,
    `- settlement_context_id: ${panel.settlement_context_id ?? "none"}`,
    `- approval_item_id: ${panel.approval_item_id ?? "none"}`,
    `- read_only: ${panel.safety.read_only}`,
    `- preview_only: ${panel.safety.preview_only}`,
    `- no_canon_update: ${panel.safety.no_canon_update}`,
    `- no_active_engine_update: ${panel.safety.no_active_engine_update}`,
    "",
    "### Blocked Reasons",
    ...reasonLines,
    "",
    "### Paid Foreshadowing Debts",
    ...paidLines,
    "",
    "### Kept Open Debts",
    ...openLines,
    "",
    "### Allowed Candidate Settlement Items",
    ...candidateLines,
    "",
    "### ChatGPT Bridge Safety State",
    `- bridge_can_approve: ${panel.chatgpt_bridge_safety.bridge_can_approve}`,
    `- bridge_can_confirm_adoption: ${panel.chatgpt_bridge_safety.bridge_can_confirm_adoption}`,
    `- bridge_can_activate_engine: ${panel.chatgpt_bridge_safety.bridge_can_activate_engine}`,
    `- bridge_can_modify_active_engine: ${panel.chatgpt_bridge_safety.bridge_can_modify_active_engine}`,
    "",
    "### Next Operator Action",
    `- key: ${panel.next_operator_action.key}`,
    `- label: ${panel.next_operator_action.label}`,
    `- route: ${panel.next_operator_action.route}`,
    `- reason: ${panel.next_operator_action.reason}`,
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorReviewPanel(input = {}) {
  const bundle = object(input);
  const surface = object(
    bundle.surface
      ?? bundle.settlement_surface
      ?? bundle.foreshadowing_settlement_surface,
  );
  const readiness = object(
    bundle.readiness
      ?? bundle.readiness_report
      ?? bundle.approval_readiness,
  );

  const paid = array(surface.paid_foreshadowing_debts);
  const keptOpen = array(surface.kept_open_debts);
  const blockedCanonItems = array(surface.blocked_canon_intake_items);
  const allowedCandidateItems = array(surface.allowed_candidate_settlement_items);
  const counts = normalizeCounts(surface, paid, keptOpen, blockedCanonItems, allowedCandidateItems);
  const hasSurfaceData = surface.used === true
    || [counts.paid, counts.kept_open, counts.blocked, counts.allowed_candidate_items]
      .some((count) => count > 0);

  const blockedReasons = array(readiness.blocking_reasons).map(normalizeReason);
  const readinessDecision = text(readiness.decision, 120);
  const readinessBlocked = readiness.ok === false
    || readinessDecision === "blocked"
    || blockedReasons.length > 0;
  const surfaceBlocked = surface.status === "blocked_surface" || counts.blocked > 0;
  const status = !hasSurfaceData
    ? "not_available"
    : readinessBlocked || surfaceBlocked
      ? "blocked_review"
      : "review_ready";
  const nextOperatorAction = nextActionFor(status, blockedReasons);
  const chatgptBridgeSafety = normalizeBridgeSafety(readiness.safety);

  const safety = {
    preview_only: surface.safety?.preview_only !== false,
    candidate_only: surface.safety?.candidate_only !== false,
    read_only: true,
    no_auto_persist: surface.safety?.no_auto_persist !== false,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    requires_human_settlement_review: true,
    direct_canon_write_allowed: false,
    direct_active_engine_update_allowed: false,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
  };

  const displaySections = [
    section(
      "blocked_reasons",
      "Blocked reasons",
      blockedReasons,
      blockedReasons.length ? "Approval readiness is blocked." : "No blocking reason was reported.",
    ),
    section(
      "paid_foreshadowing_debts",
      "Paid foreshadowing debts",
      paid,
      `${counts.paid} paid foreshadowing debts are visible for review.`,
    ),
    section(
      "kept_open_debts",
      "Kept-open debts",
      keptOpen,
      `${counts.kept_open} debts remain open and must not be marked paid.`,
    ),
    section(
      "allowed_candidate_settlement_items",
      "Allowed candidate settlement items",
      allowedCandidateItems,
      `${counts.allowed_candidate_items} candidate-only settlement items may be reviewed by the operator.`,
    ),
    section(
      "chatgpt_bridge_safety",
      "ChatGPT bridge safety state",
      [chatgptBridgeSafety],
      "Bridge-side approve, confirm adoption, and active_engine activation remain denied.",
    ),
    section(
      "next_operator_action",
      "Next operator action",
      [nextOperatorAction],
      nextOperatorAction.reason,
    ),
  ];

  const warnings = [
    ...array(surface.warnings).map((warning) => text(warning, 240)).filter(Boolean),
    ...(status === "not_available" ? ["foreshadowing_settlement_operator_panel_not_available"] : []),
    ...(status === "blocked_review" ? ["foreshadowing_settlement_operator_panel_blocked_by_guard"] : []),
    ...(chatgptBridgeSafety.reported_allowed_operations_normalized_to_denied.length
      ? ["foreshadowing_settlement_operator_panel_normalized_bridge_denial"]
      : []),
  ];

  const panel = {
    used: hasSurfaceData,
    phase: "27J",
    version: foreshadowingSettlementOperatorReviewPanelVersion,
    panel_kind: "foreshadowing_settlement_operator_review_panel",
    source_phase: surface.phase ?? null,
    source_version: surface.version ?? null,
    status,
    decision: status === "blocked_review"
      ? "blocked"
      : status === "review_ready"
        ? "operator_review_ready"
        : "not_available",
    settlement_context_id: surface.settlement_context_id ?? null,
    adopted_chapter_id: surface.adopted_chapter_id ?? null,
    approval_item_id: text(readiness.approval_item_id ?? readiness.request_id, 200) || null,
    blocked_reason: blockedReasons[0]?.reason ?? null,
    blocked_reasons: blockedReasons,
    counts,
    paid_foreshadowing_debts: paid,
    kept_open_debts: keptOpen,
    blocked_canon_intake_items: blockedCanonItems,
    allowed_candidate_settlement_items: allowedCandidateItems,
    chatgpt_bridge_safety: chatgptBridgeSafety,
    next_operator_action: nextOperatorAction,
    display_sections: displaySections,
    safety,
    warnings,
  };

  panel.panel_markdown = markdownFor(panel);
  panel.trace_id = `foreshadowing_settlement_operator_panel_${sha256(JSON.stringify({
    status,
    counts,
    blocked_reasons: blockedReasons,
    settlement_context_id: panel.settlement_context_id,
    approval_item_id: panel.approval_item_id,
  })).slice(0, 16)}`;
  return panel;
}

export default buildForeshadowingSettlementOperatorReviewPanel;
