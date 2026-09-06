import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  subjectiveClaimEventSchemaVersion,
  subjectiveClaimHistoryReferenceSchemaVersion,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  subjectiveClaimRelationEventSchemaVersion,
  subjectiveClaimRelationHistoryReferenceSchemaVersion,
} from "./world-simulation-subjective-claim-conflict-revision-projection-service.mjs";

export const worldSimulationSubjectiveCognitionProjectionVersion =
  "phase65c-subjective-cognition-read-projection-v1";

export const worldSimulationSubjectiveCognitionMaxClaims = 16;
export const worldSimulationSubjectiveCognitionMaxRelations = 32;

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
  return JSON.parse(
    JSON.stringify(
      value ?? null,
    ),
  );
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

function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_INPUT_INVALID";
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

function assertClaimEvent(event, eventId) {
  if (
    !isObject(event)
    || event.schema_version !== subjectiveClaimEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.claim_event_id) !== eventId
    || !optionalString(event.claim_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.proposition)
    || !optionalString(event.proposition_hash)
    || event.status !== "candidate_subjective_claim"
    || !Array.isArray(event.evidence)
    || event.evidence.length === 0
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} is invalid for Phase65C read projection.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_EVENT_INVALID";
    throw error;
  }

  const body = cloneJson(event);
  delete body.claim_event_hash;
  if (hashAgentRunValue(body) !== event.claim_event_hash) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} failed immutable hash verification.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HASH_MISMATCH";
    throw error;
  }
}

function validateClaims(worldState) {
  if (
    Object.hasOwn(worldState, "subjective_claim_events")
    && !isObject(worldState.subjective_claim_events)
  ) {
    const error = new Error(
      "subjective_claim_events must be an object when present.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_claim_history")
    && !Array.isArray(worldState.subjective_claim_history)
  ) {
    const error = new Error(
      "subjective_claim_history must be an array when present.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.subjective_claim_events);
  const history = array(worldState.subjective_claim_history);
  const seen = new Set();
  const ordered = [];

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.claim_event_id);
    if (
      !isObject(reference)
      || reference.schema_version !== subjectiveClaimHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !optionalString(reference.claim_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.proposition_hash)
      || reference.status !== "candidate_subjective_claim"
    ) {
      const error = new Error(
        `subjective_claim_history[${index}] is invalid for Phase65C.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `subjective_claim_history contains duplicate claim ${eventId}.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HISTORY_DUPLICATE";
      throw error;
    }
    seen.add(eventId);

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_history cannot resolve SubjectiveClaimEvent ${eventId}.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HISTORY_UNRESOLVED";
      throw error;
    }

    assertClaimEvent(event, eventId);
    if (
      event.claim_event_hash !== reference.claim_event_hash
      || event.character !== reference.character
      || event.source_turn_id !== reference.source_turn_id
      || event.proposition_hash !== reference.proposition_hash
      || event.status !== reference.status
    ) {
      const error = new Error(
        `subjective_claim_history reference ${eventId} does not match its canonical event.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_CLAIM_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    ordered.push(event);
  }

  return {
    events,
    ordered,
  };
}

function assertRelationEvent(event, eventId, claims) {
  if (
    !isObject(event)
    || event.schema_version !== subjectiveClaimRelationEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.relation_event_id) !== eventId
    || !optionalString(event.relation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.source_claim_event_id)
    || !optionalString(event.target_claim_event_id)
    || !["challenges", "supersedes"].includes(event.relation)
    || event.status !== "candidate_subjective_claim_relation"
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} is invalid for Phase65C read projection.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_EVENT_INVALID";
    throw error;
  }

  const body = cloneJson(event);
  delete body.relation_event_hash;
  if (hashAgentRunValue(body) !== event.relation_event_hash) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} failed immutable hash verification.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HASH_MISMATCH";
    throw error;
  }

  const source = claims.events[event.source_claim_event_id];
  const target = claims.events[event.target_claim_event_id];
  if (!isObject(source) || !isObject(target)) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} references an unresolved claim.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_CLAIM_UNRESOLVED";
    throw error;
  }

  if (
    !sameCharacter(event.character, source.character)
    || !sameCharacter(event.character, target.character)
    || !sameCharacter(source.character, target.character)
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} crosses character ownership.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_CHARACTER_MISMATCH";
    throw error;
  }

  if (
    event.source_claim_event_hash !== source.claim_event_hash
    || event.target_claim_event_hash !== target.claim_event_hash
    || event.source_claim_proposition_hash !== source.proposition_hash
    || event.target_claim_proposition_hash !== target.proposition_hash
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} does not pin canonical claim images.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }
}

function validateRelations(worldState, claims) {
  if (
    Object.hasOwn(worldState, "subjective_claim_relation_events")
    && !isObject(worldState.subjective_claim_relation_events)
  ) {
    const error = new Error(
      "subjective_claim_relation_events must be an object when present.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_claim_relation_history")
    && !Array.isArray(worldState.subjective_claim_relation_history)
  ) {
    const error = new Error(
      "subjective_claim_relation_history must be an array when present.",
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.subjective_claim_relation_events);
  const history = array(worldState.subjective_claim_relation_history);
  const seen = new Set();
  const ordered = [];

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.relation_event_id);
    if (
      !isObject(reference)
      || reference.schema_version !== subjectiveClaimRelationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !optionalString(reference.relation_event_hash)
      || !optionalString(reference.character)
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.source_claim_event_id)
      || !optionalString(reference.target_claim_event_id)
      || !["challenges", "supersedes"].includes(reference.relation)
      || reference.status !== "candidate_subjective_claim_relation"
      || !Number.isInteger(reference.evidence_basis_count)
      || reference.evidence_basis_count < 1
    ) {
      const error = new Error(
        `subjective_claim_relation_history[${index}] is invalid for Phase65C.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `subjective_claim_relation_history contains duplicate relation ${eventId}.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HISTORY_DUPLICATE";
      throw error;
    }
    seen.add(eventId);

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_relation_history cannot resolve SubjectiveClaimRelationEvent ${eventId}.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HISTORY_UNRESOLVED";
      throw error;
    }

    assertRelationEvent(event, eventId, claims);
    if (
      event.relation_event_hash !== reference.relation_event_hash
      || event.character !== reference.character
      || event.source_turn_id !== reference.source_turn_id
      || event.source_claim_event_id !== reference.source_claim_event_id
      || event.target_claim_event_id !== reference.target_claim_event_id
      || event.relation !== reference.relation
      || event.status !== reference.status
      || array(event.evidence_basis).length !== reference.evidence_basis_count
    ) {
      const error = new Error(
        `subjective_claim_relation_history reference ${eventId} does not match its canonical event.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_COGNITION_RELATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    ordered.push(event);
  }

  return {
    events,
    ordered,
  };
}

export function buildWorldSimulationSubjectiveCognitionProjectionContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveCognitionProjectionVersion,
    phase: "Phase65C",
    status: "committed_subjective_cognition_read_projection_installed",
    source_scope: "same_character_committed_prior_turn_claim_history_only",
    character_brain_exposure_installed: true,
    action_proposer_exposure_installed: true,
    same_turn_claim_feedback_allowed: false,
    world_truth_authority_claimed: false,
    semantic_conflict_resolution_modeled: false,
    belief_revision_applied: false,
    confidence_probability_modeled: false,
    candidate_supersession_remains_candidate_only: true,
    unresolved_competing_claims_preserved: true,
    claim_history_mutation_allowed: false,
    relation_history_mutation_allowed: false,
    whole_memory_store_exposed: false,
    claim_evidence_exposed: false,
    claim_event_identity_exposed: false,
    relation_event_identity_exposed: false,
    engine_turn_identity_exposed: false,
    retrieval_frequency_counts_as_credibility: false,
    accessibility_strength_counts_as_credibility: false,
    plasticity_strength_counts_as_truth_support: false,
    max_claims: worldSimulationSubjectiveCognitionMaxClaims,
    max_relations: worldSimulationSubjectiveCognitionMaxRelations,
  });
}

