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
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
];

const expectedHandoffSections = [
  "handoff_header",
  "operator_summary",
  "source_chain",
  "retention_manifest",
  "archive_manifest_bridge_preview",
  "safety_boundary",
  "blocked_operator_actions",
  "manual_review_checklist",
  "raw_json_handoff",
  "no_mutation_snapshot",
];

const expectedManualReviewChecklist = [
  "confirm_source_chain_visible",
  "confirm_retention_manifest_copyable",
  "confirm_archive_manifest_is_preview_only",
  "confirm_no_archive_materialization",
  "confirm_no_canon_or_engine_write",
  "confirm_human_approval_still_required",
];

const expectedBlockedOperatorActions = [
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
  "smoke_kind",
  "smoke_version",
  "smoke_mode",
  "generated_for",
  "source_bridge_preview_kind",
  "source_bridge_preview_version",
  "source_bridge_preview_digest",
  "source_chain",
  "retention_manifest",
  "operator_summary",
  "manual_review_checklist",
  "safety_boundary",
  "raw_json_handoff",
  "archive_manifest_operator_handoff_smoke_digest",
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

function summarizePhaseRow(row) {
  return {
    key: row.key,
    label: row.label,
    expected_phase: row.expected_phase,
    phase: row.phase,
    status: row.status,
    loaded: row.loaded,
    readable: row.readable,
    safety_locked: row.safety_locked,
    route: row.route,
    test_path: row.test_path,
    coverage_only: row.coverage_only,
    summary: row.summary,
  };
}

function summarizeChainSegment(segment) {
  return {
    key: segment.key,
    label: segment.label,
    phases: segment.phases,
    status: segment.status,
    ready: segment.ready,
    summary: segment.summary,
  };
}

function summarizeOperatorEntrypoint(entrypoint) {
  return {
    key: entrypoint.key,
    label: entrypoint.label,
    route: entrypoint.route,
    ui_target: entrypoint.ui_target,
    source_phase: entrypoint.source_phase,
    priority: entrypoint.priority,
    reason: entrypoint.reason,
    read_only: entrypoint.read_only,
    can_approve: entrypoint.can_approve,
    can_confirm_adoption: entrypoint.can_confirm_adoption,
    can_activate_engine: entrypoint.can_activate_engine,
  };
}

function summarizeProhibitedAction(action) {
  return {
    key: action.key,
    label: action.label,
    allowed: action.allowed,
    reason: action.reason,
  };
}

function summarizeCard(card) {
  return {
    key: card.key,
    title: card.title,
    value: String(card.value ?? ""),
    tone: card.tone,
    summary: card.summary,
  };
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
    cards: index.cards.map(summarizeCard),
    phase_rows: index.phase_rows.map(summarizePhaseRow),
    chain_segments: index.chain_segments.map(summarizeChainSegment),
    operator_entrypoints: index.operator_entrypoints.map(summarizeOperatorEntrypoint),
    prohibited_actions: index.prohibited_actions.map(summarizeProhibitedAction),
    safety_boundary: index.safety,
    checks: index.checks,
    integrity: index.integrity,
  };
}

