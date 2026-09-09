import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  subjectiveEpisodeSegmentationEventSchemaVersion,
  worldSimulationSubjectiveEpisodeSegmentationVersion,
  projectWorldSimulationEffectiveSubjectiveEpisodes,
} from "./world-simulation-subjective-episode-segmentation-service.mjs";
import {
  autobiographicalLifeEventOrganizationEventSchemaVersion,
  worldSimulationAutobiographicalLifeEventVersion,
  projectWorldSimulationEffectiveAutobiographicalLifeEvents,
} from "./world-simulation-autobiographical-life-event-service.mjs";
import {
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
} from "./world-simulation-post-outcome-subjective-memory-bridge-service.mjs";

export const worldSimulationMultiExperienceSchemaEvidenceVersion =
  "phase77a-multi-experience-schema-evidence-v1";

const maximumPriorLifeEventsPerCharacter = 24;
const maximumExperiencesPerLifeEvent = 8;

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
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_INPUT_INVALID";
  throw error;
}
function characterKey(value) {
  return requiredString(value, "character").toLocaleLowerCase("zh-Hant-TW");
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function eventHash(event, field) {
  const body = cloneJson(event);
  delete body[field];
  return hashAgentRunValue(body);
}
function memoryId(record) {
  return optionalString(record?.memory_id ?? record?.id);
}

function canonicalOrganizationEvent(worldState, eventId) {
  const event = object(
    object(worldState.autobiographical_life_event_organization_events)[eventId],
  );
  if (!Object.keys(event).length
      || event.schema_version !== autobiographicalLifeEventOrganizationEventSchemaVersion
      || event.version !== worldSimulationAutobiographicalLifeEventVersion
      || event.immutable !== true
      || event.organization_event_id !== eventId
      || !optionalString(event.organization_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.source_turn_id)
      || !optionalString(event.life_event_id)
      || event.subjective_not_world_truth !== true
      || event.world_truth_verified !== false
      || event.memory_content_copied !== false
      || event.episode_content_copied !== false
      || eventHash(event, "organization_event_hash") !== event.organization_event_hash) {
    const error = new Error(`Phase77A cannot resolve canonical Phase67B event ${eventId}.`);
    error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_LIFE_EVENT_INVALID";
    throw error;
  }
  return event;
}

function canonicalSegmentationEvent(worldState, eventId) {
  const event = object(object(worldState.subjective_episode_segmentation_events)[eventId]);
  if (!Object.keys(event).length
      || event.schema_version !== subjectiveEpisodeSegmentationEventSchemaVersion
      || event.version !== worldSimulationSubjectiveEpisodeSegmentationVersion
      || event.immutable !== true
      || event.segmentation_event_id !== eventId
      || !optionalString(event.segmentation_event_hash)
      || !optionalString(event.character)
      || !optionalString(event.subjective_episode_id)
      || !Array.isArray(event.source_memory_refs)
      || event.subjective_not_world_truth !== true
      || event.world_truth_verified !== false
      || event.memory_content_copied !== false
      || eventHash(event, "segmentation_event_hash") !== event.segmentation_event_hash) {
    const error = new Error(`Phase77A cannot resolve canonical Phase67A event ${eventId}.`);
    error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_EPISODE_INVALID";
    throw error;
  }
  return event;
}

function characterMemories(worldState, character) {
  const memories = object(worldState.memories);
  if (Array.isArray(memories[character])) return memories[character];
  const wanted = characterKey(character);
  for (const [name, records] of Object.entries(memories)) {
    if (characterKey(name) === wanted && Array.isArray(records)) return records;
  }
  return [];
}

function boundedActionExperience(record) {
  const content = object(record?.content);
  if (record?.memory_type !== "episodic_action_experience"
      || record?.source?.kind !== "post_outcome_subjective_experience"
      || record?.source?.sense !== "other"
      || record?.internal_provenance?.post_outcome_bridge_version
        !== worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion
      || !optionalString(record?.internal_provenance?.post_outcome_subjective_perception_ref)
      || !optionalString(record?.internal_provenance?.post_outcome_subjective_perception_hash)
      || content.kind !== "post_outcome_action_experience"
      || !optionalString(content.action)
      || record?.subjective_memory_not_world_truth !== true) {
    return null;
  }
  const bounded = {
    action: content.action.trim(),
    possibly_incorrect: record.possibly_incorrect === true,
    source_confused: record.source_confused === true,
    subjective_memory_not_world_truth: true,
  };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(content, key)) continue;
    const value = content[key];
    if (["string", "number", "boolean"].includes(typeof value)) {
      bounded[key] = cloneJson(value);
    }
  }
  return bounded;
}

