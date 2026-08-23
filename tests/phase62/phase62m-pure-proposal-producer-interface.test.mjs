import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationCausalRuleContract,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  buildWorldSimulationPureProposalProducerContract,
  runWorldSimulationPureProposalProducer,
  worldSimulationPureProposalProducerVersion,
} from "../../server/src/world-simulation-pure-proposal-producer-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `phase62m-pure-proposals-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

const sceneId = "pure-proposal-lab";
const mover = "純提案移動者";
const watcher = "純提案觀察者";

const initialWorldState = {
  simulation_time: "2026-08-24T18:00:00.000Z",
  world_rules: {
    collision_radius_m: 0.2,
    combat_target_radius_m: 0.2,
    physics_action_seconds: 0.5,
  },
  event_queue: [{ event_id: "evt-pure-proposal", scene_id: sceneId, participants: [mover, watcher] }],
  scenes: {
    [sceneId]: {
      scene_id: sceneId,
      entity_positions: {
        [mover]: { x: 1, y: 1 },
        [watcher]: { x: 6, y: 1 },
      },
      dimensions: { width_m: 10, depth_m: 4 },
      obstacles: [],
      observable_by: {
        [mover]: { visual: ["前方路線暢通"] },
        [watcher]: { visual: ["移動者正在前進"] },
      },
    },
  },
  characters: {
    [mover]: { movement_speed_mps: 4, physical_state: { health_current: 100, health_max: 100 } },
    [watcher]: { physical_state: { health_current: 100, health_max: 100 } },
  },
  memories: { [mover]: [], [watcher]: [] },
  objects: {},
  projectiles: {},
  ability_fields: {},
  available_actions: {
    [mover]: [{ action_id: "move-purely", intent: "走到 x=3", duration_ms: 500, movement: { to: { x: 3, y: 1 } } }],
    [watcher]: [{ action_id: "watch-purely", intent: "留在原地觀察", duration_ms: 250 }],
  },
};

async function characterBrain(packet) {
  return { action_id: packet.character === mover ? "move-purely" : "watch-purely" };
}

try {
  const contract = buildWorldSimulationPureProposalProducerContract();
  const causalContract = buildWorldSimulationCausalRuleContract();
  assert.equal(contract.version, worldSimulationPureProposalProducerVersion);
  assert.equal(causalContract.pure_proposal_producers.version, contract.version);
  assert.equal(contract.producer_output.world_state_returned, false);
  assert.equal(contract.producer_output.mutation_proposals_returned, true);
  assert.equal(contract.handoff.next_subsystem_reads_executor_projection_only, true);
  assert.deepEqual(contract.migrated_producers, [
    "spatial_rules",
    "continuous_actor_state_precombat",
    "combat",
    "continuous_physics",
    "continuous_actor_state_postphysics",
  ]);

  const session = await beginWorldSimulationSession({
    source_text: "Phase62M pure proposal producer fixture",
    characters: [mover, watcher],
    initial_world_state: initialWorldState,
  }, options);
  await runWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id }, { ...options, characterBrain });
  const state = await getWorldSimulationState(session.world_simulation_session_id, options);
  const history = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const turn = history.turns[0];
  const pure = turn.pure_proposal_producers;

  assert.equal(state.revision, 1);
  assert.equal(history.turns.length, 1);
  assert.ok(pure);
  assert.equal(pure.version, worldSimulationPureProposalProducerVersion);
  assert.equal(pure.audit_count, 5);
  assert.equal(pure.audits.length, 5);
  assert.equal(pure.producer_outputs_contain_world_state, false);
  assert.equal(pure.internal_preview_states_discarded_before_return, true);
  assert.equal(pure.inter_subsystem_handoffs_use_executor_projection_only, true);
  const audited = pure.audits.map((audit) => audit.producer).sort();
  assert.deepEqual(audited, [...contract.migrated_producers].sort());
  for (const audit of pure.audits) {
    assert.equal(audit.producer_return_contains_world_state, false);
    assert.equal(audit.internal_preview_discarded_before_return, true);
    assert.equal(audit.hidden_preview_writes_rejected_before_return, true);
    assert.equal(audit.executor_projection_is_only_inter_subsystem_handoff_state, true);
    assert.equal(typeof audit.proposal_package_hash, "string");
  }
  assert.equal(state.state.scenes[sceneId].entity_positions[mover].x, 3);

  const tinyState = { simulation_time: "2026-08-24T00:00:00.000Z", event_queue: [] };
  const tinyRun = runWorldSimulationPureProposalProducer({
    producer: "fixture_pure_producer",
    root_world_state: tinyState,
    authoritative_world_state: tinyState,
    existing_state_transitions: [],
    elapsed_ms: 100,
    solve: ({ isolated_preview_world_state: preview }) => {
      preview.simulation_time = "2026-08-24T00:00:00.100Z";
      const proposals = [{
        entity: "world",
        field: "simulation_time",
        from: tinyState.simulation_time,
        to: preview.simulation_time,
        cause: "pure producer fixture clock advance",
        time_ms: 100,
        source_layer: "causal_resolution",
      }];
      return {
        next_world_state: preview,
        next_world_state_authority: "private_solver_preview_only",
        state_transitions: proposals,
        mutation_proposals: proposals,
        action_outcomes: [],
      };
    },
  });
  assert.equal(Object.hasOwn(tinyRun.result, "next_world_state"), false);
  assert.equal(Object.hasOwn(tinyRun.proposal_package, "next_world_state"), false);
  assert.equal(tinyRun.proposal_package.proposal_count, 1);
  assert.equal(tinyRun.audit.producer_return_contains_world_state, false);

  assert.throws(() => runWorldSimulationPureProposalProducer({
    producer: "malicious_private_preview",
    root_world_state: tinyState,
    authoritative_world_state: tinyState,
    existing_state_transitions: [],
    elapsed_ms: 100,
    solve: ({ isolated_preview_world_state: preview }) => {
      preview.simulation_time = "2026-08-24T00:00:00.100Z";
      preview.illicit_private_write = true;
      return {
        next_world_state: preview,
        state_transitions: [{
          entity: "world",
          field: "simulation_time",
          from: tinyState.simulation_time,
          to: preview.simulation_time,
          cause: "fixture declared mutation",
          time_ms: 100,
          source_layer: "causal_resolution",
        }],
      };
    },
  }), (error) => error?.code === "WORLD_SIMULATION_UNQUEUED_STATE_MUTATION");

  console.log(JSON.stringify({
    pure_proposal_producer_version: worldSimulationPureProposalProducerVersion,
    committed_revision: state.revision,
    history_turns: history.turns.length,
    pure_producer_audit_count: pure.audit_count,
    migrated_producers: audited,
    producer_outputs_contain_world_state: pure.producer_outputs_contain_world_state,
    private_previews_discarded: pure.internal_preview_states_discarded_before_return,
    hidden_private_preview_write_rejected: true,
    mover_final_x: state.state.scenes[sceneId].entity_positions[mover].x,
    character_brain_returns_mutation_proposals: false,
  }));
  console.log("Phase62M pure proposal producer interface test passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
