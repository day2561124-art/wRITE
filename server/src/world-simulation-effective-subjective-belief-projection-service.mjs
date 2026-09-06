import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  subjectiveClaimEventSchemaVersion,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  subjectiveClaimRelationEventSchemaVersion,
} from "./world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  subjectiveBeliefResolutionDecisionSchemaVersion,
  worldSimulationSubjectiveBeliefResolutionVersion,
} from "./world-simulation-subjective-belief-resolution-service.mjs";
import {
  subjectiveBeliefRevisionEventSchemaVersion,
  subjectiveBeliefRevisionHistoryReferenceSchemaVersion,
  worldSimulationSubjectiveBeliefRevisionVersion,
} from "./world-simulation-subjective-belief-revision-service.mjs";

export const worldSimulationEffectiveSubjectiveBeliefProjectionVersion =
  "phase66b-effective-subjective-belief-projection-v1";

export const effectiveSubjectiveBeliefEntrySchemaVersion =
  "phase66b-effective-subjective-belief-entry-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
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
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function optionalString(value) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function sameCharacter(left, right) {
  return String(left ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()))]
    .filter(Boolean)
    .sort(compareText);
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

const commitmentByAction = Object.freeze({
  adopt: "active",
  supersede: "superseded",
});

function canonicalClaim(worldState, claimEventId, character) {
  const event = object(
    object(worldState.subjective_claim_events)[claimEventId],
  );

  if (
    !Object.keys(event).length
    || event.schema_version !== subjectiveClaimEventSchemaVersion
    || event.immutable !== true
    || event.claim_event_id !== claimEventId
    || !optionalString(event.claim_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.proposition)
    || !optionalString(event.proposition_hash)
    || event.status !== "candidate_subjective_claim"
  ) {
    const error = new Error(
      `Phase66B cannot resolve canonical SubjectiveClaimEvent ${claimEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_CLAIM_UNRESOLVED";
    throw error;
  }

  const body = cloneJson(event);
  delete body.claim_event_hash;
  if (hashAgentRunValue(body) !== event.claim_event_hash) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} failed Phase66B hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_CLAIM_HASH_MISMATCH";
    throw error;
  }

  if (!sameCharacter(event.character, character)) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} crosses the Phase66B character boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_CHARACTER_MISMATCH";
    throw error;
  }

  return event;
}

function canonicalRelation(worldState, relationEventId, character) {
  const event = object(
    object(worldState.subjective_claim_relation_events)[relationEventId],
  );

  if (
    !Object.keys(event).length
    || event.schema_version !== subjectiveClaimRelationEventSchemaVersion
    || event.immutable !== true
    || event.relation_event_id !== relationEventId
    || !optionalString(event.relation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.source_claim_event_id)
    || !optionalString(event.target_claim_event_id)
    || !["challenges", "supersedes"].includes(event.relation)
    || event.status !== "candidate_subjective_claim_relation"
  ) {
    const error = new Error(
      `Phase66B cannot resolve canonical SubjectiveClaimRelationEvent ${relationEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_RELATION_UNRESOLVED";
    throw error;
  }

  const body = cloneJson(event);
  delete body.relation_event_hash;
  if (hashAgentRunValue(body) !== event.relation_event_hash) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} failed Phase66B hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_RELATION_HASH_MISMATCH";
    throw error;
  }

  if (!sameCharacter(event.character, character)) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} crosses the Phase66B character boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_CHARACTER_MISMATCH";
    throw error;
  }

  const sourceClaim = canonicalClaim(
    worldState,
    event.source_claim_event_id,
    character,
  );
  const targetClaim = canonicalClaim(
    worldState,
    event.target_claim_event_id,
    character,
  );

  if (
    event.source_claim_event_hash !== sourceClaim.claim_event_hash
    || event.target_claim_event_hash !== targetClaim.claim_event_hash
    || event.source_claim_proposition_hash !== sourceClaim.proposition_hash
    || event.target_claim_proposition_hash !== targetClaim.proposition_hash
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} does not pin canonical claims.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  return event;
}

