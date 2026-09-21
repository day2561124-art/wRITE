import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationListenerUnderstandingContract,
  buildCharacterCommunicationListenerUnderstandingResolverView,
  characterCommunicationListenerUnderstandingVersion,
  projectCharacterCommunicationListenerUnderstanding,
} from "../../server/src/character-communication-listener-understanding-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  queryWorldSimulationObserverAudibility,
} from "../../server/src/world-simulation-audibility-query-service.mjs";

const semantic = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const misheard = "男孩離開房子？";
const interpreted = "有人可能在問男孩是不是離開房子";

const contract = buildCharacterCommunicationListenerUnderstandingContract();
assert.equal(contract.version, characterCommunicationListenerUnderstandingVersion);
assert.equal(contract.source_requires_prior_committed_realized_speech, true);
assert.equal(contract.source_requires_current_programmatic_audibility, true);
assert.equal(contract.resolver_receives_emitted_public_surface_signal, true);
assert.equal(contract.resolver_receives_speaker_semantic_content, false);
assert.equal(contract.resolver_receives_source_engine_identity, false);
assert.equal(contract.no_resolver_means_no_interpretation, true);
assert.equal(contract.speaker_identity_recognition_supported, false);
assert.equal(contract.understood_testimony_issued, false);
assert.equal(contract.grounding_claimed, false);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-listener-interpretation-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6C listener recognition and subjective interpretation",
    seed: "cc6-native-listener-interpretation",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-21T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6c-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A speaks in the room",
        next_events: [{
          event_id: "evt-cc6c-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "B gets the next perception opportunity",
        }],
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-21T00:00:00+08:00",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: {
            A: { x: 2, y: 2 },
            B: { x: 3, y: 2 },
          },
          audibility_profiles: {
            B: { minimum_audible_db: 35 },
          },
          observable_by: {
            A: { visual: [], audible: [] },
            B: { visual: [], audible: [] },
          },
        },
      },
      characters: {
        A: {
          known: [semantic],
          current_goal: "告知 B",
          relationships: { B: "朋友" },
          speech_acoustics: { sound_level_db_at_1m: 60 },
          communication_goal: {
            character: "A",
            purpose: "告知",
            addressee: "B",
            mode: "direct",
            public_content: semantic,
            claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: semantic,
              clause: {
                subject: "男孩",
                predicate: "離開",
                aspect_particle: "了",
                object: "房子",
              },
            },
          },
        },
        B: {
          known: [],
          current_goal: "理解剛才聽見的話",
          relationships: { A: "朋友" },
        },
      },
      memories: { A: [], B: [] },
      available_actions: { A: [], B: [] },
    },
  }, options);

  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc6c_test_identity_resolver",
      formal: true,
    }),
  });

  let sourceActionId = null;
  const first = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6c-speak",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        if (packet.character !== "A") return "reject_all";
        const candidate = packet.candidate_action_intents.find(
          (item) => item.communication?.surface_realization_complete === true,
        );
        assert.ok(candidate);
        sourceActionId = candidate.action_id;
        return { action_id: candidate.action_id };
      },
    },
  );
  assert.equal(first.ok, true);
  assert.equal(first.committed, true);
  assert.ok(sourceActionId);

  const stateAfterFirst = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  const historyAfterFirst = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const emitted = historyAfterFirst.turns[0].action_outcomes.find(
    (item) => item.actor === "A" && item.result === "communication_emitted",
  );
  assert.ok(emitted);
  const soundId = emitted.communication_acoustic_signal.sound_id;
  assert.ok(soundId);

  const audibility = queryWorldSimulationObserverAudibility({
    world_state: stateAfterFirst.state,
    scene_state: stateAfterFirst.state.scenes.room,
    scene_id: "room",
    observer: "B",
  });
  assert.equal(
    audibility.result.audible_sounds.some((item) => item.sound_id === soundId),
    true,
  );

  const directAssembly =
    buildCharacterCommunicationListenerUnderstandingResolverView({
      observer: "B",
      world_state: stateAfterFirst.state,
      scene_state: stateAfterFirst.state.scenes.room,
      scene_id: "room",
      audibility_result: audibility.result,
      world_history: historyAfterFirst,
    });
  assert.equal(directAssembly.resolver_view.speech_candidates.length, 1);
  const directResolverView = directAssembly.resolver_view;
  const directSerialized = JSON.stringify(directResolverView);
  assert.equal(directResolverView.speech_candidates[0].emitted_surface_signal, spoken);
  assert.equal(directSerialized.includes(semantic), false);
  assert.equal(directSerialized.includes(sourceActionId), false);
  assert.equal(directSerialized.includes(soundId), false);
  assert.equal(directSerialized.includes('"source_entity_id"'), false);
  assert.equal(directSerialized.includes('"source_action_id"'), false);
  assert.equal(directSerialized.includes('"semantic_content"'), false);
  assert.equal(directSerialized.includes('"private_purpose"'), false);

  const noDecision = projectCharacterCommunicationListenerUnderstanding({
    assembly: directAssembly,
    decisions: [],
  });
  assert.equal(noDecision.candidate_count, 1);
  assert.equal(noDecision.decision_count, 0);
  assert.deepEqual(noDecision.character_views, []);

  assert.throws(
    () => projectCharacterCommunicationListenerUnderstanding({
      assembly: directAssembly,
      decisions: [{
        speech_candidate_id:
          directResolverView.speech_candidates[0].speech_candidate_id,
        heard_surface: spoken,
        interpreted_content: semantic,
        speech_content_intelligible: true,
        understanding_attested: true,
        perceived_speaker: "A",
      }],
    }),
    /field is not allowed/,
  );

  let resolverView = null;
  let bBrainPacket = null;
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6c-hear",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterCommunicationListenerInterpretationResolver: async (view) => {
        resolverView = structuredClone(view);
        assert.equal(view.observer, "B");
        assert.equal(view.speech_candidates.length, 1);
        const candidate = view.speech_candidates[0];
        assert.equal(candidate.emitted_surface_signal, spoken);
        assert.equal(candidate.source_identity_available, false);
        assert.equal(candidate.speaker_semantic_content_available, false);
        assert.equal(candidate.speaker_private_purpose_available, false);
        assert.equal(candidate.world_truth_available, false);
        const serialized = JSON.stringify(view);
        assert.equal(serialized.includes(semantic), false);
        assert.equal(serialized.includes(sourceActionId), false);
        assert.equal(serialized.includes(soundId), false);
        assert.equal(serialized.includes('"actor":"A"'), false);
        return [{
          speech_candidate_id: candidate.speech_candidate_id,
          heard_surface: misheard,
          interpreted_content: interpreted,
          speech_content_intelligible: true,
          understanding_attested: true,
        }];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bBrainPacket = structuredClone(packet);
        return "reject_all";
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(resolverView);
  assert.ok(bBrainPacket);

  const subjectiveSpeech = bBrainPacket.perception.audible.find(
    (item) =>
      item?.schema_version === characterCommunicationListenerUnderstandingVersion
      && item?.kind === "subjectively_interpreted_speech",
  );
  assert.ok(subjectiveSpeech);
  assert.equal(subjectiveSpeech.heard_surface, misheard);
  assert.equal(subjectiveSpeech.interpreted_content, interpreted);
  assert.equal(subjectiveSpeech.speech_content_intelligible, true);
  assert.equal(subjectiveSpeech.listener_understanding_attested, true);
  assert.equal(subjectiveSpeech.speaker_identity_recognized, false);
  assert.equal(subjectiveSpeech.perceived_speaker, null);
  assert.equal(subjectiveSpeech.cc2_understood_testimony_eligible, false);
  assert.equal(subjectiveSpeech.world_truth_claimed, false);
  assert.equal(subjectiveSpeech.grounding_claimed, false);

  const boundary = bBrainPacket.perception.information_boundary;
  assert.equal(boundary.communication_listener_signal_reception_verified, true);
  assert.equal(boundary.communication_listener_interpretation_resolver_used, true);
  assert.equal(boundary.communication_listener_interpretation_subjective_only, true);
  assert.equal(boundary.communication_listener_source_semantics_forwarded, false);
  assert.equal(boundary.communication_listener_speaker_identity_inferred, false);
  assert.equal(boundary.communication_listener_world_truth_claimed, false);
  assert.equal(boundary.communication_listener_grounding_claimed, false);
  assert.equal(boundary.listener_receipt_verified, false);

  const packetSerialized = JSON.stringify(bBrainPacket);
  assert.equal(packetSerialized.includes(sourceActionId), false);
  assert.equal(packetSerialized.includes(soundId), false);
  assert.equal(packetSerialized.includes(semantic), false);
  assert.equal(packetSerialized.includes('"speaker":"A"'), false);

  const historyAfterSecond = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const secondTurn = historyAfterSecond.turns.at(-1);
  assert.ok(secondTurn);
  const cc6cProjection =
    secondTurn.communication_listener_understanding_projections.find(
      (item) => item.character === "B",
    );
  assert.ok(cc6cProjection);
  assert.equal(cc6cProjection.candidate_count, 1);
  assert.equal(cc6cProjection.decision_count, 1);
  assert.equal(cc6cProjection.engine_lineage_exposed_to_character, false);
  assert.equal(cc6cProjection.resolver_view_contains_speaker_semantic_content, false);
  assert.equal(cc6cProjection.resolver_view_contains_source_engine_identity, false);
  assert.equal(cc6cProjection.resolver_view_contains_source_action_identity, false);
  assert.equal(cc6cProjection.audit.understood_testimony_issued, false);
  assert.equal(cc6cProjection.audit.belief_update_performed, false);
  assert.equal(cc6cProjection.audit.grounding_claimed, false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-6C native listener recognition and subjective interpretation tests passed.");
