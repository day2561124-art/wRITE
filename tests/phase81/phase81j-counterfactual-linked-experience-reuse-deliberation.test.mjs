import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-retention-capsule-service.mjs";
import {
  projectWorldSimulationCounterfactualLinkedExperienceReentry,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseProjection,
  buildWorldSimulationCounterfactualLinkedExperienceReuseContract,
  buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceReuse,
  worldSimulationCounterfactualLinkedExperienceReuseVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";

const sessionId = "session_phase81j";
const character = "千夜";
const historicalTurnId = "turn_phase81j_history";
const historicalRevision = 21;
const historicalWorldStateHash = "world_state_hash_phase81j_history";
const currentTurnId = "turn_phase81j_current";
const currentRevision = 27;
const currentWorldStateHash = "world_state_hash_phase81j_current";

function clone(value) {
  return structuredClone(value);
}

function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}

function retainedProjection() {
  const intent = "approach using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: historicalRevision,
    world_state_hash: historicalWorldStateHash,
    character,
    source_phase81g_evidence_ref: "phase81g_evidence_phase81j",
    source_phase81g_evidence_hash: "phase81g_evidence_hash_phase81j",
    source_phase81e_projection_hash: "phase81e_projection_hash_phase81j",
    source_phase81e_judgment_ref: "phase81e_judgment_phase81j",
    source_phase81e_judgment_hash: "phase81e_judgment_hash_phase81j",
    source_phase81d_projection_hash: "phase81d_projection_hash_phase81j",
    source_phase81d_reentry_candidate_ref: "phase81d_reentry_phase81j",
    source_phase81d_reentry_candidate_hash: "phase81d_reentry_hash_phase81j",
    current_action_id: "historical_covered_advance",
    current_action_ref: "phase74a_historical_covered_advance",
    current_context_cue_signatures: [
      {
        cue_kind: "action_candidate.intent",
        cue_content_hash: cueContentHash("action_candidate.intent", intent),
        action_defining: true,
        retention_role: "retained_exact_current_support",
      },
      {
        cue_kind: "action_candidate.movement",
        cue_content_hash: cueContentHash("action_candidate.movement", movement),
        action_defining: true,
        retention_role: "incorporated_current_context_addition",
      },
    ],
    addressed_historical_context_difference_kinds: ["action_candidate.known_costs"],
    current_selected_action_subjective_experience: {
      action_id: "historical_covered_advance",
      performed: true,
      perceived_result: "reached_cover",
      perceived_status: "stable_after_move",
    },
    applicability_judgment: "currently_applicable_as_deliberative_evidence",
    selection_relation: "advisory_linked_candidate_was_selected",
    historical_actual_selected_action_id: "direct_advance",
    historical_imagined_alternative_action_id: "covered_advance",
    historical_comparison_direction: "imagined_better_than_actual",
    historical_appraisal_kind: "regret_like_counterfactual_concern",
    historical_preparative_orientation: "future_improvement_candidate",
    source_monitoring: {
      historical_alternative_source: "imagined_decision_time_possibility",
      historical_appraisal_source: "subjective_counterfactual_reflection",
      current_applicability_source: "subjective_deliberative_relevance_judgment",
      current_selection_source: "actual_selected_action_lineage",
      current_outcome_source: "experienced_subjective_outcome",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase81h_retention_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    current_selected_action_subjective_outcome_observed: true,
    historical_imagined_alternative_was_experienced: false,
    historical_unchosen_outcome_observed: false,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    counterfactual_advisory_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    counterfactual_linked_capsule_is_episodic_fact_memory: false,
    same_turn_reentry_allowed: false,
    world_state_mutated: false,
    world_truth_authority: false,
  };
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    phase: "Phase81H",
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: historicalRevision,
    world_state_hash: historicalWorldStateHash,
    source_phase81g_projection_hash: "phase81g_projection_hash_phase81j",
    source_phase81e_projection_hashes: ["phase81e_projection_hash_phase81j"],
    source_phase81d_projection_hashes: ["phase81d_projection_hash_phase81j"],
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81g_outcome_evidence_verified: true,
      exact_phase81e_revalidation_lineage_verified: true,
      exact_phase81d_reentry_lineage_verified: true,
      hash_level_current_context_signatures_retained: true,
      historical_and_current_sources_kept_separate: true,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_capsules: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      future_reentry_or_usefulness_interpretation_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

function worldHistory() {
  const retention = retainedProjection();
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: historicalTurnId,
      revision_from: historicalRevision,
      revision_to: historicalRevision + 1,
      previous_state_hash: historicalWorldStateHash,
      next_state_hash: `next_${historicalWorldStateHash}`,
      counterfactual_linked_experience_retention: retention,
    }],
  };
}

