import {
  buildCharacterCommunicationActionCandidate,
} from "./character-communication-foundation-service.mjs";

export const characterCommunicationRepairSpeechActionVersion =
  "cc6h-listener-repair-speech-action-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => Array.isArray(v) ? v : [];
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const text = (v, limit = 240) =>
  typeof v === "string" && v.trim() && [...v.trim()].length <= limit
    ? v.trim() : null;

const allowedDecisionFields = new Set([
  "repair_initiation_id", "surface_realization",
]);

/**
 * CC-6H: project only an already listener-authored CC-6F repair request,
 * with a distinct, explicit same-listener familiar-voice identity. A listener
 * may recognize a voice without attesting comprehension; CC-6D's testimony
 * admission stays closed in that situation. Missing/ambiguous evidence must
 * not be replaced with a relationship or an engine source identity.
 */
export function buildCharacterCommunicationRepairSpeechResolverView(input = {}) {
  const observer = text(input.observer);
  const repair = record(input.repair_initiation_projection)
    ? input.repair_initiation_projection : {};
  const understanding = record(input.listener_understanding_projection)
    ? input.listener_understanding_projection : {};
  if (!observer
    || repair.version !== "cc6f-bounded-listener-repair-initiation-v1"
    || repair.observer !== observer
    || understanding.version !== "cc6c-listener-speech-understanding-v1"
    || understanding.observer !== observer
    || !record(repair.audit) || !record(understanding.audit)) {
    throw new Error("CC-6H requires canonical same-listener repair and understanding.");
  }
  const state = record(input.character_state) ? input.character_state : {};
  const understood = list(understanding.audit.decisions);
  const repairs = list(repair.audit.decisions);
  const candidates = list(repair.character_view?.repair_request_candidates);
  if (candidates.length > 16 || repairs.length > 16)
    throw new Error("CC-6H repairs exceed bounded candidate count.");

  const resolverCandidates = [];
  const engineCandidates = [];
  const skipped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const id = text(candidate?.repair_initiation_id, 120);
    if (!id || seen.has(id)
      || candidate.schema_version !== repair.version
      || candidate.observer !== observer
      || candidate.signal_realized !== false
      || candidate.repair_completed !== false) {
      throw new Error("CC-6H requires unique unrealized same-listener repair candidates.");
    }
    seen.add(id);
    const matching = repairs.filter((entry) =>
      entry?.repair_initiation_id === id
      && entry?.status === "bounded_repair_request_candidate");
    if (matching.length !== 1) {
      throw new Error("CC-6H requires one canonical repair audit per candidate.");
    }
    const speech = understood.filter((entry) =>
      entry?.speech_candidate_id === matching[0].speech_candidate_id
      && entry?.source_action_id === matching[0].source_action_id
      && entry?.reception_verified === true);
    if (speech.length !== 1 || !text(speech[0].source_speaker)) {
      skipped.push({ repair_initiation_id: id, reason: "source_reception_not_unique" });
      continue;
    }
    const evidence = list(state.communication_voice_identity_evidence).filter((entry) =>
      record(entry) && entry.active !== false
      && entry.observer === observer
      && entry.evidence_kind === "familiar_voice"
      && entry.identity_status === "identified"
      && entry.source_speaker === speech[0].source_speaker
      && text(entry.perceived_speaker)
      && entry.perceived_speaker !== observer);
    if (evidence.length !== 1) {
      skipped.push({
        repair_initiation_id: id,
        reason: evidence.length ? "ambiguous_voice_identity" : "no_voice_identity",
      });
      continue;
    }
    const meaning = text(candidate.listener_authored_request_meaning, 600);
    if (!meaning) throw new Error("CC-6H request meaning must be bounded.");
    resolverCandidates.push({
      repair_initiation_id: id,
      observer,
      perceived_speaker: evidence[0].perceived_speaker,
      listener_authored_request_meaning: meaning,
      perceived_speaker_attribution_subjective: true,
      repair_completed: false,
      grounding_claimed: false,
    });
    engineCandidates.push({
      repair_initiation_id: id,
      perceived_speaker: evidence[0].perceived_speaker,
      meaning,
      source_action_id: speech[0].source_action_id,
    });
  }
  return {
    version: characterCommunicationRepairSpeechActionVersion,
    observer,
    resolver_view: {
      version: characterCommunicationRepairSpeechActionVersion,
      observer,
      repair_candidates: copy(resolverCandidates),
      boundary: {
        explicit_same_listener_voice_identity_required: true,
        source_engine_identity_exposed: false,
        speaker_semantic_intent_exposed: false,
        same_turn_world_signal_claimed: false,
        repair_completed: false,
      },
    },
    engine_context: { candidates: engineCandidates, skipped },
  };
}

