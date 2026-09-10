import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  projectWorldSimulationExperientialMethodCompetitionResolution,
  worldSimulationExperientialMethodCompetitionResolutionVersion,
} from "./world-simulation-experiential-method-competition-resolution-service.mjs";
import { worldSimulationExperientialMethodImpasseReresolutionVersion } from "./world-simulation-experiential-method-impasse-reresolution-service.mjs";
import {
  assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection,
  worldSimulationExperientialMethodImpassePrecedentReentryVersion,
} from "./world-simulation-experiential-method-impasse-precedent-reentry-service.mjs";

export const worldSimulationExperientialMethodImpassePrecedentReresolutionVersion =
  "phase79j-experiential-method-impasse-precedent-reresolution-v1";

const supportedPreferences = Object.freeze([
  "left_preferred",
  "right_preferred",
  "indifferent",
]);
const maximumPrecedentRefsPerRevision = 8;

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
function requiredString(
  value,
  label,
  code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_INPUT_INVALID",
) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`Phase79J ${label} is required.`);
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
function verifyHashed(value, {
  version,
  hashField,
  label,
  invalidCode,
  hashCode,
}) {
  const projection = cloneJson(object(value));
  if (projection.version !== version || !optionalString(projection[hashField])) {
    const error = new Error(`Phase79J requires an exact canonical ${label}.`);
    error.code = invalidCode;
    throw error;
  }
  const body = cloneJson(projection);
  delete body[hashField];
  if (hashAgentRunValue(body) !== projection[hashField]) {
    const error = new Error(`Phase79J ${label} hash verification failed.`);
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
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_VIEW_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_VIEW_HASH_MISMATCH",
  });
  if (!Array.isArray(view.character_contexts)) {
    const error = new Error("Phase79J Phase79B resolver view character contexts are invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_VIEW_INVALID";
    throw error;
  }
  return view;
}

