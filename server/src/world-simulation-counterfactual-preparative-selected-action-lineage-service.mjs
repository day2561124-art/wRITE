import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  assertWorldSimulationCounterfactualReflectionReentryProjection,
} from "./world-simulation-counterfactual-reflection-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeRevalidationProjection,
  worldSimulationCounterfactualPreparativeRevalidationVersion,
} from "./world-simulation-counterfactual-preparative-revalidation-service.mjs";

export const worldSimulationCounterfactualPreparativeSelectedActionLineageVersion =
  "phase81f-counterfactual-preparative-selected-action-lineage-v1";

const maximumProjectionCount = 32;
const maximumReceiptCount = 32;
const applicabilityJudgments = new Set([
  "currently_applicable_as_deliberative_evidence",
  "currently_not_applicable_as_deliberative_evidence",
  "current_applicability_unresolved",
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

function requiredText(value, label, maxLength = 512) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`${label} must be a bounded non-empty string.`);
    error.code = "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_INPUT_INVALID";
    throw error;
  }
  return normalized;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function compareText(left, right) {
  return String(left).localeCompare(String(right));
}

function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}

function relationKind(applicability) {
  if (applicability === "currently_applicable_as_deliberative_evidence") {
    return "selected_action_matches_currently_applicable_counterfactual_advisory";
  }
  if (applicability === "currently_not_applicable_as_deliberative_evidence") {
    return "selected_action_matches_currently_nonapplicable_counterfactual_advisory";
  }
  return "selected_action_matches_unresolved_counterfactual_advisory";
}

export function buildWorldSimulationCounterfactualPreparativeSelectedActionLineageContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
    phase: "Phase81F",
    status: "counterfactual_advisory_to_selected_action_lineage_installed",
    source_revalidation_owner: "Phase81E",
    source_choice_owner: "Phase74D",
    exact_phase81d_phase81e_lineage_required: true,
    exact_phase74d_choice_receipt_required: true,
    same_character_same_turn_required: true,
    selected_action_id_and_ref_must_match_phase81e_current_action: true,
    all_phase81e_applicability_judgments_preserved_without_reinterpretation: true,
    lineage_records_selection_relation_only: true,
    counterfactual_advisory_caused_selection_claimed: false,
    counterfactual_caused_candidate_generation_claimed: false,
    historical_alternative_experienced: false,
    unchosen_outcome_observed: false,
    action_outcome_consumed: false,
    outcome_credit_assigned: false,
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

