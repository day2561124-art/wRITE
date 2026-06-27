import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const phase31PPath = path.join(root, "tests", "phase31", "phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs");

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
function assertFlags(target, keys, expected, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], expected, `${label} ${key} drifted`);
}
function assertRunAllOrder(text) {
  const ordered = [
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
    "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
    "tests/phase31/phase31m-aesthetic-memory-context-builder-operator-review-packet-bridge-final-smoke.test.mjs",
    "tests/phase31/phase31n-aesthetic-memory-context-builder-operator-review-packet-bridge-stability-guard.test.mjs",
    "tests/phase31/phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs",
    "tests/phase31/phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs",
    "tests/phase31/phase31q-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-preview.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(text.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) assert(text.indexOf(ordered[index]) < text.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
}
function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing ${token}`);
}

function buildEvidencePacketUiPreview({ phase31PSource }) {
  const source31PDigest = hash(phase31PSource);
  const sourceArtifactCards = [
    { key: "phase31l_bridge_preview_source_card", source_phase: "31L", display_order: 1, ui_status: "ready", evidence_role: "bridge_preview_contract" },
    { key: "phase31m_final_smoke_source_card", source_phase: "31M", display_order: 2, ui_status: "ready", evidence_role: "final_smoke_contract" },
    { key: "phase31n_stability_guard_source_card", source_phase: "31N", display_order: 3, ui_status: "ready", evidence_role: "stability_guard_contract" },
    { key: "phase31o_recovery_guide_source_card", source_phase: "31O", display_order: 4, ui_status: "ready", evidence_role: "recovery_guide_contract" },
    { key: "phase31p_evidence_packet_source_card", source_phase: "31P", display_order: 5, ui_status: "ready", evidence_role: "evidence_packet_contract", source_digest: source31PDigest },
  ];
  const recoveryScenarioRows = [
    "digest_drift_recovery",
    "row_order_drift_recovery",
    "summary_line_drift_recovery",
    "raw_exposure_recovery",
    "blocked_action_regression_recovery",
    "weak_input_regression_recovery",
    "protected_hash_drift_recovery",
    "entity_registry_side_effect_recovery",
  ].map((key, index) => ({
    key,
    display_order: index + 1,
    table_section: "recovery_scenarios_table",
    ui_status: "captured",
    operator_action_mode: "manual_only",
    execution_allowed_from_ui: false,
  }));
  const evidenceRows = [
    "source_lineage_evidence",
    "recovery_scenario_evidence",
    "blocked_action_evidence",
    "protected_hash_evidence",
    "side_effect_restoration_evidence",
    "raw_payload_hidden_evidence",
    "manual_only_policy_evidence",
    "deterministic_rerun_evidence",
  ].map((key, index) => ({
    key,
    display_order: index + 1,
    table_section: "evidence_rows_table",
    ui_status: "captured",
    ui_action: "inspect_evidence_only",
    can_execute_evidence: false,
    can_mutate_context: false,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
  }));
  const protectedHashRows = [
    { key: "active_engine_hash_proof", path: "data/canon_db/active_engine.md", expected_hash: expectedActiveEngineHash, proof_status: "unchanged", ui_status: "ready" },
    { key: "compressed_rules_hash_proof", path: "data/error_report_db/compressed_rules.md", expected_hash: expectedCompressedRulesHash, proof_status: "unchanged", ui_status: "ready" },
  ];
  const sideEffectRows = [
    { key: "entity_registry_restore_before_commit", path: "data/entity_registry", ui_status: "restore_required_when_dirty", commit_allowed_when_dirty: false, verification_command: "git status --short" },
    { key: "protected_runtime_paths_unchanged", path: "data/outputs/logs/policy_imports.jsonl", ui_status: "unchanged", commit_allowed_when_dirty: false, verification_command: "npm run test:mcp" },
  ];
  const blockedActionRows = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_ui_preview_state", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false, ui_status: "blocked" }));
  const digestTraceRows = [
    { key: "builder_readiness_digest", source_phase: "31E" },
    { key: "surface_digest", source_phase: "31F" },
    { key: "bridge_preview_digest", source_phase: "31G" },
    { key: "operator_packet_digest", source_phase: "31J" },
    { key: "operator_review_ui_surface_digest", source_phase: "31K" },
    { key: "operator_review_packet_bridge_preview_digest", source_phase: "31L" },
    { key: "operator_review_packet_bridge_final_smoke_digest", source_phase: "31M" },
    { key: "operator_review_packet_bridge_stability_guard_digest", source_phase: "31N" },
    { key: "operator_review_packet_bridge_recovery_guide_digest", source_phase: "31O" },
    { key: "operator_review_packet_bridge_evidence_packet_digest", source_phase: "31P", source_digest: source31PDigest },
  ].map((row) => ({ ...row, trace_status: "traceable" }));
  const sections = [
    { key: "lineage_cards_section", display_order: 1, component: "card_grid", visible: true, raw_payload_required: false },
    { key: "evidence_rows_section", display_order: 2, component: "table", visible: true, raw_payload_required: false },
    { key: "recovery_scenarios_section", display_order: 3, component: "table", visible: true, raw_payload_required: false },
    { key: "protected_hash_proof_section", display_order: 4, component: "proof_panel", visible: true, raw_payload_required: false },
    { key: "side_effect_restoration_section", display_order: 5, component: "proof_panel", visible: true, raw_payload_required: false },
    { key: "blocked_actions_section", display_order: 6, component: "blocked_matrix", visible: true, raw_payload_required: false },
    { key: "raw_evidence_payload_section", display_order: 7, component: "collapsed_json", visible: false, raw_payload_required: false },
  ];
  const cards = [
    { key: "ui_preview_overall", value: "ready", status: "ready" },
    { key: "source_artifact_cards", value: String(sourceArtifactCards.length), status: "ready" },
    { key: "evidence_rows", value: String(evidenceRows.length), status: "ready" },
    { key: "recovery_scenarios", value: String(recoveryScenarioRows.length), status: "ready" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P", status: "traceable" },
    { key: "protected_hash_proof", value: "2", status: "unchanged" },
    { key: "side_effect_restoration_proof", value: "2", status: "ready" },
    { key: "raw_evidence_payload", value: "hidden_by_default", status: "collapsed" },
    { key: "execution_policy", value: "ui_preview_read_only", status: "blocked_execution" },
  ];
  const warnings = [
    { key: "ui_preview_read_only", severity: "info", message: "UI preview is read-only and inspect-only." },
    { key: "raw_evidence_payload_hidden", severity: "info", message: "Raw evidence payload is hidden by default." },
    { key: "no_context_or_canon_write", severity: "info", message: "UI preview will not build context, write Canon, update active_engine, or update compressed_rules." },
    { key: "restore_non_owned_side_effects", severity: "info", message: "Non-owned entity_registry side effects must be restored before commit." },
  ];
  const allowedActions = ["read_operator_review_packet_bridge_evidence_packet_ui_preview", "copy_operator_review_evidence_ui_markdown", "inspect_lineage_cards", "inspect_evidence_rows", "inspect_recovery_scenarios", "inspect_protected_hash_proof", "inspect_side_effect_restoration_proof", "inspect_blocked_action_rows"].map((key) => ({ key, allowed: true }));
  const safety = {
    read_only: true,
    preview_only: true,
    ui_preview_only: true,
    evidence_packet_only: true,
    no_context_build: true,
    no_context_attach: true,
    no_context_mutation: true,
    no_operator_decision_execute: true,
    no_recovery_execution: true,
    no_ui_state_persist: true,
    no_evidence_packet_persist: true,
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
    can_persist_ui_preview: false,
    can_execute_ui_action: false,
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
    ui_preview_persisted: false,
    ui_state_written: false,
    evidence_packet_persisted: false,
    recovery_guide_persisted: false,
    stability_guard_persisted: false,
    final_smoke_persisted: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    context_built_from_ui_preview: false,
  };
  const summary = [
    "Operator review packet bridge evidence packet UI preview: ready; read-only; inspect-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O→31P",
    `source_phase31p_digest: ${source31PDigest}`,
    "lineage cards: 5",
    "evidence rows: 8",
    "recovery scenario rows: 8",
    "active_engine hash unchanged",
    "compressed_rules hash unchanged",
    "entity_registry side effects restore-before-commit",
    ...evidenceRows.map((row) => `${row.key}: inspect_evidence_only; execute=false; mutate=false; write=false; register=false`),
    `blocked_ui_actions=${blockedActionRows.length}`,
  ];
  const markdown = [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet UI Preview",
    "",
    "ui_preview_status: ready",
    "ui_preview_mode: readonly_evidence_packet_ui_preview",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O→31P",
    "raw_evidence_payload_visible_by_default: false",
    "will_persist_ui_preview: false",
    "will_persist_evidence_packet: false",
    "will_execute_recovery_action: false",
    "will_build_context_now: false",
    "will_write_canon: false",
    "will_update_active_engine: false",
    "will_update_compressed_rules: false",
    "will_register_mcp_tool: false",
  ].join("\n");
  const previewDigest = hash(stableJson({ source31PDigest, sourceArtifactCards, recoveryScenarioRows, evidenceRows, protectedHashRows, sideEffectRows, blockedActionRows, digestTraceRows, sections, cards, warnings, allowedActions, safety, mutation, summary, markdown }));
  return {
    used: true,
    phase: "31Q",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview_v1",
    ui_preview_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview",
    ui_preview_channel: "chatgpt_bridge_context_builder_operator_review_evidence_packet_ui_preview",
    ui_preview_mode: "readonly_evidence_packet_ui_preview",
    ui_preview_status: "ready",
    source_phase: "31P",
    source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet",
    source_phase31p_source_digest: source31PDigest,
    ui_preview_digest: previewDigest,
    can_display_evidence_packet_ui_preview: true,
    will_persist_ui_preview: false,
    will_persist_evidence_packet: false,
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
    ui_preview_cards: cards,
    ui_preview_sections: sections,
    source_artifact_cards: sourceArtifactCards,
    evidence_rows_table: evidenceRows,
    recovery_scenarios_table: recoveryScenarioRows,
    protected_hash_proof_rows: protectedHashRows,
    side_effect_restoration_rows: sideEffectRows,
    blocked_action_rows: blockedActionRows,
    digest_trace_rows: digestTraceRows,
    warning_banners: warnings,
    chatgpt_summary_lines: summary,
    ui_preview_markdown: markdown,
    allowed_ui_preview_actions: allowedActions,
    safety_boundary: safety,
    no_mutation_snapshot: mutation,
    raw_evidence_packet: null,
    raw_json_preview: { visible_by_default: false, raw_evidence_packet_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31Q active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31Q compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));
await import(new URL("./phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs", import.meta.url));

const phase31PSource = await readFile(phase31PPath, "utf8");
assertTokens(phase31PSource, [
  "buildEvidencePacket",
  "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_v1",
  "31E→31F→31G→31J→31K→31L→31M→31N→31O",
  "source_lineage_evidence",
  "recovery_scenario_evidence",
  "blocked_action_evidence",
  "protected_hash_evidence",
  "side_effect_restoration_evidence",
  "raw_payload_hidden_evidence",
  "manual_only_policy_evidence",
  "deterministic_rerun_evidence",
  "raw_recovery_guide",
  "hidden_by_default",
  "entity_registry side effects restore-before-commit",
  "read-only; inspect-only",
  "no_evidence_packet_persist",
  "blocked_evidence_actions",
  "deterministic",
], "Phase31Q source evidence packet");

const preview = buildEvidencePacketUiPreview({ phase31PSource });
assert.equal(preview.used, true);
assert.equal(preview.phase, "31Q");
assert.equal(preview.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview_v1");
assert.equal(preview.ui_preview_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview");
assert.equal(preview.ui_preview_channel, "chatgpt_bridge_context_builder_operator_review_evidence_packet_ui_preview");
assert.equal(preview.ui_preview_mode, "readonly_evidence_packet_ui_preview");
assert.equal(preview.ui_preview_status, "ready");
assert.equal(preview.source_phase, "31P");
assert.match(preview.source_phase31p_source_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.ui_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(preview.can_display_evidence_packet_ui_preview, true);
assertFlags(preview, ["will_persist_ui_preview", "will_persist_evidence_packet", "will_execute_recovery_action", "will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31Q top flags");

const cards = keyed(preview.ui_preview_cards, "Phase31Q cards");
assert.deepEqual([...cards.keys()], ["ui_preview_overall", "source_artifact_cards", "evidence_rows", "recovery_scenarios", "digest_trace", "protected_hash_proof", "side_effect_restoration_proof", "raw_evidence_payload", "execution_policy"]);
assert.equal(cards.get("source_artifact_cards")?.value, "5");
assert.equal(cards.get("evidence_rows")?.value, "8");
assert.equal(cards.get("recovery_scenarios")?.value, "8");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P");
assert.equal(cards.get("raw_evidence_payload")?.value, "hidden_by_default");
assert.equal(cards.get("execution_policy")?.value, "ui_preview_read_only");

const sections = keyed(preview.ui_preview_sections, "Phase31Q sections");
assert.deepEqual([...sections.keys()], ["lineage_cards_section", "evidence_rows_section", "recovery_scenarios_section", "protected_hash_proof_section", "side_effect_restoration_section", "blocked_actions_section", "raw_evidence_payload_section"]);
assert.equal(sections.get("raw_evidence_payload_section")?.visible, false);
for (const section of sections.values()) assert.equal(section.raw_payload_required, false);

const sourceCards = keyed(preview.source_artifact_cards, "Phase31Q source cards");
assert.deepEqual([...sourceCards.keys()], ["phase31l_bridge_preview_source_card", "phase31m_final_smoke_source_card", "phase31n_stability_guard_source_card", "phase31o_recovery_guide_source_card", "phase31p_evidence_packet_source_card"]);
assert.match(sourceCards.get("phase31p_evidence_packet_source_card")?.source_digest, /^[a-f0-9]{64}$/u);

const evidenceRows = keyed(preview.evidence_rows_table, "Phase31Q evidence rows table");
assert.deepEqual([...evidenceRows.keys()], ["source_lineage_evidence", "recovery_scenario_evidence", "blocked_action_evidence", "protected_hash_evidence", "side_effect_restoration_evidence", "raw_payload_hidden_evidence", "manual_only_policy_evidence", "deterministic_rerun_evidence"]);
for (const row of evidenceRows.values()) {
  assert.equal(row.ui_action, "inspect_evidence_only");
  assert.equal(row.can_execute_evidence, false);
  assert.equal(row.can_mutate_context, false);
  assert.equal(row.can_write_canon, false);
  assert.equal(row.can_update_active_engine, false);
  assert.equal(row.can_update_compressed_rules, false);
  assert.equal(row.can_register_mcp_tool, false);
}

const scenarios = keyed(preview.recovery_scenarios_table, "Phase31Q recovery scenarios table");
assert.deepEqual([...scenarios.keys()], ["digest_drift_recovery", "row_order_drift_recovery", "summary_line_drift_recovery", "raw_exposure_recovery", "blocked_action_regression_recovery", "weak_input_regression_recovery", "protected_hash_drift_recovery", "entity_registry_side_effect_recovery"]);
for (const scenario of scenarios.values()) assert.equal(scenario.execution_allowed_from_ui, false);

const protectedRows = keyed(preview.protected_hash_proof_rows, "Phase31Q protected hash proof rows");
assert.equal(protectedRows.get("active_engine_hash_proof")?.expected_hash, expectedActiveEngineHash);
assert.equal(protectedRows.get("compressed_rules_hash_proof")?.expected_hash, expectedCompressedRulesHash);
for (const row of protectedRows.values()) assert.equal(row.proof_status, "unchanged");

const sideEffects = keyed(preview.side_effect_restoration_rows, "Phase31Q side effect restoration rows");
assert.equal(sideEffects.get("entity_registry_restore_before_commit")?.path, "data/entity_registry");
assert.equal(sideEffects.get("entity_registry_restore_before_commit")?.commit_allowed_when_dirty, false);
assert.equal(sideEffects.get("protected_runtime_paths_unchanged")?.verification_command, "npm run test:mcp");

const blockedRows = keyed(preview.blocked_action_rows, "Phase31Q blocked action rows");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_ui_preview_state", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) assert.equal(blockedRows.get(key)?.allowed, false, `${key} must stay blocked.`);

const digestTrace = keyed(preview.digest_trace_rows, "Phase31Q digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest", "operator_review_packet_bridge_stability_guard_digest", "operator_review_packet_bridge_recovery_guide_digest", "operator_review_packet_bridge_evidence_packet_digest"]);
assert.equal(digestTrace.get("operator_review_packet_bridge_evidence_packet_digest")?.source_phase, "31P");

const allowed = keyed(preview.allowed_ui_preview_actions, "Phase31Q allowed UI preview actions");
assert.deepEqual([...allowed.keys()], ["read_operator_review_packet_bridge_evidence_packet_ui_preview", "copy_operator_review_evidence_ui_markdown", "inspect_lineage_cards", "inspect_evidence_rows", "inspect_recovery_scenarios", "inspect_protected_hash_proof", "inspect_side_effect_restoration_proof", "inspect_blocked_action_rows"]);
for (const action of allowed.values()) assert.equal(action.allowed, true);

assertFlags(preview.safety_boundary, ["read_only", "preview_only", "ui_preview_only", "evidence_packet_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_recovery_execution", "no_ui_state_persist", "no_evidence_packet_persist", "no_recovery_guide_persist", "no_stability_guard_persist", "no_final_smoke_persist", "no_bridge_preview_persist", "no_bridge_tool_registration"], true, "Phase31Q safety true");
assertFlags(preview.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_execute_recovery_action", "can_persist_ui_preview", "can_execute_ui_action"], false, "Phase31Q safety false");
assertFlags(preview.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_decision_executed", "recovery_action_executed", "ui_preview_persisted", "ui_state_written", "evidence_packet_persisted", "recovery_guide_persisted", "stability_guard_persisted", "final_smoke_persisted", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_ui_preview"], false, "Phase31Q mutation");

const warnings = keyed(preview.warning_banners, "Phase31Q warnings");
assert.deepEqual([...warnings.keys()], ["ui_preview_read_only", "raw_evidence_payload_hidden", "no_context_or_canon_write", "restore_non_owned_side_effects"]);
assert(preview.ui_preview_markdown.includes("Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet UI Preview"));
assert(preview.ui_preview_markdown.includes("readonly_evidence_packet_ui_preview"));
assert(preview.ui_preview_markdown.includes("raw_evidence_payload_visible_by_default: false"));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("read-only; inspect-only")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L→31M→31N→31O→31P")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("entity_registry side effects restore-before-commit")));
assert.equal(preview.chatgpt_summary_lines.filter((line) => line.includes("inspect_evidence_only")).length, 8);
assert.equal(preview.raw_evidence_packet, null);
assert.equal(preview.raw_json_preview.visible_by_default, false);
assert.equal(preview.raw_json_preview.raw_evidence_packet_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildEvidencePacketUiPreview({ phase31PSource });
  assert.equal(rerun.ui_preview_digest, preview.ui_preview_digest);
  assert.deepEqual(rerun, preview, "Phase31Q evidence packet UI preview rerun should be deterministic.");
}
assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31Q changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31Q changed compressed_rules hash.");
console.log("Phase31Q aesthetic memory context builder operator review packet bridge evidence packet UI preview tests passed.");
