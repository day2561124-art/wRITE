import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationRetrievalGlobalTerminationDecisionEvidenceVersion =
  "phase64a-r4f1-retrieval-global-termination-decision-evidence-v1";

export const retrievalGlobalTerminationDecisionEvidenceSchemaVersion =
  worldSimulationRetrievalGlobalTerminationDecisionEvidenceVersion;

const allowedControlActions =
  new Set([
    "continue",
    "stop",
  ]);

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
  code = "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_INVALID",
) {
  const text =
    optionalString(value);

  if (text) {
    return text;
  }

  const error =
    new Error(
      `${label} is required.`,
    );

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
    "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_INTEGER_INVALID";

  throw error;
}

function uniqueStrings(
  values,
  label,
) {
  const result = [];
  const seen =
    new Set();

  for (
    const [
      index,
      raw,
    ]
    of array(values).entries()
  ) {
    const value =
      requiredString(
        raw,
        `${label}[${index}]`,
      );

    if (seen.has(value)) {
      const error =
        new Error(
          `${label} contains duplicate value ${value}.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_DUPLICATE_REF";

      throw error;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "retrieval_search_control_readiness_evidence",
    "r4d_evidence",
    "search_control_readiness_evidence",
    "stopping_rule",
    "search_control_policy",
    "stopping_policy",
    "failure_threshold",
    "global_failure_threshold",
    "stopping_threshold",
    "activation_threshold",
    "retrieval_threshold",
    "exit_latency",
    "latency_model",
    "feeling_of_knowing",
    "feeling_of_knowing_model",
    "cost_model",
    "benefit_model",
    "utility_function",
    "foraging_rate_model",
    "retrieval_probability_model",
    "inhibition_model",
    "technical_step_budget_as_cognitive_rule",
  ];

  for (const key of forbidden) {
    if (
      Object.hasOwn(
        object(input),
        key,
      )
    ) {
      const error =
        new Error(
          `Phase64A-R4F1 does not accept caller-supplied ${key}.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_OVERRIDE_FORBIDDEN";

      error.field =
        key;

      throw error;
    }
  }
}

function normalizeEpisodeContext(
  raw,
) {
  const source =
    object(raw);

  return {
    episode_id:
      requiredString(
        source.episode_id,
        "source_episode_context.episode_id",
      ),
    episode_index:
      nonNegativeInteger(
        source.episode_index,
        "source_episode_context.episode_index",
      ),
    cue_set_hash:
      requiredString(
        source.cue_set_hash,
        "source_episode_context.cue_set_hash",
      ),
  };
}

function normalizeFrontier(
  raw,
) {
  const source =
    object(raw);

  return {
    frontier_id:
      requiredString(
        source.frontier_id,
        "source_frontier.frontier_id",
      ),
    active_cue_hash:
      requiredString(
        source.active_cue_hash,
        "source_frontier.active_cue_hash",
      ),
  };
}

function normalizeControl(
  raw,
  availableCueOptionIds,
) {
  const source =
    object(raw);

  const controlAction =
    requiredString(
      source.control_action,
      "continuation_control.control_action",
    );

  if (
    !allowedControlActions
      .has(controlAction)
  ) {
    const error =
      new Error(
        "R4F1 continuation control action must be continue or stop.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_ACTION_INVALID";

    throw error;
  }

  const selectedRefs =
    uniqueStrings(
      source.selected_reinstatement_cue_refs,
      "continuation_control.selected_reinstatement_cue_refs",
    );

  const available =
    new Set(
      availableCueOptionIds,
    );

  for (const ref of selectedRefs) {
    if (!available.has(ref)) {
      const error =
        new Error(
          `R4F1 local transition selected unavailable cue option ${ref}.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_CUE_SELECTION_UNAVAILABLE";

      throw error;
    }
  }

  if (
    controlAction === "stop"
    && selectedRefs.length
  ) {
    const error =
      new Error(
        "A global terminate decision cannot also select cues for a nonexistent next retrieval step.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_TERMINAL_LOCAL_TRANSITION_INVALID";

    throw error;
  }

  return {
    control_action:
      controlAction,
    control_reason:
      optionalString(
        source.control_reason,
      ),
    selected_reinstatement_cue_refs:
      selectedRefs,
  };
}

function evidenceBody(
  evidence,
) {
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
    step_index:
      evidence.step_index,
    source_episode_context:
      cloneJson(
        evidence.source_episode_context,
      ),
    source_frontier:
      cloneJson(
        evidence.source_frontier,
      ),
    cumulative_target_outcome_after_step:
      evidence.cumulative_target_outcome_after_step,
    available_reinstatement_cue_option_ids:
      cloneJson(
        evidence.available_reinstatement_cue_option_ids,
      ),
    global_termination_decision:
      cloneJson(
        evidence.global_termination_decision,
      ),
    local_transition:
      cloneJson(
        evidence.local_transition,
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

export function buildWorldSimulationRetrievalGlobalTerminationDecisionEvidenceContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalGlobalTerminationDecisionEvidenceVersion,
    phase:
      "Phase64A-R4F1",
    status:
      "global_termination_decision_semantics_and_provenance_v1",
    global_termination_semantics_separated_from_local_cue_transition:
      true,
    existing_phase63c_continuation_resolver_reused:
      true,
    separate_resolver_stage_added:
      false,
    resolver_control_action_is_explicit_decision_source:
      true,
    resolver_control_reason_truth_verified:
      false,
    target_outcome_is_automatic_stopping_rule:
      false,
    same_target_outcome_may_continue_or_stop:
      true,
    stopping_rule_modeled:
      false,
    exit_latency_modeled:
      false,
    feeling_of_knowing_modeled:
      false,
    retrieval_cost_benefit_modeled:
      false,
    utility_function_modeled:
      false,
    retrieval_probability_modeled:
      false,
    technical_step_budget_is_cognitive_stopping_rule:
      false,
    r4d_consumed_online:
      false,
    r4d_remains_post_hoc:
      true,
    continue_without_cue_shift_supported:
      true,
    continue_with_grounded_local_cue_transition_supported:
      true,
    terminate_with_local_cue_transition_forbidden:
      true,
    retrieval_attempt_created:
      false,
    cue_construction_authority:
      false,
    cue_selection_authority:
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
    full_evidence_persistence_allowed:
      false,
    process_hash_commitment_required:
      true,
    immutable_evidence:
      true,
  });
}

export function projectWorldSimulationRetrievalGlobalTerminationDecisionEvidence(
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

  const stepIndex =
    nonNegativeInteger(
      input.step_index,
      "step_index",
    );

  const episodeContext =
    normalizeEpisodeContext(
      input.source_episode_context,
    );

  const frontier =
    normalizeFrontier(
      input.source_frontier,
    );

  if (
    episodeContext.cue_set_hash
    !== frontier.active_cue_hash
  ) {
    const error =
      new Error(
        "R4F1 source episode cue hash does not match the current frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_EPISODE_FRONTIER_MISMATCH";

    throw error;
  }

  const availableCueOptionIds =
    uniqueStrings(
      input.available_reinstatement_cue_option_ids,
      "available_reinstatement_cue_option_ids",
    );

  const control =
    normalizeControl(
      input.continuation_control,
      availableCueOptionIds,
    );

  const targetOutcome =
    optionalString(
      input.cumulative_target_outcome_after_step,
    );

  const terminating =
    control.control_action
    === "stop";

  const body = {
    schema_version:
      retrievalGlobalTerminationDecisionEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalGlobalTerminationDecisionEvidenceVersion,
    query_id:
      queryId,
    character,
    turn_id:
      turnId,
    step_index:
      stepIndex,
    source_episode_context:
      episodeContext,
    source_frontier:
      frontier,
    cumulative_target_outcome_after_step:
      targetOutcome,
    available_reinstatement_cue_option_ids:
      availableCueOptionIds,
    global_termination_decision: {
      scope:
        "global_retrieval_process",
      action:
        terminating
          ? "terminate_search"
          : "continue_search",
      source:
        "existing_phase63c_continuation_resolver_explicit_control_action",
      resolver_control_action:
        control.control_action,
      resolver_control_reason:
        control.control_reason,
      resolver_control_reason_truth_verified:
        false,
      target_outcome_used_as_automatic_rule:
        false,
      algorithmic_stopping_rule_applied:
        false,
    },
    local_transition: {
      applicable:
        !terminating,
      selected_reinstatement_cue_refs:
        cloneJson(
          control.selected_reinstatement_cue_refs,
        ),
      selected_reinstatement_cue_count:
        control
          .selected_reinstatement_cue_refs
          .length,
      cue_shift_required_for_continue:
        false,
      creates_new_retrieval_attempt:
        false,
    },
    observation: {
      terminating,
      continues:
        !terminating,
      local_cue_transition_selected:
        control
          .selected_reinstatement_cue_refs
          .length > 0,
      continue_without_cue_shift:
        !terminating
        && control
          .selected_reinstatement_cue_refs
          .length === 0,
    },
    boundaries: {
      global_termination_semantics_separated_from_local_cue_transition:
        true,
      separate_resolver_stage_added:
        false,
      target_outcome_is_automatic_stopping_rule:
        false,
      stopping_rule_modeled:
        false,
      exit_latency_modeled:
        false,
      feeling_of_knowing_modeled:
        false,
      retrieval_cost_benefit_modeled:
        false,
      utility_function_modeled:
        false,
      retrieval_probability_modeled:
        false,
      technical_step_budget_is_cognitive_stopping_rule:
        false,
      r4d_consumed_online:
        false,
      r4d_remains_post_hoc:
        true,
      retrieval_attempt_created:
        false,
      cue_construction_authority:
        false,
      cue_selection_authority:
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
    global_termination_decision_evidence_id:
      `memory_retrieval_global_termination_decision_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function validateWorldSimulationRetrievalGlobalTerminationDecisionEvidence(
  evidence,
) {
  const source =
    object(evidence);

  if (
    source.version
    !== worldSimulationRetrievalGlobalTerminationDecisionEvidenceVersion
  ) {
    const error =
      new Error(
        "R4F1 global termination decision evidence version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_VERSION_MISMATCH";

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
        "R4F1 global termination decision evidence hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_EVIDENCE_HASH_MISMATCH";

    throw error;
  }

  const expectedId =
    `memory_retrieval_global_termination_decision_${actualHash.slice(0, 24)}`;

  if (
    source
      .global_termination_decision_evidence_id
    !== expectedId
  ) {
    const error =
      new Error(
        "R4F1 global termination decision evidence id mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_EVIDENCE_ID_MISMATCH";

    throw error;
  }

  return deepFreeze(
    cloneJson(
      source,
    ),
  );
}

export function assertWorldSimulationRetrievalGlobalTerminationDecisionSequence(
  input = {},
) {
  const decisions =
    array(
      input.decision_evidence,
    ).map(
      validateWorldSimulationRetrievalGlobalTerminationDecisionEvidence,
    );

  const steps =
    array(
      input.search_steps,
    );

  if (
    decisions.length
    !== steps.length
  ) {
    const error =
      new Error(
        "R4F1 decision evidence must cover every completed Phase63C search step exactly once.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_SEQUENCE_COVERAGE_MISMATCH";

    throw error;
  }

  decisions.forEach(
    (
      evidence,
      index,
    ) => {
      const step =
        object(
          steps[index],
        );

      if (
        evidence.step_index
          !== index
        || step.step_index
          !== index
      ) {
        const error =
          new Error(
            `R4F1 step order mismatch at ${index}.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_SEQUENCE_ORDER_MISMATCH";

        throw error;
      }

      const stepAction =
        requiredString(
          step
            .continuation
            ?.control_action,
          `search_steps[${index}].continuation.control_action`,
        );

      if (
        evidence
          .global_termination_decision
          .resolver_control_action
        !== stepAction
      ) {
        const error =
          new Error(
            `R4F1 decision/Phase63C step action mismatch at ${index}.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_SEQUENCE_ACTION_MISMATCH";

        throw error;
      }

      const shouldTerminate =
        index
        === decisions.length - 1;

      if (
        shouldTerminate
        !== (
          evidence
            .global_termination_decision
            .action
          === "terminate_search"
        )
      ) {
        const error =
          new Error(
            "R4F1 requires exactly the final completed search step to carry the global terminate decision.",
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_GLOBAL_TERMINATION_DECISION_SEQUENCE_TERMINATION_MISMATCH";

        throw error;
      }
    },
  );

  return deepFreeze({
    verified:
      true,
    decision_count:
      decisions.length,
    continue_decision_count:
      decisions.filter(
        (evidence) =>
          evidence
            .global_termination_decision
            .action
          === "continue_search",
      ).length,
    terminate_decision_count:
      decisions.filter(
        (evidence) =>
          evidence
            .global_termination_decision
            .action
          === "terminate_search",
      ).length,
    final_step_terminates:
      true,
  });
}
