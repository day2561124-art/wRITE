export const foreshadowingSettlementOperatorLedgerBridgeSurfaceVersion =
  "foreshadowing_settlement_operator_ledger_bridge_surface_v1";

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

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSafety(input = {}) {
  const source = object(input);
  return {
    read_only: true,
    preview_only: source.preview_only !== false,
    candidate_only: source.candidate_only !== false,
    no_auto_persist: source.no_auto_persist !== false,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_canon: false,
    bridge_can_modify_active_engine: false,
    mcp_can_approve: false,
    mcp_can_confirm_adoption: false,
    mcp_can_activate_engine: false,
    mcp_can_modify_canon: false,
    mcp_can_modify_active_engine: false,
    surface_can_approve: false,
    surface_can_confirm_adoption: false,
    surface_can_activate_engine: false,
    requires_explicit_human_operator_decision: true,
  };
}

function normalizeBadge(input, index) {
  const badge = object(input);
  const key = text(badge.key, 160) || `badge_${index + 1}`;
  const canKey = key.includes("can_");
  const value = badge.value === true;
  return {
    key,
    label: text(badge.label, 200) || key,
    value,
    allowed: canKey ? false : value,
    denied: canKey ? value !== true : false,
  };
}

function normalizeCard(input, index) {
  const card = object(input);
  return {
    key: text(card.key, 160) || `card_${index + 1}`,
    title: text(card.title, 240) || "Untitled card",
    value: text(card.value, 80) || String(card.value ?? ""),
    tone: text(card.tone, 80) || "neutral",
    summary: text(card.summary, 600),
  };
}

function normalizeFilter(input, index) {
  const filter = object(input);
  return {
    key: text(filter.key, 160) || `filter_${index + 1}`,
    label: text(filter.label, 240) || "Untitled filter",
    options: array(filter.options).map((option, optionIndex) => {
      const item = object(option);
      return {
        key: text(item.key, 240) || `option_${optionIndex + 1}`,
        label: text(item.label, 240) || text(item.value, 240) || "not_available",
        value: text(item.value, 240) || "not_available",
        count: integer(item.count, 0),
      };
    }),
  };
}

