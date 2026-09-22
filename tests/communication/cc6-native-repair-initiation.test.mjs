import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  characterCommunicationRepairInitiationVersion,
} from "../../server/src/character-communication-repair-initiation-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const statement = "男孩已離開房子";
const spoken = "男孩離開了房子。";

const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  `cc6-native-repair-initiation-${process.pid}-${Date.now()}`,
);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });

try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-6G native repair initiation",
    seed: "cc6-native-repair-initiation",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
    },
    initial_world_state: {
      simulation_time: "2026-09-22T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc6g-speak",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B"],
        summary: "A informs B while B is present",
        next_events: [{
          event_id: "evt-cc6g-hear",
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
      event_id: "evt-cc6g-speak",
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
  let repairResolverCalled = 0;
  const second = await runWorldSimulationTurn(
    {
      world_simulation_session_id: session.world_simulation_session_id,
      event_id: "evt-cc6g-hear",
    },
    {
      ...options,
      characterRuntimeManager: runtimeManager,
      characterCommunicationListenerInterpretationResolver: async (view) => {
        assert.equal(view.observer, "B");
        assert.equal(view.speech_candidates.length, 1);
        const candidate = view.speech_candidates[0];
        assert.equal(candidate.emitted_surface_signal, spoken);
        assert.equal(Object.hasOwn(candidate, "source_action_id"), false);
        assert.equal(Object.hasOwn(candidate, "source_speaker"), false);
        return [{
          speech_candidate_id: candidate.speech_candidate_id,
          heard_surface: spoken,
          interpreted_content: "男孩離開了某處",
          interpreted_interaction_function: "informing",
          speech_content_intelligible: true,
          understanding_attested: false,
        }];
      },
      characterCommunicationRepairInitiationResolver: async (view) => {
        repairResolverCalled += 1;
        assert.equal(view.observer, "B");
        assert.equal(view.speech_candidates.length, 1);
        const candidate = view.speech_candidates[0];
        assert.equal(candidate.emitted_surface_signal, spoken);
        assert.equal(Object.hasOwn(candidate, "source_action_id"), false);
        assert.equal(Object.hasOwn(candidate, "source_speaker"), false);
        assert.equal(Object.hasOwn(candidate, "speaker_intent"), false);
        return [{
          speech_candidate_id: candidate.speech_candidate_id,
          initiate: true,
          trouble_kind: "reference",
          request_function: "specify_reference",
          listener_authored_request_meaning: "你指的是哪裡？",
        }];
      },
      characterBrain: async (packet) => {
        assert.equal(packet.character, "B");
        bPacket = structuredClone(packet);
        const repairCandidates =
          packet.perception.communication_repair_request_candidates;
        assert.equal(repairCandidates.length, 1);
        const repair = repairCandidates[0];
        assert.equal(repair.schema_version, characterCommunicationRepairInitiationVersion);
        assert.equal(repair.observer, "B");
        assert.equal(repair.listener_authored_request_meaning, "你指的是哪裡？");
        assert.equal(repair.signal_realized, false);
        assert.equal(repair.repair_completed, false);
        assert.equal(repair.grounding_claimed, false);
        assert.equal(Object.hasOwn(repair, "source_action_id"), false);
        assert.equal(Object.hasOwn(repair, "source_speaker"), false);
        assert.equal(Object.hasOwn(repair, "speaker_intent"), false);
        assert.equal(packet.perception.audible.some(
          (item) => item?.kind === "listener_authored_repair_request_candidate",
        ), false);
        assert.equal(packet.candidate_action_intents.some(
          (item) => item?.communication?.message?.semantic_content === "你指的是哪裡？",
        ), false);
        return "reject_all";
      },
    },
  );
  assert.equal(second.ok, true);
  assert.equal(second.committed, true);
  assert.equal(repairResolverCalled, 1);
  assert.ok(bPacket);
  const boundary = bPacket.perception.information_boundary;
  assert.equal(boundary.communication_listener_repair_candidate_available, true);
  assert.equal(boundary.communication_listener_repair_candidate_subjective_only, true);
  assert.equal(boundary.communication_listener_repair_world_signal_emitted, false);
  assert.equal(boundary.communication_listener_repair_completed, false);
  assert.equal(boundary.communication_listener_grounding_claimed, false);

  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id,
    options,
  );
  const firstTurn = history.turns.at(-2);
  assert.equal(firstTurn.communication_repair_initiation_projections.every(
    (item) => item.candidate_count === 0,
  ), true);
  const last = history.turns.at(-1);
  const projection = last.communication_repair_initiation_projections.find(
    (item) => item.character === "B",
  );
  assert.ok(projection);
  assert.equal(projection.version, characterCommunicationRepairInitiationVersion);
  assert.equal(projection.candidate_count, 1);
  assert.equal(projection.audit.decisions[0].source_action_id, actualActionId);
  assert.equal(projection.world_signal_emitted, false);
  assert.equal(projection.repair_completed, false);
  assert.equal(projection.grounding_claimed, false);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CC-6G native listener repair candidate adoption tests passed.");
