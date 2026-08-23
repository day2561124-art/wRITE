import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  agentRunPaths,
  getAgentRun,
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertNeuralSessionRunShape,
  neuralSessionModes,
} from "./shared-neural-core-service.mjs";

export const worldSimulationStateVersion = "phase62c-world-state-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function fixtureTransactionMetadata(options = {}) {
  return options.fixtureRoot
    ? {
      test_transaction_dir: path.join(
        options.fixtureRoot,
        "data",
        "outputs",
        "logs",
        "transactions",
      ),
    }
    : {};
}

export function worldSimulationStatePaths(sessionId, options = {}) {
  const directory = agentRunPaths(sessionId, options).directory;
  return {
    state: path.join(directory, "world_state.json"),
    history: path.join(directory, "world_history.json"),
  };
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const missing = new Error(`${label} is not initialized.`);
      missing.code = "WORLD_SIMULATION_STATE_NOT_INITIALIZED";
      throw missing;
    }
    throw error;
  }
}

async function readOptionalJson(filePath) {
  try {
    return { exists: true, value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, value: null };
    throw error;
  }
}

async function assertWorldSimulationRun(sessionId, options = {}) {
  const run = await getAgentRun(sessionId, options);
  assertNeuralSessionRunShape(run, neuralSessionModes.WORLD_SIMULATION);
  return run;
}

function stateEnvelope(sessionId, state, revision, metadata = {}) {
  const clonedState = cloneJson(requireObject(state, "world state"));
  return {
    version: worldSimulationStateVersion,
    world_simulation_session_id: sessionId,
    revision,
    state_hash: hashAgentRunValue(clonedState),
    state: clonedState,
    ...metadata,
  };
}

export async function initializeWorldSimulationState(
  sessionId,
  initialWorldState,
  options = {},
) {
  await assertWorldSimulationRun(sessionId, options);
  const now = new Date().toISOString();
  const envelope = stateEnvelope(sessionId, initialWorldState, 0, {
    initialized_at: now,
    updated_at: now,
    last_turn_id: null,
  });
  const history = {
    version: worldSimulationStateVersion,
    world_simulation_session_id: sessionId,
    turns: [],
  };
  const paths = worldSimulationStatePaths(sessionId, options);
  await commitFileTransaction(
    "world-simulation-state-initialize",
    [
      {
        type: "write",
        filePath: paths.state,
        contentFactory: async () => {
          const [existingState, existingHistory] = await Promise.all([
            readOptionalJson(paths.state),
            readOptionalJson(paths.history),
          ]);
          if (existingState.exists || existingHistory.exists) {
            const already = new Error(
              `World simulation state is already initialized for ${sessionId}.`,
            );
            already.code = "WORLD_SIMULATION_STATE_ALREADY_INITIALIZED";
            throw already;
          }
          return `${JSON.stringify(envelope, null, 2)}\n`;
        },
      },
      {
        type: "write",
        filePath: paths.history,
        content: `${JSON.stringify(history, null, 2)}\n`,
      },
    ],
    {
      world_simulation_session_id: sessionId,
      action: "initialize-world-state",
      ...fixtureTransactionMetadata(options),
    },
  );
  return cloneJson(envelope);
}

export async function getWorldSimulationState(sessionId, options = {}) {
  await assertWorldSimulationRun(sessionId, options);
  const envelope = await readJson(
    worldSimulationStatePaths(sessionId, options).state,
    "world simulation state",
  );
  if (envelope.world_simulation_session_id !== sessionId) {
    throw new Error("World simulation state lineage does not match the session.");
  }
  return cloneJson(envelope);
}

export async function getWorldSimulationHistory(sessionId, options = {}) {
  await assertWorldSimulationRun(sessionId, options);
  const history = await readJson(
    worldSimulationStatePaths(sessionId, options).history,
    "world simulation history",
  );
  if (history.world_simulation_session_id !== sessionId) {
    throw new Error("World simulation history lineage does not match the session.");
  }
  return cloneJson(history);
}


function arrayTurns(history) {
  return Array.isArray(history?.turns) ? history.turns : [];
}

