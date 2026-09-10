import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDeliberationVersion,
} from "./world-simulation-experiential-method-impasse-deliberation-service.mjs";
import {
  worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion,
} from "./world-simulation-experiential-method-impasse-discriminating-evidence-service.mjs";
import {
  assertWorldSimulationAnalogicalExperienceRetentionCapsules,
  worldSimulationAnalogicalExperienceRetentionCapsuleVersion,
} from "./world-simulation-analogical-experience-retention-capsule-service.mjs";

export const worldSimulationAnalogicalExperienceRetentionReentryVersion =
  "phase80g-retained-adapted-analogy-reentry-v1";

const maximumHistoryTurnsScanned = 64;
const maximumReentryCandidateCount = 32;

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
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_INPUT_INVALID",
      `Phase80G ${label} is required and must be bounded.`,
    );
  }
  return normalized;
}
function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), "en");
}
function characterKey(value) {
  return requiredText(value, "character", 240).toLocaleLowerCase("zh-Hant-TW");
}
function sameCharacter(left, right) {
  return characterKey(left) === characterKey(right);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function projectionHash(value, field) {
  const body = cloneJson(value);
  delete body[field];
  return hashAgentRunValue(body);
}
function cueContentHash(cueKind, content) {
  return hashAgentRunValue({ cue_kind: cueKind, content: cloneJson(content) });
}
function methodSkeletonHash(value) {
  if (!isObject(value)) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_METHOD_INVALID",
      "Phase80G method_skeleton must be an object.",
    );
  }
  return hashAgentRunValue(cloneJson(value));
}

function verifyCurrentPhase79D(value, expected) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpasseDeliberationVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !Array.isArray(projection.impasse_contexts)
      || projection.impasse_count !== projection.impasse_contexts.length
      || !text(projection.impasse_hash)
      || projectionHash(projection, "impasse_hash") !== projection.impasse_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_PHASE79D_INVALID",
      "Phase80G requires an exact canonical current Phase79D impasse projection.",
    );
  }
  if (!sameCharacter(projection.character, expected.character)
      || projection.current_turn_id !== expected.current_turn_id) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CURRENT_LINEAGE_MISMATCH",
      "Phase80G current Phase79D character/turn lineage does not match.",
    );
  }
  return projection;
}

function verifyCurrentPhase79E(value, phase79D, expected) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationExperientialMethodImpasseDiscriminatingEvidenceVersion
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || projection.source_phase79d_impasse_hash !== phase79D.impasse_hash
      || !Array.isArray(projection.impasse_evidence_contexts)
      || projection.impasse_count !== projection.impasse_evidence_contexts.length
      || !text(projection.evidence_hash)
      || projectionHash(projection, "evidence_hash") !== projection.evidence_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_PHASE79E_INVALID",
      "Phase80G requires an exact canonical current Phase79E evidence projection.",
    );
  }
  if (!sameCharacter(projection.character, expected.character)
      || projection.current_turn_id !== expected.current_turn_id) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CURRENT_LINEAGE_MISMATCH",
      "Phase80G current Phase79E character/turn lineage does not match.",
    );
  }
  return projection;
}

