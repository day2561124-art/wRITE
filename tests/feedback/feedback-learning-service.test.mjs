import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildFeedbackContextBundle,
  createCompressedRuleUpdateProposal,
  createFeedbackDigest,
  createRuleCandidate,
  getFeedbackItem,
  listFeedbackItems,
  requestCompressedRuleUpdate,
  saveFeedbackItem,
} from "../../server/src/feedback-learning-service.mjs";
import {
  confirmApprovalItem,
  getApprovalItem,
} from "../../server/src/approval-queue-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(projectPaths.feedbackLoop, ".feedback-learning-service-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".feedback-learning-service-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  feedbackLoop: fixtureRoot,
  approvalQueue: fixtureApproval,
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

async function main() {
  const activeHash = hash(await readFile(projectPaths.activeEngine));
  const compressedHash = hash(await readFile(projectPaths.compressedRules));
  const feedbackEntriesBefore = await names(projectPaths.feedbackLoop);
  const transactionsBefore = await names(transactionDir);
  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
  ]);

  try {
    const dialogue = await saveFeedbackItem({
      sourceType: "user_feedback",
      sourceId: "chapter-12",
      severity: "medium",
      category: "dialogue",
      body: "Dialogue repeats the same explanation twice.",
      tags: ["repetition", "dialogue"],
      evidence: [{ kind: "note", value: "Reader marked two adjacent exchanges." }],
    }, options);
    const pacing = await saveFeedbackItem({
      sourceType: "proof_report",
      sourceId: "proof-12",
      severity: "high",
      category: "pacing",
      title: "Scene transition is abrupt",
      body: "The transition skips the emotional consequence.",
      tags: ["repetition", "transition"],
    }, options);
    assert(dialogue.title === "Dialogue repeats the same explanation twice.", "Fallback title drifted.");
    assert(dialogue.safety.modifies_active_engine === false, "Feedback can modify active engine.");
    assert(dialogue.safety.modifies_compressed_rules === false, "Feedback can modify rules.");
    assert((await getFeedbackItem(dialogue.feedback_id, options)).body === dialogue.body,
      "Feedback item could not be read back.");
    assert((await listFeedbackItems({ severity: "high" }, options)).length === 1,
      "Feedback severity filter failed.");

    await expectReject(
      () => saveFeedbackItem({ body: "Invalid source", sourceType: "unknown" }, options),
      "Invalid source_type was accepted.",
    );
    await expectReject(
      () => saveFeedbackItem({ body: "Invalid severity", severity: "urgent" }, options),
      "Invalid severity was accepted.",
    );
    await expectReject(
      () => saveFeedbackItem({ body: "Invalid category", category: "mystery" }, options),
      "Invalid category was accepted.",
    );
    await expectReject(
      () => listFeedbackItems({}, { feedbackLoop: path.join(projectPaths.outputs, "escape") }),
      "Feedback root escaped data/feedback_loop.",
    );

    const digest = await createFeedbackDigest({
      feedbackIds: [dialogue.feedback_id, pacing.feedback_id],
    }, options);
    assert(digest.summary.total_items === 2, "Digest item count is wrong.");
    assert(digest.summary.by_category.dialogue === 1, "Digest category count is wrong.");
    assert(
      digest.summary.repeated_patterns.some(
        (pattern) => pattern.pattern === "repetition" && pattern.count === 2,
      ),
      "Digest repeated pattern is missing.",
    );
    assert(digest.safety.modifies_rules === false, "Digest can modify rules.");

    const candidate = await createRuleCandidate({
      sourceDigestId: digest.digest_id,
      targetRuleArea: "compressed_rules",
      candidateRule: "Avoid repeating identical exposition in adjacent dialogue exchanges.",
      rationale: "Two feedback items identify repeated explanation and transition framing.",
      examples: ["Consolidate repeated facts into one exchange."],
    }, options);
    assert(candidate.status === "ready_for_proposal", "Rule candidate status is wrong.");
    assert(candidate.safety.not_applied === true, "Rule candidate was applied.");
    assert(candidate.risk_level === "high", "Compressed-rules candidate risk was not raised.");

    const proposal = await createCompressedRuleUpdateProposal({
      sourceRuleCandidateIds: [candidate.rule_candidate_id],
      mode: "manual_review",
      content: "Review and manually place the proposed anti-repetition rule.",
    }, options);
    assert(proposal.current_target_sha256 === compressedHash, "Proposal target hash is wrong.");
    assert(proposal.safety.applied === false, "Proposal was applied.");
    assert(proposal.risk.direct_apply_allowed === false, "Proposal allows direct apply.");
    assert(hash(await readFile(projectPaths.compressedRules)) === compressedHash,
      "Proposal modified compressed_rules.md.");

    const request = await requestCompressedRuleUpdate({
      proposalId: proposal.proposal_id,
      reason: "Review this deterministic feedback proposal.",
    }, options);
    assert(request.action_type === "compressed_rule_update", "Approval action type is wrong.");
    assert(request.status === "pending", "Approval request is not pending.");
    assert(request.can_execute_without_user_confirmation === false,
      "Approval request can execute without confirmation.");
    const approval = await getApprovalItem(request.approval_item_id, options);
    assert(approval.safety.approval_only === true, "Approval item is not approval-only.");
    await expectReject(
      () => confirmApprovalItem(request.approval_item_id, {
        confirm: true,
        secondConfirm: true,
        approvedBy: "phase_10a_test",
      }, options),
      "Phase 10A approval request applied compressed rules.",
    );
    assert(hash(await readFile(projectPaths.compressedRules)) === compressedHash,
      "Approval confirmation attempt modified compressed_rules.md.");

    const bundle = await buildFeedbackContextBundle({
      feedbackIds: [dialogue.feedback_id, pacing.feedback_id],
      ruleCandidateIds: [candidate.rule_candidate_id],
      scope: "Use these findings while preparing external GPT writing and proofing context.",
    }, options);
    const context = await readFile(path.join(
      fixtureRoot,
      "context_bundles",
      bundle.metadata.context_bundle_id,
      "context.md",
    ), "utf8");
    assert(context.includes("This bundle is context only."), "Context safety text is missing.");
    assert(bundle.metadata.local_generation_allowed === false, "Context allows local generation.");
    assert(bundle.metadata.safety.modifies_active_engine === false, "Context can modify active engine.");

    assert(hash(await readFile(projectPaths.activeEngine)) === activeHash,
      "Feedback learning modified active_engine.md.");
    assert(hash(await readFile(projectPaths.compressedRules)) === compressedHash,
      "Feedback learning modified compressed_rules.md.");
    console.log("Feedback learning service test passed.");
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
    await removeNew(projectPaths.feedbackLoop, feedbackEntriesBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === activeHash,
      "Test cleanup modified active_engine.md.");
    assert(hash(await readFile(projectPaths.compressedRules)) === compressedHash,
      "Test cleanup modified compressed_rules.md.");
  }
}

main().catch((error) => {
  console.error(`Feedback learning service test failed: ${error.message}`);
  process.exitCode = 1;
});
