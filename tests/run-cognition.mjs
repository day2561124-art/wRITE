import { runTestSteps } from "./test-runner-core.mjs";
import { cognitionSteps } from "./test-suite-groups.mjs";

const steps = Object.freeze([
  Object.freeze([
    "Dependency-aligned test-suite inventory",
    Object.freeze(["tests/test-suite-groups.test.mjs"]),
  ]),
  ...cognitionSteps,
]);

runTestSteps(steps, {
  suiteLabel: "Cognition test suite",
}).catch((error) => {
  console.error(`\nCognition test suite failed: ${error.message}`);
  process.exitCode = 1;
});