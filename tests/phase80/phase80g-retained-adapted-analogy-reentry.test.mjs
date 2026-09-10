import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDeliberationVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
} from "../../server/src/world-simulation-analogical-experience-retention-capsule-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceRetentionReentryProjection,
  buildWorldSimulationAnalogicalExperienceRetentionReentryContract,
  projectWorldSimulationAnalogicalExperienceRetentionReentry,
  worldSimulationAnalogicalExperienceRetentionReentryVersion,
} from "../../server/src/world-simulation-analogical-experience-retention-reentry-service.mjs";

const sessionId = "session_phase80g";
const character = "千夜";
const currentTurnId = "turn_phase80g_current";
const currentStateRevision = 8;
const currentWorldStateHash = "world_state_hash_phase80g_current";
const impasseRef = "phase79d_impasse_phase80g_current";
const methodRef = "phase76e_transfer_phase80g_current";
const methodSkeleton = {
  relation: "approach_with_cover",
  method_ref: "method_skeleton_phase80g",
  qualifiers: ["protect_ally"],
};

function hashed(value, field) {
  const result = structuredClone(value);
  result[field] = hashAgentRunValue(result);
  return result;
}

function makePhase79D() {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase79b_resolution_hash: "phase79b_hash_phase80g",
    source_phase79c_guidance_hash: "phase79c_hash_phase80g",
    impasse_contexts: [{
      impasse_ref: impasseRef,
      character,
      current_turn_id: currentTurnId,
      source_resolution_ref: "phase79b_resolution_phase80g",
      impasse_type: "tie_impasse",
      retained_method_refs: [methodRef],
      unresolved_competition_refs: ["competition_phase80g"],
      cyclic_preference_detected: false,
      candidate_methods: [{
        transfer_ref: methodRef,
        method_skeleton: structuredClone(methodSkeleton),
        source_knowledge_status: "supported",
        mapping_kind: "experiential_method",
        current_context_basis: [],
        current_context_grounded: true,
        advisory_only: true,
      }],
      deliberation_contract: {
        seek_additional_discriminating_current_context_evidence: true,
        preserve_all_retained_methods_until_resolved: true,
        qualitative_resolution_only: true,
        new_preference_may_be_authored_here: false,
        action_selection_may_be_authored_here: false,
        semantic_revision_may_be_authored_here: false,
        arbitrary_tie_breaking_allowed: false,
      },
    }],
    impasse_count: 1,
    deliberation_required: true,
    audit: {
      exact_phase79b_source_verified: true,
      exact_phase79c_source_verified: true,
    },
  }, "impasse_hash");
}

function makeCue(cueRef, cueKind, content) {
  return {
    cue_ref: cueRef,
    cue_kind: cueKind,
    content: structuredClone(content),
    current_turn_only: true,
    character_visible_context_only: true,
    world_truth_authority: false,
  };
}

function makePhase79E(phase79D, cues = [
  makeCue("phase79e_cue_shared", "perception", { threat: "narrow_corridor" }),
  makeCue("phase79e_cue_new", "attention", { focus: "injured_ally" }),
]) {
  return hashed({
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    character,
    current_turn_id: currentTurnId,
    source_phase79d_impasse_hash: phase79D.impasse_hash,
    impasse_evidence_contexts: [{
      impasse_ref: impasseRef,
      impasse_type: "tie_impasse",
      retained_method_refs: [methodRef],
      candidate_methods: structuredClone(phase79D.impasse_contexts[0].candidate_methods),
      unresolved_competition_refs: ["competition_phase80g"],
      current_context_cue_catalog: cues,
      evidence_selection_contract: {
        select_only_from_current_context_cue_catalog: true,
        evidence_must_discriminate_retained_methods_downstream: true,
        no_evidence_may_preserve_impasse: true,
        preference_may_be_authored_here: false,
        action_selection_may_be_authored_here: false,
        semantic_revision_may_be_authored_here: false,
      },
    }],
    impasse_count: 1,
    cue_count: cues.length,
    deliberation_evidence_available: cues.length > 0,
    audit: {
      exact_phase79d_source_verified: true,
      current_character_visible_context_only: true,
    },
  }, "evidence_hash");
}

function retainedCue(cueKind, content, adaptationRole) {
  return {
    cue_kind: cueKind,
    content: structuredClone(content),
    adaptation_role: adaptationRole,
    cue_content_hash: hashAgentRunValue({ cue_kind: cueKind, content }),
  };
}

