import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationListenerSocialInterpretationVersion } from "./world-simulation-listener-social-interpretation-service.mjs";

export const worldSimulationPersonTargetedSocialAppraisalVersion =
  "cb-c4-person-targeted-social-appraisal-v1";

const kinds = new Set(["affiliative", "adverse", "ambivalent", "uncertain", "no_appraisal"]);
const expectedness = new Set(["expected", "unexpected", "uncertain"]);
const significance = new Set(["meaningful", "minor", "uncertain"]);
const contextFields = ["prior_relationship", "expectation", "belief", "affect"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const clone = (value) => JSON.parse(JSON.stringify(value));
function bounded(value, field, maximum = 600) {
  if (typeof value !== "string" || !value.trim() || [...value.trim()].length > maximum) {
    throw new Error(`${field} must be bounded nonempty text.`);
  }
  return value.trim();
}
function contextFor(value) {
  if (value === undefined || value === null) value = {};
  if (!object(value) || Object.keys(value).some((field) => !contextFields.includes(field))) {
    throw new Error("Social appraisal context has unauthorized fields.");
  }
  return Object.fromEntries(contextFields.map((field) => [
    field, value[field] === undefined || value[field] === null
      ? null : bounded(value[field], field, 300),
  ]));
}

/**
 * This pure view reads an already admitted same-listener C4 interpretation.
 * The optional context must be supplied from that observer's own cognition;
 * this service itself does not certify a caller's external context source.
 */
export function buildWorldSimulationPersonTargetedSocialAppraisalResolverView(input = {}) {
  const source = input.social_interpretation_projection;
  const observer = bounded(input.observer, "observer", 240);
  if (!object(source)
    || source.version !== worldSimulationListenerSocialInterpretationVersion
    || source.observer !== observer
    || source.character_view?.observer !== observer
    || source.audit?.relationship_write_performed !== false
    || source.audit?.memory_write_performed !== false
    || source.audit?.world_state_mutation_performed !== false) {
    throw new Error("Appraisal requires a same-observer read-only social interpretation projection.");
  }
  const interpretations = list(source.character_view.social_interpretations);
  if (interpretations.length > 16) throw new Error("Too many social interpretations.");
  const seen = new Set();
  const candidates = interpretations.map((item) => {
    if (!object(item)
      || item.version !== worldSimulationListenerSocialInterpretationVersion
      || item.kind !== "listener_subjective_social_interpretation"
      || item.observer !== observer
      || item.interpretation_subjective !== true
      || item.speaker_attribution_subjective !== true
      || item.actual_speaker_identity_known !== false
      || item.world_truth_claimed !== false
      || item.relationship_updated !== false
      || item.belief_updated !== false
      || item.action_selected !== false) {
      throw new Error("Appraisal source must be bounded subjective listener evidence.");
    }
    const evidenceRef = bounded(item.evidence_ref, "evidence_ref", 120);
    if (seen.has(evidenceRef)) throw new Error("Duplicate appraisal source.");
    seen.add(evidenceRef);
    return {
      evidence_ref: evidenceRef,
      perceived_person: bounded(item.perceived_speaker, "perceived_person", 240),
      interpreted_social_meaning: bounded(item.social_meaning, "social_meaning"),
      interpretation_kind: bounded(item.interpretation_kind, "interpretation_kind", 40),
      subjective_context: contextFor(input.subjective_context),
      target_identity_verified: false,
      hidden_intent_available: false,
      world_truth_available: false,
    };
  });
  const resolverView = {
    version: worldSimulationPersonTargetedSocialAppraisalVersion,
    observer,
    source_projection_hash: hashAgentRunValue(source),
    candidates,
    boundaries: {
      explicit_appraisal_required: true,
      no_appraisal_allowed: true,
      contradictory_evidence_allowed: true,
      subjective_context_source_certified_here: false,
      direct_relationship_or_memory_write_allowed: false,
      world_truth_claimed: false,
    },
  };
  return {
    version: worldSimulationPersonTargetedSocialAppraisalVersion,
    observer,
    source_projection_hash: hashAgentRunValue(source),
    resolver_view: clone(resolverView),
    resolver_view_hash: hashAgentRunValue(resolverView),
  };
}

export function projectWorldSimulationPersonTargetedSocialAppraisals(input = {}) {
  const assembly = input.assembly;
  if (!object(assembly)
    || assembly.version !== worldSimulationPersonTargetedSocialAppraisalVersion
    || assembly.resolver_view?.version !== assembly.version
    || assembly.resolver_view?.observer !== assembly.observer
    || assembly.resolver_view?.source_projection_hash !== assembly.source_projection_hash
    || hashAgentRunValue(assembly.resolver_view) !== assembly.resolver_view_hash) {
    throw new Error("Appraisal requires an exact resolver view.");
  }
  const candidates = list(assembly.resolver_view.candidates);
  if (candidates.length > 16 || new Set(candidates.map((item) => item.evidence_ref)).size !== candidates.length) {
    throw new Error("Appraisal candidates are invalid.");
  }
  const decisions = input.decisions;
  if (!Array.isArray(decisions) || decisions.length > candidates.length) {
    throw new Error("Appraisal decisions must be a bounded array.");
  }
  const byRef = new Map(candidates.map((candidate) => [candidate.evidence_ref, candidate]));
  const seen = new Set();
  const appraisals = [];
  for (const decision of decisions) {
    if (!object(decision) || Object.keys(decision).some((field) =>
      !["evidence_ref", "appraisal_kind", "concern", "expectedness", "significance", "interpretation"].includes(field))) {
      throw new Error("Appraisal decision contains unauthorized fields.");
    }
    const ref = bounded(decision.evidence_ref, "evidence_ref", 120);
    const candidate = byRef.get(ref);
    if (!candidate || seen.has(ref)) throw new Error("Appraisal decision is duplicate or out of view.");
    seen.add(ref);
    if (!kinds.has(decision.appraisal_kind)) throw new Error("Unsupported appraisal kind.");
    if (decision.appraisal_kind === "no_appraisal") {
      if (Object.keys(decision).length !== 2) throw new Error("No-appraisal cannot author an appraisal.");
      continue;
    }
    if (!expectedness.has(decision.expectedness) || !significance.has(decision.significance)) {
      throw new Error("Unsupported appraisal dimension.");
    }
    const body = {
      version: worldSimulationPersonTargetedSocialAppraisalVersion,
      kind: "person_targeted_subjective_social_appraisal",
      observer: assembly.observer,
      evidence_ref: ref,
      perceived_person: candidate.perceived_person,
      source_interpretation_hash: assembly.source_projection_hash,
      appraisal_kind: decision.appraisal_kind,
      concern: bounded(decision.concern, "concern", 300),
      expectedness: decision.expectedness,
      significance: decision.significance,
      interpretation: bounded(decision.interpretation, "interpretation"),
      attribution_subjective: true,
      target_identity_verified: false,
      relationship_updated: false,
      memory_written: false,
      world_truth_claimed: false,
    };
    appraisals.push({ ...body, appraisal_hash: hashAgentRunValue(body) });
  }
  return {
    version: worldSimulationPersonTargetedSocialAppraisalVersion,
    observer: assembly.observer,
    character_view: { observer: assembly.observer, social_appraisals: clone(appraisals) },
    audit: {
      source_projection_hash: assembly.source_projection_hash,
      eligible_count: candidates.length,
      decision_count: decisions.length,
      appraisal_count: appraisals.length,
      relationship_write_performed: false,
      memory_write_performed: false,
      world_state_mutation_performed: false,
    },
  };
}
