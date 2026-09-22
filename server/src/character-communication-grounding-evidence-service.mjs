import { hashAgentRunValue } from "./agent-run-service.mjs";

export const characterCommunicationGroundingEvidenceVersion =
  "cc6e-bounded-conversational-grounding-evidence-v1";

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

/**
 * CC-6E derives bounded conversational-grounding EVIDENCE only.
 *
 * It combines two claims made by the same listener:
 * 1) CC-6C: "this is what I understood, including the interaction function";
 * 2) CC-6D: "this is who I think the speaker was".
 *
 * Neither claim is upgraded into semantic equivalence, speaker intent, mutual
 * understanding, agreement, belief, common ground, or World truth. The result
 * is deliberately useful to later grounding/repair policy while remaining
 * defeasible and observer-specific.
 */
export function projectCharacterCommunicationGroundingEvidence(input = {}) {
  const observer = text(input.observer, 240);
  if (!observer) throw new Error("CC-6E requires observer.");

  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection
    : {};
  const recognition = record(input.speaker_recognition_projection)
    ? input.speaker_recognition_projection
    : {};

  if (understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer
    || !record(understanding.audit)) {
    throw new Error("CC-6E requires canonical same-observer CC-6C understanding.");
  }
  if (recognition.version !== "cc6d-speaker-identification-v1"
    || recognition.observer !== observer
    || !record(recognition.character_view)
    || !record(recognition.audit)) {
    throw new Error("CC-6E requires canonical same-observer CC-6D recognition.");
  }

  const views = list(understanding.character_views);
  const decisions = list(understanding.audit.decisions);
  if (views.length !== decisions.length) {
    throw new Error("CC-6E requires aligned CC-6C character views and engine audits.");
  }

  const receipts = list(
    recognition.character_view.understood_testimony_receipts,
  );
  const evidence = [];
  const audits = [];

  for (let index = 0; index < views.length; index += 1) {
    const view = record(views[index]) ? views[index] : {};
    const decision = record(decisions[index]) ? decisions[index] : {};
    const sourceActionId = text(decision.source_action_id, 240);
    const interpretedContent = text(view.interpreted_content, 600);
    const interactionFunction = text(
      view.interpreted_interaction_function,
      240,
    );

    const baseAudit = {
      speech_candidate_id: decision.speech_candidate_id ?? null,
      source_action_id: sourceActionId,
      reception_verified: decision.reception_verified === true,
      listener_understanding_attested:
        view.listener_understanding_attested === true,
      speech_content_intelligible:
        view.speech_content_intelligible === true,
      interaction_function_interpreted:
        interactionFunction !== null,
      source_engine_identity_exposed_to_character: false,
      speaker_hidden_intent_exposed: false,
      semantic_equivalence_verified: false,
      mutual_understanding_claimed: false,
      agreement_inferred: false,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    };

    if (!sourceActionId
      || !interpretedContent
      || !interactionFunction
      || decision.reception_verified !== true
      || view.listener_understanding_attested !== true
      || view.speech_content_intelligible !== true) {
      audits.push({
        ...baseAudit,
        status: "insufficient_listener_grounding_evidence",
      });
      continue;
    }

    const matches = receipts.filter((receipt) =>
      record(receipt)
      && receipt.schema_version === "cc2-listener-understood-utterance-v1"
      && receipt.kind === "understood_utterance"
      && receipt.observer === observer
      && receipt.source_action_id === sourceActionId
      && receipt.semantic_content === interpretedContent
      && receipt.speech_content_intelligible === true
      && receipt.speaker_identity_recognized === true
      && text(receipt.speaker, 240)
    );

    if (matches.length !== 1) {
      audits.push({
        ...baseAudit,
        status: matches.length === 0
          ? "same_observer_speaker_recognition_missing"
          : "same_observer_speaker_recognition_ambiguous",
      });
      continue;
    }

    const receipt = matches[0];
    const perceivedSpeaker = text(receipt.speaker, 240);
    const evidenceId = `cc6e_grounding_evidence_${hashAgentRunValue({
      version: characterCommunicationGroundingEvidenceVersion,
      observer,
      speech_candidate_id: decision.speech_candidate_id ?? null,
      source_action_id: sourceActionId,
      interpreted_content: interpretedContent,
      interpreted_interaction_function: interactionFunction,
      perceived_speaker: perceivedSpeaker,
    }).slice(0, 24)}`;

    evidence.push({
      schema_version: characterCommunicationGroundingEvidenceVersion,
      grounding_evidence_id: evidenceId,
      kind: "subjective_conversational_grounding_evidence",
      observer,
      perceived_speaker: perceivedSpeaker,
      interpreted_content: interpretedContent,
      interpreted_interaction_function: interactionFunction,
      evidence_basis: [
        "same_observer_listener_authored_understanding",
        "same_observer_subjective_speaker_recognition",
      ],
      interpretation_subjective: true,
      speaker_attribution_subjective: true,
      semantic_equivalence_verified: false,
      mutual_understanding_claimed: false,
      agreement_inferred: false,
      belief_updated: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    });

    audits.push({
      ...baseAudit,
      status: "bounded_grounding_evidence_available",
      grounding_evidence_id: evidenceId,
      perceived_speaker: perceivedSpeaker,
      speaker_attribution_subjective: true,
    });
  }

  return {
    version: characterCommunicationGroundingEvidenceVersion,
    observer,
    character_view: {
      observer,
      grounding_evidence: cloneJson(evidence),
      grounding_evidence_available: evidence.length > 0,
      grounding_claimed: false,
      mutual_understanding_claimed: false,
      agreement_inferred: false,
      belief_updated: false,
      world_truth_claimed: false,
    },
    audit: {
      understanding_decision_count: decisions.length,
      speaker_recognition_receipt_count: receipts.length,
      evidence_count: evidence.length,
      decisions: audits,
      same_observer_evidence_required: true,
      interaction_function_interpretation_required: true,
      speaker_hidden_intent_exposed: false,
      semantic_equivalence_verified: false,
      mutual_understanding_claimed: false,
      agreement_inferred: false,
      repair_automatically_triggered: false,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
  };
}

export function buildCharacterCommunicationGroundingEvidenceContract() {
  return {
    version: characterCommunicationGroundingEvidenceVersion,
    owner: "same_listener_bounded_conversational_grounding_evidence",
    input_requires_cc6c_understanding: true,
    input_requires_cc6d_same_observer_speaker_recognition: true,
    interaction_function_interpretation_required: true,
    interaction_function_is_listener_subjective: true,
    speaker_attribution_is_listener_subjective: true,
    evidence_is_defeasible: true,
    semantic_equivalence_verified: false,
    speaker_hidden_intent_exposed: false,
    mutual_understanding_claimed: false,
    agreement_inferred: false,
    repair_automatically_triggered: false,
    belief_update_performed: false,
    world_truth_claimed: false,
    grounding_claimed: false,
  };
}
