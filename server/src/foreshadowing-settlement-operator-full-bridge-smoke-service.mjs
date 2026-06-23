import { buildForeshadowingSettlementSurface } from "./foreshadowing-settlement-surface-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanel } from "./foreshadowing-settlement-operator-review-panel-service.mjs";
import { buildForeshadowingSettlementOperatorReviewPanelUi } from "./foreshadowing-settlement-operator-review-panel-ui-service.mjs";
import { buildForeshadowingSettlementOperatorHandoffPacket } from "./foreshadowing-settlement-operator-handoff-packet-service.mjs";
import { buildForeshadowingSettlementOperatorHandoffAuditReceipt } from "./foreshadowing-settlement-operator-handoff-audit-receipt-service.mjs";
import { buildForeshadowingSettlementOperatorDecisionLedger } from "./foreshadowing-settlement-operator-decision-ledger-service.mjs";
import { buildForeshadowingSettlementOperatorLedgerUi } from "./foreshadowing-settlement-operator-ledger-ui-service.mjs";
import { buildForeshadowingSettlementOperatorLedgerBridgeSurface } from "./foreshadowing-settlement-operator-ledger-bridge-service.mjs";

export const foreshadowingSettlementOperatorFullBridgeSmokeVersion =
  "foreshadowing_settlement_operator_full_bridge_smoke_v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readSafety(source) {
  return object(object(source).safety);
}

function flag(source, key) {
  return object(source)[key] === true || readSafety(source)[key] === true;
}

function stage(key, label, artifact, expectedPhase, extra = {}) {
  const item = object(artifact);
  return {
    key,
    label,
    expected_phase: expectedPhase,
    phase: text(item.phase, 40) || null,
    version: text(item.version, 200) || null,
    used: item.used === true,
    status: text(item.status, 160) || text(item.decision, 160) || "not_available",
    source_phase: text(item.source_phase, 40) || null,
    passed: text(item.phase, 40) === expectedPhase,
    ...extra,
  };
}

function buildSafetyBoundary(artifacts, bridgeSurface) {
  const bridgeMetadata = object(bridgeSurface.bridge_metadata);
  const bridgeSafety = readSafety(bridgeSurface);
  const sourceArtifacts = Object.values(artifacts).map(object);
  const forbiddenTrueKeys = [
    "bridge_can_approve",
    "bridge_can_confirm_adoption",
    "bridge_can_activate_engine",
    "bridge_can_modify_canon",
    "bridge_can_modify_active_engine",
    "mcp_can_approve",
    "mcp_can_confirm_adoption",
    "mcp_can_activate_engine",
    "mcp_can_modify_canon",
    "mcp_can_modify_active_engine",
    "ui_can_approve",
    "ui_can_confirm_adoption",
    "ui_can_activate_engine",
    "ledger_can_approve",
    "ledger_can_confirm_adoption",
    "ledger_can_activate_engine",
    "packet_can_approve",
    "packet_can_confirm_adoption",
    "packet_can_activate_engine",
    "receipt_can_approve",
    "receipt_can_confirm_adoption",
    "receipt_can_activate_engine",
    "surface_can_approve",
    "surface_can_confirm_adoption",
    "surface_can_activate_engine",
    "pending_engine_candidate_created",
    "active_engine_modified",
    "canon_modified",
    "compressed_rules_modified",
  ];
  const unexpectedAllowed = [];
  for (const artifact of sourceArtifacts) {
    for (const key of forbiddenTrueKeys) {
      if (flag(artifact, key)) {
        unexpectedAllowed.push({
          artifact_phase: text(artifact.phase, 40) || "not_available",
          key,
        });
      }
    }
  }

  return {
    read_only: bridgeSafety.read_only === true && bridgeMetadata.read_only_tool === true,
    preview_only: bridgeSafety.preview_only !== false,
    candidate_only: bridgeSafety.candidate_only !== false,
    no_auto_persist: bridgeSafety.no_auto_persist !== false,
    no_canon_update: bridgeSafety.no_canon_update === true,
    no_active_engine_update: bridgeSafety.no_active_engine_update === true,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    bridge_can_modify_canon: false,
    bridge_can_modify_active_engine: false,
    mcp_can_approve: false,
    mcp_can_confirm_adoption: false,
    mcp_can_activate_engine: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    canon_modified: false,
    compressed_rules_modified: false,
    bridge_writes_files: bridgeMetadata.writes_files === true,
    bridge_creates_approval_item: bridgeMetadata.creates_approval_item === true,
    bridge_confirms_adoption: bridgeMetadata.confirms_adoption === true,
    bridge_creates_pending_engine_candidate: bridgeMetadata.creates_pending_engine_candidate === true,
    bridge_activates_engine: bridgeMetadata.activates_engine === true,
    bridge_modifies_canon: bridgeMetadata.modifies_canon === true,
    bridge_modifies_active_engine: bridgeMetadata.modifies_active_engine === true,
    unexpected_allowed_operations: unexpectedAllowed,
    passed: unexpectedAllowed.length === 0
      && bridgeMetadata.read_only_tool === true
      && bridgeMetadata.writes_files !== true
      && bridgeMetadata.creates_approval_item !== true
      && bridgeMetadata.confirms_adoption !== true
      && bridgeMetadata.creates_pending_engine_candidate !== true
      && bridgeMetadata.activates_engine !== true
      && bridgeMetadata.modifies_canon !== true
      && bridgeMetadata.modifies_active_engine !== true
      && bridgeSafety.read_only === true
      && bridgeSafety.no_canon_update === true
      && bridgeSafety.no_active_engine_update === true
      && bridgeSafety.mcp_can_approve === false
      && bridgeSafety.mcp_can_confirm_adoption === false
      && bridgeSafety.mcp_can_activate_engine === false,
  };
}

