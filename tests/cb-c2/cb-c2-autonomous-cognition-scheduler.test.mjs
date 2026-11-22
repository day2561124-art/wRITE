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
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveClaims } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { resolveWorldSimulationSubjectiveBeliefs } from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import { buildWorldSimulationSubjectiveBeliefRevisions } from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
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

// A committed question is evidence, not a selected investigation or a
// guarantee that a check was physically performed. The speech must have been
// selected AND emitted in the same exact World history turn.
const uncertainAction = {
  action_id: "communication_question_1",
  communication: {channel: "speech", message: {speech_act: "acknowledge_unresolved_question"}},
};
const uncertainTurn = {
  turn_id: "committed_question_1", revision_to: 1,
  selected_action_intents: [{character: "閒置角色", selection: "candidate_action_intent",
    action_id: uncertainAction.action_id, candidate: uncertainAction}],
  action_outcomes: [{actor: "閒置角色", action_id: uncertainAction.action_id,
    result: "communication_emitted",
    communication_event: {channel: "speech", speech_act: "acknowledge_unresolved_question"}}],
};
const committedQuestionInput = {
  world_state: baseWorldState,
  state_revision: 1,
  committed_world_history: {turns: [uncertainTurn]},
};
const question = projectWorldSimulationAutonomousCognitionOpportunities(committedQuestionInput);
assert.equal(question.opportunity_count, 1);
assert.deepEqual(question.opportunities[0].trigger_kinds, ["unresolved_question"]);
assert.equal(question.opportunities[0].selected_action, null);
assert.equal(question.opportunities[0].world_mutation, null);
assert.deepEqual(projectWorldSimulationAutonomousCognitionOpportunities(committedQuestionInput),
  question, "Committed question identity should remain stable without heartbeat thoughts");
assert.equal(projectWorldSimulationAutonomousCognitionOpportunities({
  ...committedQuestionInput,
  consumed_opportunity_ids: [question.opportunities[0].opportunity_id],
}).opportunity_count, 0);
for (const tamper of [
  {...uncertainTurn, selected_action_intents: []},
  {...uncertainTurn, action_outcomes: []},
  {...uncertainTurn, action_outcomes: [{...uncertainTurn.action_outcomes[0], result: "blocked"}]},
  {...uncertainTurn, action_outcomes: [{...uncertainTurn.action_outcomes[0], actor: "無事角色"}]},
  {...uncertainTurn, revision_to: 2},
]) {
  assert.equal(projectWorldSimulationAutonomousCognitionOpportunities({
    ...committedQuestionInput, committed_world_history: {turns: [tamper]},
  }).opportunity_count, 0, "A missing, mismatched or future World commit cannot mint a question cue");
}

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


