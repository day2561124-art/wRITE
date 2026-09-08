import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationEffectiveActionCommitmentProjectionContract,
  effectiveActionCommitmentEntrySchemaVersion,
  projectWorldSimulationEffectiveActionCommitment,
  worldSimulationEffectiveActionCommitmentProjectionVersion,
} from "../../server/src/world-simulation-effective-action-commitment-projection-service.mjs";

const CHARACTER = "千夜測試角色";
const SESSION = "agent_run_phase75a_test_session";
const cognition = {
  goals: ["保護同伴"],
  values: { loyalty: "high" },
  current_action: "守住入口",
  known: ["出口在東側"],
  uncertain: ["側門是否安全"],
  working_context: { focus: { content: "同伴仍在身後" } },
};
const candidates = [
  { action_id: "hold", intent: "守住入口", known_costs: ["撤退變慢"] },
  { action_id: "retreat", intent: "帶同伴撤退", known_costs: ["放棄入口"] },
];
const packet = { character: CHARACTER, cognition, candidate_action_intents: candidates };

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

function turn(turnId, revisionFrom, previousHash, nextHash, receipts = null) {
  return {
    turn_id: turnId,
    revision_from: revisionFrom,
    revision_to: revisionFrom + 1,
    previous_state_hash: previousHash,
    next_state_hash: nextHash,
    subjective_choice_commitment_receipts: receipts,
  };
}

const contract = buildWorldSimulationEffectiveActionCommitmentProjectionContract();
assert.equal(contract.phase, "Phase75A");
assert.equal(contract.version, worldSimulationEffectiveActionCommitmentProjectionVersion);
assert.equal(contract.projection_is_read_model, true);
assert.equal(contract.projection_is_rebuildable_from_history, true);
assert.equal(contract.projection_persistence_installed, false);
assert.equal(contract.explicit_later_choice_supersedes_prior_commitment, true);
assert.equal(contract.reject_all_explicitly_clears_prior_commitment, true);
assert.equal(contract.missing_receipt_does_not_clear_prior_commitment, true);
assert.equal(contract.selected_action_intent_is_not_world_outcome, true);
assert.equal(contract.temporal_commitment_persistence_modeled, true);
assert.equal(contract.character_brain_exposure_installed, false);
assert.equal(contract.execution_application_installed, false);
assert.equal(contract.world_state_mutation_allowed, false);

const hash0 = "a".repeat(64);
const hash1 = "b".repeat(64);
const hash2 = "c".repeat(64);
const hash3 = "d".repeat(64);
const hash4 = "e".repeat(64);
const holdBundle = bundle("turn_1", 0, hash0, "candidate_action_intent", "hold");
const retreatBundle = bundle("turn_3", 2, hash2, "candidate_action_intent", "retreat");
const rejectBundle = bundle("turn_4", 3, hash3, "reject_all", null);

const historyAfterHold = {
  world_simulation_session_id: SESSION,
  turns: [
    turn("turn_1", 0, hash0, hash1, holdBundle),
    turn("turn_2", 1, hash1, hash2, null),
  ],
};
const snapshot = JSON.stringify(historyAfterHold);
const holdProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: historyAfterHold,
  character: CHARACTER,
});
assert.equal(holdProjection.ok, true);
assert.equal(holdProjection.version, worldSimulationEffectiveActionCommitmentProjectionVersion);
assert.equal(holdProjection.projection.has_active_commitment, true);
assert.equal(holdProjection.projection.current_commitment.action_id, "hold");
assert.equal(holdProjection.projection.current_commitment.schema_version, effectiveActionCommitmentEntrySchemaVersion);
assert.equal(holdProjection.projection.current_commitment.source_turn_id, "turn_1");
assert.equal(holdProjection.projection.replayed_character_receipt_count, 1);
assert.equal(holdProjection.projection.verified_receipt_bundle_count, 1);
assert.equal(holdProjection.projection.superseded_active_commitment_count, 0);
assert.equal(holdProjection.projection.explicit_reject_all_cleared_commitment, false);
assert.equal(JSON.stringify(historyAfterHold), snapshot);
assert.equal(holdProjection.audit.missing_receipt_used_as_clear_signal, false);
assert.equal(holdProjection.audit.selected_intent_promoted_to_world_outcome, false);
assert.equal(holdProjection.audit.world_state_mutated, false);
assert.equal(holdProjection.audit.character_brain_exposure_applied, false);
assert.equal(holdProjection.audit.execution_application_applied, false);

