import { performance } from "node:perf_hooks";

import { getAgentRun } from "./agent-run-service.mjs";
import {
  hashNeuralValue,
  recordNeuralWrapperTrace,
} from "./neural-trace-service.mjs";
import {
  assertNeuralSessionRunShape,
  invokeSharedNeuralCoreAdapter,
  neuralSessionModes,
} from "./shared-neural-core-service.mjs";

export const worldSimulationCapabilityNames = Object.freeze([
  "world_scene_causal_analyzer",
  "world_perception_filter",
  "world_memory_retriever",
  "world_character_cognition",
  "world_action_proposer",
  "world_agency_guard",
  "world_consistency_critic",
]);

const capabilitySpecs = Object.freeze({
  world_scene_causal_analyzer: Object.freeze({
    model_name: "local-world-scene-causal-analyzer",
    model_version: "v1.0.0",
    result_type: "world_scene_causal_analysis",
  }),
  world_perception_filter: Object.freeze({
    model_name: "local-world-perception-filter",
    model_version: "v1.0.0",
    result_type: "world_perception_packet",
  }),
  world_memory_retriever: Object.freeze({
    model_name: "local-world-memory-retriever",
    model_version: "v1.0.0",
    result_type: "world_memory_retrieval",
  }),
  world_character_cognition: Object.freeze({
    model_name: "local-world-character-cognition",
    model_version: "v1.0.0",
    result_type: "world_character_cognition",
  }),
  world_action_proposer: Object.freeze({
    model_name: "local-world-action-proposer",
    model_version: "v1.0.0",
    result_type: "world_action_candidates",
  }),
  world_agency_guard: Object.freeze({
    model_name: "local-world-agency-guard",
    model_version: "v1.0.0",
    result_type: "world_agency_guard_report",
  }),
  world_consistency_critic: Object.freeze({
    model_name: "local-world-consistency-critic",
    model_version: "v1.0.0",
    result_type: "world_consistency_report",
  }),
});

export const worldSimulationCommonPermissions = Object.freeze({
  mutate_world_state: false,
  mutate_character_state: false,
  decide_action_outcome: false,
  decide_combat_result: false,
  force_character_action: false,
  choose_story_direction: false,
  optimize_for_drama: false,
  optimize_for_camera: false,
  expose_unobserved_information: false,
  promote_guess_to_fact: false,
  modify_canon: false,
  modify_active_engine: false,
  create_candidate: false,
  adopt_or_settle: false,
});

const permissionsReference = Object.freeze({
  inherits: "world_simulation_common_permissions",
});

