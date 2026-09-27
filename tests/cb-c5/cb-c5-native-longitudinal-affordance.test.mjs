import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveAffordanceEvidenceCatalog } from "../../server/src/world-simulation-subjective-affordance-evidence-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveEpisodeSegmentations,
} from "../../server/src/world-simulation-subjective-episode-segmentation-service.mjs";
import {
  buildWorldSimulationAutobiographicalLifeEventOrganizations,
} from "../../server/src/world-simulation-autobiographical-life-event-service.mjs";
import {
  buildWorldSimulationPersonalSemanticMemoryDerivations,
  buildWorldSimulationPersonalSemanticMemoryResolverView,
} from "../../server/src/world-simulation-personal-semantic-memory-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const actor = "伊萊亞斯・諾爾";
const sceneId = "cb-c5-d-room";
const objectId = "visible-token";
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cb-c5-e-native-${process.pid}-${Date.now()}`,
);

function clone(value) {
  return structuredClone(value);
}

function memoryFixture(memoryId, turnId, description) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: { kind: "visual_observation", description },
    source: { kind: "direct_perception", sense: "visual" },
    internal_provenance: {
      event_id: `engine_${memoryId}`,
      scene_id: `scene_${memoryId}`,
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v2",
    },
    retrieval_cues: { memory_type: "episodic_direct_perception" },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
    encoded_at: memoryId.endsWith("-1")
      ? "2026-09-25T08:00:00.000Z"
      : "2026-09-26T08:00:00.000Z",
  };
}

function source(memory) {
  return { character: actor, memory_record: clone(memory) };
}

function executeTransition(worldState, previewWorldState, stateTransitions, turnId) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: stateTransitions,
    elapsed_ms: 0,
  });
  return executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: previewWorldState,
    queue,
  }).next_world_state;
}

function addLifeEvent(worldState, turnId, memory) {
  const segmentation = buildWorldSimulationSubjectiveEpisodeSegmentations({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [source(memory)],
  });
  const segmented = executeTransition(
    worldState,
    segmentation.result.preview_world_state,
    segmentation.result.state_transitions,
    `${turnId}:subjective_episode_segmentation`,
  );
  const sourceIds = [
    ...segmentation.result.segmentation_events_created
      .map((event) => event.segmentation_event_id),
    ...segmentation.result.already_persisted_segmentation_event_ids,
  ];
  const life = buildWorldSimulationAutobiographicalLifeEventOrganizations({
    world_state: segmented,
    turn_id: turnId,
    source_segmentation_event_ids: sourceIds,
    organization_decisions: [],
  });
  return {
    world_state: executeTransition(
      segmented,
      life.result.preview_world_state,
      life.result.state_transitions,
      `${turnId}:autobiographical_life_event`,
    ),
    organization_event_id:
      life.result.organization_events_created[0].organization_event_id,
  };
}

function lifeRef(worldState, organizationEventId) {
  const event =
    worldState.autobiographical_life_event_organization_events[
      organizationEventId
    ];
  return {
    life_event_id: event.life_event_id,
    organization_event_id: event.organization_event_id,
    organization_event_hash: event.organization_event_hash,
  };
}

function addPickupSemantic(worldState, turnId, currentOrganizationId, refs) {
  const view = buildWorldSimulationPersonalSemanticMemoryResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: [currentOrganizationId],
  });
  const derivation = buildWorldSimulationPersonalSemanticMemoryDerivations({
    world_state: worldState,
    turn_id: turnId,
    source_organization_event_ids: [currentOrganizationId],
    semantic_decisions: [{
      character: actor,
      operation: "form",
      semantic_category: "recurring_event_pattern",
      semantic_key: "ordinary-object-pickup",
      semantic_descriptor: {
        subject_scope: "self_autobiographical_experience",
        predicate: "pickup",
        object_ref: "ordinary_object_pickup",
        qualifiers: [],
      },
      source_life_event_refs: refs,
      resolver_view_hash: view.resolver_view_hash,
      source: "programmatic_personal_semantic_memory_resolver",
    }],
  });
  return executeTransition(
    worldState,
    derivation.result.preview_world_state,
    derivation.result.state_transitions,
    `${turnId}:personal_semantic_memory`,
  );
}

function buildSemanticHistory() {
  const turn1 = "cb-c5-d-prior-1";
  const memory1 = memoryFixture(
    "cb-c5-d-memory-1",
    turn1,
    "曾經把眼前可拿取的小物件撿起來。",
  );
  let world = { memories: { [actor]: [memory1] } };
  const life1 = addLifeEvent(world, turn1, memory1);
  world = life1.world_state;

  const turn2 = "cb-c5-d-prior-2";
  const memory2 = memoryFixture(
    "cb-c5-d-memory-2",
    turn2,
    "另一回也用普通方式撿起伸手可及的小物件。",
  );
  world = clone(world);
  world.memories[actor].push(memory2);
  const life2 = addLifeEvent(world, turn2, memory2);
  return addPickupSemantic(
    life2.world_state,
    turn2,
    life2.organization_event_id,
    [
      lifeRef(life2.world_state, life1.organization_event_id),
      lifeRef(life2.world_state, life2.organization_event_id),
    ],
  );
}

const semanticHistory = buildSemanticHistory();

function initialWorldState({
  eventId,
  objectX,
  reachM,
}) {
  return {
    ...clone(semanticHistory),
    simulation_time: "2026-09-27T04:00:00.000+08:00",
    world_rules: {
      object_interaction_seconds: 0.5,
      default_movement_speed_mps: 1,
    },
    event_queue: [{
      event_id: eventId,
      type: "observation",
      scene_id: sceneId,
      participants: [actor],
      summary: "角色注意到附近有一個小型物件。",
    }],
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        simulation_time: "2026-09-27T04:00:00.000+08:00",
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: {
          [actor]: { x: 1, y: 1 },
        },
        observable_by: {
          [actor]: { visual: [], audible: [] },
        },
      },
    },
    characters: {
      [actor]: {
        known: [],
        uncertain: [],
        current_goal: "整理眼前物品",
        current_action: "觀察",
        reach_m: reachM,
        movement_speed_mps: 1,
      },
    },
    objects: {
      [objectId]: {
        holder: null,
        scene_id: sceneId,
        position: { x: objectX, y: 1 },
        visual_label: "一枚小型黃銅代幣",
      },
    },
    available_actions: {
      [actor]: [{
        action_id: "wait-and-observe",
        intent: "繼續觀察",
      }],
    },
  };
}

const runtimeManager = createWorldSimulationCharacterRuntimeManager({
  identityResolver: async (character) => ({
    entity_id: "cb_c5_d_actor",
    canonical_name: character,
    formal: true,
    identity_source: "cb_c5_d_native_test",
  }),
});

function runtimeOptions() {
  return {
    fixtureRoot,
    characterRuntimeManager: runtimeManager,
    experientialKnowledgeReentryResolver: async (view) => {
      const pickup = view.candidate_personal_semantics.find(
        (candidate) =>
          candidate.semantic_descriptor?.predicate === "pickup"
          && candidate.semantic_descriptor?.object_ref
            === "ordinary_object_pickup",
      );
      return pickup ? [pickup.semantic_ref] : [];
    },
    experientialMethodTransferResolver: async (view) => {
      const method = view.method_candidates.find(
        (candidate) =>
          candidate.method_skeleton?.relation === "pickup"
          && candidate.method_skeleton?.method_ref
            === "ordinary_object_pickup",
      );
      if (!method || view.current_cue_catalog.length === 0) return [];
      return [{
        transfer_ref: method.transfer_ref,
        mapping_kind: "structural_match",
        current_cue_refs: [view.current_cue_catalog[0].cue_ref],
      }];
    },
    subjectiveAffordanceProposalResolver: async (catalog) => {
      const serialized = JSON.stringify(catalog);
      assert.equal(
        serialized.includes(objectId),
        false,
        "Character-owned C5 proposal surface must not receive engine object IDs.",
      );
      const observation = catalog.observation_catalog.find(
        (entry) =>
          entry.subject_kind === "object"
          && entry.subject_ref_field === "perceptual_object_ref",
      );
      const means = catalog.represented_means_catalog.find(
        (entry) =>
          entry.represented_means?.method_skeleton?.relation === "pickup"
          && entry.represented_means?.method_skeleton?.method_ref
            === "ordinary_object_pickup",
      );
      assert.ok(observation, "Current visible object must have one opaque ref.");
      assert.ok(means, "Committed experiential pickup means must reach C5.");
      return {
        observation_ref: observation.observation_ref,
        means_ref: means.means_ref,
      };
    },
  };
}

function groundedCandidate(prepared) {
  const packet = prepared.decision_packets.find(
    (entry) => entry.character === actor,
  );
  assert.ok(packet);
  const candidate = packet.candidate_action_intents.find(
    (entry) =>
      entry.object_interaction?.type === "pickup"
      && entry.object_interaction?.perceptual_object_ref,
  );
  assert.ok(candidate, "C5-D must admit one grounded out-of-menu pickup intent.");
  return { packet, candidate };
}

async function prepareScenario(label, eventId, objectX, reachM) {
  const options = runtimeOptions();
  const session = await beginWorldSimulationSession({
    simulation_label: label,
    seed: eventId,
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initialWorldState({ eventId, objectX, reachM }),
  }, options);
  const prepared = await prepareWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: eventId,
  }, options);
  return { session, prepared, options };
}


await rm(fixtureRoot, { recursive: true, force: true });
try {
  const firstId = "cb-c5-e-first";
  const secondId = "cb-c5-e-second";
  const evolvingWorld = initialWorldState({
    eventId: firstId, objectX: 1.5, reachM: 1.25,
  });
  evolvingWorld.event_queue.push({
    event_id: secondId,
    type: "observation",
    scene_id: sceneId,
    participants: [actor],
    summary: "角色再次查看所在位置。",
  });
  const evolvingOptions = runtimeOptions();
  const evolvingSession = await beginWorldSimulationSession({
    simulation_label: "CB-C5-E same-session observed consequence",
    seed: "cb-c5-e-observed-consequence",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: evolvingWorld,
  }, evolvingOptions);
  const first = await prepareWorldSimulationTurn({
    world_simulation_session_id: evolvingSession.world_simulation_session_id,
    event_id: firstId,
  }, evolvingOptions);
  const { candidate: firstCandidate } = groundedCandidate(first);
  const firstResult = await resolveWorldSimulationTurn(
    first,
    { [actor]: { action_id: firstCandidate.action_id } },
    evolvingOptions,
  );
  assert.equal(firstResult.committed, true);
  const committed = await getWorldSimulationState(
    evolvingSession.world_simulation_session_id, evolvingOptions,
  );
  assert.equal(committed.state.objects[objectId].holder, actor);

  const secondOptions = {
    ...evolvingOptions,
    subjectiveAffordanceProposalResolver: async (catalog) => {
      assert.equal(JSON.stringify(catalog).includes(objectId), false);
      const observedObject = catalog.observation_catalog.find(
        (item) => item.subject_kind === "object",
      );
      if (!observedObject) return null;
      return {
        observation_ref: observedObject.observation_ref,
        means_ref: catalog.represented_means_catalog[0]?.means_ref,
      };
    },
  };
  const second = await prepareWorldSimulationTurn({
    world_simulation_session_id: evolvingSession.world_simulation_session_id,
    event_id: secondId,
  }, secondOptions);
  const secondPacket = second.decision_packets.find(
    (item) => item.character === actor,
  );
  assert.ok(secondPacket);
  const secondCatalog = buildWorldSimulationSubjectiveAffordanceEvidenceCatalog({
    character: actor,
    current_turn_id: second.turn_id,
    perception: secondPacket.perception,
    cognition: secondPacket.cognition,
  });
  assert.equal(
    secondCatalog.represented_means_catalog.some(
      (item) => item.represented_means?.method_skeleton?.relation === "pickup",
    ),
    true,
    "The prior pickup method remains represented in the later turn.",
  );
  assert.equal(
    secondCatalog.observation_catalog.some(
      (item) => item.subject_kind === "object",
    ),
    false,
    "The later observation no longer exposes the held object as a ground target.",
  );
  assert.equal(
    secondPacket.candidate_action_intents.some(
      (item) => item.object_interaction?.perceptual_object_ref,
    ),
    false,
    "After the committed pickup, a new turn must not offer the stale ground object.",
  );
  assert.equal(
    secondPacket.candidate_action_intents.some(
      (item) => item.action_id === "wait-and-observe",
    ),
    true,
    "The prior menu remains usable.",
  );

  const visibleWorld = initialWorldState({
    eventId: "cb-c5-e-paired", objectX: 1.5, reachM: 1.25,
  });
  const hiddenChangeWorld = clone(visibleWorld);
  hiddenChangeWorld.objects["unseen-token"] = {
    holder: null,
    scene_id: "outside-observer-scene",
    position: { x: 1.25, y: 1 },
    visual_label: "一枚觀察者看不到的代幣",
  };
  const pairOptions = runtimeOptions();
  const pair = [];
  for (const [label, world] of [
    ["visible-baseline", visibleWorld],
    ["unobserved-world-change", hiddenChangeWorld],
  ]) {
    const session = await beginWorldSimulationSession({
      simulation_label: "CB-C5-E " + label,
      seed: "cb-c5-e-" + label,
      rules: { event_driven: true, persistent_causality: true },
      initial_world_state: world,
    }, pairOptions);
    const prepared = await prepareWorldSimulationTurn({
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "cb-c5-e-paired",
    }, pairOptions);
    const { packet, candidate } = groundedCandidate(prepared);
    assert.equal(JSON.stringify(packet).includes("unseen-token"), false);
    pair.push({
      perceptual_ref: candidate.object_interaction.perceptual_object_ref,
      type: candidate.object_interaction.type,
      target: candidate.target,
    });
  }
  assert.deepEqual(
    pair[1], pair[0],
    "Changing only unseen World truth must not change the grounded candidate.",
  );
  console.log("CB-C5-E paired longitudinal native affordance tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
