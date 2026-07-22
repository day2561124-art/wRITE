import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createApprovalItem,
  createExternalBrainSessionRetirementApprovalItem,
  getApprovalItem,
  listActionableApprovalItems,
  listApprovalItems,
  rejectApprovalItem,
  scanApprovalQueue,
} from "../../server/src/approval-queue-service.mjs";
import {
  cleanupApprovalQueue,
} from "../../server/src/approval-queue-cleanup-service.mjs";
import {
  createAgentRun,
  getAgentRun,
  transitionExternalBrainSessionLifecycle,
} from "../../server/src/agent-run-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import {
  reconciliationRecommendations,
} from "../../server/src/external-brain-session-reconciliation-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", "approval-dedupe-cleanup");
const canonFixture = path.join(projectRoot, "data", "canon_db", ".approval-dedupe-cleanup");
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(
  canonFixture,
  "pending_engine_candidates",
);
const options = { fixtureRoot, activeEnginePath, pendingEngineCandidates };

function settlement(candidateText) {
  return `## 新版完整創作引擎候選\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function snapshotDirectory(directory) {
  const records = [];
  async function visit(current) {
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else records.push([path.relative(directory, absolute), sha256(await readFile(absolute))]);
    }
  }
  await visit(directory);
  return records;
}

async function rewriteJson(filePath, transform) {
  const current = JSON.parse(await readFile(filePath, "utf8"));
  await writeFile(filePath, `${JSON.stringify(transform(current), null, 2)}\n`, "utf8");
}

await rm(fixtureRoot, { recursive: true, force: true });
await rm(canonFixture, { recursive: true, force: true });
await mkdir(path.dirname(activeEnginePath), { recursive: true });
const activeText = [
  "# Approval dedupe engine v1.0.0",
  ...Array.from({ length: 40 }, (_, index) => `規則 ${index + 1}：保持穩定。`),
].join("\n");
await writeFile(activeEnginePath, `${activeText}\n`, "utf8");

try {
  const candidate = await importSettlementResult({
    rawText: settlement(`${activeText}\n一般候選規則。`),
    sourceChapter: "一般章節",
  }, options);

  await Promise.all(Array.from({ length: 10 }, () => scanApprovalQueue(options)));
  let items = await listApprovalItems(options);
  let candidateItems = items.filter((item) => (
    item.target_id === candidate.metadata.candidate_id
      && item.action_type === "activate_engine_candidate"
      && item.request_kind === "activate_engine_candidate"
  ));
  assert.equal(candidateItems.length, 1, "Ten identical scans must create one item.");

  await rejectApprovalItem(candidateItems[0].approval_item_id, { reason: "keep current engine" }, options);
  await scanApprovalQueue(options);
  items = await listApprovalItems({ ...options });
  candidateItems = items.filter((item) => (
    item.target_id === candidate.metadata.candidate_id
      && item.action_type === "activate_engine_candidate"
      && item.request_kind === "activate_engine_candidate"
  ));
  assert.equal(candidateItems.length, 1, "Rejected item reappeared after rescan.");
  assert.equal(candidateItems[0].status.suppression.suppress_reproposal, true);

  await scanApprovalQueue({ ...options });
  assert.equal(
    (await listApprovalItems(options)).filter((item) => (
      item.target_id === candidate.metadata.candidate_id
        && item.request_kind === "activate_engine_candidate"
    )).length,
    1,
    "Persisted rejection suppression did not survive a fresh service call.",
  );

  const sourceA = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "source_revision_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "a".repeat(64),
    sourceRevision: "a".repeat(64),
  }, options);
  await rejectApprovalItem(sourceA.approval_item_id, { reason: "reject revision A" }, options);
  const sourceARepeat = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "source_revision_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "a".repeat(64),
    sourceRevision: "a".repeat(64),
  }, options);
  assert.equal(sourceARepeat.approval_item_id, sourceA.approval_item_id);
  const sourceB = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "source_revision_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "b".repeat(64),
    sourceRevision: "b".repeat(64),
  }, options);
  assert.notEqual(sourceB.approval_item_id, sourceA.approval_item_id);

  const runtimeOrphan = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "runtime_orphan_regression",
    targetType: "pending_engine_candidate",
    targetId: "engine_candidate_20260722-000000-deadbeef",
    sourceHash: "c".repeat(64),
  }, options);
  const actionableAfterOrphan = await listActionableApprovalItems(options);
  const invalidatedOrphan = await getApprovalItem(runtimeOrphan.approval_item_id, options);
  assert.equal(invalidatedOrphan.status.status, "orphaned");
  assert.equal(invalidatedOrphan.status.invalidation_reason, "target_not_found");
  assert.equal(
    actionableAfterOrphan.some((item) => item.approval_item_id === runtimeOrphan.approval_item_id),
    false,
    "Invalidated orphan leaked into the pending backend result.",
  );

  const missingRunCandidate = await importSettlementResult({
    rawText: settlement(`${activeText}\n缺少 trace 來源的候選規則。`),
    sourceChapter: "缺少流程來源章",
    requiresNeuralModules: true,
  }, options);
  const missingRunScan = await scanApprovalQueue(options);
  assert.equal(
    (await listApprovalItems(options)).some((item) => (
      item.target_id === missingRunCandidate.metadata.candidate_id
        && item.action_type === "neural_trace_missing"
    )),
    false,
    "Missing workflow_run_id created a Neural Trace approval.",
  );
  assert(
    missingRunScan.diagnostics.some((item) => (
      item.kind === "neural_trace_source_unavailable"
        && item.target_id === missingRunCandidate.metadata.candidate_id
    )),
  );

  const directCandidate = await importSettlementResult({
    rawText: settlement(`${activeText}\n直接章節結算規則。`),
    sourceChapter: "直接章節結算",
  }, options);
  const directMetadataPath = path.join(
    pendingEngineCandidates,
    directCandidate.metadata.candidate_id,
    "metadata.json",
  );
  await rewriteJson(directMetadataPath, (metadata) => ({
    ...metadata,
    candidate_kind: "direct_chapter_settlement_promotion",
    source: "direct_chapter_settlement_promotion_service",
    lineage_mode: "direct_chapter_settlement_summary",
    source_lineage: {
      lineage_mode: "direct_chapter_settlement_summary",
      legacy_adopted_writing_workflow_applicable: false,
    },
    requires_neural_modules: true,
  }));
  await scanApprovalQueue(options);
  const directItems = (await listApprovalItems(options)).filter((item) => (
    item.target_id === directCandidate.metadata.candidate_id
  ));
  assert.equal(directItems.some((item) => item.action_type === "neural_trace_missing"), false);
  assert.equal(
    directItems.find((item) => item.action_type === "activate_engine_candidate")?.neural_status,
    "not_applicable",
  );

  const sessionRun = await createAgentRun({
    task_type: "draft_generation",
    mode: "chatgpt_owned_external_brain",
    requires_neural_modules: false,
    input: "session generation regression",
  }, options);
  const sessionProposal = (generation) => ({
    session_id: sessionRun.run_id,
    lifecycle_generation: generation,
    recommendation: reconciliationRecommendations.RETIRE_RECOMMENDED,
    ownership_proof_complete: true,
    writing_context_bundle_ids: ["gptctx_20260722-000000-deadbeef"],
    neural_trace_count: 1,
    latest_activity_at: "2026-07-01T00:00:00.000Z",
    activity_age_days: 21,
    estimated_logical_bytes: 10,
    estimated_file_count: 1,
  });
  const retirementOne = await createExternalBrainSessionRetirementApprovalItem(
    sessionProposal(1),
    options,
  );
  const retirementOneRepeat = await createExternalBrainSessionRetirementApprovalItem(
    sessionProposal(1),
    options,
  );
  assert.equal(retirementOneRepeat.approval_item_id, retirementOne.approval_item_id);
  await rejectApprovalItem(retirementOne.approval_item_id, { reason: "keep this generation" }, options);
  const retirementSuppressed = await createExternalBrainSessionRetirementApprovalItem(
    sessionProposal(1),
    options,
  );
  assert.equal(retirementSuppressed.approval_item_id, retirementOne.approval_item_id);
  assert.equal(retirementSuppressed.status.decision.decision, "keep");

  await transitionExternalBrainSessionLifecycle(sessionRun.run_id, "COMPLETED", {}, options);
  await transitionExternalBrainSessionLifecycle(sessionRun.run_id, "ACTIVE", {}, options);
  const restartedRun = await getAgentRun(sessionRun.run_id, options);
  assert.equal(restartedRun.lifecycle_generation, 2);
  const retirementTwo = await createExternalBrainSessionRetirementApprovalItem(
    sessionProposal(2),
    options,
  );
  assert.notEqual(retirementTwo.approval_item_id, retirementOne.approval_item_id);

  const isolatedTestItem = await createApprovalItem({
    actionType: "activate_engine_candidate",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceKind: "ui_contract_test",
    testFixture: true,
  }, { ...options, enforceProductionFixtureIsolation: true });
  assert.equal(isolatedTestItem.approval_item_id, null);
  assert.equal(isolatedTestItem.persisted, false);

  const cleanupDuplicateOne = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "cleanup_duplicate_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "d".repeat(64),
    reproposalAllowed: true,
  }, options);
  const cleanupDuplicateTwo = await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "cleanup_duplicate_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "d".repeat(64),
  }, options);
  assert.notEqual(cleanupDuplicateOne.approval_item_id, cleanupDuplicateTwo.approval_item_id);
  await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "cleanup_orphan_regression",
    targetType: "pending_engine_candidate",
    targetId: "engine_candidate_20260722-000001-deadbeef",
    sourceHash: "e".repeat(64),
  }, options);
  await createApprovalItem({
    actionType: "neural_trace_missing",
    requestKind: "cleanup_missing_trace_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceHash: "f".repeat(64),
    status: "blocked",
    blockedReason: "legacy trace source unavailable",
  }, options);
  await createApprovalItem({
    actionType: "activate_engine_candidate",
    requestKind: "cleanup_test_fixture_regression",
    targetType: "pending_engine_candidate",
    targetId: candidate.metadata.candidate_id,
    sourceKind: "ui_contract_test",
    testFixture: true,
  }, options);

  const retirementStatusPath = path.join(
    fixtureRoot,
    "data",
    "approval_queue",
    "items",
    retirementOne.approval_item_id,
    "status.json",
  );
  await rewriteJson(retirementStatusPath, ({ suppression, decision, ...status }) => status);

  const queueRoot = path.join(fixtureRoot, "data", "approval_queue");
  const beforeDryRun = await snapshotDirectory(queueRoot);
  const preview = await cleanupApprovalQueue({ dryRun: true }, options);
  const afterDryRun = await snapshotDirectory(queueRoot);
  assert.deepEqual(afterDryRun, beforeDryRun, "Cleanup dry-run wrote files.");
  assert(preview.statistics.duplicates_collapsed >= 1);
  assert(preview.statistics.orphaned_invalidated >= 1);
  assert(preview.statistics.test_items_archived >= 1);
  assert(preview.statistics.missing_trace_items_closed >= 1);
  assert(preview.statistics.session_retirement_items_suppressed >= 1);

  const applied = await cleanupApprovalQueue({ dryRun: false, confirm: true }, options);
  assert.equal(applied.remaining_planned_changes.length, 0);
  const repeated = await cleanupApprovalQueue({ dryRun: false, confirm: true }, options);
  assert.equal(repeated.applied_changes.length, 0, "Cleanup apply was not idempotent.");
  assert.equal(repeated.write_performed, false);

  console.log("Approval queue dedupe, suppression, lifecycle, UI isolation, and cleanup tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(canonFixture, { recursive: true, force: true });
}
