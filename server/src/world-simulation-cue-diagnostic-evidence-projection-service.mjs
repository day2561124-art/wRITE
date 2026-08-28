import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  worldSimulationMemoryAccessibilityVersion,
} from "./world-simulation-memory-accessibility-service.mjs";

export const worldSimulationCueDiagnosticEvidenceProjectionVersion =
  "phase64a-query-relative-cue-diagnostic-evidence-projection-v1";

export const cueDiagnosticEvidenceProjectionModelProfileSchemaVersion =
  "phase64a-r4a-cue-diagnostic-evidence-model-profile-v1";

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
  code = "WORLD_SIMULATION_CUE_DIAGNOSTIC_EVIDENCE_INVALID",
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

function memoryIdFor(
  record,
  label,
) {
  if (!isObject(record)) {
    const error =
      new Error(
        `${label} must be an object.`,
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_MEMORY_INVALID";

    throw error;
  }

  return requiredString(
    record.memory_id
      ?? record.id,
    `${label}.memory_id`,
    "WORLD_SIMULATION_CUE_DIAGNOSTIC_MEMORY_ID_REQUIRED",
  );
}

function cueIdentity(cue) {
  return JSON.stringify([
    cue?.kind
      ?? null,
    cue?.value
      ?? null,
  ]);
}

function finiteUnitOrNull(
  value,
  label,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
    || number < 0
    || number > 1
  ) {
    const error =
      new Error(
        `${label} must be null or a finite number between 0 and 1.`,
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_ASSOCIATION_STRENGTH_INVALID";

    throw error;
  }

  return number;
}

function positiveSafeInteger(
  value,
  label,
  code = "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_INVALID",
) {
  const number =
    Number(value);

  if (
    Number.isSafeInteger(number)
    && number > 0
  ) {
    return number;
  }

  const error =
    new Error(
      `${label} must be a positive safe integer.`,
    );

  error.code =
    code;

  throw error;
}

function nonNegativeSafeInteger(
  value,
  label,
  code = "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_INVALID",
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
    code;

  throw error;
}

const modelProfile =
  deepFreeze({
    schema_version:
      cueDiagnosticEvidenceProjectionModelProfileSchemaVersion,

    model_mode:
      "query_relative_cue_diagnostic_evidence_v1",

    source_phase63b_version:
      worldSimulationMemoryAccessibilityVersion,

    source_phase63b_model_mode:
      "cue_dependent_v2",

    selectivity_transform:
      "1 / candidate_fan_out",

    selectivity_share_is_query_local_diagnostic_transform:
      true,

    selectivity_share_is_recall_probability:
      false,

    selectivity_share_is_actr_association_strength:
      false,

    selectivity_share_is_sam_association_probability:
      false,

    whole_frontier_size_normalization_used:
      false,

    cue_match_count_bonus_used:
      false,

    cue_diagnosticity_aggregation_used:
      false,

    cue_conditional_independence_assumed:
      false,

    attention_weight_inferred:
      false,

    association_strength_aggregate_inferred:
      false,

    missing_association_strength_defaults_to_one:
      false,

    compound_cue_group_inferred:
      false,

    scalar_cue_activation_modeled:
      false,

    candidate_membership_change_allowed:
      false,

    candidate_order_change_allowed:
      false,

    persistent_memory_mutation_allowed:
      false,

    memory_content_rewrite_allowed:
      false,

    retrieval_success_decision_owned:
      false,

    character_brain_exposure_allowed:
      false,

    retrieval_resolver_selectivity_scalar_exposure_allowed:
      false,

    evidence_scope:
      "frontier_local_query_conditioned_ephemeral",
  });

export const cueDiagnosticEvidenceProjectionModelProfileHash =
  hashAgentRunValue(
    modelProfile,
  );

function validatePhase63BQuery(
  rawQuery,
) {
  const query =
    object(rawQuery);

  if (
    query.memory_accessibility_version
    !== worldSimulationMemoryAccessibilityVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4A requires the canonical Phase63B memory accessibility query.",
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_PHASE63B_VERSION_MISMATCH";

    throw error;
  }

  const result =
    object(
      query.result,
    );

  const audit =
    object(
      query.audit,
    );

  const resultHash =
    hashAgentRunValue(
      result,
    );

  if (
    optionalString(
      audit.result_hash,
    )
    !== resultHash
  ) {
    const error =
      new Error(
        "Phase64A-R4A Phase63B result hash does not match its audit evidence.",
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_PHASE63B_RESULT_HASH_MISMATCH";

    error.expected =
      audit.result_hash
      ?? null;

    error.actual =
      resultHash;

    throw error;
  }

  if (
    optionalString(
      audit.version,
    )
    !== worldSimulationMemoryAccessibilityVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4A Phase63B audit version does not match the canonical accessibility version.",
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_PHASE63B_AUDIT_VERSION_MISMATCH";

    throw error;
  }

  return {
    query,
    result,
    audit,
    result_hash:
      resultHash,
  };
}

function candidateSnapshot(
  result,
) {
  const candidateRecords =
    array(
      result.candidate_memory_records,
    );

  const candidateIds = [];
  const candidateSet =
    new Set();

  candidateRecords.forEach(
    (
      record,
      index,
    ) => {
      const memoryId =
        memoryIdFor(
          record,
          `candidate_memory_records[${index}]`,
        );

      if (
        candidateSet.has(memoryId)
      ) {
        const error =
          new Error(
            `Duplicate candidate memory id ${memoryId}.`,
          );

        error.code =
          "WORLD_SIMULATION_CUE_DIAGNOSTIC_CANDIDATE_DUPLICATE";

        throw error;
      }

      candidateIds.push(
        memoryId,
      );

      candidateSet.add(
        memoryId,
      );
    },
  );

  return {
    candidate_records:
      cloneJson(
        candidateRecords,
      ),
    candidate_ids:
      candidateIds,
    candidate_set:
      candidateSet,
  };
}

function activeCueIndex(
  result,
) {
  const activeCues =
    array(
      result.active_retrieval_cues,
    );

  const byIdentity =
    new Map();

  for (
    const [
      index,
      cue,
    ]
    of activeCues.entries()
  ) {
    const identity =
      cueIdentity(
        cue,
      );

    if (
      byIdentity.has(identity)
    ) {
      const error =
        new Error(
          `Duplicate canonical active cue identity at index ${index}: ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_ACTIVE_CUE_DUPLICATE";

      throw error;
    }

    byIdentity.set(
      identity,
      cloneJson(
        cue,
      ),
    );
  }

  return {
    active_cues:
      cloneJson(
        activeCues,
      ),
    by_identity:
      byIdentity,
  };
}

function candidateEvaluationIndex(
  result,
  candidateIds,
) {
  const evaluations =
    array(
      result.candidate_evaluations,
    );

  const candidateIdSet =
    new Set(
      candidateIds,
    );

  const byId =
    new Map();

  for (
    const [
      index,
      evaluation,
    ]
    of evaluations.entries()
  ) {
    if (!isObject(evaluation)) {
      const error =
        new Error(
          `candidate_evaluations[${index}] must be an object.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_EVALUATION_INVALID";

      throw error;
    }

    const memoryId =
      optionalString(
        evaluation.memory_id,
      );

    if (
      !memoryId
      || !candidateIdSet.has(
        memoryId,
      )
    ) {
      continue;
    }

    if (
      byId.has(memoryId)
    ) {
      const error =
        new Error(
          `Duplicate candidate evaluation for ${memoryId}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_EVALUATION_DUPLICATE";

      throw error;
    }

    if (
      evaluation.candidate_eligible
      !== true
    ) {
      const error =
        new Error(
          `Candidate memory ${memoryId} is not marked candidate_eligible in its Phase63B evaluation.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_CANDIDATE_EVALUATION_INCONSISTENT";

      throw error;
    }

    byId.set(
      memoryId,
      cloneJson(
        evaluation,
      ),
    );
  }

  for (
    const memoryId
    of candidateIds
  ) {
    if (
      !byId.has(memoryId)
    ) {
      const error =
        new Error(
          `Missing Phase63B candidate evaluation for ${memoryId}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_EVALUATION_MISSING";

      throw error;
    }
  }

  return byId;
}

function matchingMemoryAssociationRecords(
  evaluation,
  identity,
) {
  return array(
    evaluation.memory_cue_links,
  )
    .filter(
      (link) =>
        cueIdentity(link)
        === identity,
    )
    .map(
      (
        link,
        index,
      ) => ({
        source:
          optionalString(
            link?.source,
          ),
        association_evidence:
          cloneJson(
            link
              ?.association_evidence
            ?? null,
          ),
        association_strength:
          finiteUnitOrNull(
            link
              ?.association_strength,
            `memory_cue_links[${index}].association_strength`,
          ),
      }),
    );
}

function normalizedUniqueStrings(
  values,
) {
  return [
    ...new Set(
      array(values)
        .map(
          optionalString,
        )
        .filter(Boolean),
    ),
  ];
}

function cueEvidenceForCandidate({
  memoryId,
  evaluation,
  activeCueByIdentity,
  candidateSet,
}) {
  const matches =
    array(
      evaluation.cue_matches,
    );

  const competitions =
    array(
      evaluation.cue_competition,
    );

  const competitionByIdentity =
    new Map();

  for (
    const [
      index,
      competition,
    ]
    of competitions.entries()
  ) {
    const identity =
      requiredString(
        competition
          ?.cue_identity,
        `cue_competition[${index}].cue_identity`,
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_IDENTITY_REQUIRED",
      );

    if (
      competitionByIdentity
        .has(identity)
    ) {
      const error =
        new Error(
          `Duplicate cue competition evidence for ${memoryId} / ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_DUPLICATE";

      throw error;
    }

    competitionByIdentity.set(
      identity,
      competition,
    );
  }

  const result = [];
  const seenMatchIdentities =
    new Set();

  for (
    const [
      matchIndex,
      match,
    ]
    of matches.entries()
  ) {
    const identity =
      requiredString(
        match
          ?.cue_identity,
        `cue_matches[${matchIndex}].cue_identity`,
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_MATCH_IDENTITY_REQUIRED",
      );

    if (
      seenMatchIdentities.has(
        identity,
      )
    ) {
      const error =
        new Error(
          `Duplicate cue match evidence for ${memoryId} / ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_MATCH_DUPLICATE";

      throw error;
    }

    seenMatchIdentities.add(
      identity,
    );

    const activeCue =
      activeCueByIdentity.get(
        identity,
      );

    if (!activeCue) {
      const error =
        new Error(
          `Cue match ${identity} for ${memoryId} is not grounded in the current Phase63B active cue set.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_ACTIVE_CUE_GROUNDING_MISMATCH";

      throw error;
    }

    const competition =
      competitionByIdentity.get(
        identity,
      );

    if (!competition) {
      const error =
        new Error(
          `Cue match ${identity} for ${memoryId} has no matching competition evidence.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_MISSING";

      throw error;
    }

    const fanOut =
      positiveSafeInteger(
        competition
          .candidate_fan_out,
        "candidate_fan_out",
      );

    const competingIds =
      normalizedUniqueStrings(
        competition
          .competing_memory_ids,
      );

    if (
      competingIds.length
      !== array(
        competition
          .competing_memory_ids,
      ).length
    ) {
      const error =
        new Error(
          `Cue competition for ${memoryId} / ${identity} contains duplicate or invalid competitor ids.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITOR_SET_INVALID";

      throw error;
    }

    const competingCount =
      nonNegativeSafeInteger(
        competition
          .competing_candidate_count,
        "competing_candidate_count",
      );

    if (
      competingCount
      !== competingIds.length
      || fanOut
      !== competingCount + 1
    ) {
      const error =
        new Error(
          `Cue competition counts are inconsistent for ${memoryId} / ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_COMPETITION_COUNT_MISMATCH";

      throw error;
    }

    if (
      competingIds.includes(
        memoryId,
      )
    ) {
      const error =
        new Error(
          `Cue competition for ${memoryId} / ${identity} includes the candidate itself.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_SELF_COMPETITOR";

      throw error;
    }

    for (
      const competitorId
      of competingIds
    ) {
      if (
        !candidateSet.has(
          competitorId,
        )
      ) {
        const error =
          new Error(
            `Cue competition for ${memoryId} / ${identity} references non-candidate ${competitorId}.`,
          );

        error.code =
          "WORLD_SIMULATION_CUE_DIAGNOSTIC_UNKNOWN_COMPETITOR";

        throw error;
      }
    }

    const expectedDiagnosticity =
      fanOut === 1
        ? "unique_within_current_query"
        : "shared_within_current_query";

    if (
      competition
        .diagnosticity
      !== expectedDiagnosticity
    ) {
      const error =
        new Error(
          `Cue diagnosticity label is inconsistent for ${memoryId} / ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_LABEL_MISMATCH";

      throw error;
    }

    if (
      competition
        .numeric_penalty_applied
      !== false
    ) {
      const error =
        new Error(
          `Phase64A-R4A requires unpenalized Phase63B cue competition evidence for ${memoryId} / ${identity}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_PHASE63B_NUMERIC_PENALTY_UNSUPPORTED";

      throw error;
    }

    const memoryAssociationRecords =
      matchingMemoryAssociationRecords(
        evaluation,
        identity,
      );

    const explicitAssociationStrengthValues =
      memoryAssociationRecords
        .map(
          (record) =>
            record
              .association_strength,
        )
        .filter(
          (value) =>
            value !== null,
        );

    result.push({
      cue_identity:
        identity,

      kind:
        match.kind
        ?? activeCue.kind
        ?? null,

      value:
        cloneJson(
          match.value
          ?? activeCue.value
          ?? null,
        ),

      active_source:
        optionalString(
          match.active_source
          ?? activeCue.source,
        ),

      active_sources:
        normalizedUniqueStrings([
          ...array(
            match.active_sources,
          ),
          ...array(
            activeCue.sources,
          ),
          match.active_source,
          activeCue.source,
        ]),

      memory_sources:
        normalizedUniqueStrings(
          match.memory_sources,
        ),

      memory_association_records:
        memoryAssociationRecords,

      candidate_fan_out:
        fanOut,

      competing_candidate_count:
        competingCount,

      competing_memory_ids:
        cloneJson(
          competingIds,
        ),

      diagnosticity:
        expectedDiagnosticity,

      query_relative_selectivity_share:
        1 / fanOut,

      explicit_association_strength_values:
        cloneJson(
          explicitAssociationStrengthValues,
        ),

      association_strength_aggregate:
        null,

      attention_weight:
        null,

      compound_group:
        null,

      scalar_cue_activation:
        null,

      selectivity_share_is_recall_probability:
        false,

      selectivity_share_is_actr_association_strength:
        false,
    });
  }

  if (
    competitionByIdentity.size
    !== seenMatchIdentities.size
  ) {
    const unexpected =
      [
        ...competitionByIdentity
          .keys(),
      ].filter(
        (identity) =>
          !seenMatchIdentities
            .has(identity),
      );

    if (
      unexpected.length
    ) {
      const error =
        new Error(
          `Phase63B cue competition includes entries without matching cue evidence for ${memoryId}: ${unexpected.join(", ")}.`,
        );

      error.code =
        "WORLD_SIMULATION_CUE_DIAGNOSTIC_ORPHAN_COMPETITION";

      throw error;
    }
  }

  return result;
}

function projectNativeEvidence(
  result,
) {
  const snapshot =
    candidateSnapshot(
      result,
    );

  const active =
    activeCueIndex(
      result,
    );

  const evaluationById =
    candidateEvaluationIndex(
      result,
      snapshot
        .candidate_ids,
    );

  const candidateEvidence =
    snapshot
      .candidate_ids
      .map(
        (
          memoryId,
          candidateIndex,
        ) => {
          const evaluation =
            evaluationById.get(
              memoryId,
            );

          const cueEvidence =
            cueEvidenceForCandidate({
              memoryId,
              evaluation,
              activeCueByIdentity:
                active.by_identity,
              candidateSet:
                snapshot
                  .candidate_set,
            });

          return {
            memory_id:
              memoryId,

            candidate_index:
              candidateIndex,

            cue_evidence_count:
              cueEvidence.length,

            cue_evidence:
              cueEvidence,

            candidate_scalar_cue_activation:
              null,

            cue_diagnosticity_aggregate:
              null,

            attention_weight_aggregate:
              null,
          };
        },
      );

  return {
    active_cues:
      active
        .active_cues,

    candidate_ids:
      snapshot
        .candidate_ids,

    candidate_evidence:
      candidateEvidence,
  };
}

export function buildWorldSimulationCueDiagnosticEvidenceProjectionContract() {
  return deepFreeze({
    version:
      worldSimulationCueDiagnosticEvidenceProjectionVersion,

    phase:
      "Phase64A-R4A",

    status:
      "query_relative_cue_diagnostic_evidence_projection_installed",

    model_profile_schema_version:
      cueDiagnosticEvidenceProjectionModelProfileSchemaVersion,

    model_profile_hash:
      cueDiagnosticEvidenceProjectionModelProfileHash,

    model_profile:
      cloneJson(
        modelProfile,
      ),

    source_phase63b_version:
      worldSimulationMemoryAccessibilityVersion,

    source_phase63b_result_hash_verified:
      true,

    source_phase63b_candidate_membership_preserved:
      true,

    source_phase63b_candidate_order_preserved:
      true,

    query_relative_selectivity_transform:
      "1 / candidate_fan_out",

    whole_frontier_size_normalization_used:
      false,

    cue_diagnosticity_aggregation_used:
      false,

    attention_weight_inferred:
      false,

    association_strength_aggregate_inferred:
      false,

    scalar_cue_activation_modeled:
      false,

    retrieval_probability_modeled:
      false,

    candidate_membership_owner:
      "Phase63B",

    actual_retrieval_process_owner:
      "Phase63C",

    future_associative_activation_composition_owner:
      "Phase64A-R4B-or-later",

    evidence_scope:
      "frontier_local_query_conditioned_ephemeral",

    dynamic_frontier_recomputation_required:
      true,

    persistent_memory_mutation_installed:
      false,

    character_brain_evidence_exposure_installed:
      false,

    retrieval_resolver_selectivity_scalar_exposure_installed:
      false,
  });
}

export function projectWorldSimulationCueDiagnosticEvidence(
  input = {},
) {
  const source =
    validatePhase63BQuery(
      input.memory_accessibility_query,
    );

  const modelMode =
    optionalString(
      source
        .result
        .model_mode,
    );

  const snapshot =
    candidateSnapshot(
      source.result,
    );

  const applicable =
    modelMode
    === "cue_dependent_v2";

  const projected =
    applicable
      ? projectNativeEvidence(
        source.result,
      )
      : {
        active_cues: [],
        candidate_ids:
          snapshot
            .candidate_ids,
        candidate_evidence: [],
      };

  if (
    JSON.stringify(
      projected
        .candidate_ids,
    )
    !== JSON.stringify(
      snapshot
        .candidate_ids,
    )
  ) {
    const error =
      new Error(
        "Phase64A-R4A changed Phase63B candidate membership or order.",
      );

    error.code =
      "WORLD_SIMULATION_CUE_DIAGNOSTIC_CANDIDATE_ORDER_MUTATION";

    throw error;
  }

  const activeCueHash =
    hashAgentRunValue(
      projected
        .active_cues,
    );

  const candidateSetHash =
    hashAgentRunValue(
      snapshot
        .candidate_records,
    );

  const evidenceHash =
    hashAgentRunValue(
      projected
        .candidate_evidence,
    );

  const projectionId =
    `cue_diagnostic_evidence_projection_${hashAgentRunValue({
      version:
        worldSimulationCueDiagnosticEvidenceProjectionVersion,
      model_profile_hash:
        cueDiagnosticEvidenceProjectionModelProfileHash,
      source_phase63b_result_hash:
        source.result_hash,
      model_mode:
        modelMode,
      active_cue_hash:
        activeCueHash,
      candidate_set_hash:
        candidateSetHash,
      candidate_ids:
        snapshot.candidate_ids,
      evidence_hash:
        evidenceHash,
      applicable,
    }).slice(0, 24)}`;

  const audit = {
    version:
      worldSimulationCueDiagnosticEvidenceProjectionVersion,

    projection_id:
      projectionId,

    source_phase63b_version:
      source
        .query
        .memory_accessibility_version,

    source_phase63b_result_hash:
      source
        .result_hash,

    model_mode:
      modelMode,

    applicable,

    not_applicable_reason:
      applicable
        ? null
        : "phase63b_model_mode_not_cue_dependent_v2",

    candidate_count:
      snapshot
        .candidate_ids
        .length,

    active_cue_count:
      projected
        .active_cues
        .length,

    candidate_evidence_count:
      projected
        .candidate_evidence
        .length,

    source_phase63b_result_hash_verified:
      true,

    candidate_membership_preserved:
      true,

    candidate_order_preserved:
      true,

    scalar_candidate_activation_produced:
      false,

    cue_diagnosticity_aggregated:
      false,

    attention_weight_inferred:
      false,

    persistent_memory_mutated:
      false,

    resolver_selectivity_scalar_exposed:
      false,

    character_brain_evidence_exposed:
      false,

    evidence_hash:
      evidenceHash,
  };

  audit.audit_hash =
    hashAgentRunValue(
      audit,
    );

  return deepFreeze({
    version:
      worldSimulationCueDiagnosticEvidenceProjectionVersion,

    projection_id:
      projectionId,

    model_profile_schema_version:
      cueDiagnosticEvidenceProjectionModelProfileSchemaVersion,

    model_profile_hash:
      cueDiagnosticEvidenceProjectionModelProfileHash,

    source_phase63b_version:
      source
        .query
        .memory_accessibility_version,

    source_phase63b_result_hash:
      source
        .result_hash,

    model_mode:
      modelMode,

    applicable,

    not_applicable_reason:
      audit
        .not_applicable_reason,

    active_cue_hash:
      activeCueHash,

    candidate_set_hash:
      candidateSetHash,

    candidate_memory_ids:
      cloneJson(
        snapshot
          .candidate_ids,
      ),

    candidate_evidence:
      cloneJson(
        projected
          .candidate_evidence,
      ),

    evidence_hash:
      evidenceHash,

    boundaries: {
      evidence_is_frontier_local:
        true,

      evidence_is_query_conditioned:
        true,

      evidence_is_ephemeral:
        true,

      candidate_membership_changed:
        false,

      candidate_order_changed:
        false,

      retrieval_probability_claimed:
        false,

      attention_weight_inferred:
        false,

      association_strength_aggregate_inferred:
        false,

      scalar_cue_activation_modeled:
        false,

      resolver_selectivity_scalar_exposed:
        false,

      character_brain_evidence_exposed:
        false,

      persistent_memory_mutated:
        false,
    },

    audit,
  });
}
