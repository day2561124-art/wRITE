import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildForeshadowingSettlementOperatorReviewChainIndex,
} from "../../server/src/foreshadowing-settlement-operator-review-chain-index-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

const runAllPath = path.join(rootDir, "tests", "run-all.mjs");
const servicePath = path.join(
  rootDir,
  "server",
  "src",
  "foreshadowing-settlement-operator-review-chain-index-service.mjs",
);
const uiIndexPath = path.join(rootDir, "server", "ui", "index.html");
const uiAppPath = path.join(rootDir, "server", "ui", "app.js");

const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const settlementContextsDir = path.join(rootDir, "data", "outputs", "settlement_contexts");
const settlementReportsDir = path.join(rootDir, "data", "outputs", "settlement_reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "logs", "approval_log.jsonl");
const backupProjectDir = path.join(rootDir, "data", "backups", "project_backups");
const backupExportsDir = path.join(rootDir, "data", "backups", "exports");
const restorePreviewsDir = path.join(rootDir, "data", "backups", "restore_previews");

const archiveFilesDir = path.join(rootDir, "data", "audit_retention", "archives");
const archiveIndexDir = path.join(rootDir, "data", "audit_retention", "archive_index");
const archiveManifestDir = path.join(rootDir, "data", "audit_retention", "archive_manifests");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

const expectedRunAllRegistrations = [
  "tests/phase28/phase28a-foreshadowing-settlement-operator-review-chain-index.test.mjs",
  "tests/phase28/phase28b-foreshadowing-settlement-operator-review-chain-index-ui-surface.test.mjs",
  "tests/phase28/phase28c-foreshadowing-settlement-operator-review-chain-index-live-ui-smoke.test.mjs",
  "tests/phase28/phase28d-foreshadowing-settlement-operator-review-chain-index-final-bridge-smoke.test.mjs",
  "tests/phase28/phase28e-foreshadowing-settlement-operator-review-chain-index-navigation-hardening.test.mjs",
  "tests/phase28/phase28f-foreshadowing-settlement-operator-review-chain-index-recovery-guide.test.mjs",
  "tests/phase28/phase28g-foreshadowing-settlement-operator-review-chain-index-evidence-packet-export-contract.test.mjs",
  "tests/phase28/phase28h-foreshadowing-settlement-operator-review-chain-index-evidence-packet-ui-preview-contract.test.mjs",
  "tests/phase28/phase28i-foreshadowing-settlement-operator-review-chain-index-evidence-packet-bridge-preview-contract.test.mjs",
  "tests/phase28/phase28j-foreshadowing-settlement-operator-review-chain-index-evidence-packet-operator-handoff-final-smoke.test.mjs",
  "tests/phase28/phase28k-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-readiness-contract.test.mjs",
  "tests/phase28/phase28l-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-ui-preview-contract.test.mjs",
  "tests/phase28/phase28m-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-bridge-preview-contract.test.mjs",
  "tests/phase28/phase28n-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-operator-handoff-final-smoke.test.mjs",
  "tests/phase28/phase28o-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-readiness-contract.test.mjs",
  "tests/phase28/phase28p-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-final-acceptance-operator-checklist.test.mjs",
  "tests/phase28/phase28q-foreshadowing-settlement-operator-review-chain-index-evidence-packet-archive-manifest-checklist-bridge-preview-contract.test.mjs",
];

const expectedSourceChainPhases = [
  "28A",
  "28G",
  "28H",
  "28I",
  "28J",
  "28K",
  "28L",
  "28M",
  "28N",
  "28O",
  "28P",
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
];

const expectedChecklistSections = [
  "checklist_header",
  "operator_instruction",
  "source_chain",
  "retention_manifest",
  "final_acceptance_readiness_contract",
  "checklist_items",
  "blocking_conditions",
  "blocked_operator_actions",
  "safety_boundary",
  "raw_json_checklist",
  "no_mutation_snapshot",
];

const expectedChecklistItems = [
  "verify_phase_28o_readiness_contract_linked",
  "verify_source_chain_28a_to_28o_complete",
  "verify_retention_manifest_digests_visible",
  "verify_retention_manifest_digests_copyable",
  "verify_redaction_boundary_preserved",
  "verify_archive_materialization_blocked",
  "verify_final_acceptance_not_executed",
  "verify_human_approval_still_required",
  "verify_active_engine_hash_unchanged",
  "verify_compressed_rules_hash_unchanged",
  "verify_runtime_surfaces_unchanged",
  "verify_future_materialization_requires_new_phase",
];

const expectedBlockingConditions = [
  "missing_source_chain_phase",
  "missing_retention_manifest_digest",
  "digest_not_sha256_hex",
  "raw_dashboard_exposed",
  "raw_manual_review_surface_exposed",
  "archive_materialization_capability_enabled",
  "archive_write_capability_enabled",
  "approval_or_activation_capability_enabled",
  "active_engine_hash_drift",
  "compressed_rules_hash_drift",
  "runtime_surface_modified",
  "mcp_tool_added",
];

const expectedBlockedOperatorActions = [
  "complete_checklist_as_approval",
  "accept_final_archive_manifest",
  "materialize_archive_file",
  "write_archive_index",
  "write_archive_manifest",
  "approve",
  "confirm_adoption",
  "activate_engine",
  "auto_adopt",
  "auto_settle",
  "write_canon",
  "create_pending_engine_candidate",
  "update_compressed_rules",
  "restore_backup",
  "rollback",
  "modify_runtime_bridge",
  "modify_runtime_ui",
  "register_mcp_tool",
];

const expectedBridgeSections = [
  "bridge_header",
  "operator_checklist",
  "blocking_conditions",
  "blocked_operator_actions",
  "retention_manifest",
  "source_chain",
  "bridge_readability",
  "redaction_boundary",
  "raw_json_preview",
  "no_mutation_snapshot",
];

const expectedAllowedBridgeActions = [
  "read_operator_checklist_preview",
  "copy_operator_checklist_summary",
  "copy_retention_manifest_summary",
  "inspect_blocking_conditions",
  "inspect_no_mutation_snapshot",
  "inspect_raw_json_checklist",
  "open_existing_review_chain_index_route",
];

const expectedBlockedBridgeCapabilities = expectedBlockedOperatorActions;

const expectedRawJsonTopLevelKeys = [
  "bridge_kind",
  "bridge_version",
  "bridge_channel",
  "bridge_mode",
  "bridge_surface",
  "source_operator_checklist_kind",
  "source_operator_checklist_version",
  "source_operator_checklist_digest",
  "operator_checklist",
  "source_chain",
  "retention_manifest",
  "bridge_readability",
  "allowed_bridge_actions",
  "blocked_bridge_capabilities",
  "safety_boundary",
  "raw_json_preview",
  "checklist_bridge_preview_digest",
];

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function readOptionalDirectory(dirPath) {
  try {
    return (await readdir(dirPath)).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be an array.`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} item key must be a string.`);
    assert.notEqual(item.key.trim(), "", `${label} item key must not be empty.`);
    assert.equal(map.has(item.key), false, `${label} has duplicate key ${item.key}.`);
    map.set(item.key, item);
  }
  return map;
}

