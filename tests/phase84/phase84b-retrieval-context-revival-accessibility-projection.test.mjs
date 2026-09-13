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
  projectWorldSimulationRetrievalInducedForgettingReexposureRecovery,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-reexposure-recovery-projection-service.mjs";
import {
  buildWorldSimulationRetrievalContextRevivalCandidateEvidence,
} from "../../server/src/world-simulation-retrieval-context-revival-candidate-evidence-service.mjs";
import {
  buildWorldSimulationRetrievalContextRevivalAccessibilityProjectionContract,
  projectWorldSimulationRetrievalContextRevivalAccessibility,
  worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion,
} from "../../server/src/world-simulation-retrieval-context-revival-accessibility-projection-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import { worldSimulationRetrievalPracticeActivationProjectionVersion } from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";

const character = "千夜";
const sourceTurnId = "phase84b-suppression-turn";
const revivalTurnId = "phase84b-revival-turn";
const currentTurnId = "phase84b-current-turn";
const competitorMemoryId = "memory-context-revival-candidate";
const dominatorMemoryId = "memory-context-source";
const neutralMemoryId = "memory-neutral";
const suppressionAt = "2026-09-12T18:00:00+08:00";
const revivalAt = "2026-09-12T18:30:00+08:00";
const currentAsOf = "2026-09-12T19:00:00+08:00";

function clone(value) {
  return structuredClone(value);
}

function withHash(body, field) {
  return { ...body, [field]: hashAgentRunValue(body) };
}

function retrievalEvent({ id, turnId, occurredAt, recoveredIds }) {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: id,
    retrieval_process_id: `${id}-process`,
    retrieval_process_version: "phase63c-fixture",
    retrieval_process_hash: `${id}-process-hash`,
    character,
    turn_id: turnId,
    occurred_at: occurredAt,
    occurred_at_precision: "turn_context",
    initiation: { mode: "deliberate" },
    retrieval_task: { mode: "cued_recall" },
    target: null,
    search_orientation: {
      trigger: {
        grounding_status: "grounded",
        grounded_cue_refs: [{
          cue_option_id: `${id}-location-cue`,
          canonical_cue_identity: JSON.stringify(["spatial_context", "library"]),
          canonical_cue: { kind: "spatial_context", value: "library", source: "current_environment" },
        }],
      },
      orientation: { status: "selected", grounded_cue_refs: [] },
    },
    search_steps: [],
    recovered_content: [],
    recovery_occurrences: [],
    memory_recoveries: recoveredIds.map((memoryId, index) => ({
      memory_recovery_id: `${id}-recovery-${index}`,
      source_memory_ref: memoryId,
      recovered_fragment_ids: [],
      recovery_occurrence_ids: [],
      recovery_extent: "whole_content",
      target_relation: "non_target",
    })),
    target_outcome: null,
    recovered_any_content: recoveredIds.length > 0,
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
    consequence_event_id: "phase84b-source-consequence-event",
    character,
    source_turn_id: sourceTurnId,
    occurred_at: suppressionAt,
    source_retrieval_event_id: sourceEvent.retrieval_event_id,
    source_retrieval_event_hash: sourceEvent.retrieval_event_hash,
    source_retrieval_process_id: sourceEvent.retrieval_process_id,
    source_retrieval_process_hash: sourceEvent.retrieval_process_hash,
    source_r4c_competition_monitor_evidence_hash: "phase84b-r4c-hash",
    source_r4b3_associative_composition_evidence_hash: "phase84b-r4b3-hash",
    query_id: "phase84b-source-query",
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
  includePostSuppressionRevival = true,
  includePhase83cReencoding = false,
} = {}) {
  const suppressionRetrieval = retrievalEvent({
    id: "phase84b-suppression-retrieval",
    turnId: sourceTurnId,
    occurredAt: suppressionAt,
    recoveredIds: [dominatorMemoryId],
  });
  const revivalRetrieval = retrievalEvent({
    id: "phase84b-post-suppression-retrieval",
    turnId: revivalTurnId,
    occurredAt: revivalAt,
    recoveredIds: [dominatorMemoryId],
  });
  const consequence = consequenceEvent(suppressionRetrieval);
  const reference = {
    schema_version: retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
    consequence_event_id: consequence.consequence_event_id,
    consequence_event_hash: consequence.consequence_event_hash,
    character,
    suppression_candidate_memory_ref: competitorMemoryId,
    recovered_dominator_memory_ref: dominatorMemoryId,
    source_retrieval_event_id: suppressionRetrieval.retrieval_event_id,
    source_retrieval_event_hash: suppressionRetrieval.retrieval_event_hash,
    role: "retrieval_induced_forgetting_suppression_candidate_registered",
    derived_index: true,
  };
  const memories = [
    {
      memory_id: competitorMemoryId,
      encoded_at: "2026-09-12T16:00:00+08:00",
      retrieval_cues: { scene_id: "library", sense: "visual" },
      source: { sense: "visual" },
      internal_provenance: {
        observation_hash: "phase84b-shared-observation-hash",
        turn_id: "phase84b-original-encoding-turn",
      },
      content: { detail: "suppressed candidate" },
    },
    {
      memory_id: neutralMemoryId,
      encoded_at: "2026-09-12T16:05:00+08:00",
      retrieval_cues: { scene_id: "courtyard" },
      content: { detail: "neutral" },
    },
    {
      memory_id: dominatorMemoryId,
      encoded_at: "2026-09-12T16:10:00+08:00",
      retrieval_cues: { scene_id: "library" },
      content: { detail: "context source" },
    },
    ...(includePhase83cReencoding
      ? [{
        memory_id: "memory-context-reencoded-copy",
        encoded_at: "2026-09-12T18:20:00+08:00",
        retrieval_cues: { scene_id: "library", sense: "visual" },
        source: { sense: "visual" },
        internal_provenance: {
          observation_hash: "phase84b-shared-observation-hash",
          turn_id: "phase84b-reencoding-turn",
        },
        content: { detail: "later exact re-encoding" },
      }]
      : []),
  ];
  const worldState = {
    simulation_time: currentAsOf,
    retrieval_events: {
      [suppressionRetrieval.retrieval_event_id]: suppressionRetrieval,
      ...(includePostSuppressionRevival
        ? { [revivalRetrieval.retrieval_event_id]: revivalRetrieval }
        : {}),
    },
    retrieval_induced_forgetting_events: {
      [consequence.consequence_event_id]: consequence,
    },
    retrieval_induced_forgetting_history: [reference],
  };
  const practiceProjection = {
    version: worldSimulationRetrievalPracticeActivationProjectionVersion,
    activation_evidence: memories.map((memory, originalIndex) => ({
      memory_id: memory.memory_id,
      original_index: originalIndex,
      practice_traces: [],
    })),
  };
  const phase83b = projectWorldSimulationRetrievalInducedForgettingAccessibility({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: memories,
    current_active_cues: [{ kind: "spatial_context", value: "library", source: "current_environment" }],
    retrieval_practice_activation_projection: practiceProjection,
  });
  const phase83c = projectWorldSimulationRetrievalInducedForgettingReexposureRecovery({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: memories,
    phase83b_projection: phase83b,
  });
  const phase84a = buildWorldSimulationRetrievalContextRevivalCandidateEvidence({
    world_state: worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: memories,
  });
  return { worldState, memories, phase83b, phase83c, phase84a, consequence, revivalRetrieval };
}

