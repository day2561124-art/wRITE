import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-case-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion =
  "phase82h-counterfactual-linked-experience-longitudinal-case-selected-action-subjective-outcome-evidence-v1";

const maximumEvidenceRecordCount = 64;
const allowedExperienceFields = new Set([
  "action_id",
  "performed",
  "perceived_result",
  "perceived_status",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_INPUT_INVALID",
      `Phase82H ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function sameCharacter(left, right) {
  const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  return Boolean(normalize(left)) && normalize(left) === normalize(right);
}
function boundedScalar(value) {
  if (value === null || value === undefined) return true;
  if (!["string", "number", "boolean"].includes(typeof value)) return false;
  if (typeof value === "string" && value.length > 600) return false;
  if (typeof value === "number" && !Number.isFinite(value)) return false;
  return true;
}
function verifyExperience(experience, actionId) {
  if (!isObject(experience)
      || text(experience.action_id) !== actionId
      || Object.keys(experience).some((key) => !allowedExperienceFields.has(key))
      || Object.values(experience).some((value) => !boundedScalar(value))) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
      "Phase82H requires the exact bounded scalar Phase76A subjective experience for the selected action.",
    );
  }
  return cloneJson(experience);
}
function verifyPhase76A(value, expectedTurnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
      || projection.phase !== "Phase76A"
      || projection.turn_id !== expectedTurnId
      || !Array.isArray(projection.character_experiences)
      || !isObject(projection.boundaries)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_INVALID",
      "Phase82H requires an exact canonical Phase76A subjective post-outcome projection for this turn.",
    );
  }
  const boundaries = projection.boundaries;
  if (boundaries.objective_world_outcome_remains_causal_authority !== true
      || boundaries.projection_is_subjective_observation_not_world_truth !== true
      || boundaries.selected_action_is_not_success_claim !== true
      || boundaries.action_outcome_presence_is_not_success_claim !== true
      || boundaries.result_label_auto_exposure !== false
      || boundaries.causal_evidence_auto_exposure !== false
      || boundaries.world_state_mutation_applied !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_BOUNDARY_INVALID",
      "Phase82H rejects Phase76A evidence that violates the sealed subjective-observation boundary.",
    );
  }
  const seenRefs = new Set();
  const seenPairs = new Set();
  for (const experience of projection.character_experiences) {
    if (!isObject(experience)
        || experience.version !== worldSimulationPostOutcomeSubjectivePerceptionVersion
        || experience.turn_id !== expectedTurnId
        || !text(experience.character)
        || !text(experience.action_id)
        || !text(experience.subjective_perception_ref)
        || !Array.isArray(experience.source_outcome_hashes)
        || !Array.isArray(experience.source_transition_hashes)
        || experience.source_outcome_count !== experience.source_outcome_hashes.length
        || experience.source_transition_count !== experience.source_transition_hashes.length
        || experience.source_outcome_hashes.some((hash) => !text(hash))
        || experience.source_transition_hashes.some((hash) => !text(hash))
        || experience.objective_result_label_exposed !== false
        || experience.causal_evidence_exposed !== false
        || experience.exact_engine_geometry_exposed !== false
        || experience.other_character_private_state_exposed !== false
        || experience.raw_result_interpreted_as_perceived_success_or_failure !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
        "Phase82H found an invalid Phase76A subjective experience record.",
      );
    }
    verifyExperience(experience.experience, experience.action_id);
    const identity = {
      version: experience.version,
      turn_id: experience.turn_id,
      character: experience.character,
      action_id: experience.action_id,
      experience: cloneJson(experience.experience),
      source_outcome_hashes: cloneJson(experience.source_outcome_hashes),
      source_transition_hashes: cloneJson(experience.source_transition_hashes),
    };
    const expectedRef = `phase76a_post_outcome_${hashAgentRunValue(identity).slice(0, 24)}`;
    const pair = `${String(experience.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${experience.action_id}`;
    if (experience.subjective_perception_ref !== expectedRef
        || seenRefs.has(experience.subjective_perception_ref)
        || seenPairs.has(pair)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_HASH_MISMATCH",
        "Phase82H Phase76A subjective experience identity or uniqueness verification failed.",
      );
    }
    seenRefs.add(experience.subjective_perception_ref);
    seenPairs.add(pair);
  }
  return Object.freeze(projection);
}

function exactPhase82GSources(expected, projection) {
  const sourceFields = [
    expected.subjective_choice_commitment_receipts,
    expected.counterfactual_linked_experience_longitudinal_case_reentry,
    expected.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
    expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    expected.world_history,
  ];
  const suppliedCount = sourceFields.filter((value) => value !== undefined).length;
  if (suppliedCount === 0) return {};
  if (suppliedCount !== sourceFields.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_EXPECTED_SOURCE_SET_INCOMPLETE",
      "Phase82H exact Phase82G validation requires Phase74D, Phase82E, Phase82F, current Phase81N, and canonical prior World History together.",
    );
  }
  return {
    subjective_choice_commitment_receipts: expected.subjective_choice_commitment_receipts,
    counterfactual_linked_experience_longitudinal_case_reentry:
      expected.counterfactual_linked_experience_longitudinal_case_reentry,
    counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:
      expected.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
    counterfactual_linked_experience_reuse_outcome_reentry_projections:
      expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    world_history: expected.world_history,
    world_simulation_session_id: projection.world_simulation_session_id,
    turn_id: projection.turn_id,
    state_revision: projection.state_revision,
    world_state_hash: projection.world_state_hash,
  };
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion,
    phase: "Phase82H",
    status: "longitudinal_case_selected_action_subjective_outcome_evidence_installed",
    source_selected_action_lineage_owner: "Phase82G",
    source_subjective_outcome_owner: "Phase76A",
    exact_phase82g_receipt_bundle_hash_required: true,
    exact_phase82e_phase82f_phase74d_phase81n_world_history_revalidation_required: true,
    exact_phase76a_projection_hash_required: true,
    same_character_same_action_id_required: true,
    only_bounded_current_selected_action_subjective_outcome_observed: true,
    retained_longitudinal_case_is_current_world_truth: false,
    retained_admission_is_effectiveness_claim: false,
    retained_admission_is_success_claim: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    longitudinal_case_activation_caused_selection_claimed: false,
    longitudinal_case_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_evidence_record_count: maximumEvidenceRecordCount,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion
      || projection.phase !== "Phase82H"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase82g_receipt_bundle_hash)
      || !text(projection.source_phase76a_projection_hash)
      || !Array.isArray(projection.evidence_records)
      || projection.evidence_count !== projection.evidence_records.length
      || projection.evidence_count > maximumEvidenceRecordCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_INVALID",
      "Phase82H longitudinal-case selected-action subjective outcome evidence is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        `Phase82H projection ${key} does not match expected lineage.`,
      );
    }
  }

  let phase82g = null;
  if (expected.counterfactual_linked_experience_longitudinal_case_selected_action_lineage !== undefined) {
    phase82g =
      assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
        expected.counterfactual_linked_experience_longitudinal_case_selected_action_lineage,
        exactPhase82GSources(expected, projection),
      );
    if (phase82g.version
          !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion
        || phase82g.receipt_bundle_hash !== projection.source_phase82g_receipt_bundle_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase82H no longer matches the exact canonical Phase82G selected-action lineage bundle.",
      );
    }
  }

  let phase76a = null;
  if (expected.post_outcome_subjective_perception_projection !== undefined) {
    phase76a = verifyPhase76A(
      expected.post_outcome_subjective_perception_projection,
      projection.turn_id,
    );
    if (phase76a.projection_hash !== projection.source_phase76a_projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase82H no longer matches the exact Phase76A subjective outcome projection.",
      );
    }
  }

  const lineageById = phase82g
    ? new Map(phase82g.receipts.map((receipt) => [receipt.receipt_id, receipt]))
    : null;
  const perceptionByRef = phase76a
    ? new Map(phase76a.character_experiences
      .map((experience) => [experience.subjective_perception_ref, experience]))
    : null;
  const seenRefs = new Set();
  const seenPairs = new Set();
  for (const record of projection.evidence_records) {
    if (!isObject(record)
        || record.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion
        || record.world_simulation_session_id !== projection.world_simulation_session_id
        || record.turn_id !== projection.turn_id
        || record.state_revision !== projection.state_revision
        || record.world_state_hash !== projection.world_state_hash
        || !text(record.character)
        || !text(record.phase82g_receipt_id)
        || !text(record.phase82g_receipt_hash)
        || !text(record.phase82f_projection_hash)
        || !text(record.source_phase82e_projection_hash)
        || !text(record.deliberative_reuse_intent_ref)
        || !text(record.deliberative_reuse_intent_hash)
        || !text(record.source_reentry_candidate_ref)
        || !text(record.source_reentry_candidate_hash)
        || !text(record.source_phase82d_admission_ref)
        || !text(record.source_phase82d_admission_hash)
        || !text(record.current_phase81n_projection_hash)
        || !text(record.phase74d_choice_receipt_id)
        || !text(record.phase74d_choice_receipt_hash)
        || !text(record.action_id)
        || !text(record.action_ref)
        || record.selection_relation
          !== "selected_action_matches_longitudinal_case_deliberative_reuse_intent"
        || !text(record.phase76a_subjective_perception_ref)
        || record.subjective_outcome_basis !== "bounded_phase76a_selected_action_experience"
        || !isObject(record.selected_action_subjective_experience)
        || record.selected_action_subjective_outcome_observed !== true
        || record.retained_longitudinal_case_is_current_world_truth !== false
        || record.retained_admission_is_effectiveness_claim !== false
        || record.retained_admission_is_success_claim !== false
        || record.historical_counterfactual_truth_evaluated !== false
        || record.historical_counterfactual_validated_by_current_outcome !== false
        || record.longitudinal_case_activation_caused_selection_claimed !== false
        || record.longitudinal_case_effectiveness_inferred !== false
        || record.success_failure_interpretation_performed !== false
        || record.causal_or_outcome_credit_assigned !== false
        || record.preference_revision_performed !== false
        || record.belief_revision_performed !== false
        || record.semantic_revision_performed !== false
        || record.subjective_memory_rewrite_performed !== false
        || record.world_state_mutated !== false
        || record.world_truth_authority !== false
        || !text(record.evidence_ref)
        || !text(record.evidence_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_RECORD_INVALID",
        "Phase82H contains an invalid or over-authoritative subjective outcome evidence record.",
      );
    }
    verifyExperience(record.selected_action_subjective_experience, record.action_id);
    if (lineageById && perceptionByRef) {
      const lineage = lineageById.get(record.phase82g_receipt_id);
      const perception = perceptionByRef.get(record.phase76a_subjective_perception_ref);
      if (!lineage
          || !perception
          || lineage.receipt_hash !== record.phase82g_receipt_hash
          || lineage.phase82f_projection_hash !== record.phase82f_projection_hash
          || lineage.source_phase82e_projection_hash !== record.source_phase82e_projection_hash
          || lineage.deliberative_reuse_intent_ref !== record.deliberative_reuse_intent_ref
          || lineage.deliberative_reuse_intent_hash !== record.deliberative_reuse_intent_hash
          || lineage.source_reentry_candidate_ref !== record.source_reentry_candidate_ref
          || lineage.source_reentry_candidate_hash !== record.source_reentry_candidate_hash
          || lineage.source_phase82d_admission_ref !== record.source_phase82d_admission_ref
          || lineage.source_phase82d_admission_hash !== record.source_phase82d_admission_hash
          || lineage.current_phase81n_projection_hash !== record.current_phase81n_projection_hash
          || lineage.phase74d_choice_receipt_id !== record.phase74d_choice_receipt_id
          || lineage.phase74d_choice_receipt_hash !== record.phase74d_choice_receipt_hash
          || lineage.action_id !== record.action_id
          || lineage.action_ref !== record.action_ref
          || lineage.selection_relation !== record.selection_relation
          || !sameCharacter(lineage.character, record.character)
          || !sameCharacter(perception.character, record.character)
          || perception.action_id !== record.action_id
          || hashAgentRunValue(perception.experience)
            !== hashAgentRunValue(record.selected_action_subjective_experience)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
          "Phase82H evidence no longer matches its exact Phase82G selected-action lineage and Phase76A subjective outcome.",
        );
      }
    }
    const identity = cloneJson(record);
    for (const key of [
      "evidence_ref", "evidence_hash", "selected_action_subjective_outcome_observed",
      "retained_longitudinal_case_is_current_world_truth", "retained_admission_is_effectiveness_claim",
      "retained_admission_is_success_claim", "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_current_outcome",
      "longitudinal_case_activation_caused_selection_claimed", "longitudinal_case_effectiveness_inferred",
      "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
      "preference_revision_performed", "belief_revision_performed", "semantic_revision_performed",
      "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    const pairKey = `${record.phase82g_receipt_id}\n${record.phase76a_subjective_perception_ref}`;
    if (record.evidence_hash !== expectedHash
        || record.evidence_ref !== `phase82h_outcome_evidence_${expectedHash.slice(0, 24)}`
        || seenRefs.has(record.evidence_ref)
        || seenPairs.has(pairKey)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_RECORD_HASH_MISMATCH",
        "Phase82H subjective outcome evidence identity verification failed.",
      );
    }
    seenRefs.add(record.evidence_ref);
    seenPairs.add(pairKey);
  }

  if (projection.audit.exact_phase82g_selected_action_lineage_verified !== true
      || projection.audit.exact_phase82e_phase82f_phase74d_phase81n_world_history_revalidated !== true
      || projection.audit.exact_phase76a_subjective_outcome_verified !== true
      || projection.audit.same_character_same_selected_action_join_required !== true
      || projection.audit.retained_longitudinal_case_is_current_world_truth !== false
      || projection.audit.retained_admission_interpreted_as_effectiveness !== false
      || projection.audit.retained_admission_interpreted_as_success !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.historical_counterfactual_validated_by_current_outcome !== false
      || projection.audit.longitudinal_case_activation_caused_selection_claimed !== false
      || projection.audit.longitudinal_case_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.same_turn_character_brain_feedback !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_evidence !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_BOUNDARY_INVALID",
      "Phase82H projection violates its source-monitoring, authority, or persistence boundary.",
    );
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(
  input = {},
) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_INPUT_INVALID",
      "Phase82H state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase82g =
    assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
      input.counterfactual_linked_experience_longitudinal_case_selected_action_lineage,
      {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
        counterfactual_linked_experience_longitudinal_case_reentry:
          input.counterfactual_linked_experience_longitudinal_case_reentry,
        counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:
          input.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
        counterfactual_linked_experience_reuse_outcome_reentry_projections:
          input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
        world_history: input.world_history,
      },
    );
  if (phase82g.version
      !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE82G_INVALID",
      "Phase82H requires the canonical Phase82G selected-action lineage version.",
    );
  }
  const phase76a = verifyPhase76A(input.post_outcome_subjective_perception_projection, turnId);
  const subjectiveExperienceByCharacterAction = new Map();
  for (const experience of phase76a.character_experiences) {
    const key = `${String(experience.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${experience.action_id}`;
    subjectiveExperienceByCharacterAction.set(key, experience);
  }

  const evidenceRecords = [];
  for (const receipt of phase82g.receipts) {
    const key = `${String(receipt.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${receipt.action_id}`;
    const perception = subjectiveExperienceByCharacterAction.get(key);
    if (!perception) continue;
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: receipt.character,
      phase82g_receipt_id: receipt.receipt_id,
      phase82g_receipt_hash: receipt.receipt_hash,
      phase82f_projection_hash: receipt.phase82f_projection_hash,
      source_phase82e_projection_hash: receipt.source_phase82e_projection_hash,
      deliberative_reuse_intent_ref: receipt.deliberative_reuse_intent_ref,
      deliberative_reuse_intent_hash: receipt.deliberative_reuse_intent_hash,
      source_reentry_candidate_ref: receipt.source_reentry_candidate_ref,
      source_reentry_candidate_hash: receipt.source_reentry_candidate_hash,
      source_phase82d_projection_hash: receipt.source_phase82d_projection_hash,
      source_phase82d_admission_ref: receipt.source_phase82d_admission_ref,
      source_phase82d_admission_hash: receipt.source_phase82d_admission_hash,
      source_phase82c_projection_hash: receipt.source_phase82c_projection_hash,
      source_phase82c_appraisal_ref: receipt.source_phase82c_appraisal_ref,
      source_phase82c_appraisal_hash: receipt.source_phase82c_appraisal_hash,
      source_phase81m_capsule_ref: receipt.source_phase81m_capsule_ref,
      reuse_intent_ref: receipt.reuse_intent_ref,
      current_phase81n_projection_hash: receipt.current_phase81n_projection_hash,
      phase74d_choice_receipt_id: receipt.phase74d_choice_receipt_id,
      phase74d_choice_receipt_hash: receipt.phase74d_choice_receipt_hash,
      action_id: receipt.action_id,
      action_ref: receipt.action_ref,
      selection_relation: receipt.selection_relation,
      phase76a_subjective_perception_ref: perception.subjective_perception_ref,
      subjective_outcome_basis: "bounded_phase76a_selected_action_experience",
      selected_action_subjective_experience: cloneJson(perception.experience),
    };
    const evidenceHash = hashAgentRunValue(identity);
    evidenceRecords.push({
      evidence_ref: `phase82h_outcome_evidence_${evidenceHash.slice(0, 24)}`,
      evidence_hash: evidenceHash,
      ...identity,
      selected_action_subjective_outcome_observed: true,
      retained_longitudinal_case_is_current_world_truth: false,
      retained_admission_is_effectiveness_claim: false,
      retained_admission_is_success_claim: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      longitudinal_case_activation_caused_selection_claimed: false,
      longitudinal_case_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    });
  }
  evidenceRecords.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));
  if (evidenceRecords.length > maximumEvidenceRecordCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_OUTCOME_EVIDENCE_LIMIT_EXCEEDED",
      `Phase82H accepts at most ${maximumEvidenceRecordCount} evidence records per turn.`,
    );
  }
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidenceVersion,
    phase: "Phase82H",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase82g_receipt_bundle_hash: phase82g.receipt_bundle_hash,
    source_phase76a_projection_hash: phase76a.projection_hash,
    evidence_count: evidenceRecords.length,
    evidence_records: evidenceRecords,
    audit: {
      exact_phase82g_selected_action_lineage_verified: true,
      exact_phase82e_phase82f_phase74d_phase81n_world_history_revalidated: true,
      exact_phase76a_subjective_outcome_verified: true,
      same_character_same_selected_action_join_required: true,
      retained_longitudinal_case_is_current_world_truth: false,
      retained_admission_interpreted_as_effectiveness: false,
      retained_admission_interpreted_as_success: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      longitudinal_case_activation_caused_selection_claimed: false,
      longitudinal_case_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_character_brain_feedback: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      interpretation_and_learning_deferred: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionOutcomeEvidence(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      counterfactual_linked_experience_longitudinal_case_selected_action_lineage: phase82g,
      subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
      counterfactual_linked_experience_longitudinal_case_reentry:
        input.counterfactual_linked_experience_longitudinal_case_reentry,
      counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:
        input.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
      counterfactual_linked_experience_reuse_outcome_reentry_projections:
        input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
      world_history: input.world_history,
      post_outcome_subjective_perception_projection: phase76a,
    },
  );
}
