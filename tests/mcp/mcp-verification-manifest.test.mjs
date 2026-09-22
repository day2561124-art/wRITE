import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIntegrationVerificationManifest,
  VERIFICATION_MANIFEST_VERSION,
} from "../../server/src/mcp-verification-manifest.mjs";

const sha = (digit) => digit.repeat(40);
const candidate = {
  integration_candidate_id: "dev_integration_20260922-030000_aaaaaaaaaaaa",
  integration_commit: sha("a"),
  target_head: sha("b"),
  source_head: sha("c"),
  workspace_id: "dev_workspace_aaaaaaaaaaaaaaaaaaaaaaaa",
  workstream_id: "dev_workstream_20260922-030000_aaaaaaaaaaaa",
};
const plan = {
  required_suites: ["communication"],
  changed_paths: ["server/src/character-communication-foundation-service.mjs"],
  risk_class: "communication",
  focused: true,
  fallback_reason: null,
};
const passed = {
  suite: "communication",
  operation_id: "dev_operation_" + "e".repeat(32),
  execution_ok: true,
  passed: true,
  timed_out: false,
  exit_code: 0,
  duration_ms: 15,
};
function manifest(overrides = {}) {
  return buildIntegrationVerificationManifest({
    candidate, plan, suiteResults: [passed],
    diffCheck: { passed: true }, postTestWorktreeClean: true,
    completedAt: "2026-09-22T03:00:00.000Z",
    ...overrides,
  });
}

test("VA-6 records exact source/target/candidate identities and truthful skipped legacy suites", () => {
  const result = manifest();
  assert.equal(result.schema_version, VERIFICATION_MANIFEST_VERSION);
  assert.equal(result.commit, candidate.integration_commit);
  assert.equal(result.source_head, candidate.source_head);
  assert.equal(result.target_head, candidate.target_head);
  assert.equal(result.workstream, candidate.workstream_id);
  assert.deepEqual(result.changed_files, plan.changed_paths);
  assert.deepEqual(result.tests_selected, ["communication"]);
  assert.equal(result.test_selection_granularity, "suite");
  assert.deepEqual(result.tests_skipped.map(item => item.suite), ["mcp", "mcp_tunnel"]);
  assert.equal(result.suite_results[0].operation_id, passed.operation_id);
  assert.equal(result.duration_ms, 15);
  assert.equal(result.gate_result, "passed");
  assert.equal(result.reliability_required, false);
  assert.equal(result.certification_required, false);
});

test("VA-6 does not green-light missing, duplicate, timed-out, failed, or dirty results", () => {
  assert.equal(manifest({ suiteResults: [] }).gate_result, "failed");
  assert.deepEqual(manifest({ suiteResults: [] }).missing_required_suites, ["communication"]);
  assert.equal(manifest({ suiteResults: [passed, passed] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, timed_out: true }] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, passed: false }] }).gate_result, "failed");
  assert.equal(manifest({ suiteResults: [{ ...passed, execution_ok: false }] }).gate_result, "failed");
  assert.equal(manifest({ diffCheck: { passed: false } }).gate_result, "failed");
  assert.equal(manifest({ postTestWorktreeClean: false }).gate_result, "failed");
});

test("VA-6 preserves unknown risk escalation and never marks required MCP gates skipped", () => {
  const fallback = manifest({
    plan: {
      required_suites: ["mcp", "mcp_tunnel"],
      changed_paths: ["unknown.file"],
      risk_class: "unknown_escalated",
      fallback_reason: "UNREVIEWED_CHANGE:unknown.file",
      focused: false,
    },
    suiteResults: [
      { ...passed, suite: "mcp" },
      { ...passed, suite: "mcp_tunnel" },
    ],
  });
  assert.equal(fallback.gate_result, "passed");
  assert.deepEqual(fallback.tests_skipped, []);
  assert.equal(fallback.fallback_reason, "UNREVIEWED_CHANGE:unknown.file");
  assert.deepEqual(fallback.affected_components, []);
});

test("VA-6 carries certification/reliability requirements and rejects invented commit identity", () => {
  const reliability = manifest({
    plan: { ...plan, required_suites: ["mcp_reliability"] },
    suiteResults: [{ ...passed, suite: "mcp_reliability" }],
  });
  assert.equal(reliability.reliability_required, true);
  const certification = manifest({
    plan: { ...plan, required_suites: ["all"] },
    suiteResults: [{ ...passed, suite: "all" }],
  });
  assert.equal(certification.certification_required, true);
  assert.throws(() => manifest({
    candidate: { ...candidate, integration_commit: "main" },
  }), /Invalid exact commit/u);
});
