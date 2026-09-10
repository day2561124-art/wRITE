import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationExperientialMethodImpasseDeliberationVersion } from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";
import { worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion } from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceCandidateProjection,
  worldSimulationAnalogicalExperienceCandidateVersion,
} from "./world-simulation-analogical-experience-candidate-service.mjs";
import { worldSimulationAnalogicalExperienceAdaptationVersion } from "./world-simulation-analogical-experience-adaptation-service.mjs";

export const worldSimulationAnalogicalExperienceRevalidationVersion =
  "phase80c-adapted-analogy-current-context-revalidation-v1";

const maximumRevalidatedMethodCount = 16;

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
function text(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function projectionHash(value, hashField) {
  const body = cloneJson(value);
  delete body[hashField];
  return hashAgentRunValue(body);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}

function verifyPhase79D(value) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodImpasseDeliberationVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.impasse_hash)
      || !Array.isArray(projection.impasse_contexts)
      || projectionHash(projection, "impasse_hash") !== projection.impasse_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_PHASE79D_INVALID",
      "Phase80C requires an exact canonical Phase79D impasse projection.",
    );
  }
  return projection;
}

function verifyPhase79E(value, phase79D) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.evidence_hash)
      || !Array.isArray(projection.impasse_evidence_contexts)
      || projection.source_phase79d_impasse_hash !== phase79D.impasse_hash
      || characterKey(projection.character) !== characterKey(phase79D.character)
      || projection.current_turn_id !== phase79D.current_turn_id
      || projectionHash(projection, "evidence_hash") !== projection.evidence_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_PHASE79E_INVALID",
      "Phase80C requires the exact same-turn canonical Phase79E evidence projection.",
    );
  }
  return projection;
}

function verifyPhase80B(value, phase80A) {
  const projection = cloneJson(object(value));
  if (projection.version !== worldSimulationAnalogicalExperienceAdaptationVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !text(projection.projection_hash)
      || !Array.isArray(projection.adaptation_decisions)
      || projection.adaptation_decision_count !== projection.adaptation_decisions.length
      || projection.adaptation_decision_count > maximumRevalidatedMethodCount
      || projection.source_phase80a_projection_hash !== phase80A.projection_hash
      || characterKey(projection.character) !== characterKey(phase80A.character)
      || projection.current_turn_id !== phase80A.current_turn_id
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_PHASE80B_INVALID",
      "Phase80C requires the exact canonical Phase80B adaptation projection.",
    );
  }
  return projection;
}

function currentCueProjection(cue, adaptationRole) {
  return {
    cue_kind: text(cue?.cue_kind),
    content: cloneJson(cue?.content ?? null),
    adaptation_role: adaptationRole,
    same_turn_character_visible_context: true,
    world_truth_authority: false,
  };
}

export function buildWorldSimulationAnalogicalExperienceRevalidationContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceRevalidationVersion,
    phase: "Phase80C",
    status: "adapted_analogy_current_context_revalidation_installed",
    source_owners: ["Phase79D", "Phase79E", "Phase80A", "Phase80B"],
    exact_source_hashes_and_same_turn_lineage_required: true,
    current_corresponding_method_identity_reverified: true,
    selected_current_cue_refs_reverified: true,
    current_method_semantics_reused_from_phase79d_only: true,
    historical_method_semantics_copied: false,
    dropped_historical_cues_exposed_as_current_context: false,
    deterministic_revalidation_only: true,
    additional_resolver_required: false,
    advisory_guidance_only: true,
    existing_action_proposer_remains_candidate_generation_owner: true,
    preference_resolution_performed: false,
    action_selection_performed: false,
    semantic_method_rewrite_performed: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    fuzzy_semantic_similarity_modeled: false,
    world_truth_authority_claimed: false,
    maximum_revalidated_method_count: maximumRevalidatedMethodCount,
  });
}

