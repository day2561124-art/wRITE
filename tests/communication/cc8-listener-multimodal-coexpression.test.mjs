import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationActionCandidate,
} from "../../server/src/character-communication-foundation-service.mjs";
import {
  buildCharacterCommunicationListenerUnderstandingResolverView,
  characterCommunicationListenerMultimodalCoexpressionVersion,
  characterCommunicationListenerUnderstandingVersion,
} from "../../server/src/character-communication-listener-understanding-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  commitWorldSimulationTurn,
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
import {
  adjudicateWorldSimulationCausality,
} from "../../server/src/world-simulation-causal-rule-engine.mjs";
import {
  queryWorldSimulationObserverAudibility,
} from "../../server/src/world-simulation-audibility-query-service.mjs";
import {
  readCommittedWorldSimulationObserverOrientations,
} from "../../server/src/world-simulation-communication-orientation-observer-service.mjs";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc8o-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };

const spoken = "請先等一下。";
const privateGazeMeaning = "希望 B 注意我";
const privateBodyMeaning = "希望 B 看向 C";

const speechAction = buildCharacterCommunicationActionCandidate({
  character: "A",
  cognition: {
    communication_goal: {
      character: "A",
      purpose: "請 B 稍候",
      addressee: "B",
      mode: "direct",
      public_content: "請先等一下",
      surface_realization: {
        schema_version: "cc5-mandarin-clause-request-v1",
        semantic_anchor: "請先等一下",
        clause: {
          omit_subject: true,
          pre_predicate_modifiers: ["請", "先"],
          predicate: "等",
          post_predicate_complements: ["一下"],
        },
      },
      communication_context: {
        intentional_display: {
          intended_meaning: privateGazeMeaning,
          modality: "gaze",
          target: "B",
        },
      },
    },
  },
});

const bodyAction = buildCharacterCommunicationActionCandidate({
  character: "C",
  cognition: {
    communication_goal: {
      character: "C",
      purpose: "吸引 B 注意",
      addressee: "B",
      mode: "nonverbal",
      nonverbal_signal: "以身體朝向示意",
      communication_context: {
        intentional_display: {
          intended_meaning: privateBodyMeaning,
          modality: "body",
          target: "B",
        },
      },
    },
  },
});

assert.ok(speechAction);
assert.ok(bodyAction);
assert.equal(speechAction.communication.channel, "speech");
assert.equal(speechAction.communication.embodied_display_request.modality, "gaze");
assert.equal(bodyAction.communication.channel, "nonverbal");
assert.equal(bodyAction.communication.embodied_display_request.modality, "body");

const initial = {
  simulation_time: "2026-09-30T00:00:00+08:00",
  world_rules: { communication_action_seconds: 0.25 },
  event_queue: [
    {
      event_id: "coexpress",
      type: "conversation",
      scene_id: "room",
      participants: ["A", "B", "C"],
    },
    {
      event_id: "observe",
      type: "continue_conversation",
      scene_id: "room",
      participants: ["B"],
    },
  ],
  scenes: {
    room: {
      scene_id: "room",
      dimensions: { width_m: 8, depth_m: 8 },
      entity_positions: {
        A: { x: 1, y: 1 },
        B: { x: 1, y: 4 },
        C: { x: 4, y: 4 },
      },
      audibility_profiles: {
        B: { minimum_audible_db: 35 },
      },
      entity_visual_detail_profiles: {
        A: {
          head_orientation_discernible: true,
          head_orientation_max_distance_m: 6,
        },
        C: {
          body_orientation_discernible: true,
          body_orientation_max_distance_m: 6,
        },
      },
      observable_by: {
        A: { visual: [], audible: [] },
        B: { visual: [], audible: [] },
        C: { visual: [], audible: [] },
      },
    },
  },
  characters: {
    A: {
      facing_degrees: 0,
      physical_state: {},
      speech_acoustics: { sound_level_db_at_1m: 60 },
    },
    B: {
      facing_degrees: 270,
      body_facing_degrees: 270,
      physical_state: {},
      current_goal: "理解剛才的訊號",
    },
    C: {
      facing_degrees: 0,
      body_facing_degrees: 0,
      physical_state: {},
    },
  },
  objects: {},
  memories: { A: [], B: [], C: [] },
  available_actions: { A: [], B: [], C: [] },
};