function canonicalMemoryRefsForLifeEvent(worldState, character, lifeEvent) {
  const wantedEpisodes = new Set(array(lifeEvent.member_subjective_episode_ids));
  const memoryRefs = new Map();
  const episodeRefs = [];
  for (const reference of array(worldState.subjective_episode_segmentation_history)) {
    const eventId = optionalString(reference?.segmentation_event_id);
    if (!eventId) continue;
    const event = canonicalSegmentationEvent(worldState, eventId);
    if (characterKey(event.character) !== characterKey(character)
        || !wantedEpisodes.has(event.subjective_episode_id)) continue;
    episodeRefs.push({
      subjective_episode_id: event.subjective_episode_id,
      segmentation_event_id: event.segmentation_event_id,
      segmentation_event_hash: event.segmentation_event_hash,
    });
    for (const ref of event.source_memory_refs) {
      const id = requiredString(ref?.memory_id, "source memory id");
      const hash = requiredString(ref?.memory_hash, "source memory hash");
      const prior = memoryRefs.get(id);
      if (prior && prior !== hash) {
        const error = new Error(`Phase77A found conflicting immutable hashes for memory ${id}.`);
        error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_MEMORY_LINEAGE_CONFLICT";
        throw error;
      }
      memoryRefs.set(id, hash);
    }
  }
  episodeRefs.sort((left, right) =>
    compareText(left.subjective_episode_id, right.subjective_episode_id)
      || compareText(left.segmentation_event_id, right.segmentation_event_id));
  return {
    episode_refs: episodeRefs,
    memory_refs: [...memoryRefs.entries()]
      .map(([id, hash]) => ({ memory_id: id, memory_hash: hash }))
      .sort((left, right) => compareText(left.memory_id, right.memory_id)),
  };
}

function lifeEventEvidence(worldState, lifeEvent, latestOrganizationEvent, role) {
  const lineage = canonicalMemoryRefsForLifeEvent(
    worldState,
    lifeEvent.character,
    lifeEvent,
  );
  const records = characterMemories(worldState, lifeEvent.character);
  const boundedExperiences = [];
  const usedMemoryRefs = [];
  for (const ref of lineage.memory_refs) {
    const record = records.find((item) => memoryId(item) === ref.memory_id);
    if (!isObject(record) || hashAgentRunValue(record) !== ref.memory_hash) {
      const error = new Error(
        `Phase77A source memory ${ref.memory_id} no longer matches canonical Phase67A lineage.`,
      );
      error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_MEMORY_HASH_MISMATCH";
      throw error;
    }
    const bounded = boundedActionExperience(record);
    if (!bounded) continue;
    boundedExperiences.push(bounded);
    usedMemoryRefs.push(ref);
    if (boundedExperiences.length >= maximumExperiencesPerLifeEvent) break;
  }
  if (!boundedExperiences.length) return null;
  const identity = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    character: characterKey(lifeEvent.character),
    life_event_id: lifeEvent.life_event_id,
    latest_organization_event_id: latestOrganizationEvent.organization_event_id,
    latest_organization_event_hash: latestOrganizationEvent.organization_event_hash,
    used_memory_refs: usedMemoryRefs,
  };
  const evidenceRef = `phase77a_evidence_${hashAgentRunValue(identity).slice(0, 24)}`;
  return {
    public: {
      evidence_ref: evidenceRef,
      role,
      bounded_experiences: boundedExperiences,
      experience_count: boundedExperiences.length,
      subjective_not_world_truth: true,
    },
    internal: {
      evidence_ref: evidenceRef,
      character: lifeEvent.character,
      life_event_id: lifeEvent.life_event_id,
      latest_organization_event_id: latestOrganizationEvent.organization_event_id,
      latest_organization_event_hash: latestOrganizationEvent.organization_event_hash,
      source_episode_refs: lineage.episode_refs,
      source_memory_refs: usedMemoryRefs,
    },
  };
}

