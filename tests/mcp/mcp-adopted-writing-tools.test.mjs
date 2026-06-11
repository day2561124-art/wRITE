import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { requestWritingCandidateAdoption } from "../../server/src/candidate-adoption-request-service.mjs";
import { saveChatOutputAsProofReport } from "../../server/src/candidate-proof-report-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import {
  adoptedWritingToolMetadata,
  adoptedWritingTools,
} from "../../server/src/mcp-adopted-writing-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".mcp-adopted-writing-test";
const options = {
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

async function main() {
  const activeBefore = await readFile(projectPaths.activeEngine);
  const transactionsBefore = await names(transactionDir);
  for (const directory of Object.values(options)) {
    await rm(directory, { recursive: true, force: true });
  }
  try {
    for (const name of ["get_adopted_writing_detail", "list_adopted_writings"]) {
      assert(typeof adoptedWritingTools[name] === "function", `${name} is missing.`);
      const metadata = adoptedWritingToolMetadata[name];
      assert(metadata.permission === "read_only", `${name} is not read-only.`);
      assert(metadata.writes_files === false, `${name} writes files.`);
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_adopt_candidate_directly === false, `${name} may adopt directly.`);
      assert(metadata.can_settle_candidate === false, `${name} may settle.`);
    }
    assert(
      adoptedWritingTools.confirm_writing_candidate_adoption === undefined,
      "MCP exposed an adoption confirm tool.",
    );
    const candidate = await saveChatOutputAsWritingCandidate({
      chatOutputText: "# MCP adopted\n\nBody.",
    }, options);
    const proof = await saveChatOutputAsProofReport({
      candidateId: candidate.candidate_id,
      proofReportText: "Pass.",
      verdict: "pass",
      severity: "none",
    }, options);
    const request = await requestWritingCandidateAdoption({
      candidateId: candidate.candidate_id,
      proofReportId: proof.proof_report_id,
    }, options);
    const confirmed = await confirmApprovalItem(request.approval_item_id, {
      confirm: true,
      approvedBy: "mcp_test_user",
    }, options);
    const detail = await adoptedWritingTools.get_adopted_writing_detail({
      adopted_chapter_id: confirmed.result.adopted_chapter_id,
    }, options);
    const listed = await adoptedWritingTools.list_adopted_writings({
      candidate_id: candidate.candidate_id,
    }, options);
    assert(detail.ok && detail.result.adoption.approved_by_user, "MCP detail failed.");
    assert(listed.ok && listed.result.count === 1, "MCP list failed.");
    assert(
      Buffer.compare(await readFile(projectPaths.activeEngine), activeBefore) === 0,
      "MCP adopted writing tools modified active_engine.md.",
    );
    console.log("MCP adopted writing tools test passed.");
  } finally {
    for (const directory of Object.values(options)) {
      await rm(directory, { recursive: true, force: true });
    }
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP adopted writing tools test failed: ${error.message}`);
  process.exitCode = 1;
});
