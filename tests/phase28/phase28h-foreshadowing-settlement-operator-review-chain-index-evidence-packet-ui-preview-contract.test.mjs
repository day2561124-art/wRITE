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
const uiIndexPath = path.join(rootDir, "server", "ui", "index.html");
const uiAppPath = path.join(rootDir, "server", "ui", "app.js");
const servicePath = path.join(
  rootDir,
  "server",
  "src",
  "foreshadowing-settlement-operator-review-chain-index-service.mjs",
);

const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const settlementContextsDir = path.join(rootDir, "data", "outputs", "settlement_contexts");
const settlementReportsDir = path.join(rootDir, "data", "outputs", "settlement_reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "approval_log.jsonl");

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
];

const expectedPreviewSectionKeys = [
  "packet_metadata",
  "source_lineage",
  "handoff_summary",
  "phase_rows",
  "chain_segments",
  "operator_entrypoints",
  "prohibited_actions",
  "safety_boundary",
  "evidence_digest",
  "raw_json_preview",
];

const expectedUiPanelTokens = [
  "foreshadowing-settlement-operator-review-chain-index-surface",
  "READ-ONLY REVIEW CHAIN INDEX",
  "Foreshadowing Settlement Operator Review Chain Index",
  "Phase 27R through",
  "Phase 27Z operator-facing review chain",
  "Chain segments",
  "foreshadowing-settlement-operator-review-chain-index-surface-chain",
  "Indexed phases",
  "foreshadowing-settlement-operator-review-chain-index-surface-phases",
  "Operator entrypoints",
  "foreshadowing-settlement-operator-review-chain-index-surface-entrypoints",
  "Prohibited actions",
  "foreshadowing-settlement-operator-review-chain-index-surface-prohibited",
  "Safety boundary",
  "foreshadowing-settlement-operator-review-chain-index-surface-safety",
  "Raw foreshadowing settlement operator review chain index",
  "foreshadowing-settlement-operator-review-chain-index-surface-raw",
  "It does not approve, confirm adoption",
  "modify compressed_rules",
  "modify active_engine",
];

const expectedAppTokens = [
  "foreshadowingSettlementOperatorReviewChainIndexSurface",
  "operator_review_chain_index",
  "chain_segments",
  "phase_rows",
  "operator_entrypoints",
  "prohibited_actions",
  "index_markdown",
  "data-go-view",
  "Open target",
  "index_can_approve",
  "index_can_confirm_adoption",
  "index_can_activate_engine",
  "compressed_rules_modified",
];

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
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

