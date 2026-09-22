import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mcpScriptEntries,
  mcpFullScripts,
  mcpCoreScripts,
  mcpInfrastructureScripts,
  mcpReliabilityScripts,
  mcpSuiteScripts,
  mcpScriptTimeoutOverrides,
  mcpHermeticCoreScripts,
  mcpHermeticCoreEntrypoint,
} from "./mcp-suite-groups.mjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "..", "..");
const original = readFileSync(path.join(dirname, "mcp-contract.test.mjs"), "utf8");
const legacyMatch = original.match(/const testScripts = \[([\s\S]*?)\];/u);
assert.ok(legacyMatch, "Existing full MCP contract runner inventory must remain inspectable.");
const legacyScripts = [...legacyMatch[1].matchAll(/"([^"]+\.mjs)"/gu)].map((match) => match[1]);
assert.equal(legacyScripts.length, 24, "Original 24 MCP scripts are retained.");
assert.deepEqual(mcpFullScripts, legacyScripts, "VA-4 partition must preserve every script and the legacy full order.");
assert.equal(new Set(mcpFullScripts).size, mcpFullScripts.length);
const layerScripts = [mcpCoreScripts, mcpInfrastructureScripts, mcpReliabilityScripts];
for (const group of layerScripts) {
  assert.ok(group.length > 0, "Every MCP layer must retain substantive tests.");
  assert.equal(new Set(group).size, group.length);
}
assert.deepEqual(
  [...layerScripts.flat()].sort(),
  [...mcpFullScripts].sort(),
  "Layered suites must cover each legacy MCP script exactly once.",
);
assert.deepEqual(
  Object.keys(mcpSuiteScripts),
  ["mcp_core", "mcp_infrastructure", "mcp_reliability"],
);
for (const entry of mcpScriptEntries) {
  assert.ok(["core", "infrastructure", "reliability"].includes(entry.layer));
  assert.equal(entry.external_state, true, "Legacy MCP scripts retain explicit external-state labeling");
  assert.equal(entry.hermetic, false, "A functional Core label does not imply hermetic execution");
  assert.ok(existsSync(path.join(root, entry.path)), "Missing MCP test script: " + entry.path);
}
assert.ok(mcpCoreScripts.includes("server/src/mcp-smoke-test.mjs"));
assert.ok(mcpCoreScripts.includes("tests/mcp/mcp-tool-profiles.test.mjs"));
assert.ok(mcpCoreScripts.includes("tests/mcp/mcp-development-journal-tools.test.mjs"));
assert.ok(mcpCoreScripts.includes("tests/mcp/mcp-runtime-readiness.test.mjs"));
assert.ok(mcpCoreScripts.includes("tests/mcp/mcp-connector-readiness.test.mjs"));
assert.ok(!mcpCoreScripts.some((script) => /reliability|certification|transaction|checkpoint|tunnel/iu.test(script)));
for (const required of [
  "tests/mcp/mcp-reliability-certification.test.mjs",
  "tests/mcp/mcp-http-reliability.test.mjs",
  "tests/mcp/mcp-development-transaction-tools.test.mjs",
  "tests/mcp/mcp-development-checkpoint-tools.test.mjs",
]) assert.ok(mcpReliabilityScripts.includes(required), "Required reliability test omitted: " + required);
assert.deepEqual(
  [...mcpScriptTimeoutOverrides],
  [
    ["tests/mcp/mcp-development-test-tools.test.mjs", 600_000],
    ["tests/mcp/mcp-development-transaction-tools.test.mjs", 600_000],
  ],
);
assert.deepEqual(mcpHermeticCoreScripts, [
  "tests/mcp/mcp-verification-failure-classifier.test.mjs",
  "tests/mcp/mcp-verification-controlled-retry.test.mjs",
]);
assert.equal(new Set(mcpHermeticCoreScripts).size, mcpHermeticCoreScripts.length);
assert(mcpHermeticCoreScripts.every((item) => !mcpFullScripts.includes(item)),
  "VA-9 hermetic suite must be additive, not a disguised VA-4 migration");
assert(existsSync(path.join(root, mcpHermeticCoreEntrypoint)));
const entrypoint = readFileSync(path.join(root, mcpHermeticCoreEntrypoint), "utf8");
const directImports = [...entrypoint.matchAll(/import "\.\.\/mcp\/([^"]+\.test\.mjs)";/gu)]
  .map((match) => `tests/mcp/${match[1]}`);
assert.deepEqual(directImports, mcpHermeticCoreScripts,
  "Hermetic entrypoint and reviewed inventory must agree exactly");
console.log("VA-4 MCP 24-script partition and legacy full-suite preservation: PASS");
console.log("VA-9 reviewed hermetic core and explicit legacy external-state contract: PASS");
