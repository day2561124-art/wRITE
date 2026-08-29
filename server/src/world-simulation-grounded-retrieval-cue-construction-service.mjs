import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationGroundedRetrievalCueConstructionVersion =
  "phase64a-r4e2-grounded-retrieval-cue-construction-v1";

export const groundedRetrievalCueConstructionEvidenceSchemaVersion =
  worldSimulationGroundedRetrievalCueConstructionVersion;

export const worldSimulationGroundedRetrievalCueConstructionCueSource =
  "phase64a_r4e2_controlled_cue_construction";

const allowedCueKinds =
  new Set([
    "spatial_context",
    "perceptual_modality",
    "observation_kind",
    "memory_type",
    "subjective_episode",
    "entity",
    "semantic",
    "source",
    "temporal",
    "task",
    "goal",
  ]);

const allowedTransformations =
  new Set([
    "extraction",
    "combination",
    "abstraction",
    "temporal_narrowing",
    "spatial_narrowing",
    "context_reinstatement",
    "relational_hypothesis",
    "causal_hypothesis",
    "plausibility_hypothesis",
  ]);

const forbiddenInputFields = [
  "world_state",
  "full_world_state",
  "world_event",
  "full_world_event",
  "event_queue",
  "future_event_queue",
  "memory_records",
  "candidate_memory_records",
  "all_character_knowledge",
  "character_state",
  "semantic_graph",
  "global_semantic_graph",
  "hidden_world_state",
  "hidden_causal_state",
];

const forbiddenResolutionFields = [
  "control_action",
  "control_reason",
  "stop",
  "continue",
  "selected_reinstatement_cue_refs",
  "reinstated_cues",
  "next_internal_cues",
  "search_control_policy",
  "stopping_policy",
  "retrieval_attempt_policy",
  "new_attempt_policy",
  "cue_orientation_resolution",
  "search_orientation",
  "world_state",
  "memory_records",
  "candidate_memory_records",
  "character_state",
  "all_character_knowledge",
  "semantic_graph",
  "future_event_queue",
];

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
  code = "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_INVALID",
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
    "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_INTEGER_INVALID";

  throw error;
}

function primitiveValue(
  value,
  label,
) {
  if (
    ![
      "string",
      "number",
      "boolean",
    ].includes(
      typeof value,
    )
  ) {
    const error =
      new Error(
        `${label} must be a primitive string/number/boolean value.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CUE_VALUE_INVALID";

    throw error;
  }

  if (
    typeof value === "string"
    && !value.trim()
  ) {
    const error =
      new Error(
        `${label} must not be an empty string.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CUE_VALUE_INVALID";

    throw error;
  }

  return typeof value === "string"
    ? value.trim()
    : value;
}

function samePrimitive(
  left,
  right,
) {
  return typeof left === typeof right
    && left === right;
}

function escapeJsonPointerToken(token) {
  return String(token)
    .replaceAll("~", "~0")
    .replaceAll("/", "~1");
}

function flattenPrimitiveLeaves(
  value,
  basePath = "",
  result = [],
) {
  if (
    [
      "string",
      "number",
      "boolean",
    ].includes(
      typeof value,
    )
  ) {
    if (
      typeof value !== "string"
      || value.trim()
    ) {
      result.push({
        path:
          basePath,
        value:
          typeof value === "string"
            ? value.trim()
            : value,
      });
    }

    return result;
  }

  if (Array.isArray(value)) {
    value.forEach(
      (item, index) => {
        flattenPrimitiveLeaves(
          item,
          `${basePath}/${index}`,
          result,
        );
      },
    );

    return result;
  }

  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenPrimitiveLeaves(
        child,
        `${basePath}/${escapeJsonPointerToken(key)}`,
        result,
      );
    }
  }

  return result;
}

