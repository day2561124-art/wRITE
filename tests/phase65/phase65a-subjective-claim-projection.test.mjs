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
  buildWorldSimulationSubjectiveClaimProjectionContract,
  buildWorldSimulationSubjectiveClaimResolverView,
  buildWorldSimulationSubjectiveClaims,
  subjectiveClaimEventSchemaVersion,
  subjectiveClaimHistoryReferenceSchemaVersion,
  worldSimulationSubjectiveClaimProjectionVersion,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";

const character = "伊萊亞斯・諾爾";
const turnId = "world_turn_phase65a_fixture";

const memoryA = {
  memory_id: "memory_phase65a_a",
  memory_type: "episodic_direct_perception",
  content: {
    kind: "visual_observation",
    description: "阿灰在沒有明顯手勢時自行移動到門口。",
  },
  source: {
    kind: "direct_perception",
    sense: "visual",
  },
  internal_provenance: {
    event_id: "event_phase65a",
    scene_id: "scene_phase65a",
    turn_id: turnId,
    observation_hash: "observation_hash_a",
    formation_version: "phase63a-subjective-memory-formation-v1",
  },
  perceptual_certainty_at_encoding: 0.8,
  perceptual_certainty_origin: "fixture",
  perceptual_clarity_at_encoding: 0.75,
  perceptual_clarity_origin: "fixture",
  encoded_at: "2026-09-05T14:10:00+08:00",
  formation_stage: "encoded_unconsolidated",
  engine_persisted_trace: true,
  last_recalled_at: null,
  accessible: true,
  suppressed: false,
  possibly_incorrect: false,
  source_confused: false,
  subjective_memory_not_world_truth: true,
};

const memoryB = {
  memory_id: "memory_phase65a_b",
  memory_type: "episodic_direct_perception",
  content: {
    kind: "auditory_observation",
    description: "伊萊亞斯說自己沒有下指令。",
  },
  source: {
    kind: "direct_perception",
    sense: "auditory",
  },
  internal_provenance: {
    event_id: "event_phase65a",
    scene_id: "scene_phase65a",
    turn_id: turnId,
    observation_hash: "observation_hash_b",
    formation_version: "phase63a-subjective-memory-formation-v1",
  },
  perceptual_certainty_at_encoding: 0.7,
  perceptual_certainty_origin: "fixture",
  perceptual_clarity_at_encoding: 0.65,
  perceptual_clarity_origin: "fixture",
  encoded_at: "2026-09-05T14:10:00+08:00",
  formation_stage: "encoded_unconsolidated",
  engine_persisted_trace: true,
  last_recalled_at: null,
  accessible: true,
  suppressed: false,
  possibly_incorrect: false,
  source_confused: false,
  subjective_memory_not_world_truth: true,
};

const oldMemory = {
  memory_id: "memory_phase65a_old",
  memory_type: "episodic_direct_perception",
  content: {
    description: "更早以前的另一段記憶。",
  },
  source: {
    kind: "direct_perception",
    sense: "visual",
  },
  internal_provenance: {
    turn_id: "world_turn_old",
  },
  formation_stage: "encoded_unconsolidated",
  subjective_memory_not_world_truth: true,
};

const initialWorldState = {
  simulation_time: "2026-09-05T14:10:00+08:00",
  memories: {
    [character]: [
      oldMemory,
      memoryA,
      memoryB,
    ],
  },
};

const sourceMemoryRecords = [
  {
    character,
    memory_record: memoryA,
  },
  {
    character,
    memory_record: memoryB,
  },
];

const contract =
  buildWorldSimulationSubjectiveClaimProjectionContract();

