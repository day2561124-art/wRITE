import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createAgentRun } from "../../server/src/agent-run-service.mjs";
import {
  run_character_simulator,
  run_neural_critic,
  run_over_governance_detector,
  run_scene_planner,
  run_style_drift_detector,
} from "../../server/src/neural-module-service.mjs";
import {
  confirmApprovalItem,
  scanApprovalQueue,
} from "../../server/src/approval-queue-service.mjs";
import {
  approveCleanupProposal,
  createCleanupProposal,
  executeCleanupProposal,
  listCleanupLogs,
} from "../../server/src/cleanup-proposal-service.mjs";
import {
  getPendingCandidate,
  importSettlementResult,
  listActivationLogs,
  rollbackActiveEngine,
} from "../../server/src/engine-candidate-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildSettlementContext,
  createPendingCandidateFromSettlementReport,
  saveSettlementReport,
} from "../../server/src/settlement-workflow-service.mjs";
import {
  adoptCandidateDraft,
  createDraftTask,
  getAdoptedChapter,
  getCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
} from "../../server/src/writing-workflow-service.mjs";

const requiredNeuralModules = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
];
const neuralWrappers = [
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
];

const fixtureCanon = path.join(projectPaths.canonDb, ".full-workflow-smoke");
const fixtureActive = path.join(fixtureCanon, "active_engine.md");
const fixturePending = path.join(fixtureCanon, "pending_engine_candidates");
const fixtureRejected = path.join(fixtureCanon, "rejected_engine_candidates");
const fixtureSnapshots = path.join(fixtureCanon, "engine_snapshots");
const fixtureArchive = path.join(fixtureCanon, "archive");
const fixtureActivationLog = path.join(fixtureCanon, "activation_logs", "activation_log.jsonl");
const fixtureRollbackIndex = path.join(fixtureCanon, "rollback", "rollback_index.json");
const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".full-workflow-smoke");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".full-workflow-smoke");
const fixtureCleanup = path.join(projectPaths.cleanupRoot, ".full-workflow-smoke");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