function phase81IProjection() {
  const candidates = [{
    action_id: "current_covered_advance",
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["more_energy"],
    duration_s: 4,
    target: { label: "doorway" },
  }];
  const cognition = {
    goals: [{ summary: "reach ally" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return projectWorldSimulationCounterfactualLinkedExperienceReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidates,
    source_phase74a_deliberation: phase74A,
    world_history: worldHistory(),
  });
}

function rehashIntent(intent) {
  const identity = clone(intent);
  for (const key of [
    "reuse_intent_ref", "reuse_intent_hash",
    "historical_subjective_outcome_is_candidate_evidence_only",
    "historical_subjective_outcome_is_current_world_truth",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_prior_outcome",
    "advisory_effectiveness_inferred", "success_failure_interpretation_performed",
    "causal_credit_assigned", "preference_selected", "action_selected",
    "belief_revision_performed", "semantic_revision_performed",
    "subjective_memory_rewrite_performed", "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  intent.reuse_intent_hash = hash;
  intent.reuse_intent_ref = `phase81j_reuse_${hash.slice(0, 24)}`;
}

function rehashProjection(projection) {
  const output = clone(projection);
  delete output.projection_hash;
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseContract();
assert.equal(contract.phase, "Phase81J");
assert.equal(contract.source_owner, "Phase81I");
assert.equal(contract.refs_only_decision_contract, true);
assert.equal(contract.reuse_requires_action_defining_exact_current_support, true);
assert.equal(contract.changed_context_requires_difference_handling, true);
assert.equal(contract.historical_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.advisory_effectiveness_inferred, false);
assert.equal(contract.effectiveness_judgment_allowed, false);
assert.equal(contract.action_selection_allowed, false);
assert.equal(contract.preference_selection_allowed, false);
assert.equal(contract.belief_revision_allowed, false);
assert.equal(contract.semantic_revision_allowed, false);
assert.equal(contract.subjective_memory_rewrite_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase81I = phase81IProjection();
assert.equal(phase81I.reentry_candidate_count, 1);
const view = buildWorldSimulationCounterfactualLinkedExperienceReuseResolverView({
  source_phase81i_projection: phase81I,
  expected_source: { world_history: worldHistory() },
});
assert.equal(view.version, worldSimulationCounterfactualLinkedExperienceReuseVersion);
assert.equal(view.linked_experience_candidates.length, 1);
const candidate = view.linked_experience_candidates[0];
assert.equal(candidate.current_action_id, "current_covered_advance");
assert.equal(candidate.prior_linked_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(candidate.advisory_effectiveness_inferred, false);
const actionDefiningRef = candidate.exact_current_cue_matches
  .find((match) => match.action_defining === true)?.current_cue_ref;
assert.ok(actionDefiningRef);
const dropRef = candidate.unmatched_retained_context_signatures[0]?.retained_cue_ref;
const incorporateRef = candidate.current_additional_candidate_cues[0]?.current_cue_ref;
assert.equal(candidate.current_context_difference_present, true);
assert.ok(dropRef || incorporateRef);
const decision = {
  reentry_candidate_ref: candidate.reentry_candidate_ref,
  retain_matched_current_cue_refs: [actionDefiningRef],
  drop_unmatched_retained_cue_refs: dropRef ? [dropRef] : [],
  incorporate_current_additional_cue_refs: dropRef ? [] : [incorporateRef],
};
const projection = projectWorldSimulationCounterfactualLinkedExperienceReuse({
  source_phase81i_projection: phase81I,
  expected_source: { world_history: worldHistory() },
  resolver_view: view,
  linked_experience_reuse_decisions: [decision],
});
assert.equal(projection.phase, "Phase81J");
assert.equal(projection.reuse_intent_count, 1);
assert.equal(projection.reuse_intents[0].current_action_id, "current_covered_advance");
assert.equal(projection.reuse_intents[0].historical_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(projection.reuse_intents[0].advisory_effectiveness_inferred, false);
assert.equal(projection.reuse_intents[0].preference_selected, false);
assert.equal(projection.reuse_intents[0].action_selected, false);
assert.equal(projection.reuse_intents[0].world_truth_authority, false);
assert.equal(projection.character_view.advisory_only, true);
assert.equal(projection.character_view.effectiveness_authority, false);
assert.equal(projection.character_view.selected_action_authority, false);
assert.doesNotThrow(() => assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(
  projection,
  {
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
  },
));

const omitted = projectWorldSimulationCounterfactualLinkedExperienceReuse({
  source_phase81i_projection: phase81I,
  expected_source: { world_history: worldHistory() },
  resolver_view: view,
  linked_experience_reuse_decisions: [],
});
assert.equal(omitted.reuse_intent_count, 0);

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuse({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
    resolver_view: view,
    linked_experience_reuse_decisions: [{
      ...decision,
      retain_matched_current_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SUPPORT_REQUIRED",
);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuse({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
    resolver_view: view,
    linked_experience_reuse_decisions: [{
      ...decision,
      drop_unmatched_retained_cue_refs: [],
      incorporate_current_additional_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_DIFFERENCE_UNADDRESSED",
);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuse({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
    resolver_view: view,
    linked_experience_reuse_decisions: [{
      ...decision,
      effectiveness: "proven",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_AUTHORITY_FIELD_FORBIDDEN",
);

const staleView = clone(view);
staleView.linked_experience_candidates[0].historical_comparison_direction = "forged";
delete staleView.resolver_view_hash;
staleView.resolver_view_hash = hashAgentRunValue(staleView);
assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuse({
    source_phase81i_projection: phase81I,
    expected_source: { world_history: worldHistory() },
    resolver_view: staleView,
    linked_experience_reuse_decisions: [],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_VIEW_STALE",
);

// Re-hashing forged nested lineage must not bypass exact Phase81I source validation.
const forgedLineage = clone(projection);
forgedLineage.reuse_intents[0].historical_comparison_direction = "forged_comparison";
rehashIntent(forgedLineage.reuse_intents[0]);
const forgedLineageRehashed = rehashProjection(forgedLineage);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(
    forgedLineageRehashed,
    {
      source_phase81i_projection: phase81I,
      expected_source: { world_history: worldHistory() },
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
);

// Re-hashing a forged cue summary must likewise fail against the selected exact refs.
const forgedCueKinds = clone(projection);
forgedCueKinds.reuse_intents[0].retained_matched_current_cue_kinds = ["forged.kind"];
rehashIntent(forgedCueKinds.reuse_intents[0]);
const forgedCueKindsRehashed = rehashProjection(forgedCueKinds);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(
    forgedCueKindsRehashed,
    {
      source_phase81i_projection: phase81I,
      expected_source: { world_history: worldHistory() },
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_SOURCE_MISMATCH",
);

const forgedCharacterView = clone(projection);
forgedCharacterView.character_view.linked_experience_reuse_intents[0]
  .advisory_effectiveness_inferred = true;
const forgedCharacterViewRehashed = rehashProjection(forgedCharacterView);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(
    forgedCharacterViewRehashed,
    {
      source_phase81i_projection: phase81I,
      expected_source: { world_history: worldHistory() },
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_CHARACTER_VIEW_MISMATCH",
);

const formalRound = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    counterfactual_linked_experience_reuse_resolver_views: [view],
  },
  prior_submissions: [],
});
assert.equal(formalRound.decision_round_kind, worldSimulationFormalImpasseDecisionKinds.PHASE81J);
assert.equal(formalRound.decision_inputs.length, 1);
assert.equal(
  formalRound.decision_inputs[0].character_input.experiential_deliberation
    .response_contract.output_field,
  "linked_experience_reuse_decisions",
);
assert.equal(
  JSON.stringify(formalRound.decision_inputs[0].character_input).includes("resolver_view_hash"),
  false,
);
const stored = buildWorldSimulationFormalImpasseStoredSubmission({
  resolver_binding: formalRound.decision_inputs[0].resolver_binding,
  character_input: formalRound.decision_inputs[0].character_input,
  deliberation_response: { linked_experience_reuse_decisions: [decision] },
});
const replay = buildWorldSimulationFormalImpasseResolverReplay([stored]);
assert.deepEqual(
  await replay.counterfactualLinkedExperienceReuseResolver(view),
  [decision],
);
assert.equal(
  buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: { counterfactual_linked_experience_reuse_resolver_views: [view] },
    prior_submissions: [stored],
  }),
  null,
);
assert.throws(
  () => buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: formalRound.decision_inputs[0].resolver_binding,
    character_input: formalRound.decision_inputs[0].character_input,
    deliberation_response: {
      linked_experience_reuse_decisions: [{ ...decision, action_id: "forbidden" }],
    },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const transportSource = await readFile(
  "server/src/world-simulation-formal-turn-transport-service.mjs",
  "utf8",
);
const brokerSource = await readFile(
  "server/src/world-simulation-prepared-turn-ephemeral-broker.mjs",
  "utf8",
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_projections:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_projections \?\? null/,
);
assert.match(loopSource, /counterfactualLinkedExperienceReuseResolver/);
assert.match(loopSource, /brainInput\.counterfactual_linked_experience_reuse/);
assert.match(loopSource, /counterfactualLinkedExperienceReuseProjections/);
assert.match(transportSource, /counterfactual_linked_experience_reuse_resolver_views/);
assert.match(transportSource, /counterfactualLinkedExperienceReuseProjections/);
assert.match(
  transportSource,
  /acquisition\.prepared_turn\.counterfactual_linked_experience_reuse_projections/,
);
assert.match(brokerSource, /worldSimulationFormalImpasseDecisionKinds\.PHASE81J/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81J",
  version: worldSimulationCounterfactualLinkedExperienceReuseVersion,
  exact_phase81i_lineage_required: true,
  action_defining_exact_current_support_required: true,
  changed_context_difference_handling_required: true,
  prior_subjective_outcome_candidate_evidence_only: true,
  rehashed_nested_lineage_forgery_rejected: true,
  formal_same_snapshot_replay_verified: true,
  advisory_effectiveness_authority: false,
  direct_action_selection_authority: false,
  world_truth_authority: false,
}));
console.log("Phase81J counterfactual-linked experience reuse deliberation tests passed.");