assert.equal(
  contract.version,
  worldSimulationSubjectiveClaimProjectionVersion,
);
assert.equal(
  contract.phase,
  "Phase65A",
);
assert.equal(
  contract.source_scope,
  "current_turn_new_subjective_memories_only",
);
assert.equal(
  contract.source_memory_hash_verified,
  true,
);
assert.equal(
  contract.source_memory_content_rewrite_allowed,
  false,
);
assert.equal(
  contract.claim_event_write_once_required,
  true,
);
assert.equal(
  contract.claim_history_append_only_required,
  true,
);
assert.equal(
  contract.multiple_candidate_claims_preserved,
  true,
);
assert.equal(
  contract.semantic_conflict_resolution_modeled,
  false,
);
assert.equal(
  contract.last_write_wins_allowed,
  false,
);
assert.equal(
  contract.belief_revision_modeled,
  false,
);
assert.equal(
  contract.confidence_probability_modeled,
  false,
);
assert.equal(
  contract.world_truth_authority_claimed,
  false,
);
assert.equal(
  contract.persistent_mind_database_installed,
  false,
);
assert.equal(
  contract.character_brain_exposure_installed,
  false,
);
assert.equal(
  contract.same_turn_character_brain_feedback_allowed,
  false,
);
assert.equal(
  contract.retrieval_frequency_counts_as_evidence,
  false,
);
assert.equal(
  contract.accessibility_strength_counts_as_evidence,
  false,
);
assert.equal(
  contract.plasticity_strength_counts_as_truth_support,
  false,
);
assert.equal(
  contract.hidden_semantic_graph_traversal_allowed,
  false,
);
assert.equal(
  contract.native_world_loop_adoption_installed,
  true,
);

const mutationContract =
  buildWorldSimulationChronologicalMutationQueueContract();

assert.equal(
  mutationContract.execution
    .phase65a_subjective_claim_event_write_once_enforced,
  true,
);
assert.equal(
  mutationContract.execution
    .phase65a_subjective_claim_event_content_address_verified,
  true,
);
assert.equal(
  mutationContract.execution
    .phase65a_subjective_claim_evidence_memory_hash_verified,
  true,
);
assert.equal(
  mutationContract.execution
    .phase65a_subjective_claim_history_append_only_enforced,
  true,
);
assert.equal(
  mutationContract.execution
    .direct_nested_subjective_claim_history_mutation_rejected,
  true,
);

const resolverView =
  buildWorldSimulationSubjectiveClaimResolverView({
    world_state: initialWorldState,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
  });

assert.equal(
  resolverView.character_evidence.length,
  1,
);
assert.equal(
  resolverView.character_evidence[0].character,
  character,
);
assert.deepEqual(
  resolverView.character_evidence[0]
    .memories
    .map((memory) => memory.source_memory_ref),
  [
    memoryA.memory_id,
    memoryB.memory_id,
  ],
);
assert.equal(
  Object.hasOwn(resolverView, "world_state"),
  false,
);
assert.equal(
  Object.hasOwn(resolverView, "event"),
  false,
);
const resolverViewText =
  JSON.stringify(resolverView);
assert.equal(
  resolverViewText.includes("internal_provenance"),
  false,
  "claim resolver must not receive engine-internal memory provenance",
);
assert.equal(
  resolverViewText.includes("perceptual_certainty_at_encoding"),
  false,
  "Phase65A must not smuggle an uncalibrated certainty scalar into semantic claim authority",
);
assert.equal(
  resolverViewText.includes("perceptual_clarity_at_encoding"),
  false,
);
assert.equal(
  resolverViewText.includes(oldMemory.memory_id),
  false,
  "the whole persistent memory store must not be exposed to the Phase65A resolver",
);

const memorySnapshot =
  structuredClone(initialWorldState.memories);

const proposals = [
  {
    proposal_ref: "proposal_autonomy",
    character,
    proposition: "阿灰可能具有不依賴伊萊亞斯有意識指令的自主行動能力。",
    evidence: [
      {
        source_memory_ref: memoryA.memory_id,
        relation: "supports",
      },
      {
        source_memory_ref: memoryB.memory_id,
        relation: "supports",
      },
    ],
  },
  {
    proposal_ref: "proposal_unnoticed_control",
    character,
    proposition: "阿灰的行動仍可能受伊萊亞斯尚未察覺的控制機制影響。",
    evidence: [
      {
        source_memory_ref: memoryA.memory_id,
        relation: "supports",
      },
      {
        source_memory_ref: memoryB.memory_id,
        relation: "conflicts",
      },
    ],
  },
];

const built =
  buildWorldSimulationSubjectiveClaims({
    world_state: initialWorldState,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
    claim_proposals: proposals,
  });

