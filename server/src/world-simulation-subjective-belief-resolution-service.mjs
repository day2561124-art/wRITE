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

export const worldSimulationSubjectiveBeliefResolutionVersion =
  "phase65d-evidence-grounded-subjective-belief-resolution-v1";

export const subjectiveBeliefResolutionDecisionSchemaVersion =
  "phase65d-subjective-belief-resolution-decision-v1";

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

function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_INPUT_INVALID",
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
    .localeCompare(
      String(right ?? ""),
      "en",
    );
}

function uniqueSorted(values) {
  return [...new Set(values)]
    .sort(compareText);
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
      `Persisted SubjectiveClaimEvent ${eventId} is invalid for Phase65D belief resolution.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_EVENT_INVALID";
    throw error;
  }

  const supportingEvidence =
    event.evidence.filter(
      (evidence) =>
        evidence?.relation === "supports"
        && optionalString(evidence?.source_memory_ref)
        && optionalString(evidence?.source_memory_hash),
    );

  if (!supportingEvidence.length) {
    const error = new Error(
      `SubjectiveClaimEvent ${eventId} has no evidence-backed supporting basis.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_EVIDENCE_REQUIRED";
    throw error;
  }

  const body = cloneJson(event);
  delete body.claim_event_hash;

  if (hashAgentRunValue(body) !== event.claim_event_hash) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HASH_MISMATCH";
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
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_claim_history")
    && !Array.isArray(worldState.subjective_claim_history)
  ) {
    const error = new Error(
      "subjective_claim_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HISTORY_INVALID";
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
        `subjective_claim_history[${index}] is invalid for Phase65D.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `subjective_claim_history contains duplicate claim ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HISTORY_DUPLICATE";
      throw error;
    }
    seen.add(eventId);

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_history cannot resolve SubjectiveClaimEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HISTORY_UNRESOLVED";
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
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    ordered.push(event);
  }

  return {
    events,
    ordered,
  };
}

