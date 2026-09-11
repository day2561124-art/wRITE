import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";
import {
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-retention-capsule-service.mjs";
import {
  projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationContract,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView,
  projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-deliberation-service.mjs";

const sessionId = "session_phase81o";
const character = "千夜";
const retainedTurnId = "turn_phase81o_retained";
const retainedRevision = 51;
const retainedWorldStateHash = "world_state_hash_phase81o_retained";
const currentTurnId = "turn_phase81o_current";
const currentRevision = 57;
const currentWorldStateHash = "world_state_hash_phase81o_current";

function clone(value) {
  return structuredClone(value);
}

function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}

function phase81MRetention() {
  const intent = "advance using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: retainedTurnId,
    state_revision: retainedRevision,
    world_state_hash: retainedWorldStateHash,
    character,
    source_phase81l_evidence_ref: "phase81l_evidence_phase81o",
    source_phase81l_evidence_hash: "phase81l_evidence_hash_phase81o",
    source_phase81j_projection_hash: "phase81j_projection_hash_phase81o",
    source_phase81i_projection_hash: "phase81i_projection_hash_phase81o",
    reuse_intent_ref: "phase81j_reuse_phase81o",
    reuse_intent_hash: "phase81j_reuse_hash_phase81o",
    source_reentry_candidate_ref: "phase81i_reentry_phase81o",
    source_reentry_candidate_hash: "phase81i_reentry_hash_phase81o",
    current_action_id: "retained_covered_advance",
    current_action_ref: "phase74a_retained_covered_advance",
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
    handled_context_difference_kinds: ["action_candidate.known_costs"],
    prior_linked_case_subjective_experience: {
      action_id: "earlier_covered_advance",
      performed: true,
      perceived_result: "reached_first_cover",
      perceived_status: "stable_after_first_move",
    },
    current_selected_action_subjective_experience: {
      action_id: "retained_covered_advance",
      performed: true,
      perceived_result: "reached_second_cover",
      perceived_status: "stable_after_reuse",
    },
    source_monitoring: {
      historical_counterfactual_source: "imagined_decision_time_possibility",
      prior_linked_case_outcome_source: "prior_experienced_subjective_outcome",
      current_reuse_intent_source: "current_subjective_deliberative_reuse_intent",
      current_selection_source: "actual_selected_action_lineage",
      current_outcome_source: "current_experienced_subjective_outcome",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase81m_reuse_retention_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    current_selected_action_subjective_outcome_observed: true,
    prior_linked_case_subjective_outcome_is_current_world_truth: false,
    prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
    reuse_or_advisory_effectiveness_inferred: false,
    historical_counterfactual_truth_evaluated: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
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
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    phase: "Phase81M",
    world_simulation_session_id: sessionId,
    turn_id: retainedTurnId,
    state_revision: retainedRevision,
    world_state_hash: retainedWorldStateHash,
    source_phase81l_projection_hash: "phase81l_projection_hash_phase81o",
    source_phase81j_projection_hashes: ["phase81j_projection_hash_phase81o"],
    source_phase81i_projection_hashes: ["phase81i_projection_hash_phase81o"],
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81l_outcome_evidence_verified: true,
      exact_phase81k_phase81j_phase81i_phase74d_world_history_revalidated: true,
      hash_level_current_context_signatures_retained: true,
      prior_and_current_subjective_outcomes_source_distinct: true,
      prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
      reuse_or_advisory_effectiveness_inferred: false,
      historical_counterfactual_truth_evaluated: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
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
      future_reentry_or_effectiveness_interpretation_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

function worldHistory() {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: retainedTurnId,
      revision_from: retainedRevision,
      revision_to: retainedRevision + 1,
      previous_state_hash: retainedWorldStateHash,
      next_state_hash: `next_${retainedWorldStateHash}`,
      counterfactual_linked_experience_reuse_outcome_retention: phase81MRetention(),
    }],
  };
}

