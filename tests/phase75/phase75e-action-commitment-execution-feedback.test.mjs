import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  projectWorldSimulationEffectiveActionCommitment,
} from "../../server/src/world-simulation-effective-action-commitment-projection-service.mjs";
import {
  buildWorldSimulationActionCommitmentExecutionFeedbackContract,
  projectWorldSimulationActionCommitmentExecutionFeedback,
  worldSimulationActionCommitmentExecutionFeedbackVersion,
} from "../../server/src/world-simulation-action-commitment-execution-feedback-service.mjs";

const SESSION = "agent_run_phase75e_test_session";
const CHARACTER = "千夜測試角色";
const packet = {
  character: CHARACTER,
  cognition: {
    goals: ["守住入口"],
    current_action: "守住入口",
    known: ["同伴仍在後方"],
  },
  candidate_action_intents: [
    { action_id: "hold", intent: "守住入口" },
    { action_id: "retreat", intent: "撤退" },
  ],
};

function bundle(turnId, revision, previousHash, selection, actionId = null) {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: SESSION,
    turn_id: turnId,
    state_revision: revision,
    world_state_hash: previousHash,
    decision_packets: [packet],
    selected_action_intents: [{ character: CHARACTER, selection, action_id: actionId }],
  });
}

function turn(turnId, revisionFrom, previousHash, nextHash, receipts, actionOutcomes = []) {
  return {
    turn_id: turnId,
    revision_from: revisionFrom,
    revision_to: revisionFrom + 1,
    previous_state_hash: previousHash,
    next_state_hash: nextHash,
    subjective_choice_commitment_receipts: receipts,
    action_outcomes: actionOutcomes,
  };
}

const contract = buildWorldSimulationActionCommitmentExecutionFeedbackContract();
assert.equal(contract.phase, "Phase75E");
assert.equal(contract.version, worldSimulationActionCommitmentExecutionFeedbackVersion);
assert.equal(contract.source_of_truth, "committed_world_history_action_outcomes");
assert.equal(contract.engine_side_read_model_only, true);
assert.equal(contract.raw_causal_evidence_exposed_to_character, false);
assert.equal(contract.raw_action_outcome_payload_exposed_to_character, false);
assert.equal(contract.character_exposure_installed, false);
assert.equal(contract.result_label_interpreted_as_success_or_failure, false);
assert.equal(contract.completion_or_failure_inferred, false);
assert.equal(contract.action_outcome_authority_preserved, true);
assert.equal(contract.world_state_mutation_allowed, false);

const h0 = "a".repeat(64);
const h1 = "b".repeat(64);
const h2 = "c".repeat(64);
const h3 = "d".repeat(64);
const h4 = "e".repeat(64);
const hold1 = bundle("turn_1", 0, h0, "candidate_action_intent", "hold");
const hold2 = bundle("turn_2", 1, h1, "candidate_action_intent", "hold");
const reject3 = bundle("turn_3", 2, h2, "reject_all", null);
const retreat4 = bundle("turn_4", 3, h3, "candidate_action_intent", "retreat");

const history = {
  world_simulation_session_id: SESSION,
  turns: [
    turn("turn_1", 0, h0, h1, hold1, [
      { actor: CHARACTER, action_id: "hold", result: "position_held", causal_evidence: "hidden engine detail" },
      { actor: "另一名角色", action_id: "hold", result: "other_actor_result" },
    ]),
    turn("turn_2", 1, h1, h2, hold2, [
      { actor: CHARACTER, action_id: "hold", result: "blocked", causal_evidence: "door collapsed" },
      { actor: CHARACTER, action_id: "unrelated", result: "ignored" },
    ]),
  ],
};
const snapshot = JSON.stringify(history);
const commitment = projectWorldSimulationEffectiveActionCommitment({
  world_history: history,
  character: CHARACTER,
});
const feedback = projectWorldSimulationActionCommitmentExecutionFeedback({
  world_history: history,
  effective_action_commitment_projection: commitment,
});
assert.equal(feedback.ok, true);
assert.equal(feedback.version, worldSimulationActionCommitmentExecutionFeedbackVersion);
assert.equal(feedback.projection.status, "authoritative_execution_feedback_available");
assert.equal(feedback.projection.action_id, "hold");
assert.equal(feedback.projection.matching_outcome_count, 1);
assert.equal(feedback.projection.attempt_observed, true);
assert.equal(feedback.projection.latest_feedback.source_turn_id, "turn_2");
assert.equal(feedback.projection.latest_feedback.result_label, "blocked");
assert.equal(feedback.projection.latest_feedback.result_label_preserved_not_interpreted, true);
assert.equal(feedback.projection.latest_feedback.raw_outcome_payload_exposed, false);
assert.equal(feedback.projection.latest_feedback.causal_evidence_exposed, false);
assert.equal(Object.hasOwn(feedback.projection.latest_feedback, "causal_evidence"), false);
assert.equal(JSON.stringify(history), snapshot);
assert.equal(feedback.audit.result_semantics_interpreted, false);
assert.equal(feedback.audit.completion_or_failure_inferred, false);