function currentContexts(phase79D, phase79E) {
  const evidenceByImpasse = new Map();
  for (const context of phase79E.impasse_evidence_contexts) {
    const impasseRef = requiredText(context?.impasse_ref, "Phase79E impasse_ref", 240);
    if (evidenceByImpasse.has(impasseRef) || !Array.isArray(context?.current_context_cue_catalog)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_PHASE79E_INVALID",
        "Phase80G requires unique Phase79E impasse contexts with cue catalogs.",
      );
    }
    const cues = context.current_context_cue_catalog.map((cue, index) => {
      const cueRef = requiredText(cue?.cue_ref, `Phase79E cue[${index}].cue_ref`, 240);
      const cueKind = requiredText(cue?.cue_kind, `Phase79E cue[${index}].cue_kind`, 120);
      if (!Object.hasOwn(object(cue), "content")
          || cue.current_turn_only !== true
          || cue.character_visible_context_only !== true
          || cue.world_truth_authority !== false) {
        fail(
          "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CURRENT_CUE_INVALID",
          "Phase80G accepts only bounded current-turn character-visible Phase79E cues.",
        );
      }
      return {
        current_cue_ref: cueRef,
        cue_kind: cueKind,
        content: cloneJson(cue.content),
        cue_content_hash: cueContentHash(cueKind, cue.content),
      };
    });
    const cueRefs = new Set(cues.map((cue) => cue.current_cue_ref));
    if (cueRefs.size !== cues.length) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CURRENT_CUE_INVALID",
        "Phase80G current cue refs must be unique per impasse.",
      );
    }
    evidenceByImpasse.set(impasseRef, cues);
  }

  return phase79D.impasse_contexts.map((context) => {
    const impasseRef = requiredText(context?.impasse_ref, "Phase79D impasse_ref", 240);
    const cues = evidenceByImpasse.get(impasseRef);
    if (!cues || !Array.isArray(context?.candidate_methods)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CURRENT_LINEAGE_MISMATCH",
        `Phase80G cannot resolve exact Phase79D/79E context for ${impasseRef}.`,
      );
    }
    const methods = context.candidate_methods.map((method, index) => ({
      current_corresponding_method_ref: requiredText(
        method?.transfer_ref,
        `Phase79D candidate_methods[${index}].transfer_ref`,
        240,
      ),
      method_skeleton: cloneJson(method?.method_skeleton),
      method_skeleton_hash: methodSkeletonHash(method?.method_skeleton),
    }));
    return { impasse_ref: impasseRef, methods, cues };
  });
}

function retainedBasis(capsule) {
  const basis = array(capsule.adapted_current_context_basis).map((cue, index) => {
    const cueKind = requiredText(cue?.cue_kind, `retained cue[${index}].cue_kind`, 120);
    if (!Object.hasOwn(object(cue), "content")
        || !["retained_alignment", "incorporated_difference"].includes(cue.adaptation_role)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CAPSULE_INVALID",
        "Phase80G retained adapted context basis violates the Phase80F contract.",
      );
    }
    const expectedHash = cueContentHash(cueKind, cue.content);
    if (cue.cue_content_hash !== expectedHash) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CAPSULE_INVALID",
        "Phase80G retained cue content hash is not canonical.",
      );
    }
    return {
      retained_cue_ref: `phase80g_retained_cue_${hashAgentRunValue({
        capsule_ref: capsule.capsule_ref,
        cue_kind: cueKind,
        cue_content_hash: expectedHash,
        adaptation_role: cue.adaptation_role,
      }).slice(0, 24)}`,
      cue_kind: cueKind,
      content: cloneJson(cue.content),
      cue_content_hash: expectedHash,
      prior_adaptation_role: cue.adaptation_role,
    };
  });
  basis.sort((left, right) => compareText(left.retained_cue_ref, right.retained_cue_ref));
  return basis;
}