function buildArchiveManifestOperatorHandoffFinalSmoke(index) {
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
    cards: snapshot.cards.map((card) => card.key),
    phase_rows: snapshot.phase_rows.map((row) => row.key),
    chain_segments: snapshot.chain_segments.map((segment) => segment.key),
    operator_entrypoints: snapshot.operator_entrypoints.map((entrypoint) => entrypoint.key),
    prohibited_actions: snapshot.prohibited_actions.map((action) => action.key),
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
  ];

  const smokePayload = {
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
    smoke_version: "phase28n_archive_manifest_operator_handoff_final_smoke_v1",
    smoke_mode: "operator_handoff_final_smoke_only",
    generated_for: "operator_final_archive_manifest_handoff_review",
    source_bridge_preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
    source_bridge_preview_version: "phase28m_archive_manifest_bridge_preview_contract_v1",
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
    read_only: true,
    smoke_only: true,
    preview_only: true,
    operator_handoff_only: true,
    final_smoke_only: true,
    archive_manifest_handoff_only: true,
    archive_ready_only: true,
    retention_manifest_only: true,
    raw_json_handoff_only: true,
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
    source_chain: sourceChain,
    retention_manifest: retentionManifest,
    manifest_rows: manifestRows,
    operator_summary: {
      key: "archive_manifest_operator_handoff",
      headline: snapshot.headline,
      summary: [
        "Phase 28N verifies the final operator handoff smoke for the archive manifest bridge preview.",
        "The handoff is read-only, preview-only, and final-smoke-only.",
        "It preserves digest lineage, retention manifest visibility, redaction boundary, and blocked execution actions.",
      ].join(" "),
      status_badge: snapshot.status_badge,
      decision: snapshot.decision,
      route: "#writer-workbench",
      existing_panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
      existing_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
      source_bridge_preview_digest: archiveManifestBridgePreviewDigest,
      source_manifest_preview_digest: manifestUiPreviewDigest,
    },
    handoff_cards: [
      {
        key: "handoff_status",
        title: "Operator handoff",
        value: "final smoke passed for read-only archive manifest handoff",
        tone: "safe",
      },
      {
        key: "source_bridge_preview",
        title: "Source bridge preview",
        value: "Phase 28M archive manifest bridge preview linked",
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
        value: `${manifestRows.length} digest entries visible and copyable`,
        tone: "safe",
      },
      {
        key: "redaction_boundary",
        title: "Redaction boundary",
        value: "raw dashboards and unredacted sources remain omitted",
        tone: "safe",
      },
      {
        key: "blocked_operator_actions",
        title: "Blocked operator actions",
        value: `${expectedBlockedOperatorActions.length} execution capabilities blocked`,
        tone: "blocked",
      },
    ],
    manual_review_checklist: expectedManualReviewChecklist.map((key, order) => ({
      key,
      order,
      checked: true,
      required: true,
      operator_visible: true,
      reason: `${key} must be verified before any future archive materialization phase.`,
    })),
    blocked_operator_actions: expectedBlockedOperatorActions.map((key) => ({
      key,
      allowed: false,
      enabled: false,
      reason: `${key} is blocked because Phase 28N is an operator handoff final smoke, not an execution phase.`,
    })),
    required_sections: expectedHandoffSections,
    redaction_boundary: {
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      handoff_contains_raw_dashboard: false,
      handoff_contains_raw_manual_review_surface: false,
      handoff_contains_unredacted_sources: false,
    },
    safety_boundary: {
      read_only: true,
      smoke_only: true,
      preview_only: true,
      operator_handoff_only: true,
      final_smoke_only: true,
      archive_manifest_handoff_only: true,
      archive_ready_only: true,
      retention_manifest_only: true,
      raw_json_handoff_only: true,
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
    raw_json_handoff: {
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
      source_chain: expectedSourceChainPhases.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: manifestRows.length,
      handoff_sections: expectedHandoffSections.length,
      handoff_cards: 6,
      manual_review_checklist: expectedManualReviewChecklist.length,
      blocked_operator_actions: expectedBlockedOperatorActions.length,
      phase_rows: snapshot.phase_rows.length,
      chain_segments: snapshot.chain_segments.length,
      operator_entrypoints: snapshot.operator_entrypoints.length,
      prohibited_actions: snapshot.prohibited_actions.length,
    },
  };

  return {
    ...smokePayload,
    archive_manifest_operator_handoff_smoke_digest: stableDigest(smokePayload),
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
    assert(serviceText.includes(token), `28N service missing handoff source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28N existing UI HTML missing handoff source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28N existing app.js missing handoff source token: ${token}`);
  }
}