export function projectWorldSimulationAnalogicalExperienceRevalidation(input = {}) {
  const phase79D = verifyPhase79D(input.source_phase79d_impasse_deliberation);
  const phase79E = verifyPhase79E(
    input.source_phase79e_discriminating_evidence,
    phase79D,
  );
  const phase80A = assertWorldSimulationAnalogicalExperienceCandidateProjection(
    input.source_phase80a_projection,
  );
  if (phase80A.version !== worldSimulationAnalogicalExperienceCandidateVersion
      || phase80A.source_phase79e_evidence_hash !== phase79E.evidence_hash
      || characterKey(phase80A.character) !== characterKey(phase79D.character)
      || phase80A.current_turn_id !== phase79D.current_turn_id) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_PHASE80A_LINEAGE_MISMATCH",
      "Phase80C Phase79D/79E/80A same-turn lineage does not match.",
    );
  }
  const phase80B = verifyPhase80B(input.source_phase80b_adaptation, phase80A);

  const candidateByRef = new Map(array(phase80A.analogy_candidates)
    .map((candidate) => [candidate.analogy_candidate_ref, candidate]));
  const impasseByRef = new Map(array(phase79D.impasse_contexts)
    .map((context) => [context.impasse_ref, context]));
  const evidenceByRef = new Map(array(phase79E.impasse_evidence_contexts)
    .map((context) => [context.impasse_ref, context]));

  const adaptedMethods = array(phase80B.adaptation_decisions).map((decision, index) => {
    const candidate = candidateByRef.get(decision?.analogy_candidate_ref);
    if (!candidate
        || decision.current_impasse_ref !== candidate.current_impasse_ref
        || decision.current_corresponding_method_ref !== candidate.current_corresponding_method_ref) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_ADAPTATION_LINEAGE_MISMATCH",
        `Phase80C adaptation decision ${index} does not match its canonical Phase80A candidate.`,
      );
    }
    const impasse = impasseByRef.get(candidate.current_impasse_ref);
    const evidence = evidenceByRef.get(candidate.current_impasse_ref);
    if (!impasse || !evidence) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_CURRENT_IMPASSE_MISSING",
        "Phase80C cannot resolve the current impasse against Phase79D/79E.",
      );
    }
    const currentMethod = array(impasse.candidate_methods)
      .find((method) => method?.transfer_ref === candidate.current_corresponding_method_ref);
    if (!currentMethod
        || hashAgentRunValue(currentMethod.method_skeleton ?? null)
          !== candidate.current_corresponding_method_skeleton_hash) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_CURRENT_METHOD_MISMATCH",
        "Phase80C current corresponding method identity no longer matches the current impasse.",
      );
    }
    const currentCueByRef = new Map(array(evidence.current_context_cue_catalog)
      .map((cue) => [cue?.cue_ref, cue]));
    const retainedRefs = array(decision.retain_aligned_current_cue_refs);
    const incorporatedRefs = array(decision.incorporate_current_cue_refs);
    const selectedRefs = [...retainedRefs, ...incorporatedRefs];
    if (new Set(selectedRefs).size !== selectedRefs.length
        || selectedRefs.some((ref) => !currentCueByRef.has(ref))) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_REVALIDATION_CURRENT_CUE_MISMATCH",
        "Phase80C selected current cue refs must still exist in the canonical Phase79E catalog.",
      );
    }
    const retainedContext = retainedRefs
      .map((ref) => currentCueProjection(currentCueByRef.get(ref), "retained_alignment"));
    const incorporatedContext = incorporatedRefs
      .map((ref) => currentCueProjection(currentCueByRef.get(ref), "incorporated_difference"));
    return {
      analogy_candidate_ref: candidate.analogy_candidate_ref,
      current_impasse_ref: candidate.current_impasse_ref,
      current_corresponding_method_ref: candidate.current_corresponding_method_ref,
      method_skeleton: cloneJson(currentMethod.method_skeleton ?? null),
      source_knowledge_status: currentMethod.source_knowledge_status ?? "supported",
      mapping_kind: currentMethod.mapping_kind ?? null,
      current_context_basis: [...retainedContext, ...incorporatedContext],
      current_context_revalidated: true,
      adaptation_difference_addressed: true,
      structural_method_identity_preserved: true,
      historical_surface_case_replayed: false,
      historical_method_semantics_copied: false,
      advisory_only: true,
      candidate_action_generation_deferred_to_existing_action_proposer: true,
      preference_selected: false,
      action_selected: false,
      world_truth_authority: false,
    };
  }).sort((left, right) => compareText(left.analogy_candidate_ref, right.analogy_candidate_ref));

  const projection = {
    version: worldSimulationAnalogicalExperienceRevalidationVersion,
    character: phase80B.character,
    current_turn_id: phase80B.current_turn_id,
    current_state_revision: phase80A.current_state_revision,
    current_world_state_hash: phase80A.current_world_state_hash,
    source_phase79d_impasse_hash: phase79D.impasse_hash,
    source_phase79e_evidence_hash: phase79E.evidence_hash,
    source_phase80a_projection_hash: phase80A.projection_hash,
    source_phase80b_adaptation_hash: phase80B.projection_hash,
    revalidated_method_count: adaptedMethods.length,
    revalidated_adapted_methods: adaptedMethods,
    character_view: {
      source: "revalidated_difference_aware_analogical_method_guidance",
      adapted_methods: adaptedMethods.map((method) => cloneJson(method)),
      current_context_revalidated: true,
      advisory_only: true,
      candidate_action_generation_owner: "existing_world_action_proposer",
      preference_authority: false,
      selected_action_authority: false,
      semantic_revision_authority: false,
      world_truth_authority: false,
    },
    audit: {
      exact_phase79d_source_verified: true,
      exact_phase79e_source_verified: true,
      exact_phase80a_source_verified: true,
      exact_phase80b_source_verified: true,
      same_character_same_turn_lineage_verified: true,
      current_corresponding_method_identity_reverified: true,
      selected_current_cue_refs_reverified: true,
      current_method_semantics_reused_from_phase79d_only: true,
      dropped_historical_cues_exposed_as_current_context: false,
      additional_resolver_used: false,
      resolver_authored_semantic_method_content: false,
      preference_resolution_performed: false,
      action_selection_performed: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      fuzzy_semantic_similarity_used: false,
      world_truth_authority_claimed: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return deepFreeze(projection);
}
