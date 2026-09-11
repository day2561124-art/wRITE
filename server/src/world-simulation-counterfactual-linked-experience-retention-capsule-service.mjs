import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence,
  worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion,
} from "./world-simulation-counterfactual-selected-action-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualPreparativeRevalidationProjection,
  worldSimulationCounterfactualPreparativeRevalidationVersion,
} from "./world-simulation-counterfactual-preparative-revalidation-service.mjs";
import {
  assertWorldSimulationCounterfactualReflectionReentryProjection,
  worldSimulationCounterfactualReflectionReentryVersion,
} from "./world-simulation-counterfactual-reflection-reentry-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion =
  "phase81h-counterfactual-linked-experience-retention-capsule-v1";

const maximumRetentionCapsuleCount = 32;
const maximumContextSignatureCount = 16;

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
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_INPUT_INVALID",
      `Phase81H ${label} must be a bounded non-empty string.`,
    );
  }
  return normalized;
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function characterKey(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return Boolean(characterKey(left)) && characterKey(left) === characterKey(right);
}

function buildContextSignatures(judgment, sourceCandidate) {
  const matchedByRef = new Map(
    array(sourceCandidate.exact_current_cue_matches)
      .map((item) => [text(item?.current_cue_ref), item])
      .filter(([ref]) => Boolean(ref)),
  );
  const currentAdditionalByRef = new Map(
    array(sourceCandidate.current_additional_candidate_cues)
      .map((item) => [text(item?.cue_ref), item])
      .filter(([ref]) => Boolean(ref)),
  );
  const signatures = [];
  for (const ref of array(judgment.retain_matched_current_cue_refs)) {
    const match = matchedByRef.get(ref);
    if (!match || !text(match.cue_kind) || !text(match.cue_content_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CONTEXT_MISMATCH",
        "Phase81H could not resolve one retained Phase81E exact-current cue ref.",
      );
    }
    signatures.push({
      cue_kind: match.cue_kind,
      cue_content_hash: match.cue_content_hash,
      action_defining: match.action_defining === true,
      retention_role: "retained_exact_current_support",
    });
  }
  for (const ref of array(judgment.incorporate_current_additional_cue_refs)) {
    const cue = currentAdditionalByRef.get(ref);
    if (!cue || !text(cue.cue_kind) || !text(cue.cue_content_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CONTEXT_MISMATCH",
        "Phase81H could not resolve one incorporated Phase81E current-addition cue ref.",
      );
    }
    signatures.push({
      cue_kind: cue.cue_kind,
      cue_content_hash: cue.cue_content_hash,
      action_defining: cue.action_defining === true,
      retention_role: "incorporated_current_context_addition",
    });
  }
  signatures.sort((left, right) => compareText(left.retention_role, right.retention_role)
    || compareText(left.cue_kind, right.cue_kind)
    || compareText(left.cue_content_hash, right.cue_content_hash));
  const dedupe = new Set(signatures.map((item) =>
    `${item.retention_role}\u0000${item.cue_kind}\u0000${item.cue_content_hash}`));
  if (dedupe.size !== signatures.length
      || signatures.length > maximumContextSignatureCount
      || !signatures.some((item) => item.action_defining === true)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CONTEXT_INVALID",
      "Phase81H retained context signatures must be unique, bounded, and include action-defining support.",
    );
  }
  return signatures;
}