function project(source, overrides = {}) {
  return projectWorldSimulationRetrievalContextRevivalAccessibility({
    world_state: source.worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: source.memories,
    phase83b_projection: source.phase83b,
    phase83c_projection: source.phase83c,
    phase84a_evidence: source.phase84a,
    ...overrides,
  });
}

const contract = buildWorldSimulationRetrievalContextRevivalAccessibilityProjectionContract();
assert.equal(contract.phase, "Phase84B");
assert.equal(contract.source_phase83b_projection_required, true);
assert.equal(contract.source_phase83c_recovery_projection_required, true);
assert.equal(contract.prior_phase83c_recovery_may_not_be_reversed, true);
assert.equal(contract.source_phase84a_evidence_required, true);
assert.equal(contract.exact_shared_explicit_context_cue_required, true);
assert.equal(contract.revival_retrieval_must_follow_applicable_suppression_consequence, true);
assert.equal(contract.generic_context_switch_release_allowed, false);
assert.equal(contract.same_turn_retrieval_feedback_allowed, false);
assert.equal(contract.accessibility_recovery_changes_ephemeral_memory_search_order_only, true);
assert.equal(contract.rif_cancellation_asserted, false);
assert.equal(contract.causal_context_reinstatement_mechanism_asserted, false);

const positiveFixture = fixture();
assert.deepEqual(
  positiveFixture.phase83b.projected_memory_ids,
  [neutralMemoryId, dominatorMemoryId, competitorMemoryId],
  "Phase83B precondition must suppress the revival candidate in ephemeral order",
);
const originalWorldState = clone(positiveFixture.worldState);
const positive = project(positiveFixture);
assert.equal(positive.version, worldSimulationRetrievalContextRevivalAccessibilityProjectionVersion);
assert.equal(positive.audit.recovery_applied, true);
assert.equal(positive.audit.recovered_memory_count, 1);
assert.equal(positive.audit.still_suppressed_memory_count, 0);
assert.deepEqual(
  positive.projected_memory_ids,
  [competitorMemoryId, neutralMemoryId, dominatorMemoryId],
  "qualifying post-suppression explicit-context revival evidence may recover original ephemeral search order",
);
const recoveredEvidence = positive.recovery_evidence.find((entry) => entry.memory_id === competitorMemoryId);
assert.equal(recoveredEvidence.recovery_applied, true);
assert.equal(recoveredEvidence.revival_evidence.length, 1);
assert.equal(
  recoveredEvidence.revival_evidence[0].source_retrieval_event_id,
  positiveFixture.revivalRetrieval.retrieval_event_id,
  "pre-suppression/equal-time retrieval evidence must not qualify as downstream recovery",
);
assert.deepEqual(positiveFixture.worldState, originalWorldState, "Phase84B must not mutate World State");
assert.deepEqual(
  positive.projected_memory_records.find((entry) => entry.memory_id === competitorMemoryId).content,
  { detail: "suppressed candidate" },
  "Phase84B must not rewrite memory content",
);
assert.equal(positive.audit.storage_strength_mutated, false);
assert.equal(positive.audit.retrieval_strength_mutated, false);
assert.equal(positive.audit.rif_cancellation_asserted, false);

