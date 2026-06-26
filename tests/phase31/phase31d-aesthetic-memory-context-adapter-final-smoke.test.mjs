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

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(value) {
  return hash(JSON.stringify(value ?? null));
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
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
  const phase31c = "tests/phase31/phase31c-aesthetic-memory-context-adapter-bridge-preview.test.mjs";
  const phase31d = "tests/phase31/phase31d-aesthetic-memory-context-adapter-final-smoke.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase31c), "run-all missing Phase 31C predecessor.");
  assert(runAllText.includes(phase31d), "run-all missing Phase 31D aesthetic memory final smoke.");
  assert(runAllText.indexOf(phase31c) < runAllText.indexOf(phase31d), "Phase 31D should run after Phase 31C.");
  assert(runAllText.indexOf(phase31d) < runAllText.indexOf(daily), "Phase 31D should run before Daily scripts and docs.");
}

function assertDigest(value, label) {
  assert.match(value, /^[a-f0-9]{64}$/u, `${label} must be a sha256 digest.`);
}

function assertNoMutationSnapshot(snapshot, label) {
  const item = object(snapshot);
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
  ]) {
    if (key in item) assert.equal(item[key], false, `${label}.${key} must stay false.`);
  }
  for (const key of [
    "context_mutated",
    "injection_materialized",
    "adapter_payload_persisted",
    "bridge_tool_registered",
  ]) {
    if (key in item) assert.equal(item[key], false, `${label}.${key} must stay false.`);
  }
}

function assertSafetyBoundary(boundary, label) {
  const safety = object(boundary);
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
  ]) {
    if (key in safety) assert.equal(safety[key], true, `${label}.${key} must stay true.`);
  }
  for (const key of [
    "no_revision",
    "no_context_mutation",
    "no_materialized_context_injection",
    "no_adapter_payload_persist",
    "no_bridge_tool_registration",
  ]) {
    if (key in safety) assert.equal(safety[key], true, `${label}.${key} must stay true.`);
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
  ]) {
    if (key in safety) assert.equal(safety[key], false, `${label}.${key} must stay false.`);
  }
  for (const key of [
    "can_materialize_context_injection",
    "can_attach_context_now",
    "can_persist_adapter_payload",
    "can_register_context_adapter_mcp_tool",
  ]) {
    if (key in safety) assert.equal(safety[key], false, `${label}.${key} must stay false.`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31D active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31D compressed_rules hash baseline drifted before test.");

assertRunAllOrder(await readFile(runAllPath, "utf8"));

const input = {
  task_prompt: "Phase31D full aesthetic memory context adapter final smoke.",
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
    "UI 要顯示成人話摘要，而不是只給 JSON。",
    "Bridge 端要能直接看到每個 context path 的 ready 狀態。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_context_adapter_full_chain",
      category: "bridge_preview",
      polarity: "prefer",
      label: "審美記憶鏈要能完整預覽",
      rule: "30A 到 31C 必須能串成一條只讀預覽鏈，並清楚標明不會真的寫入 context。",
      rationale: "Phase31D 要驗證整條鏈的可讀性與安全邊界。",
      strength: 98,
      applies_to: ["generation", "revision", "final_polisher", "reader_response", "bridge_preview"],
      examples: ["writing_context.aesthetic_memory：ready / preview-only。"],
    },
    {
      key: "avoid_adapter_persistence",
      category: "safety",
      polarity: "avoid",
      label: "禁止 adapter payload 持久化",
      rule: "Final smoke 只能檢查 adapter payload 形狀，不能保存或注入。",
      rationale: "審美記憶仍是 preview-only pipeline。",
      strength: 100,
      applies_to: ["bridge_preview", "context_adapter"],
      examples: ["adapter_payload_persisted 必須維持 false。"],
    },
  ],
};

const registry = await buildAestheticMemoryRegistryContract(input);
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const bridgePreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
const gate = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate, include_raw: false });
const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });

