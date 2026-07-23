import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
} from "node:fs/promises";
import path from "node:path";

import {
  buildCharacterCanonGrounding,
} from "../../server/src/character-canon-grounding-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  buildDeterministicOverGovernanceReport,
  buildDeterministicScenePlan,
} from "../../server/src/external-brain-generation-surface-service.mjs";
import {
  buildNeuralModuleContractRegistry,
} from "../../server/src/neural-module-service.mjs";
import {
  buildPostDraftNeuralCritique,
  buildPostDraftStyleDriftReport,
} from "../../server/src/post-draft-line-diagnostic-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const protectedRelativePaths = [
  "data/canon_db/active_engine.md",
  "data/error_report_db/compressed_rules.md",
  "data/writing_policy_db/active_writing_card.md",
  "data/proofing_policy_db/active_proofing_card.md",
  "data/longline_db/active_longline.md",
  "data/outputs/task_prompt.md",
  "data/outputs/generation_context.md",
  "data/outputs/retrieval_context.md",
];

const expectedModules = [
  "scene_planner",
  "character_simulator",
  "over_governance_detector",
  "writing_card_director",
  "neural_critic",
  "style_drift_detector",
  "final_polisher",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function protectedHashes() {
  return Object.fromEntries(await Promise.all(
    protectedRelativePaths.map(async (relativePath) => [
      relativePath,
      sha256(await readFile(path.join(projectRoot, relativePath))),
    ]),
  ));
}

async function directoryCount(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

function records(relevantCanon) {
  return [
    ...relevantCanon.characters,
    ...relevantCanon.current_status,
    ...relevantCanon.abilities_and_weapons,
    ...relevantCanon.world_rules,
    ...relevantCanon.timeline_and_events,
    ...relevantCanon.continuity_facts,
  ];
}

const hashesBefore = await protectedHashes();
const writingContextsBefore = await directoryCount(
  projectPaths.gptWritingContexts,
);
const activeEngineText = await readFile(
  projectPaths.activeEngine,
  "utf8",
);
const repeatedAuthoritySentence =
  "只整理 Canon、entity、continuity 與權限契約，不決定故事事件。";
const taskPrompt = (
  "建立涉及九逃目前傷勢、御先尚未解決的殘留狀態，以及異能武裝使用限制的正式寫作上下文。"
  + repeatedAuthoritySentence
);

const session = await beginChatgptOwnedExternalBrainWritingSession({
  task_prompt: taskPrompt,
  chapter_mode: "next_chapter",
  max_context_chars: 48_000,
  ephemeral: true,
});

assert.equal(session.ok, true);
assert.equal(session.status, "ephemeral_context_ready");
assert.equal(session.context_persisted, false);
assert.equal(session.writing_context_record_created, false);
assert.equal(session.external_brain_session_id, null);
assert.equal(session.writing_context_bundle_id, null);
assert.equal(typeof session.ephemeral_context_id, "string");

const formal = session.formal_context;
const composition = session.context_composition;
const materials = formal.materials;
const plan = materials.retrieval_plan;
const relevantCanon = materials.relevant_canon;
const allRecords = records(relevantCanon);
const allContent = allRecords.map((record) => record.content).join("\n");

assert.deepEqual(plan.characters, ["九逃", "御先"]);
assert.deepEqual(
  plan.status_effects,
  ["九逃目前傷勢", "御先尚未解決的殘留狀態"],
);
assert(plan.world_rules.includes("異能武裝召喚與維持準則"));
assert(plan.world_rules.includes("能力體系"));
assert(plan.world_rules.includes("高科技靈力醫療與治療限制"));
assert.equal(plan.characters.includes("異能武裝"), false);
assert.equal(plan.match_policy.exact_name_before_alias, true);
assert.equal(plan.match_policy.category_scoped, true);

assert(relevantCanon.characters.some(
  (record) => record.entity_id === "CHAR-九逃-6495AE61EA",
));
assert(relevantCanon.characters.some(
  (record) => record.entity_id === "CHAR-御先-7794E69FE4",
));
assert.match(allContent, /九逃[^]*左前臂裂傷/u);
assert.match(allContent, /左肩外側切創/u);
assert.match(allContent, /當日不得再進訓練場|左臂當晚不能沾水/u);
assert.match(allContent, /御先[^]*未分類靈力殘痕/u);
assert.match(allContent, /武裝解除末段/u);
assert(relevantCanon.abilities_and_weapons.some(
  (record) => record.entity_id === "WEAPON-聖星法典-E2E71F9FA1",
));
assert(relevantCanon.world_rules.some(
  (record) => record.entity_id
    === "RULE-異能武裝靈魂內收納-召喚與維持準則-FB89D3EFFC",
));
assert(relevantCanon.world_rules.some(
  (record) => record.entity_id === "RULE-能力體系-DC1C5E6273",
));
assert(relevantCanon.world_rules.some(
  (record) => record.entity_id
    === "RULE-高科技靈力醫療-治療型武裝與生命復歸-29CEE66034",
));
assert(relevantCanon.timeline_and_events.some(
  (record) => record.category === "timeline_event"
    && record.entity_id.startsWith(
      "settlement_report_20260722-132349-1bbe3b4c#",
    ),
));

const registryProvenance = relevantCanon.provenance.find(
  (entry) => entry.source === "structured_canon_entity_registry",
);
assert.equal(registryProvenance.freshness, "stale");
assert.equal(registryProvenance.hard_fact_authority, false);
for (const record of allRecords.filter(
  (entry) => entry.source.kind === "active_engine_bounded_retrieval",
)) {
  assert.equal(record.freshness, "current");
  assert.equal(record.source_hash, formal.active_engine_metadata.sha256);
  assert(record.provenance.some(
    (entry) => entry.freshness === "stale"
      && entry.corroborated_by_current_active_engine === true,
  ));
}

assert.equal(composition.active_engine_text_requested, false);
assert.equal(composition.active_engine_full_text_included, false);
assert(composition.active_engine_retrieval_chars > 0);
assert(composition.active_engine_retrieval_chars <= 12_000);
assert.equal(composition.proofing_card_included, false);
assert.equal(composition.writing_card_included, false);
assert.equal(composition.longline_included, false);
assert.equal(composition.transition_suggestion_included, false);
assert.equal(
  composition.relevant_canon_chars,
  JSON.stringify(relevantCanon, null, 2).length,
);
assert(composition.relevant_canon_chars <= 18_000);
assert.equal(
  composition.total_chars_after_budget,
  JSON.stringify(formal, null, 2).length,
);
assert(composition.total_chars_after_budget <= 48_000);
assert.equal(JSON.stringify(formal).includes(activeEngineText.trim()), false);

assert.equal(Object.hasOwn(materials, "longline"), false);
assert.equal(Object.hasOwn(materials, "latest_continuity_overlay"), false);
assert.equal(Object.hasOwn(materials, "character_canon_grounding"), false);
assert.equal(Object.hasOwn(materials, "world_entity_canon_grounding"), false);
assert.equal(materials.continuity.transition_suggestion_included, false);
assert.equal(JSON.stringify(formal).includes("下一章銜接判斷"), false);
for (const removedAnchorField of [
  "required_core_characters",
  "allowed_supporting_characters",
  "forbidden_characters",
  "forbidden_events",
  "allowed_scope",
]) {
  assert.equal(Object.hasOwn(materials.chapter_anchor, removedAnchorField), false);
}

const formalText = JSON.stringify(formal);
assert.equal(formalText.includes("不決定故事事件"), false);
assert.equal(
  formalText.split('"creative_authority":').length - 1,
  1,
);
assert(
  formalText.split("Canon defines facts; ChatGPT owns narrative decisions.")
    .length - 1 <= 1,
);

const contracts = buildNeuralModuleContractRegistry();
assert.deepEqual(
  Object.keys(contracts),
  ["common_neural_module_permissions", "modules"],
);
assert.deepEqual(
  Object.keys(contracts.modules).sort(),
  [...expectedModules].sort(),
);
for (const moduleName of expectedModules) {
  assert.equal(
    contracts.modules[moduleName].permissions.inherits,
    "common_neural_module_permissions",
  );
}
assert.equal(
  formalText.split('"common_neural_module_permissions":').length - 1,
  1,
);
assert.equal(
  formalText.split('"inherits":"common_neural_module_permissions"').length - 1,
  7,
);

const grounding = buildCharacterCanonGrounding({
  activeEngineContent: activeEngineText,
  sourceFile: "data/canon_db/active_engine.md",
  taskPrompt,
  explicitCharacterNames: plan.characters,
});
assert.deepEqual(
  grounding.characters.map((record) => record.canonical_name),
  ["九逃", "御先"],
);
assert.equal(
  grounding.characters.some(
    (record) => record.canonical_name === "異能武裝",
  ),
  false,
);
assert.equal(
  grounding.mention_resolution.ambiguous_mentions.some(
    (record) => ["九逃", "御先"].includes(record.canonical_name),
  ),
  false,
);

const scene = buildDeterministicScenePlan({
  taskPrompt,
  writingContext: { formal_context: formal },
});
const governance = buildDeterministicOverGovernanceReport({
  taskPrompt,
});
const critic = buildPostDraftNeuralCritique({ taskPrompt });
const style = buildPostDraftStyleDriftReport({ taskPrompt });
for (const output of [scene, governance, critic, style]) {
  assert.equal(JSON.stringify(output).includes(repeatedAuthoritySentence), false);
  assert.equal(JSON.stringify(output).includes("不決定故事事件"), false);
}
assert.equal(critic.status, "inactive");
assert.equal(style.status, "inactive");

assert.deepEqual(await protectedHashes(), hashesBefore);
assert.equal(
  await directoryCount(projectPaths.gptWritingContexts),
  writingContextsBefore,
);

for (const guard of [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
]) {
  assert.equal(session[guard], false);
}

console.log(JSON.stringify({
  relevant_canon_chars: composition.relevant_canon_chars,
  active_engine_retrieval_chars:
    composition.active_engine_retrieval_chars,
  total_chars_after_budget:
    composition.total_chars_after_budget,
  writing_contexts_before: writingContextsBefore,
  writing_contexts_after:
    await directoryCount(projectPaths.gptWritingContexts),
}));
console.log(
  "Phase58A formal relevant Canon and ephemeral context test passed.",
);
