import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationSubjectiveClaimProjectionVersion =
  "phase65a-evidence-backed-subjective-claim-projection-v1";

export const subjectiveClaimEventSchemaVersion =
  "phase65a-subjective-claim-event-v1";

export const subjectiveClaimHistoryReferenceSchemaVersion =
  "phase65a-subjective-claim-history-ref-v1";

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
  code = "WORLD_SIMULATION_SUBJECTIVE_CLAIM_INVALID",
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

function characterMemories(worldState, character) {
  const direct =
    worldState?.memories?.[character];

  if (Array.isArray(direct)) {
    return direct;
  }

  const entry =
    Object.entries(
      object(worldState?.memories),
    ).find(
      ([key]) =>
        sameCharacter(
          key,
          character,
        ),
    );

  return Array.isArray(entry?.[1])
    ? entry[1]
    : [];
}

function memoryId(memory) {
  return optionalString(
    memory?.memory_id
    ?? memory?.id,
  );
}

function currentTurnMemoryIndex(
  worldState,
  sourceMemoryRecords,
  turnId,
) {
  const byCharacter =
    new Map();

  for (
    const [index, raw]
    of array(sourceMemoryRecords).entries()
  ) {
    if (!isObject(raw)) {
      const error = new Error(
        `source_memory_records[${index}] must be an object.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_RECORD_INVALID";
      throw error;
    }

    const character =
      requiredString(
        raw.character,
        `source_memory_records[${index}].character`,
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_RECORD_INVALID",
      );

    const record =
      object(
        raw.memory_record,
      );

    const sourceMemoryRef =
      requiredString(
        memoryId(record),
        `source_memory_records[${index}].memory_record.memory_id`,
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_RECORD_INVALID",
      );

    const canonical =
      characterMemories(
        worldState,
        character,
      ).find(
        (candidate) =>
          memoryId(candidate)
          === sourceMemoryRef,
      );

    if (!canonical) {
      const error = new Error(
        `Phase65A cannot resolve current-turn subjective memory ${sourceMemoryRef} for ${character}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_UNRESOLVED";
      throw error;
    }

    const canonicalTurnId =
      optionalString(
        canonical?.internal_provenance?.turn_id,
      );

    if (canonicalTurnId !== turnId) {
      const error = new Error(
        `Subjective memory ${sourceMemoryRef} was not formed by current turn ${turnId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_NOT_CURRENT_TURN";
      error.source_memory_ref =
        sourceMemoryRef;
      error.expected_turn_id =
        turnId;
      error.actual_turn_id =
        canonicalTurnId;
      throw error;
    }

    const suppliedHash =
      hashAgentRunValue(record);
    const canonicalHash =
      hashAgentRunValue(canonical);

    if (suppliedHash !== canonicalHash) {
      const error = new Error(
        `Current-turn subjective memory ${sourceMemoryRef} diverged from canonical persisted content.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_HASH_MISMATCH";
      error.source_memory_ref =
        sourceMemoryRef;
      error.supplied_hash =
        suppliedHash;
      error.canonical_hash =
        canonicalHash;
      throw error;
    }

    const characterKey =
      character
        .toLocaleLowerCase("zh-Hant-TW");

    if (!byCharacter.has(characterKey)) {
      byCharacter.set(
        characterKey,
        {
          character,
          memories: new Map(),
        },
      );
    }

    const bucket =
      byCharacter.get(characterKey);

    if (bucket.memories.has(sourceMemoryRef)) {
      const error = new Error(
        `Duplicate Phase65A current-turn source memory ${sourceMemoryRef} for ${character}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_DUPLICATE";
      throw error;
    }

    bucket.memories.set(
      sourceMemoryRef,
      {
        memory:
          cloneJson(canonical),
        memory_hash:
          canonicalHash,
      },
    );
  }

  return byCharacter;
}

function resolverMemoryView(
  sourceMemoryRef,
  memory,
) {
  const source =
    object(memory?.source);

  return {
    source_memory_ref:
      sourceMemoryRef,
    content:
      cloneJson(
        memory?.content
        ?? null,
      ),
    source: {
      kind:
        optionalString(
          source.kind,
        ),
      sense:
        optionalString(
          source.sense,
        ),
    },
    possibly_incorrect:
      memory?.possibly_incorrect === true,
    source_confused:
      memory?.source_confused === true,
    subjective_memory_not_world_truth:
      memory?.subjective_memory_not_world_truth !== false,
  };
}

export function buildWorldSimulationSubjectiveClaimResolverView(
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

  const index =
    currentTurnMemoryIndex(
      worldState,
      input.source_memory_records,
      turnId,
    );

  const characterEvidence =
    [...index.values()]
      .sort(
        (left, right) =>
          left.character.localeCompare(
            right.character,
            "zh-Hant-TW",
          ),
      )
      .map(
        (bucket) => ({
          character:
            bucket.character,
          memories:
            [...bucket.memories.entries()]
              .sort(
                ([left], [right]) =>
                  left.localeCompare(
                    right,
                    "zh-Hant-TW",
                  ),
              )
              .map(
                ([sourceMemoryRef, value]) =>
                  resolverMemoryView(
                    sourceMemoryRef,
                    value.memory,
                  ),
              ),
        }),
      );

  return deepFreeze({
    version:
      worldSimulationSubjectiveClaimProjectionVersion,
    turn_id:
      turnId,
    character_evidence:
      characterEvidence,
    boundaries: {
      current_turn_new_subjective_memories_only:
        true,
      whole_persistent_memory_store_exposed:
        false,
      world_state_exposed:
        false,
      raw_world_event_exposed:
        false,
      retrieval_event_history_exposed:
        false,
      memory_plasticity_history_exposed:
        false,
      retrieval_frequency_exposed_as_evidence:
        false,
      accessibility_strength_exposed_as_evidence:
        false,
      perceptual_certainty_scalar_exposed:
        false,
      perceptual_clarity_scalar_exposed:
        false,
      internal_memory_provenance_exposed:
        false,
      claim_confidence_requested:
        false,
      claim_probability_requested:
        false,
      world_truth_judgment_requested:
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
    "world_truth_verified",
    "world_truth",
    "authoritative",
    "authority",
    "belief_status",
    "revision",
    "revision_action",
    "supersedes",
    "replaces",
  ]);

const allowedProposalFields =
  new Set([
    "proposal_ref",
    "character",
    "proposition",
    "evidence",
  ]);

const allowedEvidenceFields =
  new Set([
    "source_memory_ref",
    "relation",
  ]);

function normalizeEvidence(
  evidence,
  proposalIndex,
  sourceBucket,
) {
  if (!Array.isArray(evidence) || !evidence.length) {
    const error = new Error(
      `claim_proposals[${proposalIndex}].evidence must contain at least one current-turn subjective memory reference.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_REQUIRED";
    throw error;
  }

  const seen =
    new Set();

  const normalized =
    evidence.map(
      (raw, evidenceIndex) => {
        if (!isObject(raw)) {
          const error = new Error(
            `claim_proposals[${proposalIndex}].evidence[${evidenceIndex}] must be an object.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_INVALID";
          throw error;
        }

        const unknown =
          Object.keys(raw)
            .filter(
              (key) =>
                !allowedEvidenceFields.has(key),
            );

        if (unknown.length) {
          const error = new Error(
            `claim_proposals[${proposalIndex}].evidence[${evidenceIndex}] contains unsupported fields: ${unknown.join(", ")}.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_FIELD_FORBIDDEN";
          error.fields =
            unknown;
          throw error;
        }

        const sourceMemoryRef =
          requiredString(
            raw.source_memory_ref,
            `claim_proposals[${proposalIndex}].evidence[${evidenceIndex}].source_memory_ref`,
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_INVALID",
          );

        const relation =
          optionalString(
            raw.relation,
          )
          ?? "supports";

        if (
          ![
            "supports",
            "conflicts",
          ].includes(relation)
        ) {
          const error = new Error(
            `claim_proposals[${proposalIndex}].evidence[${evidenceIndex}].relation must be supports or conflicts.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_RELATION_INVALID";
          throw error;
        }

        const canonical =
          sourceBucket.memories.get(
            sourceMemoryRef,
          );

        if (!canonical) {
          const error = new Error(
            `Claim evidence ${sourceMemoryRef} is outside the current-turn newly formed subjective-memory source set.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_OUTSIDE_CURRENT_TURN_SOURCE_SET";
          throw error;
        }

        const identity =
          sourceMemoryRef;

        if (seen.has(identity)) {
          const error = new Error(
            `Duplicate claim evidence source ${identity}.`,
          );
          error.code =
            "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_DUPLICATE";
          throw error;
        }

        seen.add(identity);

        return {
          source_memory_ref:
            sourceMemoryRef,
          source_memory_hash:
            canonical.memory_hash,
          relation,
        };
      },
    );

  normalized.sort(
    (left, right) => {
      const refOrder =
        left.source_memory_ref.localeCompare(
          right.source_memory_ref,
          "zh-Hant-TW",
        );
      if (refOrder !== 0) return refOrder;
      return left.relation.localeCompare(
        right.relation,
        "zh-Hant-TW",
      );
    },
  );

  if (
    !normalized.some(
      (item) =>
        item.relation === "supports",
    )
  ) {
    const error = new Error(
      `claim_proposals[${proposalIndex}] requires at least one supporting evidence relation.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SUPPORTING_EVIDENCE_REQUIRED";
    throw error;
  }

  return normalized;
}

function normalizeProposal(
  raw,
  proposalIndex,
  sourceIndex,
  turnId,
) {
  if (!isObject(raw)) {
    const error = new Error(
      `claim_proposals[${proposalIndex}] must be an object.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_INVALID";
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
      `claim_proposals[${proposalIndex}] may not assert confidence, probability, truth authority, or revision state: ${forbidden.join(", ")}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_AUTHORITY_FIELD_FORBIDDEN";
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
      `claim_proposals[${proposalIndex}] contains unsupported fields: ${unknown.join(", ")}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_FIELD_FORBIDDEN";
    error.fields =
      unknown;
    throw error;
  }

  const proposalRef =
    requiredString(
      raw.proposal_ref,
      `claim_proposals[${proposalIndex}].proposal_ref`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_INVALID",
    );

  const character =
    requiredString(
      raw.character,
      `claim_proposals[${proposalIndex}].character`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_INVALID",
    );

  const proposition =
    requiredString(
      raw.proposition,
      `claim_proposals[${proposalIndex}].proposition`,
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_INVALID",
    );

  const sourceBucket =
    sourceIndex.get(
      character.toLocaleLowerCase(
        "zh-Hant-TW",
      ),
    );

  if (!sourceBucket) {
    const error = new Error(
      `Claim proposal ${proposalRef} has no current-turn newly formed subjective memories for ${character}.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_CHARACTER_SOURCE_SET_UNRESOLVED";
    throw error;
  }

  const evidence =
    normalizeEvidence(
      raw.evidence,
      proposalIndex,
      sourceBucket,
    );

  const propositionHash =
    hashAgentRunValue({
      character,
      proposition,
    });

  return {
    proposal_ref:
      proposalRef,
    character:
      sourceBucket.character,
    proposition,
    proposition_hash:
      propositionHash,
    evidence,
    source_turn_id:
      turnId,
  };
}

function claimEventFor(
  proposal,
) {
  const claimEventId =
    `subjective_claim_event_${hashAgentRunValue({
      version:
        worldSimulationSubjectiveClaimProjectionVersion,
      source_turn_id:
        proposal.source_turn_id,
      character:
        proposal.character,
      proposition_hash:
        proposal.proposition_hash,
      evidence:
        proposal.evidence,
      proposal_ref:
        proposal.proposal_ref,
    }).slice(0, 24)}`;

  const body = {
    schema_version:
      subjectiveClaimEventSchemaVersion,
    claim_event_id:
      claimEventId,
    character:
      proposal.character,
    source_turn_id:
      proposal.source_turn_id,
    proposition:
      proposal.proposition,
    proposition_hash:
      proposal.proposition_hash,
    evidence:
      cloneJson(
        proposal.evidence,
      ),
    status:
      "candidate_subjective_claim",
    derivation: {
      mode:
        "explicit_current_turn_evidence_projection_v1",
      proposal_ref:
        proposal.proposal_ref,
      current_turn_new_subjective_memories_only:
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
    },
    engine_audit: {
      evidence_hashes_verified:
        true,
      source_memories_rewritten:
        false,
      retrieval_frequency_used_as_evidence:
        false,
      accessibility_strength_used_as_evidence:
        false,
      plasticity_strength_used_as_truth_support:
        false,
      world_truth_authority_claimed:
        false,
      character_brain_mutation_authority:
        false,
      same_turn_character_brain_feedback_allowed:
        false,
      semantic_conflict_resolution_modeled:
        false,
      last_write_wins_applied:
        false,
      confidence_probability_modeled:
        false,
    },
    immutable:
      true,
  };

  return {
    ...body,
    claim_event_hash:
      hashAgentRunValue(
        body,
      ),
  };
}

function historyReferenceFor(
  event,
) {
  return {
    schema_version:
      subjectiveClaimHistoryReferenceSchemaVersion,
    claim_event_id:
      event.claim_event_id,
    claim_event_hash:
      event.claim_event_hash,
    character:
      event.character,
    source_turn_id:
      event.source_turn_id,
    proposition_hash:
      event.proposition_hash,
    status:
      event.status,
    evidence_count:
      array(event.evidence).length,
    derived_index:
      true,
  };
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
  ) {
    const error = new Error(
      `Persisted SubjectiveClaimEvent ${eventId} is invalid.`,
    );
    error.code =
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_INVALID";
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
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_HASH_MISMATCH";
    throw error;
  }
}

function validateExistingClaimHistory(
  worldState,
  existingEvents,
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
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_STORE_INVALID";
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
      "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_INVALID";
    throw error;
  }

  const seen =
    new Set();

  for (
    const [index, reference]
    of array(
      worldState.subjective_claim_history,
    ).entries()
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
    ) {
      const error = new Error(
        `subjective_claim_history[${index}] is invalid.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_INVALID";
      throw error;
    }

    if (seen.has(claimEventId)) {
      const error = new Error(
        `subjective_claim_history contains duplicate reference ${claimEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }

    seen.add(claimEventId);

    const event =
      existingEvents[
        claimEventId
      ];

    if (!isObject(event)) {
      const error = new Error(
        `subjective_claim_history cannot resolve SubjectiveClaimEvent ${claimEventId}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_UNRESOLVED";
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
    ) {
      const error = new Error(
        `subjective_claim_history reference ${claimEventId} does not match its canonical event.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
  }
}

export function buildWorldSimulationSubjectiveClaimProjectionContract() {
  return deepFreeze({
    version:
      worldSimulationSubjectiveClaimProjectionVersion,
    phase:
      "Phase65A",
    status:
      "evidence_backed_subjective_claim_substrate_installed",
    claim_event_schema_version:
      subjectiveClaimEventSchemaVersion,
    claim_history_reference_schema_version:
      subjectiveClaimHistoryReferenceSchemaVersion,
    source_scope:
      "current_turn_new_subjective_memories_only",
    source_memory_hash_verified:
      true,
    source_memory_content_rewrite_allowed:
      false,
    claim_event_write_once_required:
      true,
    claim_history_append_only_required:
      true,
    claim_history_rebuildable_from_events:
      true,
    multiple_candidate_claims_preserved:
      true,
    semantic_conflict_resolution_modeled:
      false,
    last_write_wins_allowed:
      false,
    belief_revision_modeled:
      false,
    confidence_probability_modeled:
      false,
    world_truth_authority_claimed:
      false,
    persistent_mind_database_installed:
      false,
    character_brain_exposure_installed:
      false,
    same_turn_character_brain_feedback_allowed:
      false,
    retrieval_frequency_counts_as_evidence:
      false,
    accessibility_strength_counts_as_evidence:
      false,
    plasticity_strength_counts_as_truth_support:
      false,
    hidden_semantic_graph_traversal_allowed:
      false,
    resolver_may_propose_claim_text:
      true,
    resolver_may_assert_truth_probability:
      false,
    resolver_may_rewrite_memory:
      false,
    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
    native_world_loop_adoption_installed:
      true,
  });
}

export function buildWorldSimulationSubjectiveClaims(
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

  const sourceIndex =
    currentTurnMemoryIndex(
      worldState,
      input.source_memory_records,
      turnId,
    );

  const proposals =
    array(input.claim_proposals)
      .map(
        (proposal, index) =>
          normalizeProposal(
            proposal,
            index,
            sourceIndex,
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

          const propositionOrder =
            left.proposition_hash.localeCompare(
              right.proposition_hash,
              "en",
            );
          if (propositionOrder !== 0) return propositionOrder;

          return left.proposal_ref.localeCompare(
            right.proposal_ref,
            "zh-Hant-TW",
          );
        },
      );

  const seenProposalRefs =
    new Set();

  for (const proposal of proposals) {
    if (
      seenProposalRefs.has(
        proposal.proposal_ref,
      )
    ) {
      const error = new Error(
        `Duplicate Phase65A claim proposal_ref ${proposal.proposal_ref}.`,
      );
      error.code =
        "WORLD_SIMULATION_SUBJECTIVE_CLAIM_PROPOSAL_DUPLICATE";
      throw error;
    }

    seenProposalRefs.add(
      proposal.proposal_ref,
    );
  }

  if (!proposals.length) {
    return deepFreeze({
      ok: true,
      version:
        worldSimulationSubjectiveClaimProjectionVersion,
      result: {
        processed_proposal_count:
          0,
        claim_events_created: [],
        already_persisted_claim_event_ids: [],
        history_references_appended: [],
        state_transitions: [],
        preview_world_state:
          worldState,
        audit: {
          no_claim_proposals:
            true,
          synthetic_empty_containers_created:
            false,
          memory_content_rewritten:
            false,
          same_turn_character_brain_feedback_used:
            false,
        },
      },
    });
  }

  const existingEvents =
    object(
      worldState.subjective_claim_events,
    );

  validateExistingClaimHistory(
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
      claimEventFor(
        proposal,
      );

    const existing =
      existingEvents[
        candidateEvent.claim_event_id
      ];

    let authoritativeEvent;

    if (isObject(existing)) {
      assertPersistedClaimEvent(
        existing,
        candidateEvent.claim_event_id,
      );

      if (
        existing.claim_event_hash
          !== candidateEvent.claim_event_hash
        || !sameValue(
          existing,
          candidateEvent,
        )
      ) {
        const error = new Error(
          `SubjectiveClaimEvent ${candidateEvent.claim_event_id} already exists with different immutable content.`,
        );
        error.code =
          "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }

      alreadyPersisted.push(
        candidateEvent.claim_event_id,
      );
      authoritativeEvent =
        existing;
    } else {
      createdEvents.push(
        candidateEvent,
      );

      preview.subjective_claim_events =
        object(
          preview.subjective_claim_events,
        );

      preview.subjective_claim_events[
        candidateEvent.claim_event_id
      ] =
        cloneJson(candidateEvent);

      eventTransitions.push({
        entity:
          "world",
        field:
          `subjective_claim_events.${candidateEvent.claim_event_id}`,
        from:
          null,
        to:
          cloneJson(candidateEvent),
        cause:
          `persist immutable SubjectiveClaimEvent ${candidateEvent.claim_event_id}`,
        source_layer:
          "subjective_claim_projection",
      });

      authoritativeEvent =
        candidateEvent;
    }

    references.push(
      historyReferenceFor(
        authoritativeEvent,
      ),
    );
  }

  const historyBefore =
    array(
      worldState.subjective_claim_history,
    ).map(cloneJson);

  const historyIds =
    new Set(
      historyBefore.map(
        (reference) =>
          reference?.claim_event_id,
      ),
    );

  const appended = [];

  for (const reference of references) {
    if (
      historyIds.has(
        reference.claim_event_id,
      )
    ) {
      continue;
    }

    historyIds.add(
      reference.claim_event_id,
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
    preview.subjective_claim_history =
      cloneJson(historyBefore);

    historyTransitions.push({
      entity:
        "world",
      field:
        "subjective_claim_history",
      from:
        cloneJson(
          worldState.subjective_claim_history
          ?? null,
        ),
      to:
        cloneJson(historyBefore),
      cause:
        `append ${appended.length} Phase65A subjective claim history reference(s)`,
      source_layer:
        "subjective_claim_projection",
    });
  }

  return deepFreeze({
    ok: true,
    version:
      worldSimulationSubjectiveClaimProjectionVersion,
    result: {
      processed_proposal_count:
        proposals.length,
      claim_events_created:
        createdEvents,
      already_persisted_claim_event_ids:
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
        source_memory_count:
          [...sourceIndex.values()]
            .reduce(
              (sum, bucket) =>
                sum + bucket.memories.size,
              0,
            ),
        created_claim_event_count:
          createdEvents.length,
        already_persisted_claim_event_count:
          alreadyPersisted.length,
        appended_history_reference_count:
          appended.length,
        current_turn_new_subjective_memories_only:
          true,
        source_memory_hashes_verified:
          true,
        memory_content_rewritten:
          false,
        retrieval_frequency_used_as_evidence:
          false,
        accessibility_strength_used_as_evidence:
          false,
        plasticity_strength_used_as_truth_support:
          false,
        same_turn_character_brain_feedback_used:
          false,
        confidence_probability_modeled:
          false,
        conflict_resolution_applied:
          false,
      },
    },
  });
}
