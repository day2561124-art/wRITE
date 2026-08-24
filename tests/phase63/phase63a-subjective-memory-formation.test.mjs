import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationLoopContract,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  buildWorldSimulationSubjectiveMemoryFormationContract,
  formWorldSimulationSubjectiveMemories,
  worldSimulationSubjectiveMemoryFormationVersion,
} from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import { worldSimulationMutationExecutorVersion } from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase63a-subjective-memory-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "observer-memory-engine-id";
const visibleTarget = "visible-target-engine-id";
const hiddenTarget = "hidden-target-engine-id";
const soundId = "footstep-sound-engine-id";
const sceneId = "phase63a-memory-lab";
const firstEventId = "evt-memory-formation-1";
const secondEventId = "evt-memory-retrieval-2";

const sceneState = {
  scene_id: sceneId,
  dimensions: { width_m: 16, depth_m: 10 },
  entity_positions: {
    [observer]: { x: 0, y: 0 },
    [visibleTarget]: { x: 4, y: 0 },
    [hiddenTarget]: { x: 4, y: 3 },
  },
  visibility_profiles: {
    [observer]: {
      facing_degrees: 0,
      horizontal_fov_degrees: 90,
      eye_height_m: 1.6,
      illumination_thresholds_lux: {
        silhouette_min_lux: 1,
        dim_min_lux: 5,
        clear_min_lux: 20,
      },
    },
    [visibleTarget]: { height_m: 1.8 },
    [hiddenTarget]: { height_m: 1.8 },
  },
  perception_labels_by: {
    [observer]: {
      [visibleTarget]: "前方站著一名穿深色制服的人",
      [hiddenTarget]: "右側牆後藏著不該被看到的人",
    },
  },
  lighting: { ambient_lux: 30 },
  audibility_profiles: {
    [observer]: {
      minimum_audible_db: 30,
      localization_min_margin_db: 6,
      localization_sectors: 4,
    },
  },
  sound_events: [{
    id: soundId,
    position: { x: -3, y: 0 },
    sound_level_db_at_1m: 58,
  }],
  auditory_labels_by: {
    [observer]: {
      [soundId]: "身後傳來一聲短促腳步聲",
    },
  },
  obstacles: [{
    id: "hidden-target-wall",
    x_min: 1.8,
    x_max: 2.2,
    y_min: 1.0,
    y_max: 3.2,
  }],
};

const worldState = {
  simulation_time: "2026-08-24T19:10:00+08:00",
  world_rules: { default_vision_range_m: 30 },
  event_queue: [
    {
      event_id: firstEventId,
      type: "observe_and_listen",
      scene_id: sceneId,
      participants: [observer],
    },
    {
      event_id: secondEventId,
      type: "recall_recent_perception",
      scene_id: sceneId,
      participants: [observer],
    },
  ],
  scenes: { [sceneId]: sceneState },
  characters: {
    [observer]: {
      current_action: "觀察教室並聆聽周遭",
      known: ["這裡是測試場景"],
      memory_encoding_profile: {
        direct_perception: {
          visual: { confidence: 0.92, clarity: 0.88 },
          auditory: { confidence: 0.81, clarity: 0.74 },
        },
      },
    },
    [visibleTarget]: {},
    [hiddenTarget]: {},
  },
  memories: { [observer]: [] },
  objects: {},
  available_actions: {
    [observer]: [{ action_id: "stay-observant", intent: "維持位置並繼續觀察" }],
  },
};

function noOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase63a-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [{
      actor: observer,
      action_id: "stay-observant",
      result: "remained_observant",
      causal_evidence: "fixture leaves hard state unchanged except queue consumption",
    }],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

