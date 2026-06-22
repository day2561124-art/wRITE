export const foreshadowingSettlementOperatorLedgerUiVersion =
  "foreshadowing_settlement_operator_ledger_ui_v1";

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

function statusTone(status) {
  return {
    blocked: "blocked",
    review_ready: "ready",
    source_not_available: "warning",
    recorded: "neutral",
    not_available: "empty",
  }[status] ?? "neutral";
}

function statusBadge(status) {
  const tone = statusTone(status);
  return {
    label: {
      blocked: "Blocked entries recorded",
      review_ready: "Ready for human operator review",
      source_not_available: "Receipt source unavailable",
      recorded: "Ledger recorded",
      not_available: "No ledger available",
    }[status] ?? status,
    class_name: {
      blocked: "candidate-status-blocked",
      ready: "candidate-status-candidate",
      warning: "candidate-status-rejected",
      neutral: "candidate-status-candidate",
      empty: "candidate-status-rejected",
    }[tone] ?? "candidate-status-candidate",
    tone,
  };
}

function displayStatusFor(ledger, summary) {
  if (ledger.used !== true || summary.total === 0) return "not_available";
  if (summary.blocked > 0) return "blocked";
  if (summary.review_ready > 0) return "review_ready";
  if (summary.source_not_available > 0) return "source_not_available";
  return "recorded";
}

function headlineFor(status) {
  if (status === "blocked") return "Foreshadowing settlement ledger contains blocked entries";
  if (status === "review_ready") return "Foreshadowing settlement ledger is ready for human operator review";
  if (status === "source_not_available") return "Foreshadowing settlement ledger needs receipt source inspection";
  if (status === "recorded") return "Foreshadowing settlement ledger preview is recorded";
  return "No foreshadowing settlement decision ledger is available";
}

function summaryText(summary, status) {
  if (status === "not_available") {
    return "Build a handoff audit receipt and decision ledger before displaying the review index.";
  }
  return [
    `entries=${summary.total}`,
    `blocked=${summary.blocked}`,
    `review_ready=${summary.review_ready}`,
    `source_not_available=${summary.source_not_available}`,
    `required_failed=${summary.required_failed}`,
  ].join(" | ");
}

function summaryCards(summary) {
  return [
    {
      key: "total_entries",
      title: "Ledger entries",
      value: String(summary.total),
      tone: summary.total > 0 ? "ready" : "neutral",
      summary: "Decision ledger entries derived from handoff audit receipts.",
    },
    {
      key: "blocked_entries",
      title: "Blocked entries",
      value: String(summary.blocked),
      tone: summary.blocked > 0 ? "blocked" : "neutral",
      summary: "Blocked entries must return to guard or Approval Queue review.",
    },
    {
      key: "review_ready_entries",
      title: "Review-ready entries",
      value: String(summary.review_ready),
      tone: summary.review_ready > 0 ? "ready" : "neutral",
      summary: "Review-ready entries remain candidate-only until human operator review.",
    },
    {
      key: "required_failures",
      title: "Required check failures",
      value: String(summary.required_failed),
      tone: summary.required_failed > 0 ? "blocked" : "neutral",
      summary: "Any failed required checklist item blocks settlement intake.",
    },
  ];
}

function safetyBadges(safety) {
  return [
    ["read_only", safety.read_only === true],
    ["preview_only", safety.preview_only === true],
    ["candidate_only", safety.candidate_only === true],
    ["no_canon_update", safety.no_canon_update === true],
    ["no_active_engine_update", safety.no_active_engine_update === true],
    ["ledger_can_approve", safety.ledger_can_approve === true],
    ["ledger_can_confirm_adoption", safety.ledger_can_confirm_adoption === true],
    ["ledger_can_activate_engine", safety.ledger_can_activate_engine === true],
    ["ui_can_approve", false],
    ["ui_can_confirm_adoption", false],
    ["ui_can_activate_engine", false],
  ].map(([key, value]) => ({
    key,
    label: key,
    value,
    allowed: value === true && !key.includes("can_"),
    denied: key.includes("can_") ? value !== true : false,
  }));
}

function optionCount(values, key) {
  return Object.entries(object(values)).map(([value, entryIds]) => ({
    key: `${key}:${value}`,
    value,
    label: value,
    count: array(entryIds).length,
  }));
}

function filtersFor(index) {
  return [
    {
      key: "ledger_status",
      label: "Ledger status",
      options: optionCount(index.by_ledger_status, "ledger_status"),
    },
    {
      key: "decision",
      label: "Decision",
      options: optionCount(index.by_decision, "decision"),
    },
    {
      key: "packet_status",
      label: "Packet status",
      options: optionCount(index.by_packet_status, "packet_status"),
    },
  ];
}

function indexSections(index) {
  return Object.entries(object(index)).map(([key, values]) => ({
    key,
    title: key,
    groups: Object.entries(object(values)).map(([value, entryIds]) => ({
      value,
      count: array(entryIds).length,
      entry_ids: array(entryIds).map((item) => text(item, 220)).filter(Boolean),
    })),
  }));
}

