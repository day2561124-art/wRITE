import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimResolverView,
} from "./world-simulation-subjective-claim-projection-service.mjs";
import {
  projectWorldSimulationEffectiveGoalImplementationIntentionExecution,
} from "./world-simulation-goal-implementation-intention-execution-feedback-service.mjs";
import {
  projectWorldSimulationEffectiveRevisedStructuredSelfModel,
} from "./world-simulation-structured-self-model-revision-service.mjs";
import {
  projectWorldSimulationEffectiveSubjectiveBeliefs,
} from "./world-simulation-effective-subjective-belief-projection-service.mjs";

export const worldSimulationSubjectiveMeansFeasibilityInterpretationVersion =
  "phase73b-subjective-means-feasibility-interpretation-v1";

const supportedAssessments = [
  "perceived_feasible",
  "perceived_blocked",
  "uncertain",
];
const maximumConstraintMemoriesPerCharacter = 16;
const maximumRepresentedMeansPerCharacter = 16;
const maximumGroundingsPerCharacter = 32;
const maximumMemoryRefsPerDecision = 8;
const maximumGroundingRefsPerDecision = 8;
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
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_INPUT_INVALID";
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
function findCharacterRecords(container, character) {
  const entry = Object.entries(object(container))
    .find(([name]) => sameCharacter(name, character));
  return object(entry?.[1]);
}
function isConstraintObservationMemory(memoryView) {
  const content = object(memoryView?.content);
  return content.modality === "constraint_related"
    && content.source === "character_visible_world_evidence"
    && content.subjective_interpretation_required === true
    && content.world_truth_authority === false
    && content.actual_means_feasibility_verdict_exposed === false
    && optionalString(memoryView?.source_memory_ref);
}
function representedMeansRef(character, plan) {
  return `phase73b_means_${hashAgentRunValue({
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    character: characterKey(character),
    goal_id: plan.goal_id,
    implementation_intention_id: plan.implementation_intention_id,
    cue_descriptor: plan.cue_descriptor,
    response_descriptor: plan.response_descriptor,
  }).slice(0, 24)}`;
}
function groundingRecord(base) {
  const hash = hashAgentRunValue({
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    grounding: base,
  });
  return {
    grounding_ref: `phase73b_grounding_${hash.slice(0, 24)}`,
    grounding_hash: hash,
    ...base,
  };
}
function phase73aObservationHashCatalog(projections) {
  const catalog = new Map();
  for (const projection of array(projections)) {
    const character = optionalString(projection?.character);
    if (!character) continue;
    const key = characterKey(character);
    const hashes = catalog.get(key) ?? new Set();
    for (const value of array(projection?.observation_content_hashes)) {
      const hash = optionalString(value);
      if (hash) hashes.add(hash);
    }
    catalog.set(key, hashes);
  }
  return catalog;
}
function isPinnedPhase73aSourceRecord(source, turnId, hashCatalog) {
  const character = optionalString(source?.character);
  const memory = object(source?.memory_record);
  if (!character) return false;
  const allowed = hashCatalog.get(characterKey(character));
  if (!allowed?.size) return false;
  return memory?.source?.kind === "direct_perception"
    && memory?.source?.sense === "other_senses"
    && memory?.internal_provenance?.turn_id === turnId
    && allowed.has(hashAgentRunValue(memory?.content ?? null));
}
function buildCharacterContext(worldState, character, constraintMemories) {
  const execution = projectWorldSimulationEffectiveGoalImplementationIntentionExecution({
    world_state: worldState,
  });
  const plans = findCharacterRecords(execution.plans_by_character, character);
  const representedMeans = Object.values(plans)
    .filter((plan) => ["active", "challenged", "suspended"].includes(plan?.state)
      && plan?.completed !== true
      && optionalString(plan?.implementation_intention_id)
      && optionalString(plan?.goal_id))
    .map((plan) => ({
      means_ref: representedMeansRef(character, plan),
      goal_id: plan.goal_id,
      implementation_intention_id: plan.implementation_intention_id,
      plan_state: plan.state,
      execution_state: plan.execution_state ?? null,
      cue_descriptor: cloneJson(plan.cue_descriptor ?? null),
      response_descriptor: cloneJson(plan.response_descriptor ?? null),
      represented_means_only: true,
      objective_feasibility_verified: false,
    }))
    .sort((left, right) => compareText(left.goal_id, right.goal_id)
      || compareText(left.implementation_intention_id, right.implementation_intention_id))
    .slice(0, maximumRepresentedMeansPerCharacter);

  const groundings = [];
  const selfModel = projectWorldSimulationEffectiveRevisedStructuredSelfModel({
    world_state: worldState,
  });
  const aspects = findCharacterRecords(selfModel.aspects_by_character, character);
  for (const aspect of Object.values(aspects)) {
    if (aspect?.state !== "active" || aspect?.aspect_type !== "capability_appraisal") continue;
    groundings.push(groundingRecord({
      character,
      grounding_kind: "active_capability_appraisal",
      character_view: {
        descriptor: cloneJson(aspect.descriptor ?? null),
        subjective_not_world_truth: true,
        self_model_accuracy_claimed: false,
      },
    }));
  }

  const beliefs = projectWorldSimulationEffectiveSubjectiveBeliefs({
    world_state: worldState,
    character,
  });
  for (const belief of array(beliefs?.projection?.active_beliefs)) {
    if (!optionalString(belief?.proposition)) continue;
    groundings.push(groundingRecord({
      character,
      grounding_kind: "active_subjective_belief",
      character_view: {
        proposition: belief.proposition,
        subjective_not_world_truth: true,
      },
    }));
  }

  groundings.sort((left, right) => compareText(left.grounding_kind, right.grounding_kind)
    || compareText(left.grounding_ref, right.grounding_ref));

  return {
    character,
    constraint_memories: constraintMemories.slice(0, maximumConstraintMemoriesPerCharacter),
    represented_means: representedMeans,
    cognition_groundings: groundings.slice(0, maximumGroundingsPerCharacter),
  };
}

