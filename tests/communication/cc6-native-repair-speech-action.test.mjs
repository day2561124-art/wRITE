import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationRepairSpeechResolverView,
  characterCommunicationRepairSpeechActionVersion,
  projectCharacterCommunicationRepairSpeechAction,
} from "../../server/src/character-communication-repair-action-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";

const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const question = "你指的是哪裡？";
const clause = () => ({
  schema_version: "cc5-mandarin-clause-request-v1",
  semantic_anchor: question,
  clause: { subject: "你", predicate: "指的是", object: "哪裡", punctuation: "？" },
});

// No speaker identity is inferred from the relationship or from the
// World-side source. Explicit familiar-voice evidence is required.
const syntheticUnderstanding = {
  version: "cc6c-listener-speech-understanding-v1",
  observer: "B",
  audit: { decisions: [{
    speech_candidate_id: "heard_1", source_action_id: "communication_source_1",
    source_speaker: "A", reception_verified: true,
  }] },
};
const syntheticRepair = {
  version: "cc6f-bounded-listener-repair-initiation-v1",
  observer: "B",
  character_view: { repair_request_candidates: [{
    schema_version: "cc6f-bounded-listener-repair-initiation-v1",
    repair_initiation_id: "repair_1", observer: "B",
    listener_authored_request_meaning: question,
    signal_realized: false, repair_completed: false,
  }] },
  audit: { decisions: [{
    repair_initiation_id: "repair_1", speech_candidate_id: "heard_1",
    source_action_id: "communication_source_1",
    status: "bounded_repair_request_candidate",
  }] },
};
const voice = [{
  observer: "B", source_speaker: "A", perceived_speaker: "A",
  evidence_kind: "familiar_voice", identity_status: "identified",
  active: true,
}];
const baseline = {
  observer: "B",
  repair_initiation_projection: syntheticRepair,
  listener_understanding_projection: syntheticUnderstanding,
};
{
  const noEvidence = buildCharacterCommunicationRepairSpeechResolverView({
    ...baseline, character_state: { relationships: { A: "朋友" } },
  });
  assert.deepEqual(noEvidence.resolver_view.repair_candidates, []);
  assert.equal(noEvidence.engine_context.skipped[0].reason, "no_voice_identity");
  assert.deepEqual(projectCharacterCommunicationRepairSpeechAction({
    assembly: noEvidence, decisions: [],
  }).action_candidates, []);

  const ambiguous = buildCharacterCommunicationRepairSpeechResolverView({
    ...baseline, character_state: {
      communication_voice_identity_evidence: [...voice, ...voice],
    },
  });
  assert.deepEqual(ambiguous.resolver_view.repair_candidates, []);
  assert.equal(ambiguous.engine_context.skipped[0].reason, "ambiguous_voice_identity");

  const recognized = buildCharacterCommunicationRepairSpeechResolverView({
    ...baseline, character_state: { communication_voice_identity_evidence: voice },
  });
  assert.equal(recognized.resolver_view.repair_candidates[0].perceived_speaker, "A");
  assert.equal(JSON.stringify(recognized.resolver_view).includes("communication_source_1"), false);
  assert.equal(Object.hasOwn(recognized.resolver_view.repair_candidates[0], "source_speaker"), false);
  assert.throws(() => projectCharacterCommunicationRepairSpeechAction({
    assembly: recognized, decisions: [{
      repair_initiation_id: "repair_other", surface_realization: clause(),
    }],
  }), /one recognized listener candidate/);
  assert.throws(() => projectCharacterCommunicationRepairSpeechAction({
    assembly: recognized, decisions: [{
      repair_initiation_id: "repair_1",
      surface_realization: { ...clause(), semantic_anchor: "different" },
    }],
  }), /matching authored Mandarin slots/);
  assert.throws(() => projectCharacterCommunicationRepairSpeechAction({
    assembly: recognized, decisions: [{
      repair_initiation_id: "repair_1", surface_realization: clause(),
      source_action_id: "forged",
    }],
  }), /fields are not allowed/);
  assert.throws(() => projectCharacterCommunicationRepairSpeechAction({
    assembly: recognized, decisions: [{
      repair_initiation_id: "repair_1", surface_realization: clause(),
    }, {
      repair_initiation_id: "repair_1", surface_realization: clause(),
    }],
  }), /at most one/);
  const projected = projectCharacterCommunicationRepairSpeechAction({
    assembly: recognized, decisions: [{
      repair_initiation_id: "repair_1", surface_realization: clause(),
    }],
  });
  assert.equal(projected.action_candidates.length, 1);
  assert.equal(projected.action_candidates[0].communication.surface_realization_complete, true);
  assert.equal(projected.action_candidates[0].communication.surface_realization.surface_text, question);
  assert.equal(projected.audit.world_signal_emitted, false);
}
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-repair-speech-action-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6H native repair speech action",
    seed: "cc6-native-repair-speech-action",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-22T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6h-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A informs B while B is present",
        next_events: [{
          event_id: "evt-cc6h-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "B interprets and may ask for repair",
          next_events: [{
            event_id: "evt-cc6h-receive",
            type: "continue_conversation",
            scene_id: "room",
            participants: ["A"],
            summary: "A may hear B\x27s selected repair question",
          }],
        }],
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-22T00:00:00+08:00",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: {
            A: { x: 2, y: 2 },
            B: { x: 3, y: 2 },
          },
          audibility_profiles: {
            A: { minimum_audible_db: 35 },
            B: { minimum_audible_db: 35 },
          },
          observable_by: {
            A: { visual: [], audible: [] },
            B: { visual: [], audible: [] },
          },
        },
      },
      characters: {
        A: {
          known: [statement],
          current_goal: "告知 B",
          relationships: { B: "朋友" },
          speech_acoustics: { sound_level_db_at_1m: 60 },
          communication_goal: {
            character: "A",
            purpose: "告知",
            addressee: "B",
            mode: "direct",
            public_content: statement,
            claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: statement,
              clause: {
                subject: "男孩",
                predicate: "離開",
                aspect_particle: "了",
                object: "房子",
              },
            },
          },
        },
        B: {
          known: [],
          current_goal: "理解並回應 A",
          speech_acoustics: { sound_level_db_at_1m: 60 },
          relationships: { A: "朋友" },
          communication_voice_identity_evidence: [{
            observer: "B",
            source_speaker: "A",
            perceived_speaker: "A",
            evidence_kind: "familiar_voice",
            identity_status: "identified",
            active: true,
          }],
        },
      },
      memories: { A: [], B: [] },
      available_actions: { A: [], B: [] },
    },
  }, options);

  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc6e_test_identity_resolver",
      formal: true,
    }),
  });

  let actualActionId = null;
  const first = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6h-speak",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterBrain: async (packet) => {
        if (packet.character !== "A") return "reject_all";
        const candidate = packet.candidate_action_intents.find(
          (item) => item.communication?.surface_realization_complete === true,
        );
        assert.ok(candidate);
        actualActionId = candidate.action_id;
        return { action_id: candidate.action_id };
      },
    },
  );
  assert.equal(first.ok, true);
  assert.equal(first.committed, true);
  assert.ok(actualActionId);

  let bPacket = null;
  let repairActionId = null;
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6h-hear",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterCommunicationListenerInterpretationResolver: async (view) => {
        assert.equal(view.observer, "B");
        assert.equal(view.speech_candidates.length, 1);
        return [{
          speech_candidate_id: view.speech_candidates[0].speech_candidate_id,
          heard_surface: spoken,
          interpreted_content: "男孩離開了某處",
          interpreted_interaction_function: "informing",
          speech_content_intelligible: true,
          understanding_attested: false,
        }];
      },
      characterCommunicationRepairInitiationResolver: async (view) => [{
        speech_candidate_id: view.speech_candidates[0].speech_candidate_id,
        initiate: true,
        trouble_kind: "reference",
        request_function: "specify_reference",
        listener_authored_request_meaning: question,
      }],
      characterCommunicationRepairSpeechResolver: async (view) => {
        assert.equal(view.observer, "B");
        assert.equal(view.repair_candidates.length, 1);
        const item = view.repair_candidates[0];
        assert.equal(item.listener_authored_request_meaning, question);
        assert.equal(item.perceived_speaker, "A");
        assert.equal(item.perceived_speaker_attribution_subjective, true);
        assert.equal(JSON.stringify(view).includes(actualActionId), false);
        return [{
          repair_initiation_id: item.repair_initiation_id,
          surface_realization: clause(),
        }];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bPacket = structuredClone(packet);
        const actions = packet.candidate_action_intents.filter(
          (action) => action?.communication?.message?.semantic_content === question,
        );
        assert.equal(actions.length, 1);
        const action = actions[0];
        assert.equal(action.communication.channel, "speech");
        assert.equal(action.communication.surface_realization_complete, true);
        assert.equal(action.communication.surface_realization.surface_text, question);
        assert.equal(action.communication.message.world_truth_claimed, false);
        assert.equal(JSON.stringify(action).includes(actualActionId), false);
        assert.equal(Object.hasOwn(action.communication, "repair_initiation_id"), false);
        repairActionId = action.action_id;
        // Unlike CC-6G, B explicitly CHOOSES the ordinary speech action.
        return { action_id: repairActionId };
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(repairActionId);
  assert.ok(bPacket);
  assert.equal(bPacket.perception.communication_repair_request_candidates.length, 1);
  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id, options,
  );
  const secondTurn = history.turns.at(-1);
  const projected = secondTurn.communication_repair_speech_action_projections.find(
    (item) => item.character === "B",
  );
  assert.equal(projected.version, characterCommunicationRepairSpeechActionVersion);
  assert.equal(projected.proposed_count, 1);
  assert.equal(projected.audit.decisions[0].proposed_action_id, repairActionId);
  assert.equal(projected.action_automatically_selected, false);
  assert.equal(projected.world_signal_emitted, false);
  assert.equal(projected.repair_completed, false);
  const emitted = secondTurn.action_outcomes.find((item) =>
    item.actor === "B" && item.result === "communication_emitted");
  assert.ok(emitted, "World must emit only B's actually selected communication.");
  assert.equal(emitted.action_id, repairActionId);
  assert.equal(emitted.communication_event.surface_text, question);
  assert.equal(emitted.communication_acoustic_signal.registered, true);
  assert.equal(emitted.communication_acoustic_signal.source_action_id, repairActionId);
  const soundId = emitted.communication_acoustic_signal.sound_id;
  const afterEmission = await getWorldSimulationState(
    session.world_simulation_session_id, options,
  );
  assert.ok(afterEmission.state.sound_events.some(
    (event) => event.sound_id === soundId));
  assert.equal(JSON.stringify(afterEmission.state.sound_events).includes(question), false);

  let aPacket = null;
  const third = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6h-receive",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterCommunicationListenerInterpretationResolver: async (view) => {
        assert.equal(view.observer, "A");
        assert.equal(view.speech_candidates.length, 1);
        assert.equal(view.speech_candidates[0].emitted_surface_signal, question);
        assert.equal(JSON.stringify(view).includes(repairActionId), false);
        return [];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "A");
        aPacket = structuredClone(packet);
        return "reject_all";
      },
    },
  );
  assert.equal(third.ok, true);
  assert.equal(third.committed, true);
  assert.ok(aPacket);
  assert.equal(aPacket.perception.audible.some(
    (item) => item?.emitted_surface_signal === question), false);
  assert.equal(aPacket.perception.information_boundary.communication_listener_signal_reception_verified, true);
  assert.equal(aPacket.perception.information_boundary.communication_listener_grounding_claimed, false);
  const all = await getWorldSimulationHistory(
    session.world_simulation_session_id, options,
  );
  const heard = all.turns.at(-1).communication_listener_understanding_projections.find(
    (item) => item.character === "A",
  );
  assert.equal(heard.candidate_count, 1);
  assert.equal(heard.decision_count, 0);
  assert.equal(heard.audit.decisions.length, 0);
  assert.equal(heard.grounding_claimed, undefined);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CC-6H native listener repair speech action tests passed.");
