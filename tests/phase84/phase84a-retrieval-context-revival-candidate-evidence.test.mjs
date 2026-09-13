import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  buildWorldSimulationRetrievalContextRevivalCandidateEvidence,
  buildWorldSimulationRetrievalContextRevivalCandidateEvidenceContract,
  worldSimulationRetrievalContextRevivalCandidateEvidenceVersion,
} from "../../server/src/world-simulation-retrieval-context-revival-candidate-evidence-service.mjs";

function memory(memoryId, sceneId, encodedAt, extra = {}) {
  return {
    ...extra,
    memory_id: memoryId,
    encoded_at: encodedAt,
    retrieval_cues: {
      scene_id: sceneId,
      ...extra.retrieval_cues,
    },
  };
}

function retrievalEvent({
  id = "memory_retrieval_event_phase84a_fixture",
  character = "Alice",
  turnId = "turn-1",
  occurredAt = "2026-09-02T00:00:00.000Z",
  recoveredIds = ["m-source"],
} = {}) {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: id,
    retrieval_process_id: `${id}_process`,
    retrieval_process_version: "phase63c-fixture",
    retrieval_process_hash: "fixture-process-hash",
    character,
    turn_id: turnId,
    occurred_at: occurredAt,
    occurred_at_precision: "turn_context",
    initiation: null,
    retrieval_task: null,
    target: null,
    search_orientation: null,
    search_steps: [],
    recovered_content: [],
    recovery_occurrences: [],
    memory_recoveries: recoveredIds.map((memoryId, index) => ({
      memory_recovery_id: `${id}_recovery_${index}`,
      source_memory_ref: memoryId,
      recovered_fragment_ids: [],
      recovery_occurrence_ids: [],
      recovery_extent: "partial_content",
      target_relation: "non_target",
    })),
    target_outcome: null,
    recovered_any_content: recoveredIds.length > 0,
    termination: null,
    engine_audit: {},
    immutable: true,
  };
  return {
    ...body,
    retrieval_event_hash: hashAgentRunValue(body),
  };
}

const memories = [
  memory("m-source", "library", "2026-09-01T00:00:00.000Z", {
    retrieval_cues: { subjective_episode_id: "episode-source" },
  }),
  memory("m-shared", "library", "2026-09-01T01:00:00.000Z", {
    retrieval_cues: { subjective_episode_id: "episode-other" },
  }),
  memory("m-unrelated", "courtyard", "2026-09-01T02:00:00.000Z"),
  memory("m-late", "library", "2026-09-02T01:00:00.000Z"),
];

const event = retrievalEvent();
const worldState = {
  simulation_time: "2026-09-03T00:00:00.000Z",
  retrieval_events: {
    [event.retrieval_event_id]: event,
  },
};

const input = {
  world_state: worldState,
  character: "Alice",
  current_turn_id: "turn-2",
  as_of: "2026-09-03T00:00:00.000Z",
  memory_records: memories,
};

const beforeHash = hashAgentRunValue(input);
const result = buildWorldSimulationRetrievalContextRevivalCandidateEvidence(input);
assert.equal(hashAgentRunValue(input), beforeHash, "Phase84A must not mutate input state.");
assert.equal(result.version, worldSimulationRetrievalContextRevivalCandidateEvidenceVersion);
assert.equal(result.phase, "Phase84A");
assert.deepEqual(result.input_memory_ids, ["m-source", "m-shared", "m-unrelated", "m-late"]);
assert.deepEqual(result.source_retrieval_event_ids, [event.retrieval_event_id]);
assert.deepEqual(result.revival_candidates.map((entry) => entry.memory_id), ["m-shared"]);
assert.equal(result.revival_candidates[0].evidence.length, 1);
assert.equal(result.revival_candidates[0].evidence[0].recovered_source_memory_id, "m-source");
assert.deepEqual(
  result.revival_candidates[0].evidence[0].shared_context_cues.map((cue) => [cue.kind, cue.value]),
  [["spatial_context", "library"]],
);
assert.equal(result.revival_candidates[0].evidence[0].candidate_not_recovered_by_source_event, true);
assert.equal(result.audit.accessibility_reordering_performed, false);
assert.equal(result.audit.storage_strength_mutated, false);
assert.equal(result.audit.retrieval_strength_mutated, false);
assert.equal(result.audit.causal_context_reinstatement_mechanism_asserted, false);
assert.equal(result.audit.downstream_accessibility_effect_requires_separate_phase, true);

