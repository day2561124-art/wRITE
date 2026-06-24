import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";
import {
  buildForeshadowingSettlementOperatorReviewChainIndex,
} from "../../server/src/foreshadowing-settlement-operator-review-chain-index-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "ui-server.mjs");
const runAllPath = path.join(rootDir, "tests", "run-all.mjs");

const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");
const settlementContextsDir = path.join(rootDir, "data", "outputs", "settlement_contexts");
const settlementReportsDir = path.join(rootDir, "data", "outputs", "settlement_reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "approval_log.jsonl");

const reviewChainEndpoint =
  "/api/writer-workbench/foreshadowing-settlement-operator-review-chain-index-surface";
const reviewChainPanelId =
  "foreshadowing-settlement-operator-review-chain-index-surface";

const expectedRunAllRegistrations = [
  "tests/phase28/phase28a-foreshadowing-settlement-operator-review-chain-index.test.mjs",
  "tests/phase28/phase28b-foreshadowing-settlement-operator-review-chain-index-ui-surface.test.mjs",
  "tests/phase28/phase28c-foreshadowing-settlement-operator-review-chain-index-live-ui-smoke.test.mjs",
  "tests/phase28/phase28d-foreshadowing-settlement-operator-review-chain-index-final-bridge-smoke.test.mjs",
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

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForHealth(baseUrl, child, stderrBuffer) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`UI server exited early (${child.exitCode}): ${stderrBuffer.value}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`UI server did not become healthy: ${stderrBuffer.value}`);
}

function assertRunAllRegistrations(runAllText) {
  for (const registration of expectedRunAllRegistrations) {
    assert(runAllText.includes(registration), `run-all missing ${registration}.`);
  }

  assert(
    runAllText.indexOf(expectedRunAllRegistrations[0])
      < runAllText.indexOf(expectedRunAllRegistrations[1]),
    "run-all should execute 28A before 28B.",
  );
  assert(
    runAllText.indexOf(expectedRunAllRegistrations[1])
      < runAllText.indexOf(expectedRunAllRegistrations[2]),
    "run-all should execute 28B before 28C.",
  );
  assert(
    runAllText.indexOf(expectedRunAllRegistrations[2])
      < runAllText.indexOf(expectedRunAllRegistrations[3]),
    "run-all should execute 28C before 28D.",
  );
}

function assertSafetyLocked(safety, label = "28D bridge index") {
  assert.equal(safety.read_only, true, `${label} is not read-only.`);
  assert.equal(safety.preview_only, true, `${label} is not preview-only.`);
  assert.equal(safety.no_auto_persist, true, `${label} can auto-persist.`);
  assert.equal(safety.no_canon_update, true, `${label} can update Canon.`);
  assert.equal(safety.no_active_engine_update, true, `${label} can update active_engine.`);
  assert.equal(safety.no_compressed_rules_update, true, `${label} can update compressed_rules.`);
  assert.equal(safety.bridge_can_approve, false, `${label} allows bridge approval.`);
  assert.equal(safety.bridge_can_confirm_adoption, false, `${label} allows bridge adoption confirmation.`);
  assert.equal(safety.bridge_can_activate_engine, false, `${label} allows bridge engine activation.`);
  assert.equal(safety.index_can_approve, false, `${label} can approve.`);
  assert.equal(safety.index_can_confirm_adoption, false, `${label} can confirm adoption.`);
  assert.equal(safety.index_can_activate_engine, false, `${label} can activate engine.`);
  assert.equal(safety.index_can_auto_adopt, false, `${label} can auto-adopt.`);
  assert.equal(safety.index_can_auto_settle, false, `${label} can auto-settle.`);
  assert.equal(safety.index_can_write_canon, false, `${label} can write Canon.`);
  assert.equal(
    safety.index_can_create_pending_engine_candidate,
    false,
    `${label} can create pending engine candidate.`,
  );
  assert.equal(safety.pending_engine_candidate_created, false, `${label} created pending engine candidate.`);
  assert.equal(safety.active_engine_modified, false, `${label} modified active_engine.`);
  assert.equal(safety.canon_modified, false, `${label} modified Canon.`);
  assert.equal(safety.compressed_rules_modified, false, `${label} modified compressed_rules.`);
  assert.equal(safety.automatic_adoption_performed, false, `${label} performed automatic adoption.`);
  assert.equal(safety.automatic_settlement_performed, false, `${label} performed automatic settlement.`);
  assert.equal(safety.source_surfaces_locked, true, `${label} source surfaces are not locked.`);
}

function assertStaticBridgeArtifacts(indexText, appText) {
  assert(indexText.includes('data-view-panel="writer-workbench"'), "28D UI missing writer workbench panel.");
  assert(indexText.includes(`id="${reviewChainPanelId}"`), "28D UI missing review chain index panel.");
  assert(indexText.includes("READ-ONLY REVIEW CHAIN INDEX"), "28D UI missing read-only review-chain eyebrow.");
  assert(indexText.includes("Foreshadowing Settlement Operator Review Chain Index"), "28D UI missing review-chain panel title.");
  assert(indexText.includes("Raw foreshadowing settlement operator review chain index"), "28D UI missing raw index block.");
  assert(indexText.includes("does not approve"), "28D UI missing approval safety language.");
  assert(indexText.includes("modify active_engine"), "28D UI missing active_engine safety language.");

  assert(
    appText.includes("foreshadowingSettlementOperatorReviewChainIndexSurface"),
    "28D app.js missing review-chain state field.",
  );
  assert(appText.includes(reviewChainEndpoint), "28D app.js missing review-chain endpoint.");
  assert(appText.includes("operator_review_chain_index"), "28D app.js missing review-chain payload field.");
  assert(
    appText.includes("renderForeshadowingSettlementOperatorReviewChainIndexSurface"),
    "28D app.js missing review-chain renderer.",
  );
  assert(appText.includes("chain_segments"), "28D app.js missing chain segment rendering.");
  assert(appText.includes("phase_rows"), "28D app.js missing phase row rendering.");
  assert(appText.includes("operator_entrypoints"), "28D app.js missing entrypoint rendering.");
  assert(appText.includes("prohibited_actions"), "28D app.js missing prohibited action rendering.");
  assert(appText.includes("index_markdown"), "28D app.js missing raw markdown rendering.");
  assert(appText.includes("index_can_approve"), "28D app.js missing approval safety rendering.");
  assert(appText.includes("index_can_confirm_adoption"), "28D app.js missing adoption confirmation safety rendering.");
  assert(appText.includes("index_can_activate_engine"), "28D app.js missing activation safety rendering.");
  assert(appText.includes("compressed_rules_modified"), "28D app.js missing compressed_rules safety rendering.");
}

function assertPhaseRows(index) {
  assert(Array.isArray(index.phase_rows), "28D phase rows must be an array.");
  assert.equal(index.phase_rows.length, 7, "28D should index 27R, 27T, 27U, 27W, 27X, 27Y, and 27Z.");
  assert(index.phase_rows.some((row) => row.key === "phase27r_readiness_dashboard" && row.phase === "27R"), "28D missing 27R row.");
  assert(index.phase_rows.some((row) => row.key === "phase27t_adoption_readiness_gate" && row.phase === "27T"), "28D missing 27T row.");
  assert(index.phase_rows.some((row) => row.key === "phase27u_adoption_gate_surface" && row.phase === "27U"), "28D missing 27U row.");
  assert(index.phase_rows.some((row) => row.key === "phase27w_manual_adoption_review_entry_packet" && row.phase === "27W"), "28D missing 27W row.");
  assert(index.phase_rows.some((row) => row.key === "phase27x_manual_adoption_review_entry_ui_surface" && row.phase === "27X"), "28D missing 27X row.");
  assert(
    index.phase_rows.some((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke" && row.coverage_only === true),
    "28D missing 27Y coverage row.",
  );
  assert(
    index.phase_rows.some((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke" && row.coverage_only === true),
    "28D missing 27Z coverage row.",
  );

  const liveSmokeRow = index.phase_rows.find((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke");
  assert.equal(
    liveSmokeRow.test_path,
    "tests/phase27/phase27y-foreshadowing-settlement-operator-manual-adoption-review-entry-live-ui-smoke.test.mjs",
    "28D 27Y test path mismatch.",
  );
  const finalBridgeRow = index.phase_rows.find((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke");
  assert.equal(
    finalBridgeRow.test_path,
    "tests/phase27/phase27z-foreshadowing-settlement-operator-manual-adoption-review-entry-final-bridge-smoke.test.mjs",
    "28D 27Z test path mismatch.",
  );
}

function assertReviewChainIndex(index, label = "28D bridge index") {
  assert.equal(index.phase, "28A", `${label} did not expose the 28A index.`);
  assert.equal(index.version, "foreshadowing_settlement_operator_review_chain_index_v1", `${label} version mismatch.`);
  assert.equal(index.index_kind, "foreshadowing_settlement_operator_review_chain_index", `${label} kind mismatch.`);
  assert.equal(index.source_phase, "27Z", `${label} source phase mismatch.`);
  assert.deepEqual(
    index.source_phases,
    ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"],
    `${label} source phases mismatch.`,
  );
  assert.equal(index.index_status, "ready_for_operator_review_navigation", `${label} index status mismatch.`);
  assert.equal(index.decision, "ready_for_operator_review_navigation", `${label} decision mismatch.`);
  assert.equal(index.ok, true, `${label} should be ready.`);
  assert.equal(index.can_open_review_surfaces, true, `${label} should open review surfaces.`);
  assert.equal(index.can_approve, false, `${label} can approve.`);
  assert.equal(index.can_confirm_adoption, false, `${label} can confirm adoption.`);
  assert.equal(index.can_activate_engine, false, `${label} can activate engine.`);
  assert.equal(index.can_auto_adopt, false, `${label} can auto-adopt.`);
  assert.equal(index.can_auto_settle, false, `${label} can auto-settle.`);
  assert.equal(index.direct_adoption_allowed, false, `${label} allows direct adoption.`);
  assert.equal(index.automatic_settlement_allowed, false, `${label} allows automatic settlement.`);
  assert.equal(index.requires_human_approval, true, `${label} must require human approval.`);
  assert.equal(index.requires_operator_confirmation, true, `${label} must require operator confirmation.`);
  assert.equal(index.review_index_only, true, `${label} must be review-index-only.`);
  assert.equal(index.manual_review_only, true, `${label} must remain manual-review-only.`);

  assert(Array.isArray(index.cards), `${label} cards must be an array.`);
  assert(index.cards.length >= 6, `${label} should expose summary cards.`);
  assert(index.cards.some((item) => item.key === "phase_rows"), `${label} missing phase row card.`);
  assert(index.cards.some((item) => item.key === "safety_boundary"), `${label} missing safety card.`);

  assert(Array.isArray(index.chain_segments), `${label} chain segments must be an array.`);
  assert.equal(index.chain_segments.length, 3, `${label} should expose three chain segments.`);
  assert(index.chain_segments.some((item) => item.key === "operator_readiness_chain" && item.ready === true), `${label} missing ready operator readiness chain.`);
  assert(index.chain_segments.some((item) => item.key === "adoption_gate_chain" && item.ready === true), `${label} missing ready adoption gate chain.`);
  assert(index.chain_segments.some((item) => item.key === "manual_review_entry_chain" && item.ready === true), `${label} missing ready manual review entry chain.`);

  assertPhaseRows(index);

  assert(Array.isArray(index.operator_entrypoints), `${label} operator entrypoints must be an array.`);
  assert(index.operator_entrypoints.length >= 3, `${label} should expose operator entrypoints.`);
  assert(index.operator_entrypoints.some((item) => item.key === "open_operator_readiness_dashboard" && item.read_only === true), `${label} missing readiness dashboard entrypoint.`);
  assert(index.operator_entrypoints.some((item) => item.key === "open_manual_review_entry_surface" && item.read_only === true), `${label} missing manual review entrypoint.`);
  assert(index.operator_entrypoints.some((item) => item.key === "open_existing_approval_queue" && item.can_approve === false), `${label} approval queue entrypoint must be navigation-only.`);

  assert(Array.isArray(index.prohibited_actions), `${label} prohibited actions must be an array.`);
  assert(index.prohibited_actions.length >= 7, `${label} should expose prohibited actions.`);
  assert.equal(index.prohibited_actions.every((item) => item.allowed === false), true, `${label} prohibited actions must stay locked.`);
  assert(index.prohibited_actions.some((item) => item.key === "approve_from_index"), `${label} missing approve prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "confirm_adoption_from_index"), `${label} missing adoption confirmation prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "activate_engine_from_index"), `${label} missing activation prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "write_canon_from_index"), `${label} missing Canon write prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "create_pending_engine_candidate_from_index"), `${label} missing pending engine candidate prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "auto_settle_from_index"), `${label} missing auto-settle prohibition.`);
  assert(index.prohibited_actions.some((item) => item.key === "update_compressed_rules_from_index"), `${label} missing compressed_rules prohibition.`);

  assert.equal(index.checks.readiness_dashboard_loaded, true, `${label} dashboard check failed.`);
  assert.equal(index.checks.adoption_readiness_gate_loaded, true, `${label} 27T gate check failed.`);
  assert.equal(index.checks.adoption_gate_surface_loaded, true, `${label} 27U surface check failed.`);
  assert.equal(index.checks.manual_review_entry_packet_loaded, true, `${label} 27W packet check failed.`);
  assert.equal(index.checks.manual_review_entry_surface_loaded, true, `${label} 27X surface check failed.`);
  assert.equal(index.checks.live_ui_smoke_covered, true, `${label} 27Y coverage check failed.`);
  assert.equal(index.checks.final_bridge_smoke_covered, true, `${label} 27Z coverage check failed.`);
  assert.equal(index.checks.index_ready, true, `${label} index should be ready.`);
  assert.equal(index.checks.required_payloads_readable, true, `${label} required payloads are not readable.`);
  assert.equal(index.checks.prohibited_actions_locked, true, `${label} prohibited actions are not locked.`);
  assert.equal(index.checks.source_surfaces_locked, true, `${label} source surfaces are not locked.`);
  assert.equal(index.checks.no_mutation_side_effects, true, `${label} reports mutation side effects.`);

  assert.equal(index.integrity.phase_rows_loaded, 7, `${label} phase rows loaded count mismatch.`);
  assert.equal(index.integrity.phase_rows_total, 7, `${label} phase rows total mismatch.`);
  assert.equal(index.integrity.required_payloads_readable, true, `${label} integrity payload readability failed.`);
  assert.equal(index.integrity.source_surfaces_locked, true, `${label} integrity safety lock failed.`);
  assert.equal(index.integrity.prohibited_actions_locked, true, `${label} integrity prohibited action lock failed.`);
  assert.equal(index.integrity.no_mutation_side_effects, true, `${label} integrity mutation guard failed.`);

  assert(index.raw_dashboard?.phase === "27R", `${label} raw dashboard missing.`);
  assert(index.raw_manual_review_surface?.phase === "27X", `${label} raw manual review surface missing.`);
  assert.match(index.index_markdown, /Foreshadowing Settlement Operator Review Chain Index/u, `${label} markdown heading missing.`);
  assert.match(index.index_markdown, /phase27z_manual_adoption_review_entry_final_bridge_smoke/u, `${label} markdown missing 27Z row.`);
  assertSafetyLocked(index.safety, label);
}

