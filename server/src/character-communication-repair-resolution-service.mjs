import { hashAgentRunValue } from "./agent-run-service.mjs";

export const characterCommunicationRepairResolutionVersion =
  "cc6j-listener-repair-resolution-evidence-v1";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const cloneJson = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value, limit = 240) =>
  typeof value === "string" && value.trim() && [...value.trim()].length <= limit
    ? value.trim()
    : null;

const allowedDecisionFields = new Set([
  "repair_resolution_candidate_id",
  "resolution_status",
]);

function emittedSpeech(outcome, actor, actionId) {
  return record(outcome)
    && outcome.actor === actor
    && outcome.action_id === actionId
    && outcome.result === "communication_emitted"
    && record(outcome.communication_event)
    && outcome.communication_event.channel === "speech"
    && outcome.communication_event.surface_realization_complete === true;
}

export function buildCharacterCommunicationRepairResolutionResolverView(
  input = {},
) {
  const observer = text(input.observer);
  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection
    : {};
  if (!observer
    || understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer
    || !record(understanding.audit)) {
    throw new Error(
      "CC-6J requires canonical same-observer CC-6C understanding.",
    );
  }

  const views = list(understanding.character_views);
  const decisions = list(understanding.audit.decisions);
  if (views.length !== decisions.length || decisions.length > 16) {
    throw new Error(
      "CC-6J requires aligned bounded listener interpretation and audit.",
    );
  }

  const historyTurns = list(input.world_history?.turns);
  const characterState = record(input.character_state)
    ? input.character_state
    : {};
  const resolverCandidates = [];
  const engineCandidates = [];
  const skipped = [];

  for (let index = 0; index < decisions.length; index += 1) {
    const audit = record(decisions[index]) ? decisions[index] : {};
    const view = record(views[index]) ? views[index] : {};
    const speechCandidateId = text(audit.speech_candidate_id, 120);
    const sourceTurnId = text(audit.source_turn_id, 160);
    const responseActionId = text(audit.source_action_id, 120);
    const responseSpeaker = text(audit.source_speaker);
    const interpretedResponse = text(view.interpreted_content, 600);

    if (!speechCandidateId
      || !sourceTurnId
      || !responseActionId
      || !responseSpeaker
      || responseSpeaker === observer
      || audit.reception_verified !== true
      || view.observer !== observer
      || view.speech_content_intelligible !== true
      || view.listener_understanding_attested !== true
      || !interpretedResponse) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "current_response_not_attested",
      });
      continue;
    }

    const responseTurnMatches = historyTurns
      .map((turn, turnIndex) => ({ turn, turnIndex }))
      .filter(({ turn }) => turn?.turn_id === sourceTurnId);
    if (responseTurnMatches.length !== 1) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "response_turn_not_unique",
      });
      continue;
    }
    const { turn: responseTurn, turnIndex: responseTurnIndex } =
      responseTurnMatches[0];

    const emittedResponses = list(responseTurn.action_outcomes).filter(
      (outcome) => emittedSpeech(
        outcome,
        responseSpeaker,
        responseActionId,
      ),
    );
    const responseLineage = list(
      responseTurn.communication_repair_response_projections,
    ).flatMap((projection) =>
      projection?.character === responseSpeaker
        && projection?.version === "cc6i-original-speaker-repair-response-v1"
        ? list(projection.audit?.decisions)
          .filter((entry) =>
            entry?.proposed_response_action_id === responseActionId)
        : []);

    if (emittedResponses.length !== 1 || responseLineage.length !== 1) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "committed_repair_response_not_unique",
      });
      continue;
    }

    const repairActionId = text(responseLineage[0].repair_action_id, 120);
    const originalActionId = text(responseLineage[0].original_action_id, 120);
    if (!repairActionId || !originalActionId) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "repair_lineage_ids_missing",
      });
      continue;
    }

    const priorTurns = historyTurns.slice(0, responseTurnIndex);
    const repairMatches = [];
    for (let turnIndex = 0; turnIndex < priorTurns.length; turnIndex += 1) {
      const turn = priorTurns[turnIndex];
      const emittedRepairs = list(turn?.action_outcomes).filter(
        (outcome) => emittedSpeech(outcome, observer, repairActionId),
      );
      const repairAuditMatches = list(
        turn?.communication_repair_speech_action_projections,
      ).flatMap((projection) =>
        projection?.character === observer
          && projection?.version === "cc6h-listener-repair-speech-action-v1"
          ? list(projection.audit?.decisions).filter((entry) =>
            entry?.proposed_action_id === repairActionId
            && entry?.source_action_id === originalActionId)
          : []);
      if (emittedRepairs.length === 1 && repairAuditMatches.length === 1) {
        repairMatches.push({ turnIndex });
      }
    }
    if (repairMatches.length !== 1) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "observer_repair_request_not_unique",
      });
      continue;
    }

    const repairTurnIndex = repairMatches[0].turnIndex;
    const originalMatches = priorTurns
      .slice(0, repairTurnIndex)
      .flatMap((turn) =>
        list(turn?.action_outcomes).filter(
          (outcome) => emittedSpeech(
            outcome,
            responseSpeaker,
            originalActionId,
          ),
        ));
    if (originalMatches.length !== 1) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: "original_speaker_lineage_not_verified",
      });
      continue;
    }

    const voiceMatches = list(
      characterState.communication_voice_identity_evidence,
    ).filter((entry) =>
      record(entry)
      && entry.active !== false
      && entry.observer === observer
      && entry.source_speaker === responseSpeaker
      && entry.evidence_kind === "familiar_voice"
      && entry.identity_status === "identified"
      && text(entry.perceived_speaker)
      && entry.perceived_speaker !== observer);

    if (voiceMatches.length !== 1) {
      skipped.push({
        speech_candidate_id: speechCandidateId,
        status: voiceMatches.length === 0
          ? "response_speaker_identity_not_recognized"
          : "ambiguous_response_speaker_identity",
      });
      continue;
    }

    const candidateId =
      "cc6j_resolution_"
      + hashAgentRunValue({
        version: characterCommunicationRepairResolutionVersion,
        observer,
        speech_candidate_id: speechCandidateId,
        response_action_id: responseActionId,
        repair_action_id: repairActionId,
        original_action_id: originalActionId,
      }).slice(0, 24);

    resolverCandidates.push({
      repair_resolution_candidate_id: candidateId,
      observer,
      perceived_response_speaker: voiceMatches[0].perceived_speaker,
      interpreted_response: interpretedResponse,
      interpretation_is_subjective: true,
      perceived_response_speaker_attribution_is_subjective: true,
      prior_repair_request_owned_by_observer: true,
      response_from_same_original_speaker_lineage_verified: true,
      resolution_requires_explicit_listener_attestation: true,
      mutual_understanding_claimed: false,
      grounding_claimed: false,
      world_truth_claimed: false,
    });
    engineCandidates.push({
      repair_resolution_candidate_id: candidateId,
      speech_candidate_id: speechCandidateId,
      response_action_id: responseActionId,
      repair_action_id: repairActionId,
      original_action_id: originalActionId,
      response_speaker: responseSpeaker,
      perceived_response_speaker: voiceMatches[0].perceived_speaker,
      interpreted_response: interpretedResponse,
    });
  }

  return cloneJson({
    version: characterCommunicationRepairResolutionVersion,
    observer,
    resolver_view: {
      version: characterCommunicationRepairResolutionVersion,
      observer,
      resolution_candidates: resolverCandidates,
      boundary: {
        current_audibility_required: true,
        current_listener_interpretation_required: true,
        committed_cc6i_response_required: true,
        observer_owned_prior_repair_required: true,
        same_original_speaker_lineage_required: true,
        explicit_voice_identity_required: true,
        engine_action_ids_exposed: false,
        source_engine_identity_exposed: false,
        automatic_resolution_forbidden: true,
        automatic_repair_reinitiation_forbidden: true,
        mutual_understanding_claimed: false,
        grounding_claimed: false,
        world_truth_claimed: false,
      },
    },
    engine_context: {
      candidates: engineCandidates,
      skipped,
    },
  });
}

