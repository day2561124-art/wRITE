import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveChoiceCommitmentReceipts } from "../../server/src/world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { projectWorldSimulationPostOutcomeSubjectivePerception } from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView,
  projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence,
} from "../../server/src/world-simulation-post-outcome-counterfactual-alternative-evidence-service.mjs";
import {
  buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView,
  projectWorldSimulationPostOutcomeCounterfactualAppraisal,
} from "../../server/src/world-simulation-post-outcome-counterfactual-appraisal-service.mjs";
import {
  assertWorldSimulationPostOutcomeCounterfactualReflectionRetention,
  buildWorldSimulationPostOutcomeCounterfactualReflectionRetention,
  buildWorldSimulationPostOutcomeCounterfactualReflectionRetentionContract,
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
} from "../../server/src/world-simulation-post-outcome-counterfactual-reflection-retention-service.mjs";

const sessionId = "session_phase81c";
const turnId = "turn_phase81c";
const stateRevision = 22;
const worldStateHash = "world_state_hash_phase81c";
const character = "千夜";

function decisionPacket() {
  return {
    character,
    cognition: {
      goals: [{ goal: "protect_ally" }],
      values: [{ value: "avoid_unnecessary_harm" }],
      working_context: { focus: ["injured_ally", "side_passage"] },
      uncertain: [{ question: "reinforcement_timing" }],
    },
    candidate_action_intents: [
      {
        action_id: "hold_cover",
        intent: "Stay behind cover while shielding the injured ally.",
        known_costs: ["slower_progress"],
        movement: { mode: "hold_position" },
      },
      {
        action_id: "flank_side_passage",
        intent: "Use the side passage to pressure the threat from another angle.",
        prerequisites: ["side_passage_accessible"],
        known_costs: ["temporary_distance_from_ally"],
        movement: {
          mode: "side_passage",
          world_state: { secret: true },
          internal_route_id: "private-route",
          route_id: "private-route-2",
          route_hash: "private-hash",
          engine_debug: { hidden: true },
          causal_evidence: { secret: true },
        },
      },
    ],
  };
}

const selected = [{ character, selection: "candidate_action_intent", action_id: "hold_cover" }];

function receiptBundle(packet) {
  return buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [packet],
    selected_action_intents: selected,
  });
}

function phase76A() {
  return projectWorldSimulationPostOutcomeSubjectivePerception({
    turn_id: turnId,
    selected_action_intents: selected,
    action_outcomes: [{
      actor: character,
      action_id: "hold_cover",
      character_experience: {
        performed: true,
        perceived_result: "The ally stayed protected, but the threat kept its position.",
        perceived_status: "mixed_result_observed",
      },
    }],
    state_transitions: [],
  });
}

function phase81Sources(comparisonDirection = "imagined_better_than_actual") {
  const packet = decisionPacket();
  const receipt = receiptBundle(packet);
  const perception = phase76A();
  const alternativeView = buildWorldSimulationPostOutcomeCounterfactualAlternativeResolverView({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [packet],
    subjective_choice_commitment_receipts: receipt,
    post_outcome_subjective_perception_projection: perception,
  });
  const context = alternativeView.counterfactual_contexts[0];
  const alternative = context.decision_time_alternatives[0];
  const branchRefs = comparisonDirection === "comparison_unresolved"
    ? []
    : [alternative.consequence_branches[0].branch_ref];
  const alternativeEvidence = projectWorldSimulationPostOutcomeCounterfactualAlternativeEvidence({
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
    decision_packets: [packet],
    subjective_choice_commitment_receipts: receipt,
    post_outcome_subjective_perception_projection: perception,
    resolver_view: alternativeView,
    counterfactual_decisions: [{
      counterfactual_context_ref: context.counterfactual_context_ref,
      alternative_action_ref: alternative.alternative_action_ref,
      alternative_branch_refs: branchRefs,
      comparison_direction: comparisonDirection,
    }],
  });
  const appraisalView = buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
    counterfactual_alternative_resolver_view: alternativeView,
    post_outcome_counterfactual_alternative_evidence: alternativeEvidence,
  });
  const appraisalContext = appraisalView.appraisal_contexts[0];
  const appraisalDecision = comparisonDirection === "imagined_better_than_actual"
    ? {
        counterfactual_evidence_ref: appraisalContext.counterfactual_evidence_ref,
        appraisal_kind: "regret_like_counterfactual_concern",
        preparative_orientation: "future_improvement_candidate",
        salient_branch_refs: [appraisalContext.imagined_alternative.supporting_branch_refs[0]],
      }
    : comparisonDirection === "imagined_worse_than_actual"
      ? {
          counterfactual_evidence_ref: appraisalContext.counterfactual_evidence_ref,
          appraisal_kind: "relief_like_counterfactual_contrast",
          preparative_orientation: "current_choice_reassurance_candidate",
          salient_branch_refs: [appraisalContext.imagined_alternative.supporting_branch_refs[0]],
        }
      : {
          counterfactual_evidence_ref: appraisalContext.counterfactual_evidence_ref,
          appraisal_kind: "reflective_uncertainty",
          preparative_orientation: "no_preparative_takeaway",
          salient_branch_refs: [],
        };
  const appraisal = projectWorldSimulationPostOutcomeCounterfactualAppraisal({
    counterfactual_alternative_resolver_view: alternativeView,
    post_outcome_counterfactual_alternative_evidence: alternativeEvidence,
    resolver_view: appraisalView,
    appraisal_decisions: [appraisalDecision],
  });
  return {
    alternativeView,
    alternativeEvidence,
    appraisalView,
    appraisal,
  };
}

