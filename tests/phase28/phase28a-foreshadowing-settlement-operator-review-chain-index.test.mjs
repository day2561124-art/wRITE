import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildForeshadowingSettlementOperatorReviewChainIndex,
  foreshadowingSettlementOperatorReviewChainIndexVersion,
} from "../../server/src/foreshadowing-settlement-operator-review-chain-index-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");

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

function assertSafetyLocked(index) {
  assert.equal(index.safety.read_only, true, "28A index is not read-only.");
  assert.equal(index.safety.preview_only, true, "28A index is not preview-only.");
  assert.equal(index.safety.no_auto_persist, true, "28A index can auto-persist.");
  assert.equal(index.safety.no_canon_update, true, "28A index can update Canon.");
  assert.equal(index.safety.no_active_engine_update, true, "28A index can update active_engine.");
  assert.equal(index.safety.no_compressed_rules_update, true, "28A index can update compressed_rules.");
  assert.equal(index.safety.bridge_can_approve, false, "28A index allows bridge approval.");
  assert.equal(index.safety.bridge_can_confirm_adoption, false, "28A index allows bridge adoption confirmation.");
  assert.equal(index.safety.bridge_can_activate_engine, false, "28A index allows bridge engine activation.");
  assert.equal(index.safety.index_can_approve, false, "28A index can approve.");
  assert.equal(index.safety.index_can_confirm_adoption, false, "28A index can confirm adoption.");
  assert.equal(index.safety.index_can_activate_engine, false, "28A index can activate engine.");
  assert.equal(index.safety.index_can_auto_adopt, false, "28A index can auto-adopt.");
  assert.equal(index.safety.index_can_auto_settle, false, "28A index can auto-settle.");
  assert.equal(index.safety.index_can_write_canon, false, "28A index can write Canon.");
  assert.equal(index.safety.index_can_create_pending_engine_candidate, false, "28A index can create pending engine candidate.");
  assert.equal(index.safety.pending_engine_candidate_created, false, "28A index created pending engine candidate.");
  assert.equal(index.safety.active_engine_modified, false, "28A index modified active_engine.");
  assert.equal(index.safety.canon_modified, false, "28A index modified Canon.");
  assert.equal(index.safety.compressed_rules_modified, false, "28A index modified compressed_rules.");
  assert.equal(index.safety.automatic_adoption_performed, false, "28A index performed automatic adoption.");
  assert.equal(index.safety.automatic_settlement_performed, false, "28A index performed automatic settlement.");
  assert.equal(index.safety.source_surfaces_locked, true, "28A source surfaces are not safety-locked.");
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readOptionalText(compressedRulesPath);
const pendingCandidatesBefore = await readOptionalDirectory(pendingCandidatesDir);
const settlementContextsBefore = await readOptionalDirectory(settlementContextsDir);
const settlementReportsBefore = await readOptionalDirectory(settlementReportsDir);
const approvalItemsBefore = await readOptionalDirectory(approvalItemsDir);
const approvalLogBefore = await readOptionalText(approvalLogPath);

const index = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: true,
  include_markdown: true,
});

assert.equal(index.phase, "28A", "28A index phase mismatch.");
assert.equal(index.version, foreshadowingSettlementOperatorReviewChainIndexVersion, "28A index version mismatch.");
assert.equal(index.index_kind, "foreshadowing_settlement_operator_review_chain_index", "28A index kind mismatch.");
assert.equal(index.source_phase, "27Z", "28A index source phase mismatch.");
assert.deepEqual(
  index.source_phases,
  ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"],
  "28A index source phases mismatch.",
);

