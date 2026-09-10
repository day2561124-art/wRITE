import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceRevalidationVersion,
} from "./world-simulation-analogical-experience-revalidation-service.mjs";
import {
  assertWorldSimulationSelectedExperientialMethodApplicationReceiptBundle,
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "./world-simulation-experiential-method-application-lineage-service.mjs";

export const worldSimulationAnalogicalExperienceApplicationLineageVersion =
  "phase80d-adapted-analogy-selected-application-lineage-v1";

const maximumLineageReceiptCount = 48;
const maximumProjectionCount = 16;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
  return isObject(value) ? value : {};
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`Phase80D ${label} is required and must be bounded.`);
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_INPUT_INVALID";
    throw error;
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredText(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function projectionHash(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function verifyPhase80C(value, expectedTurnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceRevalidationVersion
      || !text(projection.character)
      || projection.current_turn_id !== expectedTurnId
      || !Number.isInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !text(projection.current_world_state_hash)
      || !text(projection.source_phase79d_impasse_hash)
      || !text(projection.source_phase79e_evidence_hash)
      || !text(projection.source_phase80a_projection_hash)
      || !text(projection.source_phase80b_adaptation_hash)
      || !Array.isArray(projection.revalidated_adapted_methods)
      || projection.revalidated_method_count !== projection.revalidated_adapted_methods.length
      || projection.revalidated_method_count > maximumProjectionCount
      || !isObject(projection.character_view)
      || !Array.isArray(projection.character_view.adapted_methods)
      || hashAgentRunValue(projection.character_view.adapted_methods)
        !== hashAgentRunValue(projection.revalidated_adapted_methods)
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_INVALID",
      "Phase80D requires an exact canonical Phase80C revalidation projection.",
    );
  }
  const audit = object(projection.audit);
  if (projection.character_view.advisory_only !== true
      || projection.character_view.preference_authority !== false
      || projection.character_view.selected_action_authority !== false
      || projection.character_view.semantic_revision_authority !== false
      || projection.character_view.world_truth_authority !== false
      || audit.exact_phase79d_source_verified !== true
      || audit.exact_phase79e_source_verified !== true
      || audit.exact_phase80a_source_verified !== true
      || audit.exact_phase80b_source_verified !== true
      || audit.current_corresponding_method_identity_reverified !== true
      || audit.additional_resolver_used !== false
      || audit.preference_resolution_performed !== false
      || audit.action_selection_performed !== false
      || audit.direct_plan_goal_belief_current_mind_world_mutation_performed !== false
      || audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false
      || audit.fuzzy_semantic_similarity_used !== false
      || audit.world_truth_authority_claimed !== false) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_BOUNDARY_INVALID",
      "Phase80D rejects a Phase80C source that does not preserve sealed authority boundaries.",
    );
  }
  const analogyRefs = new Set();
  for (const [index, method] of projection.revalidated_adapted_methods.entries()) {
    if (!isObject(method)
        || !text(method.analogy_candidate_ref)
        || !text(method.current_impasse_ref)
        || !text(method.current_corresponding_method_ref)
        || !isObject(method.method_skeleton)
        || method.current_context_revalidated !== true
        || method.adaptation_difference_addressed !== true
        || method.structural_method_identity_preserved !== true
        || method.historical_surface_case_replayed !== false
        || method.historical_method_semantics_copied !== false
        || method.advisory_only !== true
        || method.preference_selected !== false
        || method.action_selected !== false
        || method.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_METHOD_INVALID",
        `Phase80D Phase80C adapted method ${index} is structurally invalid.`,
      );
    }
    if (analogyRefs.has(method.analogy_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_METHOD_DUPLICATE",
        "Phase80D requires unique Phase80C analogy candidate refs.",
      );
    }
    analogyRefs.add(method.analogy_candidate_ref);
  }
  return projection;
}

export function buildWorldSimulationAnalogicalExperienceApplicationLineageContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    phase: "Phase80D",
    status: "adapted_analogy_selected_application_lineage_installed",
    source_adaptation_owner: "Phase80C",
    source_selected_application_owner: "Phase76F",
    exact_phase80c_projection_hash_required: true,
    exact_phase76f_selected_application_receipt_hash_required: true,
    same_character_same_turn_required: true,
    selected_application_method_identity_must_match_revalidated_method: true,
    lineage_means_revalidated_method_corresponds_to_attributed_selected_candidate_only: true,
    phase80c_caused_candidate_claimed: false,
    phase80c_caused_selection_claimed: false,
    method_caused_selection_claimed: false,
    action_outcome_consumed: false,
    outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    retain_revise_decision_performed: false,
    semantic_retention_performed: false,
    semantic_revision_performed: false,
    preference_resolution_performed: false,
    action_selection_performed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    fuzzy_semantic_similarity_modeled: false,
    world_truth_authority_claimed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_lineage_receipt_count: maximumLineageReceiptCount,
  });
}

