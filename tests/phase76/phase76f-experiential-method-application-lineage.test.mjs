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
  buildWorldSimulationExperientialMethodTransferResolverView,
  projectWorldSimulationExperientialMethodTransfer,
} from "../../server/src/world-simulation-experiential-method-transfer-service.mjs";
import {
  buildWorldSimulationExperientialMethodApplicationLineageContract,
  buildWorldSimulationExperientialMethodCandidateAttributionResolverView,
  buildWorldSimulationSelectedExperientialMethodApplicationReceipts,
  projectWorldSimulationExperientialMethodCandidateAttribution,
  worldSimulationExperientialMethodApplicationLineageVersion,
} from "../../server/src/world-simulation-experiential-method-application-lineage-service.mjs";
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
} from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  buildWorldSimulationLoopContract,
} from "../../server/src/world-simulation-loop-service.mjs";

const character = "伊萊亞斯・諾爾";
const turnId = "world_turn_phase76f_001";
const sessionId = "world_session_phase76f_001";
const stateRevision = 9;
const worldStateHash = "a".repeat(64);

function makePhase76ETransfer() {
  const descriptor = {
    subject_scope: "self_autobiographical_experience",
    predicate: "when_direct_route_blocked_seek_alternative_route",
    object_ref: "alternative-route-method",
    qualifiers: ["alternative-means", "blocked-route"],
  };
  const candidate = {
    semantic_ref: "personal_semantic_memory_phase76f_source",
    character,
    semantic_category: "recurring_event_pattern",
    semantic_key: "blocked-direct-route-seek-alternative",
    semantic_descriptor: descriptor,
    knowledge_status: "supported",
    subjective_not_world_truth: true,
    epistemic_acceptance_decided: false,
  };
  const reentryView = {
    version: worldSimulationExperientialKnowledgeReentryVersion,
    current_turn_id: turnId,
    character,
    cue_context: {
      perception: { observed: [{ description: "主要通路被坍方堵住。" }] },
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
  reentryView.resolver_view_hash = hashAgentRunValue(reentryView);
  const reentry = projectWorldSimulationExperientialKnowledgeReentry({
    resolver_view: reentryView,
    activated_semantic_refs: [candidate.semantic_ref],
  });
  const transferView = buildWorldSimulationExperientialMethodTransferResolverView({
    character,
    current_turn_id: turnId,
    experiential_knowledge_reentry: reentry,
    current_context: {
      perception: { observed: [{ description: "山洞主通道被堵住。" }] },
      current_goal: "抵達山洞深處",
    },
  });
  return projectWorldSimulationExperientialMethodTransfer({
    resolver_view: transferView,
    transfer_mappings: [{
      transfer_ref: transferView.method_candidates[0].transfer_ref,
      mapping_kind: "structural_match",
      current_cue_refs: transferView.current_cue_catalog.map((cue) => cue.cue_ref),
    }],
  });
}

const candidateActionIntents = [
  {
    action_id: "search_alternative_passage",
    intent: "檢查坍方周圍是否有能繞行的其他通路",
    prerequisites: ["能觀察周圍"],
    known_costs: ["花費時間"],
  },
  {
    action_id: "wait_near_blockage",
    intent: "留在坍方前等待",
  },
];
const cognition = {
  experiential_method_guidance: {
    source: "cue_grounded_prior_experiential_relational_methods",
    advisory_only: true,
  },
  current_action: "評估通路",
};
const phase76E = makePhase76ETransfer();

const contract = buildWorldSimulationExperientialMethodApplicationLineageContract();
assert.equal(contract.phase, "Phase76F");
assert.equal(contract.version, worldSimulationExperientialMethodApplicationLineageVersion);
assert.equal(contract.source_method_owner, "Phase76E");
assert.equal(contract.action_candidate_identity_owner, "Phase74A");
assert.equal(contract.selected_action_identity_owner, "Phase74D");
assert.equal(contract.resolver_selects_existing_transfer_and_action_refs_only, true);
assert.equal(contract.resolver_may_author_method_content, false);
assert.equal(contract.resolver_may_author_action_content, false);
assert.equal(contract.resolver_may_select_action, false);
assert.equal(contract.resolver_may_read_outcome, false);
assert.equal(contract.candidate_attribution_is_not_causal_credit, true);
assert.equal(contract.selected_application_does_not_claim_method_caused_choice, true);
assert.equal(contract.action_outcome_credit_assigned, false);
assert.equal(contract.success_failure_learning_performed, false);
assert.equal(contract.retain_revise_policy_modeled, false);
assert.equal(contract.many_methods_per_candidate_allowed, true);
assert.equal(contract.one_method_may_inform_multiple_candidates, true);
assert.equal(contract.numeric_strength_confidence_probability_utility_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.direct_action_selection_allowed, false);

const resolverView = buildWorldSimulationExperientialMethodCandidateAttributionResolverView({
  character,
  current_turn_id: turnId,
  experiential_method_transfer: phase76E,
  cognition,
  candidate_action_intents: candidateActionIntents,
});
assert.equal(resolverView.version, worldSimulationExperientialMethodApplicationLineageVersion);
assert.equal(resolverView.method_catalog.length, 1);
assert.equal(resolverView.action_catalog.length, 2);
assert.equal(resolverView.selection_contract.transfer_ref_must_be_from_method_catalog, true);
assert.equal(resolverView.selection_contract.action_ref_must_be_from_action_catalog, true);
assert.equal(resolverView.selection_contract.selected_action_requested, false);
assert.equal(resolverView.selection_contract.action_outcome_requested, false);
assert.equal(resolverView.selection_contract.causal_credit_requested, false);
assert.equal(resolverView.boundaries.action_outcome_exposed, false);
assert.equal(resolverView.boundaries.selected_action_exposed, false);
assert.equal(resolverView.boundaries.raw_world_state_exposed, false);
assert.equal(resolverView.boundaries.hidden_causal_evidence_exposed, false);
assert.equal(
  resolverView.method_catalog[0].method_skeleton.relation,
  "when_direct_route_blocked_seek_alternative_route",
);
const transferRef = resolverView.method_catalog[0].transfer_ref;
const alternativeAction = resolverView.action_catalog.find(
  (entry) => entry.action_id === "search_alternative_passage",
);
const waitAction = resolverView.action_catalog.find(
  (entry) => entry.action_id === "wait_near_blockage",
);
assert.ok(alternativeAction?.action_ref);
assert.ok(waitAction?.action_ref);
assert.equal(alternativeAction.semantic_context.intent, "檢查坍方周圍是否有能繞行的其他通路");

const emptyProjection = projectWorldSimulationExperientialMethodCandidateAttribution({
  resolver_view: resolverView,
  candidate_attributions: [],
});
assert.equal(emptyProjection.candidate_attribution_count, 0);
assert.equal(emptyProjection.audit.causal_credit_assigned, false);

const attributionProjection = projectWorldSimulationExperientialMethodCandidateAttribution({
  resolver_view: resolverView,
  candidate_attributions: [{
    transfer_ref: transferRef,
    action_ref: alternativeAction.action_ref,
  }],
});
assert.equal(attributionProjection.candidate_attribution_count, 1);
const attribution = attributionProjection.candidate_attributions[0];
assert.equal(attribution.relation, "method_informed_candidate");
assert.equal(attribution.transfer_ref, transferRef);
assert.equal(attribution.action_ref, alternativeAction.action_ref);
assert.equal(attribution.action_id, alternativeAction.action_id);
assert.equal(attribution.candidate_attribution_not_causal_credit, true);
assert.equal(attribution.method_caused_candidate_claimed, false);
assert.equal(attribution.method_caused_selection_claimed, false);
assert.equal(attribution.action_outcome_known, false);
assert.equal(attribution.world_truth_authority, false);

for (const forbiddenField of [
  ["outcome", "success"],
  ["selected_action", alternativeAction.action_id],
  ["confidence", 0.95],
  ["credit_score", 1],
  ["method_skeleton", { relation: "invented" }],
]) {
  assert.throws(
    () => projectWorldSimulationExperientialMethodCandidateAttribution({
      resolver_view: resolverView,
      candidate_attributions: [{
        transfer_ref: transferRef,
        action_ref: alternativeAction.action_ref,
        [forbiddenField[0]]: forbiddenField[1],
      }],
    }),
    (error) => error?.code
      === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_AUTHORITY_FIELD_FORBIDDEN",
  );
}
assert.throws(
  () => projectWorldSimulationExperientialMethodCandidateAttribution({
    resolver_view: resolverView,
    candidate_attributions: [{
      transfer_ref: transferRef,
      action_ref: "phase74a_action_not_in_view",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_OUT_OF_VIEW",
);
assert.throws(
  () => projectWorldSimulationExperientialMethodCandidateAttribution({
    resolver_view: resolverView,
    candidate_attributions: [
      { transfer_ref: transferRef, action_ref: alternativeAction.action_ref },
      { transfer_ref: transferRef, action_ref: alternativeAction.action_ref },
    ],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_ATTRIBUTION_DUPLICATE",
);

const decisionPacket = {
  character,
  cognition,
  candidate_action_intents: candidateActionIntents,
};
function choiceBundle(actionId = "search_alternative_passage") {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [decisionPacket],
    selected_action_intents: actionId === null
      ? [{ character, selection: "reject_all", action_id: null }]
      : [{ character, selection: "candidate_action_intent", action_id: actionId }],
  });
}

const selectedApplications = buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  candidate_attribution_projections: [attributionProjection],
  subjective_choice_commitment_receipts: choiceBundle(),
});
assert.equal(selectedApplications.receipt_count, 1);
const selectedReceipt = selectedApplications.receipts[0];
assert.equal(selectedReceipt.action_id, "search_alternative_passage");
assert.equal(selectedReceipt.action_ref, alternativeAction.action_ref);
assert.deepEqual(selectedReceipt.applied_method_refs, [transferRef]);
assert.deepEqual(selectedReceipt.candidate_attribution_refs, [attribution.attribution_ref]);
assert.ok(selectedReceipt.phase74d_choice_receipt_id.startsWith("phase74d_choice_"));
assert.equal(selectedReceipt.selected_application_means_attributed_candidate_was_selected_only, true);
assert.equal(selectedReceipt.method_caused_candidate_claimed, false);
assert.equal(selectedReceipt.method_caused_selection_claimed, false);
assert.equal(selectedReceipt.outcome_observed_by_this_receipt, false);
assert.equal(selectedReceipt.action_outcome_credit_assigned, false);
assert.equal(selectedReceipt.success_failure_learning_performed, false);
assert.equal(selectedReceipt.retain_revise_decision_performed, false);
assert.equal(selectedReceipt.world_truth_authority, false);
assert.equal(selectedApplications.persistence_boundary.action_outcome_not_consumed, true);
assert.equal(selectedApplications.persistence_boundary.causal_credit_not_assigned, true);

const selectedDifferentCandidate = buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  candidate_attribution_projections: [attributionProjection],
  subjective_choice_commitment_receipts: choiceBundle("wait_near_blockage"),
});
assert.equal(selectedDifferentCandidate.receipt_count, 0);

const rejectedAll = buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
  world_simulation_session_id: sessionId,
  turn_id: turnId,
  state_revision: stateRevision,
  world_state_hash: worldStateHash,
  candidate_attribution_projections: [attributionProjection],
  subjective_choice_commitment_receipts: choiceBundle(null),
});
assert.equal(rejectedAll.receipt_count, 0);

