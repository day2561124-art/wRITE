import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import {
  aestheticMemoryBridgePreviewVersion,
  buildAestheticMemoryBridgePreview,
} from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const bridgePreviewPath = path.join(root, "server", "src", "aesthetic-memory-bridge-preview-service.mjs");
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
  const phase30b = "tests/phase30/phase30b-aesthetic-memory-registry-ui-surface.test.mjs";
  const phase30c = "tests/phase30/phase30c-aesthetic-memory-bridge-preview.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase30b), "run-all missing Phase 30B predecessor.");
  assert(runAllText.includes(phase30c), "run-all missing Phase 30C aesthetic memory bridge preview.");
  assert(runAllText.indexOf(phase30b) < runAllText.indexOf(phase30c), "Phase 30C should run after Phase 30B.");
  assert(runAllText.indexOf(phase30c) < runAllText.indexOf(daily), "Phase 30C should run before Daily scripts and docs.");
}

function assertStaticBridgeTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_bridge_preview",
    "chatgpt_bridge",
    "readonly_preview",
    "chatgpt_summary_lines",
    "allowed_bridge_actions",
    "blocked_bridge_capabilities",
    "raw_json_preview",
    "no_mutation_snapshot",
    "memory_file_written",
    "can_write_canon",
    "can_update_active_engine",
    "can_register_mcp_tool",
    "write_memory_file",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory bridge preview missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase30C active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase30C compressed_rules hash baseline drifted before test.");

const [runAllText, bridgePreviewText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(bridgePreviewPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticBridgeTokens(bridgePreviewText);
assert.equal(aestheticMemoryBridgePreviewVersion, "aesthetic_memory_bridge_preview_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase30C aesthetic memory bridge preview smoke.",
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
      key: "prefer_dialogue_interruptions",
      category: "dialogue",
      polarity: "prefer",
      label: "對話要有打斷與停頓",
      rule: "角色可以猶豫、插話、沉默，不要排隊報告。",
      rationale: "群像需要像活人。",
      strength: 94,
      applies_to: ["generation", "revision"],
      examples: ["九逃話說到一半被終端震動打斷。"],
    },
  ],
});
const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
const preview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });

assert.equal(preview.used, true);
assert.equal(preview.phase, "30C");
assert.equal(preview.version, aestheticMemoryBridgePreviewVersion);
assert.equal(preview.bridge_kind, "aesthetic_memory_bridge_preview");
assert.equal(preview.bridge_channel, "chatgpt_bridge");
assert.equal(preview.bridge_mode, "readonly_preview");
assert.equal(preview.bridge_surface, "aesthetic_memory_ui_surface_summary");
assert.equal(preview.source_phase, "30B");
assert.equal(preview.preview_status, "ready");
assert.equal(preview.status_badge.tone, "ready");
assert.match(preview.source_surface_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.match(preview.surface_markdown, /Aesthetic Memory Bridge Preview/u);
assert.match(preview.surface_markdown, /bridge_channel: chatgpt_bridge/u);
assert.match(preview.surface_markdown, /can_write_canon: false/u);
assert.match(preview.surface_markdown, /memory_file_written: false/u);
assert.equal(preview.raw_surface, null);
assert.equal(preview.raw_json_preview.visible_by_default, false);
assert.equal(preview.raw_json_preview.raw_surface_included, false);

assert.equal(preview.bridge_readability.status, "ready");
assert.equal(preview.bridge_readability.aesthetic_memory_score, surface.aesthetic_memory_score);
assert.equal(preview.aesthetic_memory_score, surface.aesthetic_memory_score);
assert(preview.chatgpt_summary_lines.some((line) => line.includes("審美記憶")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("禁止")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("偏好")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("必守")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("安全")));
assert(preview.chatgpt_summary_lines.some((line) => line.includes("不寫 memory file")));

const overviewCards = keyed(preview.overview_cards, "bridge overview cards");
assert.deepEqual(
  [...overviewCards.keys()],
  [
    "aesthetic_memory_overall",
    "positive_preferences",
    "avoidance_rules",
    "coverage_categories",
    "watch_items",
  ],
  "Phase30C overview card order drifted.",
);
assert.equal(overviewCards.get("aesthetic_memory_overall")?.label, "審美記憶");
assert.equal(overviewCards.get("avoidance_rules")?.label, "禁忌");

const sections = keyed(preview.bridge_sections, "bridge sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "bridge_header",
    "aesthetic_memory_cards",
    "forbidden_patterns",
    "preferred_patterns",
    "required_principles",
    "coverage",
    "provider_usage",
    "safety_boundary",
    "raw_json_preview",
    "no_mutation_snapshot",
  ],
  "Phase30C bridge sections should stay stable for ChatGPT preview.",
);
assert.equal(sections.get("aesthetic_memory_cards")?.items.length, 5);
assert.equal(sections.get("forbidden_patterns")?.items.some((item) => item.label.includes("流程化")), true);
assert.equal(sections.get("preferred_patterns")?.items.some((item) => item.label.includes("角色像活人")), true);
assert.equal(sections.get("required_principles")?.items.some((item) => item.label.includes("一章一變局")), true);
assert.equal(sections.get("coverage")?.items.some((item) => item.key === "dialogue"), true);
assert.equal(sections.get("provider_usage")?.items.some((item) => item.key === "generation_payload_key"), true);
assert.equal(sections.get("safety_boundary")?.items.some((item) => item.key === "memory_file_written"), true);
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

const allowed = keyed(preview.allowed_bridge_actions, "allowed bridge actions");
assert.deepEqual(
  [...allowed.keys()],
  [
    "read_aesthetic_memory_summary",
    "copy_aesthetic_memory_markdown",
    "inspect_aesthetic_memory_ui_surface",
    "open_writer_workbench_aesthetic_memory_route",
  ],
  "Phase30C allowed bridge actions drifted.",
);
for (const action of allowed.values()) {
  assert.equal(action.allowed, true, `${action.key} should be allowed read-only action.`);
}

const blocked = keyed(preview.blocked_bridge_capabilities, "blocked bridge capabilities");
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
]) {
  assert.equal(preview.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
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
  assert.equal(preview.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
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
]) {
  assert.equal(preview.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const rawPreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: true, include_markdown: false });
assert.equal(rawPreview.raw_surface.phase, "30B");
assert.equal(rawPreview.raw_json_preview.raw_surface_included, true);
assert.equal(rawPreview.surface_markdown, "");

const deterministic = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
assert.deepEqual(deterministic, preview, "Phase30C bridge preview should be deterministic for the same surface.");

const weakPreview = await buildAestheticMemoryBridgePreview({ include_default_seed: false });
assert.equal(weakPreview.preview_status, "needs_context");
assert.equal(weakPreview.status_badge.tone, "empty");
assert.equal(weakPreview.safety_boundary.no_active_engine_update, true);
assert.equal(weakPreview.safety_boundary.can_write_canon, false);
assert.equal(weakPreview.no_mutation_snapshot.mcp_tool_added, false);
assert.equal(weakPreview.no_mutation_snapshot.memory_file_written, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase30C changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase30C changed compressed_rules hash.");

console.log("Phase30C aesthetic memory bridge preview tests passed.");

