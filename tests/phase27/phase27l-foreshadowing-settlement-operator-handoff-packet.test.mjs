import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementSurface } from "../../server/src/foreshadowing-settlement-surface-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanel } from "../../server/src/foreshadowing-settlement-operator-review-panel-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanelUi } from "../../server/src/foreshadowing-settlement-operator-review-panel-ui-service.mjs";
import { buildForeshadowingSettlementOperatorHandoffPacket } from "../../server/src/foreshadowing-settlement-operator-handoff-packet-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260622-000000-27l00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260622-000000-27l00001",
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
  approval_item_id: "approval_phase27l_guard_blocked",
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

assert.equal(packet.used, true);
assert.equal(packet.phase, "27L");
assert.equal(packet.version, "foreshadowing_settlement_operator_handoff_packet_v1");
assert.equal(packet.packet_kind, "foreshadowing_settlement_operator_handoff_packet");
assert.equal(packet.source_phase, "27K");
assert.equal(packet.status, "blocked_review");
assert.equal(packet.decision, "blocked");
assert.equal(packet.settlement_context_id, "settlement_ctx_20260622-000000-27l00001");
assert.equal(packet.approval_item_id, "approval_phase27l_guard_blocked");
assert.equal(packet.counts.paid, 1);
assert.equal(packet.counts.kept_open, 1);
assert.equal(packet.counts.allowed_candidate_items, 1);
assert.equal(packet.blocked_reasons.some((item) => item.reason === "guard_blocked_P0"), true);
assert.equal(packet.blocked_path.active, true);
assert.equal(packet.blocked_path.allowed, true);
assert.equal(packet.review_ready_path.active, false);
assert.equal(packet.operator_intake_checklist.some((item) => item.key === "resolve_blocked_guard"), true);
assert.equal(packet.operator_intake_checklist.every((item) => item.required !== true || item.passed === true), true);
assert.equal(packet.required_check_failures.length, 0);
assert.equal(packet.evidence_cards.some((card) => card.key === "paid_foreshadowing_debts"), true);
assert.equal(packet.evidence_sections.some((section) => section.key === "chatgpt_bridge_safety"), true);
assert.equal(packet.forbidden_actions.includes("approve_from_chatgpt_bridge"), true);
assert.equal(packet.forbidden_actions.includes("modify_active_engine"), true);
assert.equal(packet.safety.read_only, true);
assert.equal(packet.safety.preview_only, true);
assert.equal(packet.safety.candidate_only, true);
assert.equal(packet.safety.no_canon_update, true);
assert.equal(packet.safety.no_active_engine_update, true);
assert.equal(packet.safety.pending_engine_candidate_created, false);
assert.equal(packet.safety.active_engine_modified, false);
assert.equal(packet.safety.bridge_can_approve, false);
assert.equal(packet.safety.bridge_can_confirm_adoption, false);
assert.equal(packet.safety.bridge_can_activate_engine, false);
assert.equal(packet.safety.packet_can_approve, false);
assert.equal(packet.safety.packet_can_confirm_adoption, false);
assert.equal(packet.safety.packet_can_activate_engine, false);
assert.match(packet.review_packet_id, /^foreshadowing_settlement_operator_handoff_[a-f0-9]{16}$/u);
assert.match(packet.packet_markdown, /Foreshadowing Settlement Operator Handoff Packet/u);
assert.match(packet.packet_markdown, /guard_blocked_P0/u);

const reviewReadyPacket = buildForeshadowingSettlementOperatorHandoffPacket({
  operator_panel_ui: {
    used: true,
    phase: "27K",
    version: "foreshadowing_settlement_operator_review_panel_ui_v1",
    status: "review_ready",
    decision: "operator_review_ready",
    settlement_context_id: "settlement_ctx_ready_27l",
    approval_item_id: "approval_ready_27l",
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
assert.equal(reviewReadyPacket.status, "review_ready");
assert.equal(reviewReadyPacket.blocked_path.active, false);
assert.equal(reviewReadyPacket.review_ready_path.active, true);
assert.equal(reviewReadyPacket.operator_intake_checklist.some((item) => item.key === "human_review_before_canon_intake"), true);
assert.equal(reviewReadyPacket.safety.no_active_engine_update, true);

const missingPacket = buildForeshadowingSettlementOperatorHandoffPacket({});
assert.equal(missingPacket.used, false);
assert.equal(missingPacket.status, "not_available");
assert.equal(missingPacket.safety.no_canon_update, true);
assert.equal(missingPacket.safety.no_active_engine_update, true);
assert.equal(missingPacket.safety.bridge_can_approve, false);
assert.equal(missingPacket.warnings.includes("foreshadowing_settlement_operator_handoff_source_not_available"), true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27L foreshadowing settlement operator handoff packet tests passed.");