/**
 * Only an explicit speaker-authored Mandarin clause request may turn one
 * repair candidate into a non-binding ordinary CC-1/CC-5 speech action.
 * Character Brain still selects or rejects; World alone emits/propagates it.
 */
export function projectCharacterCommunicationRepairSpeechAction(input = {}) {
  const assembly = record(input.assembly) ? input.assembly : {};
  if (assembly.version !== characterCommunicationRepairSpeechActionVersion
    || !record(assembly.resolver_view)
    || !record(assembly.engine_context)
    || assembly.resolver_view.observer !== assembly.observer) {
    throw new Error("CC-6H requires canonical resolver assembly.");
  }
  const decisions = input.decisions;
  if (!Array.isArray(decisions) || decisions.length > 1)
    throw new Error("CC-6H accepts at most one explicit repair speech decision.");
  const engine = new Map(
    list(assembly.engine_context.candidates)
      .map((entry) => [entry.repair_initiation_id, entry]),
  );
  const actions = [];
  const audits = [];
  for (const decision of decisions) {
    if (!record(decision)
      || Object.keys(decision).some((key) => !allowedDecisionFields.has(key))) {
      throw new Error("CC-6H repair speech decision fields are not allowed.");
    }
    const id = text(decision.repair_initiation_id, 120);
    const target = engine.get(id);
    if (!id || !target
      || !list(assembly.resolver_view.repair_candidates).some(
        (entry) => entry.repair_initiation_id === id
        && entry.perceived_speaker === target.perceived_speaker)) {
      throw new Error("CC-6H repair speech must select one recognized listener candidate.");
    }
    if (!record(decision.surface_realization)
      || decision.surface_realization.schema_version
        !== "cc5-mandarin-clause-request-v1"
      || decision.surface_realization.semantic_anchor !== target.meaning) {
      throw new Error("CC-6H repair speech must supply matching authored Mandarin slots.");
    }
    const action = buildCharacterCommunicationActionCandidate({
      character: assembly.observer,
      cognition: {
        communication_goal: {
          character: assembly.observer,
          purpose: "請求釐清",
          addressee: target.perceived_speaker,
          mode: "direct",
          communication_opportunity: "respond",
          public_content: target.meaning,
          surface_realization: copy(decision.surface_realization),
        },
      },
    });
    if (!action || action.communication?.channel !== "speech"
      || action.communication.surface_realization_complete !== true
      || action.communication.message.semantic_content !== target.meaning) {
      throw new Error("CC-6H requires a fully realized ordinary speech candidate.");
    }
    actions.push(action);
    audits.push({
      repair_initiation_id: id,
      source_action_id: target.source_action_id,
      proposed_action_id: action.action_id,
      perceived_speaker: target.perceived_speaker,
      attribution_subjective: true,
      character_brain_selected: false,
      actual_world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
    });
  }
  return copy({
    version: characterCommunicationRepairSpeechActionVersion,
    observer: assembly.observer,
    action_candidates: actions,
    audit: {
      decision_count: decisions.length,
      proposed_count: actions.length,
      decisions: audits,
      no_identity_means_no_target: true,
      speaker_hidden_intent_exposed: false,
      world_signal_emitted: false,
      repair_completed: false,
      grounding_claimed: false,
    },
  });
}
