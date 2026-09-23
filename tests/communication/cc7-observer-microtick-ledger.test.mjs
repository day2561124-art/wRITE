import assert from "node:assert/strict";
import {
  buildWorldSimulationObserverMicrotickLedger,
  readWorldSimulationObserverMicrotickRelease,
  buildWorldSimulationObserverMicrotickLedgerContract,
} from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
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
const ledgerContract = buildWorldSimulationObserverMicrotickLedgerContract();
assert.equal(ledgerContract.mid_turn_world_state_snapshot_available, false);
assert.equal(ledgerContract.runtime_character_brain_invoked_here, false);
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

const engineReceipts = full.observer_increments.map((cue) => ({
  schema_version: contract.version,
  observer: "B",
  release_time_ms: cue.release_time_ms,
  admission_status: "heard_acoustic_cues_only",
  observer_increment: cue,
  audit: full.audit,
}));
const silentReceipts = silent.observer_increments.map((cue) => ({
  schema_version: contract.version,
  observer: "C",
  release_time_ms: cue.release_time_ms,
  admission_status: "not_audible",
  observer_increment: null,
  audit: silent.audit,
}));
const emptyCustomTurn = buildWorldSimulationObserverMicrotickLedger({
  admissions: [],
});
assert.equal(emptyCustomTurn.tick_count, 0);
assert.equal(readWorldSimulationObserverMicrotickRelease({
  ledger: emptyCustomTurn, observer: "B",
}).completed, true);
assert.throws(() => buildWorldSimulationObserverMicrotickLedger({
  admissions: [engineReceipts[0]],
}), /Causal timeline/u);
const ledger = buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries },
  admissions: [...engineReceipts, ...silentReceipts],
});
assert.deepEqual(ledger, buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries },
  admissions: [...engineReceipts, ...silentReceipts],
}));
assert.equal(ledger.tick_count, stream.increment_count);
assert.equal(ledger.admitted_cue_count, stream.increment_count);
assert.equal(JSON.stringify(ledger).includes(semantic), false);
assert.equal(JSON.stringify(ledger).includes(surface), false);
assert.equal(JSON.stringify(ledger).includes(actionId), false);
assert.equal(JSON.stringify(ledger).includes(sound.sound_id), false);
for (let cursor = 0; cursor < ledger.tick_count; cursor += 1) {
  const own = readWorldSimulationObserverMicrotickRelease({
    ledger, observer: "B", cursor,
  });
  const other = readWorldSimulationObserverMicrotickRelease({
    ledger, observer: "C", cursor,
  });
  assert.equal(own.release_time_ms, stream.increments[cursor].end_offset_ms);
  assert.equal(own.perceived_increments.length, 1);
  assert.equal(own.perceived_increments[0].increment_ref, engineReceipts[cursor].observer_increment.increment_ref);
  assert.equal(own.next_cursor, cursor + 1);
  assert.equal(own.no_future_releases_exposed, true);
  assert.deepEqual(other.perceived_increments, []);
}
assert.equal(readWorldSimulationObserverMicrotickRelease({
  ledger, observer: "B", cursor: ledger.tick_count,
}).completed, true);
assert.throws(() => readWorldSimulationObserverMicrotickRelease({
  ledger: { ...ledger, tick_count: 200 }, observer: "B",
}), /ledger/u);
assert.throws(() => readWorldSimulationObserverMicrotickRelease({
  ledger, observer: "B", cursor: ledger.tick_count + 1,
}), /cursor/u);
assert.throws(() => buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries: entries.slice(1) }, admissions: engineReceipts,
}), /authoritative speech release/u);
assert.throws(() => buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries }, admissions: [engineReceipts[0], engineReceipts[0]],
}), /Duplicate observer release/u);
assert.throws(() => buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries }, admissions: [{
    ...engineReceipts[0],
    observer_increment: { ...engineReceipts[0].observer_increment, heard_surface_fragment: surface },
  }],
}), /nonlexical/u);
const simultaneous = buildWorldSimulationObserverMicrotickLedger({
  causal_timeline: { entries },
  admissions: [
    engineReceipts[0],
    { ...engineReceipts[0], observer: "D", observer_increment: {
      ...engineReceipts[0].observer_increment, observer: "D",
      increment_ref: "observer_increment_d_01",
    } },
  ],
});
assert.equal(simultaneous.tick_count, 1);
assert.equal(simultaneous.admitted_cue_count, 2);
assert.equal(readWorldSimulationObserverMicrotickRelease({
  ledger: simultaneous, observer: "B", cursor: 0,
}).perceived_increments.length, 1);
assert.equal(readWorldSimulationObserverMicrotickRelease({
  ledger: simultaneous, observer: "D", cursor: 0,
}).perceived_increments.length, 1);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp",
  `cc7e-observer-microtick-${process.pid}-${Date.now()}`);
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
  const result = await runWorldSimulationTurn({
    world_simulation_session_id: session.world_simulation_session_id,
    event_id: "evt-cc7c",
  }, {
    ...options,
    characterRuntimeManager: runtimeManager,
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
  const history = await getWorldSimulationHistory(
    session.world_simulation_session_id, options);
  const turn = history.turns.at(-1);
  const speechOutcome = turn.action_outcomes.find(
    (item) => item.actor === "A" && item.result === "communication_emitted");
  assert.ok(speechOutcome?.communication_speech_stream);
  const nativeLedger = turn.observer_microtick_release_ledger;
  assert.equal(nativeLedger.schema_version, ledgerContract.version);
  assert.equal(nativeLedger.tick_count,
    speechOutcome.communication_speech_stream.increment_count);
  assert.equal(nativeLedger.admitted_cue_count,
    speechOutcome.communication_speech_stream.increment_count);
  assert.equal(nativeLedger.boundaries.world_mutation_performed, false);
  assert.equal(nativeLedger.boundaries.runtime_character_brain_invoked_here, false);
  assert.equal(readWorldSimulationObserverMicrotickRelease({
    ledger: nativeLedger, observer: "C", cursor: 0,
  }).perceived_increments.length, 0);
  assert.equal(readWorldSimulationObserverMicrotickRelease({
    ledger: nativeLedger, observer: "B", cursor: 0,
  }).perceived_increments.length, 1);
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
console.log("CC-7E observer microtick release ledger tests passed.");
