import { runTestSteps } from "./test-runner-core.mjs";
import { communicationSteps } from "./test-suite-groups.mjs";

runTestSteps([
  ["Communication inventory contract", ["tests/test-suite-groups.test.mjs"]],
  ...communicationSteps,
], { suiteLabel: "Communication test suite" }).catch((error) => {
  console.error(`Communication test suite failed: ${error.message}`);
  process.exitCode = 1;
});
