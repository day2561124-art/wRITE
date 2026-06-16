import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import {
  adoptWritingCandidateAfterApproval,
  getAdoptedWritingDetail,
  listAdoptedWritings,
} from "../../server/src/writing-candidate-adoption-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".adoption-confirm-test");
const fixtureReports = path.join(projectPaths.proofReports, ".adoption-confirm-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".adoption-confirm-test");
const fixtureAdopted = path.join(projectPaths.adoptedWritings, ".adoption-confirm-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  writingCandidates: fixtureCandidates,
  proofReports: fixtureReports,
  approvalQueue: fixtureApproval,
  adoptedWritings: fixtureAdopted,
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

async function expectReject(action, expected) {
  try {
    await action();
  } catch (error) {
    assert(error.message.includes(expected), `Unexpected error: ${error.message}`);
    return;
  }
  throw new Error(`Expected rejection: ${expected}`);
}

async function createRequest() {
  const candidate = await saveChatOutputAsWritingCandidate({
    chatOutputText: "# Adopt me\n\nExact candidate body.",
  }, options);
  await markCandidateNeuralTraceComplete(candidate.candidate_id);
  const proof = await saveChatOutputAsProofReport({
    candidateId: candidate.candidate_id,
    proofReportText: "Proof passed.",
    verdict: "pass",
    severity: "none",
  }, options);
  const request = await requestWritingCandidateAdoption({
    candidateId: candidate.candidate_id,
    proofReportId: proof.proof_report_id,
  }, options);
  return { candidate, proof, request };
}

async function main() {
  const activeHashBefore = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureCandidates, { recursive: true, force: true });
  await rm(fixtureReports, { recursive: true, force: true });
  await rm(fixtureApproval, { recursive: true, force: true });
  await rm(fixtureAdopted, { recursive: true, force: true });
  try {
    const fixture = await createRequest();
    await expectReject(
      () => adoptWritingCandidateAfterApproval({
        approvalItemId: fixture.request.approval_item_id,
        candidateId: fixture.candidate.candidate_id,
      }, options),
      "requires approval queue confirmation",
    );
    const dryRun = await adoptWritingCandidateAfterApproval({
      approvalItemId: fixture.request.approval_item_id,
      candidateId: fixture.candidate.candidate_id,
      dryRun: true,
    }, { ...options, approvalConfirmed: true });
    assert(dryRun.dry_run && dryRun.adopted === false, "Dry-run adopted candidate.");
    assert((await names(fixtureAdopted)).size === 0, "Dry-run created adopted writing.");

    const adopted = await adoptWritingCandidateAfterApproval({
      approvalItemId: fixture.request.approval_item_id,
      candidateId: fixture.candidate.candidate_id,
      proofReportId: fixture.proof.proof_report_id,
      confirmedBy: "phase_8f_test",
    }, { ...options, approvalConfirmed: true });
    assert(adopted.adopted === true, "Candidate was not adopted.");
    assert(adopted.settlement_created === false, "Settlement was created.");
    assert(adopted.pending_engine_candidate_created === false, "Engine candidate was created.");
    assert(adopted.active_engine_modified === false, "Active engine was modified.");
    const detail = await getAdoptedWritingDetail(adopted.adopted_chapter_id, options);
    const candidateContent = await readFile(
      path.join(fixtureCandidates, fixture.candidate.candidate_id, "candidate.md"),
      "utf8",
    );
    assert(detail.chapter_text === candidateContent, "Adopted content was not an exact copy.");
    assert(
      detail.adoption.record_kind === "adopted_writing_candidate",
      "Adoption record kind drifted.",
    );
    assert(detail.adoption.approved_by_user === true, "User approval flag missing.");
    assert(
      detail.adoption.source === "approval_queue_confirmation",
      "Adoption source drifted.",
    );
    const updated = await getWritingCandidateDetail(fixture.candidate.candidate_id, options);
    assert(updated.metadata.adopted === true, "Candidate metadata was not adopted.");
    assert(updated.metadata.settled === false, "Candidate was settled.");
    assert(
      updated.metadata.adopted_chapter_id === adopted.adopted_chapter_id,
      "Candidate adopted chapter link missing.",
    );
    assert(
      (await listAdoptedWritings({
        candidateId: fixture.candidate.candidate_id,
      }, options)).length === 1,
      "Adopted writing list failed.",
    );
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "Adoption modified active_engine.md.",
    );
    console.log("Writing candidate adoption service test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureReports, { recursive: true, force: true });
    await rm(fixtureApproval, { recursive: true, force: true });
    await rm(fixtureAdopted, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Writing candidate adoption service test failed: ${error.message}`);
  process.exitCode = 1;
});
