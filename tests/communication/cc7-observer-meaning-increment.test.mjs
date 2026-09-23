import assert from "node:assert/strict";
import {
  buildWorldSimulationObserverMeaningIncrementContract,
  runWorldSimulationObserverMeaningIncrementAdmission,
  worldSimulationObserverMeaningIncrementVersion,
} from "../../server/src/world-simulation-communication-observer-meaning-increment-service.mjs";
import {
  worldSimulationObserverLexicalIncrementVersion,
} from "../../server/src/world-simulation-communication-observer-lexical-increment-service.mjs";
import {
  runWorldSimulationTurnIncrementHandoff,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";

const lexical = [
  {
    schema_version: worldSimulationObserverLexicalIncrementVersion,
    observer: "B",
    signal_ref: "observer_signal_test",
    increment_ref: "observer_increment_1",
    release_time_ms: 100,
    recognition_status: "uncertain",
    heard_surface_fragment: "你號",
    lexical_intelligibility_attested: true,
    subjective_only: true,
  },
  {
    schema_version: worldSimulationObserverLexicalIncrementVersion,
    observer: "B",
    signal_ref: "observer_signal_test",
    increment_ref: "observer_increment_2",
    release_time_ms: 200,
    recognition_status: "recognized",
    heard_surface_fragment: "世界",
    lexical_intelligibility_attested: true,
    subjective_only: true,
  },
];

const contract = buildWorldSimulationObserverMeaningIncrementContract();
assert.equal(contract.source, "cc7j_listener_authored_lexical_increment_only");
assert.equal(
  contract.resolver_receives_current_and_prior_listener_recognized_surface_only,
  true,
);
assert.equal(contract.resolver_receives_future_fragment, false);
assert.equal(contract.resolver_receives_speaker_semantics, false);
assert.equal(contract.resolver_receives_real_speaker_identity, false);
assert.equal(contract.interpretation_is_listener_subjective, true);
assert.equal(contract.persistent_audit_contains_surface_or_meaning_text, false);
assert.equal(contract.grounding_claimed, false);
assert.equal(contract.belief_updated, false);
assert.equal(contract.actual_mid_turn_world_action_replanning, false);

const noResolver = await runWorldSimulationObserverMeaningIncrementAdmission({
  lexical_recognitions: lexical,
});
assert.equal(noResolver.audit.status, "resolver_not_installed");
assert.equal(noResolver.audit.lexical_input_count, 2);
assert.equal(noResolver.audit.candidate_count, 2);
assert.equal(noResolver.audit.interpretation_count, 0);

const seen = [];
const projected = await runWorldSimulationObserverMeaningIncrementAdmission({
  lexical_recognitions: [...lexical].reverse(),
  resolver: async (view) => {
    seen.push(structuredClone(view));
    if (view.increment_ref === "observer_increment_1") {
      return {
        interpretation_status: "uncertain",
        interpreted_content: "可能是在打招呼",
        interpreted_interaction_function: "greeting_candidate",
        understanding_attested: false,
      };
    }
    return {
      interpretation_status: "interpreted",
      interpreted_content: "對方在打招呼",
      interpreted_interaction_function: "greeting",
      understanding_attested: true,
    };
  },
});
assert.equal(projected.audit.schema_version,
  worldSimulationObserverMeaningIncrementVersion);
assert.equal(projected.audit.status, "observer_subjective_incremental_meaning");
assert.equal(projected.audit.interpretation_count, 2);
assert.equal(seen.length, 2);
assert.equal(seen[0].current_heard_surface_fragment, "你號");
assert.equal(seen[0].heard_surface_prefix, "你號");
assert.equal(seen[0].prior_listener_interpretation, null);
assert.equal(seen[1].current_heard_surface_fragment, "世界");
assert.equal(seen[1].heard_surface_prefix, "你號世界");
assert.equal(
  seen[1].prior_listener_interpretation.interpreted_content,
  "可能是在打招呼",
);
assert(seen.every((view) =>
  view.boundaries.source_identity_available === false
  && view.boundaries.source_semantics_available === false
  && view.boundaries.future_fragment_available === false
  && view.boundaries.world_truth_authority === false
  && view.boundaries.grounding_authority === false
  && view.boundaries.belief_write_authority === false
  && view.boundaries.floor_or_interruption_authority === false
  && view.boundaries.world_action_replanning_available === false));
assert.equal(JSON.stringify(seen[0]).includes("世界"), false);

const meanings = projected.engine_private_meaning_increments;
assert.equal(meanings[0].interpretation_status, "uncertain");
assert.equal(meanings[0].understanding_attested, false);
assert.equal(meanings[1].interpretation_status, "interpreted");
assert.equal(meanings[1].understanding_attested, true);
assert.equal(
  meanings[1].prior_interpretation_id,
  meanings[0].interpretation_id,
);
assert.equal(meanings[1].revises_prior_interpretation, true);
assert(meanings.every((item) =>
  item.subjective_only === true
  && item.interpretation_may_differ_from_speaker_intent === true
  && item.grounding_claimed === false
  && item.belief_updated === false
  && item.world_truth_claimed === false));

const serializedAudit = JSON.stringify(projected.audit);
for (const hidden of [
  "你號", "世界", "可能是在打招呼", "對方在打招呼", "greeting_candidate",
]) {
  assert.equal(serializedAudit.includes(hidden), false, hidden);
}

const admissions = lexical.map((item) => ({
  schema_version: "cc7c-observer-speech-increment-acoustic-admission-v1",
  observer: "B",
  release_time_ms: item.release_time_ms,
  admission_status: "heard_acoustic_cues_only",
  observer_increment: {
    schema_version: "cc7-observer-speech-increment-v1",
    observer: "B",
    signal_ref: item.signal_ref,
    increment_ref: item.increment_ref,
    signal_phase:
      item.increment_ref === "observer_increment_2"
        ? "acoustic_segment_ended" : "ongoing",
    perceived_cue_refs: [`cue_${item.increment_ref}`],
    heard_surface_fragment: null,
    perceived_speaker: null,
    lexical_intelligibility_attested: false,
    speaker_identity_recognized: false,
    release_time_ms: item.release_time_ms,
    no_future_increment_exposed: true,
  },
}));

const handoffViews = [];
const handoff = await runWorldSimulationTurnIncrementHandoff({
  admissions,
  lexical_recognitions: lexical,
  meaning_interpretations: meanings,
  resolver: async (view) => {
    handoffViews.push(structuredClone(view));
    return {
      listener_decision: {
        turn_end_projection:
          view.meaning_interpretation_status === "interpreted"
            ? "possible_completion" : "continuing",
        projection_basis_refs: [view.perceived_speech_increment.increment_ref],
        response_preparation: "none",
      },
    };
  },
});
assert.equal(handoff.projected_count, 2);
assert.equal(
  handoffViews[0].incremental_meaning_interpretation.interpreted_content,
  "可能是在打招呼",
);
assert.equal(
  handoffViews[1].incremental_meaning_interpretation.interpreted_content,
  "對方在打招呼",
);
assert.equal(handoffViews[1].meaning_interpretation_status, "interpreted");
assert.equal(
  handoff.projections[1].source_meaning_interpretation_id,
  meanings[1].interpretation_id,
);
assert(handoff.projections.every((item) =>
  item.projection.boundaries.grounding_claimed === false
  && item.projection.boundaries.listener_belief_updated === false
  && item.actual_world_action_replanned === false));

await assert.rejects(
  runWorldSimulationObserverMeaningIncrementAdmission({
    lexical_recognitions: lexical,
    resolver: async () => ({
      interpretation_status: "interpreted",
      interpreted_content: "偷渡",
      understanding_attested: true,
      speaker_semantic_content: "engine truth",
    }),
  }),
  (error) => error?.code === "CC7K_OBSERVER_MEANING_INCREMENT_INVALID",
);

await assert.rejects(
  runWorldSimulationObserverMeaningIncrementAdmission({
    lexical_recognitions: lexical,
    resolver: async () => ({
      interpretation_status: "uninterpreted",
      interpreted_content: "不該存在",
      understanding_attested: false,
    }),
  }),
  /Uninterpreted increment cannot carry interpreted meaning/u,
);

await assert.rejects(
  runWorldSimulationObserverMeaningIncrementAdmission({
    lexical_recognitions: lexical,
    resolver: async () => ({
      interpretation_status: "uncertain",
      interpreted_content: "也許",
      understanding_attested: true,
    }),
  }),
  /Understanding may be attested only/u,
);

const foreignMeaning = {
  ...meanings[0],
  increment_ref: "observer_increment_foreign",
};
await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions,
    lexical_recognitions: lexical,
    meaning_interpretations: [foreignMeaning],
    resolver: async () => null,
  }),
  /identity does not match its contents|does not match an admitted observer increment/u,
);

