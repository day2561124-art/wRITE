import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  buildWorldSimulationLoopContract,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
  scheduleWorldSimulationAutonomousCognitionOpportunities,
} from "../../server/src/world-simulation-loop-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationAutonomousCognitionSchedulerContract,
  projectWorldSimulationAutonomousCognitionOpportunities,
  worldSimulationAutonomousCognitionOpportunityVersion,
  worldSimulationAutonomousCognitionSchedulerVersion,
} from "../../server/src/world-simulation-autonomous-cognition-scheduler-service.mjs";

const baseWorldState = {
  simulation_time: "2026-09-26T01:00:00+08:00",
  event_queue: [],
  characters: {
    "閒置角色": {
      current_goal: "整理剛才的線索",
      current_action: "等待",
    },
    "無事角色": {
      current_action: "等待",
    },
    "內在提示角色": {
      current_action: "休息",
    },
  },
};

const contract = buildWorldSimulationAutonomousCognitionSchedulerContract();
assert.equal(contract.version, worldSimulationAutonomousCognitionSchedulerVersion);
assert.equal(contract.phase, "CB-C2");
assert.equal(contract.trigger_model, "evidence_driven");
assert.equal(contract.fixed_frequency_polling_is_cognition_trigger, false);
assert.equal(contract.event_queue_entry_required_for_opportunity, false);
assert.equal(contract.time_passage_alone_triggers_cognition, false);
assert.equal(contract.committed_goal_idle_trigger_supported, true);
assert.equal(contract.scheduler_creates_thought_content, false);
assert.equal(contract.scheduler_revises_beliefs, false);
assert.equal(contract.scheduler_selects_actions, false);
assert.equal(contract.scheduler_mutates_world_state, false);

const idleInput = {
  world_state: baseWorldState,
  runtime_context_by_character: {
    "閒置角色": {
      idle: true,
    },
  },
};
const idleInputSnapshot = structuredClone(idleInput);
const idleProjection =
  projectWorldSimulationAutonomousCognitionOpportunities(idleInput);

assert.deepEqual(idleInput, idleInputSnapshot);
assert.equal(idleProjection.version, worldSimulationAutonomousCognitionSchedulerVersion);
assert.equal(idleProjection.opportunity_count, 1);
assert.equal(idleProjection.opportunities[0].version, worldSimulationAutonomousCognitionOpportunityVersion);
assert.equal(idleProjection.opportunities[0].character, "閒置角色");
assert.deepEqual(idleProjection.opportunities[0].trigger_kinds, ["idle_with_active_goal"]);
assert.equal(idleProjection.opportunities[0].opportunity_only, true);
assert.equal(idleProjection.opportunities[0].thought_content, null);
assert.equal(idleProjection.opportunities[0].belief_revision, null);
assert.equal(idleProjection.opportunities[0].selected_action, null);
assert.equal(idleProjection.opportunities[0].world_mutation, null);
assert.equal(idleProjection.opportunities[0].action_selection_authority, false);
assert.equal(idleProjection.opportunities[0].belief_revision_authority, false);
assert.equal(idleProjection.opportunities[0].thought_content_authority, false);
assert.equal(idleProjection.event_queue_entry_required, false);

const repeatedIdleProjection =
  projectWorldSimulationAutonomousCognitionOpportunities(idleInput);
assert.deepEqual(repeatedIdleProjection, idleProjection);
assert.equal(
  repeatedIdleProjection.opportunities[0].opportunity_id,
  idleProjection.opportunities[0].opportunity_id,
  "unchanged evidence must keep one stable opportunity identity instead of manufacturing heartbeat thoughts",
);

const consumedProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    ...idleInput,
    consumed_opportunity_ids: [idleProjection.opportunities[0].opportunity_id],
  });
assert.equal(consumedProjection.opportunity_count, 0);

const quietProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: baseWorldState,
    runtime_context_by_character: {
      "無事角色": {
        idle: true,
      },
    },
  });
assert.equal(quietProjection.opportunity_count, 0);

const laterQuietProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: {
      ...baseWorldState,
      simulation_time: "2026-09-26T05:00:00+08:00",
    },
    runtime_context_by_character: {
      "無事角色": {
        idle: true,
      },
    },
  });
assert.equal(laterQuietProjection.opportunity_count, 0);
assert.equal(laterQuietProjection.time_passage_alone_triggered, false);

const internalProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: baseWorldState,
    runtime_context_by_character: {
      "內在提示角色": {
        idle: true,
        pending_internal_cues: [
          {
            kind: "memory_reactivation",
            source_ref: "runtime-current-mind-memory-cue-001",
          },
          {
            kind: "expectation_violation",
            source_ref: "runtime-current-mind-expectation-001",
          },
          {
            kind: "affective_pressure",
            source_ref: "runtime-current-mind-affect-001",
          },
        ],
      },
    },
  });
assert.equal(internalProjection.opportunity_count, 1);
assert.deepEqual(
  internalProjection.opportunities[0].trigger_kinds,
  ["affective_pressure", "expectation_violation", "memory_reactivation"],
);
assert.equal(internalProjection.opportunities[0].goal_refs.length, 0);
assert.equal(internalProjection.opportunities[0].evidence_refs.length, 3);

const notYetDue =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: baseWorldState,
    runtime_context_by_character: {
      "無事角色": {
        temporal_cues: [{
          source_ref: "promised-review",
          due_at: "2026-09-26T02:00:00+08:00",
        }],
      },
    },
  });