function assertArchiveManifestOperatorHandoffFinalSmoke(smoke) {
  assert.equal(
    smoke.smoke_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_operator_handoff_final_smoke",
    "28N smoke kind drifted.",
  );
  assert.equal(smoke.smoke_version, "phase28n_archive_manifest_operator_handoff_final_smoke_v1", "28N smoke version drifted.");
  assert.equal(smoke.smoke_mode, "operator_handoff_final_smoke_only", "28N smoke mode drifted.");
  assert.equal(smoke.generated_for, "operator_final_archive_manifest_handoff_review", "28N generated_for drifted.");

  assert.equal(
    smoke.source_bridge_preview_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
    "28N source bridge preview kind drifted.",
  );
  assert.equal(
    smoke.source_bridge_preview_version,
    "phase28m_archive_manifest_bridge_preview_contract_v1",
    "28N source bridge preview version drifted.",
  );
  assert.match(smoke.source_bridge_preview_digest, /^[a-f0-9]{64}$/u, "28N source bridge digest should be sha256 hex.");
  assert.match(smoke.source_manifest_preview_digest, /^[a-f0-9]{64}$/u, "28N manifest preview digest should be sha256 hex.");
  assert.match(smoke.source_archive_readiness_digest, /^[a-f0-9]{64}$/u, "28N archive readiness digest should be sha256 hex.");
  assert.match(smoke.source_index_digest, /^[a-f0-9]{64}$/u, "28N source index digest should be sha256 hex.");

  for (const key of [
    "read_only",
    "smoke_only",
    "preview_only",
    "operator_handoff_only",
    "final_smoke_only",
    "archive_manifest_handoff_only",
    "archive_ready_only",
    "retention_manifest_only",
    "raw_json_handoff_only",
  ]) {
    assert.equal(smoke[key], true, `28N ${key} must remain true.`);
    assert.equal(smoke.safety_boundary[key], true, `28N safety boundary ${key} must remain true.`);
  }

  for (const key of [
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
    assert.equal(smoke[key], false, `28N ${key} must remain false.`);
    assert.equal(smoke.safety_boundary[key], false, `28N safety boundary ${key} must remain false.`);
  }

  const sourceChain = keyed(smoke.source_chain, "28N source chain");
  assert.deepEqual([...sourceChain.keys()], expectedSourceChainPhases, "28N source chain phase order drifted.");
  for (const item of sourceChain.values()) {
    assert.equal(item.key, item.phase, `${item.phase} key should match phase.`);
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
    assert.equal(typeof item.kind, "string", `${item.phase} kind must be a string.`);
    assert.equal(typeof item.version, "string", `${item.phase} version must be a string.`);
    assert.equal(typeof item.digest_key, "string", `${item.phase} digest key must be a string.`);
  }

  assert.equal(
    sourceChain.get("28M").digest,
    smoke.source_bridge_preview_digest,
    "28N source chain 28M digest should match source bridge preview digest.",
  );
  assert.equal(
    sourceChain.get("28L").digest,
    smoke.source_manifest_preview_digest,
    "28N source chain 28L digest should match source manifest preview digest.",
  );
  assert.equal(
    sourceChain.get("28K").digest,
    smoke.source_archive_readiness_digest,
    "28N source chain 28K digest should match archive readiness digest.",
  );
  assert.equal(
    sourceChain.get("28A").digest,
    smoke.source_index_digest,
    "28N source chain 28A digest should match source index digest.",
  );

  assert.deepEqual(Object.keys(smoke.retention_manifest), expectedRetentionManifestKeys, "28N retention manifest keys drifted.");
  for (const key of expectedRetentionManifestKeys) {
    assert.match(smoke.retention_manifest[key], /^[a-f0-9]{64}$/u, `28N ${key} should be sha256 hex.`);
  }

  const manifestRows = keyed(smoke.manifest_rows, "28N manifest rows");
  assert.deepEqual([...manifestRows.keys()], expectedRetentionManifestKeys, "28N manifest row order drifted.");
  for (const [index, row] of [...manifestRows.values()].entries()) {
    assert.equal(row.order, index, `${row.key} order drifted.`);
    assert.equal(row.visible, true, `${row.key} should be visible.`);
    assert.equal(row.copyable, true, `${row.key} should be copyable.`);
    assert.equal(row.verified, true, `${row.key} should be verified.`);
    assert.equal(row.retained, true, `${row.key} should be retained.`);
    assert.match(row.digest, /^[a-f0-9]{64}$/u, `${row.key} digest should be sha256 hex.`);
    assert.equal(row.digest, smoke.retention_manifest[row.key], `${row.key} digest should match retention manifest.`);
  }

  assert.equal(smoke.operator_summary.key, "archive_manifest_operator_handoff", "28N operator summary key drifted.");
  assert.equal(smoke.operator_summary.route, "#writer-workbench", "28N operator route drifted.");
  assert.equal(
    smoke.operator_summary.existing_panel_id,
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "28N operator panel id drifted.",
  );
  assert.equal(
    smoke.operator_summary.existing_raw_json_element_id,
    "foreshadowing-settlement-operator-review-chain-index-surface-raw",
    "28N operator raw JSON id drifted.",
  );
  assert.equal(
    smoke.operator_summary.source_bridge_preview_digest,
    smoke.source_bridge_preview_digest,
    "28N operator source bridge digest drifted.",
  );

  const handoffCards = keyed(smoke.handoff_cards, "28N handoff cards");
  assert.deepEqual(
    [...handoffCards.keys()],
    [
      "handoff_status",
      "source_bridge_preview",
      "source_chain",
      "retention_manifest",
      "redaction_boundary",
      "blocked_operator_actions",
    ],
    "28N handoff card order drifted.",
  );

  const checklist = keyed(smoke.manual_review_checklist, "28N manual review checklist");
  assert.deepEqual([...checklist.keys()], expectedManualReviewChecklist, "28N checklist order drifted.");
  for (const [index, item] of [...checklist.values()].entries()) {
    assert.equal(item.order, index, `${item.key} checklist order drifted.`);
    assert.equal(item.checked, true, `${item.key} should be checked in final smoke.`);
    assert.equal(item.required, true, `${item.key} should be required.`);
    assert.equal(item.operator_visible, true, `${item.key} should be operator visible.`);
    assert(item.reason.includes("future archive materialization"), `${item.key} should warn about future materialization.`);
  }

  const blockedActions = keyed(smoke.blocked_operator_actions, "28N blocked operator actions");
  assert.deepEqual([...blockedActions.keys()], expectedBlockedOperatorActions, "28N blocked operator action order drifted.");
  for (const action of blockedActions.values()) {
    assert.equal(action.allowed, false, `${action.key} must not be allowed.`);
    assert.equal(action.enabled, false, `${action.key} must not be enabled.`);
    assert(action.reason.includes("not an execution phase"), `${action.key} reason should preserve execution-phase warning.`);
  }

  assert.deepEqual(smoke.required_sections, expectedHandoffSections, "28N handoff section order drifted.");

  assert.equal(smoke.redaction_boundary.redacted_raw_sources, true, "28N should preserve redacted raw sources.");
  assert.equal(smoke.redaction_boundary.contains_raw_dashboard, false, "28N should not contain raw dashboard.");
  assert.equal(smoke.redaction_boundary.contains_raw_manual_review_surface, false, "28N should not contain raw manual review surface.");
  assert.equal(smoke.redaction_boundary.contains_unredacted_sources, false, "28N should not contain unredacted sources.");
  assert.equal(smoke.redaction_boundary.handoff_contains_raw_dashboard, false, "28N handoff should not contain raw dashboard.");
  assert.equal(smoke.redaction_boundary.handoff_contains_raw_manual_review_surface, false, "28N handoff should not contain raw manual review surface.");
  assert.equal(smoke.redaction_boundary.handoff_contains_unredacted_sources, false, "28N handoff should not contain unredacted sources.");

  assert.equal(smoke.raw_json_handoff.available, true, "28N raw JSON handoff should be available.");
  assert.equal(smoke.raw_json_handoff.safe_to_display, true, "28N raw JSON handoff should be safe to display.");
  assert.equal(smoke.raw_json_handoff.element_kind, "pre_json", "28N raw JSON element kind drifted.");
  assert.equal(smoke.raw_json_handoff.content_type, "application/json", "28N raw JSON content type drifted.");
  assert.equal(smoke.raw_json_handoff.pretty_print_required, true, "28N raw JSON should require pretty print.");
  assert.equal(smoke.raw_json_handoff.copyable, true, "28N raw JSON should be copyable.");
  assert.equal(smoke.raw_json_handoff.redacted_raw_sources, true, "28N raw JSON should preserve redaction.");
  assert.equal(smoke.raw_json_handoff.contains_raw_dashboard, false, "28N raw JSON must not contain raw dashboard.");
  assert.equal(smoke.raw_json_handoff.contains_raw_manual_review_surface, false, "28N raw JSON must not contain raw manual surface.");
  assert.equal(smoke.raw_json_handoff.contains_unredacted_sources, false, "28N raw JSON must not contain unredacted sources.");
  assert.deepEqual(smoke.raw_json_handoff.required_top_level_keys, expectedRawJsonTopLevelKeys, "28N raw JSON top-level keys drifted.");
  for (const key of smoke.raw_json_handoff.required_top_level_keys) {
    assert(
      Object.prototype.hasOwnProperty.call(smoke, key),
      `28N raw JSON handoff requires missing top-level key ${key}.`,
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
    assert.equal(smoke.no_mutation_snapshot[key], false, `28N no mutation ${key} must remain false.`);
  }

  assert.equal(smoke.counts.source_chain, 8, "28N source chain count drifted.");
  assert.equal(smoke.counts.retention_manifest_items, 6, "28N retention manifest count drifted.");
  assert.equal(smoke.counts.manifest_rows, 6, "28N manifest row count drifted.");
  assert.equal(smoke.counts.handoff_sections, 10, "28N handoff section count drifted.");
  assert.equal(smoke.counts.handoff_cards, 6, "28N handoff card count drifted.");
  assert.equal(smoke.counts.manual_review_checklist, 6, "28N checklist count drifted.");
  assert.equal(smoke.counts.blocked_operator_actions, 16, "28N blocked action count drifted.");
  assert.equal(smoke.counts.phase_rows, 7, "28N phase row count drifted.");
  assert.equal(smoke.counts.chain_segments, 3, "28N chain segment count drifted.");
  assert.equal(smoke.counts.operator_entrypoints, 3, "28N operator entrypoint count drifted.");
  assert.equal(smoke.counts.prohibited_actions, 7, "28N prohibited action count drifted.");

  assert.match(
    smoke.archive_manifest_operator_handoff_smoke_digest,
    /^[a-f0-9]{64}$/u,
    "28N operator handoff smoke digest should be sha256 hex.",
  );
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

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28N active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28N compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28N source index should be ready.");
assert.equal(index.raw_dashboard, null, "28N source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28N source index should omit raw manual review surface.");

const handoffSmoke = buildArchiveManifestOperatorHandoffFinalSmoke(index);

assertArchiveManifestOperatorHandoffFinalSmoke(handoffSmoke);
assert.deepEqual(
  buildArchiveManifestOperatorHandoffFinalSmoke(index),
  handoffSmoke,
  "28N archive manifest operator handoff final smoke should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28N changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28N changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28N changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28N changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28N changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28N changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28N changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28N changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28N changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28N changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28N created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28N wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28N wrote archive manifest.");

console.log("Phase28N foreshadowing settlement operator review chain index evidence packet archive manifest operator handoff final smoke tests passed.");
