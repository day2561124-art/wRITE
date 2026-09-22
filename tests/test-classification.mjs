import {
  cognitionSteps,
  communicationSteps,
  memoryRetrievalSteps,
  worldSimulationSteps,
} from "./test-suite-groups.mjs";
import {
  mcpFullScripts,
  mcpHermeticCoreScripts,
  mcpHermeticCoreEntrypoint,
} from "./tools/mcp-suite-groups.mjs";

const legacyMcpScriptSet = new Set(mcpFullScripts);
const reviewedHermeticCoreSet = new Set([
  ...mcpHermeticCoreScripts,
  mcpHermeticCoreEntrypoint,
]);

export const reviewedParallelSafeTestPaths = Object.freeze([
  ...mcpHermeticCoreScripts,
  "tests/communication/cc1-foundation.test.mjs",
  "tests/communication/cc5-mandarin-surface-realization.test.mjs",
  "tests/communication/cc6-listener-reception.test.mjs",
  "tests/communication/communication-ir.test.mjs",
]);
const reviewedParallelSafeSet = new Set(reviewedParallelSafeTestPaths);

export const reviewedCacheableTestPaths = Object.freeze([
  ...mcpHermeticCoreScripts,
  "tests/communication/cc1-foundation.test.mjs",
  "tests/communication/cc6-listener-reception.test.mjs",
]);
const reviewedCacheableSet = new Set(reviewedCacheableTestPaths);

export const testClassificationVersion = "verification-test-classification-v1";

export const TEST_KINDS = Object.freeze([
  "unit",
  "contract",
  "invariant",
  "subsystem",
  "integration",
  "e2e",
  "infrastructure",
  "certification",
  "reliability",
]);

const stepPaths = (steps) => new Set(
  steps.flatMap(([, args]) => args.filter((item) =>
    typeof item === "string" && item.startsWith("tests/") && item.endsWith(".test.mjs")
  )),
);

const grouped = Object.freeze({
  communication: stepPaths(communicationSteps),
  world_simulation: stepPaths(worldSimulationSteps),
  cognition: stepPaths(cognitionSteps),
  memory_retrieval: stepPaths(memoryRetrievalSteps),
});

const unique = (values) => [...new Set(values)].sort();

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function componentsFor(testPath) {
  const memberships = [];
  for (const [name, paths] of Object.entries(grouped)) {
    if (paths.has(testPath)) memberships.push(name);
  }
  if (memberships.length > 0) return unique(memberships);

  const parts = testPath.split("/");
  const bucket = parts.length > 2 ? parts[1] : "repository";
  if (bucket === "mcp" || /(?:^|\/)mcp(?:-|\/)/u.test(testPath)) return ["mcp"];
  if (bucket === "communication") return ["communication"];
  if (bucket === "certification") return ["certification"];
  if (/^phase\d+$/u.test(bucket)) return [bucket];
  return [bucket || "repository"];
}