export function buildWorldSimulationSubjectiveMeansFeasibilityResolverView(input = {}) {
  const worldState = cloneJson(object(input.world_state));
  const turnId = boundedString(input.turn_id, "turn_id", 240);
  const phase73aHashCatalog = phase73aObservationHashCatalog(
    input.phase73a_observation_projections,
  );
  const pinnedSourceMemoryRecords = array(input.source_memory_records)
    .filter((source) => isPinnedPhase73aSourceRecord(source, turnId, phase73aHashCatalog));
  const claimView = buildWorldSimulationSubjectiveClaimResolverView({
    world_state: worldState,
    turn_id: turnId,
    source_memory_records: pinnedSourceMemoryRecords,
  });

  const characterContexts = [];
  for (const entry of array(claimView.character_evidence)) {
    const character = optionalString(entry?.character);
    if (!character) continue;
    const constraintMemories = array(entry.memories)
      .filter(isConstraintObservationMemory)
      .map((memory) => ({
        source_memory_ref: memory.source_memory_ref,
        content: cloneJson(memory.content),
        source: cloneJson(memory.source),
        possibly_incorrect: memory.possibly_incorrect === true,
        source_confused: memory.source_confused === true,
        subjective_memory_not_world_truth: memory.subjective_memory_not_world_truth !== false,
      }));
    if (!constraintMemories.length) continue;
    characterContexts.push(buildCharacterContext(worldState, character, constraintMemories));
  }
  characterContexts.sort((left, right) =>
    left.character.localeCompare(right.character, "zh-Hant-TW"));

  const view = {
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    turn_id: turnId,
    character_contexts: characterContexts,
    supported_assessments: [...supportedAssessments],
    boundaries: {
      phase73a_derived_current_turn_subjective_memories_only: true,
      phase73a_engine_side_observation_content_hash_lineage_required: true,
      phase73a_lineage_catalog_exposed_to_interpreter: false,
      same_character_context_only: true,
      current_represented_means_only: true,
      character_owned_subjective_beliefs_only: true,
      character_owned_capability_appraisals_only: true,
      raw_world_state_exposed: false,
      raw_phase72_means_status_exposed: false,
      raw_phase72_physical_executability_exposed: false,
      raw_phase72_authorization_status_exposed: false,
      phase73a_source_means_binding_exposed: false,
      objective_feasibility_verification_requested: false,
      world_truth_judgment_requested: false,
      numeric_confidence_probability_requested: false,
      direct_belief_write_requested: false,
      direct_plan_or_goal_mutation_requested: false,
      same_turn_replanning_requested: false,
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
  "means_status",
  "physical_executability",
  "authorization_status",
  "goal_state",
  "plan_state",
  "replan",
]);
const allowedDecisionFields = new Set([
  "character",
  "target_means_ref",
  "assessment",
  "proposition",
  "source_memory_refs",
  "grounding_refs",
]);

function normalizeDecision(raw, index, resolverView) {
  if (!isObject(raw)) {
    const error = new Error(`Phase73B interpretation decision ${index} must be an object.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_DECISION_INVALID";
    throw error;
  }
  const forbidden = Object.keys(raw).filter((key) => forbiddenDecisionFields.has(key));
  if (forbidden.length) {
    const error = new Error(
      `Phase73B interpretation decision may not assert world truth, objective feasibility, or numeric confidence: ${forbidden.join(", ")}.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_AUTHORITY_FIELD_FORBIDDEN";
    error.fields = forbidden;
    throw error;
  }
  const unknown = Object.keys(raw).filter((key) => !allowedDecisionFields.has(key));
  if (unknown.length) {
    const error = new Error(
      `Phase73B interpretation decision contains unsupported fields: ${unknown.join(", ")}.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_DECISION_FIELD_FORBIDDEN";
    error.fields = unknown;
    throw error;
  }

  const character = boundedString(raw.character, `decisions[${index}].character`, 240);
  const context = array(resolverView.character_contexts)
    .find((entry) => sameCharacter(entry.character, character));
  if (!context) {
    const error = new Error(`Phase73B decision has no eligible same-character constraint context for ${character}.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_CHARACTER_OUT_OF_CONTEXT";
    throw error;
  }
  const targetMeansRef = boundedString(
    raw.target_means_ref,
    `decisions[${index}].target_means_ref`,
    180,
  );
  const means = array(context.represented_means)
    .find((entry) => entry.means_ref === targetMeansRef);
  if (!means) {
    const error = new Error(`Phase73B target means ${targetMeansRef} is outside the bounded same-character catalog.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEANS_OUT_OF_CONTEXT";
    throw error;
  }
  const assessment = boundedString(raw.assessment, `decisions[${index}].assessment`, 80);
  if (!supportedAssessments.includes(assessment)) {
    const error = new Error(`Unsupported Phase73B subjective assessment ${assessment}.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_ASSESSMENT_INVALID";
    throw error;
  }
  const proposition = boundedString(raw.proposition, `decisions[${index}].proposition`, 1200);

  const memoryRefs = [...new Set(array(raw.source_memory_refs).map((ref, refIndex) =>
    boundedString(ref, `decisions[${index}].source_memory_refs[${refIndex}]`, 180)))];
  if (memoryRefs.length < 1 || memoryRefs.length > maximumMemoryRefsPerDecision) {
    const error = new Error(
      `Phase73B decision must cite 1-${maximumMemoryRefsPerDecision} Phase73A-derived current-turn subjective memories.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEMORY_EVIDENCE_INVALID";
    throw error;
  }
  const memoryCatalog = new Map(array(context.constraint_memories)
    .map((memory) => [memory.source_memory_ref, memory]));
  if (memoryRefs.some((ref) => !memoryCatalog.has(ref))) {
    const error = new Error("Phase73B decision cites memory outside the bounded same-character Phase73A-derived source set.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_MEMORY_OUT_OF_CONTEXT";
    throw error;
  }

  const groundingRefs = [...new Set(array(raw.grounding_refs).map((ref, refIndex) =>
    boundedString(ref, `decisions[${index}].grounding_refs[${refIndex}]`, 180)))];
  if (groundingRefs.length > maximumGroundingRefsPerDecision) {
    const error = new Error(
      `Phase73B decision may cite at most ${maximumGroundingRefsPerDecision} character-owned cognition groundings.`,
    );
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_GROUNDING_INVALID";
    throw error;
  }
  const groundingCatalog = new Set(array(context.cognition_groundings)
    .map((grounding) => grounding.grounding_ref));
  if (groundingRefs.some((ref) => !groundingCatalog.has(ref))) {
    const error = new Error("Phase73B decision cites grounding outside the bounded same-character cognition catalog.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_GROUNDING_OUT_OF_CONTEXT";
    throw error;
  }

  const identity = {
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    turn_id: resolverView.turn_id,
    character: context.character,
    target_means_ref: targetMeansRef,
    assessment,
    proposition,
    source_memory_refs: memoryRefs.slice().sort(compareText),
    grounding_refs: groundingRefs.slice().sort(compareText),
  };
  return {
    ...identity,
    interpretation_ref: `phase73b_interpretation_${hashAgentRunValue(identity).slice(0, 24)}`,
    goal_id: means.goal_id,
    implementation_intention_id: means.implementation_intention_id,
  };
}

export function buildWorldSimulationSubjectiveMeansFeasibilityClaimProposals(input = {}) {
  const resolverView = cloneJson(object(input.resolver_view));
  const canonical = cloneJson(resolverView);
  const suppliedHash = optionalString(canonical.resolver_view_hash);
  delete canonical.resolver_view_hash;
  if (resolverView.version !== worldSimulationSubjectiveMeansFeasibilityInterpretationVersion
      || !suppliedHash
      || hashAgentRunValue(canonical) !== suppliedHash) {
    const error = new Error("Phase73B requires an exact canonical subjective-feasibility resolver view.");
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_RESOLVER_VIEW_INVALID";
    throw error;
  }
  const rawDecisions = array(input.interpretation_decisions);
  if (rawDecisions.length > maximumDecisionsPerTurn) {
    const error = new Error(`Phase73B allows at most ${maximumDecisionsPerTurn} interpretation decisions per turn.`);
    error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_DECISION_LIMIT";
    throw error;
  }
  const decisions = rawDecisions.map((decision, index) =>
    normalizeDecision(decision, index, resolverView));
  const seen = new Set();
  for (const decision of decisions) {
    const key = `${characterKey(decision.character)}\u0000${decision.target_means_ref}\u0000${decision.interpretation_ref}`;
    if (seen.has(key)) {
      const error = new Error(`Duplicate Phase73B interpretation ${decision.interpretation_ref}.`);
      error.code = "WORLD_SIMULATION_SUBJECTIVE_MEANS_FEASIBILITY_DECISION_DUPLICATE";
      throw error;
    }
    seen.add(key);
  }
  decisions.sort((left, right) => compareText(characterKey(left.character), characterKey(right.character))
    || compareText(left.target_means_ref, right.target_means_ref)
    || compareText(left.interpretation_ref, right.interpretation_ref));

  const proposals = decisions.map((decision) => ({
    proposal_ref: decision.interpretation_ref,
    character: decision.character,
    proposition: decision.proposition,
    evidence: decision.source_memory_refs.map((sourceMemoryRef) => ({
      source_memory_ref: sourceMemoryRef,
      relation: "supports",
    })),
  }));

  return deepFreeze({
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    decisions,
    claim_proposals: proposals,
    resolver_view_hash: suppliedHash,
    audit: {
      interpretation_decision_count: decisions.length,
      claim_proposal_count: proposals.length,
      phase65_claim_pipeline_reused: true,
      parallel_belief_store_created: false,
      same_character_constraint_memories_only: true,
      current_represented_means_only: true,
      character_owned_cognition_grounding_only: true,
      world_truth_authority_claimed: false,
      objective_feasibility_verified: false,
      numeric_confidence_probability_modeled: false,
      direct_belief_write: false,
      direct_plan_or_goal_mutation: false,
      same_turn_replanning_triggered: false,
    },
  });
}

export function buildWorldSimulationSubjectiveMeansFeasibilityInterpretationContract() {
  return deepFreeze({
    version: worldSimulationSubjectiveMeansFeasibilityInterpretationVersion,
    phase: "Phase73B",
    status: "subjective_means_feasibility_interpretation_policy_installed",
    input_source: "Phase73A-derived current-turn subjective memories plus bounded same-character represented means/cognition",
    task_and_situation_specific_interpretation_required: true,
    phase73a_engine_side_observation_content_hash_lineage_required: true,
    phase73a_lineage_catalog_exposed_to_interpreter: false,
    phase73a_source_means_binding_exposed: false,
    phase72_actual_means_status_exposed: false,
    phase72_physical_executability_exposed: false,
    phase72_authorization_status_exposed: false,
    subjective_assessment_may_diverge_from_actual_feasibility: true,
    uncertainty_preserved: true,
    ordinary_phase65_claim_proposals_only: true,
    phase65_conflict_and_phase66_belief_revision_reused: true,
    parallel_belief_store_created: false,
    automatic_belief_creation_without_interpreter: false,
    direct_subjective_belief_write_allowed: false,
    direct_plan_or_goal_mutation_allowed: false,
    same_turn_replanning_allowed: false,
    world_truth_authority_claimed: false,
    numeric_confidence_probability_modeled: false,
    deterministic_bounded_membership_validation_required: true,
  });
}
