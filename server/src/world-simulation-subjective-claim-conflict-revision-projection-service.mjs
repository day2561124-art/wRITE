import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  subjectiveClaimEventSchemaVersion,
  subjectiveClaimHistoryReferenceSchemaVersion,
} from "./world-simulation-subjective-claim-projection-service.mjs";

export const worldSimulationSubjectiveClaimConflictRevisionProjectionVersion =
  "phase65b-subjective-claim-conflict-revision-projection-v1";

export const subjectiveClaimRelationEventSchemaVersion =
  "phase65b-subjective-claim-relation-event-v1";

export const subjectiveClaimRelationHistoryReferenceSchemaVersion =
  "phase65b-subjective-claim-relation-history-ref-v1";

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
  code = "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_INVALID",
) {
  const text =
    optionalString(value);

  if (text) return text;

  const error =
    new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null)
    === JSON.stringify(right ?? null);
}

function sameCharacter(left, right) {
  return String(left ?? "")
    .trim()
    .toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "")
      .trim()
      .toLocaleLowerCase("zh-Hant-TW");
}

function assertPersistedClaimEvent(
  event,
  eventId,
) {
  if (
    !isObject(event)
    || event.schema_version
      !== subjectiveClaimEventSchemaVersion
    || event.immutable !== true
    || optionalString(
      event.claim_event_id,
    ) !== eventId
    || !optionalString(
      event.claim_event_hash,
    )
    || !optionalString(
      event.character,
    )
    || !optionalString(
      event.source_turn_id,
    )
    || !optionalString(
      event.proposition,
    )
    || !optionalString(
      event.proposition_hash,
    )
    || event.status
      !== "candidate_subjective_claim"
    || !Array.isArray(event.evidence)
    || event.evidence.length === 0
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} is invalid for Phase65B relation projection.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_EVENT_INVALID";
    throw error;
  }

  const body =
    cloneJson(event);
  delete body.claim_event_hash;

  if (
    hashAgentRunValue(body)
    !== event.claim_event_hash
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_EVENT_HASH_MISMATCH";
    throw error;
  }

  if (
    !array(event.evidence).some(
      (evidence) =>
        evidence?.relation === "supports"
        && optionalString(
          evidence?.source_memory_ref,
        )
        && optionalString(
          evidence?.source_memory_hash,
        ),
    )
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} has no evidence-backed supporting basis.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_EVIDENCE_REQUIRED";
    throw error;
  }
}