function makeRetentionProjection({
  turnId = "turn_phase80g_history",
  stateRevision = 5,
  worldStateHash = "world_state_hash_phase80g_history",
  capsuleCharacter = character,
  assessment = "supports_prior_method",
  skeleton = methodSkeleton,
  cues = [
    retainedCue("perception", { threat: "narrow_corridor" }, "incorporated_difference"),
    retainedCue("working_context", { cover: "stone_wall" }, "retained_alignment"),
  ],
} = {}) {
  const identity = {
    version: worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character: capsuleCharacter,
    source_phase80e_evidence_ref: `phase80e_evidence_${turnId}`,
    source_phase80e_evidence_hash: `phase80e_hash_${turnId}`,
    source_phase80c_projection_hash: `phase80c_hash_${turnId}`,
    source_phase80a_projection_hash: `phase80a_hash_${turnId}`,
    source_phase80b_adaptation_hash: `phase80b_hash_${turnId}`,
    analogy_candidate_ref: `phase80a_analogy_${turnId}`,
    current_impasse_ref: `phase79d_impasse_${turnId}`,
    current_corresponding_method_ref: `phase76e_transfer_${turnId}`,
    method_skeleton: structuredClone(skeleton),
    source_knowledge_status: "supported",
    mapping_kind: "experiential_method",
    adapted_current_context_basis: structuredClone(cues),
    phase76f_application_receipt_id: `phase76f_application_${turnId}`,
    phase76f_application_receipt_hash: `phase76f_application_hash_${turnId}`,
    phase76g_assessment_ref: `phase76g_assessment_${turnId}`,
    phase76g_assessment_hash: `phase76g_assessment_hash_${turnId}`,
    method_outcome_assessment: assessment,
    outcome_evidence_kind: "subjective_method_outcome_evidence",
  };
  const capsuleHash = hashAgentRunValue(identity);
  const capsule = {
    capsule_ref: `phase80f_retention_${capsuleHash.slice(0, 24)}`,
    capsule_hash: capsuleHash,
    ...identity,
    subjective_outcome_not_world_truth: true,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    automatic_preference_learning_performed: false,
    semantic_method_revision_performed: false,
    same_turn_reentry_allowed: false,
  };
  return hashed({
    version: worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase80e_projection_hash: `phase80e_projection_hash_${turnId}`,
    capsule_count: 1,
    capsules: [capsule],
    audit: {},
    persistence_boundary: {},
  }, "projection_hash");
}

function makeHistory(projections = [makeRetentionProjection()]) {
  return {
    version: "phase62c-world-state-v1",
    world_simulation_session_id: sessionId,
    turns: projections.map((projection, index) => ({
      turn_id: projection.turn_id,
      revision_from: projection.state_revision,
      revision_to: projection.state_revision + 1,
      previous_state_hash: projection.world_state_hash,
      next_state_hash: `next_${projection.world_state_hash}`,
      analogical_experience_retention_capsules: [projection],
      order: index,
    })),
  };
}

