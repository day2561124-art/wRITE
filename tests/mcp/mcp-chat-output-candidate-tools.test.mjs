import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  chatOutputCandidateToolMetadata,
  chatOutputCandidateTools,
} from "../../server/src/mcp-chat-output-candidate-tools.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".mcp-chat-output-candidate-test");
const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".mcp-chat-output-candidate-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  writingCandidates: fixtureCandidates,
  gptWritingContexts: fixtureContexts,
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
  const activeBefore = await readFile(projectPaths.activeEngine);
  const activeHashBefore = hash(activeBefore);
  const transactionsBefore = await names(transactionDir);
  await rm(fixtureCandidates, { recursive: true, force: true });
  await rm(fixtureContexts, { recursive: true, force: true });

  try {
    for (const name of [
      "save_chat_output_as_writing_candidate",
      "get_writing_candidate_detail",
      "list_writing_candidates",
    ]) {
      assert(typeof chatOutputCandidateTools[name] === "function", `${name} is missing.`);
      const metadata = chatOutputCandidateToolMetadata[name];
      assert(metadata, `${name} metadata is missing.`);
      assert(metadata.can_modify_active_engine === false, `${name} may modify active engine.`);
      assert(metadata.can_activate_engine === false, `${name} may activate engine.`);
      assert(metadata.can_approve === false, `${name} may approve.`);
      assert(metadata.can_rollback === false, `${name} may rollback.`);
      assert(metadata.can_execute_cleanup === false, `${name} may execute cleanup.`);
      assert(metadata.can_generate_locally === false, `${name} may generate locally.`);
      assert(metadata.can_adopt_candidate === false, `${name} may adopt candidates.`);
      assert(metadata.can_settle_candidate === false, `${name} may settle candidates.`);
    }

    const context = await buildGptWritingContext({ taskPrompt: "MCP candidate." }, options);
    const saved = await chatOutputCandidateTools.save_chat_output_as_writing_candidate({
      source_bundle_id: context.bundle.bundle_id,
      chat_output_text: "# MCP Candidate\n\nBody.",
    }, options);
    assert(saved.ok && saved.result.candidate_id, "MCP save failed.");
    const candidateId = saved.result.candidate_id;

    const summary = await chatOutputCandidateTools.get_writing_candidate_detail({
      candidate_id: candidateId,
    }, options);
    assert(summary.ok && summary.result.content === null, "Default detail dumped content.");

    const detail = await chatOutputCandidateTools.get_writing_candidate_detail({
      candidate_id: candidateId,
      include_content: true,
      max_content_chars: 8,
    }, options);
    assert(detail.ok && detail.result.content_truncated, "Bounded content read failed.");

    const list = await chatOutputCandidateTools.list_writing_candidates({
      limit: 20,
      source_bundle_id: context.bundle.bundle_id,
    }, options);
    assert(list.ok && list.result.count === 1, "MCP list failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "MCP candidate tools modified active_engine.md.",
    );
    console.log("MCP chat output candidate tools test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureContexts, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`MCP chat output candidate tools test failed: ${error.message}`);
  process.exitCode = 1;
});
