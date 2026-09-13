import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import { subjectiveClaimEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { subjectiveClaimRelationEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import { buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence } from "../../server/src/world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";
import { buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection } from "../../server/src/world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationInterpretationUpdateEventContract,
  buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents,
  memoryReconsolidationInterpretationUpdateEventSchemaVersion,
  memoryReconsolidationInterpretationUpdateHistoryReferenceSchemaVersion,
} from "../../server/src/world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";

function hashed(body, field) { return { ...body, [field]: hashAgentRunValue(body) }; }
function retrievalEvent({ id = "phase85c-retrieval", turnId = "turn-retrieval", memoryId = "m-prior" } = {}) {
  return hashed({ schema_version: memoryRetrievalEventSchemaVersion, retrieval_event_id: id, character: "Alice", turn_id: turnId, memory_recoveries: [{ source_memory_ref: memoryId }], recovered_any_content: true, immutable: true }, "retrieval_event_hash");
}
function claimEvent({ id, turnId, memoryId, proposition }) {
  return hashed({ schema_version: subjectiveClaimEventSchemaVersion, claim_event_id: id, character: "Alice", source_turn_id: turnId, proposition, proposition_hash: hashAgentRunValue({ proposition }), evidence: [{ source_memory_ref: memoryId, source_memory_hash: `${memoryId}-hash`, relation: "supports" }], status: "candidate_subjective_claim", immutable: true }, "claim_event_hash");
}
function relationEvent({ id = "phase85c-relation", sourceClaim, targetClaim, relation = "challenges", turnId = "turn-current" }) {
  return hashed({ schema_version: subjectiveClaimRelationEventSchemaVersion, relation_event_id: id, character: "Alice", source_turn_id: turnId, source_claim_event_id: sourceClaim.claim_event_id, source_claim_event_hash: sourceClaim.claim_event_hash, target_claim_event_id: targetClaim.claim_event_id, target_claim_event_hash: targetClaim.claim_event_hash, relation, status: "candidate_subjective_claim_relation", immutable: true }, "relation_event_hash");
}
function fixture({ relation = "challenges", relationId = "phase85c-relation", currentMemoryId = "m-new" } = {}) {
  const retrieval = retrievalEvent();
  const prior = claimEvent({ id: "claim-prior", turnId: "turn-prior", memoryId: "m-prior", proposition: "The library door is normally unlocked." });
  const current = claimEvent({ id: `claim-current-${currentMemoryId}`, turnId: "turn-current", memoryId: currentMemoryId, proposition: `The library door is locked now (${currentMemoryId}).` });
  const rel = relationEvent({ id: relationId, sourceClaim: current, targetClaim: prior, relation, turnId: "turn-current" });
  const worldState = {
    memories: { "m-prior": { memory_id: "m-prior", content: "The library door is normally unlocked." }, [currentMemoryId]: { memory_id: currentMemoryId, content: "The library door is locked now." } },
    retrieval_events: { [retrieval.retrieval_event_id]: retrieval },
    subjective_claim_events: { [prior.claim_event_id]: prior, [current.claim_event_id]: current },
    subjective_claim_history: [prior, current].map((claim) => ({ claim_event_id: claim.claim_event_id, claim_event_hash: claim.claim_event_hash, derived_index: true })),
    subjective_claim_relation_events: { [rel.relation_event_id]: rel },
    subjective_claim_relation_history: [{ relation_event_id: rel.relation_event_id, relation_event_hash: rel.relation_event_hash, derived_index: true }],
  };
  const phase85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: worldState, character: "Alice", current_turn_id: "turn-current" });
  const phase85b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: phase85a });
  return { worldState, phase85a, phase85b };
}
function applyTransitions(worldState, preview) { return JSON.parse(JSON.stringify(preview)); }

const first = fixture();
const input = { world_state: first.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: first.phase85a, phase85b_projection: first.phase85b };
const before = hashAgentRunValue(input);
const result = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents(input);
assert.equal(hashAgentRunValue(input), before, "Phase85C must not mutate caller input.");
assert.equal(result.ok, true);
assert.equal(result.result.created_event_count, 1);
assert.equal(result.result.processed_projection_count, 1);
assert.equal(result.result.already_persisted_event_count, 0);
const event = result.result.interpretation_update_events_created[0];
assert.equal(event.schema_version, memoryReconsolidationInterpretationUpdateEventSchemaVersion);
assert.equal(event.memory_id, "m-prior");
assert.equal(event.source_phase85b_projection_hash, first.phase85b.projection_set_hash);
assert.equal(event.source_projection_hash, first.phase85b.restabilization_update_projections[0].projection_hash);
assert.equal(event.original_memory_trace_preserved, true);
assert.equal(event.canonical_memory_content_rewritten, false);
assert.equal(event.storage_strength_mutated, false);
assert.equal(event.retrieval_strength_mutated, false);
assert.equal(event.biological_reconsolidation_established, false);
assert.equal(event.future_retrieval_effect_applied, false);
assert.equal(event.previous_interpretation_update_event_id, null);
assert.equal(event.interpretation_update_event_hash.length > 0, true);
assert.equal(result.result.history_references_appended[0].schema_version, memoryReconsolidationInterpretationUpdateHistoryReferenceSchemaVersion);
assert.deepEqual(result.result.preview_world_state.memories, first.worldState.memories, "Phase85C must preserve canonical memory content exactly.");
assert.equal(result.result.audit.historical_memory_content_rewritten, false);

