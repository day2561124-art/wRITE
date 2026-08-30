import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cognitionSteps,
  memoryRetrievalSteps,
  phase62CognitionIntegrationSteps,
  phase62WorldSimulationSteps,
  phase63MemorySteps,
  phase64RetrievalCognitionSteps,
  worldSimulationSteps,
} from "./test-suite-groups.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runAllPath = path.join(__dirname, "run-all.mjs");
const runAllSource = fs.readFileSync(runAllPath, "utf8");

function pathsFor(steps) {
  return steps.map(([, args]) => args[0]);
}

function assertUnique(label, values) {
  assert.equal(
    new Set(values).size,
    values.length,
    `${label} must not contain duplicate test paths.`,
  );
}

const activeRunAllPaths = [
  ...runAllSource.matchAll(
    /"tests\/(phase62|phase63|phase64)\/[^"]+\.test\.mjs"/g,
  ),
].map((match) => match[0].slice(1, -1));

const worldPaths = pathsFor(worldSimulationSteps);
const cognitionPaths = pathsFor(cognitionSteps);
const memoryPaths = pathsFor(memoryRetrievalSteps);
const phase62Paths = pathsFor(phase62WorldSimulationSteps);
const phase63Paths = pathsFor(phase63MemorySteps);
const phase64Paths = pathsFor(phase64RetrievalCognitionSteps);
const phase62CognitionPaths = pathsFor(phase62CognitionIntegrationSteps);

assertUnique("run-all active world-simulation inventory", activeRunAllPaths);
assertUnique("world-simulation runner", worldPaths);
assertUnique("cognition runner", cognitionPaths);
assertUnique("memory-retrieval runner", memoryPaths);

assert.deepEqual(
  worldPaths,
  activeRunAllPaths,
  "World-simulation runner must exactly cover the Phase62/63/64 inventory in run-all.mjs.",
);

assert.deepEqual(
  memoryPaths,
  [...phase63Paths, ...phase64Paths],
  "Memory-retrieval runner must cover Phase63 memory plus Phase64 retrieval cognition.",
);

assert.deepEqual(
  cognitionPaths,
  [...phase62CognitionPaths, ...phase63Paths, ...phase64Paths],
  "Cognition runner must cover its Phase62 integration boundary plus all Phase63/64 cognition.",
);

assert.deepEqual(
  phase62CognitionPaths,
  phase62Paths.slice(0, 13),
  "Phase62 cognition integration boundary must remain the A-R1/R2 through Phase62C main-loop integration prefix.",
);

for (const testPath of worldPaths) {
  assert.match(
    testPath,
    /^tests\/phase(?:62|63|64)\//,
    `Active runner leaked non-world-simulation test: ${testPath}`,
  );
}

for (const testPath of cognitionPaths) {
  assert.ok(
    !testPath.startsWith("tests/phase22/")
      && !testPath.startsWith("tests/phase44/")
      && !testPath.startsWith("tests/phase45/")
      && !testPath.startsWith("tests/phase46/")
      && !testPath.startsWith("tests/phase47/")
      && !testPath.startsWith("tests/phase48/")
      && !testPath.startsWith("tests/phase49/")
      && !testPath.startsWith("tests/phase50/")
      && !testPath.startsWith("tests/phase51/")
      && !testPath.startsWith("tests/phase52/")
      && !testPath.startsWith("tests/phase53/")
      && !testPath.startsWith("tests/phase54/")
      && !testPath.startsWith("tests/phase55/")
      && !testPath.startsWith("tests/phase56/")
      && !testPath.startsWith("tests/phase57/")
      && !testPath.startsWith("tests/phase58/")
      && !testPath.startsWith("tests/phase59/")
      && !testPath.startsWith("tests/phase60/"),
    `Cognition runner must not pull legacy writing pipeline test: ${testPath}`,
  );
}

console.log("Test-suite dependency-aligned inventory passed.");