import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  projectWorldSimulationPostOutcomeSubjectivePerception,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory,
} from "../../server/src/world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  formWorldSimulationSubjectiveMemories,
} from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
import {
  buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals,
  buildWorldSimulationExperienceGroundedSubjectiveLearningContract,
  buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView,
  worldSimulationExperienceGroundedSubjectiveLearningVersion,
} from "../../server/src/world-simulation-experience-grounded-subjective-learning-service.mjs";
import {
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";

const character = "伊萊亞斯・諾爾";
const turnId = "phase76c-turn-001";
const actionId = "phase76c-open-door";
const action = "推開眼前的門";
const selected = [{
  character,
  selection: "candidate_action_intent",
  action_id: actionId,
  intent: action,
}];

const phase76a = projectWorldSimulationPostOutcomeSubjectivePerception({
  turn_id: turnId,
  selected_action_intents: selected,
  action_outcomes: [{
    actor: character,
    action_id: actionId,
    result: "blocked_by_hidden_seventh_rank_seal",
    causal_evidence: "engine-only hidden seal truth",
    exact_force_newtons: 4321,
    character_experience: {
      performed: true,
      perceived_result: "門沒有打開",
      perceived_status: "受阻",
    },
  }, {
    actor: "夜",
    action_id: "phase76c-private-other-action",
    result: "other_character_private_result",
    character_experience: {
      performed: true,
      perceived_result: "只有夜自己知道的結果",
    },
  }],
  state_transitions: [],
});

const bridge = bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
  turn_id: turnId,
  selected_action_intents: selected,
  post_outcome_subjective_perception_projection: phase76a,
});

const baseWorld = {
  simulation_time: "2026-09-09T05:00:00.000Z",
  characters: { [character]: {} },
  memories: {},
};
const formation = formWorldSimulationSubjectiveMemories({
  world_state: baseWorld,
  turn_id: turnId,
  event: {
    event_id: "phase76c-event-001",
    scene_id: "phase76c-scene-001",
    simulation_time: baseWorld.simulation_time,
  },
  decision_packets: bridge.memory_formation_packets,
  encoding_decisions: [],
  episode_bindings: [],
});
assert.equal(formation.result.created_memory_count, 1);
const experienceMemory = formation.result.character_updates[0].memory_records[0];
assert.equal(experienceMemory.memory_type, "episodic_action_experience");
assert.equal(experienceMemory.source.kind, "post_outcome_subjective_experience");

const worldState = {
  ...baseWorld,
  memories: {
    [character]: [structuredClone(experienceMemory)],
  },
};
const sourceMemoryRecords = [{
  character,
  memory_record: structuredClone(experienceMemory),
}];

const contract = buildWorldSimulationExperienceGroundedSubjectiveLearningContract();
assert.equal(contract.phase, "Phase76C");
assert.equal(contract.version, worldSimulationExperienceGroundedSubjectiveLearningVersion);
assert.equal(contract.phase76b_lineage_required, true);
assert.equal(contract.canonical_phase76b_bridge_hash_verified_when_supplied, true);
assert.equal(contract.phase76b_bridge_lineage_catalog_required_for_eligibility, true);
assert.equal(contract.phase76b_bridge_lineage_catalog_exposed_to_interpreter, false);
assert.equal(contract.same_character_current_turn_memory_required, true);
assert.equal(contract.single_experience_current_situation_scope_required, true);
assert.equal(contract.interpreter_selects_bounded_assessment_only, true);
assert.equal(contract.proposition_text_engine_scoped, true);
assert.equal(contract.multi_experience_generalization_modeled, false);
assert.equal(contract.eager_semanticization_used, false);
assert.equal(contract.global_trait_or_capability_inference_modeled, false);
assert.equal(contract.numeric_reward_modeled, false);
assert.equal(contract.q_value_learning_modeled, false);
assert.equal(contract.raw_world_state_exposed, false);
assert.equal(contract.raw_action_outcome_exposed, false);
assert.equal(contract.hidden_causal_evidence_exposed, false);
assert.equal(contract.other_character_private_state_exposed, false);
assert.equal(contract.internal_memory_provenance_exposed, false);
assert.equal(contract.ordinary_phase65_claim_proposals_only, true);
assert.equal(contract.phase65_conflict_and_phase66_belief_revision_reused, true);
assert.equal(contract.parallel_belief_store_created, false);
assert.equal(contract.automatic_claim_creation_without_interpreter, false);
assert.equal(contract.direct_subjective_belief_write_allowed, false);
assert.equal(contract.direct_current_mind_write_allowed, false);
assert.equal(contract.direct_plan_or_goal_mutation_allowed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);

