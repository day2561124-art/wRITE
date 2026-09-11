import { randomBytes } from "node:crypto";

import {
  buildWorldSimulationCharacterBrainInput,
  worldSimulationCharacterBrainInputVersion,
} from "./world-simulation-character-brain-input-service.mjs";
import {
  adoptWorldSimulationCounterfactualReflectionReentry,
} from "./world-simulation-counterfactual-reflection-reentry-adoption-service.mjs";
import {
  buildWorldSimulationCounterfactualPreparativeRevalidationResolverView,
  projectWorldSimulationCounterfactualPreparativeRevalidation,
} from "./world-simulation-counterfactual-preparative-revalidation-service.mjs";
import {
  projectWorldSimulationCounterfactualLinkedExperienceReentry,
} from "./world-simulation-counterfactual-linked-experience-reentry-service.mjs";
import {
  prepareWorldSimulationTurn,
  resolveWorldSimulationTurn,
} from "./world-simulation-loop-service.mjs";
import {
  createEphemeralWorldSimulationPreparedTurnBroker,
  worldSimulationPreparedTurnBrokerVersion,
} from "./world-simulation-prepared-turn-ephemeral-broker.mjs";
import {
  assertWorldSimulationSession,
  beginWorldSimulationSession,
} from "./world-simulation-session-service.mjs";
import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";
import {
  projectWorldSimulationEffectiveActionCommitment,
} from "./world-simulation-effective-action-commitment-projection-service.mjs";
import {
  buildWorldSimulationEffectiveActionCommitmentCharacterExposure,
} from "./world-simulation-effective-action-commitment-character-exposure-service.mjs";
import {
  projectWorldSimulationActionCommitmentExecutionFeedback,
} from "./world-simulation-action-commitment-execution-feedback-service.mjs";
import {
  projectWorldSimulationActionCommitmentSubjectiveExecutionExperience,
} from "./world-simulation-action-commitment-subjective-execution-experience-service.mjs";
import {
  buildWorldSimulationFormalImpasseDeliberationContract,
  buildWorldSimulationFormalImpasseDeliberationRound,
  buildWorldSimulationFormalImpasseResolverReplay,
  worldSimulationFormalImpasseDecisionKinds,
} from "./world-simulation-formal-experiential-deliberation-service.mjs";

export const worldSimulationFormalTurnTransportVersion =
  "phase62a-r1-step4b1-formal-turn-transport-core-v1";

const formalResolverOwnerId =
  `formal_turn_runtime_${randomBytes(16).toString("hex")}`;

const inProcessPreparedTurnBroker =
  createEphemeralWorldSimulationPreparedTurnBroker({
    ownership: "formal_world_turn_in_process_runtime",
    storage_scope: "process_local_ephemeral_memory",
  });

function formalLoopOptions(options = {}) {
  // Deliberately do not forward caller callbacks/adapters. Formal transport
  // owns the runtime route: missing retrieval resolver means no retrieval
  // process, and resolve always uses the built-in programmatic adjudicator.
  return options.fixtureRoot
    ? { fixtureRoot: options.fixtureRoot }
    : {};
}

function formalReplayLoopOptions(options = {}, priorSubmissions = []) {
  const base = formalLoopOptions(options);
  if (!Array.isArray(priorSubmissions) || priorSubmissions.length === 0) {
    return base;
  }
  // Phase79M is the only formal-mainline resolver exception: these closures
  // are minted by the trusted transport from broker-held, already validated
  // Character Brain submissions. No caller callback or neural adapter is
  // forwarded, and every replay is bound to the exact canonical resolver-view
  // hash that produced the deliberation task.
  return {
    ...base,
    ...buildWorldSimulationFormalImpasseResolverReplay(priorSubmissions),
  };
}

function preparedTurnBroker(options = {}) {
  return options.preparedTurnBroker
    ?? inProcessPreparedTurnBroker;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredString(value, label, code) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) fail(code, `${label} is required.`);
  return text;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function sameSnapshot(receipt, snapshot) {
  return receipt?.state_revision === snapshot?.revision
    && receipt?.world_state_hash === snapshot?.state_hash;
}

