import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aggregateVerificationTelemetry } from "./verification-telemetry.mjs";

const receipt = {
  schema_version: "verification-test-result-cache-receipt-v1",
  run_id: "11111111-2222-4333-8444-555555555555",
  suite: "communication",
  source_script: "tests/run-communication.mjs",
  source_sha: null,
  enabled: true,
  passed: true,
  completed_at: "2026-09-22T12:00:00.000Z",
  test_result_cache: { enabled: true, hits: 2, misses: 3, bypassed: 4 },
};
const empty = aggregateVerificationTelemetry();
assert.equal(empty.evidence.cache_receipt_count, 0);
assert.equal(empty.test_result_cache.hits, null);
const result = aggregateVerificationTelemetry({ cacheReceipts: [receipt] });
assert.equal(result.evidence.cache_receipt_count, 1);
assert.deepEqual(result.test_result_cache, {
  observed_runs: 1, hits: 2, misses: 3, bypassed: 4, hit_ratio: 0.4,
});
assert.equal(result.routing.observed_plans, 0);
assert.equal(result.durations_ms.suite.count, 0);
assert.equal(aggregateVerificationTelemetry({
  cacheReceipts: [receipt, {
    ...receipt, run_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    test_result_cache: { enabled: true, hits: 0, misses: 0, bypassed: 1 },
  }],
}).test_result_cache.hit_ratio, 0.4);

assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [receipt, receipt] }), /Duplicate evidence/u);
assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [{ ...receipt, passed: false }] }), /Unsupported/u);
assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [{ ...receipt, enabled: false }] }), /Unsupported/u);
assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [{
  ...receipt, test_result_cache: { enabled: true, hits: -1, misses: 0, bypassed: 0 },
}] }), /Malformed/u);
assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [{
  ...receipt, source_script: "tests/run-all.mjs",
}] }), /Unsupported/u);
assert.throws(() => aggregateVerificationTelemetry({ cacheReceipts: [{
  ...receipt, source_sha: "not-a-commit",
}] }), /Unsupported/u);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = await readFile(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const scheduled = workflow.slice(workflow.indexOf("  scheduled-full:\n"), workflow.indexOf("  manual-full:\n"));
assert.match(scheduled, /actions\/upload-artifact@v7/u);
assert.match(scheduled, /always\(\) && matrix\.selector_audit == true/u);
assert.match(scheduled, /include-hidden-files: true/u);
assert.doesNotMatch(scheduled, /retention-days:/u,
  "artifact retention must follow repository policy rather than shorten it in workflow code");
assert.match(scheduled, /ci-selection-audit\.last\.json/u);
assert.match(scheduled, /ci-selection-telemetry\.last\.json/u);
assert.match(scheduled, /run-verification-telemetry\.mjs/u);
assert.doesNotMatch(workflow, /--development-result-cache/u,
  "formal CI must not turn on development-only test-result caching");
const communication = await readFile(path.join(root, "tests", "run-communication.mjs"), "utf8");
assert.match(communication, /if \(cacheEnabled\) await rm\(receiptPath, \{ force: true \}\)/u);
assert.match(communication, /verification-test-result-cache-receipt-v1/u);
assert.match(communication, /await runTestSteps\(serial,/u);
console.log("VA-14 CI evidence and cache telemetry contracts passed.");
