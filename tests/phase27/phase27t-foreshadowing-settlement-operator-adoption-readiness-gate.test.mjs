import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildForeshadowingSettlementOperatorAdoptionReadinessGate,
  foreshadowingSettlementOperatorAdoptionReadinessGateVersion,
} from "../../server/src/foreshadowing-settlement-operator-adoption-readiness-gate-service.mjs";
import {
  buildForeshadowingSettlementOperatorReadinessDashboard,
} from "../../server/src/foreshadowing-settlement-operator-readiness-dashboard-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260623-000000-27t00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260623-000000-27t00001",
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
  approval_item_id: "approval_phase27t_guard_blocked",
  blocking_reasons: ["guard_blocked_P0"],
  safety: {
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
  },
};

const liveUiSmoke = {
  ok: true,
  used: true,
  phase: "27S",
  status: "passed",
  server_started: true,
  html_readable: true,
  app_js_readable: true,
  endpoint_readable: true,
  dashboard_payload_readable: true,
  dashboard_block_present: true,
  safety_passed: true,
  side_effects_absent: true,
  no_canon_update: true,
  no_active_engine_update: true,
  pending_engine_candidate_created: false,
  active_engine_modified: false,
  canon_modified: false,
  compressed_rules_modified: false,
};

const activeBefore = await readFile(projectPaths.activeEngine);
const dashboard = buildForeshadowingSettlementOperatorReadinessDashboard({
  context: fixtureContext,
  readiness,
  max_rows: 50,
  include_raw: false,
  include_markdown: true,
});

const readyGate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  dashboard,
  live_ui_smoke: liveUiSmoke,
  include_raw: false,
  include_markdown: true,
});

assert.equal(readyGate.ok, true);
assert.equal(readyGate.used, true);
assert.equal(readyGate.phase, "27T");
assert.equal(readyGate.version, foreshadowingSettlementOperatorAdoptionReadinessGateVersion);
assert.equal(readyGate.gate_kind, "foreshadowing_settlement_operator_adoption_readiness_gate");
assert.equal(readyGate.source_phase, "27S");
assert.deepEqual(readyGate.source_phases, ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q", "27R", "27S"]);
assert.equal(readyGate.dashboard_phase, "27R");
assert.equal(readyGate.dashboard_status, "ready");
assert.equal(readyGate.live_ui_smoke_phase, "27S");
assert.equal(readyGate.live_ui_smoke_status, "passed");
assert.equal(readyGate.gate_status, "ready_for_manual_adoption_review");
assert.equal(readyGate.decision, "ready_for_manual_adoption_review");
assert.equal(readyGate.status_badge.label, "manual review ready");
assert.equal(readyGate.can_enter_manual_adoption_review, true);
assert.equal(readyGate.can_enter_adoption_review, true);
assert.equal(readyGate.can_auto_adopt, false);
assert.equal(readyGate.direct_adoption_allowed, false);
assert.equal(readyGate.automatic_settlement_allowed, false);
assert.equal(readyGate.requires_human_approval, true);
assert.equal(readyGate.requires_operator_confirmation, true);
assert.equal(readyGate.manual_review_only, true);
assert.deepEqual(readyGate.blocking_reasons, []);

assert.equal(readyGate.checks.dashboard_loaded, true);
assert.equal(readyGate.checks.dashboard_ready, true);
assert.equal(readyGate.checks.phase_lineage_passed, true);
assert.equal(readyGate.checks.handoff_passed, true);
assert.equal(readyGate.checks.chatgpt_surface_passed, true);
assert.equal(readyGate.checks.dashboard_safety_passed, true);
assert.equal(readyGate.checks.read_only_boundary_locked, true);
assert.equal(readyGate.checks.live_ui_smoke_passed, true);
assert.equal(readyGate.checks.no_mutation_side_effects, true);
assert.equal(readyGate.checks.operator_actions_available, true);

const readyCardMap = new Map(readyGate.cards.map((card) => [card.key, card]));
assert.equal(readyCardMap.get("readiness_dashboard")?.value, "ready");
assert.equal(readyCardMap.get("live_ui_smoke")?.value, "passed");
assert.equal(readyCardMap.get("manual_review")?.value, "allowed to enter");
assert.equal(readyCardMap.get("safety_boundary")?.value, "locked");
assert.equal(readyGate.next_operator_actions[0].key, "enter_manual_adoption_review");
assert.equal(readyGate.next_operator_actions[0].ui_target, "approval");

assert.equal(readyGate.safety.read_only, true);
assert.equal(readyGate.safety.preview_only, true);
assert.equal(readyGate.safety.no_auto_persist, true);
assert.equal(readyGate.safety.no_canon_update, true);
assert.equal(readyGate.safety.no_active_engine_update, true);
assert.equal(readyGate.safety.bridge_can_approve, false);
assert.equal(readyGate.safety.bridge_can_confirm_adoption, false);
assert.equal(readyGate.safety.bridge_can_activate_engine, false);
assert.equal(readyGate.safety.gate_can_approve, false);
assert.equal(readyGate.safety.gate_can_confirm_adoption, false);
assert.equal(readyGate.safety.gate_can_activate_engine, false);
assert.equal(readyGate.safety.pending_engine_candidate_created, false);
assert.equal(readyGate.safety.active_engine_modified, false);
assert.equal(readyGate.safety.canon_modified, false);
assert.equal(readyGate.safety.compressed_rules_modified, false);
assert.equal(readyGate.safety.automatic_adoption_performed, false);
assert.equal(readyGate.safety.manual_review_entry_only, true);

assert.equal(readyGate.integrity.dashboard_ok, true);
assert.equal(readyGate.integrity.live_ui_smoke_ok, true);
assert.equal(readyGate.integrity.phase_lineage_passed, true);
assert.equal(readyGate.integrity.handoff_passed, true);
assert.equal(readyGate.integrity.chatgpt_surface_passed, true);
assert.equal(readyGate.integrity.dashboard_safety_passed, true);
assert.match(readyGate.integrity.decision_ledger_entries_hash, /^[a-f0-9]{64}$/u);
assert.equal(readyGate.integrity.bridge_integrity_available, true);
assert.equal(readyGate.raw_dashboard, null);
assert.equal(readyGate.raw_live_ui_smoke, null);
assert.match(readyGate.surface_markdown, /Foreshadowing Settlement Operator Adoption Readiness Gate/u);
assert.match(readyGate.surface_markdown, /direct_adoption_allowed: false/u);

const rawGate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  dashboard,
  live_ui_smoke: liveUiSmoke,
  include_raw: true,
  include_markdown: false,
});
assert.equal(rawGate.ok, true);
assert.equal(rawGate.raw_dashboard.phase, "27R");
assert.equal(rawGate.raw_live_ui_smoke.phase, "27S");
assert.equal(rawGate.surface_markdown, "");

