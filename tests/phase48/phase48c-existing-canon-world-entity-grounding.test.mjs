import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  buildWorldEntityCanonGrounding,
  parseActiveEngineWorldEntityRecords,
  resolveWorldEntityMention,
  worldEntityMentionStatuses,
} from "../../server/src/world-entity-canon-grounding-service.mjs";
import {
  expandGeneratedWorldEntityCanonGrounding,
} from "../../server/src/generated-world-entity-canon-grounding-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
  externalBrainPreGenerationCapabilities,
  useChatgptOwnedExternalBrainCapability,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const sha256 = (value) => (
  createHash("sha256").update(value).digest("hex")
);

const expectedProtectedHashes = {
  active_engine:
    "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules:
    "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};

const guardNames = [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
];

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase48c-world-entity-${process.pid}-${Date.now()}`,
);

const options = { fixtureRoot };

function assertGuards(response) {
  for (const name of guardNames) {
    assert.equal(response[name], false, `${name} changed`);
    assert.equal(
      response.mutation_guards[name],
      false,
      `mutation_guards.${name} changed`,
    );
  }
}

async function startReadySession(taskPrompt) {
  const begin = await beginChatgptOwnedExternalBrainWritingSession({
    task_prompt: taskPrompt,
    generation_context: {
      scene_kind: "world_entity_grounding_regression",
    },
    retrieval_context: {},
  }, options);

  assert.equal(begin.ok, true);
  assert.equal("writing_context" in begin, false);
  assert.equal("context_for_chat" in begin, false);
  assert.equal("context_bundle" in begin, false);
  assert(
    Buffer.byteLength(JSON.stringify(begin), "utf8") < 16 * 1024,
  );

  const common = {
    external_brain_session_id: begin.external_brain_session_id,
    writing_context_bundle_id: begin.writing_context_bundle_id,
    capability_input: { phase: "48C" },
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

  return {
    begin,
    common,
    outputs,
  };
}

await mkdir(fixtureRoot, { recursive: true });

try {
  const activeEngine = await readFile(projectPaths.activeEngine, "utf8");

  assert.deepEqual({
    active_engine: sha256(activeEngine),
    compressed_rules: sha256(
      await readFile(projectPaths.compressedRules),
    ),
  }, expectedProtectedHashes);

  const records = parseActiveEngineWorldEntityRecords(activeEngine);

  assert(records.length > 8);

  const recordNames = new Set(
    records.map((record) => record.canonical_name),
  );

  for (const requiredName of [
    "夜星武裝學院",
    "晨紋工學院",
    "星蝕巡禮局",
    "影術棋盤社",
  ]) {
    assert(
      recordNames.has(requiredName),
      `active_engine world entity parser missed ${requiredName}`,
    );
  }

  const preGeneration = buildWorldEntityCanonGrounding({
    activeEngineContent: activeEngine,
    taskPrompt:
      "寫夜星武裝學院與影術棋盤社準備交流活動的短場景。",
  });

  const preNames = new Set(
    preGeneration.entities.map((entity) => entity.canonical_name),
  );

  assert(preNames.has("夜星武裝學院"));
  assert(preNames.has("影術棋盤社"));
  assert.equal(
    preGeneration.original_entity_freedom
      .original_entity_creation_allowed,
    true,
  );

  assert.equal(
    resolveWorldEntityMention(
      "夜星武裝學院今天暫停部分課程。",
      "夜星武裝學院",
    ).status,
    worldEntityMentionStatuses.confirmed,
  );

  assert.notEqual(
    resolveWorldEntityMention(
      "夜星武裝學院附屬醫療中心今天開放。",
      "夜星武裝學院",
    ).status,
    worldEntityMentionStatuses.confirmed,
  );

  assert.notEqual(
    resolveWorldEntityMention(
      "新夜星武裝學院今天開始招生。",
      "夜星武裝學院",
    ).status,
    worldEntityMentionStatuses.confirmed,
  );

  const generatedStory = [
    "影術棋盤社今天接到星蝕巡禮局的通知。",
    "新成立的霧港市域靈災應變局也派人抵達。",
  ].join("\n");

  const generatedExpansion =
    expandGeneratedWorldEntityCanonGrounding({
      rawStoryText: generatedStory,
      rawStorySha256: sha256(generatedStory),
      integrityValidated: true,
      existingWorldEntityCanonGrounding:
        buildWorldEntityCanonGrounding({
          activeEngineContent: activeEngine,
          taskPrompt: "寫夜星武裝學院的普通下午。",
        }),
      activeEngineContent: activeEngine,
    });

  const generatedNames = new Set(
    generatedExpansion
      .generated_existing_canon_world_entities,
  );

  assert(generatedNames.has("影術棋盤社"));
  assert(generatedNames.has("星蝕巡禮局"));

  assert(
    generatedExpansion.original_or_unresolved_world_entities
      .some((entity) => (
        entity.canonical_name === "霧港市域靈災應變局"
        && entity.entity_type === "administrative_agency"
      )),
  );

  assert.equal(
    generatedExpansion
      .expansion_metadata
      .original_world_entities_persisted,
    false,
  );

  const integrityBlocked =
    expandGeneratedWorldEntityCanonGrounding({
      rawStoryText: "影術棋盤社今天接到通知。",
      integrityValidated: false,
      existingWorldEntityCanonGrounding: {
        entities: [],
      },
      activeEngineContent: activeEngine,
    });

  assert.equal(
    integrityBlocked.generated_existing_canon_world_entity_count,
    0,
  );
  assert.equal(
    integrityBlocked.expansion_metadata.formal_expansion_applied,
    false,
  );

  const session = await startReadySession(
    "寫夜星武裝學院的社團日常。",
  );

  const simulator = session.outputs.get("run_character_simulator");
  assert.equal(
    simulator.world_entity_canon_grounding_loaded,
    true,
  );
  assert(
    simulator.world_entity_hard_facts.some((entity) => (
      entity.canonical_name === "夜星武裝學院"
    )),
  );

  const critic = session.outputs.get("run_neural_critic");
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

  const director = session.outputs.get("run_writing_card_director");
  assert.equal(
    director.world_entity_canon_grounding_loaded,
    true,
  );
  assert(
    director.world_entity_hard_facts.some((entity) => (
      entity.canonical_name === "夜星武裝學院"
    )),
  );

  const finalStory = [
    "影術棋盤社今天接到星蝕巡禮局的通知。",
    "社內有人卻把影術棋盤社稱作官方軍事部隊。",
    "新成立的霧港市域靈災應變局也派人抵達。",
  ].join("\n");

  const final = await useChatgptOwnedExternalBrainCapability(
    "run_final_polisher",
    {
      ...session.common,
      raw_story_text: finalStory,
      raw_story_sha256: sha256(finalStory),
    },
    options,
  );

  assert.equal(final.ok, true);
  assertGuards(final);

  const report = final.capability_output;
  const worldFacts = new Map(
    (report.world_entity_hard_facts ?? [])
      .map((entity) => [entity.canonical_name, entity]),
  );

  for (const requiredName of [
    "夜星武裝學院",
    "影術棋盤社",
    "星蝕巡禮局",
  ]) {
    assert(
      worldFacts.has(requiredName),
      `Final Polisher missed world entity ${requiredName}`,
    );
  }

  assert(
    report.generated_existing_canon_world_entities
      .includes("影術棋盤社"),
  );
  assert(
    report.generated_existing_canon_world_entities
      .includes("星蝕巡禮局"),
  );

  assert(
    report.original_or_unresolved_world_entities.some((entity) => (
      entity.canonical_name === "霧港市域靈災應變局"
    )),
  );

  assert.equal(
    report.findings_review_mode,
    "hard_conflicts_and_exact_evidence_only",
  );
  assert.equal(
    Object.hasOwn(report, "findings"),
    false,
  );
  assert.equal(
    report.release_recommendation,
    "release_as_is",
  );

  assert.equal("polished_text" in report, false);
  assert.match(
    report.original_entity_freedom,
    /allow_new.*no_persist/iu,
  );

  assert.deepEqual({
    active_engine: sha256(
      await readFile(projectPaths.activeEngine),
    ),
    compressed_rules: sha256(
      await readFile(projectPaths.compressedRules),
    ),
  }, expectedProtectedHashes);

  console.log(
    "Phase48C existing Canon world entity grounding PASS: "
    + "active_engine parser, exact matching, compound collision, "
    + "pre-generation grounding, generated expansion, original-world "
    + "entity freedom, Final Polisher handoff, compact bootstrap, "
    + "integrity gate, protected hashes, and mutation guards verified.",
  );
} finally {
  await rm(fixtureRoot, {
    recursive: true,
    force: true,
  });
}
