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
  buildWorldSimulationChronologicalMutationQueueContract,
  executeWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
} from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import {
  buildWorldSimulationSubjectiveClaims,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimConflictRevisionContract,
  buildWorldSimulationSubjectiveClaimConflictRevisionResolverView,
  buildWorldSimulationSubjectiveClaimConflictRevisions,
  subjectiveClaimRelationEventSchemaVersion,
  subjectiveClaimRelationHistoryReferenceSchemaVersion,
  worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
} from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";

const character = "伊萊亞斯・諾爾";
const priorTurnId = "world_turn_phase65b_prior";
const currentTurnId = "world_turn_phase65b_current";

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
      scene_id: "scene_phase65b",
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

const priorMemory =
  memoryFixture(
    "memory_phase65b_prior",
    priorTurnId,
    "先前看見阿灰在伊萊亞斯抬手後改變方向。",
  );
const currentMemory =
  memoryFixture(
    "memory_phase65b_current",
    currentTurnId,
    "這次看見阿灰在沒有明顯手勢時自行改變方向。",
  );

const baseWorldState = {
  simulation_time: "2026-09-06T14:00:00+08:00",
  memories: {
    [character]: [
      priorMemory,
      currentMemory,
    ],
  },
};

function executeClaimProjection(
  worldState,
  turnId,
  sourceMemory,
  proposals,
) {
  const projection =
    buildWorldSimulationSubjectiveClaims({
      world_state: worldState,
      turn_id: turnId,
      source_memory_records: [
        {
          character,
          memory_record: sourceMemory,
        },
      ],
      claim_proposals: proposals,
    });

  const queue =
    buildWorldSimulationChronologicalMutationQueue({
      turn_id: `${turnId}:subjective_claim`,
      world_state_hash: hashAgentRunValue(worldState),
      state_transitions: projection.result.state_transitions,
      elapsed_ms: 0,
    });

  return {
    projection,
    execution:
      executeWorldSimulationChronologicalMutationQueue({
        world_state: worldState,
        preview_world_state:
          projection.result.preview_world_state,
        queue,
      }),
  };
}

