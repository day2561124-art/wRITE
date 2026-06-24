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
];

const expectedChainSegments = [
  ["operator_readiness_chain", "Operator readiness chain", ["27R", "27S"]],
  ["adoption_gate_chain", "Adoption gate chain", ["27T", "27U", "27V"]],
  ["manual_review_entry_chain", "Manual review entry chain", ["27W", "27X", "27Y", "27Z"]],
];

const expectedPhaseRows = [
  ["phase27r_readiness_dashboard", "27R", false],
  ["phase27t_adoption_readiness_gate", "27T", false],
  ["phase27u_adoption_gate_surface", "27U", false],
  ["phase27w_manual_adoption_review_entry_packet", "27W", false],
  ["phase27x_manual_adoption_review_entry_ui_surface", "27X", false],
  ["phase27y_manual_adoption_review_entry_live_ui_smoke", "27Y", true],
  ["phase27z_manual_adoption_review_entry_final_bridge_smoke", "27Z", true],
];

const expectedEntrypoints = [
  {
    key: "open_operator_readiness_dashboard",
    label: "Open operator readiness dashboard",
    route: "#writer-workbench",
    ui_target: "writer-workbench",
    source_phase: "27R",
    priority: "secondary",
  },
  {
    key: "open_manual_review_entry_surface",
    label: "Open manual adoption review entry surface",
    route: "#writer-workbench",
    ui_target: "writer-workbench",
    source_phase: "27X",
    priority: "primary",
  },
  {
    key: "open_existing_approval_queue",
    label: "Open existing approval queue",
    route: "#approval",
    ui_target: "approval",
    source_phase: "existing_flow",
    priority: "primary",
  },
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

function assertRunAllRegistrations(runAllText) {
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

function assertStableOperatorEntrypoints(index) {
  const entrypoints = keyed(index.operator_entrypoints, "28E operator entrypoints");
  assert.deepEqual(
    [...entrypoints.keys()],
    expectedEntrypoints.map((item) => item.key),
    "28E operator entrypoint key order drifted.",
  );

  const phaseRows = keyed(index.phase_rows, "28E phase rows");
  const knownSourcePhases = new Set([...index.source_phases, "existing_flow"]);

  for (const expected of expectedEntrypoints) {
    const entry = entrypoints.get(expected.key);
    assert.equal(entry.label, expected.label, `${expected.key} label drifted.`);
    assert.equal(entry.route, expected.route, `${expected.key} route drifted.`);
    assert.equal(entry.ui_target, expected.ui_target, `${expected.key} UI target drifted.`);
    assert.equal(entry.source_phase, expected.source_phase, `${expected.key} source phase drifted.`);
    assert.equal(entry.priority, expected.priority, `${expected.key} priority drifted.`);
    assert.equal(entry.read_only, true, `${expected.key} is not read-only.`);
    assert.equal(entry.can_approve, false, `${expected.key} can approve.`);
    assert.equal(entry.can_confirm_adoption, false, `${expected.key} can confirm adoption.`);
    assert.equal(entry.can_activate_engine, false, `${expected.key} can activate engine.`);
    assert.equal(knownSourcePhases.has(entry.source_phase), true, `${expected.key} points to an unknown source phase.`);
    assert.match(entry.route, /^#[a-z0-9-]+$/u, `${expected.key} route is not a stable fragment route.`);
    assert.match(entry.ui_target, /^[a-z0-9-]+$/u, `${expected.key} UI target is not stable.`);
    assert.equal(typeof entry.reason, "string", `${expected.key} reason must be a string.`);
    assert(entry.reason.trim().length >= 20, `${expected.key} reason is too thin for operator navigation.`);

    if (entry.source_phase !== "existing_flow") {
      assert(
        [...phaseRows.values()].some((row) => row.phase === entry.source_phase),
        `${expected.key} does not resolve to an indexed phase row.`,
      );
    }
  }

  assert.match(
    entrypoints.get("open_existing_approval_queue").reason,
    /existing gated approval flow/u,
    "Approval queue entrypoint must direct operators to the existing gated approval flow.",
  );
}

function assertChainNavigation(index) {
  const chainSegments = keyed(index.chain_segments, "28E chain segments");
  const phaseRows = keyed(index.phase_rows, "28E phase rows");
  const sourcePhases = new Set(index.source_phases);

  assert.deepEqual(
    [...chainSegments.keys()],
    expectedChainSegments.map(([key]) => key),
    "28E chain segment key order drifted.",
  );

  for (const [key, label, phases] of expectedChainSegments) {
    const segment = chainSegments.get(key);
    assert.equal(segment.label, label, `${key} label drifted.`);
    assert.deepEqual(segment.phases, phases, `${key} phase route drifted.`);
    assert.equal(segment.status, "ready", `${key} is not ready.`);
    assert.equal(segment.ready, true, `${key} ready flag drifted.`);
    assert.equal(typeof segment.summary, "string", `${key} summary must be a string.`);
    assert(segment.summary.trim().length >= 20, `${key} summary is too thin for operator navigation.`);
    for (const phase of segment.phases) {
      assert.equal(sourcePhases.has(phase), true, `${key} references phase ${phase} outside source_phases.`);
    }
  }

  assert.deepEqual(
    [...phaseRows.keys()],
    expectedPhaseRows.map(([key]) => key),
    "28E phase row key order drifted.",
  );

  for (const [key, phase, coverageOnly] of expectedPhaseRows) {
    const row = phaseRows.get(key);
    assert.equal(row.expected_phase, phase, `${key} expected phase drifted.`);
    assert.equal(row.phase, phase, `${key} phase drifted.`);
    assert.equal(row.coverage_only, coverageOnly, `${key} coverage-only flag drifted.`);
    assert.equal(row.loaded, true, `${key} is not loaded.`);
    assert.equal(row.readable, true, `${key} is not readable.`);
    assert.equal(row.route, "#writer-workbench", `${key} route drifted.`);
    assert.equal(typeof row.label, "string", `${key} label must be a string.`);
    assert(row.label.includes(`Phase ${phase}`), `${key} label must keep its operator-facing phase label.`);
    assert.equal(typeof row.summary, "string", `${key} summary must be a string.`);
    assert(row.summary.trim().length >= 20, `${key} summary is too thin for operator navigation.`);

    if (coverageOnly) {
      assert.equal(typeof row.test_path, "string", `${key} coverage row must expose test_path.`);
      assert.match(
        row.test_path,
        new RegExp(`tests/phase27/phase${phase.toLowerCase()}-`, "u"),
        `${key} test_path no longer points to its Phase ${phase} regression guard.`,
      );
      assert.equal(row.safety_locked, true, `${key} coverage row safety lock drifted.`);
    } else {
      assert.equal(row.test_path, null, `${key} runtime row should not invent a test_path.`);
      assert.equal(row.safety_locked, true, `${key} source surface is not safety locked.`);
    }
  }

  for (const phase of ["27R", "27T", "27U", "27W", "27X", "27Y", "27Z"]) {
    assert(
      [...chainSegments.values()].some((segment) => segment.phases.includes(phase)),
      `Phase ${phase} is not reachable from any operator navigation chain segment.`,
    );
  }
}

function assertOperatorFacingLabels(index) {
  const cards = keyed(index.cards, "28E summary cards");
  for (const key of ["phase_rows", "required_payloads", "chain_segments", "operator_entrypoints", "prohibited_actions", "safety_boundary"]) {
    const card = cards.get(key);
    assert(card, `28E summary card ${key} missing.`);
    assert.equal(typeof card.title, "string", `${key} card title must be a string.`);
    assert(card.title.trim().length > 0, `${key} card title must not be empty.`);
    assert.equal(typeof card.value, "string", `${key} card value must be stringified for UI stability.`);
    assert(["ready", "blocked"].includes(card.tone), `${key} card tone drifted.`);
    assert.equal(typeof card.summary, "string", `${key} card summary must be a string.`);
    assert(card.summary.trim().length >= 10, `${key} card summary is too thin.`);
  }

  const prohibited = keyed(index.prohibited_actions, "28E prohibited actions");
  for (const key of [
    "approve_from_index",
    "confirm_adoption_from_index",
    "activate_engine_from_index",
    "write_canon_from_index",
    "create_pending_engine_candidate_from_index",
    "auto_settle_from_index",
    "update_compressed_rules_from_index",
  ]) {
    const item = prohibited.get(key);
    assert(item, `28E prohibited action ${key} missing.`);
    assert.equal(item.allowed, false, `${key} is no longer locked.`);
    assert.equal(typeof item.label, "string", `${key} label must be a string.`);
    assert(item.label.trim().length > 0, `${key} label must not be empty.`);
    assert.equal(typeof item.reason, "string", `${key} reason must be a string.`);
    assert(item.reason.trim().length >= 20, `${key} reason is too thin.`);
  }

  assert.match(index.index_markdown, /### Operator Entrypoints/u, "28E markdown must keep operator entrypoint navigation section.");
  assert.match(index.index_markdown, /open_manual_review_entry_surface/u, "28E markdown missing manual review entrypoint.");
  assert.match(index.index_markdown, /### Prohibited Actions/u, "28E markdown must keep prohibited action section.");
}

function assertStaticUiContract({ serviceText, uiIndexText, uiAppText }) {
  for (const token of [
    "function entrypoint(",
    "ui_target",
    "read_only: true",
    "can_approve: false",
    "can_confirm_adoption: false",
    "can_activate_engine: false",
    "open_operator_readiness_dashboard",
    "open_manual_review_entry_surface",
    "open_existing_approval_queue",
  ]) {
    assert(serviceText.includes(token), `28E service missing static navigation token: ${token}`);
  }

  for (const token of [
    "foreshadowing-settlement-operator-review-chain-index-surface",
    "READ-ONLY REVIEW CHAIN INDEX",
    "Phase 27R through",
    "Phase 27Z operator-facing review chain",
    "Chain segments",
    "Indexed phases",
    "Operator entrypoints",
    "Prohibited actions",
    "Safety boundary",
    "Raw foreshadowing settlement operator review chain index",
    "It does not approve, confirm adoption",
    "modify compressed_rules",
    "modify active_engine",
  ]) {
    assert(uiIndexText.includes(token), `28E UI HTML missing operator-facing token: ${token}`);
  }

  for (const token of [
    "renderReviewChainIndexRowList",
    "renderForeshadowingSettlementOperatorReviewChainIndexSurface",
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
  ]) {
    assert(uiAppText.includes(token), `28E app.js missing navigation renderer token: ${token}`);
  }
}

function assertSafetyBoundary(index) {
  assert.equal(index.review_index_only, true, "28E index must remain review-index-only.");
  assert.equal(index.manual_review_only, true, "28E index must remain manual-review-only.");
  assert.equal(index.requires_human_approval, true, "28E index must still require human approval.");
  assert.equal(index.requires_operator_confirmation, true, "28E index must still require operator confirmation.");
  assert.equal(index.can_approve, false, "28E index can approve.");
  assert.equal(index.can_confirm_adoption, false, "28E index can confirm adoption.");
  assert.equal(index.can_activate_engine, false, "28E index can activate engine.");
  assert.equal(index.can_auto_adopt, false, "28E index can auto-adopt.");
  assert.equal(index.can_auto_settle, false, "28E index can auto-settle.");

  for (const [key, value] of Object.entries(index.safety)) {
    if (key.startsWith("no_") || ["read_only", "preview_only", "source_surfaces_locked"].includes(key)) {
      assert.equal(value, true, `28E safety.${key} must remain true.`);
      continue;
    }
    if (key.startsWith("bridge_can_") || key.startsWith("index_can_") || key.endsWith("_modified") || key.endsWith("_created") || key.startsWith("automatic_")) {
      assert.equal(value, false, `28E safety.${key} must remain false.`);
    }
  }

  assert.equal(index.checks.index_ready, true, "28E index should remain ready.");
  assert.equal(index.checks.no_mutation_side_effects, true, "28E index reports mutation side effects.");
  assert.equal(index.integrity.no_mutation_side_effects, true, "28E integrity reports mutation side effects.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

assert.equal(hashText(activeEngineBefore), expectedActiveEngineHash, "28E active_engine hash baseline drifted before test.");
assert.equal(hashText(compressedRulesBefore), expectedCompressedRulesHash, "28E compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText, uiIndexText, uiAppText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
  readFile(uiIndexPath, "utf8"),
  readFile(uiAppPath, "utf8"),
]);

assertRunAllRegistrations(runAllText);
assertStaticUiContract({ serviceText, uiIndexText, uiAppText });

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: true,
  include_markdown: true,
});

assert.equal(index.phase, "28A", "28E must harden the existing 28A index contract, not invent a new runtime phase.");
assert.equal(index.index_kind, "foreshadowing_settlement_operator_review_chain_index", "28E index kind drifted.");
assert.equal(index.index_status, "ready_for_operator_review_navigation", "28E index status drifted.");
assert.equal(index.decision, "ready_for_operator_review_navigation", "28E index decision drifted.");
assert.deepEqual(index.source_phases, ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"], "28E source phase lineage drifted.");

assertSafetyBoundary(index);
assertStableOperatorEntrypoints(index);
assertChainNavigation(index);
assertOperatorFacingLabels(index);

const compact = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: false,
});

assert.deepEqual(
  compact.operator_entrypoints.map((item) => item.key),
  expectedEntrypoints.map((item) => item.key),
  "28E compact index entrypoint keys diverged from full index.",
);
assert.deepEqual(
  compact.chain_segments.map((item) => item.key),
  expectedChainSegments.map(([key]) => key),
  "28E compact index chain segment keys diverged from full index.",
);
assert.equal(compact.raw_dashboard, null, "28E compact index should still omit raw dashboard.");
assert.equal(compact.raw_manual_review_surface, null, "28E compact index should still omit raw manual review surface.");
assert.equal(compact.index_markdown, "", "28E compact index should still omit markdown.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "28E changed active_engine hash.");
assert.equal(hashText(await readOptionalText(compressedRulesPath)), expectedCompressedRulesHash, "28E changed compressed_rules hash.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28E changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28E changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28E changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28E changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28E changed approval log.");

console.log("Phase28E foreshadowing settlement operator review chain index navigation hardening tests passed.");