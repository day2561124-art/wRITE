import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  memoryPlasticityEventSchemaVersion,
  memoryPlasticityHistoryReferenceSchemaVersion,
} from "./world-simulation-memory-plasticity-service.mjs";
import {
  worldSimulationAffectiveAppraisalResolverViews,
} from "./world-simulation-affective-appraisal-service.mjs";

export const worldSimulationAdaptiveMemoryConsolidationVersion =
  "phase91-adaptive-memory-consolidation-lifecycle-v1";
export const memoryConsolidationEventSchemaVersion =
  "phase91-memory-consolidation-event-v1";
export const memoryConsolidationHistoryReferenceSchemaVersion =
  "phase91-memory-consolidation-history-ref-v1";

const allowedStages = Object.freeze([
  "encoded_unconsolidated",
  "stabilizing",
  "consolidated",
]);
const retrievalEvidenceLimit = 8;
const repetitionEvidenceLimit = 4;
const affectiveEvidenceLimit = 8;

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
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function timestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function fail(message, code = "WORLD_SIMULATION_MEMORY_CONSOLIDATION_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function verifyHash(value, hashField, code) {
  if (!isObject(value) || !text(value[hashField])) fail("Missing immutable source hash.", code);
  const body = cloneJson(value);
  const stored = body[hashField];
  delete body[hashField];
  if (hashAgentRunValue(body) !== stored) fail("Immutable source hash mismatch.", code);
}
function memoryEntries(worldState) {
  const output = [];
  for (const [character, rawMemories] of Object.entries(object(worldState.memories))) {
    const seen = new Set();
    for (const memory of array(rawMemories)) {
      if (!isObject(memory) || !text(memory.memory_id)) continue;
      if (seen.has(memory.memory_id)) {
        fail(
          `Duplicate memory id ${memory.memory_id} for ${character}.`,
          "WORLD_SIMULATION_MEMORY_CONSOLIDATION_DUPLICATE_MEMORY",
        );
      }
      seen.add(memory.memory_id);
      output.push({ character, memory });
    }
  }
  return output;
}
function memoryKey(character, memoryId) {
  return `${String(character).trim().toLocaleLowerCase("zh-Hant-TW")}::${memoryId}`;
}
function stageTransitionAllowed(fromStage, toStage) {
  return (fromStage === "encoded_unconsolidated" && toStage === "stabilizing")
    || (fromStage === "stabilizing" && toStage === "consolidated");
}
function consolidationEventBody(input) {
  return {
    schema_version: memoryConsolidationEventSchemaVersion,
    version: worldSimulationAdaptiveMemoryConsolidationVersion,
    character: input.character,
    memory_id: input.memory_id,
    source_memory_turn_id: input.source_memory_turn_id,
    current_turn_id: input.current_turn_id,
    observed_at: input.current_time ?? null,
    from_stage: input.from_stage,
    to_stage: input.to_stage,
    evidence: cloneJson(input.evidence),
    boundaries: {
      memory_content_rewritten: false,
      original_formation_stage_rewritten: false,
      fixed_time_maturity_threshold_used: false,
      sleep_required: false,
      consolidation_establishes_world_truth: false,
      consolidation_guarantees_future_recall: false,
      consolidation_prevents_forgetting: false,
      reconsolidation_performed: false,
    },
    immutable: true,
  };
}
function buildConsolidationEvent(input) {
  const body = consolidationEventBody(input);
  const eventHash = hashAgentRunValue(body);
  return {
    ...body,
    consolidation_event_id: `memory_consolidation_event_${hashAgentRunValue({
      version: worldSimulationAdaptiveMemoryConsolidationVersion,
      current_turn_id: input.current_turn_id,
      character: input.character,
      memory_id: input.memory_id,
      from_stage: input.from_stage,
      to_stage: input.to_stage,
      evidence_hash: hashAgentRunValue(input.evidence),
    }).slice(0, 24)}`,
    consolidation_event_hash: eventHash,
  };
}
function eventHashBody(event) {
  const body = cloneJson(event);
  delete body.consolidation_event_id;
  delete body.consolidation_event_hash;
  return body;
}
function assertConsolidationEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== memoryConsolidationEventSchemaVersion
      || event.version !== worldSimulationAdaptiveMemoryConsolidationVersion
      || event.immutable !== true
      || event.consolidation_event_id !== eventId
      || !text(event.consolidation_event_hash)
      || !text(event.character)
      || !text(event.memory_id)
      || !text(event.current_turn_id)
      || !allowedStages.includes(event.from_stage)
      || !allowedStages.includes(event.to_stage)
      || !stageTransitionAllowed(event.from_stage, event.to_stage)
      || !Array.isArray(event.evidence)) {
    fail(
      `Invalid MemoryConsolidationEvent ${eventId}.`,
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_EVENT_INVALID",
    );
  }
  if (hashAgentRunValue(eventHashBody(event)) !== event.consolidation_event_hash) {
    fail(
      `MemoryConsolidationEvent ${eventId} failed immutable hash verification.`,
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_EVENT_HASH_MISMATCH",
    );
  }
}
function historyRef(event) {
  return {
    schema_version: memoryConsolidationHistoryReferenceSchemaVersion,
    consolidation_event_id: event.consolidation_event_id,
    consolidation_event_hash: event.consolidation_event_hash,
    character: event.character,
    memory_id: event.memory_id,
    from_stage: event.from_stage,
    to_stage: event.to_stage,
    current_turn_id: event.current_turn_id,
    role: "adaptive_consolidation_stage_transition",
    derived_index: true,
  };
}
function validateExistingConsolidation(worldState, entries) {
  const events = object(worldState.memory_consolidation_events);
  if (Object.hasOwn(worldState, "memory_consolidation_events")
      && !isObject(worldState.memory_consolidation_events)) {
    fail(
      "memory_consolidation_events must be an object when present.",
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_EVENT_STORE_INVALID",
    );
  }
  if (Object.hasOwn(worldState, "memory_consolidation_history")
      && !Array.isArray(worldState.memory_consolidation_history)) {
    fail(
      "memory_consolidation_history must be an array when present.",
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_HISTORY_INVALID",
    );
  }
  const memoryByKey = new Map(entries.map(({ character, memory }) => [
    memoryKey(character, memory.memory_id),
    { character, memory },
  ]));
  const effective = new Map();
  for (const { character, memory } of entries) {
    const origin = text(memory.formation_stage) ?? "encoded_unconsolidated";
    if (!allowedStages.includes(origin)) {
      fail(
        `Memory ${memory.memory_id} has unsupported formation_stage ${origin}.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_STAGE_INVALID",
      );
    }
    effective.set(memoryKey(character, memory.memory_id), origin);
  }
  const referenced = new Set();
  for (const [index, ref] of array(worldState.memory_consolidation_history).entries()) {
    if (!isObject(ref)
        || ref.schema_version !== memoryConsolidationHistoryReferenceSchemaVersion
        || ref.role !== "adaptive_consolidation_stage_transition"
        || ref.derived_index !== true
        || !text(ref.consolidation_event_id)
        || !text(ref.consolidation_event_hash)
        || !text(ref.character)
        || !text(ref.memory_id)) {
      fail(
        `memory_consolidation_history[${index}] is invalid.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_HISTORY_REFERENCE_INVALID",
      );
    }
    if (referenced.has(ref.consolidation_event_id)) {
      fail(
        `Duplicate consolidation history reference ${ref.consolidation_event_id}.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_HISTORY_DUPLICATE_REFERENCE",
      );
    }
    referenced.add(ref.consolidation_event_id);
    const event = events[ref.consolidation_event_id];
    assertConsolidationEvent(event, ref.consolidation_event_id);
    if (event.consolidation_event_hash !== ref.consolidation_event_hash
        || !sameCharacter(event.character, ref.character)
        || event.memory_id !== ref.memory_id
        || event.from_stage !== ref.from_stage
        || event.to_stage !== ref.to_stage
        || event.current_turn_id !== ref.current_turn_id) {
      fail(
        `Consolidation history reference ${ref.consolidation_event_id} does not match its event.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_HISTORY_REFERENCE_MISMATCH",
      );
    }
    const key = memoryKey(ref.character, ref.memory_id);
    if (!memoryByKey.has(key)) {
      fail(
        `Consolidation event ${ref.consolidation_event_id} references a missing memory.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_MEMORY_UNRESOLVED",
      );
    }
    const current = effective.get(key);
    if (current !== event.from_stage || !stageTransitionAllowed(current, event.to_stage)) {
      fail(
        `Consolidation lifecycle is non-monotonic for ${ref.memory_id}.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_LIFECYCLE_INVALID",
      );
    }
    effective.set(key, event.to_stage);
  }
  for (const [eventId, event] of Object.entries(events)) {
    assertConsolidationEvent(event, eventId);
    if (!referenced.has(eventId)) {
      fail(
        `MemoryConsolidationEvent ${eventId} is missing its canonical history reference.`,
        "WORLD_SIMULATION_MEMORY_CONSOLIDATION_EVENT_ORPHANED",
      );
    }
  }
  return { events, effective };
}
function assertPlasticityReference(worldState, ref) {
  if (!isObject(ref)
      || ref.schema_version !== memoryPlasticityHistoryReferenceSchemaVersion
      || ref.role !== "retrieval_practice_registered"
      || ref.derived_index !== true
      || !text(ref.plasticity_event_id)
      || !text(ref.plasticity_event_hash)
      || !text(ref.plasticity_effect_id)
      || !text(ref.character)
      || !text(ref.source_memory_ref)) {
    fail(
      "Malformed retrieval-practice evidence for consolidation.",
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_PLASTICITY_REFERENCE_INVALID",
    );
  }
  const event = object(object(worldState.memory_plasticity_events)[ref.plasticity_event_id]);
  if (event.schema_version !== memoryPlasticityEventSchemaVersion
      || event.immutable !== true
      || event.plasticity_event_id !== ref.plasticity_event_id
      || event.plasticity_event_hash !== ref.plasticity_event_hash) {
    fail(
      "Retrieval-practice consolidation evidence cannot resolve its canonical event.",
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_PLASTICITY_EVENT_INVALID",
    );
  }
  verifyHash(
    event,
    "plasticity_event_hash",
    "WORLD_SIMULATION_MEMORY_CONSOLIDATION_PLASTICITY_EVENT_HASH_MISMATCH",
  );
  const effect = array(event.effects).find((candidate) =>
    candidate?.plasticity_effect_id === ref.plasticity_effect_id);
  if (!effect
      || !sameCharacter(event.character, ref.character)
      || effect.source_memory_ref !== ref.source_memory_ref) {
    fail(
      "Retrieval-practice consolidation evidence is detached from its canonical effect.",
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_PLASTICITY_EFFECT_MISMATCH",
    );
  }
  return { event, effect };
}
function retrievalPracticeEvidence(worldState, character, memoryId) {
  const output = [];
  for (const ref of array(worldState.memory_plasticity_history)) {
    if (!sameCharacter(ref?.character, character) || ref?.source_memory_ref !== memoryId) continue;
    assertPlasticityReference(worldState, ref);
    output.push({
      kind: "retrieval_practice",
      plasticity_event_id: ref.plasticity_event_id,
      plasticity_event_hash: ref.plasticity_event_hash,
      plasticity_effect_id: ref.plasticity_effect_id,
    });
    if (output.length >= retrievalEvidenceLimit) break;
  }
  return output;
}
function repeatedExperienceEvidence(entries, character, memory) {
  const observationHash = text(memory?.internal_provenance?.observation_hash);
  const sourceTurn = text(memory?.internal_provenance?.turn_id);
  if (!observationHash || !sourceTurn) return [];
  return entries
    .filter((entry) => sameCharacter(entry.character, character)
      && entry.memory.memory_id !== memory.memory_id
      && entry.memory?.internal_provenance?.observation_hash === observationHash
      && text(entry.memory?.internal_provenance?.turn_id)
      && entry.memory.internal_provenance.turn_id !== sourceTurn)
    .sort((left, right) => left.memory.memory_id.localeCompare(right.memory.memory_id))
    .slice(0, repetitionEvidenceLimit)
    .map((entry) => ({
      kind: "exact_repeated_experience",
      matching_memory_id: entry.memory.memory_id,
      matching_turn_id: entry.memory.internal_provenance.turn_id,
      observation_hash: observationHash,
    }));
}
function explicitRelevanceEvidence(memory) {
  return memory.relevance === true
    ? [{ kind: "explicit_memory_relevance", source: "memory.relevance", value: true }]
    : [];
}
function verifyAffectiveRecord(record, turnId) {
  if (!isObject(record) || !isObject(record.context_bundle) || !isObject(record.projection)) {
    fail(
      `Malformed committed affective appraisal record for ${turnId}.`,
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_AFFECTIVE_RECORD_INVALID",
    );
  }
  worldSimulationAffectiveAppraisalResolverViews(record.context_bundle);
  verifyHash(
    record.projection,
    "projection_hash",
    "WORLD_SIMULATION_MEMORY_CONSOLIDATION_AFFECTIVE_PROJECTION_HASH_MISMATCH",
  );
  if (record.context_bundle.turn_id !== turnId
      || record.projection.turn_id !== turnId
      || record.projection.source_bundle_hash !== record.context_bundle.bundle_hash) {
    fail(
      `Committed affective appraisal record for ${turnId} crosses its turn boundary.`,
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_AFFECTIVE_LINEAGE_INVALID",
    );
  }
}
function affectiveSignificanceSupported(appraisal) {
  return ["helps", "hinders", "mixed"].includes(appraisal?.goal_congruence);
}
function affectiveEvidence(worldHistory, character, memory) {
  const sourceRef = text(memory?.internal_provenance?.post_outcome_subjective_perception_ref);
  const sourceTurn = text(memory?.internal_provenance?.turn_id);
  if (!sourceRef || !sourceTurn || !Array.isArray(worldHistory?.turns)) return [];
  const turn = worldHistory.turns.find((candidate) => candidate?.turn_id === sourceTurn);
  if (!turn?.affective_appraisal_record) return [];
  verifyAffectiveRecord(turn.affective_appraisal_record, sourceTurn);
  return array(turn.affective_appraisal_record.projection.appraisals)
    .filter((appraisal) => sameCharacter(appraisal?.character, character)
      && appraisal?.source_perception_ref === sourceRef
      && affectiveSignificanceSupported(appraisal))
    .slice(0, affectiveEvidenceLimit)
    .map((appraisal) => ({
      kind: "bounded_affective_significance",
      source_turn_id: sourceTurn,
      source_perception_ref: sourceRef,
      appraisal_hash: appraisal.appraisal_hash,
      goal: appraisal.goal ?? null,
      goal_congruence: appraisal.goal_congruence ?? null,
      expectedness: appraisal.expectedness ?? null,
      coping_potential: appraisal.coping_potential ?? null,
      significance_basis: "goal_congruence",
    }));
}
function temporalEvidence(memory, currentTurnId, currentTime) {
  const sourceTurn = text(memory?.internal_provenance?.turn_id);
  if (!sourceTurn || sourceTurn === currentTurnId) return null;
  const encodedMs = timestampMs(memory.encoded_at);
  const currentMs = timestampMs(currentTime);
  if (encodedMs !== null && currentMs !== null && currentMs < encodedMs) {
    fail(
      `Current consolidation time precedes encoding for ${memory.memory_id}.`,
      "WORLD_SIMULATION_MEMORY_CONSOLIDATION_RETROCAUSAL_TIME",
    );
  }
  return {
    kind: "prior_committed_temporal_separation",
    source_turn_id: sourceTurn,
    current_turn_id: currentTurnId,
    encoded_at: memory.encoded_at ?? null,
    observed_at: currentTime ?? null,
    elapsed_duration_threshold_applied: false,
  };
}
function evidenceForMemory({ worldState, worldHistory, entries, character, memory, currentTurnId, currentTime }) {
  const temporal = temporalEvidence(memory, currentTurnId, currentTime);
  if (!temporal) return { temporal: null, non_temporal: [] };
  const nonTemporal = [
    ...retrievalPracticeEvidence(worldState, character, memory.memory_id),
    ...repeatedExperienceEvidence(entries, character, memory),
    ...explicitRelevanceEvidence(memory),
    ...affectiveEvidence(worldHistory, character, memory),
  ];
  return { temporal, non_temporal: nonTemporal };
}

