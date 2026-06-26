import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import { buildAestheticMemoryBridgePreview } from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";
import { buildAestheticMemoryInjectionReadinessGate } from "../../server/src/aesthetic-memory-injection-readiness-gate-service.mjs";
import { buildAestheticMemoryContextAdapterPreview } from "../../server/src/aesthetic-memory-context-adapter-preview-service.mjs";
import { buildAestheticMemoryContextAdapterBridgePreview } from "../../server/src/aesthetic-memory-context-adapter-bridge-preview-service.mjs";
import {
  aestheticMemoryContextBuilderReadinessGateVersion,
  buildAestheticMemoryContextBuilderReadinessGate,
} from "../../server/src/aesthetic-memory-context-builder-readiness-gate-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const servicePath = path.join(root, "server", "src", "aesthetic-memory-context-builder-readiness-gate-service.mjs");
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
  const phase31d = "tests/phase31/phase31d-aesthetic-memory-context-adapter-final-smoke.test.mjs";
  const phase31e = "tests/phase31/phase31e-aesthetic-memory-context-builder-readiness-gate.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31d), "run-all missing Phase 31D predecessor.");
  assert(runAllText.includes(phase31e), "run-all missing Phase 31E context builder readiness gate.");
  assert(runAllText.indexOf(phase31d) < runAllText.indexOf(phase31e), "Phase 31E should run after Phase 31D.");
  assert(runAllText.indexOf(phase31e) < runAllText.indexOf(daily), "Phase 31E should run before Daily scripts and docs.");
}

function assertStaticServiceTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_context_builder_readiness_gate",
    "readonly_builder_readiness",
    "internal_pipeline_context_builder_preflight",
    "context_builder_targets",
    "builder_readiness",
    "builder_payload_preview",
    "builder_payload_digest",
    "writing_context.aesthetic_memory",
    "revision_context.aesthetic_memory",
    "final_polisher_context.aesthetic_memory",
    "reader_response_context.aesthetic_memory",
    "writing_context_builder",
    "revision_context_builder",
    "final_polisher_context_builder",
    "reader_response_context_builder",
    "build_generation_context",
    "build_revision_context",
    "build_final_polisher_context",
    "build_reader_response_context",
    "no_context_build",
    "no_context_attach",
    "no_builder_payload_persist",
    "can_build_generation_context",
    "can_register_context_builder_mcp_tool",
    "context_built",
    "context_attached",
    "builder_payload_persisted",
    "builder_tool_registered",
  ]) {
    assert(serviceText.includes(token), `context builder readiness gate missing static token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31E active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31E compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticServiceTokens(serviceText);
assert.equal(aestheticMemoryContextBuilderReadinessGateVersion, "aesthetic_memory_context_builder_readiness_gate_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31E aesthetic memory context builder readiness gate smoke.",
  accepted_patterns: [
    "角色要先像活人，才像設定。",
    "用場景物件承接壓力，而不是角色排隊說明。",
  ],
  rejected_patterns: [
    "公告式總結",
    "主題先行",
    "流程化交接",
  ],
  style_principles: [
    "一章一變局。",
    "普通行動先直寫，幽默只能加味。",
  ],
  ui_preferences: [
    "Builder readiness 要看得出不會真的 build context。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_readiness_gate",
      category: "context_builder",
      polarity: "prefer",
      label: "Context builder 需要 readiness gate",
      rule: "真正接入 writing/revision/final_polisher/reader_response context builder 之前，必須先有只讀 readiness gate。",
      rationale: "Phase31E 是 build 前 preflight，不是 runtime builder。",
      strength: 97,
      applies_to: ["writing_context", "revision_context", "final_polisher_context", "reader_response_context"],
      examples: ["writing_context_builder/writing_context.aesthetic_memory=ready，但 will_build_context_now=false。"],
    },
  ],
});
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const gate31a = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: gate31a, include_raw: false });
const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
const builderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });

assert.equal(builderGate.used, true);
assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.version, aestheticMemoryContextBuilderReadinessGateVersion);
assert.equal(builderGate.gate_kind, "aesthetic_memory_context_builder_readiness_gate");
assert.equal(builderGate.gate_channel, "internal_pipeline_context_builder_preflight");
assert.equal(builderGate.gate_mode, "readonly_builder_readiness");
assert.equal(builderGate.source_phase, "31C");
assert.equal(builderGate.source_bridge_kind, "aesthetic_memory_context_adapter_bridge_preview");
assert.match(builderGate.source_bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.match(builderGate.builder_readiness_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderGate.source_bridge_preview_digest, adapterBridge.bridge_preview_digest);
assert.equal(builderGate.builder_readiness_status, "ready");
assert.equal(builderGate.can_build_readonly_context_preview, true);
assert.equal(builderGate.will_build_context_now, false);
assert.equal(builderGate.will_attach_context_now, false);
assert.equal(builderGate.will_mutate_context, false);
assert.equal(builderGate.builder_payload_persisted, false);
assert.equal(builderGate.raw_bridge_preview, null);
assert.equal(builderGate.raw_json_preview.visible_by_default, false);
assert.equal(builderGate.raw_json_preview.raw_bridge_preview_included, false);
assert.match(builderGate.surface_markdown, /Aesthetic Memory Context Builder Readiness Gate/u);
assert.match(builderGate.surface_markdown, /will_build_context_now: false/u);
assert.match(builderGate.surface_markdown, /context_mutated: false/u);
assert.match(builderGate.surface_markdown, /builder_payload_persisted_snapshot: false/u);

const targets = keyed(builderGate.context_builder_targets, "context builder targets");
assert.deepEqual(
  [...targets.keys()],
  [
    "writing_context_builder_readiness",
    "revision_context_builder_readiness",
    "final_polisher_context_builder_readiness",
    "reader_response_context_builder_readiness",
  ],
  "Phase31E context builder target order drifted.",
);

const readiness = keyed(builderGate.builder_readiness, "builder readiness");
assert.deepEqual([...readiness.keys()], [...targets.keys()], "Builder readiness keys should match targets.");
for (const item of readiness.values()) {
  assert.equal(item.status, "ready", `${item.key} should be ready.`);
  assert.equal(item.can_build_readonly_context_preview, true, `${item.key} should be preview buildable.`);
  assert.equal(item.will_build_context_now, false, `${item.key} must not build now.`);
  assert.equal(item.will_attach_context_now, false, `${item.key} must not attach now.`);
  assert.equal(item.will_mutate_context, false, `${item.key} must not mutate context.`);
  assert.equal(item.will_persist_builder_payload, false, `${item.key} must not persist builder payload.`);
  assert.match(item.builder_payload_digest, /^[a-f0-9]{64}$/u);
  assert.equal(item.builder_payload_preview.source_bridge_preview_digest, adapterBridge.bridge_preview_digest);
  assert.equal(item.builder_payload_preview.readiness_status, "ready");
  assert.equal(item.builder_payload_preview.safety_note.includes("not passed"), true);
}

assert.equal(readiness.get("writing_context_builder_readiness")?.builder_key, "writing_context_builder");
assert.equal(readiness.get("writing_context_builder_readiness")?.builder_context_path, "writing_context.aesthetic_memory");
assert.equal(readiness.get("revision_context_builder_readiness")?.builder_key, "revision_context_builder");
assert.equal(readiness.get("revision_context_builder_readiness")?.builder_context_path, "revision_context.aesthetic_memory");
assert.equal(readiness.get("final_polisher_context_builder_readiness")?.builder_key, "final_polisher_context_builder");
assert.equal(readiness.get("final_polisher_context_builder_readiness")?.builder_context_path, "final_polisher_context.aesthetic_memory");
assert.equal(readiness.get("reader_response_context_builder_readiness")?.builder_key, "reader_response_context_builder");
assert.equal(readiness.get("reader_response_context_builder_readiness")?.builder_context_path, "reader_response_context.aesthetic_memory");

const cards = keyed(builderGate.readiness_cards, "readiness cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "context_builder_readiness_overall",
    "writing_context_builder_readiness",
    "revision_context_builder_readiness",
    "final_polisher_context_builder_readiness",
    "reader_response_context_builder_readiness",
    "safety_boundary",
  ],
  "Phase31E readiness card order drifted.",
);
assert.equal(cards.get("context_builder_readiness_overall")?.tone, "ready");
assert.equal(cards.get("safety_boundary")?.value, "clean");
assert.deepEqual(builderGate.safety_issues, []);

assert(builderGate.chatgpt_summary_lines.some((line) => line.includes("builder readiness")));
assert(builderGate.chatgpt_summary_lines.some((line) => line.includes("writing_context_builder/writing_context.aesthetic_memory=ready")));
assert(builderGate.chatgpt_summary_lines.some((line) => line.includes("不 build context")));

const allowed = keyed(builderGate.allowed_builder_gate_actions, "allowed builder gate actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_context_builder_readiness_summary",
    "copy_context_builder_readiness_markdown",
    "inspect_builder_payload_preview",
    "inspect_source_context_adapter_bridge_preview",
  ],
  "Phase31E allowed actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be an allowed read-only action.`);
}

