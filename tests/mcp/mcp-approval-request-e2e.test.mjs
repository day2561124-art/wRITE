import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem, getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { approvalRequestTools } from "../../server/src/mcp-approval-request-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const tempCanon = path.join(projectPaths.canonDb, ".mcp-approval-request-e2e");
  const approvalQueue = path.join(projectPaths.approvalQueue, ".mcp-approval-request-e2e");
  const options = {
    pendingEngineCandidates: path.join(tempCanon, "pending_engine_candidates"),
    activeEnginePath: path.join(tempCanon, "active_engine.md"),
    engineSnapshots: path.join(tempCanon, "engine_snapshots"),
    engineArchive: path.join(tempCanon, "archive"),
    activationLog: path.join(tempCanon, "activation_logs", "activation_log.jsonl"),
    rollbackIndex: path.join(tempCanon, "rollback", "rollback_index.json"),
    approvalQueue,
  };
  await Promise.all([
    rm(tempCanon, { recursive: true, force: true }),
    rm(approvalQueue, { recursive: true, force: true }),
  ]);
  await mkdir(tempCanon, { recursive: true });
  await writeFile(options.activeEnginePath, "# Active\n\nOriginal\n", "utf8");
  try {
    const candidate = await importSettlementResult({
      rawText: "## pending_engine_candidate\n\n```md\n# Active\n\nOriginal\nNew candidate content\n```\n",
      sourceChapter: "MCP approval E2E",
    }, options);
    const candidateId = candidate.metadata.candidate_id;
    const candidateDir = path.join(options.pendingEngineCandidates, candidateId);
    await writeFile(path.join(candidateDir, "status.json"), `${JSON.stringify({
      status: "candidate",
      can_activate: true,
      eligible_for_phase_3_activation: true,
      requires_second_confirmation: false,
      blocked_reason: null,
    }, null, 2)}\n`, "utf8");
    await writeFile(path.join(candidateDir, "risk_report.json"), `${JSON.stringify({
      risk_level: "low",
      requires_second_confirmation: false,
    }, null, 2)}\n`, "utf8");

    const request = await approvalRequestTools.request_engine_candidate_activation({
      candidate_id: candidateId,
      reason: "MCP E2E test",
    }, options);
    assert(request.ok, `request failed: ${request.blocked_reason}`);
    const approvalId = request.result.approval_item_id;
    const item = await getApprovalItem(approvalId, options);
    assert(item.action_type === "activate_engine_candidate", "action_type mismatch");
    assert(item.target_type === "pending_engine_candidate", "target_type mismatch");
    assert(item.links?.candidate_id === candidateId, "links missing candidate id");
    assert(item.details?.requested_by === "mcp", "requested_by is not mcp");
    assert((await readFile(options.activeEnginePath, "utf8")).includes("Original"), "fixture is invalid");

    const confirmed = await confirmApprovalItem(approvalId, {
      confirm: true,
      approvedBy: "ui_test",
    }, options);
    assert(confirmed.approval_item.status.status === "resolved", "approval was not resolved");
    assert(confirmed.result.activation_log_id, "activation_log_id is missing");
    assert(
      (await readFile(options.activeEnginePath, "utf8")).includes("New candidate content"),
      "active engine was not updated by confirm flow",
    );
    console.log("MCP approval-request E2E test passed.");
  } finally {
    await Promise.all([
      rm(tempCanon, { recursive: true, force: true }),
      rm(approvalQueue, { recursive: true, force: true }),
    ]);
  }
}

main().catch((error) => {
  console.error(`MCP approval-request E2E failed: ${error.message}`);
  process.exitCode = 1;
});
