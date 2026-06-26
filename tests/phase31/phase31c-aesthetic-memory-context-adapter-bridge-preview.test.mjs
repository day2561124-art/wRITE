import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import { buildAestheticMemoryBridgePreview } from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";
import { buildAestheticMemoryInjectionReadinessGate } from "../../server/src/aesthetic-memory-injection-readiness-gate-service.mjs";
import { buildAestheticMemoryContextAdapterPreview } from "../../server/src/aesthetic-memory-context-adapter-preview-service.mjs";
import {
  aestheticMemoryContextAdapterBridgePreviewVersion,
  buildAestheticMemoryContextAdapterBridgePreview,
} from "../../server/src/aesthetic-memory-context-adapter-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const bridgePath = path.join(root, "server", "src", "aesthetic-memory-context-adapter-bridge-preview-service.mjs");
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
  const phase31b = "tests/phase31/phase31b-aesthetic-memory-context-adapter-preview.test.mjs";
  const phase31c = "tests/phase31/phase31c-aesthetic-memory-context-adapter-bridge-preview.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31b), "run-all missing Phase 31B predecessor.");
  assert(runAllText.includes(phase31c), "run-all missing Phase 31C aesthetic memory context adapter bridge preview.");
  assert(runAllText.indexOf(phase31b) < runAllText.indexOf(phase31c), "Phase 31C should run after Phase 31B.");
  assert(runAllText.indexOf(phase31c) < runAllText.indexOf(daily), "Phase 31C should run before Daily scripts and docs.");
}

function assertStaticBridgeTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_context_adapter_bridge_preview",
    "chatgpt_bridge",
    "readonly_bridge_preview",
    "context_adapter_summaries",
    "adapter_status_lines",
    "bridge_sections",
    "allowed_bridge_actions",
    "blocked_bridge_capabilities",
    "raw_adapter_preview_included",
    "writing_context.aesthetic_memory",
    "revision_context.aesthetic_memory",
    "final_polisher_context.aesthetic_memory",
    "reader_response_context.aesthetic_memory",
    "register_context_adapter_mcp_tool",
    "no_bridge_tool_registration",
    "bridge_tool_registered",
    "adapter_payload_persisted",
    "context_mutated",
    "can_write_canon",
    "can_update_active_engine",
    "can_register_mcp_tool",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory context adapter bridge preview missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31C active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31C compressed_rules hash baseline drifted before test.");

const [runAllText, bridgeText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(bridgePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticBridgeTokens(bridgeText);
assert.equal(aestheticMemoryContextAdapterBridgePreviewVersion, "aesthetic_memory_context_adapter_bridge_preview_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31C aesthetic memory context adapter bridge preview smoke.",
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
      key: "prefer_bridge_readable_adapter",
      category: "ui",
      polarity: "prefer",
      label: "Bridge 要能直接看懂 adapter 狀態",
      rule: "ChatGPT 端要看到每個 context path 是否 ready，且看得出不會真的寫入 context。",
      rationale: "31C 是 bridge preview，不是 adapter executor。",
      strength: 94,
      applies_to: ["bridge_preview", "ui"],
      examples: ["writing_context.aesthetic_memory：ready / preview-only。"],
    },
  ],
});
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const aestheticBridge = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const gate = await buildAestheticMemoryInjectionReadinessGate({ preview: aestheticBridge, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate, include_raw: false });
const bridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });

assert.equal(bridge.used, true);
assert.equal(bridge.phase, "31C");
assert.equal(bridge.version, aestheticMemoryContextAdapterBridgePreviewVersion);
assert.equal(bridge.bridge_kind, "aesthetic_memory_context_adapter_bridge_preview");
assert.equal(bridge.bridge_channel, "chatgpt_bridge");
assert.equal(bridge.bridge_mode, "readonly_bridge_preview");
assert.equal(bridge.bridge_surface, "aesthetic_memory_context_adapter_summary");
assert.equal(bridge.source_phase, "31B");
assert.equal(bridge.source_adapter_kind, "aesthetic_memory_context_adapter_preview");
assert.match(bridge.source_adapter_preview_digest, /^[a-f0-9]{64}$/u);
assert.match(bridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(bridge.preview_status, "ready");
assert.equal(bridge.can_read_adapter_payload_preview, true);
assert.equal(bridge.will_attach_context_now, false);
assert.equal(bridge.will_mutate_context, false);
assert.equal(bridge.adapter_payload_persisted, false);
assert.match(bridge.surface_markdown, /Aesthetic Memory Context Adapter Bridge Preview/u);
assert.match(bridge.surface_markdown, /bridge_channel/u);
assert.match(bridge.surface_markdown, /context_mutated: false/u);
assert.match(bridge.surface_markdown, /adapter_payload_persisted_snapshot: false/u);
assert.equal(bridge.raw_adapter_preview, null);
assert.equal(bridge.raw_json_preview.visible_by_default, false);
assert.equal(bridge.raw_json_preview.raw_adapter_preview_included, false);

assert.deepEqual(
  bridge.adapter_status_lines,
  [
    "writing_context.aesthetic_memory：ready / payload=aesthetic_memory_for_generation / readonly=true",
    "revision_context.aesthetic_memory：ready / payload=aesthetic_memory_for_revision / readonly=true",
    "final_polisher_context.aesthetic_memory：ready / payload=aesthetic_memory_for_final_polisher / readonly=true",
    "reader_response_context.aesthetic_memory：ready / payload=aesthetic_memory_for_reader_response / readonly=true",
  ],
  "Phase31C adapter status lines drifted.",
);

const summaries = keyed(bridge.context_adapter_summaries, "context adapter summaries");
assert.deepEqual(
  [...summaries.keys()],
  [
    "writing_context_adapter",
    "revision_context_adapter",
    "final_polisher_context_adapter",
    "reader_response_context_adapter",
  ],
  "Phase31C context adapter summary order drifted.",
);
for (const item of summaries.values()) {
  assert.equal(item.status, "ready", `${item.key} should be ready.`);
  assert.equal(item.can_preview_adapter_payload, true, `${item.key} should remain previewable.`);
  assert.equal(item.can_attach_readonly_context, true, `${item.key} should remain read-only attachable.`);
  assert.equal(item.will_attach_context_now, false, `${item.key} must not attach context now.`);
  assert.equal(item.will_mutate_context, false, `${item.key} must not mutate context.`);
  assert.equal(item.materialized, false, `${item.key} must not be materialized.`);
  assert.match(item.adapter_payload_digest, /^[a-f0-9]{64}$/u);
}
assert.equal(summaries.get("writing_context_adapter")?.context_path, "writing_context.aesthetic_memory");
assert.equal(summaries.get("revision_context_adapter")?.context_path, "revision_context.aesthetic_memory");
assert.equal(summaries.get("final_polisher_context_adapter")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(summaries.get("reader_response_context_adapter")?.context_path, "reader_response_context.aesthetic_memory");

assert(bridge.chatgpt_summary_lines.some((line) => line.includes("ChatGPT")));
assert(bridge.chatgpt_summary_lines.some((line) => line.includes("writing_context.aesthetic_memory：ready")));
assert(bridge.chatgpt_summary_lines.some((line) => line.includes("不實際寫入 context")));

const sections = keyed(bridge.bridge_sections, "bridge sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "bridge_header",
    "context_adapter_summary",
    "writing_context_adapter",
    "revision_context_adapter",
    "final_polisher_context_adapter",
    "reader_response_context_adapter",
    "adapter_payload_preview",
    "safety_boundary",
    "raw_json_preview",
    "no_mutation_snapshot",
  ],
  "Phase31C bridge sections should stay stable.",
);
assert.equal(sections.get("context_adapter_summary")?.items.length, 4);
assert.equal(sections.get("adapter_payload_preview")?.items.length, 4);
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

const allowed = keyed(bridge.allowed_bridge_actions, "allowed bridge actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_context_adapter_bridge_summary",
    "copy_context_adapter_bridge_markdown",
    "inspect_context_adapter_payload_preview",
    "inspect_source_context_adapter_preview",
  ],
  "Phase31C allowed bridge actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(bridge.blocked_bridge_capabilities, "blocked bridge capabilities");
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
  "register_context_adapter_mcp_tool",
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
  "no_bridge_tool_registration",
]) {
  assert.equal(bridge.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
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
  "can_register_context_adapter_mcp_tool",
]) {
  assert.equal(bridge.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
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
  "bridge_tool_registered",
]) {
  assert.equal(bridge.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: true, include_markdown: false });
assert.equal(rawBridge.raw_adapter_preview.phase, "31B");
assert.equal(rawBridge.raw_json_preview.raw_adapter_preview_included, true);
assert.equal(rawBridge.surface_markdown, "");

const deterministic = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
assert.deepEqual(deterministic, bridge, "Phase31C context adapter bridge preview should be deterministic for the same adapter preview.");

const weakBridge = await buildAestheticMemoryContextAdapterBridgePreview({ include_default_seed: false });
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakBridge.can_read_adapter_payload_preview, false);
assert.equal(weakBridge.safety_boundary.no_active_engine_update, true);
assert.equal(weakBridge.safety_boundary.can_write_canon, false);
assert.equal(weakBridge.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakBridge.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakBridge.no_mutation_snapshot.context_mutated, false);
assert.equal(weakBridge.no_mutation_snapshot.adapter_payload_persisted, false);
assert.equal(weakBridge.no_mutation_snapshot.bridge_tool_registered, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31C changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31C changed compressed_rules hash.");

console.log("Phase31C aesthetic memory context adapter bridge preview tests passed.");

