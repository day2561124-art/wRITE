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
const phase31NPath = path.join(root, "tests", "phase31", "phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs");
const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be array`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} key must be string`);
    assert.equal(map.has(item.key), false, `${label} duplicate ${item.key}`);
    map.set(item.key, item);
  }
  return map;
}
function assertRunAllOrder(text) {
  const ordered = [
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
    "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
    "tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs",
    "tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs",
    "tests/phase31/phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(text.includes(token), `run-all missing ${token}`);
  for (let i = 0; i < ordered.length - 1; i += 1) assert(text.indexOf(ordered[i]) < text.indexOf(ordered[i + 1]), `run-all order drifted: ${ordered[i]}`);
}
function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing ${token}`);
}
function assertFlags(target, keys, expected, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], expected, `${label} ${key} drifted`);
}

function buildRecoveryGuide({ phase31LSource, phase31MSource, phase31NSource }) {
  const source31LDigest = hash(phase31LSource);
  const source31MDigest = hash(phase31MSource);
  const source31NDigest = hash(phase31NSource);
  const rows = [
    ["digest_drift_recovery", "final_smoke_digest_stable", "stability_guard_digest or final_smoke_digest changed", "inspect_source_diff_then_rerun_phase31n", "node tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs", "high"],
    ["row_order_drift_recovery", "row_order_stable", "row order differs from writing/revision/final_polisher/reader_response", "restore_expected_row_order_before_commit", "node tests/phase31/phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs", "high"],
    ["summary_line_drift_recovery", "summary_lines_stable", "summary lines lose no build/attach/mutate/persist/execute/register wording", "restore_summary_contract_and_rerun_focused_tests", "node tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs", "medium"],
    ["raw_exposure_recovery", "raw_final_smoke_hidden_by_default", "raw_final_smoke becomes visible by default", "restore_raw_hidden_default_and_confirm_include_raw_gate", "npm test", "critical"],
    ["blocked_action_regression_recovery", "blocked_actions_stable", "approve/build/attach/mutate/persist/write/register action becomes allowed", "restore_blocked_action_false_flags_before_any_push", "npm run test:mcp", "critical"],
    ["weak_input_regression_recovery", "weak_input_needs_context_stable", "weak input no longer remains needs_context", "restore_needs_context_contract_and_rerun_31l_to_31o", "node tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs", "high"],
    ["protected_hash_drift_recovery", "protected_hash_guard_stable", "active_engine or compressed_rules hash differs from baseline", "stop_restore_protected_files_then_rerun_full_validation", "git diff -- data/canon_db/active_engine.md data/error_report_db/compressed_rules.md", "critical"],
    ["entity_registry_side_effect_recovery", "non_owned_runtime_side_effects", "data/entity_registry files modified by unrelated validation side effects", "git_restore_data_entity_registry_before_commit", "git status --short", "medium"],
  ].map(([key, source_check_key, failure_signal, operator_action, verification_command, severity], index) => ({
    key,
    source_check_key,
    failure_signal,
    operator_action,
    verification_command,
    severity,
    display_order: index + 1,
    recovery_mode: "operator_manual_recovery_guide",
    can_execute_recovery: false,
    can_mutate_context: false,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
  }));
  const cards = [
    { key: "recovery_guide_overall", value: "ready", status: "ready" },
    { key: "recovery_scenarios", value: String(rows.length), status: "ready" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L→31M→31N", status: "traceable" },
    { key: "raw_recovery_payload", value: "hidden_by_default", status: "collapsed" },
    { key: "execution_policy", value: "manual_guide_only", status: "blocked_execution" },
    { key: "validation_summary", value: "recovery_guide_ready", status: "ready" },
  ];
  const digestTraceRows = [
    { key: "builder_readiness_digest", source_phase: "31E" },
    { key: "surface_digest", source_phase: "31F" },
    { key: "bridge_preview_digest", source_phase: "31G" },
    { key: "operator_packet_digest", source_phase: "31J" },
    { key: "operator_review_ui_surface_digest", source_phase: "31K" },
    { key: "operator_review_packet_bridge_preview_digest", source_phase: "31L", source_digest: source31LDigest },
    { key: "operator_review_packet_bridge_final_smoke_digest", source_phase: "31M", source_digest: source31MDigest },
    { key: "operator_review_packet_bridge_stability_guard_digest", source_phase: "31N", source_digest: source31NDigest },
  ].map((row) => ({ ...row, trace_status: "traceable" }));
  const warnings = [
    { key: "manual_recovery_only", severity: "info", message: "Recovery guide is manual guidance only; it does not execute recovery." },
    { key: "no_context_or_canon_write", severity: "info", message: "Recovery guide will not build context, write Canon, update active_engine, or update compressed_rules." },
    { key: "no_mcp_tool_registration", severity: "info", message: "Recovery guide does not register MCP tools or write bridge state." },
  ];
  const blocked = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false }));
  const allowed = ["read_operator_review_packet_bridge_recovery_guide", "copy_operator_review_recovery_markdown", "inspect_recovery_rows", "inspect_recovery_warning_banners", "inspect_digest_trace_rows", "inspect_blocked_recovery_actions"].map((key) => ({ key, allowed: true }));
  const safety = {
    read_only: true,
    preview_only: true,
    manual_recovery_guide_only: true,
    no_context_build: true,
    no_context_attach: true,
    no_context_mutation: true,
    no_operator_decision_execute: true,
    no_recovery_execution: true,
    no_recovery_guide_persist: true,
    no_stability_guard_persist: true,
    no_final_smoke_persist: true,
    no_bridge_preview_persist: true,
    no_bridge_tool_registration: true,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
    can_execute_operator_decision: false,
    can_execute_recovery_action: false,
    can_persist_recovery_guide: false,
    can_persist_stability_guard: false,
  };
  const mutation = {
    active_engine_modified: false,
    compressed_rules_modified: false,
    canon_written: false,
    context_built: false,
    context_attached: false,
    context_mutated: false,
    operator_decision_executed: false,
    recovery_action_executed: false,
    recovery_guide_persisted: false,
    recovery_state_written: false,
    stability_guard_persisted: false,
    final_smoke_persisted: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    context_built_from_recovery_guide: false,
  };
  const summary = [
    "Operator review packet bridge recovery guide: ready; manual guide only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N",
    `source_phase31l_digest: ${source31LDigest}`,
    `source_phase31m_digest: ${source31MDigest}`,
    `source_phase31n_digest: ${source31NDigest}`,
    ...rows.map((row) => `${row.key}: ${row.operator_action}; execute=false; mutate=false; write=false; register=false`),
    `blocked_recovery_actions=${blocked.length}`,
  ];
  const markdown = [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Recovery Guide",
    "",
    "guide_status: ready",
    "guide_mode: manual_recovery_guide_only",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N",
    "will_execute_recovery_action: false",
    "will_build_context_now: false",
    "will_write_canon: false",
    "will_update_active_engine: false",
    "will_update_compressed_rules: false",
    "will_register_mcp_tool: false",
  ].join("\n");
  const guideDigest = hash(stableJson({ source31LDigest, source31MDigest, source31NDigest, rows, cards, digestTraceRows, warnings, blocked, allowed, safety, mutation, summary, markdown }));
  return {
    used: true,
    phase: "31O",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide_v1",
    guide_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide",
    guide_channel: "chatgpt_bridge_context_builder_operator_review_recovery_guide",
    guide_mode: "readonly_manual_recovery_guide",
    guide_status: "ready",
    source_phase: "31N",
    source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_stability_guard",
    source_phase31l_source_digest: source31LDigest,
    source_phase31m_source_digest: source31MDigest,
    source_phase31n_source_digest: source31NDigest,
    recovery_guide_digest: guideDigest,
    can_display_recovery_guide: true,
    will_execute_recovery_action: false,
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_payload: false,
    will_execute_operator_decision: false,
    will_register_mcp_tool: false,
    will_write_canon: false,
    will_update_active_engine: false,
    will_update_compressed_rules: false,
    recovery_guide_cards: cards,
    recovery_rows: rows,
    digest_trace_rows: digestTraceRows,
    warning_banners: warnings,
    chatgpt_summary_lines: summary,
    recovery_guide_markdown: markdown,
    allowed_recovery_actions: allowed,
    blocked_recovery_actions: blocked,
    safety_boundary: safety,
    no_mutation_snapshot: mutation,
    raw_stability_guard: null,
    raw_json_preview: { visible_by_default: false, raw_stability_guard_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31O active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31O compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));
await import(new URL("./phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs", import.meta.url));

const phase31LSource = await readFile(phase31LPath, "utf8");
const phase31MSource = await readFile(phase31MPath, "utf8");
const phase31NSource = await readFile(phase31NPath, "utf8");

assertTokens(phase31NSource, ["buildStabilityGuard", "aesthetic_memory_context_builder_operator_review_packet_bridge_stability_guard_v1", "31E→31F→31G→31J→31K→31L→31M", "source_phase31l_digest_stable", "source_phase31m_digest_stable", "final_smoke_digest_stable", "row_order_stable", "summary_lines_stable", "raw_final_smoke_hidden_by_default", "blocked_actions_stable", "weak_input_needs_context_stable", "protected_hash_guard_stable", "raw_final_smoke", "hidden_by_default", "no_stability_guard_persist", "blocked_stability_guard_actions", "deterministic"], "Phase31O source stability guard");

const guide = buildRecoveryGuide({ phase31LSource, phase31MSource, phase31NSource });
assert.equal(guide.used, true);
assert.equal(guide.phase, "31O");
assert.equal(guide.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide_v1");
assert.equal(guide.guide_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide");
assert.equal(guide.guide_channel, "chatgpt_bridge_context_builder_operator_review_recovery_guide");
assert.equal(guide.guide_mode, "readonly_manual_recovery_guide");
assert.equal(guide.guide_status, "ready");
assert.equal(guide.source_phase, "31N");
assert.match(guide.source_phase31l_source_digest, /^[a-f0-9]{64}$/u);
assert.match(guide.source_phase31m_source_digest, /^[a-f0-9]{64}$/u);
assert.match(guide.source_phase31n_source_digest, /^[a-f0-9]{64}$/u);
assert.match(guide.recovery_guide_digest, /^[a-f0-9]{64}$/u);
assert.equal(guide.can_display_recovery_guide, true);
assertFlags(guide, ["will_execute_recovery_action", "will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31O top flags");

const cards = keyed(guide.recovery_guide_cards, "Phase31O cards");
assert.deepEqual([...cards.keys()], ["recovery_guide_overall", "recovery_scenarios", "digest_trace", "raw_recovery_payload", "execution_policy", "validation_summary"]);
assert.equal(cards.get("recovery_scenarios")?.value, "8");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M→31N");
assert.equal(cards.get("raw_recovery_payload")?.value, "hidden_by_default");
assert.equal(cards.get("execution_policy")?.value, "manual_guide_only");

const rows = keyed(guide.recovery_rows, "Phase31O recovery rows");
assert.deepEqual([...rows.keys()], ["digest_drift_recovery", "row_order_drift_recovery", "summary_line_drift_recovery", "raw_exposure_recovery", "blocked_action_regression_recovery", "weak_input_regression_recovery", "protected_hash_drift_recovery", "entity_registry_side_effect_recovery"]);
for (const row of rows.values()) {
  assert.equal(row.recovery_mode, "operator_manual_recovery_guide");
  assert.equal(row.can_execute_recovery, false);
  assert.equal(row.can_mutate_context, false);
  assert.equal(row.can_write_canon, false);
  assert.equal(row.can_update_active_engine, false);
  assert.equal(row.can_update_compressed_rules, false);
  assert.equal(row.can_register_mcp_tool, false);
}
assert.equal(rows.get("protected_hash_drift_recovery")?.severity, "critical");
assert.equal(rows.get("raw_exposure_recovery")?.severity, "critical");
assert.equal(rows.get("blocked_action_regression_recovery")?.severity, "critical");
assert.equal(rows.get("entity_registry_side_effect_recovery")?.operator_action, "git_restore_data_entity_registry_before_commit");

const digestTrace = keyed(guide.digest_trace_rows, "Phase31O digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest", "operator_review_packet_bridge_stability_guard_digest"]);
assert.equal(digestTrace.get("operator_review_packet_bridge_stability_guard_digest")?.source_phase, "31N");

const warnings = keyed(guide.warning_banners, "Phase31O warning banners");
assert.deepEqual([...warnings.keys()], ["manual_recovery_only", "no_context_or_canon_write", "no_mcp_tool_registration"]);
const allowed = keyed(guide.allowed_recovery_actions, "Phase31O allowed recovery actions");
assert.deepEqual([...allowed.keys()], ["read_operator_review_packet_bridge_recovery_guide", "copy_operator_review_recovery_markdown", "inspect_recovery_rows", "inspect_recovery_warning_banners", "inspect_digest_trace_rows", "inspect_blocked_recovery_actions"]);
for (const action of allowed.values()) assert.equal(action.allowed, true);
const blocked = keyed(guide.blocked_recovery_actions, "Phase31O blocked recovery actions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked.`);

