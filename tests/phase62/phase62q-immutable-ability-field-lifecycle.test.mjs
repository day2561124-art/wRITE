import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCausalRuleContract } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  evaluateWorldSimulationAbilityFieldLifecycle,
  evaluateWorldSimulationAbilityFieldSpawn,
  projectWorldSimulationImmutableAbilityFieldLifecycleProposals,
  worldSimulationImmutableAbilityFieldLifecycleVersion,
} from "../../server/src/world-simulation-immutable-ability-field-lifecycle-service.mjs";
import { runWorldSimulationTurn as runWorldSimulationTurnRuntime } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62q-ability-field-lifecycle-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };

let testHarnessEventId = null;
async function runWorldSimulationTurn(input, runtimeOptions) {
  const sessionId = input?.world_simulation_session_id ?? null;
  const harnessState = sessionId
    ? await getWorldSimulationState(sessionId, runtimeOptions)
    : null;
  testHarnessEventId = input?.event_id
    ?? harnessState?.state?.event_queue?.[0]?.event_id
    ?? null;
  try {
    return await runWorldSimulationTurnRuntime(input, runtimeOptions);
  } finally {
    testHarnessEventId = null;
  }
}
await rm(fixtureRoot, { recursive: true, force: true });

const owner = "場域術者";
const target = "場域測試員";
const sceneId = "ability-field-lifecycle-lab";

function fieldState(id, extra = {}) {
  return {
    field_id: id,
    owner,
    ability_id: "pulse_field",
    source_action_id: "create-pulse-field",
    scene_id: sceneId,
    center: { x: 2, y: 2 },
    radius_m: 1,
    remaining_ms: 250,
    active: true,
    affects_owner: false,
    effect: {
      damage_per_second: 20,
      damage_type: "fixture_field",
      penetration: 0,
      ignore_armor: true,
    },
    start_delay_ms: 0,
    ...extra,
  };
}

const initialWorldState = {
  simulation_time: "2026-08-24T23:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    passive_action_seconds: 0.5,
    physics_action_seconds: 0.5,
    ability_field_tick_ms: 100,
  },
  event_queue: [
    { event_id: "evt-field-create", scene_id: sceneId, participants: [owner] },
    { event_id: "evt-field-expire", scene_id: sceneId, participants: [target] },
  ],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 6, depth_m: 6 },
      entity_positions: {
        [owner]: { x: 2, y: 2 },
        [target]: { x: 2.5, y: 2 },
      },
      obstacles: [],
      observable_by: {
        [owner]: { visual: ["場域生命週期測試區"] },
        [target]: { visual: ["場域生命週期測試區"] },
      },
    },
  },
  characters: {
    [owner]: {
      physical_state: { health_current: 100, health_max: 100, energy_current: 100 },
      abilities: {
        pulse_field: {
          enabled: true,
          available: true,
          energy_cost: 10,
          field: {
            radius_m: 1,
            duration_ms: 700,
            damage_per_second: 20,
            damage_type: "fixture_field",
            ignore_armor: true,
          },
        },
      },
    },
    [target]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: { [owner]: [], [target]: [] },
  objects: {},
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [owner]: [{
      action_id: "create-pulse-field",
      intent: "建立測試場域",
      duration_ms: 500,
      ability: { ability_id: "pulse_field", center: { x: 2, y: 2 } },
    }],
    [target]: [{ action_id: "wait-field-expiration", intent: "留在場域內等待", duration_ms: 500 }],
  },
};

function actionFor(eventId, character) {
  if (eventId === "evt-field-create" && character === owner) return "create-pulse-field";
  if (eventId === "evt-field-expire" && character === target) return "wait-field-expiration";
  return "reject_all";
}

