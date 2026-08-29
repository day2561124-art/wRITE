import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationRetrievalCueSupportTopologyEvidenceVersion =
  "phase64a-r4b2-retrieval-cue-support-topology-evidence-v1";

export const retrievalCueSupportTopologyEvidenceSchemaVersion =
  "phase64a-r4b2-retrieval-cue-support-topology-evidence-v1";

const expectedR4AVersion =
  "phase64a-query-relative-cue-diagnostic-evidence-projection-v1";

const expectedR4B1Version =
  "phase64a-r4b1-retrieval-cue-orientation-evidence-v1";

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
  code = "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_INVALID",
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

function uniqueStrings(
  values,
  label,
  code = "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_DUPLICATE",
) {
  const normalized =
    array(values).map(
      (value) =>
        requiredString(
          value,
          `${label}[]`,
          code,
        ),
    );

  if (
    new Set(normalized).size
    !== normalized.length
  ) {
    const error =
      new Error(
        `${label} contains duplicate values.`,
      );

    error.code =
      code;

    throw error;
  }

  return normalized;
}

function memoryIdFromRef(
  ref,
  index,
) {
  if (!isObject(ref)) {
    const error =
      new Error(
        `source_initial_frontier.candidate_refs[${index}] must be an object.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_FRONTIER_INVALID";

    throw error;
  }

  return requiredString(
    ref.memory_id,
    `source_initial_frontier.candidate_refs[${index}].memory_id`,
    "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_FRONTIER_INVALID",
  );
}

function assertFrontier(
  raw,
  queryId,
) {
  const frontier =
    object(raw);

  const frontierId =
    requiredString(
      frontier.frontier_id,
      "source_initial_frontier.frontier_id",
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_FRONTIER_INVALID",
    );

  const candidateIds =
    array(
      frontier.candidate_refs,
    ).map(
      memoryIdFromRef,
    );

  if (
    new Set(candidateIds).size
    !== candidateIds.length
  ) {
    const error =
      new Error(
        "source_initial_frontier contains duplicate candidate memory ids.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_CANDIDATE_DUPLICATE";

    throw error;
  }

  const cueDiagnosticProjection =
    object(
      frontier.cue_diagnostic_projection,
    );

  return {
    query_id:
      queryId,
    frontier_id:
      frontierId,
    candidate_ids:
      candidateIds,
    cue_diagnostic_projection_id:
      requiredString(
        cueDiagnosticProjection.projection_id,
        "source_initial_frontier.cue_diagnostic_projection.projection_id",
        "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_FRONTIER_INVALID",
      ),
    cue_diagnostic_evidence_hash:
      requiredString(
        cueDiagnosticProjection.evidence_hash,
        "source_initial_frontier.cue_diagnostic_projection.evidence_hash",
        "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_FRONTIER_INVALID",
      ),
  };
}

function assertR4AProjection(
  raw,
  frontier,
) {
  const projection =
    object(raw);

  if (
    projection.version
    !== expectedR4AVersion
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 requires canonical Phase64A-R4A cue diagnostic evidence.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_VERSION_MISMATCH";

    throw error;
  }

  if (
    projection.applicable
    !== true
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 v1 requires an applicable Phase64A-R4A projection.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_NOT_APPLICABLE";

    throw error;
  }

  const projectionId =
    requiredString(
      projection.projection_id,
      "cue_diagnostic_projection.projection_id",
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_INVALID",
    );

  const evidenceHash =
    requiredString(
      projection.evidence_hash,
      "cue_diagnostic_projection.evidence_hash",
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_INVALID",
    );

  if (
    projectionId
    !== frontier.cue_diagnostic_projection_id
    || evidenceHash
    !== frontier.cue_diagnostic_evidence_hash
  ) {
    const error =
      new Error(
        "Phase64A-R4A projection is not bound to the supplied initial frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_FRONTIER_BINDING_MISMATCH";

    throw error;
  }

  const candidateIds =
    uniqueStrings(
      projection.candidate_memory_ids,
      "cue_diagnostic_projection.candidate_memory_ids",
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_CANDIDATE_DUPLICATE",
    );

  if (
    JSON.stringify(candidateIds)
    !== JSON.stringify(frontier.candidate_ids)
  ) {
    const error =
      new Error(
        "Phase64A-R4A candidate membership/order does not match the initial frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_CANDIDATE_ORDER_MISMATCH";

    throw error;
  }

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
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_EVIDENCE_COVERAGE_MISMATCH";

    throw error;
  }

  candidateEvidence.forEach(
    (
      entry,
      index,
    ) => {
      if (!isObject(entry)) {
        const error =
          new Error(
            `cue_diagnostic_projection.candidate_evidence[${index}] must be an object.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_INVALID";

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
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_CANDIDATE_ORDER_MISMATCH";

        throw error;
      }

      const seenCueIdentities =
        new Set();

      for (
        const cueEvidence
        of array(
          entry.cue_evidence,
        )
      ) {
        const identity =
          requiredString(
            cueEvidence?.cue_identity,
            `cue_diagnostic_projection.candidate_evidence[${index}].cue_evidence[].cue_identity`,
            "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_INVALID",
          );

        if (
          seenCueIdentities.has(
            identity,
          )
        ) {
          const error =
            new Error(
              `Duplicate Phase64A-R4A cue evidence identity for candidate ${entry.memory_id}: ${identity}.`,
            );

          error.code =
            "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_CUE_DUPLICATE";

          throw error;
        }

        seenCueIdentities.add(
          identity,
        );
      }
    },
  );

  const actualEvidenceHash =
    hashAgentRunValue(
      candidateEvidence,
    );

  if (
    actualEvidenceHash
    !== evidenceHash
  ) {
    const error =
      new Error(
        "Phase64A-R4A evidence hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_EVIDENCE_HASH_MISMATCH";

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
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4A_AUDIT_HASH_MISMATCH";

    throw error;
  }

  return {
    projection_id:
      projectionId,
    evidence_hash:
      evidenceHash,
    candidate_ids:
      candidateIds,
    candidate_evidence:
      candidateEvidence,
  };
}

