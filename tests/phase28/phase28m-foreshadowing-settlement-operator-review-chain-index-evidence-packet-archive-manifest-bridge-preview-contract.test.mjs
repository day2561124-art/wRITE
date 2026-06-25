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
];

const expectedSourceChainPhases = [
  "28A",
  "28G",
  "28H",
  "28I",
  "28J",
  "28K",
  "28L",
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
];

const expectedBridgeSections = [
  "bridge_header",
  "manifest_summary",
  "digest_lineage",
  "retention_manifest",
  "operator_handoff_summary",
  "redaction_boundary",
  "forbidden_bridge_actions",
  "raw_json_preview",
  "no_mutation_snapshot",
];

const expectedAllowedBridgeActions = [
  "read_archive_manifest_preview",
  "copy_retention_manifest_summary",
  "open_existing_review_chain_index_route",
  "inspect_archive_safety_boundary",
];

const expectedBlockedBridgeCapabilities = [
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
  "register_mcp_tool",
];

const expectedRawJsonTopLevelKeys = [
  "bridge_kind",
  "bridge_version",
  "bridge_channel",
  "bridge_mode",
  "bridge_surface",
  "source_manifest_preview_kind",
  "source_manifest_preview_version",
  "source_manifest_preview_digest",
  "source_chain",
  "retention_manifest",
  "bridge_readability",
  "ui_preview_route",
  "safety_boundary",
  "raw_json_preview",
  "archive_manifest_bridge_preview_digest",
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

function buildArchiveManifestBridgePreviewContract(index) {
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
    key: "28G",
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
    key: "28H",
    phase: "28H",
    preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview",
    preview_version: "phase28h_evidence_packet_ui_preview_contract_v1",
    source_evidence_digest: evidencePacketDigest,
    route: "#writer-workbench",
    panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
    raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
  });

  const bridgePreviewDigest = stableDigest({
    key: "28I",
    phase: "28I",
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview",
    bridge_version: "phase28i_evidence_packet_bridge_preview_contract_v1",
    source_evidence_digest: evidencePacketDigest,
    source_ui_preview_digest: uiPreviewDigest,
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
  });

  const handoffSmokeDigest = stableDigest({
    key: "28J",
    phase: "28J",
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke",
    smoke_version: "phase28j_operator_handoff_final_smoke_v1",
    source_bridge_preview_digest: bridgePreviewDigest,
    headline: snapshot.headline,
    status_badge: snapshot.status_badge,
  });

  const archiveReadinessDigest = stableDigest({
    key: "28K",
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
    key: "28L",
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
    route: "#writer-workbench",
    manifest_panel_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview",
    manifest_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview-raw",
  });

  const bridgePayload = {
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
    bridge_version: "phase28m_archive_manifest_bridge_preview_contract_v1",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
    bridge_surface: "archive_manifest_retention_bridge_preview",
    generated_for: "chatgpt_bridge_readable_archive_manifest_handoff",
    source_manifest_preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
    source_manifest_preview_version: "phase28l_archive_manifest_ui_preview_contract_v1",
    source_manifest_preview_digest: manifestUiPreviewDigest,
    source_archive_readiness_digest: archiveReadinessDigest,
    source_bridge_preview_digest: bridgePreviewDigest,
    source_ui_preview_digest: uiPreviewDigest,
    source_evidence_packet_digest: evidencePacketDigest,
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
    preview_only: true,
    bridge_preview_only: true,
    manifest_bridge_preview_only: true,
    archive_ready_only: true,
    retention_manifest_only: true,
    raw_json_preview_only: true,
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
    can_register_mcp_tool: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    source_chain: [
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
    ],
    retention_manifest: retentionManifest,
    manifest_rows: manifestRows,
    bridge_cards: [
      {
        key: "bridge_status",
        title: "Bridge preview",
        value: "read-only archive manifest handoff",
        tone: "safe",
      },
      {
        key: "source_manifest",
        title: "Source manifest",
        value: "Phase 28L manifest UI preview digest linked",
        tone: "safe",
      },
      {
        key: "digest_lineage",
        title: "Digest lineage",
        value: `${manifestRows.filter((row) => row.verified).length}/${manifestRows.length} retention digests verified`,
        tone: "safe",
      },
      {
        key: "retention_manifest",
        title: "Retention manifest",
        value: `${manifestRows.length} retained digest entries`,
        tone: "safe",
      },
      {
        key: "redaction_boundary",
        title: "Redaction boundary",
        value: "redacted raw sources only",
        tone: "safe",
      },
      {
        key: "forbidden_bridge_actions",
        title: "Forbidden bridge actions",
        value: `${expectedBlockedBridgeCapabilities.length} blocked bridge capabilities`,
        tone: "blocked",
      },
    ],
    bridge_readability: {
      markdown_summary: [
        `# ${snapshot.headline}`,
        "",
        snapshot.summary,
        "",
        `Status: ${snapshot.index_status}`,
        `Decision: ${snapshot.decision}`,
        `Manifest UI preview digest: ${manifestUiPreviewDigest}`,
        `Archive readiness digest: ${archiveReadinessDigest}`,
        "",
        "This archive manifest bridge preview is read-only / preview-only and cannot materialize archives, write archive indexes, approve, adopt, settle, activate engine, write Canon, create pending engine candidates, update compressed_rules, restore, rollback, modify runtime bridge, or register MCP tools.",
      ].join("\n"),
      digest_table: manifestRows.map((row) => ({
        key: row.key,
        source_phase: row.source_phase,
        digest: row.digest,
        verified: row.verified,
        copyable: row.copyable,
      })),
      compact_cards: [
        {
          key: "archive_manifest_bridge_preview",
          title: "Archive Manifest Bridge Preview",
          value: "safe to show in ChatGPT bridge as read-only handoff context",
          tone: "safe",
        },
        {
          key: "no_execution_surface",
          title: "No Execution Surface",
          value: "all archive/adoption/engine/Canon actions remain blocked",
          tone: "blocked",
        },
      ],
    },
    ui_preview_route: {
      route: "#writer-workbench",
      data_view: "writer-workbench",
      existing_panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
      existing_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
      manifest_panel_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview",
      manifest_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview-raw",
    },
    allowed_bridge_actions: expectedAllowedBridgeActions.map((key) => ({
      key,
      allowed: true,
      read_only: true,
      reason: `${key} is allowed only as a read-only archive manifest preview action.`,
    })),
    blocked_bridge_capabilities: expectedBlockedBridgeCapabilities.map((key) => ({
      key,
      allowed: false,
      enabled: false,
      reason: `${key} is blocked because Phase 28M is a read-only archive manifest bridge preview contract, not an execution surface.`,
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
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      bridge_preview_only: true,
      manifest_bridge_preview_only: true,
      archive_ready_only: true,
      retention_manifest_only: true,
      raw_json_preview_only: true,
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
      required_top_level_keys: expectedRawJsonTopLevelKeys,
    },
    counts: {
      source_chain: expectedSourceChainPhases.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: manifestRows.length,
      bridge_sections: expectedBridgeSections.length,
      allowed_bridge_actions: expectedAllowedBridgeActions.length,
      blocked_bridge_capabilities: expectedBlockedBridgeCapabilities.length,
      bridge_cards: 6,
      phase_rows: snapshot.phase_rows.length,
      chain_segments: snapshot.chain_segments.length,
      operator_entrypoints: snapshot.operator_entrypoints.length,
      prohibited_actions: snapshot.prohibited_actions.length,
    },
  };

  return {
    ...bridgePayload,
    archive_manifest_bridge_preview_digest: stableDigest(bridgePayload),
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
    assert(serviceText.includes(token), `28M service missing bridge manifest source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28M existing UI HTML missing bridge manifest source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28M existing app.js missing bridge manifest source token: ${token}`);
  }
}

function assertArchiveManifestBridgePreviewContract(preview) {
  assert.equal(
    preview.bridge_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_bridge_preview",
    "28M bridge kind drifted.",
  );
  assert.equal(preview.bridge_version, "phase28m_archive_manifest_bridge_preview_contract_v1", "28M bridge version drifted.");
  assert.equal(preview.bridge_channel, "chatgpt_bridge", "28M bridge channel drifted.");
  assert.equal(preview.bridge_mode, "readonly_preview", "28M bridge mode drifted.");
  assert.equal(preview.bridge_surface, "archive_manifest_retention_bridge_preview", "28M bridge surface drifted.");
  assert.equal(preview.generated_for, "chatgpt_bridge_readable_archive_manifest_handoff", "28M generated_for drifted.");

  assert.equal(
    preview.source_manifest_preview_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
    "28M source manifest preview kind drifted.",
  );
  assert.equal(
    preview.source_manifest_preview_version,
    "phase28l_archive_manifest_ui_preview_contract_v1",
    "28M source manifest preview version drifted.",
  );
  assert.match(preview.source_manifest_preview_digest, /^[a-f0-9]{64}$/u, "28M source manifest digest should be sha256 hex.");
  assert.match(preview.source_archive_readiness_digest, /^[a-f0-9]{64}$/u, "28M archive readiness digest should be sha256 hex.");
  assert.match(preview.source_bridge_preview_digest, /^[a-f0-9]{64}$/u, "28M source bridge digest should be sha256 hex.");
  assert.match(preview.source_ui_preview_digest, /^[a-f0-9]{64}$/u, "28M source UI digest should be sha256 hex.");
  assert.match(preview.source_evidence_packet_digest, /^[a-f0-9]{64}$/u, "28M evidence digest should be sha256 hex.");
  assert.match(preview.source_index_digest, /^[a-f0-9]{64}$/u, "28M source index digest should be sha256 hex.");

  for (const key of [
    "read_only",
    "preview_only",
    "bridge_preview_only",
    "manifest_bridge_preview_only",
    "archive_ready_only",
    "retention_manifest_only",
    "raw_json_preview_only",
  ]) {
    assert.equal(preview[key], true, `28M ${key} must remain true.`);
    assert.equal(preview.safety_boundary[key], true, `28M safety boundary ${key} must remain true.`);
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
    "can_register_mcp_tool",
  ]) {
    assert.equal(preview[key], false, `28M ${key} must remain false.`);
    assert.equal(preview.safety_boundary[key], false, `28M safety boundary ${key} must remain false.`);
  }

  const sourceChain = keyed(preview.source_chain, "28M source chain");
  assert.deepEqual([...sourceChain.keys()], expectedSourceChainPhases, "28M source chain phase order drifted.");
  for (const item of sourceChain.values()) {
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
    assert.equal(typeof item.kind, "string", `${item.phase} kind must be a string.`);
    assert.equal(typeof item.version, "string", `${item.phase} version must be a string.`);
    assert.equal(typeof item.digest_key, "string", `${item.phase} digest key must be a string.`);
  }

  assert.equal(
    sourceChain.get("28L").digest,
    preview.source_manifest_preview_digest,
    "28M source chain 28L digest should match source manifest preview digest.",
  );
  assert.equal(
    sourceChain.get("28K").digest,
    preview.source_archive_readiness_digest,
    "28M source chain 28K digest should match archive readiness digest.",
  );
  assert.equal(
    sourceChain.get("28I").digest,
    preview.source_bridge_preview_digest,
    "28M source chain 28I digest should match source bridge digest.",
  );
  assert.equal(
    sourceChain.get("28H").digest,
    preview.source_ui_preview_digest,
    "28M source chain 28H digest should match source UI digest.",
  );
  assert.equal(
    sourceChain.get("28G").digest,
    preview.source_evidence_packet_digest,
    "28M source chain 28G digest should match evidence packet digest.",
  );
  assert.equal(
    sourceChain.get("28A").digest,
    preview.source_index_digest,
    "28M source chain 28A digest should match source index digest.",
  );

  assert.deepEqual(Object.keys(preview.retention_manifest), expectedRetentionManifestKeys, "28M retention manifest keys drifted.");
  for (const key of expectedRetentionManifestKeys) {
    assert.match(preview.retention_manifest[key], /^[a-f0-9]{64}$/u, `28M ${key} should be sha256 hex.`);
  }

  const manifestRows = keyed(preview.manifest_rows, "28M manifest rows");
  assert.deepEqual([...manifestRows.keys()], expectedRetentionManifestKeys, "28M manifest row order drifted.");
  for (const [index, row] of [...manifestRows.values()].entries()) {
    assert.equal(row.order, index, `${row.key} order drifted.`);
    assert.equal(row.visible, true, `${row.key} should be visible.`);
    assert.equal(row.copyable, true, `${row.key} should be copyable.`);
    assert.equal(row.verified, true, `${row.key} should be verified.`);
    assert.equal(row.retained, true, `${row.key} should be retained.`);
    assert.match(row.digest, /^[a-f0-9]{64}$/u, `${row.key} digest should be sha256 hex.`);
    assert.equal(row.digest, preview.retention_manifest[row.key], `${row.key} digest should match retention manifest.`);
  }

  const bridgeCards = keyed(preview.bridge_cards, "28M bridge cards");
  assert.deepEqual(
    [...bridgeCards.keys()],
    [
      "bridge_status",
      "source_manifest",
      "digest_lineage",
      "retention_manifest",
      "redaction_boundary",
      "forbidden_bridge_actions",
    ],
    "28M bridge card order drifted.",
  );

  assert.equal(typeof preview.bridge_readability.markdown_summary, "string", "28M markdown summary should be a string.");
  assert(
    preview.bridge_readability.markdown_summary.includes("read-only / preview-only"),
    "28M markdown summary should preserve read-only / preview-only warning.",
  );
  assert(
    preview.bridge_readability.markdown_summary.includes("cannot materialize archives"),
    "28M markdown summary should preserve archive materialization warning.",
  );
  assert.equal(preview.bridge_readability.digest_table.length, expectedRetentionManifestKeys.length, "28M digest table count drifted.");

  assert.deepEqual(preview.required_sections, expectedBridgeSections, "28M bridge section order drifted.");

  const allowedActions = keyed(preview.allowed_bridge_actions, "28M allowed bridge actions");
  assert.deepEqual([...allowedActions.keys()], expectedAllowedBridgeActions, "28M allowed bridge action order drifted.");
  for (const action of allowedActions.values()) {
    assert.equal(action.allowed, true, `${action.key} should remain allowed as a read-only bridge action.`);
    assert.equal(action.read_only, true, `${action.key} should remain read-only.`);
    assert(action.reason.includes("read-only"), `${action.key} reason should preserve read-only warning.`);
  }

  const blockedCapabilities = keyed(preview.blocked_bridge_capabilities, "28M blocked bridge capabilities");
  assert.deepEqual([...blockedCapabilities.keys()], expectedBlockedBridgeCapabilities, "28M blocked capability order drifted.");
  for (const capability of blockedCapabilities.values()) {
    assert.equal(capability.allowed, false, `${capability.key} must not be allowed.`);
    assert.equal(capability.enabled, false, `${capability.key} must not be enabled.`);
    assert(capability.reason.includes("not an execution surface"), `${capability.key} reason should preserve execution-surface warning.`);
  }

  assert.equal(preview.ui_preview_route.route, "#writer-workbench", "28M route drifted.");
  assert.equal(preview.ui_preview_route.data_view, "writer-workbench", "28M data view drifted.");
  assert.equal(
    preview.ui_preview_route.existing_panel_id,
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "28M existing panel id drifted.",
  );
  assert.equal(
    preview.ui_preview_route.existing_raw_json_element_id,
    "foreshadowing-settlement-operator-review-chain-index-surface-raw",
    "28M existing raw JSON element id drifted.",
  );
  assert.equal(
    preview.ui_preview_route.manifest_panel_id,
    "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview",
    "28M manifest panel id drifted.",
  );
  assert.equal(
    preview.ui_preview_route.manifest_raw_json_element_id,
    "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview-raw",
    "28M manifest raw JSON element id drifted.",
  );

  assert.equal(preview.redaction_boundary.redacted_raw_sources, true, "28M should preserve redacted raw sources.");
  assert.equal(preview.redaction_boundary.contains_raw_dashboard, false, "28M should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.contains_raw_manual_review_surface, false, "28M should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.contains_unredacted_sources, false, "28M should not contain unredacted sources.");
  assert.equal(preview.redaction_boundary.bridge_contains_raw_dashboard, false, "28M bridge should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.bridge_contains_raw_manual_review_surface, false, "28M bridge should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.bridge_contains_unredacted_sources, false, "28M bridge should not contain unredacted sources.");

  assert.equal(preview.raw_json_preview.available, true, "28M raw JSON preview should be available.");
  assert.equal(preview.raw_json_preview.safe_to_display, true, "28M raw JSON preview should be safe to display.");
  assert.equal(preview.raw_json_preview.element_kind, "pre_json", "28M raw JSON element kind drifted.");
  assert.equal(preview.raw_json_preview.content_type, "application/json", "28M raw JSON content type drifted.");
  assert.equal(preview.raw_json_preview.pretty_print_required, true, "28M raw JSON should require pretty print.");
  assert.equal(preview.raw_json_preview.copyable, true, "28M raw JSON should be copyable.");
  assert.equal(preview.raw_json_preview.redacted_raw_sources, true, "28M raw JSON should preserve redaction.");
  assert.equal(preview.raw_json_preview.contains_raw_dashboard, false, "28M raw JSON must not contain raw dashboard.");
  assert.equal(preview.raw_json_preview.contains_raw_manual_review_surface, false, "28M raw JSON must not contain raw manual surface.");
  assert.equal(preview.raw_json_preview.contains_unredacted_sources, false, "28M raw JSON must not contain unredacted sources.");
  assert.deepEqual(preview.raw_json_preview.required_top_level_keys, expectedRawJsonTopLevelKeys, "28M raw JSON top-level keys drifted.");
  for (const key of preview.raw_json_preview.required_top_level_keys) {
    assert(
      Object.prototype.hasOwnProperty.call(preview, key),
      `28M raw JSON preview requires missing top-level key ${key}.`,
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
    assert.equal(preview.no_mutation_snapshot[key], false, `28M no mutation ${key} must remain false.`);
  }

  assert.equal(preview.counts.source_chain, 7, "28M source chain count drifted.");
  assert.equal(preview.counts.retention_manifest_items, 6, "28M retention manifest count drifted.");
  assert.equal(preview.counts.manifest_rows, 6, "28M manifest row count drifted.");
  assert.equal(preview.counts.bridge_sections, 9, "28M bridge section count drifted.");
  assert.equal(preview.counts.allowed_bridge_actions, 4, "28M allowed action count drifted.");
  assert.equal(preview.counts.blocked_bridge_capabilities, 15, "28M blocked capability count drifted.");
  assert.equal(preview.counts.bridge_cards, 6, "28M bridge card count drifted.");
  assert.equal(preview.counts.phase_rows, 7, "28M phase row count drifted.");
  assert.equal(preview.counts.chain_segments, 3, "28M chain segment count drifted.");
  assert.equal(preview.counts.operator_entrypoints, 3, "28M operator entrypoint count drifted.");
  assert.equal(preview.counts.prohibited_actions, 7, "28M prohibited action count drifted.");

  assert.match(
    preview.archive_manifest_bridge_preview_digest,
    /^[a-f0-9]{64}$/u,
    "28M archive manifest bridge preview digest should be sha256 hex.",
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

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28M active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28M compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28M source index should be ready.");
assert.equal(index.raw_dashboard, null, "28M source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28M source index should omit raw manual review surface.");

const bridgePreview = buildArchiveManifestBridgePreviewContract(index);

assertArchiveManifestBridgePreviewContract(bridgePreview);
assert.deepEqual(
  buildArchiveManifestBridgePreviewContract(index),
  bridgePreview,
  "28M archive manifest bridge preview contract should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28M changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28M changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28M changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28M changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28M changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28M changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28M changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28M changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28M changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28M changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28M created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28M wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28M wrote archive manifest.");

console.log("Phase28M foreshadowing settlement operator review chain index evidence packet archive manifest bridge preview contract tests passed.");


