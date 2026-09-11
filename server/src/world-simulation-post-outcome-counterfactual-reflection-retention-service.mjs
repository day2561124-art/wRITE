import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationPostOutcomeCounterfactualAppraisalResolverView,
  buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView,
  worldSimulationPostOutcomeCounterfactualAppraisalVersion,
} from "./world-simulation-post-outcome-counterfactual-appraisal-service.mjs";

export const worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion =
  "phase81c-counterfactual-reflection-retention-capsule-v1";

const maximumRetentionCapsuleCount = 552;
const maximumCollectionItems = 12;
const maximumObjectEntries = 16;
const maximumStringLength = 600;
const maximumDepth = 4;

const privateContextKeys = new Set([
  "world_state",
  "scene_state",
  "raw_world_state",
  "raw_causal_outcome",
  "raw_causal_evidence",
  "causal_evidence",
  "causal_chain",
  "hidden_causal_evidence",
  "world_truth",
  "counterfactual_world_truth",
  "causal_superiority",
  "probability",
  "confidence",
  "utility",
  "utility_score",
  "reward",
  "q_value",
  "regret_score",
  "relief_score",
  "emotion_intensity",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function privateContextKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  return privateContextKeys.has(normalized)
    || normalized.startsWith("engine_")
    || normalized.startsWith("internal_")
    || normalized.endsWith("_hash")
    || normalized.endsWith("_id")
    || normalized.endsWith("_ids");
}

function boundedContextValue(value, depth = 0) {
  if (depth > maximumDepth || value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, maximumStringLength);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, maximumCollectionItems)
      .map((item) => boundedContextValue(item, depth + 1))
      .filter((item) => item !== null && item !== undefined);
  }
  if (!isObject(value)) return null;
  const output = {};
  for (const key of Object.keys(value).sort(compareText).slice(0, maximumObjectEntries)) {
    if (privateContextKey(key)) continue;
    const child = boundedContextValue(value[key], depth + 1);
    if (child === null || child === undefined) continue;
    if (Array.isArray(child) && child.length === 0) continue;
    if (isObject(child) && Object.keys(child).length === 0) continue;
    output[key] = child;
  }
  return output;
}

function boundedSubjectiveExperience(value) {
  const source = isObject(value) ? value : {};
  const output = {};
  for (const key of ["performed", "perceived_result", "perceived_status"]) {
    if (!Object.hasOwn(source, key)) continue;
    const bounded = boundedContextValue(source[key]);
    if (bounded !== null && bounded !== undefined) output[key] = bounded;
  }
  return output;
}

function boundedCandidate(value) {
  const bounded = boundedContextValue(value);
  return isObject(bounded) ? bounded : {};
}

function boundedBranch(branch) {
  if (!isObject(branch)) return null;
  const branchRef = text(branch.branch_ref);
  const branchKind = text(branch.branch_kind);
  const horizon = text(branch.horizon);
  const epistemicStatus = text(branch.epistemic_status);
  if (!branchRef || !branchKind || !horizon || !epistemicStatus
      || branch.world_truth_authority !== false
      || branch.causal_outcome_authority !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_BRANCH_INVALID",
      "Phase81C requires exact bounded Phase81A subjective-possibility branch metadata.",
    );
  }
  return {
    branch_ref: branchRef,
    branch_kind: branchKind,
    horizon,
    epistemic_status: epistemicStatus,
    source_paths: array(branch.source_paths)
      .map((item) => text(item))
      .filter(Boolean)
      .slice(0, maximumCollectionItems),
    grounding_refs: array(branch.grounding_refs)
      .map((item) => text(item))
      .filter(Boolean)
      .slice(0, maximumCollectionItems),
    world_truth_authority: false,
    causal_outcome_authority: false,
  };
}

function projectionHash(value, hashField = "projection_hash") {
  const body = cloneJson(value);
  delete body[hashField];
  return hashAgentRunValue(body);
}

