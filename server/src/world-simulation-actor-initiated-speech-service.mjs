import { hashAgentRunValue } from "./agent-run-service.mjs";
import { assertWorldSimulationSession } from "./world-simulation-session-service.mjs";
import { getWorldSimulationState, commitWorldSimulationTurn } from "./world-simulation-state-service.mjs";
import { scheduleWorldSimulationAutonomousCognitionOpportunities } from "./world-simulation-loop-service.mjs";
import { projectWorldSimulationConsciousCognitionAdmission } from "./world-simulation-autonomous-cognition-scheduler-service.mjs";
import {
  buildWorldSimulationGoalImplementationIntentionActivationResolverView,
  buildWorldSimulationNativeImplementationIntentionActivationView,
  resolveWorldSimulationNativeImplementationIntentionActivationIntent,
  projectWorldSimulationGoalImplementationIntentionActivation,
} from "./world-simulation-goal-implementation-intention-activation-service.mjs";
import { runWorldSimulationNativeCapability } from "./world-simulation-neural-service.mjs";
import { adjudicateWorldSimulationCausality } from "./world-simulation-causal-rule-engine.mjs";

export const worldSimulationActorInitiatedSpeechVersion =
  "cb-c4-world-owned-eventless-actor-speech-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function array(value) { return Array.isArray(value) ? value : []; }
