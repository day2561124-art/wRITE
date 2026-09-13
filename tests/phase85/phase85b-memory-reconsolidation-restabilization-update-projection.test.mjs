import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import { subjectiveClaimEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { subjectiveClaimRelationEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence,
} from "../../server/src/world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection,
  buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjectionContract,
  worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion,
} from "../../server/src/world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";

function hashed(body, field) { return { ...body, [field]: hashAgentRunValue(body) }; }
function retrievalEvent({ id = "phase85b-retrieval", turnId = "turn-retrieval", memoryId = "m-prior" } = {}) {
  return hashed({ schema_version: memoryRetrievalEventSchemaVersion, retrieval_event_id: id, character: "Alice", turn_id: turnId, memory_recoveries: [{ source_memory_ref: memoryId }], recovered_any_content: true, immutable: true }, "retrieval_event_hash");
}
function claimEvent({ id, turnId, memoryId, proposition }) {
  return hashed({ schema_version: subjectiveClaimEventSchemaVersion, claim_event_id: id, character: "Alice", source_turn_id: turnId, proposition, proposition_hash: hashAgentRunValue({ proposition }), evidence: [{ source_memory_ref: memoryId, source_memory_hash: `${memoryId}-hash`, relation: "supports" }], status: "candidate_subjective_claim", immutable: true }, "claim_event_hash");
}
function relationEvent({ id = "phase85b-relation", sourceClaim, targetClaim, relation = "challenges", turnId = "turn-current" } = {}) {
  return hashed({ schema_version: subjectiveClaimRelationEventSchemaVersion, relation_event_id: id, character: "Alice", source_turn_id: turnId, source_claim_event_id: sourceClaim.claim_event_id, source_claim_event_hash: sourceClaim.claim_event_hash, target_claim_event_id: targetClaim.claim_event_id, target_claim_event_hash: targetClaim.claim_event_hash, relation, status: "candidate_subjective_claim_relation", immutable: true }, "relation_event_hash");
}
function fixture({ relation = "challenges" } = {}) {
  const retrieval = retrievalEvent();
  const targetClaim = claimEvent({ id: "claim-prior", turnId: "turn-prior", memoryId: "m-prior", proposition: "The library door is normally unlocked." });
  const sourceClaim = claimEvent({ id: "claim-current", turnId: "turn-current", memoryId: "m-new", proposition: "The library door is locked now." });
  const relationEventValue = relationEvent({ sourceClaim, targetClaim, relation });
  const worldState = {
    retrieval_events: { [retrieval.retrieval_event_id]: retrieval },
    subjective_claim_events: { [targetClaim.claim_event_id]: targetClaim, [sourceClaim.claim_event_id]: sourceClaim },
    subjective_claim_history: [targetClaim, sourceClaim].map((claim) => ({ claim_event_id: claim.claim_event_id, claim_event_hash: claim.claim_event_hash, derived_index: true })),
    subjective_claim_relation_events: { [relationEventValue.relation_event_id]: relationEventValue },
    subjective_claim_relation_history: [{ relation_event_id: relationEventValue.relation_event_id, relation_event_hash: relationEventValue.relation_event_hash, derived_index: true }],
  };
  const phase85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: worldState, character: "Alice", current_turn_id: "turn-current" });
  return { worldState, phase85a };
}

const positive = fixture();
const input = { world_state: positive.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: positive.phase85a };
const before = hashAgentRunValue(input);
const result = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection(input);
assert.equal(hashAgentRunValue(input), before, "Phase85B must not mutate input state.");
assert.equal(result.version, worldSimulationMemoryReconsolidationRestabilizationUpdateProjectionVersion);
assert.equal(result.phase, "Phase85B");
assert.equal(result.source_phase85a_evidence_hash, positive.phase85a.evidence_hash);
assert.equal(result.restabilization_update_projections.length, 1);
const projection = result.restabilization_update_projections[0];
assert.equal(projection.memory_id, "m-prior");
assert.equal(projection.projection_kind, "bounded_reconsolidation_interpretive_update");
assert.deepEqual(projection.source_retrieval_event_ids, ["phase85b-retrieval"]);
assert.deepEqual(projection.conflict_relation_event_ids, ["phase85b-relation"]);
assert.deepEqual(projection.conflict_relations, ["challenges"]);
assert.deepEqual(projection.prior_claim_event_ids, ["claim-prior"]);
assert.deepEqual(projection.current_claim_event_ids, ["claim-current"]);
assert.deepEqual(projection.newly_relevant_supporting_memory_refs, ["m-new"]);
assert.equal(projection.old_memory_trace_preserved, true);
assert.equal(projection.interpretation_update_projected, true);
assert.equal(projection.canonical_memory_content_rewritten, false);
assert.equal(projection.storage_strength_mutated, false);
assert.equal(projection.retrieval_strength_mutated, false);
assert.equal(projection.biological_reconsolidation_established, false);
assert.equal(projection.restabilization_application_performed, false);
assert.equal(projection.projection_hash.length > 0, true);
assert.equal(result.audit.phase85a_canonical_reconstruction_verified, true);
assert.equal(result.audit.update_projection_is_interpretive_overlay_only, true);
assert.equal(result.audit.canonical_world_state_mutated, false);

const supersedes = fixture({ relation: "supersedes" });
const supersedingProjection = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: supersedes.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: supersedes.phase85a });
assert.deepEqual(supersedingProjection.restabilization_update_projections[0].conflict_relations, ["supersedes"]);

const noCandidate = fixture();
noCandidate.worldState.subjective_claim_relation_events = {};
noCandidate.worldState.subjective_claim_relation_history = [];
const noCandidate85a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: noCandidate.worldState, character: "Alice", current_turn_id: "turn-current" });
const empty = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: noCandidate.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: noCandidate85a });
assert.deepEqual(empty.restabilization_update_projections, [], "Phase85B must not invent an update without a Phase85A lability candidate.");

const tampered = fixture();
const tamperedEvidence = JSON.parse(JSON.stringify(tampered.phase85a));
tamperedEvidence.lability_candidates[0].evidence[0].conflict_relation = "supersedes";
assert.throws(() => buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: tampered.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: tamperedEvidence }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_HASH_MISMATCH");

const detached = fixture();
detached.worldState.subjective_claim_relation_events = {};
detached.worldState.subjective_claim_relation_history = [];
assert.throws(() => buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: detached.worldState, character: "Alice", current_turn_id: "turn-current", phase85a_evidence: detached.phase85a }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_RESTABILIZATION_PHASE85A_CANONICAL_MISMATCH");

const contract = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjectionContract();
assert.equal(contract.phase, "Phase85B");
assert.equal(contract.canonical_phase85a_evidence_required, true);
assert.equal(contract.phase85a_reconstruction_verification_required, true);
assert.equal(contract.biological_reconsolidation_claimed, false);
assert.equal(contract.universal_reconsolidation_window_modeled, false);
assert.equal(contract.numeric_prediction_error_threshold_modeled, false);
assert.equal(contract.memory_content_rewrite_allowed, false);
assert.equal(contract.update_projection_is_interpretive_overlay_only, true);
assert.equal(contract.downstream_application_requires_separate_phase, true);

console.log("Phase85B bounded reconsolidation restabilization update projection: PASS");
