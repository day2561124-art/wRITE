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
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
];

const expectedAcceptanceSections = [
  "acceptance_header",
  "readiness_summary",
  "source_chain",
  "retention_manifest",
  "operator_handoff_smoke",
  "acceptance_gates",
  "blocked_acceptance_actions",
  "safety_boundary",
  "raw_json_contract",
  "no_mutation_snapshot",
];

const expectedAcceptanceGates = [
  "source_chain_complete",
  "retention_manifest_verified",
  "operator_handoff_smoke_passed",
  "redaction_boundary_preserved",
  "execution_actions_blocked",
  "no_mutation_snapshot_clean",
  "human_approval_still_required",
  "future_materialization_requires_new_phase",
];

const expectedBlockedAcceptanceActions = [
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

const expectedRawJsonTopLevelKeys = [
  "acceptance_kind",
  "acceptance_version",
  "acceptance_mode",
  "generated_for",
  "source_operator_handoff_smoke_kind",
  "source_operator_handoff_smoke_version",
  "source_operator_handoff_smoke_digest",
  "source_chain",
  "retention_manifest",
  "readiness_summary",
  "acceptance_gates",
  "blocked_acceptance_actions",
  "safety_boundary",
  "raw_json_contract",
  "final_acceptance_readiness_digest",
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

function buildArchiveManifestFinalAcceptanceReadinessContract(index) {
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
  ];

  const readinessPayload = {
    acceptance_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_readiness",
    acceptance_version: "phase28o_archive_manifest_final_acceptance_readiness_contract_v1",
    acceptance_mode: "final_acceptance_readiness_only",
    generated_for: "pre_archive_materialization_final_acceptance_review",
    source_operator_handoff_smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
    source_operator_handoff_smoke_version: "phase28n_archive_manifest_operator_handoff_final_smoke_v1",
    source_operator_handoff_smoke_digest: operatorHandoffSmokeDigest,
    source_bridge_preview_digest: archiveManifestBridgePreviewDigest,
    source_manifest_preview_digest: manifestUiPreviewDigest,
    source_archive_readiness_digest: archiveReadinessDigest,
    source_index_digest: sourceIndexDigest,
    source_index_kind: snapshot.index_kind,
    source_index_version: snapshot.version,
    source_index_phase: snapshot.phase,
    source_phase: snapshot.source_phase,
    source_phases: snapshot.source_phases,
    index_status: snapshot.index_status,
    decision: snapshot.decision,
    headline: snapshot.headline,
    summary: snapshot.summary,
    status_badge: snapshot.status_badge,
    warnings: snapshot.warnings,
    ready_for_final_acceptance_review: true,
    ready_for_future_archive_materialization_review: true,
    not_ready_to_materialize_archive: true,
    read_only: true,
    contract_only: true,
    readiness_only: true,
    preview_only: true,
    final_acceptance_readiness_only: true,
    archive_materialization_blocked: true,
    retention_manifest_only: true,
    raw_json_contract_only: true,
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
    source_chain: sourceChain,
    retention_manifest: retentionManifest,
    manifest_rows: manifestRows,
    readiness_summary: {
      key: "archive_manifest_final_acceptance_readiness",
      headline: "Archive manifest final acceptance readiness",
      summary: [
        "Phase 28O verifies that the archive manifest operator handoff is ready for final acceptance review.",
        "This contract does not accept, materialize, write, restore, rollback, or register any execution surface.",
        "Future archive materialization must be implemented in a later explicit phase with a separate confirmation boundary.",
      ].join(" "),
      route: "#writer-workbench",
      source_operator_handoff_smoke_digest: operatorHandoffSmokeDigest,
      source_bridge_preview_digest: archiveManifestBridgePreviewDigest,
      source_manifest_preview_digest: manifestUiPreviewDigest,
      source_archive_readiness_digest: archiveReadinessDigest,
      decision: snapshot.decision,
      status_badge: snapshot.status_badge,
    },
    acceptance_cards: [
      {
        key: "readiness_status",
        title: "Final acceptance readiness",
        value: "ready for final acceptance review only",
        tone: "safe",
      },
      {
        key: "source_operator_handoff",
        title: "Source operator handoff",
        value: "Phase 28N operator handoff final smoke linked",
        tone: "safe",
      },
      {
        key: "source_chain",
        title: "Source chain",
        value: `${sourceChain.length} source-chain phases linked`,
        tone: "safe",
      },
      {
        key: "retention_manifest",
        title: "Retention manifest",
        value: `${manifestRows.length} digest entries verified`,
        tone: "safe",
      },
      {
        key: "future_materialization",
        title: "Future materialization",
        value: "requires a new explicit phase",
        tone: "blocked",
      },
      {
        key: "blocked_acceptance_actions",
        title: "Blocked acceptance actions",
        value: `${expectedBlockedAcceptanceActions.length} execution capabilities blocked`,
        tone: "blocked",
      },
    ],
    acceptance_gates: expectedAcceptanceGates.map((key, order) => ({
      key,
      order,
      passed: true,
      required: true,
      blocking_if_failed: true,
      operator_visible: true,
      reason: `${key} is required before any later archive materialization phase can be considered.`,
    })),
    blocked_acceptance_actions: expectedBlockedAcceptanceActions.map((key) => ({
      key,
      allowed: false,
      enabled: false,
      reason: `${key} is blocked because Phase 28O is a final acceptance readiness contract, not an execution phase.`,
    })),
    required_sections: expectedAcceptanceSections,
    redaction_boundary: {
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      acceptance_contract_contains_raw_dashboard: false,
      acceptance_contract_contains_raw_manual_review_surface: false,
      acceptance_contract_contains_unredacted_sources: false,
    },
    safety_boundary: {
      read_only: true,
      contract_only: true,
      readiness_only: true,
      preview_only: true,
      final_acceptance_readiness_only: true,
      archive_materialization_blocked: true,
      retention_manifest_only: true,
      raw_json_contract_only: true,
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
    raw_json_contract: {
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
      required_top_level_keys: expectedRawJsonTopLevelKeys,
    },
    counts: {
      source_chain: sourceChain.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: manifestRows.length,
      acceptance_sections: expectedAcceptanceSections.length,
      acceptance_cards: 6,
      acceptance_gates: expectedAcceptanceGates.length,
      blocked_acceptance_actions: expectedBlockedAcceptanceActions.length,
      source_phase_rows: snapshot.phase_rows.length,
      source_chain_segments: snapshot.chain_segments.length,
      source_operator_entrypoints: snapshot.operator_entrypoints.length,
      source_prohibited_actions: snapshot.prohibited_actions.length,
    },
  };

  return {
    ...readinessPayload,
    final_acceptance_readiness_digest: stableDigest(readinessPayload),
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
    assert(serviceText.includes(token), `28O service missing readiness source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28O existing UI HTML missing readiness source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28O existing app.js missing readiness source token: ${token}`);
  }
}

function assertArchiveManifestFinalAcceptanceReadinessContract(contract) {
  assert.equal(
    contract.acceptance_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_final_acceptance_readiness",
    "28O acceptance kind drifted.",
  );
  assert.equal(contract.acceptance_version, "phase28o_archive_manifest_final_acceptance_readiness_contract_v1", "28O acceptance version drifted.");
  assert.equal(contract.acceptance_mode, "final_acceptance_readiness_only", "28O acceptance mode drifted.");
  assert.equal(contract.generated_for, "pre_archive_materialization_final_acceptance_review", "28O generated_for drifted.");
  assert.equal(
    contract.source_operator_handoff_smoke_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
    "28O source operator handoff kind drifted.",
  );
  assert.equal(
    contract.source_operator_handoff_smoke_version,
    "phase28n_archive_manifest_operator_handoff_final_smoke_v1",
    "28O source operator handoff version drifted.",
  );

  for (const key of [
    "source_operator_handoff_smoke_digest",
    "source_bridge_preview_digest",
    "source_manifest_preview_digest",
    "source_archive_readiness_digest",
    "source_index_digest",
    "final_acceptance_readiness_digest",
  ]) {
    assert.match(contract[key], /^[a-f0-9]{64}$/u, `28O ${key} should be sha256 hex.`);
  }

  for (const key of [
    "ready_for_final_acceptance_review",
    "ready_for_future_archive_materialization_review",
    "not_ready_to_materialize_archive",
    "read_only",
    "contract_only",
    "readiness_only",
    "preview_only",
    "final_acceptance_readiness_only",
    "archive_materialization_blocked",
    "retention_manifest_only",
    "raw_json_contract_only",
    "requires_human_approval",
    "requires_operator_confirmation",
    "future_archive_materialization_requires_new_phase",
  ]) {
    assert.equal(contract[key], true, `28O ${key} must remain true.`);
  }

  for (const key of [
    "read_only",
    "contract_only",
    "readiness_only",
    "preview_only",
    "final_acceptance_readiness_only",
    "archive_materialization_blocked",
    "retention_manifest_only",
    "raw_json_contract_only",
  ]) {
    assert.equal(contract.safety_boundary[key], true, `28O safety boundary ${key} must remain true.`);
  }

  for (const key of [
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
    assert.equal(contract[key], false, `28O ${key} must remain false.`);
    assert.equal(contract.safety_boundary[key], false, `28O safety boundary ${key} must remain false.`);
  }

  const sourceChain = keyed(contract.source_chain, "28O source chain");
  assert.deepEqual([...sourceChain.keys()], expectedSourceChainPhases, "28O source chain phase order drifted.");
  for (const item of sourceChain.values()) {
    assert.equal(item.key, item.phase, `${item.phase} key should match phase.`);
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
    assert.equal(typeof item.kind, "string", `${item.phase} kind must be a string.`);
    assert.equal(typeof item.version, "string", `${item.phase} version must be a string.`);
    assert.equal(typeof item.digest_key, "string", `${item.phase} digest key must be a string.`);
  }

  assert.equal(
    sourceChain.get("28N").digest,
    contract.source_operator_handoff_smoke_digest,
    "28O source chain 28N digest should match source operator handoff smoke digest.",
  );
  assert.equal(
    sourceChain.get("28M").digest,
    contract.source_bridge_preview_digest,
    "28O source chain 28M digest should match source bridge preview digest.",
  );
  assert.equal(
    sourceChain.get("28L").digest,
    contract.source_manifest_preview_digest,
    "28O source chain 28L digest should match source manifest preview digest.",
  );
  assert.equal(
    sourceChain.get("28K").digest,
    contract.source_archive_readiness_digest,
    "28O source chain 28K digest should match archive readiness digest.",
  );
  assert.equal(
    sourceChain.get("28A").digest,
    contract.source_index_digest,
    "28O source chain 28A digest should match source index digest.",
  );

  assert.deepEqual(Object.keys(contract.retention_manifest), expectedRetentionManifestKeys, "28O retention manifest keys drifted.");
  for (const key of expectedRetentionManifestKeys) {
    assert.match(contract.retention_manifest[key], /^[a-f0-9]{64}$/u, `28O ${key} should be sha256 hex.`);
  }

  const manifestRows = keyed(contract.manifest_rows, "28O manifest rows");
  assert.deepEqual([...manifestRows.keys()], expectedRetentionManifestKeys, "28O manifest row order drifted.");
  for (const [index, row] of [...manifestRows.values()].entries()) {
    assert.equal(row.order, index, `${row.key} order drifted.`);
    assert.equal(row.visible, true, `${row.key} should be visible.`);
    assert.equal(row.copyable, true, `${row.key} should be copyable.`);
    assert.equal(row.verified, true, `${row.key} should be verified.`);
    assert.equal(row.retained, true, `${row.key} should be retained.`);
    assert.equal(row.digest, contract.retention_manifest[row.key], `${row.key} digest should match retention manifest.`);
  }

  assert.equal(contract.readiness_summary.key, "archive_manifest_final_acceptance_readiness", "28O readiness summary key drifted.");
  assert.equal(contract.readiness_summary.route, "#writer-workbench", "28O readiness route drifted.");
  assert.equal(
    contract.readiness_summary.source_operator_handoff_smoke_digest,
    contract.source_operator_handoff_smoke_digest,
    "28O readiness summary source operator digest drifted.",
  );
  assert(
    contract.readiness_summary.summary.includes("does not accept"),
    "28O readiness summary must preserve no-acceptance warning.",
  );
  assert(
    contract.readiness_summary.summary.includes("later explicit phase"),
    "28O readiness summary must preserve future phase warning.",
  );

  const acceptanceCards = keyed(contract.acceptance_cards, "28O acceptance cards");
  assert.deepEqual(
    [...acceptanceCards.keys()],
    [
      "readiness_status",
      "source_operator_handoff",
      "source_chain",
      "retention_manifest",
      "future_materialization",
      "blocked_acceptance_actions",
    ],
    "28O acceptance card order drifted.",
  );

  const gates = keyed(contract.acceptance_gates, "28O acceptance gates");
  assert.deepEqual([...gates.keys()], expectedAcceptanceGates, "28O acceptance gate order drifted.");
  for (const [index, gate] of [...gates.values()].entries()) {
    assert.equal(gate.order, index, `${gate.key} gate order drifted.`);
    assert.equal(gate.passed, true, `${gate.key} should pass readiness contract.`);
    assert.equal(gate.required, true, `${gate.key} should be required.`);
    assert.equal(gate.blocking_if_failed, true, `${gate.key} should block if failed.`);
    assert.equal(gate.operator_visible, true, `${gate.key} should be operator visible.`);
    assert(gate.reason.includes("later archive materialization"), `${gate.key} should warn about later materialization.`);
  }

  const blockedActions = keyed(contract.blocked_acceptance_actions, "28O blocked acceptance actions");
  assert.deepEqual([...blockedActions.keys()], expectedBlockedAcceptanceActions, "28O blocked acceptance action order drifted.");
  for (const action of blockedActions.values()) {
    assert.equal(action.allowed, false, `${action.key} must not be allowed.`);
    assert.equal(action.enabled, false, `${action.key} must not be enabled.`);
    assert(action.reason.includes("not an execution phase"), `${action.key} reason should preserve execution-phase warning.`);
  }

  assert.deepEqual(contract.required_sections, expectedAcceptanceSections, "28O acceptance section order drifted.");

  assert.equal(contract.redaction_boundary.redacted_raw_sources, true, "28O should preserve redacted raw sources.");
  assert.equal(contract.redaction_boundary.contains_raw_dashboard, false, "28O should not contain raw dashboard.");
  assert.equal(contract.redaction_boundary.contains_raw_manual_review_surface, false, "28O should not contain raw manual review surface.");
  assert.equal(contract.redaction_boundary.contains_unredacted_sources, false, "28O should not contain unredacted sources.");
  assert.equal(contract.redaction_boundary.acceptance_contract_contains_raw_dashboard, false, "28O contract should not contain raw dashboard.");
  assert.equal(contract.redaction_boundary.acceptance_contract_contains_raw_manual_review_surface, false, "28O contract should not contain raw manual review surface.");
  assert.equal(contract.redaction_boundary.acceptance_contract_contains_unredacted_sources, false, "28O contract should not contain unredacted sources.");

  assert.equal(contract.raw_json_contract.available, true, "28O raw JSON contract should be available.");
  assert.equal(contract.raw_json_contract.safe_to_display, true, "28O raw JSON contract should be safe to display.");
  assert.equal(contract.raw_json_contract.element_kind, "pre_json", "28O raw JSON element kind drifted.");
  assert.equal(contract.raw_json_contract.content_type, "application/json", "28O raw JSON content type drifted.");
  assert.equal(contract.raw_json_contract.pretty_print_required, true, "28O raw JSON should require pretty print.");
  assert.equal(contract.raw_json_contract.copyable, true, "28O raw JSON should be copyable.");
  assert.equal(contract.raw_json_contract.redacted_raw_sources, true, "28O raw JSON should preserve redaction.");
  assert.equal(contract.raw_json_contract.contains_raw_dashboard, false, "28O raw JSON must not contain raw dashboard.");
  assert.equal(contract.raw_json_contract.contains_raw_manual_review_surface, false, "28O raw JSON must not contain raw manual surface.");
  assert.equal(contract.raw_json_contract.contains_unredacted_sources, false, "28O raw JSON must not contain unredacted sources.");
  assert.deepEqual(contract.raw_json_contract.required_top_level_keys, expectedRawJsonTopLevelKeys, "28O raw JSON top-level keys drifted.");
  for (const key of contract.raw_json_contract.required_top_level_keys) {
    assert(
      Object.prototype.hasOwnProperty.call(contract, key),
      `28O raw JSON contract requires missing top-level key ${key}.`,
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
    assert.equal(contract.no_mutation_snapshot[key], false, `28O no mutation ${key} must remain false.`);
  }

  assert.equal(contract.counts.source_chain, 9, "28O source chain count drifted.");
  assert.equal(contract.counts.retention_manifest_items, 6, "28O retention manifest count drifted.");
  assert.equal(contract.counts.manifest_rows, 6, "28O manifest row count drifted.");
  assert.equal(contract.counts.acceptance_sections, 10, "28O acceptance section count drifted.");
  assert.equal(contract.counts.acceptance_cards, 6, "28O acceptance card count drifted.");
  assert.equal(contract.counts.acceptance_gates, 8, "28O acceptance gate count drifted.");
  assert.equal(contract.counts.blocked_acceptance_actions, 17, "28O blocked action count drifted.");
  assert(contract.counts.source_phase_rows >= 7, "28O source phase row count should remain populated.");
  assert(contract.counts.source_chain_segments >= 3, "28O source chain segment count should remain populated.");
  assert(contract.counts.source_operator_entrypoints >= 3, "28O source operator entrypoint count should remain populated.");
  assert(contract.counts.source_prohibited_actions >= 7, "28O source prohibited action count should remain populated.");
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

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28O active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28O compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28O source index should be ready.");
assert.equal(index.raw_dashboard, null, "28O source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28O source index should omit raw manual review surface.");

const acceptanceReadiness = buildArchiveManifestFinalAcceptanceReadinessContract(index);

assertArchiveManifestFinalAcceptanceReadinessContract(acceptanceReadiness);
assert.deepEqual(
  buildArchiveManifestFinalAcceptanceReadinessContract(index),
  acceptanceReadiness,
  "28O archive manifest final acceptance readiness contract should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28O changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28O changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28O changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28O changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28O changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28O changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28O changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28O changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28O changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28O changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28O created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28O wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28O wrote archive manifest.");

console.log("Phase28O foreshadowing settlement operator review chain index evidence packet archive manifest final acceptance readiness contract tests passed.");

