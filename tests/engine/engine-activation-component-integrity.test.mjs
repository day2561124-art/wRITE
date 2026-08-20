import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  confirmApprovalItem,
  getApprovalItem,
} from "../../server/src/approval-queue-service.mjs";
import {
  importSettlementResult,
  listActivationLogs,
} from "../../server/src/engine-candidate-service.mjs";
import {
  calculateSha256Lf,
  getEngineComponentsStatus,
  synchronizeEngineComponentRegistryHash,
} from "../../server/src/engine-component-registry.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { activateEngineCandidateAfterApproval } from "../../server/src/engine-activation-confirm-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import { createEngineComponentRegistryFixture } from "../helpers/engine-component-registry-fixture.mjs";

const suffix = ".engine-activation-component-integrity-test";
const root = path.join(projectPaths.canonDb, suffix);
const options = {
  activeEnginePath: path.join(root, "active_engine.md"),
  registryPath: path.join(root, "engine-components.json"),
  pendingEngineCandidates: path.join(root, "pending"),
  engineSnapshots: path.join(root, "snapshots"),
  engineArchive: path.join(root, "archive"),
  activationLog: path.join(root, "logs", "activation.jsonl"),
  rollbackIndex: path.join(root, "rollback", "index.json"),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  engineCandidateReviews: path.join(projectPaths.engineCandidateReviews, suffix),
};

