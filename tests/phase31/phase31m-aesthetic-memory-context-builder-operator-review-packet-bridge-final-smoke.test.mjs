import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const phase31LPath = path.join(root, "tests", "phase31", "phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs");

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
    assert.equal(map.has(item.key), false, `${label} has duplicate key ${item.key}.`);
    map.set(item.key, item);
  }
  return map;
}

function assertRunAllOrder(runAllText) {
  const ordered = [
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
    "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
    "tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(runAllText.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    assert(runAllText.indexOf(ordered[index]) < runAllText.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
  }
}

function assertFalseFlags(target, keys, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], false, `${label} ${key} must stay false.`);
}

function assertTrueFlags(target, keys, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], true, `${label} ${key} must stay true.`);
}

function assertSourceTokens(source, tokens, label) {
  for (const token of tokens) {
    assert(source.includes(token), `${label} missing token: ${token}`);
  }
}

function buildFinalSmokeContract({ phase31LSource }) {
  const sourceDigest = hash(phase31LSource);
  const bridgeRows = [
    ["writing_context_builder_final_smoke_row", "writing_context_builder_bridge_preview_row", "writing_context.aesthetic_memory"],
    ["revision_context_builder_final_smoke_row", "revision_context_builder_bridge_preview_row", "revision_context.aesthetic_memory"],
    ["final_polisher_context_builder_final_smoke_row", "final_polisher_context_builder_bridge_preview_row", "final_polisher_context.aesthetic_memory"],
    ["reader_response_context_builder_final_smoke_row", "reader_response_context_builder_bridge_preview_row", "reader_response_context.aesthetic_memory"],
  ].map(([key, source_row_key, context_path], index) => ({
    key,
    source_row_key,
    display_order: index + 1,
    context_path,
    smoke_status: "ready_for_final_smoke",
    source_bridge_status: "ready_for_bridge_preview",
    chatgpt_visible: true,
    final_smoke_action: "validate_only",
    can_build_context_now: false,
    can_attach_context_now: false,
    can_mutate_context: false,
    can_persist_payload: false,
    can_execute_operator_decision: false,
    can_register_mcp_tool: false,
  }));
  const digestTraceRows = [
    { key: "builder_readiness_digest", source_phase: "31E", trace_status: "traceable" },
    { key: "surface_digest", source_phase: "31F", trace_status: "traceable" },
    { key: "bridge_preview_digest", source_phase: "31G", trace_status: "traceable" },
    { key: "operator_packet_digest", source_phase: "31J", trace_status: "traceable" },
    { key: "operator_review_ui_surface_digest", source_phase: "31K", trace_status: "traceable" },
    { key: "operator_review_packet_bridge_preview_digest", source_phase: "31L", trace_status: "traceable", source_digest: sourceDigest },
  ];
  const blockedOperatorDecisions = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false }));
  const blockedBridgeCapabilities = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false, source: "phase31l_bridge_preview_contract" }));
  const cards = [
    { key: "final_smoke_overall", value: "4/4 ready", status: "ready" },
    { key: "bridge_preview_rows", value: "4", status: "ready" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L", status: "traceable" },
    { key: "chatgpt_summary", value: "ready", status: "ready" },
    { key: "safety_boundary", value: "read_only_preview_only_validate_only", status: "blocked_execution" },
    { key: "raw_bridge_preview", value: "hidden_by_default", status: "collapsed" },
    { key: "validation_summary", value: "final_smoke_passed", status: "ready" },
  ];
  const summaryLines = [
    "Operator review packet bridge final smoke: ready; read-only; preview-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L",
    `source_phase31l_source_digest: ${sourceDigest}`,
    ...bridgeRows.map((row) => `${row.key}/${row.context_path}: validate_only; build=false; attach=false; mutate=false; persist=false; execute=false; register=false`),
    `blocked_operator_decisions=${blockedOperatorDecisions.length}`,
    `blocked_bridge_capabilities=${blockedBridgeCapabilities.length}`,
  ];
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
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
    can_execute_operator_decision: false,
    can_persist_operator_packet: false,
    can_persist_ui_surface: false,
    can_persist_bridge_preview: false,
    can_execute_bridge_action: false,
    can_register_context_builder_bridge_mcp_tool: false,
    can_persist_final_smoke: false,
    can_execute_final_smoke_action: false,
  };
  const noMutationSnapshot = {
    active_engine_modified: false,
    compressed_rules_modified: false,
    canon_written: false,
    context_built: false,
    context_attached: false,
    context_mutated: false,
    operator_packet_persisted: false,
    operator_decision_executed: false,
    ui_surface_persisted: false,
    ui_state_written: false,
    context_built_from_ui_surface: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    context_built_from_bridge_preview: false,
    final_smoke_persisted: false,
    final_smoke_state_written: false,
    context_built_from_final_smoke: false,
  };
  const payloadForDigest = { sourceDigest, bridgeRows, digestTraceRows, blockedOperatorDecisions, blockedBridgeCapabilities, cards, summaryLines, safetyBoundary, noMutationSnapshot };
  const finalSmokeDigest = hash(stableJson(payloadForDigest));
  return {
    used: true,
    phase: "31M",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke_v1",
    smoke_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke",
    smoke_channel: "chatgpt_bridge_context_builder_operator_review_final_smoke",
    smoke_mode: "readonly_bridge_final_smoke",
    smoke_status: "ready",
    source_phase: "31L",
    source_preview_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_preview",
    source_phase31l_source_digest: sourceDigest,
    final_smoke_digest: finalSmokeDigest,
    can_display_chatgpt_bridge_final_smoke: true,
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_payload: false,
    will_execute_operator_decision: false,
    will_register_mcp_tool: false,
    will_write_canon: false,
    will_update_active_engine: false,
    will_update_compressed_rules: false,
    final_smoke_cards: cards,
    final_smoke_rows: bridgeRows,
    digest_trace_rows: digestTraceRows,
    chatgpt_summary_lines: summaryLines,
    blocked_operator_decisions: blockedOperatorDecisions,
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    allowed_final_smoke_actions: ["read_operator_review_packet_bridge_final_smoke", "copy_operator_review_final_smoke_markdown", "inspect_final_smoke_rows", "inspect_digest_trace_rows", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"].map((key) => ({ key, allowed: true })),
    blocked_final_smoke_actions: ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_final_smoke_state", "write_bridge_preview_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false })),
    safety_boundary: safetyBoundary,
    no_mutation_snapshot: noMutationSnapshot,
    raw_bridge_preview: null,
    raw_json_preview: { visible_by_default: false, raw_bridge_preview_included: false },
  };
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31M active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31M compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));

