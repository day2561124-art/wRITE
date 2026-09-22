export const VERIFICATION_TELEMETRY_VERSION = "verification-telemetry-v1";
const FAILURE_CLASSES = new Set(["PASS_STABLE", "REGRESSION", "FLAKY", "INFRA_FAILURE", "ENVIRONMENT_FAILURE", "TIMEOUT", "LOCK_CONTENTION", "UNKNOWN"]);

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid " + label + ": object required.");
  }
  return value;
}
function series() {
  return { count: 0, sum_ms: 0, min_ms: null, max_ms: null, unavailable: 0 };
}
function observe(series, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    series.unavailable++;
    return;
  }
  series.count++;
  series.sum_ms += value;
  series.min_ms = series.min_ms === null ? value : Math.min(series.min_ms, value);
  series.max_ms = series.max_ms === null ? value : Math.max(series.max_ms, value);
}
function increment(map, key) { map[key] = (map[key] ?? 0) + 1; }
function sorted(map) {
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
}
function validResults(results) {
  if (!Array.isArray(results)) throw new Error("Suite results array required.");
  return results.map((result) => {
    record(result, "suite result");
    if (typeof result.suite !== "string" || !result.suite) {
      throw new Error("Suite identity required.");
    }
    return result;
  });
}

export function aggregateVerificationTelemetry({ manifests = [], audits = [] } = {}) {
  if (!Array.isArray(manifests) || !Array.isArray(audits)) {
    throw new Error("Telemetry inputs must be arrays.");
  }
  const seen = new Set();
  const suites = Object.create(null);
  const suiteDuration = series();
  const gateDuration = series();
  const failureClasses = Object.create(null);
  const fallbackReasons = Object.create(null);
  const auditClasses = Object.create(null);
  let observedPlans = 0, focusedPlans = 0, fallbackPlans = 0, fallbackAllPlans = 0;
  let candidateMisses = 0, cacheRuns = 0, cacheHits = 0, cacheMisses = 0, cacheBypassed = 0;

  function unique(id) {
    if (seen.has(id)) throw new Error("Duplicate evidence: " + id);
    seen.add(id);
  }
  function suiteEvidence(results) {
    for (const result of validResults(results)) {
      if (!Object.hasOwn(suites, result.suite)) suites[result.suite] = series();
      observe(suites[result.suite], result.duration_ms);
      observe(suiteDuration, result.duration_ms);
    }
  }
  function planEvidence(raw, allFallback) {
    observedPlans++;
    if (raw.focused === true) focusedPlans++;
    else if (typeof raw.fallback_reason === "string" && raw.fallback_reason) {
      fallbackPlans++;
      increment(fallbackReasons, raw.fallback_reason.split(":")[0]);
      if (allFallback) fallbackAllPlans++;
    }
  }

  for (const raw of manifests) {
    record(raw, "manifest");
    if (raw.schema_version !== "verification-manifest-v1"
        || !["integration", "development"].includes(raw.gate)) {
      throw new Error("Unsupported verification manifest.");
    }
    const id = raw.gate === "integration" ? raw.integration_candidate_id
      : raw.workspace_snapshot_id + ":" + raw.suite_results?.[0]?.operation_id;
    if (typeof id !== "string" || !id || id.includes("undefined")) {
      throw new Error("Missing manifest evidence identity.");
    }
    unique("manifest:" + raw.gate + ":" + id);
    observe(gateDuration, raw.duration_ms);
    suiteEvidence(raw.suite_results);
    const cls = raw.failure_classification?.classification;
    if (cls !== undefined && cls !== null) {
      if (!FAILURE_CLASSES.has(cls)) throw new Error("Unknown failure class: " + cls);
      increment(failureClasses, cls);
    }
    if (raw.gate === "integration") {
      planEvidence(raw, Array.isArray(raw.tests_selected) && raw.tests_selected.includes("all"));
    }
    // VA-6 does not yet contain VA-11 counters. Never confuse snapshot
    // fingerprint-cache hits with test-result-cache hits.
    if (raw.test_result_cache !== undefined && raw.test_result_cache !== null) {
      const cache = record(raw.test_result_cache, "test-result cache");
      if (![cache.hits, cache.misses, cache.bypassed].every((n) =>
        Number.isSafeInteger(n) && n >= 0)) {
        throw new Error("Malformed test-result cache counters.");
      }
      cacheRuns++;
      cacheHits += cache.hits;
      cacheMisses += cache.misses;
      cacheBypassed += cache.bypassed;
    }
  }

  for (const raw of audits) {
    record(raw, "selector audit");
    if (raw.schema_version !== "ci-selection-audit-v1"
        || typeof raw.base_sha !== "string" || typeof raw.head_sha !== "string"
        || typeof raw.completed_at !== "string") {
      throw new Error("Unsupported or incomplete selector audit.");
    }
    unique("audit:" + raw.base_sha + ":" + raw.head_sha + ":" + raw.completed_at);
    increment(auditClasses, raw.classification ?? "UNKNOWN");
    if (raw.classification === "SELECTOR_MISS_CANDIDATE") candidateMisses++;
    const results = validResults(raw.affected_results);
    if (raw.full_result !== undefined && raw.full_result !== null) {
      const full = record(raw.full_result, "full result");
      results.push({ ...full, suite: "all" });
    }
    suiteEvidence(results);
    observe(gateDuration, null); // VA-13 has no gate-level duration.
    planEvidence(raw, raw.focused !== true && !!raw.fallback_reason);
  }

  return Object.freeze({
    schema_version: VERIFICATION_TELEMETRY_VERSION,
    evidence: { manifest_count: manifests.length, audit_count: audits.length },
    durations_ms: {
      gate: gateDuration,
      suite: suiteDuration,
      by_suite: sorted(suites),
      per_test_file: null,
      per_test_file_unavailable_reason: "SOURCE_RECEIPTS_ARE_SUITE_LEVEL_ONLY",
    },
    routing: {
      observed_plans: observedPlans,
      focused_plans: focusedPlans,
      fallback_plans: fallbackPlans,
      fallback_to_all_plans: fallbackAllPlans,
      fallback_to_all_ratio: observedPlans ? fallbackAllPlans / observedPlans : null,
      fallback_reasons: sorted(fallbackReasons),
    },
    failure_classes: sorted(failureClasses),
    audit_classes: sorted(auditClasses),
    selector_miss_candidates: candidateMisses,
    confirmed_selector_misses: null,
    confirmed_selector_misses_reason: "REQUIRES_REVIEWED_CAUSAL_EVIDENCE",
    test_result_cache: {
      observed_runs: cacheRuns,
      hits: cacheRuns ? cacheHits : null,
      misses: cacheRuns ? cacheMisses : null,
      bypassed: cacheRuns ? cacheBypassed : null,
      hit_ratio: cacheRuns && cacheHits + cacheMisses
        ? cacheHits / (cacheHits + cacheMisses) : null,
    },
  });
}
