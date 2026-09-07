import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  affectedTestSelectorVersion,
  selectAffectedTestPlan,
} from "./affected-test-selector.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

async function plan(changedPaths, options = {}) {
  return selectAffectedTestPlan({ projectRoot, changedPaths, ...options });
}

const noChanges = await plan([]);
assert.equal(noChanges.selector_version, affectedTestSelectorVersion);
assert.equal(noChanges.suite, "all");
assert.equal(noChanges.focused, false);
assert.equal(noChanges.fallback_reason, "NO_WORKING_TREE_CHANGES");

const retrievalProduction = await plan([
  "server/src/world-simulation-memory-retrieval-process-service.mjs",
]);
assert.equal(
  retrievalProduction.suite,
  "world_simulation",
  JSON.stringify(retrievalProduction, null, 2),
);
assert.equal(retrievalProduction.focused, true);
assert.equal(retrievalProduction.fallback_reason, null);
assert.equal(retrievalProduction.certification_required, true);
assert(retrievalProduction.selected_group_tests.some((item) => item.includes("phase63c-memory-retrieval-process")));
assert(retrievalProduction.selected_group_tests.some((item) => item.includes("phase62")));
assert(retrievalProduction.deferred_certification_tests.some((item) => item.startsWith("tests/mcp/")));

const cognitionProduction = await plan([
  "server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs",
]);
assert.equal(cognitionProduction.suite, "world_simulation");
assert.equal(cognitionProduction.focused, true);
assert.equal(cognitionProduction.fallback_reason, null);
assert.equal(cognitionProduction.certification_required, true);
assert(cognitionProduction.selected_group_tests.some((item) => item.includes("phase65b-subjective-claim-conflict")));
assert(cognitionProduction.selected_group_tests.some((item) => item.includes("phase62")));
assert(cognitionProduction.deferred_certification_tests.length > 0);

const retrievalTest = await plan([
  "tests/phase63/phase63c-memory-retrieval-process.test.mjs",
]);
assert.equal(retrievalTest.suite, "memory_retrieval");
assert.equal(retrievalTest.focused, true);
assert.equal(retrievalTest.certification_required, false);
assert.deepEqual(retrievalTest.deferred_certification_tests, []);

const world = await plan([
  "server/src/world-simulation-combat-causal-service.mjs",
]);
assert.equal(world.suite, "world_simulation");
assert.equal(world.focused, true);
assert.equal(world.fallback_reason, null);
assert(world.affected_tests.some((item) => item.includes("phase62e-programmatic-combat-causal-layer")));

const sharedWorldLoop = await plan([
  "server/src/world-simulation-loop-service.mjs",
]);
assert.equal(sharedWorldLoop.suite, "world_simulation");
assert.equal(sharedWorldLoop.focused, true);
assert(sharedWorldLoop.affected_tests.some((item) => item.includes("phase62z-audibility-propagation")));
assert(sharedWorldLoop.affected_tests.some((item) => item.includes("phase65b-subjective-claim-conflict")));

const groupedTest = await plan([
  "tests/phase65/phase65b-subjective-claim-conflict-revision-projection.test.mjs",
]);
assert.equal(groupedTest.suite, "cognition");
assert.equal(groupedTest.focused, true);

const runAllInventoryAppend = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "index 1111111..2222222 100644",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -785,0 +786 @@ const steps = [",
      "+  [\"Phase 66B effective subjective belief state projection\", [\"tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs\"]],",
    ].join("\n"),
  },
);
assert.equal(runAllInventoryAppend.suite, "cognition", JSON.stringify(runAllInventoryAppend, null, 2));
assert.equal(runAllInventoryAppend.focused, true);
assert.equal(runAllInventoryAppend.fallback_reason, null);
assert.equal(runAllInventoryAppend.certification_required, false);
assert.deepEqual(
  runAllInventoryAppend.selected_group_tests,
  ["tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs"],
);

const runAllSemanticChange = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -829 +829 @@ function getTimeoutMs(label) {",
      "-  return 360_000;",
      "+  return 420_000;",
    ].join("\n"),
  },
);
assert.equal(runAllSemanticChange.suite, "all");
assert.equal(runAllSemanticChange.focused, false);
assert.equal(runAllSemanticChange.fallback_reason, "RUN_ALL_RUNNER_SEMANTICS_CHANGED");

const runAllUnmappedInventory = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -785,0 +786 @@ const steps = [",
      "+  [\"Phase 99 experimental test\", [\"tests/phase99/phase99-experimental.test.mjs\"]],",
    ].join("\n"),
  },
);
assert.equal(runAllUnmappedInventory.suite, "all");
assert.equal(runAllUnmappedInventory.focused, false);
assert.equal(
  runAllUnmappedInventory.fallback_reason,
  "RUN_ALL_INVENTORY_UNMAPPED_TEST:tests/phase99/phase99-experimental.test.mjs",
);

const runAllInventoryRemoval = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -786 +785,0 @@ const steps = [",
      "-  [\"Phase 66B effective subjective belief state projection\", [\"tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs\"]],",
    ].join("\n"),
  },
);
assert.equal(runAllInventoryRemoval.suite, "all");
assert.equal(runAllInventoryRemoval.focused, false);
assert.equal(
  runAllInventoryRemoval.fallback_reason,
  "RUN_ALL_INVENTORY_REMOVAL:tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs",
);

const runAllDynamicInventory = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -785,0 +786 @@ const steps = [",
      "+  [\"Phase 66B effective subjective belief state projection\", [resolveTest(\"tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs\")]],",
    ].join("\n"),
  },
);
assert.equal(runAllDynamicInventory.suite, "all");
assert.equal(runAllDynamicInventory.focused, false);
assert.equal(
  runAllDynamicInventory.fallback_reason,
  "RUN_ALL_UNCLASSIFIABLE_INVENTORY_CHANGE",
);

const crossCutting = await plan([
  "server/src/agent-run-service.mjs",
]);
assert.equal(crossCutting.suite, "all");
assert.equal(crossCutting.focused, false);
assert.match(crossCutting.fallback_reason, /^UNSCOPED_CHANGE:/u);

const testInfra = await plan([
  "tests/test-runner-core.mjs",
]);
assert.equal(testInfra.suite, "all");
assert.equal(testInfra.focused, false);
assert.match(testInfra.fallback_reason, /^UNSCOPED_CHANGE:/u);

const mixedScope = await plan([
  "server/src/world-simulation-subjective-claim-projection-service.mjs",
  "server/src/agent-run-service.mjs",
]);
assert.equal(mixedScope.suite, "all");
assert.equal(mixedScope.focused, false);
assert.match(mixedScope.fallback_reason, /^UNSCOPED_CHANGE:/u);

console.log("Affected test selector tests passed.");
