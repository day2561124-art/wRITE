import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationRetrievalCueOrientationEvidenceVersion =
  "phase64a-r4b1-retrieval-cue-orientation-evidence-v1";

export const retrievalCueOrientationEvidenceSchemaVersion =
  "phase64a-r4b1-retrieval-cue-orientation-evidence-v1";

export const retrievalCueOrientationOptionSetVersion =
  "phase64a-r4b1-retrieval-cue-orientation-option-set-v1";

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
  code = "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_INVALID",
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

function cueIdentity(cue) {
  return JSON.stringify([
    cue?.kind
      ?? null,
    cue?.value
      ?? null,
  ]);
}

function cueSources(cue) {
  return [
    ...new Set(
      [
        ...array(
          cue?.sources,
        ),
        cue?.source,
      ]
        .map(
          optionalString,
        )
        .filter(Boolean),
    ),
  ];
}

function primitiveSurfaceValue(value) {
  if (
    [
      "string",
      "number",
      "boolean",
    ].includes(
      typeof value,
    )
  ) {
    return cloneJson(
      value,
    );
  }

  return null;
}

function characterSafeSurface(cue) {
  const kind =
    optionalString(
      cue?.kind,
    );

  const sources =
    cueSources(
      cue,
    );

  const value =
    primitiveSurfaceValue(
      cue?.value,
    );

  if (
    kind === "spatial_context"
    && sources.includes(
      "current_environment",
    )
  ) {
    return {
      character_surface: {
        kind:
          "spatial_context",
        representation:
          "current_surroundings",
      },
      provenance_class:
        "current_environment",
    };
  }

  if (
    sources.includes(
      "bounded_perception",
    )
  ) {
    if (
      kind
      === "perceptual_modality"
      && value !== null
    ) {
      return {
        character_surface: {
          kind:
            "perceptual_modality",
          representation:
            `current_${String(value)}_perception`,
        },
        provenance_class:
          "bounded_perception",
      };
    }

    if (
      kind
      === "observation_kind"
    ) {
      return {
        character_surface: {
          kind:
            "observation_kind",
          representation:
            "current_perceived_information",
        },
        provenance_class:
          "bounded_perception",
      };
    }
  }

  const characterKnownSource =
    [
      "explicit_retrieval_context",
      "prior_retrieval_context",
      "explicit_retrieval_goal",
    ].find(
      (source) =>
        sources.includes(
          source,
        ),
    )
    ?? null;

  if (
    characterKnownSource
    && kind
    && value !== null
  ) {
    return {
      character_surface: {
        kind,
        representation:
          value,
      },
      provenance_class:
        characterKnownSource,
    };
  }

  return null;
}

