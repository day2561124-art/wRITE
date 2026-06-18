import { writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { createAgentRun } from "../../server/src/agent-run-service.mjs";
import { summarizeNeuralUsageForRun } from "../../server/src/neural-trace-service.mjs";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function isoStamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

async function writeTrace(runId, opts = {}) {
  const traceId = `neural_trace_${isoStamp()}-${randomBytes(4).toString("hex")}`;
  const trace = {
    run_id: runId,
    trace_id: traceId,
    task_type: opts.task_type ?? "test",
    module_name: opts.module_name,
    model_name: opts.model_name ?? "local",
    model_version: opts.model_version ?? "v1",
    called_at: new Date().toISOString(),
    input_hash: opts.input_hash ?? "a".repeat(64),
    output_hash: opts.output_hash ?? "b".repeat(64),
    status: opts.status ?? "success",
    latency_ms: opts.latency_ms ?? 1,
    warnings: [],
    error_message: null,
    input_summary: {},
    output_summary: {},
  };
  const filePath = path.join(projectPaths.neuralTraces, `${traceId}.json`);
  await writeFile(filePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  return trace;
}

async function main() {
  // 1) Normalization: adapter-like trace using runner name should be canonicalized
  const run = await createAgentRun({
    task_type: "test",
    requires_neural_modules: true,
    required_neural_modules: [
      "scene_planner",
      "character_simulator",
      "neural_critic",
      "style_drift_detector",
      "over_governance_detector",
      "writing_card_director",
    ],
    input: "neural normalization test",
  });
  const runId = run.run_id;

  // write traces with mixed module naming (some with run_ prefix)
  await writeTrace(runId, { module_name: "run_scene_planner" });
  await writeTrace(runId, { module_name: "character_simulator" });
  await writeTrace(runId, { module_name: "run_neural_critic" });
  await writeTrace(runId, { module_name: "style_drift_detector" });
  await writeTrace(runId, { module_name: "run_over_governance_detector" });
  await writeTrace(runId, { module_name: "run_writing_card_director" });

  const summary = await summarizeNeuralUsageForRun(runId);
  // all successful modules should be canonical keys
  const expected = [
    "scene_planner",
    "character_simulator",
    "neural_critic",
    "style_drift_detector",
    "over_governance_detector",
    "writing_card_director",
  ];
  for (const name of expected) {
    assert(summary.neural_modules_used.includes(name), `expected module used: ${name}`);
  }
  assert(summary.missing_required_neural_modules.length === 0, "no missing required modules");

  // 2) Missing module case
  const run2 = await createAgentRun({
    task_type: "test",
    requires_neural_modules: true,
    required_neural_modules: ["scene_planner", "character_simulator"],
    input: "neural missing test",
  });
  const run2Id = run2.run_id;
  await writeTrace(run2Id, { module_name: "run_scene_planner" });
  // character_simulator missing
  const summary2 = await summarizeNeuralUsageForRun(run2Id);
  assert(summary2.neural_modules_used.includes("scene_planner"), "scene_planner present");
  assert(summary2.missing_required_neural_modules.length === 1, "one missing module expected");
  assert(summary2.missing_required_neural_modules[0] === "character_simulator", "missing character_simulator");

  // 3) active_engine hash should remain unchanged after building context with traces
  const activeEnginePath = projectPaths.activeEngine;
  const before = await readFile(activeEnginePath, "utf8");
  const beforeHash = sha256(before);

  // call bridge tool to build writing context (it will create its own run but should not mutate active engine)
  await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: "Phase22O active engine hash test",
    run_neural_traces: false,
    include_active_engine: true,
  }, {});

  const after = await readFile(activeEnginePath, "utf8");
  const afterHash = sha256(after);
  assert(beforeHash === afterHash, "active_engine file hash changed");

  console.log("Phase22O neural trace normalization tests passed.");
}

main().catch((err) => {
  console.error(`Phase22O tests failed: ${err.message}`);
  process.exitCode = 1;
});
