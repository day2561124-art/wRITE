import assert from "node:assert/strict";

import {
  worldSimulationActionCommitmentReconsiderationEvidenceVersion,
} from "../../server/src/world-simulation-action-commitment-reconsideration-evidence-service.mjs";
import {
  buildWorldSimulationActionCommitmentExperienceGroundedReconsideration,
  buildWorldSimulationActionCommitmentExperienceGroundedReconsiderationContract,
  worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion,
} from "../../server/src/world-simulation-action-commitment-experience-grounded-reconsideration-service.mjs";

const character = "伊萊亞斯・諾爾";
const commitmentRef = "phase75a_commitment_ref_001";
const actionId = "phase75g-action-001";
const base = {
  version: worldSimulationActionCommitmentReconsiderationEvidenceVersion,
  character,
  status: "reconsideration_evidence_available",
  active_commitment_ref: commitmentRef,
  committed_action_id: actionId,
  evidence: [{
    evidence_ref: "phase75c_existing_evidence",
    evidence_kind: "committed_action_still_candidate",
    source_refs: [commitmentRef],
  }],
  evidence_count: 1,
};
const subjective = {
  status: "subjective_execution_feedback_available",
  active_commitment_ref: commitmentRef,
  action_id: actionId,
  subjective_feedback_count: 1,
  subjective_feedback: [{
    subjective_feedback_ref: "phase75f_subjective_feedback_001",
    performed: true,
    perceived_result: "感覺攻擊被擋住",
  }],
  latest_subjective_feedback: {
    subjective_feedback_ref: "phase75f_subjective_feedback_001",
    performed: true,
    perceived_result: "感覺攻擊被擋住",
  },
};

const contract = buildWorldSimulationActionCommitmentExperienceGroundedReconsiderationContract();
assert.equal(contract.phase, "Phase75G");
assert.equal(contract.plan_execution_state_machine_duplicated, false);
assert.equal(contract.phase69d_plan_execution_authority_preserved, true);
assert.equal(contract.goal_achievement_inferred, false);
assert.equal(contract.automatic_commitment_revoke, false);

const result = buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
  character,
  base_reconsideration_evidence: base,
  subjective_execution_experience: subjective,
});
assert.equal(result.version, worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion);
assert.equal(result.status, "experience_grounded_reconsideration_evidence_available");
assert.equal(result.base_reconsideration_evidence_count, 1);
assert.equal(result.subjective_execution_evidence_count, 3);
assert.deepEqual(
  result.subjective_execution_evidence.map((item) => item.evidence_kind),
  [
    "subjective_execution_feedback_available",
    "subjectively_performed_committed_action",
    "subjective_execution_result_available",
  ],
);
assert.equal(result.reconsideration_boundary.perceived_result_not_interpreted_as_objective_success_or_failure, true);
assert.equal(result.reconsideration_boundary.action_performed_does_not_imply_plan_completion, true);
assert.equal(result.reconsideration_boundary.action_performed_does_not_imply_goal_achievement, true);
assert.equal(JSON.stringify(result).includes("感覺攻擊被擋住"), false);

const noFeedback = buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
  character,
  base_reconsideration_evidence: base,
  subjective_execution_experience: {
    status: "no_subjective_execution_feedback",
    active_commitment_ref: commitmentRef,
    action_id: actionId,
    subjective_feedback: [],
    latest_subjective_feedback: null,
  },
});
assert.equal(noFeedback.status, "no_subjective_execution_evidence_for_reconsideration");
assert.equal(noFeedback.subjective_execution_evidence_count, 0);

const perceivedNotPerformed = buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
  character,
  base_reconsideration_evidence: base,
  subjective_execution_experience: {
    status: "subjective_execution_feedback_available",
    active_commitment_ref: commitmentRef,
    action_id: actionId,
    subjective_feedback: [{
      subjective_feedback_ref: "phase75f_subjective_feedback_002",
      performed: false,
      perceived_result: null,
    }],
    latest_subjective_feedback: {
      subjective_feedback_ref: "phase75f_subjective_feedback_002",
      performed: false,
      perceived_result: null,
    },
  },
});
assert.equal(
  perceivedNotPerformed.subjective_execution_evidence.some(
    (item) => item.evidence_kind === "subjectively_did_not_perform_committed_action",
  ),
  true,
);

assert.throws(
  () => buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
    character,
    base_reconsideration_evidence: base,
    subjective_execution_experience: {
      active_commitment_ref: "different_commitment_ref",
      subjective_feedback: [],
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_LINEAGE_MISMATCH",
);
assert.throws(
  () => buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
    character,
    base_reconsideration_evidence: base,
    subjective_execution_experience: {
      active_commitment_ref: commitmentRef,
      action_id: "different-action",
      subjective_feedback: [],
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_LINEAGE_MISMATCH",
);

const noActive = buildWorldSimulationActionCommitmentExperienceGroundedReconsideration({
  character,
  base_reconsideration_evidence: {
    version: worldSimulationActionCommitmentReconsiderationEvidenceVersion,
    character,
    status: "no_active_commitment_to_reconsider",
    active_commitment_ref: null,
    evidence: [],
    evidence_count: 0,
  },
  subjective_execution_experience: {},
});
assert.equal(noActive.status, "no_active_commitment_to_reconsider");
assert.equal(noActive.subjective_execution_evidence_count, 0);

console.log("Phase75G experience-grounded commitment reconsideration tests passed.");
