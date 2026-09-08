import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
import {
  projectRoot,
} from "../../server/src/project-paths.mjs";
import {
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import {
  beginWorldSimulationSession,
} from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimConflictRevisions,
} from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefResolutionContract,
  resolveWorldSimulationSubjectiveBeliefs,
  subjectiveBeliefResolutionDecisionSchemaVersion,
  worldSimulationSubjectiveBeliefResolutionVersion,
} from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";

const character = "伊萊亞斯・諾爾";
const priorTurnId = "world_turn_phase65d_prior";
const currentTurnId = "world_turn_phase65d_current";

function memoryFixture(memoryId, turnId, description) {
  return {
    memory_id: memoryId,
    memory_type: "episodic_direct_perception",
    content: {
      kind: "visual_observation",
      description,
    },
    source: {
      kind: "direct_perception",
      sense: "visual",
    },
    internal_provenance: {
      event_id: `event_${memoryId}`,
      scene_id: "scene_phase65d",
      turn_id: turnId,
      observation_hash: `observation_${memoryId}`,
      formation_version: "phase63a-subjective-memory-formation-v1",
    },
    formation_stage: "encoded_unconsolidated",
    engine_persisted_trace: true,
    last_recalled_at: null,
    accessible: true,
    suppressed: false,
    possibly_incorrect: false,
    source_confused: false,
    subjective_memory_not_world_truth: true,
  };
}

const priorMemory = memoryFixture(
  "memory_phase65d_prior",
  priorTurnId,
  "先前看見阿灰在伊萊亞斯抬手後改變方向。",
);
const currentMemoryA = memoryFixture(
  "memory_phase65d_current_a",
  currentTurnId,
  "這次看見阿灰在沒有明顯手勢時自行改變方向。",
);
const currentMemoryB = memoryFixture(
  "memory_phase65d_current_b",
  currentTurnId,
  "同一回合也看見阿灰在伊萊亞斯視線轉開時改變方向。",
);

const baseWorldState = {
  simulation_time: "2026-09-06T17:30:00+08:00",
  memories: {
    [character]: [
      priorMemory,
      currentMemoryA,
      currentMemoryB,
    ],
  },
};

function executeClaimProjection(
  worldState,
  turnId,
  sourceMemories,
  proposals,
) {
  const projection = buildWorldSimulationSubjectiveClaims({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records:
      sourceMemories.map((memory) => ({
        character,
        memory_record: memory,
      })),
    claim_proposals: proposals,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_claim`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: projection.result.preview_world_state,
    queue,
  });
  return {
    projection,
    world_state: execution.next_world_state,
  };
}

function executeRelationProjection(
  worldState,
  turnId,
  proposals,
) {
  const projection = buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: worldState,
    turn_id: turnId,
    relation_proposals: proposals,
  });
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_claim_relation`,
    world_state_hash: hashAgentRunValue(worldState),
    state_transitions: projection.result.state_transitions,
    elapsed_ms: 0,
  });
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: worldState,
    preview_world_state: projection.result.preview_world_state,
    queue,
  });
  return {
    projection,
    world_state: execution.next_world_state,
  };
}

