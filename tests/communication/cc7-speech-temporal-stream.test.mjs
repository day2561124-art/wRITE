import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCommunicationSpeechStreamContract,
  projectWorldSimulationCommunicationSpeechStream,
  worldSimulationCommunicationSpeechStreamVersion,
} from "../../server/src/world-simulation-communication-speech-stream-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const semantic = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const actionId = "communication_cc7b_aaaaaaaaaaaaaaaa";
const privatePurpose = "只想讓B知道但不要讓其他人知道";

function committedOutcome(overrides = {}) {
  return {
    actor: "A",
    action_id: actionId,
    result: "communication_emitted",
    duration_ms: 250,
    communication_event: {
      schema_version: "cc1-world-communication-event-v1",
      actor: "A",
      addressee: "B",
      channel: "speech",
      semantic_content: semantic,
      surface_text: spoken,
      surface_realization_complete: true,
      private_purpose: privatePurpose,
      surface_realization: {
        schema_version: "cc5-mandarin-clause-realization-v1",
        language: "zh",
        surface_text: spoken,
        source_action_id: actionId,
        semantic_anchor: semantic,
        relation: "derived_from_selected_candidate_surface_realization",
      },
    },
    ...overrides,
  };
}

{
  const contract = buildWorldSimulationCommunicationSpeechStreamContract();
  assert.equal(contract.version, worldSimulationCommunicationSpeechStreamVersion);
  assert.equal(contract.source, "committed_realized_speech_outcome_only");
  assert.equal(contract.exact_public_surface_reconstructed, true);
  assert.equal(contract.technical_increment_segmentation_only, true);
  assert.equal(contract.engine_holds_complete_release_schedule, true);
  assert.equal(contract.observer_release_gate_required, true);
  assert.equal(contract.listener_increment_consumption_implemented_here, false);
  assert.equal(contract.segmentation_is_psychological_boundary, false);
  assert.equal(contract.phonetic_boundary_claimed, false);
  assert.equal(contract.prosodic_boundary_claimed, false);
  assert.equal(contract.listener_audibility_inferred, false);
  assert.equal(contract.listener_understanding_inferred, false);
  assert.equal(contract.semantic_content_forwarded_in_increment, false);
  assert.equal(contract.private_purpose_forwarded_in_increment, false);
  assert.equal(contract.floor_arbitration_performed, false);
  assert.equal(contract.interruption_judgment_performed, false);
}

{
  const first = projectWorldSimulationCommunicationSpeechStream({
    outcome: committedOutcome(),
    technical_increment_max_chars: 3,
  });
  const second = projectWorldSimulationCommunicationSpeechStream({
    outcome: committedOutcome(),
    technical_increment_max_chars: 3,
  });
  assert.deepEqual(first, second);
  assert.equal(first.schema_version, worldSimulationCommunicationSpeechStreamVersion);
  assert.equal(first.source_action_id, actionId);
  assert.equal(first.source_actor, "A");
  assert.equal(first.duration_ms, 250);
  assert.equal(first.technical_increment_max_chars, 3);
  assert(first.increments.length > 1);
  assert.equal(
    first.increments.map((item) => item.surface_fragment).join(""),
    spoken,
  );
  assert.equal(first.increments[0].start_offset_ms, 0);
  assert.equal(first.increments.at(-1).end_offset_ms, 250);
  assert.equal(first.increments.at(-1).signal_phase, "acoustic_segment_ended");

  for (let index = 0; index < first.increments.length; index += 1) {
    const increment = first.increments[index];
    assert.equal(increment.sequence, index + 1);
    assert([...increment.surface_fragment].length <= 3);
    assert(increment.end_offset_ms > increment.start_offset_ms);
    assert.equal(increment.technical_segmentation_only, true);
    assert.equal(increment.listener_audibility_inferred, false);
    assert.equal(increment.listener_understanding_inferred, false);
    assert.equal(increment.floor_claimed, false);
    assert.equal(increment.grounding_claimed, false);
    assert.equal(increment.semantic_content_exposed, false);
    assert.equal(increment.private_purpose_exposed, false);
    if (index > 0) {
      assert.equal(
        increment.start_offset_ms,
        first.increments[index - 1].end_offset_ms,
      );
    }
    if (index < first.increments.length - 1) {
      assert.equal(increment.signal_phase, "ongoing");
    }
    const serialized = JSON.stringify(increment);
    assert.equal(serialized.includes(semantic), false);
    assert.equal(serialized.includes(privatePurpose), false);
    assert.equal(serialized.includes('"semantic_content"'), false);
    assert.equal(serialized.includes('"private_purpose"'), false);
  }

  assert.equal(first.boundaries.engine_holds_complete_release_schedule, true);
  assert.equal(first.boundaries.observer_release_gate_required, true);
  assert.equal(first.boundaries.listener_increment_consumption_implemented_here, false);
  assert.equal(first.boundaries.observer_may_receive_future_increment_before_release, false);
}

