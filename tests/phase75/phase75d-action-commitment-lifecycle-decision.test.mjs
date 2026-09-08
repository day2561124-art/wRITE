import assert from "node:assert/strict";

import {
  buildWorldSimulationActionCommitmentLifecycleDecision,
  buildWorldSimulationActionCommitmentLifecycleDecisionContract,
  worldSimulationActionCommitmentLifecycleDecisionVersion,
} from "../../server/src/world-simulation-action-commitment-lifecycle-decision-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationEffectiveActionCommitment } from "../../server/src/world-simulation-effective-action-commitment-projection-service.mjs";

const CHARACTER = "千夜測試角色";
const SESSION = "agent_run_phase75d_test_session";
const packet = {
  character: CHARACTER,
  cognition: { goals: ["保護同伴"], known: ["出口在東側"], uncertain: ["側門是否安全"] },
  candidate_action_intents: [
    { action_id: "hold", intent: "守住入口", known_costs: ["撤退變慢"] },
    { action_id: "retreat", intent: "帶同伴撤退", known_costs: ["放棄入口"] },
  ],
};

function receipt(turnId, revision, hash, selection, actionId = null) {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: SESSION,
    turn_id: turnId,
    state_revision: revision,
    world_state_hash: hash,
    decision_packets: [packet],
    selected_action_intents: [{ character: CHARACTER, selection, action_id: actionId }],
  }).receipts[0];
}

const contract = buildWorldSimulationActionCommitmentLifecycleDecisionContract();
assert.equal(contract.phase, "Phase75D");
assert.equal(contract.version, worldSimulationActionCommitmentLifecycleDecisionVersion);
assert.deepEqual(contract.lifecycle_decisions, ["adopt", "maintain", "release", "replace", "no_change"]);
assert.equal(contract.reconsideration_evidence_does_not_auto_decide_lifecycle, true);
assert.equal(contract.action_execution_or_success_inferred, false);

const hash0 = "a".repeat(64);
const hash1 = "b".repeat(64);
const hash2 = "c".repeat(64);
const hash3 = "d".repeat(64);
const adoptReceipt = receipt("turn_1", 0, hash0, "candidate_action_intent", "hold");
const prior = {
  commitment_ref: "phase75a_commitment_test",
  character: CHARACTER,
  action_id: "hold",
  commitment_status: "active",
};
const adopt = buildWorldSimulationActionCommitmentLifecycleDecision({ current_choice_receipt: adoptReceipt });
assert.equal(adopt.lifecycle_decision, "adopt");
assert.equal(adopt.prior_commitment_ref, null);
assert.equal(adopt.durable_via_source_receipt, true);
assert.match(adopt.lifecycle_decision_id, /^phase75d_lifecycle_/);

const maintain = buildWorldSimulationActionCommitmentLifecycleDecision({
  prior_active_commitment: prior,
  current_choice_receipt: receipt("turn_2", 1, hash1, "candidate_action_intent", "hold"),
});
assert.equal(maintain.lifecycle_decision, "maintain");
assert.equal(maintain.prior_commitment_ref, prior.commitment_ref);
assert.equal(maintain.replacement_action_id, null);

const replace = buildWorldSimulationActionCommitmentLifecycleDecision({
  prior_active_commitment: prior,
  current_choice_receipt: receipt("turn_2", 1, hash1, "candidate_action_intent", "retreat"),
});
assert.equal(replace.lifecycle_decision, "replace");
assert.equal(replace.prior_action_id, "hold");
assert.equal(replace.replacement_action_id, "retreat");

const release = buildWorldSimulationActionCommitmentLifecycleDecision({
  prior_active_commitment: prior,
  current_choice_receipt: receipt("turn_2", 1, hash1, "reject_all"),
});
assert.equal(release.lifecycle_decision, "release");
assert.equal(release.selected_action_id, null);
assert.equal(release.action_execution_or_success_inferred, false);
const noChange = buildWorldSimulationActionCommitmentLifecycleDecision({
  current_choice_receipt: receipt("turn_1", 0, hash0, "reject_all"),
});
assert.equal(noChange.lifecycle_decision, "no_change");
assert.equal(noChange.prior_commitment_ref, null);

const history = {
  world_simulation_session_id: SESSION,
  turns: [
    { turn_id: "turn_1", revision_from: 0, revision_to: 1, previous_state_hash: hash0, next_state_hash: hash1, subjective_choice_commitment_receipts: { ...buildWorldSimulationSubjectiveChoiceCommitmentReceipts({ world_simulation_session_id: SESSION, turn_id: "turn_1", state_revision: 0, world_state_hash: hash0, decision_packets: [packet], selected_action_intents: [{ character: CHARACTER, selection: "candidate_action_intent", action_id: "hold" }] }) } },
    { turn_id: "turn_2", revision_from: 1, revision_to: 2, previous_state_hash: hash1, next_state_hash: hash2, subjective_choice_commitment_receipts: buildWorldSimulationSubjectiveChoiceCommitmentReceipts({ world_simulation_session_id: SESSION, turn_id: "turn_2", state_revision: 1, world_state_hash: hash1, decision_packets: [packet], selected_action_intents: [{ character: CHARACTER, selection: "candidate_action_intent", action_id: "hold" }] }) },
    { turn_id: "turn_3", revision_from: 2, revision_to: 3, previous_state_hash: hash2, next_state_hash: hash3, subjective_choice_commitment_receipts: buildWorldSimulationSubjectiveChoiceCommitmentReceipts({ world_simulation_session_id: SESSION, turn_id: "turn_3", state_revision: 2, world_state_hash: hash2, decision_packets: [packet], selected_action_intents: [{ character: CHARACTER, selection: "candidate_action_intent", action_id: "retreat" }] }) },
  ],
};
const adoptedProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: { ...history, turns: history.turns.slice(0, 1) },
  character: CHARACTER,
});
const maintainedProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: { ...history, turns: history.turns.slice(0, 2) },
  character: CHARACTER,
});
assert.equal(
  maintainedProjection.projection.current_commitment.commitment_ref,
  adoptedProjection.projection.current_commitment.commitment_ref,
);
const projection = projectWorldSimulationEffectiveActionCommitment({ world_history: history, character: CHARACTER });
assert.equal(projection.projection.lifecycle_decision_count, 3);
assert.deepEqual(projection.projection.lifecycle_decisions.map((item) => item.lifecycle_decision), ["adopt", "maintain", "replace"]);
assert.equal(projection.projection.latest_lifecycle_decision.replacement_action_id, "retreat");
assert.equal(projection.projection.current_commitment.action_id, "retreat");

assert.deepEqual(
  buildWorldSimulationActionCommitmentLifecycleDecision({ prior_active_commitment: prior, current_choice_receipt: maintain.source_receipt_id ? receipt("turn_2", 1, hash1, "candidate_action_intent", "hold") : null }),
  buildWorldSimulationActionCommitmentLifecycleDecision({ prior_active_commitment: prior, current_choice_receipt: receipt("turn_2", 1, hash1, "candidate_action_intent", "hold") }),
);

console.log("Phase75D action commitment lifecycle decision tests passed.");
