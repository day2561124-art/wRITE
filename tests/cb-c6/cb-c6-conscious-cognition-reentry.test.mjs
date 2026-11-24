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
  runWorldSimulationOffscreenCognitionStep,
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
  assert.deepEqual(committed.state.memories?.aria, old.state.memories?.aria,
    "an actual wake alone cannot invent aria's subjective autobiography; real keeper experience remains legal");

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


// C6-F: reentry must preserve subjective evidence well enough to make a
// real goal/plan decision through the existing C2/C3 Native writers.
// The paired offscreen path executes queued events at canonical fidelity;
// this is NOT evidence for a lower-fidelity independent thought generator.
import { runWorldSimulationOffscreenEventBatch } from "../../server/src/world-simulation-offscreen-event-batch-service.mjs";
import { createWorldSimulationResolutionController } from "../../server/src/world-simulation-resolution-controller-service.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveClaims } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { resolveWorldSimulationSubjectiveBeliefs } from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import { buildWorldSimulationSubjectiveBeliefRevisions } from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";

function subjectiveWakeWorld() {
  const sourceTurn = "c6f-prior-subjective-observation";
  const proposition = "我看見計時器上標著四十分鐘。";
  const memory = {
    memory_id: "c6f-prior-observation",
    memory_type: "episodic_direct_perception",
    content: { kind: "visual_observation", description: proposition },
    source: { kind: "direct_perception", sense: "visual" },
    internal_provenance: {
      event_id: "c6f-prior-visual-event", scene_id: "room",
      turn_id: sourceTurn, observation_hash: "c6f-prior-observation-hash",
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true, last_recalled_at: null,
    accessible: true, suppressed: false, possibly_incorrect: false,
    source_confused: false, subjective_memory_not_world_truth: true,
  };
  let state = initialWorld();
  state.memories.aria = [memory];
  const execute = (current, stage, built) => {
    const queue = buildWorldSimulationChronologicalMutationQueue({
      turn_id: sourceTurn + ":" + stage,
      world_state_hash: hashAgentRunValue(current),
      state_transitions: built.result.state_transitions,
      elapsed_ms: 0,
    });
    return executeWorldSimulationChronologicalMutationQueue({
      world_state: current, preview_world_state: built.result.preview_world_state,
      queue, scene_id: "room",
    }).next_world_state;
  };
  const claim = buildWorldSimulationSubjectiveClaims({
    world_state: state, turn_id: sourceTurn,
    source_memory_records: [{ character: "aria", memory_record: memory }],
    claim_proposals: [{
      proposal_ref: "prior_visual_label", character: "aria", proposition,
      evidence: [{ source_memory_ref: memory.memory_id, relation: "supports" }],
    }],
  });
  state = execute(state, "subjective_claim", claim);
  const resolution = resolveWorldSimulationSubjectiveBeliefs({
    world_state: state, turn_id: sourceTurn,
  });
  state = execute(state, "subjective_belief_revision", buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: state, turn_id: sourceTurn, resolution: resolution.result,
  }));
  assert.equal(state.subjective_claim_history.length, 1);
  assert.equal(state.subjective_belief_revision_history.length, 1);
  return state;
}

const pairedRoot = path.join(projectRoot, "tests", ".tmp",
  "cb-c6f-goal-plan-reentry-" + process.pid + "-" + Date.now());