function orientationEvidenceBody(
  evidence,
) {
  return {
    schema_version:
      evidence.schema_version,
    version:
      evidence.version,
    query_id:
      evidence.query_id,
    source_initial_frontier_id:
      evidence.source_initial_frontier_id,
    option_set_hash:
      evidence.option_set_hash,
    initiation_mode:
      evidence.initiation_mode,
    trigger:
      cloneJson(
        evidence.trigger,
      ),
    orientation:
      cloneJson(
        evidence.orientation,
      ),
    boundaries:
      cloneJson(
        evidence.boundaries,
      ),
    immutable:
      evidence.immutable,
  };
}

function assertSelectedCueEntries(
  entries,
  label,
) {
  const cueOptionIds =
    new Set();
  const cueIdentities =
    new Set();

  return array(entries).map(
    (
      entry,
      index,
    ) => {
      if (!isObject(entry)) {
        const error =
          new Error(
            `${label}[${index}] must be an object.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_INVALID";

        throw error;
      }

      const cueOptionId =
        requiredString(
          entry.cue_option_id,
          `${label}[${index}].cue_option_id`,
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_INVALID",
        );

      const cueIdentity =
        requiredString(
          entry.canonical_cue_identity,
          `${label}[${index}].canonical_cue_identity`,
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_INVALID",
        );

      if (
        cueOptionIds.has(cueOptionId)
        || cueIdentities.has(cueIdentity)
      ) {
        const error =
          new Error(
            `${label} contains duplicate cue selections.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_SELECTION_DUPLICATE";

        throw error;
      }

      cueOptionIds.add(
        cueOptionId,
      );
      cueIdentities.add(
        cueIdentity,
      );

      return {
        cue_option_id:
          cueOptionId,
        canonical_cue_identity:
          cueIdentity,
      };
    },
  );
}

function assertR4B1Evidence(
  raw,
  queryId,
  frontier,
) {
  const evidence =
    object(raw);

  if (
    evidence.version
    !== expectedR4B1Version
  ) {
    const error =
      new Error(
        "Phase64A-R4B2 requires canonical Phase64A-R4B1 retrieval cue orientation evidence.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_VERSION_MISMATCH";

    throw error;
  }

  if (
    evidence.query_id
    !== queryId
  ) {
    const error =
      new Error(
        "Phase64A-R4B1 query binding mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_QUERY_BINDING_MISMATCH";

    throw error;
  }

  if (
    evidence.source_initial_frontier_id
    !== frontier.frontier_id
  ) {
    const error =
      new Error(
        "Phase64A-R4B1 initial frontier binding mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_FRONTIER_BINDING_MISMATCH";

    throw error;
  }

  const evidenceHash =
    requiredString(
      evidence.evidence_hash,
      "cue_orientation_evidence.evidence_hash",
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_INVALID",
    );

  const actualHash =
    hashAgentRunValue(
      orientationEvidenceBody(
        evidence,
      ),
    );

  if (
    actualHash
    !== evidenceHash
  ) {
    const error =
      new Error(
        "Phase64A-R4B1 evidence hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_EVIDENCE_HASH_MISMATCH";

    throw error;
  }

  const expectedId =
    `memory_retrieval_orientation_${evidenceHash.slice(0, 24)}`;

  if (
    evidence.orientation_evidence_id
    !== expectedId
  ) {
    const error =
      new Error(
        "Phase64A-R4B1 orientation evidence id does not match its evidence hash.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_SUPPORT_TOPOLOGY_R4B1_EVIDENCE_ID_MISMATCH";

    throw error;
  }

  const trigger =
    object(
      evidence.trigger,
    );

  const orientation =
    object(
      evidence.orientation,
    );

  return {
    orientation_evidence_id:
      evidence.orientation_evidence_id,
    evidence_hash:
      evidenceHash,
    initiation_mode:
      evidence.initiation_mode,
    trigger: {
      basis_status:
        optionalString(
          trigger.grounding_status,
        )
        ?? "unspecified",
      selected_cues:
        assertSelectedCueEntries(
          trigger.grounded_cue_refs,
          "cue_orientation_evidence.trigger.grounded_cue_refs",
        ),
    },
    orientation: {
      applicable:
        orientation.applicable
        === true,
      basis_status:
        optionalString(
          orientation.status,
        )
        ?? "unspecified",
      selected_cues:
        assertSelectedCueEntries(
          orientation.grounded_cue_refs,
          "cue_orientation_evidence.orientation.grounded_cue_refs",
        ),
    },
  };
}

function supportIdsForCue(
  cueIdentity,
  r4a,
) {
  return r4a
    .candidate_evidence
    .filter(
      (candidate) =>
        array(
          candidate.cue_evidence,
        ).some(
          (cueEvidence) =>
            cueEvidence.cue_identity
            === cueIdentity,
        ),
    )
    .map(
      (candidate) =>
        candidate.memory_id,
    );
}

function individualSupport(
  selections,
  r4a,
) {
  return selections.map(
    (selection) => {
      const candidateIds =
        supportIdsForCue(
          selection.canonical_cue_identity,
          r4a,
        );

      return {
        cue_option_id:
          selection.cue_option_id,
        canonical_cue_identity:
          selection.canonical_cue_identity,
        support_candidate_ids:
          candidateIds,
        support_candidate_count:
          candidateIds.length,
      };
    },
  );
}

function intersectionInCandidateOrder(
  candidateOrder,
  supportSets,
) {
  if (!supportSets.length) {
    return [];
  }

  return candidateOrder.filter(
    (memoryId) =>
      supportSets.every(
        (supportSet) =>
          supportSet.has(
            memoryId,
          ),
      ),
  );
}

function pairRelation(
  leftIds,
  rightIds,
) {
  const left =
    new Set(leftIds);
  const right =
    new Set(rightIds);

  if (
    !left.size
    && !right.size
  ) {
    return "both_empty";
  }

  if (!left.size) {
    return "left_empty";
  }

  if (!right.size) {
    return "right_empty";
  }

  const leftInsideRight =
    [...left].every(
      (value) =>
        right.has(value),
    );

  const rightInsideLeft =
    [...right].every(
      (value) =>
        left.has(value),
    );

  if (
    leftInsideRight
    && rightInsideLeft
  ) {
    return "identical_nonempty";
  }

  if (leftInsideRight) {
    return "left_proper_subset";
  }

  if (rightInsideLeft) {
    return "right_proper_subset";
  }

  const overlaps =
    [...left].some(
      (value) =>
        right.has(value),
    );

  return overlaps
    ? "partial_overlap"
    : "disjoint_nonempty";
}

function pairwiseSupport(
  individual,
  candidateOrder,
) {
  const result = [];

  for (
    let leftIndex = 0;
    leftIndex < individual.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < individual.length;
      rightIndex += 1
    ) {
      const left =
        individual[leftIndex];
      const right =
        individual[rightIndex];

      const jointIds =
        intersectionInCandidateOrder(
          candidateOrder,
          [
            new Set(
              left.support_candidate_ids,
            ),
            new Set(
              right.support_candidate_ids,
            ),
          ],
        );

      result.push({
        cue_refs: [
          left.cue_option_id,
          right.cue_option_id,
        ],
        left_support_candidate_count:
          left.support_candidate_count,
        right_support_candidate_count:
          right.support_candidate_count,
        joint_support_candidate_ids:
          jointIds,
        joint_support_candidate_count:
          jointIds.length,
        relation:
          pairRelation(
            left.support_candidate_ids,
            right.support_candidate_ids,
          ),
      });
    }
  }

  return result;
}

function fullSelectedSetSupport(
  individual,
  candidateOrder,
) {
  if (!individual.length) {
    return {
      status:
        "not_applicable",
      cue_refs: [],
      joint_support_candidate_ids: [],
      joint_support_candidate_count:
        0,
    };
  }

  const jointIds =
    intersectionInCandidateOrder(
      candidateOrder,
      individual.map(
        (entry) =>
          new Set(
            entry.support_candidate_ids,
          ),
      ),
    );

  return {
    status:
      jointIds.length
        ? "present"
        : "empty",
    cue_refs:
      individual.map(
        (entry) =>
          entry.cue_option_id,
      ),
    joint_support_candidate_ids:
      jointIds,
    joint_support_candidate_count:
      jointIds.length,
  };
}

function buildChannel({
  applicable,
  basisStatus,
  selections,
  r4a,
}) {
  if (!applicable) {
    return {
      applicable:
        false,
      basis_status:
        basisStatus,
      selected_cue_count:
        0,
      individual_support: [],
      pairwise_joint_support: [],
      full_selected_set_support:
        fullSelectedSetSupport(
          [],
          r4a.candidate_ids,
        ),
    };
  }

  const individual =
    individualSupport(
      selections,
      r4a,
    );

  return {
    applicable:
      true,
    basis_status:
      basisStatus,
    selected_cue_count:
      selections.length,
    individual_support:
      individual,
    pairwise_joint_support:
      pairwiseSupport(
        individual,
        r4a.candidate_ids,
      ),
    full_selected_set_support:
      fullSelectedSetSupport(
        individual,
        r4a.candidate_ids,
      ),
  };
}

export function buildWorldSimulationRetrievalCueSupportTopologyContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
    phase:
      "Phase64A-R4B2",
    status:
      "attended_retrieval_cue_support_topology_evidence",
    source_r4a_applicability_required:
      true,
    support_topology_is_query_conditioned:
      true,
    support_topology_is_initial_frontier_bound:
      true,
    trigger_and_orientation_topologies_distinguished:
      true,
    trigger_orientation_topologies_merged:
      false,
    support_derived_from_r4a_evidence_only:
      true,
    individual_support_modeled:
      true,
    pairwise_joint_support_modeled:
      true,
    full_selected_set_support_modeled:
      true,
    all_subset_enumeration_used:
      false,
    statistical_dependency_inferred:
      false,
    encoded_compound_binding_inferred:
      false,
    configural_binding_inferred:
      false,
    attention_weight_modeled:
      false,
    association_strength_aggregate_inferred:
      false,
    scalar_activation_modeled:
      false,
    retrieval_probability_modeled:
      false,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    inhibition_inferred:
      false,
    plasticity_applied:
      false,
    persistent_memory_mutation_authority:
      false,
    source_attribution_performed:
      false,
    world_truth_authority:
      false,
    dynamic_support_topology_recomputation:
      false,
    phase63c_reinstated_cues_included:
      false,
    retrieval_resolver_support_topology_exposed:
      false,
    full_support_topology_persisted:
      false,
  });
}

export function projectWorldSimulationRetrievalCueSupportTopologyEvidence(
  input = {},
) {
  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const frontier =
    assertFrontier(
      input.source_initial_frontier,
      queryId,
    );

  const r4a =
    assertR4AProjection(
      input.cue_diagnostic_projection,
      frontier,
    );

  const r4b1 =
    assertR4B1Evidence(
      input.cue_orientation_evidence,
      queryId,
      frontier,
    );

  const channels = {
    trigger:
      buildChannel({
        applicable:
          true,
        basisStatus:
          r4b1.trigger.basis_status,
        selections:
          r4b1.trigger.selected_cues,
        r4a,
      }),
    orientation:
      buildChannel({
        applicable:
          r4b1.orientation.applicable,
        basisStatus:
          r4b1.orientation.basis_status,
        selections:
          r4b1.orientation.selected_cues,
        r4a,
      }),
  };

  const body = {
    schema_version:
      retrievalCueSupportTopologyEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalCueSupportTopologyEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      frontier.frontier_id,
    source_r4a_projection_id:
      r4a.projection_id,
    source_r4a_evidence_hash:
      r4a.evidence_hash,
    source_r4b1_orientation_evidence_id:
      r4b1.orientation_evidence_id,
    source_r4b1_evidence_hash:
      r4b1.evidence_hash,
    channels,
    boundaries: {
      evidence_is_query_conditioned:
        true,
      evidence_is_initial_frontier_bound:
        true,
      trigger_orientation_merged:
        false,
      all_subset_enumeration_used:
        false,
      statistical_dependency_inferred:
        false,
      encoded_compound_binding_inferred:
        false,
      configural_binding_inferred:
        false,
      attention_weight_modeled:
        false,
      association_strength_aggregate_inferred:
        false,
      scalar_activation_modeled:
        false,
      retrieval_probability_modeled:
        false,
      candidate_membership_changed:
        false,
      candidate_order_changed:
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
      source_attribution_performed:
        false,
      world_truth_claimed:
        false,
      dynamic_frontier_recomputation_used:
        false,
      phase63c_reinstated_cues_included:
        false,
      resolver_exposure_allowed:
        false,
      full_topology_persistence_allowed:
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
    topology_evidence_id:
      `memory_retrieval_cue_support_topology_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}