const resolverView = buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
  world_state: worldState,
  turn_id: turnId,
  source_memory_records: sourceMemoryRecords,
  phase76b_memory_bridge: bridge,
});
assert.equal(resolverView.version, worldSimulationExperienceGroundedSubjectiveLearningVersion);
assert.equal(resolverView.required_scope, "single_experience_current_situation");
assert.equal(resolverView.character_contexts.length, 1);
assert.equal(resolverView.character_contexts[0].character, character);
assert.equal(resolverView.character_contexts[0].experiences.length, 1);
const boundedExperience = resolverView.character_contexts[0].experiences[0];
assert.equal(boundedExperience.source_memory_ref, experienceMemory.memory_id);
assert.equal(boundedExperience.action, action);
assert.equal(boundedExperience.performed, true);
assert.equal(boundedExperience.perceived_result, "門沒有打開");
assert.equal(boundedExperience.perceived_status, "受阻");
assert.equal(boundedExperience.subjective_memory_not_world_truth, true);
assert.equal(resolverView.boundaries.phase76b_bridge_lineage_catalog_required, true);
assert.equal(resolverView.boundaries.phase76b_bridge_lineage_catalog_exposed_to_interpreter, false);
assert.equal(resolverView.boundaries.multi_experience_generalization_requested, false);
assert.equal(resolverView.boundaries.global_trait_or_capability_inference_requested, false);
assert.equal(resolverView.boundaries.numeric_reward_exposed, false);
assert.equal(resolverView.boundaries.q_value_learning_requested, false);
assert.equal(resolverView.boundaries.direct_belief_write_requested, false);
assert.equal(resolverView.boundaries.same_turn_character_brain_feedback_requested, false);

const noBridgeLineageView =
  buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
  });
assert.equal(
  noBridgeLineageView.character_contexts.length,
  0,
  "Phase76C must fail closed when the canonical current-turn Phase76B bridge lineage catalog is absent.",
);
const tamperedBridge = structuredClone(bridge);
tamperedBridge.source_entries[0].subjective_perception_hash = "tampered-lineage-hash";
assert.throws(
  () => buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
    phase76b_memory_bridge: tamperedBridge,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_PHASE76B_BRIDGE_INVALID",
  "Phase76C must reject a supplied Phase76B bridge whose immutable hash no longer matches.",
);

const serializedResolver = JSON.stringify(resolverView);
for (const hidden of [
  actionId,
  "blocked_by_hidden_seventh_rank_seal",
  "engine-only hidden seal truth",
  "4321",
  "other_character_private_result",
  "只有夜自己知道的結果",
  "phase76a_post_outcome_",
  "internal_provenance",
]) {
  assert.equal(
    serializedResolver.includes(hidden),
    false,
    `Phase76C resolver view leaked hidden/internal value: ${hidden}`,
  );
}

const interpreted = buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [{
    character,
    source_memory_ref: experienceMemory.memory_id,
    learning_kind: "action_effectiveness",
    assessment: "experience_supports_constraint",
    scope: "single_experience_current_situation",
  }, {
    character,
    source_memory_ref: experienceMemory.memory_id,
    learning_kind: "situational_capability",
    assessment: "experience_supports_constraint",
    scope: "single_experience_current_situation",
  }],
});
assert.equal(interpreted.decisions.length, 2);
assert.equal(interpreted.claim_proposals.length, 2);
assert.equal(interpreted.audit.single_experience_scope_only, true);
assert.equal(interpreted.audit.multi_experience_generalization_applied, false);
assert.equal(interpreted.audit.global_trait_or_capability_inference_applied, false);
assert.equal(interpreted.audit.phase65_claim_pipeline_reused, true);
assert.equal(interpreted.audit.phase65_phase66_belief_pipeline_reused, true);
assert.equal(interpreted.audit.parallel_belief_store_created, false);
assert.equal(interpreted.audit.numeric_reward_or_q_value_modeled, false);
assert.equal(interpreted.audit.direct_belief_write, false);
assert.equal(interpreted.audit.direct_current_mind_write, false);
assert.equal(interpreted.audit.same_turn_character_brain_feedback_triggered, false);

const effectiveness = interpreted.decisions.find(
  (decision) => decision.learning_kind === "action_effectiveness",
);
const capability = interpreted.decisions.find(
  (decision) => decision.learning_kind === "situational_capability",
);
assert.equal(
  effectiveness.proposition,
  `以「${action}」這個做法，在這次情境中似乎受到阻礙。`,
);
assert.equal(
  capability.proposition,
  `在這次情境中，我似乎無法順利進行「${action}」。`,
);
for (const proposal of interpreted.claim_proposals) {
  assert.deepEqual(
    Object.keys(proposal).sort(),
    ["character", "evidence", "proposal_ref", "proposition"],
  );
  assert.deepEqual(proposal.evidence, [{
    source_memory_ref: experienceMemory.memory_id,
    relation: "supports",
  }]);
}

const phase65 = buildWorldSimulationSubjectiveClaims({
  world_state: worldState,
  turn_id: turnId,
  source_memory_records: sourceMemoryRecords,
  claim_proposals: interpreted.claim_proposals,
});
assert.equal(phase65.result.claim_events_created.length, 2);
for (const claim of phase65.result.claim_events_created) {
  assert.equal(claim.character, character);
  assert.equal(claim.semantic_state.world_truth_verified, false);
  assert.equal(claim.semantic_state.confidence, null);
  assert.equal(claim.semantic_state.probability, null);
  assert.equal(claim.engine_audit.world_truth_authority_claimed, false);
  assert.equal(claim.engine_audit.same_turn_character_brain_feedback_allowed, false);
  assert.match(claim.derivation.proposal_ref, /^phase76c_learning_/);
  assert.deepEqual(
    claim.evidence.map((evidence) => evidence.source_memory_ref),
    [experienceMemory.memory_id],
  );
}

