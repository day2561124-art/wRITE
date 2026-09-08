import assert from "node:assert/strict";

import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  buildWorldSimulationSubjectiveChoiceCommitmentReceiptContract,
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";

const CHARACTER = "千夜測試角色";
const cognition = {
  goals: ["保護同伴", "離開危險區域"],
  values: { loyalty: "high", caution: "important" },
  relationship_cognition: { 同伴甲: { relation: "trusted" } },
  decision_pressures: ["出口正在關閉"],
  current_action: "守住入口",
  emotion: { state: "緊張" },
  working_context: {
    focus: { content: "出口正在關閉" },
    active_context: [{ content: "同伴仍在身後" }],
  },
  known: ["出口在東側"],
  uncertain: ["敵人是否會從側門出現"],
};
const candidates = [
  {
    action_id: "retreat_with_ally",
    intent: "和同伴一起向東側出口撤退",
    prerequisites: ["同伴仍能移動"],
    known_costs: ["放棄目前防守位置"],
    blocked_by: ["出口已完全關閉"],
    movement: { direction: "east", distance_m: 4 },
  },
  {
    action_id: "hold_position",
    intent: "繼續守住入口",
    known_costs: ["撤退時間可能變少"],
    defense: { stance: "hold" },
  },
];
const packet = {
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
};
const baseInput = {
  world_simulation_session_id: "agent_run_phase74d_test_session",
  turn_id: "world_turn_phase74d_test",
  state_revision: 7,
  world_state_hash: "a".repeat(64),
  decision_packets: [packet],
};

const contract = buildWorldSimulationSubjectiveChoiceCommitmentReceiptContract();
assert.equal(contract.phase, "Phase74D");
assert.equal(contract.version, worldSimulationSubjectiveChoiceCommitmentReceiptVersion);
assert.equal(contract.character_brain_remains_final_choice_owner, true);
assert.equal(contract.prepared_turn_broker_remains_order_and_membership_authority, true);
assert.equal(contract.causal_simulator_remains_action_outcome_owner, true);
assert.equal(contract.receipt_records_intent_not_outcome, true);
assert.equal(contract.reject_all_receipt_supported, true);
assert.equal(contract.deterministic_receipt_identity, true);
assert.equal(contract.append_only_world_history_persistence, true);
assert.equal(contract.broker_persistence_changed, false);
assert.equal(contract.numeric_utility_probability_confidence_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.causal_outcome_authority_claimed, false);

const selected = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
  ...baseInput,
  selected_action_intents: [{
    character: CHARACTER,
    selection: "candidate_action_intent",
    action_id: "retreat_with_ally",
    intent: "和同伴一起向東側出口撤退",
    candidate: candidates[0],
  }],
});
assert.equal(selected.version, worldSimulationSubjectiveChoiceCommitmentReceiptVersion);
assert.equal(selected.receipt_count, 1);
assert.match(selected.receipt_bundle_hash, /^[a-f0-9]{64}$/);
assert.equal(selected.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit, true);
assert.equal(selected.persistence_boundary.blocked_or_failed_turn_persists_receipt, false);
assert.equal(selected.persistence_boundary.prepared_turn_broker_is_not_durable_store, true);

const receipt = selected.receipts[0];
assert.match(receipt.receipt_id, /^phase74d_choice_/);
assert.match(receipt.receipt_hash, /^[a-f0-9]{64}$/);
assert.equal(receipt.character, CHARACTER);
assert.equal(receipt.selection_kind, "candidate_action_intent");
assert.equal(receipt.action_id, "retreat_with_ally");
assert.match(receipt.action_ref, /^phase74a_action_/);
assert.match(receipt.prospect_ref, /^phase74b_prospect_/);
assert.match(receipt.option_ref, /^phase74c_option_/);
assert.match(receipt.deliberation_view_hash, /^[a-f0-9]{64}$/);
assert.match(receipt.prospective_consequence_view_hash, /^[a-f0-9]{64}$/);
assert.match(receipt.cross_option_preference_view_hash, /^[a-f0-9]{64}$/);
assert.equal(receipt.receipt_records_intent_not_outcome, true);
assert.equal(receipt.selection_was_membership_validated_upstream, true);
assert.equal(receipt.world_truth_authority, false);
assert.equal(receipt.causal_outcome_authority, false);
assert.equal(receipt.semantic_candidate_content_duplicated, false);
assert.equal(receipt.numeric_score_recorded, false);
for (const forbidden of ["success", "hit", "winner", "damage", "probability", "utility"]) {
  assert.equal(Object.hasOwn(receipt, forbidden), false);
}

const repeated = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
  ...baseInput,
  selected_action_intents: [{
    character: CHARACTER,
    selection: "candidate_action_intent",
    action_id: "retreat_with_ally",
    intent: "和同伴一起向東側出口撤退",
    candidate: candidates[0],
  }],
});
assert.deepEqual(repeated, selected);
assert.deepEqual(
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(selected, {
    world_simulation_session_id: baseInput.world_simulation_session_id,
    turn_id: baseInput.turn_id,
    state_revision: baseInput.state_revision,
    world_state_hash: baseInput.world_state_hash,
  }),
  selected,
);
const tampered = JSON.parse(JSON.stringify(selected));
tampered.receipts[0].action_id = "hold_position";
assert.throws(
  () => assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(tampered),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_HASH_MISMATCH",
);
assert.throws(
  () => assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(selected, {
    turn_id: "different_turn",
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_LINEAGE_MISMATCH",
);

const rejected = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
  ...baseInput,
  selected_action_intents: [{
    character: CHARACTER,
    selection: "reject_all",
    action_id: null,
    intent: null,
    candidate: null,
  }],
});
assert.equal(rejected.receipts[0].selection_kind, "reject_all");
assert.equal(rejected.receipts[0].action_id, null);
assert.equal(rejected.receipts[0].action_ref, null);
assert.equal(rejected.receipts[0].prospect_ref, null);
assert.equal(rejected.receipts[0].option_ref, null);
assert.notEqual(rejected.receipts[0].receipt_hash, receipt.receipt_hash);

assert.throws(
  () => buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    ...baseInput,
    selected_action_intents: [{
      character: CHARACTER,
      selection: "candidate_action_intent",
      action_id: "not_available",
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_LINEAGE_INVALID",
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.subjective_choice_commitment_receipt.version,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
);
assert.equal(
  loopContract.subjective_choice_commitment_receipt.append_only_world_history_persistence,
  true,
);
assert.equal(
  loopContract.subjective_choice_commitment_receipt.causal_simulator_remains_action_outcome_owner,
  true,
);

console.log("Phase74D durable character decision commitment receipt tests passed.");
