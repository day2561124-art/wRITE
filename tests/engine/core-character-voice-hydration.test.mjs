import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  hydratePlannedEntityManifest,
  resolveRegistryEntity,
} from "../../server/src/canon-entity-hydration-service.mjs";
import {
  parseActiveEngineCharacterRecords,
  resolveCanonCharacterMention,
  canonCharacterMentionStatuses,
} from "../../server/src/character-canon-grounding-service.mjs";
import {
  evaluateCharacterVoiceDrift,
} from "../../server/src/character-voice-drift-guard-service.mjs";
import {
  inspectCharacterVoiceCoverage,
  parseAuthoritativeCoreProtagonistNames,
} from "../../server/src/character-voice-registry-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
  useChatgptOwnedExternalBrainCapability,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  getEngineComponentsStatus,
} from "../../server/src/engine-component-registry.mjs";
import {
  getStructuredEntityRegistry,
} from "../../server/src/structured-canon-entity-registry-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const [activeEngine, voiceRegistryContent, structured] = await Promise.all([
  readFile(projectPaths.activeEngine, "utf8"),
  readFile(projectPaths.characterVoiceRegistry, "utf8"),
  getStructuredEntityRegistry(),
]);
const coreNames = parseAuthoritativeCoreProtagonistNames(activeEngine);
const activeRecords = parseActiveEngineCharacterRecords(activeEngine);
const voiceCoverage = inspectCharacterVoiceCoverage(voiceRegistryContent);

assert.equal(coreNames.length, 27);
assert.deepEqual(voiceCoverage.core_protagonists, coreNames);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `core-character-voice-${process.pid}-${Date.now()}`,
);
await mkdir(fixtureRoot, { recursive: true });
const options = { fixtureRoot };

