import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationExperientialKnowledgeReentryVersion,
} from "./world-simulation-experiential-knowledge-reentry-service.mjs";

export const worldSimulationExperientialMethodTransferVersion =
  "phase76e-experiential-method-transfer-v1";

const maximumTransferCount = 8;
const maximumCueRefsPerTransfer = 8;
const supportedMappingKinds = Object.freeze([
  "structural_match",
  "partial_structural_match",
]);
const supportedContextCueKinds = Object.freeze([
  "perception",
  "current_goal",
  "current_action",
  "goals",
  "current_goals",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function boundedString(
  value,
  label,
  maxLength = 600,
  code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}

function characterKey(value) {
  return boundedString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function semanticValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return ["number", "boolean"].includes(typeof value);
}

const privateContextKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_world_event",
  "causal_evidence",
  "causal_chain",
  "world_truth",
  "world_truth_verified",
  "internal_provenance",
  "source_life_event_refs",
  "support_life_event_refs",
  "counterevidence_life_event_refs",
  "confidence",
  "probability",
  "utility",
  "utility_score",
  "priority_score",
  "feasibility_score",
  "success_probability",
  "outcome",
  "result",
]);

function privateContextKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return privateContextKeys.has(normalized)
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.endsWith("_hash")
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids");
}

function sanitizeBoundedContext(value, depth = 0) {
  if (depth > 6) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return Array.from(value.trim()).slice(0, 1000).join("") || null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 32)
      .map((entry) => sanitizeBoundedContext(entry, depth + 1))
      .filter((entry) => entry !== null && entry !== undefined);
  }
  if (!isObject(value)) return null;
  const clean = {};
  for (const key of Object.keys(value).sort(compareText).slice(0, 64)) {
    if (privateContextKey(key)) continue;
    const child = sanitizeBoundedContext(value[key], depth + 1);
    if (!semanticValuePresent(child)) continue;
    clean[key] = child;
  }
  return clean;
}

