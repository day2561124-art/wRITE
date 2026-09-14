import assert from "node:assert/strict";

import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationContract,
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";

const interpretation = {
  status: "retrieval_conditioned_memory_interpretation_native_adoption_installed",
  interpretation_count: 1,
  interpretations: [{
    prior_interpretation: "Alice believed the door was usually open.",
    later_interpretation: "Alice now suspects access is restricted.",
    relation: "challenges",
    retrieval_conditioned: true,
    subjective_not_world_truth: true,
    original_memory_preserved: true,
    belief_adoption_implied: false,
  }],
};

const cognition = {
  working_context: {
    focus: { context_origin: "perception", description: "Alice sees the locked door." },
    active_context: [],
    peripheral_context: [],
    fading_context: [],
    suspended_context: [],
  },
  retrieval_conditioned_memory_interpretation: interpretation,
};

const candidateActionIntents = [
  { action_id: "wait", intent: "Observe before acting" },
  { action_id: "ask", intent: "Ask whether access rules changed" },
];

const view = buildWorldSimulationSubjectiveActionDeliberationView({
  character: "Alice",
  cognition,
  candidate_action_intents: candidateActionIntents,
});

const interpretationGroundings = view.cognition_grounding_catalog.filter(
  (entry) => entry.grounding_kind === "retrieval_conditioned_memory_interpretation",
);
assert.equal(interpretationGroundings.length, 1,
  "Phase87B sanitized interpretation must become one qualitative Phase74A grounding.");
assert.equal(
  interpretationGroundings[0].source_path,
  "cognition.retrieval_conditioned_memory_interpretation",
);
assert.equal(interpretationGroundings[0].subjective_character_context_only, true);
assert.equal(interpretationGroundings[0].world_truth_authority, false);
assert.equal(interpretationGroundings[0].semantic_content_duplicated, false);
for (const option of view.action_options) {
  assert.equal(
    option.grounding_refs.includes(interpretationGroundings[0].grounding_ref),
    true,
    "Every existing action option may qualitatively reason from the retrieved interpretation without being selected by it.",
  );
  assert.equal(option.candidate_is_non_binding, true);
  assert.equal(option.outcome_not_predicted, true);
}

const packet = {
  character: "Alice",
  perception: {},
  retrieval_experience: {
    process_occurred: true,
    initiation_mode: "deliberate",
    target_outcome: "recovered",
    recovered_any_content: true,
  },
  cognition,
  candidate_action_intents: candidateActionIntents,
  boundaries: {
    recollection_reinstatement_v3_installed: true,
    selective_working_memory_output_gating_v5_installed: true,
    retrieval_conditioned_memory_interpretation_native_adoption_installed: true,
    retrieval_conditioned_memory_interpretation_engine_lineage_exposed: false,
  },
};
const brainInput = buildWorldSimulationCharacterBrainInput(packet);
const nativeGrounding = brainInput.subjective_action_deliberation.cognition_grounding_catalog.find(
  (entry) => entry.grounding_kind === "retrieval_conditioned_memory_interpretation",
);
assert.ok(nativeGrounding,
  "Character Brain native deliberation must receive the Phase88A grounding through the existing Phase74A pipeline.");
assert.deepEqual(
  brainInput.cognition.retrieval_conditioned_memory_interpretation,
  interpretation,
  "Phase88A must not rewrite the Phase87B character-facing interpretation.",
);

const serializedDeliberation = JSON.stringify(brainInput.subjective_action_deliberation);
for (const forbidden of [
  "memory_id",
  "source_memory_ref",
  "retrieval_event_id",
  "retrieval_event_hash",
  "memory_recovery_id",
  "claim_event_id",
  "relation_event_id",
  "projection_hash",
  "world_state_hash",
]) {
  assert.equal(serializedDeliberation.includes(forbidden), false,
    `Phase88A deliberation must not expose private lineage or numeric authority: ${forbidden}`);
}
assert.equal(Object.hasOwn(brainInput, "selected_action"), false);
assert.equal(Object.hasOwn(brainInput, "belief_revision"), false);

const withoutInterpretation = buildWorldSimulationSubjectiveActionDeliberationView({
  character: "Alice",
  cognition: { ...cognition, retrieval_conditioned_memory_interpretation: null },
  candidate_action_intents: candidateActionIntents,
});
assert.equal(
  withoutInterpretation.cognition_grounding_catalog.some(
    (entry) => entry.grounding_kind === "retrieval_conditioned_memory_interpretation",
  ),
  false,
  "No retrieval-conditioned interpretation means no synthetic grounding may be invented.",
);

const ambiguousEmotion = buildWorldSimulationSubjectiveActionDeliberationView({
  character: "Alice",
  cognition: {
    ...cognition,
    emotion: { label: "uneasy" },
    affective_context: { label: "uneasy" },
  },
  candidate_action_intents: candidateActionIntents,
});
const duplicateEmotionGroundings = ambiguousEmotion.cognition_grounding_catalog.filter(
  (entry) => entry.grounding_kind === "emotion_context",
);
assert.equal(
  duplicateEmotionGroundings.length,
  2,
  "Distinct same-label cognition sources must remain distinct groundings rather than being silently collapsed.",
);
assert.notEqual(
  duplicateEmotionGroundings[0].grounding_ref,
  duplicateEmotionGroundings[1].grounding_ref,
  "Ambiguous same-label evidence must retain source-specific grounding identity rather than silently mapping one source onto another.",
);

const contract = buildWorldSimulationSubjectiveActionDeliberationContract();
assert.equal(contract.phase, "Phase74A");
assert.equal(contract.retrieval_conditioned_memory_interpretation_may_ground_deliberation, true);
assert.equal(contract.retrieval_conditioned_memory_interpretation_remains_subjective, true);
assert.equal(contract.retrieval_conditioned_memory_interpretation_belief_adoption_implied, false);
assert.equal(contract.retrieval_conditioned_memory_interpretation_grounding_identity_is_source_specific, true);
assert.equal(contract.ambiguous_grounding_reference_rejected, true);
assert.equal(contract.character_brain_remains_final_action_choice_owner, true);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.action_outcome_authority_claimed, false);

console.log("Phase88A retrieval-conditioned interpretation deliberation grounding: PASS");