const priorClaimBuild =
  executeClaimProjection(
    baseWorldState,
    priorTurnId,
    priorMemory,
    [
      {
        proposal_ref: "phase65b-prior-directed-control",
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

const priorClaimEvent =
  priorClaimBuild.projection.result.claim_events_created[0];

const currentClaimBuild =
  executeClaimProjection(
    priorClaimBuild.execution.next_world_state,
    currentTurnId,
    currentMemory,
    [
      {
        proposal_ref: "phase65b-current-autonomy",
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
      {
        proposal_ref: "phase65b-current-hidden-control",
        character,
        proposition:
          "阿灰仍可能受伊萊亞斯尚未察覺的控制機制影響。",
        evidence: [
          {
            source_memory_ref: currentMemory.memory_id,
            relation: "supports",
          },
        ],
      },
    ],
  );

const worldStateWithClaims =
  currentClaimBuild.execution.next_world_state;
const currentClaimEvents =
  currentClaimBuild.projection.result.claim_events_created;
const currentAutonomyClaim =
  currentClaimEvents.find(
    (event) =>
      event.derivation.proposal_ref
        === "phase65b-current-autonomy",
  );
const currentHiddenControlClaim =
  currentClaimEvents.find(
    (event) =>
      event.derivation.proposal_ref
        === "phase65b-current-hidden-control",
  );

assert.ok(priorClaimEvent);
assert.ok(currentAutonomyClaim);
assert.ok(currentHiddenControlClaim);
assert.equal(
  Object.keys(worldStateWithClaims.subjective_claim_events).length,
  3,
);
assert.equal(
  worldStateWithClaims.subjective_claim_history.length,
  3,
);

const contract =
  buildWorldSimulationSubjectiveClaimConflictRevisionContract();

assert.equal(
  contract.version,
  worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
);
assert.equal(contract.phase, "Phase65B");
assert.equal(contract.source_claim_current_turn_required, true);
assert.equal(contract.prior_claim_comparison_allowed, true);
assert.equal(contract.same_turn_challenge_allowed, true);
assert.equal(contract.same_turn_supersession_allowed, false);
assert.equal(contract.relation_event_write_once_required, true);
assert.equal(contract.relation_history_append_only_required, true);
assert.equal(contract.historical_claim_mutation_allowed, false);
assert.equal(contract.target_claim_invalidation_modeled, false);
assert.equal(contract.unresolved_competing_claims_preserved, true);
assert.equal(contract.supersession_is_candidate_relation_only, true);
assert.equal(contract.semantic_conflict_resolution_modeled, false);
assert.equal(contract.last_write_wins_allowed, false);
assert.equal(contract.confidence_probability_modeled, false);
assert.equal(contract.world_truth_authority_claimed, false);
assert.equal(contract.character_brain_exposure_installed, false);
assert.equal(contract.same_turn_character_brain_feedback_allowed, false);
assert.equal(contract.retrieval_frequency_counts_as_credibility, false);
assert.equal(contract.accessibility_strength_counts_as_credibility, false);
assert.equal(contract.plasticity_strength_counts_as_truth_support, false);
assert.equal(contract.hidden_semantic_graph_traversal_allowed, false);
assert.equal(contract.phase65a_claim_events_remain_immutable, true);

const mutationContract =
  buildWorldSimulationChronologicalMutationQueueContract();

for (const field of [
  "phase65b_subjective_claim_relation_event_write_once_enforced",
  "phase65b_subjective_claim_relation_event_content_address_verified",
  "phase65b_subjective_claim_relation_claim_hash_pinning_enforced",
  "phase65b_subjective_claim_relation_history_append_only_enforced",
  "direct_nested_subjective_claim_relation_history_mutation_rejected",
  "phase65b_historical_claim_rewrite_rejected",
]) {
  assert.equal(
    mutationContract.execution[field],
    true,
    `Phase62K contract must expose ${field}`,
  );
}

const resolverView =
  buildWorldSimulationSubjectiveClaimConflictRevisionResolverView({
    world_state: worldStateWithClaims,
    turn_id: currentTurnId,
  });

assert.equal(resolverView.character_claims.length, 1);
assert.equal(
  resolverView.character_claims[0].character,
  character,
);
assert.equal(
  resolverView.character_claims[0].current_turn_claims.length,
  2,
);
assert.equal(
  resolverView.character_claims[0].prior_claims.length,
  1,
);
assert.equal(
  resolverView.character_claims[0].prior_claims[0].claim_event_id,
  priorClaimEvent.claim_event_id,
);
assert.equal(
  resolverView.boundaries.current_turn_claim_must_anchor_relation,
  true,
);
assert.equal(
  resolverView.boundaries.relation_is_candidate_not_truth_resolution,
  true,
);
assert.equal(
  resolverView.boundaries.target_claim_mutation_allowed,
  false,
);

const resolverViewText =
  JSON.stringify(resolverView);
assert.equal(
  Object.hasOwn(resolverView, "world_state"),
  false,
);
assert.equal(
  Object.hasOwn(resolverView, "memories"),
  false,
);
assert.equal(resolverViewText.includes("internal_provenance"), false);
assert.equal(resolverViewText.includes("source_memory_ref"), false);
assert.equal(resolverViewText.includes(priorMemory.memory_id), false);
assert.equal(resolverViewText.includes(currentMemory.memory_id), false);
assert.equal(resolverViewText.includes("perceptual_certainty"), false);

const relationProposals = [
  {
    proposal_ref: "phase65b-challenge-prior",
    character,
    source_claim_event_id:
      currentAutonomyClaim.claim_event_id,
    target_claim_event_id:
      priorClaimEvent.claim_event_id,
    relation: "challenges",
  },
  {
    proposal_ref: "phase65b-supersession-candidate",
    character,
    source_claim_event_id:
      currentHiddenControlClaim.claim_event_id,
    target_claim_event_id:
      priorClaimEvent.claim_event_id,
    relation: "supersedes",
  },
  {
    proposal_ref: "phase65b-same-turn-challenge",
    character,
    source_claim_event_id:
      currentAutonomyClaim.claim_event_id,
    target_claim_event_id:
      currentHiddenControlClaim.claim_event_id,
    relation: "challenges",
  },
];

const claimSnapshot =
  structuredClone(
    worldStateWithClaims.subjective_claim_events,
  );
const claimHistorySnapshot =
  structuredClone(
    worldStateWithClaims.subjective_claim_history,
  );
const memorySnapshot =
  structuredClone(
    worldStateWithClaims.memories,
  );

const built =
  buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: worldStateWithClaims,
    turn_id: currentTurnId,
    relation_proposals: relationProposals,
  });

assert.equal(
  built.version,
  worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
);
assert.equal(built.result.processed_proposal_count, 3);
assert.equal(built.result.relation_events_created.length, 3);
assert.equal(built.result.history_references_appended.length, 3);
assert.equal(
  built.result.state_transitions.length,
  4,
  "three write-once relation events plus one append-only relation history mutation are expected",
);
assert.deepEqual(
  built.result.preview_world_state.subjective_claim_events,
  claimSnapshot,
  "Phase65B may not rewrite Phase65A claim events",
);
assert.deepEqual(
  built.result.preview_world_state.subjective_claim_history,
  claimHistorySnapshot,
  "Phase65B may not rewrite Phase65A claim history",
);
assert.deepEqual(
  built.result.preview_world_state.memories,
  memorySnapshot,
  "Phase65B may not rewrite episodic memories",
);

for (const event of built.result.relation_events_created) {
  assert.equal(
    event.schema_version,
    subjectiveClaimRelationEventSchemaVersion,
  );
  assert.equal(event.immutable, true);
  assert.equal(
    event.status,
    "candidate_subjective_claim_relation",
  );
  assert.ok([
    "challenges",
    "supersedes",
  ].includes(event.relation));
  assert.equal(event.semantic_state.world_truth_verified, false);
  assert.equal(event.semantic_state.confidence, null);
  assert.equal(event.semantic_state.probability, null);
  assert.equal(event.semantic_state.conflict_resolution_applied, false);
  assert.equal(event.semantic_state.belief_revision_applied, false);
  assert.equal(event.semantic_state.target_claim_invalidated, false);
  assert.equal(event.semantic_state.target_claim_deleted, false);
  assert.equal(event.semantic_state.target_claim_rewritten, false);
  assert.equal(
    event.semantic_state.supersession_is_candidate_relation_only,
    true,
  );
  assert.equal(
    event.engine_audit.retrieval_frequency_used_as_credibility,
    false,
  );
  assert.equal(
    event.engine_audit.accessibility_strength_used_as_credibility,
    false,
  );
  assert.equal(
    event.engine_audit.plasticity_strength_used_as_truth_support,
    false,
  );
  assert.equal(
    event.engine_audit.same_turn_character_brain_feedback_allowed,
    false,
  );
  assert.equal(event.engine_audit.last_write_wins_applied, false);
  assert.equal(
    event.engine_audit.historical_claim_mutation_applied,
    false,
  );

  const sourceClaim =
    worldStateWithClaims.subjective_claim_events[
      event.source_claim_event_id
    ];
  const targetClaim =
    worldStateWithClaims.subjective_claim_events[
      event.target_claim_event_id
    ];

  assert.ok(sourceClaim);
  assert.ok(targetClaim);
  assert.equal(
    event.source_claim_event_hash,
    sourceClaim.claim_event_hash,
  );
  assert.equal(
    event.target_claim_event_hash,
    targetClaim.claim_event_hash,
  );
  assert.equal(
    event.source_claim_proposition_hash,
    sourceClaim.proposition_hash,
  );
  assert.equal(
    event.target_claim_proposition_hash,
    targetClaim.proposition_hash,
  );
  assert.deepEqual(
    event.evidence_basis,
    sourceClaim.evidence
      .filter((evidence) => evidence.relation === "supports")
      .map((evidence) => ({
        source_memory_ref: evidence.source_memory_ref,
        source_memory_hash: evidence.source_memory_hash,
        relation: evidence.relation,
      })),
    "relation provenance must pin the exact supporting evidence of the current-turn source claim",
  );

  const hashBody =
    structuredClone(event);
  delete hashBody.relation_event_hash;
  assert.equal(
    event.relation_event_hash,
    hashAgentRunValue(hashBody),
  );
}

const supersessionEvent =
  built.result.relation_events_created.find(
    (event) => event.relation === "supersedes",
  );
assert.ok(supersessionEvent);
assert.equal(
  supersessionEvent.target_source_turn_id,
  priorTurnId,
);
assert.notEqual(
  supersessionEvent.source_turn_id,
  supersessionEvent.target_source_turn_id,
);

const sameTurnChallenge =
  built.result.relation_events_created.find(
    (event) =>
      event.relation === "challenges"
      && event.target_claim_event_id
        === currentHiddenControlClaim.claim_event_id,
  );
assert.ok(
  sameTurnChallenge,
  "same-turn competing claims may be explicitly challenged without inventing same-turn precedence",
);

for (const reference of built.result.history_references_appended) {
  assert.equal(
    reference.schema_version,
    subjectiveClaimRelationHistoryReferenceSchemaVersion,
  );
  assert.equal(reference.derived_index, true);
  assert.equal(
    reference.status,
    "candidate_subjective_claim_relation",
  );
}

const reordered =
  buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: worldStateWithClaims,
    turn_id: currentTurnId,
    relation_proposals: [
      relationProposals[2],
      relationProposals[0],
      relationProposals[1],
    ],
  });
