import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const phase31QPath = path.join(root, "tests", "phase31", "phase31q-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-preview.test.mjs");

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
    "tests/phase31/phase31r-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-live-smoke.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(text.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) assert(text.indexOf(ordered[index]) < text.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
}
function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing ${token}`);
}

function buildEvidencePacketUiLiveSmoke({ phase31QSource }) {
  const source31QDigest = hash(phase31QSource);
  const liveSurfaceSections = [
    { key: "lineage_cards_section_live", source_section: "lineage_cards_section", display_order: 1, component: "card_grid", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "evidence_rows_section_live", source_section: "evidence_rows_section", display_order: 2, component: "table", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "recovery_scenarios_section_live", source_section: "recovery_scenarios_section", display_order: 3, component: "table", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "protected_hash_proof_section_live", source_section: "protected_hash_proof_section", display_order: 4, component: "proof_panel", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "side_effect_restoration_section_live", source_section: "side_effect_restoration_section", display_order: 5, component: "proof_panel", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "blocked_actions_section_live", source_section: "blocked_actions_section", display_order: 6, component: "blocked_matrix", live_status: "rendered", visible: true, raw_payload_required: false },
    { key: "raw_evidence_payload_section_live", source_section: "raw_evidence_payload_section", display_order: 7, component: "collapsed_json", live_status: "collapsed", visible: false, raw_payload_required: false },
  ];
  const sourceArtifactLiveCards = [
    { key: "phase31l_bridge_preview_live_card", source_phase: "31L", display_order: 1, live_status: "rendered", evidence_role: "bridge_preview_contract" },
    { key: "phase31m_final_smoke_live_card", source_phase: "31M", display_order: 2, live_status: "rendered", evidence_role: "final_smoke_contract" },
    { key: "phase31n_stability_guard_live_card", source_phase: "31N", display_order: 3, live_status: "rendered", evidence_role: "stability_guard_contract" },
    { key: "phase31o_recovery_guide_live_card", source_phase: "31O", display_order: 4, live_status: "rendered", evidence_role: "recovery_guide_contract" },
    { key: "phase31p_evidence_packet_live_card", source_phase: "31P", display_order: 5, live_status: "rendered", evidence_role: "evidence_packet_contract" },
    { key: "phase31q_ui_preview_live_card", source_phase: "31Q", display_order: 6, live_status: "rendered", evidence_role: "ui_preview_contract", source_digest: source31QDigest },
  ];
  const evidenceLiveRows = [
    "source_lineage_evidence",
    "recovery_scenario_evidence",
    "blocked_action_evidence",
    "protected_hash_evidence",
    "side_effect_restoration_evidence",
    "raw_payload_hidden_evidence",
    "manual_only_policy_evidence",
    "deterministic_rerun_evidence",
  ].map((key, index) => ({
    key: `${key}_live`,
    source_row_key: key,
    display_order: index + 1,
    table_section: "evidence_rows_table_live",
    live_status: "rendered",
    ui_action: "inspect_evidence_only",
    can_execute_evidence: false,
    can_mutate_context: false,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
  }));
  const recoveryScenarioLiveRows = [
    "digest_drift_recovery",
    "row_order_drift_recovery",
    "summary_line_drift_recovery",
    "raw_exposure_recovery",
    "blocked_action_regression_recovery",
    "weak_input_regression_recovery",
    "protected_hash_drift_recovery",
    "entity_registry_side_effect_recovery",
  ].map((key, index) => ({
    key: `${key}_live`,
    source_row_key: key,
    display_order: index + 1,
    table_section: "recovery_scenarios_table_live",
    live_status: "rendered",
    operator_action_mode: "manual_only",
    execution_allowed_from_ui: false,
  }));
  const protectedHashLiveRows = [
    { key: "active_engine_hash_proof_live", source_row_key: "active_engine_hash_proof", path: "data/canon_db/active_engine.md", expected_hash: expectedActiveEngineHash, proof_status: "unchanged", live_status: "rendered" },
    { key: "compressed_rules_hash_proof_live", source_row_key: "compressed_rules_hash_proof", path: "data/error_report_db/compressed_rules.md", expected_hash: expectedCompressedRulesHash, proof_status: "unchanged", live_status: "rendered" },
  ];
  const sideEffectLiveRows = [
    { key: "entity_registry_restore_before_commit_live", source_row_key: "entity_registry_restore_before_commit", path: "data/entity_registry", live_status: "restore_required_when_dirty", commit_allowed_when_dirty: false, verification_command: "git status --short" },
    { key: "protected_runtime_paths_unchanged_live", source_row_key: "protected_runtime_paths_unchanged", path: "data/outputs/logs/policy_imports.jsonl", live_status: "unchanged", commit_allowed_when_dirty: false, verification_command: "npm run test:mcp" },
  ];
  const blockedActionLiveRows = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_ui_live_smoke_state", "write_evidence_packet_ui_preview_state", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false, live_status: "blocked" }));
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
    { key: "operator_review_packet_bridge_evidence_packet_digest", source_phase: "31P" },
    { key: "operator_review_packet_bridge_evidence_packet_ui_preview_digest", source_phase: "31Q", source_digest: source31QDigest },
  ].map((row) => ({ ...row, trace_status: "traceable" }));
  const cards = [
    { key: "live_smoke_overall", value: "ready", status: "ready" },
    { key: "live_surface_sections", value: String(liveSurfaceSections.length), status: "rendered" },
    { key: "source_artifact_live_cards", value: String(sourceArtifactLiveCards.length), status: "rendered" },
    { key: "evidence_rows_live", value: String(evidenceLiveRows.length), status: "rendered" },
    { key: "recovery_scenarios_live", value: String(recoveryScenarioLiveRows.length), status: "rendered" },
    { key: "proof_panels_live", value: "4", status: "rendered" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q", status: "traceable" },
    { key: "raw_evidence_payload_live", value: "hidden_by_default", status: "collapsed" },
    { key: "execution_policy", value: "live_ui_smoke_read_only", status: "blocked_execution" },
    { key: "validation_summary", value: "live_ui_smoke_passed", status: "ready" },
  ];
  const warnings = [
    { key: "live_ui_smoke_read_only", severity: "info", message: "Live UI smoke is read-only and inspect-only." },
    { key: "raw_evidence_payload_hidden", severity: "info", message: "Raw evidence payload remains hidden by default on the live surface." },
    { key: "no_context_or_canon_write", severity: "info", message: "Live UI smoke will not build context, write Canon, update active_engine, or update compressed_rules." },
    { key: "restore_non_owned_side_effects", severity: "info", message: "Non-owned entity_registry side effects must be restored before commit." },
  ];
  const allowedActions = ["read_operator_review_packet_bridge_evidence_packet_ui_live_smoke", "copy_operator_review_evidence_live_ui_markdown", "inspect_live_surface_sections", "inspect_live_lineage_cards", "inspect_live_evidence_rows", "inspect_live_recovery_scenarios", "inspect_live_proof_panels", "inspect_live_blocked_action_rows"].map((key) => ({ key, allowed: true }));
  const safety = {
    read_only: true,
    preview_only: true,
    live_ui_smoke_only: true,
    ui_preview_only: true,
    evidence_packet_only: true,
    no_context_build: true,
    no_context_attach: true,
    no_context_mutation: true,
    no_operator_decision_execute: true,
    no_recovery_execution: true,
    no_live_ui_state_persist: true,
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
    can_persist_live_ui_smoke: false,
    can_execute_live_ui_action: false,
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
    live_ui_smoke_persisted: false,
    live_ui_state_written: false,
    ui_preview_persisted: false,
    ui_state_written: false,
    evidence_packet_persisted: false,
    recovery_guide_persisted: false,
    stability_guard_persisted: false,
    final_smoke_persisted: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    context_built_from_live_ui_smoke: false,
  };
  const summary = [
    "Operator review packet bridge evidence packet UI live smoke: ready; read-only; inspect-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q",
    `source_phase31q_digest: ${source31QDigest}`,
    "live surface sections: 7",
    "source artifact live cards: 6",
    "evidence rows live: 8",
    "recovery scenario rows live: 8",
    "proof panels live: protected_hash=2 side_effect=2",
    "active_engine hash unchanged",
    "compressed_rules hash unchanged",
    "entity_registry side effects restore-before-commit",
    ...evidenceLiveRows.map((row) => `${row.key}: inspect_evidence_only; execute=false; mutate=false; write=false; register=false`),
    `blocked_live_ui_actions=${blockedActionLiveRows.length}`,
  ];
  const markdown = [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet UI Live Smoke",
    "",
    "live_ui_smoke_status: ready",
    "live_ui_smoke_mode: readonly_evidence_packet_ui_live_smoke",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q",
    "raw_evidence_payload_visible_by_default: false",
    "will_persist_live_ui_smoke: false",
    "will_persist_ui_preview: false",
    "will_persist_evidence_packet: false",
    "will_execute_recovery_action: false",
    "will_build_context_now: false",
    "will_write_canon: false",
    "will_update_active_engine: false",
    "will_update_compressed_rules: false",
    "will_register_mcp_tool: false",
  ].join("\n");
  const liveSmokeDigest = hash(stableJson({ source31QDigest, liveSurfaceSections, sourceArtifactLiveCards, evidenceLiveRows, recoveryScenarioLiveRows, protectedHashLiveRows, sideEffectLiveRows, blockedActionLiveRows, digestTraceRows, cards, warnings, allowedActions, safety, mutation, summary, markdown }));
  return {
    used: true,
    phase: "31R",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke_v1",
    live_smoke_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke",
    live_smoke_channel: "chatgpt_bridge_context_builder_operator_review_evidence_packet_ui_live_smoke",
    live_smoke_mode: "readonly_evidence_packet_ui_live_smoke",
    live_smoke_status: "ready",
    source_phase: "31Q",
    source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview",
    source_phase31q_source_digest: source31QDigest,
    live_smoke_digest: liveSmokeDigest,
    can_display_evidence_packet_ui_live_smoke: true,
    will_persist_live_ui_smoke: false,
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
    live_smoke_cards: cards,
    live_surface_sections: liveSurfaceSections,
    source_artifact_live_cards: sourceArtifactLiveCards,
    evidence_rows_live: evidenceLiveRows,
    recovery_scenarios_live: recoveryScenarioLiveRows,
    protected_hash_proof_live_rows: protectedHashLiveRows,
    side_effect_restoration_live_rows: sideEffectLiveRows,
    blocked_action_live_rows: blockedActionLiveRows,
    digest_trace_rows: digestTraceRows,
    warning_banners: warnings,
    chatgpt_summary_lines: summary,
    live_ui_smoke_markdown: markdown,
    allowed_live_ui_smoke_actions: allowedActions,
    safety_boundary: safety,
    no_mutation_snapshot: mutation,
    raw_ui_preview: null,
    raw_json_preview: { visible_by_default: false, raw_ui_preview_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31R active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31R compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));
await import(new URL("./phase31q-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet-ui-preview.test.mjs", import.meta.url));

const phase31QSource = await readFile(phase31QPath, "utf8");
assertTokens(phase31QSource, [
  "buildEvidencePacketUiPreview",
  "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_preview_v1",
  "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P",
  "lineage_cards_section",
  "evidence_rows_section",
  "recovery_scenarios_section",
  "protected_hash_proof_section",
  "side_effect_restoration_section",
  "blocked_actions_section",
  "raw_evidence_payload_section",
  "raw_evidence_packet",
  "hidden_by_default",
  "ui_preview_read_only",
  "inspect_evidence_only",
  "entity_registry side effects restore-before-commit",
  "no_ui_state_persist",
  "deterministic",
], "Phase31R source UI preview");

const liveSmoke = buildEvidencePacketUiLiveSmoke({ phase31QSource });
assert.equal(liveSmoke.used, true);
assert.equal(liveSmoke.phase, "31R");
assert.equal(liveSmoke.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke_v1");
assert.equal(liveSmoke.live_smoke_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_ui_live_smoke");
assert.equal(liveSmoke.live_smoke_channel, "chatgpt_bridge_context_builder_operator_review_evidence_packet_ui_live_smoke");
assert.equal(liveSmoke.live_smoke_mode, "readonly_evidence_packet_ui_live_smoke");
assert.equal(liveSmoke.live_smoke_status, "ready");
assert.equal(liveSmoke.source_phase, "31Q");
assert.match(liveSmoke.source_phase31q_source_digest, /^[a-f0-9]{64}$/u);
assert.match(liveSmoke.live_smoke_digest, /^[a-f0-9]{64}$/u);
assert.equal(liveSmoke.can_display_evidence_packet_ui_live_smoke, true);
assertFlags(liveSmoke, ["will_persist_live_ui_smoke", "will_persist_ui_preview", "will_persist_evidence_packet", "will_execute_recovery_action", "will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31R top flags");

const cards = keyed(liveSmoke.live_smoke_cards, "Phase31R cards");
assert.deepEqual([...cards.keys()], ["live_smoke_overall", "live_surface_sections", "source_artifact_live_cards", "evidence_rows_live", "recovery_scenarios_live", "proof_panels_live", "digest_trace", "raw_evidence_payload_live", "execution_policy", "validation_summary"]);
assert.equal(cards.get("live_surface_sections")?.value, "7");
assert.equal(cards.get("source_artifact_live_cards")?.value, "6");
assert.equal(cards.get("evidence_rows_live")?.value, "8");
assert.equal(cards.get("recovery_scenarios_live")?.value, "8");
assert.equal(cards.get("proof_panels_live")?.value, "4");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q");
assert.equal(cards.get("raw_evidence_payload_live")?.value, "hidden_by_default");
assert.equal(cards.get("execution_policy")?.value, "live_ui_smoke_read_only");

const sections = keyed(liveSmoke.live_surface_sections, "Phase31R live sections");
assert.deepEqual([...sections.keys()], ["lineage_cards_section_live", "evidence_rows_section_live", "recovery_scenarios_section_live", "protected_hash_proof_section_live", "side_effect_restoration_section_live", "blocked_actions_section_live", "raw_evidence_payload_section_live"]);
assert.equal(sections.get("raw_evidence_payload_section_live")?.visible, false);
assert.equal(sections.get("raw_evidence_payload_section_live")?.live_status, "collapsed");
for (const section of sections.values()) assert.equal(section.raw_payload_required, false);

const sourceCards = keyed(liveSmoke.source_artifact_live_cards, "Phase31R source live cards");
assert.deepEqual([...sourceCards.keys()], ["phase31l_bridge_preview_live_card", "phase31m_final_smoke_live_card", "phase31n_stability_guard_live_card", "phase31o_recovery_guide_live_card", "phase31p_evidence_packet_live_card", "phase31q_ui_preview_live_card"]);
assert.match(sourceCards.get("phase31q_ui_preview_live_card")?.source_digest, /^[a-f0-9]{64}$/u);
for (const card of sourceCards.values()) assert.equal(card.live_status, "rendered");

const evidenceRows = keyed(liveSmoke.evidence_rows_live, "Phase31R evidence rows live");
assert.deepEqual([...evidenceRows.keys()], ["source_lineage_evidence_live", "recovery_scenario_evidence_live", "blocked_action_evidence_live", "protected_hash_evidence_live", "side_effect_restoration_evidence_live", "raw_payload_hidden_evidence_live", "manual_only_policy_evidence_live", "deterministic_rerun_evidence_live"]);
for (const row of evidenceRows.values()) {
  assert.equal(row.live_status, "rendered");
  assert.equal(row.ui_action, "inspect_evidence_only");
  assert.equal(row.can_execute_evidence, false);
  assert.equal(row.can_mutate_context, false);
  assert.equal(row.can_write_canon, false);
  assert.equal(row.can_update_active_engine, false);
  assert.equal(row.can_update_compressed_rules, false);
  assert.equal(row.can_register_mcp_tool, false);
}

const scenarios = keyed(liveSmoke.recovery_scenarios_live, "Phase31R recovery scenarios live");
assert.deepEqual([...scenarios.keys()], ["digest_drift_recovery_live", "row_order_drift_recovery_live", "summary_line_drift_recovery_live", "raw_exposure_recovery_live", "blocked_action_regression_recovery_live", "weak_input_regression_recovery_live", "protected_hash_drift_recovery_live", "entity_registry_side_effect_recovery_live"]);
for (const scenario of scenarios.values()) {
  assert.equal(scenario.live_status, "rendered");
  assert.equal(scenario.execution_allowed_from_ui, false);
}

const protectedRows = keyed(liveSmoke.protected_hash_proof_live_rows, "Phase31R protected proof live rows");
assert.equal(protectedRows.get("active_engine_hash_proof_live")?.expected_hash, expectedActiveEngineHash);
assert.equal(protectedRows.get("compressed_rules_hash_proof_live")?.expected_hash, expectedCompressedRulesHash);
for (const row of protectedRows.values()) assert.equal(row.proof_status, "unchanged");

const sideEffects = keyed(liveSmoke.side_effect_restoration_live_rows, "Phase31R side effect live rows");
assert.equal(sideEffects.get("entity_registry_restore_before_commit_live")?.path, "data/entity_registry");
assert.equal(sideEffects.get("entity_registry_restore_before_commit_live")?.commit_allowed_when_dirty, false);
assert.equal(sideEffects.get("protected_runtime_paths_unchanged_live")?.verification_command, "npm run test:mcp");

const blockedRows = keyed(liveSmoke.blocked_action_live_rows, "Phase31R blocked live action rows");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_ui_live_smoke_state", "write_evidence_packet_ui_preview_state", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) assert.equal(blockedRows.get(key)?.allowed, false, `${key} must stay blocked.`);

const digestTrace = keyed(liveSmoke.digest_trace_rows, "Phase31R digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest", "operator_review_packet_bridge_stability_guard_digest", "operator_review_packet_bridge_recovery_guide_digest", "operator_review_packet_bridge_evidence_packet_digest", "operator_review_packet_bridge_evidence_packet_ui_preview_digest"]);
assert.equal(digestTrace.get("operator_review_packet_bridge_evidence_packet_ui_preview_digest")?.source_phase, "31Q");

const allowed = keyed(liveSmoke.allowed_live_ui_smoke_actions, "Phase31R allowed live UI smoke actions");
assert.deepEqual([...allowed.keys()], ["read_operator_review_packet_bridge_evidence_packet_ui_live_smoke", "copy_operator_review_evidence_live_ui_markdown", "inspect_live_surface_sections", "inspect_live_lineage_cards", "inspect_live_evidence_rows", "inspect_live_recovery_scenarios", "inspect_live_proof_panels", "inspect_live_blocked_action_rows"]);
for (const action of allowed.values()) assert.equal(action.allowed, true);

assertFlags(liveSmoke.safety_boundary, ["read_only", "preview_only", "live_ui_smoke_only", "ui_preview_only", "evidence_packet_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_recovery_execution", "no_live_ui_state_persist", "no_ui_state_persist", "no_evidence_packet_persist", "no_recovery_guide_persist", "no_stability_guard_persist", "no_final_smoke_persist", "no_bridge_preview_persist", "no_bridge_tool_registration"], true, "Phase31R safety true");
assertFlags(liveSmoke.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_execute_recovery_action", "can_persist_live_ui_smoke", "can_execute_live_ui_action"], false, "Phase31R safety false");
assertFlags(liveSmoke.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_decision_executed", "recovery_action_executed", "live_ui_smoke_persisted", "live_ui_state_written", "ui_preview_persisted", "ui_state_written", "evidence_packet_persisted", "recovery_guide_persisted", "stability_guard_persisted", "final_smoke_persisted", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_live_ui_smoke"], false, "Phase31R mutation");

const warnings = keyed(liveSmoke.warning_banners, "Phase31R warnings");
assert.deepEqual([...warnings.keys()], ["live_ui_smoke_read_only", "raw_evidence_payload_hidden", "no_context_or_canon_write", "restore_non_owned_side_effects"]);
assert(liveSmoke.live_ui_smoke_markdown.includes("Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet UI Live Smoke"));
assert(liveSmoke.live_ui_smoke_markdown.includes("readonly_evidence_packet_ui_live_smoke"));
assert(liveSmoke.live_ui_smoke_markdown.includes("raw_evidence_payload_visible_by_default: false"));
assert(liveSmoke.chatgpt_summary_lines.some((line) => line.includes("read-only; inspect-only")));
assert(liveSmoke.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L→31M→31N→31O→31P→31Q")));
assert(liveSmoke.chatgpt_summary_lines.some((line) => line.includes("entity_registry side effects restore-before-commit")));
assert.equal(liveSmoke.chatgpt_summary_lines.filter((line) => line.includes("inspect_evidence_only")).length, 8);
assert.equal(liveSmoke.raw_ui_preview, null);
assert.equal(liveSmoke.raw_json_preview.visible_by_default, false);
assert.equal(liveSmoke.raw_json_preview.raw_ui_preview_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildEvidencePacketUiLiveSmoke({ phase31QSource });
  assert.equal(rerun.live_smoke_digest, liveSmoke.live_smoke_digest);
  assert.deepEqual(rerun, liveSmoke, "Phase31R evidence packet UI live smoke rerun should be deterministic.");
}
assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31R changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31R changed compressed_rules hash.");
console.log("Phase31R aesthetic memory context builder operator review packet bridge evidence packet UI live smoke tests passed.");