function assertCanonicalCue(
  raw,
  index,
) {
  if (!isObject(raw)) {
    const error =
      new Error(
        `active_cues[${index}] must be an object.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ACTIVE_CUE_INVALID";

    throw error;
  }

  const kind =
    requiredString(
      raw.kind,
      `active_cues[${index}].kind`,
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ACTIVE_CUE_INVALID",
    );

  if (
    ![
      "string",
      "number",
      "boolean",
    ].includes(
      typeof raw.value,
    )
  ) {
    const error =
      new Error(
        `active_cues[${index}].value must be primitive.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ACTIVE_CUE_INVALID";

    throw error;
  }

  return {
    ...cloneJson(
      raw,
    ),
    kind,
  };
}

export function buildWorldSimulationRetrievalCueOrientationContract() {
  return deepFreeze({
    version:
      worldSimulationRetrievalCueOrientationEvidenceVersion,
    phase:
      "Phase64A-R4B1",
    status:
      "grounded_retrieval_cue_orientation_evidence",
    trigger_and_orientation_distinguished:
      true,
    deliberate_orientation_supported:
      true,
    spontaneous_strategic_orientation_allowed:
      false,
    deliberate_zero_explicit_orientation_supported:
      true,
    unresolved_spontaneous_trigger_supported:
      true,
    orientation_is_process_wide_baseline:
      true,
    orientation_maintenance_mode:
      "process_goal_stable_v1",
    grounded_option_ref_selection_required:
      true,
    resolver_authored_cue_content_allowed:
      false,
    character_safe_cue_projection_required:
      true,
    raw_engine_cue_identity_exposed_to_resolver:
      false,
    phase64a_r4a_diagnosticity_exposed_to_orientation_selector:
      false,
    candidate_competition_exposed_to_orientation_selector:
      false,
    attention_weight_modeled:
      false,
    candidate_membership_authority:
      false,
    candidate_order_authority:
      false,
    retrieval_contact_authority:
      false,
    retrieval_recovery_authority:
      false,
    retrieval_probability_modeled:
      false,
    persistent_memory_mutation_authority:
      false,
    character_brain_exposure_allowed:
      false,
  });
}

export function buildWorldSimulationRetrievalCueOrientationOptions(
  input = {},
) {
  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const sourceFrontierId =
    requiredString(
      input.source_frontier_id,
      "source_frontier_id",
    );

  const activeCues =
    array(
      input.active_cues,
    );

  const seenIdentities =
    new Set();

  const engineOptions = [];
  const omitted = [];

  activeCues.forEach(
    (
      rawCue,
      index,
    ) => {
      const cue =
        assertCanonicalCue(
          rawCue,
          index,
        );

      const identity =
        cueIdentity(
          cue,
        );

      if (
        seenIdentities.has(
          identity,
        )
      ) {
        const error =
          new Error(
            `Duplicate canonical active cue identity: ${identity}`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ACTIVE_CUE_DUPLICATE";

        throw error;
      }

      seenIdentities.add(
        identity,
      );

      const safe =
        characterSafeSurface(
          cue,
        );

      if (!safe) {
        omitted.push({
          cue_identity_hash:
            hashAgentRunValue(
              identity,
            ),
          reason:
            "character_safe_representation_unavailable",
        });

        return;
      }

      const cueOptionId =
        `memory_orientation_cue_${hashAgentRunValue({
          version:
            retrievalCueOrientationOptionSetVersion,
          query_id:
            queryId,
          source_frontier_id:
            sourceFrontierId,
          cue_identity:
            identity,
          character_surface:
            safe.character_surface,
        }).slice(0, 24)}`;

      engineOptions.push({
        cue_option_id:
          cueOptionId,
        allowed_uses: [
          "trigger",
          "orientation",
        ],
        canonical_cue_identity:
          identity,
        canonical_cue:
          cloneJson(
            cue,
          ),
        character_surface:
          cloneJson(
            safe.character_surface,
          ),
        provenance_class:
          safe.provenance_class,
      });
    },
  );

  const optionSetBody = {
    version:
      retrievalCueOrientationOptionSetVersion,
    query_id:
      queryId,
    source_frontier_id:
      sourceFrontierId,
    options:
      engineOptions,
    omitted_count:
      omitted.length,
    omitted,
  };

  const optionSetHash =
    hashAgentRunValue(
      optionSetBody,
    );

  return deepFreeze({
    ...optionSetBody,
    option_set_hash:
      optionSetHash,
    immutable:
      true,
  });
}

function assertOptionSet(
  optionSet,
) {
  const source =
    object(
      optionSet,
    );

  if (
    source.version
    !== retrievalCueOrientationOptionSetVersion
  ) {
    const error =
      new Error(
        "Retrieval cue orientation option-set version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_OPTION_SET_VERSION_MISMATCH";

    throw error;
  }

  const body = {
    version:
      source.version,
    query_id:
      source.query_id,
    source_frontier_id:
      source.source_frontier_id,
    options:
      cloneJson(
        array(
          source.options,
        ),
      ),
    omitted_count:
      Number(
        source.omitted_count
        ?? 0,
      ),
    omitted:
      cloneJson(
        array(
          source.omitted,
        ),
      ),
  };

  const actualHash =
    hashAgentRunValue(
      body,
    );

  if (
    source.option_set_hash
    !== actualHash
  ) {
    const error =
      new Error(
        "Retrieval cue orientation option-set hash mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_OPTION_SET_HASH_MISMATCH";

    throw error;
  }

  return source;
}

export function buildWorldSimulationRetrievalCueOrientationResolverOptions(
  optionSet,
) {
  const source =
    assertOptionSet(
      optionSet,
    );

  return deepFreeze(
    array(
      source.options,
    ).map(
      (option) => ({
        cue_option_id:
          option.cue_option_id,
        allowed_uses:
          cloneJson(
            option.allowed_uses,
          ),
        character_surface:
          cloneJson(
            option.character_surface,
          ),
        provenance_class:
          option.provenance_class
          ?? null,
      }),
    ),
  );
}

function uniqueSelectedRefs(
  values,
  label,
) {
  const refs =
    array(
      values,
    ).map(
      (value) =>
        requiredString(
          value,
          `${label}[]`,
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_INVALID",
        ),
    );

  const unique =
    new Set(
      refs,
    );

  if (
    unique.size
    !== refs.length
  ) {
    const error =
      new Error(
        `${label} contains duplicate cue option refs.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_DUPLICATE";

    throw error;
  }

  return refs;
}

function groundedSelections(
  refs,
  optionSet,
  requiredUse,
) {
  const byId =
    new Map(
      array(
        optionSet.options,
      ).map(
        (option) => [
          option.cue_option_id,
          option,
        ],
      ),
    );

  return refs.map(
    (ref) => {
      const option =
        byId.get(
          ref,
        );

      if (!option) {
        const error =
          new Error(
            `Cue orientation selection references unknown option ${ref}.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_INVALID";

        throw error;
      }

      if (
        !array(
          option.allowed_uses,
        ).includes(
          requiredUse,
        )
      ) {
        const error =
          new Error(
            `Cue orientation option ${ref} is not allowed for ${requiredUse}.`,
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SELECTION_USE_INVALID";

        throw error;
      }

      return {
        cue_option_id:
          option.cue_option_id,
        canonical_cue_identity:
          option.canonical_cue_identity,
        canonical_cue:
          cloneJson(
            option.canonical_cue,
          ),
        character_surface:
          cloneJson(
            option.character_surface,
          ),
        provenance_class:
          option.provenance_class
          ?? null,
      };
    },
  );
}

function normalizeTrigger(
  raw,
  optionSet,
  triggerOrigin,
) {
  if (
    raw === null
    || raw === undefined
  ) {
    return {
      trigger_origin:
        triggerOrigin,
      grounding_status:
        "unspecified",
      grounded_cue_refs: [],
    };
  }

  if (!isObject(raw)) {
    const error =
      new Error(
        "cue_orientation_resolution.trigger must be an object.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_TRIGGER_INVALID";

    throw error;
  }

  const status =
    requiredString(
      raw.grounding_status,
      "cue_orientation_resolution.trigger.grounding_status",
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_TRIGGER_INVALID",
    );

  if (
    ![
      "grounded",
      "unresolved",
      "unspecified",
    ].includes(
      status,
    )
  ) {
    const error =
      new Error(
        `Unsupported trigger grounding_status: ${status}.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_TRIGGER_INVALID";

    throw error;
  }

  const selectedRefs =
    uniqueSelectedRefs(
      raw.selected_cue_option_refs,
      "cue_orientation_resolution.trigger.selected_cue_option_refs",
    );

  if (
    status === "grounded"
    && !selectedRefs.length
  ) {
    const error =
      new Error(
        "Grounded retrieval trigger requires at least one grounded cue option ref.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_TRIGGER_INVALID";

    throw error;
  }

  if (
    status !== "grounded"
    && selectedRefs.length
  ) {
    const error =
      new Error(
        "Unresolved or unspecified retrieval trigger may not select grounded cue refs.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_TRIGGER_INVALID";

    throw error;
  }

  return {
    trigger_origin:
      triggerOrigin,
    grounding_status:
      status,
    grounded_cue_refs:
      groundedSelections(
        selectedRefs,
        optionSet,
        "trigger",
      ),
  };
}

function normalizeOrientation(
  raw,
  optionSet,
  initiationMode,
) {
  if (
    initiationMode
    === "spontaneous"
  ) {
    if (
      raw !== null
      && raw !== undefined
    ) {
      if (!isObject(raw)) {
        const error =
          new Error(
            "Spontaneous retrieval orientation evidence must be absent or explicitly not_applicable.",
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SPONTANEOUS_ORIENTATION_FORBIDDEN";

        throw error;
      }

      const suppliedStatus =
        optionalString(
          raw.status,
        )
        ?? "not_applicable";

      const selectedRefs =
        uniqueSelectedRefs(
          raw.selected_cue_option_refs,
          "cue_orientation_resolution.orientation.selected_cue_option_refs",
        );

      if (
        suppliedStatus
        !== "not_applicable"
        || selectedRefs.length
      ) {
        const error =
          new Error(
            "Spontaneous retrieval may not carry strategic orientation cues.",
          );

        error.code =
          "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_SPONTANEOUS_ORIENTATION_FORBIDDEN";

        throw error;
      }
    }

    return {
      applicable:
        false,
      status:
        "not_applicable",
      grounded_cue_refs: [],
      maintenance_mode:
        "not_applicable",
    };
  }

  if (
    raw === null
    || raw === undefined
  ) {
    return {
      applicable:
        true,
      status:
        "unspecified",
      grounded_cue_refs: [],
      maintenance_mode:
        "process_goal_stable_v1",
    };
  }

  if (!isObject(raw)) {
    const error =
      new Error(
        "cue_orientation_resolution.orientation must be an object.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ORIENTATION_INVALID";

    throw error;
  }

  const status =
    requiredString(
      raw.status,
      "cue_orientation_resolution.orientation.status",
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ORIENTATION_INVALID",
    );

  if (
    ![
      "selected",
      "no_explicit_orientation",
      "unspecified",
    ].includes(
      status,
    )
  ) {
    const error =
      new Error(
        `Unsupported deliberate orientation status: ${status}.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ORIENTATION_INVALID";

    throw error;
  }

  const selectedRefs =
    uniqueSelectedRefs(
      raw.selected_cue_option_refs,
      "cue_orientation_resolution.orientation.selected_cue_option_refs",
    );

  if (
    status === "selected"
    && !selectedRefs.length
  ) {
    const error =
      new Error(
        "Selected deliberate retrieval orientation requires at least one grounded cue option ref.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ORIENTATION_INVALID";

    throw error;
  }

  if (
    status !== "selected"
    && selectedRefs.length
  ) {
    const error =
      new Error(
        `${status} deliberate retrieval orientation may not carry selected cue refs.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_ORIENTATION_INVALID";

    throw error;
  }

  return {
    applicable:
      true,
    status,
    grounded_cue_refs:
      groundedSelections(
        selectedRefs,
        optionSet,
        "orientation",
      ),
    maintenance_mode:
      "process_goal_stable_v1",
  };
}

export function materializeWorldSimulationRetrievalCueOrientationEvidence(
  input = {},
) {
  const optionSet =
    assertOptionSet(
      input.option_set,
    );

  const queryId =
    requiredString(
      input.query_id,
      "query_id",
    );

  const sourceFrontierId =
    requiredString(
      input.source_frontier_id,
      "source_frontier_id",
    );

  if (
    optionSet.query_id
    !== queryId
    || optionSet.source_frontier_id
    !== sourceFrontierId
  ) {
    const error =
      new Error(
        "Cue orientation option set is not bound to this retrieval query/frontier.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_OPTION_SET_BINDING_MISMATCH";

    throw error;
  }

  const initiation =
    object(
      input.initiation,
    );

  const initiationMode =
    requiredString(
      initiation.mode,
      "initiation.mode",
    );

  if (
    ![
      "deliberate",
      "spontaneous",
    ].includes(
      initiationMode,
    )
  ) {
    const error =
      new Error(
        `Unsupported retrieval initiation mode: ${initiationMode}.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_INITIATION_INVALID";

    throw error;
  }

  const triggerOrigin =
    optionalString(
      initiation.trigger_origin,
    )
    ?? "unspecified";

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
        "cue_orientation_resolution must be an object when present.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_RESOLUTION_INVALID";

    throw error;
  }

  for (
    const forbidden
    of [
      "trigger_cues",
      "orientation_cues",
      "selected_trigger_cues",
      "selected_orientation_cues",
    ]
  ) {
    if (
      Object.hasOwn(
        resolution,
        forbidden,
      )
    ) {
      const error =
        new Error(
          `Cue orientation resolver may select grounded refs but may not author ${forbidden}.`,
        );

      error.code =
        "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_AUTHORED_CUE_FORBIDDEN";

      throw error;
    }
  }

  const trigger =
    normalizeTrigger(
      resolution.trigger,
      optionSet,
      triggerOrigin,
    );

  const orientation =
    normalizeOrientation(
      resolution.orientation,
      optionSet,
      initiationMode,
    );

  const body = {
    schema_version:
      retrievalCueOrientationEvidenceSchemaVersion,
    version:
      worldSimulationRetrievalCueOrientationEvidenceVersion,
    query_id:
      queryId,
    source_initial_frontier_id:
      sourceFrontierId,
    option_set_hash:
      optionSet.option_set_hash,
    initiation_mode:
      initiationMode,
    trigger,
    orientation,
    boundaries: {
      grounded_option_refs_only:
        true,
      attention_weight_modeled:
        false,
      phase64a_r4a_diagnosticity_used_for_selection:
        false,
      candidate_membership_changed:
        false,
      candidate_order_changed:
        false,
      retrieval_contact_changed:
        false,
      retrieval_recovery_changed:
        false,
      retrieval_probability_modeled:
        false,
      persistent_memory_mutated:
        false,
      character_brain_exposure_allowed:
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
    orientation_evidence_id:
      `memory_retrieval_orientation_${evidenceHash.slice(0, 24)}`,
    evidence_hash:
      evidenceHash,
  });
}

function safeSelectedCueView(
  entry,
) {
  return {
    cue_option_id:
      entry?.cue_option_id
      ?? null,
    character_surface:
      cloneJson(
        entry?.character_surface
        ?? null,
      ),
    provenance_class:
      entry?.provenance_class
      ?? null,
  };
}

export function buildWorldSimulationRetrievalCueOrientationCharacterView(
  evidence,
) {
  const source =
    object(
      evidence,
    );

  if (
    source.version
    !== worldSimulationRetrievalCueOrientationEvidenceVersion
  ) {
    const error =
      new Error(
        "Retrieval cue orientation evidence version mismatch.",
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_EVIDENCE_VERSION_MISMATCH";

    throw error;
  }

  return deepFreeze({
    orientation_evidence_id:
      source.orientation_evidence_id
      ?? null,
    trigger: {
      trigger_origin:
        source.trigger
          ?.trigger_origin
        ?? "unspecified",
      grounding_status:
        source.trigger
          ?.grounding_status
        ?? "unspecified",
      selected_cues:
        array(
          source.trigger
            ?.grounded_cue_refs,
        ).map(
          safeSelectedCueView,
        ),
    },
    orientation: {
      applicable:
        source.orientation
          ?.applicable
        === true,
      status:
        source.orientation
          ?.status
        ?? "unspecified",
      maintenance_mode:
        source.orientation
          ?.maintenance_mode
        ?? null,
      selected_cues:
        array(
          source.orientation
            ?.grounded_cue_refs,
        ).map(
          safeSelectedCueView,
        ),
    },
  });
}

export function assertWorldSimulationRetrievalCueOrientationStageBoundary(
  stage,
  rawOutput,
) {
  const normalizedStage =
    requiredString(
      stage,
      "stage",
    );

  if (
    ![
      "recovery",
      "continuation",
    ].includes(
      normalizedStage,
    )
  ) {
    return true;
  }

  const output =
    object(
      rawOutput,
    );

  const forbiddenFields = [
    "cue_orientation_resolution",
    "search_orientation",
    "selected_orientation_cue_refs",
    "selected_trigger_cue_refs",
    "orientation_cue_refs",
    "trigger_cue_refs",
  ];

  const present =
    forbiddenFields.filter(
      (field) =>
        Object.hasOwn(
          output,
          field,
        ),
    );

  if (
    present.length
  ) {
    const error =
      new Error(
        `Retrieval ${normalizedStage} stage may not rewrite process-wide cue orientation evidence.`,
      );

    error.code =
      "WORLD_SIMULATION_RETRIEVAL_CUE_ORIENTATION_PROCESS_WIDE_MUTATION_FORBIDDEN";

    error.fields =
      present;

    throw error;
  }

  return true;
}
