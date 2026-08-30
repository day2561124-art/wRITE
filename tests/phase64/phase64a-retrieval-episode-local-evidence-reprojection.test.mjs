import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  baseLevelActivationProjectionModelProfileHash,
  worldSimulationBaseLevelActivationProjectionVersion,
} from "../../server/src/world-simulation-base-level-activation-projection-service.mjs";
import {
  queryWorldSimulationMemoryAccessibility,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import {
  projectWorldSimulationCueDiagnosticEvidence,
} from "../../server/src/world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  buildWorldSimulationRetrievalCueOrientationOptions,
  buildWorldSimulationRetrievalCueOrientationResolverOptions,
  materializeWorldSimulationRetrievalCueOrientationEvidence,
} from "../../server/src/world-simulation-retrieval-cue-orientation-evidence-service.mjs";
import {
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence,
} from "../../server/src/world-simulation-retrieval-cue-conditioned-episode-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalEpisodeLocalEvidenceReprojectionContract,
  buildWorldSimulationRetrievalEpisodeLocalInitialContext,
  projectWorldSimulationRetrievalEpisodeLocalEvidenceReprojection,
  validateWorldSimulationRetrievalEpisodeLocalEvidenceReprojection,
  assertWorldSimulationRetrievalEpisodeLocalReprojectionsAgainstR4E1,
} from "../../server/src/world-simulation-retrieval-episode-local-evidence-reprojection-service.mjs";

function memory(
  id,
  cue,
) {
  return {
    memory_id:
      id,
    memory_type:
      "episodic_direct_perception",
    content: {
      label:
        id,
    },
    source: {
      kind:
        "direct_perception",
      sense:
        "visual",
    },
    retrieval_cue_links: [
      {
        kind:
          "semantic",
        value:
          cue,
        source:
          "fixture",
      },
    ],
    retrieval_eligible:
      true,
    suppressed:
      false,
  };
}

function accessibility(
  memories,
  activeCues,
) {
  return queryWorldSimulationMemoryAccessibility({
    character:
      "phase64a-r4e3-observer",
    memory_records:
      memories,
    memory_retrieval_profile: {
      enabled:
        true,
      model_mode:
        "cue_dependent_v2",
    },
    simulation_time:
      "2026-08-30T17:00:00+08:00",
    scene_id:
      null,
    perception: {},
    context_cues: {},
    retrieval_context: {
      active_cues:
        activeCues,
    },
  });
}

function publicFrontier(
  id,
  query,
  r4a,
) {
  const activeCues =
    query.result.active_retrieval_cues;

  return {
    frontier_id:
      id,
    active_cues:
      activeCues,
    active_cue_hash:
      hashAgentRunValue(
        activeCues,
      ),
    candidate_set_hash:
      hashAgentRunValue(
        query
          .result
          .candidate_memory_records,
      ),
    candidate_count:
      query
        .result
        .candidate_memory_records
        .length,
    candidate_refs:
      query
        .result
        .candidate_memory_records
        .map(
          (record) => ({
            memory_id:
              record.memory_id,
          }),
        ),
    cue_diagnostic_projection: {
      version:
        r4a.version,
      projection_id:
        r4a.projection_id,
      evidence_hash:
        r4a.evidence_hash,
      applicable:
        r4a.applicable,
    },
  };
}

