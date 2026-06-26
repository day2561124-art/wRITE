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
import { buildAestheticMemoryContextBuilderBridgePreview } from "../../server/src/aesthetic-memory-context-builder-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
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
  const ordered = [
    "tests/phase31/phase31e-aesthetic-memory-context-builder-readiness-gate.test.mjs",
    "tests/phase31/phase31f-aesthetic-memory-context-builder-preview-surface.test.mjs",
    "tests/phase31/phase31g-aesthetic-memory-context-builder-bridge-preview.test.mjs",
    "tests/phase31/phase31h-aesthetic-memory-context-builder-bridge-final-smoke.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) {
    assert(runAllText.includes(token), `run-all missing ${token}`);
  }
  for (let index = 0; index < ordered.length - 1; index += 1) {
    assert(
      runAllText.indexOf(ordered[index]) < runAllText.indexOf(ordered[index + 1]),
      `run-all order drifted: ${ordered[index]} should appear before ${ordered[index + 1]}`,
    );
  }
}

function assertNoMutationSnapshot(snapshot, label) {
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
  ]) {
    assert.equal(snapshot[key], false, `${label} mutation snapshot ${key} must stay false.`);
  }
}

function assertCommonSafetyBoundary(safety, label) {
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
  ]) {
    assert.equal(safety[key], true, `${label} safety boundary ${key} must stay true.`);
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
  ]) {
    assert.equal(safety[key], false, `${label} safety boundary ${key} must stay false.`);
  }
}

function assertBuilderRows(rows, expectedKeys, label) {
  const map = keyed(rows, label);
  assert.deepEqual([...map.keys()], expectedKeys, `${label} order drifted.`);
  for (const row of map.values()) {
    assert.equal(row.status, "ready", `${label} ${row.key} should be ready.`);
    assert.match(row.digest ?? row.builder_payload_digest, /^[a-f0-9]{64}$/u, `${label} ${row.key} digest must be sha256.`);
  }
  return map;
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31H active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31H compressed_rules hash baseline drifted before test.");

const runAllText = await readFile(runAllPath, "utf8");
assertRunAllOrder(runAllText);

const input = {
  task_prompt: "Phase31H aesthetic memory context builder bridge final smoke.",
  accepted_patterns: [
    "角色要先像活人，才像設定。",
    "用場景物件承接壓力，而不是角色排隊說明。",
    "讓對話自然地打斷、停頓與錯開。",
  ],
  rejected_patterns: [
    "公告式總結",
    "主題先行",
    "流程化交接",
    "把能力當日常捷徑",
  ],
  style_principles: [
    "一章一變局。",
    "普通行動先直寫，幽默只能加味。",
    "不要把核對表語氣寫入正文。",
  ],
  ui_preferences: [
    "Builder bridge preview 要能直接顯示四條 context builder ready 狀態。",
    "Bridge 端要明確寫出不 build / attach / mutate runtime context。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_bridge_final_smoke_chain",
      category: "final_smoke",
      polarity: "prefer",
      label: "Builder bridge preview chain 需要 final smoke",
      rule: "31E readiness gate、31F preview surface、31G bridge preview 必須可串接、digest 可追蹤、安全邊界一致。",
      rationale: "Phase31H 用來收束 builder bridge preview 鏈，仍不可執行任何 runtime context builder。",
      strength: 100,
      applies_to: ["context_builder", "chatgpt_bridge", "ui", "safety"],
      examples: ["31E→31F→31G: ready, but will_build_context_now=false。"],
    },
    {
      key: "avoid_builder_runtime_mutation",
      category: "safety",
      polarity: "reject",
      label: "不得在 bridge preview 階段 mutate context",
      rule: "Builder bridge preview 只能讀摘要，不得 build、attach、mutate 或 persist payload。",
      rationale: "審美記憶仍處於 preview chain，不得成為正式 runtime context side effect。",
      strength: 100,
      applies_to: ["writing_context", "revision_context", "final_polisher_context", "reader_response_context"],
      examples: ["context_built=false, context_attached=false, context_mutated=false。"],
    },
  ],
};

const registry = await buildAestheticMemoryRegistryContract(input);
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const injectionGate = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: injectionGate, include_raw: false });
const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
const builderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
const builderSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: false });
const builderBridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: false });

assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.gate_kind, "aesthetic_memory_context_builder_readiness_gate");
assert.equal(builderGate.builder_readiness_status, "ready");
assert.equal(builderGate.can_build_readonly_context_preview, true);
assert.equal(builderGate.will_build_context_now, false);
assert.equal(builderGate.will_attach_context_now, false);
assert.equal(builderGate.will_mutate_context, false);
assert.equal(builderGate.builder_payload_persisted, false);
assert.match(builderGate.builder_readiness_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderGate.source_bridge_preview_digest, adapterBridge.bridge_preview_digest);

