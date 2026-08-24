import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  adjudicateWorldSimulationCausality,
  buildWorldSimulationCausalRuleContract,
} from "./world-simulation-causal-rule-engine.mjs";
import {
  runWorldSimulationCapability,
} from "./world-simulation-neural-service.mjs";
import {
  buildWorldSimulationVisibilityQueryContract,
  queryWorldSimulationObserverVisibility,
  worldSimulationVisibilityQueryVersion,
} from "./world-simulation-visibility-query-service.mjs";
import {
  buildWorldSimulationDirectionalHeightVisibilityContract,
  queryWorldSimulationObserverDirectionalHeightVisibility,
  worldSimulationDirectionalHeightVisibilityVersion,
} from "./world-simulation-directional-height-visibility-service.mjs";
import {
  buildWorldSimulationIlluminationVisibilityContract,
  queryWorldSimulationObserverIlluminationVisibility,
  worldSimulationIlluminationVisibilityVersion,
} from "./world-simulation-illumination-visibility-service.mjs";
import {
  assertWorldSimulationSession,
} from "./world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationLoopVersion = "phase62c-event-loop-v1";

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

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = character.toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) {
      return value;
    }
  }
  return undefined;
}

function currentEvent(worldState, requestedEventId = null) {
  const queue = array(worldState.event_queue);
  if (!queue.length) {
    const error = new Error("World simulation event_queue is empty.");
    error.code = "WORLD_SIMULATION_EVENT_QUEUE_EMPTY";
    throw error;
  }
  const event = object(queue[0]);
  const eventId = nonEmptyString(event.event_id ?? event.id, "event_queue[0].event_id");
  if (requestedEventId !== null && requestedEventId !== undefined) {
    const requested = nonEmptyString(requestedEventId, "event_id");
    if (requested !== eventId) {
      const error = new Error(
        `Event-driven simulation must resolve the queue head first: expected ${eventId}, received ${requested}.`,
      );
      error.code = "WORLD_SIMULATION_EVENT_ORDER_VIOLATION";
      throw error;
    }
  }
  return { ...cloneJson(event), event_id: eventId };
}

function currentScene(worldState, event) {
  const sceneId = event.scene_id ?? event.location_id ?? null;
  const scenes = object(worldState.scenes);
  if (sceneId && isObject(scenes[sceneId])) return cloneJson(scenes[sceneId]);
  if (isObject(worldState.scene_state)) return cloneJson(worldState.scene_state);
  if (isObject(worldState.current_scene)) return cloneJson(worldState.current_scene);
  throw new Error("World simulation state has no scene for the current event.");
}

function participantsForEvent(worldState, event) {
  const requested = array(event.participants ?? event.character_names)
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  const active = requested.length
    ? requested
    : array(worldState.active_characters)
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean);
  if (!active.length) {
    throw new Error("Current world event has no named-character participants.");
  }
  return [...new Set(active)];
}

function runOptions(options, sessionId, source) {
  return {
    ...(options.fixtureRoot ? { fixtureRoot: options.fixtureRoot } : {}),
    run_id: sessionId,
    source,
  };
}

async function capability(sessionId, name, input, options, traceIds) {
  const result = await runWorldSimulationCapability(
    name,
    input,
    runOptions(options, sessionId, `world_simulation_loop:${name}`),
  );
  traceIds.push(result.trace.trace_id);
  return result.output;
}

function candidateSelection(candidateOutput, selection, character) {
  const candidates = array(candidateOutput.candidate_action_intents);
  if (selection === null || selection === undefined || selection === "reject_all") {
    return {
      character,
      selection: "reject_all",
      action_id: null,
      intent: null,
      candidate: null,
    };
  }
  const actionId = typeof selection === "string"
    ? selection.trim()
    : String(selection?.action_id ?? selection?.id ?? "").trim();
  if (!actionId) {
    throw new Error(`Character brain selection for ${character} must provide action_id or reject_all.`);
  }
  const candidate = candidates.find((item) => String(item.action_id) === actionId);
  if (!candidate) {
    const error = new Error(
      `Character brain selected unavailable action ${actionId} for ${character}.`,
    );
    error.code = "WORLD_SIMULATION_ACTION_NOT_AVAILABLE";
    throw error;
  }
  return {
    character,
    selection: "candidate_action_intent",
    action_id: actionId,
    intent: candidate.intent ?? null,
    candidate: cloneJson(candidate),
  };
}