assert.equal(
  built.version,
  worldSimulationSubjectiveClaimProjectionVersion,
);
assert.equal(
  built.result.processed_proposal_count,
  2,
);
assert.equal(
  built.result.claim_events_created.length,
  2,
  "competing candidate interpretations must coexist instead of last-write-wins replacement",
);
assert.equal(
  built.result.history_references_appended.length,
  2,
);
assert.equal(
  built.result.state_transitions.length,
  3,
  "two write-once claim events plus one append-only history transition are expected",
);
assert.deepEqual(
  built.result.preview_world_state.memories,
  memorySnapshot,
  "Phase65A must not rewrite episodic memories while deriving semantic claims",
);

for (const event of built.result.claim_events_created) {
  assert.equal(
    event.schema_version,
    subjectiveClaimEventSchemaVersion,
  );
  assert.equal(event.immutable, true);
  assert.equal(
    event.status,
    "candidate_subjective_claim",
  );
  assert.equal(
    event.semantic_state.world_truth_verified,
    false,
  );
  assert.equal(
    event.semantic_state.confidence,
    null,
  );
  assert.equal(
    event.semantic_state.probability,
    null,
  );
  assert.equal(
    event.semantic_state.conflict_resolution_applied,
    false,
  );
  assert.equal(
    event.semantic_state.belief_revision_applied,
    false,
  );
  assert.equal(
    event.engine_audit.retrieval_frequency_used_as_evidence,
    false,
  );
  assert.equal(
    event.engine_audit.accessibility_strength_used_as_evidence,
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
  assert.equal(
    event.engine_audit.last_write_wins_applied,
    false,
  );

  const hashBody = structuredClone(event);
  delete hashBody.claim_event_hash;
  assert.equal(
    event.claim_event_hash,
    hashAgentRunValue(hashBody),
    "write-once SubjectiveClaimEvent must be content-address verified",
  );

  for (const evidence of event.evidence) {
    const canonicalMemory =
      initialWorldState.memories[character]
        .find(
          (memory) =>
            memory.memory_id
            === evidence.source_memory_ref,
        );
    assert.ok(canonicalMemory);
    assert.equal(
      evidence.source_memory_hash,
      hashAgentRunValue(canonicalMemory),
      "claim evidence must pin the exact canonical subjective-memory image",
    );
  }
}

for (const reference of built.result.history_references_appended) {
  assert.equal(
    reference.schema_version,
    subjectiveClaimHistoryReferenceSchemaVersion,
  );
  assert.equal(
    reference.derived_index,
    true,
  );
}

const reordered =
  buildWorldSimulationSubjectiveClaims({
    world_state: initialWorldState,
    turn_id: turnId,
    source_memory_records: [
      sourceMemoryRecords[1],
      sourceMemoryRecords[0],
    ],
    claim_proposals: [
      proposals[1],
      proposals[0],
    ],
  });

assert.deepEqual(
  reordered.result.preview_world_state,
  built.result.preview_world_state,
  "caller proposal/source ordering must not change deterministic claim projection",
);

const queue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id: `${turnId}:subjective_claim`,
    world_state_hash: hashAgentRunValue(initialWorldState),
    state_transitions: built.result.state_transitions,
    elapsed_ms: 0,
  });

const executed =
  executeWorldSimulationChronologicalMutationQueue({
    world_state: initialWorldState,
    preview_world_state: built.result.preview_world_state,
    queue,
  });

assert.equal(
  Object.keys(
    executed.next_world_state.subjective_claim_events,
  ).length,
  2,
);
assert.equal(
  executed.next_world_state.subjective_claim_history.length,
  2,
);
assert.deepEqual(
  executed.next_world_state.memories,
  memorySnapshot,
);

const replay =
  buildWorldSimulationSubjectiveClaims({
    world_state: executed.next_world_state,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
    claim_proposals: proposals,
  });

assert.equal(
  replay.result.claim_events_created.length,
  0,
);
assert.equal(
  replay.result.already_persisted_claim_event_ids.length,
  2,
);
assert.equal(
  replay.result.history_references_appended.length,
  0,
);
assert.equal(
  replay.result.state_transitions.length,
  0,
  "deterministic replay of already-persisted Phase65A claims must be a no-op",
);

