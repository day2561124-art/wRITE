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
];

const expectedArchiveSections = [
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
];

const expectedRetentionManifestKeys = [
  "source_index_digest",
  "evidence_packet_digest",
  "ui_preview_digest",
  "bridge_preview_digest",
  "handoff_smoke_digest",
  "archive_readiness_digest",
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
    allowed_bridge_actions: [
      "read_evidence_packet_preview",
      "copy_handoff_summary",
      "open_ui_preview_route",
      "inspect_safety_boundary",
    ],
    blocked_bridge_capabilities: [
      "approve",
      "confirm_adoption",
      "activate_engine",
      "write_canon",
      "create_pending_engine_candidate",
      "auto_adopt",
      "auto_settle",
      "update_compressed_rules",
    ].map((key) => ({
      key,
      allowed: false,
      reason: `Bridge preview cannot ${key.replaceAll("_", " ")}; archive readiness remains read-only and preview-only.`,
    })),
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
    sections: [
      {
        key: "source_index",
        ready: index.ok === true,
        digest_source: "28A",
      },
      {
        key: "evidence_packet_export",
        ready: packet.packet_kind === "foreshadowing_settlement_operator_review_chain_index_evidence_packet",
        digest_source: "28G",
      },
      {
        key: "ui_preview",
        ready: uiPreview.preview_kind === "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview",
        digest_source: "28H",
      },
      {
        key: "bridge_preview",
        ready: bridgePreview.bridge_kind === "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview",
        digest_source: "28I",
      },
      {
        key: "operator_handoff",
        ready: Boolean(bridgePreview.headline && bridgePreview.summary && bridgePreview.status_badge),
        digest_source: "28J",
      },
      {
        key: "digest_lineage",
        ready: bridgePreview.source_evidence_digest === packet.evidence_digest
          && bridgePreview.source_ui_preview_digest === uiPreview.preview_digest,
        digest_source: "28G-28I",
      },
      {
        key: "redaction",
        ready: bridgePreview.raw_packet_preview.redacted_raw_sources === true
          && bridgePreview.raw_packet_preview.contains_raw_dashboard === false
          && bridgePreview.raw_packet_preview.contains_raw_manual_review_surface === false,
        digest_source: "28I",
      },
      {
        key: "safety_boundary",
        ready: bridgePreview.read_only === true
          && bridgePreview.preview_only === true
          && bridgePreview.bridge_preview_only === true
          && bridgePreview.can_approve === false
          && bridgePreview.can_confirm_adoption === false
          && bridgePreview.can_activate_engine === false
          && bridgePreview.can_write_canon === false
          && bridgePreview.can_create_pending_engine_candidate === false
          && bridgePreview.can_update_compressed_rules === false,
        digest_source: "28I",
      },
    ],
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
    all_sections_ready: finalSmokePayload.sections.every((section) => section.ready === true),
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
      {
        key: "archive_metadata",
        ready: true,
        retained: true,
      },
      {
        key: "source_lineage",
        ready: finalSmoke.source_chain.length === 4,
        retained: true,
      },
      {
        key: "digest_chain",
        ready: finalSmoke.source_chain.every((item) => /^[a-f0-9]{64}$/u.test(item.digest)),
        retained: true,
      },
      {
        key: "handoff_summary",
        ready: Boolean(finalSmoke.final_handoff.headline && finalSmoke.final_handoff.summary),
        retained: true,
      },
      {
        key: "readability_snapshot",
        ready: bridgePreview.bridge_readability.compact_cards.length === packet.contents.cards.length,
        retained: true,
      },
      {
        key: "redaction_boundary",
        ready: bridgePreview.raw_packet_preview.redacted_raw_sources === true
          && bridgePreview.raw_packet_preview.contains_raw_dashboard === false
          && bridgePreview.raw_packet_preview.contains_raw_manual_review_surface === false,
        retained: true,
      },
      {
        key: "safety_boundary",
        ready: finalSmoke.safety_boundary.read_only === true
          && finalSmoke.safety_boundary.preview_only === true
          && finalSmoke.safety_boundary.can_write_canon === false,
        retained: true,
      },
      {
        key: "retention_manifest",
        ready: true,
        retained: true,
      },
      {
        key: "forbidden_archive_actions",
        ready: true,
        retained: true,
      },
      {
        key: "no_mutation_snapshot",
        ready: packet.contents.safety_boundary.active_engine_modified === false
          && packet.contents.safety_boundary.compressed_rules_modified === false
          && bridgePreview.no_mutation_side_effects === true,
        retained: true,
      },
    ],
    forbidden_archive_actions: expectedForbiddenArchiveActions.map((key) => ({
      key,
      allowed: false,
      reason: `${key} is forbidden because archive readiness is a retained evidence preview, not an execution surface.`,
    })),
    counts: {
      source_chain: finalSmoke.source_chain.length,
      archive_sections: expectedArchiveSections.length,
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
    },
  };

  return {
    ...archivePayload,
    archive_readiness_digest: stableDigest(archivePayload),
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
    assert(serviceText.includes(token), `28K service missing archive readiness source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28K UI HTML missing archive readiness source token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28K app.js missing archive readiness source token: ${token}`);
  }
}

