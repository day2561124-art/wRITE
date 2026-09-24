import assert from "node:assert/strict";
import {
  projectWorldSimulationCommunicationSpeechStream,
} from "../../server/src/world-simulation-communication-speech-stream-service.mjs";
import {
  buildWorldSimulationSpeechOverlapEvidence as build,
} from "../../server/src/world-simulation-communication-speech-overlap-service.mjs";

function speech(actor, actionId, surface, duration) {
  const outcome = {
    actor,
    action_id: actionId,
    result: "communication_emitted",
    duration_ms: duration,
    communication_event: {
      schema_version: "cc1-world-communication-event-v1",
      actor,
      channel: "speech",
      surface_text: surface,
      surface_realization_complete: true,
      surface_realization: {
        source_action_id: actionId,
        surface_text: surface,
      },
    },
  };
  const {source_actor: _privateActor, ...committedStream} =
    projectWorldSimulationCommunicationSpeechStream({
      outcome, technical_increment_max_chars: 2,
    });
  outcome.communication_speech_stream = committedStream;
  return outcome;
}
function timeline(outcomes) {
  return {entries:outcomes.flatMap((outcome) =>
    outcome.communication_speech_stream.increments.map((increment) => ({
      kind:"communication_speech_increment",
      actor:outcome.actor,
      action_id:outcome.action_id,
      stream_id:outcome.communication_speech_stream.stream_id,
      increment_ref:increment.increment_ref,
      time_ms:increment.end_offset_ms,
      surface_fragment:increment.surface_fragment,
      signal_phase:increment.signal_phase,
    })))};
}

const a=speech("A","speech_a","你好。",300);
const b=speech("B","speech_b","嗯。",120);
const both=build({action_outcomes:[a,b],causal_timeline:timeline([a,b])});
assert.equal(both.status,"simultaneous_realized_speech_observed");
assert.equal(both.validated_speech_count,2);
assert.equal(both.overlapping_pair_count,1);
assert.equal(both.pairs[0].overlap_start_ms,0);
assert.equal(both.pairs[0].overlap_end_ms,120);
assert.equal(both.pairs[0].interruption_judged,false);
assert.equal(both.pairs[0].floor_priority_inferred,false);
assert.equal(both.boundaries.listener_audibility_inferred,false);
assert.equal(both.boundaries.listener_understanding_inferred,false);
assert.equal(JSON.stringify(both).includes("你好"),false);
assert.equal(JSON.stringify(both).includes('"A"'),false);
assert.deepEqual(both,build({
  action_outcomes:[b,a],causal_timeline:timeline([b,a]),
}));

const alone=build({action_outcomes:[a],causal_timeline:timeline([a])});
assert.equal(alone.status,"no_simultaneous_realized_speech");
assert.equal(alone.overlapping_pair_count,0);
const noSpeech=build({action_outcomes:[],causal_timeline:{entries:[]}});
assert.equal(noSpeech.validated_speech_count,0);

assert.throws(()=>build({
  action_outcomes:[a,b],
  causal_timeline:timeline([a]),
}),/no unique causal timeline entry/u);
assert.throws(()=>build({
  action_outcomes:[a,{...b,communication_speech_stream:{
    ...b.communication_speech_stream,source_action_id:"foreign",
  }}],
  causal_timeline:timeline([a,b]),
}),/differs from its emitted source/u);
assert.throws(()=>build({
  action_outcomes:[a,speech("A","speech_a2","再說。",90)],
  causal_timeline:timeline([a,speech("A","speech_a2","再說。",90)]),
}),/two concurrent speech actions/u);

console.log("CC-7Z simultaneous speech evidence tests passed.");
