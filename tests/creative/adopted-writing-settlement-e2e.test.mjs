import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  saveChatOutputAsSettlementReport,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import { confirmApprovalItem, listApprovalItems } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".adopted-settlement-e2e-test";
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
    "# E2E Active Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable.`),
  ].join("\n") + "\n";
  await Promise.all(Object.values(options)
    .filter((value) => value !== activeEnginePath)
    .map((directory) => rm(directory, { recursive: true, force: true })));
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeText, "utf8");
  try {
    const writingContext = await buildGptWritingContext({
      taskPrompt: "Write Phase 8G E2E chapter.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const candidate = await saveChatOutputAsWritingCandidate({
      sourceBundleId: writingContext.bundle.bundle_id,
      chatOutputText: "# Phase 8G Chapter\n\nThe accepted scene.",
    }, options);
    const proofing = await buildCandidateProofingContext({
      candidateId: candidate.candidate_id,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const proof = await saveChatOutputAsProofReport({
      candidateId: candidate.candidate_id,
      proofingContextId: proofing.context.proofing_context_id,
      proofReportText: "Pass.",
      verdict: "pass",
      severity: "none",
    }, options);
    const adoptionRequest = await requestWritingCandidateAdoption({
      candidateId: candidate.candidate_id,
      proofReportId: proof.proof_report_id,
    }, options);
    const confirmed = await confirmApprovalItem(adoptionRequest.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8g_e2e",
    }, options);
    const adoptedChapterId = confirmed.result.adopted_chapter_id;
    const settlementContext = await buildAdoptedWritingSettlementContext({
      adoptedChapterId,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const report = await saveChatOutputAsSettlementReport({
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
      settlementReportId: report.settlement_report_id,
    }, options);
    assert(pending.pending_engine_candidate_id, "E2E pending candidate was not created.");
    assert(pending.activation_approval_item_id === null, "Activation approval was created.");
    const approvals = await listApprovalItems(options);
    assert(
      approvals.length === 1 && approvals[0].action_type === "adopt_writing_candidate",
      "E2E created an unexpected approval item.",
    );
    assert(
      hash(await readFile(activeEnginePath)) === hash(activeText),
      "E2E fixture active engine changed.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "E2E production active engine changed.",
    );
    console.log("Adopted writing settlement E2E test passed.");
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
  console.error(`Adopted writing settlement E2E test failed: ${error.message}`);
  process.exitCode = 1;
});
