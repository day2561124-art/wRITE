import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectivePersonalSemanticMemories,
  worldSimulationPersonalSemanticMemoryVersion,
} from "./world-simulation-personal-semantic-memory-service.mjs";

export const worldSimulationExperientialKnowledgeReentryVersion =
  "phase76d-experiential-knowledge-reentry-v1";

const maximumCandidateCount = 64;
const maximumActivatedCount = 8;

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function characterKey(value) {
  return requiredString(value, "character")
    .toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

const resolverPrivateKeys = new Set([
  "world_state",
  "scene_state",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
  "retrieval_cues",
  "source_life_event_refs",
  "counterevidence_life_event_refs",
  "support_life_event_refs",
  "derivation_event_ids",
  "first_derivation_event_id",
  "latest_derivation_event_id",
  "resolver_view_hash",
  "projection_hash",
  "semantic_descriptor_hash",
  "source_history_hash",
  "confidence",
  "probability",
]);

function keyIsResolverPrivate(key) {
  const normalized = String(key ?? "").toLowerCase();
  return normalized === "id"
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids")
    || normalized.endsWith("_hash")
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || resolverPrivateKeys.has(normalized);
}

function sanitizeBoundedContext(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 32).map(sanitizeBoundedContext);
  }
  if (!isObject(value)) {
    if (typeof value === "string") return Array.from(value).slice(0, 1000).join("");
    if (["number", "boolean"].includes(typeof value) || value === null) {
      return cloneJson(value);
    }
    return null;
  }
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (keyIsResolverPrivate(key)) continue;
    clean[key] = sanitizeBoundedContext(child);
  }
  return clean;
}