try {
  const contract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.immutable_ability_field_lifecycle.version, worldSimulationImmutableAbilityFieldLifecycleVersion);
  assert.deepEqual(contract.immutable_ability_field_lifecycle.migrated_lifecycle_evaluators, [
    "ability_field_spawn",
    "ability_field_lifecycle_advance",
  ]);

  const directField = fieldState("field_direct");
  const directBefore = JSON.stringify(directField);
  const spawn = evaluateWorldSimulationAbilityFieldSpawn({
    field_id: "field_direct",
    field: directField,
    existing_field: null,
    time_ms: 50,
  });
  assert.equal(spawn.result.ok, true);
  assert.equal(spawn.audit.input_context_immutable, true);
  assert.equal(spawn.audit.deterministic_replay_verified, true);
  assert.equal(spawn.audit.evaluator_output_contains_world_state, false);
  assert.equal(JSON.stringify(directField), directBefore);

  const spawnProjection = projectWorldSimulationImmutableAbilityFieldLifecycleProposals({
    world_state: { scenes: initialWorldState.scenes, ability_fields: {} },
    mutation_proposals: spawn.mutation_proposals,
    scene_id: sceneId,
    elapsed_ms: 50,
  });
  assert.equal(spawnProjection.projected_world_state.ability_fields.field_direct.remaining_ms, 250);

  const lifecycleInput = spawn.result.field_after;
  const lifecycleBefore = JSON.stringify(lifecycleInput);
  const lifecycle = evaluateWorldSimulationAbilityFieldLifecycle({
    field: lifecycleInput,
    start_ms: 50,
    elapsed_ms: 250,
    default_tick_ms: 100,
  });
  assert.equal(lifecycle.result.ok, true);
  assert.equal(lifecycle.result.active_ms, 200);
  assert.equal(lifecycle.result.remaining_ms_after, 50);
  assert.equal(lifecycle.result.active_after, true);
  assert.deepEqual(lifecycle.result.tick_windows, [
    { tick_index: 1, tick_start_ms: 50, tick_end_ms: 150 },
    { tick_index: 2, tick_start_ms: 150, tick_end_ms: 250 },
  ]);
  assert.equal(JSON.stringify(lifecycleInput), lifecycleBefore);

  const expiration = evaluateWorldSimulationAbilityFieldLifecycle({
    field: fieldState("field_expire", { remaining_ms: 200 }),
    start_ms: 0,
    elapsed_ms: 500,
    default_tick_ms: 100,
  });
  assert.equal(expiration.result.ok, true);
  assert.equal(expiration.result.remaining_ms_after, 0);
  assert.equal(expiration.result.active_after, false);
  assert.equal(expiration.result.termination_reason, "duration_expired");
  assert.equal(expiration.result.tick_windows.length, 2);

  for (const evaluation of [spawn, lifecycle, expiration]) {
    assert.equal(evaluation.audit.input_context_immutable, true);
    assert.equal(evaluation.audit.deterministic_replay_verified, true);
    assert.equal(evaluation.audit.evaluator_output_contains_world_state, false);
  }

  const session = await beginWorldSimulationSession({
    source_text: "Phase62Q immutable ability field lifecycle fixture",
    characters: [owner, target],
    initial_world_state: initialWorldState,
  }, options);
  const characterBrain = async (packet) => ({ action_id: actionFor(testHarnessEventId, packet.character) });

  const createTurn = await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  assert.equal(createTurn.ok, true);
  let state = await getWorldSimulationState(session.world_simulation_session_id, options);
  let field = Object.values(state.state.ability_fields).find((item) => item.ability_id === "pulse_field");
  assert.ok(field);
  assert.equal(field.active, true);
  assert.equal(field.remaining_ms, 200);
  assert.equal(state.state.characters[owner].physical_state.energy_current, 90);
  assert.equal(state.state.characters[target].physical_state.health_current, 90);

  const expireTurn = await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  assert.equal(expireTurn.ok, true);
  state = await getWorldSimulationState(session.world_simulation_session_id, options);
  field = Object.values(state.state.ability_fields).find((item) => item.ability_id === "pulse_field");
  assert.equal(field.active, false);
  assert.equal(field.remaining_ms, 0);
  assert.equal(field.termination_reason, "duration_expired");
  assert.equal(state.state.characters[target].physical_state.health_current, 86);

  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  assert.equal(state.revision, 2);
  assert.equal(history.turns.length, 2);
  const lifecycleHistory = history.turns.map((turn) => turn.immutable_ability_field_lifecycle);
  assert.ok(lifecycleHistory.every(Boolean));
  assert.ok(lifecycleHistory[0].audit_count >= 2);
  assert.ok(lifecycleHistory[1].audit_count >= 1);
  assert.equal(lifecycleHistory.every((item) => item.evaluator_inputs_immutable === true), true);
  assert.equal(lifecycleHistory.every((item) => item.evaluator_outputs_contain_world_state === false), true);
  assert.equal(lifecycleHistory.every((item) => item.deterministic_replay_verified === true), true);
  const evaluatorNames = new Set(lifecycleHistory.flatMap((item) => item.audits.map((audit) => audit.evaluator)));
  assert.equal(evaluatorNames.has("ability_field_spawn"), true);
  assert.equal(evaluatorNames.has("ability_field_lifecycle_advance"), true);
  const fieldTicks = history.turns.flatMap((turn) => turn.action_outcomes).filter((item) => item.result === "ability_field_tick" && item.target === target);
  assert.equal(fieldTicks.length, 7);

  console.log(JSON.stringify({
    immutable_ability_field_lifecycle_version: worldSimulationImmutableAbilityFieldLifecycleVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_ability_field_lifecycle_audit_count: lifecycleHistory.reduce((sum, item) => sum + item.audit_count, 0),
    field_tick_count: fieldTicks.length,
    target_health_after_field_expiration: state.state.characters[target].physical_state.health_current,
    field_expired: field.termination_reason === "duration_expired",
    deterministic_replay_verified: lifecycleHistory.every((item) => item.deterministic_replay_verified === true),
    evaluator_outputs_contain_world_state: lifecycleHistory.some((item) => item.evaluator_outputs_contain_world_state === true),
    character_brain_decides_ability_field_lifecycle_mutation_values: false,
  }));
  console.log("Phase62Q immutable ability field lifecycle test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