const noOutcomeHistory = {
  world_simulation_session_id: SESSION,
  turns: [turn("turn_1", 0, h0, h1, hold1, [])],
};
const noOutcomeCommitment = projectWorldSimulationEffectiveActionCommitment({
  world_history: noOutcomeHistory,
  character: CHARACTER,
});
const noOutcomeFeedback = projectWorldSimulationActionCommitmentExecutionFeedback({
  world_history: noOutcomeHistory,
  effective_action_commitment_projection: noOutcomeCommitment,
});
assert.equal(noOutcomeFeedback.projection.status, "no_matching_authoritative_action_outcome_observed");
assert.equal(noOutcomeFeedback.projection.matching_outcome_count, 0);
assert.equal(noOutcomeFeedback.projection.attempt_observed, false);
assert.equal(noOutcomeFeedback.projection.latest_feedback, null);

const releasedHistory = {
  world_simulation_session_id: SESSION,
  turns: [
    turn("turn_1", 0, h0, h1, hold1, [{ actor: CHARACTER, action_id: "hold", result: "position_held" }]),
    turn("turn_2", 1, h1, h2, hold2, [{ actor: CHARACTER, action_id: "hold", result: "position_held_again" }]),
    turn("turn_3", 2, h2, h3, reject3, []),
  ],
};
const releasedCommitment = projectWorldSimulationEffectiveActionCommitment({
  world_history: releasedHistory,
  character: CHARACTER,
});
const releasedFeedback = projectWorldSimulationActionCommitmentExecutionFeedback({
  world_history: releasedHistory,
  effective_action_commitment_projection: releasedCommitment,
});
assert.equal(releasedFeedback.projection.status, "no_active_commitment_to_monitor");
assert.equal(releasedFeedback.projection.active_commitment_ref, null);
assert.equal(releasedFeedback.projection.matching_outcome_count, 0);

const replacedHistory = {
  world_simulation_session_id: SESSION,
  turns: [
    turn("turn_1", 0, h0, h1, hold1, [{ actor: CHARACTER, action_id: "hold", result: "old_hold_result" }]),
    turn("turn_2", 1, h1, h2, hold2, [{ actor: CHARACTER, action_id: "hold", result: "latest_hold_result" }]),
    turn("turn_3", 2, h2, h3, reject3, []),
    turn("turn_4", 3, h3, h4, retreat4, [
      { actor: CHARACTER, action_id: "hold", result: "stale_old_action_result" },
      { actor: CHARACTER, action_id: "retreat", result: "retreat_started" },
    ]),
  ],
};
const retreatCommitment = projectWorldSimulationEffectiveActionCommitment({
  world_history: replacedHistory,
  character: CHARACTER,
});
const retreatFeedback = projectWorldSimulationActionCommitmentExecutionFeedback({
  world_history: replacedHistory,
  effective_action_commitment_projection: retreatCommitment,
});
assert.equal(retreatFeedback.projection.action_id, "retreat");
assert.equal(retreatFeedback.projection.source_revision_from, 3);
assert.equal(retreatFeedback.projection.matching_outcome_count, 1);
assert.equal(retreatFeedback.projection.latest_feedback.result_label, "retreat_started");

const broken = JSON.parse(JSON.stringify(history));
broken.turns[1].previous_state_hash = "f".repeat(64);
assert.throws(
  () => projectWorldSimulationActionCommitmentExecutionFeedback({
    world_history: broken,
    effective_action_commitment_projection: commitment,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ACTION_COMMITMENT_EXECUTION_FEEDBACK_HISTORY_CHAIN_MISMATCH",
);

console.log("Phase75E action commitment execution feedback tests passed.");