function settlement(candidateText) {
  return `## pending_engine_candidate\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function importAndRequest(candidateText, sourceChapter) {
  const candidate = await importSettlementResult({
    rawText: settlement(candidateText),
    sourceChapter,
  }, options);
  const review = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: candidate.metadata.candidate_id,
    reviewMode: "summary_only",
  }, options);
  const request = await requestPendingEngineCandidateActivation({
    pendingEngineCandidateId: candidate.metadata.candidate_id,
    reviewId: review.review.review_id,
    reason: sourceChapter,
  }, options);
  const item = await getApprovalItem(request.approval_item_id, options);
  return { candidate, item };
}

async function confirm(item, extraOptions = {}) {
  if (Object.keys(extraOptions).length > 0) {
    return activateEngineCandidateAfterApproval({
      approvalItemId: item.approval_item_id,
      pendingEngineCandidateId: item.target_id,
      confirmedBy: "component_integrity_regression_test",
    }, {
      ...options,
      ...extraOptions,
      approvalConfirmed: true,
      approvalItem: item,
    });
  }
  return confirmApprovalItem(item.approval_item_id, {
    confirm: true,
    approvedBy: "component_integrity_regression_test",
  }, { ...options, ...extraOptions });
}

async function main() {
  const oldActive = [
    "# Component Integrity Fixture",
    ...Array.from({ length: 40 }, (_, index) => `Rule ${index + 1}: stable.`),
    "",
  ].join("\n");
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(options.approvalQueue, { recursive: true, force: true }),
    rm(options.engineCandidateReviews, { recursive: true, force: true }),
  ]);
  await mkdir(root, { recursive: true });
  await writeFile(options.activeEnginePath, oldActive, "utf8");
  await createEngineComponentRegistryFixture({
    registryPath: options.registryPath,
    activeEnginePath: options.activeEnginePath,
  });

  try {
    assert.equal(
      calculateSha256Lf("one\ntwo\n"),
      calculateSha256Lf("one\r\ntwo\r\n"),
      "Activation and checker LF normalization diverged for CRLF input.",
    );

    const registryBeforeCandidate = await readFile(options.registryPath);
    const success = await importAndRequest(
      `${oldActive.trimEnd()}\nRule 41: approved.`,
      "Successful activation hash refresh",
    );
    assert.deepEqual(
      await readFile(options.registryPath),
      registryBeforeCandidate,
      "Candidate/proposal creation modified the component registry.",
    );
    assert(
      success.item.impact.will_modify.includes("config/engine-components.json"),
      "Approval details omitted config/engine-components.json.",
    );

    const activated = await confirm(success.item);
    assert.equal(activated.result.engine_integrity_verified, true);
    assert.equal(activated.result.registry_hash_synchronized, true);
    assert.equal(activated.result.hash_matches, true);
    const healthy = await getEngineComponentsStatus(options);
    assert.equal(healthy.ok, true);
    assert.equal(healthy.components.canon_data.exists, true);
    assert.equal(healthy.components.canon_data.hash_matches, true);
    assert(!healthy.issues.includes("canon_data:hash_mismatch"));
    const registryAfter = JSON.parse(await readFile(options.registryPath, "utf8"));
    assert.equal(
      registryAfter.components.canon_data.expected_sha256_lf,
      healthy.components.canon_data.actual_sha256_lf,
    );
    const successLog = (await listActivationLogs(options))[0];
    assert.equal(successLog.active_engine_sha256_lf_before, calculateSha256Lf(oldActive));
    assert.equal(successLog.active_engine_sha256_lf_after, healthy.components.canon_data.actual_sha256_lf);
    assert.equal(successLog.registry_expected_hash_before, calculateSha256Lf(oldActive));
    assert.equal(successLog.registry_expected_hash_after, healthy.components.canon_data.actual_sha256_lf);
    assert.equal(successLog.component_integrity_verified, true);
    assert.equal(successLog.hash_matches, true);

    const activeBeforeWriteFailure = await readFile(options.activeEnginePath);
    const registryBeforeWriteFailure = await readFile(options.registryPath);
    const logsBeforeWriteFailure = await readFile(options.activationLog);
    const writeFailure = await importAndRequest(
      `${activeBeforeWriteFailure.toString("utf8").trimEnd()}\nRule 42: registry failure.`,
      "Registry failure rollback",
    );
    process.env.FILE_TRANSACTION_TEST_MODE = "1";
    await assert.rejects(
      () => confirm(writeFailure.item, { testFailRegistryWrite: true }),
      /registry write failure/iu,
    );
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    assert.deepEqual(await readFile(options.activeEnginePath), activeBeforeWriteFailure);
    assert.deepEqual(await readFile(options.registryPath), registryBeforeWriteFailure);
    assert.deepEqual(await readFile(options.activationLog), logsBeforeWriteFailure);

    const validationFailure = await importAndRequest(
      `${activeBeforeWriteFailure.toString("utf8").trimEnd()}\nRule 43: validation failure.`,
      "Integrity validation rollback",
    );
    process.env.FILE_TRANSACTION_TEST_MODE = "1";
    await assert.rejects(
      () => confirm(validationFailure.item, { testTamperRegistryHashBeforeValidation: true }),
      /integrity validation failed/iu,
    );
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    assert.deepEqual(await readFile(options.activeEnginePath), activeBeforeWriteFailure);
    assert.deepEqual(await readFile(options.registryPath), registryBeforeWriteFailure);
    assert.deepEqual(await readFile(options.activationLog), logsBeforeWriteFailure);

    const mismatchedRegistry = JSON.parse(registryBeforeWriteFailure.toString("utf8"));
    const actualHash = calculateSha256Lf(activeBeforeWriteFailure);
    mismatchedRegistry.components.canon_data.expected_sha256_lf =
      `${actualHash[0] === "A" ? "B" : "A"}${actualHash.slice(1)}`;
    await writeFile(
      options.registryPath,
      `${JSON.stringify(mismatchedRegistry, null, 2)}\n`,
      "utf8",
    );
    assert.equal((await getEngineComponentsStatus(options)).ok, false);
    const repaired = await synchronizeEngineComponentRegistryHash(options);
    assert.equal(repaired.registry_hash_synchronized, true);
    assert.equal(repaired.hash_matches, true);
    const repairedStatus = await getEngineComponentsStatus(options);
    assert.equal(repairedStatus.ok, true);
    assert.equal(repairedStatus.components.canon_data.hash_matches, true);
  } finally {
    delete process.env.FILE_TRANSACTION_TEST_MODE;
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(options.approvalQueue, { recursive: true, force: true }),
      rm(options.engineCandidateReviews, { recursive: true, force: true }),
    ]);
  }

  console.log("Engine activation component integrity regression test passed.");
}

main().catch((error) => {
  delete process.env.FILE_TRANSACTION_TEST_MODE;
  console.error(`Engine activation component integrity regression test failed: ${error.stack}`);
  process.exitCode = 1;
});
