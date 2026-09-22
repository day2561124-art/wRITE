// VA-4 reviewed ownership for every legacy MCP contract script.
// Order mirrors the existing full MCP runner; the full runner is retained until VA-5.
const entries = [
  ["server/src/mcp-smoke-test.mjs", "core"],
  ["tests/affected-test-selector.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-tool-profiles.test.mjs", "core"],
  ["tests/mcp/mcp-powershell-maintenance-tools.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-development-write-tools.test.mjs", "core"],
  ["tests/mcp/mcp-development-test-tools.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-development-journal-tools.test.mjs", "core"],
  ["tests/mcp/mcp-runtime-readiness.test.mjs", "core"],
  ["tests/mcp/mcp-connector-readiness.test.mjs", "core"],
  ["tests/mcp/mcp-launcher-wrapper.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-workspace-change-clock.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-workspace-change-clock-provider.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-windows-lock-owner-diagnostics.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-workspace-snapshot-authority.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-development-checkpoint-tools.test.mjs", "reliability"],
  ["tests/mcp/mcp-development-transaction-tools.test.mjs", "reliability"],
  ["tests/mcp/mcp-http-integration-control.test.mjs", "core"],
  ["tests/mcp/mcp-http-origin-security.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-http-session-lifecycle.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-reliability-certification.test.mjs", "reliability"],
  ["tests/mcp-http-server-lifecycle.test.mjs", "infrastructure"],
  ["tests/mcp/mcp-http-reliability.test.mjs", "reliability"],
  ["tests/mcp/mcp-http-resource-bounds.test.mjs", "reliability"],
  ["tests/mcp/mcp-development-integration-tools.test.mjs", "infrastructure"],
];
export const mcpScriptEntries = Object.freeze(entries.map(([path, layer]) =>
  Object.freeze({ path, layer }),
));
export const mcpFullScripts = Object.freeze(mcpScriptEntries.map(({ path }) => path));
export const mcpCoreScripts = Object.freeze(mcpScriptEntries
  .filter(({ layer }) => layer === "core").map(({ path }) => path));
export const mcpInfrastructureScripts = Object.freeze(mcpScriptEntries
  .filter(({ layer }) => layer === "infrastructure").map(({ path }) => path));
export const mcpReliabilityScripts = Object.freeze(mcpScriptEntries
  .filter(({ layer }) => layer === "reliability").map(({ path }) => path));
export const mcpSuiteScripts = Object.freeze({
  mcp_core: mcpCoreScripts,
  mcp_infrastructure: mcpInfrastructureScripts,
  mcp_reliability: mcpReliabilityScripts,
});
export const mcpScriptTimeoutOverrides = new Map([
  ["tests/mcp/mcp-development-test-tools.test.mjs", 600_000],
  ["tests/mcp/mcp-development-transaction-tools.test.mjs", 600_000],
]);
