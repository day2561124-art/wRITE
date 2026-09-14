import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationPersistentMoodInterpretationContract,
  buildWorldSimulationPersistentMoodInterpretationResolverView,
  persistentMoodInterpretationCharacterViewVersion,
  projectWorldSimulationPersistentMoodInterpretation,
  worldSimulationPersistentMoodInterpretationVersion,
} from "../../server/src/world-simulation-persistent-affective-tone-interpretation-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";
import { actors, initial } from "../phase86/phase86-native-fixture.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase89b-${process.pid}-${Date.now()}`,
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
      causal_resolution_id: `causal89b-${input.event.event_id}`,
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
    simulation_label: "Phase89B qualitative persistent mood interpretation",
    seed: "phase89b",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;

  await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "event86b-1",
  }, common);
  round = 2;
  await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "event86b-2",
  }, common);

  const history = await getWorldSimulationHistory(id, options);
  const source = {
    world_history: history,
    character: "Alice",
    current_turn_id: "future-turn",
  };
  const view = buildWorldSimulationPersistentMoodInterpretationResolverView(source);

  assert.equal(view.version, worldSimulationPersistentMoodInterpretationVersion);
  assert.equal(view.phase, "Phase89B");
  assert.equal(view.character, "Alice");
  assert.equal(view.source, "phase89a_bounded_persistent_affective_tone_evidence");
  assert.equal(view.evidence_count, 2);
  assert.equal(view.spans_multiple_committed_turns, true);
  assert.deepEqual(
    view.evidence_entries.map(entry => entry.interpretation),
    ["Alice affective meaning 1", "Alice affective meaning 2"],
  );
  assert.equal(view.boundaries.current_mood_not_precomputed_by_engine, true);
  assert.equal(view.boundaries.character_brain_interpretation_required, true);
  assert.equal(view.boundaries.action_selection_authority, false);
  assert.equal(view.boundaries.belief_revision_authority, false);
  assert.equal(view.boundaries.world_truth_authority, false);
  assert.equal(view.response_contract.abstention_allowed, true);

  const resolverSerialized = JSON.stringify(view);
  for (const forbidden of [
    "turn_id",
    "appraisal_hash",
    "context_ref",
    "choice_receipt",
    "SECRET_WORLD_OUTCOME",
    "SECRET_CAUSE",
    "Bob affective meaning",
  ]) {
    assert.equal(
      resolverSerialized.includes(forbidden),
      false,
      `Phase89B Character Brain resolver view must not expose private source lineage: ${forbidden}`,
    );
  }

  const supportingRefs = view.evidence_entries.map(entry => entry.evidence_ref);
  const decisions = [{
    subjective_mood_label: "uneasy",
    interpretation: "Repeated obstruction still leaves Alice feeling unsettled.",
    supporting_evidence_refs: supportingRefs,
  }];
  const projection = projectWorldSimulationPersistentMoodInterpretation({
    ...source,
    resolver_view: view,
    interpretation_decisions: decisions,
  });

  assert.equal(projection.version, worldSimulationPersistentMoodInterpretationVersion);
  assert.equal(projection.phase, "Phase89B");
  assert.equal(projection.character, "Alice");
  assert.equal(projection.status, "subjective_current_mood_interpretation_formed");
  assert.equal(projection.interpretation_count, 1);
  assert.equal(projection.interpretations[0].subjective_mood_label, "uneasy");
  assert.equal(projection.interpretations[0].subjective_current_mood_interpretation, true);
  assert.equal(projection.interpretations[0].objective_current_mood_fact, false);
  assert.equal(projection.interpretations[0].objective_emotion_label_established, false);
  assert.equal(projection.interpretations[0].numeric_intensity_assigned, false);
  assert.equal(projection.interpretations[0].numeric_decay_rate_assigned, false);
  assert.equal(projection.interpretations[0].personality_baseline_assigned, false);
  assert.equal(projection.interpretations[0].action_selection_authority, false);
  assert.equal(projection.interpretations[0].belief_revision_authority, false);
  assert.equal(projection.interpretations[0].memory_rewrite_authority, false);
  assert.equal(projection.interpretations[0].personality_revision_authority, false);
  assert.equal(projection.interpretations[0].world_truth_authority, false);
  assert.deepEqual(projection.interpretations[0].supporting_evidence_refs, [...supportingRefs].sort());

  assert.equal(projection.character_view.version, persistentMoodInterpretationCharacterViewVersion);
  assert.equal(projection.character_view.status, "subjective_current_mood_interpretation_available");
  assert.equal(projection.character_view.current_mood.label, "uneasy");
  assert.equal(
    projection.character_view.current_mood.interpretation,
    "Repeated obstruction still leaves Alice feeling unsettled.",
  );
  assert.equal(projection.character_view.current_mood.supporting_evidence_count, 2);
  assert.equal(projection.character_view.current_mood.subjective_not_world_truth, true);
  assert.equal(projection.character_view.current_mood.reversible_interpretation, true);
  assert.equal(projection.character_view.subjective_current_mood_interpretation_established, true);
  assert.equal(projection.character_view.objective_current_mood_established, false);
  assert.equal(projection.character_view.action_selection_authority, false);
  assert.equal(projection.character_view.belief_revision_authority, false);
  assert.equal(projection.character_view.memory_rewrite_authority, false);
  assert.equal(projection.character_view.personality_revision_authority, false);
  assert.equal(projection.character_view.world_truth_authority, false);

  const characterViewSerialized = JSON.stringify(projection.character_view);
  for (const forbidden of [
    "evidence_ref",
    "evidence_hash",
    "interpretation_ref",
    "interpretation_hash",
    "turn_id",
    "appraisal_hash",
    "context_ref",
  ]) {
    assert.equal(
      characterViewSerialized.includes(forbidden),
      false,
      `Phase89B downstream character view must omit engine/source identities: ${forbidden}`,
    );
  }

  const abstained = projectWorldSimulationPersistentMoodInterpretation({
    ...source,
    resolver_view: view,
    interpretation_decisions: [],
  });
  assert.equal(abstained.status, "no_current_mood_interpretation");
  assert.equal(abstained.interpretation_count, 0);
  assert.equal(abstained.character_view.current_mood, null);
  assert.equal(abstained.character_view.subjective_current_mood_interpretation_established, false);
  assert.equal(abstained.audit.omission_preserved_as_no_interpretation, true);

  assert.throws(
    () => projectWorldSimulationPersistentMoodInterpretation({
      ...source,
      resolver_view: view,
      interpretation_decisions: [{
        ...decisions[0],
        supporting_evidence_refs: ["phase89a_affective_tone_000000000000000000000000"],
      }],
    }),
    error => error.code === "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_SUPPORT_OUT_OF_VIEW",
    "Phase89B must reject support refs outside the exact visible Phase89A evidence.",
  );

  assert.throws(
    () => projectWorldSimulationPersistentMoodInterpretation({
      ...source,
      resolver_view: view,
      interpretation_decisions: [{
        ...decisions[0],
        intensity: 0.9,
      }],
    }),
    error => error.code === "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_AUTHORITY_FIELD_FORBIDDEN",
    "Phase89B must reject numeric intensity or other authority-bearing authoring fields.",
  );

  assert.throws(
    () => projectWorldSimulationPersistentMoodInterpretation({
      ...source,
      resolver_view: view,
      interpretation_decisions: [decisions[0], decisions[0]],
    }),
    error => error.code === "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_DECISION_LIMIT",
    "Phase89B accepts at most one current mood interpretation per character.",
  );

  const bobView = buildWorldSimulationPersistentMoodInterpretationResolverView({
    ...source,
    character: "Bob",
  });
  assert.ok(bobView.evidence_entries.every(entry => entry.interpretation.startsWith("Bob")));
  assert.equal(JSON.stringify(bobView).includes("Alice affective meaning"), false);

  const tamperedView = structuredClone(view);
  tamperedView.evidence_entries[0].interpretation = "forged resolver evidence";
  assert.throws(
    () => projectWorldSimulationPersistentMoodInterpretation({
      ...source,
      resolver_view: tamperedView,
      interpretation_decisions: decisions,
    }),
    error => error.code === "WORLD_SIMULATION_PERSISTENT_MOOD_INTERPRETATION_VIEW_INVALID",
    "Phase89B must fail closed if its resolver view is locally altered.",
  );

  const corruptHistory = structuredClone(history);
  corruptHistory.turns[0].affective_appraisal_record.projection.appraisals[0].interpretation = "forged history";
  assert.throws(
    () => projectWorldSimulationPersistentMoodInterpretation({
      ...source,
      world_history: corruptHistory,
      resolver_view: view,
      interpretation_decisions: decisions,
    }),
    error => error.code === "WORLD_SIMULATION_AFFECTIVE_APPRAISAL_INVALID",
    "Phase89B must reconstruct and revalidate canonical Phase89A/Phase86 history before accepting an interpretation.",
  );

  assert.deepEqual(
    projectWorldSimulationPersistentMoodInterpretation({
      ...JSON.parse(JSON.stringify(source)),
      resolver_view: JSON.parse(JSON.stringify(view)),
      interpretation_decisions: JSON.parse(JSON.stringify(decisions)),
    }),
    projection,
    "Phase89B qualitative mood interpretation must replay deterministically.",
  );

  const contract = buildWorldSimulationPersistentMoodInterpretationContract();
  assert.equal(contract.phase, "Phase89B");
  assert.equal(contract.source_owner, "Phase89A");
  assert.equal(contract.interpretation_owner, "CharacterBrain");
  assert.equal(contract.exact_phase89a_reconstruction_required, true);
  assert.equal(contract.omission_means_no_current_mood_interpretation, true);
  assert.equal(contract.qualitative_interpretation_only, true);
  assert.equal(contract.objective_current_mood_established, false);
  assert.equal(contract.numeric_intensity_modeled, false);
  assert.equal(contract.numeric_decay_rate_modeled, false);
  assert.equal(contract.personality_baseline_modeled, false);
  assert.equal(contract.action_selection_authority, false);
  assert.equal(contract.belief_revision_authority, false);
  assert.equal(contract.memory_rewrite_authority, false);
  assert.equal(contract.personality_revision_authority, false);
  assert.equal(contract.world_truth_authority, false);
  assert.equal(contract.native_loop_adoption_installed, false);
  assert.equal(contract.deliberation_grounding_installed, false);
} finally {
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Phase89B bounded qualitative persistent mood interpretation: PASS");
