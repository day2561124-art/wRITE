import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildCharacterCanonGrounding,
  canonCharacterMentionStatuses,
  parseActiveEngineCharacterRecords,
  resolveCanonCharacterMention,
} from "../../server/src/character-canon-grounding-service.mjs";
import { expandGeneratedCastCanonGrounding } from "../../server/src/generated-cast-canon-grounding-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
  externalBrainPreGenerationCapabilities,
  useChatgptOwnedExternalBrainCapability,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase48b-generated-cast-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
const expectedProtectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const guardNames = [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
];

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
  return (character?.[key] ?? []).join("；");
}

function assertGuards(response) {
  for (const name of guardNames) assert.equal(response[name], false, `${name} changed`);
}

async function startReadySession(taskPrompt) {
  const begin = await beginChatgptOwnedExternalBrainWritingSession({
    task_prompt: taskPrompt,
    generation_context: { location: "休息間" },
    retrieval_context: { object: "布丁" },
  }, options);
  assert.equal(begin.ok, true);
  assert.equal("writing_context" in begin, false);
  assert.equal("context_for_chat" in begin, false);
  assert.equal("context_bundle" in begin, false);
  assert(Buffer.byteLength(JSON.stringify(begin), "utf8") < 16 * 1024);
  const common = {
    external_brain_session_id: begin.external_brain_session_id,
    writing_context_bundle_id: begin.writing_context_bundle_id,
    capability_input: { phase: "48B" },
  };
  const outputs = new Map();
  for (const capabilityName of externalBrainPreGenerationCapabilities) {
    const response = await useChatgptOwnedExternalBrainCapability(
      capabilityName,
      common,
      options,
    );
    assert.equal(response.ok, true, `${capabilityName} failed`);
    assertGuards(response);
    outputs.set(capabilityName, response.capability_output);
  }
  return { begin, common, outputs };
}

const activeEngine = await readFile(projectPaths.activeEngine, "utf8");
const protectedBefore = {
  active_engine: sha256(activeEngine),
  compressed_rules: sha256(await readFile(projectPaths.compressedRules)),
};
assert.deepEqual(protectedBefore, expectedProtectedHashes);
const mutationRoots = {
  canon_db: projectPaths.canonDb,
  entity_registry: projectPaths.entityRegistry,
  approval_queue: projectPaths.approvalQueue,
  writing_candidates: projectPaths.writingCandidates,
  candidate_drafts: projectPaths.candidateDrafts,
  settlements: projectPaths.settlementWorkflow,
};
const mutationBefore = Object.fromEntries(await Promise.all(
  Object.entries(mutationRoots).map(async ([name, root]) => [name, await treeDigest(root)]),
));

await mkdir(fixtureRoot, { recursive: true });

