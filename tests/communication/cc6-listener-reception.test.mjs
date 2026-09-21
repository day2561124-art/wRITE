import assert from "node:assert/strict";
import test from "node:test";
import {
  admitCharacterCommunicationListenerInterpretation,
  characterCommunicationListenerReceptionVersion,
  projectCharacterCommunicationListenerReception,
} from "../../server/src/character-communication-listener-reception-service.mjs";

const speaker = "A";
const observer = "B";
const actionId = "communication_aaaaaaaaaaaaaaaaaaaaaaaa";
const soundId = "cc6-engine-speech-sound";
const content = "男孩已離開房子";
const spoken = "男孩離開了房子。";

function fixture() {
  const scene = {
    scene_id: "cc6-room",
    entity_positions: { A: { x: 0, y: 0 }, B: { x: 2, y: 0 } },
    audibility_profiles: { B: { minimum_audible_db: 35 } },
    sound_events: [{
      sound_id: soundId,
      source_entity_id: speaker,
      communication_action_id: actionId,
      sound_level_db_at_1m: 60,
      generic_auditory_label: "有人發出說話聲",
    }],
  };
  return {
    observer,
    sound_id: soundId,
    scene_id: scene.scene_id,
    scene_state: scene,
    world_state: { scenes: { [scene.scene_id]: scene }, characters: { A: {}, B: {} } },
    committed_outcome: {
      actor: speaker,
      action_id: actionId,
      result: "communication_emitted",
      communication_event: {
        schema_version: "cc1-world-communication-event-v1",
        actor: speaker,
        addressee: observer,
        channel: "speech",
        semantic_content: content,
        surface_text: spoken,
        surface_realization_complete: true,
        surface_realization: {
          source_action_id: actionId,
          surface_text: spoken,
          semantic_anchor: content,
        },
      },
    },
  };
}

function report() {
  return {
    observer, source_action_id: actionId,
    heard_surface: spoken,
    interpreted_content: "對方說男孩已經離開房子",
    perceived_speaker: speaker,
    perceived_speaker_recognized: true,
    speech_content_intelligible: true,
    understanding_attested: true,
  };
}

test("CC-6A admits only linked committed audible sound, not spoken meaning", () => {
  const f = fixture();
  const before = JSON.stringify(f);
  const receipt = projectCharacterCommunicationListenerReception(f);
  assert.equal(JSON.stringify(f), before);
  assert.equal(receipt.schema_version, characterCommunicationListenerReceptionVersion);
  assert.equal(receipt.admission_status, "heard_sound_only");
  assert.equal(receipt.character_view.observer, observer);
  assert.equal(receipt.character_view.perceptual_label, "有人發出說話聲");
  assert.equal(receipt.character_view.speech_content_intelligible, false);
  assert.equal(receipt.character_view.listener_understanding_attested, false);
  assert.equal(receipt.character_view.world_truth_claimed, false);
  assert.equal(receipt.audit.source_action_id, actionId);
  assert.equal(receipt.audit.intelligibility_modeled_by_acoustic_query, false);
  const exposed = JSON.stringify(receipt.character_view);
  for (const hidden of [soundId, actionId, content, spoken, speaker, "received_level_db", "source_position"]) {
    assert.equal(exposed.includes(hidden), false, hidden);
  }
});

test("CC-6A cannot produce a listener receipt from an unregistered or unrelated sound", () => {
  const missing = fixture();
  missing.scene_state.sound_events = [];
  assert.throws(() => projectCharacterCommunicationListenerReception(missing), /action-linked source/);

  const wrongAction = fixture();
  wrongAction.scene_state.sound_events[0].communication_action_id = "another-action";
  assert.throws(() => projectCharacterCommunicationListenerReception(wrongAction), /action-linked source/);

  const wrongSpeaker = fixture();
  wrongSpeaker.scene_state.sound_events[0].source_entity_id = "C";
  assert.throws(() => projectCharacterCommunicationListenerReception(wrongSpeaker), /action-linked source/);

  const duplicate = fixture();
  duplicate.scene_state.sound_events.push({
    sound_id: soundId, sound_level_db_at_1m: 90,
    source_entity_id: "C", communication_action_id: "another-action",
    position: { x: 1, y: 0 },
  });
  assert.throws(() => projectCharacterCommunicationListenerReception(duplicate), /action-linked source/);
});

