import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { runWorldSimulationTurn, prepareWorldSimulationTurn, resolveWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import { buildWorldSimulationCopingChoiceContext, buildWorldSimulationCopingIntentionCommitments, projectWorldSimulationCopingContinuity } from "../../server/src/world-simulation-coping-intention-service.mjs";
import { actors, goalByCharacter, initial } from "./phase86-native-fixture.mjs";
const fixtureRoot = path.join(projectRoot, "tests", ".tmp", "phase86e-" + process.pid + "-" + Date.now());
const options = { fixtureRoot };
let round = 1, causalCalls = 0;
const views = [], rawResponses = [];
const common = { ...options,
  characterBrain: async packet => {
    const context = packet.cognition.coping_context;
    views.push({ character: packet.character, round, context: structuredClone(context ?? null) });
    if (round !== 2) return { action_id: "wait" };
    assert.equal(context.response_contract.optional_field, "coping_intention");
    assert.equal(context.appraisals.length, 1);
    assert.equal(context.recent_intentions.length, 0);
    const result = { action_id: "wait", coping_intention: {
      appraisal_ref: context.appraisals[0].appraisal_ref, strategy: packet.character === "Alice" ? "seek_information" : "wait_and_monitor",
      reason: packet.character + " wants to understand the closed door", desired_change: packet.character + " wants less uncertainty" } };
    rawResponses.push(result);
    return result;
  },
  affectiveAppraisalResolver: async view => [{ context_ref: view.context_ref, concern_ref: view.concerns[0].concern_ref,
    goal_congruence: "hinders", expectedness: "unexpected", coping_potential: "uncertain", interpretation: view.character + " is uncertain about shelter" }],
  causalAdjudicator: async input => {
    causalCalls++;
    // Later code cannot rewrite the character's already recorded motivation.
    for (const response of rawResponses) response.coping_intention.reason = "POST_OUTCOME_REWRITE";
    const next = structuredClone(input.world_state); next.event_queue = next.event_queue.slice(1);
    return { causal_resolution_id: "causal86e-" + input.event.event_id, next_world_state: next, state_transitions: [],
      action_outcomes: actors.map(actor => ({ actor, action_id: "wait", result: "SECRET_WORLD_RESULT", causal_evidence: "SECRET_CAUSE",
        character_experience: { performed: round === 2 ? false : true, perceived_result: "The door stayed shut." } })), knowledge_transitions: [], scheduled_events: [] };
  },
};
const oldMode = process.env.FILE_TRANSACTION_TEST_MODE;
try {
  const session = await beginWorldSimulationSession({ simulation_label: "Phase86E coping intention", seed: "86e", rules: { event_driven: true, persistent_causality: true }, initial_world_state: initial }, options);
  const id = session.world_simulation_session_id;
  const first = await runWorldSimulationTurn({ world_simulation_session_id: id, event_id: "event86b-1" }, common);
  assert.equal(first.coping_intentions.recorded_count, 0, "Appraisal plus action does not imply coping motivation.");
  assert.ok(views.filter(v => v.round === 1).every(v => v.context === null));
  round = 2;
  const before = await getWorldSimulationState(id, options), beforeHistory = await getWorldSimulationHistory(id, options);
  const prepared = await prepareWorldSimulationTurn({ world_simulation_session_id: id, event_id: "event86b-2" }, options);
  for (const packet of prepared.decision_packets) {
    const formalView = buildWorldSimulationCharacterBrainInput(packet);
    assert.equal(Object.hasOwn(formalView.cognition.coping_context, "response_contract"), false);
    assert.equal(formalView.cognition.coping_context.appraisals.length, 1);
  }
  const response = Object.fromEntries(prepared.decision_packets.map(packet => [packet.character, { action_id: "wait", coping_intention: {
    appraisal_ref: packet.cognition.coping_context.appraisals[0].appraisal_ref, strategy: "seek_information", reason: "Understand the door", desired_change: "Learn more" } }]));
  const callsBefore = causalCalls;
  for (const edit of [
    v => { v.Alice.coping_intention.appraisal_ref = v.Bob.coping_intention.appraisal_ref; },
    v => { v.Alice.coping_intention.strategy = "automatic_goal_abandonment"; },
    v => { v.Alice.coping_intention.effectiveness = true; },
    v => { v.Alice.coping_intention.reason = ""; },
  ]) {
    const bad = structuredClone(response); edit(bad);
    await assert.rejects(() => resolveWorldSimulationTurn(prepared, bad, common), e => e.code === "WORLD_SIMULATION_COPING_INTENTION_INVALID");
  }
  assert.equal(causalCalls, callsBefore, "Invalid coping intention must fail before an outcome is generated.");
  assert.deepEqual(await getWorldSimulationState(id, options), before);
  assert.deepEqual(await getWorldSimulationHistory(id, options), beforeHistory);
  process.env.FILE_TRANSACTION_TEST_MODE = "1";
  await assert.rejects(() => runWorldSimulationTurn({ world_simulation_session_id: id, event_id: "event86b-2" }, { ...common, affectiveAppraisalResolver: undefined, testFailAfterTransactionCommits: 1 }), /Injected|injected|test.*fail/i);
  assert.deepEqual(await getWorldSimulationState(id, options), before);
  assert.deepEqual(await getWorldSimulationHistory(id, options), beforeHistory);
  if (oldMode === undefined) delete process.env.FILE_TRANSACTION_TEST_MODE; else process.env.FILE_TRANSACTION_TEST_MODE = oldMode;
  const second = await runWorldSimulationTurn({ world_simulation_session_id: id, event_id: "event86b-2" }, { ...common, affectiveAppraisalResolver: undefined });
  assert.equal(second.coping_intentions.recorded_count, 2);
  assert.equal(second.affective_appraisal.appraisal_count, 0);
  const secondHistory = await getWorldSimulationHistory(id, options);
  const commitments = structuredClone(secondHistory.turns[1].coping_intention_commitments);
  assert.ok(commitments.records.every(record => record.reason.startsWith(record.character) && record.intention_recorded_before_outcome));
  const readInput = { world_history: secondHistory, character: "Alice", current_turn_id: "future", current_goals: [goalByCharacter.Alice] };
  const read = projectWorldSimulationCopingContinuity(readInput);
  assert.equal(read.recent_intentions.length, 1);
  assert.equal(read.recent_intentions[0].subjective_result.performed, false);
  assert.equal(read.recent_intentions[0].effectiveness_established, false);
  assert.deepEqual(projectWorldSimulationCopingContinuity(JSON.parse(JSON.stringify(readInput))), read);
  for (const forbidden of ["Bob", "SECRET_", "POST_OUTCOME_REWRITE", "receipt_hash", "context_hash", "turn_id", "appraisal_ref"]) assert.equal(JSON.stringify(read).includes(forbidden), false);
  assert.deepEqual(projectWorldSimulationCopingContinuity({ ...readInput, current_goals: [] }).recent_intentions, []);
  assert.deepEqual(projectWorldSimulationCopingContinuity({ ...readInput, current_turn_id: second.turn_id }).recent_intentions, []);
  const forged = structuredClone(secondHistory);
  const record = forged.turns[1].coping_intention_commitments.records[0];
  record.source_context_hash = "f".repeat(64);
  const recordBody = structuredClone(record); delete recordBody.record_hash; record.record_hash = hashAgentRunValue(recordBody);
  const bundle = forged.turns[1].coping_intention_commitments, bundleBody = structuredClone(bundle); delete bundleBody.bundle_hash; bundle.bundle_hash = hashAgentRunValue(bundleBody);
  assert.throws(() => projectWorldSimulationCopingContinuity({ ...readInput, world_history: forged }), /original appraisal and choice/);
  round = 3;
  const third = await runWorldSimulationTurn({ world_simulation_session_id: id, event_id: "event86b-3" }, { ...common, affectiveAppraisalResolver: undefined });
  assert.equal(third.coping_intentions.recorded_count, 0);
  for (const view of views.filter(v => v.round === 3)) {
    assert.equal(view.context.recent_intentions.length, 1, "Coping experience returns to the brain even without a new appraisal resolver.");
    assert.ok(view.context.recent_intentions[0].reason.startsWith(view.character));
    assert.equal(view.context.recent_intentions[0].subjective_result.perceived_result, "The door stayed shut.");
  }
  const final = await getWorldSimulationHistory(id, options);
  assert.deepEqual(final.turns[1].coping_intention_commitments, commitments);
  assert.deepEqual(projectWorldSimulationCopingContinuity({ ...readInput, world_history: final, current_turn_id: first.turn_id }).recent_intentions, []);
  // Exercise bounded recall using canonical commitments, without nine more native turns.
  const extended = structuredClone(final);
  for (let revision = 3; revision < 12; revision++) {
    const turn_id = "coping_extended_" + revision;
    const selected_action_intents = structuredClone(final.turns[1].selected_action_intents);
    const base = { world_simulation_session_id: id, turn_id, state_revision: revision, world_state_hash: "a".repeat(64),
      decision_packets: prepared.decision_packets, selected_action_intents };
    const receipts = buildWorldSimulationSubjectiveChoiceCommitmentReceipts(base);
    const responses = Object.fromEntries(actors.map(character => {
      const context = buildWorldSimulationCopingChoiceContext({ world_history: extended, character, current_turn_id: turn_id, current_goals: [goalByCharacter[character]] });
      return [character, { action_id: "wait", coping_intention: { appraisal_ref: context.character_view.appraisals[0].appraisal_ref,
        strategy: "wait_and_monitor", reason: character + " reason " + revision, desired_change: "Learn what happens" } }];
    }));
    const commitments = buildWorldSimulationCopingIntentionCommitments({ ...base, world_history: extended, responses, subjective_choice_commitment_receipts: receipts });
    const perception = projectWorldSimulationPostOutcomeSubjectivePerception({ turn_id, selected_action_intents,
      action_outcomes: actors.map(actor => ({ actor, action_id: "wait", character_experience: { performed: true, perceived_result: "Observation " + revision } })), state_transitions: [] });
    extended.turns.push({ turn_id, revision_from: revision, revision_to: revision + 1, previous_state_hash: base.world_state_hash,
      committed_at: "2026-09-13T00:00:00Z", selected_action_intents, subjective_choice_commitment_receipts: receipts,
      post_outcome_subjective_perception_projection: perception, coping_intention_commitments: commitments });
  }
  const bounded = projectWorldSimulationCopingContinuity({ ...readInput, world_history: extended });
  assert.equal(bounded.recent_intentions.length, 8);
  assert.equal(bounded.truncated, true);
  assert.deepEqual(bounded.recent_intentions.map(entry => entry.reason), Array.from({ length: 8 }, (_, i) => "Alice reason " + (i + 4)));
} finally {
  if (oldMode === undefined) delete process.env.FILE_TRANSACTION_TEST_MODE; else process.env.FILE_TRANSACTION_TEST_MODE = oldMode;
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("Phase86E explicit coping intention native continuity: PASS");
