import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementOperatorReviewPanel } from "../../server/src/foreshadowing-settlement-operator-review-panel-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanelUi } from "../../server/src/foreshadowing-settlement-operator-review-panel-ui-service.mjs";
import { buildForeshadowingSettlementSurface } from "../../server/src/foreshadowing-settlement-surface-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260622-000000-27k00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260622-000000-27k00001",
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
  approval_item_id: "approval_phase27k_guard_blocked",
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

assert.equal(ui.used, true);
assert.equal(ui.phase, "27K");
assert.equal(ui.version, "foreshadowing_settlement_operator_review_panel_ui_v1");
assert.equal(ui.source_phase, "27J");
assert.equal(ui.status, "blocked_review");
assert.equal(ui.decision, "blocked");
assert.equal(ui.status_badge.tone, "blocked");
assert.match(ui.headline, /Foreshadowing settlement/u);
assert.match(ui.summary, /guard_blocked_P0/u);
assert.equal(ui.counts.paid, 1);
assert.equal(ui.counts.kept_open, 1);
assert.equal(ui.counts.allowed_candidate_items, 1);
assert.equal(ui.cards.find((card) => card.key === "blocked_reasons")?.value, "1");
assert.equal(ui.cards.find((card) => card.key === "paid_foreshadowing_debts")?.value, "1");
assert.equal(ui.sections.some((section) => section.key === "chatgpt_bridge_safety"), true);
assert.equal(ui.next_operator_action.key, "review_blocked_guard");
assert.equal(ui.next_operator_action.ui_target, "approval");
assert.equal(ui.safety.read_only, true);
assert.equal(ui.safety.preview_only, true);
assert.equal(ui.safety.candidate_only, true);
assert.equal(ui.safety.no_canon_update, true);
assert.equal(ui.safety.no_active_engine_update, true);
assert.equal(ui.safety.pending_engine_candidate_created, false);
assert.equal(ui.safety.active_engine_modified, false);
assert.equal(ui.safety.bridge_can_approve, false);
assert.equal(ui.safety.bridge_can_confirm_adoption, false);
assert.equal(ui.safety.bridge_can_activate_engine, false);

const safetyBadges = new Map(ui.safety_badges.map((badge) => [badge.key, badge]));
assert.equal(safetyBadges.get("read_only")?.value, true);
assert.equal(safetyBadges.get("bridge_can_approve")?.denied, true);
assert.equal(safetyBadges.get("bridge_can_activate_engine")?.denied, true);

const missingUi = buildForeshadowingSettlementOperatorReviewPanelUi(
  buildForeshadowingSettlementOperatorReviewPanel({}),
);
assert.equal(missingUi.used, false);
assert.equal(missingUi.status, "not_available");
assert.equal(missingUi.next_operator_action.ui_target, "settlement");
assert.equal(missingUi.safety.no_active_engine_update, true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27K foreshadowing settlement operator review panel UI tests passed.");
