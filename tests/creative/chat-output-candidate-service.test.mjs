import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  listWritingCandidates,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".chat-output-candidate-test");
const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".chat-output-candidate-test");
const fixtureWorkflow = path.join(projectPaths.writingWorkflow, ".chat-output-candidate-test");
const fixtureApproval = path.join(projectPaths.approvalQueue, ".chat-output-candidate-test");
const fixturePending = path.join(projectPaths.canonDb, ".chat-output-candidate-test-pending");
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

async function expectReject(action, expected) {
  try {
    await action();
  } catch (error) {
    assert(error.message.includes(expected), `Unexpected error: ${error.message}`);
    return;
  }
  throw new Error(`Expected rejection containing: ${expected}`);
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const transactionsBefore = await names(transactionDir);
  await Promise.all([
    rm(fixtureCandidates, { recursive: true, force: true }),
    rm(fixtureContexts, { recursive: true, force: true }),
    rm(fixtureWorkflow, { recursive: true, force: true }),
    rm(fixtureApproval, { recursive: true, force: true }),
    rm(fixturePending, { recursive: true, force: true }),
  ]);

  try {
    const context = await buildGptWritingContext({
      taskPrompt: "Write a candidate in chat.",
    }, options);
    const text = "# Candidate\n\nChat output body.";
    const saved = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      chat_output_text: `  ${text}  `,
      title: "Candidate title",
      chapter_label: "Chapter 14",
      task_prompt: "Write a candidate in chat.",
      notes: "Pasted from GPT.",
    }, options);
    assert(saved.candidate_created === true, "Candidate was not created.");
    assert(saved.canon_status === "candidate_only", "Candidate canon status was wrong.");
    assert(saved.adopted === false && saved.settled === false, "Candidate was promoted.");
    assert(saved.proofed === false, "Candidate was proofed.");
    assert(saved.candidate_hash === hash(text), "Candidate hash was wrong.");

    const detail = await getWritingCandidateDetail(saved.candidate_id, {
      ...options,
      includeContent: true,
      maxContentChars: 10,
    });
    assert(
      detail.metadata.candidate_kind === "chat_output_writing_candidate",
      "Candidate kind was wrong.",
    );
    assert(
      detail.metadata.source_bundle_id === context.bundle.bundle_id,
      "Candidate did not retain source bundle id.",
    );
    assert(
      detail.metadata.source_bundle_path === context.context_bundle_path,
      "Candidate did not retain source bundle path.",
    );
    assert(
      detail.metadata.context_for_chat_path === context.context_for_chat_path,
      "Candidate did not retain chat context path.",
    );
    assert(
      detail.metadata.source_active_engine_hash
        === context.bundle.sources.active_engine.hash,
      "Candidate did not retain source active engine hash.",
    );
    assert(detail.content_truncated === true, "Bounded content was not truncated.");

    const storedText = await readFile(
      path.join(fixtureCandidates, saved.candidate_id, "candidate.md"),
      "utf8",
    );
    assert(storedText.trim() === text, "Candidate markdown content was wrong.");
    const listed = await listWritingCandidates({
      source_bundle_id: context.bundle.bundle_id,
      canon_status: "candidate_only",
      limit: 20,
    }, options);
    assert(listed.length === 1, "Candidate list filter failed.");
    assert(!("content" in listed[0]), "Candidate list dumped content.");

    const untraced = await saveChatOutputAsWritingCandidate({
      chatOutputText: "Untraced candidate.",
      source: "manual_paste",
    }, options);
    assert(
      untraced.warnings.some((warning) => warning.includes("source_bundle_id missing")),
      "Missing bundle warning was omitted.",
    );

    const beforeDryRun = await names(fixtureCandidates);
    const dryRun = await saveChatOutputAsWritingCandidate({
      chatOutputText: "Dry-run candidate.",
      dryRun: true,
    }, options);
    assert(dryRun.candidate_created === false, "Dry-run created a candidate.");
    assert(
      JSON.stringify([...await names(fixtureCandidates)].sort())
        === JSON.stringify([...beforeDryRun].sort()),
      "Dry-run changed candidate directories.",
    );

    await expectReject(
      () => saveChatOutputAsWritingCandidate({}, options),
      "chat_output_text is required",
    );
    await expectReject(
      () => saveChatOutputAsWritingCandidate({
        chatOutputText: "x",
        sourceBundleId: "gptctx_20260612-000000-00000000",
      }, options),
      "ENOENT",
    );
    assert((await names(fixtureWorkflow)).size === 0, "Service created proof/workflow records.");
    assert((await names(fixtureApproval)).size === 0, "Service created approval records.");
    assert((await names(fixturePending)).size === 0, "Service created settlement candidates.");
    assert(
      hash(await readFile(projectPaths.activeEngine)) === productionHash,
      "Service modified active_engine.md.",
    );
    console.log("Chat output candidate service test passed.");
  } finally {
    await Promise.all([
      rm(fixtureCandidates, { recursive: true, force: true }),
      rm(fixtureContexts, { recursive: true, force: true }),
      rm(fixtureWorkflow, { recursive: true, force: true }),
      rm(fixtureApproval, { recursive: true, force: true }),
      rm(fixturePending, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Chat output candidate service test failed: ${error.message}`);
  process.exitCode = 1;
});
