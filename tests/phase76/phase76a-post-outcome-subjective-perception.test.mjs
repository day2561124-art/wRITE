import assert from "node:assert/strict";

import {
  buildWorldSimulationPostOutcomeSubjectivePerceptionContract,
  projectWorldSimulationPostOutcomeSubjectivePerception,
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  projectWorldSimulationCharacterExperienceEvidence,
} from "../../server/src/world-simulation-loop-service.mjs";

const character = "伊萊亞斯・諾爾";
const actionId = "phase76a-move";
const turnId = "phase76a-turn-001";

const projection = projectWorldSimulationPostOutcomeSubjectivePerception({
  turn_id: turnId,
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: "向前移動",
  }],
  action_outcomes: [{
    actor: character,
    action_id: actionId,
    result: "movement_completed",
    causal_evidence: "hidden exact causal reason",
    distance_m: 4.25,
  }, {
    actor: "夜",
    action_id: "private-other-action",
    result: "private_other_result",
    causal_evidence: "private_other_cause",
  }],
  state_transitions: [{
    entity: character,
    actor: character,
    action_id: actionId,
    field: "position",
    from: { x: 1, y: 1 },
    to: { x: 2, y: 1 },
    cause: "hidden engine geometry",
  }, {
    entity: "夜",
    actor: "夜",
    action_id: "private-other-action",
    field: "health",
    from: 100,
    to: 80,
  }],
});

assert.equal(projection.version, worldSimulationPostOutcomeSubjectivePerceptionVersion);
assert.equal(projection.status, "bounded_post_outcome_subjective_perception_available");
assert.equal(projection.character_experiences.length, 1);
assert.equal(projection.character_experiences[0].character, character);
assert.equal(projection.character_experiences[0].action_id, actionId);
assert.equal(projection.character_experiences[0].experience.performed, true);
assert.equal(
  projection.character_experiences[0].experience.perceived_status,
  "self_action_effect_observed",
);
assert.equal(
  Object.hasOwn(projection.character_experiences[0].experience, "perceived_result"),
  false,
);
const serializedProjection = JSON.stringify(projection);
assert.equal(serializedProjection.includes("movement_completed"), false);
assert.equal(serializedProjection.includes("hidden exact causal reason"), false);
assert.equal(serializedProjection.includes("4.25"), false);
assert.equal(serializedProjection.includes("private_other_result"), false);
assert.equal(serializedProjection.includes("private_other_cause"), false);

const committedExperience = projectWorldSimulationCharacterExperienceEvidence({
  prepared_turn: {
    turn_id: turnId,
    decision_packets: [{
      character,
      perception: {
        observed: [],
        audible: [],
        other_senses: [],
        information_boundary: {},
      },
    }],
  },
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: "向前移動",
  }],
  action_outcomes: [{
    actor: character,
    action_id: actionId,
    result: "movement_completed",
    causal_evidence: "must stay engine-only",
  }],
  post_outcome_subjective_perception_projection: projection,
  runtime_identities: [{
    character,
    world_lineage: "phase76a-session",
    character_entity_id: "phase76a-character",
    canonical_name: character,
    identity_source: "test_fixture_ephemeral_identity",
    formal_identity: false,
    experience_sequence: 1,
  }],
});

const experiencedOutcome = committedExperience.character_projections[0]
  .experience.participation.experienced_action_outcomes[0];
assert.equal(experiencedOutcome.action_id, actionId);
assert.equal(experiencedOutcome.performed, true);
assert.equal(experiencedOutcome.perceived_status, "self_action_effect_observed");
assert.equal(Object.hasOwn(experiencedOutcome, "result"), false);
assert.equal(Object.hasOwn(experiencedOutcome, "causal_evidence"), false);

const explicitProjection = projectWorldSimulationPostOutcomeSubjectivePerception({
  turn_id: "phase76a-explicit-turn",
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: "phase76a-explicit",
  }],
  action_outcomes: [{
    actor: character,
    action_id: "phase76a-explicit",
    result: "engine_result_must_not_replace_subjective_result",
    causal_evidence: "engine_cause_must_not_surface",
    character_experience: {
      performed: true,
      perceived_result: "我感覺門沒有打開",
      perceived_status: "受阻",
    },
  }],
  state_transitions: [],
});
assert.equal(
  explicitProjection.character_experiences[0].experience.perceived_result,
  "我感覺門沒有打開",
);
assert.equal(explicitProjection.character_experiences[0].experience.perceived_status, "受阻");
assert.equal(
  JSON.stringify(explicitProjection).includes("engine_result_must_not_replace_subjective_result"),
  false,
);

const blockedProjection = projectWorldSimulationPostOutcomeSubjectivePerception({
  turn_id: "phase76a-blocked-turn",
  selected_action_intents: [{
    character,
    selection: "candidate_action_intent",
    action_id: "phase76a-blocked",
  }],
  action_outcomes: [{
    actor: character,
    action_id: "phase76a-blocked",
    result: "blocked_by_hidden_lock",
    causal_evidence: "door lock state is hidden",
  }],
  state_transitions: [],
});
assert.equal(
  blockedProjection.status,
  "no_bounded_post_outcome_subjective_perception_available",
);
assert.equal(blockedProjection.character_experiences.length, 0);

const tampered = structuredClone(projection);
tampered.character_experiences[0].experience.perceived_status = "tampered";
assert.throws(
  () => projectWorldSimulationCharacterExperienceEvidence({
    prepared_turn: {
      turn_id: turnId,
      decision_packets: [{
        character,
        perception: { observed: [], audible: [], other_senses: [] },
      }],
    },
    selected_action_intents: [{
      character,
      selection: "candidate_action_intent",
      action_id: actionId,
    }],
    action_outcomes: [],
    post_outcome_subjective_perception_projection: tampered,
    runtime_identities: [{
      character,
      world_lineage: "phase76a-session",
      character_entity_id: "phase76a-character",
      canonical_name: character,
      identity_source: "test_fixture_ephemeral_identity",
      formal_identity: false,
      experience_sequence: 1,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_PERCEPTION_HASH_MISMATCH",
);

const contract = buildWorldSimulationPostOutcomeSubjectivePerceptionContract();
assert.equal(contract.transition_and_observation_separated, true);
assert.equal(contract.objective_result_label_auto_exposed, false);
assert.equal(contract.raw_result_interpreted_as_perceived_success_or_failure, false);
assert.equal(contract.world_state_mutation_applied, false);

console.log("Phase76A post-outcome subjective perception tests passed.");
