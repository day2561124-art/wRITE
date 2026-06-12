import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import {
  pendingEngineCandidateReviewToolMetadata,
  pendingEngineCandidateReviewTools,
} from "../../server/src/mcp-pending-engine-candidate-review-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".mcp-engine-review-test";
const activeEnginePath = path.join(projectPaths.canonDb, `${suffix}.md`);
const options = {
  activeEnginePath,
  pendingEngineCandidates: path.join(projectPaths.pendingEngineCandidates, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
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
    "# MCP Review Engine",
    ...Array.from({ length: 30 }, (_, index) => `Rule ${index + 1}: stable.`),
  ].join("\n") + "\n";
  await Promise.all([
    rm(options.pendingEngineCandidates, { recursive: true, force: true }),
    rm(options.engineCandidateReviews, { recursive: true, force: true }),
    rm(options.approvalQueue, { recursive: true, force: true }),
  ]);
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeText, "utf8");
  try {
    const toolNames = [
      "build_pending_engine_candidate_review",
      "get_pending_engine_candidate_review",
      "list_pending_engine_candidate_reviews",
      "request_pending_engine_candidate_activation",
    ];
    for (const name of toolNames) {
      assert(typeof pendingEngineCandidateReviewTools[name] === "function", `${name} missing.`);
      const metadata = pendingEngineCandidateReviewToolMetadata[name];
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_activate_engine === false, `${name} may activate.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_rollback === false, `${name} may rollback.`);
      assert(metadata.can_execute_cleanup === false, `${name} may clean up.`);
      assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
      assert(
        metadata.requires_user_confirmation_for_activation === true,
        `${name} omitted activation confirmation.`,
      );
    }
    assert(
      pendingEngineCandidateReviewToolMetadata
        .request_pending_engine_candidate_activation
        .creates_activation_approval_item === true,
      "Request tool metadata omitted approval creation.",
    );
    const imported = await importSettlementResult({
      rawText: [
        "## pending_engine_candidate",
        "",
        "```md",
        `${activeText.trimEnd()}\nRule 31: MCP review.`,
        "```",
      ].join("\n"),
    }, options);
    const candidateId = imported.metadata.candidate_id;
    const metadataPath = path.join(options.pendingEngineCandidates, candidateId, "metadata.json");
    const statusPath = path.join(options.pendingEngineCandidates, candidateId, "status.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const status = JSON.parse(await readFile(statusPath, "utf8"));
    await Promise.all([
      writeFile(metadataPath, `${JSON.stringify({
        ...metadata,
        base_active_engine_hash: hash(activeText),
        review_status: "pending_review",
      }, null, 2)}\n`, "utf8"),
      writeFile(statusPath, `${JSON.stringify({
        ...status,
        review_status: "pending_review",
      }, null, 2)}\n`, "utf8"),
    ]);
    const review = await pendingEngineCandidateReviewTools
      .build_pending_engine_candidate_review({
        pending_engine_candidate_id: candidateId,
        review_mode: "diff_only",
      }, options);
    assert(review.ok && review.result.review.review_id, "MCP review build failed.");
    const detail = await pendingEngineCandidateReviewTools
      .get_pending_engine_candidate_review({
        review_id: review.result.review.review_id,
      }, options);
    assert(detail.ok && detail.result.review_for_ui === null, "MCP detail dumped content.");
    const listed = await pendingEngineCandidateReviewTools
      .list_pending_engine_candidate_reviews({
        pending_engine_candidate_id: candidateId,
      }, options);
    assert(listed.ok && listed.result.count === 1, "MCP review list failed.");
    const request = await pendingEngineCandidateReviewTools
      .request_pending_engine_candidate_activation({
        pending_engine_candidate_id: candidateId,
        review_id: review.result.review.review_id,
      }, options);
    assert(request.ok && request.result.approval_item_id, "MCP activation request failed.");
    assert(request.result.activation_performed === false, "MCP activated candidate.");
    assert(hash(await readFile(activeEnginePath)) === hash(activeText), "Fixture engine changed.");
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production engine changed.");
    console.log("MCP pending engine candidate review tools test passed.");
  } finally {
    await Promise.all([
      rm(activeEnginePath, { force: true }),
      rm(options.pendingEngineCandidates, { recursive: true, force: true }),
      rm(options.engineCandidateReviews, { recursive: true, force: true }),
      rm(options.approvalQueue, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP pending engine candidate review tools test failed: ${error.message}`);
  process.exitCode = 1;
});