assert.equal(notYetDue.opportunity_count, 0);

const dueProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: {
      ...baseWorldState,
      simulation_time: "2026-09-26T02:00:00+08:00",
    },
    runtime_context_by_character: {
      "無事角色": {
        temporal_cues: [{
          source_ref: "promised-review",
          due_at: "2026-09-26T02:00:00+08:00",
        }],
      },
    },
  });
assert.equal(dueProjection.opportunity_count, 1);
assert.deepEqual(
  dueProjection.opportunities[0].trigger_kinds,
  ["explicit_temporal_cue_due"],
);

const unsupportedCueProjection =
  projectWorldSimulationAutonomousCognitionOpportunities({
    world_state: baseWorldState,
    runtime_context_by_character: {
      "無事角色": {
        pending_internal_cues: [{
          kind: "freeform_thought_request",
          source_ref: "should-not-trigger",
        }],
      },
    },
  });
assert.equal(unsupportedCueProjection.opportunity_count, 0);

const serialized = JSON.stringify({
  idleProjection,
  internalProjection,
  dueProjection,
});
for (const forbidden of [
  "thought_text",
  "belief_update",
  "action_id",
  "world_state_patch",
  "fixed_interval",
  "heartbeat",
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    `CB-C2 scheduler output must not smuggle ${forbidden}`,
  );
}

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.autonomous_cognition_scheduler.version,
  worldSimulationAutonomousCognitionSchedulerVersion,
);
assert.equal(
  loopContract.autonomous_cognition_scheduler.event_queue_entry_required_for_opportunity,
  false,
);

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cb-c2-autonomous-cognition-${process.pid}-${Date.now()}`,
);
await rm(fixtureRoot, { recursive: true, force: true });
try {
  const session = await beginWorldSimulationSession({
    source_text: "CB-C2 empty-queue autonomous cognition scheduler fixture",
    characters: Object.keys(baseWorldState.characters),
    initial_world_state: baseWorldState,
  }, { fixtureRoot });

  const scheduled =
    await scheduleWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id: session.world_simulation_session_id,
      runtime_context_by_character: {
        "閒置角色": {
          idle: true,
        },
      },
    }, { fixtureRoot });

  assert.equal(scheduled.state_revision, 0);
  assert.equal(scheduled.event_queue_empty, true);
  assert.equal(scheduled.external_world_event_required_for_projection, false);
  assert.equal(scheduled.world_state_mutated, false);
  assert.equal(scheduled.scheduler_projection.opportunity_count, 1);
  assert.equal(
    scheduled.scheduler_projection.opportunities[0].character,
    "閒置角色",
  );

  const cognitionBrainInputs = [];
  const dispatched =
    await dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id: session.world_simulation_session_id,
      runtime_context_by_character: {
        "閒置角色": {
          idle: true,
        },
      },
    }, {
      fixtureRoot,
      characterBrain: async (brainInput) => {
        cognitionBrainInputs.push(structuredClone(brainInput));
        return { disposition: "processed_autonomous_cognition_opportunity" };
      },
    });
  assert.equal(dispatched.dispatch_count, 1);
  assert.equal(dispatched.event_queue_empty, true);
  assert.equal(dispatched.world_mutation_performed, false);
  assert.equal(dispatched.action_selection_performed, false);
  assert.equal(dispatched.raw_character_brain_results_exposed, false);
  assert.equal(dispatched.durable_cognitive_write_performed, false);
  assert.equal(cognitionBrainInputs.length, 1);
  assert.equal(cognitionBrainInputs[0].character, "閒置角色");
  assert.equal(
    cognitionBrainInputs[0].boundaries.autonomous_cognition_opportunity_only,
    true,
  );
  assert.equal(cognitionBrainInputs[0].boundaries.external_world_event_present, false);
  assert.equal(cognitionBrainInputs[0].boundaries.world_truth_exposed, false);
  assert.deepEqual(
    cognitionBrainInputs[0].cognition.autonomous_opportunity.trigger_kinds,
    ["idle_with_active_goal"],
  );
  assert.equal(
    JSON.stringify(cognitionBrainInputs[0]).includes(
      scheduled.scheduler_projection.opportunities[0].opportunity_id,
    ),
    false,
    "engine-private opportunity identity must not be exposed to Character Brain",
  );

  const unchangedState =
    await getWorldSimulationState(session.world_simulation_session_id, { fixtureRoot });
  assert.equal(unchangedState.revision, 0);
  assert.deepEqual(unchangedState.state.event_queue, []);

  const suppressed =
    await scheduleWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id: session.world_simulation_session_id,
      runtime_context_by_character: {
        "閒置角色": {
          idle: true,
        },
      },
      consumed_opportunity_ids: [
        scheduled.scheduler_projection.opportunities[0].opportunity_id,
      ],
    }, { fixtureRoot });
  assert.equal(suppressed.scheduler_projection.opportunity_count, 0);

  const quietDispatch =
    await dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id: session.world_simulation_session_id,
      runtime_context_by_character: {
        "無事角色": {
          idle: true,
        },
      },
    }, { fixtureRoot });
  assert.equal(quietDispatch.dispatch_count, 0);
  assert.deepEqual(quietDispatch.dispatches, []);
  assert.deepEqual(quietDispatch.consumed_opportunity_ids, []);
  assert.equal(quietDispatch.world_mutation_performed, false);
  assert.equal(quietDispatch.action_selection_performed, false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CB-C2 autonomous cognition scheduler tests passed.");