export function assertWorldSimulationAnalogicalExperienceApplicationLineageBundle(
  value,
  expected = {},
) {
  const bundle = cloneJson(value);
  if (!isObject(bundle)
      || bundle.version !== worldSimulationAnalogicalExperienceApplicationLineageVersion
      || !text(bundle.world_simulation_session_id)
      || !text(bundle.turn_id)
      || !Number.isInteger(bundle.state_revision)
      || bundle.state_revision < 0
      || !text(bundle.world_state_hash)
      || !text(bundle.source_phase76f_receipt_bundle_hash)
      || !Array.isArray(bundle.source_phase80c_projection_hashes)
      || new Set(bundle.source_phase80c_projection_hashes).size !== bundle.source_phase80c_projection_hashes.length
      || bundle.source_phase80c_projection_hashes.some((hash) => !text(hash))
      || !Array.isArray(bundle.receipts)
      || bundle.receipt_count !== bundle.receipts.length
      || bundle.receipt_count > maximumLineageReceiptCount
      || !text(bundle.receipt_bundle_hash)) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_BUNDLE_INVALID",
      "Phase80D adapted-analogy application-lineage bundle is invalid.",
    );
  }
  if (projectionHash(bundle, "receipt_bundle_hash") !== bundle.receipt_bundle_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_BUNDLE_HASH_MISMATCH",
      "Phase80D adapted-analogy application-lineage bundle hash verification failed.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && bundle[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_BUNDLE_LINEAGE_MISMATCH",
        `Phase80D bundle ${key} does not match expected lineage.`,
      );
    }
  }
  const seen = new Set();
  for (const receipt of bundle.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationAnalogicalExperienceApplicationLineageVersion
        || receipt.world_simulation_session_id !== bundle.world_simulation_session_id
        || receipt.turn_id !== bundle.turn_id
        || receipt.state_revision !== bundle.state_revision
        || receipt.world_state_hash !== bundle.world_state_hash
        || !text(receipt.character)
        || !text(receipt.phase80c_projection_hash)
        || !bundle.source_phase80c_projection_hashes.includes(receipt.phase80c_projection_hash)
        || !text(receipt.source_phase80a_projection_hash)
        || !text(receipt.source_phase80b_adaptation_hash)
        || !text(receipt.analogy_candidate_ref)
        || !text(receipt.current_impasse_ref)
        || !text(receipt.current_corresponding_method_ref)
        || !text(receipt.phase76f_application_receipt_id)
        || !text(receipt.phase76f_application_receipt_hash)
        || !text(receipt.action_id)
        || !text(receipt.action_ref)
        || !text(receipt.receipt_id)
        || !text(receipt.receipt_hash)
        || receipt.selected_application_method_identity_matches_revalidated_adapted_method !== true
        || receipt.revalidated_guidance_caused_candidate_claimed !== false
        || receipt.revalidated_guidance_caused_selection_claimed !== false
        || receipt.method_caused_selection_claimed !== false
        || receipt.action_outcome_observed !== false
        || receipt.outcome_credit_assigned !== false
        || receipt.success_failure_learning_performed !== false
        || receipt.retain_revise_decision_performed !== false
        || receipt.semantic_retention_performed !== false
        || receipt.semantic_revision_performed !== false
        || receipt.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_RECEIPT_INVALID",
        "Phase80D adapted-analogy application-lineage receipt is invalid.",
      );
    }
    const identity = {
      version: receipt.version,
      world_simulation_session_id: receipt.world_simulation_session_id,
      turn_id: receipt.turn_id,
      state_revision: receipt.state_revision,
      world_state_hash: receipt.world_state_hash,
      character: receipt.character,
      phase80c_projection_hash: receipt.phase80c_projection_hash,
      source_phase80a_projection_hash: receipt.source_phase80a_projection_hash,
      source_phase80b_adaptation_hash: receipt.source_phase80b_adaptation_hash,
      analogy_candidate_ref: receipt.analogy_candidate_ref,
      current_impasse_ref: receipt.current_impasse_ref,
      current_corresponding_method_ref: receipt.current_corresponding_method_ref,
      phase76f_application_receipt_id: receipt.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: receipt.phase76f_application_receipt_hash,
      action_id: receipt.action_id,
      action_ref: receipt.action_ref,
    };
    const expectedHash = hashAgentRunValue(identity);
    if (receipt.receipt_hash !== expectedHash
        || receipt.receipt_id !== `phase80d_application_${expectedHash.slice(0, 24)}`
        || seen.has(receipt.receipt_id)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_RECEIPT_HASH_MISMATCH",
        "Phase80D adapted-analogy application-lineage receipt identity verification failed.",
      );
    }
    seen.add(receipt.receipt_id);
  }
  return deepFreeze(bundle);
}