function verifyPhase79BResolution(value) {
  const projection = verifyHashed(value, {
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    hashField: "resolution_hash",
    label: "effective Phase79B resolution",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_RESOLUTION_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_RESOLUTION_HASH_MISMATCH",
  });
  if (!Array.isArray(projection.character_contexts)) {
    const error = new Error("Phase79J effective Phase79B resolution contexts are invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_RESOLUTION_INVALID";
    throw error;
  }
  return projection;
}

function verifyPhase79F(value) {
  const projection = verifyHashed(value, {
    version: worldSimulationExperientialMethodImpasseReresolutionVersion,
    hashField: "reresolution_hash",
    label: "Phase79F re-resolution projection",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79F_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79F_HASH_MISMATCH",
  });
  if (!optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.impasse_results)
      || !Array.isArray(projection.remaining_impasse_refs)
      || !isObject(projection.effective_competition_resolution)) {
    const error = new Error("Phase79J Phase79F projection shape is invalid.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79F_INVALID";
    throw error;
  }
  return projection;
}

function verifyPhase79I(value) {
  const projection = assertWorldSimulationExperientialMethodImpassePrecedentReentryProjection(value);
  if (projection.version !== worldSimulationExperientialMethodImpassePrecedentReentryVersion) {
    const error = new Error("Phase79J Phase79I version mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79I_INVALID";
    throw error;
  }
  return cloneJson(projection);
}

function matchingCharacterContext(contexts, character, turnId, label) {
  const matches = array(contexts).filter((context) =>
    characterKey(context?.character) === characterKey(character)
      && context?.current_turn_id === turnId);
  if (matches.length !== 1) {
    const error = new Error(`Phase79J requires exactly one ${label} character/turn context.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_CONTEXT_INVALID";
    throw error;
  }
  return matches[0];
}

function verifySourceLineage(sourceView, phase79F, phase79I) {
  const effective = verifyPhase79BResolution(phase79F.effective_competition_resolution);
  if (effective.resolver_view_hash !== sourceView.resolver_view_hash
      || characterKey(phase79I.character) !== characterKey(phase79F.character)
      || phase79I.current_turn_id !== phase79F.current_turn_id
      || phase79I.source_phase79f_reresolution_hash !== phase79F.reresolution_hash
      || !sameStringSet(phase79I.remaining_impasse_refs, phase79F.remaining_impasse_refs)) {
    const error = new Error("Phase79J Phase79B/79F/79I source lineage mismatch.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_LINEAGE_MISMATCH";
    throw error;
  }
  matchingCharacterContext(
    sourceView.character_contexts,
    phase79F.character,
    phase79F.current_turn_id,
    "Phase79B resolver-view",
  );
  matchingCharacterContext(
    effective.character_contexts,
    phase79F.character,
    phase79F.current_turn_id,
    "effective Phase79B resolution",
  );
  return effective;
}

function eligiblePrecedentSummary(precedent, methodRefs) {
  if (precedent.all_historical_resolution_cues_exactly_match_current_context !== true) {
    return null;
  }
  const correspondingMethodRef = requiredString(
    precedent.current_corresponding_method_ref,
    "precedent current_corresponding_method_ref",
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
  );
  if (!methodRefs.has(correspondingMethodRef)) {
    const error = new Error("Phase79J eligible precedent corresponding method escaped the current impasse method set.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID";
    throw error;
  }
  const historicalCueRefs = new Set(array(precedent.historical_selected_cues)
    .map((cue) => requiredString(
      cue?.historical_cue_ref,
      "precedent historical_cue_ref",
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
    )));
  const matches = array(precedent.exact_current_cue_matches);
  const matchedHistoricalCueRefs = new Set(matches.map((match) => requiredString(
    match?.historical_cue_ref,
    "precedent matched historical_cue_ref",
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
  )));
  if (historicalCueRefs.size === 0
      || historicalCueRefs.size !== matchedHistoricalCueRefs.size
      || [...historicalCueRefs].some((ref) => !matchedHistoricalCueRefs.has(ref))) {
    const error = new Error("Phase79J refuses a precedent whose exact-full-cue-match flag is not structurally justified.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_MATCH_INVALID";
    throw error;
  }
  const currentCueRefs = [...new Set(matches.map((match) => requiredString(
    match?.current_cue_ref,
    "precedent current_cue_ref",
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
  )))].sort(compareText);
  return {
    precedent_ref: requiredString(
      precedent.precedent_ref,
      "precedent_ref",
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
    ),
    current_corresponding_method_ref: correspondingMethodRef,
    method_outcome_assessment: requiredString(
      precedent.method_outcome_assessment,
      "precedent method_outcome_assessment",
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
    ),
    precedent_kind: requiredString(
      precedent.precedent_kind,
      "precedent_kind",
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
    ),
    exact_current_cue_refs: currentCueRefs,
    all_historical_resolution_cues_exactly_match_current_context: true,
    comparative_preference_validated: false,
    counterfactual_superiority_inferred: false,
  };
}

export function buildWorldSimulationExperientialMethodImpassePrecedentReresolutionContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    phase: "Phase79J",
    status: "precedent_grounded_experiential_method_impasse_reresolution_installed",
    source_owners: ["Phase79B", "Phase79F", "Phase79I"],
    phase79f_remaining_impasses_only: true,
    phase79i_exact_full_cue_match_precedents_only: true,
    existing_phase79b_competition_refs_only: true,
    existing_phase79b_resolution_kernel_reused: true,
    phase79c_guidance_compiler_reusable: true,
    supported_preferences: [...supportedPreferences],
    nonempty_precedent_refs_required_per_revision: true,
    directional_preference_requires_directionally_relevant_nonambiguous_precedent: true,
    automatic_precedent_voting_allowed: false,
    precedent_recency_weighting_allowed: false,
    fuzzy_similarity_allowed: false,
    numeric_success_rate_confidence_probability_utility_reward_modeled: false,
    historical_outcome_is_comparative_truth: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    semantic_revision_allowed: false,
    world_truth_authority_claimed: false,
  });
}

export function buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView(input = {}) {
  const sourceView = verifyPhase79BResolverView(input.source_phase79b_resolver_view);
  const phase79F = verifyPhase79F(input.source_phase79f_reresolution);
  const phase79I = verifyPhase79I(input.source_phase79i_precedent_reentry);
  const effective = verifySourceLineage(sourceView, phase79F, phase79I);
  const effectiveContext = matchingCharacterContext(
    effective.character_contexts,
    phase79F.character,
    phase79F.current_turn_id,
    "effective Phase79B resolution",
  );
  const sourceContext = matchingCharacterContext(
    sourceView.character_contexts,
    phase79F.character,
    phase79F.current_turn_id,
    "Phase79B resolver-view",
  );
  const sourceMethodByRef = new Map(array(sourceContext.competing_methods)
    .map((method) => [method.transfer_ref, method]));
  const effectiveComponentByRef = new Map(array(effectiveContext.competition_components)
    .map((component) => [component.resolution_ref, component]));
  const resultByImpasseRef = new Map(array(phase79F.impasse_results)
    .map((result) => [result.impasse_ref, result]));
  const precedentsByImpasseRef = new Map();
  for (const precedent of array(phase79I.precedent_cases)) {
    const impasseRef = requiredString(
      precedent.current_impasse_ref,
      "Phase79I precedent current_impasse_ref",
      "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_INVALID",
    );
    const list = precedentsByImpasseRef.get(impasseRef) ?? [];
    list.push(precedent);
    precedentsByImpasseRef.set(impasseRef, list);
  }

  const impasseContexts = array(phase79F.remaining_impasse_refs).map((impasseRef) => {
    const result = resultByImpasseRef.get(impasseRef);
    if (!result
        || result.resolved === true
        || !["tie_impasse", "conflict_impasse"].includes(result.resolution_status)) {
      const error = new Error(`Phase79J cannot map remaining Phase79F impasse ${impasseRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_CONTEXT_INVALID";
      throw error;
    }
    const component = effectiveComponentByRef.get(result.revised_resolution_ref);
    if (!component
        || component.resolution_status !== result.resolution_status
        || !sameStringSet(component.retained_method_refs, result.retained_method_refs)) {
      const error = new Error(`Phase79J cannot verify effective competition component for ${impasseRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_CONTEXT_INVALID";
      throw error;
    }
    const methodRefs = new Set(array(component.method_refs));
    const candidateMethods = [...methodRefs].map((ref) => {
      const method = sourceMethodByRef.get(ref);
      if (!method) {
        const error = new Error(`Phase79J current method ${ref} is absent from the canonical Phase79B resolver view.`);
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_CONTEXT_INVALID";
        throw error;
      }
      return {
        transfer_ref: ref,
        method_skeleton: cloneJson(method.method_skeleton),
        source_knowledge_status: method.source_knowledge_status,
        current_context_basis: cloneJson(array(method.current_context_basis)),
        advisory_only: true,
      };
    }).sort((left, right) => compareText(left.transfer_ref, right.transfer_ref));
    const competitionPairs = array(component.pair_outcomes).map((pair) => ({
      competition_ref: requiredString(pair.competition_ref, "competition_ref"),
      left_transfer_ref: requiredString(pair.left_transfer_ref, "left_transfer_ref"),
      right_transfer_ref: requiredString(pair.right_transfer_ref, "right_transfer_ref"),
      prior_preference: requiredString(pair.preference, "prior_preference"),
      prior_resolver_decision_present: pair.resolver_decision_present === true,
    }));
    const eligiblePrecedents = array(precedentsByImpasseRef.get(impasseRef))
      .map((precedent) => eligiblePrecedentSummary(precedent, methodRefs))
      .filter(Boolean)
      .sort((left, right) => compareText(left.precedent_ref, right.precedent_ref));
    return {
      impasse_ref: impasseRef,
      impasse_type: result.resolution_status,
      candidate_methods: candidateMethods,
      competition_pairs: competitionPairs,
      eligible_precedents: eligiblePrecedents,
      eligible_precedent_count: eligiblePrecedents.length,
      revision_contract: {
        existing_competition_refs_only: true,
        supported_preferences: [...supportedPreferences],
        nonempty_eligible_precedent_refs_required: true,
        cited_precedent_must_correspond_to_pair_member: true,
        directional_preference_requires_directionally_relevant_nonambiguous_precedent: true,
        automatic_majority_or_recency_voting_allowed: false,
        numeric_preference_or_utility_forbidden: true,
        action_selection_requested: false,
        semantic_revision_requested: false,
        world_truth_judgment_requested: false,
      },
    };
  }).sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));

  const view = {
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    character: phase79F.character,
    current_turn_id: phase79F.current_turn_id,
    source_phase79b_resolver_view_hash: sourceView.resolver_view_hash,
    source_phase79f_reresolution_hash: phase79F.reresolution_hash,
    source_phase79i_precedent_reentry_hash: phase79I.projection_hash,
    impasse_contexts: impasseContexts,
    impasse_count: impasseContexts.length,
    eligible_precedent_count: impasseContexts.reduce(
      (sum, context) => sum + context.eligible_precedent_count,
      0,
    ),
    boundaries: {
      phase79f_remaining_impasses_only: true,
      phase79i_exact_full_cue_match_precedents_only: true,
      raw_world_history_exposed: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      numeric_scores_exposed: false,
      action_candidate_ids_exposed: false,
      fuzzy_similarity_exposed: false,
      historical_transfer_refs_used_as_current_identity: false,
      comparative_preference_truth_exposed: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

function verifyResolverView(value) {
  return verifyHashed(value, {
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    hashField: "resolver_view_hash",
    label: "Phase79J resolver view",
    invalidCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_VIEW_INVALID",
    hashCode: "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_VIEW_HASH_MISMATCH",
  });
}

function directionSupported(preference, pair, precedents) {
  if (preference === "indifferent") return true;
  const preferredRef = preference === "left_preferred"
    ? pair.left_transfer_ref
    : pair.right_transfer_ref;
  const otherRef = preference === "left_preferred"
    ? pair.right_transfer_ref
    : pair.left_transfer_ref;
  return precedents.some((precedent) =>
    (precedent.current_corresponding_method_ref === preferredRef
      && precedent.method_outcome_assessment === "supports_prior_method")
    || (precedent.current_corresponding_method_ref === otherRef
      && precedent.method_outcome_assessment === "counterevidence_for_prior_method"));
}

function normalizeRevision(raw, index, contextByImpasseRef) {
  if (!isObject(raw)) {
    const error = new Error(`Phase79J preference revision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DECISION_INVALID";
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
    "success_rate",
    "reward",
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
      const error = new Error(`Phase79J preference revision may not author forbidden field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const impasseRef = requiredString(
    raw.impasse_ref,
    `preference_revisions[${index}].impasse_ref`,
  );
  const context = contextByImpasseRef.get(impasseRef);
  if (!context) {
    const error = new Error(`Phase79J revision references unknown impasse ${impasseRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DECISION_OUT_OF_VIEW";
    throw error;
  }
  const competitionRef = requiredString(
    raw.competition_ref,
    `preference_revisions[${index}].competition_ref`,
  );
  const pair = array(context.competition_pairs)
    .find((candidate) => candidate.competition_ref === competitionRef);
  if (!pair) {
    const error = new Error(`Phase79J revision references competition ${competitionRef} outside impasse ${impasseRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DECISION_OUT_OF_VIEW";
    throw error;
  }
  const preference = requiredString(
    raw.preference,
    `preference_revisions[${index}].preference`,
  );
  if (!supportedPreferences.includes(preference)) {
    const error = new Error(`Phase79J unsupported preference ${preference}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PREFERENCE_INVALID";
    throw error;
  }
  if (!Array.isArray(raw.precedent_refs)) {
    const error = new Error("Phase79J precedent_refs must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_EVIDENCE_INVALID";
    throw error;
  }
  const precedentRefs = [...new Set(raw.precedent_refs.map((ref) =>
    requiredString(ref, `preference_revisions[${index}].precedent_refs[]`)))].sort(compareText);
  if (precedentRefs.length === 0 || precedentRefs.length > maximumPrecedentRefsPerRevision) {
    const error = new Error("Phase79J requires 1-8 canonical eligible Phase79I precedent refs per revision.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_EVIDENCE_INVALID";
    throw error;
  }
  const precedentByRef = new Map(array(context.eligible_precedents)
    .map((precedent) => [precedent.precedent_ref, precedent]));
  const citedPrecedents = precedentRefs.map((ref) => {
    const precedent = precedentByRef.get(ref);
    if (!precedent) {
      const error = new Error(`Phase79J precedent ${ref} is outside the eligible exact-match view.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_EVIDENCE_OUT_OF_VIEW";
      throw error;
    }
    if (![pair.left_transfer_ref, pair.right_transfer_ref]
      .includes(precedent.current_corresponding_method_ref)) {
      const error = new Error(`Phase79J precedent ${ref} does not correspond to either method in competition ${competitionRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PRECEDENT_NOT_PAIR_RELEVANT";
      throw error;
    }
    return precedent;
  });
  if (!directionSupported(preference, pair, citedPrecedents)) {
    const error = new Error("Phase79J directional preference lacks a directionally relevant non-ambiguous precedent.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DIRECTION_UNSUPPORTED";
    throw error;
  }
  return {
    impasse_ref: impasseRef,
    competition_ref: competitionRef,
    preference,
    precedent_refs: precedentRefs,
  };
}

function effectivePreferenceDecisions(effectiveResolution) {
  const decisions = [];
  const seen = new Set();
  for (const context of array(effectiveResolution.character_contexts)) {
    for (const component of array(context.competition_components)) {
      for (const pair of array(component.pair_outcomes)) {
        if (pair.resolver_decision_present !== true) continue;
        const ref = requiredString(pair.competition_ref, "competition_ref");
        if (seen.has(ref)) {
          const error = new Error(`Phase79J effective Phase79B resolution contains duplicate competition ${ref}.`);
          error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_PHASE79B_RESOLUTION_INVALID";
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

function findComponent(resolution, character, turnId, methodRefs) {
  const context = matchingCharacterContext(
    resolution.character_contexts,
    character,
    turnId,
    "recomputed Phase79B resolution",
  );
  const matches = array(context.competition_components)
    .filter((component) => sameStringSet(component.method_refs, methodRefs));
  if (matches.length !== 1) {
    const error = new Error("Phase79J could not uniquely map a recomputed Phase79B competition component.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_RESULT_LINEAGE_INVALID";
    throw error;
  }
  return matches[0];
}

export function projectWorldSimulationExperientialMethodImpassePrecedentReresolution(input = {}) {
  const providedView = verifyResolverView(input.resolver_view);
  const canonicalView = buildWorldSimulationExperientialMethodImpassePrecedentReresolutionResolverView({
    source_phase79b_resolver_view: input.source_phase79b_resolver_view,
    source_phase79f_reresolution: input.source_phase79f_reresolution,
    source_phase79i_precedent_reentry: input.source_phase79i_precedent_reentry,
  });
  if (providedView.resolver_view_hash !== canonicalView.resolver_view_hash) {
    const error = new Error("Phase79J resolver view does not match its exact canonical source lineage.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_VIEW_SOURCE_MISMATCH";
    throw error;
  }
  if (!Array.isArray(input.preference_revisions ?? [])) {
    const error = new Error("Phase79J preference_revisions must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DECISION_INVALID";
    throw error;
  }
  const contextByImpasseRef = new Map(array(canonicalView.impasse_contexts)
    .map((context) => [context.impasse_ref, context]));
  const revisions = input.preference_revisions
    .map((revision, index) => normalizeRevision(revision, index, contextByImpasseRef));
  const revisionByCompetitionRef = new Map();
  for (const revision of revisions) {
    if (revisionByCompetitionRef.has(revision.competition_ref)) {
      const error = new Error(`Phase79J accepts at most one revision per competition ${revision.competition_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_IMPASSE_PRECEDENT_RERESOLUTION_DUPLICATE_DECISION";
      throw error;
    }
    revisionByCompetitionRef.set(revision.competition_ref, revision);
  }

  const phase79F = verifyPhase79F(input.source_phase79f_reresolution);
  const priorEffectiveResolution = verifyPhase79BResolution(
    phase79F.effective_competition_resolution,
  );
  const mergedByCompetitionRef = new Map(effectivePreferenceDecisions(priorEffectiveResolution)
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
    const component = findComponent(
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
      applied_precedent_revisions: appliedRevisions,
      resolved,
    };
  }).sort((left, right) => compareText(left.impasse_ref, right.impasse_ref));
  const resolvedImpasseRefs = results.filter((result) => result.resolved)
    .map((result) => result.impasse_ref);
  const remainingImpasseRefs = results.filter((result) => !result.resolved)
    .map((result) => result.impasse_ref);
  const projection = {
    version: worldSimulationExperientialMethodImpassePrecedentReresolutionVersion,
    character: canonicalView.character,
    current_turn_id: canonicalView.current_turn_id,
    source_phase79b_resolver_view_hash: canonicalView.source_phase79b_resolver_view_hash,
    source_phase79f_reresolution_hash: canonicalView.source_phase79f_reresolution_hash,
    source_phase79i_precedent_reentry_hash: canonicalView.source_phase79i_precedent_reentry_hash,
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
      source: "phase79j_precedent_grounded_experiential_method_impasse_reresolution",
      impasse_results: results.map((result) => ({
        impasse_ref: result.impasse_ref,
        prior_impasse_type: result.prior_impasse_type,
        resolution_status: result.resolution_status,
        dominant_method_ref: result.dominant_method_ref,
        retained_method_refs: cloneJson(result.retained_method_refs),
        resolved: result.resolved,
      })),
      deliberation_required: remainingImpasseRefs.length > 0,
      precedent_refs_exposed: false,
      historical_outcome_details_exposed: false,
      advisory_only: true,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79b_phase79f_phase79i_lineage_verified: true,
      phase79f_remaining_impasses_only: true,
      exact_full_cue_match_precedents_only: true,
      cited_precedent_pair_relevance_verified: true,
      directional_evidence_relevance_verified: true,
      existing_phase79b_resolution_kernel_reused: true,
      automatic_precedent_voting_used: false,
      precedent_recency_weighting_used: false,
      fuzzy_similarity_used: false,
      numeric_success_rate_confidence_probability_utility_reward_modeled: false,
      historical_outcome_treated_as_comparative_truth: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.reresolution_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
