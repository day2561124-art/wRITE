import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence,
  worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceVersion,
} from "./world-simulation-counterfactual-linked-experience-reuse-outcome-selected-action-outcome-evidence-service.mjs";

export const worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion =
  "phase82a-counterfactual-linked-experience-longitudinal-reuse-outcome-evidence-v1";

const maximumPriorOutcomeCountPerAnchor = 12;
const maximumContextCount = 32;

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
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function requiredText(value, label, maxLength = 600) {
  const normalized = text(value);
  if (!normalized || normalized.length > maxLength) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_INPUT_INVALID",
      `Phase82A ${label} must be a bounded non-empty string.`,
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
function hashWithout(value, field) {
  const copy = cloneJson(value);
  delete copy[field];
  return hashAgentRunValue(copy);
}
function turns(worldHistory) {
  if (Array.isArray(worldHistory)) return worldHistory;
  return array(worldHistory?.turns);
}
// Identity tags *only* snapshots made by the full JSON isolation boundary.
// This is not a cache of evidence, hashes, or prior-Q validation results.
// Weak references do not retain snapshots across completed World turns.
const phase82aIsolatedHistorySnapshots = new WeakSet();

function freezeIsolatedJson(root) {
  const pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object" || Object.isFrozen(value)) continue;
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === "object") pending.push(nested);
    }
    Object.freeze(value);
  }
  return root;
}

