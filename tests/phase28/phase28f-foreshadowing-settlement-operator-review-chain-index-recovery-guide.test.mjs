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
];

const expectedRecoveryWarningKeys = [
  "phase27t_adoption_readiness_gate_not_loaded",
  "phase27u_adoption_gate_surface_not_loaded",
  "phase27w_manual_adoption_review_entry_packet_not_loaded",
];

const expectedNeverActions = [
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

function lockedSafety() {
  return {
    read_only: true,
    preview_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    canon_modified: false,
    compressed_rules_modified: false,
  };
}

function buildDegradedRecoveryIndex() {
  return buildForeshadowingSettlementOperatorReviewChainIndex({
    include_raw: false,
    include_markdown: true,
    operator_readiness_dashboard: {
      ok: true,
      used: true,
      phase: "27R",
      dashboard_status: "ready",
      decision: "ready",
      source_phases: ["27Q", "27R"],
      safety: lockedSafety(),
    },
    operator_manual_adoption_review_entry_surface: {
      ok: true,
      used: true,
      phase: "27X",
      surface_status: "ready",
      decision: "ready",
      source_phases: ["27W", "27X"],
      safety: lockedSafety(),
      raw_packet: null,
    },
  });
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

function assertServiceRecoveryVocabulary(serviceText) {
  for (const token of [
    "Repair blockers before using the index as a navigation surface.",
    "foreshadowing_settlement_operator_review_chain_index_blocked",
    "_not_loaded",
    "warnings",
    "no_mutation_side_effects",
    "source_surfaces_locked",
    "prohibited_actions_locked",
    "existing gated approval flow",
    "Any actual approval or adoption confirmation must happen through the existing gated approval flow.",
  ]) {
    assert(serviceText.includes(token), `28F service recovery vocabulary missing: ${token}`);
  }
}

function assertReadyIndexStillGuidesOperators(index) {
  assert.equal(index.ok, true, "28F ready index should be ok.");
  assert.equal(index.index_status, "ready_for_operator_review_navigation", "28F ready index status drifted.");
  assert.equal(index.decision, "ready_for_operator_review_navigation", "28F ready decision drifted.");
  assert.deepEqual(index.warnings, [], "28F ready index should not emit warnings.");

  assert.match(
    index.summary,
    /cannot approve, confirm adoption, settle, write Canon, or activate engine/u,
    "28F ready summary no longer explains the locked operator boundary.",
  );

  const entrypoints = keyed(index.operator_entrypoints, "28F ready entrypoints");
  assert(entrypoints.has("open_existing_approval_queue"), "28F ready index missing existing approval queue entrypoint.");
  assert.match(
    entrypoints.get("open_existing_approval_queue").reason,
    /existing gated approval flow/u,
    "28F ready approval queue entrypoint no longer guides operators to the gated flow.",
  );

  const cards = keyed(index.cards, "28F ready cards");
  for (const key of ["required_payloads", "chain_segments", "operator_entrypoints", "prohibited_actions", "safety_boundary"]) {
    assert(cards.has(key), `28F ready index missing card ${key}.`);
    assert.equal(cards.get(key).tone, "ready", `28F ready card ${key} should be ready.`);
    assert.equal(typeof cards.get(key).summary, "string", `28F ready card ${key} must keep operator summary.`);
    assert(cards.get(key).summary.trim().length >= 10, `28F ready card ${key} summary is too thin.`);
  }

  const prohibited = keyed(index.prohibited_actions, "28F ready prohibited actions");
  for (const key of expectedNeverActions) {
    const item = prohibited.get(key);
    assert(item, `28F ready index missing prohibited action ${key}.`);
    assert.equal(item.allowed, false, `28F ready prohibited action ${key} became allowed.`);
    assert(item.reason.trim().length >= 20, `28F ready prohibited action ${key} reason is too thin.`);
  }

  assert.equal(index.checks.no_mutation_side_effects, true, "28F ready index reports mutation side effects.");
  assert.equal(index.integrity.no_mutation_side_effects, true, "28F ready integrity reports mutation side effects.");
}

function assertDegradedIndexActsAsTroubleshootingGuide(index) {
  assert.equal(index.ok, false, "28F degraded index should be blocked.");
  assert.equal(index.index_status, "blocked", "28F degraded index status should be blocked.");
  assert.equal(index.decision, "blocked", "28F degraded decision should be blocked.");
  assert.match(index.summary, /Repair blockers before using the index as a navigation surface/u, "28F degraded summary must tell operator to repair blockers.");

  assert(index.warnings.includes("foreshadowing_settlement_operator_review_chain_index_blocked"), "28F degraded index missing blocked warning.");
  for (const key of expectedRecoveryWarningKeys) {
    assert(index.warnings.includes(key), `28F degraded index missing warning ${key}.`);
  }

  const phaseRows = keyed(index.phase_rows, "28F degraded phase rows");
  for (const key of [
    "phase27t_adoption_readiness_gate",
    "phase27u_adoption_gate_surface",
    "phase27w_manual_adoption_review_entry_packet",
  ]) {
    const row = phaseRows.get(key);
    assert(row, `28F degraded index missing phase row ${key}.`);
    assert.equal(row.loaded, false, `${key} should be marked not loaded.`);
    assert.equal(row.readable, false, `${key} should be marked unreadable.`);
    assert.equal(row.status, "not_available", `${key} should expose not_available status.`);
    assert.equal(typeof row.summary, "string", `${key} summary must stay visible for troubleshooting.`);
    assert(row.summary.trim().length >= 20, `${key} summary is too thin for troubleshooting.`);
  }

  assert.equal(phaseRows.get("phase27r_readiness_dashboard").loaded, true, "28F degraded index should keep 27R readable.");
  assert.equal(phaseRows.get("phase27x_manual_adoption_review_entry_ui_surface").loaded, true, "28F degraded index should keep 27X readable.");

  const chainSegments = keyed(index.chain_segments, "28F degraded chain segments");
  assert.equal(chainSegments.get("operator_readiness_chain").status, "ready", "28F degraded readiness chain should remain ready.");
  assert.equal(chainSegments.get("adoption_gate_chain").status, "blocked", "28F degraded adoption gate chain should be blocked.");
  assert.equal(chainSegments.get("manual_review_entry_chain").status, "blocked", "28F degraded manual review chain should be blocked.");

  const cards = keyed(index.cards, "28F degraded cards");
  assert.equal(cards.get("required_payloads").tone, "blocked", "28F degraded required payloads card should be blocked.");
  assert.equal(cards.get("chain_segments").tone, "blocked", "28F degraded chain segments card should be blocked.");
  assert.equal(cards.get("prohibited_actions").tone, "ready", "28F degraded prohibited actions should stay locked.");
  assert.equal(cards.get("safety_boundary").tone, "blocked", "28F degraded safety boundary should expose incomplete source lock.");

  const prohibited = keyed(index.prohibited_actions, "28F degraded prohibited actions");
  for (const key of expectedNeverActions) {
    assert.equal(prohibited.get(key).allowed, false, `28F degraded prohibited action ${key} became allowed.`);
  }

  assert.equal(index.checks.required_payloads_readable, false, "28F degraded required payload check should be false.");
  assert.equal(index.checks.prohibited_actions_locked, true, "28F degraded prohibited actions should stay locked.");
  assert.equal(index.checks.no_mutation_side_effects, true, "28F degraded index should remain no-mutation.");
  assert.equal(index.integrity.no_mutation_side_effects, true, "28F degraded integrity should remain no-mutation.");
  assert.equal(index.can_approve, false, "28F degraded index can approve.");
  assert.equal(index.can_confirm_adoption, false, "28F degraded index can confirm adoption.");
  assert.equal(index.can_activate_engine, false, "28F degraded index can activate engine.");
  assert.equal(index.can_auto_adopt, false, "28F degraded index can auto adopt.");
  assert.equal(index.can_auto_settle, false, "28F degraded index can auto settle.");
  assert.equal(index.raw_dashboard, null, "28F degraded recovery test should not expose raw dashboard.");
  assert.equal(index.raw_manual_review_surface, null, "28F degraded recovery test should not expose raw manual surface.");

  assert.match(index.index_markdown, /### Indexed Phases/u, "28F degraded markdown missing indexed phases.");
  assert.match(index.index_markdown, /### Operator Entrypoints/u, "28F degraded markdown missing operator entrypoints.");
  assert.match(index.index_markdown, /### Prohibited Actions/u, "28F degraded markdown missing prohibited actions.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28F active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28F compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertServiceRecoveryVocabulary(serviceText);

const readyIndex = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: true,
});

assertReadyIndexStillGuidesOperators(readyIndex);

const degradedIndex = buildDegradedRecoveryIndex();

assertDegradedIndexActsAsTroubleshootingGuide(degradedIndex);

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28F changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28F changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28F changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28F changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28F changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28F changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28F changed approval log.");

console.log("Phase28F foreshadowing settlement operator review chain index recovery guide tests passed.");