const initialSubjective = subjectiveWakeWorld();
const originalSubjective = structuredClone(initialSubjective);
const pairedResults = [];
try {
  for (const route of ["foreground", "offscreen"]) {
    const opts = { fixtureRoot: path.join(pairedRoot, route) };
    const session = await beginWorldSimulationSession({
      simulation_label: "C6-F subjective goal/plan reentry " + route,
      seed: "c6f-subjective-reentry-" + route,
      initial_world_state: structuredClone(initialSubjective),
    }, opts);
    const sid = session.world_simulation_session_id;
    const params = { world_simulation_session_id: sid,
      runtime_context_by_character: { aria: { idle: true } } };
    const before = await getWorldSimulationState(sid, opts);
    const controller = createWorldSimulationResolutionController(sid, opts);
    const pin = snapshot => ({
      expected_revision: snapshot.revision, expected_state_hash: snapshot.state_hash,
    });
    const initialHistory = await getWorldSimulationHistory(sid, opts);
    assert.equal(controller.getMode(), "foreground");
    if (route === "offscreen") {
      await assert.rejects(controller.switchResolution({
        ...pin(before), expected_state_hash: "wrong", mode: "offscreen",
      }), { code: "C6_RESOLUTION_FRONTIER_CHANGED" });
      assert.equal(controller.getMode(), "foreground");
      const switched = await controller.switchResolution({ ...pin(before), mode: "offscreen" });
      assert.equal(switched.previous_mode, "foreground");
      assert.equal(switched.mode, "offscreen");
      assert.equal(switched.reached_simulation_time, before.state.simulation_time);
      assert.equal(switched.world_mutation_performed, false);
      assert.equal(switched.brain_invoked, false);
      assert.deepEqual(await getWorldSimulationState(sid, opts), before);
      assert.deepEqual(await getWorldSimulationHistory(sid, opts), initialHistory);
    }
    const dispatchForRoute = async (input, options) => {
      const frontier = await getWorldSimulationState(sid, opts);
      const currentMode = controller.getMode();
      const output = await controller.runCognitionStep({
        runtime_context_by_character: input.runtime_context_by_character,
        consumed_opportunity_ids: input.consumed_opportunity_ids,
        ...pin(frontier),
        ...(currentMode === "offscreen" ? { max_opportunities: 1 } : {}),
      }, options);
      assert.equal(output.mode, currentMode);
      const result = output.result;
      if (currentMode === "offscreen") {
        assert.equal(output.execution_path, "bounded_offscreen_cognition");
        assert.equal(result.offscreen_cognition_step, true);
        assert.equal(result.world_time_advanced_by_cognition, false);
        assert.equal(result.offscreen_budget_exhausted, false);
      } else {
        assert.equal(output.execution_path, "foreground_cognition");
      }
      return result;
    };
    if (route === "offscreen") {
      await assert.rejects(runWorldSimulationOffscreenCognitionStep({
        ...params, expected_revision: before.revision,
        expected_state_hash: before.state_hash, max_opportunities: 1,
      }, { ...opts, characterBrain: async () => assert.fail("queued World work takes priority") }),
      { code: "C6_OFFSCREEN_COGNITION_WORLD_WORK_PENDING" });
      assert.deepEqual(await getWorldSimulationState(sid, opts), before);
    }
    const deferred = await scheduleWorldSimulationAutonomousCognitionOpportunities(params, opts);
    assert.equal(deferred.scheduler_projection.opportunity_count, 0);
    assert.equal(deferred.scheduler_projection.deferred_opportunity_count, 1);
    const opportunityId = deferred.scheduler_projection.deferred_opportunities[0].opportunity_id;
    const sleepingDispatch = await dispatchWorldSimulationAutonomousCognitionOpportunities(params, {
      ...opts, characterBrain: async () => assert.fail("sleeping Brain cannot decide a goal"),
    });
    assert.equal(sleepingDispatch.dispatch_count, 0);
    assert.deepEqual(sleepingDispatch.consumed_opportunity_ids, []);
    assert.deepEqual(await getWorldSimulationState(sid, opts), before);

    const turnOpts = { ...opts,
      characterRuntimeManager: createWorldSimulationCharacterRuntimeManager({
        identityResolver: async name => ({
          entity_id: "character_" + name, canonical_name: name,
          identity_source: "c6f_pair_fixture", formal: true,
        }),
      }),
      characterBrain: async packet => {
        assert.equal(packet.character, "keeper",
          "sleeping actor must not receive the ordinary wake turn decision");
        return { action_id: "cb-c6d-keeper-wait" };
      },
    };
    const worldStep = await controller.runWorldStep({
      ...pin(before), max_turns: 1,
      target_horizon: new Date(Date.parse(now) + 500).toISOString(),
    }, turnOpts);
    if (route === "foreground") {
      assert.equal(worldStep.execution_path, "foreground_world_turn");
      assert.equal(worldStep.result.committed, true);
    } else {
      assert.equal(worldStep.execution_path, "bounded_offscreen_world_batch");
      assert.equal(worldStep.result.committed_turn_count, 1);
      assert.equal(worldStep.result.target_horizon_claimed, true);
      assert.equal(worldStep.result.state_reconciliation_required, false);
    }
    const wake = await getWorldSimulationState(sid, opts);
    assert.equal(wake.revision, 1);
    assert.equal(wake.state.simulation_time, new Date(Date.parse(now) + 500).toISOString());
    assert.equal(wake.state.characters.aria.physical_state.sleep_arousal.condition, "awake");
    assert.deepEqual(wake.state.event_queue, []);
    assert.deepEqual(wake.state.memories.aria, before.state.memories.aria);
    assert.deepEqual(wake.state.subjective_claim_history, before.state.subjective_claim_history);
    assert.deepEqual(wake.state.subjective_belief_revision_history, before.state.subjective_belief_revision_history);
    assert.equal(wake.state.characters.aria.current_goal, before.state.characters.aria.current_goal);

    const resumed = await scheduleWorldSimulationAutonomousCognitionOpportunities(params, opts);
    assert.equal(resumed.scheduler_projection.opportunity_count, 1);
    assert.equal(resumed.scheduler_projection.opportunities[0].opportunity_id, opportunityId);
    if (route === "offscreen") {
      const frontier = { ...params, expected_revision: wake.revision,
        expected_state_hash: wake.state_hash, max_opportunities: 0 };
      const noBrain = { ...opts, characterBrain: async () => assert.fail("blocked admission cannot call Brain") };
      const budget = await runWorldSimulationOffscreenCognitionStep(frontier, noBrain);
      assert.equal(budget.offscreen_budget_exhausted, true);
      assert.equal(budget.admitted_opportunity_count, 1);
      assert.equal(budget.dispatch_count, 0);
      assert.deepEqual(budget.consumed_opportunity_ids, []);
      await assert.rejects(runWorldSimulationOffscreenCognitionStep({
        ...frontier, expected_revision: before.revision, max_opportunities: 1,
      }, noBrain), { code: "C6_OFFSCREEN_COGNITION_STATE_CHANGED" });
      await assert.rejects(runWorldSimulationOffscreenCognitionStep({
        ...frontier, max_opportunities: 33,
      }, noBrain), { code: "C6_OFFSCREEN_COGNITION_INVALID" });
      assert.deepEqual(await getWorldSimulationState(sid, opts), wake);
    }
    const summary = [];
    const writeGoal = await dispatchForRoute(params, {
      ...opts, characterBrain: async packet => {
        assert.equal(packet.character, "aria");
        const view = packet.native_goal_decision;
        assert.equal(view.character, "aria");
        assert.equal(view.motivation_basis.length, 1);
        const proposition = view.motivation_basis[0].evidence.proposition;
        assert.equal(proposition, "我看見計時器上標著四十分鐘。");
        assert.equal(view.world_truth_exposed, false);
        assert.equal(view.source_event_ids_exposed, false);
        summary.push({ step: "propose", proposition });
        return {
          goal_context_token: view.context_token,
          goal_intents: [{
            operation: "propose", goal_kind: "achieve_state", domain: "inquiry",
            target_descriptor: { label: "查證計時器實際上限" },
            motivation_basis_tokens: [view.motivation_basis[0].source_token],
            motivation_relations: ["supports"],
          }],
        };
      },
    });
    assert.equal(writeGoal.dispatch_count, 1);
    assert.equal(writeGoal.durable_cognitive_write_performed, true);
    assert.equal(writeGoal.action_selection_performed, false);
    assert.deepEqual(writeGoal.consumed_opportunity_ids, [opportunityId]);
    assert.equal((await scheduleWorldSimulationAutonomousCognitionOpportunities(params, opts))
      .scheduler_projection.opportunity_count, 0,
      "persisted goal receipt must suppress the original pre-wake opportunity");

    const adoption = { world_simulation_session_id: sid,
      runtime_context_by_character: { aria: { pending_internal_cues: [{
        kind: "memory_reactivation", source_ref: "c6f-goal-adoption-review",
      }] } } };
    const adoptGoal = await dispatchForRoute(adoption, {
      ...opts, characterBrain: async packet => {
        const view = packet.native_goal_decision;
        assert.equal(packet.character, "aria");
        assert.equal(view.existing_goals.length, 1);
        assert.equal(view.existing_goals[0].state, "proposed");
        summary.push({ step: "commit", state: view.existing_goals[0].state });
        return { goal_context_token: view.context_token,
          goal_intents: [{ operation: "commit", goal_token: view.existing_goals[0].goal_token }] };
      },
    });
    assert.equal(adoptGoal.dispatch_count, 1);
    assert.equal(adoptGoal.durable_cognitive_write_performed, true);

    const planParams = { world_simulation_session_id: sid,
      runtime_context_by_character: { aria: { pending_internal_cues: [{
        kind: "memory_reactivation", source_ref: "c6f-plan-from-committed-goal",
      }] } } };
    const plan = await dispatchForRoute(planParams, {
      ...opts, characterBrain: async packet => {
        const view = packet.native_plan_decision;
        assert.equal(packet.character, "aria");
        assert.equal(view.prior_turn_committed_goal_only, true);
        assert.equal(view.world_truth_exposed, false);
        assert.equal(view.committed_goals.length, 1);
        const label = view.committed_goals[0].target_descriptor.label;
        assert.equal(label, "查證計時器實際上限");
        summary.push({ step: "plan", goal: label });
        return { plan_context_token: view.context_token,
          plan_intents: [{
            goal_token: view.committed_goals[0].goal_token,
            cue_descriptor: { cue_kind: "opportunity", label: "timer_doubt_requires_verification" },
            response_descriptor: { response_kind: "seek_support", label: "ask_trusted_ally" },
          }] };
      },
    });
    assert.equal(plan.dispatch_count, 1);
    assert.equal(plan.durable_cognitive_write_performed, true);
    assert.equal(plan.action_selection_performed, false);
    const end = await getWorldSimulationState(sid, opts);
    const history = await getWorldSimulationHistory(sid, opts);
    assert.equal(end.revision, 4);
    assert.equal(end.state.simulation_time, wake.state.simulation_time);
    assert.deepEqual(end.state.memories.aria, wake.state.memories.aria);
    assert.deepEqual(end.state.subjective_claim_history, wake.state.subjective_claim_history);
    assert.deepEqual(end.state.subjective_belief_revision_history, wake.state.subjective_belief_revision_history);
    const goalEvents = Object.values(end.state.motivational_goal_events ?? {});
    assert.equal(goalEvents.length, 2);
    assert.deepEqual(goalEvents.map(item => item.operation).sort(), ["commit", "propose"]);
    assert.equal(new Set(goalEvents.map(item => item.goal_id)).size, 1);
    assert.equal(end.state.goal_implementation_intention_history.length, 1);
    assert.equal(history.turns.length, 4);
    let prior = before.state_hash;
    for (const turn of history.turns) {
      assert.equal(turn.previous_state_hash, prior);
      prior = turn.next_state_hash;
    }
    assert.equal(prior, end.state_hash);
    for (const turn of history.turns.slice(1)) {
      assert.equal(turn.event, null);
      assert.deepEqual(turn.selected_action_intents, []);
      assert.deepEqual(turn.action_outcomes, []);
    }
    const paths = worldSimulationStatePaths(sid, opts);
    const bytes = await Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
    // Promote the same session from offscreen to foreground. Neither mode
    // selection nor read-only reentry may invent autobiographical history.
    if (route === "offscreen") {
      const promoted = await controller.switchResolution({ ...pin(end), mode: "foreground" });
      assert.equal(promoted.previous_mode, "offscreen");
      assert.equal(promoted.mode, "foreground");
      assert.equal(promoted.reached_simulation_time, end.state.simulation_time);
      assert.equal(promoted.world_mutation_performed, false);
      assert.equal(promoted.brain_invoked, false);
      assert.deepEqual(await Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]), bytes);
    }
    // No caller-supplied consumed IDs. Actual committed goal and plan
    // receipts must survive the transition back to foreground execution.
    for (const input of [adoption, planParams]) {
      const replay = await dispatchForRoute(input, {
        ...opts, characterBrain: async () => assert.fail("committed cognitive operation cannot replay"),
      });
      assert.equal(replay.dispatch_count, 0);
    }
    assert.deepEqual(await Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]), bytes);
    assert.deepEqual(await getWorldSimulationHistory(sid, opts), history);
    pairedResults.push({
      simulation_time: end.state.simulation_time,
      memory: end.state.memories.aria,
      claims: end.state.subjective_claim_history,
      beliefs: end.state.subjective_belief_revision_history,
      body: end.state.characters.aria.physical_state,
      goal_operations: goalEvents.map(item => item.operation).sort(),
      plan_count: end.state.goal_implementation_intention_history.length,
      decisions: summary,
    });
  }
  assert.deepEqual(pairedResults[0], pairedResults[1],
    "canonical foreground and queued offscreen wake must preserve the same subjective evidence and goal/plan decisions");
  assert.deepEqual(initialSubjective, originalSubjective, "paired simulation must not mutate initial input");
} finally {
  await rm(pairedRoot, { recursive: true, force: true });
}
console.log("CB-C6-F paired subjective wake reentry: memory/claim/belief provenance, goal adoption, plan and durable replay PASS.");

