import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildCharacterCommunicationGroundingEvidenceContract,
  characterCommunicationGroundingEvidenceVersion,
  projectCharacterCommunicationGroundingEvidence,
} from "../../server/src/character-communication-grounding-evidence-service.mjs";
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

function understandingProjection({
  interactionFunction = "informing",
  observer = "B",
} = {}) {
  return {
    version: "cc6c-listener-speech-understanding-v1",
    observer,
    character_views: [{
      interpreted_content: statement,
      interpreted_interaction_function: interactionFunction,
      interaction_function_interpretation_subjective:
        interactionFunction !== null,
      listener_understanding_attested: true,
      speech_content_intelligible: true,
    }],
    audit: {
      decisions: [{
        speech_candidate_id: "listener_speech_example",
        source_action_id: sourceAction,
        source_speaker: "A",
        reception_verified: true,
      }],
    },
  };
}

function recognitionProjection({
  perceivedSpeaker = "A",
  observer = "B",
} = {}) {
  return {
    version: "cc6d-speaker-identification-v1",
    observer,
    character_view: {
      observer,
      understood_testimony_receipts: [{
        schema_version: "cc2-listener-understood-utterance-v1",
        kind: "understood_utterance",
        observer,
        channel: "speech",
        speaker: perceivedSpeaker,
        semantic_content: statement,
        source_action_id: sourceAction,
        speech_content_intelligible: true,
        speaker_identity_recognized: true,
        public_event_committed: true,
        attribution_subjective: true,
        world_truth_claimed: false,
        grounding_claimed: false,
      }],
    },
    audit: {},
  };
}

