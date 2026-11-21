import assert from "node:assert/strict";
import path from "node:path";
import {mkdir, mkdtemp, rm} from "node:fs/promises";
import {buildCharacterCommunicationActionCandidate} from "../../server/src/character-communication-foundation-service.mjs";
import {observerDialogueLearningVersion} from "../../server/src/observer-dialogue-learning-service.mjs";
import {projectRoot} from "../../server/src/project-paths.mjs";
import {createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn} from "../../server/src/world-simulation-loop-service.mjs";
import {beginWorldSimulationSession} from "../../server/src/world-simulation-session-service.mjs";
import {getWorldSimulationHistory, getWorldSimulationState} from "../../server/src/world-simulation-state-service.mjs";

const actor="值班員", witness="陳叔", visitor="季文", item="霧橋出入簿";
const room="值班室", time="2026-11-21T08:00:00.000Z";
const original=item+"放在東樓梯櫃。", revised=item+"放在西側醫務櫃。";
const correction="我剛才說錯了，是西側醫務櫃。";
const question=item+"在哪裡？";
const expected="陳叔後來說，"+revised;
function spoken(person, addressee, content, clause) {
  const action=buildCharacterCommunicationActionCandidate({character:person, cognition:{
    communication_goal:{character:person, addressee, purpose:"交換現場線索", mode:"direct",
      public_content:content, surface_realization:{semantic_anchor:content, clause}},
  }});
  assert.equal(action?.communication?.surface_realization?.surface_text,content,content);
  return action;
}
const intro=spoken(witness,actor,"這台簿冊叫「"+item+"」。",
  {subject:"這台簿冊",predicate:"叫",object:"「"+item+"」",punctuation:"。"});
const old=spoken(witness,actor,original,
  {subject:item,predicate:"放在",object:"東樓梯櫃",punctuation:"。"});
const update=spoken(witness,actor,correction,
  {topic:"我剛才說錯了",omit_subject:true,predicate:"是",object:"西側醫務櫃",punctuation:"。"});
const ask=spoken(visitor,actor,question,
  {subject:item,predicate:"在哪裡",punctuation:"？"});
const event=(id,part,next=[])=>({event_id:id,type:"conversation",scene_id:room,participants:part,next_events:next});
const end=event("answer",[actor]);
const questionTurn=event("ask",[visitor],[end]);
const heardCorrection=event("listen-update",[actor],[questionTurn]);
const changed=event("change",[witness],[heardCorrection]);
const heardOld=event("listen-old",[actor],[changed]);
const saidOld=event("original",[witness],[heardOld]);
const heardIntro=event("listen-intro",[actor],[saidOld]);
const start=event("intro",[witness],[heardIntro]);
const scratch=path.join(projectRoot,"tests",".tmp");
await mkdir(scratch,{recursive:true});
const fixtureRoot=await mkdtemp(path.join(scratch,"native-testimony-correction-"));
const persons=[actor,witness,visitor];
const runtime=createWorldSimulationCharacterRuntimeManager({identityResolver:async character=>({
  entity_id:"witness-case-"+persons.indexOf(character),canonical_name:character,identity_source:"fixture",formal:true,
})});
const options={fixtureRoot,characterRuntimeManager:runtime,groundDialogueReferents:true,learnDialogueReferents:true};
try {
  const session=await beginWorldSimulationSession({simulation_label:"Witness retracts a location",
    seed:"witness-revision-e2e",
    rules:{event_driven:true,persistent_causality:true,communication_action_seconds:0.25},
    initial_world_state:{simulation_time:time,event_queue:[start],
      scenes:{[room]:{scene_id:room,simulation_time:time,dimensions:{width_m:12,depth_m:12},
        entity_positions:{[actor]:{x:5,y:5},[witness]:{x:4,y:5},[visitor]:{x:6,y:5}},
        audibility_profiles:Object.fromEntries(persons.map(p=>[p,{minimum_audible_db:35}]))}},
      characters:Object.fromEntries(persons.map(person=>[person,{
        current_goal:"弄清出入簿在哪裡",
        memory_retrieval_profile:{enabled:true,model_mode:"cue_dependent_v2"},
        speech_acoustics:{sound_level_db_at_1m:60},
        communication_voice_identity_evidence:persons.filter(other=>other!==person).map(other=>({
          observer:person,source_speaker:other,perceived_speaker:other,evidence_kind:"familiar_voice",
          identity_status:"identified",active:true,
        })),
      }])),
      memories:Object.fromEntries(persons.map(person=>[person,[]])),
      available_actions:{[witness]:[intro,old,update],[visitor]:[ask]},
    },
  },options);
  const sid=session.world_simulation_session_id;
  async function play(id, selection) {
    const run=await runWorldSimulationTurn({world_simulation_session_id:sid,event_id:id},{
      ...options,
      characterCommunicationListenerInterpretationResolver:async ({speech_candidates})=>
        speech_candidates.map(cue=>({
          speech_candidate_id:cue.speech_candidate_id,
          heard_surface:cue.emitted_surface_signal,
          interpreted_content:cue.emitted_surface_signal,
          speech_content_intelligible:true,understanding_attested:true,
        })),
      characterBrain:packet=>selection(packet),
    });
    assert.equal(run.committed,true,id);
    return (await getWorldSimulationHistory(sid,options)).turns.at(-1);
  }
  const pick=action=>()=>({action_id:action.action_id});
  await play("intro",pick(intro));
  await play("listen-intro",()=> "reject_all");
  await play("original",pick(old));
  await play("listen-old",()=> "reject_all");
  const learned=async()=> (await getWorldSimulationState(sid,options)).state.memories[actor]
    .filter(memory=>memory.internal_provenance?.dialogue_learning_version===observerDialogueLearningVersion
      && memory.content?.detail_type==="location");
  const prior=await learned();
  assert.equal(prior.length,1,"First location statement should form one subjective record");
  assert.equal(prior[0].content.testimony_speaker,witness);
  assert.equal(prior[0].content.lesson,original);
  await play("change",pick(update));
  await play("listen-update",()=> "reject_all");
  const after=await learned();
  assert.equal(after.length,2,"Correction should form a new memory, not overwrite old");
  assert.equal(after[1].content.retracts_memory_id,after[0].memory_id);
  assert.equal(after[0].content.lesson,original);
  assert.equal(after[1].content.lesson,revised);
  await play("ask",pick(ask));
  const answer=await play("answer",packet=>{
    const emitted=packet.candidate_action_intents.find(action=>
      action.communication?.surface_realization?.surface_text===expected);
    assert.ok(emitted,"Expected corrected location to be recalled into answer candidate");
    return {action_id:emitted.action_id};
  });
  assert.equal(answer.action_outcomes.find(outcome=>outcome.actor===actor)
    ?.communication_event?.surface_text,expected);
  assert.equal((await learned()).length,2);
  console.log(JSON.stringify({scenario:"real_utterance_to_subjective_memory_to_corrected_reply",
    prior:prior[0].content.lesson,correction:after[1].content.lesson,
    retraction:after[1].content.retracts_memory_id,
    answer:expected}));
} finally {
  await rm(fixtureRoot,{recursive:true,force:true});
}
