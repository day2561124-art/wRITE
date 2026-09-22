import assert from "node:assert/strict";

import {
  partitionTestStepsByParallelSafety,
  resolveMaxConcurrency,
  resolveTimeoutMs,
  runParallelTestSteps,
  runTestSteps,
} from "./test-runner-core.mjs";
import { reviewedParallelSafeTestPaths } from "./test-classification.mjs";

assert.equal(resolveTimeoutMs(), 360_000, "default nested timeout should remain 360s");
assert.equal(resolveTimeoutMs({ timeoutMs: 7_200_000 }), 7_200_000, "explicit override should be honored");
assert.equal(resolveMaxConcurrency(), 1, "parallel execution must remain opt-in");
assert.equal(resolveMaxConcurrency({ maxConcurrency: 0 }), 1);
assert.equal(resolveMaxConcurrency({ maxConcurrency: 2 }), 2);
assert.equal(resolveMaxConcurrency({ maxConcurrency: 99 }), 4, "parallelism must remain bounded");

const sampleSteps = [
  ["safe A", ["tests/mcp/mcp-verification-failure-classifier.test.mjs"]],
  ["unsafe", ["tests/communication/cc1-native-loop.test.mjs"]],
  ["safe B", ["tests/mcp/mcp-verification-controlled-retry.test.mjs"]],
];
const partitioned = partitionTestStepsByParallelSafety(sampleSteps, {
  parallelSafeTestPaths: reviewedParallelSafeTestPaths,
});
assert.deepEqual(partitioned.parallel.map(([label]) => label), ["safe A", "safe B"]);
assert.deepEqual(partitioned.serial.map(([label]) => label), ["unsafe"]);

await assert.rejects(
  () => runParallelTestSteps(
    [["unsafe", ["tests/communication/cc1-native-loop.test.mjs"]]],
    {
      parallelSafeTestPaths: reviewedParallelSafeTestPaths,
      maxConcurrency: 2,
    },
  ),
  /not an explicitly reviewed parallel-safe test step/u,
);

const parallelResult = await runParallelTestSteps(
  [
    ["failure classifier policy", ["tests/mcp/mcp-verification-failure-classifier.test.mjs"]],
    ["controlled retry policy", ["tests/mcp/mcp-verification-controlled-retry.test.mjs"]],
  ],
  {
    suiteLabel: "VA-10 parallel runner regression",
    parallelSafeTestPaths: reviewedParallelSafeTestPaths,
    maxConcurrency: 2,
  },
);
assert.equal(parallelResult.max_concurrency, 2);
assert.equal(parallelResult.timings.length, 2);
assert.deepEqual(parallelResult.parallel_safe_test_paths, [
  "tests/mcp/mcp-verification-failure-classifier.test.mjs",
  "tests/mcp/mcp-verification-controlled-retry.test.mjs",
]);
assert.equal(
  resolveTimeoutMs({ timeoutMs: undefined, suiteTimeoutMs: 7_200_000 }),
  7_200_000,
  "suite-level override should flow to a step-level timeout",
);

await assert.rejects(
  () =>
    runTestSteps(
      [["override timeout", ["--eval", "setTimeout(() => {}, 2500)"]]],
      { suiteLabel: "override timeout check", timeoutMs: 1_000 },
    ),
  (error) => {
    assert.match(error.message, /timed out after 1 seconds\./);
    return true;
  },
);

console.log("test-runner-core timeout override regression checks passed.");