function clone(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function reject(code, message) {
  const error = new Error(message);
  error.code = code;
  error.consumed_opportunity_ids = [];
  throw error;
}
function sameCharacter(a, b) {
  return typeof a === "string" && typeof b === "string"
    && a.trim().toLocaleLowerCase("zh-Hant-TW") === b.trim().toLocaleLowerCase("zh-Hant-TW");
}
function exactCharacterValue(record, name) {
  const found = Object.entries(object(record)).filter(([key]) => sameCharacter(key, name));
  if (found.length !== 1) return null;
  return found[0][1];
}
function presentAt(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}
function sceneForActor(worldState, actor) {
  const found = Object.entries(object(worldState.scenes)).filter(([,scene]) =>
    presentAt(exactCharacterValue(scene?.entity_positions, actor)));
  if (found.length !== 1) reject("CB_C4_ACTOR_SCENE_UNRESOLVED",
    "Actor-initiated speech requires exactly one committed scene containing the actor.");
  return { sceneId: found[0][0], scene: found[0][1] };
}
function eligibleSpeechCandidates(worldState, actor, scene) {
  const positions = object(scene.entity_positions);
  const list = array(exactCharacterValue(worldState.available_actions, actor));
  if (list.length > 24) reject("CB_C4_ACTION_CATALOG_UNBOUNDED",
    "Actor-initiated speech requires a bounded World action catalog.");
  const ids = new Set();
  const admitted = [];
  for (const candidate of list) {
    const c = object(candidate);
    const communication = object(c.communication);
    if (typeof c.action_id !== "string" || !c.action_id.trim()
      || typeof c.intent !== "string" || !c.intent.trim()
      || ids.has(c.action_id)) reject("CB_C4_ACTION_CATALOG_INVALID",
        "World action catalog contains a malformed or duplicate candidate.");
    ids.add(c.action_id);
    if (communication.channel !== "speech") continue;
    const addressee = communication.addressee;
    if (typeof addressee !== "string" || sameCharacter(addressee, actor)
      || !presentAt(exactCharacterValue(positions, addressee))) continue;
    admitted.push(clone(c));
  }
  return admitted;
}
function assertNoConcurrentWorldWork(state) {
  if (array(state.event_queue).length) reject("CB_C4_EXTERNAL_EVENT_PENDING",
    "A queued World event has precedence over an actor-initiated speech turn.");
  if (array(state.sound_events).length) reject("CB_C4_ACOUSTIC_INGRESS_PENDING",
    "Actor-initiated speech cannot skip unresolved acoustic perception.");
  if (Object.values(object(state.projectiles)).some(p => p?.active === true)
    || Object.values(object(state.ability_fields)).some(p => p?.active === true))
    reject("CB_C4_PHYSICAL_PROCESS_PENDING",
      "Actor-initiated speech cannot bypass pending active physical processes.");
}
function assertExactState(before, after) {
  if (before.revision !== after.revision || before.state_hash !== after.state_hash)
    reject("CB_C4_WORLD_STATE_STALE",
      "An actor-initiated action cannot reuse an obsolete World state.");
}
async function invokeBrain(packet, actor, sessionId, options, before) {
  const current = await getWorldSimulationState(sessionId, options);
  assertExactState(before, current);
  if (!projectWorldSimulationConsciousCognitionAdmission(current.state, actor).admitted)
    reject("CB_C4_CONSCIOUS_ADMISSION_DENIED", "Sleeping actor cannot choose speech.");
  if (options.characterRuntimeManager?.runCharacterTurn) {
    let callbackError=null, completed=false;
    const result=await options.characterRuntimeManager.runCharacterTurn({
      world_simulation_session_id:sessionId, character:actor,
      brain_input:packet,
      characterBrain:async incoming=>{
        try {
          const atIngress=await getWorldSimulationState(sessionId,options);
          assertExactState(before,atIngress);
          completed=true;
          return await options.characterBrain(incoming);
        } catch(error) {callbackError=error;throw error;}
      },
    },options);
    if(callbackError) throw callbackError;
    if(!completed) reject("CB_C4_BRAIN_CALLBACK_NOT_COMPLETED",
      "Actor cognition must actually invoke the Character Brain.");
    return result;
  }
  return options.characterBrain(clone(packet));
}

/**
 * Narrow CB-C4 native slice: a currently admitted, awake actor may voluntarily
 * speak to a colocated character, using an existing World-owned candidate.
 * The internal cognition cue is not an external event. The causal rule engine,
 * native consistency critic and atomic World writer own the actual outcome.
 * This function does not author an ally reply or assert information was verified.
 */
export async function runWorldSimulationActorInitiatedSpeech(input = {}, options = {}) {
  if (typeof options.characterBrain !== "function")
    reject("CB_C4_CHARACTER_BRAIN_REQUIRED", "Actor-initiated speech requires a Character Brain.");
  if (options.causalAdjudicator !== undefined)
    reject("CB_C4_CUSTOM_CAUSAL_ADJUDICATOR_FORBIDDEN",
      "Actor-initiated speech always uses canonical World causal rules.");
  const sessionId=input.world_simulation_session_id;
  const actor=input.character;
  if (typeof sessionId !== "string" || !sessionId.trim()
    || typeof actor !== "string" || !actor.trim())
    reject("CB_C4_INPUT_INVALID", "Session and actor are required.");
  await assertWorldSimulationSession(sessionId,options);
  const before=await getWorldSimulationState(sessionId,options);
  const state=before.state;
  assertNoConcurrentWorldWork(state);
  if (!projectWorldSimulationConsciousCognitionAdmission(state,actor).admitted)
    reject("CB_C4_CONSCIOUS_ADMISSION_DENIED","Sleeping actor cannot initiate speech.");
  if (!exactCharacterValue(state.characters,actor))
    reject("CB_C4_ACTOR_NOT_FOUND","Actor must exist in committed World.");
  const {sceneId,scene}=sceneForActor(state,actor);
  const scheduled=await scheduleWorldSimulationAutonomousCognitionOpportunities({
    world_simulation_session_id:sessionId,
    runtime_context_by_character:input.runtime_context_by_character??{},
  },options);
  if (scheduled.state_revision !== before.revision
    || scheduled.world_state_hash !== before.state_hash)
    reject("CB_C4_WORLD_STATE_STALE","Actor cognition opportunity lost its World source.");
  const opportunities=scheduled.scheduler_projection.opportunities.filter(item=>
    sameCharacter(item.character,actor));
  if (opportunities.length===0) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"no_new_internal_opportunity",committed:false,action_selection_performed:false,
  });
  if (opportunities.length!==1) reject("CB_C4_OPPORTUNITY_AMBIGUOUS",
    "Actor-initiated speech requires one distinct canonical cognition opportunity.");
  const candidates=eligibleSpeechCandidates(state,actor,scene);
  if (!candidates.length) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"no_grounded_speech_candidate",committed:false,action_selection_performed:false,
  });
  const turnId="world_actor_speech_"+hashAgentRunValue({
    session_id:sessionId,actor,revision:before.revision,
    state_hash:before.state_hash,opportunity_id:opportunities[0].opportunity_id,
  }).slice(0,24);
  const context=clone(exactCharacterValue(scene.observable_by,actor)??{});
  const resolverView=buildWorldSimulationGoalImplementationIntentionActivationResolverView({
    world_state:state,character:actor,current_turn_id:turnId,
    current_context:{perception:context},
  });
  const activationView=buildWorldSimulationNativeImplementationIntentionActivationView({
    resolver_view:resolverView,
  });
  if (activationView.plans.length===0) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"no_prior_applicable_plan",committed:false,action_selection_performed:false,
  });
  const activation=await invokeBrain({
    character:actor,
    cognition:{
      autonomous_opportunity:{
        present:true, trigger_kinds:clone(opportunities[0].trigger_kinds),
      },
      implementation_intention_activation:clone(activationView),
    },
    boundaries:{
      external_world_event_present:false,
      actor_initiated_speech_choice_stage:"plan_cue_activation",
      world_truth_exposed:false, action_selection_requested:false,
    },
  },actor,sessionId,options,before);
  if (object(activation).action_id !== undefined)
    reject("CB_C4_ACTION_STAGE_INVALID","Plan activation cannot directly select an action.");
  const selectedPlans=resolveWorldSimulationNativeImplementationIntentionActivationIntent({
    resolver_view:resolverView,brain_result:activation,
  });
  if (!selectedPlans.activated_plan_refs.length) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"no_plan_activation",committed:false,action_selection_performed:false,
  });
  const guidance=projectWorldSimulationGoalImplementationIntentionActivation({
    resolver_view:resolverView,activated_plan_refs:selectedPlans.activated_plan_refs,
  });
  const candidateResult=await runWorldSimulationNativeCapability("world_action_proposer",{
    character:actor,available_actions:clone(candidates),
    cognition:{
      implementation_intention_guidance:{
        implementation_intentions:clone(guidance.implementation_intention_guidance),
        advisory_only:true,selected_action_authority:false,
      },
      current_goal:exactCharacterValue(state.characters,actor)?.current_goal??null,
    },
    current_action:exactCharacterValue(state.characters,actor)?.current_action??null,
  },{...options,run_id:sessionId,source:"cb_c4_actor_initiated_speech"});
  const proposed=object(candidateResult.output?.character_view??candidateResult.output);
  const menu=array(proposed.candidate_action_intents);
  if (!menu.length) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"no_admitted_action_candidates",committed:false,action_selection_performed:false,
  });
  const proposalIds=new Set();
  for (const candidate of menu) {
    const source=candidates.find(item=>item.action_id===candidate?.action_id);
    if (!source || proposalIds.has(candidate.action_id))
      reject("CB_C4_ACTION_CATALOG_EXPANDED",
        "Neural action consideration cannot add or duplicate World candidates.");
    proposalIds.add(candidate.action_id);
    if (hashAgentRunValue(candidate)!==hashAgentRunValue(source))
      reject("CB_C4_ACTION_CANDIDATE_MUTATED",
        "Action proposer cannot change World-owned action payloads behind a stable action ID.");
  }
  const response=await invokeBrain({
    character:actor,
    cognition:{
      autonomous_opportunity:{
        present:true,trigger_kinds:clone(opportunities[0].trigger_kinds),
      },
      implementation_intention_guidance:{
        implementation_intentions:clone(guidance.implementation_intention_guidance),
        advisory_only:true,selected_action_authority:false,
      },
    },
    candidate_action_intents:clone(menu),
    boundaries:{
      external_world_event_present:false,world_truth_exposed:false,
      actor_initiated_speech_choice_stage:"action_choice",
      action_choice_owner:"character_brain",
      causal_result_owner:"world_simulation_causal_rule_engine",
    },
  },actor,sessionId,options,before);
  if (object(response).goal_intents!==undefined || object(response).plan_intents!==undefined)
    reject("CB_C4_MIXED_COGNITIVE_WRITE_UNSUPPORTED",
      "Actor-initiated action cannot mix goal or plan writes into its causal turn.");
  const actionId=object(response).action_id;
  if (actionId==="reject_all" || actionId==null) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"brain_declined_action",committed:false,action_selection_performed:false,
  });
  if (typeof actionId!=="string" || !actionId.trim())
    reject("CB_C4_ACTION_SELECTION_INVALID","Actor must select a concrete candidate or decline.");
  const candidate=menu.find(item=>item?.action_id===actionId);
  if (!candidate) reject("CB_C4_ACTION_NOT_AVAILABLE",
    "Actor tried to select a speech action outside its World catalog.");
  const trustedCandidate=candidates.find(item=>item.action_id===actionId);
  if (!trustedCandidate || hashAgentRunValue(trustedCandidate)!==hashAgentRunValue(candidate))
    reject("CB_C4_ACTION_CANDIDATE_MUTATED",
      "Causal action must retain the exact trusted World candidate.");
  const selected=[{
    character:actor,selection:"candidate_action_intent",
    action_id:actionId,intent:trustedCandidate.intent??null,candidate:clone(trustedCandidate),
  }];
  const current=await getWorldSimulationState(sessionId,options);
  assertExactState(before,current);
  const event={
    event_id:turnId,scene_id:sceneId,
    type:"actor_initiated_speech_causal_context",
    simulation_time:state.simulation_time,participants:[actor],
  };
  // This is an engine-local causal context ONLY: it is never enqueued,
  // persisted as an external event, or sent as a character observation.
  const causal=await adjudicateWorldSimulationCausality({
    world_simulation_session_id:sessionId,turn_id:turnId,
    world_state:clone(state),world_state_revision:before.revision,
    world_state_hash:before.state_hash,event,
    selected_action_intents:clone(selected),
  });
  if (!array(causal.action_outcomes).some(outcome=>
    sameCharacter(outcome?.actor,actor) && outcome?.action_id===actionId))
    reject("CB_C4_CAUSAL_OUTCOME_MISSING",
      "World must produce an actual action outcome for actor-initiated speech.");
  const critic=await runWorldSimulationNativeCapability("world_consistency_critic",{
    state_transitions:array(causal.state_transitions),
    object_holders:array(causal.object_holders),
    knowledge_transitions:array(causal.knowledge_transitions),
    action_outcomes:array(causal.action_outcomes),
  },{...options,run_id:sessionId,source:"cb_c4_actor_initiated_consistency"});
  const gate=object(critic.output?.commit_gate_view??critic.output);
  if ((gate.hard_conflict_count??0)>0) return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"world_consistency_conflict",committed:false,action_selection_performed:true,
  });
  const result=await commitWorldSimulationTurn(sessionId,{
    expected_revision:before.revision,expected_state_hash:before.state_hash,
    turn_id:turnId,next_world_state:causal.next_world_state,event:null,
    selected_action_intents:selected,
    state_transitions:array(causal.state_transitions),
    action_outcomes:array(causal.action_outcomes),
    knowledge_transitions:array(causal.knowledge_transitions),
    scheduled_events:array(causal.scheduled_events),
    causal_timeline:causal.causal_timeline??null,
    chronological_mutation_queue:causal.chronological_mutation_queue,
    chronological_mutation_execution:causal.chronological_mutation_execution,
    causal_resolution_id:causal.causal_resolution_id,
    autonomous_actor_initiated_action:{
      version:worldSimulationActorInitiatedSpeechVersion,
      character:actor,scene_id:sceneId,action_id:actionId,
      consumed_opportunity_ids:[opportunities[0].opportunity_id],
      causal_resolution_id:causal.causal_resolution_id,
    },
  },options);
  return Object.freeze({
    version:worldSimulationActorInitiatedSpeechVersion,
    status:"world_causal_action_committed",committed:true,
    turn_id:turnId,revision:result.state.revision,
    previous_state_hash:before.state_hash,next_state_hash:result.state.state_hash,
    action_selection_performed:true,selected_action_intents:clone(selected),
    action_outcomes:clone(causal.action_outcomes),
    external_world_event_created:false,
    information_verified:false,
  });
}
