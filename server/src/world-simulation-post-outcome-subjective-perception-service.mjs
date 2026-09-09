import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationPostOutcomeSubjectivePerceptionVersion =
  "phase76a-post-outcome-subjective-perception-v1";

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

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}

function safeScalar(value) {
  if (value === null || value === undefined) return null;
  return ["string", "number", "boolean"].includes(typeof value)
    ? cloneJson(value)
    : null;
}

function explicitActorExperience(outcome) {
  const source = object(
    outcome?.character_experience
    ?? outcome?.experience_for_actor,
  );
  const projected = {};
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(source, key)) continue;
    const value = safeScalar(source[key]);
    if (value !== null) projected[key] = value;
  }
  return Object.keys(projected).length > 0 ? projected : null;
}

function selectedActionRecord(selected) {
  if (!isObject(selected) || selected.selection !== "candidate_action_intent") return null;
  const character = text(selected.character);
  const actionId = text(selected.action_id ?? selected.candidate?.action_id);
  if (!character || !actionId) return null;
  return {
    character,
    action_id: actionId,
  };
}

function outcomeMatchesSelection(outcome, selection) {
  return sameCharacter(outcome?.actor, selection.character)
    && text(outcome?.action_id) === selection.action_id;
}

function transitionMatchesOwnActionEffect(transition, selection) {
  if (text(transition?.action_id) !== selection.action_id) return false;
  return sameCharacter(transition?.actor, selection.character)
    || sameCharacter(transition?.entity, selection.character);
}

function buildExperience(selection, matchingOutcomes, matchingTransitions) {
  const explicitExperiences = matchingOutcomes
    .map(explicitActorExperience)
    .filter(Boolean);

  const explicit = explicitExperiences.length > 0
    ? explicitExperiences[explicitExperiences.length - 1]
    : null;

  // A causal outcome record alone is not enough to tell the character that the
  // action was actually performed. The action might have been preempted before
  // execution, or the true reason may be hidden. Without explicit bounded
  // actor evidence, only an action-linked transition involving the actor can
  // support a generic self-effect observation.
  if (!explicit && matchingTransitions.length === 0) return null;

  const performed = explicit && Object.hasOwn(explicit, "performed")
    ? explicit.performed
    : matchingTransitions.length > 0
      ? true
      : null;
  const perceivedResult = explicit?.perceived_result ?? null;
  const perceivedStatus = explicit?.perceived_status
    ?? (matchingTransitions.length > 0 ? "self_action_effect_observed" : null);

  return {
    action_id: selection.action_id,
    ...(performed !== null ? { performed } : {}),
    ...(perceivedResult !== null ? { perceived_result: perceivedResult } : {}),
    ...(perceivedStatus !== null ? { perceived_status: perceivedStatus } : {}),
  };
}

export function buildWorldSimulationPostOutcomeSubjectivePerceptionContract() {
  return Object.freeze({
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    phase: "Phase76A",
    owner: "programmatic_post_outcome_subjective_perception_layer",
    source_authority: "committed_candidate_selection_plus_authoritative_causal_evidence",
    transition_and_observation_separated: true,
    objective_result_label_auto_exposed: false,
    causal_evidence_auto_exposed: false,
    exact_engine_geometry_auto_exposed: false,
    other_character_private_state_auto_exposed: false,
    explicit_actor_experience_preserved_when_present: true,
    own_action_selection_alone_supports_performed_claim: false,
    own_action_transition_supports_generic_self_effect_awareness: true,
    raw_result_interpreted_as_perceived_success_or_failure: false,
    character_brain_authors_projection: false,
    world_state_mutation_applied: false,
  });
}

export function projectWorldSimulationPostOutcomeSubjectivePerception(input = {}) {
  const turnId = text(input.turn_id);
  if (!turnId) {
    const error = new Error("Phase76A post-outcome subjective perception requires turn_id.");
    error.code = "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_PERCEPTION_TURN_REQUIRED";
    throw error;
  }

  const selections = array(input.selected_action_intents)
    .map(selectedActionRecord)
    .filter(Boolean);
  const actionOutcomes = cloneJson(array(input.action_outcomes));
  const stateTransitions = cloneJson(array(input.state_transitions));

  const characterExperiences = selections.flatMap((selection) => {
    const matchingOutcomes = actionOutcomes.filter((outcome) => (
      outcomeMatchesSelection(outcome, selection)
    ));
    if (matchingOutcomes.length === 0) return [];
    const matchingTransitions = stateTransitions.filter((transition) => (
      transitionMatchesOwnActionEffect(transition, selection)
    ));
    const experience = buildExperience(
      selection,
      matchingOutcomes,
      matchingTransitions,
    );
    if (!experience) return [];
    const sourceOutcomeHashes = matchingOutcomes.map((outcome) => hashAgentRunValue(outcome));
    const sourceTransitionHashes = matchingTransitions.map((transition) => hashAgentRunValue(transition));
    const identity = {
      version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
      turn_id: turnId,
      character: selection.character,
      action_id: selection.action_id,
      experience,
      source_outcome_hashes: sourceOutcomeHashes,
      source_transition_hashes: sourceTransitionHashes,
    };
    return [{
      subjective_perception_ref:
        `phase76a_post_outcome_${hashAgentRunValue(identity).slice(0, 24)}`,
      ...identity,
      source_outcome_count: matchingOutcomes.length,
      source_transition_count: matchingTransitions.length,
      objective_result_label_exposed: false,
      causal_evidence_exposed: false,
      exact_engine_geometry_exposed: false,
      other_character_private_state_exposed: false,
      raw_result_interpreted_as_perceived_success_or_failure: false,
    }];
  });

  const body = {
    version: worldSimulationPostOutcomeSubjectivePerceptionVersion,
    phase: "Phase76A",
    status: characterExperiences.length > 0
      ? "bounded_post_outcome_subjective_perception_available"
      : "no_bounded_post_outcome_subjective_perception_available",
    turn_id: turnId,
    character_experiences: characterExperiences,
    boundaries: {
      objective_world_outcome_remains_causal_authority: true,
      projection_is_subjective_observation_not_world_truth: true,
      selected_action_is_not_success_claim: true,
      action_outcome_presence_is_not_success_claim: true,
      own_action_transition_is_not_goal_achievement: true,
      result_label_auto_exposure: false,
      causal_evidence_auto_exposure: false,
      exact_engine_geometry_auto_exposure: false,
      other_character_private_state_auto_exposure: false,
      explicit_actor_experience_may_be_preserved: true,
      world_state_mutation_applied: false,
    },
  };
  body.projection_hash = hashAgentRunValue(body);
  return cloneJson(body);
}
