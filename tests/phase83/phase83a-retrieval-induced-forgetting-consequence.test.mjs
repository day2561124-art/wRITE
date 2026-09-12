import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationAssociativeActivationCompositionEvidenceVersion,
} from "../../server/src/world-simulation-associative-activation-composition-evidence-service.mjs";
import {
  projectWorldSimulationRetrievalCompetitionMonitoringEvidence,
} from "../../server/src/world-simulation-retrieval-competition-monitoring-evidence-service.mjs";
import {
  memoryRetrievalEventSchemaVersion,
} from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import {
  worldSimulationMemoryRetrievalProcessV3Version,
} from "../../server/src/world-simulation-memory-retrieval-multistep-service.mjs";
import {
  buildWorldSimulationRetrievalInducedForgettingConsequenceContract,
  buildWorldSimulationRetrievalInducedForgettingConsequences,
  retrievalInducedForgettingConsequenceEventSchemaVersion,
  worldSimulationRetrievalInducedForgettingConsequenceVersion,
} from "../../server/src/world-simulation-retrieval-induced-forgetting-consequence-service.mjs";

const turnId = "phase83a-turn";
const character = "千夜";
const recoveredMemoryId = "memory-recovered-dominator";
const competitorMemoryId = "memory-unrecovered-dominated";

function clone(value) {
  return structuredClone(value);
}

function r4b3EvidenceBody(evidence) {
  return {
    schema_version: evidence.schema_version,
    version: evidence.version,
    query_id: evidence.query_id,
    character: evidence.character,
    turn_id: evidence.turn_id,
    source_initial_frontier_id: evidence.source_initial_frontier_id,
    source_r3_projection_id: evidence.source_r3_projection_id,
    source_r3_projection_hash: evidence.source_r3_projection_hash,
    source_r4a_projection_id: evidence.source_r4a_projection_id,
    source_r4a_evidence_hash: evidence.source_r4a_evidence_hash,
    source_r4b2_topology_evidence_id: evidence.source_r4b2_topology_evidence_id,
    source_r4b2_evidence_hash: evidence.source_r4b2_evidence_hash,
    candidate_memory_ids: evidence.candidate_memory_ids,
    selected_cue_profiles: evidence.selected_cue_profiles,
    candidate_evidence: evidence.candidate_evidence,
    dominance: evidence.dominance,
    boundaries: evidence.boundaries,
    immutable: evidence.immutable,
  };
}

function buildR4B3Fixture() {
  const candidateSpecs = [
    { memory_id: competitorMemoryId, score: 1, bits: [0, 0] },
    { memory_id: recoveredMemoryId, score: 2, bits: [1, 1] },
  ];
  const body = {
    schema_version: "phase64a-r4b3-associative-activation-composition-evidence-v1",
    version: worldSimulationAssociativeActivationCompositionEvidenceVersion,
    query_id: "phase83a-query",
    character,
    turn_id: turnId,
    source_initial_frontier_id: "phase83a-frontier",
    source_r3_projection_id: "phase83a-r3",
    source_r3_projection_hash: "phase83a-r3-hash",
    source_r4a_projection_id: "phase83a-r4a",
    source_r4a_evidence_hash: "phase83a-r4a-hash",
    source_r4b2_topology_evidence_id: "phase83a-r4b2",
    source_r4b2_evidence_hash: "phase83a-r4b2-hash",
    candidate_memory_ids: candidateSpecs.map((entry) => entry.memory_id),
    selected_cue_profiles: {
      trigger: [{ cue_identity: "phase83a-trigger" }],
      orientation: [{ cue_identity: "phase83a-orientation" }],
    },
    candidate_evidence: candidateSpecs.map((entry, index) => ({
      memory_id: entry.memory_id,
      candidate_index: index,
      base_level: {
        base_level_activation_score: entry.score,
        complete_base_level_evidence: true,
        encoding_time_status: "authoritative_encoded_at",
        legacy_r2_slot_pinned: false,
        score_is_literal_human_recall_probability: false,
      },
      cue_support: {
        trigger: [{ supported: entry.bits[0] === 1 }],
        orientation: [{ supported: entry.bits[1] === 1 }],
      },
      composition: {
        attention_weights_available: false,
        calibrated_association_scale_available: false,
        cue_dependency_model_available: false,
        scalar_associative_activation: null,
        composed_activation_score: null,
        status: "evidence_only_uncalibrated",
      },
    })),
    dominance: {
      mode: "lazy_pairwise_evidence_component_comparison_v1",
      exhaustive_pairwise_matrix_materialized: false,
      modeled_dimensions: [
        "complete_r3_base_level_score",
        "actual_selected_cue_support_bits",
      ],
      excluded_dimensions: [],
    },
    boundaries: {
      evidence_is_query_conditioned: true,
      evidence_is_initial_frontier_bound: true,
      candidate_membership_changed: false,
      candidate_order_changed: false,
      retrieval_probability_modeled: false,
      retrieval_contact_changed: false,
      retrieval_recovery_changed: false,
      resolver_exposure_allowed: false,
      full_evidence_persistence_allowed: false,
      dynamic_frontier_recomputation_used: false,
      phase63c_reinstated_cues_included: false,
    },
    immutable: true,
  };
  const evidenceHash = hashAgentRunValue(r4b3EvidenceBody(body));
  return {
    ...body,
    composition_evidence_id: `memory_associative_activation_composition_${evidenceHash.slice(0, 24)}`,
    evidence_hash: evidenceHash,
  };
}

