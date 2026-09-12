import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-case-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection,
  worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion,
} from "./world-simulation-counterfactual-linked-experience-longitudinal-case-deliberative-reuse-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion =
  "phase82g-counterfactual-linked-experience-longitudinal-case-selected-action-lineage-v1";

const maximumProjectionCount = 32;
const maximumReceiptCount = 64;

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
function requiredText(value, label, maxLength = 512) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_INPUT_INVALID",
      `Phase82G ${label} must be a bounded non-empty string.`,
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

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
    phase: "Phase82G",
    status: "longitudinal_case_activation_to_selected_action_lineage_installed",
    source_deliberation_owner: "Phase82F",
    source_reentry_owner: "Phase82E",
    source_choice_owner: "Phase74D",
    exact_phase82e_phase82f_lineage_required: true,
    exact_phase74d_choice_receipt_required: true,
    canonical_prior_world_history_required_for_phase82e_validation: true,
    canonical_current_phase81n_required_for_phase82e_validation: true,
    same_character_same_turn_required: true,
    selected_action_id_and_ref_must_match_phase82f_current_action: true,
    omitted_phase82f_activation_means_no_lineage_receipt: true,
    lineage_records_selection_relation_only: true,
    longitudinal_case_activation_caused_selection_claimed: false,
    retained_longitudinal_case_caused_candidate_generation_claimed: false,
    retained_admission_is_effectiveness_claim: false,
    retained_admission_is_success_claim: false,
    historical_counterfactual_truth_evaluated: false,
    action_outcome_consumed: false,
    longitudinal_case_effectiveness_inferred: false,
    causal_or_outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_projection_count: maximumProjectionCount,
    maximum_receipt_count: maximumReceiptCount,
  });
}

