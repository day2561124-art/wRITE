import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { assertWorldSimulationNativeTemporalChoiceEvidence } from "../../server/src/world-simulation-native-temporal-replay-service.mjs";

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
  console.log("CC-7AD native World same-turn commit and choice stages passed.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
