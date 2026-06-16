import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import {
  candidateAdoptionRequestToolMetadata,
  candidateAdoptionRequestTools,
} from "../../server/src/mcp-candidate-adoption-request-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".mcp-adoption-request-test");
const fixtureReports = path.join(projectPaths.proofReports, ".mcp-adoption-request-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".mcp-adoption-request-test");
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
  await rm(fixtureCandidates, { recursive: true, force: true });
  await rm(fixtureReports, { recursive: true, force: true });
  await rm(fixtureApproval, { recursive: true, force: true });
  try {
    const toolNames = [
      "request_writing_candidate_adoption",
      "get_writing_candidate_adoption_request",
      "list_writing_candidate_adoption_requests",
    ];
    for (const name of toolNames) {
      assert(typeof candidateAdoptionRequestTools[name] === "function", `${name} is missing.`);
      const metadata = candidateAdoptionRequestToolMetadata[name];
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_activate_engine === false, `${name} may activate engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_rollback === false, `${name} may rollback.`);
      assert(metadata.can_execute_cleanup === false, `${name} may execute cleanup.`);
      assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
      assert(metadata.can_adopt_candidate_directly === false, `${name} may adopt directly.`);
      assert(metadata.can_settle_candidate === false, `${name} may settle.`);
    }
    assert(
      candidateAdoptionRequestToolMetadata.request_writing_candidate_adoption
        .creates_approval_item === true,
      "Request tool does not declare approval-item creation.",
    );
    assert(
      candidateAdoptionRequestToolMetadata.request_writing_candidate_adoption
        .requires_user_confirmation === true,
      "Request tool does not require user confirmation.",
    );

    const candidate = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# MCP adoption candidate\n\nBody.",
    }, options);
    await markCandidateNeuralTraceComplete(candidate.candidate_id);
    await saveChatOutputAsProofReport({
      candidateId: candidate.candidate_id,
      proofReportText: "Proof complete.",
      verdict: "pass",
      severity: "none",
    }, options);
    const requested = await candidateAdoptionRequestTools.request_writing_candidate_adoption({
      candidate_id: candidate.candidate_id,
      reason: "MCP review request.",
    }, options);
    assert(requested.ok && requested.result.approval_item_id, "MCP request failed.");
    const detail = await candidateAdoptionRequestTools.get_writing_candidate_adoption_request({
      request_id: requested.result.request_id,
    }, options);
    assert(detail.ok && detail.result.target_id === candidate.candidate_id, "MCP get failed.");
    const listed = await candidateAdoptionRequestTools.list_writing_candidate_adoption_requests({
      candidate_id: candidate.candidate_id,
      limit: 20,
    }, options);
    assert(listed.ok && listed.result.count === 1, "MCP list failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "MCP adoption request tools modified active_engine.md.",
    );
    console.log("MCP candidate adoption request tools test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureReports, { recursive: true, force: true });
    await rm(fixtureApproval, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP candidate adoption request tools test failed: ${error.message}`);
  process.exitCode = 1;
});
