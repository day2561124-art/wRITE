import assert from "node:assert/strict";
import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationState, getWorldSimulationHistory, worldSimulationStatePaths,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
  scheduleWorldSimulationAutonomousCognitionOpportunities,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  projectWorldSimulationAutonomousCognitionOpportunities,
  projectWorldSimulationConsciousCognitionAdmission,
} from "../../server/src/world-simulation-autonomous-cognition-scheduler-service.mjs";
import {
  worldSimulationSleepArousalBodyRuleVersion,
  worldSimulationSleepArousalRecordVersion,
} from "../../server/src/world-simulation-body-sleep-arousal-service.mjs";

// C6-D owns the conscious opportunity gate; the World/Body sleep record owns
// objective state. A caller cannot manufacture a World-time due cue by passing
// a future timestamp or wake a character by requesting a cognition dispatch.
const now = "2026-09-30T00:00:00.000Z";
const dueNow = now;
const later = new Date(Date.parse(now) + 60000).toISOString();
const root = path.join(projectRoot, "tests", ".tmp",
  "cb-c6d-brain-reentry-" + process.pid + "-" + Date.now());
const options = { fixtureRoot: root };
function sleepRecord(condition) {
  return {
    version: worldSimulationSleepArousalRecordVersion,
    character: "aria", condition,
    since_time_ms: Date.parse(now) - 2000,
    source: { kind: "world_initialization", source_id: "initialized-aria-sleep" },
    last_transition: null,
  };
}
function initialWorld() {
  return {
    simulation_time: now,
    event_queue: [{
      event_id: "cb-c6d-wake", scene_id: "room",
      type: "bounded_body_request", summary: "依既有身體規則喚醒",
      participants: ["aria", "keeper"],
      sleep_arousal_transition: {
        character: "aria", condition: "awake", time_ms: 500,
      },
    }],
    characters: {
      aria: {
        current_goal: "整理稍後要處理的線索",
        physical_state: {
          sleep_arousal: sleepRecord("asleep"),
          homeostatic_cues: { fatigue: false },
          health_current: 70, health_max: 100,
          injuries: [], movement_multiplier: 1, combat_multiplier: 1,
        },
      },
      keeper: { physical_state: {}, current_action: "短暫等待" },
    },
    memories: { aria: [], keeper: [] },
    world_rules: {
      sleep_arousal: {
        version: worldSimulationSleepArousalBodyRuleVersion,
        rules: [{
          rule_id: "cb-c6d-explicit-wake",
          character: "aria",
          from_condition: "asleep",
          condition: "awake",
          required_homeostatic_cues: { fatigue: false },
        }],
      },
    },
    available_actions: {
      aria: [],
      keeper: [{ action_id: "cb-c6d-keeper-wait", intent: "留在原處",
        duration_ms: 500 }],
    },
    scenes: {
      room: {
        scene_id: "room", simulation_time: now,
        dimensions: { width_m: 8, depth_m: 8 },
        entity_positions: { aria: { x: 1, y: 1 }, keeper: { x: 2, y: 1 } },
        observable_by: {
          aria: { visual: [], audible: [] },
          keeper: { visual: [], audible: [] },
        },
      },
    },
  };
}
const runtime = {
  aria: {
    idle: true,
    temporal_cues: [{ source_ref: "aria-prior-agreed-cue", due_at: dueNow }],
  },
  keeper: { idle: true },
};
const pureInput = { world_state: initialWorld(), runtime_context_by_character: runtime };
const beforeInput = structuredClone(pureInput);
const sleeping = projectWorldSimulationAutonomousCognitionOpportunities(pureInput);
assert.deepEqual(pureInput, beforeInput);
assert.equal(sleeping.opportunity_count, 0);
assert.equal(sleeping.deferred_opportunity_count, 1);
assert.equal(sleeping.deferred_opportunities[0].character, "aria");
assert.equal(sleeping.thought_content_created, false);
assert.equal(sleeping.world_mutation_performed, false);
assert.equal(sleeping.conscious_admission_audits[0].condition, "asleep");
assert.equal(sleeping.conscious_admission_audits[0].admitted, false);
const stableId = sleeping.deferred_opportunities[0].opportunity_id;
const awakenedWorld = structuredClone(pureInput.world_state);
awakenedWorld.characters.aria.physical_state.sleep_arousal = sleepRecord("awake");
const awake = projectWorldSimulationAutonomousCognitionOpportunities({
  world_state: awakenedWorld, runtime_context_by_character: runtime,
});
assert.equal(awake.opportunity_count, 1);
assert.equal(awake.deferred_opportunity_count, 0);
assert.equal(awake.opportunities[0].opportunity_id, stableId,
  "waking cannot mint a fresh opportunity from unchanged prior evidence");
