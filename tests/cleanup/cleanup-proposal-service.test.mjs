import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  approveCleanupProposal,
  createCleanupProposal,
  deferCleanupProposal,
  executeCleanupProposal,
  getCleanupProposal,
  isSafeCleanupProposalId,
  isSafeCleanupTrashId,
  listCleanupLogs,
  rejectCleanupProposal,
  scanCleanupCandidates,
} from "../../server/src/cleanup-proposal-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCleanup = path.join(projectPaths.cleanupRoot, ".cleanup-proposal-test");
const fixtureCanon = path.join(projectPaths.canonDb, ".cleanup-proposal-test");
const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".cleanup-proposal-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".cleanup-proposal-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const oldDate = "2025-01-01T00:00:00.000Z";

const options = {
  cleanupRoot: fixtureCleanup,
  engineArchive: path.join(fixtureCanon, "archive"),
  rejectedEngineCandidates: path.join(fixtureCanon, "rejected_engine_candidates"),
  pendingEngineCandidates: path.join(fixtureCanon, "pending_engine_candidates"),
  engineSnapshots: path.join(fixtureCanon, "engine_snapshots"),
  rollbackIndex: path.join(fixtureCanon, "rollback", "rollback_index.json"),
  candidateDrafts: path.join(fixtureWorkflow, "candidate_drafts"),
  proofReports: path.join(fixtureWorkflow, "proof_reports"),
  adoptedChapters: path.join(fixtureWorkflow, "adopted_chapters"),
  contextBundles: path.join(fixtureWorkflow, "context_bundles"),
  settlementContexts: path.join(fixtureWorkflow, "settlements", "contexts"),
  settlementReports: path.join(fixtureWorkflow, "settlements", "reports"),
  approvalItems: path.join(fixtureApproval, "items"),
  now: new Date("2026-06-11T12:00:00.000Z"),
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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fixture(directory, metadata, status = null, content = "fixture\n") {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "content.md"), content, "utf8");
  await writeJson(path.join(directory, "metadata.json"), metadata);
  if (status) await writeJson(path.join(directory, "status.json"), status);
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
  const activeBefore = await readFile(projectPaths.activeEngine);
  const activationLogBefore = await names(projectPaths.activationLogs);
  const approvalLogBefore = await names(projectPaths.approvalLogs);
  const neuralBefore = await names(projectPaths.neuralTraces);
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureCleanup, { recursive: true, force: true });
  await rm(fixtureCanon, { recursive: true, force: true });
  await rm(fixtureWorkflow, { recursive: true, force: true });
  await rm(fixtureApproval, { recursive: true, force: true });

  try {
    const normalArchive = path.join(options.engineArchive, "engine_archive_20240101-000000-11111111");
    const highArchive = path.join(options.engineArchive, "engine_archive_20240102-000000-22222222");
    const pinnedArchive = path.join(options.engineArchive, "engine_archive_20240103-000000-33333333");
    const rollbackSnapshot = path.join(
      options.engineSnapshots,
      "engine_snapshot_20240101-000000-44444444",
    );
    const oldSnapshot = path.join(
      options.engineSnapshots,
      "engine_snapshot_20240102-000000-55555555",
    );
    const rejectedCandidate = path.join(
      options.rejectedEngineCandidates,
      "engine_candidate_20240101-000000-66666666",
    );
    const blockedCandidate = path.join(
      options.pendingEngineCandidates,
      "engine_candidate_20240102-000000-77777777",
    );
    const deferredApproval = path.join(
      options.approvalItems,
      "approval_item_20240101-000000-88888888",
    );

    await fixture(normalArchive, {
      archive_id: path.basename(normalArchive),
      archived_at: oldDate,
      retention: "normal",
      risk_level: "low",
    });
    await fixture(highArchive, {
      archive_id: path.basename(highArchive),
      archived_at: oldDate,
      retention: "high_risk",
      risk_level: "high",
    });
    await fixture(pinnedArchive, {
      archive_id: path.basename(pinnedArchive),
      archived_at: oldDate,
      retention: "pinned",
      risk_level: "low",
    });
    await fixture(rollbackSnapshot, {
      snapshot_id: path.basename(rollbackSnapshot),
      created_at: oldDate,
      rollback_available: true,
    });
    await fixture(oldSnapshot, {
      snapshot_id: path.basename(oldSnapshot),
      created_at: oldDate,
      rollback_available: false,
    });
    await fixture(rejectedCandidate, {
      candidate_id: path.basename(rejectedCandidate),
      imported_at: oldDate,
      risk_level: "low",
    }, { status: "rejected", rejected_at: oldDate });
    await fixture(blockedCandidate, {
      candidate_id: path.basename(blockedCandidate),
      imported_at: oldDate,
      risk_level: "low",
    }, { status: "blocked", updated_at: oldDate });
    await fixture(deferredApproval, {
      approval_item_id: path.basename(deferredApproval),
      created_at: oldDate,
      risk_level: "low",
    }, { status: "deferred", deferred_at: oldDate });
    await writeJson(options.rollbackIndex, {
      activations: [{ snapshot_id: path.basename(rollbackSnapshot) }],
    });

    const retentionPolicy = {
      keep_latest_archives: 0,
      keep_latest_snapshots: 0,
      rejected_candidate_days: 30,
      failed_candidate_days: 30,
      blocked_candidate_days: 30,
      trash_retention_days: 30,
    };
    const scan = await scanCleanupCandidates({ retentionPolicy }, options);
    const eligibleIds = new Set(scan.eligible_items.map((item) => item.item_id));
    assert(eligibleIds.has(path.basename(normalArchive)), "Old archive was not eligible.");
    assert(eligibleIds.has(path.basename(oldSnapshot)), "Old non-rollback snapshot was not eligible.");
    assert(eligibleIds.has(path.basename(rejectedCandidate)), "Rejected candidate was not eligible.");
    assert(eligibleIds.has(path.basename(blockedCandidate)), "Old blocked candidate was not eligible.");
    assert(eligibleIds.has(path.basename(deferredApproval)), "Old deferred approval was not eligible.");
    assert(
      scan.blocked_items.some((item) => item.item_id === path.basename(highArchive)),
      "High-risk archive was not blocked from cleanup.",
    );
    assert(
      scan.must_keep_items.some((item) => item.item_id === path.basename(pinnedArchive)),
      "Pinned archive was not preserved.",
    );
    assert(
      scan.must_keep_items.some((item) => item.item_id === path.basename(rollbackSnapshot)),
      "Rollback-index snapshot was not preserved.",
    );

    const proposal = await createCleanupProposal({ retentionPolicy }, options);
    assert(
      isSafeCleanupProposalId(proposal.cleanup_proposal_id),
      "Proposal id does not match the safe format.",
    );
    assert(proposal.status.status === "draft", "Proposal did not start as draft.");
    assert(proposal.eligible_items.length === scan.eligible_items.length, "Proposal lost eligible items.");
    await expectReject(
      () => approveCleanupProposal(proposal.cleanup_proposal_id, {}, options),
      "Unconfirmed proposal was approved.",
    );
    await approveCleanupProposal(proposal.cleanup_proposal_id, {
      confirm: true,
      approvedBy: "cleanup_test",
    }, options);
    assert(
      (await getCleanupProposal(proposal.cleanup_proposal_id, options)).status.status === "approved",
      "Approved proposal status was wrong.",
    );
    await expectReject(
      () => executeCleanupProposal(proposal.cleanup_proposal_id, {}, options),
      "Unconfirmed cleanup executed.",
    );
    const execution = await executeCleanupProposal(proposal.cleanup_proposal_id, {
      confirm: true,
      approvedBy: "cleanup_test",
    }, options);
    assert(execution.cleanup_proposal.status.status === "executed", "Proposal was not executed.");
    assert(execution.moved_items.length === proposal.eligible_items.length, "Not all eligible items moved.");
    assert(await names(highArchive).then((set) => set.size > 0), "High-risk archive was moved.");
    assert(await names(pinnedArchive).then((set) => set.size > 0), "Pinned archive was moved.");
    assert(await names(rollbackSnapshot).then((set) => set.size > 0), "Rollback snapshot was moved.");
    for (const moved of execution.moved_items) {
      assert(isSafeCleanupTrashId(moved.cleanup_trash_id), "Trash id was unsafe.");
      const trashDirectory = path.join(fixtureCleanup, "trash", moved.cleanup_trash_id);
      const metadata = JSON.parse(
        await readFile(path.join(trashDirectory, "trash_metadata.json"), "utf8"),
      );
      const tombstone = JSON.parse(
        await readFile(
          path.join(fixtureCleanup, "tombstones", `${moved.cleanup_trash_id}.json`),
          "utf8",
        ),
      );
      assert(metadata.restore_available === true, "Trash metadata disabled restore.");
      assert(tombstone.restore_available === true, "Tombstone disabled restore.");
      assert(tombstone.hash === moved.hash, "Tombstone hash was wrong.");
    }

    const deferredSource = path.join(
      options.rejectedEngineCandidates,
      "engine_candidate_20240103-000000-99999999",
    );
    await fixture(deferredSource, {
      candidate_id: path.basename(deferredSource),
      imported_at: oldDate,
      risk_level: "low",
    }, { status: "rejected", rejected_at: oldDate });
    const deferredProposal = await createCleanupProposal({ retentionPolicy }, options);
    await deferCleanupProposal(deferredProposal.cleanup_proposal_id, { reason: "Later" }, options);
    assert(
      (await getCleanupProposal(deferredProposal.cleanup_proposal_id, options)).status.status
        === "deferred",
      "Defer did not update proposal status.",
    );
    await rejectCleanupProposal(deferredProposal.cleanup_proposal_id, { reason: "No" }, options);
    assert(
      (await getCleanupProposal(deferredProposal.cleanup_proposal_id, options)).status.status
        === "rejected",
      "Reject did not update proposal status.",
    );
    assert(await names(deferredSource).then((set) => set.size > 0), "Reject/defer moved target.");

    const failureSource = path.join(
      options.rejectedEngineCandidates,
      "engine_candidate_20240104-000000-aaaaaaaa",
    );
    await fixture(failureSource, {
      candidate_id: path.basename(failureSource),
      imported_at: oldDate,
      risk_level: "low",
    }, { status: "rejected", rejected_at: oldDate }, "transaction failure fixture\n");
    const failureProposal = await createCleanupProposal({ retentionPolicy }, options);
    await approveCleanupProposal(failureProposal.cleanup_proposal_id, {
      confirm: true,
      approvedBy: "cleanup_test",
    }, options);
    process.env.FILE_TRANSACTION_TEST_MODE = "1";
    try {
      await expectReject(
        () => executeCleanupProposal(failureProposal.cleanup_proposal_id, {
          confirm: true,
          approvedBy: "cleanup_test",
        }, { ...options, testFailAfterCommits: 1 }),
        "Injected cleanup transaction failure did not fail.",
      );
    } finally {
      delete process.env.FILE_TRANSACTION_TEST_MODE;
    }
    assert(
      await names(failureSource).then((set) => set.has("content.md")),
      "Failed cleanup transaction removed its source.",
    );
    assert(
      (await getCleanupProposal(failureProposal.cleanup_proposal_id, options)).status.status
        === "approved",
      "Failed cleanup transaction changed proposal to executed.",
    );

    const logs = await listCleanupLogs(options);
    for (const event of [
      "cleanup_scan",
      "cleanup_proposal_created",
      "cleanup_proposal_approved",
      "cleanup_proposal_deferred",
      "cleanup_proposal_rejected",
      "cleanup_item_moved_to_trash",
      "cleanup_proposal_executed",
      "cleanup_failed",
    ]) {
      assert(logs.some((log) => log.event === event), `Cleanup log omitted ${event}.`);
    }
    assert(
      hash(await readFile(projectPaths.activeEngine)) === hash(activeBefore),
      "Cleanup changed active_engine.md.",
    );
    console.log("Cleanup proposal service test passed.");
  } finally {
    await rm(fixtureCleanup, { recursive: true, force: true });
    await rm(fixtureCanon, { recursive: true, force: true });
    await rm(fixtureWorkflow, { recursive: true, force: true });
    await rm(fixtureApproval, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === hash(activeBefore), "Cleanup changed active.");
    assert(
      JSON.stringify([...await names(projectPaths.activationLogs)])
        === JSON.stringify([...activationLogBefore]),
      "Cleanup changed activation logs.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.approvalLogs)])
        === JSON.stringify([...approvalLogBefore]),
      "Cleanup changed approval logs.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.neuralTraces)]) === JSON.stringify([...neuralBefore]),
      "Cleanup changed neural traces.",
    );
  }
}

main().catch((error) => {
  console.error(`Cleanup proposal service test failed: ${error.message}`);
  process.exitCode = 1;
});