function buildCandidate({ capsule, retainedProjection, sourceTurn, currentContext, currentMethod }) {
  const retainedCues = retainedBasis(capsule);
  const matches = [];
  for (const historical of retainedCues) {
    for (const current of currentContext.cues) {
      if (historical.cue_kind === current.cue_kind
          && historical.cue_content_hash === current.cue_content_hash) {
        matches.push({
          retained_cue_ref: historical.retained_cue_ref,
          current_cue_ref: current.current_cue_ref,
          cue_kind: historical.cue_kind,
          cue_content_hash: historical.cue_content_hash,
          exact_kind_and_content_match: true,
        });
      }
    }
  }
  matches.sort((left, right) => compareText(left.retained_cue_ref, right.retained_cue_ref)
    || compareText(left.current_cue_ref, right.current_cue_ref));
  if (matches.length === 0) return null;

  const matchedRetainedRefs = new Set(matches.map((match) => match.retained_cue_ref));
  const matchedCurrentRefs = new Set(matches.map((match) => match.current_cue_ref));
  const unmatchedRetained = retainedCues.filter((cue) => !matchedRetainedRefs.has(cue.retained_cue_ref));
  const currentAdditional = currentContext.cues
    .filter((cue) => !matchedCurrentRefs.has(cue.current_cue_ref))
    .map((cue) => cloneJson(cue));

  const identity = {
    version: worldSimulationAnalogicalExperienceRetentionReentryVersion,
    current_impasse_ref: currentContext.impasse_ref,
    current_corresponding_method_ref: currentMethod.current_corresponding_method_ref,
    current_corresponding_method_skeleton_hash: currentMethod.method_skeleton_hash,
    source_turn_id: sourceTurn.turn_id,
    source_revision_to: sourceTurn.revision_to,
    source_phase80f_projection_hash: retainedProjection.projection_hash,
    source_phase80f_capsule_ref: capsule.capsule_ref,
    source_phase80f_capsule_hash: capsule.capsule_hash,
    source_phase80e_evidence_ref: capsule.source_phase80e_evidence_ref,
    source_phase80e_evidence_hash: capsule.source_phase80e_evidence_hash,
    source_phase80c_projection_hash: capsule.source_phase80c_projection_hash,
    source_phase80a_projection_hash: capsule.source_phase80a_projection_hash,
    source_phase80b_adaptation_hash: capsule.source_phase80b_adaptation_hash,
    historical_analogy_candidate_ref: capsule.analogy_candidate_ref,
    historical_current_impasse_ref: capsule.current_impasse_ref,
    historical_corresponding_method_ref: capsule.current_corresponding_method_ref,
    retained_method_skeleton: cloneJson(capsule.method_skeleton),
    retained_method_skeleton_hash: methodSkeletonHash(capsule.method_skeleton),
    historical_method_outcome_assessment: capsule.method_outcome_assessment,
    historical_outcome_evidence_kind: capsule.outcome_evidence_kind,
    exact_current_cue_matches: matches,
    unmatched_retained_context_cues: unmatchedRetained,
    current_additional_context_cues: currentAdditional,
  };
  const candidateHash = hashAgentRunValue(identity);
  return {
    reentry_candidate_ref: `phase80g_reentry_${candidateHash.slice(0, 24)}`,
    reentry_candidate_hash: candidateHash,
    ...identity,
    exact_current_cue_match_count: matches.length,
    unmatched_retained_context_cue_count: unmatchedRetained.length,
    current_additional_context_cue_count: currentAdditional.length,
    exact_method_skeleton_identity: true,
    current_context_cue_overlap_present: true,
    current_context_difference_present:
      unmatchedRetained.length > 0 || currentAdditional.length > 0,
    prior_subjective_outcome_is_candidate_evidence_only: true,
    prior_subjective_outcome_is_current_world_truth: false,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    automatic_preference_selected: false,
    action_selection_performed: false,
    semantic_method_revision_performed: false,
    world_truth_authority: false,
  };
}

