import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import { buildAestheticMemoryBridgePreview } from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";
import {
  aestheticMemoryInjectionReadinessGateVersion,
  buildAestheticMemoryInjectionReadinessGate,
} from "../../server/src/aesthetic-memory-injection-readiness-gate-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const gatePath = path.join(root, "server", "src", "aesthetic-memory-injection-readiness-gate-service.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
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
  const phase30c = "tests/phase30/phase30c-aesthetic-memory-bridge-preview.test.mjs";
  const phase31a = "tests/phase31/phase31a-aesthetic-memory-injection-readiness-gate.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase30c), "run-all missing Phase 30C predecessor.");
  assert(runAllText.includes(phase31a), "run-all missing Phase 31A aesthetic memory injection readiness gate.");
  assert(runAllText.indexOf(phase30c) < runAllText.indexOf(phase31a), "Phase 31A should run after Phase 30C.");
  assert(runAllText.indexOf(phase31a) < runAllText.indexOf(daily), "Phase 31A should run before Daily scripts and docs.");
}

function assertStaticGateTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_injection_readiness_gate",
    "readonly_injection_readiness",
    "injection_targets",
    "target_readiness",
    "readiness_cards",
    "allowed_gate_actions",
    "blocked_injection_capabilities",
    "materialize_context_injection",
    "no_context_mutation",
    "can_materialize_context_injection",
    "context_mutated",
    "injection_materialized",
    "memory_file_written",
    "can_write_canon",
    "can_update_active_engine",
    "can_register_mcp_tool",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory injection readiness gate missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31A active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31A compressed_rules hash baseline drifted before test.");

const [runAllText, gateText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(gatePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticGateTokens(gateText);
assert.equal(aestheticMemoryInjectionReadinessGateVersion, "aesthetic_memory_injection_readiness_gate_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31A aesthetic memory injection readiness gate smoke.",
  accepted_patterns: [
    "讓角色用行動暴露情緒，而不是直接講主題。",
    "用場景物件承接代價與壓力。",
  ],
  rejected_patterns: [
    "公告式總結",
    "流程化交接",
  ],
  style_principles: [
    "普通行動先直寫，幽默只能加味。",
  ],
  ui_preferences: [
    "UI 要顯示成人話摘要，而不是只給 JSON。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_reader_pressure",
      category: "reader_experience",
      polarity: "prefer",
      label: "讓讀者想追下去",
      rule: "章尾留下具體未解壓力，而不是作者總結。",
      rationale: "長篇節奏需要一章一變局與追讀壓力。",
      strength: 95,
      applies_to: ["reader_response", "final_polisher"],
      examples: ["門內有人先一步喊出千夜的名字。"],
    },
  ],
});
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const preview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const gate = await buildAestheticMemoryInjectionReadinessGate({ preview, include_raw: false });

assert.equal(gate.used, true);
assert.equal(gate.phase, "31A");
assert.equal(gate.version, aestheticMemoryInjectionReadinessGateVersion);
assert.equal(gate.gate_kind, "aesthetic_memory_injection_readiness_gate");
assert.equal(gate.gate_channel, "internal_pipeline_preflight");
assert.equal(gate.gate_mode, "readonly_injection_readiness");
assert.equal(gate.source_phase, "30C");
assert.equal(gate.source_bridge_kind, "aesthetic_memory_bridge_preview");
assert.match(gate.source_preview_digest, /^[a-f0-9]{64}$/u);
assert.match(gate.gate_digest, /^[a-f0-9]{64}$/u);
assert.equal(gate.readiness_status, "ready");
assert.equal(gate.can_attach_readonly_context, true);
assert.equal(gate.will_attach_context_now, false);
assert.equal(gate.will_mutate_context, false);
assert(gate.injection_readiness_score >= 76, "Phase31A ready gate should have usable readiness score.");
assert.match(gate.surface_markdown, /Aesthetic Memory Injection Readiness Gate/u);
assert.match(gate.surface_markdown, /can_attach_readonly_context: true/u);
assert.match(gate.surface_markdown, /can_write_canon: false/u);
assert.match(gate.surface_markdown, /memory_file_written: false/u);
assert.equal(gate.raw_preview, null);
assert.equal(gate.raw_json_preview.visible_by_default, false);
assert.equal(gate.raw_json_preview.raw_preview_included, false);

const targets = keyed(gate.injection_targets, "injection targets");
assert.deepEqual(
  [...targets.keys()],
  [
    "writing_context",
    "revision_context",
    "final_polisher_context",
    "reader_response_simulator_context",
  ],
  "Phase31A injection target order drifted.",
);
assert.equal(targets.get("writing_context")?.payload_key, "generation_payload_key");
assert.equal(targets.get("revision_context")?.payload_key, "revision_payload_key");
assert.equal(targets.get("final_polisher_context")?.payload_key, "final_polisher_payload_key");
assert.equal(targets.get("reader_response_simulator_context")?.payload_key, "reader_response_payload_key");