{
  const contract = buildCharacterCommunicationGroundingEvidenceContract();
  assert.equal(contract.version, characterCommunicationGroundingEvidenceVersion);
  assert.equal(contract.input_requires_cc6c_understanding, true);
  assert.equal(contract.input_requires_cc6d_same_observer_speaker_recognition, true);
  assert.equal(contract.interaction_function_is_listener_subjective, true);
  assert.equal(contract.evidence_is_defeasible, true);
  assert.equal(contract.semantic_equivalence_verified, false);
  assert.equal(contract.mutual_understanding_claimed, false);
  assert.equal(contract.agreement_inferred, false);
  assert.equal(contract.repair_automatically_triggered, false);
  assert.equal(contract.belief_update_performed, false);
  assert.equal(contract.world_truth_claimed, false);
  assert.equal(contract.grounding_claimed, false);

  const projected = projectCharacterCommunicationGroundingEvidence({
    observer: "B",
    listener_understanding_projection: understandingProjection(),
    speaker_recognition_projection: recognitionProjection(),
  });
  assert.equal(projected.audit.evidence_count, 1);
  assert.equal(projected.character_view.grounding_evidence_available, true);
  const evidence = projected.character_view.grounding_evidence[0];
  assert.equal(evidence.kind, "subjective_conversational_grounding_evidence");
  assert.equal(evidence.observer, "B");
  assert.equal(evidence.perceived_speaker, "A");
  assert.equal(evidence.interpreted_content, statement);
  assert.equal(evidence.interpreted_interaction_function, "informing");
  assert.equal(evidence.interpretation_subjective, true);
  assert.equal(evidence.speaker_attribution_subjective, true);
  assert.equal(evidence.semantic_equivalence_verified, false);
  assert.equal(evidence.mutual_understanding_claimed, false);
  assert.equal(evidence.agreement_inferred, false);
  assert.equal(evidence.belief_updated, false);
  assert.equal(evidence.world_truth_claimed, false);
  assert.equal(evidence.grounding_claimed, false);
  assert.equal(Object.hasOwn(evidence, "source_action_id"), false);
  assert.equal(Object.hasOwn(evidence, "source_speaker"), false);
  assert.equal(Object.hasOwn(evidence, "speaker_intent"), false);

  const noInteractionFunction =
    projectCharacterCommunicationGroundingEvidence({
      observer: "B",
      listener_understanding_projection:
        understandingProjection({ interactionFunction: null }),
      speaker_recognition_projection: recognitionProjection(),
    });
  assert.equal(noInteractionFunction.audit.evidence_count, 0);
  assert.equal(
    noInteractionFunction.audit.decisions[0].status,
    "insufficient_listener_grounding_evidence",
  );

  const misattributed = projectCharacterCommunicationGroundingEvidence({
    observer: "B",
    listener_understanding_projection: understandingProjection(),
    speaker_recognition_projection:
      recognitionProjection({ perceivedSpeaker: "C" }),
  });
  assert.equal(misattributed.audit.evidence_count, 1);
  assert.equal(
    misattributed.character_view.grounding_evidence[0].perceived_speaker,
    "C",
  );
  assert.equal(
    misattributed.character_view.grounding_evidence[0].world_truth_claimed,
    false,
  );

  assert.throws(
    () => projectCharacterCommunicationGroundingEvidence({
      observer: "B",
      listener_understanding_projection: understandingProjection(),
      speaker_recognition_projection:
        recognitionProjection({ observer: "C" }),
    }),
    /same-observer CC-6D recognition/,
  );
}

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-grounding-evidence-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6E bounded conversational grounding evidence",
    seed: "cc6-native-grounding-evidence",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-22T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6e-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A informs B while B is present",
        next_events: [{
          event_id: "evt-cc6e-hear",
          type: "continue_conversation",
          scene_id: "room",
          participants: ["B"],
          summary: "B interprets the prior contribution",
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
      event_id: "evt-cc6e-speak",
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
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6e-hear",
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
          interpreted_interaction_function: "informing",
          speech_content_intelligible: true,
          understanding_attested: true,
        }];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bPacket = structuredClone(packet);

        const groundingEvidence = packet.perception.audible.find(
          (item) =>
            item?.schema_version === characterCommunicationGroundingEvidenceVersion
            && item?.kind === "subjective_conversational_grounding_evidence",
        );
        assert.ok(
          groundingEvidence,
          "CC-6E must expose same-listener bounded grounding evidence.",
        );
        assert.equal(groundingEvidence.observer, "B");
        assert.equal(groundingEvidence.perceived_speaker, "A");
        assert.equal(groundingEvidence.interpreted_content, statement);
        assert.equal(
          groundingEvidence.interpreted_interaction_function,
          "informing",
        );
        assert.equal(groundingEvidence.semantic_equivalence_verified, false);
        assert.equal(groundingEvidence.mutual_understanding_claimed, false);
        assert.equal(groundingEvidence.agreement_inferred, false);
        assert.equal(groundingEvidence.belief_updated, false);
        assert.equal(groundingEvidence.world_truth_claimed, false);
        assert.equal(groundingEvidence.grounding_claimed, false);
        assert.equal(Object.hasOwn(groundingEvidence, "source_action_id"), false);
        assert.equal(Object.hasOwn(groundingEvidence, "source_speaker"), false);

        return "reject_all";
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.ok(bPacket);

  const boundary = bPacket.perception.information_boundary;
  assert.equal(boundary.communication_listener_grounding_evidence_available, true);
  assert.equal(
    boundary.communication_listener_grounding_evidence_subjective_only,
    true,
  );
  assert.equal(
    boundary.communication_listener_semantic_equivalence_verified,
    false,
  );
  assert.equal(
    boundary.communication_listener_mutual_understanding_claimed,
    false,
  );
  assert.equal(boundary.communication_listener_agreement_inferred, false);
  assert.equal(boundary.communication_listener_belief_updated, false);
  assert.equal(boundary.communication_listener_world_truth_claimed, false);
  assert.equal(boundary.communication_listener_grounding_claimed, false);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const secondTurn = history.turns.at(-1);
  const projection =
    secondTurn.communication_grounding_evidence_projections.find(
      (item) => item.character === "B",
    );
  assert.ok(projection);
  assert.equal(projection.version, characterCommunicationGroundingEvidenceVersion);
  assert.equal(projection.evidence_count, 1);
  assert.equal(projection.speaker_hidden_intent_exposed, false);
  assert.equal(projection.semantic_equivalence_verified, false);
  assert.equal(projection.mutual_understanding_claimed, false);
  assert.equal(projection.agreement_inferred, false);
  assert.equal(projection.repair_automatically_triggered, false);
  assert.equal(projection.belief_update_performed, false);
  assert.equal(projection.world_truth_claimed, false);
  assert.equal(projection.grounding_claimed, false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

console.log("CC-6E bounded conversational grounding evidence tests passed.");
