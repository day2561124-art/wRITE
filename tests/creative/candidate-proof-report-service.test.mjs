import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import {
  buildCandidateProofingContext,
} from "../../server/src/candidate-proofing-context-service.mjs";
import {
  getProofReportDetail,
  listProofReports,
  saveChatOutputAsProofReport,
} from "../../server/src/candidate-proof-report-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".candidate-proof-report-test");
const fixtureContexts = path.join(projectPaths.proofingContexts, ".candidate-proof-report-test");
const fixtureReports = path.join(projectPaths.proofReports, ".candidate-proof-report-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  writingCandidates: fixtureCandidates,
  proofingContexts: fixtureContexts,
  proofReports: fixtureReports,
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

async function main() {
  const activeHashBefore = hash(await readFile(projectPaths.activeEngine));
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureCandidates, { recursive: true, force: true });
  await rm(fixtureContexts, { recursive: true, force: true });
  await rm(fixtureReports, { recursive: true, force: true });
  try {
    const first = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# Candidate\n\nBody.",
    }, options);
    const second = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# Other\n\nBody.",
    }, options);
    const context = await buildCandidateProofingContext({
      candidateId: first.candidate_id,
      includeActiveEngine: false,
      includeWritingCard: false,
      includeProofingCard: false,
      includeLongline: false,
    }, options);

    let mismatchBlocked = false;
    try {
      await saveChatOutputAsProofReport({
        candidateId: second.candidate_id,
        proofingContextId: context.context.proofing_context_id,
        proofReportText: "Mismatch.",
      }, options);
    } catch (error) {
      mismatchBlocked = error.message.includes("does not belong");
    }
    assert(mismatchBlocked, "Mismatched proofing context was accepted.");

    const saved = await saveChatOutputAsProofReport({
      candidateId: first.candidate_id,
      proofingContextId: context.context.proofing_context_id,
      proofReportText: "# Proof\n\nRevise the transition.",
      verdict: "needs_revision",
      severity: "P2",
      summary: "One continuity issue.",
    }, options);
    assert(saved.proof_report_created === true, "Proof report was not created.");
    const detail = await getProofReportDetail(saved.proof_report_id, options);
    assert(detail.metadata.canon_status === "candidate_only", "Report escaped candidate state.");
    assert(detail.metadata.approval_item_created === false, "Approval item was created.");
    const candidate = await getWritingCandidateDetail(first.candidate_id, options);
    assert(candidate.metadata.proofed === true, "Candidate was not marked proofed.");
    assert(
      candidate.metadata.latest_proof_report_id === saved.proof_report_id,
      "Latest proof report was not linked.",
    );
    assert(candidate.metadata.proof_report_ids.length === 1, "Proof history was not appended.");
    assert(candidate.metadata.adopted === false, "Candidate was adopted.");
    assert(candidate.metadata.settled === false, "Candidate was settled.");
    assert(candidate.metadata.canon_update_allowed === false, "Canon update was enabled.");
    const listed = await listProofReports({
      candidateId: first.candidate_id,
      verdict: "needs_revision",
      severity: "P2",
    }, options);
    assert(listed.length === 1, "Proof report list filter failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "Proof report save modified active_engine.md.",
    );
    console.log("Candidate proof report service test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureContexts, { recursive: true, force: true });
    await rm(fixtureReports, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Candidate proof report service test failed: ${error.message}`);
  process.exitCode = 1;
});
