import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import { buildAestheticMemoryBridgePreview } from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";
import { buildAestheticMemoryInjectionReadinessGate } from "../../server/src/aesthetic-memory-injection-readiness-gate-service.mjs";
import {
  aestheticMemoryContextAdapterPreviewVersion,
  buildAestheticMemoryContextAdapterPreview,
} from "../../server/src/aesthetic-memory-context-adapter-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const adapterPath = path.join(root, "server", "src", "aesthetic-memory-context-adapter-preview-service.mjs");
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
  const phase31a = "tests/phase31/phase31a-aesthetic-memory-injection-readiness-gate.test.mjs";
  const phase31b = "tests/phase31/phase31b-aesthetic-memory-context-adapter-preview.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31a), "run-all missing Phase 31A predecessor.");
  assert(runAllText.includes(phase31b), "run-all missing Phase 31B aesthetic memory context adapter preview.");
  assert(runAllText.indexOf(phase31a) < runAllText.indexOf(phase31b), "Phase 31B should run after Phase 31A.");
  assert(runAllText.indexOf(phase31b) < runAllText.indexOf(daily), "Phase 31B should run before Daily scripts and docs.");
}

function assertStaticAdapterTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_context_adapter_preview",
    "readonly_context_adapter_preview",
    "context_adapters",
    "adapter_payload_preview",
    "adapter_payload_digest",
    "writing_context.aesthetic_memory",
    "revision_context.aesthetic_memory",
    "final_polisher_context.aesthetic_memory",
    "reader_response_context.aesthetic_memory",
    "materialize_context_injection",
    "attach_context_now",
    "persist_adapter_payload",
    "no_materialized_context_injection",
    "no_adapter_payload_persist",
    "context_mutated",
    "adapter_payload_persisted",
    "can_write_canon",
    "can_update_active_engine",
    "can_register_mcp_tool",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory context adapter preview missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31B active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31B compressed_rules hash baseline drifted before test.");

const [runAllText, adapterText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(adapterPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticAdapterTokens(adapterText);
assert.equal(aestheticMemoryContextAdapterPreviewVersion, "aesthetic_memory_context_adapter_preview_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31B aesthetic memory context adapter preview smoke.",
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
    "UI 要顯示成人話摘要，而不是只給 JSON。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_final_polish_life",
      category: "final_polisher",
      polarity: "prefer",
      label: "最後潤飾要保留活人感",
      rule: "修稿不能把角色修成公告牌或流程節點。",
      rationale: "審美記憶要進入 final polisher 的前置脈絡。",
      strength: 96,
      applies_to: ["final_polisher", "revision"],
      examples: ["她不是點頭確認，而是先看了一眼杯底的冰。"],
    },
  ],
});
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const gate = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapter = await buildAestheticMemoryContextAdapterPreview({ gate, include_raw: false });