function preparationSurface(receipt, reused) {
  return {
    ok: true,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_handle: receipt.prepared_turn_handle,
    world_simulation_session_id: receipt.world_simulation_session_id,
    lifecycle_status: receipt.lifecycle_status,
    decision_round_kind: receipt.decision_round_kind ?? null,
    decision_count: receipt.decision_count,
    submitted_decision_count: receipt.submitted_decision_count,
    deliberation_submission_count:
      receipt.deliberation_submission_count ?? 0,
    ready_to_resolve: receipt.ready_to_resolve,
    reused_existing_prepared_turn: reused === true,
    current_decision: receipt.current_decision,
    boundaries: {
      full_prepared_turn_exposed: false,
      world_state_exposed: false,
      raw_world_event_exposed: false,
      all_character_packets_exposed_together: false,
      one_active_prepared_turn_per_world_session: true,
      decision_order_server_enforced: true,
      phase79m_impasse_deliberation_rounds_supported: true,
      impasse_deliberation_and_action_submission_separated: true,
      same_snapshot_impasse_repreparation_enforced: true,
      caller_authors_candidate_action: false,
      caller_decides_causal_outcome: false,
      caller_decides_commit_gate: false,
      missing_memory_retrieval_resolver_means_no_process: true,
      formal_transport_accepts_runtime_callbacks: false,
      mcp_public_adoption_installed: false,
    },
  };
}

function resolutionSurface(receipt, result) {
  return {
    ok: result?.ok === true,
    committed: result?.committed === true,
    blocked: result?.committed !== true,
    blocked_reason: result?.blocked_reason ?? null,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_handle: receipt.prepared_turn_handle,
    world_simulation_session_id: receipt.world_simulation_session_id,
    lifecycle_status: receipt.lifecycle_status,
    revision: result?.revision ?? null,
    previous_state_hash: result?.previous_state_hash ?? null,
    next_state_hash: result?.next_state_hash ?? null,
    boundaries: {
      next_world_state_exposed: false,
      causal_resolution_exposed: false,
      next_event_exposed: false,
      consistency_internal_details_exposed: false,
      one_shot_resolution: true,
      programmatic_causal_adjudicator_exclusive: true,
      programmatic_consistency_gate_exclusive: true,
    },
  };
}

async function assertReceiptFresh(receipt, options) {
  const snapshot = await getWorldSimulationState(
    receipt.world_simulation_session_id,
    formalLoopOptions(options),
  );
  if (!sameSnapshot(receipt, snapshot)) {
    const broker = preparedTurnBroker(options);
    await broker.invalidate({
      prepared_turn_handle: receipt.prepared_turn_handle,
      reason: "persisted_world_state_changed",
    });
    fail(
      "WORLD_SIMULATION_FORMAL_PREPARED_TURN_STALE",
      "Prepared world turn no longer matches the persisted world-state revision/hash.",
    );
  }
  return snapshot;
}

