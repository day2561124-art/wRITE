import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetition,
} from "../../server/src/world-simulation-experiential-method-competition-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionResolutionContract,
  buildWorldSimulationExperientialMethodCompetitionResolutionResolverView,
  projectWorldSimulationExperientialMethodCompetitionResolution,
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "../../server/src/world-simulation-experiential-method-competition-resolution-service.mjs";

function transferProjection({ character = "千夜", turn = "turn-79b", methods = [] } = {}) {
  const mappings = methods.map((method, index) => ({
    transfer_ref: method.transfer_ref,
    transfer_index: index,
    mapping_kind: method.mapping_kind ?? "relational_analogy",
    current_cue_refs: method.current_cue_refs,
    method_skeleton_hash: hashAgentRunValue(method.method_skeleton),
    source_knowledge_status: method.source_knowledge_status ?? "supported",
  }));
  const guidance = methods.map((method) => ({
    kind: "analogical_experiential_method",
    method_skeleton: structuredClone(method.method_skeleton),
    source_knowledge_status: method.source_knowledge_status ?? "supported",
    mapping_kind: method.mapping_kind ?? "relational_analogy",
    current_context_grounded: true,
    current_context_basis: method.current_context_basis ?? ["perception"],
    relational_structure_transfer: true,
    surface_case_replay: false,
    exact_action_replay: false,
    advisory_only: true,
    candidate_action_generation_deferred: true,
    current_available_action_mapping_required: true,
    current_context_revalidation_required: true,
    adaptation_before_use_required: true,
    contested_source_requires_extra_revalidation:
      (method.source_knowledge_status ?? "supported") === "contested",
    subjective_not_world_truth: true,
    selected_action_authority: false,
    objective_feasibility_verified: false,
  }));
  const projection = {
    version: worldSimulationExperientialMethodTransferVersion,
    current_turn_id: turn,
    character,
    source_phase76d_reentry_hash: "phase76d-source",
    resolver_view_hash: "phase76e-view",
    transferred_method_mappings: mappings,
    character_view: {
      source: "cue_grounded_prior_experiential_relational_methods",
      transferred_methods: guidance,
      advisory_only: true,
      selected_action_authority: false,
      action_candidate_generation_owner: "existing_world_action_proposer",
      current_context_revalidation_required: true,
      adaptation_before_use_required: true,
    },
    audit: {
      canonical_phase76d_source_verified: true,
      recurring_event_pattern_only: true,
      relational_structure_transfer_only: true,
      source_surface_case_replayed: false,
      exact_action_replay_allowed: false,
      resolver_authored_method_content: false,
      resolver_authored_action_content: false,
      current_context_grounding_required: true,
      transferred_method_count: mappings.length,
      supported_and_contested_status_preserved: true,
      numeric_similarity_confidence_probability_utility_modeled: false,
      objective_feasibility_verified: false,
      world_truth_authority_claimed: false,
      direct_action_selection: false,
      direct_plan_goal_mutation: false,
      direct_belief_write: false,
      direct_current_mind_write: false,
      direct_world_state_mutation: false,
      existing_action_proposer_reused: true,
      existing_phase74_deliberation_grounding_targeted: true,
      existing_phase71_plan_lifecycle_preserved: true,
      parallel_memory_belief_plan_store_created: false,
    },
  };
  projection.transfer_hash = hashAgentRunValue(projection);
  return projection;
}

function competitionFor(transfer) {
  return projectWorldSimulationExperientialMethodCompetition({
    experiential_method_transfer_projections: [transfer],
    current_turn_id: transfer.current_turn_id,
    character: transfer.character,
  });
}

const contract = buildWorldSimulationExperientialMethodCompetitionResolutionContract();
assert.equal(contract.version, worldSimulationExperientialMethodCompetitionResolutionVersion);
assert.deepEqual(contract.source_owners, ["Phase79A", "Phase76E"]);
assert.equal(contract.contested_source_is_not_automatic_rejection, true);
assert.equal(contract.qualitative_partial_order_only, true);
assert.equal(contract.numeric_similarity_confidence_probability_utility_modeled, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.same_turn_learning_feedback_allowed, false);

const transfer = transferProjection({
  methods: [
    {
      transfer_ref: "method-a",
      current_cue_refs: ["cue-shared", "cue-a"],
      method_skeleton: { relation: "probe_then_commit", method_ref: "semantic-a", qualifiers: ["slow"] },
      source_knowledge_status: "supported",
    },
    {
      transfer_ref: "method-b",
      current_cue_refs: ["cue-shared", "cue-b"],
      method_skeleton: { relation: "commit_then_adjust", method_ref: "semantic-b", qualifiers: ["fast"] },
      source_knowledge_status: "contested",
    },
    {
      transfer_ref: "method-c",
      current_cue_refs: ["cue-independent"],
      method_skeleton: { relation: "observe_only", method_ref: "semantic-c", qualifiers: [] },
      source_knowledge_status: "supported",
    },
  ],
});
const competition = competitionFor(transfer);
assert.equal(competition.competition_candidate_count, 1);

