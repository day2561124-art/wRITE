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

function assertSafetyLocked(index) {
  assert.equal(index.safety.read_only, true, "28B index is not read-only.");
  assert.equal(index.safety.preview_only, true, "28B index is not preview-only.");
  assert.equal(index.safety.no_auto_persist, true, "28B index can auto-persist.");
  assert.equal(index.safety.no_canon_update, true, "28B index can update Canon.");
  assert.equal(index.safety.no_active_engine_update, true, "28B index can update active_engine.");
  assert.equal(index.safety.no_compressed_rules_update, true, "28B index can update compressed_rules.");
  assert.equal(index.safety.bridge_can_approve, false, "28B index allows bridge approval.");
  assert.equal(index.safety.bridge_can_confirm_adoption, false, "28B index allows bridge adoption confirmation.");
  assert.equal(index.safety.bridge_can_activate_engine, false, "28B index allows bridge engine activation.");
  assert.equal(index.safety.index_can_approve, false, "28B index can approve.");
  assert.equal(index.safety.index_can_confirm_adoption, false, "28B index can confirm adoption.");
  assert.equal(index.safety.index_can_activate_engine, false, "28B index can activate engine.");
  assert.equal(index.safety.index_can_auto_adopt, false, "28B index can auto-adopt.");
  assert.equal(index.safety.index_can_auto_settle, false, "28B index can auto-settle.");
  assert.equal(index.safety.index_can_write_canon, false, "28B index can write Canon.");
  assert.equal(index.safety.index_can_create_pending_engine_candidate, false, "28B index can create pending engine candidate.");
  assert.equal(index.safety.pending_engine_candidate_created, false, "28B index created pending engine candidate.");
  assert.equal(index.safety.active_engine_modified, false, "28B index modified active_engine.");
  assert.equal(index.safety.canon_modified, false, "28B index modified Canon.");
  assert.equal(index.safety.compressed_rules_modified, false, "28B index modified compressed_rules.");
  assert.equal(index.safety.automatic_adoption_performed, false, "28B index performed automatic adoption.");
  assert.equal(index.safety.automatic_settlement_performed, false, "28B index performed automatic settlement.");
  assert.equal(index.safety.source_surfaces_locked, true, "28B source surfaces are not locked.");
}