console.log("CB-C6 quiet frontier: explicit offscreen cognition, bounded admission, stale frontier rejection and canonical goal/plan replay PASS.");
console.log("CB-C6 resolution controller: foreground/offscreen execution selection, exact frontier, committed cognition, and read-only promotion PASS.");

const quietRoot = path.join(projectRoot, "tests", ".tmp",
  "cb-c6-quiet-sleep-" + process.pid + "-" + Date.now());
const quietOptions = { fixtureRoot: quietRoot };
try {
  const quiet = initialWorld();
  quiet.event_queue = [];
  const session = await beginWorldSimulationSession({
    simulation_label: "C6 quiet frontier asleep and independent awake actor",
    seed: "c6-quiet-sleep",
    initial_world_state: quiet,
  }, quietOptions);
  const sid = session.world_simulation_session_id;
  const before = await getWorldSimulationState(sid, quietOptions);
  const frontier = { world_simulation_session_id: sid,
    expected_revision: before.revision, expected_state_hash: before.state_hash,
    max_opportunities: 1 };
  const noBrain = { ...quietOptions, characterBrain: async () => assert.fail("no admitted Brain work") };
  const asleep = await runWorldSimulationOffscreenCognitionStep({
    ...frontier, runtime_context_by_character: { aria: { idle: true } },
  }, noBrain);
  assert.equal(asleep.admitted_opportunity_count, 0);
  assert.equal(asleep.deferred_opportunity_count, 1);
  assert.equal(asleep.dispatch_count, 0);
  assert.deepEqual(asleep.consumed_opportunity_ids, []);
  const context = { aria: { idle: true }, keeper: { temporal_cues: [{
    source_ref: "keeper-prior-cue", due_at: now,
  }] } };
  const seen = [];
  const independent = await runWorldSimulationOffscreenCognitionStep({
    ...frontier, runtime_context_by_character: context,
  }, { ...quietOptions, characterBrain: async packet => {
    seen.push(packet.character);
    return { disposition: "processed_autonomous_cognition_opportunity" };
  } });
  assert.deepEqual(seen, ["keeper"]);
  assert.equal(independent.admitted_opportunity_count, 1);
  assert.equal(independent.deferred_opportunity_count, 1);
  assert.equal(independent.dispatch_count, 1);
  assert.equal(independent.durable_cognitive_write_performed, false);
  assert.equal(independent.read_only_consumption_requires_caller_receipt, true);
  const replay = await runWorldSimulationOffscreenCognitionStep({
    ...frontier, runtime_context_by_character: context,
    consumed_opportunity_ids: independent.consumed_opportunity_ids,
  }, noBrain);
  assert.equal(replay.dispatch_count, 0);
  assert.equal(replay.deferred_opportunity_count, 1);
  assert.deepEqual(await getWorldSimulationState(sid, quietOptions), before);
  assert.equal((await getWorldSimulationHistory(sid, quietOptions)).turns.length, 0);
} finally {
  await rm(quietRoot, { recursive: true, force: true });
}
console.log("CB-C6 quiet frontier sleep: awake actor independent, sleeping cue retained, read-only receipt replay suppressed PASS.");


