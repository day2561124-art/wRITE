import { createHash } from "node:crypto";

export const foreshadowingSettlementOperatorDecisionLedgerVersion =
  "foreshadowing_settlement_operator_decision_ledger_v1";

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

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stable(value));
}

function normalizeSafety(sourceSafety) {
  const safety = object(sourceSafety);
  return {
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
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
    receipt_can_approve: false,
    receipt_can_confirm_adoption: false,
    receipt_can_activate_engine: false,
    receipt_can_modify_canon: false,
    receipt_can_modify_active_engine: false,
    ledger_can_approve: false,
    ledger_can_confirm_adoption: false,
    ledger_can_activate_engine: false,
    ledger_can_modify_canon: false,
    ledger_can_modify_active_engine: false,
    requires_explicit_human_operator_decision: true,
  };
}

function normalizeReceipts(bundle) {
  const direct = bundle.audit_receipts
    ?? bundle.receipts
    ?? bundle.handoff_audit_receipts
    ?? bundle.foreshadowing_settlement_operator_handoff_audit_receipts;
  if (Array.isArray(direct)) return direct.map(object);
  const single = bundle.audit_receipt
    ?? bundle.receipt
    ?? bundle.handoff_audit_receipt
    ?? bundle.foreshadowing_settlement_operator_handoff_audit_receipt;
  return single ? [object(single)] : [];
}

function normalizeForbiddenActions(receipts) {
  const source = receipts.flatMap((receipt) => array(receipt.forbidden_actions))
    .map((item) => text(item, 160))
    .filter(Boolean);
  const required = [
    "approve_from_chatgpt_bridge",
    "confirm_adoption_from_chatgpt_bridge",
    "activate_engine_from_chatgpt_bridge",
    "modify_active_engine",
    "modify_canon_db",
    "persist_candidate_settlement_without_human_review",
    "ledger_side_approval",
    "ledger_side_confirm_adoption",
    "ledger_side_active_engine_activation",
  ];
  return Array.from(new Set([...source, ...required]));
}

function actionFor(receipt, status, decision) {
  if (decision === "blocked_handoff_recorded" || status === "blocked_review") {
    return {
      key: "return_to_approval_queue_guard_review",
      label: "Return to Approval Queue guard review",
      route: "#approval",
      enabled: true,
      allowed: true,
      forbidden: [
        "approve_from_chatgpt_bridge",
        "confirm_adoption_from_chatgpt_bridge",
        "activate_engine_from_chatgpt_bridge",
        "canonize_blocked_settlement_items",
      ],
    };
  }
  if (decision === "ready_for_human_operator_review" || receipt.review_ready === true) {
    return {
      key: "human_operator_review_candidate_settlement_preview",
      label: "Human operator reviews candidate settlement preview",
      route: "#settlement",
      enabled: true,
      allowed: true,
      forbidden: [
        "automatic_canon_intake",
        "automatic_active_engine_update",
        "bridge_side_approval",
        "ledger_side_approval",
      ],
    };
  }
  return {
    key: "inspect_handoff_audit_receipt_source",
    label: "Inspect handoff audit receipt source before operator decision",
    route: "#settlement",
    enabled: false,
    allowed: false,
    forbidden: [
      "automatic_canon_intake",
      "automatic_active_engine_update",
      "bridge_side_approval",
      "ledger_side_approval",
    ],
  };
}

function ledgerStatusFor(receipt, status, decision) {
  if (decision === "blocked_handoff_recorded" || status === "blocked_review" || receipt.blocked === true) {
    return "blocked";
  }
  if (decision === "ready_for_human_operator_review" || receipt.review_ready === true) {
    return "review_ready";
  }
  if (receipt.used !== true || decision === "source_not_available") return "source_not_available";
  return "recorded";
}