function chatgptReadableSurface(bridgeSurface) {
  const payload = object(bridgeSurface.mcp_payload);
  return {
    tool_name: text(bridgeSurface.tool_name, 240),
    bridge_surface: text(bridgeSurface.bridge_surface, 120),
    row_count: integer(payload.row_count, 0),
    rows_returned: integer(payload.rows_returned, 0),
    has_safety_badges: array(payload.safety_badges).length > 0,
    has_next_operator_actions: array(payload.next_operator_actions).length > 0,
    has_integrity: Object.keys(object(bridgeSurface.integrity)).length > 0,
    has_warnings: array(bridgeSurface.warnings).length > 0,
    has_markdown: text(bridgeSurface.surface_markdown, 10_000).length > 0,
    raw_ledger_included: bridgeSurface.raw_ledger_ui !== null && bridgeSurface.raw_ledger_ui !== undefined,
    content_type: text(payload.content_type, 120),
    passed: text(bridgeSurface.tool_name, 240)
      === "chatgpt_bridge_get_foreshadowing_settlement_operator_ledger_surface"
      && text(payload.content_type, 120) === "application/json"
      && array(payload.safety_badges).length > 0
      && array(payload.next_operator_actions).length > 0
      && integer(payload.row_count, 0) > 0
      && Object.keys(object(bridgeSurface.integrity)).length > 0,
  };
}