const ambiguous = buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [{
    character,
    source_memory_ref: experienceMemory.memory_id,
    learning_kind: "action_effectiveness",
    assessment: "experience_is_ambiguous",
    scope: "single_experience_current_situation",
  }],
});
assert.equal(
  ambiguous.decisions[0].proposition,
  `以「${action}」這個做法，在這次情境中的效果還不確定。`,
  "Phase76C must preserve uncertainty instead of forcing success/failure learning.",
);

const noDecision = buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
  resolver_view: resolverView,
  interpretation_decisions: [],
});
assert.equal(noDecision.claim_proposals.length, 0);
assert.equal(noDecision.audit.parallel_belief_store_created, false);

assert.throws(
  () => buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character,
      source_memory_ref: experienceMemory.memory_id,
      learning_kind: "action_effectiveness",
      assessment: "experience_supports_constraint",
      scope: "single_experience_current_situation",
      confidence: 0.99,
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_AUTHORITY_FIELD_FORBIDDEN",
);
assert.throws(
  () => buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character,
      source_memory_ref: experienceMemory.memory_id,
      learning_kind: "situational_capability",
      assessment: "experience_supports_constraint",
      scope: "global_capability",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_SCOPE_INVALID",
);
assert.throws(
  () => buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals({
    resolver_view: resolverView,
    interpretation_decisions: [{
      character,
      source_memory_ref: experienceMemory.memory_id,
      learning_kind: "action_effectiveness",
      assessment: "experience_supports_constraint",
      scope: "single_experience_current_situation",
    }, {
      character,
      source_memory_ref: experienceMemory.memory_id,
      learning_kind: "action_effectiveness",
      assessment: "experience_is_ambiguous",
      scope: "single_experience_current_situation",
    }],
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_DECISION_DUPLICATE",
);

const tampered = structuredClone(experienceMemory);
tampered.content.perceived_status = "竄改後狀態";
assert.throws(
  () => buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: [{ character, memory_record: tampered }],
    phase76b_memory_bridge: bridge,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_HASH_MISMATCH",
  "Phase76C must retain Phase65 canonical-memory hash verification rather than trusting supplied experience copies.",
);

const ordinaryMemory = {
  ...structuredClone(experienceMemory),
  memory_id: "phase76c-ordinary-memory",
  memory_type: "episodic_direct_perception",
  source: { kind: "direct_perception", sense: "other" },
  internal_provenance: { turn_id: turnId },
};
const ordinaryWorld = {
  ...worldState,
  memories: { [character]: [ordinaryMemory] },
};
const failClosedView = buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView({
  world_state: ordinaryWorld,
  turn_id: turnId,
  source_memory_records: [{ character, memory_record: ordinaryMemory }],
  phase76b_memory_bridge: bridge,
});
assert.equal(
  failClosedView.character_contexts.length,
  0,
  "Phase76C must fail closed for memories without authentic Phase76B action-experience lineage.",
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
const postOutcomeFormationIndex = loopSource.indexOf(
  "const postOutcomeSubjectiveMemoryFormation =",
);
const phase76cIndex = loopSource.indexOf(
  "const experienceGroundedSubjectiveLearningInterpretationResolution =",
  postOutcomeFormationIndex,
);
const phase73bIndex = loopSource.indexOf(
  "const subjectiveMeansFeasibilityInterpretationResolution =",
  phase76cIndex,
);
const genericClaimIndex = loopSource.indexOf(
  "const subjectiveClaimProposalResolution =",
  phase73bIndex,
);
const phase65Index = loopSource.indexOf(
  "const subjectiveClaimProjection =",
  genericClaimIndex,
);
assert.ok(
  postOutcomeFormationIndex >= 0
    && phase76cIndex > postOutcomeFormationIndex
    && phase73bIndex > phase76cIndex
    && genericClaimIndex > phase73bIndex
    && phase65Index > genericClaimIndex,
  "Phase76C must consume Phase76B memory after formation and feed the ordinary Phase65 claim stage.",
);
assert.match(
  loopSource.slice(phase76cIndex, phase65Index + 1000),
  /experienceGroundedSubjectiveLearningInterpretationResolution\.claim_proposals/,
);
assert.match(
  loopSource,
  /experience_grounded_subjective_learning_interpretation_resolution:/,
  "Native loop commit payload must preserve Phase76C interpretation lineage and audit.",
);
assert.match(
  stateSource,
  /experience_grounded_subjective_learning_interpretation_resolution:/,
  "Committed world history must persist Phase76C interpretation lineage and audit.",
);
assert.match(
  loopSource,
  /same_turn_character_brain_feedback_allowed:\s*false/,
);

console.log("Phase76C experience-grounded subjective learning tests passed.");
