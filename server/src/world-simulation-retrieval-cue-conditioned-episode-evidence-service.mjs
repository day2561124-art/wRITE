import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion =
  "phase64a-r4e1-retrieval-cue-conditioned-episode-evidence-v1";

export const retrievalCueConditionedEpisodeEvidenceSchemaVersion =
  worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion;

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
  code = "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_INVALID",
) {
  const text = optionalString(value);

  if (text) return text;

  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function nonNegativeInteger(
  value,
  label,
) {
  const number = Number(value);

  if (
    Number.isSafeInteger(number)
    && number >= 0
  ) {
    return number;
  }

  const error = new Error(
    `${label} must be a non-negative safe integer.`,
  );
  error.code =
    "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_INTEGER_INVALID";
  throw error;
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "retrieval_attempt_policy",
    "new_attempt_policy",
    "cue_shift_policy",
    "cue_selection_policy",
    "search_control_policy",
    "continuation_policy",
    "stopping_policy",
    "failure_threshold",
    "activation_threshold",
    "retrieval_threshold",
    "noise_model",
    "cost_model",
    "benefit_model",
    "utility_function",
    "latency_model",
    "feeling_of_knowing_model",
    "semantic_access_policy",
  ];

  for (const key of forbidden) {
    if (Object.hasOwn(object(input), key)) {
      const error = new Error(
        `Phase64A-R4E1 v1 does not accept caller-supplied ${key}.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_OVERRIDE_FORBIDDEN";
      error.field = key;
      throw error;
    }
  }
}

function normalizeInitialFrontier(raw) {
  const frontier = object(raw);

  return {
    frontier_id:
      requiredString(
        frontier.frontier_id,
        "source_initial_frontier.frontier_id",
      ),
    active_cue_hash:
      requiredString(
        frontier.active_cue_hash,
        "source_initial_frontier.active_cue_hash",
      ),
  };
}

function normalizeInitiation(raw) {
  if (raw === null || raw === undefined) {
    return {
      mode:
        null,
      trigger_origin:
        null,
    };
  }

  const initiation = object(raw);

  return {
    mode:
      optionalString(
        initiation.mode,
      ),
    trigger_origin:
      optionalString(
        initiation.trigger_origin,
      ),
  };
}

function normalizeStep(
  raw,
  expectedIndex,
) {
  const step = object(raw);
  const stepIndex =
    nonNegativeInteger(
      step.step_index,
      `search_steps[${expectedIndex}].step_index`,
    );

  if (stepIndex !== expectedIndex) {
    const error = new Error(
      `Phase64A-R4E1 search step index mismatch at ${expectedIndex}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_STEP_ORDER_MISMATCH";
    throw error;
  }

  const frontier = object(step.frontier);
  const continuation = object(step.continuation);
  const controlAction =
    optionalString(
      continuation.control_action,
    );

  if (
    controlAction !== null
    && controlAction !== "continue"
    && controlAction !== "stop"
  ) {
    const error = new Error(
      `Unsupported retrieval control action ${controlAction}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_CONTROL_ACTION_INVALID";
    throw error;
  }

  const selectedRefs =
    array(
      step.selected_reinstatement_cue_refs,
    ).map(
      (value, index) =>
        requiredString(
          value,
          `search_steps[${expectedIndex}].selected_reinstatement_cue_refs[${index}]`,
        ),
    );

  if (
    selectedRefs.length
    && controlAction === "stop"
  ) {
    const error = new Error(
      "A terminal retrieval step cannot ground a cue-conditioned transition to a nonexistent next step.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_TERMINAL_SELECTION_INVALID";
    throw error;
  }

  return {
    step_index:
      stepIndex,
    frontier: {
      frontier_id:
        requiredString(
          frontier.frontier_id,
          `search_steps[${expectedIndex}].frontier.frontier_id`,
        ),
      active_cue_hash:
        requiredString(
          frontier.active_cue_hash,
          `search_steps[${expectedIndex}].frontier.active_cue_hash`,
        ),
    },
    selected_reinstatement_cue_refs:
      selectedRefs,
    control_action:
      controlAction,
    termination_after_step:
      step.termination_after_step
      === true,
  };
}

function normalizeSteps(rawSteps) {
  const source = array(rawSteps);

  if (!source.length) {
    const error = new Error(
      "Phase64A-R4E1 requires at least one completed retrieval search step.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_EMPTY_PATH";
    throw error;
  }

  const steps =
    source.map(
      (step, index) =>
        normalizeStep(
          step,
          index,
        ),
    );

  for (
    let index = 0;
    index < steps.length - 1;
    index += 1
  ) {
    if (
      steps[index].termination_after_step
      || steps[index].control_action === "stop"
    ) {
      const error = new Error(
        "Only the final observed retrieval step may terminate a Phase64A-R4E1 source prefix.",
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_EARLY_TERMINATION_MISMATCH";
      throw error;
    }
  }

  const finalStep = steps.at(-1);

  if (
    (
      finalStep.control_action === "stop"
      && !finalStep.termination_after_step
    )
    || (
      finalStep.control_action === "continue"
      && finalStep.termination_after_step
    )
  ) {
    const error = new Error(
      "Final search-step termination flag does not match the observed control action.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_TERMINATION_FLAG_MISMATCH";
    throw error;
  }

  return steps;
}

function transitionKindFor(
  previousStep,
) {
  if (
    previousStep
      .selected_reinstatement_cue_refs
      .length
  ) {
    return "grounded_internal_reinstatement_selection";
  }

  return "observed_cue_set_change_unattributed";
}

function buildEpisodes({
  queryId,
  steps,
  initiation,
}) {
  const episodes = [];
  const transitions = [];

  let currentEpisode = null;

  for (const step of steps) {
    const cueSetHash =
      step.frontier.active_cue_hash;

    if (
      !currentEpisode
      || currentEpisode.cue_set_hash
        !== cueSetHash
    ) {
      const episodeIndex =
        episodes.length;
      const previousEpisode =
        episodes.at(-1)
        ?? null;
      const previousStep =
        step.step_index > 0
          ? steps[step.step_index - 1]
          : null;

      const episodeIdentityBody = {
        version:
          worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
        query_id:
          queryId,
        episode_index:
          episodeIndex,
        first_step_index:
          step.step_index,
        cue_set_hash:
          cueSetHash,
      };

      currentEpisode = {
        episode_id:
          `memory_retrieval_cue_conditioned_episode_${hashAgentRunValue(
            episodeIdentityBody,
          ).slice(0, 24)}`,
        episode_index:
          episodeIndex,
        cue_set_hash:
          cueSetHash,
        first_step_index:
          step.step_index,
        last_step_index:
          step.step_index,
        step_count:
          1,
        source_frontier_ids: [
          step.frontier.frontier_id,
        ],
        initial_process_episode:
          episodeIndex === 0,
        initial_trigger_origin:
          episodeIndex === 0
            ? initiation.trigger_origin
            : null,
        transition_in_id:
          null,
      };

      if (
        previousEpisode
        && previousStep
      ) {
        const transitionBody = {
          version:
            worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
          query_id:
            queryId,
          transition_index:
            transitions.length,
          from_episode_id:
            previousEpisode.episode_id,
          to_episode_id:
            currentEpisode.episode_id,
          source_step_index:
            previousStep.step_index,
          next_step_index:
            step.step_index,
          prior_cue_set_hash:
            previousEpisode.cue_set_hash,
          next_cue_set_hash:
            currentEpisode.cue_set_hash,
          provenance_kind:
            transitionKindFor(
              previousStep,
            ),
          selected_reinstatement_cue_refs:
            previousStep
              .selected_reinstatement_cue_refs,
        };
        const transitionHash =
          hashAgentRunValue(
            transitionBody,
          );
        const transition = {
          transition_id:
            `memory_retrieval_cue_episode_transition_${transitionHash.slice(0, 24)}`,
          transition_index:
            transitions.length,
          from_episode_id:
            previousEpisode.episode_id,
          to_episode_id:
            currentEpisode.episode_id,
          source_step_index:
            previousStep.step_index,
          next_step_index:
            step.step_index,
          prior_cue_set_hash:
            previousEpisode.cue_set_hash,
          next_cue_set_hash:
            currentEpisode.cue_set_hash,
          cue_set_changed:
            true,
          provenance_kind:
            transitionBody.provenance_kind,
          selected_reinstatement_cue_refs:
            cloneJson(
              previousStep
                .selected_reinstatement_cue_refs,
            ),
          grounded_internal_selection_observed:
            previousStep
              .selected_reinstatement_cue_refs
              .length > 0,
          retrieval_attempt_created:
            false,
        };

        transitions.push(
          transition,
        );

        currentEpisode.transition_in_id =
          transition.transition_id;
      }

      episodes.push(
        currentEpisode,
      );
      continue;
    }

    currentEpisode.last_step_index =
      step.step_index;
    currentEpisode.step_count += 1;
    currentEpisode.source_frontier_ids.push(
      step.frontier.frontier_id,
    );
  }

  return {
    episodes,
    transitions,
  };
}

function evidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_initial_active_cue_hash:
      evidence.source_initial_active_cue_hash,
    source_step_count:
      evidence.source_step_count,
    process_termination_observed:
      evidence.process_termination_observed,
    initiation:
      cloneJson(
        evidence.initiation,
      ),
    cue_conditioned_episodes:
      cloneJson(
        evidence.cue_conditioned_episodes,
      ),
    cue_transitions:
      cloneJson(
        evidence.cue_transitions,
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
      evidence.immutable,
  };
}

export function buildWorldSimulationRetrievalCueConditionedEpisodeEvidenceContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
    phase:
      "Phase64A-R4E1",
    status:
      "cue_conditioned_retrieval_episode_semantics_and_transition_provenance",
    source_phase63c_completed_step_prefix_required:
      true,
    explicit_process_termination_required:
      false,
    cue_conditioned_episode_basis:
      "contiguous_canonical_active_cue_hash",
    same_cue_hash_after_intervening_episode_opens_new_episode:
      true,
    episode_identity_is_contiguous_occurrence_not_global_cue_identity:
      true,
    retrieval_attempt_ontology_claimed:
      false,
    cue_hash_change_claimed_as_new_retrieval_attempt:
      false,
    grounded_internal_reinstatement_transition_provenance_supported:
      true,
    unattributed_observed_cue_change_preserved:
      true,
    raw_cue_content_materialized:
      false,
    resolver_exposure_allowed:
      false,
    new_resolver_stage_added:
      false,
    cue_selection_authority:
      false,
    continuation_decision_authority:
      false,
    stop_decision_authority:
      false,
    new_attempt_creation_authority:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    semantic_access_authority:
      false,
    persistent_memory_mutation_authority:
      false,
    character_subjective_awareness_modeled:
      false,
    technical_step_budget_used_as_cognitive_rule:
      false,
    immutable_evidence:
      true,
  });
}

export function projectWorldSimulationRetrievalCueConditionedEpisodeEvidence(
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
  const initialFrontier =
    normalizeInitialFrontier(
      input.source_initial_frontier,
    );
  const initiation =
    normalizeInitiation(
      input.initiation,
    );
  const steps =
    normalizeSteps(
      input.search_steps,
    );

  if (
    steps[0].frontier.frontier_id
    !== initialFrontier.frontier_id
    || steps[0].frontier.active_cue_hash
      !== initialFrontier.active_cue_hash
  ) {
    const error = new Error(
      "Phase64A-R4E1 first search-step frontier does not match the canonical initial frontier.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_INITIAL_FRONTIER_MISMATCH";
    throw error;
  }

  const {
    episodes,
    transitions,
  } = buildEpisodes({
    queryId,
    steps,
    initiation,
  });

  const body = {
    schema_version:
      retrievalCueConditionedEpisodeEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      initialFrontier.frontier_id,
    source_initial_active_cue_hash:
      initialFrontier.active_cue_hash,
    source_step_count:
      steps.length,
    process_termination_observed:
      steps.at(-1)
        .termination_after_step
      === true,
    initiation:
      initiation,
    cue_conditioned_episodes:
      episodes,
    cue_transitions:
      transitions,
    observation: {
      cue_conditioned_episode_count:
        episodes.length,
      cue_transition_count:
        transitions.length,
      distinct_cue_hash_count:
        new Set(
          episodes.map(
            (episode) =>
              episode.cue_set_hash,
          ),
        ).size,
      repeated_cue_hash_after_intervening_episode_observed:
        episodes.some(
          (episode, index) =>
            index > 1
            && episodes
              .slice(
                0,
                index - 1,
              )
              .some(
                (prior) =>
                  prior.cue_set_hash
                  === episode.cue_set_hash,
              ),
        ),
      grounded_internal_reinstatement_transition_count:
        transitions.filter(
          (transition) =>
            transition.provenance_kind
            === "grounded_internal_reinstatement_selection",
        ).length,
      unattributed_cue_transition_count:
        transitions.filter(
          (transition) =>
            transition.provenance_kind
            === "observed_cue_set_change_unattributed",
        ).length,
    },
    boundaries: {
      retrieval_attempt_ontology_claimed:
        false,
      cue_hash_change_claimed_as_new_retrieval_attempt:
        false,
      retrieval_attempt_created:
        false,
      resolver_exposure_allowed:
        false,
      new_resolver_stage_added:
        false,
      raw_cue_content_materialized:
        false,
      cue_selection_authority:
        false,
      continuation_decision_authority:
        false,
      stop_decision_authority:
        false,
      new_attempt_creation_authority:
        false,
      retrieval_contact_authority:
        false,
      retrieval_recovery_authority:
        false,
      candidate_membership_authority:
        false,
      candidate_order_authority:
        false,
      semantic_access_authority:
        false,
      persistent_memory_mutation_authority:
        false,
      character_subjective_awareness_modeled:
        false,
      technical_step_budget_used_as_cognitive_rule:
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
    cue_conditioned_episode_evidence_id:
      `memory_retrieval_cue_conditioned_episode_evidence_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function validateWorldSimulationRetrievalCueConditionedEpisodeEvidence(
  raw,
) {
  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion
    || evidence.schema_version
      !== retrievalCueConditionedEpisodeEvidenceSchemaVersion
  ) {
    const error = new Error(
      "Phase64A-R4E1 received non-canonical cue-conditioned episode evidence.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_VERSION_MISMATCH";
    throw error;
  }

  const expectedHash =
    requiredString(
      evidence.evidence_hash,
      "evidence.evidence_hash",
    );
  const actualHash =
    hashAgentRunValue(
      evidenceBody(
        evidence,
      ),
    );

  if (actualHash !== expectedHash) {
    const error = new Error(
      "Phase64A-R4E1 cue-conditioned episode evidence hash mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_EVIDENCE_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_retrieval_cue_conditioned_episode_evidence_${expectedHash.slice(0, 24)}`;

  if (
    evidence.cue_conditioned_episode_evidence_id
    !== expectedId
  ) {
    const error = new Error(
      "Phase64A-R4E1 cue-conditioned episode evidence id mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_EVIDENCE_ID_MISMATCH";
    throw error;
  }

  return deepFreeze(
    cloneJson(
      evidence,
    ),
  );
}


export function advanceWorldSimulationRetrievalCueConditionedEpisodeContext(
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

  const previous =
    object(
      input.source_previous_episode,
    );

  const previousEpisodeIndex =
    nonNegativeInteger(
      previous.episode_index,
      "source_previous_episode.episode_index",
    );

  const previousFirstStepIndex =
    nonNegativeInteger(
      previous.first_step_index,
      "source_previous_episode.first_step_index",
    );

  const previousCueSetHash =
    requiredString(
      previous.cue_set_hash,
      "source_previous_episode.cue_set_hash",
    );

  const previousEpisodeId =
    requiredString(
      previous.episode_id,
      "source_previous_episode.episode_id",
    );

  const expectedPreviousEpisodeId =
    `memory_retrieval_cue_conditioned_episode_${hashAgentRunValue({
      version:
        worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
      query_id:
        queryId,
      episode_index:
        previousEpisodeIndex,
      first_step_index:
        previousFirstStepIndex,
      cue_set_hash:
        previousCueSetHash,
    }).slice(0, 24)}`;

  if (
    previousEpisodeId
    !== expectedPreviousEpisodeId
  ) {
    const error =
      new Error(
        "Previous online episode context does not match canonical R4E1 identity semantics.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_ONLINE_PREVIOUS_ID_MISMATCH";

    throw error;
  }

  const sourceStepIndex =
    nonNegativeInteger(
      input.source_step_index,
      "source_step_index",
    );

  if (
    sourceStepIndex
    < previousFirstStepIndex
  ) {
    const error =
      new Error(
        "source_step_index cannot precede the current episode.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_ONLINE_STEP_ORDER_MISMATCH";

    throw error;
  }

  const nextFrontier =
    object(
      input.source_next_frontier,
    );

  const nextFrontierId =
    requiredString(
      nextFrontier.frontier_id,
      "source_next_frontier.frontier_id",
    );

  const nextCueSetHash =
    requiredString(
      nextFrontier.active_cue_hash,
      "source_next_frontier.active_cue_hash",
    );

  if (
    nextCueSetHash
    === previousCueSetHash
  ) {
    const error =
      new Error(
        "Online R4E1 episode advancement requires a material canonical cue-hash change.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_CONDITIONED_EPISODE_ONLINE_CUE_HASH_UNCHANGED";

    throw error;
  }

  const selectedRefs =
    array(
      input.selected_reinstatement_cue_refs,
    ).map(
      (value, index) =>
        requiredString(
          value,
          `selected_reinstatement_cue_refs[${index}]`,
        ),
    );

  const nextStepIndex =
    sourceStepIndex + 1;

  const nextEpisodeIndex =
    previousEpisodeIndex + 1;

  const nextEpisodeId =
    `memory_retrieval_cue_conditioned_episode_${hashAgentRunValue({
      version:
        worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
      query_id:
        queryId,
      episode_index:
        nextEpisodeIndex,
      first_step_index:
        nextStepIndex,
      cue_set_hash:
        nextCueSetHash,
    }).slice(0, 24)}`;

  const provenanceKind =
    selectedRefs.length
      ? "grounded_internal_reinstatement_selection"
      : "observed_cue_set_change_unattributed";

  const transitionBody = {
    version:
      worldSimulationRetrievalCueConditionedEpisodeEvidenceVersion,
    query_id:
      queryId,
    transition_index:
      nextEpisodeIndex - 1,
    from_episode_id:
      previousEpisodeId,
    to_episode_id:
      nextEpisodeId,
    source_step_index:
      sourceStepIndex,
    next_step_index:
      nextStepIndex,
    prior_cue_set_hash:
      previousCueSetHash,
    next_cue_set_hash:
      nextCueSetHash,
    provenance_kind:
      provenanceKind,
    selected_reinstatement_cue_refs:
      selectedRefs,
  };

  const transitionHash =
    hashAgentRunValue(
      transitionBody,
    );

  const transitionId =
    `memory_retrieval_cue_episode_transition_${transitionHash.slice(0, 24)}`;

  return deepFreeze({
    episode: {
      episode_id:
        nextEpisodeId,
      episode_index:
        nextEpisodeIndex,
      cue_set_hash:
        nextCueSetHash,
      first_step_index:
        nextStepIndex,
      last_step_index:
        nextStepIndex,
      step_count:
        1,
      source_frontier_ids: [
        nextFrontierId,
      ],
      initial_process_episode:
        false,
      initial_trigger_origin:
        null,
      transition_in_id:
        transitionId,
    },
    transition: {
      transition_id:
        transitionId,
      transition_index:
        nextEpisodeIndex - 1,
      from_episode_id:
        previousEpisodeId,
      to_episode_id:
        nextEpisodeId,
      source_step_index:
        sourceStepIndex,
      next_step_index:
        nextStepIndex,
      prior_cue_set_hash:
        previousCueSetHash,
      next_cue_set_hash:
        nextCueSetHash,
      cue_set_changed:
        true,
      provenance_kind:
        provenanceKind,
      selected_reinstatement_cue_refs:
        cloneJson(
          selectedRefs,
        ),
      grounded_internal_selection_observed:
        selectedRefs.length > 0,
      retrieval_attempt_created:
        false,
    },
  });
}