function assertCausalResolution(value) {
  if (!isObject(value)) {
    throw new Error("causalAdjudicator must return an object.");
  }
  if (!isObject(value.next_world_state)) {
    throw new Error("causalAdjudicator must return next_world_state.");
  }
  return value;
}

export function buildWorldSimulationLoopContract() {
  return {
    version: worldSimulationLoopVersion,
    scheduling: "event_driven",
    world_state_owner: "programmatic_world_simulator",
    character_choice_owner: "chatgpt_character_brain",
    causal_outcome_owner: "programmatic_causal_adjudicator",
    commit_policy: "consistency_critic_must_report_zero_hard_conflicts",
    character_brain_receives_world_truth: false,
    neural_capabilities_may_mutate_world_state: false,
    causal_adjudicator_required: true,
    visibility_and_occlusion: buildWorldSimulationVisibilityQueryContract(),
    directional_height_visibility: buildWorldSimulationDirectionalHeightVisibilityContract(),
    illumination_visibility: buildWorldSimulationIlluminationVisibilityContract(),
    character_perception_visuals_use_programmatic_visibility: true,
    character_perception_visuals_use_directional_height_visibility: true,
    character_perception_visuals_use_illumination_visibility: true,
    built_in_causal_rule_engine: buildWorldSimulationCausalRuleContract(),
    custom_causal_adjudicator_override_supported: true,
    stale_state_commit_rejected: true,
    replay_chain_uses_state_hashes: true,
  };
}

export async function prepareWorldSimulationTurn(input = {}, options = {}) {
  const sessionId = nonEmptyString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  const worldState = snapshot.state;
  const event = currentEvent(worldState, input.event_id ?? null);
  const sceneState = currentScene(worldState, event);
  const participants = participantsForEvent(worldState, event);
  const traceIds = [];
  const visibilityQueries = [];
  const directionalHeightVisibilityQueries = [];
  const illuminationVisibilityQueries = [];

  const sceneAnalysis = await capability(
    sessionId,
    "world_scene_causal_analyzer",
    {
      scene_state: sceneState,
      simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
      simultaneous_actions: [],
    },
    options,
    traceIds,
  );

  const decisionPackets = [];
  for (const character of participants) {
    const characterState = object(characterMapValue(worldState.characters, character));
    const memories = array(characterMapValue(worldState.memories, character));
    const availableActions = array(
      characterMapValue(worldState.available_actions, character),
    );
    const visibilityQuery = queryWorldSimulationObserverVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    visibilityQueries.push({
      observer: character,
      version: visibilityQuery.visibility_query_version,
      result: cloneJson(visibilityQuery.result),
      audit: cloneJson(visibilityQuery.audit),
    });
    const directionalHeightVisibilityQuery = queryWorldSimulationObserverDirectionalHeightVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    directionalHeightVisibilityQueries.push({
      observer: character,
      version: directionalHeightVisibilityQuery.directional_height_visibility_version,
      result: cloneJson(directionalHeightVisibilityQuery.result),
      audit: cloneJson(directionalHeightVisibilityQuery.audit),
    });
    const illuminationVisibilityQuery = queryWorldSimulationObserverIlluminationVisibility({
      world_state: worldState,
      scene_state: sceneState,
      scene_id: sceneState.scene_id ?? event.scene_id ?? event.location_id ?? null,
      observer: character,
    });
    illuminationVisibilityQueries.push({
      observer: character,
      version: illuminationVisibilityQuery.illumination_visibility_version,
      result: cloneJson(illuminationVisibilityQuery.result),
      audit: cloneJson(illuminationVisibilityQuery.audit),
    });
    const perception = await capability(
      sessionId,
      "world_perception_filter",
      {
        character,
        scene_state: sceneState,
        simulation_time: worldState.simulation_time ?? event.simulation_time ?? null,
        programmatic_visibility: {
          enforced: true,
          version: illuminationVisibilityQuery.illumination_visibility_version,
          base_visibility_version: visibilityQuery.visibility_query_version,
          directional_height_visibility_version: directionalHeightVisibilityQuery.directional_height_visibility_version,
          directional_height_visibility_enforced: true,
          illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
          visual_observations: cloneJson(
            illuminationVisibilityQuery.result.perception_visual_observations,
          ),
        },
      },
      options,
      traceIds,
    );
    const memoryRetrieval = await capability(
      sessionId,
      "world_memory_retriever",
      {
        character,
        memory_records: memories,
        query: event.memory_query ?? event.summary ?? event.type ?? null,
      },
      options,
      traceIds,
    );
    const cognition = await capability(
      sessionId,
      "world_character_cognition",
      {
        character,
        character_state: characterState,
        perception,
        retrieved_memories: memoryRetrieval.retrieved_memories,
        current_action: characterState.current_action ?? null,
      },
      options,
      traceIds,
    );
    const actionCandidates = await capability(
      sessionId,
      "world_action_proposer",
      {
        character,
        available_actions: availableActions,
        cognition,
        current_action: characterState.current_action ?? null,
      },
      options,
      traceIds,
    );
    decisionPackets.push({
      character,
      perception: cloneJson(perception),
      retrieved_memories: cloneJson(memoryRetrieval.retrieved_memories),
      cognition: cloneJson(cognition),
      candidate_action_intents: cloneJson(actionCandidates.candidate_action_intents),
      boundaries: {
        world_truth_exposed: false,
        may_choose_action_intent_only: true,
        may_decide_outcome: false,
        programmatic_visibility_enforced: true,
        directional_height_visibility_enforced: true,
        illumination_visibility_enforced: illuminationVisibilityQuery.result.lighting_enforced === true,
        engine_visibility_target_ids_exposed: false,
      },
    });
  }

  const turnId = `world_turn_${hashAgentRunValue({
    world_simulation_session_id: sessionId,
    revision: snapshot.revision,
    state_hash: snapshot.state_hash,
    event_id: event.event_id,
  }).slice(0, 20)}`;

  return {
    ok: true,
    loop_version: worldSimulationLoopVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event,
    scene_analysis: cloneJson(sceneAnalysis),
    decision_packets: decisionPackets,
    visibility_queries: visibilityQueries,
    directional_height_visibility_queries: directionalHeightVisibilityQueries,
    illumination_visibility_queries: illuminationVisibilityQueries,
    trace_ids: traceIds,
    causal_boundary: {
      world_state_not_returned_to_character_brain: true,
      character_brain_selects_intent_only: true,
      causal_adjudicator_has_exclusive_outcome_authority: true,
      programmatic_visibility_query_version: worldSimulationVisibilityQueryVersion,
      directional_height_visibility_query_version: worldSimulationDirectionalHeightVisibilityVersion,
      illumination_visibility_query_version: worldSimulationIlluminationVisibilityVersion,
      visibility_engine_target_ids_not_forwarded_to_character_brain: true,
    },
  };
}

