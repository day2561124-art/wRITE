import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildForeshadowingSettlementOperatorHandoffAuditReceipt } from "../../server/src/foreshadowing-settlement-operator-handoff-audit-receipt-service.mjs";
import { buildForeshadowingSettlementOperatorDecisionLedger } from "../../server/src/foreshadowing-settlement-operator-decision-ledger-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function packetFor(status, suffix) {
  return {
    used: true,
    phase: "27L",
    version: "foreshadowing_settlement_operator_handoff_packet_v1",
    packet_kind: "foreshadowing_settlement_operator_handoff_packet",
    review_packet_id: `foreshadowing_settlement_operator_handoff_${suffix}`,
    source_phase: "27K",
    source_version: "foreshadowing_settlement_operator_review_panel_ui_v1",
    status,
    decision: status === "review_ready" ? "operator_review_ready" : "blocked",
    settlement_context_id: `settlement_ctx_20260623-000000-27n_${suffix}`,
    approval_item_id: `approval_phase27n_${suffix}`,
    counts: {
      paid: 1,
      kept_open: status === "review_ready" ? 0 : 1,
      blocked: 0,
      allowed_candidate_items: 1,
    },
    blocked_reasons: status === "blocked_review"
      ? [{ reason: "guard_blocked_P0", source: "approval_queue_readiness" }]
      : [],
    operator_intake_checklist: [
      {
        key: "verify_identity",
        label: "Verify settlement and approval identifiers",
        required: true,
        passed: true,
      },
      {
        key: "confirm_bridge_denied",
        label: "Confirm ChatGPT bridge cannot approve, confirm adoption, or activate engine",
        required: true,
        passed: true,
      },
      {
        key: "confirm_no_direct_canon_intake",
        label: "Confirm this handoff packet does not modify Canon DB or active_engine",
        required: true,
        passed: true,
      },
    ],
    forbidden_actions: [
      "approve_from_chatgpt_bridge",
      "confirm_adoption_from_chatgpt_bridge",
      "activate_engine_from_chatgpt_bridge",
      "modify_active_engine",
      "modify_canon_db",
    ],
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
  };
}

const activeBefore = await readFile(projectPaths.activeEngine);
const blockedReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({
  handoff_packet: packetFor("blocked_review", "blocked"),
});
const readyReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({
  handoff_packet: packetFor("review_ready", "ready"),
});
const missingReceipt = buildForeshadowingSettlementOperatorHandoffAuditReceipt({});
const ledger = buildForeshadowingSettlementOperatorDecisionLedger({
  audit_receipts: [blockedReceipt, readyReceipt, missingReceipt],
});

assert.equal(ledger.used, true);
assert.equal(ledger.phase, "27N");
assert.equal(ledger.version, "foreshadowing_settlement_operator_decision_ledger_v1");
assert.equal(ledger.ledger_kind, "foreshadowing_settlement_operator_decision_ledger");
assert.match(ledger.ledger_id, /^foreshadowing_settlement_operator_decision_ledger_[a-f0-9]{16}$/u);
assert.equal(ledger.entries.length, 3);
assert.equal(ledger.summary.total, 3);
assert.equal(ledger.summary.blocked, 1);
assert.equal(ledger.summary.review_ready, 1);
assert.equal(ledger.summary.source_not_available, 1);
assert.equal(ledger.summary.required_failed, 0);
assert.equal(ledger.summary.requires_human_operator_decision, 3);

const blockedEntry = ledger.entries.find((entry) => entry.ledger_status === "blocked");
const readyEntry = ledger.entries.find((entry) => entry.ledger_status === "review_ready");
const missingEntry = ledger.entries.find((entry) => entry.ledger_status === "source_not_available");
assert.ok(blockedEntry);
assert.ok(readyEntry);
assert.ok(missingEntry);
assert.match(blockedEntry.entry_id, /^foreshadowing_settlement_operator_decision_entry_[a-f0-9]{16}$/u);
assert.equal(blockedEntry.source_receipt_id, blockedReceipt.receipt_id);
assert.equal(blockedEntry.source_packet.status, "blocked_review");
assert.equal(blockedEntry.next_operator_action.key, "return_to_approval_queue_guard_review");
assert.equal(readyEntry.source_receipt_id, readyReceipt.receipt_id);
assert.equal(readyEntry.decision, "ready_for_human_operator_review");
assert.equal(readyEntry.next_operator_action.key, "human_operator_review_candidate_settlement_preview");
assert.equal(missingEntry.decision, "source_not_available");
assert.equal(missingEntry.next_operator_action.key, "inspect_handoff_audit_receipt_source");

