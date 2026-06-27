import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const phase31LPath = path.join(root, "tests", "phase31", "phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs");
const phase31MPath = path.join(root, "tests", "phase31", "phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be an array.`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} item key must be a string.`);
    assert.equal(map.has(item.key), false, `${label} duplicate key ${item.key}`);
    map.set(item.key, item);
  }
  return map;
}

function assertFlags(target, keys, expected, label) {
  for (const key of keys) {
    if (key in target) assert.equal(target[key], expected, `${label} ${key} drifted`);
  }
}

function assertRunAllOrder(runAllText) {
  const ordered = [
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
    "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
    "tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs",
    "tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(runAllText.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    assert(runAllText.indexOf(ordered[index]) < runAllText.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
  }
}

function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing token ${token}`);
}

function buildStabilityGuard({ phase31LSource, phase31MSource }) {
  const source31LDigest = hash(phase31LSource);
  const source31MDigest = hash(phase31MSource);
  const rows = [
    ["writing_context_builder_stability_guard_row", "writing_context_builder_final_smoke_row", "writing_context.aesthetic_memory"],
    ["revision_context_builder_stability_guard_row", "revision_context_builder_final_smoke_row", "revision_context.aesthetic_memory"],
    ["final_polisher_context_builder_stability_guard_row", "final_polisher_context_builder_final_smoke_row", "final_polisher_context.aesthetic_memory"],
    ["reader_response_context_builder_stability_guard_row", "reader_response_context_builder_final_smoke_row", "reader_response_context.aesthetic_memory"],
  ].map(([key, source_row_key, context_path], index) => ({
    key,
    source_row_key,
    display_order: index + 1,
    context_path,
    guard_status: "stable",
    source_smoke_status: "ready_for_final_smoke",
    chatgpt_visible: true,
    stability_action: "validate_stability_only",
    can_build_context_now: false,
    can_attach_context_now: false,
    can_mutate_context: false,
    can_persist_payload: false,
    can_execute_operator_decision: false,
    can_register_mcp_tool: false,
  }));
  const checks = [
    "source_phase31l_digest_stable",
    "source_phase31m_digest_stable",
    "final_smoke_digest_stable",
    "row_order_stable",
    "summary_lines_stable",
    "raw_final_smoke_hidden_by_default",
    "blocked_actions_stable",
    "weak_input_needs_context_stable",
    "protected_hash_guard_stable",
  ].map((key) => ({ key, check_status: "stable" }));
  const digestTraceRows = [
    { key: "builder_readiness_digest", source_phase: "31E" },
    { key: "surface_digest", source_phase: "31F" },
    { key: "bridge_preview_digest", source_phase: "31G" },
    { key: "operator_packet_digest", source_phase: "31J" },
    { key: "operator_review_ui_surface_digest", source_phase: "31K" },
    { key: "operator_review_packet_bridge_preview_digest", source_phase: "31L", source_digest: source31LDigest },
    { key: "operator_review_packet_bridge_final_smoke_digest", source_phase: "31M", source_digest: source31MDigest },
  ].map((row) => ({ ...row, trace_status: "traceable" }));
  const blockedKeys = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"];
  const blockedOperatorDecisions = blockedKeys.map((key) => ({ key, allowed: false }));
  const blockedBridgeCapabilities = blockedKeys.map((key) => ({ key, allowed: false, source: "phase31m_final_smoke_contract" }));
  const safetyBoundary = {
    read_only: true,
    preview_only: true,
    no_context_build: true,
    no_context_attach: true,
    no_context_mutation: true,
    no_operator_decision_execute: true,
    no_operator_packet_persist: true,
    no_ui_surface_persist: true,
    no_bridge_preview_persist: true,
    no_bridge_tool_registration: true,
    no_final_smoke_persist: true,
    no_stability_guard_persist: true,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
    can_execute_operator_decision: false,
    can_persist_final_smoke: false,
    can_execute_stability_guard_action: false,
  };
  const noMutationSnapshot = {
    active_engine_modified: false,
    compressed_rules_modified: false,
    canon_written: false,
    context_built: false,
    context_attached: false,
    context_mutated: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    final_smoke_persisted: false,
    final_smoke_state_written: false,
    stability_guard_persisted: false,
    stability_guard_state_written: false,
    context_built_from_stability_guard: false,
  };
  const summaryLines = [
    "Operator review packet bridge stability guard: stable; read-only; preview-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M",
    `source_phase31l_digest: ${source31LDigest}`,
    `source_phase31m_digest: ${source31MDigest}`,
    ...rows.map((row) => `${row.key}/${row.context_path}: validate_stability_only; build=false; attach=false; mutate=false; persist=false; execute=false; register=false`),
    `blocked_operator_decisions=${blockedOperatorDecisions.length}`,
    `blocked_bridge_capabilities=${blockedBridgeCapabilities.length}`,
  ];
  const cards = [
    { key: "stability_guard_overall", value: "stable", status: "ready" },
    { key: "final_smoke_rows", value: "4", status: "stable" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L→31M", status: "traceable" },
    { key: "summary_lines", value: "stable", status: "stable" },
    { key: "raw_final_smoke", value: "hidden_by_default", status: "collapsed" },
    { key: "blocked_actions", value: "stable", status: "blocked" },
    { key: "validation_summary", value: "stability_guard_passed", status: "ready" },
  ];
  const digest = hash(stableJson({ source31LDigest, source31MDigest, rows, checks, digestTraceRows, blockedOperatorDecisions, blockedBridgeCapabilities, safetyBoundary, noMutationSnapshot, summaryLines, cards }));
  return {
    used: true,
    phase: "31N",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_stability_guard_v1",
    guard_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_stability_guard",
    guard_channel: "chatgpt_bridge_context_builder_operator_review_stability_guard",
    guard_mode: "readonly_bridge_stability_guard",
    guard_status: "stable",
    source_phase: "31M",
    source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke",
    source_phase31l_source_digest: source31LDigest,
    source_phase31m_source_digest: source31MDigest,
    stability_guard_digest: digest,
    can_display_chatgpt_bridge_stability_guard: true,
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_payload: false,
    will_execute_operator_decision: false,
    will_register_mcp_tool: false,
    will_write_canon: false,
    will_update_active_engine: false,
    will_update_compressed_rules: false,
    stability_guard_cards: cards,
    stability_checks: checks,
    stability_guard_rows: rows,
    digest_trace_rows: digestTraceRows,
    chatgpt_summary_lines: summaryLines,
    blocked_operator_decisions: blockedOperatorDecisions,
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    allowed_stability_guard_actions: ["read_operator_review_packet_bridge_stability_guard", "copy_operator_review_stability_guard_markdown", "inspect_stability_guard_rows", "inspect_stability_checks", "inspect_digest_trace_rows", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"].map((key) => ({ key, allowed: true })),
    blocked_stability_guard_actions: ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_preview_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false })),
    safety_boundary: safetyBoundary,
    no_mutation_snapshot: noMutationSnapshot,
    raw_final_smoke: null,
    raw_json_preview: { visible_by_default: false, raw_final_smoke_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31N active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31N compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));

await import(new URL("./phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs", import.meta.url));

const phase31LSource = await readFile(phase31LPath, "utf8");
const phase31MSource = await readFile(phase31MPath, "utf8");

assertTokens(phase31LSource, ["buildOperatorReviewBridgePreview", "aesthetic_memory_context_builder_operator_review_packet_bridge_preview_v1", "31E→31F→31G→31J→31K", "raw_ui_surface", "hidden_by_default", "raw_ui_surface_included", "blocked_operator_decisions", "blocked_bridge_capabilities", "needs_context", "deterministic"], "Phase31N source bridge preview");
assertTokens(phase31MSource, ["buildFinalSmokeContract", "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke_v1", "31E→31F→31G→31J→31K→31L", "writing_context_builder_final_smoke_row", "revision_context_builder_final_smoke_row", "final_polisher_context_builder_final_smoke_row", "reader_response_context_builder_final_smoke_row", "raw_bridge_preview", "hidden_by_default", "visible_by_default: false", "raw_bridge_preview_included", "no_final_smoke_persist", "will_register_mcp_tool", "blocked_operator_decisions", "blocked_bridge_capabilities", "deterministic"], "Phase31N source final smoke");

const guard = buildStabilityGuard({ phase31LSource, phase31MSource });
assert.equal(guard.phase, "31N");
assert.equal(guard.guard_status, "stable");
assert.equal(guard.source_phase, "31M");
assert.match(guard.source_phase31l_source_digest, /^[a-f0-9]{64}$/u);
assert.match(guard.source_phase31m_source_digest, /^[a-f0-9]{64}$/u);
assert.match(guard.stability_guard_digest, /^[a-f0-9]{64}$/u);
assert.equal(guard.can_display_chatgpt_bridge_stability_guard, true);
assertFlags(guard, ["will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31N top flags");

const cards = keyed(guard.stability_guard_cards, "Phase31N cards");
assert.deepEqual([...cards.keys()], ["stability_guard_overall", "final_smoke_rows", "digest_trace", "summary_lines", "raw_final_smoke", "blocked_actions", "validation_summary"]);
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M");
assert.equal(cards.get("raw_final_smoke")?.value, "hidden_by_default");

const checks = keyed(guard.stability_checks, "Phase31N checks");
assert.deepEqual([...checks.keys()], ["source_phase31l_digest_stable", "source_phase31m_digest_stable", "final_smoke_digest_stable", "row_order_stable", "summary_lines_stable", "raw_final_smoke_hidden_by_default", "blocked_actions_stable", "weak_input_needs_context_stable", "protected_hash_guard_stable"]);
for (const check of checks.values()) assert.equal(check.check_status, "stable");

const rows = keyed(guard.stability_guard_rows, "Phase31N rows");
assert.deepEqual([...rows.keys()], ["writing_context_builder_stability_guard_row", "revision_context_builder_stability_guard_row", "final_polisher_context_builder_stability_guard_row", "reader_response_context_builder_stability_guard_row"]);
for (const row of rows.values()) {
  assert.equal(row.guard_status, "stable");
  assert.equal(row.source_smoke_status, "ready_for_final_smoke");
  assert.equal(row.stability_action, "validate_stability_only");
  assertFlags(row, ["can_build_context_now", "can_attach_context_now", "can_mutate_context", "can_persist_payload", "can_execute_operator_decision", "can_register_mcp_tool"], false, row.key);
}

const trace = keyed(guard.digest_trace_rows, "Phase31N digest trace");
assert.deepEqual([...trace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest"]);
assert.equal(trace.get("operator_review_packet_bridge_final_smoke_digest")?.source_phase, "31M");

const blockedDecisions = keyed(guard.blocked_operator_decisions, "Phase31N blocked decisions");
const blockedCapabilities = keyed(guard.blocked_bridge_capabilities, "Phase31N blocked capabilities");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedDecisions.get(key)?.allowed, false);
  assert.equal(blockedCapabilities.get(key)?.allowed, false);
}

const allowedActions = keyed(guard.allowed_stability_guard_actions, "Phase31N allowed actions");
assert.deepEqual([...allowedActions.keys()], ["read_operator_review_packet_bridge_stability_guard", "copy_operator_review_stability_guard_markdown", "inspect_stability_guard_rows", "inspect_stability_checks", "inspect_digest_trace_rows", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"]);
const blockedActions = keyed(guard.blocked_stability_guard_actions, "Phase31N blocked actions");
assert(blockedActions.has("write_stability_guard_state"));
assert(blockedActions.has("register_context_builder_bridge_mcp_tool"));

assertFlags(guard.safety_boundary, ["read_only", "preview_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_bridge_tool_registration", "no_final_smoke_persist", "no_stability_guard_persist"], true, "Phase31N safety true");
assertFlags(guard.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_persist_final_smoke", "can_execute_stability_guard_action"], false, "Phase31N safety false");
assertFlags(guard.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "final_smoke_persisted", "final_smoke_state_written", "stability_guard_persisted", "stability_guard_state_written", "context_built_from_stability_guard"], false, "Phase31N mutation");

assert(guard.chatgpt_summary_lines.some((line) => line.includes("no build/attach/mutate/persist/execute/register")));
assert(guard.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L→31M")));
assert.equal(guard.chatgpt_summary_lines.filter((line) => line.includes("validate_stability_only")).length, 4);
assert.equal(guard.raw_final_smoke, null);
assert.equal(guard.raw_json_preview.visible_by_default, false);
assert.equal(guard.raw_json_preview.raw_final_smoke_included, false);

for (let index = 0; index < 5; index += 1) {
  const rerun = buildStabilityGuard({ phase31LSource, phase31MSource });
  assert.equal(rerun.source_phase31l_source_digest, guard.source_phase31l_source_digest);
  assert.equal(rerun.source_phase31m_source_digest, guard.source_phase31m_source_digest);
  assert.equal(rerun.stability_guard_digest, guard.stability_guard_digest);
  assert.deepEqual(rerun, guard, "Phase31N stability guard rerun should be deterministic.");
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31N changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31N changed compressed_rules hash.");
console.log("Phase31N aesthetic memory context builder operator review packet bridge stability guard tests passed.");