// C2 controlled goal-writer acceptance: the cue is genuine committed
// motivation and idle context, and the initial World has an EMPTY event queue.
// Phase65/66 entries are constructed through their actual authoritative
// builders and mutation executor, not freeform synthetic goal identifiers.
// This does not establish an independently self-chosen investigation policy.
const goalFixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cb-c2-eventless-goal-${process.pid}-${Date.now()}`);
await rm(goalFixtureRoot, {recursive: true, force: true});
try {
  const character = "閒置角色";
  const sourceTurn = "committed_prior_subjective_observation";
  const memory = {
    memory_id: "memory_c2_prior_observation",
    memory_type: "episodic_direct_perception",
    content: {kind:"visual_observation",description:"架上的計時器標籤顯示四十分鐘。"},
    source: {kind:"direct_perception",sense:"visual"},
    internal_provenance: {
      event_id:"prior_observation",scene_id:"scene_c2",
      turn_id:sourceTurn,observation_hash:"observation_c2",
      formation_version:"phase63a-subjective-memory-formation-v1",
    },
    formation_stage:"encoded_unconsolidated",
    engine_persisted_trace:true,last_recalled_at:null,
    accessible:true,suppressed:false,possibly_incorrect:false,
    source_confused:false,subjective_memory_not_world_truth:true,
  };
  const executeFixture = (state, stage, built) => {
    const queue = buildWorldSimulationChronologicalMutationQueue({
      turn_id: `${sourceTurn}:${stage}`,
      world_state_hash: hashAgentRunValue(state),
      state_transitions: built.result.state_transitions,
      elapsed_ms: 0,
    });
    return executeWorldSimulationChronologicalMutationQueue({
      world_state: state, preview_world_state: built.result.preview_world_state,
      queue, scene_id: "scene_c2",
    }).next_world_state;
  };
  let state = {
    ...structuredClone(baseWorldState),
    memories: {[character]:[memory],"無事角色":[],"內在提示角色":[]},
  };
  const claim = buildWorldSimulationSubjectiveClaims({
    world_state:state, turn_id:sourceTurn,
    source_memory_records:[{character,memory_record:memory}],
    claim_proposals:[{
      proposal_ref:"prior_visual_label",
      character,
      proposition:"我看見計時器上標著四十分鐘。",
      evidence:[{source_memory_ref:memory.memory_id,relation:"supports"}],
    }],
  });
  state = executeFixture(state, "subjective_claim", claim);
  const resolution = resolveWorldSimulationSubjectiveBeliefs({
    world_state:state,turn_id:sourceTurn,
  });
  const revision = buildWorldSimulationSubjectiveBeliefRevisions({
    world_state:state,turn_id:sourceTurn,resolution:resolution.result,
  });
  state = executeFixture(state, "subjective_belief_revision", revision);
  assert.equal(state.event_queue.length, 0);
  assert.equal(state.subjective_claim_history.length, 1);
  assert.equal(state.subjective_belief_revision_history.length, 1);
  const session = await beginWorldSimulationSession({
    source_text:"C2 goal-only internal transaction with no external event queue",
    characters:Object.keys(baseWorldState.characters),
    initial_world_state:state,
  }, {fixtureRoot:goalFixtureRoot});
  const sid=session.world_simulation_session_id;
  const before=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const historyBefore=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  assert.equal(before.revision,0);
  assert.deepEqual(before.state.event_queue,[]);
  const seen=[];
  const dispatch=await dispatchWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sid,
    runtime_context_by_character:{[character]:{idle:true}},
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    seen.push(structuredClone(packet));
    const view=packet.native_goal_decision;
    assert.equal(view.character,character);
    assert.equal(view.motivation_basis.length,1);
    assert.equal(view.motivation_basis[0].evidence.proposition,
      "我看見計時器上標著四十分鐘。");
    assert.equal(view.world_truth_exposed,false);
    assert.equal(view.source_event_ids_exposed,false);
    return {
      goal_context_token:view.context_token,
      goal_intents:[{
        operation:"propose",goal_kind:"achieve_state",domain:"inquiry",
        target_descriptor:{label:"查證計時器實際上限"},
        motivation_basis_tokens:[view.motivation_basis[0].source_token],
        motivation_relations:["supports"],
      }],
    };
  }});
  const after=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const historyAfter=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  console.log(JSON.stringify({
    scenario:"c2_eventless_explicit_goal_transaction",
    c2_turns:seen.length,
    opportunity_triggers:dispatch.dispatches.map(row=>row.trigger_kinds),
    had_external_event:!dispatch.event_queue_empty,
    before_revision:before.revision,after_revision:after.revision,
    goal_events:Object.keys(after.state.motivational_goal_events??{}).length,
    history_entries:historyAfter.turns.length,
    durable_write_reported:dispatch.durable_cognitive_write_performed,
    selected_action_reported:dispatch.action_selection_performed,
  }));
  assert.equal(dispatch.dispatch_count,1);
  assert.equal(dispatch.event_queue_empty,true);
  assert.deepEqual(dispatch.dispatches[0].trigger_kinds,["idle_with_active_goal"]);
  assert.equal(dispatch.action_selection_performed,false);
  assert.equal(after.revision,before.revision+1,
    "Native C2 eventless writer gap: an explicit source-backed same-character goal intent must be authoritatively committed without a World event.");
  assert.equal(dispatch.durable_cognitive_write_performed,true);
  assert.equal(dispatch.world_mutation_performed,true);
  assert.equal(Object.keys(after.state.motivational_goal_events??{}).length,1);
  assert.equal(after.state.motivational_goal_history.length,1);
  assert.equal(historyAfter.turns.length,historyBefore.turns.length+1);
  assert.equal(historyAfter.turns.at(-1).event,null);
  assert.deepEqual(historyAfter.turns.at(-1).selected_action_intents,[]);
  assert.deepEqual(historyAfter.turns.at(-1).action_outcomes,[]);
  assert.deepEqual(after.state.event_queue,before.state.event_queue);
  assert.equal(after.state.simulation_time,before.state.simulation_time);
  // A replay without caller supplied consumed IDs must not re-issue the
  // identical committed cognitive opportunity under a new revision.
  const repeat=await scheduleWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sid,
    runtime_context_by_character:{[character]:{idle:true}},
  },{fixtureRoot:goalFixtureRoot});
  assert.equal(repeat.scheduler_projection.opportunity_count,0,
    "A committed C2 goal opportunity must be durably consumed, not just suppressed by caller runtime context.");

  // Each invalid decision starts from the same genuine Phase65/66 evidence
  // but in a new isolated Native session. A bad source or context must abort
  // before any state/history mutation, without contaminating the next case.
  for (const [fault, expectedCode] of [
    ["forged_source", "WORLD_SIMULATION_NATIVE_GOAL_SOURCE_TOKEN_INVALID"],
    ["stale_context", "WORLD_SIMULATION_NATIVE_GOAL_CONTEXT_MISMATCH"],
    ["invalid_intent_shape", "WORLD_SIMULATION_NATIVE_GOAL_INTENT_INVALID"],
    ["foreign_goal_handle", "WORLD_SIMULATION_NATIVE_GOAL_TOKEN_INVALID"],
  ]) {
    const bad = await beginWorldSimulationSession({
      source_text: `CB-C2 invalid autonomous goal intent ${fault}`,
      characters:Object.keys(baseWorldState.characters),
      initial_world_state:state,
    },{fixtureRoot:goalFixtureRoot});
    const invalidSid=bad.world_simulation_session_id;
    const pre=await getWorldSimulationState(invalidSid,{fixtureRoot:goalFixtureRoot});
    const preHistory=await getWorldSimulationHistory(invalidSid,{fixtureRoot:goalFixtureRoot});
    await assert.rejects(dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:invalidSid,
      runtime_context_by_character:{[character]:{idle:true}},
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      const view=packet.native_goal_decision;
      const proposal={
        operation:"propose",goal_kind:"achieve_state",domain:"inquiry",
        target_descriptor:{label:"查證計時器實際上限"},
        motivation_basis_tokens:[view.motivation_basis[0].source_token],
        motivation_relations:["supports"],
      };
      if(fault==="forged_source")proposal.motivation_basis_tokens=["not_a_real_source"];
      if(fault==="foreign_goal_handle")return {
        goal_context_token:view.context_token,
        goal_intents:[{operation:"commit",goal_token:"foreign_goal_token"}],
      };
      return {
        goal_context_token:fault==="stale_context"?"stale_context":view.context_token,
        goal_intents:fault==="invalid_intent_shape"?{}:[proposal],
      };
    }}),error=>error?.code===expectedCode,
    `C2 must reject ${fault} without a cognitive partial commit`);
    const post=await getWorldSimulationState(invalidSid,{fixtureRoot:goalFixtureRoot});
    const postHistory=await getWorldSimulationHistory(invalidSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(post.revision,pre.revision);
    assert.equal(post.state_hash,pre.state_hash);
    assert.deepEqual(post.state.event_queue,pre.state.event_queue);
    assert.deepEqual(postHistory.turns,preHistory.turns);
    assert.equal((post.state.motivational_goal_history??[]).length,0);
    console.log(JSON.stringify({
      scenario:"c2_eventless_goal_negative",fault,expectedCode,
      state_unchanged:true,history_unchanged:true,
    }));
  }
} finally {
  await rm(goalFixtureRoot,{recursive:true,force:true});
}

console.log("CB-C2 autonomous cognition scheduler tests passed.");