const gateRows = assertBuilderRows(
  builderGate.builder_readiness,
  [
    "writing_context_builder_readiness",
    "revision_context_builder_readiness",
    "final_polisher_context_builder_readiness",
    "reader_response_context_builder_readiness",
  ],
  "Phase31E builder readiness",
);
assert.equal(gateRows.get("writing_context_builder_readiness")?.builder_context_path, "writing_context.aesthetic_memory");
assert.equal(gateRows.get("revision_context_builder_readiness")?.builder_context_path, "revision_context.aesthetic_memory");
assert.equal(gateRows.get("final_polisher_context_builder_readiness")?.builder_context_path, "final_polisher_context.aesthetic_memory");
assert.equal(gateRows.get("reader_response_context_builder_readiness")?.builder_context_path, "reader_response_context.aesthetic_memory");

assert.equal(builderSurface.phase, "31F");
assert.equal(builderSurface.surface_kind, "aesthetic_memory_context_builder_preview_surface");
assert.equal(builderSurface.preview_status, "ready");
assert.equal(builderSurface.can_display_builder_preview, true);
assert.equal(builderSurface.will_build_context_now, false);
assert.equal(builderSurface.will_attach_context_now, false);
assert.equal(builderSurface.will_mutate_context, false);
assert.equal(builderSurface.builder_payload_persisted, false);
assert.match(builderSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);

