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
  "tests/phase28/phase28i-foreshadowing-settlement-operator-review-chain-index-evidence-packet-bridge-preview-contract.test.mjs",
];

const expectedBridgeSectionKeys = [
  "bridge_metadata",
  "handoff_summary",
  "source_lineage",
  "packet_digest",
  "ui_preview_route",
  "phase_rows",
  "chain_segments",
  "operator_entrypoints",
  "prohibited_actions",
  "safety_boundary",
  "bridge_readability",
  "raw_packet_preview",
];

const expectedBridgeBlockedCapabilityKeys = [
  "approve_from_bridge_preview",
  "confirm_adoption_from_bridge_preview",
  "activate_engine_from_bridge_preview",
  "write_canon_from_bridge_preview",
  "create_pending_engine_candidate_from_bridge_preview",
  "auto_settle_from_bridge_preview",
  "update_compressed_rules_from_bridge_preview",
];

const expectedBridgeReadableFields = [
  "bridge_kind",
  "bridge_version",
  "source_packet_kind",
  "source_packet_version",
  "source_evidence_digest",
  "source_ui_preview_digest",
  "headline",
  "summary",
  "status_badge",
  "source_phases",
  "phase_rows",
  "chain_segments",
  "operator_entrypoints",
  "prohibited_actions",
  "safety_boundary",
  "raw_packet_preview",
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

function bridgeBlockedCapabilities() {
  return [
    {
      key: "approve_from_bridge_preview",
      label: "Approve from bridge preview",
      allowed: false,
      reason: "Bridge preview is read-only and cannot approve adoption requests.",
    },
    {
      key: "confirm_adoption_from_bridge_preview",
      label: "Confirm adoption from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot confirm adoption; approval must stay in the existing gated flow.",
    },
    {
      key: "activate_engine_from_bridge_preview",
      label: "Activate engine from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot activate engine or alter active_engine.",
    },
    {
      key: "write_canon_from_bridge_preview",
      label: "Write Canon from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot write Canon DB or promote evidence into canon.",
    },
    {
      key: "create_pending_engine_candidate_from_bridge_preview",
      label: "Create pending engine candidate from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot create pending engine candidates.",
    },
    {
      key: "auto_settle_from_bridge_preview",
      label: "Auto-settle from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot auto-settle adopted writing.",
    },
    {
      key: "update_compressed_rules_from_bridge_preview",
      label: "Update compressed rules from bridge preview",
      allowed: false,
      reason: "Bridge preview cannot update compressed_rules.",
    },
  ];
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
    blocked_bridge_capabilities: bridgeBlockedCapabilities(),
    sections: [
      {
        key: "bridge_metadata",
        title: "Bridge metadata",
        fields: ["bridge_kind", "bridge_version", "bridge_channel", "bridge_mode", "bridge_surface"],
      },
      {
        key: "handoff_summary",
        title: "Handoff summary",
        fields: ["headline", "summary", "status_badge", "warnings"],
      },
      {
        key: "source_lineage",
        title: "Source lineage",
        fields: ["source_index_kind", "source_index_phase", "source_phase", "source_phases"],
      },
      {
        key: "packet_digest",
        title: "Packet digest",
        fields: ["source_evidence_digest", "source_ui_preview_digest"],
      },
      {
        key: "ui_preview_route",
        title: "UI preview route",
        fields: ["route", "panel_id", "raw_json_element_id"],
      },
      {
        key: "phase_rows",
        title: "Indexed phases",
        fields: ["key", "label", "phase", "status", "route"],
      },
      {
        key: "chain_segments",
        title: "Chain segments",
        fields: ["key", "label", "phases", "status", "ready"],
      },
      {
        key: "operator_entrypoints",
        title: "Operator entrypoints",
        fields: ["key", "label", "route", "ui_target", "read_only"],
      },
      {
        key: "prohibited_actions",
        title: "Prohibited actions",
        fields: ["key", "label", "allowed", "reason"],
      },
      {
        key: "safety_boundary",
        title: "Safety boundary",
        fields: ["read_only", "preview_only", "bridge_preview_only", "active_engine_modified", "compressed_rules_modified"],
      },
      {
        key: "bridge_readability",
        title: "Bridge readability",
        fields: ["markdown_summary", "compact_cards", "machine_payload"],
      },
      {
        key: "raw_packet_preview",
        title: "Raw packet preview",
        fields: ["available", "safe_to_display", "redacted_raw_sources", "digest"],
      },
    ],
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
        "",
        "This bridge preview is read-only / preview-only and cannot approve, adopt, settle, activate engine, write Canon, or update compressed_rules.",
      ].join("\n"),
      compact_cards: packet.contents.cards.map((card) => ({
        key: card.key,
        title: card.title,
        value: card.value,
        tone: card.tone,
      })),
      machine_payload_fields: expectedBridgeReadableFields,
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
    "raw_dashboard",
    "raw_manual_review_surface",
  ]) {
    assert(serviceText.includes(token), `28I service missing bridge preview source token: ${token}`);
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
    assert(uiIndexText.includes(token), `28I UI HTML missing bridge preview target token: ${token}`);
  }

  for (const token of [
    "foreshadowingSettlementOperatorReviewChainIndexSurface",
    "operator_review_chain_index",
    "index_markdown",
    "data-go-view",
  ]) {
    assert(uiAppText.includes(token), `28I app.js missing bridge preview target token: ${token}`);
  }
}

