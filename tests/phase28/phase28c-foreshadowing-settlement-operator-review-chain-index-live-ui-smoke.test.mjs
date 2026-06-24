import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "ui-server.mjs");

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

function assertSafetyLocked(safety, label = "28C index") {
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

function assertUiIndexHtml(indexText) {
  assert(indexText.includes('data-view-panel="writer-workbench"'), "UI index missing writer workbench panel.");
  assert(indexText.includes(`id="${reviewChainPanelId}"`), "UI index missing 28C review chain index panel.");
  assert(indexText.includes("READ-ONLY REVIEW CHAIN INDEX"), "UI index missing 28C read-only eyebrow.");
  assert(indexText.includes("Foreshadowing Settlement Operator Review Chain Index"), "UI index missing 28C panel title.");
  assert(indexText.includes("Chain segments"), "UI index missing 28C chain segment section.");
  assert(indexText.includes("Indexed phases"), "UI index missing 28C indexed phase section.");
  assert(indexText.includes("Operator entrypoints"), "UI index missing 28C operator entrypoints section.");
  assert(indexText.includes("Prohibited actions"), "UI index missing 28C prohibited actions section.");
  assert(indexText.includes("Safety boundary"), "UI index missing 28C safety boundary section.");
  assert(indexText.includes("Raw foreshadowing settlement operator review chain index"), "UI index missing 28C raw index section.");
  assert(indexText.includes("does not approve"), "UI index missing 28C no approval language.");
  assert(indexText.includes("modify active_engine"), "UI index missing 28C active_engine safety language.");
}

function assertAppJsWiring(appText) {
  assert(
    appText.includes("foreshadowingSettlementOperatorReviewChainIndexSurface"),
    "UI app.js missing 28C state field.",
  );
  assert(appText.includes(reviewChainEndpoint), "UI app.js missing 28C API fetch.");
  assert(appText.includes("operator_review_chain_index"), "UI app.js missing 28C API payload assignment.");
  assert(
    appText.includes("renderForeshadowingSettlementOperatorReviewChainIndexSurface"),
    "UI app.js missing 28C renderer.",
  );
  assert(appText.includes("chain_segments"), "UI app.js missing 28C chain segment rendering.");
  assert(appText.includes("phase_rows"), "UI app.js missing 28C phase row rendering.");
  assert(appText.includes("operator_entrypoints"), "UI app.js missing 28C entrypoint rendering.");
  assert(appText.includes("prohibited_actions"), "UI app.js missing 28C prohibited action rendering.");
  assert(appText.includes("index_markdown"), "UI app.js missing 28C raw markdown rendering.");
  assert(appText.includes("index_can_approve"), "UI app.js missing 28C approval safety rendering.");
  assert(appText.includes("index_can_confirm_adoption"), "UI app.js missing 28C confirmation safety rendering.");
  assert(appText.includes("index_can_activate_engine"), "UI app.js missing 28C activation safety rendering.");
  assert(appText.includes("compressed_rules_modified"), "UI app.js missing 28C compressed_rules safety rendering.");
}

function assertReviewChainIndex(index) {
  assert.equal(index.phase, "28A", "28C payload did not expose the 28A index.");
  assert.equal(index.version, "foreshadowing_settlement_operator_review_chain_index_v1", "28C index version mismatch.");
  assert.equal(index.index_kind, "foreshadowing_settlement_operator_review_chain_index", "28C index kind mismatch.");
  assert.equal(index.source_phase, "27Z", "28C index source phase mismatch.");
  assert.deepEqual(
    index.source_phases,
    ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"],
    "28C index source phases mismatch.",
  );
  assert.equal(index.index_status, "ready_for_operator_review_navigation", "28C index status mismatch.");
  assert.equal(index.decision, "ready_for_operator_review_navigation", "28C decision mismatch.");
  assert.equal(index.ok, true, "28C index should be ready.");
  assert.equal(index.can_open_review_surfaces, true, "28C index should open review surfaces.");
  assert.equal(index.can_approve, false, "28C index can approve.");
  assert.equal(index.can_confirm_adoption, false, "28C index can confirm adoption.");
  assert.equal(index.can_activate_engine, false, "28C index can activate engine.");
  assert.equal(index.can_auto_adopt, false, "28C index can auto-adopt.");
  assert.equal(index.can_auto_settle, false, "28C index can auto-settle.");
  assert.equal(index.direct_adoption_allowed, false, "28C index allows direct adoption.");
  assert.equal(index.automatic_settlement_allowed, false, "28C index allows automatic settlement.");
  assert.equal(index.requires_human_approval, true, "28C index must require human approval.");
  assert.equal(index.requires_operator_confirmation, true, "28C index must require operator confirmation.");
  assert.equal(index.review_index_only, true, "28C index must be review-index-only.");
  assert.equal(index.manual_review_only, true, "28C index must remain manual-review-only.");

  assert(Array.isArray(index.cards), "28C cards must be an array.");
  assert(index.cards.length >= 6, "28C should expose summary cards.");
  assert(index.cards.some((item) => item.key === "phase_rows"), "28C missing phase row card.");
  assert(index.cards.some((item) => item.key === "safety_boundary"), "28C missing safety card.");

  assert(Array.isArray(index.chain_segments), "28C chain segments must be an array.");
  assert.equal(index.chain_segments.length, 3, "28C should expose three chain segments.");
  assert(index.chain_segments.some((item) => item.key === "operator_readiness_chain" && item.ready === true), "28C missing ready operator readiness chain.");
  assert(index.chain_segments.some((item) => item.key === "adoption_gate_chain" && item.ready === true), "28C missing ready adoption gate chain.");
  assert(index.chain_segments.some((item) => item.key === "manual_review_entry_chain" && item.ready === true), "28C missing ready manual review entry chain.");

  assert(Array.isArray(index.phase_rows), "28C phase rows must be an array.");
  assert.equal(index.phase_rows.length, 7, "28C should index 27R, 27T, 27U, 27W, 27X, 27Y, and 27Z.");
  assert(index.phase_rows.some((row) => row.key === "phase27r_readiness_dashboard" && row.phase === "27R"), "28C missing 27R row.");
  assert(index.phase_rows.some((row) => row.key === "phase27t_adoption_readiness_gate" && row.phase === "27T"), "28C missing 27T row.");
  assert(index.phase_rows.some((row) => row.key === "phase27u_adoption_gate_surface" && row.phase === "27U"), "28C missing 27U row.");
  assert(index.phase_rows.some((row) => row.key === "phase27w_manual_adoption_review_entry_packet" && row.phase === "27W"), "28C missing 27W row.");
  assert(index.phase_rows.some((row) => row.key === "phase27x_manual_adoption_review_entry_ui_surface" && row.phase === "27X"), "28C missing 27X row.");
  assert(
    index.phase_rows.some((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke" && row.coverage_only === true),
    "28C missing 27Y coverage row.",
  );
  assert(
    index.phase_rows.some((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke" && row.coverage_only === true),
    "28C missing 27Z coverage row.",
  );

  const liveSmokeRow = index.phase_rows.find((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke");
  assert.equal(
    liveSmokeRow.test_path,
    "tests/phase27/phase27y-foreshadowing-settlement-operator-manual-adoption-review-entry-live-ui-smoke.test.mjs",
    "28C 27Y test path mismatch.",
  );
  const finalBridgeRow = index.phase_rows.find((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke");
  assert.equal(
    finalBridgeRow.test_path,
    "tests/phase27/phase27z-foreshadowing-settlement-operator-manual-adoption-review-entry-final-bridge-smoke.test.mjs",
    "28C 27Z test path mismatch.",
  );

  assert(Array.isArray(index.operator_entrypoints), "28C operator entrypoints must be an array.");
  assert(index.operator_entrypoints.length >= 3, "28C should expose operator entrypoints.");
  assert(index.operator_entrypoints.some((item) => item.key === "open_operator_readiness_dashboard" && item.read_only === true), "28C missing readiness dashboard entrypoint.");
  assert(index.operator_entrypoints.some((item) => item.key === "open_manual_review_entry_surface" && item.read_only === true), "28C missing manual review entrypoint.");
  assert(index.operator_entrypoints.some((item) => item.key === "open_existing_approval_queue" && item.can_approve === false), "28C approval queue entrypoint must be navigation-only.");

  assert(Array.isArray(index.prohibited_actions), "28C prohibited actions must be an array.");
  assert(index.prohibited_actions.length >= 7, "28C should expose prohibited actions.");
  assert.equal(index.prohibited_actions.every((item) => item.allowed === false), true, "28C prohibited actions must stay locked.");
  assert(index.prohibited_actions.some((item) => item.key === "approve_from_index"), "28C missing approve prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "confirm_adoption_from_index"), "28C missing adoption confirmation prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "activate_engine_from_index"), "28C missing activation prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "write_canon_from_index"), "28C missing Canon write prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "create_pending_engine_candidate_from_index"), "28C missing pending candidate prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "auto_settle_from_index"), "28C missing auto-settle prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "update_compressed_rules_from_index"), "28C missing compressed_rules prohibition.");

  assert.equal(index.checks.readiness_dashboard_loaded, true, "28C dashboard check failed.");
  assert.equal(index.checks.adoption_readiness_gate_loaded, true, "28C 27T gate check failed.");
  assert.equal(index.checks.adoption_gate_surface_loaded, true, "28C 27U surface check failed.");
  assert.equal(index.checks.manual_review_entry_packet_loaded, true, "28C 27W packet check failed.");
  assert.equal(index.checks.manual_review_entry_surface_loaded, true, "28C 27X surface check failed.");
  assert.equal(index.checks.live_ui_smoke_covered, true, "28C 27Y coverage check failed.");
  assert.equal(index.checks.final_bridge_smoke_covered, true, "28C 27Z coverage check failed.");
  assert.equal(index.checks.index_ready, true, "28C index should be ready.");
  assert.equal(index.checks.required_payloads_readable, true, "28C required payloads are not readable.");
  assert.equal(index.checks.prohibited_actions_locked, true, "28C prohibited actions are not locked.");
  assert.equal(index.checks.source_surfaces_locked, true, "28C source surfaces are not locked.");
  assert.equal(index.checks.no_mutation_side_effects, true, "28C reports mutation side effects.");

  assert.equal(index.integrity.phase_rows_loaded, 7, "28C phase rows loaded count mismatch.");
  assert.equal(index.integrity.phase_rows_total, 7, "28C phase rows total mismatch.");
  assert.equal(index.integrity.required_payloads_readable, true, "28C integrity payload readability failed.");
  assert.equal(index.integrity.source_surfaces_locked, true, "28C integrity safety lock failed.");
  assert.equal(index.integrity.prohibited_actions_locked, true, "28C integrity prohibited action lock failed.");
  assert.equal(index.integrity.no_mutation_side_effects, true, "28C integrity mutation guard failed.");

  assert(index.raw_dashboard?.phase === "27R", "28C raw dashboard missing.");
  assert(index.raw_manual_review_surface?.phase === "27X", "28C raw manual review surface missing.");
  assert.match(index.index_markdown, /Foreshadowing Settlement Operator Review Chain Index/u, "28C markdown heading missing.");
  assert.match(index.index_markdown, /phase27z_manual_adoption_review_entry_final_bridge_smoke/u, "28C markdown missing 27Z row.");
  assertSafetyLocked(index.safety);
}

function assertBridgePayload(payload) {
  assert.equal(payload.ok, true, "28C API wrapper missing ok=true.");
  assert.equal(payload.operator_readiness_dashboard?.phase, "27R", "28C API missing Phase 27R readiness dashboard.");
  assert.equal(payload.operator_adoption_readiness_gate?.phase, "27T", "28C API missing Phase 27T adoption readiness gate.");
  assert.equal(payload.operator_adoption_gate_surface?.phase, "27U", "28C API missing Phase 27U adoption gate surface.");
  assert.equal(payload.operator_manual_adoption_review_entry_packet?.phase, "27W", "28C API missing Phase 27W packet.");
  assert.equal(payload.operator_manual_adoption_review_entry_surface?.phase, "27X", "28C API missing Phase 27X surface.");
  assertReviewChainIndex(payload.operator_review_chain_index);
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

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
  assertUiIndexHtml(indexText);

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assertAppJsWiring(appText);

  const apiResponse = await fetch(`${baseUrl}${reviewChainEndpoint}`);
  const contentType = apiResponse.headers.get("content-type") ?? "";
  const payload = await apiResponse.json();
  assert(apiResponse.ok, "28C API did not return 200.");
  assert(contentType.includes("application/json"), "28C API did not return JSON.");
  assertBridgePayload(payload);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "28C changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "28C changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28C changed pending engine candidates.");
  assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28C changed settlement contexts.");
  assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28C changed settlement reports.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28C changed approval items.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28C changed approval log.");
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

console.log("Phase28C foreshadowing settlement operator review chain index live UI smoke tests passed.");
