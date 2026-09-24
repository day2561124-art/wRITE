import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverSpeechIncrementVersion } from "../../server/src/world-simulation-communication-observer-increment-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "../../server/src/world-simulation-observer-prepared-epoch-service.mjs";
import { runWorldSimulationObserverResponseProposal } from "../../server/src/world-simulation-observer-response-proposal-service.mjs";
import {
  scheduleWorldSimulationNativeTemporalResponse,
  buildWorldSimulationNativeTemporalScheduleContract,
} from "../../server/src/world-simulation-native-temporal-schedule-service.mjs";

const pre = { scene_state: { scene_id: "room" }, secret: "WORLD_HIDDEN" };
const sourceIncrementRef = "speech_increment_A1";
const sourceSoundId = "sound-A1";
const sourceStreamId = "speech-stream-A";
const observerSignalRef = `observer_signal_${hashAgentRunValue({
  version: worldSimulationObserverSpeechIncrementVersion,
  observer: "B", sound_id: sourceSoundId,
}).slice(0, 24)}`;
const cueHash = hashAgentRunValue({
  version: worldSimulationObserverSpeechIncrementVersion,
  signal_ref: observerSignalRef, increment_ref: sourceIncrementRef,
}).slice(0, 24);
const cue = {
  observer: "B", signal_ref: observerSignalRef,
  increment_ref: `observer_increment_${cueHash}`,
  signal_phase: "ongoing", perceived_cue_refs: [`audible_cue_${cueHash}`],
  heard_surface_fragment: null, perceived_speaker: null,
  lexical_intelligibility_attested: false, speaker_identity_recognized: false,
  no_future_increment_exposed: true,
};
const ledgerPayload = {
  schema_version: worldSimulationObserverMicrotickLedgerVersion,
  ticks: [{ release_time_ms: 100, observer_cues: [
    { observer: "B", observer_increment: cue },
  ] }],
  tick_count: 1, admitted_cue_count: 1, boundaries: {},
};
const ledger = { ...ledgerPayload, ledger_hash: hashAgentRunValue(ledgerPayload) };
const hash = hashAgentRunValue(pre);
const reconstruction = {
  audit: {
    schema_version: worldSimulationObserverTickPrefixReconstructionVersion,
    status: "engine_private_prefixes_reconstructed",
    readiness_ledger_hash: ledger.ledger_hash,
    source_execution_hash: "verified-world-execution",
    ticks: [{
      release_time_ms: 100, reconstructed_world_state_hash: hash,
      source_pre_turn_world_state_hash: hash, mutation_prefix_ref: "prefix-0",
    }],
  },
  engine_snapshots: [{
    release_time_ms: 100, world_state: pre,
    reconstructed_world_state_hash: hash, mutation_prefix_ref: "prefix-0",
  }],
};
const context = {
  session_id: "session-1", turn_id: "turn-1", world_state_revision: 1,
  pre_turn_world_state: pre, ledger, reconstruction, scene_id: "room", observer: "B",
};
const epoch = prepareWorldSimulationObserverTemporalEpoch(context);
const brain = {
  character: "B",
  cognition: { communication_goal: {
    character: "B", addressee: "A", purpose: "回應正在聽",
    mode: "direct", public_content: "嗯，我在聽。",
  }, private_belief: "B_PRIVATE" },
};
const binding = {
  session_id: epoch.session_id, turn_id: epoch.turn_id,
  world_state_revision: epoch.world_state_revision,
  epoch_id: epoch.epoch_id, source_prefix_hash: epoch.source_prefix_hash,
  character_input_hash: hashAgentRunValue(brain),
};
const choose = async (view) => ({
  epoch_id: view.epoch_id, action_id: view.candidate_action_intents[0].action_id,
});
const proposed = await runWorldSimulationObserverResponseProposal({
  epoch_context: context, presented_epoch: epoch,
  character_input: brain, character_input_binding: binding, selection_resolver: choose,
});
const rawTimeline = { version: "real-world-timeline", entries: [{
  kind: "communication_speech_increment", actor: "A",
  action_id: "communication_source", stream_id: sourceStreamId,
  increment_ref: sourceIncrementRef,
  time_ms: 100, result: "speech_increment_released",
}] };
const timeline = { ...rawTimeline, timeline_hash: hashAgentRunValue(rawTimeline) };
const selected = [{ character: "A", candidate: {
  action_id: "communication_source", communication: { channel: "speech" },
} }];
const admissions = [{
  schema_version: worldSimulationObserverSpeechIncrementVersion,
  observer: "B", release_time_ms: 100,
  admission_status: "heard_acoustic_cues_only", observer_increment: cue,
  audit: {
    source_stream_id: sourceStreamId,
    source_action_id: "communication_source",
    source_sound_id: sourceSoundId, source_speaker: "A",
    registered_sound_link_verified: true,
    static_acoustics_scope_verified: true,
    source_content_forwarded_to_observer: false,
  },
}];
const args = {
  epoch_context: context, presented_epoch: epoch,
  character_input: brain, character_input_binding: binding,
  response_proposal: proposed, chronological_timeline: timeline,
  observer_admissions: admissions,
  selected_action_intents: selected, selection_resolver: choose,
};
const scheduled = await scheduleWorldSimulationNativeTemporalResponse(args);
assert.equal(scheduled.schedule_status, "awaiting_world_causal_recomputation");
assert.equal(scheduled.scheduled_response.earliest_start_time_ms, 100);
assert.equal(scheduled.scheduled_response.emission_status, "not_emitted");
assert.equal(scheduled.scheduled_response.floor_awarded, false);
assert.equal(scheduled.boundaries.causal_recomputation_performed_here, false);
assert.equal(buildWorldSimulationNativeTemporalScheduleContract().world_mutation_performed_here, false);
assert.deepEqual(scheduled.consumed_epoch_ids, [epoch.epoch_id]);
assert.equal(JSON.stringify(scheduled).includes("WORLD_HIDDEN"), false);
assert.equal(JSON.stringify(scheduled).includes("B_PRIVATE"), false);
assert.deepEqual(scheduled, await scheduleWorldSimulationNativeTemporalResponse(args));
const bad = async (overrides, phrase) => assert.rejects(
  () => scheduleWorldSimulationNativeTemporalResponse({ ...args, ...overrides }),
  phrase,
);
await bad({ epoch_context: { ...context, world_state_revision: 2 } }, /current observer epoch/u);
await bad({ response_proposal: { ...proposed, proposal_id: "forged" } }, /recomputed/u);
await bad({ character_input_binding: { ...binding, epoch_id: "stale" } }, /freshly bound/u);
await bad({ consumed_epoch_ids: [epoch.epoch_id] }, /already consumed/u);
await bad({ chronological_timeline: { ...timeline, entries: [] } }, /hashed authoritative/u);
const earlier = { ...rawTimeline, entries: [{ ...rawTimeline.entries[0], time_ms: 10 }] };
await bad({
  chronological_timeline: { ...earlier, timeline_hash: hashAgentRunValue(earlier) },
}, /matching earlier released/u);
await bad({ selected_action_intents: [] }, /actually selected/u);
await bad({ observer_admissions: [] }, /authoritative acoustic admission/u);
await bad({ observer_admissions: [...admissions, admissions[0]] }, /unique exact/u);
await bad({ observer_admissions: [{...admissions[0],audit: {
  ...admissions[0].audit,source_action_id:"forged",
}}] }, /matching earlier released/u);
const wrongSource = {
  ...rawTimeline, entries: [{ ...rawTimeline.entries[0], actor: "B" }],
};
await bad({
  chronological_timeline: { ...wrongSource, timeline_hash: hashAgentRunValue(wrongSource) },
}, /matching earlier released/u);
const reject = async (view) => ({ epoch_id: view.epoch_id, reject_all: true });
const rejected = await runWorldSimulationObserverResponseProposal({
  epoch_context: context, presented_epoch: epoch,
  character_input: brain, character_input_binding: binding,
  selection_resolver: reject,
});
const noResponse = await scheduleWorldSimulationNativeTemporalResponse({
  ...args, response_proposal: rejected, selection_resolver: reject,
});
assert.equal(noResponse.schedule_status, "no_response");
assert.equal(noResponse.scheduled_response, null);
assert.deepEqual(pre, { scene_state: { scene_id: "room" }, secret: "WORLD_HIDDEN" });
console.log("CC-7AD World-owned inert native schedule boundary tests passed.");