function r3ProjectionIdBody(
  projection,
) {
  return {
    version:
      worldSimulationBaseLevelActivationProjectionVersion,
    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,
    source_r2_projection_id:
      projection.source_retrieval_practice_projection_id
      ?? null,
    character:
      projection.character
      ?? null,
    current_turn_id:
      projection.current_turn_id
      ?? null,
    as_of:
      projection.as_of,
    input_memory_ids:
      projection.input_memory_ids,
    r2_projected_memory_ids:
      projection.r2_projected_memory_ids,
    projected_memory_ids:
      projection.projected_memory_ids,
    evidence:
      projection
        .base_level_activation_evidence
        .map(
          (entry) => ({
            memory_id:
              entry.memory_id,
            encoded_at:
              entry.encoded_at,
            encoding_age_seconds:
              entry.encoding_age_seconds,
            encoding_activation_contribution:
              entry.encoding_activation_contribution,
            retrieval_practice_activation_mass:
              entry.retrieval_practice_activation_mass,
            base_level_activation_mass:
              entry.base_level_activation_mass,
            base_level_activation_score:
              entry.base_level_activation_score,
            complete_base_level_evidence:
              entry.complete_base_level_evidence,
            legacy_r2_slot_pinned:
              entry.legacy_r2_slot_pinned,
          }),
        ),
  };
}

function buildR3(
  memoryIds,
) {
  const evidence =
    memoryIds.map(
      (
        memoryId,
        index,
      ) => ({
        memory_id:
          memoryId,
        original_index:
          index,
        r2_projected_index:
          index,
        projected_index:
          index,
        projected_rank:
          index + 1,
        encoded_at:
          "2026-08-30T16:00:00+08:00",
        encoding_time_status:
          "authoritative_encoded_at",
        encoding_age_seconds:
          3600 + index,
        encoding_activation_contribution:
          0.25,
        retrieval_practice_activation_mass:
          0,
        base_level_activation_mass:
          Math.exp(1 + index),
        base_level_activation_score:
          1 + index,
        base_level_constant:
          0,
        complete_base_level_evidence:
          true,
        legacy_r2_slot_pinned:
          false,
        scalar_activation_is_literal_human_probability:
          false,
      }),
    );

  const projection = {
    version:
      worldSimulationBaseLevelActivationProjectionVersion,
    projection_id:
      null,
    character:
      "phase64a-r4e3-observer",
    current_turn_id:
      "phase64a-r4e3-turn",
    as_of:
      "2026-08-30T17:00:00+08:00",
    model_profile_schema_version:
      "phase64a-base-level-activation-model-profile-v1",
    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,
    source_retrieval_practice_activation_version:
      "fixture-r2",
    source_retrieval_practice_model_profile_hash:
      "fixture-r2-profile",
    source_retrieval_practice_projection_id:
      "fixture-r2-projection",
    input_memory_ids:
      memoryIds,
    r2_projected_memory_ids:
      memoryIds,
    projected_memory_ids:
      memoryIds,
    projected_memory_records:
      memoryIds.map(
        (memoryId) => ({
          memory_id:
            memoryId,
        }),
      ),
    base_level_activation_evidence:
      evidence,
    audit: {
      source_r2_projection_verified:
        true,
    },
  };

  projection.projection_id =
    `base_level_activation_projection_${hashAgentRunValue(
      r3ProjectionIdBody(
        projection,
      ),
    ).slice(0, 24)}`;

  return projection;
}

const contract =
  buildWorldSimulationRetrievalEpisodeLocalEvidenceReprojectionContract();

assert.equal(
  contract.phase,
  "Phase64A-R4E3",
);
assert.equal(
  contract.process_wide_r4b1_baseline_reused,
  true,
);
assert.equal(
  contract.r4b1_recomputed_per_episode,
  false,
);
assert.equal(
  contract.r4b2_reinstatement_channel_included,
  true,
);
assert.equal(
  contract.r4d_consulted_during_reprojection,
  false,
);
assert.equal(
  contract.r4d_remains_post_hoc,
  true,
);
assert.equal(
  contract.cue_selection_authority,
  false,
);
assert.equal(
  contract.continuation_decision_authority,
  false,
);
assert.equal(
  contract.stop_decision_authority,
  false,
);
assert.equal(
  contract.persistent_memory_mutation_authority,
  false,
);

const memories = [
  memory(
    "memory-seed",
    "seed",
  ),
  memory(
    "memory-bridge",
    "bridge",
  ),
  memory(
    "memory-both",
    "seed",
  ),
];