function normalizeRow(input, index) {
  const row = object(input);
  const action = object(row.next_operator_action);
  return {
    row_id: text(row.row_id, 240) || `ledger_row_${index + 1}`,
    source_receipt_id: text(row.source_receipt_id, 240) || null,
    ledger_status: text(row.ledger_status, 160) || "not_available",
    decision: text(row.decision, 160) || "not_available",
    packet_status: text(row.packet_status, 160) || "not_available",
    settlement_context_id: text(row.settlement_context_id, 220) || null,
    approval_item_id: text(row.approval_item_id, 220) || null,
    checklist_required: integer(row.checklist_required, 0),
    checklist_required_failed: integer(row.checklist_required_failed, 0),
    failed_checklist_keys: array(row.failed_checklist_keys).map((item) => text(item, 160)).filter(Boolean),
    next_operator_action: {
      key: text(action.key, 160) || "inspect_handoff_audit_receipt_source",
      label: text(action.label, 240) || "Inspect handoff audit receipt source before operator decision",
      route: text(action.route, 120) || "#settlement",
      ui_target: text(action.ui_target, 120) || text(action.route, 120).replace(/^#/u, "") || "settlement",
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

function normalizeAction(input, index) {
  const action = object(input);
  return {
    key: text(action.key, 160) || `operator_action_${index + 1}`,
    label: text(action.label, 240) || "Review ledger entry",
    route: text(action.route, 120) || "#settlement",
    ui_target: text(action.ui_target, 120) || text(action.route, 120).replace(/^#/u, "") || "settlement",
    enabled: action.enabled === true,
    allowed: action.allowed === true,
    entry_count: integer(action.entry_count, 0),
    ledger_statuses: array(action.ledger_statuses).map((item) => text(item, 160)).filter(Boolean),
    entry_ids: array(action.entry_ids).map((item) => text(item, 240)).filter(Boolean),
    forbidden: array(action.forbidden).map((item) => text(item, 160)).filter(Boolean),
  };
}

function normalizeSummary(ledgerUi, rows) {
  const summaryText = text(ledgerUi.summary, 1000);
  const cards = array(ledgerUi.cards);
  const cardValue = (key) => {
    const card = cards.find((item) => object(item).key === key);
    const value = Number.parseInt(String(object(card).value ?? ""), 10);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    text: summaryText,
    total_entries: cardValue("total_entries") || rows.length,
    blocked_entries: cardValue("blocked_entries"),
    review_ready_entries: cardValue("review_ready_entries"),
    required_failures: cardValue("required_failures"),
  };
}

function callHintsFor(surface) {
  return [
    {
      key: "read_surface_only",
      label: "Read ledger bridge surface",
      tool_name: surface.tool_name,
      allowed: true,
      writes_files: false,
      args: {
        id: surface.settlement_context_id ?? "<settlement_context_id>",
        include_raw: false,
        include_markdown: true,
        max_rows: 50,
      },
    },
    {
      key: "human_operator_decision_required",
      label: "Human operator decision remains outside ChatGPT/MCP authority",
      allowed: false,
      forbidden: [
        "approve_from_chatgpt_bridge",
        "confirm_adoption_from_chatgpt_bridge",
        "activate_engine_from_chatgpt_bridge",
        "modify_canon_db",
        "modify_active_engine",
      ],
    },
  ];
}

function markdownFor(surface) {
  const rows = surface.mcp_payload.rows.length
    ? surface.mcp_payload.rows.map((row) => [
      "- row_id=" + row.row_id,
      "  ledger_status=" + row.ledger_status,
      "  decision=" + row.decision,
      "  packet_status=" + row.packet_status,
      "  next_operator_action=" + row.next_operator_action.key,
    ].join("\n"))
    : ["- none"];

  return [
    "## Foreshadowing Settlement Operator Ledger Bridge Surface",
    "",
    "- phase: " + surface.phase,
    "- version: " + surface.version,
    "- tool_name: " + surface.tool_name,
    "- settlement_context_id: " + (surface.settlement_context_id ?? "none"),
    "- ledger_id: " + (surface.ledger_id ?? "none"),
    "- status: " + surface.status,
    "- read_only: " + String(surface.safety.read_only),
    "- no_canon_update: " + String(surface.safety.no_canon_update),
    "- no_active_engine_update: " + String(surface.safety.no_active_engine_update),
    "- mcp_can_approve: " + String(surface.safety.mcp_can_approve),
    "- mcp_can_confirm_adoption: " + String(surface.safety.mcp_can_confirm_adoption),
    "- mcp_can_activate_engine: " + String(surface.safety.mcp_can_activate_engine),
    "",
    "### MCP Rows",
    ...rows,
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorLedgerBridgeSurface(input = {}) {
  const bundle = object(input);
  const ledgerUi = object(
    bundle.operator_ledger_ui
      ?? bundle.ledger_ui
      ?? bundle.foreshadowing_settlement_operator_ledger_ui
      ?? bundle.ui,
  );
  const rawLedger = object(
    ledgerUi.raw_ledger
      ?? bundle.operator_decision_ledger
      ?? bundle.decision_ledger
      ?? bundle.ledger,
  );
  const allRows = array(ledgerUi.rows).map(normalizeRow);
  const maxRows = Math.min(
    Math.max(integer(bundle.max_rows ?? bundle.maxRows, allRows.length || 50), 1),
    100,
  );
  const rows = allRows.slice(0, maxRows);
  const safety = normalizeSafety({ ...object(rawLedger.safety), ...object(ledgerUi.safety) });
  const used = ledgerUi.used === true || rawLedger.used === true;
  const status = text(ledgerUi.status, 160) || (used ? "recorded" : "not_available");
  const surface = {
    ok: true,
    used,
    phase: "27P",
    version: foreshadowingSettlementOperatorLedgerBridgeSurfaceVersion,
    bridge_surface_kind: "foreshadowing_settlement_operator_ledger_bridge_mcp_surface",
    bridge_surface: "chatgpt_bridge_mcp",
    tool_name: "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface",
    source_phase: text(ledgerUi.phase, 40) || null,
    source_version: text(ledgerUi.version, 180) || null,
    ledger_id: text(ledgerUi.ledger_id ?? rawLedger.ledger_id, 240) || null,
    settlement_context_id: text(bundle.settlement_context_id ?? bundle.settlementContextId, 240) || null,
    approval_item_id: text(bundle.approval_item_id ?? bundle.approvalItemId, 240) || null,
    status,
    headline: text(ledgerUi.headline, 500) || "Foreshadowing settlement operator ledger bridge surface",
    summary: normalizeSummary(ledgerUi, allRows),
    mcp_payload: {
      content_type: "application/json",
      schema_version: foreshadowingSettlementOperatorLedgerBridgeSurfaceVersion,
      cards: array(ledgerUi.cards).map(normalizeCard),
      filters: array(ledgerUi.filters).map(normalizeFilter),
      rows,
      row_count: allRows.length,
      rows_returned: rows.length,
      rows_truncated: allRows.length > rows.length,
      next_operator_actions: array(ledgerUi.next_operator_actions).map(normalizeAction),
      safety_badges: array(ledgerUi.safety_badges).map(normalizeBadge),
    },
    bridge_metadata: {
      read_only_tool: true,
      mcp_public_profile_allowed: true,
      full_profile_allowed: true,
      writes_files: false,
      creates_approval_item: false,
      confirms_adoption: false,
      creates_pending_engine_candidate: false,
      activates_engine: false,
      modifies_canon: false,
      modifies_active_engine: false,
      requires_human_operator_decision: true,
    },
    integrity: object(ledgerUi.integrity ?? rawLedger.integrity),
    safety,
    warnings: [
      ...array(ledgerUi.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(used ? [] : ["foreshadowing_settlement_operator_ledger_bridge_no_source_ui"]),
      ...(status === "blocked" ? ["foreshadowing_settlement_operator_ledger_bridge_contains_blocked_entries"] : []),
    ],
    raw_ledger_ui: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? ledgerUi : null,
  };
  surface.mcp_payload.call_hints = callHintsFor(surface);
  surface.surface_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(surface)
    : "";
  return surface;
}

export default buildForeshadowingSettlementOperatorLedgerBridgeSurface;