function validateSourceDecision(decision, worldState, event) {
  if (
    !isObject(decision)
    || decision.schema_version !== subjectiveBeliefResolutionDecisionSchemaVersion
    || !optionalString(decision.decision_id)
    || !optionalString(decision.decision_hash)
    || !optionalString(decision.character)
    || !optionalString(decision.source_turn_id)
    || !["adopt", "supersede"].includes(decision.action)
    || commitmentByAction[decision.action] !== decision.commitment
    || !Array.isArray(decision.claim_event_ids)
    || !Array.isArray(decision.relation_event_ids)
    || !optionalString(decision.reason)
    || decision.subjective_not_world_truth !== true
    || decision.confidence !== null
    || decision.probability !== null
  ) {
    const error = new Error(
      "Phase66B requires an actionable canonical Phase65D source decision.",
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_DECISION_INVALID";
    throw error;
  }

  const claimIds = uniqueSorted(decision.claim_event_ids);
  const relationIds = uniqueSorted(decision.relation_event_ids);
  if (
    !sameValue(claimIds, decision.claim_event_ids)
    || !sameValue(relationIds, decision.relation_event_ids)
  ) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} has non-canonical references.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_DECISION_REFERENCE_ORDER_INVALID";
    throw error;
  }

  const expectedDecisionId =
    `subjective_belief_resolution_${hashAgentRunValue({
      version: worldSimulationSubjectiveBeliefResolutionVersion,
      character: decision.character,
      source_turn_id: decision.source_turn_id,
      action: decision.action,
      commitment: decision.commitment,
      claim_event_ids: claimIds,
      relation_event_ids: relationIds,
      reason: decision.reason,
    }).slice(0, 24)}`;

  const decisionBody = cloneJson(decision);
  delete decisionBody.decision_hash;
  if (
    decision.decision_id !== expectedDecisionId
    || hashAgentRunValue(decisionBody) !== decision.decision_hash
  ) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} failed deterministic identity/hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_DECISION_HASH_MISMATCH";
    throw error;
  }

  const derivation = object(decision.derivation);
  const audit = object(decision.engine_audit);
  if (
    derivation.mode !== "explicit_local_claim_relation_resolution_v1"
    || derivation.hidden_semantic_graph_traversal_used !== false
    || derivation.deterministic_sort_used_as_epistemic_precedence !== false
    || audit.claim_hashes_verified !== true
    || audit.relation_hashes_verified !== true
    || audit.relation_claim_hash_pinning_verified !== true
    || audit.same_character_scope_verified !== true
    || audit.historical_claim_mutation_applied !== false
    || audit.historical_relation_mutation_applied !== false
    || audit.world_state_mutation_applied !== false
    || audit.world_truth_authority_claimed !== false
    || audit.retrieval_frequency_used_as_credibility !== false
    || audit.accessibility_strength_used_as_credibility !== false
    || audit.plasticity_strength_used_as_truth_support !== false
    || audit.confidence_probability_modeled !== false
    || audit.last_write_wins_applied !== false
    || audit.same_turn_character_brain_feedback_allowed !== false
  ) {
    const error = new Error(
      `Phase65D decision ${decision.decision_id} violates the Phase66B source boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_DECISION_BOUNDARY_VIOLATION";
    throw error;
  }

  if (
    decision.decision_id !== event.source_resolution_decision_id
    || decision.decision_hash !== event.source_resolution_decision_hash
    || !sameCharacter(decision.character, event.character)
    || decision.source_turn_id !== event.source_turn_id
    || decision.action !== event.resolution_action
    || decision.commitment !== event.to_commitment
  ) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${event.belief_revision_event_id} does not match its source decision.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_SOURCE_DECISION_MISMATCH";
    throw error;
  }

  const claims = claimIds.map(
    (claimId) => canonicalClaim(worldState, claimId, decision.character),
  );
  const relations = relationIds.map(
    (relationId) => canonicalRelation(worldState, relationId, decision.character),
  );

  return { decision, claims, relations };
}

function validateRevisionEvent(event, eventId, worldState) {
  if (
    !isObject(event)
    || event.schema_version !== subjectiveBeliefRevisionEventSchemaVersion
    || event.immutable !== true
    || event.belief_revision_event_id !== eventId
    || !optionalString(event.belief_revision_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.source_resolution_decision_id)
    || !optionalString(event.source_resolution_decision_hash)
    || !["adopt", "supersede"].includes(event.resolution_action)
    || event.from_commitment !== null
    || commitmentByAction[event.resolution_action] !== event.to_commitment
    || !Array.isArray(event.claim_references)
    || !Array.isArray(event.relation_references)
    || !Array.isArray(event.adopted_claim_event_ids)
    || !Array.isArray(event.superseded_claim_event_ids)
    || !Array.isArray(event.suspended_claim_event_ids)
    || !Array.isArray(event.withdrawn_claim_event_ids)
    || event.status !== "subjective_belief_revision_recorded"
  ) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${eventId} is invalid for Phase66B projection.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_INVALID";
    throw error;
  }

  const body = cloneJson(event);
  delete body.belief_revision_event_hash;
  if (hashAgentRunValue(body) !== event.belief_revision_event_hash) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${eventId} failed Phase66B hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_HASH_MISMATCH";
    throw error;
  }

  const expectedEventId =
    `subjective_belief_revision_event_${hashAgentRunValue({
      version: worldSimulationSubjectiveBeliefRevisionVersion,
      source_turn_id: event.source_turn_id,
      character: event.character,
      source_resolution_decision_id: event.source_resolution_decision_id,
      source_resolution_decision_hash: event.source_resolution_decision_hash,
      resolution_action: event.resolution_action,
      previous_belief_revision_event_hash:
        event.previous_belief_revision_event_hash ?? null,
    }).slice(0, 24)}`;

  if (eventId !== expectedEventId) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${eventId} failed deterministic identity verification.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_IDENTITY_MISMATCH";
    throw error;
  }

  const source = validateSourceDecision(
    event.source_resolution_decision,
    worldState,
    event,
  );

  const expectedClaimReferences = source.claims
    .map((claim) => ({
      claim_event_id: claim.claim_event_id,
      claim_event_hash: claim.claim_event_hash,
      proposition_hash: claim.proposition_hash,
      source_turn_id: claim.source_turn_id,
    }))
    .sort((left, right) => compareText(left.claim_event_id, right.claim_event_id));

  const expectedRelationReferences = source.relations
    .map((relation) => ({
      relation_event_id: relation.relation_event_id,
      relation_event_hash: relation.relation_event_hash,
      relation: relation.relation,
      source_claim_event_id: relation.source_claim_event_id,
      target_claim_event_id: relation.target_claim_event_id,
    }))
    .sort((left, right) => compareText(left.relation_event_id, right.relation_event_id));

  const expectedAdopted = event.resolution_action === "adopt"
    ? [...source.decision.claim_event_ids]
    : [];
  const expectedSuperseded = event.resolution_action === "supersede"
    ? uniqueSorted(
      source.relations.map((relation) => relation.target_claim_event_id),
    )
    : [];

  if (
    !sameValue(event.claim_references, expectedClaimReferences)
    || !sameValue(event.relation_references, expectedRelationReferences)
    || !sameValue(event.adopted_claim_event_ids, expectedAdopted)
    || !sameValue(event.superseded_claim_event_ids, expectedSuperseded)
    || event.suspended_claim_event_ids.length !== 0
    || event.withdrawn_claim_event_ids.length !== 0
  ) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${eventId} does not preserve its exact source semantics.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_SEMANTICS_MISMATCH";
    throw error;
  }

  const semantic = object(event.semantic_state);
  const derivation = object(event.derivation);
  const audit = object(event.engine_audit);
  if (
    semantic.subjective_not_world_truth !== true
    || semantic.world_truth_verified !== false
    || semantic.confidence !== null
    || semantic.probability !== null
    || semantic.effective_belief_projection_applied !== false
    || derivation.mode !== "phase65d_resolution_to_append_only_revision_event_v1"
    || derivation.source_resolution_decision_hash_pinned !== true
    || derivation.source_claim_hashes_pinned !== true
    || derivation.source_relation_hashes_pinned !== true
    || derivation.deterministic_sort_used_as_epistemic_precedence !== false
    || derivation.hidden_semantic_graph_traversal_used !== false
    || audit.source_resolution_decision_hash_verified !== true
    || audit.source_claim_hashes_verified !== true
    || audit.source_relation_hashes_verified !== true
    || audit.same_character_scope_verified !== true
    || audit.unresolved_decision_persisted !== false
    || audit.historical_claim_mutation_applied !== false
    || audit.historical_relation_mutation_applied !== false
    || audit.historical_revision_mutation_applied !== false
    || audit.effective_belief_projection_applied !== false
    || audit.world_truth_authority_claimed !== false
    || audit.confidence_probability_modeled !== false
    || audit.retrieval_frequency_used_as_credibility !== false
    || audit.accessibility_strength_used_as_credibility !== false
    || audit.plasticity_strength_used_as_truth_support !== false
    || audit.last_write_wins_applied !== false
    || audit.same_turn_character_brain_feedback_allowed !== false
  ) {
    const error = new Error(
      `SubjectiveBeliefRevisionEvent ${eventId} violates the Phase66B source boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_BOUNDARY_VIOLATION";
    throw error;
  }

  return event;
}