await import(new URL("./phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs", import.meta.url));

const phase31LSource = await readFile(phase31LPath, "utf8");
assertSourceTokens(phase31LSource, [
  "buildOperatorReviewBridgePreview",
  "aesthetic_memory_context_builder_operator_review_packet_bridge_preview_v1",
  "chatgpt_bridge_context_builder_operator_review",
  "31E→31F→31G→31J→31K",
  "writing_context_builder_bridge_preview_row",
  "revision_context_builder_bridge_preview_row",
  "final_polisher_context_builder_bridge_preview_row",
  "reader_response_context_builder_bridge_preview_row",
  "raw_ui_surface",
  "hidden_by_default",
  "visible_by_default: false",
  "raw_ui_surface_included",
  "no_context_build",
  "no_operator_decision_execute",
  "no_canon_engine_or_mcp_write",
  "will_register_mcp_tool: false",
  "can_register_context_builder_bridge_mcp_tool",
  "bridge_preview_digest",
  "blocked_operator_decisions",
  "blocked_bridge_capabilities",
  "needs_context",
  "deterministic",
], "Phase31M source smoke");

const finalSmoke = buildFinalSmokeContract({ phase31LSource });
assert.equal(finalSmoke.used, true);
assert.equal(finalSmoke.phase, "31M");
assert.equal(finalSmoke.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke_v1");
assert.equal(finalSmoke.smoke_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_final_smoke");
assert.equal(finalSmoke.smoke_channel, "chatgpt_bridge_context_builder_operator_review_final_smoke");
assert.equal(finalSmoke.smoke_mode, "readonly_bridge_final_smoke");
assert.equal(finalSmoke.smoke_status, "ready");
assert.equal(finalSmoke.source_phase, "31L");
assert.equal(finalSmoke.source_preview_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_preview");
assert.match(finalSmoke.source_phase31l_source_digest, /^[a-f0-9]{64}$/u);
assert.match(finalSmoke.final_smoke_digest, /^[a-f0-9]{64}$/u);
assert.equal(finalSmoke.can_display_chatgpt_bridge_final_smoke, true);
assertFalseFlags(finalSmoke, ["will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], "Phase31M final smoke");

const cards = keyed(finalSmoke.final_smoke_cards, "Phase31M final smoke cards");
assert.deepEqual([...cards.keys()], ["final_smoke_overall", "bridge_preview_rows", "digest_trace", "chatgpt_summary", "safety_boundary", "raw_bridge_preview", "validation_summary"]);
assert.equal(cards.get("final_smoke_overall")?.value, "4/4 ready");
assert.equal(cards.get("bridge_preview_rows")?.value, "4");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L");
assert.equal(cards.get("raw_bridge_preview")?.value, "hidden_by_default");
assert.equal(cards.get("validation_summary")?.value, "final_smoke_passed");

const rows = keyed(finalSmoke.final_smoke_rows, "Phase31M final smoke rows");
assert.deepEqual([...rows.keys()], ["writing_context_builder_final_smoke_row", "revision_context_builder_final_smoke_row", "final_polisher_context_builder_final_smoke_row", "reader_response_context_builder_final_smoke_row"]);
for (const row of rows.values()) {
  assert.equal(row.smoke_status, "ready_for_final_smoke");
  assert.equal(row.source_bridge_status, "ready_for_bridge_preview");
  assert.equal(row.chatgpt_visible, true);
  assert.equal(row.final_smoke_action, "validate_only");
  assertFalseFlags(row, ["can_build_context_now", "can_attach_context_now", "can_mutate_context", "can_persist_payload", "can_execute_operator_decision", "can_register_mcp_tool"], row.key);
}

const digestTrace = keyed(finalSmoke.digest_trace_rows, "Phase31M digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest"]);
assert.equal(digestTrace.get("builder_readiness_digest")?.source_phase, "31E");
assert.equal(digestTrace.get("surface_digest")?.source_phase, "31F");
assert.equal(digestTrace.get("bridge_preview_digest")?.source_phase, "31G");
assert.equal(digestTrace.get("operator_packet_digest")?.source_phase, "31J");
assert.equal(digestTrace.get("operator_review_ui_surface_digest")?.source_phase, "31K");
assert.equal(digestTrace.get("operator_review_packet_bridge_preview_digest")?.source_phase, "31L");

const blockedOperatorDecisions = keyed(finalSmoke.blocked_operator_decisions, "Phase31M blocked operator decisions");
const blockedCapabilities = keyed(finalSmoke.blocked_bridge_capabilities, "Phase31M blocked bridge capabilities");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedOperatorDecisions.get(key)?.allowed, false, `${key} decision must stay blocked.`);
  assert.equal(blockedCapabilities.get(key)?.allowed, false, `${key} capability must stay blocked.`);
}

const allowedActions = keyed(finalSmoke.allowed_final_smoke_actions, "Phase31M allowed final smoke actions");
assert.deepEqual([...allowedActions.keys()], ["read_operator_review_packet_bridge_final_smoke", "copy_operator_review_final_smoke_markdown", "inspect_final_smoke_rows", "inspect_digest_trace_rows", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"]);
for (const action of allowedActions.values()) assert.equal(action.allowed, true);

const blockedActions = keyed(finalSmoke.blocked_final_smoke_actions, "Phase31M blocked final smoke actions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_final_smoke_state", "write_bridge_preview_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedActions.get(key)?.allowed, false, `${key} action must stay blocked.`);
}

assertTrueFlags(finalSmoke.safety_boundary, ["read_only", "preview_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_operator_packet_persist", "no_ui_surface_persist", "no_bridge_preview_persist", "no_bridge_tool_registration", "no_final_smoke_persist"], "Phase31M safety");
assertFalseFlags(finalSmoke.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_persist_operator_packet", "can_persist_ui_surface", "can_persist_bridge_preview", "can_execute_bridge_action", "can_register_context_builder_bridge_mcp_tool", "can_persist_final_smoke", "can_execute_final_smoke_action"], "Phase31M safety");
assertFalseFlags(finalSmoke.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_packet_persisted", "operator_decision_executed", "ui_surface_persisted", "ui_state_written", "context_built_from_ui_surface", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_bridge_preview", "final_smoke_persisted", "final_smoke_state_written", "context_built_from_final_smoke"], "Phase31M mutation");
assert(finalSmoke.chatgpt_summary_lines.some((line) => line.includes("no build/attach/mutate/persist/execute/register")));
assert(finalSmoke.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L")));
assert.equal(finalSmoke.chatgpt_summary_lines.filter((line) => line.includes("validate_only")).length, 4);
assert.equal(finalSmoke.raw_bridge_preview, null);
assert.equal(finalSmoke.raw_json_preview.visible_by_default, false);
assert.equal(finalSmoke.raw_json_preview.raw_bridge_preview_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildFinalSmokeContract({ phase31LSource });
  assert.equal(rerun.source_phase31l_source_digest, finalSmoke.source_phase31l_source_digest);
  assert.equal(rerun.final_smoke_digest, finalSmoke.final_smoke_digest);
  assert.deepEqual(rerun, finalSmoke, "Phase31M final smoke contract rerun should be deterministic.");
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31M changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31M changed compressed_rules hash.");
console.log("Phase31M aesthetic memory context builder operator review packet bridge final smoke tests passed.");