function entryFor(receiptInput, index) {
  const receipt = object(receiptInput);
  const sourcePacket = object(receipt.source_packet);
  const checklist = object(receipt.checklist_summary);
  const integrity = object(receipt.integrity);
  const safety = normalizeSafety(receipt.safety);
  const decision = text(receipt.decision, 160) || "not_available";
  const status = text(sourcePacket.status, 160) || "not_available";
  const action = actionFor(receipt, status, decision);
  const ledgerStatus = ledgerStatusFor(receipt, status, decision);
  const receiptId = text(receipt.receipt_id, 220) || "missing_receipt_" + String(index + 1);
  const entrySeed = {
    version: foreshadowingSettlementOperatorDecisionLedgerVersion,
    receipt_id: receiptId,
    source_packet_id: sourcePacket.review_packet_id ?? null,
    status,
    decision,
    ledger_status: ledgerStatus,
    packet_hash: integrity.packet_hash ?? null,
    checklist_hash: integrity.checklist_hash ?? null,
    safety_hash: integrity.safety_hash ?? null,
  };
  return {
    entry_id: "foreshadowing_settlement_operator_decision_entry_" + sha256(stableJson(entrySeed)).slice(0, 16),
    source_receipt_id: receiptId,
    source_receipt_kind: text(receipt.receipt_kind, 160) || null,
    source_phase: text(receipt.phase, 40) || null,
    source_version: text(receipt.version, 180) || null,
    source_packet: {
      review_packet_id: text(sourcePacket.review_packet_id, 220) || null,
      status,
      decision: text(sourcePacket.decision, 160) || "not_available",
      settlement_context_id: text(sourcePacket.settlement_context_id, 220) || null,
      approval_item_id: text(sourcePacket.approval_item_id, 220) || null,
      counts: object(sourcePacket.counts),
    },
    decision,
    ledger_status: ledgerStatus,
    blocked: ledgerStatus === "blocked",
    review_ready: ledgerStatus === "review_ready",
    checklist_required: Number.isInteger(checklist.required) ? checklist.required : 0,
    checklist_required_failed: Number.isInteger(checklist.required_failed) ? checklist.required_failed : 0,
    failed_checklist_keys: array(checklist.failed_keys).map((item) => text(item, 160)).filter(Boolean),
    integrity: {
      receipt_hash: sha256(stableJson(receipt)),
      packet_hash: text(integrity.packet_hash, 80) || null,
      checklist_hash: text(integrity.checklist_hash, 80) || null,
      safety_hash: text(integrity.safety_hash, 80) || null,
      forbidden_actions_hash: text(integrity.forbidden_actions_hash, 80) || null,
    },
    next_operator_action: action,
    requires_human_operator_decision: true,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_modify_canon: false,
    can_modify_active_engine: false,
    safety,
    warnings: array(receipt.warnings).map((warning) => text(warning, 240)).filter(Boolean),
  };
}

function appendIndex(index, key, value, entryId) {
  const safeKey = text(value, 220) || "not_available";
  if (!index[key][safeKey]) index[key][safeKey] = [];
  index[key][safeKey].push(entryId);
}

function buildIndex(entries) {
  const index = {
    by_decision: {},
    by_ledger_status: {},
    by_packet_status: {},
    by_settlement_context_id: {},
    by_approval_item_id: {},
  };
  for (const entry of entries) {
    appendIndex(index, "by_decision", entry.decision, entry.entry_id);
    appendIndex(index, "by_ledger_status", entry.ledger_status, entry.entry_id);
    appendIndex(index, "by_packet_status", entry.source_packet.status, entry.entry_id);
    if (entry.source_packet.settlement_context_id) {
      appendIndex(index, "by_settlement_context_id", entry.source_packet.settlement_context_id, entry.entry_id);
    }
    if (entry.source_packet.approval_item_id) {
      appendIndex(index, "by_approval_item_id", entry.source_packet.approval_item_id, entry.entry_id);
    }
  }
  return index;
}

function summaryFor(entries) {
  const count = (predicate) => entries.filter(predicate).length;
  return {
    total: entries.length,
    blocked: count((entry) => entry.ledger_status === "blocked"),
    review_ready: count((entry) => entry.ledger_status === "review_ready"),
    recorded: count((entry) => entry.ledger_status === "recorded"),
    source_not_available: count((entry) => entry.ledger_status === "source_not_available"),
    required_failed: entries.reduce((sum, entry) => sum + entry.checklist_required_failed, 0),
    requires_human_operator_decision: entries.filter((entry) => entry.requires_human_operator_decision === true).length,
  };
}