export function assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(
  value,
  expected = {},
) {
  const bundle = cloneJson(value);
  if (!isObject(bundle)
      || bundle.version !== worldSimulationCounterfactualPreparativeSelectedActionLineageVersion
      || bundle.phase !== "Phase81F"
      || !text(bundle.world_simulation_session_id)
      || !text(bundle.turn_id)
      || !Number.isSafeInteger(bundle.state_revision)
      || bundle.state_revision < 0
      || !text(bundle.world_state_hash)
      || !text(bundle.source_phase74d_receipt_bundle_hash)
      || !Array.isArray(bundle.source_phase81e_projection_hashes)
      || new Set(bundle.source_phase81e_projection_hashes).size
        !== bundle.source_phase81e_projection_hashes.length
      || bundle.source_phase81e_projection_hashes.some((hash) => !text(hash))
      || !Array.isArray(bundle.receipts)
      || bundle.receipt_count !== bundle.receipts.length
      || bundle.receipt_count > maximumReceiptCount
      || !isObject(bundle.audit)
      || !isObject(bundle.persistence_boundary)
      || !text(bundle.receipt_bundle_hash)
      || hashWithout(bundle, "receipt_bundle_hash") !== bundle.receipt_bundle_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_BUNDLE_INVALID",
      "Phase81F counterfactual advisory-to-selected-action lineage bundle is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && bundle[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
        `Phase81F bundle ${key} does not match expected lineage.`,
      );
    }
  }
  let expectedChoiceById = null;
  let expectedPhase81EByHash = null;
  const expectedSourceFieldCount = [
    expected.subjective_choice_commitment_receipts,
    expected.counterfactual_preparative_revalidation_projections,
    expected.counterfactual_reflection_reentry_projections,
  ].filter((value) => value !== undefined).length;
  if (expectedSourceFieldCount > 0 && expectedSourceFieldCount !== 3) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_EXPECTED_SOURCE_SET_INCOMPLETE",
      "Phase81F exact-source validation requires Phase74D, Phase81D, and Phase81E sources together.",
    );
  }
  if (expectedSourceFieldCount === 3) {
    const expectedChoiceBundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
      expected.subjective_choice_commitment_receipts,
      {
        world_simulation_session_id: bundle.world_simulation_session_id,
        turn_id: bundle.turn_id,
        state_revision: bundle.state_revision,
        world_state_hash: bundle.world_state_hash,
      },
    );
    if (bundle.source_phase74d_receipt_bundle_hash !== expectedChoiceBundle.receipt_bundle_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
        "Phase81F no longer matches the exact Phase74D choice receipt bundle.",
      );
    }
    expectedChoiceById = new Map(
      expectedChoiceBundle.receipts.map((receipt) => [receipt.receipt_id, receipt]),
    );
    const phase81DByCharacter = new Map();
    for (const raw of array(expected.counterfactual_reflection_reentry_projections)) {
      const projection = assertWorldSimulationCounterfactualReflectionReentryProjection(raw, {
        world_simulation_session_id: bundle.world_simulation_session_id,
        current_turn_id: bundle.turn_id,
        current_state_revision: bundle.state_revision,
        current_world_state_hash: bundle.world_state_hash,
      });
      if (phase81DByCharacter.has(projection.character)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
          `Phase81F expected sources contain duplicate Phase81D character ${projection.character}.`,
        );
      }
      phase81DByCharacter.set(projection.character, projection);
    }
    expectedPhase81EByHash = new Map();
    for (const raw of array(expected.counterfactual_preparative_revalidation_projections)) {
      const source = phase81DByCharacter.get(raw?.character);
      if (!source) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_PHASE81D_REQUIRED",
          "Phase81F expected Phase81E source is missing its exact Phase81D lineage.",
        );
      }
      const projection = assertWorldSimulationCounterfactualPreparativeRevalidationProjection(raw, {
        source_phase81d_projection: source,
      });
      expectedPhase81EByHash.set(projection.projection_hash, projection);
    }
    const expectedHashes = [...expectedPhase81EByHash.keys()].sort(compareText);
    if (hashAgentRunValue(bundle.source_phase81e_projection_hashes)
        !== hashAgentRunValue(expectedHashes)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
        "Phase81F source Phase81E projection set no longer matches exact expected lineage.",
      );
    }
  }
  const seen = new Set();
  for (const receipt of bundle.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationCounterfactualPreparativeSelectedActionLineageVersion
        || receipt.world_simulation_session_id !== bundle.world_simulation_session_id
        || receipt.turn_id !== bundle.turn_id
        || receipt.state_revision !== bundle.state_revision
        || receipt.world_state_hash !== bundle.world_state_hash
        || !text(receipt.character)
        || !text(receipt.phase81e_projection_hash)
        || !bundle.source_phase81e_projection_hashes.includes(receipt.phase81e_projection_hash)
        || !text(receipt.source_phase81d_projection_hash)
        || !text(receipt.revalidation_judgment_ref)
        || !text(receipt.revalidation_judgment_hash)
        || !text(receipt.source_reentry_candidate_ref)
        || !text(receipt.source_reentry_candidate_hash)
        || !text(receipt.phase74d_choice_receipt_id)
        || !text(receipt.phase74d_choice_receipt_hash)
        || receipt.phase74d_choice_receipt_version
          !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
        || receipt.selection_kind !== "candidate_action_intent"
        || !text(receipt.action_id)
        || !text(receipt.action_ref)
        || !applicabilityJudgments.has(receipt.applicability_judgment)
        || receipt.selection_relation !== relationKind(receipt.applicability_judgment)
        || !text(receipt.historical_preparative_orientation)
        || receipt.historical_preparative_orientation === "no_preparative_takeaway"
        || !isObject(receipt.source_monitoring)
        || receipt.source_monitoring.sources_may_not_be_collapsed !== true
        || receipt.selected_action_matches_phase81e_current_action !== true
        || receipt.lineage_records_selection_relation_only !== true
        || receipt.counterfactual_advisory_caused_selection_claimed !== false
        || receipt.counterfactual_caused_candidate_generation_claimed !== false
        || receipt.historical_alternative_was_experienced !== false
        || receipt.historical_unchosen_outcome_observed !== false
        || receipt.counterfactual_world_truth_claimed !== false
        || receipt.action_outcome_observed !== false
        || receipt.outcome_credit_assigned !== false
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
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_RECEIPT_INVALID",
        "Phase81F contains an invalid or over-authoritative selected-action lineage receipt.",
      );
    }
    if (expectedChoiceById && expectedPhase81EByHash) {
      const choice = expectedChoiceById.get(receipt.phase74d_choice_receipt_id);
      const phase81E = expectedPhase81EByHash.get(receipt.phase81e_projection_hash);
      const judgment = phase81E?.revalidation_judgments
        ?.find((item) => item.revalidation_judgment_ref === receipt.revalidation_judgment_ref);
      if (!choice
          || !phase81E
          || !judgment
          || choice.receipt_hash !== receipt.phase74d_choice_receipt_hash
          || choice.character !== receipt.character
          || choice.selection_kind !== receipt.selection_kind
          || choice.action_id !== receipt.action_id
          || choice.action_ref !== receipt.action_ref
          || phase81E.character !== receipt.character
          || phase81E.source_phase81d_projection_hash !== receipt.source_phase81d_projection_hash
          || judgment.revalidation_judgment_hash !== receipt.revalidation_judgment_hash
          || judgment.source_reentry_candidate_ref !== receipt.source_reentry_candidate_ref
          || judgment.source_reentry_candidate_hash !== receipt.source_reentry_candidate_hash
          || judgment.current_action_id !== receipt.action_id
          || judgment.current_action_ref !== receipt.action_ref
          || judgment.historical_actual_selected_action_id
            !== receipt.historical_actual_selected_action_id
          || judgment.historical_imagined_alternative_action_id
            !== receipt.historical_imagined_alternative_action_id
          || judgment.historical_comparison_direction !== receipt.historical_comparison_direction
          || judgment.historical_appraisal_kind !== receipt.historical_appraisal_kind
          || judgment.historical_preparative_orientation
            !== receipt.historical_preparative_orientation
          || judgment.applicability_judgment !== receipt.applicability_judgment
          || hashAgentRunValue(judgment.source_monitoring)
            !== hashAgentRunValue(receipt.source_monitoring)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
          "Phase81F receipt no longer matches its exact Phase81E judgment and Phase74D selected action.",
        );
      }
    }
    const identity = cloneJson(receipt);
    for (const key of [
      "receipt_id",
      "receipt_hash",
      "selected_action_matches_phase81e_current_action",
      "lineage_records_selection_relation_only",
      "counterfactual_advisory_caused_selection_claimed",
      "counterfactual_caused_candidate_generation_claimed",
      "historical_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "counterfactual_world_truth_claimed",
      "action_outcome_observed",
      "outcome_credit_assigned",
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
        || receipt.receipt_id !== `phase81f_selected_relation_${expectedHash.slice(0, 24)}`
        || seen.has(receipt.receipt_id)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_RECEIPT_HASH_MISMATCH",
        "Phase81F selected-action lineage receipt identity verification failed.",
      );
    }
    seen.add(receipt.receipt_id);
  }
  if (bundle.audit.exact_phase81d_phase81e_lineage_verified !== true
      || bundle.audit.exact_phase74d_selected_action_lineage_verified !== true
      || bundle.audit.lineage_records_selection_relation_only !== true
      || bundle.audit.counterfactual_advisory_caused_selection_claimed !== false
      || bundle.audit.historical_alternative_experienced !== false
      || bundle.audit.unchosen_outcome_observed !== false
      || bundle.audit.action_outcome_consumed !== false
      || bundle.audit.outcome_credit_assigned !== false
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
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_BOUNDARY_INVALID",
      "Phase81F bundle violates its authority or persistence boundary.",
    );
  }
  return Object.freeze(bundle);
}