function exactSources(expected, bundle) {
  const supplied = [
    expected.subjective_choice_commitment_receipts,
    expected.counterfactual_linked_experience_longitudinal_case_reentry,
    expected.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
    expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    expected.world_history,
  ];
  const suppliedCount = supplied.filter((value) => value !== undefined).length;
  if (suppliedCount === 0) return null;
  if (suppliedCount !== supplied.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_EXPECTED_SOURCE_SET_INCOMPLETE",
      "Phase82G exact-source validation requires Phase74D, Phase82E, Phase82F, current Phase81N, and canonical prior World History together.",
    );
  }

  const choices = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    expected.subjective_choice_commitment_receipts,
    {
      world_simulation_session_id: bundle.world_simulation_session_id,
      turn_id: bundle.turn_id,
      state_revision: bundle.state_revision,
      world_state_hash: bundle.world_state_hash,
    },
  );
  if (choices.receipt_bundle_hash !== bundle.source_phase74d_receipt_bundle_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
      "Phase82G no longer matches the exact Phase74D selected-action receipt bundle.",
    );
  }

  const phase82e =
    assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
      expected.counterfactual_linked_experience_longitudinal_case_reentry,
      {
        world_simulation_session_id: bundle.world_simulation_session_id,
        current_turn_id: bundle.turn_id,
        current_state_revision: bundle.state_revision,
        current_world_state_hash: bundle.world_state_hash,
        world_history: expected.world_history,
        counterfactual_linked_experience_reuse_outcome_reentry_projections:
          expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
      },
    );
  if (phase82e.projection_hash !== bundle.source_phase82e_projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
      "Phase82G source Phase82E projection no longer matches exact expected lineage.",
    );
  }

  const phase82fByHash = new Map();
  const phase82fByCharacter = new Map();
  for (const raw of array(
    expected.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
  )) {
    const projection =
      assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
        raw,
        {
          character: raw?.character,
          source_phase82e_projection: phase82e,
          expected_source: {
            world_history: expected.world_history,
            counterfactual_linked_experience_reuse_outcome_reentry_projections:
              expected.counterfactual_linked_experience_reuse_outcome_reentry_projections,
          },
        },
      );
    if (phase82fByHash.has(projection.projection_hash)
        || phase82fByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        "Phase82G expected sources contain duplicate Phase82F projections.",
      );
    }
    phase82fByHash.set(projection.projection_hash, projection);
    phase82fByCharacter.set(projection.character, projection);
  }
  const expectedHashes = [...phase82fByHash.keys()].sort(compareText);
  if (hashAgentRunValue(bundle.source_phase82f_projection_hashes)
      !== hashAgentRunValue(expectedHashes)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
      "Phase82G source Phase82F projection set no longer matches exact expected lineage.",
    );
  }
  return {
    choicesById: new Map(choices.receipts.map((receipt) => [receipt.receipt_id, receipt])),
    phase82e,
    phase82fByHash,
  };
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
  value,
  expected = {},
) {
  const bundle = cloneJson(value);
  if (!isObject(bundle)
      || bundle.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion
      || bundle.phase !== "Phase82G"
      || !text(bundle.world_simulation_session_id)
      || !text(bundle.turn_id)
      || !Number.isSafeInteger(bundle.state_revision)
      || bundle.state_revision < 0
      || !text(bundle.world_state_hash)
      || !text(bundle.source_phase74d_receipt_bundle_hash)
      || !text(bundle.source_phase82e_projection_hash)
      || !Array.isArray(bundle.source_phase82f_projection_hashes)
      || new Set(bundle.source_phase82f_projection_hashes).size !== bundle.source_phase82f_projection_hashes.length
      || bundle.source_phase82f_projection_hashes.some((hash) => !text(hash))
      || !Array.isArray(bundle.receipts)
      || bundle.receipt_count !== bundle.receipts.length
      || bundle.receipt_count > maximumReceiptCount
      || !isObject(bundle.audit)
      || !isObject(bundle.persistence_boundary)
      || !text(bundle.receipt_bundle_hash)
      || hashWithout(bundle, "receipt_bundle_hash") !== bundle.receipt_bundle_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_BUNDLE_INVALID",
      "Phase82G longitudinal-case selected-action lineage bundle is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && bundle[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
        `Phase82G bundle ${key} does not match expected lineage.`,
      );
    }
  }

  const canonical = exactSources(expected, bundle);
  const seen = new Set();
  for (const receipt of bundle.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion
        || receipt.world_simulation_session_id !== bundle.world_simulation_session_id
        || receipt.turn_id !== bundle.turn_id
        || receipt.state_revision !== bundle.state_revision
        || receipt.world_state_hash !== bundle.world_state_hash
        || !text(receipt.character)
        || !text(receipt.phase82f_projection_hash)
        || !bundle.source_phase82f_projection_hashes.includes(receipt.phase82f_projection_hash)
        || receipt.source_phase82e_projection_hash !== bundle.source_phase82e_projection_hash
        || !text(receipt.deliberative_reuse_intent_ref)
        || !text(receipt.deliberative_reuse_intent_hash)
        || !text(receipt.source_reentry_candidate_ref)
        || !text(receipt.source_reentry_candidate_hash)
        || !text(receipt.source_phase82d_admission_ref)
        || !text(receipt.source_phase82d_admission_hash)
        || !text(receipt.current_phase81n_projection_hash)
        || !text(receipt.phase74d_choice_receipt_id)
        || !text(receipt.phase74d_choice_receipt_hash)
        || receipt.phase74d_choice_receipt_version !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
        || receipt.selection_kind !== "candidate_action_intent"
        || !text(receipt.action_id)
        || !text(receipt.action_ref)
        || receipt.selection_relation
          !== "selected_action_matches_longitudinal_case_deliberative_reuse_intent"
        || receipt.selected_action_matches_phase82f_current_action !== true
        || receipt.lineage_records_selection_relation_only !== true
        || receipt.longitudinal_case_activation_caused_selection_claimed !== false
        || receipt.retained_longitudinal_case_caused_candidate_generation_claimed !== false
        || receipt.retained_admission_is_effectiveness_claim !== false
        || receipt.retained_admission_is_success_claim !== false
        || receipt.historical_counterfactual_truth_evaluated !== false
        || receipt.action_outcome_observed !== false
        || receipt.longitudinal_case_effectiveness_inferred !== false
        || receipt.causal_or_outcome_credit_assigned !== false
        || receipt.success_failure_learning_performed !== false
        || receipt.preference_revision_performed !== false
        || receipt.belief_revision_performed !== false
        || receipt.semantic_revision_performed !== false
        || receipt.subjective_memory_rewrite_performed !== false
        || receipt.world_state_mutated !== false
        || receipt.world_truth_authority !== false
        || !text(receipt.receipt_id)
        || !text(receipt.receipt_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_RECEIPT_INVALID",
        "Phase82G contains an invalid or over-authoritative selected-action lineage receipt.",
      );
    }
    if (canonical) {
      const choice = canonical.choicesById.get(receipt.phase74d_choice_receipt_id);
      const phase82f = canonical.phase82fByHash.get(receipt.phase82f_projection_hash);
      const intent = phase82f?.deliberative_reuse_intents
        ?.find((item) => item.deliberative_reuse_intent_ref === receipt.deliberative_reuse_intent_ref);
      if (!choice
          || !phase82f
          || !intent
          || choice.receipt_hash !== receipt.phase74d_choice_receipt_hash
          || choice.character !== receipt.character
          || choice.selection_kind !== receipt.selection_kind
          || choice.action_id !== receipt.action_id
          || choice.action_ref !== receipt.action_ref
          || phase82f.character !== receipt.character
          || phase82f.source_phase82e_projection_hash !== receipt.source_phase82e_projection_hash
          || intent.deliberative_reuse_intent_hash !== receipt.deliberative_reuse_intent_hash
          || intent.source_reentry_candidate_ref !== receipt.source_reentry_candidate_ref
          || intent.source_reentry_candidate_hash !== receipt.source_reentry_candidate_hash
          || intent.source_phase82d_admission_ref !== receipt.source_phase82d_admission_ref
          || intent.source_phase82d_admission_hash !== receipt.source_phase82d_admission_hash
          || intent.current_phase81n_projection_hash !== receipt.current_phase81n_projection_hash
          || intent.current_action_id !== receipt.action_id
          || intent.current_action_ref !== receipt.action_ref) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
          "Phase82G receipt no longer matches its exact Phase82F activation and Phase74D selected action.",
        );
      }
    }
    const identity = cloneJson(receipt);
    for (const key of [
      "receipt_id",
      "receipt_hash",
      "selected_action_matches_phase82f_current_action",
      "lineage_records_selection_relation_only",
      "longitudinal_case_activation_caused_selection_claimed",
      "retained_longitudinal_case_caused_candidate_generation_claimed",
      "retained_admission_is_effectiveness_claim",
      "retained_admission_is_success_claim",
      "historical_counterfactual_truth_evaluated",
      "action_outcome_observed",
      "longitudinal_case_effectiveness_inferred",
      "causal_or_outcome_credit_assigned",
      "success_failure_learning_performed",
      "preference_revision_performed",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (receipt.receipt_hash !== expectedHash
        || receipt.receipt_id !== `phase82g_selected_relation_${expectedHash.slice(0, 24)}`
        || seen.has(receipt.receipt_id)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_RECEIPT_HASH_MISMATCH",
        "Phase82G selected-action lineage receipt identity verification failed.",
      );
    }
    seen.add(receipt.receipt_id);
  }

  if (bundle.audit.exact_phase82e_phase82f_lineage_verified !== true
      || bundle.audit.exact_phase74d_selected_action_lineage_verified !== true
      || bundle.audit.lineage_records_selection_relation_only !== true
      || bundle.audit.longitudinal_case_activation_caused_selection_claimed !== false
      || bundle.audit.retained_longitudinal_case_caused_candidate_generation_claimed !== false
      || bundle.audit.retained_admission_interpreted_as_effectiveness !== false
      || bundle.audit.retained_admission_interpreted_as_success !== false
      || bundle.audit.historical_counterfactual_truth_evaluated !== false
      || bundle.audit.action_outcome_consumed !== false
      || bundle.audit.longitudinal_case_effectiveness_inferred !== false
      || bundle.audit.causal_or_outcome_credit_assigned !== false
      || bundle.audit.success_failure_learning_performed !== false
      || bundle.audit.preference_revision_performed !== false
      || bundle.audit.belief_revision_performed !== false
      || bundle.audit.semantic_revision_performed !== false
      || bundle.audit.subjective_memory_rewrite_performed !== false
      || bundle.audit.world_state_mutated !== false
      || bundle.audit.world_truth_authority_claimed !== false
      || bundle.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || bundle.persistence_boundary.blocked_or_failed_turn_persists_receipt !== false
      || bundle.persistence_boundary.append_only_world_history_only !== true
      || bundle.persistence_boundary.receipt_does_not_mutate_world_state !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_BOUNDARY_INVALID",
      "Phase82G bundle violates its authority or persistence boundary.",
    );
  }
  return Object.freeze(bundle);
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineage(
  input = {},
) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_INPUT_INVALID",
      "Phase82G state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const choices = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    input.subjective_choice_commitment_receipts,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  const phase82e =
    assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseReentryProjection(
      input.counterfactual_linked_experience_longitudinal_case_reentry,
      {
        world_simulation_session_id: worldSimulationSessionId,
        current_turn_id: turnId,
        current_state_revision: input.state_revision,
        current_world_state_hash: worldStateHash,
        world_history: input.world_history,
        counterfactual_linked_experience_reuse_outcome_reentry_projections:
          input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
      },
    );
  const phase82fRaw = array(
    input.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections,
  );
  if (phase82fRaw.length > maximumProjectionCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase82G accepts at most ${maximumProjectionCount} Phase82F projections per turn.`,
    );
  }

  const phase82fByCharacter = new Map();
  const canonicalPhase82F = [];
  for (const raw of phase82fRaw) {
    const projection =
      assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseProjection(
        raw,
        {
          character: raw?.character,
          source_phase82e_projection: phase82e,
          expected_source: {
            world_history: input.world_history,
            counterfactual_linked_experience_reuse_outcome_reentry_projections:
              input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
          },
        },
      );
    if (projection.version
          !== worldSimulationCounterfactualLinkedExperienceLongitudinalCaseDeliberativeReuseVersion
        || phase82fByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase82G accepts at most one canonical Phase82F projection per character: ${projection.character}.`,
      );
    }
    phase82fByCharacter.set(projection.character, projection);
    canonicalPhase82F.push(projection);
  }

  const receipts = [];
  for (const choice of choices.receipts) {
    if (choice.selection_kind !== "candidate_action_intent") continue;
    const phase82f = phase82fByCharacter.get(choice.character);
    if (!phase82f) continue;
    for (const intent of phase82f.deliberative_reuse_intents) {
      if (intent.current_action_id !== choice.action_id
          || intent.current_action_ref !== choice.action_ref) continue;
      const identity = {
        version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        character: choice.character,
        phase82f_projection_hash: phase82f.projection_hash,
        source_phase82e_projection_hash: phase82f.source_phase82e_projection_hash,
        deliberative_reuse_intent_ref: intent.deliberative_reuse_intent_ref,
        deliberative_reuse_intent_hash: intent.deliberative_reuse_intent_hash,
        source_reentry_candidate_ref: intent.source_reentry_candidate_ref,
        source_reentry_candidate_hash: intent.source_reentry_candidate_hash,
        source_phase82d_projection_hash: intent.source_phase82d_projection_hash,
        source_phase82d_admission_ref: intent.source_phase82d_admission_ref,
        source_phase82d_admission_hash: intent.source_phase82d_admission_hash,
        source_phase82c_projection_hash: intent.source_phase82c_projection_hash,
        source_phase82c_appraisal_ref: intent.source_phase82c_appraisal_ref,
        source_phase82c_appraisal_hash: intent.source_phase82c_appraisal_hash,
        source_phase81m_capsule_ref: intent.source_phase81m_capsule_ref,
        reuse_intent_ref: intent.reuse_intent_ref,
        current_phase81n_projection_hash: intent.current_phase81n_projection_hash,
        phase74d_choice_receipt_version: choice.version,
        phase74d_choice_receipt_id: choice.receipt_id,
        phase74d_choice_receipt_hash: choice.receipt_hash,
        selection_kind: choice.selection_kind,
        action_id: choice.action_id,
        action_ref: choice.action_ref,
        selection_relation: "selected_action_matches_longitudinal_case_deliberative_reuse_intent",
      };
      const receiptHash = hashAgentRunValue(identity);
      receipts.push({
        receipt_id: `phase82g_selected_relation_${receiptHash.slice(0, 24)}`,
        receipt_hash: receiptHash,
        ...identity,
        selected_action_matches_phase82f_current_action: true,
        lineage_records_selection_relation_only: true,
        longitudinal_case_activation_caused_selection_claimed: false,
        retained_longitudinal_case_caused_candidate_generation_claimed: false,
        retained_admission_is_effectiveness_claim: false,
        retained_admission_is_success_claim: false,
        historical_counterfactual_truth_evaluated: false,
        action_outcome_observed: false,
        longitudinal_case_effectiveness_inferred: false,
        causal_or_outcome_credit_assigned: false,
        success_failure_learning_performed: false,
        preference_revision_performed: false,
        belief_revision_performed: false,
        semantic_revision_performed: false,
        subjective_memory_rewrite_performed: false,
        world_state_mutated: false,
        world_truth_authority: false,
      });
    }
  }
  receipts.sort((left, right) => compareText(left.receipt_id, right.receipt_id));
  if (receipts.length > maximumReceiptCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_CASE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase82G accepts at most ${maximumReceiptCount} selected-action lineage receipts per turn.`,
    );
  }

  const bundle = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageVersion,
    phase: "Phase82G",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: choices.receipt_bundle_hash,
    source_phase82e_projection_hash: phase82e.projection_hash,
    source_phase82f_projection_hashes:
      canonicalPhase82F.map((projection) => projection.projection_hash).sort(compareText),
    receipt_count: receipts.length,
    receipts,
    audit: {
      exact_phase82e_phase82f_lineage_verified: true,
      exact_phase74d_selected_action_lineage_verified: true,
      lineage_records_selection_relation_only: true,
      longitudinal_case_activation_caused_selection_claimed: false,
      retained_longitudinal_case_caused_candidate_generation_claimed: false,
      retained_admission_interpreted_as_effectiveness: false,
      retained_admission_interpreted_as_success: false,
      historical_counterfactual_truth_evaluated: false,
      action_outcome_consumed: false,
      longitudinal_case_effectiveness_inferred: false,
      causal_or_outcome_credit_assigned: false,
      success_failure_learning_performed: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_only: true,
      receipt_does_not_mutate_world_state: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalCaseSelectedActionLineageBundle(
    bundle,
    {
      subjective_choice_commitment_receipts: choices,
      counterfactual_linked_experience_longitudinal_case_reentry: phase82e,
      counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:
        canonicalPhase82F,
      counterfactual_linked_experience_reuse_outcome_reentry_projections:
        input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
      world_history: input.world_history,
    },
  );
}
