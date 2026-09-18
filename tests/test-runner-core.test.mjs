import assert from "node:assert/strict";

import { resolveTimeoutMs, runTestSteps } from "./test-runner-core.mjs";

assert.equal(resolveTimeoutMs(), 360_000, "default nested timeout should remain 360s");
assert.equal(resolveTimeoutMs({ timeoutMs: 7_200_000 }), 7_200_000, "explicit override should be honored");
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
