import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CREATIVE_TASK_TYPES,
  getCreativeTaskStatus,
  listCreativeTaskTypes,
  runCreativeTask,
} from "../../server/src/creative-task-orchestrator-service.mjs";
import {
  adoptCandidateDraft,
  saveCandidateDraft,
  saveProofReport,
} from "../../server/src/writing-workflow-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".creative-task-test");
const fixtureActive = path.join(projectPaths.canonDb, ".creative-task-active-test.md");
const fixturePending = path.join(projectPaths.canonDb, ".creative-task-pending-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".creative-task-test");
const fixtureTasks = path.join(projectPaths.creativeTasks, ".creative-task-test");
const fixtureLog = path.join(projectPaths.outputLogs, ".creative-task-test-runs.jsonl");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

const options = {
  writingWorkflow: fixtureWorkflow,
  activeEnginePath: fixtureActive,
  pendingEngineCandidates: fixturePending,
  approvalQueue: fixtureApproval,
  creativeTasks: fixtureTasks,
  creativeTaskLog: fixtureLog,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

function settlement(candidateText) {
  return `## pending_engine_candidate\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const transactionsBefore = await names(transactionDir);
  const activeText = [
    "# Creative Task Test Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable fixture.`),
  ].join("\n") + "\n";

  await Promise.all([
    rm(fixtureWorkflow, { recursive: true, force: true }),
    rm(fixturePending, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
    rm(fixtureTasks, { recursive: true, force: true }),
    rm(fixtureLog, { force: true }),
  ]);
  await mkdir(path.dirname(fixtureActive), { recursive: true });
  await writeFile(fixtureActive, activeText, "utf8");

  try {
    assert(
      JSON.stringify(listCreativeTaskTypes()) === JSON.stringify(Object.values(CREATIVE_TASK_TYPES)),
      "Creative task type list drifted.",
    );

    const unknown = await runCreativeTask({ task_type: "unknown" }, options);
    assert(!unknown.ok && unknown.status === "blocked", "Unknown task type was not blocked.");

    const generated = await runCreativeTask({
      taskType: CREATIVE_TASK_TYPES.GENERATE_WRITING_CANDIDATE,
      taskPrompt: "Draft a quiet aftermath scene.",
      generationContext: { chapter: 12 },
      retrievalContext: { characters: ["A", "B"] },
      dryRun: true,
    }, options);
    assert(generated.ok && generated.status === "dry_run", "Generate dry-run failed.");
    assert(
      generated.result.execution === "not_executed",
      "Generate task unexpectedly executed a model.",
    );
    assert(
      (await getCreativeTaskStatus(generated.task_id, options)).task_id === generated.task_id,
      "Creative task status could not be read back.",
    );

    const draft = await saveCandidateDraft({
      draftText: "# Candidate\n\nA stable draft.",
      sourceChapter: "Creative test",
    }, options);
    const proofread = await runCreativeTask({
      task_type: CREATIVE_TASK_TYPES.PROOFREAD_WRITING_CANDIDATE,
      candidate_id: draft.metadata.draft_id,
    }, options);
    assert(proofread.ok && proofread.status === "pending", "Proofread task failed.");
    assert(
      proofread.result.proofing_context_bundle_id,
      "Proofread task did not create a proofing context bundle.",
    );

    const proof = await saveProofReport({
      draftId: draft.metadata.draft_id,
      proofText: "## P2: wording\nPolish one sentence.",
    }, options);
    const adoption = await runCreativeTask({
      task_type: CREATIVE_TASK_TYPES.REQUEST_ADOPT_WRITING_CANDIDATE,
      candidate_id: draft.metadata.draft_id,
      reason: "Ready for human review.",
    }, options);
    assert(adoption.ok && adoption.status === "pending", "Adoption request was not pending.");
    assert(adoption.result.approval_item_id, "Adoption request did not create approval item.");
    assert(proof.metadata.proof_id, "Proof fixture was not created.");

    const settlementDraft = await saveCandidateDraft({
      draftText: "# Adopted Candidate\n\nA settled draft.",
      sourceChapter: "Settlement creative test",
    }, options);
    const adopted = await adoptCandidateDraft(
      settlementDraft.metadata.draft_id,
      { confirm: true, adoptedBy: "creative_task_test" },
      options,
    );
    const settlementTask = await runCreativeTask({
      task_type: CREATIVE_TASK_TYPES.BUILD_SETTLEMENT_CANDIDATE,
      adopted_chapter_id: adopted.metadata.adopted_chapter_id,
    }, options);
    assert(settlementTask.ok && settlementTask.status === "pending", "Settlement task failed.");
    assert(
      settlementTask.result.settlement_context_id,
      "Settlement task did not create a settlement context.",
    );
    assert(
      settlementTask.result.pending_engine_candidate_id === null,
      "Settlement task unexpectedly created an engine candidate.",
    );

    const candidate = await importSettlementResult({
      rawText: settlement(`${activeText.trimEnd()}\nRule 31: pending only.`),
      sourceChapter: "Creative activation test",
    }, options);
    const activation = await runCreativeTask({
      task_type: CREATIVE_TASK_TYPES.REQUEST_ENGINE_ACTIVATION,
      pending_engine_candidate_id: candidate.metadata.candidate_id,
      reason: "Review this candidate.",
    }, options);
    assert(activation.result.approval_item_id, "Activation request did not create approval item.");
    assert(
      activation.safety.can_activate_engine === false,
      "Activation request exposed activation permission.",
    );

    const queue = await runCreativeTask({
      task_type: CREATIVE_TASK_TYPES.QUERY_APPROVAL_QUEUE,
      status: "pending",
      limit: 20,
    }, options);
    assert(queue.ok && queue.status === "completed", "Approval queue query failed.");
    assert(queue.result.count >= 2, "Approval queue query omitted created requests.");

    const logLines = (await readFile(fixtureLog, "utf8"))
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert(logLines.length >= 7, "Creative task JSONL log omitted task runs.");
    assert(
      hash(await readFile(fixtureActive)) === hash(activeText),
      "Creative tasks modified the fixture active engine.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Creative tasks modified the production active engine.",
    );
    console.log("Creative task orchestrator service test passed.");
  } finally {
    await Promise.all([
      rm(fixtureWorkflow, { recursive: true, force: true }),
      rm(fixtureActive, { force: true }),
      rm(fixturePending, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
      rm(fixtureTasks, { recursive: true, force: true }),
      rm(fixtureLog, { force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Creative task test cleanup modified active_engine.md.",
    );
  }
}

main().catch((error) => {
  console.error(`Creative task orchestrator service test failed: ${error.message}`);
  process.exitCode = 1;
});
