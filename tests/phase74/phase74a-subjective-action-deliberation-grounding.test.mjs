import assert from "node:assert/strict";

import {
  buildWorldSimulationSubjectiveActionDeliberationContract,
  buildWorldSimulationSubjectiveActionDeliberationView,
  subjectiveActionDeliberationCharacterViewVersion,
  worldSimulationSubjectiveActionDeliberationVersion,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";

const CHARACTER = "千夜測試角色";

const cognition = {
  goals: ["保護同伴", "離開危險區域"],
  values: {
    loyalty: "high",
    caution: "important",
  },
  relationship_cognition: {
    同伴甲: {
      relation: "trusted",
      internal_person_id: "must_not_leak",
    },
  },
  decision_pressures: [
    "同伴仍在危險區域",
    "出口可能很快關閉",
  ],
  current_action: "守住走廊入口",
  emotion: {
    state: "緊張",
    intensity: "high",
    engine_emotion_id: "must_not_leak",
  },
  working_context: {
    focus: {
      content: "出口正在關閉",
      source_event_id: "must_not_leak",
    },
    active_context: [
      { content: "同伴仍在身後" },
      { content: "走廊另一端有威脅", projection_hash: "must_not_leak" },
    ],
    peripheral_context: [
      { content: "不應由 Phase74A 自動納入 active deliberation grounding" },
    ],
  },
  known: ["出口在東側"],
  uncertain: ["敵人是否會追上來"],
};

const candidates = [
  {
    action_id: "hold_position",
    intent: "繼續守住走廊，替同伴爭取時間",
    prerequisites: ["仍能維持防守姿勢"],
    known_costs: ["自己可能被包圍"],
    blocked_by: [],
    duration_estimate: "短時間",
    target: "走廊入口",
    resource_commitment: { stamina: "moderate" },
  },
  {
    action_id: "retreat_with_ally",
    intent: "和同伴一起向東側出口撤退",
    prerequisites: ["同伴能夠移動"],
    known_costs: ["放棄目前防守位置"],
    blocked_by: [],
    duration_estimate: "立即",
    target: "東側出口",
  },
];

const contract = buildWorldSimulationSubjectiveActionDeliberationContract();
assert.equal(contract.phase, "Phase74A");
assert.equal(contract.version, worldSimulationSubjectiveActionDeliberationVersion);
assert.equal(contract.candidate_source_owner, "existing_world_action_proposer");
assert.equal(contract.candidate_generation_duplicated, false);
assert.equal(contract.character_brain_remains_final_action_choice_owner, true);
assert.equal(contract.prepared_turn_broker_remains_membership_and_submission_authority, true);
assert.equal(contract.action_outcome_owner, "causal_simulator");
assert.equal(contract.qualitative_grounding_only, true);
assert.equal(contract.explicit_impasse_or_reject_all_preserved, true);
assert.equal(contract.deterministic_action_winner_computed, false);
assert.equal(contract.subjective_prospective_consequence_simulation_modeled, false);
assert.equal(contract.cross_option_preference_resolution_modeled, false);
assert.equal(contract.durable_choice_receipt_modeled, false);
assert.equal(contract.expected_utility_optimizer_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.action_outcome_authority_claimed, false);

const inputSnapshot = JSON.stringify({ character: CHARACTER, cognition, candidates });
const view = buildWorldSimulationSubjectiveActionDeliberationView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
});
assert.equal(view.version, subjectiveActionDeliberationCharacterViewVersion);
assert.equal(view.source_version, worldSimulationSubjectiveActionDeliberationVersion);
assert.equal(view.character, CHARACTER);
assert.equal(view.status, "bounded_deliberation_context_ready");
assert.equal(view.action_option_count, 2);
assert.equal(view.action_options[0].action_id, "hold_position");
assert.equal(view.action_options[1].action_id, "retreat_with_ally");
assert.match(view.action_options[0].action_ref, /^phase74a_action_/);
assert.equal(Object.hasOwn(view.action_options[0], "action_hash"), false);
assert.equal(Object.hasOwn(view.action_options[0], "intent"), false);
assert.equal(view.action_options[0].candidate_is_non_binding, true);
assert.equal(
  view.action_options[0].candidate_semantic_content_remains_in_candidate_action_intents,
  true,
);
assert.equal(view.action_options[0].outcome_not_predicted, true);
assert.equal(view.choice_boundary.character_brain_owns_final_choice, true);
assert.equal(view.choice_boundary.may_select_only_listed_action_ids_or_reject_all, true);
assert.equal(view.choice_boundary.reject_all_allowed, true);
assert.equal(view.choice_boundary.deterministic_winner_not_computed, true);
assert.equal(view.choice_boundary.numeric_expected_utility_not_computed, true);
assert.equal(view.choice_boundary.subjective_prospective_consequence_simulation_deferred, true);
assert.equal(view.choice_boundary.cross_option_preference_resolution_deferred, true);
assert.equal(view.choice_boundary.durable_choice_receipt_deferred, true);
assert.equal(view.information_boundary.raw_world_state_exposed, false);
assert.equal(view.information_boundary.other_character_private_cognition_exposed, false);
assert.equal(
  view.information_boundary.cognition_semantic_content_duplicated_in_deliberation_view,
  false,
);
assert.equal(
  view.information_boundary.candidate_intent_content_duplicated_in_deliberation_view,
  false,
);
assert.ok(view.deliberation_view_hash);
assert.equal(
  JSON.stringify({ character: CHARACTER, cognition, candidates }),
  inputSnapshot,
  "Phase74A must not mutate caller-owned cognition or action candidates.",
);

