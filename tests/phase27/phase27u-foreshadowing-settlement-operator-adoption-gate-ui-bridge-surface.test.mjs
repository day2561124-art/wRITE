import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildForeshadowingSettlementOperatorAdoptionGateSurface,
  foreshadowingSettlementOperatorAdoptionGateSurfaceVersion,
} from "../../server/src/foreshadowing-settlement-operator-adoption-gate-surface-service.mjs";
import {
  buildForeshadowingSettlementOperatorAdoptionReadinessGate,
} from "../../server/src/foreshadowing-settlement-operator-adoption-readiness-gate-service.mjs";
import {
  buildForeshadowingSettlementOperatorReadinessDashboard,
} from "../../server/src/foreshadowing-settlement-operator-readiness-dashboard-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260623-000000-27u00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260623-000000-27u00001",
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
  approval_item_id: "approval_phase27u_guard_blocked",
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

const gate = buildForeshadowingSettlementOperatorAdoptionReadinessGate({
  dashboard,
  live_ui_smoke: liveUiSmoke,
  include_raw: false,
  include_markdown: true,
});

const surface = buildForeshadowingSettlementOperatorAdoptionGateSurface({
  adoption_gate: gate,
  include_raw: false,
  include_markdown: true,
});

assert.equal(surface.ok, true);
assert.equal(surface.used, true);
assert.equal(surface.phase, "27U");
assert.equal(surface.version, foreshadowingSettlementOperatorAdoptionGateSurfaceVersion);
assert.equal(surface.surface_kind, "foreshadowing_settlement_operator_adoption_gate_ui_bridge_surface");
assert.equal(surface.source_phase, "27T");
assert.deepEqual(surface.source_phases, ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q", "27R", "27S", "27T"]);
assert.equal(surface.gate_phase, "27T");
assert.equal(surface.gate_status, "ready_for_manual_adoption_review");
assert.equal(surface.gate_decision, "ready_for_manual_adoption_review");
assert.equal(surface.bridge_surface_status, "ready_for_manual_review_entry");
assert.equal(surface.decision, "ready_for_manual_review_entry");
assert.equal(surface.status_badge.label, "manual review entry ready");
assert.equal(surface.can_enter_manual_adoption_review, true);
assert.equal(surface.can_enter_adoption_review, true);
assert.equal(surface.can_auto_adopt, false);
assert.equal(surface.direct_adoption_allowed, false);
assert.equal(surface.automatic_settlement_allowed, false);
assert.equal(surface.requires_human_approval, true);
assert.equal(surface.requires_operator_confirmation, true);
assert.equal(surface.manual_review_only, true);
assert.deepEqual(surface.blocking_reasons, []);

assert.equal(surface.checks.gate_loaded, true);
assert.equal(surface.checks.gate_ready, true);
assert.equal(surface.checks.decision_readable, true);
assert.equal(surface.checks.blocking_reasons_readable, true);
assert.equal(surface.checks.next_operator_actions_readable, true);
assert.equal(surface.checks.safety_badges_readable, true);
assert.equal(surface.checks.no_direct_adoption, true);
assert.equal(surface.checks.no_automatic_settlement, true);
assert.equal(surface.checks.no_mutation_side_effects, true);

const cardMap = new Map(surface.cards.map((card) => [card.key, card]));
assert.equal(cardMap.get("gate_decision")?.value, "ready_for_manual_adoption_review");
assert.equal(cardMap.get("manual_review_entry")?.value, "allowed");
assert.equal(cardMap.get("blocking_reasons")?.value, "0");
assert.equal(cardMap.get("safety_boundary")?.value, "locked");
assert(surface.safety_badges.length >= 8);
assert(surface.safety_badges.every((badge) => badge.tone === "ready"));

assert.equal(surface.next_operator_actions[0].key, "enter_manual_adoption_review");
assert.equal(surface.next_operator_actions[0].ui_target, "approval");
assert.equal(surface.bridge_readability.gate_result_readable, true);
assert.equal(surface.bridge_readability.decision_readable, true);
assert.equal(surface.bridge_readability.blocking_reasons_readable, true);
assert.equal(surface.bridge_readability.next_operator_actions_readable, true);
assert.equal(surface.bridge_readability.raw_gate_optional, true);
assert.equal(surface.bridge_readability.markdown_optional, true);

assert.equal(surface.safety.read_only, true);
assert.equal(surface.safety.preview_only, true);
assert.equal(surface.safety.no_auto_persist, true);
assert.equal(surface.safety.no_canon_update, true);
assert.equal(surface.safety.no_active_engine_update, true);
assert.equal(surface.safety.bridge_can_approve, false);
assert.equal(surface.safety.bridge_can_confirm_adoption, false);
assert.equal(surface.safety.bridge_can_activate_engine, false);
assert.equal(surface.safety.surface_can_approve, false);
assert.equal(surface.safety.surface_can_confirm_adoption, false);
assert.equal(surface.safety.surface_can_activate_engine, false);
assert.equal(surface.safety.ui_can_approve, false);
assert.equal(surface.safety.ui_can_confirm_adoption, false);
assert.equal(surface.safety.ui_can_activate_engine, false);
assert.equal(surface.safety.pending_engine_candidate_created, false);
assert.equal(surface.safety.active_engine_modified, false);
assert.equal(surface.safety.canon_modified, false);
assert.equal(surface.safety.compressed_rules_modified, false);
assert.equal(surface.safety.automatic_adoption_performed, false);
assert.equal(surface.safety.manual_review_entry_only, true);

assert.equal(surface.integrity.gate_ok, true);
assert.equal(surface.integrity.gate_phase, "27T");
assert.equal(surface.integrity.gate_status, "ready_for_manual_adoption_review");
assert.equal(surface.integrity.gate_safety_locked, true);
assert.equal(surface.integrity.bridge_readability_passed, true);
assert.equal(surface.integrity.no_mutation_side_effects, true);
assert.equal(surface.raw_gate, null);
assert.match(surface.surface_markdown, /Foreshadowing Settlement Operator Adoption Gate Surface/u);
assert.match(surface.surface_markdown, /direct_adoption_allowed: false/u);

const rawSurface = buildForeshadowingSettlementOperatorAdoptionGateSurface({
  adoption_gate: gate,
  include_raw: true,
  include_markdown: false,
});
assert.equal(rawSurface.ok, true);
assert.equal(rawSurface.raw_gate.phase, "27T");
assert.equal(rawSurface.surface_markdown, "");

const blockedSurface = buildForeshadowingSettlementOperatorAdoptionGateSurface({
  adoption_gate: {
    ...gate,
    ok: false,
    gate_status: "blocked",
    decision: "blocked",
    can_enter_manual_adoption_review: false,
    blocking_reasons: ["phase27s_live_ui_smoke_missing"],
    next_operator_actions: [
      {
        key: "repair_operator_adoption_readiness_gate",
        label: "Repair blocked adoption readiness gate",
        reason: "phase27s_live_ui_smoke_missing",
        route: "#writer-workbench",
        ui_target: "writer-workbench",
      },
    ],
  },
});
assert.equal(blockedSurface.ok, false);
assert.equal(blockedSurface.bridge_surface_status, "blocked");
assert.equal(blockedSurface.can_enter_manual_adoption_review, false);
assert(blockedSurface.blocking_reasons.includes("phase27s_live_ui_smoke_missing"));
assert.equal(blockedSurface.cards.find((card) => card.key === "manual_review_entry")?.value, "blocked");
assert.equal(blockedSurface.safety.bridge_can_approve, false);
assert.equal(blockedSurface.safety.ui_can_approve, false);
assert.equal(blockedSurface.safety.automatic_adoption_performed, false);
assert(blockedSurface.warnings.includes("foreshadowing_settlement_operator_adoption_gate_surface_blocked"));

const unsafeSurface = buildForeshadowingSettlementOperatorAdoptionGateSurface({
  adoption_gate: {
    ...gate,
    safety: {
      ...gate.safety,
      bridge_can_approve: true,
    },
  },
});
assert.equal(unsafeSurface.ok, false);
assert.equal(unsafeSurface.integrity.gate_safety_locked, false);
assert.equal(unsafeSurface.safety.bridge_can_approve, false);
assert.equal(unsafeSurface.direct_adoption_allowed, false);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27U foreshadowing settlement operator adoption gate UI bridge surface tests passed.");