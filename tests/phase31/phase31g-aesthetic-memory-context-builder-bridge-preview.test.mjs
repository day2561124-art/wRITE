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
import { buildAestheticMemoryContextBuilderReadinessGate } from "../../server/src/aesthetic-memory-context-builder-readiness-gate-service.mjs";
import { buildAestheticMemoryContextBuilderPreviewSurface } from "../../server/src/aesthetic-memory-context-builder-preview-surface-service.mjs";
import {
  aestheticMemoryContextBuilderBridgePreviewVersion,
  buildAestheticMemoryContextBuilderBridgePreview,
} from "../../server/src/aesthetic-memory-context-builder-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const servicePath = path.join(root, "server", "src", "aesthetic-memory-context-builder-bridge-preview-service.mjs");
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
  const phase31f = "tests/phase31/phase31f-aesthetic-memory-context-builder-preview-surface.test.mjs";
  const phase31g = "tests/phase31/phase31g-aesthetic-memory-context-builder-bridge-preview.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31f), "run-all missing Phase 31F predecessor.");
  assert(runAllText.includes(phase31g), "run-all missing Phase 31G context builder bridge preview.");
  assert(runAllText.indexOf(phase31f) < runAllText.indexOf(phase31g), "Phase 31G should run after Phase 31F.");
  assert(runAllText.indexOf(phase31g) < runAllText.indexOf(daily), "Phase 31G should run before Daily scripts and docs.");
}

function assertStaticServiceTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_context_builder_bridge_preview",
    "chatgpt_bridge_context_builder_preview",
    "readonly_bridge_preview",
    "builder_bridge_cards",
    "builder_bridge_rows",
    "bridge_sections",
    "writing_context_builder_bridge_preview",
    "revision_context_builder_bridge_preview",
    "final_polisher_context_builder_bridge_preview",
    "reader_response_context_builder_bridge_preview",
    "writing_context.aesthetic_memory",
    "revision_context.aesthetic_memory",
    "final_polisher_context.aesthetic_memory",
    "reader_response_context.aesthetic_memory",
    "no_bridge_state_persist",
    "no_bridge_tool_registration",
    "write_bridge_state",
    "persist_bridge_state",
    "bridge_state_written",
    "bridge_state_persisted",
    "bridge_tool_registered",
    "register_context_builder_bridge_mcp_tool",
    "build_generation_context",
    "build_revision_context",
    "build_final_polisher_context",
    "build_reader_response_context",
  ]) {
    assert(serviceText.includes(token), `context builder bridge preview missing static token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31G active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31G compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticServiceTokens(serviceText);
assert.equal(aestheticMemoryContextBuilderBridgePreviewVersion, "aesthetic_memory_context_builder_bridge_preview_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31G aesthetic memory context builder bridge preview smoke.",
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
    "ChatGPT bridge 要能直接讀 builder preview surface 的 ready 狀態。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_bridge_preview",
      category: "chatgpt_bridge",
      polarity: "prefer",
      label: "Builder preview surface 要有 bridge 專用摘要",
      rule: "31F surface rows 要整理成 ChatGPT bridge 專用 rows/cards，不執行 context builder。",
      rationale: "Phase31G 是 bridge preview，不是 build executor。",
      strength: 96,
      applies_to: ["chatgpt_bridge", "context_builder", "ui"],
      examples: ["writing_context_builder/writing_context.aesthetic_memory=ready / readonly_preview=true。"],
    },
  ],
});
const surface30b = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface: surface30b, include_raw: false });
const gate31a = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: gate31a, include_raw: false });
const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
const builderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
const builderSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: false });
const bridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: false });

assert.equal(bridge.used, true);
assert.equal(bridge.phase, "31G");
assert.equal(bridge.version, aestheticMemoryContextBuilderBridgePreviewVersion);
assert.equal(bridge.bridge_kind, "aesthetic_memory_context_builder_bridge_preview");
assert.equal(bridge.bridge_channel, "chatgpt_bridge_context_builder_preview");
assert.equal(bridge.bridge_mode, "readonly_bridge_preview");
assert.equal(bridge.source_phase, "31F");
assert.equal(bridge.source_surface_kind, "aesthetic_memory_context_builder_preview_surface");
assert.match(bridge.source_surface_digest, /^[a-f0-9]{64}$/u);
assert.match(bridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(bridge.source_surface_digest, builderSurface.surface_digest);
assert.equal(bridge.preview_status, "ready");
assert.equal(bridge.can_display_builder_bridge_preview, true);
assert.equal(bridge.will_build_context_now, false);
assert.equal(bridge.will_attach_context_now, false);
assert.equal(bridge.will_mutate_context, false);
assert.equal(bridge.builder_payload_persisted, false);
assert.equal(bridge.bridge_state_persisted, false);
assert.equal(bridge.raw_surface, null);
assert.equal(bridge.raw_json_preview.visible_by_default, false);
assert.equal(bridge.raw_json_preview.raw_surface_included, false);
assert.match(bridge.surface_markdown, /Aesthetic Memory Context Builder Bridge Preview/u);
assert.match(bridge.surface_markdown, /will_build_context_now: false/u);
assert.match(bridge.surface_markdown, /bridge_state_written: false/u);

const cards = keyed(bridge.builder_bridge_cards, "builder bridge cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "context_builder_bridge_overall",
    "writing_context_builder_bridge_preview",
    "revision_context_builder_bridge_preview",
    "final_polisher_context_builder_bridge_preview",
    "reader_response_context_builder_bridge_preview",
    "bridge_safety_boundary",
  ],
  "Phase31G bridge cards order drifted.",
);
assert.equal(cards.get("context_builder_bridge_overall")?.status, "ready");
assert.equal(cards.get("context_builder_bridge_overall")?.value, "4/4 ready");
assert.equal(cards.get("bridge_safety_boundary")?.value, "clean");

const rows = keyed(bridge.builder_bridge_rows, "builder bridge rows");
assert.deepEqual(
  [...rows.keys()],
  [
    "writing_context_builder_bridge_preview",
    "revision_context_builder_bridge_preview",
    "final_polisher_context_builder_bridge_preview",
    "reader_response_context_builder_bridge_preview",
  ],
  "Phase31G bridge row order drifted.",
);
for (const row of rows.values()) {
  assert.equal(row.status, "ready", `${row.key} should be ready.`);
  assert.equal(row.readonly_preview, true, `${row.key} must remain readonly preview.`);
  assert.match(row.digest, /^[a-f0-9]{64}$/u);
  assert(row.chatgpt_line.includes("readonly_preview=true"));
}
assert.equal(rows.get("writing_context_builder_bridge_preview")?.builder_key, "writing_context_builder");
assert.equal(rows.get("writing_context_builder_bridge_preview")?.context_path, "writing_context.aesthetic_memory");
assert.equal(rows.get("revision_context_builder_bridge_preview")?.builder_key, "revision_context_builder");
assert.equal(rows.get("revision_context_builder_bridge_preview")?.context_path, "revision_context.aesthetic_memory");
assert.equal(rows.get("final_polisher_context_builder_bridge_preview")?.builder_key, "final_polisher_context_builder");
assert.equal(rows.get("final_polisher_context_builder_bridge_preview")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(rows.get("reader_response_context_builder_bridge_preview")?.builder_key, "reader_response_context_builder");
assert.equal(rows.get("reader_response_context_builder_bridge_preview")?.context_path, "reader_response_context.aesthetic_memory");

const sections = keyed(bridge.bridge_sections, "bridge sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "bridge_header",
    "bridge_cards",
    "builder_bridge_rows",
    "chatgpt_status_lines",
    "source_surface_trace",
    "operator_safety",
    "raw_json_preview",
  ],
  "Phase31G bridge section order drifted.",
);
assert.equal(sections.get("bridge_cards")?.items.length, 6);
assert.equal(sections.get("builder_bridge_rows")?.items.length, 4);
assert.equal(sections.get("chatgpt_status_lines")?.items.length, 4);
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

assert(bridge.chatgpt_summary_lines.some((line) => line.includes("builder bridge preview")));
assert(bridge.chatgpt_summary_lines.some((line) => line.includes("writing_context_builder/writing_context.aesthetic_memory=ready")));
assert(bridge.chatgpt_summary_lines.some((line) => line.includes("不 build context")));

const allowed = keyed(bridge.allowed_bridge_actions, "allowed bridge actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_context_builder_bridge_preview",
    "copy_context_builder_bridge_markdown",
    "inspect_builder_bridge_rows",
    "inspect_source_context_builder_preview_surface",
  ],
  "Phase31G allowed actions drifted.",
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
  "write_canon",
  "update_active_engine",
  "update_compressed_rules",
  "modify_runtime_ui",
  "register_mcp_tool",
  "write_memory_file",
  "build_generation_context",
  "build_revision_context",
  "build_final_polisher_context",
  "build_reader_response_context",
  "materialize_context_builder",
  "attach_context_now",
  "mutate_writing_context",
  "mutate_revision_context",
  "mutate_final_polisher_context",
  "mutate_reader_response_context",
  "persist_adapter_payload",
  "persist_builder_payload",
  "write_surface_state",
  "persist_surface_state",
  "write_bridge_state",
  "persist_bridge_state",
  "register_context_builder_mcp_tool",
  "register_context_builder_bridge_mcp_tool",
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
  "no_surface_state_persist",
  "no_bridge_state_persist",
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
  "can_build_generation_context",
  "can_build_revision_context",
  "can_build_final_polisher_context",
  "can_build_reader_response_context",
  "can_materialize_context_injection",
  "can_attach_context_now",
  "can_persist_adapter_payload",
  "can_persist_builder_payload",
  "can_write_surface_state",
  "can_write_bridge_state",
  "can_register_context_builder_mcp_tool",
  "can_register_context_builder_bridge_mcp_tool",
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
  "context_built",
  "context_attached",
  "context_mutated",
  "injection_materialized",
  "adapter_payload_persisted",
  "builder_payload_persisted",
  "surface_state_written",
  "surface_state_persisted",
  "bridge_state_written",
  "bridge_state_persisted",
  "bridge_tool_registered",
]) {
  assert.equal(bridge.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawBridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: true, include_markdown: false });
assert.equal(rawBridge.raw_surface.phase, "31F");
assert.equal(rawBridge.raw_json_preview.raw_surface_included, true);
assert.equal(rawBridge.surface_markdown, "");

const deterministic = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: false });
assert.deepEqual(deterministic, bridge, "Phase31G bridge preview should be deterministic for the same builder surface.");

const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakBridge.can_display_builder_bridge_preview, false);
assert.equal(weakBridge.safety_boundary.no_active_engine_update, true);
assert.equal(weakBridge.safety_boundary.can_write_canon, false);
assert.equal(weakBridge.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakBridge.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakBridge.no_mutation_snapshot.context_built, false);
assert.equal(weakBridge.no_mutation_snapshot.context_attached, false);
assert.equal(weakBridge.no_mutation_snapshot.context_mutated, false);
assert.equal(weakBridge.no_mutation_snapshot.builder_payload_persisted, false);
assert.equal(weakBridge.no_mutation_snapshot.bridge_state_written, false);
assert.equal(weakBridge.no_mutation_snapshot.bridge_tool_registered, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31G changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31G changed compressed_rules hash.");

console.log("Phase31G aesthetic memory context builder bridge preview tests passed.");

