import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAnalogicalExperienceRetentionReentryVersion,
} from "../../server/src/world-simulation-analogical-experience-retention-reentry-service.mjs";
import {
  buildWorldSimulationAnalogicalExperienceRetentionReuseContract,
  buildWorldSimulationAnalogicalExperienceRetentionReuseResolverView,
  projectWorldSimulationAnalogicalExperienceRetentionReuse,
  worldSimulationAnalogicalExperienceRetentionReuseVersion,
} from "../../server/src/world-simulation-analogical-experience-retention-reuse-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  buildWorldSimulationFormalImpasseStoredSubmission,
  worldSimulationFormalImpasseDecisionKinds,
} from "../../server/src/world-simulation-formal-experiential-deliberation-service.mjs";
import {
  createEphemeralWorldSimulationPreparedTurnBroker,
} from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";

const character = "千夜";
const currentTurnId = "turn_phase80h_current";
const methodSkeleton = {
  relation: "approach_with_cover",
  method_ref: "method_skeleton_phase80h",
  qualifiers: ["protect_ally"],
};
const methodSkeletonHash = hashAgentRunValue(methodSkeleton);

function clone(value) {
  return structuredClone(value);
}

function makePhase80G({ changed = true } = {}) {
  const exactMatches = [{
    retained_cue_ref: "phase80g_retained_cue_shared",
    current_cue_ref: "phase79e_current_cue_shared",
    cue_kind: "perception",
    cue_content_hash: hashAgentRunValue({
      cue_kind: "perception",
      content: { threat: "narrow_corridor" },
    }),
    exact_kind_and_content_match: true,
  }];
  const unmatchedRetained = changed
    ? [{
      retained_cue_ref: "phase80g_retained_cue_old_cover",
      cue_kind: "working_context",
      content: { cover: "stone_wall" },
      cue_content_hash: hashAgentRunValue({
        cue_kind: "working_context",
        content: { cover: "stone_wall" },
      }),
      prior_adaptation_role: "retained_alignment",
    }]
    : [];
  const currentAdditional = changed
    ? [{
      current_cue_ref: "phase79e_current_cue_injured_ally",
      cue_kind: "attention",
      content: { focus: "injured_ally" },
      cue_content_hash: hashAgentRunValue({
        cue_kind: "attention",
        content: { focus: "injured_ally" },
      }),
    }]
    : [];
  const identity = {
    version: worldSimulationAnalogicalExperienceRetentionReentryVersion,
    current_impasse_ref: "phase79d_impasse_phase80h",
    current_corresponding_method_ref: "phase76e_transfer_phase80h",
    current_corresponding_method_skeleton_hash: methodSkeletonHash,
    source_turn_id: "turn_phase80h_history",
    source_revision_to: 5,
    source_phase80f_projection_hash: "phase80f_projection_hash_phase80h",
    source_phase80f_capsule_ref: "phase80f_capsule_phase80h",
    source_phase80f_capsule_hash: "phase80f_capsule_hash_phase80h",
    source_phase80e_evidence_ref: "phase80e_evidence_phase80h",
    source_phase80e_evidence_hash: "phase80e_evidence_hash_phase80h",
    source_phase80c_projection_hash: "phase80c_projection_hash_phase80h",
    source_phase80a_projection_hash: "phase80a_projection_hash_phase80h",
    source_phase80b_adaptation_hash: "phase80b_adaptation_hash_phase80h",
    historical_analogy_candidate_ref: "phase80a_candidate_phase80h",
    historical_current_impasse_ref: "phase79d_impasse_history_phase80h",
    historical_corresponding_method_ref: "phase76e_transfer_history_phase80h",
    retained_method_skeleton: clone(methodSkeleton),
    retained_method_skeleton_hash: methodSkeletonHash,
    historical_method_outcome_assessment: "supports_prior_method",
    historical_outcome_evidence_kind: "subjective_method_outcome_evidence",
    exact_current_cue_matches: exactMatches,
    unmatched_retained_context_cues: unmatchedRetained,
    current_additional_context_cues: currentAdditional,
  };
  const candidateHash = hashAgentRunValue(identity);
  const candidate = {
    reentry_candidate_ref: `phase80g_reentry_${candidateHash.slice(0, 24)}`,
    reentry_candidate_hash: candidateHash,
    ...identity,
    exact_current_cue_match_count: exactMatches.length,
    unmatched_retained_context_cue_count: unmatchedRetained.length,
    current_additional_context_cue_count: currentAdditional.length,
    exact_method_skeleton_identity: true,
    current_context_cue_overlap_present: true,
    current_context_difference_present: changed,
    prior_subjective_outcome_is_candidate_evidence_only: true,
    prior_subjective_outcome_is_current_world_truth: false,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    automatic_preference_selected: false,
    action_selection_performed: false,
    semantic_method_revision_performed: false,
    world_truth_authority: false,
  };
  const projection = {
    version: worldSimulationAnalogicalExperienceRetentionReentryVersion,
    world_simulation_session_id: "session_phase80h",
    character,
    current_turn_id: currentTurnId,
    current_state_revision: 8,
    current_world_state_hash: "world_state_hash_phase80h",
    source_phase79d_impasse_hash: "phase79d_hash_phase80h",
    source_phase79e_evidence_hash: "phase79e_hash_phase80h",
    retained_projection_count_scanned: 1,
    same_character_retention_capsule_count_scanned: 1,
    reentry_candidate_count: 1,
    reentry_candidates: [candidate],
    history_window: {
      total_prior_committed_turn_count: 1,
      scanned_turn_count: 1,
      maximum_history_turns_scanned: 64,
      truncated: false,
      technical_bound_only: true,
      recency_is_not_confidence_or_utility: true,
    },
    audit: {
      prior_subjective_outcome_treated_as_candidate_evidence_only: true,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return projection;
}

const contract = buildWorldSimulationAnalogicalExperienceRetentionReuseContract();
assert.equal(contract.phase, "Phase80H");
assert.equal(contract.source_owner, "Phase80G");
assert.equal(contract.explicit_character_brain_reuse_decision_required, true);
assert.equal(contract.historical_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.method_rewrite_allowed, false);
assert.equal(contract.preference_selection_allowed, false);
assert.equal(contract.action_selection_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.further_current_context_revalidation_required, true);

const phase80G = makePhase80G();
const view = buildWorldSimulationAnalogicalExperienceRetentionReuseResolverView({
  source_phase80g_projection: phase80G,
});
assert.equal(view.version, worldSimulationAnalogicalExperienceRetentionReuseVersion);
assert.equal(view.retained_analogy_candidates.length, 1);
assert.equal(view.retained_analogy_candidates[0].prior_subjective_outcome_is_current_world_truth, false);
assert.equal(view.response_contract.direct_method_rewrite_allowed, false);
assert.equal(view.response_contract.direct_action_selection_allowed, false);

const candidate = view.retained_analogy_candidates[0];
const decision = {
  reentry_candidate_ref: candidate.reentry_candidate_ref,
  retain_matched_current_cue_refs: [
    candidate.exact_current_cue_matches[0].current_cue_ref,
  ],
  drop_unmatched_retained_cue_refs: [
    candidate.unmatched_retained_context_cues[0].retained_cue_ref,
  ],
  incorporate_current_additional_cue_refs: [
    candidate.current_additional_context_cues[0].current_cue_ref,
  ],
};
const projection = projectWorldSimulationAnalogicalExperienceRetentionReuse({
  source_phase80g_projection: phase80G,
  resolver_view: view,
  reuse_decisions: [decision],
});
assert.equal(projection.reuse_intent_count, 1);
assert.equal(projection.reuse_intents[0].historical_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(projection.reuse_intents[0].comparative_superiority_inferred, false);
assert.equal(projection.reuse_intents[0].causal_credit_assigned, false);
assert.equal(projection.reuse_intents[0].method_rewritten, false);
assert.equal(projection.reuse_intents[0].preference_selected, false);
assert.equal(projection.reuse_intents[0].action_selected, false);
assert.equal(projection.character_view.advisory_only, true);
assert.equal(projection.audit.further_current_context_revalidation_required, true);

assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReuse({
    source_phase80g_projection: phase80G,
    resolver_view: view,
    reuse_decisions: [{
      ...decision,
      action_id: "forbidden",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReuse({
    source_phase80g_projection: phase80G,
    resolver_view: view,
    reuse_decisions: [{
      ...decision,
      retain_matched_current_cue_refs: ["not-in-view"],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_OUT_OF_VIEW",
);
const missingRequiredArrayDecision = clone(decision);
delete missingRequiredArrayDecision.retain_matched_current_cue_refs;
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReuse({
    source_phase80g_projection: phase80G,
    resolver_view: view,
    reuse_decisions: [missingRequiredArrayDecision],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DECISION_INVALID",
);
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReuse({
    source_phase80g_projection: phase80G,
    resolver_view: view,
    reuse_decisions: [{
      ...decision,
      drop_unmatched_retained_cue_refs: [],
      incorporate_current_additional_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_DIFFERENCE_UNADDRESSED",
);

const exactPhase80G = makePhase80G({ changed: false });
const exactView = buildWorldSimulationAnalogicalExperienceRetentionReuseResolverView({
  source_phase80g_projection: exactPhase80G,
});
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReuse({
    source_phase80g_projection: exactPhase80G,
    resolver_view: exactView,
    reuse_decisions: [{
      reentry_candidate_ref: exactView.retained_analogy_candidates[0].reentry_candidate_ref,
      retain_matched_current_cue_refs: [],
      drop_unmatched_retained_cue_refs: [],
      incorporate_current_additional_cue_refs: [],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REUSE_SUPPORT_REQUIRED",
);

// Formal Character Brain routing owns the reuse choice; replay is bound to the
// exact Phase80H resolver view and still feeds the sealed Phase80H projector.
let round = buildWorldSimulationFormalImpasseDeliberationRound({
  prepared_turn: {
    analogical_experience_retention_reuse_resolver_views: [view],
  },
  prior_submissions: [],
});
assert.equal(
  round.decision_round_kind,
  worldSimulationFormalImpasseDecisionKinds.PHASE80H,
);
assert.equal(
  round.decision_inputs[0].character_input.experiential_deliberation.response_contract.output_field,
  "reuse_decisions",
);
assert.throws(
  () => buildWorldSimulationFormalImpasseStoredSubmission({
    resolver_binding: round.decision_inputs[0].resolver_binding,
    character_input: round.decision_inputs[0].character_input,
    deliberation_response: { reuse_decisions: [missingRequiredArrayDecision] },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
);
const stored = buildWorldSimulationFormalImpasseStoredSubmission({
  resolver_binding: round.decision_inputs[0].resolver_binding,
  character_input: round.decision_inputs[0].character_input,
  deliberation_response: { reuse_decisions: [decision] },
});
const replay = buildWorldSimulationFormalImpasseResolverReplay([stored]);
const replayed = await replay.analogicalExperienceRetentionReuseResolver(view);
assert.deepEqual(replayed, [decision]);
const replayedProjection = projectWorldSimulationAnalogicalExperienceRetentionReuse({
  source_phase80g_projection: phase80G,
  resolver_view: view,
  reuse_decisions: replayed,
});
assert.equal(replayedProjection.reuse_intent_count, 1);

// The broker must accept Phase80H as deliberation, never as action selection.
const broker = createEphemeralWorldSimulationPreparedTurnBroker();
const receipt = broker.store({
  world_simulation_session_id: "session_phase80h",
  state_revision: 8,
  world_state_hash: "world_state_hash_phase80h",
  prepared_turn: {
    world_simulation_session_id: "session_phase80h",
    state_revision: 8,
    world_state_hash: "world_state_hash_phase80h",
  },
  decision_inputs: round.decision_inputs,
  decision_round_kind: round.decision_round_kind,
});
assert.throws(
  () => broker.submitDecision({
    prepared_turn_handle: receipt.prepared_turn_handle,
    decision_handle: receipt.current_decision.decision_handle,
    action_id: "forbidden",
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_ACTION_SUBMISSION_DURING_IMPASSE_DELIBERATION",
);
const submitted = broker.submitDeliberation({
  prepared_turn_handle: receipt.prepared_turn_handle,
  decision_handle: receipt.current_decision.decision_handle,
  preparer_owner_id: "phase80h-test-owner",
  deliberation_response: { reuse_decisions: [decision] },
});
assert.equal(submitted.repreparation_required, true);
assert.equal(submitted.receipt.lifecycle_status, "preparing");

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /projectWorldSimulationAnalogicalExperienceRetentionReentry/);
assert.match(loopSource, /analogicalExperienceRetentionReuseResolver/);
assert.match(loopSource, /analogical_experience_retention_reuse_resolver_views:/);
assert.match(loopSource, /analogical_experience_retention_reuse_projections:/);
assert.match(stateSource, /analogical_experience_retention_reentry_projections:/);
assert.match(stateSource, /analogical_experience_retention_reuse_projections:/);
assert.equal(
  stateSource.includes("analogical_experience_retention_reuse_resolver_views:"),
  false,
  "Phase80H resolver views must remain PreparedTurn-ephemeral.",
);

console.log("Phase80H retained adapted analogy reuse deliberation tests passed.");