function stableDigest(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
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
    sections: [
      {
        key: "packet_metadata",
        title: "Packet metadata",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-summary",
        required_fields: ["packet_kind", "packet_version", "source_evidence_digest", "index_status", "decision"],
        visible: true,
      },
      {
        key: "source_lineage",
        title: "Source lineage",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-summary",
        required_fields: ["source_index_kind", "source_index_version", "source_index_phase", "source_phase", "source_phases"],
        visible: true,
      },
      {
        key: "handoff_summary",
        title: "Handoff summary",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-cards",
        required_fields: ["headline", "summary", "status_badge", "warnings", "no_mutation_side_effects"],
        visible: true,
      },
      {
        key: "phase_rows",
        title: "Indexed phases",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-phases",
        required_fields: ["key", "label", "phase", "expected_phase", "status", "loaded", "readable", "route"],
        visible: true,
      },
      {
        key: "chain_segments",
        title: "Chain segments",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-chain",
        required_fields: ["key", "label", "phases", "status", "ready", "summary"],
        visible: true,
      },
      {
        key: "operator_entrypoints",
        title: "Operator entrypoints",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-entrypoints",
        required_fields: ["key", "label", "route", "ui_target", "source_phase", "priority", "read_only"],
        visible: true,
      },
      {
        key: "prohibited_actions",
        title: "Prohibited actions",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-prohibited",
        required_fields: ["key", "label", "allowed", "reason"],
        visible: true,
      },
      {
        key: "safety_boundary",
        title: "Safety boundary",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-safety",
        required_fields: ["read_only", "preview_only", "index_can_approve", "index_can_confirm_adoption", "index_can_activate_engine", "active_engine_modified", "compressed_rules_modified"],
        visible: true,
      },
      {
        key: "evidence_digest",
        title: "Evidence digest",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-summary",
        required_fields: ["source_evidence_digest"],
        visible: true,
      },
      {
        key: "raw_json_preview",
        title: "Raw JSON preview",
        ui_target_id: "foreshadowing-settlement-operator-review-chain-index-surface-raw",
        required_fields: ["packet_kind", "packet_version", "contents", "evidence_digest"],
        visible: true,
      },
    ],
    raw_json_preview: {
      available: true,
      safe_to_display: true,
      contains_raw_dashboard: false,
      contains_raw_manual_review_surface: false,
      raw_dashboard_omitted: true,
      raw_manual_review_surface_omitted: true,
      digest: packet.evidence_digest,
    },
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

function assertStaticUiTokens({ uiIndexText, uiAppText, serviceText }) {
  for (const token of expectedUiPanelTokens) {
    assert(uiIndexText.includes(token), `28H UI HTML missing evidence packet preview token: ${token}`);
  }

  for (const token of expectedAppTokens) {
    assert(uiAppText.includes(token), `28H app.js missing review chain preview renderer token: ${token}`);
  }

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
    "raw_dashboard",
    "raw_manual_review_surface",
  ]) {
    assert(serviceText.includes(token), `28H service missing packet preview source token: ${token}`);
  }
}

