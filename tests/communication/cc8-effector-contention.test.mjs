import assert from "node:assert/strict";
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
    world_simulation_session_id: "cc8q", turn_id: "contention", world_state: state,
    world_state_hash: hashAgentRunValue(state), world_state_revision: 0,
    event: state.event_queue[0], selected_action_intents: intents,
    ...(temporal ? { native_temporal_response: temporal } : {}),
  });
}
for (const modality of ["gaze", "body"]) {
  const speaking = speech("A", modality);
  const orient = motor(modality === "gaze" ? "orient_head" : "orient_body", 180);
  for (const intents of [
    [selected("A", speaking), selected("A", orient)],
    [selected("A", orient), selected("A", speaking)],
  ]) {
    const result = await run(intents);
    const outcomes = result.action_outcomes.filter(o =>
      [speaking.action_id, orient.action_id].includes(o.action_id));
    assert.equal(outcomes.length, 2);
    assert.ok(outcomes.every(o => o.result === "embodied_effector_conflict"),
      "overlapping claims must fail before either effector mutates");
    assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
    assert.equal(result.next_world_state.characters.A.body_facing_degrees, 90);
    assert.equal(result.state_transitions.some(t => t.entity === "A"), false);
    assert.equal(result.action_outcomes.some(o => o.communication_event), false);
    assert.equal((result.next_world_state.sound_events ?? []).length, 0);
  }
}
{
  const speaking = speech();
  const result = await run([selected("A", speaking),
    selected("A", motor("orient_body", 180))]);
  assert.equal(result.action_outcomes.find(o => o.action_id === speaking.action_id).result,
    "communication_emitted");
  assert.equal(result.next_world_state.characters.A.facing_degrees, 0);
  assert.equal(result.next_world_state.characters.A.body_facing_degrees, 180);
}
{
  const first = speech("A", "gaze", "B");
  const second = speech("A", "body", "C"); // Only the vocal effector overlaps.
  const unaffected = speech("B", "gaze", "C");
  const result = await run([selected("A", first), selected("A", second),
    selected("B", unaffected)]);
  assert.equal(result.action_outcomes.find(o => o.action_id === first.action_id).result,
    "embodied_effector_conflict");
  assert.equal(result.action_outcomes.find(o => o.action_id === second.action_id).result,
    "embodied_effector_conflict");
  assert.equal(result.action_outcomes.find(o => o.action_id === unaffected.action_id).result,
    "communication_emitted");
  assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
}
{
  // CC-7AA supplies this start anchor. Adjacent intervals do not contend.
  const speaking = speech();
  const result = await run([selected("A", motor("orient_head", 90)),
    selected("A", speaking)], { actor: "A", action_id: speaking.action_id,
    start_time_ms: 250 });
  assert.equal(result.action_outcomes.find(o => o.action_id === speaking.action_id).result,
    "communication_emitted");
}
// A rejected or physically invalid command cannot suppress a valid action.
for (const angle of [-1, 360, "180", null]) {
  const speaking = speech();
  const invalid = motor("orient_head", angle);
  const result = await run([selected("A", invalid), selected("A", speaking)]);
  assert.equal(result.action_outcomes.find(o => o.action_id === invalid.action_id).result,
    "head_orientation_blocked");
  assert.equal(result.action_outcomes.find(o => o.action_id === speaking.action_id).result,
    "communication_emitted");
}
{
  const speaking = speech();
  const rejected = { ...selected("A", motor("orient_head", 180)), selection: "reject_all" };
  const result = await run([rejected, selected("A", speaking)]);
  assert.equal(result.action_outcomes.find(o => o.action_id === speaking.action_id).result,
    "communication_emitted");
}
{
  const speaking = speech();
  const instantaneous = { ...motor("orient_head", 180), duration_ms: 0 };
  const result = await run([selected("A", instantaneous), selected("A", speaking)]);
  assert.ok(result.action_outcomes.every(o => o.result === "embodied_effector_conflict"));
  assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
}
{
  const valid = speech();
  const invalid = speech("A", "body", "C", { vocal_effort: "projected" });
  for (const intents of [
    [selected("A", invalid), selected("A", valid)],
    [selected("A", valid), selected("A", invalid)],
  ]) {
    const result = await run(intents); // No projected acoustic capacity is configured.
    assert.equal(result.action_outcomes.find(o => o.action_id === invalid.action_id).result,
      "blocked");
    assert.equal(result.action_outcomes.find(o => o.action_id === valid.action_id).result,
      "communication_emitted");
    assert.equal(result.next_world_state.characters.A.body_facing_degrees, 90);
  }
}
{
  const valid = speech();
  const unfinished = speech("A", "body", "C", { realize_surface: false });
  assert.equal(unfinished.communication.surface_realization_complete, false);
  const result = await run([selected("A", unfinished), selected("A", valid)]);
  assert.equal(result.action_outcomes.find(o => o.action_id === valid.action_id).result,
    "communication_emitted");
  assert.equal(result.action_outcomes.find(o => o.action_id === unfinished.action_id)
    .communication_event.surface_realization_complete, false);
}
{
  const speaking = speech();
  const result = await run([selected("A", motor("orient_head", 180)),
    selected("A", speaking)], { actor: "A", action_id: speaking.action_id,
    start_time_ms: 100 });
  assert.ok(result.action_outcomes.every(o => o.result === "embodied_effector_conflict"));
  assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
}
// CC-8Y: scene coordinates cannot substitute for a valid World character.
for (const type of ["orient_head", "orient_body"]) {
  for (const record of [undefined, null, false, 0, "actor", []]) {
    for (const order of ["single", "forward", "reverse"]) {
      const state = world();
      if (record === undefined) delete state.characters.A;
      else state.characters.A = record;
      const actions = [motor(type, 180)];
      if (order !== "single") actions.push(motor(type, 270));
      if (order === "reverse") actions.reverse();
      const unaffected = motor(type, 0);
      const intents = [...actions.map(action => selected("A", action)),
        selected("C", unaffected)];
      const original = hashAgentRunValue({ state, intents });
      const result = await adjudicateWorldSimulationCausality({
        world_simulation_session_id: "cc8y", turn_id: "contention",
        world_state: state, world_state_hash: hashAgentRunValue(state),
        world_state_revision: 0, event: state.event_queue[0],
        selected_action_intents: intents,
      });
      for (const action of actions) {
        assert.equal(result.action_outcomes.find(o => o.actor === "A"
          && o.action_id === action.action_id).result,
          type === "orient_head" ? "head_orientation_blocked" : "body_orientation_blocked");
      }
      assert.equal(result.action_outcomes.find(o => o.actor === "C").result,
        type === "orient_head" ? "head_orientation_completed" : "body_orientation_completed");
      assert.deepEqual(result.next_world_state.characters.A, state.characters.A);
      assert.equal(Object.hasOwn(result.next_world_state.characters, "A"),
        Object.hasOwn(state.characters, "A"));
      assert.equal(result.state_transitions.some(t => t.entity === "A"), false);
      assert.equal((result.next_world_state.sound_events ?? []).length, 0);
      assert.equal(hashAgentRunValue({ state, intents }), original);
    }
  }
}
for (const modality of ["gaze", "body"]) {
  for (const record of [undefined, null, false, 0, "target", []]) {
    for (const reverse of [false, true]) {
      const state = world();
      if (record === undefined) delete state.characters.B;
      else state.characters.B = record;
      const invalid = speech("A", modality, "B");
      const valid = speech("A", modality, "C");
      const actions = reverse ? [valid, invalid] : [invalid, valid];
      const intents = actions.map(action => selected("A", action));
      const original = hashAgentRunValue({ state, intents });
      const result = await adjudicateWorldSimulationCausality({
        world_simulation_session_id: "cc8y", turn_id: "contention",
        world_state: state, world_state_hash: hashAgentRunValue(state),
        world_state_revision: 0, event: state.event_queue[0],
        selected_action_intents: intents,
      });
      const blocked = result.action_outcomes.find(o => o.action_id === invalid.action_id);
      assert.equal(blocked.result, "blocked");
      assert.equal(Object.hasOwn(blocked, "communication_event"), false);
      assert.equal(Object.hasOwn(blocked, "communication_speech_stream"), false);
      assert.equal(result.action_outcomes.find(o => o.action_id === valid.action_id).result,
        "communication_emitted");
      assert.equal(result.next_world_state.characters.A.facing_degrees, 90);
      assert.equal(result.next_world_state.characters.A.body_facing_degrees, 90);
      assert.deepEqual(result.next_world_state.characters.B, state.characters.B);
      assert.equal(Object.hasOwn(result.next_world_state.characters, "B"),
        Object.hasOwn(state.characters, "B"));
      assert.equal(result.next_world_state.sound_events.filter(sound =>
        sound.communication_action_id === invalid.action_id).length, 0);
      assert.equal(result.next_world_state.sound_events.filter(sound =>
        sound.communication_action_id === valid.action_id).length, 1);
      assert.equal(hashAgentRunValue({ state, intents }), original);
    }
  }
}
console.log("CC-8Q/8Y embodied effector contention and character record tests passed.");
