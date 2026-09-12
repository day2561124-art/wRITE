import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-consequence-service.mjs";
import {
  projectWorldSimulationRetrievalInducedForgettingAccessibility,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";
import {
  buildWorldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionContract,
  projectWorldSimulationRetrievalInducedForgettingReexposureRecovery,
  worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-reexposure-recovery-projection-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";

const character = "千夜";
const sourceTurnId = "phase83c-source-turn";
const currentTurnId = "phase83c-current-turn";
const competitorMemoryId = "memory-phase83c-candidate";
const neutralMemoryId = "memory-phase83c-neutral";
const dominatorMemoryId = "memory-phase83c-dominator";
const reencodedMemoryId = "memory-phase83c-reencoded";
const sourceOccurredAt = "2026-09-12T18:00:00+08:00";
const currentAsOf = "2026-09-12T20:00:00+08:00";
const observationHash = "phase83c-exact-observation-hash";

function clone(value) {
  return structuredClone(value);
}

function withHash(body, hashField) {
  return {
    ...body,
    [hashField]: hashAgentRunValue(body),
  };
}

function memory({
  memoryId,
  observation = null,
  encodedAt = "2026-09-12T17:00:00+08:00",
  turnId = "phase83c-encoding-turn",
  sense = "visual",
} = {}) {
  return {
    memory_id: memoryId,
    content: { detail: memoryId },
    source: { kind: "direct_perception", sense },
    internal_provenance: {
      turn_id: turnId,
      observation_hash: observation,
    },
    retrieval_cues: { sense },
    encoded_at: encodedAt,
  };
}

function retrievalEvent() {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: "phase83c-source-retrieval-event",
    retrieval_process_id: "phase83c-source-retrieval-process",
    retrieval_process_version: "phase63c-multistep-retrieval-v3",
    retrieval_process_hash: "phase83c-source-process-hash",
    character,
    turn_id: sourceTurnId,
    occurred_at: sourceOccurredAt,
    occurred_at_precision: "turn_context",
    initiation: { mode: "deliberate" },
    retrieval_task: { mode: "cued_recall" },
    target: null,
    search_orientation: {
      trigger: {
        grounding_status: "grounded",
        grounded_cue_refs: [{
          cue_option_id: "cue-current-location",
          canonical_cue_identity: JSON.stringify(["spatial_context", "library"]),
          canonical_cue: {
            kind: "spatial_context",
            value: "library",
            source: "current_environment",
          },
        }],
      },
      orientation: {
        status: "selected",
        grounded_cue_refs: [],
      },
    },
    search_steps: [],
    recovered_content: [],
    recovery_occurrences: [],
    memory_recoveries: [{
      memory_recovery_id: "recovery-phase83c-dominator",
      source_memory_ref: dominatorMemoryId,
      recovered_fragment_ids: [],
      recovery_occurrence_ids: [],
      recovery_extent: "whole_content",
      target_relation: "non_target",
    }],
    target_outcome: null,
    recovered_any_content: true,
    termination: { reason: "fixture" },
    engine_audit: {},
    immutable: true,
  };
  return withHash(body, "retrieval_event_hash");
}

function consequenceEvent(sourceEvent) {
  const body = {
    schema_version: retrievalInducedForgettingConsequenceEventSchemaVersion,
    version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
    phase: "Phase83A",
    consequence_event_id: "phase83c-source-consequence-event",
    character,
    source_turn_id: sourceTurnId,
    occurred_at: sourceOccurredAt,
    source_retrieval_event_id: sourceEvent.retrieval_event_id,
    source_retrieval_event_hash: sourceEvent.retrieval_event_hash,
    source_retrieval_process_id: sourceEvent.retrieval_process_id,
    source_retrieval_process_hash: sourceEvent.retrieval_process_hash,
    source_r4c_competition_monitor_evidence_hash: "phase83c-r4c-hash",
    source_r4b3_associative_composition_evidence_hash: "phase83c-r4b3-hash",
    query_id: "phase83c-source-query",
    recovered_dominator_memory_ref: dominatorMemoryId,
    suppression_candidate_memory_ref: competitorMemoryId,
    modeled_competition_status: "known_dominated_on_modeled_dimensions",
    evidence_relation: "recovered_memory_dominated_unrecovered_competitor_on_modeled_dimensions",
    consequence_kind: "future_accessibility_suppression_candidate",
    mechanism_interpretation: "bounded_behavioral_consequence_without_inhibition_mechanism_claim",
    selective_retrieval_verified: true,
    dominator_actually_recovered: true,
    competitor_not_recovered: true,
    same_query_competition_evidence_verified: true,
    active_interference_observed: false,
    suppression_effect_established: false,
    future_accessibility_changed: false,
    storage_strength_changed: false,
    retrieval_strength_changed: false,
    memory_content_rewritten: false,
    memory_deleted: false,
    numeric_inhibition_strength_modeled: false,
    inhibition_mechanism_asserted: false,
    interference_mechanism_asserted: false,
    same_turn_feedback_allowed: false,
    downstream_accessibility_effect_requires_separate_phase: true,
    immutable: true,
  };
  return withHash(body, "consequence_event_hash");
}

function fixture({
  includeReencoding = true,
  reencodedAt = "2026-09-12T19:00:00+08:00",
  reencodedHash = observationHash,
  reencodedTurnId = "phase83c-reexposure-turn",
} = {}) {
  const retrieval = retrievalEvent();
  const consequence = consequenceEvent(retrieval);
  const reference = {
    schema_version: retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
    consequence_event_id: consequence.consequence_event_id,
    consequence_event_hash: consequence.consequence_event_hash,
    character,
    suppression_candidate_memory_ref: competitorMemoryId,
    recovered_dominator_memory_ref: dominatorMemoryId,
    source_retrieval_event_id: retrieval.retrieval_event_id,
    source_retrieval_event_hash: retrieval.retrieval_event_hash,
    role: "retrieval_induced_forgetting_suppression_candidate_registered",
    derived_index: true,
  };
  const memories = [
    memory({ memoryId: competitorMemoryId, observation: observationHash }),
    memory({ memoryId: neutralMemoryId, observation: "phase83c-neutral-hash" }),
    memory({ memoryId: dominatorMemoryId, observation: "phase83c-dominator-hash" }),
    ...(includeReencoding
      ? [memory({
          memoryId: reencodedMemoryId,
          observation: reencodedHash,
          encodedAt: reencodedAt,
          turnId: reencodedTurnId,
        })]
      : []),
  ];
  const practiceProjection = {
    version: worldSimulationRetrievalPracticeActivationProjectionVersion,
    activation_evidence: memories.map((entry, index) => ({
      memory_id: entry.memory_id,
      original_index: index,
      practice_traces: [],
    })),
  };
  const worldState = {
    simulation_time: currentAsOf,
    memories: { [character]: clone(memories) },
    retrieval_events: {
      [retrieval.retrieval_event_id]: retrieval,
    },
    retrieval_induced_forgetting_events: {
      [consequence.consequence_event_id]: consequence,
    },
    retrieval_induced_forgetting_history: [reference],
  };
  const phase83b = projectWorldSimulationRetrievalInducedForgettingAccessibility({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: memories,
    current_active_cues: [{
      kind: "spatial_context",
      value: "library",
      source: "current_environment",
    }],
    retrieval_practice_activation_projection: practiceProjection,
  });
  return { memories, worldState, phase83b };
}

function recover(source, overrides = {}) {
  return projectWorldSimulationRetrievalInducedForgettingReexposureRecovery({
    world_state: source.worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: source.memories,
    phase83b_projection: source.phase83b,
    ...overrides,
  });
}

const contract = buildWorldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionContract();
assert.equal(contract.phase, "Phase83C");
assert.equal(contract.source_phase83b_projection_required, true);
assert.equal(contract.source_phase83a_consequence_revalidated, true);
assert.equal(contract.exact_post_consequence_observation_reencoding_required, true);
assert.equal(contract.current_turn_reencoding_recovery_allowed, false);
assert.equal(contract.fixed_time_expiry_allowed, false);
assert.equal(contract.duration_threshold_modeled, false);
assert.equal(contract.recovery_changes_ephemeral_memory_search_order_only, true);
assert.equal(contract.candidate_membership_changed, false);
assert.equal(contract.memory_content_rewritten, false);
assert.equal(contract.memory_deleted, false);
assert.equal(contract.storage_strength_mutated, false);
assert.equal(contract.retrieval_strength_mutated, false);
assert.equal(contract.numeric_relearning_strength_modeled, false);
assert.equal(contract.complete_psychological_relearning_asserted, false);

const positiveFixture = fixture();
assert.deepEqual(
  positiveFixture.phase83b.projected_memory_ids,
  [neutralMemoryId, dominatorMemoryId, reencodedMemoryId, competitorMemoryId],
  "Phase83B should suppress the original competitor before Phase83C evaluates later re-encoding",
);
const originalWorldState = clone(positiveFixture.worldState);
const positive = recover(positiveFixture);
assert.equal(
  positive.version,
  worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
);
assert.equal(positive.audit.recovery_applied, true);
assert.equal(positive.audit.recovered_memory_count, 1);
assert.equal(positive.audit.still_suppressed_memory_count, 0);
assert.deepEqual(
  positive.projected_memory_ids,
  positiveFixture.memories.map((entry) => entry.memory_id),
  "exact post-consequence re-encoding should restore the suppressed candidate to pre-83B stable order",
);
assert.equal(
  positive.recovery_evidence.find((entry) => entry.memory_id === competitorMemoryId).status,
  "exact_post_consequence_reencoding_recovered",
);
assert.deepEqual(positiveFixture.worldState, originalWorldState, "Phase83C must not mutate World State");
assert.deepEqual(
  positive.projected_memory_records.find((entry) => entry.memory_id === competitorMemoryId).content,
  { detail: competitorMemoryId },
  "Phase83C must not rewrite recovered memory content",
);

const noReencodingFixture = fixture({ includeReencoding: false });
const noReencoding = recover(noReencodingFixture);
assert.equal(noReencoding.audit.recovery_applied, false);
assert.deepEqual(noReencoding.projected_memory_ids, noReencodingFixture.phase83b.projected_memory_ids);
assert.equal(
  noReencoding.recovery_evidence.find((entry) => entry.memory_id === competitorMemoryId).status,
  "no_qualifying_post_consequence_reencoding",
);

const preConsequenceFixture = fixture({ reencodedAt: "2026-09-12T17:30:00+08:00" });
const preConsequence = recover(preConsequenceFixture);
assert.equal(preConsequence.audit.recovery_applied, false);
assert.deepEqual(preConsequence.projected_memory_ids, preConsequenceFixture.phase83b.projected_memory_ids);

const differentObservationFixture = fixture({ reencodedHash: "different-observation-hash" });
const differentObservation = recover(differentObservationFixture);
assert.equal(differentObservation.audit.recovery_applied, false);
assert.deepEqual(differentObservation.projected_memory_ids, differentObservationFixture.phase83b.projected_memory_ids);

const sameTurnFixture = fixture({ reencodedTurnId: currentTurnId });
const sameTurn = recover(sameTurnFixture);
assert.equal(sameTurn.audit.recovery_applied, false);
assert.deepEqual(sameTurn.projected_memory_ids, sameTurnFixture.phase83b.projected_memory_ids);

const longDelayFixture = fixture({ includeReencoding: false });
const longDelay = recover(longDelayFixture, { as_of: "2026-10-12T20:00:00+08:00" });
assert.equal(longDelay.audit.recovery_applied, false, "elapsed time alone must not expire Phase83B suppression");
assert.equal(longDelay.audit.fixed_time_expiry_used, false);
assert.deepEqual(longDelay.projected_memory_ids, longDelayFixture.phase83b.projected_memory_ids);

const tamperedFixture = fixture();
tamperedFixture.worldState.retrieval_induced_forgetting_events[
  "phase83c-source-consequence-event"
].occurred_at = "2026-09-12T17:00:00+08:00";
assert.throws(
  () => recover(tamperedFixture),
  (error) => error?.code === "WORLD_SIMULATION_RIF_REEXPOSURE_RECOVERY_CONSEQUENCE_HASH_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const runAllSource = await readFile("tests/run-all.mjs", "utf8");
assert.match(loopSource, /projectWorldSimulationRetrievalInducedForgettingReexposureRecovery/);
assert.match(loopSource, /retrievalInducedForgettingReexposureRecoveryProjection/);
assert.match(loopSource, /retrievalMemoryRecordsAfterRifRecovery/);
assert.match(runAllSource, /Phase 83C exact post-consequence re-encoding recovery projection/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase83C",
  version: worldSimulationRetrievalInducedForgettingReexposureRecoveryProjectionVersion,
  exact_post_consequence_reencoding_required: true,
  same_turn_recovery_allowed: false,
  fixed_time_expiry_allowed: false,
  ephemeral_search_order_only: true,
  candidate_membership_changed: false,
  memory_content_rewritten: false,
  storage_strength_mutated: false,
  retrieval_strength_mutated: false,
  complete_psychological_relearning_asserted: false,
}));
console.log("Phase83C exact post-consequence re-encoding recovery projection tests passed.");