assert.equal(registry.used, true);
assert.equal(registry.phase, "30A");
assert.equal(surface.used, true);
assert.equal(surface.phase, "30B");
assert.equal(bridgePreview.used, true);
assert.equal(bridgePreview.phase, "30C");
assert.equal(gate.used, true);
assert.equal(gate.phase, "31A");
assert.equal(adapterPreview.used, true);
assert.equal(adapterPreview.phase, "31B");
assert.equal(adapterBridge.used, true);
assert.equal(adapterBridge.phase, "31C");

assert.equal(surface.status, "ready");
assert.equal(bridgePreview.preview_status, "ready");
assert.equal(gate.readiness_status, "ready");
assert.equal(adapterPreview.preview_status, "ready");
assert.equal(adapterBridge.preview_status, "ready");

assertDigest(bridgePreview.source_surface_digest, "30C source_surface_digest");
assertDigest(bridgePreview.bridge_preview_digest, "30C bridge_preview_digest");
assertDigest(gate.source_preview_digest, "31A source_preview_digest");
assertDigest(gate.gate_digest, "31A gate_digest");
assertDigest(adapterPreview.source_gate_digest, "31B source_gate_digest");
assertDigest(adapterPreview.adapter_preview_digest, "31B adapter_preview_digest");
assertDigest(adapterBridge.source_adapter_preview_digest, "31C source_adapter_preview_digest");
assertDigest(adapterBridge.bridge_preview_digest, "31C bridge_preview_digest");

assert.equal(gate.source_preview_digest, bridgePreview.bridge_preview_digest);
assert.equal(adapterPreview.source_gate_digest, gate.gate_digest);
assert.equal(adapterBridge.source_adapter_preview_digest, adapterPreview.adapter_preview_digest);

assertSafetyBoundary(bridgePreview.safety_boundary, "30C safety");
assertSafetyBoundary(gate.safety_boundary, "31A safety");
assertSafetyBoundary(adapterPreview.safety_boundary, "31B safety");
assertSafetyBoundary(adapterBridge.safety_boundary, "31C safety");

assertNoMutationSnapshot(bridgePreview.no_mutation_snapshot, "30C mutation");
assertNoMutationSnapshot(gate.no_mutation_snapshot, "31A mutation");
assertNoMutationSnapshot(adapterPreview.no_mutation_snapshot, "31B mutation");
assertNoMutationSnapshot(adapterBridge.no_mutation_snapshot, "31C mutation");

const targetReadiness = keyed(gate.target_readiness, "31A target readiness");
assert.deepEqual(
  [...targetReadiness.keys()],
  [
    "writing_context",
    "revision_context",
    "final_polisher_context",
    "reader_response_simulator_context",
  ],
  "31A target readiness order drifted.",
);
for (const target of targetReadiness.values()) {
  assert.equal(target.status, "ready", `${target.key} should be ready.`);
  assert.equal(target.can_attach_readonly_context, true, `${target.key} should stay read-only attachable.`);
  assert.equal(target.will_mutate_context, false, `${target.key} must not mutate context.`);
}

const adapters = keyed(adapterPreview.context_adapters, "31B context adapters");
assert.deepEqual(
  [...adapters.keys()],
  [
    "writing_context_adapter",
    "revision_context_adapter",
    "final_polisher_context_adapter",
    "reader_response_context_adapter",
  ],
  "31B adapter order drifted.",
);
for (const adapter of adapters.values()) {
  assert.equal(adapter.status, "ready", `${adapter.key} should be ready.`);
  assert.equal(adapter.can_preview_adapter_payload, true, `${adapter.key} should preview payload.`);
  assert.equal(adapter.will_attach_context_now, false, `${adapter.key} must not attach context now.`);
  assert.equal(adapter.will_mutate_context, false, `${adapter.key} must not mutate context.`);
  assert.equal(adapter.materialized, false, `${adapter.key} must not materialize.`);
  assertDigest(adapter.adapter_payload_digest, `${adapter.key}.adapter_payload_digest`);
}