const wrongLineageMeaning = {
  ...meanings[0],
  source_lexical_recognition_status: "recognized",
};
await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions,
    lexical_recognitions: lexical,
    meaning_interpretations: [wrongLineageMeaning],
    resolver: async () => null,
  }),
  /identity does not match its contents|must match its CC-7J lexical recognition/u,
);

const tamperedMeaning = {
  ...meanings[0],
  interpreted_content: "竄改後的理解",
};
await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions,
    lexical_recognitions: lexical,
    meaning_interpretations: [tamperedMeaning],
    resolver: async () => null,
  }),
  /identity does not match its contents/u,
);

await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions,
    lexical_recognitions: lexical,
    meaning_interpretations: [meanings[1]],
    resolver: async () => null,
  }),
  /First CC-7K meaning interpretation cannot claim prior lineage/u,
);

const unintelligible = {
  ...lexical[0],
  recognition_status: "unintelligible",
  heard_surface_fragment: null,
  lexical_intelligibility_attested: false,
};
let unintelligibleCalls = 0;
const skipped = await runWorldSimulationObserverMeaningIncrementAdmission({
  lexical_recognitions: [unintelligible],
  resolver: async () => {
    unintelligibleCalls += 1;
    return null;
  },
});
assert.equal(skipped.audit.lexical_input_count, 1);
assert.equal(skipped.audit.candidate_count, 0);
assert.equal(skipped.audit.interpretation_count, 0);
assert.equal(unintelligibleCalls, 0);

console.log("CC-7K observer incremental meaning admission tests passed.");
