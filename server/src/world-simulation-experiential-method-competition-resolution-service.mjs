import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationExperientialMethodCompetitionVersion,
} from "./world-simulation-experiential-method-competition-service.mjs";
import {
  worldSimulationExperientialMethodTransferVersion,
} from "./world-simulation-experiential-method-transfer-service.mjs";

export const worldSimulationExperientialMethodCompetitionResolutionVersion =
  "phase79b-experiential-method-competition-resolution-v1";

const maximumMethods = 8;
const maximumCompetitionPairs = 28;
const supportedPreferences = Object.freeze([
  "left_preferred",
  "right_preferred",
  "indifferent",
  "unresolved",
]);

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
function requiredString(value, label, code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_INPUT_INVALID") {
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

function verifyCompetitionProjection(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodCompetitionVersion
      || !optionalString(projection.competition_hash)
      || !Array.isArray(projection.character_contexts)) {
    const error = new Error("Phase79B requires an exact canonical Phase79A competition projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_SOURCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.competition_hash;
  if (hashAgentRunValue(body) !== projection.competition_hash) {
    const error = new Error("Phase79B Phase79A competition hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function verifyTransferProjection(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodTransferVersion
      || !optionalString(projection.transfer_hash)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.transferred_method_mappings)
      || !Array.isArray(object(projection.character_view).transferred_methods)
      || projection.transferred_method_mappings.length > maximumMethods) {
    const error = new Error("Phase79B requires the exact Phase76E transfer projection referenced by Phase79A.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_TRANSFER_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.transfer_hash;
  if (hashAgentRunValue(body) !== projection.transfer_hash) {
    const error = new Error("Phase79B Phase76E transfer hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_TRANSFER_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function sourceKey(character, turnId) {
  return `${turnId}\u0000${characterKey(character)}`;
}

function methodCatalogForContext(context, transferProjection) {
  if (transferProjection.transfer_hash !== context.source_phase76e_transfer_hash
      || characterKey(transferProjection.character) !== characterKey(context.character)
      || transferProjection.current_turn_id !== context.current_turn_id) {
    const error = new Error("Phase79B Phase76E source identity does not match Phase79A lineage.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_LINEAGE_MISMATCH";
    throw error;
  }
  const guidance = array(transferProjection.character_view.transferred_methods);
  const byRef = new Map();
  for (const mapping of array(transferProjection.transferred_method_mappings)) {
    const transferRef = requiredString(mapping.transfer_ref, "transfer_ref");
    const transferIndex = Number.isSafeInteger(mapping.transfer_index)
      ? mapping.transfer_index
      : null;
    if (transferIndex === null || transferIndex < 0 || transferIndex >= guidance.length) {
      const error = new Error(`Phase79B cannot resolve guidance for ${transferRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_TRANSFER_GUIDANCE_INVALID";
      throw error;
    }
    const methodGuidance = object(guidance[transferIndex]);
    const methodSkeleton = cloneJson(methodGuidance.method_skeleton);
    if (!isObject(methodSkeleton)
        || hashAgentRunValue(methodSkeleton) !== requiredString(mapping.method_skeleton_hash, "method_skeleton_hash")) {
      const error = new Error(`Phase79B method skeleton lineage failed for ${transferRef}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_METHOD_HASH_MISMATCH";
      throw error;
    }
    byRef.set(transferRef, {
      transfer_ref: transferRef,
      method_skeleton: methodSkeleton,
      mapping_kind: requiredString(mapping.mapping_kind, "mapping_kind"),
      current_cue_refs: [...new Set(array(mapping.current_cue_refs)
        .map((ref) => requiredString(ref, "current_cue_ref")))].sort(compareText),
      current_context_basis: cloneJson(array(methodGuidance.current_context_basis)),
      source_knowledge_status: mapping.source_knowledge_status === "contested"
        ? "contested"
        : "supported",
      advisory_only: true,
      subjective_not_world_truth: true,
    });
  }
  return byRef;
}

export function buildWorldSimulationExperientialMethodCompetitionResolutionContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    phase: "Phase79B",
    status: "qualitative_multi_method_competition_resolution_installed",
    source_owners: ["Phase79A", "Phase76E"],
    exact_phase79a_hash_required: true,
    exact_phase76e_hash_and_lineage_required: true,
    pairwise_competition_scope_only: true,
    supported_preferences: [...supportedPreferences],
    missing_preference_means_unresolved: true,
    contested_source_is_not_automatic_rejection: true,
    qualitative_partial_order_only: true,
    transitive_dominance_may_resolve_component: true,
    cyclic_preference_means_conflict_impasse: true,
    insufficient_preference_means_tie_impasse: true,
    disjoint_noncompeting_methods_preserved_as_independent: true,
    numeric_similarity_confidence_probability_utility_modeled: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_mutation_allowed: false,
    direct_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    direct_world_state_mutation_allowed: false,
    semantic_revision_allowed: false,
    same_turn_learning_feedback_allowed: false,
  });
}

export function buildWorldSimulationExperientialMethodCompetitionResolutionResolverView(input = {}) {
  const competition = verifyCompetitionProjection(input.experiential_method_competition);
  const transfers = array(input.experiential_method_transfer_projections)
    .map(verifyTransferProjection);
  const transferByKey = new Map();
  for (const transfer of transfers) {
    const key = sourceKey(transfer.character, transfer.current_turn_id);
    if (transferByKey.has(key)) {
      const error = new Error("Phase79B accepts at most one Phase76E source per character/turn.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DUPLICATE_TRANSFER";
      throw error;
    }
    transferByKey.set(key, transfer);
  }

  const characterContexts = [];
  for (const context of array(competition.character_contexts)) {
    const key = sourceKey(context.character, context.current_turn_id);
    const transfer = transferByKey.get(key);
    if (!transfer) {
      const error = new Error(`Phase79B is missing Phase76E source for ${context.character}/${context.current_turn_id}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_TRANSFER_MISSING";
      throw error;
    }
    const methodsByRef = methodCatalogForContext(context, transfer);
    const competitionPairs = array(context.pairwise_competition_evidence)
      .filter((pair) => pair?.competition_resolution_required === true)
      .slice(0, maximumCompetitionPairs)
      .map((pair) => {
        const leftRef = requiredString(pair.left_transfer_ref, "left_transfer_ref");
        const rightRef = requiredString(pair.right_transfer_ref, "right_transfer_ref");
        if (!methodsByRef.has(leftRef) || !methodsByRef.has(rightRef)) {
          const error = new Error("Phase79B competition pair references a method outside the verified Phase76E source.");
          error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_PAIR_OUT_OF_SOURCE";
          throw error;
        }
        return {
          competition_ref: requiredString(pair.competition_ref, "competition_ref"),
          left_transfer_ref: leftRef,
          right_transfer_ref: rightRef,
          shared_current_cue_refs: cloneJson(array(pair.shared_current_cue_refs)),
          contested_source_present: pair.contested_source_present === true,
        };
      });
    const involvedRefs = new Set();
    for (const pair of competitionPairs) {
      involvedRefs.add(pair.left_transfer_ref);
      involvedRefs.add(pair.right_transfer_ref);
    }
    const competingMethods = [...involvedRefs]
      .map((ref) => cloneJson(methodsByRef.get(ref)))
      .sort((left, right) => compareText(left.transfer_ref, right.transfer_ref));
    const independentMethodRefs = [...methodsByRef.keys()]
      .filter((ref) => !involvedRefs.has(ref))
      .sort(compareText);
    characterContexts.push({
      character: context.character,
      current_turn_id: context.current_turn_id,
      source_phase79a_competition_hash: competition.competition_hash,
      source_phase76e_transfer_hash: transfer.transfer_hash,
      competing_methods: competingMethods,
      competition_pairs: competitionPairs,
      independent_method_refs: independentMethodRefs,
      resolution_required: competitionPairs.length > 0,
    });
  }

  const view = {
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    source_phase79a_competition_hash: competition.competition_hash,
    character_contexts: characterContexts,
    selection_contract: {
      competition_ref_must_be_from_view: true,
      exactly_one_preference_per_competition_ref: true,
      supported_preferences: [...supportedPreferences],
      omitted_competition_ref_means_unresolved: true,
      contested_source_may_still_be_preferred: true,
      numeric_preference_or_utility_forbidden: true,
      action_selection_requested: false,
      semantic_revision_requested: false,
      world_truth_judgment_requested: false,
    },
    boundaries: {
      exact_phase79a_source_verified: true,
      exact_phase76e_lineage_verified: true,
      method_semantics_limited_to_verified_phase76e_guidance: true,
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
  const view = cloneJson(object(value));
  if (view.version !== worldSimulationExperientialMethodCompetitionResolutionVersion
      || !optionalString(view.resolver_view_hash)) {
    const error = new Error("Phase79B requires an exact canonical resolver view.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_VIEW_INVALID";
    throw error;
  }
  const body = cloneJson(view);
  delete body.resolver_view_hash;
  if (hashAgentRunValue(body) !== view.resolver_view_hash) {
    const error = new Error("Phase79B resolver view hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_VIEW_HASH_MISMATCH";
    throw error;
  }
  return view;
}

function normalizeDecision(raw, pairByRef, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase79B preference decision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DECISION_INVALID";
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
  ]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(`Phase79B preference decision may not author forbidden field ${forbidden}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const competitionRef = requiredString(
    raw.competition_ref,
    `preference_decisions[${index}].competition_ref`,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DECISION_INVALID",
  );
  const pair = pairByRef.get(competitionRef);
  if (!pair) {
    const error = new Error(`Phase79B preference references unknown competition ${competitionRef}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DECISION_OUT_OF_VIEW";
    throw error;
  }
  const preference = requiredString(
    raw.preference,
    `preference_decisions[${index}].preference`,
    "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DECISION_INVALID",
  );
  if (!supportedPreferences.includes(preference)) {
    const error = new Error(`Unsupported Phase79B preference ${preference}.`);
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_PREFERENCE_INVALID";
    throw error;
  }
  return { competition_ref: competitionRef, preference, pair };
}

function connectedComponents(methodRefs, pairs) {
  const neighbors = new Map(methodRefs.map((ref) => [ref, new Set()]));
  for (const pair of pairs) {
    neighbors.get(pair.left_transfer_ref)?.add(pair.right_transfer_ref);
    neighbors.get(pair.right_transfer_ref)?.add(pair.left_transfer_ref);
  }
  const visited = new Set();
  const components = [];
  for (const start of [...methodRefs].sort(compareText)) {
    if (visited.has(start)) continue;
    const stack = [start];
    const members = [];
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      members.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (!visited.has(next)) stack.push(next);
      }
    }
    components.push(members.sort(compareText));
  }
  return components;
}

function hasDirectedCycle(members, outgoing) {
  const memberSet = new Set(members);
  const visiting = new Set();
  const visited = new Set();
  function visit(ref) {
    if (visiting.has(ref)) return true;
    if (visited.has(ref)) return false;
    visiting.add(ref);
    for (const next of outgoing.get(ref) ?? []) {
      if (memberSet.has(next) && visit(next)) return true;
    }
    visiting.delete(ref);
    visited.add(ref);
    return false;
  }
  return members.some(visit);
}

function reachableFrom(start, outgoing, allowed) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const next of outgoing.get(current) ?? []) {
      if (!allowed.has(next) || seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  seen.delete(start);
  return seen;
}

function resolveContext(context, decisionsByRef) {
  const pairs = array(context.competition_pairs);
  const methods = array(context.competing_methods);
  const methodRefs = methods.map((method) => method.transfer_ref);
  const pairOutcomes = pairs.map((pair) => ({
    competition_ref: pair.competition_ref,
    left_transfer_ref: pair.left_transfer_ref,
    right_transfer_ref: pair.right_transfer_ref,
    preference: decisionsByRef.get(pair.competition_ref)?.preference ?? "unresolved",
    resolver_decision_present: decisionsByRef.has(pair.competition_ref),
  }));
  const outgoing = new Map(methodRefs.map((ref) => [ref, new Set()]));
  const incoming = new Map(methodRefs.map((ref) => [ref, new Set()]));
  for (const outcome of pairOutcomes) {
    let better = null;
    let worse = null;
    if (outcome.preference === "left_preferred") {
      better = outcome.left_transfer_ref;
      worse = outcome.right_transfer_ref;
    } else if (outcome.preference === "right_preferred") {
      better = outcome.right_transfer_ref;
      worse = outcome.left_transfer_ref;
    }
    if (better && worse) {
      outgoing.get(better)?.add(worse);
      incoming.get(worse)?.add(better);
    }
  }

  const components = connectedComponents(methodRefs, pairs).map((members, componentIndex) => {
    const memberSet = new Set(members);
    const componentPairs = pairOutcomes.filter((pair) =>
      memberSet.has(pair.left_transfer_ref) && memberSet.has(pair.right_transfer_ref));
    const cycle = hasDirectedCycle(members, outgoing);
    const undominated = members.filter((ref) => (incoming.get(ref)?.size ?? 0) === 0);
    let status = "tie_impasse";
    let dominantMethodRef = null;
    let retainedMethodRefs = [...undominated];
    if (cycle) {
      status = "conflict_impasse";
      retainedMethodRefs = [...members];
    } else {
      const dominantCandidates = undominated.filter((ref) =>
        reachableFrom(ref, outgoing, memberSet).size === members.length - 1);
      if (dominantCandidates.length === 1) {
        status = "resolved_dominant";
        dominantMethodRef = dominantCandidates[0];
        retainedMethodRefs = [dominantMethodRef];
      } else if (componentPairs.length > 0
          && componentPairs.every((pair) => pair.preference === "indifferent")) {
        status = "indifferent_set";
        retainedMethodRefs = [...members];
      }
    }
    return {
      resolution_ref: `phase79b_resolution_${hashAgentRunValue({
        version: worldSimulationExperientialMethodCompetitionResolutionVersion,
        character: context.character,
        current_turn_id: context.current_turn_id,
        component_index: componentIndex,
        members,
        component_pairs: componentPairs,
      }).slice(0, 24)}`,
      method_refs: [...members],
      pair_outcomes: componentPairs,
      resolution_status: status,
      dominant_method_ref: dominantMethodRef,
      retained_method_refs: retainedMethodRefs.sort(compareText),
      unresolved_competition_refs: componentPairs
        .filter((pair) => pair.preference === "unresolved")
        .map((pair) => pair.competition_ref)
        .sort(compareText),
      indifferent_competition_refs: componentPairs
        .filter((pair) => pair.preference === "indifferent")
        .map((pair) => pair.competition_ref)
        .sort(compareText),
      cyclic_preference_detected: cycle,
      action_selection_authority: false,
      semantic_revision_authority: false,
    };
  });

  return {
    character: context.character,
    current_turn_id: context.current_turn_id,
    source_phase76e_transfer_hash: context.source_phase76e_transfer_hash,
    competition_components: components,
    independent_method_refs: cloneJson(array(context.independent_method_refs)),
    resolved_dominant_method_refs: components
      .map((component) => component.dominant_method_ref)
      .filter(Boolean)
      .sort(compareText),
    tie_impasse_count: components.filter((component) => component.resolution_status === "tie_impasse").length,
    conflict_impasse_count: components.filter((component) => component.resolution_status === "conflict_impasse").length,
    indifferent_set_count: components.filter((component) => component.resolution_status === "indifferent_set").length,
    action_selection_authority: false,
    semantic_revision_authority: false,
  };
}

export function projectWorldSimulationExperientialMethodCompetitionResolution(input = {}) {
  const view = verifyResolverView(input.resolver_view);
  if (!Array.isArray(input.preference_decisions ?? [])) {
    const error = new Error("Phase79B preference_decisions must be an array.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DECISION_INVALID";
    throw error;
  }
  const pairByRef = new Map();
  for (const context of array(view.character_contexts)) {
    for (const pair of array(context.competition_pairs)) {
      if (pairByRef.has(pair.competition_ref)) {
        const error = new Error(`Phase79B resolver view contains duplicate competition ref ${pair.competition_ref}.`);
        error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_VIEW_INVALID";
        throw error;
      }
      pairByRef.set(pair.competition_ref, pair);
    }
  }
  const normalized = input.preference_decisions
    .map((decision, index) => normalizeDecision(decision, pairByRef, index));
  const decisionsByRef = new Map();
  for (const decision of normalized) {
    if (decisionsByRef.has(decision.competition_ref)) {
      const error = new Error(`Phase79B accepts at most one preference per competition ${decision.competition_ref}.`);
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_RESOLUTION_DUPLICATE_DECISION";
      throw error;
    }
    decisionsByRef.set(decision.competition_ref, decision);
  }

  const characterContexts = array(view.character_contexts)
    .map((context) => resolveContext(context, decisionsByRef));
  const projection = {
    version: worldSimulationExperientialMethodCompetitionResolutionVersion,
    source_phase79a_competition_hash: view.source_phase79a_competition_hash,
    resolver_view_hash: view.resolver_view_hash,
    character_contexts: characterContexts,
    preference_decision_count: normalized.length,
    resolved_dominant_component_count: characterContexts
      .reduce((sum, context) => sum + context.resolved_dominant_method_refs.length, 0),
    tie_impasse_count: characterContexts.reduce((sum, context) => sum + context.tie_impasse_count, 0),
    conflict_impasse_count: characterContexts.reduce((sum, context) => sum + context.conflict_impasse_count, 0),
    audit: {
      exact_phase79a_source_verified: true,
      exact_phase76e_lineage_verified: true,
      qualitative_pairwise_preference_only: true,
      contested_source_auto_rejected: false,
      transitive_dominance_evaluated: true,
      cyclic_preference_detected_as_conflict_impasse: true,
      insufficient_preference_preserved_as_tie_impasse: true,
      independent_noncompeting_methods_preserved: true,
      numeric_similarity_confidence_probability_utility_modeled: false,
      action_selection_performed: false,
      plan_goal_belief_current_mind_world_mutation_performed: false,
      semantic_revision_performed: false,
      same_turn_learning_feedback_performed: false,
    },
  };
  projection.resolution_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
