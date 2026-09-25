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

const cbC2IntegrationBundle = await plan(
  [
    "server/src/world-simulation-autonomous-cognition-scheduler-service.mjs",
    "server/src/world-simulation-loop-service.mjs",
    "tests/cb-c2/cb-c2-autonomous-cognition-scheduler.test.mjs",
    "tests/run-all.mjs",
    "tests/test-suite-groups.mjs",
    "tests/test-suite-groups.test.mjs",
  ],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -729,0 +730 @@ const steps = [",
      "+  [\"CB-C2 Autonomous Cognition Scheduler\", [\"tests/cb-c2/cb-c2-autonomous-cognition-scheduler.test.mjs\"]],",
    ].join("\n"),
  },
);
assert.equal(cbC2IntegrationBundle.suite, "world_simulation");
assert.deepEqual(
  cbC2IntegrationBundle.required_suites,
  ["world_simulation", "communication"],
);
assert.equal(cbC2IntegrationBundle.focused, true);
assert.equal(cbC2IntegrationBundle.fallback_reason, null);
assert(cbC2IntegrationBundle.selected_group_tests.includes(
  "tests/cb-c2/cb-c2-autonomous-cognition-scheduler.test.mjs",
));
assert.equal(cbC2IntegrationBundle.certification_required, true);

const communicationNativeIntegration = await plan([
  "server/src/character-communication-listener-understanding-service.mjs",
]);
assert.equal(
  communicationNativeIntegration.suite,
  "world_simulation",
  JSON.stringify(communicationNativeIntegration, null, 2),
);
assert.deepEqual(
  communicationNativeIntegration.required_suites,
  ["world_simulation", "communication"],
);
assert.equal(communicationNativeIntegration.focused, true);
assert.equal(communicationNativeIntegration.fallback_reason, null);
assert(communicationNativeIntegration.selected_group_tests.includes(
  "tests/communication/cc6-native-listener-interpretation.test.mjs",
));
assert(communicationNativeIntegration.selected_group_tests.some(
  (item) => item.startsWith("tests/phase62/"),
));

const communicationGroupedTest = await plan([
  "tests/communication/cc6-native-listener-interpretation.test.mjs",
]);
assert.equal(communicationGroupedTest.suite, "communication");
assert.deepEqual(communicationGroupedTest.required_suites, ["communication"]);
assert.equal(communicationGroupedTest.focused, true);
assert.equal(communicationGroupedTest.certification_required, false);

const communicationCrossSystem = await plan([
  "server/src/character-communication-foundation-service.mjs",
]);
assert.equal(
  communicationCrossSystem.suite,
  "world_simulation",
  JSON.stringify(communicationCrossSystem, null, 2),
);
assert.deepEqual(
  communicationCrossSystem.required_suites,
  ["world_simulation", "communication"],
);
assert.equal(communicationCrossSystem.focused, true);
assert.equal(communicationCrossSystem.fallback_reason, null);
assert(communicationCrossSystem.selected_group_tests.includes(
  "tests/communication/cc1-foundation.test.mjs",
));
assert(communicationCrossSystem.selected_group_tests.some((item) => item.startsWith("tests/phase62/")));

const communicationIr = await plan([
  "server/src/character-communication-ir-service.mjs",
]);
assert.equal(communicationIr.suite, "world_simulation", JSON.stringify(communicationIr, null, 2));
assert.deepEqual(communicationIr.required_suites, ["world_simulation", "communication"]);
assert(communicationIr.affected_tests.includes(
  "tests/communication/communication-ir.test.mjs",
));

const communicationTurnProjection = await plan([
  "server/src/character-communication-turn-projection-service.mjs",
]);
// CC-7D makes the native World loop a consumer of CC-7A projections.
// A change to the projection service must now keep both native World and
// Character Communication coverage; do not silently narrow the router.
assert.equal(
  communicationTurnProjection.suite,
  "world_simulation",
  JSON.stringify(communicationTurnProjection, null, 2),
);
assert.deepEqual(
  communicationTurnProjection.required_suites,
  ["world_simulation", "communication"],
);
assert.equal(communicationTurnProjection.focused, true);
assert.equal(communicationTurnProjection.fallback_reason, null);
assert.equal(communicationTurnProjection.certification_required, true);
assert(communicationTurnProjection.deferred_certification_tests.length > 0);
assert(communicationTurnProjection.selected_group_tests.includes(
  "tests/communication/cc7-turn-projection.test.mjs",
));

const unreviewedCommunicationSource = await plan([
  "server/src/character-communication-speaker-recognition-service.mjs",
]);
assert.equal(unreviewedCommunicationSource.suite, "all");
assert.equal(unreviewedCommunicationSource.focused, false);
assert.equal(
  unreviewedCommunicationSource.fallback_reason,
  "UNSCOPED_CHANGE:server/src/character-communication-speaker-recognition-service.mjs",
);

const groupedTest = await plan([
  "tests/phase65/phase65b-subjective-claim-conflict-revision-projection.test.mjs",
]);
assert.equal(groupedTest.suite, "cognition");
assert.equal(groupedTest.focused, true);

const analyzableInventoryInfrastructure = await plan([
  "tests/phase65/phase65b-subjective-claim-conflict-revision-projection.test.mjs",
  "tests/test-suite-groups.mjs",
  "tests/test-suite-groups.test.mjs",
  "tests/affected-test-selector.mjs",
  "tests/affected-test-selector.test.mjs",
]);
assert.equal(
  analyzableInventoryInfrastructure.suite,
  "cognition",
  JSON.stringify(analyzableInventoryInfrastructure, null, 2),
);
assert.equal(analyzableInventoryInfrastructure.focused, true);
assert.equal(analyzableInventoryInfrastructure.fallback_reason, null);
assert.equal(analyzableInventoryInfrastructure.certification_required, true);
assert(analyzableInventoryInfrastructure.deferred_certification_tests.includes(
  "tests/test-suite-groups.test.mjs",
));
assert(analyzableInventoryInfrastructure.deferred_certification_tests.includes(
  "tests/affected-test-selector.test.mjs",
));

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

const runAllInventoryAppendWithEquivalentRewrite = await plan(
  ["tests/run-all.mjs"],
  {
    runAllDiffText: [
      "diff --git a/tests/run-all.mjs b/tests/run-all.mjs",
      "--- a/tests/run-all.mjs",
      "+++ b/tests/run-all.mjs",
      "@@ -785,2 +785,3 @@ const steps = [",
      "-  [\"Phase 65B subjective claim conflict revision projection\", [\"tests/phase65/phase65b-subjective-claim-conflict-revision-projection.test.mjs\"]],",
      "+  [\"Phase 65B subjective claim conflict revision projection\", [\"tests/phase65/phase65b-subjective-claim-conflict-revision-projection.test.mjs\"]],",
      "+  [\"Phase 66B effective subjective belief state projection\", [\"tests/phase66/phase66b-effective-subjective-belief-projection.test.mjs\"]],",
    ].join("\n"),
  },
);
assert.equal(
  runAllInventoryAppendWithEquivalentRewrite.suite,
  "cognition",
  JSON.stringify(runAllInventoryAppendWithEquivalentRewrite, null, 2),
);
assert.equal(runAllInventoryAppendWithEquivalentRewrite.focused, true);
assert.equal(runAllInventoryAppendWithEquivalentRewrite.fallback_reason, null);
assert.deepEqual(
  runAllInventoryAppendWithEquivalentRewrite.selected_group_tests,
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
