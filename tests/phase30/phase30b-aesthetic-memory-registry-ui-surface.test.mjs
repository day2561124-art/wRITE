import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import {
  aestheticMemoryUiSurfaceVersion,
  buildAestheticMemoryUiSurface,
} from "../../server/src/aesthetic-memory-ui-surface-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const uiSurfacePath = path.join(root, "server", "src", "aesthetic-memory-ui-surface-service.mjs");
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
  const phase30a = "tests/phase30/phase30a-aesthetic-memory-registry-contract.test.mjs";
  const phase30b = "tests/phase30/phase30b-aesthetic-memory-registry-ui-surface.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase30a), "run-all missing Phase 30A predecessor.");
  assert(runAllText.includes(phase30b), "run-all missing Phase 30B aesthetic memory UI surface.");
  assert(runAllText.indexOf(phase30a) < runAllText.indexOf(phase30b), "Phase 30B should run after Phase 30A.");
  assert(runAllText.indexOf(phase30b) < runAllText.indexOf(daily), "Phase 30B should run before Daily scripts and docs.");
}

function assertStaticSurfaceTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_registry_ui_surface",
    "overview_cards",
    "一眼看懂",
    "禁止項目",
    "偏好項目",
    "必守原則",
    "覆蓋狀態",
    "流程使用方式",
    "safety_badges",
    "raw_registry",
    "memory_file_written",
    "can_write_canon",
    "can_update_active_engine",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory UI surface missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase30B active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase30B compressed_rules hash baseline drifted before test.");

const [runAllText, uiSurfaceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(uiSurfacePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticSurfaceTokens(uiSurfaceText);
assert.equal(aestheticMemoryUiSurfaceVersion, "aesthetic_memory_ui_surface_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase30B aesthetic memory UI surface smoke.",
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
      key: "prefer_scene_objects",
      category: "scene_structure",
      polarity: "prefer",
      label: "用具體物件承壓",
      rule: "先寫物件與動作，再寫說明。",
      rationale: "讀者需要感到場面正在發生。",
      strength: 93,
      applies_to: ["generation", "revision"],
      examples: ["門禁燈閃紅。"],
    },
  ],
});

const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });

assert.equal(surface.used, true);
assert.equal(surface.phase, "30B");
assert.equal(surface.version, aestheticMemoryUiSurfaceVersion);
assert.equal(surface.ui_kind, "aesthetic_memory_registry_ui_surface");
assert.equal(surface.source_phase, "30A");
assert.equal(surface.status, "ready");
assert.equal(surface.status_badge.tone, "ready");
assert.match(surface.headline, /審美記憶/u);
assert.match(surface.summary, /審美記憶分數/u);
assert.match(surface.summary, /偏好／必守/u);
assert.equal(surface.aesthetic_memory_score, registry.aesthetic_memory_score);
assert.equal(surface.coverage_summary.complete, true);
assert.deepEqual(surface.coverage_summary.missing_categories, []);
assert.equal(surface.raw_registry, null);
assert.match(surface.surface_markdown, /Aesthetic Memory Registry UI Surface/u);
assert.match(surface.surface_markdown, /read_only: true/u);
assert.match(surface.surface_markdown, /can_write_canon: false/u);
assert.match(surface.surface_markdown, /memory_file_written: false/u);

const overviewCards = keyed(surface.overview_cards, "overview cards");
assert.deepEqual(
  [...overviewCards.keys()],
  [
    "aesthetic_memory_overall",
    "positive_preferences",
    "avoidance_rules",
    "coverage_categories",
    "watch_items",
  ],
  "Phase30B overview card order drifted.",
);
assert.equal(overviewCards.get("aesthetic_memory_overall")?.label, "審美記憶");
assert.equal(overviewCards.get("avoidance_rules")?.label, "禁忌");
for (const card of overviewCards.values()) {
  assert(["ready", "watch", "blocked", "neutral"].includes(card.tone), `${card.key} has non-displayable tone.`);
}

