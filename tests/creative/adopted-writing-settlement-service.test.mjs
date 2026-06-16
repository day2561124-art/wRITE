import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  getAdoptedWritingSettlementContext,
  getSettlementReportDetail,
  listAdoptedWritingSettlementContexts,
  listSettlementReports,
  saveChatOutputAsSettlementReport,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { getAdoptedWritingDetail } from "../../server/src/writing-candidate-adoption-service.mjs";

const suffix = ".adopted-settlement-service-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  activeEnginePath,
};
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

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

const REQUIRED_NEURAL_MODULES = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
];

async function markCandidateNeuralTraceComplete(candidateId) {
  const metaPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.missing_required_neural_modules = [];
  meta.neural_trace_complete = true;
  meta.neural_modules_used = REQUIRED_NEURAL_MODULES;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function createAdoptedWriting() {
  const candidate = await saveChatOutputAsWritingCandidate({
    chatOutputText: "# Adopted Chapter\n\nA stable adopted chapter.",
  }, options);
  await markCandidateNeuralTraceComplete(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidateId: candidate.candidate_id,
    proofReportText: "Pass.",
    verdict: "pass",
    severity: "none",
  }, options);
  const request = await requestWritingCandidateAdoption({
    candidateId: candidate.candidate_id,
    proofReportId: proof.proof_report_id,
  }, options);
  const confirmed = await confirmApprovalItem(request.approval_item_id, {
    confirm: true,
    approvedBy: "settlement_service_test",
  }, options);
  return { candidate, adoptedChapterId: confirmed.result.adopted_chapter_id };
}

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  const activeText = [
    "# Settlement Fixture Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable fixture.`),
  ].join("\n") + "\n";
  for (const directory of Object.values(options).filter((value) => value !== activeEnginePath)) {
    await rm(directory, { recursive: true, force: true });
  }
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeText, "utf8");

  try {
    const { candidate, adoptedChapterId } = await createAdoptedWriting();
    const context = await buildAdoptedWritingSettlementContext({
      adopted_chapter_id: adoptedChapterId,
      include_active_engine: true,
      include_writing_card: false,
      include_proofing_card: false,
      include_longline: false,
      settlement_mode: "full",
    }, options);
    assert(
      context.context.context_kind === "adopted_writing_settlement_context",
      "Context kind is wrong.",
    );
    assert(context.context.for_chat_output === true, "Context is not chat-facing.");
    assert(context.context.local_generation_allowed === false, "Local generation was allowed.");
    assert(context.context.active_engine_modified === false, "Context modified active engine.");
    assert(
      context.settlement_for_chat_path.endsWith("/settlement_for_chat.md"),
      "Chat context path is wrong.",
    );
    const readContext = await getAdoptedWritingSettlementContext(
      context.context.settlement_context_id,
      options,
    );
    assert(
      readContext.settlement_for_chat.includes("## pending_engine_candidate"),
      "Chat instructions omitted pending candidate format.",
    );
    assert(
      (await listAdoptedWritingSettlementContexts({
        adopted_chapter_id: adoptedChapterId,
      }, options)).length === 1,
      "Context list failed.",
    );
    const dryReport = await saveChatOutputAsSettlementReport({
      adopted_chapter_id: adoptedChapterId,
      settlement_context_id: context.context.settlement_context_id,
      settlement_report_text: "Dry report.",
      dry_run: true,
    }, options);
    assert(dryReport.dry_run && !dryReport.settlement_report_created, "Report dry-run wrote.");

    const proposedEngine = `${activeText.trimEnd()}\nRule 31: preserve adopted chapter fact.`;
    const report = await saveChatOutputAsSettlementReport({
      adopted_chapter_id: adoptedChapterId,
      settlement_context_id: context.context.settlement_context_id,
      settlement_report_text: [
        "# Settlement Report",
        "",
        "## Chapter Facts",
        "The chapter was adopted.",
        "",
        "## pending_engine_candidate",
        "",
        "```md",
        proposedEngine,
        "```",
      ].join("\n"),
      summary: "Adopted chapter settlement.",
    }, options);
    const reportDetail = await getSettlementReportDetail(report.settlement_report_id, {
      ...options,
      includeContent: true,
    });
    assert(
      reportDetail.metadata.report_kind
        === "chat_output_adopted_writing_settlement_report",
      "Report kind is wrong.",
    );
    assert(
      reportDetail.metadata.pending_engine_candidate_created === false,
      "Report created a candidate automatically.",
    );
    assert(
      (await listSettlementReports({ adopted_chapter_id: adoptedChapterId }, options)).length === 1,
      "Report list failed.",
    );
    const pending = await buildPendingEngineCandidateFromSettlementReport({
      settlement_report_id: report.settlement_report_id,
      reason: "Service test.",
    }, options);
    assert(pending.pending_engine_candidate_created, "Pending candidate was not created.");
    assert(pending.settlement_status === "pending_review", "Candidate is not pending review.");
    assert(pending.activation_requested === false, "Activation was requested.");
    assert(pending.approval_item_created === false, "Approval item was created.");
    const adopted = await getAdoptedWritingDetail(adoptedChapterId, options);
    assert(
      adopted.adoption.latest_pending_engine_candidate_id
        === pending.pending_engine_candidate_id,
      "Adopted writing metadata was not linked.",
    );
    assert(adopted.adoption.settled === false, "Adopted writing was marked settled.");
    const updatedCandidate = await getWritingCandidateDetail(candidate.candidate_id, options);
    assert(
      updatedCandidate.metadata.settlement_status === "pending_engine_candidate",
      "Writing candidate metadata was not updated.",
    );
    assert(
      hash(await readFile(activeEnginePath)) === hash(activeText),
      "Fixture active engine changed.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Production active engine changed.",
    );
    console.log("Adopted writing settlement service test passed.");
  } finally {
    await Promise.all([
      ...Object.values(options)
        .filter((value) => value !== activeEnginePath)
        .map((directory) => rm(directory, { recursive: true, force: true })),
      rm(activeEnginePath, { force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Adopted writing settlement service test failed: ${error.message}`);
  process.exitCode = 1;
});