const tamperedProjection = structuredClone(attributionProjection);
tamperedProjection.candidate_attributions[0].action_id = "wait_near_blockage";
assert.throws(
  () => buildWorldSimulationSelectedExperientialMethodApplicationReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    candidate_attribution_projections: [tamperedProjection],
    subjective_choice_commitment_receipts: choiceBundle(),
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_PROJECTION_HASH_MISMATCH",
);

const tamperedPhase76E = structuredClone(phase76E);
tamperedPhase76E.transferred_method_mappings[0].method_skeleton_hash = "0".repeat(64);
assert.throws(
  () => buildWorldSimulationExperientialMethodCandidateAttributionResolverView({
    character,
    current_turn_id: turnId,
    experiential_method_transfer: tamperedPhase76E,
    cognition,
    candidate_action_intents: candidateActionIntents,
  }),
  (error) => [
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_HASH_MISMATCH",
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_APPLICATION_SOURCE_LINEAGE_MISMATCH",
  ].includes(error?.code),
);

const loopContract = buildWorldSimulationLoopContract();
assert.equal(
  loopContract.experiential_method_application_lineage.version,
  worldSimulationExperientialMethodApplicationLineageVersion,
);
assert.equal(
  loopContract.experiential_method_candidate_attribution_resolver_hook.option_name,
  "experientialMethodCandidateAttributionResolver",
);
assert.equal(
  loopContract.experiential_method_candidate_attribution_resolver_hook.receives_selected_action,
  false,
);
assert.equal(
  loopContract.experiential_method_candidate_attribution_resolver_hook.receives_action_outcome,
  false,
);
assert.equal(
  loopContract.experiential_method_candidate_attribution_resolver_hook.causal_credit_authority,
  false,
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
const phase76EIndex = loopSource.indexOf("const experientialMethodTransferResolverView =");
const actionProposerIndex = loopSource.indexOf('"world_action_proposer"', phase76EIndex);
const phase76FCandidateIndex = loopSource.indexOf(
  "const experientialMethodCandidateAttributionResolverView =",
  actionProposerIndex,
);
const decisionPacketIndex = loopSource.indexOf("decisionPackets.push({", phase76FCandidateIndex);
assert.ok(
  phase76EIndex >= 0
    && actionProposerIndex > phase76EIndex
    && phase76FCandidateIndex > actionProposerIndex
    && decisionPacketIndex > phase76FCandidateIndex,
  "Phase76F candidate attribution must bind Phase76E methods only after Action Proposer candidates exist and before decision submission.",
);
const phase74DChoiceIndex = loopSource.indexOf(
  "buildWorldSimulationSubjectiveChoiceCommitmentReceipts({",
);
const phase76FSelectedIndex = loopSource.indexOf(
  "buildWorldSimulationSelectedExperientialMethodApplicationReceipts({",
  phase74DChoiceIndex,
);
const causalAdjudicationIndex = loopSource.indexOf(
  "const causalResolution = assertCausalResolution(await causalAdjudicator({",
  phase76FSelectedIndex,
);
assert.ok(
  phase74DChoiceIndex >= 0
    && phase76FSelectedIndex > phase74DChoiceIndex
    && causalAdjudicationIndex > phase76FSelectedIndex,
  "Phase76F selected application receipt must consume the canonical Phase74D choice before causal outcome adjudication.",
);
assert.match(loopSource, /experiential_method_candidate_attribution_projections:/);
assert.match(loopSource, /selected_experiential_method_application_receipts:/);
assert.match(stateSource, /experiential_method_candidate_attribution_projections:/);
assert.match(stateSource, /selected_experiential_method_application_receipts:/);

console.log("Phase76F experiential method application lineage tests passed.");
