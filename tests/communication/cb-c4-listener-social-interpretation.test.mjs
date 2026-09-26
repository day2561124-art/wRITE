import assert from "node:assert/strict";
import {
  buildWorldSimulationListenerSocialInterpretationContract,
  buildWorldSimulationListenerSocialInterpretationResolverView,
  projectWorldSimulationListenerSocialInterpretations,
} from "../../server/src/world-simulation-listener-social-interpretation-service.mjs";

function understanding(observer, interpretedContent = "對方說我做得不錯") {
  return {
    version: "cc6c-listener-speech-understanding-v1",
    observer,
    character_views: [{
      interpreted_content: interpretedContent,
      interpreted_interaction_function: "evaluation",
      listener_understanding_attested: true,
      speech_content_intelligible: true,
    }],
    audit: { decisions: [{
      speech_candidate_id: "listener_speech_shared",
      source_action_id: "communication_shared",
      source_speaker: "speaker_world_only",
      reception_verified: true,
    }] },
  };
}

function recognition(observer, perceivedSpeaker, recognized = true) {
  return {
    version: "cc6d-speaker-identification-v1",
    observer,
    character_view: {
      observer,
      understood_testimony_receipts: recognized ? [{
        schema_version: "cc2-listener-understood-utterance-v1",
        kind: "understood_utterance",
        observer,
        speaker: perceivedSpeaker,
        source_action_id: "communication_shared",
        semantic_content: "對方說我做得不錯",
        speech_content_intelligible: true,
        speaker_identity_recognized: true,
      }] : [],
    },
    audit: {},
  };
}

const contract = buildWorldSimulationListenerSocialInterpretationContract();
assert.equal(contract.direct_relationship_write_allowed, false);
assert.equal(contract.mistaken_speaker_attribution_preserved, true);
assert.equal(contract.ambiguous_or_no_interpretation_allowed, true);

const friendly = buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "B",
  listener_understanding_projection: understanding("B"),
  speaker_recognition_projection: recognition("B", "perceived_A"),
});
const sarcastic = buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "C",
  listener_understanding_projection: understanding("C"),
  speaker_recognition_projection: recognition("C", "perceived_A"),
});
const unheardUnderstanding = {
  ...understanding("D"),
  character_views: [],
  audit: { decisions: [] },
};
const unnoticed = buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "D",
  listener_understanding_projection: unheardUnderstanding,
  speaker_recognition_projection: recognition("D", null, false),
});
const unrecognized = buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "F",
  listener_understanding_projection: understanding("F"),
  speaker_recognition_projection: recognition("F", null, false),
});
assert.equal(unrecognized.resolver_view.candidates.length, 0);
assert.equal(friendly.resolver_view.candidates.length, 1);
assert.equal(sarcastic.resolver_view.candidates.length, 1);
assert.equal(unnoticed.resolver_view.candidates.length, 0);
assert.equal(
  JSON.stringify(friendly.resolver_view).includes("speaker_world_only"), false,
);
assert.equal(
  JSON.stringify(friendly.resolver_view).includes("communication_shared"), false,
);
const bRef = friendly.resolver_view.candidates[0].evidence_ref;
const cRef = sarcastic.resolver_view.candidates[0].evidence_ref;
assert.notEqual(bRef, cRef);
const b = projectWorldSimulationListenerSocialInterpretations({
  assembly: friendly,
  decisions: [{
    evidence_ref: bRef,
    interpretation_kind: "affiliative",
    social_meaning: "B 覺得這是友善的肯定",
  }],
});
const c = projectWorldSimulationListenerSocialInterpretations({
  assembly: sarcastic,
  decisions: [{
    evidence_ref: cRef,
    interpretation_kind: "adverse",
    social_meaning: "C 覺得這是在挖苦",
  }],
});
const d = projectWorldSimulationListenerSocialInterpretations({
  assembly: unnoticed,
  decisions: [],
});
assert.equal(b.character_view.social_interpretations[0].observer, "B");
assert.equal(c.character_view.social_interpretations[0].observer, "C");
assert.equal(b.character_view.social_interpretations[0].relationship_updated, false);
assert.equal(b.character_view.social_interpretations[0].world_truth_claimed, false);
assert.equal(d.character_view.social_interpretations.length, 0);
assert.deepEqual(
  projectWorldSimulationListenerSocialInterpretations({
    assembly: friendly,
    decisions: [{
      evidence_ref: bRef,
      interpretation_kind: "affiliative",
      social_meaning: "B 覺得這是友善的肯定",
    }],
  }), b,
);

const mistaken = buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "E",
  listener_understanding_projection: understanding("E"),
  speaker_recognition_projection: recognition("E", "mistaken_X"),
});
assert.equal(mistaken.resolver_view.candidates[0].perceived_speaker, "mistaken_X");
assert.equal(
  projectWorldSimulationListenerSocialInterpretations({
    assembly: mistaken,
    decisions: [{
      evidence_ref: mistaken.resolver_view.candidates[0].evidence_ref,
      interpretation_kind: "ambiguous",
      social_meaning: "E 暫時無法判斷對方用意",
    }],
  }).character_view.social_interpretations[0].actual_speaker_identity_known,
  false,
);

const decline = projectWorldSimulationListenerSocialInterpretations({
  assembly: friendly,
  decisions: [{ evidence_ref: bRef, interpretation_kind: "no_interpretation" }],
});
assert.equal(decline.audit.interpretation_count, 0);
for (const decisions of [
  [{ evidence_ref: cRef, interpretation_kind: "affiliative", social_meaning: "cross observer" }],
  [{ evidence_ref: bRef, interpretation_kind: "affiliative", social_meaning: "a", trust_delta: 5 }],
  [{ evidence_ref: bRef, interpretation_kind: "no_interpretation", social_meaning: "forced" }],
  [{ evidence_ref: bRef, interpretation_kind: "affiliative", social_meaning: "a" },
    { evidence_ref: bRef, interpretation_kind: "adverse", social_meaning: "b" }],
]) {
  assert.throws(
    () => projectWorldSimulationListenerSocialInterpretations({ assembly: friendly, decisions }),
  );
}
assert.throws(() => buildWorldSimulationListenerSocialInterpretationResolverView({
  observer: "B",
  listener_understanding_projection: understanding("B"),
  speaker_recognition_projection: recognition("C", "perceived_A"),
}), /same-observer/);

console.log("CB-C4 listener social interpretation evidence tests passed.");
