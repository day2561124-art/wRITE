import { getWorldSimulationState } from "./world-simulation-state-service.mjs";
import { runWorldSimulationTurn } from "./world-simulation-loop-service.mjs";
import {
  projectWorldSimulationOffscreenBreakpoint,
} from "./world-simulation-offscreen-breakpoint-service.mjs";

export const worldSimulationOffscreenEventBatchVersion =
  "cb-c6e3-offscreen-event-batch-v3";

function reject(message, code = "C6E_OFFSCREEN_BATCH_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * Preserve canonical per-event fidelity within a turn budget and optional
 * exact World-time ceiling. A whole turn crossing the ceiling remains pending.
 * Empty queues do not authorize time jumps, slow physiology or synthetic cognition.
 * This report is engine-private execution evidence, never a character packet.
 */
export async function runWorldSimulationOffscreenEventBatch(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key =>
        !["world_simulation_session_id", "max_turns", "target_horizon"].includes(key)))
    reject("Offscreen batches accept a session, explicit turn budget and optional target horizon.");
  const sessionId = input.world_simulation_session_id;
  const budget = input.max_turns;
  if (typeof sessionId !== "string" || !sessionId.trim()
      || !Number.isInteger(budget) || budget < 0 || budget > 32)
    reject("Offscreen event batch requires a session and an integer budget from 0 to 32.");
  if (options.causalAdjudicator !== undefined)
    reject("Offscreen event batches require the canonical World causal adjudicator.");

  if (options.worldSimulationTimeCeiling !== undefined)
    reject("The batch owns its Native time ceiling; supply target_horizon in input.");
  const target = input.target_horizon ?? null;
  if (Object.hasOwn(input, "target_horizon")
      && (typeof target !== "string" || !Number.isFinite(Date.parse(target))
        || new Date(Date.parse(target)).toISOString() !== target))
    reject("Target horizon must be an exact canonical ISO World timestamp.");
  const turnOptions = target === null ? options
    : { ...options, worldSimulationTimeCeiling: target };

  let snapshot = await getWorldSimulationState(sessionId, options);
  const initial = snapshot;
  if (!Number.isFinite(Date.parse(snapshot.state?.simulation_time)))
    reject("Offscreen event batches require committed World simulation time.");
  if (target !== null && Date.parse(target) < Date.parse(snapshot.state.simulation_time))
    reject("Target horizon may not precede committed World time.");
  const completed = [];
  let attempts = 0;
  let stateReadVerified = true;
  let pendingBreakpoint = null;
  let pendingUnresolvedProcesses = [];
  const report = (status, blockedReason = null) => {
    const confirmed = stateReadVerified
      && snapshot.revision === initial.revision + completed.length
      && snapshot.state_hash === (completed.at(-1)?.next_state_hash ?? initial.state_hash)
      && Number.isFinite(Date.parse(snapshot.state.simulation_time));
    return {
      version: worldSimulationOffscreenEventBatchVersion,
      world_simulation_session_id: sessionId,
      status,
      blocked_reason: blockedReason,
      max_turns: budget,
      attempted_turn_count: attempts,
      committed_turn_count: completed.length,
      committed_turns: completed.map(item => ({ ...item })),
      initial_revision: initial.revision,
      initial_state_hash: initial.state_hash,
      last_observed_revision: snapshot.revision,
      last_observed_state_hash: snapshot.state_hash,
      last_observed_simulation_time: snapshot.state.simulation_time,
      state_reconciliation_required: !confirmed,
      reached_simulation_time: confirmed ? snapshot.state.simulation_time : null,
      pending_event_id: confirmed ? (snapshot.state.event_queue?.[0]?.event_id
        ?? snapshot.state.event_queue?.[0]?.id ?? null) : null,
      pending_event_count: confirmed ? (snapshot.state.event_queue?.length ?? 0) : null,
      pending_breakpoint: confirmed && pendingBreakpoint
        ? { ...pendingBreakpoint } : null,
      pending_breakpoint_confirmed: confirmed && pendingBreakpoint !== null
        && pendingUnresolvedProcesses.length === 0,
      unresolved_process_count: confirmed ? pendingUnresolvedProcesses.length : null,
      unresolved_processes: confirmed ? pendingUnresolvedProcesses.map(item => ({ ...item })) : null,
      requested_target_horizon: target,
      target_horizon_claimed: confirmed && target !== null
        && Date.parse(snapshot.state.simulation_time) === Date.parse(target),
      canonical_turn_fidelity_preserved: true,
      wall_clock_catch_up_used: false,
      automatic_replay_allowed: false,
    };
  };

  const reportIdle = (emptyStatus = "no_pending_event") => {
    const discovery = projectWorldSimulationOffscreenBreakpoint({
      world_state: snapshot.state, target_horizon: target,
    });
    pendingBreakpoint = discovery.breakpoint;
    pendingUnresolvedProcesses = discovery.unresolved_processes;
    if (pendingUnresolvedProcesses.length)
      return report("slow_process_authority_unresolved",
        "offscreen_slow_process_authority_unresolved");
    return pendingBreakpoint
      ? report("slow_process_breakpoint_pending", "offscreen_slow_process_breakpoint_pending")
      : report(emptyStatus);
  };

  try {
    while (attempts < budget) {
      if (target !== null && Date.parse(snapshot.state.simulation_time) === Date.parse(target))
        return snapshot.state.event_queue?.length
          ? report("target_horizon_reached") : reportIdle("target_horizon_reached");
      const event = snapshot.state.event_queue?.[0];
      if (!event) return reportIdle();
      pendingBreakpoint = null;
      pendingUnresolvedProcesses = [];
      const eventId = event.event_id ?? event.id;
      if (typeof eventId !== "string" || !eventId.trim())
        reject("Offscreen execution requires the canonical queue head identity.");
      attempts += 1;
      const result = await runWorldSimulationTurn({
        world_simulation_session_id: sessionId, event_id: eventId,
      }, turnOptions);
      if (result.committed !== true) {
        stateReadVerified = false;
        snapshot = await getWorldSimulationState(sessionId, options);
        stateReadVerified = true;
        return report("blocked", result.blocked_reason ?? "canonical_turn_not_committed");
      }
      // Record the actual commit before a post-commit read can fail. Recovery
      // must inspect this turn, not repeat an already committed mutation.
      completed.push({
        event_id: eventId, turn_id: result.turn_id,
        previous_state_hash: result.previous_state_hash,
        next_state_hash: result.next_state_hash,
      });
      stateReadVerified = false;
      const next = await getWorldSimulationState(sessionId, options);
      stateReadVerified = true;
      if (next.revision !== snapshot.revision + 1
          || next.state_hash !== result.next_state_hash
          || result.previous_state_hash !== snapshot.state_hash)
        reject("Offscreen batch lost its exact committed World lineage.",
          "C6E_OFFSCREEN_BATCH_STATE_CHANGED");
      if (!Number.isFinite(Date.parse(next.state.simulation_time))
          || Date.parse(next.state.simulation_time) < Date.parse(snapshot.state.simulation_time))
        reject("Offscreen batch observed backward World time.",
          "C6E_OFFSCREEN_BATCH_STATE_CHANGED");
      snapshot = next;
    }
    if (target !== null && Date.parse(snapshot.state.simulation_time) === Date.parse(target))
      return snapshot.state.event_queue?.length
          ? report("target_horizon_reached") : reportIdle("target_horizon_reached");
    if (snapshot.state.event_queue?.length) return report("budget_exhausted");
    return reportIdle();
  } catch (error) {
    // A canonical turn may fail because another writer already changed World.
    // The old queue head must not be reported as safe to retry. A failed read
    // likewise leaves the reached horizon and pending work unconfirmed.
    stateReadVerified = false;
    try {
      snapshot = await getWorldSimulationState(sessionId, options);
      stateReadVerified = true;
    } catch {
      // Preserve the original failure and the last observed state identity.
    }
    error.offscreen_batch_progress = report("failed", error.code ?? "canonical_turn_failed");
    throw error;
  }
}
