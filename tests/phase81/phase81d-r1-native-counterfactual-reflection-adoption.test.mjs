import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  buildWorldSimulationCharacterBrainInput,
} from "../../server/src/world-simulation-character-brain-input-service.mjs";
import {
  worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
} from "../../server/src/world-simulation-effective-action-commitment-character-exposure-service.mjs";
import {
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-reflection-retention-service.mjs";
import {
  adoptWorldSimulationCounterfactualReflectionReentry,
  buildWorldSimulationCounterfactualReflectionReentryAdoptionContract,
  counterfactualReflectionReminderCharacterViewVersion,
} from "../../server/src/world-simulation-counterfactual-reflection-reentry-adoption-service.mjs";

const sessionId = "session_phase81d_r1";
const character = "千夜";
const currentTurnId = "turn_phase81d_r1_current";
const currentStateRevision = 8;
const currentWorldStateHash = "world_state_hash_phase81d_r1_current";

function clone(value) {
  return structuredClone(value);
}

function withProjectionHash(value) {
  const output = clone(value);
  output.projection_hash = hashAgentRunValue(output);
  return output;
}

function makeCapsule({
  sourceTurnId = "turn_phase81d_r1_history",
  sourceStateRevision = 5,
  sourceWorldStateHash = "world_state_hash_phase81d_r1_history",
  candidate = {
    intent: "approach using cover",
    movement: { mode: "advance", cover: "left_wall" },
    known_costs: ["slower"],
    duration_s: 3,
  },
} = {}) {
  const identity = {
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    world_simulation_session_id: sessionId,
    source_turn_id: sourceTurnId,
    source_state_revision: sourceStateRevision,
    source_world_state_hash: sourceWorldStateHash,
    character,
    source_phase81b_appraisal_ref: `phase81b_appraisal_${sourceTurnId}`,
    source_phase81b_appraisal_hash: `phase81b_appraisal_hash_${sourceTurnId}`,
    source_phase81b_projection_hash: `phase81b_projection_hash_${sourceTurnId}`,
    source_phase81b_resolver_view_hash: `phase81b_view_hash_${sourceTurnId}`,
    source_phase81a_projection_hash: `phase81a_projection_hash_${sourceTurnId}`,
    source_phase81a_resolver_view_hash: `phase81a_view_hash_${sourceTurnId}`,
    source_phase81a_evidence_ref: `phase81a_evidence_${sourceTurnId}`,
    source_phase81a_evidence_hash: `phase81a_evidence_hash_${sourceTurnId}`,
    source_phase74d_receipt_hash: `phase74d_receipt_hash_${sourceTurnId}`,
    source_phase76a_subjective_perception_ref: `phase76a_perception_${sourceTurnId}`,
    actual_experienced_anchor: {
      selected_action_ref: `phase74a_action_actual_${sourceTurnId}`,
      selected_action_id: "direct_advance",
      subjective_perception_ref: `phase76a_perception_${sourceTurnId}`,
      subjective_experience: {
        performed: { intent: "direct advance" },
        perceived_result: { obstruction: "heavy" },
        perceived_status: "difficult",
      },
      source_kind: "experienced_subjective_outcome",
      world_truth_authority: false,
    },
    imagined_alternative_context: {
      alternative_action_ref: `phase74a_action_alt_${sourceTurnId}`,
      alternative_action_id: "covered_advance",
      decision_time_candidate: clone(candidate),
      salient_branches: [],
      salient_branch_refs: [],
      source_kind: "imagined_decision_time_possibility",
      alternative_available_at_decision_time: true,
      alternative_was_selected: false,
      alternative_outcome_observed: false,
      branches_are_subjective_possibilities_not_predictions: true,
    },
    comparison_direction: "imagined_better_than_actual",
    appraisal_kind: "regret_like_counterfactual_concern",
    preparative_orientation: "future_improvement_candidate",
    source_monitoring: {
      actual_anchor_source: "experienced_subjective_outcome",
      alternative_source: "imagined_decision_time_possibility",
      appraisal_source: "subjective_counterfactual_reflection",
      sources_may_not_be_collapsed: true,
    },
  };
  const capsuleHash = hashAgentRunValue(identity);
  return {
    capsule_ref: `phase81c_reflection_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    counterfactual_capsule_is_episodic_fact_memory: false,
    unchosen_outcome_observed: false,
    counterfactual_world_truth_claimed: false,
    causal_superiority_inferred: false,
    automatic_preference_revision_performed: false,
    action_selected: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_state_mutated: false,
    same_turn_reentry_allowed: false,
  };
}

function makeRetentionProjection() {
  const capsule = makeCapsule();
  return withProjectionHash({
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    phase: "Phase81C",
    world_simulation_session_id: sessionId,
    turn_id: capsule.source_turn_id,
    state_revision: capsule.source_state_revision,
    world_state_hash: capsule.source_world_state_hash,
    source_phase81b_projection_hash: capsule.source_phase81b_projection_hash,
    source_phase81b_resolver_view_hash: capsule.source_phase81b_resolver_view_hash,
    source_phase81a_projection_hash: capsule.source_phase81a_projection_hash,
    source_phase81a_resolver_view_hash: capsule.source_phase81a_resolver_view_hash,
    capsule_count: 1,
    capsules: [capsule],
    audit: {
      exact_phase81a_phase81b_lineage_verified: true,
      actual_and_imagined_sources_explicitly_separated: true,
      actual_subjective_experience_retained_as_experienced_anchor: true,
      only_phase81b_salient_branch_metadata_retained: true,
      alternative_candidate_context_retained_for_future_cue_matching: true,
      preparative_orientation_retained_as_candidate_not_policy: true,
      counterfactual_capsules_are_episodic_fact_memories: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      numeric_emotion_utility_reward_q_value_probability_modeled: false,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      failed_or_blocked_turn_persists_capsules: false,
      projection_does_not_mutate_world_state: true,
      future_reentry_requires_separate_projection: true,
    },
  });
}

function makeHistory() {
  const projection = makeRetentionProjection();
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: [{
      turn_id: projection.turn_id,
      revision_from: projection.state_revision,
      revision_to: projection.state_revision + 1,
      previous_state_hash: projection.world_state_hash,
      next_state_hash: `next_${projection.world_state_hash}`,
      post_outcome_counterfactual_reflection_retention: projection,
    }],
  };
}

function makePacket() {
  return {
    character,
    perception: {},
    recovered_memories: [],
    retrieval_experience: {
      process_occurred: false,
      initiation_mode: null,
      target_outcome: null,
      recovered_any_content: false,
    },
    cognition: {
      goals: [{ summary: "reach ally" }],
      decision_pressures: [{ kind: "protective" }],
      working_context: { focus: "safe approach" },
    },
    candidate_action_intents: [{
      action_id: "current_covered_advance",
      intent: "approach using cover",
      movement: { mode: "advance", cover: "left_wall" },
      known_costs: ["more_energy"],
      duration_s: 4,
      target: { label: "doorway" },
    }],
    boundaries: {},
  };
}

const contract = buildWorldSimulationCounterfactualReflectionReentryAdoptionContract();
assert.equal(contract.phase, "Phase81D-R1");
assert.equal(contract.final_character_brain_phase74a_required, true);
assert.equal(contract.action_proposer_candidates_must_preexist, true);
assert.equal(contract.reentry_does_not_generate_action_candidates, true);
assert.equal(contract.reentry_does_not_mutate_base_cognition, true);
assert.equal(contract.engine_projection_character_facing, false);
assert.equal(contract.engine_session_turn_revision_hash_ref_metadata_exposed, false);
assert.equal(contract.automatic_action_selection_allowed, false);

const characterInput = buildWorldSimulationCharacterBrainInput(makePacket(), {
  effective_action_commitment_character_exposure: {
    version: worldSimulationEffectiveActionCommitmentCharacterExposureVersion,
    character,
    status: "no_active_commitment",
    active_commitment: null,
    has_active_commitment: false,
    explicit_reject_all_cleared_prior_commitment: false,
    deliberation_boundary: {
      advisory_only: true,
      selected_action_authority: false,
    },
  },
});
const baseCognitionBeforeAdoption = clone(characterInput.cognition);
const finalPhase74AHash = characterInput.subjective_action_deliberation.deliberation_view_hash;

const adoption = adoptWorldSimulationCounterfactualReflectionReentry({
  world_simulation_session_id: sessionId,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  world_history: makeHistory(),
  character_input: characterInput,
});

assert.equal(adoption.phase, "Phase81D-R1");
assert.equal(adoption.projection.reentry_candidate_count, 1);
assert.equal(adoption.projection.source_phase74a_deliberation_view_hash, finalPhase74AHash);
assert.deepEqual(characterInput.cognition, baseCognitionBeforeAdoption);
assert.equal(adoption.character_view.version, counterfactualReflectionReminderCharacterViewVersion);
assert.equal(adoption.character_view.reminder_count, 1);
const reminder = adoption.character_view.reminders[0];
assert.equal(reminder.current_action_id, "current_covered_advance");
assert.equal(reminder.historical_actual_selected_action_id, "direct_advance");
assert.equal(reminder.historical_imagined_alternative_action_id, "covered_advance");
assert.equal(reminder.historical_comparison_direction, "imagined_better_than_actual");
assert.equal(reminder.historical_appraisal_kind, "regret_like_counterfactual_concern");
assert.equal(reminder.historical_preparative_orientation, "future_improvement_candidate");
assert.ok(reminder.matched_cue_kinds.includes("action_candidate.intent"));
assert.ok(reminder.matched_cue_kinds.includes("action_candidate.movement"));
assert.equal(reminder.current_context_difference_present, true);
assert.equal(reminder.historical_counterfactual_is_candidate_evidence_only, true);
assert.equal(reminder.historical_counterfactual_is_episodic_fact_memory, false);
assert.equal(reminder.historical_alternative_was_experienced, false);
assert.equal(reminder.historical_unchosen_outcome_observed, false);
assert.equal(reminder.counterfactual_world_truth_claimed, false);
assert.equal(reminder.source_monitoring.sources_may_not_be_collapsed, true);
assert.equal(adoption.character_view.advisory_only, true);
assert.equal(adoption.character_view.action_selection_authority, false);
assert.equal(adoption.character_view.preference_revision_authority, false);
assert.equal(adoption.character_view.belief_revision_authority, false);
assert.equal(adoption.character_view.semantic_revision_authority, false);
assert.equal(adoption.character_view.world_truth_authority, false);

const characterFacingText = JSON.stringify(adoption.character_view);
for (const forbidden of [
  sessionId,
  currentTurnId,
  "world_state_hash",
  "projection_hash",
  "source_phase81",
  "capsule_ref",
  "capsule_hash",
  "source_turn_id",
  "reentry_candidate_ref",
  "current_action_ref",
]) {
  assert.equal(
    characterFacingText.includes(forbidden),
    false,
    `Character-facing Phase81D-R1 reminder leaked engine lineage fragment: ${forbidden}`,
  );
}
assert.notEqual(JSON.stringify(adoption.projection), characterFacingText);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const transportSource = await readFile(
  "server/src/world-simulation-formal-turn-transport-service.mjs",
  "utf8",
);
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");

assert.match(loopSource, /adoptWorldSimulationCounterfactualReflectionReentry/);
assert.match(loopSource, /brainInput\.counterfactual_reflection_reentry\s*=\s*cloneJson/);
assert.match(loopSource, /counterfactualReflectionReentryProjections/);
assert.match(loopSource, /counterfactualReflectionReentryInputProvided/);
assert.match(loopSource, /WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_REENTRY_ADOPTION_INCOMPLETE/);
assert.match(loopSource, /counterfactual_reflection_reentry_projections:/);
assert.match(loopSource, /full_engine_projection_exposed_to_character_brain:\s*false/);
assert.match(transportSource, /buildFormalActionDecisionBundle/);
assert.match(transportSource, /const characterInput = buildWorldSimulationCharacterBrainInput/);
assert.match(transportSource, /adoptWorldSimulationCounterfactualReflectionReentry/);
assert.match(transportSource, /characterInput\.counterfactual_reflection_reentry\s*=\s*cloneJson/);
assert.match(
  transportSource,
  /counterfactualReflectionReentryProjections:\s*\n\s*acquisition\.prepared_turn\.counterfactual_reflection_reentry_projections \?\? \[\]/,
);
assert.match(
  transportSource,
  /same-snapshot Phase81D\/81E[\s\S]*rather than recomputing cognition after[\s\S]*action submission/,
);
assert.match(
  stateSource,
  /counterfactual_reflection_reentry_projections:\s*\r?\n\s*input\.counterfactual_reflection_reentry_projections \?\? null/,
);

console.log("Phase81D-R1 native counterfactual reflection adoption tests passed.");