export async function resolveWorldSimulationTurn(
  preparedTurn,
  selectedActions,
  options = {},
) {
  if (!isObject(preparedTurn)) throw new Error("preparedTurn must be an object.");
  const sessionId = nonEmptyString(
    preparedTurn.world_simulation_session_id,
    "preparedTurn.world_simulation_session_id",
  );
  await assertWorldSimulationSession(sessionId, options);
  const snapshot = await getWorldSimulationState(sessionId, options);
  if (snapshot.revision !== preparedTurn.state_revision
    || snapshot.state_hash !== preparedTurn.world_state_hash) {
    const stale = new Error("Prepared world turn is stale and cannot be adjudicated.");
    stale.code = "WORLD_SIMULATION_PREPARED_TURN_STALE";
    throw stale;
  }
  const causalAdjudicator = typeof options.causalAdjudicator === "function"
    ? options.causalAdjudicator
    : adjudicateWorldSimulationCausality;

  const selected = [];
  for (const packet of array(preparedTurn.decision_packets)) {
    const character = nonEmptyString(packet.character, "decision packet character");
    selected.push(candidateSelection(
      { candidate_action_intents: packet.candidate_action_intents },
      characterMapValue(selectedActions, character),
      character,
    ));
  }

  const preAdjudicationHash = hashAgentRunValue(snapshot.state);
  const causalResolution = assertCausalResolution(await causalAdjudicator({
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    world_state: cloneJson(snapshot.state),
    world_state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    event: cloneJson(preparedTurn.event),
    scene_analysis: cloneJson(preparedTurn.scene_analysis),
    selected_action_intents: cloneJson(selected),
  }));
  if (hashAgentRunValue(snapshot.state) !== preAdjudicationHash) {
    throw new Error("causalAdjudicator mutated the persisted input snapshot in place.");
  }

  const traceIds = [...array(preparedTurn.trace_ids)];
  const consistency = await capability(
    sessionId,
    "world_consistency_critic",
    {
      state_transitions: array(causalResolution.state_transitions),
      object_holders: array(causalResolution.object_holders),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
    },
    options,
    traceIds,
  );

  if ((consistency.hard_conflict_count ?? 0) > 0) {
    return {
      ok: false,
      committed: false,
      world_simulation_session_id: sessionId,
      turn_id: preparedTurn.turn_id,
      previous_state_hash: snapshot.state_hash,
      next_state_hash: null,
      selected_action_intents: selected,
      consistency,
      trace_ids: traceIds,
      blocked_reason: "world_consistency_critic_reported_hard_conflicts",
      causal_resolution_discarded: true,
    };
  }

  const committed = await commitWorldSimulationTurn(
    sessionId,
    {
      expected_revision: snapshot.revision,
      expected_state_hash: snapshot.state_hash,
      turn_id: preparedTurn.turn_id,
      next_world_state: causalResolution.next_world_state,
      event: preparedTurn.event,
      selected_action_intents: selected,
      state_transitions: array(causalResolution.state_transitions),
      action_outcomes: array(causalResolution.action_outcomes),
      knowledge_transitions: array(causalResolution.knowledge_transitions),
      scheduled_events: array(causalResolution.scheduled_events),
      causal_timeline: cloneJson(causalResolution.causal_timeline ?? null),
      chronological_mutation_queue: cloneJson(causalResolution.chronological_mutation_queue ?? null),
      chronological_mutation_execution: cloneJson(causalResolution.chronological_mutation_execution ?? null),
      mutation_proposal_boundary: cloneJson(causalResolution.mutation_proposal_boundary ?? null),
      pure_proposal_producers: cloneJson(causalResolution.pure_proposal_producers ?? null),
      immutable_causal_evaluators: cloneJson(causalResolution.immutable_causal_evaluators ?? null),
      immutable_physics_effects: cloneJson(causalResolution.immutable_physics_effects ?? null),
      immutable_projectile_lifecycle: cloneJson(causalResolution.immutable_projectile_lifecycle ?? null),
      immutable_ability_field_lifecycle: cloneJson(causalResolution.immutable_ability_field_lifecycle ?? null),
      immutable_event_queries: cloneJson(causalResolution.immutable_event_queries ?? null),
      immutable_event_arbitration: cloneJson(causalResolution.immutable_event_arbitration ?? null),
      cross_layer_event_arbitration: cloneJson(causalResolution.cross_layer_event_arbitration ?? null),
      causal_epochs: cloneJson(causalResolution.causal_epochs ?? null),
      fixed_point_convergence: cloneJson(causalResolution.fixed_point_convergence ?? null),
      visibility_queries: cloneJson(preparedTurn.visibility_queries ?? []),
      directional_height_visibility_queries: cloneJson(
        preparedTurn.directional_height_visibility_queries ?? [],
      ),
      illumination_visibility_queries: cloneJson(preparedTurn.illumination_visibility_queries ?? []),
      trace_ids: traceIds,
      causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    },
    options,
  );

  return {
    ok: true,
    committed: true,
    world_simulation_session_id: sessionId,
    turn_id: preparedTurn.turn_id,
    revision: committed.state.revision,
    previous_state_hash: snapshot.state_hash,
    next_state_hash: committed.state.state_hash,
    selected_action_intents: selected,
    consistency,
    trace_ids: traceIds,
    causal_resolution_id: causalResolution.causal_resolution_id ?? null,
    next_event: array(causalResolution.next_world_state.event_queue)[0] ?? null,
  };
}

export async function runWorldSimulationTurn(input = {}, options = {}) {
  if (typeof options.characterBrain !== "function") {
    const error = new Error("Phase62C requires a characterBrain function for named-character action choice.");
    error.code = "WORLD_SIMULATION_CHARACTER_BRAIN_REQUIRED";
    throw error;
  }
  const prepared = await prepareWorldSimulationTurn(input, options);
  const selections = {};
  for (const packet of prepared.decision_packets) {
    const brainInput = cloneJson({
      world_simulation_session_id: prepared.world_simulation_session_id,
      turn_id: prepared.turn_id,
      event: prepared.event,
      character: packet.character,
      perception: packet.perception,
      retrieved_memories: packet.retrieved_memories,
      cognition: packet.cognition,
      candidate_action_intents: packet.candidate_action_intents,
      boundaries: packet.boundaries,
    });
    selections[packet.character] = await options.characterBrain(brainInput);
  }
  return resolveWorldSimulationTurn(prepared, selections, options);
}
