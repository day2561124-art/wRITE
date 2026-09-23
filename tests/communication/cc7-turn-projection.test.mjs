import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCharacterCommunicationTurnProjectionContract,
  characterCommunicationTurnProjectionVersion,
  projectCharacterCommunicationTurnProjection,
} from "../../server/src/character-communication-turn-projection-service.mjs";

function increment(overrides = {}) {
  return {
    schema_version: "cc7-observer-speech-increment-v1",
    observer: "B",
    speaker: "A",
    signal_ref: "speech-signal-1",
    increment_ref: "increment-1",
    heard_surface_fragment: "你不是還沒看完",
    signal_phase: "ongoing",
    perceived_cue_refs: ["cue-syntax-1", "cue-prosody-1"],
    ...overrides,
  };
}

function decision(overrides = {}) {
  return {
    turn_end_projection: "possible_completion",
    projection_basis_refs: ["cue-syntax-1"],
    response_preparation: "preparing",
    response_plan_ref: "response-plan-b-1",
    ...overrides,
  };
}

function project(overrides = {}) {
  return projectCharacterCommunicationTurnProjection({
    observer: "B",
    perceived_speech_increment: increment(),
    listener_decision: decision(),
    response_preparation_context: {
      observer: "B",
      available_response_plan_refs: [
        "response-plan-b-1",
        "response-plan-b-ready",
      ],
    },
    ...overrides,
  });
}

test("CC-7A contract keeps projection subjective and refuses premature floor/world effects", () => {
  const contract = buildCharacterCommunicationTurnProjectionContract();
  assert.equal(contract.version, characterCommunicationTurnProjectionVersion);
  assert.equal(contract.actual_perceived_speech_increment_required, true);
  assert.equal(contract.turn_end_projection_is_subjective, true);
  assert.equal(contract.response_preparation_may_begin_before_signal_end, true);
  assert.equal(contract.prepared_response_is_not_committed_action, true);
  assert.equal(contract.projection_may_be_revised_by_later_increment, true);
  assert.equal(contract.prepared_response_may_be_abandoned, true);
  assert.equal(contract.silence_and_wait_remain_legal, true);
  assert.equal(contract.overlap_is_not_interruption, true);
  assert.equal(contract.backchannel_is_not_floor_claim, true);
  assert.equal(contract.floor_arbitration_performed, false);
  assert.equal(contract.interruption_judgment_performed, false);
  assert.equal(contract.actual_world_signal_emitted, false);
  assert.equal(contract.grounding_claimed, false);
  assert.equal(contract.listener_belief_updated, false);
  assert.equal(contract.fixed_gap_threshold_used, false);
  assert.equal(contract.technical_budget_is_psychology, false);
});

test("listener may prepare a response while the perceived speaker is still talking", () => {
  const first = project();
  const second = project();
  assert.deepEqual(first, second);
  assert.equal(first.observer, "B");
  assert.equal(first.perceived_speaker, "A");
  assert.equal(first.signal_phase, "ongoing");
  assert.equal(first.turn_end_projection.status, "possible_completion");
  assert.deepEqual(first.turn_end_projection.basis_refs, ["cue-syntax-1"]);
  assert.equal(first.turn_end_projection.subjective_only, true);
  assert.equal(first.turn_end_projection.world_turn_end_claimed, false);
  assert.equal(first.response_preparation.state, "preparing");
  assert.equal(first.response_preparation.response_plan_ref, "response-plan-b-1");
  assert.equal(first.response_preparation.committed_action, false);
  assert.equal(first.response_preparation.world_signal_emitted, false);
  assert.equal(first.boundaries.floor_claimed, false);
  assert.equal(first.boundaries.grounding_claimed, false);
});

test("listener may remain uncertain and prepare nothing", () => {
  const result = project({
    listener_decision: decision({
      turn_end_projection: "uncertain",
      projection_basis_refs: [],
      response_preparation: "none",
      response_plan_ref: undefined,
    }),
  });
  assert.equal(result.turn_end_projection.status, "uncertain");
  assert.deepEqual(result.turn_end_projection.basis_refs, []);
  assert.equal(result.response_preparation.state, "none");
  assert.equal(result.response_preparation.response_plan_ref, null);
  assert.equal(result.boundaries.world_truth_claimed, false);
});

test("turn projection may rely on perceived nonlexical cues without intelligible surface text", () => {
  const result = project({
    perceived_speech_increment: increment({
      heard_surface_fragment: null,
      perceived_cue_refs: ["cue-prosody-only"],
    }),
    listener_decision: decision({
      turn_end_projection: "possible_completion",
      projection_basis_refs: ["cue-prosody-only"],
      response_preparation: "none",
      response_plan_ref: undefined,
    }),
  });

  assert.equal(result.heard_surface_fragment, null);
  assert.deepEqual(result.perceived_cue_refs, ["cue-prosody-only"]);
  assert.equal(result.turn_end_projection.status, "possible_completion");

  assert.throws(() => project({
    perceived_speech_increment: increment({
      heard_surface_fragment: null,
      perceived_cue_refs: [],
    }),
    listener_decision: decision({
      turn_end_projection: "uncertain",
      projection_basis_refs: [],
      response_preparation: "none",
      response_plan_ref: undefined,
    }),
  }), /surface or cue evidence/u);
});

