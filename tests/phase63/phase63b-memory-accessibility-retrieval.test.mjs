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
  buildWorldSimulationMemoryAccessibilityContract,
  queryWorldSimulationMemoryAccessibility,
  worldSimulationMemoryAccessibilityVersion,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  run_world_memory_retriever,
} from "../../server/src/world-simulation-neural-service.mjs";

import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase63b-memory-accessibility-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "phase63b-observer-engine-id";
const sceneId = "phase63b-current-room";
const otherSceneId = "phase63b-other-room";
const eventId = "evt-phase63b-retrieval";
const now = "2026-08-24T19:30:00+08:00";

function memoryRecord({
  id,
  label,
  scene = sceneId,
  encodedAt,
  storageStrength = null,
  encodingRetrievalStrength = null,
  recallCount = null,
  lastRecalledAt = null,
  interferenceKeys = [],
  accessible = true,
}) {
  return {
    memory_id: id,
    memory_type: "episodic_direct_perception",
    content: { kind: "visible_entity", perceptual_label: label },
    source: {
      kind: "direct_perception",
      sense: "visual",
      event_id: `source-${id}`,
      scene_id: scene,
      turn_id: `turn-${id}`,
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    confidence: 0.77,
    clarity: 0.66,
    encoded_at: encodedAt,
    last_recalled_at: lastRecalledAt,
    recall_count: recallCount,
    storage_strength: storageStrength,
    retrieval_strength_at_encoding: encodingRetrievalStrength,
    interference_keys: interferenceKeys,
    accessible,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

const recentSameContext = memoryRecord({
  id: "mem-recent-same-context",
  label: "一小時前在這個房間看見一名學生",
  encodedAt: "2026-08-24T18:30:00+08:00",
  storageStrength: 0.8,
  encodingRetrievalStrength: 0.7,
});
const oldStrongDifferentContext = memoryRecord({
  id: "mem-old-strong-different-context",
  label: "十天前在另一個房間看見一名學生",
  scene: otherSceneId,
  encodedAt: "2026-08-14T19:30:00+08:00",
  storageStrength: 0.95,
  encodingRetrievalStrength: 0.8,
});
const recalledSameContext = memoryRecord({
  id: "mem-recalled-same-context",
  label: "三天前在這個房間看見一名學生，之後曾多次想起",
  encodedAt: "2026-08-21T19:30:00+08:00",
  storageStrength: 0.7,
  encodingRetrievalStrength: 0.6,
  recallCount: 4,
  lastRecalledAt: "2026-08-24T17:30:00+08:00",
});
const inaccessible = memoryRecord({
  id: "mem-explicitly-inaccessible",
  label: "這筆不應被取回",
  encodedAt: "2026-08-24T19:00:00+08:00",
  storageStrength: 1,
  accessible: false,
});

const retrievalProfile = {
  enabled: true,
  retrieval_threshold: 0.55,
  max_items: 3,
  component_weights: {
    storage_strength: 0.15,
    age_accessibility: 0.3,
    recall_recency: 0.2,
    recall_frequency: 0.15,
    context_match: 0.2,
  },
  age_accessibility: {
    mode: "hyperbolic",
    scale_hours: 24,
  },
  recall_recency: {
    mode: "hyperbolic",
    scale_hours: 12,
  },
  recall_frequency: {
    saturation_count: 4,
  },
  context_cue_weights: {
    scene_id: 1,
  },
  interference: {
    enabled: true,
    per_competitor_penalty: 0.2,
    max_penalty: 0.4,
  },
};

const worldState = {
  simulation_time: now,
  world_rules: {},
  event_queue: [{
    event_id: eventId,
    type: "memory_retrieval_fixture",
    scene_id: sceneId,
    participants: [observer],
  }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: { [observer]: { x: 2, y: 2 } },
      obstacles: [],
      structures: [],
      doors: [],
    },
  },
  characters: {
    [observer]: {
      current_action: "回想最近的事情",
      memory_retrieval_profile: retrievalProfile,
    },
  },
  memories: {
    [observer]: [recentSameContext, oldStrongDifferentContext, recalledSameContext, inaccessible],
  },
  objects: {},
  available_actions: {
    [observer]: [{ action_id: "remain-still", intent: "維持原地" }],
  },
};

function noOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase63b-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [{
      actor: observer,
      action_id: "remain-still",
      result: "remained_still",
      causal_evidence: "fixture changes no hard state except queue consumption",
    }],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

try {
  const contract = buildWorldSimulationMemoryAccessibilityContract();
  assert.equal(contract.version, worldSimulationMemoryAccessibilityVersion);
  assert.equal(
    contract.current_accessibility_is_not_successful_retrieval,
    true,
  );

  assert.equal(
    contract.candidate_terminology_supported,
    true,
  );

  assert.equal(
    contract.candidate_memory_records_are_not_asserted_successfully_retrieved,
    true,
  );

  assert.equal(
    contract.native_v2_cue_schema_reserved,
    false,
  );

  assert.equal(
    contract.native_v2_cue_algorithm_modeled,
    true,
  );

  assert.equal(
    contract.typed_active_retrieval_cues_supported,
    true,
  );

  assert.equal(
    contract.duplicate_active_cue_sources_preserved,
    true,
  );

  assert.equal(
    contract.independent_memory_cue_associations_preserved,
    true,
  );

  assert.equal(
    contract.malformed_explicit_cue_structures_rejected,
    true,
  );

  assert.equal(
    contract.encoding_linked_memory_cues_supported,
    true,
  );

  assert.equal(
    contract.subjective_episode_cues_supported,
    true,
  );

  assert.equal(
    contract.query_relative_cue_competition_modeled,
    true,
  );

  assert.equal(
    contract.fixed_per_competitor_penalty_in_native_v2,
    false,
  );

  assert.equal(
    contract.native_accessibility_score_defaults_to_null,
    true,
  );

  assert.equal(
    contract.native_storage_strength_direct_bonus,
    false,
  );

  assert.equal(
    contract.native_legacy_component_mixing_rejected,
    true,
  );

  assert.equal(
    contract.hidden_temporal_context_vector_modeled,
    false,
  );

  assert.equal(
    contract.universal_context_drift_assumed,
    false,
  );

  assert.equal(
    contract.random_retrieval_sampling_used,
    false,
  );

  assert.equal(
    contract.legacy_v1_weighted_compatibility_supported,
    true,
  );

  assert.equal(
    contract.unknown_explicit_model_mode_rejected,
    true,
  );

  assert.equal(
    contract.scalar_accessibility_score_is_literal_human_psychometric_measurement,
    false,
  );

  assert.equal(
    contract.engine_retrieval_eligibility_is_not_psychological_retrievability,
    true,
  );

  assert.equal(
    contract.projection_budget_is_not_cognitive_capacity,
    true,
  );

  assert.equal(
    contract.actual_retrieval_outcome_owned_by_phase63c,
    true,
  );

  assert.equal(contract.storage_strength_and_retrieval_strength_separate, true);
  assert.equal(contract.persistent_memory_decay_writes_allowed, false);
  assert.equal(contract.forgetting_deletes_memory_records, false);
  assert.equal(contract.explicit_profile_required_for_programmatic_filtering, true);
  assert.equal(contract.universal_forgetting_curve_assumed, false);
  assert.deepEqual(contract.supported_explicit_age_functions, ["none", "hyperbolic", "exponential", "power"]);
  assert.equal(contract.explicit_context_cues_only, true);
  assert.equal(contract.explicit_interference_keys_only, true);
  assert.equal(contract.retrieval_strength_scores_forwarded_to_character_brain, false);
  assert.equal(contract.character_brain_decides_memory_accessibility, false);

  const loopContract =
    buildWorldSimulationLoopContract();

  assert.equal(
    loopContract
      .subjective_memory_accessibility
      .version,
    worldSimulationMemoryAccessibilityVersion,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .accessibility_candidate_set_is_authoritative_input,
    true,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .projection_budget_is_separate_from_memory_accessibility,
    true,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .projection_budget_is_cognitive_capacity,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .actual_retrieval_success_asserted,
    false,
  );

  assert.equal(
    contract
      .native_v2_retrieval_history_effects_modeled,
    false,
  );

  assert.equal(
    contract
      .retrieval_event_schema_installed,
    false,
  );

  assert.equal(
    contract
      .retrieval_event_schema_owner,
    "Phase63C",
  );

  assert.equal(
    contract
      .retrieval_history_mutation_owner,
    "Phase63C",
  );

  assert.equal(
    contract
      .same_cycle_retrieval_history_feedback_allowed,
    false,
  );

  assert.equal(
    contract
      .projected_memory_context_counts_as_successful_retrieval,
    false,
  );

  assert.equal(
    contract
      .legacy_retrieval_history_precedes_summary_fields,
    true,
  );

  assert.equal(
    contract
      .legacy_retrieval_history_requires_explicit_success,
    true,
  );

  assert.equal(
    contract
      .failed_or_ambiguous_history_entries_count_as_successful_recall,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .projection_appends_retrieval_history,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .projection_updates_recall_count,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .projection_updates_last_recalled_at,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .same_cycle_projection_feeds_memory_accessibility,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .actual_retrieval_event_owner,
    "Phase63C",
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .engine_retrieval_context_exposed_to_character_brain,
    false,
  );

  assert.equal(
    loopContract
      .memory_context_projection
      .engine_projection_policy_exposed_to_character_brain,
    false,
  );

  const directInput = {
    world_state: worldState,
    character: observer,
    memory_records: worldState.memories[observer],
    simulation_time: now,
    scene_id: sceneId,
    perception: { scene_id: sceneId, observed: [], audible: [], other_senses: [] },
  };
  const directHashBefore = hashAgentRunValue(directInput);
  const direct = queryWorldSimulationMemoryAccessibility(directInput);
  assert.equal(hashAgentRunValue(directInput), directHashBefore);
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.read_only_memory_accessibility_query, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.equal(direct.audit.persistent_memory_records_mutated, false);
  assert.equal(
    direct.result.accessibility_enforced,
    true,
  );

  assert.equal(
    direct.result.model_mode,
    "legacy_v1_weighted_compatibility",
  );

  assert.deepEqual(
    direct.result
      .candidate_memory_records
      .map((item) => item.memory_id),
    [
      recentSameContext.memory_id,
      recalledSameContext.memory_id,
    ],
  );

  assert.deepEqual(
    direct.result
      .retrievable_memory_records
      .map((item) => item.memory_id),
    direct.result
      .candidate_memory_records
      .map((item) => item.memory_id),
  );

  const byId = new Map(direct.result.evaluations.map((item) => [item.memory_id, item]));
  const recentEval = byId.get(recentSameContext.memory_id);
  const oldEval = byId.get(oldStrongDifferentContext.memory_id);
  const recalledEval = byId.get(recalledSameContext.memory_id);
  const inaccessibleEval = byId.get(inaccessible.memory_id);
  assert.ok(
    recentEval.retrieval_strength
    > 0.8,
  );

  assert.ok(
    oldEval.retrieval_strength
    < 0.4,
  );

  assert.equal(
    recentEval
      .accessibility_score,
    recentEval
      .retrieval_strength,
  );

  assert.equal(
    recentEval
      .accessibility_score_origin,
    "legacy_v1_weighted_compatibility",
  );

  assert.equal(
    recentEval
      .candidate_eligible,
    true,
  );

  assert.equal(
    recentEval
      .engine_retrieval_eligibility_source,
    "legacy_accessible",
  );

  assert.equal(
    inaccessibleEval
      .candidate_eligible,
    false,
  );

  assert.ok(recentEval.retrieval_strength > 0.8);
  assert.ok(oldEval.retrieval_strength < 0.4);
  assert.equal(oldEval.storage_strength, 0.95, "high storage strength must remain distinct from low current retrieval strength");
  assert.equal(oldEval.retrievable, false);
  assert.ok(recalledEval.retrieval_strength > oldEval.retrieval_strength);
  assert.equal(recalledEval.recall_count, 4);
  assert.equal(recalledEval.components.recall_frequency.value, 1);
  assert.equal(recentEval.context_match, 1);
  assert.equal(oldEval.context_match, 0);
  assert.equal(inaccessibleEval.retrievable, false);
  assert.deepEqual(
    direct.result.retrievable_memory_records.map((item) => item.memory_id),
    [recentSameContext.memory_id, recalledSameContext.memory_id],
  );
  const directBeforeRecords = JSON.stringify(worldState.memories[observer]);
  assert.equal(JSON.stringify(directInput.memory_records), directBeforeRecords);
  assert.equal(direct.result.retrievable_memory_records.some((item) => Object.hasOwn(item, "retrieval_strength")), false);

  const noProfileWorld = structuredClone(worldState);
  delete noProfileWorld.characters[observer].memory_retrieval_profile;
  const noProfile = queryWorldSimulationMemoryAccessibility({
    ...directInput,
    world_state: noProfileWorld,
    memory_records: noProfileWorld.memories[observer],
  });
  assert.equal(
    noProfile.result.accessibility_enforced,
    false,
  );

  assert.equal(
    noProfile.result.model_mode,
    "legacy_unfiltered_eligibility",
  );

  assert.deepEqual(
    noProfile.result
      .candidate_memory_records
      .map((item) => item.memory_id),
    [
      recentSameContext.memory_id,
      oldStrongDifferentContext.memory_id,
      recalledSameContext.memory_id,
    ],
  );

  assert.deepEqual(
    noProfile.result.retrievable_memory_records.map((item) => item.memory_id),
    [recentSameContext.memory_id, oldStrongDifferentContext.memory_id, recalledSameContext.memory_id],
  );
  assert.equal(JSON.stringify(noProfileWorld.memories[observer]), directBeforeRecords);

  const nativeEpisodeA =
    memoryRecord({
      id:
        "mem-native-episode-a",

      label:
        "同一房間、主觀事件 A",

      encodedAt:
        "2026-08-24T18:00:00+08:00",
    });

  nativeEpisodeA.retrieval_cues = {
    scene_id:
      sceneId,

    memory_type:
      "episodic_direct_perception",
  };

  nativeEpisodeA.episodic_binding = {
    subjective_episode_id:
      "subjective-episode-a",

    source:
      "phase63b-test",
  };

  const nativeSharedScene =
    memoryRecord({
      id:
        "mem-native-shared-scene",

      label:
        "同一房間、不同主觀事件",

      encodedAt:
        "2026-08-24T18:05:00+08:00",
    });

  nativeSharedScene.retrieval_cues = {
    scene_id:
      sceneId,

    memory_type:
      "episodic_direct_perception",
  };

  nativeSharedScene.episodic_binding = {
    subjective_episode_id:
      "subjective-episode-b",

    source:
      "phase63b-test",
  };

  const nativeOtherScene =
    memoryRecord({
      id:
        "mem-native-other-scene",

      label:
        "另一個房間",

      scene:
        otherSceneId,

      encodedAt:
        "2026-08-24T18:10:00+08:00",
    });

  nativeOtherScene.retrieval_cues = {
    scene_id:
      otherSceneId,

    memory_type:
      "episodic_direct_perception",
  };

  nativeOtherScene.episodic_binding = {
    subjective_episode_id:
      "subjective-episode-c",

    source:
      "phase63b-test",
  };

  const nativeCueQuery =
    queryWorldSimulationMemoryAccessibility({
      world_state: {
        simulation_time:
          now,

        characters: {
          [observer]: {},
        },
      },

      character:
        observer,

      memory_records: [
        nativeEpisodeA,
        nativeSharedScene,
        nativeOtherScene,
      ],

      simulation_time:
        now,

      scene_id:
        sceneId,

      perception: {
        scene_id:
          sceneId,

        observed: [],
        audible: [],
        other_senses: [],
      },

      retrieval_context: {
        active_cues: [
          {
            kind:
              "subjective_episode",

            value:
              "subjective-episode-a",

            source:
              "explicit_test_reinstatement",
          },
        ],
      },

      memory_retrieval_profile: {
        enabled:
          true,

        model_mode:
          "cue_dependent_v2",
      },
    });

  assert.equal(
    nativeCueQuery.result
      .model_mode,
    "cue_dependent_v2",
  );

  assert.deepEqual(
    nativeCueQuery.result
      .candidate_memory_records
      .map((item) => item.memory_id),

    [
      nativeEpisodeA.memory_id,
      nativeSharedScene.memory_id,
    ],
  );

  const nativeById =
    new Map(
      nativeCueQuery.result
        .candidate_evaluations
        .map((item) => [
          item.memory_id,
          item,
        ]),
    );

  const nativeEpisodeAEval =
    nativeById.get(
      nativeEpisodeA.memory_id,
    );

  const nativeSharedEval =
    nativeById.get(
      nativeSharedScene.memory_id,
    );

  const nativeOtherEval =
    nativeById.get(
      nativeOtherScene.memory_id,
    );

  assert.equal(
    nativeEpisodeAEval
      .candidate_eligible,
    true,
  );

  assert.equal(
    nativeSharedEval
      .candidate_eligible,
    true,
  );

  assert.equal(
    nativeOtherEval
      .candidate_eligible,
    false,
  );

  assert.deepEqual(
    nativeOtherEval
      .exclusion_reasons,

    [
      "no_active_cue_match",
    ],
  );

  assert.equal(
    nativeEpisodeAEval
      .accessibility_score,
    null,
  );

  assert.equal(
    nativeEpisodeAEval
      .accessibility_score_origin,
    "native_v2_no_scalar_model",
  );

  assert.equal(
    nativeEpisodeAEval
      .storage_strength_used_as_native_accessibility_bonus,
    false,
  );

  const spatialCompetition =
    nativeEpisodeAEval
      .cue_competition
      .find(
        (item) =>
          item.kind
          === "spatial_context",
      );

  const episodeCompetition =
    nativeEpisodeAEval
      .cue_competition
      .find(
        (item) =>
          item.kind
          === "subjective_episode",
      );

  assert.equal(
    spatialCompetition
      .candidate_fan_out,
    2,
  );

  assert.equal(
    spatialCompetition
      .competing_candidate_count,
    1,
  );

  assert.equal(
    spatialCompetition
      .numeric_penalty_applied,
    false,
  );

  assert.equal(
    episodeCompetition
      .candidate_fan_out,
    1,
  );

  assert.equal(
    episodeCompetition
      .diagnosticity,
    "unique_within_current_query",
  );

  assert.equal(
    nativeEpisodeAEval
      .cue_matches
      .some(
        (item) =>
          item.kind
            === "subjective_episode"
          && item.value
            === "subjective-episode-a",
      ),
    true,
  );

  assert.equal(
    nativeCueQuery.result
      .active_retrieval_cues
      .some(
        (item) =>
          item.kind
            === "spatial_context"
          && item.value
            === sceneId
              .toLocaleLowerCase(
                "zh-Hant-TW",
              ),
      ),
    true,
  );

  assert.equal(
    nativeCueQuery.result
      .active_retrieval_cues
      .some(
        (item) =>
          item.kind
            === "subjective_episode"
          && item.value
            === "subjective-episode-a",
      ),
    true,
  );

  const duplicateSpatialCueQuery =
    queryWorldSimulationMemoryAccessibility({
      world_state: {
        simulation_time:
          now,

        characters: {
          [observer]: {},
        },
      },

      character:
        observer,

      memory_records: [
        nativeEpisodeA,
      ],

      simulation_time:
        now,

      scene_id:
        sceneId,

      perception: {
        scene_id:
          sceneId,

        observed: [],
        audible: [],
        other_senses: [],
      },

      retrieval_context: {
        active_cues: [
          {
            kind:
              "spatial_context",

            value:
              sceneId,

            source:
              "explicit_duplicate_spatial_source",
          },
        ],
      },

      memory_retrieval_profile: {
        enabled:
          true,

        model_mode:
          "cue_dependent_v2",
      },
    });

  const mergedSpatialCue =
    duplicateSpatialCueQuery
      .result
      .active_retrieval_cues
      .find(
        (item) =>
          item.kind
          === "spatial_context",
      );

  assert.deepEqual(
    mergedSpatialCue.sources,
    [
      "current_environment",
      "explicit_duplicate_spatial_source",
    ],
  );

  const explicitEntityMemory =
    memoryRecord({
      id:
        "mem-native-explicit-entity-link",

      label:
        "explicit entity cue",

      encodedAt:
        "2026-08-24T18:15:00+08:00",
    });

  explicitEntityMemory.retrieval_cue_links = [
    {
      kind:
        "entity",

      value:
        "elias_noll",

      source:
        "explicit_test_link_a",

      association_strength:
        0.4,
    },

    {
      kind:
        "entity",

      value:
        "elias_noll",

      source:
        "explicit_test_link_b",

      association_strength:
        0.8,
    },
  ];

  const contentOnlyEntityMemory =
    memoryRecord({
      id:
        "mem-native-content-only-entity",

      label:
        "elias_noll appears only in free text content",

      encodedAt:
        "2026-08-24T18:20:00+08:00",
    });

  const explicitEntityQuery =
    queryWorldSimulationMemoryAccessibility({
      world_state: {
        simulation_time:
          now,

        characters: {
          [observer]: {},
        },
      },

      character:
        observer,

      memory_records: [
        explicitEntityMemory,
        contentOnlyEntityMemory,
      ],

      simulation_time:
        now,

      // Deliberately omit scene_id so no implicit spatial cue
      // broadens this entity-only retrieval test.
      perception: {
        observed: [],
        audible: [],
        other_senses: [],
      },

      retrieval_context: {
        active_cues: [
          {
            kind:
              "entity",

            value:
              "elias_noll",

            source:
              "explicit_entity_query",
          },
        ],
      },

      memory_retrieval_profile: {
        enabled:
          true,

        model_mode:
          "cue_dependent_v2",
      },
    });

  assert.deepEqual(
    explicitEntityQuery.result
      .candidate_memory_records
      .map((item) => item.memory_id),

    [
      explicitEntityMemory.memory_id,
    ],
  );

  assert.equal(
    explicitEntityQuery.result
      .candidate_evaluations
      .find(
        (item) =>
          item.memory_id
          === contentOnlyEntityMemory.memory_id,
      )
      .candidate_eligible,
    false,
  );

  const explicitEntityEval =
    explicitEntityQuery.result
      .candidate_evaluations
      .find(
        (item) =>
          item.memory_id
          === explicitEntityMemory.memory_id,
      );

  const entityMatch =
    explicitEntityEval
      .cue_matches
      .find(
        (item) =>
          item.kind
          === "entity",
      );

  assert.deepEqual(
    entityMatch.memory_sources,
    [
      "explicit_test_link_a",
      "explicit_test_link_b",
    ],
  );

  assert.deepEqual(
    entityMatch.association_strengths,
    [
      0.4,
      0.8,
    ],
  );

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        world_state: {
          simulation_time:
            now,

          characters: {
            [observer]: {},
          },
        },

        character:
          observer,

        memory_records: [
          nativeEpisodeA,
        ],

        simulation_time:
          now,

        perception: {
          observed: [],
          audible: [],
          other_senses: [],
        },

        retrieval_context: {
          active_cues: [
            {
              kind:
                "unsupported_magic_similarity",

              value:
                "x",
            },
          ],
        },

        memory_retrieval_profile: {
          enabled:
            true,

          model_mode:
            "cue_dependent_v2",
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_KIND_UNSUPPORTED",
  );

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        ...directInput,

        memory_retrieval_profile: {
          enabled:
            true,

          model_mode:
            "cue_dependent_v2",

          component_weights: {
            storage_strength:
              1,
          },
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_NATIVE_V2_LEGACY_COMPONENTS_UNSUPPORTED",
  );

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        world_state: {
          simulation_time:
            now,

          characters: {
            [observer]: {},
          },
        },

        character:
          observer,

        memory_records: [
          nativeEpisodeA,
        ],

        simulation_time:
          now,

        perception: {
          observed: [],
          audible: [],
          other_senses: [],
        },

        retrieval_context: {
          active_cues: {
            kind:
              "entity",

            value:
              "elias_noll",
          },
        },

        memory_retrieval_profile: {
          enabled:
            true,

          model_mode:
            "cue_dependent_v2",
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_LIST_INVALID",
  );

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        world_state: {
          simulation_time:
            now,

          characters: {
            [observer]: {},
          },
        },

        character:
          observer,

        memory_records: [
          nativeEpisodeA,
        ],

        simulation_time:
          now,

        perception: {
          observed: [],
          audible: [],
          other_senses: [],
        },

        retrieval_context: {
          retrieval_goal: {},
        },

        memory_retrieval_profile: {
          enabled:
            true,

          model_mode:
            "cue_dependent_v2",
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_RETRIEVAL_GOAL_INVALID",
  );

  const malformedMemoryCueLinks =
    structuredClone(
      nativeEpisodeA,
    );

  malformedMemoryCueLinks
    .retrieval_cue_links = {
      kind:
        "entity",

      value:
        "elias_noll",
    };

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        world_state: {
          simulation_time:
            now,

          characters: {
            [observer]: {},
          },
        },

        character:
          observer,

        memory_records: [
          malformedMemoryCueLinks,
        ],

        simulation_time:
          now,

        perception: {
          observed: [],
          audible: [],
          other_senses: [],
        },

        retrieval_context: {
          active_cues: [
            {
              kind:
                "entity",

              value:
                "elias_noll",
            },
          ],
        },

        memory_retrieval_profile: {
          enabled:
            true,

          model_mode:
            "cue_dependent_v2",
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_MEMORY_CUE_LINKS_INVALID",
  );

  assert.throws(
    () =>
      queryWorldSimulationMemoryAccessibility({
        ...directInput,

        memory_retrieval_profile: {
          enabled: true,

          model_mode:
            "cue_dependant_v2_typo",
        },
      }),

    (error) =>
      error?.code
      === "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_MODEL_MODE_UNSUPPORTED",
  );

  const nativeEligibilityWins = memoryRecord({
    id: "mem-native-eligibility-wins",
    label: "native retrieval_eligible true overrides legacy accessible false",
    encodedAt: "2026-08-24T19:00:00+08:00",
    accessible: false,
  });

  nativeEligibilityWins.retrieval_eligible =
    true;

  const nativeIneligibilityWins = memoryRecord({
    id: "mem-native-ineligibility-wins",
    label: "native retrieval_eligible false overrides legacy accessible true",
    encodedAt: "2026-08-24T19:00:00+08:00",
    accessible: true,
  });

  nativeIneligibilityWins.retrieval_eligible =
    false;

  const nativeEligibleButSuppressed = memoryRecord({
    id: "mem-native-eligible-but-suppressed",
    label: "suppression independently excludes retrieval candidate",
    encodedAt: "2026-08-24T19:00:00+08:00",
    accessible: true,
  });

  nativeEligibleButSuppressed.retrieval_eligible =
    true;

  nativeEligibleButSuppressed.suppressed =
    true;

  const eligibilitySemantics =
    queryWorldSimulationMemoryAccessibility({
      world_state: {
        simulation_time: now,
        characters: {
          [observer]: {},
        },
      },

      character:
        observer,

      memory_records: [
        nativeEligibilityWins,
        nativeIneligibilityWins,
        nativeEligibleButSuppressed,
      ],

      simulation_time:
        now,

      scene_id:
        sceneId,

      perception: {
        scene_id:
          sceneId,

        observed: [],
        audible: [],
        other_senses: [],
      },
    });

  assert.deepEqual(
    eligibilitySemantics.result
      .candidate_memory_records
      .map((item) => item.memory_id),

    [
      nativeEligibilityWins.memory_id,
    ],
  );

  const eligibilityById =
    new Map(
      eligibilitySemantics.result
        .candidate_evaluations
        .map((item) => [
          item.memory_id,
          item,
        ]),
    );

  assert.equal(
    eligibilityById
      .get(nativeEligibilityWins.memory_id)
      .engine_retrieval_eligibility_source,
    "retrieval_eligible",
  );

  assert.equal(
    eligibilityById
      .get(nativeEligibilityWins.memory_id)
      .candidate_eligible,
    true,
  );

  assert.equal(
    eligibilityById
      .get(nativeIneligibilityWins.memory_id)
      .candidate_eligible,
    false,
  );

  assert.deepEqual(
    eligibilityById
      .get(nativeIneligibilityWins.memory_id)
      .exclusion_reasons,

    [
      "engine_retrieval_ineligible",
    ],
  );

  assert.equal(
    eligibilityById
      .get(nativeEligibleButSuppressed.memory_id)
      .candidate_eligible,
    false,
  );

  assert.deepEqual(
    eligibilityById
      .get(nativeEligibleButSuppressed.memory_id)
      .exclusion_reasons,

    [
      "memory_suppressed",
    ],
  );

  const historyCanonicalMemory =
    memoryRecord({
      id:
        "mem-history-canonical",

      label:
        "history must outrank summary caches",

      encodedAt:
        "2026-08-20T19:30:00+08:00",

      storageStrength:
        0.7,

      recallCount:
        99,

      lastRecalledAt:
        "2026-08-24T19:00:00+08:00",
    });

  historyCanonicalMemory
    .retrieval_history = [
      {
        success:
          true,

        occurred_at:
          "2026-08-24T07:30:00+08:00",
      },

      {
        success:
          false,

        occurred_at:
          "2026-08-24T19:20:00+08:00",
      },

      {
        occurred_at:
          "2026-08-24T19:25:00+08:00",
      },

      "malformed-history-entry",
    ];

  const historyCanonicalQuery =
    queryWorldSimulationMemoryAccessibility({
      world_state: {
        simulation_time:
          now,

        characters: {
          [observer]: {},
        },
      },

      character:
        observer,

      memory_records: [
        historyCanonicalMemory,
      ],

      simulation_time:
        now,

      scene_id:
        sceneId,

      perception: {
        scene_id:
          sceneId,

        observed: [],
        audible: [],
        other_senses: [],
      },

      memory_retrieval_profile: {
        enabled:
          true,

        model_mode:
          "legacy_v1_weighted_compatibility",

        component_weights: {
          recall_frequency:
            0.5,

          recall_recency:
            0.5,
        },

        recall_frequency: {
          saturation_count:
            4,
        },

        recall_recency: {
          mode:
            "hyperbolic",

          scale_hours:
            12,
        },
      },
    });

  const historyCanonicalEval =
    historyCanonicalQuery
      .result
      .candidate_evaluations[0];

  assert.equal(
    historyCanonicalEval
      .recall_history_source,
    "retrieval_history",
  );

  assert.equal(
    historyCanonicalEval
      .retrieval_history_entry_count,
    4,
  );

  assert.equal(
    historyCanonicalEval
      .explicit_successful_retrieval_history_count,
    1,
  );

  assert.equal(
    historyCanonicalEval
      .recall_count,
    1,
  );

  assert.equal(
    historyCanonicalEval
      .legacy_recall_count_summary,
    99,
  );

  assert.equal(
    historyCanonicalEval
      .recall_age_hours,
    12,
  );

  assert.equal(
    historyCanonicalEval
      .components
      .recall_frequency
      .value,
    0.25,
  );

  assert.equal(
    historyCanonicalEval
      .components
      .recall_recency
      .value,
    0.5,
  );

  assert.equal(
    recalledEval
      .recall_history_source,
    "legacy_summary_fallback",
  );

  assert.equal(
    recalledEval
      .recall_count,
    4,
  );

  const curveMemory = memoryRecord({
    id: "mem-curve-comparison",
    label: "用於比較明確指定時間函數",
    encodedAt: "2026-08-22T19:30:00+08:00",
    storageStrength: 0.5,
  });
  const curveBase = {
    world_state: { simulation_time: now, characters: { [observer]: {} } },
    character: observer,
    memory_records: [curveMemory],
    simulation_time: now,
    scene_id: sceneId,
    perception: { scene_id: sceneId, observed: [], audible: [], other_senses: [] },
  };
  const curveScore = (mode, extra = {}) => queryWorldSimulationMemoryAccessibility({
    ...curveBase,
    memory_retrieval_profile: {
      enabled: true,
      component_weights: { age_accessibility: 1 },
      age_accessibility: { mode, scale_hours: 24, ...extra },
    },
  }).result.evaluations[0].retrieval_strength;
  const hyperbolicScore = curveScore("hyperbolic");
  const exponentialScore = curveScore("exponential");
  const powerScore = curveScore("power", { exponent: 1.5 });
  assert.notEqual(hyperbolicScore, exponentialScore);
  assert.notEqual(powerScore, exponentialScore);

  const projectionCandidateRecords =
    Array.from(
      { length: 4 },
      (_, index) =>
        memoryRecord({
          id:
            `mem-projection-candidate-${index + 1}`,

          label:
            `projection candidate ${index + 1}`,

          encodedAt:
            "2026-08-24T18:30:00+08:00",

          storageStrength:
            0.9,
        }),
    );

  const projectionSeparation =
    queryWorldSimulationMemoryAccessibility({
      ...curveBase,

      memory_records:
        projectionCandidateRecords,

      memory_retrieval_profile: {
        enabled: true,

        max_items:
          2,

        component_weights: {
          storage_strength:
            1,
        },
      },
    });

  assert.equal(
    projectionSeparation.result
      .candidate_memory_count,
    4,
  );

  assert.deepEqual(
    projectionSeparation.result
      .candidate_memory_records
      .map((item) => item.memory_id),

    projectionCandidateRecords
      .map((item) => item.memory_id),
  );

  assert.equal(
    projectionSeparation.result
      .retrievable_memory_count,
    2,
  );

  assert.deepEqual(
    projectionSeparation.result
      .retrievable_memory_records
      .map((item) => item.memory_id),

    projectionCandidateRecords
      .slice(0, 2)
      .map((item) => item.memory_id),
  );

  assert.equal(
    projectionSeparation.result
      .legacy_projection_max_items,
    2,
  );

  const competitorA = memoryRecord({
    id: "mem-competitor-a",
    label: "相似事件 A",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["same-uniform-corridor-event"],
  });
  const competitorB = memoryRecord({
    id: "mem-competitor-b",
    label: "相似事件 B",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["same-uniform-corridor-event"],
  });
  const unique = memoryRecord({
    id: "mem-unique",
    label: "不同事件",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["unique-event"],
  });
  const interference = queryWorldSimulationMemoryAccessibility({
    ...curveBase,
    memory_records: [competitorA, competitorB, unique],
    memory_retrieval_profile: {
      enabled: true,
      component_weights: { storage_strength: 1 },
      interference: { enabled: true, per_competitor_penalty: 0.25, max_penalty: 0.5 },
    },
  });
  const interferenceById = new Map(interference.result.evaluations.map((item) => [item.memory_id, item]));
  assert.equal(interferenceById.get(competitorA.memory_id).interference_competitor_count, 1);
  assert.equal(interferenceById.get(competitorA.memory_id).interference_penalty, 0.25);
  assert.ok(interferenceById.get(competitorA.memory_id).retrieval_strength < interferenceById.get(unique.memory_id).retrieval_strength);

  const loopWorldState =
    structuredClone(
      worldState,
    );

  // Deliberately force the deprecated Phase63B-v1 projection
  // output down to one record while asking the separate engine
  // projection layer for two records.
  //
  // Step 3 must therefore use candidate_memory_records rather
  // than retrievable_memory_records.
  loopWorldState
    .characters[observer]
    .memory_retrieval_profile
    .max_items = 1;

  loopWorldState
    .event_queue[0]
    .memory_projection_policy = {
      max_items:
        2,
    };

  loopWorldState
    .event_queue[0]
    .memory_retrieval_context = {
      active_cues: [
        {
          kind:
            "spatial_context",

          value:
            sceneId,

          source:
            "phase63b-engine-only-context-sentinel",
        },
      ],
    };

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase63B memory accessibility fixture",
    seed: "phase63b",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: loopWorldState,
  }, options);

  const nativeHistoryHeavy =
    memoryRecord({
      id:
        "mem-native-history-heavy",

      label:
        "native history-heavy candidate",

      encodedAt:
        "2026-08-24T18:00:00+08:00",

      storageStrength:
        1,

      recallCount:
        999,

      lastRecalledAt:
        "2026-08-24T19:29:59+08:00",
    });

  nativeHistoryHeavy
    .retrieval_cues = {
      scene_id:
        sceneId,

      memory_type:
        "episodic_direct_perception",
    };

  nativeHistoryHeavy
    .retrieval_history = [
      {
        success:
          true,

        occurred_at:
          "2026-08-24T19:29:59+08:00",
      },
    ];

  const nativeHistoryPlain =
    memoryRecord({
      id:
        "mem-native-history-plain",

      label:
        "native history-free candidate",

      encodedAt:
        "2026-08-24T18:00:00+08:00",

      storageStrength:
        0.1,
    });

  nativeHistoryPlain
    .retrieval_cues = {
      scene_id:
        sceneId,

      memory_type:
        "episodic_direct_perception",
    };

  const nativeHistoryInput = {
    world_state: {
      simulation_time:
        now,

      characters: {
        [observer]: {},
      },
    },

    character:
      observer,

    memory_records: [
      nativeHistoryHeavy,
      nativeHistoryPlain,
    ],

    simulation_time:
      now,

    scene_id:
      sceneId,

    perception: {
      scene_id:
        sceneId,

      observed: [],
      audible: [],
      other_senses: [],
    },

    memory_retrieval_profile: {
      enabled:
        true,

      model_mode:
        "cue_dependent_v2",
    },
  };

  const nativeHistoryHashBefore =
    hashAgentRunValue(
      nativeHistoryInput,
    );

  const nativeHistoryQuery =
    queryWorldSimulationMemoryAccessibility(
      nativeHistoryInput,
    );

  assert.equal(
    hashAgentRunValue(
      nativeHistoryInput,
    ),
    nativeHistoryHashBefore,
  );

  assert.deepEqual(
    nativeHistoryQuery
      .result
      .candidate_memory_records
      .map((item) => item.memory_id),

    [
      nativeHistoryHeavy.memory_id,
      nativeHistoryPlain.memory_id,
    ],
  );

  const nativeHistoryEvals =
    nativeHistoryQuery
      .result
      .candidate_evaluations;

  assert.equal(
    nativeHistoryEvals.every(
      (item) =>
        item
          .retrieval_history_effects_modeled
        === false,
    ),
    true,
  );

  assert.equal(
    nativeHistoryEvals.every(
      (item) =>
        item
          .retrieval_history_effect_owner
        === "Phase63C",
    ),
    true,
  );

  assert.equal(
    nativeHistoryEvals.every(
      (item) =>
        item
          .legacy_recall_summary_used_in_native_v2
        === false,
    ),
    true,
  );

  assert.equal(
    nativeHistoryEvals.every(
      (item) =>
        item
          .same_cycle_retrieval_history_effect_used
        === false,
    ),
    true,
  );

  assert.equal(
    nativeHistoryEvals.every(
      (item) =>
        item
          .accessibility_score
        === null,
    ),
    true,
  );

  const projectionProbe =
    await run_world_memory_retriever(
      {
        character:
          observer,

        memory_records: [],

        projection_max_items:
          1,

        projection_policy_origin:
          "phase63b-step3-test",

        programmatic_memory_accessibility: {
          candidate_set_authoritative:
            true,

          accessibility_enforced:
            true,

          enforced:
            true,

          version:
            worldSimulationMemoryAccessibilityVersion,

          candidate_memory_records: [
            nativeEligibilityWins,
          ],
        },
      },
      {
        ...options,

        run_id:
          session
            .world_simulation_session_id,

        source:
          "phase63b-step3-projection-probe",
      },
    );

  assert.deepEqual(
    projectionProbe
      .output
      .projected_memories
      .map((item) => item.memory_id),

    [
      nativeEligibilityWins.memory_id,
    ],
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .authoritative_candidate_set_revalidated_by_legacy_accessible_flag,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .actual_retrieval_success_asserted,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .projection_appends_retrieval_history,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .projection_updates_recall_count,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .projection_updates_last_recalled_at,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .projection_creates_retrieval_event,
    false,
  );

  assert.equal(
    projectionProbe
      .output
      .memory_boundary
      .retrieval_event_owner,
    "Phase63C",
  );

  // Legacy compatibility:
  //
  // enforced:true by itself means "use this programmatic
  // accessibility source", but it does NOT prove that the
  // supplied records are the canonical Phase63B candidate set.
  //
  // Therefore the legacy accessible/suppressed filter still
  // applies unless candidate_set_authoritative:true is explicit.
  const legacyEnforcedProbe =
    await run_world_memory_retriever(
      {
        character:
          observer,

        memory_records: [],

        projection_max_items:
          1,

        programmatic_memory_accessibility: {
          enforced:
            true,

          version:
            worldSimulationMemoryAccessibilityVersion,

          memory_records: [
            nativeEligibilityWins,
          ],
        },
      },
      {
        ...options,

        run_id:
          session
            .world_simulation_session_id,

        source:
          "phase63b-step3-legacy-enforced-probe",
      },
    );

  assert.deepEqual(
    legacyEnforcedProbe
      .output
      .projected_memories,
    [],
  );

  assert.equal(
    legacyEnforcedProbe
      .output
      .memory_boundary
      .authoritative_candidate_set_consumed,
    false,
  );

  assert.equal(
    legacyEnforcedProbe
      .output
      .memory_boundary
      .legacy_enforced_programmatic_records_revalidated_by_legacy_accessibility,
    true,
  );

  let invalidProjectionLimitRejected =
    false;

  try {
    await run_world_memory_retriever(
      {
        character:
          observer,

        memory_records: [],

        projection_max_items:
          33,

        programmatic_memory_accessibility: {
          candidate_set_authoritative:
            true,

          accessibility_enforced:
            true,

          version:
            worldSimulationMemoryAccessibilityVersion,

          candidate_memory_records: [
            nativeEligibilityWins,
          ],
        },
      },
      {
        ...options,

        run_id:
          session
            .world_simulation_session_id,

        source:
          "phase63b-step3-invalid-projection-limit-probe",
      },
    );
  } catch (error) {
    invalidProjectionLimitRejected =
      String(
        error?.message
        ?? "",
      ).includes(
        "projection_max_items must be an integer from 0 through 32",
      );
  }

  assert.equal(
    invalidProjectionLimitRejected,
    true,
  );

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventId,
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        assert.equal(
          Object.hasOwn(
            packet.event ?? {},
            "memory_retrieval_context",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            packet.event ?? {},
            "memory_projection_policy",
          ),
          false,
        );

        assert.equal(
          JSON.stringify(
            packet,
          ).includes(
            "phase63b-engine-only-context-sentinel",
          ),
          false,
        );

        assert.equal(
          packet.boundaries
            .programmatic_memory_accessibility_enforced,
          true,
        );

        assert.equal(
          packet.boundaries
            .memory_accessibility_candidate_set_authoritative,
          true,
        );

        assert.equal(
          packet.boundaries
            .memory_context_is_projection_not_successful_retrieval,
          true,
        );

        assert.equal(
          packet.boundaries
            .memory_projection_budget_is_cognitive_capacity,
          false,
        );

        assert.equal(
          packet.boundaries
            .memory_projection_max_items,
          2,
        );

        assert.equal(
          packet.boundaries
            .memory_retrieval_strength_scores_exposed,
          false,
        );

        assert.equal(
          Object.hasOwn(
            packet,
            "projected_memories",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(packet, "recovered_memories"),
          false,
          "v3 final Character Brain ingress must not expose raw recovered_memories",
        );

        assert.equal(
          Object.hasOwn(packet, "retrieved_memories"),
          false,
          "v3 final Character Brain ingress must not expose the legacy retrieved_memories alias",
        );

        const unretrievedCurrentMindItems = [
          packet.cognition?.working_context?.focus,
          ...(packet.cognition?.working_context?.active_context ?? []),
          ...(packet.cognition?.working_context?.peripheral_context ?? []),
          ...(packet.cognition?.working_context?.fading_context ?? []),
          ...(packet.cognition?.working_context?.suspended_context ?? []),
        ].filter(Boolean);
        assert.equal(
          unretrievedCurrentMindItems.some(
            (item) => item.context_origin === "recovered_memory",
          ),
          false,
          "Phase63B accessibility candidates must not become recollection without Phase63C recovery",
        );

        assert.equal(
          packet.boundaries
            .candidate_content_barrier_enforced,
          true,
        );

        assert.equal(
          packet.boundaries
            .unretrieved_candidate_content_exposed_to_character_brain,
          false,
        );

        // Technical accessibility diagnostics are forbidden
        // from character-visible memory content. Do not scan the
        // whole packet for these field-name substrings because the
        // packet boundary metadata legitimately contains names such
        // as memory_retrieval_strength_scores_exposed:false.
        const serializedCharacterMemory =
          JSON.stringify(
            packet.cognition?.working_context ?? {},
          );

        assert.equal(
          serializedCharacterMemory.includes(
            "retrieval_strength",
          ),
          false,
        );

        assert.equal(
          serializedCharacterMemory.includes(
            "interference_penalty",
          ),
          false,
        );

        // Actual unretrieved subjective content must not occur
        // anywhere in the Character Brain packet.
        const serializedBrainPacket =
          JSON.stringify(
            packet,
          );

        assert.equal(
          serializedBrainPacket.includes(
            recentSameContext
              .content
              .perceptual_label,
          ),
          false,
        );

        assert.equal(
          serializedBrainPacket.includes(
            recalledSameContext
              .content
              .perceptual_label,
          ),
          false,
        );

        assert.equal(
          serializedBrainPacket.includes(
            oldStrongDifferentContext
              .content
              .perceptual_label,
          ),
          false,
        );
        return { action_id: "remain-still" };
      },
      causalAdjudicator: noOpAdjudicator,
    },
  );
  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);

  const after = await getWorldSimulationState(session.world_simulation_session_id, options);
  const originalMemoryIds = worldState.memories[observer].map((item) => item.memory_id);
  const afterOriginalMemories = after.state.memories[observer].slice(0, originalMemoryIds.length);
  assert.deepEqual(afterOriginalMemories.map((item) => item.memory_id), originalMemoryIds);
  assert.deepEqual(
    afterOriginalMemories.map((item) => item.storage_strength),
    worldState.memories[observer].map((item) => item.storage_strength),
  );
  assert.deepEqual(
    afterOriginalMemories.map((item) => item.clarity),
    worldState.memories[observer].map((item) => item.clarity),
  );

  for (
    const original
    of loopWorldState
      .memories[observer]
  ) {
    const persisted =
      after.state
        .memories[observer]
        .find(
          (item) =>
            item.memory_id
            === original.memory_id,
        );

    assert.ok(
      persisted,
      `missing persisted memory ${original.memory_id}`,
    );

    assert.deepEqual(
      persisted.retrieval_history
      ?? null,

      original.retrieval_history
      ?? null,
    );

    assert.equal(
      persisted.recall_count
      ?? null,

      original.recall_count
      ?? null,
    );

    assert.equal(
      persisted.last_recalled_at
      ?? null,

      original.last_recalled_at
      ?? null,
    );
  }

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].memory_accessibility_queries.length, 1);
  assert.equal(history.turns[0].memory_accessibility_queries[0].version, worldSimulationMemoryAccessibilityVersion);
  assert.equal(
    history.turns[0]
      .memory_accessibility_queries[0]
      .audit
      .deterministic_replay_verified,
    true,
  );

  assert.equal(
    history.turns[0]
      .memory_accessibility_queries[0]
      .result
      .accessibility_boundary
      .time_passage_does_not_rewrite_persistent_memory_records,
    true,
  );

  const loopAccessibilityResult =
    history.turns[0]
      .memory_accessibility_queries[0]
      .result;

  assert.equal(
    loopAccessibilityResult
      .candidate_memory_count,
    2,
  );

  assert.equal(
    loopAccessibilityResult
      .retrievable_memory_count,
    1,
  );

  // Phase63B still produces the authoritative candidate set,
  // but Phase63C Step2 prevents those unretrieved candidates
  // from becoming Character Brain memory content.
  assert.equal(
    Object.hasOwn(
      brainInputs[0],
      "projected_memories",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      brainInputs[0],
      "recovered_memories",
    ),
    false,
  );

  assert.equal(
    Object.hasOwn(
      brainInputs[0],
      "retrieved_memories",
    ),
    false,
  );

  const loopCurrentMindItems = [
    brainInputs[0].cognition?.working_context?.focus,
    ...(brainInputs[0].cognition?.working_context?.active_context ?? []),
    ...(brainInputs[0].cognition?.working_context?.peripheral_context ?? []),
    ...(brainInputs[0].cognition?.working_context?.fading_context ?? []),
    ...(brainInputs[0].cognition?.working_context?.suspended_context ?? []),
  ].filter(Boolean);
  assert.equal(
    loopCurrentMindItems.some(
      (item) => item.context_origin === "recovered_memory",
    ),
    false,
  );

  assert.equal(
    brainInputs[0]
      .boundaries
      .candidate_content_barrier_enforced,
    true,
  );

  assert.equal(
    brainInputs[0]
      .boundaries
      .unretrieved_candidate_content_exposed_to_character_brain,
    false,
  );

  assert.equal(
    loopAccessibilityResult
      .candidate_memory_records
      .length,

    loopAccessibilityResult
      .candidate_memory_count,
  );

  assert.equal(
    loopAccessibilityResult
      .candidate_memory_count,
    2,
  );

  assert.equal(
    loopAccessibilityResult
      .retrievable_memory_count,
    1,
  );

  console.log(JSON.stringify({
    memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,
    persisted_history_turns: history.turns.length,
    accessibility_enforced: direct.result.accessibility_enforced,

    model_mode:
      direct.result.model_mode,

    candidate_terminology_supported:
      contract
        .candidate_terminology_supported,

    current_accessibility_is_not_successful_retrieval:
      contract
        .current_accessibility_is_not_successful_retrieval,

    candidate_memory_records_available:
      direct.result
        .candidate_memory_records
        .length === 2,

    legacy_retrievable_projection_preserved_for_existing_fixture:
      JSON.stringify(
        direct.result
          .retrievable_memory_records
          .map((item) => item.memory_id),
      )
      === JSON.stringify(
        direct.result
          .candidate_memory_records
          .map((item) => item.memory_id),
      ),

    candidate_set_separated_from_projection_budget:
      projectionSeparation.result
        .candidate_memory_count === 4
      && projectionSeparation.result
        .retrievable_memory_count === 2,

    native_retrieval_eligibility_precedence_verified:
      eligibilityById
        .get(nativeEligibilityWins.memory_id)
        .candidate_eligible === true
      && eligibilityById
        .get(nativeIneligibilityWins.memory_id)
        .candidate_eligible === false,

    suppression_independently_excludes_candidate:
      eligibilityById
        .get(nativeEligibleButSuppressed.memory_id)
        .candidate_eligible === false,

    unknown_explicit_model_mode_rejected:
      contract
        .unknown_explicit_model_mode_rejected,

    native_v2_cue_algorithm_modeled:
      contract
        .native_v2_cue_algorithm_modeled,

    native_v2_cue_schema_reserved:
      contract
        .native_v2_cue_schema_reserved,

    native_v2_candidate_set_verified:
      JSON.stringify(
        nativeCueQuery.result
          .candidate_memory_records
          .map((item) => item.memory_id),
      )
      === JSON.stringify([
        nativeEpisodeA.memory_id,
        nativeSharedScene.memory_id,
      ]),

    native_v2_scalar_score_invented:
      nativeEpisodeAEval
        .accessibility_score
      !== null,

    subjective_episode_cue_supported:
      nativeEpisodeAEval
        .cue_matches
        .some(
          (item) =>
            item.kind
            === "subjective_episode",
        ),

    query_relative_cue_competition_verified:
      spatialCompetition
        .candidate_fan_out === 2
      && episodeCompetition
        .candidate_fan_out === 1,

    fixed_native_competitor_penalty_applied:
      nativeEpisodeAEval
        .cue_competition
        .some(
          (item) =>
            item
              .numeric_penalty_applied
            === true,
        ),

    free_text_semantic_similarity_used:
      explicitEntityQuery.result
        .candidate_memory_records
        .some(
          (item) =>
            item.memory_id
            === contentOnlyEntityMemory.memory_id,
        ),

    native_storage_strength_direct_bonus_used:
      nativeEpisodeAEval
        .storage_strength_used_as_native_accessibility_bonus,

    native_legacy_component_mixing_rejected:
      contract
        .native_legacy_component_mixing_rejected,

    duplicate_active_cue_sources_preserved:
      JSON.stringify(
        mergedSpatialCue.sources,
      )
      === JSON.stringify([
        "current_environment",
        "explicit_duplicate_spatial_source",
      ]),

    independent_memory_cue_associations_preserved:
      JSON.stringify(
        entityMatch.memory_sources,
      )
      === JSON.stringify([
        "explicit_test_link_a",
        "explicit_test_link_b",
      ])
      && JSON.stringify(
        entityMatch.association_strengths,
      )
      === JSON.stringify([
        0.4,
        0.8,
      ]),

    malformed_explicit_cue_structures_rejected:
      contract
        .malformed_explicit_cue_structures_rejected,

    loop_uses_canonical_candidate_set:
      loopAccessibilityResult
        .candidate_memory_count === 2
      && loopAccessibilityResult
        .candidate_memory_records
        .length === 2
      && loopAccessibilityResult
        .retrievable_memory_count === 1
      && Object.hasOwn(
        brainInputs[0],
        "projected_memories",
      ) === false
      && Object.hasOwn(
        brainInputs[0],
        "recovered_memories",
      ) === false
      && Object.hasOwn(
        brainInputs[0],
        "retrieved_memories",
      ) === false
      && loopCurrentMindItems.every(
        (item) => item.context_origin !== "recovered_memory",
      )
      && brainInputs[0]
        .boundaries
        .candidate_content_barrier_enforced === true
      && brainInputs[0]
        .boundaries
        .unretrieved_candidate_content_exposed_to_character_brain === false,

    projection_budget_separated_from_accessibility:
      brainInputs[0]
        .boundaries
        .memory_projection_max_items === 2
      && loopAccessibilityResult
        .legacy_projection_max_items === 1,

    authoritative_candidate_set_not_legacy_refiltered:
      projectionProbe
        .output
        .projected_memories
        .some(
          (item) =>
            item.memory_id
            === nativeEligibilityWins.memory_id,
        ),

    projected_memory_context_asserts_successful_retrieval:
      projectionProbe
        .output
        .memory_boundary
        .actual_retrieval_success_asserted,

    projection_budget_claimed_as_cognitive_capacity:
      brainInputs[0]
        .boundaries
        .memory_projection_budget_is_cognitive_capacity,

    candidate_authority_requires_explicit_flag:
      projectionProbe
        .output
        .memory_boundary
        .candidate_authority_requires_explicit_flag
      && !legacyEnforcedProbe
        .output
        .memory_boundary
        .authoritative_candidate_set_consumed,

    legacy_enforced_records_still_refiltered:
      legacyEnforcedProbe
        .output
        .projected_memories
        .length === 0
      && legacyEnforcedProbe
        .output
        .memory_boundary
        .legacy_enforced_programmatic_records_revalidated_by_legacy_accessibility,

    invalid_projection_limit_rejected:
      invalidProjectionLimitRejected,

    legacy_retrieval_history_precedes_recall_count_summary:
      historyCanonicalEval
        .recall_count === 1
      && historyCanonicalEval
        .legacy_recall_count_summary === 99,

    legacy_retrieval_history_precedes_last_recalled_at_summary:
      historyCanonicalEval
        .recall_age_hours === 12,

    failed_or_ambiguous_history_counted_as_successful_recall:
      historyCanonicalEval
        .explicit_successful_retrieval_history_count
      !== 1,

    native_v2_retrieval_history_effects_modeled:
      nativeHistoryEvals
        .some(
          (item) =>
            item
              .retrieval_history_effects_modeled
            === true,
        ),

    native_v2_legacy_recall_summary_used:
      nativeHistoryEvals
        .some(
          (item) =>
            item
              .legacy_recall_summary_used_in_native_v2
            === true,
        ),

    projection_appends_retrieval_history:
      projectionProbe
        .output
        .memory_boundary
        .projection_appends_retrieval_history,

    projection_updates_recall_summaries:
      projectionProbe
        .output
        .memory_boundary
        .projection_updates_recall_count
      || projectionProbe
        .output
        .memory_boundary
        .projection_updates_last_recalled_at,

    same_cycle_retrieval_history_feedback_allowed:
      contract
        .same_cycle_retrieval_history_feedback_allowed,

    retrieval_event_schema_installed:
      contract
        .retrieval_event_schema_installed,

    retrieval_event_owner:
      contract
        .retrieval_event_schema_owner,

    engine_retrieval_context_exposed_to_character_brain:
      brainInputs.some(
        (packet) =>
          Object.hasOwn(
            packet.event ?? {},
            "memory_retrieval_context",
          ),
      ),

    engine_projection_policy_exposed_to_character_brain:
      brainInputs.some(
        (packet) =>
          Object.hasOwn(
            packet.event ?? {},
            "memory_projection_policy",
          ),
      ),

    recent_same_context_retrieved:
      recentEval.retrievable,
    old_high_storage_low_retrieval_filtered: oldEval.storage_strength === 0.95 && oldEval.retrievable === false,
    recalled_memory_accessibility_boosted: recalledEval.retrieval_strength > oldEval.retrieval_strength,
    context_match_affects_retrieval: recentEval.context_match > oldEval.context_match,
    explicit_interference_lowers_competing_memory: interferenceById.get(competitorA.memory_id).retrieval_strength < interferenceById.get(unique.memory_id).retrieval_strength,
    no_profile_preserves_legacy_accessibility: noProfile.result.accessibility_enforced === false,
    multiple_explicit_time_functions_supported: new Set([hyperbolicScore, exponentialScore, powerScore]).size === 3,
    persistent_memory_records_rewritten_by_time: false,
    confidence_or_clarity_rewritten_by_retrieval: false,
    retrieval_strength_scores_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_memory_accessibility: false,
    recall_reinforcement_modeled: false,
    source_confusion_or_distortion_modeled: false,
  }));
  console.log("Phase63B subjective memory accessibility/retrieval test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
