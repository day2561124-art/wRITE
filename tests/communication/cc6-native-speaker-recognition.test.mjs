import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationSpeakerRecognitionContract,
  characterCommunicationSpeakerRecognitionVersion,
  projectCharacterCommunicationSpeakerRecognition,
} from "../../server/src/character-communication-speaker-recognition-service.mjs";
import {
  planCharacterCommunication,
} from "../../server/src/character-communication-foundation-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
} from "../../server/src/world-simulation-state-service.mjs";

const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";
const sourceAction = "communication_aaaaaaaaaaaaaaaaaaaaaaaa";

function understandingProjection(overrides = {}) {
  return {
    version: "cc6c-listener-speech-understanding-v1",
    observer: "B",
    character_views: [{
      interpreted_content: statement,
      listener_understanding_attested: true,
      speech_content_intelligible: true,
      ...overrides.view,
    }],
    audit: {
      decisions: [{
        speech_candidate_id: "listener_speech_example",
        source_action_id: sourceAction,
        source_speaker: "A",
        reception_verified: true,
        ...overrides.audit,
      }],
    },
  };
}

function identityState(perceivedSpeaker = "A") {
  return {
    communication_voice_identity_evidence: [{
      observer: "B",
      source_speaker: "A",
      perceived_speaker: perceivedSpeaker,
      evidence_kind: "familiar_voice",
      identity_status: "identified",
      active: true,
    }],
  };
}

