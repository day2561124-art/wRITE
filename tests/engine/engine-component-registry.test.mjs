import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getEngineComponentsStatus,
  loadEngineComponentRegistry,
  validateEngineComponentRegistry,
} from "../../server/src/engine-component-registry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const expectedActiveEngineHash = (
  "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB"
);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const { registry } = await loadEngineComponentRegistry();
assert.equal(validateEngineComponentRegistry(registry), registry);
assert.equal(registry.design_principle, "engine-first");
assert.equal(registry.components.writing_method.version, "v2.8");
assert.equal(registry.components.proofing_method.version, "v1.1");
assert.equal(registry.components.neural_pipeline.required, true);
assert.equal(registry.components.governance_policy.required, true);

const moduleNames = registry.components.neural_pipeline.modules.map((module) => module.name);
assert.deepEqual(moduleNames, [
  "run_scene_planner",
  "run_character_simulator",
  "run_neural_critic",
  "run_style_drift_detector",
  "run_over_governance_detector",
]);

const watchedPaths = [
  "config/engine-components.json",
  registry.components.canon_data.path,
  registry.components.writing_method.path,
  registry.components.proofing_method.path,
  registry.components.neural_pipeline.path,
  registry.components.governance_policy.path,
];
const before = new Map();
for (const relativePath of watchedPaths) {
  before.set(relativePath, sha256(await readFile(path.join(rootDir, relativePath))));
}

const status = await getEngineComponentsStatus();
assert.equal(status.ok, true);
assert.equal(status.read_only, true);
assert.equal(status.components.canon_data.hash_matches, true);
assert.equal(status.components.canon_data.actual_sha256_lf, expectedActiveEngineHash);
assert.equal(status.components.neural_pipeline.required, true);
assert.equal(status.components.neural_pipeline.modules.length, 5);
assert(
  status.components.neural_pipeline.modules.every(
    (module) => module.required_status === "available" && module.status === "available",
  ),
);
assert.equal(status.components.governance_policy.status, "available");

for (const relativePath of watchedPaths) {
  const afterHash = sha256(await readFile(path.join(rootDir, relativePath)));
  assert.equal(afterHash, before.get(relativePath), `${relativePath} changed during read-only status.`);
}

console.log("Engine component registry test passed.");
