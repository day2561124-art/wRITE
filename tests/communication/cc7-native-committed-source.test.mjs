import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  getWorldSimulationHistory, getWorldSimulationState,
  worldSimulationStatePaths,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  assertWorldSimulationCommittedAcousticSource,
  worldSimulationNativeCommittedSourceVersion,
} from "../../server/src/world-simulation-native-committed-source-service.mjs";

const fixtureRoot=path.join(projectRoot,"tests",".tmp",
  "cc7af-committed-source-"+process.pid+"-"+Date.now());
const options={fixtureRoot};
await rm(fixtureRoot,{recursive:true,force:true});
try {
  const goalA={
    character:"A",purpose:"告知",addressee:"B",mode:"direct",
    public_content:"男孩離開房子",claim_kind:"sincere_assertion",
    surface_realization:{
      schema_version:"cc5-mandarin-clause-request-v1",
      semantic_anchor:"男孩離開房子",
      clause:{subject:"男孩",predicate:"離開",object:"房子"},
    },
  };
  const session=await beginWorldSimulationSession({
    simulation_label:"CC7AF authoritative committed source",
    seed:"cc7af-immutable-sound",
    rules:{event_driven:true,persistent_causality:true,
      communication_action_seconds:0.3,
      communication_speech_stream_increment_max_chars:2},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{event_id:"talk",type:"conversation",scene_id:"room",
        participants:["A","B"],summary:"A speaks before B"},
        {event_id:"later",type:"conversation",scene_id:"room",
          participants:["A","B"],summary:"A later quiet World turn"},
        {event_id:"renewed",type:"conversation",scene_id:"room",
          participants:["A","B"],summary:"Fresh source may speak in new turn"}],
      scenes:{room:{
        scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
        dimensions:{width_m:6,depth_m:6},
        entity_positions:{A:{x:1,y:1},B:{x:2,y:1}},
        audibility_profiles:{A:{minimum_audible_db:35},
          B:{minimum_audible_db:35}},
        observable_by:{A:{visual:[],audible:[]},
          B:{visual:[],audible:[]}},
      }},
      characters:{
        A:{known:["男孩離開房子"],current_goal:"告知B",
          speech_acoustics:{sound_level_db_at_1m:65},
          communication_goal:goalA},
        B:{known:[],current_goal:"聽A說話",
          speech_acoustics:{sound_level_db_at_1m:65}},
      },
      memories:{A:[],B:[]},available_actions:{A:[],B:[]},
    },
  },options);
  const characterRuntimeManager=createWorldSimulationCharacterRuntimeManager({
    identityResolver:async(character)=>({
      entity_id:"character_"+character.toLowerCase(),
      canonical_name:character,formal:true,
      identity_source:"cc7af_committed_source_test",
    }),
  });
  const actual=await runWorldSimulationTurn({
    world_simulation_session_id:session.world_simulation_session_id,
    event_id:"talk",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      const candidate=packet.candidate_action_intents.find(
        item=>item.communication?.surface_realization_complete===true
          &&item.communication?.channel==="speech");
      assert(candidate);return {action_id:candidate.action_id};
    },
  });
  assert.equal(actual.committed,true);
  const sid=session.world_simulation_session_id;
  const history=await getWorldSimulationHistory(sid,options);
  const snapshot=await getWorldSimulationState(sid,options);
  assert.equal(history.turns.length,1);
  const turn=history.turns[0];
  const source=turn.action_outcomes.find(item=>
    item.actor==="A"&&item.result==="communication_emitted"
      &&item.communication_event?.channel==="speech");
  const acoustic=turn.communication_observer_increment_admissions.find(item=>
    item.observer==="B"&&item.admission_status==="heard_acoustic_cues_only"
      &&item.audit?.source_action_id===source.action_id);
  assert(source&&acoustic?.observer_increment);
  const dependency={
    session_id:sid,
    source_turn_id:turn.turn_id,
    source_turn_hash:hashAgentRunValue(turn),
    source_action_id:source.action_id,
    source_character:"A",observer:"B",
    observer_increment_ref:acoustic.observer_increment.increment_ref,
    release_time_ms:acoustic.release_time_ms,
    expected_source_receipt_bundle_hash:
      turn.subjective_choice_commitment_receipts.receipt_bundle_hash,
    expected_source_revision_to:turn.revision_to,
    expected_source_next_state_hash:turn.next_state_hash,
    expected_current_revision:snapshot.revision,
    expected_current_state_hash:snapshot.state_hash,
  };
  const audit=await assertWorldSimulationCommittedAcousticSource(
    dependency,options);
  assert.equal(audit.schema_version,worldSimulationNativeCommittedSourceVersion);
  assert.equal(audit.status,"committed_source_verified_without_retraction");
  assert.equal(audit.source_turn_hash,dependency.source_turn_hash);
  assert.equal(audit.source_turn_revision_to,1);
  assert.equal(audit.source_release_time_ms,acoustic.release_time_ms);
  assert.equal(audit.previously_committed_sound_retracted,false);
  assert.equal(audit.speculative_dependency_authorized_to_speak,false);
  assert.equal(audit.world_mutation_performed,false);
  assert.equal(audit.interruption_inferred,false);
  assert.equal(audit.audit_hash,hashAgentRunValue(
    Object.fromEntries(Object.entries(audit).filter(([k])=>k!=="audit_hash"))));
  assert.equal(JSON.stringify(audit).includes("男孩離開房子"),false);
  const reject=(changes,message)=>assert.rejects(
    ()=>assertWorldSimulationCommittedAcousticSource(
      {...dependency,...changes},options),message);
  await reject({source_turn_id:"forged"},
    /Source turn must exist exactly once/u);
  await reject({source_turn_hash:"forged"},
    /source turn identity or revision/u);
  await reject({source_action_id:"forged"},
    /selected, committed speech outcome/u);
  await reject({observer:"C"},
    /exact committed acoustic source admission/u);
  await reject({observer_increment_ref:"forged"},
    /exact committed acoustic source admission/u);
  await reject({release_time_ms:acoustic.release_time_ms+1},
    /exact committed acoustic source admission/u);
  await reject({source_character:"B"},
    /exact revisions/u);
  await reject({expected_source_receipt_bundle_hash:"forged"},
    /receipt bundle differs/u);
  await reject({expected_source_next_state_hash:"forged"},
    /source turn identity or revision/u);
  await reject({expected_current_revision:snapshot.revision+1},
    /current World CAS/u);
  await reject({expected_current_state_hash:"forged"},
    /current World CAS/u);
  // A subsequent *committed* World turn advances the CAS, but must
  // not erase the prior emitted A speech or turn its prior B admission
  // into an uncommitted/future fragment.
  let quietInputs=0,quietChoices=0;
  const second=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"later",
  },{
    ...options,characterRuntimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativeCommittedSourceDependency:dependency,
    characterBrain:async()=>"reject_all",
    characterNativeTemporalResponseInputResolver:async()=>{
      quietInputs++;
      throw new Error("Historical hearing is not a new acoustic release.");
    },
    characterNativeTemporalResponseSelectionResolver:async()=>{
      quietChoices++;
      throw new Error("Historical hearing cannot reselect a reply.");
    },
  });
  assert.equal(second.committed,true);
  assert.equal(quietInputs,0);
  assert.equal(quietChoices,0);
  const after=await getWorldSimulationState(sid,options);
  const afterHistory=await getWorldSimulationHistory(sid,options);
  assert.equal(after.revision,snapshot.revision+1);
  assert.equal(afterHistory.turns.length,2);
  assert.equal(hashAgentRunValue(afterHistory.turns[0]),
    dependency.source_turn_hash);
  await reject({},/current World CAS/u);
  const currentDependency={
    ...dependency,
    expected_current_revision:after.revision,
    expected_current_state_hash:after.state_hash,
  };
  const historical=await assertWorldSimulationCommittedAcousticSource(
    currentDependency,options);
  assert.equal(historical.source_turn_hash,dependency.source_turn_hash);
  assert.equal(historical.checked_current_revision,after.revision);
  assert.equal(historical.previously_committed_sound_retracted,false);
  assert.equal(historical.speculative_dependency_authorized_to_speak,false);
  assert.equal(afterHistory.turns[1].action_outcomes.some(item=>
    item.result==="communication_emitted"),false);

  // Adversarial fixture-only persistence corruption: even if someone
  // recomputes the caller's source-turn hash to match a forged history
  // record, the guard must recover the actual acoustic CC-7C identity
  // from the registered sound and stream increment.
  const {history:historyPath}=worldSimulationStatePaths(sid,options);
  const originalHistoryText=await readFile(historyPath,"utf8");
  try {
    const tampered=JSON.parse(originalHistoryText);
    const forgedAdmission=tampered.turns[0]
      .communication_observer_increment_admissions.find(item=>
        item.observer==="B"
        &&item.observer_increment?.increment_ref
          ===dependency.observer_increment_ref);
    forgedAdmission.observer_increment.increment_ref=
      "observer_increment_forged";
    forgedAdmission.observer_increment.perceived_cue_refs=
      ["audible_cue_forged"];
    await writeFile(historyPath,JSON.stringify(tampered),"utf8");
    await assert.rejects(()=>assertWorldSimulationCommittedAcousticSource({
      ...currentDependency,
      source_turn_hash:hashAgentRunValue(tampered.turns[0]),
      observer_increment_ref:"observer_increment_forged",
    },options),/observer acoustic increment identity/u);
  } finally {
    await writeFile(historyPath,originalHistoryText,"utf8");
  }
  assert.equal(hashAgentRunValue((await getWorldSimulationHistory(
    sid,options)).turns[0]),dependency.source_turn_hash);

  // CC-7AF native adoption: stale or false prior-turn lineage fails
  // BEFORE the next Character Brain ingress or any new World commit.
  let refusedBrainCalls=0,refusedListenerInputs=0;
  const refusedNative={
    ...options,characterRuntimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativeCommittedSourceDependency:dependency,
    characterBrain:async()=>{
      refusedBrainCalls++;throw new Error("No Brain on a stale source.");
    },
    characterNativeTemporalResponseInputResolver:async()=>{
      refusedListenerInputs++;
      throw new Error("No fresh listener input from stale source.");
    },
    characterNativeTemporalResponseSelectionResolver:async()=>{
      throw new Error("No selection from stale source.");
    },
  };
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"renewed",
  },refusedNative),/current World CAS/u);
  assert.equal(refusedBrainCalls,0);
  assert.equal(refusedListenerInputs,0);
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"renewed",
  },{
    ...refusedNative,
    characterNativeCommittedSourceDependency:{
      ...currentDependency,observer_increment_ref:"forged",
    },
  }),/exact committed acoustic source admission/u);
  assert.equal(refusedBrainCalls,0);
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"renewed",
  },{
    ...refusedNative,
    characterNativeCommittedSourceDependency:{
      ...currentDependency,observer:"C",
    },
  }),/same native observer/u);
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"renewed",
  },{
    ...refusedNative,
    characterNativeCommittedSourceDependency:{
      ...currentDependency,source_cancelled:true,
    },
  }),/requires an exact old source/u);
  assert.equal(refusedBrainCalls,0);
  assert.equal((await getWorldSimulationState(sid,options)).revision,
    after.revision);
  assert.equal((await getWorldSimulationHistory(sid,options)).turns.length,2);

  // The verified HISTORICAL cue alone cannot select a response. A
  // completely new World event must emit its own source increment, on
  // which B obtains one new, same-character Brain input and choice.
  let newSpeakerChoices=0,newListenerInputs=0,newListenerChoices=0;
  const renewed=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"renewed",
  },{
    ...options,characterRuntimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativeCommittedSourceDependency:currentDependency,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      newSpeakerChoices++;
      const candidate=packet.candidate_action_intents.find(item=>
        item.communication?.channel==="speech"
        &&item.communication?.surface_realization_complete===true);
      assert(candidate);
      return {action_id:candidate.action_id};
    },
    characterNativeTemporalResponseInputResolver:async(view)=>{
      newListenerInputs++;
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      assert.equal(JSON.stringify(view).includes("男孩離開房子"),false);
      return {character:"B",cognition:{
        communication_goal:{
          character:"B",purpose:"回應",addressee:"A",mode:"direct",
          public_content:"我聽見了",
          surface_realization:{
            schema_version:"cc5-mandarin-clause-request-v1",
            semantic_anchor:"我聽見了",
            clause:{subject:"我",predicate:"聽見",object:"了"},
          },
        },
        private_belief:"B_PRIVATE_NEW_TURN_ONLY",
      }};
    },
    characterNativeTemporalResponseSelectionResolver:async(view)=>{
      newListenerChoices++;
      assert.equal(view.observer,"B");
      assert.equal(JSON.stringify(view).includes("B_PRIVATE_NEW_TURN_ONLY"),false);
      return {epoch_id:view.epoch_id,
        action_id:view.candidate_action_intents[0].action_id};
    },
  });
  assert.equal(renewed.committed,true);
  assert.equal(newSpeakerChoices,1);
  assert.equal(newListenerInputs,1);
  assert.equal(newListenerChoices,1);
  const finalHistory=await getWorldSimulationHistory(sid,options);
  assert.equal(finalHistory.turns.length,3);
  const freshTurn=finalHistory.turns[2];
  const freshSource=freshTurn.action_outcomes.find(item=>
    item.actor==="A"&&item.result==="communication_emitted");
  const freshResponse=freshTurn.action_outcomes.find(item=>
    item.actor==="B"&&item.result==="communication_emitted");
  assert(freshSource&&freshResponse);
  assert.equal(freshTurn.subjective_choice_commitment_receipts.receipts
    .find(item=>item.character==="B").selection_kind,"reject_all");
  assert.equal(freshTurn.native_temporal_choice_evidence.response_action_id,
    freshResponse.action_id);
  assert.equal(freshTurn.native_temporal_choice_evidence.response_release_time_ms,
    freshResponse.start_time_ms);
  const newAdmissions=freshTurn.communication_observer_increment_admissions
    .filter(item=>item.observer==="B"
      &&item.admission_status==="heard_acoustic_cues_only"
      &&item.audit?.source_action_id===freshSource.action_id
      &&item.release_time_ms===freshResponse.start_time_ms);
  assert.equal(newAdmissions.length,1,
    "New response requires a new release in the NEW World turn.");
  assert.equal(Object.hasOwn(freshTurn,
    "native_committed_source_dependency"),false);
  assert.equal(hashAgentRunValue(finalHistory.turns[0]),
    dependency.source_turn_hash);
  assert.equal(finalHistory.turns[0].action_outcomes.some(item=>
    item.action_id===source.action_id&&item.result==="communication_emitted"),true);
  assert.equal(JSON.stringify(freshTurn).includes("B_PRIVATE_NEW_TURN_ONLY"),false);

  // CC-7AF: the broker-authored next_events request itself has NO source
  // action, stream, sound or B increment ref. The actual World causal
  // result fills the queue entry ONLY if A emits and B really hears.
  const queuedSession=await beginWorldSimulationSession({
    simulation_label:"CC7AF World-owned future acoustic dependency",
    seed:"cc7af-queue-authority",
    rules:{event_driven:true,persistent_causality:true,
      communication_action_seconds:0.3,
      communication_speech_stream_increment_max_chars:2},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{
        event_id:"source",type:"conversation",scene_id:"room",
        participants:["A","B"],summary:"A speaks and schedules quiet follow-up",
        next_events:[{
          event_id:"follow-up",type:"conversation",scene_id:"room",
          participants:["A","B"],summary:"B can check prior sound, not answer it",
          native_acoustic_dependency_request:{
            schema_version:"cc7af-queued-acoustic-source-request-v1",
            source_character:"A",observer:"B",
          },
        }],
      }],
      scenes:{room:{
        scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
        dimensions:{width_m:6,depth_m:6},
        entity_positions:{A:{x:1,y:1},B:{x:2,y:1}},
        audibility_profiles:{A:{minimum_audible_db:35},
          B:{minimum_audible_db:35}},
        observable_by:{A:{visual:[],audible:[]},
          B:{visual:[],audible:[]}},
      }},
      characters:{
        A:{known:["男孩離開房子"],current_goal:"告知B",
          speech_acoustics:{sound_level_db_at_1m:65},
          communication_goal:goalA},
        B:{known:[],current_goal:"聽A說話",
          speech_acoustics:{sound_level_db_at_1m:65}},
      },
      memories:{A:[],B:[]},available_actions:{A:[],B:[]},
    },
  },options);
  const queueSid=queuedSession.world_simulation_session_id;
  const emittedSource=await runWorldSimulationTurn({
    world_simulation_session_id:queueSid,event_id:"source",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      const c=packet.candidate_action_intents.find(x=>
        x.communication?.surface_realization_complete===true
        &&x.communication?.channel==="speech");
      assert(c);return {action_id:c.action_id};
    },
  });
  assert.equal(emittedSource.committed,true);
  const queuedBefore=await getWorldSimulationState(queueSid,options);
  const marker=queuedBefore.state.event_queue[0]
    .native_acoustic_source_lineage;
  assert.equal(marker.schema_version,
    "cc7af-queued-acoustic-source-lineage-v1");
  assert.equal(marker.source_character,"A");
  assert.equal(marker.observer,"B");
  assert.equal(typeof marker.observer_increment_ref,"string");
  assert.equal(Object.hasOwn(queuedBefore.state.event_queue[0],
    "native_acoustic_dependency_request"),false);
  let queueBrainCalls=0,queueListenerInputs=0,queueListenerChoices=0;
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:queueSid,event_id:"follow-up",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async()=>{
      queueBrainCalls++;throw new Error("Queued cue requires native listener");
    },
  }),/requires one native observer/u);
  assert.equal(queueBrainCalls,0);
  const quietQueue=await runWorldSimulationTurn({
    world_simulation_session_id:queueSid,event_id:"follow-up",
  },{
    ...options,characterRuntimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterBrain:async(packet)=>{
      queueBrainCalls++;
      assert.equal(JSON.stringify(packet)
        .includes("native_acoustic_source_lineage"),false);
      return "reject_all";
    },
    characterNativeTemporalResponseInputResolver:async()=>{
      queueListenerInputs++;
      throw new Error("Historical queue dependency is not a fresh sound.");
    },
    characterNativeTemporalResponseSelectionResolver:async()=>{
      queueListenerChoices++;
      throw new Error("History does not choose a current reply.");
    },
  });
  assert.equal(quietQueue.committed,true);
  assert.equal(queueBrainCalls,2);
  assert.equal(queueListenerInputs,0);
  assert.equal(queueListenerChoices,0);
  const queueHistory=await getWorldSimulationHistory(queueSid,options);
  assert.equal(queueHistory.turns.length,2);
  assert.equal(queueHistory.turns[1].action_outcomes.some(x=>
    x.result==="communication_emitted"),false);
  assert.equal(queueHistory.turns[0].action_outcomes.some(x=>
    x.actor==="A"&&x.result==="communication_emitted"),true);

  // If the requested source never emitted speech, the World must refuse
  // creation of that future dependency IN THE ORIGIN TURN. In particular
  // there is no queue-head event that can later masquerade as B's hearing.
  const noSoundState=JSON.parse(JSON.stringify({
    simulation_time:"2026-09-24T00:00:00.000Z",
    event_queue:[{
      event_id:"unsounded",type:"conversation",scene_id:"room",
      participants:["A","B"],summary:"No source speech",
      next_events:[{
        event_id:"phantom",type:"conversation",scene_id:"room",
        participants:["A","B"],
        native_acoustic_dependency_request:{
          schema_version:"cc7af-queued-acoustic-source-request-v1",
          source_character:"A",observer:"B",
        },
      }],
    }],
    scenes:{room:{
      scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
      dimensions:{width_m:6,depth_m:6},
      entity_positions:{A:{x:1,y:1},B:{x:2,y:1}},
      audibility_profiles:{A:{minimum_audible_db:35},
        B:{minimum_audible_db:35}},
      observable_by:{A:{visual:[],audible:[]},
        B:{visual:[],audible:[]}},
    }},
    characters:{
      A:{known:["男孩離開房子"],current_goal:"等待",
        speech_acoustics:{sound_level_db_at_1m:65},
        communication_goal:goalA},
      B:{known:[],current_goal:"等待",
        speech_acoustics:{sound_level_db_at_1m:65}},
    },
    memories:{A:[],B:[]},available_actions:{A:[],B:[]},
  }));
  const noSound=await beginWorldSimulationSession({
    simulation_label:"CC7AF no phantom acoustic follow-up",
    seed:"cc7af-no-sound",
    rules:{event_driven:true,persistent_causality:true},
    initial_world_state:noSoundState,
  },options);
  const noSoundSid=noSound.world_simulation_session_id;
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:noSoundSid,event_id:"unsounded",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async()=>"reject_all",
  }),/no unique actually emitted speech/u);
  assert.equal((await getWorldSimulationHistory(
    noSoundSid,options)).turns.length,0);
  assert.equal((await getWorldSimulationState(
    noSoundSid,options)).revision,0);

  // An authored follow-up may REQUEST binding, but may never set its
  // own source identities. A fake marker is rejected before origin commit.
  const forgedState=JSON.parse(JSON.stringify(noSoundState));
  forgedState.event_queue[0].next_events[0]
    .native_acoustic_source_lineage={source_action_id:"invented"};
  const forged=await beginWorldSimulationSession({
    simulation_label:"CC7AF no caller-forged lineage",
    seed:"cc7af-forged-future",
    rules:{event_driven:true,persistent_causality:true},
    initial_world_state:forgedState,
  },options);
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:forged.world_simulation_session_id,
    event_id:"unsounded",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async()=>"reject_all",
  }),/Caller may not forge a future acoustic source/u);
  assert.equal((await getWorldSimulationHistory(
    forged.world_simulation_session_id,options)).turns.length,0);
  console.log("CC-7AF authoritative immutable committed source guard passed.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