function assertBridgePayload(payload) {
  assert.equal(payload.ok, true, "28D API wrapper missing ok=true.");
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, "operator_review_chain_index"),
    true,
    "28D API wrapper missing operator_review_chain_index.",
  );
  assert.equal(
    payload.operator_review_chain_index?.index_kind,
    "foreshadowing_settlement_operator_review_chain_index",
    "28D API wrapper missing review-chain index payload.",
  );
  assert.equal(payload.operator_readiness_dashboard?.phase, "27R", "28D API missing Phase 27R readiness dashboard.");
  assert.equal(payload.operator_adoption_readiness_gate?.phase, "27T", "28D API missing Phase 27T adoption readiness gate.");
  assert.equal(payload.operator_adoption_gate_surface?.phase, "27U", "28D API missing Phase 27U adoption gate surface.");
  assert.equal(payload.operator_manual_adoption_review_entry_packet?.phase, "27W", "28D API missing Phase 27W packet.");
  assert.equal(payload.operator_manual_adoption_review_entry_surface?.phase, "27X", "28D API missing Phase 27X surface.");
  assertReviewChainIndex(payload.operator_review_chain_index, "28D API review-chain index");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

const runAllText = await readFile(runAllPath, "utf8");
assertRunAllRegistrations(runAllText);

