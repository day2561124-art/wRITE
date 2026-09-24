import assert from "node:assert/strict";
import {
  buildCharacterCommunicationTurnParticipationIntentContract,
  characterCommunicationTurnParticipationIntentVersion,
  projectCharacterCommunicationTurnParticipationIntent,
} from "../../server/src/character-communication-turn-participation-intent-service.mjs";
import {
  projectCharacterCommunicationTurnProjection,
} from "../../server/src/character-communication-turn-projection-service.mjs";
import {
  buildWorldSimulationTurnIncrementHandoffContract,
  runWorldSimulationTurnIncrementHandoff,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";

const observer = "B";
const speaker = "anonymous_voice_example";
const signal = "observer_signal_1";
const perceived = (sequence) => ({
  schema_version: "cc7-observer-speech-increment-v1",
  observer,
  speaker,
  signal_ref: signal,
  increment_ref: `increment_${sequence}`,
  heard_surface_fragment: sequence === 1 ? "等一下" : "我還沒講完",
  signal_phase: sequence === 1 ? "ongoing" : "acoustic_segment_ended",
  perceived_cue_refs: [`cue_${sequence}`],
});
const projection = (sequence, prior_state = null, ready = true) =>
  projectCharacterCommunicationTurnProjection({
    observer,
    perceived_speech_increment: perceived(sequence),
    listener_decision: {
      turn_end_projection:
        sequence === 1 ? "possible_completion" : "continuing",
      projection_basis_refs: [`cue_${sequence}`],
      response_preparation: ready ? "ready" : "none",
      ...(ready ? { response_plan_ref: "response_B" } : {}),
    },
    response_preparation_context: {
      observer,
      available_response_plan_refs: ["response_B"],
    },
    prior_state,
  });

const first = projection(1);
const second = projection(2, first);
const contract = buildCharacterCommunicationTurnParticipationIntentContract();
assert.equal(contract.source, "cc7a_same_observer_projected_turn_only");
assert.equal(contract.backchannel_requires_floor, false);
assert.equal(contract.request_floor_is_actual_floor_claim, false);
assert.equal(contract.prepared_response_does_not_auto_request_floor, true);
assert.equal(contract.acoustic_segment_end_does_not_auto_award_floor, true);
assert.equal(contract.overlap_is_not_interruption, true);
assert.equal(contract.actual_world_signal_emitted, false);
assert.equal(contract.actual_floor_arbitration_performed, false);
assert.equal(contract.fixed_gap_threshold_used, false);

const choose = (turn_projection, participation_decision, prior_state = null) =>
  projectCharacterCommunicationTurnParticipationIntent({
    observer, turn_projection, participation_decision, prior_state,
  });
const request = choose(first, {
  mode: "request_floor",
  basis_refs: ["cue_1"],
  response_plan_ref: "response_B",
});
assert.equal(request.schema_version, characterCommunicationTurnParticipationIntentVersion);
assert.equal(request.mode, "request_floor");
assert.equal(request.requires_external_floor_arbitration, true);
assert.equal(request.actual_floor_claimed, false);
assert.equal(request.backchannel_signal_emitted, false);
assert.equal(request.interruption_judged, false);
assert.equal(request.world_action_replanned, false);
assert.deepEqual(request, choose(first, {
  mode: "request_floor", basis_refs: ["cue_1"], response_plan_ref: "response_B",
}));

const withdraw = choose(second, {
  mode: "withdraw", basis_refs: [],
}, request);
assert.equal(withdraw.prior_intention_id, request.intention_id);
assert.equal(withdraw.revises_prior_intention, true);
assert.equal(withdraw.response_plan_ref, null);
assert.equal(withdraw.requires_external_floor_arbitration, false);
assert.notEqual(request.intention_id, withdraw.intention_id);

const backchannel = choose(first, {
  mode: "backchannel", basis_refs: ["cue_1"],
});
assert.equal(backchannel.requires_external_floor_arbitration, false);
assert.equal(backchannel.actual_floor_claimed, false);
assert.equal(backchannel.backchannel_signal_emitted, false);
const wait = choose(first, { mode: "wait", basis_refs: [] });
const silent = choose(first, { mode: "remain_silent", basis_refs: [] });
assert.equal(wait.mode, "wait");
assert.equal(silent.mode, "remain_silent");
assert.equal(wait.actual_floor_claimed, false);
assert.equal(silent.backchannel_signal_emitted, false);

const endedReady = projectCharacterCommunicationTurnProjection({
  observer,
  perceived_speech_increment: {
    ...perceived(2), signal_ref: "ended_signal",
  },
  listener_decision: {
    turn_end_projection: "completed_for_current_joint_activity",
    projection_basis_refs: ["cue_2"],
    response_preparation: "ready",
    response_plan_ref: "response_B",
  },
  response_preparation_context: {
    observer, available_response_plan_refs: ["response_B"],
  },
});
assert.equal(choose(endedReady, { mode: "wait", basis_refs: [] })
  .actual_floor_claimed, false);

const throws = (projectionValue, decision, previous, pattern) =>
  assert.throws(() => choose(projectionValue, decision, previous), pattern);
throws(first, {
  mode: "request_floor", basis_refs: ["cue_1"], response_plan_ref: "foreign",
}, null, /ready response plan/u);
throws(projection(1, null, false), {
  mode: "request_floor", basis_refs: ["cue_1"], response_plan_ref: "response_B",
}, null, /ready response plan/u);
throws(first, {
  mode: "request_floor", basis_refs: ["future_cue"], response_plan_ref: "response_B",
}, null, /current observer increment/u);
throws(first, {
  mode: "backchannel", basis_refs: [],
}, null, /requires perceived evidence/u);
throws(first, {
  mode: "backchannel", basis_refs: ["cue_1"], response_plan_ref: "response_B",
}, null, /Only a floor request/u);
throws(first, {
  mode: "withdraw", basis_refs: [],
}, null, /prior same-signal floor request/u);
throws(second, {
  mode: "withdraw", basis_refs: [],
}, backchannel, /prior same-signal floor request/u);
throws(second, {
  mode: "withdraw", basis_refs: [],
}, { ...request, observer: "C" }, /this observer's immediate projection lineage/u);
throws(second, {
  mode: "withdraw", basis_refs: [],
}, { ...request, source_signal_ref: "other_signal" },
/this observer's immediate projection lineage/u);
throws(first, {
  mode: "request_floor", basis_refs: ["cue_1"], response_plan_ref: "response_B",
  speaker_hidden_intent: "say now",
}, null, /non-contract fields/u);
throws(first, {
  mode: "backchannel", basis_refs: ["cue_1"], backchannel_text: "嗯",
}, null, /non-contract fields/u);
throws(first, {
  mode: "request_floor", basis_refs: ["cue_1"], response_plan_ref: "response_B",
  fixed_gap_ms: 200,
}, null, /non-contract fields/u);
throws(first, {
  mode: "interrupt", basis_refs: ["cue_1"],
}, null, /Unsupported observer participation mode/u);
throws(first, {
  mode: "backchannel", basis_refs: ["cue_1", "cue_1"],
}, null, /distinct/u);

const admitted = [1, 2].map((sequence) => ({
  schema_version: "cc7c-observer-speech-increment-acoustic-admission-v1",
  observer,
  admission_status: "heard_acoustic_cues_only",
  release_time_ms: sequence * 100,
  observer_increment: {
    ...perceived(sequence),
    heard_surface_fragment: null,
    perceived_speaker: null,
    lexical_intelligibility_attested: false,
    speaker_identity_recognized: false,
    release_time_ms: sequence * 100,
    no_future_increment_exposed: true,
  },
}));
const handoffContract = buildWorldSimulationTurnIncrementHandoffContract();
assert.equal(
  handoffContract.observer_participation_intention
    .request_floor_is_actual_floor_claim,
  false,
);
const packets = [];
const native = await runWorldSimulationTurnIncrementHandoff({
  admissions: [...admitted].reverse(),
  resolver: async (packet) => {
    packets.push(structuredClone(packet));
    const current = packets.length;
    return {
      listener_decision: {
        turn_end_projection: current === 1
          ? "possible_completion" : "continuing",
        projection_basis_refs: [`cue_${current}`],
        response_preparation: current === 1 ? "ready" : "abandon",
        response_plan_ref: "response_B",
      },
      response_preparation_context: {
        observer, available_response_plan_refs: ["response_B"],
      },
      participation_decision: current === 1
        ? { mode: "request_floor", basis_refs: ["cue_1"],
            response_plan_ref: "response_B" }
        : { mode: "withdraw", basis_refs: [] },
    };
  },
});
assert.equal(native.projected_count, 2);
assert.equal(packets[0].prior_participation_intent, null);
assert.equal(packets[1].prior_participation_intent.mode, "request_floor");
assert.equal(native.projections[0].participation_intent.mode, "request_floor");
assert.equal(native.projections[1].participation_intent.mode, "withdraw");
assert.equal(native.projections[1].participation_intent.prior_intention_id,
  native.projections[0].participation_intent.intention_id);
assert(native.projections.every((entry) =>
  entry.participation_intent.actual_floor_claimed === false
  && entry.participation_intent.backchannel_signal_emitted === false
  && entry.actual_world_action_replanned === false
  && entry.projection.boundaries.floor_claimed === false));

const noParticipation = await runWorldSimulationTurnIncrementHandoff({
  admissions: admitted,
  resolver: async (packet) => ({
    listener_decision: {
      turn_end_projection: "uncertain",
      projection_basis_refs: [],
      response_preparation: "none",
    },
  }),
});
assert.equal(noParticipation.projected_count, 2);
assert(noParticipation.projections.every((item) =>
  item.participation_intent === null));
await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions: admitted.slice(0, 1),
    resolver: async () => ({
      listener_decision: {
        turn_end_projection: "uncertain", projection_basis_refs: [],
        response_preparation: "none",
      },
      participation_decision: {
        mode: "request_floor", basis_refs: ["cue_1"],
        response_plan_ref: "world-action",
      },
    }),
  }),
  /ready response plan/u,
);

console.log("CC-7L observer participation intent tests passed.");
