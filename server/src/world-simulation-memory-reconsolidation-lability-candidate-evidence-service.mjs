import { hashAgentRunValue } from "./agent-run-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "./world-simulation-memory-retrieval-persistence-service.mjs";
import { subjectiveClaimEventSchemaVersion } from "./world-simulation-subjective-claim-projection-service.mjs";
import { subjectiveClaimRelationEventSchemaVersion } from "./world-simulation-subjective-claim-conflict-revision-projection-service.mjs";

export const worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion =
  "phase85a-memory-reconsolidation-lability-candidate-evidence-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_INVALID";
  throw error;
}
function sameCharacter(left, right) {
  return String(left ?? "").trim().toLocaleLowerCase("zh-Hant-TW")
    === String(right ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function verifyHash(event, hashField, code, label) {
  const stored = requiredString(event?.[hashField], `${label}.${hashField}`);
  const body = cloneJson(event);
  delete body[hashField];
  if (hashAgentRunValue(body) !== stored) {
    const error = new Error(`${label} failed immutable hash verification.`);
    error.code = code;
    throw error;
  }
}
function assertRetrievalEvent(event, eventId, character) {
  if (!isObject(event)
    || event.schema_version !== memoryRetrievalEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.retrieval_event_id) !== eventId
    || !sameCharacter(event.character, character)) {
    const error = new Error(`RetrievalEvent ${eventId} is invalid for Phase85A.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RETRIEVAL_EVENT_INVALID";
    throw error;
  }
  verifyHash(event, "retrieval_event_hash",
    "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RETRIEVAL_EVENT_HASH_MISMATCH",
    `RetrievalEvent ${eventId}`);
}
function assertClaimEvent(event, eventId, character) {
  if (!isObject(event)
    || event.schema_version !== subjectiveClaimEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.claim_event_id) !== eventId
    || event.status !== "candidate_subjective_claim"
    || !sameCharacter(event.character, character)
    || !Array.isArray(event.evidence)) {
    const error = new Error(`SubjectiveClaimEvent ${eventId} is invalid for Phase85A.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_CLAIM_EVENT_INVALID";
    throw error;
  }
  verifyHash(event, "claim_event_hash",
    "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_CLAIM_EVENT_HASH_MISMATCH",
    `SubjectiveClaimEvent ${eventId}`);
}
function assertRelationEvent(event, eventId, character) {
  if (!isObject(event)
    || event.schema_version !== subjectiveClaimRelationEventSchemaVersion
    || event.immutable !== true
    || optionalString(event.relation_event_id) !== eventId
    || event.status !== "candidate_subjective_claim_relation"
    || !sameCharacter(event.character, character)
    || !["challenges", "supersedes"].includes(event.relation)) {
    const error = new Error(`SubjectiveClaimRelationEvent ${eventId} is invalid for Phase85A.`);
    error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_EVENT_INVALID";
    throw error;
  }
  verifyHash(event, "relation_event_hash",
    "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_EVENT_HASH_MISMATCH",
    `SubjectiveClaimRelationEvent ${eventId}`);
}
function canonicalClaimIds(worldState) {
  const ids = new Set();
  for (const [index, ref] of array(worldState.subjective_claim_history).entries()) {
    const id = optionalString(ref?.claim_event_id);
    if (!id || ref?.derived_index !== true || !optionalString(ref?.claim_event_hash)) {
      const error = new Error(`subjective_claim_history[${index}] is invalid for Phase85A.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_CLAIM_HISTORY_INVALID";
      throw error;
    }
    const event = object(object(worldState.subjective_claim_events)[id]);
    if (!Object.keys(event).length || event.claim_event_hash !== ref.claim_event_hash) {
      const error = new Error(`subjective_claim_history[${index}] cannot verify ${id}.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_CLAIM_HISTORY_MISMATCH";
      throw error;
    }
    ids.add(id);
  }
  return ids;
}
function canonicalRelationEvents(worldState, character, currentTurnId) {
  const output = [];
  const seen = new Set();
  for (const [index, ref] of array(worldState.subjective_claim_relation_history).entries()) {
    const id = optionalString(ref?.relation_event_id);
    if (!id || ref?.derived_index !== true || !optionalString(ref?.relation_event_hash) || seen.has(id)) {
      const error = new Error(`subjective_claim_relation_history[${index}] is invalid for Phase85A.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_HISTORY_INVALID";
      throw error;
    }
    seen.add(id);
    const event = object(object(worldState.subjective_claim_relation_events)[id]);
    // Histories are world-level; ownership must be scoped before validating
    // this character's relation. An unrelated character is not a mismatch.
    if (optionalString(event.character) && !sameCharacter(event.character, character)) continue;
    assertRelationEvent(event, id, character);
    if (event.relation_event_hash !== ref.relation_event_hash) {
      const error = new Error(`subjective_claim_relation_history[${index}] hash mismatch for ${id}.`);
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_HISTORY_MISMATCH";
      throw error;
    }
    if (event.source_turn_id === currentTurnId) output.push(event);
  }
  return output;
}
function recoveredMemoryIds(event) {
  return new Set(array(event.memory_recoveries)
    .map((item) => optionalString(item?.source_memory_ref))
    .filter(Boolean));
}
function supportingMemoryIds(claim) {
  return new Set(array(claim.evidence)
    .filter((item) => item?.relation === "supports")
    .map((item) => optionalString(item?.source_memory_ref))
    .filter(Boolean));
}

export function buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidenceContract() {
  return deepFreeze({
    version: worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion,
    phase: "Phase85A",
    status: "bounded_reconsolidation_lability_candidate_evidence_installed",
    canonical_prior_turn_successful_retrieval_required: true,
    canonical_current_turn_claim_conflict_relation_required: true,
    relation_target_must_be_prior_turn_claim: true,
    retrieved_memory_must_support_relation_target_claim: true,
    current_turn_new_evidence_must_support_relation_source_claim: true,
    challenges_or_supersedes_relation_allowed: true,
    retrieval_alone_establishes_reconsolidation: false,
    prediction_error_interpreted_as_bounded_claim_conflict_proxy: true,
    numeric_prediction_error_threshold_modeled: false,
    universal_reconsolidation_window_modeled: false,
    memory_lability_is_candidate_evidence_not_world_truth: true,
    memory_content_rewrite_allowed: false,
    storage_strength_mutation_allowed: false,
    retrieval_strength_mutation_allowed: false,
    same_turn_retrieval_feedback_allowed: false,
    reconsolidation_update_applied: false,
    downstream_restabilization_or_update_requires_separate_phase: true,
  });
}

export function buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const character = requiredString(input.character, "character");
  const currentTurnId = requiredString(input.current_turn_id, "current_turn_id");
  const claimIds = canonicalClaimIds(worldState);
  const relations = canonicalRelationEvents(worldState, character, currentTurnId);
  const claims = object(worldState.subjective_claim_events);
  const retrievals = object(worldState.retrieval_events);
  const priorRetrievals = [];

  for (const [eventId, event] of Object.entries(retrievals)) {
    if (!sameCharacter(event?.character, character)) continue;
    assertRetrievalEvent(event, eventId, character);
    if (event.turn_id === currentTurnId || event.recovered_any_content !== true) continue;
    if (!array(event.memory_recoveries).length) continue;
    priorRetrievals.push(event);
  }

  const candidates = new Map();
  for (const relation of relations) {
    const sourceId = requiredString(relation.source_claim_event_id, "relation.source_claim_event_id");
    const targetId = requiredString(relation.target_claim_event_id, "relation.target_claim_event_id");
    if (!claimIds.has(sourceId) || !claimIds.has(targetId)) continue;
    const source = object(claims[sourceId]);
    const target = object(claims[targetId]);
    assertClaimEvent(source, sourceId, character);
    assertClaimEvent(target, targetId, character);
    if (relation.source_claim_event_hash !== source.claim_event_hash
      || relation.target_claim_event_hash !== target.claim_event_hash) {
      const error = new Error("Phase85A conflict relation is detached from its canonical claim images.");
      error.code = "WORLD_SIMULATION_RECONSOLIDATION_LABILITY_RELATION_CLAIM_HASH_MISMATCH";
      throw error;
    }
    if (source.source_turn_id !== currentTurnId || target.source_turn_id === currentTurnId) continue;
    const sourceSupports = supportingMemoryIds(source);
    const targetSupports = supportingMemoryIds(target);
    if (!sourceSupports.size || !targetSupports.size) continue;

    for (const retrieval of priorRetrievals) {
      const recovered = recoveredMemoryIds(retrieval);
      for (const memoryId of targetSupports) {
        if (!recovered.has(memoryId)) continue;
        const evidence = {
          source_memory_ref: memoryId,
          source_retrieval_event_id: retrieval.retrieval_event_id,
          source_retrieval_event_hash: retrieval.retrieval_event_hash,
          source_retrieval_turn_id: retrieval.turn_id,
          conflict_relation_event_id: relation.relation_event_id,
          conflict_relation_event_hash: relation.relation_event_hash,
          conflict_relation: relation.relation,
          prior_claim_event_id: target.claim_event_id,
          prior_claim_event_hash: target.claim_event_hash,
          current_claim_event_id: source.claim_event_id,
          current_claim_event_hash: source.claim_event_hash,
          current_supporting_memory_refs: [...sourceSupports].sort(),
          retrieved_memory_supported_prior_claim: true,
          later_explicit_claim_conflict_present: true,
          prediction_error_proxy_only: true,
        };
        const bucket = candidates.get(memoryId) ?? [];
        bucket.push(evidence);
        candidates.set(memoryId, bucket);
      }
    }
  }

  const labilityCandidates = [...candidates.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hant-TW"))
    .map(([memoryId, evidence]) => ({
      memory_id: memoryId,
      evidence: evidence.sort((left, right) =>
        left.conflict_relation_event_id.localeCompare(right.conflict_relation_event_id, "en")
        || left.source_retrieval_event_id.localeCompare(right.source_retrieval_event_id, "en")),
      reconsolidation_lability_candidate: true,
      reconsolidation_established: false,
      memory_update_applied: false,
    }));

  const resultBody = {
    version: worldSimulationMemoryReconsolidationLabilityCandidateEvidenceVersion,
    phase: "Phase85A",
    character,
    current_turn_id: currentTurnId,
    source_retrieval_event_ids: priorRetrievals.map((event) => event.retrieval_event_id).sort(),
    source_relation_event_ids: relations.map((event) => event.relation_event_id).sort(),
    lability_candidates: labilityCandidates,
    audit: {
      canonical_retrieval_events_hash_verified: true,
      canonical_claim_events_hash_verified: true,
      canonical_claim_relation_events_hash_verified: true,
      same_turn_retrieval_feedback_used: false,
      retrieval_alone_used_as_reconsolidation_proof: false,
      numeric_prediction_error_threshold_used: false,
      universal_reconsolidation_window_assumed: false,
      memory_content_rewritten: false,
      storage_strength_mutated: false,
      retrieval_strength_mutated: false,
      reconsolidation_update_applied: false,
      downstream_restabilization_or_update_requires_separate_phase: true,
    },
  };
  return deepFreeze({
    ...resultBody,
    evidence_hash: hashAgentRunValue(resultBody),
  });
}
