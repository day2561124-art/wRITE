import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationSubjectiveActionDeliberationVersion =
  "phase74a-subjective-action-deliberation-grounding-v1";
export const subjectiveActionDeliberationCharacterViewVersion =
  "phase74a-bounded-subjective-action-deliberation-character-view-v1";

const maximumActionCandidates = 24;
const maximumGroundings = 48;
const maximumCollectionItems = 8;
const maximumObjectEntries = 12;
const maximumStringChars = 600;
const maximumDepth = 4;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function optionalString(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function boundedString(value, label, maxLength = 240) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_INPUT_INVALID";
    throw error;
  }
  return text;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

const privateGroundingKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_world_event",
  "causal_evidence",
  "causal_chain",
  "internal_provenance",
  "resolver_view_hash",
  "projection_hash",
  "world_truth",
  "world_truth_verified",
  "objective_feasibility",
  "success_probability",
  "probability",
  "utility",
  "utility_score",
  "priority_score",
  "feasibility_score",
]);

function privateGroundingKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return privateGroundingKeys.has(normalized)
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.endsWith("_hash")
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids");
}

function boundedCharacterValue(value, depth = 0) {
  if (depth > maximumDepth) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text ? Array.from(text).slice(0, maximumStringChars).join("") : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maximumCollectionItems)
      .map((item) => boundedCharacterValue(item, depth + 1))
      .filter((item) => item !== null && item !== undefined);
  }
  if (!isObject(value)) return null;
  const output = {};
  for (const key of Object.keys(value).sort(compareText).slice(0, maximumObjectEntries)) {
    if (privateGroundingKey(key)) continue;
    const child = boundedCharacterValue(value[key], depth + 1);
    if (child === null || child === undefined) continue;
    if (Array.isArray(child) && child.length === 0) continue;
    if (isObject(child) && Object.keys(child).length === 0) continue;
    output[key] = child;
  }
  return output;
}

