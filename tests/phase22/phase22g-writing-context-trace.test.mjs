import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const fixture = ".phase22g-writing-context-test";
  const roots = {
    gptWritingContexts: path.join(projectPaths.gptWritingContexts, fixture),
    writingCandidates: path.join(projectPaths.writingCandidates, fixture),
  };
  await rm(roots.gptWritingContexts, { recursive: true, force: true });
  await rm(roots.writingCandidates, { recursive: true, force: true });

  // 1) success adapter scenario
  const adapter = async (input, ctx) => ({ ok: true, result: { summary: "ok" } });
  const ctxResult = await buildGptWritingContext({
    task_prompt: "Phase22G test: materialize traces",
    include_active_engine: false,
    run_neural_traces: true,
  }, { gptWritingContexts: roots.gptWritingContexts, neuralAdapter: adapter });
  assert(ctxResult.bundle.neural_modules_used && ctxResult.bundle.neural_modules_used.length > 0, "neural_modules_used missing on success adapter");
  assert(ctxResult.bundle.neural_trace_complete === true, "neural_trace_complete should be true with success adapter");

  // read persisted bundle file
  const bundlePath = ctxResult.context_bundle_path;
  const bundleText = await readFile(path.join(process.cwd(), bundlePath), "utf8");
  const bundleJson = JSON.parse(bundleText);
  assert(Array.isArray(bundleJson.neural_modules_used) && bundleJson.neural_modules_used.length > 0, "persisted bundle missing neural_modules_used");

  // 2) no adapter scenario (should produce skipped/ warnings)
  const ctxResult2 = await buildGptWritingContext({
    task_prompt: "Phase22G test: no adapter",
    include_active_engine: false,
    run_neural_traces: true,
  }, { gptWritingContexts: roots.gptWritingContexts });
  // when no adapter, wrappers record skipped and neural_trace_complete should be false
  assert(Array.isArray(ctxResult2.bundle.neural_modules_used) && ctxResult2.bundle.neural_modules_used.length === 0, "neural_modules_used should be empty when no adapter");
  assert(ctxResult2.bundle.neural_trace_complete === false, "neural_trace_complete should be false when no adapter");

  // 3) end-to-end: build with adapter then save candidate and ensure candidate has inherited modules
  const ctxResult3 = await buildGptWritingContext({
    task_prompt: "Phase22G test: e2e",
    include_active_engine: false,
    run_neural_traces: true,
  }, { gptWritingContexts: roots.gptWritingContexts, neuralAdapter: adapter, writingCandidates: roots.writingCandidates });
  const saveResult = await saveChatOutputAsWritingCandidate({
    source_bundle_id: ctxResult3.bundle.bundle_id,
    chat_output_text: "Phase22G end-to-end candidate",
    title: "Phase22G e2e",
    chapter: "Phase22G",
  }, { writingCandidates: roots.writingCandidates, gptWritingContexts: roots.gptWritingContexts });
  // load candidate metadata
  const candidateMetaPath = saveResult.candidate_meta_path ?? saveResult.metadata_path ?? null;
  // saveChatOutputAsWritingCandidate returns publicResult; locate metadata file via returned candidate_id
  const candidateId = saveResult.candidate_id;
  const candidateMetaText = await readFile(path.join(roots.writingCandidates, candidateId, "candidate.json"), "utf8");
  const candidateMeta = JSON.parse(candidateMetaText);
  assert(Array.isArray(candidateMeta.neural_modules_used) && candidateMeta.neural_modules_used.length > 0, "candidate did not inherit neural_modules_used");
  assert(candidateMeta.neural_trace_complete === true, "candidate neural_trace_complete should be true after successful traces");
  assert(!candidateMeta.warnings || !candidateMeta.warnings.includes("missing_required_neural_modules"), "candidate still reported missing_required_neural_modules despite successful traces");

  console.log("Phase22G writing context trace tests passed.");
}

run().catch((err) => { console.error(err); process.exit(1); });
