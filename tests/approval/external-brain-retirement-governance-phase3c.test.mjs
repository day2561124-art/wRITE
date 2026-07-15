import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  confirmApprovalItem,
  createApprovalItem,
  deferApprovalItem,
  listApprovalLogs,
  rejectApprovalItem,
  scanExternalBrainRetirementApprovals,
} from "../../server/src/approval-queue-service.mjs";
import {
  externalBrainSessionClassifications as C,
  scanExternalBrainSessions,
} from "../../server/src/external-brain-session-lineage-service.mjs";
import { reconciliationRecommendations as R } from "../../server/src/external-brain-session-reconciliation-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";
import { fingerprintRoots } from "../helpers/content-fingerprint.mjs";

const now = new Date("2026-07-15T12:00:00.000Z");
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `external-brain-retirement-phase3c-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot, now };

const productionRoots = {
  approval_queue: projectPaths.approvalQueue,
  gpt_writing_contexts: projectPaths.gptWritingContexts,
  writing_candidates: projectPaths.writingCandidates,
  agent_runs: projectPaths.agentRuns,
  neural_traces: projectPaths.neuralTraces,
  neural_outputs: projectPaths.neuralModuleOutputs,
  transactions: path.join(projectPaths.outputLogs, "transactions"),
  writing_workflow: projectPaths.writingWorkflow,
  active_engine: projectPaths.activeEngine,
  compressed_rules: projectPaths.compressedRules,
};

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, json(value), "utf8");
}

async function makeSession(stamp, suffix, { recent = false, complete = true } = {}) {
  const runId = `agent_run_${stamp}-${suffix}`;
  const bundleId = `gptctx_${stamp}-${suffix}`;
  const lastActivityAt = recent ? "2026-07-14T12:00:00.000Z" : "2026-07-10T00:00:00.000Z";
  await writeJson(path.join(fixtureRoot, "data", "agent_runs", runId, "run.json"), {
    run_id: runId,
    task_type: "draft_generation",
    created_at: lastActivityAt,
    updated_at: lastActivityAt,
    created_by: "phase3c_fixture",
    mode: "chatgpt_owned_external_brain",
    external_brain_session_id: runId,
    ...(complete ? { writing_context_bundle_id: bundleId } : {}),
    session_lifecycle_status: "ACTIVE",
    last_activity_at: lastActivityAt,
    status: "running",
    output_hash: null,
    warning: false,
    blocked: false,
  });
  await writeJson(path.join(fixtureRoot, "data", "agent_runs", runId, "neural_modules_used.json"), {
    neural_modules_used: [],
  });
  if (complete) {
    await writeJson(path.join(
      fixtureRoot,
      "data",
      "outputs",
      "gpt_writing_contexts",
      bundleId,
      "context_bundle.json",
    ), { bundle_id: bundleId, created_at: lastActivityAt });
  }
  return { runId, bundleId };
}

function itemFor(items, runId) {
  const item = items.find((entry) => entry.target_id === runId);
  assert(item, `Missing retirement approval for ${runId}`);
  return item;
}

const productionBefore = await fingerprintRoots(productionRoots);

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  const retire = await makeSession("20260710-010000", "00000001");
  const recent = await makeSession("20260714-020000", "00000002", { recent: true });
  const review = await makeSession("20260710-030000", "00000003", { complete: false });
  const evidence = await makeSession("20260710-040000", "00000004");
  const governance = await makeSession("20260710-050000", "00000005");
  const lateGovernance = await makeSession("20260710-060000", "00000006");
  const lateEvidence = await makeSession("20260710-070000", "00000007");
  const rejectedSession = await makeSession("20260710-080000", "00000008");
  const deferredSession = await makeSession("20260710-090000", "00000009");

  await writeJson(path.join(fixtureRoot, "config", "phase47-phase3c-evidence.json"), {
    external_brain_session_id: evidence.runId,
    writing_context_bundle_id: evidence.bundleId,
  });
  await createApprovalItem({
    actionType: "setting_change_proposal",
    targetType: "external_brain_session",
    targetId: governance.runId,
    title: "substantive governance fixture",
  }, options);

  const discovery = await scanExternalBrainRetirementApprovals(options);
  assert.equal(discovery.live_retire_recommended_count, 5);
  assert(!discovery.items.some((item) => item.target_id === recent.runId));
  assert(!discovery.items.some((item) => item.target_id === review.runId));
  assert(!discovery.items.some((item) => item.target_id === evidence.runId));
  assert(!discovery.items.some((item) => item.target_id === governance.runId));

  const retirementItem = itemFor(discovery.items, retire.runId);
  assert.equal(retirementItem.action_type, "retire_external_brain_session");
  assert.equal(retirementItem.target_type, "external_brain_session");
  assert.equal(retirementItem.requires_user_confirmation, true);
  assert.equal(retirementItem.can_execute_without_user_confirmation, false);
  assert.equal(retirementItem.requires_second_confirmation, false);
  assert.equal(retirementItem.cleanup_not_executed, true);
  assert.equal(retirementItem.retirement_recommendation, R.RETIRE_RECOMMENDED);
  assert.equal(retirementItem.last_activity_at, "2026-07-10T00:00:00.000Z");
  assert.deepEqual(retirementItem.impact.will_delete, []);

  const duplicate = await scanExternalBrainRetirementApprovals(options);
  assert.equal(itemFor(duplicate.items, retire.runId).approval_item_id, retirementItem.approval_item_id);

  let scan = await scanExternalBrainSessions({}, options);
  assert.equal(scan.sessions.find((session) => session.session_id === retire.runId).classification, C.STALE_ACTIVE_SESSION);
  assert.equal(scan.sessions.find((session) => session.session_id === governance.runId).classification, C.GOVERNANCE_PINNED_SESSION);

  await assert.rejects(
    () => confirmApprovalItem(retirementItem.approval_item_id, {}, options),
    /User confirmation is required/iu,
  );
  const confirmed = await confirmApprovalItem(retirementItem.approval_item_id, {
    confirm: true,
    approvedBy: "phase3c_operator",
  }, options);
  assert.equal(confirmed.approval_item.status.execution_result.session_lifecycle_status, "ABANDONED");
  assert.equal(confirmed.approval_item.status.execution_result.production_cleanup_executed, false);
  const retiredRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", retire.runId, "run.json"), "utf8"));
  assert.equal(retiredRun.status, "running", "retirement must not forge run success");
  assert.equal(retiredRun.session_lifecycle_status, "ABANDONED");

  const rejectedItem = itemFor(discovery.items, rejectedSession.runId);
  await rejectApprovalItem(rejectedItem.approval_item_id, { reason: "not now" }, options);
  const rejectedRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", rejectedSession.runId, "run.json"), "utf8"));
  assert.equal(rejectedRun.session_lifecycle_status, "ACTIVE");
  scan = await scanExternalBrainSessions({}, options);
  assert.equal(scan.sessions.find((session) => session.session_id === rejectedSession.runId).classification, C.STALE_ACTIVE_SESSION);

  const deferredItem = itemFor(discovery.items, deferredSession.runId);
  await deferApprovalItem(deferredItem.approval_item_id, { reason: "later" }, options);
  let deferredRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", deferredSession.runId, "run.json"), "utf8"));
  assert.equal(deferredRun.session_lifecycle_status, "ACTIVE");
  scan = await scanExternalBrainSessions({}, options);
  assert.equal(scan.sessions.find((session) => session.session_id === deferredSession.runId).classification, C.STALE_ACTIVE_SESSION);
  await confirmApprovalItem(deferredItem.approval_item_id, {
    confirm: true,
    approvedBy: "phase3c_operator",
  }, options);
  deferredRun = JSON.parse(await readFile(path.join(fixtureRoot, "data", "agent_runs", deferredSession.runId, "run.json"), "utf8"));
  assert.equal(deferredRun.session_lifecycle_status, "ABANDONED");

  const lateGovernanceItem = itemFor(discovery.items, lateGovernance.runId);
  await createApprovalItem({
    actionType: "setting_change_proposal",
    targetType: "external_brain_session",
    targetId: lateGovernance.runId,
    title: "late substantive governance fixture",
  }, options);
  await assert.rejects(
    () => confirmApprovalItem(lateGovernanceItem.approval_item_id, {
      confirm: true,
      approvedBy: "phase3c_operator",
    }, options),
    /blocked by a live governance/iu,
  );

  const lateEvidenceItem = itemFor(discovery.items, lateEvidence.runId);
  await writeJson(path.join(fixtureRoot, "config", "phase47-phase3c-late-evidence.json"), {
    external_brain_session_id: lateEvidence.runId,
    writing_context_bundle_id: lateEvidence.bundleId,
  });
  await assert.rejects(
    () => confirmApprovalItem(lateEvidenceItem.approval_item_id, {
      confirm: true,
      approvedBy: "phase3c_operator",
    }, options),
    /blocked by a live governance or acceptance-evidence/iu,
  );

  const futureScan = await scanExternalBrainSessions({}, {
    fixtureRoot,
    now: new Date("2026-08-16T12:00:00.000Z"),
  });
  const futureRetired = futureScan.sessions.find((session) => session.session_id === retire.runId);
  assert.equal(futureRetired.classification, C.ABANDONED_SESSION);
  assert.equal(futureRetired.status, "eligible_for_cleanup");
  assert(!futureRetired.referenced_by.some((entry) => entry.category === "approval"));
  assert(!futureRetired.cleanup_paths.some((entry) => entry.includes("approval_queue")));

  const logs = await listApprovalLogs(options);
  for (const event of [
    "approval_created",
    "approval_confirmed",
    "approval_resolved",
    "approval_deferred",
    "approval_rejected",
    "approval_failed",
  ]) assert(logs.some((entry) => entry.event === event), `Missing approval log event ${event}`);

  assert.equal(await readFile(path.join(fixtureRoot, "data", "canon_db", "active_engine.md"), "utf8").catch(() => ""), "");
  assert.equal(await readFile(path.join(fixtureRoot, "data", "error_report_db", "compressed_rules.md"), "utf8").catch(() => ""), "");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

const productionAfter = await fingerprintRoots(productionRoots);
assert.deepEqual(productionAfter, productionBefore, "Phase 3C governance tests changed production file bytes.");
console.log("External brain retirement approval governance Phase 3C PASS.");
