import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildApprovalQueueReadinessReport,
  validateApprovalQueueBridgeRequest,
} from "../../server/src/approval-queue-readiness-service.mjs";
import {
  approvalQueueReadinessToolMetadata,
  approvalQueueReadinessTools,
} from "../../server/src/mcp-approval-queue-readiness-tools.mjs";
import { getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { listAdoptedWritings } from "../../server/src/writing-candidate-adoption-service.mjs";

const suffix = ".phase14c-approval-readiness-test";
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
};
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function result(response, label) {
  assert(response.ok && !response.blocked, `${label} failed: ${response.blocked_reason}`);
  return response.result;
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const compressedBefore = await readFile(projectPaths.compressedRules);
  const pendingBefore = await names(projectPaths.pendingEngineCandidates);
  const transactionsBefore = await names(transactionDir);
  await Promise.all(Object.values(options).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));

  try {
    const writing = result(await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
      task_prompt: "Phase 14C readiness fixture.",
      use_current_inputs: true,
      include_active_engine: false,
    }, options), "writing context");
    const candidate = result(await chatgptBridgeTools.chatgpt_bridge_save_candidate({
      source_bundle_id: writing.bundle.bundle_id,
      chat_output_text: `# Phase 14C Candidate

第十九章〈第一聲鈴〉後座：

朝日奈千夜與九逃在後座短暫交手，場面有醫療後座的描寫與短期限制。九逃取得一場勝利，但因場內裁定而中止（九逃勝，裁定中止）。

（此候選說明：包含章節承接點所需之核心人物與結果描述，僅為候選，不成立正史。）`,
      title: "Phase 14C Candidate",
    }, options), "candidate");
    // Mark candidate metadata to simulate complete neural trace so readiness can pass
    const candidateMetaPath = path.join(options.writingCandidates, candidate.candidate_id, "candidate.json");
    const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
    candidateMeta.missing_required_neural_modules = [];
    candidateMeta.neural_trace_complete = true;
    await writeFile(candidateMetaPath, `${JSON.stringify(candidateMeta, null, 2)}\n`);

    const proofing = result(await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
      candidate_id: candidate.candidate_id,
      include_active_engine: false,
    }, options), "proofing context");
    const proof = result(await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
      candidate_id: candidate.candidate_id,
      proofing_context_id: proofing.context.proofing_context_id,
      proof_report_text: "Pass for readiness.",
      verdict: "pass",
      severity: "none",
    }, options), "proof report");
    const adoption = result(await chatgptBridgeTools.chatgpt_bridge_request_adoption({
      candidate_id: candidate.candidate_id,
      proof_report_id: proof.proof_report_id,
      reason: "Phase 14C readiness fixture.",
    }, options), "adoption request");

    const item = await getApprovalItem(adoption.approval_item_id, options);
    assert(item.source === "chatgpt_bridge", "Request source is not chatgpt_bridge.");
    assert(item.request_kind === "candidate_adoption", "Request kind is wrong.");
    assert(item.status.status === "pending", "Bridge request is not pending.");
    assert(item.lineage.candidate_id === candidate.candidate_id, "Candidate lineage is wrong.");
    assert(item.lineage.proof_report_id === proof.proof_report_id, "Proof lineage is wrong.");
    assert(
      item.lineage.proofing_context_id === proofing.context.proofing_context_id,
      "Proofing context lineage is wrong.",
    );
    assert(
      item.lineage.writing_context_id === writing.bundle.bundle_id,
      "Writing context lineage is wrong.",
    );
    assert(item.safety_snapshot.active_engine_hash_at_request, "Active hash is missing.");
    assert(item.safety_snapshot.compressed_rules_hash_at_request, "Rules hash is missing.");

    const report = await buildApprovalQueueReadinessReport(
      adoption.approval_item_id,
      options,
    );
    assert(report.ok === true, `Complete readiness was blocked: ${report.blocking_reasons}`);
    assert(report.decision === "ready_for_human_review", "Readiness decision is wrong.");
    assert(report.lineage.candidate.exists, "Candidate artifact was not found.");
    assert(report.lineage.proof_report.exists, "Proof artifact was not found.");
    assert(report.lineage.proofing_context.exists, "Proofing context was not found.");
    assert(report.lineage.writing_context.exists, "Writing context was not found.");
    for (const field of [
      "bridge_can_approve",
      "bridge_can_confirm_adoption",
      "bridge_can_activate_engine",
      "bridge_can_modify_active_engine",
      "bridge_can_modify_compressed_rules",
    ]) {
      assert(report.safety[field] === false, `${field} was not denied.`);
    }

    const missingCandidate = await validateApprovalQueueBridgeRequest({
      ...item,
      lineage: { ...item.lineage, candidate_id: "writing_candidate_20260613-140000-deadbeef" },
      candidate_id: "writing_candidate_20260613-140000-deadbeef",
      target_id: "writing_candidate_20260613-140000-deadbeef",
    }, options);
    assert(!missingCandidate.ok, "Missing candidate request was ready.");
    assert(
      missingCandidate.blocking_reasons.includes("candidate_not_found"),
      "Missing candidate reason was absent.",
    );

    const missingProof = await validateApprovalQueueBridgeRequest({
      ...item,
      lineage: { ...item.lineage, proof_report_id: null },
      proof_report_id: null,
      links: { ...item.links, proof_report_id: null },
    }, options);
    assert(!missingProof.ok, "Missing proof request was ready.");
    assert(
      missingProof.blocking_reasons.includes("missing_proof_report_id"),
      "Missing proof reason was absent.",
    );

    const resolved = await validateApprovalQueueBridgeRequest({
      ...item,
      status: { ...item.status, status: "resolved", confirmed_at: "2026-06-13T14:00:00Z" },
    }, options);
    assert(!resolved.ok, "Resolved request was ready.");
    assert(
      resolved.blocking_reasons.includes("request_not_pending"),
      "Non-pending reason was absent.",
    );

    const tool = await approvalQueueReadinessTools
      .approval_queue_bridge_readiness_report({
        request_id: adoption.approval_item_id,
        include_lineage_preview: true,
        max_preview_chars: 200,
      }, options);
    assert(tool.ok && tool.permission === "read", "MCP readiness tool failed.");
    assert(tool.can_approve === false, "MCP readiness tool may approve.");
    assert(tool.can_confirm_adoption === false, "MCP readiness tool may confirm.");
    const metadata =
      approvalQueueReadinessToolMetadata.approval_queue_bridge_readiness_report;
    assert(metadata.permission === "read_only", "MCP readiness metadata is not read-only.");
    assert(metadata.writes_files === false, "MCP readiness tool writes files.");

    assert(
      (await listAdoptedWritings({ candidateId: candidate.candidate_id }, options)).length === 0,
      "Readiness created an adopted chapter.",
    );
    const pendingAfter = await names(projectPaths.pendingEngineCandidates);
    assert(
      pendingAfter.size === pendingBefore.size
        && [...pendingBefore].every((entry) => pendingAfter.has(entry)),
      "Readiness changed pending engine candidates.",
    );
    assert(
      Buffer.compare(await readFile(projectPaths.activeEngine), activeBefore) === 0,
      "Readiness changed active_engine.md.",
    );
    assert(
      Buffer.compare(await readFile(projectPaths.compressedRules), compressedBefore) === 0,
      "Readiness changed compressed_rules.md.",
    );
    console.log("MCP approval queue bridge readiness test passed.");
  } finally {
    await Promise.all(Object.values(options).map((directory) => (
      rm(directory, { recursive: true, force: true })
    )));
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP approval queue bridge readiness test failed: ${error.message}`);
  process.exitCode = 1;
});
