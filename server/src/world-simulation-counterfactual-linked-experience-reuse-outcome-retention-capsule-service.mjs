import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-evidence-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReentryProjection,
} from "./world-simulation-counterfactual-linked-experience-reentry-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseProjection,
} from "./world-simulation-counterfactual-linked-experience-reuse-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion =
  "phase81m-counterfactual-linked-experience-reuse-outcome-retention-capsule-v1";

const maximumRetentionCapsuleCount = 64;
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_INPUT_INVALID",
      `Phase81M ${label} must be a bounded non-empty string.`,
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

function buildContextSignatures(intent, candidate) {
  const matchedByRef = new Map(
    array(candidate.exact_current_cue_matches)
      .map((item) => [text(item?.current_cue_ref), item])
      .filter(([ref]) => Boolean(ref)),
  );
  const additionalByRef = new Map(
    array(candidate.current_additional_candidate_cues)
      .map((item) => [text(item?.cue_ref), item])
      .filter(([ref]) => Boolean(ref)),
  );
  const signatures = [];
  for (const ref of array(intent.retain_matched_current_cue_refs)) {
    const match = matchedByRef.get(ref);
    if (!match || !text(match.cue_kind) || !text(match.cue_content_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CONTEXT_MISMATCH",
        "Phase81M could not resolve one retained Phase81J exact-current cue ref.",
      );
    }
    signatures.push({
      cue_kind: match.cue_kind,
      cue_content_hash: match.cue_content_hash,
      action_defining: match.action_defining === true,
      retention_role: "retained_exact_current_support",
    });
  }
  for (const ref of array(intent.incorporate_current_additional_cue_refs)) {
    const cue = additionalByRef.get(ref);
    if (!cue || !text(cue.cue_kind) || !text(cue.cue_content_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CONTEXT_MISMATCH",
        "Phase81M could not resolve one incorporated Phase81J current-addition cue ref.",
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
  const keys = new Set(signatures.map((item) =>
    `${item.retention_role}\u0000${item.cue_kind}\u0000${item.cue_content_hash}`));
  if (keys.size !== signatures.length
      || signatures.length === 0
      || signatures.length > maximumContextSignatureCount
      || !signatures.some((item) => item.action_defining === true)) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CONTEXT_INVALID",
      "Phase81M retained context signatures must be unique, bounded, and include action-defining support.",
    );
  }
  return signatures;
}

function canonicalHandledDifferenceKinds(intent) {
  return [...new Set([
    ...array(intent.dropped_unmatched_retained_cue_kinds),
    ...array(intent.incorporated_current_additional_cue_kinds),
  ].map((value) => requiredText(value, "handled context difference kind", 120)))]
    .sort(compareText);
}

function buildExactSources(input, lineage) {
  const phase81IByHash = new Map();
  const phase81IByCharacter = new Map();
  for (const raw of array(input.counterfactual_linked_experience_reentry_projections)) {
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReentryProjection(raw, {
      world_simulation_session_id: lineage.world_simulation_session_id,
      current_turn_id: lineage.turn_id,
      current_state_revision: lineage.state_revision,
      current_world_state_hash: lineage.world_state_hash,
      world_history: input.world_history,
    });
    if (phase81IByHash.has(projection.projection_hash)
        || phase81IByCharacter.has(characterKey(projection.character))) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_DUPLICATE_SOURCE",
        "Phase81M accepts unique Phase81I sources by hash and character.",
      );
    }
    phase81IByHash.set(projection.projection_hash, projection);
    phase81IByCharacter.set(characterKey(projection.character), projection);
  }
  const phase81JByHash = new Map();
  for (const raw of array(input.counterfactual_linked_experience_reuse_projections)) {
    const source81I = phase81IByCharacter.get(characterKey(raw?.character));
    if (!source81I) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_PHASE81I_REQUIRED",
        "Phase81M requires the exact same-character Phase81I source for every Phase81J projection.",
      );
    }
    const projection = assertWorldSimulationCounterfactualLinkedExperienceReuseProjection(raw, {
      source_phase81i_projection: source81I,
      expected_source: { world_history: input.world_history },
    });
    if (phase81JByHash.has(projection.projection_hash)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_DUPLICATE_SOURCE",
        "Phase81M Phase81J source projection hashes must be unique.",
      );
    }
    phase81JByHash.set(projection.projection_hash, projection);
  }
  return { phase81IByHash, phase81JByHash };
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionContract() {
  return deepFreeze({
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    phase: "Phase81M",
    status: "counterfactual_linked_reuse_outcome_retention_capsule_installed",
    source_outcome_evidence_owner: "Phase81L",
    source_reuse_owner: "Phase81J",
    source_reentry_owner: "Phase81I",
    exact_phase81l_evidence_hash_required: true,
    exact_phase81j_reuse_intent_hash_required: true,
    exact_phase81i_reentry_candidate_hash_required: true,
    exact_phase81k_phase74d_world_history_revalidation_required: true,
    current_context_retained_as_hash_level_cue_signatures: true,
    prior_and_current_subjective_outcomes_source_distinct: true,
    current_selected_action_subjective_experience_retained: true,
    prior_linked_case_subjective_experience_retained_as_ancestry_only: true,
    reuse_effectiveness_inferred: false,
    historical_counterfactual_truth_evaluated: false,
    success_failure_interpretation_performed: false,
    causal_or_outcome_credit_assigned: false,
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

export function assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion
      || projection.phase !== "Phase81M"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_phase81l_projection_hash)
      || !Array.isArray(projection.source_phase81j_projection_hashes)
      || !Array.isArray(projection.source_phase81i_projection_hashes)
      || !Array.isArray(projection.capsules)
      || projection.capsule_count !== projection.capsules.length
      || projection.capsule_count > maximumRetentionCapsuleCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_INVALID",
      "Phase81M reuse-outcome retention projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
        `Phase81M projection ${key} does not match expected lineage.`,
      );
    }
  }

  let phase81L = null;
  let sources = null;
  if (expected.counterfactual_linked_experience_reuse_outcome_evidence !== undefined) {
    phase81L = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
      expected.counterfactual_linked_experience_reuse_outcome_evidence,
      {
        world_simulation_session_id: projection.world_simulation_session_id,
        turn_id: projection.turn_id,
        state_revision: projection.state_revision,
        world_state_hash: projection.world_state_hash,
        counterfactual_linked_experience_selected_action_lineage:
          expected.counterfactual_linked_experience_selected_action_lineage,
        subjective_choice_commitment_receipts: expected.subjective_choice_commitment_receipts,
        counterfactual_linked_experience_reentry_projections:
          expected.counterfactual_linked_experience_reentry_projections,
        counterfactual_linked_experience_reuse_projections:
          expected.counterfactual_linked_experience_reuse_projections,
        world_history: expected.world_history,
        post_outcome_subjective_perception_projection:
          expected.post_outcome_subjective_perception_projection,
      },
    );
    if (phase81L.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion
        || projection.source_phase81l_projection_hash !== phase81L.projection_hash) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
        "Phase81M no longer matches the exact Phase81L outcome-evidence projection.",
      );
    }
    sources = buildExactSources(expected, projection);
    const expected81IHashes = [...sources.phase81IByHash.keys()].sort(compareText);
    const expected81JHashes = [...sources.phase81JByHash.keys()].sort(compareText);
    if (hashAgentRunValue(projection.source_phase81i_projection_hashes)
          !== hashAgentRunValue(expected81IHashes)
        || hashAgentRunValue(projection.source_phase81j_projection_hashes)
          !== hashAgentRunValue(expected81JHashes)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
        "Phase81M source Phase81I/81J projection sets no longer match expected lineage.",
      );
    }
  }

  const evidenceByRef = phase81L
    ? new Map(phase81L.evidence_records.map((record) => [record.evidence_ref, record]))
    : null;
  const seen = new Set();
  for (const capsule of projection.capsules) {
    if (!isObject(capsule)
        || capsule.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion
        || !text(capsule.character)
        || !text(capsule.source_phase81l_evidence_ref)
        || !text(capsule.source_phase81l_evidence_hash)
        || !text(capsule.source_phase81j_projection_hash)
        || !text(capsule.source_phase81i_projection_hash)
        || !text(capsule.reuse_intent_ref)
        || !text(capsule.reuse_intent_hash)
        || !text(capsule.source_reentry_candidate_ref)
        || !text(capsule.source_reentry_candidate_hash)
        || !text(capsule.current_action_id)
        || !text(capsule.current_action_ref)
        || !Array.isArray(capsule.current_context_cue_signatures)
        || capsule.current_context_cue_signatures.length === 0
        || capsule.current_context_cue_signatures.length > maximumContextSignatureCount
        || !Array.isArray(capsule.handled_context_difference_kinds)
        || !isObject(capsule.prior_linked_case_subjective_experience)
        || !isObject(capsule.current_selected_action_subjective_experience)
        || !isObject(capsule.source_monitoring)
        || capsule.source_monitoring.sources_may_not_be_collapsed !== true
        || capsule.current_selected_action_subjective_outcome_observed !== true
        || capsule.prior_linked_case_subjective_outcome_is_current_world_truth !== false
        || capsule.prior_and_current_subjective_outcomes_compared_for_effectiveness !== false
        || capsule.reuse_or_advisory_effectiveness_inferred !== false
        || capsule.historical_counterfactual_truth_evaluated !== false
        || capsule.success_failure_interpretation_performed !== false
        || capsule.causal_or_outcome_credit_assigned !== false
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
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CAPSULE_INVALID",
        "Phase81M contains an invalid or over-authoritative retention capsule.",
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
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CONTEXT_INVALID",
          "Phase81M capsule contains invalid or duplicate context cue signatures.",
        );
      }
      signatureKeys.add(key);
    }
    if (!capsule.current_context_cue_signatures.some((item) => item.action_defining === true)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CONTEXT_INVALID",
        "Phase81M capsule must retain action-defining current-context support.",
      );
    }

    if (evidenceByRef && sources) {
      const evidence = evidenceByRef.get(capsule.source_phase81l_evidence_ref);
      const phase81J = sources.phase81JByHash.get(capsule.source_phase81j_projection_hash);
      const phase81I = sources.phase81IByHash.get(capsule.source_phase81i_projection_hash);
      const intent = phase81J?.reuse_intents
        ?.find((item) => item.reuse_intent_ref === capsule.reuse_intent_ref);
      const candidate = phase81I?.reentry_candidates
        ?.find((item) => item.reentry_candidate_ref === capsule.source_reentry_candidate_ref);
      const expectedSignatures = intent && candidate ? buildContextSignatures(intent, candidate) : null;
      if (!evidence
          || !phase81J
          || !phase81I
          || !intent
          || !candidate
          || evidence.evidence_hash !== capsule.source_phase81l_evidence_hash
          || evidence.phase81j_projection_hash !== phase81J.projection_hash
          || evidence.source_phase81i_projection_hash !== phase81I.projection_hash
          || evidence.reuse_intent_ref !== intent.reuse_intent_ref
          || evidence.reuse_intent_hash !== intent.reuse_intent_hash
          || evidence.source_reentry_candidate_ref !== candidate.reentry_candidate_ref
          || evidence.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || intent.source_phase81i_projection_hash !== phase81I.projection_hash
          || intent.source_reentry_candidate_hash !== candidate.reentry_candidate_hash
          || !sameCharacter(evidence.character, capsule.character)
          || !sameCharacter(phase81J.character, capsule.character)
          || !sameCharacter(phase81I.character, capsule.character)
          || evidence.action_id !== capsule.current_action_id
          || evidence.action_ref !== capsule.current_action_ref
          || intent.current_action_id !== capsule.current_action_id
          || intent.current_action_ref !== capsule.current_action_ref
          || hashAgentRunValue(intent.prior_selected_action_subjective_experience)
            !== hashAgentRunValue(capsule.prior_linked_case_subjective_experience)
          || hashAgentRunValue(evidence.selected_action_subjective_experience)
            !== hashAgentRunValue(capsule.current_selected_action_subjective_experience)
          || hashAgentRunValue(expectedSignatures)
            !== hashAgentRunValue(capsule.current_context_cue_signatures)
          || hashAgentRunValue(canonicalHandledDifferenceKinds(intent))
            !== hashAgentRunValue(capsule.handled_context_difference_kinds)) {
        fail(
          "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LINEAGE_MISMATCH",
          "Phase81M capsule no longer matches its exact Phase81I/81J/81L lineage.",
        );
      }
    }

    const identity = cloneJson(capsule);
    for (const key of [
      "capsule_ref", "capsule_hash",
      "current_selected_action_subjective_outcome_observed",
      "prior_linked_case_subjective_outcome_is_current_world_truth",
      "prior_and_current_subjective_outcomes_compared_for_effectiveness",
      "reuse_or_advisory_effectiveness_inferred", "historical_counterfactual_truth_evaluated",
      "success_failure_interpretation_performed", "causal_or_outcome_credit_assigned",
      "preference_revision_performed", "belief_revision_performed",
      "semantic_revision_performed", "subjective_memory_rewrite_performed",
      "counterfactual_linked_capsule_is_episodic_fact_memory", "same_turn_reentry_allowed",
      "world_state_mutated", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (capsule.capsule_hash !== expectedHash
        || capsule.capsule_ref !== `phase81m_reuse_retention_${expectedHash.slice(0, 24)}`
        || seen.has(capsule.capsule_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_CAPSULE_HASH_MISMATCH",
        "Phase81M retention capsule identity verification failed.",
      );
    }
    seen.add(capsule.capsule_ref);
  }

  if (projection.audit.exact_phase81l_outcome_evidence_verified !== true
      || projection.audit.exact_phase81k_phase81j_phase81i_phase74d_world_history_revalidated !== true
      || projection.audit.hash_level_current_context_signatures_retained !== true
      || projection.audit.prior_and_current_subjective_outcomes_source_distinct !== true
      || projection.audit.prior_and_current_subjective_outcomes_compared_for_effectiveness !== false
      || projection.audit.reuse_or_advisory_effectiveness_inferred !== false
      || projection.audit.historical_counterfactual_truth_evaluated !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
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
      || projection.persistence_boundary.future_reentry_or_effectiveness_interpretation_requires_separate_phase !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_BOUNDARY_INVALID",
      "Phase81M projection violates its source-monitoring, authority, or persistence boundary.",
    );
  }
  return deepFreeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(input = {}) {
  const worldSimulationSessionId = requiredText(input.world_simulation_session_id, "world_simulation_session_id", 240);
  const turnId = requiredText(input.turn_id, "turn_id", 240);
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_INPUT_INVALID",
      "Phase81M state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const phase81L = assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidence(
    input.counterfactual_linked_experience_reuse_outcome_evidence,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      counterfactual_linked_experience_selected_action_lineage:
        input.counterfactual_linked_experience_selected_action_lineage,
      subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
      counterfactual_linked_experience_reentry_projections:
        input.counterfactual_linked_experience_reentry_projections,
      counterfactual_linked_experience_reuse_projections:
        input.counterfactual_linked_experience_reuse_projections,
      world_history: input.world_history,
      post_outcome_subjective_perception_projection:
        input.post_outcome_subjective_perception_projection,
    },
  );
  if (phase81L.version !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeEvidenceVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_PHASE81L_INVALID",
      "Phase81M requires the canonical Phase81L outcome-evidence version.",
    );
  }
  const sources = buildExactSources(input, phase81L);

  const capsules = [];
  for (const evidence of phase81L.evidence_records) {
    const phase81J = sources.phase81JByHash.get(evidence.phase81j_projection_hash);
    const phase81I = sources.phase81IByHash.get(evidence.source_phase81i_projection_hash);
    const intent = phase81J?.reuse_intents
      ?.find((item) => item.reuse_intent_ref === evidence.reuse_intent_ref);
    const candidate = phase81I?.reentry_candidates
      ?.find((item) => item.reentry_candidate_ref === evidence.source_reentry_candidate_ref);
    if (!phase81J
        || !phase81I
        || !intent
        || !candidate
        || intent.reuse_intent_hash !== evidence.reuse_intent_hash
        || candidate.reentry_candidate_hash !== evidence.source_reentry_candidate_hash
        || !sameCharacter(phase81J.character, evidence.character)
        || !sameCharacter(phase81I.character, evidence.character)
        || intent.current_action_id !== evidence.action_id
        || intent.current_action_ref !== evidence.action_ref) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_SOURCE_MISMATCH",
        "Phase81M cannot resolve exact Phase81I/81J ancestry for one Phase81L evidence record.",
      );
    }
    const contextSignatures = buildContextSignatures(intent, candidate);
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: evidence.character,
      source_phase81l_evidence_ref: evidence.evidence_ref,
      source_phase81l_evidence_hash: evidence.evidence_hash,
      source_phase81j_projection_hash: phase81J.projection_hash,
      source_phase81i_projection_hash: phase81I.projection_hash,
      reuse_intent_ref: intent.reuse_intent_ref,
      reuse_intent_hash: intent.reuse_intent_hash,
      source_reentry_candidate_ref: candidate.reentry_candidate_ref,
      source_reentry_candidate_hash: candidate.reentry_candidate_hash,
      current_action_id: evidence.action_id,
      current_action_ref: evidence.action_ref,
      current_context_cue_signatures: contextSignatures,
      handled_context_difference_kinds: canonicalHandledDifferenceKinds(intent),
      prior_linked_case_subjective_experience:
        cloneJson(intent.prior_selected_action_subjective_experience),
      current_selected_action_subjective_experience:
        cloneJson(evidence.selected_action_subjective_experience),
      source_monitoring: {
        historical_counterfactual_source: "imagined_decision_time_possibility",
        prior_linked_case_outcome_source: "prior_experienced_subjective_outcome",
        current_reuse_intent_source: "current_subjective_deliberative_reuse_intent",
        current_selection_source: "actual_selected_action_lineage",
        current_outcome_source: "current_experienced_subjective_outcome",
        sources_may_not_be_collapsed: true,
      },
    };
    const capsuleHash = hashAgentRunValue(identity);
    capsules.push({
      capsule_ref: `phase81m_reuse_retention_${capsuleHash.slice(0, 24)}`,
      capsule_hash: capsuleHash,
      ...identity,
      current_selected_action_subjective_outcome_observed: true,
      prior_linked_case_subjective_outcome_is_current_world_truth: false,
      prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
      reuse_or_advisory_effectiveness_inferred: false,
      historical_counterfactual_truth_evaluated: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
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
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_EXPERIENCE_REUSE_OUTCOME_RETENTION_LIMIT_EXCEEDED",
      `Phase81M accepts at most ${maximumRetentionCapsuleCount} capsules per turn.`,
    );
  }

  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsuleVersion,
    phase: "Phase81M",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_phase81l_projection_hash: phase81L.projection_hash,
    source_phase81j_projection_hashes: [...sources.phase81JByHash.keys()].sort(compareText),
    source_phase81i_projection_hashes: [...sources.phase81IByHash.keys()].sort(compareText),
    capsule_count: capsules.length,
    capsules,
    audit: {
      exact_phase81l_outcome_evidence_verified: true,
      exact_phase81k_phase81j_phase81i_phase74d_world_history_revalidated: true,
      hash_level_current_context_signatures_retained: true,
      prior_and_current_subjective_outcomes_source_distinct: true,
      prior_and_current_subjective_outcomes_compared_for_effectiveness: false,
      reuse_or_advisory_effectiveness_inferred: false,
      historical_counterfactual_truth_evaluated: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
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
      future_reentry_or_effectiveness_interpretation_requires_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeRetentionCapsules(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      counterfactual_linked_experience_reuse_outcome_evidence: phase81L,
      counterfactual_linked_experience_selected_action_lineage:
        input.counterfactual_linked_experience_selected_action_lineage,
      subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
      counterfactual_linked_experience_reentry_projections:
        input.counterfactual_linked_experience_reentry_projections,
      counterfactual_linked_experience_reuse_projections:
        input.counterfactual_linked_experience_reuse_projections,
      world_history: input.world_history,
      post_outcome_subjective_perception_projection:
        input.post_outcome_subjective_perception_projection,
    },
  );
}