function verifyPhase81BProjection(value, resolverView) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationPostOutcomeCounterfactualAppraisalVersion
      || projection.phase !== "Phase81B"
      || projection.world_simulation_session_id !== resolverView.world_simulation_session_id
      || projection.turn_id !== resolverView.turn_id
      || projection.state_revision !== resolverView.state_revision
      || projection.world_state_hash !== resolverView.world_state_hash
      || projection.source_phase81a_resolver_view_hash
        !== resolverView.source_phase81a_resolver_view_hash
      || projection.source_phase81a_projection_hash !== resolverView.source_phase81a_projection_hash
      || projection.resolver_view_hash !== resolverView.resolver_view_hash
      || !Array.isArray(projection.counterfactual_appraisals)
      || projection.counterfactual_appraisal_count !== projection.counterfactual_appraisals.length
      || projection.counterfactual_appraisal_count > maximumRetentionCapsuleCount
      || !isObject(projection.audit)
      || !text(projection.projection_hash)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_INVALID",
      "Phase81C requires the exact canonical Phase81B appraisal projection and resolver lineage.",
    );
  }
  if (projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_HASH_MISMATCH",
      "Phase81C Phase81B appraisal projection hash verification failed.",
    );
  }
  if (projection.audit.unchosen_outcome_observed !== false
      || projection.audit.raw_causal_outcome_consumed !== false
      || projection.audit.raw_world_state_consumed !== false
      || projection.audit.regret_relief_are_subjective_appraisal_not_objective_forgone_outcome_fact !== true
      || projection.audit.causal_self_blame_inferred !== false
      || projection.audit.counterfactual_world_truth_claimed !== false
      || projection.audit.numeric_emotion_regret_relief_utility_reward_q_value_probability_modeled !== false
      || projection.audit.automatic_preference_action_belief_revision !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.same_turn_action_selection_feedback !== false) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_BOUNDARY_INVALID",
      "Phase81C rejects Phase81B appraisal that violates the sealed counterfactual authority boundary.",
    );
  }

  const contextsByEvidenceRef = new Map(
    resolverView.appraisal_contexts.map((context) => [context.counterfactual_evidence_ref, context]),
  );
  const seen = new Set();
  for (const [index, appraisal] of projection.counterfactual_appraisals.entries()) {
    const context = contextsByEvidenceRef.get(appraisal?.counterfactual_evidence_ref);
    if (!context
        || !isObject(appraisal)
        || appraisal.version !== worldSimulationPostOutcomeCounterfactualAppraisalVersion
        || appraisal.turn_id !== projection.turn_id
        || appraisal.character !== context.character
        || appraisal.counterfactual_evidence_hash !== context.source_lineage.counterfactual_evidence_hash
        || appraisal.actual_selected_action_ref !== context.actual_selected_action.action_ref
        || appraisal.alternative_action_ref !== context.imagined_alternative.alternative_action_ref
        || appraisal.comparison_direction !== context.comparison_direction
        || !text(appraisal.appraisal_kind)
        || !text(appraisal.preparative_orientation)
        || !Array.isArray(appraisal.salient_branch_refs)
        || appraisal.appraisal_is_subjective_not_forgone_outcome_fact !== true
        || appraisal.unchosen_outcome_observed !== false
        || appraisal.causal_self_blame_inferred !== false
        || appraisal.causal_superiority_inferred !== false
        || appraisal.numeric_emotion_intensity_assigned !== false
        || appraisal.numeric_regret_relief_assigned !== false
        || appraisal.automatic_preference_revision_performed !== false
        || appraisal.action_selected !== false
        || appraisal.belief_revision_performed !== false
        || appraisal.semantic_revision_performed !== false
        || appraisal.memory_rewrite_performed !== false
        || appraisal.world_state_mutated !== false
        || !text(appraisal.counterfactual_appraisal_ref)
        || !text(appraisal.counterfactual_appraisal_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_APPRAISAL_INVALID",
        `Phase81C Phase81B appraisal ${index} is invalid or cannot resolve its exact bounded context.`,
      );
    }
    const identity = {
      version: worldSimulationPostOutcomeCounterfactualAppraisalVersion,
      turn_id: appraisal.turn_id,
      character: appraisal.character,
      counterfactual_evidence_ref: appraisal.counterfactual_evidence_ref,
      counterfactual_evidence_hash: appraisal.counterfactual_evidence_hash,
      actual_selected_action_ref: appraisal.actual_selected_action_ref,
      alternative_action_ref: appraisal.alternative_action_ref,
      comparison_direction: appraisal.comparison_direction,
      appraisal_kind: appraisal.appraisal_kind,
      preparative_orientation: appraisal.preparative_orientation,
      salient_branch_refs: cloneJson(appraisal.salient_branch_refs),
    };
    const expectedHash = hashAgentRunValue(identity);
    if (appraisal.counterfactual_appraisal_hash !== expectedHash
        || appraisal.counterfactual_appraisal_ref !== `phase81b_appraisal_${expectedHash.slice(0, 24)}`
        || seen.has(appraisal.counterfactual_appraisal_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_PHASE81B_APPRAISAL_HASH_MISMATCH",
        `Phase81C Phase81B appraisal ${index} identity verification failed.`,
      );
    }
    const visibleRefs = new Set(context.imagined_alternative.supporting_branch_refs);
    for (const branchRef of appraisal.salient_branch_refs) {
      if (!visibleRefs.has(branchRef)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_BRANCH_OUT_OF_VIEW",
          `Phase81C appraisal references a salient branch outside its exact Phase81A support: ${branchRef}.`,
        );
      }
    }
    seen.add(appraisal.counterfactual_appraisal_ref);
  }
  return projection;
}

