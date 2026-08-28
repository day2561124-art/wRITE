import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  retrievalPracticeActivationProjectionModelProfileHash,
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "./world-simulation-retrieval-practice-activation-projection-service.mjs";

export const worldSimulationBaseLevelActivationProjectionVersion =
  "phase64a-base-level-activation-composition-projection-v1";

export const baseLevelActivationProjectionModelProfileSchemaVersion =
  "phase64a-base-level-activation-model-profile-v1";

const activationDecayExponent = 0.5;
const minimumTraceAgeSeconds = 1;
const baseLevelConstant = 0;
const scoreTieEpsilon = 1e-12;

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
  code = "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_INVALID",
) {
  const text = optionalString(value);

  if (text) return text;

  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function timestampMs(value) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function finiteNonNegativeNumber(
  value,
  label,
  code = "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_EVIDENCE_INVALID",
) {
  const number = Number(value);

  if (
    !Number.isFinite(number)
    || number < 0
  ) {
    const error = new Error(
      `${label} must be a finite non-negative number.`,
    );
    error.code = code;
    throw error;
  }

  return number;
}

function memoryIdFor(record, index) {
  if (!isObject(record)) {
    const error = new Error(
      `memory_records[${index}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_MEMORY_INVALID";
    throw error;
  }

  return requiredString(
    record.memory_id
      ?? record.id,
    `memory_records[${index}].memory_id`,
    "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_MEMORY_ID_REQUIRED",
  );
}

const modelProfile =
  deepFreeze({
    schema_version:
      baseLevelActivationProjectionModelProfileSchemaVersion,

    model_mode:
      "act_r_inspired_episodic_base_level_projection_v1",

    source_retrieval_practice_activation_version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,

    source_retrieval_practice_model_profile_hash:
      retrievalPracticeActivationProjectionModelProfileHash,

    base_level_equation:
      "ln(max(encoding_age_seconds,1)^-0.5 + phase64a_r2_activation_mass) + 0",

    activation_decay_exponent:
      activationDecayExponent,

    minimum_trace_age_seconds:
      minimumTraceAgeSeconds,

    base_level_constant:
      baseLevelConstant,

    initial_encoding_counts_as_one_presentation:
      true,

    successful_retrieval_practice_mass_reused_from_phase64a_r2:
      true,

    phase64a_r1_history_read_directly:
      false,

    score_level_addition_used:
      false,

    mass_level_composition_used:
      true,

    exact_act_r_chunk_merge_semantics_implemented:
      false,

    repeated_perceptual_encounter_auto_merging:
      false,

    per_memory_base_level_constant_inferred:
      false,

    perceptual_certainty_used_as_base_level_constant:
      false,

    perceptual_clarity_used_as_base_level_constant:
      false,

    variable_presentation_specific_decay_modeled:
      false,

    decay_exponent_is_universal_human_constant:
      false,

    activation_score_is_literal_human_recall_probability:
      false,

    activation_score_is_simulator_priority_signal:
      true,

    missing_encoding_time_policy:
      "pin_r2_projected_slot_without_cross_score_comparison",

    future_encoding_time_policy:
      "fail_closed",

    invalid_encoding_time_policy:
      "fail_closed",

    candidate_membership_change_allowed:
      false,

    cue_scope_expansion_allowed:
      false,

    semantic_similarity_expansion_allowed:
      false,

    stored_memory_content_rewrite_allowed:
      false,

    persistent_memory_order_rewrite_allowed:
      false,

    storage_strength_mutation_allowed:
      false,

    retrieval_strength_mutation_allowed:
      false,

    consolidation_modeled:
      false,

    reconsolidation_modeled:
      false,

    source_confusion_modeled:
      false,
  });

export const baseLevelActivationProjectionModelProfileHash =
  hashAgentRunValue(
    modelProfile,
  );

function validateMemorySnapshot(records) {
  const snapshot = [];
  const byId = new Map();

  array(records).forEach(
    (record, index) => {
      const memoryId =
        memoryIdFor(
          record,
          index,
        );

      if (byId.has(memoryId)) {
        const error = new Error(
          `Duplicate memory_id in base-level activation snapshot: ${memoryId}.`,
        );
        error.code =
          "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_MEMORY_DUPLICATE";
        throw error;
      }

      const entry = {
        memory_id:
          memoryId,
        original_index:
          index,
        record:
          cloneJson(record),
      };

      snapshot.push(entry);
      byId.set(
        memoryId,
        entry,
      );
    },
  );

  return {
    snapshot,
    by_id:
      byId,
  };
}

function assertExactIds(
  actual,
  expected,
  label,
  code,
) {
  const left = array(actual);
  const right = array(expected);

  if (
    left.length !== right.length
    || left.some(
      (value, index) =>
        String(value)
        !== String(right[index]),
    )
  ) {
    const error = new Error(
      `${label} does not match the authoritative memory snapshot.`,
    );
    error.code = code;
    error.actual = cloneJson(left);
    error.expected = cloneJson(right);
    throw error;
  }
}

function assertPermutation(
  values,
  expectedIds,
  label,
  code,
) {
  const actual =
    array(values).map(
      (value) =>
        requiredString(
          value,
          `${label}[]`,
          code,
        ),
    );

  const expected =
    array(expectedIds).map(String);

  if (actual.length !== expected.length) {
    const error = new Error(
      `${label} must preserve memory count.`,
    );
    error.code = code;
    throw error;
  }

  const actualSet =
    new Set(actual);

  const expectedSet =
    new Set(expected);

  if (
    actualSet.size !== actual.length
    || expectedSet.size !== expected.length
    || actual.some(
      (memoryId) =>
        !expectedSet.has(memoryId),
    )
  ) {
    const error = new Error(
      `${label} must be an exact permutation of authoritative memory ids.`,
    );
    error.code = code;
    throw error;
  }

  return actual;
}

function validateR2Projection(
  rawProjection,
  authoritative,
) {
  const projection =
    object(rawProjection);

  if (
    projection.version
    !== worldSimulationRetrievalPracticeActivationProjectionVersion
  ) {
    const error = new Error(
      "Phase64A-R3 requires the canonical Phase64A-R2 retrieval-practice activation projection.",
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_VERSION_MISMATCH";
    throw error;
  }

  if (
    projection.model_profile_hash
    !== retrievalPracticeActivationProjectionModelProfileHash
  ) {
    const error = new Error(
      "Phase64A-R3 source R2 model profile hash does not match the installed canonical profile.",
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_PROFILE_MISMATCH";
    throw error;
  }

  const authoritativeIds =
    authoritative.snapshot.map(
      (entry) =>
        entry.memory_id,
    );

  assertExactIds(
    projection.input_memory_ids,
    authoritativeIds,
    "Phase64A-R2 input_memory_ids",
    "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_INPUT_SNAPSHOT_MISMATCH",
  );

  const projectedIds =
    assertPermutation(
      projection.projected_memory_ids,
      authoritativeIds,
      "Phase64A-R2 projected_memory_ids",
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_PROJECTED_IDS_INVALID",
    );

  const projectedRecords =
    array(
      projection.projected_memory_records,
    );

  if (
    projectedRecords.length
    !== projectedIds.length
  ) {
    const error = new Error(
      "Phase64A-R2 projected_memory_records count does not match projected_memory_ids.",
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_PROJECTED_RECORDS_INVALID";
    throw error;
  }

  const projectedRecordIds =
    projectedRecords.map(
      (record, index) =>
        memoryIdFor(
          record,
          index,
        ),
    );

  assertExactIds(
    projectedRecordIds,
    projectedIds,
    "Phase64A-R2 projected_memory_records",
    "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_PROJECTED_RECORDS_INVALID",
  );

  const evidenceById =
    new Map();

  for (
    const [index, evidence]
    of array(
      projection.activation_evidence,
    ).entries()
  ) {
    if (!isObject(evidence)) {
      const error = new Error(
        `Phase64A-R2 activation_evidence[${index}] must be an object.`,
      );
      error.code =
        "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_EVIDENCE_INVALID";
      throw error;
    }

    const memoryId =
      requiredString(
        evidence.memory_id,
        `activation_evidence[${index}].memory_id`,
        "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_EVIDENCE_INVALID",
      );

    if (
      !authoritative.by_id.has(memoryId)
      || evidenceById.has(memoryId)
    ) {
      const error = new Error(
        `Phase64A-R2 activation evidence has invalid or duplicate memory id ${memoryId}.`,
      );
      error.code =
        "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_EVIDENCE_INVALID";
      throw error;
    }

    const activationMass =
      finiteNonNegativeNumber(
        evidence.activation_mass,
        `activation_evidence[${index}].activation_mass`,
      );

    evidenceById.set(
      memoryId,
      {
        ...cloneJson(evidence),
        activation_mass:
          activationMass,
      },
    );
  }

  if (
    evidenceById.size
    !== authoritativeIds.length
  ) {
    const error = new Error(
      "Phase64A-R2 activation evidence must cover every authoritative memory exactly once.",
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_R2_EVIDENCE_INCOMPLETE";
    throw error;
  }

  const asOf =
    projection.as_of;

  const asOfMs =
    timestampMs(asOf);

  if (asOfMs === null) {
    const error = new Error(
      "Phase64A-R3 requires a valid R2 projection as_of time.",
    );
    error.code =
      "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_AS_OF_INVALID";
    throw error;
  }

  return {
    projection,
    projected_ids:
      projectedIds,
    evidence_by_id:
      evidenceById,
    as_of:
      cloneJson(asOf),
    as_of_ms:
      asOfMs,
  };
}

function baseEvidenceFor(
  authoritative,
  r2,
) {
  const r2IndexByMemory =
    new Map(
      r2.projected_ids.map(
        (memoryId, index) => [
          memoryId,
          index,
        ],
      ),
    );

  return authoritative.snapshot.map(
    (entry) => {
      const practiceEvidence =
        r2.evidence_by_id.get(
          entry.memory_id,
        );

      const practiceMass =
        practiceEvidence.activation_mass;

      const hasEncodedAt =
        Object.hasOwn(
          entry.record,
          "encoded_at",
        )
        && entry.record.encoded_at !== null
        && entry.record.encoded_at !== undefined
        && entry.record.encoded_at !== "";

      if (!hasEncodedAt) {
        return {
          memory_id:
            entry.memory_id,

          original_index:
            entry.original_index,

          r2_projected_index:
            r2IndexByMemory.get(
              entry.memory_id,
            ),

          encoded_at:
            null,

          encoding_time_status:
            "legacy_encoding_time_unavailable",

          encoding_age_seconds:
            null,

          encoding_activation_contribution:
            null,

          retrieval_practice_activation_mass:
            practiceMass,

          base_level_activation_mass:
            null,

          base_level_activation_score:
            null,

          base_level_constant:
            baseLevelConstant,

          complete_base_level_evidence:
            false,

          legacy_r2_slot_pinned:
            true,

          scalar_activation_is_literal_human_probability:
            false,
        };
      }

      const encodedAtMs =
        timestampMs(
          entry.record.encoded_at,
        );

      if (encodedAtMs === null) {
        const error = new Error(
          `Memory ${entry.memory_id} has an invalid encoded_at timestamp.`,
        );
        error.code =
          "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_ENCODING_TIME_INVALID";
        error.memory_id =
          entry.memory_id;
        error.encoded_at =
          cloneJson(
            entry.record.encoded_at,
          );
        throw error;
      }

      if (encodedAtMs > r2.as_of_ms) {
        const error = new Error(
          `Memory ${entry.memory_id} is encoded after the base-level projection time.`,
        );
        error.code =
          "WORLD_SIMULATION_BASE_LEVEL_ACTIVATION_FUTURE_ENCODING_TIME";
        error.memory_id =
          entry.memory_id;
        error.encoded_at =
          cloneJson(
            entry.record.encoded_at,
          );
        error.as_of =
          cloneJson(
            r2.as_of,
          );
        throw error;
      }

      const encodingAgeSeconds =
        Math.max(
          minimumTraceAgeSeconds,
          (
            r2.as_of_ms
            - encodedAtMs
          ) / 1000,
        );

      const encodingContribution =
        encodingAgeSeconds
        ** (-activationDecayExponent);

      const baseMass =
        encodingContribution
        + practiceMass;

      const baseScore =
        Math.log(baseMass)
        + baseLevelConstant;

      return {
        memory_id:
          entry.memory_id,

        original_index:
          entry.original_index,

        r2_projected_index:
          r2IndexByMemory.get(
            entry.memory_id,
          ),

        encoded_at:
          cloneJson(
            entry.record.encoded_at,
          ),

        encoding_time_status:
          "authoritative_encoded_at",

        encoding_age_seconds:
          encodingAgeSeconds,

        encoding_activation_contribution:
          encodingContribution,

        retrieval_practice_activation_mass:
          practiceMass,

        base_level_activation_mass:
          baseMass,

        base_level_activation_score:
          baseScore,

        base_level_constant:
          baseLevelConstant,

        complete_base_level_evidence:
          true,

        legacy_r2_slot_pinned:
          false,

        scalar_activation_is_literal_human_probability:
          false,
      };
    },
  );
}

function projectedOrder(
  evidence,
  r2ProjectedIds,
) {
  const evidenceById =
    new Map(
      evidence.map(
        (entry) => [
          entry.memory_id,
          entry,
        ],
      ),
    );

  const timed =
    r2ProjectedIds
      .filter(
        (memoryId) =>
          evidenceById.get(memoryId)
            ?.complete_base_level_evidence
          === true,
      )
      .map(
        (memoryId) =>
          evidenceById.get(memoryId),
      )
      .sort(
        (left, right) => {
          const difference =
            right.base_level_activation_score
            - left.base_level_activation_score;

          if (
            Math.abs(difference)
            > scoreTieEpsilon
          ) {
            return difference;
          }

          return left.r2_projected_index
            - right.r2_projected_index;
        },
      );

  let timedCursor = 0;

  return r2ProjectedIds.map(
    (memoryId) => {
      const current =
        evidenceById.get(memoryId);

      if (
        current?.complete_base_level_evidence
        !== true
      ) {
        return memoryId;
      }

      const replacement =
        timed[timedCursor]
          ?.memory_id;

      timedCursor += 1;

      return replacement;
    },
  );
}

function evidenceInProjectedOrder(
  evidence,
  projectedIds,
) {
  const byId =
    new Map(
      evidence.map(
        (entry) => [
          entry.memory_id,
          entry,
        ],
      ),
    );

  return projectedIds.map(
    (memoryId, projectedIndex) => ({
      ...cloneJson(
        byId.get(memoryId),
      ),
      projected_index:
        projectedIndex,
      projected_rank:
        projectedIndex + 1,
    }),
  );
}

export function buildWorldSimulationBaseLevelActivationProjectionContract() {
  return deepFreeze({
    version:
      worldSimulationBaseLevelActivationProjectionVersion,

    phase:
      "Phase64A-R3",

    status:
      "base_level_activation_composition_projection_installed",

    model_profile_schema_version:
      baseLevelActivationProjectionModelProfileSchemaVersion,

    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,

    model_profile:
      cloneJson(
        modelProfile,
      ),

    source_retrieval_practice_activation_version:
      worldSimulationRetrievalPracticeActivationProjectionVersion,

    source_retrieval_practice_model_profile_hash:
      retrievalPracticeActivationProjectionModelProfileHash,

    source_phase64a_r2_projection_required:
      true,

    source_phase64a_r2_activation_mass_reused:
      true,

    phase64a_r1_history_read_directly:
      false,

    initial_encoding_trace_used:
      true,

    mass_composition_before_logarithm:
      true,

    legacy_untimed_memory_positions_pinned:
      true,

    future_encoding_time_fails_closed:
      true,

    invalid_encoding_time_fails_closed:
      true,

    world_loop_order:
      "phase64a_r2_then_phase64a_r3_then_phase63b_then_phase63c",

    candidate_membership_owner:
      "Phase63B",

    actual_retrieval_process_owner:
      "Phase63C",

    persistent_memory_mutation_installed:
      false,

    retrieval_induced_forgetting_modeled:
      false,

    associative_spreading_activation_modeled:
      false,

    cue_diagnosticity_scalar_projection_modeled:
      false,
  });
}

export function projectWorldSimulationBaseLevelActivation(
  input = {},
) {
  const authoritative =
    validateMemorySnapshot(
      input.memory_records,
    );

  const r2 =
    validateR2Projection(
      input.retrieval_practice_projection,
      authoritative,
    );

  const evidence =
    baseEvidenceFor(
      authoritative,
      r2,
    );

  const projectedIds =
    projectedOrder(
      evidence,
      r2.projected_ids,
    );

  const evidenceProjected =
    evidenceInProjectedOrder(
      evidence,
      projectedIds,
    );

  const projectedRecords =
    projectedIds.map(
      (memoryId) =>
        cloneJson(
          authoritative.by_id.get(
            memoryId,
          ).record,
        ),
    );

  const completeEvidenceCount =
    evidence.filter(
      (entry) =>
        entry.complete_base_level_evidence
        === true,
    ).length;

  const legacyPinnedCount =
    evidence.length
    - completeEvidenceCount;

  const projectionId =
    `base_level_activation_projection_${hashAgentRunValue({
      version:
        worldSimulationBaseLevelActivationProjectionVersion,
      model_profile_hash:
        baseLevelActivationProjectionModelProfileHash,
      source_r2_projection_id:
        r2.projection.projection_id
        ?? null,
      character:
        r2.projection.character
        ?? null,
      current_turn_id:
        r2.projection.current_turn_id
        ?? null,
      as_of:
        r2.as_of,
      input_memory_ids:
        authoritative.snapshot.map(
          (entry) =>
            entry.memory_id,
        ),
      r2_projected_memory_ids:
        r2.projected_ids,
      projected_memory_ids:
        projectedIds,
      evidence:
        evidenceProjected.map(
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
    }).slice(0, 24)}`;

  return deepFreeze({
    version:
      worldSimulationBaseLevelActivationProjectionVersion,

    projection_id:
      projectionId,

    character:
      r2.projection.character
      ?? null,

    current_turn_id:
      r2.projection.current_turn_id
      ?? null,

    as_of:
      cloneJson(
        r2.as_of,
      ),

    model_profile_schema_version:
      baseLevelActivationProjectionModelProfileSchemaVersion,

    model_profile_hash:
      baseLevelActivationProjectionModelProfileHash,

    source_retrieval_practice_activation_version:
      r2.projection.version,

    source_retrieval_practice_model_profile_hash:
      r2.projection.model_profile_hash,

    source_retrieval_practice_projection_id:
      r2.projection.projection_id
      ?? null,

    input_memory_ids:
      authoritative.snapshot.map(
        (entry) =>
          entry.memory_id,
      ),

    r2_projected_memory_ids:
      cloneJson(
        r2.projected_ids,
      ),

    projected_memory_ids:
      cloneJson(
        projectedIds,
      ),

    projected_memory_records:
      projectedRecords,

    base_level_activation_evidence:
      evidenceProjected,

    audit: {
      source_r2_projection_verified:
        true,

      source_r2_profile_verified:
        true,

      source_r2_input_snapshot_verified:
        true,

      source_r2_projected_permutation_verified:
        true,

      source_r2_activation_evidence_complete:
        true,

      phase64a_r1_history_read_directly:
        false,

      authoritative_memory_records_mutated:
        false,

      persistent_memory_order_mutated:
        false,

      candidate_membership_mutated:
        false,

      retrieval_eligibility_mutated:
        false,

      memory_content_rewritten:
        false,

      storage_strength_mutated:
        false,

      retrieval_strength_mutated:
        false,

      complete_base_level_evidence_count:
        completeEvidenceCount,

      legacy_untimed_pinned_count:
        legacyPinnedCount,

      legacy_untimed_positions_preserved:
        true,

      base_level_score_is_literal_human_recall_probability:
        false,

      current_turn_id:
        r2.projection.current_turn_id
        ?? null,
    },
  });
}
