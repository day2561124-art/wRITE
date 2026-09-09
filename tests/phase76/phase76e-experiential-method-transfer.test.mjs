import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationExperientialKnowledgeReentry,
  worldSimulationExperientialKnowledgeReentryVersion,
} from "../../server/src/world-simulation-experiential-knowledge-reentry-service.mjs";
import {
  buildWorldSimulationExperientialMethodTransferContract,
  buildWorldSimulationExperientialMethodTransferResolverView,
  projectWorldSimulationExperientialMethodTransfer,
  worldSimulationExperientialMethodTransferVersion,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  buildWorldSimulationSubjectiveActionDeliberationContract,
  buildWorldSimulationSubjectiveActionDeliberationView,
} from "../../server/src/world-simulation-subjective-action-deliberation-service.mjs";

const character = "伊萊亞斯・諾爾";
const turnId = "world_turn_phase76e_003";

function makePhase76DProjection({
  knowledgeStatus = "supported",
  category = "recurring_event_pattern",
} = {}) {
  const descriptor = {
    subject_scope: "self_autobiographical_experience",
    predicate: "when_direct_route_blocked_seek_alternative_route",
    object_ref: "alternative-route-method",
    qualifiers: ["alternative-means", "blocked-route"],
  };
  const candidate = {
    semantic_ref: "personal_semantic_memory_phase76e_source",
    character,
    semantic_category: category,
    semantic_key: "blocked-direct-route-seek-alternative",
    semantic_descriptor: descriptor,
    knowledge_status: knowledgeStatus,
    subjective_not_world_truth: true,
    epistemic_acceptance_decided: false,
  };
  const resolverView = {
    version: worldSimulationExperientialKnowledgeReentryVersion,
    current_turn_id: turnId,
    character,
    cue_context: {
      perception: { observed: [{ description: "主要通路被堵住。" }] },
    },
    candidate_personal_semantics: [candidate],
    selection_contract: {
      opaque_semantic_ref_selection_only: true,
      semantic_content_authoring_allowed: false,
      no_match_may_return_empty: true,
    },
    boundaries: {
      same_character_candidates_only: true,
      world_state_exposed: false,
    },
  };
  resolverView.resolver_view_hash = hashAgentRunValue(resolverView);
  return projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: resolverView,
    activated_semantic_refs: [candidate.semantic_ref],
  });
}

const contract = buildWorldSimulationExperientialMethodTransferContract();
assert.equal(contract.phase, "Phase76E");
assert.equal(contract.version, worldSimulationExperientialMethodTransferVersion);
assert.equal(contract.source_owner, "Phase76D");
assert.equal(contract.source_phase76d_reentry_hash_verified, true);
assert.equal(contract.recurring_event_pattern_only, true);
assert.equal(contract.relational_structure_transfer_only, true);
assert.equal(contract.surface_feature_copying_required, false);
assert.equal(contract.exact_case_replay_required, false);
assert.equal(contract.exact_action_replay_allowed, false);
assert.equal(contract.resolver_selects_canonical_method_and_cue_refs_only, true);
assert.equal(contract.resolver_may_author_method_content, false);
assert.equal(contract.resolver_may_author_action_content, false);
assert.equal(contract.current_context_grounding_required, true);
assert.equal(contract.current_context_revalidation_required, true);
assert.equal(contract.adaptation_before_use_required, true);
assert.equal(contract.missing_resolver_means_no_transfer, true);
assert.equal(contract.direct_action_selection_allowed, false);
assert.equal(contract.direct_plan_goal_mutation_allowed, false);
assert.equal(contract.direct_belief_write_allowed, false);
assert.equal(contract.direct_current_mind_write_allowed, false);
assert.equal(contract.direct_world_state_mutation_allowed, false);
assert.equal(contract.objective_feasibility_oracle_claimed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.candidate_action_generation_owner, "existing_world_action_proposer");
assert.equal(contract.durable_plan_lifecycle_owner, "Phase69B_Phase71");
assert.equal(contract.numeric_similarity_confidence_probability_utility_modeled, false);

const phase76D = makePhase76DProjection();
const resolverView = buildWorldSimulationExperientialMethodTransferResolverView({
  character,
  current_turn_id: turnId,
  experiential_knowledge_reentry: phase76D,
  current_context: {
    perception: {
      observed: [{
        description: "山洞的主要通道被坍方堵住。",
        target_id: "hidden-cave-engine-id",
        causal_evidence: "hidden-landslide-cause",
      }],
    },
    current_goal: "抵達山洞深處",
    current_action: "評估通路",
    goals: [{ label: "進入山洞深處", goal_id: "hidden-goal-id" }],
    engine_secret_id: "must-not-leak",
    raw_world_event: "hidden-world-event",
  },
});