const historyAfterRetreat = {
  world_simulation_session_id: SESSION,
  turns: [
    turn("turn_1", 0, hash0, hash1, holdBundle),
    turn("turn_2", 1, hash1, hash2, null),
    turn("turn_3", 2, hash2, hash3, retreatBundle),
  ],
};
const retreatProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: historyAfterRetreat,
  character: CHARACTER,
});
assert.equal(retreatProjection.projection.has_active_commitment, true);
assert.equal(retreatProjection.projection.current_commitment.action_id, "retreat");
assert.equal(retreatProjection.projection.current_commitment.source_turn_id, "turn_3");
assert.equal(retreatProjection.projection.latest_decision.action_id, "retreat");
assert.equal(retreatProjection.projection.replayed_character_receipt_count, 2);
assert.equal(retreatProjection.projection.superseded_active_commitment_count, 1);
assert.equal(retreatProjection.projection.verified_receipt_bundle_count, 2);
assert.notEqual(retreatProjection.projection.current_commitment.commitment_ref, holdProjection.projection.current_commitment.commitment_ref);

const historyAfterReject = {
  world_simulation_session_id: SESSION,
  turns: [
    ...historyAfterRetreat.turns,
    turn("turn_4", 3, hash3, hash4, rejectBundle),
  ],
};
const rejectProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: historyAfterReject,
  character: CHARACTER,
});
assert.equal(rejectProjection.projection.has_active_commitment, false);
assert.equal(rejectProjection.projection.current_commitment, null);
assert.equal(rejectProjection.projection.latest_decision.selection_kind, "reject_all");
assert.equal(rejectProjection.projection.latest_decision.commitment_status, "cleared_by_reject_all");
assert.equal(rejectProjection.projection.explicit_reject_all_cleared_commitment, true);
assert.equal(rejectProjection.projection.superseded_active_commitment_count, 2);

const otherCharacter = projectWorldSimulationEffectiveActionCommitment({
  world_history: historyAfterRetreat,
  character: "另一名角色",
});
assert.equal(otherCharacter.projection.has_active_commitment, false);
assert.equal(otherCharacter.projection.replayed_character_receipt_count, 0);
assert.equal(otherCharacter.projection.verified_receipt_bundle_count, 2);

const repeated = projectWorldSimulationEffectiveActionCommitment({
  world_history: historyAfterRetreat,
  character: CHARACTER,
});
assert.deepEqual(repeated, retreatProjection);

const brokenChain = JSON.parse(JSON.stringify(historyAfterRetreat));
brokenChain.turns[1].previous_state_hash = "f".repeat(64);
assert.throws(
  () => projectWorldSimulationEffectiveActionCommitment({ world_history: brokenChain, character: CHARACTER }),
  (error) => error?.code === "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_HISTORY_CHAIN_MISMATCH",
);

const tamperedReceipt = JSON.parse(JSON.stringify(historyAfterHold));
tamperedReceipt.turns[0].subjective_choice_commitment_receipts.receipts[0].action_id = "retreat";
assert.throws(
  () => projectWorldSimulationEffectiveActionCommitment({ world_history: tamperedReceipt, character: CHARACTER }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_CHOICE_COMMITMENT_HASH_MISMATCH",
);

assert.throws(
  () => projectWorldSimulationEffectiveActionCommitment({
    world_history: historyAfterHold,
    world_simulation_session_id: "wrong_session",
    character: CHARACTER,
  }),
  (error) => error?.code === "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_SESSION_MISMATCH",
);

for (const forbidden of ["success", "hit", "winner", "damage", "utility", "probability", "confidence"]) {
  assert.equal(Object.hasOwn(retreatProjection.projection.current_commitment, forbidden), false);
}

console.log("Phase75A effective action commitment projection tests passed.");
