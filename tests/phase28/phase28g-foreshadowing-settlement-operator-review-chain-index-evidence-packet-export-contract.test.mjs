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
];

const expectedPhaseRowKeys = [
  "phase27r_readiness_dashboard",
  "phase27t_adoption_readiness_gate",
  "phase27u_adoption_gate_surface",
  "phase27w_manual_adoption_review_entry_packet",
  "phase27x_manual_adoption_review_entry_ui_surface",
  "phase27y_manual_adoption_review_entry_live_ui_smoke",
  "phase27z_manual_adoption_review_entry_final_bridge_smoke",
];

const expectedChainSegmentKeys = [
  "operator_readiness_chain",
  "adoption_gate_chain",
  "manual_review_entry_chain",
];

const expectedEntrypointKeys = [
  "open_operator_readiness_dashboard",
  "open_manual_review_entry_surface",
  "open_existing_approval_queue",
];

const expectedProhibitedActionKeys = [
  "approve_from_index",
  "confirm_adoption_from_index",
  "activate_engine_from_index",
  "write_canon_from_index",
  "create_pending_engine_candidate_from_index",
  "auto_settle_from_index",
  "update_compressed_rules_from_index",
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

function summarizeCard(card) {
  return {
    key: card.key,
    title: card.title,
    value: String(card.value ?? ""),
    tone: card.tone,
    summary: card.summary,
  };
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

function summarizeEntrypoint(item) {
  return {
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
  const operatorEntrypoints = index.operator_entrypoints.map(summarizeEntrypoint);
  const prohibitedActions = index.prohibited_actions.map((item) => ({
    key: item.key,
    label: item.label,
    allowed: item.allowed,
    reason: item.reason,
  }));
  const cards = index.cards.map(summarizeCard);

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

function assertServiceExportInputsRemainAvailable(serviceText) {
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
    "requires_human_approval",
    "requires_operator_confirmation",
  ]) {
    assert(serviceText.includes(token), `28G service missing export source token: ${token}`);
  }
}

function assertEvidencePacket(packet, index) {
  assert.equal(packet.packet_kind, "foreshadowing_settlement_operator_review_chain_index_evidence_packet", "28G packet kind drifted.");
  assert.equal(packet.packet_version, "phase28g_evidence_packet_export_contract_v1", "28G packet version drifted.");
  assert.equal(packet.source_index_kind, "foreshadowing_settlement_operator_review_chain_index", "28G source index kind drifted.");
  assert.equal(packet.source_index_phase, "28A", "28G source index phase drifted.");
  assert.equal(packet.source_phase, "27Z", "28G source phase drifted.");
  assert.deepEqual(packet.source_phases, ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"], "28G source phase lineage drifted.");
  assert.equal(packet.index_status, index.index_status, "28G packet index status must mirror source index.");
  assert.equal(packet.decision, index.decision, "28G packet decision must mirror source index.");
  assert.equal(packet.generated_for, "operator_handoff", "28G packet handoff target drifted.");
  assert.equal(packet.export_mode, "evidence_packet_shape_only", "28G packet export mode drifted.");

  for (const key of [
    "read_only",
    "preview_only",
    "export_only",
    "requires_human_approval",
    "requires_operator_confirmation",
  ]) {
    assert.equal(packet[key], true, `28G packet ${key} must remain true.`);
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
    assert.equal(packet[key], false, `28G packet ${key} must remain false.`);
  }

  assert.equal(typeof packet.evidence_digest, "string", "28G packet digest must be a string.");
  assert.match(packet.evidence_digest, /^[a-f0-9]{64}$/u, "28G packet digest is not a sha256 hex digest.");

  assert.equal(packet.handoff_summary.headline, index.headline, "28G handoff headline should mirror index headline.");
  assert.equal(packet.handoff_summary.summary, index.summary, "28G handoff summary should mirror index summary.");
  assert.equal(packet.handoff_summary.total_phase_rows, 7, "28G packet should preserve seven phase rows.");
  assert.equal(packet.handoff_summary.total_chain_segments, 3, "28G packet should preserve three chain segments.");
  assert.equal(packet.handoff_summary.prohibited_actions_locked, true, "28G packet should keep prohibited actions locked.");
  assert.equal(packet.handoff_summary.no_mutation_side_effects, true, "28G packet should report no mutation side effects.");

  const phaseRows = keyed(packet.contents.phase_rows, "28G packet phase rows");
  assert.deepEqual([...phaseRows.keys()], expectedPhaseRowKeys, "28G packet phase row order drifted.");
  for (const row of phaseRows.values()) {
    assert.equal(typeof row.label, "string", `${row.key} label must be exportable.`);
    assert(row.label.trim().length > 0, `${row.key} label must not be empty.`);
    assert.equal(typeof row.summary, "string", `${row.key} summary must be exportable.`);
    assert(row.summary.trim().length >= 20, `${row.key} summary is too thin for handoff.`);
    assert.match(row.route, /^#[a-z0-9-]+$/u, `${row.key} route must remain a stable fragment route.`);
  }

  const chainSegments = keyed(packet.contents.chain_segments, "28G packet chain segments");
  assert.deepEqual([...chainSegments.keys()], expectedChainSegmentKeys, "28G packet chain segment order drifted.");
  for (const segment of chainSegments.values()) {
    assert(Array.isArray(segment.phases), `${segment.key} phases must be exportable.`);
    assert(segment.phases.length >= 2, `${segment.key} should preserve phase lineage.`);
    assert.equal(typeof segment.summary, "string", `${segment.key} summary must be exportable.`);
    assert(segment.summary.trim().length >= 20, `${segment.key} summary is too thin for handoff.`);
  }

  const entrypoints = keyed(packet.contents.operator_entrypoints, "28G packet operator entrypoints");
  assert.deepEqual([...entrypoints.keys()], expectedEntrypointKeys, "28G packet entrypoint order drifted.");
  for (const entry of entrypoints.values()) {
    assert.equal(entry.read_only, true, `${entry.key} entrypoint must remain read-only.`);
    assert.equal(entry.can_approve, false, `${entry.key} entrypoint can approve.`);
    assert.equal(entry.can_confirm_adoption, false, `${entry.key} entrypoint can confirm adoption.`);
    assert.equal(entry.can_activate_engine, false, `${entry.key} entrypoint can activate engine.`);
    assert.match(entry.route, /^#[a-z0-9-]+$/u, `${entry.key} route must be stable.`);
  }

  const prohibited = keyed(packet.contents.prohibited_actions, "28G packet prohibited actions");
  assert.deepEqual([...prohibited.keys()], expectedProhibitedActionKeys, "28G packet prohibited action order drifted.");
  for (const item of prohibited.values()) {
    assert.equal(item.allowed, false, `${item.key} prohibited action became allowed.`);
    assert.equal(typeof item.reason, "string", `${item.key} reason must be exportable.`);
    assert(item.reason.trim().length >= 20, `${item.key} reason is too thin for handoff.`);
  }

  const cards = keyed(packet.contents.cards, "28G packet cards");
  for (const key of ["phase_rows", "required_payloads", "chain_segments", "operator_entrypoints", "prohibited_actions", "safety_boundary"]) {
    assert(cards.has(key), `28G packet missing card ${key}.`);
    assert.equal(typeof cards.get(key).summary, "string", `28G card ${key} summary must be exportable.`);
  }

  assert.equal(packet.contents.safety_boundary.read_only, true, "28G packet safety boundary should be read-only.");
  assert.equal(packet.contents.safety_boundary.preview_only, true, "28G packet safety boundary should be preview-only.");
  assert.equal(packet.contents.safety_boundary.index_can_approve, false, "28G packet safety boundary can approve.");
  assert.equal(packet.contents.safety_boundary.index_can_confirm_adoption, false, "28G packet safety boundary can confirm adoption.");
  assert.equal(packet.contents.safety_boundary.index_can_activate_engine, false, "28G packet safety boundary can activate engine.");
  assert.equal(packet.contents.safety_boundary.active_engine_modified, false, "28G packet reports active_engine modification.");
  assert.equal(packet.contents.safety_boundary.compressed_rules_modified, false, "28G packet reports compressed_rules modification.");
  assert.equal(packet.contents.checks.no_mutation_side_effects, true, "28G packet checks report mutation side effects.");
  assert.equal(packet.contents.integrity.no_mutation_side_effects, true, "28G packet integrity reports mutation side effects.");

  assert.match(packet.contents.markdown, /### Indexed Phases/u, "28G packet markdown missing indexed phases.");
  assert.match(packet.contents.markdown, /### Operator Entrypoints/u, "28G packet markdown missing operator entrypoints.");
  assert.match(packet.contents.markdown, /### Prohibited Actions/u, "28G packet markdown missing prohibited actions.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28G active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28G compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertServiceExportInputsRemainAvailable(serviceText);

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: true,
});

assert.equal(index.ok, true, "28G source index should be ready before packet export.");
assert.equal(index.raw_dashboard, null, "28G source index should not export raw dashboard in packet mode.");
assert.equal(index.raw_manual_review_surface, null, "28G source index should not export raw manual surface in packet mode.");

const packet = buildEvidencePacket(index);
assertEvidencePacket(packet, index);

const packetAgain = buildEvidencePacket(index);
assert.deepEqual(packetAgain, packet, "28G evidence packet shape should be deterministic for the same index.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28G changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28G changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28G changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28G changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28G changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28G changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28G changed approval log.");

console.log("Phase28G foreshadowing settlement operator review chain index evidence packet export contract tests passed.");