function latestOrganizationEventsByLifeEvent(worldState, character) {
  const latest = new Map();
  let order = 0;
  for (const reference of array(worldState.autobiographical_life_event_organization_history)) {
    const eventId = optionalString(reference?.organization_event_id);
    if (!eventId) continue;
    const event = canonicalOrganizationEvent(worldState, eventId);
    if (characterKey(event.character) !== characterKey(character)) continue;
    latest.set(event.life_event_id, { event, order });
    order += 1;
  }
  return latest;
}

export function buildWorldSimulationMultiExperienceSchemaEvidenceContract() {
  return deepFreeze({
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    phase: "Phase77A",
    status: "bounded_multi_experience_schema_evidence_assembly_installed",
    source_owners: ["Phase67A", "Phase67B", "Phase76B"],
    current_turn_phase67b_anchor_required: true,
    same_character_only: true,
    distinct_life_events_required_for_future_schema: 2,
    phase76b_post_outcome_action_experience_only: true,
    individual_episode_specificity_preserved: true,
    relational_alignment_performed: false,
    schema_induction_performed: false,
    schema_semantic_content_authored: false,
    phase77b_relational_alignment_owner: true,
    phase67c_durable_semantic_owner: true,
    recurrence_count_auto_promotes_schema: false,
    numeric_similarity_threshold_modeled: false,
    numeric_confidence_probability_modeled: false,
    raw_world_state_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    other_character_private_state_exposed: false,
    internal_life_event_episode_memory_lineage_exposed_to_future_aligner: false,
    direct_belief_plan_goal_current_mind_world_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
  });
}