async function buildFormalActionDecisionBundle(prepared, sessionId, loopOptions) {
  const worldHistory = await getWorldSimulationHistory(sessionId, loopOptions);
  const decisionInputs = [];
  const counterfactualReflectionReentryProjections = [];
  const counterfactualLinkedExperienceReentryProjections = [];
  const counterfactualPreparativeRevalidationResolverViews = [];
  const counterfactualPreparativeRevalidationProjections = [];
  for (const packet of prepared.decision_packets) {
    const effectiveCommitment = projectWorldSimulationEffectiveActionCommitment({
      world_history: worldHistory,
      world_simulation_session_id: sessionId,
      character: packet.character,
    });
    const commitmentExposure =
      buildWorldSimulationEffectiveActionCommitmentCharacterExposure(
        effectiveCommitment,
      );
    const executionFeedback =
      projectWorldSimulationActionCommitmentExecutionFeedback({
        effective_action_commitment_projection: effectiveCommitment,
        world_history: worldHistory,
      });
    const subjectiveExecutionExperience =
      projectWorldSimulationActionCommitmentSubjectiveExecutionExperience({
        execution_feedback_projection: executionFeedback,
        world_history: worldHistory,
      });
    const characterInput = buildWorldSimulationCharacterBrainInput(packet, {
      effective_action_commitment_character_exposure: commitmentExposure,
      action_commitment_subjective_execution_experience:
        subjectiveExecutionExperience,
    });

    // Phase81I re-enters only prior committed Phase81H linked-experience cases
    // that share exact canonical Phase74A action-candidate cues with this final
    // formal Character Brain input. The full projection stays engine-side and
    // performs no usefulness, preference, or action-selection interpretation.
    const linkedExperienceReentry =
      projectWorldSimulationCounterfactualLinkedExperienceReentry({
        world_simulation_session_id: sessionId,
        character: characterInput.character,
        current_turn_id: prepared.turn_id,
        current_state_revision: prepared.state_revision,
        current_world_state_hash: prepared.world_state_hash,
        current_cognition: characterInput.cognition,
        current_candidate_action_intents: characterInput.candidate_action_intents,
        source_phase74a_deliberation: characterInput.subjective_action_deliberation,
        world_history: worldHistory,
      });
    counterfactualLinkedExperienceReentryProjections.push(
      cloneJson(linkedExperienceReentry),
    );

    // Phase81D-R1 is derived from the final formal Character Brain input after
    // Phase75 overlays have been applied and Phase74A has been rebuilt. This
    // preserves the exact-current-deliberation lineage instead of validating a
    // weaker pre-overlay Phase74A hash. Only the sanitized reminder DTO crosses
    // the character boundary; the full projection stays with trusted transport.
    const adoption = adoptWorldSimulationCounterfactualReflectionReentry({
      world_simulation_session_id: sessionId,
      current_turn_id: prepared.turn_id,
      current_state_revision: prepared.state_revision,
      current_world_state_hash: prepared.world_state_hash,
      world_history: worldHistory,
      character_input: characterInput,
    });
    counterfactualReflectionReentryProjections.push(cloneJson(adoption.projection));
    characterInput.counterfactual_reflection_reentry = cloneJson(adoption.character_view);
    characterInput.boundaries.counterfactual_reflection_reentry_native_adoption_installed = true;
    characterInput.boundaries.counterfactual_reflection_reentry_engine_lineage_exposed = false;
    characterInput.boundaries.counterfactual_reflection_reentry_advisory_only = true;

    // Phase81E sits strictly after Phase81D reminder construction and before
    // action selection. The resolver receives only the bounded reminder-derived
    // current-context applicability surface; it may return refs-only relevance
    // judgments and can never choose or prefer an action.
    const preparativeResolverView =
      buildWorldSimulationCounterfactualPreparativeRevalidationResolverView({
        source_phase81d_projection: adoption.projection,
      });
    counterfactualPreparativeRevalidationResolverViews.push(
      cloneJson(preparativeResolverView),
    );
    const preparativeResolver =
      typeof loopOptions.counterfactualPreparativeRevalidationResolver === "function"
        ? loopOptions.counterfactualPreparativeRevalidationResolver
        : null;
    const rawPreparativeDecisions = preparativeResolver
      && preparativeResolverView.preparative_revalidation_candidates.length > 0
      ? await preparativeResolver(cloneJson(preparativeResolverView))
      : [];
    if (!Array.isArray(rawPreparativeDecisions)) {
      fail(
        "WORLD_SIMULATION_COUNTERFACTUAL_PREPARATIVE_REVALIDATION_RESOLVER_INVALID_OUTPUT",
        "counterfactualPreparativeRevalidationResolver must return an array of bounded Phase81E decisions.",
      );
    }
    const preparativeProjection =
      projectWorldSimulationCounterfactualPreparativeRevalidation({
        source_phase81d_projection: adoption.projection,
        resolver_view: preparativeResolverView,
        preparative_revalidation_decisions: rawPreparativeDecisions,
      });
    counterfactualPreparativeRevalidationProjections.push(
      cloneJson(preparativeProjection),
    );
    characterInput.counterfactual_preparative_revalidation = cloneJson(
      preparativeProjection.character_view,
    );
    characterInput.boundaries.counterfactual_preparative_revalidation_installed = true;
    characterInput.boundaries.counterfactual_preparative_revalidation_advisory_only = true;
    characterInput.boundaries.counterfactual_preparative_revalidation_action_authority = false;
    characterInput.boundaries.counterfactual_preparative_revalidation_world_truth_authority = false;

    decisionInputs.push({
      decision_kind: worldSimulationFormalImpasseDecisionKinds.ACTION,
      character_input: characterInput,
    });
  }
  return {
    decision_inputs: decisionInputs,
    counterfactual_reflection_reentry_projections:
      counterfactualReflectionReentryProjections,
    counterfactual_linked_experience_reentry_projections:
      counterfactualLinkedExperienceReentryProjections,
    counterfactual_preparative_revalidation_resolver_views:
      counterfactualPreparativeRevalidationResolverViews,
    counterfactual_preparative_revalidation_projections:
      counterfactualPreparativeRevalidationProjections,
  };
}

