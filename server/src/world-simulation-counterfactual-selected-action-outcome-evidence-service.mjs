import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle,
  worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
} from "./world-simulation-counterfactual-preparative-selected-action-lineage-service.mjs";
import {
  worldSimulationPostOutcomeSubjectivePerceptionVersion,
} from "./world-simulation-post-outcome-subjective-perception-service.mjs";

export const worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion =
  "phase81g-counterfactual-selected-action-subjective-outcome-evidence-v1";

const maximumEvidenceRecordCount = 32;
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
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_INPUT_INVALID",
      `Phase81G ${label} must be a bounded non-empty string.`,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
      "Phase81G requires the exact bounded scalar Phase76A subjective experience for the selected action.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_INVALID",
      "Phase81G requires an exact canonical Phase76A subjective post-outcome projection for this turn.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_BOUNDARY_INVALID",
      "Phase81G rejects Phase76A evidence that violates the sealed subjective-observation boundary.",
    );
  }
  const seenRefs = new Set();
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
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_INVALID",
        "Phase81G found an invalid Phase76A subjective experience record.",
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
    if (experience.subjective_perception_ref !== expectedRef
        || seenRefs.has(experience.subjective_perception_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_EXPERIENCE_HASH_MISMATCH",
        "Phase81G Phase76A subjective experience identity verification failed.",
      );
    }
    seenRefs.add(experience.subjective_perception_ref);
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualSelectedActionOutcomeEvidenceContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
    phase: "Phase81G",
    status: "selected_counterfactual_linked_action_subjective_outcome_evidence_installed",
    source_selected_action_lineage_owner: "Phase81F",
    source_subjective_outcome_owner: "Phase76A",
    exact_phase81f_receipt_bundle_hash_required: true,
    exact_phase76a_projection_hash_required: true,
    same_character_same_action_id_required: true,
    only_bounded_subjective_selected_action_outcome_observed: true,
    historical_imagined_alternative_outcome_observed: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    counterfactual_advisory_effectiveness_inferred: false,
    counterfactual_advisory_caused_selection_claimed: false,
    success_failure_interpretation_performed: false,
    outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_evidence_record_count: maximumEvidenceRecordCount,
  });
}