assert.deepEqual(
  adapterBridge.adapter_status_lines,
  [
    "writing_context.aesthetic_memory：ready / payload=aesthetic_memory_for_generation / readonly=true",
    "revision_context.aesthetic_memory：ready / payload=aesthetic_memory_for_revision / readonly=true",
    "final_polisher_context.aesthetic_memory：ready / payload=aesthetic_memory_for_final_polisher / readonly=true",
    "reader_response_context.aesthetic_memory：ready / payload=aesthetic_memory_for_reader_response / readonly=true",
  ],
  "31C bridge status lines drifted.",
);

const bridgeSections = keyed(adapterBridge.bridge_sections, "31C bridge sections");
assert.equal(bridgeSections.get("context_adapter_summary")?.items.length, 4);
assert.equal(bridgeSections.get("adapter_payload_preview")?.items.length, 4);
assert.equal(bridgeSections.get("raw_json_preview")?.visible_by_default, false);
assert(adapterBridge.chatgpt_summary_lines.some((line) => line.includes("ChatGPT")));
assert(adapterBridge.chatgpt_summary_lines.some((line) => line.includes("不實際寫入 context")));
assert(adapterBridge.surface_markdown.includes("Aesthetic Memory Context Adapter Bridge Preview"));
assert(adapterBridge.surface_markdown.includes("writing_context.aesthetic_memory"));

const chainDigest = digest({
  registry_phase: registry.phase,
  surface_digest: bridgePreview.source_surface_digest,
  bridge_digest: bridgePreview.bridge_preview_digest,
  gate_digest: gate.gate_digest,
  adapter_digest: adapterPreview.adapter_preview_digest,
  adapter_bridge_digest: adapterBridge.bridge_preview_digest,
  statuses: [
    surface.status,
    bridgePreview.preview_status,
    gate.readiness_status,
    adapterPreview.preview_status,
    adapterBridge.preview_status,
  ],
});
assertDigest(chainDigest, "Phase31D chain digest");

const deterministicRegistry = await buildAestheticMemoryRegistryContract(input);
const deterministicSurface = await buildAestheticMemoryUiSurface({ registry: deterministicRegistry, include_raw: false });
const deterministicBridgePreview = await buildAestheticMemoryBridgePreview({ surface: deterministicSurface, include_raw: false });
const deterministicGate = await buildAestheticMemoryInjectionReadinessGate({ preview: deterministicBridgePreview, include_raw: false });
const deterministicAdapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: deterministicGate, include_raw: false });
const deterministicAdapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: deterministicAdapterPreview, include_raw: false });

assert.equal(deterministicBridgePreview.bridge_preview_digest, bridgePreview.bridge_preview_digest);
assert.equal(deterministicGate.gate_digest, gate.gate_digest);
assert.equal(deterministicAdapterPreview.adapter_preview_digest, adapterPreview.adapter_preview_digest);
assert.equal(deterministicAdapterBridge.bridge_preview_digest, adapterBridge.bridge_preview_digest);

const weakRegistry = await buildAestheticMemoryRegistryContract({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryUiSurface({ registry: weakRegistry, include_default_seed: false });
const weakBridge = await buildAestheticMemoryBridgePreview({ surface: weakSurface, include_default_seed: false });
const weakGate = await buildAestheticMemoryInjectionReadinessGate({ preview: weakBridge, include_default_seed: false });
const weakAdapter = await buildAestheticMemoryContextAdapterPreview({ gate: weakGate, include_default_seed: false });
const weakAdapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: weakAdapter, include_default_seed: false });

assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakGate.readiness_status, "needs_context");
assert.equal(weakAdapter.preview_status, "needs_context");
assert.equal(weakAdapterBridge.preview_status, "needs_context");
assert.equal(weakAdapterBridge.can_read_adapter_payload_preview, false);
assert.equal(weakAdapterBridge.no_mutation_snapshot.context_mutated, false);
assert.equal(weakAdapterBridge.no_mutation_snapshot.adapter_payload_persisted, false);
assert.equal(weakAdapterBridge.no_mutation_snapshot.bridge_tool_registered, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31D changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31D changed compressed_rules hash.");

console.log("Phase31D aesthetic memory context adapter final smoke tests passed.");

