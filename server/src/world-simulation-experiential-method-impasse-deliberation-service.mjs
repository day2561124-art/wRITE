import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodCompetitionResolutionVersion } from "./world-simulation-experiential-method-competition-resolution-service.mjs";
import { worldSimulationExperientialMethodCompetitionGuidanceVersion } from "./world-simulation-experiential-method-competition-guidance-service.mjs";

export const worldSimulationExperientialMethodImpasseDeliberationVersion =
  "phase79d-experiential-method-impasse-deliberation-v1";

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
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function verifyResolution(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodCompetitionResolutionVersion
      || !optionalString(projection.resolution_hash)
      || !Array.isArray(projection.character_contexts)) {
    const error = new Error("Phase79D requires an exact canonical Phase79B resolution projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.resolution_hash;
  if (hashAgentRunValue(body) !== projection.resolution_hash) {
    const error = new Error("Phase79D Phase79B resolution hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function verifyGuidance(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodCompetitionGuidanceVersion
      || !optionalString(projection.guidance_hash)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(object(projection.character_view).transferred_methods)
      || !Array.isArray(object(projection.character_view).deliberation_components)) {
    const error = new Error("Phase79D requires an exact canonical Phase79C guidance projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_GUIDANCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.guidance_hash;
  if (hashAgentRunValue(body) !== projection.guidance_hash) {
    const error = new Error("Phase79D Phase79C guidance hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_GUIDANCE_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

export function buildWorldSimulationExperientialMethodImpasseDeliberationContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    phase: "Phase79D",
    status: "experiential_method_impasse_deliberation_evidence_installed",
    source_owners: ["Phase79B", "Phase79C"],
    exact_source_hashes_required: true,
    tie_and_conflict_impasses_only: true,
    bounded_impasse_substate_surface_only: true,
    retained_method_lineage_preserved: true,
    existing_bounded_current_context_basis_reused: true,
    additional_discriminating_evidence_requested_downstream: true,
    new_preference_authored: false,
    arbitrary_tie_breaking_allowed: false,
    numeric_similarity_confidence_probability_utility_modeled: false,
    direct_action_selection_allowed: false,
    semantic_revision_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    same_turn_learning_feedback_allowed: false,
    world_truth_authority_claimed: false,
  });
}

export function projectWorldSimulationExperientialMethodImpasseDeliberation(input = {}) {
  const resolution = verifyResolution(input.experiential_method_competition_resolution);
  const guidance = verifyGuidance(input.experiential_method_competition_guidance);
  if (guidance.source_phase79b_resolution_hash !== resolution.resolution_hash) {
    const error = new Error("Phase79D Phase79B/79C lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_LINEAGE_MISMATCH";
    throw error;
  }
  const resolutionContext = array(resolution.character_contexts).find((entry) =>
    characterKey(entry.character) === characterKey(guidance.character)
      && entry.current_turn_id === guidance.current_turn_id
      && entry.source_phase76e_transfer_hash === guidance.source_phase76e_transfer_hash);
  if (!resolutionContext) {
    const error = new Error("Phase79D cannot resolve the exact Phase79B character context.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_CONTEXT_MISSING";
    throw error;
  }

  const methodByRef = new Map(array(guidance.character_view.transferred_methods)
    .map((method) => [method.transfer_ref, method]));
  const resolutionByRef = new Map(array(resolutionContext.competition_components)
    .map((component) => [component.resolution_ref, component]));
  const impasses = array(guidance.character_view.deliberation_components)
    .map((summary) => {
      const component = resolutionByRef.get(summary.resolution_ref);
      if (!component
          || component.resolution_status !== summary.resolution_status
          || !["tie_impasse", "conflict_impasse"].includes(component.resolution_status)) {
        const error = new Error(`Phase79D cannot verify deliberation component ${summary.resolution_ref}.`);
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_COMPONENT_INVALID";
        throw error;
      }
      const methodRefs = [...array(component.method_refs)].sort(compareText);
      const methods = methodRefs.map((ref) => {
        const method = methodByRef.get(ref);
        if (!method) {
          const error = new Error(`Phase79D retained method ${ref} is missing from Phase79C guidance.`);
          error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_METHOD_MISSING";
          throw error;
        }
        return {
          transfer_ref: ref,
          method_skeleton: cloneJson(method.method_skeleton ?? null),
          source_knowledge_status: method.source_knowledge_status ?? "supported",
          mapping_kind: method.mapping_kind ?? null,
          current_context_basis: cloneJson(array(method.current_context_basis)),
          current_context_grounded: method.current_context_grounded === true,
          advisory_only: true,
        };
      });
      const base = {
        character: guidance.character,
        current_turn_id: guidance.current_turn_id,
        source_resolution_ref: component.resolution_ref,
        impasse_type: component.resolution_status,
        retained_method_refs: methodRefs,
        unresolved_competition_refs: cloneJson(array(component.unresolved_competition_refs)).sort(compareText),
        cyclic_preference_detected: component.cyclic_preference_detected === true,
      };
      return {
        impasse_ref: `phase79d_impasse_${hashAgentRunValue({
          version: worldSimulationExperientialMethodImpasseDeliberationVersion,
          source_phase79b_resolution_hash: resolution.resolution_hash,
          source_phase79c_guidance_hash: guidance.guidance_hash,
          ...base,
        }).slice(0, 24)}`,
        ...base,
        candidate_methods: methods,
        deliberation_contract: {
          seek_additional_discriminating_current_context_evidence: true,
          preserve_all_retained_methods_until_resolved: true,
          qualitative_resolution_only: true,
          new_preference_may_be_authored_here: false,
          action_selection_may_be_authored_here: false,
          semantic_revision_may_be_authored_here: false,
          arbitrary_tie_breaking_allowed: false,
        },
      };
    })
    .sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));

  const projection = {
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    character: guidance.character,
    current_turn_id: guidance.current_turn_id,
    source_phase79b_resolution_hash: resolution.resolution_hash,
    source_phase79c_guidance_hash: guidance.guidance_hash,
    impasse_contexts: impasses,
    impasse_count: impasses.length,
    deliberation_required: impasses.length > 0,
    audit: {
      exact_phase79b_source_verified: true,
      exact_phase79c_source_verified: true,
      tie_conflict_only: true,
      retained_method_lineage_verified: true,
      bounded_existing_context_basis_only: true,
      new_preference_authored: false,
      action_selection_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      same_turn_learning_feedback_performed: false,
    },
  };
  projection.impasse_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
