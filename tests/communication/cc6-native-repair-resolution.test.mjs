import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationRepairResponseResolverView,
  characterCommunicationRepairResponseVersion,
  projectCharacterCommunicationRepairResponseAction,
} from "../../server/src/character-communication-repair-response-service.mjs";
import {
  buildCharacterCommunicationRepairResolutionResolverView,
  characterCommunicationRepairResolutionVersion,
  projectCharacterCommunicationRepairResolution,
} from "../../server/src/character-communication-repair-resolution-service.mjs";
import {
  characterCommunicationRepairSpeechActionVersion,
} from "../../server/src/character-communication-repair-action-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory, getWorldSimulationState,
} from "../../server/src/world-simulation-state-service.mjs";
const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const question = "你指的是哪裡？";
const answer = "我指的是房子。";
const clause = () => ({
  schema_version: "cc5-mandarin-clause-request-v1",
  semantic_anchor: question,
  clause: { subject: "你", predicate: "指的是", object: "哪裡", punctuation: "？" },
});
const answerClause = () => ({
  schema_version: "cc5-mandarin-clause-request-v1",
  semantic_anchor: answer,
  clause: { subject: "我", predicate: "指的是", object: "房子" },
});
const original = "communication_original_01";
const repair = "communication_repair_01";
const historyFixture = { turns: [{
  turn_id: "origin",
  action_outcomes: [{
    action_id: original, actor: "A", result: "communication_emitted",
    communication_event: { channel: "speech", surface_realization_complete: true },
  }],
}, {
  turn_id: "request",
  communication_repair_speech_action_projections: [{
    version: "cc6h-listener-repair-speech-action-v1", character: "B",
    audit: { decisions: [{ proposed_action_id: repair, source_action_id: original }] },
  }],
  action_outcomes: [{
    action_id: repair, actor: "B", result: "communication_emitted",
    communication_event: { channel: "speech", surface_realization_complete: true },
  }],
}] };
const understandingFixture = {
  version: "cc6c-listener-speech-understanding-v1", observer: "A",
  character_views: [{
    observer: "A", interpreted_content: question, listener_understanding_attested: true,
    speech_content_intelligible: true,
  }],
  audit: { decisions: [{
    speech_candidate_id: "heard_repair", source_action_id: repair,
    source_speaker: "B", source_turn_id: "request", reception_verified: true,
  }] },
};
const voice = [{
  observer: "A", source_speaker: "B", perceived_speaker: "B",
  evidence_kind: "familiar_voice", identity_status: "identified", active: true,
}];
const base = {
  observer: "A", listener_understanding_projection: understandingFixture,
  character_state: { communication_voice_identity_evidence: voice },
  world_history: historyFixture,
};
{
  const assembly = buildCharacterCommunicationRepairResponseResolverView(base);
  assert.equal(assembly.resolver_view.response_candidates.length, 1);
  assert.equal(assembly.resolver_view.response_candidates[0].perceived_requester, "B");
  assert.equal(JSON.stringify(assembly.resolver_view).includes(original), false);
  assert.equal(JSON.stringify(assembly.resolver_view).includes(repair), false);
  const decision = {
    repair_response_candidate_id: assembly.resolver_view.response_candidates[0].repair_response_candidate_id,
    speaker_authored_response_meaning: answer,
    surface_realization: answerClause(),
  };
  const projected = projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [decision],
  });
  assert.equal(projected.action_candidates.length, 1);
  assert.equal(projected.action_candidates[0].communication.surface_realization.surface_text, answer);
  assert.equal(projected.audit.decisions[0].original_action_id, original);
  assert.equal(projected.audit.decisions[0].repair_action_id, repair);
  assert.equal(projected.audit.repair_completed, false);
  assert.deepEqual(projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [],
  }).action_candidates, []);
  assert.throws(() => projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [{ ...decision, source_action_id: original }],
  }), /hidden response decision fields/);
  assert.throws(() => projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [{ ...decision, repair_response_candidate_id: "unknown" }],
  }), /one admitted original-speaker request/);
  assert.throws(() => projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [{ ...decision, surface_realization: {
      ...answerClause(), semantic_anchor: question,
    } }],
  }), /matching CC-5 slots/);
  assert.throws(() => projectCharacterCommunicationRepairResponseAction({
    assembly, decisions: [decision, decision],
  }), /at most one/);
  const noVoice = buildCharacterCommunicationRepairResponseResolverView({
    ...base, character_state: { relationships: { B: "朋友" } },
  });
  assert.equal(noVoice.resolver_view.response_candidates.length, 0);
  const ambiguous = buildCharacterCommunicationRepairResponseResolverView({
    ...base, character_state: { communication_voice_identity_evidence: [...voice, ...voice] },
  });
  assert.equal(ambiguous.resolver_view.response_candidates.length, 0);
  const noUnderstanding = buildCharacterCommunicationRepairResponseResolverView({
    ...base, listener_understanding_projection: {
      ...understandingFixture, character_views: [{
        ...understandingFixture.character_views[0],
        listener_understanding_attested: false,
      }],
    },
  });
  assert.equal(noUnderstanding.resolver_view.response_candidates.length, 0);
  const notOriginalSpeaker = buildCharacterCommunicationRepairResponseResolverView({
    ...base, observer: "C",
    listener_understanding_projection: {
      ...understandingFixture, observer: "C",
      character_views: [{ ...understandingFixture.character_views[0], observer: "C" }],
    },
    character_state: { communication_voice_identity_evidence: [
      { ...voice, observer: "C" },
    ] },
  });
  assert.equal(notOriginalSpeaker.resolver_view.response_candidates.length, 0);
  assert.equal(buildCharacterCommunicationRepairResponseResolverView({
    ...base, world_history: { turns: [historyFixture.turns[0]] },
  }).resolver_view.response_candidates.length, 0);
  assert.equal(buildCharacterCommunicationRepairResponseResolverView({
    ...base, world_history: { turns: [
      historyFixture.turns[0], { ...historyFixture.turns[1], action_outcomes: [] },
    ] },
  }).resolver_view.response_candidates.length, 0);
}
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-repair-resolution-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6J listener repair resolution evidence",
    seed: "cc6-native-repair-resolution",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-22T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6j-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A informs B while B is present",
        next_events: [{
          event_id: "evt-cc6j-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "B interprets and may ask for repair",
          next_events: [{
            event_id: "evt-cc6j-receive",
            type: "continue_conversation",
            scene_id: "room",
            participants: ["A"],
            summary: "A may hear B\x27s selected repair question",
            next_events: [{
              event_id: "evt-cc6j-response-heard",
              type: "continue_conversation",
              scene_id: "room",
              participants: ["B"],
              summary: "B may hear A\x27s response",
            }],
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
          communication_voice_identity_evidence: [{
            observer: "A", source_speaker: "B", perceived_speaker: "B",
            evidence_kind: "familiar_voice", identity_status: "identified", active: true,
          }],
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
      event_id: "evt-cc6j-speak",
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
      event_id: "evt-cc6j-hear",
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
  let responseActionId = null;
  const third = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-cc6j-receive",
  }, {
    ...options,
    characterRuntimeManager: runtimeManager,
    characterCommunicationListenerInterpretationResolver: async (view) => {
      assert.equal(view.observer, "A");
      assert.equal(view.speech_candidates.length, 1);
      assert.equal(view.speech_candidates[0].emitted_surface_signal, question);
      return [{
        speech_candidate_id: view.speech_candidates[0].speech_candidate_id,
        heard_surface: question,
        interpreted_content: question,
        interpreted_interaction_function: "request_for_clarification",
        speech_content_intelligible: true,
        understanding_attested: true,
      }];
    },
    characterCommunicationRepairResponseResolver: async (view) => {
      assert.equal(view.observer, "A");
      assert.equal(view.response_candidates.length, 1);
      assert.equal(view.response_candidates[0].perceived_requester, "B");
      assert.equal(view.response_candidates[0].interpreted_repair_request, question);
      assert.equal(JSON.stringify(view).includes(actualActionId), false);
      assert.equal(JSON.stringify(view).includes(repairActionId), false);
      return [{
        repair_response_candidate_id: view.response_candidates[0].repair_response_candidate_id,
        speaker_authored_response_meaning: answer,
        surface_realization: answerClause(),
      }];
    },
    characterBrain: async (packet) => {
      assert.equal(packet.character, "A");
      aPacket = structuredClone(packet);
      assert.equal(packet.perception.communication_repair_response_opportunities.length, 1);
      const candidate = packet.candidate_action_intents.find((item) =>
        item?.communication?.message?.semantic_content === answer);
      assert.ok(candidate);
      assert.equal(candidate.communication.surface_realization_complete, true);
      assert.equal(candidate.communication.surface_realization.surface_text, answer);
      assert.equal(candidate.communication.message.world_truth_claimed, false);
      assert.equal(JSON.stringify(candidate).includes(actualActionId), false);
      assert.equal(JSON.stringify(candidate).includes(repairActionId), false);
      responseActionId = candidate.action_id;
      return { action_id: responseActionId };
    },
  });
  assert.equal(third.ok, true);
  assert.equal(third.committed, true);
  assert.ok(responseActionId);
  assert.ok(aPacket);
  const h3 = await getWorldSimulationHistory(session.world_simulation_session_id, options);
  const turn = h3.turns.at(-1);
  const projection = turn.communication_repair_response_projections.find((item) =>
    item.character === "A");
  assert.equal(projection.version, characterCommunicationRepairResponseVersion);
  assert.equal(projection.opportunity_count, 1);
  assert.equal(projection.proposed_count, 1);
  assert.equal(projection.audit.decisions[0].original_action_id, actualActionId);
  assert.equal(projection.audit.decisions[0].repair_action_id, repairActionId);
  assert.equal(projection.audit.decisions[0].proposed_response_action_id, responseActionId);
  assert.equal(projection.world_signal_emitted, false);
  assert.equal(projection.repair_completed, false);
  assert.equal(projection.grounding_claimed, false);
  const emittedResponse = turn.action_outcomes.find((item) =>
    item.actor === "A" && item.action_id === responseActionId
    && item.result === "communication_emitted");
  assert.ok(emittedResponse);
  assert.equal(emittedResponse.communication_event.surface_text, answer);
  assert.equal(emittedResponse.communication_acoustic_signal.registered, true);
  const after = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(after.state.sound_events.some((item) =>
    item.sound_id === emittedResponse.communication_acoustic_signal.sound_id), true);

  const syntheticCurrentResponseUnderstanding = {
    version: "cc6c-listener-speech-understanding-v1",
    observer: "B",
    character_views: [{
      observer: "B",
      interpreted_content: answer,
      listener_understanding_attested: true,
      speech_content_intelligible: true,
    }],
    audit: { decisions: [{
      speech_candidate_id: "synthetic_response_candidate",
      source_turn_id: turn.turn_id,
      source_action_id: responseActionId,
      source_speaker: "A",
      reception_verified: true,
    }] },
  };
  const resolutionAssembly =
    buildCharacterCommunicationRepairResolutionResolverView({
      observer: "B",
      listener_understanding_projection: syntheticCurrentResponseUnderstanding,
      character_state: {
        communication_voice_identity_evidence: [{
          observer: "B",
          source_speaker: "A",
          perceived_speaker: "A",
          evidence_kind: "familiar_voice",
          identity_status: "identified",
          active: true,
        }],
      },
      world_history: h3,
    });
  assert.equal(resolutionAssembly.resolver_view.resolution_candidates.length, 1);
  const resolutionCandidate =
    resolutionAssembly.resolver_view.resolution_candidates[0];
  assert.equal(resolutionCandidate.perceived_response_speaker, "A");
  assert.equal(resolutionCandidate.interpreted_response, answer);
  assert.equal(resolutionCandidate.prior_repair_request_owned_by_observer, true);
  assert.equal(
    resolutionCandidate.response_from_same_original_speaker_lineage_verified,
    true,
  );
  assert.equal(JSON.stringify(resolutionAssembly.resolver_view).includes(actualActionId), false);
  assert.equal(JSON.stringify(resolutionAssembly.resolver_view).includes(repairActionId), false);
  assert.equal(JSON.stringify(resolutionAssembly.resolver_view).includes(responseActionId), false);
  assert.equal(JSON.stringify(resolutionAssembly.resolver_view).includes("source_action_id"), false);

  const resolvedProjection = projectCharacterCommunicationRepairResolution({
    assembly: resolutionAssembly,
    decisions: [{
      repair_resolution_candidate_id:
        resolutionCandidate.repair_resolution_candidate_id,
      resolution_status: "resolved",
    }],
  });
  assert.equal(resolvedProjection.character_view.repair_resolution_evidence.length, 1);
  assert.equal(
    resolvedProjection.character_view.repair_resolution_evidence[0]
      .repair_resolved_attested,
    true,
  );
  assert.equal(
    resolvedProjection.character_view.repair_resolution_evidence[0]
      .mutual_understanding_claimed,
    false,
  );
  assert.equal(resolvedProjection.audit.resolved_speech_candidate_ids.length, 1);

  const stillTroubleProjection =
    projectCharacterCommunicationRepairResolution({
      assembly: resolutionAssembly,
      decisions: [{
        repair_resolution_candidate_id:
          resolutionCandidate.repair_resolution_candidate_id,
        resolution_status: "still_trouble",
      }],
    });
  assert.equal(
    stillTroubleProjection.character_view.repair_resolution_evidence[0]
      .still_trouble_attested,
    true,
  );
  assert.deepEqual(stillTroubleProjection.audit.resolved_speech_candidate_ids, []);
  assert.equal(
    stillTroubleProjection.audit.still_trouble_does_not_auto_reinitiate_repair,
    true,
  );
  assert.deepEqual(projectCharacterCommunicationRepairResolution({
    assembly: resolutionAssembly,
    decisions: [],
  }).character_view.repair_resolution_evidence, []);
  assert.throws(() => projectCharacterCommunicationRepairResolution({
    assembly: resolutionAssembly,
    decisions: [{
      repair_resolution_candidate_id:
        resolutionCandidate.repair_resolution_candidate_id,
      resolution_status: "resolved",
      original_action_id: actualActionId,
    }],
  }), /foreign or hidden resolution decision fields/);
  assert.throws(() => projectCharacterCommunicationRepairResolution({
    assembly: resolutionAssembly,
    decisions: [{
      repair_resolution_candidate_id: "unknown",
      resolution_status: "resolved",
    }],
  }), /unknown candidate/);
  assert.throws(() => projectCharacterCommunicationRepairResolution({
    assembly: resolutionAssembly,
    decisions: [{
      repair_resolution_candidate_id:
        resolutionCandidate.repair_resolution_candidate_id,
      resolution_status: "maybe",
    }],
  }), /resolved or still_trouble/);

  const noVoiceAssembly =
    buildCharacterCommunicationRepairResolutionResolverView({
      observer: "B",
      listener_understanding_projection: syntheticCurrentResponseUnderstanding,
      character_state: { relationships: { A: "朋友" } },
      world_history: h3,
    });
  assert.equal(noVoiceAssembly.resolver_view.resolution_candidates.length, 0);
  const noAttestationAssembly =
    buildCharacterCommunicationRepairResolutionResolverView({
      observer: "B",
      listener_understanding_projection: {
        ...syntheticCurrentResponseUnderstanding,
        character_views: [{
          ...syntheticCurrentResponseUnderstanding.character_views[0],
          listener_understanding_attested: false,
        }],
      },
      character_state: {
        communication_voice_identity_evidence: [{
          observer: "B",
          source_speaker: "A",
          perceived_speaker: "A",
          evidence_kind: "familiar_voice",
          identity_status: "identified",
          active: true,
        }],
      },
      world_history: h3,
    });
  assert.equal(noAttestationAssembly.resolver_view.resolution_candidates.length, 0);

  let bPacketAfterResponse = null;
  let resolutionResolverCalled = 0;
  let repairReinitiationResolverCalled = 0;
  const fourth = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-cc6j-response-heard",
  }, {
    ...options,
    characterRuntimeManager: runtimeManager,
    characterCommunicationListenerInterpretationResolver: async (view) => {
      assert.equal(view.observer, "B");
      assert.equal(view.speech_candidates.length, 1);
      assert.equal(view.speech_candidates[0].emitted_surface_signal, answer);
      return [{
        speech_candidate_id: view.speech_candidates[0].speech_candidate_id,
        heard_surface: answer,
        interpreted_content: answer,
        interpreted_interaction_function: "repair_response",
        speech_content_intelligible: true,
        understanding_attested: true,
      }];
    },
    characterCommunicationRepairResolutionResolver: async (view) => {
      resolutionResolverCalled += 1;
      assert.equal(view.observer, "B");
      assert.equal(view.resolution_candidates.length, 1);
      const candidate = view.resolution_candidates[0];
      assert.equal(candidate.perceived_response_speaker, "A");
      assert.equal(candidate.interpreted_response, answer);
      assert.equal(JSON.stringify(view).includes(actualActionId), false);
      assert.equal(JSON.stringify(view).includes(repairActionId), false);
      assert.equal(JSON.stringify(view).includes(responseActionId), false);
      return [{
        repair_resolution_candidate_id:
          candidate.repair_resolution_candidate_id,
        resolution_status: "resolved",
      }];
    },
    characterCommunicationRepairInitiationResolver: async () => {
      repairReinitiationResolverCalled += 1;
      throw new Error(
        "CC-6J resolved response must not be re-offered for same-turn repair initiation.",
      );
    },
    characterBrain: async (packet) => {
      assert.equal(packet.character, "B");
      bPacketAfterResponse = structuredClone(packet);
      const evidence =
        packet.perception.communication_repair_resolution_evidence;
      assert.equal(evidence.length, 1);
      assert.equal(evidence[0].resolution_status, "resolved");
      assert.equal(evidence[0].repair_resolved_attested, true);
      assert.equal(evidence[0].mutual_understanding_claimed, false);
      assert.equal(evidence[0].common_ground_updated, false);
      assert.equal(evidence[0].grounding_claimed, false);
      assert.equal(
        (packet.perception.communication_repair_request_candidates ?? []).length,
        0,
      );
      return "reject_all";
    },
  });
  assert.equal(fourth.ok, true);
  assert.equal(fourth.committed, true);
  assert.equal(resolutionResolverCalled, 1);
  assert.equal(repairReinitiationResolverCalled, 0);
  assert.ok(bPacketAfterResponse);
  assert.equal(
    bPacketAfterResponse.perception.information_boundary
      .communication_repair_resolution_subjective_only,
    true,
  );
  assert.equal(
    bPacketAfterResponse.perception.information_boundary
      .communication_repair_resolution_mutual_understanding_claimed,
    false,
  );
  assert.equal(
    bPacketAfterResponse.perception.information_boundary
      .communication_repair_resolution_grounding_claimed,
    false,
  );

  const finalHistory = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const finalTurn = finalHistory.turns.at(-1);
  const resolutionProjection =
    finalTurn.communication_repair_resolution_projections.find(
      (item) => item.character === "B",
    );
  assert.equal(
    resolutionProjection.version,
    characterCommunicationRepairResolutionVersion,
  );
  assert.equal(resolutionProjection.candidate_count, 1);
  assert.equal(resolutionProjection.decision_count, 1);
  assert.equal(resolutionProjection.evidence_count, 1);
  assert.equal(
    resolutionProjection.audit.decisions[0].original_action_id,
    actualActionId,
  );
  assert.equal(
    resolutionProjection.audit.decisions[0].repair_action_id,
    repairActionId,
  );
  assert.equal(
    resolutionProjection.audit.decisions[0].response_action_id,
    responseActionId,
  );
  assert.equal(
    resolutionProjection.audit.decisions[0].resolution_status,
    "resolved",
  );
  assert.equal(resolutionProjection.mutual_understanding_claimed, false);
  assert.equal(resolutionProjection.grounding_claimed, false);
  assert.equal(resolutionProjection.world_truth_claimed, false);
  const reinitiationProjection =
    finalTurn.communication_repair_initiation_projections.find(
      (item) => item.character === "B",
    );
  assert.equal(reinitiationProjection.candidate_count, 0);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CC-6J listener repair resolution evidence tests passed.");