assert.equal(resolverView.version, worldSimulationExperientialMethodTransferVersion);
assert.equal(resolverView.character, character);
assert.equal(resolverView.current_turn_id, turnId);
assert.equal(resolverView.method_candidates.length, 1);
assert.ok(resolverView.current_cue_catalog.length >= 2);
assert.equal(resolverView.selection_contract.semantic_method_authoring_allowed, false);
assert.equal(resolverView.selection_contract.concrete_action_authoring_allowed, false);
assert.equal(resolverView.boundaries.source_phase76d_verified, true);
assert.equal(resolverView.boundaries.source_surface_case_exposed, false);
assert.equal(resolverView.boundaries.engine_action_ids_exposed, false);

const methodCandidate = resolverView.method_candidates[0];
assert.equal(methodCandidate.method_skeleton.relation, "when_direct_route_blocked_seek_alternative_route");
assert.equal(methodCandidate.method_skeleton.method_ref, "alternative-route-method");
assert.deepEqual(methodCandidate.method_skeleton.qualifiers, ["alternative-means", "blocked-route"]);
assert.equal(methodCandidate.relational_structure_only, true);
assert.equal(methodCandidate.exact_action_replay_not_requested, true);

const serializedView = JSON.stringify(resolverView);
for (const hidden of [
  "hidden-cave-engine-id",
  "hidden-landslide-cause",
  "hidden-goal-id",
  "must-not-leak",
  "hidden-world-event",
  "personal_semantic_memory_phase76e_source",
]) {
  assert.equal(
    serializedView.includes(hidden),
    false,
    `Phase76E resolver leaked hidden/source-identity content: ${hidden}`,
  );
}

const cueRefs = resolverView.current_cue_catalog
  .filter((cue) => ["perception", "current_goal"].includes(cue.cue_kind))
  .map((cue) => cue.cue_ref);
assert.ok(cueRefs.length >= 2);

const noTransfer = projectWorldSimulationExperientialMethodTransfer({
  resolver_view: resolverView,
  transfer_mappings: [],
});
assert.equal(noTransfer.character_view.transferred_methods.length, 0);
assert.equal(noTransfer.audit.direct_action_selection, false);

const transfer = projectWorldSimulationExperientialMethodTransfer({
  resolver_view: resolverView,
  transfer_mappings: [{
    transfer_ref: methodCandidate.transfer_ref,
    mapping_kind: "structural_match",
    current_cue_refs: cueRefs,
  }],
});
assert.equal(transfer.version, worldSimulationExperientialMethodTransferVersion);
assert.equal(transfer.transferred_method_mappings.length, 1);
assert.equal(transfer.character_view.transferred_methods.length, 1);
const guidance = transfer.character_view.transferred_methods[0];
assert.equal(guidance.kind, "analogical_experiential_method");
assert.equal(guidance.method_skeleton.relation, "when_direct_route_blocked_seek_alternative_route");
assert.equal(guidance.method_skeleton.method_ref, "alternative-route-method");
assert.equal(guidance.mapping_kind, "structural_match");
assert.equal(guidance.current_context_grounded, true);
assert.ok(guidance.current_context_basis.includes("perception"));
assert.ok(guidance.current_context_basis.includes("current_goal"));
assert.equal(guidance.relational_structure_transfer, true);
assert.equal(guidance.surface_case_replay, false);
assert.equal(guidance.exact_action_replay, false);
assert.equal(guidance.candidate_action_generation_deferred, true);
assert.equal(guidance.current_available_action_mapping_required, true);
assert.equal(guidance.current_context_revalidation_required, true);
assert.equal(guidance.adaptation_before_use_required, true);
assert.equal(guidance.advisory_only, true);
assert.equal(guidance.selected_action_authority, false);
assert.equal(guidance.objective_feasibility_verified, false);
assert.equal(guidance.subjective_not_world_truth, true);
assert.equal(Object.hasOwn(guidance, "action_id"), false);
assert.equal(Object.hasOwn(guidance, "intent"), false);
assert.equal(JSON.stringify(transfer.character_view).includes(methodCandidate.transfer_ref), false);
assert.equal(transfer.audit.resolver_authored_method_content, false);
assert.equal(transfer.audit.resolver_authored_action_content, false);
assert.equal(transfer.audit.existing_action_proposer_reused, true);
assert.equal(transfer.audit.existing_phase74_deliberation_grounding_targeted, true);
assert.equal(transfer.audit.existing_phase71_plan_lifecycle_preserved, true);
assert.equal(transfer.audit.world_truth_authority_claimed, false);
assert.equal(transfer.audit.numeric_similarity_confidence_probability_utility_modeled, false);

