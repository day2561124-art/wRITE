import { hashAgentRunValue } from "./agent-run-service.mjs";

export const characterCommunicationRepairInitiationVersion =
  "cc6f-bounded-listener-repair-initiation-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value, limit = 240) =>
  typeof value === "string" && value.trim() && [...value.trim()].length <= limit
    ? value.trim() : null;

// These names describe the bounded interface, not an exhaustive taxonomy of
// human conversational trouble or a psychological threshold.
const troubleKinds = new Set(["hearing", "reference", "meaning"]);
const requestFunctions = new Set(["repeat", "specify_reference", "clarify"]);
const decisionFields = new Set([
  "speech_candidate_id", "initiate", "trouble_kind", "request_function",
  "listener_authored_request_meaning",
]);

/**
 * CC-6F contract slice: an observer can CHOOSE to initiate a repair request
 * about a previously heard utterance. Produces an unrealized communication
 * candidate, not a World signal, repair success, grounding, speaker intent,
 * or automatic belief update. The next native-loop slice must route the
 * candidate through the existing speaker action/World/perception boundary.
 */
export function projectCharacterCommunicationRepairInitiation(input = {}) {
  const observer = text(input.observer);
  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection : {};
  if (!observer || understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer || !record(understanding.audit)) {
    throw new Error("CC-6F requires canonical same-observer CC-6C understanding.");
  }

  const views = list(understanding.character_views);
  const audits = list(understanding.audit.decisions);
  if (views.length !== audits.length) {
    throw new Error("CC-6F requires aligned listener views and engine audits.");
  }
  const candidates = new Map();
  for (let index = 0; index < audits.length; index += 1) {
    const audit = audits[index];
    const view = views[index];
    const id = text(audit?.speech_candidate_id, 120);
    if (!id || candidates.has(id) || !record(view)) {
      throw new Error("CC-6F requires unique canonical speech candidates.");
    }
    candidates.set(id, { audit, view });
  }

  const decisions = list(input.decisions);
  if (!Array.isArray(input.decisions) || decisions.length > 16) {
    throw new Error("CC-6F decisions must be a bounded list.");
  }
  const seen = new Set();
  const requests = [];
  const decisionAudit = [];
  for (const decision of decisions) {
    if (!record(decision) || Object.keys(decision).some((key) => !decisionFields.has(key))) {
      throw new Error("CC-6F accepts only listener-authored repair decision fields.");
    }
    const id = text(decision.speech_candidate_id, 120);
    if (!id || seen.has(id) || !candidates.has(id)) {
      throw new Error("CC-6F repair decision must name one unique heard speech candidate.");
    }
    seen.add(id);
    const { audit, view } = candidates.get(id);
    if (audit.reception_verified !== true || view.observer !== observer) {
      throw new Error("CC-6F cannot initiate from another listener or unheard speech.");
    }
    if (decision.initiate !== true && decision.initiate !== false) {
      throw new Error("CC-6F requires an explicit listener initiation decision.");
    }
    if (decision.initiate === false) {
      decisionAudit.push({ speech_candidate_id: id, status: "listener_declined_repair" });
      continue;
    }
    const trouble = text(decision.trouble_kind, 40);
    const requested = text(decision.request_function, 60);
    const meaning = text(decision.listener_authored_request_meaning, 600);
    if (!troubleKinds.has(trouble) || !requestFunctions.has(requested) || !meaning) {
      throw new Error("CC-6F repair initiation needs bounded trouble, function and listener-authored meaning.");
    }

    const repairId = `cc6f_repair_${hashAgentRunValue({
      version: characterCommunicationRepairInitiationVersion,
      observer, speech_candidate_id: id, trouble, requested, meaning,
    }).slice(0, 24)}`;
    requests.push({
      schema_version: characterCommunicationRepairInitiationVersion,
      repair_initiation_id: repairId,
      kind: "listener_authored_repair_request_candidate",
      observer,
      trouble_kind: trouble,
      request_function: requested,
      listener_authored_request_meaning: meaning,
      // A speech candidate is not an utterance, action, or World signal.
      signal_realized: false,
      source_action_id_exposed: false,
      speaker_hidden_intent_exposed: false,
      listener_inference_is_world_truth: false,
      repair_completed: false,
      grounding_claimed: false,
      belief_updated: false,
    });
    decisionAudit.push({
      speech_candidate_id: id,
      source_action_id: audit.source_action_id ?? null,
      repair_initiation_id: repairId,
      status: "bounded_repair_request_candidate",
      source_engine_identity_exposed_to_character: false,
      actual_world_signal_emitted: false,
    });
  }

  return copy({
    version: characterCommunicationRepairInitiationVersion,
    observer,
    character_view: {
      observer,
      repair_request_candidates: requests,
      repair_requested_by_listener: requests.length > 0,
      actual_world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
      belief_updated: false,
    },
    audit: {
      decision_count: decisions.length,
      candidate_count: requests.length,
      decisions: decisionAudit,
      same_observer_reception_required: true,
      listener_choice_required: true,
      source_engine_identity_exposed: false,
      speaker_hidden_intent_exposed: false,
      repair_automatically_triggered: false,
      actual_world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
      belief_update_performed: false,
    },
  });
}

export function buildCharacterCommunicationRepairInitiationContract() {
  return {
    version: characterCommunicationRepairInitiationVersion,
    owner: "same_listener_bounded_repair_request_candidate",
    requires_cc6c_subjective_reception: true,
    requires_explicit_listener_decision: true,
    output_is_unrealized_candidate: true,
    speaker_hidden_intent_exposed: false,
    engine_identity_exposed: false,
    repair_automatically_triggered: false,
    actual_world_signal_emitted: false,
    repair_completed: false,
    grounding_claimed: false,
    belief_update_performed: false,
  };
}