function primaryComponent(testPath, components) {
  const lower = testPath.toLowerCase();
  if (lower.includes("/certification/")) return "certification";
  if (lower.startsWith("tests/mcp/") || /(?:^|\/)mcp(?:-|\/)/u.test(lower)) return "mcp";
  if (lower.startsWith("tests/communication/")) return "communication";
  const phase = lower.match(/^tests\/phase(\d+)\//u);
  if (phase) return Number(phase[1]) === 62 ? "world_simulation" : "character_brain";
  return components[0];
}

function classifyKind(testPath) {
  const lower = testPath.toLowerCase();
  if (/reliability|fault-injection|failure-injection|recovery-certification/u.test(lower)) return "reliability";
  if (lower.includes("/certification/") || lower.includes("-certification.")) return "certification";
  if (/mcp|tunnel|cloudflare|launcher|http-|session-lifecycle|resource-bounds/u.test(lower)) return "infrastructure";
  if (/e2e|end-to-end|full-workflow-smoke|acceptance/u.test(lower)) return "e2e";
  if (lower.endsWith("/communication-ir.test.mjs")) return "contract";
  if (/contract|boundary|guard|schema|invariant|validation/u.test(lower)) {
    return lower.includes("invariant") ? "invariant" : "contract";
  }
  if (/integration|native-loop|native-.*(?:adoption|closure|wiring|bridge)/u.test(lower)) return "integration";
  if (/\/phase\d+\//u.test(lower) || lower.includes("/communication/")) return "subsystem";
  return "unit";
}

function inferDependencies(source) {
  const text = String(source ?? "");
  const deps = [];
  if (/node:fs|from ["']fs["']|readFile|writeFile|mkdtemp|mkdir|rm\(/u.test(text)) deps.push("filesystem");
  if (/node:child_process|spawn\(|execFile\(|terminateProcessTree/u.test(text)) deps.push("process");
  if (/node:https?|fetch\(|localhost|127\.0\.0\.1|trycloudflare|cloudflared/u.test(text)) deps.push("network");
  if (/\bgit(?:\.exe)?\b|rev-parse|merge-base|diff --check|ls-remote/u.test(text)) deps.push("git");
  if (/process\.env|process\.platform|process\.execPath/u.test(text)) deps.push("environment");
  if (/Date\.now\(|new Date\(|setTimeout\(|setInterval\(/u.test(text)) deps.push("clock");
  if (/Development Journal|dev_workspace_|checkpoint|transaction|integration_candidate|registry_revision/u.test(text)) {
    deps.push("persistent_state");
  }
  return unique(deps);
}

function evidenceFlags(testPath, source, kind, dependencies) {
  const lower = testPath.toLowerCase();
  const text = String(source ?? "");

  const fixedPort = /(?:^|[^0-9])(?:8787|8788|3000|3001|8080)(?:[^0-9]|$)/u.test(text);
  const network = dependencies.includes("network");
  const process = dependencies.includes("process");
  const persistentState = dependencies.includes("persistent_state");
  const filesystem = dependencies.includes("filesystem");
  const git = dependencies.includes("git");
  const environment = dependencies.includes("environment");
  const clock = dependencies.includes("clock");
  const externalState = network
    || persistentState
    || /cloudflare|tunnel|connector|remote|live[-_ ]?acceptance/u.test(lower);

  // VA-2 is intentionally conservative. Later VA-9 can promote individual
  // tests only after hermetic behavior is demonstrated.
  const hermetic = !externalState
    && !process
    && !filesystem
    && !git
    && !environment
    && !clock
    && !fixedPort
    && !["infrastructure", "reliability", "e2e"].includes(kind);
  // VA-10 requires explicit review before a hermetic test may enter a
  // concurrent execution lane. Hermeticity is necessary but not sufficient.
  const parallelSafe = false;
  // VA-11 requires an explicit declared-input review before result reuse.
  // Hermeticity alone cannot prove a complete cache key.
  const cacheable = false;

  return {
    external_state: externalState,
    hermetic,
    parallel_safe: parallelSafe,
    cacheable,
    fixed_port_evidence: fixedPort,
  };
}

export function classifyTestFile({ testPath, source = "" } = {}) {
  const path = normalizePath(testPath);
  if (!path.startsWith("tests/") || !path.endsWith(".test.mjs")) {
    throw new Error(`Unsupported test path for classification: ${path || "<empty>"}`);
  }

  const reviewedHermeticCore = reviewedHermeticCoreSet.has(path);
  const reviewedParallelSafe = reviewedParallelSafeSet.has(path);
  const reviewedCacheable = reviewedCacheableSet.has(path);
  const legacyExternalState = legacyMcpScriptSet.has(path);
  const kind = reviewedHermeticCore ? "unit" : classifyKind(path);
  const components = componentsFor(path);
  const component = primaryComponent(path, components);
  const dependencies = inferDependencies(source);
  // A reviewed test must stop being called hermetic as soon as its own source
  // gains an observable host/process/network/time/persistence dependency.
  if (reviewedHermeticCore && dependencies.length > 0) {
    throw new Error(`Reviewed hermetic test gained dependencies: ${path}: ${dependencies.join(", ")}.`);
  }
  const inferred = evidenceFlags(path, source, kind, dependencies);
  if (reviewedParallelSafe && (!inferred.hermetic || inferred.external_state || dependencies.length > 0)) {
    throw new Error(`Reviewed parallel-safe test gained dependencies: ${path}: ${dependencies.join(", ") || "external state"}.`);
  }
  if (reviewedCacheable && (!reviewedParallelSafe || !inferred.hermetic || inferred.external_state || dependencies.length > 0)) {
    throw new Error(`Reviewed cacheable test lost deterministic eligibility: ${path}: ${dependencies.join(", ") || "external state"}.`);
  }
  const flags = reviewedHermeticCore ? {
    hermetic: true, external_state: false, parallel_safe: reviewedParallelSafe,
    cacheable: reviewedCacheable, fixed_port_evidence: false,
  } : legacyExternalState ? {
    ...inferred, hermetic: false, external_state: true,
    parallel_safe: false, cacheable: false,
  } : {
    ...inferred,
    parallel_safe: reviewedParallelSafe,
    cacheable: reviewedCacheable,
  };

  return Object.freeze({
    schema_version: testClassificationVersion,
    test_path: path,
    kind,
    component,
    components: Object.freeze(components),
    dependencies: Object.freeze(dependencies),
    hermetic: flags.hermetic,
    parallel_safe: flags.parallel_safe,
    cacheable: flags.cacheable,
    external_state: flags.external_state,
    fixed_port_evidence: flags.fixed_port_evidence,
    classification_basis: Object.freeze([
      "path_rules",
      ...(components.some((item) => Object.hasOwn(grouped, item)) ? ["suite_group_membership"] : []),
      ...(dependencies.length > 0 ? ["static_dependency_evidence"] : []),
      "conservative_execution_flags",
      ...(legacyExternalState ? ["legacy_mcp_external_state"] : []),
      ...(reviewedHermeticCore ? ["reviewed_hermetic_core_local_fixture"] : []),
      ...(reviewedParallelSafe ? ["reviewed_parallel_safe"] : []),
      ...(reviewedCacheable ? ["reviewed_cacheable_declared_inputs"] : []),
    ]),
  });
}