export async function commitWorldSimulationTurn(
  sessionId,
  input = {},
  options = {},
) {
  await assertWorldSimulationRun(sessionId, options);
  requireObject(input, "world simulation turn commit");
  if (!Number.isSafeInteger(input.expected_revision)) {
    throw new Error("expected_revision is required for a world-state commit.");
  }
  if (typeof input.expected_state_hash !== "string" || !input.expected_state_hash) {
    throw new Error("expected_state_hash is required for a world-state commit.");
  }
  const turnId = String(input.turn_id ?? "").trim();
  if (!turnId) throw new Error("turn_id is required for a world-state commit.");
  const nextWorldState = requireObject(input.next_world_state, "next_world_state");
  const paths = worldSimulationStatePaths(sessionId, options);
  let committedEnvelope = null;
  let committedHistoryEntry = null;

  await commitFileTransaction(
    "world-simulation-turn-commit",
    [
      {
        type: "write",
        filePath: paths.state,
        contentFactory: async () => {
          const current = await readJson(paths.state, "world simulation state");
          if (current.world_simulation_session_id !== sessionId) {
            throw new Error("World simulation state lineage does not match the session.");
          }
          if (current.revision !== input.expected_revision) {
            const stale = new Error(
              `World simulation state revision changed: expected ${input.expected_revision}, current ${current.revision}.`,
            );
            stale.code = "WORLD_SIMULATION_STALE_REVISION";
            throw stale;
          }
          if (current.state_hash !== input.expected_state_hash) {
            const stale = new Error("World simulation state hash changed before commit.");
            stale.code = "WORLD_SIMULATION_STALE_STATE_HASH";
            throw stale;
          }
          const now = new Date().toISOString();
          committedEnvelope = stateEnvelope(
            sessionId,
            nextWorldState,
            current.revision + 1,
            {
              initialized_at: current.initialized_at ?? now,
              updated_at: now,
              last_turn_id: turnId,
              previous_state_hash: current.state_hash,
            },
          );
          return `${JSON.stringify(committedEnvelope, null, 2)}\n`;
        },
      },
      {
        type: "write",
        filePath: paths.history,
        contentFactory: async () => {
          const history = await readJson(paths.history, "world simulation history");
          if (history.world_simulation_session_id !== sessionId) {
            throw new Error("World simulation history lineage does not match the session.");
          }
          if (arrayTurns(history).some((turn) => turn.turn_id === turnId)) {
            const duplicate = new Error(`World simulation turn already committed: ${turnId}`);
            duplicate.code = "WORLD_SIMULATION_DUPLICATE_TURN";
            throw duplicate;
          }
          const now = committedEnvelope?.updated_at ?? new Date().toISOString();
          committedHistoryEntry = cloneJson({
            turn_id: turnId,
            committed_at: now,
            revision_from: input.expected_revision,
            revision_to: committedEnvelope.revision,
            previous_state_hash: input.expected_state_hash,
            next_state_hash: committedEnvelope.state_hash,
            event: input.event ?? null,
            selected_action_intents: input.selected_action_intents ?? [],
            state_transitions: input.state_transitions ?? [],
            action_outcomes: input.action_outcomes ?? [],
            knowledge_transitions: input.knowledge_transitions ?? [],
            scheduled_events: input.scheduled_events ?? [],
            causal_timeline: input.causal_timeline ?? null,
            chronological_mutation_queue: input.chronological_mutation_queue ?? null,
            chronological_mutation_execution: input.chronological_mutation_execution ?? null,
            mutation_proposal_boundary: input.mutation_proposal_boundary ?? null,
            pure_proposal_producers: input.pure_proposal_producers ?? null,
            trace_ids: input.trace_ids ?? [],
            causal_resolution_id: input.causal_resolution_id ?? null,
          });
          const nextHistory = {
            ...history,
            turns: [...arrayTurns(history), committedHistoryEntry],
          };
          return `${JSON.stringify(nextHistory, null, 2)}\n`;
        },
      },
    ],
    {
      world_simulation_session_id: sessionId,
      action: "commit-world-turn",
      turn_id: turnId,
      expected_revision: input.expected_revision,
      ...fixtureTransactionMetadata(options),
    },
  );

  return {
    state: cloneJson(committedEnvelope),
    history_entry: cloneJson(committedHistoryEntry),
  };
}
