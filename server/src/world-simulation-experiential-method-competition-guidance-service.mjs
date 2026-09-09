import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodTransferVersion } from "./world-simulation-experiential-method-transfer-service.mjs";
import { worldSimulationExperientialMethodCompetitionResolutionVersion } from "./world-simulation-experiential-method-competition-resolution-service.mjs";

export const worldSimulationExperientialMethodCompetitionGuidanceVersion =
  "phase79c-experiential-method-competition-guidance-v1";

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
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  const text = optionalString(value);
  return text ? text.toLocaleLowerCase("zh-Hant-TW") : "";
}

function verifyTransfer(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodTransferVersion
      || !optionalString(projection.transfer_hash)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.transferred_method_mappings)
      || !Array.isArray(object(projection.character_view).transferred_methods)) {
    const error = new Error("Phase79C requires an exact canonical Phase76E transfer projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_TRANSFER_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.transfer_hash;
  if (hashAgentRunValue(body) !== projection.transfer_hash) {
    const error = new Error("Phase79C Phase76E transfer hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_TRANSFER_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function verifyResolution(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodCompetitionResolutionVersion
      || !optionalString(projection.resolution_hash)
      || !Array.isArray(projection.character_contexts)) {
    const error = new Error("Phase79C requires an exact canonical Phase79B resolution projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.resolution_hash;
  if (hashAgentRunValue(body) !== projection.resolution_hash) {
    const error = new Error("Phase79C Phase79B resolution hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

export function buildWorldSimulationExperientialMethodCompetitionGuidanceContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodCompetitionGuidanceVersion,
    phase: "Phase79C",
    status: "competition_resolved_experiential_method_guidance_installed",
    source_owners: ["Phase76E", "Phase79B"],
    exact_source_hashes_required: true,
    resolved_dominant_component_keeps_only_dominant_method: true,
    indifferent_component_preserves_all_methods: true,
    tie_impasse_preserves_all_methods_for_deliberation: true,
    conflict_impasse_preserves_all_methods_for_deliberation: true,
    independent_noncompeting_methods_preserved: true,
    missing_resolution_context_fails_closed: true,
    advisory_guidance_only: true,
    direct_action_selection_allowed: false,
    direct_plan_goal_mutation_allowed: false,
    direct_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    direct_world_state_mutation_allowed: false,
    semantic_revision_allowed: false,
    same_turn_learning_feedback_allowed: false,
    numeric_similarity_confidence_probability_utility_modeled: false,
  });
}

export function projectWorldSimulationExperientialMethodCompetitionGuidance(input = {}) {
  const transfer = verifyTransfer(input.experiential_method_transfer);
  const resolution = verifyResolution(input.experiential_method_competition_resolution);
  const context = array(resolution.character_contexts).find((entry) =>
    characterKey(entry.character) === characterKey(transfer.character)
      && entry.current_turn_id === transfer.current_turn_id
      && entry.source_phase76e_transfer_hash === transfer.transfer_hash);
  if (!context) {
    const error = new Error("Phase79C cannot resolve Phase79B context for the exact Phase76E source.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_LINEAGE_MISMATCH";
    throw error;
  }

  const mappings = array(transfer.transferred_method_mappings);
  const guidance = array(transfer.character_view.transferred_methods);
  const methodByRef = new Map();
  for (const mapping of mappings) {
    const index = Number.isSafeInteger(mapping.transfer_index) ? mapping.transfer_index : -1;
    if (index < 0 || index >= guidance.length) {
      const error = new Error(`Phase79C cannot resolve transfer guidance for ${mapping.transfer_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_TRANSFER_INDEX_INVALID";
      throw error;
    }
    methodByRef.set(mapping.transfer_ref, {
      transfer_ref: mapping.transfer_ref,
      guidance: cloneJson(guidance[index]),
    });
  }

  const selectedRefs = new Set(array(context.independent_method_refs));
  const deliberationComponents = [];
  for (const component of array(context.competition_components)) {
    const members = array(component.method_refs);
    if (!["resolved_dominant", "indifferent_set", "tie_impasse", "conflict_impasse"].includes(component.resolution_status)) {
      const error = new Error(`Phase79C received unsupported resolution status ${component.resolution_status}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_COMPONENT_INVALID";
      throw error;
    }
    if (component.resolution_status === "resolved_dominant") {
      const dominant = optionalString(component.dominant_method_ref);
      if (!dominant || !members.includes(dominant)) {
        const error = new Error("Phase79C received an invalid resolved-dominant component.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_RESOLUTION_COMPONENT_INVALID";
        throw error;
      }
      selectedRefs.add(dominant);
      continue;
    }
    for (const ref of members) selectedRefs.add(ref);
    if (["tie_impasse", "conflict_impasse"].includes(component.resolution_status)) {
      deliberationComponents.push({
        resolution_ref: component.resolution_ref,
        resolution_status: component.resolution_status,
        method_refs: [...members].sort(compareText),
        unresolved_competition_refs: cloneJson(array(component.unresolved_competition_refs)),
        cyclic_preference_detected: component.cyclic_preference_detected === true,
      });
    }
  }

  for (const ref of selectedRefs) {
    if (!methodByRef.has(ref)) {
      const error = new Error(`Phase79C resolution references unknown Phase76E method ${ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_GUIDANCE_METHOD_OUT_OF_SOURCE";
      throw error;
    }
  }

  const methods = [...selectedRefs]
    .sort(compareText)
    .map((ref) => ({
      transfer_ref: ref,
      ...cloneJson(methodByRef.get(ref).guidance),
    }));
  const projection = {
    version: worldSimulationExperientialMethodCompetitionGuidanceVersion,
    character: transfer.character,
    current_turn_id: transfer.current_turn_id,
    source_phase76e_transfer_hash: transfer.transfer_hash,
    source_phase79b_resolution_hash: resolution.resolution_hash,
    character_view: {
      source: "competition_resolved_cue_grounded_experiential_methods",
      transferred_methods: methods,
      deliberation_required: deliberationComponents.length > 0,
      deliberation_components: deliberationComponents,
      advisory_only: true,
      selected_action_authority: false,
      action_candidate_generation_owner: "existing_world_action_proposer",
      action_deliberation_owner: "existing_phase74_phase75_cognition",
      current_context_revalidation_required: true,
      adaptation_before_use_required: true,
    },
    retained_method_refs: [...selectedRefs].sort(compareText),
    suppressed_competing_method_refs: [...methodByRef.keys()]
      .filter((ref) => !selectedRefs.has(ref))
      .sort(compareText),
    deliberation_component_count: deliberationComponents.length,
    audit: {
      exact_phase76e_source_verified: true,
      exact_phase79b_source_verified: true,
      resolved_dominant_filtering_applied: true,
      independent_noncompeting_methods_preserved: true,
      indifferent_methods_preserved: true,
      tie_conflict_impasses_preserved_for_deliberation: true,
      action_selection_performed: false,
      semantic_revision_performed: false,
      same_turn_learning_feedback_performed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
    },
  };
  projection.guidance_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
