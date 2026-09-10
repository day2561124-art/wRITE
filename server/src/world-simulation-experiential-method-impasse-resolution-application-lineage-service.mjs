import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationSelectedExperientialMethodApplicationReceiptBundle,
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "./world-simulation-experiential-method-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "./world-simulation-experiential-method-impasse-reresolution-service.mjs";

export const worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion =
  "phase79g-experiential-method-impasse-resolution-application-lineage-v1";

const maximumLineageReceiptCount = 48;

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
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(
  value,
  label,
  maxLength = 600,
  code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(`${label} must be a non-empty string no longer than ${maxLength} characters.`);
    error.code = code;
    throw error;
  }
  return text;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredString(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function verifyPhase79FReresolution(value, expectedTurnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpasseReresolutionVersion
      || projection.current_turn_id !== expectedTurnId
      || !optionalString(projection.character)
      || !optionalString(projection.source_phase79b_resolution_hash)
      || !optionalString(projection.source_phase79d_impasse_hash)
      || !optionalString(projection.source_phase79e_evidence_hash)
      || !optionalString(projection.resolver_view_hash)
      || !optionalString(projection.effective_phase79b_resolution_hash)
      || !optionalString(projection.reresolution_hash)
      || !Array.isArray(projection.preference_revision_records)
      || !isObject(projection.effective_competition_resolution)
      || !Array.isArray(projection.impasse_results)
      || !Array.isArray(projection.resolved_impasse_refs)
      || !Array.isArray(projection.remaining_impasse_refs)
      || !isObject(projection.character_view)
      || projection.resolved_impasse_count !== projection.resolved_impasse_refs.length
      || projection.remaining_impasse_count !== projection.remaining_impasse_refs.length) {
    const error = new Error("Phase79G requires an exact canonical current-turn Phase79F re-resolution projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.reresolution_hash;
  if (hashAgentRunValue(body) !== projection.reresolution_hash) {
    const error = new Error("Phase79G Phase79F re-resolution projection failed immutable verification.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_HASH_MISMATCH";
    throw error;
  }
  const audit = object(projection.audit);
  if (audit.exact_phase79b_phase79d_phase79e_lineage_verified !== true
      || audit.bounded_phase79d_phase79e_resolver_surface_only !== true
      || audit.existing_phase79b_competition_refs_only !== true
      || audit.existing_phase79b_resolution_kernel_reused !== true
      || audit.evidence_cue_refs_required_for_every_revision !== true
      || audit.arbitrary_tie_breaking_used !== false
      || audit.numeric_similarity_confidence_probability_utility_modeled !== false
      || audit.action_selection_performed !== false
      || audit.semantic_revision_performed !== false
      || audit.same_turn_learning_feedback_performed !== false
      || audit.world_truth_authority_claimed !== false) {
    const error = new Error("Phase79G rejects a Phase79F source that does not preserve sealed authority boundaries.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_BOUNDARY_INVALID";
    throw error;
  }
  const resolvedRefSet = new Set(projection.resolved_impasse_refs);
  const remainingRefSet = new Set(projection.remaining_impasse_refs);
  if (resolvedRefSet.size !== projection.resolved_impasse_refs.length
      || remainingRefSet.size !== projection.remaining_impasse_refs.length
      || [...resolvedRefSet].some((ref) => remainingRefSet.has(ref))) {
    const error = new Error("Phase79G Phase79F resolved/remaining impasse indexes must be unique and disjoint.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID";
    throw error;
  }
  const resultRefs = new Set();
  for (const [index, result] of projection.impasse_results.entries()) {
    if (!isObject(result)
        || !optionalString(result.impasse_ref)
        || !["tie_impasse", "conflict_impasse"].includes(result.prior_impasse_type)
        || !optionalString(result.resolution_status)
        || !Array.isArray(result.retained_method_refs)
        || !Array.isArray(result.applied_preference_revisions)
        || typeof result.resolved !== "boolean") {
      const error = new Error(`Phase79G Phase79F impasse result ${index} is invalid.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID";
      throw error;
    }
    if (resultRefs.has(result.impasse_ref)) {
      const error = new Error(`Phase79G Phase79F source contains duplicate impasse ref ${result.impasse_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_DUPLICATE";
      throw error;
    }
    resultRefs.add(result.impasse_ref);
    if (result.resolved) {
      const dominant = requiredString(
        result.dominant_method_ref,
        `impasse_results[${index}].dominant_method_ref`,
        240,
        "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID",
      );
      if (result.resolution_status !== "resolved_dominant"
          || result.retained_method_refs.length !== 1
          || result.retained_method_refs[0] !== dominant
          || result.applied_preference_revisions.length < 1
          || !resolvedRefSet.has(result.impasse_ref)) {
        const error = new Error(`Phase79G resolved Phase79F impasse ${result.impasse_ref} has inconsistent dominant-method lineage.`);
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID";
        throw error;
      }
    } else if (!["tie_impasse", "conflict_impasse"].includes(result.resolution_status)
        || optionalString(result.dominant_method_ref)
        || !remainingRefSet.has(result.impasse_ref)) {
      const error = new Error(`Phase79G unresolved Phase79F impasse ${result.impasse_ref} is inconsistent.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID";
      throw error;
    }
  }
  if (resultRefs.size !== resolvedRefSet.size + remainingRefSet.size
      || [...resolvedRefSet, ...remainingRefSet].some((ref) => !resultRefs.has(ref))
      || projection.effective_competition_resolution.resolution_hash
        !== projection.effective_phase79b_resolution_hash
      || projection.character_view.deliberation_required !== (remainingRefSet.size > 0)) {
    const error = new Error("Phase79G Phase79F result indexes or effective-resolution lineage are inconsistent.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID";
    throw error;
  }
  return projection;
}

export function buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion,
    phase: "Phase79G",
    status: "impasse_resolution_to_selected_application_provenance_installed",
    source_resolution_owner: "Phase79F",
    source_selected_application_owner: "Phase76F",
    exact_phase79f_reresolution_hash_required: true,
    exact_phase76f_selected_application_receipt_hash_required: true,
    resolved_dominant_method_must_be_in_selected_application: true,
    unresolved_impasse_creates_lineage: false,
    resolution_caused_action_choice_claimed: false,
    method_caused_candidate_claimed: false,
    method_caused_selection_claimed: false,
    action_outcome_consumed: false,
    outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    semantic_retention_performed: false,
    semantic_revision_performed: false,
    numeric_confidence_probability_utility_reward_modeled: false,
    world_truth_authority_claimed: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_lineage_receipt_count: maximumLineageReceiptCount,
  });
}

export function assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle(
  value,
  expected = {},
) {
  const bundle = cloneJson(value);
  if (!isObject(bundle)
      || bundle.version !== worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion
      || !optionalString(bundle.world_simulation_session_id)
      || !optionalString(bundle.turn_id)
      || !Number.isInteger(bundle.state_revision)
      || bundle.state_revision < 0
      || !optionalString(bundle.world_state_hash)
      || !optionalString(bundle.source_phase76f_receipt_bundle_hash)
      || !Array.isArray(bundle.source_phase79f_reresolution_hashes)
      || new Set(bundle.source_phase79f_reresolution_hashes).size
        !== bundle.source_phase79f_reresolution_hashes.length
      || bundle.source_phase79f_reresolution_hashes.some((hash) => !optionalString(hash))
      || !Array.isArray(bundle.receipts)
      || bundle.receipt_count !== bundle.receipts.length
      || bundle.receipt_count > maximumLineageReceiptCount
      || !optionalString(bundle.receipt_bundle_hash)) {
    const error = new Error("Phase79G resolution-application lineage bundle is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_BUNDLE_INVALID";
    throw error;
  }
  const body = cloneJson(bundle);
  delete body.receipt_bundle_hash;
  if (hashAgentRunValue(body) !== bundle.receipt_bundle_hash) {
    const error = new Error("Phase79G resolution-application lineage bundle hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_BUNDLE_HASH_MISMATCH";
    throw error;
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && expected[key] !== bundle[key]) {
      const error = new Error(`Phase79G bundle ${key} does not match expected lineage.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_BUNDLE_LINEAGE_MISMATCH";
      throw error;
    }
  }
  const seenReceiptIds = new Set();
  for (const receipt of bundle.receipts) {
    if (!isObject(receipt)
        || receipt.version !== worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion
        || receipt.world_simulation_session_id !== bundle.world_simulation_session_id
        || receipt.turn_id !== bundle.turn_id
        || receipt.state_revision !== bundle.state_revision
        || receipt.world_state_hash !== bundle.world_state_hash
        || !optionalString(receipt.character)
        || !optionalString(receipt.phase79f_reresolution_hash)
        || !bundle.source_phase79f_reresolution_hashes.includes(receipt.phase79f_reresolution_hash)
        || !optionalString(receipt.impasse_ref)
        || !["tie_impasse", "conflict_impasse"].includes(receipt.prior_impasse_type)
        || receipt.resolution_status !== "resolved_dominant"
        || !optionalString(receipt.dominant_method_ref)
        || !optionalString(receipt.phase76f_application_receipt_id)
        || !optionalString(receipt.phase76f_application_receipt_hash)
        || !optionalString(receipt.action_id)
        || !optionalString(receipt.action_ref)
        || !Array.isArray(receipt.applied_method_refs)
        || !receipt.applied_method_refs.includes(receipt.dominant_method_ref)
        || !optionalString(receipt.receipt_id)
        || !optionalString(receipt.receipt_hash)
        || receipt.resolution_dominant_method_participated_in_selected_candidate !== true
        || receipt.resolution_caused_action_choice_claimed !== false
        || receipt.method_caused_candidate_claimed !== false
        || receipt.method_caused_selection_claimed !== false
        || receipt.action_outcome_observed !== false
        || receipt.outcome_credit_assigned !== false
        || receipt.success_failure_learning_performed !== false
        || receipt.semantic_retention_performed !== false
        || receipt.semantic_revision_performed !== false
        || receipt.world_truth_authority !== false) {
      const error = new Error("Phase79G resolution-application lineage receipt is invalid.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_RECEIPT_INVALID";
      throw error;
    }
    if (seenReceiptIds.has(receipt.receipt_id)) {
      const error = new Error(`Phase79G duplicate receipt ${receipt.receipt_id}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_RECEIPT_DUPLICATE";
      throw error;
    }
    const identity = {
      version: receipt.version,
      world_simulation_session_id: receipt.world_simulation_session_id,
      turn_id: receipt.turn_id,
      state_revision: receipt.state_revision,
      world_state_hash: receipt.world_state_hash,
      character: receipt.character,
      phase79f_reresolution_hash: receipt.phase79f_reresolution_hash,
      impasse_ref: receipt.impasse_ref,
      prior_impasse_type: receipt.prior_impasse_type,
      resolution_status: receipt.resolution_status,
      dominant_method_ref: receipt.dominant_method_ref,
      phase76f_application_receipt_id: receipt.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: receipt.phase76f_application_receipt_hash,
      action_id: receipt.action_id,
      action_ref: receipt.action_ref,
      applied_method_refs: cloneJson(receipt.applied_method_refs),
    };
    const expectedHash = hashAgentRunValue(identity);
    if (receipt.receipt_hash !== expectedHash
        || receipt.receipt_id !== `phase79g_resolution_application_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase79G resolution-application lineage receipt identity verification failed.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_RECEIPT_HASH_MISMATCH";
      throw error;
    }
    seenReceiptIds.add(receipt.receipt_id);
  }
  return deepFreeze(bundle);
}

export function buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage(input = {}) {
  const worldSimulationSessionId = requiredString(input.world_simulation_session_id, "world_simulation_session_id");
  const turnId = requiredString(input.turn_id, "turn_id");
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    const error = new Error("Phase79G state_revision must be a non-negative integer.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_INPUT_INVALID";
    throw error;
  }
  const worldStateHash = requiredString(input.world_state_hash, "world_state_hash", 128);
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
    const error = new Error("Phase79G requires the canonical Phase76F selected application receipt version.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE76F_INVALID";
    throw error;
  }

  const reresolutions = array(input.impasse_reresolution_projections)
    .map((projection) => verifyPhase79FReresolution(projection, turnId));
  const byCharacter = new Map();
  for (const projection of reresolutions) {
    const key = characterKey(projection.character);
    if (byCharacter.has(key)) {
      const error = new Error(`Phase79G accepts at most one Phase79F projection per character: ${projection.character}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_DUPLICATE_CHARACTER";
      throw error;
    }
    byCharacter.set(key, projection);
  }

  const receipts = [];
  for (const application of applicationBundle.receipts) {
    const reresolution = byCharacter.get(characterKey(application.character));
    if (!reresolution) continue;
    const appliedMethodRefs = [...new Set(array(application.applied_method_refs).map((ref) =>
      requiredString(ref, "applied_method_ref", 240)))].sort(compareText);
    for (const result of reresolution.impasse_results) {
      if (result.resolved !== true || result.resolution_status !== "resolved_dominant") continue;
      const dominantMethodRef = optionalString(result.dominant_method_ref);
      if (!dominantMethodRef || !appliedMethodRefs.includes(dominantMethodRef)) continue;
      const identity = {
        version: worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion,
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        character: application.character,
        phase79f_reresolution_hash: reresolution.reresolution_hash,
        impasse_ref: result.impasse_ref,
        prior_impasse_type: result.prior_impasse_type,
        resolution_status: result.resolution_status,
        dominant_method_ref: dominantMethodRef,
        phase76f_application_receipt_id: application.receipt_id,
        phase76f_application_receipt_hash: application.receipt_hash,
        action_id: application.action_id,
        action_ref: application.action_ref,
        applied_method_refs: appliedMethodRefs,
      };
      const receiptHash = hashAgentRunValue(identity);
      receipts.push({
        receipt_id: `phase79g_resolution_application_${receiptHash.slice(0, 24)}`,
        receipt_hash: receiptHash,
        ...identity,
        resolution_dominant_method_participated_in_selected_candidate: true,
        resolution_caused_action_choice_claimed: false,
        method_caused_candidate_claimed: false,
        method_caused_selection_claimed: false,
        action_outcome_observed: false,
        outcome_credit_assigned: false,
        success_failure_learning_performed: false,
        semantic_retention_performed: false,
        semantic_revision_performed: false,
        world_truth_authority: false,
      });
    }
  }
  receipts.sort((left, right) => compareText(left.receipt_id, right.receipt_id));
  if (receipts.length > maximumLineageReceiptCount) {
    const error = new Error(`Phase79G accepts at most ${maximumLineageReceiptCount} lineage receipts per turn.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_LIMIT_EXCEEDED";
    throw error;
  }
  const bundle = {
    version: worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase76f_receipt_bundle_hash: applicationBundle.receipt_bundle_hash,
    source_phase79f_reresolution_hashes: reresolutions
      .map((projection) => projection.reresolution_hash)
      .sort(compareText),
    receipt_count: receipts.length,
    receipts,
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      outcome_credit_not_assigned: true,
      semantic_retention_not_performed: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle(bundle, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
  });
}
