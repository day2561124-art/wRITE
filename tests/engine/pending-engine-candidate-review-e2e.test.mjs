import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  saveChatOutputAsSettlementReport,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import { confirmApprovalItem, getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { getPendingCandidate } from "../../server/src/engine-candidate-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".engine-review-e2e-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
  engineSnapshots: path.join(projectPaths.engineSnapshots, suffix),
  engineArchive: path.join(projectPaths.engineArchive, suffix),
  activationLog: path.join(projectPaths.activationLogs, `${suffix}.jsonl`),
  rollbackIndex: path.join(projectPaths.rollback, `${suffix}.json`),
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

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  const activeText = [
    "# Phase 8H E2E Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable.`),
  ].join("\n") + "\n";
  await Promise.all(Object.entries(options)
    .filter(([key]) => key !== "activeEnginePath")
    .map(([, target]) => rm(target, { recursive: true, force: true })));
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeText, "utf8");
  try {
    const context = await buildGptWritingContext({
      taskPrompt: "Write Phase 8H E2E chapter.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const writing = await saveChatOutputAsWritingCandidate({
      sourceBundleId: context.bundle.bundle_id,
      chatOutputText: "# Phase 8H Chapter\n\nAccepted scene.",
    }, options);
    const proofing = await buildCandidateProofingContext({
      candidateId: writing.candidate_id,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const proof = await saveChatOutputAsProofReport({
      candidateId: writing.candidate_id,
      proofingContextId: proofing.context.proofing_context_id,
      proofReportText: "Pass.",
      verdict: "pass",
      severity: "none",
    }, options);
    const adoptionRequest = await requestWritingCandidateAdoption({
      candidateId: writing.candidate_id,
      proofReportId: proof.proof_report_id,
    }, options);
    const adopted = await confirmApprovalItem(adoptionRequest.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8h_e2e",
    }, options);
    const adoptedChapterId = adopted.result.adopted_chapter_id;
    const settlementContext = await buildAdoptedWritingSettlementContext({
      adoptedChapterId,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const settlementReport = await saveChatOutputAsSettlementReport({
      adoptedChapterId,
      settlementContextId: settlementContext.context.settlement_context_id,
      settlementReportText: [
        "# Settlement Report",
        "",
        "## pending_engine_candidate",
        "",
        "```md",
        `${activeText.trimEnd()}\nRule 31: accepted scene remains canon.`,
        "```",
      ].join("\n"),
    }, options);
    const pending = await buildPendingEngineCandidateFromSettlementReport({
      settlementReportId: settlementReport.settlement_report_id,
    }, options);
    const review = await buildPendingEngineCandidateReview({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      includeSettlementReport: true,
      includeSourceAdoptedWriting: true,
    }, options);
    const activationRequest = await requestPendingEngineCandidateActivation({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      reviewId: review.review.review_id,
      reason: "E2E user explicitly requested activation review.",
    }, options);
    const approval = await getApprovalItem(activationRequest.approval_item_id, options);
    assert(approval.status.status === "pending", "Activation approval is not pending.");
    assert(approval.action_type === "activate_engine_candidate", "Action type is wrong.");
    const candidate = await getPendingCandidate(pending.pending_engine_candidate_id, options);
    assert(candidate.status.status === "candidate", "Candidate was activated.");
    assert(candidate.status.review_status === "pending_review", "Candidate left pending review.");
    assert(candidate.metadata.activation_requested === true, "Request metadata missing.");
    assert((await names(options.engineSnapshots)).size === 0, "Snapshot was created.");
    assert((await names(options.engineArchive)).size === 0, "Archive was created.");
    assert((await names(path.dirname(options.activationLog))).has(path.basename(options.activationLog)) === false, "Activation log was created.");
    assert(hash(await readFile(activeEnginePath)) === hash(activeText), "Fixture engine changed.");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production engine changed.");
    console.log("Pending engine candidate review E2E test passed.");
  } finally {
    await Promise.all([
      rm(activeEnginePath, { force: true }),
      ...Object.entries(options)
        .filter(([key]) => key !== "activeEnginePath")
        .map(([, target]) => rm(target, { recursive: true, force: true })),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Pending engine candidate review E2E test failed: ${error.message}`);
  process.exitCode = 1;
});