function phase81NSource(history = worldHistory()) {
  const candidates = [{
    action_id: "current_covered_advance",
    intent: "advance using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["higher_attention"],
    duration_s: 5,
    target: { label: "doorway" },
  }];
  const cognition = {
    goals: [{ summary: "reach ally safely" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: cognition,
    current_candidate_action_intents: candidates,
    source_phase74a_deliberation: phase74A,
    world_history: history,
  });
}

function validDecision(view) {
  const candidate = view.reuse_outcome_candidates[0];
  const actionDefining = candidate.exact_current_cue_matches
    .find((match) => match.action_defining === true)?.current_cue_ref;
  const currentAddition = candidate.current_additional_candidate_cues[0]?.current_cue_ref;
  const unmatched = candidate.unmatched_retained_context_signatures[0]?.retained_cue_ref;
  return {
    reentry_candidate_ref: candidate.reentry_candidate_ref,
    retain_matched_current_cue_refs: [actionDefining],
    drop_unmatched_retained_cue_refs: unmatched ? [unmatched] : [],
    incorporate_current_additional_cue_refs:
      unmatched ? [] : (currentAddition ? [currentAddition] : []),
  };
}

function rehashIntent(intent) {
  const identity = clone(intent);
  for (const key of [
    "deliberative_reuse_intent_ref", "deliberative_reuse_intent_hash",
    "prior_linked_case_subjective_outcome_is_candidate_evidence_only",
    "prior_reuse_subjective_outcome_is_candidate_evidence_only",
    "prior_outcomes_compared_for_effectiveness", "repeated_reuse_counts_as_effectiveness_evidence",
    "historical_counterfactual_truth_evaluated", "reuse_effectiveness_inferred",
    "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
    "preference_selected", "action_selected", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed",
    "world_state_mutated", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  intent.deliberative_reuse_intent_hash = hash;
  intent.deliberative_reuse_intent_ref = `phase81o_reuse_${hash.slice(0, 24)}`;
}

function rehashProjection(projection) {
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationContract();
assert.equal(contract.phase, "Phase81O");
assert.equal(contract.source_reentry_owner, "Phase81N");
assert.equal(contract.exact_phase81n_projection_required, true);
assert.equal(contract.exact_current_action_defining_support_required, true);
assert.equal(contract.changed_context_requires_explicit_difference_handling, true);
assert.equal(contract.prior_linked_case_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.prior_reuse_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.prior_outcomes_compared_for_effectiveness, false);
assert.equal(contract.repeated_reuse_counts_as_effectiveness_evidence, false);
assert.equal(contract.reuse_effectiveness_inferred, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const history = worldHistory();
const phase81N = phase81NSource(history);
assert.equal(phase81N.reentry_candidate_count, 1);
const view = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView({
  source_phase81n_projection: phase81N,
  expected_source: { world_history: history },
});
assert.equal(view.reuse_outcome_candidates.length, 1);
assert.equal(view.boundaries.prior_outcomes_compared_for_effectiveness, false);
assert.equal(view.boundaries.direct_action_selection_allowed, false);

const emptyProjection = projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
  source_phase81n_projection: phase81N,
  expected_source: { world_history: history },
  resolver_view: view,
  reuse_outcome_deliberation_decisions: [],
});
assert.equal(emptyProjection.deliberative_reuse_intent_count, 0);

const decision = validDecision(view);
const projection = projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
  source_phase81n_projection: phase81N,
  expected_source: { world_history: history },
  resolver_view: view,
  reuse_outcome_deliberation_decisions: [decision],
});
assert.equal(projection.version, worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion);
assert.equal(projection.phase, "Phase81O");
assert.equal(projection.deliberative_reuse_intent_count, 1);
const intent = projection.deliberative_reuse_intents[0];
assert.equal(intent.current_action_id, "current_covered_advance");
assert.equal(intent.prior_linked_case_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(intent.prior_reuse_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(intent.prior_outcomes_compared_for_effectiveness, false);
assert.equal(intent.reuse_effectiveness_inferred, false);
assert.equal(intent.action_selected, false);
assert.equal(intent.world_truth_authority, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection(
    projection,
    {
      source_phase81n_projection: phase81N,
      expected_source: { world_history: history },
    },
  ));

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
    resolver_view: view,
    reuse_outcome_deliberation_decisions: [{ ...decision, effectiveness: "proven" }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN",
);

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
    resolver_view: view,
    reuse_outcome_deliberation_decisions: [{
      ...decision,
      retain_matched_current_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SUPPORT_REQUIRED",
);

assert.throws(
  () => projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberation({
    source_phase81n_projection: phase81N,
    expected_source: { world_history: history },
    resolver_view: view,
    reuse_outcome_deliberation_decisions: [{
      ...decision,
      drop_unmatched_retained_cue_refs: [],
      incorporate_current_additional_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_DIFFERENCE_UNADDRESSED",
);

// Rehashing Phase81O-local fields cannot alter the exact canonical Phase81N lineage.
const forgedLineage = clone(projection);
forgedLineage.deliberative_reuse_intents[0].prior_reuse_action_subjective_experience.perceived_result =
  "invented_better_reuse_result";
rehashIntent(forgedLineage.deliberative_reuse_intents[0]);
rehashProjection(forgedLineage);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection(
    forgedLineage,
    {
      source_phase81n_projection: phase81N,
      expected_source: { world_history: history },
    },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_DELIBERATION_SOURCE_MISMATCH",
);

const formalSource = await readFile(
  "server/src/world-simulation-formal-turn-transport-service.mjs",
  "utf8",
);
const formalDeliberationSource = await readFile(
  "server/src/world-simulation-formal-experiential-deliberation-service.mjs",
  "utf8",
);
const brokerSource = await readFile(
  "server/src/world-simulation-prepared-turn-ephemeral-broker.mjs",
  "utf8",
);
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  formalSource,
  /buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationResolverView/,
);
assert.match(
  formalSource,
  /counterfactual_linked_experience_reuse_outcome_deliberation_projections/,
);
assert.match(
  formalDeliberationSource,
  /counterfactualLinkedExperienceReuseOutcomeDeliberationResolver/,
);
assert.match(brokerSource, /worldSimulationFormalImpasseDecisionKinds\.PHASE81O/);
assert.match(
  loopSource,
  /assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationProjection/,
);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_deliberation_projections:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeDeliberationProjections\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_deliberation_projections:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_deliberation_projections \?\? null/,
);
const phase81NPrepareIndex = formalSource.indexOf("const linkedExperienceReuseOutcomeReentry =");
const phase81OPrepareIndex = formalSource.indexOf("const reuseOutcomeDeliberationResolverView =");
const actionDecisionIndex = formalSource.indexOf("decisionInputs.push({", phase81OPrepareIndex);
assert.ok(phase81NPrepareIndex >= 0);
assert.ok(phase81OPrepareIndex > phase81NPrepareIndex);
assert.ok(actionDecisionIndex > phase81OPrepareIndex);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81O",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeDeliberationVersion,
  exact_phase81n_lineage_required: true,
  action_defining_exact_current_support_required: true,
  changed_context_difference_handling_required: true,
  empty_decision_set_means_no_reuse: true,
  authority_field_forgery_rejected: true,
  rehashed_phase81o_lineage_forgery_rejected: true,
  two_subjective_outcome_sources_preserved: true,
  prior_outcomes_compared_for_effectiveness: false,
  reuse_effectiveness_inferred: false,
  direct_action_selection_authority: false,
  formal_same_snapshot_replay_wired: true,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81O retained reuse-outcome deliberative reuse tests passed.");