export const worldSimulationCapabilityContracts = Object.freeze({
  world_scene_causal_analyzer: Object.freeze({
    module: "world_scene_causal_analyzer",
    purpose: "Normalize local Scene State into causal geometry, interaction constraints, and simultaneous-action adjudication inputs without deciding outcomes.",
    required_inputs: Object.freeze(["scene_state"]),
    optional_inputs: Object.freeze(["simulation_time", "simultaneous_actions"]),
    returns: Object.freeze([
      "scene_identity",
      "spatial_state",
      "interaction_constraints",
      "simultaneous_actions",
      "adjudication_inputs",
    ]),
    permissions: permissionsReference,
  }),
  world_perception_filter: Object.freeze({
    module: "world_perception_filter",
    purpose: "Build one character's perception packet only from explicitly observable sensory inputs and observer-scoped Scene State.",
    required_inputs: Object.freeze(["character", "scene_state"]),
    optional_inputs: Object.freeze(["observations", "sensory_inputs"]),
    returns: Object.freeze([
      "character",
      "observed",
      "audible",
      "other_senses",
      "information_boundary",
    ]),
    permissions: permissionsReference,
  }),
  world_memory_retriever: Object.freeze({
    module:
      "world_memory_retriever",

    purpose:
      "Project an authoritative Phase63B memory-candidate set into bounded Character Brain context without asserting successful recall; keep engine provenance and accessibility diagnostics internal.",

    architecture_role:
      "legacy_candidate_context_projector_preserved_for_direct_compatibility",

    native_phase63c_retrieval_process_owner:
      "world_simulation_memory_retrieval_process_service",

    phase63c_schema_contract_installed:
      true,

    direct_legacy_projector_api_preserved:
      true,

    candidate_content_barrier_enforced_in_native_world_loop:
      true,

    native_world_loop_forwards_projected_content_to_character_brain:
      false,

    required_inputs:
      Object.freeze([
        "character",
        "memory_records",
      ]),

    optional_inputs:
      Object.freeze([
        "query",
        "projection_max_items",
        "projection_policy_origin",
        "max_items",
        "programmatic_memory_accessibility",
      ]),

    returns:
      Object.freeze([
        "character",
        "projected_memories",
        "retrieved_memories",
        "projection_max_items",
        "memory_boundary",
      ]),

    permissions:
      permissionsReference,
  }),
  world_character_cognition: Object.freeze({
    module: "world_character_cognition",
    purpose: "Assemble one character's bounded cognition from perception, actually recovered memory content, emotion, needs, values, relations, attention, and current goals without selecting a world result.",

    native_phase63c_memory_input:
      "recovered_memories",

    legacy_memory_inputs_supported_for_direct_compatibility:
      true,

    required_inputs: Object.freeze(["character", "character_state"]),
    optional_inputs: Object.freeze([
      "perception",
      "recovered_memories",
      "projected_memories",
      "retrieved_memories",
      "decision_context",
    ]),
    returns: Object.freeze([
      "character",
      "recovered_memories",
      "known",
      "uncertain",
      "needs",
      "emotion",
      "attention",
      "goals",
      "decision_pressures",
      "cognition_boundary",
    ]),
    permissions: permissionsReference,
  }),
  world_action_proposer: Object.freeze({
    module: "world_action_proposer",
    purpose: "Return non-binding candidate action intents that a character could choose; outcomes remain owned by the causal simulator.",
    required_inputs: Object.freeze(["character", "available_actions"]),
    optional_inputs: Object.freeze(["cognition", "current_action"]),
    returns: Object.freeze([
      "character",
      "candidate_action_intents",
      "selection_boundary",
      "outcome_boundary",
    ]),
    permissions: permissionsReference,
  }),
  world_agency_guard: Object.freeze({
    module: "world_agency_guard",
    purpose: "Detect requests or control signals that would make narrative, camera, or governance goals choose a character's action.",
    required_inputs: Object.freeze(["decision_request"]),
    optional_inputs: Object.freeze(["character", "camera_context"]),
    returns: Object.freeze(["findings", "agency_boundary"]),
    permissions: permissionsReference,
  }),
  world_consistency_critic: Object.freeze({
    module: "world_consistency_critic",
    purpose: "Review explicit state transitions for missing causes, impossible continuity changes, duplicate ownership, information leaks, or outcome-first shortcuts.",
    required_inputs: Object.freeze(["state_transitions"]),
    optional_inputs: Object.freeze(["object_holders", "knowledge_transitions", "action_outcomes"]),
    returns: Object.freeze(["findings", "consistency_boundary"]),
    permissions: permissionsReference,
  }),
});

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maxChars = 600) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Array.from(trimmed).slice(0, maxChars).join("");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function uniqueStrings(values, maxItems = 24, maxChars = 600) {
  const seen = new Set();
  const output = [];
  for (const item of values.flat(Infinity)) {
    const normalized = text(typeof item === "string" ? item : null, maxChars);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("zh-Hant-TW");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= maxItems) break;
  }
  return output;
}

function observerScopedValue(value, character) {
  if (!isObject(value) || !character) return null;
  if (Object.hasOwn(value, character)) return value[character];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  for (const [key, candidate] of Object.entries(value)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) {
      return candidate;
    }
  }
  return null;
}

function suppliedCharacter(input) {
  return text(
    input.character
      ?? input.character_name
      ?? input.character_state?.character
      ?? input.character_state?.character_name
      ?? input.character_state?.name,
    160,
  );
}

function buildWorldSceneCausalAnalysis(input = {}) {
  const scene = object(input.scene_state);
  const spatial = object(scene.spatial_state);
  const simultaneous = array(
    input.simultaneous_actions ?? scene.simultaneous_actions,
  ).map(cloneJson);
  return {
    result_type: capabilitySpecs.world_scene_causal_analyzer.result_type,
    analysis_status: Object.keys(scene).length
      ? "scene_state_normalized"
      : "insufficient_scene_state",
    simulation_time: input.simulation_time ?? scene.simulation_time ?? null,
    scene_identity: {
      scene_id: scene.scene_id ?? scene.id ?? null,
      location: scene.location ?? scene.name ?? null,
    },
    spatial_state: {
      dimensions: cloneJson(scene.dimensions ?? spatial.dimensions ?? null),
      exits: cloneJson(scene.exits ?? spatial.exits ?? []),
      structures: cloneJson(scene.structures ?? spatial.structures ?? []),
      obstacles: cloneJson(scene.obstacles ?? spatial.obstacles ?? []),
      entity_positions: cloneJson(scene.entity_positions ?? spatial.entity_positions ?? {}),
      object_positions: cloneJson(scene.object_positions ?? spatial.object_positions ?? {}),
      light_sources: cloneJson(scene.light_sources ?? spatial.light_sources ?? []),
    },
    interaction_constraints: cloneJson(
      scene.interaction_constraints
        ?? scene.causal_constraints
        ?? [],
    ),
    simultaneous_actions: simultaneous,
    adjudication_inputs: simultaneous.map((action) => ({
      actor: action?.actor ?? null,
      intent: action?.intent ?? action?.action ?? null,
      start_time: action?.start_time ?? null,
      position: cloneJson(action?.position ?? null),
      speed: action?.speed ?? null,
      preparation: action?.preparation ?? null,
      attention: action?.attention ?? null,
      body_state: cloneJson(action?.body_state ?? null),
      energy_state: cloneJson(action?.energy_state ?? null),
      mechanism: cloneJson(action?.mechanism ?? null),
    })),
    outcome_boundary: "This capability prepares causal adjudication inputs only; it never decides hit, injury, destruction, success, failure, or victory.",
  };
}

