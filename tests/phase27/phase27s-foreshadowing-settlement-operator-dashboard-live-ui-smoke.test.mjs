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
const workflowSettlementContextsDir = path.join(rootDir, "data", "writing_workflow", "settlements", "contexts");
const workflowSettlementReportsDir = path.join(rootDir, "data", "writing_workflow", "settlements", "reports");
const approvalItemsDir = path.join(rootDir, "data", "approval_queue", "items");
const approvalLogPath = path.join(rootDir, "data", "approval_queue", "logs", "approval_log.jsonl");

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
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

async function readJson(response) {
  const payload = await response.json();
  return { response, payload };
}

function assertSafetyLocked(safety) {
  assert.equal(safety.read_only, true, "Readiness dashboard is not read-only.");
  assert.equal(safety.preview_only, true, "Readiness dashboard is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "Readiness dashboard can auto-persist.");
  assert.equal(safety.no_canon_update, true, "Readiness dashboard can update Canon DB.");
  assert.equal(safety.no_active_engine_update, true, "Readiness dashboard can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "Readiness dashboard allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "Readiness dashboard allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "Readiness dashboard allows bridge active_engine activation.");
  assert.equal(safety.pending_engine_candidate_created, false, "Readiness dashboard created a pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "Readiness dashboard modified active_engine.");
  assert.equal(safety.canon_modified, false, "Readiness dashboard modified Canon DB.");
  assert.equal(safety.compressed_rules_modified, false, "Readiness dashboard modified compressed_rules.");
  assert.equal(safety.ui_can_approve, false, "Readiness dashboard UI can approve.");
  assert.equal(safety.ui_can_confirm_adoption, false, "Readiness dashboard UI can confirm adoption.");
  assert.equal(safety.ui_can_activate_engine, false, "Readiness dashboard UI can activate engine.");
}

function assertDashboardPayload(dashboard) {
  assert.equal(dashboard.phase, "27R", "Dashboard phase mismatch.");
  assert.equal(
    dashboard.version,
    "foreshadowing_settlement_operator_readiness_dashboard_v1",
    "Dashboard version mismatch.",
  );
  assert.equal(
    dashboard.dashboard_kind,
    "foreshadowing_settlement_operator_readiness_dashboard",
    "Dashboard kind mismatch.",
  );
  assert.equal(dashboard.source_phase, "27Q", "Dashboard source phase mismatch.");
  assert.deepEqual(
    dashboard.source_phases,
    ["27J", "27K", "27L", "27M", "27N", "27O", "27P", "27Q"],
    "Dashboard source phases mismatch.",
  );
  assert.equal(dashboard.smoke_phase, "27Q", "Dashboard smoke phase mismatch.");
  assert(["ready", "blocked"].includes(dashboard.dashboard_status), "Dashboard status must be ready or blocked.");
  assert(["ready", "blocked"].includes(dashboard.status_badge?.label), "Dashboard status badge label mismatch.");
  assert(Array.isArray(dashboard.cards), "Dashboard cards must be an array.");
  assert(Array.isArray(dashboard.stage_cards), "Dashboard stage cards must be an array.");
  assert(Array.isArray(dashboard.handoff_cards), "Dashboard handoff cards must be an array.");
  assert(Array.isArray(dashboard.chatgpt_surface_cards), "Dashboard ChatGPT cards must be an array.");
  assert(Array.isArray(dashboard.next_operator_actions), "Dashboard next_operator_actions must be an array.");
  assert.equal(dashboard.stage_cards.length, 8, "Dashboard should expose eight source stage cards.");
  assert.equal(dashboard.handoff_cards.length, 6, "Dashboard should expose six handoff cards.");
  assert(dashboard.chatgpt_surface_cards.length >= 5, "Dashboard should expose ChatGPT surface cards.");
  assert(dashboard.next_operator_actions.length >= 1, "Dashboard should expose at least one next operator action.");

  const cardKeys = new Set(dashboard.cards.map((card) => card.key));
  for (const key of ["full_bridge_smoke", "phase_lineage", "handoff_continuity", "chatgpt_surface", "safety_boundary"]) {
    assert(cardKeys.has(key), `Dashboard missing card: ${key}`);
  }

  const stageKeys = dashboard.stage_cards.map((stage) => stage.key);
  for (const key of ["operator_review_panel", "operator_review_panel_ui", "handoff_packet", "audit_receipt", "decision_ledger", "ledger_ui", "bridge_surface"]) {
    assert(stageKeys.includes(key), `Dashboard missing stage card: ${key}`);
  }

  assertSafetyLocked(dashboard.safety);
  assert.equal(typeof dashboard.integrity, "object", "Dashboard integrity must be an object.");
  assert.equal(typeof dashboard.surface_markdown, "string", "Dashboard markdown must be a string.");
  assert.match(
    dashboard.surface_markdown,
    /Foreshadowing Settlement Operator Readiness Dashboard/u,
    "Dashboard markdown missing heading.",
  );
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const workflowSettlementContextsBefore = await readOptionalDirectory(workflowSettlementContextsDir);
const workflowSettlementReportsBefore = await readOptionalDirectory(workflowSettlementReportsDir);
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
  assert(indexText.includes('data-view-panel="writer-workbench"'), "UI index is missing writer workbench panel.");
  assert(
    indexText.includes('id="foreshadowing-settlement-operator-readiness-dashboard"'),
    "UI index is missing readiness dashboard root.",
  );
  assert(
    indexText.includes("Foreshadowing Settlement Operator Readiness Dashboard"),
    "UI index is missing readiness dashboard heading.",
  );
  assert(indexText.includes("27Q full bridge smoke"), "UI index is missing the 27Q smoke label.");
  assert(indexText.includes("read-only"), "UI index is missing read-only safety copy.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assert(
    appText.includes("renderForeshadowingSettlementOperatorReadinessDashboard"),
    "UI app.js is missing readiness dashboard renderer.",
  );
  assert(
    appText.includes("/api/writer-workbench/foreshadowing-settlement-operator-readiness-dashboard"),
    "UI app.js is missing readiness dashboard API fetch.",
  );
  assert(
    appText.includes("state.foreshadowingSettlementOperatorReadinessDashboard"),
    "UI app.js is missing readiness dashboard state wiring.",
  );

  const dashboardResult = await readJson(await fetch(
    `${baseUrl}/api/writer-workbench/foreshadowing-settlement-operator-readiness-dashboard`,
  ));
  assert(dashboardResult.response.ok, "Readiness dashboard API did not return 200.");
  assert.equal(dashboardResult.payload.ok, true, "Readiness dashboard API missing ok=true.");
  assert.equal(
    dashboardResult.payload.operator_panel?.phase,
    "27J",
    "Live dashboard payload missing 27J operator review panel.",
  );
  assert.equal(
    dashboardResult.payload.operator_panel_ui?.phase,
    "27K",
    "Live dashboard payload missing 27K operator panel UI.",
  );
  assert.equal(
    dashboardResult.payload.operator_handoff_packet?.phase,
    "27L",
    "Live dashboard payload missing 27L handoff packet.",
  );
  assert.equal(
    dashboardResult.payload.operator_handoff_audit_receipt?.phase,
    "27M",
    "Live dashboard payload missing 27M audit receipt.",
  );
  assert.equal(
    dashboardResult.payload.operator_decision_ledger?.phase,
    "27N",
    "Live dashboard payload missing 27N decision ledger.",
  );
  assert.equal(
    dashboardResult.payload.operator_ledger_ui?.phase,
    "27O",
    "Live dashboard payload missing 27O ledger UI.",
  );
  assertDashboardPayload(dashboardResult.payload.operator_readiness_dashboard);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "active_engine changed after dashboard live UI smoke.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "compressed_rules changed after dashboard live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "Pending engine candidates changed after dashboard live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(workflowSettlementContextsDir), workflowSettlementContextsBefore, "Settlement contexts changed after dashboard live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(workflowSettlementReportsDir), workflowSettlementReportsBefore, "Settlement reports changed after dashboard live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "Approval queue items changed after dashboard live UI smoke.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "Approval log changed after dashboard live UI smoke.");
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

console.log("Phase27S foreshadowing settlement operator dashboard live UI smoke tests passed.");