function assertReviewChainIndex(index) {
  assert.equal(index.phase, "28A", "28B payload did not expose the 28A index.");
  assert.equal(index.version, "foreshadowing_settlement_operator_review_chain_index_v1", "28B index version mismatch.");
  assert.equal(index.index_kind, "foreshadowing_settlement_operator_review_chain_index", "28B index kind mismatch.");
  assert.equal(index.source_phase, "27Z", "28B index source phase mismatch.");
  assert.equal(index.index_status, "ready_for_operator_review_navigation", "28B index status mismatch.");
  assert.equal(index.decision, "ready_for_operator_review_navigation", "28B decision mismatch.");
  assert.equal(index.ok, true, "28B index should be ready.");
  assert.equal(index.can_open_review_surfaces, true, "28B index should open review surfaces.");
  assert.equal(index.can_approve, false, "28B index can approve.");
  assert.equal(index.can_confirm_adoption, false, "28B index can confirm adoption.");
  assert.equal(index.can_activate_engine, false, "28B index can activate engine.");
  assert.equal(index.can_auto_adopt, false, "28B index can auto-adopt.");
  assert.equal(index.can_auto_settle, false, "28B index can auto-settle.");
  assert.equal(index.direct_adoption_allowed, false, "28B index allows direct adoption.");
  assert.equal(index.automatic_settlement_allowed, false, "28B index allows automatic settlement.");
  assert.equal(index.requires_human_approval, true, "28B index must require human approval.");
  assert.equal(index.requires_operator_confirmation, true, "28B index must require operator confirmation.");
  assert.equal(index.review_index_only, true, "28B index must be review-index-only.");
  assert.equal(index.manual_review_only, true, "28B index must remain manual-review-only.");

  assert(Array.isArray(index.chain_segments), "28B chain segments must be an array.");
  assert.equal(index.chain_segments.length, 3, "28B should expose three chain segments.");
  assert(index.chain_segments.some((item) => item.key === "operator_readiness_chain" && item.ready === true), "28B missing ready operator readiness chain.");
  assert(index.chain_segments.some((item) => item.key === "adoption_gate_chain" && item.ready === true), "28B missing ready adoption gate chain.");
  assert(index.chain_segments.some((item) => item.key === "manual_review_entry_chain" && item.ready === true), "28B missing ready manual review entry chain.");

  assert(Array.isArray(index.phase_rows), "28B phase rows must be an array.");
  assert.equal(index.phase_rows.length, 7, "28B should index 27R, 27T, 27U, 27W, 27X, 27Y, and 27Z.");
  assert(index.phase_rows.some((row) => row.key === "phase27r_readiness_dashboard" && row.phase === "27R"), "28B missing 27R row.");
  assert(index.phase_rows.some((row) => row.key === "phase27t_adoption_readiness_gate" && row.phase === "27T"), "28B missing 27T row.");
  assert(index.phase_rows.some((row) => row.key === "phase27u_adoption_gate_surface" && row.phase === "27U"), "28B missing 27U row.");
  assert(index.phase_rows.some((row) => row.key === "phase27w_manual_adoption_review_entry_packet" && row.phase === "27W"), "28B missing 27W row.");
  assert(index.phase_rows.some((row) => row.key === "phase27x_manual_adoption_review_entry_ui_surface" && row.phase === "27X"), "28B missing 27X row.");
  assert(index.phase_rows.some((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke" && row.coverage_only === true), "28B missing 27Y coverage row.");
  assert(index.phase_rows.some((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke" && row.coverage_only === true), "28B missing 27Z coverage row.");

  assert(Array.isArray(index.cards), "28B cards must be an array.");
  assert(index.cards.length >= 6, "28B should expose summary cards.");
  assert(Array.isArray(index.operator_entrypoints), "28B operator entrypoints must be an array.");
  assert(index.operator_entrypoints.length >= 3, "28B should expose operator entrypoints.");
  assert(index.operator_entrypoints.some((item) => item.key === "open_manual_review_entry_surface" && item.read_only === true), "28B missing manual review entrypoint.");
  assert(index.operator_entrypoints.some((item) => item.key === "open_existing_approval_queue" && item.can_approve === false), "28B approval queue entrypoint must be navigation-only.");

  assert(Array.isArray(index.prohibited_actions), "28B prohibited actions must be an array.");
  assert(index.prohibited_actions.length >= 7, "28B should expose prohibited actions.");
  assert.equal(index.prohibited_actions.every((item) => item.allowed === false), true, "28B prohibited actions must stay locked.");
  assert(index.prohibited_actions.some((item) => item.key === "approve_from_index"), "28B missing approve prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "confirm_adoption_from_index"), "28B missing adoption confirmation prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "activate_engine_from_index"), "28B missing activation prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "write_canon_from_index"), "28B missing Canon write prohibition.");
  assert(index.prohibited_actions.some((item) => item.key === "update_compressed_rules_from_index"), "28B missing compressed_rules prohibition.");

  assert.equal(index.checks.index_ready, true, "28B index should be ready.");
  assert.equal(index.checks.required_payloads_readable, true, "28B required payloads are not readable.");
  assert.equal(index.checks.prohibited_actions_locked, true, "28B prohibited actions are not locked.");
  assert.equal(index.checks.source_surfaces_locked, true, "28B source surfaces are not locked.");
  assert.equal(index.checks.no_mutation_side_effects, true, "28B reports mutation side effects.");

  assert.equal(index.integrity.phase_rows_loaded, 7, "28B phase rows loaded count mismatch.");
  assert.equal(index.integrity.phase_rows_total, 7, "28B phase rows total mismatch.");
  assert.equal(index.integrity.required_payloads_readable, true, "28B integrity payload readability failed.");
  assert.equal(index.integrity.source_surfaces_locked, true, "28B integrity safety lock failed.");
  assert.equal(index.integrity.prohibited_actions_locked, true, "28B integrity prohibited action lock failed.");
  assert.equal(index.integrity.no_mutation_side_effects, true, "28B integrity mutation guard failed.");

  assert(index.raw_dashboard?.phase === "27R", "28B raw dashboard missing.");
  assert(index.raw_manual_review_surface?.phase === "27X", "28B raw manual review surface missing.");
  assert.match(index.index_markdown, /Foreshadowing Settlement Operator Review Chain Index/u, "28B markdown heading missing.");
  assert.match(index.index_markdown, /phase27z_manual_adoption_review_entry_final_bridge_smoke/u, "28B markdown missing 27Z row.");
  assertSafetyLocked(index);
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
  assert(indexText.includes('data-view-panel="writer-workbench"'), "UI index missing writer workbench panel.");
  assert(indexText.includes('id="foreshadowing-settlement-operator-review-chain-index-surface"'), "UI index missing 28B review chain index panel.");
  assert(indexText.includes("READ-ONLY REVIEW CHAIN INDEX"), "UI index missing 28B read-only eyebrow.");
  assert(indexText.includes("Foreshadowing Settlement Operator Review Chain Index"), "UI index missing 28B panel title.");
  assert(indexText.includes("Chain segments"), "UI index missing 28B chain segment section.");
  assert(indexText.includes("Indexed phases"), "UI index missing 28B indexed phase section.");
  assert(indexText.includes("Operator entrypoints"), "UI index missing 28B operator entrypoints section.");
  assert(indexText.includes("Prohibited actions"), "UI index missing 28B prohibited actions section.");
  assert(indexText.includes("Safety boundary"), "UI index missing 28B safety boundary section.");
  assert(indexText.includes("does not approve"), "UI index missing 28B no approval language.");
  assert(indexText.includes("modify active_engine"), "UI index missing 28B active_engine safety language.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assert(appText.includes("foreshadowingSettlementOperatorReviewChainIndexSurface"), "UI app.js missing 28B state field.");
  assert(appText.includes("/api/writer-workbench/foreshadowing-settlement-operator-review-chain-index-surface"), "UI app.js missing 28B API fetch.");
  assert(appText.includes("operator_review_chain_index"), "UI app.js missing 28B API payload assignment.");
  assert(appText.includes("renderForeshadowingSettlementOperatorReviewChainIndexSurface"), "UI app.js missing 28B renderer.");
  assert(appText.includes("chain_segments"), "UI app.js missing 28B chain segment rendering.");
  assert(appText.includes("phase_rows"), "UI app.js missing 28B phase row rendering.");
  assert(appText.includes("operator_entrypoints"), "UI app.js missing 28B entrypoint rendering.");
  assert(appText.includes("prohibited_actions"), "UI app.js missing 28B prohibited action rendering.");
  assert(appText.includes("index_markdown"), "UI app.js missing 28B raw markdown rendering.");
  assert(appText.includes("index_can_approve"), "UI app.js missing 28B approval safety rendering.");
  assert(appText.includes("index_can_confirm_adoption"), "UI app.js missing 28B confirmation safety rendering.");
  assert(appText.includes("index_can_activate_engine"), "UI app.js missing 28B activation safety rendering.");
  assert(appText.includes("compressed_rules_modified"), "UI app.js missing 28B compressed_rules safety rendering.");

  const apiResponse = await fetch(`${baseUrl}/api/writer-workbench/foreshadowing-settlement-operator-review-chain-index-surface`);
  const payload = await apiResponse.json();
  assert(apiResponse.ok, "28B API did not return 200.");
  assert.equal(payload.ok, true, "28B API wrapper missing ok=true.");
  assert.equal(payload.operator_readiness_dashboard?.phase, "27R", "28B API missing Phase 27R readiness dashboard.");
  assert.equal(payload.operator_adoption_readiness_gate?.phase, "27T", "28B API missing Phase 27T adoption readiness gate.");
  assert.equal(payload.operator_adoption_gate_surface?.phase, "27U", "28B API missing Phase 27U adoption gate surface.");
  assert.equal(payload.operator_manual_adoption_review_entry_packet?.phase, "27W", "28B API missing Phase 27W packet.");
  assert.equal(payload.operator_manual_adoption_review_entry_surface?.phase, "27X", "28B API missing Phase 27X surface.");
  assertReviewChainIndex(payload.operator_review_chain_index);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "28B changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "28B changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28B changed pending engine candidates.");
  assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28B changed settlement contexts.");
  assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28B changed settlement reports.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28B changed approval items.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28B changed approval log.");
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

console.log("Phase28B foreshadowing settlement operator review chain index UI surface tests passed.");
