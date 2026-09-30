import assert from "node:assert/strict";
import { executeWorldSimulationChronologicalMutationQueue } from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";

function speech(character = "A", modality = "gaze", addressee = "B",
  { vocal_effort, realize_surface = true } = {}) {
  const candidate = buildCharacterCommunicationActionCandidate({
    character, cognition: { known: ["男孩離開房子"], communication_goal: {
      character, addressee, purpose: "告知", mode: "direct",
      public_content: "男孩離開房子", claim_kind: "sincere_assertion",
      ...(vocal_effort ? { vocal_effort } : {}),
      ...(realize_surface ? { surface_realization: { schema_version: "cc5-mandarin-clause-request-v1",
        semantic_anchor: "男孩離開房子",
        clause: { subject: "男孩", predicate: "離開", aspect_particle: "了", object: "房子" } } } : {}),
      communication_context: { intentional_display: {
      modality, target: addressee, intended_meaning: "私人希望對方注意" } } } },
  });
  assert.equal(candidate.communication.embodied_display_request?.modality, modality,
    "fixture must select a real embodied display request");
  return candidate;
}
const motor = (type, angle) => ({ action_id: `motor-${type}-${angle}`,
  intent: type, motor_command: { type,
    ...(type === "orient_head" ? { facing_degrees: angle } : { body_facing_degrees: angle }) } });
const selected = (character, candidate) => ({
  character, selection: "candidate_action_intent", candidate });
function world() {
  return { simulation_time: "2026-09-30T00:00:00.000Z",
    world_rules: { communication_action_seconds: 0.3 },
    event_queue: [{ event_id: "contention", type: "interaction", scene_id: "room",
      participants: ["A", "B", "C"] }],
    scenes: { room: { scene_id: "room", dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: { A: { x: 1, y: 1 }, B: { x: 2, y: 1 }, C: { x: 1, y: 2 } } } },
    characters: Object.fromEntries(["A", "B", "C"].map(name => [name, {
      facing_degrees: 90, body_facing_degrees: 90, physical_state: {},
      speech_acoustics: { sound_level_db_at_1m: 60 } }])), objects: {} };
}
async function run(intents, temporal) {
  const state = world();
  return adjudicateWorldSimulationCausality({
    world_simulation_session_id: "cc8r", turn_id: "contention", world_state: state,
    world_state_hash: hashAgentRunValue(state), world_state_revision: 0,
    event: state.event_queue[0], selected_action_intents: intents,
    ...(temporal ? { native_temporal_response: temporal } : {}),
  });
}
// Legal nonoverlapping commands must form a chronological state chain in either input order.
for (const modality of ["gaze", "body"]) {
  const field = modality === "gaze" ? "facing_degrees" : "body_facing_degrees";
  const type = modality === "gaze" ? "orient_head" : "orient_body";
  const completion = modality === "gaze" ? 250 : 300;
  for (const gap of [0, 100]) {
    const speaking = speech("A", modality);
    const orient = motor(type, 180);
    for (const intents of [
      [selected("A", orient), selected("A", speaking)],
      [selected("A", speaking), selected("A", orient)],
    ]) {
      const start = completion + gap;
      const result = await run(intents, { actor: "A",
        action_id: speaking.action_id, start_time_ms: start });
      const transitions = result.state_transitions.filter(t => t.entity === "A" && t.field === field);
      assert.deepEqual(transitions.map(t => [t.from, t.to, t.time_ms]),
        [[90, 180, completion], [180, 0, start + 300]]);
      assert.equal(result.next_world_state.characters.A[field], 0);
      assert.equal(result.action_outcomes.find(o => o.action_id === speaking.action_id).result,
        "communication_emitted");
      assert.equal(transitions[1].source_action_id, speaking.action_id);
      assert.equal(result.resolution_boundary.final_world_state_written_only_by_chronological_mutation_queue, true);
      const replay = executeWorldSimulationChronologicalMutationQueue({
        world_state: world(), preview_world_state: result.next_world_state,
        queue: result.chronological_mutation_queue, scene_id: "room" });
      assert.deepEqual(replay.next_world_state, result.next_world_state);
    }
  }
}
console.log("CC-8R adjacent orientation chronology tests passed.");