test("CC-6A does not equate a registered sound with actual audibility", () => {
  const blocked = fixture();
  blocked.scene_state.sound_events[0].sound_level_db_at_1m = 10;
  const receipt = projectCharacterCommunicationListenerReception(blocked);
  assert.equal(receipt.admission_status, "not_audible");
  assert.equal(receipt.character_view, null);
  assert.equal(receipt.audit.audible, false);

  const unconfigured = fixture();
  delete unconfigured.scene_state.audibility_profiles.B;
  const unknown = projectCharacterCommunicationListenerReception(unconfigured);
  assert.equal(unknown.admission_status, "acoustic_evidence_unavailable");
  assert.equal(unknown.character_view, null);
});

test("CC-6A rejects noncommitted and non-realized speech as listener semantic evidence", () => {
  for (const mutate of [
    (f) => { f.committed_outcome.result = "blocked"; },
    (f) => { f.committed_outcome.communication_event.channel = "nonverbal"; },
    (f) => { f.committed_outcome.communication_event.surface_realization_complete = false; },
    (f) => { f.committed_outcome.communication_event.surface_realization.source_action_id = "wrong"; },
    (f) => { f.committed_outcome.communication_event.surface_realization.semantic_anchor = "other"; },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => projectCharacterCommunicationListenerReception(f), /committed, realized speech/);
  }
});

test("CC-6A admits subjective interpretation without certifying source truth or shared grounding", () => {
  const reception = projectCharacterCommunicationListenerReception(fixture());
  const ownReport = report();
  const before = JSON.stringify(reception);
  const interpreted = admitCharacterCommunicationListenerInterpretation(reception, ownReport);
  assert.equal(JSON.stringify(reception), before);
  assert.equal(interpreted.admission_status, "listener_interpretation_reported");
  assert.equal(interpreted.character_view.heard_surface, spoken);
  assert.equal(interpreted.character_view.interpreted_content, ownReport.interpreted_content);
  assert.equal(interpreted.character_view.listener_understanding_attested, true);
  assert.equal(interpreted.character_view.belief_updated, false);
  assert.equal(interpreted.character_view.grounding_claimed, false);
  assert.equal(interpreted.audit.understood_testimony_issued, false);
  assert.equal(interpreted.audit.interpretation_equivalence_verified, false);
});

test("CC-6A permits mistaken or uncertain listener interpretation as subjective evidence", () => {
  const reception = projectCharacterCommunicationListenerReception(fixture());
  const mistaken = {
    ...report(),
    heard_surface: "男孩離開了嗎？",
    interpreted_content: "對方可能正在問我",
    perceived_speaker: "C",
    speech_content_intelligible: false,
    understanding_attested: false,
  };
  const interpreted = admitCharacterCommunicationListenerInterpretation(reception, mistaken);
  assert.equal(interpreted.character_view.heard_surface, mistaken.heard_surface);
  assert.equal(interpreted.character_view.perceived_speaker, "C");
  assert.equal(interpreted.character_view.listener_understanding_attested, false);
  assert.equal(interpreted.audit.interpretation_equivalence_verified, false);
});

test("CC-6A refuses cross-observer reports, foreign actions, and ungrounded comprehension", () => {
  const reception = projectCharacterCommunicationListenerReception(fixture());
  assert.throws(
    () => admitCharacterCommunicationListenerInterpretation(reception, {...report(), observer: "C"}),
    /another observer/,
  );
  assert.throws(
    () => admitCharacterCommunicationListenerInterpretation(reception, {...report(), source_action_id: "other"}),
    /source action/,
  );
  assert.throws(
    () => admitCharacterCommunicationListenerInterpretation(reception, {...report(), speech_content_intelligible: false}),
    /reported unintelligible/,
  );
  assert.throws(
    () => admitCharacterCommunicationListenerInterpretation(reception, {...report(), perceived_speaker_recognized: false}),
    /explicit listener recognition/,
  );
  assert.throws(
    () => admitCharacterCommunicationListenerInterpretation(
      { ...reception, admission_status: "not_audible" }, report(),
    ),
    /audible-speech evidence/,
  );
});

console.log("CC-6A bounded listener reception and interpretation tests passed.");