export function buildWorldSimulationCounterfactualPreparativeSelectedActionLineage(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_INPUT_INVALID",
      "Phase81F state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const choiceBundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    input.subjective_choice_commitment_receipts,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  const phase81DProjections = array(input.counterfactual_reflection_reentry_projections);
  const phase81EProjections = array(input.counterfactual_preparative_revalidation_projections);
  if (phase81DProjections.length > maximumProjectionCount
      || phase81EProjections.length > maximumProjectionCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase81F accepts at most ${maximumProjectionCount} Phase81D/81E projections per turn.`,
    );
  }
  const phase81DByCharacter = new Map();
  for (const raw of phase81DProjections) {
    const projection = assertWorldSimulationCounterfactualReflectionReentryProjection(raw, {
      world_simulation_session_id: worldSimulationSessionId,
      current_turn_id: turnId,
      current_state_revision: input.state_revision,
      current_world_state_hash: worldStateHash,
    });
    if (phase81DByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81F accepts at most one Phase81D projection per character: ${projection.character}.`,
      );
    }
    phase81DByCharacter.set(projection.character, projection);
  }
  const phase81EByCharacter = new Map();
  for (const raw of phase81EProjections) {
    const sourcePhase81D = phase81DByCharacter.get(raw?.character);
    if (!sourcePhase81D) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_PHASE81D_REQUIRED",
        "Phase81F requires the exact same-character Phase81D source for every Phase81E projection.",
      );
    }
    const projection = assertWorldSimulationCounterfactualPreparativeRevalidationProjection(raw, {
      source_phase81d_projection: sourcePhase81D,
    });
    if (projection.current_turn_id !== turnId) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_MISMATCH",
        "Phase81F Phase81E projection turn does not match current committed choice lineage.",
      );
    }
    if (phase81EByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81F accepts at most one Phase81E projection per character: ${projection.character}.`,
      );
    }
    phase81EByCharacter.set(projection.character, projection);
  }

  const receipts = [];
  for (const choice of choiceBundle.receipts) {
    if (choice.selection_kind !== "candidate_action_intent") continue;
    const phase81E = phase81EByCharacter.get(choice.character);
    if (!phase81E) continue;
    for (const judgment of phase81E.revalidation_judgments) {
      if (judgment.current_action_id !== choice.action_id
          || judgment.current_action_ref !== choice.action_ref) continue;
      const identity = {
        version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        character: choice.character,
        phase81e_projection_hash: phase81E.projection_hash,
        source_phase81d_projection_hash: phase81E.source_phase81d_projection_hash,
        revalidation_judgment_ref: judgment.revalidation_judgment_ref,
        revalidation_judgment_hash: judgment.revalidation_judgment_hash,
        source_reentry_candidate_ref: judgment.source_reentry_candidate_ref,
        source_reentry_candidate_hash: judgment.source_reentry_candidate_hash,
        historical_actual_selected_action_id:
          judgment.historical_actual_selected_action_id,
        historical_imagined_alternative_action_id:
          judgment.historical_imagined_alternative_action_id,
        historical_comparison_direction: judgment.historical_comparison_direction,
        historical_appraisal_kind: judgment.historical_appraisal_kind,
        historical_preparative_orientation: judgment.historical_preparative_orientation,
        applicability_judgment: judgment.applicability_judgment,
        selection_relation: relationKind(judgment.applicability_judgment),
        phase74d_choice_receipt_version: choice.version,
        phase74d_choice_receipt_id: choice.receipt_id,
        phase74d_choice_receipt_hash: choice.receipt_hash,
        selection_kind: choice.selection_kind,
        action_id: choice.action_id,
        action_ref: choice.action_ref,
        source_monitoring: cloneJson(judgment.source_monitoring),
      };
      const receiptHash = hashAgentRunValue(identity);
      receipts.push({
        receipt_id: `phase81f_selected_relation_${receiptHash.slice(0, 24)}`,
        receipt_hash: receiptHash,
        ...identity,
        selected_action_matches_phase81e_current_action: true,
        lineage_records_selection_relation_only: true,
        counterfactual_advisory_caused_selection_claimed: false,
        counterfactual_caused_candidate_generation_claimed: false,
        historical_alternative_was_experienced: false,
        historical_unchosen_outcome_observed: false,
        counterfactual_world_truth_claimed: false,
        action_outcome_observed: false,
        outcome_credit_assigned: false,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase81F accepts at most ${maximumReceiptCount} selected-action lineage receipts per turn.`,
    );
  }
  const bundle = {
    version: worldSimulationCounterfactualPreparativeSelectedActionLineageVersion,
    phase: "Phase81F",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: choiceBundle.receipt_bundle_hash,
    source_phase81e_projection_hashes: [...phase81EByCharacter.values()]
      .map((projection) => projection.projection_hash)
      .sort(compareText),
    receipt_count: receipts.length,
    receipts,
    audit: {
      exact_phase81d_phase81e_lineage_verified: true,
      exact_phase74d_selected_action_lineage_verified: true,
      lineage_records_selection_relation_only: true,
      counterfactual_advisory_caused_selection_claimed: false,
      historical_alternative_experienced: false,
      unchosen_outcome_observed: false,
      action_outcome_consumed: false,
      outcome_credit_assigned: false,
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
      future_outcome_interpretation_requires_separate_phase: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationCounterfactualPreparativeSelectedActionLineageBundle(bundle, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    subjective_choice_commitment_receipts: choiceBundle,
    counterfactual_reflection_reentry_projections: phase81DProjections,
    counterfactual_preparative_revalidation_projections: phase81EProjections,
  });
}
