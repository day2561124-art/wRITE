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
  assertWorldSimulationCounterfactualLinkedExperienceReentryProjection,
  buildWorldSimulationCounterfactualLinkedExperienceReentryContract,
  projectWorldSimulationCounterfactualLinkedExperienceReentry,
  worldSimulationCounterfactualLinkedExperienceReentryVersion,
} from "../../server/src/world-simulation-counterfactual-linked-experience-reentry-service.mjs";

const sessionId = "session_phase81i";
const character = "千夜";
const historicalTurnId = "turn_phase81i_history";
const historicalRevision = 12;
const historicalWorldStateHash = "world_state_hash_phase81i_history";
const currentTurnId = "turn_phase81i_current";
const currentRevision = 18;
const currentWorldStateHash = "world_state_hash_phase81i_current";

function clone(value) {
  return structuredClone(value);
}

function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: clone(content) });
}

function retainedProjection({ retainedCharacter = character } = {}) {
  const intent = "approach using cover";
  const movement = { mode: "advance", cover: "left_wall" };
  const identity = {
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: historicalTurnId,
    state_revision: historicalRevision,
    world_state_hash: historicalWorldStateHash,
    character: retainedCharacter,
    source_phase81g_evidence_ref: "phase81g_evidence_history",
    source_phase81g_evidence_hash: "phase81g_evidence_hash_history",
    source_phase81e_projection_hash: "phase81e_projection_hash_history",
    source_phase81e_judgment_ref: "phase81e_judgment_history",
    source_phase81e_judgment_hash: "phase81e_judgment_hash_history",
    source_phase81d_projection_hash: "phase81d_projection_hash_history",
    source_phase81d_reentry_candidate_ref: "phase81d_reentry_history",
    source_phase81d_reentry_candidate_hash: "phase81d_reentry_hash_history",
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
    source_phase81g_projection_hash: "phase81g_projection_hash_history",
    source_phase81e_projection_hashes: ["phase81e_projection_hash_history"],
    source_phase81d_projection_hashes: ["phase81d_projection_hash_history"],
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

function currentInput(candidateOverride = {}) {
  const candidates = [
    {
      action_id: "current_covered_advance",
      intent: "approach using cover",
      movement: { mode: "advance", cover: "left_wall" },
      known_costs: ["more_energy"],
      duration_s: 4,
      ...candidateOverride,
    },
    {
      action_id: "hold_position",
      intent: "hold position",
      defense: { mode: "brace" },
    },
  ];
  const cognition = {
    goals: [{ summary: "reach ally" }],
    working_context: { focus: "safe approach" },
  };
  const phase74A = buildWorldSimulationSubjectiveActionDeliberationView({
    character,
    cognition,
    candidate_action_intents: candidates,
  });
  return { candidates, cognition, phase74A };
}

function historyFor(retention = retainedProjection(), historyTurnId = historicalTurnId) {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: historyTurnId,
      revision_from: historicalRevision,
      revision_to: historicalRevision + 1,
      previous_state_hash: historicalWorldStateHash,
      next_state_hash: `next_${historicalWorldStateHash}`,
      counterfactual_linked_experience_retention: retention,
    }],
  };
}

function project({ retention = retainedProjection(), candidateOverride = {}, historyTurnId = historicalTurnId } = {}) {
  const current = currentInput(candidateOverride);
  return projectWorldSimulationCounterfactualLinkedExperienceReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    current_cognition: current.cognition,
    current_candidate_action_intents: current.candidates,
    source_phase74a_deliberation: current.phase74A,
    world_history: historyFor(retention, historyTurnId),
  });
}

const contract = buildWorldSimulationCounterfactualLinkedExperienceReentryContract();
assert.equal(contract.phase, "Phase81I");
assert.equal(contract.source_retention_owner, "Phase81H");
assert.equal(contract.current_candidate_owner, "Phase74A_existing_world_action_proposer_candidates");
assert.equal(contract.exact_action_defining_cue_overlap_required, true);
assert.equal(contract.fuzzy_semantic_similarity_modeled, false);
assert.equal(contract.advisory_effectiveness_inferred, false);
assert.equal(contract.action_selection_performed, false);

