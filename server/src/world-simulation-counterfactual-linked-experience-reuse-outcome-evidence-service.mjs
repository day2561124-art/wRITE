import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle,
  worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
} from "./world-simulation-counterfactual-linked-experience-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion =
  "phase81l-counterfactual-linked-experience-reuse-subjective-outcome-evidence-v1";

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

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_INPUT_INVALID",
      `Phase81L ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
      "Phase81L requires the exact bounded scalar Phase76A subjective experience for the selected action.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_INVALID",
      "Phase81L requires an exact canonical Phase76A subjective post-outcome projection for this turn.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_BOUNDARY_INVALID",
      "Phase81L rejects Phase76A evidence that violates the sealed subjective-observation boundary.",
    );
  }
  const seenRefs = new Set();
  const seenCharacterActions = new Set();
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
        "Phase81L found an invalid Phase76A subjective experience record.",
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
    const characterAction = `${String(experience.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${experience.action_id}`;
    if (experience.subjective_perception_ref !== expectedRef
        || seenRefs.has(experience.subjective_perception_ref)
        || seenCharacterActions.has(characterAction)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_HASH_MISMATCH",
        "Phase81L Phase76A subjective experience identity or uniqueness verification failed.",
      );
    }
    seenRefs.add(experience.subjective_perception_ref);
    seenCharacterActions.add(characterAction);
  }
  return Object.freeze(projection);
}

function exactPhase81KSources(expected, projection) {
  const sourceFields = [
    expected.subjective_choice_commitment_receipts,
    expected.counterfactual_linked_experience_reentry_projections,
    expected.counterfactual_linked_experience_reuse_projections,
    expected.world_history,
  ];
  const suppliedCount = sourceFields.filter((value) => value !== undefined).length;
  if (suppliedCount === 0) return {};
  if (suppliedCount !== sourceFields.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_EXPECTED_SOURCE_SET_INCOMPLETE",
      "Phase81L exact Phase81K source validation requires Phase74D, Phase81I, Phase81J, and canonical prior World History together.",
    );
  }
  return {
    subjective_choice_commitment_receipts: expected.subjective_choice_commitment_receipts,
    counterfactual_linked_experience_reentry_projections:
      expected.counterfactual_linked_experience_reentry_projections,
    counterfactual_linked_experience_reuse_projections:
      expected.counterfactual_linked_experience_reuse_projections,
    world_history: expected.world_history,
    world_simulation_session_id: projection.world_simulation_session_id,
    turn_id: projection.turn_id,
    state_revision: projection.state_revision,
    world_state_hash: projection.world_state_hash,
  };
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
    phase: "Phase81L",
    status: "reused_counterfactual_linked_selected_action_subjective_outcome_evidence_installed",
    source_selected_action_lineage_owner: "Phase81K",
    source_subjective_outcome_owner: "Phase76A",
    exact_phase81k_receipt_bundle_hash_required: true,
    exact_phase81i_phase81j_phase74d_world_history_revalidation_required: true,
    exact_phase76a_projection_hash_required: true,
    same_character_same_action_id_required: true,
    only_bounded_current_selected_action_subjective_outcome_observed: true,
    prior_linked_case_subjective_outcome_is_current_world_truth: false,
    historical_imagined_alternative_outcome_observed: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    reuse_intent_caused_selection_claimed: false,
    reuse_or_advisory_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_evidence_record_count: maximumEvidenceRecordCount,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion
      || projection.phase !== "Phase81L"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase81k_receipt_bundle_hash)
      || !text(projection.source_phase76a_projection_hash)
      || !Array.isArray(projection.evidence_records)
      || projection.evidence_count !== projection.evidence_records.length
      || projection.evidence_count > maximumEvidenceRecordCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_INVALID",
      "Phase81L reused counterfactual-linked selected-action subjective outcome evidence is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        `Phase81L projection ${key} does not match expected lineage.`,
      );
    }
  }

  let expectedPhase81K = null;
  if (expected.counterfactual_linked_experience_selected_action_lineage !== undefined) {
    expectedPhase81K =
      assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(
        expected.counterfactual_linked_experience_selected_action_lineage,
        exactPhase81KSources(expected, projection),
      );
    if (expectedPhase81K.version
          !== worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion
        || projection.source_phase81k_receipt_bundle_hash
          !== expectedPhase81K.receipt_bundle_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase81L no longer matches the exact canonical Phase81K selected-action lineage bundle.",
      );
    }
  }

  let expectedPhase76A = null;
  if (expected.post_outcome_subjective_perception_projection !== undefined) {
    expectedPhase76A = verifyPhase76A(
      expected.post_outcome_subjective_perception_projection,
      projection.turn_id,
    );
    if (projection.source_phase76a_projection_hash !== expectedPhase76A.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase81L no longer matches the exact Phase76A subjective outcome projection.",
      );
    }
  }

  const phase81KById = expectedPhase81K
    ? new Map(expectedPhase81K.receipts.map((receipt) => [receipt.receipt_id, receipt]))
    : null;
  const phase76AByRef = expectedPhase76A
    ? new Map(expectedPhase76A.character_experiences
      .map((experience) => [experience.subjective_perception_ref, experience]))
    : null;
  const seenRefs = new Set();
  const seenPairs = new Set();
  for (const record of projection.evidence_records) {
    if (!isObject(record)
        || record.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion
        || record.world_simulation_session_id !== projection.world_simulation_session_id
        || record.turn_id !== projection.turn_id
        || record.state_revision !== projection.state_revision
        || record.world_state_hash !== projection.world_state_hash
        || !text(record.character)
        || !text(record.phase81k_receipt_id)
        || !text(record.phase81k_receipt_hash)
        || !text(record.phase81j_projection_hash)
        || !text(record.source_phase81i_projection_hash)
        || !text(record.reuse_intent_ref)
        || !text(record.reuse_intent_hash)
        || !text(record.source_reentry_candidate_ref)
        || !text(record.source_reentry_candidate_hash)
        || !text(record.phase74d_choice_receipt_id)
        || !text(record.phase74d_choice_receipt_hash)
        || !text(record.action_id)
        || !text(record.action_ref)
        || record.selection_relation
          !== "selected_action_matches_counterfactual_linked_reuse_intent"
        || !text(record.phase76a_subjective_perception_ref)
        || record.subjective_outcome_basis !== "bounded_phase76a_selected_action_experience"
        || !isObject(record.selected_action_subjective_experience)
        || record.selected_action_subjective_outcome_observed !== true
        || record.prior_linked_case_subjective_outcome_is_current_world_truth !== false
        || record.historical_imagined_alternative_was_experienced !== false
        || record.historical_unchosen_outcome_observed !== false
        || record.historical_counterfactual_truth_evaluated !== false
        || record.historical_counterfactual_validated_by_current_outcome !== false
        || record.reuse_intent_caused_selection_claimed !== false
        || record.reuse_or_advisory_effectiveness_inferred !== false
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_RECORD_INVALID",
        "Phase81L contains an invalid or over-authoritative subjective outcome evidence record.",
      );
    }
    verifyExperience(record.selected_action_subjective_experience, record.action_id);
    if (phase81KById && phase76AByRef) {
      const lineage = phase81KById.get(record.phase81k_receipt_id);
      const subjectivePerception = phase76AByRef.get(record.phase76a_subjective_perception_ref);
      if (!lineage
          || !subjectivePerception
          || lineage.receipt_hash !== record.phase81k_receipt_hash
          || lineage.phase81j_projection_hash !== record.phase81j_projection_hash
          || lineage.source_phase81i_projection_hash !== record.source_phase81i_projection_hash
          || lineage.reuse_intent_ref !== record.reuse_intent_ref
          || lineage.reuse_intent_hash !== record.reuse_intent_hash
          || lineage.source_reentry_candidate_ref !== record.source_reentry_candidate_ref
          || lineage.source_reentry_candidate_hash !== record.source_reentry_candidate_hash
          || lineage.phase74d_choice_receipt_id !== record.phase74d_choice_receipt_id
          || lineage.phase74d_choice_receipt_hash !== record.phase74d_choice_receipt_hash
          || lineage.action_id !== record.action_id
          || lineage.action_ref !== record.action_ref
          || lineage.selection_relation !== record.selection_relation
          || !sameCharacter(lineage.character, record.character)
          || !sameCharacter(subjectivePerception.character, record.character)
          || subjectivePerception.action_id !== record.action_id
          || hashAgentRunValue(subjectivePerception.experience)
            !== hashAgentRunValue(record.selected_action_subjective_experience)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
          "Phase81L evidence no longer matches its exact Phase81K selected-action lineage and Phase76A subjective outcome.",
        );
      }
    }

    const identity = cloneJson(record);
    for (const key of [
      "evidence_ref",
      "evidence_hash",
      "selected_action_subjective_outcome_observed",
      "prior_linked_case_subjective_outcome_is_current_world_truth",
      "historical_imagined_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_current_outcome",
      "reuse_intent_caused_selection_claimed",
      "reuse_or_advisory_effectiveness_inferred",
      "success_failure_interpretation_performed",
      "causal_or_outcome_credit_assigned",
      "preference_revision_performed",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    const pairKey = `${record.phase81k_receipt_id}\n${record.phase76a_subjective_perception_ref}`;
    if (record.evidence_hash !== expectedHash
        || record.evidence_ref !== `phase81l_reuse_outcome_${expectedHash.slice(0, 24)}`
        || seenRefs.has(record.evidence_ref)
        || seenPairs.has(pairKey)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_RECORD_HASH_MISMATCH",
        "Phase81L subjective outcome evidence identity verification failed.",
      );
    }
    seenRefs.add(record.evidence_ref);
    seenPairs.add(pairKey);
  }

  if (projection.audit.exact_phase81k_selected_action_lineage_verified !== true
      || projection.audit.exact_phase81i_phase81j_phase74d_world_history_revalidated !== true
      || projection.audit.exact_phase76a_subjective_outcome_verified !== true
      || projection.audit.same_character_same_selected_action_join_required !== true
      || projection.audit.prior_linked_case_subjective_outcome_is_current_world_truth !== false
      || projection.audit.historical_imagined_alternative_outcome_observed !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.historical_counterfactual_validated_by_current_outcome !== false
      || projection.audit.reuse_intent_caused_selection_claimed !== false
      || projection.audit.reuse_or_advisory_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false
      || projection.audit.same_turn_character_brain_feedback !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_evidence !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_BOUNDARY_INVALID",
      "Phase81L projection violates its source-monitoring, authority, or persistence boundary.",
    );
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_INPUT_INVALID",
      "Phase81L state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase81K =
    assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(
      input.counterfactual_linked_experience_selected_action_lineage,
      {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
        counterfactual_linked_experience_reentry_projections:
          input.counterfactual_linked_experience_reentry_projections,
        counterfactual_linked_experience_reuse_projections:
          input.counterfactual_linked_experience_reuse_projections,
        world_history: input.world_history,
      },
    );
  if (phase81K.version
      !== worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_PHASE81K_INVALID",
      "Phase81L requires the canonical Phase81K selected-action lineage version.",
    );
  }
  const phase76A = verifyPhase76A(
    input.post_outcome_subjective_perception_projection,
    turnId,
  );

  const subjectiveExperienceByCharacterAction = new Map();
  for (const experience of phase76A.character_experiences) {
    const key = `${String(experience.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${experience.action_id}`;
    subjectiveExperienceByCharacterAction.set(key, experience);
  }

  const evidenceRecords = [];
  for (const receipt of phase81K.receipts) {
    const key = `${String(receipt.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${receipt.action_id}`;
    const subjectivePerception = subjectiveExperienceByCharacterAction.get(key);
    if (!subjectivePerception) continue;
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: receipt.character,
      phase81k_receipt_id: receipt.receipt_id,
      phase81k_receipt_hash: receipt.receipt_hash,
      phase81j_projection_hash: receipt.phase81j_projection_hash,
      source_phase81i_projection_hash: receipt.source_phase81i_projection_hash,
      reuse_intent_ref: receipt.reuse_intent_ref,
      reuse_intent_hash: receipt.reuse_intent_hash,
      source_reentry_candidate_ref: receipt.source_reentry_candidate_ref,
      source_reentry_candidate_hash: receipt.source_reentry_candidate_hash,
      phase74d_choice_receipt_id: receipt.phase74d_choice_receipt_id,
      phase74d_choice_receipt_hash: receipt.phase74d_choice_receipt_hash,
      action_id: receipt.action_id,
      action_ref: receipt.action_ref,
      selection_relation: receipt.selection_relation,
      phase76a_subjective_perception_ref: subjectivePerception.subjective_perception_ref,
      subjective_outcome_basis: "bounded_phase76a_selected_action_experience",
      selected_action_subjective_experience: cloneJson(subjectivePerception.experience),
    };
    const evidenceHash = hashAgentRunValue(identity);
    evidenceRecords.push({
      evidence_ref: `phase81l_reuse_outcome_${evidenceHash.slice(0, 24)}`,
      evidence_hash: evidenceHash,
      ...identity,
      selected_action_subjective_outcome_observed: true,
      prior_linked_case_subjective_outcome_is_current_world_truth: false,
      historical_imagined_alternative_was_experienced: false,
      historical_unchosen_outcome_observed: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      reuse_intent_caused_selection_claimed: false,
      reuse_or_advisory_effectiveness_inferred: false,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_EVIDENCE_LIMIT_EXCEEDED",
      `Phase81L accepts at most ${maximumEvidenceRecordCount} evidence records per turn.`,
    );
  }

  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
    phase: "Phase81L",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase81k_receipt_bundle_hash: phase81K.receipt_bundle_hash,
    source_phase76a_projection_hash: phase76A.projection_hash,
    evidence_count: evidenceRecords.length,
    evidence_records: evidenceRecords,
    audit: {
      exact_phase81k_selected_action_lineage_verified: true,
      exact_phase81i_phase81j_phase74d_world_history_revalidated: true,
      exact_phase76a_subjective_outcome_verified: true,
      same_character_same_selected_action_join_required: true,
      prior_linked_case_subjective_outcome_is_current_world_truth: false,
      historical_imagined_alternative_outcome_observed: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      reuse_intent_caused_selection_claimed: false,
      reuse_or_advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
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
  return assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      counterfactual_linked_experience_selected_action_lineage: phase81K,
      subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
      counterfactual_linked_experience_reentry_projections:
        input.counterfactual_linked_experience_reentry_projections,
      counterfactual_linked_experience_reuse_projections:
        input.counterfactual_linked_experience_reuse_projections,
      world_history: input.world_history,
      post_outcome_subjective_perception_projection: phase76A,
    },
  );
}
