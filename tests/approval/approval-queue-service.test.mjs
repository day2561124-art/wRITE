import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  confirmApprovalItem,
  createApprovalItem,
  createRollbackApprovalItem,
  deferApprovalItem,
  getApprovalItem,
  listApprovalItems,
  listApprovalLogs,
  rejectApprovalItem,
  scanApprovalQueue,
} from "../../server/src/approval-queue-service.mjs";
import { createAgentRun } from "../../server/src/agent-run-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  adoptCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
} from "../../server/src/writing-workflow-service.mjs";

const fixtureApproval = path.join(projectPaths.approvalQueue, ".approval-queue-test");
const fixtureWriting = path.join(projectPaths.writingWorkflow, ".approval-queue-test");
const fixtureCanon = path.join(projectPaths.canonDb, ".approval-queue-test");
const fixtureActive = path.join(fixtureCanon, "active_engine.md");
const fixturePending = path.join(fixtureCanon, "pending_engine_candidates");
const fixtureSnapshots = path.join(fixtureCanon, "engine_snapshots");
const fixtureArchive = path.join(fixtureCanon, "archive");
const fixtureActivationLog = path.join(fixtureCanon, "activation_logs", "activation_log.jsonl");
const fixtureRollbackIndex = path.join(fixtureCanon, "rollback", "rollback_index.json");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function settlement(candidateText) {
  return `## 新版完整創作引擎候選\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function names(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(dirPath, before) {
  for (const name of await names(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

async function expectReject(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  const agentRunsBefore = await names(projectPaths.agentRuns);
  const activeText = [
    "# 完整創作引擎 approval-queue-test",
    ...Array.from({ length: 40 }, (_, index) => `規則 ${index + 1}：維持既有設定。`),
  ].join("\n");
  const options = {
    approvalQueue: fixtureApproval,
    writingWorkflow: fixtureWriting,
    activeEnginePath: fixtureActive,
    pendingEngineCandidates: fixturePending,
    engineSnapshots: fixtureSnapshots,
    engineArchive: fixtureArchive,
    activationLog: fixtureActivationLog,
    rollbackIndex: fixtureRollbackIndex,
  };
  await rm(fixtureApproval, { recursive: true, force: true });
  await rm(fixtureWriting, { recursive: true, force: true });
  await rm(fixtureCanon, { recursive: true, force: true });
  await mkdir(fixtureCanon, { recursive: true });
  await writeFile(fixtureActive, `${activeText}\n`, "utf8");

  try {
    const lowCandidate = await importSettlementResult({
      rawText: settlement(`${activeText}\n新增規則：一般確認。`),
      sourceChapter: "一般候選章",
    }, options);
    const highCandidate = await importSettlementResult({
      rawText: settlement(`${activeText}\n本章確認角色死亡、能力突破與暗線核心真相。`),
      sourceChapter: "高風險候選章",
    }, options);
    assert(highCandidate.risk_report.risk_level === "high", "High-risk fixture was not high.");

    const run = await createAgentRun({
      task_type: "chapter_settlement",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner"],
      input: "Only a textual claim; no success trace.",
    });
    const neuralCandidate = await importSettlementResult({
      rawText: settlement(`${activeText}\n新增規則：需要神經證據。`),
      sourceChapter: "Neural 候選章",
      runId: run.run_id,
      requiresNeuralModules: true,
      neuralModulesUsedPath: `data/agent_runs/${run.run_id}/neural_modules_used.json`,
    }, options);

    const criticalCandidate = await importSettlementResult({
      rawText: settlement(activeText.split("\n").slice(0, 5).join("\n")),
      sourceChapter: "Critical 候選章",
    }, options);
    assert(criticalCandidate.status.status === "blocked", "Critical fixture was not blocked.");

    const draft = await saveCandidateDraft({
      draftText: "含重大驗稿警告的正文候選。",
      sourceChapter: "P0/P1 章",
    }, options);
    const proof = await saveProofReport({
      draftId: draft.metadata.draft_id,
      proofText: "## P0 正史衝突\n\n### P1 關係越界",
    }, options);
    assert(proof.issue_summary.p0_count === 1, "P0 fixture was wrong.");

    const firstScan = await scanApprovalQueue(options);
    const lowItem = firstScan.items.find(
      (item) => item.target_id === lowCandidate.metadata.candidate_id
        && item.action_type === "activate_engine_candidate",
    );
    const highItem = firstScan.items.find(
      (item) => item.target_id === highCandidate.metadata.candidate_id,
    );
    const neuralItem = firstScan.items.find(
      (item) => item.target_id === neuralCandidate.metadata.candidate_id
        && item.action_type === "neural_trace_missing",
    );
    const criticalItem = firstScan.items.find(
      (item) => item.target_id === criticalCandidate.metadata.candidate_id,
    );
    const proofItem = firstScan.items.find(
      (item) => item.target_id === draft.metadata.draft_id
        && item.action_type === "adopt_p0_p1_draft",
    );
    assert(lowItem, "Scan omitted pending candidate.");
    assert(highItem?.requires_second_confirmation, "High-risk item missed second confirmation.");
    assert(neuralItem?.status.status === "blocked", "Neural-missing item was not blocked.");
    assert(criticalItem?.status.status === "blocked", "Critical item was not blocked.");
    assert(proofItem?.requires_second_confirmation, "P0/P1 item missed second confirmation.");
    const requestOnlyItem = await createApprovalItem({
      actionType: "adopt_writing_candidate",
      targetType: "writing_candidate",
      targetId: "writing_candidate_20260612-000000-00000000",
      riskLevel: "medium",
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      safety: { approval_only: true, direct_adoption_performed: false },
    }, options);
    assert(
      requestOnlyItem.status.status === "pending",
      "Request-only adoption action was not accepted by the queue.",
    );
    await expectReject(
      () => confirmApprovalItem(requestOnlyItem.approval_item_id, {
        confirm: true,
        approvedBy: "approval_test",
      }, options),
      "Request-only adoption action executed directly.",
    );

    const countBeforeRescan = (await listApprovalItems(options)).length;
    await scanApprovalQueue(options);
    assert(
      (await listApprovalItems(options)).length === countBeforeRescan,
      "Repeated scan created duplicate items.",
    );

    await expectReject(
      () => confirmApprovalItem(lowItem.approval_item_id, {}, options),
      "Unconfirmed item was confirmed.",
    );
    await expectReject(
      () => confirmApprovalItem(highItem.approval_item_id, {
        confirm: true,
        secondConfirm: false,
      }, options),
      "High-risk item skipped second confirmation.",
    );
    await expectReject(
      () => confirmApprovalItem(highItem.approval_item_id, {
        confirm: true,
        secondConfirm: true,
        approvalText: "錯誤文字",
      }, options),
      "High-risk item accepted wrong confirmation text.",
    );
    await expectReject(
      () => confirmApprovalItem(neuralItem.approval_item_id, {
        confirm: true,
        secondConfirm: true,
        approvalText: "確認啟用",
      }, options),
      "Neural-missing item was force-confirmed.",
    );
    await expectReject(
      () => confirmApprovalItem(criticalItem.approval_item_id, { confirm: true }, options),
      "Critical item was confirmed.",
    );

    const beforeActivation = hash(await readFile(fixtureActive));
    const lowConfirmed = await confirmApprovalItem(lowItem.approval_item_id, {
      confirm: true,
      approvedBy: "approval_test",
    }, options);
    assert(lowConfirmed.result.snapshot_id, "Approval did not call Phase 3 activation.");
    assert(lowConfirmed.result.activation_log_id, "Activation confirmation log id is missing.");
    assert(
      lowConfirmed.approval_item.status.execution_result.activation_log_id
        === lowConfirmed.result.activation_log_id,
      "Approval result did not preserve activation trace.",
    );
    assert(
      lowConfirmed.approval_item.status.status === "resolved",
      "Confirmed item was not resolved.",
    );
    assert(hash(await readFile(fixtureActive)) !== beforeActivation, "Activation did not update fixture.");

    const rollbackItem = await createRollbackApprovalItem(
      lowConfirmed.result.snapshot_id,
      options,
    );
    const rollbackConfirmed = await confirmApprovalItem(rollbackItem.approval_item_id, {
      confirm: true,
      approvedBy: "approval_test",
    }, options);
    assert(rollbackConfirmed.result.safety_snapshot_id, "Approval did not call Phase 3 rollback.");
    assert(
      hash(await readFile(fixtureActive)) === hash(`${activeText}\n`),
      "Rollback approval did not restore fixture active engine.",
    );

    const proofConfirmed = await confirmApprovalItem(proofItem.approval_item_id, {
      confirm: true,
      secondConfirm: true,
      approvedBy: "approval_test",
    }, options);
    assert(
      proofConfirmed.result.status.status === "accepted_pending_settlement",
      "P0/P1 approval did not call Phase 4A adoption.",
    );

    const deferred = await deferApprovalItem(highItem.approval_item_id, {
      reason: "稍後確認",
    }, options);
    assert(deferred.status.status === "deferred", "Defer did not update status.");
    const rejected = await rejectApprovalItem(highItem.approval_item_id, {
      reason: "本次不啟用",
    }, options);
    assert(rejected.status.status === "rejected", "Reject did not update status.");
    assert(
      (await getApprovalItem(highItem.approval_item_id, options)).status.reason === "本次不啟用",
      "Reject reason was not preserved.",
    );

    const logs = await listApprovalLogs(options);
    for (const event of [
      "approval_created",
      "approval_blocked",
      "approval_confirmed",
      "approval_resolved",
      "approval_deferred",
      "approval_rejected",
      "approval_failed",
    ]) {
      assert(logs.some((log) => log.event === event), `Approval log omitted ${event}.`);
    }
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production active changed.");
    console.log("Approval queue service test passed.");
  } finally {
    await rm(fixtureApproval, { recursive: true, force: true });
    await rm(fixtureWriting, { recursive: true, force: true });
    await rm(fixtureCanon, { recursive: true, force: true });
    await removeNew(projectPaths.agentRuns, agentRunsBefore);
    await removeNew(transactionDir, transactionsBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Cleanup changed active.");
  }
}

main().catch((error) => {
  console.error(`Approval queue service test failed: ${error.message}`);
  process.exitCode = 1;
});