export function assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion
      || projection.phase !== "Phase81G"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase81f_receipt_bundle_hash)
      || !text(projection.source_phase76a_projection_hash)
      || !Array.isArray(projection.evidence_records)
      || projection.evidence_count !== projection.evidence_records.length
      || projection.evidence_count > maximumEvidenceRecordCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_INVALID",
      "Phase81G selected counterfactual-linked action subjective outcome evidence is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        `Phase81G projection ${key} does not match expected lineage.`,
      );
    }
  }

  let expectedPhase81F = null;
  if (expected.counterfactual_preparative_selected_action_lineage !== undefined) {
    expectedPhase81F = assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(
      expected.counterfactual_preparative_selected_action_lineage,
      {
        world_simulation_session_id: projection.world_simulation_session_id,
        turn_id: projection.turn_id,
        state_revision: projection.state_revision,
        world_state_hash: projection.world_state_hash,
      },
    );
    if (projection.source_phase81f_receipt_bundle_hash !== expectedPhase81F.receipt_bundle_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase81G no longer matches the exact Phase81F receipt bundle.",
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
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        "Phase81G no longer matches the exact Phase76A subjective outcome projection.",
      );
    }
  }

  const phase81FById = expectedPhase81F
    ? new Map(expectedPhase81F.receipts.map((receipt) => [receipt.receipt_id, receipt]))
    : null;
  const phase76AByRef = expectedPhase76A
    ? new Map(expectedPhase76A.character_experiences
      .map((experience) => [experience.subjective_perception_ref, experience]))
    : null;
  const seenRefs = new Set();
  const seenPairs = new Set();
  for (const record of projection.evidence_records) {
    if (!isObject(record)
        || record.version !== worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion
        || record.world_simulation_session_id !== projection.world_simulation_session_id
        || record.turn_id !== projection.turn_id
        || record.state_revision !== projection.state_revision
        || record.world_state_hash !== projection.world_state_hash
        || !text(record.character)
        || !text(record.phase81f_receipt_id)
        || !text(record.phase81f_receipt_hash)
        || !text(record.phase81e_projection_hash)
        || !text(record.source_phase81d_projection_hash)
        || !text(record.revalidation_judgment_ref)
        || !text(record.revalidation_judgment_hash)
        || !text(record.phase74d_choice_receipt_id)
        || !text(record.phase74d_choice_receipt_hash)
        || !text(record.action_id)
        || !text(record.action_ref)
        || !text(record.applicability_judgment)
        || !text(record.selection_relation)
        || !text(record.historical_preparative_orientation)
        || !text(record.phase76a_subjective_perception_ref)
        || record.subjective_outcome_basis !== "bounded_phase76a_selected_action_experience"
        || !isObject(record.selected_action_subjective_experience)
        || record.selected_action_subjective_outcome_observed !== true
        || record.historical_imagined_alternative_was_experienced !== false
        || record.historical_unchosen_outcome_observed !== false
        || record.historical_counterfactual_truth_evaluated !== false
        || record.historical_counterfactual_validated_by_current_outcome !== false
        || record.counterfactual_advisory_effectiveness_inferred !== false
        || record.counterfactual_advisory_caused_selection_claimed !== false
        || record.success_failure_interpretation_performed !== false
        || record.outcome_credit_assigned !== false
        || record.preference_revision_performed !== false
        || record.belief_revision_performed !== false
        || record.semantic_revision_performed !== false
        || record.subjective_memory_rewrite_performed !== false
        || record.world_state_mutated !== false
        || record.world_truth_authority !== false
        || !text(record.evidence_ref)
        || !text(record.evidence_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_RECORD_INVALID",
        "Phase81G contains an invalid or over-authoritative subjective outcome evidence record.",
      );
    }
    verifyExperience(record.selected_action_subjective_experience, record.action_id);
    if (phase81FById && phase76AByRef) {
      const sourceReceipt = phase81FById.get(record.phase81f_receipt_id);
      const subjectivePerception = phase76AByRef.get(record.phase76a_subjective_perception_ref);
      if (!sourceReceipt
          || !subjectivePerception
          || sourceReceipt.receipt_hash !== record.phase81f_receipt_hash
          || sourceReceipt.phase81e_projection_hash !== record.phase81e_projection_hash
          || sourceReceipt.source_phase81d_projection_hash !== record.source_phase81d_projection_hash
          || sourceReceipt.revalidation_judgment_ref !== record.revalidation_judgment_ref
          || sourceReceipt.revalidation_judgment_hash !== record.revalidation_judgment_hash
          || sourceReceipt.phase74d_choice_receipt_id !== record.phase74d_choice_receipt_id
          || sourceReceipt.phase74d_choice_receipt_hash !== record.phase74d_choice_receipt_hash
          || sourceReceipt.action_id !== record.action_id
          || sourceReceipt.action_ref !== record.action_ref
          || sourceReceipt.applicability_judgment !== record.applicability_judgment
          || sourceReceipt.selection_relation !== record.selection_relation
          || sourceReceipt.historical_preparative_orientation
            !== record.historical_preparative_orientation
          || !sameCharacter(sourceReceipt.character, record.character)
          || !sameCharacter(subjectivePerception.character, record.character)
          || subjectivePerception.action_id !== record.action_id
          || hashAgentRunValue(subjectivePerception.experience)
            !== hashAgentRunValue(record.selected_action_subjective_experience)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
          "Phase81G evidence no longer matches the exact Phase81F selected action and Phase76A subjective outcome.",
        );
      }
    }
    const identity = cloneJson(record);
    for (const key of [
      "evidence_ref",
      "evidence_hash",
      "selected_action_subjective_outcome_observed",
      "historical_imagined_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_current_outcome",
      "counterfactual_advisory_effectiveness_inferred",
      "counterfactual_advisory_caused_selection_claimed",
      "success_failure_interpretation_performed",
      "outcome_credit_assigned",
      "preference_revision_performed",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    const pairKey = `${record.phase81f_receipt_id}\n${record.phase76a_subjective_perception_ref}`;
    if (record.evidence_hash !== expectedHash
        || record.evidence_ref !== `phase81g_outcome_evidence_${expectedHash.slice(0, 24)}`
        || seenRefs.has(record.evidence_ref)
        || seenPairs.has(pairKey)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_RECORD_HASH_MISMATCH",
        "Phase81G subjective outcome evidence identity verification failed.",
      );
    }
    seenRefs.add(record.evidence_ref);
    seenPairs.add(pairKey);
  }

  if (projection.audit.exact_phase81f_selected_action_lineage_verified !== true
      || projection.audit.exact_phase76a_subjective_outcome_verified !== true
      || projection.audit.same_character_same_selected_action_join_required !== true
      || projection.audit.historical_imagined_alternative_outcome_observed !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.historical_counterfactual_validated_by_current_outcome !== false
      || projection.audit.counterfactual_advisory_effectiveness_inferred !== false
      || projection.audit.counterfactual_advisory_caused_selection_claimed !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.outcome_credit_assigned !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_evidence !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_BOUNDARY_INVALID",
      "Phase81G projection violates its source-monitoring, authority, or persistence boundary.",
    );
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualSelectedActionOutcomeEvidence(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_INPUT_INVALID",
      "Phase81G state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase81F = assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(
    input.counterfactual_preparative_selected_action_lineage,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (phase81F.version !== worldSimulationCounterfactualPreparativeSelectedActionLineageVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE81F_INVALID",
      "Phase81G requires the canonical Phase81F selected-action lineage version.",
    );
  }
  const phase76A = verifyPhase76A(
    input.post_outcome_subjective_perception_projection,
    turnId,
  );

  const subjectiveExperienceByCharacterAction = new Map();
  for (const experience of phase76A.character_experiences) {
    const key = `${String(experience.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${experience.action_id}`;
    if (subjectiveExperienceByCharacterAction.has(key)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_PHASE76A_DUPLICATE",
        "Phase81G accepts at most one Phase76A subjective experience per character/action pair.",
      );
    }
    subjectiveExperienceByCharacterAction.set(key, experience);
  }

  const evidenceRecords = [];
  for (const receipt of phase81F.receipts) {
    const key = `${String(receipt.character).trim().toLocaleLowerCase("zh-Hant-TW")}\n${receipt.action_id}`;
    const subjectivePerception = subjectiveExperienceByCharacterAction.get(key);
    if (!subjectivePerception) continue;
    const identity = {
      version: worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: receipt.character,
      phase81f_receipt_id: receipt.receipt_id,
      phase81f_receipt_hash: receipt.receipt_hash,
      phase81e_projection_hash: receipt.phase81e_projection_hash,
      source_phase81d_projection_hash: receipt.source_phase81d_projection_hash,
      revalidation_judgment_ref: receipt.revalidation_judgment_ref,
      revalidation_judgment_hash: receipt.revalidation_judgment_hash,
      phase74d_choice_receipt_id: receipt.phase74d_choice_receipt_id,
      phase74d_choice_receipt_hash: receipt.phase74d_choice_receipt_hash,
      action_id: receipt.action_id,
      action_ref: receipt.action_ref,
      applicability_judgment: receipt.applicability_judgment,
      selection_relation: receipt.selection_relation,
      historical_actual_selected_action_id: receipt.historical_actual_selected_action_id,
      historical_imagined_alternative_action_id:
        receipt.historical_imagined_alternative_action_id,
      historical_comparison_direction: receipt.historical_comparison_direction,
      historical_appraisal_kind: receipt.historical_appraisal_kind,
      historical_preparative_orientation: receipt.historical_preparative_orientation,
      phase76a_subjective_perception_ref: subjectivePerception.subjective_perception_ref,
      subjective_outcome_basis: "bounded_phase76a_selected_action_experience",
      selected_action_subjective_experience: cloneJson(subjectivePerception.experience),
    };
    const evidenceHash = hashAgentRunValue(identity);
    evidenceRecords.push({
      evidence_ref: `phase81g_outcome_evidence_${evidenceHash.slice(0, 24)}`,
      evidence_hash: evidenceHash,
      ...identity,
      selected_action_subjective_outcome_observed: true,
      historical_imagined_alternative_was_experienced: false,
      historical_unchosen_outcome_observed: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      counterfactual_advisory_caused_selection_claimed: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_SELECTED_ACTION_OUTCOME_EVIDENCE_LIMIT_EXCEEDED",
      `Phase81G accepts at most ${maximumEvidenceRecordCount} evidence records per turn.`,
    );
  }
  const projection = {
    version: worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
    phase: "Phase81G",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase81f_receipt_bundle_hash: phase81F.receipt_bundle_hash,
    source_phase76a_projection_hash: phase76A.projection_hash,
    evidence_count: evidenceRecords.length,
    evidence_records: evidenceRecords,
    audit: {
      exact_phase81f_selected_action_lineage_verified: true,
      exact_phase76a_subjective_outcome_verified: true,
      same_character_same_selected_action_join_required: true,
      historical_imagined_alternative_outcome_observed: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      counterfactual_advisory_caused_selection_claimed: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      future_interpretation_or_retention_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    counterfactual_preparative_selected_action_lineage: phase81F,
    post_outcome_subjective_perception_projection: phase76A,
  });
}
