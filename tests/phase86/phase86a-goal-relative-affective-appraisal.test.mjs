import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import { buildWorldSimulationAffectiveAppraisalContexts, worldSimulationAffectiveAppraisalResolverViews, projectWorldSimulationAffectiveAppraisals } from "../../server/src/world-simulation-affective-appraisal-service.mjs";
const actors=["Alice","Bob"];
const source=projectWorldSimulationPostOutcomeSubjectivePerception({ turn_id:"turn86a",
  selected_action_intents:actors.map(character=>({character,action_id:"open",selection:"candidate_action_intent"})),
  action_outcomes:actors.map(actor=>({actor,action_id:"open",result:"SECRET_WORLD_RESULT",causal_evidence:"SECRET_CAUSE",
    character_experience:{performed:true,perceived_result:"The door stayed shut."}})), state_transitions:[] });
const input={turn_id:"turn86a",decision_packets:actors.map(character=>({character,cognition:{goals:[character+" wants safe access"],secret:"PRIVATE_INTERNAL_STATE"}})),post_outcome_subjective_perception:source};
const before=hashAgentRunValue(input);
const contexts=buildWorldSimulationAffectiveAppraisalContexts(input);
assert.equal(contexts.contexts.length,2);
assert.equal(hashAgentRunValue(input),before);
const views=worldSimulationAffectiveAppraisalResolverViews(contexts);
for(const view of views){assert.equal(view.concerns.length,1);assert.ok(view.concerns[0].goal.startsWith(view.character));}
for(const forbidden of ["SECRET_WORLD_RESULT","SECRET_CAUSE","PRIVATE_INTERNAL_STATE","source_perception_ref","projection_hash","turn_id"]){assert.equal(JSON.stringify(views).includes(forbidden),false);}
const decisions=views.map((view,i)=>({context_ref:view.context_ref,concern_ref:view.concerns[0].concern_ref,
  goal_congruence:i?"helps":"hinders",expectedness:i?"expected":"unexpected",coping_potential:i?"possible":"limited",
  interpretation:i?"The closed door keeps the outside danger away.":"I cannot get to the place I need."}));
const projection=projectWorldSimulationAffectiveAppraisals({context_bundle:contexts,decisions});
assert.equal(projection.appraisals.length,2);
assert.equal(new Set(projection.appraisals.map(a=>a.goal_congruence)).size,2,"Identical observations do not impose identical subjective appraisal.");
assert.deepEqual(projectWorldSimulationAffectiveAppraisals({context_bundle:contexts,decisions:[]}).appraisals,[],"Missing judgment creates no invented feeling.");
assert.equal(Object.isFrozen(projection.appraisals[0]),true);
for(const edit of [
 d=>{d[0].concern_ref=views[1].concerns[0].concern_ref;},
 d=>{d[0].goal_congruence=0.8;},
 d=>{d[0].selected_action="attack";},
 d=>{d[0].interpretation="";},
 d=>{d.push({...d[0]});},
]){const bad=structuredClone(decisions);edit(bad);assert.throws(()=>projectWorldSimulationAffectiveAppraisals({context_bundle:contexts,decisions:bad}),e=>e.code==="WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");}
const corrupt=structuredClone(source);corrupt.character_experiences[0].experience.perceived_result="forged";
assert.throws(()=>buildWorldSimulationAffectiveAppraisalContexts({...input,post_outcome_subjective_perception:corrupt}));
const noPerception=projectWorldSimulationPostOutcomeSubjectivePerception({turn_id:"turn86a",selected_action_intents:[{character:"Alice",action_id:"open",selection:"candidate_action_intent"}],action_outcomes:[{actor:"Alice",action_id:"open",result:"success"}],state_transitions:[]});
assert.deepEqual(buildWorldSimulationAffectiveAppraisalContexts({...input,post_outcome_subjective_perception:noPerception}).contexts,[],"Objective success alone does not establish a subjective feeling.");
assert.deepEqual(buildWorldSimulationAffectiveAppraisalContexts({...input,decision_packets:actors.map(character=>({character,cognition:{goals:[]}}))}).contexts,[]);
// Hashes are integrity checks, not permission to expose additional fields.
const expanded = structuredClone(contexts);
const expandedContext = expanded.contexts[0];
expandedContext.subjective_experience.raw_world = "SECRET_NESTED_WORLD";
expandedContext.concerns[0].other_character_state = "SECRET_NESTED_CHARACTER";
const expandedBody = structuredClone(expandedContext); delete expandedBody.context_ref; delete expandedBody.context_hash;
expandedContext.context_hash = hashAgentRunValue(expandedBody);
expandedContext.context_ref = "affective_context_" + expandedContext.context_hash.slice(0,24);
const expandedBundleBody = structuredClone(expanded); delete expandedBundleBody.bundle_hash;
expanded.bundle_hash = hashAgentRunValue(expandedBundleBody);
assert.equal(JSON.stringify(worldSimulationAffectiveAppraisalResolverViews(expanded)).includes("SECRET_NESTED"), false);
console.log("Phase86A bounded goal-relative affective appraisal: PASS");