function assertBridgePreviewContract(bridgePreview, packet, uiPreview) {
  assert.equal(bridgePreview.bridge_kind, "foreshadowing_settlement_operator_review_chain_index_evidence_packet_bridge_preview", "28I bridge kind drifted.");
  assert.equal(bridgePreview.bridge_version, "phase28i_evidence_packet_bridge_preview_contract_v1", "28I bridge version drifted.");
  assert.equal(bridgePreview.bridge_channel, "chatgpt_bridge", "28I bridge channel drifted.");
  assert.equal(bridgePreview.bridge_mode, "readonly_preview", "28I bridge mode drifted.");
  assert.equal(bridgePreview.bridge_surface, "operator_evidence_packet_preview", "28I bridge surface drifted.");
  assert.equal(bridgePreview.generated_for, "chatgpt_bridge_readable_operator_handoff", "28I generated_for drifted.");

  assert.equal(bridgePreview.source_packet_kind, packet.packet_kind, "28I packet kind mismatch.");
  assert.equal(bridgePreview.source_packet_version, packet.packet_version, "28I packet version mismatch.");
  assert.equal(bridgePreview.source_evidence_digest, packet.evidence_digest, "28I evidence digest mismatch.");
  assert.equal(bridgePreview.source_ui_preview_kind, uiPreview.preview_kind, "28I UI preview kind mismatch.");
  assert.equal(bridgePreview.source_ui_preview_version, uiPreview.preview_version, "28I UI preview version mismatch.");
  assert.equal(bridgePreview.source_ui_preview_digest, uiPreview.preview_digest, "28I UI preview digest mismatch.");

  assert.equal(bridgePreview.source_index_kind, "foreshadowing_settlement_operator_review_chain_index", "28I source index kind drifted.");
  assert.equal(bridgePreview.source_index_phase, "28A", "28I source index phase drifted.");
  assert.equal(bridgePreview.source_phase, "27Z", "28I source phase drifted.");
  assert.deepEqual(bridgePreview.source_phases, ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"], "28I source phase lineage drifted.");
  assert.equal(bridgePreview.index_status, packet.index_status, "28I index status should mirror packet.");
  assert.equal(bridgePreview.decision, packet.decision, "28I decision should mirror packet.");

  for (const key of [
    "read_only",
    "preview_only",
    "bridge_preview_only",
    "export_only",
    "requires_human_approval",
    "requires_operator_confirmation",
    "no_mutation_side_effects",
  ]) {
    assert.equal(bridgePreview[key], true, `28I ${key} must remain true.`);
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
  ]) {
    assert.equal(bridgePreview[key], false, `28I ${key} must remain false.`);
  }

  assert.deepEqual(bridgePreview.allowed_bridge_actions, [
    "read_evidence_packet_preview",
    "copy_handoff_summary",
    "open_ui_preview_route",
    "inspect_safety_boundary",
  ], "28I allowed bridge actions drifted.");

  const sections = keyed(bridgePreview.sections, "28I bridge sections");
  assert.deepEqual([...sections.keys()], expectedBridgeSectionKeys, "28I bridge section order drifted.");
  for (const section of sections.values()) {
    assert.equal(typeof section.title, "string", `${section.key} title must be a string.`);
    assert(section.title.trim().length > 0, `${section.key} title must not be empty.`);
    assert(Array.isArray(section.fields), `${section.key} fields must be an array.`);
    assert(section.fields.length >= 1, `${section.key} fields must not be empty.`);
  }

  const blocked = keyed(bridgePreview.blocked_bridge_capabilities, "28I blocked capabilities");
  assert.deepEqual([...blocked.keys()], expectedBridgeBlockedCapabilityKeys, "28I blocked bridge capability order drifted.");
  for (const item of blocked.values()) {
    assert.equal(item.allowed, false, `${item.key} became allowed.`);
    assert.equal(typeof item.reason, "string", `${item.key} reason must be a string.`);
    assert(item.reason.trim().length >= 20, `${item.key} reason is too thin.`);
  }

  assert.equal(bridgePreview.ui_preview_route.route, "#writer-workbench", "28I UI route drifted.");
  assert.equal(bridgePreview.ui_preview_route.data_view, "writer-workbench", "28I data view drifted.");
  assert.equal(bridgePreview.ui_preview_route.panel_id, "foreshadowing-settlement-operator-review-chain-index-surface", "28I panel id drifted.");
  assert.equal(bridgePreview.ui_preview_route.raw_json_element_id, "foreshadowing-settlement-operator-review-chain-index-surface-raw", "28I raw json element id drifted.");

  assert.equal(bridgePreview.rendered_counts.cards, 6, "28I should expose six cards.");
  assert.equal(bridgePreview.rendered_counts.phase_rows, 7, "28I should expose seven phase rows.");
  assert.equal(bridgePreview.rendered_counts.chain_segments, 3, "28I should expose three chain segments.");
  assert.equal(bridgePreview.rendered_counts.operator_entrypoints, 3, "28I should expose three operator entrypoints.");
  assert.equal(bridgePreview.rendered_counts.prohibited_actions, 7, "28I should expose seven prohibited actions.");

  assert.match(bridgePreview.bridge_readability.markdown_summary, /read-only \/ preview-only/u, "28I markdown summary missing read-only preview warning.");
  assert.match(bridgePreview.bridge_readability.markdown_summary, /cannot approve, adopt, settle, activate engine, write Canon, or update compressed_rules/u, "28I markdown summary missing safety warning.");
  assert.match(bridgePreview.bridge_readability.markdown_summary, new RegExp(packet.evidence_digest, "u"), "28I markdown summary missing evidence digest.");

  assert.deepEqual(bridgePreview.bridge_readability.machine_payload_fields, expectedBridgeReadableFields, "28I machine payload fields drifted.");
  assert.equal(bridgePreview.bridge_readability.compact_cards.length, 6, "28I compact cards count drifted.");

  assert.equal(bridgePreview.contents.phase_rows.length, 7, "28I phase rows content count drifted.");
  assert.equal(bridgePreview.contents.chain_segments.length, 3, "28I chain segments content count drifted.");
  assert.equal(bridgePreview.contents.operator_entrypoints.length, 3, "28I entrypoints content count drifted.");
  assert.equal(bridgePreview.contents.prohibited_actions.length, 7, "28I prohibited actions content count drifted.");

  assert.equal(bridgePreview.contents.safety_boundary.read_only, true, "28I safety read_only drifted.");
  assert.equal(bridgePreview.contents.safety_boundary.preview_only, true, "28I safety preview_only drifted.");
  assert.equal(bridgePreview.contents.safety_boundary.bridge_preview_only, true, "28I safety bridge_preview_only drifted.");
  assert.equal(bridgePreview.contents.safety_boundary.can_approve, false, "28I safety can approve.");
  assert.equal(bridgePreview.contents.safety_boundary.can_confirm_adoption, false, "28I safety can confirm adoption.");
  assert.equal(bridgePreview.contents.safety_boundary.can_activate_engine, false, "28I safety can activate engine.");
  assert.equal(bridgePreview.contents.safety_boundary.can_auto_adopt, false, "28I safety can auto adopt.");
  assert.equal(bridgePreview.contents.safety_boundary.can_auto_settle, false, "28I safety can auto settle.");
  assert.equal(bridgePreview.contents.safety_boundary.can_write_canon, false, "28I safety can write canon.");
  assert.equal(bridgePreview.contents.safety_boundary.can_create_pending_engine_candidate, false, "28I safety can create pending engine candidate.");
  assert.equal(bridgePreview.contents.safety_boundary.can_update_compressed_rules, false, "28I safety can update compressed rules.");
  assert.equal(bridgePreview.contents.safety_boundary.active_engine_modified, false, "28I safety reports active_engine modification.");
  assert.equal(bridgePreview.contents.safety_boundary.compressed_rules_modified, false, "28I safety reports compressed_rules modification.");

  assert.equal(bridgePreview.raw_packet_preview.available, true, "28I raw packet preview should be available.");
  assert.equal(bridgePreview.raw_packet_preview.safe_to_display, true, "28I raw packet preview should be safe.");
  assert.equal(bridgePreview.raw_packet_preview.redacted_raw_sources, true, "28I raw packet preview should redact raw sources.");
  assert.equal(bridgePreview.raw_packet_preview.contains_raw_dashboard, false, "28I raw packet preview contains raw dashboard.");
  assert.equal(bridgePreview.raw_packet_preview.contains_raw_manual_review_surface, false, "28I raw packet preview contains raw manual review surface.");
  assert.equal(bridgePreview.raw_packet_preview.raw_dashboard_omitted, true, "28I raw dashboard omission should be explicit.");
  assert.equal(bridgePreview.raw_packet_preview.raw_manual_review_surface_omitted, true, "28I raw manual surface omission should be explicit.");
  assert.equal(bridgePreview.raw_packet_preview.digest, packet.evidence_digest, "28I raw packet digest mismatch.");

  assert.equal(typeof bridgePreview.bridge_preview_digest, "string", "28I bridge preview digest must be a string.");
  assert.match(bridgePreview.bridge_preview_digest, /^[a-f0-9]{64}$/u, "28I bridge preview digest is not sha256 hex.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28I active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28I compressed_rules hash baseline drifted before test.");

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

assert.equal(index.ok, true, "28I source index should be ready.");
assert.equal(index.raw_dashboard, null, "28I source index should omit raw dashboard.");
assert.equal(index.raw_manual_review_surface, null, "28I source index should omit raw manual review surface.");

const packet = buildEvidencePacket(index);
const uiPreview = buildUiPreviewContract(packet);
const bridgePreview = buildBridgePreviewContract(packet, uiPreview);

assertBridgePreviewContract(bridgePreview, packet, uiPreview);
assert.deepEqual(buildBridgePreviewContract(packet, uiPreview), bridgePreview, "28I bridge preview contract should be deterministic for the same packet and UI preview.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28I changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28I changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28I changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28I changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28I changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28I changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28I changed approval log.");

console.log("Phase28I foreshadowing settlement operator review chain index evidence packet bridge preview contract tests passed.");