await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-8O listener multimodal coexpression",
    seed: "cc8o",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const id = session.world_simulation_session_id;
  const first = await getWorldSimulationState(id, options);
  const selections = [
    {
      character: "A",
      selection: "candidate_action_intent",
      candidate: speechAction,
    },
    {
      character: "C",
      selection: "candidate_action_intent",
      candidate: bodyAction,
    },
  ];
  const resolved = await adjudicateWorldSimulationCausality({
    world_simulation_session_id: id,
    turn_id: "coexpress",
    world_state: first.state,
    world_state_hash: first.state_hash,
    world_state_revision: first.revision,
    event: first.state.event_queue[0],
    selected_action_intents: selections,
  });
  await commitWorldSimulationTurn(id, {
    expected_revision: first.revision,
    expected_state_hash: first.state_hash,
    turn_id: "coexpress",
    event: first.state.event_queue[0],
    next_world_state: resolved.next_world_state,
    selected_action_intents: selections,
    action_outcomes: resolved.action_outcomes,
    state_transitions: resolved.state_transitions,
  }, options);

  const post = await getWorldSimulationState(id, options);
  const history = await getWorldSimulationHistory(id, options);
  const orientations = await readCommittedWorldSimulationObserverOrientations({
    session_id: id,
    observer: "B",
    scene_id: "room",
    expected_revision: post.revision,
    expected_state_hash: post.state_hash,
  }, options);

  assert.equal(orientations.character_view.length, 2);
  assert.equal(orientations.audit.admitted_source_lineage.length, 2);
  assert.equal(
    orientations.audit.admitted_source_lineage.some(
      (item) => item.source_action_id === speechAction.action_id
        && item.modality === "gaze",
    ),
    true,
  );
  assert.equal(
    orientations.audit.admitted_source_lineage.some(
      (item) => item.source_action_id === bodyAction.action_id
        && item.modality === "body",
    ),
    true,
  );

  const audibility = queryWorldSimulationObserverAudibility({
    world_state: post.state,
    scene_state: post.state.scenes.room,
    scene_id: "room",
    observer: "B",
  });
  const speechOutcome = history.turns[0].action_outcomes.find(
    (item) => item.action_id === speechAction.action_id,
  );
  assert.ok(speechOutcome);
  const soundId = speechOutcome.communication_acoustic_signal.sound_id;
  assert.equal(
    audibility.result.audible_sounds.some((item) => item.sound_id === soundId),
    true,
  );

  const directAssembly =
    buildCharacterCommunicationListenerUnderstandingResolverView({
      observer: "B",
      world_state: post.state,
      scene_state: post.state.scenes.room,
      scene_id: "room",
      audibility_result: audibility.result,
      world_history: history,
      committed_orientation_projection: orientations,
    });
  assert.equal(directAssembly.resolver_view.speech_candidates.length, 1);
  const directCandidate = directAssembly.resolver_view.speech_candidates[0];
  assert.equal(directCandidate.emitted_surface_signal, spoken);
  assert.equal(directCandidate.coexpressed_visual_cues.length, 1);
  assert.equal(directCandidate.coexpressed_visual_cues[0].modality, "gaze");
  assert.equal(
    directCandidate.coexpressed_visual_cues[0].kind,
    "visible_head_orientation_change",
  );
  assert.equal(
    directCandidate.visual_coexpression_relation,
    "same_committed_action",
  );
  assert.equal(directCandidate.visual_coexpression_intent_inferred, false);
  assert.equal(
    directAssembly.resolver_view.boundary.multimodal_coexpression_version,
    characterCommunicationListenerMultimodalCoexpressionVersion,
  );
  assert.equal(
    directAssembly.resolver_view.boundary
      .coexpressed_visual_cues_require_same_committed_action,
    true,
  );

  const directText = JSON.stringify(directAssembly.resolver_view);
  for (const hidden of [
    speechAction.action_id,
    bodyAction.action_id,
    privateGazeMeaning,
    privateBodyMeaning,
    '"source_actor"',
    '"source_action_id"',
    '"actor":"A"',
    '"actor":"C"',
  ]) {
    assert.equal(directText.includes(hidden), false, hidden);
  }

  // Exercise admission boundaries independently of listener interpretation.
  const assembleWith = (projection) =>
    buildCharacterCommunicationListenerUnderstandingResolverView({
      observer: "B",
      world_state: post.state,
      scene_state: post.state.scenes.room,
      scene_id: "room",
      audibility_result: audibility.result,
      world_history: history,
      committed_orientation_projection: projection,
    });
  for (const projection of [
    null,
    { ...structuredClone(orientations),
      audit: { ...structuredClone(orientations.audit), source_turn_id: "other_turn" } },
    { ...structuredClone(orientations),
      audit: {
        ...structuredClone(orientations.audit),
        admitted_source_lineage: orientations.audit.admitted_source_lineage.map(
          (lineage) => ({ ...lineage, source_action_id: "other_action" }),
        ),
      } },
    { ...structuredClone(orientations),
      audit: {
        ...structuredClone(orientations.audit),
        admitted_source_lineage: orientations.audit.admitted_source_lineage.map(
          (lineage) => ({ ...lineage, source_actor: "other_actor" }),
        ),
      } },
  ]) {
    const candidate = assembleWith(projection).resolver_view.speech_candidates[0];
    assert.equal(candidate.emitted_surface_signal, spoken);
    assert.deepEqual(candidate.coexpressed_visual_cues, []);
    assert.equal(candidate.visual_coexpression_relation, null);
  }

  const invalidProjectionCases = [
    (projection) => { projection.observer = "C"; },
    (projection) => { projection.audit.source_state_hash = "stale_state"; },
    (projection) => { projection.audit.admitted_source_lineage.pop(); },
    (projection) => {
      projection.character_view[1].cue_ref = projection.character_view[0].cue_ref;
    },
    (projection) => {
      projection.audit.admitted_source_lineage[1].cue_ref =
        projection.audit.admitted_source_lineage[0].cue_ref;
    },
    (projection) => { projection.character_view[0].communicative_intent_inferred = true; },
    (projection) => { projection.character_view[0].actor_identity_recognized = true; },
    (projection) => { projection.character_view[0].exact_orientation_exposed = true; },
    (projection) => { projection.character_view[0].interpretation = "hidden intent"; },
    (projection) => { projection.character_view[0].world_truth_claimed = true; },
    (projection) => {
      projection.audit.admitted_source_lineage[0].modality = "gesture";
    },
  ];
  for (const mutate of invalidProjectionCases) {
    const projection = structuredClone(orientations);
    mutate(projection);
    assert.throws(
      () => assembleWith(projection),
      { code: "CC8O_LISTENER_MULTIMODAL_COEXPRESSION_INVALID" },
    );
  }

  let resolverView = null;
  let brainPacket = null;
  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc8o_test_identity",
      formal: true,
    }),
  });
  const second = await runWorldSimulationTurn({
    world_simulation_session_id: id,
    event_id: "observe",
  }, {
    ...options,
    characterRuntimeManager: runtimeManager,
    characterCommunicationListenerInterpretationResolver: async (view) => {
      resolverView = structuredClone(view);
      assert.equal(view.observer, "B");
      assert.equal(view.speech_candidates.length, 1);
      const candidate = view.speech_candidates[0];
      assert.equal(candidate.coexpressed_visual_cues.length, 1);
      assert.equal(candidate.coexpressed_visual_cues[0].modality, "gaze");
      assert.equal(
        candidate.visual_coexpression_relation,
        "same_committed_action",
      );
      assert.equal(candidate.visual_coexpression_intent_inferred, false);
      const serialized = JSON.stringify(view);
      assert.equal(serialized.includes(speechAction.action_id), false);
      assert.equal(serialized.includes(bodyAction.action_id), false);
      assert.equal(serialized.includes(privateGazeMeaning), false);
      assert.equal(serialized.includes(privateBodyMeaning), false);
      return [{
        speech_candidate_id: candidate.speech_candidate_id,
        heard_surface: spoken,
        interpreted_content: "對方希望我先稍候",
        interpreted_interaction_function: "request_to_wait",
        speech_content_intelligible: true,
        understanding_attested: true,
      }];
    },
    characterBrain: async (packet) => {
      assert.equal(packet.character, "B");
      brainPacket = structuredClone(packet);
      return "reject_all";
    },
  });
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(resolverView);
  assert.ok(brainPacket);

  const interpretedSpeech = brainPacket.perception.audible.find(
    (item) => item?.schema_version
      === characterCommunicationListenerUnderstandingVersion
      && item?.kind === "subjectively_interpreted_speech",
  );
  assert.ok(interpretedSpeech);
  assert.equal(interpretedSpeech.multimodal_coexpression_context_available, true);
  assert.equal(
    interpretedSpeech.multimodal_coexpression_same_committed_action_verified,
    true,
  );
  assert.equal(
    interpretedSpeech.multimodal_coexpression_semantic_equivalence_verified,
    false,
  );
  assert.equal(interpretedSpeech.multimodal_coexpression_intent_inferred, false);

  const boundary = brainPacket.perception.information_boundary;
  assert.equal(
    boundary.communication_listener_multimodal_coexpression_context_available,
    true,
  );
  assert.equal(
    boundary.communication_listener_multimodal_same_committed_action_only,
    true,
  );
  assert.equal(boundary.communication_listener_multimodal_intent_inferred, false);
  assert.equal(
    boundary.communication_listener_multimodal_semantic_equivalence_verified,
    false,
  );

  const packetText = JSON.stringify(brainPacket);
  assert.equal(packetText.includes(speechAction.action_id), false);
  assert.equal(packetText.includes(bodyAction.action_id), false);
  assert.equal(packetText.includes(privateGazeMeaning), false);
  assert.equal(packetText.includes(privateBodyMeaning), false);

  console.log("CC-8O listener multimodal coexpression tests passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