const replayState = applyTransitions(first.worldState, result.result.preview_world_state);
const replayPhase85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: replayState, character: "Alice", current_turn_id: "turn-current" });
const replayPhase85b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: replayState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: replayPhase85a });
const replay = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: replayState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: replayPhase85a, phase85b_projection: replayPhase85b });
assert.equal(replay.result.created_event_count, 0, "Canonical replay must be idempotent.");
assert.equal(replay.result.already_persisted_event_count, 1);
assert.deepEqual(replay.result.state_transitions, []);

const chainedBase = JSON.parse(JSON.stringify(replayState));
const secondFixture = fixture({ relation: "supersedes", relationId: "phase85c-relation-2", currentMemoryId: "m-new-2" });
chainedBase.retrieval_events = secondFixture.worldState.retrieval_events;
chainedBase.subjective_claim_events = secondFixture.worldState.subjective_claim_events;
chainedBase.subjective_claim_history = secondFixture.worldState.subjective_claim_history;
chainedBase.subjective_claim_relation_events = secondFixture.worldState.subjective_claim_relation_events;
chainedBase.subjective_claim_relation_history = secondFixture.worldState.subjective_claim_relation_history;
chainedBase.memories["m-new-2"] = secondFixture.worldState.memories["m-new-2"];
const second85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: chainedBase, character: "Alice", current_turn_id: "turn-current" });
const second85b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: chainedBase, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: second85a });
const chained = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: chainedBase, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: second85a, phase85b_projection: second85b });
assert.equal(chained.result.created_event_count, 1);
const secondEvent = chained.result.interpretation_update_events_created[0];
assert.equal(secondEvent.previous_interpretation_update_event_id, event.interpretation_update_event_id);
assert.equal(secondEvent.previous_interpretation_update_event_hash, event.interpretation_update_event_hash);

const tampered = fixture();
const tamperedProjection = JSON.parse(JSON.stringify(tampered.phase85b));
tamperedProjection.restabilization_update_projections[0].memory_id = "m-forged";
assert.throws(() => buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: tampered.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: tampered.phase85a, phase85b_projection: tamperedProjection }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_PHASE85B_HASH_MISMATCH");

const detached = fixture();
const detachedState = JSON.parse(JSON.stringify(detached.worldState));
detachedState.subjective_claim_relation_events = {};
detachedState.subjective_claim_relation_history = [];
assert.throws(() => buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: detachedState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: detached.phase85a, phase85b_projection: detached.phase85b }), (error) => ["WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_CANONICAL_MISMATCH", "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_PHASE85B_CANONICAL_MISMATCH"].includes(error?.code));

const corruptedHistory = JSON.parse(JSON.stringify(result.result.preview_world_state));
corruptedHistory.memory_reconsolidation_interpretation_update_history[0].memory_id = "m-corrupt";
const corrupted85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: corruptedHistory, character: "Alice", current_turn_id: "turn-current" });
const corrupted85b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: corruptedHistory, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: corrupted85a });
assert.throws(() => buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: corruptedHistory, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: corrupted85a, phase85b_projection: corrupted85b }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_REFERENCE_MISMATCH");

const contract = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEventContract();
assert.equal(contract.phase, "Phase85C");
assert.equal(contract.canonical_phase85b_reconstruction_required, true);
assert.equal(contract.immutable_event_write_once_required, true);
assert.equal(contract.append_only_history_required, true);
assert.equal(contract.per_character_previous_event_hash_chain_required, true);
assert.equal(contract.original_memory_trace_preserved, true);
assert.equal(contract.memory_content_rewrite_allowed, false);
assert.equal(contract.biological_reconsolidation_claimed, false);
assert.equal(contract.future_retrieval_effect_installed, false);
assert.equal(contract.downstream_retrieval_consumption_requires_separate_phase, true);

console.log("Phase85C append-only reconsolidation interpretation update events: PASS");
