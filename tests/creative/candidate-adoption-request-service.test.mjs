import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateAdoptionRequest,
  listWritingCandidateAdoptionRequests,
  requestWritingCandidateAdoption,
} from "../../server/src/candidate-adoption-request-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".adoption-request-test");
const fixtureReports = path.join(projectPaths.proofReports, ".adoption-request-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".adoption-request-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  writingCandidates: fixtureCandidates,
  proofReports: fixtureReports,
  approvalQueue: fixtureApproval,
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

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
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

async function candidateWithProof(verdict = "pass", severity = "none") {
  const candidate = await saveChatOutputAsWritingCandidate({
    chatOutputText: `# Candidate ${severity}\n\nBody.`,
  }, options);
  await markCandidateNeuralTraceComplete(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidateId: candidate.candidate_id,
    proofReportText: `Proof ${severity}.`,
    verdict,
    severity,
  }, options);
  return { candidate, proof };
}

async function main() {
  const activeHashBefore = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureCandidates, { recursive: true, force: true });
  await rm(fixtureReports, { recursive: true, force: true });
  await rm(fixtureApproval, { recursive: true, force: true });
  try {
    const invalid = await requestWritingCandidateAdoption({
      candidateId: "not-a-candidate",
    }, options);
    assert(invalid.blocked && !invalid.approval_item_created, "Invalid candidate was not blocked.");

    const noProof = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# No proof\n\nBody.",
    }, options);
    const missingProof = await requestWritingCandidateAdoption({
      candidateId: noProof.candidate_id,
    }, options);
    assert(
      missingProof.blocked && missingProof.approval_item_created === false,
      "Unproofed candidate created a normal request.",
    );

    const allowedWithoutProof = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# Exception\n\nBody.",
    }, options);
    await markCandidateNeuralTraceComplete(allowedWithoutProof.candidate_id);
    const exception = await requestWritingCandidateAdoption({
      candidateId: allowedWithoutProof.candidate_id,
      allowWithoutProof: true,
      reason: "Human review requested despite missing proof.",
    }, options);
    assert(exception.ok && exception.status === "pending", "Proof exception request failed.");
    assert(exception.risk_level === "high", "Proof exception did not raise risk.");
    assert(exception.warnings.length === 1, "Proof exception warning missing.");

    const { candidate, proof } = await candidateWithProof();
    const requested = await requestWritingCandidateAdoption({
      candidateId: candidate.candidate_id,
      proofReportId: proof.proof_report_id,
      requestedBy: "phase_8e_test",
      reason: "Ready for approval review.",
      riskLevel: "medium",
    }, options);
    assert(requested.ok && requested.status === "pending", "Adoption request was not pending.");
    assert(requested.action_type === "adopt_writing_candidate", "Action type drifted.");
    assert(requested.risk_level === "medium", "P2 risk mapping failed.");
    assert(requested.safety.direct_adoption_performed === false, "Direct adoption occurred.");
    assert(requested.safety.adopted_chapter_created === false, "Adopted chapter was created.");
    const detail = await getWritingCandidateAdoptionRequest(requested.request_id, options);
    assert(detail.requires_user_confirmation === true, "Confirmation requirement missing.");
    assert(
      detail.can_execute_without_user_confirmation === false,
      "Request can execute without confirmation.",
    );
    assert(detail.candidate_hash === candidate.candidate_hash, "Candidate hash missing.");
    assert(detail.proof_report_hash === proof.proof_report_hash, "Proof hash missing.");
    const updated = await getWritingCandidateDetail(candidate.candidate_id, options);
    assert(updated.metadata.adoption_requested === true, "Candidate request flag missing.");
    assert(
      updated.metadata.latest_adoption_request_id === requested.request_id,
      "Candidate latest request link missing.",
    );
    assert(updated.metadata.canon_status === "candidate_only", "Candidate became canon.");
    assert(updated.metadata.adopted === false, "Candidate was adopted.");
    assert(updated.metadata.settled === false, "Candidate was settled.");

    const other = await candidateWithProof("pass", "none");
    const mismatch = await requestWritingCandidateAdoption({
      candidateId: other.candidate.candidate_id,
      proofReportId: proof.proof_report_id,
    }, options);
    assert(mismatch.blocked && !mismatch.approval_item_created, "Mismatched proof was accepted.");

    const critical = await candidateWithProof("blocked", "P0");
    const blocked = await requestWritingCandidateAdoption({
      candidateId: critical.candidate.candidate_id,
      proofReportId: critical.proof.proof_report_id,
    }, options);
    assert(blocked.blocked && blocked.status === "blocked", "P0 request was not blocked.");
    assert(blocked.approval_item_created === false, "P0 blocked request created approval item.");

    const dryCandidate = await candidateWithProof("pass", "none");
    const countBeforeDryRun = (await listWritingCandidateAdoptionRequests({}, options)).length;
    const dryRun = await requestWritingCandidateAdoption({
      candidateId: dryCandidate.candidate.candidate_id,
      dryRun: true,
    }, options);
    assert(dryRun.dry_run && !dryRun.approval_item_created, "Dry-run created an item.");
    assert(
      (await listWritingCandidateAdoptionRequests({}, options)).length === countBeforeDryRun,
      "Dry-run changed the approval queue.",
    );
    const filtered = await listWritingCandidateAdoptionRequests({
      candidateId: candidate.candidate_id,
      status: "pending",
      riskLevel: "medium",
    }, options);
    assert(filtered.length === 1, "Adoption request list filter failed.");
    assert(
      !await exists(path.join(projectPaths.adoptedChapters, ".adoption-request-test")),
      "Adopted chapter fixture was created.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "Adoption request modified active_engine.md.",
    );
    console.log("Candidate adoption request service test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureReports, { recursive: true, force: true });
    await rm(fixtureApproval, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Candidate adoption request service test failed: ${error.message}`);
  process.exitCode = 1;
});
