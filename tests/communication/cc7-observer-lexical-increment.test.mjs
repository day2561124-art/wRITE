import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  projectWorldSimulationCommunicationSpeechStream,
} from "../../server/src/world-simulation-communication-speech-stream-service.mjs";
import {
  worldSimulationObserverSpeechIncrementVersion,
} from "../../server/src/world-simulation-communication-observer-increment-service.mjs";
import {
  buildWorldSimulationObserverLexicalIncrementContract,
  runWorldSimulationObserverLexicalIncrementAdmission,
  worldSimulationObserverLexicalIncrementVersion,
} from "../../server/src/world-simulation-communication-observer-lexical-increment-service.mjs";
import {
  runWorldSimulationTurnIncrementHandoff,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";

const actionId = "communication_cc7j_aaaaaaaaaaaaaaaa";
const semantic = "A privately intends a greeting";
const baseOutcome = {
  actor: "A",
  action_id: actionId,
  result: "communication_emitted",
  duration_ms: 400,
  communication_event: {
    schema_version: "cc1-world-communication-event-v1",
    actor: "A",
    channel: "speech",
    surface_text: "你好世界",
    semantic_content: semantic,
    surface_realization_complete: true,
    surface_realization: {
      source_action_id: actionId,
      surface_text: "你好世界",
      semantic_anchor: semantic,
      language: "zh-Hant",
    },
  },
};
const stream = projectWorldSimulationCommunicationSpeechStream({
  outcome: baseOutcome,
  technical_increment_max_chars: 2,
});
const outcome = { ...baseOutcome, communication_speech_stream: stream };
const soundId = "sound_cc7j_test";

function receipt(observer, sourceIncrement) {
  const signalRef = `observer_signal_${hashAgentRunValue({
    version: worldSimulationObserverSpeechIncrementVersion,
    observer,
    sound_id: soundId,
  }).slice(0, 24)}`;
  const observerIncrementRef =
    `observer_increment_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: signalRef,
      increment_ref: sourceIncrement.increment_ref,
    }).slice(0, 24)}`;
  const cueRef =
    `audible_cue_${hashAgentRunValue({
      version: worldSimulationObserverSpeechIncrementVersion,
      signal_ref: signalRef,
      increment_ref: sourceIncrement.increment_ref,
    }).slice(0, 24)}`;
  return {
    schema_version: worldSimulationObserverSpeechIncrementVersion,
    observer,
    release_time_ms: sourceIncrement.end_offset_ms,
    admission_status: "heard_acoustic_cues_only",
    observer_increment: {
      schema_version: "cc7-observer-speech-increment-v1",
      observer,
      signal_ref: signalRef,
      increment_ref: observerIncrementRef,
      signal_phase: sourceIncrement.signal_phase,
      perceived_cue_refs: [cueRef],
      heard_surface_fragment: null,
      perceived_speaker: null,
      lexical_intelligibility_attested: false,
      speaker_identity_recognized: false,
      release_time_ms: sourceIncrement.end_offset_ms,
      no_future_increment_exposed: true,
    },
    audit: {
      source_stream_id: stream.stream_id,
      source_action_id: actionId,
      source_sound_id: soundId,
      source_speaker: "A",
      registered_sound_link_verified: true,
      static_acoustics_scope_verified: true,
    },
  };
}

const admissions = stream.increments.map((increment) => receipt("B", increment));
const contract = buildWorldSimulationObserverLexicalIncrementContract();
assert.equal(contract.resolver_receives_one_released_fragment_only, true);
assert.equal(contract.future_fragment_exposed, false);
assert.equal(contract.source_semantics_exposed, false);
assert.equal(contract.lexical_recognition_is_listener_subjective, true);
assert.equal(contract.persistent_audit_contains_surface_text, false);
assert.equal(contract.floor_or_interruption_decided, false);

const noResolver = await runWorldSimulationObserverLexicalIncrementAdmission({
  admissions,
  action_outcomes: [outcome],
});
assert.equal(noResolver.audit.status, "resolver_not_installed");
assert.equal(noResolver.audit.candidate_count, 2);
assert.equal(noResolver.audit.recognition_count, 0);
assert.deepEqual(noResolver.engine_private_lexical_increments, []);

const seen = [];
const recognized = await runWorldSimulationObserverLexicalIncrementAdmission({
  admissions,
  action_outcomes: [outcome],
  resolver: async (packet) => {
    seen.push(structuredClone(packet));
    if (packet.release_time_ms === stream.increments[0].end_offset_ms) {
      return {
        recognition_status: "uncertain",
        heard_surface_fragment: "你號",
      };
    }
    return {
      recognition_status: "recognized",
      heard_surface_fragment: packet.emitted_surface_fragment,
    };
  },
});
assert.equal(recognized.audit.schema_version,
  worldSimulationObserverLexicalIncrementVersion);
assert.equal(recognized.audit.candidate_count, 2);
assert.equal(recognized.audit.recognition_count, 2);
assert.equal(seen.length, 2);
assert.equal(seen[0].emitted_surface_fragment, "你好");
assert.equal(seen[1].emitted_surface_fragment, "世界");
assert.equal(JSON.stringify(seen[0]).includes("世界"), false);
assert.equal(JSON.stringify(seen[1]).includes("你好"), false);
assert.equal(JSON.stringify(seen).includes(semantic), false);
assert(seen.every((packet) =>
  packet.boundaries.source_identity_available === false
  && packet.boundaries.source_action_identity_available === false
  && packet.boundaries.source_semantics_available === false
  && packet.boundaries.future_fragment_available === false
  && packet.boundaries.world_truth_authority === false));
assert.deepEqual(
  recognized.engine_private_lexical_increments.map((item) =>
    [item.recognition_status, item.heard_surface_fragment]),
  [["uncertain", "你號"], ["recognized", "世界"]],
);
const serializedAudit = JSON.stringify(recognized.audit);
for (const hidden of ["你好", "世界", "你號", semantic, actionId, soundId]) {
  assert.equal(serializedAudit.includes(hidden), false, hidden);
}

const turnViews = [];
const handoff = await runWorldSimulationTurnIncrementHandoff({
  admissions,
  lexical_recognitions: recognized.engine_private_lexical_increments,
  resolver: async (view) => {
    turnViews.push(structuredClone(view));
    return {
      listener_decision: {
        turn_end_projection:
          view.release_time_ms === stream.increments.at(-1).end_offset_ms
            ? "possible_completion" : "continuing",
        projection_basis_refs: [
          view.perceived_speech_increment.increment_ref,
        ],
        response_preparation: "none",
        response_plan_ref: null,
      },
      response_preparation_context: {
        observer: "B",
        available_response_plan_refs: [],
      },
    };
  },
});
assert.equal(handoff.projected_count, 2);
assert.deepEqual(
  turnViews.map((view) => view.perceived_speech_increment.heard_surface_fragment),
  ["你號", "世界"],
);
assert.deepEqual(
  turnViews.map((view) => view.lexical_recognition_status),
  ["uncertain", "recognized"],
);
assert(turnViews.every((view) =>
  view.evidence_is_nonlexical_only === false
  && view.anonymous_speaker_ref.startsWith("anonymous_voice_")
  && view.speaker_identity_recognized === false
  && view.world_action_replanning_available === false));
assert.deepEqual(
  handoff.projections.map((item) =>
    item.projection.heard_surface_fragment),
  ["你號", "世界"],
);

const unintelligible = await runWorldSimulationObserverLexicalIncrementAdmission({
  admissions: [admissions[0]],
  action_outcomes: [outcome],
  resolver: async () => ({
    recognition_status: "unintelligible",
    heard_surface_fragment: null,
  }),
});
assert.equal(
  unintelligible.engine_private_lexical_increments[0]
    .lexical_intelligibility_attested,
  false,
);

await assert.rejects(
  runWorldSimulationObserverLexicalIncrementAdmission({
    admissions: [admissions[0]],
    action_outcomes: [outcome],
    resolver: async () => ({
      recognition_status: "recognized",
      heard_surface_fragment: "你好",
      world_truth: true,
    }),
  }),
  (error) => error?.code === "CC7J_OBSERVER_LEXICAL_INCREMENT_INVALID",
);

await assert.rejects(
  runWorldSimulationObserverLexicalIncrementAdmission({
    admissions: [admissions[0]],
    action_outcomes: [outcome],
    resolver: async () => ({
      recognition_status: "unintelligible",
      heard_surface_fragment: "你好",
    }),
  }),
  /cannot carry heard surface text/u,
);

await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions: [admissions[0]],
    lexical_recognitions: [{
      ...recognized.engine_private_lexical_increments[0],
      observer: "C",
    }],
    resolver: async () => null,
  }),
  /does not match an admitted observer increment/u,
);

const wrongSoundReceipt = structuredClone(admissions[0]);
wrongSoundReceipt.audit.source_sound_id = "other_sound";
await assert.rejects(
  runWorldSimulationObserverLexicalIncrementAdmission({
    admissions: [wrongSoundReceipt],
    action_outcomes: [outcome],
    resolver: async () => null,
  }),
  /does not match its verified CC-7C sound lineage/u,
);

const tamperedReceipt = structuredClone(admissions[0]);
tamperedReceipt.observer_increment.increment_ref =
  "observer_increment_" + "f".repeat(24);
await assert.rejects(
  runWorldSimulationObserverLexicalIncrementAdmission({
    admissions: [tamperedReceipt],
    action_outcomes: [outcome],
    resolver: async () => null,
  }),
  /does not match its released source increment/u,
);

console.log("CC-7J observer incremental lexical admission tests passed.");
