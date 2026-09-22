import path from "node:path";
import { fileURLToPath } from "node:url";

import { selectAffectedTestPlan } from "./affected-test-selector.mjs";
import { collectCiRangeChangeEvidence } from "./ci-change-detection.mjs";
import { runTestSteps } from "./test-runner-core.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suiteScripts = Object.freeze({
  communication: "tests/run-communication.mjs",
  memory_retrieval: "tests/run-memory-retrieval.mjs",
  cognition: "tests/run-cognition.mjs",
  world_simulation: "tests/run-world-simulation.mjs",
  all: "tests/run-all.mjs",
});

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`Missing required ${name} SHA.`);
  }
  return process.argv[index + 1];
}

const evidence = await collectCiRangeChangeEvidence({
  projectRoot: rootDir,
  baseSha: readFlag("--base"),
  headSha: readFlag("--head"),
});
const plan = await selectAffectedTestPlan({
  projectRoot: rootDir,
  changedPaths: evidence.changed_paths,
  runAllDiffText: evidence.run_all_diff_text,
});

console.log("CI affected change evidence:");
console.log(JSON.stringify({
  base_sha: evidence.base_sha,
  head_sha: evidence.head_sha,
  changed_paths: evidence.changed_paths,
}, null, 2));
console.log("CI affected test plan:");
console.log(JSON.stringify(plan, null, 2));

const requiredSuites = plan.required_suites ?? [plan.suite];
const steps = requiredSuites.map((suite) => {
  const script = suiteScripts[suite];
  if (!script) throw new Error(`CI affected selector returned unsupported suite: ${suite}`);
  return [`CI affected gate -> ${suite}`, [script]];
});

await runTestSteps(steps, {
  suiteLabel: `CI affected gate (${plan.suite})`,
  timeoutMs: plan.suite === "all" ? 7_200_000 : undefined,
});

console.log("CI affected tests passed.");
