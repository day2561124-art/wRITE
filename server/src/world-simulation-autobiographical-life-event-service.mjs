import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveSubjectiveEpisodes,
  subjectiveEpisodeSegmentationEventSchemaVersion,
  worldSimulationSubjectiveEpisodeSegmentationVersion,
} from "./world-simulation-subjective-episode-segmentation-service.mjs";

export const worldSimulationAutobiographicalLifeEventVersion =
  "phase67b-autobiographical-life-event-v1";

export const autobiographicalLifeEventOrganizationEventSchemaVersion =
  "phase67b-autobiographical-life-event-organization-event-v1";

export const autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion =
  "phase67b-autobiographical-life-event-organization-history-ref-v1";

export const effectiveAutobiographicalLifeEventProjectionVersion =
  "phase67b-effective-autobiographical-life-event-projection-v1";

const strongAttachEvidenceKinds = Object.freeze([
  "explicit_programmatic_binding",
]);

const auxiliaryEvidenceKinds = Object.freeze([]);

const reservedFutureMaterializedEvidenceKinds = Object.freeze([
  "goal_continuity",
  "task_continuity",
  "project_continuity",
  "activity_continuity",
  "relationship_continuity",
  "entity_continuity",
  "thematic_continuity",
  "temporal_continuity",
  "spatial_context_continuity",
]);

const supportedEvidenceKinds = Object.freeze([
  ...strongAttachEvidenceKinds,
]);

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
  code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))]
    .sort(compareText);
}

function characterKey(value) {
  return requiredString(value, "character")
    .toLocaleLowerCase("zh-Hant-TW");
}

function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}

function segmentationEventHash(event) {
  const body = cloneJson(event);
  delete body.segmentation_event_hash;
  return hashAgentRunValue(body);
}

function organizationEventHash(event) {
  const body = cloneJson(event);
  delete body.organization_event_hash;
  return hashAgentRunValue(body);
}