function validateClaimHistory(
  worldState,
) {
  if (
    Object.hasOwn(
      worldState,
      "subjective_claim_events",
    )
    && !isObject(
      worldState.subjective_claim_events,
    )
  ) {
    const error = new Error(
      "subjective_claim_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(
      worldState,
      "subjective_claim_history",
    )
    && !Array.isArray(
      worldState.subjective_claim_history,
    )
  ) {
    const error = new Error(
      "subjective_claim_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HISTORY_INVALID";
    throw error;
  }

  const events =
    object(
      worldState.subjective_claim_events,
    );
  const history =
    array(
      worldState.subjective_claim_history,
    );
  const byId =
    new Map();

  for (
    const [index, reference]
    of history.entries()
  ) {
    const claimEventId =
      optionalString(
        reference?.claim_event_id,
      );

    if (
      !isObject(reference)
      || reference.schema_version
        !== subjectiveClaimHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !claimEventId
      || !optionalString(
        reference.claim_event_hash,
      )
      || !optionalString(
        reference.character,
      )
      || !optionalString(
        reference.source_turn_id,
      )
      || !optionalString(
        reference.proposition_hash,
      )
      || reference.status
        !== "candidate_subjective_claim"
    ) {
      const error = new Error(
        `subjective_claim_history[${index}] is invalid for Phase65B.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (byId.has(claimEventId)) {
      const error = new Error(
        `subjective_claim_history contains duplicate claim ${claimEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HISTORY_DUPLICATE";
      throw error;
    }

    const event =
      events[claimEventId];

    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_history cannot resolve SubjectiveClaimEvent ${claimEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HISTORY_UNRESOLVED";
      throw error;
    }

    assertPersistedClaimEvent(
      event,
      claimEventId,
    );

    if (
      event.claim_event_hash
        !== reference.claim_event_hash
      || event.character
        !== reference.character
      || event.source_turn_id
        !== reference.source_turn_id
      || event.proposition_hash
        !== reference.proposition_hash
      || event.status
        !== reference.status
    ) {
      const error = new Error(
        `subjective_claim_history reference ${claimEventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }

    byId.set(
      claimEventId,
      {
        event,
        history_index:
          index,
      },
    );
  }

  return {
    events,
    history,
    by_id:
      byId,
  };
}

function resolverClaimView(
  event,
) {
  return {
    claim_event_id:
      event.claim_event_id,
    claim_event_hash:
      event.claim_event_hash,
    source_turn_id:
      event.source_turn_id,
    proposition:
      event.proposition,
    proposition_hash:
      event.proposition_hash,
    status:
      event.status,
    evidence_count:
      array(event.evidence).length,
  };
}

export function buildWorldSimulationSubjectiveClaimConflictRevisionResolverView(
  input = {},
) {
  const worldState =
    cloneJson(
      object(input.world_state),
    );
  const turnId =
    requiredString(
      input.turn_id,
      "turn_id",
    );
  const claims =
    validateClaimHistory(
      worldState,
    );
  const byCharacter =
    new Map();

  for (const reference of claims.history) {
    const event =
      claims.events[
        reference.claim_event_id
      ];
    const characterKey =
      event.character
        .toLocaleLowerCase("zh-Hant-TW");

    if (!byCharacter.has(characterKey)) {
      byCharacter.set(
        characterKey,
        {
          character:
            event.character,
          current_turn_claims: [],
          prior_claims: [],
        },
      );
    }

    const bucket =
      byCharacter.get(characterKey);
    const view =
      resolverClaimView(event);

    if (event.source_turn_id === turnId) {
      bucket.current_turn_claims.push(view);
    } else {
      bucket.prior_claims.push(view);
    }
  }

  return deepFreeze({
    version:
      worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
    turn_id:
      turnId,
    character_claims:
      [...byCharacter.values()]
        .filter(
          (bucket) =>
            bucket.current_turn_claims.length > 0,
        )
        .sort(
          (left, right) =>
            left.character.localeCompare(
              right.character,
              "zh-Hant-TW",
            ),
        ),
    boundaries: {
      current_turn_claim_must_anchor_relation:
        true,
      prior_claims_may_be_compared:
        true,
      whole_persistent_memory_store_exposed:
        false,
      raw_memory_content_exposed:
        false,
      world_state_exposed:
        false,
      raw_world_event_exposed:
        false,
      retrieval_history_exposed:
        false,
      memory_plasticity_history_exposed:
        false,
      retrieval_frequency_exposed_as_credibility:
        false,
      accessibility_strength_exposed_as_credibility:
        false,
      confidence_requested:
        false,
      probability_requested:
        false,
      world_truth_judgment_requested:
        false,
      semantic_graph_traversal_available:
        false,
      relation_is_candidate_not_truth_resolution:
        true,
      target_claim_mutation_allowed:
        false,
      character_brain_exposure_installed:
        false,
    },
  });
}

const forbiddenProposalFields =
  new Set([
    "confidence",
    "probability",
    "belief_probability",
    "truth_probability",
    "world_truth",
    "world_truth_verified",
    "authoritative",
    "authority",
    "resolved",
    "resolution",
    "belief_status",
    "invalidates",
    "deletes",
    "retracts",
    "replacement",
    "target_status",
  ]);

const allowedProposalFields =
  new Set([
    "proposal_ref",
    "character",
    "source_claim_event_id",
    "target_claim_event_id",
    "relation",
  ]);

function normalizeRelationProposal(
  raw,
  proposalIndex,
  claims,
  turnId,
) {
  if (!isObject(raw)) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID";
    throw error;
  }

  const forbidden =
    Object.keys(raw)
      .filter(
        (key) =>
          forbiddenProposalFields.has(key),
      );

  if (forbidden.length) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] may not assert truth authority, confidence, resolution, deletion, or target state: ${forbidden.join(", ")}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_AUTHORITY_FIELD_FORBIDDEN";
    error.fields =
      forbidden;
    throw error;
  }

  const unknown =
    Object.keys(raw)
      .filter(
        (key) =>
          !allowedProposalFields.has(key),
      );

  if (unknown.length) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] contains unsupported fields: ${unknown.join(", ")}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_FIELD_FORBIDDEN";
    error.fields =
      unknown;
    throw error;
  }

  const proposalRef =
    requiredString(
      raw.proposal_ref,
      `relation_proposals[${proposalIndex}].proposal_ref`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID",
    );
  const character =
    requiredString(
      raw.character,
      `relation_proposals[${proposalIndex}].character`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID",
    );
  const sourceClaimEventId =
    requiredString(
      raw.source_claim_event_id,
      `relation_proposals[${proposalIndex}].source_claim_event_id`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID",
    );
  const targetClaimEventId =
    requiredString(
      raw.target_claim_event_id,
      `relation_proposals[${proposalIndex}].target_claim_event_id`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID",
    );
  const relation =
    requiredString(
      raw.relation,
      `relation_proposals[${proposalIndex}].relation`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_INVALID",
    );

  if (
    ![
      "challenges",
      "supersedes",
    ].includes(relation)
  ) {
    const error = new Error(
      `relation_proposals[${proposalIndex}].relation must be challenges or supersedes.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_TYPE_INVALID";
    throw error;
  }

  if (sourceClaimEventId === targetClaimEventId) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] may not relate a claim to itself.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SELF_REFERENCE";
    throw error;
  }

  const sourceEntry =
    claims.by_id.get(
      sourceClaimEventId,
    );
  const targetEntry =
    claims.by_id.get(
      targetClaimEventId,
    );

  if (!sourceEntry || !targetEntry) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] must reference canonical subjective claims present in subjective_claim_history.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_UNRESOLVED";
    throw error;
  }

  const source =
    sourceEntry.event;
  const target =
    targetEntry.event;

  if (
    !sameCharacter(
      character,
      source.character,
    )
    || !sameCharacter(
      character,
      target.character,
    )
    || !sameCharacter(
      source.character,
      target.character,
    )
  ) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] may only relate claims belonging to the same character.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CHARACTER_MISMATCH";
    throw error;
  }

  if (source.source_turn_id !== turnId) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] source claim must be a current-turn claim from ${turnId}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_NOT_CURRENT_TURN";
    throw error;
  }

  if (
    relation === "supersedes"
    && target.source_turn_id === turnId
  ) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] cannot claim same-turn supersession because same-turn deterministic ordering is not causal precedence.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SUPERSESSION_TARGET_NOT_PRIOR_TURN";
    throw error;
  }

  const supportingEvidence =
    array(source.evidence)
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

  if (!supportingEvidence.length) {
    const error = new Error(
      `relation_proposals[${proposalIndex}] source claim lacks evidence-backed support.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_EVIDENCE_REQUIRED";
    throw error;
  }

  return {
    proposal_ref:
      proposalRef,
    character:
      source.character,
    source_claim_event_id:
      source.claim_event_id,
    source_claim_event_hash:
      source.claim_event_hash,
    source_claim_proposition_hash:
      source.proposition_hash,
    target_claim_event_id:
      target.claim_event_id,
    target_claim_event_hash:
      target.claim_event_hash,
    target_claim_proposition_hash:
      target.proposition_hash,
    relation,
    source_turn_id:
      turnId,
    target_source_turn_id:
      target.source_turn_id,
    evidence_basis:
      supportingEvidence,
  };
}

function relationEventFor(
  proposal,
) {
  const relationEventId =
    `subjective_claim_relation_event_${hashAgentRunValue({
      version:
        worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
      source_turn_id:
        proposal.source_turn_id,
      character:
        proposal.character,
      source_claim_event_id:
        proposal.source_claim_event_id,
      source_claim_event_hash:
        proposal.source_claim_event_hash,
      target_claim_event_id:
        proposal.target_claim_event_id,
      target_claim_event_hash:
        proposal.target_claim_event_hash,
      relation:
        proposal.relation,
      proposal_ref:
        proposal.proposal_ref,
    }).slice(0, 24)}`;

  const body = {
    schema_version:
      subjectiveClaimRelationEventSchemaVersion,
    relation_event_id:
      relationEventId,
    character:
      proposal.character,
    source_turn_id:
      proposal.source_turn_id,
    source_claim_event_id:
      proposal.source_claim_event_id,
    source_claim_event_hash:
      proposal.source_claim_event_hash,
    source_claim_proposition_hash:
      proposal.source_claim_proposition_hash,
    target_claim_event_id:
      proposal.target_claim_event_id,
    target_claim_event_hash:
      proposal.target_claim_event_hash,
    target_claim_proposition_hash:
      proposal.target_claim_proposition_hash,
    target_source_turn_id:
      proposal.target_source_turn_id,
    relation:
      proposal.relation,
    evidence_basis:
      cloneJson(
        proposal.evidence_basis,
      ),
    status:
      "candidate_subjective_claim_relation",
    derivation: {
      mode:
        "explicit_claim_to_claim_relation_projection_v1",
      proposal_ref:
        proposal.proposal_ref,
      current_turn_source_claim_required:
        true,
      source_claim_evidence_pinned:
        true,
      hidden_semantic_graph_traversal_used:
        false,
    },
    semantic_state: {
      world_truth_verified:
        false,
      confidence:
        null,
      probability:
        null,
      conflict_resolution_applied:
        false,
      belief_revision_applied:
        false,
      target_claim_invalidated:
        false,
      target_claim_deleted:
        false,
      target_claim_rewritten:
        false,
      supersession_is_candidate_relation_only:
        true,
    },
    engine_audit: {
      source_claim_hash_verified:
        true,
      target_claim_hash_verified:
        true,
      source_claim_current_turn_verified:
        true,
      source_claim_supporting_evidence_pinned:
        true,
      same_character_relation_verified:
        true,
      same_turn_supersession_allowed:
        false,
      retrieval_frequency_used_as_credibility:
        false,
      accessibility_strength_used_as_credibility:
        false,
      plasticity_strength_used_as_truth_support:
        false,
      world_truth_authority_claimed:
        false,
      character_brain_mutation_authority:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
      semantic_graph_traversal_used:
        false,
      last_write_wins_applied:
        false,
      historical_claim_mutation_applied:
        false,
      confidence_probability_modeled:
        false,
    },
    immutable:
      true,
  };

  return {
    ...body,
    relation_event_hash:
      hashAgentRunValue(
        body,
      ),
  };
}

function relationHistoryReferenceFor(
  event,
) {
  return {
    schema_version:
      subjectiveClaimRelationHistoryReferenceSchemaVersion,
    relation_event_id:
      event.relation_event_id,
    relation_event_hash:
      event.relation_event_hash,
    character:
      event.character,
    source_turn_id:
      event.source_turn_id,
    source_claim_event_id:
      event.source_claim_event_id,
    target_claim_event_id:
      event.target_claim_event_id,
    relation:
      event.relation,
    status:
      event.status,
    evidence_basis_count:
      array(event.evidence_basis).length,
    derived_index:
      true,
  };
}

function assertPersistedRelationEvent(
  event,
  eventId,
) {
  if (
    !isObject(event)
    || event.schema_version
      !== subjectiveClaimRelationEventSchemaVersion
    || event.immutable !== true
    || optionalString(
      event.relation_event_id,
    ) !== eventId
    || !optionalString(
      event.relation_event_hash,
    )
    || event.status
      !== "candidate_subjective_claim_relation"
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} is invalid.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_INVALID";
    throw error;
  }

  const body =
    cloneJson(event);
  delete body.relation_event_hash;

  if (
    hashAgentRunValue(body)
    !== event.relation_event_hash
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimRelationEvent ${eventId} failed immutable hash verification.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_HASH_MISMATCH";
    throw error;
  }
}

function validateExistingRelationHistory(
  worldState,
  existingEvents,
) {
  if (
    Object.hasOwn(
      worldState,
      "subjective_claim_relation_events",
    )
    && !isObject(
      worldState.subjective_claim_relation_events,
    )
  ) {
    const error = new Error(
      "subjective_claim_relation_events must be an object when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_STORE_INVALID";
    throw error;
  }

  if (
    Object.hasOwn(
      worldState,
      "subjective_claim_relation_history",
    )
    && !Array.isArray(
      worldState.subjective_claim_relation_history,
    )
  ) {
    const error = new Error(
      "subjective_claim_relation_history must be an array when present.",
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_INVALID";
    throw error;
  }

  const seen =
    new Set();

  for (
    const [index, reference]
    of array(
      worldState.subjective_claim_relation_history,
    ).entries()
  ) {
    const relationEventId =
      optionalString(
        reference?.relation_event_id,
      );

    if (
      !isObject(reference)
      || reference.schema_version
        !== subjectiveClaimRelationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !relationEventId
      || !optionalString(
        reference.relation_event_hash,
      )
      || !optionalString(
        reference.character,
      )
      || !optionalString(
        reference.source_turn_id,
      )
      || !optionalString(
        reference.source_claim_event_id,
      )
      || !optionalString(
        reference.target_claim_event_id,
      )
      || ![
        "challenges",
        "supersedes",
      ].includes(reference.relation)
      || reference.status
        !== "candidate_subjective_claim_relation"
      || !Number.isInteger(
        reference.evidence_basis_count,
      )
      || reference.evidence_basis_count < 1
    ) {
      const error = new Error(
        `subjective_claim_relation_history[${index}] is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(relationEventId)) {
      const error = new Error(
        `subjective_claim_relation_history contains duplicate reference ${relationEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(relationEventId);

    const event =
      existingEvents[
        relationEventId
      ];

    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_relation_history cannot resolve SubjectiveClaimRelationEvent ${relationEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_UNRESOLVED";
      throw error;
    }

    assertPersistedRelationEvent(
      event,
      relationEventId,
    );

    if (
      event.relation_event_hash
        !== reference.relation_event_hash
      || event.character
        !== reference.character
      || event.source_turn_id
        !== reference.source_turn_id
      || event.source_claim_event_id
        !== reference.source_claim_event_id
      || event.target_claim_event_id
        !== reference.target_claim_event_id
      || event.relation
        !== reference.relation
      || event.status
        !== reference.status
      || array(event.evidence_basis).length
        !== reference.evidence_basis_count
    ) {
      const error = new Error(
        `subjective_claim_relation_history reference ${relationEventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
  }
}

export function buildWorldSimulationSubjectiveClaimConflictRevisionContract() {
  return deepFreeze({
    version:
      worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
    phase:
      "Phase65B",
    status:
      "subjective_claim_conflict_revision_relation_substrate_installed",
    relation_event_schema_version:
      subjectiveClaimRelationEventSchemaVersion,
    relation_history_reference_schema_version:
      subjectiveClaimRelationHistoryReferenceSchemaVersion,
    source_claim_current_turn_required:
      true,
    prior_claim_comparison_allowed:
      true,
    same_turn_challenge_allowed:
      true,
    same_turn_supersession_allowed:
      false,
    relation_event_write_once_required:
      true,
    relation_history_append_only_required:
      true,
    historical_claim_mutation_allowed:
      false,
    target_claim_invalidation_modeled:
      false,
    unresolved_competing_claims_preserved:
      true,
    supersession_is_candidate_relation_only:
      true,
    semantic_conflict_resolution_modeled:
      false,
    last_write_wins_allowed:
      false,
    confidence_probability_modeled:
      false,
    world_truth_authority_claimed:
      false,
    character_brain_exposure_installed:
      false,
    same_turn_character_brain_feedback_allowed:
      false,
    retrieval_frequency_counts_as_credibility:
      false,
    accessibility_strength_counts_as_credibility:
      false,
    plasticity_strength_counts_as_truth_support:
      false,
    hidden_semantic_graph_traversal_allowed:
      false,
    resolver_may_propose_claim_relations:
      true,
    resolver_may_assert_truth_resolution:
      false,
    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
    phase65a_claim_events_remain_immutable:
      true,
  });
}

export function buildWorldSimulationSubjectiveClaimConflictRevisions(
  input = {},
) {
  const worldState =
    cloneJson(
      object(input.world_state),
    );
  const turnId =
    requiredString(
      input.turn_id,
      "turn_id",
    );
  const claims =
    validateClaimHistory(
      worldState,
    );
  const proposals =
    array(input.relation_proposals)
      .map(
        (proposal, index) =>
          normalizeRelationProposal(
            proposal,
            index,
            claims,
            turnId,
          ),
      )
      .sort(
        (left, right) => {
          const characterOrder =
            left.character.localeCompare(
              right.character,
              "zh-Hant-TW",
            );
          if (characterOrder !== 0) return characterOrder;

          const sourceOrder =
            left.source_claim_event_id.localeCompare(
              right.source_claim_event_id,
              "en",
            );
          if (sourceOrder !== 0) return sourceOrder;

          const targetOrder =
            left.target_claim_event_id.localeCompare(
              right.target_claim_event_id,
              "en",
            );
          if (targetOrder !== 0) return targetOrder;

          const relationOrder =
            left.relation.localeCompare(
              right.relation,
              "en",
            );
          if (relationOrder !== 0) return relationOrder;

          return left.proposal_ref.localeCompare(
            right.proposal_ref,
            "zh-Hant-TW",
          );
        },
      );

  const seenProposalRefs =
    new Set();
  const seenRelationTuples =
    new Set();

  for (const proposal of proposals) {
    if (seenProposalRefs.has(proposal.proposal_ref)) {
      const error = new Error(
        `Duplicate Phase65B relation proposal_ref ${proposal.proposal_ref}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_PROPOSAL_DUPLICATE";
      throw error;
    }
    seenProposalRefs.add(
      proposal.proposal_ref,
    );

    const tuple =
      JSON.stringify([
        proposal.source_claim_event_id,
        proposal.target_claim_event_id,
        proposal.relation,
      ]);

    if (seenRelationTuples.has(tuple)) {
      const error = new Error(
        `Duplicate Phase65B claim relation ${proposal.relation} from ${proposal.source_claim_event_id} to ${proposal.target_claim_event_id}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_DUPLICATE";
      throw error;
    }
    seenRelationTuples.add(tuple);
  }

  if (!proposals.length) {
    return deepFreeze({
      ok: true,
      version:
        worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
      result: {
        processed_proposal_count:
          0,
        relation_events_created: [],
        already_persisted_relation_event_ids: [],
        history_references_appended: [],
        state_transitions: [],
        preview_world_state:
          worldState,
        audit: {
          no_relation_proposals:
            true,
          synthetic_empty_containers_created:
            false,
          historical_claims_rewritten:
            false,
          same_turn_character_brain_feedback_used:
            false,
          confidence_probability_modeled:
            false,
          truth_resolution_applied:
            false,
        },
      },
    });
  }

  const existingEvents =
    object(
      worldState.subjective_claim_relation_events,
    );

  validateExistingRelationHistory(
    worldState,
    existingEvents,
  );

  const preview =
    cloneJson(worldState);
  const createdEvents = [];
  const alreadyPersisted = [];
  const eventTransitions = [];
  const references = [];

  for (const proposal of proposals) {
    const candidateEvent =
      relationEventFor(
        proposal,
      );
    const existing =
      existingEvents[
        candidateEvent.relation_event_id
      ];

    let authoritativeEvent;

    if (isObject(existing)) {
      assertPersistedRelationEvent(
        existing,
        candidateEvent.relation_event_id,
      );

      if (
        existing.relation_event_hash
          !== candidateEvent.relation_event_hash
        || !sameValue(
          existing,
          candidateEvent,
        )
      ) {
        const error = new Error(
          `SubjectiveClaimRelationEvent ${candidateEvent.relation_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }

      alreadyPersisted.push(
        candidateEvent.relation_event_id,
      );
      authoritativeEvent =
        existing;
    } else {
      createdEvents.push(
        candidateEvent,
      );

      preview.subjective_claim_relation_events =
        object(
          preview.subjective_claim_relation_events,
        );
      preview.subjective_claim_relation_events[
        candidateEvent.relation_event_id
      ] =
        cloneJson(candidateEvent);

      eventTransitions.push({
        entity:
          "world",
        field:
          `subjective_claim_relation_events.${candidateEvent.relation_event_id}`,
        from:
          null,
        to:
          cloneJson(candidateEvent),
        cause:
          `persist immutable SubjectiveClaimRelationEvent ${candidateEvent.relation_event_id}`,
        source_layer:
          "subjective_claim_conflict_revision_projection",
      });

      authoritativeEvent =
        candidateEvent;
    }

    references.push(
      relationHistoryReferenceFor(
        authoritativeEvent,
      ),
    );
  }

  const historyBefore =
    array(
      worldState.subjective_claim_relation_history,
    ).map(cloneJson);
  const historyIds =
    new Set(
      historyBefore.map(
        (reference) =>
          reference?.relation_event_id,
      ),
    );
  const appended = [];

  for (const reference of references) {
    if (
      historyIds.has(
        reference.relation_event_id,
      )
    ) {
      continue;
    }

    historyIds.add(
      reference.relation_event_id,
    );
    historyBefore.push(
      cloneJson(reference),
    );
    appended.push(
      cloneJson(reference),
    );
  }

  const historyTransitions = [];

  if (appended.length) {
    preview.subjective_claim_relation_history =
      cloneJson(historyBefore);

    historyTransitions.push({
      entity:
        "world",
      field:
        "subjective_claim_relation_history",
      from:
        cloneJson(
          worldState.subjective_claim_relation_history
          ?? null,
        ),
      to:
        cloneJson(historyBefore),
      cause:
        `append ${appended.length} Phase65B subjective claim relation history reference(s)`,
      source_layer:
        "subjective_claim_conflict_revision_projection",
    });
  }

  return deepFreeze({
    ok: true,
    version:
      worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
    result: {
      processed_proposal_count:
        proposals.length,
      relation_events_created:
        createdEvents,
      already_persisted_relation_event_ids:
        alreadyPersisted,
      history_references_appended:
        appended,
      state_transitions: [
        ...eventTransitions,
        ...historyTransitions,
      ],
      preview_world_state:
        preview,
      audit: {
        created_relation_event_count:
          createdEvents.length,
        already_persisted_relation_event_count:
          alreadyPersisted.length,
        appended_history_reference_count:
          appended.length,
        source_claim_current_turn_required:
          true,
        source_claim_hashes_verified:
          true,
        target_claim_hashes_verified:
          true,
        source_claim_evidence_pinned:
          true,
        historical_claims_rewritten:
          false,
        target_claims_invalidated:
          false,
        unresolved_competing_claims_preserved:
          true,
        retrieval_frequency_used_as_credibility:
          false,
        accessibility_strength_used_as_credibility:
          false,
        plasticity_strength_used_as_truth_support:
          false,
        hidden_semantic_graph_traversal_used:
          false,
        same_turn_character_brain_feedback_used:
          false,
        confidence_probability_modeled:
          false,
        truth_resolution_applied:
          false,
        last_write_wins_applied:
          false,
      },
    },
  });
}