const projection = project();
assert.equal(projection.version, worldSimulationCounterfactualLinkedExperienceReentryVersion);
assert.equal(projection.phase, "Phase81I");
assert.equal(projection.reentry_candidate_count, 1);
const candidate = projection.reentry_candidates[0];
assert.equal(candidate.current_action_id, "current_covered_advance");
assert.equal(candidate.historical_linked_action_id, "historical_covered_advance");
assert.equal(candidate.action_defining_exact_match_present, true);
assert.ok(candidate.exact_current_cue_matches.some((match) => match.action_defining));
assert.deepEqual(candidate.prior_selected_action_subjective_experience, {
  action_id: "historical_covered_advance",
  performed: true,
  perceived_result: "reached_cover",
  perceived_status: "stable_after_move",
});
assert.equal(candidate.prior_linked_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(candidate.prior_linked_subjective_outcome_is_current_world_truth, false);
assert.equal(candidate.historical_counterfactual_truth_evaluated, false);
assert.equal(candidate.historical_counterfactual_validated_by_prior_outcome, false);
assert.equal(candidate.advisory_effectiveness_inferred, false);
assert.equal(candidate.success_failure_interpretation_performed, false);
assert.equal(candidate.causal_credit_assigned, false);
assert.equal(candidate.automatic_preference_revision_performed, false);
assert.equal(candidate.action_selected, false);
assert.equal(candidate.world_truth_authority, false);
assert.doesNotThrow(() =>
  assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(projection, {
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentRevision,
    current_world_state_hash: currentWorldStateHash,
    world_history: historyFor(retainedProjection()),
  }));

const noExactActionCue = project({
  candidateOverride: {
    intent: "rush directly",
    movement: { mode: "sprint", cover: "none" },
  },
});
assert.equal(noExactActionCue.reentry_candidate_count, 0);

const otherCharacterRetention = retainedProjection({ retainedCharacter: "另一人" });
assert.equal(project({ retention: otherCharacterRetention }).reentry_candidate_count, 0);

const sameTurnIgnored = project({ historyTurnId: currentTurnId });
assert.equal(sameTurnIgnored.reentry_candidate_count, 0);

const forgedAuthority = clone(projection);
forgedAuthority.reentry_candidates[0].advisory_effectiveness_inferred = true;
const forgedIdentity = clone(forgedAuthority.reentry_candidates[0]);
for (const key of [
  "reentry_candidate_ref", "reentry_candidate_hash", "exact_current_cue_match_count",
  "action_defining_exact_match_present", "unmatched_retained_context_signature_count",
  "current_additional_candidate_cue_count", "current_context_difference_present",
  "prior_linked_subjective_outcome_is_candidate_evidence_only",
  "prior_linked_subjective_outcome_is_current_world_truth",
  "historical_counterfactual_is_episodic_fact_memory",
  "historical_imagined_alternative_was_experienced", "historical_unchosen_outcome_observed",
  "historical_counterfactual_truth_evaluated", "historical_counterfactual_validated_by_prior_outcome",
  "advisory_effectiveness_inferred", "success_failure_interpretation_performed",
  "causal_credit_assigned", "automatic_preference_revision_performed", "action_selected",
  "belief_revision_performed", "semantic_revision_performed", "subjective_memory_rewrite_performed",
  "world_state_mutated", "resolver_used", "world_truth_authority",
]) delete forgedIdentity[key];
const forgedHash = hashAgentRunValue(forgedIdentity);
forgedAuthority.reentry_candidates[0].reentry_candidate_hash = forgedHash;
forgedAuthority.reentry_candidates[0].reentry_candidate_ref = `phase81i_reentry_${forgedHash.slice(0, 24)}`;
delete forgedAuthority.projection_hash;
forgedAuthority.projection_hash = hashAgentRunValue(forgedAuthority);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(forgedAuthority),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REENTRY_CANDIDATE_INVALID",
);