function markdownFor(ledger) {
  const entryLines = ledger.entries.length
    ? ledger.entries.map((entry) => [
      "- entry_id=" + entry.entry_id,
      "  receipt_id=" + entry.source_receipt_id,
      "  decision=" + entry.decision,
      "  ledger_status=" + entry.ledger_status,
      "  packet_status=" + entry.source_packet.status,
      "  settlement_context_id=" + (entry.source_packet.settlement_context_id ?? "none"),
      "  approval_item_id=" + (entry.source_packet.approval_item_id ?? "none"),
      "  next_operator_action=" + entry.next_operator_action.key,
    ].join("\n"))
    : ["- none"];
  return [
    "## Foreshadowing Settlement Operator Decision Ledger",
    "",
    "- phase: " + ledger.phase,
    "- version: " + ledger.version,
    "- ledger_id: " + ledger.ledger_id,
    "- entries: " + String(ledger.summary.total),
    "- blocked: " + String(ledger.summary.blocked),
    "- review_ready: " + String(ledger.summary.review_ready),
    "- source_not_available: " + String(ledger.summary.source_not_available),
    "- read_only: " + String(ledger.safety.read_only),
    "- no_canon_update: " + String(ledger.safety.no_canon_update),
    "- no_active_engine_update: " + String(ledger.safety.no_active_engine_update),
    "- ledger_can_approve: " + String(ledger.safety.ledger_can_approve),
    "- ledger_can_confirm_adoption: " + String(ledger.safety.ledger_can_confirm_adoption),
    "- ledger_can_activate_engine: " + String(ledger.safety.ledger_can_activate_engine),
    "",
    "### Ledger Entries",
    ...entryLines,
    "",
    "### Forbidden Actions",
    ...ledger.forbidden_actions.map((item) => "- " + item),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorDecisionLedger(input = {}) {
  const bundle = object(input);
  const receipts = normalizeReceipts(bundle);
  const entries = receipts.map(entryFor);
  const forbiddenActions = normalizeForbiddenActions(receipts);
  const safety = normalizeSafety(bundle.safety);
  const summary = summaryFor(entries);
  const index = buildIndex(entries);
  const ledgerSeed = {
    version: foreshadowingSettlementOperatorDecisionLedgerVersion,
    entry_ids: entries.map((entry) => entry.entry_id),
    summary,
    index,
    safety_projection: {
      no_canon_update: safety.no_canon_update,
      no_active_engine_update: safety.no_active_engine_update,
      ledger_can_approve: safety.ledger_can_approve,
      ledger_can_confirm_adoption: safety.ledger_can_confirm_adoption,
      ledger_can_activate_engine: safety.ledger_can_activate_engine,
    },
  };
  const ledger = {
    used: entries.length > 0,
    phase: "27N",
    version: foreshadowingSettlementOperatorDecisionLedgerVersion,
    ledger_kind: "foreshadowing_settlement_operator_decision_ledger",
    ledger_id: "foreshadowing_settlement_operator_decision_ledger_" + sha256(stableJson(ledgerSeed)).slice(0, 16),
    entries,
    summary,
    index,
    integrity: {
      receipts_hash: sha256(stableJson(receipts)),
      entries_hash: sha256(stableJson(entries)),
      index_hash: sha256(stableJson(index)),
      safety_hash: sha256(stableJson(safety)),
      forbidden_actions_hash: sha256(stableJson(forbiddenActions)),
    },
    forbidden_actions: forbiddenActions,
    safety,
    warnings: [
      ...entries.flatMap((entry) => entry.warnings),
      ...(entries.length ? [] : ["foreshadowing_settlement_operator_decision_ledger_no_receipts"]),
      ...(summary.required_failed > 0 ? ["foreshadowing_settlement_operator_decision_ledger_required_check_failed"] : []),
      ...(summary.blocked > 0 ? ["foreshadowing_settlement_operator_decision_ledger_contains_blocked_entries"] : []),
    ],
  };
  ledger.ledger_markdown = markdownFor(ledger);
  return ledger;
}

export default buildForeshadowingSettlementOperatorDecisionLedger;
