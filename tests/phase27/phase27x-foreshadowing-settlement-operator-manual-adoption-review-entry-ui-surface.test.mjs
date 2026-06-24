import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface,
  foreshadowingSettlementOperatorManualAdoptionReviewEntryUiSurfaceVersion,
} from "../../server/src/foreshadowing-settlement-operator-manual-adoption-review-entry-ui-surface-service.mjs";
import { terminateProcessTree } from "../../server/src/process-control.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const serverPath = path.join(rootDir, "server", "src", "ui-server.mjs");
const activeEnginePath = path.join(rootDir, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(rootDir, "data", "error_report_db", "compressed_rules.md");
const pendingCandidatesDir = path.join(rootDir, "data", "canon_db", "pending_engine_candidates");

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

function assertSafetyLocked(safety) {
  assert.equal(safety.read_only, true, "27X surface is not read-only.");
  assert.equal(safety.preview_only, true, "27X surface is not preview-only.");
  assert.equal(safety.no_auto_persist, true, "27X surface can auto-persist.");
  assert.equal(safety.no_canon_update, true, "27X surface can update Canon.");
  assert.equal(safety.no_active_engine_update, true, "27X surface can update active_engine.");
  assert.equal(safety.bridge_can_approve, false, "27X surface allows bridge approval.");
  assert.equal(safety.bridge_can_confirm_adoption, false, "27X surface allows bridge adoption confirmation.");
  assert.equal(safety.bridge_can_activate_engine, false, "27X surface allows bridge engine activation.");
  assert.equal(safety.ui_can_approve, false, "27X UI can approve.");
  assert.equal(safety.ui_can_confirm_adoption, false, "27X UI can confirm adoption.");
  assert.equal(safety.ui_can_activate_engine, false, "27X UI can activate engine.");
  assert.equal(safety.surface_can_approve, false, "27X surface can approve.");
  assert.equal(safety.surface_can_confirm_adoption, false, "27X surface can confirm adoption.");
  assert.equal(safety.surface_can_activate_engine, false, "27X surface can activate engine.");
  assert.equal(safety.pending_engine_candidate_created, false, "27X surface created pending engine candidate.");
  assert.equal(safety.active_engine_modified, false, "27X surface modified active_engine.");
  assert.equal(safety.canon_modified, false, "27X surface modified Canon.");
  assert.equal(safety.compressed_rules_modified, false, "27X surface modified compressed_rules.");
  assert.equal(safety.automatic_adoption_performed, false, "27X surface performed automatic adoption.");
  assert.equal(safety.manual_review_entry_only, true, "27X surface is not manual-review-entry-only.");
}

function assertSurface(surface) {
  assert.equal(surface.phase, "27X", "27X surface phase mismatch.");
  assert.equal(surface.version, foreshadowingSettlementOperatorManualAdoptionReviewEntryUiSurfaceVersion, "27X surface version mismatch.");
  assert.equal(surface.surface_kind, "foreshadowing_settlement_operator_manual_adoption_review_entry_ui_surface", "27X surface kind mismatch.");
  assert.equal(surface.source_phase, "27W", "27X source phase mismatch.");
  assert.equal(surface.packet_phase, "27W", "27X packet phase mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.surface_status), "27X surface status mismatch.");
  assert(["ready_for_operator_manual_review_entry", "blocked"].includes(surface.decision), "27X decision mismatch.");
  assert.equal(surface.can_approve, false, "27X surface can approve.");
  assert.equal(surface.can_confirm_adoption, false, "27X surface can confirm adoption.");
  assert.equal(surface.can_activate_engine, false, "27X surface can activate engine.");
  assert.equal(surface.can_auto_adopt, false, "27X surface can auto-adopt.");
  assert.equal(surface.direct_adoption_allowed, false, "27X surface allows direct adoption.");
  assert.equal(surface.automatic_settlement_allowed, false, "27X surface allows automatic settlement.");
  assert.equal(surface.requires_human_approval, true, "27X surface must require human approval.");
  assert.equal(surface.requires_operator_confirmation, true, "27X surface must require operator confirmation.");
  assert.equal(surface.manual_review_only, true, "27X surface must be manual-review-only.");
  assert(Array.isArray(surface.cards), "27X cards must be an array.");
  assert(surface.cards.length >= 6, "27X surface should expose summary cards.");
  assert(Array.isArray(surface.required_evidence), "27X required evidence must be an array.");
  assert(surface.required_evidence.length >= 8, "27X required evidence should include Phase 27W evidence.");
  assert(Array.isArray(surface.blocking_reason_cards), "27X blocker cards must be an array.");
  assert(Array.isArray(surface.manual_review_steps), "27X manual review steps must be an array.");
  assert(Array.isArray(surface.prohibited_actions), "27X prohibited actions must be an array.");
  assert(surface.prohibited_actions.length >= 6, "27X prohibited actions should be visible.");
  assert.equal(surface.prohibited_actions.every((item) => item.allowed === false), true, "27X prohibited actions must be locked.");
  assert(Array.isArray(surface.safety_badges), "27X safety badges must be an array.");
  assert(surface.safety_badges.length >= 8, "27X safety badges should be visible.");
  assert.equal(surface.bridge_readability.surface_readable, true, "27X surface is not bridge-readable.");
  assert.equal(surface.bridge_readability.required_evidence_readable, true, "27X evidence is not bridge-readable.");
  assert.equal(surface.bridge_readability.prohibited_actions_readable, true, "27X prohibited actions are not bridge-readable.");
  assert.equal(surface.integrity.packet_loaded, true, "27X did not load 27W packet.");
  assert.equal(surface.integrity.no_mutation_side_effects, true, "27X reports mutation side effects.");
  assert(surface.raw_packet?.phase === "27W", "27X raw packet missing.");
  assert.match(surface.surface_markdown, /Manual Adoption Review Entry UI Surface/u, "27X markdown heading missing.");
  assertSafetyLocked(surface.safety);
}

const syntheticSurface = buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface({
  operator_manual_adoption_review_entry_packet: {
    ok: false,
    phase: "27W",
    packet_status: "blocked",
    decision: "blocked",
    can_enter_manual_adoption_review: false,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    manual_review_only: true,
    blocking_reasons: ["synthetic_blocker"],
    required_evidence: [
      { key: "phase27u_adoption_gate_surface", label: "Phase 27U adoption gate surface", present: true, source_phase: "27U" },
      { key: "phase27t_gate_result", label: "Phase 27T gate result", present: true, source_phase: "27T" },
      { key: "gate_decision", label: "Gate decision", present: true, source_phase: "27U" },
      { key: "bridge_readability", label: "Bridge readability", present: true, source_phase: "27U" },
      { key: "blocking_reasons", label: "Blocking reasons", present: true, source_phase: "27U" },
      { key: "next_operator_actions", label: "Next operator actions", present: true, source_phase: "27U" },
      { key: "safety_boundary", label: "Safety boundary", present: true, source_phase: "27U" },
      { key: "raw_gate_json", label: "Raw gate JSON", present: true, source_phase: "27T" },
    ],
    manual_review_steps: [{ key: "repair_manual_review_entry_packet", label: "Repair manual review entry packet", reason: "synthetic_blocker", route: "#writer-workbench", ui_target: "writer-workbench", priority: "primary" }],
    prohibited_actions: [
      { key: "approve_from_packet", label: "Approve from packet", allowed: false, reason: "forbidden" },
      { key: "confirm_adoption_from_packet", label: "Confirm adoption from packet", allowed: false, reason: "forbidden" },
      { key: "activate_engine_from_packet", label: "Activate engine from packet", allowed: false, reason: "forbidden" },
      { key: "write_canon_from_packet", label: "Write Canon from packet", allowed: false, reason: "forbidden" },
      { key: "create_pending_engine_candidate_from_packet", label: "Create pending engine candidate", allowed: false, reason: "forbidden" },
      { key: "auto_settle_from_packet", label: "Auto-settle", allowed: false, reason: "forbidden" },
    ],
    safety_badges: [
      { key: "read_only", label: "Read-only", value: true },
      { key: "preview_only", label: "Preview-only", value: true },
      { key: "no_approval", label: "No approval", value: true },
      { key: "no_confirm_adoption", label: "No adoption confirmation", value: true },
      { key: "no_activate_engine", label: "No engine activation", value: true },
      { key: "no_canon_update", label: "No Canon update", value: true },
      { key: "no_active_engine_update", label: "No active_engine update", value: true },
      { key: "no_pending_engine_candidate", label: "No pending engine candidate", value: true },
    ],
    safety: {
      read_only: true,
      preview_only: true,
      no_auto_persist: true,
      no_canon_update: true,
      no_active_engine_update: true,
      bridge_can_approve: false,
      bridge_can_confirm_adoption: false,
      bridge_can_activate_engine: false,
      packet_can_approve: false,
      packet_can_confirm_adoption: false,
      packet_can_activate_engine: false,
      ui_can_approve: false,
      ui_can_confirm_adoption: false,
      ui_can_activate_engine: false,
      pending_engine_candidate_created: false,
      active_engine_modified: false,
      canon_modified: false,
      compressed_rules_modified: false,
      automatic_adoption_performed: false,
      manual_review_entry_only: true,
    },
  },
  include_raw: true,
  include_markdown: true,
});
assertSurface(syntheticSurface);
assert.equal(syntheticSurface.ok, false, "Synthetic blocked 27X surface should not be ok.");
assert(syntheticSurface.blocking_reasons.includes("synthetic_blocker"), "Synthetic 27X surface missing blocker.");

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);

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
  assert(indexText.includes('id="foreshadowing-settlement-operator-manual-adoption-review-entry-surface"'), "UI index missing 27X root.");
  assert(indexText.includes("READ-ONLY MANUAL REVIEW ENTRY"), "UI index missing 27X read-only eyebrow.");
  assert(indexText.includes("Required evidence"), "UI index missing 27X required evidence section.");
  assert(indexText.includes("Prohibited actions"), "UI index missing 27X prohibited actions section.");
  assert(indexText.includes("Raw foreshadowing settlement manual adoption review entry packet"), "UI index missing 27X raw packet details.");

  const appResponse = await fetch(`${baseUrl}/app.js`);
  const appText = await appResponse.text();
  assert(appResponse.ok, "UI app.js did not return 200.");
  assert(appText.includes("renderForeshadowingSettlementOperatorManualAdoptionReviewEntrySurface"), "UI app.js missing 27X renderer.");
  assert(appText.includes("/api/writer-workbench/foreshadowing-settlement-operator-manual-adoption-review-entry-surface"), "UI app.js missing 27X API fetch.");
  assert(appText.includes("state.foreshadowingSettlementOperatorManualAdoptionReviewEntrySurface"), "UI app.js missing 27X state wiring.");
  assert(appText.includes("prohibited_actions"), "UI app.js missing 27X prohibited actions rendering.");
  assert(appText.includes("active_engine_modified"), "UI app.js missing 27X active_engine safety rendering.");

  const apiResponse = await fetch(`${baseUrl}/api/writer-workbench/foreshadowing-settlement-operator-manual-adoption-review-entry-surface`);
  const payload = await apiResponse.json();
  assert(apiResponse.ok, "27X API did not return 200.");
  assert.equal(payload.ok, true, "27X API wrapper missing ok=true.");
  assert.equal(payload.operator_manual_adoption_review_entry_packet?.phase, "27W", "27X API missing 27W packet.");
  assertSurface(payload.operator_manual_adoption_review_entry_surface);

  assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "27X changed active_engine.");
  assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "27X changed compressed_rules.");
  assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "27X changed pending engine candidates.");
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

console.log("Phase27X foreshadowing settlement operator manual adoption review entry UI surface tests passed.");
