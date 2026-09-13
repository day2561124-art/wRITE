import assert from "node:assert/strict";

import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import { subjectiveClaimEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { subjectiveClaimRelationEventSchemaVersion } from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import {
  buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence,
  buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidenceContract,
  worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion,
} from "../../server/src/world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";

function hashed(body, field) { return { ...body, [field]: hashAgentRunValue(body) }; }
function retrievalEvent({ id = "phase85a-retrieval", turnId = "turn-retrieval", memoryId = "m-prior" } = {}) {
  return hashed({ schema_version: memoryRetrievalEventSchemaVersion, retrieval_event_id: id, character: "Alice", turn_id: turnId, memory_recoveries: [{ source_memory_ref: memoryId }], recovered_any_content: true, immutable: true }, "retrieval_event_hash");
}
function claimEvent({ id, turnId, memoryId, proposition }) {
  return hashed({ schema_version: subjectiveClaimEventSchemaVersion, claim_event_id: id, character: "Alice", source_turn_id: turnId, proposition, proposition_hash: hashAgentRunValue({ proposition }), evidence: [{ source_memory_ref: memoryId, source_memory_hash: `${memoryId}-hash`, relation: "supports" }], status: "candidate_subjective_claim", immutable: true }, "claim_event_hash");
}
function relationEvent({ id = "phase85a-relation", sourceClaim, targetClaim, relation = "challenges", turnId = "turn-current" } = {}) {
  return hashed({ schema_version: subjectiveClaimRelationEventSchemaVersion, relation_event_id: id, character: "Alice", source_turn_id: turnId, source_claim_event_id: sourceClaim.claim_event_id, source_claim_event_hash: sourceClaim.claim_event_hash, target_claim_event_id: targetClaim.claim_event_id, target_claim_event_hash: targetClaim.claim_event_hash, relation, status: "candidate_subjective_claim_relation", immutable: true }, "relation_event_hash");
}
function fixture({ retrievalTurn = "turn-retrieval", targetTurn = "turn-prior", relationTurn = "turn-current" } = {}) {
  const retrieval = retrievalEvent({ turnId: retrievalTurn });
  const targetClaim = claimEvent({ id: "claim-prior", turnId: targetTurn, memoryId: "m-prior", proposition: "The library door is normally unlocked." });
  const sourceClaim = claimEvent({ id: "claim-current", turnId: relationTurn, memoryId: "m-new", proposition: "The library door is locked now." });
  const relation = relationEvent({ sourceClaim, targetClaim, turnId: relationTurn });
  return { retrieval, targetClaim, sourceClaim, relation, worldState: {
    retrieval_events: { [retrieval.retrieval_event_id]: retrieval },
    subjective_claim_events: { [targetClaim.claim_event_id]: targetClaim, [sourceClaim.claim_event_id]: sourceClaim },
    subjective_claim_history: [targetClaim, sourceClaim].map((claim) => ({ claim_event_id: claim.claim_event_id, claim_event_hash: claim.claim_event_hash, derived_index: true })),
    subjective_claim_relation_events: { [relation.relation_event_id]: relation },
    subjective_claim_relation_history: [{ relation_event_id: relation.relation_event_id, relation_event_hash: relation.relation_event_hash, derived_index: true }],
  } };
}

const positive = fixture();
const input = { world_state: positive.worldState, character: "Alice", current_turn_id: "turn-current" };
const before = hashAgentRunValue(input);
const result = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence(input);
assert.equal(hashAgentRunValue(input), before, "Phase85A must not mutate input state.");
assert.equal(result.version, worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion);
assert.equal(result.phase, "Phase85A");
assert.deepEqual(result.source_retrieval_event_ids, ["phase85a-retrieval"]);
assert.deepEqual(result.source_relation_event_ids, ["phase85a-relation"]);
assert.deepEqual(result.lability_candidates.map((entry) => entry.memory_id), ["m-prior"]);
assert.equal(result.lability_candidates[0].reconsolidation_lability_candidate, true);
assert.equal(result.lability_candidates[0].reconsolidation_established, false);
assert.equal(result.lability_candidates[0].memory_update_applied, false);
assert.equal(result.lability_candidates[0].evidence[0].retrieved_memory_supported_prior_claim, true);
assert.equal(result.lability_candidates[0].evidence[0].later_explicit_claim_conflict_present, true);
assert.deepEqual(result.lability_candidates[0].evidence[0].current_supporting_memory_refs, ["m-new"]);
assert.equal(result.audit.retrieval_alone_used_as_reconsolidation_proof, false);
assert.equal(result.audit.memory_content_rewritten, false);
assert.equal(result.audit.reconsolidation_update_applied, false);

const retrievalOnly = fixture();
retrievalOnly.worldState.subjective_claim_relation_events = {};
retrievalOnly.worldState.subjective_claim_relation_history = [];
assert.deepEqual(buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: retrievalOnly.worldState, character: "Alice", current_turn_id: "turn-current" }).lability_candidates, [], "Successful retrieval alone must not establish lability evidence.");

