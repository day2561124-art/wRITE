import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
  worldSimulationSubjectiveChoiceCommitmentReceiptVersion,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReentryProjection,
} from "./world-simulation-counterfactual-linked-experience-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseProjection,
  worldSimulationCounterfactualLinkedExperienceReuseVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion =
  "phase81k-counterfactual-linked-experience-selected-action-lineage-v1";

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

function requiredText(value, label, maxLength = 512) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_INPUT_INVALID",
      `${label} must be a bounded non-empty string.`,
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
  return String(left).localeCompare(String(right));
}

function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}

export function buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
    phase: "Phase81K",
    status: "counterfactual_linked_reuse_intent_to_selected_action_lineage_installed",
    source_reuse_owner: "Phase81J",
    source_reentry_owner: "Phase81I",
    source_choice_owner: "Phase74D",
    exact_phase81i_phase81j_lineage_required: true,
    exact_phase74d_choice_receipt_required: true,
    canonical_prior_world_history_required_for_phase81i_validation: true,
    same_character_same_turn_required: true,
    selected_action_id_and_ref_must_match_phase81j_current_action: true,
    reuse_intent_omission_means_no_lineage_receipt: true,
    lineage_records_selection_relation_only: true,
    reuse_intent_caused_selection_claimed: false,
    counterfactual_case_caused_candidate_generation_claimed: false,
    historical_subjective_outcome_is_current_world_truth: false,
    historical_counterfactual_truth_evaluated: false,
    action_outcome_consumed: false,
    advisory_effectiveness_inferred: false,
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

function exactSources(expected, bundle) {
  const supplied = [
    expected.subjective_choice_commitment_receipts,
    expected.counterfactual_linked_experience_reentry_projections,
    expected.counterfactual_linked_experience_reuse_projections,
    expected.world_history,
  ];
  const suppliedCount = supplied.filter((value) => value !== undefined).length;
  if (suppliedCount === 0) return null;
  if (suppliedCount !== supplied.length) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_EXPECTED_SOURCE_SET_INCOMPLETE",
      "Phase81K exact-source validation requires Phase74D, Phase81I, Phase81J, and canonical prior World History together.",
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
      "Phase81K no longer matches the exact Phase74D selected-action receipt bundle.",
    );
  }

  const phase81IByCharacter = new Map();
  for (const raw of array(expected.counterfactual_linked_experience_reentry_projections)) {
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(raw, {
      world_simulation_session_id: bundle.world_simulation_session_id,
      current_turn_id: bundle.turn_id,
      current_state_revision: bundle.state_revision,
      current_world_state_hash: bundle.world_state_hash,
      world_history: expected.world_history,
    });
    if (phase81IByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81K expected sources contain duplicate Phase81I character ${projection.character}.`,
      );
    }
    phase81IByCharacter.set(projection.character, projection);
  }

  const phase81JByHash = new Map();
  const phase81JByCharacter = new Map();
  for (const raw of array(expected.counterfactual_linked_experience_reuse_projections)) {
    const sourcePhase81I = phase81IByCharacter.get(raw?.character);
    if (!sourcePhase81I) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_PHASE81I_REQUIRED",
        "Phase81K expected Phase81J source is missing its exact same-character Phase81I lineage.",
      );
    }
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(raw, {
      source_phase81i_projection: sourcePhase81I,
      expected_source: { world_history: expected.world_history },
    });
    if (phase81JByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81K expected sources contain duplicate Phase81J character ${projection.character}.`,
      );
    }
    phase81JByCharacter.set(projection.character, projection);
    phase81JByHash.set(projection.projection_hash, projection);
  }

  const expectedHashes = [...phase81JByHash.keys()].sort(compareText);
  if (hashAgentRunValue(bundle.source_phase81j_projection_hashes)
      !== hashAgentRunValue(expectedHashes)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
      "Phase81K source Phase81J projection set no longer matches exact expected lineage.",
    );
  }

  return {
    choicesById: new Map(choices.receipts.map((receipt) => [receipt.receipt_id, receipt])),
    phase81JByHash,
  };
}