function verifyPhase76DProjection(value, character, currentTurnId) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialKnowledgeReentryVersion
      || projection.character !== character
      || projection.current_turn_id !== currentTurnId
      || !optionalString(projection.reentry_hash)) {
    const error = new Error(
      "Phase76E requires the exact same-character, same-turn Phase76D re-entry projection.",
    );
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.reentry_hash;
  if (hashAgentRunValue(body) !== projection.reentry_hash) {
    const error = new Error("Phase76E Phase76D source re-entry hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_HASH_MISMATCH";
    throw error;
  }
  const audit = object(projection.audit);
  if (audit.committed_prior_turn_source_only !== true
      || audit.same_character_source_only !== true
      || audit.cue_dependent_selection !== true
      || audit.resolver_authored_semantic_content !== false
      || audit.direct_action_selection !== false
      || audit.world_truth_authority_claimed !== false) {
    const error = new Error("Phase76E rejects a Phase76D source without the sealed authority boundaries.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_BOUNDARY_INVALID";
    throw error;
  }
  const activated = array(projection.activated_semantics);
  const knowledge = array(object(projection.character_view).experiential_knowledge);
  if (activated.length !== knowledge.length) {
    const error = new Error("Phase76E Phase76D activated/internal and character-facing source counts diverge.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_LINEAGE_INVALID";
    throw error;
  }
  activated.forEach((entry, index) => {
    const item = object(knowledge[index]);
    if (item.kind !== "recalled_experiential_knowledge"
        || entry.semantic_category !== item.semantic_category
        || entry.knowledge_status !== item.knowledge_status
        || hashAgentRunValue(item.semantic_descriptor) !== entry.semantic_descriptor_hash
        || item.subjective_not_world_truth !== true
        || item.advisory_only !== true
        || item.prior_method_not_direct_action_command !== true
        || item.current_context_revalidation_required !== true) {
      const error = new Error(`Phase76E found mismatched Phase76D source lineage at index ${index}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_LINEAGE_INVALID";
      throw error;
    }
  });
  return projection;
}

function methodCandidate(projection, knowledge, index) {
  if (knowledge.semantic_category !== "recurring_event_pattern") return null;
  const descriptor = object(knowledge.semantic_descriptor);
  const predicate = boundedString(
    descriptor.predicate,
    "semantic_descriptor.predicate",
    600,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_INVALID",
  );
  const methodRef = boundedString(
    descriptor.object_ref,
    "semantic_descriptor.object_ref",
    600,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_INVALID",
  );
  const qualifiers = array(descriptor.qualifiers)
    .map((value, qualifierIndex) => boundedString(
      value,
      `semantic_descriptor.qualifiers[${qualifierIndex}]`,
      300,
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_INVALID",
    ))
    .sort(compareText);
  const base = {
    source_index: index,
    relation: predicate,
    method_ref: methodRef,
    qualifiers,
    source_knowledge_status: knowledge.knowledge_status === "contested"
      ? "contested"
      : "supported",
  };
  const hash = hashAgentRunValue({
    version: worldSimulationExperientialMethodTransferVersion,
    source_reentry_hash: projection.reentry_hash,
    ...base,
  });
  return {
    transfer_ref: `phase76e_method_${hash.slice(0, 24)}`,
    method_skeleton: {
      relation: predicate,
      method_ref: methodRef,
      qualifiers,
    },
    source_knowledge_status: base.source_knowledge_status,
    subjective_not_world_truth: true,
    relational_structure_only: true,
    source_surface_case_not_exposed: true,
    exact_action_replay_not_requested: true,
  };
}

function buildCueCatalog(currentContext, character, currentTurnId) {
  const source = object(currentContext);
  const cues = [];
  for (const cueKind of supportedContextCueKinds) {
    if (!semanticValuePresent(source[cueKind])) continue;
    const content = sanitizeBoundedContext(source[cueKind]);
    if (!semanticValuePresent(content)) continue;
    const hash = hashAgentRunValue({
      version: worldSimulationExperientialMethodTransferVersion,
      current_turn_id: currentTurnId,
      character: characterKey(character),
      cue_kind: cueKind,
      content,
    });
    cues.push({
      cue_ref: `phase76e_cue_${hash.slice(0, 24)}`,
      cue_kind: cueKind,
      content,
      current_context_only: true,
      world_truth_authority: false,
    });
  }
  return cues.slice(0, supportedContextCueKinds.length);
}

export function buildWorldSimulationExperientialMethodTransferContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodTransferVersion,
    phase: "Phase76E",
    status: "analogical_experiential_method_transfer_installed",
    source_owner: "Phase76D",
    source_phase76d_reentry_hash_verified: true,
    recurring_event_pattern_only: true,
    relational_structure_transfer_only: true,
    surface_feature_copying_required: false,
    exact_case_replay_required: false,
    exact_action_replay_allowed: false,
    resolver_selects_canonical_method_and_cue_refs_only: true,
    resolver_may_author_method_content: false,
    resolver_may_author_action_content: false,
    current_context_grounding_required: true,
    current_context_revalidation_required: true,
    adaptation_before_use_required: true,
    missing_resolver_means_no_transfer: true,
    supported_mapping_kinds: [...supportedMappingKinds],
    maximum_transfer_count: maximumTransferCount,
    supported_and_contested_source_status_preserved: true,
    contested_source_requires_extra_revalidation: true,
    numeric_similarity_confidence_probability_utility_modeled: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_mutation_allowed: false,
    direct_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    direct_world_state_mutation_allowed: false,
    objective_feasibility_oracle_claimed: false,
    world_truth_authority_claimed: false,
    candidate_action_generation_owner: "existing_world_action_proposer",
    action_adaptation_owner: "existing_phase73_phase74_phase75_cognition",
    durable_plan_lifecycle_owner: "Phase69B_Phase71",
    parallel_memory_belief_plan_store_created: false,
  });
}

export function buildWorldSimulationExperientialMethodTransferResolverView(input = {}) {
  const character = boundedString(input.character, "character", 240);
  const currentTurnId = boundedString(input.current_turn_id, "current_turn_id", 240);
  const sourceProjection = verifyPhase76DProjection(
    input.experiential_knowledge_reentry,
    character,
    currentTurnId,
  );
  const knowledge = array(object(sourceProjection.character_view).experiential_knowledge);
  const methodCandidates = knowledge
    .map((entry, index) => methodCandidate(sourceProjection, entry, index))
    .filter(Boolean)
    .slice(0, maximumTransferCount)
    .sort((left, right) => compareText(left.transfer_ref, right.transfer_ref));
  const currentCueCatalog = buildCueCatalog(input.current_context, character, currentTurnId);
  const view = {
    version: worldSimulationExperientialMethodTransferVersion,
    character,
    current_turn_id: currentTurnId,
    method_candidates: methodCandidates,
    current_cue_catalog: currentCueCatalog,
    selection_contract: {
      select_only_structurally_relevant_prior_methods: true,
      transfer_ref_must_be_from_method_candidates: true,
      current_cue_refs_must_be_from_current_cue_catalog: true,
      current_cue_grounding_required: true,
      supported_mapping_kinds: [...supportedMappingKinds],
      semantic_method_authoring_allowed: false,
      concrete_action_authoring_allowed: false,
      no_match_may_return_empty: true,
      maximum_transfer_count: maximumTransferCount,
      numeric_similarity_requested: false,
      confidence_probability_utility_requested: false,
      objective_feasibility_judgment_requested: false,
      world_truth_judgment_requested: false,
      action_selection_requested: false,
    },
    boundaries: {
      source_phase76d_reentry_hash: sourceProjection.reentry_hash,
      source_phase76d_verified: true,
      recurring_event_pattern_only: true,
      source_surface_case_exposed: false,
      source_semantic_identity_exposed: false,
      source_life_event_lineage_exposed: false,
      raw_world_state_exposed: false,
      raw_world_event_exposed: false,
      hidden_causal_evidence_exposed: false,
      engine_action_ids_exposed: false,
      numeric_scores_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function verifyResolverView(value) {
  const view = cloneJson(object(value));
  if (view.version !== worldSimulationExperientialMethodTransferVersion
      || !optionalString(view.resolver_view_hash)) {
    const error = new Error("Phase76E requires an exact canonical resolver view.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== view.resolver_view_hash) {
    const error = new Error("Phase76E resolver view hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  return view;
}

function normalizeMapping(raw, view, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase76E transfer mapping at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_INVALID";
    throw error;
  }
  for (const forbidden of [
    "method",
    "method_skeleton",
    "action",
    "action_id",
    "intent",
    "selected_action",
    "selected_action_id",
    "plan",
    "goal",
    "outcome",
    "result",
    "confidence",
    "probability",
    "similarity_score",
    "utility",
    "utility_score",
    "priority_score",
    "feasibility_score",
  ]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(
        `Phase76E resolver mapping may not author authority or semantic field ${forbidden}.`,
      );
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const transferRef = boundedString(
    raw.transfer_ref,
    `transfer_mappings[${index}].transfer_ref`,
    180,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_INVALID",
  );
  const candidate = array(view.method_candidates)
    .find((entry) => entry.transfer_ref === transferRef);
  if (!candidate) {
    const error = new Error(`Phase76E mapping references unknown method ${transferRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_OUT_OF_VIEW";
    throw error;
  }
  const mappingKind = boundedString(
    raw.mapping_kind,
    `transfer_mappings[${index}].mapping_kind`,
    80,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_INVALID",
  );
  if (!supportedMappingKinds.includes(mappingKind)) {
    const error = new Error(`Unsupported Phase76E mapping kind ${mappingKind}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_KIND_INVALID";
    throw error;
  }
  const cueRefs = array(raw.current_cue_refs).map((ref, cueIndex) => boundedString(
    ref,
    `transfer_mappings[${index}].current_cue_refs[${cueIndex}]`,
    180,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_INVALID",
  ));
  if (cueRefs.length < 1 || cueRefs.length > maximumCueRefsPerTransfer
      || new Set(cueRefs).size !== cueRefs.length) {
    const error = new Error("Phase76E transfer mappings require a bounded unique non-empty current cue set.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_CUE_GROUNDING_INVALID";
    throw error;
  }
  const cueByRef = new Map(array(view.current_cue_catalog).map((cue) => [cue.cue_ref, cue]));
  const cues = cueRefs.map((ref) => {
    const cue = cueByRef.get(ref);
    if (!cue) {
      const error = new Error(`Phase76E mapping references current cue outside its resolver view: ${ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_CUE_OUT_OF_VIEW";
      throw error;
    }
    return cue;
  });
  return {
    candidate,
    transfer_ref: transferRef,
    mapping_kind: mappingKind,
    current_cue_refs: [...cueRefs].sort(compareText),
    current_cue_kinds: [...new Set(cues.map((cue) => cue.cue_kind))].sort(compareText),
  };
}

function characterMethodGuidance(mapping) {
  return {
    kind: "analogical_experiential_method",
    method_skeleton: cloneJson(mapping.candidate.method_skeleton),
    source_knowledge_status: mapping.candidate.source_knowledge_status,
    mapping_kind: mapping.mapping_kind,
    current_context_grounded: true,
    current_context_basis: cloneJson(mapping.current_cue_kinds),
    relational_structure_transfer: true,
    surface_case_replay: false,
    exact_action_replay: false,
    advisory_only: true,
    candidate_action_generation_deferred: true,
    current_available_action_mapping_required: true,
    current_context_revalidation_required: true,
    adaptation_before_use_required: true,
    contested_source_requires_extra_revalidation:
      mapping.candidate.source_knowledge_status === "contested",
    subjective_not_world_truth: true,
    selected_action_authority: false,
    objective_feasibility_verified: false,
  };
}

export function projectWorldSimulationExperientialMethodTransfer(input = {}) {
  const view = verifyResolverView(input.resolver_view);
  if (!Array.isArray(input.transfer_mappings ?? [])) {
    const error = new Error("Phase76E transfer_mappings must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_INVALID";
    throw error;
  }
  const rawMappings = input.transfer_mappings ?? [];
  if (rawMappings.length > maximumTransferCount) {
    const error = new Error(`Phase76E accepts at most ${maximumTransferCount} method transfers.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_LIMIT_EXCEEDED";
    throw error;
  }
  const mappings = rawMappings.map((mapping, index) => normalizeMapping(mapping, view, index));
  const refs = mappings.map((mapping) => mapping.transfer_ref);
  if (new Set(refs).size !== refs.length) {
    const error = new Error("Phase76E allows each canonical prior method at most once per turn.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_DUPLICATE_METHOD";
    throw error;
  }
  const internalMappings = mappings.map((mapping, index) => ({
    transfer_ref: mapping.transfer_ref,
    transfer_index: index,
    mapping_kind: mapping.mapping_kind,
    current_cue_refs: cloneJson(mapping.current_cue_refs),
    method_skeleton_hash: hashAgentRunValue(mapping.candidate.method_skeleton),
    source_knowledge_status: mapping.candidate.source_knowledge_status,
  }));
  const characterView = {
    source: "cue_grounded_prior_experiential_relational_methods",
    transferred_methods: mappings.map(characterMethodGuidance),
    advisory_only: true,
    selected_action_authority: false,
    action_candidate_generation_owner: "existing_world_action_proposer",
    current_context_revalidation_required: true,
    adaptation_before_use_required: true,
  };
  const projection = {
    version: worldSimulationExperientialMethodTransferVersion,
    current_turn_id: view.current_turn_id,
    character: view.character,
    source_phase76d_reentry_hash: view.boundaries.source_phase76d_reentry_hash,
    resolver_view_hash: view.resolver_view_hash,
    transferred_method_mappings: internalMappings,
    character_view: characterView,
    audit: {
      canonical_phase76d_source_verified: true,
      recurring_event_pattern_only: true,
      relational_structure_transfer_only: true,
      source_surface_case_replayed: false,
      exact_action_replay_allowed: false,
      resolver_authored_method_content: false,
      resolver_authored_action_content: false,
      current_context_grounding_required: true,
      transferred_method_count: mappings.length,
      supported_and_contested_status_preserved: true,
      numeric_similarity_confidence_probability_utility_modeled: false,
      objective_feasibility_verified: false,
      world_truth_authority_claimed: false,
      direct_action_selection: false,
      direct_plan_goal_mutation: false,
      direct_belief_write: false,
      direct_current_mind_write: false,
      direct_world_state_mutation: false,
      existing_action_proposer_reused: true,
      existing_phase74_deliberation_grounding_targeted: true,
      existing_phase71_plan_lifecycle_preserved: true,
      parallel_memory_belief_plan_store_created: false,
    },
  };
  projection.transfer_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
