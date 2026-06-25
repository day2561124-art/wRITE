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
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
];

const expectedManifestUiSections = [
  "manifest_header",
  "digest_lineage",
  "retention_manifest",
  "redaction_boundary",
  "forbidden_archive_actions",
  "no_mutation_snapshot",
  "operator_handoff_summary",
  "raw_json_contract",
];

const expectedForbiddenArchiveActions = [
  "archive_can_approve",
  "archive_can_confirm_adoption",
  "archive_can_activate_engine",
  "archive_can_write_canon",
  "archive_can_create_pending_engine_candidate",
  "archive_can_auto_adopt",
  "archive_can_auto_settle",
  "archive_can_update_compressed_rules",
  "archive_can_restore_backup",
  "archive_can_rollback",
];

const expectedBlockedArchiveButtons = [
  "materialize_archive_file",
  "write_archive_index",
  ...expectedForbiddenArchiveActions,
];

const expectedRawJsonTopLevelKeys = [
  "preview_kind",
  "preview_version",
  "source_archive_kind",
  "source_archive_version",
  "source_archive_readiness_digest",
  "retention_manifest",
  "manifest_rows",
  "rendering_contract",
  "safety_boundary",
  "raw_json_contract",
  "manifest_preview_digest",
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

function buildEvidencePacket(index) {
  const phaseRows = index.phase_rows.map(summarizePhaseRow);
  const chainSegments = index.chain_segments.map((item) => ({
    key: item.key,
    label: item.label,
    phases: item.phases,
    status: item.status,
    ready: item.ready,
    summary: item.summary,
  }));
  const operatorEntrypoints = index.operator_entrypoints.map((item) => ({
    key: item.key,
    label: item.label,
    route: item.route,
    ui_target: item.ui_target,
    source_phase: item.source_phase,
    priority: item.priority,
    reason: item.reason,
    read_only: item.read_only,
    can_approve: item.can_approve,
    can_confirm_adoption: item.can_confirm_adoption,
    can_activate_engine: item.can_activate_engine,
  }));
  const prohibitedActions = index.prohibited_actions.map((item) => ({
    key: item.key,
    label: item.label,
    allowed: item.allowed,
    reason: item.reason,
  }));
  const cards = index.cards.map((card) => ({
    key: card.key,
    title: card.title,
    value: String(card.value ?? ""),
    tone: card.tone,
    summary: card.summary,
  }));

  const exportPayload = {
    packet_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet",
    packet_version: "phase28g_evidence_packet_export_contract_v1",
    source_index_kind: index.index_kind,
    source_index_version: index.version,
    source_index_phase: index.phase,
    source_phase: index.source_phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
    generated_for: "operator_handoff",
    export_mode: "evidence_packet_shape_only",
    read_only: true,
    preview_only: true,
    export_only: true,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    handoff_summary: {
      headline: index.headline,
      summary: index.summary,
      status_badge: index.status_badge,
      warnings: index.warnings,
      ready_phase_rows: phaseRows.filter((row) => row.loaded).length,
      total_phase_rows: phaseRows.length,
      ready_chain_segments: chainSegments.filter((segment) => segment.ready).length,
      total_chain_segments: chainSegments.length,
      prohibited_actions_locked: prohibitedActions.every((item) => item.allowed === false),
      no_mutation_side_effects: index.checks.no_mutation_side_effects,
    },
    contents: {
      cards,
      chain_segments: chainSegments,
      phase_rows: phaseRows,
      operator_entrypoints: operatorEntrypoints,
      prohibited_actions: prohibitedActions,
      safety_boundary: index.safety,
      checks: index.checks,
      integrity: index.integrity,
      markdown: index.index_markdown,
    },
  };

  return {
    ...exportPayload,
    evidence_digest: stableDigest(exportPayload),
  };
}

function buildUiPreviewContract(packet) {
  const preview = {
    preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview",
    preview_version: "phase28h_evidence_packet_ui_preview_contract_v1",
    source_packet_kind: packet.packet_kind,
    source_packet_version: packet.packet_version,
    source_evidence_digest: packet.evidence_digest,
    panel_id: "foreshadowing-settlement-operator-review-chain-index-surface",
    raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
    route: "#writer-workbench",
    data_view: "writer-workbench",
    read_only: true,
    preview_only: true,
    ui_preview_only: true,
    export_only: true,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    rendered_counts: {
      cards: packet.contents.cards.length,
      phase_rows: packet.contents.phase_rows.length,
      chain_segments: packet.contents.chain_segments.length,
      operator_entrypoints: packet.contents.operator_entrypoints.length,
      prohibited_actions: packet.contents.prohibited_actions.length,
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      ui_preview_only: true,
      export_only: true,
      no_mutation_side_effects: packet.contents.checks.no_mutation_side_effects === true
        && packet.contents.integrity.no_mutation_side_effects === true,
      can_approve: false,
      can_confirm_adoption: false,
      can_activate_engine: false,
      can_auto_adopt: false,
      can_auto_settle: false,
      active_engine_modified: packet.contents.safety_boundary.active_engine_modified,
      compressed_rules_modified: packet.contents.safety_boundary.compressed_rules_modified,
    },
  };

  return {
    ...preview,
    preview_digest: stableDigest(preview),
  };
}

function buildBridgePreviewContract(packet, uiPreview) {
  const bridgePayload = {
    bridge_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview",
    bridge_version: "phase28i_evidence_packet_bridge_preview_contract_v1",
    bridge_channel: "chatgpt_bridge",
    bridge_mode: "readonly_preview",
    bridge_surface: "operator_evidence_packet_preview",
    generated_for: "chatgpt_bridge_readable_operator_handoff",
    source_packet_kind: packet.packet_kind,
    source_packet_version: packet.packet_version,
    source_evidence_digest: packet.evidence_digest,
    source_ui_preview_kind: uiPreview.preview_kind,
    source_ui_preview_version: uiPreview.preview_version,
    source_ui_preview_digest: uiPreview.preview_digest,
    source_index_kind: packet.source_index_kind,
    source_index_version: packet.source_index_version,
    source_index_phase: packet.source_index_phase,
    source_phase: packet.source_phase,
    source_phases: packet.source_phases,
    index_status: packet.index_status,
    decision: packet.decision,
    headline: packet.handoff_summary.headline,
    summary: packet.handoff_summary.summary,
    status_badge: packet.handoff_summary.status_badge,
    warnings: packet.handoff_summary.warnings,
    read_only: true,
    preview_only: true,
    bridge_preview_only: true,
    export_only: true,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    can_write_canon: false,
    can_create_pending_engine_candidate: false,
    can_update_compressed_rules: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    ui_preview_route: {
      route: uiPreview.route,
      data_view: uiPreview.data_view,
      panel_id: uiPreview.panel_id,
      raw_json_element_id: uiPreview.raw_json_element_id,
    },
    rendered_counts: {
      cards: packet.contents.cards.length,
      phase_rows: packet.contents.phase_rows.length,
      chain_segments: packet.contents.chain_segments.length,
      operator_entrypoints: packet.contents.operator_entrypoints.length,
      prohibited_actions: packet.contents.prohibited_actions.length,
    },
    bridge_readability: {
      markdown_summary: [
        `# ${packet.handoff_summary.headline}`,
        "",
        packet.handoff_summary.summary,
        "",
        `Status: ${packet.index_status}`,
        `Decision: ${packet.decision}`,
        `Evidence digest: ${packet.evidence_digest}`,
        `UI preview digest: ${uiPreview.preview_digest}`,
        "",
        "This bridge preview is read-only / preview-only and cannot approve, adopt, settle, activate engine, write Canon, create pending engine candidates, or update compressed_rules.",
      ].join("\n"),
      compact_cards: packet.contents.cards.map((card) => ({
        key: card.key,
        title: card.title,
        value: card.value,
        tone: card.tone,
      })),
    },
    contents: {
      phase_rows: packet.contents.phase_rows,
      chain_segments: packet.contents.chain_segments,
      operator_entrypoints: packet.contents.operator_entrypoints,
      prohibited_actions: packet.contents.prohibited_actions,
      safety_boundary: {
        ...packet.contents.safety_boundary,
        bridge_preview_only: true,
        can_approve: false,
        can_confirm_adoption: false,
        can_activate_engine: false,
        can_auto_adopt: false,
        can_auto_settle: false,
        can_write_canon: false,
        can_create_pending_engine_candidate: false,
        can_update_compressed_rules: false,
      },
    },
    raw_packet_preview: {
      available: true,
      safe_to_display: true,
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      digest: packet.evidence_digest,
    },
    no_mutation_side_effects: packet.contents.checks.no_mutation_side_effects === true
      && packet.contents.integrity.no_mutation_side_effects === true,
  };

  return {
    ...bridgePayload,
    bridge_preview_digest: stableDigest(bridgePayload),
  };
}

function buildFinalOperatorHandoffSmoke({ index, packet, uiPreview, bridgePreview }) {
  const sourceIndexDigest = stableDigest({
    index_kind: index.index_kind,
    version: index.version,
    phase: index.phase,
    source_phase: index.source_phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
  });

  const finalSmokePayload = {
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke",
    smoke_version: "phase28j_operator_handoff_final_smoke_v1",
    source_chain: [
      {
        phase: "28A",
        kind: index.index_kind,
        version: index.version,
        digest: sourceIndexDigest,
      },
      {
        phase: "28G",
        kind: packet.packet_kind,
        version: packet.packet_version,
        digest: packet.evidence_digest,
      },
      {
        phase: "28H",
        kind: uiPreview.preview_kind,
        version: uiPreview.preview_version,
        digest: uiPreview.preview_digest,
      },
      {
        phase: "28I",
        kind: bridgePreview.bridge_kind,
        version: bridgePreview.bridge_version,
        digest: bridgePreview.bridge_preview_digest,
      },
    ],
    final_handoff: {
      headline: bridgePreview.headline,
      summary: bridgePreview.summary,
      status_badge: bridgePreview.status_badge,
      generated_for: "operator_handoff_final_smoke",
      bridge_channel: bridgePreview.bridge_channel,
      bridge_mode: bridgePreview.bridge_mode,
      ui_preview_route: bridgePreview.ui_preview_route,
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      bridge_preview_only: true,
      final_smoke_only: true,
      can_approve: false,
      can_confirm_adoption: false,
      can_activate_engine: false,
      can_auto_adopt: false,
      can_auto_settle: false,
      can_write_canon: false,
      can_create_pending_engine_candidate: false,
      can_update_compressed_rules: false,
      active_engine_modified: false,
      compressed_rules_modified: false,
    },
  };

  return {
    ...finalSmokePayload,
    handoff_smoke_digest: stableDigest(finalSmokePayload),
    all_sections_ready: true,
  };
}

function buildArchiveReadinessContract({ index, packet, uiPreview, bridgePreview, finalSmoke }) {
  const archivePayload = {
    archive_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_readiness",
    archive_version: "phase28k_archive_readiness_contract_v1",
    archive_mode: "archive_ready_only",
    archive_surface: "operator_handoff_evidence_packet_archive",
    generated_for: "audit_retention_readiness",
    source_index_kind: index.index_kind,
    source_index_version: index.version,
    source_index_phase: index.phase,
    source_phase: index.source_phase,
    source_phases: index.source_phases,
    index_status: index.index_status,
    decision: index.decision,
    ready_for_archive: true,
    archive_ready_only: true,
    read_only: true,
    preview_only: true,
    export_only: true,
    bridge_preview_only: true,
    final_smoke_only: true,
    can_archive_materialize_file: false,
    can_write_archive_index: false,
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
    retention_manifest: {
      source_index_digest: finalSmoke.source_chain[0].digest,
      evidence_packet_digest: packet.evidence_digest,
      ui_preview_digest: uiPreview.preview_digest,
      bridge_preview_digest: bridgePreview.bridge_preview_digest,
      handoff_smoke_digest: finalSmoke.handoff_smoke_digest,
    },
    archive_metadata: {
      packet_kind: packet.packet_kind,
      packet_version: packet.packet_version,
      ui_preview_kind: uiPreview.preview_kind,
      ui_preview_version: uiPreview.preview_version,
      bridge_kind: bridgePreview.bridge_kind,
      bridge_version: bridgePreview.bridge_version,
      handoff_smoke_kind: finalSmoke.smoke_kind,
      handoff_smoke_version: finalSmoke.smoke_version,
    },
    handoff_summary: {
      headline: finalSmoke.final_handoff.headline,
      summary: finalSmoke.final_handoff.summary,
      status_badge: finalSmoke.final_handoff.status_badge,
      route: finalSmoke.final_handoff.ui_preview_route.route,
      panel_id: finalSmoke.final_handoff.ui_preview_route.panel_id,
      raw_json_element_id: finalSmoke.final_handoff.ui_preview_route.raw_json_element_id,
    },
    sections: [
      "archive_metadata",
      "source_lineage",
      "digest_chain",
      "handoff_summary",
      "readability_snapshot",
      "redaction_boundary",
      "safety_boundary",
      "retention_manifest",
      "forbidden_archive_actions",
      "no_mutation_snapshot",
    ].map((key) => ({
      key,
      ready: true,
      retained: true,
    })),
    forbidden_archive_actions: expectedForbiddenArchiveActions.map((key) => ({
      key,
      allowed: false,
      reason: `${key} is forbidden because archive readiness is a retained evidence preview, not an execution surface.`,
    })),
    counts: {
      source_chain: finalSmoke.source_chain.length,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      forbidden_archive_actions: expectedForbiddenArchiveActions.length,
      cards: packet.contents.cards.length,
      phase_rows: packet.contents.phase_rows.length,
      chain_segments: packet.contents.chain_segments.length,
      operator_entrypoints: packet.contents.operator_entrypoints.length,
      prohibited_actions: packet.contents.prohibited_actions.length,
    },
    redaction_boundary: {
      redacted_raw_sources: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
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
    },
  };

  return {
    ...archivePayload,
    archive_readiness_digest: stableDigest(archivePayload),
  };
}

function buildArchiveManifestUiPreviewContract({ archive, bridgePreview }) {
  const retentionManifest = {
    ...archive.retention_manifest,
    archive_readiness_digest: archive.archive_readiness_digest,
  };

  const phaseByManifestKey = {
    source_index_digest: "28A",
    evidence_packet_digest: "28G",
    ui_preview_digest: "28H",
    bridge_preview_digest: "28I",
    handoff_smoke_digest: "28J",
    archive_readiness_digest: "28K",
  };

  const labelByManifestKey = {
    source_index_digest: "Source index digest",
    evidence_packet_digest: "Evidence packet digest",
    ui_preview_digest: "UI preview digest",
    bridge_preview_digest: "Bridge preview digest",
    handoff_smoke_digest: "Operator handoff smoke digest",
    archive_readiness_digest: "Archive readiness digest",
  };

  const manifestRows = Object.entries(retentionManifest).map(([key, digest], order) => ({
    key,
    label: labelByManifestKey[key],
    source_phase: phaseByManifestKey[key],
    digest,
    order,
    visible: true,
    copyable: true,
    verified: /^[a-f0-9]{64}$/u.test(digest),
    retained: true,
  }));

  const previewPayload = {
    preview_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
    preview_version: "phase28l_archive_manifest_ui_preview_contract_v1",
    preview_mode: "archive_manifest_ui_preview_only",
    preview_surface: "archive_manifest_retention_preview",
    generated_for: "operator_audit_retention_manifest_review",
    source_archive_kind: archive.archive_kind,
    source_archive_version: archive.archive_version,
    source_archive_readiness_digest: archive.archive_readiness_digest,
    source_archive_mode: archive.archive_mode,
    source_handoff_smoke_digest: archive.retention_manifest.handoff_smoke_digest,
    source_bridge_preview_digest: archive.retention_manifest.bridge_preview_digest,
    source_ui_preview_digest: archive.retention_manifest.ui_preview_digest,
    route: archive.handoff_summary.route,
    data_view: bridgePreview.ui_preview_route.data_view,
    panel_contract: {
      runtime_mount_required: false,
      runtime_ui_modified: false,
      uses_existing_review_chain_index_surface: true,
      existing_panel_id: archive.handoff_summary.panel_id,
      existing_raw_json_element_id: archive.handoff_summary.raw_json_element_id,
      manifest_panel_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview",
      manifest_raw_json_element_id: "foreshadowing-settlement-operator-review-chain-index-archive-manifest-preview-raw",
      render_target: "contract_only_not_runtime_dom",
    },
    read_only: true,
    preview_only: true,
    ui_preview_only: true,
    manifest_preview_only: true,
    archive_ready_only: true,
    retention_manifest_only: true,
    raw_json_contract_only: true,
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
    source_chain: [
      {
        phase: "28A",
        digest_key: "source_index_digest",
        digest: retentionManifest.source_index_digest,
      },
      {
        phase: "28G",
        digest_key: "evidence_packet_digest",
        digest: retentionManifest.evidence_packet_digest,
      },
      {
        phase: "28H",
        digest_key: "ui_preview_digest",
        digest: retentionManifest.ui_preview_digest,
      },
      {
        phase: "28I",
        digest_key: "bridge_preview_digest",
        digest: retentionManifest.bridge_preview_digest,
      },
      {
        phase: "28J",
        digest_key: "handoff_smoke_digest",
        digest: retentionManifest.handoff_smoke_digest,
      },
      {
        phase: "28K",
        digest_key: "archive_readiness_digest",
        digest: retentionManifest.archive_readiness_digest,
      },
    ],
    retention_manifest: retentionManifest,
    manifest_rows: manifestRows,
    cards: [
      {
        key: "archive_status",
        title: "Archive readiness",
        value: archive.ready_for_archive === true ? "archive-ready preview" : "not ready",
        tone: "safe",
      },
      {
        key: "digest_lineage",
        title: "Digest lineage",
        value: `${manifestRows.filter((row) => row.verified).length}/${manifestRows.length} verified`,
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
        key: "forbidden_archive_actions",
        title: "Forbidden archive actions",
        value: `${expectedBlockedArchiveButtons.length} blocked UI actions`,
        tone: "blocked",
      },
      {
        key: "no_mutation_snapshot",
        title: "No mutation snapshot",
        value: "active_engine / compressed_rules / Canon unchanged",
        tone: "safe",
      },
    ],
    rendering_contract: {
      layout: "summary_cards_then_digest_table_then_raw_json",
      required_sections: expectedManifestUiSections,
      digest_table_columns: [
        "order",
        "source_phase",
        "label",
        "digest",
        "visible",
        "copyable",
        "verified",
      ],
      required_card_keys: [
        "archive_status",
        "digest_lineage",
        "retention_manifest",
        "redaction_boundary",
        "forbidden_archive_actions",
        "no_mutation_snapshot",
      ],
      blocked_buttons: expectedBlockedArchiveButtons.map((key) => ({
        key,
        visible: true,
        enabled: false,
        allowed: false,
        reason: `${key} is not available in Phase 28L because archive manifest UI preview is contract-only.`,
      })),
      operator_handoff_summary: {
        headline: archive.handoff_summary.headline,
        summary: archive.handoff_summary.summary,
        status_badge: archive.handoff_summary.status_badge,
        route: archive.handoff_summary.route,
      },
    },
    redaction_boundary: {
      ...archive.redaction_boundary,
      manifest_contains_raw_dashboard: false,
      manifest_contains_raw_manual_review_surface: false,
      manifest_contains_unredacted_sources: false,
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      ui_preview_only: true,
      manifest_preview_only: true,
      archive_ready_only: true,
      retention_manifest_only: true,
      raw_json_contract_only: true,
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
      active_engine_modified: false,
      compressed_rules_modified: false,
    },
    no_mutation_snapshot: {
      ...archive.no_mutation_snapshot,
      archive_file_created: false,
      archive_index_written: false,
      archive_manifest_written: false,
      runtime_ui_modified: false,
      runtime_service_modified: false,
      mcp_tool_added: false,
      bridge_tool_added: false,
    },
    raw_json_contract: {
      element_kind: "pre_json",
      content_type: "application/json",
      safe_to_display: true,
      redacted_raw_sources: true,
      pretty_print_required: true,
      copyable: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      contains_unredacted_sources: false,
      required_top_level_keys: expectedRawJsonTopLevelKeys,
    },
    counts: {
      source_chain: 6,
      retention_manifest_items: expectedRetentionManifestKeys.length,
      manifest_rows: manifestRows.length,
      manifest_sections: expectedManifestUiSections.length,
      cards: 6,
      blocked_buttons: expectedBlockedArchiveButtons.length,
      forbidden_archive_actions: expectedForbiddenArchiveActions.length,
    },
  };

  return {
    ...previewPayload,
    manifest_preview_digest: stableDigest(previewPayload),
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
    assert(serviceText.includes(token), `28L service missing manifest source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28L existing UI HTML missing manifest preview source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28L existing app.js missing manifest preview source token: ${token}`);
  }
}

function assertArchiveManifestUiPreviewContract(preview, { archive, bridgePreview }) {
  assert.equal(
    preview.preview_kind,
    "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_manifest_ui_preview",
    "28L preview kind drifted.",
  );
  assert.equal(preview.preview_version, "phase28l_archive_manifest_ui_preview_contract_v1", "28L preview version drifted.");
  assert.equal(preview.preview_mode, "archive_manifest_ui_preview_only", "28L preview mode drifted.");
  assert.equal(preview.preview_surface, "archive_manifest_retention_preview", "28L preview surface drifted.");
  assert.equal(preview.generated_for, "operator_audit_retention_manifest_review", "28L generated_for drifted.");

  assert.equal(preview.source_archive_kind, archive.archive_kind, "28L source archive kind drifted.");
  assert.equal(preview.source_archive_version, archive.archive_version, "28L source archive version drifted.");
  assert.equal(preview.source_archive_readiness_digest, archive.archive_readiness_digest, "28L source archive digest drifted.");
  assert.equal(preview.source_archive_mode, "archive_ready_only", "28L source archive mode drifted.");
  assert.equal(preview.route, archive.handoff_summary.route, "28L route drifted.");
  assert.equal(preview.data_view, bridgePreview.ui_preview_route.data_view, "28L data_view drifted.");

  for (const key of [
    "read_only",
    "preview_only",
    "ui_preview_only",
    "manifest_preview_only",
    "archive_ready_only",
    "retention_manifest_only",
    "raw_json_contract_only",
  ]) {
    assert.equal(preview[key], true, `28L ${key} must remain true.`);
    assert.equal(preview.safety_boundary[key], true, `28L safety boundary ${key} must remain true.`);
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
  ]) {
    assert.equal(preview[key], false, `28L ${key} must remain false.`);
    assert.equal(preview.safety_boundary[key], false, `28L safety boundary ${key} must remain false.`);
  }

  assert.equal(preview.panel_contract.runtime_mount_required, false, "28L must not require runtime UI mount.");
  assert.equal(preview.panel_contract.runtime_ui_modified, false, "28L must not modify runtime UI.");
  assert.equal(preview.panel_contract.uses_existing_review_chain_index_surface, true, "28L should reuse existing review chain index surface contract.");
  assert.equal(preview.panel_contract.existing_panel_id, archive.handoff_summary.panel_id, "28L existing panel id drifted.");
  assert.equal(preview.panel_contract.existing_raw_json_element_id, archive.handoff_summary.raw_json_element_id, "28L existing raw JSON id drifted.");
  assert.equal(preview.panel_contract.render_target, "contract_only_not_runtime_dom", "28L render target must remain contract-only.");

  assert.deepEqual(Object.keys(preview.retention_manifest), expectedRetentionManifestKeys, "28L retention manifest keys drifted.");
  for (const key of expectedRetentionManifestKeys) {
    assert.match(preview.retention_manifest[key], /^[a-f0-9]{64}$/u, `28L ${key} should be sha256 hex.`);
  }

  assert.equal(preview.retention_manifest.source_index_digest, archive.retention_manifest.source_index_digest, "28L source index digest drifted.");
  assert.equal(preview.retention_manifest.evidence_packet_digest, archive.retention_manifest.evidence_packet_digest, "28L evidence digest drifted.");
  assert.equal(preview.retention_manifest.ui_preview_digest, archive.retention_manifest.ui_preview_digest, "28L UI preview digest drifted.");
  assert.equal(preview.retention_manifest.bridge_preview_digest, archive.retention_manifest.bridge_preview_digest, "28L bridge preview digest drifted.");
  assert.equal(preview.retention_manifest.handoff_smoke_digest, archive.retention_manifest.handoff_smoke_digest, "28L handoff smoke digest drifted.");
  assert.equal(preview.retention_manifest.archive_readiness_digest, archive.archive_readiness_digest, "28L archive readiness digest drifted.");

  const manifestRows = keyed(preview.manifest_rows, "28L manifest rows");
  assert.deepEqual([...manifestRows.keys()], expectedRetentionManifestKeys, "28L manifest row order drifted.");
  for (const [index, row] of [...manifestRows.values()].entries()) {
    assert.equal(row.order, index, `${row.key} order drifted.`);
    assert.equal(row.visible, true, `${row.key} should be visible.`);
    assert.equal(row.copyable, true, `${row.key} should be copyable.`);
    assert.equal(row.verified, true, `${row.key} should be verified.`);
    assert.equal(row.retained, true, `${row.key} should be retained.`);
    assert.match(row.digest, /^[a-f0-9]{64}$/u, `${row.key} digest should be sha256 hex.`);
  }

  const sections = preview.rendering_contract.required_sections;
  assert.deepEqual(sections, expectedManifestUiSections, "28L manifest UI section order drifted.");

  const cards = keyed(preview.cards, "28L manifest cards");
  assert.deepEqual(
    [...cards.keys()],
    [
      "archive_status",
      "digest_lineage",
      "retention_manifest",
      "redaction_boundary",
      "forbidden_archive_actions",
      "no_mutation_snapshot",
    ],
    "28L card order drifted.",
  );

  const blockedButtons = keyed(preview.rendering_contract.blocked_buttons, "28L blocked buttons");
  assert.deepEqual([...blockedButtons.keys()], expectedBlockedArchiveButtons, "28L blocked button order drifted.");
  for (const button of blockedButtons.values()) {
    assert.equal(button.visible, true, `${button.key} should remain visible as disabled affordance.`);
    assert.equal(button.enabled, false, `${button.key} must not be enabled.`);
    assert.equal(button.allowed, false, `${button.key} must not be allowed.`);
    assert(button.reason.includes("contract-only"), `${button.key} reason should preserve contract-only warning.`);
  }

  assert.equal(preview.redaction_boundary.redacted_raw_sources, true, "28L should preserve redacted raw sources.");
  assert.equal(preview.redaction_boundary.contains_raw_dashboard, false, "28L should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.contains_raw_manual_review_surface, false, "28L should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.manifest_contains_raw_dashboard, false, "28L manifest should not contain raw dashboard.");
  assert.equal(preview.redaction_boundary.manifest_contains_raw_manual_review_surface, false, "28L manifest should not contain raw manual review surface.");
  assert.equal(preview.redaction_boundary.manifest_contains_unredacted_sources, false, "28L manifest should not contain unredacted sources.");

  assert.equal(preview.raw_json_contract.element_kind, "pre_json", "28L raw JSON element kind drifted.");
  assert.equal(preview.raw_json_contract.content_type, "application/json", "28L raw JSON content type drifted.");
  assert.equal(preview.raw_json_contract.safe_to_display, true, "28L raw JSON should be safe to display.");
  assert.equal(preview.raw_json_contract.redacted_raw_sources, true, "28L raw JSON should preserve redaction.");
  assert.equal(preview.raw_json_contract.pretty_print_required, true, "28L raw JSON should require pretty print.");
  assert.equal(preview.raw_json_contract.copyable, true, "28L raw JSON should be copyable.");
  assert.equal(preview.raw_json_contract.contains_raw_dashboard, false, "28L raw JSON must not contain raw dashboard.");
  assert.equal(preview.raw_json_contract.contains_raw_manual_review_surface, false, "28L raw JSON must not contain raw manual surface.");
  assert.equal(preview.raw_json_contract.contains_unredacted_sources, false, "28L raw JSON must not contain unredacted sources.");
  assert.deepEqual(preview.raw_json_contract.required_top_level_keys, expectedRawJsonTopLevelKeys, "28L raw JSON top-level keys drifted.");
  for (const key of preview.raw_json_contract.required_top_level_keys) {
    assert(
      Object.prototype.hasOwnProperty.call(preview, key),
      `28L raw JSON contract requires missing top-level key ${key}.`,
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
    "mcp_tool_added",
    "bridge_tool_added",
  ]) {
    assert.equal(preview.no_mutation_snapshot[key], false, `28L no mutation ${key} must remain false.`);
  }

  assert.equal(preview.counts.source_chain, 6, "28L source chain count drifted.");
  assert.equal(preview.counts.retention_manifest_items, 6, "28L retention manifest count drifted.");
  assert.equal(preview.counts.manifest_rows, 6, "28L manifest row count drifted.");
  assert.equal(preview.counts.manifest_sections, 8, "28L manifest section count drifted.");
  assert.equal(preview.counts.cards, 6, "28L card count drifted.");
  assert.equal(preview.counts.blocked_buttons, 12, "28L blocked button count drifted.");
  assert.equal(preview.counts.forbidden_archive_actions, 10, "28L forbidden archive action count drifted.");

  assert.match(preview.manifest_preview_digest, /^[a-f0-9]{64}$/u, "28L manifest preview digest should be sha256 hex.");
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

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28L active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28L compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28L source index should be ready.");
assert.equal(index.raw_dashboard, null, "28L source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28L source index should omit raw manual review surface.");

const packet = buildEvidencePacket(index);
const uiPreview = buildUiPreviewContract(packet);
const bridgePreview = buildBridgePreviewContract(packet, uiPreview);
const finalSmoke = buildFinalOperatorHandoffSmoke({ index, packet, uiPreview, bridgePreview });
const archive = buildArchiveReadinessContract({
  index,
  packet,
  uiPreview,
  bridgePreview,
  finalSmoke,
});
const manifestUiPreview = buildArchiveManifestUiPreviewContract({ archive, bridgePreview });

assertArchiveManifestUiPreviewContract(manifestUiPreview, { archive, bridgePreview });
assert.deepEqual(
  buildArchiveManifestUiPreviewContract({ archive, bridgePreview }),
  manifestUiPreview,
  "28L archive manifest UI preview contract should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28L changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28L changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28L changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28L changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28L changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28L changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28L changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28L changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28L changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28L changed restore previews.");
assert.deepEqual(await readOptionalDirectory(archiveFilesDir), archiveFilesBefore, "28L created archive files.");
assert.deepEqual(await readOptionalDirectory(archiveIndexDir), archiveIndexBefore, "28L wrote archive index.");
assert.deepEqual(await readOptionalDirectory(archiveManifestDir), archiveManifestBefore, "28L wrote archive manifest.");

console.log("Phase28L foreshadowing settlement operator review chain index evidence packet archive manifest UI preview contract tests passed.");