export function assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(
  value,
  expected = {},
) {
  const bundle = cloneJson(value);
  if (!isObject(bundle)
      || bundle.version !== worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion
      || bundle.phase !== "Phase81K"
      || !text(bundle.world_simulation_session_id)
      || !text(bundle.turn_id)
      || !Number.isSafeInteger(bundle.state_revision)
      || bundle.state_revision < 0
      || !text(bundle.world_state_hash)
      || !text(bundle.source_phase74d_receipt_bundle_hash)
      || !Array.isArray(bundle.source_phase81j_projection_hashes)
      || new Set(bundle.source_phase81j_projection_hashes).size
        !== bundle.source_phase81j_projection_hashes.length
      || bundle.source_phase81j_projection_hashes.some((hash) => !text(hash))
      || !Array.isArray(bundle.receipts)
      || bundle.receipt_count !== bundle.receipts.length
      || bundle.receipt_count > maximumReceiptCount
      || !isObject(bundle.audit)
      || !isObject(bundle.persistence_boundary)
      || !text(bundle.receipt_bundle_hash)
      || hashWithout(bundle, "receipt_bundle_hash") !== bundle.receipt_bundle_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_BUNDLE_INVALID",
      "Phase81K counterfactual-linked reuse-intent selected-action lineage bundle is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && bundle[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
        `Phase81K bundle ${key} does not match expected lineage.`,
      );
    }
  }

  const canonical = exactSources(expected, bundle);
  const seen = new Set();
  for (const receipt of bundle.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion
        || receipt.world_simulation_session_id !== bundle.world_simulation_session_id
        || receipt.turn_id !== bundle.turn_id
        || receipt.state_revision !== bundle.state_revision
        || receipt.world_state_hash !== bundle.world_state_hash
        || !text(receipt.character)
        || !text(receipt.phase81j_projection_hash)
        || !bundle.source_phase81j_projection_hashes.includes(receipt.phase81j_projection_hash)
        || !text(receipt.source_phase81i_projection_hash)
        || !text(receipt.reuse_intent_ref)
        || !text(receipt.reuse_intent_hash)
        || !text(receipt.source_reentry_candidate_ref)
        || !text(receipt.source_reentry_candidate_hash)
        || !text(receipt.phase74d_choice_receipt_id)
        || !text(receipt.phase74d_choice_receipt_hash)
        || receipt.phase74d_choice_receipt_version
          !== worldSimulationSubjectiveChoiceCommitmentReceiptVersion
        || receipt.selection_kind !== "candidate_action_intent"
        || !text(receipt.action_id)
        || !text(receipt.action_ref)
        || receipt.selection_relation
          !== "selected_action_matches_counterfactual_linked_reuse_intent"
        || receipt.selected_action_matches_phase81j_current_action !== true
        || receipt.lineage_records_selection_relation_only !== true
        || receipt.reuse_intent_caused_selection_claimed !== false
        || receipt.counterfactual_case_caused_candidate_generation_claimed !== false
        || receipt.historical_subjective_outcome_is_current_world_truth !== false
        || receipt.historical_counterfactual_truth_evaluated !== false
        || receipt.action_outcome_observed !== false
        || receipt.advisory_effectiveness_inferred !== false
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_RECEIPT_INVALID",
        "Phase81K contains an invalid or over-authoritative selected-action lineage receipt.",
      );
    }

    if (canonical) {
      const choice = canonical.choicesById.get(receipt.phase74d_choice_receipt_id);
      const phase81J = canonical.phase81JByHash.get(receipt.phase81j_projection_hash);
      const intent = phase81J?.reuse_intents
        ?.find((item) => item.reuse_intent_ref === receipt.reuse_intent_ref);
      if (!choice
          || !phase81J
          || !intent
          || choice.receipt_hash !== receipt.phase74d_choice_receipt_hash
          || choice.character !== receipt.character
          || choice.selection_kind !== receipt.selection_kind
          || choice.action_id !== receipt.action_id
          || choice.action_ref !== receipt.action_ref
          || phase81J.character !== receipt.character
          || phase81J.source_phase81i_projection_hash !== receipt.source_phase81i_projection_hash
          || intent.reuse_intent_hash !== receipt.reuse_intent_hash
          || intent.source_reentry_candidate_ref !== receipt.source_reentry_candidate_ref
          || intent.source_reentry_candidate_hash !== receipt.source_reentry_candidate_hash
          || intent.current_action_id !== receipt.action_id
          || intent.current_action_ref !== receipt.action_ref) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_SOURCE_MISMATCH",
          "Phase81K receipt no longer matches its exact Phase81J reuse intent and Phase74D selected action.",
        );
      }
    }

    const identity = cloneJson(receipt);
    for (const key of [
      "receipt_id",
      "receipt_hash",
      "selected_action_matches_phase81j_current_action",
      "lineage_records_selection_relation_only",
      "reuse_intent_caused_selection_claimed",
      "counterfactual_case_caused_candidate_generation_claimed",
      "historical_subjective_outcome_is_current_world_truth",
      "historical_counterfactual_truth_evaluated",
      "action_outcome_observed",
      "advisory_effectiveness_inferred",
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
        || receipt.receipt_id !== `phase81k_selected_relation_${expectedHash.slice(0, 24)}`
        || seen.has(receipt.receipt_id)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_RECEIPT_HASH_MISMATCH",
        "Phase81K selected-action lineage receipt identity verification failed.",
      );
    }
    seen.add(receipt.receipt_id);
  }

  if (bundle.audit.exact_phase81i_phase81j_lineage_verified !== true
      || bundle.audit.exact_phase74d_selected_action_lineage_verified !== true
      || bundle.audit.lineage_records_selection_relation_only !== true
      || bundle.audit.reuse_intent_caused_selection_claimed !== false
      || bundle.audit.counterfactual_case_caused_candidate_generation_claimed !== false
      || bundle.audit.historical_subjective_outcome_is_current_world_truth !== false
      || bundle.audit.historical_counterfactual_truth_evaluated !== false
      || bundle.audit.action_outcome_consumed !== false
      || bundle.audit.advisory_effectiveness_inferred !== false
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_BOUNDARY_INVALID",
      "Phase81K bundle violates its authority or persistence boundary.",
    );
  }
  return Object.freeze(bundle);
}

