import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_KINDS,
  classifyTestFile,
  reviewedCacheableTestPaths,
  reviewedParallelSafeTestPaths,
  testClassificationVersion,
} from "./test-classification.mjs";
import {
  mcpFullScripts,
  mcpHermeticCoreScripts,
  mcpHermeticCoreEntrypoint,
} from "./tools/mcp-suite-groups.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function listTests(relativeDir = "tests") {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name === ".tmp" || entry.name === "node_modules") continue;
    const relativePath = `${relativeDir}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) result.push(...await listTests(relativePath));
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) result.push(relativePath);
  }
  return result.sort();
}

const tests = await listTests();
assert(tests.length > 0, "Committed test inventory must not be empty.");

const allowedKinds = new Set(TEST_KINDS);
const classifications = [];
for (const testPath of tests) {
  const source = await readFile(path.join(root, ...testPath.split("/")), "utf8");
  const item = classifyTestFile({ testPath, source });
  assert.equal(item.schema_version, testClassificationVersion);
  assert.equal(item.test_path, testPath);
  assert(allowedKinds.has(item.kind), `Unknown kind for ${testPath}: ${item.kind}`);
  assert.equal(typeof item.component, "string");
  assert(item.component.length > 0);
  assert(Array.isArray(item.components) && item.components.length > 0);
  assert(Array.isArray(item.dependencies));
  for (const field of ["hermetic", "parallel_safe", "cacheable", "external_state", "fixed_port_evidence"]) {
    assert.equal(typeof item[field], "boolean", `${testPath} missing boolean ${field}`);
  }
  if (item.parallel_safe) assert.equal(item.hermetic, true, `${testPath}: parallel-safe requires hermetic`);
  if (item.cacheable) assert.equal(item.hermetic, true, `${testPath}: cacheable requires hermetic`);
  if (item.external_state) {
    assert.equal(item.hermetic, false, `${testPath}: external-state test cannot be hermetic in VA-2`);
    assert.equal(item.cacheable, false, `${testPath}: external-state test cannot be cacheable in VA-2`);
  }
  classifications.push(item);
}

const byPath = new Map(classifications.map((item) => [item.test_path, item]));
const reviewedParallelSafeSet = new Set(reviewedParallelSafeTestPaths);
const reviewedCacheableSet = new Set(reviewedCacheableTestPaths);
for (const testPath of [...mcpHermeticCoreScripts, mcpHermeticCoreEntrypoint]) {
  const classified = byPath.get(testPath);
  assert(classified, `Missing reviewed hermetic test: ${testPath}`);
  assert.equal(classified.kind, "unit");
  assert.equal(classified.hermetic, true);
  assert.equal(classified.external_state, false);
  assert.equal(
    classified.parallel_safe,
    reviewedParallelSafeSet.has(testPath),
    `${testPath}: VA-10 parallel safety must be explicitly reviewed`,
  );
  assert.equal(
    classified.cacheable,
    reviewedCacheableSet.has(testPath),
    `${testPath}: VA-11 cacheability must be explicitly reviewed`,
  );
  assert.deepEqual(classified.dependencies, []);
  assert(classified.classification_basis.includes("reviewed_hermetic_core_local_fixture"));
}
for (const testPath of reviewedParallelSafeTestPaths) {
  const classified = byPath.get(testPath);
  assert(classified, `Missing reviewed parallel-safe test: ${testPath}`);
  assert.equal(classified.hermetic, true, `${testPath}: parallel-safe test must be hermetic`);
  assert.equal(classified.parallel_safe, true);
  assert.equal(classified.external_state, false);
  assert.deepEqual(classified.dependencies, []);
  assert(classified.classification_basis.includes("reviewed_parallel_safe"));
}
assert.deepEqual(
  classifications.filter((item) => item.parallel_safe).map((item) => item.test_path).sort(),
  [...reviewedParallelSafeTestPaths].sort(),
  "VA-10 parallel-safe classification must remain explicit and fail closed.",
);
for (const testPath of reviewedCacheableTestPaths) {
  const classified = byPath.get(testPath);
  assert(classified, `Missing reviewed cacheable test: ${testPath}`);
  assert.equal(classified.hermetic, true, `${testPath}: cacheable test must be hermetic`);
  assert.equal(classified.parallel_safe, true, `${testPath}: first VA-11 cache cohort must also be parallel-safe`);
  assert.equal(classified.cacheable, true);
  assert.equal(classified.external_state, false);
  assert.deepEqual(classified.dependencies, []);
  assert(classified.classification_basis.includes("reviewed_cacheable_declared_inputs"));
}
assert.deepEqual(
  classifications.filter((item) => item.cacheable).map((item) => item.test_path).sort(),
  [...reviewedCacheableTestPaths].sort(),
  "VA-11 cacheable classification must remain explicit and fail closed.",
);
for (const testPath of mcpFullScripts.filter((item) => item.startsWith("tests/"))) {
  const classified = byPath.get(testPath);
  assert(classified, `Missing legacy MCP test: ${testPath}`);
  assert.equal(classified.external_state, true, `VA-9 legacy MCP external state: ${testPath}`);
  assert.equal(classified.hermetic, false);
  assert.equal(classified.cacheable, false);
  assert(classified.classification_basis.includes("legacy_mcp_external_state"));
}
assert.throws(() => classifyTestFile({
  testPath: mcpHermeticCoreScripts[0],
  source: 'import { spawn } from "node:child_process";',
}), /Reviewed hermetic test gained dependencies/u);
assert.throws(() => classifyTestFile({
  testPath: "tests/communication/communication-ir.test.mjs",
  source: 'import { readFile } from "node:fs/promises";',
}), /Reviewed parallel-safe test gained dependencies/u);

assert.equal(
  new Set(classifications.map((item) => item.test_path)).size,
  tests.length,
  "Every committed .test.mjs must have exactly one classification.",
);

const counts = Object.fromEntries(TEST_KINDS.map((kind) => [
  kind,
  classifications.filter((item) => item.kind === kind).length,
]));
const flags = {
  hermetic: classifications.filter((item) => item.hermetic).length,
  parallel_safe: classifications.filter((item) => item.parallel_safe).length,
  cacheable: classifications.filter((item) => item.cacheable).length,
  external_state: classifications.filter((item) => item.external_state).length,
};

console.log(JSON.stringify({
  schema_version: testClassificationVersion,
  classified_test_count: classifications.length,
  kinds: counts,
  flags,
}, null, 2));
console.log("Verification test classification contract passed.");