function assertPreviewContract(preview, packet) {
  assert.equal(preview.preview_kind, "foreshadowing_settlement_operator_review_chain_index_evidence_packet_ui_preview", "28H preview kind drifted.");
  assert.equal(preview.preview_version, "phase28h_evidence_packet_ui_preview_contract_v1", "28H preview version drifted.");
  assert.equal(preview.source_packet_kind, packet.packet_kind, "28H preview source packet kind drifted.");
  assert.equal(preview.source_packet_version, packet.packet_version, "28H preview source packet version drifted.");
  assert.equal(preview.source_evidence_digest, packet.evidence_digest, "28H preview evidence digest must mirror packet.");
  assert.equal(preview.panel_id, "foreshadowing-settlement-operator-review-chain-index-surface", "28H preview panel id drifted.");
  assert.equal(preview.raw_json_element_id, "foreshadowing-settlement-operator-review-chain-index-surface-raw", "28H preview raw JSON target drifted.");
  assert.equal(preview.route, "#writer-workbench", "28H preview route drifted.");
  assert.equal(preview.data_view, "writer-workbench", "28H preview data view drifted.");

  for (const key of ["read_only", "preview_only", "ui_preview_only", "export_only"]) {
    assert.equal(preview[key], true, `28H preview ${key} must remain true.`);
  }

  for (const key of [
    "can_approve",
    "can_confirm_adoption",
    "can_activate_engine",
    "can_auto_adopt",
    "can_auto_settle",
    "direct_adoption_allowed",
    "automatic_settlement_allowed",
  ]) {
    assert.equal(preview[key], false, `28H preview ${key} must remain false.`);
  }

  const sections = keyed(preview.sections, "28H preview sections");
  assert.deepEqual([...sections.keys()], expectedPreviewSectionKeys, "28H preview section order drifted.");
  for (const section of sections.values()) {
    assert.equal(section.visible, true, `${section.key} section should remain visible.`);
    assert.equal(typeof section.title, "string", `${section.key} title must be a string.`);
    assert(section.title.trim().length > 0, `${section.key} title must not be empty.`);
    assert.match(section.ui_target_id, /^foreshadowing-settlement-operator-review-chain-index-surface-/u, `${section.key} should target the review chain index surface.`);
    assert(Array.isArray(section.required_fields), `${section.key} required_fields must be an array.`);
    assert(section.required_fields.length >= 1, `${section.key} must keep required fields for preview contract.`);
  }

  assert.equal(preview.raw_json_preview.available, true, "28H raw JSON preview should be available.");
  assert.equal(preview.raw_json_preview.safe_to_display, true, "28H raw JSON preview should be safe to display.");
  assert.equal(preview.raw_json_preview.contains_raw_dashboard, false, "28H preview should not include raw dashboard.");
  assert.equal(preview.raw_json_preview.contains_raw_manual_review_surface, false, "28H preview should not include raw manual review surface.");
  assert.equal(preview.raw_json_preview.raw_dashboard_omitted, true, "28H raw dashboard omission should be explicit.");
  assert.equal(preview.raw_json_preview.raw_manual_review_surface_omitted, true, "28H raw manual surface omission should be explicit.");
  assert.equal(preview.raw_json_preview.digest, packet.evidence_digest, "28H raw JSON preview digest should mirror packet digest.");

  assert.equal(preview.rendered_counts.cards, 6, "28H preview should render six cards.");
  assert.equal(preview.rendered_counts.phase_rows, 7, "28H preview should render seven phase rows.");
  assert.equal(preview.rendered_counts.chain_segments, 3, "28H preview should render three chain segments.");
  assert.equal(preview.rendered_counts.operator_entrypoints, 3, "28H preview should render three operator entrypoints.");
  assert.equal(preview.rendered_counts.prohibited_actions, 7, "28H preview should render seven prohibited actions.");

  assert.equal(preview.safety_boundary.read_only, true, "28H preview safety should be read-only.");
  assert.equal(preview.safety_boundary.preview_only, true, "28H preview safety should be preview-only.");
  assert.equal(preview.safety_boundary.ui_preview_only, true, "28H preview safety should be ui-preview-only.");
  assert.equal(preview.safety_boundary.export_only, true, "28H preview safety should be export-only.");
  assert.equal(preview.safety_boundary.no_mutation_side_effects, true, "28H preview safety reports mutation side effects.");
  assert.equal(preview.safety_boundary.can_approve, false, "28H preview safety can approve.");
  assert.equal(preview.safety_boundary.can_confirm_adoption, false, "28H preview safety can confirm adoption.");
  assert.equal(preview.safety_boundary.can_activate_engine, false, "28H preview safety can activate engine.");
  assert.equal(preview.safety_boundary.can_auto_adopt, false, "28H preview safety can auto adopt.");
  assert.equal(preview.safety_boundary.can_auto_settle, false, "28H preview safety can auto settle.");
  assert.equal(preview.safety_boundary.active_engine_modified, false, "28H preview reports active_engine modified.");
  assert.equal(preview.safety_boundary.compressed_rules_modified, false, "28H preview reports compressed_rules modified.");

  assert.equal(typeof preview.preview_digest, "string", "28H preview digest must be a string.");
  assert.match(preview.preview_digest, /^[a-f0-9]{64}$/u, "28H preview digest is not sha256 hex.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28H active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28H compressed_rules hash baseline drifted before test.");

const [runAllText, uiIndexText, uiAppText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(uiIndexPath, "utf8"),
  readFile(uiAppPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticUiTokens({ uiIndexText, uiAppText, serviceText });

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: true,
});

assert.equal(index.ok, true, "28H source index should be ready.");
assert.equal(index.raw_dashboard, null, "28H source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28H source index should omit raw manual surface.");

const packet = buildEvidencePacket(index);
const preview = buildUiPreviewContract(packet);

assertPreviewContract(preview, packet);
assert.deepEqual(buildUiPreviewContract(packet), preview, "28H UI preview contract should be deterministic for the same packet.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28H changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28H changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28H changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28H changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28H changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28H changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28H changed approval log.");

console.log("Phase28H foreshadowing settlement operator review chain index evidence packet UI preview contract tests passed.");