function sourceSupportingEvidence(event) {
  return array(event?.evidence)
    .filter(
      (evidence) =>
        evidence?.relation === "supports",
    )
    .map(
      (evidence) => ({
        source_memory_ref:
          evidence.source_memory_ref,
        source_memory_hash:
          evidence.source_memory_hash,
        relation:
          evidence.relation,
      }),
    );
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
    || !Array.isArray(event.evidence_basis)
    || event.evidence_basis.length < 1
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} is invalid for Phase65D belief resolution.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_EVENT_INVALID";
    throw error;
  }

  const body = cloneJson(event);
  delete body.relation_event_hash;

  if (hashAgentRunValue(body) !== event.relation_event_hash) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HASH_MISMATCH";
    throw error;
  }

  const source = claims.events[event.source_claim_event_id];
  const target = claims.events[event.target_claim_event_id];

  if (!isObject(source) || !isObject(target)) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} references an unresolved claim.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_CLAIM_UNRESOLVED";
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
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CHARACTER_MISMATCH";
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
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_CLAIM_HASH_MISMATCH";
    throw error;
  }

  if (
    event.source_turn_id !== source.source_turn_id
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} source turn does not match its source claim.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_SOURCE_TURN_MISMATCH";
    throw error;
  }

  if (
    event.target_source_turn_id !== target.source_turn_id
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} target turn does not match its target claim.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_TARGET_TURN_MISMATCH";
    throw error;
  }

  if (
    event.relation === "supersedes"
    && source.source_turn_id === target.source_turn_id
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} asserts same-turn supersession.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_SAME_TURN_SUPERSESSION_FORBIDDEN";
    throw error;
  }

  const expectedEvidence = sourceSupportingEvidence(source);
  if (
    JSON.stringify(event.evidence_basis)
    !== JSON.stringify(expectedEvidence)
  ) {
    const error = new Error(
      `SubjectiveClaimRelationEvent ${eventId} does not preserve the source claim's exact supporting evidence basis.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_EVIDENCE_MISMATCH";
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
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(worldState, "subjective_claim_relation_history")
    && !Array.isArray(worldState.subjective_claim_relation_history)
  ) {
    const error = new Error(
      "subjective_claim_relation_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HISTORY_INVALID";
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
        `subjective_claim_relation_history[${index}] is invalid for Phase65D.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(eventId)) {
      const error = new Error(
        `subjective_claim_relation_history contains duplicate relation ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HISTORY_DUPLICATE";
      throw error;
    }
    seen.add(eventId);

    const event = events[eventId];
    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_relation_history cannot resolve SubjectiveClaimRelationEvent ${eventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HISTORY_UNRESOLVED";
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
      || event.evidence_basis.length !== reference.evidence_basis_count
    ) {
      const error = new Error(
        `subjective_claim_relation_history reference ${eventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_RELATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    ordered.push(event);
  }

  return {
    events,
    ordered,
  };
}

function decisionFor({
  character,
  turnId,
  action,
  commitment,
  claimEventIds = [],
  relationEventIds = [],
  reason,
}) {
  const canonicalClaimIds = uniqueSorted(claimEventIds);
  const canonicalRelationIds = uniqueSorted(relationEventIds);

  const decisionId =
    `subjective_belief_resolution_${hashAgentRunValue({
      version:
        worldSimulationSubjectiveBeliefResolutionVersion,
      character,
      source_turn_id:
        turnId,
      action,
      commitment,
      claim_event_ids:
        canonicalClaimIds,
      relation_event_ids:
        canonicalRelationIds,
      reason,
    }).slice(0, 24)}`;

  const body = {
    schema_version:
      subjectiveBeliefResolutionDecisionSchemaVersion,
    decision_id:
      decisionId,
    character,
    source_turn_id:
      turnId,
    action,
    commitment,
    claim_event_ids:
      canonicalClaimIds,
    relation_event_ids:
      canonicalRelationIds,
    reason,
    subjective_not_world_truth:
      true,
    confidence:
      null,
    probability:
      null,
    derivation: {
      mode:
        "explicit_local_claim_relation_resolution_v1",
      hidden_semantic_graph_traversal_used:
        false,
      deterministic_sort_used_for_serialization_only:
        true,
      deterministic_sort_used_as_epistemic_precedence:
        false,
    },
    engine_audit: {
      claim_hashes_verified:
        true,
      relation_hashes_verified:
        true,
      relation_claim_hash_pinning_verified:
        true,
      same_character_scope_verified:
        true,
      historical_claim_mutation_applied:
        false,
      historical_relation_mutation_applied:
        false,
      world_state_mutation_applied:
        false,
      world_truth_authority_claimed:
        false,
      retrieval_frequency_used_as_credibility:
        false,
      accessibility_strength_used_as_credibility:
        false,
      plasticity_strength_used_as_truth_support:
        false,
      confidence_probability_modeled:
        false,
      last_write_wins_applied:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
    },
  };

  return {
    ...body,
    decision_hash:
      hashAgentRunValue(body),
  };
}

function decisionSort(left, right) {
  const characterOrder =
    left.character.localeCompare(
      right.character,
      "zh-Hant-TW",
    );
  if (characterOrder !== 0) return characterOrder;

  const actionOrder = compareText(left.action, right.action);
  if (actionOrder !== 0) return actionOrder;

  return compareText(left.decision_id, right.decision_id);
}

export function buildWorldSimulationSubjectiveBeliefResolutionContract() {
  return deepFreeze({
    version:
      worldSimulationSubjectiveBeliefResolutionVersion,
    phase:
      "Phase65D",
    status:
      "evidence_grounded_subjective_belief_resolution_installed",
    decision_schema_version:
      subjectiveBeliefResolutionDecisionSchemaVersion,
    engine_owned_resolution:
      true,
    deterministic_resolution_required:
      true,
    finite_claim_base_used:
      true,
    explicit_relation_locality_required:
      true,
    hidden_semantic_graph_traversal_allowed:
      false,
    unopposed_current_turn_claim_may_be_adopted:
      true,
    challenge_implies_supersession:
      false,
    challenge_auto_invalidates_target:
      false,
    single_unambiguous_supersession_may_resolve:
      true,
    competing_superseders_remain_unresolved:
      true,
    challenged_supersession_source_remains_unresolved:
      true,
    same_turn_ordering_is_epistemic_authority:
      false,
    last_write_wins_allowed:
      false,
    historical_claim_mutation_allowed:
      false,
    historical_relation_mutation_allowed:
      false,
    world_state_mutation_allowed:
      false,
    belief_revision_persistence_installed:
      false,
    effective_belief_projection_installed:
      false,
    world_truth_authority_claimed:
      false,
    confidence_probability_modeled:
      false,
    retrieval_frequency_counts_as_credibility:
      false,
    accessibility_strength_counts_as_credibility:
      false,
    plasticity_strength_counts_as_truth_support:
      false,
    same_turn_character_brain_feedback_allowed:
      false,
    native_world_loop_adoption_installed:
      true,
    durable_revision_owner:
      "Phase66",
    recognized_resolution_actions: [
      "adopt",
      "retain",
      "suspend",
      "supersede",
      "withdraw",
      "unresolved",
    ],
    v1_emitted_resolution_actions: [
      "adopt",
      "supersede",
      "unresolved",
    ],
  });
}

export function resolveWorldSimulationSubjectiveBeliefs(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const claims = validateClaims(worldState);
  const relations = validateRelations(worldState, claims);

  const currentClaims = claims.ordered
    .filter((event) => event.source_turn_id === turnId)
    .sort(
      (left, right) =>
        compareText(left.claim_event_id, right.claim_event_id),
    );

  const currentRelations = relations.ordered
    .filter((event) => event.source_turn_id === turnId)
    .sort(
      (left, right) =>
        compareText(left.relation_event_id, right.relation_event_id),
    );

  for (const relation of currentRelations) {
    const source = claims.events[relation.source_claim_event_id];
    if (source.source_turn_id !== turnId) {
      const error = new Error(
        `Current-turn SubjectiveClaimRelationEvent ${relation.relation_event_id} is not anchored by a current-turn source claim.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_SOURCE_NOT_CURRENT_TURN";
      throw error;
    }
  }

  const relationByClaim = new Map();
  const challenges = [];
  const supersedesByTarget = new Map();

  function registerRelationClaim(claimId, relation) {
    if (!relationByClaim.has(claimId)) {
      relationByClaim.set(claimId, []);
    }
    relationByClaim.get(claimId).push(relation);
  }

  for (const relation of currentRelations) {
    registerRelationClaim(
      relation.source_claim_event_id,
      relation,
    );
    registerRelationClaim(
      relation.target_claim_event_id,
      relation,
    );

    if (relation.relation === "challenges") {
      challenges.push(relation);
      continue;
    }

    if (!supersedesByTarget.has(relation.target_claim_event_id)) {
      supersedesByTarget.set(
        relation.target_claim_event_id,
        [],
      );
    }
    supersedesByTarget
      .get(relation.target_claim_event_id)
      .push(relation);
  }

  const challengedClaimIds = new Set();
  for (const relation of challenges) {
    challengedClaimIds.add(relation.source_claim_event_id);
    challengedClaimIds.add(relation.target_claim_event_id);
  }

  const decisions = [];
  const resolvedSupersessionRelations = [];
  const resolvedSupersessionSourceRelations = new Map();

  for (const relation of challenges) {
    decisions.push(
      decisionFor({
        character:
          relation.character,
        turnId,
        action:
          "unresolved",
        commitment:
          "unresolved",
        claimEventIds: [
          relation.source_claim_event_id,
          relation.target_claim_event_id,
        ],
        relationEventIds: [
          relation.relation_event_id,
        ],
        reason:
          "explicit_challenge_preserves_competing_claims",
      }),
    );
  }

  for (
    const [targetClaimEventId, targetRelations]
    of [...supersedesByTarget.entries()]
      .sort(
        ([left], [right]) =>
          compareText(left, right),
      )
  ) {
    const sortedTargetRelations =
      [...targetRelations]
        .sort(
          (left, right) =>
            compareText(
              left.relation_event_id,
              right.relation_event_id,
            ),
        );
    const sourceClaimEventIds =
      uniqueSorted(
        sortedTargetRelations.map(
          (relation) =>
            relation.source_claim_event_id,
        ),
      );

    if (sortedTargetRelations.length > 1) {
      const target = claims.events[targetClaimEventId];
      decisions.push(
        decisionFor({
          character:
            target.character,
          turnId,
          action:
            "unresolved",
          commitment:
            "unresolved",
          claimEventIds: [
            targetClaimEventId,
            ...sourceClaimEventIds,
          ],
          relationEventIds:
            sortedTargetRelations.map(
              (relation) =>
                relation.relation_event_id,
            ),
          reason:
            "multiple_competing_superseders_preserved_without_precedence",
        }),
      );
      continue;
    }

    const relation = sortedTargetRelations[0];
    const sourceClaimEventId = relation.source_claim_event_id;

    if (
      challengedClaimIds.has(sourceClaimEventId)
      || challengedClaimIds.has(targetClaimEventId)
    ) {
      decisions.push(
        decisionFor({
          character:
            relation.character,
          turnId,
          action:
            "unresolved",
          commitment:
            "unresolved",
          claimEventIds: [
            sourceClaimEventId,
            targetClaimEventId,
          ],
          relationEventIds: [
            relation.relation_event_id,
          ],
          reason:
            "supersession_participant_is_explicitly_challenged",
        }),
      );
      continue;
    }

    resolvedSupersessionRelations.push(relation);

    if (!resolvedSupersessionSourceRelations.has(sourceClaimEventId)) {
      resolvedSupersessionSourceRelations.set(
        sourceClaimEventId,
        [],
      );
    }
    resolvedSupersessionSourceRelations
      .get(sourceClaimEventId)
      .push(relation);

    decisions.push(
      decisionFor({
        character:
          relation.character,
        turnId,
        action:
          "supersede",
        commitment:
          "superseded",
        claimEventIds: [
          targetClaimEventId,
          sourceClaimEventId,
        ],
        relationEventIds: [
          relation.relation_event_id,
        ],
        reason:
          "single_unambiguous_explicit_supersession",
      }),
    );
  }

  for (
    const [sourceClaimEventId, sourceRelations]
    of [...resolvedSupersessionSourceRelations.entries()]
      .sort(
        ([left], [right]) =>
          compareText(left, right),
      )
  ) {
    const source = claims.events[sourceClaimEventId];
    decisions.push(
      decisionFor({
        character:
          source.character,
        turnId,
        action:
          "adopt",
        commitment:
          "active",
        claimEventIds: [
          sourceClaimEventId,
        ],
        relationEventIds:
          sourceRelations.map(
            (relation) =>
              relation.relation_event_id,
          ),
        reason:
          "evidence_backed_source_of_unambiguous_supersession",
      }),
    );
  }

  for (const claim of currentClaims) {
    if (relationByClaim.has(claim.claim_event_id)) {
      continue;
    }

    decisions.push(
      decisionFor({
        character:
          claim.character,
        turnId,
        action:
          "adopt",
        commitment:
          "active",
        claimEventIds: [
          claim.claim_event_id,
        ],
        relationEventIds: [],
        reason:
          "unopposed_evidence_backed_current_turn_claim",
      }),
    );
  }

  decisions.sort(decisionSort);

  const decisionIds = new Set();
  for (const decision of decisions) {
    if (decisionIds.has(decision.decision_id)) {
      const error = new Error(
        `Phase65D produced duplicate deterministic decision ${decision.decision_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_DUPLICATE_DECISION";
      throw error;
    }
    decisionIds.add(decision.decision_id);
  }

  return deepFreeze({
    ok: true,
    version:
      worldSimulationSubjectiveBeliefResolutionVersion,
    result: {
      turn_id:
        turnId,
      current_turn_claim_count:
        currentClaims.length,
      current_turn_relation_count:
        currentRelations.length,
      decision_count:
        decisions.length,
      decisions,
      audit: {
        pure_resolution:
          true,
        claim_hashes_verified:
          true,
        relation_hashes_verified:
          true,
        relation_claim_hash_pinning_verified:
          true,
        same_character_scope_verified:
          true,
        source_claim_current_turn_verified:
          true,
        historical_claims_rewritten:
          false,
        historical_relations_rewritten:
          false,
        world_state_mutated:
          false,
        world_truth_fields_consumed:
          false,
        hidden_semantic_graph_traversal_used:
          false,
        deterministic_sort_used_as_epistemic_precedence:
          false,
        last_write_wins_applied:
          false,
        confidence_probability_modeled:
          false,
        retrieval_frequency_used_as_credibility:
          false,
        accessibility_strength_used_as_credibility:
          false,
        plasticity_strength_used_as_truth_support:
          false,
        same_turn_character_brain_feedback_allowed:
          false,
        durable_belief_revision_persisted:
          false,
        phase66_required_for_durable_revision:
          true,
        challenge_decision_count:
          challenges.length,
        resolved_supersession_relation_count:
          resolvedSupersessionRelations.length,
        unresolved_decision_count:
          decisions.filter(
            (decision) =>
              decision.action === "unresolved",
          ).length,
      },
    },
  });
}