function normalizeSemanticDescriptor(value) {
  const descriptor = object(value);
  const predicate = requiredString(
    descriptor.predicate,
    "semantic_descriptor.predicate",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const objectRef = requiredString(
    descriptor.object_ref,
    "semantic_descriptor.object_ref",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const qualifiers = array(descriptor.qualifiers)
    .map((item) => requiredString(
      item,
      "semantic_descriptor.qualifier",
      "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
    ))
    .sort(compareText);
  return {
    subject_scope: "self_autobiographical_experience",
    predicate,
    object_ref: objectRef,
    qualifiers,
  };
}

function latestSemanticEvent(worldState, semantic) {
  const eventId = optionalString(semantic?.latest_derivation_event_id);
  if (!eventId) return null;
  const event = object(object(worldState.personal_semantic_derivation_events)[eventId]);
  if (!Object.keys(event).length) {
    const error = new Error(
      `Phase76D cannot resolve latest Phase67C event ${eventId}.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID";
    throw error;
  }
  if (
    event.version !== worldSimulationPersonalSemanticMemoryVersion
    || event.semantic_memory_id !== semantic.semantic_memory_id
    || !sameCharacter(event.character, semantic.character)
  ) {
    const error = new Error("Phase76D encountered mismatched Phase67C semantic lineage.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID";
    throw error;
  }
  return event;
}

function candidateFromSemantic(worldState, semantic, currentTurnId) {
  if (!isObject(semantic)) return null;
  const semanticRef = requiredString(
    semantic.semantic_memory_id,
    "semantic_memory_id",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const character = requiredString(
    semantic.character,
    "semantic character",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const semanticCategory = requiredString(
    semantic.semantic_category,
    "semantic_category",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const semanticKey = requiredString(
    semantic.semantic_key,
    "semantic_key",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SOURCE_INVALID",
  );
  const descriptor = normalizeSemanticDescriptor(semantic.semantic_descriptor);
  const latestEvent = latestSemanticEvent(worldState, semantic);
  if (latestEvent?.source_turn_id === currentTurnId) return null;
  const knowledgeStatus = semantic.state === "contested" ? "contested" : "supported";
  return {
    semantic_ref: semanticRef,
    character,
    semantic_category: semanticCategory,
    semantic_key: semanticKey,
    semantic_descriptor: descriptor,
    knowledge_status: knowledgeStatus,
    subjective_not_world_truth: true,
    epistemic_acceptance_decided: false,
  };
}

function characterSemantics(projection, character) {
  const wanted = characterKey(character);
  for (const [name, values] of Object.entries(projection.memories_by_character ?? {})) {
    if (characterKey(name) === wanted) return Object.values(object(values));
  }
  return [];
}

export function buildWorldSimulationExperientialKnowledgeReentryContract() {
  return deepFreeze({
    version: worldSimulationExperientialKnowledgeReentryVersion,
    phase: "Phase76D",
    status: "cue_dependent_experiential_knowledge_reentry_installed",
    source_owner: "Phase67C",
    source_projection: "effective_personal_semantic_memory",
    committed_prior_turn_source_only: true,
    same_character_source_only: true,
    cue_dependent_access_required: true,
    resolver_selects_opaque_semantic_refs_only: true,
    resolver_may_author_semantic_content: false,
    missing_resolver_means_no_reentry: true,
    activated_semantic_count_bounded: true,
    maximum_activated_semantic_count: maximumActivatedCount,
    supported_and_contested_semantics_preserved: true,
    confidence_probability_modeled: false,
    numeric_activation_score_exposed: false,
    world_truth_authority_claimed: false,
    source_life_event_lineage_exposed_to_character: false,
    semantic_identity_exposed_to_character: false,
    current_context_hidden_engine_metadata_exposed_to_resolver: false,
    direct_subjective_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    current_mind_admission_output_gating_reused: true,
    direct_plan_or_goal_mutation_allowed: false,
    direct_action_selection_allowed: false,
    prior_method_is_advisory_not_command: true,
    current_context_revalidation_required: true,
    exact_case_replay_required: false,
    action_adaptation_owner: "existing_phase73_phase74_phase75_cognition",
    parallel_memory_or_belief_store_created: false,
    same_turn_phase67c_write_feedback_allowed: false,
  });
}

export function buildWorldSimulationExperientialKnowledgeReentryResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const semanticProjection = projectWorldSimulationEffectivePersonalSemanticMemories({
    world_state: worldState,
  });
  const candidates = characterSemantics(semanticProjection, character)
    .map((semantic) => candidateFromSemantic(worldState, semantic, currentTurnId))
    .filter(Boolean)
    .slice(0, maximumCandidateCount)
    .sort((left, right) => compareText(left.semantic_ref, right.semantic_ref));
  const view = {
    version: worldSimulationExperientialKnowledgeReentryVersion,
    current_turn_id: currentTurnId,
    character,
    cue_context: sanitizeBoundedContext(object(input.current_context)),
    candidate_personal_semantics: candidates,
    selection_contract: {
      select_only_if_relevant_to_current_cue_context: true,
      opaque_semantic_ref_selection_only: true,
      semantic_content_authoring_allowed: false,
      maximum_selection_count: maximumActivatedCount,
      no_match_may_return_empty: true,
      supported_and_contested_candidates_may_be_selected: true,
      contested_status_must_be_preserved: true,
      similarity_score_required: false,
      confidence_probability_requested: false,
      world_truth_judgment_requested: false,
      action_selection_requested: false,
      plan_goal_mutation_requested: false,
    },
    boundaries: {
      phase67c_source_projection_hash_verified: true,
      source_projection_hash: semanticProjection.projection_hash,
      current_turn_phase67c_semantics_excluded: true,
      same_character_candidates_only: true,
      world_state_exposed: false,
      source_life_event_refs_exposed: false,
      derivation_event_ids_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_semantics_exposed: false,
      numeric_activation_scores_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function verifyResolverView(value) {
  const view = cloneJson(object(value));
  if (view.version !== worldSimulationExperientialKnowledgeReentryVersion) {
    const error = new Error("Phase76D resolver view version is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const expectedHash = optionalString(view.resolver_view_hash);
  if (!expectedHash) {
    const error = new Error("Phase76D resolver view hash is required.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== expectedHash) {
    const error = new Error("Phase76D resolver view hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  return view;
}

function normalizeActivatedRefs(values) {
  if (!Array.isArray(values)) {
    const error = new Error("Phase76D activated_semantic_refs must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_INVALID";
    throw error;
  }
  if (values.length > maximumActivatedCount) {
    const error = new Error(
      `Phase76D may activate at most ${maximumActivatedCount} personal semantic memories.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_LIMIT_EXCEEDED";
    throw error;
  }
  const refs = values.map((value) => requiredString(
    isObject(value) ? value.semantic_ref : value,
    "activated semantic_ref",
    "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_INVALID",
  ));
  if (new Set(refs).size !== refs.length) {
    const error = new Error("Phase76D activated semantic refs must be unique.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_DUPLICATE";
    throw error;
  }
  return refs;
}

function characterKnowledge(candidate) {
  return {
    kind: "recalled_experiential_knowledge",
    semantic_category: candidate.semantic_category,
    semantic_descriptor: cloneJson(candidate.semantic_descriptor),
    knowledge_status: candidate.knowledge_status,
    subjective_not_world_truth: true,
    epistemic_acceptance_decided: false,
    cue_retrieved: true,
    advisory_only: true,
    prior_method_not_direct_action_command: true,
    current_context_revalidation_required: true,
  };
}

export function projectWorldSimulationExperientialKnowledgeReentry(input = {}) {
  const resolverView = verifyResolverView(input.resolver_view);
  const activatedRefs = normalizeActivatedRefs(input.activated_semantic_refs ?? []);
  const candidates = array(resolverView.candidate_personal_semantics);
  const candidateByRef = new Map(candidates.map((candidate) => [candidate.semantic_ref, candidate]));
  const selected = activatedRefs.map((semanticRef) => {
    const candidate = candidateByRef.get(semanticRef);
    if (!candidate) {
      const error = new Error(
        `Phase76D resolver selected semantic ref outside its canonical candidate view: ${semanticRef}.`,
      );
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_SELECTION_OUT_OF_VIEW";
      throw error;
    }
    if (!sameCharacter(candidate.character, resolverView.character)) {
      const error = new Error("Phase76D resolver selected cross-character semantic knowledge.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_KNOWLEDGE_REENTRY_CROSS_CHARACTER_FORBIDDEN";
      throw error;
    }
    return candidate;
  });
  const activated = selected.map((candidate, index) => ({
    semantic_ref: candidate.semantic_ref,
    activation_index: index,
    semantic_category: candidate.semantic_category,
    semantic_key: candidate.semantic_key,
    semantic_descriptor_hash: hashAgentRunValue(candidate.semantic_descriptor),
    knowledge_status: candidate.knowledge_status,
  }));
  const characterView = {
    source: "cue_retrieved_prior_personal_semantic_experience",
    cue_dependent: true,
    experiential_knowledge: selected.map(characterKnowledge),
    advisory_only: true,
    selected_action_authority: false,
    current_context_revalidation_required: true,
  };
  const projection = {
    version: worldSimulationExperientialKnowledgeReentryVersion,
    current_turn_id: resolverView.current_turn_id,
    character: resolverView.character,
    resolver_view_hash: resolverView.resolver_view_hash,
    activated_semantics: activated,
    character_view: characterView,
    audit: {
      canonical_phase67c_candidate_view_used: true,
      committed_prior_turn_source_only: true,
      same_character_source_only: true,
      cue_dependent_selection: true,
      resolver_selected_opaque_refs_only: true,
      resolver_authored_semantic_content: false,
      activated_count: activated.length,
      maximum_activated_count: maximumActivatedCount,
      contested_status_preserved: true,
      source_life_event_lineage_exposed_to_character: false,
      semantic_identity_exposed_to_character: false,
      numeric_activation_score_used: false,
      confidence_probability_modeled: false,
      direct_belief_write: false,
      direct_current_mind_write: false,
      direct_plan_or_goal_mutation: false,
      direct_action_selection: false,
      exact_case_replay_required: false,
      current_context_revalidation_required: true,
      existing_current_mind_gating_targeted: true,
      existing_phase73_phase74_phase75_adaptation_preserved: true,
      parallel_memory_or_belief_store_created: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reentry_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