const options = {
  writingWorkflow: fixtureWorkflow,
  activeEnginePath: fixtureActive,
  pendingEngineCandidates: fixturePending,
  rejectedEngineCandidates: fixtureRejected,
  engineSnapshots: fixtureSnapshots,
  engineArchive: fixtureArchive,
  activationLog: fixtureActivationLog,
  rollbackIndex: fixtureRollbackIndex,
  approvalQueue: fixtureApproval,
  cleanupRoot: fixtureCleanup,
  candidateDrafts: path.join(fixtureWorkflow, "candidate_drafts"),
  proofReports: path.join(fixtureWorkflow, "proof_reports"),
  adoptedChapters: path.join(fixtureWorkflow, "adopted_chapters"),
  contextBundles: path.join(fixtureWorkflow, "context_bundles"),
  settlementContexts: path.join(fixtureWorkflow, "settlements", "contexts"),
  settlementReports: path.join(fixtureWorkflow, "settlements", "reports"),
  approvalItems: path.join(fixtureApproval, "items"),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function settlement(candidateText) {
  return [
    "# Full workflow settlement report",
    "",
    "## Verified result",
    "",
    "The adopted chapter is ready for a pending engine candidate.",
    "",
    "## 新版完整創作引擎候選",
    "",
    "```md",
    candidateText.trimEnd(),
    "```",
    "",
  ].join("\n");
}

async function optionalBuffer(filePath) {
  try {
    return { exists: true, content: await readFile(filePath) };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, content: Buffer.alloc(0) };
    throw error;
  }
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function protectedState() {
  const outputFiles = [
    projectPaths.pendingErrorReports,
    path.join(projectRoot, "data", "feedback_db", "rejected_drafts.jsonl"),
    path.join(projectPaths.outputs, "current_prompt.md"),
    path.join(projectPaths.outputs, "generation_context.md"),
    path.join(projectPaths.outputs, "retrieval_context.md"),
    path.join(projectPaths.outputs, "task_prompt.md"),
    projectPaths.visualIndex,
  ];
  const buffers = new Map();
  for (const filePath of outputFiles) {
    buffers.set(filePath, await optionalBuffer(filePath));
  }
  return {
    buffers,
    visualCharacters: await names(path.join(projectPaths.visualAssets, "characters")),
    visualArmedForms: await names(path.join(projectPaths.visualAssets, "armed_forms")),
  };
}

async function assertProtectedStateUnchanged(before) {
  for (const [filePath, prior] of before.buffers) {
    const current = await optionalBuffer(filePath);
    assert(current.exists === prior.exists, `Protected file existence changed: ${filePath}`);
    assert(
      current.content.equals(prior.content),
      `Protected file content changed: ${filePath}`,
    );
  }
  assert(
    JSON.stringify([...await names(path.join(projectPaths.visualAssets, "characters"))].sort())
      === JSON.stringify([...before.visualCharacters].sort()),
    "Visual character assets changed.",
  );
  assert(
    JSON.stringify([...await names(path.join(projectPaths.visualAssets, "armed_forms"))].sort())
      === JSON.stringify([...before.visualArmedForms].sort()),
    "Visual armed-form assets changed.",
  );
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = sha256(productionActive);
  const protectedBefore = await protectedState();
  const agentRunsBefore = await names(projectPaths.agentRuns);
  const neuralTracesBefore = await names(projectPaths.neuralTraces);
  const transactionsBefore = await names(transactionDir);
  const productionPendingBefore = await names(projectPaths.pendingEngineCandidates);
  const productionSnapshotsBefore = await names(projectPaths.engineSnapshots);
  const productionArchiveBefore = await names(projectPaths.engineArchive);
  const productionApprovalBefore = await names(projectPaths.approvalItems);
  const productionCleanupBefore = await names(projectPaths.cleanupProposals);

  await Promise.all([
    rm(fixtureCanon, { recursive: true, force: true }),
    rm(fixtureWorkflow, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
    rm(fixtureCleanup, { recursive: true, force: true }),
  ]);
  await mkdir(fixtureCanon, { recursive: true });
  await writeFile(fixtureActive, productionActive);
  const initialFixtureHash = sha256(await readFile(fixtureActive));

  try {
    const draftTask = await createDraftTask({
      sourceChapter: "Phase 6A full workflow",
      task: "Build a complete engine-first candidate.",
      requiresNeuralModules: true,
      requiredNeuralModules,
    }, options);
    for (const wrapper of neuralWrappers) {
      await wrapper("full workflow draft fixture", {
        run_id: draftTask.run.run_id,
        adapter: async () => ({ ok: true }),
      });
    }
    const draft = await saveCandidateDraft({
      draftText: [
        "# 第十九章：完整流程煙霧測試",
        "",
        "第一聲鈴響起，選拔場上的人群同時轉頭。",
        "千夜守住位置，也注意到醫療席後方不自然的動靜。",
      ].join("\n"),
      sourceChapter: "第十九章",
      note: "Phase 6A full workflow smoke fixture",
      runId: draftTask.run.run_id,
      contextBundleId: draftTask.context_bundle.context_bundle_id,
      neuralModulesUsedPath:
        `data/agent_runs/${draftTask.run.run_id}/neural_modules_used.json`,
    }, options);
    assert(draft.status.status === "candidate", "Candidate draft status was not candidate.");
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Draft changed active engine.");

    const proof = await saveProofReport({
      draftId: draft.metadata.draft_id,
      proofText: [
        "# 正文驗稿報告",
        "",
        "## P2",
        "場景轉換可再補一個視線落點。",
        "",
        "## P3",
        "句尾節奏可略微收緊。",
      ].join("\n"),
      note: "Phase 6A proof fixture",
    }, options);
    assert(proof.issue_summary.p0_count === 0, "Proof report unexpectedly contained P0.");
    assert(proof.issue_summary.p1_count === 0, "Proof report unexpectedly contained P1.");
    assert(
      proof.issue_summary.can_adopt_recommendation === true,
      "Proof did not recommend adoption.",
    );
    assert(
      (await getCandidateDraft(draft.metadata.draft_id, options)).status.status === "proofed",
      "Draft status was not proofed.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Proof changed active engine.");

    const adopted = await adoptCandidateDraft(draft.metadata.draft_id, {
      confirm: true,
      adoptedBy: "smoke_test",
      note: "Phase 6A adoption",
    }, options);
    const adoptedId = adopted.metadata.adopted_chapter_id;
    assert(
      adopted.status.status === "accepted_pending_settlement",
      "Adopted chapter status was wrong.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Adoption changed active engine.");
    assert((await names(fixturePending)).size === 0, "Adoption created a pending candidate.");

    const context = await buildSettlementContext(adoptedId, {
      note: "Phase 6A settlement context",
    }, options);
    assert(context.status.status === "ready", "Settlement context was not ready.");
    assert(
      context.metadata.active_engine_hash === initialFixtureHash,
      "Settlement context active engine hash was wrong.",
    );
    assert(
      context.source_manifest.sources.some(
        (source) => source.label === "adopted_chapter" && source.exists,
      ),
      "Settlement context omitted adopted chapter source.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Context changed active engine.");

    const activeText = (await readFile(fixtureActive, "utf8")).trimEnd();
    const candidateText = `${activeText}\n\n## Phase 6A Smoke Marker\n\n- Full workflow smoke scenario completed.`;
    const settlementRun = await createAgentRun({
      task_type: "chapter_settlement",
      requires_neural_modules: true,
      required_neural_modules: requiredNeuralModules,
      input: "Full workflow settlement fixture.",
    });
    for (const wrapper of neuralWrappers) {
      await wrapper("full workflow settlement fixture", {
        run_id: settlementRun.run_id,
        adapter: async () => ({ ok: true }),
      });
    }
    const report = await saveSettlementReport({
      settlementContextId: context.metadata.settlement_context_id,
      settlementText: settlement(candidateText),
      sourceChapter: "第十九章",
      note: "Phase 6A settlement report",
      runId: settlementRun.run_id,
      neuralModulesUsedPath:
        `data/agent_runs/${settlementRun.run_id}/neural_modules_used.json`,
    }, options);
    assert(
      report.status.status === "settlement_report_saved",
      "Settlement report status was wrong.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Report changed active engine.");

    const created = await createPendingCandidateFromSettlementReport(
      report.metadata.settlement_report_id,
      {},
      options,
    );
    const candidateId = created.pending_candidate.metadata.candidate_id;
    assert(
      created.pending_candidate.status.status === "candidate",
      "Pending candidate status was not candidate.",
    );
    assert(
      created.pending_candidate.risk_report.risk_level !== "critical",
      "Smoke candidate was unexpectedly critical.",
    );
    assert(created.pending_candidate.diff, "Pending candidate omitted diff.");
    assert(
      created.adopted_chapter.status.status === "settlement_candidate_created",
      "Adopted chapter did not reach settlement_candidate_created.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Candidate import changed active.");

    const approvalScan = await scanApprovalQueue(options);
    const activationItem = approvalScan.items.find(
      (item) => item.action_type === "activate_engine_candidate"
        && item.target_id === candidateId,
    );
    assert(activationItem, "Approval scan omitted activation item.");
    assert(activationItem.status.status === "pending", "Activation item was not pending.");
    const approvalCount = approvalScan.items.length;
    assert(
      (await scanApprovalQueue(options)).items.length === approvalCount,
      "Repeated approval scan created a duplicate item.",
    );

    await expectReject(
      () => confirmApprovalItem(activationItem.approval_item_id, {}, options),
      "Approval activation succeeded without confirmation.",
    );
    assert(
      sha256(await readFile(fixtureActive)) === initialFixtureHash,
      "Unconfirmed approval changed active engine.",
    );

    const confirmation = {
      confirm: true,
      approvedBy: "smoke_test",
      ...(activationItem.requires_second_confirmation
        ? { secondConfirm: true, approvalText: "確認啟用" }
        : {}),
    };
    const activated = await confirmApprovalItem(
      activationItem.approval_item_id,
      confirmation,
      options,
    );
    assert(activated.result.snapshot_id, "Approval activation omitted snapshot.");
    assert(activated.result.archive_id, "Approval activation omitted archive.");
    assert(
      activated.approval_item.status.status === "resolved",
      "Approval item was not resolved.",
    );
    assert(
      (await getPendingCandidate(candidateId, options)).status.status === "activated",
      "Candidate status was not activated.",
    );
    assert(
      sha256(await readFile(fixtureActive)) === activated.result.active_engine_after_hash,
      "Activated active engine hash was wrong.",
    );
    assert(
      (await listActivationLogs(options)).some(
        (entry) => entry.event === "activate_pending_engine_candidate",
      ),
      "Activation log omitted activation.",
    );

    const rolledBack = await rollbackActiveEngine(activated.result.snapshot_id, {
      confirm: true,
      approvedBy: "smoke_test",
    }, options);
    assert(rolledBack.safety_snapshot_id, "Rollback omitted safety snapshot.");
    assert(
      sha256(await readFile(fixtureActive)) === initialFixtureHash,
      "Rollback did not restore initial fixture active engine.",
    );
    assert(
      (await listActivationLogs(options)).some((entry) => entry.event === "rollback_active_engine"),
      "Activation log omitted rollback.",
    );

    const criticalText = activeText.split(/\r?\n/u).slice(0, 5).join("\n");
    const criticalCandidate = await importSettlementResult({
      rawText: settlement(criticalText),
      sourceChapter: "Phase 6A blocked fixture",
    }, options);
    assert(criticalCandidate.status.status === "blocked", "Critical candidate was not blocked.");
    const blockedScan = await scanApprovalQueue(options);
    const blockedItem = blockedScan.items.find(
      (item) => item.target_id === criticalCandidate.metadata.candidate_id,
    );
    assert(blockedItem?.status.status === "blocked", "Blocked candidate approval was not blocked.");
    await expectReject(
      () => confirmApprovalItem(blockedItem.approval_item_id, {
        confirm: true,
        approvedBy: "smoke_test",
      }, options),
      "Blocked candidate was confirmed.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Blocked confirm changed active.");

    const run = await createAgentRun({
      task_type: "test",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner"],
      input: "No neural success trace is created for this negative fixture.",
    });
    const neuralCandidate = await importSettlementResult({
      rawText: settlement(`${activeText}\n\n## Neural evidence fixture\n\n- Missing required trace.`),
      sourceChapter: "Phase 6A neural fixture",
      runId: run.run_id,
      requiresNeuralModules: true,
      neuralModulesUsedPath: `data/agent_runs/${run.run_id}/neural_modules_used.json`,
    }, options);
    const neuralScan = await scanApprovalQueue(options);
    const neuralItem = neuralScan.items.find(
      (item) => item.target_id === neuralCandidate.metadata.candidate_id
        && item.action_type === "neural_trace_missing",
    );
    assert(neuralItem?.status.status === "blocked", "Neural missing item was not blocked.");
    await expectReject(
      () => confirmApprovalItem(neuralItem.approval_item_id, {
        confirm: true,
        secondConfirm: true,
        approvalText: "確認啟用",
        approvedBy: "smoke_test",
      }, options),
      "Neural missing item was force-confirmed.",
    );
    assert(sha256(await readFile(fixtureActive)) === initialFixtureHash, "Neural confirm changed active.");

    const cleanupSourceId = "engine_candidate_20240101-000000-1234abcd";
    const cleanupSource = path.join(fixtureRejected, cleanupSourceId);
    await mkdir(cleanupSource, { recursive: true });
    await writeFile(path.join(cleanupSource, "candidate_engine.md"), "# Old rejected fixture\n");
    await writeJson(path.join(cleanupSource, "metadata.json"), {
      candidate_id: cleanupSourceId,
      imported_at: "2024-01-01T00:00:00.000Z",
      risk_level: "low",
    });
    await writeJson(path.join(cleanupSource, "status.json"), {
      status: "rejected",
      rejected_at: "2024-01-01T00:00:00.000Z",
    });
    const cleanupProposal = await createCleanupProposal({
      createdBy: "smoke_test",
      retentionPolicy: {
        keep_latest_archives: 10,
        keep_latest_snapshots: 10,
        rejected_candidate_days: 30,
        failed_candidate_days: 30,
        blocked_candidate_days: 30,
        trash_retention_days: 30,
      },
    }, options);
    const eligible = cleanupProposal.eligible_items.find(
      (item) => item.item_id === cleanupSourceId,
    );
    assert(eligible, "Cleanup proposal omitted eligible rejected candidate.");
    assert(
      !cleanupProposal.eligible_items.some(
        (item) => ["archive", "snapshot"].includes(item.item_type),
      ),
      "Protected archive or snapshot entered cleanup eligible items.",
    );
    await expectReject(
      () => approveCleanupProposal(cleanupProposal.cleanup_proposal_id, {}, options),
      "Cleanup proposal approved without confirmation.",
    );
    await approveCleanupProposal(cleanupProposal.cleanup_proposal_id, {
      confirm: true,
      approvedBy: "smoke_test",
    }, options);
    const cleanupExecution = await executeCleanupProposal(
      cleanupProposal.cleanup_proposal_id,
      { confirm: true, approvedBy: "smoke_test" },
      options,
    );
    const moved = cleanupExecution.moved_items.find((item) => item.item_id === cleanupSourceId);
    assert(moved, "Cleanup did not move eligible item.");
    await expectReject(
      () => stat(cleanupSource),
      "Cleanup source directory still exists.",
    );
    const trashDirectory = path.join(fixtureCleanup, "trash", moved.cleanup_trash_id);
    const trashMetadata = JSON.parse(
      await readFile(path.join(trashDirectory, "trash_metadata.json"), "utf8"),
    );
    const tombstone = JSON.parse(
      await readFile(
        path.join(fixtureCleanup, "tombstones", `${moved.cleanup_trash_id}.json`),
        "utf8",
      ),
    );
    assert(trashMetadata.restore_available === true, "Trash metadata disabled restore.");
    assert(tombstone.restore_available === true, "Cleanup tombstone disabled restore.");
    assert(
      tombstone.permanent_delete_allowed_after,
      "Cleanup tombstone omitted retention boundary.",
    );
    assert(
      (await listCleanupLogs(options)).some(
        (entry) => entry.event === "cleanup_item_moved_to_trash",
      ),
      "Cleanup log omitted move-to-trash.",
    );
    assert(
      sha256(await readFile(fixtureActive)) === initialFixtureHash,
      "Cleanup changed fixture active engine.",
    );
    assert(
      (await getAdoptedChapter(adoptedId, options)).status.status
        === "settlement_candidate_created",
      "Golden adopted chapter final status was wrong.",
    );
    assert(sha256(await readFile(projectPaths.activeEngine)) === productionHash, "Production active changed.");
    await assertProtectedStateUnchanged(protectedBefore);
    console.log("Full workflow smoke test passed.");
  } finally {
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    await Promise.all([
      rm(fixtureCanon, { recursive: true, force: true }),
      rm(fixtureWorkflow, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
      rm(fixtureCleanup, { recursive: true, force: true }),
    ]);
    await removeNew(projectPaths.agentRuns, agentRunsBefore);
    await removeNew(projectPaths.neuralTraces, neuralTracesBefore);
    await removeNew(transactionDir, transactionsBefore);
    assert(sha256(await readFile(projectPaths.activeEngine)) === productionHash, "Cleanup changed production active.");
    await assertProtectedStateUnchanged(protectedBefore);
    assert(
      JSON.stringify([...await names(projectPaths.pendingEngineCandidates)].sort())
        === JSON.stringify([...productionPendingBefore].sort()),
      "Smoke test polluted production pending candidates.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineSnapshots)].sort())
        === JSON.stringify([...productionSnapshotsBefore].sort()),
      "Smoke test polluted production snapshots.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineArchive)].sort())
        === JSON.stringify([...productionArchiveBefore].sort()),
      "Smoke test polluted production archive.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.approvalItems)].sort())
        === JSON.stringify([...productionApprovalBefore].sort()),
      "Smoke test polluted production approval queue.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.cleanupProposals)].sort())
        === JSON.stringify([...productionCleanupBefore].sort()),
      "Smoke test polluted production cleanup proposals.",
    );
  }
}

main().catch((error) => {
  console.error(`Full workflow smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
