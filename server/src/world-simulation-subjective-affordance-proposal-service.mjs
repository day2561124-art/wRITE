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

function privateBindingBase({
  character,
  currentTurnId,
  actionId,
  perceptualObjectRef,
  objectId,
}) {
  return {
    version: worldSimulationSubjectiveAffordanceProposalVersion,
    character,
    current_turn_id: currentTurnId,
    action_id: actionId,
    perceptual_object_ref: perceptualObjectRef,
    object_id: objectId,
  };
}

function resolveCurrentPerceptualObjectBinding(input, character, turn, observationRef) {
  const matches = array(input.perceptual_object_bindings).filter((binding) => {
    const record = object(binding);
    return text(record.perceptual_object_ref) === observationRef
      && text(record.object_id);
  });
  if (matches.length !== 1) return null;
  return {
    character,
    current_turn_id: turn,
    perceptual_object_ref: observationRef,
    object_id: text(matches[0].object_id),
  };
}

export function materializeWorldSimulationSubjectiveAffordanceCausalSelection(input = {}) {
  const selected = copy(input.selected_action_intent ?? null);
  const candidate = object(selected?.candidate);
  const interaction = object(candidate.object_interaction);
  const perceptualObjectRef = text(interaction.perceptual_object_ref);
  if (!perceptualObjectRef) {
    return {
      selected_action_intent: selected,
      materialized: false,
      audit: null,
    };
  }
  if (interaction.type !== "pickup"
      || Object.hasOwn(interaction, "object_id")
      || Object.keys(interaction).some(
        (key) => !["type", "perceptual_object_ref"].includes(key)
      )) {
    const error = new Error(
      "Subjective affordance causal materialization requires the exact bounded pickup shape.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_CAUSAL_BINDING_INVALID";
    throw error;
  }
  const character = text(selected?.character);
  const turn = text(input.current_turn_id);
  const actionId = text(candidate.action_id);
  const matches = array(input.private_bindings).filter((binding) => {
    const record = object(binding);
    return record.character === character
      && record.current_turn_id === turn
      && record.action_id === actionId
      && record.perceptual_object_ref === perceptualObjectRef;
  });
  if (matches.length !== 1) {
    const error = new Error(
      "Selected subjective affordance is missing its exact current engine-private object binding.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_CAUSAL_BINDING_MISSING";
    throw error;
  }
  const binding = object(matches[0]);
  const objectId = text(binding.object_id);
  const expected = privateBindingBase({
    character,
    currentTurnId: turn,
    actionId,
    perceptualObjectRef,
    objectId,
  });
  if (!objectId || binding.binding_hash !== hashAgentRunValue(expected)) {
    const error = new Error(
      "Selected subjective affordance engine-private object binding failed integrity validation.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_AFFORDANCE_CAUSAL_BINDING_INVALID";
    throw error;
  }
  selected.candidate.object_interaction = {
    type: "pickup",
    object_id: objectId,
  };
  selected.candidate.target = objectId;
  return {
    selected_action_intent: selected,
    materialized: true,
    audit: {
      action_id: actionId,
      character,
      perceptual_object_ref: perceptualObjectRef,
      engine_object_id_exposed_to_character_brain: false,
      candidate_selection_changed: false,
      objective_feasibility_asserted: false,
      causal_outcome_asserted: false,
    },
  };
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
  const directObjectRef = observation.subject_ref_field === "object_id"
    && observation.descriptor?.object_id === observation.subject_ref;
  const opaqueObjectRef = observation.subject_ref_field === "perceptual_object_ref"
    && observation.descriptor?.perceptual_object_ref === observation.subject_ref;
  if (observation.character !== character || observation.current_turn_id !== turn
      || method.character !== character || method.current_turn_id !== turn
      || observation.subject_kind !== "object"
      || (!directObjectRef && !opaqueObjectRef)
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
  const currentPerceptualBinding = opaqueObjectRef
    ? resolveCurrentPerceptualObjectBinding(
        input,
        character,
        turn,
        observation.subject_ref,
      )
    : null;
  if (opaqueObjectRef && !currentPerceptualBinding) {
    return fail("current_visible_object_binding_required");
  }
  const identity = hashAgentRunValue({
    version: worldSimulationSubjectiveAffordanceProposalVersion,
    character,
    turn,
    observation_ref: observationRef,
    means_ref: meansRef,
    type: "pickup",
    subjective_target_ref: observation.subject_ref,
  });
  const actionId = `cb_c5c_candidate_${identity.slice(0, 24)}`;
  const action = {
    action_id: actionId,
    intent: `pickup ${text(observation.descriptor?.perceptual_label) ?? observation.subject_ref}`,
    object_interaction: opaqueObjectRef
      ? { type: "pickup", perceptual_object_ref: observation.subject_ref }
      : { type: "pickup", object_id: observation.subject_ref },
    target: observation.subject_ref,
  };
  if (menu.some((entry) => object(entry).action_id === action.action_id)) {
    return fail("action_id_collision_with_menu");
  }
  const privateBinding = currentPerceptualBinding
    ? {
        ...privateBindingBase({
          character,
          currentTurnId: turn,
          actionId,
          perceptualObjectRef: currentPerceptualBinding.perceptual_object_ref,
          objectId: currentPerceptualBinding.object_id,
        }),
      }
    : null;
  if (privateBinding) {
    privateBinding.binding_hash = hashAgentRunValue(privateBinding);
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
    private_binding: privateBinding,
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
