import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCausalRuleContract } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  arbitrateWorldSimulationCrossLayerEventCandidates,
  buildWorldSimulationCrossLayerEventArbitrationContract,
  worldSimulationCrossLayerEventArbitrationVersion,
} from "../../server/src/world-simulation-cross-layer-event-arbitration-service.mjs";
import {
  arbitrateWorldSimulationGlobalTimeline,
  buildWorldSimulationGlobalCausalTimelineContract,
} from "../../server/src/world-simulation-global-causal-timeline-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62t-cross-layer-arbitration-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const contract = buildWorldSimulationCrossLayerEventArbitrationContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  const timelineContract = buildWorldSimulationGlobalCausalTimelineContract();
  assert.equal(contract.version, worldSimulationCrossLayerEventArbitrationVersion);
  assert.equal(causalContract.cross_layer_event_arbitration.version, worldSimulationCrossLayerEventArbitrationVersion);
  assert.equal(timelineContract.cross_layer_event_arbitration.version, worldSimulationCrossLayerEventArbitrationVersion);
  assert.equal(contract.batch_contract.same_timestamp_cross_layer_members_are_simultaneous, true);
  assert.equal(contract.batch_contract.stable_member_order_is_replay_only_not_causal_precedence, true);
  assert.equal(contract.batch_contract.strict_earlier_batch_may_preempt_later_execution, true);
  assert.equal(contract.batch_contract.same_batch_incapacitation_does_not_retroactively_preempt_peer_execution, true);
  assert.equal(contract.may_return_world_state, false);
  assert.equal(contract.may_return_mutation_proposals, false);

  const directCandidates = [
    {
      candidate_id: "ability-100",
      source_layer: "continuous_physics",
      role: "execution",
      kind: "ability_activation",
      subject_id: "能力者",
      action_id: "ability-action",
      time_ms: 100,
      observation: { kind: "ability_activation", actor: "能力者", action_id: "ability-action", time_ms: 100 },
    },
    {
      candidate_id: "fatal-90",
      source_layer: "continuous_physics",
      role: "incapacitation",
      kind: "incapacitation",
      subject_id: "近戰者",
      time_ms: 90,
      observation: { kind: "incapacitation", target: "近戰者", time_ms: 90, source_layer: "continuous_physics" },
    },
    {
      candidate_id: "melee-100",
      source_layer: "combat",
      role: "execution",
      kind: "melee_contact",
      subject_id: "近戰者",
      action_id: "melee-action",
      time_ms: 100,
      observation: { kind: "melee_contact", actor: "近戰者", action_id: "melee-action", time_ms: 100 },
    },
    {
      candidate_id: "projectile-100",
      source_layer: "continuous_physics",
      role: "execution",
      kind: "projectile_launch",
      subject_id: "射手",
      action_id: "projectile-action",
      time_ms: 100,
      observation: { kind: "projectile_launch", actor: "射手", action_id: "projectile-action", time_ms: 100 },
    },
  ];
  const before = JSON.stringify(directCandidates);
  const direct = arbitrateWorldSimulationCrossLayerEventCandidates({ candidates: directCandidates });
  const permuted = arbitrateWorldSimulationCrossLayerEventCandidates({ candidates: [...directCandidates].reverse() });
  assert.equal(JSON.stringify(directCandidates), before);
  assert.equal(direct.result.batch_count, 2);
  assert.equal(direct.result.earliest_time_ms, 90);
  assert.equal(direct.result.batches[1].time_ms, 100);
  assert.equal(direct.result.batches[1].member_count, 3);
  assert.equal(direct.result.batches[1].cross_layer, true);
  assert.deepEqual(direct.result.batches[1].source_layers, ["combat", "continuous_physics"]);
  assert.equal(direct.audit.input_candidate_set_hash, permuted.audit.input_candidate_set_hash);
  assert.equal(direct.audit.output_batches_hash, permuted.audit.output_batches_hash);
  assert.equal(direct.audit.input_candidates_immutable, true);
  assert.equal(direct.audit.candidate_order_invariant, true);
  assert.equal(direct.audit.exact_timestamp_batches_preserved, true);
  assert.equal(direct.audit.stable_member_order_is_replay_only, true);
  assert.equal(direct.audit.deterministic_replay_verified, true);
  assert.equal(direct.audit.output_contains_world_state, false);
  assert.equal(direct.audit.output_contains_mutation_proposals, false);

  assert.throws(() => arbitrateWorldSimulationCrossLayerEventCandidates({
    candidates: [{ source_layer: "combat", role: "execution", kind: "illegal", time_ms: 1, mutation_proposals: [{ illicit: true }] }],
  }), (error) => error?.code === "WORLD_SIMULATION_CROSS_LAYER_EVENT_ARBITRATION_INPUT_FORBIDDEN");

  const meleeActor = "跨層近戰者";
  const shooter = "跨層射手";
  const caster = "跨層能力者";
  const target = "跨層目標";
  const sceneId = "cross-layer-arbitration-lab";
  const worldState = {
    simulation_time: "2026-08-25T01:00:00.000Z",
    world_rules: {
      combat_target_radius_m: 0.2,
      collision_radius_m: 0.2,
      passive_action_seconds: 0.2,
      physics_action_seconds: 0.2,
    },
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        dimensions: { width_m: 12, depth_m: 6 },
        entity_positions: {
          [meleeActor]: { x: 1, y: 1 },
          [target]: { x: 2, y: 1 },
          [shooter]: { x: 1, y: 3 },
          [caster]: { x: 1, y: 5 },
        },
        obstacles: [],
      },
    },
    characters: {
      [meleeActor]: { physical_state: { health_current: 100, health_max: 100 } },
      [target]: { physical_state: { health_current: 100, health_max: 100 } },
      [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
      [caster]: {
        physical_state: { health_current: 100, health_max: 100, energy_current: 100 },
        abilities: {
          pulse: { energy_cost: 0, radius_m: 0.5, duration_ms: 100, damage_per_second: 0 },
        },
      },
    },
    objects: {
      launcher: {
        holder: shooter,
        enabled: true,
        ammo: { current: 1 },
        projectile: { speed_mps: 10, radius_m: 0.05, base_damage: 0, penetration_energy: 1, max_lifetime_ms: 1000 },
      },
    },
    projectiles: {},
    ability_fields: {},
  };
  const selected = [
    {
      character: meleeActor,
      candidate: {
        action_id: "melee-100",
        duration_ms: 200,
        attack: { target_character: target, windup_ms: 50, active_ms: 100, recovery_ms: 50 },
      },
    },
    {
      character: shooter,
      candidate: {
        action_id: "projectile-100",
        duration_ms: 200,
        projectile: { weapon_id: "launcher", target_character: target, fire_delay_ms: 100 },
      },
    },
    {
      character: caster,
      candidate: {
        action_id: "ability-100",
        duration_ms: 200,
        ability: { ability_id: "pulse", start_delay_ms: 100, center: { x: 4, y: 5 } },
      },
    },
  ];
  const timeline = arbitrateWorldSimulationGlobalTimeline({
    world_state: worldState,
    next_world_state: worldState,
    scene_id: sceneId,
    selected_action_intents: selected,
    resolved_action_outcomes: [],
    elapsed_ms: 200,
  });
  const globalArbitration = timeline.cross_layer_event_arbitration;
  assert.equal(globalArbitration.version, worldSimulationCrossLayerEventArbitrationVersion);
  assert.ok(globalArbitration.audit_count >= 1);
  const exactHundred = globalArbitration.final_result.batches.find((batch) => Math.abs(batch.time_ms - 100) <= 1e-6);
  assert.ok(exactHundred, "global arbitration should contain the shared 100ms cross-layer batch");
  assert.equal(exactHundred.cross_layer, true);
  assert.ok(exactHundred.members.some((item) => item.kind === "melee_contact"));
  assert.ok(exactHundred.members.some((item) => item.kind === "projectile_launch"));
  assert.ok(exactHundred.members.some((item) => item.kind === "ability_activation"));
  assert.equal(globalArbitration.candidate_inputs_immutable, true);
  assert.equal(globalArbitration.candidate_order_invariant, true);
  assert.equal(globalArbitration.exact_timestamp_batches_preserved, true);
  assert.equal(globalArbitration.deterministic_replay_verified, true);

  const owner = "跨層持久化觀察者";
  const persistedState = {
    simulation_time: "2026-08-25T01:30:00.000Z",
    world_rules: { passive_action_seconds: 0.1 },
    event_queue: [{ event_id: "evt-cross-layer-persist", scene_id: "persist-lab", participants: [owner] }],
    scenes: {
      "persist-lab": {
        scene_id: "persist-lab",
        dimensions: { width_m: 4, depth_m: 4 },
        entity_positions: { [owner]: { x: 1, y: 1 } },
        obstacles: [],
        observable_by: { [owner]: { visual: ["跨層仲裁持久化測試區"] } },
      },
    },
    characters: { [owner]: { physical_state: { health_current: 100, health_max: 100 } } },
    memories: { [owner]: [] },
    objects: {},
    projectiles: {},
    ability_fields: {},
    available_actions: { [owner]: [{ action_id: "wait-owner", intent: "等待", duration_ms: 100 }] },
  };
  const session = await beginWorldSimulationSession({
    source_text: "Phase62T cross-layer event arbitration persistence fixture",
    characters: [owner],
    initial_world_state: persistedState,
  }, options);
  const turn = await runWorldSimulationTurn(
    { world_simulation_session_id: session.world_simulation_session_id },
    { ...options, characterBrain: async () => ({ action_id: "wait-owner" }) },
  );
  assert.equal(turn.ok, true);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const persisted = history.turns[0].cross_layer_event_arbitration;
  assert.ok(persisted);
  assert.equal(persisted.version, worldSimulationCrossLayerEventArbitrationVersion);
  assert.ok(persisted.audit_count >= 1);
  assert.equal(persisted.candidate_inputs_immutable, true);
  assert.equal(persisted.arbitration_outputs_contain_world_state, false);
  assert.equal(persisted.arbitration_outputs_contain_mutation_proposals, false);
  assert.equal(persisted.candidate_order_invariant, true);
  assert.equal(persisted.exact_timestamp_batches_preserved, true);
  assert.equal(persisted.deterministic_replay_verified, true);

  console.log(JSON.stringify({
    cross_layer_event_arbitration_version: worldSimulationCrossLayerEventArbitrationVersion,
    persisted_history_turns: history.turns.length,
    direct_batch_count: direct.result.batch_count,
    direct_cross_layer_batch_count: direct.result.cross_layer_batch_count,
    shared_time_ms: exactHundred.time_ms,
    shared_time_member_count: exactHundred.member_count,
    shared_time_kinds: exactHundred.members.map((item) => item.kind).sort(),
    candidate_order_invariant: persisted.candidate_order_invariant,
    exact_timestamp_batches_preserved: persisted.exact_timestamp_batches_preserved,
    deterministic_replay_verified: persisted.deterministic_replay_verified,
    arbitration_outputs_contain_world_state: persisted.arbitration_outputs_contain_world_state,
    arbitration_outputs_contain_mutation_proposals: persisted.arbitration_outputs_contain_mutation_proposals,
    character_brain_decides_cross_layer_precedence: false,
  }));
  console.log("Phase62T cross-layer event arbitration test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
