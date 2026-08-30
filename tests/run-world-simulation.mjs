import { runTestSteps } from "./test-runner-core.mjs";
import { worldSimulationSteps } from "./test-suite-groups.mjs";

const steps = Object.freeze([
  Object.freeze([
    "Dependency-aligned test-suite inventory",
    Object.freeze(["tests/test-suite-groups.test.mjs"]),
  ]),
  ...worldSimulationSteps,
]);

runTestSteps(steps, {
  suiteLabel: "World simulation test suite",
}).catch((error) => {
  console.error(`\nWorld simulation test suite failed: ${error.message}`);
  process.exitCode = 1;
});