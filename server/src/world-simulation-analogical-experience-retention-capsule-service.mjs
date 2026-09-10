import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceOutcomeEvidence,
  worldSimulationAnalogicalExperienceOutcomeEvidenceVersion,
} from "./world-simulation-analogical-experience-outcome-evidence-service.mjs";
import {
  worldSimulationAnalogicalExperienceRevalidationVersion,
} from "./world-simulation-analogical-experience-revalidation-service.mjs";

export const worldSimulationAnalogicalExperienceRetentionCapsuleVersion =
  "phase80f-adapted-analogy-retention-capsule-v1";

const maximumRetentionCapsuleCount = 48;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    const error = new Error(`Phase80F ${label} is required and must be bounded.`);
    error.code = "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_INPUT_INVALID";
    throw error;
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function projectionHash(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function characterKey(value) {
  return requiredText(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}

function verifyPhase80C(value, expected) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceRevalidationVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !Number.isInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !text(projection.current_world_state_hash)
      || !text(projection.source_phase80a_projection_hash)
      || !text(projection.source_phase80b_adaptation_hash)
      || !Array.isArray(projection.revalidated_adapted_methods)
      || projection.revalidated_method_count !== projection.revalidated_adapted_methods.length
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80C_INVALID",
      "Phase80F requires an exact canonical Phase80C revalidation projection.",
    );
  }
  if (projection.current_turn_id !== expected.turn_id
      || projection.current_state_revision !== expected.state_revision
      || projection.current_world_state_hash !== expected.world_state_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80C_LINEAGE_MISMATCH",
      "Phase80F Phase80C world-turn lineage does not match.",
    );
  }
  const audit = isObject(projection.audit) ? projection.audit : {};
  if (audit.current_corresponding_method_identity_reverified !== true
      || audit.selected_current_cue_refs_reverified !== true
      || audit.current_method_semantics_reused_from_phase79d_only !== true
      || audit.dropped_historical_cues_exposed_as_current_context !== false
      || audit.resolver_authored_semantic_method_content !== false
      || audit.preference_resolution_performed !== false
      || audit.action_selection_performed !== false
      || audit.numeric_similarity_confidence_probability_utility_reward_modeled !== false
      || audit.fuzzy_semantic_similarity_used !== false
      || audit.world_truth_authority_claimed !== false) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80C_BOUNDARY_INVALID",
      "Phase80F rejects a Phase80C source that violates the sealed bounded revalidation authority boundary.",
    );
  }
  return projection;
}

function validateContextBasis(value) {
  const basis = array(value).map((cue, index) => {
    if (!isObject(cue)
        || !text(cue.cue_kind)
        || !Object.hasOwn(cue, "content")
        || !["retained_alignment", "incorporated_difference"].includes(cue.adaptation_role)
        || cue.same_turn_character_visible_context !== true
        || cue.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_CONTEXT_INVALID",
        `Phase80F current_context_basis[${index}] violates the Phase80C bounded-context contract.`,
      );
    }
    return {
      cue_kind: requiredText(cue.cue_kind, `current_context_basis[${index}].cue_kind`, 120),
      content: cloneJson(cue.content),
      adaptation_role: cue.adaptation_role,
      cue_content_hash: hashAgentRunValue({ cue_kind: cue.cue_kind, content: cloneJson(cue.content) }),
    };
  });
  basis.sort((left, right) => compareText(left.adaptation_role, right.adaptation_role)
    || compareText(left.cue_kind, right.cue_kind)
    || compareText(left.cue_content_hash, right.cue_content_hash));
  return basis;
}

export function buildWorldSimulationAnalogicalExperienceRetentionCapsuleContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
    phase: "Phase80F",
    status: "adapted_analogy_retention_capsule_installed",
    source_revalidated_context_owner: "Phase80C",
    source_subjective_outcome_owner: "Phase80E",
    exact_phase80c_projection_hash_required: true,
    exact_phase80e_evidence_hash_required: true,
    same_character_same_turn_world_lineage_required: true,
    only_applied_and_subjectively_evaluated_adaptations_retained: true,
    adapted_current_context_basis_retained: true,
    method_skeleton_retained_from_revalidated_current_method: true,
    supported_counterevidenced_and_ambiguous_cases_retained: true,
    retention_is_case_evidence_not_preference_learning: true,
    automatic_preference_learning_performed: false,
    semantic_method_revision_performed: false,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    world_truth_authority_claimed: false,
    same_turn_reentry_allowed: false,
    append_only_world_history_persistence: true,
    maximum_retention_capsule_count: maximumRetentionCapsuleCount,
  });
}

