import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  aestheticMemoryRegistryVersion,
  buildAestheticMemoryRegistryContract,
} from "../../server/src/aesthetic-memory-registry-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const servicePath = path.join(root, "server", "src", "aesthetic-memory-registry-service.mjs");
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
  const phase29c = "tests/phase29/phase29c-reader-response-simulator-bridge-preview.test.mjs";
  const phase30a = "tests/phase30/phase30a-aesthetic-memory-registry-contract.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase29c), "run-all missing Phase 29C predecessor.");
  assert(runAllText.includes(phase30a), "run-all missing Phase 30A aesthetic memory registry contract.");
  assert(runAllText.indexOf(phase29c) < runAllText.indexOf(phase30a), "Phase 30A should run after Phase 29C.");
  assert(runAllText.indexOf(phase30a) < runAllText.indexOf(daily), "Phase 30A should run before Daily scripts and docs.");
}

function assertStaticServiceTokens(serviceText) {
  for (const token of [
    "aesthetic_memory_registry",
    "long_term_aesthetic_memory",
    "avoid_flowchart_prose",
    "avoid_queue_dialogue",
    "require_one_chapter_one_change",
    "prefer_living_character_behavior",
    "require_world_consistent_creativity",
    "prefer_readable_ui_summary",
    "can_write_canon",
    "can_update_active_engine",
    "memory_file_written",
  ]) {
    assert(serviceText.includes(token), `aesthetic memory registry missing token: ${token}`);
  }
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase30A active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase30A compressed_rules hash baseline drifted before test.");

const [runAllText, serviceText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(servicePath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertStaticServiceTokens(serviceText);
assert.equal(aestheticMemoryRegistryVersion, "aesthetic_memory_registry_v1");

const registry = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase30A aesthetic memory registry contract smoke.",
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

assert.equal(registry.used, true);
assert.equal(registry.phase, "30A");
assert.equal(registry.version, aestheticMemoryRegistryVersion);
assert.equal(registry.registry_kind, "aesthetic_memory_registry");
assert.equal(registry.memory_scope, "long_term_aesthetic_memory");
assert.equal(registry.status, "completed");
assert.equal(registry.read_only, true);
assert.equal(registry.contract_only, true);
assert.equal(registry.preview_only, true);
assert.equal(registry.candidate_only, true);
assert.equal(registry.no_generation, true);
assert.equal(registry.no_auto_persist, true);
assert.equal(registry.no_candidate_save, true);
assert.equal(registry.no_approval, true);
assert.equal(registry.no_canon_update, true);
assert.equal(registry.no_active_engine_update, true);
assert.equal(registry.no_compressed_rules_update, true);
assert.equal(registry.no_runtime_ui, true);
assert.equal(registry.no_mcp_tool, true);
assert.equal(registry.source.default_seed_used, true);
assert.match(registry.source.input_digest, /^[a-f0-9]{64}$/u);
assert.match(registry.source.entries_digest, /^[a-f0-9]{64}$/u);
assert.match(registry.trace_id, /^aesthetic_memory_[a-f0-9]{16}$/u);
assert(registry.entries.length >= 10, "default seed plus custom memories should be present.");
assert.equal(registry.coverage.complete, true);
assert.deepEqual(registry.coverage.missing_categories, []);
assert.equal(registry.aesthetic_memory_score >= 76, true);

const entries = keyed(registry.entries, "aesthetic memory entries");
assert.equal(entries.get("avoid_flowchart_prose")?.polarity, "avoid");
assert.equal(entries.get("avoid_queue_dialogue")?.category, "dialogue");
assert.equal(entries.get("require_one_chapter_one_change")?.polarity, "require");
assert.equal(entries.get("prefer_living_character_behavior")?.category, "character_life");
assert.equal(entries.get("require_world_consistent_creativity")?.strength, 100);
assert.equal(entries.get("prefer_readable_ui_summary")?.category, "ui_readability");
assert.equal(entries.get("prefer_scene_objects")?.rule, "先寫物件與動作，再寫說明。");

const cards = keyed(registry.cards, "aesthetic memory cards");
assert.deepEqual(
  [...cards.keys()],
  [
    "aesthetic_memory_overall",
    "positive_preferences",
    "avoidance_rules",
    "coverage_categories",
    "watch_items",
  ],
  "Phase30A card order drifted.",
);
assert.equal(cards.get("aesthetic_memory_overall")?.label, "審美記憶");
assert.equal(cards.get("avoidance_rules")?.label, "禁忌");
assert(["safe", "watch", "blocked"].includes(cards.get("coverage_categories")?.tone));

assert.equal(registry.provider_contract.generation_payload_key, "aesthetic_memory_registry");
assert.equal(registry.provider_contract.revision_payload_key, "aesthetic_memory_registry");
assert.equal(registry.provider_contract.final_polisher_payload_key, "aesthetic_memory_registry");
assert.equal(registry.provider_contract.reader_response_payload_key, "aesthetic_memory_registry");
assert(registry.provider_contract.required_principles.includes("require_one_chapter_one_change"));
assert(registry.provider_contract.prohibited_patterns.includes("avoid_flowchart_prose"));
assert(registry.provider_contract.preferred_patterns.includes("prefer_living_character_behavior"));

for (const key of [
  "read_only",
  "contract_only",
  "preview_only",
  "candidate_only",
  "no_generation",
  "no_auto_persist",
  "no_candidate_save",
  "no_approval",
]) {
  assert.equal(registry.safety_boundary[key], true, `safety boundary ${key} must stay true.`);
}
for (const key of [
  "can_write_canon",
  "can_update_active_engine",
  "can_update_compressed_rules",
  "can_modify_runtime_ui",
  "can_register_mcp_tool",
]) {
  assert.equal(registry.safety_boundary[key], false, `safety boundary ${key} must stay false.`);
}
for (const key of [
  "active_engine_modified",
  "compressed_rules_modified",
  "candidate_saved",
  "canon_written",
  "approval_item_created",
  "runtime_ui_modified",
  "mcp_tool_added",
  "memory_file_written",
]) {
  assert.equal(registry.no_mutation_snapshot[key], false, `no mutation ${key} must stay false.`);
}

const deterministic = await buildAestheticMemoryRegistryContract({
  task_prompt: "Phase30A aesthetic memory registry contract smoke.",
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
assert.deepEqual(deterministic, registry, "Phase30A registry should be deterministic for the same input.");

const emptyNoSeed = await buildAestheticMemoryRegistryContract({ include_default_seed: false });
assert.equal(emptyNoSeed.status, "incomplete");
assert(emptyNoSeed.missing_fields.includes("missing_aesthetic_memory_entries"));
assert(emptyNoSeed.warnings.includes("aesthetic_memory_registry_incomplete"));

const partialNoSeed = await buildAestheticMemoryRegistryContract({
  include_default_seed: false,
  rejected_patterns: ["流程化語氣"],
});
assert.equal(partialNoSeed.status, "incomplete");
assert(partialNoSeed.missing_fields.includes("missing_positive_preferences"));
assert(partialNoSeed.coverage.missing_categories.includes("dialogue"));
assert.equal(partialNoSeed.safety_boundary.can_write_canon, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase30A changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase30A changed compressed_rules hash.");

console.log("Phase30A aesthetic memory registry contract tests passed.");