function canonicalSources(input) {
  const suppliedView = assertWorldSimulationPostOutcomeCounterfactualAppraisalResolverView(
    input.counterfactual_appraisal_resolver_view,
  );
  const rebuiltView = buildWorldSimulationPostOutcomeCounterfactualAppraisalResolverView({
    counterfactual_alternative_resolver_view:
      input.counterfactual_alternative_resolver_view,
    post_outcome_counterfactual_alternative_evidence:
      input.post_outcome_counterfactual_alternative_evidence,
  });
  if (suppliedView.resolver_view_hash !== rebuiltView.resolver_view_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_VIEW_STALE",
      "Phase81C appraisal resolver view no longer matches the exact Phase81A source lineage.",
    );
  }
  const projection = verifyPhase81BProjection(
    input.post_outcome_counterfactual_appraisal,
    suppliedView,
  );
  return { view: suppliedView, projection };
}

export function buildWorldSimulationPostOutcomeCounterfactualReflectionRetentionContract() {
  return Object.freeze({
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    phase: "Phase81C",
    status: "bounded_counterfactual_reflection_retention_capsule_installed",
    source_appraisal_owner: "Phase81B",
    source_alternative_owner: "Phase81A",
    exact_phase81a_phase81b_lineage_required: true,
    actual_subjective_experience_retained_as_experienced_anchor: true,
    imagined_alternative_retained_as_counterfactual_possibility_only: true,
    only_phase81b_salient_branch_metadata_retained: true,
    preparative_orientation_retained_as_candidate_not_policy: true,
    source_monitoring_boundary_explicit: true,
    counterfactual_capsule_is_not_episodic_fact_memory: true,
    unchosen_outcome_observed: false,
    causal_superiority_inferred: false,
    automatic_preference_revision_performed: false,
    automatic_action_selection_performed: false,
    automatic_belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_state_mutation_performed: false,
    same_turn_reentry_allowed: false,
    append_only_world_history_persistence: true,
    persistence_only_with_successful_world_turn_commit: true,
    maximum_retention_capsule_count: maximumRetentionCapsuleCount,
  });
}