export function buildWorldSimulationAdaptiveMemoryConsolidationContract() {
  return deepFreeze({
    version: worldSimulationAdaptiveMemoryConsolidationVersion,
    phase: "Phase91",
    status: "adaptive_consolidation_lifecycle_installed",
    stages: cloneJson(allowedStages),
    source_memory_content_rewritten: false,
    source_memory_formation_stage_rewritten: false,
    lifecycle_source_of_truth: "append_only_memory_consolidation_history",
    same_turn_new_memory_transition_allowed: false,
    one_stage_transition_per_memory_per_turn: true,
    temporal_separation_is_support_not_fixed_duration_threshold: true,
    time_alone_can_establish_consolidated: false,
    retrieval_practice_can_support_consolidation: true,
    exact_repeated_experience_can_support_consolidation: true,
    explicit_relevance_can_support_consolidation: true,
    bounded_affective_significance_can_support_consolidation: true,
    unrelated_or_uncertain_appraisal_is_consolidation_evidence: false,
    sleep_required: false,
    sleep_is_sole_consolidation_cause: false,
    numeric_consolidation_strength_modeled: false,
    universal_maturity_probability_modeled: false,
    consolidated_means_world_truth: false,
    consolidated_guarantees_recall: false,
    consolidated_prevents_forgetting: false,
    reconsolidation_performed: false,
    character_brain_direct_stage_authority: false,
  });
}