function buildSourceIndexSnapshot(index) {
  return {
    index_kind: index.index_kind,
    version: index.version,
    phase: index.phase,
    source_phase: index.source_phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
    headline: index.headline,
    summary: index.summary,
    status_badge: index.status_badge,
    warnings: index.warnings,
    cards: index.cards.map((card) => card.key),
    phase_rows: index.phase_rows.map((row) => row.key),
    chain_segments: index.chain_segments.map((segment) => segment.key),
    operator_entrypoints: index.operator_entrypoints.map((entrypoint) => entrypoint.key),
    prohibited_actions: index.prohibited_actions.map((action) => action.key),
    safety_boundary: index.safety,
    checks: index.checks,
    integrity: index.integrity,
  };
}

function buildPhaseDigests(index) {
  const snapshot = buildSourceIndexSnapshot(index);

  const sourceIndexDigest = stableDigest({
    index_kind: snapshot.index_kind,
    version: snapshot.version,
    phase: snapshot.phase,
    source_phase: snapshot.source_phase,
    source_phases: snapshot.source_phases,
    index_status: snapshot.index_status,
    decision: snapshot.decision,
  });

  const evidencePacketDigest = stableDigest({
    phase: "28G",
    packet_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet",
    packet_version: "phase28g_evidence_packet_export_contract_v1",
    source_index_digest: sourceIndexDigest,
    index_status: snapshot.index_status,
    decision: snapshot.decision,
    cards: snapshot.cards,
    phase_rows: snapshot.phase_rows,
    chain_segments: snapshot.chain_segments,
    operator_entrypoints: snapshot.operator_entrypoints,
    prohibited_actions: snapshot.prohibited_actions,
  });

  const uiPreviewDigest = stableDigest({
    phase: "28H",
    preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview",
    preview_version: "phase28h_evidence_packet_ui_preview_contract_v1",
    source_evidence_digest: evidencePacketDigest,
    route: "#writer-workbench",
    panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
    raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
  });

  const bridgePreviewDigest = stableDigest({
    phase: "28I",
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview",
    bridge_version: "phase28i_evidence_packet_bridge_preview_contract_v1",
    source_evidence_digest: evidencePacketDigest,
    source_ui_preview_digest: uiPreviewDigest,
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
  });

  const handoffSmokeDigest = stableDigest({
    phase: "28J",
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke",
    smoke_version: "phase28j_operator_handoff_final_smoke_v1",
    source_bridge_preview_digest: bridgePreviewDigest,
    headline: snapshot.headline,
    status_badge: snapshot.status_badge,
  });

  const archiveReadinessDigest = stableDigest({
    phase: "28K",
    archive_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_readiness",
    archive_version: "phase28k_archive_readiness_contract_v1",
    archive_mode: "archive_ready_only",
    source_handoff_smoke_digest: handoffSmokeDigest,
    ready_for_archive: true,
    archive_ready_only: true,
    read_only: true,
    preview_only: true,
  });

  const retentionManifest = {
    source_index_digest: sourceIndexDigest,
    evidence_packet_digest: evidencePacketDigest,
    ui_preview_digest: uiPreviewDigest,
    bridge_preview_digest: bridgePreviewDigest,
    handoff_smoke_digest: handoffSmokeDigest,
    archive_readiness_digest: archiveReadinessDigest,
  };

  const manifestRows = Object.entries(retentionManifest).map(([key, digest], order) => ({
    key,
    label: key.replaceAll("_", " "),
    digest,
    source_phase: {
      source_index_digest: "28A",
      evidence_packet_digest: "28G",
      ui_preview_digest: "28H",
      bridge_preview_digest: "28I",
      handoff_smoke_digest: "28J",
      archive_readiness_digest: "28K",
    }[key],
    order,
    visible: true,
    copyable: true,
    verified: /^[a-f0-9]{64}$/u.test(digest),
    retained: true,
  }));

  const manifestUiPreviewDigest = stableDigest({
    phase: "28L",
    preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
    preview_version: "phase28l_archive_manifest_ui_preview_contract_v1",
    source_archive_readiness_digest: archiveReadinessDigest,
    retention_manifest: retentionManifest,
    manifest_rows: manifestRows.map((row) => ({
      key: row.key,
      digest: row.digest,
      source_phase: row.source_phase,
      verified: row.verified,
    })),
  });

  const archiveManifestBridgePreviewDigest = stableDigest({
    phase: "28M",
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
    bridge_version: "phase28m_archive_manifest_bridge_preview_contract_v1",
    source_manifest_preview_digest: manifestUiPreviewDigest,
    source_archive_readiness_digest: archiveReadinessDigest,
    source_bridge_preview_digest: bridgePreviewDigest,
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
  });

  const operatorHandoffSmokeDigest = stableDigest({
    phase: "28N",
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
    smoke_version: "phase28n_archive_manifest_operator_handoff_final_smoke_v1",
    smoke_mode: "operator_handoff_final_smoke_only",
    source_bridge_preview_digest: archiveManifestBridgePreviewDigest,
    source_manifest_preview_digest: manifestUiPreviewDigest,
    source_archive_readiness_digest: archiveReadinessDigest,
    read_only: true,
    preview_only: true,
    operator_handoff_only: true,
    final_smoke_only: true,
  });

  const finalAcceptanceReadinessDigest = stableDigest({
    phase: "28O",
    acceptance_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_readiness",
    acceptance_version: "phase28o_archive_manifest_final_acceptance_readiness_contract_v1",
    acceptance_mode: "final_acceptance_readiness_only",
    source_operator_handoff_smoke_digest: operatorHandoffSmokeDigest,
    source_bridge_preview_digest: archiveManifestBridgePreviewDigest,
    source_manifest_preview_digest: manifestUiPreviewDigest,
    source_archive_readiness_digest: archiveReadinessDigest,
    ready_for_final_acceptance_review: true,
    ready_for_future_archive_materialization_review: true,
    not_ready_to_materialize_archive: true,
    read_only: true,
    contract_only: true,
    readiness_only: true,
    final_acceptance_readiness_only: true,
  });

  const sourceChain = [
    {
      key: "28A",
      phase: "28A",
      kind: snapshot.index_kind,
      version: snapshot.version,
      digest_key: "source_index_digest",
      digest: sourceIndexDigest,
    },
    {
      key: "28G",
      phase: "28G",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet",
      version: "phase28g_evidence_packet_export_contract_v1",
      digest_key: "evidence_packet_digest",
      digest: evidencePacketDigest,
    },
    {
      key: "28H",
      phase: "28H",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview",
      version: "phase28h_evidence_packet_ui_preview_contract_v1",
      digest_key: "ui_preview_digest",
      digest: uiPreviewDigest,
    },
    {
      key: "28I",
      phase: "28I",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview",
      version: "phase28i_evidence_packet_bridge_preview_contract_v1",
      digest_key: "bridge_preview_digest",
      digest: bridgePreviewDigest,
    },
    {
      key: "28J",
      phase: "28J",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke",
      version: "phase28j_operator_handoff_final_smoke_v1",
      digest_key: "handoff_smoke_digest",
      digest: handoffSmokeDigest,
    },
    {
      key: "28K",
      phase: "28K",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_readiness",
      version: "phase28k_archive_readiness_contract_v1",
      digest_key: "archive_readiness_digest",
      digest: archiveReadinessDigest,
    },
    {
      key: "28L",
      phase: "28L",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
      version: "phase28l_archive_manifest_ui_preview_contract_v1",
      digest_key: "manifest_ui_preview_digest",
      digest: manifestUiPreviewDigest,
    },
    {
      key: "28M",
      phase: "28M",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
      version: "phase28m_archive_manifest_bridge_preview_contract_v1",
      digest_key: "archive_manifest_bridge_preview_digest",
      digest: archiveManifestBridgePreviewDigest,
    },
    {
      key: "28N",
      phase: "28N",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
      version: "phase28n_archive_manifest_operator_handoff_final_smoke_v1",
      digest_key: "operator_handoff_smoke_digest",
      digest: operatorHandoffSmokeDigest,
    },
    {
      key: "28O",
      phase: "28O",
      kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_readiness",
      version: "phase28o_archive_manifest_final_acceptance_readiness_contract_v1",
      digest_key: "final_acceptance_readiness_digest",
      digest: finalAcceptanceReadinessDigest,
    },
  ];

  return {
    snapshot,
    sourceChain,
    retentionManifest,
    manifestRows,
    sourceIndexDigest,
    finalAcceptanceReadinessDigest,
    operatorHandoffSmokeDigest,
    archiveManifestBridgePreviewDigest,
    manifestUiPreviewDigest,
    archiveReadinessDigest,
  };
}