{
  const contract = buildCharacterCommunicationSpeakerRecognitionContract();
  assert.equal(contract.version, characterCommunicationSpeakerRecognitionVersion);
  assert.equal(contract.explicit_familiar_voice_identification_evidence_required, true);
  assert.equal(contract.relationship_familiarity_is_not_voice_identity_evidence, true);
  assert.equal(contract.source_engine_identity_exposed_to_character, false);
  assert.equal(contract.testimony_content_comes_from_listener_interpretation, true);
  assert.equal(contract.testimony_content_comes_from_speaker_semantic_intent, false);
  assert.equal(contract.voice_identity_learning_performed, false);
  assert.equal(contract.belief_update_performed, false);
  assert.equal(contract.grounding_claimed, false);

  const recognized = projectCharacterCommunicationSpeakerRecognition({
    observer: "B",
    character_state: identityState("A"),
    listener_understanding_projection: understandingProjection(),
  });
  assert.equal(recognized.character_view.listener_receipt_verified, true);
  assert.equal(recognized.character_view.understood_testimony_receipts.length, 1);
  const receipt = recognized.character_view.understood_testimony_receipts[0];
  assert.deepEqual(
    {
      schema_version: receipt.schema_version,
      kind: receipt.kind,
      observer: receipt.observer,
      channel: receipt.channel,
      speaker: receipt.speaker,
      semantic_content: receipt.semantic_content,
      source_action_id: receipt.source_action_id,
      speech_content_intelligible: receipt.speech_content_intelligible,
      speaker_identity_recognized: receipt.speaker_identity_recognized,
      public_event_committed: receipt.public_event_committed,
    },
    {
      schema_version: "cc2-listener-understood-utterance-v1",
      kind: "understood_utterance",
      observer: "B",
      channel: "speech",
      speaker: "A",
      semantic_content: statement,
      source_action_id: sourceAction,
      speech_content_intelligible: true,
      speaker_identity_recognized: true,
      public_event_committed: true,
    },
  );
  assert.equal(receipt.attribution_subjective, true);
  assert.equal(receipt.world_truth_claimed, false);
  assert.equal(receipt.grounding_claimed, false);
  assert.equal(
    Object.hasOwn(receipt, "source_speaker"),
    false,
    "Engine-side source identity must not appear in character-facing receipt.",
  );

  const misattributed = projectCharacterCommunicationSpeakerRecognition({
    observer: "B",
    character_state: identityState("C"),
    listener_understanding_projection: understandingProjection(),
  });
  const mistakenReceipt =
    misattributed.character_view.understood_testimony_receipts[0];
  assert.equal(mistakenReceipt.speaker, "C");
  assert.equal(mistakenReceipt.semantic_content, statement);
  assert.equal(
    misattributed.audit.decisions[0].perceived_speaker_matches_world_source,
    false,
  );
  assert.equal(mistakenReceipt.world_truth_claimed, false);

  const noIdentity = projectCharacterCommunicationSpeakerRecognition({
    observer: "B",
    character_state: { relationships: { A: "很熟的朋友" } },
    listener_understanding_projection: understandingProjection(),
  });
  assert.equal(noIdentity.character_view.listener_receipt_verified, false);
  assert.deepEqual(noIdentity.character_view.understood_testimony_receipts, []);
  assert.equal(noIdentity.audit.decisions[0].status,
    "no_identified_familiar_voice_evidence");

  const merelyRecognized = projectCharacterCommunicationSpeakerRecognition({
    observer: "B",
    character_state: {
      communication_voice_identity_evidence: [{
        observer: "B",
        source_speaker: "A",
        perceived_speaker: "A",
        evidence_kind: "familiar_voice",
        identity_status: "recognized_unidentified",
      }],
    },
    listener_understanding_projection: understandingProjection(),
  });
  assert.equal(merelyRecognized.character_view.listener_receipt_verified, false);

  const notUnderstood = projectCharacterCommunicationSpeakerRecognition({
    observer: "B",
    character_state: identityState("A"),
    listener_understanding_projection: understandingProjection({
      view: {
        listener_understanding_attested: false,
        speech_content_intelligible: false,
      },
    }),
  });
  assert.equal(notUnderstood.character_view.listener_receipt_verified, false);
}

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-speaker-recognition-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6D speaker identification and testimony receipt",
    seed: "cc6-native-speaker-recognition",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-21T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6d-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A speaks while B is present",
        next_events: [{
          event_id: "evt-cc6d-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "B receives prior speech",
        }],
      }],
      scenes: {
        room: {
          scene_id: "room",
          simulation_time: "2026-09-21T00:00:00+08:00",
          dimensions: { width_m: 6, depth_m: 6 },
          entity_positions: {
            A: { x: 2, y: 2 },
            B: { x: 3, y: 2 },
          },
          audibility_profiles: {
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
          current_goal: "理解 A 剛才說的話",
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
      identity_source: "cc6d_test_identity_resolver",
      formal: true,
    }),
  });

  let actualActionId = null;
  const first = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6d-speak",
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
  let consumerPlan = null;
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6d-hear",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterCommunicationListenerInterpretationResolver: async (view) => {
        assert.equal(view.observer, "B");
        assert.equal(view.speech_candidates.length, 1);
        const candidate = view.speech_candidates[0];
        assert.equal(candidate.emitted_surface_signal, spoken);
        return [{
          speech_candidate_id: candidate.speech_candidate_id,
          heard_surface: spoken,
          interpreted_content: statement,
          speech_content_intelligible: true,
          understanding_attested: true,
        }];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bPacket = structuredClone(packet);
        const receipt = packet.perception.audible.find(
          (item) => item?.schema_version === "cc2-listener-understood-utterance-v1",
        );
        assert.ok(receipt, "CC-6D must feed one verified subjective testimony receipt.");
        assert.equal(receipt.observer, "B");
        assert.equal(receipt.speaker, "A");
        assert.equal(receipt.semantic_content, statement);
        assert.equal(receipt.source_action_id, actualActionId);
        assert.equal(receipt.speech_content_intelligible, true);
        assert.equal(receipt.speaker_identity_recognized, true);
        assert.equal(receipt.public_event_committed, true);
        assert.equal(receipt.world_truth_claimed, false);
        assert.equal(receipt.grounding_claimed, false);

        consumerPlan = planCharacterCommunication({
          character: "B",
          cognition: {
            communication_goal: {
              character: "B",
              purpose: "向 D 轉述剛才聽見的內容",
              addressee: "D",
              mode: "direct",
              public_content: statement,
              claim_kind: "attributed_testimony",
              claim_source_kind: "understood_testimony",
              testimony_intent: {
                speaker: "A",
                reported_content: statement,
                source_action_id: actualActionId,
              },
            },
          },
          perception: packet.perception,
        });
        assert.equal(consumerPlan.external_action, "speech");
        assert.equal(consumerPlan.message.speech_act, "report_testimony");
        assert.equal(consumerPlan.message.epistemic_status, "speaker_attributed_report");
        assert.equal(
          consumerPlan.message.claim_provenance.world_truth_claimed,
          false,
        );
        return "reject_all";
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(bPacket);
  assert.ok(consumerPlan);
  assert.equal(
    bPacket.perception.information_boundary.listener_receipt_verified,
    true,
  );
  assert.equal(
    bPacket.perception.information_boundary
      .communication_listener_speaker_identity_recognized,
    true,
  );
  assert.equal(
    bPacket.perception.information_boundary
      .communication_listener_testimony_subjective_only,
    true,
  );
  assert.equal(
    bPacket.perception.information_boundary
      .communication_listener_grounding_claimed,
    false,
  );

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const secondTurn = history.turns.at(-1);
  const projection =
    secondTurn.communication_speaker_recognition_projections.find(
      (item) => item.character === "B",
    );
  assert.ok(projection);
  assert.equal(projection.version, characterCommunicationSpeakerRecognitionVersion);
  assert.equal(projection.receipt_count, 1);
  assert.equal(projection.source_engine_identity_exposed_to_character, false);
  assert.equal(projection.relationship_field_used_as_identity_evidence, false);
  assert.equal(projection.voice_identity_learning_performed, false);
  assert.equal(projection.world_truth_claimed, false);
  assert.equal(projection.grounding_claimed, false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-6D native speaker identification and testimony receipt tests passed.");