function assertNoForbiddenInputFields(input) {
  const source =
    object(input);

  const present =
    forbiddenInputFields.filter(
      (field) =>
        Object.hasOwn(
          source,
          field,
        ),
    );

  if (present.length) {
    const error =
      new Error(
        `R4E2 source-set construction rejects hidden/unmaterialized inputs: ${present.join(", ")}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_HIDDEN_INPUT_FORBIDDEN";

    error.fields =
      present;

    throw error;
  }
}

function sourceRef(
  queryId,
  stepIndex,
  sourceKind,
  lineage,
  value,
) {
  return `retrieval_cue_source_${hashAgentRunValue({
    version:
      worldSimulationGroundedRetrievalCueConstructionVersion,
    query_id:
      queryId,
    step_index:
      stepIndex,
    source_kind:
      sourceKind,
    lineage,
    value,
  }).slice(0, 24)}`;
}

function pushSource(
  target,
  seen,
  queryId,
  stepIndex,
  sourceKind,
  value,
  lineage,
) {
  const primitive =
    primitiveValue(
      value,
      "source material value",
    );

  const ref =
    sourceRef(
      queryId,
      stepIndex,
      sourceKind,
      lineage,
      primitive,
    );

  if (seen.has(ref)) {
    return;
  }

  seen.add(ref);

  target.push({
    source_ref:
      ref,
    source_kind:
      sourceKind,
    value:
      primitive,
    lineage:
      cloneJson(lineage),
  });
}

function normalizedSourceSetBody(
  source,
) {
  return {
    schema_version:
      groundedRetrievalCueConstructionEvidenceSchemaVersion,
    version:
      worldSimulationGroundedRetrievalCueConstructionVersion,
    query_id:
      source.query_id,
    step_index:
      source.step_index,
    sources:
      cloneJson(
        array(
          source.sources,
        ),
      ),
    boundaries:
      cloneJson(
        object(
          source.boundaries,
        ),
      ),
    immutable:
      true,
  };
}

function assertSourceSet(raw) {
  const source =
    object(raw);

  if (
    source.version
    !== worldSimulationGroundedRetrievalCueConstructionVersion
  ) {
    const error =
      new Error(
        "R4E2 source-set version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_SOURCE_SET_VERSION_MISMATCH";

    throw error;
  }

  const body =
    normalizedSourceSetBody(
      source,
    );

  const actualHash =
    hashAgentRunValue(
      body,
    );

  if (
    actualHash
    !== source.source_set_hash
  ) {
    const error =
      new Error(
        "R4E2 source-set hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_SOURCE_SET_HASH_MISMATCH";

    throw error;
  }

  if (
    source.source_set_id
    !== `retrieval_cue_source_set_${actualHash.slice(0, 24)}`
  ) {
    const error =
      new Error(
        "R4E2 source-set id mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_SOURCE_SET_ID_MISMATCH";

    throw error;
  }

  return source;
}

function proposalBody(
  queryId,
  stepIndex,
  sourceSet,
  raw,
  proposalIndex,
) {
  if (!isObject(raw)) {
    const error =
      new Error(
        `cue_proposals[${proposalIndex}] must be an object.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PROPOSAL_INVALID";

    throw error;
  }

  const allowedProposalFields =
    new Set([
      "proposal_ref",
      "transformation",
      "parent_refs",
      "cue",
    ]);

  const unknownProposalFields =
    Object.keys(raw)
      .filter(
        (key) =>
          !allowedProposalFields.has(key),
      );

  if (unknownProposalFields.length) {
    const error =
      new Error(
        `R4E2 cue proposal contains unsupported fields: ${unknownProposalFields.join(", ")}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PROPOSAL_FIELD_FORBIDDEN";

    error.fields =
      unknownProposalFields;

    throw error;
  }

  const proposalRef =
    requiredString(
      raw.proposal_ref,
      `cue_proposals[${proposalIndex}].proposal_ref`,
    );

  const transformation =
    requiredString(
      raw.transformation,
      `cue_proposals[${proposalIndex}].transformation`,
    );

  if (
    transformation
    === "semantic_association"
  ) {
    const error =
      new Error(
        "R4E2 v1 does not model free semantic association without separately materialized semantic access.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_SEMANTIC_ACCESS_NOT_MATERIALIZED";

    throw error;
  }

  if (
    !allowedTransformations.has(
      transformation,
    )
  ) {
    const error =
      new Error(
        `Unsupported R4E2 cue transformation: ${transformation}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_TRANSFORMATION_INVALID";

    throw error;
  }

  const parentRefs =
    array(
      raw.parent_refs,
    ).map(
      (value, index) =>
        requiredString(
          value,
          `cue_proposals[${proposalIndex}].parent_refs[${index}]`,
        ),
    );

  if (!parentRefs.length) {
    const error =
      new Error(
        "R4E2 cue proposition requires at least one immediate materialized parent.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PARENT_REQUIRED";

    throw error;
  }

  if (
    new Set(parentRefs).size
    !== parentRefs.length
  ) {
    const error =
      new Error(
        "R4E2 cue proposition parent refs must be unique.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PARENT_DUPLICATE";

    throw error;
  }

  const sourceByRef =
    new Map(
      array(
        sourceSet.sources,
      ).map(
        (source) => [
          source.source_ref,
          source,
        ],
      ),
    );

  const parents =
    parentRefs.map(
      (ref) => {
        const parent =
          sourceByRef.get(ref);

        if (!parent) {
          const error =
            new Error(
              `R4E2 cue proposition references unavailable materialized parent ${ref}.`,
            );

          error.code =
            "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PARENT_OUTSIDE_SOURCE_SET";

          throw error;
        }

        return parent;
      },
    );

  if (
    transformation === "combination"
    && parentRefs.length < 2
  ) {
    const error =
      new Error(
        "R4E2 combination requires at least two immediate parents.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_COMBINATION_PARENT_COUNT_INVALID";

    throw error;
  }

  const cue =
    object(
      raw.cue,
    );

  const allowedCueFields =
    new Set([
      "kind",
      "value",
    ]);

  const unknownCueFields =
    Object.keys(cue)
      .filter(
        (key) =>
          !allowedCueFields.has(key),
      );

  if (unknownCueFields.length) {
    const error =
      new Error(
        `R4E2 cue surface contains unsupported fields: ${unknownCueFields.join(", ")}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CUE_FIELD_FORBIDDEN";

    error.fields =
      unknownCueFields;

    throw error;
  }

  const cueKind =
    requiredString(
      cue.kind,
      `cue_proposals[${proposalIndex}].cue.kind`,
    );

  if (
    cueKind === "internally_reinstated"
    || !allowedCueKinds.has(cueKind)
  ) {
    const error =
      new Error(
        `Unsupported R4E2 cue kind: ${cueKind}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CUE_KIND_INVALID";

    throw error;
  }

  const cueValue =
    primitiveValue(
      cue.value,
      `cue_proposals[${proposalIndex}].cue.value`,
    );

  if (
    transformation === "extraction"
    && (
      parentRefs.length !== 1
      || !samePrimitive(
        cueValue,
        parents[0].value,
      )
    )
  ) {
    const error =
      new Error(
        "R4E2 extraction must reproduce exactly one materialized parent value; reinterpretation requires another transformation.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_EXTRACTION_NOT_EXACT";

    throw error;
  }

  if (
    transformation === "context_reinstatement"
    && !parents.some(
      (parent) =>
        samePrimitive(
          cueValue,
          parent.value,
        ),
    )
  ) {
    const error =
      new Error(
        "R4E2 context_reinstatement must reinstate a value that is actually present in its immediate materialized parents.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CONTEXT_REINSTATEMENT_NOT_GROUNDED";

    throw error;
  }

  return {
    proposal_ref:
      proposalRef,
    transformation,
    parent_refs:
      parentRefs,
    cue: {
      kind:
        cueKind,
      value:
        cueValue,
    },
  };
}

function normalizedEvidenceBody(
  source,
) {
  return {
    schema_version:
      source.schema_version,
    version:
      source.version,
    query_id:
      source.query_id,
    step_index:
      source.step_index,
    source_set_id:
      source.source_set_id,
    source_set_hash:
      source.source_set_hash,
    cue_options:
      cloneJson(
        array(
          source.cue_options,
        ),
      ),
    observation:
      cloneJson(
        object(
          source.observation,
        ),
      ),
    boundaries:
      cloneJson(
        object(
          source.boundaries,
        ),
      ),
    immutable:
      true,
  };
}

export function buildWorldSimulationGroundedRetrievalCueConstructionContract() {
  return deepFreeze({
    version:
      worldSimulationGroundedRetrievalCueConstructionVersion,
    phase:
      "Phase64A-R4E2",
    status:
      "grounded_retrieval_cue_construction_and_controlled_transition_v1",
    source_material_requires_current_character_access:
      true,
    source_material_classes: [
      "recovered_content",
      "bounded_perception",
      "retrieval_goal",
      "prior_selected_cue_proposition",
    ],
    whole_character_knowledge_snapshot_exposed:
      false,
    full_memory_record_exposed:
      false,
    unrecovered_memory_content_exposed:
      false,
    engine_world_knowledge_exposed:
      false,
    future_event_queue_exposed:
      false,
    character_state_exposed_to_cue_construction:
      false,
    hidden_semantic_graph_traversal_allowed:
      false,
    free_semantic_association_without_materialized_semantic_access:
      false,
    semantic_accessibility_scalar_invented:
      false,
    fixed_derivation_depth:
      false,
    immediate_parent_provenance_required:
      true,
    prior_selected_cue_propositions_may_become_parents:
      true,
    unselected_counterfactual_cue_options_become_future_parents:
      false,
    cue_proposition_is_recovered_fact:
      false,
    cue_proposition_truth_verified:
      false,
    cue_proposition_persisted_as_semantic_knowledge:
      false,
    cue_proposition_persisted_as_episodic_memory:
      false,
    resolver_may_author_cue_proposition:
      true,
    resolver_may_author_reinstated_cue_directly:
      false,
    resolver_may_select_active_cue:
      false,
    continuation_selection_remains_separate:
      true,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    stop_decision_authority:
      false,
    continuation_decision_authority:
      false,
    new_attempt_creation_authority:
      false,
    persistent_memory_mutation_authority:
      false,
    supported_transformations:
      [...allowedTransformations],
    unsupported_without_future_semantic_access: [
      "semantic_association",
      "schema_fact_lookup",
      "hidden_semantic_graph_expansion",
    ],
  });
}

export function buildWorldSimulationGroundedRetrievalCueConstructionSourceSet(
  input = {},
) {
  assertNoForbiddenInputFields(
    input,
  );

  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const stepIndex =
    nonNegativeInteger(
      input.step_index,
      "step_index",
    );

  const sources = [];
  const seen =
    new Set();

  for (
    const [
      fragmentIndex,
      fragment,
    ]
    of array(
      input.recovered_fragments,
    ).entries()
  ) {
    if (!isObject(fragment)) {
      const error =
        new Error(
          `recovered_fragments[${fragmentIndex}] must be an object.`,
        );

      error.code =
        "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_RECOVERED_FRAGMENT_INVALID";

      throw error;
    }

    const fragmentId =
      requiredString(
        fragment.fragment_id,
        `recovered_fragments[${fragmentIndex}].fragment_id`,
      );

    const sourceMemoryRef =
      requiredString(
        fragment.source_memory_ref,
        `recovered_fragments[${fragmentIndex}].source_memory_ref`,
      );

    for (
      const leaf
      of flattenPrimitiveLeaves(
        fragment.content,
      )
    ) {
      pushSource(
        sources,
        seen,
        queryId,
        stepIndex,
        "recovered_content",
        leaf.value,
        {
          source_fragment_id:
            fragmentId,
          source_memory_ref:
            sourceMemoryRef,
          materialized_content_path:
            leaf.path,
        },
      );
    }
  }

  for (
    const leaf
    of flattenPrimitiveLeaves(
      input.perception,
    )
  ) {
    pushSource(
      sources,
      seen,
      queryId,
      stepIndex,
      "bounded_perception",
      leaf.value,
      {
        materialized_perception_path:
          leaf.path,
      },
    );
  }

  for (
    const leaf
    of flattenPrimitiveLeaves(
      input.retrieval_goal,
    )
  ) {
    pushSource(
      sources,
      seen,
      queryId,
      stepIndex,
      "retrieval_goal",
      leaf.value,
      {
        materialized_goal_path:
          leaf.path,
      },
    );
  }

  for (
    const [
      propositionIndex,
      proposition,
    ]
    of array(
      input.prior_selected_cue_propositions,
    ).entries()
  ) {
    if (!isObject(proposition)) {
      const error =
        new Error(
          `prior_selected_cue_propositions[${propositionIndex}] must be an object.`,
        );

      error.code =
        "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PRIOR_PROPOSITION_INVALID";

      throw error;
    }

    const propositionId =
      requiredString(
        proposition.cue_proposition_id,
        `prior_selected_cue_propositions[${propositionIndex}].cue_proposition_id`,
      );

    const cue =
      object(
        proposition.cue,
      );

    const value =
      primitiveValue(
        cue.value,
        `prior_selected_cue_propositions[${propositionIndex}].cue.value`,
      );

    pushSource(
      sources,
      seen,
      queryId,
      stepIndex,
      "prior_selected_cue_proposition",
      value,
      {
        cue_proposition_id:
          propositionId,
        cue_kind:
          requiredString(
            cue.kind,
            `prior_selected_cue_propositions[${propositionIndex}].cue.kind`,
          ),
        source_construction_evidence_hash:
          optionalString(
            proposition.source_construction_evidence_hash,
          ),
        source_transformation:
          optionalString(
            proposition.transformation,
          ),
        source_parent_refs:
          cloneJson(
            array(
              proposition.parent_refs,
            ),
          ),
      },
    );
  }

  const body = {
    schema_version:
      groundedRetrievalCueConstructionEvidenceSchemaVersion,
    version:
      worldSimulationGroundedRetrievalCueConstructionVersion,
    query_id:
      queryId,
    step_index:
      stepIndex,
    sources,
    boundaries: {
      actual_materialized_sources_only:
        true,
      recovered_content_is_actual_recovery_only:
        true,
      bounded_perception_only:
        true,
      retrieval_goal_is_character_known_material:
        true,
      prior_cue_propositions_selected_only:
        true,
      full_memory_record_exposed:
        false,
      unrecovered_memory_content_exposed:
        false,
      character_state_exposed:
        false,
      world_state_exposed:
        false,
      future_event_queue_exposed:
        false,
      all_character_knowledge_exposed:
        false,
      semantic_graph_exposed:
        false,
    },
    immutable:
      true,
  };

  const sourceSetHash =
    hashAgentRunValue(
      body,
    );

  return deepFreeze({
    ...body,
    source_set_id:
      `retrieval_cue_source_set_${sourceSetHash.slice(0, 24)}`,
    source_set_hash:
      sourceSetHash,
  });
}

export function buildWorldSimulationGroundedRetrievalCueConstructionResolverView(
  sourceSet,
) {
  const source =
    assertSourceSet(
      sourceSet,
    );

  return deepFreeze({
    version:
      source.version,
    source_set_id:
      source.source_set_id,
    query_id:
      source.query_id,
    step_index:
      source.step_index,
    source_material:
      cloneJson(
        source.sources,
      ),
    boundaries: {
      source_material_is_currently_character_accessible:
        true,
      source_material_may_be_used_as_immediate_parent_only:
        true,
      cue_proposition_does_not_assert_truth:
        true,
      cue_proposition_does_not_assert_recovery:
        true,
      control_action_not_allowed:
        true,
      selected_active_cue_not_allowed:
        true,
      character_state_not_visible:
        true,
      full_memory_records_not_visible:
        true,
      unrecovered_memory_content_not_visible:
        true,
      world_state_not_visible:
        true,
      semantic_graph_not_visible:
        true,
      future_event_queue_not_visible:
        true,
    },
  });
}

export function materializeWorldSimulationGroundedRetrievalCueConstructionEvidence(
  input = {},
) {
  const sourceSet =
    assertSourceSet(
      input.source_set,
    );

  const resolution =
    input.resolution === null
    || input.resolution === undefined
      ? {}
      : object(
        input.resolution,
      );

  if (
    input.resolution !== null
    && input.resolution !== undefined
    && !isObject(
      input.resolution,
    )
  ) {
    const error =
      new Error(
        "R4E2 cue-construction resolver must return an object.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_RESOLUTION_INVALID";

    throw error;
  }

  const forbiddenPresent =
    forbiddenResolutionFields.filter(
      (field) =>
        Object.hasOwn(
          resolution,
          field,
        ),
    );

  if (forbiddenPresent.length) {
    const error =
      new Error(
        `R4E2 cue-construction stage may construct propositions but may not exercise control authority: ${forbiddenPresent.join(", ")}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_CONTROL_AUTHORITY_FORBIDDEN";

    error.fields =
      forbiddenPresent;

    throw error;
  }

  const allowedResolutionFields =
    new Set([
      "cue_proposals",
    ]);

  const unknownResolutionFields =
    Object.keys(resolution)
      .filter(
        (key) =>
          !allowedResolutionFields.has(key),
      );

  if (unknownResolutionFields.length) {
    const error =
      new Error(
        `R4E2 cue-construction resolution contains unsupported fields: ${unknownResolutionFields.join(", ")}.`,
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_RESOLUTION_FIELD_FORBIDDEN";

    error.fields =
      unknownResolutionFields;

    throw error;
  }

  const proposalRefs =
    new Set();

  const cueOptions =
    array(
      resolution.cue_proposals,
    ).map(
      (raw, proposalIndex) => {
        const normalized =
          proposalBody(
            sourceSet.query_id,
            sourceSet.step_index,
            sourceSet,
            raw,
            proposalIndex,
          );

        if (
          proposalRefs.has(
            normalized.proposal_ref,
          )
        ) {
          const error =
            new Error(
              `Duplicate R4E2 cue proposal_ref: ${normalized.proposal_ref}.`,
            );

          error.code =
            "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_PROPOSAL_DUPLICATE";

          throw error;
        }

        proposalRefs.add(
          normalized.proposal_ref,
        );

        const cuePropositionId =
          `retrieval_cue_proposition_${hashAgentRunValue({
            version:
              worldSimulationGroundedRetrievalCueConstructionVersion,
            query_id:
              sourceSet.query_id,
            step_index:
              sourceSet.step_index,
            source_set_hash:
              sourceSet.source_set_hash,
            proposal:
              normalized,
          }).slice(0, 24)}`;

        const cueOptionId =
          `memory_retrieval_cue_option_${hashAgentRunValue({
            version:
              worldSimulationGroundedRetrievalCueConstructionVersion,
            cue_proposition_id:
              cuePropositionId,
            cue:
              normalized.cue,
          }).slice(0, 24)}`;

        return {
          cue_option_id:
            cueOptionId,
          cue_proposition_id:
            cuePropositionId,
          cue:
            cloneJson(
              normalized.cue,
            ),
          construction: {
            controlled_cue_construction:
              true,
            proposal_ref:
              normalized.proposal_ref,
            transformation:
              normalized.transformation,
            parent_refs:
              cloneJson(
                normalized.parent_refs,
              ),
            local_derivation:
              true,
            proposition_status:
              "retrieval_cue_proposition",
            proposition_truth_verified:
              false,
            recovered_fact_asserted:
              false,
            semantic_knowledge_asserted:
              false,
          },
          grounding: {
            source_set_id:
              sourceSet.source_set_id,
            source_set_hash:
              sourceSet.source_set_hash,
            immediate_parent_refs:
              cloneJson(
                normalized.parent_refs,
              ),
          },
        };
      },
    );

  const body = {
    schema_version:
      groundedRetrievalCueConstructionEvidenceSchemaVersion,
    version:
      worldSimulationGroundedRetrievalCueConstructionVersion,
    query_id:
      sourceSet.query_id,
    step_index:
      sourceSet.step_index,
    source_set_id:
      sourceSet.source_set_id,
    source_set_hash:
      sourceSet.source_set_hash,
    cue_options:
      cueOptions,
    observation: {
      materialized_source_count:
        sourceSet.sources.length,
      constructed_cue_option_count:
        cueOptions.length,
      recursive_parent_available:
        sourceSet.sources.some(
          (source) =>
            source.source_kind
            === "prior_selected_cue_proposition",
        ),
    },
    boundaries: {
      source_material_requires_current_character_access:
        true,
      immediate_parent_provenance_required:
        true,
      fixed_derivation_depth:
        false,
      hidden_semantic_graph_traversal_used:
        false,
      free_semantic_association_without_materialized_semantic_access:
        false,
      cue_proposition_truth_verified:
        false,
      cue_proposition_is_recovered_fact:
        false,
      cue_proposition_is_semantic_knowledge:
        false,
      persistent_memory_mutated:
        false,
      retrieval_contact_authority:
        false,
      retrieval_recovery_authority:
        false,
      cue_selection_authority:
        false,
      continuation_decision_authority:
        false,
      stop_decision_authority:
        false,
      new_attempt_creation_authority:
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
    cue_construction_evidence_id:
      `retrieval_cue_construction_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

export function validateWorldSimulationGroundedRetrievalCueConstructionEvidence(
  evidence,
) {
  const source =
    object(
      evidence,
    );

  if (
    source.version
    !== worldSimulationGroundedRetrievalCueConstructionVersion
  ) {
    const error =
      new Error(
        "R4E2 cue-construction evidence version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_EVIDENCE_VERSION_MISMATCH";

    throw error;
  }

  const body =
    normalizedEvidenceBody(
      source,
    );

  const actualHash =
    hashAgentRunValue(
      body,
    );

  if (
    actualHash
    !== source.evidence_hash
  ) {
    const error =
      new Error(
        "R4E2 cue-construction evidence hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_EVIDENCE_HASH_MISMATCH";

    throw error;
  }

  if (
    source.cue_construction_evidence_id
    !== `retrieval_cue_construction_${actualHash.slice(0, 24)}`
  ) {
    const error =
      new Error(
        "R4E2 cue-construction evidence id mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_GROUNDED_RETRIEVAL_CUE_CONSTRUCTION_EVIDENCE_ID_MISMATCH";

    throw error;
  }

  return deepFreeze(
    cloneJson(
      source,
    ),
  );
}

export function buildWorldSimulationGroundedRetrievalCueConstructionPriorPropositions(
  selectedOptions,
  constructionEvidenceHash,
) {
  const result = [];

  for (
    const option
    of array(
      selectedOptions,
    )
  ) {
    if (
      option
        ?.construction
        ?.controlled_cue_construction
      !== true
    ) {
      continue;
    }

    result.push({
      cue_proposition_id:
        requiredString(
          option.cue_proposition_id,
          "selected constructed cue proposition id",
        ),
      cue:
        cloneJson(
          option.cue,
        ),
      transformation:
        option.construction
          .transformation
        ?? null,
      parent_refs:
        cloneJson(
          array(
            option.construction
              .parent_refs,
          ),
        ),
      source_construction_evidence_hash:
        requiredString(
          constructionEvidenceHash,
          "constructionEvidenceHash",
        ),
    });
  }

  return deepFreeze(
    result,
  );
}
