import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
} from "./world-simulation-retrieval-cue-conditioned-episode-evidence-service.mjs";
import {
  projectWorldSimulationRetrievalCueSupportTopologyEvidenceForEpisode,
} from "./world-simulation-retrieval-cue-support-topology-evidence-service.mjs";
import {
  projectWorldSimulationAssociativeActivationCompositionEvidence,
} from "./world-simulation-associative-activation-composition-evidence-service.mjs";
import {
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence,
} from "./world-simulation-retrieval-competition-monitoring-evidence-service.mjs";
import {
  worldSimulationCueDiagnosticEvidenceProjectionVersion,
} from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";

export const worldSimulationRetrievalEpisodeLocalEvidenceReprojectionVersion =
  "phase64a-r4e3-retrieval-episode-local-evidence-reprojection-v1";

export const retrievalEpisodeLocalEvidenceReprojectionSchemaVersion =
  worldSimulationRetrievalEpisodeLocalEvidenceReprojectionVersion;

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function object(value) {
  return isObject(value)
    ? value
    : {};
}

function array(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function cloneJson(value) {
  return JSON.parse(
    JSON.stringify(
      value ?? null,
    ),
  );
}

function deepFreeze(value) {
  if (
    !value
    || typeof value !== "object"
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

function optionalString(value) {
  return typeof value === "string"
    && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_INVALID",
) {
  const text =
    optionalString(value);

  if (text) {
    return text;
  }

  const error =
    new Error(`${label} is required.`);

  error.code =
    code;

  throw error;
}

function nonNegativeInteger(
  value,
  label,
) {
  const number =
    Number(value);

  if (
    Number.isSafeInteger(number)
    && number >= 0
  ) {
    return number;
  }

  const error =
    new Error(
      `${label} must be a non-negative safe integer.`,
    );

  error.code =
    "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_INTEGER_INVALID";

  throw error;
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "retrieval_search_control_readiness_evidence",
    "r4d_evidence",
    "search_control_policy",
    "continuation_policy",
    "stopping_policy",
    "retrieval_threshold",
    "activation_threshold",
    "noise_model",
    "cost_model",
    "benefit_model",
    "utility_function",
    "latency_model",
    "feeling_of_knowing_model",
    "inhibition_model",
    "retrieval_probability_model",
    "winner_selector",
    "new_attempt_policy",
  ];

  for (const key of forbidden) {
    if (Object.hasOwn(object(input), key)) {
      const error =
        new Error(
          `Phase64A-R4E3 v1 does not accept caller-supplied ${key}.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_OVERRIDE_FORBIDDEN";

      error.field =
        key;

      throw error;
    }
  }
}

function normalizeFrontier(
  raw,
  label,
) {
  const frontier =
    object(raw);

  const cueDiagnostic =
    object(
      frontier.cue_diagnostic_projection,
    );

  return {
    frontier_id:
      requiredString(
        frontier.frontier_id,
        `${label}.frontier_id`,
      ),
    active_cue_hash:
      requiredString(
        frontier.active_cue_hash,
        `${label}.active_cue_hash`,
      ),
    cue_diagnostic_projection: {
      version:
        optionalString(
          cueDiagnostic.version,
        ),
      projection_id:
        optionalString(
          cueDiagnostic.projection_id,
        ),
      evidence_hash:
        optionalString(
          cueDiagnostic.evidence_hash,
        ),
      applicable:
        cueDiagnostic.applicable
        === true,
    },
  };
}

function episodeIdFor({
  queryId,
  episodeIndex,
  firstStepIndex,
  cueSetHash,
}) {
  return `memory_retrieval_cue_conditioned_episode_${hashAgentRunValue({
    version:
      worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
    query_id:
      queryId,
    episode_index:
      episodeIndex,
    first_step_index:
      firstStepIndex,
    cue_set_hash:
      cueSetHash,
  }).slice(0, 24)}`;
}

function normalizePreviousEpisode(
  raw,
  queryId,
) {
  const episode =
    object(raw);

  const episodeIndex =
    nonNegativeInteger(
      episode.episode_index,
      "source_previous_episode.episode_index",
    );

  const firstStepIndex =
    nonNegativeInteger(
      episode.first_step_index,
      "source_previous_episode.first_step_index",
    );

  const cueSetHash =
    requiredString(
      episode.cue_set_hash,
      "source_previous_episode.cue_set_hash",
    );

  const episodeId =
    requiredString(
      episode.episode_id,
      "source_previous_episode.episode_id",
    );

  const expectedId =
    episodeIdFor({
      queryId,
      episodeIndex,
      firstStepIndex,
      cueSetHash,
    });

  if (episodeId !== expectedId) {
    const error =
      new Error(
        "R4E3 previous episode identity is not compatible with canonical R4E1 semantics.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_PREVIOUS_EPISODE_ID_MISMATCH";

    throw error;
  }

  return {
    episode_id:
      episodeId,
    episode_index:
      episodeIndex,
    first_step_index:
      firstStepIndex,
    cue_set_hash:
      cueSetHash,
  };
}

function normalizeSelections(raw) {
  const selectedRefs = [];
  const seenRefs =
    new Set();
  const topologyByIdentity =
    new Map();

  for (
    const [
      index,
      entry,
    ]
    of array(raw).entries()
  ) {
    if (!isObject(entry)) {
      const error =
        new Error(
          `selected_reinstatement_cues[${index}] must be an object.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_SELECTION_INVALID";

      throw error;
    }

    const optionId =
      requiredString(
        entry.cue_option_id,
        `selected_reinstatement_cues[${index}].cue_option_id`,
      );

    const canonicalCueIdentity =
      requiredString(
        entry.canonical_cue_identity,
        `selected_reinstatement_cues[${index}].canonical_cue_identity`,
      );

    if (!seenRefs.has(optionId)) {
      seenRefs.add(optionId);
      selectedRefs.push(optionId);
    }

    if (
      !topologyByIdentity.has(
        canonicalCueIdentity,
      )
    ) {
      topologyByIdentity.set(
        canonicalCueIdentity,
        {
          cue_option_id:
            optionId,
          canonical_cue_identity:
            canonicalCueIdentity,
        },
      );
    }
  }

  return {
    selected_refs:
      selectedRefs,
    topology_selections:
      [...topologyByIdentity.values()],
  };
}

function transitionIdFor({
  queryId,
  transitionIndex,
  fromEpisodeId,
  toEpisodeId,
  sourceStepIndex,
  nextStepIndex,
  priorCueSetHash,
  nextCueSetHash,
  provenanceKind,
  selectedRefs,
}) {
  const hash =
    hashAgentRunValue({
      version:
        worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
      query_id:
        queryId,
      transition_index:
        transitionIndex,
      from_episode_id:
        fromEpisodeId,
      to_episode_id:
        toEpisodeId,
      source_step_index:
        sourceStepIndex,
      next_step_index:
        nextStepIndex,
      prior_cue_set_hash:
        priorCueSetHash,
      next_cue_set_hash:
        nextCueSetHash,
      provenance_kind:
        provenanceKind,
      selected_reinstatement_cue_refs:
        selectedRefs,
    });

  return `memory_retrieval_cue_episode_transition_${hash.slice(0, 24)}`;
}

function evidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    character:
      evidence.character,
    turn_id:
      evidence.turn_id,
    source_process_initial_frontier_id:
      evidence.source_process_initial_frontier_id,
    source_previous_episode:
      cloneJson(
        evidence.source_previous_episode,
      ),
    episode:
      cloneJson(
        evidence.episode,
      ),
    transition:
      cloneJson(
        evidence.transition,
      ),
    source_r4b1_orientation_evidence_id:
      evidence.source_r4b1_orientation_evidence_id,
    source_r4b1_evidence_hash:
      evidence.source_r4b1_evidence_hash,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    episode_r4b2_support_topology_evidence:
      cloneJson(
        evidence.episode_r4b2_support_topology_evidence,
      ),
    episode_r4b3_associative_activation_composition_evidence:
      cloneJson(
        evidence.episode_r4b3_associative_activation_composition_evidence,
      ),
    episode_r4c_competition_monitoring_evidence:
      cloneJson(
        evidence.episode_r4c_competition_monitoring_evidence,
      ),
    observation:
      cloneJson(
        evidence.observation,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      true,
  };
}

export function buildWorldSimulationRetrievalEpisodeLocalEvidenceReprojectionContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalEpisodeLocalEvidenceReprojectionVersion,
    phase:
      "Phase64A-R4E3",
    status:
      "episode_local_evidence_reprojection_v1",
    trigger:
      "material_canonical_active_cue_hash_change",
    same_cue_hash_reprojection_allowed:
      false,
    source_phase63b_dynamic_frontier_required:
      true,
    source_r4a_dynamic_projection_required:
      true,
    process_wide_r4b1_baseline_reused:
      true,
    r4b1_recomputed_per_episode:
      false,
    r4b2_episode_local_support_topology_reprojected:
      true,
    r4b2_reinstatement_channel_included:
      true,
    r4b3_episode_local_composition_reprojected:
      true,
    r4c_episode_local_competition_monitoring_reprojected:
      true,
    prior_episode_r4c_used_as_current_episode_evidence:
      false,
    r4d_consulted_during_reprojection:
      false,
    r4d_remains_post_hoc:
      true,
    r4e1_identity_semantics_reused:
      true,
    r4e1_post_hoc_transition_consistency_required:
      true,
    retrieval_attempt_created:
      false,
    cue_selection_authority:
      false,
    continuation_decision_authority:
      false,
    stop_decision_authority:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    persistent_memory_mutation_authority:
      false,
    resolver_exposure_allowed:
      false,
    full_evidence_persistence_allowed:
      false,
    process_hash_commitment_required:
      true,
    immutable_evidence:
      true,
  });
}