function buildArchiveManifestFinalAcceptanceOperatorChecklist(index) {
  const digests = buildPhaseDigests(index);
  const checklistItems = expectedChecklistItems.map((key, order) => ({
    key,
    order,
    label: key.replaceAll("_", " "),
    required: true,
    operator_visible: true,
    checked_by_contract: true,
    checklist_only: true,
    cannot_execute: true,
    evidence_required: true,
    blocking_if_failed: true,
    reason: `${key} must be reviewed by the operator before any later archive materialization phase can be proposed.`,
  }));

  const blockingConditions = expectedBlockingConditions.map((key, order) => ({
    key,
    order,
    blocks_final_acceptance_review: true,
    blocks_future_materialization: true,
    requires_new_patch: true,
    reason: `${key} blocks Phase 28P checklist readiness.`,
  }));

  const checklistPayload = {
    checklist_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_operator_checklist",
    checklist_version: "phase28p_archive_manifest_final_acceptance_operator_checklist_v1",
    checklist_mode: "operator_checklist_only",
    generated_for: "pre_archive_materialization_operator_checklist_review",
    source_final_acceptance_readiness_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_readiness",
    source_final_acceptance_readiness_version: "phase28o_archive_manifest_final_acceptance_readiness_contract_v1",
    source_final_acceptance_readiness_digest: digests.finalAcceptanceReadinessDigest,
    source_operator_handoff_smoke_digest: digests.operatorHandoffSmokeDigest,
    source_bridge_preview_digest: digests.archiveManifestBridgePreviewDigest,
    source_manifest_preview_digest: digests.manifestUiPreviewDigest,
    source_archive_readiness_digest: digests.archiveReadinessDigest,
    source_index_digest: digests.sourceIndexDigest,
    source_index_kind: digests.snapshot.index_kind,
    source_index_version: digests.snapshot.version,
    source_index_phase: digests.snapshot.phase,
    source_phase: digests.snapshot.source_phase,
    source_phases: digests.snapshot.source_phases,
    index_status: digests.snapshot.index_status,
    decision: digests.snapshot.decision,
    headline: digests.snapshot.headline,
    summary: digests.snapshot.summary,
    status_badge: digests.snapshot.status_badge,
    warnings: digests.snapshot.warnings,
    ready_for_operator_checklist_review: true,
    ready_for_final_acceptance_review: true,
    ready_for_future_archive_materialization_review: true,
    not_ready_to_materialize_archive: true,
    checklist_completed_by_contract: false,
    checklist_completion_is_approval: false,
    read_only: true,
    contract_only: true,
    checklist_only: true,
    operator_checklist_only: true,
    preview_only: true,
    archive_materialization_blocked: true,
    retention_manifest_only: true,
    raw_json_checklist_only: true,
    can_complete_checklist_as_approval: false,
    can_accept_final_archive_manifest: false,
    can_archive_materialize_file: false,
    can_write_archive_index: false,
    can_write_archive_manifest: false,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    can_write_canon: false,
    can_create_pending_engine_candidate: false,
    can_update_compressed_rules: false,
    can_restore_backup: false,
    can_rollback: false,
    can_modify_runtime_bridge: false,
    can_modify_runtime_ui: false,
    can_register_mcp_tool: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    future_archive_materialization_requires_new_phase: true,
    source_chain: digests.sourceChain,
    retention_manifest: digests.retentionManifest,
    manifest_rows: digests.manifestRows,
    operator_instruction: {
      key: "operator_final_acceptance_checklist_instruction",
      headline: "Archive manifest final acceptance operator checklist",
      summary: [
        "Phase 28P provides a read-only operator checklist for reviewing Phase 28O final acceptance readiness.",
        "Completing or reading this checklist is not an approval, not final acceptance execution, and not archive materialization.",
        "Any future archive materialization must be introduced by a later explicit phase with a separate confirmation boundary.",
      ].join(" "),
      route: "#writer-workbench",
      source_final_acceptance_readiness_digest: digests.finalAcceptanceReadinessDigest,
      source_operator_handoff_smoke_digest: digests.operatorHandoffSmokeDigest,
      decision: digests.snapshot.decision,
      status_badge: digests.snapshot.status_badge,
    },
    checklist_cards: [
      {
        key: "checklist_status",
        title: "Operator checklist",
        value: "ready for read-only checklist review",
        tone: "safe",
      },
      {
        key: "source_readiness",
        title: "Source readiness",
        value: "Phase 28O final acceptance readiness linked",
        tone: "safe",
      },
      {
        key: "source_chain",
        title: "Source chain",
        value: `${digests.sourceChain.length} source-chain phases linked`,
        tone: "safe",
      },
      {
        key: "checklist_items",
        title: "Checklist items",
        value: `${checklistItems.length} required items visible`,
        tone: "safe",
      },
      {
        key: "blocking_conditions",
        title: "Blocking conditions",
        value: `${blockingConditions.length} blockers defined`,
        tone: "blocked",
      },
      {
        key: "blocked_actions",
        title: "Blocked actions",
        value: `${expectedBlockedOperatorActions.length} execution capabilities blocked`,
        tone: "blocked",
      },
    ],
    checklist_items: checklistItems,
    blocking_conditions: blockingConditions,
    blocked_operator_actions: expectedBlockedOperatorActions.map((key) => ({
      key,
      allowed: false,
      enabled: false,
      reason: `${key} is blocked because Phase 28P is an operator checklist contract, not an execution phase.`,
    })),
    required_sections: expectedChecklistSections,
    redaction_boundary: {
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      checklist_contains_raw_dashboard: false,
      checklist_contains_raw_manual_review_surface: false,
      checklist_contains_unredacted_sources: false,
    },
    safety_boundary: {
      read_only: true,
      contract_only: true,
      checklist_only: true,
      operator_checklist_only: true,
      preview_only: true,
      archive_materialization_blocked: true,
      retention_manifest_only: true,
      raw_json_checklist_only: true,
      can_complete_checklist_as_approval: false,
      can_accept_final_archive_manifest: false,
      can_archive_materialize_file: false,
      can_write_archive_index: false,
      can_write_archive_manifest: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_activate_engine: false,
      can_auto_adopt: false,
      can_auto_settle: false,
      can_write_canon: false,
      can_create_pending_engine_candidate: false,
      can_update_compressed_rules: false,
      can_restore_backup: false,
      can_rollback: false,
      can_modify_runtime_bridge: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      pending_engine_candidate_created: false,
      settlement_context_created: false,
      settlement_report_created: false,
      approval_item_created: false,
      backup_created: false,
      export_created: false,
      restore_preview_created: false,
      archive_file_created: false,
      archive_index_written: false,
      archive_manifest_written: false,
      runtime_ui_modified: false,
      runtime_service_modified: false,
      runtime_bridge_modified: false,
      mcp_tool_added: false,
      bridge_tool_added: false,
      canon_written: false,
    },
    raw_json_checklist: {
      available: true,
      safe_to_display: true,
      element_kind: "pre_json",
      content_type: "application/json",
      pretty_print_required: true,
      copyable: true,
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
    },
    counts: {
      source_chain: digests.sourceChain.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: digests.manifestRows.length,
      checklist_sections: expectedChecklistSections.length,
      checklist_cards: 6,
      checklist_items: checklistItems.length,
      blocking_conditions: blockingConditions.length,
      blocked_operator_actions: expectedBlockedOperatorActions.length,
      source_phase_rows: digests.snapshot.phase_rows.length,
      source_chain_segments: digests.snapshot.chain_segments.length,
      source_operator_entrypoints: digests.snapshot.operator_entrypoints.length,
      source_prohibited_actions: digests.snapshot.prohibited_actions.length,
    },
  };

  return {
    ...checklistPayload,
    operator_checklist_digest: stableDigest(checklistPayload),
  };
}

