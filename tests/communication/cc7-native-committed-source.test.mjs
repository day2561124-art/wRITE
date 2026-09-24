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
          participants:["A","B"],summary:"A later quiet World turn"}],
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
  const second=await runWorldSimulationTurn({
    world_simulation_session_id:sid,event_id:"later",
  },{
    ...options,characterRuntimeManager,
    characterBrain:async()=>"reject_all",
  });
  assert.equal(second.committed,true);
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
  console.log("CC-7AF authoritative immutable committed source guard passed.");
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