const forgedHistoricalOutcome = clone(projection);
forgedHistoricalOutcome.reentry_candidates[0]
  .prior_selected_action_subjective_experience.perceived_result = "invented_outcome";
const forgedHistoricalIdentity = clone(forgedHistoricalOutcome.reentry_candidates[0]);
for (const key of [
  "reentry_candidate_ref", "reentry_candidate_hash", "exact_current_cue_match_count",
  "action_defining_exact_match_present", "unmatched_retained_context_signature_count",
  "current_additional_candidate_cue_count", "current_context_difference_present",
  "prior_linked_subjective_outcome_is_candidate_evidence_only",
  "prior_linked_subjective_outcome_is_current_world_truth",
  "historical_counterfactual_is_episodic_fact_memory",
  "historical_imagined_alternative_was_experienced", "historical_unchosen_outcome_observed",
  "historical_counterfactual_truth_evaluated", "historical_counterfactual_validated_by_prior_outcome",
  "advisory_effectiveness_inferred", "success_failure_interpretation_performed",
  "causal_credit_assigned", "automatic_preference_revision_performed", "action_selected",
  "belief_revision_performed", "semantic_revision_performed", "subjective_memory_rewrite_performed",
  "world_state_mutated", "resolver_used", "world_truth_authority",
]) delete forgedHistoricalIdentity[key];
const forgedHistoricalHash = hashAgentRunValue(forgedHistoricalIdentity);
forgedHistoricalOutcome.reentry_candidates[0].reentry_candidate_hash = forgedHistoricalHash;
forgedHistoricalOutcome.reentry_candidates[0].reentry_candidate_ref =
  `phase81i_reentry_${forgedHistoricalHash.slice(0, 24)}`;
delete forgedHistoricalOutcome.projection_hash;
forgedHistoricalOutcome.projection_hash = hashAgentRunValue(forgedHistoricalOutcome);
assert.throws(
  () => assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(
    forgedHistoricalOutcome,
    { world_history: historyFor(retainedProjection()) },
  ),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REENTRY_CANONICAL_SOURCE_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const formalSource = await readFile("server/src/world-simulation-formal-turn-transport-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
const runStart = loopSource.indexOf("export async function runWorldSimulationTurn(");
const runSource = loopSource.slice(runStart);
const phase81IIndex = runSource.indexOf("const counterfactualLinkedExperienceReentry =");
const brainSelectionIndex = runSource.indexOf("runCharacterTurn(");
assert.ok(runStart >= 0);
assert.ok(phase81IIndex >= 0);
assert.ok(brainSelectionIndex > phase81IIndex);
assert.equal(runSource.includes("brainInput.counterfactual_linked_experience_reentry"), false);
assert.match(
  formalSource,
  /counterfactual_linked_experience_reentry_projections:\s*\n\s*cloneJson\(actionBundle\.counterfactual_linked_experience_reentry_projections\)/,
);
assert.equal(formalSource.includes("characterInput.counterfactual_linked_experience_reentry"), false);
assert.match(
  loopSource,
  /counterfactual_linked_experience_reentry_projections:\s*\r?\n\s*cloneJson\(counterfactualLinkedExperienceReentryProjections\)/,
);
assert.match(
  stateSource,
  /counterfactual_linked_experience_reentry_projections:\s*\r?\n\s*input\.counterfactual_linked_experience_reentry_projections \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase81I",
  version: worldSimulationCounterfactualLinkedExperienceReentryVersion,
  exact_phase81h_world_turn_lineage_required: true,
  exact_phase74a_current_candidate_lineage_required: true,
  action_defining_exact_cue_overlap_required: true,
  fuzzy_similarity_used: false,
  prior_subjective_outcome_candidate_evidence_only: true,
  advisory_effectiveness_inferred: false,
  character_brain_exposure_installed: false,
  successful_commit_persistence_wired: true,
}));
console.log("Phase81I retained counterfactual-linked experience re-entry tests passed.");
