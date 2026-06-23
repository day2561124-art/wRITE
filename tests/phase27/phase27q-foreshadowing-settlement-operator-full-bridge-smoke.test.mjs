import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildForeshadowingSettlementOperatorFullBridgeSmoke,
  foreshadowingSettlementOperatorFullBridgeSmokeVersion,
} from "../../server/src/foreshadowing-settlement-operator-full-bridge-smoke-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260623-000000-27q00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260623-000000-27q00001",
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
  approval_item_id: "approval_phase27q_guard_blocked",
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
const smoke = buildForeshadowingSettlementOperatorFullBridgeSmoke({
  context: fixtureContext,
  readiness,
  max_rows: 50,
  include_raw: false,
  include_markdown: true,
});

assert.equal(smoke.ok, true);
assert.equal(smoke.used, true);
assert.equal(smoke.phase, "27Q");
assert.equal(smoke.version, foreshadowingSettlementOperatorFullBridgeSmokeVersion);
assert.equal(smoke.smoke_kind, "foreshadowing_settlement_operator_full_bridge_smoke");
assert.equal(smoke.smoke_status, "passed");
assert.deepEqual(smoke.source_phases, ["27J", "27K", "27L", "27M", "27N", "27O", "27P"]);
assert.equal(smoke.smoke_phase, "27Q");
assert.equal(smoke.settlement_context_id, "settlement_ctx_20260623-000000-27q00001");
assert.equal(smoke.approval_item_id, "approval_phase27q_guard_blocked");

const stageMap = new Map(smoke.chain.stages.map((stage) => [stage.key, stage]));
assert.equal(smoke.chain.phase_lineage_passed, true);
assert.equal(stageMap.get("settlement_surface")?.phase, "27G");
assert.equal(stageMap.get("operator_review_panel")?.phase, "27J");
assert.equal(stageMap.get("operator_review_panel_ui")?.phase, "27K");
assert.equal(stageMap.get("handoff_packet")?.phase, "27L");
assert.equal(stageMap.get("audit_receipt")?.phase, "27M");
assert.equal(stageMap.get("decision_ledger")?.phase, "27N");
assert.equal(stageMap.get("ledger_ui")?.phase, "27O");
assert.equal(stageMap.get("bridge_surface")?.phase, "27P");
assert.equal(stageMap.get("bridge_surface")?.tool_name, "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface");
assert.equal(stageMap.get("decision_ledger")?.entry_count, 1);
assert.equal(stageMap.get("ledger_ui")?.row_count, 1);
assert.equal(stageMap.get("bridge_surface")?.row_count, 1);

assert.equal(smoke.operator_handoff.passed, true);
assert.equal(smoke.operator_handoff.review_panel, true);
assert.equal(smoke.operator_handoff.handoff_packet, true);
assert.equal(smoke.operator_handoff.audit_receipt, true);
assert.equal(smoke.operator_handoff.decision_ledger, true);
assert.equal(smoke.operator_handoff.ledger_ui, true);
assert.equal(smoke.operator_handoff.bridge_surface, true);

assert.equal(smoke.chatgpt_surface.tool_name, "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface");
assert.equal(smoke.chatgpt_surface.bridge_surface, "chatgpt_bridge_mcp");
assert.equal(smoke.chatgpt_surface.content_type, "application/json");
assert.equal(smoke.chatgpt_surface.row_count, 1);
assert.equal(smoke.chatgpt_surface.rows_returned, 1);
assert.equal(smoke.chatgpt_surface.has_safety_badges, true);
assert.equal(smoke.chatgpt_surface.has_next_operator_actions, true);
assert.equal(smoke.chatgpt_surface.has_integrity, true);
assert.equal(smoke.chatgpt_surface.has_markdown, true);
assert.equal(smoke.chatgpt_surface.raw_ledger_included, false);
assert.equal(smoke.chatgpt_surface.passed, true);

assert.equal(smoke.safety_boundary.passed, true);
assert.equal(smoke.safety_boundary.read_only, true);
assert.equal(smoke.safety_boundary.preview_only, true);
assert.equal(smoke.safety_boundary.candidate_only, true);
assert.equal(smoke.safety_boundary.no_auto_persist, true);
assert.equal(smoke.safety_boundary.no_canon_update, true);
assert.equal(smoke.safety_boundary.no_active_engine_update, true);
assert.equal(smoke.safety_boundary.bridge_can_approve, false);
assert.equal(smoke.safety_boundary.bridge_can_confirm_adoption, false);
assert.equal(smoke.safety_boundary.bridge_can_activate_engine, false);
assert.equal(smoke.safety_boundary.pending_engine_candidate_created, false);
assert.equal(smoke.safety_boundary.active_engine_modified, false);
assert.equal(smoke.safety_boundary.canon_modified, false);
assert.equal(smoke.safety_boundary.compressed_rules_modified, false);
assert.equal(smoke.safety_boundary.bridge_writes_files, false);
assert.equal(smoke.safety_boundary.bridge_creates_approval_item, false);
assert.equal(smoke.safety_boundary.bridge_confirms_adoption, false);
assert.equal(smoke.safety_boundary.bridge_creates_pending_engine_candidate, false);
assert.equal(smoke.safety_boundary.bridge_activates_engine, false);
assert.equal(smoke.safety_boundary.bridge_modifies_canon, false);
assert.equal(smoke.safety_boundary.bridge_modifies_active_engine, false);
assert.deepEqual(smoke.safety_boundary.unexpected_allowed_operations, []);

assert.match(smoke.integrity.handoff_packet_id, /^foreshadowing_settlement_operator_handoff_[a-f0-9]{16}$/u);
assert.match(smoke.integrity.audit_receipt_id, /^foreshadowing_settlement_operator_handoff_audit_[a-f0-9]{16}$/u);
assert.match(smoke.integrity.decision_ledger_id, /^foreshadowing_settlement_operator_decision_ledger_[a-f0-9]{16}$/u);
assert.match(smoke.integrity.decision_ledger_entries_hash, /^[a-f0-9]{64}$/u);
assert.equal(smoke.integrity.bridge_integrity_available, true);
assert.equal(smoke.artifacts, null);
assert.match(smoke.surface_markdown, /Foreshadowing Settlement Operator Full Bridge Smoke/u);
assert.match(smoke.surface_markdown, /bridge_can_activate_engine: false/u);

const rawSmoke = buildForeshadowingSettlementOperatorFullBridgeSmoke({
  context: fixtureContext,
  readiness,
  include_raw: true,
  include_markdown: false,
});
assert.equal(rawSmoke.ok, true);
assert.equal(rawSmoke.artifacts.bridge_surface.phase, "27P");
assert.equal(rawSmoke.chatgpt_surface.raw_ledger_included, true);
assert.equal(rawSmoke.surface_markdown, "");

const emptySmoke = buildForeshadowingSettlementOperatorFullBridgeSmoke({});
assert.equal(emptySmoke.ok, false);
assert.equal(emptySmoke.phase, "27Q");
assert.equal(emptySmoke.smoke_status, "failed");
assert.equal(emptySmoke.safety_boundary.no_canon_update, true);
assert.equal(emptySmoke.safety_boundary.no_active_engine_update, true);
assert.equal(emptySmoke.safety_boundary.bridge_can_approve, false);
assert.equal(emptySmoke.warnings.includes("foreshadowing_settlement_operator_full_bridge_smoke_handoff_incomplete"), true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27Q foreshadowing settlement operator full bridge smoke tests passed.");
