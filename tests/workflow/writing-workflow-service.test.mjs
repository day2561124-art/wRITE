import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adoptCandidateDraft,
  archiveCandidateDraft,
  buildDraftContextBundle,
  createDraftTask,
  getAdoptedChapter,
  getCandidateDraft,
  getProofReport,
  listAdoptedChapters,
  listCandidateDrafts,
  listProofReports,
  parseProofReportIssues,
  rejectCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
  sendDraftToProofing,
} from "../../server/src/writing-workflow-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(projectPaths.writingWorkflow, ".writing-workflow-test");
const fixtureActive = path.join(projectPaths.canonDb, ".writing-workflow-active-test.md");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
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
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const pendingBefore = await names(projectPaths.pendingEngineCandidates);
  const snapshotsBefore = await names(projectPaths.engineSnapshots);
  const archiveBefore = await names(projectPaths.engineArchive);
  const activationLogsBefore = await names(projectPaths.activationLogs);
  const transactionsBefore = await names(transactionDir);
  const agentRunsBefore = await names(projectPaths.agentRuns);
  const activeText = "# Workflow Test Engine\n\n- Canon remains read-only in Phase 4A.\n";
  const options = {
    writingWorkflow: fixtureRoot,
    activeEnginePath: fixtureActive,
  };
  await rm(fixtureRoot, { recursive: true, force: true });
  await mkdir(path.dirname(fixtureActive), { recursive: true });
  await writeFile(fixtureActive, activeText, "utf8");

  try {
    const draftContext = await buildDraftContextBundle({
      sourceChapter: "第二十章",
      task: "建立正文候選。",
    }, options);
    assert(draftContext.context_bundle.status === "ready", "Draft context bundle was not ready.");
    assert(
      draftContext.source_manifest.sources.some(
        (source) => source.label === "active_engine" && source.exists,
      ),
      "Draft context manifest omitted active_engine.",
    );

    const task = await createDraftTask({
      sourceChapter: "第二十章",
      task: "正文任務",
      requiresNeuralModules: true,
      requiredNeuralModules: ["scene_planner"],
    }, options);
    assert(task.run.task_type === "draft_generation", "Draft task did not create a draft run.");
    assert(task.run.requires_neural_modules, "Draft run lost neural requirement.");

    const saved = await saveCandidateDraft({
      draftText: "第二十章正文候選。\n\n角色在醫療後座整理傷勢。",
      sourceChapter: "第二十章｜醫療後座",
      note: "workflow test",
      runId: task.run.run_id,
      contextBundleId: task.context_bundle.context_bundle_id,
      neuralModulesUsedPath: `data/agent_runs/${task.run.run_id}/neural_modules_used.json`,
    }, options);
    const draftId = saved.metadata.draft_id;
    assert(saved.status.status === "candidate", "Draft initial status was not candidate.");
    assert(saved.metadata.canon_status === "candidate", "Draft canon status was not candidate.");
    assert(saved.neural_usage.used_neural_network === false, "Text-only run became neural success.");
    for (const file of ["draft.md", "metadata.json", "status.json", "neural_modules_used.json"]) {
      assert(
        await readFile(path.join(fixtureRoot, "candidate_drafts", draftId, file)),
        `Draft file missing: ${file}`,
      );
    }
    assert(
      (await listCandidateDrafts(options)).some((draft) => draft.draft_id === draftId),
      "Draft list omitted saved draft.",
    );
    assert(
      (await getCandidateDraft(draftId, options)).draft_text.includes("醫療後座"),
      "Draft detail returned wrong content.",
    );

    const proofing = await sendDraftToProofing(draftId, {
      requiresNeuralModules: false,
    }, options);
    assert(proofing.run.task_type === "proofing", "Proofing did not create a proofing run.");
    assert(proofing.draft.status.status === "proofing", "Draft status was not proofing.");
    assert(proofing.context_bundle.task_type === "proofing", "Proofing context type was wrong.");

    const issueSummary = parseProofReportIssues([
      "## P0 正史衝突｜角色狀態錯誤｜重寫",
      "[P1] 關係越界｜尚未成立｜撤回",
      "【P2】 節奏過快",
      "### P3 對話可改善",
      "P4 標點問題",
    ].join("\n"));
    assert(issueSummary.p0_count === 1, "P0 count was wrong.");
    assert(issueSummary.p1_count === 1, "P1 count was wrong.");
    assert(issueSummary.p2_count === 1, "P2 count was wrong.");
    assert(issueSummary.p3_count === 1, "P3 count was wrong.");
    assert(issueSummary.p4_count === 1, "P4 count was wrong.");
    assert(!issueSummary.can_adopt_recommendation, "P0/P1 report recommended adoption.");

    const proof = await saveProofReport({
      draftId,
      proofText: "## P0 正史衝突\n\n### P2 節奏問題\n",
      runId: proofing.run.run_id,
      contextBundleId: proofing.context_bundle.context_bundle_id,
      neuralModulesUsedPath: `data/agent_runs/${proofing.run.run_id}/neural_modules_used.json`,
    }, options);
    const proofId = proof.metadata.proof_id;
    assert(proof.issue_summary.p0_count === 1, "Saved proof did not count P0.");
    assert(!proof.issue_summary.can_adopt_recommendation, "Saved P0 proof recommended adoption.");
    assert(
      (await getCandidateDraft(draftId, options)).status.status === "proofed",
      "Proof report did not move draft to proofed.",
    );
    assert(
      (await listProofReports(options)).some((report) => report.proof_id === proofId),
      "Proof list omitted report.",
    );
    assert(
      (await getProofReport(proofId, options)).proof_text.includes("正史衝突"),
      "Proof detail returned wrong content.",
    );

    const cleanSummary = parseProofReportIssues("## P2 節奏\n\n### P4 標點");
    assert(cleanSummary.can_adopt_recommendation, "P2/P4-only proof blocked adoption.");

    await expectReject(
      () => adoptCandidateDraft(draftId, {}, options),
      "Draft was adopted without confirmation.",
    );
    const adopted = await adoptCandidateDraft(draftId, {
      confirm: true,
      adoptedBy: "workflow_test",
      note: "P0 acknowledged manually.",
    }, options);
    const adoptedId = adopted.metadata.adopted_chapter_id;
    assert(
      adopted.status.status === "accepted_pending_settlement",
      "Adopted chapter status was not accepted_pending_settlement.",
    );
    assert(adopted.status.can_create_settlement, "Adopted chapter cannot create settlement.");
    assert(adopted.metadata.canon_status === "adopted_pending_settlement", "Adopted canon status was wrong.");
    assert(adopted.metadata.warning, "P0 adoption did not preserve warning.");
    assert(
      (await getCandidateDraft(draftId, options)).status.status === "accepted_pending_settlement",
      "Draft status was not accepted_pending_settlement.",
    );
    assert(
      (await listAdoptedChapters(options)).some((chapter) => chapter.adopted_chapter_id === adoptedId),
      "Adopted chapter list omitted chapter.",
    );
    assert(
      (await getAdoptedChapter(adoptedId, options)).chapter_text.includes("正文候選"),
      "Adopted chapter content was wrong.",
    );

    const rejectedDraft = await saveCandidateDraft({
      draftText: "將被退稿的候選。",
      sourceChapter: "第二十章 B",
    }, options);
    await rejectCandidateDraft(rejectedDraft.metadata.draft_id, { reason: "不採用" }, options);
    await expectReject(
      () => adoptCandidateDraft(rejectedDraft.metadata.draft_id, { confirm: true }, options),
      "Rejected draft was adopted.",
    );
    await expectReject(
      () => sendDraftToProofing(rejectedDraft.metadata.draft_id, {}, options),
      "Rejected draft was sent to proofing.",
    );

    const archivedDraft = await saveCandidateDraft({
      draftText: "將被封存的候選。",
      sourceChapter: "第二十章 C",
    }, options);
    await archiveCandidateDraft(archivedDraft.metadata.draft_id, { reason: "封存" }, options);
    await expectReject(
      () => adoptCandidateDraft(archivedDraft.metadata.draft_id, { confirm: true }, options),
      "Archived draft was adopted.",
    );
    await expectReject(
      () => sendDraftToProofing(archivedDraft.metadata.draft_id, {}, options),
      "Archived draft was sent to proofing.",
    );

    assert(hash(await readFile(fixtureActive)) === hash(activeText), "Fixture active engine changed.");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production active engine changed.");
    assert(
      JSON.stringify([...await names(projectPaths.pendingEngineCandidates)].sort())
        === JSON.stringify([...pendingBefore].sort()),
      "Phase 4A created a pending engine candidate.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineSnapshots)].sort())
        === JSON.stringify([...snapshotsBefore].sort()),
      "Phase 4A changed engine snapshots.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineArchive)].sort())
        === JSON.stringify([...archiveBefore].sort()),
      "Phase 4A changed engine archive.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.activationLogs)].sort())
        === JSON.stringify([...activationLogsBefore].sort()),
      "Phase 4A changed activation logs.",
    );
    console.log("Writing workflow service test passed.");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(fixtureActive, { force: true });
    await removeNew(projectPaths.agentRuns, agentRunsBefore);
    await removeNew(transactionDir, transactionsBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Cleanup changed active engine.");
  }
}

main().catch((error) => {
  console.error(`Writing workflow service test failed: ${error.message}`);
  process.exitCode = 1;
});