const persistedClaimEvents =
  executed.next_world_state.subjective_claim_events;
const persistedClaimEvent =
  Object.values(persistedClaimEvents)[0];

const illegallyModifiedClaimEvent = {
  ...structuredClone(persistedClaimEvent),
  proposition:
    `${persistedClaimEvent.proposition}（非法覆寫）`,
};

const overwriteClaimQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      `${turnId}:illegal_claim_overwrite`,
    world_state_hash:
      hashAgentRunValue(executed.next_world_state),
    state_transitions: [
      {
        entity: "world",
        field:
          `subjective_claim_events.${persistedClaimEvent.claim_event_id}`,
        from:
          persistedClaimEvent,
        to:
          illegallyModifiedClaimEvent,
        cause:
          "illegal Phase65A claim overwrite fixture",
        source_layer:
          "subjective_claim_projection",
      },
    ],
    elapsed_ms: 0,
  });

const overwriteClaimPreview =
  structuredClone(executed.next_world_state);
overwriteClaimPreview.subjective_claim_events[
  persistedClaimEvent.claim_event_id
] = illegallyModifiedClaimEvent;

for (const applyMutation of [
  () =>
    projectWorldSimulationChronologicalMutationQueue({
      world_state:
        executed.next_world_state,
      queue:
        overwriteClaimQueue,
    }),
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        executed.next_world_state,
      preview_world_state:
        overwriteClaimPreview,
      queue:
        overwriteClaimQueue,
    }),
]) {
  assert.throws(
    applyMutation,
    (error) =>
      error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVENT_IMMUTABILITY_VIOLATION",
    "Phase62K projection and authoritative execution must both reject SubjectiveClaimEvent overwrite",
  );
}

const reorderedHistory = [
  ...executed.next_world_state.subjective_claim_history,
].reverse();

const rewriteClaimHistoryQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      `${turnId}:illegal_claim_history_rewrite`,
    world_state_hash:
      hashAgentRunValue(executed.next_world_state),
    state_transitions: [
      {
        entity: "world",
        field:
          "subjective_claim_history",
        from:
          executed.next_world_state.subjective_claim_history,
        to:
          reorderedHistory,
        cause:
          "illegal Phase65A claim history reorder fixture",
        source_layer:
          "subjective_claim_projection",
      },
    ],
    elapsed_ms: 0,
  });

const rewriteClaimHistoryPreview =
  structuredClone(executed.next_world_state);
rewriteClaimHistoryPreview.subjective_claim_history =
  reorderedHistory;

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        executed.next_world_state,
      preview_world_state:
        rewriteClaimHistoryPreview,
      queue:
        rewriteClaimHistoryQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_APPEND_ONLY_VIOLATION",
  "Phase62K must reject reordering or rewriting existing subjective claim history",
);

const wrongEvidenceHashEvent =
  structuredClone(
    built.result.claim_events_created[0],
  );
wrongEvidenceHashEvent.evidence[0].source_memory_hash =
  "0".repeat(64);
wrongEvidenceHashEvent.claim_event_id =
  `subjective_claim_event_${hashAgentRunValue({
    version:
      worldSimulationSubjectiveClaimProjectionVersion,
    source_turn_id:
      wrongEvidenceHashEvent.source_turn_id,
    character:
      wrongEvidenceHashEvent.character,
    proposition_hash:
      wrongEvidenceHashEvent.proposition_hash,
    evidence:
      wrongEvidenceHashEvent.evidence,
    proposal_ref:
      wrongEvidenceHashEvent.derivation.proposal_ref,
  }).slice(0, 24)}`;
const wrongEvidenceHashBody =
  structuredClone(wrongEvidenceHashEvent);
delete wrongEvidenceHashBody.claim_event_hash;
wrongEvidenceHashEvent.claim_event_hash =
  hashAgentRunValue(wrongEvidenceHashBody);

const wrongEvidenceHashPreview =
  structuredClone(initialWorldState);