assert.equal(index.ok, true, "28A index should be ready.");
assert.equal(index.index_status, "ready_for_operator_review_navigation", "28A index status mismatch.");
assert.equal(index.decision, "ready_for_operator_review_navigation", "28A decision mismatch.");
assert.equal(index.can_open_review_surfaces, true, "28A index should open review surfaces.");
assert.equal(index.can_approve, false, "28A index can approve.");
assert.equal(index.can_confirm_adoption, false, "28A index can confirm adoption.");
assert.equal(index.can_activate_engine, false, "28A index can activate engine.");
assert.equal(index.can_auto_adopt, false, "28A index can auto-adopt.");
assert.equal(index.can_auto_settle, false, "28A index can auto-settle.");
assert.equal(index.direct_adoption_allowed, false, "28A index allows direct adoption.");
assert.equal(index.automatic_settlement_allowed, false, "28A index allows automatic settlement.");
assert.equal(index.requires_human_approval, true, "28A index must require human approval.");
assert.equal(index.requires_operator_confirmation, true, "28A index must require operator confirmation.");
assert.equal(index.review_index_only, true, "28A index must be review-index-only.");
assert.equal(index.manual_review_only, true, "28A index must remain manual-review-only.");

assert(Array.isArray(index.chain_segments), "28A chain segments must be an array.");
assert.equal(index.chain_segments.length, 3, "28A should expose three chain segments.");
assert(index.chain_segments.some((item) => item.key === "operator_readiness_chain" && item.ready === true), "28A missing ready operator readiness chain.");
assert(index.chain_segments.some((item) => item.key === "adoption_gate_chain" && item.ready === true), "28A missing ready adoption gate chain.");
assert(index.chain_segments.some((item) => item.key === "manual_review_entry_chain" && item.ready === true), "28A missing ready manual review entry chain.");

