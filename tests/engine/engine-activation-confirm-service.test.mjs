import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  activateEngineCandidateAfterApproval,
  getEngineActivationConfirmLog,
} from "../../server/src/engine-activation-confirm-service.mjs";
import { createApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = path.join(projectPaths.canonDb, ".engine-activation-confirm-service-test");
const approvalQueue = path.join(projectPaths.approvalQueue, ".engine-activation-confirm-service-test");
const options = {
  activeEnginePath: path.join(root, "active_engine.md"),
  pendingEngineCandidates: path.join(root, "pending"),
  engineSnapshots: path.join(root, "snapshots"),
  engineArchive: path.join(root, "archive"),
  activationLog: path.join(root, "logs", "activation.jsonl"),
  rollbackIndex: path.join(root, "rollback", "index.json"),
  approvalQueue,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
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
  const productionHash = hash(await readFile(projectPaths.activeEngine));
  const activeText = "# Phase 8I Service Engine\n\nRule 1: stable.\n";
  await Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(approvalQueue, { recursive: true, force: true }),
  ]);
  await mkdir(root, { recursive: true });
  await writeFile(options.activeEnginePath, activeText, "utf8");
  try {
    const candidate = await importSettlementResult({
      rawText: `## pending_engine_candidate\n\n\`\`\`md\n${activeText}Rule 2: approved.\n\`\`\`\n`,
      sourceChapter: "Phase 8I service test",
    }, options);
    const item = await createApprovalItem({
      actionType: "activate_engine_candidate",
      targetType: "pending_engine_candidate",
      targetId: candidate.metadata.candidate_id,
      requiresUserConfirmation: true,
      canExecuteWithoutUserConfirmation: false,
      links: { candidate_id: candidate.metadata.candidate_id },
    }, options);
    await expectReject(
      () => activateEngineCandidateAfterApproval({
        approvalItemId: item.approval_item_id,
        pendingEngineCandidateId: candidate.metadata.candidate_id,
      }, options),
      "Activation service accepted a call outside approval confirmation.",
    );
    assert(hash(await readFile(options.activeEnginePath)) === hash(activeText), "Rejected call changed engine.");
    const result = await activateEngineCandidateAfterApproval({
      approvalItemId: item.approval_item_id,
      pendingEngineCandidateId: candidate.metadata.candidate_id,
      confirmedBy: "phase_8i_service_test",
    }, { ...options, approvalConfirmed: true, approvalItem: item });
    assert(result.activation_log_id, "Activation log id is missing.");
    assert(result.previous_active_engine_hash === hash(activeText), "Previous hash is wrong.");
    assert(result.rollback_requires_approval === true, "Rollback approval flag is missing.");
    const log = await getEngineActivationConfirmLog(result.activation_log_id, options);
    assert(log.approval_item_id === item.approval_item_id, "Log approval trace is wrong.");
    assert(log.pending_engine_candidate_id === candidate.metadata.candidate_id, "Log candidate trace is wrong.");
    const metadata = JSON.parse(await readFile(
      path.join(options.pendingEngineCandidates, candidate.metadata.candidate_id, "metadata.json"),
      "utf8",
    ));
    assert(metadata.activated === true, "Candidate metadata was not activated.");
    assert(metadata.activation_log_id === result.activation_log_id, "Candidate metadata trace is wrong.");
    console.log("Engine activation confirm service test passed.");
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(approvalQueue, { recursive: true, force: true }),
    ]);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production engine changed.");
  }
}

main().catch((error) => {
  console.error(`Engine activation confirm service test failed: ${error.message}`);
  process.exitCode = 1;
});
