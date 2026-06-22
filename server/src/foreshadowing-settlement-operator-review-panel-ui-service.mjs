export const foreshadowingSettlementOperatorReviewPanelUiVersion =
  "foreshadowing_settlement_operator_review_panel_ui_v1";

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

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function statusBadge(status) {
  if (status === "blocked_review") {
    return {
      label: "Blocked by guard",
      class_name: "candidate-status-blocked",
      tone: "blocked",
    };
  }
  if (status === "review_ready") {
    return {
      label: "Operator review ready",
      class_name: "candidate-status-candidate",
      tone: "ready",
    };
  }
  return {
    label: "No surface yet",
    class_name: "candidate-status-rejected",
    tone: "empty",
  };
}

function headlineFor(status) {
  if (status === "blocked_review") return "Foreshadowing settlement requires operator review";
  if (status === "review_ready") return "Foreshadowing settlement preview is ready for operator review";
  return "No foreshadowing settlement preview is available";
}

function summaryFor(panel, counts, blockedReasons) {
  if (panel.status === "blocked_review") {
    return blockedReasons.length
      ? `Approval Queue blocked: ${blockedReasons.map((item) => item.reason).join("; ")}`
      : "Approval Queue blocked; inspect guard state.";
  }
  if (panel.status === "review_ready") {
    return [
      `paid=${counts.paid}`,
      `kept_open=${counts.kept_open}`,
      `allowed_candidate_items=${counts.allowed_candidate_items}`,
    ].join(" | ");
  }
  return "No foreshadowing settlement surface is available. Build a settlement preview before operator review.";
}

function normalizeSection(section) {
  const item = object(section);
  return {
    key: text(item.key, 120) || "unknown",
    title: text(item.title, 240) || "Untitled section",
    count: integer(item.count, array(item.items).length),
    summary: text(item.summary, 500),
    items: array(item.items),
  };
}

function safetyBadges(safety, bridgeSafety) {
  return [
    ["read_only", safety.read_only === true],
    ["preview_only", safety.preview_only === true],
    ["candidate_only", safety.candidate_only === true],
    ["no_canon_update", safety.no_canon_update === true],
    ["no_active_engine_update", safety.no_active_engine_update === true],
    ["bridge_can_approve", bridgeSafety.bridge_can_approve === true],
    ["bridge_can_confirm_adoption", bridgeSafety.bridge_can_confirm_adoption === true],
    ["bridge_can_activate_engine", bridgeSafety.bridge_can_activate_engine === true],
  ].map(([key, value]) => ({
    key,
    label: key,
    value,
    allowed: value === true && !key.startsWith("bridge_can_"),
    denied: key.startsWith("bridge_can_") ? value !== true : false,
  }));
}

export function buildForeshadowingSettlementOperatorReviewPanelUi(panelInput = {}) {
  const panel = object(panelInput);
  const counts = {
    paid: integer(object(panel.counts).paid, array(panel.paid_foreshadowing_debts).length),
    kept_open: integer(object(panel.counts).kept_open, array(panel.kept_open_debts).length),
    blocked: integer(object(panel.counts).blocked, array(panel.blocked_canon_intake_items).length),
    allowed_candidate_items: integer(
      object(panel.counts).allowed_candidate_items,
      array(panel.allowed_candidate_settlement_items).length,
    ),
  };
  const status = text(panel.status, 120) || "not_available";
  const badge = statusBadge(status);
  const blockedReasons = array(panel.blocked_reasons).map((item) => object(item));
  const safety = object(panel.safety);
  const bridgeSafety = object(panel.chatgpt_bridge_safety);
  const nextOperatorAction = object(panel.next_operator_action);
  const sections = array(panel.display_sections).map(normalizeSection);
  const cards = [
    {
      key: "blocked_reasons",
      title: "Blocked reasons",
      value: String(blockedReasons.length),
      tone: blockedReasons.length ? "blocked" : "neutral",
      summary: blockedReasons.map((item) => text(item.reason, 240)).filter(Boolean).join("; ")
        || "No blocking reason was reported.",
    },
    {
      key: "paid_foreshadowing_debts",
      title: "Paid foreshadowing debts",
      value: String(counts.paid),
      tone: counts.paid > 0 ? "ready" : "neutral",
      summary: "Paid debts remain candidate-only until explicit human settlement review.",
    },
    {
      key: "kept_open_debts",
      title: "Kept-open debts",
      value: String(counts.kept_open),
      tone: counts.kept_open > 0 ? "warning" : "neutral",
      summary: "Open debts must not be marked paid or canonized.",
    },
    {
      key: "allowed_candidate_settlement_items",
      title: "Allowed candidate settlement items",
      value: String(counts.allowed_candidate_items),
      tone: counts.allowed_candidate_items > 0 ? "ready" : "neutral",
      summary: "These items are preview-only and require operator review.",
    },
  ];

  const route = text(nextOperatorAction.route, 120) || "#settlement";
  return {
    used: panel.used === true,
    phase: "27K",
    version: foreshadowingSettlementOperatorReviewPanelUiVersion,
    ui_kind: "foreshadowing_settlement_operator_review_panel_ui",
    source_phase: text(panel.phase, 40) || null,
    source_version: text(panel.version, 160) || null,
    status,
    decision: text(panel.decision, 120) || "not_available",
    status_badge: badge,
    headline: headlineFor(status),
    summary: summaryFor(panel, counts, blockedReasons),
    settlement_context_id: text(panel.settlement_context_id, 200) || null,
    approval_item_id: text(panel.approval_item_id, 200) || null,
    blocked_reason: text(panel.blocked_reason, 240) || null,
    counts,
    cards,
    sections,
    next_operator_action: {
      key: text(nextOperatorAction.key, 160) || "build_foreshadowing_settlement_surface",
      label: text(nextOperatorAction.label, 240) || "Build foreshadowing settlement preview surface",
      route,
      reason: text(nextOperatorAction.reason, 500),
      ui_target: route.replace(/^#/u, "") || "settlement",
      enabled: true,
    },
    safety_badges: safetyBadges(safety, bridgeSafety),
    safety: {
      read_only: true,
      preview_only: safety.preview_only !== false,
      candidate_only: safety.candidate_only !== false,
      no_auto_persist: safety.no_auto_persist !== false,
      no_canon_update: true,
      no_active_engine_update: true,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      requires_human_settlement_review: true,
    },
    raw_panel: panel,
  };
}

export default buildForeshadowingSettlementOperatorReviewPanelUi;
