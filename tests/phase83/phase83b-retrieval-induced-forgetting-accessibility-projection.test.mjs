import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  retrievalInducedForgettingConsequenceHistoryReferenceSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-consequence-service.mjs";
import {
  buildWorldSimulationRetrievalInducedForgettingAccessibilityProjectionContract,
  projectWorldSimulationRetrievalInducedForgettingAccessibility,
  worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-accessibility-projection-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  worldSimulationRetrievalPracticeActivationProjectionVersion,
} from "../../server/src/world-simulation-retrieval-practice-activation-projection-service.mjs";

const character = "千夜";
const sourceTurnId = "phase83b-source-turn";
const currentTurnId = "phase83b-current-turn";
const competitorMemoryId = "memory-suppression-candidate";
const dominatorMemoryId = "memory-recovered-dominator";
const neutralMemoryId = "memory-neutral";
const sourceOccurredAt = "2026-09-12T18:00:00+08:00";
const currentAsOf = "2026-09-12T19:00:00+08:00";

function clone(value) {
  return structuredClone(value);
}

function withHash(body, hashField) {
  return {
    ...body,
    [hashField]: hashAgentRunValue(body),
  };
}

function retrievalEvent() {
  const body = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: "phase83b-source-retrieval-event",
    retrieval_process_id: "phase83b-source-retrieval-process",
    retrieval_process_version: "phase63c-multistep-retrieval-v3",
    retrieval_process_hash: "phase83b-source-process-hash",
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
        grounded_cue_refs: [{
          cue_option_id: "cue-retrieval-goal",
          canonical_cue_identity: JSON.stringify(["goal", "find-key"]),
          canonical_cue: {
            kind: "goal",
            value: "find-key",
            source: "explicit_retrieval_goal",
          },
        }],
      },
    },
    search_steps: [],
    recovered_content: [],
    recovery_occurrences: [],
    memory_recoveries: [{
      memory_recovery_id: "recovery-dominator",
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
    consequence_event_id: "phase83b-source-consequence-event",
    character,
    source_turn_id: sourceTurnId,
    occurred_at: sourceOccurredAt,
    source_retrieval_event_id: sourceEvent.retrieval_event_id,
    source_retrieval_event_hash: sourceEvent.retrieval_event_hash,
    source_retrieval_process_id: sourceEvent.retrieval_process_id,
    source_retrieval_process_hash: sourceEvent.retrieval_process_hash,
    source_r4c_competition_monitor_evidence_hash: "phase83b-r4c-hash",
    source_r4b3_associative_composition_evidence_hash: "phase83b-r4b3-hash",
    query_id: "phase83b-source-query",
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

function fixture({ practiceAfter = false } = {}) {
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
    { memory_id: competitorMemoryId, content: { detail: "candidate" } },
    { memory_id: neutralMemoryId, content: { detail: "neutral" } },
    { memory_id: dominatorMemoryId, content: { detail: "dominator" } },
  ];
  const traces = practiceAfter
    ? [{
      status: "qualifying_prior_practice",
      memory_id: competitorMemoryId,
      plasticity_event_id: "practice-after-event",
      plasticity_effect_id: "practice-after-effect",
      source_retrieval_event_id: "retrieval-after-event",
      source_turn_id: "phase83b-repractice-turn",
      occurred_at: "2026-09-12T18:30:00+08:00",
      age_seconds: 1800,
      activation_contribution: 0.02,
    }]
    : [];
  const practiceProjection = {
    version: worldSimulationRetrievalPracticeActivationProjectionVersion,
    activation_evidence: memories.map((memory, index) => ({
      memory_id: memory.memory_id,
      original_index: index,
      practice_traces: memory.memory_id === competitorMemoryId ? traces : [],
    })),
  };
  return {
    worldState: {
      simulation_time: currentAsOf,
      memories: { [character]: clone(memories) },
      retrieval_events: {
        [retrieval.retrieval_event_id]: retrieval,
      },
      retrieval_induced_forgetting_events: {
        [consequence.consequence_event_id]: consequence,
      },
      retrieval_induced_forgetting_history: [reference],
    },
    memories,
    practiceProjection,
    retrieval,
    consequence,
  };
}

function project(source, overrides = {}) {
  return projectWorldSimulationRetrievalInducedForgettingAccessibility({
    world_state: source.worldState,
    character,
    current_turn_id: currentTurnId,
    as_of: currentAsOf,
    memory_records: source.memories,
    current_active_cues: [{
      kind: "spatial_context",
      value: "library",
      source: "current_environment",
    }],
    retrieval_practice_activation_projection: source.practiceProjection,
    ...overrides,
  });
}

const contract = buildWorldSimulationRetrievalInducedForgettingAccessibilityProjectionContract();
assert.equal(contract.phase, "Phase83B");
assert.equal(contract.source_phase83a_prior_turn_consequence_required, true);
assert.equal(contract.source_phase63c_retrieval_event_revalidated, true);
assert.equal(contract.exact_current_cue_overlap_required, true);
assert.equal(contract.cue_free_global_suppression_allowed, false);
assert.equal(contract.later_successful_retrieval_practice_shields_candidate, true);
assert.equal(contract.same_turn_effect_allowed, false);
assert.equal(contract.projection_changes_ephemeral_memory_search_order_only, true);
assert.equal(contract.candidate_membership_changed, false);
assert.equal(contract.memory_content_rewritten, false);
assert.equal(contract.memory_deleted, false);
assert.equal(contract.storage_strength_mutated, false);
assert.equal(contract.retrieval_strength_mutated, false);
assert.equal(contract.numeric_inhibition_strength_modeled, false);
assert.equal(contract.inhibition_mechanism_asserted, false);
assert.equal(contract.interference_mechanism_asserted, false);

const positiveFixture = fixture();
const originalWorldState = clone(positiveFixture.worldState);
const positive = project(positiveFixture);
assert.equal(positive.version, worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion);
assert.equal(positive.audit.projection_applied, true);
assert.equal(positive.audit.suppressed_memory_count, 1);
assert.deepEqual(
  positive.projected_memory_ids,
  [neutralMemoryId, dominatorMemoryId, competitorMemoryId],
  "Phase83B must stably move only the applicable suppression candidate behind unsuppressed memories",
);
assert.equal(
  positive.suppression_evidence.find((item) => item.memory_id === competitorMemoryId).suppression_applied,
  true,
);
assert.deepEqual(positiveFixture.worldState, originalWorldState, "Phase83B must not mutate World State");
assert.deepEqual(
  positive.projected_memory_records.find((item) => item.memory_id === competitorMemoryId).content,
  { detail: "candidate" },
  "Phase83B must not rewrite memory content",
);

const contextMismatch = project(positiveFixture, {
  current_active_cues: [{ kind: "spatial_context", value: "roof", source: "current_environment" }],
});
assert.equal(contextMismatch.audit.projection_applied, false);
assert.deepEqual(contextMismatch.projected_memory_ids, positiveFixture.memories.map((item) => item.memory_id));
assert.equal(
  contextMismatch.consequence_evidence.find((item) => item.memory_id === competitorMemoryId).status,
  "current_context_not_cue_overlapping",
);

const cueFree = project(positiveFixture, { current_active_cues: [] });
assert.equal(cueFree.audit.projection_applied, false);
assert.deepEqual(cueFree.projected_memory_ids, positiveFixture.memories.map((item) => item.memory_id));

const shieldFixture = fixture({ practiceAfter: true });
const shielded = project(shieldFixture);
assert.equal(shielded.audit.projection_applied, false);
assert.deepEqual(shielded.projected_memory_ids, shieldFixture.memories.map((item) => item.memory_id));
assert.equal(
  shielded.consequence_evidence.find((item) => item.memory_id === competitorMemoryId).status,
  "later_successful_retrieval_practice_shielded",
);

const sameTurnFixture = fixture();
const sameTurnRetrievalBody = clone(sameTurnFixture.retrieval);
delete sameTurnRetrievalBody.retrieval_event_hash;
sameTurnRetrievalBody.turn_id = currentTurnId;
const sameTurnRetrieval = withHash(sameTurnRetrievalBody, "retrieval_event_hash");
sameTurnFixture.retrieval = sameTurnRetrieval;
sameTurnFixture.worldState.retrieval_events[sameTurnRetrieval.retrieval_event_id] = sameTurnRetrieval;

const sameTurnConsequenceBody = clone(sameTurnFixture.consequence);
delete sameTurnConsequenceBody.consequence_event_hash;
sameTurnConsequenceBody.source_turn_id = currentTurnId;
sameTurnConsequenceBody.source_retrieval_event_hash = sameTurnRetrieval.retrieval_event_hash;
const sameTurnConsequence = withHash(sameTurnConsequenceBody, "consequence_event_hash");
sameTurnFixture.consequence = sameTurnConsequence;
sameTurnFixture.worldState.retrieval_induced_forgetting_events[sameTurnConsequence.consequence_event_id] = sameTurnConsequence;
sameTurnFixture.worldState.retrieval_induced_forgetting_history[0].consequence_event_hash =
  sameTurnConsequence.consequence_event_hash;
sameTurnFixture.worldState.retrieval_induced_forgetting_history[0].source_retrieval_event_hash =
  sameTurnRetrieval.retrieval_event_hash;
const sameTurn = project(sameTurnFixture);
assert.equal(sameTurn.audit.projection_applied, false);
assert.equal(
  sameTurn.consequence_evidence.find((item) => item.memory_id === competitorMemoryId).status,
  "same_source_turn_excluded",
);

const tampered = fixture();
tampered.worldState.retrieval_induced_forgetting_events[tampered.consequence.consequence_event_id]
  .suppression_candidate_memory_ref = neutralMemoryId;
assert.throws(
  () => project(tampered),
  (error) => error?.code === "WORLD_SIMULATION_RIF_ACCESSIBILITY_CONSEQUENCE_EVENT_HASH_MISMATCH",
);

const future = fixture();
assert.throws(
  () => project(future, { as_of: "2026-09-12T17:00:00+08:00" }),
  (error) => error?.code === "WORLD_SIMULATION_RIF_ACCESSIBILITY_FUTURE_CONSEQUENCE",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const runAllSource = await readFile("tests/run-all.mjs", "utf8");
assert.match(loopSource, /projectWorldSimulationRetrievalInducedForgettingAccessibility/);
assert.match(loopSource, /memoryAccessibilityCueProbe/);
assert.match(loopSource, /retrievalInducedForgettingAccessibilityProjection/);
assert.match(loopSource, /projected_memory_records/);
assert.match(runAllSource, /Phase 83B bounded delayed retrieval-induced accessibility suppression projection/);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase83B",
  version: worldSimulationRetrievalInducedForgettingAccessibilityProjectionVersion,
  prior_turn_phase83a_required: true,
  exact_current_cue_overlap_required: true,
  later_successful_practice_shield_verified: true,
  same_turn_effect_allowed: false,
  ephemeral_search_order_only: true,
  candidate_membership_changed: false,
  memory_content_rewritten: false,
  storage_strength_mutated: false,
  retrieval_strength_mutated: false,
  numeric_inhibition_strength_modeled: false,
}));
console.log("Phase83B bounded delayed retrieval-induced accessibility suppression projection tests passed.");