// The entire C2 goal/plan transaction is speculative until its authoritative
// writer commits. A later participant's failed ingress must never issue a
// consumed receipt for an earlier participant's still-uncommitted intention.
const abortRoot = path.join(projectRoot, "tests", ".tmp",
  "cb-c6-abort-" + process.pid + "-" + Date.now());
try {
  for (const intentKind of ["goal", "plan"]) {
    for (const fault of ["incomplete", "duplicate"]) {
      const opts = { fixtureRoot: path.join(abortRoot, intentKind, fault) };
      const initial = subjectiveWakeWorld();
      initial.event_queue = [];
      initial.characters.aria.physical_state.sleep_arousal = sleepRecord("awake");
      const session = await beginWorldSimulationSession({
        simulation_label: "C6 aborted speculative " + intentKind + " " + fault,
        seed: "c6-abort-" + intentKind + "-" + fault,
        initial_world_state: initial,
      }, opts);
      const sid = session.world_simulation_session_id;
      const proposeGoal = packet => {
        const view = packet.native_goal_decision;
        assert.equal(packet.character, "aria");
        assert.equal(view.motivation_basis.length, 1);
        return { goal_context_token: view.context_token, goal_intents: [{
          operation: "propose", goal_kind: "achieve_state", domain: "inquiry",
          target_descriptor: { label: "查證計時器實際上限" },
          motivation_basis_tokens: [view.motivation_basis[0].source_token],
          motivation_relations: ["supports"],
        }] };
      };
      if (intentKind === "plan") {
        // Establish the prior goal through the same Native writer, rather
        // than manufacturing a committed goal or weakening source validation.
        const proposed = await dispatchWorldSimulationAutonomousCognitionOpportunities({
          world_simulation_session_id: sid,
          runtime_context_by_character: { aria: { idle: true } },
        }, { ...opts, characterBrain: proposeGoal });
        assert.equal(proposed.durable_cognitive_write_performed, true);
        const adopted = await dispatchWorldSimulationAutonomousCognitionOpportunities({
          world_simulation_session_id: sid,
          runtime_context_by_character: { aria: { pending_internal_cues: [{
            kind: "memory_reactivation", source_ref: "abort-fixture-adopt-goal",
          }] } },
        }, { ...opts, characterBrain: async packet => {
          const view = packet.native_goal_decision;
          assert.equal(view.existing_goals.length, 1);
          return { goal_context_token: view.context_token, goal_intents: [{
            operation: "commit", goal_token: view.existing_goals[0].goal_token,
          }] };
        } });
        assert.equal(adopted.durable_cognitive_write_performed, true);
      }
      const before = await getWorldSimulationState(sid, opts);
      const historyBefore = await getWorldSimulationHistory(sid, opts);
      const paths = worldSimulationStatePaths(sid, opts);
      const bytes = () => Promise.all([readFile(paths.state, "utf8"), readFile(paths.history, "utf8")]);
      const originalBytes = await bytes();
      const input = {
        world_simulation_session_id: sid,
        expected_revision: before.revision,
        expected_state_hash: before.state_hash,
        max_opportunities: 2,
        runtime_context_by_character: {
          aria: { pending_internal_cues: [{
            kind: "memory_reactivation", source_ref: "abort-aria-" + intentKind,
          }] },
          keeper: { temporal_cues: [{ source_ref: "abort-keeper-cue", due_at: now }] },
        },
      };
      const schedulerInput = {
        world_simulation_session_id: sid,
        runtime_context_by_character: input.runtime_context_by_character,
      };
      const initialSchedule = await scheduleWorldSimulationAutonomousCognitionOpportunities(schedulerInput, opts);
      const expected = initialSchedule.scheduler_projection.opportunities;
      assert.deepEqual(expected.map(row => row.character), ["aria", "keeper"]);
      const expectedIds = expected.map(row => row.opportunity_id);
      const seen = [];
      const decide = async packet => {
        seen.push(packet.character);
        if (packet.character === "keeper") return { disposition: "processed_autonomous_cognition_opportunity" };
        if (intentKind === "goal") return proposeGoal(packet);
        const view = packet.native_plan_decision;
        assert.equal(view.committed_goals.length, 1);
        assert.equal(view.committed_goals[0].target_descriptor.label, "查證計時器實際上限");
        return { plan_context_token: view.context_token, plan_intents: [{
          goal_token: view.committed_goals[0].goal_token,
          cue_descriptor: { cue_kind: "opportunity", label: "timer_doubt_requires_verification" },
          response_descriptor: { response_kind: "seek_support", label: "ask_trusted_ally" },
        }] };
      };
      const brokenRuntime = {
        inspectRuntime: async () => ({ current_mind: { character_facing_view: {} } }),
        runCharacterTurn: async ({ character, brain_input, characterBrain }) => {
          if (character === "aria") return characterBrain(brain_input);
          if (fault === "incomplete") return {};
          await characterBrain(brain_input);
          try { await characterBrain(brain_input); } catch { return {}; }
        },
      };
      let failed;
      await assert.rejects(runWorldSimulationOffscreenCognitionStep(input, {
        ...opts, characterRuntimeManager: brokenRuntime, characterBrain: decide,
      }), error => {
        failed = error;
        assert.equal(error.code, fault === "incomplete"
          ? "C6D_CONSCIOUS_COGNITION_CALLBACK_NOT_COMPLETED"
          : "C6D_CONSCIOUS_COGNITION_DUPLICATE_INVOCATION");
        assert.equal(error.failed_opportunity_id, expectedIds[1]);
        assert.deepEqual(error.consumed_opportunity_ids, [],
          "a failed speculative transaction has no consumed opportunities");
        return true;
      });
      assert.deepEqual(seen, fault === "incomplete" ? ["aria"] : ["aria", "keeper"]);
      assert.deepEqual(await bytes(), originalBytes);
      assert.deepEqual(await getWorldSimulationState(sid, opts), before);
      assert.deepEqual(await getWorldSimulationHistory(sid, opts), historyBefore);
      const retryInput = { ...input, consumed_opportunity_ids: failed.consumed_opportunity_ids };
      const retrySchedule = await scheduleWorldSimulationAutonomousCognitionOpportunities({
        ...schedulerInput, consumed_opportunity_ids: failed.consumed_opportunity_ids,
      }, opts);
      assert.deepEqual(retrySchedule.scheduler_projection.opportunities, expected);
      seen.length = 0;
      const retried = await runWorldSimulationOffscreenCognitionStep(retryInput, {
        ...opts, characterBrain: decide,
      });
      assert.deepEqual(seen, ["aria", "keeper"]);
      assert.equal(retried.dispatch_count, 2);
      assert.equal(retried.durable_cognitive_write_performed, true);
      assert.deepEqual(retried.consumed_opportunity_ids, expectedIds);
      const after = await getWorldSimulationState(sid, opts);
      const history = await getWorldSimulationHistory(sid, opts);
      assert.equal(after.revision, before.revision + 1);
      assert.equal(history.turns.length, historyBefore.turns.length + 1);
      assert.equal(history.turns.at(-1).previous_state_hash, before.state_hash);
      assert.equal(history.turns.at(-1).next_state_hash, after.state_hash);
      assert.equal(history.turns.at(-1).event, null);
      assert.equal(after.state.simulation_time, before.state.simulation_time);
      assert.deepEqual(after.state.memories, before.state.memories);
      const field = intentKind === "goal"
        ? "motivational_goal_history" : "goal_implementation_intention_history";
      assert.equal(after.state[field].length, (before.state[field] ?? []).length + 1);
      const savedBytes = await bytes();
      const replay = await runWorldSimulationOffscreenCognitionStep({
        ...input, expected_revision: after.revision, expected_state_hash: after.state_hash,
      }, { ...opts, characterBrain: async () => assert.fail("committed receipt must suppress replay") });
      assert.equal(replay.dispatch_count, 0);
      assert.deepEqual(await bytes(), savedBytes);
      console.log("CB-C6 aborted " + intentKind + "/" + fault + ": pending opportunities retained, retry commits once, durable replay suppressed PASS.");
    }
  }
} finally {
  await rm(abortRoot, { recursive: true, force: true });
}
