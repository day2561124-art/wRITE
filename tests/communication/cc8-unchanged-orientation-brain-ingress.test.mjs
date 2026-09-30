import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "../../server/src/character-communication-foundation-service.mjs";
import { adjudicateWorldSimulationCausality } from "../../server/src/world-simulation-causal-rule-engine.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { commitWorldSimulationTurn, getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { readCommittedWorldSimulationObserverOrientations, projectWorldSimulationObserverCommittedOrientations } from "../../server/src/world-simulation-communication-orientation-observer-service.mjs";
import { buildCommittedWorldSimulationCharacterBrainInput, buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { prepareFormalWorldSimulationTurn } from "../../server/src/world-simulation-formal-turn-transport-service.mjs";
import { createEphemeralWorldSimulationPreparedTurnBroker } from "../../server/src/world-simulation-prepared-turn-ephemeral-broker.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { characterCommunicationListenerUnderstandingVersion } from "../../server/src/character-communication-listener-understanding-service.mjs";

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

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc8t-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
const spoken = "男孩離開了房子。";

async function scenario(modality, sequential, reversed) {
  const visible = false; // The scene is clear; no orientation change occurred for speech.
  const field = modality === "gaze" ? "facing_degrees" : "body_facing_degrees";
  const type = modality === "gaze" ? "orient_head" : "orient_body";
  const completion = modality === "gaze" ? 250 : 300;
  const cueKind = modality === "gaze"
    ? "visible_head_orientation_change" : "visible_body_orientation_change";
  const initial = world();
  initial.characters.A[field] = sequential ? 90 : 0;
  initial.event_queue.push({ event_id: "observe", type: "interaction",
    scene_id: "room", participants: ["B"] });
  initial.characters.B.facing_degrees = 180;
  initial.characters.B.current_goal = "理解剛才的訊號";
  initial.memories = { A: [], B: [], C: [] };
  initial.available_actions = { A: [], B: [], C: [] };
  const scene = initial.scenes.room;
  scene.audibility_profiles = { B: { minimum_audible_db: 35 } };
  scene.observable_by = Object.fromEntries(["A", "B", "C"].map(actor =>
    [actor, { visual: [], audible: [] }]));
  scene.entity_visual_detail_profiles = { A: {
    head_orientation_discernible: true,
    head_orientation_max_distance_m: 6,
    body_orientation_discernible: true,
    body_orientation_max_distance_m: 6,
  } };
  const speaking = speech("A", modality);
  const orient = motor(type, 0);
  const selections = sequential
    ? [selected("A", orient), selected("A", speaking)] : [selected("A", speaking)];
  if (reversed) selections.reverse();
  const session = await beginWorldSimulationSession({
    simulation_label: `CC-8T ${modality} sequential=${sequential} reverse=${reversed}`,
    seed: "cc8t", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  const event = first.state.event_queue[0];
  const resolved = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: id, turn_id: "chronology",
    world_state: first.state, world_state_hash: first.state_hash,
    world_state_revision: first.revision, event,
    selected_action_intents: selections,
    ...(sequential ? { native_temporal_response: { actor: "A", action_id: speaking.action_id,
      start_time_ms: completion } } : {}),
  });
  const chain = resolved.state_transitions.filter(t => t.entity === "A" && t.field === field);
  assert.deepEqual(chain.map(t => [t.from, t.to, t.time_ms]),
    sequential ? [[90, 0, completion]] : []);
  await commitWorldSimulationTurn(id, {
    expected_revision: first.revision, expected_state_hash: first.state_hash,
    turn_id: "chronology", event, next_world_state: resolved.next_world_state,
    selected_action_intents: selections, action_outcomes: resolved.action_outcomes,
    state_transitions: resolved.state_transitions,
  }, options);
  const post = await getWorldSimulationState(id, options);
  const history = await getWorldSimulationHistory(id, options);
  const committed = history.turns.at(-1);
  assert.deepEqual(committed.state_transitions.filter(t =>
    t.entity === "A" && t.field === field), chain);
  assert.equal(post.state.characters.A[field], 0);
  const receipt = await readCommittedWorldSimulationObserverOrientations({
    session_id: id, observer: "B", scene_id: "room",
    expected_revision: post.revision, expected_state_hash: post.state_hash,
  }, options);
  assert.deepEqual(receipt.character_view.map(cue => cue.kind), visible ? [cueKind] : []);
  assert.deepEqual(receipt.audit.admitted_source_lineage.map(item =>
    [item.source_action_id, item.modality]), visible ? [[speaking.action_id, modality]] : []);
  assert.equal(receipt.audit.admitted_source_lineage.some(item =>
    item.source_action_id === orient.action_id), false);
  await assert.rejects(readCommittedWorldSimulationObserverOrientations({
    session_id: id, observer: "B", scene_id: "room", expected_state_hash: "stale",
  }, options), { code: "CC8L_ORIENTATION_OBSERVER_INVALID" });
  const display = committed.action_outcomes.find(item => item.action_id === speaking.action_id)
    .communication_event.embodied_display;
  assert.equal(display.realized, false, "no orientation change must not claim a realized visual change");
  const tampered = structuredClone(committed);
  tampered.action_outcomes.find(item => item.action_id === speaking.action_id)
    .communication_event.embodied_display.realized = true;
  const rejectForgedChange = () => projectWorldSimulationObserverCommittedOrientations({
    committed_turn: tampered, post_world_state: post.state, observer: "B", scene_id: "room",
  });
  assert.throws(rejectForgedChange, /action-linked committed/,
    "claiming a change without its transition remains invalid");
  tampered.state_transitions.push({ entity: "A", field, from: 0, to: 0,
    source_action_id: speaking.action_id });
  assert.throws(rejectForgedChange, /action-linked committed/,
    "an invented unchanged transition cannot attest a visual change");
  assert.throws(() => buildWorldSimulationCharacterBrainInput({ character: "C" },
    { observer_committed_orientations: receipt }),
  { code: "CC8N_ORIENTATION_BRAIN_INGRESS_INVALID" });

  const decisionPacket = { character: "B", cognition: { perception: {} },
    candidate_action_intents: [], boundaries: {} };
  const direct = await buildCommittedWorldSimulationCharacterBrainInput({
    session_id: id, decision_packet: decisionPacket,
    expected_revision: post.revision, expected_state_hash: post.state_hash,
  }, options);
  const formal = await prepareFormalWorldSimulationTurn({
    world_simulation_session_id: id,
  }, { ...options, preparedTurnBroker: createEphemeralWorldSimulationPreparedTurnBroker() });
  const formalPacket = formal.current_decision.character_input;
  assert.equal(formalPacket.character, "B");
  assert.deepEqual(formalPacket.observed_gaze_cues, direct.observed_gaze_cues);
  assert.deepEqual(formalPacket.observed_body_orientation_cues, direct.observed_body_orientation_cues);
  assert.equal((await getWorldSimulationState(id, options)).state_hash, post.state_hash);

  let resolverView, nativePacket;
  const native = await runWorldSimulationTurn({
    world_simulation_session_id: id, event_id: "observe",
  }, {
    ...options,
    characterRuntimeManager: createWorldSimulationCharacterRuntimeManager({
      identityResolver: async character => ({
        entity_id: `character_${character.toLowerCase()}`, canonical_name: character,
        identity_source: "cc8t_test_identity", formal: true,
      }),
    }),
    characterCommunicationListenerInterpretationResolver: async view => {
      resolverView = structuredClone(view);
      assert.equal(view.observer, "B");
      assert.equal(view.speech_candidates.length, 1);
      const candidate = view.speech_candidates[0];
      assert.equal(candidate.emitted_surface_signal, spoken);
      assert.deepEqual(candidate.coexpressed_visual_cues.map(cue =>
        [cue.kind, cue.modality]), visible ? [[cueKind, modality]] : []);
      assert.equal(candidate.visual_coexpression_relation, visible ? "same_committed_action" : null);
      return [{ speech_candidate_id: candidate.speech_candidate_id,
        heard_surface: spoken, interpreted_content: "有人說男孩離開了房子",
        interpreted_interaction_function: "inform",
        speech_content_intelligible: true, understanding_attested: true }];
    },
    characterBrain: async packet => {
      assert.equal(packet.character, "B");
      assert.equal(nativePacket, undefined, "exactly one observer Brain invocation");
      nativePacket = structuredClone(packet);
      return "reject_all";
    },
  });
  assert.equal(native.committed, true);
  assert.ok(resolverView);
  assert.ok(nativePacket);
  assert.deepEqual(nativePacket.observed_gaze_cues, formalPacket.observed_gaze_cues);
  assert.deepEqual(nativePacket.observed_body_orientation_cues, formalPacket.observed_body_orientation_cues);
  const understood = nativePacket.perception.audible.find(item =>
    item.schema_version === characterCommunicationListenerUnderstandingVersion
      && item.kind === "subjectively_interpreted_speech");
  assert.ok(understood, "speech reaches Brain even when visual detail is unavailable");
  assert.equal(Object.hasOwn(understood, "multimodal_coexpression_context_available"), visible);
  assert.equal(Object.hasOwn(understood, "multimodal_coexpression_intent_inferred"), visible);
  if (visible) {
    assert.equal(understood.multimodal_coexpression_context_available, true);
    assert.equal(understood.multimodal_coexpression_intent_inferred, false);
  }
  for (const packet of [direct, formalPacket, nativePacket, resolverView]) {
    const exposed = JSON.stringify(packet);
    for (const hidden of [speaking.action_id, orient.action_id, "私人希望對方注意",
      '"source_actor"', '"source_action_id"', '"source_state_hash"']) {
      assert.equal(exposed.includes(hidden), false, hidden);
    }
  }
  return { chain: chain.map(t => [t.from, t.to, t.time_ms]),
    finalOrientation: post.state.characters.A[field],
    visualKinds: receipt.character_view.map(cue => cue.kind),
    heard: resolverView.speech_candidates[0].emitted_surface_signal,
    contextAvailable: understood.multimodal_coexpression_context_available === true };
}

try {
  for (const modality of ["gaze", "body"]) {
    const aligned = await scenario(modality, false, false);
    assert.deepEqual(aligned.chain, []);
    assert.deepEqual(aligned.visualKinds, []);
    assert.equal(aligned.contextAvailable, false);
    const forward = await scenario(modality, true, false);
    const reversed = await scenario(modality, true, true);
    assert.deepEqual(reversed, forward, "earlier motor alignment is independent of selection order");
    assert.equal(forward.heard, aligned.heard, "alignment never blocks emitted speech understanding");
    assert.deepEqual(forward.visualKinds, []);
    assert.equal(forward.contextAvailable, false);
  }
  console.log("CC-8T unchanged orientation committed Brain ingress tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