function buildWorldPerceptionPacket(input = {}) {
  const scene = object(input.scene_state);
  const character = suppliedCharacter(input);
  const scoped = object(
    observerScopedValue(scene.observable_by, character)
      ?? observerScopedValue(scene.perception_by, character),
  );
  const observations = object(input.observations);
  const sensory = object(input.sensory_inputs);
  const programmaticVisibility = object(input.programmatic_visibility);
  const visibilityEnforced = programmaticVisibility.enforced === true;
  const directionalHeightVisibilityEnforced = visibilityEnforced
    && programmaticVisibility.directional_height_visibility_enforced === true;
  const illuminationVisibilityEnforced = directionalHeightVisibilityEnforced
    && programmaticVisibility.illumination_visibility_enforced === true;
  const programmaticAudibility = object(input.programmatic_audibility);
  const audibilityEnforced = programmaticAudibility.enforced === true;

  const observed = [
    ...array(observations.visual),
    ...array(sensory.visual),
    ...array(programmaticVisibility.visual_observations),
    ...(visibilityEnforced ? [] : array(scoped.visual)),
    ...(visibilityEnforced ? [] : array(scene.public_visual)),
  ].map(cloneJson);
  const audible = [
    ...array(observations.audible),
    ...array(observations.audio),
    ...array(sensory.audible),
    ...array(sensory.audio),
    ...array(programmaticAudibility.auditory_observations),
    ...(audibilityEnforced ? [] : array(scoped.audible)),
    ...(audibilityEnforced ? [] : array(scene.public_audio)),
  ].map(cloneJson);
  const otherSenses = [
    ...array(observations.other_senses),
    ...array(sensory.other_senses),
    ...array(scoped.other_senses),
  ].map(cloneJson);

  return {
    result_type: capabilitySpecs.world_perception_filter.result_type,
    perception_status: character
      ? "observer_bounded"
      : "missing_character",
    character,
    simulation_time: input.simulation_time ?? scene.simulation_time ?? null,
    scene_id: scene.scene_id ?? scene.id ?? null,
    observed,
    audible,
    other_senses: otherSenses,
    information_boundary: {
      observer_scoped: true,
      hidden_scene_fields_read: false,
      other_character_internal_state_read: false,
      private_device_contents_read: false,
      through_wall_vision: false,
      programmatic_visibility_enforced: visibilityEnforced,
      directional_height_visibility_enforced: directionalHeightVisibilityEnforced,
      illumination_visibility_enforced: illuminationVisibilityEnforced,
      programmatic_audibility_enforced: audibilityEnforced,
      raw_scene_visual_sources_bypassed_when_visibility_enforced: visibilityEnforced,
      raw_scene_audio_sources_bypassed_when_audibility_enforced: audibilityEnforced,
      rule: visibilityEnforced && audibilityEnforced
        ? illuminationVisibilityEnforced
          ? "Visual inputs use programmatic line-of-sight, directional FOV, explicit-height occlusion, and explicit illumination thresholds; auditory inputs use programmatic same-scene audibility propagation. Raw scene visual/audio sources are bypassed; explicit caller-provided observer observations and sensory inputs remain allowed."
          : "Visual inputs use programmatic visibility/occlusion refinement; auditory inputs use programmatic same-scene audibility propagation. Raw scene visual/audio sources are bypassed; explicit caller-provided observer observations and sensory inputs remain allowed."
        : visibilityEnforced
          ? illuminationVisibilityEnforced
            ? "Visual inputs are supplied by programmatic line-of-sight, directional FOV, explicit-height occlusion, and explicit illumination-threshold queries. Raw scene visual sources are bypassed; audio and other senses remain observer-scoped inputs."
            : directionalHeightVisibilityEnforced
              ? "Visual inputs are supplied by programmatic line-of-sight, directional FOV, and explicit-height occlusion queries. Raw scene visual sources are bypassed; audio and other senses remain observer-scoped inputs."
              : "Visual inputs are supplied by the programmatic visibility/occlusion query. Raw scene visual sources are bypassed; audio and other senses remain observer-scoped inputs."
          : audibilityEnforced
            ? "Auditory inputs are supplied by programmatic same-scene audibility propagation. Raw scene audio sources are bypassed; explicit caller-provided observer observations and sensory inputs remain allowed."
            : "Only explicit observations, sensory inputs, observer-scoped observable_by/perception_by data, and public scene signals may enter this packet.",
    },
  };
}