export function buildWorldSimulationCounterfactualLinkedExperienceSelectedActionLineage(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_INPUT_INVALID",
      "Phase81K state_revision must be a non-negative safe integer.",
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

  const phase81IByCharacter = new Map();
  const phase81IProjections = array(input.counterfactual_linked_experience_reentry_projections);
  const phase81JProjections = array(input.counterfactual_linked_experience_reuse_projections);
  if (phase81IProjections.length > maximumProjectionCount
      || phase81JProjections.length > maximumProjectionCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase81K accepts at most ${maximumProjectionCount} Phase81I/81J projections per turn.`,
    );
  }
  for (const raw of phase81IProjections) {
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(raw, {
      world_simulation_session_id: worldSimulationSessionId,
      current_turn_id: turnId,
      current_state_revision: input.state_revision,
      current_world_state_hash: worldStateHash,
      world_history: input.world_history,
    });
    if (phase81IByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81K accepts at most one Phase81I projection per character: ${projection.character}.`,
      );
    }
    phase81IByCharacter.set(projection.character, projection);
  }

  const phase81JByCharacter = new Map();
  for (const raw of phase81JProjections) {
    const sourcePhase81I = phase81IByCharacter.get(raw?.character);
    if (!sourcePhase81I) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_PHASE81I_REQUIRED",
        "Phase81K requires the exact same-character Phase81I source for every Phase81J projection.",
      );
    }
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(raw, {
      source_phase81i_projection: sourcePhase81I,
      expected_source: { world_history: input.world_history },
    });
    if (phase81JByCharacter.has(projection.character)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_DUPLICATE_CHARACTER",
        `Phase81K accepts at most one Phase81J projection per character: ${projection.character}.`,
      );
    }
    phase81JByCharacter.set(projection.character, projection);
  }

  const receipts = [];
  for (const choice of choices.receipts) {
    if (choice.selection_kind !== "candidate_action_intent") continue;
    const phase81J = phase81JByCharacter.get(choice.character);
    if (!phase81J) continue;
    for (const intent of phase81J.reuse_intents) {
      if (intent.current_action_id !== choice.action_id
          || intent.current_action_ref !== choice.action_ref) continue;
      const identity = {
        version: worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        character: choice.character,
        phase81j_projection_hash: phase81J.projection_hash,
        source_phase81i_projection_hash: phase81J.source_phase81i_projection_hash,
        reuse_intent_ref: intent.reuse_intent_ref,
        reuse_intent_hash: intent.reuse_intent_hash,
        source_reentry_candidate_ref: intent.source_reentry_candidate_ref,
        source_reentry_candidate_hash: intent.source_reentry_candidate_hash,
        phase74d_choice_receipt_version: choice.version,
        phase74d_choice_receipt_id: choice.receipt_id,
        phase74d_choice_receipt_hash: choice.receipt_hash,
        selection_kind: choice.selection_kind,
        action_id: choice.action_id,
        action_ref: choice.action_ref,
        selection_relation: "selected_action_matches_counterfactual_linked_reuse_intent",
      };
      const receiptHash = hashAgentRunValue(identity);
      receipts.push({
        receipt_id: `phase81k_selected_relation_${receiptHash.slice(0, 24)}`,
        receipt_hash: receiptHash,
        ...identity,
        selected_action_matches_phase81j_current_action: true,
        lineage_records_selection_relation_only: true,
        reuse_intent_caused_selection_claimed: false,
        counterfactual_case_caused_candidate_generation_claimed: false,
        historical_subjective_outcome_is_current_world_truth: false,
        historical_counterfactual_truth_evaluated: false,
        action_outcome_observed: false,
        advisory_effectiveness_inferred: false,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_SELECTED_ACTION_LINEAGE_LIMIT_EXCEEDED",
      `Phase81K accepts at most ${maximumReceiptCount} selected-action lineage receipts per turn.`,
    );
  }

  const bundle = {
    version: worldSimulationCounterfactualLinkedExperienceSelectedActionLineageVersion,
    phase: "Phase81K",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: choices.receipt_bundle_hash,
    source_phase81j_projection_hashes:
      phase81JProjections.map((projection) => projection.projection_hash).sort(compareText),
    receipt_count: receipts.length,
    receipts,
    audit: {
      exact_phase81i_phase81j_lineage_verified: true,
      exact_phase74d_selected_action_lineage_verified: true,
      lineage_records_selection_relation_only: true,
      reuse_intent_caused_selection_claimed: false,
      counterfactual_case_caused_candidate_generation_claimed: false,
      historical_subjective_outcome_is_current_world_truth: false,
      historical_counterfactual_truth_evaluated: false,
      action_outcome_consumed: false,
      advisory_effectiveness_inferred: false,
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
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationCounterfactualLinkedExperienceSelectedActionLineageBundle(bundle, {
    subjective_choice_commitment_receipts: choices,
    counterfactual_linked_experience_reentry_projections: phase81IProjections,
    counterfactual_linked_experience_reuse_projections: phase81JProjections,
    world_history: input.world_history,
  });
}