assert.equal(projectWorldSimulationConsciousCognitionAdmission(
  pureInput.world_state, "keeper").condition, "unknown");
assert.equal(projectWorldSimulationConsciousCognitionAdmission(
  pureInput.world_state, "keeper").admitted, true,
  "legacy unknown does not prove awake, but retains prior compatibility admission");
assert.equal(projectWorldSimulationAutonomousCognitionOpportunities({
  world_state: awakenedWorld, runtime_context_by_character: runtime,
  consumed_opportunity_ids: [stableId],
}).opportunity_count, 0, "a consumed opportunity cannot replay merely due to a wake");
assert.equal(projectWorldSimulationAutonomousCognitionOpportunities({
  world_state: pureInput.world_state, runtime_context_by_character: {
    aria: { temporal_cues: [{ source_ref: "not-yet-due", due_at: later }] },
  },
}).deferred_opportunity_count, 0, "future cue is not due at committed time");

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "C6-D sleeping Brain deferral and committed wake reentry",
    seed: "cb-c6d-sleep-bridge",
    initial_world_state: initialWorld(),
  }, options);
  const sid = session.world_simulation_session_id;
  const params = { world_simulation_session_id: sid,
    runtime_context_by_character: runtime };
  const old = await getWorldSimulationState(sid, options);
  const oldHistory = await getWorldSimulationHistory(sid, options);
  const paths = worldSimulationStatePaths(sid, options);
  const bytes = () => Promise.all([readFile(paths.state, "utf8"),
    readFile(paths.history, "utf8")]);
  const oldBytes = await bytes();

  const deferred = await scheduleWorldSimulationAutonomousCognitionOpportunities(params, options);
  assert.equal(deferred.scheduler_projection.opportunity_count, 0);
  assert.equal(deferred.scheduler_projection.deferred_opportunity_count, 1);
  assert.equal(deferred.scheduler_projection.deferred_opportunities[0].opportunity_id, stableId);
  let unexpectedBrainCalls = 0;
  const blocked = await dispatchWorldSimulationAutonomousCognitionOpportunities(params, {
    ...options, characterBrain: async () => {
      unexpectedBrainCalls += 1;
      throw new Error("sleeping actor's Brain must never execute a conscious C2 opportunity");
    },
  });
  assert.equal(blocked.dispatch_count, 0);
  assert.deepEqual(blocked.consumed_opportunity_ids, []);
  assert.equal(unexpectedBrainCalls, 0);
  assert.deepEqual(await bytes(), oldBytes, "asleep dispatch may not write World state or history");

  for (const attempt of [
    () => scheduleWorldSimulationAutonomousCognitionOpportunities({
      ...params, simulation_time: later,
    }, options),
    () => dispatchWorldSimulationAutonomousCognitionOpportunities({
      ...params, simulation_time: later,
    }, { ...options, characterBrain: async () => {
      unexpectedBrainCalls += 1;
      throw new Error("a forged future timestamp must not reach Brain");
    } }),
  ]) await assert.rejects(attempt, { code: "C6D_COGNITION_CLOCK_NOT_COMMITTED" });
  assert.equal(unexpectedBrainCalls, 0);
  assert.deepEqual(await bytes(), oldBytes);
  assert.deepEqual(await getWorldSimulationState(sid, options), old);
  assert.deepEqual(await getWorldSimulationHistory(sid, options), oldHistory);
  const futureCueOnly = await scheduleWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id: sid,
    runtime_context_by_character: {
      aria: { temporal_cues: [{ source_ref: "future-only", due_at: later }] },
    },
  }, options);
  assert.equal(futureCueOnly.scheduler_projection.deferred_opportunity_count, 0);

  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (name) => ({
      entity_id: `character_${name}`, canonical_name: name,
      identity_source: "c6d_fixture", formal: true,
    }),
  });
  const turn = await runWorldSimulationTurn({
    world_simulation_session_id: sid,
  }, { ...options, characterRuntimeManager: runtimeManager,
    characterBrain: async packet => packet.character === "keeper"
      ? { action_id: "cb-c6d-keeper-wait" } : "reject_all",
  });
  assert.equal(turn.committed, true);
  const committed = await getWorldSimulationState(sid, options);
  const history = await getWorldSimulationHistory(sid, options);
  assert.equal(committed.revision, old.revision + 1);
  assert.equal(history.turns.length, oldHistory.turns.length + 1);
  assert.equal(history.turns.at(-1).previous_state_hash, old.state_hash);
  assert.equal(history.turns.at(-1).next_state_hash, committed.state_hash);
  const wakeTransitions = history.turns.at(-1).state_transitions.filter(x =>
    x.entity === "aria" && x.field === "physical_state.sleep_arousal");
  assert.equal(wakeTransitions.length, 1, "waking requires an actual World/Body commit");
  assert.equal(wakeTransitions[0].to.condition, "awake");
  assert.equal(committed.state.characters.aria.physical_state.sleep_arousal.condition, "awake");
  assert.deepEqual(committed.state.memories, old.state.memories,
    "an actual wake alone cannot invent a subjective experience or autobiography");

  const resumed = await scheduleWorldSimulationAutonomousCognitionOpportunities({
    ...params, simulation_time: committed.state.simulation_time,
  }, options);
  assert.equal(resumed.scheduler_projection.opportunity_count, 1);
  assert.equal(resumed.scheduler_projection.deferred_opportunity_count, 0);
  assert.equal(resumed.scheduler_projection.opportunities[0].opportunity_id, stableId);
  let reentryCalls = 0;
  const brainPackets = [];
  const dispatched = await dispatchWorldSimulationAutonomousCognitionOpportunities(params, {
    ...options, characterBrain: async packet => {
      reentryCalls += 1;
      brainPackets.push(structuredClone(packet));
      return { disposition: "processed_autonomous_cognition_opportunity" };
    },
  });
  assert.equal(reentryCalls, 1);
  assert.equal(dispatched.dispatch_count, 1);
  assert.deepEqual(dispatched.consumed_opportunity_ids, [stableId]);
  assert.equal(dispatched.durable_cognitive_write_performed, false);
  assert.equal(dispatched.world_mutation_performed, false);
  assert.equal(brainPackets[0].character, "aria");
  assert.equal(brainPackets[0].boundaries.world_truth_exposed, false);
  assert.equal(JSON.stringify(brainPackets[0]).includes(stableId), false,
    "engine-private opportunity identity cannot leak into the waking Brain");
  assert.equal(JSON.stringify(brainPackets[0]).includes("cb-c6d-explicit-wake"), false);
  assert.deepEqual((await getWorldSimulationState(sid, options)).state, committed.state);
  assert.deepEqual(await getWorldSimulationHistory(sid, options), history,
    "read-only conscious reentry must not add World events or memory writes");
  const consumed = await scheduleWorldSimulationAutonomousCognitionOpportunities({
    ...params, consumed_opportunity_ids: dispatched.consumed_opportunity_ids,
  }, options);
  assert.equal(consumed.scheduler_projection.opportunity_count, 0);
  assert.equal(consumed.scheduler_projection.deferred_opportunity_count, 0);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("CB-C6-D Brain reentry: committed sleep defers, true wake resumes once, World clock spoofing rejected.");