import assert from "node:assert/strict";
import {
  buildForeshadowingSettlementOperatorLedgerBridgeSurface,
  foreshadowingSettlementOperatorLedgerBridgeSurfaceVersion,
} from "../../server/src/foreshadowing-settlement-operator-ledger-bridge-service.mjs";

const sampleLedgerUi = {
  used: true,
  phase: "27O",
  version: "foreshadowing_settlement_operator_ledger_ui_v1",
  ledger_id: "ledger_fixture_001",
  status: "blocked",
  headline: "Fixture ledger contains blocked entries",
  summary: "entries=2 | blocked=1 | review_ready=1 | source_not_available=0 | required_failed=1",
  cards: [
    { key: "total_entries", title: "Ledger entries", value: "2", tone: "ready" },
    { key: "blocked_entries", title: "Blocked entries", value: "1", tone: "blocked" },
    { key: "review_ready_entries", title: "Review-ready entries", value: "1", tone: "ready" },
    { key: "required_failures", title: "Required check failures", value: "1", tone: "blocked" },
  ],
  filters: [
    {
      key: "ledger_status",
      label: "Ledger status",
      options: [
        { key: "ledger_status:blocked", value: "blocked", label: "blocked", count: 1 },
        { key: "ledger_status:review_ready", value: "review_ready", label: "review_ready", count: 1 },
      ],
    },
  ],
  rows: [
    {
      row_id: "entry_blocked",
      source_receipt_id: "receipt_blocked",
      ledger_status: "blocked",
      decision: "blocked_handoff_recorded",
      packet_status: "blocked_review",
      settlement_context_id: "settlement_ctx_fixture",
      approval_item_id: "approval_item_fixture",
      checklist_required: 5,
      checklist_required_failed: 1,
      failed_checklist_keys: ["resolve_blocked_guard"],
      next_operator_action: {
        key: "return_to_approval_queue_guard_review",
        label: "Return to Approval Queue guard review",
        route: "#approval",
        ui_target: "approval",
        enabled: true,
        allowed: true,
        forbidden: ["approve_from_chatgpt_bridge"],
      },
    },
    {
      row_id: "entry_ready",
      source_receipt_id: "receipt_ready",
      ledger_status: "review_ready",
      decision: "ready_for_human_operator_review",
      packet_status: "review_ready",
      settlement_context_id: "settlement_ctx_fixture",
      approval_item_id: "approval_item_fixture",
      checklist_required: 4,
      checklist_required_failed: 0,
      failed_checklist_keys: [],
      next_operator_action: {
        key: "human_operator_review_candidate_settlement_preview",
        label: "Human operator reviews candidate settlement preview",
        route: "#settlement",
        ui_target: "settlement",
        enabled: true,
        allowed: true,
        forbidden: ["automatic_canon_intake"],
      },
    },
  ],
  next_operator_actions: [
    {
      key: "return_to_approval_queue_guard_review",
      label: "Return to Approval Queue guard review",
      route: "#approval",
      ui_target: "approval",
      enabled: true,
      allowed: true,
      entry_count: 1,
      ledger_statuses: ["blocked"],
      entry_ids: ["entry_blocked"],
      forbidden: ["approve_from_chatgpt_bridge"],
    },
  ],
  safety_badges: [
    { key: "read_only", label: "read_only", value: true },
    { key: "mcp_can_approve", label: "mcp_can_approve", value: false },
  ],
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
  integrity: {
    entries_hash: "entries_hash_fixture",
  },
  warnings: ["fixture_warning"],
  raw_ledger: {
    used: true,
    ledger_id: "ledger_fixture_001",
    ledger_markdown: "## Ledger fixture",
  },
};

const surface = buildForeshadowingSettlementOperatorLedgerBridgeSurface({
  operator_ledger_ui: sampleLedgerUi,
  settlement_context_id: "settlement_ctx_fixture",
  approval_item_id: "approval_item_fixture",
  max_rows: 1,
  include_raw: false,
  include_markdown: true,
});

assert.equal(surface.ok, true);
assert.equal(surface.used, true);
assert.equal(surface.phase, "27P");
assert.equal(surface.version, foreshadowingSettlementOperatorLedgerBridgeSurfaceVersion);
assert.equal(surface.tool_name, "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface");
assert.equal(surface.bridge_surface, "chatgpt_bridge_mcp");
assert.equal(surface.ledger_id, "ledger_fixture_001");
assert.equal(surface.settlement_context_id, "settlement_ctx_fixture");
assert.equal(surface.mcp_payload.row_count, 2);
assert.equal(surface.mcp_payload.rows_returned, 1);
assert.equal(surface.mcp_payload.rows_truncated, true);
assert.equal(surface.mcp_payload.rows[0].can_approve, false);
assert.equal(surface.mcp_payload.rows[0].can_confirm_adoption, false);
assert.equal(surface.mcp_payload.rows[0].can_activate_engine, false);
assert.equal(surface.bridge_metadata.read_only_tool, true);
assert.equal(surface.bridge_metadata.mcp_public_profile_allowed, true);
assert.equal(surface.bridge_metadata.writes_files, false);
assert.equal(surface.bridge_metadata.creates_approval_item, false);
assert.equal(surface.bridge_metadata.creates_pending_engine_candidate, false);
assert.equal(surface.bridge_metadata.activates_engine, false);
assert.equal(surface.safety.read_only, true);
assert.equal(surface.safety.no_canon_update, true);
assert.equal(surface.safety.no_active_engine_update, true);
assert.equal(surface.safety.mcp_can_approve, false);
assert.equal(surface.safety.mcp_can_confirm_adoption, false);
assert.equal(surface.safety.mcp_can_activate_engine, false);
assert(surface.surface_markdown.includes("Foreshadowing Settlement Operator Ledger Bridge Surface"));
assert.equal(surface.raw_ledger_ui, null);
assert(surface.warnings.includes("foreshadowing_settlement_operator_ledger_bridge_contains_blocked_entries"));

const empty = buildForeshadowingSettlementOperatorLedgerBridgeSurface({});
assert.equal(empty.used, false);
assert.equal(empty.status, "not_available");
assert.equal(empty.mcp_payload.row_count, 0);
assert.equal(empty.bridge_metadata.writes_files, false);
assert(empty.warnings.includes("foreshadowing_settlement_operator_ledger_bridge_no_source_ui"));

console.log("Phase27P foreshadowing settlement operator ledger bridge surface tests passed.");
