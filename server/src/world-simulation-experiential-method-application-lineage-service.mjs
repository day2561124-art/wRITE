import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "./world-simulation-subjective-action-deliberation-service.mjs";
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "./world-simulation-experiential-method-transfer-service.mjs";

export const worldSimulationExperientialMethodApplicationLineageVersion =
  "phase76f-experiential-method-application-lineage-v1";

const maximumAttributionCount = 48;
const maximumMethodCount = 12;
const maximumActionCount = 24;
const maximumStringChars = 600;
const maximumCollectionItems = 8;
const maximumObjectEntries = 12;
const maximumDepth = 4;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function requiredString(value, label, maxLength = 240, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_INPUT_INVALID") {
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

function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

const privateActionKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_world_event",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
  "outcome",
  "result",
  "success",
  "hit",
  "winner",
  "selected",
  "selected_action",
  "confidence",
  "probability",
  "success_probability",
  "similarity_score",
  "utility",
  "utility_score",
  "priority_score",
  "feasibility_score",
]);

function privateActionKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return privateActionKeys.has(normalized)
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_");
}

function boundedActionValue(value, depth = 0) {
  if (depth > maximumDepth) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text ? Array.from(text).slice(0, maximumStringChars).join("") : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maximumCollectionItems)
      .map((item) => boundedActionValue(item, depth + 1))
      .filter((item) => item !== null && item !== undefined);
  }
  if (!isObject(value)) return null;
  const clean = {};
  for (const key of Object.keys(value).sort(compareText).slice(0, maximumObjectEntries)) {
    if (privateActionKey(key)) continue;
    const child = boundedActionValue(value[key], depth + 1);
    if (child === null || child === undefined) continue;
    if (Array.isArray(child) && child.length === 0) continue;
    if (isObject(child) && Object.keys(child).length === 0) continue;
    clean[key] = child;
  }
  return clean;
}