function buildFixture({ recoveredIds = [recoveredMemoryId] } = {}) {
  const r4b3 = buildR4B3Fixture();
  const r4c = projectWorldSimulationRetrievalCompetitionMonitoringEvidence({
    query_id: r4b3.query_id,
    associative_activation_composition_evidence: r4b3,
  });
  const retrievalProcess = {
    retrieval_process_id: "phase83a-retrieval-process",
    query_id: r4b3.query_id,
    initial_associative_activation_composition_evidence_hash: r4b3.evidence_hash,
    initial_retrieval_competition_monitoring_evidence_hash: r4c.evidence_hash,
  };
  const processHash = hashAgentRunValue(retrievalProcess);
  const eventWithoutHash = {
    schema_version: memoryRetrievalEventSchemaVersion,
    retrieval_event_id: "phase83a-retrieval-event",
    retrieval_process_id: retrievalProcess.retrieval_process_id,
    retrieval_process_hash: processHash,
    turn_id: turnId,
    character,
    occurred_at: "2026-09-12T18:00:00+08:00",
    memory_recoveries: recoveredIds.map((memoryId) => ({
      source_memory_ref: memoryId,
      selector: { kind: "whole_content" },
    })),
    immutable: true,
  };
  const retrievalEvent = {
    ...eventWithoutHash,
    retrieval_event_hash: hashAgentRunValue(eventWithoutHash),
  };
  return {
    worldState: {
      retrieval_events: {
        [retrievalEvent.retrieval_event_id]: retrievalEvent,
      },
      memories: {
        [character]: [
          { memory_id: recoveredMemoryId, content: { detail: "dominant recall" } },
          { memory_id: competitorMemoryId, content: { detail: "competing recall" } },
        ],
      },
    },
    runtime: {
      version: worldSimulationMemoryRetrievalProcessV3Version,
      process_occurred: true,
      retrieval_process: retrievalProcess,
      initial_associative_activation_composition_evidence: r4b3,
      initial_retrieval_competition_monitoring_evidence: r4c,
    },
  };
}

const contract = buildWorldSimulationRetrievalInducedForgettingConsequenceContract();
assert.equal(contract.phase, "Phase83A");
assert.equal(contract.source_phase63c_actual_selective_retrieval_required, true);
assert.equal(contract.source_phase64a_r4c_known_dominated_competitor_required, true);
assert.equal(contract.dominator_witness_must_be_actually_recovered, true);
assert.equal(contract.suppression_candidate_competitor_must_be_unrecovered, true);
assert.equal(contract.same_turn_feedback_allowed, false);
assert.equal(contract.future_accessibility_changed, false);
assert.equal(contract.storage_strength_changed, false);
assert.equal(contract.retrieval_strength_changed, false);
assert.equal(contract.memory_content_rewritten, false);
assert.equal(contract.memory_deleted, false);
assert.equal(contract.numeric_inhibition_strength_modeled, false);
assert.equal(contract.inhibition_mechanism_asserted, false);
assert.equal(contract.interference_mechanism_asserted, false);

const fixture = buildFixture();
const consequence = buildWorldSimulationRetrievalInducedForgettingConsequences({
  world_state: fixture.worldState,
  turn_id: turnId,
  memory_retrieval_processes: [{ observer: character, result: fixture.runtime }],
});
assert.equal(consequence.version, worldSimulationRetrievalInducedForgettingConsequenceVersion);
assert.equal(consequence.result.consequence_events_created.length, 1);
assert.equal(consequence.result.appended_history_references.length, 1);
assert.equal(consequence.result.state_transitions.length, 2);
const event = consequence.result.consequence_events_created[0];
assert.equal(event.schema_version, retrievalInducedForgettingConsequenceEventSchemaVersion);
assert.equal(event.recovered_dominator_memory_ref, recoveredMemoryId);
assert.equal(event.suppression_candidate_memory_ref, competitorMemoryId);
assert.equal(event.consequence_kind, "future_accessibility_suppression_candidate");
assert.equal(event.selective_retrieval_verified, true);
assert.equal(event.dominator_actually_recovered, true);
assert.equal(event.competitor_not_recovered, true);
assert.equal(event.future_accessibility_changed, false);
assert.equal(event.storage_strength_changed, false);
assert.equal(event.retrieval_strength_changed, false);
assert.equal(event.memory_content_rewritten, false);
assert.equal(event.memory_deleted, false);
assert.equal(event.inhibition_mechanism_asserted, false);
assert.equal(event.interference_mechanism_asserted, false);
assert.equal(event.same_turn_feedback_allowed, false);
assert.deepEqual(consequence.result.preview_world_state.memories, fixture.worldState.memories);

