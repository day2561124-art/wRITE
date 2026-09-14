import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationEffectiveMemoryConsolidationStates,
} from "./world-simulation-adaptive-memory-consolidation-service.mjs";
import {
  validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory,
} from "./world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";

export const worldSimulationMemoryReconsolidationLifecycleVersion =
  "phase92-memory-reconsolidation-lifecycle-v1";
export const memoryReconsolidationLifecycleEventSchemaVersion =
  "phase92-memory-reconsolidation-lifecycle-event-v1";
export const memoryReconsolidationLifecycleHistoryReferenceSchemaVersion =
  "phase92-memory-reconsolidation-lifecycle-history-ref-v1";

const lifecycleStates = Object.freeze([
  "consolidated_stable",
  "destabilized_for_update",
  "restabilized_with_update",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
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
function fail(message, code = "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function memoryKey(character, memoryId) {
  return `${String(character).trim().toLocaleLowerCase("zh-Hant-TW")}::${memoryId}`;
}
function memoryEntries(worldState) {
  const output = [];
  for (const [character, memories] of Object.entries(object(worldState.memories))) {
    for (const memory of array(memories)) {
      if (isObject(memory) && text(memory.memory_id)) output.push({ character, memory });
    }
  }
  return output;
}
function cycleIdFor(event) {
  return `memory_reconsolidation_cycle_${hashAgentRunValue({
    version: worldSimulationMemoryReconsolidationLifecycleVersion,
    character: event.character,
    memory_id: event.memory_id,
    interpretation_update_event_id: event.interpretation_update_event_id,
    interpretation_update_event_hash: event.interpretation_update_event_hash,
  }).slice(0, 24)}`;
}
function transitionAllowed(fromState, toState) {
  return (fromState === "consolidated_stable" && toState === "destabilized_for_update")
    || (fromState === "destabilized_for_update" && toState === "restabilized_with_update");
}
function eventBody(input) {
  return {
    schema_version: memoryReconsolidationLifecycleEventSchemaVersion,
    version: worldSimulationMemoryReconsolidationLifecycleVersion,
    reconsolidation_cycle_id: input.reconsolidation_cycle_id,
    character: input.character,
    memory_id: input.memory_id,
    source_interpretation_update_event_id: input.source_interpretation_update_event_id,
    source_interpretation_update_event_hash: input.source_interpretation_update_event_hash,
    source_interpretation_update_turn_id: input.source_interpretation_update_turn_id,
    source_consolidation_reference: cloneJson(input.source_consolidation_reference ?? null),
    current_turn_id: input.current_turn_id,
    from_state: input.from_state,
    to_state: input.to_state,
    previous_lifecycle_event_id: input.previous_lifecycle_event_id ?? null,
    previous_lifecycle_event_hash: input.previous_lifecycle_event_hash ?? null,
    boundaries: {
      original_memory_trace_preserved: true,
      canonical_memory_content_rewritten: false,
      original_formation_stage_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      world_truth_authority_claimed: false,
      biological_mechanism_claimed: false,
      universal_reconsolidation_window_assumed: false,
      fixed_elapsed_duration_threshold_used: false,
      retrieval_alone_used_as_update_trigger: false,
      same_turn_destabilize_and_restabilize_allowed: false,
      future_retrieval_effect_available: input.to_state === "restabilized_with_update",
    },
    immutable: true,
  };
}
function buildLifecycleEvent(input) {
  const body = eventBody(input);
  const lifecycleEventHash = hashAgentRunValue(body);
  return {
    ...body,
    lifecycle_event_id: `memory_reconsolidation_lifecycle_${hashAgentRunValue({
      version: worldSimulationMemoryReconsolidationLifecycleVersion,
      reconsolidation_cycle_id: input.reconsolidation_cycle_id,
      current_turn_id: input.current_turn_id,
      from_state: input.from_state,
      to_state: input.to_state,
      previous_lifecycle_event_hash: input.previous_lifecycle_event_hash ?? null,
    }).slice(0, 24)}`,
    lifecycle_event_hash: lifecycleEventHash,
  };
}
function assertLifecycleEvent(event, eventId) {
  if (!isObject(event)
      || event.schema_version !== memoryReconsolidationLifecycleEventSchemaVersion
      || event.version !== worldSimulationMemoryReconsolidationLifecycleVersion
      || event.lifecycle_event_id !== eventId
      || !text(event.lifecycle_event_hash)
      || !text(event.reconsolidation_cycle_id)
      || !text(event.character)
      || !text(event.memory_id)
      || !text(event.source_interpretation_update_event_id)
      || !text(event.source_interpretation_update_event_hash)
      || !text(event.source_interpretation_update_turn_id)
      || !text(event.current_turn_id)
      || !lifecycleStates.includes(event.from_state)
      || !lifecycleStates.includes(event.to_state)
      || !transitionAllowed(event.from_state, event.to_state)
      || event.immutable !== true
      || !isObject(event.boundaries)
      || event.boundaries.original_memory_trace_preserved !== true
      || event.boundaries.canonical_memory_content_rewritten !== false
      || event.boundaries.original_formation_stage_rewritten !== false
      || event.boundaries.storage_strength_mutated !== false
      || event.boundaries.retrieval_strength_mutated !== false
      || event.boundaries.world_truth_authority_claimed !== false
      || event.boundaries.biological_mechanism_claimed !== false
      || event.boundaries.universal_reconsolidation_window_assumed !== false
      || event.boundaries.fixed_elapsed_duration_threshold_used !== false
      || event.boundaries.retrieval_alone_used_as_update_trigger !== false
      || event.boundaries.same_turn_destabilize_and_restabilize_allowed !== false
      || event.boundaries.future_retrieval_effect_available
        !== (event.to_state === "restabilized_with_update")) {
    fail(
      `Invalid Phase92 lifecycle event ${eventId}.`,
      "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_EVENT_INVALID",
    );
  }
  const body = cloneJson(event);
  delete body.lifecycle_event_id;
  delete body.lifecycle_event_hash;
  if (hashAgentRunValue(body) !== event.lifecycle_event_hash) {
    fail(
      `Phase92 lifecycle event ${eventId} failed immutable hash verification.`,
      "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_EVENT_HASH_MISMATCH",
    );
  }
  return event;
}
function historyReferenceFor(event) {
  return {
    schema_version: memoryReconsolidationLifecycleHistoryReferenceSchemaVersion,
    lifecycle_event_id: event.lifecycle_event_id,
    lifecycle_event_hash: event.lifecycle_event_hash,
    reconsolidation_cycle_id: event.reconsolidation_cycle_id,
    character: event.character,
    memory_id: event.memory_id,
    source_interpretation_update_event_id: event.source_interpretation_update_event_id,
    current_turn_id: event.current_turn_id,
    from_state: event.from_state,
    to_state: event.to_state,
    role: "memory_reconsolidation_lifecycle_transition",
    derived_index: true,
  };
}
function consolidationReferenceFor(worldState, character, memoryId) {
  const matches = array(worldState.memory_consolidation_history)
    .filter((ref) => sameCharacter(ref?.character, character)
      && ref?.memory_id === memoryId
      && ref?.to_stage === "consolidated");
  return matches.length ? cloneJson(matches.at(-1)) : null;
}
function phase85EventMap(worldState) {
  const validated = validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory(worldState);
  return {
    ...validated,
    orderedEvents: validated.history.map((ref) =>
      validated.events[ref.interpretation_update_event_id]),
  };
}
function effectiveConsolidationMap(worldState) {
  const projection = projectWorldSimulationEffectiveMemoryConsolidationStates({ world_state: worldState });
  return new Map(projection.states.map((state) => [
    memoryKey(state.character, state.memory_id),
    state.effective_consolidation_stage,
  ]));
}
function validateLifecycle(worldState) {
  if (Object.hasOwn(worldState, "memory_reconsolidation_lifecycle_events")
      && !isObject(worldState.memory_reconsolidation_lifecycle_events)) {
    fail(
      "memory_reconsolidation_lifecycle_events must be an object when present.",
      "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_EVENT_STORE_INVALID",
    );
  }
  if (Object.hasOwn(worldState, "memory_reconsolidation_lifecycle_history")
      && !Array.isArray(worldState.memory_reconsolidation_lifecycle_history)) {
    fail(
      "memory_reconsolidation_lifecycle_history must be an array when present.",
      "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_HISTORY_INVALID",
    );
  }
  const events = object(worldState.memory_reconsolidation_lifecycle_events);
  const history = array(worldState.memory_reconsolidation_lifecycle_history);
  const phase85 = phase85EventMap(worldState);
  const consolidation = effectiveConsolidationMap(worldState);
  const memories = new Map(memoryEntries(worldState).map(({ character, memory }) => [
    memoryKey(character, memory.memory_id),
    memory,
  ]));
  const referenced = new Set();
  const latestByMemory = new Map();
  const cycles = new Map();
  const trackedInterpretationEventIds = new Set();

  for (const [index, ref] of history.entries()) {
    if (!isObject(ref)
        || ref.schema_version !== memoryReconsolidationLifecycleHistoryReferenceSchemaVersion
        || ref.role !== "memory_reconsolidation_lifecycle_transition"
        || ref.derived_index !== true
        || !text(ref.lifecycle_event_id)
        || !text(ref.lifecycle_event_hash)
        || !text(ref.reconsolidation_cycle_id)
        || !text(ref.character)
        || !text(ref.memory_id)
        || !text(ref.source_interpretation_update_event_id)
        || !text(ref.current_turn_id)
        || referenced.has(ref.lifecycle_event_id)) {
      fail(
        `memory_reconsolidation_lifecycle_history[${index}] is invalid.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_HISTORY_REFERENCE_INVALID",
      );
    }
    const event = assertLifecycleEvent(events[ref.lifecycle_event_id], ref.lifecycle_event_id);
    if (event.lifecycle_event_hash !== ref.lifecycle_event_hash
        || event.reconsolidation_cycle_id !== ref.reconsolidation_cycle_id
        || !sameCharacter(event.character, ref.character)
        || event.memory_id !== ref.memory_id
        || event.source_interpretation_update_event_id !== ref.source_interpretation_update_event_id
        || event.current_turn_id !== ref.current_turn_id
        || event.from_state !== ref.from_state
        || event.to_state !== ref.to_state) {
      fail(
        `Phase92 lifecycle history reference ${ref.lifecycle_event_id} does not match its event.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_HISTORY_REFERENCE_MISMATCH",
      );
    }
    const source = phase85.events[event.source_interpretation_update_event_id];
    if (!source
        || source.interpretation_update_event_hash !== event.source_interpretation_update_event_hash
        || !sameCharacter(source.character, event.character)
        || source.memory_id !== event.memory_id
        || source.source_turn_id !== event.source_interpretation_update_turn_id) {
      fail(
        `Phase92 lifecycle event ${event.lifecycle_event_id} is detached from canonical Phase85C evidence.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_PHASE85C_LINEAGE_INVALID",
      );
    }
    const key = memoryKey(event.character, event.memory_id);
    if (!memories.has(key) || consolidation.get(key) !== "consolidated") {
      fail(
        `Phase92 lifecycle event ${event.lifecycle_event_id} requires an effectively consolidated source memory.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_CONSOLIDATION_REQUIRED",
      );
    }
    const canonicalConsolidationReference = consolidationReferenceFor(
      worldState,
      event.character,
      event.memory_id,
    );
    if (!canonicalConsolidationReference
        || JSON.stringify(event.source_consolidation_reference)
          !== JSON.stringify(canonicalConsolidationReference)) {
      fail(
        `Phase92 lifecycle event ${event.lifecycle_event_id} is detached from canonical Phase91 consolidation evidence.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_PHASE91_LINEAGE_INVALID",
      );
    }
    const previous = latestByMemory.get(key) ?? null;
    if (event.previous_lifecycle_event_id !== (previous?.lifecycle_event_id ?? null)
        || event.previous_lifecycle_event_hash !== (previous?.lifecycle_event_hash ?? null)) {
      fail(
        `Phase92 lifecycle event ${event.lifecycle_event_id} breaks per-memory event lineage.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_CHAIN_INVALID",
      );
    }
    const expectedCycleId = cycleIdFor(source);
    if (event.reconsolidation_cycle_id !== expectedCycleId) {
      fail(
        `Phase92 lifecycle event ${event.lifecycle_event_id} has a non-canonical cycle identity.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_CYCLE_ID_MISMATCH",
      );
    }
    const priorCycle = cycles.get(event.reconsolidation_cycle_id) ?? null;
    if (!priorCycle) {
      if (event.from_state !== "consolidated_stable"
          || event.to_state !== "destabilized_for_update") {
        fail(
          `Phase92 cycle ${event.reconsolidation_cycle_id} must begin with destabilization.`,
          "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_SEQUENCE_INVALID",
        );
      }
      cycles.set(event.reconsolidation_cycle_id, {
        source_interpretation_update_event_id: event.source_interpretation_update_event_id,
        character: event.character,
        memory_id: event.memory_id,
        state: "destabilized_for_update",
        destabilized_event: event,
        restabilized_event: null,
      });
    } else {
      if (priorCycle.state !== "destabilized_for_update"
          || event.from_state !== "destabilized_for_update"
          || event.to_state !== "restabilized_with_update"
          || event.current_turn_id === priorCycle.destabilized_event.current_turn_id
          || priorCycle.restabilized_event) {
        fail(
          `Phase92 cycle ${event.reconsolidation_cycle_id} has an invalid restabilization transition.`,
          "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_SEQUENCE_INVALID",
        );
      }
      priorCycle.state = "restabilized_with_update";
      priorCycle.restabilized_event = event;
    }
    referenced.add(event.lifecycle_event_id);
    trackedInterpretationEventIds.add(event.source_interpretation_update_event_id);
    latestByMemory.set(key, event);
  }

  for (const [eventId, event] of Object.entries(events)) {
    assertLifecycleEvent(event, eventId);
    if (!referenced.has(eventId)) {
      fail(
        `Phase92 lifecycle event ${eventId} is orphaned from canonical history.`,
        "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_EVENT_ORPHANED",
      );
    }
  }
  return {
    events,
    history,
    phase85,
    consolidation,
    memories,
    latestByMemory,
    cycles,
    trackedInterpretationEventIds,
  };
}

export function buildWorldSimulationMemoryReconsolidationLifecycleContract() {
  return deepFreeze({
    version: worldSimulationMemoryReconsolidationLifecycleVersion,
    phase: "Phase92",
    status: "memory_reconsolidation_lifecycle_closure_installed",
    lifecycle_states: cloneJson(lifecycleStates),
    effective_phase91_consolidated_memory_required: true,
    canonical_phase85c_update_evidence_required: true,
    retrieval_alone_can_destabilize: false,
    phase85_prediction_error_proxy_reused: true,
    append_only_lifecycle_history_required: true,
    original_memory_trace_preserved: true,
    canonical_memory_content_rewrite_allowed: false,
    original_formation_stage_rewrite_allowed: false,
    storage_strength_mutation_allowed: false,
    retrieval_strength_mutation_allowed: false,
    same_turn_destabilize_and_restabilize_allowed: false,
    one_lifecycle_transition_per_memory_per_turn: true,
    fixed_elapsed_duration_threshold_modeled: false,
    universal_reconsolidation_window_modeled: false,
    biological_mechanism_claimed: false,
    computational_reconsolidation_lifecycle_closed: true,
    tracked_update_requires_restabilization_before_future_retrieval_effect: true,
    untracked_legacy_phase85c_update_preserved_for_backward_compatibility: true,
    world_truth_authority_claimed: false,
  });
}

export function projectWorldSimulationEffectiveMemoryReconsolidationStates(input = {}) {
  const worldState = object(input.world_state ?? input);
  const validated = validateLifecycle(worldState);
  const stateByInterpretation = new Map();
  for (const cycle of validated.cycles.values()) {
    stateByInterpretation.set(cycle.source_interpretation_update_event_id, cycle.state);
  }
  return deepFreeze({
    version: worldSimulationMemoryReconsolidationLifecycleVersion,
    lifecycle_present: Object.hasOwn(worldState, "memory_reconsolidation_lifecycle_events")
      || Object.hasOwn(worldState, "memory_reconsolidation_lifecycle_history"),
    interpretation_update_states: validated.phase85.orderedEvents.map((event) => {
      const state = stateByInterpretation.get(event.interpretation_update_event_id) ?? "not_started";
      return {
        interpretation_update_event_id: event.interpretation_update_event_id,
        interpretation_update_event_hash: event.interpretation_update_event_hash,
        character: event.character,
        memory_id: event.memory_id,
        lifecycle_state: state,
        tracked_by_phase92: state !== "not_started",
        future_retrieval_effect_available:
          state === "not_started" || state === "restabilized_with_update",
      };
    }),
    boundaries: {
      original_memory_trace_preserved: true,
      canonical_memory_content_rewritten: false,
      world_truth_authority_claimed: false,
      biological_mechanism_claimed: false,
    },
  });
}

export function buildWorldSimulationMemoryReconsolidationLifecycle(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const currentTurnId = text(input.current_turn_id ?? input.turn_id);
  if (!currentTurnId) fail("Phase92 requires current_turn_id.");
  const validated = validateLifecycle(worldState);
  const preview = cloneJson(worldState);
  const createdEvents = [];
  const appendedReferences = [];
  const transitions = [];
  const touchedMemoryKeys = new Set();
  const latestByMemory = new Map(validated.latestByMemory);
  const cycles = new Map(validated.cycles);
  const tracked = new Set(validated.trackedInterpretationEventIds);

  function appendLifecycleEvent(event) {
    const collision = object(object(preview.memory_reconsolidation_lifecycle_events)[event.lifecycle_event_id]);
    if (Object.keys(collision).length) {
      assertLifecycleEvent(collision, event.lifecycle_event_id);
      if (JSON.stringify(collision) !== JSON.stringify(event)) {
        fail(
          `Phase92 lifecycle event ${event.lifecycle_event_id} already exists with different immutable content.`,
          "WORLD_SIMULATION_MEMORY_RECONSOLIDATION_LIFECYCLE_EVENT_IMMUTABILITY_VIOLATION",
        );
      }
      return false;
    }
    preview.memory_reconsolidation_lifecycle_events =
      object(preview.memory_reconsolidation_lifecycle_events);
    preview.memory_reconsolidation_lifecycle_events[event.lifecycle_event_id] = cloneJson(event);
    const ref = historyReferenceFor(event);
    const previousHistory = Object.hasOwn(preview, "memory_reconsolidation_lifecycle_history")
      ? cloneJson(preview.memory_reconsolidation_lifecycle_history)
      : null;
    preview.memory_reconsolidation_lifecycle_history = [
      ...array(preview.memory_reconsolidation_lifecycle_history).map(cloneJson),
      cloneJson(ref),
    ];
    createdEvents.push(event);
    appendedReferences.push(ref);
    transitions.push({
      entity: "world",
      field: `memory_reconsolidation_lifecycle_events.${event.lifecycle_event_id}`,
      from: null,
      to: cloneJson(event),
      cause: `persist Phase92 reconsolidation lifecycle transition ${event.from_state} -> ${event.to_state}`,
      source_layer: "memory_reconsolidation_lifecycle",
    });
    transitions.push({
      entity: "world",
      field: "memory_reconsolidation_lifecycle_history",
      from: previousHistory,
      to: cloneJson(preview.memory_reconsolidation_lifecycle_history),
      cause: `append Phase92 lifecycle history reference ${event.lifecycle_event_id}`,
      source_layer: "memory_reconsolidation_lifecycle",
    });
    return true;
  }

  // Close prior-turn labile cycles first. A cycle can never destabilize and
  // restabilize in the same committed turn.
  for (const cycle of cycles.values()) {
    if (cycle.state !== "destabilized_for_update") continue;
    const key = memoryKey(cycle.character, cycle.memory_id);
    if (touchedMemoryKeys.has(key)
        || cycle.destabilized_event.current_turn_id === currentTurnId) continue;
    const previous = latestByMemory.get(key) ?? null;
    const source = validated.phase85.events[cycle.source_interpretation_update_event_id];
    const event = buildLifecycleEvent({
      reconsolidation_cycle_id: cycleIdFor(source),
      character: cycle.character,
      memory_id: cycle.memory_id,
      source_interpretation_update_event_id: source.interpretation_update_event_id,
      source_interpretation_update_event_hash: source.interpretation_update_event_hash,
      source_interpretation_update_turn_id: source.source_turn_id,
      source_consolidation_reference:
        consolidationReferenceFor(worldState, cycle.character, cycle.memory_id),
      current_turn_id: currentTurnId,
      from_state: "destabilized_for_update",
      to_state: "restabilized_with_update",
      previous_lifecycle_event_id: previous?.lifecycle_event_id ?? null,
      previous_lifecycle_event_hash: previous?.lifecycle_event_hash ?? null,
    });
    if (appendLifecycleEvent(event)) {
      cycle.state = "restabilized_with_update";
      cycle.restabilized_event = event;
      latestByMemory.set(key, event);
      touchedMemoryKeys.add(key);
    }
  }

  // Start at most one new cycle per memory in this turn. Phase85C already
  // carries the retrieval + later explicit conflict/update lineage; Phase92
  // never treats retrieval by itself as sufficient.
  for (const source of validated.phase85.orderedEvents) {
    if (tracked.has(source.interpretation_update_event_id)) continue;
    const key = memoryKey(source.character, source.memory_id);
    if (touchedMemoryKeys.has(key)
        || validated.consolidation.get(key) !== "consolidated") continue;
    const previous = latestByMemory.get(key) ?? null;
    const cycleId = cycleIdFor(source);
    const event = buildLifecycleEvent({
      reconsolidation_cycle_id: cycleId,
      character: source.character,
      memory_id: source.memory_id,
      source_interpretation_update_event_id: source.interpretation_update_event_id,
      source_interpretation_update_event_hash: source.interpretation_update_event_hash,
      source_interpretation_update_turn_id: source.source_turn_id,
      source_consolidation_reference:
        consolidationReferenceFor(worldState, source.character, source.memory_id),
      current_turn_id: currentTurnId,
      from_state: "consolidated_stable",
      to_state: "destabilized_for_update",
      previous_lifecycle_event_id: previous?.lifecycle_event_id ?? null,
      previous_lifecycle_event_hash: previous?.lifecycle_event_hash ?? null,
    });
    if (appendLifecycleEvent(event)) {
      cycles.set(cycleId, {
        source_interpretation_update_event_id: source.interpretation_update_event_id,
        character: source.character,
        memory_id: source.memory_id,
        state: "destabilized_for_update",
        destabilized_event: event,
        restabilized_event: null,
      });
      tracked.add(source.interpretation_update_event_id);
      latestByMemory.set(key, event);
      touchedMemoryKeys.add(key);
    }
  }

  return deepFreeze({
    ok: true,
    version: worldSimulationMemoryReconsolidationLifecycleVersion,
    result: {
      lifecycle_events_created: createdEvents,
      history_references_appended: appendedReferences,
      state_transitions: transitions,
      preview_world_state: preview,
      effective_states: [...cycles.values()].map((cycle) => ({
        character: cycle.character,
        memory_id: cycle.memory_id,
        source_interpretation_update_event_id: cycle.source_interpretation_update_event_id,
        lifecycle_state: cycle.state,
        future_retrieval_effect_available: cycle.state === "restabilized_with_update",
      })),
      audit: {
        processed_phase85c_interpretation_update_count: validated.phase85.orderedEvents.length,
        created_transition_count: createdEvents.length,
        destabilized_transition_count:
          createdEvents.filter((event) => event.to_state === "destabilized_for_update").length,
        restabilized_transition_count:
          createdEvents.filter((event) => event.to_state === "restabilized_with_update").length,
        same_turn_destabilize_and_restabilize_count: 0,
        one_lifecycle_transition_per_memory_per_turn: true,
        effective_phase91_consolidation_required: true,
        canonical_phase85c_update_evidence_required: true,
        retrieval_alone_used_as_update_trigger: false,
        fixed_elapsed_duration_threshold_used: false,
        universal_reconsolidation_window_assumed: false,
        biological_mechanism_claimed: false,
        original_memory_trace_preserved: true,
        canonical_memory_content_rewritten: false,
        original_formation_stage_rewritten: false,
        storage_strength_mutated: false,
        retrieval_strength_mutated: false,
        world_truth_authority_claimed: false,
      },
    },
  });
}
