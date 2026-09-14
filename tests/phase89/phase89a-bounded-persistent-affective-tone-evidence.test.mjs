import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationPersistentAffectiveToneEvidenceContract,
  persistentAffectiveToneEvidenceMaxEntries,
  projectWorldSimulationPersistentAffectiveToneEvidence,
  worldSimulationPersistentAffectiveToneEvidenceVersion,
} from "../../server/src/world-simulation-affective-appraisal-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { actors, initial } from "../phase86/phase86-native-fixture.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase89a-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
let round = 1;

const common = {
  ...options,
  characterBrain: async () => ({ action_id: "wait" }),
  affectiveAppraisalResolver: async view => {
    const prior = view.prior_appraisals.at(-1);
    return [{
      context_ref: view.context_ref,
      concern_ref: view.concerns[0].concern_ref,
      ...(prior ? { reappraises_ref: prior.prior_appraisal_ref } : {}),
      goal_congruence: view.character === "Alice" ? "hinders" : "helps",
      expectedness: round === 1 ? "unexpected" : "expected",
      coping_potential: round === 1 ? "limited" : "possible",
      interpretation: `${view.character} affective meaning ${round}`,
    }];
  },
  causalAdjudicator: async input => {
    const next = structuredClone(input.world_state);
    next.event_queue = next.event_queue.slice(1);
    return {
      causal_resolution_id: `causal89a-${input.event.event_id}`,
      next_world_state: next,
      state_transitions: [],
      action_outcomes: actors.map(actor => ({
        actor,
        action_id: "wait",
        result: "SECRET_WORLD_OUTCOME",
        causal_evidence: "SECRET_CAUSE",
        character_experience: {
          performed: true,
          perceived_result: "The door stayed shut.",
        },
      })),
      knowledge_transitions: [],
      scheduled_events: [],
    };
  },
};

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "Phase89A persistent affective-tone evidence",
    seed: "phase89a",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;

  const first = await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "event86b-1",
  }, common);
  round = 2;
  await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "event86b-2",
  }, common);

  const history = await getWorldSimulationHistory(id, options);
  const input = {
    world_history: history,
    character: "Alice",
    current_turn_id: "future-turn",
  };
  const evidence = projectWorldSimulationPersistentAffectiveToneEvidence(input);

  assert.equal(evidence.version, worldSimulationPersistentAffectiveToneEvidenceVersion);
  assert.equal(evidence.source, "canonical_committed_phase86_affective_history");
  assert.equal(evidence.evidence_count, 2);
  assert.equal(evidence.distinct_committed_turn_count, 2);
  assert.equal(evidence.spans_multiple_committed_turns, true);
  assert.equal(evidence.evidence_entries.length <= persistentAffectiveToneEvidenceMaxEntries, true);
  assert.deepEqual(
    evidence.evidence_entries.map(entry => entry.interpretation),
    ["Alice affective meaning 1", "Alice affective meaning 2"],
  );
  assert.deepEqual(
    evidence.evidence_entries.map(entry => entry.goal_congruence),
    ["hinders", "hinders"],
  );
  assert.deepEqual(
    evidence.evidence_entries.map(entry => entry.coping_potential),
    ["limited", "possible"],
  );
  assert.ok(evidence.evidence_entries.every(entry =>
    entry.historical_subjective_appraisal === true
    && entry.historical_appraisal_is_current_fact === false
    && entry.current_mood_established === false
    && entry.objective_emotion_label_established === false
    && entry.action_selection_implied === false
    && entry.world_truth_authority === false));
  assert.equal(evidence.boundaries.character_scope_is_cross_goal, true);
  assert.equal(evidence.boundaries.same_turn_feedback_allowed, false);
  assert.equal(evidence.boundaries.current_mood_established, false);
  assert.equal(evidence.boundaries.named_mood_inferred, false);
  assert.equal(evidence.boundaries.numeric_intensity_modeled, false);
  assert.equal(evidence.boundaries.numeric_decay_rate_modeled, false);
  assert.equal(evidence.boundaries.personality_baseline_mood_modeled, false);
  assert.equal(evidence.boundaries.belief_revision_authority, false);
  assert.equal(evidence.boundaries.action_selection_authority, false);
  assert.equal(evidence.boundaries.world_truth_authority, false);

  // Persistent affect is character-wide rather than gated by the active goal.
  assert.deepEqual(
    projectWorldSimulationPersistentAffectiveToneEvidence({ ...input, current_goals: [] }),
    evidence,
  );

  const bob = projectWorldSimulationPersistentAffectiveToneEvidence({
    ...input,
    character: "Bob",
  });
  assert.equal(bob.evidence_count, 2);
  assert.ok(bob.evidence_entries.every(entry => entry.interpretation.startsWith("Bob")));
  assert.ok(evidence.evidence_entries.every(entry => entry.interpretation.startsWith("Alice")));

  const sameTurn = projectWorldSimulationPersistentAffectiveToneEvidence({
    ...input,
    current_turn_id: first.turn_id,
  });
  assert.equal(sameTurn.evidence_count, 0,
    "Current-turn appraisal must not feed back into the same turn's persistent affective evidence.");

  const serialized = JSON.stringify(evidence);
  for (const forbidden of [
    "turn_id",
    "appraisal_hash",
    "context_ref",
    "projection_hash",
    "choice_receipt",
    "SECRET_WORLD_OUTCOME",
    "SECRET_CAUSE",
    "Bob affective meaning",
  ]) {
    assert.equal(serialized.includes(forbidden), false,
      `Phase89A evidence must not expose engine lineage or another character: ${forbidden}`);
  }

  assert.deepEqual(
    projectWorldSimulationPersistentAffectiveToneEvidence(JSON.parse(JSON.stringify(input))),
    evidence,
    "Persistent affective-tone evidence must replay deterministically.",
  );

  const corrupt = structuredClone(history);
  corrupt.turns[0].affective_appraisal_record.projection.appraisals[0].interpretation = "forged";
  assert.throws(
    () => projectWorldSimulationPersistentAffectiveToneEvidence({ ...input, world_history: corrupt }),
    error => error.code === "WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID",
    "Phase89A must fail closed when its Phase86 source history no longer revalidates.",
  );

  const contract = buildWorldSimulationPersistentAffectiveToneEvidenceContract();
  assert.equal(contract.phase, "Phase89A");
  assert.equal(contract.character_scope_is_cross_goal, true);
  assert.equal(contract.same_turn_feedback_allowed, false);
  assert.equal(contract.current_mood_established, false);
  assert.equal(contract.named_mood_inferred, false);
  assert.equal(contract.numeric_intensity_modeled, false);
  assert.equal(contract.numeric_decay_rate_modeled, false);
  assert.equal(contract.personality_baseline_mood_modeled, false);
  assert.equal(contract.belief_revision_authority, false);
  assert.equal(contract.action_selection_authority, false);
  assert.equal(contract.world_truth_authority, false);
} finally {
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Phase89A bounded persistent affective-tone evidence: PASS");
