import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectWorkingTreeChangedPaths,
  selectAffectedTestPlan,
} from "./affected-test-selector.mjs";
import { runTestSteps } from "./test-runner-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), "..");

const suiteScripts = Object.freeze({
  communication: "tests/run-communication.mjs",
  memory_retrieval: "tests/run-memory-retrieval.mjs",
  cognition: "tests/run-cognition.mjs",
  world_simulation: "tests/run-world-simulation.mjs",
  all: "tests/run-all.mjs",
});

const changedPaths = await collectWorkingTreeChangedPaths(rootDir);
const plan = await selectAffectedTestPlan({ projectRoot: rootDir, changedPaths });

console.log("Affected test plan:");
console.log(JSON.stringify(plan, null, 2));
if (plan.focused && plan.certification_required) {
  console.log(
    `Deferred ${plan.deferred_certification_tests.length} transitive certification tests to the final all gate.`,
  );
}

const requiredSuites = plan.required_suites ?? [plan.suite];
const steps = requiredSuites.map((suite) => {
  const script = suiteScripts[suite];
  if (!script) throw new Error(`Affected selector returned unsupported suite: ${suite}`);
  return [`Affected gate -> ${suite}`, [script]];
});

const timeoutMs = plan.suite === "all" ? 7_200_000 : undefined;

await runTestSteps(
  steps,
  { suiteLabel: `Affected test gate (${plan.suite})`, timeoutMs },
);

console.log("Affected tests passed.");