function assertArchiveReadinessContract(archive, { packet, uiPreview, bridgePreview, finalSmoke }) {
  assert.equal(archive.archive_kind, "foreshadowing_settlement_operator_review_chain_index_evidence_packet_archive_readiness", "28K archive kind drifted.");
  assert.equal(archive.archive_version, "phase28k_archive_readiness_contract_v1", "28K archive version drifted.");
  assert.equal(archive.archive_mode, "archive_ready_only", "28K archive mode drifted.");
  assert.equal(archive.archive_surface, "operator_handoff_evidence_packet_archive", "28K archive surface drifted.");
  assert.equal(archive.generated_for, "audit_retention_readiness", "28K generated_for drifted.");

  for (const key of [
    "ready_for_archive",
    "archive_ready_only",
    "read_only",
    "preview_only",
    "export_only",
    "bridge_preview_only",
    "final_smoke_only",
  ]) {
    assert.equal(archive[key], true, `28K ${key} must remain true.`);
  }

  for (const key of [
    "can_archive_materialize_file",
    "can_write_archive_index",
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
    assert.equal(archive[key], false, `28K ${key} must remain false.`);
  }

  assert.equal(archive.retention_manifest.evidence_packet_digest, packet.evidence_digest, "28K evidence packet digest drifted.");
  assert.equal(archive.retention_manifest.ui_preview_digest, uiPreview.preview_digest, "28K UI preview digest drifted.");
  assert.equal(archive.retention_manifest.bridge_preview_digest, bridgePreview.bridge_preview_digest, "28K bridge preview digest drifted.");
  assert.equal(archive.retention_manifest.handoff_smoke_digest, finalSmoke.handoff_smoke_digest, "28K final smoke digest drifted.");

  const retentionKeys = Object.keys(archive.retention_manifest);
  assert.deepEqual(retentionKeys, expectedRetentionManifestKeys.slice(0, -1), "28K retention manifest source keys drifted before digest append.");
  const archiveWithDigestManifest = {
    ...archive.retention_manifest,
    archive_readiness_digest: archive.archive_readiness_digest,
  };
  assert.deepEqual(Object.keys(archiveWithDigestManifest), expectedRetentionManifestKeys, "28K retention manifest keys drifted.");

  const sections = keyed(archive.sections, "28K archive sections");
  assert.deepEqual([...sections.keys()], expectedArchiveSections, "28K archive section order drifted.");
  for (const section of sections.values()) {
    assert.equal(section.ready, true, `${section.key} archive section is not ready.`);
    assert.equal(section.retained, true, `${section.key} archive section should be retained.`);
  }

  const forbidden = keyed(archive.forbidden_archive_actions, "28K forbidden archive actions");
  assert.deepEqual([...forbidden.keys()], expectedForbiddenArchiveActions, "28K forbidden archive action order drifted.");
  for (const action of forbidden.values()) {
    assert.equal(action.allowed, false, `${action.key} became allowed.`);
    assert.equal(typeof action.reason, "string", `${action.key} reason must be a string.`);
    assert(action.reason.includes("not an execution surface"), `${action.key} reason must preserve execution-surface warning.`);
  }

  assert.equal(archive.counts.source_chain, 4, "28K source chain count drifted.");
  assert.equal(archive.counts.archive_sections, 10, "28K archive section count drifted.");
  assert.equal(archive.counts.retention_manifest_items, 6, "28K retention manifest count drifted.");
  assert.equal(archive.counts.forbidden_archive_actions, 10, "28K forbidden archive action count drifted.");
  assert.equal(archive.counts.cards, 6, "28K card count drifted.");
  assert.equal(archive.counts.phase_rows, 7, "28K phase row count drifted.");
  assert.equal(archive.counts.chain_segments, 3, "28K chain segment count drifted.");
  assert.equal(archive.counts.operator_entrypoints, 3, "28K operator entrypoint count drifted.");
  assert.equal(archive.counts.prohibited_actions, 7, "28K prohibited action count drifted.");

  assert.equal(archive.redaction_boundary.redacted_raw_sources, true, "28K redaction boundary should redact raw sources.");
  assert.equal(archive.redaction_boundary.contains_raw_dashboard, false, "28K archive should not contain raw dashboard.");
  assert.equal(archive.redaction_boundary.contains_raw_manual_review_surface, false, "28K archive should not contain raw manual surface.");
  assert.equal(archive.redaction_boundary.raw_dashboard_omitted, true, "28K raw dashboard omission should be explicit.");
  assert.equal(archive.redaction_boundary.raw_manual_review_surface_omitted, true, "28K raw manual surface omission should be explicit.");

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
  ]) {
    assert.equal(archive.no_mutation_snapshot[key], false, `28K no mutation ${key} must remain false.`);
  }

  assert.match(archive.archive_readiness_digest, /^[a-f0-9]{64}$/u, "28K archive readiness digest should be sha256 hex.");
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

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28K active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28K compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28K source index should be ready.");
assert.equal(index.raw_dashboard, null, "28K source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28K source index should omit raw manual review surface.");

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

assertArchiveReadinessContract(archive, { packet, uiPreview, bridgePreview, finalSmoke });
assert.deepEqual(
  buildArchiveReadinessContract({ index, packet, uiPreview, bridgePreview, finalSmoke }),
  archive,
  "28K archive readiness contract should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28K changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28K changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28K changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28K changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28K changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28K changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28K changed approval log.");
assert.deepEqual(await readOptionalDirectory(backupProjectDir), backupProjectBefore, "28K changed project backups.");
assert.deepEqual(await readOptionalDirectory(backupExportsDir), backupExportsBefore, "28K changed backup exports.");
assert.deepEqual(await readOptionalDirectory(restorePreviewsDir), restorePreviewsBefore, "28K changed restore previews.");

console.log("Phase28K foreshadowing settlement operator review chain index evidence packet archive readiness contract tests passed.");