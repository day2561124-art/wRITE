import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildApprovalQueueReadinessReport } from "../../server/src/approval-queue-readiness-service.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".phase14c-approval-readiness-negative";
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
  adoptedWritings: path.join(projectPaths.adoptedWritings, suffix),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await Promise.all(Object.values(options).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
  const writing = (await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: "Phase 14C readiness negative fixture.",
    use_current_inputs: true,
    include_active_engine: false,
  }, options));
  const writingResult = writing.ok ? writing.result : writing;
  const candidateResp = await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writingResult.bundle.bundle_id,
    chat_output_text: `# Phase 14C Candidate

後座描述沒有提及章節錨點核心人物或承接結果，僅為雜項片段。`,
    title: "Phase 14C Candidate - Negative",
  }, options);

  // Ensure candidate saved
  assert(candidateResp.ok, "Candidate save failed");
  const candidateId = candidateResp.result.candidate_id;

  // Mark neural trace complete to isolate guard check as cause
  const candidateMetaPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const candidateMeta = JSON.parse(await readFile(candidateMetaPath, "utf8"));
  candidateMeta.missing_required_neural_modules = [];
  candidateMeta.neural_trace_complete = true;
  await writeFile(candidateMetaPath, `${JSON.stringify(candidateMeta, null, 2)}\n`);

  // Build a fake adoption request to read readiness
  const proofing = await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: candidateId,
    include_active_engine: false,
  }, options);
  const proofingId = proofing.ok ? proofing.result.context.proofing_context_id : proofing.result;
  const proof = await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: candidateId,
    proofing_context_id: proofingId,
    proof_report_text: "Negative readiness proof.",
    verdict: "pass",
    severity: "none",
  }, options);
  const adoption = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidateId,
    proof_report_id: proof.result.proof_report_id,
    reason: "Negative readiness fixture.",
  }, options);

  const report = await buildApprovalQueueReadinessReport(adoption.approval_item_id, options);
  assert(report.decision === "blocked", "Negative fixture unexpectedly ready");
  assert(report.blocking_reasons.includes("guard_blocked_P0"), "guard_blocked_P0 absent from blocking_reasons");
  console.log("MCP approval queue bridge readiness negative test passed (guard blocked as expected).");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