const sameTurnEvent = retrievalEvent({ id: "same-turn", turnId: "turn-2" });
const sameTurn = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
  ...input,
  world_state: {
    ...worldState,
    retrieval_events: { [sameTurnEvent.retrieval_event_id]: sameTurnEvent },
  },
});
assert.deepEqual(sameTurn.revival_candidates, []);
assert.equal(sameTurn.audit.same_turn_retrieval_feedback_used, false);

const candidateAlsoRecoveredEvent = retrievalEvent({
  id: "candidate-also-recovered",
  recoveredIds: ["m-source", "m-shared"],
});
const candidateAlsoRecovered = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
  ...input,
  world_state: {
    ...worldState,
    retrieval_events: {
      [candidateAlsoRecoveredEvent.retrieval_event_id]: candidateAlsoRecoveredEvent,
    },
  },
});
assert.deepEqual(candidateAlsoRecovered.revival_candidates, []);

const futureEvent = retrievalEvent({
  id: "future-event",
  occurredAt: "2026-09-04T00:00:00.000Z",
});
const future = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
  ...input,
  world_state: {
    ...worldState,
    retrieval_events: { [futureEvent.retrieval_event_id]: futureEvent },
  },
});
assert.deepEqual(future.revival_candidates, []);

const unsuccessfulEvent = retrievalEvent({ id: "unsuccessful-event" });
const unsuccessfulBody = { ...unsuccessfulEvent, recovered_any_content: false };
delete unsuccessfulBody.retrieval_event_hash;
const unsuccessful = {
  ...unsuccessfulBody,
  retrieval_event_hash: hashAgentRunValue(unsuccessfulBody),
};
const unsuccessfulResult = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
  ...input,
  world_state: {
    ...worldState,
    retrieval_events: { [unsuccessful.retrieval_event_id]: unsuccessful },
  },
});
assert.deepEqual(unsuccessfulResult.revival_candidates, []);

const unknownEncoding = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
  ...input,
  memory_records: [
    memories[0],
    { ...memories[1], encoded_at: undefined },
  ],
});
assert.deepEqual(unknownEncoding.revival_candidates, []);

const tampered = retrievalEvent({ id: "tampered-event" });
tampered.memory_recoveries[0].source_memory_ref = "m-unrelated";
assert.throws(
  () => buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
    ...input,
    world_state: {
      ...worldState,
      retrieval_events: { [tampered.retrieval_event_id]: tampered },
    },
  }),
  (error) => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_EVENT_HASH_MISMATCH",
);

const contract = buildWorldSimulationRetrievalContextRevivalCandidateEvidenceContract();
assert.equal(contract.canonical_prior_turn_successful_retrieval_required, true);
assert.equal(contract.exact_shared_explicit_context_cue_required, true);
assert.deepEqual(contract.contextual_cue_kinds, ["spatial_context", "subjective_episode", "temporal", "task"]);
assert.equal(contract.same_turn_retrieval_feedback_allowed, false);
assert.equal(contract.hidden_context_vector_modeled, false);
assert.equal(contract.universal_context_drift_assumed, false);
assert.equal(contract.generic_context_switch_cancels_rif, false);
assert.equal(contract.accessibility_reordering_performed, false);
assert.equal(contract.downstream_accessibility_effect_requires_separate_phase, true);

console.log("Phase84A bounded explicit-context retrieval revival candidate evidence: PASS");