const targetReadiness = keyed(gate.target_readiness, "target readiness");
for (const key of targets.keys()) {
  const target = targetReadiness.get(key);
  assert.equal(target?.status, "ready", `${key} should be ready for read-only context attachment.`);
  assert.equal(target?.can_attach_readonly_context, true, `${key} should allow read-only context attachment.`);
  assert.equal(target?.will_mutate_context, false, `${key} must not mutate context.`);
  assert.deepEqual(target?.blockers, [], `${key} should have no blockers.`);
  assert.deepEqual(target?.warnings, [], `${key} should have no warnings.`);
}

const cards = keyed(gate.readiness_cards, "readiness cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "aesthetic_memory_injection_overall",
    "writing_context",
    "revision_context",
    "final_polisher_context",
    "reader_response_simulator_context",
    "safety_boundary",
  ],
  "Phase31A readiness card order drifted.",
);
assert.equal(cards.get("aesthetic_memory_injection_overall")?.tone, "ready");
assert.equal(cards.get("safety_boundary")?.value, "clean");

assert(gate.chatgpt_summary_lines.some((line) => line.includes("審美記憶注入前檢查")));
assert(gate.chatgpt_summary_lines.some((line) => line.includes("writing_context=ready")));
assert(gate.chatgpt_summary_lines.some((line) => line.includes("不實際注入 context")));
assert.equal(gate.safety_issues.length, 0);

const allowed = keyed(gate.allowed_gate_actions, "allowed gate actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_injection_readiness_summary",
    "copy_injection_readiness_markdown",
    "inspect_source_aesthetic_memory_bridge_preview",
    "inspect_target_readiness_map",
  ],
  "Phase31A allowed gate actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(gate.blocked_injection_capabilities, "blocked injection capabilities");
for (const key of [
  "generate_text",
  "revise_text",
  "save_candidate",
  "approve",
  "confirm_adoption",
  "write_canon",
  "update_active_engine",
  "update_compressed_rules",
  "modify_runtime_ui",
  "register_mcp_tool",
  "write_memory_file",
  "materialize_context_injection",
  "mutate_writing_context",
  "mutate_revision_context",
  "mutate_final_polisher_context",
  "mutate_reader_response_context",
]) {
  assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked.`);
}

for (const key of [
  "read_only",
  "preview_only",
  "candidate_only",
  "no_generation",
  "no_auto_persist",
  "no_candidate_save",
  "no_approval",
  "no_canon_update",
  "no_active_engine_update",
  "no_compressed_rules_update",
  "no_runtime_ui_mutation",
  "no_mcp_tool_added",
  "no_memory_file_write",
  "no_context_mutation",
]) {
  assert.equal(gate.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
}
for (const key of [
  "can_write_canon",
  "can_update_active_engine",
  "can_update_compressed_rules",
  "can_modify_runtime_ui",
  "can_register_mcp_tool",
  "can_save_candidate",
  "can_approve",
  "can_confirm_adoption",
  "can_write_memory_file",
  "can_materialize_context_injection",
]) {
  assert.equal(gate.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
}
for (const key of [
  "active_engine_modified",
  "compressed_rules_modified",
  "candidate_saved",
  "canon_written",
  "approval_item_created",
  "runtime_ui_modified",
  "mcp_tool_added",
  "mcp_tool_registered",
  "memory_file_written",
  "context_mutated",
  "injection_materialized",
]) {
  assert.equal(gate.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawGate = await buildAestheticMemoryInjectionReadinessGate({ preview, include_raw: true, include_markdown: false });
assert.equal(rawGate.raw_preview.phase, "30C");
assert.equal(rawGate.raw_json_preview.raw_preview_included, true);
assert.equal(rawGate.surface_markdown, "");

const deterministic = await buildAestheticMemoryInjectionReadinessGate({ preview, include_raw: false });
assert.deepEqual(deterministic, gate, "Phase31A injection readiness gate should be deterministic for the same preview.");

const weakGate = await buildAestheticMemoryInjectionReadinessGate({ include_default_seed: false });
assert.equal(weakGate.readiness_status, "needs_context");
assert.equal(weakGate.can_attach_readonly_context, false);
assert.equal(weakGate.safety_boundary.no_active_engine_update, true);
assert.equal(weakGate.safety_boundary.can_write_canon, false);
assert.equal(weakGate.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakGate.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakGate.no_mutation_snapshot.context_mutated, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31A changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31A changed compressed_rules hash.");

console.log("Phase31A aesthetic memory injection readiness gate tests passed.");

