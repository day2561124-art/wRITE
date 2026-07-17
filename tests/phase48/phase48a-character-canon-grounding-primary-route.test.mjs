import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildCharacterCanonGrounding,
  parseActiveEngineCharacterRecords,
} from "../../server/src/character-canon-grounding-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
  externalBrainPreGenerationCapabilities,
  useChatgptOwnedExternalBrainCapability,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  buildGptWritingContext,
  getGptWritingContextBundle,
} from "../../server/src/gpt-writing-context-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const prompt = "寫初日、初夢、晴禮在休息間找少掉布丁的日常番外。";
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase48a-character-canon-grounding-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const expectedProtectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};

async function treeDigest(root) {
  const records = [];
  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.join(prefix, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) records.push(`${relative}:${sha256(await readFile(absolute))}`);
    }
  }
  await visit(root);
  return sha256(records.join("\n"));
}

function byName(packet) {
  return new Map(packet.characters.map((character) => [character.canonical_name, character]));
}

function joinedFacts(character, key) {
  return (character[key] ?? []).join("；");
}

const activeEngine = await readFile(projectPaths.activeEngine, "utf8");
const protectedBefore = {
  active_engine: sha256(activeEngine),
  compressed_rules: sha256(await readFile(projectPaths.compressedRules)),
};
assert.deepEqual(protectedBefore, expectedProtectedHashes);

const mutationRoots = {
  canon_db: projectPaths.canonDb,
  approval_queue: projectPaths.approvalQueue,
  writing_workflow: projectPaths.writingWorkflow,
  writing_candidates: projectPaths.writingCandidates,
};
const mutationBefore = Object.fromEntries(await Promise.all(
  Object.entries(mutationRoots).map(async ([name, root]) => [name, await treeDigest(root)]),
));

await mkdir(fixtureRoot, { recursive: true });

