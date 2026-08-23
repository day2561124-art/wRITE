import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  evaluateWorldSimulationBarrierCapacity,
  evaluateWorldSimulationCombatInjury,
} from "../../server/src/world-simulation-combat-causal-service.mjs";
import {
  buildWorldSimulationImmutableCausalEvaluatorContract,
  projectWorldSimulationImmutableEvaluatorProposals,
  runWorldSimulationImmutableCausalEvaluator,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "../../server/src/world-simulation-immutable-causal-evaluator-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62n-immutable-evaluator-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const attacker = "不可變攻擊者";
const target = "不可變防禦者";
const sceneId = "immutable-evaluator-lab";

const initialWorldState = {
  simulation_time: "2026-08-24T20:00:00.000Z",
  world_rules: {
    combat_target_radius_m: 0.25,
    default_attack_range_m: 1.5,
    severe_injury_ratio: 0.25,
    critical_injury_ratio: 0.4,
  },
  event_queue: [{ event_id: "evt-immutable-evaluator", scene_id: sceneId, participants: [attacker, target] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      dimensions: { width_m: 8, depth_m: 4 },
      entity_positions: {
        [attacker]: { x: 1, y: 1 },
        [target]: { x: 2, y: 1 },
      },
      obstacles: [],
      observable_by: {
        [attacker]: { visual: ["目標在近距離"] },
        [target]: { visual: ["攻擊者正在接近"] },
      },
    },
  },
  characters: {
    [attacker]: { physical_state: { health_current: 100, health_max: 100 } },
    [target]: {
      abilities: {
        ward: {
          enabled: true,
          available: true,
          capacity_remaining: 10,
          absorption_per_hit: 10,
        },
      },
      physical_state: { health_current: 100, health_max: 100 },
    },
  },
  memories: { [attacker]: [], [target]: [] },
  objects: {
    blade: {
      holder: attacker,
      enabled: true,
      state: "ready",
      combat: { range_m: 1.5, base_damage: 30, damage_type: "training_impact", penetration: 0 },
    },
  },
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [attacker]: [{
      action_id: "immutable-strike",
      intent: "揮擊",
      duration_ms: 500,
      attack: {
        target_character: target,
        weapon_id: "blade",
        windup_ms: 100,
        active_ms: 200,
        recovery_ms: 200,
      },
    }],
    [target]: [{
      action_id: "immutable-ward",
      intent: "展開屏障",
      duration_ms: 500,
      defense: { type: "barrier", ability_id: "ward", start_ms: 0, active_ms: 500 },
    }],
  },
};

async function characterBrain(packet) {
  return { action_id: packet.character === attacker ? "immutable-strike" : "immutable-ward" };
}

try {
  const contract = buildWorldSimulationImmutableCausalEvaluatorContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.version, worldSimulationImmutableCausalEvaluatorVersion);
  assert.equal(causalContract.immutable_causal_evaluators.version, contract.version);
  assert.deepEqual(contract.migrated_effect_evaluators, ["combat_injury", "barrier_capacity_depletion"]);
  assert.equal(contract.evaluator_contract.receives_frozen_cloned_context, true);
  assert.equal(contract.evaluator_contract.may_return_world_state, false);
  assert.equal(contract.evaluator_contract.deterministic_replay_checked_for_identical_input, true);

  const directState = structuredClone(initialWorldState);
  const directStateBefore = JSON.stringify(directState);
  const injury = evaluateWorldSimulationCombatInjury({
    world_state: directState,
    target,
    hit_region: "torso",
    damage: 30,
    damage_type: "training_impact",
    source: "direct-evaluator-test",
    time_ms: 125,
    source_layer: "combat",
  });
  assert.equal(JSON.stringify(directState), directStateBefore);
  assert.equal(injury.audit.input_context_immutable, true);
  assert.equal(injury.audit.deterministic_replay_verified, true);
  assert.equal(injury.audit.evaluator_output_contains_world_state, false);
  assert.equal(injury.result.healthBefore, 100);
  assert.equal(injury.result.healthAfter, 70);
  assert.equal(Object.hasOwn(injury.result, "next_world_state"), false);
  assert.ok(injury.mutation_proposals.length >= 4);

  const injuryProjection = projectWorldSimulationImmutableEvaluatorProposals({
    world_state: directState,
    mutation_proposals: injury.mutation_proposals,
    elapsed_ms: 125,
  });
  assert.equal(injuryProjection.projected_world_state.characters[target].physical_state.health_current, 70);
  assert.equal(directState.characters[target].physical_state.health_current, 100);

  const barrier = evaluateWorldSimulationBarrierCapacity({
    world_state: directState,
    target,
    defense: { valid: true, abilityId: "ward" },
    used_absorption: 10,
    cause: "direct barrier depletion",
    time_ms: 100,
  });
  assert.equal(barrier.result.capacity_before, 10);
  assert.equal(barrier.result.capacity_after, 0);
  assert.equal(barrier.mutation_proposals.length, 1);
  assert.equal(directState.characters[target].abilities.ward.capacity_remaining, 10);

  assert.throws(() => runWorldSimulationImmutableCausalEvaluator({
    evaluator: "forbidden-world-state-return",
    context: { value: 1 },
    evaluate: () => ({ world_state: { illicit: true }, mutation_proposals: [] }),
  }), (error) => error?.code === "WORLD_SIMULATION_IMMUTABLE_EVALUATOR_WORLD_STATE_FORBIDDEN");

  let toggle = false;
  assert.throws(() => runWorldSimulationImmutableCausalEvaluator({
    evaluator: "nondeterministic-fixture",
    context: { value: 1 },
    evaluate: () => {
      toggle = !toggle;
      return { mutation_proposals: [], value: toggle };
    },
  }), (error) => error?.code === "WORLD_SIMULATION_CAUSAL_EVALUATOR_NONDETERMINISTIC");

  const session = await beginWorldSimulationSession({
    source_text: "Phase62N immutable causal evaluator fixture",
    characters: [attacker, target],
    initial_world_state: initialWorldState,
  }, options);
  await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const immutable = history.turns[0].immutable_causal_evaluators;

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.equal(state.state.characters[target].abilities.ward.capacity_remaining, 0);
  assert.equal(state.state.characters[target].physical_state.health_current, 80);
  assert.ok(immutable);
  assert.equal(immutable.version, worldSimulationImmutableCausalEvaluatorVersion);
  assert.equal(immutable.audit_count, 2);
  assert.equal(immutable.evaluator_inputs_immutable, true);
  assert.equal(immutable.evaluator_outputs_contain_world_state, false);
  assert.equal(immutable.deterministic_replay_verified, true);
  assert.deepEqual(immutable.audits.map((audit) => audit.evaluator).sort(), ["barrier_capacity_depletion", "combat_injury"]);

  console.log(JSON.stringify({
    immutable_causal_evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    immutable_evaluator_audit_count: immutable.audit_count,
    barrier_capacity_after: state.state.characters[target].abilities.ward.capacity_remaining,
    target_health_after: state.state.characters[target].physical_state.health_current,
    direct_input_unchanged: JSON.stringify(directState) === directStateBefore,
    deterministic_replay_verified: immutable.deterministic_replay_verified,
    evaluator_outputs_contain_world_state: immutable.evaluator_outputs_contain_world_state,
    character_brain_decides_mutation_values: false,
  }));
  console.log("Phase62N immutable causal effect evaluator test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