try {
  const session = await beginChatgptOwnedExternalBrainWritingSession({
    task_prompt: "逐一驗證指定角色的下一回合 hydration。",
    generation_context: {},
  }, options);
  assert.equal(session.ok, true);

  for (const canonicalName of coreNames) {
    const currentRecords = structured.registry.characters.filter((record) => (
      record.canonical_name === canonicalName
    ));
    assert.equal(currentRecords.length, 1, `${canonicalName}: character entry`);
    assert.equal(
      activeRecords.filter((record) => record.canonical_name === canonicalName).length,
      1,
      `${canonicalName}: active Canon character record`,
    );

    const voiceEntries = voiceCoverage.entries.filter((entry) => (
      entry.canonical_name === canonicalName
    ));
    assert.equal(voiceEntries.length, 1, `${canonicalName}: unique voice entry`);
    assert(voiceEntries[0].personality, `${canonicalName}: personality source`);
    assert(voiceEntries[0].voice, `${canonicalName}: voice source`);
    assert.equal(voiceEntries[0].effective, true, `${canonicalName}: effective voice`);

    const explicit = resolveRegistryEntity(
      structured.registry.characters,
      { name: canonicalName },
      "characters",
    );
    assert.equal(explicit.status, "resolved", `${canonicalName}: explicit entity lookup`);
    assert.equal(explicit.match_type, "exact");
    assert.equal(explicit.entity.canonical_name, canonicalName);

    const manifest = await hydratePlannedEntityManifest({
      plannedEntityManifest: { characters: [canonicalName] },
      activeEngineContent: activeEngine,
    });
    assert.equal(manifest.planned_entity_hydration.unresolved_entities.length, 0);
    assert.equal(manifest.planned_entity_hydration.resolved_entities.length, 1);
    const hydratedCharacter = manifest.planned_entity_hydration.resolved_entities[0];
    assert.equal(hydratedCharacter.canonical_name, canonicalName);
    assert.equal(hydratedCharacter.character_voice_registry_status, "resolved");
    assert.equal(
      hydratedCharacter.character_voice_profile.canonical_name,
      canonicalName,
    );

    const simulation = await useChatgptOwnedExternalBrainCapability(
      "run_character_simulator",
      {
        external_brain_session_id: session.external_brain_session_id,
        writing_context_bundle_id: session.writing_context_bundle_id,
        capability_input: {
          character: canonicalName,
          known: ["目前正在執行角色 hydration 驗證"],
        },
      },
      options,
    );
    assert.equal(simulation.ok, true, `${canonicalName}: simulator call`);
    assert.equal(simulation.capability_output.character, canonicalName);
    assert.equal(simulation.capability_output.character_canon_grounding_loaded, true);
    assert.deepEqual(
      simulation.capability_output.character_hard_facts.map((entry) => (
        entry.canonical_name
      )),
      [canonicalName],
      `${canonicalName}: simulator exact character hydration`,
    );
    assert.equal(simulation.capability_output.character_voice_profile_loaded, true);
    assert.deepEqual(
      simulation.capability_output.character_voice_profiles.map((entry) => (
        entry.canonical_name
      )),
      [canonicalName],
      `${canonicalName}: simulator voice hydration`,
    );
    assert.equal(simulation.capability_output.character_voice_fallback_used, false);

    const guard = await evaluateCharacterVoiceDrift({
      candidate_text: `${canonicalName}走進教室後停下。`,
      planned_entity_manifest: { characters: [canonicalName] },
    });
    assert.equal(guard.character_voice_registry_loaded, true);
    assert(guard.character_voice_profile_names.includes(canonicalName));
    assert.equal(guard.character_voice_fallback_used, false);
    assert.deepEqual(guard.character_voice_hydration_diagnostics, []);
  }

  for (const canonicalName of coreNames.filter((name) => [...name].length > 1)) {
    assert.equal(
      resolveCanonCharacterMention(
        `${canonicalName}走進教室後停下。`,
        canonicalName,
      ).status,
      canonCharacterMentionStatuses.confirmed,
      `${canonicalName}: multi-character prose detection`,
    );
  }

  const singleCharacterCases = [
    { name: "夜", person: "夜推了推眼鏡。", noun: "夜已經很深了。" },
    { name: "央", person: "央拿起記錄板。", noun: "廣場中央很安靜。" },
    { name: "血", person: "血沒有回答。", noun: "地上留下了血。" },
    { name: "莊", person: "莊走進教室。", noun: "村莊今天很安靜。" },
  ];
  for (const { name, person, noun } of singleCharacterCases) {
    assert.equal(
      resolveCanonCharacterMention(person, name).status,
      canonCharacterMentionStatuses.confirmed,
      `${name}: person context`,
    );
    assert.notEqual(
      resolveCanonCharacterMention(noun, name).status,
      canonCharacterMentionStatuses.confirmed,
      `${name}: ordinary-word false positive`,
    );
    const guard = await evaluateCharacterVoiceDrift({
      candidate_text: person,
      planned_entity_manifest: { characters: [name] },
    });
    assert.deepEqual(guard.character_voice_profile_names, [name]);
  }
  const nightAliasHydration = await hydratePlannedEntityManifest({
    plannedEntityManifest: { characters: ["夜老師"] },
    activeEngineContent: activeEngine,
  });
  assert.equal(
    nightAliasHydration.planned_entity_hydration.resolved_entities[0]
      .canonical_name,
    "夜",
  );
  assert.equal(
    nightAliasHydration.planned_entity_hydration.resolved_entities[0]
      .match_type,
    "registered_alias_then_exact_canonical_name",
  );
  const nightAliasSimulation = await useChatgptOwnedExternalBrainCapability(
    "run_character_simulator",
    {
      external_brain_session_id: session.external_brain_session_id,
      writing_context_bundle_id: session.writing_context_bundle_id,
      capability_input: {
        character: "夜老師",
        known: ["學生提出問題"],
      },
    },
    options,
  );
  assert.equal(nightAliasSimulation.capability_output.character, "夜");
  assert.deepEqual(
    nightAliasSimulation.capability_output.character_hard_facts
      .map((entry) => entry.canonical_name),
    ["夜"],
  );
  assert.deepEqual(
    nightAliasSimulation.capability_output.character_voice_profiles
      .map((entry) => entry.canonical_name),
    ["夜"],
  );

  for (const canonicalName of [
    "白瀨零夜",
    "香坂汐里",
    "槐野理子",
    "梶浦澄斗",
    "霧生棋乃",
    "伊吹沙耶",
    "瀨川奈緒",
    "榛名小暮",
    "南雲帆",
  ]) {
    assert.equal(
      structured.registry.characters.filter((record) => (
        record.canonical_name === canonicalName
      )).length,
      1,
      `${canonicalName}: non-core character regression`,
    );
  }

  const missingNightVoice = voiceRegistryContent
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("| 夜 |"))
    .join("\n");
  const failedHydration = await hydratePlannedEntityManifest({
    plannedEntityManifest: { characters: ["夜"] },
    activeEngineContent: activeEngine,
  }, {
    characterVoiceRegistryContent: missingNightVoice,
  });
  assert.equal(
    failedHydration.planned_entity_hydration.character_voice_hydration_failed,
    true,
  );
  assert.deepEqual(
    failedHydration.planned_entity_hydration.character_voice_diagnostics,
    [{
      code: "CHARACTER_VOICE_HYDRATION_FAILED",
      canonical_name: "夜",
      entity_id: explicitEntityId(structured.registry.characters, "夜"),
      failure_stage: "planned_entity_manifest_voice_lookup",
      voice_registry_status: "not_found",
      fallback_used: false,
    }],
  );
  await assert.rejects(
    useChatgptOwnedExternalBrainCapability(
      "run_character_simulator",
      {
        external_brain_session_id: session.external_brain_session_id,
        writing_context_bundle_id: session.writing_context_bundle_id,
        capability_input: {
          character: "夜",
          known: ["學生提出問題"],
        },
      },
      {
        ...options,
        characterVoiceRegistryContent: missingNightVoice,
      },
    ),
    (error) => (
      error?.code === "CHARACTER_VOICE_HYDRATION_FAILED"
      && error?.diagnostics?.[0]?.canonical_name === "夜"
      && error?.diagnostics?.[0]?.fallback_used === false
    ),
  );

  const engineStatus = await getEngineComponentsStatus();
  assert.equal(engineStatus.ok, true);
  assert.equal(engineStatus.components.canon_data.hash_matches, true);
  assert.deepEqual(engineStatus.issues, []);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

function explicitEntityId(records, canonicalName) {
  return records.find((record) => (
    record.canonical_name === canonicalName
  ))?.entity_id ?? null;
}

console.log("Core character voice coverage and hydration regression tests passed.");
