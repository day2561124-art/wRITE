import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_KINDS,
  classifyTestFile,
  testClassificationVersion,
} from "./test-classification.mjs";

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
