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
import {
  aestheticMemoryContextBuilderPreviewSurfaceVersion,
  buildAestheticMemoryContextBuilderPreviewSurface,
} from "../../server/src/aesthetic-memory-context-builder-preview-surface-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const servicePath = path.join(root, "server", "src", "aesthetic-memory-context-builder-preview-surface-service.mjs");
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
  const phase31e = "tests/phase31/phase31e-aesthetic-memory-context-builder-readiness-gate.test.mjs";
  const phase31f = "tests/phase31/phase31f-aesthetic-memory-context-builder-preview-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31e), "run-all missing Phase 31E predecessor.");
  assert(runAllText.includes(phase31f), "run-all missing Phase 31F context builder preview surface.");
  assert(runAllText.indexOf(phase31e) < runAllText.indexOf(phase31f), "Phase 31F should run after Phase 31E.");
  assert(runAllText.indexOf(phase31f) < runAllText.indexOf(daily), "Phase 31F should run before Daily scripts and docs.");
}

function assertStaticServiceTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_context_builder_preview_surface",
    "readonly_preview_surface",
    "ui_chatgpt_bridge_preview",
    "surface_cards",
    "builder_status_rows",
    "surface_sections",
    "writing_context_builder_surface",
    "revision_context_builder_surface",
    "final_polisher_context_builder_surface",
    "reader_response_context_builder_surface",
    "writing_context.aesthetic_memory",
    "revision_context.aesthetic_memory",
    "final_polisher_context.aesthetic_memory",
    "reader_response_context.aesthetic_memory",
    "no_surface_state_persist",
    "no_surface_tool_registration",
    "write_surface_state",
    "persist_surface_state",
    "surface_state_written",
    "surface_state_persisted",
    "surface_tool_registered",
    "build_generation_context",
    "build_revision_context",
    "build_final_polisher_context",
    "build_reader_response_context",
  ]) {
    assert(serviceText.includes(token), `context builder preview surface missing static token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31F active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31F compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticServiceTokens(serviceText);
assert.equal(aestheticMemoryContextBuilderPreviewSurfaceVersion, "aesthetic_memory_context_builder_preview_surface_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase31F aesthetic memory context builder preview surface smoke.",
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
    "Preview surface 要能顯示每個 builder 是否 ready。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_preview_surface",
      category: "ui",
      polarity: "prefer",
      label: "Builder readiness 要有 preview surface",
      rule: "31E builder readiness gate 結果要整理成 UI / ChatGPT bridge 可讀卡片與狀態列。",
      rationale: "使用者需要直接看到四個 builder 是否 ready，但不能真的 build context。",
      strength: 96,
      applies_to: ["ui", "chatgpt_bridge", "context_builder"],
      examples: ["writing_context_builder：ready / readonly_preview=true。"],
    },
  ],
});
const surface30b = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface: surface30b, include_raw: false });
const gate31a = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: gate31a, include_raw: false });
const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
const builderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
const previewSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: false });

assert.equal(previewSurface.used, true);
assert.equal(previewSurface.phase, "31F");
assert.equal(previewSurface.version, aestheticMemoryContextBuilderPreviewSurfaceVersion);
assert.equal(previewSurface.surface_kind, "aesthetic_memory_context_builder_preview_surface");
assert.equal(previewSurface.surface_channel, "ui_chatgpt_bridge_preview");
assert.equal(previewSurface.surface_mode, "readonly_preview_surface");
assert.equal(previewSurface.source_phase, "31E");
assert.equal(previewSurface.source_gate_kind, "aesthetic_memory_context_builder_readiness_gate");
assert.match(previewSurface.source_builder_readiness_digest, /^[a-f0-9]{64}$/u);
assert.match(previewSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.equal(previewSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.equal(previewSurface.preview_status, "ready");
assert.equal(previewSurface.can_display_builder_preview, true);
assert.equal(previewSurface.will_build_context_now, false);
assert.equal(previewSurface.will_attach_context_now, false);
assert.equal(previewSurface.will_mutate_context, false);
assert.equal(previewSurface.builder_payload_persisted, false);
assert.equal(previewSurface.raw_gate, null);
assert.equal(previewSurface.raw_json_preview.visible_by_default, false);
assert.equal(previewSurface.raw_json_preview.raw_gate_included, false);
assert.match(previewSurface.surface_markdown, /Aesthetic Memory Context Builder Preview Surface/u);
assert.match(previewSurface.surface_markdown, /will_build_context_now: false/u);
assert.match(previewSurface.surface_markdown, /surface_state_written: false/u);

const cards = keyed(previewSurface.surface_cards, "surface cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "context_builder_surface_overall",
    "writing_context_builder_surface",
    "revision_context_builder_surface",
    "final_polisher_context_builder_surface",
    "reader_response_context_builder_surface",
    "surface_safety_boundary",
  ],
  "Phase31F surface cards order drifted.",
);
assert.equal(cards.get("context_builder_surface_overall")?.status, "ready");
assert.equal(cards.get("context_builder_surface_overall")?.value, "4/4 ready");
assert.equal(cards.get("surface_safety_boundary")?.value, "clean");

const rows = keyed(previewSurface.builder_status_rows, "builder status rows");
assert.deepEqual(
  [...rows.keys()],
  [
    "writing_context_builder_surface",
    "revision_context_builder_surface",
    "final_polisher_context_builder_surface",
    "reader_response_context_builder_surface",
  ],
  "Phase31F status rows order drifted.",
);
for (const row of rows.values()) {
  assert.equal(row.status, "ready", `${row.key} should be ready.`);
  assert.equal(row.readonly_preview, true, `${row.key} must remain readonly preview.`);
  assert.match(row.digest, /^[a-f0-9]{64}$/u);
}
assert.equal(rows.get("writing_context_builder_surface")?.builder_key, "writing_context_builder");
assert.equal(rows.get("writing_context_builder_surface")?.context_path, "writing_context.aesthetic_memory");
assert.equal(rows.get("revision_context_builder_surface")?.builder_key, "revision_context_builder");
assert.equal(rows.get("revision_context_builder_surface")?.context_path, "revision_context.aesthetic_memory");
assert.equal(rows.get("final_polisher_context_builder_surface")?.builder_key, "final_polisher_context_builder");
assert.equal(rows.get("final_polisher_context_builder_surface")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(rows.get("reader_response_context_builder_surface")?.builder_key, "reader_response_context_builder");
assert.equal(rows.get("reader_response_context_builder_surface")?.context_path, "reader_response_context.aesthetic_memory");

const sections = keyed(previewSurface.surface_sections, "surface sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "surface_header",
    "surface_cards",
    "builder_status_rows",
    "chatgpt_bridge_summary",
    "operator_safety",
    "raw_json_preview",
  ],
  "Phase31F surface section order drifted.",
);
assert.equal(sections.get("surface_cards")?.items.length, 6);
assert.equal(sections.get("builder_status_rows")?.items.length, 4);
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

assert(previewSurface.chatgpt_summary_lines.some((line) => line.includes("builder preview surface")));
assert(previewSurface.chatgpt_summary_lines.some((line) => line.includes("writing_context_builder/writing_context.aesthetic_memory=ready")));
assert(previewSurface.chatgpt_summary_lines.some((line) => line.includes("不 build context")));

const allowed = keyed(previewSurface.allowed_surface_actions, "allowed surface actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_context_builder_preview_surface",
    "copy_context_builder_preview_markdown",
    "inspect_context_builder_status_rows",
    "inspect_source_context_builder_readiness_gate",
  ],
  "Phase31F allowed actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(previewSurface.blocked_surface_capabilities, "blocked surface capabilities");
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
  "register_context_builder_mcp_tool",
  "write_surface_state",
  "persist_surface_state",
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
  "no_surface_tool_registration",
]) {
  assert.equal(previewSurface.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
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
  "can_register_context_builder_mcp_tool",
]) {
  assert.equal(previewSurface.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
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
  "surface_tool_registered",
]) {
  assert.equal(previewSurface.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: true, include_markdown: false });
assert.equal(rawSurface.raw_gate.phase, "31E");
assert.equal(rawSurface.raw_json_preview.raw_gate_included, true);
assert.equal(rawSurface.surface_markdown, "");

const deterministic = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: false });
assert.deepEqual(deterministic, previewSurface, "Phase31F preview surface should be deterministic for the same builder gate.");

const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakSurface.can_display_builder_preview, false);
assert.equal(weakSurface.safety_boundary.no_active_engine_update, true);
assert.equal(weakSurface.safety_boundary.can_write_canon, false);
assert.equal(weakSurface.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakSurface.no_mutation_snapshot.memory_file_written, false);
assert.equal(weakSurface.no_mutation_snapshot.context_built, false);
assert.equal(weakSurface.no_mutation_snapshot.context_attached, false);
assert.equal(weakSurface.no_mutation_snapshot.context_mutated, false);
assert.equal(weakSurface.no_mutation_snapshot.builder_payload_persisted, false);
assert.equal(weakSurface.no_mutation_snapshot.surface_state_written, false);
assert.equal(weakSurface.no_mutation_snapshot.surface_tool_registered, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31F changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31F changed compressed_rules hash.");

console.log("Phase31F aesthetic memory context builder preview surface tests passed.");

