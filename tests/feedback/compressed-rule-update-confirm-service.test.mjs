import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  createCompressedRuleUpdateProposal,
  createRuleCandidate,
  createFeedbackDigest,
  saveFeedbackItem,
  requestCompressedRuleUpdate,
} from "../../server/src/feedback-learning-service.mjs";
import { confirmApprovalItem, getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { confirmCompressedRuleUpdate } from "../../server/src/compressed-rule-update-confirm-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(projectPaths.feedbackLoop, ".compressed-rule-confirm-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".compressed-rule-confirm-test");
const options = { feedbackLoop: fixtureRoot, approvalQueue: fixtureApproval };

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

async function main() {
  const activeHash = hash(await readFile(projectPaths.activeEngine));
  const compressedHash = hash(await readFile(projectPaths.compressedRules));
  const beforeFeedback = await names(projectPaths.feedbackLoop);

  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
  ]);

  // Prepare fixture compressed_rules copy to avoid modifying repo file
  const fixtureCompressed = path.join(fixtureRoot, "compressed_rules.md");
  await mkdir(path.dirname(fixtureCompressed), { recursive: true }).catch(() => {});
  await (await import("node:fs/promises")).copyFile(projectPaths.compressedRules, fixtureCompressed);
  const fixtureCompressedHash = hash(await readFile(fixtureCompressed));

  try {
    const fb = await saveFeedbackItem({
      sourceType: "manual",
      sourceId: "test-1",
      severity: "low",
      category: "style",
      body: "Test feedback for compressed rules append.",
    }, options);

    const digest = await createFeedbackDigest({ feedbackIds: [fb.feedback_id] }, options);
    const candidate = await createRuleCandidate({
      sourceDigestId: digest.digest_id,
      targetRuleArea: "compressed_rules",
      candidateRule: "Do not repeat identical exposition.",
      rationale: "Test",
      examples: ["example"],
    }, options);

    const proposal = await createCompressedRuleUpdateProposal({
      sourceRuleCandidateIds: [candidate.rule_candidate_id],
      mode: "append",
      content: "\n# New compressed rule\nAvoid repetition.\n",
    }, options);

    const request = await requestCompressedRuleUpdate({ proposalId: proposal.proposal_id, reason: "Test" }, options);
    const approval = await getApprovalItem(request.approval_item_id, options);

    // Applying before approval confirm should fail
    let threw = false;
    try {
      await confirmCompressedRuleUpdate({ approval_id: request.approval_item_id, proposal_id: proposal.proposal_id }, options);
    } catch (error) {
      threw = true;
    }
    assert(threw, "confirmCompressedRuleUpdate applied without approval.");

    // Confirm approval (this will mark resolved but not auto-apply)
    await confirmApprovalItem(request.approval_item_id, { confirm: true, approvedBy: "test" }, options);

    // Now apply
    // apply against fixture compressed_rules only
    const applyOptions = { ...options, compressedRulesPath: fixtureCompressed };
    const result = await confirmCompressedRuleUpdate({ approval_id: request.approval_item_id, proposal_id: proposal.proposal_id, confirmed_by: "test" }, applyOptions);
    assert(result.application_id, "Application did not return an id.");

    // after sha should differ
    const afterHash = hash(await readFile(fixtureCompressed));
    assert(afterHash !== fixtureCompressedHash, "fixture compressed_rules.md was not modified.");

    // Ensure active engine unchanged
    assert(hash(await readFile(projectPaths.activeEngine)) === activeHash, "active_engine.md changed.");

    console.log("Compressed rule update confirm service test passed.");
  } finally {
    await Promise.all([
      rm(fixtureRoot, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
    ]);
    const fs = await import("node:fs/promises");
    const entries = await fs.readdir(projectPaths.feedbackLoop).catch(() => []);
    for (const e of entries) {
      if (!beforeFeedback.has(e)) await rm(path.join(projectPaths.feedbackLoop, e), { recursive: true, force: true });
    }
    // No need to restore compressed_rules in repo; tests should run in fixture and not change repo state ideally.
  }
}

main().catch((error) => {
  console.error(`Compressed rule update confirm service test failed: ${error.message}`);
  process.exitCode = 1;
});
