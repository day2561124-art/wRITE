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
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection,
  buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryContract,
  projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reuse-outcome-reentry-service.mjs";

const sessionId = "session_phase81n";
const character = "千夜";
const retainedTurnId = "turn_phase81n_retained";
const retainedRevision = 41;
const retainedWorldStateHash = "world_state_hash_phase81n_retained";
const currentTurnId = "turn_phase81n_current";
const currentRevision = 47;
const currentWorldStateHash = "world_state_hash_phase81n_current";

function clone(value) {
  return structuredClone(value);
}

function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}

function phase81MRetention({ capsuleCharacter = character } = {}) {
  const intent = "advance using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: retainedTurnId,
    state_revision: retainedRevision,
    world_state_hash: retainedWorldStateHash,
    character: capsuleCharacter,
    source_phase81l_evidence_ref: "phase81l_evidence_phase81n",
    source_phase81l_evidence_hash: "phase81l_evidence_hash_phase81n",
    source_phase81j_projection_hash: "phase81j_projection_hash_phase81n",
    source_phase81i_projection_hash: "phase81i_projection_hash_phase81n",
    reuse_intent_ref: "phase81j_reuse_phase81n",
    reuse_intent_hash: "phase81j_reuse_hash_phase81n",
    source_reentry_candidate_ref: "phase81i_reentry_phase81n",
    source_reentry_candidate_hash: "phase81i_reentry_hash_phase81n",
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
    source_phase81l_projection_hash: "phase81l_projection_hash_phase81n",
    source_phase81j_projection_hashes: ["phase81j_projection_hash_phase81n"],
    source_phase81i_projection_hashes: ["phase81i_projection_hash_phase81n"],
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

function worldHistory({
  retention = phase81MRetention(),
  sourceTurnId = retainedTurnId,
  sourceRevisionFrom = retainedRevision,
  sourceRevisionTo = retainedRevision + 1,
} = {}) {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: sourceTurnId,
      revision_from: sourceRevisionFrom,
      revision_to: sourceRevisionTo,
      previous_state_hash: retainedWorldStateHash,
      next_state_hash: `next_${retainedWorldStateHash}`,
      counterfactual_linked_experience_reuse_outcome_retention: retention,
    }],
  };
}

function currentSources({ actionDefiningMatch = true } = {}) {
  const candidates = [{
    action_id: "current_covered_advance",
    intent: actionDefiningMatch ? "advance using cover" : "wait and observe",
    movement: actionDefiningMatch
      ? { mode: "advance", cover: "left_wall" }
      : { mode: "hold" },
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
  return { candidates, cognition, phase74A };
}

function project({ history = worldHistory(), actionDefiningMatch = true } = {}) {
  const current = currentSources({ actionDefiningMatch });
  return projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: current.cognition,
    current_candidate_action_intents: current.candidates,
    source_phase74a_deliberation: current.phase74A,
    world_history: history,
  });
}

function rehashCandidate(candidate) {
  const identity = clone(candidate);
  for (const key of [
    "reentry_candidate_ref", "reentry_candidate_hash", "exact_current_cue_match_count",
    "action_defining_exact_match_present", "unmatched_retained_context_signature_count",
    "current_additional_candidate_cue_count", "current_context_difference_present",
    "prior_linked_case_subjective_outcome_is_candidate_evidence_only",
    "prior_reuse_subjective_outcome_is_candidate_evidence_only",
    "prior_linked_case_subjective_outcome_is_current_world_truth",
    "prior_reuse_subjective_outcome_is_current_world_truth",
    "prior_outcomes_compared_for_effectiveness", "repeated_reuse_counts_as_effectiveness_evidence",
    "historical_counterfactual_truth_evaluated",
    "historical_counterfactual_validated_by_prior_outcomes", "reuse_effectiveness_inferred",
    "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
    "automatic_preference_revision_performed", "action_selected", "belief_revision_performed",
    "semantic_revision_performed", "subjective_memory_rewrite_performed", "world_state_mutated",
    "resolver_used", "world_truth_authority",
  ]) delete identity[key];
  const hash = hashAgentRunValue(identity);
  candidate.reentry_candidate_hash = hash;
  candidate.reentry_candidate_ref = `phase81n_reentry_${hash.slice(0, 24)}`;
}