export function projectWorldSimulationSubjectiveCognition(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const claims = validateClaims(worldState);
  const relations = validateRelations(worldState, claims);

  const eligibleClaims = claims.ordered
    .filter((event) => sameCharacter(event.character, character))
    .filter((event) => event.source_turn_id !== currentTurnId);
  const selectedClaims = eligibleClaims.slice(
    Math.max(0, eligibleClaims.length - worldSimulationSubjectiveCognitionMaxClaims),
  );
  const selectedIds = new Set(
    selectedClaims.map((event) => event.claim_event_id),
  );

  const eligibleRelations = relations.ordered
    .filter((event) => sameCharacter(event.character, character))
    .filter((event) => event.source_turn_id !== currentTurnId)
    .filter(
      (event) => selectedIds.has(event.source_claim_event_id)
        && selectedIds.has(event.target_claim_event_id),
    );
  const selectedRelations = eligibleRelations.slice(
    Math.max(0, eligibleRelations.length - worldSimulationSubjectiveCognitionMaxRelations),
  );

  const propositionById = new Map(
    selectedClaims.map((event) => [
      event.claim_event_id,
      event.proposition,
    ]),
  );

  const characterView = {
    source: "committed_prior_turn_subjective_claim_history",
    claims: selectedClaims.map((event) => ({
      proposition: event.proposition,
      subjective_not_world_truth: true,
    })),
    relations: selectedRelations.map((event) => ({
      relation: event.relation,
      source_proposition: propositionById.get(event.source_claim_event_id),
      target_proposition: propositionById.get(event.target_claim_event_id),
      candidate_relation_only: true,
      truth_resolution_applied: false,
    })),
    unresolved_competing_claims_present:
      selectedRelations.length > 0,
    claims_truncated:
      selectedClaims.length < eligibleClaims.length,
    relations_truncated:
      selectedRelations.length < eligibleRelations.length,
  };

  return deepFreeze({
    ok: true,
    version: worldSimulationSubjectiveCognitionProjectionVersion,
    character,
    character_view: characterView,
    audit: {
      committed_prior_turn_only: true,
      same_turn_claims_excluded: true,
      source_claim_count: eligibleClaims.length,
      projected_claim_count: selectedClaims.length,
      source_relation_count: eligibleRelations.length,
      projected_relation_count: selectedRelations.length,
      claim_hashes_verified: true,
      relation_hashes_verified: true,
      source_memory_content_exposed: false,
      claim_evidence_exposed: false,
      retrieval_history_exposed: false,
      accessibility_strength_exposed_as_credibility: false,
      plasticity_strength_exposed_as_truth_support: false,
      confidence_probability_modeled: false,
      world_truth_resolution_applied: false,
      claim_history_mutated: false,
      relation_history_mutated: false,
    },
    boundaries: {
      same_character_only: true,
      same_turn_claim_feedback_allowed: false,
      world_state_exposed_to_character_brain: false,
      whole_memory_store_exposed_to_character_brain: false,
      claim_event_identity_exposed_to_character_brain: false,
      relation_event_identity_exposed_to_character_brain: false,
      claim_evidence_exposed_to_character_brain: false,
      confidence_probability_exposed_to_character_brain: false,
      world_truth_authority_exposed_to_character_brain: false,
      candidate_supersession_is_truth_resolution: false,
      unresolved_competing_claims_preserved: true,
    },
  });
}
