import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
  buildWorldSimulationLoopContract,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
  scheduleWorldSimulationAutonomousCognitionOpportunities,
} from "../../server/src/world-simulation-loop-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { runWorldSimulationActorInitiatedSpeech } from "../../server/src/world-simulation-actor-initiated-speech-service.mjs";
import { runWorldSimulationCommittedActorSpeechListenerCognition } from "../../server/src/world-simulation-committed-actor-speech-listener-ingress-service.mjs";
import { runWorldSimulationCommittedActorSpeechListenerClarification } from "../../server/src/world-simulation-committed-actor-speech-listener-clarification-service.mjs";
import { assertWorldSimulationCommittedAcousticSource } from "../../server/src/world-simulation-native-committed-source-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { nativeImplementationIntentionActivationCapability } from "../../server/src/world-simulation-goal-implementation-intention-activation-service.mjs";
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

  // A proposal is not yet a committed goal. A NEW, explicit internal cue
  // may let the same Brain decide whether to adopt the proposed goal; the
  // authoritative C3/Phase68D transition must remain separate and eventless.
  const proposedGoal=Object.values(after.state.motivational_goal_events??{});
  assert.equal(proposedGoal.length,1);
  assert.equal(proposedGoal[0].operation,"propose");
  const commitCue={ [character]: {
    pending_internal_cues: [{
      kind:"memory_reactivation",
      source_ref:"runtime-goal-adoption-review-after-proposal",
    }],
  }};
  const commitBefore=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const commitHistoryBefore=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  let acceptedGoalToken=null;
  const accepted=await dispatchWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sid,
    runtime_context_by_character:commitCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    const view=packet.native_goal_decision;
    assert.equal(packet.character,character);
    assert.equal(view.existing_goals.length,1);
    assert.equal(view.existing_goals[0].state,"proposed");
    assert.equal(view.existing_goals[0].goal_ids_exposed,undefined);
    assert.equal(view.world_truth_exposed,false);
    assert.equal(view.goal_ids_exposed,false);
    acceptedGoalToken=view.existing_goals[0].goal_token;
    return {
      goal_context_token:view.context_token,
      goal_intents:[{operation:"commit",goal_token:acceptedGoalToken}],
    };
  }});
  const committedState=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const committedHistory=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  assert.equal(accepted.dispatch_count,1);
  assert.equal(accepted.action_selection_performed,false);
  assert.equal(accepted.durable_cognitive_write_performed,true);
  assert.equal(committedState.revision,commitBefore.revision+1);
  assert.equal((committedState.state.motivational_goal_history??[]).length,2);
  assert.equal(committedHistory.turns.length,commitHistoryBefore.turns.length+1);
  assert.equal(committedHistory.turns.at(-1).event,null);
  assert.deepEqual(committedHistory.turns.at(-1).selected_action_intents,[]);
  assert.deepEqual(committedHistory.turns.at(-1).action_outcomes,[]);
  assert.deepEqual(committedState.state.event_queue,commitBefore.state.event_queue);
  assert.equal(committedState.state.simulation_time,commitBefore.state.simulation_time);
  const committedEvents=Object.values(committedState.state.motivational_goal_events??{});
  assert.equal(committedEvents.length,2);
  assert.equal(committedEvents.filter(event=>event.operation==="propose").length,1);
  assert.equal(committedEvents.filter(event=>event.operation==="commit").length,1);
  assert.equal(committedEvents[0].goal_id,committedEvents[1].goal_id,
    "Propose and commit must transition one goal, not create a second goal identity.");
  assert.equal(committedHistory.turns.at(-1).autonomous_cognition_goal_commitment?.goal_event_count,1);
  console.log(JSON.stringify({
    scenario:"c2_eventless_goal_propose_then_commit",
    distinct_explicit_internal_cues:2,
    sequential_world_revisions:[before.revision,after.revision,committedState.revision],
    operations:committedEvents.map(event=>event.operation).sort(),
    reused_goal_identity:committedEvents[0].goal_id===committedEvents[1].goal_id,
    selected_actions:0,
  }));

  // After Phase68D commit, a NEW independent C2 internal cue should let
  // the same Native Brain formulate a Phase69A plan without an unrelated
  // external World event. The engine must retain its normal goal token,
  // source validation and World-CAS authority. This is a controlled intent
  // supplied by the test Brain, not an unprompted general AI policy.
  const planCue={ [character]: {
    pending_internal_cues: [{
      kind:"memory_reactivation",
      source_ref:"runtime-form-implementation-intention-from-committed-goal",
    }],
  }};
  const planBefore=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const planHistoryBefore=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  let observedPlanView=null;
  const planned=await dispatchWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sid,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    assert.equal(packet.character,character);
    observedPlanView=packet.native_plan_decision;
    assert.ok(observedPlanView,
      "C2→C3 plan gap: a conscious eventless cognition opportunity must receive the same bounded Native plan view already used by eventful turns.");
    assert.equal(observedPlanView.prior_turn_committed_goal_only,true);
    assert.equal(observedPlanView.world_truth_exposed,false);
    assert.equal(observedPlanView.source_event_ids_exposed,false);
    assert.equal(observedPlanView.goal_ids_exposed,false);
    assert.equal(observedPlanView.action_selection_requested,false);
    assert.equal(observedPlanView.committed_goals.length,1);
    assert.equal(observedPlanView.committed_goals[0].target_descriptor.label,"查證計時器實際上限");
    assert.equal(packet.boundaries.native_plan_decision_world_write_authority,false);
    return {
      plan_context_token:observedPlanView.context_token,
      plan_intents:[{
        goal_token:observedPlanView.committed_goals[0].goal_token,
        cue_descriptor:{cue_kind:"opportunity",label:"timer_doubt_requires_verification"},
        response_descriptor:{response_kind:"seek_support",label:"ask_trusted_ally"},
      }],
    };
  }});
  const planAfter=await getWorldSimulationState(sid,{fixtureRoot:goalFixtureRoot});
  const planHistoryAfter=await getWorldSimulationHistory(sid,{fixtureRoot:goalFixtureRoot});
  console.log(JSON.stringify({
    scenario:"c2_eventless_goal_to_native_plan",
    plan_view_received:observedPlanView!==null,
    plan_entries:(planAfter.state.goal_implementation_intention_history??[]).length,
    world_revision_before:planBefore.revision,
    world_revision_after:planAfter.revision,
    goal_entries:(planAfter.state.motivational_goal_history??[]).length,
    selected_action_performed:planned.action_selection_performed,
  }));
  assert.equal(planned.dispatch_count,1);
  assert.equal(planned.action_selection_performed,false);
  assert.equal(planned.durable_cognitive_write_performed,true);
  assert.equal(planAfter.revision,planBefore.revision+1,
    "An explicit Phase69A plan intent from the actual C2 Brain must commit through the authoritative eventless World writer.");
  assert.equal((planAfter.state.goal_implementation_intention_history??[]).length,1);
  assert.equal((planAfter.state.motivational_goal_history??[]).length,2);
  assert.equal(planHistoryAfter.turns.length,planHistoryBefore.turns.length+1);
  assert.equal(planHistoryAfter.turns.at(-1).event,null);
  assert.deepEqual(planHistoryAfter.turns.at(-1).selected_action_intents,[]);
  assert.deepEqual(planHistoryAfter.turns.at(-1).action_outcomes,[]);
  assert.deepEqual(planAfter.state.event_queue,planBefore.state.event_queue);
  assert.equal(planAfter.state.simulation_time,planBefore.state.simulation_time);
  const planReplay=await scheduleWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sid,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot});
  assert.equal(planReplay.scheduler_projection.opportunity_count,0,
    "Successfully authored plan opportunity must be durably suppressed on replay.");

  // Cross-path acceptance: an eventless C2 goal and Phase69A plan must be
  // usable in a subsequent real, queued World observation turn. The later
  // observation is an explicitly declared TEST fixture, not an event
  // fabricated by the eventless cognition writer. A chosen speech action
  // must cause a committed World communication outcome, not passive intent.
  const inquiryAlly="同伴・計時器研究員";
  const inquiryWords="你有查過這個計時器的實際上限嗎？";
  const speechCandidate=buildCharacterCommunicationActionCandidate({
    character,
    cognition:{communication_goal:{
      character,purpose:"request_information",mode:"direct",
      addressee:inquiryAlly,public_content:inquiryWords,
      communication_opportunity:"initiate",
    }},
  });
  assert.ok(speechCandidate);
  const actionScene="c2_followup_room";
  const actionEventId="c2_followup_inquiry_opportunity";
  const actionWorld={
    ...structuredClone(planAfter.state),
    event_queue:[{
      event_id:actionEventId,type:"observation",scene_id:actionScene,
      participants:[character],summary:"同伴在附近，可以詢問計時器規格",
    }],
    scenes:{
      [actionScene]:{
        scene_id:actionScene,
        simulation_time:planAfter.state.simulation_time,
        dimensions:{width_m:6,depth_m:6},
        entity_positions:{
          [character]:{x:1,y:1},
          [inquiryAlly]:{x:2,y:1},
        },
        observable_by:{
          [character]:{visual:["同伴在一旁翻閱計時器規格"],audible:[]},
          [inquiryAlly]:{visual:[],audible:[]},
        },
      },
    },
    characters:{
      ...structuredClone(planAfter.state.characters),
      [inquiryAlly]:{known:[]},
    },
    available_actions:{[character]:[speechCandidate]},
  };
  // Actor-initiated speech: an actor with a prior C2 committed goal and Phase69A plan can
  // select a canonical World speech candidate from a fresh internal cue.
  // There is NO queued observation event, invented ally answer or belief
  // verification. Phase69C activation and actual causal speech must both occur.
  const spontaneousWorld={
    ...structuredClone(actionWorld),
    event_queue:[],
  };
  const spontaneousSession=await beginWorldSimulationSession({
    source_text:"actor-initiated World speech World-owned actor-initiated speech with no external event",
    characters:Object.keys(spontaneousWorld.characters),
    initial_world_state:spontaneousWorld,
  },{fixtureRoot:goalFixtureRoot});
  const spontaneousSid=spontaneousSession.world_simulation_session_id;
  const spontaneousBefore=await getWorldSimulationState(
    spontaneousSid,{fixtureRoot:goalFixtureRoot});
  const spontaneousHistoryBefore=await getWorldSimulationHistory(
    spontaneousSid,{fixtureRoot:goalFixtureRoot});
  let activationStageCount=0,choiceStageCount=0;
  const selfInitiated=await runWorldSimulationActorInitiatedSpeech({
    world_simulation_session_id:spontaneousSid,
    character,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    assert.equal(packet.character,character);
    assert.equal(packet.boundaries.external_world_event_present,false);
    assert.equal(packet.boundaries.world_truth_exposed,false);
    if(packet.cognition?.implementation_intention_activation){
      activationStageCount++;
      const activation=packet.cognition.implementation_intention_activation;
      assert.equal(activation.plans.length,1);
      assert.equal(activation.plans[0].if_cue.label,"timer_doubt_requires_verification");
      assert.equal(activation.action_selection_requested,false);
      return {
        plan_activation_context_token:activation.context_token,
        activated_plan_tokens:[activation.plans[0].plan_token],
      };
    }
    choiceStageCount++;
    const plans=packet.cognition.implementation_intention_guidance.implementation_intentions;
    assert.equal(plans.length,1);
    assert.equal(plans[0].then_response.label,"ask_trusted_ally");
    assert.equal(packet.boundaries.action_choice_owner,"character_brain");
    assert.ok(packet.candidate_action_intents.some(candidate=>
      candidate.action_id===speechCandidate.action_id));
    return {action_id:speechCandidate.action_id};
  }});
  const spontaneousAfter=await getWorldSimulationState(
    spontaneousSid,{fixtureRoot:goalFixtureRoot});
  const spontaneousHistory=await getWorldSimulationHistory(
    spontaneousSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(activationStageCount,1);
  assert.equal(choiceStageCount,1);
  assert.equal(selfInitiated.committed,true);
  assert.equal(selfInitiated.external_world_event_created,false);
  assert.equal(selfInitiated.information_verified,false);
  assert.equal(spontaneousAfter.revision,spontaneousBefore.revision+1);
  assert.equal(spontaneousHistory.turns.length,spontaneousHistoryBefore.turns.length+1);
  const autonomousReceipt=spontaneousHistory.turns.at(-1);
  assert.equal(autonomousReceipt.event,null);
  assert.equal(autonomousReceipt.autonomous_actor_initiated_action?.character,character);
  assert.equal(autonomousReceipt.selected_action_intents.length,1);
  assert.equal(autonomousReceipt.selected_action_intents[0].action_id,
    speechCandidate.action_id);
  const emitted=autonomousReceipt.action_outcomes.filter(outcome=>
    outcome.actor===character
    && outcome.action_id===speechCandidate.action_id
    && outcome.result==="communication_emitted");
  assert.equal(emitted.length,1,
    "Actor-originated internal opportunity must execute a real World causal inquiry.");
  assert.equal(emitted[0].communication_event?.addressee,inquiryAlly);
  assert.equal(emitted[0].communication_event?.semantic_content,inquiryWords);
  assert.equal(emitted[0].communication_event?.world_truth_claimed,false);
  assert.equal((spontaneousAfter.state.motivational_goal_history??[]).length,2);
  assert.equal((spontaneousAfter.state.goal_implementation_intention_history??[]).length,1);
  const spontaneousReplay=await scheduleWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:spontaneousSid,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot});
  assert.equal(spontaneousReplay.scheduler_projection.opportunity_count,0,
    "Committed actor speech must consume the original internal cue exactly once.");
  console.log(JSON.stringify({
    scenario:"c2_eventless_actor_initiates_world_speech",
    empty_initial_event_queue:spontaneousBefore.state.event_queue.length===0,
    plan_activated:activationStageCount===1,character_choice:choiceStageCount===1,
    world_revision_before:spontaneousBefore.revision,
    world_revision_after:spontaneousAfter.revision,
    causal_speech_outcomes:emitted.length,information_verified:false,
    replay_opportunities:spontaneousReplay.scheduler_projection.opportunity_count,
  }));

  // Acoustic RED acceptance: actual actor-initiated speech must be a complete
  // CC-7AF source when the actor explicitly authored Mandarin surface text
  // and the addressee has an audible, physically grounded scene position.
  // A speech outcome alone does not establish that the listener heard it.
  const acousticContent="你查過計時器的上限嗎";
  const acousticCandidate=buildCharacterCommunicationActionCandidate({
    character,cognition:{communication_goal:{
      character,purpose:"request_information",mode:"direct",
      addressee:inquiryAlly,public_content:acousticContent,
      surface_realization:{
        schema_version:"cc5-mandarin-clause-request-v1",
        semantic_anchor:acousticContent,
        clause:{
          subject:"你",predicate:"查過",object:"計時器的上限",
          sentence_final_particle:"嗎",
        },
      },
    }},
  });
  assert.equal(acousticCandidate.communication.surface_realization_complete,true);
  const acousticWorld=structuredClone(spontaneousWorld);
  acousticWorld.available_actions[character]=[acousticCandidate];
  // The listener has a pre-existing World-trusted clarification action.
  // It is not generated from the unheard transcript or selected by World.
  const clarificationWords="你能再說一次剛剛那句話嗎";
  const clarificationCandidate=buildCharacterCommunicationActionCandidate({
    character:inquiryAlly,cognition:{communication_goal:{
      character:inquiryAlly,purpose:"request_information",mode:"direct",
      addressee:character,public_content:clarificationWords,
      surface_realization:{
        schema_version:"cc5-mandarin-clause-request-v1",
        semantic_anchor:clarificationWords,
        clause:{subject:"你",predicate:"能再說一次",object:"剛剛那句話",
          sentence_final_particle:"嗎"},
      },
    }},
  });
  assert.equal(clarificationCandidate.communication.surface_realization_complete,true);
  acousticWorld.available_actions[inquiryAlly]=[clarificationCandidate];
  acousticWorld.characters[inquiryAlly].speech_acoustics={sound_level_db_at_1m:65};
  acousticWorld.characters[character].speech_acoustics={sound_level_db_at_1m:65};
  acousticWorld.scenes[actionScene].audibility_profiles={
    [character]:{minimum_audible_db:35},
    [inquiryAlly]:{minimum_audible_db:35},
  };
  const acousticSession=await beginWorldSimulationSession({
    source_text:"World actor speech verified acoustic source",
    characters:Object.keys(acousticWorld.characters),
    initial_world_state:acousticWorld,
  },{fixtureRoot:goalFixtureRoot});
  const acousticSid=acousticSession.world_simulation_session_id;
  const acousticTurn=await runWorldSimulationActorInitiatedSpeech({
    world_simulation_session_id:acousticSid,character,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    if(packet.cognition?.implementation_intention_activation){
      const activation=packet.cognition.implementation_intention_activation;
      assert.equal(activation.plans.length,1);
      return {
        plan_activation_context_token:activation.context_token,
        activated_plan_tokens:[activation.plans[0].plan_token],
      };
    }
    assert.ok(packet.candidate_action_intents.some(item=>
      item.action_id===acousticCandidate.action_id));
    return {action_id:acousticCandidate.action_id};
  }});
  assert.equal(acousticTurn.committed,true);
  const acousticHistory=await getWorldSimulationHistory(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  const acousticSnapshot=await getWorldSimulationState(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  const acousticSourceTurn=acousticHistory.turns.at(-1);
  const sourceOutcome=acousticSourceTurn.action_outcomes.find(item=>
    item.actor===character && item.action_id===acousticCandidate.action_id
    && item.result==="communication_emitted");
  assert.equal(acousticSourceTurn.event,null);
  assert.equal(sourceOutcome?.communication_event?.surface_realization_complete,true);
  assert.equal(sourceOutcome?.communication_event?.world_truth_claimed,false);
  assert.equal(sourceOutcome?.communication_acoustic_signal?.registered,true,
    "World must register a genuine physical speech signal, not merely a plan.");
  const sourceAdmission=(acousticSourceTurn.communication_observer_increment_admissions??[])
    .find(item=>item.observer===inquiryAlly
      && item.admission_status==="heard_acoustic_cues_only"
      && item.audit?.source_action_id===sourceOutcome.action_id);
  assert.ok(sourceAdmission?.observer_increment,
    "Actor-originated World speech must persist the actual listener acoustic increment.");
  assert.ok(acousticSourceTurn.subjective_choice_commitment_receipts?.receipt_bundle_hash,
    "Actor-originated World speech must persist canonical Phase74D intent provenance.");
  const sourceDependency={
    session_id:acousticSid,
    source_turn_id:acousticSourceTurn.turn_id,
    source_turn_hash:hashAgentRunValue(acousticSourceTurn),
    source_action_id:sourceOutcome.action_id,
    source_character:character,observer:inquiryAlly,
    observer_increment_ref:sourceAdmission.observer_increment.increment_ref,
    release_time_ms:sourceAdmission.release_time_ms,
    expected_source_receipt_bundle_hash:
      acousticSourceTurn.subjective_choice_commitment_receipts.receipt_bundle_hash,
    expected_source_revision_to:acousticSourceTurn.revision_to,
    expected_source_next_state_hash:acousticSourceTurn.next_state_hash,
    expected_current_revision:acousticSnapshot.revision,
    expected_current_state_hash:acousticSnapshot.state_hash,
  };
  const sourceAudit=await assertWorldSimulationCommittedAcousticSource(
    sourceDependency,{fixtureRoot:goalFixtureRoot});
  assert.equal(sourceAudit.status,"committed_source_verified_without_retraction");
  assert.equal(sourceAudit.speculative_dependency_authorized_to_speak,false);
  assert.equal(sourceAudit.world_mutation_performed,false);
  await assert.rejects(
    assertWorldSimulationCommittedAcousticSource({
      ...sourceDependency,observer_increment_ref:"forged_listener_increment",
    },{fixtureRoot:goalFixtureRoot}),
    error=>error?.code==="CC7AF_COMMITTED_SOURCE_INVALID",
    "A forged listener hearing reference must never be recognized as a committed source.");
  const unchangedAfterAudit=await getWorldSimulationState(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(unchangedAfterAudit.state_hash,acousticSnapshot.state_hash);
  console.log(JSON.stringify({
    scenario:"world_actor_speech_committed_acoustic_source",
    initial_event_queue_empty:acousticWorld.event_queue.length===0,
    speech_emitted:true,registered_sound:true,
    listener_increment_persisted:true,choice_receipt_persisted:true,
    source_audit:sourceAudit.status,information_verified:false,
  }));

  // A newly admitted listener may privately notice its own actually
  // released acoustic cue from the last *committed* actor speech. Neither
  // source transcript nor source identity are available to this Brain.
  let receivedListenerCues=0;
  const listenerIngressInput={
    world_simulation_session_id:acousticSid,
    observer:inquiryAlly,
    source_turn_id:acousticSourceTurn.turn_id,
    expected_revision:acousticSnapshot.revision,
    expected_state_hash:acousticSnapshot.state_hash,
  };
  const listenerView=await runWorldSimulationCommittedActorSpeechListenerCognition(
    listenerIngressInput,
    {fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      receivedListenerCues++;
      assert.equal(packet.character,inquiryAlly);
      const acoustic=packet.cognition.committed_acoustic_observation;
      assert.equal(acoustic.kind,"speech_sound_detected");
      assert.equal(acoustic.heard_surface_fragment,null);
      assert.equal(acoustic.content_understood,false);
      assert.equal(acoustic.speaker_identity_recognized,false);
      assert.equal(acoustic.lexical_intelligibility_attested,false);
      assert.equal(acoustic.increment_ref,sourceAdmission.observer_increment.increment_ref);
      assert.deepEqual(acoustic.perceived_cue_refs,
        sourceAdmission.observer_increment.perceived_cue_refs);
      assert.equal(packet.boundaries.world_truth_authority,false);
      assert.equal(packet.boundaries.action_selection_authority,false);
      assert.equal(packet.boundaries.future_cues_exposed,false);
      assert.equal(packet.boundaries.speaker_identity_exposed,false);
      assert.equal(packet.boundaries.speech_surface_exposed,false);
      assert.equal(JSON.stringify(packet).includes(acousticContent),false,
        "The listener's acoustic-only cue must not expose the source transcript.");
      return {private_reaction:"noticed a speech sound, no lexical certainty"};
    }});
  assert.equal(receivedListenerCues,1);
  assert.equal(listenerView.status,"verified_listener_acoustic_brain_ingress");
  assert.equal(listenerView.source_proof_verified,true);
  assert.equal(listenerView.world_mutation_performed,false);
  assert.equal(listenerView.public_reply_emitted,false);
  assert.equal(listenerView.content_understood,false);
  const listenerAfter=await getWorldSimulationState(acousticSid,{fixtureRoot:goalFixtureRoot});
  const listenerHistoryAfter=await getWorldSimulationHistory(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(listenerAfter.revision,acousticSnapshot.revision);
  assert.equal(listenerAfter.state_hash,acousticSnapshot.state_hash);
  assert.deepEqual(listenerHistoryAfter.turns,acousticHistory.turns);
  console.log(JSON.stringify({
    scenario:"world_actor_listener_committed_cue_ingress",
    source_proof_verified:true,observer_only_cues:1,
    brain_calls:receivedListenerCues,transcript_hidden:true,
    public_reply_emitted:false,world_unchanged:true,
  }));

  for(const fault of ["source_is_speaker","stale_world_cas",
      "runtime_character_substitution","brain_action_forgery"]){
    let invoked=0;
    const faultInput={...listenerIngressInput};
    if(fault==="source_is_speaker")faultInput.observer=character;
    if(fault==="stale_world_cas")faultInput.expected_revision++;
    const faultOptions={
      fixtureRoot:goalFixtureRoot,
      characterBrain:async ()=>{
        invoked++;
        return fault==="brain_action_forgery"
          ? {action_id:acousticCandidate.action_id}
          : {private_reaction:"heard noise"};
      },
    };
    if(fault==="runtime_character_substitution")
      faultOptions.characterRuntimeManager={
        runCharacterTurn:async ({brain_input,characterBrain})=>
          characterBrain({...brain_input,character:"not_the_listener"}),
      };
    await assert.rejects(
      runWorldSimulationCommittedActorSpeechListenerCognition(faultInput,faultOptions),
      error=>error?.code===({
        source_is_speaker:"WORLD_LISTENER_CUE_SOURCE_NOT_CURRENT",
        stale_world_cas:"WORLD_LISTENER_CUE_WORLD_STATE_STALE",
        runtime_character_substitution:"WORLD_LISTENER_CUE_CHARACTER_MISMATCH",
        brain_action_forgery:"WORLD_LISTENER_CUE_ACTION_UNSUPPORTED",
      })[fault]);
    assert.equal(invoked,fault==="brain_action_forgery"?1:0);
    const afterFault=await getWorldSimulationState(
      acousticSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(afterFault.state_hash,acousticSnapshot.state_hash);
  }

  // A real listener-owned second decision must produce one *new* World speech
  // outcome. The previously verified source and its acoustic evidence survive.
  let privateListenerPasses=0, listenerReplyDecisions=0;
  const listenerClarification=await runWorldSimulationCommittedActorSpeechListenerClarification(
    listenerIngressInput,
    {fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      assert.equal(packet.character,inquiryAlly);
      if(packet.cognition?.clarification_opportunity){
        listenerReplyDecisions++;
        assert.equal(packet.cognition.clarification_opportunity.lexical_meaning_understood,false);
        assert.equal(packet.cognition.committed_acoustic_observation.content_understood,false);
        assert.equal(packet.boundaries.source_transcript_exposed,false);
        assert.equal(packet.boundaries.action_choice_owner,"character_brain");
        assert.equal(JSON.stringify(packet).includes(acousticContent),false);
        assert.ok(packet.candidate_action_intents.some(item=>
          item.action_id===clarificationCandidate.action_id));
        return {action_id:clarificationCandidate.action_id};
      }
      privateListenerPasses++;
      assert.equal(packet.cognition.committed_acoustic_observation.kind,"speech_sound_detected");
      assert.equal(packet.boundaries.action_selection_authority,false);
      return {private_reaction:"heard something without identifying the words"};
    }});
  assert.equal(privateListenerPasses,1);
  assert.equal(listenerReplyDecisions,1);
  assert.equal(listenerClarification.committed,true);
  assert.equal(listenerClarification.public_reply_emitted,true);
  assert.equal(listenerClarification.information_verified,false);
  assert.equal(listenerClarification.content_understood,false);
  assert.equal(listenerClarification.external_world_event_created,false);
  const replySnapshot=await getWorldSimulationState(acousticSid,{fixtureRoot:goalFixtureRoot});
  const replyHistory=await getWorldSimulationHistory(acousticSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(replySnapshot.revision,acousticSnapshot.revision+1);
  assert.equal(replyHistory.turns.length,acousticHistory.turns.length+1);
  assert.deepEqual(replyHistory.turns.at(-2),acousticSourceTurn,
    "Listener response must not rewrite original source speech or its hearing receipt.");
  const replyTurn=replyHistory.turns.at(-1);
  assert.equal(replyTurn.event,null);
  assert.equal(replyTurn.autonomous_actor_initiated_action.character,inquiryAlly);
  assert.equal(replyTurn.autonomous_actor_initiated_action.listener_clarification_source.source_turn_id,
    acousticSourceTurn.turn_id);
  assert.equal(replyTurn.autonomous_actor_initiated_action.listener_clarification_source.observer_increment_ref,
    sourceAdmission.observer_increment.increment_ref);
  assert.equal(replyTurn.selected_action_intents[0].action_id,
    clarificationCandidate.action_id);
  const actualReply=replyTurn.action_outcomes.filter(item=>
    item.actor===inquiryAlly
    && item.action_id===clarificationCandidate.action_id
    && item.result==="communication_emitted");
  assert.equal(actualReply.length,1);
  assert.equal(actualReply[0].communication_event.addressee,character);
  assert.equal(actualReply[0].communication_event.semantic_content,clarificationWords);
  assert.equal(actualReply[0].communication_event.world_truth_claimed,false);
  const replyReplayBefore=await getWorldSimulationHistory(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  await assert.rejects(
    runWorldSimulationCommittedActorSpeechListenerClarification(
      listenerIngressInput,
      {fixtureRoot:goalFixtureRoot,characterBrain:async ()=>({
        action_id:clarificationCandidate.action_id,
      })}),
    error=>error?.code==="WORLD_LISTENER_CUE_WORLD_STATE_STALE",
    "Committed listener source must not produce a second public reply on replay.");
  const replyReplayAfter=await getWorldSimulationHistory(
    acousticSid,{fixtureRoot:goalFixtureRoot});
  assert.deepEqual(replyReplayAfter.turns,replyReplayBefore.turns);
  console.log(JSON.stringify({
    scenario:"world_actor_verified_hearing_to_listener_owned_causal_clarification",
    source_turn_preserved:true,private_brain_passes:privateListenerPasses,
    explicit_reply_choices:listenerReplyDecisions,
    committed_reply_outcomes:actualReply.length,
    source_transcript_leaked:false,belief_verified:false,replay_blocked:true,
  }));

  // An actor can decline a real plan cue and a genuine available action.
  // Absence of choice must not create a dummy external World turn.
  for(const behavior of ["decline","foreign_action"]){
    const fresh=await beginWorldSimulationSession({
      source_text:"actor-initiated World speech refusal or forged action "+behavior,
      characters:Object.keys(spontaneousWorld.characters),
      initial_world_state:spontaneousWorld,
    },{fixtureRoot:goalFixtureRoot});
    const freshSid=fresh.world_simulation_session_id;
    const pre=await getWorldSimulationState(freshSid,{fixtureRoot:goalFixtureRoot});
    const preHistory=await getWorldSimulationHistory(freshSid,{fixtureRoot:goalFixtureRoot});
    const call=()=>runWorldSimulationActorInitiatedSpeech({
      world_simulation_session_id:freshSid,character,
      runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>
      packet.cognition.implementation_intention_activation
        ? {
          plan_activation_context_token:
            packet.cognition.implementation_intention_activation.context_token,
          activated_plan_tokens:[
            packet.cognition.implementation_intention_activation.plans[0].plan_token,
          ],
        }
        : {action_id:behavior==="decline"?"reject_all":"forged_action_id"},
    });
    if(behavior==="foreign_action"){
      await assert.rejects(call(),error=>error?.code==="WORLD_ACTOR_SPEECH_ACTION_NOT_AVAILABLE");
    }else{
      const declined=await call();
      assert.equal(declined.committed,false);
      assert.equal(declined.status,"brain_declined_action");
    }
    const post=await getWorldSimulationState(freshSid,{fixtureRoot:goalFixtureRoot});
    const postHistory=await getWorldSimulationHistory(freshSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(post.revision,pre.revision);
    assert.equal(post.state_hash,pre.state_hash);
    assert.deepEqual(postHistory.turns,preHistory.turns);
  }

  // Actor-originated action must lose a CAS race instead of replaying an
  // old choice, even if its cognition and chosen candidate were valid.
  const autonomousRace=await beginWorldSimulationSession({
    source_text:"actor-initiated World speech actor speech competing World commit",
    characters:Object.keys(spontaneousWorld.characters),
    initial_world_state:spontaneousWorld,
  },{fixtureRoot:goalFixtureRoot});
  const autonomousRaceSid=autonomousRace.world_simulation_session_id;
  let actorRaceWinnerCount=0;
  await assert.rejects(runWorldSimulationActorInitiatedSpeech({
    world_simulation_session_id:autonomousRaceSid,character,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    if(packet.cognition.implementation_intention_activation){
      const activation=packet.cognition.implementation_intention_activation;
      return {
        plan_activation_context_token:activation.context_token,
        activated_plan_tokens:[activation.plans[0].plan_token],
      };
    }
    const atIngress=await getWorldSimulationState(
      autonomousRaceSid,{fixtureRoot:goalFixtureRoot});
    await commitWorldSimulationTurn(autonomousRaceSid,{
      expected_revision:atIngress.revision,
      expected_state_hash:atIngress.state_hash,
      turn_id:"harness_cb_c4_competing_world_winner",
      next_world_state:atIngress.state,event:null,
      selected_action_intents:[],action_outcomes:[],state_transitions:[],
    },{fixtureRoot:goalFixtureRoot});
    actorRaceWinnerCount++;
    return {action_id:speechCandidate.action_id};
  }}),error=>error?.code==="WORLD_ACTOR_SPEECH_WORLD_STATE_STALE");
  const autonomousRaceAfter=await getWorldSimulationState(
    autonomousRaceSid,{fixtureRoot:goalFixtureRoot});
  const autonomousRaceHistory=await getWorldSimulationHistory(
    autonomousRaceSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(actorRaceWinnerCount,1);
  assert.equal(autonomousRaceAfter.revision,1);
  assert.equal(autonomousRaceHistory.turns.length,1);
  assert.equal(autonomousRaceHistory.turns[0].turn_id,
    "harness_cb_c4_competing_world_winner");
  assert.equal((autonomousRaceHistory.turns[0].action_outcomes??[]).length,0);
  console.log(JSON.stringify({
    scenario:"c2_eventless_actor_stale_cas",
    competing_world_commit_count:actorRaceWinnerCount,
    causal_speech_outcomes:0,old_actor_action_rejected:true,
  }));

  // The action must not bypass an existing queued event or address someone
  // absent from its one committed scene. Neither failure creates a World turn.
  for (const fault of ["external_event_pending","recipient_not_colocated"]) {
    const guardedWorld=structuredClone(spontaneousWorld);
    if(fault==="external_event_pending") {
      guardedWorld.event_queue=[{
        event_id:"cb_c4_prior_queued_world_event",type:"observation",
        scene_id:actionScene,participants:[character],
      }];
    } else {
      delete guardedWorld.scenes[actionScene].entity_positions[inquiryAlly];
    }
    const guarded=await beginWorldSimulationSession({
      source_text:"actor-initiated World speech guarded scenario "+fault,
      characters:Object.keys(guardedWorld.characters),
      initial_world_state:guardedWorld,
    },{fixtureRoot:goalFixtureRoot});
    const guardedSid=guarded.world_simulation_session_id;
    const guardedBefore=await getWorldSimulationState(
      guardedSid,{fixtureRoot:goalFixtureRoot});
    const guardedHistoryBefore=await getWorldSimulationHistory(
      guardedSid,{fixtureRoot:goalFixtureRoot});
    let called=0;
    const runGuard=()=>runWorldSimulationActorInitiatedSpeech({
      world_simulation_session_id:guardedSid,character,
      runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot,characterBrain:async ()=>{
      called++;return {action_id:speechCandidate.action_id};
    }});
    if(fault==="external_event_pending"){
      await assert.rejects(runGuard(),error=>error?.code==="WORLD_ACTOR_SPEECH_EXTERNAL_EVENT_PENDING");
    }else{
      const blocked=await runGuard();
      assert.equal(blocked.status,"no_grounded_speech_candidate");
      assert.equal(blocked.committed,false);
    }
    const guardedAfter=await getWorldSimulationState(
      guardedSid,{fixtureRoot:goalFixtureRoot});
    const guardedHistoryAfter=await getWorldSimulationHistory(
      guardedSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(called,0);
    assert.equal(guardedAfter.revision,guardedBefore.revision);
    assert.equal(guardedAfter.state_hash,guardedBefore.state_hash);
    assert.deepEqual(guardedHistoryAfter.turns,guardedHistoryBefore.turns);
  }

  // A custom runtime is not allowed to substitute another actor's Brain
  // identity or invoke the same actor's Brain twice. No partial plan, choice,
  // causal outcome or consumed internal opportunity may survive rejection.
  for (const fault of ["wrong_character","duplicate_callback"]) {
    const runtimeGuardSession=await beginWorldSimulationSession({
      source_text:"World actor speech runtime ingress guard "+fault,
      characters:Object.keys(spontaneousWorld.characters),
      initial_world_state:spontaneousWorld,
    },{fixtureRoot:goalFixtureRoot});
    const guardSid=runtimeGuardSession.world_simulation_session_id;
    const guardBefore=await getWorldSimulationState(guardSid,{fixtureRoot:goalFixtureRoot});
    const guardHistoryBefore=await getWorldSimulationHistory(guardSid,{fixtureRoot:goalFixtureRoot});
    let realBrainCount=0;
    const manager={
      runCharacterTurn:async ({brain_input,characterBrain})=>{
        if(fault==="wrong_character")
          return characterBrain({...brain_input,character:"substituted_actor"});
        const first=await characterBrain(brain_input);
        await characterBrain(brain_input);
        return first;
      },
    };
    await assert.rejects(runWorldSimulationActorInitiatedSpeech({
      world_simulation_session_id:guardSid,character,
      runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot,
      characterRuntimeManager:manager,
      characterBrain:async packet=>{
        realBrainCount++;
        const activation=packet.cognition.implementation_intention_activation;
        return {
          plan_activation_context_token:activation.context_token,
          activated_plan_tokens:[activation.plans[0].plan_token],
        };
      },
    }),error=>error?.code===(
      fault==="wrong_character"
        ? "WORLD_ACTOR_SPEECH_CHARACTER_MISMATCH"
        : "WORLD_ACTOR_SPEECH_DUPLICATE_BRAIN_INVOCATION"
    ));
    const guardAfter=await getWorldSimulationState(guardSid,{fixtureRoot:goalFixtureRoot});
    const guardHistory=await getWorldSimulationHistory(guardSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(realBrainCount,fault==="duplicate_callback"?1:0);
    assert.equal(guardAfter.revision,guardBefore.revision);
    assert.equal(guardAfter.state_hash,guardBefore.state_hash);
    assert.deepEqual(guardHistory.turns,guardHistoryBefore.turns);
    console.log(JSON.stringify({
      scenario:"world_actor_speech_runtime_ingress_guard",fault,
      real_brain_calls:realBrainCount,world_unchanged:true,
    }));
  }

  const actionSession=await beginWorldSimulationSession({
    source_text:"C2 eventless plan followed by source-declared World observation fixture",
    characters:Object.keys(actionWorld.characters),
    initial_world_state:actionWorld,
  },{fixtureRoot:goalFixtureRoot});
  const actionSid=actionSession.world_simulation_session_id;
  const actionRuntimeManager=createWorldSimulationCharacterRuntimeManager({
    identityResolver:async who=>({
      entity_id:"cb_c2_followup_actor",canonical_name:who,
      formal:true,identity_source:"cb_c3_eventless_plan_world_handoff_test",
    }),
  });
  let activationSeen=false;
  let guidanceSeen=false;
  const actionTurn=await runWorldSimulationTurn({
    world_simulation_session_id:actionSid,event_id:actionEventId,
  },{
    fixtureRoot:goalFixtureRoot,
    characterRuntimeManager:actionRuntimeManager,
    characterBrainNativeCapabilities:[nativeImplementationIntentionActivationCapability],
    characterBrain:async packet=>{
      assert.equal(packet.character,character);
      if(packet.cognition?.implementation_intention_activation){
        const activation=packet.cognition.implementation_intention_activation;
        activationSeen=true;
        assert.equal(activation.plans.length,1,
          "A C2-authored Phase69A plan must re-enter the normal Phase69C World cue resolver.");
        assert.equal(activation.plans[0].if_cue.label,
          "timer_doubt_requires_verification");
        return {
          plan_activation_context_token:activation.context_token,
          activated_plan_tokens:[activation.plans[0].plan_token],
        };
      }
      const guidance=packet.cognition?.implementation_intention_guidance;
      guidanceSeen=guidance?.implementation_intentions?.some(plan=>
        plan.then_response.label==="ask_trusted_ally")??false;
      assert.equal(guidanceSeen,true,
        "The plan produced by eventless C2 must guide the next real World decision.");
      assert.ok(packet.candidate_action_intents.some(row=>
        row.action_id===speechCandidate.action_id),
        "World must supply a real available communication candidate.");
      return {action_id:speechCandidate.action_id};
    },
  });
  const actionHistory=await getWorldSimulationHistory(
    actionSid,{fixtureRoot:goalFixtureRoot});
  const actionState=await getWorldSimulationState(
    actionSid,{fixtureRoot:goalFixtureRoot});
  const actionReceipt=actionHistory.turns.find(turn=>
    turn.turn_id===actionTurn.turn_id &&
    turn.revision_to===actionTurn.revision);
  assert.ok(actionReceipt,"A selected inquiry must have an exact committed World receipt.");
  const causalInquiries=(actionReceipt.action_outcomes??[]).filter(outcome=>
    outcome.actor===character &&
    outcome.action_id===speechCandidate.action_id &&
    outcome.result==="communication_emitted");
  console.log(JSON.stringify({
    scenario:"c2_plan_to_eventful_world_inquiry",
    c2_goals_prior:(planAfter.state.motivational_goal_history??[]).length,
    c2_plans_prior:(planAfter.state.goal_implementation_intention_history??[]).length,
    activation_seen:activationSeen,guidance_seen:guidanceSeen,
    selected_action:actionTurn.selected_action_intents?.[0]?.action_id??null,
    causal_speech_outcomes:causalInquiries.length,
    world_revision:actionState.revision,
    information_verified:false,
  }));
  assert.equal(actionTurn.committed,true);
  assert.equal(activationSeen,true);
  assert.equal(guidanceSeen,true);
  assert.equal(actionState.revision,1);
  assert.equal(actionTurn.selected_action_intents?.[0]?.action_id,
    speechCandidate.action_id);
  assert.equal(causalInquiries.length,1,
    "C2 goal-to-plan continuity must result in actual World speech, not a passive action receipt.");
  assert.equal(causalInquiries[0].communication_event?.addressee,inquiryAlly);
  assert.equal(causalInquiries[0].communication_event?.semantic_content,inquiryWords);
  assert.equal(causalInquiries[0].communication_event?.world_truth_claimed,false);
  assert.equal((actionState.state.motivational_goal_history??[]).length,2);
  assert.equal((actionState.state.goal_implementation_intention_history??[]).length,1);

  // A committed goal does not automatically demand a plan. Without an
  // explicit plan_intents reply, a C2 thought must remain read-only.
  const planNoIntentSession=await beginWorldSimulationSession({
    source_text:"C2 committed goal without plan selection",
    characters:Object.keys(baseWorldState.characters),
    initial_world_state:committedState.state,
  },{fixtureRoot:goalFixtureRoot});
  const noPlanSid=planNoIntentSession.world_simulation_session_id;
  const noPlan=await dispatchWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:noPlanSid,
    runtime_context_by_character:planCue,
  },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
    assert.equal(packet.native_plan_decision.committed_goals.length,1);
    return {disposition:"considered_plan_but_declined"};
  }});
  const noPlanState=await getWorldSimulationState(noPlanSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(noPlan.dispatch_count,1);
  assert.equal(noPlan.world_mutation_performed,false);
  assert.equal(noPlan.action_selection_performed,false);
  assert.equal(noPlanState.revision,0);
  assert.equal((noPlanState.state.goal_implementation_intention_history??[]).length,0);

  // A spontaneous action request must never silently count as a completed C2
  // cognition opportunity. This scheduler has no World action authority yet.
  // Reject instead of ignoring the chosen action and consuming the cue.
  for (const withPlan of [false,true]) {
    const actionIntentWorld={
      ...structuredClone(planAfter.state),
      event_queue:[],
      available_actions:{[character]:[speechCandidate]},
    };
    const rejectedActionSession=await beginWorldSimulationSession({
      source_text:"C2 eventless explicit action must be rejected until World handoff exists",
      characters:Object.keys(actionIntentWorld.characters),
      initial_world_state:actionIntentWorld,
    },{fixtureRoot:goalFixtureRoot});
    const rejectedActionSid=rejectedActionSession.world_simulation_session_id;
    const rejectedActionBefore=await getWorldSimulationState(
      rejectedActionSid,{fixtureRoot:goalFixtureRoot});
    const rejectedActionHistoryBefore=await getWorldSimulationHistory(
      rejectedActionSid,{fixtureRoot:goalFixtureRoot});
    await assert.rejects(
      dispatchWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id:rejectedActionSid,
        runtime_context_by_character:planCue,
      },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
        assert.equal(packet.boundaries.scheduler_action_selection_authority,false);
        assert.equal(packet.boundaries.native_plan_decision_action_authority,false);
        assert.equal(packet.native_plan_decision.committed_goals.length,1);
        return {
          action_id:speechCandidate.action_id,
          ...(withPlan ? {
            plan_context_token:packet.native_plan_decision.context_token,
            plan_intents:[{
              goal_token:packet.native_plan_decision.committed_goals[0].goal_token,
              cue_descriptor:{cue_kind:"opportunity",label:"timer_check_now"},
              response_descriptor:{response_kind:"seek_support",label:"ask_trusted_ally"},
            }],
          } : {}),
        };
      }}),
      error=>error?.code==="WORLD_SIMULATION_AUTONOMOUS_ACTION_INTENT_UNSUPPORTED"
        && Array.isArray(error.consumed_opportunity_ids)
        && error.consumed_opportunity_ids.length===0,
      "C2 cannot silently swallow an explicit action selection or partially write a companion plan."
    );
    const rejectedActionAfter=await getWorldSimulationState(
      rejectedActionSid,{fixtureRoot:goalFixtureRoot});
    const rejectedActionHistoryAfter=await getWorldSimulationHistory(
      rejectedActionSid,{fixtureRoot:goalFixtureRoot});
    const replayAfterRejection=await scheduleWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:rejectedActionSid,runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot});
    assert.equal(rejectedActionAfter.revision,rejectedActionBefore.revision);
    assert.equal(rejectedActionAfter.state_hash,rejectedActionBefore.state_hash);
    assert.deepEqual(rejectedActionHistoryAfter.turns,rejectedActionHistoryBefore.turns);
    assert.equal(replayAfterRejection.scheduler_projection.opportunity_count,1,
      "An unsupported action must not durably consume the character's internal cue.");
    console.log(JSON.stringify({
      scenario:"c2_eventless_action_intent_must_not_be_silently_consumed",
      with_plan_intent:withPlan,
      expected_error:"WORLD_SIMULATION_AUTONOMOUS_ACTION_INTENT_UNSUPPORTED",
      world_unchanged:true,opportunity_preserved:true,
    }));
  }

  for(const [fault,code] of [
    ["forged_goal_token","WORLD_SIMULATION_NATIVE_PLAN_GOAL_TOKEN_INVALID"],
    ["stale_context","WORLD_SIMULATION_NATIVE_PLAN_CONTEXT_MISMATCH"],
    ["invalid_plan_intents","WORLD_SIMULATION_NATIVE_PLAN_INTENT_INVALID"],
    ["mixed_goal_plan","WORLD_SIMULATION_AUTONOMOUS_GOAL_PLAN_MIXED_BATCH_UNSUPPORTED"],
  ]) {
    const invalid=await beginWorldSimulationSession({
      source_text:`C2 eventless invalid plan ${fault}`,
      characters:Object.keys(baseWorldState.characters),
      initial_world_state:committedState.state,
    },{fixtureRoot:goalFixtureRoot});
    const invalidSid=invalid.world_simulation_session_id;
    const pre=await getWorldSimulationState(invalidSid,{fixtureRoot:goalFixtureRoot});
    const preHistory=await getWorldSimulationHistory(invalidSid,{fixtureRoot:goalFixtureRoot});
    await assert.rejects(dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:invalidSid,
      runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      const view=packet.native_plan_decision;
      assert.equal(view.committed_goals.length,1);
      const intent={
        goal_token:fault==="forged_goal_token"?"forged_goal_ref":view.committed_goals[0].goal_token,
        cue_descriptor:{cue_kind:"opportunity",label:"timer_doubt_requires_verification"},
        response_descriptor:{response_kind:"seek_support",label:"ask_trusted_ally"},
      };
      const response={
        plan_context_token:fault==="stale_context"?"outdated_plan_context":view.context_token,
        plan_intents:fault==="invalid_plan_intents"?{}:[intent],
      };
      if(fault==="mixed_goal_plan"){
        const goalView=packet.native_goal_decision;
        assert.equal(goalView.motivation_basis.length,1);
        response.goal_context_token=goalView.context_token;
        response.goal_intents=[{
          operation:"propose",goal_kind:"achieve_state",domain:"inquiry",
          target_descriptor:{label:"查證第二件物品"},
          motivation_basis_tokens:[goalView.motivation_basis[0].source_token],
          motivation_relations:["supports"],
        }];
      }
      return response;
    }}),error=>error?.code===code,
      `C2 plan validator must reject ${fault} without a partial World write`);
    const post=await getWorldSimulationState(invalidSid,{fixtureRoot:goalFixtureRoot});
    const postHistory=await getWorldSimulationHistory(invalidSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(post.revision,pre.revision);
    assert.equal(post.state_hash,pre.state_hash);
    assert.deepEqual(postHistory.turns,preHistory.turns);
    assert.deepEqual(post.state.event_queue,pre.state.event_queue);
    assert.equal((post.state.goal_implementation_intention_history??[]).length,0);
    assert.equal((post.state.motivational_goal_history??[]).length,2);
    console.log(JSON.stringify({
      scenario:"c2_eventless_plan_negative",fault,
      expected_error:code,world_revision_unchanged:true,history_unchanged:true,
    }));
  }

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

  // Two real prior-turn subjective beliefs, with separate owners, must be
  // processed as ONE eventless goal transaction. A foreign/invalid second
  // Brain intent cannot leave the first character's goal partially written.
  const second = "內在提示角色";
  const secondMemory = structuredClone(memory);
  secondMemory.memory_id = "memory_c2_other_actor_observation";
  secondMemory.content.description = "門邊的時鐘看起來慢了五分鐘。";
  secondMemory.internal_provenance.event_id = "other_actor_observation";
  secondMemory.internal_provenance.observation_hash = "other_actor_observation_hash";
  let multiState = {
    ...structuredClone(baseWorldState),
    memories: {
      [character]:[structuredClone(memory)],
      [second]:[secondMemory],
      "無事角色":[],
    },
  };
  const multiClaims = buildWorldSimulationSubjectiveClaims({
    world_state: multiState, turn_id: sourceTurn,
    source_memory_records:[
      {character,memory_record:memory},
      {character:second,memory_record:secondMemory},
    ],
    claim_proposals:[
      {proposal_ref:"first_own_evidence",character,
        proposition:"我看見計時器上標著四十分鐘。",
        evidence:[{source_memory_ref:memory.memory_id,relation:"supports"}]},
      {proposal_ref:"second_own_evidence",character:second,
        proposition:"我看見門邊的時鐘可能慢了五分鐘。",
        evidence:[{source_memory_ref:secondMemory.memory_id,relation:"supports"}]},
    ],
  });
  multiState = executeFixture(multiState,"multi_subjective_claim",multiClaims);
  const multiResolution=resolveWorldSimulationSubjectiveBeliefs({
    world_state:multiState,turn_id:sourceTurn,
  });
  const multiRevision=buildWorldSimulationSubjectiveBeliefRevisions({
    world_state:multiState,turn_id:sourceTurn,resolution:multiResolution.result,
  });
  multiState=executeFixture(multiState,"subjective_belief_revision",multiRevision);
  assert.equal(multiState.subjective_belief_revision_history.length,2);
  const multiRuntime={
    [character]:{idle:true},
    [second]:{pending_internal_cues:[{
      kind:"memory_reactivation",source_ref:"runtime-current-mind-other-memory-cue",
    }]},
  };
  for(const invalidSecond of [false,true]){
    const multiSession=await beginWorldSimulationSession({
      source_text:`CB-C2 atomic goal batch ${invalidSecond?"reject":"commit"}`,
      characters:Object.keys(baseWorldState.characters),
      initial_world_state:multiState,
    },{fixtureRoot:goalFixtureRoot});
    const multiSid=multiSession.world_simulation_session_id;
    const pre=await getWorldSimulationState(multiSid,{fixtureRoot:goalFixtureRoot});
    const historyPre=await getWorldSimulationHistory(multiSid,{fixtureRoot:goalFixtureRoot});
    const seenCharacters=[];
    const invoke=()=>dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:multiSid,
      runtime_context_by_character:multiRuntime,
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      seenCharacters.push(packet.character);
      const view=packet.native_goal_decision;
      assert.equal(view.character,packet.character);
      assert.equal(view.motivation_basis.length,1);
      const goal={
        operation:"propose",goal_kind:"achieve_state",domain:"inquiry",
        target_descriptor:{label:packet.character===character
          ?"查證計時器實際上限":"查證門邊的時鐘走時"},
        motivation_basis_tokens:[view.motivation_basis[0].source_token],
        motivation_relations:["supports"],
      };
      if(invalidSecond && packet.character===second){
        goal.motivation_basis_tokens=["foreign_or_forged_source"];
      }
      return {goal_context_token:view.context_token,goal_intents:[goal]};
    }});
    if(invalidSecond){
      await assert.rejects(invoke(),error =>
        error?.code==="WORLD_SIMULATION_NATIVE_GOAL_SOURCE_TOKEN_INVALID",
      "The second Brain's illegal source must abort all other goal intents.");
    }else{
      const result=await invoke();
      assert.equal(result.dispatch_count,2);
      assert.equal(result.action_selection_performed,false);
      assert.equal(result.durable_cognitive_write_performed,true);
      assert.equal(result.world_mutation_performed,true);
    }
    assert.deepEqual([...seenCharacters].sort(),[character,second].sort());
    const post=await getWorldSimulationState(multiSid,{fixtureRoot:goalFixtureRoot});
    const historyPost=await getWorldSimulationHistory(multiSid,{fixtureRoot:goalFixtureRoot});
    assert.equal(post.revision,pre.revision+(invalidSecond?0:1));
    assert.equal(historyPost.turns.length,historyPre.turns.length+(invalidSecond?0:1));
    assert.equal((post.state.motivational_goal_history??[]).length,invalidSecond?0:2);
    assert.deepEqual(post.state.event_queue,pre.state.event_queue);
    assert.equal(post.state.simulation_time,pre.state.simulation_time);
    if(invalidSecond){
      assert.equal(post.state_hash,pre.state_hash);
      assert.deepEqual(historyPost.turns,historyPre.turns);
    }else{
      assert.equal(historyPost.turns.at(-1).event,null);
      assert.equal(historyPost.turns.at(-1).autonomous_cognition_goal_commitment?.goal_event_count,2);
      const alreadyCommitted=await scheduleWorldSimulationAutonomousCognitionOpportunities({
        world_simulation_session_id:multiSid,
        runtime_context_by_character:multiRuntime,
      },{fixtureRoot:goalFixtureRoot});
      assert.equal(alreadyCommitted.scheduler_projection.opportunity_count,0,
        "Both participant opportunities must be durably consumed after the batch.");
    }
    console.log(JSON.stringify({
      scenario:"c2_eventless_goal_two_actor_atomicity",invalid_second:invalidSecond,
      checked_brains:seenCharacters.length,goal_events:(post.state.motivational_goal_history??[]).length,
      state_revision:post.revision,history_turns:historyPost.turns.length,
    }));
  }

  // A real Phase69A plan intent is also revision-bound. If another World
  // transaction wins after the Brain saw its committed goal token, the old
  // plan must never be reinterpreted or committed against the new snapshot.
  const planRacing=await beginWorldSimulationSession({
    source_text:"CB-C2 Phase69A plan writer CAS interleaving",
    characters:Object.keys(baseWorldState.characters),
    initial_world_state:committedState.state,
  },{fixtureRoot:goalFixtureRoot});
  const planRacingSid=planRacing.world_simulation_session_id;
  let planRaceWinnerCount=0;
  await assert.rejects(
    dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:planRacingSid,
      runtime_context_by_character:planCue,
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      const planView=packet.native_plan_decision;
      assert.equal(planView.committed_goals.length,1);
      const atIngress=await getWorldSimulationState(
        planRacingSid,{fixtureRoot:goalFixtureRoot});
      await commitWorldSimulationTurn(planRacingSid,{
        expected_revision:atIngress.revision,
        expected_state_hash:atIngress.state_hash,
        turn_id:"harness_competing_plan_cas_winner",
        next_world_state:atIngress.state,
        event:null,
        selected_action_intents:[],
        action_outcomes:[],
        state_transitions:[],
      },{fixtureRoot:goalFixtureRoot});
      planRaceWinnerCount++;
      return {
        plan_context_token:planView.context_token,
        plan_intents:[{
          goal_token:planView.committed_goals[0].goal_token,
          cue_descriptor:{cue_kind:"opportunity",label:"timer_doubt_requires_verification"},
          response_descriptor:{response_kind:"seek_support",label:"ask_trusted_ally"},
        }],
      };
    }}),
    error=>error?.code==="WORLD_SIMULATION_AUTONOMOUS_GOAL_COMMIT_STALE",
    "A late competing World revision must reject the old Phase69A plan without partial writes."
  );
  const planRaceAfter=await getWorldSimulationState(
    planRacingSid,{fixtureRoot:goalFixtureRoot});
  const planRaceHistory=await getWorldSimulationHistory(
    planRacingSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(planRaceWinnerCount,1);
  assert.equal(planRaceAfter.revision,1);
  assert.equal((planRaceAfter.state.goal_implementation_intention_history??[]).length,0);
  assert.equal((planRaceAfter.state.motivational_goal_history??[]).length,2);
  assert.equal(planRaceHistory.turns.length,1);
  assert.equal(planRaceHistory.turns[0].turn_id,"harness_competing_plan_cas_winner");
  assert.deepEqual(planRaceAfter.state.event_queue,committedState.state.event_queue);
  console.log(JSON.stringify({
    scenario:"c2_eventless_plan_stale_cas",
    competing_world_commit_count:planRaceWinnerCount,
    final_revision:planRaceAfter.revision,
    plan_events:0,c2_stale_plan_rejected:true,
  }));

  // Simulate an unrelated, legitimate World CAS winner after the C2 Brain
  // receives a valid source token but before the C2 goal writer executes.
  // The competing transaction is harness-owned and writes no event/goal.
  // The old C2 snapshot must fail closed, retaining only the winner.
  const racing = await beginWorldSimulationSession({
    source_text:"CB-C2 goal writer CAS interleaving",
    characters:Object.keys(baseWorldState.characters),
    initial_world_state:state,
  },{fixtureRoot:goalFixtureRoot});
  const racingSid=racing.world_simulation_session_id;
  let competingCommitCount=0;
  await assert.rejects(
    dispatchWorldSimulationAutonomousCognitionOpportunities({
      world_simulation_session_id:racingSid,
      runtime_context_by_character:{[character]:{idle:true}},
    },{fixtureRoot:goalFixtureRoot,characterBrain:async packet=>{
      const oldView=packet.native_goal_decision;
      assert.equal(oldView.motivation_basis.length,1);
      const atIngress=await getWorldSimulationState(racingSid,{fixtureRoot:goalFixtureRoot});
      await commitWorldSimulationTurn(racingSid,{
        expected_revision:atIngress.revision,
        expected_state_hash:atIngress.state_hash,
        turn_id:"harness_competing_cas_winner",
        next_world_state:atIngress.state,
        event:null,
        selected_action_intents:[],
        action_outcomes:[],
        state_transitions:[],
      },{fixtureRoot:goalFixtureRoot});
      competingCommitCount++;
      return {
        goal_context_token:oldView.context_token,
        goal_intents:[{
          operation:"propose",goal_kind:"achieve_state",domain:"inquiry",
          target_descriptor:{label:"查證計時器實際上限"},
          motivation_basis_tokens:[oldView.motivation_basis[0].source_token],
          motivation_relations:["supports"],
        }],
      };
    }}),
    error=>error?.code==="WORLD_SIMULATION_AUTONOMOUS_GOAL_COMMIT_STALE",
    "The C2 goal writer must reject an interleaving revision winner, never retry an old intent."
  );
  const raceAfter=await getWorldSimulationState(racingSid,{fixtureRoot:goalFixtureRoot});
  const raceHistory=await getWorldSimulationHistory(racingSid,{fixtureRoot:goalFixtureRoot});
  assert.equal(competingCommitCount,1);
  assert.equal(raceAfter.revision,1);
  assert.equal((raceAfter.state.motivational_goal_history??[]).length,0);
  assert.equal(raceHistory.turns.length,1);
  assert.equal(raceHistory.turns[0].turn_id,"harness_competing_cas_winner");
  assert.deepEqual(raceAfter.state.event_queue,[]);
  console.log(JSON.stringify({
    scenario:"c2_eventless_goal_stale_cas",
    competing_world_commit_count:competingCommitCount,
    final_revision:raceAfter.revision,goal_events:0,
    c2_stale_write_rejected:true,
  }));
} finally {
  await rm(goalFixtureRoot,{recursive:true,force:true});
}

console.log("CB-C2 autonomous cognition scheduler tests passed.");
