import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildCandidateProofingContext,
  getCandidateProofingContext,
  listCandidateProofingContexts,
} from "../../server/src/candidate-proofing-context-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".candidate-proofing-context-test");
const fixtureContexts = path.join(projectPaths.proofingContexts, ".candidate-proofing-context-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");
const options = {
  writingCandidates: fixtureCandidates,
  proofingContexts: fixtureContexts,
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
  try {
    const candidate = await saveChatOutputAsWritingCandidate({
      chatOutputText: `# Candidate\n\n${"A".repeat(500)}`,
      title: "Proofing context fixture",
    }, options);
    const built = await buildCandidateProofingContext({
      candidateId: candidate.candidate_id,
      proofingMode: "style_only",
      retrievalContext: { scene: "hallway" },
      generationContext: { chapter: 12 },
      maxContextChars: 300,
    }, options);
    assert(built.context.candidate_id === candidate.candidate_id, "Candidate link missing.");
    assert(built.context.proofing_mode === "style_only", "Proofing mode mismatch.");
    assert(built.context.for_chat_output === true, "Context is not chat-facing.");
    assert(built.context.local_generation_allowed === false, "Local generation was allowed.");
    assert(built.context.approval_item_creation_allowed === false, "Approval creation was allowed.");
    assert(built.context.canon_update_allowed === false, "Canon update was allowed.");
    assert(built.context.truncated_sections.length > 0, "Context budget was not enforced.");
    const loaded = await getCandidateProofingContext(
      built.context.proofing_context_id,
      options,
    );
    assert(
      loaded.proofing_for_chat.includes("Proofing Output Rules"),
      "Chat proofing instructions missing.",
    );
    const listed = await listCandidateProofingContexts({
      candidateId: candidate.candidate_id,
      proofingMode: "style_only",
    }, options);
    assert(listed.length === 1, "Proofing context list filter failed.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === activeHashBefore,
      "Proofing context modified active_engine.md.",
    );
    console.log("Candidate proofing context service test passed.");
  } finally {
    await rm(fixtureCandidates, { recursive: true, force: true });
    await rm(fixtureContexts, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Candidate proofing context service test failed: ${error.message}`);
  process.exitCode = 1;
});
