import { rm } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const fixture = ".phase22h-neural-trace-option-test";
  const root = path.join(projectPaths.gptWritingContexts, fixture);
  await rm(root, { recursive: true, force: true });

  const adapter = async () => ({ ok: true, result: { summary: "phase22h-ok" } });
  const camelAliasResult = await buildGptWritingContext({
    task_prompt: "Phase22H test: camel alias trace opt-in",
    include_active_engine: false,
    runNeuralTraces: true,
  }, { gptWritingContexts: root, neuralAdapter: adapter });

  assert(
    camelAliasResult.bundle.neural_trace_complete === true,
    "runNeuralTraces alias should enable neural trace materialization with an adapter",
  );
  assert(
    Array.isArray(camelAliasResult.bundle.neural_modules_used)
      && camelAliasResult.bundle.neural_modules_used.length > 0,
    "runNeuralTraces alias should populate neural_modules_used with an adapter",
  );

  const noAdapterResult = await buildGptWritingContext({
    task_prompt: "Phase22H test: no adapter trace opt-in",
    include_active_engine: false,
    run_neural_traces: true,
  }, { gptWritingContexts: root });

  assert(
    noAdapterResult.bundle.neural_trace_complete === false,
    "run_neural_traces without an adapter should remain incomplete instead of faking trace success",
  );
  assert(
    (Array.isArray(noAdapterResult.bundle.neural_trace_warnings)
      && noAdapterResult.bundle.neural_trace_warnings.length > 0)
      || (Array.isArray(noAdapterResult.bundle.neural_traces)
        && noAdapterResult.bundle.neural_traces.some((trace) => trace.status === "skipped")),
    "run_neural_traces without an adapter should record skipped/warning trace status",
  );

  console.log("Phase22H neural trace option exposure tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