function buildArchiveManifestChecklistBridgePreviewContract(index) {
  const checklist = buildArchiveManifestFinalAcceptanceOperatorChecklist(index);
  const bridgeSourceChain = [
    ...checklist.source_chain,
    {
      key: "28P",
      phase: "28P",
      kind: checklist.checklist_kind,
      version: checklist.checklist_version,
      digest_key: "operator_checklist_digest",
      digest: checklist.operator_checklist_digest,
    },
  ];

  const bridgePayload = {
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview",
    bridge_version: "phase28q_archive_manifest_checklist_bridge_preview_contract_v1",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
    bridge_surface: "archive_manifest_operator_checklist_bridge_preview",
    generated_for: "chatgpt_bridge_readable_archive_manifest_operator_checklist_handoff",
    source_operator_checklist_kind: checklist.checklist_kind,
    source_operator_checklist_version: checklist.checklist_version,
    source_operator_checklist_digest: checklist.operator_checklist_digest,
    source_final_acceptance_readiness_digest: checklist.source_final_acceptance_readiness_digest,
    source_operator_handoff_smoke_digest: checklist.source_operator_handoff_smoke_digest,
    source_archive_manifest_bridge_preview_digest: checklist.source_bridge_preview_digest,
    source_manifest_preview_digest: checklist.source_manifest_preview_digest,
    source_archive_readiness_digest: checklist.source_archive_readiness_digest,
    source_index_digest: checklist.source_index_digest,
    source_index_kind: checklist.source_index_kind,
    source_index_version: checklist.source_index_version,
    source_index_phase: checklist.source_index_phase,
    source_phase: checklist.source_phase,
    source_phases: checklist.source_phases,
    index_status: checklist.index_status,
    decision: checklist.decision,
    headline: checklist.headline,
    summary: checklist.summary,
    status_badge: checklist.status_badge,
    warnings: checklist.warnings,
    read_only: true,
    contract_only: true,
    preview_only: true,
    bridge_preview_only: true,
    checklist_bridge_preview_only: true,
    checklist_only: true,
    operator_checklist_only: true,
    archive_materialization_blocked: true,
    retention_manifest_only: true,
    raw_json_preview_only: true,
    raw_json_checklist_visible: true,
      requires_human_approval: true,
      requires_operator_confirmation: true,
      future_archive_materialization_requires_new_phase: true,
    can_complete_checklist_as_approval: false,
    can_accept_final_archive_manifest: false,
    can_archive_materialize_file: false,
    can_write_archive_index: false,
    can_write_archive_manifest: false,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    can_write_canon: false,
    can_create_pending_engine_candidate: false,
    can_update_compressed_rules: false,
    can_restore_backup: false,
    can_rollback: false,
    can_modify_runtime_bridge: false,
    can_modify_runtime_ui: false,
    can_register_mcp_tool: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    future_archive_materialization_requires_new_phase: true,
    source_chain: bridgeSourceChain,
    retention_manifest: checklist.retention_manifest,
    manifest_rows: checklist.manifest_rows,
    operator_checklist: {
      checklist_kind: checklist.checklist_kind,
      checklist_version: checklist.checklist_version,
      checklist_mode: checklist.checklist_mode,
      operator_checklist_digest: checklist.operator_checklist_digest,
      source_final_acceptance_readiness_digest: checklist.source_final_acceptance_readiness_digest,
      operator_instruction: checklist.operator_instruction,
      checklist_cards: checklist.checklist_cards,
      checklist_items: checklist.checklist_items,
      blocking_conditions: checklist.blocking_conditions,
      blocked_operator_actions: checklist.blocked_operator_actions,
      required_sections: checklist.required_sections,
      raw_json_checklist: checklist.raw_json_checklist,
      safety_boundary: checklist.safety_boundary,
      no_mutation_snapshot: checklist.no_mutation_snapshot,
      counts: checklist.counts,
    },
    bridge_cards: [
      {
        key: "bridge_status",
        title: "Checklist bridge preview",
        value: "ready for read-only ChatGPT bridge preview",
        tone: "safe",
      },
      {
        key: "source_operator_checklist",
        title: "Source operator checklist",
        value: "Phase 28P operator checklist digest linked",
        tone: "safe",
      },
      {
        key: "source_chain",
        title: "Source chain",
        value: `${bridgeSourceChain.length} source-chain phases linked`,
        tone: "safe",
      },
      {
        key: "retention_manifest",
        title: "Retention manifest",
        value: `${checklist.manifest_rows.length} retained digest entries visible`,
        tone: "safe",
      },
      {
        key: "blocking_conditions",
        title: "Blocking conditions",
        value: `${checklist.blocking_conditions.length} blockers displayed`,
        tone: "blocked",
      },
      {
        key: "blocked_capabilities",
        title: "Blocked capabilities",
        value: `${expectedBlockedBridgeCapabilities.length} bridge capabilities blocked`,
        tone: "blocked",
      },
    ],
    bridge_readability: {
      markdown_summary: [
        `# ${checklist.operator_instruction.headline}`,
        "",
        checklist.operator_instruction.summary,
        "",
        `Checklist digest: ${checklist.operator_checklist_digest}`,
        `Final acceptance readiness digest: ${checklist.source_final_acceptance_readiness_digest}`,
        `Source chain: ${bridgeSourceChain.map((item) => item.phase).join(" → ")}`,
        "",
        "This checklist bridge preview is read-only / preview-only and is not an approval, not final acceptance execution, and not archive materialization.",
        "It can display the operator checklist, blocking conditions, blocked operator actions, retention manifest, source chain, raw JSON checklist, and no-mutation snapshot only.",
        "It cannot materialize archives, write archive indexes or manifests, approve, adopt, settle, activate engine, write Canon, update compressed_rules, modify runtime bridge/UI, or register MCP tools.",
      ].join("\n"),
      digest_table: bridgeSourceChain.map((item) => ({
        key: item.key,
        phase: item.phase,
        digest_key: item.digest_key,
        digest: item.digest,
        verified: /^[a-f0-9]{64}$/u.test(item.digest),
        copyable: true,
      })),
      checklist_table: checklist.checklist_items.map((item) => ({
        key: item.key,
        order: item.order,
        required: item.required,
        operator_visible: item.operator_visible,
        cannot_execute: item.cannot_execute,
        blocking_if_failed: item.blocking_if_failed,
      })),
      blocker_table: checklist.blocking_conditions.map((condition) => ({
        key: condition.key,
        order: condition.order,
        blocks_final_acceptance_review: condition.blocks_final_acceptance_review,
        blocks_future_materialization: condition.blocks_future_materialization,
        requires_new_patch: condition.requires_new_patch,
      })),
      compact_cards: [
        {
          key: "checklist_bridge_preview",
          title: "Checklist Bridge Preview",
          value: "safe to show in ChatGPT bridge as read-only checklist context",
          tone: "safe",
        },
        {
          key: "no_execution_surface",
          title: "No Execution Surface",
          value: "all approval, archive, adoption, engine, Canon, runtime, and MCP actions remain blocked",
          tone: "blocked",
        },
      ],
    },
    ui_preview_route: {
      route: "#writer-workbench",
      data_view: "writer-workbench",
      existing_panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
      existing_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
      no_new_ui_route_required: true,
      no_runtime_ui_change_required: true,
    },
    allowed_bridge_actions: expectedAllowedBridgeActions.map((key) => ({
      key,
      allowed: true,
      read_only: true,
      preview_only: true,
      reason: `${key} is allowed only as a read-only Phase 28Q checklist bridge preview action.`,
    })),
    blocked_bridge_capabilities: expectedBlockedBridgeCapabilities.map((key) => ({
      key,
      allowed: false,
      enabled: false,
      reason: `${key} is blocked because Phase 28Q is a read-only checklist bridge preview contract, not an execution surface.`,
    })),
    required_sections: expectedBridgeSections,
    redaction_boundary: {
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      bridge_contains_raw_dashboard: false,
      bridge_contains_raw_manual_review_surface: false,
      bridge_contains_unredacted_sources: false,
      checklist_contains_raw_dashboard: false,
      checklist_contains_raw_manual_review_surface: false,
      checklist_contains_unredacted_sources: false,
    },
    safety_boundary: {
      read_only: true,
      contract_only: true,
      preview_only: true,
      bridge_preview_only: true,
      checklist_bridge_preview_only: true,
      checklist_only: true,
      operator_checklist_only: true,
      archive_materialization_blocked: true,
      retention_manifest_only: true,
      raw_json_preview_only: true,
      raw_json_checklist_visible: true,
      requires_human_approval: true,
      requires_operator_confirmation: true,
      future_archive_materialization_requires_new_phase: true,
      can_complete_checklist_as_approval: false,
      can_accept_final_archive_manifest: false,
      can_archive_materialize_file: false,
      can_write_archive_index: false,
      can_write_archive_manifest: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_activate_engine: false,
      can_auto_adopt: false,
      can_auto_settle: false,
      can_write_canon: false,
      can_create_pending_engine_candidate: false,
      can_update_compressed_rules: false,
      can_restore_backup: false,
      can_rollback: false,
      can_modify_runtime_bridge: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
    },
    no_mutation_snapshot: checklist.no_mutation_snapshot,
    raw_json_preview: {
      available: true,
      safe_to_display: true,
      element_kind: "pre_json",
      content_type: "application/json",
      pretty_print_required: true,
      copyable: true,
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      source_raw_json_checklist_available: checklist.raw_json_checklist.available,
      required_top_level_keys: expectedRawJsonTopLevelKeys,
    },
    counts: {
      source_chain: bridgeSourceChain.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: checklist.manifest_rows.length,
      bridge_sections: expectedBridgeSections.length,
      bridge_cards: 6,
      allowed_bridge_actions: expectedAllowedBridgeActions.length,
      blocked_bridge_capabilities: expectedBlockedBridgeCapabilities.length,
      checklist_cards: checklist.checklist_cards.length,
      checklist_items: checklist.checklist_items.length,
      blocking_conditions: checklist.blocking_conditions.length,
      blocked_operator_actions: checklist.blocked_operator_actions.length,
      source_phase_rows: checklist.counts.source_phase_rows,
      source_chain_segments: checklist.counts.source_chain_segments,
      source_operator_entrypoints: checklist.counts.source_operator_entrypoints,
      source_prohibited_actions: checklist.counts.source_prohibited_actions,
    },
  };

  return {
    ...bridgePayload,
    checklist_bridge_preview_digest: stableDigest(bridgePayload),
  };
}

