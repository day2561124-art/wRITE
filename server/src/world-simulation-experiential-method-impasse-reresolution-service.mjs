import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetitionResolution,
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "./world-simulation-experiential-method-competition-resolution-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";

export const worldSimulationExperientialMethodImpasseReresolutionVersion =
  "phase79f-experiential-method-impasse-reresolution-v1";

const supportedPreferences = Object.freeze([
  "left_preferred",
  "right_preferred",
  "indifferent",
]);
const maximumEvidenceRefsPerRevision = 8;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) {
  return isObject(value) ? value : {};
}
function array(value) {
  return Array.isArray(value) ? value : [];
}
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredString(value, label, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_INPUT_INVALID") {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = code;
  throw error;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredString(value, "character").toLocaleLowerCase("zh-Hant-TW");
}
function sameStringSet(left, right) {
  const a = [...new Set(array(left).map(String))].sort(compareText);
  const b = [...new Set(array(right).map(String))].sort(compareText);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function verifyHashed(value, { version, hashField, label, invalidCode, hashCode }) {
  const projection = cloneJson(object(value));
  if (projection.version !== version || !optionalString(projection[hashField])) {
    const error = new Error(`Phase79F requires an exact canonical ${label}.`);
    error.code = invalidCode;
    throw error;
  }
  const body = cloneJson(projection);
  delete body[hashField];
  if (hashAgentRunValue(body) !== projection[hashField]) {
    const error = new Error(`Phase79F ${label} hash verification failed.`);
    error.code = hashCode;
    throw error;
  }
  return projection;
}

function verifyPhase79BResolverView(value) {
  const view = verifyHashed(value, {
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    hashField: "resolver_view_hash",
    label: "Phase79B resolver view",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_VIEW_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_VIEW_HASH_MISMATCH",
  });
  if (!Array.isArray(view.character_contexts)) {
    const error = new Error("Phase79F Phase79B resolver view character contexts are invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_VIEW_INVALID";
    throw error;
  }
  return view;
}

function verifyPhase79BResolution(value) {
  const projection = verifyHashed(value, {
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    hashField: "resolution_hash",
    label: "Phase79B resolution",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_RESOLUTION_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_RESOLUTION_HASH_MISMATCH",
  });
  if (!Array.isArray(projection.character_contexts)) {
    const error = new Error("Phase79F Phase79B resolution character contexts are invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_RESOLUTION_INVALID";
    throw error;
  }
  return projection;
}

function verifyPhase79D(value) {
  const projection = verifyHashed(value, {
    version: worldSimulationExperientialMethodImpasseDeliberationVersion,
    hashField: "impasse_hash",
    label: "Phase79D impasse projection",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79D_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79D_HASH_MISMATCH",
  });
  if (!optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.impasse_contexts)) {
    const error = new Error("Phase79F Phase79D impasse context is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79D_INVALID";
    throw error;
  }
  return projection;
}

function verifyPhase79E(value) {
  const projection = verifyHashed(value, {
    version: worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
    hashField: "evidence_hash",
    label: "Phase79E discriminating-evidence projection",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79E_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79E_HASH_MISMATCH",
  });
  if (!optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.impasse_evidence_contexts)) {
    const error = new Error("Phase79F Phase79E discriminating-evidence context is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79E_INVALID";
    throw error;
  }
  return projection;
}

function verifySourceLineage(sourceView, sourceResolution, impasse, evidence) {
  if (sourceResolution.resolver_view_hash !== sourceView.resolver_view_hash
      || impasse.source_phase79b_resolution_hash !== sourceResolution.resolution_hash
      || evidence.source_phase79d_impasse_hash !== impasse.impasse_hash
      || characterKey(evidence.character) !== characterKey(impasse.character)
      || evidence.current_turn_id !== impasse.current_turn_id) {
    const error = new Error("Phase79F source lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_LINEAGE_MISMATCH";
    throw error;
  }
}

function resolutionContextFor(sourceResolution, character, turnId) {
  const matches = array(sourceResolution.character_contexts).filter((entry) =>
    characterKey(entry.character) === characterKey(character)
      && entry.current_turn_id === turnId);
  if (matches.length !== 1) {
    const error = new Error("Phase79F requires exactly one matching Phase79B resolution context.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_CONTEXT_INVALID";
    throw error;
  }
  return matches[0];
}

export function buildWorldSimulationExperientialMethodImpasseReresolutionContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    phase: "Phase79F",
    status: "experiential_method_impasse_evidence_grounded_reresolution_installed",
    source_owners: ["Phase79B", "Phase79D", "Phase79E"],
    exact_source_hashes_and_lineage_required: true,
    tie_and_conflict_impasses_only: true,
    existing_phase79b_competition_refs_only: true,
    existing_phase79b_resolution_kernel_reused: true,
    supported_preferences: [...supportedPreferences],
    preference_revision_requires_phase79e_evidence_refs: true,
    omitted_competition_ref_preserves_prior_preference: true,
    unresolved_impasse_may_remain_unresolved: true,
    arbitrary_tie_breaking_allowed: false,
    numeric_similarity_confidence_probability_utility_modeled: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    semantic_revision_allowed: false,
    same_turn_learning_feedback_allowed: false,
    world_truth_authority_claimed: false,
  });
}

export function buildWorldSimulationExperientialMethodImpasseReresolutionResolverView(input = {}) {
  const sourceView = verifyPhase79BResolverView(input.source_phase79b_resolver_view);
  const sourceResolution = verifyPhase79BResolution(input.source_phase79b_resolution);
  const impasse = verifyPhase79D(input.source_phase79d_impasse_deliberation);
  const evidence = verifyPhase79E(input.source_phase79e_discriminating_evidence);
  verifySourceLineage(sourceView, sourceResolution, impasse, evidence);

  const sourceContext = resolutionContextFor(
    sourceResolution,
    impasse.character,
    impasse.current_turn_id,
  );
  const componentsByRef = new Map(array(sourceContext.competition_components)
    .map((component) => [component.resolution_ref, component]));
  const evidenceByImpasseRef = new Map(array(evidence.impasse_evidence_contexts)
    .map((context) => [context.impasse_ref, context]));

  const impasseContexts = array(impasse.impasse_contexts).map((context) => {
    if (!["tie_impasse", "conflict_impasse"].includes(context.impasse_type)) {
      const error = new Error(`Phase79F rejects non tie/conflict impasse ${context.impasse_ref ?? "unknown"}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_CONTEXT_INVALID";
      throw error;
    }
    const impasseRef = requiredString(context.impasse_ref, "impasse_ref");
    const component = componentsByRef.get(context.source_resolution_ref);
    const evidenceContext = evidenceByImpasseRef.get(impasseRef);
    if (!component
        || component.resolution_status !== context.impasse_type
        || !sameStringSet(component.method_refs, context.retained_method_refs)
        || !evidenceContext
        || evidenceContext.impasse_type !== context.impasse_type
        || !sameStringSet(evidenceContext.retained_method_refs, context.retained_method_refs)) {
      const error = new Error(`Phase79F cannot verify impasse/evidence lineage for ${impasseRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_CONTEXT_INVALID";
      throw error;
    }
    const methodRefs = new Set(array(context.retained_method_refs));
    const competitionPairs = array(component.pair_outcomes).map((pair) => {
      if (!methodRefs.has(pair.left_transfer_ref) || !methodRefs.has(pair.right_transfer_ref)) {
        const error = new Error(`Phase79F competition pair ${pair.competition_ref} escaped the impasse method set.`);
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_CONTEXT_INVALID";
        throw error;
      }
      return {
        competition_ref: requiredString(pair.competition_ref, "competition_ref"),
        left_transfer_ref: requiredString(pair.left_transfer_ref, "left_transfer_ref"),
        right_transfer_ref: requiredString(pair.right_transfer_ref, "right_transfer_ref"),
        prior_preference: requiredString(pair.preference, "prior_preference"),
        prior_resolver_decision_present: pair.resolver_decision_present === true,
      };
    });
    const cueCatalog = cloneJson(array(evidenceContext.current_context_cue_catalog));
    return {
      impasse_ref: impasseRef,
      impasse_type: context.impasse_type,
      source_resolution_ref: context.source_resolution_ref,
      candidate_methods: cloneJson(array(context.candidate_methods)),
      competition_pairs: competitionPairs,
      current_context_cue_catalog: cueCatalog,
      revision_contract: {
        existing_competition_refs_only: true,
        supported_preferences: [...supportedPreferences],
        nonempty_phase79e_evidence_cue_refs_required: true,
        omitted_competition_ref_preserves_prior_preference: true,
        unresolved_impasse_may_remain_unresolved: true,
        arbitrary_tie_breaking_allowed: false,
        numeric_preference_or_utility_forbidden: true,
        action_selection_requested: false,
        semantic_revision_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }).sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));

  const view = {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character: impasse.character,
    current_turn_id: impasse.current_turn_id,
    source_phase79b_resolution_hash: sourceResolution.resolution_hash,
    source_phase79d_impasse_hash: impasse.impasse_hash,
    source_phase79e_evidence_hash: evidence.evidence_hash,
    impasse_contexts: impasseContexts,
    impasse_count: impasseContexts.length,
    boundaries: {
      bounded_phase79d_phase79e_surface_only: true,
      original_phase79b_engine_resolver_view_exposed: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      numeric_scores_exposed: false,
      action_candidate_ids_exposed: false,
      same_turn_learning_feedback_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function verifyResolverView(value) {
  return verifyHashed(value, {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    hashField: "resolver_view_hash",
    label: "Phase79F resolver view",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_VIEW_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_VIEW_HASH_MISMATCH",
  });
}

function normalizeRevision(raw, index, contextByImpasseRef) {
  if (!isObject(raw)) {
    const error = new Error(`Phase79F preference revision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DECISION_INVALID";
    throw error;
  }
  for (const forbidden of [
    "score",
    "weight",
    "confidence",
    "probability",
    "utility",
    "utility_score",
    "similarity",
    "similarity_score",
    "action",
    "action_ref",
    "selected_action",
    "plan",
    "goal",
    "belief",
    "semantic_revision",
    "world_truth",
    "reason",
    "justification",
    "evidence",
  ]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(`Phase79F preference revision may not author forbidden field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const impasseRef = requiredString(raw.impasse_ref, `preference_revisions[${index}].impasse_ref`);
  const context = contextByImpasseRef.get(impasseRef);
  if (!context) {
    const error = new Error(`Phase79F revision references unknown impasse ${impasseRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DECISION_OUT_OF_VIEW";
    throw error;
  }
  const competitionRef = requiredString(
    raw.competition_ref,
    `preference_revisions[${index}].competition_ref`,
  );
  const pair = array(context.competition_pairs).find((entry) => entry.competition_ref === competitionRef);
  if (!pair) {
    const error = new Error(`Phase79F revision references competition ${competitionRef} outside impasse ${impasseRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DECISION_OUT_OF_VIEW";
    throw error;
  }
  const preference = requiredString(raw.preference, `preference_revisions[${index}].preference`);
  if (!supportedPreferences.includes(preference)) {
    const error = new Error(`Phase79F unsupported preference ${preference}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PREFERENCE_INVALID";
    throw error;
  }
  if (!Array.isArray(raw.evidence_cue_refs)) {
    const error = new Error("Phase79F evidence_cue_refs must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_EVIDENCE_INVALID";
    throw error;
  }
  const evidenceCueRefs = [...new Set(raw.evidence_cue_refs.map((ref) =>
    requiredString(ref, `preference_revisions[${index}].evidence_cue_refs[]`)))].sort(compareText);
  if (evidenceCueRefs.length === 0 || evidenceCueRefs.length > maximumEvidenceRefsPerRevision) {
    const error = new Error("Phase79F requires 1-8 canonical Phase79E evidence cue refs per revision.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_EVIDENCE_INVALID";
    throw error;
  }
  const allowedCueRefs = new Set(array(context.current_context_cue_catalog).map((cue) => cue.cue_ref));
  if (evidenceCueRefs.some((ref) => !allowedCueRefs.has(ref))) {
    const error = new Error("Phase79F preference revision references evidence outside the canonical Phase79E cue catalog.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_EVIDENCE_OUT_OF_VIEW";
    throw error;
  }
  return {
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference,
    evidence_cue_refs: evidenceCueRefs,
  };
}

function originalPreferenceDecisions(sourceResolution) {
  const decisions = [];
  const seen = new Set();
  for (const context of array(sourceResolution.character_contexts)) {
    for (const component of array(context.competition_components)) {
      for (const pair of array(component.pair_outcomes)) {
        if (pair.resolver_decision_present !== true) continue;
        const ref = requiredString(pair.competition_ref, "competition_ref");
        if (seen.has(ref)) {
          const error = new Error(`Phase79F source Phase79B resolution contains duplicate competition ref ${ref}.`);
          error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_PHASE79B_RESOLUTION_INVALID";
          throw error;
        }
        seen.add(ref);
        decisions.push({
          competition_ref: ref,
          preference: requiredString(pair.preference, "preference"),
        });
      }
    }
  }
  return decisions;
}

function findRevisedComponent(revisedResolution, character, turnId, methodRefs) {
  const context = resolutionContextFor(revisedResolution, character, turnId);
  const matches = array(context.competition_components)
    .filter((component) => sameStringSet(component.method_refs, methodRefs));
  if (matches.length !== 1) {
    const error = new Error("Phase79F could not uniquely map a revised Phase79B competition component.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_RESULT_LINEAGE_INVALID";
    throw error;
  }
  return matches[0];
}

export function projectWorldSimulationExperientialMethodImpasseReresolution(input = {}) {
  const providedView = verifyResolverView(input.resolver_view);
  const canonicalView = buildWorldSimulationExperientialMethodImpasseReresolutionResolverView({
    source_phase79b_resolver_view: input.source_phase79b_resolver_view,
    source_phase79b_resolution: input.source_phase79b_resolution,
    source_phase79d_impasse_deliberation: input.source_phase79d_impasse_deliberation,
    source_phase79e_discriminating_evidence: input.source_phase79e_discriminating_evidence,
  });
  if (providedView.resolver_view_hash !== canonicalView.resolver_view_hash) {
    const error = new Error("Phase79F resolver view does not match the exact canonical source lineage.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_VIEW_SOURCE_MISMATCH";
    throw error;
  }
  if (!Array.isArray(input.preference_revisions ?? [])) {
    const error = new Error("Phase79F preference_revisions must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DECISION_INVALID";
    throw error;
  }

  const contextByImpasseRef = new Map(array(canonicalView.impasse_contexts)
    .map((context) => [context.impasse_ref, context]));
  const revisions = input.preference_revisions
    .map((revision, index) => normalizeRevision(revision, index, contextByImpasseRef));
  const revisionsByCompetitionRef = new Map();
  for (const revision of revisions) {
    if (revisionsByCompetitionRef.has(revision.competition_ref)) {
      const error = new Error(`Phase79F accepts at most one revision per competition ${revision.competition_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_RERESOLUTION_DUPLICATE_DECISION";
      throw error;
    }
    revisionsByCompetitionRef.set(revision.competition_ref, revision);
  }

  const sourceResolution = verifyPhase79BResolution(input.source_phase79b_resolution);
  const mergedByCompetitionRef = new Map(originalPreferenceDecisions(sourceResolution)
    .map((decision) => [decision.competition_ref, decision]));
  for (const revision of revisions) {
    mergedByCompetitionRef.set(revision.competition_ref, {
      competition_ref: revision.competition_ref,
      preference: revision.preference,
    });
  }
  const mergedDecisions = [...mergedByCompetitionRef.values()]
    .sort((left, right) => compareText(left.competition_ref, right.competition_ref));
  const effectiveResolution = projectWorldSimulationExperientialMethodCompetitionResolution({
    resolver_view: input.source_phase79b_resolver_view,
    preference_decisions: mergedDecisions,
  });

  const results = array(canonicalView.impasse_contexts).map((context) => {
    const component = findRevisedComponent(
      effectiveResolution,
      canonicalView.character,
      canonicalView.current_turn_id,
      array(context.candidate_methods).map((method) => method.transfer_ref),
    );
    const appliedRevisions = revisions
      .filter((revision) => revision.impasse_ref === context.impasse_ref)
      .map(cloneJson);
    const resolved = !["tie_impasse", "conflict_impasse"].includes(component.resolution_status);
    return {
      impasse_ref: context.impasse_ref,
      prior_impasse_type: context.impasse_type,
      revised_resolution_ref: component.resolution_ref,
      resolution_status: component.resolution_status,
      dominant_method_ref: component.dominant_method_ref ?? null,
      retained_method_refs: cloneJson(array(component.retained_method_refs)),
      applied_preference_revisions: appliedRevisions,
      resolved,
    };
  }).sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));

  const resolvedImpasseRefs = results.filter((result) => result.resolved)
    .map((result) => result.impasse_ref);
  const remainingImpasseRefs = results.filter((result) => !result.resolved)
    .map((result) => result.impasse_ref);
  const projection = {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    character: canonicalView.character,
    current_turn_id: canonicalView.current_turn_id,
    source_phase79b_resolution_hash: canonicalView.source_phase79b_resolution_hash,
    source_phase79d_impasse_hash: canonicalView.source_phase79d_impasse_hash,
    source_phase79e_evidence_hash: canonicalView.source_phase79e_evidence_hash,
    resolver_view_hash: canonicalView.resolver_view_hash,
    preference_revision_records: cloneJson(revisions),
    preference_revision_count: revisions.length,
    effective_competition_resolution: cloneJson(effectiveResolution),
    effective_phase79b_resolution_hash: effectiveResolution.resolution_hash,
    impasse_results: results,
    resolved_impasse_refs: resolvedImpasseRefs,
    remaining_impasse_refs: remainingImpasseRefs,
    resolved_impasse_count: resolvedImpasseRefs.length,
    remaining_impasse_count: remainingImpasseRefs.length,
    character_view: {
      source: "phase79f_evidence_grounded_experiential_method_impasse_reresolution",
      impasse_results: results.map((result) => ({
        impasse_ref: result.impasse_ref,
        prior_impasse_type: result.prior_impasse_type,
        resolution_status: result.resolution_status,
        dominant_method_ref: result.dominant_method_ref,
        retained_method_refs: cloneJson(result.retained_method_refs),
        applied_preference_revisions: cloneJson(result.applied_preference_revisions),
        resolved: result.resolved,
      })),
      deliberation_required: remainingImpasseRefs.length > 0,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79b_phase79d_phase79e_lineage_verified: true,
      bounded_phase79d_phase79e_resolver_surface_only: true,
      existing_phase79b_competition_refs_only: true,
      existing_phase79b_resolution_kernel_reused: true,
      evidence_cue_refs_required_for_every_revision: true,
      omitted_competition_ref_preserved_prior_preference: true,
      arbitrary_tie_breaking_used: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      same_turn_learning_feedback_performed: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reresolution_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
