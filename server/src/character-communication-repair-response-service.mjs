import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "./character-communication-foundation-service.mjs";

export const characterCommunicationRepairResponseVersion =
  "cc6i-original-speaker-repair-response-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => Array.isArray(v) ? v : [];
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const text = (v, limit = 240) =>
  typeof v === "string" && v.trim() && [...v.trim()].length <= limit ? v.trim() : null;
const decisionFields = new Set([
  "repair_response_candidate_id", "speaker_authored_response_meaning",
  "surface_realization",
]);

/**
 * CC-6I: World history is used to verify sequence membership, not to teach
 * A what B understood or what A meant. Only a currently received and
 * subjectively interpreted repair question, tied through one committed CC-6H
 * emission to A's own earlier emitted speech, can offer an A-only response
 * opportunity. A may recognize B by explicit voice evidence without that
 * recognition being World truth. No repair success is inferred.
 */
export function buildCharacterCommunicationRepairResponseResolverView(input = {}) {
  const observer = text(input.observer);
  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection : {};
  if (!observer || understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer
    || !record(understanding.audit)) {
    throw new Error("CC-6I requires canonical same-observer CC-6C understanding.");
  }
  const views = list(understanding.character_views);
  const decisions = list(understanding.audit.decisions);
  if (views.length !== decisions.length || decisions.length > 16) {
    throw new Error("CC-6I requires aligned bounded interpretation and audit.");
  }
  const state = record(input.character_state) ? input.character_state : {};
  const turns = list(input.world_history?.turns);
  const resolverCandidates = [];
  const engineCandidates = [];
  const skips = [];

  for (let i = 0; i < decisions.length; i += 1) {
    const heard = decisions[i];
    const view = views[i];
    const sourceActionId = text(heard?.source_action_id, 120);
    const sourceSpeaker = text(heard?.source_speaker);
    const interpretation = text(view?.interpreted_content, 600);
    if (heard?.reception_verified !== true
      || view?.observer !== observer
      || view?.listener_understanding_attested !== true
      || view?.speech_content_intelligible !== true
      || !sourceActionId || !sourceSpeaker || !interpretation) {
      skips.push({ status: "no_attested_current_repair_interpretation" });
      continue;
    }
    // First identify the exact World-emitted repair question in its
    // source turn, then join only its committed CC-6H audit. The audit's
    // original action is still ENGINE-ONLY and must name A's own speech.
    const matchingRepair = turns.flatMap((turn, turnIndex) =>
      turn?.turn_id === heard.source_turn_id
        ? list(turn.communication_repair_speech_action_projections)
          .filter((projection) =>
            projection?.character === sourceSpeaker
            && projection?.version === "cc6h-listener-repair-speech-action-v1")
          .flatMap((projection) => list(projection.audit?.decisions)
            .filter((entry) => entry?.proposed_action_id === sourceActionId)
            .map((entry) => ({ entry, turn, turnIndex })))
        : []);
    if (matchingRepair.length !== 1) {
      skips.push({ status: "not_unique_committed_repair_request" });
      continue;
    }
    const { entry, turn, turnIndex } = matchingRepair[0];
    const emittedQuestion = list(turn.action_outcomes).filter((outcome) =>
      outcome?.actor === sourceSpeaker
      && outcome?.action_id === sourceActionId
      && outcome?.result === "communication_emitted"
      && outcome?.communication_event?.channel === "speech"
      && outcome?.communication_event?.surface_realization_complete === true);
    const originalActionId = text(entry.source_action_id, 120);
    const originals = turns.slice(0, turnIndex).flatMap((prior) =>
      list(prior.action_outcomes).filter((outcome) =>
        outcome?.actor === observer
        && outcome?.action_id === originalActionId
        && outcome?.result === "communication_emitted"
        && outcome?.communication_event?.channel === "speech"
        && outcome?.communication_event?.surface_realization_complete === true));
    if (!originalActionId || emittedQuestion.length !== 1
      || originals.length !== 1) {
      skips.push({ status: "original_speaker_lineage_not_verified" });
      continue;
    }
    const identities = list(state.communication_voice_identity_evidence).filter((e) =>
      record(e) && e.active !== false
      && e.observer === observer && e.source_speaker === sourceSpeaker
      && e.evidence_kind === "familiar_voice"
      && e.identity_status === "identified"
      && text(e.perceived_speaker)
      && e.perceived_speaker !== observer);
    if (identities.length !== 1) {
      skips.push({
        status: identities.length === 0
          ? "repair_speaker_identity_not_recognized"
          : "ambiguous_repair_speaker_identity",
      });
      continue;
    }
    const id = "cc6i_response_" + hashAgentRunValue({
      version: characterCommunicationRepairResponseVersion,
      observer, heard_speech_candidate_id: heard.speech_candidate_id,
      original_action_id: originalActionId, repair_action_id: sourceActionId,
    }).slice(0, 24);
    resolverCandidates.push({
      repair_response_candidate_id: id,
      observer,
      perceived_requester: identities[0].perceived_speaker,
      interpreted_repair_request: interpretation,
      interpretation_is_subjective: true,
      perceived_requester_attribution_is_subjective: true,
      original_speech_owned_by_observer: true,
      response_optional: true,
      repair_completed: false,
      grounding_claimed: false,
    });
    engineCandidates.push({
      repair_response_candidate_id: id,
      perceived_requester: identities[0].perceived_speaker,
      original_action_id: originalActionId,
      repair_action_id: sourceActionId,
    });
  }
  return copy({
    version: characterCommunicationRepairResponseVersion,
    observer,
    resolver_view: {
      version: characterCommunicationRepairResponseVersion,
      observer,
      response_candidates: resolverCandidates,
      boundary: {
        current_actual_audibility_and_subjective_interpretation_required: true,
        same_original_speaker_committed_lineage_required: true,
        explicit_voice_identity_required: true,
        source_engine_action_ids_exposed: false,
        speaker_hidden_intent_exposed: false,
        repair_automatically_triggered: false,
        repair_completed: false,
        grounding_claimed: false,
      },
    },
    engine_context: { candidates: engineCandidates, skipped: skips },
  });
}

