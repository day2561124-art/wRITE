import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  executeWorldSimulationMemoryRetrievalProcessV3,
} from "./world-simulation-memory-retrieval-multistep-service.mjs";

// Engine-private only. In particular, trusted_stage_input may contain raw
// recovery candidates. Never forward this object to a public decision packet.
const VERSION = "c7-private-retrieval-replay-v1";
const MAX_ENTRIES = 1024;
const stages = new Set(["initiation", "recovery", "cue_construction", "continuation"]);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = hashAgentRunValue;

function requireReplay(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "WORLD_SIMULATION_PRIVATE_RETRIEVAL_REPLAY_MISMATCH";
    throw error;
  }
}

function scopeIdentity(scope, query) {
  requireReplay(object(scope) && nonempty(scope.session_id)
    && Number.isSafeInteger(scope.committed_revision) && scope.committed_revision >= 0
    && nonempty(scope.committed_hash), "Missing committed session frontier.");
  requireReplay(object(query) && nonempty(query.query_id)
    && nonempty(query.character) && nonempty(query.turn_id), "Missing retrieval query identity.");
  return {
    version: VERSION,
    session_id: scope.session_id,
    committed_revision: scope.committed_revision,
    committed_hash: scope.committed_hash,
    observer: query.character,
    turn_id: query.turn_id,
    query_id: query.query_id,
    query_hash: hash(query),
  };
}

// This binds a trusted, engine-owned response to the exact pending request.
// The digest is an integrity check, not authentication or public authorization.
export function bindPrivateRetrievalStageResponse(identity, response) {
  requireReplay(object(identity) && identity.version === VERSION
    && object(response), "Invalid private retrieval response.");
  const snapshot = clone(response);
  return { identity: clone(identity), response: snapshot, response_hash: hash(snapshot) };
}

export async function replayPrivateRetrievalStages({ scope, kernel_input, transcript = [] } = {}) {
  requireReplay(object(kernel_input), "Missing retrieval kernel input.");
  requireReplay(Array.isArray(transcript) && transcript.length <= MAX_ENTRIES,
    "Invalid or oversized retrieval transcript.");
  const input = clone(kernel_input);
  const binding = scopeIdentity(scope, input.query);
  const prefix = clone(transcript);
  let consumed = 0;
  let pending = null;
  const suspend = new Error("Private retrieval response pending.");

  try {
    const result = await executeWorldSimulationMemoryRetrievalProcessV3({
      ...input,
      resolver: async (stageInput) => {
        const stage = stageInput.stage;
        const queryId = stage === "initiation" ? stageInput.query?.query_id : stageInput.query_id;
        const step = stage === "initiation" ? null : stageInput.process?.step_index;
        requireReplay(stages.has(stage) && stageInput.character === binding.observer
          && queryId === binding.query_id && (stage === "initiation"
            ? consumed === 0 : Number.isSafeInteger(step) && step >= 0),
          "Unexpected retrieval stage identity.");
        requireReplay(consumed < MAX_ENTRIES, "Private retrieval replay capacity exceeded.");
        const identity = {
          ...binding,
          sequence: consumed,
          stage,
          step_index: step,
          input_hash: hash(stageInput),
        };
        if (consumed === prefix.length) {
          pending = { identity, trusted_stage_input: clone(stageInput) };
          throw suspend;
        }
        const entry = prefix[consumed];
        requireReplay(object(entry) && object(entry.identity)
          && hash(entry.identity) === hash(identity),
          "Retrieval transcript does not match the current stage.");
        requireReplay(object(entry.response) && hash(entry.response) === entry.response_hash,
          "Retrieval response integrity mismatch.");
        consumed += 1;
        // Phase63C retains all stage response validation and recovery authority.
        return clone(entry.response);
      },
    });
    requireReplay(consumed === prefix.length, "Unused retrieval transcript entries.");
    return { status: "complete", result };
  } catch (error) {
    if (error !== suspend) throw error;
    requireReplay(pending !== null && consumed === prefix.length,
      "Invalid retrieval suspension.");
    return { status: "pending", request: pending };
  }
}
