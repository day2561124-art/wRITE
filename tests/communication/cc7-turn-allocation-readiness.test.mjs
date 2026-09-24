import assert from "node:assert/strict";
import {
  projectCharacterCommunicationTurnProjection,
} from "../../server/src/character-communication-turn-projection-service.mjs";
import {
  projectCharacterCommunicationTurnParticipationIntent,
} from "../../server/src/character-communication-turn-participation-intent-service.mjs";
import {
  buildWorldSimulationTurnIncrementHandoffContract,
  worldSimulationTurnIncrementHandoffVersion,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import {
  buildWorldSimulationTurnAllocationReadiness,
  buildWorldSimulationTurnAllocationReadinessContract,
} from "../../server/src/world-simulation-communication-turn-allocation-readiness-service.mjs";

const contract = buildWorldSimulationTurnAllocationReadinessContract();
assert.equal(contract.subjective_completion_does_not_award_floor, true);
assert.equal(contract.sole_requester_does_not_auto_win, true);
assert.equal(contract.speaker_selects_next_evidence_not_available_here, true);
assert.equal(contract.backchannel_is_not_floor_request, true);
assert.equal(contract.actual_floor_claimed, false);
assert.equal(contract.fixed_gap_threshold_used, false);
function entry(observer, mode, status, release, priorProjection = null,
  priorParticipation = null, signal = "signal_1") {
  const increment = `${observer}_increment_${release}`;
  const cue = `${observer}_cue_${release}`;
  const ready = mode === "request_floor";
  const plan = `observer_${observer}_response`;
  const projection = projectCharacterCommunicationTurnProjection({
    observer,
    perceived_speech_increment: {
      schema_version: "cc7-observer-speech-increment-v1",
      observer, speaker: "anonymous_voice",
      signal_ref: signal,
      increment_ref: increment,
      heard_surface_fragment: null,
      signal_phase: status === "completed_for_current_joint_activity"
        ? "acoustic_segment_ended" : "ongoing",
      perceived_cue_refs: [cue],
    },
    listener_decision: {
      turn_end_projection: status,
      projection_basis_refs: [cue],
      response_preparation: ready ? "ready" : "none",
      ...(ready ? { response_plan_ref: plan } : {}),
    },
    response_preparation_context: {
      observer, available_response_plan_refs: [plan],
    },
    prior_state: priorProjection,
  });
  const participation = mode === null ? null :
    projectCharacterCommunicationTurnParticipationIntent({
      observer, turn_projection: projection,
      participation_decision: {
        mode, basis_refs:
          ["request_floor", "backchannel"].includes(mode) ? [cue] : [],
        ...(ready ? { response_plan_ref: plan } : {}),
      },
      prior_state: priorParticipation,
    });
  return {
    schema_version: worldSimulationTurnIncrementHandoffVersion,
    observer, release_time_ms: release,
    projection, participation_intent: participation,
    source_meaning_interpretation_id: null,
    subjective_only: true,
    actual_world_action_replanned: false,
  };
}
const handoff = (projections, resolver_used = true) => ({
  schema_version: worldSimulationTurnIncrementHandoffVersion,
  resolver_used, projected_count: projections.length,
  projections, boundaries: buildWorldSimulationTurnIncrementHandoffContract(),
});
const readiness = (projections, resolver_used = true) =>
  buildWorldSimulationTurnAllocationReadiness({
    handoff: handoff(projections, resolver_used),
  });

const b = entry("B", "request_floor", "possible_completion", 100);
const c = entry("C", "request_floor", "continuing", 100);
const a = readiness([b, c]);
assert.deepEqual(a, readiness([b, c]));
assert.equal(a.audit.active_request_count, 2);
assert.equal(a.audit.subjective_candidate_count, 1);
assert.equal(a.audit.awaiting_subjective_completion_count, 1);
assert.equal(a.audit.competition_unresolved, true);
assert.equal(a.audit.multiple_subjective_candidates, false);
assert.equal(a.audit.sole_candidate_is_not_floor_winner, true);
assert.equal(a.engine_private_readiness.floor_winner, null);
assert.equal(a.engine_private_readiness.transition_authoritatively_available, false);
assert.equal(a.engine_private_readiness.speaker_selected_next, null);
assert.equal(a.engine_private_readiness.signal_emitted, false);
assert(a.audit.entries.every((v) =>
  v.actual_floor_claimed === false && v.world_signal_emitted === false));
assert.equal(a.engine_private_readiness.awaiting_observers[0], "C");

const cPossible = entry("C", "request_floor", "possible_completion", 100);
const competition = readiness([b, cPossible]);
assert.equal(competition.audit.subjective_candidate_count, 2);
assert.equal(competition.audit.multiple_subjective_candidates, true);
assert.equal(competition.audit.competition_unresolved, true);
assert.equal(competition.engine_private_readiness.floor_winner, null);

const bLater = entry("B", "withdraw", "continuing", 150,
  b.projection, b.participation_intent);
const cLater = entry("C", "wait", "completed_for_current_joint_activity",
  150, c.projection, c.participation_intent);
const resolved = readiness([b, c, bLater, cLater]);
assert.equal(resolved.audit.active_request_count, 0);
assert.equal(resolved.audit.subjective_candidate_count, 0);
assert.equal(resolved.audit.competition_unresolved, false);
assert.equal(resolved.audit.entries.find((v) =>
  v.mode === "withdraw").readiness, "request_withdrawn");
assert.equal(resolved.engine_private_readiness.floor_winner, null);

const bBackchannel = entry("B", "backchannel", "possible_completion", 100);
const bSilence = entry("B", "remain_silent", "uncertain", 100);
const bNone = entry("B", null, "possible_completion", 100);
for(const item of [bBackchannel, bSilence, bNone]) {
  const result = readiness([item]);
  assert.equal(result.audit.active_request_count, 0);
  assert.equal(result.engine_private_readiness.floor_winner, null);
}
assert.equal(readiness([bBackchannel]).audit.entries[0].readiness,
  "nonfloor_backchannel");
assert.equal(readiness([bNone]).audit.entries[0].readiness,
  "not_seeking_floor");
const solo = readiness([b]);
assert.equal(solo.audit.subjective_candidate_count, 1);
assert.equal(solo.engine_private_readiness.floor_winner, null);
const ended = entry("B", "request_floor",
  "completed_for_current_joint_activity", 100);
assert.equal(readiness([ended]).engine_private_readiness
  .transition_authoritatively_available, false);
const noResolver = readiness([], false);
assert.equal(noResolver.audit.status, "resolver_not_installed");
assert.equal(noResolver.audit.latest_observer_signal_count, 0);

const serialized = JSON.stringify(competition.audit);
for(const forbidden of ["signal_1", "observer_B_response",
  "B_increment", "B_cue", "anonymous_voice"]) {
  assert.equal(serialized.includes(forbidden), false);
}
assert.throws(() => readiness([{...b,
  participation_intent: {...b.participation_intent,
    actual_floor_claimed: true },
}]), /exceeds its authority/u);
assert.throws(() => readiness([{...b,
  projection: {...b.projection, projection_id: "forged"},
}]), /identity/u);
assert.throws(() => readiness([b, bLater, c]),
  /chronological observer release order/u);
assert.throws(() => readiness([b], false), /Uninstalled resolver/u);
assert.throws(() => buildWorldSimulationTurnAllocationReadiness({
  handoff: { ...handoff([b]), projected_count: 0 },
}), /canonical CC-7D/u);

console.log("CC-7N subjective turn allocation readiness tests passed.");