assertFlags(guide.safety_boundary, ["read_only", "preview_only", "manual_recovery_guide_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_recovery_execution", "no_recovery_guide_persist", "no_stability_guard_persist", "no_final_smoke_persist", "no_bridge_preview_persist", "no_bridge_tool_registration"], true, "Phase31O safety true");
assertFlags(guide.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_execute_recovery_action", "can_persist_recovery_guide", "can_persist_stability_guard"], false, "Phase31O safety false");
assertFlags(guide.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_decision_executed", "recovery_action_executed", "recovery_guide_persisted", "recovery_state_written", "stability_guard_persisted", "final_smoke_persisted", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_recovery_guide"], false, "Phase31O mutation");

assert(guide.recovery_guide_markdown.includes("Aesthetic Memory Context Builder Operator Review Packet Bridge Recovery Guide"));
assert(guide.recovery_guide_markdown.includes("manual_recovery_guide_only"));
assert(guide.recovery_guide_markdown.includes("will_execute_recovery_action: false"));
assert(guide.chatgpt_summary_lines.some((line) => line.includes("manual guide only")));
assert(guide.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L→31M→31N")));
assert.equal(guide.chatgpt_summary_lines.filter((line) => line.includes("execute=false")).length, 8);
assert.equal(guide.raw_stability_guard, null);
assert.equal(guide.raw_json_preview.visible_by_default, false);
assert.equal(guide.raw_json_preview.raw_stability_guard_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildRecoveryGuide({ phase31LSource, phase31MSource, phase31NSource });
  assert.equal(rerun.recovery_guide_digest, guide.recovery_guide_digest);
  assert.deepEqual(rerun, guide, "Phase31O recovery guide rerun should be deterministic.");
}
assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31O changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31O changed compressed_rules hash.");
console.log("Phase31O aesthetic memory context builder operator review packet bridge recovery guide tests passed.");