function assertRunAllOrder(runAllText) {
  for (const registration of expectedRunAllRegistrations) {
    assert(runAllText.includes(registration), `run-all missing ${registration}.`);
  }

  for (let index = 1; index < expectedRunAllRegistrations.length; index += 1) {
    assert(
      runAllText.indexOf(expectedRunAllRegistrations[index - 1])
        < runAllText.indexOf(expectedRunAllRegistrations[index]),
      `run-all should execute ${expectedRunAllRegistrations[index - 1]} before ${expectedRunAllRegistrations[index]}.`,
    );
  }

  assert(
    runAllText.indexOf(expectedRunAllRegistrations.at(-1))
      < runAllText.indexOf("tests/scripts/daily-scripts.test.mjs"),
    "run-all should execute Phase 28Q before Daily scripts and docs.",
  );
}

function assertStaticSourceTokens({ serviceText, uiIndexText, uiAppText }) {
  for (const token of [
    "chain_segments",
    "phase_rows",
    "cards",
    "operator_entrypoints",
    "prohibited_actions",
    "safety",
    "checks",
    "integrity",
    "index_markdown",
  ]) {
    assert(serviceText.includes(token), `28Q service missing checklist bridge source token: ${token}`);
  }

  for (const token of [
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "foreshadowing-settlement-operator-review-chain-index-surface-raw",
    "Chain segments",
    "Indexed phases",
    "Operator entrypoints",
    "Prohibited actions",
    "Safety boundary",
  ]) {
    assert(uiIndexText.includes(token), `28Q existing UI HTML missing checklist bridge source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28Q existing app.js missing checklist bridge source token: ${token}`);
  }
}