function normalizeCandidate(raw, index) {
  if (!isObject(raw)) {
    const error = new Error(`Phase74A action candidate at index ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_CANDIDATE_INVALID";
    throw error;
  }
  const actionId = boundedString(
    raw.action_id,
    `candidate_action_intents[${index}].action_id`,
    240,
  );
  const intent = boundedString(
    raw.intent,
    `candidate_action_intents[${index}].intent`,
    600,
  );
  for (const forbidden of [
    "outcome",
    "result",
    "success",
    "hit",
    "winner",
    "utility",
    "utility_score",
    "priority_score",
    "success_probability",
    "probability",
    "feasibility_score",
    "selected",
    "selected_action",
  ]) {
    if (Object.hasOwn(raw, forbidden)) {
      const error = new Error(
        `Phase74A candidate ${actionId} may not smuggle outcome or selection authority field ${forbidden}.`,
      );
      error.code = "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_AUTHORITY_FIELD_FORBIDDEN";
      throw error;
    }
  }
  const candidateFingerprint = {
    action_id: actionId,
    intent,
    prerequisites: boundedCharacterValue(array(raw.prerequisites)),
    known_costs: boundedCharacterValue(array(raw.known_costs)),
    blocked_by: boundedCharacterValue(array(raw.blocked_by)),
    duration_estimate: boundedCharacterValue(raw.duration_estimate ?? null),
    duration_ms: boundedCharacterValue(raw.duration_ms ?? null),
    duration_s: boundedCharacterValue(raw.duration_s ?? null),
    target: boundedCharacterValue(raw.target ?? null),
    target_position: boundedCharacterValue(raw.target_position ?? null),
    movement: boundedCharacterValue(raw.movement ?? null),
    door_interaction: boundedCharacterValue(raw.door_interaction ?? null),
    object_interaction: boundedCharacterValue(raw.object_interaction ?? null),
    attack: boundedCharacterValue(raw.attack ?? null),
    defense: boundedCharacterValue(raw.defense ?? null),
    projectile: boundedCharacterValue(raw.projectile ?? null),
    ability: boundedCharacterValue(raw.ability ?? null),
    resource_commitment: boundedCharacterValue(raw.resource_commitment ?? null),
  };
  const actionHash = hashAgentRunValue({
    version: worldSimulationSubjectiveActionDeliberationVersion,
    candidate: candidateFingerprint,
  });
  return {
    action_ref: `phase74a_action_${actionHash.slice(0, 24)}`,
    action_id: actionId,
    candidate_source: "existing_world_action_proposer_candidate",
    candidate_is_non_binding: true,
    candidate_semantic_content_remains_in_candidate_action_intents: true,
    outcome_not_predicted: true,
    objective_feasibility_not_asserted: true,
  };
}

function semanticValuePresent(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  return true;
}

function groundingRecord(character, groundingKind, sourcePath, content) {
  if (!semanticValuePresent(content)) return null;
  const bounded = boundedCharacterValue(content);
  if (!semanticValuePresent(bounded)) return null;
  const hash = hashAgentRunValue({
    version: worldSimulationSubjectiveActionDeliberationVersion,
    character,
    grounding_kind: groundingKind,
    source_path: sourcePath,
    bounded_character_facing_content: bounded,
  });
  return {
    grounding_ref: `phase74a_grounding_${hash.slice(0, 24)}`,
    grounding_kind: groundingKind,
    source_path: sourcePath,
    semantic_content_duplicated: false,
    subjective_character_context_only: true,
    world_truth_authority: false,
  };
}

function buildCognitionGroundingCatalog(character, cognition) {
  const source = isObject(cognition) ? cognition : {};
  const working = isObject(source.working_context) ? source.working_context : {};
  const candidates = [
    ["active_goal", "cognition.goals", source.goals],
    ["value_context", "cognition.values", source.values],
    ["relationship_context", "cognition.relationship_cognition", source.relationship_cognition],
    ["decision_pressure", "cognition.decision_pressures", source.decision_pressures],
    ["current_action", "cognition.current_action", source.current_action],
    ["emotion_context", "cognition.emotion", source.emotion],
    ["working_memory_focus", "cognition.working_context.focus", working.focus],
    ["working_memory_active_context", "cognition.working_context.active_context", working.active_context],
    ["known_context", "cognition.known", source.known],
    ["uncertain_context", "cognition.uncertain", source.uncertain],
  ];
  return candidates
    .slice(0, maximumGroundings)
    .map(([groundingKind, sourcePath, content]) => (
      groundingRecord(character, groundingKind, sourcePath, content)
    ))
    .filter(Boolean);
}

export function buildWorldSimulationSubjectiveActionDeliberationContract() {
  return Object.freeze({
    version: worldSimulationSubjectiveActionDeliberationVersion,
    phase: "Phase74A",
    status: "bounded_action_candidate_cognition_grounding_installed",
    candidate_source_owner: "existing_world_action_proposer",
    candidate_generation_duplicated: false,
    character_brain_remains_final_action_choice_owner: true,
    prepared_turn_broker_remains_membership_and_submission_authority: true,
    action_outcome_owner: "causal_simulator",
    qualitative_grounding_only: true,
    plan_commitment_may_constrain_later_deliberation: true,
    explicit_impasse_or_reject_all_preserved: true,
    deterministic_action_winner_computed: false,
    subjective_prospective_consequence_simulation_modeled: false,
    cross_option_preference_resolution_modeled: false,
    durable_choice_receipt_modeled: false,
    expected_utility_optimizer_modeled: false,
    numeric_utility_priority_probability_feasibility_modeled: false,
    objective_feasibility_oracle_modeled: false,
    world_truth_authority_claimed: false,
    action_outcome_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    other_character_private_cognition_allowed: false,
  });
}

export function buildWorldSimulationSubjectiveActionDeliberationView(input = {}) {
  const character = boundedString(input.character, "character", 240);
  const rawCandidates = array(input.candidate_action_intents);
  if (rawCandidates.length > maximumActionCandidates) {
    const error = new Error(
      `Phase74A accepts at most ${maximumActionCandidates} action candidates.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_CANDIDATE_LIMIT_EXCEEDED";
    throw error;
  }
  const candidates = rawCandidates.map(normalizeCandidate);
  const seenActionIds = new Set();
  for (const candidate of candidates) {
    const key = candidate.action_id.toLocaleLowerCase("en");
    if (seenActionIds.has(key)) {
      const error = new Error(`Duplicate Phase74A action_id ${candidate.action_id}.`);
      error.code = "WORLD_SIMULATION_SUBJECTIVE_ACTION_DELIBERATION_ACTION_ID_DUPLICATE";
      throw error;
    }
    seenActionIds.add(key);
  }
  const groundings = buildCognitionGroundingCatalog(character, input.cognition);
  const groundingRefs = groundings.map((entry) => entry.grounding_ref);
  const actionOptions = candidates.map((candidate) => ({
    ...candidate,
    grounding_scope: "same_character_open_cognition_catalog",
    grounding_refs: groundingRefs,
  }));
  const view = {
    version: subjectiveActionDeliberationCharacterViewVersion,
    source_version: worldSimulationSubjectiveActionDeliberationVersion,
    character,
    status: candidates.length > 0
      ? "bounded_deliberation_context_ready"
      : "no_action_candidates_available",
    action_options: actionOptions,
    cognition_grounding_catalog: groundings,
    action_option_count: candidates.length,
    cognition_grounding_count: groundings.length,
    choice_boundary: {
      character_brain_owns_final_choice: true,
      may_select_only_listed_action_ids_or_reject_all: true,
      reject_all_allowed: true,
      candidate_generation_duplicated: false,
      action_outcome_not_selected_here: true,
      objective_feasibility_not_asserted: true,
      deterministic_winner_not_computed: true,
      qualitative_grounding_only: true,
      numeric_expected_utility_not_computed: true,
      numeric_success_probability_not_computed: true,
      subjective_prospective_consequence_simulation_deferred: true,
      cross_option_preference_resolution_deferred: true,
      durable_choice_receipt_deferred: true,
    },
    information_boundary: {
      same_character_bounded_cognition_only: true,
      raw_world_state_exposed: false,
      raw_world_event_exposed: false,
      hidden_causal_evidence_exposed: false,
      other_character_private_cognition_exposed: false,
      engine_internal_ids_hashes_in_cognition_groundings_exposed: false,
      cognition_semantic_content_duplicated_in_deliberation_view: false,
      candidate_intent_content_duplicated_in_deliberation_view: false,
      grounding_refs_point_to_existing_character_facing_cognition: true,
    },
  };
  view.deliberation_view_hash = hashAgentRunValue(view);
  return Object.freeze(cloneJson(view));
}
