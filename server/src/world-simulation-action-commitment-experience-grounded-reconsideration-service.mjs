import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationActionCommitmentReconsiderationEvidenceVersion,
} from "./world-simulation-action-commitment-reconsideration-evidence-service.mjs";

export const worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion =
  "phase75g-action-commitment-experience-grounded-reconsideration-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function evidence(character, kind, sourceRefs) {
  const refs = [...new Set(array(sourceRefs).map(text).filter(Boolean))].sort();
  const body = {
    version: worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion,
    character,
    evidence_kind: kind,
    source_refs: refs,
  };
  return {
    evidence_ref: `phase75g_evidence_${hashAgentRunValue(body).slice(0, 24)}`,
    evidence_kind: kind,
    source_refs: refs,
    subjective_experience_only: true,
    qualitative_only: true,
    does_not_decide_reconsideration: true,
  };
}

export function buildWorldSimulationActionCommitmentExperienceGroundedReconsiderationContract() {
  return Object.freeze({
    version: worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion,
    phase: "Phase75G",
    status: "subjective_execution_experience_grounded_reconsideration_installed",
    base_reconsideration_source_version:
      worldSimulationActionCommitmentReconsiderationEvidenceVersion,
    subjective_execution_feedback_only: true,
    authoritative_outcome_without_subjective_experience_exposed: false,
    perceived_result_interpreted_as_objective_success_or_failure: false,
    plan_execution_state_machine_duplicated: false,
    phase69d_plan_execution_authority_preserved: true,
    plan_completion_inferred: false,
    goal_achievement_inferred: false,
    automatic_commitment_revoke: false,
    automatic_replacement_action_selection: false,
    character_brain_remains_reconsideration_owner: true,
    causal_outcome_authority_claimed: false,
    world_truth_authority_claimed: false,
    world_state_mutation_allowed: false,
  });
}

export function buildWorldSimulationActionCommitmentExperienceGroundedReconsideration(input = {}) {
  const character = text(input.character);
  if (!character) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_INPUT_INVALID",
      "character is required.",
    );
  }

  const base = input.base_reconsideration_evidence;
  if (!isObject(base)
      || base.version !== worldSimulationActionCommitmentReconsiderationEvidenceVersion
      || base.character !== character) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_BASE_INVALID",
      "Phase75G requires same-character canonical Phase75C reconsideration evidence.",
    );
  }

  const experience = isObject(input.subjective_execution_experience)
    ? cloneJson(input.subjective_execution_experience)
    : {};
  const baseCommitmentRef = text(base.active_commitment_ref);
  const baseActionId = text(base.committed_action_id);
  const experienceCommitmentRef = text(experience.active_commitment_ref);
  const experienceActionId = text(experience.action_id);
  if ((baseCommitmentRef && experienceCommitmentRef
        && baseCommitmentRef !== experienceCommitmentRef)
      || (baseActionId && experienceActionId
        && baseActionId !== experienceActionId)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_LINEAGE_MISMATCH",
      "Phase75G subjective execution experience does not match the active commitment action lineage.",
    );
  }

  if (base.status === "no_active_commitment_to_reconsider") {
    return Object.freeze(cloneJson({
      version: worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion,
      character,
      status: "no_active_commitment_to_reconsider",
      active_commitment_ref: null,
      committed_action_id: null,
      base_reconsideration_evidence_count: 0,
      subjective_execution_evidence: [],
      subjective_execution_evidence_count: 0,
      reconsideration_boundary: {
        character_brain_owns_reconsideration_decision: true,
        automatic_revoke: false,
        automatic_replacement_selection: false,
      },
    }));
  }

  if (!baseCommitmentRef || !text(base.committed_action_id)) {
    fail(
      "WORLD_SIMULATION_ACTION_COMMITMENT_EXPERIENCE_RECONSIDERATION_BASE_INVALID",
      "Phase75G active reconsideration evidence requires commitment and action lineage.",
    );
  }

  const feedback = array(experience.subjective_feedback);
  const subjectiveEvidence = [];
  if (feedback.length > 0) {
    const refs = feedback.map((item) => item?.subjective_feedback_ref).filter(Boolean);
    subjectiveEvidence.push(evidence(
      character,
      "subjective_execution_feedback_available",
      refs,
    ));
  }

  const latest = isObject(experience.latest_subjective_feedback)
    ? experience.latest_subjective_feedback
    : null;
  if (latest) {
    const latestRef = text(latest.subjective_feedback_ref);
    if (latest.performed === true) {
      subjectiveEvidence.push(evidence(
        character,
        "subjectively_performed_committed_action",
        [latestRef],
      ));
    } else if (latest.performed === false) {
      subjectiveEvidence.push(evidence(
        character,
        "subjectively_did_not_perform_committed_action",
        [latestRef],
      ));
    }
    if (text(latest.perceived_result)) {
      subjectiveEvidence.push(evidence(
        character,
        "subjective_execution_result_available",
        [latestRef],
      ));
    }
  }

  const result = {
    version: worldSimulationActionCommitmentExperienceGroundedReconsiderationVersion,
    character,
    status: subjectiveEvidence.length
      ? "experience_grounded_reconsideration_evidence_available"
      : "no_subjective_execution_evidence_for_reconsideration",
    active_commitment_ref: baseCommitmentRef,
    committed_action_id: base.committed_action_id,
    base_reconsideration_evidence_count: Number(base.evidence_count ?? 0),
    subjective_execution_evidence: subjectiveEvidence,
    subjective_execution_evidence_count: subjectiveEvidence.length,
    reconsideration_boundary: {
      subjective_feedback_is_reason_to_review_not_instruction_to_drop: true,
      perceived_result_not_interpreted_as_objective_success_or_failure: true,
      action_performed_does_not_imply_plan_completion: true,
      action_performed_does_not_imply_goal_achievement: true,
      phase69d_plan_execution_state_machine_preserved: true,
      character_brain_owns_reconsideration_decision: true,
      character_brain_owns_final_action_choice: true,
      automatic_revoke: false,
      automatic_replacement_selection: false,
    },
    information_boundary: {
      subjective_experience_only: true,
      authoritative_outcome_without_subjective_experience_exposed: false,
      raw_world_state_exposed: false,
      causal_evidence_exposed: false,
      world_result_label_exposed: false,
      world_truth_authority_claimed: false,
      causal_outcome_authority_claimed: false,
    },
  };
  result.experience_grounded_reconsideration_hash = hashAgentRunValue(result);
  return Object.freeze(cloneJson(result));
}
