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
const phase31OPath = path.join(root, "tests", "phase31", "phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs");

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
    "tests/phase31/phase31p-aesthetic-memory-context-builder-operator-review-packet-bridge-evidence-packet.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(text.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) assert(text.indexOf(ordered[index]) < text.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
}
function assertTokens(source, tokens, label) {
  for (const token of tokens) assert(source.includes(token), `${label} missing ${token}`);
}
function assertFlags(target, keys, expected, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], expected, `${label} ${key} drifted`);
}

function buildEvidencePacket({ phase31LSource, phase31MSource, phase31NSource, phase31OSource }) {
  const source31LDigest = hash(phase31LSource);
  const source31MDigest = hash(phase31MSource);
  const source31NDigest = hash(phase31NSource);
  const source31ODigest = hash(phase31OSource);
  const sourceArtifacts = [
    { key: "phase31l_bridge_preview_source", source_phase: "31L", digest: source31LDigest, evidence_role: "bridge_preview_contract" },
    { key: "phase31m_final_smoke_source", source_phase: "31M", digest: source31MDigest, evidence_role: "final_smoke_contract" },
    { key: "phase31n_stability_guard_source", source_phase: "31N", digest: source31NDigest, evidence_role: "stability_guard_contract" },
    { key: "phase31o_recovery_guide_source", source_phase: "31O", digest: source31ODigest, evidence_role: "recovery_guide_contract" },
  ];
  const recoveryScenarioKeys = [
    "digest_drift_recovery",
    "row_order_drift_recovery",
    "summary_line_drift_recovery",
    "raw_exposure_recovery",
    "blocked_action_regression_recovery",
    "weak_input_regression_recovery",
    "protected_hash_drift_recovery",
    "entity_registry_side_effect_recovery",
  ];
  const recoveryScenarios = recoveryScenarioKeys.map((key, index) => ({
    key,
    source_phase: "31O",
    display_order: index + 1,
    evidence_status: "captured",
    operator_recovery_execution_allowed: false,
  }));
  const blockedActionKeys = ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"];
  const blockedEvidence = blockedActionKeys.map((key) => ({ key, allowed: false, evidence_status: "blocked" }));
  const digestTraceRows = [
    { key: "builder_readiness_digest", source_phase: "31E" },
    { key: "surface_digest", source_phase: "31F" },
    { key: "bridge_preview_digest", source_phase: "31G" },
    { key: "operator_packet_digest", source_phase: "31J" },
    { key: "operator_review_ui_surface_digest", source_phase: "31K" },
    { key: "operator_review_packet_bridge_preview_digest", source_phase: "31L", source_digest: source31LDigest },
    { key: "operator_review_packet_bridge_final_smoke_digest", source_phase: "31M", source_digest: source31MDigest },
    { key: "operator_review_packet_bridge_stability_guard_digest", source_phase: "31N", source_digest: source31NDigest },
    { key: "operator_review_packet_bridge_recovery_guide_digest", source_phase: "31O", source_digest: source31ODigest },
  ].map((row) => ({ ...row, trace_status: "traceable" }));
  const protectedHashProof = [
    { key: "active_engine_hash_proof", path: "data/canon_db/active_engine.md", expected_hash: expectedActiveEngineHash, proof_status: "unchanged" },
    { key: "compressed_rules_hash_proof", path: "data/error_report_db/compressed_rules.md", expected_hash: expectedCompressedRulesHash, proof_status: "unchanged" },
  ];
  const sideEffectRestorationProof = [
    { key: "entity_registry_restore_before_commit", path: "data/entity_registry", evidence_status: "restore_required_when_dirty", verification_command: "git status --short", commit_allowed: false },
    { key: "protected_runtime_paths_unchanged", path: "data/outputs/logs/policy_imports.jsonl", evidence_status: "unchanged", verification_command: "npm run test:mcp", commit_allowed: false },
  ];
  const evidenceRows = [
    { key: "source_lineage_evidence", evidence_kind: "source_digest_lineage", evidence_status: "captured", source_count: sourceArtifacts.length },
    { key: "recovery_scenario_evidence", evidence_kind: "operator_recovery_scenarios", evidence_status: "captured", source_count: recoveryScenarios.length },
    { key: "blocked_action_evidence", evidence_kind: "blocked_action_matrix", evidence_status: "captured", source_count: blockedEvidence.length },
    { key: "protected_hash_evidence", evidence_kind: "protected_hash_proof", evidence_status: "captured", source_count: protectedHashProof.length },
    { key: "side_effect_restoration_evidence", evidence_kind: "side_effect_restoration_proof", evidence_status: "captured", source_count: sideEffectRestorationProof.length },
    { key: "raw_payload_hidden_evidence", evidence_kind: "raw_payload_visibility", evidence_status: "captured", raw_visible_by_default: false },
    { key: "manual_only_policy_evidence", evidence_kind: "manual_recovery_policy", evidence_status: "captured", can_execute_recovery: false },
    { key: "deterministic_rerun_evidence", evidence_kind: "deterministic_packet_digest", evidence_status: "captured", rerun_required: true },
  ].map((row, index) => ({
    ...row,
    display_order: index + 1,
    packet_action: "inspect_evidence_only",
    can_execute_evidence: false,
    can_mutate_context: false,
    can_write_canon: false,
    can_update_active_engine: false,
    can_update_compressed_rules: false,
    can_register_mcp_tool: false,
  }));
  const cards = [
    { key: "evidence_packet_overall", value: "ready", status: "ready" },
    { key: "source_artifacts", value: String(sourceArtifacts.length), status: "ready" },
    { key: "recovery_scenarios", value: String(recoveryScenarios.length), status: "ready" },
    { key: "digest_trace", value: "31E→31F→31G→31J→31K→31L→31M→31N→31O", status: "traceable" },
    { key: "protected_hash_proof", value: "2", status: "unchanged" },
    { key: "side_effect_restoration_proof", value: "2", status: "ready" },
    { key: "raw_evidence_payload", value: "hidden_by_default", status: "collapsed" },
    { key: "execution_policy", value: "evidence_read_only", status: "blocked_execution" },
  ];
  const warnings = [
    { key: "evidence_packet_read_only", severity: "info", message: "Evidence packet is read-only and inspect-only." },
    { key: "no_context_or_canon_write", severity: "info", message: "Evidence packet will not build context, write Canon, update active_engine, or update compressed_rules." },
    { key: "no_mcp_tool_registration", severity: "info", message: "Evidence packet does not register MCP tools or write bridge state." },
    { key: "restore_non_owned_side_effects", severity: "info", message: "Non-owned entity_registry side effects must be restored before commit." },
  ];
  const allowedActions = ["read_operator_review_packet_bridge_evidence_packet", "copy_operator_review_evidence_markdown", "inspect_evidence_rows", "inspect_source_artifacts", "inspect_recovery_scenarios", "inspect_digest_trace_rows", "inspect_protected_hash_proof", "inspect_side_effect_restoration_proof"].map((key) => ({ key, allowed: true }));
  const safety = {
    read_only: true,
    preview_only: true,
    evidence_packet_only: true,
    manual_recovery_guide_only: true,
    no_context_build: true,
    no_context_attach: true,
    no_context_mutation: true,
    no_operator_decision_execute: true,
    no_recovery_execution: true,
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
    can_persist_evidence_packet: false,
    can_execute_evidence_action: false,
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
    evidence_packet_persisted: false,
    evidence_packet_state_written: false,
    recovery_guide_persisted: false,
    stability_guard_persisted: false,
    final_smoke_persisted: false,
    bridge_preview_persisted: false,
    bridge_state_written: false,
    bridge_tool_registered: false,
    context_built_from_evidence_packet: false,
  };
  const summary = [
    "Operator review packet bridge evidence packet: ready; read-only; inspect-only; no build/attach/mutate/persist/execute/register.",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O",
    `source_phase31l_digest: ${source31LDigest}`,
    `source_phase31m_digest: ${source31MDigest}`,
    `source_phase31n_digest: ${source31NDigest}`,
    `source_phase31o_digest: ${source31ODigest}`,
    "active_engine hash unchanged",
    "compressed_rules hash unchanged",
    "entity_registry side effects restore-before-commit",
    ...evidenceRows.map((row) => `${row.key}: inspect_evidence_only; execute=false; mutate=false; write=false; register=false`),
    `blocked_evidence_actions=${blockedEvidence.length}`,
  ];
  const markdown = [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet",
    "",
    "packet_status: ready",
    "packet_mode: readonly_evidence_packet",
    "digest_trace: 31E→31F→31G→31J→31K→31L→31M→31N→31O",
    "will_persist_evidence_packet: false",
    "will_execute_recovery_action: false",
    "will_build_context_now: false",
    "will_write_canon: false",
    "will_update_active_engine: false",
    "will_update_compressed_rules: false",
    "will_register_mcp_tool: false",
  ].join("\n");
  const packetDigest = hash(stableJson({ sourceArtifacts, recoveryScenarios, blockedEvidence, digestTraceRows, protectedHashProof, sideEffectRestorationProof, evidenceRows, cards, warnings, allowedActions, safety, mutation, summary, markdown }));
  return {
    used: true,
    phase: "31P",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_v1",
    packet_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet",
    packet_channel: "chatgpt_bridge_context_builder_operator_review_evidence_packet",
    packet_mode: "readonly_evidence_packet",
    packet_status: "ready",
    source_phase: "31O",
    source_guarded_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide",
    source_phase31l_source_digest: source31LDigest,
    source_phase31m_source_digest: source31MDigest,
    source_phase31n_source_digest: source31NDigest,
    source_phase31o_source_digest: source31ODigest,
    evidence_packet_digest: packetDigest,
    can_display_evidence_packet: true,
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
    evidence_packet_cards: cards,
    source_artifacts: sourceArtifacts,
    recovery_scenarios: recoveryScenarios,
    evidence_rows: evidenceRows,
    digest_trace_rows: digestTraceRows,
    protected_hash_proof: protectedHashProof,
    side_effect_restoration_proof: sideEffectRestorationProof,
    warning_banners: warnings,
    chatgpt_summary_lines: summary,
    evidence_packet_markdown: markdown,
    allowed_evidence_actions: allowedActions,
    blocked_evidence_actions: blockedEvidence,
    safety_boundary: safety,
    no_mutation_snapshot: mutation,
    raw_recovery_guide: null,
    raw_json_preview: { visible_by_default: false, raw_recovery_guide_included: false },
  };
}

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31P active_engine hash baseline drifted before test.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31P compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));
await import(new URL("./phase31o-aesthetic-memory-context-builder-operator-review-packet-bridge-recovery-guide.test.mjs", import.meta.url));