wrongEvidenceHashPreview.subjective_claim_events = {
  [wrongEvidenceHashEvent.claim_event_id]:
    wrongEvidenceHashEvent,
};

const wrongEvidenceHashQueue =
  buildWorldSimulationChronologicalMutationQueue({
    turn_id:
      `${turnId}:wrong_evidence_hash`,
    world_state_hash:
      hashAgentRunValue(initialWorldState),
    state_transitions: [
      {
        entity: "world",
        field:
          `subjective_claim_events.${wrongEvidenceHashEvent.claim_event_id}`,
        from:
          null,
        to:
          wrongEvidenceHashEvent,
        cause:
          "invalid Phase65A evidence hash fixture",
        source_layer:
          "subjective_claim_projection",
      },
    ],
    elapsed_ms: 0,
  });

assert.throws(
  () =>
    executeWorldSimulationChronologicalMutationQueue({
      world_state:
        initialWorldState,
      preview_world_state:
        wrongEvidenceHashPreview,
      queue:
        wrongEvidenceHashQueue,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_MEMORY_HASH_MISMATCH",
  "Phase62K must independently verify evidence-memory hashes even when the ClaimEvent hash itself is internally valid",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaims({
      world_state: initialWorldState,
      turn_id: turnId,
      source_memory_records: sourceMemoryRecords,
      claim_proposals: [
        {
          ...proposals[0],
          probability: 0.9,
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_AUTHORITY_FIELD_FORBIDDEN",
  "Phase65A must reject fake precision / truth-authority fields instead of persisting them",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaims({
      world_state: initialWorldState,
      turn_id: turnId,
      source_memory_records: [
        ...sourceMemoryRecords,
        {
          character,
          memory_record: oldMemory,
        },
      ],
      claim_proposals: [],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SOURCE_MEMORY_NOT_CURRENT_TURN",
  "Phase65A source-set construction itself must fail closed when a caller injects an older episodic memory",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaims({
      world_state: initialWorldState,
      turn_id: turnId,
      source_memory_records: sourceMemoryRecords,
      claim_proposals: [
        {
          proposal_ref: "proposal_illegal_old_memory",
          character,
          proposition: "這個 claim 偷用了整個持久記憶庫。",
          evidence: [
            {
              source_memory_ref: oldMemory.memory_id,
              relation: "supports",
            },
          ],
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_EVIDENCE_OUTSIDE_CURRENT_TURN_SOURCE_SET",
  "Phase65A may not silently widen evidence access to older memories",
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaims({
      world_state: initialWorldState,
      turn_id: turnId,
      source_memory_records: sourceMemoryRecords,
      claim_proposals: [
        {
          proposal_ref: "proposal_conflict_only",
          character,
          proposition: "沒有任何 supporting evidence 的候選 claim。",
          evidence: [
            {
              source_memory_ref: memoryA.memory_id,
              relation: "conflicts",
            },
          ],
        },
      ],
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_SUPPORTING_EVIDENCE_REQUIRED",
);

const corruptedHistory =
  structuredClone(
    executed.next_world_state,
  );
corruptedHistory.subjective_claim_history.push(
  structuredClone(
    corruptedHistory.subjective_claim_history[0],
  ),
);

assert.throws(
  () =>
    buildWorldSimulationSubjectiveClaims({
      world_state: corruptedHistory,
      turn_id: turnId,
      source_memory_records: sourceMemoryRecords,
      claim_proposals: proposals,
    }),
  (error) =>
    error?.code
      === "WORLD_SIMULATION_SUBJECTIVE_CLAIM_HISTORY_DUPLICATE_REFERENCE",
  "corrupt duplicate claim history must fail closed",
);

const noProposalBuild =
  buildWorldSimulationSubjectiveClaims({
    world_state: initialWorldState,
    turn_id: turnId,
    source_memory_records: sourceMemoryRecords,
    claim_proposals: [],
  });

assert.equal(
  noProposalBuild.result.state_transitions.length,
  0,
);
assert.equal(
  Object.hasOwn(
    noProposalBuild.result.preview_world_state,
    "subjective_claim_events",
  ),
  false,
  "missing/empty resolver output must not create synthetic claim containers",
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

assert.ok(
  loopSource.includes(
    "buildWorldSimulationSubjectiveClaimProjectionContract",
  ),
);
assert.ok(
  loopSource.includes(
    "subjectiveClaimResolver",
  ),
);
assert.ok(
  loopSource.includes(
    "current_turn_new_subjective_memories_only",
  ),
);
assert.ok(
  loopSource.includes(
    "next_world_state: subjectiveClaimMutationExecution.next_world_state",
  ),
  "atomic world commit must use the state after authoritative claim mutation execution",
);

const memoryExecutionIndex =
  loopSource.indexOf(
    "const subjectiveMemoryMutationExecution =",
  );
const claimProposalIndex =
  loopSource.indexOf(
    "const subjectiveClaimProposalResolution =",
  );
const claimProjectionIndex =
  loopSource.indexOf(
    "const subjectiveClaimProjection =",
  );
const claimQueueIndex =
  loopSource.indexOf(
    "const subjectiveClaimMutationQueue =",
  );
const commitIndex =
  loopSource.indexOf(
    "const committed = await commitWorldSimulationTurn",
  );

assert.ok(memoryExecutionIndex >= 0);
assert.ok(claimProposalIndex > memoryExecutionIndex);
assert.ok(claimProjectionIndex > claimProposalIndex);
assert.ok(claimQueueIndex > claimProjectionIndex);
assert.ok(commitIndex > claimQueueIndex);

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
  loopSource.indexOf(
    "const subjectiveClaimProjection =",
  ) < runCharacterTurnIndex,
  "claim implementation lives in resolveWorldSimulationTurn; the runtime brain call occurs before resolveWorldSimulationTurn is invoked for the same turn",
);

for (const historyField of [
  "subjective_claim_proposal_resolution",
  "subjective_claim_projection",
  "subjective_claim_mutation_queue",
  "subjective_claim_mutation_execution",
]) {
  assert.ok(
    stateSource.includes(historyField),
    `world history must persist ${historyField} for Phase65A auditability`,
  );
}

const nativeFixtureRoot =
  path.join(
    projectRoot,
    "tests",
    ".tmp",
    `phase65a-subjective-claim-${process.pid}-${Date.now()}`,
  );

const nativeOptions = {
  fixtureRoot:
    nativeFixtureRoot,
};

const nativeObserver =
  "phase65a-native-observer";
const nativeTarget =
  "phase65a-native-target";
const nativeSceneId =
  "phase65a-native-scene";
const nativeFirstEventId =
  "phase65a-native-event-1";
const nativeSecondEventId =
  "phase65a-native-event-2";
const nativeClaimText =
  "眼前的灰色生物可能會在沒有明顯有意識指令時自行移動。";

const nativeWorldState = {
  simulation_time:
    "2026-09-05T14:20:00+08:00",
  world_rules: {
    default_vision_range_m:
      30,
  },
  event_queue: [
    {
      event_id:
        nativeFirstEventId,
      type:
        "observe_autonomous_motion",
      scene_id:
        nativeSceneId,
      participants: [
        nativeObserver,
      ],
    },
    {
      event_id:
        nativeSecondEventId,
      type:
        "observe_again",
      scene_id:
        nativeSceneId,
      participants: [
        nativeObserver,
      ],
    },
  ],
  scenes: {
    [nativeSceneId]: {
      scene_id:
        nativeSceneId,
      dimensions: {
        width_m: 10,
        depth_m: 10,
      },
      entity_positions: {
        [nativeObserver]: {
          x: 0,
          y: 0,
        },
        [nativeTarget]: {
          x: 3,
          y: 0,
        },
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
            "眼前的灰色生物在沒有明顯手勢時自行移動。",
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
      current_action:
        "觀察眼前動作",
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
        action_id:
          "continue-observing",
        intent:
          "維持位置並繼續觀察",
      },
    ],
  },
};

function nativeNoOpAdjudicator(input) {
  const next =
    structuredClone(
      input.world_state,
    );

  next.event_queue =
    next.event_queue.slice(1);

  return {
    causal_resolution_id:
      `phase65a-noop-${input.event.event_id}`,
    next_world_state:
      next,
    state_transitions: [],
    action_outcomes: [
      {
        actor:
          nativeObserver,
        action_id:
          "continue-observing",
        result:
          "continued_observing",
        causal_evidence:
          "Phase65A fixture leaves hard state unchanged except event queue consumption",
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
          "Phase65A native subjective claim adoption fixture",
        seed:
          "phase65a-native-claim",
        rules: {
          event_driven: true,
          persistent_causality: true,
        },
        initial_world_state:
          nativeWorldState,
      },
      nativeOptions,
    );

  let resolverCallCount = 0;
  const nativeBrainInputs = [];

  const nativeClaimResolver =
    async (input) => {
      resolverCallCount += 1;

      assert.equal(
        Object.hasOwn(input, "world_state"),
        false,
      );
      assert.equal(
        Object.hasOwn(input, "event"),
        false,
      );
      assert.equal(
        input.boundaries
          .current_turn_new_subjective_memories_only,
        true,
      );
      assert.equal(
        input.boundaries
          .whole_persistent_memory_store_exposed,
        false,
      );
      assert.equal(
        input.boundaries
          .retrieval_frequency_exposed_as_evidence,
        false,
      );
      assert.equal(
        input.boundaries
          .accessibility_strength_exposed_as_evidence,
        false,
      );

      const serialized =
        JSON.stringify(input);

      assert.equal(
        serialized.includes("internal_provenance"),
        false,
      );
      assert.equal(
        serialized.includes("perceptual_certainty_at_encoding"),
        false,
      );
      assert.equal(
        input.character_evidence.length,
        1,
      );
      assert.equal(
        input.character_evidence[0].character,
        nativeObserver,
      );
      assert.ok(
        input.character_evidence[0].memories.length >= 1,
      );

      if (resolverCallCount > 1) {
        return [];
      }

      return [
        {
          proposal_ref:
            "native-phase65a-autonomy-candidate",
          character:
            nativeObserver,
          proposition:
            nativeClaimText,
          evidence: [
            {
              source_memory_ref:
                input.character_evidence[0]
                  .memories[0]
                  .source_memory_ref,
              relation:
                "supports",
            },
          ],
        },
      ];
    };

  const firstTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          nativeSession.world_simulation_session_id,
        event_id:
          nativeFirstEventId,
      },
      {
        ...nativeOptions,
        subjectiveClaimResolver:
          nativeClaimResolver,
        characterBrain:
          async (packet) => {
            nativeBrainInputs.push(
              structuredClone(packet),
            );

            const serialized =
              JSON.stringify(packet);

            assert.equal(
              serialized.includes(nativeClaimText),
              false,
              "Turn N Character Brain must run before the Turn N subjective claim is derived",
            );
            assert.equal(
              serialized.includes("subjective_claim"),
              false,
            );

            return {
              action_id:
                "continue-observing",
            };
          },
        causalAdjudicator:
          nativeNoOpAdjudicator,
      },
    );

  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.committed, true);
  assert.equal(
    firstTurn.subjective_claim_projection.version,
    worldSimulationSubjectiveClaimProjectionVersion,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.resolver_used,
    true,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.processed_proposal_count,
    1,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.created_claim_event_count,
    1,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.appended_history_reference_count,
    1,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.same_turn_character_brain_feedback_allowed,
    false,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.confidence_probability_modeled,
    false,
  );
  assert.equal(
    firstTurn.subjective_claim_projection.belief_revision_modeled,
    false,
  );

  const stateAfterFirst =
    await getWorldSimulationState(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );

  assert.equal(
    Object.keys(
      stateAfterFirst.state.subjective_claim_events,
    ).length,
    1,
  );
  assert.equal(
    stateAfterFirst.state.subjective_claim_history.length,
    1,
  );
  assert.equal(
    stateAfterFirst.state.memories[nativeObserver].length,
    1,
  );

  const nativeClaimEvent =
    Object.values(
      stateAfterFirst.state.subjective_claim_events,
    )[0];

  assert.equal(
    nativeClaimEvent.proposition,
    nativeClaimText,
  );
  assert.equal(
    nativeClaimEvent.semantic_state.world_truth_verified,
    false,
  );
  assert.equal(
    nativeClaimEvent.semantic_state.probability,
    null,
  );
  assert.equal(
    nativeClaimEvent.engine_audit.same_turn_character_brain_feedback_allowed,
    false,
  );
  assert.equal(
    nativeClaimEvent.evidence.length,
    1,
  );
  assert.equal(
    nativeClaimEvent.evidence[0].source_memory_ref,
    stateAfterFirst.state.memories[nativeObserver][0].memory_id,
  );
  assert.equal(
    nativeClaimEvent.evidence[0].source_memory_hash,
    hashAgentRunValue(
      stateAfterFirst.state.memories[nativeObserver][0],
    ),
  );

  const historyAfterFirst =
    await getWorldSimulationHistory(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );

  assert.equal(
    historyAfterFirst.turns.length,
    1,
  );
  assert.equal(
    historyAfterFirst.turns[0]
      .subjective_claim_proposal_resolution
      .proposals
      .length,
    1,
  );
  assert.equal(
    typeof historyAfterFirst.turns[0]
      .subjective_claim_proposal_resolution
      .resolver_view_hash,
    "string",
  );
  assert.equal(
    Object.hasOwn(
      historyAfterFirst.turns[0]
        .subjective_claim_proposal_resolution,
      "resolver_view",
    ),
    false,
    "history should retain an audit hash rather than duplicate the bounded resolver evidence payload",
  );
  assert.equal(
    historyAfterFirst.turns[0]
      .subjective_claim_projection
      .result
      .claim_events_created
      .length,
    1,
  );
  assert.equal(
    Object.hasOwn(
      historyAfterFirst.turns[0]
        .subjective_claim_projection
        .result,
      "preview_world_state",
    ),
    false,
    "claim audit history must not duplicate the full post-projection world snapshot",
  );
  assert.equal(
    historyAfterFirst.turns[0]
      .subjective_claim_mutation_execution
      .sole_final_world_state_writer,
    true,
  );

  const secondTurn =
    await runWorldSimulationTurn(
      {
        world_simulation_session_id:
          nativeSession.world_simulation_session_id,
        event_id:
          nativeSecondEventId,
      },
      {
        ...nativeOptions,
        subjectiveClaimResolver:
          nativeClaimResolver,
        characterBrain:
          async (packet) => {
            nativeBrainInputs.push(
              structuredClone(packet),
            );

            const serialized =
              JSON.stringify(packet);

            assert.equal(
              serialized.includes(nativeClaimText),
              false,
              "Phase65A does not expose persisted claims to Character Brain even on the next turn",
            );
            assert.equal(
              serialized.includes("subjective_claim"),
              false,
            );

            return {
              action_id:
                "continue-observing",
            };
          },
        causalAdjudicator:
          nativeNoOpAdjudicator,
      },
    );

  assert.equal(secondTurn.ok, true);
  assert.equal(secondTurn.committed, true);
  assert.equal(resolverCallCount, 2);
  assert.equal(nativeBrainInputs.length, 2);
  assert.equal(
    secondTurn.subjective_claim_projection.processed_proposal_count,
    0,
  );
  assert.equal(
    secondTurn.subjective_claim_projection.created_claim_event_count,
    0,
  );

  const finalNativeState =
    await getWorldSimulationState(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );

  assert.equal(
    Object.keys(
      finalNativeState.state.subjective_claim_events,
    ).length,
    1,
    "no second-turn proposal means the prior immutable claim remains without rewrite",
  );
  assert.equal(
    finalNativeState.state.subjective_claim_history.length,
    1,
  );
  assert.equal(
    finalNativeState.state.memories[nativeObserver].length,
    2,
    "second turn should append a new episodic trace rather than rewrite the first-turn evidence",
  );

  const finalNativeHistory =
    await getWorldSimulationHistory(
      nativeSession.world_simulation_session_id,
      nativeOptions,
    );

  assert.equal(finalNativeHistory.turns.length, 2);
  assert.equal(
    finalNativeHistory.turns[1]
      .subjective_claim_projection
      .result
      .claim_events_created
      .length,
    0,
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

console.log("Phase65A evidence-backed subjective claim projection tests passed.");