const contract = buildWorldSimulationAnalogicalExperienceRetentionReentryContract();
assert.equal(contract.phase, "Phase80G");
assert.equal(contract.same_character_prior_committed_turns_only, true);
assert.equal(contract.same_turn_feedback_allowed, false);
assert.equal(contract.exact_phase80f_capsule_hash_and_lineage_required, true);
assert.equal(contract.exact_method_skeleton_identity_required, true);
assert.equal(contract.exact_cue_kind_and_content_overlap_required, true);
assert.equal(contract.retained_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(contract.automatic_preference_selection_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const phase79D = makePhase79D();
const phase79E = makePhase79E(phase79D);
const projection = projectWorldSimulationAnalogicalExperienceRetentionReentry({
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
  world_history: makeHistory(),
});
assert.equal(projection.version, worldSimulationAnalogicalExperienceRetentionReentryVersion);
assert.equal(projection.reentry_candidate_count, 1);
assert.equal(projection.same_character_retention_capsule_count_scanned, 1);
const candidate = projection.reentry_candidates[0];
assert.equal(candidate.current_impasse_ref, impasseRef);
assert.equal(candidate.current_corresponding_method_ref, methodRef);
assert.equal(candidate.exact_method_skeleton_identity, true);
assert.equal(candidate.exact_current_cue_match_count, 1);
assert.equal(candidate.exact_current_cue_matches[0].cue_kind, "perception");
assert.equal(candidate.unmatched_retained_context_cue_count, 1);
assert.equal(candidate.current_additional_context_cue_count, 1);
assert.equal(candidate.current_context_difference_present, true);
assert.equal(candidate.historical_method_outcome_assessment, "supports_prior_method");
assert.equal(candidate.prior_subjective_outcome_is_candidate_evidence_only, true);
assert.equal(candidate.prior_subjective_outcome_is_current_world_truth, false);
assert.equal(candidate.comparative_superiority_inferred, false);
assert.equal(candidate.causal_credit_assigned, false);
assert.equal(candidate.automatic_preference_selected, false);
assert.equal(candidate.action_selection_performed, false);
assert.equal(candidate.semantic_method_revision_performed, false);
assert.equal(candidate.world_truth_authority, false);
assert.doesNotThrow(() => assertWorldSimulationAnalogicalExperienceRetentionReentryProjection(projection, {
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
}));

for (const assessment of ["counterevidence_for_prior_method", "ambiguous_no_revision"]) {
  const retained = makeRetentionProjection({ assessment });
  const result = projectWorldSimulationAnalogicalExperienceRetentionReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_deliberation: phase79D,
    source_phase79e_discriminating_evidence: phase79E,
    world_history: makeHistory([retained]),
  });
  assert.equal(result.reentry_candidate_count, 1);
  assert.equal(result.reentry_candidates[0].historical_method_outcome_assessment, assessment);
  assert.equal(result.reentry_candidates[0].automatic_preference_selected, false);
}

const otherCharacter = makeRetentionProjection({ capsuleCharacter: "另一人" });
const otherCharacterResult = projectWorldSimulationAnalogicalExperienceRetentionReentry({
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
  world_history: makeHistory([otherCharacter]),
});
assert.equal(otherCharacterResult.reentry_candidate_count, 0);

const noCueOverlapPhase79E = makePhase79E(phase79D, [
  makeCue("phase79e_cue_unrelated", "attention", { focus: "distant_sound" }),
]);
const noCueOverlap = projectWorldSimulationAnalogicalExperienceRetentionReentry({
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: noCueOverlapPhase79E,
  world_history: makeHistory(),
});
assert.equal(noCueOverlap.reentry_candidate_count, 0);

const differentSkeleton = makeRetentionProjection({
  skeleton: { relation: "retreat_and_regroup", method_ref: "different_method" },
});
const noMethodMatch = projectWorldSimulationAnalogicalExperienceRetentionReentry({
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
  world_history: makeHistory([differentSkeleton]),
});
assert.equal(noMethodMatch.reentry_candidate_count, 0);

const sameTurnRetention = makeRetentionProjection({
  turnId: currentTurnId,
  stateRevision: currentStateRevision,
  worldStateHash: currentWorldStateHash,
});
const sameTurnIgnored = projectWorldSimulationAnalogicalExperienceRetentionReentry({
  world_simulation_session_id: sessionId,
  character,
  current_turn_id: currentTurnId,
  current_state_revision: currentStateRevision,
  current_world_state_hash: currentWorldStateHash,
  source_phase79d_impasse_deliberation: phase79D,
  source_phase79e_discriminating_evidence: phase79E,
  world_history: makeHistory([sameTurnRetention]),
});
assert.equal(sameTurnIgnored.reentry_candidate_count, 0);
assert.equal(sameTurnIgnored.history_window.total_prior_committed_turn_count, 0);

const tamperedHistory = makeHistory();
tamperedHistory.turns[0].analogical_experience_retention_capsules[0].capsules[0].method_skeleton.relation = "tampered";
assert.throws(
  () => projectWorldSimulationAnalogicalExperienceRetentionReentry({
    world_simulation_session_id: sessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: currentStateRevision,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_deliberation: phase79D,
    source_phase79e_discriminating_evidence: phase79E,
    world_history: tamperedHistory,
  }),
  (error) => [
    "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_INVALID",
    "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_CONTEXT_INVALID",
    "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_HASH_MISMATCH",
  ].includes(error?.code),
);

const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(
  stateSource,
  /analogical_experience_retention_reentry_projections:\s*\r?\n\s*input\.analogical_experience_retention_reentry_projections \?\? null/,
);

console.log("Phase80G retained adapted analogy cross-turn re-entry tests passed.");
