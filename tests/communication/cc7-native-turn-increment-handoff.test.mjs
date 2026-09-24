import {
  buildWorldSimulationTurnIncrementHandoffContract,
  runWorldSimulationTurnIncrementHandoff,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import {
  buildWorldSimulationObserverSpeechIncrementContract,
  projectWorldSimulationObserverSpeechIncrements,
} from "../../server/src/world-simulation-communication-observer-increment-service.mjs";
import {
  projectWorldSimulationCommunicationSpeechStream,
} from "../../server/src/world-simulation-communication-speech-stream-service.mjs";
import {
  createWorldSimulationCharacterRuntimeManager,
  runWorldSimulationTurn,
} from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

const semantic = "男孩已離開房子";
const surface = "男孩離開了房子。";
const actionId = "communication_cc7c_aaaaaaaaaaaaaaaa";
const committed = {
  actor: "A",
  action_id: actionId,
  result: "communication_emitted",
  duration_ms: 250,
  communication_event: {
    schema_version: "cc1-world-communication-event-v1",
    actor: "A",
    channel: "speech",
    surface_text: surface,
    semantic_content: semantic,
    surface_realization_complete: true,
    surface_realization: {
      source_action_id: actionId,
      surface_text: surface,
      semantic_anchor: semantic,
    },
  },
};
const stream = projectWorldSimulationCommunicationSpeechStream({
  outcome: committed, technical_increment_max_chars: 3,
});
const outcome = { ...committed, communication_speech_stream: stream };
const entries = stream.increments.map((item) => ({
  kind: "communication_speech_increment",
  stream_id: stream.stream_id,
  action_id: actionId,
  actor: "A",
  increment_ref: item.increment_ref,
  increment_sequence: item.sequence,
  time_ms: item.end_offset_ms,
  surface_fragment: item.surface_fragment,
  signal_phase: item.signal_phase,
}));
const sound = {
  schema_version: "cc6b-communication-acoustic-bridge-v1",
  sound_id: "current_committed_speech_sound",
  communication_action_id: actionId,
  source_entity_id: "A",
  scene_id: "room",
  sound_level_db_at_1m: 60,
  active: true,
  generic_auditory_label: "unidentified_speech_sound",
  surface_text_exposed: false,
  semantic_content_exposed: false,
};
const scene = {
  scene_id: "room",
  entity_positions: { A: { x: 2, y: 2 }, B: { x: 3, y: 2 }, C: { x: 5, y: 2 } },
  audibility_profiles: {
    B: { minimum_audible_db: 35 },
    C: { minimum_audible_db: 90 },
  },
};
const contract = buildWorldSimulationObserverSpeechIncrementContract();
assert.equal(contract.physical_audibility_is_not_lexical_intelligibility, true);
assert.equal(contract.native_incremental_character_brain_invocation_here, false);
assert.equal(contract.future_increment_exposure_allowed, false);
const project = (observer, ms, overrides = {}) =>
  projectWorldSimulationObserverSpeechIncrements({
    world_state: { characters: {} },
    scene_state: scene,
    scene_id: "room",
    observer,
    committed_outcome: outcome,
    acoustic_signal: sound,
    causal_timeline: { entries },
    released_through_ms: ms,
    static_acoustics_verified: true,
    ...overrides,
  });

const before = project("B", 0);
assert.equal(before.admission_status, "heard_acoustic_cues_only");
assert.equal(before.observer_increments.length, 0);
assert.equal(before.audit.future_increments_withheld_count, stream.increment_count);
const first = project("B", stream.increments[0].end_offset_ms);
assert.equal(first.observer_increments.length, 1);
assert.equal(first.observer_increments[0].signal_phase, "ongoing");
assert.equal(first.observer_increments[0].heard_surface_fragment, null);
assert.equal(first.observer_increments[0].perceived_speaker, null);
assert.equal(first.observer_increments[0].speaker_identity_recognized, false);
assert.equal(first.observer_increments[0].lexical_intelligibility_attested, false);
assert.equal(first.audit.future_increments_withheld_count, stream.increment_count - 1);
assert.equal(JSON.stringify(first.observer_increments).includes(surface), false);
assert.equal(JSON.stringify(first.observer_increments).includes(semantic), false);
assert.equal(JSON.stringify(first.observer_increments).includes(actionId), false);
assert.equal(JSON.stringify(first.observer_increments).includes(sound.sound_id), false);
assert.deepEqual(project("B", 250), project("B", 250));
const full = project("B", 250);
assert.equal(full.observer_increments.length, stream.increment_count);
assert.equal(full.observer_increments.at(-1).signal_phase, "acoustic_segment_ended");
const silent = project("C", 250);
assert.equal(silent.admission_status, "not_audible");
assert.equal(silent.observer_increments.length, 0);
assert.throws(() => project("A", 250), /Speaker may not receive/u);
assert.throws(() => project("B", 250, { static_acoustics_verified: false }), /static-acoustics/u);
assert.throws(() => project("B", -1), /release horizon/u);
assert.throws(() => project("B", 250, {
  acoustic_signal: { ...sound, communication_action_id: "foreign" },
}), /linked committed/u);
assert.throws(() => project("B", 250, {
  causal_timeline: { entries: entries.slice(1) },
}), /authoritative causal timeline/u);

const handoffContract = buildWorldSimulationTurnIncrementHandoffContract();
assert.equal(handoffContract.real_speaker_identity_forwarded, false);
assert.equal(handoffContract.actual_mid_turn_world_action_replanning, false);
assert.equal(handoffContract.one_release_per_observer_resolver_invocation, true);
assert.equal(handoffContract.listener_authored_incremental_meaning_supported, true);
assert.equal(handoffContract.meaning_interpretation_does_not_claim_grounding_or_belief, true);

const admitted = full.observer_increments.map((cue) => ({
  schema_version: "cc7c-observer-speech-increment-acoustic-admission-v1",
  observer: "B",
  admission_status: "heard_acoustic_cues_only",
  release_time_ms: cue.release_time_ms,
  observer_increment: cue,
}));
const seen = [];
const synthetic = await runWorldSimulationTurnIncrementHandoff({
  admissions: [...admitted].reverse(),
  resolver: async (view) => {
    seen.push(structuredClone(view));
    return {
      listener_decision: {
        turn_end_projection: seen.length === 1
          ? "possible_completion" : "continuing",
        projection_basis_refs: [view.perceived_speech_increment.perceived_cue_refs[0]],
        response_preparation: "none",
      },
    };
  },
});
assert.equal(synthetic.projected_count, admitted.length);
assert(seen.every((view, index) =>
  index === 0 || view.release_time_ms > seen[index - 1].release_time_ms));
assert(seen.every((view) => view.anonymous_speaker_ref === seen[0].anonymous_speaker_ref));
assert.notEqual(seen[0].anonymous_speaker_ref, "A");
assert.equal(seen[0].prior_turn_projection, null);
assert.equal(seen[1].prior_turn_projection.projection_id,
  synthetic.projections[0].projection.projection_id);
assert.equal(synthetic.projections[1].projection.lineage.revises_prior_projection, true);
assert.equal(synthetic.projections[0].projection.turn_end_projection.status, "possible_completion");
assert.equal(synthetic.projections[1].projection.turn_end_projection.status, "continuing");
assert(synthetic.projections.every((item) =>
  item.actual_world_action_replanned === false
  && item.projection.boundaries.floor_claimed === false
  && item.projection.boundaries.grounding_claimed === false));
assert.equal((await runWorldSimulationTurnIncrementHandoff({
  admissions: admitted,
})).projected_count, 0);
assert.equal((await runWorldSimulationTurnIncrementHandoff({
  admissions: [{ ...admitted[0], admission_status: "not_audible", observer_increment: null }],
  resolver: async () => { throw Error("inaudible callback invoked"); },
})).projected_count, 0);
await assert.rejects(() => runWorldSimulationTurnIncrementHandoff({
  admissions: [admitted[0], admitted[0]],
  resolver: async () => null,
}), /Duplicate observer increment/u);
await assert.rejects(() => runWorldSimulationTurnIncrementHandoff({
  admissions: [{ ...admitted[0], observer_increment: {
    ...admitted[0].observer_increment, heard_surface_fragment: "future secret",
  } }],
  resolver: async () => null,
}), /nonlexical observer cue/u);
await assert.rejects(() => runWorldSimulationTurnIncrementHandoff({
  admissions: [admitted[0]],
  resolver: async () => ({
    listener_decision: {
      turn_end_projection: "uncertain",
      projection_basis_refs: [],
      response_preparation: "none",
      speaker_hidden_intent: "secret",
    },
  }),
}), /non-contract fields/u);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc7d-native-handoff-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
await rm(fixtureRoot, { recursive: true, force: true });
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "CC-7C native observer acoustic admission",
    seed: "cc7c-native",
    rules: {
      event_driven: true,
      persistent_causality: true,
      communication_action_seconds: 0.25,
      communication_speech_stream_increment_max_chars: 3,
    },
    initial_world_state: {
      simulation_time: "2026-09-23T00:00:00+08:00",
      event_queue: [{
        event_id: "evt-cc7c",
        type: "conversation",
        scene_id: "room",
        participants: ["A", "B", "C"],
        summary: "A speaks while B and C listen",
      }],
      scenes: {
        room: {
          ...scene,
          observable_by: {
            A: { visual: [], audible: [] },
            B: { visual: [], audible: [] },
            C: { visual: [], audible: [] },
          },
        },
      },
      characters: {
        A: {
          known: [semantic],
          current_goal: "告知 B",
          relationships: { B: "朋友" },
          speech_acoustics: { sound_level_db_at_1m: 60 },
          communication_goal: {
            character: "A", purpose: "告知", addressee: "B",
            mode: "direct", public_content: semantic,
            claim_kind: "sincere_assertion",
            surface_realization: {
              schema_version: "cc5-mandarin-clause-request-v1",
              semantic_anchor: semantic,
              clause: {
                subject: "男孩", predicate: "離開",
                aspect_particle: "了", object: "房子",
              },
            },
          },
        },
        B: { known: [], current_goal: "等待", relationships: { A: "朋友" } },
        C: { known: [], current_goal: "等待" },
      },
      memories: { A: [], B: [], C: [] },
      available_actions: { A: [], B: [], C: [] },
    },
  }, options);
  const runtimeManager = createWorldSimulationCharacterRuntimeManager({
    identityResolver: async (character) => ({
      entity_id: `character_${character.toLowerCase()}`,
      canonical_name: character,
      identity_source: "cc7c_test_identity_resolver",
      formal: true,
    }),
  });
  const delivered = [];
  const lexicalDelivered = [];
  const meaningDelivered = [];
  const result = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-cc7c",
  }, {
    ...options,
    characterRuntimeManager: runtimeManager,
    characterCommunicationLexicalIncrementResolver: async (packet) => {
      lexicalDelivered.push(structuredClone(packet));
      assert.equal(packet.observer, "B");
      assert.equal(packet.boundaries.source_identity_available, false);
      assert.equal(packet.boundaries.source_semantics_available, false);
      assert.equal(packet.boundaries.future_fragment_available, false);
      assert(!JSON.stringify(packet).includes(semantic));
      return {
        recognition_status: "recognized",
        heard_surface_fragment: packet.emitted_surface_fragment,
      };
    },
    characterCommunicationIncrementalMeaningResolver: async (packet) => {
      meaningDelivered.push(structuredClone(packet));
      assert.equal(packet.observer, "B");
      assert.equal(packet.boundaries.source_identity_available, false);
      assert.equal(packet.boundaries.source_semantics_available, false);
      assert.equal(packet.boundaries.future_fragment_available, false);
      assert.equal(packet.boundaries.grounding_authority, false);
      assert.equal(packet.boundaries.belief_write_authority, false);
      assert.equal(packet.boundaries.world_action_replanning_available, false);
      assert(!JSON.stringify(packet).includes(semantic));
      if (meaningDelivered.length === 1) {
        assert.equal(packet.heard_surface_prefix, packet.current_heard_surface_fragment);
        assert.equal(packet.heard_surface_prefix.includes(surface), false);
      }
      return {
        interpretation_status: "partial",
        interpreted_content: `目前聽成：${packet.heard_surface_prefix}`,
        interpreted_interaction_function: "ongoing_statement_candidate",
        understanding_attested: false,
      };
    },
    characterCommunicationTurnIncrementResolver: async (view) => {
      delivered.push(structuredClone(view));
      assert.equal(view.observer, "B");
      assert.equal(view.speaker_identity_recognized, false);
      assert.equal(typeof view.perceived_speech_increment.heard_surface_fragment, "string");
      assert.equal(view.lexical_recognition_status, "recognized");
      assert.equal(view.evidence_is_nonlexical_only, false);
      assert.equal(view.meaning_interpretation_status, "partial");
      assert.equal(view.incremental_meaning_interpretation.subjective_only, true);
      assert.equal(view.incremental_meaning_interpretation.grounding_claimed, false);
      assert.equal(view.incremental_meaning_interpretation.belief_updated, false);
      assert.equal(view.perceived_speech_increment.speaker, view.anonymous_speaker_ref);
      assert.notEqual(view.anonymous_speaker_ref, "A");
      assert(!JSON.stringify(view).includes(semantic));
      assert(!JSON.stringify(view).includes('"source_action_id"'));
      assert(!JSON.stringify(view).includes('"source_speaker"'));
      assert(!JSON.stringify(view).includes('"sound_id"'));
      return {
        listener_decision: {
          turn_end_projection: "uncertain",
          projection_basis_refs: [],
          response_preparation: "none",
        },
        participation_decision: delivered.length === 1
          ? {
            mode: "backchannel",
            basis_refs: [view.perceived_speech_increment.perceived_cue_refs[0]],
          }
          : { mode: "wait", basis_refs: [] },
      };
    },
    characterBrain: async (packet) => {
      if (packet.character !== "A") return "reject_all";
      const candidate = packet.candidate_action_intents.find(
        (item) => item.communication?.surface_realization_complete === true,
      );
      assert.ok(candidate);
      return { action_id: candidate.action_id };
    },
  });
  assert.equal(result.committed, true);
  assert(delivered.length > 1, "Native bridge must invoke one observer at each release.");
  assert.equal(lexicalDelivered.length, delivered.length);
  assert.equal(meaningDelivered.length, delivered.length);
  assert.equal(lexicalDelivered.map((item) => item.emitted_surface_fragment).join(""), surface);
  assert.equal(meaningDelivered.at(-1).heard_surface_prefix, surface);
  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id, options);
  const turn = history.turns.at(-1);
  const speechOutcome = turn.action_outcomes.find(
    (item) => item.actor === "A" && item.result === "communication_emitted");
  assert.ok(speechOutcome?.communication_speech_stream);
  const lexicalAudit = turn.observer_lexical_increment;
  assert.equal(lexicalAudit.status, "observer_subjective_lexical_recognition");
  assert.equal(lexicalAudit.recognition_count, lexicalDelivered.length);
  assert.equal(JSON.stringify(lexicalAudit).includes(surface), false);
  assert.equal(JSON.stringify(lexicalAudit).includes(semantic), false);
  assert.equal(JSON.stringify(lexicalAudit).includes('"emitted_surface_fragment"'), false);
  const meaningAudit = turn.observer_meaning_increment;
  assert.equal(meaningAudit.status, "observer_subjective_incremental_meaning");
  assert.equal(meaningAudit.interpretation_count, meaningDelivered.length);
  assert.equal(JSON.stringify(meaningAudit).includes(surface), false);
  assert.equal(JSON.stringify(meaningAudit).includes(semantic), false);
  assert.equal(JSON.stringify(meaningAudit).includes("目前聽成"), false);
  assert.equal(meaningAudit.boundaries.grounding_claimed, false);
  assert.equal(meaningAudit.boundaries.belief_updated, false);
  const handoff = turn.communication_turn_increment_handoff;
  assert.equal(handoff.resolver_used, true);
  assert.equal(handoff.projected_count, delivered.length);
  assert.equal(handoff.boundaries.actual_mid_turn_world_action_replanning, false);
  assert.equal(handoff.projections.length, delivered.length);
  assert(delivered.every((view, index) =>
    view.release_time_ms === handoff.projections[index].release_time_ms));
  assert(delivered.every((view, index) =>
    index === 0 || view.release_time_ms > delivered[index - 1].release_time_ms));
  assert(delivered.every((view) =>
    view.anonymous_speaker_ref === delivered[0].anonymous_speaker_ref));
  assert.equal(delivered[0].prior_turn_projection, null);
  assert.equal(delivered[0].prior_participation_intent, null);
  assert.equal(delivered[1].prior_participation_intent.mode, "backchannel");
  assert.equal(delivered[1].prior_turn_projection.projection_id,
    handoff.projections[0].projection.projection_id);
  assert.equal(handoff.projections[1].projection.lineage.revises_prior_projection, true);
  assert.equal(handoff.projections[0].participation_intent.mode, "backchannel");
  assert(handoff.projections.slice(1).every((item) =>
    item.participation_intent.mode === "wait"));
  const floorLedger = turn.communication_floor_opportunity_ledger;
  assert.equal(floorLedger.status, "opportunity_evidence_only");
  assert.equal(floorLedger.entry_count, delivered.length);
  assert.equal(floorLedger.participation_count, delivered.length);
  assert.equal(floorLedger.active_request_count, 0);
  assert.equal(floorLedger.backchannel_intent_count, 1);
  assert.equal(floorLedger.unresolved_competition_observed, false);
  assert.equal(floorLedger.boundaries.floor_winner_selected, false);
  assert.equal(floorLedger.boundaries.actual_floor_claimed, false);
  assert.equal(floorLedger.boundaries.world_action_replanned, false);
  assert.equal(JSON.stringify(floorLedger).includes(surface), false);
  assert.equal(JSON.stringify(floorLedger).includes(semantic), false);
  assert.equal(JSON.stringify(floorLedger).includes("目前聽成"), false);
  assert.equal(JSON.stringify(floorLedger).includes(actionId), false);
  const readinessAudit = turn.communication_turn_allocation_readiness;
  assert.equal(readinessAudit.status, "subjective_readiness_evidence_only");
  assert.equal(readinessAudit.latest_observer_signal_count, 1);
  assert.equal(readinessAudit.active_request_count, 0);
  assert.equal(readinessAudit.subjective_candidate_count, 0);
  assert.equal(readinessAudit.competition_unresolved, false);
  assert.equal(readinessAudit.entries.length, 1);
  assert.equal(readinessAudit.entries[0].mode, "wait");
  assert.equal(readinessAudit.entries[0].readiness, "not_seeking_floor");
  assert.equal(readinessAudit.entries[0].actual_floor_claimed, false);
  assert.equal(readinessAudit.boundaries.winner_selected, false);
  assert.equal(readinessAudit.boundaries.actual_floor_claimed, false);
  assert.equal(readinessAudit.boundaries.world_action_replanned, false);
  assert.equal(JSON.stringify(readinessAudit).includes(surface), false);
  assert.equal(JSON.stringify(readinessAudit).includes(semantic), false);
  assert.equal(JSON.stringify(readinessAudit).includes("目前聽成"), false);
  assert.equal(JSON.stringify(readinessAudit).includes(actionId), false);
  assert(handoff.projections.every((item) =>
    item.participation_intent.actual_floor_claimed === false
    && item.participation_intent.backchannel_signal_emitted === false
    && item.participation_intent.interruption_judged === false
    && item.participation_intent.world_action_replanned === false));
  assert(handoff.projections.every((item) =>
    typeof item.source_meaning_interpretation_id === "string"
    && item.projection.boundaries.grounding_claimed === false
    && item.projection.boundaries.listener_belief_updated === false
    && item.projection.boundaries.floor_claimed === false
    && item.actual_world_action_replanned === false));
  const receipts = turn.communication_observer_increment_admissions;
  assert.ok(Array.isArray(receipts));
  const b = receipts.filter((item) => item.observer === "B");
  const c = receipts.filter((item) => item.observer === "C");
  assert.equal(b.length, speechOutcome.communication_speech_stream.increment_count);
  assert.equal(c.length, b.length);
  assert(b.every((item) =>
    item.admission_status === "heard_acoustic_cues_only"
    && item.observer_increment?.heard_surface_fragment === null
    && item.observer_increment?.release_time_ms === item.release_time_ms));
  assert(c.every((item) =>
    item.admission_status === "not_audible"
    && item.observer_increment === null));
  assert(b[0].release_time_ms < b.at(-1).release_time_ms);
  for (const item of b) {
    const serialized = JSON.stringify(item.observer_increment);
    assert.equal(serialized.includes(surface), false);
    assert.equal(serialized.includes(semantic), false);
    assert.equal(serialized.includes("turn_end_projection"), false);
    assert.equal(serialized.includes("grounding"), false);
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CC-7D native observer turn increment handoff tests passed.");