// Create exactly one detached, JSON-normalized, immutable history snapshot
// inside a World resolution, after history has been obtained from its actual
// committed state. All nested Phase82A/B/C/D reconstructions STILL revalidate
// every historical Q and its full provenance separately against this snapshot.
// This helper does not attest evidence validity and skips no hash checks.
export function isolateWorldSimulationPhase82AHistoryForTurn(worldHistory) {
  const sourceTurns = turns(worldHistory);
  if (!sourceTurns.some((turn) => isObject(turn)
    && isObject(turn.counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence))) {
    return worldHistory;
  }
  const snapshot = cloneJson(isObject(worldHistory)
    ? worldHistory
    : { turns: sourceTurns });
  freezeIsolatedJson(snapshot);
  phase82aIsolatedHistorySnapshots.add(snapshot);
  return snapshot;
}
function exactQExpectedFromTurn(turn) {
  return {
    world_simulation_session_id: undefined,
    turn_id: turn.turn_id,
    state_revision: turn.revision_from,
    world_state_hash: turn.previous_state_hash,
    counterfactual_linked_experience_reuse_outcome_selected_action_lineage:
      turn.counterfactual_linked_experience_reuse_outcome_selected_action_lineage,
    subjective_choice_commitment_receipts: turn.subjective_choice_commitment_receipts,
    counterfactual_linked_experience_reuse_outcome_reentry_projections:
      turn.counterfactual_linked_experience_reuse_outcome_reentry_projections,
    counterfactual_linked_experience_reuse_outcome_deliberation_projections:
      turn.counterfactual_linked_experience_reuse_outcome_deliberation_projections,
    world_history: null,
    post_outcome_subjective_perception_projection:
      turn.post_outcome_subjective_perception_projection,
  };
}
function historyPrefix(isolatedHistory, endIndex) {
  // Callers receive only the committed prefix. The source history has
  // already been canonicalized and deep-cloned once for this Phase82A
  // invocation; re-copying the growing prefix for every prior turn made
  // nested Phase82B/C/D canonical verification superlinear.
  //
  // Share *only* the internal isolated snapshot's historical turn objects.
  // Neither the original World History nor any committed memory is aliased.
  const prefixTurns = turns(isolatedHistory).slice(0, endIndex);
  return isObject(isolatedHistory)
    ? { ...isolatedHistory, turns: prefixTurns }
    : { turns: prefixTurns };
}
function canonicalPriorQ(worldHistory, turn, index, sessionId) {
  const projection = turn?.counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence;
  if (!isObject(projection)) return null;
  const expected = exactQExpectedFromTurn(turn);
  expected.world_simulation_session_id = sessionId;
  expected.world_history = historyPrefix(worldHistory, index);
  return assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
    projection,
    expected,
  );
}
function boundedEvidenceItem(record, role) {
  return {
    role,
    turn_id: record.turn_id,
    character: record.character,
    phase81q_evidence_ref: record.evidence_ref,
    phase81q_evidence_hash: record.evidence_hash,
    source_phase81m_capsule_ref: record.source_phase81m_capsule_ref,
    source_phase81l_evidence_ref: record.source_phase81l_evidence_ref,
    reuse_intent_ref: record.reuse_intent_ref,
    deliberative_reuse_intent_ref: record.deliberative_reuse_intent_ref,
    action_id: record.action_id,
    action_ref: record.action_ref,
    selected_action_subjective_experience: cloneJson(record.selected_action_subjective_experience),
    subjective_not_world_truth: true,
  };
}
function sameCase(left, right) {
  return characterKey(left.character) === characterKey(right.character)
    && left.source_phase81m_capsule_ref === right.source_phase81m_capsule_ref
    && left.source_phase81l_evidence_ref === right.source_phase81l_evidence_ref
    && left.reuse_intent_ref === right.reuse_intent_ref;
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceContract() {
  return Object.freeze({
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
    phase: "Phase82A",
    status: "bounded_longitudinal_reuse_outcome_evidence_assembly_installed",
    source_current_outcome_owner: "Phase81Q",
    source_prior_outcome_owner: "Phase81Q committed World History",
    exact_current_phase81q_lineage_required: true,
    exact_prior_phase81q_per_turn_revalidation_required: true,
    same_character_same_root_reuse_case_required: true,
    current_anchor_required: true,
    prior_outcome_required_for_longitudinal_ready: 1,
    individual_outcome_specificity_preserved: true,
    prior_and_current_subjective_outcomes_source_distinct: true,
    effectiveness_interpretation_performed: false,
    success_failure_interpretation_performed: false,
    reward_or_q_value_modeled: false,
    causal_or_outcome_credit_assigned: false,
    recurrence_count_auto_promotes_rule: false,
    preference_revision_performed: false,
    belief_revision_performed: false,
    semantic_revision_performed: false,
    subjective_memory_rewrite_performed: false,
    world_truth_authority_claimed: false,
    direct_world_state_mutation_allowed: false,
    same_turn_character_brain_feedback_allowed: false,
    append_only_world_history_persistence: true,
    persist_only_with_successful_atomic_world_turn_commit: true,
    maximum_prior_outcome_count_per_anchor: maximumPriorOutcomeCountPerAnchor,
    maximum_context_count: maximumContextCount,
  });
}

export function assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
  value,
  expected = {},
) {
  const projection = cloneJson(value);
  if (!isObject(projection)
      || projection.version !== worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion
      || projection.phase !== "Phase82A"
      || !text(projection.world_simulation_session_id)
      || !text(projection.turn_id)
      || !Number.isSafeInteger(projection.state_revision)
      || projection.state_revision < 0
      || !text(projection.world_state_hash)
      || !text(projection.source_current_phase81q_projection_hash)
      || !Array.isArray(projection.character_case_contexts)
      || projection.context_count !== projection.character_case_contexts.length
      || projection.context_count > maximumContextCount
      || !isObject(projection.audit)
      || !isObject(projection.persistence_boundary)
      || !text(projection.projection_hash)
      || hashWithout(projection, "projection_hash") !== projection.projection_hash) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_INVALID",
      "Phase82A longitudinal reuse-outcome evidence projection is invalid.",
    );
  }
  for (const key of ["world_simulation_session_id", "turn_id", "state_revision", "world_state_hash"]) {
    if (Object.hasOwn(expected, key) && expected[key] !== undefined && projection[key] !== expected[key]) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_LINEAGE_MISMATCH",
        `Phase82A projection ${key} does not match expected lineage.`,
      );
    }
  }
  const seenContextRefs = new Set();
  for (const context of projection.character_case_contexts) {
    if (!isObject(context)
        || !text(context.context_ref)
        || !text(context.context_hash)
        || !text(context.character)
        || !text(context.source_phase81m_capsule_ref)
        || !text(context.source_phase81l_evidence_ref)
        || !text(context.reuse_intent_ref)
        || !isObject(context.current_anchor)
        || context.current_anchor.role !== "current_anchor"
        || !Array.isArray(context.prior_reuse_outcomes)
        || context.prior_reuse_outcome_count !== context.prior_reuse_outcomes.length
        || context.prior_reuse_outcome_count > maximumPriorOutcomeCountPerAnchor
        || context.longitudinal_ready !== (context.prior_reuse_outcome_count > 0)
        || context.effectiveness_interpretation_performed !== false
        || context.success_failure_interpretation_performed !== false
        || context.causal_or_outcome_credit_assigned !== false
        || context.recurrence_count_auto_promotes_rule !== false) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_CONTEXT_INVALID",
        "Phase82A contains an invalid or over-authoritative longitudinal context.",
      );
    }
    const identity = cloneJson(context);
    delete identity.context_ref;
    delete identity.context_hash;
    delete identity.effectiveness_interpretation_performed;
    delete identity.success_failure_interpretation_performed;
    delete identity.causal_or_outcome_credit_assigned;
    delete identity.recurrence_count_auto_promotes_rule;
    const expectedHash = hashAgentRunValue(identity);
    if (context.context_hash !== expectedHash
        || context.context_ref !== `phase82a_longitudinal_${expectedHash.slice(0, 24)}`
        || seenContextRefs.has(context.context_ref)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_CONTEXT_HASH_MISMATCH",
        "Phase82A longitudinal context identity verification failed.",
      );
    }
    seenContextRefs.add(context.context_ref);
  }
  if (projection.audit.exact_current_phase81q_lineage_verified !== true
      || projection.audit.exact_prior_phase81q_per_turn_revalidation_performed !== true
      || projection.audit.same_character_same_root_reuse_case_required !== true
      || projection.audit.effectiveness_interpretation_performed !== false
      || projection.audit.success_failure_interpretation_performed !== false
      || projection.audit.reward_or_q_value_modeled !== false
      || projection.audit.causal_or_outcome_credit_assigned !== false
      || projection.audit.recurrence_count_auto_promotes_rule !== false
      || projection.audit.preference_revision_performed !== false
      || projection.audit.belief_revision_performed !== false
      || projection.audit.semantic_revision_performed !== false
      || projection.audit.subjective_memory_rewrite_performed !== false
      || projection.audit.same_turn_character_brain_feedback !== false
      || projection.audit.world_truth_authority_claimed !== false
      || projection.persistence_boundary.persist_only_with_successful_atomic_world_turn_commit !== true
      || projection.persistence_boundary.blocked_or_failed_turn_persists_evidence !== false
      || projection.persistence_boundary.append_only_world_history_only !== true
      || projection.persistence_boundary.projection_does_not_mutate_world_state !== true
      || projection.persistence_boundary.interpretation_deferred_to_separate_phase !== true) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_BOUNDARY_INVALID",
      "Phase82A projection violates its evidence-only authority boundary.",
    );
  }
  return Object.freeze(projection);
}