export function buildWorldSimulationCounterfactualLinkedExperienceRetentionContract() {
  return deepFreeze({
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    phase: "Phase81H",
    status: "counterfactual_linked_experience_retention_capsule_installed",
    source_outcome_evidence_owner: "Phase81G",
    source_revalidation_owner: "Phase81E",
    source_reentry_owner: "Phase81D",
    exact_phase81g_evidence_hash_required: true,
    exact_phase81e_judgment_hash_required: true,
    exact_phase81d_candidate_hash_required: true,
    current_context_retained_as_hash_level_cue_signatures: true,
    historical_imagined_alternative_and_current_experience_sources_separated: true,
    current_selected_action_subjective_experience_retained: true,
    capsule_is_combined_case_not_episodic_fact_memory: true,
    historical_counterfactual_truth_evaluated: false,
    historical_counterfactual_validated_by_current_outcome: false,
    counterfactual_advisory_effectiveness_inferred: false,
    success_failure_interpretation_performed: false,
    outcome_credit_assigned: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    same_turn_reentry_allowed: false,
    world_truth_authority_claimed: false,
    append_only_world_history_persistence: true,
    maximum_retention_capsule_count: maximumRetentionCapsuleCount,
    maximum_context_signature_count: maximumContextSignatureCount,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion
      || projection.phase !== "Phase81H"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase81g_projection_hash)
      || !Array.isArray(projection.source_phase81e_projection_hashes)
      || !Array.isArray(projection.source_phase81d_projection_hashes)
      || !Array.isArray(projection.capsules)
      || projection.capsule_count !== projection.capsules.length
      || projection.capsule_count > maximumRetentionCapsuleCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_INVALID",
      "Phase81H counterfactual-linked experience retention projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
        `Phase81H projection ${key} does not match expected lineage.`,
      );
    }
  }

  let expected81G = null;
  if (expected.counterfactual_selected_action_outcome_evidence !== undefined) {
    expected81G = assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(
      expected.counterfactual_selected_action_outcome_evidence,
      {
        world_simulation_session_id: projection.world_simulation_session_id,
        turn_id: projection.turn_id,
        state_revision: projection.state_revision,
        world_state_hash: projection.world_state_hash,
      },
    );
    if (projection.source_phase81g_projection_hash !== expected81G.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
        "Phase81H no longer matches the exact Phase81G projection.",
      );
    }
  }

  const phase81DByHash = new Map();
  for (const raw of array(expected.counterfactual_reflection_reentry_projections)) {
    const source = assertWorldSimulationCounterfactualReflectionReentryProjection(raw, {
      world_simulation_session_id: projection.world_simulation_session_id,
      current_turn_id: projection.turn_id,
      current_state_revision: projection.state_revision,
      current_world_state_hash: projection.world_state_hash,
    });
    phase81DByHash.set(source.projection_hash, source);
  }
  const phase81EByHash = new Map();
  for (const raw of array(expected.counterfactual_preparative_revalidation_projections)) {
    const source81D = phase81DByHash.get(raw?.source_phase81d_projection_hash);
    if (!source81D) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_PHASE81D_REQUIRED",
        "Phase81H expected Phase81E projection is missing its exact Phase81D source.",
      );
    }
    const source81E = assertWorldSimulationCounterfactualPreparativeRevalidationProjection(raw, {
      source_phase81d_projection: source81D,
    });
    phase81EByHash.set(source81E.projection_hash, source81E);
  }
  if (phase81DByHash.size > 0) {
    const hashes = [...phase81DByHash.keys()].sort(compareText);
    if (hashAgentRunValue(projection.source_phase81d_projection_hashes)
      !== hashAgentRunValue(hashes)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
        "Phase81H source Phase81D projection set no longer matches expected lineage.",
      );
    }
  }
  if (phase81EByHash.size > 0) {
    const hashes = [...phase81EByHash.keys()].sort(compareText);
    if (hashAgentRunValue(projection.source_phase81e_projection_hashes)
      !== hashAgentRunValue(hashes)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
        "Phase81H source Phase81E projection set no longer matches expected lineage.",
      );
    }
  }

  const evidenceByRef = expected81G
    ? new Map(expected81G.evidence_records.map((item) => [item.evidence_ref, item]))
    : null;
  const seen = new Set();
  for (const capsule of projection.capsules) {
    if (!isObject(capsule)
        || capsule.version !== worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion
        || !text(capsule.character)
        || !text(capsule.source_phase81g_evidence_ref)
        || !text(capsule.source_phase81g_evidence_hash)
        || !text(capsule.source_phase81e_projection_hash)
        || !text(capsule.source_phase81e_judgment_ref)
        || !text(capsule.source_phase81e_judgment_hash)
        || !text(capsule.source_phase81d_projection_hash)
        || !text(capsule.source_phase81d_reentry_candidate_ref)
        || !text(capsule.source_phase81d_reentry_candidate_hash)
        || !text(capsule.current_action_id)
        || !text(capsule.current_action_ref)
        || !Array.isArray(capsule.current_context_cue_signatures)
        || capsule.current_context_cue_signatures.length === 0
        || capsule.current_context_cue_signatures.length > maximumContextSignatureCount
        || !Array.isArray(capsule.addressed_historical_context_difference_kinds)
        || !isObject(capsule.current_selected_action_subjective_experience)
        || !text(capsule.historical_preparative_orientation)
        || !text(capsule.applicability_judgment)
        || !text(capsule.selection_relation)
        || !isObject(capsule.source_monitoring)
        || capsule.source_monitoring.sources_may_not_be_collapsed !== true
        || capsule.current_selected_action_subjective_outcome_observed !== true
        || capsule.historical_imagined_alternative_was_experienced !== false
        || capsule.historical_unchosen_outcome_observed !== false
        || capsule.historical_counterfactual_truth_evaluated !== false
        || capsule.historical_counterfactual_validated_by_current_outcome !== false
        || capsule.counterfactual_advisory_effectiveness_inferred !== false
        || capsule.success_failure_interpretation_performed !== false
        || capsule.outcome_credit_assigned !== false
        || capsule.preference_revision_performed !== false
        || capsule.belief_revision_performed !== false
        || capsule.semantic_revision_performed !== false
        || capsule.subjective_memory_rewrite_performed !== false
        || capsule.counterfactual_linked_capsule_is_episodic_fact_memory !== false
        || capsule.same_turn_reentry_allowed !== false
        || capsule.world_state_mutated !== false
        || capsule.world_truth_authority !== false
        || !text(capsule.capsule_ref)
        || !text(capsule.capsule_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CAPSULE_INVALID",
        "Phase81H contains an invalid or over-authoritative retention capsule.",
      );
    }
    const signatureKeys = new Set();
    for (const signature of capsule.current_context_cue_signatures) {
      const key = `${signature?.retention_role ?? ""}\u0000${signature?.cue_kind ?? ""}\u0000${signature?.cue_content_hash ?? ""}`;
      if (!isObject(signature)
          || !text(signature.cue_kind)
          || !text(signature.cue_content_hash)
          || !["retained_exact_current_support", "incorporated_current_context_addition"]
            .includes(signature.retention_role)
          || typeof signature.action_defining !== "boolean"
          || signatureKeys.has(key)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CONTEXT_INVALID",
          "Phase81H capsule contains invalid or duplicate context cue signatures.",
        );
      }
      signatureKeys.add(key);
    }
    if (!capsule.current_context_cue_signatures.some((item) => item.action_defining === true)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CONTEXT_INVALID",
        "Phase81H capsule must retain at least one action-defining current-context cue signature.",
      );
    }

    if (evidenceByRef && phase81EByHash.size > 0 && phase81DByHash.size > 0) {
      const evidence = evidenceByRef.get(capsule.source_phase81g_evidence_ref);
      const source81E = phase81EByHash.get(capsule.source_phase81e_projection_hash);
      const source81D = phase81DByHash.get(capsule.source_phase81d_projection_hash);
      const judgment = source81E?.revalidation_judgments
        ?.find((item) => item.revalidation_judgment_ref === capsule.source_phase81e_judgment_ref);
      const candidate = source81D?.reentry_candidates
        ?.find((item) => item.reentry_candidate_ref === capsule.source_phase81d_reentry_candidate_ref);
      const expectedSignatures = judgment && candidate
        ? buildContextSignatures(judgment, candidate)
        : null;
      if (!evidence
          || !source81E
          || !source81D
          || !judgment
          || !candidate
          || evidence.evidence_hash !== capsule.source_phase81g_evidence_hash
          || evidence.phase81e_projection_hash !== source81E.projection_hash
          || evidence.source_phase81d_projection_hash !== source81D.projection_hash
          || evidence.revalidation_judgment_ref !== judgment.revalidation_judgment_ref
          || evidence.revalidation_judgment_hash !== judgment.revalidation_judgment_hash
          || judgment.source_reentry_candidate_ref !== candidate.reentry_candidate_ref
          || judgment.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || !sameCharacter(evidence.character, capsule.character)
          || !sameCharacter(source81E.character, capsule.character)
          || !sameCharacter(source81D.character, capsule.character)
          || evidence.action_id !== capsule.current_action_id
          || evidence.action_ref !== capsule.current_action_ref
          || evidence.applicability_judgment !== capsule.applicability_judgment
          || evidence.selection_relation !== capsule.selection_relation
          || evidence.historical_preparative_orientation
            !== capsule.historical_preparative_orientation
          || evidence.historical_actual_selected_action_id
            !== capsule.historical_actual_selected_action_id
          || evidence.historical_imagined_alternative_action_id
            !== capsule.historical_imagined_alternative_action_id
          || evidence.historical_comparison_direction !== capsule.historical_comparison_direction
          || evidence.historical_appraisal_kind !== capsule.historical_appraisal_kind
          || hashAgentRunValue(evidence.selected_action_subjective_experience)
            !== hashAgentRunValue(capsule.current_selected_action_subjective_experience)
          || hashAgentRunValue(expectedSignatures)
            !== hashAgentRunValue(capsule.current_context_cue_signatures)
          || hashAgentRunValue(judgment.historical_context_difference_kinds)
            !== hashAgentRunValue(capsule.addressed_historical_context_difference_kinds)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LINEAGE_MISMATCH",
          "Phase81H capsule no longer matches its exact Phase81D/81E/81G source lineage.",
        );
      }
    }

    const identity = cloneJson(capsule);
    for (const key of [
      "capsule_ref",
      "capsule_hash",
      "current_selected_action_subjective_outcome_observed",
      "historical_imagined_alternative_was_experienced",
      "historical_unchosen_outcome_observed",
      "historical_counterfactual_truth_evaluated",
      "historical_counterfactual_validated_by_current_outcome",
      "counterfactual_advisory_effectiveness_inferred",
      "success_failure_interpretation_performed",
      "outcome_credit_assigned",
      "preference_revision_performed",
      "belief_revision_performed",
      "semantic_revision_performed",
      "subjective_memory_rewrite_performed",
      "counterfactual_linked_capsule_is_episodic_fact_memory",
      "same_turn_reentry_allowed",
      "world_state_mutated",
      "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (capsule.capsule_hash !== expectedHash
        || capsule.capsule_ref !== `phase81h_retention_${expectedHash.slice(0, 24)}`
        || seen.has(capsule.capsule_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_CAPSULE_HASH_MISMATCH",
        "Phase81H retention capsule identity verification failed.",
      );
    }
    seen.add(capsule.capsule_ref);
  }

  if (projection.audit.exact_phase81g_outcome_evidence_verified !== true
      || projection.audit.exact_phase81e_revalidation_lineage_verified !== true
      || projection.audit.exact_phase81d_reentry_lineage_verified !== true
      || projection.audit.hash_level_current_context_signatures_retained !== true
      || projection.audit.historical_and_current_sources_kept_separate !== true
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.historical_counterfactual_validated_by_current_outcome !== false
      || projection.audit.counterfactual_advisory_effectiveness_inferred !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.outcome_credit_assigned !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.same_turn_reentry_performed !== false
      || projection.audit.world_state_mutated !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_capsules !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true
      || projection.persistence_boundary.future_reentry_or_usefulness_interpretation_requires_separate_phase !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_BOUNDARY_INVALID",
      "Phase81H projection violates its source-monitoring, authority, or persistence boundary.",
    );
  }
  return deepFreeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(input = {}) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const turnId = requiredText(input.turn_id, "turn_id", 240);
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_INPUT_INVALID",
      "Phase81H state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase81G = assertWorldSimulationCounterfactualSelectedActionOutcomeEvidence(
    input.counterfactual_selected_action_outcome_evidence,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
  if (phase81G.version !== worldSimulationCounterfactualSelectedActionOutcomeEvidenceVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_PHASE81G_INVALID",
      "Phase81H requires the canonical Phase81G outcome-evidence version.",
    );
  }

  const phase81DByHash = new Map();
  for (const raw of array(input.counterfactual_reflection_reentry_projections)) {
    const source = assertWorldSimulationCounterfactualReflectionReentryProjection(raw, {
      world_simulation_session_id: worldSimulationSessionId,
      current_turn_id: turnId,
      current_state_revision: input.state_revision,
      current_world_state_hash: worldStateHash,
    });
    if (source.version !== worldSimulationCounterfactualReflectionReentryVersion) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_PHASE81D_INVALID",
        "Phase81H requires canonical Phase81D re-entry projections.",
      );
    }
    if (phase81DByHash.has(source.projection_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_DUPLICATE_SOURCE",
        "Phase81H Phase81D source projection hashes must be unique.",
      );
    }
    phase81DByHash.set(source.projection_hash, source);
  }

  const phase81EByHash = new Map();
  for (const raw of array(input.counterfactual_preparative_revalidation_projections)) {
    const source81D = phase81DByHash.get(raw?.source_phase81d_projection_hash);
    if (!source81D) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_PHASE81D_REQUIRED",
        "Phase81H requires the exact Phase81D source for every Phase81E projection.",
      );
    }
    const source81E = assertWorldSimulationCounterfactualPreparativeRevalidationProjection(raw, {
      source_phase81d_projection: source81D,
    });
    if (source81E.version !== worldSimulationCounterfactualPreparativeRevalidationVersion) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_PHASE81E_INVALID",
        "Phase81H requires canonical Phase81E revalidation projections.",
      );
    }
    if (phase81EByHash.has(source81E.projection_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_DUPLICATE_SOURCE",
        "Phase81H Phase81E source projection hashes must be unique.",
      );
    }
    phase81EByHash.set(source81E.projection_hash, source81E);
  }

  const capsules = [];
  for (const evidence of phase81G.evidence_records) {
    const source81E = phase81EByHash.get(evidence.phase81e_projection_hash);
    const source81D = phase81DByHash.get(evidence.source_phase81d_projection_hash);
    const judgment = source81E?.revalidation_judgments
      ?.find((item) => item.revalidation_judgment_ref === evidence.revalidation_judgment_ref);
    const candidate = source81D?.reentry_candidates
      ?.find((item) => item.reentry_candidate_ref === judgment?.source_reentry_candidate_ref);
    if (!source81E
        || !source81D
        || !judgment
        || !candidate
        || judgment.revalidation_judgment_hash !== evidence.revalidation_judgment_hash
        || candidate.reentry_candidate_hash !== judgment.source_reentry_candidate_hash
        || !sameCharacter(source81E.character, evidence.character)
        || !sameCharacter(source81D.character, evidence.character)
        || judgment.current_action_id !== evidence.action_id
        || judgment.current_action_ref !== evidence.action_ref
        || judgment.applicability_judgment !== evidence.applicability_judgment
        || judgment.historical_preparative_orientation !== evidence.historical_preparative_orientation) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_SOURCE_MISMATCH",
        "Phase81H cannot resolve exact Phase81D/81E ancestry for one Phase81G evidence record.",
      );
    }
    const contextSignatures = buildContextSignatures(judgment, candidate);
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: evidence.character,
      source_phase81g_evidence_ref: evidence.evidence_ref,
      source_phase81g_evidence_hash: evidence.evidence_hash,
      source_phase81e_projection_hash: source81E.projection_hash,
      source_phase81e_judgment_ref: judgment.revalidation_judgment_ref,
      source_phase81e_judgment_hash: judgment.revalidation_judgment_hash,
      source_phase81d_projection_hash: source81D.projection_hash,
      source_phase81d_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_phase81d_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_action_id: evidence.action_id,
      current_action_ref: evidence.action_ref,
      current_context_cue_signatures: contextSignatures,
      addressed_historical_context_difference_kinds:
        cloneJson(judgment.historical_context_difference_kinds),
      current_selected_action_subjective_experience:
        cloneJson(evidence.selected_action_subjective_experience),
      applicability_judgment: evidence.applicability_judgment,
      selection_relation: evidence.selection_relation,
      historical_actual_selected_action_id: evidence.historical_actual_selected_action_id,
      historical_imagined_alternative_action_id:
        evidence.historical_imagined_alternative_action_id,
      historical_comparison_direction: evidence.historical_comparison_direction,
      historical_appraisal_kind: evidence.historical_appraisal_kind,
      historical_preparative_orientation: evidence.historical_preparative_orientation,
      source_monitoring: {
        historical_alternative_source: "imagined_decision_time_possibility",
        historical_appraisal_source: "subjective_counterfactual_reflection",
        current_applicability_source: "subjective_deliberative_relevance_judgment",
        current_selection_source: "actual_selected_action_lineage",
        current_outcome_source: "experienced_subjective_outcome",
        sources_may_not_be_collapsed: true,
      },
    };
    const capsuleHash = hashAgentRunValue(identity);
    capsules.push({
      capsule_ref: `phase81h_retention_${capsuleHash.slice(0, 24)}`,
      capsule_hash: capsuleHash,
      ...identity,
      current_selected_action_subjective_outcome_observed: true,
      historical_imagined_alternative_was_experienced: false,
      historical_unchosen_outcome_observed: false,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      counterfactual_linked_capsule_is_episodic_fact_memory: false,
      same_turn_reentry_allowed: false,
      world_state_mutated: false,
      world_truth_authority: false,
    });
  }
  capsules.sort((left, right) => compareText(left.capsule_ref, right.capsule_ref));
  if (capsules.length > maximumRetentionCapsuleCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_RETENTION_LIMIT_EXCEEDED",
      `Phase81H accepts at most ${maximumRetentionCapsuleCount} capsules per turn.`,
    );
  }
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceRetentionCapsuleVersion,
    phase: "Phase81H",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase81g_projection_hash: phase81G.projection_hash,
    source_phase81e_projection_hashes: [...phase81EByHash.keys()].sort(compareText),
    source_phase81d_projection_hashes: [...phase81DByHash.keys()].sort(compareText),
    capsule_count: capsules.length,
    capsules,
    audit: {
      exact_phase81g_outcome_evidence_verified: true,
      exact_phase81e_revalidation_lineage_verified: true,
      exact_phase81d_reentry_lineage_verified: true,
      hash_level_current_context_signatures_retained: true,
      historical_and_current_sources_kept_separate: true,
      historical_counterfactual_truth_evaluated: false,
      historical_counterfactual_validated_by_current_outcome: false,
      counterfactual_advisory_effectiveness_inferred: false,
      success_failure_interpretation_performed: false,
      outcome_credit_assigned: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_reentry_performed: false,
      world_state_mutated: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_capsules: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      future_reentry_or_usefulness_interpretation_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceRetentionCapsules(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    counterfactual_selected_action_outcome_evidence: phase81G,
    counterfactual_reflection_reentry_projections: [...phase81DByHash.values()],
    counterfactual_preparative_revalidation_projections: [...phase81EByHash.values()],
  });
}
