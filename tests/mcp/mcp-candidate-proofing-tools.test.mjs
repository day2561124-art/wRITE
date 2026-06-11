import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import {
  candidateProofingToolMetadata,
  candidateProofingTools,
} from "../../server/src/mcp-candidate-proofing-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".mcp-candidate-proofing-test");
const fixtureContexts = path.join(projectPaths.proofingContexts, ".mcp-candidate-proofing-test");
const fixtureReports = path.join(projectPaths.proofReports, ".mcp-candidate-proofing-test");
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
    const namesToCheck = [
      "build_candidate_proofing_context",
      "get_candidate_proofing_context",
      "list_candidate_proofing_contexts",
      "save_chat_output_as_proof_report",
      "get_proof_report_detail",
      "list_proof_reports",
    ];
    for (const name of namesToCheck) {
      assert(typeof candidateProofingTools[name] === "function", `${name} is missing.`);
      const metadata = candidateProofingToolMetadata[name];
      assert(metadata, `${name} metadata is missing.`);
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_create_approval_item === false, `${name} may create approval items.`);
      assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
      assert(metadata.can_adopt_candidate === false, `${name} may adopt.`);
      assert(metadata.can_settle_candidate === false, `${name} may settle.`);
    }
    const candidate = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# MCP Candidate\n\nBody.",
    }, options);
    const built = await candidateProofingTools.build_candidate_proofing_context({
      candidate_id: candidate.candidate_id,
      include_active_engine: false,
      include_writing_card: false,
      include_proofing_card: false,
      include_longline: false,
    }, options);
    assert(built.ok && built.result.context.proofing_context_id, "MCP context build failed.");
    const contextId = built.result.context.proofing_context_id;
    const saved = await candidateProofingTools.save_chat_output_as_proof_report({
      candidate_id: candidate.candidate_id,
      proofing_context_id: contextId,
      proof_report_text: "Pass with minor notes.",
      verdict: "pass",
      severity: "none",
    }, options);
    assert(saved.ok && saved.result.proof_report_id, "MCP report save failed.");
    const contextList = await candidateProofingTools.list_candidate_proofing_contexts({
      candidate_id: candidate.candidate_id,
    }, options);
    const reportList = await candidateProofingTools.list_proof_reports({
      candidate_id: candidate.candidate_id,
    }, options);
    assert(contextList.result.count === 1, "MCP context list failed.");
    assert(reportList.result.count === 1, "MCP report list failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "MCP proofing tools modified active_engine.md.",
    );
    console.log("MCP candidate proofing tools test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureContexts, { recursive: true, force: true });
    await rm(fixtureReports, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP candidate proofing tools test failed: ${error.message}`);
  process.exitCode = 1;
});
