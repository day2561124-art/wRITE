import { reviewedParallelSafeTestPaths } from "./test-classification.mjs";
import {
  partitionTestStepsByParallelSafety,
  runParallelTestSteps,
  runTestSteps,
} from "./test-runner-core.mjs";
import { communicationSteps } from "./test-suite-groups.mjs";

async function main() {
  await runTestSteps(
    [["Communication inventory contract", ["tests/test-suite-groups.test.mjs"]]],
    { suiteLabel: "Communication inventory preflight" },
  );

  const { parallel, serial } = partitionTestStepsByParallelSafety(communicationSteps, {
    parallelSafeTestPaths: reviewedParallelSafeTestPaths,
  });

  await runParallelTestSteps(parallel, {
    suiteLabel: "Communication parallel-safe shard",
    parallelSafeTestPaths: reviewedParallelSafeTestPaths,
    maxConcurrency: 2,
  });
  await runTestSteps(serial, { suiteLabel: "Communication serial shard" });
  console.log("\nCommunication test suite passed.");
}

main().catch((error) => {
  console.error(`Communication test suite failed: ${error.message}`);
  process.exitCode = 1;
});
