import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { getEngineActivationConfirmLog } from "../../server/src/engine-activation-confirm-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  saveChatOutputAsSettlementReport,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".engine-activation-confirm-e2e-test";
const root = path.join(projectPaths.canonDb, suffix);
const options = {
  activeEnginePath: path.join(root, "active_engine.md"),
  pendingEngineCandidates: path.join(root, "pending"),
  engineSnapshots: path.join(root, "snapshots"),
  engineArchive: path.join(root, "archive"),
  activationLog: path.join(root, "logs", "activation.jsonl"),
  rollbackIndex: path.join(root, "rollback", "index.json"),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
  settlementContexts: path.join(projectPaths.adoptedWritingSettlementContexts, suffix),
  settlementReports: path.join(projectPaths.adoptedWritingSettlementReports, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function safeRm(target) {
  const retryable = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(target, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      return;
    } catch (error) {
      if (!retryable.has(error.code) || attempt === 7) {
        throw error;
      }
      await sleep(100 * (attempt + 1));
    }
  }
}

async function cleanupTestPaths() {
  await safeRm(root);
  for (const [key, target] of Object.entries(options)) {
    if (key === "activeEnginePath") continue;
    if (target === root || isInside(root, target)) continue;
    await safeRm(target);
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

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const activeText = "# Phase 8I E2E Engine\n\nRule 1: stable.\n";
  await cleanupTestPaths();
  await mkdir(root, { recursive: true });
  await writeFile(options.activeEnginePath, activeText, "utf8");
  try {
    const writingContext = await buildGptWritingContext({
      taskPrompt: "Write Phase 8I E2E chapter.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const writing = await saveChatOutputAsWritingCandidate({
      sourceBundleId: writingContext.bundle.bundle_id,
      chatOutputText: "# Phase 8I Chapter\n\nAccepted scene.",
    }, options);
    await markCandidateNeuralTraceComplete(writing.candidate_id);
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
    const adoption = await confirmApprovalItem(adoptionRequest.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8i_e2e",
    }, options);
    const adoptedChapterId = adoption.result.adopted_chapter_id;
    const context = await buildAdoptedWritingSettlementContext({
      adoptedChapterId,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const settlement = await saveChatOutputAsSettlementReport({
      adoptedChapterId,
      settlementContextId: context.context.settlement_context_id,
      settlementReportText: [
        "# Settlement Report",
        "",
        "## pending_engine_candidate",
        "",
        "```md",
        `${activeText.trimEnd()}\nRule 2: confirmed activation.`,
        "```",
      ].join("\n"),
    }, options);
    const pending = await buildPendingEngineCandidateFromSettlementReport({
      settlementReportId: settlement.settlement_report_id,
    }, options);
    const review = await buildPendingEngineCandidateReview({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      reviewMode: "summary_only",
    }, options);
    const request = await requestPendingEngineCandidateActivation({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      reviewId: review.review.review_id,
      reason: "Phase 8I E2E explicit confirmation.",
    }, options);
    assert(hash(await readFile(options.activeEnginePath)) === hash(activeText), "Request changed engine.");
    const confirmed = await confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8i_e2e",
    }, options);
    assert(confirmed.approval_item.status.status === "resolved", "Approval was not resolved.");
    assert(confirmed.result.active_engine_modified === true, "Activation result is incomplete.");
    assert((await readdir(options.engineSnapshots)).length === 1, "Snapshot was not created.");
    assert((await readdir(options.engineArchive)).length === 1, "Archive was not created.");
    const log = await getEngineActivationConfirmLog(confirmed.result.activation_log_id, options);
    assert(log.settlement_report_id === settlement.settlement_report_id, "Settlement trace is missing.");
    assert(log.adopted_chapter_id === settlement.adopted_chapter_id, "Adopted writing trace is missing.");
    assert(log.rollback_requires_approval === true, "Rollback is not approval-gated.");
    assert(
      hash(await readFile(options.activeEnginePath)) === confirmed.result.new_active_engine_hash,
      "Active engine hash does not match activation result.",
    );
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production engine changed.");
    console.log("Engine activation confirm E2E test passed.");
  } finally {
    await cleanupTestPaths();
  }
}

main().catch((error) => {
  console.error(`Engine activation confirm E2E test failed: ${error.message}`);
  process.exitCode = 1;
});
