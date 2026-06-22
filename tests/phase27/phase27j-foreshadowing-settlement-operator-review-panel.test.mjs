import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementOperatorReviewPanel } from "../../server/src/foreshadowing-settlement-operator-review-panel-service.mjs";
import { buildForeshadowingSettlementSurface } from "../../server/src/foreshadowing-settlement-surface-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixtureContext = {
  settlement_context_id: "settlement_ctx_20260622-000000-27j00001",
  context_kind: "adopted_writing_settlement_context",
  adopted_chapter_id: "adopted_chapter_20260622-000000-27j00001",
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
  approval_item_id: "approval_phase27j_guard_blocked",
  blocking_reasons: ["guard_blocked_P0"],
  safety: {
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_active_engine: false,
    bridge_can_modify_compressed_rules: false,
  },
  lineage: {
    candidate: { exists: true },
    proof_report: { exists: true },
    proofing_context: { exists: true },
    writing_context: { exists: true },
  },
};

const activeBefore = await readFile(projectPaths.activeEngine);
const surface = buildForeshadowingSettlementSurface({ context: fixtureContext });
const panel = buildForeshadowingSettlementOperatorReviewPanel({ surface, readiness });

assert.equal(panel.used, true);
assert.equal(panel.phase, "27J");
assert.equal(panel.version, "foreshadowing_settlement_operator_review_panel_v1");
assert.equal(panel.source_phase, "27G");
assert.equal(panel.status, "blocked_review");
assert.equal(panel.decision, "blocked");
assert.equal(panel.settlement_context_id, fixtureContext.settlement_context_id);
assert.equal(panel.approval_item_id, readiness.approval_item_id);
assert.equal(panel.blocked_reason, "guard_blocked_P0");
assert.deepEqual(panel.blocked_reasons.map((item) => item.reason), ["guard_blocked_P0"]);
assert.equal(panel.counts.paid, 1);
assert.equal(panel.counts.kept_open, 1);
assert.equal(panel.counts.blocked, 0);
assert.equal(panel.counts.allowed_candidate_items, 1);
assert.equal(panel.paid_foreshadowing_debts[0].debt_id, "sealed_gate_warning");
assert.equal(panel.kept_open_debts[0].debt_id, "mirror_name_aftershock");
assert.equal(panel.allowed_candidate_settlement_items[0].debt_id, "sealed_gate_warning");
assert.equal(panel.safety.read_only, true);
assert.equal(panel.safety.preview_only, true);
assert.equal(panel.safety.candidate_only, true);
assert.equal(panel.safety.no_auto_persist, true);
assert.equal(panel.safety.no_canon_update, true);
assert.equal(panel.safety.no_active_engine_update, true);
assert.equal(panel.safety.pending_engine_candidate_created, false);
assert.equal(panel.safety.active_engine_modified, false);
assert.equal(panel.safety.requires_human_settlement_review, true);
assert.equal(panel.chatgpt_bridge_safety.bridge_can_approve, false);
assert.equal(panel.chatgpt_bridge_safety.bridge_can_confirm_adoption, false);
assert.equal(panel.chatgpt_bridge_safety.bridge_can_activate_engine, false);
assert.equal(panel.chatgpt_bridge_safety.bridge_can_modify_active_engine, false);
assert.equal(panel.next_operator_action.key, "review_blocked_guard");
assert.equal(panel.next_operator_action.route, "#approval");
assert(panel.warnings.includes("foreshadowing_settlement_operator_panel_blocked_by_guard"));

const sectionKeys = new Set(panel.display_sections.map((section) => section.key));
for (const key of [
  "blocked_reasons",
  "paid_foreshadowing_debts",
  "kept_open_debts",
  "allowed_candidate_settlement_items",
  "chatgpt_bridge_safety",
  "next_operator_action",
]) {
  assert(sectionKeys.has(key), `missing operator panel section: ${key}`);
}
assert.match(panel.panel_markdown, /Foreshadowing Settlement Operator Review Panel/u);
assert.match(panel.panel_markdown, /guard_blocked_P0/u);
assert.match(panel.panel_markdown, /sealed_gate_warning/u);
assert.match(panel.panel_markdown, /mirror_name_aftershock/u);
assert.match(panel.panel_markdown, /bridge_can_activate_engine: false/u);

const ready = buildForeshadowingSettlementOperatorReviewPanel({
  surface,
  readiness: {
    ok: true,
    decision: "ready",
    blocking_reasons: [],
    safety: { bridge_can_approve: true },
  },
});
assert.equal(ready.status, "review_ready");
assert.equal(ready.decision, "operator_review_ready");
assert.equal(ready.chatgpt_bridge_safety.bridge_can_approve, false);
assert(ready.warnings.includes("foreshadowing_settlement_operator_panel_normalized_bridge_denial"));
assert.equal(ready.next_operator_action.key, "review_settlement_preview");

const missing = buildForeshadowingSettlementOperatorReviewPanel({});
assert.equal(missing.used, false);
assert.equal(missing.status, "not_available");
assert.equal(missing.next_operator_action.key, "build_foreshadowing_settlement_surface");
assert(missing.warnings.includes("foreshadowing_settlement_operator_panel_not_available"));

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27J foreshadowing settlement operator review panel tests passed.");