const priorClaimBuild = executeClaimProjection(
  baseWorldState,
  priorTurnId,
  [priorMemory],
  [
    {
      proposal_ref: "phase65d-prior-directed-control",
      character,
      proposition:
        "阿灰的方向變化可能依賴伊萊亞斯的有意識指令。",
      evidence: [
        {
          source_memory_ref: priorMemory.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const priorClaim =
  priorClaimBuild.projection.result.claim_events_created[0];

const currentClaimBuild = executeClaimProjection(
  priorClaimBuild.world_state,
  currentTurnId,
  [currentMemoryA, currentMemoryB],
  [
    {
      proposal_ref: "phase65d-current-autonomy-a",
      character,
      proposition:
        "阿灰可能具有不依賴伊萊亞斯明顯有意識指令的自主行動能力。",
      evidence: [
        {
          source_memory_ref: currentMemoryA.memory_id,
          relation: "supports",
        },
      ],
    },
    {
      proposal_ref: "phase65d-current-autonomy-b",
      character,
      proposition:
        "阿灰的自主移動可能在伊萊亞斯沒有注意時仍然發生。",
      evidence: [
        {
          source_memory_ref: currentMemoryB.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const currentClaims =
  currentClaimBuild.projection.result.claim_events_created;
const currentClaimA = currentClaims.find(
  (event) =>
    event.derivation.proposal_ref
      === "phase65d-current-autonomy-a",
);
const currentClaimB = currentClaims.find(
  (event) =>
    event.derivation.proposal_ref
      === "phase65d-current-autonomy-b",
);
const worldStateWithClaims = currentClaimBuild.world_state;

assert.ok(priorClaim);
assert.ok(currentClaimA);
assert.ok(currentClaimB);

const contract = buildWorldSimulationSubjectiveBeliefResolutionContract();
assert.equal(
  contract.version,
  worldSimulationSubjectiveBeliefResolutionVersion,
);
assert.equal(contract.phase, "Phase65D");
assert.equal(
  contract.status,
  "evidence_grounded_subjective_belief_resolution_installed",
);
assert.equal(contract.engine_owned_resolution, true);
assert.equal(contract.deterministic_resolution_required, true);
assert.equal(contract.finite_claim_base_used, true);
assert.equal(contract.explicit_relation_locality_required, true);
assert.equal(contract.hidden_semantic_graph_traversal_allowed, false);
assert.equal(contract.unopposed_current_turn_claim_may_be_adopted, true);
assert.equal(contract.challenge_implies_supersession, false);
assert.equal(contract.challenge_auto_invalidates_target, false);
assert.equal(contract.single_unambiguous_supersession_may_resolve, true);
assert.equal(contract.competing_superseders_remain_unresolved, true);
assert.equal(contract.same_turn_ordering_is_epistemic_authority, false);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.historical_claim_mutation_allowed, false);
assert.equal(contract.historical_relation_mutation_allowed, false);
assert.equal(contract.world_state_mutation_allowed, false);
assert.equal(contract.belief_revision_persistence_installed, false);
assert.equal(contract.effective_belief_projection_installed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.retrieval_frequency_counts_as_credibility, false);
assert.equal(contract.accessibility_strength_counts_as_credibility, false);
assert.equal(contract.plasticity_strength_counts_as_truth_support, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.native_world_loop_adoption_installed, true);
assert.equal(contract.durable_revision_owner, "Phase66");
assert.deepEqual(
  contract.v1_emitted_resolution_actions,
  ["adopt", "supersede", "unresolved"],
);

// 1. Unopposed evidence-backed current-turn claims are adopted without
// pretending that adoption is world truth or a durable Phase66 revision.
const unopposedSnapshot = structuredClone(worldStateWithClaims);
const unopposed = resolveWorldSimulationSubjectiveBeliefs({
  world_state: worldStateWithClaims,
  turn_id: currentTurnId,
});
assert.equal(unopposed.ok, true);
assert.equal(
  unopposed.version,
  worldSimulationSubjectiveBeliefResolutionVersion,
);
assert.equal(unopposed.result.current_turn_claim_count, 2);
assert.equal(unopposed.result.current_turn_relation_count, 0);
assert.equal(unopposed.result.decision_count, 2);
assert.deepEqual(
  unopposed.result.decisions.map((decision) => decision.action),
  ["adopt", "adopt"],
);
assert.deepEqual(
  unopposed.result.decisions.map((decision) => decision.commitment),
  ["active", "active"],
);
assert.deepEqual(
  worldStateWithClaims,
  unopposedSnapshot,
  "Phase65D must be a pure resolution layer and must not mutate world state",
);

for (const decision of unopposed.result.decisions) {
  assert.equal(
    decision.schema_version,
    subjectiveBeliefResolutionDecisionSchemaVersion,
  );
  assert.equal(decision.subjective_not_world_truth, true);
  assert.equal(decision.confidence, null);
  assert.equal(decision.probability, null);
  assert.equal(
    decision.derivation.hidden_semantic_graph_traversal_used,
    false,
  );
  assert.equal(
    decision.derivation.deterministic_sort_used_as_epistemic_precedence,
    false,
  );
  assert.equal(decision.engine_audit.world_state_mutation_applied, false);
  assert.equal(decision.engine_audit.world_truth_authority_claimed, false);
  assert.equal(decision.engine_audit.last_write_wins_applied, false);
  assert.equal(
    decision.engine_audit.same_turn_character_brain_feedback_allowed,
    false,
  );
  const body = structuredClone(decision);
  delete body.decision_hash;
  assert.equal(decision.decision_hash, hashAgentRunValue(body));
}
assert.equal(unopposed.result.audit.world_truth_fields_consumed, false);
assert.equal(unopposed.result.audit.confidence_probability_modeled, false);
assert.equal(unopposed.result.audit.durable_belief_revision_persisted, false);
assert.equal(unopposed.result.audit.phase66_required_for_durable_revision, true);

// Changing unrelated objective/world-truth-like fields cannot change the
// resolver output: Phase65D consumes only the validated claim/relation base.
const worldStateWithUnrelatedTruth = structuredClone(worldStateWithClaims);
worldStateWithUnrelatedTruth.authoritative_world_truth_fixture = {
  actual_control_mode: "engine_only_secret",
  truth_probability: 1,
};
const unrelatedTruthResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: worldStateWithUnrelatedTruth,
  turn_id: currentTurnId,
});
assert.deepEqual(
  unrelatedTruthResolution.result.decisions,
  unopposed.result.decisions,
  "objective world fields must not influence subjective belief resolution",
);

// 2. Challenge is not supersession. Both explicit claims remain competing and
// the resolver produces unresolved evidence instead of choosing a winner.
const challengeBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase65d-challenge-prior",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "challenges",
    },
  ],
);
const challengeStateSnapshot = structuredClone(challengeBuild.world_state);
const challengeResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: challengeBuild.world_state,
  turn_id: currentTurnId,
});
const challengeDecision = challengeResolution.result.decisions.find(
  (decision) =>
    decision.reason === "explicit_challenge_preserves_competing_claims",
);
assert.ok(challengeDecision);
assert.equal(challengeDecision.action, "unresolved");
assert.equal(challengeDecision.commitment, "unresolved");
assert.ok(
  challengeDecision.claim_event_ids.includes(currentClaimA.claim_event_id),
);
assert.ok(
  challengeDecision.claim_event_ids.includes(priorClaim.claim_event_id),
);
assert.equal(
  challengeResolution.result.decisions.some(
    (decision) => decision.action === "supersede",
  ),
  false,
  "challenge alone must never supersede or invalidate its target",
);
assert.deepEqual(
  challengeBuild.world_state,
  challengeStateSnapshot,
  "resolution must not rewrite challenge state",
);

// 3. One structurally unambiguous current-turn superseder may yield an adopt
// decision for its evidence-backed source and a supersede decision for the
// prior claim. The historical claim itself remains immutable.
const singleSupersessionBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase65d-single-supersession",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const priorClaimSnapshot = structuredClone(
  singleSupersessionBuild.world_state.subjective_claim_events[
    priorClaim.claim_event_id
  ],
);
const singleSupersessionResolution =
  resolveWorldSimulationSubjectiveBeliefs({
    world_state: singleSupersessionBuild.world_state,
    turn_id: currentTurnId,
  });
const supersedeDecision =
  singleSupersessionResolution.result.decisions.find(
    (decision) => decision.action === "supersede",
  );
const supersessionSourceAdoption =
  singleSupersessionResolution.result.decisions.find(
    (decision) =>
      decision.action === "adopt"
      && decision.claim_event_ids.includes(currentClaimA.claim_event_id),
  );
assert.ok(supersedeDecision);
assert.ok(supersessionSourceAdoption);
assert.equal(supersedeDecision.commitment, "superseded");
assert.equal(supersessionSourceAdoption.commitment, "active");
assert.equal(
  supersedeDecision.reason,
  "single_unambiguous_explicit_supersession",
);
assert.deepEqual(
  singleSupersessionBuild.world_state.subjective_claim_events[
    priorClaim.claim_event_id
  ],
  priorClaimSnapshot,
  "supersession decision must not rewrite the historical claim",
);

// 4/5. Multiple superseders targeting the same prior claim remain unresolved.
// Reversing relation-history serialization cannot select a winner.
const competingSupersessionBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase65d-competing-supersession-a",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
    {
      proposal_ref: "phase65d-competing-supersession-b",
      character,
      source_claim_event_id: currentClaimB.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const competingResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: competingSupersessionBuild.world_state,
  turn_id: currentTurnId,
});
assert.equal(
  competingResolution.result.decisions.some(
    (decision) => decision.action === "supersede",
  ),
  false,
);
assert.equal(
  competingResolution.result.decisions.some(
    (decision) => decision.action === "adopt",
  ),
  false,
  "competing superseders must not be adopted by serialization order",
);
assert.equal(competingResolution.result.decisions.length, 1);
assert.equal(competingResolution.result.decisions[0].action, "unresolved");
assert.equal(
  competingResolution.result.decisions[0].reason,
  "multiple_competing_superseders_preserved_without_precedence",
);
assert.deepEqual(
  competingResolution.result.decisions[0].claim_event_ids,
  [
    currentClaimA.claim_event_id,
    currentClaimB.claim_event_id,
    priorClaim.claim_event_id,
  ].sort(),
);

