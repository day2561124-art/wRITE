import assert from "node:assert/strict";
import { aggregateVerificationTelemetry as aggregate } from "./verification-telemetry.mjs";

const manifest = {
  schema_version: "verification-manifest-v1",
  gate: "integration",
  integration_candidate_id: "candidate-one",
  duration_ms: 150,
  focused: false,
  fallback_reason: "UNREVIEWED_CHANGE:docs/example.md",
  tests_selected: ["mcp", "mcp_tunnel"],
  suite_results: [
    { suite: "mcp", duration_ms: 100, passed: true },
    { suite: "mcp_tunnel", duration_ms: 50, passed: true },
  ],
  failure_classification: { classification: "PASS_STABLE" },
  snapshot_fingerprint_cache_hit_count: 5000,
};
const audit = {
  schema_version: "ci-selection-audit-v1",
  base_sha: "a".repeat(40),
  head_sha: "b".repeat(40),
  completed_at: "2026-09-22T11:00:00.000Z",
  focused: true,
  classification: "SELECTOR_MISS_CANDIDATE",
  affected_results: [{ suite: "communication", duration_ms: 20, passed: true }],
  full_result: { duration_ms: 300, passed: false },
};

const result = aggregate({ manifests: [manifest], audits: [audit] });
assert.equal(result.evidence.manifest_count, 1);
assert.equal(result.evidence.audit_count, 1);
assert.deepEqual(result.durations_ms.gate, {
  count: 1, sum_ms: 150, min_ms: 150, max_ms: 150, unavailable: 1,
});
assert.equal(result.durations_ms.suite.count, 4);
assert.equal(result.durations_ms.suite.sum_ms, 470);
assert.equal(result.durations_ms.by_suite.mcp.count, 1);
assert.equal(result.durations_ms.by_suite.all.sum_ms, 300);
assert.equal(result.durations_ms.per_test_file, null);
assert.equal(result.routing.observed_plans, 2);
assert.equal(result.routing.focused_plans, 1);
assert.equal(result.routing.fallback_plans, 1);
assert.equal(result.routing.fallback_to_all_plans, 0);
assert.equal(result.routing.fallback_to_all_ratio, 0);
assert.deepEqual(result.routing.fallback_reasons, { UNREVIEWED_CHANGE: 1 });
assert.equal(result.failure_classes.PASS_STABLE, 1);
assert.equal(result.selector_miss_candidates, 1);
assert.equal(result.confirmed_selector_misses, null);
assert.equal(result.test_result_cache.observed_runs, 0);
assert.equal(result.test_result_cache.hits, null); // snapshot cache is unrelated.
assert.equal(result.test_result_cache.hit_ratio, null);

const actualAll = aggregate({
  manifests: [{ ...manifest, integration_candidate_id: "candidate-two", tests_selected: ["all"] }],
});
assert.equal(actualAll.routing.fallback_to_all_ratio, 1);
const explicitCache = aggregate({
  manifests: [{
    ...manifest,
    test_result_cache: { hits: 2, misses: 3, bypassed: 4 },
  }],
});
assert.equal(explicitCache.test_result_cache.hits, 2);
assert.equal(explicitCache.test_result_cache.misses, 3);
assert.equal(explicitCache.test_result_cache.hit_ratio, 0.4);
assert.equal(aggregate().routing.fallback_to_all_ratio, null);

assert.throws(() => aggregate({ manifests: [manifest, manifest] }), /Duplicate evidence/u);
assert.throws(() => aggregate({ audits: [audit, audit] }), /Duplicate evidence/u);
assert.throws(() => aggregate({ manifests: [{ ...manifest, schema_version: "unknown" }] }), /Unsupported/u);
assert.throws(() => aggregate({ manifests: [{
  ...manifest, test_result_cache: { hits: -1, misses: 0, bypassed: 0 },
}] }), /Malformed/u);
assert.throws(() => aggregate({ manifests: [{
  ...manifest, failure_classification: { classification: "REGRESSION_UNPROVEN" },
}] }), /Unknown failure class/u);
console.log("VA-14 verification telemetry contracts passed.");