memories[2].retrieval_cue_links.push({
  kind:
    "semantic",
  value:
    "bridge",
  source:
    "fixture",
});

const initialActive = [
  {
    kind:
      "semantic",
    value:
      "seed",
    source:
      "explicit_retrieval_context",
  },
];

const episodeActive = [
  ...initialActive,
  {
    kind:
      "semantic",
    value:
      "bridge",
    source:
      "phase64a_r4e2_controlled_cue_construction",
  },
];

const initialQuery =
  accessibility(
    memories,
    initialActive,
  );

const initialR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      initialQuery,
  });

const episodeQuery =
  accessibility(
    memories,
    episodeActive,
  );

const episodeR4A =
  projectWorldSimulationCueDiagnosticEvidence({
    memory_accessibility_query:
      episodeQuery,
  });

const initialFrontier =
  publicFrontier(
    "phase64a-r4e3-initial-frontier",
    initialQuery,
    initialR4A,
  );

const episodeFrontier =
  publicFrontier(
    "phase64a-r4e3-episode-frontier",
    episodeQuery,
    episodeR4A,
  );

assert.notEqual(
  initialFrontier.active_cue_hash,
  episodeFrontier.active_cue_hash,
);

const optionSet =
  buildWorldSimulationRetrievalCueOrientationOptions({
    query_id:
      "phase64a-r4e3-query",
    source_frontier_id:
      initialFrontier.frontier_id,
    active_cues:
      initialFrontier.active_cues,
  });

const resolverOptions =
  buildWorldSimulationRetrievalCueOrientationResolverOptions(
    optionSet,
  );

const seedOption =
  resolverOptions.find(
    (option) =>
      option
        .character_surface
        ?.representation
      === "seed",
  );

assert.ok(
  seedOption,
);

const r4b1 =
  materializeWorldSimulationRetrievalCueOrientationEvidence({
    query_id:
      "phase64a-r4e3-query",
    source_frontier_id:
      initialFrontier.frontier_id,
    initiation: {
      mode:
        "deliberate",
      trigger_origin:
        "self_generated",
    },
    option_set:
      optionSet,
    resolution: {
      trigger: {
        grounding_status:
          "grounded",
        selected_cue_option_refs: [
          seedOption.cue_option_id,
        ],
      },
      orientation: {
        status:
          "no_explicit_orientation",
        selected_cue_option_refs: [],
      },
    },
  });

const r3 =
  buildR3(
    memories.map(
      (record) =>
        record.memory_id,
    ),
  );

const initialEpisode =
  buildWorldSimulationRetrievalEpisodeLocalInitialContext({
    query_id:
      "phase64a-r4e3-query",
    source_initial_frontier:
      initialFrontier,
  });

const bridgeRef =
  "phase64a-r4e3-bridge-option";

const reprojection =
  projectWorldSimulationRetrievalEpisodeLocalEvidenceReprojection({
    query_id:
      "phase64a-r4e3-query",
    character:
      "phase64a-r4e3-observer",
    turn_id:
      "phase64a-r4e3-turn",
    source_process_initial_frontier:
      initialFrontier,
    source_previous_episode:
      initialEpisode,
    source_prior_frontier:
      initialFrontier,
    source_episode_frontier:
      episodeFrontier,
    source_episode_cue_diagnostic_projection:
      episodeR4A,
    process_wide_cue_orientation_evidence:
      r4b1,
    base_level_activation_projection:
      r3,
    source_step_index:
      0,
    selected_reinstatement_cues: [
      {
        cue_option_id:
          bridgeRef,
        canonical_cue_identity:
          JSON.stringify([
            "semantic",
            "bridge",
          ]),
      },
    ],
  });

