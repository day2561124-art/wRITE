import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  reviewedCacheableTestPaths,
  reviewedParallelSafeTestPaths,
} from "./test-classification.mjs";
import {
  partitionTestStepsByParallelSafety,
  runParallelTestSteps,
  runTestSteps,
} from "./test-runner-core.mjs";
import {
  buildTestResultCacheManifest,
  defaultTestResultCacheRoot,
  readCachedTestPass,
  writeCachedTestPass,
} from "./test-result-cache.mjs";
import { communicationSteps } from "./test-suite-groups.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheEnabled = process.argv.includes("--development-result-cache");
const cacheablePaths = new Set(reviewedCacheableTestPaths);

async function main() {
  await runTestSteps(
    [["Communication inventory contract", ["tests/test-suite-groups.test.mjs"]]],
    { suiteLabel: "Communication inventory preflight" },
  );

  const { parallel, serial } = partitionTestStepsByParallelSafety(communicationSteps, {
    parallelSafeTestPaths: reviewedParallelSafeTestPaths,
  });

  const runnableParallel = [];
  const cacheMisses = [];
  const cacheStats = {
    enabled: cacheEnabled,
    hits: 0,
    misses: 0,
    bypassed: 0,
  };
  const cacheRoot = defaultTestResultCacheRoot(rootDir);

  for (const step of parallel) {
    const testPath = Array.isArray(step?.[1]) && step[1].length === 1
      ? step[1][0]
      : null;
    if (!cacheEnabled || !cacheablePaths.has(testPath)) {
      runnableParallel.push(step);
      cacheStats.bypassed += 1;
      continue;
    }

    const manifest = await buildTestResultCacheManifest({
      projectRoot: rootDir,
      testPath,
      args: step[1],
    });
    if (manifest.eligible !== true) {
      console.log(`Result cache bypass: ${testPath}: ${manifest.reason ?? "ineligible"}`);
      runnableParallel.push(step);
      cacheStats.bypassed += 1;
      continue;
    }

    const cached = await readCachedTestPass({ cacheRoot, manifest });
    if (cached?.cache_hit === true) {
      console.log(`Result cache hit: ${testPath} [${manifest.cache_key.slice(0, 12)}]`);
      cacheStats.hits += 1;
      continue;
    }

    console.log(`Result cache miss: ${testPath} [${manifest.cache_key.slice(0, 12)}]`);
    runnableParallel.push(step);
    cacheMisses.push({ testPath, manifest });
    cacheStats.misses += 1;
  }

  await runParallelTestSteps(runnableParallel, {
    suiteLabel: "Communication parallel-safe shard",
    parallelSafeTestPaths: reviewedParallelSafeTestPaths,
    maxConcurrency: 2,
  });

  // Publish PASS evidence only after the complete runnable parallel shard passes.
  for (const { manifest } of cacheMisses) {
    await writeCachedTestPass({ cacheRoot, manifest });
  }

  await runTestSteps(serial, { suiteLabel: "Communication serial shard" });
  console.log(`\nCommunication result cache: ${JSON.stringify(cacheStats)}`);
  console.log("\nCommunication test suite passed.");
}

main().catch((error) => {
  console.error(`Communication test suite failed: ${error.message}`);
  process.exitCode = 1;
});
