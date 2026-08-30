import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  baseLevelActivationProjectionModelProfileHash,
  worldSimulationBaseLevelActivationProjectionVersion,
} from "./world-simulation-base-level-activation-projection-service.mjs";
import {
  worldSimulationCueDiagnosticEvidenceProjectionVersion,
} from "./world-simulation-cue-diagnostic-evidence-projection-service.mjs";
import {
  worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
} from "./world-simulation-retrieval-cue-support-topology-evidence-service.mjs";

export const worldSimulationAssociativeActivationCompositionEvidenceVersion =
  "phase64a-r4b3-associative-activation-composition-evidence-v1";

export const associativeActivationCompositionEvidenceSchemaVersion =
  "phase64a-r4b3-associative-activation-composition-evidence-v1";

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
  code = "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_INVALID",
) {
  const text =
    optionalString(value);

  if (text) return text;

  const error =
    new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function finiteNumberOrNull(
  value,
  label,
  code = "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_NUMBER_INVALID",
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    const error =
      new Error(`${label} must be null or a finite number.`);
    error.code = code;
    throw error;
  }

  return number;
}

function finiteUnitValues(
  values,
  label,
) {
  return array(values).map(
    (value, index) => {
      const number = Number(value);

      if (
        !Number.isFinite(number)
        || number < 0
        || number > 1
      ) {
        const error =
          new Error(
            `${label}[${index}] must be a finite number between 0 and 1.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_ASSOCIATION_STRENGTH_INVALID";
        throw error;
      }

      return number;
    },
  );
}

function uniqueStrings(
  values,
  label,
  code = "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_DUPLICATE",
) {
  const normalized =
    array(values).map(
      (value, index) =>
        requiredString(
          value,
          `${label}[${index}]`,
          code,
        ),
    );

  if (
    new Set(normalized).size
    !== normalized.length
  ) {
    const error =
      new Error(`${label} contains duplicate values.`);
    error.code = code;
    throw error;
  }

  return normalized;
}

function assertNoUnsupportedOverrides(input) {
  const forbidden = [
    "attention_weights",
    "maximum_associative_strength",
    "composition_formula",
    "activation_profile",
    "model_profile",
    "cue_dependency_model",
  ];

  for (const key of forbidden) {
    if (Object.hasOwn(object(input), key)) {
      const error =
        new Error(
          `Phase64A-R4B3 v1 does not accept caller-supplied ${key}.`,
        );
      error.code =
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_OVERRIDE_FORBIDDEN";
      error.field = key;
      throw error;
    }
  }
}

function r3ProjectionIdBody(projection) {
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
      cloneJson(
        projection.as_of,
      ),
    input_memory_ids:
      cloneJson(
        projection.input_memory_ids,
      ),
    r2_projected_memory_ids:
      cloneJson(
        projection.r2_projected_memory_ids,
      ),
    projected_memory_ids:
      cloneJson(
        projection.projected_memory_ids,
      ),
    evidence:
      array(
        projection.base_level_activation_evidence,
      ).map(
        (entry) => ({
          memory_id:
            entry.memory_id,
          encoded_at:
            cloneJson(
              entry.encoded_at,
            ),
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

function assertR3Projection(
  raw,
  character,
  turnId,
) {
  const projection = object(raw);

  if (
    projection.version
    !== worldSimulationBaseLevelActivationProjectionVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 requires canonical Phase64A-R3 base-level activation evidence.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_VERSION_MISMATCH";
    throw error;
  }

  if (
    projection.model_profile_hash
    !== baseLevelActivationProjectionModelProfileHash
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 source R3 model profile hash mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_PROFILE_MISMATCH";
    throw error;
  }

  if (
    projection.character
    !== character
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 source R3 character binding mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_CHARACTER_MISMATCH";
    throw error;
  }

  if (
    projection.current_turn_id
    !== turnId
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 source R3 turn binding mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_TURN_MISMATCH";
    throw error;
  }

  const projectedIds =
    uniqueStrings(
      projection.projected_memory_ids,
      "base_level_activation_projection.projected_memory_ids",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_MEMORY_DUPLICATE",
    );

  const evidence =
    array(
      projection.base_level_activation_evidence,
    );

  if (
    evidence.length
    !== projectedIds.length
  ) {
    const error =
      new Error(
        "Phase64A-R3 base-level evidence must cover every projected memory exactly once.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_COVERAGE_MISMATCH";
    throw error;
  }

  const byId = new Map();

  evidence.forEach(
    (entry, index) => {
      if (!isObject(entry)) {
        const error =
          new Error(
            `base_level_activation_projection.base_level_activation_evidence[${index}] must be an object.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_INVALID";
        throw error;
      }

      const memoryId =
        requiredString(
          entry.memory_id,
          `base_level_activation_projection.base_level_activation_evidence[${index}].memory_id`,
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_INVALID",
        );

      if (
        memoryId
        !== projectedIds[index]
      ) {
        const error =
          new Error(
            `Phase64A-R3 evidence order mismatch at projected index ${index}.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_ORDER_MISMATCH";
        throw error;
      }

      const complete =
        entry.complete_base_level_evidence
        === true;

      const score =
        finiteNumberOrNull(
          entry.base_level_activation_score,
          `base_level_activation_projection.base_level_activation_evidence[${index}].base_level_activation_score`,
        );

      if (
        complete
        && score === null
      ) {
        const error =
          new Error(
            `Complete Phase64A-R3 evidence for ${memoryId} requires a base-level activation score.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_INVALID";
        throw error;
      }

      if (
        !complete
        && score !== null
      ) {
        const error =
          new Error(
            `Incomplete Phase64A-R3 evidence for ${memoryId} may not invent a base-level activation score.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_EVIDENCE_INVALID";
        throw error;
      }

      byId.set(
        memoryId,
        cloneJson(entry),
      );
    },
  );

  const expectedProjectionId =
    `base_level_activation_projection_${hashAgentRunValue(
      r3ProjectionIdBody(projection),
    ).slice(0, 24)}`;

  if (
    projection.projection_id
    !== expectedProjectionId
  ) {
    const error =
      new Error(
        "Phase64A-R3 projection id does not match canonical projection contents.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_PROJECTION_ID_MISMATCH";
    throw error;
  }

  return {
    projection,
    projection_id:
      projection.projection_id,
    projection_hash:
      hashAgentRunValue(
        cloneJson(projection),
      ),
    projected_ids:
      projectedIds,
    evidence_by_id:
      byId,
  };
}

function assertR4AProjection(raw) {
  const projection = object(raw);

  if (
    projection.version
    !== worldSimulationCueDiagnosticEvidenceProjectionVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 requires canonical Phase64A-R4A cue diagnostic evidence.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_VERSION_MISMATCH";
    throw error;
  }

  if (
    projection.applicable
    !== true
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 v1 requires an applicable Phase64A-R4A projection.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_NOT_APPLICABLE";
    throw error;
  }

  const projectionId =
    requiredString(
      projection.projection_id,
      "cue_diagnostic_projection.projection_id",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_INVALID",
    );

  const candidateIds =
    uniqueStrings(
      projection.candidate_memory_ids,
      "cue_diagnostic_projection.candidate_memory_ids",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_CANDIDATE_DUPLICATE",
    );

  const candidateEvidence =
    array(
      projection.candidate_evidence,
    );

  if (
    candidateEvidence.length
    !== candidateIds.length
  ) {
    const error =
      new Error(
        "Phase64A-R4A candidate evidence must cover the complete candidate frontier.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_EVIDENCE_COVERAGE_MISMATCH";
    throw error;
  }

  const byId = new Map();

  candidateEvidence.forEach(
    (entry, index) => {
      if (!isObject(entry)) {
        const error =
          new Error(
            `cue_diagnostic_projection.candidate_evidence[${index}] must be an object.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_INVALID";
        throw error;
      }

      if (
        entry.memory_id
        !== candidateIds[index]
      ) {
        const error =
          new Error(
            `Phase64A-R4A candidate evidence order mismatch at index ${index}.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_CANDIDATE_ORDER_MISMATCH";
        throw error;
      }

      const seenCueIdentities = new Set();
      const cueByIdentity = new Map();

      for (
        const cueEvidence
        of array(entry.cue_evidence)
      ) {
        const identity =
          requiredString(
            cueEvidence?.cue_identity,
            `cue_diagnostic_projection.candidate_evidence[${index}].cue_evidence[].cue_identity`,
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_INVALID",
          );

        if (
          seenCueIdentities.has(identity)
        ) {
          const error =
            new Error(
              `Duplicate Phase64A-R4A cue evidence for ${entry.memory_id}: ${identity}.`,
            );
          error.code =
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_CUE_DUPLICATE";
          throw error;
        }

        seenCueIdentities.add(identity);
        cueByIdentity.set(
          identity,
          cloneJson(cueEvidence),
        );
      }

      byId.set(
        entry.memory_id,
        {
          evidence:
            cloneJson(entry),
          cue_by_identity:
            cueByIdentity,
        },
      );
    },
  );

  const evidenceHash =
    requiredString(
      projection.evidence_hash,
      "cue_diagnostic_projection.evidence_hash",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_INVALID",
    );

  const actualEvidenceHash =
    hashAgentRunValue(
      candidateEvidence,
    );

  if (
    evidenceHash
    !== actualEvidenceHash
  ) {
    const error =
      new Error(
        "Phase64A-R4A evidence hash mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_EVIDENCE_HASH_MISMATCH";
    throw error;
  }

  if (
    optionalString(
      projection.audit
        ?.evidence_hash,
    )
    !== evidenceHash
  ) {
    const error =
      new Error(
        "Phase64A-R4A audit evidence hash mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_AUDIT_HASH_MISMATCH";
    throw error;
  }

  return {
    projection,
    projection_id:
      projectionId,
    evidence_hash:
      evidenceHash,
    candidate_ids:
      candidateIds,
    candidate_evidence:
      candidateEvidence,
    by_id:
      byId,
  };
}

function r4b2EvidenceBody(evidence) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    source_r4b1_orientation_evidence_id:
      evidence.source_r4b1_orientation_evidence_id,
    source_r4b1_evidence_hash:
      evidence.source_r4b1_evidence_hash,
    channels:
      cloneJson(
        evidence.channels,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertR4B2Channel(
  raw,
  label,
  candidateIds,
) {
  const channel = object(raw);
  const applicable =
    channel.applicable
    === true;

  const individual =
    array(
      channel.individual_support,
    );

  if (
    !applicable
    && individual.length
  ) {
    const error =
      new Error(
        `${label} is not applicable but contains individual support evidence.`,
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CHANNEL_INVALID";
    throw error;
  }

  const optionIds = new Set();
  const cueIdentities = new Set();
  const candidateOrder =
    new Map(
      candidateIds.map(
        (memoryId, index) => [
          memoryId,
          index,
        ],
      ),
    );

  const selections =
    individual.map(
      (entry, index) => {
        if (!isObject(entry)) {
          const error =
            new Error(`${label}.individual_support[${index}] must be an object.`);
          error.code =
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CHANNEL_INVALID";
          throw error;
        }

        const cueOptionId =
          requiredString(
            entry.cue_option_id,
            `${label}.individual_support[${index}].cue_option_id`,
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CHANNEL_INVALID",
          );
        const cueIdentity =
          requiredString(
            entry.canonical_cue_identity,
            `${label}.individual_support[${index}].canonical_cue_identity`,
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CHANNEL_INVALID",
          );

        if (
          optionIds.has(cueOptionId)
          || cueIdentities.has(cueIdentity)
        ) {
          const error =
            new Error(`${label} contains duplicate selected cues.`);
          error.code =
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CUE_DUPLICATE";
          throw error;
        }

        optionIds.add(cueOptionId);
        cueIdentities.add(cueIdentity);

        const supportIds =
          uniqueStrings(
            entry.support_candidate_ids,
            `${label}.individual_support[${index}].support_candidate_ids`,
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_SUPPORT_DUPLICATE",
          );

        for (const memoryId of supportIds) {
          if (!candidateOrder.has(memoryId)) {
            const error =
              new Error(
                `${label} support references memory outside the initial candidate frontier: ${memoryId}.`,
              );
            error.code =
              "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_SUPPORT_OUTSIDE_FRONTIER";
            throw error;
          }
        }

        const sorted =
          [...supportIds].sort(
            (left, right) =>
              candidateOrder.get(left)
              - candidateOrder.get(right),
          );

        if (
          JSON.stringify(sorted)
          !== JSON.stringify(supportIds)
        ) {
          const error =
            new Error(
              `${label} support candidate order must preserve the initial frontier order.`,
            );
          error.code =
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_SUPPORT_ORDER_MISMATCH";
          throw error;
        }

        if (
          Number(entry.support_candidate_count)
          !== supportIds.length
        ) {
          const error =
            new Error(
              `${label} support_candidate_count does not match support_candidate_ids.`,
            );
          error.code =
            "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_SUPPORT_COUNT_MISMATCH";
          throw error;
        }

        return {
          cue_option_id:
            cueOptionId,
          canonical_cue_identity:
            cueIdentity,
          support_candidate_ids:
            supportIds,
          support_candidate_count:
            supportIds.length,
        };
      },
    );

  if (
    Number(channel.selected_cue_count)
    !== selections.length
  ) {
    const error =
      new Error(`${label}.selected_cue_count does not match individual support entries.`);
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_CHANNEL_INVALID";
    throw error;
  }

  return {
    applicable,
    basis_status:
      channel.basis_status
      ?? null,
    selections,
  };
}

function assertR4B2Evidence(
  raw,
  queryId,
  r4a,
) {
  const evidence = object(raw);

  if (
    evidence.version
    !== worldSimulationRetrievalCueSupportTopologyEvidenceVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 requires canonical Phase64A-R4B2 cue support topology evidence.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_VERSION_MISMATCH";
    throw error;
  }

  if (
    evidence.query_id
    !== queryId
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 query binding mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_QUERY_BINDING_MISMATCH";
    throw error;
  }

  if (
    evidence.source_r4a_projection_id
    !== r4a.projection_id
    || evidence.source_r4a_evidence_hash
      !== r4a.evidence_hash
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 source R4A binding mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_R4A_BINDING_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "cue_support_topology_evidence.evidence_hash",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_INVALID",
    );

  const actualHash =
    hashAgentRunValue(
      r4b2EvidenceBody(evidence),
    );

  if (
    actualHash
    !== evidenceHash
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 evidence hash mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_EVIDENCE_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_retrieval_cue_support_topology_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.topology_evidence_id
    !== expectedId
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 topology evidence id does not match its evidence hash.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_EVIDENCE_ID_MISMATCH";
    throw error;
  }

  const channels = {
    trigger:
      assertR4B2Channel(
        evidence.channels?.trigger,
        "cue_support_topology_evidence.channels.trigger",
        r4a.candidate_ids,
      ),
    orientation:
      assertR4B2Channel(
        evidence.channels?.orientation,
        "cue_support_topology_evidence.channels.orientation",
        r4a.candidate_ids,
      ),
    ...(
      evidence.channels?.reinstatement
        ? {
          reinstatement:
            assertR4B2Channel(
              evidence.channels.reinstatement,
              "cue_support_topology_evidence.channels.reinstatement",
              r4a.candidate_ids,
            ),
        }
        : {}
    ),
  };

  return {
    evidence,
    topology_evidence_id:
      evidence.topology_evidence_id,
    evidence_hash:
      evidenceHash,
    source_initial_frontier_id:
      requiredString(
        evidence.source_initial_frontier_id,
        "cue_support_topology_evidence.source_initial_frontier_id",
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4B2_INVALID",
      ),
    channels,
  };
}

function cueEvidenceForIdentity(
  r4a,
  memoryId,
  cueIdentity,
) {
  return r4a.by_id
    .get(memoryId)
    ?.cue_by_identity
    .get(cueIdentity)
    ?? null;
}

function buildCueProfile(
  selection,
  r4a,
  label,
) {
  const supportSet =
    new Set(
      selection.support_candidate_ids,
    );

  const actualSupportIds =
    r4a.candidate_ids.filter(
      (memoryId) =>
        Boolean(
          cueEvidenceForIdentity(
            r4a,
            memoryId,
            selection.canonical_cue_identity,
          ),
        ),
    );

  if (
    JSON.stringify(actualSupportIds)
    !== JSON.stringify(selection.support_candidate_ids)
  ) {
    const error =
      new Error(
        `${label} support topology does not match Phase64A-R4A cue evidence.`,
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_R4B2_SUPPORT_MISMATCH";
    throw error;
  }

  if (!supportSet.size) {
    return {
      cue_option_id:
        selection.cue_option_id,
      canonical_cue_identity:
        selection.canonical_cue_identity,
      support_candidate_count:
        0,
      candidate_fan_out:
        null,
      query_relative_selectivity_share:
        null,
      log_query_relative_selectivity_term:
        null,
      log_query_relative_selectivity_is_activation_contribution:
        false,
    };
  }

  let fanOut = null;
  let selectivity = null;

  for (const memoryId of selection.support_candidate_ids) {
    const cueEvidence =
      cueEvidenceForIdentity(
        r4a,
        memoryId,
        selection.canonical_cue_identity,
      );

    const currentFanOut =
      Number(
        cueEvidence.candidate_fan_out,
      );
    const currentSelectivity =
      Number(
        cueEvidence.query_relative_selectivity_share,
      );

    if (
      !Number.isSafeInteger(currentFanOut)
      || currentFanOut <= 0
      || !Number.isFinite(currentSelectivity)
      || currentSelectivity <= 0
      || currentSelectivity > 1
    ) {
      const error =
        new Error(
          `${label} contains invalid Phase64A-R4A fan/selectivity evidence.`,
        );
      error.code =
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_DIAGNOSTIC_INVALID";
      throw error;
    }

    if (
      currentFanOut
      !== selection.support_candidate_count
      || currentSelectivity
        !== 1 / currentFanOut
    ) {
      const error =
        new Error(
          `${label} Phase64A-R4A diagnostic evidence is inconsistent with Phase64A-R4B2 support topology.`,
        );
      error.code =
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_R4B2_DIAGNOSTIC_MISMATCH";
      throw error;
    }

    if (
      fanOut !== null
      && (
        fanOut !== currentFanOut
        || selectivity !== currentSelectivity
      )
    ) {
      const error =
        new Error(
          `${label} selected cue has inconsistent query-local diagnostic evidence across supported candidates.`,
        );
      error.code =
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R4A_DIAGNOSTIC_INCONSISTENT";
      throw error;
    }

    fanOut = currentFanOut;
    selectivity = currentSelectivity;
  }

  return {
    cue_option_id:
      selection.cue_option_id,
    canonical_cue_identity:
      selection.canonical_cue_identity,
    support_candidate_count:
      selection.support_candidate_count,
    candidate_fan_out:
      fanOut,
    query_relative_selectivity_share:
      selectivity,
    log_query_relative_selectivity_term:
      Math.log(selectivity),
    log_query_relative_selectivity_is_activation_contribution:
      false,
  };
}

function buildCueChannelProfiles(
  channel,
  r4a,
  label,
) {
  return {
    applicable:
      channel.applicable,
    basis_status:
      channel.basis_status,
    selected_cue_count:
      channel.selections.length,
    cues:
      channel.selections.map(
        (selection, index) =>
          buildCueProfile(
            selection,
            r4a,
            `${label}.cues[${index}]`,
          ),
      ),
  };
}

function candidateCueSupport(
  channelProfile,
  topologyChannel,
  r4a,
  memoryId,
) {
  const topologyByOption =
    new Map(
      topologyChannel.selections.map(
        (entry) => [
          entry.cue_option_id,
          entry,
        ],
      ),
    );

  return channelProfile.cues.map(
    (profile) => {
      const topology =
        topologyByOption.get(
          profile.cue_option_id,
        );
      const supported =
        topology.support_candidate_ids
          .includes(memoryId);
      const cueEvidence =
        cueEvidenceForIdentity(
          r4a,
          memoryId,
          profile.canonical_cue_identity,
        );

      if (
        supported
        !== Boolean(cueEvidence)
      ) {
        const error =
          new Error(
            `Candidate ${memoryId} cue-support bit is inconsistent with Phase64A-R4A/R4B2 evidence.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_CANDIDATE_SUPPORT_MISMATCH";
        throw error;
      }

      const strengths =
        supported
          ? finiteUnitValues(
            cueEvidence.explicit_association_strength_values,
            `cue evidence ${memoryId}/${profile.canonical_cue_identity}.explicit_association_strength_values`,
          )
          : [];

      return {
        cue_option_id:
          profile.cue_option_id,
        canonical_cue_identity:
          profile.canonical_cue_identity,
        supported,
        explicit_association_strength_values:
          strengths,
        association_strength_aggregate:
          null,
        attention_weight:
          null,
        scalar_associative_activation:
          null,
      };
    },
  );
}

function candidateEvidenceFor({
  memoryId,
  candidateIndex,
  r3,
  r4a,
  r4b2,
  selectedCueProfiles,
}) {
  const base =
    r3.evidence_by_id.get(
      memoryId,
    );

  if (!base) {
    const error =
      new Error(
        `Phase64A-R3 has no base-level evidence for initial-frontier candidate ${memoryId}.`,
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_CANDIDATE_MISSING";
    throw error;
  }

  return {
    memory_id:
      memoryId,
    candidate_index:
      candidateIndex,
    base_level: {
      base_level_activation_score:
        base.base_level_activation_score,
      complete_base_level_evidence:
        base.complete_base_level_evidence
        === true,
      encoding_time_status:
        base.encoding_time_status
        ?? null,
      legacy_r2_slot_pinned:
        base.legacy_r2_slot_pinned
        === true,
      score_is_literal_human_recall_probability:
        false,
    },
    cue_support: {
      trigger:
        candidateCueSupport(
          selectedCueProfiles.trigger,
          r4b2.channels.trigger,
          r4a,
          memoryId,
        ),
      orientation:
        candidateCueSupport(
          selectedCueProfiles.orientation,
          r4b2.channels.orientation,
          r4a,
          memoryId,
        ),
      ...(
        selectedCueProfiles.reinstatement
          ? {
            reinstatement:
              candidateCueSupport(
                selectedCueProfiles.reinstatement,
                r4b2.channels.reinstatement,
                r4a,
                memoryId,
              ),
          }
          : {}
      ),
    },
    composition: {
      attention_weights_available:
        false,
      calibrated_association_scale_available:
        false,
      cue_dependency_model_available:
        false,
      scalar_associative_activation:
        null,
      composed_activation_score:
        null,
      status:
        "evidence_only_uncalibrated",
    },
  };
}

function compositionEvidenceBody(evidence) {
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
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    source_r3_projection_id:
      evidence.source_r3_projection_id,
    source_r3_projection_hash:
      evidence.source_r3_projection_hash,
    source_r4a_projection_id:
      evidence.source_r4a_projection_id,
    source_r4a_evidence_hash:
      evidence.source_r4a_evidence_hash,
    source_r4b2_topology_evidence_id:
      evidence.source_r4b2_topology_evidence_id,
    source_r4b2_evidence_hash:
      evidence.source_r4b2_evidence_hash,
    candidate_memory_ids:
      cloneJson(
        evidence.candidate_memory_ids,
      ),
    selected_cue_profiles:
      cloneJson(
        evidence.selected_cue_profiles,
      ),
    candidate_evidence:
      cloneJson(
        evidence.candidate_evidence,
      ),
    dominance:
      cloneJson(
        evidence.dominance,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

export function buildWorldSimulationAssociativeActivationCompositionEvidenceContract() {
  return deepFreeze({
    version:
      worldSimulationAssociativeActivationCompositionEvidenceVersion,
    phase:
      "Phase64A-R4B3",
    status:
      "associative_activation_composition_evidence",
    source_phase64a_r3_required:
      true,
    source_phase64a_r4a_required:
      true,
    source_phase64a_r4b2_required:
      true,
    source_r3_projection_id_recomputed:
      true,
    source_r4a_evidence_hash_recomputed:
      true,
    source_r4b2_evidence_hash_recomputed:
      true,
    evidence_is_query_conditioned:
      true,
    evidence_is_initial_frontier_bound:
      true,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    candidate_order_source:
      "phase64a_r4a_initial_frontier_order",
    r3_base_level_evidence_preserved:
      true,
    r3_score_recalibrated:
      false,
    r4a_selectivity_preserved:
      true,
    query_local_log_diagnostic_term_modeled:
      true,
    r4a_selectivity_used_as_activation:
      false,
    trigger_orientation_channels_distinguished:
      true,
    explicit_association_strengths_preserved:
      true,
    association_strength_aggregate_inferred:
      false,
    attention_weight_inferred:
      false,
    maximum_associative_strength_inferred:
      false,
    cue_independence_assumed:
      false,
    scalar_associative_activation_modeled:
      false,
    composed_activation_score_modeled:
      false,
    caller_supplied_activation_profile_allowed:
      false,
    dominance_mode:
      "lazy_pairwise_evidence_component_comparison_v1",
    exhaustive_pairwise_matrix_materialized:
      false,
    dominance_is_activation_order:
      false,
    dominance_is_retrieval_probability_order:
      false,
    dominance_is_recovery_order:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    retrieval_probability_modeled:
      false,
    inhibition_inferred:
      false,
    plasticity_applied:
      false,
    persistent_memory_mutation_authority:
      false,
    resolver_exposure_allowed:
      false,
    full_evidence_persistence_allowed:
      false,
    dynamic_frontier_recomputation_used:
      false,
    phase63c_reinstated_cues_included:
      false,
    episode_local_dynamic_reprojection_supported:
      true,
    episode_local_reinstatement_channel_supported:
      true,
  });
}

export function projectWorldSimulationAssociativeActivationCompositionEvidence(
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

  const r3 =
    assertR3Projection(
      input.base_level_activation_projection,
      character,
      turnId,
    );
  const r4a =
    assertR4AProjection(
      input.cue_diagnostic_projection,
    );
  const r4b2 =
    assertR4B2Evidence(
      input.cue_support_topology_evidence,
      queryId,
      r4a,
    );

  for (const memoryId of r4a.candidate_ids) {
    if (!r3.evidence_by_id.has(memoryId)) {
      const error =
        new Error(
          `Phase64A-R3 has no evidence for Phase63B initial-frontier candidate ${memoryId}.`,
        );
      error.code =
        "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_R3_CANDIDATE_MISSING";
      throw error;
    }
  }

  const selectedCueProfiles = {
    trigger:
      buildCueChannelProfiles(
        r4b2.channels.trigger,
        r4a,
        "selected_cue_profiles.trigger",
      ),
    orientation:
      buildCueChannelProfiles(
        r4b2.channels.orientation,
        r4a,
        "selected_cue_profiles.orientation",
      ),
    ...(
      r4b2.channels.reinstatement
        ? {
          reinstatement:
            buildCueChannelProfiles(
              r4b2.channels.reinstatement,
              r4a,
              "selected_cue_profiles.reinstatement",
            ),
        }
        : {}
    ),
  };

  const candidateEvidence =
    r4a.candidate_ids.map(
      (memoryId, candidateIndex) =>
        candidateEvidenceFor({
          memoryId,
          candidateIndex,
          r3,
          r4a,
          r4b2,
          selectedCueProfiles,
        }),
    );

  const body = {
    schema_version:
      associativeActivationCompositionEvidenceSchemaVersion,
    version:
      worldSimulationAssociativeActivationCompositionEvidenceVersion,
    query_id:
      queryId,
    character,
    turn_id:
      turnId,
    source_initial_frontier_id:
      r4b2.source_initial_frontier_id,
    source_r3_projection_id:
      r3.projection_id,
    source_r3_projection_hash:
      r3.projection_hash,
    source_r4a_projection_id:
      r4a.projection_id,
    source_r4a_evidence_hash:
      r4a.evidence_hash,
    source_r4b2_topology_evidence_id:
      r4b2.topology_evidence_id,
    source_r4b2_evidence_hash:
      r4b2.evidence_hash,
    candidate_memory_ids:
      cloneJson(
        r4a.candidate_ids,
      ),
    selected_cue_profiles:
      selectedCueProfiles,
    candidate_evidence:
      candidateEvidence,
    dominance: {
      mode:
        "lazy_pairwise_evidence_component_comparison_v1",
      exhaustive_pairwise_matrix_materialized:
        false,
      modeled_dimensions: [
        "complete_r3_base_level_score",
        "actual_selected_cue_support_bits",
      ],
      excluded_dimensions: [
        "candidate_fan_out",
        "query_relative_selectivity_share",
        "log_query_relative_selectivity_term",
        "explicit_association_strength_values",
        "r4b2_pairwise_overlap",
        "r4b2_full_intersection",
        "cue_count",
      ],
    },
    boundaries: {
      evidence_is_query_conditioned:
        true,
      evidence_is_initial_frontier_bound:
        r4b2.evidence
          .boundaries
          ?.evidence_is_episode_frontier_bound
        === true
          ? false
          : true,
      ...(
        r4b2.evidence
          .boundaries
          ?.evidence_is_episode_frontier_bound
        === true
          ? {
            evidence_is_episode_frontier_bound:
              true,
            source_process_initial_frontier_id:
              r4b2.evidence
                .boundaries
                .source_process_initial_frontier_id,
            source_transition_id:
              r4b2.evidence
                .boundaries
                .source_transition_id,
            episode_index:
              r4b2.evidence
                .boundaries
                .episode_index,
            process_wide_r4b1_baseline_reused:
              true,
          }
          : {}
      ),
      candidate_membership_changed:
        false,
      candidate_order_changed:
        false,
      r3_score_recalibrated:
        false,
      r4a_selectivity_used_as_activation:
        false,
      log_query_relative_selectivity_is_activation_contribution:
        false,
      explicit_association_strengths_aggregated:
        false,
      attention_weight_inferred:
        false,
      maximum_associative_strength_inferred:
        false,
      cue_independence_assumed:
        false,
      scalar_associative_activation_modeled:
        false,
      composed_activation_score_modeled:
        false,
      caller_supplied_activation_profile_allowed:
        false,
      retrieval_probability_modeled:
        false,
      retrieval_contact_changed:
        false,
      retrieval_recovery_changed:
        false,
      inhibition_inferred:
        false,
      plasticity_applied:
        false,
      persistent_memory_mutated:
        false,
      resolver_exposure_allowed:
        false,
      full_evidence_persistence_allowed:
        false,
      dynamic_frontier_recomputation_used:
        r4b2.evidence
          .boundaries
          ?.evidence_is_episode_frontier_bound
        === true,
      phase63c_reinstated_cues_included:
        r4b2.evidence
          .boundaries
          ?.evidence_is_episode_frontier_bound
        === true,
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
    composition_evidence_id:
      `memory_associative_activation_composition_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

function assertCompositionProjection(raw) {
  const projection = object(raw);

  if (
    projection.version
    !== worldSimulationAssociativeActivationCompositionEvidenceVersion
  ) {
    const error =
      new Error(
        "Evidence comparator requires canonical Phase64A-R4B3 projection.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_VERSION_MISMATCH";
    throw error;
  }

  const evidenceHash =
    requiredString(
      projection.evidence_hash,
      "projection.evidence_hash",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_INVALID",
    );

  const actualHash =
    hashAgentRunValue(
      compositionEvidenceBody(projection),
    );

  if (
    evidenceHash
    !== actualHash
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 evidence hash mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_HASH_MISMATCH";
    throw error;
  }

  const expectedId =
    `memory_associative_activation_composition_${evidenceHash.slice(0, 24)}`;

  if (
    projection.composition_evidence_id
    !== expectedId
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 evidence id does not match its evidence hash.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_ID_MISMATCH";
    throw error;
  }

  const candidateIds =
    uniqueStrings(
      projection.candidate_memory_ids,
      "projection.candidate_memory_ids",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_CANDIDATE_DUPLICATE",
    );

  const evidence =
    array(
      projection.candidate_evidence,
    );

  if (
    evidence.length
    !== candidateIds.length
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 candidate evidence count mismatch.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_INVALID";
    throw error;
  }

  const byId = new Map();

  evidence.forEach(
    (entry, index) => {
      if (
        !isObject(entry)
        || entry.memory_id
          !== candidateIds[index]
      ) {
        const error =
          new Error(
            `Phase64A-R4B3 candidate evidence order mismatch at index ${index}.`,
          );
        error.code =
          "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_INVALID";
        throw error;
      }

      byId.set(
        entry.memory_id,
        entry,
      );
    },
  );

  return {
    projection,
    by_id:
      byId,
  };
}

function supportBits(candidate) {
  return [
    ...array(
      candidate.cue_support?.trigger,
    ),
    ...array(
      candidate.cue_support?.orientation,
    ),
    ...array(
      candidate.cue_support?.reinstatement,
    ),
  ].map(
    (entry) =>
      entry?.supported === true
        ? 1
        : 0,
  );
}

export function compareWorldSimulationAssociativeCompositionEvidence(
  projection,
  leftMemoryId,
  rightMemoryId,
) {
  const validated =
    assertCompositionProjection(
      projection,
    );

  const leftId =
    requiredString(
      leftMemoryId,
      "leftMemoryId",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_MEMORY_REQUIRED",
    );
  const rightId =
    requiredString(
      rightMemoryId,
      "rightMemoryId",
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_MEMORY_REQUIRED",
    );

  const left =
    validated.by_id.get(
      leftId,
    );
  const right =
    validated.by_id.get(
      rightId,
    );

  if (!left || !right) {
    const error =
      new Error(
        "Evidence comparator memory ids must both belong to the Phase64A-R4B3 initial candidate frontier.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_MEMORY_UNKNOWN";
    throw error;
  }

  if (
    left.base_level?.complete_base_level_evidence
      !== true
    || right.base_level?.complete_base_level_evidence
      !== true
  ) {
    return deepFreeze({
      left_memory_id:
        leftId,
      right_memory_id:
        rightId,
      relation:
        "not_comparable_due_to_incomplete_evidence",
      dominance_is_activation_order:
        false,
      dominance_is_retrieval_probability_order:
        false,
      dominance_is_recovery_order:
        false,
    });
  }

  const leftBase =
    finiteNumberOrNull(
      left.base_level
        .base_level_activation_score,
      "left base_level_activation_score",
    );
  const rightBase =
    finiteNumberOrNull(
      right.base_level
        .base_level_activation_score,
      "right base_level_activation_score",
    );

  const leftBits =
    supportBits(left);
  const rightBits =
    supportBits(right);

  if (
    leftBits.length
    !== rightBits.length
  ) {
    const error =
      new Error(
        "Phase64A-R4B3 candidate cue-support dimensions are inconsistent.",
      );
    error.code =
      "WORLD_SIMULATION_ASSOCIATIVE_ACTIVATION_COMPOSITION_COMPARATOR_DIMENSION_MISMATCH";
    throw error;
  }

  let leftBetter = false;
  let rightBetter = false;

  const baseDifference =
    leftBase - rightBase;

  if (
    Math.abs(baseDifference)
    > scoreTieEpsilon
  ) {
    if (baseDifference > 0) {
      leftBetter = true;
    } else {
      rightBetter = true;
    }
  }

  for (
    let index = 0;
    index < leftBits.length;
    index += 1
  ) {
    if (
      leftBits[index]
      > rightBits[index]
    ) {
      leftBetter = true;
    } else if (
      rightBits[index]
      > leftBits[index]
    ) {
      rightBetter = true;
    }
  }

  let relation;

  if (
    leftBetter
    && rightBetter
  ) {
    relation =
      "incomparable";
  } else if (leftBetter) {
    relation =
      "left_evidence_dominates";
  } else if (rightBetter) {
    relation =
      "right_evidence_dominates";
  } else {
    relation =
      "equivalent_on_modeled_dimensions";
  }

  return deepFreeze({
    left_memory_id:
      leftId,
    right_memory_id:
      rightId,
    relation,
    modeled_dimension_count:
      1 + leftBits.length,
    dominance_is_activation_order:
      false,
    dominance_is_retrieval_probability_order:
      false,
    dominance_is_recovery_order:
      false,
  });
}