export function buildWorldSimulationAnalogicalExperienceRetentionReentryContract() {
  return deepFreeze({
    version: worldSimulationAnalogicalExperienceRetentionReentryVersion,
    phase: "Phase80G",
    status: "retained_adapted_analogy_cross_turn_reentry_evidence_installed",
    source_history_owner: "WorldSimulationHistory",
    source_retention_owner: "Phase80F",
    current_context_owners: ["Phase79D", "Phase79E"],
    same_character_prior_committed_turns_only: true,
    same_turn_feedback_allowed: false,
    exact_phase80f_capsule_hash_and_lineage_required: true,
    exact_current_phase79d_phase79e_lineage_required: true,
    exact_method_skeleton_identity_required: true,
    exact_cue_kind_and_content_overlap_required: true,
    fuzzy_semantic_similarity_modeled: false,
    retained_supported_counterevidenced_and_ambiguous_cases_reenter: true,
    retained_subjective_outcome_is_candidate_evidence_only: true,
    prior_outcome_is_current_world_truth: false,
    comparative_superiority_inferred: false,
    causal_credit_assigned: false,
    automatic_preference_selection_performed: false,
    action_selection_performed: false,
    semantic_method_revision_performed: false,
    world_truth_authority_claimed: false,
    numeric_similarity_confidence_probability_utility_reward_modeled: false,
    direct_plan_goal_belief_current_mind_world_mutation_allowed: false,
    technical_history_window_not_cognitive_weight: true,
    maximum_history_turns_scanned: maximumHistoryTurnsScanned,
    maximum_reentry_candidate_count: maximumReentryCandidateCount,
  });
}

export function assertWorldSimulationAnalogicalExperienceRetentionReentryProjection(value, expected = {}) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationAnalogicalExperienceRetentionReentryVersion
      || !text(projection.world_simulation_session_id)
      || !text(projection.character)
      || !text(projection.current_turn_id)
      || !Number.isInteger(projection.current_state_revision)
      || projection.current_state_revision < 0
      || !text(projection.current_world_state_hash)
      || !text(projection.source_phase79d_impasse_hash)
      || !text(projection.source_phase79e_evidence_hash)
      || !Array.isArray(projection.reentry_candidates)
      || projection.reentry_candidate_count !== projection.reentry_candidates.length
      || projection.reentry_candidate_count > maximumReentryCandidateCount
      || !isObject(projection.history_window)
      || !text(projection.projection_hash)
      || projectionHash(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_INVALID",
      "Phase80G retention re-entry projection is invalid.",
    );
  }
  for (const key of [
    "world_simulation_session_id",
    "character",
    "current_turn_id",
    "current_state_revision",
    "current_world_state_hash",
  ]) {
    if (Object.hasOwn(expected, key) && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_LINEAGE_MISMATCH",
        `Phase80G projection ${key} does not match expected lineage.`,
      );
    }
  }
  const refs = new Set();
  for (const candidate of projection.reentry_candidates) {
    if (!isObject(candidate)
        || !text(candidate.reentry_candidate_ref)
        || !text(candidate.reentry_candidate_hash)
        || !text(candidate.source_turn_id)
        || !Number.isInteger(candidate.source_revision_to)
        || !text(candidate.source_phase80f_projection_hash)
        || !text(candidate.source_phase80f_capsule_ref)
        || !text(candidate.source_phase80f_capsule_hash)
        || !text(candidate.current_impasse_ref)
        || !text(candidate.current_corresponding_method_ref)
        || !text(candidate.current_corresponding_method_skeleton_hash)
        || candidate.retained_method_skeleton_hash !== candidate.current_corresponding_method_skeleton_hash
        || !["supports_prior_method", "counterevidence_for_prior_method", "ambiguous_no_revision"]
          .includes(candidate.historical_method_outcome_assessment)
        || !Array.isArray(candidate.exact_current_cue_matches)
        || candidate.exact_current_cue_matches.length === 0
        || candidate.exact_current_cue_match_count !== candidate.exact_current_cue_matches.length
        || !Array.isArray(candidate.unmatched_retained_context_cues)
        || candidate.unmatched_retained_context_cue_count !== candidate.unmatched_retained_context_cues.length
        || !Array.isArray(candidate.current_additional_context_cues)
        || candidate.current_additional_context_cue_count !== candidate.current_additional_context_cues.length
        || candidate.exact_method_skeleton_identity !== true
        || candidate.current_context_cue_overlap_present !== true
        || candidate.prior_subjective_outcome_is_candidate_evidence_only !== true
        || candidate.prior_subjective_outcome_is_current_world_truth !== false
        || candidate.comparative_superiority_inferred !== false
        || candidate.causal_credit_assigned !== false
        || candidate.automatic_preference_selected !== false
        || candidate.action_selection_performed !== false
        || candidate.semantic_method_revision_performed !== false
        || candidate.world_truth_authority !== false) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CANDIDATE_INVALID",
        "Phase80G re-entry candidate violates its bounded evidence contract.",
      );
    }
    const identity = cloneJson(candidate);
    for (const key of [
      "reentry_candidate_ref", "reentry_candidate_hash", "exact_current_cue_match_count",
      "unmatched_retained_context_cue_count", "current_additional_context_cue_count",
      "exact_method_skeleton_identity", "current_context_cue_overlap_present",
      "current_context_difference_present", "prior_subjective_outcome_is_candidate_evidence_only",
      "prior_subjective_outcome_is_current_world_truth", "comparative_superiority_inferred",
      "causal_credit_assigned", "automatic_preference_selected", "action_selection_performed",
      "semantic_method_revision_performed", "world_truth_authority",
    ]) delete identity[key];
    const expectedHash = hashAgentRunValue(identity);
    if (candidate.reentry_candidate_hash !== expectedHash
        || candidate.reentry_candidate_ref !== `phase80g_reentry_${expectedHash.slice(0, 24)}`
        || refs.has(candidate.reentry_candidate_ref)) {
      fail(
        "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CANDIDATE_HASH_MISMATCH",
        "Phase80G re-entry candidate identity verification failed.",
      );
    }
    refs.add(candidate.reentry_candidate_ref);
  }
  return deepFreeze(projection);
}

