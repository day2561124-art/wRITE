import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import { buildWorldSimulationActionAwareAffectiveContexts, buildWorldSimulationAffectiveReappraisalContexts,
  worldSimulationAffectiveAppraisalResolverViews, projectWorldSimulationAffectiveAppraisals,
  projectWorldSimulationAffectiveContinuity, worldSimulationAffectiveActionAppraisalVersion } from "../../server/src/world-simulation-affective-appraisal-service.mjs";
const actors = ["Alice", "Bob"];
const goal = "Find shelter";
const history = { world_simulation_session_id: "phase86d_session", turns: [] };
function fixture(turn, revision, performed = true) {
  const candidates = [{ action_id: "inspect", intent: "Inspect the door latch", internal_note: "SECRET_CANDIDATE_NOTE" }, { action_id: "wait", intent: "Wait by the closed door" }];
  const decision_packets = actors.map(character => ({ character, cognition: { goals: [goal] }, candidate_action_intents: candidates }));
  const selected_action_intents = actors.map((character, i) => ({ character, selection: "candidate_action_intent", action_id: candidates[i].action_id, intent: candidates[i].intent, candidate: candidates[i] }));
  const args = { world_simulation_session_id: history.world_simulation_session_id, turn_id: turn, state_revision: revision,
    world_state_hash: "a".repeat(64), decision_packets, selected_action_intents };
  return { ...args, world_history: history,
    subjective_choice_commitment_receipts: buildWorldSimulationSubjectiveChoiceCommitmentReceipts(args),
    post_outcome_subjective_perception: projectWorldSimulationPostOutcomeSubjectivePerception({ turn_id: turn, selected_action_intents,
      action_outcomes: selected_action_intents.map(choice => ({ actor: choice.character, action_id: choice.action_id,
        result: "SECRET_OBJECTIVE_RESULT", causal_evidence: "SECRET_CAUSE",
        character_experience: { performed, perceived_result: "The door remained closed." } })), state_transitions: [] }) };
}
function decisions(bundle) {
  return worldSimulationAffectiveAppraisalResolverViews(bundle).map(view => ({ context_ref: view.context_ref,
    concern_ref: view.concerns[0].concern_ref, goal_congruence: "hinders", expectedness: "uncertain", coping_potential: "uncertain",
    interpretation: view.character + " considers what this means for finding shelter",
    ...(view.prior_appraisals.length ? { reappraises_ref: view.prior_appraisals.at(-1).prior_appraisal_ref } : {}) }));
}
function commit(args, context_bundle) {
  const projection = projectWorldSimulationAffectiveAppraisals({ context_bundle, decisions: decisions(context_bundle) });
  history.turns.push({ turn_id: args.turn_id, revision_from: args.state_revision, revision_to: args.state_revision + 1,
    committed_at: "2026-09-13T00:00:00Z", previous_state_hash: args.world_state_hash,
    selected_action_intents: structuredClone(args.selected_action_intents),
    subjective_choice_commitment_receipts: structuredClone(args.subjective_choice_commitment_receipts),
    post_outcome_subjective_perception_projection: structuredClone(args.post_outcome_subjective_perception),
    affective_appraisal_record: { context_bundle, projection } });
  return projection;
}
// Mixed legacy and new records rebuild without rewriting old appraisals.
const legacy = fixture("legacy", 0);
commit(legacy, buildWorldSimulationAffectiveReappraisalContexts(legacy));
const firstRecord = structuredClone(history.turns[0]);
const args = fixture("action_turn", 1, false);
const before = hashAgentRunValue(args);
const context = buildWorldSimulationActionAwareAffectiveContexts(args);
assert.equal(hashAgentRunValue(args), before);
assert.equal(context.version, worldSimulationAffectiveActionAppraisalVersion);
const views = worldSimulationAffectiveAppraisalResolverViews(context);
assert.equal(views[0].selected_action.intent, "Inspect the door latch");
assert.equal(views[1].selected_action.intent, "Wait by the closed door");
for (const view of views) {
  assert.equal(view.subjective_experience.performed, false, "Choosing an intent does not establish its execution.");
  assert.equal(Object.hasOwn(view.prior_appraisals[0], "action_experience"), false, "Legacy records must not acquire invented action memories.");
  for (const forbidden of ["SECRET_", "receipt_hash", "receipt_id", "action_ref", "world_state_hash", actors.find(actor => actor !== view.character)]) assert.equal(JSON.stringify(view).includes(forbidden), false);
}
const projection = commit(args, context);
for (const entry of projection.appraisals) {
  assert.equal(entry.action_experience.performed, false);
  assert.equal(entry.action_experience.chosen_as_coping_established, false);
  assert.equal(entry.action_experience.actual_effectiveness_established, false);
}
const nextArgs = fixture("next", 2);
const next = buildWorldSimulationActionAwareAffectiveContexts(nextArgs);
assert.deepEqual(buildWorldSimulationActionAwareAffectiveContexts(JSON.parse(JSON.stringify(nextArgs))), next);
const read = projectWorldSimulationAffectiveContinuity({ world_history: history, character: "Alice", current_turn_id: "next", current_goals: [goal] });
assert.equal(read.recent_appraisals[1].action_experience.intent, "Inspect the door latch");
assert.equal(read.recent_appraisals[1].action_experience.performed, false);
assert.deepEqual(history.turns[0], firstRecord);
for (const mutate of [
  v => { v.selected_action_intents[0].intent = "Invented action"; },
  v => { v.selected_action_intents[0].candidate.intent = v.selected_action_intents[0].intent = "Rewritten selected intent"; },
  v => { v.selected_action_intents[0].character = "Bob"; },
  v => { v.subjective_choice_commitment_receipts.receipts[0].action_id = "wait"; },
  v => { v.state_revision++; },
  v => { v.world_simulation_session_id = "another_world"; },
  v => { v.post_outcome_subjective_perception = fixture("different_turn", 1).post_outcome_subjective_perception; },
]) { const bad = structuredClone(args); mutate(bad); assert.throws(() => buildWorldSimulationActionAwareAffectiveContexts(bad)); }
const otherWorld = structuredClone(nextArgs); otherWorld.world_history.world_simulation_session_id = "other_world";
assert.throws(() => buildWorldSimulationActionAwareAffectiveContexts(otherWorld), /another world's history/);
const pastSnapshot = fixture("unknown_past_turn", 0);
assert.throws(() => buildWorldSimulationActionAwareAffectiveContexts(pastSnapshot), /beyond its decision snapshot/);
const detached = structuredClone(history);
detached.turns[1].selected_action_intents[0].candidate.intent = detached.turns[1].selected_action_intents[0].intent = "Rewritten historical action";
assert.throws(() => buildWorldSimulationActionAwareAffectiveContexts({ ...nextArgs, world_history: detached }));
const swappedSource = structuredClone(args);
swappedSource.post_outcome_subjective_perception.character_experiences[0].action_id = "wait";
const sourceBody = structuredClone(swappedSource.post_outcome_subjective_perception); delete sourceBody.projection_hash;
swappedSource.post_outcome_subjective_perception.projection_hash = hashAgentRunValue(sourceBody);
assert.throws(() => buildWorldSimulationActionAwareAffectiveContexts(swappedSource), /chosen action/);
const unknownExecution = fixture("unknown_execution", 2, null);
const unknownContext = buildWorldSimulationActionAwareAffectiveContexts(unknownExecution);
assert.ok(worldSimulationAffectiveAppraisalResolverViews(unknownContext).every(view => view.subjective_experience.performed === null));
assert.ok(projectWorldSimulationAffectiveAppraisals({ context_bundle: unknownContext, decisions: decisions(unknownContext) }).appraisals.every(entry => entry.action_experience.performed === null), "A chosen action with no execution observation stays unknown.");
const rejected = fixture("reject", 2);
rejected.selected_action_intents = actors.map(character => ({ character, selection: "reject_all", action_id: null, intent: null, candidate: null }));
rejected.subjective_choice_commitment_receipts = buildWorldSimulationSubjectiveChoiceCommitmentReceipts(rejected);
rejected.post_outcome_subjective_perception = projectWorldSimulationPostOutcomeSubjectivePerception({ turn_id: rejected.turn_id, selected_action_intents: rejected.selected_action_intents, action_outcomes: [], state_transitions: [] });
assert.deepEqual(buildWorldSimulationActionAwareAffectiveContexts(rejected).contexts, [], "Rejecting every action creates no invented action experience.");
console.log("Phase86D action-aware affective appraisal: PASS");