export function buildWorldSimulationMultiExperienceSchemaEvidenceView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = requiredString(input.turn_id, "turn_id");
  // These projections validate the complete Phase67A/67B replay chains first.
  const effectiveEpisodes = projectWorldSimulationEffectiveSubjectiveEpisodes({
    world_state: worldState,
  });
  const effectiveLifeEvents = projectWorldSimulationEffectiveAutobiographicalLifeEvents({
    world_state: worldState,
  });

  const currentIds = [...new Set(array(input.source_organization_event_ids)
    .map((value) => requiredString(value, "source_organization_event_id")))];
  const currentEvents = currentIds.map((eventId) => {
    const event = canonicalOrganizationEvent(worldState, eventId);
    if (event.source_turn_id !== turnId) {
      const error = new Error(
        `Phase77A current anchor ${eventId} is not from turn ${turnId}.`,
      );
      error.code = "WORLD_SIMULATION_MULTI_EXPERIENCE_SCHEMA_EVIDENCE_CURRENT_TURN_MISMATCH";
      throw error;
    }
    return event;
  });

  const currentLifeEventsByCharacter = new Map();
  for (const event of currentEvents) {
    const key = characterKey(event.character);
    if (!currentLifeEventsByCharacter.has(key)) {
      currentLifeEventsByCharacter.set(key, {
        character: event.character,
        life_event_ids: new Set(),
      });
    }
    currentLifeEventsByCharacter.get(key).life_event_ids.add(event.life_event_id);
  }

  const characterContexts = [];
  const internalLineage = [];
  for (const entry of currentLifeEventsByCharacter.values()) {
    const lifeEvents = object(effectiveLifeEvents.life_events_by_character?.[entry.character]);
    let canonicalLifeEvents = lifeEvents;
    if (!Object.keys(canonicalLifeEvents).length) {
      for (const [name, values] of Object.entries(
        effectiveLifeEvents.life_events_by_character ?? {},
      )) {
        if (characterKey(name) === characterKey(entry.character)) {
          canonicalLifeEvents = object(values);
          break;
        }
      }
    }
    const latest = latestOrganizationEventsByLifeEvent(worldState, entry.character);
    const currentEvidence = [];
    const priorEvidence = [];
    const ordered = [...latest.entries()].sort((left, right) => right[1].order - left[1].order);
    for (const [lifeEventId, latestInfo] of ordered) {
      const lifeEvent = canonicalLifeEvents[lifeEventId];
      if (!isObject(lifeEvent)) continue;
      const role = entry.life_event_ids.has(lifeEventId)
        ? "current_anchor"
        : "prior_comparison_candidate";
      const evidence = lifeEventEvidence(
        worldState,
        lifeEvent,
        latestInfo.event,
        role,
      );
      if (!evidence) continue;
      if (role === "current_anchor") {
        currentEvidence.push(evidence.public);
        internalLineage.push(evidence.internal);
      } else if (priorEvidence.length < maximumPriorLifeEventsPerCharacter) {
        priorEvidence.push(evidence.public);
        internalLineage.push(evidence.internal);
      }
    }
    if (!currentEvidence.length) continue;
    characterContexts.push({
      character: entry.character,
      current_anchor_evidence: currentEvidence,
      prior_comparison_evidence: priorEvidence,
      current_anchor_count: currentEvidence.length,
      prior_comparison_candidate_count: priorEvidence.length,
      comparison_ready: priorEvidence.length > 0,
      minimum_distinct_life_events_for_schema: 2,
    });
  }
  characterContexts.sort((left, right) =>
    left.character.localeCompare(right.character, "zh-Hant-TW"));
  internalLineage.sort((left, right) => compareText(left.evidence_ref, right.evidence_ref));

  const resolverView = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: turnId,
    character_contexts: characterContexts,
    comparison_requirements: {
      current_turn_anchor_required: true,
      same_character_only: true,
      minimum_distinct_life_events: 2,
      comparison_of_multiple_instances_required: true,
      relation_structure_must_be_derived_downstream: true,
      recurrence_count_is_not_schema_authority: true,
    },
    boundaries: {
      phase67a_phase67b_lineage_verified: true,
      phase76b_action_experience_only: true,
      individual_experience_specificity_preserved: true,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_private_state_exposed: false,
      internal_lineage_exposed: false,
      relational_alignment_requested: false,
      semantic_schema_authoring_requested: false,
      numeric_similarity_confidence_probability_requested: false,
      direct_durable_write_requested: false,
      same_turn_character_brain_feedback_requested: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  const result = {
    version: worldSimulationMultiExperienceSchemaEvidenceVersion,
    turn_id: turnId,
    source_phase67a_projection_hash: effectiveEpisodes.projection_hash,
    source_phase67b_projection_hash: effectiveLifeEvents.projection_hash,
    resolver_view: resolverView,
    internal_lineage: internalLineage,
    ready_character_count: characterContexts.filter((context) => context.comparison_ready).length,
    audit: {
      current_anchor_organization_event_count: currentEvents.length,
      character_context_count: characterContexts.length,
      evidence_item_count: internalLineage.length,
      canonical_phase67a_projection_verified: true,
      canonical_phase67b_projection_verified: true,
      canonical_phase76b_subjective_action_experience_required: true,
      same_character_only: true,
      current_turn_anchor_required: true,
      distinct_life_events_required: true,
      recurrence_count_auto_promoted: false,
      relational_alignment_performed: false,
      schema_induction_performed: false,
      phase67c_semantic_decision_emitted: false,
      world_truth_authority_claimed: false,
      numeric_similarity_confidence_probability_modeled: false,
      direct_belief_plan_goal_current_mind_world_mutation: false,
      same_turn_character_brain_feedback: false,
    },
  };
  result.evidence_view_hash = hashAgentRunValue(result);
  return deepFreeze(result);
}