export function projectWorldSimulationAnalogicalExperienceRetentionReentry(input = {}) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
    240,
  );
  const character = requiredText(input.character, "character", 240);
  const currentTurnId = requiredText(input.current_turn_id, "current_turn_id", 240);
  if (!Number.isInteger(input.current_state_revision) || input.current_state_revision < 0) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_INPUT_INVALID",
      "Phase80G current_state_revision must be a non-negative integer.",
    );
  }
  const currentWorldStateHash = requiredText(
    input.current_world_state_hash,
    "current_world_state_hash",
    128,
  );
  const phase79D = verifyCurrentPhase79D(input.source_phase79d_impasse_deliberation, {
    character,
    current_turn_id: currentTurnId,
  });
  const phase79E = verifyCurrentPhase79E(
    input.source_phase79e_discriminating_evidence,
    phase79D,
    { character, current_turn_id: currentTurnId },
  );
  const contexts = currentContexts(phase79D, phase79E);
  const history = cloneJson(input.world_history);
  if (!isObject(history)
      || history.world_simulation_session_id !== worldSimulationSessionId
      || !Array.isArray(history.turns)) {
    fail(
      "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_HISTORY_INVALID",
      "Phase80G requires canonical same-session World Simulation history.",
    );
  }

  const priorTurns = history.turns.filter((turn) =>
    isObject(turn)
      && turn.turn_id !== currentTurnId
      && Number.isInteger(turn.revision_from)
      && turn.revision_from >= 0
      && Number.isInteger(turn.revision_to)
      && turn.revision_to >= 1
      && turn.revision_to <= input.current_state_revision);
  const truncated = priorTurns.length > maximumHistoryTurnsScanned;
  const scannedTurns = priorTurns.slice(-maximumHistoryTurnsScanned);
  const candidates = [];
  let retainedProjectionCount = 0;
  let sameCharacterCapsuleCount = 0;

  for (const turn of scannedTurns) {
    const rawProjections = array(turn.analogical_experience_retention_capsules);
    for (const rawProjection of rawProjections) {
      const retained = assertWorldSimulationAnalogicalExperienceRetentionCapsules(rawProjection, {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turn.turn_id,
        state_revision: turn.revision_from,
        world_state_hash: turn.previous_state_hash,
      });
      if (retained.version !== worldSimulationAnalogicalExperienceRetentionCapsuleVersion) {
        fail(
          "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_HISTORY_PHASE80F_INVALID",
          "Phase80G historical retention projection version mismatch.",
        );
      }
      retainedProjectionCount += 1;
      for (const capsule of retained.capsules) {
        if (!sameCharacter(capsule.character, character)) continue;
        if (capsule.same_turn_reentry_allowed !== false
            || capsule.subjective_outcome_not_world_truth !== true
            || capsule.comparative_superiority_inferred !== false
            || capsule.causal_credit_assigned !== false
            || capsule.automatic_preference_learning_performed !== false
            || capsule.semantic_method_revision_performed !== false) {
          fail(
            "WORLD_SIMULATION_ANALOGICAL_EXPERIENCE_RETENTION_REENTRY_CAPSULE_BOUNDARY_INVALID",
            "Phase80G rejects historical capsules that violate the sealed Phase80F authority boundary.",
          );
        }
        sameCharacterCapsuleCount += 1;
        const retainedMethodHash = methodSkeletonHash(capsule.method_skeleton);
        for (const currentContext of contexts) {
          for (const currentMethod of currentContext.methods) {
            if (currentMethod.method_skeleton_hash !== retainedMethodHash) continue;
            const candidate = buildCandidate({
              capsule,
              retainedProjection: retained,
              sourceTurn: turn,
              currentContext,
              currentMethod,
            });
            if (candidate) candidates.push(candidate);
          }
        }
      }
    }
  }

  candidates.sort((left, right) => {
    if (left.source_revision_to !== right.source_revision_to) {
      return right.source_revision_to - left.source_revision_to;
    }
    return compareText(left.reentry_candidate_ref, right.reentry_candidate_ref);
  });
  const bounded = candidates.slice(0, maximumReentryCandidateCount);
  const projection = {
    version: worldSimulationAnalogicalExperienceRetentionReentryVersion,
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
    source_phase79d_impasse_hash: phase79D.impasse_hash,
    source_phase79e_evidence_hash: phase79E.evidence_hash,
    retained_projection_count_scanned: retainedProjectionCount,
    same_character_retention_capsule_count_scanned: sameCharacterCapsuleCount,
    reentry_candidate_count: bounded.length,
    reentry_candidates: bounded,
    history_window: {
      total_prior_committed_turn_count: priorTurns.length,
      scanned_turn_count: scannedTurns.length,
      maximum_history_turns_scanned: maximumHistoryTurnsScanned,
      truncated,
      technical_bound_only: true,
      recency_is_not_confidence_or_utility: true,
    },
    audit: {
      same_character_prior_committed_turns_only: true,
      same_turn_history_ignored: true,
      exact_phase80f_capsule_hash_and_world_turn_lineage_verified: true,
      exact_current_phase79d_phase79e_lineage_verified: true,
      exact_method_skeleton_identity_required: true,
      exact_cue_kind_and_content_overlap_required: true,
      fuzzy_semantic_similarity_used: false,
      supported_counterevidenced_and_ambiguous_cases_retained: true,
      prior_subjective_outcome_treated_as_candidate_evidence_only: true,
      prior_subjective_outcome_treated_as_current_world_truth: false,
      comparative_superiority_inferred: false,
      causal_credit_assigned: false,
      automatic_preference_selected: false,
      action_selection_performed: false,
      semantic_method_revision_performed: false,
      numeric_similarity_confidence_probability_utility_reward_modeled: false,
      direct_plan_goal_belief_current_mind_world_mutation_performed: false,
      resolver_used: false,
      same_turn_character_brain_feedback: false,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationAnalogicalExperienceRetentionReentryProjection(projection, {
    world_simulation_session_id: worldSimulationSessionId,
    character,
    current_turn_id: currentTurnId,
    current_state_revision: input.current_state_revision,
    current_world_state_hash: currentWorldStateHash,
  });
}
