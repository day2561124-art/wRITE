import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem, getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { buildCandidateProofingContext } from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { getAdoptedWritingDetail } from "../../server/src/writing-candidate-adoption-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".adoption-confirm-e2e-test";
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

const REQUIRED_NEURAL_MODULES = [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
];

async function markCandidateNeuralTraceComplete(candidateId) {
  const metaPath = path.join(options.writingCandidates, candidateId, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  meta.missing_required_neural_modules = [];
  meta.neural_trace_complete = true;
  meta.neural_modules_used = REQUIRED_NEURAL_MODULES;
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function main() {
  const activeHashBefore = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  for (const directory of Object.values(options)) {
    await rm(directory, { recursive: true, force: true });
  }
  try {
    const context = await buildGptWritingContext({
      taskPrompt: "Write an adoption E2E fixture.",
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const candidate = await saveChatOutputAsWritingCandidate({
      sourceBundleId: context.bundle.bundle_id,
      chatOutputText: "# E2E Candidate\n\nA complete scene.",
    }, options);
    await markCandidateNeuralTraceComplete(candidate.candidate_id);
    const proofing = await buildCandidateProofingContext({
      candidateId: candidate.candidate_id,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);
    const proof = await saveChatOutputAsProofReport({
      candidateId: candidate.candidate_id,
      proofingContextId: proofing.context.proofing_context_id,
      proofReportText: "The candidate passes proofing.",
      verdict: "pass",
      severity: "none",
    }, options);
    const request = await requestWritingCandidateAdoption({
      candidateId: candidate.candidate_id,
      proofReportId: proof.proof_report_id,
      reason: "E2E user review.",
    }, options);
    const confirmed = await confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      approvedBy: "e2e_user",
    }, options);
    assert(confirmed.result.adopted_chapter_id, "Confirm did not return adopted chapter id.");
    assert(
      confirmed.approval_item.status.status === "resolved",
      "Approval item was not resolved.",
    );
    assert(
      confirmed.approval_item.status.execution_result.adopted_chapter_id
        === confirmed.result.adopted_chapter_id,
      "Approval execution result was not persisted.",
    );
    const adopted = await getAdoptedWritingDetail(
      confirmed.result.adopted_chapter_id,
      options,
    );
    assert(adopted.adoption.candidate_id === candidate.candidate_id, "Adoption link failed.");
    const updated = await getWritingCandidateDetail(candidate.candidate_id, options);
    assert(updated.metadata.adopted === true, "Candidate was not marked adopted.");
    assert(updated.metadata.settled === false, "Candidate was automatically settled.");
    assert(
      (await getApprovalItem(request.approval_item_id, options)).status.status === "resolved",
      "Approval detail did not retain resolved status.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "E2E adoption modified active_engine.md.",
    );
    console.log("Writing candidate adoption E2E test passed.");
  } finally {
    for (const directory of Object.values(options)) {
      await rm(directory, { recursive: true, force: true });
    }
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Writing candidate adoption E2E test failed: ${error.message}`);
  process.exitCode = 1;
});
