import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  partitionTestStepsByParallelSafety,
  resolveMaxConcurrency,
  resolveTimeoutMs,
  runParallelTestSteps,
  runTestSteps,
} from "./test-runner-core.mjs";
import {
  reviewedCacheableTestPaths,
  reviewedParallelSafeTestPaths,
} from "./test-classification.mjs";
import {
  buildTestResultCacheManifest,
  readCachedTestPass,
  writeCachedTestPass,
} from "./test-result-cache.mjs";

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

const reviewedCacheManifests = [];
for (const testPath of reviewedCacheableTestPaths) {
  reviewedCacheManifests.push([
    testPath,
    await buildTestResultCacheManifest({
      projectRoot: process.cwd(),
      testPath,
    }),
  ]);
}
assert.deepEqual(
  reviewedCacheManifests
    .filter(([, manifest]) => manifest.eligible !== true)
    .map(([testPath, manifest]) => [testPath, manifest.reason]),
  [],
  "all VA-11 cache allowlist tests must retain complete deterministic dependency closures",
);

const cacheFixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ww-va11-cache-"));
try {
  await mkdir(path.join(cacheFixtureRoot, "tests"), { recursive: true });
  await mkdir(path.join(cacheFixtureRoot, "server", "src"), { recursive: true });
  await writeFile(
    path.join(cacheFixtureRoot, "server", "src", "pure.mjs"),
    'export const answer = 42;\n',
    "utf8",
  );
  await writeFile(
    path.join(cacheFixtureRoot, "tests", "sample.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { answer } from "../server/src/pure.mjs";',
      "assert.equal(answer, 42);",
      "",
    ].join("\n"),
    "utf8",
  );

  const firstManifest = await buildTestResultCacheManifest({
    projectRoot: cacheFixtureRoot,
    testPath: "tests/sample.test.mjs",
  });
  assert.equal(firstManifest.eligible, true);
  assert.match(firstManifest.cache_key, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.test_hash, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.source_hash, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.dependency_hash, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.fixture_hash, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.runtime_hash, /^[a-f0-9]{64}$/u);
  assert.match(firstManifest.input_contract.environment_contract_hash, /^[a-f0-9]{64}$/u);

  const cacheRoot = path.join(cacheFixtureRoot, "tests", ".tmp", "cache");
  assert.equal(await readCachedTestPass({ cacheRoot, manifest: firstManifest }), null);
  assert.equal(await writeCachedTestPass({ cacheRoot, manifest: firstManifest }), true);
  const cached = await readCachedTestPass({ cacheRoot, manifest: firstManifest });
  assert.equal(cached?.cache_hit, true);
  assert.equal(cached?.passed, true);

  await writeFile(
    path.join(cacheFixtureRoot, "server", "src", "pure.mjs"),
    'export const answer = 43;\n',
    "utf8",
  );
  const changedManifest = await buildTestResultCacheManifest({
    projectRoot: cacheFixtureRoot,
    testPath: "tests/sample.test.mjs",
  });
  assert.equal(changedManifest.eligible, true);
  assert.notEqual(
    changedManifest.cache_key,
    firstManifest.cache_key,
    "a transitive source change must invalidate the result cache key",
  );
  assert.equal(await readCachedTestPass({ cacheRoot, manifest: changedManifest }), null);

  await writeFile(
    path.join(cacheFixtureRoot, "server", "src", "impure.mjs"),
    'export const secret = process.env.SECRET;\n',
    "utf8",
  );
  await writeFile(
    path.join(cacheFixtureRoot, "tests", "impure.test.mjs"),
    [
      'import { secret } from "../server/src/impure.mjs";',
      "void secret;",
      "",
    ].join("\n"),
    "utf8",
  );
  const impureManifest = await buildTestResultCacheManifest({
    projectRoot: cacheFixtureRoot,
    testPath: "tests/impure.test.mjs",
  });
  assert.equal(impureManifest.eligible, false);
  assert.match(impureManifest.reason, /^ENVIRONMENT_DEPENDENCY:/u);
} finally {
  await rm(cacheFixtureRoot, { recursive: true, force: true });
}

console.log("test-runner-core timeout/cache regression checks passed.");