try {
  const parsed = parseActiveEngineCharacterRecords(activeEngine, {
    sourceFile: "data/canon_db/active_engine.md",
  });
  assert(parsed.length > 20, "Parser did not discover the active_engine character tables.");

  const aliasFixture = [
    "# 泛化表",
    "",
    "| 姓名 | 性別／身分 | 所屬 | 外觀 | 正式邊界 |",
    "|---|---|---|---|---|",
    "| 泛化測試角色 | 女；二年級 | 測試學院 | 銀髮、金眼 | 測試隊隊長 |",
  ].join("\n");
  const aliasRecord = parseActiveEngineCharacterRecords(aliasFixture)[0];
  assert.equal(aliasRecord.canonical_name, "泛化測試角色");
  assert.equal(aliasRecord.gender, "female");
  assert.equal(aliasRecord.pronouns.third_person, "她");
  assert.match(joinedFacts(aliasRecord, "appearance_facts"), /銀髮.*金眼/u);

  const grounding = buildCharacterCanonGrounding({
    activeEngineContent: activeEngine,
    sourceFile: "data/canon_db/active_engine.md",
    taskPrompt: prompt,
    generationContext: { location: "休息間" },
    retrievalContext: { object: "少掉的布丁" },
  });
  assert.equal(grounding.source_authority, "active_engine_canon_high_authority");
  assert.equal(grounding.matched_character_count, 3);
  assert.deepEqual(grounding.characters.map((character) => character.canonical_name), [
    "初日",
    "初夢",
    "晴禮",
  ]);
  const grounded = byName(grounding);
  for (const name of ["初日", "初夢"]) {
    assert.equal(grounded.get(name).gender, "male");
    assert.equal(grounded.get(name).pronouns.third_person, "他");
    assert.equal(grounded.get(name).pronouns.second_person, "你");
  }
  assert.equal(grounded.get("晴禮").gender, "female");
  assert.equal(grounded.get("晴禮").pronouns.third_person, "她");
  assert.equal(grounded.get("晴禮").pronouns.second_person, "妳");
  for (const token of ["白髮", "紫色", "桃色", "挑染", "紫眼"]) {
    assert(joinedFacts(grounded.get("初夢"), "appearance_facts").includes(token));
  }
  for (const token of ["白髮", "紫色", "桃色", "挑染", "藍綠眼"]) {
    assert(joinedFacts(grounded.get("晴禮"), "appearance_facts").includes(token));
  }
  assert.equal(grounding.body_trait_policy.unlisted_traits_mean_canon_absence, false);
  assert.equal(grounding.body_trait_policy.unsupported_new_trait_invention_forbidden, true);
  assert.match(grounding.body_trait_policy.rule, /unsupported new body-trait invention is forbidden/iu);
  assert.equal(grounded.get("初夢").explicit_body_traits.some((fact) => /狐|狐狸/u.test(fact)), false);
  assert.equal(grounded.get("晴禮").explicit_body_traits.some((fact) => /兔/u.test(fact)), false);

  const legalTraitGrounding = buildCharacterCanonGrounding({
    activeEngineContent: activeEngine,
    sourceFile: "data/canon_db/active_engine.md",
    taskPrompt: "寫夜安晴、夜文澤、鹿梅與拉芙蒂・里德斯特整理道具。",
  });
  const legalTraits = byName(legalTraitGrounding);
  assert.match(joinedFacts(legalTraits.get("夜安晴"), "explicit_body_traits"), /狼族獸耳獸尾/u);
  assert.match(joinedFacts(legalTraits.get("夜文澤"), "explicit_body_traits"), /貓族獸耳獸尾/u);
  assert.match(joinedFacts(legalTraits.get("鹿梅"), "explicit_body_traits"), /鹿耳鹿角/u);
  assert.match(joinedFacts(legalTraits.get("拉芙蒂・里德斯特"), "explicit_body_traits"), /尖精靈耳/u);

  const built = await buildGptWritingContext({
    task_prompt: prompt,
    generation_context: { location: "休息間", requested_mode: "日常番外" },
    retrieval_context: { missing_item: "布丁" },
    max_context_chars: 48_000,
  }, options);
  assert.equal(built.bundle.max_context_chars, 48_000);
  assert.equal(built.bundle.character_canon_grounding_loaded, true);
  assert.equal(built.bundle.character_canon_grounding_count, 3);
  assert.equal(
    built.bundle.character_canon_grounding_source_authority,
    "active_engine_canon_high_authority",
  );
  assert(built.bundle.truncated_sections.includes("active_engine_excerpt_or_reference"));
  assert.deepEqual(
    built.bundle.content.character_canon_grounding.characters.map((character) => (
      character.canonical_name
    )),
    ["初日", "初夢", "晴禮"],
  );

  const stored = await getGptWritingContextBundle(built.bundle.bundle_id, options);
  const guardIndex = stored.context_for_chat.indexOf("## 【P0｜Character Canon Grounding】");
  const anchorIndex = stored.context_for_chat.indexOf("## 【P0｜本章錨點鎖】");
  const taskIndex = stored.context_for_chat.indexOf("## Task Prompt");
  assert(guardIndex >= 0 && guardIndex < anchorIndex && anchorIndex < taskIndex);
  assert.match(stored.context_for_chat, /初日｜gender=male｜third_person=他｜second_person=你/u);
  assert.match(stored.context_for_chat, /初夢｜gender=male｜third_person=他｜second_person=你/u);
  assert.match(stored.context_for_chat, /晴禮｜gender=female｜third_person=她｜second_person=妳/u);
  assert.match(stored.context_for_chat, /Do not invent animal ears, tails, horns, wings, scales/iu);
  assert.equal(stored.context_for_chat.includes(activeEngine), false);

  const begin = await beginChatgptOwnedExternalBrainWritingSession({
    task_prompt: prompt,
    generation_context: { location: "休息間", requested_mode: "日常番外" },
    retrieval_context: { missing_item: "布丁" },
  }, options);
  assert.equal(begin.ok, true);
  assert.equal(begin.prose_generator, "ChatGPT");
  assert.equal("writing_context" in begin, false);
  assert.equal("context_for_chat" in begin, false);
  assert.equal("context_bundle" in begin, false);
  assert(Buffer.byteLength(JSON.stringify(begin), "utf8") < 16 * 1024);

  const capabilityInput = {
    external_brain_session_id: begin.external_brain_session_id,
    writing_context_bundle_id: begin.writing_context_bundle_id,
    capability_input: { phase: "48A" },
  };
  const outputs = new Map();
  for (const capabilityName of externalBrainPreGenerationCapabilities) {
    const response = await useChatgptOwnedExternalBrainCapability(
      capabilityName,
      capabilityInput,
      options,
    );
    assert.equal(response.ok, true, `${capabilityName} must succeed`);
    assert.equal(response.candidate_created, false);
    assert.equal(response.canon_updated, false);
    assert.equal(response.active_engine_updated, false);
    assert.equal(response.adopted, false);
    assert.equal(response.settled, false);
    outputs.set(capabilityName, response.capability_output);
  }

  const simulator = outputs.get("run_character_simulator");
  assert.equal(simulator.character_canon_grounding_loaded, true);
  assert.equal(simulator.character_canon_grounding_count, 3);
  const simulated = new Map(simulator.character_hard_facts.map((fact) => [fact.canonical_name, fact]));
  assert.equal(simulated.get("初日").gender, "male");
  assert.equal(simulated.get("初夢").pronouns.third_person, "他");
  assert.equal(simulated.get("晴禮").pronouns.second_person, "妳");
  assert.match(joinedFacts(simulated.get("初夢"), "appearance_facts"), /白髮.*紫色.*桃色.*挑染.*紫眼/u);
  assert.equal(
    Object.hasOwn(simulator, "behavior_constraints"),
    false,
  );

  const critic = outputs.get("run_neural_critic");
  assert.equal(critic.evidence_only, true);
  assert.deepEqual(critic.hard_risk_scope, [
    "canon",
    "causality",
    "identity",
    "character_state",
    "timeline",
    "explicit_user_requirement",
  ]);
  assert.equal(Object.hasOwn(critic, "risks"), false);
  assert.equal(
    critic.character_canon_grounding_count,
    3,
  );

  const director = outputs.get("run_writing_card_director");
  assert.deepEqual(director.hard_authority, [
    "Canon",
    "causal continuity",
    "character identity and state",
    "timeline",
    "explicit user requirements",
  ]);
  assert.match(
    director.arbitration_rule,
    /do not convert diagnostics into prose requirements/iu,
  );
  assert.equal(
    Object.hasOwn(director, "authority_precedence"),
    false,
  );
  assert.equal(
    director.character_canon_grounding_count,
    3,
  );
  assert.deepEqual(
    director.character_hard_facts.map(
      (fact) => fact.canonical_name,
    ),
    ["初日", "初夢", "晴禮"],
  );

  const rawStory = "初夢看向桌面。晴禮把布丁杯放回初日面前。";
  const polished = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...capabilityInput,
      raw_story_text: rawStory,
      raw_story_sha256: sha256(rawStory),
    },
    options,
  );
  assert.equal(polished.ok, true);
  assert.equal(polished.prose_generator, "ChatGPT");
  assert.equal(
    polished.capability_output.findings_review_mode,
    "hard_conflicts_and_exact_evidence_only",
  );
  assert.equal(
    polished.capability_output
      .character_canon_grounding_count,
    3,
  );
  assert.equal(
    Object.hasOwn(
      polished.capability_output,
      "findings",
    ),
    false,
  );
  assert.equal(
    polished.capability_output.release_recommendation,
    "release_as_is",
  );

  assert.equal("polished_text" in polished.capability_output, false);

  assert.deepEqual(Object.fromEntries(await Promise.all(
    Object.entries(mutationRoots).map(async ([name, root]) => [name, await treeDigest(root)]),
  )), mutationBefore);
  assert.deepEqual({
    active_engine: sha256(await readFile(projectPaths.activeEngine)),
    compressed_rules: sha256(await readFile(projectPaths.compressedRules)),
  }, protectedBefore);

  console.log(
    "Phase48A character Canon grounding primary route PASS: extraction, 48K independence, fixed P0 guard, simulator/critic/director/final-polisher, compact bootstrap, and mutation guards verified.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
