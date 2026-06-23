import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildForeshadowingSettlementOperatorReadinessDashboard,
  foreshadowingSettlementOperatorReadinessDashboardVersion,
} from "../../server/src/foreshadowing-settlement-operator-readiness-dashboard-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260623-000000-27r00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260623-000000-27r00001",
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
  approval_item_id: "approval_phase27r_guard_blocked",
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
const dashboard = buildForeshadowingSettlementOperatorReadinessDashboard({
  context: fixtureContext,
  readiness,
  max_rows: 50,
  include_raw: false,
  include_markdown: true,
});

assert.equal(dashboard.ok, true);
assert.equal(dashboard.used, true);
assert.equal(dashboard.phase, "27R");
assert.equal(dashboard.version, foreshadowingSettlementOperatorReadinessDashboardVersion);
assert.equal(dashboard.dashboard_kind, "foreshadowing_settlement_operator_readiness_dashboard");
assert.equal(dashboard.source_phase, "27Q");
assert.deepEqual(dashboard.source_phases, ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q"]);
assert.equal(dashboard.smoke_phase, "27Q");
assert.equal(dashboard.dashboard_status, "ready");
assert.equal(dashboard.status_badge.label, "ready");
assert.equal(dashboard.settlement_context_id, "settlement_ctx_20260623-000000-27r00001");
assert.equal(dashboard.approval_item_id, "approval_phase27r_guard_blocked");

const cardMap = new Map(dashboard.cards.map((card) => [card.key, card]));
assert.equal(cardMap.get("full_bridge_smoke")?.value, "passed");
assert.equal(cardMap.get("phase_lineage")?.value, "passed");
assert.equal(cardMap.get("handoff_continuity")?.value, "connected");
assert.equal(cardMap.get("chatgpt_surface")?.value, "readable");
assert.equal(cardMap.get("safety_boundary")?.value, "locked");

assert.equal(dashboard.stage_cards.length, 8);
assert.equal(dashboard.stage_cards.every((stage) => stage.passed === true), true);
assert.equal(dashboard.stage_cards.at(-1)?.phase, "27P");
assert.equal(dashboard.handoff_cards.length, 6);
assert.equal(dashboard.handoff_cards.every((item) => item.passed === true), true);
assert.equal(dashboard.chatgpt_surface_cards.length >= 5, true);
assert.equal(dashboard.chatgpt_surface_cards.some((item) => item.key === "tool_name"), true);
assert.equal(dashboard.next_operator_actions.length >= 2, true);
assert.equal(dashboard.next_operator_actions[0].ui_target, "writer-workbench");

assert.equal(dashboard.safety.read_only, true);
assert.equal(dashboard.safety.preview_only, true);
assert.equal(dashboard.safety.no_auto_persist, true);
assert.equal(dashboard.safety.no_canon_update, true);
assert.equal(dashboard.safety.no_active_engine_update, true);
assert.equal(dashboard.safety.bridge_can_approve, false);
assert.equal(dashboard.safety.bridge_can_confirm_adoption, false);
assert.equal(dashboard.safety.bridge_can_activate_engine, false);
assert.equal(dashboard.safety.pending_engine_candidate_created, false);
assert.equal(dashboard.safety.active_engine_modified, false);
assert.equal(dashboard.safety.canon_modified, false);
assert.equal(dashboard.safety.compressed_rules_modified, false);
assert.equal(dashboard.safety.ui_can_approve, false);
assert.equal(dashboard.safety.ui_can_confirm_adoption, false);
assert.equal(dashboard.safety.ui_can_activate_engine, false);

assert.equal(dashboard.integrity.smoke_ok, true);
assert.equal(dashboard.integrity.phase_lineage_passed, true);
assert.equal(dashboard.integrity.handoff_passed, true);
assert.equal(dashboard.integrity.safety_passed, true);
assert.equal(dashboard.integrity.chatgpt_surface_passed, true);
assert.match(dashboard.integrity.decision_ledger_entries_hash, /^[a-f0-9]{64}$/u);
assert.equal(dashboard.integrity.bridge_integrity_available, true);
assert.equal(dashboard.raw_smoke, null);
assert.match(dashboard.surface_markdown, /Foreshadowing Settlement Operator Readiness Dashboard/u);
assert.match(dashboard.surface_markdown, /bridge_can_activate_engine: false/u);

const rawDashboard = buildForeshadowingSettlementOperatorReadinessDashboard({
  context: fixtureContext,
  readiness,
  include_raw: true,
  include_markdown: false,
});
assert.equal(rawDashboard.ok, true);
assert.equal(rawDashboard.raw_smoke.phase, "27Q");
assert.equal(rawDashboard.surface_markdown, "");

const blockedDashboard = buildForeshadowingSettlementOperatorReadinessDashboard({});
assert.equal(blockedDashboard.ok, false);
assert.equal(blockedDashboard.phase, "27R");
assert.equal(blockedDashboard.dashboard_status, "blocked");
assert.equal(blockedDashboard.safety.no_canon_update, true);
assert.equal(blockedDashboard.safety.no_active_engine_update, true);
assert.equal(blockedDashboard.safety.bridge_can_approve, false);
assert.equal(blockedDashboard.warnings.includes("foreshadowing_settlement_operator_readiness_dashboard_smoke_failed"), true);
assert.equal(blockedDashboard.next_operator_actions[0].key, "repair_operator_chain");

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27R foreshadowing settlement operator readiness dashboard tests passed.");
