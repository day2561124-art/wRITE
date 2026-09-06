import assert from "node:assert/strict";

import {
  hashAgentRunValue,
} from "../../server/src/agent-run-service.mjs";
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
  resolveWorldSimulationSubjectiveBeliefs,
} from "../../server/src/world-simulation-subjective-belief-resolution-service.mjs";
import {
  buildWorldSimulationSubjectiveBeliefRevisions,
} from "../../server/src/world-simulation-subjective-belief-revision-service.mjs";
import {
  buildWorldSimulationEffectiveSubjectiveBeliefProjectionContract,
  effectiveSubjectiveBeliefEntrySchemaVersion,
  projectWorldSimulationEffectiveSubjectiveBeliefs,
  worldSimulationEffectiveSubjectiveBeliefProjectionVersion,
} from "../../server/src/world-simulation-effective-subjective-belief-projection-service.mjs";

const character = "伊萊亞斯・諾爾";
const priorTurnId = "world_turn_phase66b_prior";
const currentTurnId = "world_turn_phase66b_current";

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
      scene_id: "scene_phase66b",
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

function executeProjection(worldState, turnId, suffix, projection) {
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:${suffix}`,
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
    queue,
    execution,
    world_state: execution.next_world_state,
  };
}

function executeClaimProjection(worldState, turnId, sourceMemories, proposals) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim",
    buildWorldSimulationSubjectiveClaims({
      world_state: worldState,
      turn_id: turnId,
      source_memory_records: sourceMemories.map((memory) => ({
        character,
        memory_record: memory,
      })),
      claim_proposals: proposals,
    }),
  );
}

function executeRelationProjection(worldState, turnId, proposals) {
  return executeProjection(
    worldState,
    turnId,
    "subjective_claim_relation",
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldState,
      turn_id: turnId,
      relation_proposals: proposals,
    }),
  );
}

function executeRevision(worldState, turnId, resolution) {
  const revision = buildWorldSimulationSubjectiveBeliefRevisions({
    world_state: worldState,
    turn_id: turnId,
    resolution: resolution.result,
  });
  return executeProjection(
    worldState,
    turnId,
    "subjective_belief_revision",
    revision,
  );
}

const priorMemory = memoryFixture(
  "memory_phase66b_prior",
  priorTurnId,
  "先前看見阿灰在伊萊亞斯抬手後才改變方向。",
);
const currentMemory = memoryFixture(
  "memory_phase66b_current",
  currentTurnId,
  "後來看見阿灰在沒有明顯手勢時自行改變方向。",
);

const baseWorldState = {
  simulation_time: "2026-09-07T07:15:00+08:00",
  memories: {
    [character]: [priorMemory, currentMemory],
  },
};

// Contract: Phase66B is a pure read model rebuilt from the append-only 66A
// event history. It deliberately does not expose anything to Character Brain;
// that bounded surface belongs to Phase66C.
const contract = buildWorldSimulationEffectiveSubjectiveBeliefProjectionContract();
assert.equal(contract.version, worldSimulationEffectiveSubjectiveBeliefProjectionVersion);
assert.equal(contract.phase, "Phase66B");
assert.equal(contract.status, "effective_subjective_belief_read_projection_installed");
assert.equal(contract.entry_schema_version, effectiveSubjectiveBeliefEntrySchemaVersion);
assert.equal(contract.event_store_remains_authoritative, true);
assert.equal(contract.projection_is_read_model, true);
assert.equal(contract.projection_is_rebuildable_from_event_history, true);
assert.equal(contract.projection_persistence_installed, false);
assert.equal(contract.projection_snapshot_is_authority, false);
assert.equal(contract.pure_projection_required, true);
assert.equal(contract.world_state_mutation_allowed, false);
assert.equal(contract.per_character_revision_hash_chain_verified, true);
assert.equal(contract.source_decision_hashes_verified, true);
assert.equal(contract.source_claim_hashes_verified, true);
assert.equal(contract.source_relation_hashes_verified, true);
assert.equal(contract.explicit_revision_semantics_only, true);
assert.equal(contract.deterministic_history_order_used_for_temporal_replay, true);
assert.equal(contract.deterministic_history_order_is_epistemic_precedence, false);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.unresolved_resolution_promoted_without_revision_event, false);
assert.deepEqual(contract.recognized_v1_commitments, ["active", "superseded"]);
assert.equal(contract.suspended_commitment_projection_installed, false);
assert.equal(contract.withdrawn_commitment_projection_installed, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.character_brain_exposure_installed, false);
assert.equal(contract.action_proposer_exposure_installed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.bounded_character_exposure_owner, "Phase66C");

// 1. No durable Phase66A revision events means no effective belief. Phase66B
// never promotes a raw claim or a Phase65D decision by itself.
const emptyProjection = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: baseWorldState,
  character,
});
assert.equal(emptyProjection.ok, true);
assert.equal(emptyProjection.projection.effective_belief_count, 0);
assert.deepEqual(emptyProjection.projection.active_beliefs, []);
assert.deepEqual(emptyProjection.projection.superseded_beliefs, []);
assert.equal(
  emptyProjection.audit.unresolved_resolution_promoted_without_revision_event,
  false,
);
assert.equal(emptyProjection.audit.persistent_projection_written, false);

// 2. First evidence-backed claim -> 65D adopt -> 66A event -> 66B active belief.
const priorClaimBuild = executeClaimProjection(
  baseWorldState,
  priorTurnId,
  [priorMemory],
  [
    {
      proposal_ref: "phase66b-prior-directed-control",
      character,
      proposition: "阿灰的方向變化可能依賴伊萊亞斯的有意識指令。",
      evidence: [
        {
          source_memory_ref: priorMemory.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const priorClaim = priorClaimBuild.projection.result.claim_events_created[0];
assert.ok(priorClaim);
const priorResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: priorClaimBuild.world_state,
  turn_id: priorTurnId,
});
assert.deepEqual(
  priorResolution.result.decisions.map((decision) => decision.action),
  ["adopt"],
);
const priorRevisionExecution = executeRevision(
  priorClaimBuild.world_state,
  priorTurnId,
  priorResolution,
);
const priorCommittedState = priorRevisionExecution.world_state;
const priorStateSnapshot = structuredClone(priorCommittedState);

const activeProjection = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: priorCommittedState,
  character,
});
assert.equal(activeProjection.projection.active_belief_count, 1);
assert.equal(activeProjection.projection.superseded_belief_count, 0);
assert.equal(activeProjection.projection.source_revision_event_count, 1);
const activeEntry = activeProjection.projection.active_beliefs[0];
assert.equal(activeEntry.schema_version, effectiveSubjectiveBeliefEntrySchemaVersion);
assert.equal(activeEntry.claim_event_id, priorClaim.claim_event_id);
assert.equal(activeEntry.claim_event_hash, priorClaim.claim_event_hash);
assert.equal(activeEntry.proposition, priorClaim.proposition);
assert.equal(activeEntry.proposition_hash, priorClaim.proposition_hash);
assert.equal(activeEntry.claim_source_turn_id, priorTurnId);
assert.equal(activeEntry.commitment, "active");
assert.equal(activeEntry.first_revision_turn_id, priorTurnId);
assert.equal(activeEntry.latest_revision_turn_id, priorTurnId);
assert.equal(activeEntry.latest_resolution_action, "adopt");
assert.equal(activeEntry.revision_event_count, 1);
assert.equal(activeEntry.subjective_not_world_truth, true);
assert.equal(activeEntry.confidence, null);
assert.equal(activeEntry.probability, null);
assert.deepEqual(priorCommittedState, priorStateSnapshot);

// 3. A later explicit supersession does not rewrite the old claim or old
// revision event. The read model marks the historical claim superseded and the
// new source active, preserving exact temporal and relational lineage.
const currentClaimBuild = executeClaimProjection(
  priorCommittedState,
  currentTurnId,
  [currentMemory],
  [
    {
      proposal_ref: "phase66b-current-autonomy",
      character,
      proposition:
        "阿灰可能具有不依賴伊萊亞斯明顯有意識指令的自主行動能力。",
      evidence: [
        {
          source_memory_ref: currentMemory.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const currentClaim = currentClaimBuild.projection.result.claim_events_created[0];
assert.ok(currentClaim);
const relationBuild = executeRelationProjection(
  currentClaimBuild.world_state,
  currentTurnId,
  [
    {
      proposal_ref: "phase66b-supersede-prior",
      character,
      source_claim_event_id: currentClaim.claim_event_id,
      target_claim_event_id: priorClaim.claim_event_id,
      relation: "supersedes",
    },
  ],
);
const currentResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: relationBuild.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  currentResolution.result.decisions.map((decision) => decision.action),
  ["adopt", "supersede"],
);
const beforeCurrentRevision = structuredClone(relationBuild.world_state);
const currentRevisionExecution = executeRevision(
  relationBuild.world_state,
  currentTurnId,
  currentResolution,
);
const currentCommittedState = currentRevisionExecution.world_state;

assert.deepEqual(
  currentCommittedState.subjective_claim_events,
  beforeCurrentRevision.subjective_claim_events,
  "Phase66A/66B must preserve immutable claim history",
);
assert.deepEqual(
  currentCommittedState.subjective_claim_relation_events,
  beforeCurrentRevision.subjective_claim_relation_events,
  "Phase66A/66B must preserve immutable relation history",
);

const currentStateSnapshot = structuredClone(currentCommittedState);
const effective = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: currentCommittedState,
  character,
});
assert.equal(effective.projection.effective_belief_count, 2);
assert.equal(effective.projection.active_belief_count, 1);
assert.equal(effective.projection.superseded_belief_count, 1);
assert.equal(effective.projection.source_revision_event_count, 3);

const newActive = effective.projection.active_beliefs[0];
const oldSuperseded = effective.projection.superseded_beliefs[0];
assert.equal(newActive.claim_event_id, currentClaim.claim_event_id);
assert.equal(newActive.commitment, "active");
assert.equal(newActive.claim_source_turn_id, currentTurnId);
assert.ok(
  newActive.supersedes_claim_event_ids.includes(priorClaim.claim_event_id),
);
assert.equal(oldSuperseded.claim_event_id, priorClaim.claim_event_id);
assert.equal(oldSuperseded.commitment, "superseded");
assert.equal(oldSuperseded.claim_source_turn_id, priorTurnId);
assert.equal(oldSuperseded.first_revision_turn_id, priorTurnId);
assert.equal(oldSuperseded.latest_revision_turn_id, currentTurnId);
assert.equal(oldSuperseded.latest_resolution_action, "supersede");
assert.equal(oldSuperseded.revision_event_count, 2);
assert.ok(
  oldSuperseded.superseded_by_claim_event_ids.includes(currentClaim.claim_event_id),
);
assert.deepEqual(currentCommittedState, currentStateSnapshot);

// 4. Identical immutable history deterministically rebuilds the exact same
// projection and projection hash.
const deterministicReplay = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: currentCommittedState,
  character,
});
assert.deepEqual(deterministicReplay, effective);
const projectionBody = structuredClone(effective.projection);
delete projectionBody.projection_hash;
assert.equal(
  effective.projection.projection_hash,
  hashAgentRunValue(projectionBody),
);

// 5. Objective/world-truth-looking fields are not projection inputs.
const stateWithWorldTruth = structuredClone(currentCommittedState);
stateWithWorldTruth.authoritative_world_truth_fixture = {
  actual_control_mode: "engine_secret",
  truth_probability: 1,
};
const truthIgnored = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: stateWithWorldTruth,
  character,
});
assert.deepEqual(truthIgnored.projection, effective.projection);
assert.equal(truthIgnored.audit.world_truth_fields_consumed, false);
assert.equal(truthIgnored.audit.confidence_probability_modeled, false);
assert.equal(truthIgnored.audit.retrieval_frequency_used_as_credibility, false);
assert.equal(truthIgnored.audit.accessibility_strength_used_as_credibility, false);
assert.equal(truthIgnored.audit.plasticity_strength_used_as_truth_support, false);

// 6. Event body tampering is rejected even when the history reference still
// points at the original hash.
const tamperedEventState = structuredClone(currentCommittedState);
const tamperedEventId =
  tamperedEventState.subjective_belief_revision_history[0]
    .belief_revision_event_id;
tamperedEventState.subjective_belief_revision_events[
  tamperedEventId
].resolution_reason = "tampered";
assert.throws(
  () => projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: tamperedEventState,
    character,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_EVENT_HASH_MISMATCH",
);

// 7. Recomputing an event hash after changing source semantics still fails
// because the embedded Phase65D decision hash/id remains independently pinned.
const forgedSemanticState = structuredClone(currentCommittedState);
const forgedEventId =
  forgedSemanticState.subjective_belief_revision_history[0]
    .belief_revision_event_id;
const forgedEvent = forgedSemanticState.subjective_belief_revision_events[
  forgedEventId
];
forgedEvent.source_resolution_decision.reason = "forged reason";
const forgedBody = structuredClone(forgedEvent);
delete forgedBody.belief_revision_event_hash;
forgedEvent.belief_revision_event_hash = hashAgentRunValue(forgedBody);
forgedSemanticState.subjective_belief_revision_history[0]
  .belief_revision_event_hash = forgedEvent.belief_revision_event_hash;
assert.throws(
  () => projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: forgedSemanticState,
    character,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_DECISION_HASH_MISMATCH",
);

// 8. History duplication is rejected; read-model replay may not silently
// double-apply one durable cognitive change.
const duplicateHistoryState = structuredClone(currentCommittedState);
duplicateHistoryState.subjective_belief_revision_history.push(
  structuredClone(duplicateHistoryState.subjective_belief_revision_history[0]),
);
assert.throws(
  () => projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: duplicateHistoryState,
    character,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_DUPLICATE",
);

// 9. The per-character predecessor chain is authoritative integrity evidence.
const brokenChainState = structuredClone(currentCommittedState);
const secondHistoryRef = brokenChainState.subjective_belief_revision_history[1];
secondHistoryRef.previous_belief_revision_event_id = "forged_predecessor";
assert.throws(
  () => projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: brokenChainState,
    character,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_MISMATCH",
);

// 10. A forged cross-character revision reference is rejected rather than
// leaking another character's belief into this projection.
const crossCharacterState = structuredClone(currentCommittedState);
crossCharacterState.subjective_belief_revision_history[0].character = "另一名角色";
assert.throws(
  () => projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: crossCharacterState,
    character,
  }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_EFFECTIVE_SUBJECTIVE_BELIEF_REVISION_HISTORY_REFERENCE_MISMATCH",
);

// 11. Unreferenced event-store garbage is not a source of current belief. The
// append-only history is the authoritative stream for this read model.
const orphanState = structuredClone(currentCommittedState);
orphanState.subjective_belief_revision_events.orphan_unreferenced_event = {
  arbitrary: true,
  proposition: "should never appear",
};
const orphanIgnored = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: orphanState,
  character,
});
assert.deepEqual(orphanIgnored.projection, effective.projection);
assert.equal(orphanIgnored.audit.unreferenced_revision_event_count, 1);
assert.equal(orphanIgnored.audit.unreferenced_revision_events_affect_projection, false);

// 12. An unresolved Phase65D conflict without a 66A revision event never
// becomes an effective current belief merely because claims/relations exist.
const unresolvedBase = executeClaimProjection(
  baseWorldState,
  currentTurnId,
  [currentMemory],
  [
    {
      proposal_ref: "phase66b-unresolved-a",
      character,
      proposition: "阿灰可能只在有明顯指令時改變方向。",
      evidence: [
        {
          source_memory_ref: currentMemory.memory_id,
          relation: "supports",
        },
      ],
    },
    {
      proposal_ref: "phase66b-unresolved-b",
      character,
      proposition: "阿灰可能在沒有明顯指令時改變方向。",
      evidence: [
        {
          source_memory_ref: currentMemory.memory_id,
          relation: "supports",
        },
      ],
    },
  ],
);
const unresolvedClaims = unresolvedBase.projection.result.claim_events_created;
const challenged = executeRelationProjection(
  unresolvedBase.world_state,
  currentTurnId,
  [
    {
      proposal_ref: "phase66b-unresolved-challenge",
      character,
      source_claim_event_id: unresolvedClaims[1].claim_event_id,
      target_claim_event_id: unresolvedClaims[0].claim_event_id,
      relation: "challenges",
    },
  ],
);
const unresolvedResolution = resolveWorldSimulationSubjectiveBeliefs({
  world_state: challenged.world_state,
  turn_id: currentTurnId,
});
assert.deepEqual(
  unresolvedResolution.result.decisions.map((decision) => decision.action),
  ["unresolved"],
);
const unresolvedProjection = projectWorldSimulationEffectiveSubjectiveBeliefs({
  world_state: challenged.world_state,
  character,
});
assert.equal(unresolvedProjection.projection.effective_belief_count, 0);

// 13. The projection is engine-side only: it may retain IDs/hashes for audit,
// while its contract explicitly forbids Character Brain / Action Proposer
// exposure until Phase66C supplies a bounded character-facing surface.
assert.ok(optionalEngineIdentity(activeEntry.claim_event_id));
assert.equal(contract.character_brain_exposure_installed, false);
assert.equal(contract.action_proposer_exposure_installed, false);
assert.equal(effective.audit.character_brain_exposure_applied, false);
assert.equal(effective.audit.action_proposer_exposure_applied, false);
assert.equal(effective.audit.same_turn_character_brain_feedback_allowed, false);

function optionalEngineIdentity(value) {
  return typeof value === "string" && value.length > 0;
}

console.log("Phase66B effective subjective belief projection tests passed.");
