import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationActionCommitmentExecutionFeedbackVersion,
} from "../../server/src/world-simulation-action-commitment-execution-feedback-service.mjs";
import {
  buildWorldSimulationActionCommitmentSubjectiveExecutionExperienceContract,
  projectWorldSimulationActionCommitmentSubjectiveExecutionExperience,
  worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion,
} from "../../server/src/world-simulation-action-commitment-subjective-execution-experience-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const character = "伊萊亞斯・諾爾";
const actionId = "phase75f-action-001";
const outcome = {
  actor: character,
  action_id: actionId,
  result: "objective_hidden_result_must_not_surface",
  causal_evidence: "hidden engine-only causal evidence",
};
const outcomeHash = hashAgentRunValue(outcome);
function committedExperienceProjection({ turnId, action, experiences }) {
  const projection = {
    experience_contract_version: "committed-character-experience-receipt-v1",
    projection_version: "committed-character-experience-projection-v1",
    historical_semantics_version: "committed-character-experience-projection-v1",
    turn_id: turnId,
    character_projections: [{
      projection_slot: 0,
      experience_sequence: 1,
      world_lineage: "phase75f-session",
      character_entity_id: "fixture-character",
      canonical_name: character,
      identity_source: "test_fixture_ephemeral_identity",
      formal_identity: false,
      character,
      experience: {
        roles: { participant: true, observer: false },
        participation: {
          selected_intent: { action_id: action, intent: "測試行動" },
          experienced_action_outcomes: experiences,
          selected_intent_is_not_outcome: true,
        },
        observation: { observed: [], audible: [], other_senses: [], information_boundary: {} },
      },
      boundaries: {
        source_is_bounded_character_information: true,
        raw_world_state_included: false,
        hidden_causal_chain_included: false,
        other_character_private_state_included: false,
        exact_engine_geometry_included: false,
        participant_intent_promoted_to_success: false,
        objective_action_result_auto_exposed: false,
        post_outcome_experience_requires_explicit_bounded_actor_evidence: true,
      },
    }],
    boundaries: {
      objective_world_history_remains_source_of_truth: true,
      full_next_world_state_stored_here: false,
      replay_uses_stored_historical_projection: true,
      current_perception_engine_reinterpretation_required_for_replay: false,
      character_brain_authors_projection: false,
      character_brain_authors_receipt: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}
const history = {
  world_simulation_session_id: "phase75f-session",
  turns: [{
    turn_id: "phase75f-turn-001",
    revision_from: 4,
    revision_to: 5,
    previous_state_hash: "a".repeat(64),
    next_state_hash: "b".repeat(64),
    action_outcomes: [outcome],
    committed_character_experience_projection: committedExperienceProjection({
      turnId: "phase75f-turn-001",
      action: actionId,
      experiences: [{
        action_id: actionId,
        performed: true,
        perceived_result: "感覺攻擊被擋住",
      }],
    }),
  }],
};
const executionFeedback = {
  ok: true,
  version: worldSimulationActionCommitmentExecutionFeedbackVersion,
  world_simulation_session_id: history.world_simulation_session_id,
  character,
  projection: {
    status: "authoritative_execution_feedback_available",
    active_commitment_ref: "phase75a_commitment_ref_001",
    action_id: actionId,
    matching_outcome_count: 1,
    feedback: [{
      feedback_ref: "phase75e_feedback_ref_001",
      source_turn_id: "phase75f-turn-001",
      outcome_index: 0,
      outcome_hash: outcomeHash,
    }],
  },
};

const contract = buildWorldSimulationActionCommitmentSubjectiveExecutionExperienceContract();
assert.equal(contract.phase, "Phase75F");
assert.equal(contract.missing_character_experience_never_falls_back_to_world_truth, true);
assert.equal(contract.execution_feedback_does_not_auto_revoke_commitment, true);

const projection = projectWorldSimulationActionCommitmentSubjectiveExecutionExperience({
  execution_feedback_projection: executionFeedback,
  world_history: history,
});
assert.equal(projection.version, worldSimulationActionCommitmentSubjectiveExecutionExperienceVersion);
assert.equal(projection.projection.status, "subjective_execution_feedback_available");
assert.equal(projection.projection.subjective_feedback_count, 1);
assert.equal(projection.projection.latest_subjective_feedback.performed, true);
assert.equal(
  projection.projection.latest_subjective_feedback.perceived_result,
  "感覺攻擊被擋住",
);
const serialized = JSON.stringify(projection);
assert.equal(serialized.includes("objective_hidden_result_must_not_surface"), false);
assert.equal(serialized.includes("hidden engine-only causal evidence"), false);
assert.equal(serialized.includes("causal_evidence"), true);
assert.equal(projection.information_boundary.causal_evidence_exposed, false);

const hiddenOutcome = {
  ...outcome,
  action_id: "phase75f-action-hidden",
  result: "engine_knows_success",
  character_experience: undefined,
};
delete hiddenOutcome.character_experience;
const hiddenHistory = {
  ...history,
  turns: [{
    ...history.turns[0],
    action_outcomes: [hiddenOutcome],
  }],
};
const hiddenFeedback = {
  ...executionFeedback,
  projection: {
    ...executionFeedback.projection,
    action_id: hiddenOutcome.action_id,
    feedback: [{
      feedback_ref: "phase75e_feedback_hidden",
      source_turn_id: "phase75f-turn-001",
      outcome_index: 0,
      outcome_hash: hashAgentRunValue(hiddenOutcome),
    }],
  },
};
const hiddenProjection = projectWorldSimulationActionCommitmentSubjectiveExecutionExperience({
  execution_feedback_projection: hiddenFeedback,
  world_history: hiddenHistory,
});
assert.equal(
  hiddenProjection.projection.status,
  "authoritative_execution_observed_but_not_subjectively_available",
);
assert.equal(hiddenProjection.projection.subjective_feedback_count, 0);
assert.equal(JSON.stringify(hiddenProjection).includes("engine_knows_success"), false);
const hiddenBrainInput = buildWorldSimulationCharacterBrainInput({
  character,
  cognition: {},
  candidate_action_intents: [],
  boundaries: {},
}, {
  action_commitment_subjective_execution_experience: hiddenProjection,
});
assert.equal(
  hiddenBrainInput.cognition.action_commitment_execution_experience.status,
  "no_subjective_execution_feedback",
);
assert.equal(
  JSON.stringify(hiddenBrainInput.cognition.action_commitment_execution_experience)
    .includes("authoritative_execution_observed_but_not_subjectively_available"),
  false,
);
assert.equal(
  Object.hasOwn(
    hiddenBrainInput.cognition.action_commitment_execution_experience,
    "authoritative_feedback_count",
  ),
  false,
);

const brainInput = buildWorldSimulationCharacterBrainInput({
  character,
  cognition: {},
  candidate_action_intents: [],
  boundaries: {},
}, {
  action_commitment_subjective_execution_experience: projection,
});
assert.equal(
  brainInput.boundaries.action_commitment_subjective_execution_experience_v1_installed,
  true,
);
assert.equal(
  brainInput.cognition.action_commitment_execution_experience.latest_subjective_feedback.perceived_result,
  "感覺攻擊被擋住",
);
assert.equal(
  JSON.stringify(brainInput.cognition.action_commitment_execution_experience)
    .includes("objective_hidden_result_must_not_surface"),
  false,
);

assert.throws(
  () => buildWorldSimulationCharacterBrainInput({
    character: "夜",
    cognition: {},
    candidate_action_intents: [],
    boundaries: {},
  }, {
    action_commitment_subjective_execution_experience: projection,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_COMMITMENT_SUBJECTIVE_EXECUTION_EXPERIENCE_INVALID",
);

console.log("Phase75F subjective action execution experience tests passed.");