const reversedHistoryState = structuredClone(
  competingSupersessionBuild.world_state,
);
reversedHistoryState.subjective_claim_relation_history = [
  ...reversedHistoryState.subjective_claim_relation_history,
].reverse();
const reversedResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: reversedHistoryState,
  turn_id: currentTurnId,
});
assert.deepEqual(
  reversedResolution.result.decisions,
  competingResolution.result.decisions,
  "history ordering may serialize evidence but must never become epistemic precedence",
);
assert.equal(
  reversedResolution.result.audit.deterministic_sort_used_as_epistemic_precedence,
  false,
);
assert.equal(reversedResolution.result.audit.last_write_wins_applied, false);

// A source or target participating in an explicit challenge cannot use an
// otherwise single supersession as an automatic escape hatch.
const challengedSupersessionBuild = executeRelationProjection(
  worldStateWithClaims,
  currentTurnId,
  [
    {
      proposal_ref: "phase65d-challenged-source",
      character,
      source_claim_event_id: currentClaimB.claim_event_id,
      target_claim_event_id: currentClaimA.claim_event_id,
      relation: "challenges",
    },
    {
      proposal_ref: "phase65d-challenged-supersession",
      character,
      source_claim_event_id: currentClaimA.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const challengedSupersessionResolution =
  resolveWorldSimulationSubjectiveBeliefs({
    world_state: challengedSupersessionBuild.world_state,
    turn_id: currentTurnId,
  });
assert.equal(
  challengedSupersessionResolution.result.decisions.some(
    (decision) => decision.action === "supersede",
  ),
  false,
);
assert.ok(
  challengedSupersessionResolution.result.decisions.some(
    (decision) =>
      decision.reason
        === "supersession_participant_is_explicitly_challenged",
  ),
);

// 6/7. Historical claim and relation stores are input evidence only.
const immutableInputSnapshot = structuredClone(
  competingSupersessionBuild.world_state,
);
resolveWorldSimulationSubjectiveBeliefs({
  world_state: competingSupersessionBuild.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  competingSupersessionBuild.world_state,
  immutableInputSnapshot,
);

// 8. A forged cross-character relation is rejected even when its own event
// hash and history reference are recomputed consistently.
const crossCharacterState = structuredClone(challengeBuild.world_state);
const crossCharacterReference =
  crossCharacterState.subjective_claim_relation_history[0];
const crossCharacterEvent =
  crossCharacterState.subjective_claim_relation_events[
    crossCharacterReference.relation_event_id
  ];
crossCharacterEvent.character = "另一名角色";
const crossCharacterBody = structuredClone(crossCharacterEvent);
delete crossCharacterBody.relation_event_hash;
crossCharacterEvent.relation_event_hash = hashAgentRunValue(crossCharacterBody);
crossCharacterReference.character = crossCharacterEvent.character;
crossCharacterReference.relation_event_hash =
  crossCharacterEvent.relation_event_hash;
assert.throws(
  () =>
    resolveWorldSimulationSubjectiveBeliefs({
      world_state: crossCharacterState,
      turn_id: currentTurnId,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CHARACTER_MISMATCH",
);

// 9. Immutable claim hashes are independently verified at the resolution
// boundary instead of trusting Phase65A/65B merely because they ran earlier.
const tamperedClaimState = structuredClone(worldStateWithClaims);
tamperedClaimState.subjective_claim_events[
  currentClaimA.claim_event_id
].proposition = "tampered proposition";
assert.throws(
  () =>
    resolveWorldSimulationSubjectiveBeliefs({
      world_state: tamperedClaimState,
      turn_id: currentTurnId,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_BELIEF_RESOLUTION_CLAIM_HASH_MISMATCH",
);

// 10/11/12. The resolver does not consume objective truth, retrieval
// frequency, accessibility strength, plasticity, or invent probabilities.
for (const decision of competingResolution.result.decisions) {
  assert.equal(decision.subjective_not_world_truth, true);
  assert.equal(decision.confidence, null);
  assert.equal(decision.probability, null);
  assert.equal(
    decision.engine_audit.retrieval_frequency_used_as_credibility,
    false,
  );
  assert.equal(
    decision.engine_audit.accessibility_strength_used_as_credibility,
    false,
  );
  assert.equal(
    decision.engine_audit.plasticity_strength_used_as_truth_support,
    false,
  );
}

// 14/15. Same exact evidence deterministically reprojects. With no current
// claims there is no guessed synthetic belief state.
const deterministicReplay = resolveWorldSimulationSubjectiveBeliefs({
  world_state: competingSupersessionBuild.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  deterministicReplay,
  competingResolution,
);
const noCurrentClaimResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: priorClaimBuild.world_state,
  turn_id: currentTurnId,
});
assert.equal(noCurrentClaimResolution.result.current_turn_claim_count, 0);
assert.equal(noCurrentClaimResolution.result.decision_count, 0);
assert.deepEqual(noCurrentClaimResolution.result.decisions, []);

// Native adoption / same-turn feedback boundary. The resolver lives inside
// resolveWorldSimulationTurn, which runs only after Character Brain selection,
// and the committed history stores resolution evidence without adding any
// durable belief store to world state.
const loopSource = await readFile(
  new URL(
    "../../server/src/world-simulation-loop-service.mjs",
    import.meta.url,
  ),
  "utf8",
);
const stateSource = await readFile(
  new URL(
    "../../server/src/world-simulation-state-service.mjs",
    import.meta.url,
  ),
  "utf8",
);
for (const anchor of [
  "buildWorldSimulationSubjectiveBeliefResolutionContract",
  "const subjectiveBeliefResolution =",
  "resolveWorldSimulationSubjectiveBeliefs({",
  "subjective_belief_resolution:",
  "phase66_required_for_durable_revision",
]) {
  assert.ok(loopSource.includes(anchor), `native loop must contain ${anchor}`);
}
assert.ok(
  stateSource.includes("subjective_belief_resolution:"),
  "world history must preserve Phase65D decision evidence",
);

const relationExecutionIndex = loopSource.indexOf(
  "const subjectiveClaimRelationMutationExecution =",
);
const beliefResolutionIndex = loopSource.indexOf(
  "const subjectiveBeliefResolution =",
);
const commitIndex = loopSource.indexOf(
  "const committed = await commitWorldSimulationTurn",
);
assert.ok(relationExecutionIndex >= 0);
assert.ok(beliefResolutionIndex > relationExecutionIndex);
assert.ok(commitIndex > beliefResolutionIndex);
assert.ok(
  loopSource.includes(
    "next_world_state: goalUnattainabilityMutationExecution.next_world_state",
  ),
  "Phase66A may extend the committed world state only through the authoritative Phase62K mutation executor",
);
assert.ok(
  loopSource.includes("buildWorldSimulationSubjectiveBeliefRevisions({"),
  "Phase66A must consume Phase65D decisions after pure resolution",
);
const runCharacterTurnIndex = loopSource.lastIndexOf(
  "selections[packet.character] = await characterRuntimeManager.runCharacterTurn",
);
const resolveTurnCallIndex = loopSource.lastIndexOf(
  "return resolveWorldSimulationTurn(",
);
assert.ok(runCharacterTurnIndex >= 0);
assert.ok(resolveTurnCallIndex > runCharacterTurnIndex);
assert.ok(
  beliefResolutionIndex < runCharacterTurnIndex,
  "Phase65D implementation is inside resolveWorldSimulationTurn, which is invoked only after Character Brain completes",
);

const nativeFixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `phase65d-belief-resolution-${process.pid}-${Date.now()}`,
);
const nativeOptions = {
  fixtureRoot: nativeFixtureRoot,
};
const nativeObserver = "phase65d-native-observer";
const nativeTarget = "phase65d-native-target";
const nativeSceneId = "phase65d-native-scene";
const nativeEventId = "phase65d-native-event";
const nativeClaimText =
  "眼前生物可能在沒有可見外部指令時自行改變移動方向。";

const nativeWorldState = {
  simulation_time: "2026-09-06T18:00:00+08:00",
  world_rules: {
    default_vision_range_m: 30,
  },
  event_queue: [
    {
      event_id: nativeEventId,
      type: "observe_possible_autonomy",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
  ],
  scenes: {
    [nativeSceneId]: {
      scene_id: nativeSceneId,
      dimensions: {
        width_m: 10,
        depth_m: 10,
      },
      entity_positions: {
        [nativeObserver]: { x: 0, y: 0 },
        [nativeTarget]: { x: 3, y: 0 },
      },
      visibility_profiles: {
        [nativeObserver]: {
          facing_degrees: 0,
          horizontal_fov_degrees: 120,
          eye_height_m: 1.6,
          illumination_thresholds_lux: {
            silhouette_min_lux: 1,
            dim_min_lux: 5,
            clear_min_lux: 20,
          },
        },
        [nativeTarget]: {
          height_m: 1.0,
        },
      },
      perception_labels_by: {
        [nativeObserver]: {
          [nativeTarget]:
            "眼前生物在沒有新的可見手勢時改變了移動方向。",
        },
      },
      lighting: {
        ambient_lux: 30,
      },
      audibility_profiles: {
        [nativeObserver]: {
          minimum_audible_db: 30,
          localization_min_margin_db: 6,
          localization_sectors: 4,
        },
      },
      sound_events: [],
      auditory_labels_by: {
        [nativeObserver]: {},
      },
      obstacles: [],
    },
  },
  characters: {
    [nativeObserver]: {
      current_action: "持續觀察",
      known: [],
    },
    [nativeTarget]: {},
  },
  memories: {
    [nativeObserver]: [],
  },
  objects: {},
  available_actions: {
    [nativeObserver]: [
      {
        action_id: "continue-observing",
        intent: "維持位置並繼續觀察",
      },
    ],
  },
};

function nativeNoOpAdjudicator(input) {
  const next = structuredClone(input.world_state);
  next.event_queue = next.event_queue.slice(1);
  return {
    causal_resolution_id: `phase65d-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [
      {
        actor: nativeObserver,
        action_id: "continue-observing",
        result: "continued_observing",
        causal_evidence:
          "Phase65D fixture changes only event queue consumption",
      },
    ],
    knowledge_transitions: [],
    scheduled_events: [],
  };
}

await rm(
  nativeFixtureRoot,
  {
    recursive: true,
    force: true,
  },
);

try {
  const nativeSession = await beginWorldSimulationSession(
    {
      simulation_label: "Phase65D native belief resolution fixture",
      seed: "phase65d-native-belief-resolution",
      rules: {
        event_driven: true,
        persistent_causality: true,
      },
      initial_world_state: nativeWorldState,
    },
    nativeOptions,
  );

  let claimResolverCallCount = 0;
  let relationResolverCallCount = 0;
  let brainCallCount = 0;

  const nativeTurn = await runWorldSimulationTurn(
    {
      world_simulation_session_id:
        nativeSession.world_simulation_session_id,
      event_id: nativeEventId,
    },
    {
      ...nativeOptions,
      subjectiveClaimResolver:
        async (input) => {
          claimResolverCallCount += 1;
          assert.equal(input.character_evidence.length, 1);
          const sourceMemory =
            input.character_evidence[0].memories[0];
          assert.ok(sourceMemory);
          return [
            {
              proposal_ref: "native-phase65d-unopposed-claim",
              character: nativeObserver,
              proposition: nativeClaimText,
              evidence: [
                {
                  source_memory_ref: sourceMemory.source_memory_ref,
                  relation: "supports",
                },
              ],
            },
          ];
        },
      subjectiveClaimRelationResolver:
        async () => {
          relationResolverCallCount += 1;
          return [];
        },
      characterBrain:
        async (packet) => {
          brainCallCount += 1;
          const serialized = JSON.stringify(packet);
          assert.equal(
            serialized.includes(nativeClaimText),
            false,
            "same-turn Phase65D resolution cannot feed Character Brain",
          );
          assert.equal(
            serialized.includes("subjective_belief_resolution"),
            false,
          );
          assert.deepEqual(
            packet.cognition.subjective_cognition.claims,
            [],
          );
          assert.equal(
            packet.boundaries
              .subjective_cognition_same_turn_claim_feedback_allowed,
            false,
          );
          return {
            action_id: "continue-observing",
          };
        },
      causalAdjudicator: nativeNoOpAdjudicator,
    },
  );

  assert.equal(nativeTurn.ok, true);
  assert.equal(nativeTurn.committed, true);
  assert.equal(claimResolverCallCount, 1);
  assert.equal(relationResolverCallCount, 1);
  assert.equal(brainCallCount, 1);
  assert.equal(nativeTurn.subjective_belief_resolution.decision_count, 1);
  assert.equal(
    nativeTurn.subjective_belief_resolution.unresolved_decision_count,
    0,
  );
  assert.equal(nativeTurn.subjective_belief_resolution.pure_resolution, true);
  assert.equal(
    nativeTurn.subjective_belief_resolution
      .durable_belief_revision_persisted,
    false,
  );
  assert.equal(
    nativeTurn.subjective_belief_resolution
      .same_turn_character_brain_feedback_allowed,
    false,
  );

  const nativeState = await getWorldSimulationState(
    nativeSession.world_simulation_session_id,
    nativeOptions,
  );
  assert.equal(
    Object.keys(nativeState.state.subjective_claim_events).length,
    1,
  );
  for (const forbiddenDurableField of [
    "subjective_beliefs",
    "subjective_belief_events",
    "effective_beliefs",
    "effective_subjective_beliefs",
  ]) {
    assert.equal(
      Object.hasOwn(nativeState.state, forbiddenDurableField),
      false,
      `Phase65D must not install Phase66 durable field ${forbiddenDurableField}`,
    );
  }

  const nativeHistory = await getWorldSimulationHistory(
    nativeSession.world_simulation_session_id,
    nativeOptions,
  );
  assert.equal(nativeHistory.turns.length, 1);
  const committedResolution =
    nativeHistory.turns[0].subjective_belief_resolution;
  assert.equal(
    committedResolution.version,
    worldSimulationSubjectiveBeliefResolutionVersion,
  );
  assert.equal(committedResolution.result.decision_count, 1);
  assert.equal(
    committedResolution.result.decisions[0].action,
    "adopt",
  );
  assert.equal(
    committedResolution.result.decisions[0].commitment,
    "active",
  );
  assert.equal(
    committedResolution.result.audit.durable_belief_revision_persisted,
    false,
  );
} finally {
  await rm(
    nativeFixtureRoot,
    {
      recursive: true,
      force: true,
    },
  );
}

console.log("Phase65D evidence-grounded subjective belief resolution tests passed.");