function rehashProjection(projection) {
  delete projection.projection_hash;
  projection.projection_hash = hashAgentRunValue(projection);
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryContract();
assert.equal(contract.phase, "Phase81N");
assert.equal(contract.source_retention_owner, "Phase81M");
assert.equal(contract.exact_action_defining_cue_overlap_required, true);
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);
assert.equal(contract.prior_linked_case_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.prior_reuse_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.prior_outcomes_compared_for_effectiveness, false);
assert.equal(contract.repeated_reuse_counts_as_effectiveness_evidence, false);
assert.equal(contract.reuse_effectiveness_inferred, false);
assert.equal(contract.action_selection_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const history = worldHistory();
const projection = project({ history });
assert.equal(projection.version, worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion);
assert.equal(projection.phase, "Phase81N");
assert.equal(projection.retained_projection_count_scanned, 1);
assert.equal(projection.same_character_retention_capsule_count_scanned, 1);
assert.equal(projection.reentry_candidate_count, 1);
const candidate = projection.reentry_candidates[0];
assert.equal(candidate.action_defining_exact_match_present, true);
assert.ok(candidate.exact_current_cue_match_count >= 1);
assert.deepEqual(candidate.prior_linked_case_subjective_experience, {
  action_id: "earlier_covered_advance",
  performed: true,
  perceived_result: "reached_first_cover",
  perceived_status: "stable_after_first_move",
});
assert.deepEqual(candidate.prior_reuse_action_subjective_experience, {
  action_id: "retained_covered_advance",
  performed: true,
  perceived_result: "reached_second_cover",
  perceived_status: "stable_after_reuse",
});
assert.equal(candidate.prior_outcomes_compared_for_effectiveness, false);
assert.equal(candidate.repeated_reuse_counts_as_effectiveness_evidence, false);
assert.equal(candidate.reuse_effectiveness_inferred, false);
assert.equal(candidate.action_selected, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    projection,
    {
      world_simulation_session_id: sessionId,
      character,
      current_turn_id: currentTurnId,
      current_state_revision: currentRevision,
      current_world_state_hash: currentWorldStateHash,
      world_history: history,
    },
  ));

const noActionCueMatch = project({ history, actionDefiningMatch: false });
assert.equal(noActionCueMatch.reentry_candidate_count, 0);

const otherCharacterHistory = worldHistory({
  retention: phase81MRetention({ capsuleCharacter: "另一角色" }),
});
assert.equal(project({ history: otherCharacterHistory }).reentry_candidate_count, 0);

const sameTurnHistory = worldHistory({ sourceTurnId: currentTurnId });
const sameTurnProjection = project({ history: sameTurnHistory });
assert.equal(sameTurnProjection.retained_projection_count_scanned, 0);
assert.equal(sameTurnProjection.reentry_candidate_count, 0);

// Local hash recomputation cannot rewrite either committed subjective outcome.
const forgedOutcome = clone(projection);
forgedOutcome.reentry_candidates[0].prior_reuse_action_subjective_experience.perceived_result =
  "invented_effective_result";
rehashCandidate(forgedOutcome.reentry_candidates[0]);
rehashProjection(forgedOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    forgedOutcome,
    { world_history: history },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
);

const forgedPriorOutcome = clone(projection);
forgedPriorOutcome.reentry_candidates[0].prior_linked_case_subjective_experience.perceived_result =
  "invented_prior_result";
rehashCandidate(forgedPriorOutcome.reentry_candidates[0]);
rehashProjection(forgedPriorOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryProjection(
    forgedPriorOutcome,
    { world_history: history },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_REUSE_OUTCOME_REENTRY_CANONICAL_SOURCE_MISMATCH",
);

const formalSource = await readFile(
  "server/src/world-simulation-formal-turn-transport-service.mjs",
  "utf8",
);
const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  formalSource,
  /projectWorldSimulationCounterfactualLinkedExperienceReuseOutcomeReentry/,
);
assert.match(
  formalSource,
  /counterfactual_linked_experience_reuse_outcome_reentry_projections/,
);
assert.match(
  loopSource,
  /counterfactualLinkedExperienceReuseOutcomeReentryProjections/,
);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reuse_outcome_reentry_projections:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReuseOutcomeReentryProjections\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reuse_outcome_reentry_projections:\s*\r?\n\s*input\.counterfactual_linked_experience_reuse_outcome_reentry_projections \?\? null/,
);
const phase81NPrepareIndex = formalSource.indexOf(
  "const linkedExperienceReuseOutcomeReentry =",
);
const actionDecisionIndex = formalSource.indexOf("decisionInputs.push({", phase81NPrepareIndex);
assert.ok(phase81NPrepareIndex >= 0);
assert.ok(actionDecisionIndex > phase81NPrepareIndex);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81N",
  version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeReentryVersion,
  exact_phase81m_world_turn_lineage_required: true,
  exact_phase74a_current_candidate_lineage_required: true,
  action_defining_exact_cue_overlap_required: true,
  fuzzy_similarity_used: false,
  two_subjective_outcome_sources_preserved: true,
  repeated_reuse_counts_as_effectiveness_evidence: false,
  reuse_effectiveness_inferred: false,
  rehashed_prior_outcome_forgery_rejected: true,
  rehashed_reuse_outcome_forgery_rejected: true,
  character_brain_exposure_installed: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81N retained reuse-outcome cross-turn re-entry tests passed.");
