import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  buildWorldSimulationExperientialMethodCompetitionContract,
  projectWorldSimulationExperientialMethodCompetition,
  worldSimulationExperientialMethodCompetitionVersion,
} from "../../server/src/world-simulation-experiential-method-competition-service.mjs";

function transferProjection({ character = "千夜", turn = "turn-79a", mappings = [] } = {}) {
  const projection = {
    version: worldSimulationExperientialMethodTransferVersion,
    current_turn_id: turn,
    character,
    source_phase76d_reentry_hash: "phase76d-source",
    resolver_view_hash: "phase76e-view",
    transferred_method_mappings: mappings,
    character_view: {
      source: "cue_grounded_prior_experiential_relational_methods",
      transferred_methods: [],
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

const contract = buildWorldSimulationExperientialMethodCompetitionContract();
assert.equal(contract.version, worldSimulationExperientialMethodCompetitionVersion);
assert.equal(contract.source_owner, "Phase76E");
assert.equal(contract.preference_resolution_performed, false);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.same_turn_learning_feedback_allowed, false);

const source = transferProjection({
  mappings: [
    {
      transfer_ref: "method-a",
      transfer_index: 0,
      mapping_kind: "relational_analogy",
      current_cue_refs: ["cue-shared", "cue-a"],
      method_skeleton_hash: "hash-a",
      source_knowledge_status: "supported",
    },
    {
      transfer_ref: "method-b",
      transfer_index: 1,
      mapping_kind: "relational_analogy",
      current_cue_refs: ["cue-shared", "cue-b"],
      method_skeleton_hash: "hash-b",
      source_knowledge_status: "contested",
    },
    {
      transfer_ref: "method-c",
      transfer_index: 2,
      mapping_kind: "relational_analogy",
      current_cue_refs: ["cue-c"],
      method_skeleton_hash: "hash-a",
      source_knowledge_status: "supported",
    },
  ],
});

const projection = projectWorldSimulationExperientialMethodCompetition({
  experiential_method_transfer_projections: [source],
  current_turn_id: "turn-79a",
  character: "千夜",
});
assert.equal(projection.version, worldSimulationExperientialMethodCompetitionVersion);
assert.equal(projection.source_projection_count, 1);
assert.equal(projection.character_contexts.length, 1);
assert.equal(projection.character_contexts[0].transferred_method_count, 3);
assert.equal(projection.character_contexts[0].pair_count, 3);
assert.equal(projection.character_contexts[0].competition_candidate_count, 1);
assert.equal(projection.character_contexts[0].downstream_resolution_required, true);

const pairs = projection.character_contexts[0].pairwise_competition_evidence;
const ab = pairs.find((pair) => pair.left_transfer_ref === "method-a" && pair.right_transfer_ref === "method-b");
assert.ok(ab);
assert.deepEqual(ab.shared_current_cue_refs, ["cue-shared"]);
assert.equal(ab.structurally_distinct, true);
assert.equal(ab.competition_resolution_required, true);
assert.equal(ab.contested_source_present, true);
assert.equal(ab.action_selection_performed, false);

const ac = pairs.find((pair) => pair.left_transfer_ref === "method-a" && pair.right_transfer_ref === "method-c");
assert.ok(ac);
assert.deepEqual(ac.shared_current_cue_refs, []);
assert.equal(ac.independent_or_composable_possible, true);
assert.equal(ac.competition_resolution_required, false);

const filteredOut = projectWorldSimulationExperientialMethodCompetition({
  experiential_method_transfer_projections: [source],
  character: "別人",
});
assert.equal(filteredOut.source_projection_count, 0);
assert.equal(filteredOut.character_contexts.length, 0);

const tampered = structuredClone(source);
tampered.transferred_method_mappings[0].current_cue_refs.push("tampered");
assert.throws(
  () => projectWorldSimulationExperientialMethodCompetition({
    experiential_method_transfer_projections: [tampered],
  }),
  (error) => error?.code === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_SOURCE_HASH_MISMATCH",
);

assert.equal(projection.audit.preference_resolution_performed, false);
assert.equal(projection.audit.impasse_resolution_performed, false);
assert.equal(projection.audit.numeric_similarity_confidence_probability_utility_modeled, false);
assert.equal(projection.audit.action_selection_performed, false);
assert.equal(projection.audit.same_turn_learning_feedback_performed, false);

console.log("Phase79A experiential method competition evidence tests passed.");
