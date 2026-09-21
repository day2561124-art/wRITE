import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = "docs/verification-baseline-manifest.json";
const sources = [
  "tests/run-all.mjs", "tests/test-suite-groups.mjs", "tests/test-suite-groups.test.mjs",
  "tests/run-world-simulation.mjs", "tests/run-cognition.mjs", "tests/run-memory-retrieval.mjs",
  "tests/run-affected.mjs", "tests/affected-test-selector.mjs", "tests/test-runner-core.mjs",
  "tests/tools/mcp-contract.test.mjs", "tests/mcp-tunnel-launcher.test.mjs",
  "server/src/mcp-development-test-tools.mjs", "server/src/mcp-development-integration-tools.mjs",
  ".github/workflows/ci.yml", "package.json", "package-lock.json",
];
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true });
const unique = (items) => [...new Set(items)].sort();
const scripts = (steps) => unique(steps.map(([, argv]) => argv[0]));
const testFiles = (items) => unique(items.filter((item) => item.startsWith("tests/") && item.endsWith(".test.mjs")));
function match(text, pattern, label) {
  const found = text.match(pattern);
  assert.ok(found, `Unsupported baseline source structure: ${label}`);
  return found[1];
}
// Evaluate only bounded, repository-owned declaration fragments, never runner modules.
// There is no process, filesystem, import or require in this context.
function declaration(source) {
  return JSON.parse(vm.runInNewContext(`JSON.stringify(${source})`, {}, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }));
}
export function collectBaseline(head) {
  assert.match(head, /^[a-f0-9]{40}$/u, "baseline HEAD must be an exact SHA-1");
  assert.equal(git("rev-parse", `${head}^{commit}`).trim(), head);
  const text = Object.fromEntries(sources.map((file) => [file, git("show", `${head}:${file}`)]));
  const allSource = text["tests/run-all.mjs"];
  const allSteps = declaration(match(allSource, /const steps = (\[[\s\S]*?\n\]);/u, "run-all steps"));
  const groupSource = text["tests/test-suite-groups.mjs"];
  const groupNames = [...groupSource.matchAll(/export const (\w+) =/gu)].map((item) => item[1]);
  const groups = JSON.parse(vm.runInNewContext(`${groupSource.replaceAll("export const ", "const ")}\nJSON.stringify({${groupNames.join(",")}})`, {}, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }));
  const groupMappings = Object.fromEntries(Object.entries(groups).map(([name, steps]) => [name, scripts(steps)]));
  const grouped = testFiles(Object.values(groupMappings).flat());
  const inventory = testFiles(scripts(allSteps));
  const timeoutBody = match(allSource, /function getTimeoutMs\(label\) \{([\s\S]*?)\n\}/u, "run-all timeout function");
  const allTimeouts = Object.fromEntries(allSteps.map(([label]) => [label, vm.runInNewContext(`(function(label) {${timeoutBody}})(${JSON.stringify(label)})`, {}, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } })]));
  const devSource = text["server/src/mcp-development-test-tools.mjs"];
  const suiteNames = declaration(match(devSource, /DEV_TEST_SUITES = Object.freeze\((\[[\s\S]*?\])\);/u, "suite names"));
  const definitions = {};
  for (const name of suiteNames) {
    const body = match(devSource, new RegExp(`${name}: Object.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\),`, "u"), `suite ${name}`);
    definitions[name] = {
      executable: "process.execPath",
      argv: declaration(match(body, /argv: Object.freeze\((\[[^\n]*\])\)/u, `${name} argv`)),
      timeout_ms: Number(match(body, /timeoutMs: ([\d_]+)/u, `${name} timeout`).replaceAll("_", "")),
      cleanup_port: body.match(/cleanupPort: (\d+)/u) ? Number(body.match(/cleanupPort: (\d+)/u)[1]) : null,
    };
  }
  const mcpSource = text["tests/tools/mcp-contract.test.mjs"];
  const mcpScripts = declaration(match(mcpSource, /const testScripts = (\[[\s\S]*?\n\]);/u, "MCP composition"));
  const mcpOverrides = declaration(match(mcpSource, /testScriptTimeoutOverrides = new Map\((\[[\s\S]*?\n\])\);/u, "MCP timeout overrides"));
  const ci = text[".github/workflows/ci.yml"];
  const ciMatrix = [...ci.matchAll(/- os: ([\w-]+)\s+node: (\d+)/gu)].map(([, os, node]) => ({ os, node: Number(node) }));
  assert.equal(ciMatrix.length, 3);
  const trackedTests = git("ls-tree", "-r", "--name-only", head, "tests").trim().split(/\r?\n/u).filter((file) => file.endsWith(".test.mjs"));
  const trackedPaths = new Set(git("ls-tree", "-r", "--name-only", head).trim().split(/\r?\n/u));
  for (const file of unique([...scripts(allSteps), ...grouped, ...mcpScripts])) assert.ok(trackedPaths.has(file), `Missing baseline script: ${file}`);
  return {
    schema_version: 1, phase: "VA-0", baseline_head: head,
    authority: "Committed Git blobs at baseline_head; excludes every working-tree overlay. Historical preservation, not a live routing policy or cached test result.",
    source_sha256: Object.fromEntries(sources.map((file) => [file, createHash("sha256").update(text[file]).digest("hex")])),
    test_inventory_count: inventory.length, grouped_test_count: grouped.length,
    grouped_inventory_intersection_count: inventory.filter((file) => grouped.includes(file)).length,
    tracked_test_file_count: trackedTests.length,
    inventory_test_files: inventory,
    tracked_tests_outside_direct_run_all: trackedTests.filter((file) => !inventory.includes(file)),
    group_mappings: Object.fromEntries(["worldSimulationSteps", "cognitionSteps", "memoryRetrievalSteps", "characterMemoryCoreCertificationSteps"].map((name) => [name, groupMappings[name]])), suite_definitions: definitions,
    subsystem_runner_prelude: "tests/test-suite-groups.test.mjs",
    subsystem_suite_groups: { world_simulation: "worldSimulationSteps", cognition: "cognitionSteps", memory_retrieval: "memoryRetrievalSteps" },
    full_runner_steps: allSteps,
    full_runner_timeout_policy: { default_ms: 360000, overrides_ms: Object.fromEntries(Object.entries(allTimeouts).filter(([, timeout]) => timeout !== 360000)) },
    mcp: { execution: "sequential", script_count: mcpScripts.length, scripts: mcpScripts, default_script_timeout_ms: Number(match(mcpSource, /defaultTestScriptTimeoutMs = ([\d_]+)/u, "MCP timeout").replaceAll("_", "")), timeout_overrides_ms: Object.fromEntries(mcpOverrides) },
    integration: {
      required_suites: declaration(match(text["server/src/mcp-development-integration-tools.mjs"], /for \(const suite of (\[[^\n]*\])\)/u, "integration required suites")),
      candidate: "Exact integration commit materialized in a detached worktree; pre/post-test cleanliness and diff checks; source, target and dependency freshness rechecked before apply.",
      apply: "Locked ff-only main advancement; staged/conflict/active-operation refusal; dirty snapshot preservation; post-apply HEAD and full working-tree diff --check.",
    },
    ci: { workflow: ".github/workflows/ci.yml", events: ["push", "pull_request"], matrix: ciMatrix, command: match(ci, /- run: (node tests\/run-all\.mjs)/u, "CI command"), timeout_minutes: Number(match(ci, /timeout-minutes: (\d+)/u, "CI timeout")), fail_fast: false },
    timeout_policy: { subsystem_default_step_ms: Number(match(text["tests/test-runner-core.mjs"], /DEFAULT_TIMEOUT_MS = ([\d_]+)/u, "subsystem timeout").replaceAll("_", "")), affected_all_child_ms: 7200000, retry: "No automatic retry in these runners; no FAIL-then-PASS stable-pass promotion." },
    affected: { selector_version: match(text["tests/affected-test-selector.mjs"], /affectedTestSelectorVersion = "([^"]+)"/u, "selector version"), production_scope: "server/src/world-simulation-*.mjs", uncertainty: "conservative all fallback", execution: "Selected subsystem runner (not individual affected_tests). Ungrouped transitive dependents may be deferred to final all gate." },
    preservation: { validation_behavior_changed: false, certification_removed: false, reliability_removed: false, external_state_cached: false, parallelism_added: false },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--generate" && process.argv.length === 4) {
    console.log(JSON.stringify(collectBaseline(process.argv[3]), null, 2));
  } else {
    assert.equal(process.argv.length, 2, "Usage: node scripts/verify-verification-baseline.mjs [--generate <exact-HEAD>]");
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), "utf8"));
    assert.deepEqual(manifest, collectBaseline(manifest.baseline_head));
    console.log(`VA-0 baseline verified: ${manifest.baseline_head}; ${manifest.test_inventory_count} direct inventory tests; ${manifest.grouped_test_count} grouped; ${manifest.mcp.script_count} MCP scripts.`);
  }
}
