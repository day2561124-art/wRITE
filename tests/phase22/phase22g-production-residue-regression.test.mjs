import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";
import { fingerprintRoots } from "../helpers/content-fingerprint.mjs";

const roots = {
  gpt_writing_contexts: projectPaths.gptWritingContexts,
  writing_candidates: projectPaths.writingCandidates,
  agent_runs: projectPaths.agentRuns,
  neural_traces: projectPaths.neuralTraces,
  neural_outputs: projectPaths.neuralModuleOutputs,
  transactions: path.join(projectPaths.outputLogs, "transactions"),
};

function runBehavior() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["tests/phase22/phase22g-writing-context-trace.test.mjs"], {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve()
      : reject(new Error(`Phase22G behavior failed with exit code ${code}.`)));
  });
}

const before = await fingerprintRoots(roots);
await runBehavior();
const after = await fingerprintRoots(roots);
assert.deepEqual(after, before, "Phase22G changed production generated-state file bytes.");
console.log("Phase22G production residue byte-exact fingerprint regression PASS.");
