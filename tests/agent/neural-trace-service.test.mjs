import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  createAgentRun,
  verifyRequiredNeuralModules,
} from "../../server/src/agent-run-service.mjs";
import {
  createNeuralTrace,
  getNeuralTrace,
  neuralTraceIdPattern,
  summarizeNeuralUsageForRun,
} from "../../server/src/neural-trace-service.mjs";
import {
  run_character_simulator,
  run_scene_planner,
} from "../../server/src/neural-module-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function names(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewFiles(dirPath, before) {
  for (const name of await names(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

async function assertRejects(action, expectedText, message) {
  try {
    await action();
  } catch (error) {
    assert(String(error.message).includes(expectedText), `${message}: ${error.message}`);
    return;
  }
  throw new Error(message);
}

async function main() {
  const transactionsBefore = await names(transactionDir);
  const traceNamesBefore = await names(projectPaths.neuralTraces);
  let runId = "";
  try {
    const run = await createAgentRun({
      task_type: "test",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner", "character_simulator"],
      input: "neural wrapper contract",
    });
    runId = run.run_id;

    const skipped = await run_character_simulator("character input", {
      run_id: runId,
      task_type: "test",
    });
    assert(skipped.trace.status === "skipped", "Missing adapter did not produce skipped.");
    assert(neuralTraceIdPattern.test(skipped.trace.trace_id), "Skipped trace_id is invalid.");

    const failed = await run_character_simulator("character input", {
      run_id: runId,
      task_type: "test",
      adapter: async () => {
        throw new Error("fixture adapter failure");
      },
    });
    assert(failed.trace.status === "failed", "Throwing adapter did not produce failed.");
    assert(failed.trace.error_message.includes("fixture adapter failure"), "Failed trace missed error_message.");

    const success = await run_scene_planner("scene input", {
      run_id: runId,
      task_type: "test",
      adapter: async () => ({ beats: ["arrival", "choice"] }),
    });
    assert(success.trace.status === "success", "Successful adapter did not produce success.");
    assert(success.trace.input_hash?.length === 64, "Success trace input_hash is invalid.");
    assert(success.trace.output_hash?.length === 64, "Success trace output_hash is invalid.");
    assert(Number.isInteger(success.trace.latency_ms) && success.trace.latency_ms >= 0, "Success latency is invalid.");
    assert((await getNeuralTrace(success.trace.trace_id)).trace_id === success.trace.trace_id, "Trace read failed.");

    const modulesPath = path.join(projectPaths.agentRuns, runId, "neural_modules_used.json");
    const modulesUsed = JSON.parse(await readFile(modulesPath, "utf8")).neural_modules_used;
    assert(modulesUsed.length === 3, "neural_modules_used.json was not updated for every wrapper call.");

    const summary = await summarizeNeuralUsageForRun(runId);
    assert(summary.used_neural_network === true, "Success trace did not mark neural usage.");
    assert(summary.success_count === 1, "Neural usage success count is wrong.");
    assert(summary.failed_count === 1, "Neural usage failed count is wrong.");
    assert(summary.skipped_count === 1, "Neural usage skipped count is wrong.");

    const verification = await verifyRequiredNeuralModules(runId);
    assert(!verification.ok, "Missing character_simulator success was not detected.");
    assert(
      verification.missing.length === 1 && verification.missing[0] === "character_simulator",
      "Required module verification returned the wrong missing module.",
    );

    await assertRejects(
      () => createNeuralTrace({
        run_id: runId,
        task_type: "test",
        module_name: "scene_planner",
        model_name: "fake",
        model_version: "v0",
        status: "success",
        input_hash: "a".repeat(64),
        output_hash: "b".repeat(64),
      }),
      "only be created by a neural module wrapper",
      "Direct success trace creation was allowed.",
    );
    await assertRejects(
      () => getNeuralTrace("../run.json"),
      "trace_id is invalid",
      "Invalid trace_id was not rejected.",
    );

    console.log("Neural trace service test passed.");
  } finally {
    if (runId) await rm(path.join(projectPaths.agentRuns, runId), { recursive: true, force: true });
    await removeNewFiles(projectPaths.neuralTraces, traceNamesBefore);
    await removeNewFiles(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Neural trace service test failed: ${error.message}`);
  process.exitCode = 1;
});
