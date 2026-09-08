import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  projectWorldSimulationEffectiveActionCommitment,
} from "../../server/src/world-simulation-effective-action-commitment-projection-service.mjs";
import {
  buildWorldSimulationEffectiveActionCommitmentCharacterExposure,
  buildWorldSimulationEffectiveActionCommitmentCharacterExposureContract,
  worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
} from "../../server/src/world-simulation-effective-action-commitment-character-exposure-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const CHARACTER = "千夜測試角色";
const SESSION = "agent_run_phase75b_test_session";
const cognition = {
  goals: ["保護同伴"],
  values: { loyalty: "high" },
  current_action: "正在觀察出口",
  known: ["出口在東側"],
  uncertain: ["側門是否安全"],
  working_context: { focus: { content: "同伴仍在身後" } },
};
const candidates = [
  { action_id: "hold", intent: "守住入口", known_costs: ["撤退變慢"] },
  { action_id: "retreat", intent: "帶同伴撤退", known_costs: ["放棄入口"] },
];
const packet = {
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
  boundaries: {},
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

const contract = buildWorldSimulationEffectiveActionCommitmentCharacterExposureContract();
assert.equal(contract.phase, "Phase75B");
assert.equal(contract.version, worldSimulationEffectiveActionCommitmentCharacterExposureVersion);
assert.equal(contract.same_character_only, true);
assert.equal(contract.current_action_separate_from_prior_committed_intention, true);
assert.equal(contract.active_prior_intention_may_ground_deliberation, true);
assert.equal(contract.commitment_is_defeasible_not_absolute, true);
assert.equal(contract.prior_commitment_does_not_auto_select_action, true);
assert.equal(contract.prior_commitment_does_not_auto_reject_alternatives, true);
assert.equal(contract.world_history_exposed, false);
assert.equal(contract.receipt_hash_exposed, false);
assert.equal(contract.world_state_mutation_allowed, false);

const hash0 = "a".repeat(64);
const hash1 = "b".repeat(64);
const holdBundle = bundle("turn_1", 0, hash0, "candidate_action_intent", "hold");
const history = {
  world_simulation_session_id: SESSION,
  turns: [turn("turn_1", 0, hash0, hash1, holdBundle)],
};
const projection = projectWorldSimulationEffectiveActionCommitment({
  world_history: history,
  character: CHARACTER,
});
const exposure = buildWorldSimulationEffectiveActionCommitmentCharacterExposure(projection);
assert.equal(exposure.version, worldSimulationEffectiveActionCommitmentCharacterExposureVersion);
assert.equal(exposure.character, CHARACTER);
assert.equal(exposure.status, "active_prior_committed_intention_available");
assert.equal(exposure.has_active_commitment, true);
assert.equal(exposure.active_commitment.action_id, "hold");
assert.equal(exposure.active_commitment.persistence_state, "active_prior_committed_intention");
assert.equal(exposure.active_commitment.defeasible, true);
assert.equal(exposure.active_commitment.action_attempted_or_completed, false);
assert.equal(exposure.active_commitment.outcome_known_from_commitment, false);
assert.equal(exposure.deliberation_boundary.commitment_is_context_not_command, true);
assert.equal(exposure.deliberation_boundary.reconsideration_allowed, true);
assert.equal(exposure.information_boundary.receipt_hash_exposed, false);
for (const forbidden of [
  "source_receipt_id",
  "source_receipt_hash",
  "source_turn_id",
  "source_revision_from",
  "source_revision_to",
  "deliberation_view_hash",
  "prospective_consequence_view_hash",
  "cross_option_preference_view_hash",
]) {
  assert.equal(Object.hasOwn(exposure.active_commitment, forbidden), false);
}

const brainInput = buildWorldSimulationCharacterBrainInput(packet, {
  effective_action_commitment_character_exposure: exposure,
});
assert.equal(
  brainInput.boundaries.effective_action_commitment_character_exposure_v1_installed,
  true,
);
assert.equal(brainInput.cognition.current_action, "正在觀察出口");
assert.equal(brainInput.cognition.effective_action_commitment.has_active_commitment, true);
assert.equal(brainInput.cognition.effective_action_commitment.active_commitment.action_id, "hold");
assert.notEqual(
  brainInput.cognition.current_action,
  brainInput.cognition.effective_action_commitment.active_commitment.action_id,
);
const commitmentGrounding = brainInput.subjective_action_deliberation.cognition_grounding_catalog
  .find((entry) => entry.grounding_kind === "effective_action_commitment");
assert.ok(commitmentGrounding);
assert.equal(commitmentGrounding.source_path, "cognition.effective_action_commitment");
assert.equal(commitmentGrounding.semantic_content_duplicated, false);
assert.equal(
  brainInput.subjective_cross_option_preference_resolution.deliberation_basis_catalog
    .refs_by_dimension.commitment.includes(commitmentGrounding.grounding_ref),
  true,
);

const rejectBundle = bundle("turn_2", 1, hash1, "reject_all", null);
const clearedProjection = projectWorldSimulationEffectiveActionCommitment({
  world_history: {
    world_simulation_session_id: SESSION,
    turns: [
      turn("turn_1", 0, hash0, hash1, holdBundle),
      turn("turn_2", 1, hash1, "c".repeat(64), rejectBundle),
    ],
  },
  character: CHARACTER,
});
const clearedExposure = buildWorldSimulationEffectiveActionCommitmentCharacterExposure(
  clearedProjection,
);
assert.equal(clearedExposure.has_active_commitment, false);
assert.equal(clearedExposure.active_commitment, null);
assert.equal(clearedExposure.explicit_reject_all_cleared_prior_commitment, true);

assert.throws(
  () => buildWorldSimulationEffectiveActionCommitmentCharacterExposure({
    ...projection,
    version: "forged",
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_SOURCE_INVALID",
);
assert.throws(
  () => buildWorldSimulationCharacterBrainInput(packet, {
    effective_action_commitment_character_exposure: {
      ...exposure,
      character: "另一名角色",
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EFFECTIVE_ACTION_COMMITMENT_CHARACTER_EXPOSURE_INVALID",
);

const serialized = JSON.stringify(brainInput.cognition.effective_action_commitment);
for (const forbidden of [hash0, hash1, "source_receipt_hash", "world_history", "revision_from"]) {
  assert.equal(serialized.includes(forbidden), false);
}

console.log("Phase75B bounded effective action commitment character exposure tests passed.");
