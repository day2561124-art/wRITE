import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";
import {
  prepareFormalWorldSimulationTurn,
  submitFormalWorldSimulationCharacterDeliberation,
} from "../../server/src/world-simulation-formal-turn-transport-service.mjs";
import {
  buildWorldSimulationPersistentMoodNativeAdoptionContract,
  persistentMoodContextCharacterViewVersion,
  worldSimulationPersistentMoodNativeAdoptionVersion,
} from "../../server/src/world-simulation-persistent-mood-native-adoption-service.mjs";
import {
  prepareWorldSimulationTurn,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { actors, initial } from "../phase86/phase86-native-fixture.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase89c-${process.pid}-${Date.now()}`,
);
const fixtureOptions = { fixtureRoot };

const moodLabel = "uneasy";
const moodInterpretation = "Repeated obstruction still leaves Alice feeling unsettled.";

function moodDecision(character, evidenceEntries) {
  if (character !== "Alice") return [];
  return [{
    subjective_mood_label: moodLabel,
    interpretation: moodInterpretation,
    supporting_evidence_refs: evidenceEntries.map(entry => entry.evidence_ref),
  }];
}

const common = {
  ...fixtureOptions,
  characterBrain: async () => ({ action_id: "wait" }),
  affectiveAppraisalResolver: async view => {
    const prior = view.prior_appraisals.at(-1);
    const ordinal = prior ? 2 : 1;
    return [{
      context_ref: view.context_ref,
      concern_ref: view.concerns[0].concern_ref,
      ...(prior ? { reappraises_ref: prior.prior_appraisal_ref } : {}),
      goal_congruence: view.character === "Alice" ? "hinders" : "helps",
      expectedness: prior ? "expected" : "unexpected",
      coping_potential: prior ? "possible" : "limited",
      interpretation: `${view.character} affective meaning ${ordinal}`,
    }];
  },
  causalAdjudicator: async input => {
    const next = structuredClone(input.world_state);
    next.event_queue = next.event_queue.slice(1);
    return {
      causal_resolution_id: `causal89c-${input.event.event_id}`,
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

async function bootstrap(label, seed) {
  const session = await beginWorldSimulationSession({
    simulation_label: label,
    seed,
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: structuredClone(initial),
  }, fixtureOptions);
  const sessionId = session.world_simulation_session_id;
  await runWorldSimulationTurn({
    world_simulation_session_id: sessionId,
    event_id: "event86b-1",
  }, common);
  await runWorldSimulationTurn({
    world_simulation_session_id: sessionId,
    event_id: "event86b-2",
  }, common);
  return sessionId;
}

function alicePacket(prepared) {
  return prepared.decision_packets.find(packet => packet.character === "Alice");
}

function bobPacket(prepared) {
  return prepared.decision_packets.find(packet => packet.character === "Bob");
}

async function submitCurrentFormalDeliberation(surface) {
  const current = surface.current_decision;
  assert.ok(current, "Formal deliberation round must expose one current pending decision.");
  const task = current.character_input.experiential_deliberation;
  const outputField = task.response_contract.output_field;
  let values = [];
  if (surface.decision_round_kind === worldSimulationFormalImpasseDecisionKinds.PHASE89B) {
    values = moodDecision(
      current.character_input.character,
      task.persistent_affective_tone_evidence,
    );
  }
  return submitFormalWorldSimulationCharacterDeliberation({
    prepared_turn_handle: surface.prepared_turn_handle,
    decision_handle: current.decision_handle,
    deliberation_response: { [outputField]: values },
  }, fixtureOptions);
}

try {
  const directSessionId = await bootstrap(
    "Phase89C direct persistent mood native adoption",
    "phase89c-direct",
  );

  const directBaseline = await prepareWorldSimulationTurn({
    world_simulation_session_id: directSessionId,
    event_id: "event86b-3",
  }, fixtureOptions);
  const directPrepared = await prepareWorldSimulationTurn({
    world_simulation_session_id: directSessionId,
    event_id: "event86b-3",
  }, {
    ...fixtureOptions,
    persistentMoodInterpretationResolver: async view => moodDecision(
      view.character,
      view.evidence_entries,
    ),
  });

  assert.equal(directPrepared.persistent_mood_interpretation_resolver_views.length, 2);
  assert.equal(directPrepared.persistent_mood_native_adoptions.length, 2);
  const aliceAdoption = directPrepared.persistent_mood_native_adoptions
    .find(adoption => adoption.character === "Alice");
  const bobAdoption = directPrepared.persistent_mood_native_adoptions
    .find(adoption => adoption.character === "Bob");
  assert.equal(aliceAdoption.version, worldSimulationPersistentMoodNativeAdoptionVersion);
  assert.equal(aliceAdoption.phase, "Phase89C");
  assert.equal(
    aliceAdoption.character_view.version,
    persistentMoodContextCharacterViewVersion,
  );
  assert.equal(
    aliceAdoption.character_view.status,
    "subjective_persistent_mood_context_available",
  );
  assert.equal(aliceAdoption.character_view.persistent_mood.label, moodLabel);
  assert.equal(
    aliceAdoption.character_view.persistent_mood.interpretation,
    moodInterpretation,
  );
  assert.equal(aliceAdoption.character_view.persistent_mood.supporting_evidence_count, 2);
  assert.equal(aliceAdoption.character_view.advisory_only, true);
  assert.equal(aliceAdoption.character_view.candidate_generation_authority, false);
  assert.equal(aliceAdoption.character_view.action_selection_authority, false);
  assert.equal(aliceAdoption.character_view.belief_revision_authority, false);
  assert.equal(aliceAdoption.character_view.memory_rewrite_authority, false);
  assert.equal(aliceAdoption.character_view.personality_revision_authority, false);
  assert.equal(aliceAdoption.character_view.world_truth_authority, false);
  assert.equal(
    bobAdoption.character_view.status,
    "no_subjective_persistent_mood_context",
    "Character Brain abstention must remain no persistent mood interpretation.",
  );
  assert.equal(bobAdoption.character_view.persistent_mood, null);

  const baselineAlice = alicePacket(directBaseline);
  const directAlice = alicePacket(directPrepared);
  const directBob = bobPacket(directPrepared);
  assert.ok(baselineAlice && directAlice && directBob);
  assert.deepEqual(
    directAlice.cognition.persistent_mood_context,
    aliceAdoption.character_view,
    "Phase89C must put only its sanitized persistent mood view into current cognition.",
  );
  assert.equal(
    Object.hasOwn(directBob.cognition, "persistent_mood_context"),
    false,
    "Abstention must not fabricate a persistent mood context for another character.",
  );

  const cognitionWithoutMood = structuredClone(directAlice.cognition);
  delete cognitionWithoutMood.persistent_mood_context;
  assert.deepEqual(
    cognitionWithoutMood,
    baselineAlice.cognition,
    "Phase89C must add only persistent_mood_context and must not rewrite Phase86B or other cognition.",
  );
  assert.deepEqual(
    directAlice.cognition.affective_context,
    baselineAlice.cognition.affective_context,
    "Phase86B affective_context must remain an independent unchanged owner.",
  );

  const characterFacingSerialized = JSON.stringify(
    directAlice.cognition.persistent_mood_context,
  );
  for (const forbidden of [
    "evidence_ref",
    "evidence_hash",
    "resolver_view_hash",
    "projection_hash",
    "interpretation_ref",
    "interpretation_hash",
    "turn_id",
    "appraisal_hash",
    "context_ref",
    "SECRET_WORLD_OUTCOME",
    "SECRET_CAUSE",
  ]) {
    assert.equal(
      characterFacingSerialized.includes(forbidden),
      false,
      `Phase89C Character Brain context must not expose private lineage or world truth: ${forbidden}`,
    );
  }

  const directBrainInput = buildWorldSimulationCharacterBrainInput(directAlice);
  assert.deepEqual(
    directBrainInput.cognition.persistent_mood_context,
    directAlice.cognition.persistent_mood_context,
    "Final Character Brain ingress must preserve the exact sanitized Phase89C mood context.",
  );
  assert.equal(
    directBrainInput.subjective_action_deliberation.cognition_grounding_catalog
      .some(grounding => grounding.source_path === "cognition.persistent_mood_context"),
    false,
    "Phase89C must not silently promote persistent mood into Phase74A grounding.",
  );

  const aliceResolverView = directPrepared.persistent_mood_interpretation_resolver_views
    .find(view => view.character === "Alice");
  const formalRound = buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: {
      persistent_mood_interpretation_resolver_views: [aliceResolverView],
    },
    prior_submissions: [],
  });
  assert.equal(
    formalRound.decision_round_kind,
    worldSimulationFormalImpasseDecisionKinds.PHASE89B,
  );
  assert.equal(formalRound.decision_inputs.length, 1);
  assert.equal(
    formalRound.decision_inputs[0].character_input.experiential_deliberation
      .response_contract.output_field,
    "mood_interpretations",
  );
  assert.equal(
    JSON.stringify(formalRound.decision_inputs[0].character_input)
      .includes("resolver_view_hash"),
    false,
  );
  assert.throws(
    () => buildWorldSimulationFormalImpasseStoredSubmission({
      resolver_binding: formalRound.decision_inputs[0].resolver_binding,
      character_input: formalRound.decision_inputs[0].character_input,
      deliberation_response: {
        mood_interpretations: [{
          ...moodDecision("Alice", aliceResolverView.evidence_entries)[0],
          intensity: 0.9,
        }],
      },
    }),
    error => error?.code
      === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
    "Formal Phase89B must reject numeric or authority-bearing mood fields.",
  );

  const formalSessionId = await bootstrap(
    "Phase89C formal persistent mood native adoption",
    "phase89c-formal",
  );
  let formalSurface = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: formalSessionId,
  }, fixtureOptions);
  assert.equal(
    formalSurface.decision_round_kind,
    worldSimulationFormalImpasseDecisionKinds.PHASE89B,
    "Formal transport must expose Phase89B before final action selection when prior affective evidence exists.",
  );

  let guard = 0;
  while (formalSurface.decision_round_kind !== worldSimulationFormalImpasseDecisionKinds.ACTION) {
    formalSurface = await submitCurrentFormalDeliberation(formalSurface);
    guard += 1;
    assert.ok(guard < 40, "Formal pre-action deliberation chain must converge to action selection.");
  }

  assert.equal(formalSurface.current_decision.character_input.character, "Alice");
  const formalAliceInput = formalSurface.current_decision.character_input;
  assert.deepEqual(
    formalAliceInput.cognition.persistent_mood_context,
    directAlice.cognition.persistent_mood_context,
    "Direct and formal same-snapshot routes must expose the same sanitized persistent mood context.",
  );
  assert.equal(
    formalAliceInput.subjective_action_deliberation.cognition_grounding_catalog
      .some(grounding => grounding.source_path === "cognition.persistent_mood_context"),
    false,
  );
  assert.equal(
    JSON.stringify(formalAliceInput.cognition.persistent_mood_context)
      .includes("evidence_ref"),
    false,
  );

  const contract = buildWorldSimulationPersistentMoodNativeAdoptionContract();
  assert.equal(contract.phase, "Phase89C");
  assert.equal(contract.source_evidence_owner, "Phase89A");
  assert.equal(contract.source_interpretation_owner, "Phase89B");
  assert.equal(contract.exact_phase89b_resolver_view_reconstruction_required, true);
  assert.equal(contract.character_view_sanitized, true);
  assert.equal(contract.independent_persistent_mood_context, true);
  assert.equal(contract.phase86b_affective_context_overwritten, false);
  assert.equal(contract.numeric_intensity_modeled, false);
  assert.equal(contract.numeric_decay_rate_modeled, false);
  assert.equal(contract.candidate_generation_authority, false);
  assert.equal(contract.action_selection_authority, false);
  assert.equal(contract.belief_revision_authority, false);
  assert.equal(contract.memory_rewrite_authority, false);
  assert.equal(contract.personality_revision_authority, false);
  assert.equal(contract.world_truth_authority, false);
  assert.equal(contract.same_turn_phase86_feedback_allowed, false);
  assert.equal(contract.deliberation_grounding_installed, false);
} finally {
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("Phase89C persistent mood interpretation native adoption: PASS");
