import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  buildWorldSimulationCharacterBrainInput,
  worldSimulationCharacterBrainInputVersion,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";
import {
  createEphemeralWorldSimulationPreparedTurnBroker,
  worldSimulationPreparedTurnBrokerVersion,
} from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";
import {
  attachWorldSimulationPreparedTurnBrokerIpc,
  createWorldSimulationPreparedTurnBrokerIpcClient,
} from "../../server/src/world-simulation-prepared-turn-broker-ipc.mjs";
import {
  beginFormalWorldSimulationSession,
  buildWorldSimulationFormalTurnTransportContract,
  prepareFormalWorldSimulationTurn,
  resolveFormalWorldSimulationTurn,
  submitFormalWorldSimulationCharacterAction,
  worldSimulationFormalTurnTransportVersion,
} from "../../server/src/world-simulation-formal-turn-transport-service.mjs";
import {
  listNeuralTraces,
} from "../../server/src/neural-trace-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62a-r1-step4b1-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

function linkedProcessPair() {
  const parentChild = new EventEmitter();
  const childProcess = new EventEmitter();
  parentChild.connected = true;
  childProcess.connected = true;
  parentChild.send = (message, callback) => {
    queueMicrotask(() => childProcess.emit("message", structuredClone(message)));
    callback?.(null);
  };
  childProcess.send = (message, callback) => {
    queueMicrotask(() => parentChild.emit("message", structuredClone(message)));
    callback?.(null);
  };
  return { parentChild, childProcess };
}

const actor = "伊萊亞斯・諾爾";
const sceneId = "step4b1-room";
const unretrievedSecret = "STEP4B1_UNRETRIEVED_MEMORY_SECRET";

function initialWorldState() {
  return {
    simulation_time: "2026-08-25T07:30:00.000+08:00",
    world_rules: {
      default_movement_speed_mps: 1,
      collision_radius_m: 0.3,
      door_interaction_seconds: 0.5,
      object_interaction_seconds: 0.5,
      attack_attempt_seconds: 0.5,
    },
    event_queue: [{
      event_id: "step4b1-open-door-event",
      scene_id: sceneId,
      participants: [actor],
      memory_retrieval_context: {
        retrieval_goal: {
          kind: "memory_ref",
          memory_id: "step4b1-secret-memory",
        },
      },
    }],
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: {
          [actor]: { x: 1, y: 1 },
        },
        doors: {
          "gate-a": { open: false, locked: false },
        },
        obstacles: [],
        structures: [],
        observable_by: {
          [actor]: {
            visual: ["gate-a 在前方"],
            audible: ["空調低鳴"],
          },
        },
      },
    },
    characters: {
      [actor]: {
        known: ["自己在訓練室"],
        current_goal: "打開門",
        current_action: "站在門前",
        movement_speed_mps: 1,
        reach_m: 1.25,
      },
    },
    memories: {
      [actor]: [{
        memory_id: "step4b1-secret-memory",
        content: unretrievedSecret,
        accessible: true,
        suppressed: false,
        source: {
          kind: "direct_perception",
          sense: "visual",
        },
      }],
    },
    objects: {},
    available_actions: {
      [actor]: [{
        action_id: "open-gate",
        intent: "打開 gate-a",
        door_interaction: {
          door_id: "gate-a",
          operation: "open",
        },
      }],
    },
  };
}