async function prepareFormalDecisionRound(
  sessionId,
  options,
  priorSubmissions = [],
) {
  const loopOptions = formalReplayLoopOptions(options, priorSubmissions);
  const prepared = await prepareWorldSimulationTurn(
    { world_simulation_session_id: sessionId },
    loopOptions,
  );
  const impasseRound = buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: prepared,
    prior_submissions: priorSubmissions,
  });
  if (impasseRound) {
    return {
      prepared,
      decision_round_kind: impasseRound.decision_round_kind,
      decision_inputs: impasseRound.decision_inputs,
    };
  }
  const actionBundle = await buildFormalActionDecisionBundle(
    prepared,
    sessionId,
    loopOptions,
  );
  const preparedWithPreActionDeliberation = {
    ...prepared,
    counterfactual_reflection_reentry_projections:
      cloneJson(actionBundle.counterfactual_reflection_reentry_projections),
    counterfactual_linked_experience_reentry_projections:
      cloneJson(actionBundle.counterfactual_linked_experience_reentry_projections),
    counterfactual_preparative_revalidation_resolver_views:
      cloneJson(actionBundle.counterfactual_preparative_revalidation_resolver_views),
    counterfactual_preparative_revalidation_projections:
      cloneJson(actionBundle.counterfactual_preparative_revalidation_projections),
  };
  const preparativeRound = buildWorldSimulationFormalImpasseDeliberationRound({
    prepared_turn: preparedWithPreActionDeliberation,
    prior_submissions: priorSubmissions,
  });
  if (preparativeRound) {
    return {
      prepared: preparedWithPreActionDeliberation,
      decision_round_kind: preparativeRound.decision_round_kind,
      decision_inputs: preparativeRound.decision_inputs,
    };
  }
  return {
    prepared: preparedWithPreActionDeliberation,
    decision_round_kind: worldSimulationFormalImpasseDecisionKinds.ACTION,
    decision_inputs: actionBundle.decision_inputs,
  };
}

export function buildWorldSimulationFormalTurnTransportContract() {
  return {
    version: worldSimulationFormalTurnTransportVersion,
    prepared_turn_broker_version: worldSimulationPreparedTurnBrokerVersion,
    character_brain_input_version: worldSimulationCharacterBrainInputVersion,
    formal_impasse_deliberation:
      buildWorldSimulationFormalImpasseDeliberationContract(),
    phase: "Phase62A-R1 Step 4B-1 + Phase79M",
    bootstrap: {
      initial_world_state_supported_at_session_begin: true,
      repeated_world_state_initialization_allowed: false,
      automatic_canon_hydration_installed: false,
    },
    lifecycle: {
      one_active_prepared_turn_per_world_session: true,
      repeated_prepare_same_snapshot_reuses_handle: true,
      concurrent_prepare_uses_parent_reservation: true,
      decision_submission_sequential: true,
      one_shot_resolution: true,
      parent_restart_invalidates_ephemeral_payload: true,
      arbitrary_ttl_required_for_security: false,
    },
    character_boundary: {
      single_character_packet_surface: true,
      raw_world_event_exposed: false,
      engine_session_or_turn_identity_inside_character_input: false,
      legacy_retrieved_memories_alias_in_formal_surface: false,
      model_context_isolation_claimed: false,
    },
    authority: {
      caller_may_submit_action_id_only: true,
      caller_may_submit_bounded_impasse_preference_revisions: true,
      caller_may_submit_bounded_counterfactual_preparative_revalidation: true,
      impasse_preference_submission_requires_current_decision_handle: true,
      impasse_preference_submission_replayed_by_server_owned_closure_only: true,
      action_selection_may_not_supply_impasse_preference: true,
      caller_may_submit_action_object: false,
      caller_may_submit_selected_actions_map: false,
      caller_may_submit_next_world_state: false,
      caller_may_submit_causal_resolution: false,
      caller_may_submit_hard_conflict_count: false,
      custom_causal_adjudicator_forwarded: false,
      custom_memory_retrieval_resolver_forwarded: false,
    },
    mcp_public_adoption_installed: false,
    http_parent_broker_adoption_installed: false,
  };
}