const sameTurnRetrieval = fixture({ retrievalTurn: "turn-current" });
assert.deepEqual(buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: sameTurnRetrieval.worldState, character: "Alice", current_turn_id: "turn-current" }).lability_candidates, [], "Same-turn retrieval feedback must be excluded.");

const sameTurnTarget = fixture({ targetTurn: "turn-current" });
assert.deepEqual(buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: sameTurnTarget.worldState, character: "Alice", current_turn_id: "turn-current" }).lability_candidates, [], "The challenged target must represent a prior-turn claim.");

const unrelated = fixture();
unrelated.targetClaim.evidence[0].source_memory_ref = "m-unrelated";
{
  const body = { ...unrelated.targetClaim }; delete body.claim_event_hash;
  unrelated.targetClaim.claim_event_hash = hashAgentRunValue(body);
}
unrelated.worldState.subjective_claim_events[unrelated.targetClaim.claim_event_id] = unrelated.targetClaim;
unrelated.worldState.subjective_claim_history[0].claim_event_hash = unrelated.targetClaim.claim_event_hash;
// Keep the unrelated-memory fixture internally consistent with the relation's
// pinned claim image; stale pins are a separate corruption case below.
unrelated.relation.target_claim_event_hash = unrelated.targetClaim.claim_event_hash;
{
  const body = { ...unrelated.relation }; delete body.relation_event_hash;
  unrelated.relation.relation_event_hash = hashAgentRunValue(body);
}
unrelated.worldState.subjective_claim_relation_history[0].relation_event_hash = unrelated.relation.relation_event_hash;
assert.deepEqual(buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: unrelated.worldState, character: "Alice", current_turn_id: "turn-current" }).lability_candidates, [], "Claim conflict unrelated to the retrieved memory must not create a candidate.");

const detachedClaim = fixture();
detachedClaim.targetClaim.proposition = "A different prior interpretation.";
{
  const body = { ...detachedClaim.targetClaim }; delete body.claim_event_hash;
  detachedClaim.targetClaim.claim_event_hash = hashAgentRunValue(body);
}
detachedClaim.worldState.subjective_claim_history[0].claim_event_hash = detachedClaim.targetClaim.claim_event_hash;
assert.throws(() => buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: detachedClaim.worldState, character: "Alice", current_turn_id: "turn-current" }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_CLAIM_HASH_MISMATCH", "Rehashing a changed claim cannot silently retarget an old conflict relation.");

const tampered = fixture();
tampered.worldState.subjective_claim_relation_events["phase85a-relation"].relation = "supersedes";
assert.throws(() => buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: tampered.worldState, character: "Alice", current_turn_id: "turn-current" }), (error) => error?.code === "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_EVENT_HASH_MISMATCH");

const contract = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidenceContract();
assert.equal(contract.phase, "Phase85A");
assert.equal(contract.canonical_prior_turn_successful_retrieval_required, true);
assert.equal(contract.canonical_current_turn_claim_conflict_relation_required, true);
assert.equal(contract.retrieval_alone_establishes_reconsolidation, false);
assert.equal(contract.prediction_error_interpreted_as_bounded_claim_conflict_proxy, true);
assert.equal(contract.numeric_prediction_error_threshold_modeled, false);
assert.equal(contract.memory_content_rewrite_allowed, false);
assert.equal(contract.reconsolidation_update_applied, false);
assert.equal(contract.downstream_restabilization_or_update_requires_separate_phase, true);

console.log("Phase85A bounded reconsolidation lability candidate evidence: PASS");