assert.throws(
  () => projectWorldSimulationExperientialMethodTransfer({
    resolver_view: resolverView,
    transfer_mappings: [{
      transfer_ref: methodCandidate.transfer_ref,
      mapping_kind: "structural_match",
      current_cue_refs: cueRefs,
      action_id: "copy-old-action",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodTransfer({
    resolver_view: resolverView,
    transfer_mappings: [{
      transfer_ref: "phase76e_method_not_in_view",
      mapping_kind: "structural_match",
      current_cue_refs: cueRefs,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_MAPPING_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodTransfer({
    resolver_view: resolverView,
    transfer_mappings: [{
      transfer_ref: methodCandidate.transfer_ref,
      mapping_kind: "structural_match",
      current_cue_refs: ["phase76e_cue_not_in_view"],
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_CUE_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodTransfer({
    resolver_view: resolverView,
    transfer_mappings: [
      {
        transfer_ref: methodCandidate.transfer_ref,
        mapping_kind: "structural_match",
        current_cue_refs: cueRefs,
      },
      {
        transfer_ref: methodCandidate.transfer_ref,
        mapping_kind: "partial_structural_match",
        current_cue_refs: cueRefs,
      },
    ],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_DUPLICATE_METHOD",
);

const tamperedPhase76D = structuredClone(phase76D);
tamperedPhase76D.character_view.experiential_knowledge[0].semantic_descriptor.object_ref =
  "tampered-method";
assert.throws(
  () => buildWorldSimulationExperientialMethodTransferResolverView({
    character,
    current_turn_id: turnId,
    experiential_knowledge_reentry: tamperedPhase76D,
    current_context: { current_goal: "抵達山洞深處" },
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_TRANSFER_SOURCE_HASH_MISMATCH",
);

const contestedSource = makePhase76DProjection({ knowledgeStatus: "contested" });
const contestedView = buildWorldSimulationExperientialMethodTransferResolverView({
  character,
  current_turn_id: turnId,
  experiential_knowledge_reentry: contestedSource,
  current_context: { current_goal: "抵達山洞深處" },
});
const contestedTransfer = projectWorldSimulationExperientialMethodTransfer({
  resolver_view: contestedView,
  transfer_mappings: [{
    transfer_ref: contestedView.method_candidates[0].transfer_ref,
    mapping_kind: "partial_structural_match",
    current_cue_refs: [contestedView.current_cue_catalog[0].cue_ref],
  }],
});
assert.equal(contestedTransfer.character_view.transferred_methods[0].source_knowledge_status, "contested");
assert.equal(
  contestedTransfer.character_view.transferred_methods[0].contested_source_requires_extra_revalidation,
  true,
);

const nonPatternSource = makePhase76DProjection({ category: "autobiographical_fact" });
const nonPatternView = buildWorldSimulationExperientialMethodTransferResolverView({
  character,
  current_turn_id: turnId,
  experiential_knowledge_reentry: nonPatternSource,
  current_context: { current_goal: "抵達山洞深處" },
});
assert.equal(nonPatternView.method_candidates.length, 0);

const phase74Contract = buildWorldSimulationSubjectiveActionDeliberationContract();
assert.equal(phase74Contract.experiential_method_guidance_may_ground_deliberation, true);
assert.equal(phase74Contract.experiential_method_guidance_remains_advisory, true);
const phase74View = buildWorldSimulationSubjectiveActionDeliberationView({
  character,
  cognition: {
    experiential_method_guidance: transfer.character_view,
    current_action: "評估通路",
  },
  candidate_action_intents: [{
    action_id: "search_alternative_passage",
    intent: "檢查坍方周圍是否有能繞行的其他通路",
  }],
});
assert.ok(
  phase74View.cognition_grounding_catalog.some(
    (grounding) => grounding.grounding_kind === "experiential_method_guidance",
  ),
  "Phase74A must allow Phase76E method guidance to ground later deliberation.",
);
assert.equal(phase74View.choice_boundary.character_brain_owns_final_choice, true);
assert.equal(phase74View.choice_boundary.deterministic_winner_not_computed, true);

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
const phase76DIndex = loopSource.indexOf(
  "const experientialKnowledgeReentryResolverView =",
);
const phase76EIndex = loopSource.indexOf(
  "const experientialMethodTransferResolverView =",
);
const cognitionGuidanceIndex = loopSource.indexOf(
  "characterCognition.experiential_method_guidance =",
);
const actionProposerIndex = loopSource.indexOf(
  '"world_action_proposer"',
  cognitionGuidanceIndex,
);
assert.ok(
  phase76DIndex >= 0
    && phase76EIndex > phase76DIndex
    && cognitionGuidanceIndex > phase76EIndex
    && actionProposerIndex > cognitionGuidanceIndex,
  "Phase76E must consume Phase76D before attaching advisory guidance ahead of Action Proposer.",
);
assert.match(loopSource, /experiential_method_transfer_projections:/);
assert.match(loopSource, /version:\s*worldSimulationExperientialMethodTransferVersion/);
assert.match(loopSource, /phase74_deliberation_grounding_reused:\s*true/);
assert.match(stateSource, /experiential_method_transfer_projections:/);

console.log("Phase76E analogical experiential method transfer tests passed.");