export function buildWorldSimulationAnalogicalExperienceApplicationLineage(input = {}) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id");
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_INPUT_INVALID",
      "Phase80D state_revision must be a non-negative integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const applicationBundle = assertWorldSimulationSelectedExperientialMethodApplicationReceiptBundle(
    input.selected_application_receipts,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (applicationBundle.version !== worldSimulationExperientialMethodApplicationLineageVersion) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE76F_INVALID",
      "Phase80D requires the canonical Phase76F selected application receipt version.",
    );
  }
  const rawPhase80CProjections = array(input.analogical_experience_revalidation_projections);
  if (rawPhase80CProjections.length > maximumProjectionCount) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_LIMIT_EXCEEDED",
      `Phase80D accepts at most ${maximumProjectionCount} Phase80C projections per turn.`,
    );
  }
  const phase80CProjections = rawPhase80CProjections
    .map((projection) => verifyPhase80C(projection, turnId));
  const projectionByCharacter = new Map();
  for (const projection of phase80CProjections) {
    const key = characterKey(projection.character);
    if (projectionByCharacter.has(key)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_DUPLICATE_CHARACTER",
        `Phase80D accepts at most one Phase80C projection per character: ${projection.character}.`,
      );
    }
    projectionByCharacter.set(key, projection);
  }

  const receipts = [];
  for (const application of applicationBundle.receipts) {
    const phase80C = projectionByCharacter.get(characterKey(application.character));
    if (!phase80C) continue;
    if (phase80C.current_state_revision !== input.state_revision
        || phase80C.current_world_state_hash !== worldStateHash) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_PHASE80C_WORLD_LINEAGE_MISMATCH",
        "Phase80D Phase80C projection must match the selected application's exact committed world lineage.",
      );
    }
    const appliedRefs = new Set(array(application.applied_method_refs));
    for (const method of phase80C.revalidated_adapted_methods) {
      if (!appliedRefs.has(method.current_corresponding_method_ref)) continue;
      const identity = {
        version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        character: application.character,
        phase80c_projection_hash: phase80C.projection_hash,
        source_phase80a_projection_hash: phase80C.source_phase80a_projection_hash,
        source_phase80b_adaptation_hash: phase80C.source_phase80b_adaptation_hash,
        analogy_candidate_ref: method.analogy_candidate_ref,
        current_impasse_ref: method.current_impasse_ref,
        current_corresponding_method_ref: method.current_corresponding_method_ref,
        phase76f_application_receipt_id: application.receipt_id,
        phase76f_application_receipt_hash: application.receipt_hash,
        action_id: application.action_id,
        action_ref: application.action_ref,
      };
      const receiptHash = hashAgentRunValue(identity);
      receipts.push({
        receipt_id: `phase80d_application_${receiptHash.slice(0, 24)}`,
        receipt_hash: receiptHash,
        ...identity,
        selected_application_method_identity_matches_revalidated_adapted_method: true,
        revalidated_guidance_caused_candidate_claimed: false,
        revalidated_guidance_caused_selection_claimed: false,
        method_caused_selection_claimed: false,
        action_outcome_observed: false,
        outcome_credit_assigned: false,
        success_failure_learning_performed: false,
        retain_revise_decision_performed: false,
        semantic_retention_performed: false,
        semantic_revision_performed: false,
        world_truth_authority: false,
      });
    }
  }
  receipts.sort((left, right) => compareText(left.receipt_id, right.receipt_id));
  if (receipts.length > maximumLineageReceiptCount) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_APPLICATION_LINEAGE_LIMIT_EXCEEDED",
      `Phase80D accepts at most ${maximumLineageReceiptCount} lineage receipts per turn.`,
    );
  }
  const bundle = {
    version: worldSimulationAnalogicalExperienceApplicationLineageVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase76f_receipt_bundle_hash: applicationBundle.receipt_bundle_hash,
    source_phase80c_projection_hashes: phase80CProjections
      .map((projection) => projection.projection_hash)
      .sort(compareText),
    receipt_count: receipts.length,
    receipts,
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      outcome_credit_not_assigned: true,
      retain_revise_decision_not_performed: true,
      semantic_retention_not_performed: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationAnalogicalExperienceApplicationLineageBundle(bundle, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
  });
}