export function assertWorldSimulationAnalogicalExperienceRetentionCapsules(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceRetentionCapsuleVersion
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase80e_projection_hash)
      || !Array.isArray(projection.capsules)
      || projection.capsule_count !== projection.capsules.length
      || projection.capsule_count > maximumRetentionCapsuleCount
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_INVALID",
      "Phase80F retention-capsule projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_LINEAGE_MISMATCH",
        `Phase80F projection ${key} does not match expected lineage.`,
      );
    }
  }
  const seen = new Set();
  for (const capsule of projection.capsules) {
    if (!isObject(capsule)
        || capsule.version !== worldSimulationAnalogicalExperienceRetentionCapsuleVersion
        || !text(capsule.character)
        || !text(capsule.source_phase80e_evidence_ref)
        || !text(capsule.source_phase80e_evidence_hash)
        || !text(capsule.source_phase80c_projection_hash)
        || !text(capsule.source_phase80a_projection_hash)
        || !text(capsule.source_phase80b_adaptation_hash)
        || !text(capsule.analogy_candidate_ref)
        || !text(capsule.current_impasse_ref)
        || !text(capsule.current_corresponding_method_ref)
        || !isObject(capsule.method_skeleton)
        || !Array.isArray(capsule.adapted_current_context_basis)
        || !text(capsule.phase76f_application_receipt_id)
        || !text(capsule.phase76f_application_receipt_hash)
        || !text(capsule.phase76g_assessment_ref)
        || !text(capsule.phase76g_assessment_hash)
        || !text(capsule.outcome_evidence_kind)
        || !["supports_prior_method", "counterevidence_for_prior_method", "ambiguous_no_revision"]
          .includes(capsule.method_outcome_assessment)
        || capsule.subjective_outcome_not_world_truth !== true
        || capsule.comparative_superiority_inferred !== false
        || capsule.causal_credit_assigned !== false
        || capsule.automatic_preference_learning_performed !== false
        || capsule.semantic_method_revision_performed !== false
        || capsule.same_turn_reentry_allowed !== false
        || !text(capsule.capsule_ref)
        || !text(capsule.capsule_hash)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_RECORD_INVALID",
        "Phase80F retention capsule violates its bounded evidence contract.",
      );
    }
    const canonicalContextBasis = validateContextBasis(
      capsule.adapted_current_context_basis.map((cue) => ({
        cue_kind: cue?.cue_kind,
        content: cue?.content,
        adaptation_role: cue?.adaptation_role,
        same_turn_character_visible_context: true,
        world_truth_authority: false,
      })),
    );
    if (hashAgentRunValue(canonicalContextBasis) !== hashAgentRunValue(capsule.adapted_current_context_basis)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_CONTEXT_INVALID",
        "Phase80F retention capsule current-context basis is not canonical.",
      );
    }
    const identity = cloneJson(capsule);
    for (const key of [
      "capsule_ref", "capsule_hash", "subjective_outcome_not_world_truth",
      "comparative_superiority_inferred", "causal_credit_assigned",
      "automatic_preference_learning_performed", "semantic_method_revision_performed",
      "same_turn_reentry_allowed",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (capsule.capsule_hash !== expectedHash
        || capsule.capsule_ref !== `phase80f_retention_${expectedHash.slice(0, 24)}`
        || seen.has(capsule.capsule_ref)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_HASH_MISMATCH",
        "Phase80F retention capsule identity verification failed.",
      );
    }
    seen.add(capsule.capsule_ref);
  }
  return deepFreeze(projection);
}