function validateRevisionHistory(worldState) {
  if (
    Object.hasOwn(worldState, "subjective_belief_revision_events")
    && !isObject(worldState.subjective_belief_revision_events)
  ) {
    const error = new Error(
      "subjective_belief_revision_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_belief_revision_history")
    && !Array.isArray(worldState.subjective_belief_revision_history)
  ) {
    const error = new Error(
      "subjective_belief_revision_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.subjective_belief_revision_events);
  const history = array(worldState.subjective_belief_revision_history);
  const ordered = [];
  const seenEventIds = new Set();
  const seenDecisionIds = new Set();
  const latestByCharacter = new Map();

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.belief_revision_event_id);
    const decisionId = optionalString(reference?.source_resolution_decision_id);

    if (
      !isObject(reference)
      || reference.schema_version
        !== subjectiveBeliefRevisionHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !optionalString(reference.belief_revision_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !decisionId
      || !optionalString(reference.source_resolution_decision_hash)
      || !["adopt", "supersede"].includes(reference.resolution_action)
      || commitmentByAction[reference.resolution_action]
        !== reference.to_commitment
      || reference.status !== "subjective_belief_revision_recorded"
    ) {
      const error = new Error(
        `subjective_belief_revision_history[${index}] is invalid for Phase66B.`,
      );
      error.code =
        "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seenEventIds.has(eventId) || seenDecisionIds.has(decisionId)) {
      const error = new Error(
        `subjective_belief_revision_history contains duplicate event or decision at index ${index}.`,
      );
      error.code =
        "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_DUPLICATE";
      throw error;
    }

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_belief_revision_history cannot resolve SubjectiveBeliefRevisionEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_UNRESOLVED";
      throw error;
    }

    validateRevisionEvent(event, eventId, worldState);

    const characterKey = String(reference.character)
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
    const previous = latestByCharacter.get(characterKey) ?? null;
    const expectedPreviousId = previous?.belief_revision_event_id ?? null;
    const expectedPreviousHash = previous?.belief_revision_event_hash ?? null;

    if (
      reference.belief_revision_event_hash !== event.belief_revision_event_hash
      || !sameCharacter(reference.character, event.character)
      || reference.source_turn_id !== event.source_turn_id
      || reference.source_resolution_decision_id
        !== event.source_resolution_decision_id
      || reference.source_resolution_decision_hash
        !== event.source_resolution_decision_hash
      || reference.resolution_action !== event.resolution_action
      || reference.to_commitment !== event.to_commitment
      || reference.previous_belief_revision_event_id
        !== event.previous_belief_revision_event_id
      || reference.previous_belief_revision_event_hash
        !== event.previous_belief_revision_event_hash
      || event.previous_belief_revision_event_id !== expectedPreviousId
      || event.previous_belief_revision_event_hash !== expectedPreviousHash
      || reference.status !== event.status
    ) {
      const error = new Error(
        `subjective_belief_revision_history reference ${eventId} does not match its canonical per-character chain.`,
      );
      error.code =
        "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    seenEventIds.add(eventId);
    seenDecisionIds.add(decisionId);
    latestByCharacter.set(characterKey, event);
    ordered.push(event);
  }

  return {
    events,
    history,
    ordered,
    referenced_event_ids: seenEventIds,
  };
}

function claimLineageFor(event, claimId) {
  const supersedes = [];
  const supersededBy = [];
  for (const relation of array(event.relation_references)) {
    if (relation.relation !== "supersedes") continue;
    if (relation.source_claim_event_id === claimId) {
      supersedes.push(relation.target_claim_event_id);
    }
    if (relation.target_claim_event_id === claimId) {
      supersededBy.push(relation.source_claim_event_id);
    }
  }
  return {
    supersedes_claim_event_ids: uniqueSorted(supersedes),
    superseded_by_claim_event_ids: uniqueSorted(supersededBy),
  };
}

function applyExplicitRevision(stateByClaim, worldState, event, claimId, commitment) {
  const claim = canonicalClaim(worldState, claimId, event.character);
  const previous = stateByClaim.get(claimId) ?? null;
  const lineage = claimLineageFor(event, claimId);

  const entry = {
    schema_version: effectiveSubjectiveBeliefEntrySchemaVersion,
    character: claim.character,
    claim_event_id: claim.claim_event_id,
    claim_event_hash: claim.claim_event_hash,
    proposition: claim.proposition,
    proposition_hash: claim.proposition_hash,
    claim_source_turn_id: claim.source_turn_id,
    commitment,
    first_revision_event_id:
      previous?.first_revision_event_id ?? event.belief_revision_event_id,
    first_revision_turn_id:
      previous?.first_revision_turn_id ?? event.source_turn_id,
    latest_revision_event_id: event.belief_revision_event_id,
    latest_revision_event_hash: event.belief_revision_event_hash,
    latest_revision_turn_id: event.source_turn_id,
    latest_resolution_action: event.resolution_action,
    revision_event_count: (previous?.revision_event_count ?? 0) + 1,
    supersedes_claim_event_ids: uniqueSorted([
      ...array(previous?.supersedes_claim_event_ids),
      ...lineage.supersedes_claim_event_ids,
    ]),
    superseded_by_claim_event_ids: uniqueSorted([
      ...array(previous?.superseded_by_claim_event_ids),
      ...lineage.superseded_by_claim_event_ids,
    ]),
    subjective_not_world_truth: true,
    confidence: null,
    probability: null,
  };

  stateByClaim.set(claimId, entry);
}

function entrySort(left, right) {
  const claimTurnOrder = compareText(
    left.claim_source_turn_id,
    right.claim_source_turn_id,
  );
  if (claimTurnOrder !== 0) return claimTurnOrder;
  return compareText(left.claim_event_id, right.claim_event_id);
}

export function buildWorldSimulationEffectiveSubjectiveBeliefProjectionContract() {
  return deepFreeze({
    version: worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
    phase: "Phase66B",
    status: "effective_subjective_belief_read_projection_installed",
    entry_schema_version: effectiveSubjectiveBeliefEntrySchemaVersion,
    source_revision_version: worldSimulationSubjectiveBeliefRevisionVersion,
    source_of_truth: "append_only_subjective_belief_revision_history",
    event_store_remains_authoritative: true,
    projection_is_read_model: true,
    projection_is_rebuildable_from_event_history: true,
    projection_persistence_installed: false,
    projection_snapshot_is_authority: false,
    pure_projection_required: true,
    world_state_mutation_allowed: false,
    historical_claim_mutation_allowed: false,
    historical_relation_mutation_allowed: false,
    historical_revision_mutation_allowed: false,
    per_character_revision_hash_chain_verified: true,
    source_decision_hashes_verified: true,
    source_claim_hashes_verified: true,
    source_relation_hashes_verified: true,
    explicit_revision_semantics_only: true,
    deterministic_history_order_used_for_temporal_replay: true,
    deterministic_history_order_is_epistemic_precedence: false,
    last_write_wins_allowed: false,
    unresolved_resolution_promoted_without_revision_event: false,
    recognized_v1_commitments: ["active", "superseded"],
    suspended_commitment_projection_installed: false,
    withdrawn_commitment_projection_installed: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    retrieval_frequency_counts_as_credibility: false,
    accessibility_strength_counts_as_credibility: false,
    plasticity_strength_counts_as_truth_support: false,
    character_brain_exposure_installed: false,
    action_proposer_exposure_installed: false,
    same_turn_character_brain_feedback_allowed: false,
    bounded_character_exposure_owner: "Phase66C",
  });
}

export function projectWorldSimulationEffectiveSubjectiveBeliefs(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const inputHashBefore = hashAgentRunValue(worldState);
  const validated = validateRevisionHistory(worldState);
  const stateByClaim = new Map();

  const characterEvents = validated.ordered.filter(
    (event) => sameCharacter(event.character, character),
  );

  for (const event of characterEvents) {
    for (const claimId of event.adopted_claim_event_ids) {
      applyExplicitRevision(
        stateByClaim,
        worldState,
        event,
        claimId,
        "active",
      );
    }
    for (const claimId of event.superseded_claim_event_ids) {
      applyExplicitRevision(
        stateByClaim,
        worldState,
        event,
        claimId,
        "superseded",
      );
    }
  }

  const entries = [...stateByClaim.values()].sort(entrySort);
  const activeBeliefs = entries
    .filter((entry) => entry.commitment === "active")
    .map(cloneJson);
  const supersededBeliefs = entries
    .filter((entry) => entry.commitment === "superseded")
    .map(cloneJson);

  const referencedStoreIds = validated.referenced_event_ids;
  const unreferencedRevisionEventCount = Object.keys(validated.events)
    .filter((eventId) => !referencedStoreIds.has(eventId))
    .length;

  const projectionBody = {
    source: "append_only_subjective_belief_revision_history",
    character,
    active_beliefs: activeBeliefs,
    superseded_beliefs: supersededBeliefs,
    effective_belief_count: entries.length,
    active_belief_count: activeBeliefs.length,
    superseded_belief_count: supersededBeliefs.length,
    source_revision_event_count: characterEvents.length,
    subjective_not_world_truth: true,
  };

  const projection = {
    ...projectionBody,
    projection_hash: hashAgentRunValue(projectionBody),
  };

  if (hashAgentRunValue(worldState) !== inputHashBefore) {
    const error = new Error(
      "Phase66B effective belief projection mutated its world-state input.",
    );
    error.code =
      "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
    character,
    projection,
    audit: {
      source_revision_version: worldSimulationSubjectiveBeliefRevisionVersion,
      full_revision_history_verified: true,
      per_character_revision_hash_chain_verified: true,
      source_decision_hashes_verified: true,
      source_claim_hashes_verified: true,
      source_relation_hashes_verified: true,
      explicit_revision_semantics_only: true,
      temporal_replay_event_count: characterEvents.length,
      deterministic_history_order_used_as_epistemic_precedence: false,
      last_write_wins_applied: false,
      unreferenced_revision_event_count: unreferencedRevisionEventCount,
      unreferenced_revision_events_affect_projection: false,
      unresolved_resolution_promoted_without_revision_event: false,
      persistent_projection_written: false,
      world_state_mutated: false,
      historical_claims_rewritten: false,
      historical_relations_rewritten: false,
      historical_revision_events_rewritten: false,
      world_truth_fields_consumed: false,
      confidence_probability_modeled: false,
      retrieval_frequency_used_as_credibility: false,
      accessibility_strength_used_as_credibility: false,
      plasticity_strength_used_as_truth_support: false,
      character_brain_exposure_applied: false,
      action_proposer_exposure_applied: false,
      same_turn_character_brain_feedback_allowed: false,
    },
  });
}