assert.deepEqual(
  reordered.result.preview_world_state,
  built.result.preview_world_state,
  "caller proposal ordering must not affect deterministic Phase65B projection",
);

const relationQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${currentTurnId}:subjective_claim_relation`,
    world_state_hash: hashAgentRunValue(worldStateWithClaims),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });

const executed =
  executeWorldSimulationChronologicalMutationQueue({
    world_state: worldStateWithClaims,
    preview_world_state:
      built.result.preview_world_state,
    queue: relationQueue,
  });

assert.equal(
  Object.keys(
    executed.next_world_state.subjective_claim_relation_events,
  ).length,
  3,
);
assert.equal(
  executed.next_world_state.subjective_claim_relation_history.length,
  3,
);
assert.deepEqual(
  executed.next_world_state.subjective_claim_events,
  claimSnapshot,
);
assert.deepEqual(
  executed.next_world_state.subjective_claim_history,
  claimHistorySnapshot,
);

const replay =
  buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: executed.next_world_state,
    turn_id: currentTurnId,
    relation_proposals: relationProposals,
  });
assert.equal(replay.result.relation_events_created.length, 0);
assert.equal(
  replay.result.already_persisted_relation_event_ids.length,
  3,
);
assert.equal(replay.result.history_references_appended.length, 0);
assert.equal(replay.result.state_transitions.length, 0);

const persistedRelationEvent =
  Object.values(
    executed.next_world_state.subjective_claim_relation_events,
  )[0];
const overwrittenRelationEvent = {
  ...structuredClone(persistedRelationEvent),
  relation:
    persistedRelationEvent.relation === "challenges"
      ? "supersedes"
      : "challenges",
};
const overwritePreview =
  structuredClone(executed.next_world_state);
overwritePreview.subjective_claim_relation_events[
  persistedRelationEvent.relation_event_id
] = overwrittenRelationEvent;
const overwriteQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${currentTurnId}:subjective_claim_relation`,
    world_state_hash: hashAgentRunValue(executed.next_world_state),
    state_transitions: [
      {
        entity: "world",
        field:
          `subjective_claim_relation_events.${persistedRelationEvent.relation_event_id}`,
        from: persistedRelationEvent,
        to: overwrittenRelationEvent,
        cause: "illegal Phase65B relation overwrite fixture",
        source_layer:
          "subjective_claim_conflict_revision_projection",
      },
    ],
    elapsed_ms: 0,
  });

