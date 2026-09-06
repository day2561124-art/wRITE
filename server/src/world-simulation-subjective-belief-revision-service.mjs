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

export const worldSimulationSubjectiveBeliefRevisionVersion =
  "phase66a-append-only-subjective-belief-revision-v1";

export const subjectiveBeliefRevisionEventSchemaVersion =
  "phase66a-subjective-belief-revision-event-v1";

export const subjectiveBeliefRevisionHistoryReferenceSchemaVersion =
  "phase66a-subjective-belief-revision-history-ref-v1";

function isObject(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value);
}

function object(value) {
  return isObject(value)
    ? value
    : {};
}

function array(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (
    !value
    || typeof value !== "object"
    || Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

function optionalString(value) {
  return typeof value === "string"
    && value.trim()
    ? value.trim()
    : null;
}

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_INPUT_INVALID",
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
  return String(left ?? "")
    .localeCompare(String(right ?? ""), "en");
}

function uniqueSorted(values) {
  return [...new Set(values)]
    .sort(compareText);
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null)
    === JSON.stringify(right ?? null);
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
    || !optionalString(event.proposition_hash)
    || event.status !== "candidate_subjective_claim"
  ) {
    const error = new Error(
      `Phase66A cannot resolve canonical SubjectiveClaimEvent ${claimEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CLAIM_UNRESOLVED";
    throw error;
  }

  const body = cloneJson(event);
  delete body.claim_event_hash;
  if (hashAgentRunValue(body) !== event.claim_event_hash) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} failed Phase66A hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  if (!sameCharacter(event.character, character)) {
    const error = new Error(
      `SubjectiveClaimEvent ${claimEventId} crosses the Phase66A character boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CHARACTER_MISMATCH";
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
      `Phase66A cannot resolve canonical SubjectiveClaimRelationEvent ${relationEventId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_UNRESOLVED";
    throw error;
  }

  const body = cloneJson(event);
  delete body.relation_event_hash;
  if (hashAgentRunValue(body) !== event.relation_event_hash) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} failed Phase66A hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_HASH_MISMATCH";
    throw error;
  }

  if (!sameCharacter(event.character, character)) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${relationEventId} crosses the Phase66A character boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_CHARACTER_MISMATCH";
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
      `SubjectiveClaimRelationEvent ${relationEventId} does not pin canonical claim images.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  return event;
}

function assertResolutionDecision(decision, worldState, expectedTurnId = null) {
  const decisionId = optionalString(decision?.decision_id);
  const character = optionalString(decision?.character);
  const sourceTurnId = optionalString(decision?.source_turn_id);

  if (
    !isObject(decision)
    || decision.schema_version !== subjectiveBeliefResolutionDecisionSchemaVersion
    || !decisionId
    || !optionalString(decision.decision_hash)
    || !character
    || !sourceTurnId
    || !["adopt", "supersede", "unresolved"].includes(decision.action)
    || !["active", "superseded", "unresolved"].includes(decision.commitment)
    || !Array.isArray(decision.claim_event_ids)
    || !Array.isArray(decision.relation_event_ids)
    || !optionalString(decision.reason)
    || decision.subjective_not_world_truth !== true
    || decision.confidence !== null
    || decision.probability !== null
  ) {
    const error = new Error(
      "Phase66A requires a canonical Phase65D resolution decision.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_INVALID";
    throw error;
  }

  if (expectedTurnId && sourceTurnId !== expectedTurnId) {
    const error = new Error(
      `Phase65D decision ${decisionId} is not from expected turn ${expectedTurnId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_TURN_MISMATCH";
    throw error;
  }

  if (
    decision.action !== "unresolved"
    && commitmentByAction[decision.action] !== decision.commitment
  ) {
    const error = new Error(
      `Phase65D decision ${decisionId} has an invalid action/commitment pair.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_COMMITMENT_MISMATCH";
    throw error;
  }

  if (
    decision.action === "unresolved"
    && decision.commitment !== "unresolved"
  ) {
    const error = new Error(
      `Phase65D unresolved decision ${decisionId} must remain unresolved.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_COMMITMENT_MISMATCH";
    throw error;
  }

  const claimIds = uniqueSorted(
    decision.claim_event_ids.map((value) => requiredString(value, "claim_event_id")),
  );
  const relationIds = uniqueSorted(
    decision.relation_event_ids.map((value) => requiredString(value, "relation_event_id")),
  );

  if (
    !sameValue(claimIds, decision.claim_event_ids)
    || !sameValue(relationIds, decision.relation_event_ids)
  ) {
    const error = new Error(
      `Phase65D decision ${decisionId} must use unique deterministic reference ordering.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_REFERENCE_ORDER_INVALID";
    throw error;
  }

  const expectedDecisionId =
    `subjective_belief_resolution_${hashAgentRunValue({
      version:
        worldSimulationSubjectiveBeliefResolutionVersion,
      character,
      source_turn_id:
        sourceTurnId,
      action:
        decision.action,
      commitment:
        decision.commitment,
      claim_event_ids:
        claimIds,
      relation_event_ids:
        relationIds,
      reason:
        decision.reason,
    }).slice(0, 24)}`;

  const body = cloneJson(decision);
  delete body.decision_hash;

  if (
    decisionId !== expectedDecisionId
    || hashAgentRunValue(body) !== decision.decision_hash
  ) {
    const error = new Error(
      `Phase65D decision ${decisionId} failed deterministic identity/hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_HASH_MISMATCH";
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
      `Phase65D decision ${decisionId} violates the Phase66A provenance boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_AUTHORITY_BOUNDARY_VIOLATION";
    throw error;
  }

  const claims = claimIds.map(
    (claimEventId) => canonicalClaim(worldState, claimEventId, character),
  );
  const relations = relationIds.map(
    (relationEventId) => canonicalRelation(worldState, relationEventId, character),
  );

  if (decision.action === "adopt") {
    if (claimIds.length !== 1) {
      const error = new Error(
        `Phase66A adopt decision ${decisionId} must identify exactly one adopted claim.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_ADOPT_CLAIM_COUNT_INVALID";
      throw error;
    }

    for (const relation of relations) {
      if (
        relation.relation !== "supersedes"
        || relation.source_claim_event_id !== claimIds[0]
      ) {
        const error = new Error(
          `Phase66A adopt decision ${decisionId} contains a non-source supersession relation.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_ADOPT_RELATION_INVALID";
        throw error;
      }
    }
  }

  if (decision.action === "supersede") {
    if (relations.length !== 1 || relations[0].relation !== "supersedes") {
      const error = new Error(
        `Phase66A supersede decision ${decisionId} requires one canonical supersedes relation.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SUPERSESSION_RELATION_INVALID";
      throw error;
    }
    if (!claimIds.includes(relations[0].target_claim_event_id)) {
      const error = new Error(
        `Phase66A supersede decision ${decisionId} does not include its target claim.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SUPERSESSION_TARGET_INVALID";
      throw error;
    }
  }

  return {
    decision,
    claims,
    relations,
  };
}

function claimReferenceFor(event) {
  return {
    claim_event_id: event.claim_event_id,
    claim_event_hash: event.claim_event_hash,
    proposition_hash: event.proposition_hash,
    source_turn_id: event.source_turn_id,
  };
}

function relationReferenceFor(event) {
  return {
    relation_event_id: event.relation_event_id,
    relation_event_hash: event.relation_event_hash,
    relation: event.relation,
    source_claim_event_id: event.source_claim_event_id,
    target_claim_event_id: event.target_claim_event_id,
  };
}

function semanticClaimSets(decision, relations) {
  if (decision.action === "adopt") {
    return {
      adopted_claim_event_ids: [...decision.claim_event_ids],
      superseded_claim_event_ids: [],
      suspended_claim_event_ids: [],
      withdrawn_claim_event_ids: [],
    };
  }

  if (decision.action === "supersede") {
    return {
      adopted_claim_event_ids: [],
      superseded_claim_event_ids:
        uniqueSorted(relations.map((relation) => relation.target_claim_event_id)),
      suspended_claim_event_ids: [],
      withdrawn_claim_event_ids: [],
    };
  }

  return {
    adopted_claim_event_ids: [],
    superseded_claim_event_ids: [],
    suspended_claim_event_ids: [],
    withdrawn_claim_event_ids: [],
  };
}

function revisionEventFor({
  decision,
  claims,
  relations,
  previousEvent,
}) {
  const previousEventId = previousEvent?.belief_revision_event_id ?? null;
  const previousEventHash = previousEvent?.belief_revision_event_hash ?? null;
  const semanticSets = semanticClaimSets(decision, relations);

  const eventId =
    `subjective_belief_revision_event_${hashAgentRunValue({
      version: worldSimulationSubjectiveBeliefRevisionVersion,
      source_turn_id: decision.source_turn_id,
      character: decision.character,
      source_resolution_decision_id: decision.decision_id,
      source_resolution_decision_hash: decision.decision_hash,
      resolution_action: decision.action,
      previous_belief_revision_event_hash: previousEventHash,
    }).slice(0, 24)}`;

  const body = {
    schema_version: subjectiveBeliefRevisionEventSchemaVersion,
    belief_revision_event_id: eventId,
    character: decision.character,
    source_turn_id: decision.source_turn_id,
    source_resolution_decision_id: decision.decision_id,
    source_resolution_decision_hash: decision.decision_hash,
    source_resolution_decision: cloneJson(decision),
    resolution_action: decision.action,
    resolution_reason: decision.reason,
    from_commitment: null,
    to_commitment: decision.commitment,
    claim_references:
      claims.map(claimReferenceFor).sort(
        (left, right) => compareText(left.claim_event_id, right.claim_event_id),
      ),
    relation_references:
      relations.map(relationReferenceFor).sort(
        (left, right) => compareText(left.relation_event_id, right.relation_event_id),
      ),
    ...semanticSets,
    previous_belief_revision_event_id: previousEventId,
    previous_belief_revision_event_hash: previousEventHash,
    status: "subjective_belief_revision_recorded",
    semantic_state: {
      subjective_not_world_truth: true,
      world_truth_verified: false,
      confidence: null,
      probability: null,
      effective_belief_projection_applied: false,
    },
    derivation: {
      mode: "phase65d_resolution_to_append_only_revision_event_v1",
      source_resolution_decision_hash_pinned: true,
      source_claim_hashes_pinned: true,
      source_relation_hashes_pinned: true,
      previous_event_hash_pinned: previousEventHash !== null,
      deterministic_sort_used_for_serialization_only: true,
      deterministic_sort_used_as_epistemic_precedence: false,
      hidden_semantic_graph_traversal_used: false,
    },
    engine_audit: {
      source_resolution_decision_hash_verified: true,
      source_claim_hashes_verified: true,
      source_relation_hashes_verified: true,
      same_character_scope_verified: true,
      unresolved_decision_persisted: false,
      historical_claim_mutation_applied: false,
      historical_relation_mutation_applied: false,
      historical_revision_mutation_applied: false,
      effective_belief_projection_applied: false,
      world_truth_authority_claimed: false,
      confidence_probability_modeled: false,
      retrieval_frequency_used_as_credibility: false,
      accessibility_strength_used_as_credibility: false,
      plasticity_strength_used_as_truth_support: false,
      last_write_wins_applied: false,
      same_turn_character_brain_feedback_allowed: false,
    },
    immutable: true,
  };

  return {
    ...body,
    belief_revision_event_hash: hashAgentRunValue(body),
  };
}

function historyReferenceFor(event) {
  return {
    schema_version: subjectiveBeliefRevisionHistoryReferenceSchemaVersion,
    derived_index: true,
    belief_revision_event_id: event.belief_revision_event_id,
    belief_revision_event_hash: event.belief_revision_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    source_resolution_decision_id: event.source_resolution_decision_id,
    source_resolution_decision_hash: event.source_resolution_decision_hash,
    resolution_action: event.resolution_action,
    to_commitment: event.to_commitment,
    previous_belief_revision_event_id: event.previous_belief_revision_event_id,
    previous_belief_revision_event_hash: event.previous_belief_revision_event_hash,
    status: event.status,
  };
}

function assertPersistedRevisionEvent(event, eventId, worldState) {
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
    || event.status !== "subjective_belief_revision_recorded"
  ) {
    const error = new Error(
      `Persisted SubjectiveBeliefRevisionEvent ${eventId} is invalid.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_INVALID";
    throw error;
  }

  const body = cloneJson(event);
  delete body.belief_revision_event_hash;
  if (hashAgentRunValue(body) !== event.belief_revision_event_hash) {
    const error = new Error(
      `Persisted SubjectiveBeliefRevisionEvent ${eventId} failed hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_HASH_MISMATCH";
    throw error;
  }

  const validated = assertResolutionDecision(
    event.source_resolution_decision,
    worldState,
    event.source_turn_id,
  );

  if (
    validated.decision.decision_id !== event.source_resolution_decision_id
    || validated.decision.decision_hash !== event.source_resolution_decision_hash
    || validated.decision.character !== event.character
    || validated.decision.action !== event.resolution_action
    || validated.decision.commitment !== event.to_commitment
  ) {
    const error = new Error(
      `Persisted SubjectiveBeliefRevisionEvent ${eventId} does not match its source Phase65D decision.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SOURCE_DECISION_MISMATCH";
    throw error;
  }

  const expectedClaimRefs = validated.claims
    .map(claimReferenceFor)
    .sort((left, right) => compareText(left.claim_event_id, right.claim_event_id));
  const expectedRelationRefs = validated.relations
    .map(relationReferenceFor)
    .sort((left, right) => compareText(left.relation_event_id, right.relation_event_id));
  const expectedSets = semanticClaimSets(validated.decision, validated.relations);

  if (
    !sameValue(event.claim_references, expectedClaimRefs)
    || !sameValue(event.relation_references, expectedRelationRefs)
    || !sameValue(event.adopted_claim_event_ids, expectedSets.adopted_claim_event_ids)
    || !sameValue(event.superseded_claim_event_ids, expectedSets.superseded_claim_event_ids)
    || !sameValue(event.suspended_claim_event_ids, [])
    || !sameValue(event.withdrawn_claim_event_ids, [])
  ) {
    const error = new Error(
      `Persisted SubjectiveBeliefRevisionEvent ${eventId} does not preserve its exact source claim/relation basis.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_SOURCE_BASIS_MISMATCH";
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

  const semantic = object(event.semantic_state);
  const derivation = object(event.derivation);
  const audit = object(event.engine_audit);

  if (
    eventId !== expectedEventId
    || semantic.subjective_not_world_truth !== true
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
      `Persisted SubjectiveBeliefRevisionEvent ${eventId} violates the Phase66A event boundary.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_BOUNDARY_VIOLATION";
    throw error;
  }

  return event;
}

function validateExistingRevisionHistory(worldState) {
  if (
    Object.hasOwn(worldState, "subjective_belief_revision_events")
    && !isObject(worldState.subjective_belief_revision_events)
  ) {
    const error = new Error(
      "subjective_belief_revision_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_STORE_INVALID";
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
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.subjective_belief_revision_events);
  const history = array(worldState.subjective_belief_revision_history);
  const seenEventIds = new Set();
  const seenDecisionIds = new Set();
  const latestByCharacter = new Map();
  const eventByDecisionId = new Map();

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.belief_revision_event_id);
    const decisionId = optionalString(reference?.source_resolution_decision_id);

    if (
      !isObject(reference)
      || reference.schema_version !== subjectiveBeliefRevisionHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !optionalString(reference.belief_revision_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !decisionId
      || !optionalString(reference.source_resolution_decision_hash)
      || !["adopt", "supersede"].includes(reference.resolution_action)
      || commitmentByAction[reference.resolution_action] !== reference.to_commitment
      || reference.status !== "subjective_belief_revision_recorded"
    ) {
      const error = new Error(
        `subjective_belief_revision_history[${index}] is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seenEventIds.has(eventId) || seenDecisionIds.has(decisionId)) {
      const error = new Error(
        `subjective_belief_revision_history contains duplicate event or source decision at index ${index}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_belief_revision_history cannot resolve SubjectiveBeliefRevisionEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    assertPersistedRevisionEvent(event, eventId, worldState);

    const previous = latestByCharacter.get(
      String(reference.character).toLocaleLowerCase("zh-Hant-TW"),
    ) ?? null;
    const expectedPreviousId = previous?.belief_revision_event_id ?? null;
    const expectedPreviousHash = previous?.belief_revision_event_hash ?? null;

    if (
      reference.belief_revision_event_hash !== event.belief_revision_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.source_resolution_decision_id !== event.source_resolution_decision_id
      || reference.source_resolution_decision_hash !== event.source_resolution_decision_hash
      || reference.resolution_action !== event.resolution_action
      || reference.to_commitment !== event.to_commitment
      || reference.previous_belief_revision_event_id !== event.previous_belief_revision_event_id
      || reference.previous_belief_revision_event_hash !== event.previous_belief_revision_event_hash
      || reference.status !== event.status
      || event.previous_belief_revision_event_id !== expectedPreviousId
      || event.previous_belief_revision_event_hash !== expectedPreviousHash
    ) {
      const error = new Error(
        `subjective_belief_revision_history reference ${eventId} does not match its canonical event chain.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    seenEventIds.add(eventId);
    seenDecisionIds.add(decisionId);
    latestByCharacter.set(
      String(reference.character).toLocaleLowerCase("zh-Hant-TW"),
      event,
    );
    eventByDecisionId.set(decisionId, event);
  }

  return {
    events,
    history,
    latestByCharacter,
    eventByDecisionId,
  };
}

export function buildWorldSimulationSubjectiveBeliefRevisionContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveBeliefRevisionVersion,
    phase: "Phase66A",
    status: "append_only_subjective_belief_revision_events_installed",
    revision_event_schema_version: subjectiveBeliefRevisionEventSchemaVersion,
    revision_history_reference_schema_version:
      subjectiveBeliefRevisionHistoryReferenceSchemaVersion,
    source_resolution_version: worldSimulationSubjectiveBeliefResolutionVersion,
    source_scope: "current_turn_phase65d_actionable_resolution_decisions_only",
    immutable_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    source_resolution_decision_hash_pinned: true,
    source_claim_hashes_pinned: true,
    source_relation_hashes_pinned: true,
    unresolved_decision_creates_revision_event: false,
    historical_claim_mutation_allowed: false,
    historical_relation_mutation_allowed: false,
    historical_revision_mutation_allowed: false,
    effective_belief_projection_installed: false,
    character_brain_exposure_installed: false,
    same_turn_character_brain_feedback_allowed: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    last_write_wins_allowed: false,
    hidden_semantic_graph_traversal_allowed: false,
    deterministic_history_order_is_epistemic_precedence: false,
    authoritative_mutation_owner: "phase62k-authoritative-mutation-executor-v1",
    native_world_loop_adoption_installed: true,
    current_belief_projection_owner: "Phase66B",
  });
}

export function buildWorldSimulationSubjectiveBeliefRevisions(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const resolution = object(input.resolution);

  if (
    resolution.turn_id !== turnId
    || !Array.isArray(resolution.decisions)
  ) {
    const error = new Error(
      "Phase66A resolution must be the current turn's Phase65D result.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_RESOLUTION_INVALID";
    throw error;
  }

  const existing = validateExistingRevisionHistory(worldState);
  const validatedDecisions = resolution.decisions
    .map((decision) => assertResolutionDecision(decision, worldState, turnId))
    .sort((left, right) => {
      const characterOrder = left.decision.character.localeCompare(
        right.decision.character,
        "zh-Hant-TW",
      );
      if (characterOrder !== 0) return characterOrder;
      return compareText(left.decision.decision_id, right.decision.decision_id);
    });

  const seenDecisionIds = new Set();
  for (const validated of validatedDecisions) {
    if (seenDecisionIds.has(validated.decision.decision_id)) {
      const error = new Error(
        `Phase66A received duplicate Phase65D decision ${validated.decision.decision_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_DECISION_DUPLICATE";
      throw error;
    }
    seenDecisionIds.add(validated.decision.decision_id);
  }

  const actionable = validatedDecisions.filter(
    (validated) => validated.decision.action !== "unresolved",
  );

  if (!actionable.length) {
    return deepFreeze({
      ok: true,
      version: worldSimulationSubjectiveBeliefRevisionVersion,
      result: {
        processed_resolution_decision_count: validatedDecisions.length,
        actionable_resolution_decision_count: 0,
        unresolved_resolution_decision_count: validatedDecisions.length,
        revision_events_created: [],
        already_persisted_revision_event_ids: [],
        history_references_appended: [],
        state_transitions: [],
        preview_world_state: worldState,
        audit: {
          no_actionable_resolution_decisions: true,
          synthetic_empty_containers_created: false,
          unresolved_decision_persisted: false,
          historical_claims_rewritten: false,
          historical_relations_rewritten: false,
          historical_revision_events_rewritten: false,
          effective_belief_projection_applied: false,
          world_truth_authority_claimed: false,
          confidence_probability_modeled: false,
          last_write_wins_applied: false,
          same_turn_character_brain_feedback_allowed: false,
        },
      },
    });
  }

  const preview = cloneJson(worldState);
  const createdEvents = [];
  const alreadyPersisted = [];
  const eventTransitions = [];
  const references = [];
  const latestByCharacter = new Map(existing.latestByCharacter);

  for (const validated of actionable) {
    const decision = validated.decision;
    const already = existing.eventByDecisionId.get(decision.decision_id);

    if (already) {
      if (
        already.source_resolution_decision_hash !== decision.decision_hash
        || already.resolution_action !== decision.action
        || already.to_commitment !== decision.commitment
        || already.character !== decision.character
        || already.source_turn_id !== decision.source_turn_id
      ) {
        const error = new Error(
          `Phase65D decision ${decision.decision_id} was already persisted with different immutable revision content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersisted.push(already.belief_revision_event_id);
      continue;
    }

    const characterKey = decision.character
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
    const previousEvent = latestByCharacter.get(characterKey) ?? null;
    const candidateEvent = revisionEventFor({
      decision,
      claims: validated.claims,
      relations: validated.relations,
      previousEvent,
    });

    const collision = object(
      object(existing.events)[candidateEvent.belief_revision_event_id],
    );
    if (Object.keys(collision).length) {
      assertPersistedRevisionEvent(
        collision,
        candidateEvent.belief_revision_event_id,
        worldState,
      );
      if (!sameValue(collision, candidateEvent)) {
        const error = new Error(
          `SubjectiveBeliefRevisionEvent ${candidateEvent.belief_revision_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_BELIEF_REVISION_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersisted.push(candidateEvent.belief_revision_event_id);
      latestByCharacter.set(characterKey, collision);
      continue;
    }

    preview.subjective_belief_revision_events = object(
      preview.subjective_belief_revision_events,
    );
    preview.subjective_belief_revision_events[
      candidateEvent.belief_revision_event_id
    ] = cloneJson(candidateEvent);

    createdEvents.push(candidateEvent);
    references.push(historyReferenceFor(candidateEvent));
    latestByCharacter.set(characterKey, candidateEvent);

    eventTransitions.push({
      entity: "world",
      field:
        `subjective_belief_revision_events.${candidateEvent.belief_revision_event_id}`,
      from: null,
      to: cloneJson(candidateEvent),
      cause:
        `persist immutable SubjectiveBeliefRevisionEvent ${candidateEvent.belief_revision_event_id}`,
      source_layer: "subjective_belief_revision",
    });
  }

  const historyBefore = existing.history.map(cloneJson);
  const historyIds = new Set(
    historyBefore.map((reference) => reference?.belief_revision_event_id),
  );
  const appended = [];

  for (const reference of references) {
    if (historyIds.has(reference.belief_revision_event_id)) continue;
    historyIds.add(reference.belief_revision_event_id);
    historyBefore.push(cloneJson(reference));
    appended.push(cloneJson(reference));
  }

  const historyTransitions = [];
  if (appended.length) {
    preview.subjective_belief_revision_history = cloneJson(historyBefore);
    historyTransitions.push({
      entity: "world",
      field: "subjective_belief_revision_history",
      from: cloneJson(worldState.subjective_belief_revision_history ?? null),
      to: cloneJson(historyBefore),
      cause:
        `append ${appended.length} Phase66A subjective belief revision history reference(s)`,
      source_layer: "subjective_belief_revision",
    });
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationSubjectiveBeliefRevisionVersion,
    result: {
      processed_resolution_decision_count: validatedDecisions.length,
      actionable_resolution_decision_count: actionable.length,
      unresolved_resolution_decision_count:
        validatedDecisions.length - actionable.length,
      revision_events_created: createdEvents,
      already_persisted_revision_event_ids: alreadyPersisted,
      history_references_appended: appended,
      state_transitions: [
        ...eventTransitions,
        ...historyTransitions,
      ],
      preview_world_state: preview,
      audit: {
        source_resolution_version:
          worldSimulationSubjectiveBeliefResolutionVersion,
        source_resolution_decision_hashes_verified: true,
        source_claim_hashes_verified: true,
        source_relation_hashes_verified: true,
        same_character_scope_verified: true,
        created_revision_event_count: createdEvents.length,
        already_persisted_revision_event_count: alreadyPersisted.length,
        appended_history_reference_count: appended.length,
        unresolved_decision_persisted: false,
        historical_claims_rewritten: false,
        historical_relations_rewritten: false,
        historical_revision_events_rewritten: false,
        per_character_previous_event_hash_chain_preserved: true,
        effective_belief_projection_applied: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        retrieval_frequency_used_as_credibility: false,
        accessibility_strength_used_as_credibility: false,
        plasticity_strength_used_as_truth_support: false,
        last_write_wins_applied: false,
        deterministic_history_order_used_as_epistemic_precedence: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}
