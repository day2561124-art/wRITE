import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimResolverView,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
} from "./world-simulation-post-outcome-subjective-memory-bridge-service.mjs";

export const worldSimulationExperienceGroundedSubjectiveLearningVersion =
  "phase76c-experience-grounded-subjective-learning-v1";

const supportedLearningKinds = Object.freeze([
  "action_effectiveness",
  "situational_capability",
]);
const supportedAssessments = Object.freeze([
  "experience_supports_effectiveness",
  "experience_supports_constraint",
  "experience_is_ambiguous",
]);
const maximumExperiencesPerCharacter = 16;
const maximumDecisionsPerTurn = 32;

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
function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function boundedString(value, label, maxLength = 1200) {
  const text = optionalString(value);
  if (!text || text.length > maxLength) {
    const error = new Error(
      `${label} must be a non-empty string no longer than ${maxLength} characters.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_INPUT_INVALID";
    throw error;
  }
  return text;
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function memoryId(memory) {
  return optionalString(memory?.memory_id ?? memory?.id);
}
function phase76bBridgeLineageCatalog(rawBridge, turnId) {
  if (!isObject(rawBridge)) return new Map();
  const bridge = cloneJson(rawBridge);
  const suppliedHash = optionalString(bridge.bridge_hash);
  const body = cloneJson(bridge);
  delete body.bridge_hash;
  if (bridge.version !== worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion
      || bridge.turn_id !== turnId
      || !suppliedHash
      || hashAgentRunValue(body) !== suppliedHash
      || !Array.isArray(bridge.source_entries)) {
    const error = new Error(
      "Phase76C requires a canonical current-turn Phase76B memory bridge when bridge lineage is supplied.",
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_PHASE76B_BRIDGE_INVALID";
    throw error;
  }
  const catalog = new Map();
  for (const entry of bridge.source_entries) {
    const character = optionalString(entry?.character);
    const ref = optionalString(entry?.subjective_perception_ref);
    const hash = optionalString(entry?.subjective_perception_hash);
    if (!character || !ref || !hash) continue;
    catalog.set(`${characterKey(character)}\u0000${ref}`, hash);
  }
  return catalog;
}
function isPinnedPhase76bExperienceSource(source, turnId, bridgeCatalog) {
  const record = object(source?.memory_record);
  const content = object(record.content);
  const character = optionalString(source?.character);
  const perceptionRef = optionalString(
    record.internal_provenance?.post_outcome_subjective_perception_ref,
  );
  const perceptionHash = optionalString(
    record.internal_provenance?.post_outcome_subjective_perception_hash,
  );
  return character
    && memoryId(record)
    && record.memory_type === "episodic_action_experience"
    && record.source?.kind === "post_outcome_subjective_experience"
    && record.source?.sense === "other"
    && record.internal_provenance?.turn_id === turnId
    && record.internal_provenance?.post_outcome_bridge_version
      === worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion
    && perceptionRef
    && perceptionHash
    && bridgeCatalog.get(`${characterKey(character)}\u0000${perceptionRef}`)
      === perceptionHash
    && content.kind === "post_outcome_action_experience"
    && optionalString(content.action)
    && record.subjective_memory_not_world_truth !== false;
}
function isExperienceMemoryView(memoryView) {
  const content = object(memoryView?.content);
  return memoryView?.source?.kind === "post_outcome_subjective_experience"
    && memoryView?.source?.sense === "other"
    && content.kind === "post_outcome_action_experience"
    && optionalString(content.action)
    && optionalString(memoryView?.source_memory_ref)
    && memoryView?.subjective_memory_not_world_truth !== false;
}
function boundedExperienceView(memoryView) {
  const content = object(memoryView?.content);
  const bounded = {
    source_memory_ref: memoryView.source_memory_ref,
    action: boundedString(content.action, "experience action", 1200),
    possibly_incorrect: memoryView.possibly_incorrect === true,
    source_confused: memoryView.source_confused === true,
    subjective_memory_not_world_truth:
      memoryView.subjective_memory_not_world_truth !== false,
  };
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(content, key)) continue;
    const value = content[key];
    if (["string", "number", "boolean"].includes(typeof value)) {
      bounded[key] = cloneJson(value);
    }
  }
  return bounded;
}

export function buildWorldSimulationExperienceGroundedSubjectiveLearningResolverView(
  input = {},
) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const bridgeCatalog = phase76bBridgeLineageCatalog(
    input.phase76b_memory_bridge,
    turnId,
  );
  const pinned = array(input.source_memory_records)
    .filter((source) =>
      isPinnedPhase76bExperienceSource(source, turnId, bridgeCatalog));
  const claimView = buildWorldSimulationSubjectiveClaimResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: pinned,
  });

  const characterContexts = [];
  for (const entry of array(claimView.character_evidence)) {
    const character = optionalString(entry?.character);
    if (!character) continue;
    const experiences = array(entry.memories)
      .filter(isExperienceMemoryView)
      .map(boundedExperienceView)
      .slice(0, maximumExperiencesPerCharacter);
    if (!experiences.length) continue;
    characterContexts.push({ character, experiences });
  }
  characterContexts.sort((left, right) =>
    left.character.localeCompare(right.character, "zh-Hant-TW"));

  const view = {
    version: worldSimulationExperienceGroundedSubjectiveLearningVersion,
    turn_id: turnId,
    character_contexts: characterContexts,
    supported_learning_kinds: [...supportedLearningKinds],
    supported_assessments: [...supportedAssessments],
    required_scope: "single_experience_current_situation",
    boundaries: {
      phase76b_current_turn_action_experience_memories_only: true,
      phase76b_bridge_lineage_catalog_required: true,
      phase76b_bridge_lineage_catalog_exposed_to_interpreter: false,
      same_character_context_only: true,
      single_experience_interpretation_only: true,
      multi_experience_generalization_requested: false,
      global_trait_or_capability_inference_requested: false,
      raw_world_state_exposed: false,
      raw_action_outcome_exposed: false,
      hidden_causal_evidence_exposed: false,
      exact_engine_geometry_exposed: false,
      other_character_private_state_exposed: false,
      internal_memory_provenance_exposed: false,
      numeric_reward_exposed: false,
      q_value_learning_requested: false,
      confidence_probability_requested: false,
      direct_belief_write_requested: false,
      direct_current_mind_write_requested: false,
      direct_plan_or_goal_mutation_requested: false,
      same_turn_character_brain_feedback_requested: false,
    },
  };
  view.resolver_view_hash = hashAgentRunValue(view);
  return deepFreeze(view);
}

const forbiddenDecisionFields = new Set([
  "confidence",
  "probability",
  "belief_probability",
  "truth_probability",
  "world_truth",
  "world_truth_verified",
  "authoritative",
  "reward",
  "q_value",
  "utility",
  "success_rate",
  "failure_rate",
  "global_trait",
  "global_capability",
  "belief_status",
  "revision",
  "replan",
]);
const allowedDecisionFields = new Set([
  "character",
  "source_memory_ref",
  "learning_kind",
  "assessment",
  "scope",
]);

function propositionFor(decision, experience) {
  const action = experience.action;
  if (decision.learning_kind === "action_effectiveness") {
    if (decision.assessment === "experience_supports_effectiveness") {
      return `以「${action}」這個做法，在這次情境中似乎有效。`;
    }
    if (decision.assessment === "experience_supports_constraint") {
      return `以「${action}」這個做法，在這次情境中似乎受到阻礙。`;
    }
    return `以「${action}」這個做法，在這次情境中的效果還不確定。`;
  }
  if (decision.assessment === "experience_supports_effectiveness") {
    return `在這次情境中，我似乎能夠順利進行「${action}」。`;
  }
  if (decision.assessment === "experience_supports_constraint") {
    return `在這次情境中，我似乎無法順利進行「${action}」。`;
  }
  return `在這次情境中，我是否能順利進行「${action}」還不確定。`;
}

function normalizeDecision(raw, index, resolverView) {
  if (!isObject(raw)) {
    const error = new Error(`Phase76C learning decision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_DECISION_INVALID";
    throw error;
  }
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length) {
    const error = new Error(
      `Phase76C decision may not assert numeric value, world truth, global capability, or direct revision authority: ${forbidden.join(", ")}.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_AUTHORITY_FIELD_FORBIDDEN";
    error.fields = forbidden;
    throw error;
  }
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length) {
    const error = new Error(
      `Phase76C learning decision contains unsupported fields: ${unknown.join(", ")}.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_DECISION_FIELD_FORBIDDEN";
    error.fields = unknown;
    throw error;
  }

  const character = boundedString(raw.character, `decisions[${index}].character`, 240);
  const context = array(resolverView.character_contexts)
    .find((entry) => sameCharacter(entry.character, character));
  if (!context) {
    const error = new Error(`Phase76C decision has no eligible same-character experience context for ${character}.`);
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_CHARACTER_OUT_OF_CONTEXT";
    throw error;
  }
  const sourceMemoryRef = boundedString(
    raw.source_memory_ref,
    `decisions[${index}].source_memory_ref`,
    180,
  );
  const experience = array(context.experiences)
    .find((entry) => entry.source_memory_ref === sourceMemoryRef);
  if (!experience) {
    const error = new Error(
      `Phase76C source memory ${sourceMemoryRef} is outside the bounded same-character Phase76B experience set.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_MEMORY_OUT_OF_CONTEXT";
    throw error;
  }
  const learningKind = boundedString(
    raw.learning_kind,
    `decisions[${index}].learning_kind`,
    80,
  );
  if (!supportedLearningKinds.includes(learningKind)) {
    const error = new Error(`Unsupported Phase76C learning kind ${learningKind}.`);
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_KIND_INVALID";
    throw error;
  }
  const assessment = boundedString(
    raw.assessment,
    `decisions[${index}].assessment`,
    100,
  );
  if (!supportedAssessments.includes(assessment)) {
    const error = new Error(`Unsupported Phase76C subjective assessment ${assessment}.`);
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_ASSESSMENT_INVALID";
    throw error;
  }
  const scope = boundedString(raw.scope, `decisions[${index}].scope`, 100);
  if (scope !== resolverView.required_scope) {
    const error = new Error(
      `Phase76C learning scope must remain ${resolverView.required_scope}.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_SCOPE_INVALID";
    throw error;
  }

  const identity = {
    version: worldSimulationExperienceGroundedSubjectiveLearningVersion,
    turn_id: resolverView.turn_id,
    character: context.character,
    source_memory_ref: sourceMemoryRef,
    learning_kind: learningKind,
    assessment,
    scope,
  };
  const interpretationRef =
    `phase76c_learning_${hashAgentRunValue(identity).slice(0, 24)}`;
  return {
    ...identity,
    interpretation_ref: interpretationRef,
    action: experience.action,
    proposition: propositionFor(identity, experience),
  };
}

export function buildWorldSimulationExperienceGroundedSubjectiveLearningClaimProposals(
  input = {},
) {
  const resolverView = cloneJson(object(input.resolver_view));
  const canonical = cloneJson(resolverView);
  const suppliedHash = optionalString(canonical.resolver_view_hash);
  delete canonical.resolver_view_hash;
  if (resolverView.version !== worldSimulationExperienceGroundedSubjectiveLearningVersion
      || !suppliedHash
      || hashAgentRunValue(canonical) !== suppliedHash) {
    const error = new Error(
      "Phase76C requires an exact canonical experience-grounded learning resolver view.",
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const rawDecisions = array(input.interpretation_decisions);
  if (rawDecisions.length > maximumDecisionsPerTurn) {
    const error = new Error(
      `Phase76C allows at most ${maximumDecisionsPerTurn} interpretation decisions per turn.`,
    );
    error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_DECISION_LIMIT";
    throw error;
  }
  const decisions = rawDecisions.map((decision, index) =>
    normalizeDecision(decision, index, resolverView));
  const seen = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.source_memory_ref}\u0000${decision.learning_kind}`;
    if (seen.has(key)) {
      const error = new Error(
        `Duplicate Phase76C ${decision.learning_kind} interpretation for ${decision.source_memory_ref}.`,
      );
      error.code = "WORLD_SIMULATION_EXPERIENCE_GROUNDED_LEARNING_DECISION_DUPLICATE";
      throw error;
    }
    seen.add(key);
  }
  decisions.sort((left, right) =>
    compareText(characterKey(left.character), characterKey(right.character))
      || compareText(left.source_memory_ref, right.source_memory_ref)
      || compareText(left.learning_kind, right.learning_kind));

  const claimProposals = decisions.map((decision) => ({
    proposal_ref: decision.interpretation_ref,
    character: decision.character,
    proposition: decision.proposition,
    evidence: [{
      source_memory_ref: decision.source_memory_ref,
      relation: "supports",
    }],
  }));

  return deepFreeze({
    version: worldSimulationExperienceGroundedSubjectiveLearningVersion,
    decisions,
    claim_proposals: claimProposals,
    resolver_view_hash: suppliedHash,
    audit: {
      interpretation_decision_count: decisions.length,
      claim_proposal_count: claimProposals.length,
      phase76b_action_experience_memories_only: true,
      single_experience_scope_only: true,
      proposition_text_engine_scoped: true,
      multi_experience_generalization_applied: false,
      global_trait_or_capability_inference_applied: false,
      phase65_claim_pipeline_reused: true,
      phase65_phase66_belief_pipeline_reused: true,
      parallel_belief_store_created: false,
      numeric_reward_or_q_value_modeled: false,
      world_truth_authority_claimed: false,
      direct_belief_write: false,
      direct_current_mind_write: false,
      direct_plan_or_goal_mutation: false,
      same_turn_character_brain_feedback_triggered: false,
    },
  });
}

export function buildWorldSimulationExperienceGroundedSubjectiveLearningContract() {
  return deepFreeze({
    version: worldSimulationExperienceGroundedSubjectiveLearningVersion,
    phase: "Phase76C",
    status: "single_experience_grounded_subjective_learning_interpretation_installed",
    input_source: "Phase76B current-turn episodic_action_experience subjective memories only",
    phase76b_lineage_required: true,
    canonical_phase76b_bridge_hash_verified_when_supplied: true,
    phase76b_bridge_lineage_catalog_required_for_eligibility: true,
    phase76b_bridge_lineage_catalog_exposed_to_interpreter: false,
    same_character_current_turn_memory_required: true,
    single_experience_current_situation_scope_required: true,
    supported_learning_kinds: [...supportedLearningKinds],
    supported_assessments: [...supportedAssessments],
    interpreter_selects_bounded_assessment_only: true,
    proposition_text_engine_scoped: true,
    multi_experience_generalization_modeled: false,
    eager_semanticization_used: false,
    global_trait_or_capability_inference_modeled: false,
    numeric_reward_modeled: false,
    q_value_learning_modeled: false,
    raw_world_state_exposed: false,
    raw_action_outcome_exposed: false,
    hidden_causal_evidence_exposed: false,
    other_character_private_state_exposed: false,
    internal_memory_provenance_exposed: false,
    ordinary_phase65_claim_proposals_only: true,
    phase65_conflict_and_phase66_belief_revision_reused: true,
    parallel_belief_store_created: false,
    automatic_claim_creation_without_interpreter: false,
    direct_subjective_belief_write_allowed: false,
    direct_current_mind_write_allowed: false,
    direct_plan_or_goal_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    world_truth_authority_claimed: false,
    confidence_probability_modeled: false,
  });
}