const missingLiveGate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  dashboard,
});
assert.equal(missingLiveGate.ok, false);
assert.equal(missingLiveGate.gate_status, "blocked");
assert.equal(missingLiveGate.can_enter_manual_adoption_review, false);
assert(missingLiveGate.blocking_reasons.includes("phase27s_live_ui_smoke_missing"));
assert(missingLiveGate.blocking_reasons.includes("mutation_side_effect_detected"));
assert(missingLiveGate.warnings.includes("foreshadowing_settlement_operator_adoption_readiness_gate_blocked"));
assert.equal(missingLiveGate.next_operator_actions[0].key, "repair_operator_adoption_readiness_gate");

const blockedDashboardGate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  live_ui_smoke: liveUiSmoke,
});
assert.equal(blockedDashboardGate.ok, false);
assert.equal(blockedDashboardGate.phase, "27T");
assert.equal(blockedDashboardGate.gate_status, "blocked");
assert(blockedDashboardGate.blocking_reasons.includes("readiness_dashboard_not_ready"));
assert.equal(blockedDashboardGate.checks.dashboard_ready, false);
assert(blockedDashboardGate.blocking_reasons.length > 0);
assert.equal(blockedDashboardGate.safety.bridge_can_approve, false);
assert.equal(blockedDashboardGate.safety.gate_can_approve, false);
assert.equal(blockedDashboardGate.safety.automatic_adoption_performed, false);

const failedLiveGate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  dashboard,
  live_ui_smoke: {
    ...liveUiSmoke,
    ok: false,
    status: "blocked",
    active_engine_modified: true,
  },
});
assert.equal(failedLiveGate.ok, false);
assert(failedLiveGate.blocking_reasons.includes("phase27s_live_ui_smoke_not_ready"));
assert(failedLiveGate.blocking_reasons.includes("mutation_side_effect_detected"));
assert.equal(failedLiveGate.can_auto_adopt, false);
assert.equal(failedLiveGate.direct_adoption_allowed, false);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27T foreshadowing settlement operator adoption readiness gate tests passed.");
