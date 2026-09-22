import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCharacterCommunicationRepairInitiationContract,
  characterCommunicationRepairInitiationVersion,
  projectCharacterCommunicationRepairInitiation,
} from "../../server/src/character-communication-repair-initiation-service.mjs";

function understanding(overrides = {}) {
  return {
    version: "cc6c-listener-speech-understanding-v1",
    observer: "B",
    character_views: [{
      observer: "B",
      heard_surface: "拿那個。",
      interpreted_content: "拿書",
      speech_content_intelligible: true,
      listener_understanding_attested: false,
      ...overrides.view,
    }],
    audit: { decisions: [{
      speech_candidate_id: "candidate-1",
      source_action_id: "private-action-1",
      source_speaker: "A",
      reception_verified: true,
      ...overrides.audit,
    }] },
    ...overrides.projection,
  };
}

function decision(overrides = {}) {
  return {
    speech_candidate_id: "candidate-1",
    initiate: true,
    trouble_kind: "reference",
    request_function: "specify_reference",
    listener_authored_request_meaning: "你指的是哪一本？",
    ...overrides,
  };
}
function project(overrides = {}) {
  return projectCharacterCommunicationRepairInitiation({
    observer: "B",
    listener_understanding_projection: understanding(),
    decisions: [decision()],
    ...overrides,
  });
}

test("CC-6F contract refuses auto-repair, World signal, grounding and belief updates", () => {
  const c = buildCharacterCommunicationRepairInitiationContract();
  assert.equal(c.version, characterCommunicationRepairInitiationVersion);
  assert.equal(c.requires_explicit_listener_decision, true);
  assert.equal(c.output_is_unrealized_candidate, true);
  for (const field of [
    "speaker_hidden_intent_exposed", "engine_identity_exposed",
    "repair_automatically_triggered", "actual_world_signal_emitted",
    "repair_completed", "grounding_claimed", "belief_update_performed",
  ]) assert.equal(c[field], false);
});

test("listener may initiate a bounded reference repair without importing hidden speaker knowledge", () => {
  const first = project();
  const second = project();
  assert.deepEqual(first, second);
  assert.equal(first.audit.candidate_count, 1);
  const request = first.character_view.repair_request_candidates[0];
  assert.equal(request.kind, "listener_authored_repair_request_candidate");
  assert.equal(request.observer, "B");
  assert.equal(request.trouble_kind, "reference");
  assert.equal(request.request_function, "specify_reference");
  assert.equal(request.listener_authored_request_meaning, "你指的是哪一本？");
  assert.equal(request.signal_realized, false);
  assert.equal(request.repair_completed, false);
  assert.equal(request.grounding_claimed, false);
  assert.equal(request.belief_updated, false);
  assert.equal(Object.hasOwn(request, "source_action_id"), false);
  assert.equal(Object.hasOwn(request, "source_speaker"), false);
  assert.equal(Object.hasOwn(request, "speaker_intent"), false);
  assert.equal(first.audit.decisions[0].source_action_id, "private-action-1");
  assert.equal(first.audit.actual_world_signal_emitted, false);
});

test("listener can withhold repair: an observed ambiguity does not force an action", () => {
  const result = project({ decisions: [decision({ initiate: false })] });
  assert.equal(result.audit.candidate_count, 0);
  assert.equal(result.character_view.repair_requested_by_listener, false);
  assert.equal(result.audit.decisions[0].status, "listener_declined_repair");
  assert.equal(project({ decisions: [] }).audit.candidate_count, 0);
});

test("hearing trouble may be initiated without falsely attesting comprehension", () => {
  const result = project({
    listener_understanding_projection: understanding({
      view: {
        heard_surface: "拿……",
        interpreted_content: null,
        speech_content_intelligible: false,
        listener_understanding_attested: false,
      },
    }),
    decisions: [decision({
      trouble_kind: "hearing",
      request_function: "repeat",
      listener_authored_request_meaning: "可以再說一次嗎？",
    })],
  });
  assert.equal(result.audit.candidate_count, 1);
  assert.equal(result.character_view.repair_request_candidates[0].request_function, "repeat");
  assert.equal(result.audit.grounding_claimed, false);
});

test("foreign observer, unknown or duplicate candidates, unheard source are rejected", () => {
  assert.throws(() => project({ observer: "C" }), /same-observer/);
  assert.throws(() => project({
    decisions: [decision({ speech_candidate_id: "unknown" })],
  }), /unique heard speech candidate/);
  assert.throws(() => project({ decisions: [decision(), decision()] }), /unique heard speech candidate/);
  assert.throws(() => project({
    listener_understanding_projection: understanding({ audit: { reception_verified: false } }),
  }), /unheard speech/);
  assert.throws(() => project({
    listener_understanding_projection: understanding({ view: { observer: "C" } }),
  }), /another listener/);
  assert.throws(() => project({
    listener_understanding_projection: understanding({
      projection: { character_views: [] },
    }),
  }), /aligned listener views/);
});

test("reject hidden/engine fields, fabricated functions, missing meaning and implicit decisions", () => {
  assert.throws(() => project({
    decisions: [decision({ source_speaker: "A" })],
  }), /listener-authored repair decision fields/);
  assert.throws(() => project({
    decisions: [decision({ initiate: undefined })],
  }), /explicit listener initiation/);
  assert.throws(() => project({
    decisions: [decision({ trouble_kind: "world_truth" })],
  }), /bounded trouble/);
  assert.throws(() => project({
    decisions: [decision({ request_function: "inject_belief" })],
  }), /bounded trouble/);
  assert.throws(() => project({
    decisions: [decision({ listener_authored_request_meaning: "" })],
  }), /bounded trouble/);
  assert.throws(() => project({
    decisions: Array.from({ length: 17 }, () => decision()),
  }), /bounded list/);
});