const surfaceRows = assertBuilderRows(
  builderSurface.builder_status_rows,
  [
    "writing_context_builder_surface",
    "revision_context_builder_surface",
    "final_polisher_context_builder_surface",
    "reader_response_context_builder_surface",
  ],
  "Phase31F builder status rows",
);
assert.equal(surfaceRows.get("writing_context_builder_surface")?.context_path, "writing_context.aesthetic_memory");
assert.equal(surfaceRows.get("revision_context_builder_surface")?.context_path, "revision_context.aesthetic_memory");
assert.equal(surfaceRows.get("final_polisher_context_builder_surface")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(surfaceRows.get("reader_response_context_builder_surface")?.context_path, "reader_response_context.aesthetic_memory");

assert.equal(builderBridge.phase, "31G");
assert.equal(builderBridge.bridge_kind, "aesthetic_memory_context_builder_bridge_preview");
assert.equal(builderBridge.bridge_channel, "chatgpt_bridge_context_builder_preview");
assert.equal(builderBridge.preview_status, "ready");
assert.equal(builderBridge.can_display_builder_bridge_preview, true);
assert.equal(builderBridge.will_build_context_now, false);
assert.equal(builderBridge.will_attach_context_now, false);
assert.equal(builderBridge.will_mutate_context, false);
assert.equal(builderBridge.builder_payload_persisted, false);
assert.equal(builderBridge.bridge_state_persisted, false);
assert.match(builderBridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderBridge.source_surface_digest, builderSurface.surface_digest);

const bridgeRows = assertBuilderRows(
  builderBridge.builder_bridge_rows,
  [
    "writing_context_builder_bridge_preview",
    "revision_context_builder_bridge_preview",
    "final_polisher_context_builder_bridge_preview",
    "reader_response_context_builder_bridge_preview",
  ],
  "Phase31G builder bridge rows",
);
assert.equal(bridgeRows.get("writing_context_builder_bridge_preview")?.context_path, "writing_context.aesthetic_memory");
assert.equal(bridgeRows.get("revision_context_builder_bridge_preview")?.context_path, "revision_context.aesthetic_memory");
assert.equal(bridgeRows.get("final_polisher_context_builder_bridge_preview")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(bridgeRows.get("reader_response_context_builder_bridge_preview")?.context_path, "reader_response_context.aesthetic_memory");
for (const row of bridgeRows.values()) {
  assert.equal(row.readonly_preview, true, `${row.key} must remain readonly preview.`);
  assert.equal(row.chatgpt_line.includes("readonly_preview=true"), true, `${row.key} must surface readonly_preview to ChatGPT.`);
}

const gateCards = keyed(builderGate.readiness_cards, "Phase31E readiness cards");
const surfaceCards = keyed(builderSurface.surface_cards, "Phase31F surface cards");
const bridgeCards = keyed(builderBridge.builder_bridge_cards, "Phase31G bridge cards");
assert.equal(gateCards.get("context_builder_readiness_overall")?.value, "ready");
assert.equal(surfaceCards.get("context_builder_surface_overall")?.value, "4/4 ready");
assert.equal(bridgeCards.get("context_builder_bridge_overall")?.value, "4/4 ready");
assert.equal(bridgeCards.get("bridge_safety_boundary")?.value, "clean");

const bridgeSections = keyed(builderBridge.bridge_sections, "Phase31G bridge sections");
assert.deepEqual(
  [...bridgeSections.keys()],
  [
    "bridge_header",
    "bridge_cards",
    "builder_bridge_rows",
    "chatgpt_status_lines",
    "source_surface_trace",
    "operator_safety",
    "raw_json_preview",
  ],
  "Phase31G bridge sections order drifted.",
);
assert.equal(bridgeSections.get("builder_bridge_rows")?.items.length, 4);
assert.equal(bridgeSections.get("chatgpt_status_lines")?.items.length, 4);
assert.equal(bridgeSections.get("raw_json_preview")?.visible_by_default, false);

assert(builderBridge.chatgpt_summary_lines.some((line) => line.includes("builder bridge preview")));
assert(builderBridge.chatgpt_summary_lines.some((line) => line.includes("writing_context_builder/writing_context.aesthetic_memory=ready")));
assert(builderBridge.chatgpt_summary_lines.some((line) => line.includes("不 build context")));
assert(builderBridge.surface_markdown.includes("Aesthetic Memory Context Builder Bridge Preview"));
assert(builderBridge.surface_markdown.includes("will_build_context_now: false"));
assert(builderBridge.surface_markdown.includes("bridge_state_written: false"));

assertCommonSafetyBoundary(builderGate.safety_boundary, "Phase31E");
assertCommonSafetyBoundary(builderSurface.safety_boundary, "Phase31F");
assertCommonSafetyBoundary(builderBridge.safety_boundary, "Phase31G");
assert.equal(builderSurface.safety_boundary.no_surface_state_persist, true);
assert.equal(builderSurface.safety_boundary.can_write_surface_state, false);
assert.equal(builderBridge.safety_boundary.no_surface_state_persist, true);
assert.equal(builderBridge.safety_boundary.no_bridge_state_persist, true);
assert.equal(builderBridge.safety_boundary.no_bridge_tool_registration, true);
assert.equal(builderBridge.safety_boundary.can_write_surface_state, false);
assert.equal(builderBridge.safety_boundary.can_write_bridge_state, false);
assert.equal(builderBridge.safety_boundary.can_register_context_builder_bridge_mcp_tool, false);

assertNoMutationSnapshot(builderGate.no_mutation_snapshot, "Phase31E");
assertNoMutationSnapshot(builderSurface.no_mutation_snapshot, "Phase31F");
assertNoMutationSnapshot(builderBridge.no_mutation_snapshot, "Phase31G");
assert.equal(builderSurface.no_mutation_snapshot.surface_state_written, false);
assert.equal(builderSurface.no_mutation_snapshot.surface_state_persisted, false);
assert.equal(builderBridge.no_mutation_snapshot.surface_state_written, false);
assert.equal(builderBridge.no_mutation_snapshot.surface_state_persisted, false);
assert.equal(builderBridge.no_mutation_snapshot.bridge_state_written, false);
assert.equal(builderBridge.no_mutation_snapshot.bridge_state_persisted, false);
assert.equal(builderBridge.no_mutation_snapshot.bridge_tool_registered, false);

const blockedBridgeCapabilities = keyed(builderBridge.blocked_bridge_capabilities, "Phase31G blocked capabilities");
for (const key of [
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
  assert.equal(blockedBridgeCapabilities.get(key)?.allowed, false, `${key} must stay blocked in final smoke.`);
}

const rawBridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: true, include_markdown: false });
assert.equal(rawBridge.raw_surface.phase, "31F");
assert.equal(rawBridge.raw_json_preview.raw_surface_included, true);
assert.equal(rawBridge.surface_markdown, "");

const deterministicBuilderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
const deterministicBuilderSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: deterministicBuilderGate, include_raw: false });
const deterministicBuilderBridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: deterministicBuilderSurface, include_raw: false });
assert.equal(deterministicBuilderGate.builder_readiness_digest, builderGate.builder_readiness_digest);
assert.equal(deterministicBuilderSurface.surface_digest, builderSurface.surface_digest);
assert.equal(deterministicBuilderBridge.bridge_preview_digest, builderBridge.bridge_preview_digest);
assert.deepEqual(deterministicBuilderBridge, builderBridge, "Phase31H full builder bridge preview chain should be deterministic.");

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakGate.no_mutation_snapshot.context_built, false);
assert.equal(weakSurface.no_mutation_snapshot.context_built, false);
assert.equal(weakBridge.no_mutation_snapshot.context_built, false);
assert.equal(weakBridge.no_mutation_snapshot.bridge_state_written, false);
assert.equal(weakBridge.safety_boundary.no_active_engine_update, true);
assert.equal(weakBridge.safety_boundary.can_write_canon, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31H changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31H changed compressed_rules hash.");

console.log("Phase31H aesthetic memory context builder bridge final smoke tests passed.");

