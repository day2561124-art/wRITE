import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "../../server/src/world-simulation-experiential-method-application-lineage-service.mjs";
import {
  worldSimulationExperientialMethodImpasseReresolutionVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle,
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage,
  buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract,
  worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion,
} from "../../server/src/world-simulation-experiential-method-impasse-resolution-application-lineage-service.mjs";

const sessionId = "world_session_phase79g";
const turnId = "turn_phase79g";
const stateRevision = 17;
const worldStateHash = "world_state_hash_phase79g";
const character = "伊萊亞斯・諾爾";
const dominantMethodRef = "phase76e_transfer_method_a";
const otherMethodRef = "phase76e_transfer_method_b";

function applicationReceiptBundle({ appliedMethodRefs = [dominantMethodRef], receiptCharacter = character } = {}) {
  const methodRefs = [...new Set(appliedMethodRefs)].sort();
  const identity = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    character: receiptCharacter,
    selection_kind: "candidate_action_intent",
    action_id: "action_phase79g_1",
    action_ref: "phase74a_action_phase79g_1",
    phase74d_choice_receipt_id: "phase74d_choice_phase79g_1",
    phase74d_choice_receipt_hash: "phase74d_choice_hash_phase79g_1",
    source_phase76f_projection_hash: "phase76f_projection_hash_phase79g_1",
    source_phase76e_transfer_hash: "phase76e_transfer_hash_phase79g_1",
    candidate_attribution_refs: ["phase76f_candidate_phase79g_1"],
    applied_method_refs: methodRefs,
  };
  const receiptHash = hashAgentRunValue(identity);
  const receipt = {
    receipt_id: `phase76f_application_${receiptHash.slice(0, 24)}`,
    receipt_hash: receiptHash,
    ...identity,
    application_status: "selected_candidate_has_recorded_experiential_method_attribution",
    selected_application_means_attributed_candidate_was_selected_only: true,
    method_caused_candidate_claimed: false,
    method_caused_selection_claimed: false,
    outcome_observed_by_this_receipt: false,
    action_outcome_credit_assigned: false,
    success_failure_learning_performed: false,
    retain_revise_decision_performed: false,
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
  const bundle = {
    version: worldSimulationExperientialMethodApplicationLineageVersion,
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    source_phase74d_receipt_bundle_hash: "phase74d_bundle_hash_phase79g",
    receipt_count: 1,
    receipts: [receipt],
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_receipt: false,
      append_only_world_history_is_authoritative: true,
      receipt_does_not_mutate_world_state: true,
      action_outcome_not_consumed: true,
      causal_credit_not_assigned: true,
    },
  };
  bundle.receipt_bundle_hash = hashAgentRunValue(bundle);
  return bundle;
}