export async function beginFormalWorldSimulationSession(input = {}, options = {}) {
  const session = await beginWorldSimulationSession(
    input,
    formalLoopOptions(options),
  );
  return {
    ...session,
    formal_turn_transport_version: worldSimulationFormalTurnTransportVersion,
    formal_turn_transport_core_installed: true,
    mcp_public_adoption_installed: false,
  };
}

export async function prepareFormalWorldSimulationTurn(input = {}, options = {}) {
  const sessionId = requiredString(
    input.world_simulation_session_id,
    "world_simulation_session_id",
    "WORLD_SIMULATION_FORMAL_SESSION_REQUIRED",
  );
  const loopOptions = formalLoopOptions(options);
  await assertWorldSimulationSession(sessionId, loopOptions);
  const snapshot = await getWorldSimulationState(sessionId, loopOptions);
  const broker = preparedTurnBroker(options);
  const active = await broker.getActiveReceipt({
    world_simulation_session_id: sessionId,
  });

  if (active) {
    if (sameSnapshot(active, snapshot)) {
      if (active.lifecycle_status === "preparing") {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_PREPARATION_IN_PROGRESS",
          "The active world turn is already being prepared by another transport owner.",
        );
      }
      if (active.lifecycle_status === "taken_for_resolution") {
        fail(
          "WORLD_SIMULATION_PREPARED_TURN_RESOLUTION_IN_PROGRESS",
          "The active prepared world turn is already being resolved.",
        );
      }
      return preparationSurface(active, true);
    }
    await broker.invalidate({
      prepared_turn_handle: active.prepared_turn_handle,
      reason: "persisted_world_state_changed_before_prepare",
    });
  }

  const reservation = await broker.reservePreparation({
    world_simulation_session_id: sessionId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    preparer_owner_id: formalResolverOwnerId,
  });

  if (reservation.acquired !== true) {
    const competing = reservation.receipt;
    if (sameSnapshot(competing, snapshot)
      && competing.lifecycle_status !== "preparing"
      && competing.lifecycle_status !== "taken_for_resolution") {
      return preparationSurface(competing, true);
    }
    fail(
      "WORLD_SIMULATION_PREPARED_TURN_PREPARATION_IN_PROGRESS",
      "Another transport owner acquired the preparation reservation first.",
    );
  }

  try {
    const decisionRound = await prepareFormalDecisionRound(
      sessionId,
      options,
      [],
    );

    const receipt = await broker.storePrepared({
      prepared_turn_handle: reservation.receipt.prepared_turn_handle,
      preparer_owner_id: formalResolverOwnerId,
      prepared_turn: decisionRound.prepared,
      decision_inputs: decisionRound.decision_inputs,
      decision_round_kind: decisionRound.decision_round_kind,
    });

    return preparationSurface(receipt, false);
  } catch (error) {
    try {
      await broker.abortPreparation({
        prepared_turn_handle: reservation.receipt.prepared_turn_handle,
        preparer_owner_id: formalResolverOwnerId,
        reason: error?.code ?? "formal_preparation_failed",
      });
    } catch {}
    throw error;
  }
}

export async function submitFormalWorldSimulationCharacterDeliberation(
  input = {},
  options = {},
) {
  const handle = requiredString(
    input.prepared_turn_handle,
    "prepared_turn_handle",
    "WORLD_SIMULATION_FORMAL_PREPARED_TURN_HANDLE_REQUIRED",
  );
  const broker = preparedTurnBroker(options);
  const before = await broker.getReceipt({
    prepared_turn_handle: handle,
  });
  await assertReceiptFresh(before, options);

  const decisionHandle = requiredString(
    input.decision_handle,
    "decision_handle",
    "WORLD_SIMULATION_FORMAL_DECISION_HANDLE_REQUIRED",
  );
  if (!input.deliberation_response
      || typeof input.deliberation_response !== "object"
      || Array.isArray(input.deliberation_response)) {
    fail(
      "WORLD_SIMULATION_FORMAL_EXPERIENTIAL_DELIBERATION_DECISION_INVALID",
      "deliberation_response must be one stage-specific bounded response object.",
    );
  }

  const submitted = await broker.submitDeliberation({
    prepared_turn_handle: handle,
    decision_handle: decisionHandle,
    deliberation_response: input.deliberation_response,
    preparer_owner_id: formalResolverOwnerId,
  });

  if (submitted.repreparation_required !== true) {
    return preparationSurface(submitted.receipt, false);
  }

  try {
    const decisionRound = await prepareFormalDecisionRound(
      before.world_simulation_session_id,
      options,
      submitted.deliberation_submissions,
    );
    const receipt = await broker.storePrepared({
      prepared_turn_handle: handle,
      preparer_owner_id: formalResolverOwnerId,
      prepared_turn: decisionRound.prepared,
      decision_inputs: decisionRound.decision_inputs,
      decision_round_kind: decisionRound.decision_round_kind,
    });
    return preparationSurface(receipt, false);
  } catch (error) {
    try {
      await broker.abortPreparation({
        prepared_turn_handle: handle,
        preparer_owner_id: formalResolverOwnerId,
        reason: error?.code ?? "formal_impasse_repreparation_failed",
      });
    } catch {}
    throw error;
  }
}