const preOnlyFixture = fixture({ includePostSuppressionRevival: false });
assert.equal(
  preOnlyFixture.phase84a.revival_candidates.some((entry) => entry.memory_id === competitorMemoryId),
  true,
  "Phase84A may contain candidate evidence from the suppression retrieval itself",
);
const preOnly = project(preOnlyFixture);
assert.equal(preOnly.audit.recovery_applied, false);
assert.equal(preOnly.audit.still_suppressed_memory_count, 1);
assert.deepEqual(preOnly.projected_memory_ids, [neutralMemoryId, dominatorMemoryId, competitorMemoryId]);
assert.equal(
  preOnly.recovery_evidence.find((entry) => entry.memory_id === competitorMemoryId).status,
  "no_qualifying_post_suppression_context_revival_evidence",
);

const phase83cRecoveredFixture = fixture({
  includePostSuppressionRevival: false,
  includePhase83cReencoding: true,
});
assert.equal(phase83cRecoveredFixture.phase83c.audit.recovery_applied, true);
assert.equal(phase83cRecoveredFixture.phase83c.audit.recovered_memory_count, 1);
const phase83cPreserved = project(phase83cRecoveredFixture);
assert.equal(phase83cPreserved.audit.recovery_applied, false);
assert.equal(phase83cPreserved.audit.prior_phase83c_recovered_memory_count, 1);
assert.equal(phase83cPreserved.audit.prior_phase83c_recovery_reversed, false);
assert.equal(phase83cPreserved.audit.still_suppressed_memory_count, 0);
assert.deepEqual(
  phase83cPreserved.projected_memory_ids,
  phase83cRecoveredFixture.memories.map((entry) => entry.memory_id),
  "Phase84B must preserve Phase83C recovery even when no later Phase84A revival retrieval qualifies",
);
assert.equal(
  phase83cPreserved.recovery_evidence.find((entry) => entry.memory_id === competitorMemoryId).status,
  "prior_phase83c_recovery_preserved",
);

const tampered84aFixture = fixture();
const tampered84a = clone(tampered84aFixture.phase84a);
tampered84a.revival_candidates[0].memory_id = neutralMemoryId;
assert.throws(
  () => project(tampered84aFixture, { phase84a_evidence: tampered84a }),
  (error) => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_ID_MISMATCH",
);

const tampered83bFixture = fixture();
const tampered83b = clone(tampered83bFixture.phase83b);
tampered83b.projected_memory_ids.reverse();
assert.throws(
  () => project(tampered83bFixture, { phase83b_projection: tampered83b }),
  (error) => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83B_ID_MISMATCH",
);

const tampered83cFixture = fixture();
const tampered83c = clone(tampered83cFixture.phase83c);
tampered83c.projected_memory_ids.reverse();
assert.throws(
  () => project(tampered83cFixture, { phase83c_projection: tampered83c }),
  (error) => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE83C_ID_MISMATCH",
);

const futureFixture = fixture();
assert.throws(
  () => project(futureFixture, { as_of: "2026-09-12T17:00:00+08:00" }),
  (error) => error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_PHASE84A_CANONICAL_MISMATCH"
    || error?.code === "WORLD_SIMULATION_RETRIEVAL_CONTEXT_REVIVAL_ACCESSIBILITY_CONTEXT_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const runAllSource = await readFile("tests/run-all.mjs", "utf8");
const phase83cIndex = loopSource.indexOf("projectWorldSimulationRetrievalInducedForgettingReexposureRecovery({");
const phase84aIndex = loopSource.indexOf("buildWorldSimulationRetrievalContextRevivalCandidateEvidence({");
const phase84bIndex = loopSource.indexOf("projectWorldSimulationRetrievalContextRevivalAccessibility({");
const authoritativeCandidateIndex = loopSource.indexOf("retrievalMemoryRecordsAfterRifRecovery");
assert.ok(phase83cIndex >= 0 && phase84aIndex > phase83cIndex && phase84bIndex > phase84aIndex);
assert.ok(authoritativeCandidateIndex > phase84bIndex, "Phase84B must feed the downstream authoritative candidate path");
assert.match(loopSource, /phase83c_projection:\s*retrievalInducedForgettingReexposureRecoveryProjection/);
assert.match(loopSource, /phase84a_evidence:\s*retrievalContextRevivalCandidateEvidence/);
assert.match(loopSource, /retrieval_context_revival_accessibility_projection/);
assert.match(runAllSource, /Phase 84B bounded explicit-context revival accessibility recovery projection/);

console.log("Phase84B bounded explicit-context revival accessibility recovery projection: PASS");
