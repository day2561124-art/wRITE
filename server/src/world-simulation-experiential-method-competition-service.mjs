import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodTransferVersion } from "./world-simulation-experiential-method-transfer-service.mjs";

export const worldSimulationExperientialMethodCompetitionVersion =
  "phase79a-experiential-method-competition-v1";

const maximumMethods = 8;
const maximumPairs = 28;

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
function requiredString(value, label) {
  const text = optionalString(value);
  if (text) return text;
  const error = new Error(`${label} is required.`);
  error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_INPUT_INVALID";
  throw error;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredString(value, "character").toLocaleLowerCase("zh-Hant-TW");
}

function verifyTransferProjection(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodTransferVersion
      || !optionalString(projection.transfer_hash)
      || !optionalString(projection.character)
      || !optionalString(projection.current_turn_id)
      || !Array.isArray(projection.transferred_method_mappings)
      || projection.transferred_method_mappings.length > maximumMethods) {
    const error = new Error("Phase79A requires an exact bounded Phase76E transfer projection.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_SOURCE_INVALID";
    throw error;
  }
  const body = cloneJson(projection);
  delete body.transfer_hash;
  if (hashAgentRunValue(body) !== projection.transfer_hash) {
    const error = new Error("Phase79A Phase76E transfer hash verification failed.");
    error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_SOURCE_HASH_MISMATCH";
    throw error;
  }
  return projection;
}

function normalizedMethod(projection, mapping) {
  const transferRef = requiredString(mapping.transfer_ref, "transfer_ref");
  const methodSkeletonHash = requiredString(mapping.method_skeleton_hash, "method_skeleton_hash");
  const cueRefs = [...new Set(array(mapping.current_cue_refs)
    .map((value) => requiredString(value, "current_cue_ref")))]
    .sort(compareText);
  return {
    transfer_ref: transferRef,
    transfer_index: Number.isSafeInteger(mapping.transfer_index)
      ? mapping.transfer_index
      : null,
    mapping_kind: requiredString(mapping.mapping_kind, "mapping_kind"),
    current_cue_refs: cueRefs,
    method_skeleton_hash: methodSkeletonHash,
    source_knowledge_status: mapping.source_knowledge_status === "contested"
      ? "contested"
      : "supported",
    character: projection.character,
    current_turn_id: projection.current_turn_id,
  };
}

function pairRecord(left, right) {
  const leftCues = new Set(left.current_cue_refs);
  const sharedCueRefs = right.current_cue_refs.filter((ref) => leftCues.has(ref)).sort(compareText);
  const structurallyDistinct = left.method_skeleton_hash !== right.method_skeleton_hash;
  const sameMappingKind = left.mapping_kind === right.mapping_kind;
  const competitionRequired = structurallyDistinct && sharedCueRefs.length > 0;
  const identity = {
    version: worldSimulationExperientialMethodCompetitionVersion,
    left_transfer_ref: left.transfer_ref,
    right_transfer_ref: right.transfer_ref,
    shared_cue_refs: sharedCueRefs,
    structurally_distinct: structurallyDistinct,
    same_mapping_kind: sameMappingKind,
  };
  return {
    competition_ref: `phase79a_competition_${hashAgentRunValue(identity).slice(0, 24)}`,
    left_transfer_ref: left.transfer_ref,
    right_transfer_ref: right.transfer_ref,
    shared_current_cue_refs: sharedCueRefs,
    structurally_distinct: structurallyDistinct,
    same_mapping_kind: sameMappingKind,
    competition_resolution_required: competitionRequired,
    independent_or_composable_possible: sharedCueRefs.length === 0,
    contested_source_present:
      left.source_knowledge_status === "contested"
      || right.source_knowledge_status === "contested",
    numeric_preference_score_assigned: false,
    action_selection_performed: false,
    semantic_truth_resolved: false,
  };
}