export function buildWorldSimulationRetrievalEpisodeLocalInitialContext(
  input = {},
) {
  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const frontier =
    normalizeFrontier(
      input.source_initial_frontier,
      "source_initial_frontier",
    );

  return deepFreeze({
    episode_id:
      episodeIdFor({
        queryId,
        episodeIndex:
          0,
        firstStepIndex:
          0,
        cueSetHash:
          frontier.active_cue_hash,
      }),
    episode_index:
      0,
    first_step_index:
      0,
    cue_set_hash:
      frontier.active_cue_hash,
  });
}

export function projectWorldSimulationRetrievalEpisodeLocalEvidenceReprojection(
  input = {},
) {
  assertNoUnsupportedOverrides(
    input,
  );

  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const character =
    requiredString(
      input.character,
      "character",
    );

  const turnId =
    requiredString(
      input.turn_id,
      "turn_id",
    );

  const processInitialFrontierId =
    requiredString(
      input
        .source_process_initial_frontier
        ?.frontier_id,
      "source_process_initial_frontier.frontier_id",
    );

  const previousEpisode =
    normalizePreviousEpisode(
      input.source_previous_episode,
      queryId,
    );

  const priorFrontier =
    normalizeFrontier(
      input.source_prior_frontier,
      "source_prior_frontier",
    );

  const episodeFrontier =
    normalizeFrontier(
      input.source_episode_frontier,
      "source_episode_frontier",
    );

  if (
    priorFrontier.active_cue_hash
    === episodeFrontier.active_cue_hash
  ) {
    const error =
      new Error(
        "R4E3 requires a material canonical active-cue hash change.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_CUE_HASH_UNCHANGED";

    throw error;
  }

  if (
    previousEpisode.cue_set_hash
    !== priorFrontier.active_cue_hash
  ) {
    const error =
      new Error(
        "R4E3 previous episode cue hash does not match the prior frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_PREVIOUS_EPISODE_FRONTIER_MISMATCH";

    throw error;
  }

  const sourceStepIndex =
    nonNegativeInteger(
      input.source_step_index,
      "source_step_index",
    );

  const nextStepIndex =
    sourceStepIndex + 1;

  const nextEpisodeIndex =
    previousEpisode.episode_index + 1;

  const nextEpisodeId =
    episodeIdFor({
      queryId,
      episodeIndex:
        nextEpisodeIndex,
      firstStepIndex:
        nextStepIndex,
      cueSetHash:
        episodeFrontier.active_cue_hash,
    });

  const selections =
    normalizeSelections(
      input.selected_reinstatement_cues,
    );

  const provenanceKind =
    selections.selected_refs.length
      ? "grounded_internal_reinstatement_selection"
      : "observed_cue_set_change_unattributed";

  const transitionId =
    transitionIdFor({
      queryId,
      transitionIndex:
        nextEpisodeIndex - 1,
      fromEpisodeId:
        previousEpisode.episode_id,
      toEpisodeId:
        nextEpisodeId,
      sourceStepIndex,
      nextStepIndex,
      priorCueSetHash:
        priorFrontier.active_cue_hash,
      nextCueSetHash:
        episodeFrontier.active_cue_hash,
      provenanceKind,
      selectedRefs:
        selections.selected_refs,
    });

  const r4a =
    object(
      input
        .source_episode_cue_diagnostic_projection,
    );

  if (
    r4a.version
    !== worldSimulationCueDiagnosticEvidenceProjectionVersion
    || r4a.applicable
    !== true
    || r4a.projection_id
      !== episodeFrontier
        .cue_diagnostic_projection
        .projection_id
    || r4a.evidence_hash
      !== episodeFrontier
        .cue_diagnostic_projection
        .evidence_hash
  ) {
    const error =
      new Error(
        "R4E3 requires canonical R4A evidence bound to the current episode frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_R4A_BINDING_MISMATCH";

    throw error;
  }

  const r4b1 =
    object(
      input
        .process_wide_cue_orientation_evidence,
    );

  const r4b1Id =
    requiredString(
      r4b1.orientation_evidence_id,
      "process_wide_cue_orientation_evidence.orientation_evidence_id",
    );

  const r4b1Hash =
    requiredString(
      r4b1.evidence_hash,
      "process_wide_cue_orientation_evidence.evidence_hash",
    );

  if (
    r4b1.query_id
      !== queryId
    || r4b1.source_initial_frontier_id
      !== processInitialFrontierId
  ) {
    const error =
      new Error(
        "R4E3 process-wide R4B1 baseline binding mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_R4B1_BASELINE_MISMATCH";

    throw error;
  }

  const r4b2 =
    projectWorldSimulationRetrievalCueSupportTopologyEvidenceForEpisode({
      query_id:
        queryId,
      source_process_initial_frontier_id:
        processInitialFrontierId,
      source_episode_frontier:
        input.source_episode_frontier,
      cue_orientation_evidence:
        r4b1,
      cue_diagnostic_projection:
        r4a,
      episode_index:
        nextEpisodeIndex,
      source_transition_id:
        transitionId,
      episode_transition_cue_selections:
        selections.topology_selections,
    });

  const r4b3 =
    projectWorldSimulationAssociativeActivationCompositionEvidence({
      query_id:
        queryId,
      character,
      turn_id:
        turnId,
      base_level_activation_projection:
        input.base_level_activation_projection,
      cue_diagnostic_projection:
        r4a,
      cue_support_topology_evidence:
        r4b2,
    });

  const r4c =
    projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
      query_id:
        queryId,
      associative_activation_composition_evidence:
        r4b3,
    });

  const body = {
    schema_version:
      retrievalEpisodeLocalEvidenceReprojectionSchemaVersion,
    version:
      worldSimulationRetrievalEpisodeLocalEvidenceReprojectionVersion,
    query_id:
      queryId,
    character,
    turn_id:
      turnId,
    source_process_initial_frontier_id:
      processInitialFrontierId,
    source_previous_episode:
      cloneJson(
        previousEpisode,
      ),
    episode: {
      episode_id:
        nextEpisodeId,
      episode_index:
        nextEpisodeIndex,
      first_step_index:
        nextStepIndex,
      cue_set_hash:
        episodeFrontier.active_cue_hash,
      source_frontier_id:
        episodeFrontier.frontier_id,
      initial_process_episode:
        false,
      transition_in_id:
        transitionId,
    },
    transition: {
      transition_id:
        transitionId,
      transition_index:
        nextEpisodeIndex - 1,
      from_episode_id:
        previousEpisode.episode_id,
      to_episode_id:
        nextEpisodeId,
      source_step_index:
        sourceStepIndex,
      next_step_index:
        nextStepIndex,
      prior_frontier_id:
        priorFrontier.frontier_id,
      next_frontier_id:
        episodeFrontier.frontier_id,
      prior_cue_set_hash:
        priorFrontier.active_cue_hash,
      next_cue_set_hash:
        episodeFrontier.active_cue_hash,
      cue_set_changed:
        true,
      provenance_kind:
        provenanceKind,
      selected_reinstatement_cue_refs:
        cloneJson(
          selections.selected_refs,
        ),
      grounded_internal_selection_observed:
        selections.selected_refs.length > 0,
      retrieval_attempt_created:
        false,
    },
    source_r4b1_orientation_evidence_id:
      r4b1Id,
    source_r4b1_evidence_hash:
      r4b1Hash,
    source_r4a_projection_id:
      r4a.projection_id,
    source_r4a_evidence_hash:
      r4a.evidence_hash,
    episode_r4b2_support_topology_evidence:
      cloneJson(
        r4b2,
      ),
    episode_r4b3_associative_activation_composition_evidence:
      cloneJson(
        r4b3,
      ),
    episode_r4c_competition_monitoring_evidence:
      cloneJson(
        r4c,
      ),
    observation: {
      selected_reinstatement_cue_ref_count:
        selections.selected_refs.length,
      reinstatement_topology_cue_count:
        selections.topology_selections.length,
      r4b1_process_wide_baseline_reused:
        true,
      r4b1_recomputed:
        false,
      r4d_consulted:
        false,
    },
    boundaries: {
      material_canonical_cue_transition_required:
        true,
      same_cue_hash_reprojection:
        false,
      episode_frontier_is_phase63b_authoritative:
        true,
      r4a_is_episode_frontier_local:
        true,
      r4b1_is_process_wide_baseline:
        true,
      r4b1_recomputed_per_episode:
        false,
      r4b2_reinstatement_channel_included:
        true,
      prior_episode_r4c_used_as_current_evidence:
        false,
      r4d_consulted_during_reprojection:
        false,
      r4d_remains_post_hoc:
        true,
      retrieval_attempt_created:
        false,
      cue_selection_authority:
        false,
      continuation_decision_authority:
        false,
      stop_decision_authority:
        false,
      retrieval_contact_authority:
        false,
      retrieval_recovery_authority:
        false,
      candidate_membership_authority:
        false,
      candidate_order_authority:
        false,
      persistent_memory_mutated:
        false,
      resolver_exposure_allowed:
        false,
      full_evidence_persistence_allowed:
        false,
    },
    immutable:
      true,
  };

  const evidenceHash =
    hashAgentRunValue(
      body,
    );

  return deepFreeze({
    ...body,
    episode_local_reprojection_evidence_id:
      `memory_retrieval_episode_local_reprojection_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function validateWorldSimulationRetrievalEpisodeLocalEvidenceReprojection(
  evidence,
) {
  const source =
    object(evidence);

  if (
    source.version
    !== worldSimulationRetrievalEpisodeLocalEvidenceReprojectionVersion
  ) {
    const error =
      new Error(
        "R4E3 evidence version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_VERSION_MISMATCH";

    throw error;
  }

  const actualHash =
    hashAgentRunValue(
      evidenceBody(
        source,
      ),
    );

  if (
    actualHash
    !== source.evidence_hash
  ) {
    const error =
      new Error(
        "R4E3 evidence hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_EVIDENCE_HASH_MISMATCH";

    throw error;
  }

  if (
    source
      .episode_local_reprojection_evidence_id
    !== `memory_retrieval_episode_local_reprojection_${actualHash.slice(0, 24)}`
  ) {
    const error =
      new Error(
        "R4E3 evidence id mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_EVIDENCE_ID_MISMATCH";

    throw error;
  }

  return deepFreeze(
    cloneJson(
      source,
    ),
  );
}

export function assertWorldSimulationRetrievalEpisodeLocalReprojectionsAgainstR4E1(
  input = {},
) {
  const reprojections =
    array(
      input.reprojections,
    );

  const r4e1 =
    object(
      input
        .retrieval_cue_conditioned_episode_evidence,
    );

  const transitions =
    array(
      r4e1.cue_transitions,
    );

  const episodes =
    array(
      r4e1.cue_conditioned_episodes,
    );

  if (
    reprojections.length
    !== transitions.length
  ) {
    const error =
      new Error(
        "R4E3 online reprojection count does not match final R4E1 cue-transition count.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_R4E1_COUNT_MISMATCH";

    throw error;
  }

  reprojections.forEach(
    (
      raw,
      index,
    ) => {
      const evidence =
        validateWorldSimulationRetrievalEpisodeLocalEvidenceReprojection(
          raw,
        );

      const transition =
        object(
          transitions[index],
        );

      const episode =
        object(
          episodes[index + 1],
        );

      if (
        evidence.transition.transition_id
          !== transition.transition_id
        || evidence.transition.transition_index
          !== transition.transition_index
        || evidence.transition.from_episode_id
          !== transition.from_episode_id
        || evidence.transition.to_episode_id
          !== transition.to_episode_id
        || evidence.transition.source_step_index
          !== transition.source_step_index
        || evidence.transition.next_step_index
          !== transition.next_step_index
        || evidence.transition.prior_cue_set_hash
          !== transition.prior_cue_set_hash
        || evidence.transition.next_cue_set_hash
          !== transition.next_cue_set_hash
        || evidence.transition.provenance_kind
          !== transition.provenance_kind
        || JSON.stringify(
          evidence
            .transition
            .selected_reinstatement_cue_refs,
        )
          !== JSON.stringify(
            transition
              .selected_reinstatement_cue_refs,
          )
      ) {
        const error =
          new Error(
            `R4E3 transition ${index} does not match final R4E1 provenance.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_R4E1_TRANSITION_MISMATCH";

        throw error;
      }

      if (
        evidence.episode.episode_id
          !== episode.episode_id
        || evidence.episode.episode_index
          !== episode.episode_index
        || evidence.episode.first_step_index
          !== episode.first_step_index
        || evidence.episode.cue_set_hash
          !== episode.cue_set_hash
        || evidence.episode.transition_in_id
          !== episode.transition_in_id
      ) {
        const error =
          new Error(
            `R4E3 episode ${index + 1} does not match final R4E1 identity.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_EPISODE_LOCAL_REPROJECTION_R4E1_EPISODE_MISMATCH";

        throw error;
      }
    },
  );

  return deepFreeze({
    verified:
      true,
    reprojection_count:
      reprojections.length,
    r4e1_transition_count:
      transitions.length,
    r4e1_episode_count:
      episodes.length,
  });
}