export function projectWorldSimulationEffectiveMemoryConsolidationStates(input = {}) {
  const worldState = object(input.world_state ?? input);
  const entries = memoryEntries(worldState);
  const validated = validateExistingConsolidation(worldState, entries);
  return deepFreeze({
    version: worldSimulationAdaptiveMemoryConsolidationVersion,
    states: entries.map(({ character, memory }) => ({
      character,
      memory_id: memory.memory_id,
      formation_stage: text(memory.formation_stage) ?? "encoded_unconsolidated",
      effective_consolidation_stage:
        validated.effective.get(memoryKey(character, memory.memory_id)),
    })),
    boundaries: {
      derived_from_append_only_history: true,
      memory_content_rewritten: false,
      original_formation_stage_rewritten: false,
      world_truth_authority: false,
    },
  });
}

export function buildWorldSimulationAdaptiveMemoryConsolidation(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const worldHistory = isObject(input.world_history) ? input.world_history : { turns: [] };
  const currentTurnId = text(input.current_turn_id ?? input.turn_id);
  if (!currentTurnId) {
    fail("Phase91 requires current_turn_id.");
  }
  const currentTime = input.current_time ?? null;
  const entries = memoryEntries(worldState);
  const validated = validateExistingConsolidation(worldState, entries);
  const preview = cloneJson(worldState);
  const created = [];
  const appended = [];
  const transitions = [];
  const evidenceViews = [];

  for (const { character, memory } of entries) {
    const key = memoryKey(character, memory.memory_id);
    const effectiveStage = validated.effective.get(key);
    const evidence = evidenceForMemory({
      worldState,
      worldHistory,
      entries,
      character,
      memory,
      currentTurnId,
      currentTime,
    });
    evidenceViews.push({
      character,
      memory_id: memory.memory_id,
      effective_stage_before: effectiveStage,
      temporal_evidence: cloneJson(evidence.temporal),
      non_temporal_evidence: cloneJson(evidence.non_temporal),
    });
    if (!evidence.temporal || effectiveStage === "consolidated") continue;
    let nextStage = null;
    if (effectiveStage === "encoded_unconsolidated") {
      nextStage = "stabilizing";
    } else if (effectiveStage === "stabilizing" && evidence.non_temporal.length > 0) {
      nextStage = "consolidated";
    }
    if (!nextStage) continue;
    const event = buildConsolidationEvent({
      character,
      memory_id: memory.memory_id,
      source_memory_turn_id: memory.internal_provenance?.turn_id ?? null,
      current_turn_id: currentTurnId,
      current_time: currentTime,
      from_stage: effectiveStage,
      to_stage: nextStage,
      evidence: [evidence.temporal, ...evidence.non_temporal],
    });
    const existing = object(worldState.memory_consolidation_events)[event.consolidation_event_id];
    if (existing && Object.keys(existing).length) {
      assertConsolidationEvent(existing, event.consolidation_event_id);
      if (JSON.stringify(existing) !== JSON.stringify(event)) {
        fail(
          `MemoryConsolidationEvent ${event.consolidation_event_id} already exists with different immutable content.`,
          "WORLD_SIMULATION_MEMORY_CONSOLIDATION_EVENT_IMMUTABILITY_VIOLATION",
        );
      }
      continue;
    }
    preview.memory_consolidation_events = object(preview.memory_consolidation_events);
    preview.memory_consolidation_events[event.consolidation_event_id] = cloneJson(event);
    const ref = historyRef(event);
    const priorHistory = Object.hasOwn(preview, "memory_consolidation_history")
      ? cloneJson(preview.memory_consolidation_history)
      : null;
    preview.memory_consolidation_history = [
      ...array(preview.memory_consolidation_history).map(cloneJson),
      cloneJson(ref),
    ];
    created.push(event);
    appended.push(ref);
    transitions.push({
      entity: "world",
      field: `memory_consolidation_events.${event.consolidation_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist Phase91 consolidation transition ${effectiveStage} -> ${nextStage} for ${memory.memory_id}`,
      source_layer: "memory_consolidation_lifecycle",
    });
    transitions.push({
      entity: "world",
      field: "memory_consolidation_history",
      from: priorHistory,
      to: cloneJson(preview.memory_consolidation_history),
      cause: `append Phase91 consolidation history reference ${event.consolidation_event_id}`,
      source_layer: "memory_consolidation_lifecycle",
    });
    validated.effective.set(key, nextStage);
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationAdaptiveMemoryConsolidationVersion,
    result: {
      consolidation_events_created: created,
      history_references_appended: appended,
      evidence_views: evidenceViews,
      effective_states: entries.map(({ character, memory }) => ({
        character,
        memory_id: memory.memory_id,
        effective_consolidation_stage:
          validated.effective.get(memoryKey(character, memory.memory_id)),
      })),
      state_transitions: transitions,
      preview_world_state: preview,
      audit: {
        processed_memory_count: entries.length,
        created_transition_count: created.length,
        encoded_to_stabilizing_count:
          created.filter((event) => event.to_stage === "stabilizing").length,
        stabilizing_to_consolidated_count:
          created.filter((event) => event.to_stage === "consolidated").length,
        same_turn_new_memory_transition_count: 0,
        fixed_time_maturity_threshold_used: false,
        sleep_required: false,
        numeric_consolidation_strength_used: false,
        memory_content_rewritten: false,
        original_formation_stage_rewritten: false,
        reconsolidation_performed: false,
        world_truth_authority: false,
      },
    },
  });
}