function verifyPhase76EProjection(value, expectedCharacter, expectedTurnId) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodTransferVersion
      || !optionalString(projection.transfer_hash)
      || !Array.isArray(projection.transferred_method_mappings)
      || !isObject(projection.character_view)) {
    const error = new Error("Phase76F requires an exact canonical Phase76E transfer projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_INVALID";
    throw error;
  }
  if (!sameCharacter(projection.character, expectedCharacter)
      || projection.current_turn_id !== expectedTurnId) {
    const error = new Error("Phase76F Phase76E source must match the same character and current turn.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_LINEAGE_MISMATCH";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.transfer_hash;
  if (hashAgentRunValue(body) !== projection.transfer_hash) {
    const error = new Error("Phase76F Phase76E transfer hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_HASH_MISMATCH";
    throw error;
  }
  const guidance = array(projection.character_view.transferred_methods);
  if (projection.transferred_method_mappings.length !== guidance.length
      || guidance.length > maximumMethodCount) {
    const error = new Error("Phase76F Phase76E method mapping/guidance cardinality is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_INVALID";
    throw error;
  }
  for (const mapping of projection.transferred_method_mappings) {
    if (!isObject(mapping)
        || !optionalString(mapping.transfer_ref)
        || !Number.isInteger(mapping.transfer_index)
        || mapping.transfer_index < 0
        || mapping.transfer_index >= guidance.length) {
      const error = new Error("Phase76F Phase76E method mapping identity is invalid.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_INVALID";
      throw error;
    }
    const sourceGuidance = guidance[mapping.transfer_index];
    if (!isObject(sourceGuidance)
        || hashAgentRunValue(sourceGuidance.method_skeleton) !== mapping.method_skeleton_hash
        || sourceGuidance.source_knowledge_status !== mapping.source_knowledge_status
        || sourceGuidance.mapping_kind !== mapping.mapping_kind) {
      const error = new Error("Phase76F Phase76E internal mapping does not match its bounded character guidance.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_LINEAGE_MISMATCH";
      throw error;
    }
  }
  return projection;
}

function actionSemanticContext(raw) {
  const candidate = isObject(raw) ? raw : {};
  const safe = {
    intent: candidate.intent ?? null,
    prerequisites: candidate.prerequisites ?? [],
    known_costs: candidate.known_costs ?? [],
    blocked_by: candidate.blocked_by ?? [],
    duration_estimate: candidate.duration_estimate ?? null,
    duration_ms: candidate.duration_ms ?? null,
    duration_s: candidate.duration_s ?? null,
    target: candidate.target ?? null,
    target_position: candidate.target_position ?? null,
    movement: candidate.movement ?? null,
    door_interaction: candidate.door_interaction ?? null,
    object_interaction: candidate.object_interaction ?? null,
    attack: candidate.attack ?? null,
    defense: candidate.defense ?? null,
    projectile: candidate.projectile ?? null,
    ability: candidate.ability ?? null,
    resource_commitment: candidate.resource_commitment ?? null,
  };
  return boundedActionValue(safe);
}

export function buildWorldSimulationExperientialMethodApplicationLineageContract() {
  return Object.freeze({
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    phase: "Phase76F",
    status: "experiential_method_candidate_and_selected_application_lineage_installed",
    source_method_owner: "Phase76E",
    action_candidate_identity_owner: "Phase74A",
    selected_action_identity_owner: "Phase74D",
    candidate_attribution_relation: "method_informed_candidate",
    resolver_selects_existing_transfer_and_action_refs_only: true,
    resolver_may_author_method_content: false,
    resolver_may_author_action_content: false,
    resolver_may_select_action: false,
    resolver_may_read_outcome: false,
    candidate_attribution_is_not_causal_credit: true,
    selected_application_means_attributed_candidate_was_selected_only: true,
    selected_application_does_not_claim_method_caused_choice: true,
    action_outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    retain_revise_policy_modeled: false,
    many_methods_per_candidate_allowed: true,
    one_method_may_inform_multiple_candidates: true,
    numeric_strength_confidence_probability_utility_modeled: false,
    world_truth_authority_claimed: false,
    causal_outcome_authority_claimed: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    append_only_world_history_persistence: true,
    persist_selected_application_only_with_successful_atomic_world_turn_commit: true,
    maximum_attribution_count: maximumAttributionCount,
  });
}

export function buildWorldSimulationExperientialMethodCandidateAttributionResolverView(input = {}) {
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const transferProjection = verifyPhase76EProjection(
    input.experiential_method_transfer,
    character,
    currentTurnId,
  );
  const candidateActionIntents = array(input.candidate_action_intents);
  if (candidateActionIntents.length > maximumActionCount) {
    const error = new Error(`Phase76F accepts at most ${maximumActionCount} action candidates.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ACTION_LIMIT_EXCEEDED";
    throw error;
  }
  const deliberation = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition: input.cognition,
    candidate_action_intents: candidateActionIntents,
  });
  const methodGuidance = array(transferProjection.character_view.transferred_methods);
  const methodCatalog = array(transferProjection.transferred_method_mappings)
    .map((mapping) => ({
      transfer_ref: mapping.transfer_ref,
      mapping_kind: mapping.mapping_kind,
      method_skeleton: cloneJson(methodGuidance[mapping.transfer_index]?.method_skeleton ?? null),
      source_knowledge_status: mapping.source_knowledge_status,
      current_context_grounding_preserved: true,
      subjective_not_world_truth: true,
    }))
    .sort((left, right) => compareText(left.transfer_ref, right.transfer_ref));
  const actionById = new Map(
    candidateActionIntents.map((candidate) => [candidate?.action_id, candidate]),
  );
  const actionCatalog = array(deliberation.action_options)
    .map((option) => ({
      action_ref: option.action_ref,
      action_id: option.action_id,
      candidate_source: option.candidate_source,
      semantic_context: actionSemanticContext(actionById.get(option.action_id)),
      selected: false,
      outcome_known: false,
      world_truth_authority: false,
    }))
    .sort((left, right) => compareText(left.action_ref, right.action_ref));
  const view = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase76e_transfer_hash: transferProjection.transfer_hash,
    source_phase74a_deliberation_view_hash: deliberation.deliberation_view_hash,
    method_catalog: methodCatalog,
    action_catalog: actionCatalog,
    selection_contract: {
      output_shape: "array_of_transfer_ref_action_ref_pairs",
      transfer_ref_must_be_from_method_catalog: true,
      action_ref_must_be_from_action_catalog: true,
      semantic_method_authoring_allowed: false,
      semantic_action_authoring_allowed: false,
      selected_action_requested: false,
      action_outcome_requested: false,
      causal_credit_requested: false,
      confidence_probability_similarity_utility_requested: false,
      no_attribution_may_return_empty: true,
      many_to_many_attribution_allowed: true,
      maximum_attribution_count: maximumAttributionCount,
    },
    boundaries: {
      exact_phase76e_source_verified: true,
      canonical_phase74a_action_refs_reused: true,
      same_character_current_turn_only: true,
      raw_world_state_exposed: false,
      raw_world_event_exposed: false,
      hidden_causal_evidence_exposed: false,
      action_outcome_exposed: false,
      selected_action_exposed: false,
      other_character_private_cognition_exposed: false,
      numeric_scores_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}

function verifyResolverView(value) {
  const view = cloneJson(value);
  if (!isObject(view)
      || view.version !== worldSimulationExperientialMethodApplicationLineageVersion
      || !optionalString(view.resolver_view_hash)) {
    const error = new Error("Phase76F requires an exact canonical candidate-attribution resolver view.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== view.resolver_view_hash) {
    const error = new Error("Phase76F candidate-attribution resolver view hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_RESOLVER_VIEW_HASH_MISMATCH";
    throw error;
  }
  return view;
}

function normalizeAttribution(raw, view, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase76F attribution at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_INVALID";
    throw error;
  }
  for (const forbidden of [
    "method",
    "method_skeleton",
    "action",
    "action_id",
    "intent",
    "selected",
    "selected_action",
    "outcome",
    "result",
    "success",
    "failure",
    "credit",
    "credit_score",
    "confidence",
    "probability",
    "similarity",
    "similarity_score",
    "utility",
    "utility_score",
    "priority_score",
    "feasibility_score",
  ]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(`Phase76F resolver attribution may not author field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const transferRef = requiredString(
    raw.transfer_ref,
    `candidate_attributions[${index}].transfer_ref`,
    180,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_INVALID",
  );
  const actionRef = requiredString(
    raw.action_ref,
    `candidate_attributions[${index}].action_ref`,
    180,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_INVALID",
  );
  const method = array(view.method_catalog).find((entry) => entry.transfer_ref === transferRef);
  const action = array(view.action_catalog).find((entry) => entry.action_ref === actionRef);
  if (!method || !action) {
    const error = new Error("Phase76F attribution references a transfer/action ref outside the canonical resolver view.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_OUT_OF_VIEW";
    throw error;
  }
  return { transfer_ref: transferRef, action_ref: actionRef, method, action };
}

export function projectWorldSimulationExperientialMethodCandidateAttribution(input = {}) {
  const view = verifyResolverView(input.resolver_view);
  if (!Array.isArray(input.candidate_attributions ?? [])) {
    const error = new Error("Phase76F candidate_attributions must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_INVALID";
    throw error;
  }
  const raw = input.candidate_attributions ?? [];
  if (raw.length > maximumAttributionCount) {
    const error = new Error(`Phase76F accepts at most ${maximumAttributionCount} candidate attributions.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_LIMIT_EXCEEDED";
    throw error;
  }
  const normalized = raw.map((item, index) => normalizeAttribution(item, view, index));
  const pairKeys = normalized.map((item) => `${item.transfer_ref}\u0000${item.action_ref}`);
  if (new Set(pairKeys).size !== pairKeys.length) {
    const error = new Error("Phase76F does not allow duplicate transfer/action attribution pairs.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_DUPLICATE";
    throw error;
  }
  const candidateAttributions = normalized
    .map((item) => {
      const identity = {
        version: worldSimulationExperientialMethodApplicationLineageVersion,
        character: view.character,
        current_turn_id: view.current_turn_id,
        source_phase76e_transfer_hash: view.source_phase76e_transfer_hash,
        source_phase74a_deliberation_view_hash: view.source_phase74a_deliberation_view_hash,
        relation: "method_informed_candidate",
        transfer_ref: item.transfer_ref,
        action_ref: item.action_ref,
        action_id: item.action.action_id,
      };
      const attributionHash = hashAgentRunValue(identity);
      return {
        attribution_ref: `phase76f_candidate_${attributionHash.slice(0, 24)}`,
        attribution_hash: attributionHash,
        ...identity,
        candidate_attribution_not_causal_credit: true,
        method_caused_candidate_claimed: false,
        method_caused_selection_claimed: false,
        action_outcome_known: false,
        world_truth_authority: false,
      };
    })
    .sort((left, right) => compareText(left.attribution_ref, right.attribution_ref));
  const projection = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    character: view.character,
    current_turn_id: view.current_turn_id,
    source_phase76e_transfer_hash: view.source_phase76e_transfer_hash,
    source_phase74a_deliberation_view_hash: view.source_phase74a_deliberation_view_hash,
    resolver_view_hash: view.resolver_view_hash,
    candidate_attribution_count: candidateAttributions.length,
    candidate_attributions: candidateAttributions,
    audit: {
      exact_phase76e_source_verified: true,
      canonical_phase74a_action_refs_reused: true,
      resolver_selected_existing_refs_only: true,
      resolver_authored_method_content: false,
      resolver_authored_action_content: false,
      action_selection_performed: false,
      action_outcome_consumed: false,
      causal_credit_assigned: false,
      success_failure_learning_performed: false,
      numeric_scores_modeled: false,
      world_truth_authority_claimed: false,
      direct_world_state_mutation: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return Object.freeze(cloneJson(projection));
}

function verifyCandidateAttributionProjection(value) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodApplicationLineageVersion
      || !optionalString(projection.projection_hash)
      || !Array.isArray(projection.candidate_attributions)
      || projection.candidate_attribution_count !== projection.candidate_attributions.length) {
    const error = new Error("Phase76F selected application requires a canonical candidate-attribution projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.projection_hash;
  if (hashAgentRunValue(body) !== projection.projection_hash) {
    const error = new Error("Phase76F candidate-attribution projection hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_HASH_MISMATCH";
    throw error;
  }
  for (const attribution of projection.candidate_attributions) {
    if (!isObject(attribution)
        || attribution.version !== worldSimulationExperientialMethodApplicationLineageVersion
        || attribution.character !== projection.character
        || attribution.current_turn_id !== projection.current_turn_id
        || attribution.source_phase76e_transfer_hash !== projection.source_phase76e_transfer_hash
        || attribution.source_phase74a_deliberation_view_hash !== projection.source_phase74a_deliberation_view_hash) {
      const error = new Error("Phase76F candidate attribution does not match its projection lineage.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_LINEAGE_MISMATCH";
      throw error;
    }
    const identity = {
      version: attribution.version,
      character: attribution.character,
      current_turn_id: attribution.current_turn_id,
      source_phase76e_transfer_hash: attribution.source_phase76e_transfer_hash,
      source_phase74a_deliberation_view_hash: attribution.source_phase74a_deliberation_view_hash,
      relation: attribution.relation,
      transfer_ref: attribution.transfer_ref,
      action_ref: attribution.action_ref,
      action_id: attribution.action_id,
    };
    const expectedHash = hashAgentRunValue(identity);
    if (attribution.attribution_hash !== expectedHash
        || attribution.attribution_ref !== `phase76f_candidate_${expectedHash.slice(0, 24)}`) {
      const error = new Error("Phase76F candidate attribution identity verification failed.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_HASH_MISMATCH";
      throw error;
    }
  }
  return projection;
}

export function buildWorldSimulationSelectedExperientialMethodApplicationReceipts(input = {}) {
  const worldSimulationSessionId = requiredString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredString(input.turn_id, "turn_id");
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    const error = new Error("Phase76F state_revision must be a non-negative integer.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_INPUT_INVALID";
    throw error;
  }
  const worldStateHash = requiredString(input.world_state_hash, "world_state_hash", 128);
  const choiceBundle = assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
    input.subjective_choice_commitment_receipts,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  const projections = array(input.candidate_attribution_projections)
    .map(verifyCandidateAttributionProjection);
  const seenCharacters = new Set();
  const receipts = [];
  for (const projection of projections) {
    const characterKey = String(projection.character ?? "").toLocaleLowerCase("zh-Hant-TW");
    if (!characterKey || seenCharacters.has(characterKey)) {
      const error = new Error("Phase76F requires at most one candidate-attribution projection per character per turn.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_DUPLICATE_CHARACTER";
      throw error;
    }
    seenCharacters.add(characterKey);
    if (projection.current_turn_id !== turnId) {
      const error = new Error("Phase76F candidate-attribution projection turn does not match selected application lineage.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_LINEAGE_MISMATCH";
      throw error;
    }
    const choice = array(choiceBundle.receipts)
      .find((receipt) => sameCharacter(receipt.character, projection.character));
    if (!choice) {
      const error = new Error(`Phase76F cannot resolve a Phase74D choice receipt for ${projection.character}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_CHOICE_RECEIPT_MISSING";
      throw error;
    }
    if (choice.selection_kind !== "candidate_action_intent") continue;
    const selectedAttributions = array(projection.candidate_attributions)
      .filter((attribution) => attribution.action_ref === choice.action_ref);
    if (selectedAttributions.length === 0) continue;
    for (const attribution of selectedAttributions) {
      if (attribution.action_id !== choice.action_id) {
        const error = new Error("Phase76F selected action id/ref lineage is inconsistent.");
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SELECTED_LINEAGE_MISMATCH";
        throw error;
      }
    }
    const methodRefs = [...new Set(selectedAttributions.map((item) => item.transfer_ref))].sort(compareText);
    const attributionRefs = selectedAttributions.map((item) => item.attribution_ref).sort(compareText);
    const identity = {
      version: worldSimulationExperientialMethodApplicationLineageVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: choice.character,
      selection_kind: choice.selection_kind,
      action_id: choice.action_id,
      action_ref: choice.action_ref,
      phase74d_choice_receipt_id: choice.receipt_id,
      phase74d_choice_receipt_hash: choice.receipt_hash,
      source_phase76f_projection_hash: projection.projection_hash,
      source_phase76e_transfer_hash: projection.source_phase76e_transfer_hash,
      candidate_attribution_refs: attributionRefs,
      applied_method_refs: methodRefs,
    };
    const receiptHash = hashAgentRunValue(identity);
    receipts.push({
      receipt_id: `phase76f_application_${receiptHash.slice(0, 24)}`,
      receipt_hash: receiptHash,
      ...identity,
      application_status: "selected_candidate_has_recorded_experiential_method_attribution",
      selected_application_means_attributed_candidate_was_selected_only: true,
      method_caused_candidate_claimed: false,
      method_caused_selection_claimed: false,
      outcome_observed_by_this_receipt: false,
      action_outcome_credit_assigned: false,
      success_failure_learning_performed: false,
      retain_revise_decision_performed: false,
      world_truth_authority: false,
      causal_outcome_authority: false,
    });
  }
  receipts.sort((left, right) => compareText(left.receipt_id, right.receipt_id));
  const bundle = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: choiceBundle.receipt_bundle_hash,
    receipt_count: receipts.length,
    receipts,
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_is_authoritative: true,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      causal_credit_not_assigned: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return Object.freeze(cloneJson(bundle));
}
