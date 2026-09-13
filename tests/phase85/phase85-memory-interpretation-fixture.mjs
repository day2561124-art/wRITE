import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildWorldSimulationSubjectiveClaims } from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";
import { buildWorldSimulationSubjectiveClaimConflictRevisions } from "../../server/src/world-simulation-subjective-claim-conflict-revision-projection-service.mjs";
import { memoryRetrievalEventSchemaVersion } from "../../server/src/world-simulation-memory-retrieval-persistence-service.mjs";
import { buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence } from "../../server/src/world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";
import { buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection } from "../../server/src/world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";
import { buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents, validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory } from "../../server/src/world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";
function hashed(body, field) { return { ...body, [field]: hashAgentRunValue(body) }; }
export function fixture(character = "Alice", count = 1) {
  function memory(id, turn, description) {
    return { memory_id: character + id, memory_type: "episodic_direct_perception",
      content: { kind: "visual_observation", description }, source: { kind: "direct_perception", sense: "visual" },
      internal_provenance: { event_id: character + id, scene_id: "scene85d", turn_id: turn, observation_hash: id, formation_version: "phase63a-subjective-memory-formation-v1" },
      formation_stage: "encoded_unconsolidated", engine_persisted_trace: true, last_recalled_at: null,
      accessible: true, suppressed: false, possibly_incorrect: false, source_confused: false, subjective_memory_not_world_truth: true };
  }
  const prior = memory("old", "prior", character + " saw the door open.");
  let world = { simulation_time: "2026-09-13T08:00:00+08:00", memories: { [character]: [prior] } };
  function claim(record, turn, proposition) {
    const result = buildWorldSimulationSubjectiveClaims({ world_state: world, turn_id: turn,
      source_memory_records: [{ character, memory_record: record }],
      claim_proposals: [{ proposal_ref: record.memory_id, character, proposition,
        evidence: [{ source_memory_ref: record.memory_id, relation: "supports" }] }] });
    world = structuredClone(result.result.preview_world_state);
    return world.subjective_claim_history.at(-1).claim_event_id;
  }
  const priorId = claim(prior, "prior", character + " believed the door was usually open.");
  const retrieval = hashed({ schema_version: memoryRetrievalEventSchemaVersion, retrieval_event_id: character + "-retrieval", character, turn_id: "recall",
    memory_recoveries: [{ source_memory_ref: prior.memory_id }], recovered_any_content: true, immutable: true }, "retrieval_event_hash");
  world.retrieval_events = { [retrieval.retrieval_event_id]: retrieval };
  for (let i = 0; i < count; i++) {
    const next = memory("new" + i, "update", character + " later saw the door locked " + i);
    world.memories[character].push(next);
    const currentId = claim(next, "update", character + " now suspects access is restricted " + i);
    const relations = buildWorldSimulationSubjectiveClaimConflictRevisions({ world_state: world, turn_id: "update",
      relation_proposals: [{ proposal_ref: next.memory_id, character, source_claim_event_id: currentId,
        target_claim_event_id: priorId, relation: i % 2 ? "supersedes" : "challenges" }] });
    world = structuredClone(relations.result.preview_world_state);
  }
  const a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: world, character, current_turn_id: "update" });
  const b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: world, character, current_turn_id: "update", phase85a_evidence: a });
  const c = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: world, character, current_turn_id: "update", phase85a_evidence: a, phase85b_projection: b });
  return structuredClone(c.result.preview_world_state);
}
