import { runTestSteps } from "./test-runner-core.mjs";
import { memoryRetrievalSteps } from "./test-suite-groups.mjs";

const steps = Object.freeze([
  Object.freeze([
    "Dependency-aligned test-suite inventory",
    Object.freeze(["tests/test-suite-groups.test.mjs"]),
  ]),
  ...memoryRetrievalSteps,
]);

runTestSteps(steps, {
  suiteLabel: "Memory retrieval test suite",
}).catch((error) => {
  console.error(`\nMemory retrieval test suite failed: ${error.message}`);
  process.exitCode = 1;
});