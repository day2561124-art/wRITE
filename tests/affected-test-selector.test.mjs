import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  affectedTestSelectorVersion,
  selectAffectedTestPlan,
} from "./affected-test-selector.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

async function plan(changedPaths) {
  return selectAffectedTestPlan({ projectRoot, changedPaths });
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
