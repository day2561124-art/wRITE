import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence } from "./world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";
import { buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection } from "./world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";
import { buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents, validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory } from "./world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";

export const worldSimulationMemoryInterpretationTurnVersion = "phase85e-memory-interpretation-native-turn-v1";
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) freeze(item);
  return value;
}

// Stage domain events in the same speculative state as their source claims.
// The caller's authoritative mutation executor and world transaction own commit.
export function buildWorldSimulationMemoryInterpretationTurn(input = {}) {
  if (!input.world_state || typeof input.world_state !== "object" || Array.isArray(input.world_state)
    || typeof input.current_turn_id !== "string" || !input.current_turn_id.trim()) {
    const error = new Error("Phase85E requires world_state and current_turn_id.");
    error.code = "WORLD_SIMULATION_MEMORY_INTERPRETATION_TURN_INVALID";
    throw error;
  }
  const original = clone(input.world_state);
  let preview = clone(original);
  validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory(original);
  const turnId = input.current_turn_id.trim();
  const characters = new Map();
  for (const ref of original.subjective_claim_relation_history ?? []) {
    const relation = original.subjective_claim_relation_events?.[ref.relation_event_id];
    if (!relation || relation.relation_event_hash !== ref.relation_event_hash) {
      const error = new Error("Phase85E requires canonical committed relation references.");
      error.code = "WORLD_SIMULATION_MEMORY_INTERPRETATION_TURN_RELATION_INVALID";
      throw error;
    }
    if (relation.source_turn_id === turnId) {
      if (typeof relation.character !== "string" || !relation.character.trim()) {
        const error = new Error("Phase85E relation requires a character owner.");
        error.code = "WORLD_SIMULATION_MEMORY_INTERPRETATION_TURN_RELATION_INVALID";
        throw error;
      }
      const ownerKey = relation.character.trim().toLocaleLowerCase("zh-Hant-TW");
      if (!characters.has(ownerKey)) characters.set(ownerKey, relation.character.trim());
    }
  }
  const transitions = [];
  const summaries = [];
  let created = 0;
  let existing = 0;
  for (const character of [...characters.values()].sort()) {
    const a = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: preview, character, current_turn_id: turnId });
    const b = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: preview, character, current_turn_id: turnId, phase85a_evidence: a });
    const c = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: preview, character, current_turn_id: turnId, phase85a_evidence: a, phase85b_projection: b });
    created += c.result.created_event_count;
    existing += c.result.already_persisted_event_count;
    transitions.push(...c.result.state_transitions.filter((entry) => entry.field !== "memory_reconsolidation_interpretation_update_history"));
    summaries.push({ character, lability_candidate_count: a.lability_candidates.length,
      created_event_count: c.result.created_event_count, already_persisted_event_count: c.result.already_persisted_event_count,
      source_phase85a_evidence_hash: a.evidence_hash, source_phase85b_projection_hash: b.projection_set_hash });
    preview = clone(c.result.preview_world_state);
  }
  if (created) {
    // One index transition avoids multiple writes to the same field being
    // reordered by the generic chronological queue for multi-character turns.
    transitions.push({ entity: "world", field: "memory_reconsolidation_interpretation_update_history",
      from: clone(original.memory_reconsolidation_interpretation_update_history ?? null),
      to: clone(preview.memory_reconsolidation_interpretation_update_history),
      cause: "append native-turn memory interpretation history", source_layer: "memory_reconsolidation_interpretation_update" });
  }
  const summary = { version: worldSimulationMemoryInterpretationTurnVersion,
    processed_character_count: characters.size, created_event_count: created,
    already_persisted_event_count: existing, character_summaries: summaries,
    same_turn_character_feedback_allowed: false, original_memory_rewritten: false,
    memory_strength_mutated: false, biological_reconsolidation_claimed: false,
    commit_owned_by_world_transaction: true };
  return freeze({ ok: true, version: worldSimulationMemoryInterpretationTurnVersion,
    summary, result: { state_transitions: transitions, preview_world_state: preview,
      projection_hash: hashAgentRunValue({ summary, state_transitions: transitions }) } });
}