assert.equal(adapter.used, true);
assert.equal(adapter.phase, "31B");
assert.equal(adapter.version, aestheticMemoryContextAdapterPreviewVersion);
assert.equal(adapter.adapter_kind, "aesthetic_memory_context_adapter_preview");
assert.equal(adapter.adapter_channel, "internal_pipeline_context_adapter");
assert.equal(adapter.adapter_mode, "readonly_context_adapter_preview");
assert.equal(adapter.source_phase, "31A");
assert.equal(adapter.source_gate_kind, "aesthetic_memory_injection_readiness_gate");
assert.match(adapter.source_gate_digest, /^[a-f0-9]{64}$/u);
assert.match(adapter.adapter_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(adapter.preview_status, "ready");
assert.equal(adapter.can_preview_adapter_payload, true);
assert.equal(adapter.will_attach_context_now, false);
assert.equal(adapter.will_mutate_context, false);
assert.equal(adapter.adapter_payload_persisted, false);
assert.match(adapter.surface_markdown, /Aesthetic Memory Context Adapter Preview/u);
assert.match(adapter.surface_markdown, /will_attach_context_now: false/u);
assert.match(adapter.surface_markdown, /context_mutated: false/u);
assert.match(adapter.surface_markdown, /adapter_payload_persisted: false/u);
assert.equal(adapter.raw_gate, null);
assert.equal(adapter.raw_json_preview.visible_by_default, false);
assert.equal(adapter.raw_json_preview.raw_gate_included, false);

const adapters = keyed(adapter.context_adapters, "context adapters");
assert.deepEqual(
  [...adapters.keys()],
  [
    "writing_context_adapter",
    "revision_context_adapter",
    "final_polisher_context_adapter",
    "reader_response_context_adapter",
  ],
  "Phase31B context adapter order drifted.",
);
assert.equal(adapters.get("writing_context_adapter")?.context_path, "writing_context.aesthetic_memory");
assert.equal(adapters.get("revision_context_adapter")?.context_path, "revision_context.aesthetic_memory");
assert.equal(adapters.get("final_polisher_context_adapter")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(adapters.get("reader_response_context_adapter")?.context_path, "reader_response_context.aesthetic_memory");

for (const item of adapters.values()) {
  assert.equal(item.status, "ready", `${item.key} should be ready.`);
  assert.equal(item.can_preview_adapter_payload, true, `${item.key} should preview payload.`);
  assert.equal(item.can_attach_readonly_context, true, `${item.key} should allow read-only attach preview.`);
  assert.equal(item.will_attach_context_now, false, `${item.key} must not attach now.`);
  assert.equal(item.will_mutate_context, false, `${item.key} must not mutate context.`);
  assert.equal(item.materialized, false, `${item.key} must not be materialized.`);
  assert.match(item.adapter_payload_digest, /^[a-f0-9]{64}$/u);
  assert.equal(item.adapter_payload_preview.source_gate_digest, gate.gate_digest);
  assert.equal(Array.isArray(item.adapter_payload_preview.summary_lines), true);
  assert(item.adapter_payload_preview.summary_lines.some((line) => line.includes("安全")));
  assert.equal(item.adapter_payload_preview.safety_note.includes("not written"), true);
}

assert.equal(adapters.get("writing_context_adapter")?.adapter_payload_key, "aesthetic_memory_for_generation");
assert.equal(adapters.get("revision_context_adapter")?.adapter_payload_key, "aesthetic_memory_for_revision");
assert.equal(adapters.get("final_polisher_context_adapter")?.adapter_payload_key, "aesthetic_memory_for_final_polisher");
assert.equal(adapters.get("reader_response_context_adapter")?.adapter_payload_key, "aesthetic_memory_for_reader_response");

const cards = keyed(adapter.adapter_summary_cards, "adapter summary cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "context_adapter_overall",
    "writing_context_adapter",
    "revision_context_adapter",
    "final_polisher_context_adapter",
    "reader_response_context_adapter",
    "safety_boundary",
  ],
  "Phase31B adapter card order drifted.",
);
assert.equal(cards.get("context_adapter_overall")?.tone, "ready");
assert.equal(cards.get("safety_boundary")?.value, "preview-only");

assert(adapter.chatgpt_summary_lines.some((line) => line.includes("adapter preview")));
assert(adapter.chatgpt_summary_lines.some((line) => line.includes("writing_context.aesthetic_memory=ready")));
assert(adapter.chatgpt_summary_lines.some((line) => line.includes("不實際修改任何 context")));

const allowed = keyed(adapter.allowed_adapter_actions, "allowed adapter actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_context_adapter_summary",
    "copy_context_adapter_markdown",
    "inspect_adapter_payload_preview",
    "inspect_source_injection_readiness_gate",
  ],
  "Phase31B allowed adapter actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(adapter.blocked_adapter_capabilities, "blocked adapter capabilities");
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
  "attach_context_now",
  "mutate_writing_context",
  "mutate_revision_context",
  "mutate_final_polisher_context",
  "mutate_reader_response_context",
  "persist_adapter_payload",
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
  "no_context_mutation",
  "no_materialized_context_injection",
  "no_adapter_payload_persist",
]) {
  assert.equal(adapter.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
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
  "can_attach_context_now",
  "can_persist_adapter_payload",
]) {
  assert.equal(adapter.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
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
  "adapter_payload_persisted",
]) {
  assert.equal(adapter.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawAdapter = await buildAestheticMemoryContextAdapterPreview({ gate, include_raw: true, include_markdown: false });
assert.equal(rawAdapter.raw_gate.phase, "31A");
assert.equal(rawAdapter.raw_json_preview.raw_gate_included, true);
assert.equal(rawAdapter.surface_markdown, "");

const deterministic = await buildAestheticMemoryContextAdapterPreview({ gate, include_raw: false });
assert.deepEqual(deterministic, adapter, "Phase31B context adapter preview should be deterministic for the same gate.");

const weakAdapter = await buildAestheticMemoryContextAdapterPreview({ include_default_seed: false });
assert.equal(weakAdapter.preview_status, "needs_context");
assert.equal(weakAdapter.can_preview_adapter_payload, false);
assert.equal(weakAdapter.safety_boundary.no_active_engine_update, true);
assert.equal(weakAdapter.safety_boundary.can_write_canon, false);
assert.equal(weakAdapter.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakAdapter.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakAdapter.no_mutation_snapshot.context_mutated, false);
assert.equal(weakAdapter.no_mutation_snapshot.adapter_payload_persisted, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31B changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31B changed compressed_rules hash.");

console.log("Phase31B aesthetic memory context adapter preview tests passed.");