export function buildWorldSimulationExperientialMethodCompetitionContract() {
  return deepFreeze({
    version: worldSimulationExperientialMethodCompetitionVersion,
    phase: "Phase79A",
    status: "multi_method_competition_evidence_surface_installed",
    source_owner: "Phase76E",
    exact_phase76e_hash_required: true,
    same_character_same_turn_only: true,
    maximum_method_count: maximumMethods,
    maximum_pair_count: maximumPairs,
    shared_current_cues_define_competition_surface_only: true,
    structurally_distinct_methods_require_downstream_resolution: true,
    disjoint_cue_methods_may_remain_independent_or_composable: true,
    contested_source_status_preserved: true,
    preference_resolution_performed: false,
    impasse_resolution_performed: false,
    numeric_similarity_confidence_probability_utility_modeled: false,
    direct_action_selection_allowed: false,
    direct_plan_goal_mutation_allowed: false,
    direct_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_learning_feedback_allowed: false,
  });
}

export function projectWorldSimulationExperientialMethodCompetition(input = {}) {
  const projections = array(input.experiential_method_transfer_projections)
    .map(verifyTransferProjection);
  const requestedTurn = optionalString(input.current_turn_id);
  const requestedCharacter = optionalString(input.character);
  const filtered = projections.filter((projection) => {
    if (requestedTurn && projection.current_turn_id !== requestedTurn) return false;
    if (requestedCharacter && characterKey(projection.character) !== characterKey(requestedCharacter)) {
      return false;
    }
    return true;
  });
  const grouped = new Map();
  for (const projection of filtered) {
    const key = `${projection.current_turn_id}\u0000${characterKey(projection.character)}`;
    if (grouped.has(key)) {
      const error = new Error("Phase79A accepts at most one canonical Phase76E projection per character/turn.");
      error.code = "WORLD_SIMULATION_EXPERIENTIAL_METHOD_COMPETITION_DUPLICATE_SOURCE";
      throw error;
    }
    grouped.set(key, projection);
  }

  const characterContexts = [];
  for (const projection of grouped.values()) {
    const methods = array(projection.transferred_method_mappings)
      .map((mapping) => normalizedMethod(projection, mapping))
      .sort((left, right) => compareText(left.transfer_ref, right.transfer_ref));
    const pairs = [];
    for (let leftIndex = 0; leftIndex < methods.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < methods.length; rightIndex += 1) {
        pairs.push(pairRecord(methods[leftIndex], methods[rightIndex]));
      }
    }
    const boundedPairs = pairs.slice(0, maximumPairs);
    characterContexts.push({
      character: projection.character,
      current_turn_id: projection.current_turn_id,
      source_phase76e_transfer_hash: projection.transfer_hash,
      transferred_methods: methods.map((method) => ({
        transfer_ref: method.transfer_ref,
        mapping_kind: method.mapping_kind,
        current_cue_refs: cloneJson(method.current_cue_refs),
        method_skeleton_hash: method.method_skeleton_hash,
        source_knowledge_status: method.source_knowledge_status,
      })),
      pairwise_competition_evidence: boundedPairs,
      transferred_method_count: methods.length,
      pair_count: boundedPairs.length,
      competition_candidate_count:
        boundedPairs.filter((pair) => pair.competition_resolution_required).length,
      downstream_resolution_required:
        boundedPairs.some((pair) => pair.competition_resolution_required),
      action_selection_authority: false,
      semantic_revision_authority: false,
    });
  }
  characterContexts.sort((left, right) =>
    compareText(characterKey(left.character), characterKey(right.character))
      || compareText(left.current_turn_id, right.current_turn_id));

  const projection = {
    version: worldSimulationExperientialMethodCompetitionVersion,
    character_contexts: characterContexts,
    source_projection_count: filtered.length,
    competition_candidate_count: characterContexts
      .reduce((sum, context) => sum + context.competition_candidate_count, 0),
    audit: {
      exact_phase76e_source_verified: true,
      same_character_same_turn_grouping_enforced: true,
      pairwise_structural_identity_compared: true,
      current_cue_overlap_compared: true,
      contested_status_preserved: true,
      preference_resolution_performed: false,
      impasse_resolution_performed: false,
      numeric_similarity_confidence_probability_utility_modeled: false,
      action_selection_performed: false,
      plan_goal_belief_current_mind_world_mutation_performed: false,
      same_turn_learning_feedback_performed: false,
    },
  };
  projection.competition_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