const sections = keyed(surface.sections, "surface sections");
assert.deepEqual(
  [...sections.keys()],
  [
    "at_a_glance",
    "forbidden_patterns",
    "preferred_patterns",
    "required_principles",
    "watch_items",
    "coverage",
    "provider_usage",
    "safety_boundary",
  ],
  "Phase30B sections should stay human-readable and stable.",
);
assert.equal(sections.get("at_a_glance")?.title, "一眼看懂");
assert.equal(sections.get("forbidden_patterns")?.title, "禁止項目");
assert.equal(sections.get("preferred_patterns")?.title, "偏好項目");
assert.equal(sections.get("required_principles")?.title, "必守原則");
assert.equal(sections.get("coverage")?.items.some((item) => item.key === "dialogue"), true);
assert.equal(sections.get("provider_usage")?.items.some((item) => item.key === "generation_payload_key"), true);
assert.equal(sections.get("safety_boundary")?.items.some((item) => item.key === "memory_file_written"), true);
assert.equal(surface.next_operator_action.key, "manual_aesthetic_review");
assert.equal(surface.next_operator_action.ui_target, "aesthetic-memory");

const safetyBadges = keyed(surface.safety_badges, "safety badges");
assert.equal(safetyBadges.get("read_only")?.value, true);
assert.equal(safetyBadges.get("preview_only")?.value, true);
assert.equal(safetyBadges.get("can_write_canon")?.value, false);
assert.equal(safetyBadges.get("can_update_active_engine")?.value, false);
assert.equal(safetyBadges.get("can_update_compressed_rules")?.value, false);
assert.equal(safetyBadges.get("can_modify_runtime_ui")?.value, false);
assert.equal(safetyBadges.get("can_register_mcp_tool")?.value, false);
assert.equal(safetyBadges.get("memory_file_written")?.value, false);
assert.equal(safetyBadges.get("mcp_tool_added")?.value, false);

assert.equal(surface.safety.read_only, true);
assert.equal(surface.safety.preview_only, true);
assert.equal(surface.safety.candidate_only, true);
assert.equal(surface.safety.no_auto_persist, true);
assert.equal(surface.safety.no_generation, true);
assert.equal(surface.safety.no_candidate_save, true);
assert.equal(surface.safety.no_approval, true);
assert.equal(surface.safety.no_canon_update, true);
assert.equal(surface.safety.no_active_engine_update, true);
assert.equal(surface.safety.no_compressed_rules_update, true);
assert.equal(surface.safety.can_write_canon, false);
assert.equal(surface.safety.can_update_active_engine, false);
assert.equal(surface.safety.can_update_compressed_rules, false);
assert.equal(surface.safety.can_modify_runtime_ui, false);
assert.equal(surface.safety.can_register_mcp_tool, false);
assert.equal(surface.safety.active_engine_modified, false);
assert.equal(surface.safety.compressed_rules_modified, false);
assert.equal(surface.safety.candidate_saved, false);
assert.equal(surface.safety.canon_written, false);
assert.equal(surface.safety.approval_item_created, false);
assert.equal(surface.safety.runtime_ui_modified, false);
assert.equal(surface.safety.mcp_tool_added, false);
assert.equal(surface.safety.memory_file_written, false);

const rawSurface = await buildAestheticMemoryUiSurface({ registry, include_raw: true, include_markdown: false });
assert.equal(rawSurface.raw_registry.trace_id, registry.trace_id);
assert.equal(rawSurface.surface_markdown, "");

const weakSurface = await buildAestheticMemoryUiSurface({ include_default_seed: false });
assert.equal(weakSurface.status, "needs_context");
assert.equal(weakSurface.status_badge.tone, "empty");
assert.equal(weakSurface.next_operator_action.key, "repair_aesthetic_memory_registry");
assert.equal(weakSurface.safety.no_active_engine_update, true);
assert.equal(weakSurface.safety.can_write_canon, false);
assert.equal(weakSurface.safety.memory_file_written, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase30B changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase30B changed compressed_rules hash.");

console.log("Phase30B aesthetic memory registry UI surface tests passed.");