function assertArchiveManifestChecklistBridgePreviewContract(preview) {
  assert.equal(
    preview.bridge_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_checklist_bridge_preview",
    "28Q bridge kind drifted.",
  );
  assert.equal(preview.bridge_version, "phase28q_archive_manifest_checklist_bridge_preview_contract_v1", "28Q bridge version drifted.");
  assert.equal(preview.bridge_channel, "chatgpt_bridge", "28Q bridge channel drifted.");
  assert.equal(preview.bridge_mode, "readonly_preview", "28Q bridge mode drifted.");
  assert.equal(preview.bridge_surface, "archive_manifest_operator_checklist_bridge_preview", "28Q bridge surface drifted.");
  assert.equal(preview.generated_for, "chatgpt_bridge_readable_archive_manifest_operator_checklist_handoff", "28Q generated_for drifted.");

  assert.equal(
    preview.source_operator_checklist_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_operator_checklist",
    "28Q source operator checklist kind drifted.",
  );
  assert.equal(
    preview.source_operator_checklist_version,
    "phase28p_archive_manifest_final_acceptance_operator_checklist_v1",
    "28Q source operator checklist version drifted.",
  );

  for (const key of [
    "source_operator_checklist_digest",
    "source_final_acceptance_readiness_digest",
    "source_operator_handoff_smoke_digest",
    "source_archive_manifest_bridge_preview_digest",
    "source_manifest_preview_digest",
    "source_archive_readiness_digest",
    "source_index_digest",
    "checklist_bridge_preview_digest",
  ]) {
    assert.match(preview[key], /^[a-f0-9]{64}$/u, `28Q ${key} should be sha256 hex.`);
  }

  for (const key of [
    "read_only",
    "contract_only",
    "preview_only",
    "bridge_preview_only",
    "checklist_bridge_preview_only",
    "checklist_only",
    "operator_checklist_only",
    "archive_materialization_blocked",
    "retention_manifest_only",
    "raw_json_preview_only",
    "raw_json_checklist_visible",
    "requires_human_approval",
    "requires_operator_confirmation",
    "future_archive_materialization_requires_new_phase",
  ]) {
    assert.equal(preview[key], true, `28Q ${key} must remain true.`);
    assert.equal(preview.safety_boundary[key], true, `28Q safety boundary ${key} must remain true.`);
  }

  for (const key of expectedBlockedBridgeCapabilities) {
    const capabilityKey = key === "materialize_archive_file" ? "can_archive_materialize_file" : `can_${key}`;
    if (Object.prototype.hasOwnProperty.call(preview, capabilityKey)) {
      assert.equal(preview[capabilityKey], false, `28Q ${capabilityKey} must remain false.`);
      assert.equal(preview.safety_boundary[capabilityKey], false, `28Q safety boundary ${capabilityKey} must remain false.`);
    }
  }

  for (const key of [
    "can_complete_checklist_as_approval",
    "can_accept_final_archive_manifest",
    "can_archive_materialize_file",
    "can_write_archive_index",
    "can_write_archive_manifest",
    "can_approve",
    "can_confirm_adoption",
    "can_activate_engine",
    "can_auto_adopt",
    "can_auto_settle",
    "can_write_canon",
    "can_create_pending_engine_candidate",
    "can_update_compressed_rules",
    "can_restore_backup",
    "can_rollback",
    "can_modify_runtime_bridge",
    "can_modify_runtime_ui",
    "can_register_mcp_tool",
  ]) {
    assert.equal(preview[key], false, `28Q ${key} must remain false.`);
    assert.equal(preview.safety_boundary[key], false, `28Q safety boundary ${key} must remain false.`);
  }

  const sourceChain = keyed(preview.source_chain, "28Q source chain");
  assert.deepEqual([...sourceChain.keys()], expectedSourceChainPhases, "28Q source chain phase order drifted.");
  for (const item of sourceChain.values()) {
    assert.equal(item.key, item.phase, `${item.phase} key should match phase.`);
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
    assert.equal(typeof item.kind, "string", `${item.phase} kind must be a string.`);
    assert.equal(typeof item.version, "string", `${item.phase} version must be a string.`);
    assert.equal(typeof item.digest_key, "string", `${item.phase} digest key must be a string.`);
  }

  assert.equal(sourceChain.get("28P").digest, preview.source_operator_checklist_digest, "28Q source chain 28P digest should match checklist digest.");
  assert.equal(sourceChain.get("28O").digest, preview.source_final_acceptance_readiness_digest, "28Q source chain 28O digest should match final readiness digest.");
  assert.equal(sourceChain.get("28N").digest, preview.source_operator_handoff_smoke_digest, "28Q source chain 28N digest should match handoff digest.");
  assert.equal(sourceChain.get("28M").digest, preview.source_archive_manifest_bridge_preview_digest, "28Q source chain 28M digest should match archive manifest bridge digest.");
  assert.equal(sourceChain.get("28L").digest, preview.source_manifest_preview_digest, "28Q source chain 28L digest should match manifest preview digest.");
  assert.equal(sourceChain.get("28K").digest, preview.source_archive_readiness_digest, "28Q source chain 28K digest should match archive readiness digest.");
  assert.equal(sourceChain.get("28A").digest, preview.source_index_digest, "28Q source chain 28A digest should match source index digest.");

  assert.deepEqual(Object.keys(preview.retention_manifest), expectedRetentionManifestKeys, "28Q retention manifest keys drifted.");
  const manifestRows = keyed(preview.manifest_rows, "28Q manifest rows");
  assert.deepEqual([...manifestRows.keys()], expectedRetentionManifestKeys, "28Q manifest row order drifted.");
  for (const [index, row] of [...manifestRows.values()].entries()) {
    assert.equal(row.order, index, `${row.key} order drifted.`);
    assert.equal(row.visible, true, `${row.key} should be visible.`);
    assert.equal(row.copyable, true, `${row.key} should be copyable.`);
    assert.equal(row.verified, true, `${row.key} should be verified.`);
    assert.equal(row.retained, true, `${row.key} should be retained.`);
    assert.equal(row.digest, preview.retention_manifest[row.key], `${row.key} digest should match retention manifest.`);
  }

  assert.equal(preview.operator_checklist.checklist_kind, preview.source_operator_checklist_kind, "28Q embedded checklist kind drifted.");
  assert.equal(preview.operator_checklist.checklist_version, preview.source_operator_checklist_version, "28Q embedded checklist version drifted.");
  assert.equal(preview.operator_checklist.operator_checklist_digest, preview.source_operator_checklist_digest, "28Q embedded checklist digest drifted.");
  assert.equal(preview.operator_checklist.source_final_acceptance_readiness_digest, preview.source_final_acceptance_readiness_digest, "28Q embedded checklist final readiness digest drifted.");
  assert(preview.operator_checklist.operator_instruction.summary.includes("not an approval"), "28Q embedded instruction must preserve no-approval warning.");
  assert(preview.operator_checklist.operator_instruction.summary.includes("not archive materialization"), "28Q embedded instruction must preserve no-materialization warning.");

  const checklistCards = keyed(preview.operator_checklist.checklist_cards, "28Q embedded checklist cards");
  assert.deepEqual(
    [...checklistCards.keys()],
    [
      "checklist_status",
      "source_readiness",
      "source_chain",
      "checklist_items",
      "blocking_conditions",
      "blocked_actions",
    ],
    "28Q embedded checklist card order drifted.",
  );

  const checklistItems = keyed(preview.operator_checklist.checklist_items, "28Q embedded checklist items");
  assert.deepEqual([...checklistItems.keys()], expectedChecklistItems, "28Q embedded checklist item order drifted.");
  for (const item of checklistItems.values()) {
    assert.equal(item.required, true, `${item.key} should be required.`);
    assert.equal(item.operator_visible, true, `${item.key} should be operator visible.`);
    assert.equal(item.cannot_execute, true, `${item.key} should not execute.`);
    assert.equal(item.blocking_if_failed, true, `${item.key} should block if failed.`);
  }

  const blockingConditions = keyed(preview.operator_checklist.blocking_conditions, "28Q embedded blocking conditions");
  assert.deepEqual([...blockingConditions.keys()], expectedBlockingConditions, "28Q embedded blocking condition order drifted.");
  for (const condition of blockingConditions.values()) {
    assert.equal(condition.blocks_final_acceptance_review, true, `${condition.key} should block final acceptance review.`);
    assert.equal(condition.blocks_future_materialization, true, `${condition.key} should block future materialization.`);
    assert.equal(condition.requires_new_patch, true, `${condition.key} should require new patch.`);
  }

  const blockedOperatorActions = keyed(preview.operator_checklist.blocked_operator_actions, "28Q embedded blocked operator actions");
  assert.deepEqual([...blockedOperatorActions.keys()], expectedBlockedOperatorActions, "28Q embedded blocked operator action order drifted.");
  for (const action of blockedOperatorActions.values()) {
    assert.equal(action.allowed, false, `${action.key} must not be allowed.`);
    assert.equal(action.enabled, false, `${action.key} must not be enabled.`);
  }

  assert.deepEqual(preview.operator_checklist.required_sections, expectedChecklistSections, "28Q embedded checklist sections drifted.");

  const bridgeCards = keyed(preview.bridge_cards, "28Q bridge cards");
  assert.deepEqual(
    [...bridgeCards.keys()],
    [
      "bridge_status",
      "source_operator_checklist",
      "source_chain",
      "retention_manifest",
      "blocking_conditions",
      "blocked_capabilities",
    ],
    "28Q bridge card order drifted.",
  );

  assert.equal(typeof preview.bridge_readability.markdown_summary, "string", "28Q markdown summary should be a string.");
  assert(preview.bridge_readability.markdown_summary.includes("read-only / preview-only"), "28Q markdown summary should preserve read-only / preview-only warning.");
  assert(preview.bridge_readability.markdown_summary.includes("not an approval"), "28Q markdown summary should preserve no-approval warning.");
  assert(preview.bridge_readability.markdown_summary.includes("cannot materialize archives"), "28Q markdown summary should preserve materialization warning.");
  assert.equal(preview.bridge_readability.digest_table.length, expectedSourceChainPhases.length, "28Q digest table count drifted.");
  assert.equal(preview.bridge_readability.checklist_table.length, expectedChecklistItems.length, "28Q checklist table count drifted.");
  assert.equal(preview.bridge_readability.blocker_table.length, expectedBlockingConditions.length, "28Q blocker table count drifted.");

  const allowedActions = keyed(preview.allowed_bridge_actions, "28Q allowed bridge actions");
  assert.deepEqual([...allowedActions.keys()], expectedAllowedBridgeActions, "28Q allowed bridge action order drifted.");
  for (const action of allowedActions.values()) {
    assert.equal(action.allowed, true, `${action.key} should remain allowed as a read-only bridge action.`);
    assert.equal(action.read_only, true, `${action.key} should remain read-only.`);
    assert.equal(action.preview_only, true, `${action.key} should remain preview-only.`);
    assert(action.reason.includes("read-only"), `${action.key} reason should preserve read-only warning.`);
  }

  const blockedCapabilities = keyed(preview.blocked_bridge_capabilities, "28Q blocked bridge capabilities");
  assert.deepEqual([...blockedCapabilities.keys()], expectedBlockedBridgeCapabilities, "28Q blocked capability order drifted.");
  for (const capability of blockedCapabilities.values()) {
    assert.equal(capability.allowed, false, `${capability.key} must not be allowed.`);
    assert.equal(capability.enabled, false, `${capability.key} must not be enabled.`);
    assert(capability.reason.includes("not an execution surface"), `${capability.key} reason should preserve execution-surface warning.`);
  }

  assert.deepEqual(preview.required_sections, expectedBridgeSections, "28Q bridge section order drifted.");

  assert.equal(preview.ui_preview_route.route, "#writer-workbench", "28Q route drifted.");
  assert.equal(preview.ui_preview_route.data_view, "writer-workbench", "28Q data view drifted.");
  assert.equal(preview.ui_preview_route.no_new_ui_route_required, true, "28Q should not require a new UI route.");
  assert.equal(preview.ui_preview_route.no_runtime_ui_change_required, true, "28Q should not require runtime UI changes.");

  assert.equal(preview.redaction_boundary.redacted_raw_sources, true, "28Q should preserve redacted raw sources.");
  assert.equal(preview.redaction_boundary.contains_raw_dashboard, false, "28Q should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.contains_raw_manual_review_surface, false, "28Q should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.contains_unredacted_sources, false, "28Q should not contain unredacted sources.");
  assert.equal(preview.redaction_boundary.bridge_contains_raw_dashboard, false, "28Q bridge should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.bridge_contains_raw_manual_review_surface, false, "28Q bridge should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.bridge_contains_unredacted_sources, false, "28Q bridge should not contain unredacted sources.");

  assert.equal(preview.raw_json_preview.available, true, "28Q raw JSON preview should be available.");
  assert.equal(preview.raw_json_preview.safe_to_display, true, "28Q raw JSON preview should be safe to display.");
  assert.equal(preview.raw_json_preview.element_kind, "pre_json", "28Q raw JSON element kind drifted.");
  assert.equal(preview.raw_json_preview.content_type, "application/json", "28Q raw JSON content type drifted.");
  assert.equal(preview.raw_json_preview.pretty_print_required, true, "28Q raw JSON should require pretty print.");
  assert.equal(preview.raw_json_preview.copyable, true, "28Q raw JSON should be copyable.");
  assert.equal(preview.raw_json_preview.redacted_raw_sources, true, "28Q raw JSON should preserve redaction.");
  assert.equal(preview.raw_json_preview.contains_raw_dashboard, false, "28Q raw JSON must not contain raw dashboard.");
  assert.equal(preview.raw_json_preview.contains_raw_manual_review_surface, false, "28Q raw JSON must not contain raw manual surface.");
  assert.equal(preview.raw_json_preview.contains_unredacted_sources, false, "28Q raw JSON must not contain unredacted sources.");
  assert.equal(preview.raw_json_preview.source_raw_json_checklist_available, true, "28Q raw JSON checklist source must be visible.");
  assert.deepEqual(preview.raw_json_preview.required_top_level_keys, expectedRawJsonTopLevelKeys, "28Q raw JSON top-level keys drifted.");
  for (const key of preview.raw_json_preview.required_top_level_keys) {
    assert(
      Object.prototype.hasOwnProperty.call(preview, key),
      `28Q raw JSON preview requires missing top-level key ${key}.`,
    );
  }

  for (const key of [
    "active_engine_modified",
    "compressed_rules_modified",
    "pending_engine_candidate_created",
    "settlement_context_created",
    "settlement_report_created",
    "approval_item_created",
    "backup_created",
    "export_created",
    "restore_preview_created",
    "archive_file_created",
    "archive_index_written",
    "archive_manifest_written",
    "runtime_ui_modified",
    "runtime_service_modified",
    "runtime_bridge_modified",
    "mcp_tool_added",
    "bridge_tool_added",
    "canon_written",
  ]) {
    assert.equal(preview.no_mutation_snapshot[key], false, `28Q no mutation ${key} must remain false.`);
  }

  assert.equal(preview.counts.source_chain, 11, "28Q source chain count drifted.");
  assert.equal(preview.counts.retention_manifest_items, 6, "28Q retention manifest count drifted.");
  assert.equal(preview.counts.manifest_rows, 6, "28Q manifest row count drifted.");
  assert.equal(preview.counts.bridge_sections, 10, "28Q bridge section count drifted.");
  assert.equal(preview.counts.bridge_cards, 6, "28Q bridge card count drifted.");
  assert.equal(preview.counts.allowed_bridge_actions, 7, "28Q allowed bridge action count drifted.");
  assert.equal(preview.counts.blocked_bridge_capabilities, 18, "28Q blocked bridge capability count drifted.");
  assert.equal(preview.counts.checklist_cards, 6, "28Q checklist card count drifted.");
  assert.equal(preview.counts.checklist_items, 12, "28Q checklist item count drifted.");
  assert.equal(preview.counts.blocking_conditions, 12, "28Q blocking condition count drifted.");
  assert.equal(preview.counts.blocked_operator_actions, 18, "28Q blocked operator action count drifted.");
  assert(preview.counts.source_phase_rows >= 7, "28Q source phase row count should remain populated.");
  assert(preview.counts.source_chain_segments >= 3, "28Q source chain segment count should remain populated.");
  assert(preview.counts.source_operator_entrypoints >= 3, "28Q source operator entrypoint count should remain populated.");
  assert(preview.counts.source_prohibited_actions >= 7, "28Q source prohibited action count should remain populated.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);
const backupProjectBefore = await readOptionalDirectory(backupProjectDir);
const backupExportsBefore = await readOptionalDirectory(backupExportsDir);
const restorePreviewsBefore = await readOptionalDirectory(restorePreviewsDir);
const archiveFilesBefore = await readOptionalDirectory(archiveFilesDir);
const archiveIndexBefore = await readOptionalDirectory(archiveIndexDir);
const archiveManifestBefore = await readOptionalDirectory(archiveManifestDir);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28Q active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28Q compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText, uiIndexText, uiAppText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
  readFile(uiIndexPath, "utf8"),
  readFile(uiAppPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticSourceTokens({ serviceText, uiIndexText, uiAppText });

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: true,
});

assert.equal(index.ok, true, "28Q source index should be ready.");
assert.equal(index.raw_dashboard, null, "28Q source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28Q source index should omit raw manual review surface.");

const checklistBridgePreview = buildArchiveManifestChecklistBridgePreviewContract(index);

assertArchiveManifestChecklistBridgePreviewContract(checklistBridgePreview);
assert.deepEqual(
  buildArchiveManifestChecklistBridgePreviewContract(index),
  checklistBridgePreview,
  "28Q archive manifest checklist bridge preview contract should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28Q changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28Q changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28Q changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28Q changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28Q changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28Q changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28Q changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28Q changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28Q changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28Q changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28Q created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28Q wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28Q wrote archive manifest.");

console.log("Phase28Q foreshadowing settlement operator review chain index evidence packet archive manifest checklist bridge preview contract tests passed.");