export function buildWorldSimulationAnalogicalExperienceRetentionCapsules(input = {}) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const turnId = requiredText(input.turn_id, "turn_id", 240);
  if (!Number.isInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_INPUT_INVALID",
      "Phase80F state_revision must be a non-negative integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase80E = assertWorldSimulationAnalogicalExperienceOutcomeEvidence(
    input.analogical_experience_outcome_evidence,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (phase80E.version !== worldSimulationAnalogicalExperienceOutcomeEvidenceVersion) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80E_INVALID",
      "Phase80F requires the canonical Phase80E outcome-evidence version.",
    );
  }
  const phase80CByHash = new Map();
  for (const raw of array(input.analogical_experience_revalidation_projections)) {
    const projection = verifyPhase80C(raw, {
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    });
    if (phase80CByHash.has(projection.projection_hash)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_PHASE80C_DUPLICATE",
        "Phase80F Phase80C projection hashes must be unique.",
      );
    }
    phase80CByHash.set(projection.projection_hash, projection);
  }

  const capsules = [];
  for (const evidence of phase80E.evidence_records) {
    const phase80C = phase80CByHash.get(evidence.phase80c_projection_hash);
    if (!phase80C || characterKey(phase80C.character) !== characterKey(evidence.character)
        || phase80C.source_phase80a_projection_hash !== evidence.source_phase80a_projection_hash
        || phase80C.source_phase80b_adaptation_hash !== evidence.source_phase80b_adaptation_hash) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_SOURCE_MISMATCH",
        "Phase80F cannot resolve exact Phase80C ancestry for one Phase80E evidence record.",
      );
    }
    const method = phase80C.revalidated_adapted_methods.find((candidate) =>
      candidate?.analogy_candidate_ref === evidence.analogy_candidate_ref
      && candidate?.current_impasse_ref === evidence.current_impasse_ref
      && candidate?.current_corresponding_method_ref === evidence.current_corresponding_method_ref);
    if (!method || !isObject(method.method_skeleton)
        || method.current_context_revalidated !== true
        || method.adaptation_difference_addressed !== true
        || method.structural_method_identity_preserved !== true
        || method.advisory_only !== true
        || method.preference_selected !== false
        || method.action_selected !== false
        || method.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_METHOD_MISMATCH",
        "Phase80F requires the exact bounded revalidated adapted method cited by Phase80E.",
      );
    }
    const identity = {
      version: worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: evidence.character,
      source_phase80e_evidence_ref: evidence.evidence_ref,
      source_phase80e_evidence_hash: evidence.evidence_hash,
      source_phase80c_projection_hash: evidence.phase80c_projection_hash,
      source_phase80a_projection_hash: evidence.source_phase80a_projection_hash,
      source_phase80b_adaptation_hash: evidence.source_phase80b_adaptation_hash,
      analogy_candidate_ref: evidence.analogy_candidate_ref,
      current_impasse_ref: evidence.current_impasse_ref,
      current_corresponding_method_ref: evidence.current_corresponding_method_ref,
      method_skeleton: cloneJson(method.method_skeleton),
      source_knowledge_status: method.source_knowledge_status ?? null,
      mapping_kind: method.mapping_kind ?? null,
      adapted_current_context_basis: validateContextBasis(method.current_context_basis),
      phase76f_application_receipt_id: evidence.phase76f_application_receipt_id,
      phase76f_application_receipt_hash: evidence.phase76f_application_receipt_hash,
      phase76g_assessment_ref: evidence.phase76g_assessment_ref,
      phase76g_assessment_hash: evidence.phase76g_assessment_hash,
      method_outcome_assessment: evidence.method_outcome_assessment,
      outcome_evidence_kind: evidence.outcome_evidence_kind,
    };
    const capsuleHash = hashAgentRunValue(identity);
    capsules.push({
      capsule_ref: `phase80f_retention_${capsuleHash.slice(0, 24)}`,
      capsule_hash: capsuleHash,
      ...identity,
      subjective_outcome_not_world_truth: true,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      automatic_preference_learning_performed: false,
      semantic_method_revision_performed: false,
      same_turn_reentry_allowed: false,
    });
  }
  capsules.sort((left, right) => compareText(left.capsule_ref, right.capsule_ref));
  if (capsules.length > maximumRetentionCapsuleCount) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_CAPSULE_LIMIT_EXCEEDED",
      `Phase80F accepts at most ${maximumRetentionCapsuleCount} capsules per turn.`,
    );
  }
  const projection = {
    version: worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase80e_projection_hash: phase80E.projection_hash,
    capsule_count: capsules.length,
    capsules,
    audit: {
      exact_phase80e_outcome_evidence_verified: true,
      exact_phase80c_revalidated_context_verified: true,
      exact_phase80a_b_c_e_lineage_preserved: true,
      only_applied_and_subjectively_evaluated_adaptations_retained: true,
      adapted_current_context_basis_retained: true,
      supported_counterevidenced_and_ambiguous_cases_retained: true,
      subjective_outcome_treated_as_world_truth: false,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      automatic_preference_learning_performed: false,
      semantic_method_revision_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      same_turn_reentry_performed: false,
    },
    persistence_boundary: {
      append_only_world_history_only: true,
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_capsules: false,
      projection_does_not_mutate_world_state: true,
      future_reentry_requires_separate_projection: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationAnalogicalExperienceRetentionCapsules(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
  });
}
