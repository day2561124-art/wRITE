import assert from "node:assert/strict";

import {
  buildWorldSimulationActionCommitmentReconsiderationEvidence,
  buildWorldSimulationActionCommitmentReconsiderationEvidenceContract,
  worldSimulationActionCommitmentReconsiderationEvidenceVersion,
} from "../../server/src/world-simulation-action-commitment-reconsideration-evidence-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { worldSimulationEffectiveActionCommitmentCharacterExposureVersion } from "../../server/src/world-simulation-effective-action-commitment-character-exposure-service.mjs";

const character = "千夜測試角色";
const cognition = {
  goals: ["保護同伴"],
  values: { loyalty: "important" },
  known: ["出口在東側"],
  uncertain: ["側門是否有敵人"],
  decision_pressures: ["出口正在關閉"],
  current_action: "守住入口",
  emotion: { state: "緊張" },
  working_context: { focus: { content: "同伴仍在身後" }, active_context: [] },
};
const candidates = [
  {
    action_id: "hold_position",
    intent: "繼續守住入口",
    known_costs: ["撤退時間會縮短"],
    blocked_by: ["入口已失守"],
    defense: { stance: "hold" },
  },
  {
    action_id: "retreat_with_ally",
    intent: "與同伴一起撤退",
    known_costs: ["放棄目前位置"],
    movement: { direction: "east" },
  },
];

const contract = buildWorldSimulationActionCommitmentReconsiderationEvidenceContract();
assert.equal(contract.phase, "Phase75C");
assert.equal(contract.version, worldSimulationActionCommitmentReconsiderationEvidenceVersion);
assert.equal(contract.current_candidate_membership_checked, true);
assert.equal(contract.historical_belief_change_inferred, false);
assert.equal(contract.automatic_reconsideration_decision, false);
assert.equal(contract.automatic_commitment_revoke, false);
assert.equal(contract.numeric_reconsideration_score, false);
assert.equal(contract.character_brain_remains_reconsideration_and_choice_owner, true);

function exposure(actionId = "hold_position") {
  return {
    version: worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
    character,
    status: "active_prior_committed_intention_available",
    active_commitment: {
      commitment_ref: "phase75a_commitment_test",
      selection_kind: "candidate_action_intent",
      action_id: actionId,
      action_ref: "phase74a_action_test",
      prospect_ref: "phase74b_prospect_test",
      option_ref: "phase74c_option_test",
      persistence_state: "active_prior_committed_intention",
      defeasible: true,
      action_attempted_or_completed: false,
      outcome_known_from_commitment: false,
    },
    has_active_commitment: true,
    explicit_reject_all_cleared_prior_commitment: false,
    deliberation_boundary: {
      commitment_is_context_not_command: true,
      commitment_may_constrain_but_not_determine_choice: true,
      reconsideration_allowed: true,
    },
  };
}

const packet = {
  character,
  perception: { observed: [], audible: [], other_senses: [] },
  cognition,
  candidate_action_intents: candidates,
  boundaries: {},
};
const brain = buildWorldSimulationCharacterBrainInput(packet, {
  effective_action_commitment_character_exposure: exposure(),
});
assert.equal(brain.boundaries.action_commitment_reconsideration_evidence_v1_installed, true);
const evidence = brain.action_commitment_reconsideration_evidence;
assert.equal(evidence.version, worldSimulationActionCommitmentReconsiderationEvidenceVersion);
assert.equal(evidence.status, "reconsideration_evidence_available");
assert.equal(evidence.committed_action_id, "hold_position");
const kinds = new Set(evidence.evidence.map((item) => item.evidence_kind));
for (const expected of [
  "committed_action_still_candidate",
  "blocking_contingency_present",
  "known_cost_or_resource_exposure_present",
  "epistemic_uncertainty_present",
  "alternative_options_available",
  "current_deliberative_context_available",
]) assert.equal(kinds.has(expected), true, `missing evidence kind ${expected}`);
for (const item of evidence.evidence) {
  assert.match(item.evidence_ref, /^phase75c_evidence_/);
  assert.equal(item.qualitative_only, true);
  assert.equal(item.does_not_decide_reconsideration, true);
}
assert.equal(evidence.reconsideration_boundary.blocker_branch_is_not_objective_failure, true);
assert.equal(evidence.reconsideration_boundary.historical_belief_change_not_inferred_without_snapshot, true);
assert.equal(evidence.reconsideration_boundary.character_brain_owns_reconsideration_decision, true);
assert.equal(evidence.reconsideration_boundary.automatic_revoke, false);
assert.equal(evidence.reconsideration_boundary.automatic_replacement_selection, false);
assert.equal(evidence.reconsideration_boundary.numeric_reconsideration_score_computed, false);
assert.equal(Object.hasOwn(evidence, "selected_action_id"), false);
assert.equal(Object.hasOwn(evidence, "replacement_action_id"), false);
assert.equal(Object.hasOwn(evidence, "revoke_commitment"), false);
assert.equal(Object.hasOwn(evidence, "reconsideration_score"), false);

const missingCandidateBrain = buildWorldSimulationCharacterBrainInput(packet, {
  effective_action_commitment_character_exposure: exposure("old_action_no_longer_available"),
});
assert.equal(
  missingCandidateBrain.action_commitment_reconsideration_evidence.evidence.some(
    (item) => item.evidence_kind === "committed_action_not_in_current_candidate_set",
  ),
  true,
);

const noActiveExposure = {
  ...exposure(),
  status: "no_active_prior_committed_intention",
  active_commitment: null,
  has_active_commitment: false,
};
const noActiveBrain = buildWorldSimulationCharacterBrainInput(packet, {
  effective_action_commitment_character_exposure: noActiveExposure,
});
assert.equal(noActiveBrain.action_commitment_reconsideration_evidence.status, "no_active_commitment_to_reconsider");
assert.equal(noActiveBrain.action_commitment_reconsideration_evidence.evidence_count, 0);

const forged = JSON.parse(JSON.stringify(brain.subjective_prospective_consequence_simulation));
forged.source_deliberation_view_hash = "forged";
assert.throws(
  () => buildWorldSimulationActionCommitmentReconsiderationEvidence({
    character,
    cognition: brain.cognition,
    subjective_action_deliberation: brain.subjective_action_deliberation,
    subjective_prospective_consequence_simulation: forged,
    subjective_cross_option_preference_resolution: brain.subjective_cross_option_preference_resolution,
  }),
  (error) => error?.code === "WORLD_SIMULATION_ACTION_COMMITMENT_RECONSIDERATION_PHASE74B_INVALID",
);

console.log("Phase75C action commitment reconsideration evidence tests passed.");
