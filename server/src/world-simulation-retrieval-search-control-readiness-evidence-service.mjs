import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  worldSimulationRetrievalCompetitionMonitoringEvidenceVersion,
} from "./world-simulation-retrieval-competition-monitoring-evidence-service.mjs";

export const worldSimulationRetrievalSearchControlReadinessEvidenceVersion =
  "phase64a-r4d-retrieval-search-control-readiness-evidence-v1";

export const retrievalSearchControlReadinessEvidenceSchemaVersion =
  "phase64a-r4d-retrieval-search-control-readiness-evidence-v1";

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
  code = "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_INVALID",
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
    "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_INTEGER_INVALID";
  throw error;
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "failure_threshold",
    "local_failure_threshold",
    "global_failure_threshold",
    "stopping_threshold",
    "activation_threshold",
    "retrieval_threshold",
    "noise_model",
    "sampling_rule",
    "cost_model",
    "benefit_model",
    "utility_function",
    "latency_model",
    "foraging_rate_model",
    "feeling_of_knowing_model",
    "inhibition_model",
    "search_control_policy",
    "cue_shift_policy",
    "new_attempt_policy",
  ];

  for (const key of forbidden) {
    if (Object.hasOwn(object(input), key)) {
      const error = new Error(
        `Phase64A-R4D v1 does not accept caller-supplied ${key}.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_OVERRIDE_FORBIDDEN";
      error.field = key;
      throw error;
    }
  }
}

function monitorEvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r4b3_composition_evidence_id:
      evidence.source_r4b3_composition_evidence_id,
    source_r4b3_evidence_hash:
      evidence.source_r4b3_evidence_hash,
    candidate_memory_ids:
      cloneJson(
        evidence.candidate_memory_ids,
      ),
    monitoring:
      cloneJson(
        evidence.monitoring,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertOptionalR4C(
  raw,
  queryId,
  initialFrontierId,
) {
  if (
    raw === null
    || raw === undefined
  ) {
    return null;
  }

  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationRetrievalCompetitionMonitoringEvidenceVersion
  ) {
    const error = new Error(
      "Phase64A-R4D received non-canonical Phase64A-R4C monitoring evidence.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_VERSION_MISMATCH";
    throw error;
  }

  if (
    evidence.query_id !== queryId
    || evidence.source_initial_frontier_id !== initialFrontierId
  ) {
    const error = new Error(
      "Phase64A-R4D source R4C query/frontier binding mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_BINDING_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "initial_retrieval_competition_monitoring_evidence.evidence_hash",
    );

  const actualHash =
    hashAgentRunValue(
      monitorEvidenceBody(evidence),
    );

  if (actualHash !== evidenceHash) {
    const error = new Error(
      "Phase64A-R4C source evidence hash mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_retrieval_competition_monitor_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.competition_monitor_evidence_id
    !== expectedId
  ) {
    const error = new Error(
      "Phase64A-R4C source evidence id mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_ID_MISMATCH";
    throw error;
  }

  if (
    evidence.monitoring?.mode
      !== "lazy_candidate_dominance_probe_v1"
    || evidence.monitoring
      ?.candidate_probe_reports_materialized
      !== false
    || evidence.monitoring
      ?.exhaustive_pairwise_matrix_materialized
      !== false
    || evidence.monitoring
      ?.competition_winner_modeled
      !== false
    || evidence.monitoring
      ?.retrieval_probability_modeled
      !== false
    || evidence.monitoring
      ?.search_control_authority
      !== false
  ) {
    const error = new Error(
      "Phase64A-R4D requires canonical R4C evidence-only monitoring semantics.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_R4C_CONTRACT_MISMATCH";
    throw error;
  }

  return {
    evidence_hash:
      evidenceHash,
    evidence_id:
      expectedId,
  };
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
    candidate_set_hash:
      requiredString(
        frontier.candidate_set_hash,
        "source_initial_frontier.candidate_set_hash",
      ),
    candidate_count:
      nonNegativeInteger(
        frontier.candidate_count,
        "source_initial_frontier.candidate_count",
      ),
  };
}

function normalizeContactRef(raw, label) {
  const memoryId =
    typeof raw === "string"
      ? optionalString(raw)
      : optionalString(
        raw?.memory_id,
      );

  if (memoryId) return memoryId;

  const error = new Error(
    `${label} must identify a contacted memory.`,
  );
  error.code =
    "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_CONTACT_INVALID";
  throw error;
}

function normalizeFragment(raw, label) {
  const fragment = object(raw);

  return {
    fragment_id:
      requiredString(
        fragment.fragment_id,
        `${label}.fragment_id`,
      ),
    source_memory_ref:
      requiredString(
        fragment.source_memory_ref,
        `${label}.source_memory_ref`,
      ),
  };
}

function normalizeCueOption(raw, label) {
  const option = object(raw);

  return {
    cue_option_id:
      requiredString(
        option.cue_option_id,
        `${label}.cue_option_id`,
      ),
  };
}

function normalizeStep(
  raw,
  expectedIndex,
  knownCueOptionIds,
) {
  const step = object(raw);
  const stepIndex =
    nonNegativeInteger(
      step.step_index,
      `search_steps[${expectedIndex}].step_index`,
    );

  if (stepIndex !== expectedIndex) {
    const error = new Error(
      `Phase64A-R4D search step index mismatch at ${expectedIndex}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_STEP_ORDER_MISMATCH";
    throw error;
  }

  const frontier = object(
    step.frontier,
  );

  const normalizedFrontier = {
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
    candidate_set_hash:
      requiredString(
        frontier.candidate_set_hash,
        `search_steps[${expectedIndex}].frontier.candidate_set_hash`,
      ),
    candidate_count:
      nonNegativeInteger(
        frontier.candidate_count,
        `search_steps[${expectedIndex}].frontier.candidate_count`,
      ),
  };

  const contacts =
    array(
      step.contacted_candidate_refs,
    ).map(
      (ref, index) =>
        normalizeContactRef(
          ref,
          `search_steps[${expectedIndex}].contacted_candidate_refs[${index}]`,
        ),
    );

  const recoveredFragments =
    array(
      step.recovered_fragments,
    ).map(
      (fragment, index) =>
        normalizeFragment(
          fragment,
          `search_steps[${expectedIndex}].recovered_fragments[${index}]`,
        ),
    );

  const newCueOptions =
    array(
      step.new_reinstatement_cue_options,
    ).map(
      (option, index) =>
        normalizeCueOption(
          option,
          `search_steps[${expectedIndex}].new_reinstatement_cue_options[${index}]`,
        ),
    );

  for (const option of newCueOptions) {
    if (knownCueOptionIds.has(option.cue_option_id)) {
      const error = new Error(
        `Reinstatement cue option ${option.cue_option_id} was introduced more than once.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_CUE_OPTION_DUPLICATE";
      throw error;
    }

    knownCueOptionIds.add(
      option.cue_option_id,
    );
  }

  const selectedCueRefs =
    array(
      step.selected_reinstatement_cue_refs,
    ).map(
      (ref, index) =>
        requiredString(
          ref,
          `search_steps[${expectedIndex}].selected_reinstatement_cue_refs[${index}]`,
        ),
    );

  for (const selectedRef of selectedCueRefs) {
    if (!knownCueOptionIds.has(selectedRef)) {
      const error = new Error(
        `Selected reinstatement cue ${selectedRef} is not grounded in the observed search path.`,
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_CUE_SELECTION_UNGROUNDED";
      throw error;
    }
  }

  const controlAction =
    requiredString(
      step
        ?.continuation
        ?.control_action,
      `search_steps[${expectedIndex}].continuation.control_action`,
    );

  if (
    controlAction !== "continue"
    && controlAction !== "stop"
  ) {
    const error = new Error(
      `Unsupported retrieval control action ${controlAction}.`,
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_CONTROL_ACTION_INVALID";
    throw error;
  }

  const terminationAfterStep =
    step.termination_after_step
    === true;

  if (
    (
      controlAction === "stop"
      && !terminationAfterStep
    )
    || (
      controlAction === "continue"
      && terminationAfterStep
    )
  ) {
    const error = new Error(
      "Search-step termination flag does not match the observed control action.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_TERMINATION_FLAG_MISMATCH";
    throw error;
  }

  if (
    controlAction === "stop"
    && selectedCueRefs.length
  ) {
    const error = new Error(
      "A terminal search step cannot select reinstatement cues for a nonexistent next step.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_TERMINAL_CUE_SELECTION_INVALID";
    throw error;
  }

  return {
    step_index:
      stepIndex,
    frontier:
      normalizedFrontier,
    contacted_memory_refs:
      contacts,
    recovered_fragments:
      recoveredFragments,
    new_reinstatement_cue_option_ids:
      newCueOptions.map(
        (option) => option.cue_option_id,
      ),
    selected_reinstatement_cue_refs:
      selectedCueRefs,
    control_action:
      controlAction,
    termination_after_step:
      terminationAfterStep,
  };
}

function normalizeSearchPath(
  rawSteps,
  rawTermination,
) {
  const sourceSteps =
    array(rawSteps);

  if (!sourceSteps.length) {
    const error = new Error(
      "Phase64A-R4D requires at least one completed Phase63C search step.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EMPTY_PATH";
    throw error;
  }

  const knownCueOptionIds =
    new Set();

  const steps =
    sourceSteps.map(
      (step, index) =>
        normalizeStep(
          step,
          index,
          knownCueOptionIds,
        ),
    );

  for (
    let index = 0;
    index < steps.length - 1;
    index += 1
  ) {
    if (
      steps[index].control_action !== "continue"
      || steps[index].termination_after_step
    ) {
      const error = new Error(
        "Only the final observed retrieval step may terminate the process.",
      );
      error.code =
        "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EARLY_TERMINATION_MISMATCH";
      throw error;
    }
  }

  const finalStep =
    steps.at(-1);

  if (
    finalStep.control_action !== "stop"
    || !finalStep.termination_after_step
  ) {
    const error = new Error(
      "Phase64A-R4D requires an explicitly terminated Phase63C search path.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_UNTERMINATED_PATH";
    throw error;
  }

  const termination =
    object(rawTermination);

  const terminationStepIndex =
    nonNegativeInteger(
      termination.step_index,
      "termination.step_index",
    );

  if (
    terminationStepIndex
    !== finalStep.step_index
    || termination.cognitive_control_stop
      !== true
    || termination.technical_step_limit_reached
      !== false
  ) {
    const error = new Error(
      "Phase64A-R4D termination evidence is not the canonical explicit cognitive-control stop.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_TERMINATION_MISMATCH";
    throw error;
  }

  return {
    steps,
    termination: {
      reason:
        optionalString(
          termination.reason,
        ),
      step_index:
        terminationStepIndex,
      cognitive_control_stop:
        true,
      technical_step_limit_reached:
        false,
    },
  };
}

function searchPathObservationSeed(
  steps,
  termination,
) {
  return {
    steps:
      steps.map(
        (step) => ({
          step_index:
            step.step_index,
          frontier:
            cloneJson(
              step.frontier,
            ),
          contacted_memory_refs:
            cloneJson(
              step.contacted_memory_refs,
            ),
          recovered_fragments:
            cloneJson(
              step.recovered_fragments,
            ),
          new_reinstatement_cue_option_ids:
            cloneJson(
              step.new_reinstatement_cue_option_ids,
            ),
          selected_reinstatement_cue_refs:
            cloneJson(
              step.selected_reinstatement_cue_refs,
            ),
          control_action:
            step.control_action,
          termination_after_step:
            step.termination_after_step,
        }),
      ),
    termination:
      cloneJson(
        termination,
      ),
  };
}

function newEpoch(
  queryId,
  epochIndex,
  cueSetHash,
  stepIndex,
  r4cAvailable,
) {
  return {
    cue_epoch_id:
      `memory_retrieval_cue_epoch_${hashAgentRunValue({
        query_id:
          queryId,
        epoch_index:
          epochIndex,
        cue_set_hash:
          cueSetHash,
        start_step_index:
          stepIndex,
      }).slice(0, 24)}`,
    epoch_index:
      epochIndex,
    cue_set_hash:
      cueSetHash,
    cue_set_changed_from_previous_epoch:
      epochIndex > 0,
    start_step_index:
      stepIndex,
    end_step_index:
      stepIndex,
    step_count:
      0,
    contact_occurrence_count:
      0,
    recovery_fragment_occurrence_count:
      0,
    new_unique_recovered_fragment_count:
      0,
    new_unique_recovered_memory_count:
      0,
    empty_recovery_step_count:
      0,
    no_new_unique_recovery_step_count:
      0,
    trailing_empty_recovery_step_count:
      0,
    trailing_no_new_unique_recovery_step_count:
      0,
    new_grounded_reinstatement_cue_option_count:
      0,
    selected_reinstatement_cue_count:
      0,
    initial_r4c_baseline_relation:
      !r4cAvailable
        ? "not_available"
        : epochIndex === 0
          ? "initial_epoch_baseline"
          : "historical_after_cue_transition",
    _frontier_ids:
      new Set(),
    _candidate_set_hashes:
      new Set(),
    _contacts:
      new Set(),
  };
}

function finalizeEpoch(epoch) {
  return {
    cue_epoch_id:
      epoch.cue_epoch_id,
    epoch_index:
      epoch.epoch_index,
    cue_set_hash:
      epoch.cue_set_hash,
    cue_set_changed_from_previous_epoch:
      epoch.cue_set_changed_from_previous_epoch,
    start_step_index:
      epoch.start_step_index,
    end_step_index:
      epoch.end_step_index,
    step_count:
      epoch.step_count,
    frontier_id_count:
      epoch._frontier_ids.size,
    candidate_set_hash_count:
      epoch._candidate_set_hashes.size,
    contact_occurrence_count:
      epoch.contact_occurrence_count,
    unique_contacted_candidate_count:
      epoch._contacts.size,
    repeated_contact_occurrence_count:
      epoch.contact_occurrence_count
      - epoch._contacts.size,
    recovery_fragment_occurrence_count:
      epoch.recovery_fragment_occurrence_count,
    new_unique_recovered_fragment_count:
      epoch.new_unique_recovered_fragment_count,
    new_unique_recovered_memory_count:
      epoch.new_unique_recovered_memory_count,
    empty_recovery_step_count:
      epoch.empty_recovery_step_count,
    no_new_unique_recovery_step_count:
      epoch.no_new_unique_recovery_step_count,
    trailing_empty_recovery_step_count:
      epoch.trailing_empty_recovery_step_count,
    trailing_no_new_unique_recovery_step_count:
      epoch.trailing_no_new_unique_recovery_step_count,
    new_grounded_reinstatement_cue_option_count:
      epoch.new_grounded_reinstatement_cue_option_count,
    selected_reinstatement_cue_count:
      epoch.selected_reinstatement_cue_count,
    initial_r4c_baseline_relation:
      epoch.initial_r4c_baseline_relation,
  };
}

function deriveObservation(
  queryId,
  steps,
  r4cAvailable,
) {
  const cueEpochs = [];
  const seenRecoveredFragmentIds =
    new Set();
  const seenRecoveredMemoryIds =
    new Set();
  const seenContactIds =
    new Set();
  const allCueOptionIds =
    new Set();

  let currentEpoch = null;
  let processContactOccurrenceCount = 0;
  let recoveryFragmentOccurrenceCount = 0;
  let emptyRecoveryStepCount = 0;
  let noNewUniqueRecoveryStepCount = 0;
  let trailingEmptyRecoveryStepCount = 0;
  let trailingNoNewUniqueRecoveryStepCount = 0;
  let selectedReinstatementCueCount = 0;

  for (const step of steps) {
    if (
      !currentEpoch
      || currentEpoch.cue_set_hash
        !== step.frontier.active_cue_hash
    ) {
      if (currentEpoch) {
        cueEpochs.push(
          finalizeEpoch(
            currentEpoch,
          ),
        );
      }

      currentEpoch =
        newEpoch(
          queryId,
          cueEpochs.length,
          step.frontier.active_cue_hash,
          step.step_index,
          r4cAvailable,
        );
    }

    currentEpoch.end_step_index =
      step.step_index;
    currentEpoch.step_count += 1;
    currentEpoch._frontier_ids.add(
      step.frontier.frontier_id,
    );
    currentEpoch._candidate_set_hashes.add(
      step.frontier.candidate_set_hash,
    );

    currentEpoch.contact_occurrence_count +=
      step.contacted_memory_refs.length;
    processContactOccurrenceCount +=
      step.contacted_memory_refs.length;

    for (const memoryId of step.contacted_memory_refs) {
      currentEpoch._contacts.add(
        memoryId,
      );
      seenContactIds.add(
        memoryId,
      );
    }

    currentEpoch.recovery_fragment_occurrence_count +=
      step.recovered_fragments.length;
    recoveryFragmentOccurrenceCount +=
      step.recovered_fragments.length;

    let newUniqueFragmentCountThisStep = 0;
    let newUniqueMemoryCountThisStep = 0;

    for (const fragment of step.recovered_fragments) {
      if (
        !seenRecoveredFragmentIds.has(
          fragment.fragment_id,
        )
      ) {
        seenRecoveredFragmentIds.add(
          fragment.fragment_id,
        );
        newUniqueFragmentCountThisStep += 1;
      }

      if (
        !seenRecoveredMemoryIds.has(
          fragment.source_memory_ref,
        )
      ) {
        seenRecoveredMemoryIds.add(
          fragment.source_memory_ref,
        );
        newUniqueMemoryCountThisStep += 1;
      }
    }

    currentEpoch.new_unique_recovered_fragment_count +=
      newUniqueFragmentCountThisStep;
    currentEpoch.new_unique_recovered_memory_count +=
      newUniqueMemoryCountThisStep;

    if (!step.recovered_fragments.length) {
      emptyRecoveryStepCount += 1;
      currentEpoch.empty_recovery_step_count += 1;
      trailingEmptyRecoveryStepCount += 1;
      currentEpoch.trailing_empty_recovery_step_count += 1;
    } else {
      trailingEmptyRecoveryStepCount = 0;
      currentEpoch.trailing_empty_recovery_step_count = 0;
    }

    if (!newUniqueFragmentCountThisStep) {
      noNewUniqueRecoveryStepCount += 1;
      currentEpoch.no_new_unique_recovery_step_count += 1;
      trailingNoNewUniqueRecoveryStepCount += 1;
      currentEpoch.trailing_no_new_unique_recovery_step_count += 1;
    } else {
      trailingNoNewUniqueRecoveryStepCount = 0;
      currentEpoch.trailing_no_new_unique_recovery_step_count = 0;
    }

    for (
      const optionId
      of step.new_reinstatement_cue_option_ids
    ) {
      allCueOptionIds.add(
        optionId,
      );
    }

    currentEpoch.new_grounded_reinstatement_cue_option_count +=
      step.new_reinstatement_cue_option_ids.length;

    currentEpoch.selected_reinstatement_cue_count +=
      step.selected_reinstatement_cue_refs.length;

    selectedReinstatementCueCount +=
      step.selected_reinstatement_cue_refs.length;
  }

  if (currentEpoch) {
    cueEpochs.push(
      finalizeEpoch(
        currentEpoch,
      ),
    );
  }

  const finalEpoch =
    cueEpochs.at(-1);

  return {
    cue_epochs:
      cueEpochs,
    observation: {
      source_step_count:
        steps.length,
      cue_epoch_count:
        cueEpochs.length,
      cue_transition_count:
        Math.max(
          0,
          cueEpochs.length - 1,
        ),
      contact_occurrence_count:
        processContactOccurrenceCount,
      unique_contacted_candidate_count:
        seenContactIds.size,
      repeated_contact_occurrence_count:
        processContactOccurrenceCount
        - seenContactIds.size,
      recovery_fragment_occurrence_count:
        recoveryFragmentOccurrenceCount,
      unique_recovered_fragment_count:
        seenRecoveredFragmentIds.size,
      unique_recovered_memory_count:
        seenRecoveredMemoryIds.size,
      empty_recovery_step_count:
        emptyRecoveryStepCount,
      no_new_unique_recovery_step_count:
        noNewUniqueRecoveryStepCount,
      trailing_empty_recovery_step_count:
        trailingEmptyRecoveryStepCount,
      trailing_no_new_unique_recovery_step_count:
        trailingNoNewUniqueRecoveryStepCount,
      grounded_reinstatement_cue_option_count:
        allCueOptionIds.size,
      selected_reinstatement_cue_count:
        selectedReinstatementCueCount,
      actual_cue_transition_observed:
        cueEpochs.length > 1,
      any_recovery_content_observed:
        recoveryFragmentOccurrenceCount > 0,
      any_new_unique_recovery_observed:
        seenRecoveredFragmentIds.size > 0,
    },
    readiness: {
      evidence_only:
        true,
      latest_cue_epoch_index:
        finalEpoch.epoch_index,
      latest_cue_epoch_id:
        finalEpoch.cue_epoch_id,
      latest_cue_epoch_trailing_empty_recovery_step_count:
        finalEpoch.trailing_empty_recovery_step_count,
      latest_cue_epoch_trailing_no_new_unique_recovery_step_count:
        finalEpoch.trailing_no_new_unique_recovery_step_count,
      latest_cue_epoch_new_grounded_reinstatement_cue_option_count:
        finalEpoch.new_grounded_reinstatement_cue_option_count,
      grounded_reinstatement_cue_option_available_at_termination:
        allCueOptionIds.size > 0,
      initial_r4c_baseline_relation_to_latest_epoch:
        !r4cAvailable
          ? "not_available"
          : finalEpoch.epoch_index === 0
            ? "same_initial_cue_epoch_baseline"
            : "historical_after_cue_transition",
      recommended_control_action:
        null,
      recommended_reinstatement_cue_refs:
        null,
      new_attempt_readiness_decision:
        null,
    },
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
    source_initial_candidate_set_hash:
      evidence.source_initial_candidate_set_hash,
    source_search_path_observation_hash:
      evidence.source_search_path_observation_hash,
    source_r4c_competition_monitor_evidence_id:
      evidence.source_r4c_competition_monitor_evidence_id,
    source_r4c_evidence_hash:
      evidence.source_r4c_evidence_hash,
    cue_epochs:
      cloneJson(
        evidence.cue_epochs,
      ),
    observation:
      cloneJson(
        evidence.observation,
      ),
    readiness:
      cloneJson(
        evidence.readiness,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertEvidenceIntegrity(raw) {
  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationRetrievalSearchControlReadinessEvidenceVersion
  ) {
    const error = new Error(
      "Search-control readiness evidence version mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EVIDENCE_VERSION_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "retrieval_search_control_readiness_evidence.evidence_hash",
    );

  const actualHash =
    hashAgentRunValue(
      evidenceBody(evidence),
    );

  if (evidenceHash !== actualHash) {
    const error = new Error(
      "Search-control readiness evidence hash mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EVIDENCE_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_retrieval_search_control_readiness_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.search_control_readiness_evidence_id
    !== expectedId
  ) {
    const error = new Error(
      "Search-control readiness evidence id mismatch.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_EVIDENCE_ID_MISMATCH";
    throw error;
  }

  return evidence;
}

export function buildWorldSimulationRetrievalSearchControlReadinessEvidenceContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalSearchControlReadinessEvidenceVersion,
    phase:
      "Phase64A-R4D",
    status:
      "retrieval_search_control_readiness_evidence",
    source_phase63c_completed_search_path_required:
      true,
    source_phase64a_r4c_optional:
      true,
    evidence_materialization_timing:
      "post_hoc_after_explicit_phase63c_termination",
    cue_epoch_basis:
      "contiguous_active_cue_hash",
    same_cue_hash_after_intervening_epoch_opens_new_epoch:
      true,
    actual_search_path_only:
      true,
    counterfactual_search_path_modeled:
      false,
    sam_failure_semantics_claimed:
      false,
    technical_step_budget_used_as_cognitive_evidence:
      false,
    cognitive_failure_threshold_modeled:
      false,
    retrieval_cost_modeled:
      false,
    retrieval_benefit_modeled:
      false,
    utility_rate_modeled:
      false,
    retrieval_latency_modeled:
      false,
    activation_threshold_modeled:
      false,
    retrieval_noise_modeled:
      false,
    feeling_of_knowing_modeled:
      false,
    competitor_inhibition_modeled:
      false,
    competition_winner_modeled:
      false,
    retrieval_probability_modeled:
      false,
    continuation_decision_authority:
      false,
    cue_shift_selection_authority:
      false,
    stop_decision_authority:
      false,
    new_attempt_creation_authority:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    character_subjective_awareness_modeled:
      false,
    new_resolver_stage_added:
      false,
    resolver_exposure_allowed:
      false,
    full_evidence_persistence_allowed:
      false,
  });
}

export function projectWorldSimulationRetrievalSearchControlReadinessEvidence(
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

  const r4c =
    assertOptionalR4C(
      input.initial_retrieval_competition_monitoring_evidence,
      queryId,
      initialFrontier.frontier_id,
    );

  const path =
    normalizeSearchPath(
      input.search_steps,
      input.termination,
    );

  if (
    path.steps[0].frontier.frontier_id
    !== initialFrontier.frontier_id
    || path.steps[0].frontier.active_cue_hash
      !== initialFrontier.active_cue_hash
    || path.steps[0].frontier.candidate_set_hash
      !== initialFrontier.candidate_set_hash
  ) {
    const error = new Error(
      "Phase64A-R4D first search step does not match the canonical initial frontier.",
    );
    error.code =
      "WORLD_SIMULATION_RETRIEVAL_SEARCH_CONTROL_READINESS_INITIAL_FRONTIER_MISMATCH";
    throw error;
  }

  const sourceSearchPathObservationHash =
    hashAgentRunValue(
      searchPathObservationSeed(
        path.steps,
        path.termination,
      ),
    );

  const derived =
    deriveObservation(
      queryId,
      path.steps,
      Boolean(r4c),
    );

  const body = {
    schema_version:
      retrievalSearchControlReadinessEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalSearchControlReadinessEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      initialFrontier.frontier_id,
    source_initial_active_cue_hash:
      initialFrontier.active_cue_hash,
    source_initial_candidate_set_hash:
      initialFrontier.candidate_set_hash,
    source_search_path_observation_hash:
      sourceSearchPathObservationHash,
    source_r4c_competition_monitor_evidence_id:
      r4c?.evidence_id
      ?? null,
    source_r4c_evidence_hash:
      r4c?.evidence_hash
      ?? null,
    cue_epochs:
      derived.cue_epochs,
    observation:
      derived.observation,
    readiness:
      derived.readiness,
    boundaries: {
      source_is_completed_actual_search_path:
        true,
      post_hoc_after_explicit_termination:
        true,
      cue_epoch_basis:
        "contiguous_active_cue_hash",
      sam_failure_semantics_claimed:
        false,
      technical_step_budget_used_as_cognitive_evidence:
        false,
      cognitive_failure_threshold_modeled:
        false,
      retrieval_cost_benefit_modeled:
        false,
      utility_rate_modeled:
        false,
      retrieval_latency_modeled:
        false,
      activation_threshold_or_noise_modeled:
        false,
      feeling_of_knowing_modeled:
        false,
      competitor_inhibition_modeled:
        false,
      competition_winner_or_probability_modeled:
        false,
      continuation_decision_authority:
        false,
      cue_shift_selection_authority:
        false,
      stop_decision_authority:
        false,
      new_attempt_creation_authority:
        false,
      retrieval_contact_authority:
        false,
      retrieval_recovery_authority:
        false,
      character_subjective_awareness_modeled:
        false,
      resolver_exposure_allowed:
        false,
      full_evidence_persistence_allowed:
        false,
      non_contacted_r4c_candidate_ids_copied:
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
    search_control_readiness_evidence_id:
      `memory_retrieval_search_control_readiness_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function validateWorldSimulationRetrievalSearchControlReadinessEvidence(
  raw,
) {
  const evidence =
    assertEvidenceIntegrity(
      raw,
    );

  return deepFreeze(
    cloneJson(
      evidence,
    ),
  );
}
