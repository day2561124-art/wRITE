import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase22g-writing-context-trace-${process.pid}-${Date.now()}`,
);

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  await Promise.all([
    "data/outputs/gpt_writing_contexts",
    "data/outputs/writing_candidates",
    "data/agent_runs",
    "data/agent_runs/neural_traces",
    "data/agent_runs/neural_outputs",
    "data/outputs/logs/transactions",
  ].map((relativePath) => mkdir(path.join(fixtureRoot, relativePath), { recursive: true })));

  const adapter = async () => ({ ok: true, result: { summary: "ok" } });
  const options = { fixtureRoot, neuralAdapter: adapter };
  const ctxResult = await buildGptWritingContext({
    task_prompt: "Phase22G test: materialize traces",
    include_active_engine: false,
    run_neural_traces: true,
  }, options);
  assert(ctxResult.bundle.neural_modules_used?.length > 0, "neural_modules_used missing on success adapter");
  assert.equal(ctxResult.bundle.neural_trace_complete, true);

  const bundleText = await readFile(path.join(projectRoot, ctxResult.context_bundle_path), "utf8");
  const bundleJson = JSON.parse(bundleText);
  assert(bundleJson.neural_modules_used?.length > 0, "persisted bundle missing neural_modules_used");

  const ctxResult2 = await buildGptWritingContext({
    task_prompt: "Phase22G test: no adapter",
    include_active_engine: false,
    run_neural_traces: true,
  }, { fixtureRoot });
  assert.deepEqual(ctxResult2.bundle.neural_modules_used, []);
  assert.equal(ctxResult2.bundle.neural_trace_complete, false);

  const ctxResult3 = await buildGptWritingContext({
    task_prompt: "Phase22G test: e2e",
    include_active_engine: false,
    run_neural_traces: true,
  }, options);
  const saveResult = await saveChatOutputAsWritingCandidate({
    source_bundle_id: ctxResult3.bundle.bundle_id,
    chat_output_text: "Phase22G end-to-end candidate",
    title: "Phase22G e2e",
    chapter: "Phase22G",
  }, { fixtureRoot });
  const candidateMetaText = await readFile(path.join(
    fixtureRoot,
    "data",
    "outputs",
    "writing_candidates",
    saveResult.candidate_id,
    "candidate.json",
  ), "utf8");
  const candidateMeta = JSON.parse(candidateMetaText);
  assert(candidateMeta.neural_modules_used?.length > 0, "candidate did not inherit neural_modules_used");
  assert.equal(candidateMeta.neural_trace_complete, true);
  assert(!candidateMeta.warnings?.includes("missing_required_neural_modules"));

  console.log("Phase22G writing context trace tests passed with isolated generated state.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
