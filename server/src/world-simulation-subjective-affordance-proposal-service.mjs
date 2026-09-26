import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationSubjectiveAffordanceEvidenceVersion } from "./world-simulation-subjective-affordance-evidence-service.mjs";

export const worldSimulationSubjectiveAffordanceProposalVersion =
  "cb-c5c-subjective-affordance-proposal-v1";
const maximumMenuCandidates = 22;
const maximumProposals = 1;
export const nativeSubjectiveAffordanceProposalCapability =
  "subjective_affordance_proposal_v1";

export function resolveWorldSimulationNativeSubjectiveAffordanceProposal(
  catalog,
  brainResult,
) {
  const result = object(brainResult);
  if (!Object.hasOwn(result, "subjective_affordance_proposal")) return null;
  if (result.subjective_affordance_catalog_hash !== catalog?.catalog_hash) {
    return null;
  }
  const proposal = object(result.subjective_affordance_proposal);
  if (Object.keys(proposal).length !== 2
      || !text(proposal.observation_ref)
      || !text(proposal.means_ref)) return null;
  return proposal;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function text(value) {
  return typeof value === "string" && value.trim() && value.length <= 240
    ? value.trim() : null;
}
function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function fail(reason) {
  return { admitted: false, reason };
}
function expectedCatalogHash(catalog) {
  const { catalog_hash, ...content } = catalog;
  return hashAgentRunValue(content);
}

export function admitWorldSimulationSubjectiveAffordanceProposal(input = {}) {
  const character = text(input.character);
  const turn = text(input.current_turn_id);
  const catalog = object(input.evidence_catalog);
  const request = object(input.proposal);
  const menu = array(input.available_actions);
  if (!character || !turn || catalog.version !== worldSimulationSubjectiveAffordanceEvidenceVersion
      || catalog.character !== character || catalog.current_turn_id !== turn
      || catalog.catalog_hash !== expectedCatalogHash(catalog)) {
    return fail("current_same_character_evidence_catalog_required");
  }
  // A character proposes exact evidence refs. The server constructs the action shape;
  // untrusted proposal fields cannot provide a skill, target, effect, or outcome.
  const observationRef = text(request.observation_ref);
  const meansRef = text(request.means_ref);
  if (!observationRef || !meansRef || Object.keys(request).some(
    (key) => !["observation_ref", "means_ref"].includes(key)
  )) return fail("proposal_must_contain_only_exact_evidence_refs");
  const observations = array(catalog.observation_catalog).filter(
    (entry) => entry.observation_ref === observationRef
  );
  const means = array(catalog.represented_means_catalog).filter(
    (entry) => entry.means_ref === meansRef
  );
  if (observations.length !== 1 || means.length !== 1) {
    return fail("observation_or_means_ref_not_in_current_catalog");
  }
  const observation = observations[0];
  const method = means[0];
  if (observation.character !== character || observation.current_turn_id !== turn
      || method.character !== character || method.current_turn_id !== turn
      || observation.subject_kind !== "object"
      || observation.subject_ref_field !== "object_id"
      || observation.descriptor?.object_id !== observation.subject_ref
      || method.source_kind !== "experiential_method_guidance"
      || method.advisory_only !== true || method.action_selection_authority !== false) {
    return fail("typed_observation_and_canonical_means_required");
  }
  const represented = object(method.represented_means);
  const skeleton = object(represented.method_skeleton);
  if (represented.source_knowledge_status !== "supported"
      || represented.subjective_not_world_truth !== true
      || skeleton.relation !== "pickup"
      || skeleton.method_ref !== "ordinary_object_pickup"
      || !text(method.upstream_ref)) {
    return fail("supported_explicit_pickup_method_required");
  }
  const identity = hashAgentRunValue({
    version: worldSimulationSubjectiveAffordanceProposalVersion,
    character, turn, observation_ref: observationRef, means_ref: meansRef,
    type: "pickup", object_id: observation.subject_ref,
  });
  const action = {
    action_id: `cb_c5c_candidate_${identity.slice(0, 24)}`,
    intent: `pickup ${observation.subject_ref}`,
    object_interaction: { type: "pickup", object_id: observation.subject_ref },
    target: observation.subject_ref,
  };
  if (menu.some((entry) => object(entry).action_id === action.action_id)) {
    return fail("action_id_collision_with_menu");
  }
  return {
    admitted: true,
    version: worldSimulationSubjectiveAffordanceProposalVersion,
    character,
    current_turn_id: turn,
    catalog_hash: catalog.catalog_hash,
    observation_ref: observationRef,
    means_ref: meansRef,
    candidate: action,
    available_actions: [...copy(menu.slice(0, maximumMenuCandidates)), action],
    menu_input_count: menu.length,
    menu_preserved_count: Math.min(menu.length, maximumMenuCandidates),
    menu_truncated: menu.length > maximumMenuCandidates,
    maximum_proposals: maximumProposals,
    communication_slot_reserved: true,
    selected_action: false,
    objective_feasibility_verified: false,
    causal_outcome_asserted: false,
  };
}