for (const mutate of [
  () =>
    projectWorldSimulationChronologicalMutationQueue({
      world_state: executed.next_world_state,
      queue: overwriteQueue,
    }),
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: executed.next_world_state,
      preview_world_state: overwritePreview,
      queue: overwriteQueue,
    }),
]) {
  assert.throws(
    mutate,
    (error) =>
      error?.code
        === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_EVENT_IMMUTABILITY_VIOLATION",
  );
}

const reorderedRelationHistory = [
  ...executed.next_world_state.subjective_claim_relation_history,
].reverse();
const rewriteHistoryPreview =
  structuredClone(executed.next_world_state);
rewriteHistoryPreview.subjective_claim_relation_history =
  reorderedRelationHistory;
const rewriteHistoryQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${currentTurnId}:subjective_claim_relation`,
    world_state_hash: hashAgentRunValue(executed.next_world_state),
    state_transitions: [
      {
        entity: "world",
        field: "subjective_claim_relation_history",
        from:
          executed.next_world_state.subjective_claim_relation_history,
        to: reorderedRelationHistory,
        cause: "illegal Phase65B relation history reorder fixture",
        source_layer:
          "subjective_claim_conflict_revision_projection",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: executed.next_world_state,
      preview_world_state: rewriteHistoryPreview,
      queue: rewriteHistoryQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_HISTORY_APPEND_ONLY_VIOLATION",
);

const tamperedTargetHashEvent =
  structuredClone(
    built.result.relation_events_created[0],
  );
tamperedTargetHashEvent.target_claim_event_hash =
  "0".repeat(64);
tamperedTargetHashEvent.relation_event_id =
  `subjective_claim_relation_event_${hashAgentRunValue({
    version:
      worldSimulationSubjectiveClaimConflictRevisionProjectionVersion,
    source_turn_id:
      tamperedTargetHashEvent.source_turn_id,
    character:
      tamperedTargetHashEvent.character,
    source_claim_event_id:
      tamperedTargetHashEvent.source_claim_event_id,
    source_claim_event_hash:
      tamperedTargetHashEvent.source_claim_event_hash,
    target_claim_event_id:
      tamperedTargetHashEvent.target_claim_event_id,
    target_claim_event_hash:
      tamperedTargetHashEvent.target_claim_event_hash,
    relation:
      tamperedTargetHashEvent.relation,
    proposal_ref:
      tamperedTargetHashEvent.derivation.proposal_ref,
  }).slice(0, 24)}`;
const tamperedBody =
  structuredClone(tamperedTargetHashEvent);
delete tamperedBody.relation_event_hash;
tamperedTargetHashEvent.relation_event_hash =
  hashAgentRunValue(tamperedBody);

const tamperedPreview =
  structuredClone(worldStateWithClaims);
tamperedPreview.subjective_claim_relation_events = {
  [tamperedTargetHashEvent.relation_event_id]:
    tamperedTargetHashEvent,
};
const tamperedQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${currentTurnId}:subjective_claim_relation`,
    world_state_hash: hashAgentRunValue(worldStateWithClaims),
    state_transitions: [
      {
        entity: "world",
        field:
          `subjective_claim_relation_events.${tamperedTargetHashEvent.relation_event_id}`,
        from: null,
        to: tamperedTargetHashEvent,
        cause: "tampered Phase65B target claim hash fixture",
        source_layer:
          "subjective_claim_conflict_revision_projection",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: worldStateWithClaims,
      preview_world_state: tamperedPreview,
      queue: tamperedQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CLAIM_HASH_MISMATCH",
  "Phase62K must independently pin both exact claim images",
);

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state: worldStateWithClaims,
      preview_world_state:
        built.result.preview_world_state,
      queue:
        buildWorldSimulationChronologicalMutationQueue({
          turn_id: `${priorTurnId}:subjective_claim_relation`,
          world_state_hash: hashAgentRunValue(worldStateWithClaims),
          state_transitions: built.result.state_transitions,
          elapsed_ms: 0,
        }),
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_QUEUE_TURN_MISMATCH",
  "Phase62K must bind relation persistence to the source claim's exact current-turn queue",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldStateWithClaims,
      turn_id: currentTurnId,
      relation_proposals: [
        {
          proposal_ref: "illegal-same-turn-supersession",
          character,
          source_claim_event_id:
            currentAutonomyClaim.claim_event_id,
          target_claim_event_id:
            currentHiddenControlClaim.claim_event_id,
          relation: "supersedes",
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SUPERSESSION_TARGET_NOT_PRIOR_TURN",
  "same-turn deterministic ordering must not masquerade as causal supersession",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldStateWithClaims,
      turn_id: currentTurnId,
      relation_proposals: [
        {
          proposal_ref: "illegal-prior-source",
          character,
          source_claim_event_id:
            priorClaimEvent.claim_event_id,
          target_claim_event_id:
            currentAutonomyClaim.claim_event_id,
          relation: "challenges",
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_SOURCE_NOT_CURRENT_TURN",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaimConflictRevisions({
      world_state: worldStateWithClaims,
      turn_id: currentTurnId,
      relation_proposals: [
        {
          ...relationProposals[0],
          character: "另一名角色",
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_CHARACTER_MISMATCH",
);

for (const forbiddenField of [
  ["probability", 0.9],
  ["invalidates", true],
]) {
  const [field, value] = forbiddenField;
  assert.throws(
    () =>
      buildWorldSimulationSubjectiveClaimConflictRevisions({
        world_state: worldStateWithClaims,
        turn_id: currentTurnId,
        relation_proposals: [
          {
            ...relationProposals[0],
            [field]: value,
          },
        ],
      }),
    (error) =>
      error?.code
        === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_RELATION_AUTHORITY_FIELD_FORBIDDEN",
    `Phase65B must reject forbidden authority field ${field}`,
  );
}

const noRelationBuild =
  buildWorldSimulationSubjectiveClaimConflictRevisions({
    world_state: worldStateWithClaims,
    turn_id: currentTurnId,
    relation_proposals: [],
  });
assert.equal(noRelationBuild.result.state_transitions.length, 0);
assert.equal(
  Object.hasOwn(
    noRelationBuild.result.preview_world_state,
    "subjective_claim_relation_events",
  ),
  false,
);
assert.equal(
  Object.hasOwn(
    noRelationBuild.result.preview_world_state,
    "subjective_claim_relation_history",
  ),
  false,
);

const loopSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-loop-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );
const stateSource =
  await readFile(
    new URL(
      "../../server/src/world-simulation-state-service.mjs",
      import.meta.url,
    ),
    "utf8",
  );

for (const sourceAnchor of [
  "buildWorldSimulationSubjectiveClaimConflictRevisionContract",
  "subjectiveClaimRelationResolver",
  "current_turn_claims_plus_same_character_prior_claims",
  "next_world_state: goalAchievementMutationExecution.next_world_state",
  "const subjectiveBeliefRevisionMutationExecution =",
]) {
  assert.ok(
    loopSource.includes(sourceAnchor),
    `native loop must contain ${sourceAnchor}`,
  );
}

const claimExecutionIndex =
  loopSource.indexOf(
    "const subjectiveClaimMutationExecution =",
  );
const relationProposalIndex =
  loopSource.indexOf(
    "const subjectiveClaimRelationProposalResolution =",
  );
const relationProjectionIndex =
  loopSource.indexOf(
    "const subjectiveClaimConflictRevisionProjection =",
  );
const relationQueueIndex =
  loopSource.indexOf(
    "const subjectiveClaimRelationMutationQueue =",
  );
const relationExecutionIndex =
  loopSource.indexOf(
    "const subjectiveClaimRelationMutationExecution =",
  );
const commitIndex =
  loopSource.indexOf(
    "const committed = await commitWorldSimulationTurn",
  );

assert.ok(claimExecutionIndex >= 0);
assert.ok(relationProposalIndex > claimExecutionIndex);
assert.ok(relationProjectionIndex > relationProposalIndex);
assert.ok(relationQueueIndex > relationProjectionIndex);
assert.ok(relationExecutionIndex > relationQueueIndex);
assert.ok(commitIndex > relationExecutionIndex);

const runCharacterTurnIndex =
  loopSource.lastIndexOf(
    "selections[packet.character] = await characterRuntimeManager.runCharacterTurn",
  );
const resolveTurnCallIndex =
  loopSource.lastIndexOf(
    "return resolveWorldSimulationTurn(",
  );
assert.ok(runCharacterTurnIndex >= 0);
assert.ok(resolveTurnCallIndex > runCharacterTurnIndex);
assert.ok(
  relationProposalIndex < runCharacterTurnIndex,
  "relation implementation lives inside resolveWorldSimulationTurn, while same-turn Character Brain is invoked before resolveWorldSimulationTurn",
);

for (const historyField of [
  "subjective_claim_relation_proposal_resolution",
  "subjective_claim_conflict_revision_projection",
  "subjective_claim_relation_mutation_queue",
  "subjective_claim_relation_mutation_execution",
]) {
  assert.ok(
    stateSource.includes(historyField),
    `world history must persist ${historyField} for Phase65B auditability`,
  );
}

const nativeFixtureRoot =
  path.join(
    projectRoot,
    "tests",
    ".tmp",
    `phase65b-claim-relation-${process.pid}-${Date.now()}`,
  );
const nativeOptions = {
  fixtureRoot: nativeFixtureRoot,
};
const nativeObserver = "phase65b-native-observer";
const nativeTarget = "phase65b-native-target";
const nativeSceneId = "phase65b-native-scene";
const nativeFirstEventId = "phase65b-native-event-1";
const nativeSecondEventId = "phase65b-native-event-2";
const nativePriorClaimText =
  "眼前生物的移動可能依賴觀察者可見的外部指令。";
const nativeCurrentClaimText =
  "眼前生物可能在沒有可見外部指令時自行改變移動方向。";

const nativeWorldState = {
  simulation_time: "2026-09-06T14:30:00+08:00",
  world_rules: {
    default_vision_range_m: 30,
  },
  event_queue: [
    {
      event_id: nativeFirstEventId,
      type: "observe_possible_control",
      scene_id: nativeSceneId,
      participants: [nativeObserver],
    },
    {
      event_id: nativeSecondEventId,
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
  const next =
    structuredClone(input.world_state);
  next.event_queue =
    next.event_queue.slice(1);

  return {
    causal_resolution_id:
      `phase65b-noop-${input.event.event_id}`,
    next_world_state: next,
    state_transitions: [],
    action_outcomes: [
      {
        actor: nativeObserver,
        action_id: "continue-observing",
        result: "continued_observing",
        causal_evidence:
          "Phase65B fixture changes only event queue consumption",
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
  const nativeSession =
    await beginWorldSimulationSession(
      {
        simulation_label:
          "Phase65B native claim conflict revision fixture",
        seed: "phase65b-native-claim-relation",
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
  const brainInputs = [];
  let firstCommittedClaimSnapshot = null;

  const subjectiveClaimResolver =
    async (input) => {
      claimResolverCallCount += 1;
      assert.equal(
        input.character_evidence.length,
        1,
      );
      assert.ok(
        input.character_evidence[0].memories.length >= 1,
      );

      return [
        {
          proposal_ref:
            claimResolverCallCount === 1
              ? "native-phase65b-prior-claim"
              : "native-phase65b-current-claim",
          character: nativeObserver,
          proposition:
            claimResolverCallCount === 1
              ? nativePriorClaimText
              : nativeCurrentClaimText,
          evidence: [
            {
              source_memory_ref:
                input.character_evidence[0]
                  .memories[0]
                  .source_memory_ref,
              relation: "supports",
            },
          ],
        },
      ];
    };

  const subjectiveClaimRelationResolver =
    async (input) => {
      relationResolverCallCount += 1;
      assert.equal(
        Object.hasOwn(input, "world_state"),
        false,
      );
      assert.equal(
        Object.hasOwn(input, "memories"),
        false,
      );
      assert.equal(
        input.boundaries
          .whole_persistent_memory_store_exposed,
        false,
      );
      assert.equal(
        input.boundaries
          .relation_is_candidate_not_truth_resolution,
        true,
      );

      const serialized = JSON.stringify(input);
      assert.equal(serialized.includes("internal_provenance"), false);
      assert.equal(serialized.includes("source_memory_ref"), false);
      assert.equal(input.character_claims.length, 1);
      assert.equal(
        input.character_claims[0].current_turn_claims.length,
        1,
      );

      if (relationResolverCallCount === 1) {
        assert.equal(
          input.character_claims[0].prior_claims.length,
          0,
        );
        return [];
      }

      assert.equal(
        input.character_claims[0].prior_claims.length,
        1,
      );
      const source =
        input.character_claims[0].current_turn_claims[0];
      const target =
        input.character_claims[0].prior_claims[0];
      assert.equal(source.proposition, nativeCurrentClaimText);
      assert.equal(target.proposition, nativePriorClaimText);

      return [
        {
          proposal_ref: "native-phase65b-challenge",
          character: nativeObserver,
          source_claim_event_id: source.claim_event_id,
          target_claim_event_id: target.claim_event_id,
          relation: "challenges",
        },
      ];
    };

  const firstTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          nativeSession.world_simulation_session_id,
        event_id: nativeFirstEventId,
      },
      {
        ...nativeOptions,
        subjectiveClaimResolver,
        subjectiveClaimRelationResolver,
        characterBrain:
          async (packet) => {
            brainInputs.push(structuredClone(packet));
            const serialized = JSON.stringify(packet);
            assert.equal(
              serialized.includes(nativePriorClaimText),
              false,
            );
            assert.equal(
              serialized.includes(nativeCurrentClaimText),
              false,
            );
            assert.deepEqual(
              packet.cognition.subjective_cognition.claims,
              [],
              "first-turn Character Brain may receive the Phase65C surface, but no same-turn claim may appear in it",
            );
            assert.deepEqual(
              packet.cognition.subjective_cognition.relations,
              [],
            );
            assert.equal(serialized.includes("source_memory_ref"), false);
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

  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.equal(
    firstTurn.subjective_claim_conflict_revision_projection
      .processed_proposal_count,
    0,
  );
  assert.equal(
    firstTurn.subjective_claim_conflict_revision_projection
      .created_relation_event_count,
    0,
  );

  const stateAfterFirst =
    await getWorldSimulationState(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );
  assert.equal(
    Object.keys(stateAfterFirst.state.subjective_claim_events).length,
    1,
  );
  assert.equal(
    Object.hasOwn(
      stateAfterFirst.state,
      "subjective_claim_relation_events",
    ),
    false,
    "empty first-turn relation output must not create synthetic relation containers",
  );
  firstCommittedClaimSnapshot =
    structuredClone(
      Object.values(
        stateAfterFirst.state.subjective_claim_events,
      )[0],
    );

  const secondTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          nativeSession.world_simulation_session_id,
        event_id: nativeSecondEventId,
      },
      {
        ...nativeOptions,
        subjectiveClaimResolver,
        subjectiveClaimRelationResolver,
        characterBrain:
          async (packet) => {
            brainInputs.push(structuredClone(packet));
            const serialized = JSON.stringify(packet);
            assert.equal(
              serialized.includes(nativePriorClaimText),
              true,
              "Phase65C must expose the already committed prior subjective claim",
            );
            assert.equal(
              serialized.includes(nativeCurrentClaimText),
              false,
              "the second-turn claim is not formed until after Character Brain runs",
            );
            assert.deepEqual(
              packet.cognition.subjective_cognition.claims,
              [
                {
                  proposition: nativePriorClaimText,
                  subjective_not_world_truth: true,
                },
              ],
            );
            assert.equal(
              packet.boundaries
                .subjective_cognition_same_turn_claim_feedback_allowed,
              false,
            );
            assert.equal(serialized.includes("source_memory_ref"), false);
            return {
              action_id: "continue-observing",
            };
          },
        causalAdjudicator: nativeNoOpAdjudicator,
      },
    );

  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.equal(claimResolverCallCount, 2);
  assert.equal(relationResolverCallCount, 2);
  assert.equal(brainInputs.length, 2);
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .resolver_used,
    true,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .processed_proposal_count,
    1,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .created_relation_event_count,
    1,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .appended_history_reference_count,
    1,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .same_turn_character_brain_feedback_allowed,
    false,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .confidence_probability_modeled,
    false,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .truth_resolution_applied,
    false,
  );
  assert.equal(
    secondTurn.subjective_claim_conflict_revision_projection
      .historical_claim_mutation_allowed,
    false,
  );

  const finalState =
    await getWorldSimulationState(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );
  assert.equal(
    Object.keys(finalState.state.subjective_claim_events).length,
    2,
    "both competing historical claims must coexist",
  );
  assert.equal(
    Object.keys(finalState.state.subjective_claim_relation_events).length,
    1,
  );
  assert.equal(
    finalState.state.subjective_claim_relation_history.length,
    1,
  );
  assert.deepEqual(
    finalState.state.subjective_claim_events[
      firstCommittedClaimSnapshot.claim_event_id
    ],
    firstCommittedClaimSnapshot,
    "Phase65B challenge must not rewrite the prior claim",
  );

  const relationEvent =
    Object.values(
      finalState.state.subjective_claim_relation_events,
    )[0];
  assert.equal(relationEvent.relation, "challenges");
  assert.equal(relationEvent.semantic_state.target_claim_invalidated, false);
  assert.equal(relationEvent.semantic_state.world_truth_verified, false);
  assert.equal(relationEvent.semantic_state.confidence, null);

  const history =
    await getWorldSimulationHistory(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );
  assert.equal(history.turns.length, 2);
  assert.equal(
    history.turns[1]
      .subjective_claim_relation_proposal_resolution
      .proposals
      .length,
    1,
  );
  assert.equal(
    typeof history.turns[1]
      .subjective_claim_relation_proposal_resolution
      .resolver_view_hash,
    "string",
  );
  assert.equal(
    Object.hasOwn(
      history.turns[1]
        .subjective_claim_relation_proposal_resolution,
      "resolver_view",
    ),
    false,
  );
  assert.equal(
    history.turns[1]
      .subjective_claim_conflict_revision_projection
      .result
      .relation_events_created
      .length,
    1,
  );
  assert.equal(
    Object.hasOwn(
      history.turns[1]
        .subjective_claim_conflict_revision_projection
        .result,
      "preview_world_state",
    ),
    false,
  );
  assert.equal(
    history.turns[1]
      .subjective_claim_relation_mutation_execution
      .sole_final_world_state_writer,
    true,
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

console.log("Phase65B subjective claim conflict / revision projection tests passed.");
