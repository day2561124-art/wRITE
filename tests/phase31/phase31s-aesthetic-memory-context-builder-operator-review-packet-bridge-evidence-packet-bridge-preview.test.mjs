import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const phase31RPath = path.join(root, "tests", "phase31", "phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs");
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
function flags(target, keys, expected, label) {
  for (const key of keys) assert.equal(target[key], expected, `${label} ${key} drifted`);
}
function assertRunAllOrder(text) {
  const ordered = [
    "tests/phase31/phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs",
    "tests/phase31/phase31s-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-bridge-preview.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(text.includes(token), `run-all missing ${token}`);
  for (let i = 0; i < ordered.length - 1; i += 1) assert(text.indexOf(ordered[i]) < text.indexOf(ordered[i + 1]), `run-all order drifted ${ordered[i]}`);
}
function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing ${token}`);
}

function buildEvidencePacketBridgePreview({ phase31RSource }) {
  const source31RDigest = hash(phase31RSource);
  const bridgeCards = [
    ["bridge_preview_overall", "ready", "ready"],
    ["live_surface_sections", "7", "bridge_visible"],
    ["source_artifact_live_cards", "6", "bridge_visible"],
    ["evidence_rows_live", "8", "bridge_visible"],
    ["recovery_scenarios_live", "8", "bridge_visible"],
    ["proof_panels_live", "4", "bridge_visible"],
    ["digest_trace", "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q→31R", "traceable"],
    ["raw_evidence_payload_bridge", "hidden_by_default", "collapsed"],
    ["execution_policy", "bridge_preview_read_only", "blocked_execution"],
    ["validation_summary", "bridge_preview_ready", "ready"],
  ].map(([key, value, status]) => ({ key, value, status }));
  const bridgePreviewRows = [
    ["live_surface_sections_bridge_row", "live_surface_sections", "cards", 7],
    ["live_lineage_cards_bridge_row", "source_artifact_live_cards", "cards", 6],
    ["live_evidence_rows_bridge_row", "evidence_rows_live", "table", 8],
    ["live_recovery_scenarios_bridge_row", "recovery_scenarios_live", "table", 8],
    ["live_protected_hash_proof_bridge_row", "protected_hash_proof_live_rows", "proof_panel", 2],
    ["live_side_effect_restoration_bridge_row", "side_effect_restoration_live_rows", "proof_panel", 2],
    ["live_blocked_actions_bridge_row", "blocked_action_live_rows", "blocked_matrix", 16],
    ["raw_evidence_payload_bridge_row", "raw_ui_preview", "collapsed_json", 0],
  ].map(([key, source_key, bridge_section, source_count], index) => ({
    key, source_key, bridge_section, source_count, display_order: index + 1,
    bridge_status: "ready", bridge_action: "inspect_bridge_preview_only",
    can_execute_bridge_action: false, can_mutate_context: false, can_write_canon: false,
    can_update_active_engine: false, can_update_compressed_rules: false, can_register_mcp_tool: false,
  }));
  const recoveryBridgeRows = [
    "digest_drift_recovery_live", "row_order_drift_recovery_live", "summary_line_drift_recovery_live", "raw_exposure_recovery_live",
    "blocked_action_regression_recovery_live", "weak_input_regression_recovery_live", "protected_hash_drift_recovery_live", "entity_registry_side_effect_recovery_live",
  ].map((source_row_key, index) => ({ key: source_row_key.replace("_live", "_bridge_preview"), source_row_key, display_order: index + 1, bridge_status: "summarized", operator_action_mode: "manual_only", execution_allowed_from_bridge: false }));
  const bridgeProofPanels = [
    { key: "active_engine_hash_bridge_proof", expected_hash: expectedActiveEngineHash, bridge_status: "unchanged" },
    { key: "compressed_rules_hash_bridge_proof", expected_hash: expectedCompressedRulesHash, bridge_status: "unchanged" },
    { key: "entity_registry_restore_bridge_proof", path: "data/entity_registry", bridge_status: "restore_required_when_dirty", commit_allowed_when_dirty: false },
    { key: "protected_runtime_paths_bridge_proof", path: "data/outputs/logs/policy_imports.jsonl", bridge_status: "unchanged", verification_command: "npm run test:mcp" },
  ];
  const digestTraceRows = ["31E", "31F", "31G", "31J", "31K", "31L", "31M", "31N", "31O", "31P", "31Q", "31R"].map((phase, index) => ({
    key: [
      "builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest",
      "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest", "operator_review_packet_bridge_stability_guard_digest",
      "operator_review_packet_bridge_recovery_guide_digest", "operator_review_packet_bridge_evidence_packet_digest",
      "operator_review_packet_bridge_evidence_packet_ui_preview_digest", "operator_review_packet_bridge_evidence_packet_ui_live_smoke_digest",
    ][index],
    source_phase: phase,
    source_digest: phase === "31R" ? source31RDigest : undefined,
    trace_status: "traceable",
  }));
  const blockedBridgeActions = [
    "approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload",
    "write_evidence_packet_bridge_preview_state", "write_evidence_packet_ui_live_smoke_state", "write_evidence_packet_ui_preview_state",
    "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state",
    "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules",
  ].map((key) => ({ key, allowed: false, bridge_status: "blocked" }));
  const allowedBridgePreviewActions = [
    "read_operator_review_packet_bridge_evidence_packet_bridge_preview", "copy_operator_review_evidence_bridge_markdown",
    "inspect_bridge_preview_cards", "inspect_bridge_preview_rows", "inspect_bridge_recovery_rows", "inspect_bridge_proof_panels",
    "inspect_bridge_blocked_actions", "inspect_digest_trace_rows",
  ].map((key) => ({ key, allowed: true }));
  const safetyBoundary = {
    read_only: true, preview_only: true, bridge_preview_only: true, live_ui_smoke_only: true,
    no_context_build: true, no_context_attach: true, no_context_mutation: true, no_operator_decision_execute: true,
    no_recovery_execution: true, no_bridge_preview_persist: true, no_bridge_state_write: true, no_bridge_tool_registration: true,
    can_write_canon: false, can_update_active_engine: false, can_update_compressed_rules: false, can_register_mcp_tool: false,
    can_execute_operator_decision: false, can_execute_recovery_action: false, can_persist_bridge_preview: false, can_execute_bridge_action: false,
  };
  const noMutationSnapshot = {
    active_engine_modified: false, compressed_rules_modified: false, canon_written: false, context_built: false,
    context_attached: false, context_mutated: false, operator_decision_executed: false, recovery_action_executed: false,
    bridge_preview_persisted: false, bridge_preview_state_written: false, live_ui_smoke_persisted: false, live_ui_state_written: false,
    evidence_packet_persisted: false, recovery_guide_persisted: false, stability_guard_persisted: false, final_smoke_persisted: false,
    bridge_state_written: false, bridge_tool_registered: false, context_built_from_bridge_preview: false,
  };
  const warningBanners = [
    "bridge_preview_read_only", "raw_live_ui_smoke_hidden", "no_context_or_canon_write", "no_mcp_tool_registration", "restore_non_owned_side_effects",
  ].map((key) => ({ key, severity: "info" }));
  const chatgptSummaryLines = [
    "Operator review packet bridge evidence packet bridge preview: ready; read-only; inspect-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q→31R",
    `source_phase31r_digest: ${source31RDigest}`,
    "bridge cards: 10", "bridge preview rows: 8", "bridge recovery rows: 8", "bridge proof panels: 4",
    "active_engine hash unchanged", "compressed_rules hash unchanged", "raw live UI smoke hidden by default", "entity_registry side effects restore-before-commit",
    ...bridgePreviewRows.map((row) => `${row.key}: inspect_bridge_preview_only; execute=false; mutate=false; write=false; register=false`),
    `blocked_bridge_actions=${blockedBridgeActions.length}`,
  ];
  const bridgePreviewMarkdown = [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet Bridge Preview",
    "bridge_preview_mode: readonly_evidence_packet_bridge_preview",
    "raw_live_ui_smoke_visible_by_default: false",
    "will_persist_bridge_preview: false",
    "will_register_mcp_tool: false",
  ].join("\n");
  const bridgePreviewDigest = hash(stableJson({ source31RDigest, bridgeCards, bridgePreviewRows, recoveryBridgeRows, bridgeProofPanels, digestTraceRows, blockedBridgeActions, allowedBridgePreviewActions, safetyBoundary, noMutationSnapshot, warningBanners, chatgptSummaryLines, bridgePreviewMarkdown }));
  return {
    used: true, phase: "31S",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_bridge_preview_v1",
    bridge_preview_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_bridge_preview",
    bridge_preview_channel: "chatgpt_bridge_context_builder_operator_review_evidence_packet_bridge_preview",
    bridge_preview_mode: "readonly_evidence_packet_bridge_preview", bridge_preview_status: "ready",
    source_phase: "31R", source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke",
    source_phase31r_source_digest: source31RDigest, bridge_preview_digest: bridgePreviewDigest,
    can_display_evidence_packet_bridge_preview: true,
    will_persist_bridge_preview: false, will_persist_live_ui_smoke: false, will_execute_recovery_action: false,
    will_build_context_now: false, will_attach_context_now: false, will_mutate_context: false, will_persist_payload: false,
    will_execute_operator_decision: false, will_register_mcp_tool: false, will_write_canon: false,
    will_update_active_engine: false, will_update_compressed_rules: false,
    bridge_preview_cards: bridgeCards, bridge_preview_rows: bridgePreviewRows, bridge_recovery_rows: recoveryBridgeRows,
    bridge_proof_panels: bridgeProofPanels, digest_trace_rows: digestTraceRows, warning_banners: warningBanners,
    chatgpt_summary_lines: chatgptSummaryLines, bridge_preview_markdown: bridgePreviewMarkdown,
    allowed_bridge_preview_actions: allowedBridgePreviewActions, blocked_bridge_actions: blockedBridgeActions,
    safety_boundary: safetyBoundary, no_mutation_snapshot: noMutationSnapshot,
    raw_ui_live_smoke: null, raw_json_preview: { visible_by_default: false, raw_ui_live_smoke_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31S active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31S compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));
await import(new URL("./phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs", import.meta.url));

const phase31RSource = await readFile(phase31RPath, "utf8");
assertTokens(phase31RSource, [
  "buildEvidencePacketUiLiveSmoke", "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke_v1",
  "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q", "live_surface_sections", "source_artifact_live_cards",
  "evidence_rows_live", "recovery_scenarios_live", "protected_hash_proof_live_rows", "side_effect_restoration_live_rows",
  "blocked_action_live_rows", "raw_ui_preview", "hidden_by_default", "live_ui_smoke_read_only", "no_live_ui_state_persist", "deterministic",
], "Phase31S source live UI smoke");

const preview = buildEvidencePacketBridgePreview({ phase31RSource });
assert.equal(preview.phase, "31S");
assert.equal(preview.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_bridge_preview_v1");
assert.equal(preview.bridge_preview_mode, "readonly_evidence_packet_bridge_preview");
assert.equal(preview.source_phase, "31R");
assert.match(preview.source_phase31r_source_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.bridge_preview_digest, /^[a-f0-9]{64}$/u);
flags(preview, ["will_persist_bridge_preview", "will_persist_live_ui_smoke", "will_execute_recovery_action", "will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31S top flags");

const cards = keyed(preview.bridge_preview_cards, "Phase31S cards");
assert.deepEqual([...cards.keys()], ["bridge_preview_overall", "live_surface_sections", "source_artifact_live_cards", "evidence_rows_live", "recovery_scenarios_live", "proof_panels_live", "digest_trace", "raw_evidence_payload_bridge", "execution_policy", "validation_summary"]);
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q→31R");
assert.equal(cards.get("raw_evidence_payload_bridge")?.value, "hidden_by_default");

const rows = keyed(preview.bridge_preview_rows, "Phase31S bridge rows");
assert.equal(rows.size, 8);
assert.equal(rows.get("raw_evidence_payload_bridge_row")?.source_count, 0);
for (const row of rows.values()) {
  assert.equal(row.bridge_action, "inspect_bridge_preview_only");
  assert.equal(row.can_execute_bridge_action, false);
  assert.equal(row.can_write_canon, false);
  assert.equal(row.can_register_mcp_tool, false);
}
const recoveryRows = keyed(preview.bridge_recovery_rows, "Phase31S recovery rows");
assert.equal(recoveryRows.size, 8);
for (const row of recoveryRows.values()) assert.equal(row.execution_allowed_from_bridge, false);

const proofs = keyed(preview.bridge_proof_panels, "Phase31S proof panels");
assert.equal(proofs.get("active_engine_hash_bridge_proof")?.expected_hash, expectedActiveEngineHash);
assert.equal(proofs.get("compressed_rules_hash_bridge_proof")?.expected_hash, expectedCompressedRulesHash);
assert.equal(proofs.get("entity_registry_restore_bridge_proof")?.commit_allowed_when_dirty, false);
assert.equal(proofs.get("protected_runtime_paths_bridge_proof")?.verification_command, "npm run test:mcp");

const digestTrace = keyed(preview.digest_trace_rows, "Phase31S digest trace rows");
assert.equal(digestTrace.size, 12);
assert.equal(digestTrace.get("operator_review_packet_bridge_evidence_packet_ui_live_smoke_digest")?.source_phase, "31R");

const blocked = keyed(preview.blocked_bridge_actions, "Phase31S blocked bridge actions");
for (const key of ["write_evidence_packet_bridge_preview_state", "write_evidence_packet_ui_live_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) assert.equal(blocked.get(key)?.allowed, false);

const allowed = keyed(preview.allowed_bridge_preview_actions, "Phase31S allowed bridge preview actions");
assert.equal(allowed.size, 8);
for (const action of allowed.values()) assert.equal(action.allowed, true);

flags(preview.safety_boundary, ["read_only", "preview_only", "bridge_preview_only", "live_ui_smoke_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_recovery_execution", "no_bridge_preview_persist", "no_bridge_state_write", "no_bridge_tool_registration"], true, "Phase31S safety true");
flags(preview.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_execute_recovery_action", "can_persist_bridge_preview", "can_execute_bridge_action"], false, "Phase31S safety false");
flags(preview.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_decision_executed", "recovery_action_executed", "bridge_preview_persisted", "bridge_preview_state_written", "live_ui_smoke_persisted", "live_ui_state_written", "evidence_packet_persisted", "recovery_guide_persisted", "stability_guard_persisted", "final_smoke_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_bridge_preview"], false, "Phase31S mutation");

assert.deepEqual([...keyed(preview.warning_banners, "Phase31S warnings").keys()], ["bridge_preview_read_only", "raw_live_ui_smoke_hidden", "no_context_or_canon_write", "no_mcp_tool_registration", "restore_non_owned_side_effects"]);
assert(preview.bridge_preview_markdown.includes("readonly_evidence_packet_bridge_preview"));
assert(preview.bridge_preview_markdown.includes("raw_live_ui_smoke_visible_by_default: false"));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("read-only; inspect-only")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("raw live UI smoke hidden by default")));
assert.equal(preview.chatgpt_summary_lines.filter((line) => line.includes("inspect_bridge_preview_only")).length, 8);
assert.equal(preview.raw_ui_live_smoke, null);
assert.equal(preview.raw_json_preview.visible_by_default, false);
assert.equal(preview.raw_json_preview.raw_ui_live_smoke_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildEvidencePacketBridgePreview({ phase31RSource });
  assert.equal(rerun.bridge_preview_digest, preview.bridge_preview_digest);
  assert.deepEqual(rerun, preview, "Phase31S evidence packet bridge preview rerun should be deterministic.");
}
assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31S changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31S changed compressed_rules hash.");
console.log("Phase31S aesthetic memory context builder operator review packet bridge evidence packet bridge preview tests passed.");