const phase31LSource = await readFile(phase31LPath, "utf8");
const phase31MSource = await readFile(phase31MPath, "utf8");
const phase31NSource = await readFile(phase31NPath, "utf8");
const phase31OSource = await readFile(phase31OPath, "utf8");

assertTokens(phase31OSource, ["buildRecoveryGuide", "aesthetic_memory_context_builder_operator_review_packet_bridge_recovery_guide_v1", "31E→31F→31G→31J→31K→31L→31M→31N", "digest_drift_recovery", "row_order_drift_recovery", "summary_line_drift_recovery", "raw_exposure_recovery", "blocked_action_regression_recovery", "weak_input_regression_recovery", "protected_hash_drift_recovery", "entity_registry_side_effect_recovery", "manual_recovery_guide_only", "hidden_by_default", "no_recovery_execution", "blocked_recovery_actions", "deterministic"], "Phase31P source recovery guide");

const packet = buildEvidencePacket({ phase31LSource, phase31MSource, phase31NSource, phase31OSource });
assert.equal(packet.used, true);
assert.equal(packet.phase, "31P");
assert.equal(packet.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet_v1");
assert.equal(packet.packet_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_evidence_packet");
assert.equal(packet.packet_channel, "chatgpt_bridge_context_builder_operator_review_evidence_packet");
assert.equal(packet.packet_mode, "readonly_evidence_packet");
assert.equal(packet.packet_status, "ready");
assert.equal(packet.source_phase, "31O");
assert.match(packet.evidence_packet_digest, /^[a-f0-9]{64}$/u);
assert.equal(packet.can_display_evidence_packet, true);
assertFlags(packet, ["will_persist_evidence_packet", "will_execute_recovery_action", "will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool", "will_write_canon", "will_update_active_engine", "will_update_compressed_rules"], false, "Phase31P top flags");

const cards = keyed(packet.evidence_packet_cards, "Phase31P cards");
assert.deepEqual([...cards.keys()], ["evidence_packet_overall", "source_artifacts", "recovery_scenarios", "digest_trace", "protected_hash_proof", "side_effect_restoration_proof", "raw_evidence_payload", "execution_policy"]);
assert.equal(cards.get("source_artifacts")?.value, "4");
assert.equal(cards.get("recovery_scenarios")?.value, "8");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K→31L→31M→31N→31O");
assert.equal(cards.get("raw_evidence_payload")?.value, "hidden_by_default");
assert.equal(cards.get("execution_policy")?.value, "evidence_read_only");

const sourceArtifacts = keyed(packet.source_artifacts, "Phase31P source artifacts");
assert.deepEqual([...sourceArtifacts.keys()], ["phase31l_bridge_preview_source", "phase31m_final_smoke_source", "phase31n_stability_guard_source", "phase31o_recovery_guide_source"]);
for (const artifact of sourceArtifacts.values()) assert.match(artifact.digest, /^[a-f0-9]{64}$/u);

const scenarios = keyed(packet.recovery_scenarios, "Phase31P recovery scenarios");
assert.deepEqual([...scenarios.keys()], ["digest_drift_recovery", "row_order_drift_recovery", "summary_line_drift_recovery", "raw_exposure_recovery", "blocked_action_regression_recovery", "weak_input_regression_recovery", "protected_hash_drift_recovery", "entity_registry_side_effect_recovery"]);
for (const scenario of scenarios.values()) assert.equal(scenario.operator_recovery_execution_allowed, false);

const rows = keyed(packet.evidence_rows, "Phase31P evidence rows");
assert.deepEqual([...rows.keys()], ["source_lineage_evidence", "recovery_scenario_evidence", "blocked_action_evidence", "protected_hash_evidence", "side_effect_restoration_evidence", "raw_payload_hidden_evidence", "manual_only_policy_evidence", "deterministic_rerun_evidence"]);
for (const row of rows.values()) {
  assert.equal(row.packet_action, "inspect_evidence_only");
  assert.equal(row.can_execute_evidence, false);
  assert.equal(row.can_mutate_context, false);
  assert.equal(row.can_write_canon, false);
  assert.equal(row.can_update_active_engine, false);
  assert.equal(row.can_update_compressed_rules, false);
  assert.equal(row.can_register_mcp_tool, false);
}

const digestTrace = keyed(packet.digest_trace_rows, "Phase31P digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest", "operator_review_packet_bridge_preview_digest", "operator_review_packet_bridge_final_smoke_digest", "operator_review_packet_bridge_stability_guard_digest", "operator_review_packet_bridge_recovery_guide_digest"]);
assert.equal(digestTrace.get("operator_review_packet_bridge_recovery_guide_digest")?.source_phase, "31O");

const protectedHashProof = keyed(packet.protected_hash_proof, "Phase31P protected hash proof");
assert.equal(protectedHashProof.get("active_engine_hash_proof")?.expected_hash, expectedActiveEngineHash);
assert.equal(protectedHashProof.get("compressed_rules_hash_proof")?.expected_hash, expectedCompressedRulesHash);
for (const proof of protectedHashProof.values()) assert.equal(proof.proof_status, "unchanged");

const sideEffectProof = keyed(packet.side_effect_restoration_proof, "Phase31P side effect proof");
assert.equal(sideEffectProof.get("entity_registry_restore_before_commit")?.path, "data/entity_registry");
assert.equal(sideEffectProof.get("entity_registry_restore_before_commit")?.commit_allowed, false);
assert.equal(sideEffectProof.get("protected_runtime_paths_unchanged")?.verification_command, "npm run test:mcp");

const warnings = keyed(packet.warning_banners, "Phase31P warnings");
assert.deepEqual([...warnings.keys()], ["evidence_packet_read_only", "no_context_or_canon_write", "no_mcp_tool_registration", "restore_non_owned_side_effects"]);
const allowed = keyed(packet.allowed_evidence_actions, "Phase31P allowed actions");
assert.deepEqual([...allowed.keys()], ["read_operator_review_packet_bridge_evidence_packet", "copy_operator_review_evidence_markdown", "inspect_evidence_rows", "inspect_source_artifacts", "inspect_recovery_scenarios", "inspect_digest_trace_rows", "inspect_protected_hash_proof", "inspect_side_effect_restoration_proof"]);
for (const action of allowed.values()) assert.equal(action.allowed, true);
const blocked = keyed(packet.blocked_evidence_actions, "Phase31P blocked actions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_evidence_packet_state", "write_recovery_guide_state", "write_stability_guard_state", "write_final_smoke_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked.`);

assertFlags(packet.safety_boundary, ["read_only", "preview_only", "evidence_packet_only", "manual_recovery_guide_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_recovery_execution", "no_evidence_packet_persist", "no_recovery_guide_persist", "no_stability_guard_persist", "no_final_smoke_persist", "no_bridge_preview_persist", "no_bridge_tool_registration"], true, "Phase31P safety true");
assertFlags(packet.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_execute_recovery_action", "can_persist_evidence_packet", "can_execute_evidence_action"], false, "Phase31P safety false");
assertFlags(packet.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_decision_executed", "recovery_action_executed", "evidence_packet_persisted", "evidence_packet_state_written", "recovery_guide_persisted", "stability_guard_persisted", "final_smoke_persisted", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_evidence_packet"], false, "Phase31P mutation");

assert(packet.evidence_packet_markdown.includes("Aesthetic Memory Context Builder Operator Review Packet Bridge Evidence Packet"));
assert(packet.evidence_packet_markdown.includes("readonly_evidence_packet"));
assert(packet.evidence_packet_markdown.includes("will_persist_evidence_packet: false"));
assert(packet.chatgpt_summary_lines.some((line) => line.includes("read-only; inspect-only")));
assert(packet.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K→31L→31M→31N→31O")));
assert(packet.chatgpt_summary_lines.some((line) => line.includes("active_engine hash unchanged")));
assert(packet.chatgpt_summary_lines.some((line) => line.includes("entity_registry side effects restore-before-commit")));
assert.equal(packet.chatgpt_summary_lines.filter((line) => line.includes("inspect_evidence_only")).length, 8);
assert.equal(packet.raw_recovery_guide, null);
assert.equal(packet.raw_json_preview.visible_by_default, false);
assert.equal(packet.raw_json_preview.raw_recovery_guide_included, false);

for (let index = 0; index < 3; index += 1) {
  const rerun = buildEvidencePacket({ phase31LSource, phase31MSource, phase31NSource, phase31OSource });
  assert.equal(rerun.evidence_packet_digest, packet.evidence_packet_digest);
  assert.deepEqual(rerun, packet, "Phase31P evidence packet rerun should be deterministic.");
}
assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31P changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31P changed compressed_rules hash.");
console.log("Phase31P aesthetic memory context builder operator review packet bridge evidence packet tests passed.");