function rowFor(entryInput, index) {
  const entry = object(entryInput);
  const packet = object(entry.source_packet);
  const action = object(entry.next_operator_action);
  const status = text(entry.ledger_status, 120) || "not_available";
  return {
    row_id: text(entry.entry_id, 240) || `missing_entry_${index + 1}`,
    source_receipt_id: text(entry.source_receipt_id, 240) || null,
    ledger_status: status,
    status_badge: statusBadge(status),
    decision: text(entry.decision, 160) || "not_available",
    packet_status: text(packet.status, 160) || "not_available",
    settlement_context_id: text(packet.settlement_context_id, 220) || null,
    approval_item_id: text(packet.approval_item_id, 220) || null,
    checklist_required: integer(entry.checklist_required, 0),
    checklist_required_failed: integer(entry.checklist_required_failed, 0),
    failed_checklist_keys: array(entry.failed_checklist_keys).map((item) => text(item, 160)).filter(Boolean),
    next_operator_action: {
      key: text(action.key, 160) || "inspect_handoff_audit_receipt_source",
      label: text(action.label, 240) || "Inspect handoff audit receipt source before operator decision",
      route: text(action.route, 120) || "#settlement",
      ui_target: text(action.route, 120).replace(/^#/u, "") || "settlement",
      enabled: action.enabled === true,
      allowed: action.allowed === true,
      forbidden: array(action.forbidden).map((item) => text(item, 160)).filter(Boolean),
    },
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_modify_canon: false,
    can_modify_active_engine: false,
  };
}

function actionKeyFor(row) {
  return row.next_operator_action.key;
}

function nextActionsFor(rows) {
  const actions = new Map();
  for (const row of rows) {
    const key = actionKeyFor(row);
    const current = actions.get(key) ?? {
      ...row.next_operator_action,
      entry_count: 0,
      ledger_statuses: new Set(),
      entry_ids: [],
    };
    current.entry_count += 1;
    current.ledger_statuses.add(row.ledger_status);
    current.entry_ids.push(row.row_id);
    actions.set(key, current);
  }
  return [...actions.values()].map((action) => ({
    ...action,
    ledger_statuses: [...action.ledger_statuses],
  }));
}

export function buildForeshadowingSettlementOperatorLedgerUi(input = {}) {
  const bundle = object(input);
  const ledger = object(
    bundle.operator_decision_ledger
      ?? bundle.decision_ledger
      ?? bundle.ledger
      ?? bundle.foreshadowing_settlement_operator_decision_ledger,
  );
  const rawSummary = object(ledger.summary);
  const summary = {
    total: integer(rawSummary.total, array(ledger.entries).length),
    blocked: integer(rawSummary.blocked, 0),
    review_ready: integer(rawSummary.review_ready, 0),
    recorded: integer(rawSummary.recorded, 0),
    source_not_available: integer(rawSummary.source_not_available, 0),
    required_failed: integer(rawSummary.required_failed, 0),
    requires_human_operator_decision: integer(rawSummary.requires_human_operator_decision, 0),
  };
  const status = displayStatusFor(ledger, summary);
  const rows = array(ledger.entries).map(rowFor);
  const safety = {
    ...object(ledger.safety),
    read_only: true,
    preview_only: object(ledger.safety).preview_only !== false,
    candidate_only: object(ledger.safety).candidate_only !== false,
    no_auto_persist: object(ledger.safety).no_auto_persist !== false,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    ledger_can_approve: false,
    ledger_can_confirm_adoption: false,
    ledger_can_activate_engine: false,
    ui_can_approve: false,
    ui_can_confirm_adoption: false,
    ui_can_activate_engine: false,
    ui_can_modify_canon: false,
    ui_can_modify_active_engine: false,
    requires_explicit_human_operator_decision: true,
  };
  return {
    used: ledger.used === true,
    phase: "27O",
    version: foreshadowingSettlementOperatorLedgerUiVersion,
    ui_kind: "foreshadowing_settlement_operator_decision_ledger_ui",
    source_phase: text(ledger.phase, 40) || null,
    source_version: text(ledger.version, 180) || null,
    ledger_id: text(ledger.ledger_id, 240) || null,
    status,
    status_badge: statusBadge(status),
    headline: headlineFor(status),
    summary: summaryText(summary, status),
    cards: summaryCards(summary),
    filters: filtersFor(object(ledger.index)),
    index_sections: indexSections(object(ledger.index)),
    rows,
    next_operator_actions: nextActionsFor(rows),
    integrity: object(ledger.integrity),
    safety_badges: safetyBadges(safety),
    safety,
    warnings: [
      ...array(ledger.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(ledger.used === true ? [] : ["foreshadowing_settlement_operator_ledger_ui_no_ledger"]),
      ...(summary.blocked > 0 ? ["foreshadowing_settlement_operator_ledger_ui_contains_blocked_entries"] : []),
    ],
    raw_ledger: ledger,
  };
}

export default buildForeshadowingSettlementOperatorLedgerUi;
