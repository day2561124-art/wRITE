import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  agentRunIdPattern,
  createAgentRun,
  finalizeAgentRun,
  getAgentRun,
  listAgentRuns,
  verifyRequiredNeuralModules,
} from "../../server/src/agent-run-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const activeEnginePath = path.join(projectPaths.activeEngine);
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

async function main() {
  const activeHashBefore = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
  const transactionsBefore = await names(transactionDir);
  let runId = "";
  try {
    const run = await createAgentRun({
      task_type: "draft_generation",
      requires_neural_modules: true,
      required_neural_modules: ["scene_planner", "character_simulator"],
      input: "本段文字宣稱已使用神經網路模型，但沒有 neural_trace。",
    });
    runId = run.run_id;
    assert(agentRunIdPattern.test(runId), `Unexpected run_id: ${runId}`);
    assert(run.status === "running", "New agent run was not running.");
    assert((await getAgentRun(runId)).run_id === runId, "getAgentRun returned the wrong run.");
    assert((await listAgentRuns()).some((item) => item.run_id === runId), "listAgentRuns missed the run.");

    const verification = await verifyRequiredNeuralModules(runId);
    assert(!verification.ok, "A text-only neural claim incorrectly satisfied required modules.");
    assert(verification.missing.length === 2, "Required module verification reported the wrong missing count.");
    assert(verification.run.status === "warning", "Missing required modules did not set warning status.");

    const finalized = await finalizeAgentRun(runId, { output: "candidate output" });
    assert(finalized.status === "warning", "Finalization ignored missing neural success traces.");
    assert(typeof finalized.output_hash === "string" && finalized.output_hash.length === 64, "Output hash is invalid.");

    await assertRejects(
      () => getAgentRun("../active_engine"),
      "Invalid run_id was not rejected.",
    );

    const activeHashAfter = createHash("sha256").update(await readFile(activeEnginePath)).digest("hex");
    assert(activeHashAfter === activeHashBefore, "Agent run service changed active_engine.md.");
    console.log("Agent run service test passed.");
  } finally {
    if (runId) await rm(path.join(projectPaths.agentRuns, runId), { recursive: true, force: true });
    await removeNewFiles(transactionDir, transactionsBefore);
  }
}

async function assertRejects(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

main().catch((error) => {
  console.error(`Agent run service test failed: ${error.message}`);
  process.exitCode = 1;
});
