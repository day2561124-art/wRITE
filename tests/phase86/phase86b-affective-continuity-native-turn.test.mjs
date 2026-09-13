import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { projectWorldSimulationAffectiveContinuity } from "../../server/src/world-simulation-affective-appraisal-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { actors, goalByCharacter, initial } from "./phase86-native-fixture.mjs";
const fixtureRoot=path.join(projectRoot,"tests",".tmp","phase86b-"+process.pid+"-"+Date.now());
const options={fixtureRoot};
let round=1;
const views=[]; const resolverCalls=[];
const common={...options,
 characterBrain:async packet=>{views.push({character:packet.character,round,context:structuredClone(packet.cognition.affective_context??null),groundings:packet.subjective_action_deliberation.cognition_grounding_catalog});return{action_id:"wait"};},
 affectiveAppraisalResolver:async view=>{
   resolverCalls.push(structuredClone(view));
   assert.equal(view.concerns[0].goal,goalByCharacter[view.character]);
   assert.equal(JSON.stringify(view).includes("SECRET_CAUSE"),false);
   assert.equal(view.prior_appraisals.length, round === 1 ? 0 : 1);
   assert.equal(view.selected_action.intent, "Consider what the closed door means");
   const prior = view.prior_appraisals.at(-1);
   if (prior) assert.equal(prior.action_experience.intent, view.selected_action.intent);
   if (prior) assert.ok(prior.interpretation.startsWith(view.character));
   return[{context_ref:view.context_ref,concern_ref:view.concerns[0].concern_ref,
    ...(prior ? { reappraises_ref: prior.prior_appraisal_ref } : {}),
    goal_congruence:view.character==="Alice"?"hinders":"helps",expectedness:round===1?"unexpected":"expected",
    coping_potential:prior?.coping_potential==="limited"?"possible":"limited",interpretation:view.character+" personal interpretation "+round}];
 },
 causalAdjudicator:async input=>{const next=structuredClone(input.world_state);next.event_queue=next.event_queue.slice(1);
  return{causal_resolution_id:"causal86b-"+input.event.event_id,next_world_state:next,state_transitions:[],
   action_outcomes:actors.map(actor=>({actor,action_id:"wait",result:"SECRET_WORLD_OUTCOME",causal_evidence:"SECRET_CAUSE",
    character_experience:{performed:true,perceived_result:"The door stayed shut."}})),knowledge_transitions:[],scheduled_events:[]};}
};
const previousMode=process.env.FILE_TRANSACTION_TEST_MODE;
try{
 const session=await beginWorldSimulationSession({simulation_label:"Phase86B affective continuity",seed:"phase86b",rules:{event_driven:true,persistent_causality:true},initial_world_state:initial},options);
 const id=session.world_simulation_session_id;
 const before=await getWorldSimulationState(id,options),beforeHistory=await getWorldSimulationHistory(id,options);
 process.env.FILE_TRANSACTION_TEST_MODE="1";
 await assert.rejects(()=>runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event86b-1"},{...common,testFailAfterTransactionCommits:1}),/Injected|injected|test.*fail/i);
 assert.deepEqual(await getWorldSimulationState(id,options),before);
 assert.deepEqual(await getWorldSimulationHistory(id,options),beforeHistory,"Appraisal cannot survive a failed world transaction.");
 if(previousMode===undefined)delete process.env.FILE_TRANSACTION_TEST_MODE;else process.env.FILE_TRANSACTION_TEST_MODE=previousMode;
 const first=await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event86b-1"},common);
 assert.equal(first.affective_appraisal.appraisal_count,2);
 assert.ok(views.filter(v=>v.round===1).every(v=>v.context===null));
 const firstHistory=await getWorldSimulationHistory(id,options);
 const firstRecord=structuredClone(firstHistory.turns[0].affective_appraisal_record);
 const historyBefore=hashAgentRunValue(firstHistory);
 const input={world_history:firstHistory,character:"Alice",current_turn_id:"future",current_goals:[goalByCharacter.Alice]};
 const read=projectWorldSimulationAffectiveContinuity(input);
 assert.equal(read.recent_appraisals.length,1);
 assert.equal(read.recent_appraisals[0].goal_congruence,"hinders");
 assert.equal(read.current_mood_established,false);
 assert.equal(hashAgentRunValue(firstHistory),historyBefore);
 assert.deepEqual(projectWorldSimulationAffectiveContinuity(JSON.parse(JSON.stringify(input))),read);
 assert.deepEqual(projectWorldSimulationAffectiveContinuity({...input,current_goals:[]}).recent_appraisals,[]);
 assert.deepEqual(projectWorldSimulationAffectiveContinuity({...input,current_turn_id:first.turn_id}).recent_appraisals,[]);
 assert.deepEqual(projectWorldSimulationAffectiveContinuity({...input,character:"Carol"}).recent_appraisals,[]);
 for(const forbidden of ["context_ref","perception_ref","projection_hash","turn_id","SECRET_WORLD_OUTCOME","SECRET_CAUSE","Bob"]){assert.equal(JSON.stringify(read).includes(forbidden),false);}
 const malformed=structuredClone(firstHistory);malformed.turns[0].affective_appraisal_record=false;
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:malformed}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
 const corrupt=structuredClone(firstHistory);corrupt.turns[0].affective_appraisal_record.projection.appraisals[0].interpretation="forged";
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:corrupt}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
 const detached=structuredClone(firstHistory);detached.turns[0].post_outcome_subjective_perception_projection.character_experiences[0].experience.perceived_result="forged";
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:detached}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
 const duplicate=structuredClone(firstHistory);duplicate.turns.push(structuredClone(duplicate.turns[0]));
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:duplicate}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
 round=2;
 await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event86b-2"},common);
 for(const view of views.filter(v=>v.round===2)){
  assert.equal(view.context.recent_appraisals.length,1);
  assert.ok(view.context.recent_appraisals[0].interpretation.startsWith(view.character));
  assert.ok(view.groundings.some(g=>g.source_path==="cognition.affective_context"&&g.grounding_kind==="emotion_context"),"Past appraisal must be a genuine deliberation grounding.");
 }
 round=3;
 const third=await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event86b-3"},{...common,affectiveAppraisalResolver:undefined});
 assert.equal(third.affective_appraisal.appraisal_count,0);
 for(const view of views.filter(v=>v.round===3)){
  assert.equal(view.context.recent_appraisals.length,2);
  assert.ok(view.context.recent_appraisals.every(entry => entry.action_experience.perceived_result === "The door stayed shut."));
  assert.deepEqual(view.context.recent_appraisals.map(a=>a.coping_potential),["limited","possible"]);
 }
 const final=await getWorldSimulationHistory(id,options);
 assert.deepEqual(final.turns[0].affective_appraisal_record,firstRecord,"Later interpretation preserves earlier subjective life history.");
 assert.equal(final.turns.length,3);
 assert.ok(final.turns[1].affective_appraisal_record.projection.appraisals.every(entry=>entry.reappraises_ref?.startsWith("prior_appraisal_")), "Native second turn explicitly links its own earlier appraisal.");
 assert.deepEqual(projectWorldSimulationAffectiveContinuity({...input,world_history:final,current_turn_id:first.turn_id}).recent_appraisals,[],"Historical replay must not consume appraisals from later turns.");
 const reordered=structuredClone(final);[reordered.turns[0],reordered.turns[1]]=[reordered.turns[1],reordered.turns[0]];
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:reordered}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID","Valid records cannot be reordered into a different emotional life history.");
 assert.throws(()=>projectWorldSimulationAffectiveContinuity({...input,world_history:reordered,current_turn_id:first.turn_id}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
 assert.equal(resolverCalls.length,6,"Two characters on failed attempt, successful retry and second turn only.");
}finally{
 if(previousMode===undefined)delete process.env.FILE_TRANSACTION_TEST_MODE;else process.env.FILE_TRANSACTION_TEST_MODE=previousMode;
 assert.equal(path.dirname(fixtureRoot),path.join(projectRoot,"tests",".tmp"));await rm(fixtureRoot,{recursive:true,force:true});
}
console.log("Phase86B native committed affective continuity: PASS");