const localIndex = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: true,
  include_markdown: true,
});
assertReviewChainIndex(localIndex, "28D local review-chain index");

const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const stderrBuffer = { value: "" };

const child = spawn(process.execPath, [
  serverPath,
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
], {
  cwd: rootDir,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

child.stdout.resume();
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderrBuffer.value += chunk;
});

try {
  await waitForHealth(baseUrl, child, stderrBuffer);

  const indexResponse = await fetch(`${baseUrl}/`);
  const indexText = await indexResponse.text();
  assert(indexResponse.ok, "UI index did not return 200.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assertStaticBridgeArtifacts(indexText, appText);

  const apiResponse = await fetch(`${baseUrl}${reviewChainEndpoint}`);
  const contentType = apiResponse.headers.get("content-type") ?? "";
  const payload = await apiResponse.json();
  assert(apiResponse.ok, "28D API did not return 200.");
  assert(contentType.includes("application/json"), "28D API did not return JSON.");
  assertBridgePayload(payload);

  const apiIndex = payload.operator_review_chain_index;
  assert.deepEqual(
    apiIndex.source_phases,
    localIndex.source_phases,
    "28D API/local source phases diverged.",
  );
  assert.deepEqual(
    apiIndex.prohibited_actions.map((item) => item.key),
    localIndex.prohibited_actions.map((item) => item.key),
    "28D API/local prohibited action keys diverged.",
  );
  assert.deepEqual(
    apiIndex.chain_segments.map((item) => item.key),
    localIndex.chain_segments.map((item) => item.key),
    "28D API/local chain segment keys diverged.",
  );

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "28D changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "28D changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28D changed pending engine candidates.");
  assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28D changed settlement contexts.");
  assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28D changed settlement reports.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28D changed approval items.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28D changed approval log.");
} finally {
  terminateProcessTree(child);
  await new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 5_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

console.log("Phase28D foreshadowing settlement operator review chain index final bridge smoke tests passed.");