assert.equal(
  reprojection.episode.episode_index,
  1,
);
assert.equal(
  reprojection.transition.source_step_index,
  0,
);
assert.equal(
  reprojection.transition.next_step_index,
  1,
);
assert.deepEqual(
  reprojection
    .transition
    .selected_reinstatement_cue_refs,
  [
    bridgeRef,
  ],
);
assert.equal(
  reprojection
    .episode_r4b2_support_topology_evidence
    .boundaries
    .evidence_is_episode_frontier_bound,
  true,
);
assert.equal(
  reprojection
    .episode_r4b2_support_topology_evidence
    .boundaries
    .process_wide_r4b1_baseline_reused,
  true,
);
assert.equal(
  reprojection
    .episode_r4b2_support_topology_evidence
    .channels
    .reinstatement
    .selected_cue_count,
  1,
);
assert.deepEqual(
  reprojection
    .episode_r4b2_support_topology_evidence
    .channels
    .reinstatement
    .individual_support[0]
    .support_candidate_ids,
  [
    "memory-bridge",
    "memory-both",
  ],
);
assert.equal(
  reprojection
    .episode_r4b3_associative_activation_composition_evidence
    .boundaries
    .evidence_is_episode_frontier_bound,
  true,
);
assert.equal(
  reprojection
    .episode_r4b3_associative_activation_composition_evidence
    .candidate_evidence
    .some(
      (entry) =>
        Array.isArray(
          entry
            .cue_support
            .reinstatement,
        ),
    ),
  true,
);
assert.equal(
  reprojection
    .episode_r4c_competition_monitoring_evidence
    .boundaries
    .evidence_is_episode_frontier_bound,
  true,
);
assert.equal(
  reprojection
    .boundaries
    .r4d_consulted_during_reprojection,
  false,
);
assert.ok(
  Object.isFrozen(
    reprojection,
  ),
);

assert.deepEqual(
  validateWorldSimulationRetrievalEpisodeLocalEvidenceReprojection(
    reprojection,
  ),
  reprojection,
);

const tampered =
  structuredClone(
    reprojection,
  );

tampered
  .episode
  .cue_set_hash =
  "tampered";

assert.throws(
  () =>
    validateWorldSimulationRetrievalEpisodeLocalEvidenceReprojection(
      tampered,
    ),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_EVIDENCE_HASH_MISMATCH",
);

assert.throws(
  () =>
    projectWorldSimulationRetrievalEpisodeLocalEvidenceReprojection({
      query_id:
        "phase64a-r4e3-query",
      character:
        "phase64a-r4e3-observer",
      turn_id:
        "phase64a-r4e3-turn",
      source_process_initial_frontier:
        initialFrontier,
      source_previous_episode:
        initialEpisode,
      source_prior_frontier:
        initialFrontier,
      source_episode_frontier:
        {
          ...episodeFrontier,
          active_cue_hash:
            initialFrontier.active_cue_hash,
        },
      source_episode_cue_diagnostic_projection:
        episodeR4A,
      process_wide_cue_orientation_evidence:
        r4b1,
      base_level_activation_projection:
        r3,
      source_step_index:
        0,
      selected_reinstatement_cues: [],
    }),
  (error) =>
    error?.code
    === "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_CUE_HASH_UNCHANGED",
);

const finalR4E1 =
  projectWorldSimulationRetrievalCueConditionedEpisodeEvidence({
    query_id:
      "phase64a-r4e3-query",
    source_initial_frontier:
      initialFrontier,
    initiation: {
      mode:
        "deliberate",
      trigger_origin:
        "self_generated",
    },
    search_steps: [
      {
        step_index:
          0,
        frontier:
          initialFrontier,
        selected_reinstatement_cue_refs: [
          bridgeRef,
        ],
        continuation: {
          control_action:
            "continue",
        },
        termination_after_step:
          false,
      },
      {
        step_index:
          1,
        frontier:
          episodeFrontier,
        selected_reinstatement_cue_refs: [],
        continuation: {
          control_action:
            "stop",
        },
        termination_after_step:
          true,
      },
    ],
  });

