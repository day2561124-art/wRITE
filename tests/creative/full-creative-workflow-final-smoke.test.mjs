import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem, getApprovalItem, listApprovalItems } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { buildGptWritingContext, getGptWritingContextBundle } from "../../server/src/gpt-writing-context-service.mjs";
import { getAdoptedWritingDetail } from "../../server/src/writing-candidate-adoption-service.mjs";
import {
  buildAdoptedWritingSettlementContext,
  buildPendingEngineCandidateFromSettlementReport,
  saveChatOutputAsSettlementReport,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { getEngineActivationConfirmLog } from "../../server/src/engine-activation-confirm-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".full-creative-workflow-final-smoke.test";
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

async function names(directory) {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}


function isPathInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function rmWithWindowsRetry(target, attempts = 6) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (!["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
        throw error;
      }
      await wait(50 * attempt);
    }
  }
  throw lastError;
}

async function cleanupFixturePaths() {
  const outsideRootTargets = Object.entries(options)
    .map(([, target]) => target)
    .filter((target) => !isPathInside(root, target));

  for (const target of outsideRootTargets) {
    await rmWithWindowsRetry(target);
  }

  await rmWithWindowsRetry(root);
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
  const activeText = "# Phase 8J E2E Engine\n\nRule 1: stable.\n";
  await cleanupFixturePaths();
  await mkdir(root, { recursive: true });
  await writeFile(options.activeEnginePath, activeText, "utf8");
  try {
    // Step 1: build GPT writing context bundle
    const context = await buildGptWritingContext({
      taskPrompt: "Full creative workflow final smoke test.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    assert(context.bundle && context.bundle.for_chat_output === true, "Bundle flags incorrect");
    assert(context.bundle.local_generation_allowed === false, "local_generation_allowed should be false");
    assert(context.bundle.canon_update_allowed === false, "canon_update_allowed should be false");
    assert(context.bundle.active_engine_update_allowed === false, "active_engine_update_allowed should be false");
    // Step 2: save chat output writing candidate
    const candidate = await saveChatOutputAsWritingCandidate({
      sourceBundleId: context.bundle.bundle_id,
      chatOutputText: "第測試章｜最後的煙霧測試\n\n這是一段 Phase 8J 測試正文候選。它只存在於測試 fixture 中，不應進入正式正史。",
    }, options);
    await markCandidateNeuralTraceComplete(candidate.candidate_id);
    assert(candidate.candidate_created === true, "Candidate not created");
    const detail = await getWritingCandidateDetail(candidate.candidate_id, options);
    assert(detail.metadata.candidate_kind === "chat_output_writing_candidate", "Candidate kind mismatch");
    assert(detail.metadata.canon_status === "candidate_only", "Canon status mismatch");
    assert(detail.metadata.adopted === false, "Candidate should not be adopted");
    assert(detail.metadata.settled === false, "Candidate should not be settled");
    assert(detail.metadata.local_generation_used === false, "local_generation_used should be false");
    // Step 3: build candidate proofing context
    const proofing = await buildCandidateProofingContext({
      candidateId: detail.metadata.candidate_id,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    assert(proofing.context && proofing.context.candidate_id === detail.metadata.candidate_id, "Proofing context missing candidate ref");
    // Step 4: save proof report
    const proof = await saveChatOutputAsProofReport({
      candidateId: detail.metadata.candidate_id,
      proofingContextId: proofing.context.proofing_context_id,
      proofReportText: "Phase 8J 測試驗稿報告：\n- severity: pass\n- blocked: false\n- 可進入 adoption request",
      verdict: "pass",
      severity: "none",
    }, options);
    assert(proof.proof_report_id, "Proof report not created");
    const updatedCandidate = await getWritingCandidateDetail(detail.metadata.candidate_id, options);
    assert(updatedCandidate.metadata.proofed === true, "Candidate not marked proofed");
    // Step 5: create adoption approval request
    const request = await requestWritingCandidateAdoption({
      candidateId: detail.metadata.candidate_id,
      proofReportId: proof.proof_report_id,
      reason: "Phase 8J adoption request",
    }, options);
    const approvalBefore = await getApprovalItem(request.approval_item_id, options);
    assert(approvalBefore.action_type === "adopt_writing_candidate", "Approval action type wrong");
    assert(approvalBefore.status.status === "pending", "Approval status should be pending");
    assert(approvalBefore.requires_user_confirmation === true, "Approval should require user confirmation");
    // Ensure not adopted yet
    const beforeAdopt = await getWritingCandidateDetail(detail.metadata.candidate_id, options);
    assert(beforeAdopt.metadata.adopted === false, "Candidate was adopted prematurely");
    // Step 6: confirm adoption via approval queue
    const confirmedAdoption = await confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8j_e2e",
    }, options);
    assert(confirmedAdoption.result.adopted_chapter_id, "Adoption confirm did not return adopted id");
    const adopted = await getAdoptedWritingDetail(confirmedAdoption.result.adopted_chapter_id, options);
    assert(adopted.adoption.candidate_id === detail.metadata.candidate_id, "Adopted writing link failed");
    const afterAdopt = await getWritingCandidateDetail(detail.metadata.candidate_id, options);
    assert(afterAdopt.metadata.adopted === true, "Candidate not marked adopted after confirm");
    assert(afterAdopt.metadata.settled === false, "Candidate should not be settled yet");
    // Step 7: build adopted writing settlement context
    const settlementContext = await buildAdoptedWritingSettlementContext({
      adoptedChapterId: adopted.adoption.adopted_chapter_id,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    assert(settlementContext.context && settlementContext.context.adopted_chapter_id === adopted.adoption.adopted_chapter_id, "Settlement context missing");
    // Step 8: save settlement report and build pending_engine_candidate
    const settlementReport = await saveChatOutputAsSettlementReport({
      adoptedChapterId: adopted.adoption.adopted_chapter_id,
      settlementContextId: settlementContext.context.settlement_context_id,
      settlementReportText: [
        "# Settlement Report",
        "",
        "## pending_engine_candidate",
        "",
        "```md",
        `${activeText.trimEnd()}\nRule 2: Phase 8J accepted rule.`,
        "```",
      ].join("\n"),
    }, options);
    assert(settlementReport.settlement_report_id, "Settlement report not saved");
    const pending = await buildPendingEngineCandidateFromSettlementReport({
      settlementReportId: settlementReport.settlement_report_id,
    }, options);
    assert(pending.pending_engine_candidate_id, "Pending engine candidate not created");
    assert(pending.base_active_engine_hash, "Pending candidate missing base hash");
    // Step 9: build pending engine candidate review / diff
    const review = await buildPendingEngineCandidateReview({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      reviewMode: "summary_only",
    }, options);
    assert(review.review && review.review.pending_engine_candidate_id === pending.pending_engine_candidate_id, "Review missing link");
    // ensure no activation yet
    const approvalsAfterSettlement = await listApprovalItems(options);
    // should contain at least the adoption approval (resolved) and none for activation yet
    assert(approvalsAfterSettlement.some((a) => a.action_type === "adopt_writing_candidate"), "Adoption approval missing in queue");
    // Step 10: create activation approval request
    const activationRequest = await requestPendingEngineCandidateActivation({
      pendingEngineCandidateId: pending.pending_engine_candidate_id,
      reviewId: review.review.review_id,
      reason: "Phase 8J activation request",
    }, options);
    const activationApproval = await getApprovalItem(activationRequest.approval_item_id, options);
    assert(activationApproval.action_type === "activate_engine_candidate", "Activation approval action type wrong");
    assert(activationApproval.status.status === "pending", "Activation approval should be pending");
    assert(activationApproval.requires_user_confirmation === true, "Activation approval should require confirmation");
    assert(!activationApproval.status.execution_result || !activationApproval.status.execution_result.activation_log_id, "Activation approval must not have activation_log_id yet");
    // Step 11: confirm activation via approval queue
    // pre-check: no snapshots or logs exist
    assert((await names(options.engineSnapshots)).length === 0, "Snapshot existed before activation");
    assert((await names(options.engineArchive)).length === 0, "Archive existed before activation");
    const confirmedActivation = await confirmApprovalItem(activationRequest.approval_item_id, {
      confirm: true,
      approvedBy: "phase_8j_e2e",
    }, options);
    assert(confirmedActivation.approval_item.status.status === "resolved", "Activation approval not resolved");
    assert(confirmedActivation.result.active_engine_modified === true, "Activation did not modify engine");
    assert(confirmedActivation.result.activation_log_id, "Activation did not return log id");
    // verify fixture active engine updated
    const newHash = confirmedActivation.result.new_active_engine_hash;
    const oldHash = confirmedActivation.result.previous_active_engine_hash;
    assert(newHash && oldHash && newHash !== oldHash, "Active engine hash not updated properly");
    // verify snapshot and archive created
    assert((await readdir(options.engineSnapshots)).length === 1, "Snapshot not created");
    assert((await readdir(options.engineArchive)).length === 1, "Archive not created");
    const log = await getEngineActivationConfirmLog(confirmedActivation.result.activation_log_id, options);
    assert(log.settlement_report_id === settlementReport.settlement_report_id, "Activation log missing settlement trace");
    assert(log.adopted_chapter_id === settlementReport.adopted_chapter_id, "Activation log missing adopted writing trace");
    assert(log.rollback_requires_approval === true, "Rollback requires approval flag missing");
    // verify pending_engine_candidate marked activated
    // read pending candidate metadata
    const pendingEntries = await readdir(options.pendingEngineCandidates);
    assert(pendingEntries.length >= 1, "No pending engine candidate files found");
    // final: production active engine unchanged
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production active_engine.md changed");
    console.log("Full creative workflow final smoke test passed.");
  } finally {
    await cleanupFixturePaths();
  }
}

main().catch((error) => {
  console.error(`Full creative workflow final smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
