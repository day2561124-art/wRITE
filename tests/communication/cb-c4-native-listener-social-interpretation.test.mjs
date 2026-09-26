import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { characterCommunicationGroundingEvidenceVersion } from "../../server/src/character-communication-grounding-evidence-service.mjs";
import { worldSimulationListenerSocialInterpretationVersion } from "../../server/src/world-simulation-listener-social-interpretation-service.mjs";
import { createWorldSimulationCharacterRuntimeManager, runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory, getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";

const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cb-c4-native-social-interpretation-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CB-C4 native social interpretation",
    seed: "cb-c4-native-social-interpretation",
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
      listenerSocialInterpretationResolver: async (view) => {
        assert.equal(view.observer, "B");
        assert.equal(view.candidates.length, 1);
        const candidate = view.candidates[0];
        assert.equal(candidate.perceived_speaker, "A");
        assert.equal(candidate.interpreted_content, statement);
        assert.equal(candidate.speaker_intent_available, false);
        assert.equal(JSON.stringify(view).includes(actualActionId), false);
        return [{
          evidence_ref: candidate.evidence_ref,
          interpretation_kind: "affiliative",
          social_meaning: "B 覺得 A 正在友善地分享消息",
        }];
      },
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
        const social = packet.perception.social_interpretations;
        assert.equal(social.length, 1);
        assert.equal(social[0].observer, "B");
        assert.equal(social[0].perceived_speaker, "A");
        assert.equal(social[0].interpretation_kind, "affiliative");
        assert.equal(social[0].relationship_updated, false);
        assert.equal(social[0].world_truth_claimed, false);
        assert.equal(packet.perception.audible.some((item) =>
          item?.kind === "listener_subjective_social_interpretation"), false);

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
  assert.equal(boundary.listener_social_interpretation_subjective_only, true);
  assert.equal(boundary.listener_social_interpretation_relationship_updated, false);
  assert.equal(boundary.listener_social_interpretation_world_truth_claimed, false);
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
  const socialProjection = secondTurn.listener_social_interpretation_projections.find(
    (item) => item.character === "B",
  );
  assert.ok(socialProjection);
  assert.equal(socialProjection.version, worldSimulationListenerSocialInterpretationVersion);
  assert.equal(socialProjection.resolver_used, true);
  assert.equal(socialProjection.audit.eligible_evidence_count, 1);
  assert.equal(socialProjection.audit.interpretation_count, 1);
  assert.equal(socialProjection.relationship_write_performed, false);
  assert.equal(socialProjection.world_state_mutation_performed, false);
  const snapshot = await getWorldSimulationState(session.world_simulation_session_id, options);
  assert.equal(snapshot.state.characters.B.relationships.A, "朋友");
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
