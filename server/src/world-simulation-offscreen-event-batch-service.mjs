import { getWorldSimulationState } from "./world-simulation-state-service.mjs";
import { runWorldSimulationTurn } from "./world-simulation-loop-service.mjs";

export const worldSimulationOffscreenEventBatchVersion =
  "cb-c6e1-offscreen-event-batch-v1";

function reject(message, code = "C6E_OFFSCREEN_BATCH_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * E1 preserves canonical per-event fidelity. It bounds the number of Native
 * turns, not elapsed World time. Empty queues do not authorize time jumps,
 * slow physiology, synthetic cognition or a claim of a reached target horizon.
 * This report is engine-private execution evidence, never a character packet.
 */
export async function runWorldSimulationOffscreenEventBatch(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key =>
        !["world_simulation_session_id", "max_turns"].includes(key)))
    reject("E1 accepts only a session identity and an explicit turn budget.");
  const sessionId = input.world_simulation_session_id;
  const budget = input.max_turns;
  if (typeof sessionId !== "string" || !sessionId.trim()
      || !Number.isInteger(budget) || budget < 0 || budget > 32)
    reject("Offscreen event batch requires a session and an integer budget from 0 to 32.");
  if (options.causalAdjudicator !== undefined)
    reject("Offscreen event batches require the canonical World causal adjudicator.");

  let snapshot = await getWorldSimulationState(sessionId, options);
  const initial = snapshot;
  if (!Number.isFinite(Date.parse(snapshot.state?.simulation_time)))
    reject("Offscreen event batches require committed World simulation time.");
  const completed = [];
  let attempts = 0;
  let stateReadVerified = true;
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
      target_horizon_claimed: false,
      canonical_turn_fidelity_preserved: true,
      wall_clock_catch_up_used: false,
      automatic_replay_allowed: false,
      };
  };

  try {
    while (attempts < budget) {
      const event = snapshot.state.event_queue?.[0];
      if (!event) return report("no_pending_event");
      const eventId = event.event_id ?? event.id;
      if (typeof eventId !== "string" || !eventId.trim())
        reject("Offscreen execution requires the canonical queue head identity.");
      attempts += 1;
      const result = await runWorldSimulationTurn({
        world_simulation_session_id: sessionId, event_id: eventId,
      }, options);
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
    return report(snapshot.state.event_queue?.length ? "budget_exhausted" : "no_pending_event");
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
