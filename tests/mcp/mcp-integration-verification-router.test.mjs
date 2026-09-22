import assert from "node:assert/strict";
import test from "node:test";
import { selectIntegrationVerificationPlan } from "../../server/src/mcp-integration-verification-router.mjs";
import { selectCandidateVerificationPlan } from "../../server/src/mcp-development-integration-tools.mjs";

const suites = (paths) => selectIntegrationVerificationPlan(paths).required_suites;

test("VA-5 communication changes do not require the tunnel", () => {
  assert.deepEqual(suites([
    "server/src/character-communication-ir-service.mjs",
    "tests/communication/communication-ir.test.mjs",
  ]), ["communication"]);
});

test("VA-5 bounded memory changes retain all relevant subsystems", () => {
  assert.deepEqual(suites(["tests/phase92/phase92-memory-reconsolidation-lifecycle.test.mjs"]),
    ["memory_retrieval", "cognition", "world_simulation"]);
});

test("VA-5 MCP core, infrastructure, transport and reliability are distinct", () => {
  assert.deepEqual(suites(["server/src/mcp-development-readonly-tools.mjs"]), ["mcp_core"]);
  assert.deepEqual(suites(["tests/mcp/mcp-workspace-snapshot-authority.test.mjs"]),
    ["mcp_core", "mcp_infrastructure"]);
  assert.deepEqual(suites(["server/src/mcp-http-origin-security.mjs"]),
    ["mcp_core", "mcp_infrastructure", "mcp_tunnel"]);
  assert.deepEqual(suites(["tests/mcp/mcp-reliability-certification.test.mjs"]),
    ["mcp_core", "mcp_reliability"]);
  assert.deepEqual(suites(["server/src/mcp-http-reliability.mjs"]),
    ["mcp_core", "mcp_infrastructure", "mcp_reliability", "mcp_tunnel"]);
});

test("VA-5 cannot silently downscope unknown, mixed, integration or certification changes", () => {
  const legacy = ["mcp", "mcp_tunnel"];
  assert.deepEqual(suites([]), legacy);
  assert.deepEqual(suites(["docs/unreviewed.md"]), legacy);
  assert.deepEqual(suites(["tests/run-all.mjs"]), legacy);
  assert.deepEqual(suites(["server/src/mcp-development-integration-tools.mjs"]), legacy);
  assert.deepEqual(suites([
    "server/src/character-communication-ir-service.mjs",
    "server/src/mcp-development-readonly-tools.mjs",
  ]), legacy);
  assert.deepEqual(suites(["../escape.mjs"]), legacy);
  assert.deepEqual(suites(["server\\src\\mcp-http-origin-security.mjs"]), legacy);
  assert.deepEqual(suites(["tests/certification/character-memory-core-certification.test.mjs"]),
    ["mcp", "mcp_tunnel", "all"]);
  assert.deepEqual(selectIntegrationVerificationPlan(["server/src/unknown.mjs"]).focused, false);
});

test("VA-5 suite order and duplicate paths are deterministic", () => {
  const paths = ["server/src/mcp-http-origin-security.mjs", "server/src/mcp-http-origin-security.mjs"];
  const result = selectIntegrationVerificationPlan(paths);
  assert.deepEqual(result.changed_paths, ["server/src/mcp-http-origin-security.mjs"]);
  assert.deepEqual(result.required_suites, ["mcp_core", "mcp_infrastructure", "mcp_tunnel"]);
  assert.equal(result.fallback_reason, null);
});

test("VA-5 exact target/candidate commit diff, not working status, drives selection", async () => {
  const target = "a".repeat(40);
  const commit = "b".repeat(40);
  const plan = await selectCandidateVerificationPlan("unused-fixture-worktree", {
    target_head: target,
    integration_commit: commit,
  }, async (args, options) => {
    assert.deepEqual(args, [
      "diff", "--name-only", "--no-renames", "-z", target, commit, "--",
    ]);
    assert.equal(options.cwd, "unused-fixture-worktree");
    return {
      exit_code: 0,
      stdout: "server/src/character-communication-ir-service.mjs\0",
    };
  });
  assert.deepEqual(plan.required_suites, ["communication"]);
  await assert.rejects(selectCandidateVerificationPlan("unused-fixture-worktree", {
    target_head: "invalid",
    integration_commit: commit,
  }, async () => { throw new Error("git should not run"); }), /exact Git SHA-1/u);
  await assert.rejects(selectCandidateVerificationPlan("unused-fixture-worktree", {
    target_head: target,
    integration_commit: commit,
  }, async () => ({ exit_code: 1, stdout: "" })), /Could not verify exact integration candidate diff/u);
});