test("later perceived increment may revise projection and abandon a prepared response", () => {
  const first = project();
  const second = projectCharacterCommunicationTurnProjection({
    observer: "B",
    perceived_speech_increment: increment({
      increment_ref: "increment-2",
      heard_surface_fragment: "你不是還沒看完嗎",
      perceived_cue_refs: ["cue-syntax-2", "cue-prosody-2"],
    }),
    listener_decision: decision({
      turn_end_projection: "continuing",
      projection_basis_refs: ["increment-2"],
      response_preparation: "abandon",
      response_plan_ref: "response-plan-b-1",
    }),
    response_preparation_context: {
      observer: "B",
      available_response_plan_refs: ["response-plan-b-1"],
    },
    prior_state: first,
  });

  assert.notEqual(second.projection_id, first.projection_id);
  assert.equal(second.lineage.prior_projection_id, first.projection_id);
  assert.equal(second.lineage.revises_prior_projection, true);
  assert.equal(second.turn_end_projection.status, "continuing");
  assert.equal(second.response_preparation.state, "abandoned");
  assert.equal(second.response_preparation.response_plan_ref, "response-plan-b-1");
  assert.equal(second.response_preparation.committed_action, false);
});

test("acoustic segment ending does not automatically award the floor or grounding", () => {
  const result = project({
    perceived_speech_increment: increment({
      signal_phase: "acoustic_segment_ended",
      increment_ref: "increment-end",
      heard_surface_fragment: "你不是還沒看完嗎？",
      perceived_cue_refs: ["cue-end-1"],
    }),
    listener_decision: decision({
      turn_end_projection: "completed_for_current_joint_activity",
      projection_basis_refs: ["cue-end-1"],
      response_preparation: "ready",
      response_plan_ref: "response-plan-b-ready",
    }),
  });

  assert.equal(result.turn_end_projection.status, "completed_for_current_joint_activity");
  assert.equal(result.response_preparation.state, "ready");
  assert.equal(result.boundaries.floor_claimed, false);
  assert.equal(result.boundaries.floor_arbitrated, false);
  assert.equal(result.boundaries.backchannel_emitted, false);
  assert.equal(result.boundaries.overlap_classified_as_interruption, false);
  assert.equal(result.boundaries.grounding_claimed, false);
});

test("projection evidence must be actually perceived by this observer", () => {
  assert.throws(() => project({
    listener_decision: decision({
      projection_basis_refs: ["engine-secret-cue"],
    }),
  }), /observer's perceived increment evidence/);

  assert.throws(() => project({
    listener_decision: decision({
      turn_end_projection: "possible_completion",
      projection_basis_refs: [],
    }),
  }), /requires observer-perceived basis evidence/);
});

test("foreign observer, self speech, duplicate cues, and unsupported phases are rejected", () => {
  assert.throws(() => project({ observer: "C" }), /same observer/);
  assert.throws(() => project({
    perceived_speech_increment: increment({ speaker: "B" }),
  }), /distinct perceived speaker/);
  assert.throws(() => project({
    perceived_speech_increment: increment({
      perceived_cue_refs: ["cue-1", "cue-1"],
    }),
  }), /distinct nonblank/);
  assert.throws(() => project({
    perceived_speech_increment: increment({ signal_phase: "magic_turn_end" }),
  }), /unsupported signal phase/);
});

test("prepared response lifecycle requires explicit same-character lineage", () => {
  assert.throws(() => project({
    listener_decision: decision({
      response_preparation: "ready",
      response_plan_ref: undefined,
    }),
  }), /ready response requires/);

  assert.throws(() => project({
    listener_decision: decision({
      response_preparation: "preparing",
      response_plan_ref: "response-plan-foreign",
    }),
  }), /only this observer's available response plans/);

  assert.throws(() => project({
    response_preparation_context: {
      observer: "C",
      available_response_plan_refs: ["response-plan-b-1"],
    },
  }), /must belong to the same observer/);

  assert.throws(() => project({
    listener_decision: decision({
      response_preparation: "none",
      response_plan_ref: "response-plan-b-1",
    }),
  }), /No response preparation/);

  assert.throws(() => project({
    listener_decision: decision({
      response_preparation: "abandon",
      response_plan_ref: "response-plan-b-1",
    }),
  }), /requires prior preparing or ready state/);

  const first = project();
  assert.throws(() => projectCharacterCommunicationTurnProjection({
    observer: "B",
    perceived_speech_increment: increment({
      signal_ref: "other-signal",
      increment_ref: "other-increment",
    }),
    listener_decision: decision({
      response_preparation: "abandon",
      response_plan_ref: "response-plan-b-1",
    }),
    prior_state: first,
  }), /same observer, speaker, and signal/);
});

test("CC-7A rejects hidden speaker state and premature floor/interruption controls", () => {
  for (const illegal of [
    { speaker_intent: "please answer now" },
    { source_action_id: "private-action-1" },
    { fixed_gap_ms: 200 },
    { floor_action: "claim" },
    { interruption: true },
    { backchannel_text: "嗯" },
  ]) {
    assert.throws(() => project({
      listener_decision: {
        ...decision(),
        ...illegal,
      },
    }), /non-contract fields/);
  }

  assert.throws(() => project({
    perceived_speech_increment: increment({
      speaker_hidden_intent: "B should stay",
    }),
  }), /non-contract fields/);
});

test("CC-7A state remains temporary interaction state, not memory or belief", () => {
  const result = project();
  assert.equal(result.boundaries.temporary_interaction_state_only, true);
  assert.equal(result.boundaries.long_term_memory_store_created, false);
  assert.equal(result.boundaries.listener_belief_updated, false);
  assert.equal(result.boundaries.speaker_hidden_intent_exposed, false);
  assert.equal(result.boundaries.fixed_gap_threshold_used, false);
  assert.equal(result.boundaries.technical_budget_used_as_psychology, false);
});