const replay = buildWorldSimulationRetrievalInducedForgettingConsequences({
  world_state: consequence.result.preview_world_state,
  turn_id: turnId,
  memory_retrieval_processes: [{ observer: character, result: fixture.runtime }],
});
assert.equal(replay.result.consequence_events_created.length, 0);
assert.equal(replay.result.already_persisted_consequence_event_ids.length, 1);
assert.equal(replay.result.appended_history_references.length, 0);
assert.equal(replay.result.state_transitions.length, 0);

const bothRecoveredFixture = buildFixture({
  recoveredIds: [recoveredMemoryId, competitorMemoryId],
});
const bothRecovered = buildWorldSimulationRetrievalInducedForgettingConsequences({
  world_state: bothRecoveredFixture.worldState,
  turn_id: turnId,
  memory_retrieval_processes: [{ result: bothRecoveredFixture.runtime }],
});
assert.equal(bothRecovered.result.consequence_events_created.length, 0);

const missingDominatorFixture = buildFixture({ recoveredIds: [competitorMemoryId] });
const missingDominator = buildWorldSimulationRetrievalInducedForgettingConsequences({
  world_state: missingDominatorFixture.worldState,
  turn_id: turnId,
  memory_retrieval_processes: [{ result: missingDominatorFixture.runtime }],
});
assert.equal(missingDominator.result.consequence_events_created.length, 0);

const tamperedEventFixture = buildFixture();
tamperedEventFixture.worldState.retrieval_events["phase83a-retrieval-event"].character = "forged-character";
assert.throws(
  () => buildWorldSimulationRetrievalInducedForgettingConsequences({
    world_state: tamperedEventFixture.worldState,
    turn_id: turnId,
    memory_retrieval_processes: [{ result: tamperedEventFixture.runtime }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RIF_RETRIEVAL_EVENT_HASH_MISMATCH",
);

const detachedEvidenceFixture = buildFixture();
detachedEvidenceFixture.runtime.retrieval_process.initial_retrieval_competition_monitoring_evidence_hash =
  "forged-monitor-hash";
const detachedProcessHash = hashAgentRunValue(detachedEvidenceFixture.runtime.retrieval_process);
const detachedEvent = detachedEvidenceFixture.worldState.retrieval_events["phase83a-retrieval-event"];
detachedEvent.retrieval_process_hash = detachedProcessHash;
delete detachedEvent.retrieval_event_hash;
detachedEvent.retrieval_event_hash = hashAgentRunValue(detachedEvent);
assert.throws(
  () => buildWorldSimulationRetrievalInducedForgettingConsequences({
    world_state: detachedEvidenceFixture.worldState,
    turn_id: turnId,
    memory_retrieval_processes: [{ result: detachedEvidenceFixture.runtime }],
  }),
  (error) => error?.code === "WORLD_SIMULATION_RIF_R4C_BINDING_MISMATCH",
);

const loopSource = await readFile("server/src/world-simulation-loop-service.mjs", "utf8");
const stateSource = await readFile("server/src/world-simulation-state-service.mjs", "utf8");
assert.match(loopSource, /buildWorldSimulationRetrievalInducedForgettingConsequences/);
assert.match(loopSource, /retrievalInducedForgettingConsequenceMutationExecution/);
assert.match(loopSource, /future_accessibility_changed:\s*false/);
assert.match(
  stateSource,
  /retrieval_induced_forgetting_consequence:\s*\r?\n\s*input\.retrieval_induced_forgetting_consequence \?\? null/,
);

console.log(JSON.stringify({
  ok: true,
  phase: "Phase83A",
  version: worldSimulationRetrievalInducedForgettingConsequenceVersion,
  actual_selective_retrieval_required: true,
  recovered_dominator_required: true,
  unrecovered_dominated_competitor_required: true,
  deterministic_replay_noop_verified: true,
  tampered_retrieval_event_rejected: true,
  detached_r4c_binding_rejected: true,
  same_turn_feedback_allowed: false,
  future_accessibility_changed: false,
  memory_content_rewritten: false,
  inhibition_mechanism_asserted: false,
}));
console.log("Phase83A bounded retrieval-induced forgetting consequence evidence tests passed.");
