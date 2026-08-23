import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  assertWorldSimulationCausalEpochCandidatesFresh,
  bindWorldSimulationCandidatesToCausalEpoch,
  buildWorldSimulationCausalEpochContract,
  openWorldSimulationCausalEpoch,
  worldSimulationCausalEpochVersion,
} from "../../server/src/world-simulation-causal-epoch-service.mjs";
import {
  arbitrateWorldSimulationGlobalTimeline,
  buildWorldSimulationGlobalCausalTimelineContract,
} from "../../server/src/world-simulation-global-causal-timeline-service.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
} from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase62u-causal-epoch-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const contract = buildWorldSimulationCausalEpochContract();
  const timelineContract = buildWorldSimulationGlobalCausalTimelineContract();
  assert.equal(contract.version, worldSimulationCausalEpochVersion);
  assert.equal(contract.candidate_contract.stale_candidates_are_rejected, true);
  assert.equal(contract.candidate_contract.candidates_may_not_be_reused_after_epoch_change, true);
  assert.equal(contract.fixed_point_contract.next_iteration_rebuilds_queries_and_rearbitrates, true);
  assert.equal(timelineContract.causal_epoch_freshness.version, worldSimulationCausalEpochVersion);

  const directWorld = {
    simulation_time: "2026-08-25T02:00:00.000Z",
    scenes: { lab: { scene_id: "lab", dimensions: { width_m: 4, depth_m: 4 }, entity_positions: {}, obstacles: [] } },
    characters: {},
    objects: {},
    projectiles: {},
    ability_fields: {},
  };
  const directHash = hashAgentRunValue(directWorld);
  const epochOne = openWorldSimulationCausalEpoch({
    world_state: directWorld,
    world_state_revision: 7,
    world_state_hash: directHash,
    epoch_index: 1,
    derivation_context: {
      suppressed_action_ids: [],
      action_time_overrides: {},
      actor_trajectories: {},
    },
  });
  const bound = bindWorldSimulationCandidatesToCausalEpoch({
    epoch: epochOne.epoch,
    candidates: [{
      candidate_id: "melee-100",
      source_layer: "combat",
      role: "execution",
      kind: "melee_contact",
      action_id: "melee-action",
      time_ms: 100,
      observation: { kind: "melee_contact", actor: "甲", action_id: "melee-action", time_ms: 100 },
    }],
  });
  const freshness = assertWorldSimulationCausalEpochCandidatesFresh({
    epoch: epochOne.epoch,
    candidates: bound.candidates,
  });
  assert.equal(freshness.candidate_freshness_verified, true);
  assert.equal(bound.candidates[0].world_state_revision, 7);
  assert.equal(bound.candidates[0].world_state_hash, directHash);
  assert.equal(bound.candidates[0].causal_epoch_id, epochOne.epoch.epoch_id);

  const epochTwo = openWorldSimulationCausalEpoch({
    world_state: directWorld,
    world_state_revision: 7,
    world_state_hash: directHash,
    epoch_index: 2,
    derivation_context: {
      suppressed_action_ids: ["melee-action"],
      action_time_overrides: {},
      actor_trajectories: {},
    },
  });
  assert.notEqual(epochTwo.epoch.epoch_id, epochOne.epoch.epoch_id);
  assert.throws(() => assertWorldSimulationCausalEpochCandidatesFresh({
    epoch: epochTwo.epoch,
    candidates: bound.candidates,
  }), (error) => error?.code === "WORLD_SIMULATION_STALE_CAUSAL_CANDIDATE");

  const changedWorld = { ...directWorld, simulation_time: "2026-08-25T02:00:01.000Z" };
  const changedHash = hashAgentRunValue(changedWorld);
  const epochThree = openWorldSimulationCausalEpoch({
    world_state: changedWorld,
    world_state_revision: 8,
    world_state_hash: changedHash,
    epoch_index: 1,
    derivation_context: {},
  });
  assert.throws(() => assertWorldSimulationCausalEpochCandidatesFresh({
    epoch: epochThree.epoch,
    candidates: bound.candidates,
  }), (error) => error?.code === "WORLD_SIMULATION_STALE_CAUSAL_CANDIDATE");
  assert.throws(() => openWorldSimulationCausalEpoch({
    world_state: directWorld,
    world_state_revision: 7,
    world_state_hash: "not-the-snapshot-hash",
    epoch_index: 1,
  }), (error) => error?.code === "WORLD_SIMULATION_CAUSAL_EPOCH_WORLD_STATE_HASH_MISMATCH");

  const shooter = "Epoch射手";
  const lateAttacker = "Epoch晚發近戰者";
  const target = "Epoch目標";
  const sceneId = "epoch-fixed-point-lab";
  const fixedPointWorld = {
    simulation_time: "2026-08-25T02:30:00.000Z",
    world_rules: {
      collision_radius_m: 0.2,
      combat_target_radius_m: 0.2,
      physics_action_seconds: 0.5,
      severe_injury_ratio: 0.25,
      critical_injury_ratio: 0.4,
    },
    scenes: {
      [sceneId]: {
        scene_id: sceneId,
        dimensions: { width_m: 8, depth_m: 4 },
        entity_positions: {
          [shooter]: { x: 0.5, y: 1 },
          [lateAttacker]: { x: 3, y: 1 },
          [target]: { x: 4, y: 1 },
        },
        obstacles: [],
      },
    },
    characters: {
      [shooter]: { physical_state: { health_current: 100, health_max: 100 } },
      [lateAttacker]: { physical_state: { health_current: 30, health_max: 100 } },
      [target]: { physical_state: { health_current: 100, health_max: 100 } },
    },
    objects: {
      launcher: {
        holder: shooter,
        state: "ready",
        enabled: true,
        ammo: { current: 1 },
        projectile: {
          speed_mps: 20,
          radius_m: 0.05,
          base_damage: 40,
          penetration_energy: 40,
          max_lifetime_ms: 2000,
        },
      },
      sword: {
        holder: lateAttacker,
        state: "ready",
        enabled: true,
        combat: { range_m: 1.5, base_damage: 60 },
      },
    },
    projectiles: {},
    ability_fields: {},
  };
  const fixedPointHash = hashAgentRunValue(fixedPointWorld);
  const fixedPoint = arbitrateWorldSimulationGlobalTimeline({
    world_state: fixedPointWorld,
    world_state_revision: 11,
    world_state_hash: fixedPointHash,
    next_world_state: fixedPointWorld,
    scene_id: sceneId,
    selected_action_intents: [
      {
        character: shooter,
        candidate: {
          action_id: "fire-before-melee",
          duration_ms: 500,
          projectile: { weapon_id: "launcher", target_character: lateAttacker, fire_delay_ms: 0 },
        },
      },
      {
        character: lateAttacker,
        candidate: {
          action_id: "late-melee",
          duration_ms: 600,
          attack: { target_character: target, weapon_id: "sword", windup_ms: 250, active_ms: 100, recovery_ms: 250 },
        },
      },
    ],
    resolved_action_outcomes: [],
    elapsed_ms: 600,
  });
  assert.ok(fixedPoint.iterations >= 2, "preemption/refinement should require multiple fixed-point epochs");
  assert.equal(fixedPoint.causal_epochs.version, worldSimulationCausalEpochVersion);
  assert.equal(fixedPoint.causal_epochs.epoch_count, fixedPoint.iterations);
  assert.equal(fixedPoint.causal_epochs.world_state_revision, 11);
  assert.equal(fixedPoint.causal_epochs.world_state_hash, fixedPointHash);
  assert.equal(fixedPoint.causal_epochs.all_candidates_bound_to_epoch, true);
  assert.equal(fixedPoint.causal_epochs.stale_candidate_rejection_enabled, true);
  assert.equal(fixedPoint.causal_epochs.prior_epoch_candidates_reused, false);
  assert.equal(fixedPoint.causal_epochs.requery_rearbitration_after_epoch_invalidation, true);
  assert.equal(new Set(fixedPoint.causal_epochs.epochs.map((epoch) => epoch.epoch_id)).size, fixedPoint.causal_epochs.epoch_count);
  assert.ok(fixedPoint.causal_epochs.epochs.some((epoch) => epoch.invalidated_after_iteration === true));
  assert.equal(fixedPoint.causal_epochs.epochs.at(-1).invalidated_after_iteration, false);
  assert.ok(fixedPoint.suppressed_action_ids.includes("late-melee"));

  const owner = "Epoch持久化觀察者";
  const persistedState = {
    simulation_time: "2026-08-25T03:00:00.000Z",
    world_rules: { passive_action_seconds: 0.1 },
    event_queue: [{ event_id: "evt-epoch-persist", scene_id: "persist-lab", participants: [owner] }],
    scenes: {
      "persist-lab": {
        scene_id: "persist-lab",
        dimensions: { width_m: 4, depth_m: 4 },
        entity_positions: { [owner]: { x: 1, y: 1 } },
        obstacles: [],
        observable_by: { [owner]: { visual: ["因果 epoch 持久化測試區"] } },
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
    source_text: "Phase62U causal epoch freshness persistence fixture",
    characters: [owner],
    initial_world_state: persistedState,
  }, options);
  const turn = await runWorldSimulationTurn(
    { world_simulation_session_id: session.world_simulation_session_id },
    { ...options, characterBrain: async () => ({ action_id: "wait-owner" }) },
  );
  assert.equal(turn.ok, true);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const persisted = history.turns[0].causal_epochs;
  assert.ok(persisted);
  assert.equal(persisted.version, worldSimulationCausalEpochVersion);
  assert.equal(persisted.world_state_revision, 0);
  assert.equal(persisted.world_state_hash, history.turns[0].previous_state_hash);
  assert.equal(persisted.all_candidates_bound_to_epoch, true);
  assert.equal(persisted.stale_candidate_rejection_enabled, true);
  assert.equal(persisted.prior_epoch_candidates_reused, false);

  console.log(JSON.stringify({
    causal_epoch_version: worldSimulationCausalEpochVersion,
    persisted_history_turns: history.turns.length,
    direct_epoch_revision: epochOne.epoch.world_state_revision,
    stale_same_revision_context_candidate_rejected: true,
    stale_new_revision_candidate_rejected: true,
    snapshot_hash_mismatch_rejected: true,
    fixed_point_epoch_count: fixedPoint.causal_epochs.epoch_count,
    fixed_point_requery_after_invalidation: fixedPoint.causal_epochs.requery_rearbitration_after_epoch_invalidation,
    prior_epoch_candidates_reused: fixedPoint.causal_epochs.prior_epoch_candidates_reused,
    all_candidates_bound_to_epoch: fixedPoint.causal_epochs.all_candidates_bound_to_epoch,
    character_brain_decides_candidate_freshness: false,
  }));
  console.log("Phase62U causal epoch freshness test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
