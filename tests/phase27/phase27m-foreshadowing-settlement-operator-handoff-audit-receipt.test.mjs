import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementSurface } from "../../server/src/foreshadowing-settlement-surface-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanel } from "../../server/src/foreshadowing-settlement-operator-review-panel-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanelUi } from "../../server/src/foreshadowing-settlement-operator-review-panel-ui-service.mjs";
import { buildForeshadowingSettlementOperatorHandoffPacket } from "../../server/src/foreshadowing-settlement-operator-handoff-packet-service.mjs";
import { buildForeshadowingSettlementOperatorHandoffAuditReceipt } from "../../server/src/foreshadowing-settlement-operator-handoff-audit-receipt-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260622-000000-27m00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260622-000000-27m00001",
  settlement_mode: "full",
  pending_engine_candidate_created: false,
  active_engine_modified: false,
  foreshadowing_settlement_proposal_bridge_used: true,
  foreshadowing_settlement_proposal_bridge: {
    used: true,
    phase: "27F",
    version: "foreshadowing_settlement_proposal_bridge_v1",
    preview_only: true,
    candidate_only: true,
    read_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    pending_engine_candidate_created: false,
    warnings: [],
  },
  foreshadowing_settlement_diff_preview: {
    paid_foreshadowing_debts: [
      {
        debt_id: "sealed_gate_warning",
        payoff_id: "sealed_gate_route_loss_payoff",
        payoff_types: ["action", "changed_state", "route_loss"],
        consequence: "The sealed gate cuts off the return route after the earlier warning.",
      },
    ],
    kept_open_debts: [
      {
        debt_id: "mirror_name_aftershock",
        reason: "still_open",
        promise: "A reflected name remains open for a later identity reveal.",
      },
    ],
    blocked_canon_intake_items: [],
    allowed_candidate_settlement_items: [
      {
        type: "foreshadowing_payoff_paid",
        debt_id: "sealed_gate_warning",
        payoff_id: "sealed_gate_route_loss_payoff",
      },
    ],
  },
};

const readiness = {
  ok: false,
  decision: "blocked",
  approval_item_id: "approval_phase27m_guard_blocked",
  blocking_reasons: ["guard_blocked_P0"],
  safety: {
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
  },
};

const activeBefore = await readFile(projectPaths.activeEngine);
const surface = buildForeshadowingSettlementSurface({ context: fixtureContext });
const panel = buildForeshadowingSettlementOperatorReviewPanel({ surface, readiness });
const ui = buildForeshadowingSettlementOperatorReviewPanelUi(panel);
const packet = buildForeshadowingSettlementOperatorHandoffPacket({ operator_panel_ui: ui });
const receipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({ handoff_packet: packet });

assert.equal(receipt.used, true);
assert.equal(receipt.phase, "27M");
assert.equal(receipt.version, "foreshadowing_settlement_operator_handoff_audit_receipt_v1");
assert.equal(receipt.receipt_kind, "foreshadowing_settlement_operator_handoff_audit_receipt");
assert.match(receipt.receipt_id, /^foreshadowing_settlement_operator_handoff_audit_[a-f0-9]{16}$/u);
assert.equal(receipt.source_packet.phase, "27L");
assert.equal(receipt.source_packet.source_phase, "27K");
assert.equal(receipt.source_packet.status, "blocked_review");
assert.equal(receipt.source_packet.decision, "blocked");
assert.equal(receipt.source_packet.settlement_context_id, "settlement_ctx_20260622-000000-27m00001");
assert.equal(receipt.source_packet.approval_item_id, "approval_phase27m_guard_blocked");
assert.equal(receipt.source_packet.counts.paid, 1);
assert.equal(receipt.checklist_summary.required_failed, 0);
assert.equal(receipt.checklist_summary.required, receipt.checklist_summary.required_passed);
assert.equal(receipt.decision, "blocked_handoff_recorded");
assert.equal(receipt.blocked, true);
assert.equal(receipt.review_ready, false);
assert.match(receipt.integrity.packet_hash, /^[a-f0-9]{64}$/u);
assert.match(receipt.integrity.checklist_hash, /^[a-f0-9]{64}$/u);
assert.match(receipt.integrity.safety_hash, /^[a-f0-9]{64}$/u);
assert.equal(receipt.forbidden_actions.includes("approve_from_chatgpt_bridge"), true);
assert.equal(receipt.forbidden_actions.includes("modify_active_engine"), true);
assert.equal(receipt.safety.read_only, true);
assert.equal(receipt.safety.preview_only, true);
assert.equal(receipt.safety.candidate_only, true);
assert.equal(receipt.safety.no_canon_update, true);
assert.equal(receipt.safety.no_active_engine_update, true);
assert.equal(receipt.safety.pending_engine_candidate_created, false);
assert.equal(receipt.safety.active_engine_modified, false);
assert.equal(receipt.safety.bridge_can_approve, false);
assert.equal(receipt.safety.bridge_can_confirm_adoption, false);
assert.equal(receipt.safety.bridge_can_activate_engine, false);
assert.equal(receipt.safety.receipt_can_approve, false);
assert.equal(receipt.safety.receipt_can_confirm_adoption, false);
assert.equal(receipt.safety.receipt_can_activate_engine, false);
assert.match(receipt.audit_lines, /Foreshadowing Settlement Operator Handoff Audit Receipt/u);
assert.match(receipt.audit_lines, /no_active_engine_update=true/u);
assert.equal(receipt.warnings.includes("handoff_audit_receipt_records_blocked_review"), true);

const repeat = buildForeshadowingSettlementOperatorHandoffAuditReceipt({ handoff_packet: packet });
assert.equal(repeat.receipt_id, receipt.receipt_id);
assert.equal(repeat.integrity.packet_hash, receipt.integrity.packet_hash);

const reviewReadyPacket = buildForeshadowingSettlementOperatorHandoffPacket({
  operator_panel_ui: {
    used: true,
    phase: "27K",
    version: "foreshadowing_settlement_operator_review_panel_ui_v1",
    status: "review_ready",
    decision: "operator_review_ready",
    settlement_context_id: "settlement_ctx_ready_27m",
    approval_item_id: "approval_ready_27m",
    counts: {
      paid: 1,
      kept_open: 0,
      blocked: 0,
      allowed_candidate_items: 1,
    },
    cards: [],
    sections: [],
    safety: {
      read_only: true,
      preview_only: true,
      candidate_only: true,
      no_canon_update: true,
      no_active_engine_update: true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
    },
  },
});
const readyReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({
  handoff_packet: reviewReadyPacket,
});
assert.equal(readyReceipt.decision, "ready_for_human_operator_review");
assert.equal(readyReceipt.blocked, false);
assert.equal(readyReceipt.review_ready, true);
assert.equal(readyReceipt.safety.no_active_engine_update, true);

const missingReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({});
assert.equal(missingReceipt.used, false);
assert.equal(missingReceipt.decision, "source_not_available");
assert.equal(missingReceipt.safety.no_canon_update, true);
assert.equal(missingReceipt.safety.no_active_engine_update, true);
assert.equal(missingReceipt.safety.bridge_can_approve, false);
assert.equal(missingReceipt.warnings.includes("handoff_audit_receipt_source_packet_not_available"), true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27M foreshadowing settlement operator handoff audit receipt tests passed.");