try {
  const records = parseActiveEngineCharacterRecords(activeEngine);
  assert(records.length > 20);

  // TEST A: Phase48A facts remain intact.
  const phase48a = buildCharacterCanonGrounding({
    activeEngineContent: activeEngine,
    taskPrompt: "寫初日、初夢、晴禮在休息間找少掉布丁的日常番外。",
  });
  const phase48aCharacters = byName(phase48a);
  assert.equal(phase48aCharacters.get("初日").gender, "male");
  assert.equal(phase48aCharacters.get("初夢").pronouns.third_person, "他");
  assert.equal(phase48aCharacters.get("晴禮").pronouns.second_person, "妳");
  assert.match(joinedFacts(phase48aCharacters.get("初夢"), "appearance_facts"), /白髮.*紫色.*桃色.*挑染.*紫眼/u);
  assert.equal(phase48a.body_trait_policy.unsupported_new_trait_invention_forbidden, true);

  // TEST B/C/K/M: context-aware multi-character collision resolution.
  const schoolCollision = resolveCanonCharacterMention(
    "故事發生在夜星武裝學院的休息間。",
    "夜星",
  );
  assert.notEqual(schoolCollision.status, canonCharacterMentionStatuses.confirmed);
  assert.equal(schoolCollision.status, canonCharacterMentionStatuses.ambiguous);
  assert(schoolCollision.ambiguous_occurrences.some((item) => (
    item.reason === "non_character_compound_suffix"
  )));
  assert.equal(
    resolveCanonCharacterMention("夜星把門推開，朝桌邊看了一眼。", "夜星").status,
    canonCharacterMentionStatuses.confirmed,
  );
  assert.notEqual(
    resolveCanonCharacterMention("夜星市域觀測局今天發布公告。", "夜星").status,
    canonCharacterMentionStatuses.confirmed,
  );
  assert.equal(
    resolveCanonCharacterMention("今天大家去了夜星。", "夜星").status,
    canonCharacterMentionStatuses.ambiguous,
  );

  // TEST D/E: single-character names require direct person evidence.
  for (const text of ["夜色很深。", "今天是深夜。", "他們今夜不回宿舍。", "午夜的風很冷。"]) {
    assert.notEqual(
      resolveCanonCharacterMention(text, "夜").status,
      canonCharacterMentionStatuses.confirmed,
      text,
    );
  }
  for (const text of ["夜看向門口。", "「夜，等一下。」"]) {
    assert.equal(
      resolveCanonCharacterMention(text, "夜").status,
      canonCharacterMentionStatuses.confirmed,
      text,
    );
  }
  for (const text of ["地上有血跡。", "傷口正在流血。", "鮮血沾上袖口。"]) {
    assert.notEqual(
      resolveCanonCharacterMention(text, "血").status,
      canonCharacterMentionStatuses.confirmed,
      text,
    );
  }
  for (const text of ["血把杯子放下。", "「血，你先等等。」"]) {
    assert.equal(
      resolveCanonCharacterMention(text, "血").status,
      canonCharacterMentionStatuses.confirmed,
      text,
    );
  }

  // TEST F/L: generated existing cast expands facts, including legal body traits.
  const preGeneration = buildCharacterCanonGrounding({
    activeEngineContent: activeEngine,
    taskPrompt: "寫初夢和晴禮找布丁。",
  });
  assert.deepEqual(
    preGeneration.characters.map((character) => character.canonical_name),
    ["初夢", "晴禮"],
  );
  const generatedStory = [
    "初夢把冰箱門關上。",
    "晴禮還蹲在下層。",
    "門被推開。",
    "初日走進來。",
    "她看了桌上的空杯一眼。",
  ].join("\n");
  const expanded = expandGeneratedCastCanonGrounding({
    rawStoryText: generatedStory,
    rawStorySha256: sha256(generatedStory),
    integrityValidated: true,
    existingCharacterCanonGrounding: preGeneration,
    activeEngineContent: activeEngine,
  });
  assert.deepEqual(expanded.characters.map((character) => character.canonical_name), [
    "初夢",
    "晴禮",
    "初日",
  ]);
  const expandedCharacters = byName(expanded);
  assert.equal(expandedCharacters.get("初日").grounding_classification, "generated_existing_canon_character");
  assert.equal(expandedCharacters.get("初日").gender, "male");
  assert.equal(expandedCharacters.get("初日").pronouns.third_person, "他");
  assert.equal(expandedCharacters.get("初日").pronouns.second_person, "你");

  const legalExpanded = expandGeneratedCastCanonGrounding({
    rawStoryText: "鹿梅走進房間，把箱子放下。",
    integrityValidated: true,
    existingCharacterCanonGrounding: preGeneration,
    activeEngineContent: activeEngine,
  });
  assert.equal(byName(legalExpanded).get("鹿梅").grounding_classification, "generated_existing_canon_character");
  assert.match(joinedFacts(byName(legalExpanded).get("鹿梅"), "explicit_body_traits"), /鹿耳鹿角/u);

  // TEST G/N: complete external-brain route supplies expansion to Final Polisher.
  const generatedSession = await startReadySession("寫初夢和晴禮找少掉的布丁。");
  const director = generatedSession.outputs.get("run_writing_card_director");
  assert.equal(director.original_entity_freedom.contract.original_entity_creation_allowed, true);
  for (const category of [
    "character",
    "country",
    "region",
    "city",
    "administrative_area",
    "administrative_agency",
    "official_institution",
    "school",
    "organization",
    "company",
    "faction",
    "facility",
  ]) {
    assert(
      director.original_entity_freedom.contract.entity_categories.includes(category),
      `Writing Card Director must preserve original entity scope: ${category}`,
    );
  }
  assert.match(director.established_fact_protection, /confidently matched existing entities/iu);
  const criticCodes = new Set(
    generatedSession.outputs.get("run_neural_critic").risks.map((risk) => risk.code),
  );
  for (const code of [
    "canon_entity_name_collision",
    "original_entity_freedom_violation",
    "generated_existing_character_ungrounded",
  ]) assert(criticCodes.has(code));
  const simulator = generatedSession.outputs.get("run_character_simulator");
  assert(simulator.behavior_constraints.some((rule) => /possible original characters remain creatively open/iu.test(rule)));
  assert(simulator.behavior_constraints.some((rule) => /nearest Canon character's gender/iu.test(rule)));

  const generatedFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...generatedSession.common,
      raw_story_text: generatedStory,
      raw_story_sha256: sha256(generatedStory),
    },
    options,
  );
  assert.equal(generatedFinal.ok, true);
  assertGuards(generatedFinal);
  const generatedReport = generatedFinal.capability_output;
  assert.equal(generatedReport.expanded_character_canon_grounding_loaded, true);
  assert.equal(generatedReport.pre_generation_character_count, 2);
  assert.equal(generatedReport.generated_existing_canon_character_count, 1);
  assert(generatedReport.generated_existing_canon_characters.includes("初日"));
  assert.equal(
    new Map(generatedReport.character_hard_facts.map((item) => [item.canonical_name, item]))
      .get("初日").gender,
    "male",
  );
  assert(generatedReport.findings.some((finding) => (
    finding.code === "generated_existing_character_canon_conflict"
  )));
  assert.equal("polished_text" in generatedReport, false);

  // TEST H/I/J/O/Q: failed integrity produces no formal expansion; original entities remain free.
  const originalStory = [
    "初夢把冰箱門關上。",
    "一名叫常盤澪的轉學生抱著紙箱走進來。",
    "她問：「你們是在找這個嗎？」",
    "城北最近成立了霧港市域靈災應變局。",
    "夜星市域觀測局今天也派了聯絡員。",
    "海另一側的新城市璃汐港今年第一次開放學院交流。",
    "北方的岑霧共和國剛完成新一輪交通靈網整併。",
  ].join("\n");
  const originalSession = await startReadySession("寫初夢和晴禮在休息間找布丁。");
  const mismatch = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...originalSession.common,
      raw_story_text: originalStory,
      raw_story_sha256: sha256(`${originalStory}mismatch`),
    },
    options,
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.raw_story_integrity.blocked_stage, "raw_story_handoff_integrity");
  assert.equal(mismatch.capability_output, null);
  assert.equal("expanded_character_canon_grounding" in mismatch, false);

  const originalFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...originalSession.common,
      raw_story_text: originalStory,
      raw_story_sha256: sha256(originalStory),
    },
    options,
  );
  assert.equal(originalFinal.ok, true);
  assertGuards(originalFinal);
  const originalReport = originalFinal.capability_output;
  assert.equal(typeof originalReport.original_entity_freedom, "string");
  assert.match(originalReport.original_entity_freedom, /allow_new/iu);
  assert.match(
    originalReport.original_entity_freedom,
    /absence_not_error_no_block_no_delete/iu,
  );
  assert.match(originalReport.original_entity_freedom, /confident_only/iu);
  assert.match(originalReport.original_entity_freedom, /unresolved/iu);
  assert.match(originalReport.original_entity_freedom, /no_persist/iu);
  assert(originalReport.original_or_unresolved_mentions.some((item) => (
    item.entity_name === "常盤澪" && item.entity_category === "character"
  )));
  assert(originalReport.ambiguous_canon_mentions.some((item) => (
    item.canonical_name === "夜星" && item.reason === "non_character_compound_suffix"
  )));
  assert(originalReport.findings.some((finding) => (
    finding.code === "existing_canon_entity_name_collision"
  )));
  const forbiddenOriginalErrors = /unknown_character_error|unapproved_character|canon_character_required|delete_original_character/iu;
  assert.doesNotMatch(JSON.stringify(originalReport), forbiddenOriginalErrors);
  assert.equal(originalReport.generated_cast_expansion.original_entities_persisted, false);

  // TEST accident replay: 初日 is supplied only by verified generated-cast expansion.
  const replayStory = [
    "初夢的狐狸耳往後壓了一點。",
    "她看向晴禮。",
    "晴禮的兔耳抖了一下。",
    "初日推門進來。",
    "她問：「你們在做什麼？」",
  ].join("\n");
  const replaySession = await startReadySession("寫初夢和晴禮在休息間找布丁。");
  const replayFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...replaySession.common,
      raw_story_text: replayStory,
      raw_story_sha256: sha256(replayStory),
    },
    options,
  );
  assert.equal(replayFinal.ok, true);
  const replayReport = replayFinal.capability_output;
  assert.deepEqual(
    replayReport.character_hard_facts.map((item) => item.canonical_name),
    ["初夢", "晴禮", "初日"],
  );
  assert.equal(replayReport.generated_existing_canon_character_count, 1);
  const replayCodes = new Set(replayReport.findings.map((finding) => finding.code));
  for (const code of [
    "character_pronoun_consistency_conflict",
    "unsupported_body_trait_invention",
    "generated_existing_character_canon_conflict",
  ]) assert(replayCodes.has(code));
  assert.equal(replayReport.findings_review_mode, "requires_chatgpt_semantic_review");

  // TEST P/Q/R: no production mutation or original-entity persistence.
  assert.deepEqual(Object.fromEntries(await Promise.all(
    Object.entries(mutationRoots).map(async ([name, root]) => [name, await treeDigest(root)]),
  )), mutationBefore);
  assert.deepEqual({
    active_engine: sha256(await readFile(projectPaths.activeEngine)),
    compressed_rules: sha256(await readFile(projectPaths.compressedRules)),
  }, protectedBefore);

  // ===== PHASE 48B FIX1 NEW TESTS =====

  // TEST S: natural person-context recall (possessive, state, dialogue)
  const naturalContextStory = [
    "初日一愣。",
    "初日沒有回答。",
    "初日的手停了一下。",
    "初日的聲音從門邊傳來。",
    "初日怔住了。",
  ].join("\n");
  const naturalContextSession = await startReadySession("寫一段休息間裡突發的自然反應。");
  const naturalContextFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...naturalContextSession.common,
      raw_story_text: naturalContextStory,
      raw_story_sha256: sha256(naturalContextStory),
    },
    options,
  );
  assert.equal(naturalContextFinal.ok, true);
  const naturalContextReport = naturalContextFinal.capability_output;
  assert.equal(
    naturalContextReport.pre_generation_character_count,
    0,
    "TEST S: 初日 must not be pre-grounded by the task prompt",
  );
  assert.equal(
    naturalContextReport.generated_existing_canon_character_count,
    1,
    "TEST S: natural prose person context must generate one supplemental Canon character",
  );
  assert(
    naturalContextReport.generated_existing_canon_characters.includes("初日"),
    "TEST S: generated-cast recall must add 初日",
  );
  const naturalInitialFact = naturalContextReport.character_hard_facts.find((item) => (
    item.canonical_name === "初日"
  ));
  assert(naturalInitialFact, "TEST S: Final Polisher must receive 初日 hard facts");
  assert.equal(
    naturalInitialFact.grounding_classification,
    "generated_existing_canon_character",
    "TEST S: 初日 must be classified as generated existing Canon cast",
  );

  // TEST T: cross-occurrence evidence accumulation
  const crossOccurrenceStory = [
    "夜星很安靜。",
    "過了一會兒，夜星把門推開。",
  ].join("\n");
  const crossOccurrenceResolution = resolveCanonCharacterMention(
    crossOccurrenceStory,
    "夜星",
  );
  assert.equal(
    crossOccurrenceResolution.status,
    canonCharacterMentionStatuses.confirmed,
    "TEST T: cross-occurrence should confirm 夜星",
  );
  assert(crossOccurrenceResolution.confirmed_occurrences.length > 0);

  // TEST U: suffix/action overlap arbitration
  const suffixActionTests = [
    {
      text: "夜星站今天停駛。",
      name: "夜星",
      expectConfirmed: false,
      label: "夜星站 + entity compound",
    },
    {
      text: "血站今天關門。",
      name: "血",
      expectConfirmed: false,
      label: "血站 + entity compound",
    },
    {
      text: "夜星道路今天封閉。",
      name: "夜星",
      expectConfirmed: false,
      label: "夜星道 + entity suffix",
    },
    {
      text: "夜星站在門口。",
      name: "夜星",
      expectConfirmed: true,
      label: "夜星站在 + person action",
    },
    {
      text: "血站在桌邊。",
      name: "血",
      expectConfirmed: true,
      label: "血站在 + person action",
    },
  ];
  for (const test of suffixActionTests) {
    const resolution = resolveCanonCharacterMention(test.text, test.name);
    const isConfirmed = resolution.status === canonCharacterMentionStatuses.confirmed;
    assert.equal(
      isConfirmed,
      test.expectConfirmed,
      `TEST U: ${test.label} should ${test.expectConfirmed ? "confirm" : "not confirm"} ${test.name}`,
    );
  }

  // TEST V: zero-Canon original world creation freedom
  const zeroCanonSession = await startReadySession("寫一段完全新的城市序章。");
  const zeroCanonStory = "東岸新開了一所蒼霧學院。";
  const zeroCanonFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...zeroCanonSession.common,
      raw_story_text: zeroCanonStory,
      raw_story_sha256: sha256(zeroCanonStory),
    },
    options,
  );
  assert.equal(zeroCanonFinal.ok, true);
  const zeroCanonReport = zeroCanonFinal.capability_output;
  assert.equal(typeof zeroCanonReport.original_entity_freedom, "string");
  assert.match(
    zeroCanonReport.original_entity_freedom,
    /allow_new.*absence_not_error_no_block_no_delete.*confident_only.*unresolved.*no_persist/iu,
    "TEST V: zero-Canon Final Polisher must retain the compact freedom invariant",
  );

  // TEST W: collector-independent facility freedom
  const facilityStory = "西側新建了一座白汐綜合醫療塔。";
  const facilitySession = await startReadySession("寫新設施的介紹。");
  const facilityFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...facilitySession.common,
      raw_story_text: facilityStory,
      raw_story_sha256: sha256(facilityStory),
    },
    options,
  );
  assert.equal(facilityFinal.ok, true);
  assert.match(
    facilityFinal.capability_output.original_entity_freedom,
    /allow_new.*no_persist/iu,
    "TEST W: facility freedom should be preserved",
  );

  // TEST X: ambiguous Canon candidate evidence reaches Final Polisher without force-binding.
  const ambiguousStory = "初日可能不在這裡。";
  const ambiguousResolution = resolveCanonCharacterMention(ambiguousStory, "初日");
  assert.notEqual(
    ambiguousResolution.status,
    canonCharacterMentionStatuses.confirmed,
    "TEST X: ambiguous context should not deterministically confirm 初日",
  );

  const ambiguousSession = await startReadySession(
    "寫一段人物是否在場仍不明的休息間短場景。",
  );
  const ambiguousFinal = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...ambiguousSession.common,
      raw_story_text: ambiguousStory,
      raw_story_sha256: sha256(ambiguousStory),
    },
    options,
  );

  assert.equal(ambiguousFinal.ok, true);
  const ambiguousReport = ambiguousFinal.capability_output;
  assert.equal(
    (ambiguousReport.character_hard_facts ?? []).some((item) => (
      item.canonical_name === "初日"
    )),
    false,
    "TEST X: ambiguous 初日 must not enter binding character_hard_facts",
  );

  const ambiguousCandidates = ambiguousReport.ambiguous_existing_canon_candidates ?? [];
  const ambiguousCandidate = ambiguousCandidates.find((item) => (
    item.canonical_name === "初日"
  ));
  assert(ambiguousCandidate, "TEST X: Final Polisher must receive 初日 candidate evidence");
  assert.equal(ambiguousCandidate.identity_not_confirmed, true);
  assert.equal(ambiguousCandidate.identity_resolution_required, true);
  assert.equal(ambiguousCandidate.gender, "male");
  assert.equal(ambiguousCandidate.pronouns.third_person, "他");
  assert.equal("identity_facts" in ambiguousCandidate, false);
  assert.equal("appearance_facts" in ambiguousCandidate, false);
  assert.equal(typeof ambiguousCandidate.identity, "string");
  assert.equal(typeof ambiguousCandidate.appearance, "string");
  assert.equal(
    ambiguousReport
      .ambiguous_canon_candidate_resolution
      .candidate_facts_are_binding_before_identity_confirmation,
    false,
    "TEST X: candidate Canon facts must remain non-binding before identity confirmation",
  );
  assert.match(
    ambiguousReport.ambiguous_canon_candidate_resolution.binding_rule,
    /identity-resolution evidence only/iu,
  );
  assert(
    ambiguousReport.findings.some((finding) => (
      finding.code === "ambiguous_existing_canon_candidate_resolution"
    )),
    "TEST X: semantic candidate identity-resolution contract must reach Final Polisher",
  );

  // TEST Y: service integrity invariant (integrityValidated=false blocks expansion)
  const integrityFailStory = "初日走進來。";
  const integrityFailExpansion = expandGeneratedCastCanonGrounding({
    rawStoryText: integrityFailStory,
    integrityValidated: false,
    existingCharacterCanonGrounding: {
      characters: [],
    },
    activeEngineContent: activeEngine,
  });
  assert.equal(
    integrityFailExpansion.generated_existing_canon_character_count,
    0,
    "TEST Y: integrityValidated=false should produce no generated characters",
  );
  assert.equal(
    integrityFailExpansion.expansion_metadata.formal_expansion_applied,
    false,
    "TEST Y: formal_expansion_applied should be false",
  );

  // TEST Z: Phase48A/Phase48B preserved + existing tests
  // (existing tests already cover this throughout)

  console.log(
    "Phase48B Fix1 generated-cast recall and original entity freedom PASS: natural contexts, cross-occurrence, suffix/action arbitration, zero-Canon freedom, collector-independence, ambiguous candidates, service integrity, and compound bootstrap verified.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