export function projectCharacterCommunicationRepairResolution(input = {}) {
  const assembly = record(input.assembly) ? input.assembly : {};
  if (assembly.version !== characterCommunicationRepairResolutionVersion
    || !record(assembly.resolver_view)
    || !record(assembly.engine_context)
    || assembly.resolver_view.observer !== assembly.observer) {
    throw new Error(
      "CC-6J requires canonical repair resolution resolver assembly.",
    );
  }

  if (!Array.isArray(input.decisions) || input.decisions.length > 16) {
    throw new Error(
      "CC-6J resolution decisions must be a bounded array.",
    );
  }

  const byId = new Map(
    list(assembly.engine_context.candidates)
      .map((entry) => [entry.repair_resolution_candidate_id, entry]),
  );
  const visibleById = new Map(
    list(assembly.resolver_view.resolution_candidates)
      .map((entry) => [entry.repair_resolution_candidate_id, entry]),
  );
  const seen = new Set();
  const evidence = [];
  const audits = [];

  for (const decision of input.decisions) {
    if (!record(decision)
      || Object.keys(decision)
        .some((field) => !allowedDecisionFields.has(field))) {
      throw new Error(
        "CC-6J rejects foreign or hidden resolution decision fields.",
      );
    }

    const candidateId = text(
      decision.repair_resolution_candidate_id,
      120,
    );
    if (!candidateId || seen.has(candidateId)) {
      throw new Error(
        "CC-6J resolution decision must reference one unique candidate.",
      );
    }
    seen.add(candidateId);

    const engine = byId.get(candidateId);
    const visible = visibleById.get(candidateId);
    if (!engine || !visible
      || visible.perceived_response_speaker
        !== engine.perceived_response_speaker) {
      throw new Error(
        "CC-6J resolution decision references an unknown candidate.",
      );
    }

    const status = text(decision.resolution_status, 40);
    if (!["resolved", "still_trouble"].includes(status)) {
      throw new Error(
        "CC-6J resolution status must be resolved or still_trouble.",
      );
    }

    evidence.push({
      schema_version: characterCommunicationRepairResolutionVersion,
      observer: assembly.observer,
      perceived_response_speaker: engine.perceived_response_speaker,
      interpreted_response: engine.interpreted_response,
      resolution_status: status,
      repair_resolved_attested: status === "resolved",
      still_trouble_attested: status === "still_trouble",
      listener_attestation_subjective_only: true,
      response_semantic_equivalence_verified: false,
      mutual_understanding_claimed: false,
      common_ground_updated: false,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    });
    audits.push({
      repair_resolution_candidate_id: candidateId,
      speech_candidate_id: engine.speech_candidate_id,
      response_action_id: engine.response_action_id,
      repair_action_id: engine.repair_action_id,
      original_action_id: engine.original_action_id,
      response_speaker: engine.response_speaker,
      resolution_status: status,
      repair_resolved_attested: status === "resolved",
      still_trouble_attested: status === "still_trouble",
      automatic_repair_reinitiation_performed: false,
      mutual_understanding_claimed: false,
      grounding_claimed: false,
      world_truth_claimed: false,
    });
  }

  return cloneJson({
    version: characterCommunicationRepairResolutionVersion,
    observer: assembly.observer,
    character_view: {
      observer: assembly.observer,
      repair_resolution_evidence: evidence,
      subjective_resolution_only: true,
      mutual_understanding_claimed: false,
      grounding_claimed: false,
      world_truth_claimed: false,
    },
    audit: {
      candidate_count: list(assembly.engine_context.candidates).length,
      decision_count: input.decisions.length,
      evidence_count: evidence.length,
      decisions: audits,
      resolved_speech_candidate_ids: audits
        .filter((entry) => entry.resolution_status === "resolved")
        .map((entry) => entry.speech_candidate_id),
      no_decision_means_no_resolution_evidence: true,
      still_trouble_does_not_auto_reinitiate_repair: true,
      resolved_does_not_establish_mutual_grounding: true,
      belief_update_performed: false,
      world_truth_claimed: false,
      grounding_claimed: false,
    },
  });
}