{
  const one = projectWorldSimulationCommunicationSpeechStream({
    outcome: committedOutcome({
      duration_ms: 100,
      communication_event: {
        ...committedOutcome().communication_event,
        surface_text: "好。",
        surface_realization: {
          ...committedOutcome().communication_event.surface_realization,
          surface_text: "好。",
        },
      },
    }),
    technical_increment_max_chars: 8,
  });
  assert.equal(one.increment_count, 1);
  assert.equal(one.increments[0].start_offset_ms, 0);
  assert.equal(one.increments[0].end_offset_ms, 100);
  assert.equal(one.increments[0].signal_phase, "acoustic_segment_ended");
}

{
  assert.throws(
    () => projectWorldSimulationCommunicationSpeechStream({
      outcome: { ...committedOutcome(), result: "blocked" },
    }),
    /committed realized speech outcome/u,
  );
  assert.throws(
    () => projectWorldSimulationCommunicationSpeechStream({
      outcome: {
        ...committedOutcome(),
        communication_event: {
          ...committedOutcome().communication_event,
          channel: "nonverbal",
        },
      },
    }),
    /committed realized speech outcome/u,
  );
  assert.throws(
    () => projectWorldSimulationCommunicationSpeechStream({
      outcome: { ...committedOutcome(), duration_ms: 0 },
    }),
    /positive finite number/u,
  );
  assert.throws(
    () => projectWorldSimulationCommunicationSpeechStream({
      outcome: committedOutcome(),
      technical_increment_max_chars: 2.5,
    }),
    /integer from 1 to 64/u,
  );
  assert.throws(
    () => projectWorldSimulationCommunicationSpeechStream({
      outcome: committedOutcome(),
      technical_increment_max_chars: 65,
    }),
    /integer from 1 to 64/u,
  );
}

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc7b-speech-temporal-stream-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-7B speech temporal stream native causal timeline",
    seed: "cc7b-speech-temporal-stream",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
      communication_speech_stream_increment_max_chars: 3,
    },
    initial_world_state: {
      simulation_time: "2026-09-23T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc7b-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A speaks while B remains silent",
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-23T00:00:00+08:00",
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
          current_goal: "等待 A 說完",
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
      identity_source: "cc7b_test_identity_resolver",
      formal: true,
    }),
  });

  let selectedActionId = null;
  const result = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc7b-speak",
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
  assert.equal(result.ok, true);
  assert.equal(result.committed, true);
  assert.ok(selectedActionId);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const turn = history.turns.at(-1);
  assert.ok(turn);

  const emitted = turn.action_outcomes.find(
    (item) => item.actor === "A" && item.result === "communication_emitted",
  );
  assert.ok(emitted);
  assert.equal(emitted.action_id, selectedActionId);
  assert.equal(emitted.duration_ms, 250);
  assert.ok(emitted.communication_speech_stream);
  assert.equal(
    emitted.communication_speech_stream.increments
      .map((item) => item.surface_fragment)
      .join(""),
    spoken,
  );
  assert.equal(
    emitted.communication_speech_stream.boundaries
      .listener_increment_consumption_implemented_here,
    false,
  );

  const incrementEntries = turn.causal_timeline.entries.filter(
    (entry) =>
      entry.kind === "communication_speech_increment"
      && entry.action_id === selectedActionId,
  );
  assert.equal(
    incrementEntries.length,
    emitted.communication_speech_stream.increment_count,
  );
  assert.equal(
    incrementEntries.map((item) => item.surface_fragment).join(""),
    spoken,
  );
  assert.equal(incrementEntries.at(-1).time_ms, emitted.duration_ms);
  assert.equal(
    incrementEntries.at(-1).signal_phase,
    "acoustic_segment_ended",
  );

  for (let index = 0; index < incrementEntries.length; index += 1) {
    const entry = incrementEntries[index];
    assert.equal(entry.increment_sequence, index + 1);
    assert.equal(entry.technical_segmentation_only, true);
    assert.equal(entry.listener_audibility_inferred, false);
    assert.equal(entry.listener_understanding_inferred, false);
    assert.equal(entry.floor_claimed, false);
    assert.equal(entry.grounding_claimed, false);
    if (index > 0) {
      assert(entry.time_ms >= incrementEntries[index - 1].time_ms);
    }
    const serialized = JSON.stringify(entry);
    assert.equal(serialized.includes(semantic), false);
    assert.equal(serialized.includes(privatePurpose), false);
    assert.equal(serialized.includes('"semantic_content"'), false);
    assert.equal(serialized.includes('"private_purpose"'), false);
    assert.equal(serialized.includes("turn_end_projection"), false);
  }

  const actionCompleteIndex = turn.causal_timeline.entries.findIndex(
    (entry) =>
      entry.kind === "action_complete"
      && entry.action_id === selectedActionId,
  );
  const finalIncrementIndex = turn.causal_timeline.entries.findIndex(
    (entry) =>
      entry.kind === "communication_speech_increment"
      && entry.increment_ref === incrementEntries.at(-1).increment_ref,
  );
  assert(finalIncrementIndex >= 0);
  assert(actionCompleteIndex >= 0);
  assert(
    finalIncrementIndex < actionCompleteIndex,
    "Final released speech increment must precede same-time action completion.",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-7B speech temporal stream tests passed.");
