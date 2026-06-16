import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { buildApprovalQueueReadinessReport } from "../../server/src/approval-queue-readiness-service.mjs";
import { getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".phase14c-gating-test";
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
};
const expectedBlockedAdoptionNextAction =
  "Adoption request was blocked before approval queue creation. Review blocked_reasons on the candidate/proof report detail page.";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await Promise.all(Object.values(options).map((d) => rm(d, { recursive: true, force: true })));
  // 1) missing neural modules -> dryRun true should be blocked:true
  const writing = (await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: "Gating test",
    include_active_engine: false,
  }, options)).result;
  const candidate = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: "# Candidate",
    title: "Gating Candidate",
  }, options)).result;
  const proofing = (await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: candidate.candidate_id,
    include_active_engine: false,
  }, options)).result;
  const proof = (await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: candidate.candidate_id,
    proofing_context_id: proofing.context.proofing_context_id,
    proof_report_text: "Pass.",
    verdict: "pass",
    severity: "none",
  }, options)).result;

  const dryMissing = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidate.candidate_id,
    proof_report_id: proof.proof_report_id,
    dry_run: true,
  }, options);
  assert(dryMissing.result.blocked === true, "Missing modules dryRun must be blocked.");
  assert(dryMissing.result.dry_run === true, "Missing modules dryRun must indicate dry_run.");
  assert(dryMissing.result.approval_item_created === false, "Dry run must not create approval item.");
  assert(Array.isArray(dryMissing.result.blocked_reasons), "blocked_reasons missing.");
  assert(dryMissing.result.blocked_reasons.some((r) => r.startsWith("missing_required_neural_modules")), "missing_required_neural_modules reason absent.");

  assert(dryMissing.result.next_action === expectedBlockedAdoptionNextAction, "Missing modules dryRun must provide blocked next_action guidance.");

  // 2) proof verdict needs_revision should be blocked
  const candidate2 = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: "# Candidate 2",
    title: "Gating Candidate 2",
  }, options)).result;
  const proofing2 = (await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: candidate2.candidate_id,
    include_active_engine: false,
  }, options)).result;
  const proof2 = (await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: candidate2.candidate_id,
    proofing_context_id: proofing2.context.proofing_context_id,
    proof_report_text: "Needs revision.",
    verdict: "needs_revision",
    severity: "P3",
  }, options)).result;
  const dryProof = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidate2.candidate_id,
    proof_report_id: proof2.proof_report_id,
    dry_run: true,
  }, options);
  assert(dryProof.result.blocked === true, "Proof verdict needs_revision must be blocked.");
  assert(dryProof.result.approval_item_created === false, "Blocked dry run must not create approval item.");
  assert(dryProof.result.blocked_reasons.some((r) => r.startsWith("proof_verdict_not_pass")), "proof_verdict_not_pass reason absent.");
  assert(dryProof.result.next_action === expectedBlockedAdoptionNextAction, "Proof verdict dryRun must provide blocked next_action guidance.");

  // 3) proof severity P1 should be blocked
  const candidate3 = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: "# Candidate 3",
    title: "Gating Candidate 3",
  }, options)).result;
  const proofing3 = (await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: candidate3.candidate_id,
    include_active_engine: false,
  }, options)).result;
  const proof3 = (await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: candidate3.candidate_id,
    proofing_context_id: proofing3.context.proofing_context_id,
    proof_report_text: "Critical severity.",
    verdict: "pass",
    severity: "P1",
  }, options)).result;
  const drySeverity = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidate3.candidate_id,
    proof_report_id: proof3.proof_report_id,
    dry_run: true,
  }, options);
  assert(drySeverity.result.blocked === true, "Proof severity P1 must be blocked.");
  assert(drySeverity.result.blocked_reasons.some((r) => r.startsWith("proof_severity_blocking")), "proof_severity_blocking reason absent.");
  assert(drySeverity.result.next_action === expectedBlockedAdoptionNextAction, "Proof severity dryRun must provide blocked next_action guidance.");

  // 4) dryRun:false in blocked state must not create approval item
  const blockedReal = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: candidate.candidate_id,
    proof_report_id: proof.proof_report_id,
    dry_run: false,
  }, options);
  assert(blockedReal.result.approval_item_created === false, "Blocked real run must not create approval item.");
  assert(blockedReal.result.blocked === true, "Blocked real run must be blocked.");
  assert(blockedReal.result.next_action === expectedBlockedAdoptionNextAction, "Blocked real run must provide blocked next_action guidance.");
  assert(
    !blockedReal.result.next_action.includes("confirm this adoption request"),
    "Blocked real run must not tell users to confirm a blocked request.",
  );

  // 5) readiness report for blocked lineage should be decision=blocked
  const blockedItemId = blockedReal.result.approval_item_id || blockedReal.result.request_id || null;
  if (blockedItemId) {
    const report = await buildApprovalQueueReadinessReport(blockedItemId, options);
    assert(report.decision === "blocked", "Readiness decision for blocked lineage must be blocked.");
    assert(Array.isArray(report.blocking_reasons) && report.blocking_reasons.length > 0, "Readiness blocking reasons missing.");
  }

  // 6) legal pass + neural trace complete -> ready_for_human_review
  // Create candidate and then patch its metadata to simulate complete neural trace
  const goodCandidate = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: "# Good Candidate",
    title: "Good Candidate",
  }, options)).result;
  const proofingGood = (await chatgptBridgeTools.chatgpt_bridge_build_proofing_context({
    candidate_id: goodCandidate.candidate_id,
    include_active_engine: false,
  }, options)).result;
  const proofGood = (await chatgptBridgeTools.chatgpt_bridge_save_proof_report({
    candidate_id: goodCandidate.candidate_id,
    proofing_context_id: proofingGood.context.proofing_context_id,
    proof_report_text: "Pass.",
    verdict: "pass",
    severity: "none",
  }, options)).result;
  // Patch candidate metadata to mark neural trace complete
  const metaPath = path.join(options.writingCandidates, goodCandidate.candidate_id, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.missing_required_neural_modules = [];
  meta.neural_trace_complete = true;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

  const ready = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: goodCandidate.candidate_id,
    proof_report_id: proofGood.proof_report_id,
    dry_run: true,
  }, options);
  // dry run should report not blocked when only neural issues were previously fixed
  assert(ready.result.blocked === false, "Good candidate dryRun must not be blocked.");

  const readyReal = await chatgptBridgeTools.chatgpt_bridge_request_adoption({
    candidate_id: goodCandidate.candidate_id,
    proof_report_id: proofGood.proof_report_id,
    dry_run: false,
  }, options);
  assert(readyReal.result.approval_item_created === true, "Good candidate real run must create approval item.");
  const readiness = await buildApprovalQueueReadinessReport(readyReal.result.approval_item_id, options);
  assert(readiness.decision === "ready_for_human_review", "Readiness must be ready_for_human_review for good lineage.");

  console.log("Bridge gating tests passed.");
}

main().catch((err) => {
  console.error(`Bridge gating test failed: ${err.message}`);
  process.exitCode = 1;
});