/**
 * A explicitly authors the reply meaning AND the CC-5 clause realization.
 * The existing World action proposer, Character Brain selection, and World
 * acoustic propagation keep their exclusive existing authority.
 */
export function projectCharacterCommunicationRepairResponseAction(input = {}) {
  const assembly = record(input.assembly) ? input.assembly : {};
  if (assembly.version !== characterCommunicationRepairResponseVersion
    || !record(assembly.resolver_view)
    || !record(assembly.engine_context)
    || assembly.resolver_view.observer !== assembly.observer) {
    throw new Error("CC-6I requires canonical response resolver assembly.");
  }
  if (!Array.isArray(input.decisions) || input.decisions.length > 1) {
    throw new Error("CC-6I requires at most one speaker-authored response decision.");
  }
  const actions = [];
  const audits = [];
  for (const decision of input.decisions) {
    if (!record(decision)
      || Object.keys(decision).some((field) => !decisionFields.has(field))) {
      throw new Error("CC-6I rejects foreign or hidden response decision fields.");
    }
    const id = text(decision.repair_response_candidate_id, 120);
    const engine = list(assembly.engine_context.candidates)
      .filter((candidate) => candidate.repair_response_candidate_id === id);
    const characterView = list(assembly.resolver_view.response_candidates)
      .filter((candidate) => candidate.repair_response_candidate_id === id);
    if (!id || engine.length !== 1 || characterView.length !== 1
      || characterView[0].perceived_requester !== engine[0].perceived_requester) {
      throw new Error("CC-6I response must select one admitted original-speaker request.");
    }
    const meaning = text(decision.speaker_authored_response_meaning, 600);
    const realization = decision.surface_realization;
    if (!meaning || !record(realization)
      || realization.schema_version !== "cc5-mandarin-clause-request-v1"
      || realization.semantic_anchor !== meaning) {
      throw new Error("CC-6I response requires speaker-authored meaning and matching CC-5 slots.");
    }
    const action = buildCharacterCommunicationActionCandidate({
      character: assembly.observer,
      cognition: {
        communication_goal: {
          character: assembly.observer,
          purpose: "回答對方的釐清問題",
          addressee: engine[0].perceived_requester,
          mode: "direct",
          communication_opportunity: "respond",
          public_content: meaning,
          surface_realization: copy(realization),
        },
      },
    });
    if (!action || action.communication?.channel !== "speech"
      || action.communication.surface_realization_complete !== true
      || action.communication.message?.semantic_content !== meaning) {
      throw new Error("CC-6I requires a fully realized ordinary speech candidate.");
    }
    actions.push(action);
    audits.push({
      repair_response_candidate_id: id,
      original_action_id: engine[0].original_action_id,
      repair_action_id: engine[0].repair_action_id,
      proposed_response_action_id: action.action_id,
      response_speaker: assembly.observer,
      perceived_requester: engine[0].perceived_requester,
      speaker_authored_meaning_only: true,
      character_brain_selected: false,
      world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
    });
  }
  return copy({
    version: characterCommunicationRepairResponseVersion,
    observer: assembly.observer,
    action_candidates: actions,
    audit: {
      proposed_count: actions.length,
      decisions: audits,
      original_speaker_and_committed_repair_required: true,
      response_selection_is_character_brain_owned: true,
      world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
    },
  });
}