export function buildWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
  input = {},
) {
  const worldSimulationSessionId = requiredText(
    input.world_simulation_session_id,
    "world_simulation_session_id",
  );
  const turnId = requiredText(input.turn_id, "turn_id");
  if (!Number.isSafeInteger(input.state_revision) || input.state_revision < 0) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_INPUT_INVALID",
      "Phase82A state_revision must be a non-negative safe integer.",
    );
  }
  const worldStateHash = requiredText(input.world_state_hash, "world_state_hash", 128);
  const currentQ =
    assertWorldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidence(
      input.current_phase81q_outcome_evidence,
      {
        world_simulation_session_id: worldSimulationSessionId,
        turn_id: turnId,
        state_revision: input.state_revision,
        world_state_hash: worldStateHash,
        counterfactual_linked_experience_reuse_outcome_selected_action_lineage:
          input.counterfactual_linked_experience_reuse_outcome_selected_action_lineage,
        subjective_choice_commitment_receipts: input.subjective_choice_commitment_receipts,
        counterfactual_linked_experience_reuse_outcome_reentry_projections:
          input.counterfactual_linked_experience_reuse_outcome_reentry_projections,
        counterfactual_linked_experience_reuse_outcome_deliberation_projections:
          input.counterfactual_linked_experience_reuse_outcome_deliberation_projections,
        world_history: input.world_history,
        post_outcome_subjective_perception_projection:
          input.post_outcome_subjective_perception_projection,
      },
    );
  if (currentQ.version
      !== worldSimulationCounterfactualLinkedExperienceReuseOutcomeSelectedActionOutcomeEvidenceVersion) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_PHASE81Q_INVALID",
      "Phase82A requires the canonical Phase81Q outcome-evidence version.",
    );
  }

  // Every current Phase81Q is independently revalidated against the
  // original World History above. If no prior committed turn even carries
  // Phase81Q, canonicalPriorQ has no work and its isolated copy would never
  // be consumed. In particular, long-lived non-reuse worlds must not clone
  // their entire unrelated history once for each nested Phase82B/C/D check.
  //
  // Any historical Phase81Q (including zero-record evidence) takes the
  // original fail-closed path: one full JSON-normalized isolated snapshot,
  // exact per-turn lineage verification and no cross-call cache.
  const sourceTurns = turns(input.world_history);
  const priorQPresent = sourceTurns.some((turn) => isObject(turn)
    && isObject(turn.counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence));
  // If this exact object was created by our turn-scoped JSON isolation
  // boundary, it is deeply frozen and detached from the caller. Reuse only
  // the bytes/objects, NEVER the result of validating historical Phase81Q.
  // Direct callers without a marked snapshot still get fresh isolation.
  const isolatedHistory = priorQPresent
    ? (isObject(input.world_history)
        && phase82aIsolatedHistorySnapshots.has(input.world_history)
        ? input.world_history
        : cloneJson(isObject(input.world_history)
          ? input.world_history
          : { turns: sourceTurns }))
    : null;
  const canonicalPrior = [];
  if (isolatedHistory) {
    const historyTurns = turns(isolatedHistory);
    for (let index = 0; index < historyTurns.length; index += 1) {
      const turn = historyTurns[index];
      if (!isObject(turn)) continue;
      const priorQ = canonicalPriorQ(isolatedHistory, turn, index, worldSimulationSessionId);
      if (!priorQ) continue;
      canonicalPrior.push({ turn_index: index, projection: priorQ });
    }
  }

  const contexts = [];
  for (const currentRecord of currentQ.evidence_records) {
    const priorItems = [];
    for (let index = canonicalPrior.length - 1; index >= 0; index -= 1) {
      const priorQ = canonicalPrior[index].projection;
      for (const priorRecord of priorQ.evidence_records) {
        if (!sameCase(currentRecord, priorRecord)) continue;
        priorItems.push(boundedEvidenceItem(priorRecord, "prior_reuse_outcome"));
        if (priorItems.length >= maximumPriorOutcomeCountPerAnchor) break;
      }
      if (priorItems.length >= maximumPriorOutcomeCountPerAnchor) break;
    }
    priorItems.reverse();
    const identity = {
      version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
      character: currentRecord.character,
      source_phase81m_capsule_ref: currentRecord.source_phase81m_capsule_ref,
      source_phase81l_evidence_ref: currentRecord.source_phase81l_evidence_ref,
      reuse_intent_ref: currentRecord.reuse_intent_ref,
      current_anchor: boundedEvidenceItem(currentRecord, "current_anchor"),
      prior_reuse_outcomes: priorItems,
      prior_reuse_outcome_count: priorItems.length,
      longitudinal_ready: priorItems.length > 0,
    };
    const contextHash = hashAgentRunValue(identity);
    contexts.push({
      context_ref: `phase82a_longitudinal_${contextHash.slice(0, 24)}`,
      context_hash: contextHash,
      ...identity,
      effectiveness_interpretation_performed: false,
      success_failure_interpretation_performed: false,
      causal_or_outcome_credit_assigned: false,
      recurrence_count_auto_promotes_rule: false,
    });
  }
  contexts.sort((left, right) => compareText(left.context_ref, right.context_ref));
  if (contexts.length > maximumContextCount) {
    fail(
      "WORLD_SIMULATION_COUNTERFACTUAL_LINKED_LONGITUDINAL_REUSE_OUTCOME_EVIDENCE_LIMIT_EXCEEDED",
      `Phase82A accepts at most ${maximumContextCount} current anchor contexts per turn.`,
    );
  }
  const projection = {
    version: worldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidenceVersion,
    phase: "Phase82A",
    world_simulation_session_id: worldSimulationSessionId,
    turn_id: turnId,
    state_revision: input.state_revision,
    world_state_hash: worldStateHash,
    source_current_phase81q_projection_hash: currentQ.projection_hash,
    context_count: contexts.length,
    longitudinal_ready_context_count: contexts.filter((context) => context.longitudinal_ready).length,
    character_case_contexts: contexts,
    audit: {
      exact_current_phase81q_lineage_verified: true,
      exact_prior_phase81q_per_turn_revalidation_performed: true,
      prior_phase81q_projection_count_verified: canonicalPrior.length,
      same_character_same_root_reuse_case_required: true,
      individual_outcome_specificity_preserved: true,
      prior_and_current_subjective_outcomes_source_distinct: true,
      effectiveness_interpretation_performed: false,
      success_failure_interpretation_performed: false,
      reward_or_q_value_modeled: false,
      causal_or_outcome_credit_assigned: false,
      recurrence_count_auto_promotes_rule: false,
      preference_revision_performed: false,
      belief_revision_performed: false,
      semantic_revision_performed: false,
      subjective_memory_rewrite_performed: false,
      same_turn_character_brain_feedback: false,
      world_truth_authority_claimed: false,
    },
    persistence_boundary: {
      persist_only_with_successful_atomic_world_turn_commit: true,
      blocked_or_failed_turn_persists_evidence: false,
      append_only_world_history_only: true,
      projection_does_not_mutate_world_state: true,
      interpretation_deferred_to_separate_phase: true,
    },
  };
  projection.projection_hash = hashAgentRunValue(projection);
  return assertWorldSimulationCounterfactualLinkedExperienceLongitudinalReuseOutcomeEvidence(
    projection,
    {
      world_simulation_session_id: worldSimulationSessionId,
      turn_id: turnId,
      state_revision: input.state_revision,
      world_state_hash: worldStateHash,
    },
  );
}
