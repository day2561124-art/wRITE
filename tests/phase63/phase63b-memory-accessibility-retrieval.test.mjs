import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationLoopContract,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  buildWorldSimulationMemoryAccessibilityContract,
  queryWorldSimulationMemoryAccessibility,
  worldSimulationMemoryAccessibilityVersion,
} from "../../server/src/world-simulation-memory-accessibility-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase63b-memory-accessibility-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const observer = "phase63b-observer-engine-id";
const sceneId = "phase63b-current-room";
const otherSceneId = "phase63b-other-room";
const eventId = "evt-phase63b-retrieval";
const now = "2026-08-24T19:30:00+08:00";

function memoryRecord({
  id,
  label,
  scene = sceneId,
  encodedAt,
  storageStrength = null,
  encodingRetrievalStrength = null,
  recallCount = null,
  lastRecalledAt = null,
  interferenceKeys = [],
  accessible = true,
}) {
  return {
    memory_id: id,
    memory_type: "episodic_direct_perception",
    content: { kind: "visible_entity", perceptual_label: label },
    source: {
      kind: "direct_perception",
      sense: "visual",
      event_id: `source-${id}`,
      scene_id: scene,
      turn_id: `turn-${id}`,
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    confidence: 0.77,
    clarity: 0.66,
    encoded_at: encodedAt,
    last_recalled_at: lastRecalledAt,
    recall_count: recallCount,
    storage_strength: storageStrength,
    retrieval_strength_at_encoding: encodingRetrievalStrength,
    interference_keys: interferenceKeys,
    accessible,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

const recentSameContext = memoryRecord({
  id: "mem-recent-same-context",
  label: "一小時前在這個房間看見一名學生",
  encodedAt: "2026-08-24T18:30:00+08:00",
  storageStrength: 0.8,
  encodingRetrievalStrength: 0.7,
});
const oldStrongDifferentContext = memoryRecord({
  id: "mem-old-strong-different-context",
  label: "十天前在另一個房間看見一名學生",
  scene: otherSceneId,
  encodedAt: "2026-08-14T19:30:00+08:00",
  storageStrength: 0.95,
  encodingRetrievalStrength: 0.8,
});
const recalledSameContext = memoryRecord({
  id: "mem-recalled-same-context",
  label: "三天前在這個房間看見一名學生，之後曾多次想起",
  encodedAt: "2026-08-21T19:30:00+08:00",
  storageStrength: 0.7,
  encodingRetrievalStrength: 0.6,
  recallCount: 4,
  lastRecalledAt: "2026-08-24T17:30:00+08:00",
});
const inaccessible = memoryRecord({
  id: "mem-explicitly-inaccessible",
  label: "這筆不應被取回",
  encodedAt: "2026-08-24T19:00:00+08:00",
  storageStrength: 1,
  accessible: false,
});

const retrievalProfile = {
  enabled: true,
  retrieval_threshold: 0.55,
  max_items: 3,
  component_weights: {
    storage_strength: 0.15,
    age_accessibility: 0.3,
    recall_recency: 0.2,
    recall_frequency: 0.15,
    context_match: 0.2,
  },
  age_accessibility: {
    mode: "hyperbolic",
    scale_hours: 24,
  },
  recall_recency: {
    mode: "hyperbolic",
    scale_hours: 12,
  },
  recall_frequency: {
    saturation_count: 4,
  },
  context_cue_weights: {
    scene_id: 1,
  },
  interference: {
    enabled: true,
    per_competitor_penalty: 0.2,
    max_penalty: 0.4,
  },
};

const worldState = {
  simulation_time: now,
  world_rules: {},
  event_queue: [{
    event_id: eventId,
    type: "memory_retrieval_fixture",
    scene_id: sceneId,
    participants: [observer],
  }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: { [observer]: { x: 2, y: 2 } },
      obstacles: [],
      structures: [],
      doors: [],
    },
  },
  characters: {
    [observer]: {
      current_action: "回想最近的事情",
      memory_retrieval_profile: retrievalProfile,
    },
  },
  memories: {
    [observer]: [recentSameContext, oldStrongDifferentContext, recalledSameContext, inaccessible],
  },
  objects: {},
  available_actions: {
    [observer]: [{ action_id: "remain-still", intent: "維持原地" }],
  },
};

function noOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase63b-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [{
      actor: observer,
      action_id: "remain-still",
      result: "remained_still",
      causal_evidence: "fixture changes no hard state except queue consumption",
    }],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

try {
  const contract = buildWorldSimulationMemoryAccessibilityContract();
  assert.equal(contract.version, worldSimulationMemoryAccessibilityVersion);
  assert.equal(contract.storage_strength_and_retrieval_strength_separate, true);
  assert.equal(contract.persistent_memory_decay_writes_allowed, false);
  assert.equal(contract.forgetting_deletes_memory_records, false);
  assert.equal(contract.explicit_profile_required_for_programmatic_filtering, true);
  assert.equal(contract.universal_forgetting_curve_assumed, false);
  assert.deepEqual(contract.supported_explicit_age_functions, ["none", "hyperbolic", "exponential", "power"]);
  assert.equal(contract.explicit_context_cues_only, true);
  assert.equal(contract.explicit_interference_keys_only, true);
  assert.equal(contract.retrieval_strength_scores_forwarded_to_character_brain, false);
  assert.equal(contract.character_brain_decides_memory_accessibility, false);

  const loopContract = buildWorldSimulationLoopContract();
  assert.equal(loopContract.subjective_memory_accessibility.version, worldSimulationMemoryAccessibilityVersion);

  const directInput = {
    world_state: worldState,
    character: observer,
    memory_records: worldState.memories[observer],
    simulation_time: now,
    scene_id: sceneId,
    perception: { scene_id: sceneId, observed: [], audible: [], other_senses: [] },
  };
  const directHashBefore = hashAgentRunValue(directInput);
  const direct = queryWorldSimulationMemoryAccessibility(directInput);
  assert.equal(hashAgentRunValue(directInput), directHashBefore);
  assert.equal(direct.audit.input_context_immutable, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.read_only_memory_accessibility_query, true);
  assert.equal(direct.audit.query_output_contains_world_state, false);
  assert.equal(direct.audit.query_output_contains_mutation_proposals, false);
  assert.equal(direct.audit.persistent_memory_records_mutated, false);
  assert.equal(direct.result.accessibility_enforced, true);

  const byId = new Map(direct.result.evaluations.map((item) => [item.memory_id, item]));
  const recentEval = byId.get(recentSameContext.memory_id);
  const oldEval = byId.get(oldStrongDifferentContext.memory_id);
  const recalledEval = byId.get(recalledSameContext.memory_id);
  const inaccessibleEval = byId.get(inaccessible.memory_id);
  assert.ok(recentEval.retrieval_strength > 0.8);
  assert.ok(oldEval.retrieval_strength < 0.4);
  assert.equal(oldEval.storage_strength, 0.95, "high storage strength must remain distinct from low current retrieval strength");
  assert.equal(oldEval.retrievable, false);
  assert.ok(recalledEval.retrieval_strength > oldEval.retrieval_strength);
  assert.equal(recalledEval.recall_count, 4);
  assert.equal(recalledEval.components.recall_frequency.value, 1);
  assert.equal(recentEval.context_match, 1);
  assert.equal(oldEval.context_match, 0);
  assert.equal(inaccessibleEval.retrievable, false);
  assert.deepEqual(
    direct.result.retrievable_memory_records.map((item) => item.memory_id),
    [recentSameContext.memory_id, recalledSameContext.memory_id],
  );
  const directBeforeRecords = JSON.stringify(worldState.memories[observer]);
  assert.equal(JSON.stringify(directInput.memory_records), directBeforeRecords);
  assert.equal(direct.result.retrievable_memory_records.some((item) => Object.hasOwn(item, "retrieval_strength")), false);

  const noProfileWorld = structuredClone(worldState);
  delete noProfileWorld.characters[observer].memory_retrieval_profile;
  const noProfile = queryWorldSimulationMemoryAccessibility({
    ...directInput,
    world_state: noProfileWorld,
    memory_records: noProfileWorld.memories[observer],
  });
  assert.equal(noProfile.result.accessibility_enforced, false);
  assert.deepEqual(
    noProfile.result.retrievable_memory_records.map((item) => item.memory_id),
    [recentSameContext.memory_id, oldStrongDifferentContext.memory_id, recalledSameContext.memory_id],
  );
  assert.equal(JSON.stringify(noProfileWorld.memories[observer]), directBeforeRecords);

  const curveMemory = memoryRecord({
    id: "mem-curve-comparison",
    label: "用於比較明確指定時間函數",
    encodedAt: "2026-08-22T19:30:00+08:00",
    storageStrength: 0.5,
  });
  const curveBase = {
    world_state: { simulation_time: now, characters: { [observer]: {} } },
    character: observer,
    memory_records: [curveMemory],
    simulation_time: now,
    scene_id: sceneId,
    perception: { scene_id: sceneId, observed: [], audible: [], other_senses: [] },
  };
  const curveScore = (mode, extra = {}) => queryWorldSimulationMemoryAccessibility({
    ...curveBase,
    memory_retrieval_profile: {
      enabled: true,
      component_weights: { age_accessibility: 1 },
      age_accessibility: { mode, scale_hours: 24, ...extra },
    },
  }).result.evaluations[0].retrieval_strength;
  const hyperbolicScore = curveScore("hyperbolic");
  const exponentialScore = curveScore("exponential");
  const powerScore = curveScore("power", { exponent: 1.5 });
  assert.notEqual(hyperbolicScore, exponentialScore);
  assert.notEqual(powerScore, exponentialScore);

  const competitorA = memoryRecord({
    id: "mem-competitor-a",
    label: "相似事件 A",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["same-uniform-corridor-event"],
  });
  const competitorB = memoryRecord({
    id: "mem-competitor-b",
    label: "相似事件 B",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["same-uniform-corridor-event"],
  });
  const unique = memoryRecord({
    id: "mem-unique",
    label: "不同事件",
    encodedAt: "2026-08-24T18:30:00+08:00",
    storageStrength: 0.9,
    interferenceKeys: ["unique-event"],
  });
  const interference = queryWorldSimulationMemoryAccessibility({
    ...curveBase,
    memory_records: [competitorA, competitorB, unique],
    memory_retrieval_profile: {
      enabled: true,
      component_weights: { storage_strength: 1 },
      interference: { enabled: true, per_competitor_penalty: 0.25, max_penalty: 0.5 },
    },
  });
  const interferenceById = new Map(interference.result.evaluations.map((item) => [item.memory_id, item]));
  assert.equal(interferenceById.get(competitorA.memory_id).interference_competitor_count, 1);
  assert.equal(interferenceById.get(competitorA.memory_id).interference_penalty, 0.25);
  assert.ok(interferenceById.get(competitorA.memory_id).retrieval_strength < interferenceById.get(unique.memory_id).retrieval_strength);

  const session = await beginWorldSimulationSession({
    simulation_label: "Phase63B memory accessibility fixture",
    seed: "phase63b",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: worldState,
  }, options);

  const brainInputs = [];
  const turn = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: eventId,
    },
    {
      ...options,
      characterBrain: async (packet) => {
        brainInputs.push(packet);
        assert.equal(packet.boundaries.programmatic_memory_accessibility_enforced, true);
        assert.equal(packet.boundaries.memory_retrieval_strength_scores_exposed, false);
        assert.deepEqual(
          packet.retrieved_memories.map((item) => item.memory_id),
          [recentSameContext.memory_id, recalledSameContext.memory_id],
        );
        const serializedMemories = JSON.stringify(packet.retrieved_memories);
        assert.equal(serializedMemories.includes("retrieval_strength"), false);
        assert.equal(serializedMemories.includes("interference_penalty"), false);
        assert.equal(serializedMemories.includes(oldStrongDifferentContext.content.perceptual_label), false);
        const recent = packet.retrieved_memories[0];
        assert.equal(recent.confidence, 0.77);
        assert.equal(recent.clarity, 0.66);
        return { action_id: "remain-still" };
      },
      causalAdjudicator: noOpAdjudicator,
    },
  );
  assert.equal(turn.ok, true);
  assert.equal(turn.committed, true);
  assert.equal(brainInputs.length, 1);

  const after = await getWorldSimulationState(session.world_simulation_session_id, options);
  const originalMemoryIds = worldState.memories[observer].map((item) => item.memory_id);
  const afterOriginalMemories = after.state.memories[observer].slice(0, originalMemoryIds.length);
  assert.deepEqual(afterOriginalMemories.map((item) => item.memory_id), originalMemoryIds);
  assert.deepEqual(
    afterOriginalMemories.map((item) => item.storage_strength),
    worldState.memories[observer].map((item) => item.storage_strength),
  );
  assert.deepEqual(
    afterOriginalMemories.map((item) => item.clarity),
    worldState.memories[observer].map((item) => item.clarity),
  );

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].memory_accessibility_queries.length, 1);
  assert.equal(history.turns[0].memory_accessibility_queries[0].version, worldSimulationMemoryAccessibilityVersion);
  assert.equal(history.turns[0].memory_accessibility_queries[0].audit.deterministic_replay_verified, true);
  assert.equal(history.turns[0].memory_accessibility_queries[0].result.accessibility_boundary.time_passage_does_not_rewrite_persistent_memory_records, true);

  console.log(JSON.stringify({
    memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,
    persisted_history_turns: history.turns.length,
    accessibility_enforced: direct.result.accessibility_enforced,
    recent_same_context_retrieved: recentEval.retrievable,
    old_high_storage_low_retrieval_filtered: oldEval.storage_strength === 0.95 && oldEval.retrievable === false,
    recalled_memory_accessibility_boosted: recalledEval.retrieval_strength > oldEval.retrieval_strength,
    context_match_affects_retrieval: recentEval.context_match > oldEval.context_match,
    explicit_interference_lowers_competing_memory: interferenceById.get(competitorA.memory_id).retrieval_strength < interferenceById.get(unique.memory_id).retrieval_strength,
    no_profile_preserves_legacy_accessibility: noProfile.result.accessibility_enforced === false,
    multiple_explicit_time_functions_supported: new Set([hyperbolicScore, exponentialScore, powerScore]).size === 3,
    persistent_memory_records_rewritten_by_time: false,
    confidence_or_clarity_rewritten_by_retrieval: false,
    retrieval_strength_scores_exposed_to_character_brain: false,
    deterministic_replay_verified: direct.audit.deterministic_replay_verified,
    character_brain_decides_memory_accessibility: false,
    recall_reinforcement_modeled: false,
    source_confusion_or_distortion_modeled: false,
  }));
  console.log("Phase63B subjective memory accessibility/retrieval test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