try {
  const contract = buildWorldSimulationFormalTurnTransportContract();
  assert.equal(contract.version, worldSimulationFormalTurnTransportVersion);
  assert.equal(contract.prepared_turn_broker_version, worldSimulationPreparedTurnBrokerVersion);
  assert.equal(contract.character_brain_input_version, worldSimulationCharacterBrainInputVersion);
  assert.equal(contract.lifecycle.one_active_prepared_turn_per_world_session, true);
  assert.equal(contract.lifecycle.concurrent_prepare_uses_parent_reservation, true);
  assert.equal(contract.lifecycle.one_shot_resolution, true);
  assert.equal(contract.authority.custom_causal_adjudicator_forwarded, false);
  assert.equal(contract.authority.custom_memory_retrieval_resolver_forwarded, false);
  assert.equal(contract.mcp_public_adoption_installed, false);

  const projected = buildWorldSimulationCharacterBrainInput({
    character: actor,
    event: { engine_secret: true },
    world_simulation_session_id: "secret-session",
    turn_id: "secret-turn",
    perception: { visual: ["門"] },
    recovered_memories: [{ content: "actually recovered" }],
    retrieval_experience: { process_occurred: true },
    cognition: { current_goal: "開門" },
    candidate_action_intents: [{ action_id: "open-gate", intent: "開門" }],
    boundaries: { raw_world_event_exposed: false },
  });
  assert.equal(Object.hasOwn(projected, "event"), false);
  assert.equal(Object.hasOwn(projected, "world_simulation_session_id"), false);
  assert.equal(Object.hasOwn(projected, "turn_id"), false);
  assert.equal(Object.hasOwn(projected, "retrieved_memories"), false);
  const compatibilityProjected = buildWorldSimulationCharacterBrainInput({
    character: actor,
    recovered_memories: [],
  }, {
    include_legacy_retrieved_memories_alias: true,
  });
  assert.deepEqual(compatibilityProjected.retrieved_memories, []);

  const v3RecollectionText = "昨晚門口的燈曾經閃了一下";
  const v3Projected = buildWorldSimulationCharacterBrainInput({
    character: actor,
    perception: { observed: [], audible: [], other_senses: [] },
    recovered_memories: [{
      content: v3RecollectionText,
      memory_id: "engine-private-memory-id",
    }],
    retrieval_experience: {
      process_occurred: true,
      initiation_mode: "spontaneous",
      target_outcome: "not_applicable",
      recovered_any_content: true,
    },
    cognition: {
      recovered_memories: [{ content: v3RecollectionText }],
      retrieval_experience: { process_occurred: true },
      attention: {
        focus: {
          context_origin: "recovered_memory",
          content: v3RecollectionText,
        },
        active_context: [{ content: "non-recollection attention item" }],
        peripheral_context: [],
        fading_context: [],
        suspended_context: [],
        temporary_expectation: null,
      },
      working_context: {
        focus: {
          context_origin: "recovered_memory",
          content: v3RecollectionText,
          possibly_incorrect: true,
        },
        active_context: [{ content: "non-recollection attention item" }],
        peripheral_context: [],
        fading_context: [],
        suspended_context: [],
      },
    },
    candidate_action_intents: [{ action_id: "wait", intent: "等待" }],
    boundaries: {
      recollection_reinstatement_v3_installed: true,
      recollection_single_semantic_exposure_enforced: true,
      native_character_brain_memory_channel: "cognition.working_context",
    },
  }, {
    include_legacy_retrieved_memories_alias: true,
  });
  const v3ProjectedText = JSON.stringify(v3Projected);
  assert.equal(Object.hasOwn(v3Projected, "recovered_memories"), false);
  assert.equal(Object.hasOwn(v3Projected, "retrieved_memories"), false);
  assert.equal(Object.hasOwn(v3Projected.cognition, "recovered_memories"), false);
  assert.equal(Object.hasOwn(v3Projected.cognition, "retrieval_experience"), false);
  assert.equal(v3Projected.cognition.attention.focus, null);
  assert.equal(
    v3Projected.cognition.attention.active_context[0].content,
    "non-recollection attention item",
    "v3 deduplication must not remove unrelated attention content",
  );
  assert.equal(
    v3Projected.cognition.working_context.focus.context_origin,
    "recovered_memory",
  );
  assert.equal(v3Projected.cognition.working_context.focus.possibly_incorrect, true);
  assert.equal(
    v3ProjectedText.split(v3RecollectionText).length - 1,
    1,
    "v3 Character Brain ingress must expose one recollection semantic item exactly once",
  );
  assert.equal(v3ProjectedText.includes("engine-private-memory-id"), false);
  assert.equal(v3Projected.retrieval_experience.process_occurred, true);
  assert.throws(
    () => buildWorldSimulationCharacterBrainInput({
      character: actor,
      recovered_memories: [{ content: "must not bypass Current Mind" }],
      cognition: {},
      boundaries: { recollection_reinstatement_v3_installed: true },
    }),
    (error) => error?.code === "WORLD_SIMULATION_RECOLLECTION_CURRENT_MIND_REQUIRED",
    "v3 must fail closed when Runtime-owned working_context is missing",
  );

  // Broker unit: one active turn/session, strict decision ordering, one-shot take.
  const broker = createEphemeralWorldSimulationPreparedTurnBroker();
  const brokerPrepared = {
    world_simulation_session_id: "agent_run_20260825-073000-1234abcd",
    state_revision: 0,
    world_state_hash: "state-hash",
    decision_packets: [],
  };
  const stored = broker.store({
    world_simulation_session_id: brokerPrepared.world_simulation_session_id,
    state_revision: 0,
    world_state_hash: "state-hash",
    prepared_turn: brokerPrepared,
    decision_inputs: [{
      character_input: {
        character: actor,
        perception: {},
        recovered_memories: [],
        retrieval_experience: { process_occurred: false },
        cognition: {},
        candidate_action_intents: [{ action_id: "wait", intent: "等待" }],
        boundaries: {},
      },
    }],
  });
  assert.equal(stored.payload_reference_active, true);
  assert.equal(JSON.stringify(stored).includes("decision_packets"), false);
  assert.throws(() => broker.store({
    world_simulation_session_id: brokerPrepared.world_simulation_session_id,
    state_revision: 0,
    world_state_hash: "state-hash",
    prepared_turn: brokerPrepared,
    decision_inputs: [{ character_input: stored.current_decision.character_input }],
  }), (error) => error?.code === "WORLD_SIMULATION_PREPARED_TURN_ALREADY_ACTIVE");
  assert.throws(() => broker.submitDecision({
    prepared_turn_handle: stored.prepared_turn_handle,
    decision_handle: stored.current_decision.decision_handle,
    action_id: "not-available",
  }), (error) => error?.code === "WORLD_SIMULATION_ACTION_NOT_AVAILABLE");
  const ready = broker.submitDecision({
    prepared_turn_handle: stored.prepared_turn_handle,
    decision_handle: stored.current_decision.decision_handle,
    action_id: "wait",
  });
  assert.equal(ready.ready_to_resolve, true);
  const takes = await Promise.allSettled([
    Promise.resolve().then(() => broker.takeForResolution({
      prepared_turn_handle: stored.prepared_turn_handle,
      resolver_owner_id: "owner-a",
    })),
    Promise.resolve().then(() => broker.takeForResolution({
      prepared_turn_handle: stored.prepared_turn_handle,
      resolver_owner_id: "owner-b",
    })),
  ]);
  assert.deepEqual(takes.map((item) => item.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(broker.invalidateOwner("owner-a") + broker.invalidateOwner("owner-b"), 1);
  assert.equal(broker.getReceipt({ prepared_turn_handle: stored.prepared_turn_handle }).status, "invalidated");

  // IPC unit: owner identity is parent-minted; child disconnect invalidates a taken turn.
  const ipcBroker = createEphemeralWorldSimulationPreparedTurnBroker();
  const { parentChild, childProcess } = linkedProcessPair();
  const detach = attachWorldSimulationPreparedTurnBrokerIpc(
    parentChild,
    ipcBroker,
    { owner_id: "ipc-owner-step4b1" },
  );
  const ipcClient = createWorldSimulationPreparedTurnBrokerIpcClient({
    process_like: childProcess,
    timeout_ms: 2_000,
  });
  const ipcReservation = await ipcClient.reservePreparation({
    world_simulation_session_id: "agent_run_20260825-073100-1234abcd",
    state_revision: 0,
    world_state_hash: "ipc-state-hash",
  });
  assert.equal(ipcReservation.acquired, true);
  const competingReservation = await ipcClient.reservePreparation({
    world_simulation_session_id: "agent_run_20260825-073100-1234abcd",
    state_revision: 0,
    world_state_hash: "ipc-state-hash",
  });
  assert.equal(competingReservation.acquired, false);
  const ipcStored = await ipcClient.storePrepared({
    prepared_turn_handle: ipcReservation.receipt.prepared_turn_handle,
    prepared_turn: {
      world_simulation_session_id: "agent_run_20260825-073100-1234abcd",
      state_revision: 0,
      world_state_hash: "ipc-state-hash",
    },
    decision_inputs: [{
      character_input: {
        character: actor,
        candidate_action_intents: [{ action_id: "wait", intent: "等待" }],
      },
    }],
  });
  const ipcReady = await ipcClient.submitDecision({
    prepared_turn_handle: ipcStored.prepared_turn_handle,
    decision_handle: ipcStored.current_decision.decision_handle,
    action_id: "wait",
  });
  assert.equal(ipcReady.ready_to_resolve, true);
  await ipcClient.takeForResolution({
    prepared_turn_handle: ipcStored.prepared_turn_handle,
  });
  parentChild.emit("exit");
  assert.equal(
    ipcBroker.getReceipt({ prepared_turn_handle: ipcStored.prepared_turn_handle }).status,
    "invalidated",
  );
  detach();

  // Formal in-process integration with actual native prepare/resolve.
  let injectedRetrievalResolverCalled = false;
  let injectedCausalAdjudicatorCalled = false;
  const formalBroker = createEphemeralWorldSimulationPreparedTurnBroker();
  const session = await beginFormalWorldSimulationSession({
    simulation_label: "Phase62A-R1 Step4B-1 formal transport fixture",
    seed: "phase62a-r1-step4b1",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initialWorldState(),
  }, options);
  assert.equal(session.world_state_initialized, true);
  assert.equal(session.world_state_revision, 0);

  const firstPrepare = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, {
    ...options,
    preparedTurnBroker: formalBroker,
    memoryRetrievalResolver: async () => {
      injectedRetrievalResolverCalled = true;
      throw new Error("formal transport must not call this resolver");
    },
  });
  assert.equal(firstPrepare.ready_to_resolve, false);
  assert(firstPrepare.current_decision);
  assert.equal(firstPrepare.current_decision.character_input.character, actor);
  assert.equal(Object.hasOwn(firstPrepare.current_decision.character_input, "event"), false);
  assert.equal(Object.hasOwn(firstPrepare.current_decision.character_input, "world_simulation_session_id"), false);
  assert.equal(Object.hasOwn(firstPrepare.current_decision.character_input, "turn_id"), false);
  assert.equal(Object.hasOwn(firstPrepare.current_decision.character_input, "retrieved_memories"), false);
  assert.equal(
    JSON.stringify(firstPrepare.current_decision.character_input).includes(unretrievedSecret),
    false,
  );
  assert.equal(
    Object.hasOwn(firstPrepare.current_decision.character_input, "recovered_memories"),
    false,
    "v3 formal Character Brain ingress must not expose the raw Phase63C recovered-content channel",
  );
  assert.equal(
    firstPrepare.current_decision.character_input
      .boundaries.recollection_reinstatement_v3_installed,
    true,
  );
  assert.equal(
    firstPrepare.current_decision.character_input
      .boundaries.native_character_brain_memory_channel,
    "cognition.working_context",
  );
  assert.equal(
    firstPrepare.current_decision.character_input.retrieval_experience.process_occurred,
    false,
  );
  assert.equal(injectedRetrievalResolverCalled, false);

  const tracesAfterFirstPrepare = await listNeuralTraces({
    ...options,
    run_id: session.world_simulation_session_id,
  });
  const repeatedPrepare = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
  }, {
    ...options,
    preparedTurnBroker: formalBroker,
  });
  const tracesAfterRepeat = await listNeuralTraces({
    ...options,
    run_id: session.world_simulation_session_id,
  });
  assert.equal(repeatedPrepare.prepared_turn_handle, firstPrepare.prepared_turn_handle);
  assert.equal(repeatedPrepare.reused_existing_prepared_turn, true);
  assert.equal(tracesAfterRepeat.length, tracesAfterFirstPrepare.length);

  await assert.rejects(
    () => submitFormalWorldSimulationCharacterAction({
      prepared_turn_handle: firstPrepare.prepared_turn_handle,
      decision_handle: firstPrepare.current_decision.decision_handle,
      action_id: "invented-action",
    }, {
      ...options,
      preparedTurnBroker: formalBroker,
    }),
    (error) => error?.code === "WORLD_SIMULATION_ACTION_NOT_AVAILABLE",
  );

  const submitted = await submitFormalWorldSimulationCharacterAction({
    prepared_turn_handle: firstPrepare.prepared_turn_handle,
    decision_handle: firstPrepare.current_decision.decision_handle,
    action_id: "open-gate",
  }, {
    ...options,
    preparedTurnBroker: formalBroker,
  });
  assert.equal(submitted.ready_to_resolve, true);
  assert.equal(submitted.current_decision, null);

  await assert.rejects(
    () => submitFormalWorldSimulationCharacterAction({
      prepared_turn_handle: firstPrepare.prepared_turn_handle,
      decision_handle: firstPrepare.current_decision.decision_handle,
      action_id: "open-gate",
    }, {
      ...options,
      preparedTurnBroker: formalBroker,
    }),
    (error) => error?.code === "WORLD_SIMULATION_PREPARED_TURN_NOT_ACCEPTING_DECISIONS",
  );

  const resolved = await resolveFormalWorldSimulationTurn({
    prepared_turn_handle: firstPrepare.prepared_turn_handle,
  }, {
    ...options,
    preparedTurnBroker: formalBroker,
    causalAdjudicator: async () => {
      injectedCausalAdjudicatorCalled = true;
      throw new Error("formal transport must not call custom causal adjudicator");
    },
  });
  assert.equal(resolved.committed, true);
  assert.equal(resolved.revision, 1);
  assert.equal(resolved.lifecycle_status, "committed");
  assert.equal(resolved.boundaries.next_world_state_exposed, false);
  assert.equal(injectedCausalAdjudicatorCalled, false);

  const committedState = await getWorldSimulationState(
    session.world_simulation_session_id,
    options,
  );
  assert.equal(committedState.state.scenes[sceneId].doors["gate-a"].open, true);
  assert.equal(formalBroker.getReceipt({
    prepared_turn_handle: firstPrepare.prepared_turn_handle,
  }).payload_reference_active, false);

  await assert.rejects(
    () => resolveFormalWorldSimulationTurn({
      prepared_turn_handle: firstPrepare.prepared_turn_handle,
    }, {
      ...options,
      preparedTurnBroker: formalBroker,
    }),
    (error) => error?.code === "WORLD_SIMULATION_PREPARED_TURN_NOT_READY",
  );

  // Stale prepared turn is invalidated before a new preparation is created.
  const staleBroker = createEphemeralWorldSimulationPreparedTurnBroker();
  const staleSession = await beginFormalWorldSimulationSession({
    simulation_label: "Phase62A-R1 Step4B-1 stale fixture",
    initial_world_state: initialWorldState(),
  }, options);
  const stalePrepared = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: staleSession.world_simulation_session_id,
  }, {
    ...options,
    preparedTurnBroker: staleBroker,
  });
  const staleSnapshot = await getWorldSimulationState(
    staleSession.world_simulation_session_id,
    options,
  );
  await commitWorldSimulationTurn(
    staleSession.world_simulation_session_id,
    {
      expected_revision: staleSnapshot.revision,
      expected_state_hash: staleSnapshot.state_hash,
      turn_id: "step4b1-test-harness-external-revision",
      next_world_state: staleSnapshot.state,
    },
    options,
  );
  const refreshed = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: staleSession.world_simulation_session_id,
  }, {
    ...options,
    preparedTurnBroker: staleBroker,
  });
  assert.notEqual(refreshed.prepared_turn_handle, stalePrepared.prepared_turn_handle);
  assert.equal(staleBroker.getReceipt({
    prepared_turn_handle: stalePrepared.prepared_turn_handle,
  }).status, "invalidated");

  console.log(JSON.stringify({
    ok: true,
    phase: "Phase62A-R1 Step 4B-1",
    transport_version: worldSimulationFormalTurnTransportVersion,
    broker_version: worldSimulationPreparedTurnBrokerVersion,
    character_brain_input_version: worldSimulationCharacterBrainInputVersion,
    one_active_prepared_turn_per_session: true,
    repeated_prepare_reuses_handle_without_new_traces: true,
    concurrent_prepare_reservation_installed: true,
    sequential_decision_handle_enforced: true,
    unavailable_action_rejected: true,
    one_shot_resolution_enforced: true,
    resolver_owner_disconnect_invalidates_taken_turn: true,
    full_prepared_turn_exposed_to_character_surface: false,
    unretrieved_candidate_content_exposed_to_character_surface: false,
    custom_memory_retrieval_resolver_forwarded: false,
    custom_causal_adjudicator_forwarded: false,
    native_programmatic_commit_verified: true,
    stale_prepared_turn_invalidated: true,
    mcp_public_adoption_installed: false,
  }));
  console.log("Phase62A-R1 Step 4B-1 prepared-turn transport core test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
