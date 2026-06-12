import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getApprovalItem, listApprovalItems } from "../../server/src/approval-queue-service.mjs";
import { getPendingCandidate, importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import {
  buildPendingEngineCandidateReview,
  getPendingEngineCandidateReview,
  listPendingEngineCandidateReviews,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".engine-review-service-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  activeEnginePath,
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  engineSnapshots: path.join(projectPaths.engineSnapshots, suffix),
  engineArchive: path.join(projectPaths.engineArchive, suffix),
  activationLog: path.join(projectPaths.activationLogs, `${suffix}.jsonl`),
  rollbackIndex: path.join(projectPaths.rollback, `${suffix}.json`),
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

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function createPhase8gCandidate(activeText) {
  const imported = await importSettlementResult({
    rawText: [
      "# Settlement Report",
      "",
      "## pending_engine_candidate",
      "",
      "```md",
      `${activeText.trimEnd()}\nRule 31: pending review addition.`,
      "```",
    ].join("\n"),
    sourceChapter: "Phase 8H service test",
  }, options);
  const candidateId = imported.metadata.candidate_id;
  const directory = path.join(options.pendingEngineCandidates, candidateId);
  const metadataPath = path.join(directory, "metadata.json");
  const statusPath = path.join(directory, "status.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  await Promise.all([
    writeFile(metadataPath, `${JSON.stringify({
      ...metadata,
      candidate_kind: "settlement_pending_engine_candidate",
      source: "adopted_writing_settlement_service",
      settlement_report_id: "settlement_report_20260612-000000-1234abcd",
      settlement_context_id: "settlement_ctx_20260612-000000-1234abcd",
      adopted_chapter_id: "adopted_chapter_20260612-000000-1234abcd",
      base_active_engine_hash: hash(activeText),
      review_status: "pending_review",
      activation_requested: false,
      active_engine_modified: false,
    }, null, 2)}\n`, "utf8"),
    writeFile(statusPath, `${JSON.stringify({
      ...status,
      review_status: "pending_review",
      settlement_status: "pending_review",
      activation_requested: false,
      active_engine_modified: false,
    }, null, 2)}\n`, "utf8"),
  ]);
  return candidateId;
}

async function main() {
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  const activeText = [
    "# Phase 8H Fixture Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable fixture.`),
  ].join("\n") + "\n";
  await Promise.all([
    rm(options.pendingEngineCandidates, { recursive: true, force: true }),
    rm(options.engineCandidateReviews, { recursive: true, force: true }),
    rm(options.approvalQueue, { recursive: true, force: true }),
    rm(options.engineSnapshots, { recursive: true, force: true }),
    rm(options.engineArchive, { recursive: true, force: true }),
    rm(options.activationLog, { force: true }),
    rm(options.rollbackIndex, { force: true }),
  ]);
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeText, "utf8");

  try {
    const candidateId = await createPhase8gCandidate(activeText);
    const review = await buildPendingEngineCandidateReview({
      pending_engine_candidate_id: candidateId,
      include_settlement_report: false,
      include_source_adopted_writing: false,
    }, options);
    assert(
      review.review.review_kind === "pending_engine_candidate_review",
      "Review kind is wrong.",
    );
    assert(review.review.active_engine_modified === false, "Review modified active engine.");
    assert(
      review.review.engine_activation_requested === false,
      "Review requested activation.",
    );
    assert(review.review.can_activate_directly === false, "Review allows direct activation.");
    assert(await exists(path.join(options.engineCandidateReviews, review.review.review_id, "review_for_ui.md")), "Review UI Markdown missing.");
    assert(await exists(path.join(options.engineCandidateReviews, review.review.review_id, "diff.md")), "Diff Markdown missing.");
    const detail = await getPendingEngineCandidateReview(review.review.review_id, options);
    assert(detail.review_for_ui === null, "Detail included content by default.");
    assert(
      (await listPendingEngineCandidateReviews({
        pending_engine_candidate_id: candidateId,
      }, options)).length === 1,
      "Review list failed.",
    );
    let missingBlocked = false;
    try {
      await buildPendingEngineCandidateReview({
        pending_engine_candidate_id: "engine_candidate_20260612-000000-deadbeef",
      }, options);
    } catch {
      missingBlocked = true;
    }
    assert(missingBlocked, "Missing candidate was not blocked.");

    const dryRun = await requestPendingEngineCandidateActivation({
      pending_engine_candidate_id: candidateId,
      review_id: review.review.review_id,
      dry_run: true,
    }, options);
    assert(dryRun.dry_run && !dryRun.approval_item_created, "Dry-run created approval.");
    assert((await listApprovalItems(options)).length === 0, "Dry-run persisted approval item.");

    const request = await requestPendingEngineCandidateActivation({
      pending_engine_candidate_id: candidateId,
      review_id: review.review.review_id,
      reason: "Ready for human activation review.",
    }, options);
    const approval = await getApprovalItem(request.approval_item_id, options);
    assert(approval.action_type === "activate_engine_candidate", "Approval action type is wrong.");
    assert(approval.status.status === "pending", "Approval item is not pending.");
    assert(approval.requires_user_confirmation === true, "Approval confirmation is not required.");
    assert(
      approval.can_execute_without_user_confirmation === false,
      "Approval can execute without confirmation.",
    );
    const candidate = await getPendingCandidate(candidateId, options);
    assert(candidate.status.status === "candidate", "Candidate state machine status changed.");
    assert(candidate.status.review_status === "pending_review", "Candidate review status changed.");
    assert(candidate.metadata.activation_requested === true, "Activation request link missing.");
    assert(candidate.metadata.activated === false, "Candidate was activated.");
    assert(!await exists(options.activationLog), "Activation log was created.");
    assert((await names(options.engineSnapshots)).size === 0, "Engine snapshot was created.");

    await writeFile(activeEnginePath, `${activeText}Rule 32: concurrent change.\n`, "utf8");
    const mismatchReview = await buildPendingEngineCandidateReview({
      pending_engine_candidate_id: candidateId,
      review_mode: "summary_only",
    }, options);
    assert(mismatchReview.review.base_hash_mismatch === true, "Hash mismatch was not marked.");
    let mismatchBlocked = false;
    try {
      await requestPendingEngineCandidateActivation({
        pending_engine_candidate_id: candidateId,
        review_id: mismatchReview.review.review_id,
      }, options);
    } catch {
      mismatchBlocked = true;
    }
    assert(mismatchBlocked, "Hash mismatch request was not blocked.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Production active engine changed.",
    );
    console.log("Pending engine candidate review service test passed.");
  } finally {
    await Promise.all([
      rm(activeEnginePath, { force: true }),
      rm(options.pendingEngineCandidates, { recursive: true, force: true }),
      rm(options.engineCandidateReviews, { recursive: true, force: true }),
      rm(options.approvalQueue, { recursive: true, force: true }),
      rm(options.engineSnapshots, { recursive: true, force: true }),
      rm(options.engineArchive, { recursive: true, force: true }),
      rm(options.activationLog, { force: true }),
      rm(options.rollbackIndex, { force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Pending engine candidate review service test failed: ${error.message}`);
  process.exitCode = 1;
});
