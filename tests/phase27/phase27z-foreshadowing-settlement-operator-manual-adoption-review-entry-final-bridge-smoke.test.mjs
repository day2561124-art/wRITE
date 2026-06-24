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

const manualReviewEntryEndpoint = "/api/writer-workbench/foreshadowing-settlement-operator-manual-adoption-review-entry-surface";

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

function assertPacketSafetyLocked(safety) {
  assert.equal(safety.read_only, true, "27Z packet is not read-only.");
  assert.equal(safety.preview_only, true, "27Z packet is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "27Z packet can auto-persist.");
  assert.equal(safety.no_canon_update, true, "27Z packet can update Canon.");
  assert.equal(safety.no_active_engine_update, true, "27Z packet can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "27Z packet allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "27Z packet allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "27Z packet allows bridge engine activation.");
  assert.equal(safety.packet_can_approve, false, "27Z packet can approve.");
  assert.equal(safety.packet_can_confirm_adoption, false, "27Z packet can confirm adoption.");
  assert.equal(safety.packet_can_activate_engine, false, "27Z packet can activate engine.");
  assert.equal(safety.pending_engine_candidate_created, false, "27Z packet created a pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "27Z packet modified active_engine.");
  assert.equal(safety.canon_modified, false, "27Z packet modified Canon.");
  assert.equal(safety.compressed_rules_modified, false, "27Z packet modified compressed_rules.");
  assert.equal(safety.automatic_adoption_performed, false, "27Z packet performed automatic adoption.");
  assert.equal(safety.manual_review_entry_only, true, "27Z packet is not manual-review-entry-only.");
}

function assertSurfaceSafetyLocked(safety) {
  assert.equal(safety.read_only, true, "27Z surface is not read-only.");
  assert.equal(safety.preview_only, true, "27Z surface is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "27Z surface can auto-persist.");
  assert.equal(safety.no_canon_update, true, "27Z surface can update Canon.");
  assert.equal(safety.no_active_engine_update, true, "27Z surface can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "27Z surface allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "27Z surface allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "27Z surface allows bridge engine activation.");
  assert.equal(safety.ui_can_approve, false, "27Z UI can approve.");
  assert.equal(safety.ui_can_confirm_adoption, false, "27Z UI can confirm adoption.");
  assert.equal(safety.ui_can_activate_engine, false, "27Z UI can activate engine.");
  assert.equal(safety.surface_can_approve, false, "27Z surface can approve.");
  assert.equal(safety.surface_can_confirm_adoption, false, "27Z surface can confirm adoption.");
  assert.equal(safety.surface_can_activate_engine, false, "27Z surface can activate engine.");
  assert.equal(safety.pending_engine_candidate_created, false, "27Z surface created a pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "27Z surface modified active_engine.");
  assert.equal(safety.canon_modified, false, "27Z surface modified Canon.");
  assert.equal(safety.compressed_rules_modified, false, "27Z surface modified compressed_rules.");
  assert.equal(safety.automatic_adoption_performed, false, "27Z surface performed automatic adoption.");
  assert.equal(safety.manual_review_entry_only, true, "27Z surface is not manual-review-entry-only.");
}

function assertManualReviewEntryPacket(packet) {
  assert.equal(packet.phase, "27W", "27Z did not expose Phase 27W packet.");
  assert.equal(packet.version, "foreshadowing_settlement_operator_manual_adoption_review_entry_packet_v1", "27Z packet version mismatch.");
  assert.equal(packet.packet_kind, "foreshadowing_settlement_operator_manual_adoption_review_entry_packet", "27Z packet kind mismatch.");
  assert.equal(packet.source_phase, "27U", "27Z packet source phase mismatch.");
  assert.deepEqual(packet.source_phases, ["27T", "27U", "27V"], "27Z packet source phases mismatch.");
  assert.equal(packet.surface_phase, "27U", "27Z packet did not bind Phase 27U surface.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(packet.packet_status), "27Z packet status mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(packet.decision), "27Z packet decision mismatch.");

  assert.equal(packet.can_approve, false, "27Z packet can approve.");
  assert.equal(packet.can_confirm_adoption, false, "27Z packet can confirm adoption.");
  assert.equal(packet.can_activate_engine, false, "27Z packet can activate engine.");
  assert.equal(packet.can_auto_adopt, false, "27Z packet can auto-adopt.");
  assert.equal(packet.direct_adoption_allowed, false, "27Z packet allows direct adoption.");
  assert.equal(packet.automatic_settlement_allowed, false, "27Z packet allows automatic settlement.");
  assert.equal(packet.requires_human_approval, true, "27Z packet must require human approval.");
  assert.equal(packet.requires_operator_confirmation, true, "27Z packet must require operator confirmation.");
  assert.equal(packet.manual_review_only, true, "27Z packet must be manual-review-only.");

  assert(Array.isArray(packet.required_evidence), "27Z packet required evidence must be an array.");
  assert(packet.required_evidence.length >= 8, "27Z packet should expose all required evidence rows.");
  assert(packet.required_evidence.some((item) => item.key === "phase27u_adoption_gate_surface"), "27Z packet missing 27U surface evidence.");
  assert(packet.required_evidence.some((item) => item.key === "phase27t_gate_result"), "27Z packet missing 27T gate evidence.");
  assert(packet.required_evidence.some((item) => item.key === "raw_gate_json"), "27Z packet missing raw gate JSON evidence.");

  assert(Array.isArray(packet.blocking_reasons), "27Z packet blocking reasons must be readable.");
  assert(Array.isArray(packet.manual_review_steps), "27Z packet manual review steps must be readable.");
  assert(Array.isArray(packet.prohibited_actions), "27Z packet prohibited actions must be readable.");
  assert(packet.prohibited_actions.length >= 6, "27Z packet should expose prohibited actions.");
  assert.equal(packet.prohibited_actions.every((item) => item.allowed === false), true, "27Z packet prohibited actions must stay locked.");
  assert(Array.isArray(packet.safety_badges), "27Z packet safety badges must be readable.");
  assert(packet.safety_badges.length >= 8, "27Z packet should expose safety badges.");

  assert.equal(packet.bridge_readability.packet_readable, true, "27Z packet is not bridge-readable.");
  assert.equal(packet.bridge_readability.decision_readable, true, "27Z packet decision is not bridge-readable.");
  assert.equal(packet.bridge_readability.required_evidence_readable, true, "27Z packet evidence is not bridge-readable.");
  assert.equal(packet.bridge_readability.blocking_reasons_readable, true, "27Z packet blockers are not bridge-readable.");
  assert.equal(packet.bridge_readability.manual_review_steps_readable, true, "27Z packet steps are not bridge-readable.");
  assert.equal(packet.bridge_readability.prohibited_actions_readable, true, "27Z packet prohibited actions are not bridge-readable.");
  assert.equal(packet.bridge_readability.safety_badges_readable, true, "27Z packet safety badges are not bridge-readable.");

  assert.equal(packet.integrity.source_surface_loaded, true, "27Z packet did not load the 27U source surface.");
  assert.equal(packet.integrity.source_safety_locked, true, "27Z packet source safety is not locked.");
  assert.equal(packet.integrity.no_mutation_side_effects, true, "27Z packet reports mutation side effects.");
  assert.equal(packet.integrity.prohibited_actions_locked, true, "27Z packet prohibited actions are not locked.");

  assert(packet.raw_surface?.phase === "27U", "27Z packet raw 27U surface missing.");
  assert(packet.raw_surface?.raw_gate?.phase === "27T", "27Z packet raw 27T gate missing.");
  assert.match(packet.packet_markdown, /Foreshadowing Settlement Operator Manual Adoption Review Entry Packet/u, "27Z packet markdown heading missing.");
  assertPacketSafetyLocked(packet.safety);
}

function assertManualReviewEntrySurface(surface) {
  assert.equal(surface.phase, "27X", "27Z did not expose Phase 27X surface.");
  assert.equal(surface.version, "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface_v1", "27Z surface version mismatch.");
  assert.equal(surface.surface_kind, "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface", "27Z surface kind mismatch.");
  assert.equal(surface.source_phase, "27W", "27Z surface source phase mismatch.");
  assert(surface.source_phases.includes("27T"), "27Z surface missing 27T lineage.");
  assert(surface.source_phases.includes("27U"), "27Z surface missing 27U lineage.");
  assert(surface.source_phases.includes("27W"), "27Z surface missing 27W lineage.");
  assert.equal(surface.packet_phase, "27W", "27Z surface packet phase mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.surface_status), "27Z surface status mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.decision), "27Z surface decision mismatch.");

  assert.equal(surface.can_approve, false, "27Z surface can approve.");
  assert.equal(surface.can_confirm_adoption, false, "27Z surface can confirm adoption.");
  assert.equal(surface.can_activate_engine, false, "27Z surface can activate engine.");
  assert.equal(surface.can_auto_adopt, false, "27Z surface can auto-adopt.");
  assert.equal(surface.direct_adoption_allowed, false, "27Z surface allows direct adoption.");
  assert.equal(surface.automatic_settlement_allowed, false, "27Z surface allows automatic settlement.");
  assert.equal(surface.requires_human_approval, true, "27Z surface must require human approval.");
  assert.equal(surface.requires_operator_confirmation, true, "27Z surface must require operator confirmation.");
  assert.equal(surface.manual_review_only, true, "27Z surface must be manual-review-only.");

  assert(Array.isArray(surface.cards), "27Z surface cards must be an array.");
  assert(surface.cards.length >= 6, "27Z surface should expose summary cards.");
  assert(Array.isArray(surface.required_evidence), "27Z surface evidence must be an array.");
  assert(Array.isArray(surface.blocking_reason_cards), "27Z surface blocker cards must be an array.");
  assert(Array.isArray(surface.manual_review_steps), "27Z surface manual review steps must be an array.");
  assert(Array.isArray(surface.prohibited_actions), "27Z surface prohibited actions must be an array.");
  assert.equal(surface.prohibited_actions.every((item) => item.allowed === false), true, "27Z surface prohibited actions must stay locked.");
  assert(Array.isArray(surface.safety_badges), "27Z surface safety badges must be an array.");

  assert.equal(surface.bridge_readability.surface_readable, true, "27Z surface is not bridge-readable.");
  assert.equal(surface.bridge_readability.packet_status_readable, true, "27Z surface packet status is not bridge-readable.");
  assert.equal(surface.bridge_readability.required_evidence_readable, true, "27Z surface evidence is not bridge-readable.");
  assert.equal(surface.bridge_readability.blocking_reasons_readable, true, "27Z surface blockers are not bridge-readable.");
  assert.equal(surface.bridge_readability.manual_review_steps_readable, true, "27Z surface steps are not bridge-readable.");
  assert.equal(surface.bridge_readability.prohibited_actions_readable, true, "27Z surface prohibited actions are not bridge-readable.");
  assert.equal(surface.bridge_readability.safety_badges_readable, true, "27Z surface safety badges are not bridge-readable.");
  assert.equal(surface.bridge_readability.raw_packet_json_available, true, "27Z surface raw packet JSON is not bridge-readable.");

  assert.equal(surface.integrity.packet_loaded, true, "27Z surface did not load the 27W packet.");
  assert.equal(surface.integrity.prohibited_actions_locked, true, "27Z surface prohibited actions are not locked.");
  assert.equal(surface.integrity.safety_locked, true, "27Z surface safety is not locked.");
  assert.equal(surface.integrity.no_mutation_side_effects, true, "27Z surface reports mutation side effects.");

  assert(surface.raw_packet?.phase === "27W", "27Z surface raw 27W packet missing.");
  assert(surface.raw_packet?.raw_surface?.phase === "27U", "27Z surface raw 27U surface missing.");
  assert(surface.raw_packet?.raw_surface?.raw_gate?.phase === "27T", "27Z surface raw 27T gate missing.");
  assert.match(surface.surface_markdown, /Foreshadowing Settlement Operator Manual Adoption Review Entry UI Surface/u, "27Z surface markdown heading missing.");
  assertSurfaceSafetyLocked(surface.safety);
}

function assertBridgePayload(payload, contentType) {
  assert.equal(payload.ok, true, "27Z bridge endpoint wrapper missing ok=true.");
  assert.match(contentType, /application\/json/u, "27Z bridge endpoint must return JSON.");

  assert.equal(payload.operator_readiness_dashboard?.phase, "27R", "27Z bridge payload missing Phase 27R readiness dashboard.");
  assert.equal(payload.operator_adoption_readiness_gate?.phase, "27T", "27Z bridge payload missing Phase 27T adoption readiness gate.");
  assert.equal(payload.operator_adoption_gate_surface?.phase, "27U", "27Z bridge payload missing Phase 27U adoption gate surface.");

  assertManualReviewEntryPacket(payload.operator_manual_adoption_review_entry_packet);
  assertManualReviewEntrySurface(payload.operator_manual_adoption_review_entry_surface);

  assert.deepEqual(
    payload.operator_manual_adoption_review_entry_surface.raw_packet,
    payload.operator_manual_adoption_review_entry_packet,
    "27Z bridge payload should expose the same packet data through the surface raw packet.",
  );
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

  const apiResponse = await fetch(`${baseUrl}${manualReviewEntryEndpoint}`, {
    headers: { accept: "application/json" },
  });
  const contentType = apiResponse.headers.get("content-type") ?? "";
  const payload = await apiResponse.json();

  assert(apiResponse.ok, "27Z bridge endpoint did not return 200.");
  assertBridgePayload(payload, contentType);

  const repeatedResponse = await fetch(`${baseUrl}${manualReviewEntryEndpoint}`);
  const repeatedPayload = await repeatedResponse.json();
  assert(repeatedResponse.ok, "27Z repeated bridge endpoint read did not return 200.");
  assert.equal(repeatedPayload.ok, true, "27Z repeated bridge payload missing ok=true.");
  assert.equal(repeatedPayload.operator_manual_adoption_review_entry_packet?.phase, "27W", "27Z repeated bridge read lost 27W packet.");
  assert.equal(repeatedPayload.operator_manual_adoption_review_entry_surface?.phase, "27X", "27Z repeated bridge read lost 27X surface.");

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "27Z changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "27Z changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "27Z changed pending engine candidates.");
  assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "27Z changed settlement contexts.");
  assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "27Z changed settlement reports.");
  assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "27Z changed approval items.");
  assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "27Z changed approval log.");
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

console.log("Phase27Z foreshadowing settlement operator manual adoption review entry final bridge smoke tests passed.");
