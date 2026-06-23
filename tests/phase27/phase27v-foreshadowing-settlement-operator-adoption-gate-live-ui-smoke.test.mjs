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
  assert.equal(safety.read_only, true, "Adoption gate surface is not read-only.");
  assert.equal(safety.preview_only, true, "Adoption gate surface is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "Adoption gate surface can auto-persist.");
  assert.equal(safety.no_canon_update, true, "Adoption gate surface can update Canon DB.");
  assert.equal(safety.no_active_engine_update, true, "Adoption gate surface can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "Adoption gate surface allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "Adoption gate surface allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "Adoption gate surface allows bridge active_engine activation.");
  assert.equal(safety.surface_can_approve, false, "Adoption gate surface can approve.");
  assert.equal(safety.surface_can_confirm_adoption, false, "Adoption gate surface can confirm adoption.");
  assert.equal(safety.surface_can_activate_engine, false, "Adoption gate surface can activate engine.");
  assert.equal(safety.ui_can_approve, false, "Adoption gate UI can approve.");
  assert.equal(safety.ui_can_confirm_adoption, false, "Adoption gate UI can confirm adoption.");
  assert.equal(safety.ui_can_activate_engine, false, "Adoption gate UI can activate engine.");
  assert.equal(safety.pending_engine_candidate_created, false, "Adoption gate surface created a pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "Adoption gate surface modified active_engine.");
  assert.equal(safety.canon_modified, false, "Adoption gate surface modified Canon DB.");
  assert.equal(safety.compressed_rules_modified, false, "Adoption gate surface modified compressed_rules.");
  assert.equal(safety.automatic_adoption_performed, false, "Adoption gate surface performed automatic adoption.");
  assert.equal(safety.manual_review_entry_only, true, "Adoption gate surface is not limited to manual review entry.");
}

function assertAdoptionGateSurface(surface) {
  assert.equal(surface.phase, "27U", "Adoption gate surface phase mismatch.");
  assert.equal(
    surface.version,
    "foreshadowing_settlement_operator_adoption_gate_surface_v1",
    "Adoption gate surface version mismatch.",
  );
  assert.equal(
    surface.surface_kind,
    "foreshadowing_settlement_operator_adoption_gate_ui_bridge_surface",
    "Adoption gate surface kind mismatch.",
  );
  assert.equal(surface.source_phase, "27T", "Adoption gate surface source phase mismatch.");
  assert(Array.isArray(surface.source_phases), "Adoption gate surface source phases must be an array.");
  assert(surface.source_phases.includes("27T"), "Adoption gate surface source phases missing 27T.");
  assert.equal(surface.gate_phase, "27T", "Adoption gate surface gate phase mismatch.");
  assert.equal(typeof surface.gate_status, "string", "Adoption gate surface gate status must be readable.");
  assert.equal(typeof surface.gate_decision, "string", "Adoption gate surface gate decision must be readable.");
  assert(["ready_for_manual_review_entry", "blocked"].includes(surface.bridge_surface_status), "Adoption gate bridge surface status mismatch.");
  assert(["ready_for_manual_review_entry", "blocked"].includes(surface.decision), "Adoption gate surface decision mismatch.");
  assert.equal(typeof surface.status_badge, "object", "Adoption gate surface status badge must be an object.");
  assert.equal(surface.can_auto_adopt, false, "Adoption gate surface can auto-adopt.");
  assert.equal(surface.direct_adoption_allowed, false, "Adoption gate surface allows direct adoption.");
  assert.equal(surface.automatic_settlement_allowed, false, "Adoption gate surface allows automatic settlement.");
  assert.equal(surface.requires_human_approval, true, "Adoption gate surface does not require human approval.");
  assert.equal(surface.requires_operator_confirmation, true, "Adoption gate surface does not require operator confirmation.");
  assert.equal(surface.manual_review_only, true, "Adoption gate surface is not manual-review-only.");
  assert(Array.isArray(surface.cards), "Adoption gate surface cards must be an array.");
  assert(surface.cards.length >= 4, "Adoption gate surface should expose at least four cards.");
  assert(Array.isArray(surface.blocking_reasons), "Adoption gate surface blocking reasons must be an array.");
  assert(Array.isArray(surface.safety_badges), "Adoption gate surface safety badges must be an array.");
  assert(surface.safety_badges.length >= 8, "Adoption gate surface should expose safety badges.");
  assert(Array.isArray(surface.next_operator_actions), "Adoption gate surface next_operator_actions must be an array.");
  assert.equal(typeof surface.bridge_readability, "object", "Adoption gate surface bridge readability must be an object.");
  assert.equal(surface.bridge_readability.gate_result_readable, true, "Gate result is not bridge-readable.");
  assert.equal(surface.bridge_readability.decision_readable, true, "Gate decision is not bridge-readable.");
  assert.equal(surface.bridge_readability.blocking_reasons_readable, true, "Blocking reasons are not bridge-readable.");
  assert.equal(surface.bridge_readability.next_operator_actions_readable, true, "Next operator actions are not bridge-readable.");
  assert.equal(surface.bridge_readability.safety_badges_readable, true, "Safety badges are not bridge-readable.");
  assert.equal(typeof surface.integrity, "object", "Adoption gate surface integrity must be an object.");
  assert.equal(surface.integrity.gate_phase, "27T", "Adoption gate surface integrity gate phase mismatch.");
  assert.equal(surface.integrity.no_mutation_side_effects, true, "Adoption gate surface integrity reports mutation side effects.");
  assert.equal(typeof surface.surface_markdown, "string", "Adoption gate surface markdown must be a string.");
  assert.match(
    surface.surface_markdown,
    /Foreshadowing Settlement Operator Adoption Gate Surface/u,
    "Adoption gate surface markdown missing heading.",
  );
  assert(surface.raw_gate && typeof surface.raw_gate === "object", "Adoption gate surface raw gate JSON is missing.");
  assert.equal(surface.raw_gate.phase, "27T", "Adoption gate surface raw gate phase mismatch.");
  assertSafetyLocked(surface.safety);
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
    indexText.includes('id="foreshadowing-settlement-operator-adoption-gate-surface"'),
    "UI index is missing adoption gate surface root.",
  );
  assert(
    indexText.includes("Foreshadowing Settlement Adoption Gate"),
    "UI index is missing adoption gate surface heading.",
  );
  assert(
    indexText.includes("READ-ONLY ADOPTION GATE"),
    "UI index is missing adoption gate read-only eyebrow.",
  );
  assert(
    indexText.includes("Raw foreshadowing settlement adoption readiness gate"),
    "UI index is missing adoption gate raw JSON details.",
  );
  assert(indexText.includes("does not approve"), "UI index is missing adoption gate no-approval safety copy.");
  assert(indexText.includes("modify active_engine"), "UI index is missing adoption gate active_engine safety copy.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assert(
    appText.includes("renderForeshadowingSettlementOperatorAdoptionGateSurface"),
    "UI app.js is missing adoption gate surface renderer.",
  );
  assert(
    appText.includes("/api/writer-workbench/foreshadowing-settlement-operator-adoption-gate-surface"),
    "UI app.js is missing adoption gate surface API fetch.",
  );
  assert(
    appText.includes("state.foreshadowingSettlementOperatorAdoptionGateSurface"),
    "UI app.js is missing adoption gate surface state wiring.",
  );
  assert(
    appText.includes("bridge_can_confirm_adoption"),
    "UI app.js is missing adoption gate bridge confirmation safety rendering.",
  );
  assert(
    appText.includes("active_engine_modified"),
    "UI app.js is missing adoption gate active_engine safety rendering.",
  );

  const surfaceResult = await readJson(await fetch(
    `${baseUrl}/api/writer-workbench/foreshadowing-settlement-operator-adoption-gate-surface`,
  ));
  assert(surfaceResult.response.ok, "Adoption gate surface API did not return 200.");
  assert.equal(surfaceResult.payload.ok, true, "Adoption gate surface API missing ok=true.");
  assert.equal(
    surfaceResult.payload.operator_readiness_dashboard?.phase,
    "27R",
    "Live adoption gate payload missing 27R readiness dashboard.",
  );
  assert.equal(
    surfaceResult.payload.operator_adoption_readiness_gate?.phase,
    "27T",
    "Live adoption gate payload missing 27T adoption readiness gate.",
  );
  assertAdoptionGateSurface(surfaceResult.payload.operator_adoption_gate_surface);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "active_engine changed after adoption gate live UI smoke.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "compressed_rules changed after adoption gate live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "Pending engine candidates changed after adoption gate live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(workflowSettlementContextsDir), workflowSettlementContextsBefore, "Settlement contexts changed after adoption gate live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(workflowSettlementReportsDir), workflowSettlementReportsBefore, "Settlement reports changed after adoption gate live UI smoke.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "Approval queue items changed after adoption gate live UI smoke.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "Approval log changed after adoption gate live UI smoke.");
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

console.log("Phase27V foreshadowing settlement operator adoption gate live UI smoke tests passed.");