function reresolutionProjection({
  projectionCharacter = character,
  resolved = true,
  methodRef = dominantMethodRef,
  impasseRef = "phase79d_impasse_phase79g_1",
} = {}) {
  const result = resolved
    ? {
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: "phase79b_resolution_phase79g_revised",
      resolution_status: "resolved_dominant",
      dominant_method_ref: methodRef,
      retained_method_refs: [methodRef],
      applied_preference_revisions: [{
        impasse_ref: impasseRef,
        competition_ref: "phase79a_competition_phase79g_1",
        preference: "left_preferred",
        evidence_cue_refs: ["phase79e_cue_phase79g_1"],
      }],
      resolved: true,
    }
    : {
      impasse_ref: impasseRef,
      prior_impasse_type: "tie_impasse",
      revised_resolution_ref: "phase79b_resolution_phase79g_unresolved",
      resolution_status: "tie_impasse",
      dominant_method_ref: null,
      retained_method_refs: [dominantMethodRef, otherMethodRef],
      applied_preference_revisions: [],
      resolved: false,
    };
  const effectiveResolutionHash = resolved
    ? "phase79b_effective_resolution_hash_resolved"
    : "phase79b_effective_resolution_hash_unresolved";
  const projection = {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character: projectionCharacter,
    current_turn_id: turnId,
    source_phase79b_resolution_hash: "phase79b_source_resolution_hash_phase79g",
    source_phase79d_impasse_hash: "phase79d_impasse_hash_phase79g",
    source_phase79e_evidence_hash: "phase79e_evidence_hash_phase79g",
    resolver_view_hash: "phase79f_resolver_view_hash_phase79g",
    preference_revision_records: resolved ? [...result.applied_preference_revisions] : [],
    effective_competition_resolution: {
      version: "phase79b-experiential-method-competition-resolution-v1",
      resolution_hash: effectiveResolutionHash,
    },
    effective_phase79b_resolution_hash: effectiveResolutionHash,
    impasse_results: [result],
    resolved_impasse_refs: resolved ? [impasseRef] : [],
    remaining_impasse_refs: resolved ? [] : [impasseRef],
    resolved_impasse_count: resolved ? 1 : 0,
    remaining_impasse_count: resolved ? 0 : 1,
    character_view: {
      source: "phase79f_evidence_grounded_experiential_method_impasse_reresolution",
      impasse_results: [result],
      deliberation_required: !resolved,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79b_phase79d_phase79e_lineage_verified: true,
      bounded_phase79d_phase79e_resolver_surface_only: true,
      existing_phase79b_competition_refs_only: true,
      existing_phase79b_resolution_kernel_reused: true,
      evidence_cue_refs_required_for_every_revision: true,
      omitted_competition_ref_preserved_prior_preference: true,
      arbitrary_tie_breaking_used: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      same_turn_learning_feedback_performed: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reresolution_hash = hashAgentRunValue(projection);
  return projection;
}

function build(input = {}) {
  return buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineage({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    impasse_reresolution_projections: [reresolutionProjection()],
    selected_application_receipts: applicationReceiptBundle(),
    ...input,
  });
}

const contract = buildWorldSimulationExperientialMethodImpasseResolutionApplicationLineageContract();
assert.equal(contract.version, worldSimulationExperientialMethodImpasseResolutionApplicationLineageVersion);
assert.equal(contract.phase, "Phase79G");
assert.equal(contract.resolved_dominant_method_must_be_in_selected_application, true);
assert.equal(contract.resolution_caused_action_choice_claimed, false);
assert.equal(contract.action_outcome_consumed, false);
assert.equal(contract.outcome_credit_assigned, false);
assert.equal(contract.semantic_retention_performed, false);
assert.equal(contract.semantic_revision_performed, false);
assert.equal(contract.world_truth_authority_claimed, false);

const linked = build();
assert.equal(linked.receipt_count, 1);
assert.equal(linked.receipts[0].dominant_method_ref, dominantMethodRef);
assert.equal(linked.receipts[0].resolution_status, "resolved_dominant");
assert.equal(linked.receipts[0].resolution_dominant_method_participated_in_selected_candidate, true);
assert.equal(linked.receipts[0].resolution_caused_action_choice_claimed, false);
assert.equal(linked.receipts[0].action_outcome_observed, false);
assert.equal(linked.receipts[0].outcome_credit_assigned, false);
assert.equal(linked.receipts[0].success_failure_learning_performed, false);
assert.equal(linked.receipts[0].semantic_retention_performed, false);
assert.equal(linked.receipts[0].semantic_revision_performed, false);
assert.equal(linked.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit, true);
assert.equal(linked.persistence_boundary.blocked_or_failed_turn_persists_receipt, false);
assert.doesNotThrow(() => assertWorldSimulationExperientialMethodImpasseResolutionApplicationLineageBundle(
  linked,
  {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  },
));

const multiMethodParticipation = build({
  selected_application_receipts: applicationReceiptBundle({
    appliedMethodRefs: [otherMethodRef, dominantMethodRef],
  }),
});
assert.equal(multiMethodParticipation.receipt_count, 1);
assert.deepEqual(
  multiMethodParticipation.receipts[0].applied_method_refs,
  [dominantMethodRef, otherMethodRef].sort(),
);
assert.equal(multiMethodParticipation.receipts[0].method_caused_selection_claimed, false);

const dominantNotApplied = build({
  selected_application_receipts: applicationReceiptBundle({ appliedMethodRefs: [otherMethodRef] }),
});
assert.equal(dominantNotApplied.receipt_count, 0);

const unresolved = build({
  impasse_reresolution_projections: [reresolutionProjection({ resolved: false })],
});
assert.equal(unresolved.receipt_count, 0);

const noReresolutionForApplicationCharacter = build({
  impasse_reresolution_projections: [reresolutionProjection({ projectionCharacter: "另一位角色" })],
});
assert.equal(noReresolutionForApplicationCharacter.receipt_count, 0);

const tamperedReresolution = reresolutionProjection();
tamperedReresolution.impasse_results[0].dominant_method_ref = "forged_method";
assert.throws(
  () => build({ impasse_reresolution_projections: [tamperedReresolution] }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_HASH_MISMATCH",
);

const duplicateProjection = reresolutionProjection();
assert.throws(
  () => build({ impasse_reresolution_projections: [reresolutionProjection(), duplicateProjection] }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_DUPLICATE_CHARACTER",
);

const inconsistentResolved = reresolutionProjection();
inconsistentResolved.impasse_results[0].applied_preference_revisions = [];
inconsistentResolved.preference_revision_records = [];
delete inconsistentResolved.reresolution_hash;
inconsistentResolved.reresolution_hash = hashAgentRunValue(inconsistentResolved);
assert.throws(
  () => build({ impasse_reresolution_projections: [inconsistentResolved] }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RESOLUTION_APPLICATION_LINEAGE_PHASE79F_RESULT_INVALID",
);

const tamperedApplication = applicationReceiptBundle();
tamperedApplication.receipts[0].action_id = "forged_action";
delete tamperedApplication.receipt_bundle_hash;
tamperedApplication.receipt_bundle_hash = hashAgentRunValue(tamperedApplication);
assert.throws(
  () => build({ selected_application_receipts: tamperedApplication }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_RECEIPT_HASH_MISMATCH",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loopSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-loop-service.mjs"),
  "utf8",
);
const stateSource = fs.readFileSync(
  path.resolve(__dirname, "../../server/src/world-simulation-state-service.mjs"),
  "utf8",
);
const selectedApplicationIndex = loopSource.indexOf(
  "const selectedExperientialMethodApplicationReceipts =",
);
const phase79gIndex = loopSource.indexOf(
  "const experientialMethodImpasseResolutionApplicationLineage =",
  selectedApplicationIndex,
);
const causalAdjudicationIndex = loopSource.indexOf(
  "const causalResolution = assertCausalResolution",
  phase79gIndex,
);
assert.ok(
  selectedApplicationIndex >= 0
    && phase79gIndex > selectedApplicationIndex
    && causalAdjudicationIndex > phase79gIndex,
);
assert.match(
  loopSource,
  /impasse_reresolution_projections:\s*preparedTurn\.experiential_method_impasse_reresolution_projections \?\? \[\]/,
);
assert.match(
  loopSource,
  /selected_application_receipts:\s*selectedExperientialMethodApplicationReceipts/,
);
assert.match(
  loopSource,
  /experiential_method_impasse_resolution_application_lineage:\s*cloneJson\(experientialMethodImpasseResolutionApplicationLineage\)/,
);
assert.match(
  stateSource,
  /experiential_method_impasse_resolution_application_lineage:\s*input\.experiential_method_impasse_resolution_application_lineage \?\? null/,
);

console.log("Phase79G experiential method impasse resolution application lineage tests passed.");