export async function submitFormalWorldSimulationCharacterAction(
  input = {},
  options = {},
) {
  const handle = requiredString(
    input.prepared_turn_handle,
    "prepared_turn_handle",
    "WORLD_SIMULATION_FORMAL_PREPARED_TURN_HANDLE_REQUIRED",
  );
  const broker = preparedTurnBroker(options);
  const before = await broker.getReceipt({
    prepared_turn_handle: handle,
  });
  await assertReceiptFresh(before, options);

  const decisionHandle = requiredString(
    input.decision_handle,
    "decision_handle",
    "WORLD_SIMULATION_FORMAL_DECISION_HANDLE_REQUIRED",
  );

  const hasActionId = typeof input.action_id === "string"
    && input.action_id.trim().length > 0;
  const rejectAll = input.reject_all === true;
  if (hasActionId === rejectAll) {
    fail(
      "WORLD_SIMULATION_FORMAL_DECISION_SELECTION_INVALID",
      "Submit exactly one of action_id or reject_all=true.",
    );
  }

  const receipt = await broker.submitDecision({
    prepared_turn_handle: handle,
    decision_handle: decisionHandle,
    ...(rejectAll
      ? { reject_all: true }
      : { action_id: input.action_id.trim() }),
  });

  return preparationSurface(receipt, false);
}

export async function resolveFormalWorldSimulationTurn(input = {}, options = {}) {
  const handle = requiredString(
    input.prepared_turn_handle,
    "prepared_turn_handle",
    "WORLD_SIMULATION_FORMAL_PREPARED_TURN_HANDLE_REQUIRED",
  );
  const broker = preparedTurnBroker(options);
  const acquisition = await broker.takeForResolution({
    prepared_turn_handle: handle,
    resolver_owner_id: formalResolverOwnerId,
  });

  try {
    const loopOptions = formalLoopOptions(options);
    // The final ACTION round already contains the same-snapshot Phase81D/81E
    // projections that shaped the Character Brain surface. Resolve consumes
    // those exact ephemeral projections rather than recomputing cognition after
    // action submission.
    const result = await resolveWorldSimulationTurn(
      acquisition.prepared_turn,
      acquisition.selected_actions,
      {
        ...loopOptions,
        counterfactualReflectionReentryProjections:
          acquisition.prepared_turn.counterfactual_reflection_reentry_projections ?? [],
        counterfactualLinkedExperienceReentryProjections:
          acquisition.prepared_turn.counterfactual_linked_experience_reentry_projections ?? [],
        counterfactualPreparativeRevalidationProjections:
          acquisition.prepared_turn.counterfactual_preparative_revalidation_projections ?? [],
      },
    );
    const receipt = await broker.completeResolution({
      prepared_turn_handle: handle,
      resolution_token: acquisition.resolution_token,
      resolver_owner_id: formalResolverOwnerId,
      result_status: result?.committed === true
        ? "committed"
        : "blocked",
    });
    return resolutionSurface(receipt, result);
  } catch (error) {
    try {
      await broker.abortResolution({
        prepared_turn_handle: handle,
        resolution_token: acquisition.resolution_token,
        resolver_owner_id: formalResolverOwnerId,
        reason: error?.code ?? "formal_resolution_failed",
      });
    } catch {
      // The original native-loop failure remains authoritative.
    }
    throw error;
  }
}