function normalizeEvidenceRefs(value) {
  const normalized = array(value).map((item, index) => {
    if (!isObject(item)) {
      const error = new Error(`organization evidence[${index}] must be an object.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_INVALID";
      throw error;
    }
    const kind = requiredString(
      item.kind,
      `organization evidence[${index}].kind`,
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_INVALID",
    );
    if (!supportedEvidenceKinds.includes(kind)) {
      const error = new Error(`Unsupported autobiographical life-event evidence kind: ${kind}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_KIND_UNSUPPORTED";
      throw error;
    }
    return {
      kind,
      source_ref: requiredString(
        item.source_ref,
        `organization evidence[${index}].source_ref`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_INVALID",
      ),
      source_hash: requiredString(
        item.source_hash,
        `organization evidence[${index}].source_hash`,
        "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_INVALID",
      ),
    };
  });

  normalized.sort((left, right) => {
    const kind = compareText(left.kind, right.kind);
    if (kind !== 0) return kind;
    const ref = compareText(left.source_ref, right.source_ref);
    if (ref !== 0) return ref;
    return compareText(left.source_hash, right.source_hash);
  });

  const keys = normalized.map((item) =>
    `${item.kind}\u0000${item.source_ref}\u0000${item.source_hash}`,
  );
  if (new Set(keys).size !== keys.length) {
    const error = new Error("Autobiographical life-event evidence contains duplicates.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_DUPLICATE";
    throw error;
  }
  return normalized;
}

function assertCanonicalSegmentationEvent(worldState, eventId, expectedTurnId = null) {
  const event = object(
    object(worldState.subjective_episode_segmentation_events)[eventId],
  );
  if (
    !Object.keys(event).length
    || event.schema_version !== subjectiveEpisodeSegmentationEventSchemaVersion
    || event.version !== worldSimulationSubjectiveEpisodeSegmentationVersion
    || event.immutable !== true
    || event.segmentation_event_id !== eventId
    || !optionalString(event.segmentation_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.subjective_episode_id)
    || !optionalString(event.source_turn_id)
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.memory_content_copied !== false
  ) {
    const error = new Error(`Phase67B cannot resolve canonical Phase67A event ${eventId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_SEGMENTATION_EVENT_INVALID";
    throw error;
  }
  if (segmentationEventHash(event) !== event.segmentation_event_hash) {
    const error = new Error(`Phase67A source event ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_SEGMENTATION_HASH_MISMATCH";
    throw error;
  }
  if (expectedTurnId && event.source_turn_id !== expectedTurnId) {
    const error = new Error(`Phase67A source event ${eventId} is not from turn ${expectedTurnId}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_TURN_MISMATCH";
    throw error;
  }
  return event;
}

function canonicalSourceEpisode(worldState, segmentationEvent) {
  const projection = projectWorldSimulationEffectiveSubjectiveEpisodes({
    world_state: worldState,
  });
  const characterEpisodes = object(
    object(projection.episodes_by_character)[segmentationEvent.character],
  );
  let episode = characterEpisodes[segmentationEvent.subjective_episode_id] ?? null;
  if (!episode) {
    const wantedCharacter = characterKey(segmentationEvent.character);
    for (const [name, records] of Object.entries(projection.episodes_by_character ?? {})) {
      if (characterKey(name) !== wantedCharacter) continue;
      episode = object(records)[segmentationEvent.subjective_episode_id] ?? null;
      if (episode) break;
    }
  }
  if (!isObject(episode)) {
    const error = new Error(
      `Phase67B cannot resolve effective subjective episode ${segmentationEvent.subjective_episode_id}.`,
    );
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_EPISODE_UNRESOLVED";
    throw error;
  }
  return {
    episode,
    episode_hash: hashAgentRunValue(episode),
    projection_hash: projection.projection_hash,
  };
}

function assertPersistedOrganizationEvent(event, eventId) {
  if (
    !isObject(event)
    || event.schema_version !== autobiographicalLifeEventOrganizationEventSchemaVersion
    || event.version !== worldSimulationAutobiographicalLifeEventVersion
    || event.immutable !== true
    || event.organization_event_id !== eventId
    || !optionalString(event.organization_event_hash)
    || !optionalString(event.character)
    || !optionalString(event.source_turn_id)
    || !optionalString(event.source_segmentation_event_id)
    || !optionalString(event.source_segmentation_event_hash)
    || !optionalString(event.subjective_episode_id)
    || !optionalString(event.source_episode_hash)
    || !optionalString(event.life_event_id)
    || !["start_new_life_event", "attach_to_open_life_event"].includes(event.resolution)
    || event.status !== "autobiographical_life_event_organization_recorded"
    || event.subjective_not_world_truth !== true
    || event.world_truth_verified !== false
    || event.confidence !== null
    || event.probability !== null
    || event.memory_content_copied !== false
    || event.episode_content_copied !== false
    || event.world_event_identity_promoted !== false
    || event.world_turn_identity_promoted !== false
    || event.subjective_episode_identity_promoted !== false
    || event.character_brain_direct_write !== false
  ) {
    const error = new Error(`AutobiographicalLifeEventOrganizationEvent ${eventId} is invalid.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_INVALID";
    throw error;
  }
  if (organizationEventHash(event) !== event.organization_event_hash) {
    const error = new Error(`AutobiographicalLifeEventOrganizationEvent ${eventId} failed hash verification.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_HASH_MISMATCH";
    throw error;
  }
  normalizeEvidenceRefs(event.organization_evidence?.evidence_refs);
  return event;
}

function validateExistingOrganizationHistory(worldState) {
  if (
    Object.hasOwn(worldState, "autobiographical_life_event_organization_events")
    && !isObject(worldState.autobiographical_life_event_organization_events)
  ) {
    const error = new Error("autobiographical_life_event_organization_events must be an object.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_STORE_INVALID";
    throw error;
  }
  if (
    Object.hasOwn(worldState, "autobiographical_life_event_organization_history")
    && !Array.isArray(worldState.autobiographical_life_event_organization_history)
  ) {
    const error = new Error("autobiographical_life_event_organization_history must be an array.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_INVALID";
    throw error;
  }

  const events = object(worldState.autobiographical_life_event_organization_events);
  const history = array(worldState.autobiographical_life_event_organization_history);
  const seenEventIds = new Set();
  const episodeParent = new Map();
  const latestByCharacter = new Map();
  const openLifeEventByCharacter = new Map();

  for (const [index, reference] of history.entries()) {
    const eventId = optionalString(reference?.organization_event_id);
    const eventHash = optionalString(reference?.organization_event_hash);
    const character = optionalString(reference?.character);
    const episodeId = optionalString(reference?.subjective_episode_id);
    const lifeEventId = optionalString(reference?.life_event_id);
    if (
      !isObject(reference)
      || reference.schema_version
        !== autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion
      || reference.derived_index !== true
      || !eventId
      || !eventHash
      || !character
      || !episodeId
      || !lifeEventId
      || !optionalString(reference.source_turn_id)
      || !optionalString(reference.source_segmentation_event_id)
      || !optionalString(reference.source_segmentation_event_hash)
      || !optionalString(reference.source_episode_hash)
      || !["start_new_life_event", "attach_to_open_life_event"].includes(reference.resolution)
      || reference.status !== "autobiographical_life_event_organization_recorded"
    ) {
      const error = new Error(`autobiographical_life_event_organization_history[${index}] is invalid.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_REFERENCE_INVALID";
      throw error;
    }
    if (seenEventIds.has(eventId)) {
      const error = new Error(`Duplicate autobiographical organization event ${eventId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_DUPLICATE_REFERENCE";
      throw error;
    }
    const event = assertPersistedOrganizationEvent(events[eventId], eventId);
    const key = characterKey(character);
    const episodeKey = `${key}:${episodeId}`;
    if (episodeParent.has(episodeKey)) {
      const error = new Error(`Subjective episode ${episodeId} has more than one primary LifeEvent parent.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EPISODE_MULTI_PARENT_FORBIDDEN";
      throw error;
    }
    const previous = latestByCharacter.get(key) ?? null;
    const expectedOpen = openLifeEventByCharacter.get(key) ?? null;
    if (
      reference.organization_event_hash !== event.organization_event_hash
      || reference.character !== event.character
      || reference.source_turn_id !== event.source_turn_id
      || reference.source_segmentation_event_id !== event.source_segmentation_event_id
      || reference.source_segmentation_event_hash !== event.source_segmentation_event_hash
      || reference.subjective_episode_id !== event.subjective_episode_id
      || reference.source_episode_hash !== event.source_episode_hash
      || reference.life_event_id !== event.life_event_id
      || reference.resolution !== event.resolution
      || reference.previous_organization_event_id !== event.previous_organization_event_id
      || reference.previous_organization_event_hash !== event.previous_organization_event_hash
      || event.previous_organization_event_id !== (previous?.organization_event_id ?? null)
      || event.previous_organization_event_hash !== (previous?.organization_event_hash ?? null)
      || event.previous_open_life_event_id !== expectedOpen
      || event.resulting_open_life_event_id !== event.life_event_id
      || (event.resolution === "attach_to_open_life_event" && event.life_event_id !== expectedOpen)
      || (
        event.resolution === "start_new_life_event"
        && event.closes_previous_life_event_id !== expectedOpen
      )
    ) {
      const error = new Error(`Autobiographical organization reference ${eventId} breaks its canonical per-character chain.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_HISTORY_REFERENCE_MISMATCH";
      throw error;
    }
    episodeParent.set(episodeKey, {
      life_event_id: lifeEventId,
      organization_event_id: eventId,
    });
    seenEventIds.add(eventId);
    latestByCharacter.set(key, event);
    openLifeEventByCharacter.set(key, lifeEventId);
  }

  return {
    events,
    history,
    episodeParent,
    latestByCharacter,
    openLifeEventByCharacter,
  };
}

function normalizeDecision(raw, sourceEvent, resolverViewHash = null) {
  if (!isObject(raw)) return null;
  const character = requiredString(
    raw.character,
    "organization decision character",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID",
  );
  const episodeId = requiredString(
    raw.subjective_episode_id,
    "organization decision subjective_episode_id",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID",
  );
  if (!sameCharacter(character, sourceEvent.character)
    || episodeId !== sourceEvent.subjective_episode_id) {
    const error = new Error("Autobiographical organization decision does not match its source episode.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_SOURCE_MISMATCH";
    throw error;
  }
  const decision = requiredString(
    raw.decision,
    "organization decision",
    "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID",
  );
  if (!["start_new_life_event", "attach_to_open_life_event"].includes(decision)) {
    const error = new Error(`Unsupported autobiographical organization decision: ${decision}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID";
    throw error;
  }
  return {
    character,
    subjective_episode_id: episodeId,
    decision,
    target_life_event_id: optionalString(raw.target_life_event_id),
    reason: optionalString(raw.reason) ?? "programmatic_materialized_organization_evidence",
    evidence_refs: normalizeEvidenceRefs(raw.evidence_refs),
    resolver_view_hash: optionalString(raw.resolver_view_hash) ?? resolverViewHash,
    source: optionalString(raw.source) ?? "programmatic_autobiographical_life_event_resolver",
  };
}

function decisionIndex(rawDecisions, sourceEvents, resolverViewHash = null) {
  const byEpisode = new Map();
  const currentEpisodeKeys = new Set(
    sourceEvents.map((event) => `${characterKey(event.character)}:${event.subjective_episode_id}`),
  );
  for (const raw of array(rawDecisions)) {
    const character = requiredString(
      raw?.character,
      "organization decision character",
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID",
    );
    const episodeId = requiredString(
      raw?.subjective_episode_id,
      "organization decision subjective_episode_id",
      "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_INVALID",
    );
    const key = `${characterKey(character)}:${episodeId}`;
    if (!currentEpisodeKeys.has(key)) {
      const error = new Error(`Organization decision for ${episodeId} is outside the current Phase67A source set.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_OUT_OF_SCOPE";
      throw error;
    }
    if (byEpisode.has(key)) {
      const error = new Error(`Duplicate autobiographical organization decision for ${episodeId}.`);
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_DECISION_DUPLICATE";
      throw error;
    }
    const sourceEvent = sourceEvents.find((event) =>
      sameCharacter(event.character, character)
      && event.subjective_episode_id === episodeId,
    );
    byEpisode.set(key, normalizeDecision(raw, sourceEvent, resolverViewHash));
  }
  return byEpisode;
}

function newLifeEventId(sourceEvent, previousEvent) {
  return `autobiographical_life_event_${hashAgentRunValue({
    version: worldSimulationAutobiographicalLifeEventVersion,
    character: characterKey(sourceEvent.character),
    first_subjective_episode_id: sourceEvent.subjective_episode_id,
    previous_organization_event_hash:
      previousEvent?.organization_event_hash ?? null,
    identity_source: "phase67b_subjective_episode_lineage",
  }).slice(0, 24)}`;
}

function organizationEventFor({
  sourceEvent,
  sourceEpisodeHash,
  previousEvent,
  previousOpenLifeEventId,
  decision,
}) {
  const explicitDecision = decision ?? null;
  const resolution = explicitDecision?.decision ?? "start_new_life_event";
  const evidenceRefs = explicitDecision?.evidence_refs ?? [];
  const strongEvidence = evidenceRefs.filter((item) =>
    strongAttachEvidenceKinds.includes(item.kind),
  );

  if (resolution === "attach_to_open_life_event") {
    if (!previousOpenLifeEventId) {
      const error = new Error("Cannot attach a subjective episode when no open autobiographical LifeEvent exists.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_ATTACH_WITHOUT_OPEN_EVENT";
      throw error;
    }
    if (
      explicitDecision?.target_life_event_id
      && explicitDecision.target_life_event_id !== previousOpenLifeEventId
    ) {
      const error = new Error("Phase67B may attach only to the current same-character open LifeEvent in v1.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_ATTACH_TARGET_INVALID";
      throw error;
    }
    if (!strongEvidence.length) {
      const error = new Error("Cross-episode LifeEvent attachment requires explicit programmatic binding evidence in Phase67B v1.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_ATTACH_STRONG_EVIDENCE_REQUIRED";
      throw error;
    }
    const resolverViewHash = optionalString(explicitDecision?.resolver_view_hash);
    if (!resolverViewHash) {
      const error = new Error("Cross-episode LifeEvent attachment requires resolver-view provenance.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_RESOLVER_VIEW_HASH_REQUIRED";
      throw error;
    }
    const expectedSourceRef = `phase67b_resolver_view:${resolverViewHash}`;
    if (
      strongEvidence.length !== 1
      || strongEvidence[0].kind !== "explicit_programmatic_binding"
      || strongEvidence[0].source_ref !== expectedSourceRef
      || strongEvidence[0].source_hash !== resolverViewHash
    ) {
      const error = new Error("Phase67B v1 explicit programmatic binding evidence must be pinned to the exact resolver view hash.");
      error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVIDENCE_PROVENANCE_MISMATCH";
      throw error;
    }
  }

  const lifeEventId = resolution === "attach_to_open_life_event"
    ? previousOpenLifeEventId
    : newLifeEventId(sourceEvent, previousEvent);

  const base = {
    schema_version: autobiographicalLifeEventOrganizationEventSchemaVersion,
    version: worldSimulationAutobiographicalLifeEventVersion,
    immutable: true,
    character: sourceEvent.character,
    source_turn_id: sourceEvent.source_turn_id,
    source_segmentation_event_id: sourceEvent.segmentation_event_id,
    source_segmentation_event_hash: sourceEvent.segmentation_event_hash,
    subjective_episode_id: sourceEvent.subjective_episode_id,
    source_episode_hash: sourceEpisodeHash,
    resolution,
    life_event_id: lifeEventId,
    previous_organization_event_id:
      previousEvent?.organization_event_id ?? null,
    previous_organization_event_hash:
      previousEvent?.organization_event_hash ?? null,
    previous_open_life_event_id: previousOpenLifeEventId ?? null,
    closes_previous_life_event_id:
      resolution === "start_new_life_event"
        ? (previousOpenLifeEventId ?? null)
        : null,
    resulting_open_life_event_id: lifeEventId,
    organization_evidence: {
      decision_source:
        explicitDecision?.source ?? "phase67b_conservative_default",
      decision_reason:
        explicitDecision?.reason
        ?? "insufficient_cross_episode_evidence_defaults_to_new_life_event",
      resolver_view_hash:
        explicitDecision?.resolver_view_hash ?? null,
      evidence_refs: cloneJson(evidenceRefs),
      strong_evidence_kinds:
        uniqueSorted(strongEvidence.map((item) => item.kind)),
      auxiliary_evidence_kinds:
        uniqueSorted(
          evidenceRefs
            .filter((item) => auxiliaryEvidenceKinds.includes(item.kind))
            .map((item) => item.kind),
        ),
      insufficient_cross_episode_evidence:
        explicitDecision === null,
      temporal_contiguity_alone_is_sufficient: false,
      spatial_contiguity_alone_is_sufficient: false,
      hidden_world_state_used: false,
      numeric_similarity_threshold_used: false,
      llm_freeform_semantic_merge_used: false,
    },
    source_semantics: {
      phase67a_effective_subjective_episode_is_authoritative_source: true,
      episode_content_copied: false,
      memory_content_copied: false,
      repeated_event_category_modeled: false,
      personal_semantic_memory_modeled: false,
      one_primary_life_event_parent_per_episode: true,
      world_event_identity_promoted: false,
      world_turn_identity_promoted: false,
      subjective_episode_identity_promoted: false,
    },
    subjective_not_world_truth: true,
    world_truth_verified: false,
    confidence: null,
    probability: null,
    memory_content_copied: false,
    episode_content_copied: false,
    world_event_identity_promoted: false,
    world_turn_identity_promoted: false,
    subjective_episode_identity_promoted: false,
    character_brain_direct_write: false,
    status: "autobiographical_life_event_organization_recorded",
  };

  const organizationEventId =
    `autobiographical_life_event_organization_event_${hashAgentRunValue({
      version: worldSimulationAutobiographicalLifeEventVersion,
      character: characterKey(sourceEvent.character),
      source_turn_id: sourceEvent.source_turn_id,
      source_segmentation_event_id: sourceEvent.segmentation_event_id,
      source_segmentation_event_hash: sourceEvent.segmentation_event_hash,
      subjective_episode_id: sourceEvent.subjective_episode_id,
      source_episode_hash: sourceEpisodeHash,
      resolution,
      life_event_id: lifeEventId,
      previous_organization_event_hash:
        previousEvent?.organization_event_hash ?? null,
    }).slice(0, 24)}`;

  const event = {
    ...base,
    organization_event_id: organizationEventId,
  };
  event.organization_event_hash = organizationEventHash(event);
  return deepFreeze(event);
}

function historyReferenceFor(event) {
  return deepFreeze({
    schema_version: autobiographicalLifeEventOrganizationHistoryReferenceSchemaVersion,
    derived_index: true,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
    character: event.character,
    source_turn_id: event.source_turn_id,
    source_segmentation_event_id: event.source_segmentation_event_id,
    source_segmentation_event_hash: event.source_segmentation_event_hash,
    subjective_episode_id: event.subjective_episode_id,
    source_episode_hash: event.source_episode_hash,
    life_event_id: event.life_event_id,
    resolution: event.resolution,
    previous_organization_event_id: event.previous_organization_event_id,
    previous_organization_event_hash: event.previous_organization_event_hash,
    status: event.status,
  });
}

export function projectWorldSimulationEffectiveAutobiographicalLifeEvents(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const existing = validateExistingOrganizationHistory(worldState);
  const lifeEventsByCharacter = {};
  const episodeParentByCharacter = {};
  const openByCharacter = {};

  for (const reference of existing.history) {
    const event = existing.events[reference.organization_event_id];
    const character = event.character;
    if (!isObject(lifeEventsByCharacter[character])) lifeEventsByCharacter[character] = {};
    if (!isObject(episodeParentByCharacter[character])) episodeParentByCharacter[character] = {};

    if (
      event.resolution === "start_new_life_event"
      && event.closes_previous_life_event_id
      && lifeEventsByCharacter[character][event.closes_previous_life_event_id]
    ) {
      lifeEventsByCharacter[character][event.closes_previous_life_event_id].state = "closed";
      lifeEventsByCharacter[character][event.closes_previous_life_event_id].closed_by_organization_event_id =
        event.organization_event_id;
    }

    const prior = object(lifeEventsByCharacter[character][event.life_event_id]);
    const episodeIds = uniqueSorted([
      ...array(prior.member_subjective_episode_ids),
      event.subjective_episode_id,
    ]);
    const organizationEventIds = [
      ...array(prior.organization_event_ids),
      event.organization_event_id,
    ];

    lifeEventsByCharacter[character][event.life_event_id] = {
      life_event_id: event.life_event_id,
      character,
      member_subjective_episode_ids: episodeIds,
      first_subjective_episode_id:
        prior.first_subjective_episode_id ?? event.subjective_episode_id,
      latest_subjective_episode_id: event.subjective_episode_id,
      organization_event_ids: organizationEventIds,
      first_source_turn_id: prior.first_source_turn_id ?? event.source_turn_id,
      latest_source_turn_id: event.source_turn_id,
      latest_organization_event_id: event.organization_event_id,
      state: "open",
      closed_by_organization_event_id: null,
      subjective_not_world_truth: true,
      episode_content_duplicated: false,
      memory_content_duplicated: false,
    };
    episodeParentByCharacter[character][event.subjective_episode_id] = event.life_event_id;
    openByCharacter[character] = event.life_event_id;
  }

  const projection = {
    version: effectiveAutobiographicalLifeEventProjectionVersion,
    source_version: worldSimulationAutobiographicalLifeEventVersion,
    life_events_by_character: lifeEventsByCharacter,
    episode_primary_parent_by_character: episodeParentByCharacter,
    open_life_event_by_character: openByCharacter,
    source_history_hash: hashAgentRunValue(existing.history),
    replayed_event_count: existing.history.length,
    replayable_projection: true,
    one_primary_parent_per_subjective_episode: true,
    repeated_event_categories_modeled: false,
    personal_semantic_memory_modeled: false,
    episode_content_duplicated: false,
    memory_content_duplicated: false,
    world_truth_authority_claimed: false,
    character_brain_exposure_installed: false,
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}

function orderedCurrentSourceEvents(worldState, sourceSegmentationEventIds, turnId) {
  const wanted = new Set(
    array(sourceSegmentationEventIds)
      .map((value) => requiredString(value, "source_segmentation_event_id")),
  );
  const ordered = [];
  for (const reference of array(worldState.subjective_episode_segmentation_history)) {
    const eventId = optionalString(reference?.segmentation_event_id);
    if (!eventId || !wanted.has(eventId)) continue;
    const event = assertCanonicalSegmentationEvent(worldState, eventId, turnId);
    ordered.push(event);
    wanted.delete(eventId);
  }
  if (wanted.size) {
    const error = new Error(`Phase67B cannot resolve current Phase67A source event(s): ${[...wanted].join(", ")}.`);
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_SOURCE_SEGMENTATION_EVENT_UNRESOLVED";
    throw error;
  }
  return ordered;
}

export function buildWorldSimulationAutobiographicalLifeEventResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const sourceEvents = orderedCurrentSourceEvents(
    worldState,
    input.source_segmentation_event_ids,
    turnId,
  );
  const existing = validateExistingOrganizationHistory(worldState);
  const projection = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
    world_state: worldState,
  });

  const sourceEpisodeUpdates = sourceEvents.map((event) => {
    const canonical = canonicalSourceEpisode(worldState, event);
    const key = `${characterKey(event.character)}:${event.subjective_episode_id}`;
    const existingParent = existing.episodeParent.get(key) ?? null;
    return {
      character: event.character,
      source_turn_id: event.source_turn_id,
      source_segmentation_event_id: event.segmentation_event_id,
      source_segmentation_event_hash: event.segmentation_event_hash,
      subjective_episode_id: event.subjective_episode_id,
      source_episode_hash: canonical.episode_hash,
      segmentation_resolution: event.resolution,
      materialized_scene_ids: cloneJson(
        array(event.segmentation_evidence?.current_scene_ids),
      ),
      encoded_at_values: cloneJson(
        array(event.segmentation_evidence?.encoded_at_values),
      ),
      already_has_primary_life_event_parent: Boolean(existingParent),
      existing_primary_life_event_id: existingParent?.life_event_id ?? null,
      prior_open_life_event_id:
        existing.openLifeEventByCharacter.get(characterKey(event.character)) ?? null,
    };
  });

  const view = {
    version: worldSimulationAutobiographicalLifeEventVersion,
    turn_id: turnId,
    source_episode_updates: sourceEpisodeUpdates,
    current_effective_life_event_projection_hash: projection.projection_hash,
    supported_decisions: [
      "start_new_life_event",
      "attach_to_open_life_event",
    ],
    strong_attach_evidence_kinds: [...strongAttachEvidenceKinds],
    auxiliary_evidence_kinds: [...auxiliaryEvidenceKinds],
    reserved_future_materialized_evidence_kinds:
      [...reservedFutureMaterializedEvidenceKinds],
    explicit_programmatic_binding_source_ref_format:
      "phase67b_resolver_view:<resolver_view_hash>",
    explicit_programmatic_binding_source_hash_is_resolver_view_hash: true,
    temporal_contiguity_alone_is_sufficient: false,
    spatial_contiguity_alone_is_sufficient: false,
    new_episode_defaults_to_new_life_event_when_evidence_is_insufficient: true,
    memory_content_exposed: false,
    episode_content_exposed: false,
    whole_world_state_exposed: false,
    raw_world_event_exposed: false,
    world_truth_judgment_requested: false,
    confidence_probability_requested: false,
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

export function buildWorldSimulationAutobiographicalLifeEventOrganizationContract() {
  return deepFreeze({
    version: worldSimulationAutobiographicalLifeEventVersion,
    phase: "Phase67B",
    status: "autobiographical_life_event_organization_installed",
    source_owner: "Phase67A",
    source_projection: "effective_subjective_episode_projection",
    extended_autobiographical_events_modeled: true,
    repeated_event_categories_modeled: false,
    personal_semantic_memory_owner: "Phase67C",
    one_primary_life_event_parent_per_subjective_episode: true,
    immutable_organization_event_write_once_required: true,
    append_only_history_required: true,
    per_character_previous_event_hash_chain_required: true,
    effective_life_event_projection_replayable: true,
    effective_life_event_projection_version:
      effectiveAutobiographicalLifeEventProjectionVersion,
    new_episode_default_when_cross_episode_evidence_missing:
      "start_new_life_event",
    same_episode_increment_preserves_existing_parent: true,
    cross_episode_attach_requires_strong_materialized_evidence: true,
    strong_attach_evidence_kinds: [...strongAttachEvidenceKinds],
    auxiliary_evidence_kinds: [...auxiliaryEvidenceKinds],
    reserved_future_materialized_evidence_kinds:
      [...reservedFutureMaterializedEvidenceKinds],
    explicit_programmatic_binding_provenance_verified: true,
    explicit_programmatic_binding_source_ref_format:
      "phase67b_resolver_view:<resolver_view_hash>",
    explicit_programmatic_binding_source_hash_is_resolver_view_hash: true,
    unverifiable_goal_task_project_relationship_evidence_accepted: false,
    temporal_contiguity_alone_is_sufficient: false,
    spatial_contiguity_alone_is_sufficient: false,
    numeric_similarity_threshold_modeled: false,
    freeform_llm_semantic_merge_authority: false,
    source_episode_content_copied_into_life_event_nodes: false,
    source_memory_content_copied_into_life_event_nodes: false,
    world_event_id_auto_promoted_to_life_event_id: false,
    world_turn_id_auto_promoted_to_life_event_id: false,
    subjective_episode_id_auto_promoted_to_life_event_id: false,
    hidden_world_state_allowed: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
    last_write_wins_allowed: false,
    character_brain_direct_durable_write_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    separate_retrieval_engine_installed: false,
    phase63_phase64_retrieval_substrate_reused: true,
    split_merge_revision_semantics_deferred: true,
    authoritative_mutation_owner:
      "phase62k-authoritative-mutation-executor-v1",
    deterministic_replay_required: true,
    input_immutability_required: true,
  });
}

export function buildWorldSimulationAutobiographicalLifeEventOrganizations(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  const sourceIds = array(input.source_segmentation_event_ids);
  const decisions = array(input.organization_decisions);
  const resolverViewHash = optionalString(input.resolver_view_hash);
  const inputSnapshot = cloneJson({
    world_state: worldState,
    turn_id: turnId,
    source_segmentation_event_ids: sourceIds,
    organization_decisions: decisions,
    resolver_view_hash: resolverViewHash,
  });
  const inputHash = hashAgentRunValue(inputSnapshot);
  const existing = validateExistingOrganizationHistory(worldState);
  const sourceEvents = orderedCurrentSourceEvents(worldState, sourceIds, turnId);
  const decisionsByEpisode = decisionIndex(decisions, sourceEvents, resolverViewHash);

  const preview = cloneJson(worldState);
  const createdEvents = [];
  const appendedReferences = [];
  const alreadyPersistedOrganizationEventIds = new Set();
  const stateTransitions = [];
  const latestByCharacter = new Map(existing.latestByCharacter);
  const openByCharacter = new Map(existing.openLifeEventByCharacter);
  const episodeParent = new Map(existing.episodeParent);

  for (const sourceEvent of sourceEvents) {
    const key = characterKey(sourceEvent.character);
    const episodeKey = `${key}:${sourceEvent.subjective_episode_id}`;
    const canonicalEpisode = canonicalSourceEpisode(worldState, sourceEvent);
    const priorParent = episodeParent.get(episodeKey) ?? null;
    if (priorParent) {
      const priorEvent = existing.events[priorParent.organization_event_id];
      if (
        !isObject(priorEvent)
        || priorEvent.source_episode_hash !== canonicalEpisode.episode_hash
      ) {
        // Phase67A episodes may legitimately gain additional atomic traces over
        // time. Parent identity remains stable; Phase67B does not rewrite the
        // original membership event just because the effective episode grows.
        if (!isObject(priorEvent)
          || priorEvent.subjective_episode_id !== sourceEvent.subjective_episode_id
          || !sameCharacter(priorEvent.character, sourceEvent.character)) {
          const error = new Error(`Existing LifeEvent parent for ${sourceEvent.subjective_episode_id} is inconsistent.`);
          error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EXISTING_PARENT_MISMATCH";
          throw error;
        }
      }
      alreadyPersistedOrganizationEventIds.add(priorParent.organization_event_id);
      continue;
    }

    const previousEvent = latestByCharacter.get(key) ?? null;
    const previousOpenLifeEventId = openByCharacter.get(key) ?? null;
    const decision = decisionsByEpisode.get(episodeKey) ?? null;
    const event = organizationEventFor({
      sourceEvent,
      sourceEpisodeHash: canonicalEpisode.episode_hash,
      previousEvent,
      previousOpenLifeEventId,
      decision,
    });

    const collision = object(
      object(existing.events)[event.organization_event_id],
    );
    if (Object.keys(collision).length) {
      assertPersistedOrganizationEvent(collision, event.organization_event_id);
      if (!sameValue(collision, event)) {
        const error = new Error(`AutobiographicalLifeEventOrganizationEvent ${event.organization_event_id} already exists with different immutable content.`);
        error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_EVENT_IMMUTABILITY_VIOLATION";
        throw error;
      }
      alreadyPersistedOrganizationEventIds.add(event.organization_event_id);
      latestByCharacter.set(key, collision);
      openByCharacter.set(key, collision.life_event_id);
      episodeParent.set(episodeKey, {
        life_event_id: collision.life_event_id,
        organization_event_id: collision.organization_event_id,
      });
      continue;
    }

    preview.autobiographical_life_event_organization_events = object(
      preview.autobiographical_life_event_organization_events,
    );
    preview.autobiographical_life_event_organization_events[event.organization_event_id] =
      cloneJson(event);
    createdEvents.push(event);
    const reference = historyReferenceFor(event);
    appendedReferences.push(reference);
    latestByCharacter.set(key, event);
    openByCharacter.set(key, event.life_event_id);
    episodeParent.set(episodeKey, {
      life_event_id: event.life_event_id,
      organization_event_id: event.organization_event_id,
    });

    stateTransitions.push({
      entity: "world",
      field:
        `autobiographical_life_event_organization_events.${event.organization_event_id}`,
      from: null,
      to: cloneJson(event),
      cause:
        `persist immutable AutobiographicalLifeEventOrganizationEvent ${event.organization_event_id}`,
      source_layer: "autobiographical_life_event_organization",
    });
  }

  if (appendedReferences.length) {
    const nextHistory = [
      ...existing.history.map(cloneJson),
      ...appendedReferences.map(cloneJson),
    ];
    preview.autobiographical_life_event_organization_history = nextHistory;
    stateTransitions.push({
      entity: "world",
      field: "autobiographical_life_event_organization_history",
      from: cloneJson(worldState.autobiographical_life_event_organization_history ?? null),
      to: cloneJson(nextHistory),
      cause:
        `append ${appendedReferences.length} Phase67B autobiographical LifeEvent organization history reference(s)`,
      source_layer: "autobiographical_life_event_organization",
    });
  }

  const effectiveProjection = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
    world_state: preview,
  });

  if (hashAgentRunValue(inputSnapshot) !== inputHash) {
    const error = new Error("Phase67B autobiographical LifeEvent organization mutated its input snapshot.");
    error.code = "WORLD_SIMULATION_AUTOBIOGRAPHICAL_LIFE_EVENT_INPUT_MUTATED";
    throw error;
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationAutobiographicalLifeEventVersion,
    result: {
      processed_source_segmentation_event_count: sourceEvents.length,
      organization_events_created: createdEvents,
      already_persisted_organization_event_ids:
        [...alreadyPersistedOrganizationEventIds].sort(compareText),
      history_references_appended: appendedReferences,
      state_transitions: stateTransitions,
      preview_world_state: preview,
      effective_life_event_projection: effectiveProjection,
      audit: {
        input_context_hash: inputHash,
        source_phase67a_events_hash_verified: true,
        source_effective_episodes_resolved: true,
        current_turn_source_scope_verified: true,
        one_primary_parent_per_episode_enforced: true,
        same_episode_increment_reuses_existing_parent: true,
        insufficient_cross_episode_evidence_defaults_to_new_life_event: true,
        cross_episode_attach_requires_strong_materialized_evidence: true,
        temporal_contiguity_alone_used_for_merge: false,
        spatial_contiguity_alone_used_for_merge: false,
        numeric_similarity_threshold_used: false,
        freeform_llm_semantic_merge_used: false,
        episode_content_copied: false,
        memory_content_copied: false,
        repeated_event_category_modeled: false,
        personal_semantic_memory_modeled: false,
        world_event_identity_promoted: false,
        world_turn_identity_promoted: false,
        subjective_episode_identity_promoted: false,
        hidden_world_state_used: false,
        world_truth_authority_claimed: false,
        confidence_probability_modeled: false,
        last_write_wins_applied: false,
        separate_retrieval_engine_installed: false,
        character_brain_direct_write_used: false,
        same_turn_character_brain_feedback_allowed: false,
      },
    },
  });
}
