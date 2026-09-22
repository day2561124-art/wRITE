// VA-5: fail-closed routing from exact target -> integration commit changes.
// This selector never grants integration, reads mutable working-tree status, or
// suppresses the independent Journal/diff/candidate/remote safety gates.
export const LEGACY_INTEGRATION_SUITES = Object.freeze(["mcp", "mcp_tunnel"]);

const transportPattern = /(?:http|tunnel|transport|session|origin|launcher|stdio|connector|process-control)/u;
const reliabilityPattern = /(?:reliability|recovery|checkpoint|transaction|failure-injection|resource-bounds)/u;
const memoryPattern = /(?:memory|retrieval|reconsolidation|consolidation|metamemory|interference|affect)/u;
const mcpCorePaths = new Set([
  "server/src/mcp-development-readonly-tools.mjs",
  "server/src/mcp-development-write-tools.mjs",
  "tests/mcp/mcp-tool-profiles.test.mjs",
  "tests/mcp/mcp-development-write-tools.test.mjs",
  "tests/mcp/mcp-development-journal-tools.test.mjs",
  "tests/mcp/mcp-runtime-readiness.test.mjs",
  "tests/mcp/mcp-connector-readiness.test.mjs",
]);
const mcpInfrastructurePaths = new Set([
  "tests/mcp/mcp-workspace-change-clock.test.mjs",
  "tests/mcp/mcp-workspace-change-clock-provider.test.mjs",
  "tests/mcp/mcp-windows-lock-owner-diagnostics.test.mjs",
  "tests/mcp/mcp-workspace-snapshot-authority.test.mjs",
]);
const mcpReliabilityPaths = new Set([
  "tests/mcp/mcp-development-checkpoint-tools.test.mjs",
  "tests/mcp/mcp-development-transaction-tools.test.mjs",
  "tests/mcp/mcp-reliability-certification.test.mjs",
  "tests/mcp/mcp-http-reliability.test.mjs",
  "tests/mcp/mcp-http-resource-bounds.test.mjs",
]);

function legacy(reason, paths, extra = []) {
  return Object.freeze({
    risk_class: "unknown_escalated",
    fallback_reason: reason,
    changed_paths: Object.freeze(paths),
    required_suites: Object.freeze([...LEGACY_INTEGRATION_SUITES, ...extra]),
    focused: false,
  });
}

export function selectIntegrationVerificationPlan(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    return legacy("NO_VERIFIED_COMMIT_DIFF", []);
  }
  const paths = [];
  let invalidPath = false;
  for (const value of changedPaths) {
    if (
      typeof value !== "string" || !value ||
      value.startsWith("/") || value.includes("\\") ||
      value.split("/").some(part => !part || part === "." || part === ".." || part.includes("\0"))
    ) { invalidPath = true; continue; }
    if (!paths.includes(value)) paths.push(value);
  }
  const certification = paths.some(p => p.startsWith("tests/certification/"));
  if (invalidPath) return legacy("INVALID_CHANGE_PATH", paths, certification ? ["all"] : []);
  if (certification) return legacy("CERTIFICATION_CHANGE", paths, ["all"]);
  const categories = new Set();
  const suites = new Set();
  for (const p of paths) {
    if (p.startsWith("server/src/character-communication-") && p.endsWith(".mjs")) {
      categories.add("communication");
      suites.add("communication");
      continue;
    }
    if (p === "tests/communication/communication-ir.test.mjs") {
      categories.add("communication");
      suites.add("communication");
      continue;
    }
    if (
      (p.startsWith("server/src/world-simulation-") && p.endsWith(".mjs") && memoryPattern.test(p))
      || /^tests\/phase9[0-6]\/[^/]+\.test\.mjs$/u.test(p)
    ) {
      categories.add("memory_cognition");
      suites.add("memory_retrieval");
      suites.add("cognition");
      suites.add("world_simulation");
      continue;
    }
    if (mcpReliabilityPaths.has(p) || (p.startsWith("server/src/mcp-") && reliabilityPattern.test(p))) {
      categories.add("mcp");
      suites.add("mcp_core");
      suites.add("mcp_reliability");
      if (transportPattern.test(p)) {
        suites.add("mcp_infrastructure");
        suites.add("mcp_tunnel");
      }
      continue;
    }
    if (mcpCorePaths.has(p)) {
      categories.add("mcp");
      suites.add("mcp_core");
      continue;
    }
    if (mcpInfrastructurePaths.has(p)) {
      categories.add("mcp");
      suites.add("mcp_core");
      suites.add("mcp_infrastructure");
      continue;
    }
    if (
      (p.startsWith("server/src/mcp-") || p.startsWith("tests/mcp/") || p === "tests/mcp-http-server-lifecycle.test.mjs")
      && transportPattern.test(p)
    ) {
      categories.add("mcp");
      suites.add("mcp_core");
      suites.add("mcp_infrastructure");
      suites.add("mcp_tunnel");
      continue;
    }
    return legacy("UNREVIEWED_CHANGE:" + p, paths);
  }
  if (categories.size !== 1) return legacy("CROSS_BOUNDARY_OR_EMPTY_CHANGE", paths);
  // Preserve the approved runner ordering, independent of input file ordering.
  const ordered = [
    "communication",
    "memory_retrieval",
    "cognition",
    "world_simulation",
    "mcp_core",
    "mcp_infrastructure",
    "mcp_reliability",
    "mcp_tunnel",
  ].filter(suite => suites.has(suite));
  return Object.freeze({
    risk_class: [...categories][0],
    fallback_reason: null,
    changed_paths: Object.freeze(paths),
    required_suites: Object.freeze(ordered),
    focused: true,
  });
}
