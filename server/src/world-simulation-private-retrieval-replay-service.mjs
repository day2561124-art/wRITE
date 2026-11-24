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

// Shared checkpoint cursor for direct V3 execution and engine-private World
// preparation. Only the engine supplies run and bindingForStage.
async function replayStages({ transcript, run, bindingForStage }) {
  requireReplay(Array.isArray(transcript) && transcript.length <= MAX_ENTRIES,
    "Invalid or oversized retrieval transcript.");
  const prefix = clone(transcript);
  let consumed = 0;
  let pending = null;
  const suspend = new Error("Private retrieval response pending.");
  try {
    const result = await run(async (stageInput) => {
      const stage = stageInput.stage;
      const queryId = stage === "initiation" ? stageInput.query?.query_id : stageInput.query_id;
      const step = stage === "initiation" ? null : stageInput.process?.step_index;
      const binding = bindingForStage(stageInput, queryId);
      requireReplay(stages.has(stage) && stageInput.character === binding.observer
        && queryId === binding.query_id && (stage === "initiation"
          ? step === null : Number.isSafeInteger(step) && step >= 0),
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
      return clone(entry.response);
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

export async function replayPrivateRetrievalStages({ scope, kernel_input, transcript = [] } = {}) {
  requireReplay(object(kernel_input), "Missing retrieval kernel input.");
  const input = clone(kernel_input);
  const binding = scopeIdentity(scope, input.query);
  let initiated = false;
  return replayStages({
    transcript,
    run: (resolver) => executeWorldSimulationMemoryRetrievalProcessV3({ ...input, resolver }),
    bindingForStage: (stageInput) => {
      if (stageInput.stage === "initiation") {
        requireReplay(!initiated, "Repeated retrieval initiation.");
        initiated = true;
      } else {
        requireReplay(initiated, "Missing retrieval initiation.");
      }
      return binding;
    },
  });
}

// The real World loop may prepare several observers. Each initiation carries
// the kernel's query view; keep its identity separately while preserving the
// global order of the actual engine callbacks. This is not a public resolver.
export async function replayPrivateWorldPreparationStages({ scope, transcript = [], prepare } = {}) {
  requireReplay(typeof prepare === "function", "Missing engine-owned preparation function.");
  let activeBinding = null;
  const seenQueries = new Set();
  return replayStages({
    transcript,
    run: prepare,
    bindingForStage: (stageInput, queryId) => {
      if (stageInput.stage === "initiation") {
        requireReplay(!seenQueries.has(queryId), "Repeated World retrieval query.");
        activeBinding = {
          ...scopeIdentity(scope, stageInput.query),
          query_hash_basis: "world_kernel_initiation_view",
        };
        seenQueries.add(queryId);
      }
      requireReplay(activeBinding !== null, "Missing World retrieval initiation.");
      return activeBinding;
    },
  });
}
