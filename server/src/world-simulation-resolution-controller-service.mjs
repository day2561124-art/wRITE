import { assertWorldSimulationSession } from "./world-simulation-session-service.mjs";
import { getWorldSimulationState } from "./world-simulation-state-service.mjs";
import {
  runWorldSimulationTurn,
  dispatchWorldSimulationAutonomousCognitionOpportunities,
  runWorldSimulationOffscreenCognitionStep,
} from "./world-simulation-loop-service.mjs";
import { runWorldSimulationOffscreenEventBatch } from "./world-simulation-offscreen-event-batch-service.mjs";

export const worldSimulationResolutionControllerVersion = "cb-c6-resolution-controller-v1";

function reject(message, code = "C6_RESOLUTION_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function assertFields(input, fields) {
  if (!record(input) || Object.keys(input).some(key => !fields.includes(key))) {
    reject("Unexpected host resolution input.");
  }
}
const frontierFields = ["expected_revision", "expected_state_hash"];

/**
 * One host-owned execution policy for one existing World session.
 * Resolution is not a World/Body fact and never enters the Brain packet.
 * The host explicitly recreates/reselects this nonpersistent policy after
 * restart. All actual cognition and consequences still use canonical owners.
 */
export function createWorldSimulationResolutionController(sessionId, options = {}) {
  if (typeof sessionId !== "string" || !sessionId.trim() || !record(options)
      || options.worldSimulationExpectedFrontier !== undefined
      || options.worldSimulationTimeCeiling !== undefined) {
    reject("A resolution controller requires one session and unpinned host options.");
  }
  let mode = "foreground";
  let busy = false;
  const serialize = async operation => {
    if (busy) reject("A resolution operation is already active.", "C6_RESOLUTION_BUSY");
    busy = true;
    try { return await operation(); } finally { busy = false; }
  };
  async function readFrontier(input) {
    if (!Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0
        || typeof input.expected_state_hash !== "string" || !input.expected_state_hash) {
      reject("Resolution operations require an exact committed revision and state hash.");
    }
    await assertWorldSimulationSession(sessionId, options);
    const snapshot = await getWorldSimulationState(sessionId, options);
    if (snapshot.revision !== input.expected_revision || snapshot.state_hash !== input.expected_state_hash) {
      reject("Host resolution lost its exact committed frontier.", "C6_RESOLUTION_FRONTIER_CHANGED");
    }
    if (typeof snapshot.state.simulation_time !== "string"
        || !Number.isFinite(Date.parse(snapshot.state.simulation_time))) {
      reject("Resolution operations require committed World time.");
    }
    return snapshot;
  }
  const receipt = snapshot => ({
    world_simulation_session_id: sessionId,
    state_revision: snapshot.revision,
    world_state_hash: snapshot.state_hash,
    reached_simulation_time: snapshot.state.simulation_time,
  });
  return Object.freeze({
    version: worldSimulationResolutionControllerVersion,
    getMode: () => mode,
    switchResolution(input = {}) {
      return serialize(async () => {
        assertFields(input, [...frontierFields, "mode"]);
        if (!["foreground", "offscreen"].includes(input.mode)) reject("Unknown execution resolution.");
        const snapshot = await readFrontier(input);
        const previous_mode = mode;
        mode = input.mode;
        return Object.freeze({
          ...receipt(snapshot), previous_mode, mode,
          world_mutation_performed: false,
          brain_invoked: false,
          wall_clock_catch_up_used: false,
        });
      });
    },
    runWorldStep(input = {}, callOptions = {}) {
      return serialize(async () => {
        assertFields(input, [...frontierFields, "max_turns", "target_horizon"]);
        const maxTurns = input.max_turns;
        if (!Number.isInteger(maxTurns) || maxTurns < 0 || maxTurns > 32
            || (mode === "foreground" && maxTurns > 1)) {
          reject("World step requires a 0–32 turn budget; foreground admits at most one.");
        }
        const snapshot = await readFrontier(input);
        const target = input.target_horizon;
        if (target !== undefined && (typeof target !== "string"
            || !Number.isFinite(Date.parse(target))
            || new Date(Date.parse(target)).toISOString() !== target
            || Date.parse(target) < Date.parse(snapshot.state.simulation_time))) {
          reject("Target horizon must be canonical and not precede committed World time.");
        }
        const pinned = {
          ...options, ...callOptions,
          // The controller, not a caller, owns storage and execution pins.
          fixtureRoot: options.fixtureRoot,
          worldSimulationExpectedFrontier: { revision: snapshot.revision, state_hash: snapshot.state_hash },
          worldSimulationTimeCeiling: undefined,
        };
        const params = { world_simulation_session_id: sessionId };
        if (mode === "offscreen") {
          const result = await runWorldSimulationOffscreenEventBatch({
            ...params, max_turns: maxTurns,
            ...(target === undefined ? {} : { target_horizon: target }),
          }, pinned);
          return Object.freeze({ mode, execution_path: "bounded_offscreen_world_batch", result });
        }
        // Foreground only owns ordinary queued turns. An empty queue remains
        // pending/no-op, rather than silently manufacturing a new event.
        const event = snapshot.state.event_queue?.[0];
        if (!maxTurns || !event || target === snapshot.state.simulation_time) {
          return Object.freeze({
            mode, execution_path: "foreground_world_turn",
            result: Object.freeze({
              ...receipt(snapshot), committed: false,
              pending_event_id: event?.event_id ?? event?.id ?? null,
              status: !maxTurns ? "budget_exhausted" : !event ? "no_pending_event" : "target_horizon_reached",
            }),
          });
        }
        const result = await runWorldSimulationTurn({
          ...params, event_id: event.event_id ?? event.id,
        }, { ...pinned, worldSimulationTimeCeiling: target });
        const after = await getWorldSimulationState(sessionId, options);
        const expectedRevision = snapshot.revision + (result.committed === true ? 1 : 0);
        const expectedHash = result.committed === true ? result.next_state_hash : snapshot.state_hash;
        if (after.revision !== expectedRevision || after.state_hash !== expectedHash) {
          reject("Foreground result requires state reconciliation.", "C6_RESOLUTION_FRONTIER_CHANGED");
        }
        return Object.freeze({
          mode, execution_path: "foreground_world_turn",
          result: Object.freeze({ ...result, ...receipt(after) }),
        });
      });
    },
    runCognitionStep(input = {}, callOptions = {}) {
      return serialize(async () => {
        assertFields(input, [...frontierFields, "max_opportunities",
          "runtime_context_by_character", "consumed_opportunity_ids"]);
        if (mode === "foreground" && input.max_opportunities !== undefined) {
          reject("Only the offscreen cognition path accepts an opportunity budget.");
        }
        const snapshot = await readFrontier(input);
        const pinned = {
          ...options, ...callOptions, fixtureRoot: options.fixtureRoot,
          worldSimulationExpectedFrontier: { revision: snapshot.revision, state_hash: snapshot.state_hash },
          worldSimulationTimeCeiling: undefined,
        };
        const common = {
          world_simulation_session_id: sessionId,
          runtime_context_by_character: input.runtime_context_by_character,
          consumed_opportunity_ids: input.consumed_opportunity_ids,
        };
        const result = mode === "offscreen"
          ? await runWorldSimulationOffscreenCognitionStep({
              ...common, expected_revision: snapshot.revision, expected_state_hash: snapshot.state_hash,
              max_opportunities: input.max_opportunities,
            }, pinned)
          : await dispatchWorldSimulationAutonomousCognitionOpportunities(common, pinned);
        return Object.freeze({
          mode, execution_path: mode === "offscreen" ? "bounded_offscreen_cognition" : "foreground_cognition",
          result,
        });
      });
    },
  });
}
