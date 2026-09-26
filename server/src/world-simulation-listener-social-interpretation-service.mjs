import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectCharacterCommunicationGroundingEvidence,
  characterCommunicationGroundingEvidenceVersion,
} from "./character-communication-grounding-evidence-service.mjs";

export const worldSimulationListenerSocialInterpretationVersion =
  "cb-c4-listener-social-interpretation-v1";

const interpretationKinds = new Set([
  "affiliative", "adverse", "ambiguous", "no_interpretation",
]);

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, label, limit = 600) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (!normalized || [...normalized].length > limit) {
    throw new Error(`${label} is missing or out of bounds.`);
  }
  return normalized;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Existing CC-6E is the gate for audible, interpreted, same-listener speech
 * and subjective speaker recognition. The resolver sees only its character
 * evidence, never the CC engine audit or the actual speaker identity.
 */
export function buildWorldSimulationListenerSocialInterpretationResolverView(input = {}) {
  const observer = text(input.observer, "observer", 240);
  const grounding = projectCharacterCommunicationGroundingEvidence({
    observer,
    listener_understanding_projection: input.listener_understanding_projection,
    speaker_recognition_projection: input.speaker_recognition_projection,
  });
  const evidence = list(grounding.character_view.grounding_evidence);
  if (evidence.length > 16) throw new Error("Social interpretation candidate limit exceeded.");
  const candidates = evidence.map((item) => {
    if (item.schema_version !== characterCommunicationGroundingEvidenceVersion
      || item.observer !== observer
      || item.kind !== "subjective_conversational_grounding_evidence"
      || item.speaker_attribution_subjective !== true
      || item.world_truth_claimed !== false) {
      throw new Error("Social interpretation requires bounded same-listener CC-6E evidence.");
    }
    return {
      evidence_ref: text(item.grounding_evidence_id, "evidence_ref", 120),
      perceived_speaker: text(item.perceived_speaker, "perceived_speaker", 240),
      interpreted_content: text(item.interpreted_content, "interpreted_content"),
      interpreted_interaction_function: text(
        item.interpreted_interaction_function, "interpreted_interaction_function", 240,
      ),
      speaker_attribution_subjective: true,
      speaker_intent_available: false,
      world_truth_available: false,
    };
  });
  if (new Set(candidates.map((item) => item.evidence_ref)).size !== candidates.length) {
    throw new Error("Duplicate social interpretation evidence reference.");
  }
  const resolverView = {
    version: worldSimulationListenerSocialInterpretationVersion,
    observer,
    candidates,
    boundaries: {
      no_candidate_means_no_interpretation: true,
      no_decision_means_no_interpretation: true,
      listener_interpretation_is_defeasible: true,
      actual_speaker_identity_exposed: false,
      speaker_private_intent_exposed: false,
      relationship_mutation_allowed: false,
      world_truth_claimed: false,
    },
  };
  const resolverViewHash = hashAgentRunValue(resolverView);
  return {
    version: worldSimulationListenerSocialInterpretationVersion,
    observer,
    resolver_view: clone(resolverView),
    resolver_view_hash: resolverViewHash,
    audit: {
      cc6e_evidence_count: evidence.length,
      cc6e_source_version: characterCommunicationGroundingEvidenceVersion,
      no_relationship_write: true,
    },
  };
}

/**
 * Explicit listener decisions can remain ambiguous or decline interpretation.
 * They cannot author a relationship score, identify the actual speaker,
 * update belief or choose an action.
 */
export function projectWorldSimulationListenerSocialInterpretations(input = {}) {
  const assembly = input.assembly;
  if (!record(assembly)
    || assembly.version !== worldSimulationListenerSocialInterpretationVersion
    || !record(assembly.resolver_view)
    || assembly.resolver_view.version !== assembly.version
    || assembly.resolver_view.observer !== assembly.observer
    || hashAgentRunValue(assembly.resolver_view) !== assembly.resolver_view_hash) {
    throw new Error("Social interpretation requires an exact resolver view.");
  }
  const observer = text(assembly.observer, "observer", 240);
  const candidates = list(assembly.resolver_view.candidates);
  const byRef = new Map(candidates.map((item) => [item.evidence_ref, item]));
  if (byRef.size !== candidates.length || candidates.length > 16) {
    throw new Error("Social interpretation candidates are invalid.");
  }
  const decisions = list(input.decisions);
  if (decisions.length > candidates.length) {
    throw new Error("Social interpretation decision limit exceeded.");
  }
  const seen = new Set();
  const interpretations = [];
  for (const decision of decisions) {
    if (!record(decision)
      || Object.keys(decision).some((key) =>
        !["evidence_ref", "interpretation_kind", "social_meaning"].includes(key))) {
      throw new Error("Social interpretation decision contains unauthorized fields.");
    }
    const evidenceRef = text(decision.evidence_ref, "evidence_ref", 120);
    const candidate = byRef.get(evidenceRef);
    if (!candidate || seen.has(evidenceRef)) {
      throw new Error("Social interpretation decision is duplicate or out of view.");
    }
    seen.add(evidenceRef);
    if (!interpretationKinds.has(decision.interpretation_kind)) {
      throw new Error("Social interpretation kind is invalid.");
    }
    if (decision.interpretation_kind === "no_interpretation") {
      if (decision.social_meaning !== undefined && decision.social_meaning !== null) {
        throw new Error("Declined interpretation cannot author social meaning.");
      }
      continue;
    }
    const meaning = text(decision.social_meaning, "social_meaning");
    interpretations.push({
      version: worldSimulationListenerSocialInterpretationVersion,
      kind: "listener_subjective_social_interpretation",
      observer,
      evidence_ref: evidenceRef,
      perceived_speaker: candidate.perceived_speaker,
      interpretation_kind: decision.interpretation_kind,
      social_meaning: meaning,
      interpretation_subjective: true,
      speaker_attribution_subjective: true,
      actual_speaker_identity_known: false,
      speaker_intent_inferred_as_truth: false,
      world_truth_claimed: false,
      belief_updated: false,
      relationship_updated: false,
      action_selected: false,
    });
  }
  return {
    version: worldSimulationListenerSocialInterpretationVersion,
    observer,
    character_view: { observer, social_interpretations: clone(interpretations) },
    audit: {
      eligible_evidence_count: candidates.length,
      decision_count: decisions.length,
      interpretation_count: interpretations.length,
      no_decision_means_no_interpretation: true,
      relationship_write_performed: false,
      memory_write_performed: false,
      world_state_mutation_performed: false,
    },
  };
}

export function buildWorldSimulationListenerSocialInterpretationContract() {
  return {
    version: worldSimulationListenerSocialInterpretationVersion,
    source: "same_observer_cc6e_grounding_evidence",
    source_requires_prior_audible_interpreted_recognized_speech: true,
    mistaken_speaker_attribution_preserved: true,
    ambiguous_or_no_interpretation_allowed: true,
    listener_decision_required: true,
    direct_relationship_write_allowed: false,
    direct_belief_or_memory_write_allowed: false,
    world_truth_claimed: false,
  };
}