const consistency =
  assertWorldSimulationRetrievalEpisodeLocalReprojectionsAgainstR4E1({
    reprojections: [
      reprojection,
    ],
    retrieval_cue_conditioned_episode_evidence:
      finalR4E1,
  });

assert.equal(
  consistency.verified,
  true,
);
assert.equal(
  consistency.reprojection_count,
  1,
);
assert.equal(
  consistency.r4e1_transition_count,
  1,
);

const r4b2Source =
  await readFile(
    new URL(
      "../../server/src/world-simulation-retrieval-cue-support-topology-evidence-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  r4b2Source,
  /projectWorldSimulationRetrievalCueSupportTopologyEvidenceForEpisode/,
);
assert.match(
  r4b2Source,
  /reinstatement:[\s\S]*buildChannel/,
);
assert.match(
  r4b2Source,
  /process_wide_r4b1_baseline_reused:[\s\S]*true/,
);

const r4b3Source =
  await readFile(
    new URL(
      "../../server/src/world-simulation-associative-activation-composition-evidence-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  r4b3Source,
  /cue_support\?\.reinstatement/,
);
assert.match(
  r4b3Source,
  /evidence_is_episode_frontier_bound/,
);

const r4cSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-retrieval-competition-monitoring-evidence-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  r4cSource,
  /episodeLocal/,
);
assert.match(
  r4cSource,
  /evidence_is_episode_frontier_bound/,
);

const multistepSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  multistepSource,
  /buildWorldSimulationRetrievalEpisodeLocalInitialContext/,
);
assert.match(
  multistepSource,
  /projectWorldSimulationRetrievalEpisodeLocalEvidenceReprojection/,
);
assert.match(
  multistepSource,
  /assertWorldSimulationRetrievalEpisodeLocalReprojectionsAgainstR4E1/,
);
assert.match(
  multistepSource,
  /episodeLocalReprojectionEnabled[\s\S]*retrievalCompetitionMonitoringEvidence/,
);
assert.match(
  multistepSource,
  /reevaluatedFrontier[\s\S]*episodeLocalReprojection/,
);
assert.match(
  multistepSource,
  /retrievalCueConditionedEpisodeEvidence[\s\S]*episodeLocalReprojectionConsistency[\s\S]*projectWorldSimulationRetrievalSearchControlReadinessEvidence/,
  "R4E3/R4E1 consistency must be checked before post-hoc R4D materialization",
);

const worldLoopSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-loop-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

assert.match(
  worldLoopSource,
  /episode_local_evidence_reprojection_is_engine_side:[\s\S]*true/,
);
assert.match(
  worldLoopSource,
  /retrieval_episode_local_reprojection_evidence_exposed_to_resolver:[\s\S]*false/,
);
assert.match(
  worldLoopSource,
  /r4d_used_during_episode_local_reprojection:[\s\S]*false/,
);

const runAllSource =
  await readFile(
    new URL(
      "../run-all.mjs",
      import.meta.url,
    ),
    "utf8",
  );

const registrationMatches =
  runAllSource.match(
    /tests\/phase64\/phase64a-retrieval-episode-local-evidence-reprojection\.test\.mjs/g,
  )
  ?? [];

assert.equal(
  registrationMatches.length,
  1,
);

console.log(JSON.stringify({
  ok:
    true,
  phase:
    "Phase64A-R4E3 Episode-Local Evidence Reprojection",
  material_cue_transition_required:
    true,
  r4b1_process_wide_baseline_reused:
    true,
  reinstatement_channel_included:
    true,
  r4d_consulted_online:
    false,
  r4e1_consistency_verified:
    true,
  resolver_exposure:
    false,
  persistent_memory_mutation:
    false,
}));
console.log(
  "Phase64A-R4E3 episode-local evidence reprojection passed.",
);