const blocked = keyed(builderGate.blocked_builder_runtime_capabilities, "blocked builder runtime capabilities");
for (const key of [
  "generate_text",
  "revise_text",
  "save_candidate",
  "approve",
  "write_canon",
  "update_active_engine",
  "update_compressed_rules",
  "register_mcp_tool",
  "write_memory_file",
  "build_generation_context",
  "build_revision_context",
  "build_final_polisher_context",
  "build_reader_response_context",
  "materialize_context_builder",
  "materialize_context_injection",
  "attach_context_now",
  "mutate_writing_context",
  "mutate_revision_context",
  "mutate_final_polisher_context",
  "mutate_reader_response_context",
  "persist_adapter_payload",
  "persist_builder_payload",
  "register_context_builder_mcp_tool",
]) {
  assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked.`);
}

for (const key of [
  "read_only",
  "preview_only",
  "candidate_only",
  "no_generation",
  "no_revision",
  "no_auto_persist",
  "no_candidate_save",
  "no_approval",
  "no_canon_update",
  "no_active_engine_update",
  "no_compressed_rules_update",
  "no_runtime_ui_mutation",
  "no_mcp_tool_added",
  "no_memory_file_write",
  "no_context_build",
  "no_context_attach",
  "no_context_mutation",
  "no_materialized_context_injection",
  "no_adapter_payload_persist",
  "no_builder_payload_persist",
  "no_builder_tool_registration",
]) {
  assert.equal(builderGate.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
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
  "can_build_generation_context",
  "can_build_revision_context",
  "can_build_final_polisher_context",
  "can_build_reader_response_context",
  "can_materialize_context_injection",
  "can_attach_context_now",
  "can_persist_adapter_payload",
  "can_persist_builder_payload",
  "can_register_context_builder_mcp_tool",
]) {
  assert.equal(builderGate.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
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
  "context_built",
  "context_attached",
  "context_mutated",
  "injection_materialized",
  "adapter_payload_persisted",
  "builder_payload_persisted",
  "builder_tool_registered",
]) {
  assert.equal(builderGate.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: true, include_markdown: false });
assert.equal(rawGate.raw_bridge_preview.phase, "31C");
assert.equal(rawGate.raw_json_preview.raw_bridge_preview_included, true);
assert.equal(rawGate.surface_markdown, "");

const deterministic = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
assert.deepEqual(deterministic, builderGate, "Phase31E builder readiness gate should be deterministic for the same bridge preview.");

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakGate.can_build_readonly_context_preview, false);
assert.equal(weakGate.safety_boundary.no_active_engine_update, true);
assert.equal(weakGate.safety_boundary.can_write_canon, false);
assert.equal(weakGate.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakGate.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakGate.no_mutation_snapshot.context_built, false);
assert.equal(weakGate.no_mutation_snapshot.context_attached, false);
assert.equal(weakGate.no_mutation_snapshot.context_mutated, false);
assert.equal(weakGate.no_mutation_snapshot.builder_payload_persisted, false);
assert.equal(weakGate.no_mutation_snapshot.builder_tool_registered, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31E changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31E changed compressed_rules hash.");

console.log("Phase31E aesthetic memory context builder readiness gate tests passed.");

