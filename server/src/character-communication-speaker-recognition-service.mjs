export const characterCommunicationSpeakerRecognitionVersion =
  "cc6d-speaker-identification-v1";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value, limit = 600) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || [...normalized].length > limit) return null;
  return normalized;
}

function voiceIdentityEvidence(characterState, observer) {
  return list(characterState?.communication_voice_identity_evidence)
    .filter((item) =>
      record(item)
      && item.active !== false
      && item.observer === observer
      && item.evidence_kind === "familiar_voice"
      && item.identity_status === "identified"
      && text(item.source_speaker, 240)
      && text(item.perceived_speaker, 240)
    )
    .map((item, index) => ({
      evidence_index: index,
      source_speaker: text(item.source_speaker, 240),
      perceived_speaker: text(item.perceived_speaker, 240),
      evidence_kind: "familiar_voice",
      identity_status: "identified",
    }));
}

/**
 * CC-6D consumes listener-owned current identity evidence only.
 *
 * source_speaker is an engine-side locator used to select the matching
 * familiar-voice association. It is never copied into the character-facing
 * receipt. perceived_speaker is the listener's own attribution and may be
 * mistaken. Therefore a valid receipt can be a sincere misattribution without
 * becoming World truth.
 */
export function projectCharacterCommunicationSpeakerRecognition(input = {}) {
  const observer = text(input.observer, 240);
  if (!observer) throw new Error("CC-6D requires observer.");

  const characterState = record(input.character_state)
    ? input.character_state
    : {};
  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection
    : {};
  if (understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer
    || !record(understanding.audit)) {
    throw new Error("CC-6D requires canonical same-observer CC-6C understanding.");
  }

  const views = list(understanding.character_views);
  const decisions = list(understanding.audit.decisions);
  if (views.length !== decisions.length) {
    throw new Error("CC-6D requires aligned CC-6C character views and engine audits.");
  }

  const evidence = voiceIdentityEvidence(characterState, observer);
  const receipts = [];
  const audits = [];

  for (let index = 0; index < decisions.length; index += 1) {
    const view = record(views[index]) ? views[index] : {};
    const audit = record(decisions[index]) ? decisions[index] : {};
    const sourceSpeaker = text(audit.source_speaker, 240);
    const sourceActionId = text(audit.source_action_id, 240);

    const baseAudit = {
      speech_candidate_id: audit.speech_candidate_id ?? null,
      source_action_id: sourceActionId,
      source_speaker: sourceSpeaker,
      reception_verified: audit.reception_verified === true,
      listener_understanding_attested: view.listener_understanding_attested === true,
      speech_content_intelligible: view.speech_content_intelligible === true,
      source_engine_identity_exposed_to_character: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    };

    if (!sourceSpeaker || !sourceActionId
      || audit.reception_verified !== true
      || view.listener_understanding_attested !== true
      || view.speech_content_intelligible !== true
      || !text(view.interpreted_content, 600)) {
      audits.push({ ...baseAudit, status: "not_eligible_for_identified_testimony" });
      continue;
    }

    const matches = evidence.filter((item) => item.source_speaker === sourceSpeaker);
    if (matches.length !== 1) {
      audits.push({
        ...baseAudit,
        status: matches.length === 0
          ? "no_identified_familiar_voice_evidence"
          : "ambiguous_identified_familiar_voice_evidence",
      });
      continue;
    }

    const match = matches[0];
    const perceivedSpeaker = match.perceived_speaker;
    const interpretedContent = text(view.interpreted_content, 600);
    const receipt = {
      schema_version: "cc2-listener-understood-utterance-v1",
      kind: "understood_utterance",
      observer,
      channel: "speech",
      speaker: perceivedSpeaker,
      semantic_content: interpretedContent,
      source_action_id: sourceActionId,
      speech_content_intelligible: true,
      speaker_identity_recognized: true,
      public_event_committed: true,
      attribution_source: "same_listener_explicit_familiar_voice_evidence",
      attribution_subjective: true,
      reported_content_truth_inferred: false,
      speaker_private_belief_inferred: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    };
    receipts.push(receipt);
    audits.push({
      ...baseAudit,
      status: "subjective_speaker_identification_admitted",
      evidence_index: match.evidence_index,
      perceived_speaker: perceivedSpeaker,
      perceived_speaker_matches_world_source:
        perceivedSpeaker === sourceSpeaker,
      understood_testimony_issued: true,
    });
  }

  return {
    version: characterCommunicationSpeakerRecognitionVersion,
    observer,
    character_view: {
      observer,
      understood_testimony_receipts: cloneJson(receipts),
      listener_receipt_verified: receipts.length > 0,
      speaker_identity_recognition_source:
        receipts.length > 0 ? "same_listener_explicit_familiar_voice_evidence" : null,
      recognition_is_subjective: true,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
    audit: {
      evidence_record_count: evidence.length,
      decision_count: decisions.length,
      receipt_count: receipts.length,
      decisions: audits,
      source_engine_identity_exposed_to_character: false,
      source_action_id_exposed_only_in_private_cc2_receipt: receipts.length > 0,
      relationship_field_used_as_identity_evidence: false,
      voice_identity_learning_performed: false,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
  };
}

export function buildCharacterCommunicationSpeakerRecognitionContract() {
  return {
    version: characterCommunicationSpeakerRecognitionVersion,
    owner: "same_listener_subjective_speaker_identification",
    input_requires_cc6c_understanding: true,
    explicit_familiar_voice_identification_evidence_required: true,
    relationship_familiarity_is_not_voice_identity_evidence: true,
    source_engine_identity_may_select_private_evidence_record: true,
    source_engine_identity_exposed_to_character: false,
    perceived_speaker_is_listener_attribution: true,
    mistaken_speaker_attribution_allowed: true,
    testimony_content_comes_from_listener_interpretation: true,
    testimony_content_comes_from_speaker_semantic_intent: false,
    understood_testimony_receipt_schema: "cc2-listener-understood-utterance-v1",
    voice_identity_learning_performed: false,
    belief_update_performed: false,
    world_truth_claimed: false,
    grounding_claimed: false,
  };
}