function normalizedMemory(record = {}) {
  const source = object(record.source);

  const hasEncodingCertainty =
    Object.hasOwn(
      record,
      "perceptual_certainty_at_encoding",
    );

  const hasEncodingClarity =
    Object.hasOwn(
      record,
      "perceptual_clarity_at_encoding",
    );

  const normalized = {
    memory_id:
      record.memory_id
      ?? record.id
      ?? null,

    content:
      cloneJson(
        record.content
        ?? record.memory
        ?? record.summary
        ?? null,
      ),

    // Character-visible subjective source features only.
    source: {
      kind:
        source.kind
        ?? record.source_kind
        ?? null,

      actor:
        source.actor
        ?? record.source_actor
        ?? null,

      sense:
        source.sense
        ?? null,
    },

    memory_type:
      record.memory_type
      ?? null,

    perceptual_certainty_at_encoding:
      record.perceptual_certainty_at_encoding
      ?? null,

    perceptual_certainty_origin:
      record.perceptual_certainty_origin
      ?? null,

    perceptual_clarity_at_encoding:
      record.perceptual_clarity_at_encoding
      ?? null,

    perceptual_clarity_origin:
      record.perceptual_clarity_origin
      ?? null,

    relevance:
      record.relevance
      ?? null,

    possibly_incorrect:
      record.possibly_incorrect === true,

    source_confused:
      record.source_confused === true,
  };

  // Backward compatibility:
  // legacy/non-Phase63A-v2 memory records may still use the
  // old confidence/clarity schema. Preserve those fields only
  // when the new encoding-time fields are absent.
  if (!hasEncodingCertainty) {
    normalized.confidence =
      record.confidence
      ?? record.certainty
      ?? null;

    normalized.confidence_origin =
      record.confidence_origin
      ?? null;
  }

  if (!hasEncodingClarity) {
    normalized.clarity =
      record.clarity
      ?? record.memory_clarity
      ?? null;

    normalized.clarity_origin =
      record.clarity_origin
      ?? null;
  }

  return normalized;
}