function retain(source) {
  return buildWorldSimulationPostOutcomeCounterfactualReflectionRetention({
    counterfactual_alternative_resolver_view: source.alternativeView,
    post_outcome_counterfactual_alternative_evidence: source.alternativeEvidence,
    counterfactual_appraisal_resolver_view: source.appraisalView,
    post_outcome_counterfactual_appraisal: source.appraisal,
  });
}

const contract = buildWorldSimulationPostOutcomeCounterfactualReflectionRetentionContract();
assert.equal(contract.phase, "Phase81C");
assert.equal(contract.counterfactual_capsule_is_not_episodic_fact_memory, true);
assert.equal(contract.source_monitoring_boundary_explicit, true);
assert.equal(contract.unchosen_outcome_observed, false);
assert.equal(contract.automatic_preference_revision_performed, false);
assert.equal(contract.automatic_action_selection_performed, false);
assert.equal(contract.automatic_belief_revision_performed, false);
assert.equal(contract.semantic_revision_performed, false);
assert.equal(contract.subjective_memory_rewrite_performed, false);
assert.equal(contract.same_turn_reentry_allowed, false);

const upward = phase81Sources("imagined_better_than_actual");
const retainedUpward = retain(upward);
assert.equal(
  retainedUpward.version,
  worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
);
assert.equal(retainedUpward.capsule_count, 1);
assert.equal(retainedUpward.audit.actual_and_imagined_sources_explicitly_separated, true);
assert.equal(retainedUpward.audit.counterfactual_capsules_are_episodic_fact_memories, false);
assert.equal(retainedUpward.persistence_boundary.future_reentry_requires_separate_projection, true);
const regretCapsule = retainedUpward.capsules[0];
assert.equal(regretCapsule.appraisal_kind, "regret_like_counterfactual_concern");
assert.equal(regretCapsule.preparative_orientation, "future_improvement_candidate");
assert.equal(regretCapsule.actual_experienced_anchor.source_kind, "experienced_subjective_outcome");
assert.equal(
  regretCapsule.imagined_alternative_context.source_kind,
  "imagined_decision_time_possibility",
);
assert.equal(regretCapsule.source_monitoring.sources_may_not_be_collapsed, true);
assert.equal(regretCapsule.counterfactual_capsule_is_episodic_fact_memory, false);
assert.equal(regretCapsule.unchosen_outcome_observed, false);
assert.equal(regretCapsule.counterfactual_world_truth_claimed, false);
assert.equal(regretCapsule.causal_superiority_inferred, false);
assert.equal(regretCapsule.automatic_preference_revision_performed, false);
assert.equal(regretCapsule.action_selected, false);
assert.equal(regretCapsule.belief_revision_performed, false);
assert.equal(regretCapsule.semantic_revision_performed, false);
assert.equal(regretCapsule.subjective_memory_rewrite_performed, false);
assert.equal(regretCapsule.world_state_mutated, false);
assert.equal(regretCapsule.same_turn_reentry_allowed, false);
assert.equal(regretCapsule.imagined_alternative_context.salient_branches.length, 1);
assert.deepEqual(
  regretCapsule.imagined_alternative_context.salient_branch_refs,
  regretCapsule.imagined_alternative_context.salient_branches.map((branch) => branch.branch_ref),
);
assert.match(
  regretCapsule.imagined_alternative_context.decision_time_candidate.intent,
  /side passage/i,
);
const serializedRetainedCandidate = JSON.stringify(
  regretCapsule.imagined_alternative_context.decision_time_candidate,
);
for (const privateValue of [
  "world_state",
  "internal_route_id",
  "route_id",
  "route_hash",
  "engine_debug",
  "causal_evidence",
  "private-route",
  "private-hash",
]) {
  assert.equal(
    serializedRetainedCandidate.includes(privateValue),
    false,
    `Phase81C must not retain private candidate payload ${privateValue}.`,
  );
}