assert.equal(ledger.index.by_decision.blocked_handoff_recorded.includes(blockedEntry.entry_id), true);
assert.equal(ledger.index.by_decision.ready_for_human_operator_review.includes(readyEntry.entry_id), true);
assert.equal(ledger.index.by_ledger_status.blocked.includes(blockedEntry.entry_id), true);
assert.equal(ledger.index.by_ledger_status.review_ready.includes(readyEntry.entry_id), true);
assert.equal(ledger.index.by_packet_status.blocked_review.includes(blockedEntry.entry_id), true);
assert.equal(ledger.index.by_packet_status.review_ready.includes(readyEntry.entry_id), true);
assert.equal(
  ledger.index.by_settlement_context_id[readyEntry.source_packet.settlement_context_id].includes(readyEntry.entry_id),
  true,
);
assert.match(ledger.integrity.receipts_hash, /^[a-f0-9]{64}$/u);
assert.match(ledger.integrity.entries_hash, /^[a-f0-9]{64}$/u);
assert.match(ledger.integrity.index_hash, /^[a-f0-9]{64}$/u);
assert.equal(ledger.forbidden_actions.includes("ledger_side_approval"), true);
assert.equal(ledger.forbidden_actions.includes("ledger_side_active_engine_activation"), true);
assert.equal(ledger.safety.read_only, true);
assert.equal(ledger.safety.preview_only, true);
assert.equal(ledger.safety.candidate_only, true);
assert.equal(ledger.safety.no_canon_update, true);
assert.equal(ledger.safety.no_active_engine_update, true);
assert.equal(ledger.safety.pending_engine_candidate_created, false);
assert.equal(ledger.safety.active_engine_modified, false);
assert.equal(ledger.safety.bridge_can_approve, false);
assert.equal(ledger.safety.bridge_can_confirm_adoption, false);
assert.equal(ledger.safety.bridge_can_activate_engine, false);
assert.equal(ledger.safety.ledger_can_approve, false);
assert.equal(ledger.safety.ledger_can_confirm_adoption, false);
assert.equal(ledger.safety.ledger_can_activate_engine, false);
assert.equal(ledger.warnings.includes("foreshadowing_settlement_operator_decision_ledger_contains_blocked_entries"), true);
assert.match(ledger.ledger_markdown, /Foreshadowing Settlement Operator Decision Ledger/u);
assert.match(ledger.ledger_markdown, /ledger_can_activate_engine: false/u);

const repeat = buildForeshadowingSettlementOperatorDecisionLedger({
  audit_receipts: [blockedReceipt, readyReceipt, missingReceipt],
});
assert.equal(repeat.ledger_id, ledger.ledger_id);
assert.equal(repeat.integrity.entries_hash, ledger.integrity.entries_hash);
assert.equal(repeat.entries[0].entry_id, ledger.entries[0].entry_id);

const emptyLedger = buildForeshadowingSettlementOperatorDecisionLedger({});
assert.equal(emptyLedger.used, false);
assert.equal(emptyLedger.summary.total, 0);
assert.equal(emptyLedger.safety.no_canon_update, true);
assert.equal(emptyLedger.safety.no_active_engine_update, true);
assert.equal(emptyLedger.safety.ledger_can_approve, false);
assert.equal(emptyLedger.warnings.includes("foreshadowing_settlement_operator_decision_ledger_no_receipts"), true);

assert.equal(hash(await readFile(projectPaths.activeEngine)), hash(activeBefore));

console.log("Phase27N foreshadowing settlement operator decision ledger tests passed.");