export function assertWorldSimulationPostOutcomeCounterfactualReflectionRetention(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion
      || projection.phase !== "Phase81C"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase81b_projection_hash)
      || !text(projection.source_phase81b_resolver_view_hash)
      || !text(projection.source_phase81a_projection_hash)
      || !text(projection.source_phase81a_resolver_view_hash)
      || !Array.isArray(projection.capsules)
      || projection.capsule_count !== projection.capsules.length
      || projection.capsule_count > maximumRetentionCapsuleCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || projectionHash(projection) !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_INVALID",
      "Phase81C retention projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_LINEAGE_MISMATCH",
        `Phase81C projection ${key} does not match expected lineage.`,
      );
    }
  }
  if (projection.audit.actual_and_imagined_sources_explicitly_separated !== true
      || projection.audit.unchosen_outcome_observed !== false
      || projection.audit.counterfactual_world_truth_claimed !== false
      || projection.audit.causal_superiority_inferred !== false
      || projection.audit.numeric_emotion_utility_reward_q_value_probability_modeled !== false
      || projection.audit.automatic_preference_action_belief_revision !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.same_turn_reentry_performed !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.failed_or_blocked_turn_persists_capsules !== false
      || projection.persistence_boundary.future_reentry_requires_separate_projection !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_BOUNDARY_INVALID",
      "Phase81C projection violates the counterfactual source-monitoring or authority boundary.",
    );
  }
  const seen = new Set();
  for (const capsule of projection.capsules) {
    if (!isObject(capsule)
        || capsule.version !== worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion
        || !text(capsule.character)
        || !text(capsule.source_phase81b_appraisal_ref)
        || !text(capsule.source_phase81b_appraisal_hash)
        || !text(capsule.source_phase81a_evidence_ref)
        || !text(capsule.source_phase81a_evidence_hash)
        || !text(capsule.source_phase74d_receipt_hash)
        || !text(capsule.source_phase76a_subjective_perception_ref)
        || !isObject(capsule.actual_experienced_anchor)
        || !isObject(capsule.imagined_alternative_context)
        || !text(capsule.comparison_direction)
        || !text(capsule.appraisal_kind)
        || !text(capsule.preparative_orientation)
        || !isObject(capsule.source_monitoring)
        || capsule.source_monitoring.actual_anchor_source !== "experienced_subjective_outcome"
        || capsule.source_monitoring.alternative_source !== "imagined_decision_time_possibility"
        || capsule.source_monitoring.appraisal_source !== "subjective_counterfactual_reflection"
        || capsule.source_monitoring.sources_may_not_be_collapsed !== true
        || capsule.counterfactual_capsule_is_episodic_fact_memory !== false
        || capsule.unchosen_outcome_observed !== false
        || capsule.counterfactual_world_truth_claimed !== false
        || capsule.causal_superiority_inferred !== false
        || capsule.automatic_preference_revision_performed !== false
        || capsule.action_selected !== false
        || capsule.belief_revision_performed !== false
        || capsule.semantic_revision_performed !== false
        || capsule.subjective_memory_rewrite_performed !== false
        || capsule.world_state_mutated !== false
        || capsule.same_turn_reentry_allowed !== false
        || !text(capsule.capsule_ref)
        || !text(capsule.capsule_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_CAPSULE_INVALID",
        "Phase81C retention capsule violates its bounded source-monitoring contract.",
      );
    }
    const actualAnchor = capsule.actual_experienced_anchor;
    const imaginedContext = capsule.imagined_alternative_context;
    if (actualAnchor.source_kind !== "experienced_subjective_outcome"
        || actualAnchor.world_truth_authority !== false
        || !text(actualAnchor.selected_action_ref)
        || !text(actualAnchor.selected_action_id)
        || !text(actualAnchor.subjective_perception_ref)
        || !isObject(actualAnchor.subjective_experience)
        || imaginedContext.source_kind !== "imagined_decision_time_possibility"
        || !text(imaginedContext.alternative_action_ref)
        || !text(imaginedContext.alternative_action_id)
        || !isObject(imaginedContext.decision_time_candidate)
        || !Array.isArray(imaginedContext.salient_branches)
        || !Array.isArray(imaginedContext.salient_branch_refs)
        || imaginedContext.alternative_available_at_decision_time !== true
        || imaginedContext.alternative_was_selected !== false
        || imaginedContext.alternative_outcome_observed !== false
        || imaginedContext.branches_are_subjective_possibilities_not_predictions !== true) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_SOURCE_BOUNDARY_INVALID",
        "Phase81C capsule must preserve explicit experienced-versus-imagined source boundaries.",
      );
    }
    if (hashAgentRunValue(boundedSubjectiveExperience(actualAnchor.subjective_experience))
          !== hashAgentRunValue(actualAnchor.subjective_experience)
        || hashAgentRunValue(boundedCandidate(imaginedContext.decision_time_candidate))
          !== hashAgentRunValue(imaginedContext.decision_time_candidate)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_CONTEXT_INVALID",
        "Phase81C historical capsule contains non-canonical or private retained context.",
      );
    }
    const canonicalBranches = imaginedContext.salient_branches
      .map((branch) => boundedBranch(branch))
      .sort((left, right) => compareText(left.branch_ref, right.branch_ref));
    const canonicalBranchRefs = imaginedContext.salient_branch_refs
      .map((branchRef) => text(branchRef))
      .filter(Boolean)
      .sort(compareText);
    if (canonicalBranchRefs.length !== imaginedContext.salient_branch_refs.length
        || new Set(canonicalBranchRefs).size !== canonicalBranchRefs.length
        || hashAgentRunValue(canonicalBranches) !== hashAgentRunValue(imaginedContext.salient_branches)
        || hashAgentRunValue(canonicalBranchRefs) !== hashAgentRunValue(imaginedContext.salient_branch_refs)
        || hashAgentRunValue(canonicalBranches.map((branch) => branch.branch_ref))
          !== hashAgentRunValue(canonicalBranchRefs)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_BRANCH_CONTEXT_INVALID",
        "Phase81C capsule salient branch metadata is not canonical or does not match its refs.",
      );
    }
    const identity = cloneJson(capsule);
    for (const key of [
      "capsule_ref",
      "capsule_hash",
      "counterfactual_capsule_is_episodic_fact_memory",
      "unchosen_outcome_observed",
      "counterfactual_world_truth_claimed",
      "causal_superiority_inferred",
      "automatic_preference_revision_performed",
      "action_selected",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "world_state_mutated",
      "same_turn_reentry_allowed",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (capsule.capsule_hash !== expectedHash
        || capsule.capsule_ref !== `phase81c_reflection_${expectedHash.slice(0, 24)}`
        || seen.has(capsule.capsule_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_CAPSULE_HASH_MISMATCH",
        "Phase81C retention capsule identity verification failed.",
      );
    }
    seen.add(capsule.capsule_ref);
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationPostOutcomeCounterfactualReflectionRetention(input = {}) {
  const { view, projection: phase81B } = canonicalSources(input);
  const contextsByEvidenceRef = new Map(
    view.appraisal_contexts.map((context) => [context.counterfactual_evidence_ref, context]),
  );
  const capsules = phase81B.counterfactual_appraisals.map((appraisal) => {
    const context = contextsByEvidenceRef.get(appraisal.counterfactual_evidence_ref);
    if (!context) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_CONTEXT_UNRESOLVED",
        `Phase81C cannot resolve appraisal context ${appraisal.counterfactual_evidence_ref}.`,
      );
    }
    const salientRefs = new Set(appraisal.salient_branch_refs);
    const salientBranches = array(context.imagined_alternative.supporting_branches)
      .filter((branch) => salientRefs.has(branch?.branch_ref))
      .map(boundedBranch)
      .filter(Boolean)
      .sort((left, right) => compareText(left.branch_ref, right.branch_ref));
    if (salientBranches.length !== salientRefs.size) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_REFLECTION_RETENTION_BRANCH_LINEAGE_INVALID",
        "Phase81C could not resolve every salient Phase81B branch from the exact Phase81A support set.",
      );
    }
    const identity = {
      version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
      world_simulation_session_id: view.world_simulation_session_id,
      source_turn_id: view.turn_id,
      source_state_revision: view.state_revision,
      source_world_state_hash: view.world_state_hash,
      character: appraisal.character,
      source_phase81b_appraisal_ref: appraisal.counterfactual_appraisal_ref,
      source_phase81b_appraisal_hash: appraisal.counterfactual_appraisal_hash,
      source_phase81b_projection_hash: phase81B.projection_hash,
      source_phase81b_resolver_view_hash: view.resolver_view_hash,
      source_phase81a_projection_hash: view.source_phase81a_projection_hash,
      source_phase81a_resolver_view_hash: view.source_phase81a_resolver_view_hash,
      source_phase81a_evidence_ref: appraisal.counterfactual_evidence_ref,
      source_phase81a_evidence_hash: appraisal.counterfactual_evidence_hash,
      source_phase74d_receipt_hash: context.source_lineage.source_phase74d_receipt_hash,
      source_phase76a_subjective_perception_ref:
        context.source_lineage.source_phase76a_subjective_perception_ref,
      actual_experienced_anchor: {
        selected_action_ref: context.actual_selected_action.action_ref,
        selected_action_id: context.actual_selected_action.action_id,
        subjective_perception_ref: context.actual_selected_action.subjective_perception_ref,
        subjective_experience: boundedSubjectiveExperience(
          context.actual_selected_action.subjective_experience,
        ),
        source_kind: "experienced_subjective_outcome",
        world_truth_authority: false,
      },
      imagined_alternative_context: {
        alternative_action_ref: context.imagined_alternative.alternative_action_ref,
        alternative_action_id: context.imagined_alternative.alternative_action_id,
        decision_time_candidate: boundedCandidate(
          context.imagined_alternative.decision_time_candidate,
        ),
        salient_branches: salientBranches,
        salient_branch_refs: [...salientRefs].sort(compareText),
        source_kind: "imagined_decision_time_possibility",
        alternative_available_at_decision_time: true,
        alternative_was_selected: false,
        alternative_outcome_observed: false,
        branches_are_subjective_possibilities_not_predictions: true,
      },
      comparison_direction: appraisal.comparison_direction,
      appraisal_kind: appraisal.appraisal_kind,
      preparative_orientation: appraisal.preparative_orientation,
      source_monitoring: {
        actual_anchor_source: "experienced_subjective_outcome",
        alternative_source: "imagined_decision_time_possibility",
        appraisal_source: "subjective_counterfactual_reflection",
        sources_may_not_be_collapsed: true,
      },
    };
    const capsuleHash = hashAgentRunValue(identity);
    return {
      capsule_ref: `phase81c_reflection_${capsuleHash.slice(0, 24)}`,
      capsule_hash: capsuleHash,
      ...identity,
      counterfactual_capsule_is_episodic_fact_memory: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      automatic_preference_revision_performed: false,
      action_selected: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      world_state_mutated: false,
      same_turn_reentry_allowed: false,
    };
  });
  capsules.sort((left, right) => compareText(
    `${left.character}\u0000${left.capsule_ref}`,
    `${right.character}\u0000${right.capsule_ref}`,
  ));
  const output = {
    version: worldSimulationPostOutcomeCounterfactualReflectionRetentionVersion,
    phase: "Phase81C",
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
    source_phase81b_projection_hash: phase81B.projection_hash,
    source_phase81b_resolver_view_hash: view.resolver_view_hash,
    source_phase81a_projection_hash: view.source_phase81a_projection_hash,
    source_phase81a_resolver_view_hash: view.source_phase81a_resolver_view_hash,
    capsule_count: capsules.length,
    capsules,
    audit: {
      exact_phase81a_phase81b_lineage_verified: true,
      actual_and_imagined_sources_explicitly_separated: true,
      actual_subjective_experience_retained_as_experienced_anchor: true,
      only_phase81b_salient_branch_metadata_retained: true,
      alternative_candidate_context_retained_for_future_cue_matching: true,
      preparative_orientation_retained_as_candidate_not_policy: true,
      counterfactual_capsules_are_episodic_fact_memories: false,
      unchosen_outcome_observed: false,
      counterfactual_world_truth_claimed: false,
      causal_superiority_inferred: false,
      numeric_emotion_utility_reward_q_value_probability_modeled: false,
      automatic_preference_action_belief_revision: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      failed_or_blocked_turn_persists_capsules: false,
      projection_does_not_mutate_world_state: true,
      future_reentry_requires_separate_projection: true,
    },
  };
  output.projection_hash = hashAgentRunValue(output);
  return assertWorldSimulationPostOutcomeCounterfactualReflectionRetention(output, {
    world_simulation_session_id: view.world_simulation_session_id,
    turn_id: view.turn_id,
    state_revision: view.state_revision,
    world_state_hash: view.world_state_hash,
  });
}