const groundingKinds = new Set(
  view.cognition_grounding_catalog.map((entry) => entry.grounding_kind),
);
for (const expected of [
  "active_goal",
  "value_context",
  "relationship_context",
  "decision_pressure",
  "current_action",
  "emotion_context",
  "working_memory_focus",
  "working_memory_active_context",
  "known_context",
  "uncertain_context",
]) {
  assert.equal(groundingKinds.has(expected), true, `missing grounding kind ${expected}`);
}
assert.equal(
  groundingKinds.has("working_memory_peripheral_context"),
  false,
  "Phase74A must consume only the already output-open focus/active working context, not arbitrary peripheral state.",
);
for (const grounding of view.cognition_grounding_catalog) {
  assert.match(grounding.grounding_ref, /^phase74a_grounding_/);
  assert.equal(typeof grounding.source_path, "string");
  assert.equal(grounding.semantic_content_duplicated, false);
  assert.equal(Object.hasOwn(grounding, "content"), false);
  assert.equal(Object.hasOwn(grounding, "grounding_hash"), false);
}
assert.deepEqual(
  view.action_options[0].grounding_refs,
  view.cognition_grounding_catalog.map((entry) => entry.grounding_ref),
  "Each Phase74A action option must bind to the same bounded same-character cognition catalog without copying cognition content.",
);
const groundingText = JSON.stringify(view.cognition_grounding_catalog);
assert.equal(groundingText.includes("must_not_leak"), false);
assert.equal(groundingText.includes("internal_person_id"), false);
assert.equal(groundingText.includes("source_event_id"), false);
assert.equal(groundingText.includes("projection_hash"), false);
assert.equal(groundingText.includes("engine_emotion_id"), false);
assert.equal(groundingText.includes("出口正在關閉"), false);
assert.equal(groundingText.includes("保護同伴"), false);
assert.equal(JSON.stringify(view).includes(candidates[0].intent), false);

const repeated = buildWorldSimulationSubjectiveActionDeliberationView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: candidates,
});
assert.deepEqual(repeated, view, "Phase74A view construction must be deterministic.");

const mechanicalVariantA = buildWorldSimulationSubjectiveActionDeliberationView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: [{
    action_id: "advance",
    intent: "向前移動",
    movement: { direction: "east", distance_m: 2 },
  }],
});
const mechanicalVariantB = buildWorldSimulationSubjectiveActionDeliberationView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: [{
    action_id: "advance",
    intent: "向前移動",
    movement: { direction: "east", distance_m: 5 },
  }],
});
assert.notEqual(
  mechanicalVariantA.action_options[0].action_ref,
  mechanicalVariantB.action_options[0].action_ref,
  "Opaque Phase74A action refs must distinguish different proposer-owned mechanical intent parameters without exposing those parameters twice.",
);

const noCandidates = buildWorldSimulationSubjectiveActionDeliberationView({
  character: CHARACTER,
  cognition,
  candidate_action_intents: [],
});
assert.equal(noCandidates.status, "no_action_candidates_available");
assert.equal(noCandidates.action_option_count, 0);
assert.equal(noCandidates.choice_boundary.reject_all_allowed, true);

assert.throws(
  () => buildWorldSimulationSubjectiveActionDeliberationView({
    character: CHARACTER,
    cognition,
    candidate_action_intents: [
      ...candidates,
      {
        action_id: "hold_position",
        intent: "duplicate identity",
      },
    ],
  }),
  (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_ACTION_ID_DUPLICATE",
);

for (const forbidden of [
  ["outcome", "guaranteed_success"],
  ["utility_score", 99],
  ["success_probability", 1],
  ["selected", true],
]) {
  assert.throws(
    () => buildWorldSimulationSubjectiveActionDeliberationView({
      character: CHARACTER,
      cognition,
      candidate_action_intents: [{
        action_id: `forbidden_${forbidden[0]}`,
        intent: "malformed candidate",
        [forbidden[0]]: forbidden[1],
      }],
    }),
    (error) => error?.code === "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
  );
}

const packet = {
  character: CHARACTER,
  perception: { observed: [], audible: [], other_senses: [] },
  recovered_memories: [],
  retrieval_experience: {
    process_occurred: false,
    initiation_mode: null,
    target_outcome: null,
    recovered_any_content: false,
  },
  cognition,
  candidate_action_intents: candidates,
  boundaries: {},
};
const brainInput = buildWorldSimulationCharacterBrainInput(packet);
assert.equal(
  brainInput.boundaries.subjective_action_deliberation_grounding_v1_installed,
  true,
);
assert.equal(
  brainInput.subjective_action_deliberation.version,
  subjectiveActionDeliberationCharacterViewVersion,
);
assert.deepEqual(
  brainInput.subjective_action_deliberation.action_options.map((option) => option.action_id),
  candidates.map((candidate) => candidate.action_id),
);
assert.equal(
  brainInput.subjective_action_deliberation.choice_boundary.character_brain_owns_final_choice,
  true,
);
assert.equal(
  Object.hasOwn(brainInput.subjective_action_deliberation, "selected_action_id"),
  false,
  "Phase74A must not preselect an action for Character Brain.",
);

console.log("Phase74A subjective action deliberation grounding tests passed.");