assert(Array.isArray(index.phase_rows), "28A phase rows must be an array.");
assert.equal(index.phase_rows.length, 7, "28A should index 27R, 27T, 27U, 27W, 27X, 27Y, and 27Z.");
assert(index.phase_rows.some((row) => row.key === "phase27r_readiness_dashboard" && row.phase === "27R"), "28A missing 27R row.");
assert(index.phase_rows.some((row) => row.key === "phase27t_adoption_readiness_gate" && row.phase === "27T"), "28A missing 27T row.");
assert(index.phase_rows.some((row) => row.key === "phase27u_adoption_gate_surface" && row.phase === "27U"), "28A missing 27U row.");
assert(index.phase_rows.some((row) => row.key === "phase27w_manual_adoption_review_entry_packet" && row.phase === "27W"), "28A missing 27W row.");
assert(index.phase_rows.some((row) => row.key === "phase27x_manual_adoption_review_entry_ui_surface" && row.phase === "27X"), "28A missing 27X row.");
assert(index.phase_rows.some((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke" && row.coverage_only === true), "28A missing 27Y coverage row.");
assert(index.phase_rows.some((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke" && row.coverage_only === true), "28A missing 27Z coverage row.");

const phase27y = index.phase_rows.find((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke");
assert.equal(
  phase27y.test_path,
  "tests/phase27/phase27y-foreshadowing-settlement-operator-manual-adoption-review-entry-live-ui-smoke.test.mjs",
  "28A 27Y test path mismatch.",
);
const phase27z = index.phase_rows.find((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke");
assert.equal(
  phase27z.test_path,
  "tests/phase27/phase27z-foreshadowing-settlement-operator-manual-adoption-review-entry-final-bridge-smoke.test.mjs",
  "28A 27Z test path mismatch.",
);

assert(Array.isArray(index.cards), "28A cards must be an array.");
assert(index.cards.length >= 6, "28A should expose summary cards.");
assert(Array.isArray(index.operator_entrypoints), "28A operator entrypoints must be an array.");
assert(index.operator_entrypoints.length >= 3, "28A should expose operator entrypoints.");
assert(index.operator_entrypoints.some((item) => item.key === "open_manual_review_entry_surface" && item.read_only === true), "28A missing manual review entrypoint.");
assert(index.operator_entrypoints.some((item) => item.key === "open_existing_approval_queue" && item.can_approve === false), "28A approval queue entrypoint must be navigation-only.");

assert(Array.isArray(index.prohibited_actions), "28A prohibited actions must be an array.");
assert(index.prohibited_actions.length >= 7, "28A should expose prohibited actions.");
assert.equal(index.prohibited_actions.every((item) => item.allowed === false), true, "28A prohibited actions must stay locked.");
assert(index.prohibited_actions.some((item) => item.key === "approve_from_index"), "28A missing approve prohibition.");
assert(index.prohibited_actions.some((item) => item.key === "confirm_adoption_from_index"), "28A missing adoption confirmation prohibition.");
assert(index.prohibited_actions.some((item) => item.key === "activate_engine_from_index"), "28A missing activation prohibition.");
assert(index.prohibited_actions.some((item) => item.key === "write_canon_from_index"), "28A missing Canon write prohibition.");
assert(index.prohibited_actions.some((item) => item.key === "update_compressed_rules_from_index"), "28A missing compressed_rules prohibition.");

assertSafetyLocked(index);

assert.equal(index.checks.readiness_dashboard_loaded, true, "28A dashboard check failed.");
assert.equal(index.checks.adoption_readiness_gate_loaded, true, "28A 27T gate check failed.");
assert.equal(index.checks.adoption_gate_surface_loaded, true, "28A 27U surface check failed.");
assert.equal(index.checks.manual_review_entry_packet_loaded, true, "28A 27W packet check failed.");
assert.equal(index.checks.manual_review_entry_surface_loaded, true, "28A 27X surface check failed.");
assert.equal(index.checks.live_ui_smoke_covered, true, "28A 27Y coverage check failed.");
assert.equal(index.checks.final_bridge_smoke_covered, true, "28A 27Z coverage check failed.");
assert.equal(index.checks.required_payloads_readable, true, "28A required payloads are not readable.");
assert.equal(index.checks.prohibited_actions_locked, true, "28A prohibited actions are not locked.");
assert.equal(index.checks.source_surfaces_locked, true, "28A source surfaces are not locked.");
assert.equal(index.checks.no_mutation_side_effects, true, "28A reports mutation side effects.");
assert.equal(index.checks.index_ready, true, "28A index should be ready.");

assert.equal(index.integrity.phase_rows_loaded, 7, "28A phase rows loaded count mismatch.");
assert.equal(index.integrity.phase_rows_total, 7, "28A phase rows total mismatch.");
assert.equal(index.integrity.required_payloads_readable, true, "28A integrity payload readability failed.");
assert.equal(index.integrity.source_surfaces_locked, true, "28A integrity safety lock failed.");
assert.equal(index.integrity.prohibited_actions_locked, true, "28A integrity prohibited action lock failed.");
assert.equal(index.integrity.no_mutation_side_effects, true, "28A integrity mutation guard failed.");

assert(index.raw_dashboard?.phase === "27R", "28A raw dashboard missing.");
assert(index.raw_manual_review_surface?.phase === "27X", "28A raw manual review surface missing.");
assert.match(index.index_markdown, /Foreshadowing Settlement Operator Review Chain Index/u, "28A markdown heading missing.");
assert.match(index.index_markdown, /phase27z_manual_adoption_review_entry_final_bridge_smoke/u, "28A markdown missing 27Z row.");

const compact = buildForeshadowingSettlementOperatorReviewChainIndex({
  include_raw: false,
  include_markdown: false,
});
assert.equal(compact.raw_dashboard, null, "28A compact index should omit raw dashboard.");
assert.equal(compact.raw_manual_review_surface, null, "28A compact index should omit raw manual review surface.");
assert.equal(compact.index_markdown, "", "28A compact index should omit markdown.");
assert.equal(compact.ok, true, "28A compact index should stay ready.");

assert.equal(hashText(await readFile(activeEnginePath, "utf8")), hashText(activeEngineBefore), "28A changed active_engine.");
assert.equal(await readOptionalText(compressedRulesPath), compressedRulesBefore, "28A changed compressed_rules.");
assert.deepEqual(await readOptionalDirectory(pendingCandidatesDir), pendingCandidatesBefore, "28A changed pending engine candidates.");
assert.deepEqual(await readOptionalDirectory(settlementContextsDir), settlementContextsBefore, "28A changed settlement contexts.");
assert.deepEqual(await readOptionalDirectory(settlementReportsDir), settlementReportsBefore, "28A changed settlement reports.");
assert.deepEqual(await readOptionalDirectory(approvalItemsDir), approvalItemsBefore, "28A changed approval items.");
assert.equal(await readOptionalText(approvalLogPath), approvalLogBefore, "28A changed approval log.");

console.log("Phase28A foreshadowing settlement operator review chain index tests passed.");