try {
  const contract = buildWorldSimulationSubjectiveMemoryFormationContract();
  assert.equal(contract.version, worldSimulationSubjectiveMemoryFormationVersion);
  assert.equal(contract.input_source, "bounded_character_perception_packets");
  assert.equal(contract.persisted_memory_is_subjective_not_world_truth, true);
  assert.equal(contract.hidden_cognitive_defaults_allowed, false);
  assert.equal(contract.engine_target_ids_in_memory_content_allowed, false);
  assert.equal(contract.objective_known_facts_auto_promotion_allowed, false);
  assert.equal(contract.same_turn_retroactive_memory_use_allowed, false);
  assert.equal(contract.final_memory_state_written_through_authoritative_mutation_executor, true);
  assert.equal(contract.active_memory_decay_modeled, false);

  assert.equal(
    contract.internal_engine_provenance_preserved,
    true,
  );

  assert.equal(
    contract.internal_engine_provenance_separate_from_subjective_source,
    true,
  );

  assert.equal(
    contract.internal_engine_provenance_exposed_to_character_brain,
    false,
  );

  assert.equal(
    contract.encoding_metadata_is_memory_content,
    false,
  );

  assert.equal(
    contract.perceptual_certainty_is_not_retrieval_confidence,
    true,
  );

  assert.equal(
    contract.perceptual_clarity_is_not_truth_probability,
    true,
  );

  assert.equal(
    contract.persisted_trace_is_fully_consolidated_memory,
    false,
  );

  assert.equal(
    contract.universal_encoding_probability_assumed,
    false,
  );

  assert.equal(
    contract.binary_attention_memory_gate_assumed,
    false,
  );

  assert.equal(
    contract.explicit_programmatic_encoding_decision_hook_supported,
    true,
  );

  assert.equal(
    contract.missing_encoding_decision_preserves_legacy_encoding,
    true,
  );

  assert.equal(
    contract.character_brain_direct_encoding_control_allowed,
    false,
  );

  assert.equal(
    contract.hidden_probabilistic_encoding_gate_allowed,
    false,
  );

  assert.equal(
    contract.subjective_episode_binding_modeled,
    true,
  );

  assert.equal(
    contract.explicit_subjective_episode_binding_hook_supported,
    true,
  );

  assert.equal(
    contract.automatic_subjective_episode_segmentation_modeled,
    false,
  );

  assert.equal(
    contract.world_event_id_auto_promoted_to_subjective_episode_id,
    false,
  );

  assert.equal(
    contract.world_turn_id_auto_promoted_to_subjective_episode_id,
    false,
  );

  assert.equal(
    contract.scene_id_auto_promoted_to_subjective_episode_id,
    false,
  );

  assert.equal(
    contract.subjective_episode_id_exposed_to_character_brain,
    false,
  );

  const loopContract = buildWorldSimulationLoopContract();

  assert.equal(
    loopContract.subjective_memory_formation.version,
    worldSimulationSubjectiveMemoryFormationVersion,
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .owner,
    "programmatic_memory_encoding_decider",
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .receives_world_state,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .receives_full_world_event,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .receives_bounded_perception,
    true,
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .receives_bounded_cognition,
    true,
  );

  assert.equal(
    loopContract
      .subjective_memory_encoding_decision_hook
      .character_brain_direct_encoding_control_allowed,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_episode_binding_hook
      .owner,
    "programmatic_subjective_episode_binder",
  );

  assert.equal(
    loopContract
      .subjective_memory_episode_binding_hook
      .receives_world_state,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_episode_binding_hook
      .receives_full_world_event,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_episode_binding_hook
      .automatic_event_segmentation,
    false,
  );

  assert.equal(
    loopContract
      .subjective_memory_episode_binding_hook
      .world_event_id_auto_used_as_episode_id,
    false,
  );

  const directInput = {
    world_state: worldState,
    turn_id: "direct-memory-turn",
    event: worldState.event_queue[0],
    decision_packets: [{
      character: observer,
      perception: {
        simulation_time: worldState.simulation_time,
        scene_id: sceneId,
        observed: [{
          sense: "visual",
          kind: "visible_entity",
          perceptual_label: "前方站著一名穿深色制服的人",
          target_illumination_lux: 30,
          relative_position: { dx_m: 4, dy_m: 0 },
          entity_id: visibleTarget,
        }],
        audible: [{
          sense: "auditory",
          kind: "audible_sound",
          perceptual_label: "身後傳來一聲短促腳步聲",
          relative_direction_sector: "behind",
          source_entity_id: hiddenTarget,
          sound_id: soundId,
          received_level_db: 48,
        }],
        other_senses: [],
      },
    }],
  };
  const explicitEpisode =
    "subjective-episode-fixture-001";

  const explicitlyBound =
    formWorldSimulationSubjectiveMemories({
      ...directInput,

      episode_bindings: [
        {
          character:
            observer,

          sense:
            "visual",

          sense_index:
            0,

          subjective_episode_id:
            explicitEpisode,
        },

        {
          character:
            observer,

          sense:
            "auditory",

          sense_index:
            0,

          subjective_episode_id:
            explicitEpisode,
        },
      ],
    });

  assert.equal(
    explicitlyBound
      .result
      .explicit_episode_binding_count,
    2,
  );

  const boundVisual =
    explicitlyBound
      .result
      .character_updates[0]
      .memory_records
      .find(
        (item) =>
          item.source.sense === "visual",
      );

  const boundAuditory =
    explicitlyBound
      .result
      .character_updates[0]
      .memory_records
      .find(
        (item) =>
          item.source.sense === "auditory",
      );

  assert.equal(
    boundVisual
      .episodic_binding
      .subjective_episode_id,
    explicitEpisode,
  );

  assert.equal(
    boundAuditory
      .episodic_binding
      .subjective_episode_id,
    explicitEpisode,
  );

  assert.equal(
    boundVisual
      .retrieval_cues
      .subjective_episode_id,
    explicitEpisode,
  );

  const existingBindingWorld =
    structuredClone(worldState);

  existingBindingWorld
    .memories[observer] = [
      structuredClone(boundVisual),
    ];

  const existingBindingAudit =
    formWorldSimulationSubjectiveMemories({
      ...directInput,

      world_state:
        existingBindingWorld,

      episode_bindings: [
        {
          character:
            observer,

          sense:
            "visual",

          sense_index:
            0,

          subjective_episode_id:
            explicitEpisode,
        },
      ],
    });

  const existingBindingResult =
    existingBindingAudit
      .result
      .episode_binding_results
      .find(
        (item) =>
          item.sense === "visual",
      );

  assert.equal(
    existingBindingResult.applied,
    false,
  );

  assert.equal(
    existingBindingResult.reason,
    "memory_already_exists",
  );

  assert.equal(
    Object.hasOwn(
      boundVisual.content,
      "subjective_episode_id",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      explicitlyBound
        .result
        .character_updates[0]
        .memory_records[0]
        .source,
      "subjective_episode_id",
    ),
    false,
  );

  assert.throws(
    () =>
      formWorldSimulationSubjectiveMemories({
        ...directInput,

        episode_bindings: [
          {
            character:
              observer,

            sense:
              "visual",

            sense_index:
              99,

            subjective_episode_id:
              explicitEpisode,
          },
        ],
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_EPISODE_BINDING_UNMATCHED",
  );

  const directHashBefore = hashAgentRunValue(directInput);
  const direct = formWorldSimulationSubjectiveMemories(directInput);
  assert.equal(hashAgentRunValue(directInput), directHashBefore);
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.formation_output_contains_world_state, false);
  assert.equal(direct.audit.character_brain_creates_or_edits_persisted_memory, false);
  assert.equal(direct.result.created_memory_count, 2);
  assert.equal(direct.result.memory_transitions.length, 1);
  const directSerialized = JSON.stringify(direct.result.character_updates[0].memory_records);
  for (const forbidden of [visibleTarget, hiddenTarget, soundId, "target_illumination_lux", "relative_position", "received_level_db", "entity_id", "source_entity_id", "sound_id"]) {
    assert.equal(directSerialized.includes(forbidden), false);
  }
  const directVisual = direct.result.character_updates[0].memory_records.find((item) => item.source.sense === "visual");
  const directAuditory = direct.result.character_updates[0].memory_records.find((item) => item.source.sense === "auditory");
  assert.equal(
    directVisual.perceptual_certainty_at_encoding,
    0.92,
  );

  assert.equal(
    directVisual.perceptual_clarity_at_encoding,
    0.88,
  );

  assert.equal(
    directAuditory.perceptual_certainty_at_encoding,
    0.81,
  );

  assert.equal(
    directAuditory.perceptual_clarity_at_encoding,
    0.74,
  );

  assert.equal(
    directVisual.perceptual_certainty_origin,
    "character_memory_encoding_profile",
  );

  assert.equal(
    directAuditory.perceptual_clarity_origin,
    "character_memory_encoding_profile",
  );

  assert.equal(
    Object.hasOwn(directVisual, "confidence"),
    false,
  );

  assert.equal(
    Object.hasOwn(directVisual, "clarity"),
    false,
  );

  assert.equal(
    directVisual.formation_stage,
    "encoded_unconsolidated",
  );

  assert.equal(
    directVisual.engine_persisted_trace,
    true,
  );

  assert.equal(
    directVisual.internal_provenance.event_id,
    firstEventId,
  );

  assert.equal(
    Object.hasOwn(directVisual.source, "event_id"),
    false,
  );

  const explicitSkip =
    formWorldSimulationSubjectiveMemories({
      ...directInput,

      encoding_decisions: [
        {
          character:
            observer,

          sense:
            "auditory",

          sense_index:
            0,

          decision:
            "do_not_encode",

          reason:
            "explicit fixture encoding exclusion",
        },
      ],
    });

  assert.equal(
    explicitSkip.result.created_memory_count,
    1,
  );

  assert.equal(
    explicitSkip.result.skipped_observation_count,
    1,
  );

  assert.equal(
    explicitSkip.result.explicit_encoding_decision_count,
    1,
  );

  assert.equal(
    explicitSkip
      .result
      .character_updates[0]
      .skipped_observation_count,
    1,
  );

  assert.equal(
    explicitSkip
      .result
      .character_updates[0]
      .memory_records[0]
      .source
      .sense,
    "visual",
  );

  const explicitEncode =
    formWorldSimulationSubjectiveMemories({
      ...directInput,

      encoding_decisions: [
        {
          character:
            observer,

          sense:
            "visual",

          sense_index:
            0,

          decision:
            "encode",

          reason:
            "explicit fixture encode",
        },
      ],
    });

  assert.equal(
    explicitEncode.result.created_memory_count,
    2,
  );

  assert.equal(
    explicitEncode.result.skipped_observation_count,
    0,
  );

  const explicitUnspecified =
    formWorldSimulationSubjectiveMemories({
      ...directInput,

      encoding_decisions: [
        {
          character:
            observer,

          sense:
            "visual",

          sense_index:
            0,

          decision:
            "unspecified",
        },
      ],
    });

  assert.equal(
    explicitUnspecified.result.created_memory_count,
    2,
  );

  /*
   * A Character Brain packet is not an authoritative
   * persistence-control channel.
   */
  const embeddedBrainDirectiveInput =
    structuredClone(directInput);

  embeddedBrainDirectiveInput
    .decision_packets[0]
    .encoding_decisions = [
      {
        character:
          observer,

        sense:
          "auditory",

        sense_index:
          0,

        decision:
          "do_not_encode",
      },
    ];

  const ignoredBrainDirective =
    formWorldSimulationSubjectiveMemories(
      embeddedBrainDirectiveInput,
    );

  assert.equal(
    ignoredBrainDirective.result.created_memory_count,
    2,
    "encoding directives embedded inside decision packets must not control persisted memory",
  );

  assert.equal(
    ignoredBrainDirective.result.skipped_observation_count,
    0,
  );

  assert.throws(
    () =>
      formWorldSimulationSubjectiveMemories({
        ...directInput,

        encoding_decisions: [
          {
            character:
              observer,

            sense:
              "auditory",

            sense_index:
              99,

            decision:
              "do_not_encode",
          },
        ],
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_UNMATCHED",
  );

  assert.throws(
    () =>
      formWorldSimulationSubjectiveMemories({
        ...directInput,

        encoding_decisions: [
          {
            character:
              observer,

            sense:
              "auditory",

            sense_index:
              0,

            decision:
              "probably_encode",
          },
        ],
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ENCODING_DECISION_INVALID",
  );

  const noProfileWorld = structuredClone(worldState);
  delete noProfileWorld.characters[observer].memory_encoding_profile;
  const noProfile = formWorldSimulationSubjectiveMemories({ ...directInput, world_state: noProfileWorld });
  for (
    const record
    of noProfile.result.character_updates[0].memory_records
  ) {
    assert.equal(
      record.perceptual_certainty_at_encoding,
      null,
    );

    assert.equal(
      record.perceptual_clarity_at_encoding,
      null,
    );

    assert.equal(
      record.perceptual_certainty_origin,
      "unspecified",
    );

    assert.equal(
      record.perceptual_clarity_origin,
      "unspecified",
    );

    assert.equal(
      Object.hasOwn(record, "confidence"),
      false,
    );

    assert.equal(
      Object.hasOwn(record, "clarity"),
      false,
    );
  }

  const explicitObservationMetricsInput =
    structuredClone(directInput);

  explicitObservationMetricsInput
    .decision_packets[0]
    .perception
    .observed[0]
    .perceptual_certainty_at_encoding = 0.63;

  explicitObservationMetricsInput
    .decision_packets[0]
    .perception
    .observed[0]
    .perceptual_clarity_at_encoding = 0.57;

  const explicitObservationMetrics =
    formWorldSimulationSubjectiveMemories(
      explicitObservationMetricsInput,
    );

  const explicitObservationVisual =
    explicitObservationMetrics
      .result
      .character_updates[0]
      .memory_records
      .find(
        (item) =>
          item.source.sense === "visual",
      );

  assert.equal(
    explicitObservationVisual
      .perceptual_certainty_at_encoding,
    0.63,
  );

  assert.equal(
    explicitObservationVisual
      .perceptual_clarity_at_encoding,
    0.57,
  );

  assert.equal(
    explicitObservationVisual
      .perceptual_certainty_origin,
    "perception_observation",
  );

  assert.equal(
    explicitObservationVisual
      .perceptual_clarity_origin,
    "perception_observation",
  );

  assert.equal(
    Object.hasOwn(
      explicitObservationVisual.content,
      "perceptual_certainty_at_encoding",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      explicitObservationVisual.content,
      "perceptual_clarity_at_encoding",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      explicitObservationVisual.content,
      "confidence",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      explicitObservationVisual.content,
      "clarity",
    ),
    false,
  );

  const encodingHookSession =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase63A explicit encoding decision hook fixture",

        seed:
          "phase63a-encoding-hook",

        rules: {
          event_driven: true,
          persistent_causality: true,
        },

        initial_world_state:
          worldState,
      },
      options,
    );

  const encodingHookTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          encodingHookSession
            .world_simulation_session_id,

        event_id:
          firstEventId,
      },
      {
        ...options,

        memoryEncodingDecider:
          async (input) => {
            assert.equal(
              Object.hasOwn(
                input,
                "world_state",
              ),
              false,
            );

            assert.equal(
              Object.hasOwn(
                input,
                "event",
              ),
              false,
            );

            assert.equal(
              input.character_packets.length,
              1,
            );

            assert.equal(
              input
                .character_packets[0]
                .character,
              observer,
            );

            assert.ok(
              input
                .character_packets[0]
                .perception,
            );

            assert.ok(
              input
                .character_packets[0]
                .cognition,
            );

            return [
              {
                character:
                  observer,

                sense:
                  "auditory",

                sense_index:
                  0,

                decision:
                  "do_not_encode",

                reason:
                  "fixture explicit programmatic exclusion",
              },
            ];
          },

        characterBrain:
          async () => ({
            action_id:
              "stay-observant",
          }),

        causalAdjudicator:
          noOpAdjudicator,
      },
    );

  assert.equal(
    encodingHookTurn.ok,
    true,
  );

  assert.equal(
    encodingHookTurn.committed,
    true,
  );

  assert.equal(
    encodingHookTurn
      .subjective_memory_encoding_decisions
      .audit
      .decider_used,
    true,
  );

  assert.equal(
    encodingHookTurn
      .subjective_memory_encoding_decisions
      .audit
      .world_state_exposed_to_decider,
    false,
  );

  assert.equal(
    encodingHookTurn
      .subjective_memory_encoding_decisions
      .audit
      .full_world_event_exposed_to_decider,
    false,
  );

  assert.equal(
    encodingHookTurn
      .subjective_memory_formation
      .created_memory_count,
    1,
  );

  const encodingHookState =
    await getWorldSimulationState(
      encodingHookSession
        .world_simulation_session_id,
      options,
    );

  assert.equal(
    encodingHookState
      .state
      .memories[observer]
      .length,
    1,
  );

  assert.equal(
    encodingHookState
      .state
      .memories[observer][0]
      .source
      .sense,
    "visual",
  );

  const encodingHookHistory =
    await getWorldSimulationHistory(
      encodingHookSession
        .world_simulation_session_id,
      options,
    );

  assert.equal(
    encodingHookHistory
      .turns[0]
      .subjective_memory_encoding_decisions
      .audit
      .decider_used,
    true,
  );

  assert.equal(
    encodingHookHistory
      .turns[0]
      .subjective_memory_encoding_decisions
      .audit
      .world_state_exposed_to_decider,
    false,
  );

  assert.equal(
    encodingHookHistory
      .turns[0]
      .subjective_memory_encoding_decisions
      .audit
      .full_world_event_exposed_to_decider,
    false,
  );

  assert.equal(
    encodingHookHistory
      .turns[0]
      .subjective_memory_formation
      .result
      .skipped_observation_count,
    1,
  );

  const episodeBindingSession =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase63A subjective episode binding fixture",

        seed:
          "phase63a-episode-binding",

        rules: {
          event_driven:
            true,

          persistent_causality:
            true,
        },

        initial_world_state:
          worldState,
      },
      options,
    );

  const episodeBindingTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          episodeBindingSession
            .world_simulation_session_id,

        event_id:
          firstEventId,
      },
      {
        ...options,

        memoryEpisodeBinder:
          async (input) => {
            assert.equal(
              Object.hasOwn(
                input,
                "world_state",
              ),
              false,
            );

            assert.equal(
              Object.hasOwn(
                input,
                "event",
              ),
              false,
            );

            assert.equal(
              input.character_packets.length,
              1,
            );

            return [
              {
                character:
                  observer,

                sense:
                  "visual",

                sense_index:
                  0,

                subjective_episode_id:
                  "subjective-episode-loop-001",
              },

              {
                character:
                  observer,

                sense:
                  "auditory",

                sense_index:
                  0,

                subjective_episode_id:
                  "subjective-episode-loop-001",
              },
            ];
          },

        characterBrain:
          async () => ({
            action_id:
              "stay-observant",
          }),

        causalAdjudicator:
          noOpAdjudicator,
      },
    );

  assert.equal(
    episodeBindingTurn.ok,
    true,
  );

  assert.equal(
    episodeBindingTurn
      .subjective_memory_episode_bindings
      .audit
      .binder_used,
    true,
  );

  assert.equal(
    episodeBindingTurn
      .subjective_memory_episode_bindings
      .audit
      .automatic_segmentation_used,
    false,
  );

  assert.equal(
    episodeBindingTurn
      .subjective_memory_episode_bindings
      .audit
      .world_state_exposed_to_binder,
    false,
  );

  assert.equal(
    episodeBindingTurn
      .subjective_memory_episode_bindings
      .audit
      .full_world_event_exposed_to_binder,
    false,
  );

  const episodeBindingState =
    await getWorldSimulationState(
      episodeBindingSession
        .world_simulation_session_id,
      options,
    );

  assert.equal(
    episodeBindingState
      .state
      .memories[observer]
      .length,
    2,
  );

  assert.equal(
    episodeBindingState
      .state
      .memories[observer]
      .every(
        (item) =>
          item
            .episodic_binding
            ?.subjective_episode_id
          === "subjective-episode-loop-001",
      ),
    true,
  );

  const episodeBindingHistory =
    await getWorldSimulationHistory(
      episodeBindingSession
        .world_simulation_session_id,
      options,
    );

  assert.equal(
    episodeBindingHistory
      .turns[0]
      .subjective_memory_episode_bindings
      .audit
      .binder_used,
    true,
  );

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase63A subjective memory formation fixture",
    seed: "phase63a",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const firstBrainInputs = [];
  const firstTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: firstEventId,
    },
    {
      ...options,
      characterBrain: async (packet) => {
        firstBrainInputs.push(packet);
        assert.equal(packet.retrieved_memories.length, 0, "new perception must not become retroactive same-turn memory");
        const serialized = JSON.stringify(packet);
        assert.equal(serialized.includes("前方站著一名穿深色制服的人"), true);
        assert.equal(serialized.includes("身後傳來一聲短促腳步聲"), true);
        assert.equal(serialized.includes("右側牆後藏著不該被看到的人"), false);
        assert.equal(serialized.includes(visibleTarget), false);
        assert.equal(serialized.includes(hiddenTarget), false);
        assert.equal(serialized.includes(soundId), false);
        return { action_id: "stay-observant" };
      },
      causalAdjudicator: noOpAdjudicator,
    },
  );
  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.equal(firstBrainInputs.length, 1);
  assert.equal(firstTurn.subjective_memory_formation.version, worldSimulationSubjectiveMemoryFormationVersion);
  assert.equal(firstTurn.subjective_memory_formation.created_memory_count, 2);
  assert.equal(firstTurn.subjective_memory_formation.mutation_count, 1);
  assert.equal(firstTurn.subjective_memory_formation.authoritative_executor, worldSimulationMutationExecutorVersion);

  const afterFirst = await getWorldSimulationState(session.world_simulation_session_id, options);
  const persisted = afterFirst.state.memories[observer];
  assert.equal(persisted.length, 2);
  const persistedText = JSON.stringify(persisted);
  assert.equal(persistedText.includes("前方站著一名穿深色制服的人"), true);
  assert.equal(persistedText.includes("身後傳來一聲短促腳步聲"), true);
  assert.equal(persistedText.includes("右側牆後藏著不該被看到的人"), false);
  for (const forbidden of [visibleTarget, hiddenTarget, soundId, "target_illumination_lux", "relative_position", "received_level_db"]) {
    assert.equal(persistedText.includes(forbidden), false);
  }
  assert.deepEqual(afterFirst.state.characters[observer].known, ["這裡是測試場景"]);

  const firstHistory = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(firstHistory.turns.length, 1);
  assert.equal(firstHistory.turns[0].subjective_memory_formation.subjective_memory_formation_version, worldSimulationSubjectiveMemoryFormationVersion);
  assert.equal(firstHistory.turns[0].subjective_memory_formation.result.created_memory_count, 2);
  assert.equal(firstHistory.turns[0].subjective_memory_mutation_queue.mutation_count, 1);
  assert.equal(firstHistory.turns[0].subjective_memory_mutation_execution.sole_final_world_state_writer, true);
  assert.equal(firstHistory.turns[0].subjective_memory_mutation_execution.version, worldSimulationMutationExecutorVersion);

  const secondBrainInputs = [];
  const secondTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: secondEventId,
    },
    {
      ...options,
      characterBrain: async (packet) => {
        secondBrainInputs.push(packet);
        assert.equal(packet.retrieved_memories.length, 2);
        const visualMemory = packet.retrieved_memories.find((item) => item.source.sense === "visual");
        const auditoryMemory = packet.retrieved_memories.find((item) => item.source.sense === "auditory");
        assert.ok(visualMemory);
        assert.ok(auditoryMemory);
        assert.equal(
          visualMemory.source.kind,
          "direct_perception",
        );

        assert.equal(
          visualMemory.memory_type,
          "episodic_direct_perception",
        );

        assert.equal(
          Object.hasOwn(
            visualMemory.source,
            "event_id",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            visualMemory.source,
            "scene_id",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            visualMemory.source,
            "turn_id",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            visualMemory.source,
            "observation_hash",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            visualMemory.source,
            "formation_version",
          ),
          false,
        );

        assert.equal(
          visualMemory.perceptual_certainty_at_encoding,
          0.92,
        );

        assert.equal(
          visualMemory.perceptual_clarity_at_encoding,
          0.88,
        );

        assert.equal(
          visualMemory.perceptual_certainty_origin,
          "character_memory_encoding_profile",
        );

        assert.equal(
          auditoryMemory.perceptual_clarity_origin,
          "character_memory_encoding_profile",
        );

        assert.equal(
          Object.hasOwn(visualMemory, "confidence"),
          false,
        );

        assert.equal(
          Object.hasOwn(visualMemory, "clarity"),
          false,
        );

        const brainMemoryText =
          JSON.stringify(packet.retrieved_memories);

        assert.equal(
          brainMemoryText.includes(firstEventId),
          false,
        );

        assert.equal(
          brainMemoryText.includes(
            worldSimulationSubjectiveMemoryFormationVersion,
          ),
          false,
        );

        assert.equal(
          brainMemoryText.includes("internal_provenance"),
          false,
        );

        assert.equal(
          brainMemoryText.includes("retrieval_cues"),
          false,
        );

        assert.equal(
          brainMemoryText.includes("episodic_binding"),
          false,
        );

        assert.equal(
          brainMemoryText.includes("subjective_episode_id"),
          false,
        );

        assert.equal(
          brainMemoryText.includes("encoded_at"),
          false,
        );

        assert.equal(
          brainMemoryText.includes("last_recalled_at"),
          false,
        );

        assert.equal(
          brainMemoryText.includes(hiddenTarget),
          false,
        );
        return { action_id: "stay-observant" };
      },
      causalAdjudicator: noOpAdjudicator,
    },
  );
  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.equal(secondBrainInputs.length, 1);

  const finalState = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(finalState.state.memories[observer].length, 4, "second turn should create a new episodic memory pair instead of rewriting the prior records");
  assert.deepEqual(finalState.state.characters[observer].known, ["這裡是測試場景"]);

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 2);

  console.log(JSON.stringify({
    subjective_memory_formation_version: worldSimulationSubjectiveMemoryFormationVersion,
    persisted_history_turns: history.turns.length,
    first_turn_created_memory_count: firstTurn.subjective_memory_formation.created_memory_count,
    first_turn_memory_mutation_count: firstTurn.subjective_memory_formation.mutation_count,
    second_turn_retrieved_prior_memory_count: secondBrainInputs[0].retrieved_memories.length,
    final_memory_count: finalState.state.memories[observer].length,
    visual_perceptual_certainty_preserved:
      directVisual.perceptual_certainty_at_encoding === 0.92,

    auditory_perceptual_clarity_preserved:
      directAuditory.perceptual_clarity_at_encoding === 0.74,

    missing_profile_leaves_metrics_unspecified:
      noProfile.result.character_updates[0].memory_records.every(
        (item) =>
          item.perceptual_certainty_at_encoding === null
          && item.perceptual_clarity_at_encoding === null,
      ),

    engine_provenance_persisted_for_audit:
      directVisual.internal_provenance.event_id
      === firstEventId,

    engine_provenance_exposed_to_character_brain:
      false,

    explicit_observation_encoding_metrics_override_profile:
      explicitObservationVisual
        .perceptual_certainty_at_encoding === 0.63
      && explicitObservationVisual
        .perceptual_clarity_at_encoding === 0.57,

    encoding_metadata_leaked_into_memory_content:
      Object.hasOwn(
        explicitObservationVisual.content,
        "perceptual_certainty_at_encoding",
      )
      || Object.hasOwn(
        explicitObservationVisual.content,
        "perceptual_clarity_at_encoding",
      ),

    explicit_programmatic_encoding_skip_supported:
      explicitSkip.result.created_memory_count === 1
      && explicitSkip.result.skipped_observation_count === 1,

    explicit_encode_preserves_formation:
      explicitEncode.result.created_memory_count === 2,

    explicit_unspecified_preserves_formation:
      explicitUnspecified.result.created_memory_count === 2,

    embedded_character_brain_encoding_directive_ignored:
      ignoredBrainDirective.result.created_memory_count === 2,

    world_loop_encoding_decider_used:
      encodingHookTurn
        .subjective_memory_encoding_decisions
        .audit
        .decider_used === true,

    encoding_decider_world_truth_exposed:
      encodingHookTurn
        .subjective_memory_encoding_decisions
        .audit
        .world_state_exposed_to_decider === true,

    encoding_decider_full_world_event_exposed:
      encodingHookTurn
        .subjective_memory_encoding_decisions
        .audit
        .full_world_event_exposed_to_decider === true,

    explicit_subjective_episode_binding_supported:
      boundVisual
        .episodic_binding
        .subjective_episode_id
      === explicitEpisode
      && boundAuditory
        .episodic_binding
        .subjective_episode_id
      === explicitEpisode,

    existing_episode_binding_nonapplication_audited:
      existingBindingResult.applied === false
      && existingBindingResult.reason
        === "memory_already_exists",

    automatic_subjective_episode_segmentation_used:
      episodeBindingTurn
        .subjective_memory_episode_bindings
        .audit
        .automatic_segmentation_used === true,

    episode_binder_world_truth_exposed:
      episodeBindingTurn
        .subjective_memory_episode_bindings
        .audit
        .world_state_exposed_to_binder === true,

    episode_binder_full_world_event_exposed:
      episodeBindingTurn
        .subjective_memory_episode_bindings
        .audit
        .full_world_event_exposed_to_binder === true,

    persisted_trace_claimed_fully_consolidated:
      false,
    hidden_target_not_encoded: persistedText.includes(hiddenTarget) === false,
    engine_perception_ids_stripped_from_memory_content: [visibleTarget, hiddenTarget, soundId].every((id) => persistedText.includes(id) === false),
    objective_known_facts_auto_promoted: false,
    same_turn_retroactive_memory_use: false,
    authoritative_memory_writer_version: worldSimulationMutationExecutorVersion,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_creates_or_edits_persisted_memory: false,
    active_memory_decay_modeled: false,
    post_outcome_perception_capture_modeled: false,
  }));
  console.log("Phase63A subjective memory formation test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