function markdownFor(smoke) {
  const stageLines = smoke.chain.stages.map((item) => (
    `- ${item.key}: phase=${item.phase}; expected=${item.expected_phase}; passed=${item.passed}; status=${item.status}`
  ));
  return [
    "## Foreshadowing Settlement Operator Full Bridge Smoke",
    "",
    "- phase: " + smoke.phase,
    "- version: " + smoke.version,
    "- ok: " + String(smoke.ok),
    "- smoke_status: " + smoke.smoke_status,
    "- settlement_context_id: " + (smoke.settlement_context_id ?? "none"),
    "- approval_item_id: " + (smoke.approval_item_id ?? "none"),
    "- read_only: " + String(smoke.safety_boundary.read_only),
    "- no_canon_update: " + String(smoke.safety_boundary.no_canon_update),
    "- no_active_engine_update: " + String(smoke.safety_boundary.no_active_engine_update),
    "- bridge_can_approve: " + String(smoke.safety_boundary.bridge_can_approve),
    "- bridge_can_confirm_adoption: " + String(smoke.safety_boundary.bridge_can_confirm_adoption),
    "- bridge_can_activate_engine: " + String(smoke.safety_boundary.bridge_can_activate_engine),
    "- pending_engine_candidate_created: " + String(smoke.safety_boundary.pending_engine_candidate_created),
    "- active_engine_modified: " + String(smoke.safety_boundary.active_engine_modified),
    "- canon_modified: " + String(smoke.safety_boundary.canon_modified),
    "",
    "### Stage Lineage",
    ...stageLines,
    "",
    "### ChatGPT Surface",
    "- tool_name: " + smoke.chatgpt_surface.tool_name,
    "- row_count: " + String(smoke.chatgpt_surface.row_count),
    "- has_safety_badges: " + String(smoke.chatgpt_surface.has_safety_badges),
    "- has_next_operator_actions: " + String(smoke.chatgpt_surface.has_next_operator_actions),
    "- has_integrity: " + String(smoke.chatgpt_surface.has_integrity),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorFullBridgeSmoke(input = {}) {
  const bundle = object(input);
  const context = object(bundle.context ?? bundle.settlement_context ?? bundle.settlementContext);
  const readiness = object(bundle.readiness ?? bundle.readiness_report ?? bundle.approval_readiness);

  const settlementSurface = object(bundle.settlement_surface).phase
    ? object(bundle.settlement_surface)
    : buildForeshadowingSettlementSurface({ context });
  const reviewPanel = object(bundle.operator_review_panel).phase
    ? object(bundle.operator_review_panel)
    : buildForeshadowingSettlementOperatorReviewPanel({
      surface: settlementSurface,
      readiness,
    });
  const reviewPanelUi = object(bundle.operator_panel_ui ?? bundle.operator_review_panel_ui).phase
    ? object(bundle.operator_panel_ui ?? bundle.operator_review_panel_ui)
    : buildForeshadowingSettlementOperatorReviewPanelUi(reviewPanel);
  const handoffPacket = object(bundle.handoff_packet ?? bundle.operator_handoff_packet).phase
    ? object(bundle.handoff_packet ?? bundle.operator_handoff_packet)
    : buildForeshadowingSettlementOperatorHandoffPacket({
      operator_panel_ui: reviewPanelUi,
    });
  const auditReceipt = object(bundle.audit_receipt ?? bundle.handoff_audit_receipt).phase
    ? object(bundle.audit_receipt ?? bundle.handoff_audit_receipt)
    : buildForeshadowingSettlementOperatorHandoffAuditReceipt({
      handoff_packet: handoffPacket,
    });
  const decisionLedger = object(bundle.operator_decision_ledger ?? bundle.decision_ledger).phase
    ? object(bundle.operator_decision_ledger ?? bundle.decision_ledger)
    : buildForeshadowingSettlementOperatorDecisionLedger({
      audit_receipt: auditReceipt,
    });
  const ledgerUi = object(bundle.operator_ledger_ui ?? bundle.ledger_ui).phase
    ? object(bundle.operator_ledger_ui ?? bundle.ledger_ui)
    : buildForeshadowingSettlementOperatorLedgerUi({
      operator_decision_ledger: decisionLedger,
    });
  const bridgeSurface = object(bundle.bridge_surface ?? bundle.operator_ledger_bridge_surface).phase
    ? object(bundle.bridge_surface ?? bundle.operator_ledger_bridge_surface)
    : buildForeshadowingSettlementOperatorLedgerBridgeSurface({
      operator_ledger_ui: ledgerUi,
      settlement_context_id: text(
        bundle.settlement_context_id
          ?? bundle.settlementContextId
          ?? ledgerUi.rows?.[0]?.settlement_context_id
          ?? reviewPanelUi.settlement_context_id
          ?? settlementSurface.settlement_context_id,
        240,
      ) || null,
      approval_item_id: text(
        bundle.approval_item_id
          ?? bundle.approvalItemId
          ?? ledgerUi.rows?.[0]?.approval_item_id
          ?? reviewPanelUi.approval_item_id
          ?? reviewPanel.approval_item_id,
        240,
      ) || null,
      max_rows: integer(bundle.max_rows ?? bundle.maxRows, 50),
      include_raw: boolean(bundle.include_raw ?? bundle.includeRaw, false),
      include_markdown: boolean(bundle.include_markdown ?? bundle.includeMarkdown, true),
    });

  const artifacts = {
    settlement_surface: settlementSurface,
    operator_review_panel: reviewPanel,
    operator_review_panel_ui: reviewPanelUi,
    handoff_packet: handoffPacket,
    audit_receipt: auditReceipt,
    decision_ledger: decisionLedger,
    ledger_ui: ledgerUi,
    bridge_surface: bridgeSurface,
  };

  const stages = [
    stage("settlement_surface", "Settlement surface", settlementSurface, "27G", {
      settlement_context_id: text(settlementSurface.settlement_context_id, 240) || null,
    }),
    stage("operator_review_panel", "Operator review panel", reviewPanel, "27J"),
    stage("operator_review_panel_ui", "Operator review panel UI", reviewPanelUi, "27K"),
    stage("handoff_packet", "Operator handoff packet", handoffPacket, "27L"),
    stage("audit_receipt", "Handoff audit receipt", auditReceipt, "27M"),
    stage("decision_ledger", "Operator decision ledger", decisionLedger, "27N", {
      entry_count: array(decisionLedger.entries).length,
    }),
    stage("ledger_ui", "Operator ledger UI", ledgerUi, "27O", {
      row_count: array(ledgerUi.rows).length,
    }),
    stage("bridge_surface", "ChatGPT bridge / MCP read-only surface", bridgeSurface, "27P", {
      tool_name: text(bridgeSurface.tool_name, 240),
      row_count: integer(object(bridgeSurface.mcp_payload).row_count, 0),
    }),
  ];

  const chainPassed = stages.every((item) => item.passed === true);
  const handoffContinuity = {
    review_panel: reviewPanel.phase === "27J" && reviewPanel.used === true,
    handoff_packet: handoffPacket.phase === "27L" && handoffPacket.used === true,
    audit_receipt: auditReceipt.phase === "27M" && auditReceipt.used === true,
    decision_ledger: decisionLedger.phase === "27N" && decisionLedger.used === true,
    ledger_ui: ledgerUi.phase === "27O" && ledgerUi.used === true,
    bridge_surface: bridgeSurface.phase === "27P" && bridgeSurface.used === true,
  };
  const handoffPassed = Object.values(handoffContinuity).every((value) => value === true);
  const safetyBoundary = buildSafetyBoundary(artifacts, bridgeSurface);
  const chatgptSurface = chatgptReadableSurface(bridgeSurface);

  const smoke = {
    ok: chainPassed && handoffPassed && safetyBoundary.passed && chatgptSurface.passed,
    used: bridgeSurface.used === true,
    phase: "27Q",
    version: foreshadowingSettlementOperatorFullBridgeSmokeVersion,
    smoke_kind: "foreshadowing_settlement_operator_full_bridge_smoke",
    source_phases: ["27J", "27K", "27L", "27M", "27N", "27O", "27P"],
    smoke_phase: "27Q",
    settlement_context_id: text(bridgeSurface.settlement_context_id, 240)
      || text(reviewPanelUi.settlement_context_id, 240)
      || text(settlementSurface.settlement_context_id, 240)
      || null,
    approval_item_id: text(bridgeSurface.approval_item_id, 240)
      || text(reviewPanelUi.approval_item_id, 240)
      || text(reviewPanel.approval_item_id, 240)
      || null,
    smoke_status: "pending",
    chain: {
      settlement_context: {
        provided: Object.keys(context).length > 0,
        settlement_context_id: text(context.settlement_context_id, 240) || null,
        context_kind: text(context.context_kind, 240) || null,
      },
      stages,
      phase_lineage_passed: chainPassed,
    },
    operator_handoff: {
      ...handoffContinuity,
      passed: handoffPassed,
    },
    chatgpt_surface: chatgptSurface,
    safety_boundary: safetyBoundary,
    integrity: {
      review_panel_trace_id: text(reviewPanel.trace_id, 240) || null,
      handoff_packet_id: text(handoffPacket.review_packet_id, 240) || null,
      audit_receipt_id: text(auditReceipt.receipt_id, 240) || null,
      decision_ledger_id: text(decisionLedger.ledger_id, 240) || null,
      decision_ledger_entries_hash: text(object(decisionLedger.integrity).entries_hash, 80) || null,
      ledger_ui_entries_hash: text(object(ledgerUi.integrity).entries_hash, 80) || null,
      bridge_integrity_available: Object.keys(object(bridgeSurface.integrity)).length > 0,
    },
    warnings: [
      ...array(settlementSurface.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(reviewPanel.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(handoffPacket.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(auditReceipt.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(decisionLedger.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(ledgerUi.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...array(bridgeSurface.warnings).map((warning) => text(warning, 240)).filter(Boolean),
      ...(chainPassed ? [] : ["foreshadowing_settlement_operator_full_bridge_smoke_lineage_failed"]),
      ...(handoffPassed ? [] : ["foreshadowing_settlement_operator_full_bridge_smoke_handoff_incomplete"]),
      ...(safetyBoundary.passed ? [] : ["foreshadowing_settlement_operator_full_bridge_smoke_safety_boundary_failed"]),
      ...(chatgptSurface.passed ? [] : ["foreshadowing_settlement_operator_full_bridge_smoke_chatgpt_surface_incomplete"]),
    ],
    artifacts: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? artifacts : null,
  };
  smoke.smoke_status = smoke.ok ? "passed" : "failed";
  smoke.surface_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(smoke)
    : "";
  return smoke;
}

export default buildForeshadowingSettlementOperatorFullBridgeSmoke;
