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

function assertSafetyLocked(safety) {
  assert.equal(safety.read_only, true, "27Y surface is not read-only.");
  assert.equal(safety.preview_only, true, "27Y surface is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "27Y surface can auto-persist.");
  assert.equal(safety.no_canon_update, true, "27Y surface can update Canon.");
  assert.equal(safety.no_active_engine_update, true, "27Y surface can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "27Y surface allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "27Y surface allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "27Y surface allows bridge engine activation.");
  assert.equal(safety.ui_can_approve, false, "27Y UI can approve.");
  assert.equal(safety.ui_can_confirm_adoption, false, "27Y UI can confirm adoption.");
  assert.equal(safety.ui_can_activate_engine, false, "27Y UI can activate engine.");
  assert.equal(safety.surface_can_approve, false, "27Y surface can approve.");
  assert.equal(safety.surface_can_confirm_adoption, false, "27Y surface can confirm adoption.");
  assert.equal(safety.surface_can_activate_engine, false, "27Y surface can activate engine.");
  assert.equal(safety.pending_engine_candidate_created, false, "27Y surface created pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "27Y surface modified active_engine.");
  assert.equal(safety.canon_modified, false, "27Y surface modified Canon.");
  assert.equal(safety.compressed_rules_modified, false, "27Y surface modified compressed_rules.");
  assert.equal(safety.automatic_adoption_performed, false, "27Y surface performed automatic adoption.");
  assert.equal(safety.manual_review_entry_only, true, "27Y surface is not manual-review-entry-only.");
}

function assertManualReviewEntrySurface(surface) {
  assert.equal(surface.phase, "27X", "Live 27Y payload did not expose 27X surface.");
  assert.equal(
    surface.version,
    "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface_v1",
    "Live 27Y payload has unexpected 27X surface version.",
  );
  assert.equal(
    surface.surface_kind,
    "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface",
    "Live 27Y payload has unexpected 27X surface kind.",
  );
  assert.equal(surface.source_phase, "27W", "Live 27Y surface source phase mismatch.");
  assert.equal(surface.packet_phase, "27W", "Live 27Y surface packet phase mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.surface_status), "Live 27Y surface status mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.decision), "Live 27Y decision mismatch.");

  assert.equal(surface.can_approve, false, "Live 27Y surface can approve.");
  assert.equal(surface.can_confirm_adoption, false, "Live 27Y surface can confirm adoption.");
  assert.equal(surface.can_activate_engine, false, "Live 27Y surface can activate engine.");
  assert.equal(surface.can_auto_adopt, false, "Live 27Y surface can auto-adopt.");
  assert.equal(surface.direct_adoption_allowed, false, "Live 27Y surface allows direct adoption.");
  assert.equal(surface.automatic_settlement_allowed, false, "Live 27Y surface allows automatic settlement.");
  assert.equal(surface.requires_human_approval, true, "Live 27Y surface must require human approval.");
  assert.equal(surface.requires_operator_confirmation, true, "Live 27Y surface must require operator confirmation.");
  assert.equal(surface.manual_review_only, true, "Live 27Y surface must be manual-review-only.");

  assert(Array.isArray(surface.cards), "Live 27Y cards must be an array.");
  assert(surface.cards.length >= 6, "Live 27Y surface should expose summary cards.");

  assert(Array.isArray(surface.required_evidence), "Live 27Y required evidence must be an array.");
  assert(surface.required_evidence.length >= 8, "Live 27Y required evidence should include packet evidence.");
  assert(surface.required_evidence.some((item) => item.key === "phase27u_adoption_gate_surface"), "Live 27Y missing Phase 27U evidence.");
  assert(surface.required_evidence.some((item) => item.key === "phase27t_gate_result"), "Live 27Y missing Phase 27T gate evidence.");
  assert(surface.required_evidence.some((item) => item.key === "raw_gate_json"), "Live 27Y missing raw gate evidence.");

  assert(Array.isArray(surface.blocking_reason_cards), "Live 27Y blocker cards must be an array.");
  assert(Array.isArray(surface.manual_review_steps), "Live 27Y manual review steps must be an array.");
  assert(Array.isArray(surface.prohibited_actions), "Live 27Y prohibited actions must be an array.");
  assert(surface.prohibited_actions.length >= 6, "Live 27Y prohibited actions should be visible.");
  assert.equal(surface.prohibited_actions.every((item) => item.allowed === false), true, "Live 27Y prohibited actions must be locked.");
  assert(surface.prohibited_actions.some((item) => item.key === "approve_from_packet"), "Live 27Y missing approve prohibition.");
  assert(surface.prohibited_actions.some((item) => item.key === "confirm_adoption_from_packet"), "Live 27Y missing adoption confirmation prohibition.");
  assert(surface.prohibited_actions.some((item) => item.key === "activate_engine_from_packet"), "Live 27Y missing engine activation prohibition.");
  assert(surface.prohibited_actions.some((item) => item.key === "write_canon_from_packet"), "Live 27Y missing Canon write prohibition.");

  assert(Array.isArray(surface.safety_badges), "Live 27Y safety badges must be an array.");
  assert(surface.safety_badges.length >= 8, "Live 27Y safety badges should be visible.");

  assert.equal(surface.bridge_readability.surface_readable, true, "Live 27Y surface is not bridge-readable.");
  assert.equal(surface.bridge_readability.packet_status_readable, true, "Live 27Y packet status is not bridge-readable.");
  assert.equal(surface.bridge_readability.required_evidence_readable, true, "Live 27Y evidence is not bridge-readable.");
  assert.equal(surface.bridge_readability.blocking_reasons_readable, true, "Live 27Y blockers are not bridge-readable.");
  assert.equal(surface.bridge_readability.manual_review_steps_readable, true, "Live 27Y steps are not bridge-readable.");
  assert.equal(surface.bridge_readability.prohibited_actions_readable, true, "Live 27Y prohibited actions are not bridge-readable.");
  assert.equal(surface.bridge_readability.safety_badges_readable, true, "Live 27Y safety badges are not bridge-readable.");
  assert.equal(surface.bridge_readability.raw_packet_json_available, true, "Live 27Y raw packet is not bridge-readable.");

  assert.equal(surface.integrity.packet_loaded, true, "Live 27Y did not load Phase 27W packet.");
  assert.equal(surface.integrity.prohibited_actions_locked, true, "Live 27Y prohibited actions are not locked.");
  assert.equal(surface.integrity.safety_locked, true, "Live 27Y safety integrity is not locked.");
  assert.equal(surface.integrity.no_mutation_side_effects, true, "Live 27Y reports mutation side effects.");

  assert(surface.raw_packet?.phase === "27W", "Live 27Y raw packet missing.");
  assert.match(surface.surface_markdown, /Foreshadowing Settlement Operator Manual Adoption Review Entry UI Surface/u, "Live 27Y markdown heading missing.");
  assertSafetyLocked(surface.safety);
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
  assert(indexText.includes('id="foreshadowing-settlement-operator-manual-adoption-review-entry-surface"'), "UI index missing 27Y root panel.");
  assert(indexText.includes("READ-ONLY MANUAL REVIEW ENTRY"), "UI index missing 27Y read-only eyebrow.");
  assert(indexText.includes("Foreshadowing Settlement Manual Adoption Review Entry"), "UI index missing 27Y panel title.");
  assert(indexText.includes("Phase 27W packet status"), "UI index missing 27Y packet status description.");
  assert(indexText.includes("Required evidence"), "UI index missing 27Y required evidence section.");
  assert(indexText.includes("Blocking reasons"), "UI index missing 27Y blocking reasons section.");
  assert(indexText.includes("Manual review steps"), "UI index missing 27Y manual review steps section.");
  assert(indexText.includes("Prohibited actions"), "UI index missing 27Y prohibited actions section.");
  assert(indexText.includes("Safety badges"), "UI index missing 27Y safety badges section.");
  assert(indexText.includes("Raw foreshadowing settlement manual adoption review entry packet"), "UI index missing 27Y raw packet section.");
  assert(indexText.includes("does not approve"), "UI index missing 27Y no approval language.");
  assert(indexText.includes("modify active_engine"), "UI index missing 27Y active_engine safety language.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assert(appText.includes("foreshadowingSettlementOperatorManualAdoptionReviewEntrySurface"), "UI app.js missing 27Y state field.");
  assert(appText.includes("/api/writer-workbench/foreshadowing-settlement-operator-manual-adoption-review-entry-surface"), "UI app.js missing 27Y API fetch.");
  assert(appText.includes("operator_manual_adoption_review_entry_surface"), "UI app.js missing 27Y API payload assignment.");
  assert(appText.includes("renderForeshadowingSettlementOperatorManualAdoptionReviewEntrySurface"), "UI app.js missing 27Y renderer.");
  assert(appText.includes("required_evidence"), "UI app.js missing 27Y evidence rendering.");
  assert(appText.includes("blocking_reason_cards"), "UI app.js missing 27Y blocker rendering.");
  assert(appText.includes("manual_review_steps"), "UI app.js missing 27Y step rendering.");
  assert(appText.includes("prohibited_actions"), "UI app.js missing 27Y prohibited actions rendering.");
  assert(appText.includes("safety_badges"), "UI app.js missing 27Y safety badge rendering.");
  assert(appText.includes("raw_packet"), "UI app.js missing 27Y raw packet rendering.");
  assert(appText.includes("bridge_can_approve"), "UI app.js missing 27Y approval safety rendering.");
  assert(appText.includes("bridge_can_confirm_adoption"), "UI app.js missing 27Y confirmation safety rendering.");
  assert(appText.includes("bridge_can_activate_engine"), "UI app.js missing 27Y activation safety rendering.");
  assert(appText.includes("active_engine_modified"), "UI app.js missing 27Y active_engine safety rendering.");
  assert(appText.includes("canon_modified"), "UI app.js missing 27Y Canon safety rendering.");
  assert(appText.includes("compressed_rules_modified"), "UI app.js missing 27Y compressed_rules safety rendering.");

  const apiResponse = await fetch(`${baseUrl}/api/writer-workbench/foreshadowing-settlement-operator-manual-adoption-review-entry-surface`);
  const payload = await apiResponse.json();
  assert(apiResponse.ok, "27Y API did not return 200.");
  assert.equal(payload.ok, true, "27Y API wrapper missing ok=true.");
  assert.equal(payload.operator_readiness_dashboard?.phase, "27R", "27Y API missing Phase 27R readiness dashboard.");
  assert.equal(payload.operator_adoption_readiness_gate?.phase, "27T", "27Y API missing Phase 27T adoption readiness gate.");
  assert.equal(payload.operator_adoption_gate_surface?.phase, "27U", "27Y API missing Phase 27U adoption gate surface.");
  assert.equal(payload.operator_manual_adoption_review_entry_packet?.phase, "27W", "27Y API missing Phase 27W packet.");
  assertManualReviewEntrySurface(payload.operator_manual_adoption_review_entry_surface);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "27Y changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "27Y changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "27Y changed pending engine candidates.");
  assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "27Y changed settlement contexts.");
  assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "27Y changed settlement reports.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "27Y changed approval items.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "27Y changed approval log.");
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

console.log("Phase27Y foreshadowing settlement operator manual adoption review entry live UI smoke tests passed.");