const downward = retain(phase81Sources("imagined_worse_than_actual"));
assert.equal(downward.capsules[0].appraisal_kind, "relief_like_counterfactual_contrast");
assert.equal(
  downward.capsules[0].preparative_orientation,
  "current_choice_reassurance_candidate",
);

const unresolved = retain(phase81Sources("comparison_unresolved"));
assert.equal(unresolved.capsules[0].appraisal_kind, "reflective_uncertainty");
assert.equal(unresolved.capsules[0].preparative_orientation, "no_preparative_takeaway");
assert.deepEqual(unresolved.capsules[0].imagined_alternative_context.salient_branch_refs, []);
assert.deepEqual(unresolved.capsules[0].imagined_alternative_context.salient_branches, []);

assert.doesNotThrow(() => assertWorldSimulationPostOutcomeCounterfactualReflectionRetention(
  retainedUpward,
  {
    world_simulation_session_id: sessionId,
    turn_id: turnId,
    state_revision: stateRevision,
    world_state_hash: worldStateHash,
  },
));

const tamperedProjectionSource = phase81Sources();
tamperedProjectionSource.appraisal = structuredClone(tamperedProjectionSource.appraisal);
tamperedProjectionSource.appraisal.counterfactual_appraisals[0].preparative_orientation =
  "no_preparative_takeaway";
assert.throws(
  () => retain(tamperedProjectionSource),
  (error) => error?.code
    === "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_HASH_MISMATCH",
);

const staleViewSource = phase81Sources();
staleViewSource.appraisalView = structuredClone(staleViewSource.appraisalView);
staleViewSource.appraisalView.appraisal_contexts[0].imagined_alternative.decision_time_candidate.intent =
  "tampered alternative";
delete staleViewSource.appraisalView.resolver_view_hash;
staleViewSource.appraisalView.resolver_view_hash = hashAgentRunValue(staleViewSource.appraisalView);
assert.throws(
  () => retain(staleViewSource),
  (error) => error?.code === "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_VIEW_STALE",
);

const emptySource = phase81Sources();
emptySource.appraisal = projectWorldSimulationPostOutcomeCounterfactualAppraisal({
  counterfactual_alternative_resolver_view: emptySource.alternativeView,
  post_outcome_counterfactual_alternative_evidence: emptySource.alternativeEvidence,
  resolver_view: emptySource.appraisalView,
  appraisal_decisions: [],
});
const emptyRetention = retain(emptySource);
assert.equal(emptyRetention.capsule_count, 0);
assert.deepEqual(emptyRetention.capsules, []);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationPostOutcomeCounterfactualReflectionRetention/);
assert.match(loopSource, /post_outcome_counterfactual_reflection_retention:/);
assert.match(stateSource, /post_outcome_counterfactual_reflection_retention:/);
assert.equal(
  stateSource.includes("counterfactual_appraisal_resolver_view:"),
  false,
  "Phase81C must not persist the ephemeral Phase81B resolver view.",
);
assert.equal(
  stateSource.includes("counterfactual_alternative_resolver_view:"),
  false,
  "Phase81C must not persist the ephemeral Phase81A resolver view.",
);

console.log("Phase81C counterfactual reflection retention capsule tests passed.");
