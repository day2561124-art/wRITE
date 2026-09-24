import assert from "node:assert/strict";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { assertWorldSimulationNativeTemporalChoiceEvidence } from "../../server/src/world-simulation-native-temporal-replay-service.mjs";
import { assertWorldSimulationNativePreparationEvidence } from "../../server/src/world-simulation-native-response-preparation-service.mjs";

const fixtureRoot=path.join(projectRoot,"tests",".tmp",
  "cc7ad-native-world-"+process.pid+"-"+Date.now());
const options={fixtureRoot};
await rm(fixtureRoot,{recursive:true,force:true});
const goalA={
  character:"A",purpose:"告知",addressee:"B",mode:"direct",
  public_content:"男孩離開房子",claim_kind:"sincere_assertion",
  surface_realization:{
    schema_version:"cc5-mandarin-clause-request-v1",
    semantic_anchor:"男孩離開房子",
    clause:{subject:"男孩",predicate:"離開",object:"房子"},
  },
};
const goalB={
  character:"B",purpose:"回應",addressee:"A",mode:"direct",
  public_content:"我聽見了",
  surface_realization:{
    schema_version:"cc5-mandarin-clause-request-v1",
    semantic_anchor:"我聽見了",
    clause:{subject:"我",predicate:"聽見",object:"了"},
  },
};
try {
  const session=await beginWorldSimulationSession({
    simulation_label:"CC7AD native same-turn response and choice-stage proof",
    seed:"cc7ad-native-same-turn",
    rules:{event_driven:true,persistent_causality:true,
      communication_action_seconds:0.3,
      communication_speech_stream_increment_max_chars:2},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{event_id:"talk",type:"conversation",scene_id:"room",
        participants:["A","B"],summary:"A starts speaking"}],
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
          relationships:{B:"朋友"},
          speech_acoustics:{sound_level_db_at_1m:65},
          communication_goal:goalA},
        B:{known:[],current_goal:"聽A說話",relationships:{A:"朋友"},
          speech_acoustics:{sound_level_db_at_1m:65}},
      },
      memories:{A:[],B:[]}, available_actions:{A:[],B:[]},
    },
  },options);
  const runtimeManager=createWorldSimulationCharacterRuntimeManager({
    identityResolver:async(character)=>({
      entity_id:"character_"+character.toLowerCase(),
      canonical_name:character,formal:true,
      identity_source:"cc7ad_native_test",
    }),
  });
  let responseInputs=0, responseChoices=0;
  const result=await runWorldSimulationTurn({
    world_simulation_session_id:session.world_simulation_session_id,
    event_id:"talk",
  },{
    ...options,characterRuntimeManager:runtimeManager,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      const candidate=packet.candidate_action_intents.find(
        item=>item.communication?.surface_realization_complete===true);
      assert(candidate);return {action_id:candidate.action_id};
    },
    characterNativeTemporalResponseObserver:"B",
    characterNativeTemporalResponseInputResolver:async(view)=>{
      responseInputs++;
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      assert.equal(JSON.stringify(view).includes("男孩離開房子"),false);
      return {character:"B",cognition:{
        communication_goal:goalB,
        private_belief:"B_SECRET_NEVER_PUBLIC",
      }};
    },
    characterNativeTemporalResponseSelectionResolver:async(view)=>{
      responseChoices++;
      assert.equal(view.observer,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      assert.equal(JSON.stringify(view).includes("B_SECRET_NEVER_PUBLIC"),false);
      assert.equal(view.candidate_action_intents.length,1);
      return {epoch_id:view.epoch_id,
        action_id:view.candidate_action_intents[0].action_id};
    },
  });
  assert.equal(result.committed,true);
  assert.equal(responseInputs,1);
  assert.equal(responseChoices,1);
  assert.equal(result.selected_action_intents[1].selection,
    "candidate_action_intent");
  const evidence=result.native_temporal_choice_evidence;
  assert(evidence);
  assert.equal(evidence.initial_selection_kind,"reject_all");
  assert.equal(evidence.response_selection_kind,"candidate_action_intent");
  assert.equal(evidence.original_phase74d_receipt_unchanged,true);
  const history=await getWorldSimulationHistory(
    session.world_simulation_session_id,options);
  const turn=history.turns.at(-1);
  assert(turn);
  const initialReceipt=turn.subjective_choice_commitment_receipts.receipts.find(
    receipt=>receipt.character==="B");
  assert.equal(initialReceipt.selection_kind,"reject_all");
  assert.equal(initialReceipt.action_id,null);
  assert.equal(turn.native_temporal_choice_evidence.evidence_hash,
    evidence.evidence_hash);
  const verify = (supplied) => assertWorldSimulationNativeTemporalChoiceEvidence({
    evidence:supplied,
    original_receipts:turn.subjective_choice_commitment_receipts,
    selected_action_intents:turn.selected_action_intents,
    action_outcomes:turn.action_outcomes,
    causal_timeline:turn.causal_timeline,
  });
  assert.deepEqual(verify(evidence),evidence);
  assert.throws(()=>verify({...evidence,evidence_hash:"forged"}),
    /exact stage provenance/u);
  assert.throws(()=>verify({...evidence,
    source_original_receipt_id:"forged"}),
    /exact stage provenance/u);
  const source=turn.action_outcomes.find(x=>
    x.actor==="A"&&x.result==="communication_emitted");
  const reply=turn.action_outcomes.find(x=>
    x.actor==="B"&&x.result==="communication_emitted");
  assert(source&&reply);
  assert.equal(reply.action_id,evidence.response_action_id);
  const sourceRelease=turn.causal_timeline.entries.find(x=>
    x.kind==="communication_speech_increment"&&x.action_id===source.action_id);
  assert.equal(reply.start_time_ms,sourceRelease.time_ms);
  assert(turn.causal_timeline.entries.some(x=>
    x.kind==="communication_speech_increment"&&x.action_id===reply.action_id
    &&x.time_ms>reply.start_time_ms));
  const serialized=JSON.stringify(turn);
  assert.equal(serialized.includes("B_SECRET_NEVER_PUBLIC"),false);
  assert.equal(result.native_temporal_choice_evidence.world_committed,false);

  // The optional integration must not add a null CC-7AD field to ordinary
  // pre-existing World history or to its returned native turn DTO.
  const legacy=await beginWorldSimulationSession({
    simulation_label:"CC7AD no-response backward compatibility",
    seed:"cc7ad-no-response",
    rules:{event_driven:true,persistent_causality:true},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{event_id:"legacy-talk",type:"conversation",
        scene_id:"room",participants:["A"],summary:"No response"}],
      scenes:{room:{
        scene_id:"room",simulation_time:"2026-09-24T00:00:00.000Z",
        dimensions:{width_m:6,depth_m:6},
        entity_positions:{A:{x:1,y:1}},
        observable_by:{A:{visual:[],audible:[]}},
      }},
      characters:{A:{known:[],current_goal:"等待"}},
      memories:{A:[]},available_actions:{A:[]},
    },
  },options);
  const legacyResult=await runWorldSimulationTurn({
    world_simulation_session_id:legacy.world_simulation_session_id,
    event_id:"legacy-talk",
  },{...options,characterRuntimeManager:runtimeManager,
    characterBrain:async()=>"reject_all"});
  assert.equal(legacyResult.committed,true);
  assert.equal(Object.hasOwn(legacyResult,"native_temporal_choice_evidence"),false);
  const legacyHistory=await getWorldSimulationHistory(
    legacy.world_simulation_session_id,options);
  assert.equal(Object.hasOwn(legacyHistory.turns[0],
    "native_temporal_choice_evidence"),false);
  // CC-7AE native World adoption: first acoustic cue allows a private wait;
  // only the second actually heard cue permits one later selected response.
  const delayedSessionInput={
    simulation_label:"CC7AE native delayed observer response",
    seed:"cc7ae-native-delayed",
    rules:{event_driven:true,persistent_causality:true,
      communication_action_seconds:0.3,
      communication_speech_stream_increment_max_chars:2},
    initial_world_state:{
      simulation_time:"2026-09-24T00:00:00.000Z",
      event_queue:[{event_id:"delayed-talk",type:"conversation",scene_id:"room",
        participants:["A","B"],summary:"A speaks before B responds"}],
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
          relationships:{B:"朋友"},
          speech_acoustics:{sound_level_db_at_1m:65},
          communication_goal:goalA},
        B:{known:[],current_goal:"聽A說話",relationships:{A:"朋友"},
          speech_acoustics:{sound_level_db_at_1m:65}},
      },
      memories:{A:[],B:[]},available_actions:{A:[],B:[]},
    },
  };
  const delayedSession=await beginWorldSimulationSession(
    delayedSessionInput,options);
  const preparationViews=[];
  let delayedInputCount=0,delayedChoiceCount=0;
  const delayedResult=await runWorldSimulationTurn({
    world_simulation_session_id:delayedSession.world_simulation_session_id,
    event_id:"delayed-talk",
  },{
    ...options,characterRuntimeManager:runtimeManager,
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      const candidate=packet.candidate_action_intents.find(
        item=>item.communication?.surface_realization_complete===true);
      assert(candidate);return {action_id:candidate.action_id};
    },
    characterNativeTemporalResponseObserver:"B",
    characterNativeTemporalResponsePreparationResolver:async(view)=>{
      preparationViews.push(view);
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      assert.equal(view.boundaries.no_future_cue,true);
      assert.equal(JSON.stringify(view).includes("男孩離開房子"),false);
      assert.equal(JSON.stringify(view).includes("B_SECRET_DELAYED"),false);
      return {epoch_id:view.epoch_id,
        decision:preparationViews.length===1?"wait":"select_response"};
    },
    characterNativeTemporalResponseInputResolver:async(view)=>{
      delayedInputCount++;
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      assert.equal(view.observer_view.release_time_ms,
        preparationViews[1].release_time_ms);
      return {character:"B",cognition:{
        communication_goal:goalB,private_belief:"B_SECRET_DELAYED",
      }};
    },
    characterNativeTemporalResponseSelectionResolver:async(view)=>{
      delayedChoiceCount++;
      assert.equal(view.observer,"B");
      assert.equal(view.release_time_ms,preparationViews[1].release_time_ms);
      assert.equal(JSON.stringify(view).includes("B_SECRET_DELAYED"),false);
      return {epoch_id:view.epoch_id,
        action_id:view.candidate_action_intents[0].action_id};
    },
  });
  assert.equal(delayedResult.committed,true);
  assert.equal(preparationViews.length,2);
  assert.equal(delayedInputCount,1);
  assert.equal(delayedChoiceCount,1);
  assert(preparationViews[1].release_time_ms
    >preparationViews[0].release_time_ms);
  const delayedHistory=await getWorldSimulationHistory(
    delayedSession.world_simulation_session_id,options);
  const delayedTurn=delayedHistory.turns[0];
  assert.equal(delayedTurn.subjective_choice_commitment_receipts.receipts.find(
    item=>item.character==="B").selection_kind,"reject_all");
  const delayedReply=delayedTurn.action_outcomes.find(item=>
    item.actor==="B"&&item.result==="communication_emitted");
  assert(delayedReply);
  assert.equal(delayedReply.start_time_ms,
    preparationViews[1].release_time_ms);
  assert.equal(delayedTurn.native_temporal_choice_evidence.response_action_id,
    delayedReply.action_id);
  const delayedProof=delayedTurn.native_temporal_preparation_evidence;
  assert(delayedProof,"Committed delayed response needs bounded preparation provenance.");
  assert.equal(delayedProof.preparation_audits.length,1);
  assert.equal(delayedProof.preparation_audits[0].latest_decision,"wait");
  assert.equal(delayedProof.source_response_action_id,delayedReply.action_id);
  assert.equal(delayedProof.source_response_release_time_ms,
    delayedReply.start_time_ms);
  assert.equal(delayedProof.last_preparation_audit_hash,
    delayedTurn.native_temporal_choice_evidence.source_preparation_audit_hash);
  const verifyPreparation=(evidence,choice_evidence=
    delayedTurn.native_temporal_choice_evidence)=>assertWorldSimulationNativePreparationEvidence({
    evidence,choice_evidence,
    original_receipts:delayedTurn.subjective_choice_commitment_receipts,
    action_outcomes:delayedTurn.action_outcomes,
  });
  assert.deepEqual(verifyPreparation(delayedProof),delayedProof);
  assert.throws(()=>verifyPreparation({
    ...delayedProof,evidence_hash:"forged",
  }),/provenance disagree/u);
  assert.throws(()=>verifyPreparation({
    ...delayedProof,preparation_audits:delayedProof.preparation_audits.map(
      audit=>({...audit,wait_count:999})),
  }),/provenance disagree|stale, forged/u);
  assert.throws(()=>verifyPreparation(null),/must carry its linked/u);
  assert.equal(JSON.stringify(delayedTurn).includes("B_SECRET_DELAYED"),false);
  assert.equal(JSON.stringify(delayedProof).includes("男孩離開房子"),false);

  // Every admitted release may be heard without choosing to speak.
  const allWaitSession=await beginWorldSimulationSession({
    ...structuredClone(delayedSessionInput),
    seed:"cc7ae-native-all-wait",
    simulation_label:"CC7AE all-wait World commit without B speech",
  },options);
  let allWaitReleases=0;
  let allWaitInputCalls=0;
  let allWaitSelectionCalls=0;
  const allWaitResult=await runWorldSimulationTurn({
    world_simulation_session_id:allWaitSession.world_simulation_session_id,
    event_id:"delayed-talk",
  },{
    ...options,characterRuntimeManager:runtimeManager,
    characterBrain:async(packet)=>{
      if(packet.character!=="A") return "reject_all";
      const speech=packet.candidate_action_intents.find(x=>
        x.communication?.surface_realization_complete===true);
      assert(speech);return {action_id:speech.action_id};
    },
    characterNativeTemporalResponseObserver:"B",
    characterNativeTemporalResponsePreparationResolver:async(view)=>{
      allWaitReleases++;
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      return {epoch_id:view.epoch_id,decision:"wait"};
    },
    characterNativeTemporalResponseInputResolver:async()=>{
      allWaitInputCalls++;
      throw new Error("All-wait must not invoke new Brain input.");
    },
    characterNativeTemporalResponseSelectionResolver:async()=>{
      allWaitSelectionCalls++;
      throw new Error("All-wait must not select a response.");
    },
  });
  assert.equal(allWaitResult.committed,true);
  assert(allWaitReleases>=2);
  assert.equal(allWaitInputCalls,0);
  assert.equal(allWaitSelectionCalls,0);
  assert.equal(allWaitResult.selected_action_intents.find(x=>
    x.character==="B").selection,"reject_all");
  assert.equal(Object.hasOwn(allWaitResult,"native_temporal_choice_evidence"),false);
  const allWaitHistory=await getWorldSimulationHistory(
    allWaitSession.world_simulation_session_id,options);
  const allWaitTurn=allWaitHistory.turns[0];
  assert.equal(Object.hasOwn(allWaitTurn,"native_temporal_choice_evidence"),false);
  assert.equal(Object.hasOwn(allWaitTurn,"native_temporal_preparation_evidence"),false);
  assert.equal(allWaitTurn.action_outcomes.some(x=>
    x.actor==="B"&&x.result==="communication_emitted"),false);
  assert.equal(allWaitTurn.subjective_choice_commitment_receipts.receipts.find(x=>
    x.character==="B").selection_kind,"reject_all");
  // CC-7AF refusal gate: a newly discovered source supersession may
  // invalidate the current acoustic epoch BEFORE fresh Brain input OR
  // AFTER a tentative Brain response. Neither stage commits a turn.
  for (const cancelStage of [1,2]) {
    const canceledSession=await beginWorldSimulationSession({
      ...structuredClone(delayedSessionInput),
      seed:"cc7af-source-superseded-"+cancelStage,
      simulation_label:"CC7AF fail-closed source cancellation",
    },options);
    const before=await getWorldSimulationState(
      canceledSession.world_simulation_session_id,options);
    let sourceCandidate=null,challengeCount=0,brainInputCount=0,brainChoiceCount=0;
    await assert.rejects(()=>runWorldSimulationTurn({
      world_simulation_session_id:canceledSession.world_simulation_session_id,
      event_id:"delayed-talk",
    },{
      ...options,characterRuntimeManager:runtimeManager,
      characterBrain:async(packet)=>{
        if(packet.character!=="A") return "reject_all";
        sourceCandidate=packet.candidate_action_intents.find(x=>
          x.communication?.surface_realization_complete===true);
        assert(sourceCandidate);
        return {action_id:sourceCandidate.action_id};
      },
      characterNativeTemporalResponseObserver:"B",
      characterNativeTemporalResponsePreparationResolver:async(view)=>({
        epoch_id:view.epoch_id,decision:"select_response",
      }),
      characterNativeTemporalResponseInputResolver:async()=>{
        brainInputCount++;
        return {character:"B",cognition:{communication_goal:goalB}};
      },
      characterNativeTemporalResponseSelectionResolver:async(view)=>{
        brainChoiceCount++;
        return {epoch_id:view.epoch_id,
          action_id:view.candidate_action_intents[0].action_id};
      },
      characterNativeTemporalResponseCausalRevalidationResolver:async(view)=>{
        challengeCount++;
        assert.equal(view.observer,"B");
        assert.equal(view.boundaries.engine_only_not_character_view,true);
        assert.equal(view.boundaries.refusal_only_never_authorizes_replacement_action,true);
        assert.equal(JSON.stringify(view).includes("男孩離開房子"),false);
        const original=[
          {character:"A",selection:"candidate_action_intent",
            action_id:sourceCandidate.action_id,
            intent:sourceCandidate.intent,candidate:sourceCandidate},
          {character:"B",selection:"reject_all",
            action_id:null,intent:null,candidate:null},
        ];
        return {source_epoch_id:view.source_epoch_id,
          revised_selected_action_intents:challengeCount===cancelStage
            ? original.map(x=>x.character==="A"
              ? {character:"A",selection:"reject_all",
                  action_id:null,intent:null,candidate:null} : x)
            : original};
      },
    }),/superseded source causal epoch/u);
    assert.equal(challengeCount,cancelStage);
    assert.equal(brainInputCount,cancelStage===1?0:1);
    assert.equal(brainChoiceCount,cancelStage===1?0:1);
    const after=await getWorldSimulationState(
      canceledSession.world_simulation_session_id,options);
    assert.equal(after.revision,before.revision);
    assert.equal(after.state_hash,before.state_hash);
    const failedHistory=await getWorldSimulationHistory(
      canceledSession.world_simulation_session_id,options);
    assert.equal(failedHistory.turns.length,0);
  }
  // CC-7AF: the real source Character Brain reconsiders before ANY World
  // commit. Its original selected speech was speculative and cannot be
  // treated as emitted or heard. The final reject_all uses the ordinary
  // Phase74D/World atomic commit; B is never called without a real cue.
  const reconsideredSession=await beginWorldSimulationSession({
    ...structuredClone(delayedSessionInput),
    seed:"cc7af-precommit-reconsidered",
    simulation_label:"CC7AF actual source Brain precommit reconsideration",
  },options);
  let speakerChoices=0, listenerInputs=0, listenerChoices=0;
  const reconsidered=await runWorldSimulationTurn({
    world_simulation_session_id:reconsideredSession.world_simulation_session_id,
    event_id:"delayed-talk",
  },{
    ...options, characterRuntimeManager:runtimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativePrecommitSourceReconsiderationCharacter:"A",
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      speakerChoices++;
      if(speakerChoices===2)return "reject_all";
      const candidate=packet.candidate_action_intents.find(item=>
        item.communication?.channel==="speech"
        &&item.communication?.surface_realization_complete===true);
      assert(candidate);
      return {action_id:candidate.action_id};
    },
    characterNativeTemporalResponseInputResolver:async()=>{
      listenerInputs++;
      throw new Error("Canceled source cannot create a listener cue.");
    },
    characterNativeTemporalResponseSelectionResolver:async()=>{
      listenerChoices++;
      throw new Error("Canceled source cannot choose a listener response.");
    },
  });
  assert.equal(reconsidered.committed,true);
  assert.equal(speakerChoices,2);
  assert.equal(listenerInputs,0);
  assert.equal(listenerChoices,0);
  assert.equal(reconsidered.selected_action_intents.find(x=>
    x.character==="A").selection,"reject_all");
  assert.equal(reconsidered.selected_action_intents.find(x=>
    x.character==="B").selection,"reject_all");
  const reconsideredHistory=await getWorldSimulationHistory(
    reconsideredSession.world_simulation_session_id,options);
  assert.equal(reconsideredHistory.turns.length,1);
  assert(reconsideredHistory.turns[0].subjective_choice_commitment_receipts
    .receipts.every(x=>x.selection_kind==="reject_all"));
  assert.equal(reconsideredHistory.turns[0].action_outcomes.some(x=>
    x.result==="communication_emitted"),false);
  assert.equal(Object.hasOwn(reconsideredHistory.turns[0],
    "native_temporal_choice_evidence"),false);
  // Without a different current Brain choice, the source can never be
  // declared "superseded"; fail before Word commit and do not create a
  // synthetic alternative speech candidate.
  const sameSession=await beginWorldSimulationSession({
    ...structuredClone(delayedSessionInput),
    seed:"cc7af-precommit-same-choice",
    simulation_label:"CC7AF source Brain same action is not a revision",
  },options);
  let sameBrainCalls=0;
  await assert.rejects(()=>runWorldSimulationTurn({
    world_simulation_session_id:sameSession.world_simulation_session_id,
    event_id:"delayed-talk",
  },{
    ...options,characterRuntimeManager:runtimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativePrecommitSourceReconsiderationCharacter:"A",
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      sameBrainCalls++;
      const candidate=packet.candidate_action_intents.find(x=>
        x.communication?.channel==="speech"
        &&x.communication?.surface_realization_complete===true);
      return {action_id:candidate.action_id};
    },
    characterNativeTemporalResponseInputResolver:async()=>
      {throw new Error("No B input before source revision.");},
    characterNativeTemporalResponseSelectionResolver:async()=>
      {throw new Error("No B choice before source revision.");},
  }),/genuinely replace tentative speech/u);
  assert.equal(sameBrainCalls,2);
  assert.equal((await getWorldSimulationHistory(
    sameSession.world_simulation_session_id,options)).turns.length,0);
  // A genuinely different *broker-prepared* alternate speech candidate
  // supports actual precommit replacement: A's second Brain invocation
  // selects it; B receives only that source's new admitted cue, makes one
  // fresh choice and the ordinary World commits one coherent new timeline.
  const alternativeGoal={
    ...goalA,public_content:"男孩走進房子",
    surface_realization:{
      schema_version:"cc5-mandarin-clause-request-v1",
      semantic_anchor:"男孩走進房子",
      clause:{subject:"男孩",predicate:"走進",object:"房子"},
    },
  };
  // This is a non-factual alternative intention; a bare alternate
  // `sincere_assertion` would require its own accessible belief evidence.
  delete alternativeGoal.claim_kind;
  const alternateAction=buildCharacterCommunicationActionCandidate({
    character:"A",cognition:{communication_goal:alternativeGoal},
  });
  assert(alternateAction?.communication?.surface_realization_complete);
  const replacedInput=structuredClone(delayedSessionInput);
  replacedInput.seed="cc7af-precommit-replaced-source";
  replacedInput.simulation_label="CC7AF precommit fresh authorized speech";
  replacedInput.initial_world_state.available_actions.A=[alternateAction];
  const replacedSession=await beginWorldSimulationSession(replacedInput,options);
  let changedSpeakerCalls=0,replacedBrainInputs=0,replacedBrainChoices=0;
  const replaced=await runWorldSimulationTurn({
    world_simulation_session_id:replacedSession.world_simulation_session_id,
    event_id:"delayed-talk",
  },{
    ...options,characterRuntimeManager:runtimeManager,
    characterNativeTemporalResponseObserver:"B",
    characterNativePrecommitSourceReconsiderationCharacter:"A",
    characterBrain:async(packet)=>{
      if(packet.character!=="A")return "reject_all";
      changedSpeakerCalls++;
      const actions=packet.candidate_action_intents;
      const alternate=actions.find(x=>x.action_id===alternateAction.action_id);
      const initial=actions.find(x=>
        x.communication?.surface_realization_complete===true
        &&x.action_id!==alternateAction.action_id);
      assert(alternate&&initial);
      return {action_id:changedSpeakerCalls===1
        ?initial.action_id:alternate.action_id};
    },
    characterNativeTemporalResponseInputResolver:async(view)=>{
      replacedBrainInputs++;
      assert.equal(view.character,"B");
      assert.equal(view.observer_view.future_release_exposed,false);
      return {character:"B",cognition:{communication_goal:goalB}};
    },
    characterNativeTemporalResponseSelectionResolver:async(view)=>{
      replacedBrainChoices++;
      return {epoch_id:view.epoch_id,
        action_id:view.candidate_action_intents[0].action_id};
    },
  });
  assert.equal(replaced.committed,true);
  assert.equal(changedSpeakerCalls,2);
  assert.equal(replacedBrainInputs,1);
  assert.equal(replacedBrainChoices,1);
  const replacedTurn=(await getWorldSimulationHistory(
    replacedSession.world_simulation_session_id,options)).turns[0];
  const finalReceipt=replacedTurn.subjective_choice_commitment_receipts
    .receipts.find(x=>x.character==="A");
  assert.equal(finalReceipt.action_id,alternateAction.action_id);
  const finalizedSource=replacedTurn.action_outcomes.find(x=>
    x.actor==="A"&&x.result==="communication_emitted");
  const finalizedResponse=replacedTurn.action_outcomes.find(x=>
    x.actor==="B"&&x.result==="communication_emitted");
  assert(finalizedSource&&finalizedResponse);
  assert.equal(finalizedSource.action_id,alternateAction.action_id);
  assert.equal(finalizedResponse.start_time_ms,
    replacedTurn.native_temporal_choice_evidence.response_release_time_ms);
  assert.equal(replacedTurn.action_outcomes.some(x=>
    x.actor==="A"&&x.action_id!==alternateAction.action_id
    &&x.result==="communication_emitted"),false);
  assert.equal(replacedTurn.causal_timeline.entries.some(x=>
    x.actor==="A"&&x.action_id!==alternateAction.action_id
    &&x.kind==="communication_speech_increment"),false);
  assert.equal(replacedTurn.subjective_choice_commitment_receipts
    .receipts.find(x=>x.character==="B").selection_kind,"reject_all");
  console.log("CC-7AD native World same-turn commit and choice stages passed.");
  console.log("CC-7AF actual source Brain precommit cancellation passed.");
  console.log("CC-7AE native World wait-then-later-response commit passed.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