function buildWorldMemoryRetrieval(input = {}) {
  const character =
    suppliedCharacter(
      input,
    );

  const hasCanonicalProjectionMax =
    Object.hasOwn(
      input,
      "projection_max_items",
    )
    && input.projection_max_items
      !== null
    && input.projection_max_items
      !== undefined;

  if (
    hasCanonicalProjectionMax
    && (
      !Number.isSafeInteger(
        input.projection_max_items,
      )
      || input.projection_max_items < 0
      || input.projection_max_items > 32
    )
  ) {
    const error = new Error(
      "projection_max_items must be an integer from 0 through 32.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_PROJECTION_MAX_ITEMS_INVALID";

    throw error;
  }

  const canonicalProjectionMax =
    hasCanonicalProjectionMax
      ? input.projection_max_items
      : null;

  const legacyProjectionMax =
    Number.isSafeInteger(
      input.max_items,
    )
      ? Math.min(
        32,
        Math.max(
          1,
          input.max_items,
        ),
      )
      : null;

  const requestedMax =
    canonicalProjectionMax
    ?? legacyProjectionMax
    ?? 12;

  const projectionMaxOrigin =
    canonicalProjectionMax !== null
      ? text(
        input.projection_policy_origin,
      )
        ?? "explicit_projection_max_items"
      : legacyProjectionMax !== null
        ? "legacy_max_items_alias"
        : "default_projection_limit";

  const programmaticAccessibility =
    object(
      input.programmatic_memory_accessibility,
    );

  const programmaticAccessibilityEnforced =
    programmaticAccessibility
      .accessibility_enforced
    === true
    || programmaticAccessibility
      .enforced
    === true;

  const candidateSetAuthoritative =
    programmaticAccessibility
      .candidate_set_authoritative
    === true;

  const authoritativeCandidates =
    array(
      programmaticAccessibility
        .candidate_memory_records
      ?? programmaticAccessibility
        .memory_records,
    );

  const legacyProgrammaticRecords =
    array(
      programmaticAccessibility
        .memory_records,
    );

  const sourceRecords =
    candidateSetAuthoritative
      ? authoritativeCandidates
      : programmaticAccessibilityEnforced
        ? legacyProgrammaticRecords
        : array(
          input.memory_records,
        );

  const projectionSourceRecords =
    candidateSetAuthoritative
      ? sourceRecords.filter(
        (record) =>
          isObject(record),
      )
      : sourceRecords.filter(
        (record) =>
          isObject(record)
          && record.accessible !== false
          && record.suppressed !== true,
      );

  const projected =
    projectionSourceRecords
      .slice(
        0,
        requestedMax,
      )
      .map(
        normalizedMemory,
      );

  return {
    result_type:
      capabilitySpecs
        .world_memory_retriever
        .result_type,

    retrieval_status:
      character
        ? "accessible_memories_only"
        : "missing_character",

    projection_status:
      character
        ? "memory_context_projected"
        : "missing_character",

    character,

    query:
      cloneJson(
        input.query
        ?? null,
      ),

    candidate_input_count:
      projectionSourceRecords.length,

    projection_max_items:
      requestedMax,

    projection_max_items_origin:
      projectionMaxOrigin,

    projected_memory_count:
      projected.length,

    projected_memories:
      projected,

    // Deprecated compatibility alias.
    // These records are projected context, not proof of
    // successful human-like retrieval.
    retrieved_memories:
      cloneJson(
        projected,
      ),

    memory_boundary: {
      memory_is_not_world_truth:
        true,

      output_is_character_brain_memory_context_projection:
        true,

      actual_retrieval_success_asserted:
        false,

      projection_appends_retrieval_history:
        false,

      projection_updates_recall_count:
        false,

      projection_updates_last_recalled_at:
        false,

      projection_creates_retrieval_event:
        false,

      retrieval_event_owner:
        "Phase63C",

      phase63c_schema_contract_installed:
        true,

      direct_legacy_projector_api_preserved:
        true,

      candidate_content_barrier_enforced_in_native_world_loop:
        true,

      candidate_content_barrier_owner:
        "Phase63C Step2",

      native_world_loop_forwards_projected_content_to_character_brain:
        false,

      native_retrieval_process_execution_installed:
        false,

      projection_budget_is_cognitive_capacity:
        false,

      projection_budget_zero_allowed:
        true,

      authoritative_candidate_set_consumed:
        candidateSetAuthoritative,

      candidate_authority_requires_explicit_flag:
        true,

      enforced_flag_alone_implies_candidate_authority:
        false,

      authoritative_candidate_set_revalidated_by_legacy_accessible_flag:
        false,

      legacy_enforced_programmatic_records_revalidated_by_legacy_accessibility:
        (
          programmaticAccessibilityEnforced
          && !candidateSetAuthoritative
        ),

      raw_memory_records_use_legacy_accessibility_filter_only_without_authoritative_candidates:
        true,

      canonical_projection_limit_invalid_values_rejected:
        true,

      subjective_source_features_preserved:
        true,

      internal_engine_provenance_exposed_to_character_brain:
        false,

      exact_encoding_timestamp_exposed_to_character_brain:
        false,

      exact_recall_timestamp_exposed_to_character_brain:
        false,

      legacy_confidence_preserved_for_legacy_records:
        true,

      legacy_clarity_preserved_for_legacy_records:
        true,

      perceptual_certainty_at_encoding_preserved:
        true,

      perceptual_clarity_at_encoding_preserved:
        true,

      error_and_source_confusion_allowed:
        true,

      direct_perception_subjective_source_features_preserved:
        true,

      memory_type_preserved:
        true,

      encoding_metric_origins_preserved:
        true,

      inaccessible_records_excluded:
        true,

      inaccessible_records_excluded_by_phase63b_when_candidate_set_authoritative:
        candidateSetAuthoritative,

      programmatic_memory_accessibility_enforced:
        programmaticAccessibilityEnforced,

      programmatic_memory_accessibility_version:
        programmaticAccessibility.version
        ?? null,

      retrieval_strength_scores_exposed_to_character_brain:
        false,

      storage_strength_is_not_rewritten_as_retrieval_strength:
        true,

      free_text_query_asserts_retrieval_success:
        false,
    },
  };
}

function stateList(state, ...keys) {
  return uniqueStrings(keys.flatMap((key) => array(state[key])));
}

function buildWorldCharacterCognition(input = {}) {
  const state = object(input.character_state);
  const character = suppliedCharacter(input);
  const perception = object(input.perception);
  const nativeRecoveredMemoryInput =
    Object.hasOwn(
      input,
      "recovered_memories",
    );

  const memories = array(
    nativeRecoveredMemoryInput
      ? input.recovered_memories
      : (
        input.projected_memories
        ?? input.retrieved_memories
        ?? input.memory_retrieval
          ?.projected_memories
        ?? input.memory_retrieval
          ?.retrieved_memories
      ),
  ).map(cloneJson);
  const known = uniqueStrings([
    stateList(state, "known", "known_facts", "observed_facts"),
    array(input.known),
  ]);
  const uncertain = uniqueStrings([
    stateList(state, "guessed", "assumptions", "inferences", "uncertainty"),
    array(input.uncertain),
  ]).filter((item) => !known.includes(item));
  const needs = cloneJson(state.needs ?? input.needs ?? {});
  const emotion = cloneJson(
    state.emotion
      ?? state.current_emotion
      ?? input.emotion
      ?? null,
  );
  const attention = cloneJson(
    state.attention
      ?? input.attention
      ?? null,
  );
  const goals = uniqueStrings([
    array(state.goals),
    array(state.current_goals),
    state.current_goal ? [state.current_goal] : [],
    input.current_goal ? [input.current_goal] : [],
  ]);
  const values = cloneJson(state.values ?? state.value_priorities ?? {});
  const relationships = cloneJson(
    state.relationships
      ?? state.relationship_cognition
      ?? {},
  );
  return {
    result_type: capabilitySpecs.world_character_cognition.result_type,
    cognition_status: character
      ? "bounded_character_state_ready"
      : "missing_character",
    character,
    perception: cloneJson({
      observed: perception.observed ?? [],
      audible: perception.audible ?? [],
      other_senses: perception.other_senses ?? [],
    }),
    recovered_memories:
      memories,

    // Legacy fields are emitted only for legacy direct callers.
    // An explicit recovered_memories input activates the native
    // Phase63C information boundary and prevents these aliases
    // from appearing in cognition.
    ...(
      nativeRecoveredMemoryInput
        ? {}
        : {
          projected_memories:
            cloneJson(
              memories,
            ),

          retrieved_memories:
            cloneJson(
              memories,
            ),
        }
    ),

    known,
    uncertain,
    needs,
    emotion,
    attention,
    goals,
    values,
    relationship_cognition: relationships,
    current_action: cloneJson(state.current_action ?? input.current_action ?? null),
    decision_pressures: cloneJson(
      input.decision_pressures
        ?? state.decision_pressures
        ?? [],
    ),
    cognition_boundary: {
      character_information_isolated: true,
      world_truth_not_injected: true,
      other_character_internal_state_not_injected: true,
      uncertain_not_promoted_to_known: true,
      no_action_outcome_selected:
        true,

      native_recovered_memory_input_authoritative:
        nativeRecoveredMemoryInput,

      legacy_memory_input_fallback_used:
        !nativeRecoveredMemoryInput,

      unretrieved_candidate_content_accepted_when_recovered_input_present:
        false,

      projected_memory_context_is_not_successful_retrieval:
        true,

      memory_projection_budget_is_not_cognitive_capacity:
        true,

      rule:
        "This packet is evidence for ChatGPT's character brain; projected memory context is not proof of successful recall, and the packet cannot mutate the world.",
    },
  };
}

function normalizeAction(action, index) {
  if (typeof action === "string") {
    return {
      action_id: `candidate_${index + 1}`,
      intent: action,
      prerequisites: [],
      known_costs: [],
      blocked_by: [],
    };
  }
  const value = object(action);
  return {
    action_id: value.action_id ?? value.id ?? `candidate_${index + 1}`,
    intent: value.intent ?? value.action ?? value.label ?? null,
    prerequisites: cloneJson(value.prerequisites ?? []),
    known_costs: cloneJson(value.known_costs ?? value.costs ?? []),
    blocked_by: cloneJson(value.blocked_by ?? value.blockers ?? []),
    duration_estimate: value.duration_estimate ?? value.duration ?? null,
    duration_ms: value.duration_ms ?? null,
    duration_s: value.duration_s ?? value.duration_seconds ?? null,
    target: cloneJson(value.target ?? null),
    target_position: cloneJson(value.target_position ?? null),
    movement: cloneJson(value.movement ?? null),
    door_interaction: cloneJson(value.door_interaction ?? null),
    object_interaction: cloneJson(value.object_interaction ?? null),
    attack: cloneJson(value.attack ?? null),
    defense: cloneJson(value.defense ?? null),
    projectile: cloneJson(value.projectile ?? null),
    ability: cloneJson(value.ability ?? null),
    resource_commitment: cloneJson(value.resource_commitment ?? null),
  };
}

function buildWorldActionCandidates(input = {}) {
  const character = suppliedCharacter(input);
  const candidates = array(input.available_actions)
    .slice(0, 24)
    .map(normalizeAction)
    .filter((action) => action.intent);
  return {
    result_type: capabilitySpecs.world_action_proposer.result_type,
    proposal_status: candidates.length
      ? "candidate_intents_available"
      : "no_available_actions_supplied",
    character,
    candidate_action_intents: candidates,
    selection_boundary: "Candidates are non-binding. ChatGPT acting as this character chooses among them or rejects all of them using only the character's bounded cognition.",
    outcome_boundary: "An action intent may specify what the character attempts. Hit, collision, injury, success, failure, movement completion, and world effects belong to the causal simulator.",
  };
}

const agencyRiskKeys = Object.freeze({
  desired_story_outcome: "story_outcome_bias",
  desired_plot_outcome: "story_outcome_bias",
  target_ending: "story_outcome_bias",
  forced_action: "forced_character_action",
  force_character_action: "forced_character_action",
  dramatic_priority: "drama_optimization",
  drama_priority: "drama_optimization",
  spotlight_target: "camera_importance_bias",
  camera_priority: "camera_importance_bias",
  screen_time_target: "camera_importance_bias",
  author_goal: "authorial_control_signal",
  desired_romance_progress: "story_outcome_bias",
  desired_conflict: "story_outcome_bias",
});

function buildWorldAgencyGuard(input = {}) {
  const request = object(input.decision_request ?? input);
  const findings = [];
  for (const [key, issueType] of Object.entries(agencyRiskKeys)) {
    if (!Object.hasOwn(request, key)) continue;
    const value = request[key];
    if (value === null || value === false || value === "") continue;
    findings.push({
      issue_type: issueType,
      field: key,
      value: cloneJson(value),
      must_ignore_for_character_choice: true,
    });
  }
  return {
    result_type: capabilitySpecs.world_agency_guard.result_type,
    review_status: "complete",
    character: suppliedCharacter(input),
    findings,
    agency_boundary: {
      narrative_goals_cannot_choose_action: true,
      camera_observation_cannot_create_causality: true,
      screen_time_cannot_raise_world_importance: true,
      character_choice_owned_by_character_brain: true,
    },
  };
}

function transitionFinding(transition, index) {
  const value = object(transition);
  const from = Object.hasOwn(value, "from") ? value.from : value.previous;
  const to = Object.hasOwn(value, "to") ? value.to : value.next;
  const changed = JSON.stringify(from) !== JSON.stringify(to);
  const cause = value.cause ?? value.evidence ?? value.transition_event ?? null;
  if (!changed || cause) return null;
  return {
    issue_type: "state_changed_without_recorded_cause",
    transition_index: index,
    entity: value.entity ?? value.character ?? value.object ?? null,
    field: value.field ?? value.state_key ?? null,
    from: cloneJson(from),
    to: cloneJson(to),
    must_fix: true,
  };
}

function duplicateHolderFindings(objectHolders) {
  const byObject = new Map();
  for (const raw of array(objectHolders)) {
    const item = object(raw);
    const objectId = text(item.object_id ?? item.object ?? item.item, 240);
    const holder = text(item.holder ?? item.character ?? item.owner, 240);
    if (!objectId || !holder) continue;
    if (!byObject.has(objectId)) byObject.set(objectId, new Set());
    byObject.get(objectId).add(holder);
  }
  return [...byObject.entries()]
    .filter(([, holders]) => holders.size > 1)
    .map(([objectId, holders]) => ({
      issue_type: "duplicate_exclusive_holder",
      object_id: objectId,
      holders: [...holders],
      must_fix: true,
    }));
}

function knowledgeLeakFindings(transitions) {
  return array(transitions).flatMap((raw, index) => {
    const value = object(raw);
    const becameKnown = value.became_known === true
      || value.to === "known"
      || value.next === "known";
    if (!becameKnown) return [];
    if (value.source || value.observation || value.memory_source || value.inference_basis) {
      return [];
    }
    return [{
      issue_type: "knowledge_gain_without_source",
      transition_index: index,
      character: value.character ?? null,
      proposition: cloneJson(value.proposition ?? value.content ?? null),
      must_fix: true,
    }];
  });
}

function outcomeShortcutFindings(outcomes) {
  return array(outcomes).flatMap((raw, index) => {
    const value = object(raw);
    const hasResult = Object.hasOwn(value, "result")
      || Object.hasOwn(value, "success")
      || Object.hasOwn(value, "hit")
      || Object.hasOwn(value, "winner");
    if (!hasResult) return [];
    if (value.causal_evidence || value.adjudication || value.resolution_trace) return [];
    return [{
      issue_type: "outcome_without_causal_adjudication",
      outcome_index: index,
      actor: value.actor ?? null,
      action: value.action ?? value.intent ?? null,
      must_fix: true,
    }];
  });
}

function buildWorldConsistencyReport(input = {}) {
  const findings = [
    ...array(input.state_transitions)
      .map(transitionFinding)
      .filter(Boolean),
    ...duplicateHolderFindings(input.object_holders),
    ...knowledgeLeakFindings(input.knowledge_transitions),
    ...outcomeShortcutFindings(input.action_outcomes),
  ];
  return {
    result_type: capabilitySpecs.world_consistency_critic.result_type,
    review_status: "complete",
    findings,
    hard_conflict_count: findings.filter((finding) => finding.must_fix).length,
    consistency_boundary: {
      result_is_diagnostic_only: true,
      no_state_mutation: true,
      no_retroactive_motivation: true,
      missing_cause_is_not_auto_repaired: true,
    },
  };
}

const deterministicBuilders = Object.freeze({
  world_scene_causal_analyzer: buildWorldSceneCausalAnalysis,
  world_perception_filter: buildWorldPerceptionPacket,
  world_memory_retriever: buildWorldMemoryRetrieval,
  world_character_cognition: buildWorldCharacterCognition,
  world_action_proposer: buildWorldActionCandidates,
  world_agency_guard: buildWorldAgencyGuard,
  world_consistency_critic: buildWorldConsistencyReport,
});

export function buildWorldSimulationCapabilityContract(capabilityName) {
  const contract = worldSimulationCapabilityContracts[capabilityName];
  if (!contract) return null;
  return cloneJson(contract);
}

export function buildWorldSimulationCapabilityRegistry() {
  return {
    world_simulation_common_permissions: {
      ...worldSimulationCommonPermissions,
    },
    capabilities: Object.fromEntries(
      worldSimulationCapabilityNames.map((capabilityName) => [
        capabilityName,
        buildWorldSimulationCapabilityContract(capabilityName),
      ]),
    ),
  };
}

export async function runWorldSimulationCapability(
  capabilityName,
  input = {},
  options = {},
) {
  const spec = capabilitySpecs[capabilityName];
  const builder = deterministicBuilders[capabilityName];
  if (!spec || !builder) {
    throw new Error(`Unknown world simulation capability: ${capabilityName}`);
  }
  const runId = options.run_id;
  const runOptions = options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
  const run = await getAgentRun(runId, runOptions);
  assertNeuralSessionRunShape(
    run,
    neuralSessionModes.WORLD_SIMULATION,
  );

  const calledAt = new Date().toISOString();
  const startedAt = performance.now();
  const inputText = JSON.stringify(input ?? null);
  const inputHash = hashNeuralValue(inputText);
  const modelName = options.model_name ?? spec.model_name;
  const modelVersion = options.model_version ?? spec.model_version;
  let output = null;
  let sharedNeuralCore = null;
  let status = "success";
  let errorMessage = null;
  let warnings = [];

  try {
    const adapter = typeof options.adapter === "function"
      ? options.adapter
      : async (value) => builder(value);
    const invocation = await invokeSharedNeuralCoreAdapter({
      run,
      session_mode: neuralSessionModes.WORLD_SIMULATION,
      capability_name: capabilityName,
      input,
      adapter,
      adapter_context: {
        run_id: runId,
        task_type: "world_simulation",
        capability_name: capabilityName,
        model_name: modelName,
        model_version: modelVersion,
        permissions: worldSimulationCommonPermissions,
      },
    });
    output = invocation.output;
    sharedNeuralCore = invocation.descriptor;
    if (!isObject(output)) {
      throw new Error("World simulation capability output must be an object.");
    }
    output = {
      ...cloneJson(output),
      capability_contract: buildWorldSimulationCapabilityContract(capabilityName),
    };
    if (typeof options.adapter !== "function") {
      warnings = ["structural_default_adapter_used"];
    }
  } catch (error) {
    status = "failed";
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const serializedOutput = output === null ? "" : JSON.stringify(output);
  const outputHash = status === "success"
    ? hashNeuralValue(serializedOutput)
    : null;
  const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
  const trace = await recordNeuralWrapperTrace({
    run_id: runId,
    task_type: "world_simulation",
    module_name: capabilityName,
    model_name: modelName,
    model_version: modelVersion,
    called_at: calledAt,
    input_hash: inputHash,
    output_hash: outputHash,
    status,
    latency_ms: latencyMs,
    warnings,
    error_message: errorMessage,
    input_summary: {
      chars: inputText.length,
      source: options.source ?? "world_simulation_bridge",
      domain: "world_simulation",
      session_mode: neuralSessionModes.WORLD_SIMULATION,
      shared_neural_core_version: sharedNeuralCore?.core_version ?? null,
      shared_capability_family: sharedNeuralCore?.capability_family ?? null,
    },
    output_summary: {
      chars: serializedOutput.length,
      result_type: spec.result_type,
      domain: "world_simulation",
      mutates_world_state: false,
      shared_neural_core_version: sharedNeuralCore?.core_version ?? null,
      shared_capability_family: sharedNeuralCore?.capability_family ?? null,
    },
  }, runOptions);

  if (status !== "success") {
    throw new Error(errorMessage ?? `${capabilityName} failed.`);
  }

  return {
    output,
    trace,
    shared_neural_core: sharedNeuralCore,
    mutation_guards: { ...worldSimulationCommonPermissions },
  };
}

export const run_world_scene_causal_analyzer = (input, options) => (
  runWorldSimulationCapability("world_scene_causal_analyzer", input, options)
);
export const run_world_perception_filter = (input, options) => (
  runWorldSimulationCapability("world_perception_filter", input, options)
);
export const run_world_memory_retriever = (input, options) => (
  runWorldSimulationCapability("world_memory_retriever", input, options)
);
export const run_world_character_cognition = (input, options) => (
  runWorldSimulationCapability("world_character_cognition", input, options)
);
export const run_world_action_proposer = (input, options) => (
  runWorldSimulationCapability("world_action_proposer", input, options)
);
export const run_world_agency_guard = (input, options) => (
  runWorldSimulationCapability("world_agency_guard", input, options)
);
export const run_world_consistency_critic = (input, options) => (
  runWorldSimulationCapability("world_consistency_critic", input, options)
);
