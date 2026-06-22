import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementOperatorLedgerUi } from "../../server/src/foreshadowing-settlement-operator-ledger-ui-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const activeBefore = await readFile(projectPaths.activeEngine);
const ledger = {
  used: true,
  phase: "27N",
  version: "foreshadowing_settlement_operator_decision_ledger_v1",
  ledger_kind: "foreshadowing_settlement_operator_decision_ledger",
  ledger_id: "foreshadowing_settlement_operator_decision_ledger_phase27o_fixture",
  summary: {
    total: 3,
    blocked: 1,
    review_ready: 1,
    recorded: 0,
    source_not_available: 1,
    required_failed: 0,
    requires_human_operator_decision: 3,
  },
  index: {
    by_decision: {
      blocked_handoff_recorded: ["entry_blocked"],
      ready_for_human_operator_review: ["entry_ready"],
      source_not_available: ["entry_missing"],
    },
    by_ledger_status: {
      blocked: ["entry_blocked"],
      review_ready: ["entry_ready"],
      source_not_available: ["entry_missing"],
    },
    by_packet_status: {
      blocked_review: ["entry_blocked"],
      review_ready: ["entry_ready"],
      not_available: ["entry_missing"],
    },
    by_settlement_context_id: {
      settlement_ctx_phase27o_ready: ["entry_ready"],
    },
    by_approval_item_id: {
      approval_phase27o_ready: ["entry_ready"],
    },
  },
  entries: [
    {
      entry_id: "entry_blocked",
      source_receipt_id: "receipt_blocked",
      ledger_status: "blocked",
      decision: "blocked_handoff_recorded",
      source_packet: {
        status: "blocked_review",
        settlement_context_id: "settlement_ctx_phase27o_blocked",
        approval_item_id: "approval_phase27o_blocked",
      },
      checklist_required: 4,
      checklist_required_failed: 0,
      failed_checklist_keys: [],
      next_operator_action: {
        key: "return_to_approval_queue_guard_review",
        label: "Return to Approval Queue guard review",
        route: "#approval",
        enabled: true,
        allowed: true,
        forbidden: ["approve_from_chatgpt_bridge"],
      },
    },
    {
      entry_id: "entry_ready",
      source_receipt_id: "receipt_ready",
      ledger_status: "review_ready",
      decision: "ready_for_human_operator_review",
      source_packet: {
        status: "review_ready",
        settlement_context_id: "settlement_ctx_phase27o_ready",
        approval_item_id: "approval_phase27o_ready",
      },
      checklist_required: 5,
      checklist_required_failed: 0,
      failed_checklist_keys: [],
      next_operator_action: {
        key: "human_operator_review_candidate_settlement_preview",
        label: "Human operator reviews candidate settlement preview",
        route: "#settlement",
        enabled: true,
        allowed: true,
        forbidden: ["automatic_canon_intake"],
      },
    },
    {
      entry_id: "entry_missing",
      source_receipt_id: "receipt_missing",
      ledger_status: "source_not_available",
      decision: "source_not_available",
      source_packet: {
        status: "not_available",
      },
      checklist_required: 0,
      checklist_required_failed: 0,
      failed_checklist_keys: [],
      next_operator_action: {
        key: "inspect_handoff_audit_receipt_source",
        label: "Inspect handoff audit receipt source before operator decision",
        route: "#settlement",
        enabled: false,
        allowed: false,
        forbidden: ["ledger_side_approval"],
      },
    },
  ],
  integrity: {
    receipts_hash: "a".repeat(64),
    entries_hash: "b".repeat(64),
    index_hash: "c".repeat(64),
    safety_hash: "d".repeat(64),
  },
  safety: {
    read_only: true,
    preview_only: true,
    candidate_only: true,
    no_canon_update: true,
    no_active_engine_update: true,
    ledger_can_approve: false,
    ledger_can_confirm_adoption: false,
    ledger_can_activate_engine: false,
  },
  warnings: ["foreshadowing_settlement_operator_decision_ledger_contains_blocked_entries"],
};

const ui = buildForeshadowingSettlementOperatorLedgerUi({ operator_decision_ledger: ledger });

assert.equal(ui.used, true);
assert.equal(ui.phase, "27O");
assert.equal(ui.version, "foreshadowing_settlement_operator_ledger_ui_v1");
assert.equal(ui.ui_kind, "foreshadowing_settlement_operator_decision_ledger_ui");
assert.equal(ui.source_phase, "27N");
assert.equal(ui.ledger_id, ledger.ledger_id);
assert.equal(ui.status, "blocked");
assert.equal(ui.status_badge.tone, "blocked");
assert.match(ui.headline, /blocked entries/u);
assert.match(ui.summary, /entries=3/u);
assert.equal(ui.cards.find((card) => card.key === "blocked_entries")?.value, "1");
assert.equal(ui.rows.length, 3);
assert.equal(ui.rows[0].status_badge.tone, "blocked");
assert.equal(ui.rows[0].next_operator_action.ui_target, "approval");
assert.equal(ui.rows[1].next_operator_action.ui_target, "settlement");
assert.equal(ui.rows.every((row) => row.can_approve === false), true);
assert.equal(ui.rows.every((row) => row.can_confirm_adoption === false), true);
assert.equal(ui.rows.every((row) => row.can_activate_engine === false), true);
assert.equal(ui.filters.find((filter) => filter.key === "ledger_status")?.options.length, 3);
assert.equal(ui.index_sections.some((section) => section.key === "by_decision"), true);
assert.equal(ui.next_operator_actions.length, 3);
assert.equal(ui.safety.read_only, true);
assert.equal(ui.safety.preview_only, true);
assert.equal(ui.safety.candidate_only, true);
assert.equal(ui.safety.no_canon_update, true);
assert.equal(ui.safety.no_active_engine_update, true);
assert.equal(ui.safety.ledger_can_approve, false);
assert.equal(ui.safety.ledger_can_confirm_adoption, false);
assert.equal(ui.safety.ledger_can_activate_engine, false);
assert.equal(ui.safety.ui_can_approve, false);
assert.equal(ui.safety.ui_can_confirm_adoption, false);
assert.equal(ui.safety.ui_can_activate_engine, false);
assert.equal(ui.warnings.includes("foreshadowing_settlement_operator_ledger_ui_contains_blocked_entries"), true);

const safetyBadges = new Map(ui.safety_badges.map((badge) => [badge.key, badge]));
assert.equal(safetyBadges.get("read_only")?.value, true);
assert.equal(safetyBadges.get("ledger_can_approve")?.denied, true);
assert.equal(safetyBadges.get("ui_can_activate_engine")?.denied, true);

const emptyUi = buildForeshadowingSettlementOperatorLedgerUi({});
assert.equal(emptyUi.used, false);
assert.equal(emptyUi.status, "not_available");
assert.equal(emptyUi.rows.length, 0);
assert.equal(emptyUi.cards.find((card) => card.key === "total_entries")?.value, "0");
assert.equal(emptyUi.safety.no_canon_update, true);
assert.equal(emptyUi.safety.no_active_engine_update, true);
assert.equal(emptyUi.safety.ui_can_approve, false);
assert.equal(emptyUi.warnings.includes("foreshadowing_settlement_operator_ledger_ui_no_ledger"), true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27O foreshadowing settlement operator ledger UI tests passed.");
