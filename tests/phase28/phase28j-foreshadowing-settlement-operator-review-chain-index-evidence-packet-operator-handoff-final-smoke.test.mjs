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
];

const expectedFinalSmokeSections = [
  "source_index",
  "evidence_packet_export",
  "ui_preview",
  "bridge_preview",
  "operator_handoff",
  "digest_lineage",
  "readability",
  "redaction",
  "safety_boundary",
  "no_mutation_snapshot",
];

const expectedFinalHandoffChecklist = [
  "source_index_ready",
  "evidence_packet_export_ready",
  "ui_preview_ready",
  "bridge_preview_ready",
  "digest_lineage_complete",
  "handoff_summary_complete",
  "raw_sources_redacted",
  "operator_entrypoints_readonly",
  "prohibited_actions_locked",
  "no_mutation_boundary_locked",
];

const expectedBlockedCapabilities = [
  "approve",
  "confirm_adoption",
  "activate_engine",
  "write_canon",
  "create_pending_engine_candidate",
  "auto_adopt",
  "auto_settle",
  "update_compressed_rules",
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
    blocked_bridge_capabilities: expectedBlockedCapabilities.map((key) => ({
      key,
      allowed: false,
      reason: `Bridge preview cannot ${key.replaceAll("_", " ")}; this final smoke is read-only and preview-only.`,
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
  const finalSmokePayload = {
    smoke_kind: "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke",
    smoke_version: "phase28j_operator_handoff_final_smoke_v1",
    source_chain: [
      {
        phase: "28A",
        kind: index.index_kind,
        version: index.version,
        digest: stableDigest({
          index_kind: index.index_kind,
          version: index.version,
          phase: index.phase,
          source_phase: index.source_phase,
          source_phases: index.source_phases,
          index_status: index.index_status,
          decision: index.decision,
        }),
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
        key: "readability",
        ready: bridgePreview.bridge_readability.markdown_summary.includes(packet.evidence_digest)
          && bridgePreview.bridge_readability.compact_cards.length === packet.contents.cards.length,
        digest_source: "28I",
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
      {
        key: "no_mutation_snapshot",
        ready: bridgePreview.no_mutation_side_effects === true
          && packet.contents.safety_boundary.active_engine_modified === false
          && packet.contents.safety_boundary.compressed_rules_modified === false,
        digest_source: "28J",
      },
    ],
    checklist: [
      {
        key: "source_index_ready",
        passed: index.ok === true,
      },
      {
        key: "evidence_packet_export_ready",
        passed: packet.evidence_digest.length === 64,
      },
      {
        key: "ui_preview_ready",
        passed: uiPreview.preview_digest.length === 64,
      },
      {
        key: "bridge_preview_ready",
        passed: bridgePreview.bridge_preview_digest.length === 64,
      },
      {
        key: "digest_lineage_complete",
        passed: bridgePreview.source_evidence_digest === packet.evidence_digest
          && bridgePreview.source_ui_preview_digest === uiPreview.preview_digest,
      },
      {
        key: "handoff_summary_complete",
        passed: Boolean(bridgePreview.headline && bridgePreview.summary && bridgePreview.status_badge),
      },
      {
        key: "raw_sources_redacted",
        passed: bridgePreview.raw_packet_preview.redacted_raw_sources === true
          && bridgePreview.raw_packet_preview.raw_dashboard_omitted === true
          && bridgePreview.raw_packet_preview.raw_manual_review_surface_omitted === true,
      },
      {
        key: "operator_entrypoints_readonly",
        passed: bridgePreview.contents.operator_entrypoints.every((entrypoint) =>
          entrypoint.read_only === true
          && entrypoint.can_approve === false
          && entrypoint.can_confirm_adoption === false
          && entrypoint.can_activate_engine === false
        ),
      },
      {
        key: "prohibited_actions_locked",
        passed: bridgePreview.contents.prohibited_actions.every((action) => action.allowed === false)
          && bridgePreview.blocked_bridge_capabilities.every((capability) => capability.allowed === false),
      },
      {
        key: "no_mutation_boundary_locked",
        passed: bridgePreview.no_mutation_side_effects === true
          && bridgePreview.contents.safety_boundary.active_engine_modified === false
          && bridgePreview.contents.safety_boundary.compressed_rules_modified === false,
      },
    ],
    counts: {
      cards: packet.contents.cards.length,
      phase_rows: packet.contents.phase_rows.length,
      chain_segments: packet.contents.chain_segments.length,
      operator_entrypoints: packet.contents.operator_entrypoints.length,
      prohibited_actions: packet.contents.prohibited_actions.length,
      blocked_bridge_capabilities: bridgePreview.blocked_bridge_capabilities.length,
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

  const finalSmoke = {
    ...finalSmokePayload,
    handoff_smoke_digest: stableDigest(finalSmokePayload),
  };

  return {
    ...finalSmoke,
    all_sections_ready: finalSmoke.sections.every((section) => section.ready === true),
    all_checklist_passed: finalSmoke.checklist.every((item) => item.passed === true),
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
    assert(serviceText.includes(token), `28J service missing final smoke source token: ${token}`);
  }

  for (const token of [
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "Raw foreshadowing settlement operator review chain index",
    "Chain segments",
    "Indexed phases",
    "Operator entrypoints",
    "Prohibited actions",
    "Safety boundary",
  ]) {
    assert(uiIndexText.includes(token), `28J UI HTML missing final smoke target token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28J app.js missing final smoke target token: ${token}`);
  }
}

function assertFinalOperatorHandoffSmoke(finalSmoke, { packet, uiPreview, bridgePreview }) {
  assert.equal(finalSmoke.smoke_kind, "foreshadowing_settlement_operator_review_chain_index_evidence_packet_operator_handoff_final_smoke", "28J smoke kind drifted.");
  assert.equal(finalSmoke.smoke_version, "phase28j_operator_handoff_final_smoke_v1", "28J smoke version drifted.");
  assert.equal(finalSmoke.source_chain.length, 4, "28J source chain should include 28A, 28G, 28H, 28I.");
  assert.deepEqual(finalSmoke.source_chain.map((item) => item.phase), ["28A", "28G", "28H", "28I"], "28J source chain phase order drifted.");

  for (const item of finalSmoke.source_chain) {
    assert.match(item.digest, /^[a-f0-9]{64}$/u, `${item.phase} digest should be sha256 hex.`);
  }

  assert.equal(finalSmoke.source_chain[1].digest, packet.evidence_digest, "28J packet digest lineage drifted.");
  assert.equal(finalSmoke.source_chain[2].digest, uiPreview.preview_digest, "28J UI preview digest lineage drifted.");
  assert.equal(finalSmoke.source_chain[3].digest, bridgePreview.bridge_preview_digest, "28J bridge preview digest lineage drifted.");

  const sections = keyed(finalSmoke.sections, "28J final smoke sections");
  assert.deepEqual([...sections.keys()], expectedFinalSmokeSections, "28J final smoke section order drifted.");
  for (const section of sections.values()) {
    assert.equal(section.ready, true, `${section.key} section is not ready.`);
    assert.equal(typeof section.digest_source, "string", `${section.key} digest source must be a string.`);
    assert(section.digest_source.trim().length > 0, `${section.key} digest source must not be empty.`);
  }

  const checklist = keyed(finalSmoke.checklist, "28J final smoke checklist");
  assert.deepEqual([...checklist.keys()], expectedFinalHandoffChecklist, "28J final smoke checklist order drifted.");
  for (const item of checklist.values()) {
    assert.equal(item.passed, true, `${item.key} checklist item failed.`);
  }

  assert.equal(finalSmoke.all_sections_ready, true, "28J all sections should be ready.");
  assert.equal(finalSmoke.all_checklist_passed, true, "28J all checklist items should pass.");

  assert.equal(finalSmoke.final_handoff.headline, bridgePreview.headline, "28J handoff headline drifted.");
  assert.equal(finalSmoke.final_handoff.summary, bridgePreview.summary, "28J handoff summary drifted.");
  assert.equal(finalSmoke.final_handoff.status_badge, bridgePreview.status_badge, "28J handoff badge drifted.");
  assert.equal(finalSmoke.final_handoff.bridge_channel, "chatgpt_bridge", "28J bridge channel drifted.");
  assert.equal(finalSmoke.final_handoff.bridge_mode, "readonly_preview", "28J bridge mode drifted.");
  assert.equal(finalSmoke.final_handoff.ui_preview_route.panel_id, "foreshadowing-settlement-operator-review-chain-index-surface", "28J handoff UI panel drifted.");

  assert.equal(finalSmoke.counts.cards, 6, "28J should preserve six cards.");
  assert.equal(finalSmoke.counts.phase_rows, 7, "28J should preserve seven phase rows.");
  assert.equal(finalSmoke.counts.chain_segments, 3, "28J should preserve three chain segments.");
  assert.equal(finalSmoke.counts.operator_entrypoints, 3, "28J should preserve three operator entrypoints.");
  assert.equal(finalSmoke.counts.prohibited_actions, 7, "28J should preserve seven prohibited actions.");
  assert.equal(finalSmoke.counts.blocked_bridge_capabilities, 8, "28J should preserve eight blocked capabilities.");

  for (const key of [
    "read_only",
    "preview_only",
    "bridge_preview_only",
    "final_smoke_only",
  ]) {
    assert.equal(finalSmoke.safety_boundary[key], true, `28J safety ${key} must remain true.`);
  }

  for (const key of [
    "can_approve",
    "can_confirm_adoption",
    "can_activate_engine",
    "can_auto_adopt",
    "can_auto_settle",
    "can_write_canon",
    "can_create_pending_engine_candidate",
    "can_update_compressed_rules",
    "active_engine_modified",
    "compressed_rules_modified",
  ]) {
    assert.equal(finalSmoke.safety_boundary[key], false, `28J safety ${key} must remain false.`);
  }

  assert.match(finalSmoke.handoff_smoke_digest, /^[a-f0-9]{64}$/u, "28J handoff smoke digest should be sha256 hex.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28J active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28J compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28J source index should be ready.");
assert.equal(index.raw_dashboard, null, "28J source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28J source index should omit raw manual review surface.");

const packet = buildEvidencePacket(index);
const uiPreview = buildUiPreviewContract(packet);
const bridgePreview = buildBridgePreviewContract(packet, uiPreview);
const finalSmoke = buildFinalOperatorHandoffSmoke({
  index,
  packet,
  uiPreview,
  bridgePreview,
});

assertFinalOperatorHandoffSmoke(finalSmoke, { packet, uiPreview, bridgePreview });
assert.deepEqual(
  buildFinalOperatorHandoffSmoke({ index, packet, uiPreview, bridgePreview }),
  finalSmoke,
  "28J final handoff smoke should be deterministic for the same inputs.",
);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28J changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28J changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28J changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28J changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28J changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28J changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28J changed approval log.");

console.log("Phase28J foreshadowing settlement operator review chain index evidence packet operator handoff final smoke tests passed.");