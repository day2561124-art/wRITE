import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCommunicationAcousticBridgeContract,
  projectWorldSimulationCommunicationAcousticBridge,
  worldSimulationCommunicationAcousticBridgeVersion,
} from "../../server/src/world-simulation-communication-acoustic-bridge-service.mjs";
import {
  projectCharacterCommunicationListenerReception,
} from "../../server/src/character-communication-listener-reception-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const semantic = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const actionId = "communication_aaaaaaaaaaaaaaaaaaaaaaaa";

function committedOutcome() {
  return {
    actor: "A",
    action_id: actionId,
    result: "communication_emitted",
    communication_event: {
      schema_version: "cc1-world-communication-event-v1",
      actor: "A",
      addressee: "B",
      channel: "speech",
      semantic_content: semantic,
      surface_text: spoken,
      surface_realization_complete: true,
      surface_realization: {
        schema_version: "cc5-mandarin-clause-realization-v1",
        language: "zh",
        surface_text: spoken,
        source_action_id: actionId,
        semantic_anchor: semantic,
        relation: "derived_from_selected_candidate_surface_realization",
      },
    },
  };
}

{
  const contract = buildWorldSimulationCommunicationAcousticBridgeContract();
  assert.equal(contract.version, worldSimulationCommunicationAcousticBridgeVersion);
  assert.equal(contract.explicit_speaker_sound_level_required, true);
  assert.equal(contract.hidden_default_vocal_level_allowed, false);
  assert.equal(contract.signal_lifecycle, "one_next_perception_only");
  assert.equal(contract.source_content_forwarded_to_audibility, false);
  assert.equal(contract.speech_intelligibility_inferred, false);
  assert.equal(contract.conversational_grounding_inferred, false);

  const world = {
    characters: {
      A: { speech_acoustics: { sound_level_db_at_1m: 60 } },
    },
    scenes: {
      room: { scene_id: "room", entity_positions: { A: { x: 1, y: 1 } } },
    },
    sound_events: [
      { sound_id: "ambient", scene_id: "room", position: { x: 5, y: 5 }, sound_level_db_at_1m: 45 },
      {
        schema_version: worldSimulationCommunicationAcousticBridgeVersion,
        kind: "communication_speech_signal",
        sound_id: "old-speech",
        scene_id: "room",
        source_entity_id: "A",
        communication_action_id: "old-action",
        sound_level_db_at_1m: 60,
      },
    ],
  };
  const projection = projectWorldSimulationCommunicationAcousticBridge({
    world_state: world,
    scene_id: "room",
    turn_id: "turn-2",
    action_outcomes: [committedOutcome()],
  });
  assert.equal(projection.changed, true);
  assert.deepEqual(projection.expired_sound_ids, ["old-speech"]);
  assert.equal(projection.next_sound_events.some((item) => item.sound_id === "ambient"), true);
  assert.equal(projection.next_sound_events.some((item) => item.sound_id === "old-speech"), false);
  assert.equal(projection.registrations.length, 1);
  const signal = projection.next_sound_events.find(
    (item) => item.schema_version === worldSimulationCommunicationAcousticBridgeVersion,
  );
  assert.ok(signal);
  assert.equal(signal.communication_action_id, actionId);
  assert.equal(signal.generic_auditory_label, "unidentified_speech_sound");
  assert.equal(signal.lifecycle, "next_perception_only");
  const serialized = JSON.stringify(signal);
  assert.equal(serialized.includes(spoken), false);
  assert.equal(serialized.includes(semantic), false);
  assert.equal(signal.surface_text_exposed, false);
  assert.equal(signal.semantic_content_exposed, false);
  assert.equal(signal.listener_understanding_inferred, false);
  assert.equal(signal.grounding_claimed, false);

  const noProfile = structuredClone(world);
  delete noProfile.characters.A.speech_acoustics;
  noProfile.sound_events = [];
  const unregistered = projectWorldSimulationCommunicationAcousticBridge({
    world_state: noProfile,
    scene_id: "room",
    turn_id: "turn-2",
    action_outcomes: [committedOutcome()],
  });
  assert.equal(unregistered.registrations.length, 0);
  assert.equal(unregistered.skipped[0].status, "explicit_speech_acoustics_unavailable");

  const suppressed = projectWorldSimulationCommunicationAcousticBridge({
    world_state: world,
    scene_id: "room",
    turn_id: "turn-2",
    action_outcomes: [committedOutcome()],
    suppressed_action_ids: [actionId],
  });
  assert.equal(suppressed.registrations.length, 0);
  assert.equal(suppressed.skipped[0].status, "suppressed_action");
}

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-acoustic-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6B speech acoustic bridge native loop",
    seed: "cc6-native-acoustic",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-21T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "conversation turn",
        next_events: [{
          event_id: "evt-cc6-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "next perception turn",
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
          current_goal: "聽周遭聲音",
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
      identity_source: "cc6_test_identity_resolver",
      formal: true,
    }),
  });

  let selectedActionId = null;
  const first = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6-speak",
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
        selectedActionId = candidate.action_id;
        return { action_id: candidate.action_id };
      },
    },
  );
  assert.equal(first.ok, true);
  assert.equal(first.committed, true);
  assert.ok(selectedActionId);

  const historyAfterFirst = await getWorldSimulationHistory(
    session.world_simulation_session_id, options,
  );
  const emitted = historyAfterFirst.turns[0].action_outcomes.find(
    (item) => item.actor === "A" && item.result === "communication_emitted",
  );
  assert.ok(emitted);
  assert.equal(emitted.communication_acoustic_signal.registered, true);
  assert.equal(emitted.communication_acoustic_signal.source_action_id, selectedActionId);
  assert.equal(emitted.communication_acoustic_signal.surface_text_exposed_in_signal, false);
  assert.equal(emitted.communication_acoustic_signal.listener_comprehension_inferred, false);
  const soundId = emitted.communication_acoustic_signal.sound_id;
  assert.ok(soundId);

  const stateAfterFirst = await getWorldSimulationState(
    session.world_simulation_session_id, options,
  );
  const nativeSignal = stateAfterFirst.state.sound_events.find(
    (item) => item.sound_id === soundId,
  );
  assert.ok(nativeSignal);
  assert.equal(nativeSignal.communication_action_id, selectedActionId);
  assert.equal(JSON.stringify(nativeSignal).includes(spoken), false);
  assert.equal(JSON.stringify(nativeSignal).includes(semantic), false);

  const reception = projectCharacterCommunicationListenerReception({
    observer: "B",
    sound_id: soundId,
    scene_id: "room",
    scene_state: stateAfterFirst.state.scenes.room,
    world_state: stateAfterFirst.state,
    committed_outcome: emitted,
  });
  assert.equal(reception.admission_status, "heard_sound_only");
  assert.equal(reception.character_view.speech_content_intelligible, false);
  assert.equal(reception.character_view.listener_understanding_attested, false);

  let bSecondPacket = null;
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6-hear",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bSecondPacket = structuredClone(packet);
        return "reject_all";
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(bSecondPacket);
  const bSerialized = JSON.stringify(bSecondPacket);
  assert.equal(bSerialized.includes("unidentified_speech_sound"), true);
  assert.equal(bSerialized.includes(spoken), false);
  assert.equal(bSerialized.includes(semantic), false);
  assert.equal(bSerialized.includes(soundId), false);
  assert.equal(
    bSecondPacket.perception.information_boundary.programmatic_audibility_enforced,
    true,
  );

  const stateAfterSecond = await getWorldSimulationState(
    session.world_simulation_session_id, options,
  );
  assert.equal(
    (stateAfterSecond.state.sound_events ?? []).some(
      (item) => item.schema_version === worldSimulationCommunicationAcousticBridgeVersion,
    ),
    false,
    "CC-6B speech residue must expire after exactly one next-turn perception opportunity.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-6B native speech acoustic bridge tests passed.");