const resolverView = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
  experiential_method_competition: competition,
  experiential_method_transfer_projections: [transfer],
});
assert.equal(resolverView.version, worldSimulationExperientialMethodCompetitionResolutionVersion);
assert.equal(resolverView.character_contexts.length, 1);
assert.equal(resolverView.character_contexts[0].competition_pairs.length, 1);
assert.deepEqual(resolverView.character_contexts[0].independent_method_refs, ["method-c"]);
assert.equal(resolverView.character_contexts[0].competing_methods.length, 2);
assert.deepEqual(
  resolverView.character_contexts[0].competing_methods.find((method) => method.transfer_ref === "method-a")?.method_skeleton,
  { relation: "probe_then_commit", method_ref: "semantic-a", qualifiers: ["slow"] },
);
assert.equal(resolverView.boundaries.raw_world_state_exposed, false);
assert.equal(resolverView.selection_contract.numeric_preference_or_utility_forbidden, true);

const pairRef = resolverView.character_contexts[0].competition_pairs[0].competition_ref;
const preferredA = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: resolverView,
  preference_decisions: [{ competition_ref: pairRef, preference: "left_preferred" }],
});
assert.equal(preferredA.character_contexts[0].competition_components.length, 1);
assert.equal(preferredA.character_contexts[0].competition_components[0].resolution_status, "resolved_dominant");
assert.equal(preferredA.character_contexts[0].competition_components[0].dominant_method_ref, "method-a");
assert.deepEqual(preferredA.character_contexts[0].independent_method_refs, ["method-c"]);
assert.equal(preferredA.tie_impasse_count, 0);
assert.equal(preferredA.conflict_impasse_count, 0);
assert.equal(preferredA.audit.action_selection_performed, false);

// A contested source remains eligible; Phase79B must not hard-code it as worse.
const preferredContestedB = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: resolverView,
  preference_decisions: [{ competition_ref: pairRef, preference: "right_preferred" }],
});
assert.equal(
  preferredContestedB.character_contexts[0].competition_components[0].dominant_method_ref,
  "method-b",
);
assert.equal(preferredContestedB.audit.contested_source_auto_rejected, false);

const missingDecision = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: resolverView,
  preference_decisions: [],
});
assert.equal(missingDecision.character_contexts[0].competition_components[0].resolution_status, "tie_impasse");
assert.equal(missingDecision.tie_impasse_count, 1);
assert.deepEqual(
  missingDecision.character_contexts[0].competition_components[0].unresolved_competition_refs,
  [pairRef],
);

const indifferent = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: resolverView,
  preference_decisions: [{ competition_ref: pairRef, preference: "indifferent" }],
});
assert.equal(indifferent.character_contexts[0].competition_components[0].resolution_status, "indifferent_set");
assert.equal(indifferent.character_contexts[0].indifferent_set_count, 1);

assert.throws(
  () => projectWorldSimulationExperientialMethodCompetitionResolution({
    resolver_view: resolverView,
    preference_decisions: [{
      competition_ref: pairRef,
      preference: "left_preferred",
      utility: 0.99,
    }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_AUTHORITY_FIELD_FORBIDDEN",
);

const tamperedView = structuredClone(resolverView);
tamperedView.character_contexts[0].independent_method_refs.push("invented-method");
assert.throws(
  () => projectWorldSimulationExperientialMethodCompetitionResolution({
    resolver_view: tamperedView,
    preference_decisions: [],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_VIEW_HASH_MISMATCH",
);

const cycleTransfer = transferProjection({
  turn: "turn-79b-cycle",
  methods: [
    {
      transfer_ref: "cycle-a",
      current_cue_refs: ["cue-shared"],
      method_skeleton: { relation: "a", method_ref: "semantic-a", qualifiers: [] },
    },
    {
      transfer_ref: "cycle-b",
      current_cue_refs: ["cue-shared"],
      method_skeleton: { relation: "b", method_ref: "semantic-b", qualifiers: [] },
    },
    {
      transfer_ref: "cycle-c",
      current_cue_refs: ["cue-shared"],
      method_skeleton: { relation: "c", method_ref: "semantic-c", qualifiers: [] },
    },
  ],
});
const cycleCompetition = competitionFor(cycleTransfer);
assert.equal(cycleCompetition.competition_candidate_count, 3);
const cycleView = buildWorldSimulationExperientialMethodCompetitionResolutionResolverView({
  experiential_method_competition: cycleCompetition,
  experiential_method_transfer_projections: [cycleTransfer],
});
const cyclePairs = cycleView.character_contexts[0].competition_pairs;
const refFor = (left, right) => cyclePairs.find((pair) =>
  pair.left_transfer_ref === left && pair.right_transfer_ref === right)?.competition_ref;
const cycleResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
  resolver_view: cycleView,
  preference_decisions: [
    { competition_ref: refFor("cycle-a", "cycle-b"), preference: "left_preferred" },
    { competition_ref: refFor("cycle-a", "cycle-c"), preference: "right_preferred" },
    { competition_ref: refFor("cycle-b", "cycle-c"), preference: "left_preferred" },
  ],
});
assert.equal(cycleResolution.character_contexts[0].competition_components.length, 1);
assert.equal(cycleResolution.character_contexts[0].competition_components[0].resolution_status, "conflict_impasse");
assert.equal(cycleResolution.character_contexts[0].competition_components[0].cyclic_preference_detected, true);
assert.equal(cycleResolution.conflict_impasse_count, 1);

console.log("Phase79B experiential method competition resolution tests passed.");
