import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import { buildWorldSimulationAffectiveAppraisalContexts, buildWorldSimulationAffectiveReappraisalContexts,
  worldSimulationAffectiveAppraisalResolverViews, projectWorldSimulationAffectiveAppraisals,
  projectWorldSimulationAffectiveContinuity, worldSimulationAffectiveReappraisalVersion } from "../../server/src/world-simulation-affective-appraisal-service.mjs";
const actors = ["Alice", "Bob"];
const goal = "Find a way inside";
const history = { turns: [] };
function input(turn, currentGoals = [goal]) {
  return { turn_id: turn, world_history: history,
    decision_packets: actors.map(character => ({ character, cognition: { goals: currentGoals,
      affective_context: { recent_appraisals: [{ interpretation: "INJECTED_PACKET_FEELING" }] } } })),
    post_outcome_subjective_perception: projectWorldSimulationPostOutcomeSubjectivePerception({ turn_id: turn,
      selected_action_intents: actors.map(character => ({ character, action_id: "inspect", selection: "candidate_action_intent" })),
      action_outcomes: actors.map(actor => ({ actor, action_id: "inspect", result: "SECRET_WORLD_RESULT",
        character_experience: { performed: true, perceived_result: turn === "turn1" ? "The door is locked." : "I can see a reachable latch." } })), state_transitions: [] }) };
}
function decide(view) {
  const prior = view.prior_appraisals?.at(-1);
  return { context_ref: view.context_ref, concern_ref: view.concerns[0].concern_ref,
    goal_congruence: "hinders", expectedness: prior ? "expected" : "unexpected",
    coping_potential: prior && view.subjective_experience.perceived_result.includes("latch") ? "possible" : "limited",
    interpretation: view.character + (prior ? " now sees an option after previously feeling stuck" : " feels stuck"),
    ...(prior ? { reappraises_ref: prior.prior_appraisal_ref } : {}) };
}
const invalid = action => assert.throws(action, error => error.code === "WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID");
let firstRecord;
for (let i = 1; i <= 11; i++) {
  const args = input("turn" + i);
  const before = hashAgentRunValue(args);
  // Existing Phase86A/B records stay replayable without being rewritten.
  const bundle = i === 1 ? buildWorldSimulationAffectiveAppraisalContexts(args) : buildWorldSimulationAffectiveReappraisalContexts(args);
  assert.equal(hashAgentRunValue(args), before);
  const views = worldSimulationAffectiveAppraisalResolverViews(bundle);
  const decisions = views.map(decide);
  if (i > 1) {
    assert.equal(bundle.version, worldSimulationAffectiveReappraisalVersion);
    for (const view of views) {
      assert.equal(view.prior_appraisals.length, Math.min(i - 1, 8));
      assert.ok(view.prior_appraisals.every(entry => entry.interpretation.startsWith(view.character)));
      for (const forbidden of ["INJECTED_PACKET_FEELING", "SECRET_WORLD_RESULT", "source_turn_id", "appraisal_hash", actors.find(actor => actor !== view.character)]) {
        assert.equal(JSON.stringify(view).includes(forbidden), false);
      }
    }
    const swapped = structuredClone(decisions);
    swapped[0].reappraises_ref = views[1].prior_appraisals[0].prior_appraisal_ref;
    invalid(() => projectWorldSimulationAffectiveAppraisals({ context_bundle: bundle, decisions: swapped }));
    const unknown = structuredClone(decisions); unknown[0].reappraises_ref = "prior_appraisal_" + "0".repeat(24);
    invalid(() => projectWorldSimulationAffectiveAppraisals({ context_bundle: bundle, decisions: unknown }));
    assert.deepEqual(projectWorldSimulationAffectiveAppraisals({ context_bundle: bundle, decisions: [] }).appraisals, []);
  }
  const projection = projectWorldSimulationAffectiveAppraisals({ context_bundle: bundle, decisions });
  assert.ok(projection.appraisals.every(entry => entry.coping_potential === (i === 1 ? "limited" : "possible")));
  const record = { context_bundle: bundle, projection };
  history.turns.push({ turn_id: args.turn_id, revision_from: i - 1, revision_to: i, committed_at: "2026-09-13T00:00:00Z",
    post_outcome_subjective_perception_projection: args.post_outcome_subjective_perception, affective_appraisal_record: record });
  if (i === 1) firstRecord = structuredClone(record);
}
assert.deepEqual(history.turns[0].affective_appraisal_record, firstRecord);
const args = input("turn12");
const bundle = buildWorldSimulationAffectiveReappraisalContexts(args);
assert.deepEqual(buildWorldSimulationAffectiveReappraisalContexts(JSON.parse(JSON.stringify(args))), bundle);
const continuity = projectWorldSimulationAffectiveContinuity({ world_history: history, character: "Alice", current_turn_id: "turn12", current_goals: [goal] });
assert.equal(continuity.recent_appraisals.length, 8);
assert.equal(continuity.truncated, true);
assert.ok(worldSimulationAffectiveAppraisalResolverViews(buildWorldSimulationAffectiveReappraisalContexts(input("turn1"))).every(view => view.prior_appraisals.length === 0));
assert.ok(worldSimulationAffectiveAppraisalResolverViews(buildWorldSimulationAffectiveReappraisalContexts(input("turn2"))).every(view => view.prior_appraisals.length === 1));
const changedGoal = buildWorldSimulationAffectiveReappraisalContexts(input("turn12", ["Rest"]));
assert.ok(worldSimulationAffectiveAppraisalResolverViews(changedGoal).every(view => view.prior_appraisals.length === 0));
const multiGoal = buildWorldSimulationAffectiveReappraisalContexts(input("turn12", [goal, "Rest"]));
const multiView = worldSimulationAffectiveAppraisalResolverViews(multiGoal)[0];
invalid(() => projectWorldSimulationAffectiveAppraisals({ context_bundle: multiGoal, decisions: [{ ...decide(multiView), concern_ref: multiView.concerns[1].concern_ref }] }));
// Rehashing a fabricated prior snapshot must still fail canonical history replay.
const forgedHistory = structuredClone(history);
const record = forgedHistory.turns[1].affective_appraisal_record;
const context = record.context_bundle.contexts[0];
context.prior_appraisals[0].interpretation = "Alice fabricated earlier experience";
const body = structuredClone(context); delete body.context_hash; delete body.context_ref;
context.context_hash = hashAgentRunValue(body); context.context_ref = "affective_context_" + context.context_hash.slice(0, 24);
const bundleBody = structuredClone(record.context_bundle); delete bundleBody.bundle_hash;
record.context_bundle.bundle_hash = hashAgentRunValue(bundleBody);
record.projection = projectWorldSimulationAffectiveAppraisals({ context_bundle: record.context_bundle, decisions: worldSimulationAffectiveAppraisalResolverViews(record.context_bundle).map(decide) });
invalid(() => buildWorldSimulationAffectiveReappraisalContexts({ ...args, world_history: forgedHistory }));
// Interleaved concerns must retain global chronology after per-goal indexing.
const interleaved = { turns: [] };
const expected = [];
for (let i = 1; i <= 20; i++) {
  const currentGoal = [goal, "Rest", "Meet a friend"][i % 3];
  const args = { ...input("interleaved" + i, [currentGoal]), world_history: interleaved };
  const context = buildWorldSimulationAffectiveReappraisalContexts(args);
  const decisions = worldSimulationAffectiveAppraisalResolverViews(context).map(view => ({ ...decide(view), interpretation: view.character + " experience " + i }));
  interleaved.turns.push({ turn_id: args.turn_id, revision_from: i - 1, revision_to: i, committed_at: "2026-09-13T00:00:00Z",
    post_outcome_subjective_perception_projection: args.post_outcome_subjective_perception,
    affective_appraisal_record: { context_bundle: context, projection: projectWorldSimulationAffectiveAppraisals({ context_bundle: context, decisions }) } });
  if (currentGoal !== "Meet a friend") expected.push("Alice experience " + i);
}
const interleavedRead = projectWorldSimulationAffectiveContinuity({ world_history: interleaved, character: "Alice", current_turn_id: "next", current_goals: [goal, "Rest"] });
assert.deepEqual(interleavedRead.recent_appraisals.map(entry => entry.interpretation), expected.slice(-8));
assert.equal(interleavedRead.truncated, true);
const interleavedContext = buildWorldSimulationAffectiveReappraisalContexts({ ...input("next", [goal, "Rest"]), world_history: interleaved });
assert.deepEqual(worldSimulationAffectiveAppraisalResolverViews(interleavedContext)[0].prior_appraisals.map(entry => entry.interpretation), expected.slice(-8));
console.log("Phase86C experience-grounded reappraisal: PASS");
