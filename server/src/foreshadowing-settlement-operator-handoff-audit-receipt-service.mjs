import { createHash } from "node:crypto";

export const foreshadowingSettlementOperatorHandoffAuditReceiptVersion =
  "foreshadowing_settlement_operator_handoff_audit_receipt_v1";

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

function checklistSummary(items) {
  const normalized = array(items).map((item) => object(item));
  const required = normalized.filter((item) => item.required === true);
  const passedRequired = required.filter((item) => item.passed === true);
  return {
    total: normalized.length,
    required: required.length,
    required_passed: passedRequired.length,
    required_failed: required.length - passedRequired.length,
    failed_keys: required
      .filter((item) => item.passed !== true)
      .map((item) => text(item.key, 120))
      .filter(Boolean),
  };
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
    packet_can_approve: false,
    packet_can_confirm_adoption: false,
    packet_can_activate_engine: false,
    packet_can_modify_canon: false,
    packet_can_modify_active_engine: false,
    receipt_can_approve: false,
    receipt_can_confirm_adoption: false,
    receipt_can_activate_engine: false,
    receipt_can_modify_canon: false,
    receipt_can_modify_active_engine: false,
    requires_explicit_human_operator_decision: true,
  };
}

function normalizeForbiddenActions(packet) {
  const source = array(packet.forbidden_actions)
    .map((item) => text(item, 160))
    .filter(Boolean);
  const required = [
    "approve_from_chatgpt_bridge",
    "confirm_adoption_from_chatgpt_bridge",
    "activate_engine_from_chatgpt_bridge",
    "modify_active_engine",
    "modify_canon_db",
    "persist_candidate_settlement_without_human_review",
  ];
  return Array.from(new Set([...source, ...required]));
}

function deriveDecision(packet, checklist, safety) {
  if (checklist.required_failed > 0) return "blocked_required_check_failed";
  if (packet.status === "blocked_review") return "blocked_handoff_recorded";
  if (packet.status === "review_ready") return "ready_for_human_operator_review";
  if (packet.used !== true) return "source_not_available";
  if (safety.no_canon_update !== true || safety.no_active_engine_update !== true) return "blocked_safety_violation";
  return "recorded";
}

function auditLinesFor(receipt) {
  return [
    "Foreshadowing Settlement Operator Handoff Audit Receipt",
    "phase=" + receipt.phase,
    "version=" + receipt.version,
    "receipt_id=" + receipt.receipt_id,
    "decision=" + receipt.decision,
    "packet_id=" + (receipt.source_packet.review_packet_id ?? "none"),
    "packet_status=" + receipt.source_packet.status,
    "packet_decision=" + receipt.source_packet.decision,
    "checklist_required=" + String(receipt.checklist_summary.required),
    "checklist_required_failed=" + String(receipt.checklist_summary.required_failed),
    "packet_hash=" + receipt.integrity.packet_hash,
    "checklist_hash=" + receipt.integrity.checklist_hash,
    "safety_hash=" + receipt.integrity.safety_hash,
    "no_canon_update=" + String(receipt.safety.no_canon_update),
    "no_active_engine_update=" + String(receipt.safety.no_active_engine_update),
    "bridge_can_approve=" + String(receipt.safety.bridge_can_approve),
    "bridge_can_confirm_adoption=" + String(receipt.safety.bridge_can_confirm_adoption),
    "bridge_can_activate_engine=" + String(receipt.safety.bridge_can_activate_engine),
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorHandoffAuditReceipt(input = {}) {
  const bundle = object(input);
  const packet = object(
    bundle.handoff_packet
      ?? bundle.operator_handoff_packet
      ?? bundle.packet
      ?? bundle.foreshadowing_settlement_operator_handoff_packet,
  );
  const checklist = checklistSummary(packet.operator_intake_checklist);
  const safety = normalizeSafety(packet.safety);
  const forbiddenActions = normalizeForbiddenActions(packet);
  const sourcePacket = {
    phase: text(packet.phase, 40) || null,
    version: text(packet.version, 160) || null,
    review_packet_id: text(packet.review_packet_id, 200) || null,
    packet_kind: text(packet.packet_kind, 160) || null,
    source_phase: text(packet.source_phase, 40) || null,
    source_version: text(packet.source_version, 160) || null,
    status: text(packet.status, 120) || "not_available",
    decision: text(packet.decision, 120) || "not_available",
    settlement_context_id: text(packet.settlement_context_id, 200) || null,
    approval_item_id: text(packet.approval_item_id, 200) || null,
    counts: object(packet.counts),
    blocked_reasons: array(packet.blocked_reasons),
    warnings: array(packet.warnings).map((warning) => text(warning, 240)).filter(Boolean),
  };
  const integrity = {
    packet_hash: sha256(stableJson(packet)),
    checklist_hash: sha256(stableJson(packet.operator_intake_checklist ?? [])),
    safety_hash: sha256(stableJson(safety)),
    forbidden_actions_hash: sha256(stableJson(forbiddenActions)),
  };
  const decision = deriveDecision(packet, checklist, safety);
  const receiptSeed = {
    version: foreshadowingSettlementOperatorHandoffAuditReceiptVersion,
    source_packet_id: sourcePacket.review_packet_id,
    source_status: sourcePacket.status,
    source_decision: sourcePacket.decision,
    checklist,
    integrity,
    safety_projection: {
      no_canon_update: safety.no_canon_update,
      no_active_engine_update: safety.no_active_engine_update,
      bridge_can_approve: safety.bridge_can_approve,
      bridge_can_confirm_adoption: safety.bridge_can_confirm_adoption,
      bridge_can_activate_engine: safety.bridge_can_activate_engine,
    },
  };

  const receipt = {
    used: packet.used === true,
    phase: "27M",
    version: foreshadowingSettlementOperatorHandoffAuditReceiptVersion,
    receipt_kind: "foreshadowing_settlement_operator_handoff_audit_receipt",
    receipt_id: "foreshadowing_settlement_operator_handoff_audit_" + sha256(stableJson(receiptSeed)).slice(0, 16),
    source_packet: sourcePacket,
    checklist_summary: checklist,
    integrity,
    decision,
    blocked: decision.startsWith("blocked") || sourcePacket.status === "blocked_review",
    review_ready: sourcePacket.status === "review_ready" && checklist.required_failed === 0,
    forbidden_actions: forbiddenActions,
    safety,
    warnings: [
      ...sourcePacket.warnings,
      ...(packet.used === true ? [] : ["handoff_audit_receipt_source_packet_not_available"]),
      ...(sourcePacket.status === "blocked_review" ? ["handoff_audit_receipt_records_blocked_review"] : []),
      ...(checklist.required_failed > 0 ? ["handoff_audit_receipt_required_check_failed"] : []),
    ],
  };
  receipt.audit_lines = auditLinesFor(receipt);
  return receipt;
}

export default buildForeshadowingSettlementOperatorHandoffAuditReceipt;
