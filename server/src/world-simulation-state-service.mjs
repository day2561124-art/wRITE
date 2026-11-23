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
import {
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import {
  assertWorldSimulationNativeTemporalChoiceEvidence,
} from "./world-simulation-native-temporal-replay-service.mjs";
import {
  assertWorldSimulationNativePreparationEvidence,
} from "./world-simulation-native-response-preparation-service.mjs";

import {
  assertWorldSimulationSleepArousalCommitAuthority,
} from "./world-simulation-body-sleep-arousal-service.mjs";

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
  if (!options.fixtureRoot) return {};
  const metadata = {
    test_transaction_dir: path.join(
      options.fixtureRoot,
      "data",
      "outputs",
      "logs",
      "transactions",
    ),
  };
  if (
    process.env.FILE_TRANSACTION_TEST_MODE === "1"
    && Number.isSafeInteger(options.testFailAfterTransactionCommits)
    && options.testFailAfterTransactionCommits > 0
  ) {
    metadata.test_fail_after_commits = options.testFailAfterTransactionCommits;
  }
  return metadata;
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
  // Own the entire commit payload before the first asynchronous boundary.
  // The state and history factories must serialize the same accepted evidence.
  input = cloneJson(requireObject(input, "world simulation turn commit"));
  await assertWorldSimulationRun(sessionId, options);
  if (!Number.isSafeInteger(input.expected_revision)) {
    throw new Error("expected_revision is required for a world-state commit.");
  }
  if (typeof input.expected_state_hash !== "string" || !input.expected_state_hash) {
    throw new Error("expected_state_hash is required for a world-state commit.");
  }
  const turnId = String(input.turn_id ?? "").trim();
  if (!turnId) throw new Error("turn_id is required for a world-state commit.");
  if (input.subjective_choice_commitment_receipts !== undefined
      && input.subjective_choice_commitment_receipts !== null) {
    assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(
      input.subjective_choice_commitment_receipts,
      {
        world_simulation_session_id: sessionId,
        turn_id: turnId,
        state_revision: input.expected_revision,
        world_state_hash: input.expected_state_hash,
      },
    );
  }
  if (input.native_temporal_choice_evidence != null) {
    assertWorldSimulationNativeTemporalChoiceEvidence({
      evidence: input.native_temporal_choice_evidence,
      original_receipts: input.subjective_choice_commitment_receipts,
      selected_action_intents: input.selected_action_intents,
      action_outcomes: input.action_outcomes,
      causal_timeline: input.causal_timeline,
    });
  }
  if (input.native_temporal_preparation_evidence != null
      || input.native_temporal_choice_evidence?.source_preparation_audit_hash
        !== undefined) {
    assertWorldSimulationNativePreparationEvidence({
      evidence: input.native_temporal_preparation_evidence,
      choice_evidence: input.native_temporal_choice_evidence,
      original_receipts: input.subjective_choice_commitment_receipts,
      action_outcomes: input.action_outcomes,
    });
  }
  if (input.autonomous_cognition_goal_commitment != null) {
    const marker = requireObject(input.autonomous_cognition_goal_commitment,
      "autonomous_cognition_goal_commitment");
    if (marker.version !== "cb-c2-eventless-goal-commitment-v1"
        || input.event != null
        || (input.selected_action_intents ?? []).length > 0
        || (input.action_outcomes ?? []).length > 0
        || !Array.isArray(marker.consumed_opportunity_ids)
        || marker.consumed_opportunity_ids.length < 1
        || marker.consumed_opportunity_ids.length > 64
        || marker.consumed_opportunity_ids.some(id =>
          typeof id !== "string" || !/^autonomous_cognition_opportunity_[a-f0-9]{32}$/.test(id))
        || new Set(marker.consumed_opportunity_ids).size !== marker.consumed_opportunity_ids.length
        || !Number.isSafeInteger(marker.goal_event_count)
        || marker.goal_event_count < 1 || marker.goal_event_count > 64) {
      const error = new Error("Eventless cognition metadata requires bounded, source-backed goal-only evidence.");
      error.code = "WORLD_SIMULATION_AUTONOMOUS_GOAL_COMMIT_METADATA_INVALID";
      throw error;
    }
  }
  if (input.autonomous_cognition_plan_commitment != null) {
    const marker = requireObject(input.autonomous_cognition_plan_commitment,
      "autonomous_cognition_plan_commitment");
    if (marker.version !== "cb-c2-eventless-plan-commitment-v1"
        || input.autonomous_cognition_goal_commitment != null
        || input.event != null
        || (input.selected_action_intents ?? []).length > 0
        || (input.action_outcomes ?? []).length > 0
        || !Array.isArray(marker.consumed_opportunity_ids)
        || marker.consumed_opportunity_ids.length < 1
        || marker.consumed_opportunity_ids.length > 64
        || marker.consumed_opportunity_ids.some(id =>
          typeof id !== "string" || !/^autonomous_cognition_opportunity_[a-f0-9]{32}$/.test(id))
        || new Set(marker.consumed_opportunity_ids).size !== marker.consumed_opportunity_ids.length
        || !Number.isSafeInteger(marker.plan_event_count)
        || marker.plan_event_count < 1 || marker.plan_event_count > 64) {
      const error = new Error("Eventless plan metadata requires bounded, prior-committed goal evidence and no selected action.");
      error.code = "WORLD_SIMULATION_AUTONOMOUS_PLAN_COMMIT_METADATA_INVALID";
      throw error;
    }
  }
  if (input.autonomous_actor_initiated_action != null) {
    const meta = requireObject(input.autonomous_actor_initiated_action,
      "autonomous_actor_initiated_action");
    const selections = input.selected_action_intents ?? [];
    const outcomes = input.action_outcomes ?? [];
    if (meta.version !== "world-actor-initiated-speech-v1"
      || input.event != null
      || input.autonomous_cognition_goal_commitment != null
      || input.autonomous_cognition_plan_commitment != null
      || input.autonomous_listener_clarification_reply != null
      || typeof meta.character !== "string" || !meta.character.trim()
      || typeof meta.scene_id !== "string" || !meta.scene_id.trim()
      || typeof meta.action_id !== "string" || !meta.action_id.trim()
      || typeof meta.causal_resolution_id !== "string"
      || !meta.causal_resolution_id.trim()
      || !Array.isArray(meta.consumed_opportunity_ids)
      || meta.consumed_opportunity_ids.length !== 1
      || !/^autonomous_cognition_opportunity_[a-f0-9]{32}$/.test(meta.consumed_opportunity_ids[0])
      || !Array.isArray(selections) || selections.length !== 1
      || selections[0]?.character !== meta.character
      || selections[0]?.selection !== "candidate_action_intent"
      || selections[0]?.action_id !== meta.action_id
      || selections[0]?.candidate?.action_id !== meta.action_id
      || selections[0]?.candidate?.communication?.channel !== "speech"
      || selections[0]?.candidate?.communication?.addressee === meta.character
      || !Array.isArray(outcomes)
      || !outcomes.some(outcome =>
        outcome?.actor === meta.character && outcome?.action_id === meta.action_id)
      || input.causal_resolution_id !== meta.causal_resolution_id) {
      const error = new Error("Actor-initiated eventless speech needs exact World causal evidence.");
      error.code = "WORLD_ACTOR_SPEECH_WORLD_SPEECH_COMMIT_METADATA_INVALID";
      throw error;
    }
  }
  if (input.autonomous_listener_clarification_reply != null) {
    const meta = requireObject(input.autonomous_listener_clarification_reply,
      "autonomous_listener_clarification_reply");
    const selections = input.selected_action_intents ?? [];
    const outcomes = input.action_outcomes ?? [];
    if (meta.version !== "world-listener-clarification-causal-reply-v1"
      || input.event != null
      || input.autonomous_actor_initiated_action != null
      || input.autonomous_cognition_goal_commitment != null
      || input.autonomous_cognition_plan_commitment != null
      || typeof meta.character !== "string" || !meta.character.trim()
      || typeof meta.scene_id !== "string" || !meta.scene_id.trim()
      || typeof meta.action_id !== "string" || !meta.action_id.trim()
      || typeof meta.source_turn_id !== "string" || !meta.source_turn_id.trim()
      || typeof meta.source_turn_hash !== "string" || !meta.source_turn_hash.trim()
      || typeof meta.source_character !== "string" || !meta.source_character.trim()
      || typeof meta.source_action_id !== "string" || !meta.source_action_id.trim()
      || meta.source_character === meta.character
      || typeof meta.observer_increment_ref !== "string" || !meta.observer_increment_ref.trim()
      || !Number.isSafeInteger(meta.source_revision_to)
      || meta.source_revision_to !== input.expected_revision
      || meta.causal_resolution_id !== input.causal_resolution_id
      || !Array.isArray(selections) || selections.length !== 1
      || selections[0]?.character !== meta.character
      || selections[0]?.selection !== "candidate_action_intent"
      || selections[0]?.action_id !== meta.action_id
      || selections[0]?.candidate?.action_id !== meta.action_id
      || selections[0]?.candidate?.communication?.channel !== "speech"
      || selections[0]?.candidate?.communication?.addressee !== meta.source_character
      || !Array.isArray(outcomes)
      || !outcomes.some(item => item?.actor === meta.character
        && item?.action_id === meta.action_id
        && item?.result === "communication_emitted"
        && item?.communication_event?.channel === "speech")) {
      const error = new Error(
        "Listener clarification reply requires a separate exact World speech selection and causal outcome.");
      error.code = "WORLD_LISTENER_REPLY_COMMIT_METADATA_INVALID";
      throw error;
    }
  }
  if (input.autonomous_reply_subjective_memory_encoding != null) {
    const meta = requireObject(input.autonomous_reply_subjective_memory_encoding,
      "autonomous_reply_subjective_memory_encoding");
    if (meta.version !== "world-reply-subjective-dialogue-memory-v1"
      || input.event != null
      || input.autonomous_actor_initiated_action != null
      || input.autonomous_listener_clarification_reply != null
      || input.autonomous_cognition_goal_commitment != null
      || input.autonomous_cognition_plan_commitment != null
      || (input.selected_action_intents ?? []).length !== 0
      || (input.action_outcomes ?? []).length !== 0
      || typeof meta.character !== "string" || !meta.character.trim()
      || typeof meta.scene_id !== "string" || !meta.scene_id.trim()
      || typeof meta.source_turn_id !== "string" || !meta.source_turn_id.trim()
      || typeof meta.source_turn_hash !== "string" || !meta.source_turn_hash.trim()
      || typeof meta.source_character !== "string" || !meta.source_character.trim()
      || typeof meta.source_action_id !== "string" || !meta.source_action_id.trim()
      || meta.source_character === meta.character
      || !Number.isSafeInteger(meta.source_revision_to)
      || meta.source_revision_to !== input.expected_revision
      || typeof meta.observer_increment_ref !== "string" || !meta.observer_increment_ref
      || typeof meta.memory_id !== "string" || !meta.memory_id.trim()
      || typeof meta.memory_hash !== "string" || !meta.memory_hash.trim()
      || typeof meta.interpreted_content_hash !== "string"
      || !meta.interpreted_content_hash.trim()
      || !["interpreted","partial","uncertain"].includes(meta.interpretation_status)
      || input.subjective_memory_formation?.result?.created_memory_count !== 1
      || input.subjective_memory_formation?.audit?.result_hash !== meta.phase63a_result_hash
      || input.subjective_memory_formation?.audit?.version
        !== "phase63a-subjective-memory-formation-v2"
      || input.subjective_memory_mutation_queue?.queue_hash !== meta.mutation_queue_hash
      || input.chronological_mutation_queue?.queue_hash !== meta.mutation_queue_hash
      || !Array.isArray(input.state_transitions)
      || input.state_transitions.length !== 1
      || input.state_transitions[0]?.field !== "memories." + meta.character) {
      const error = new Error(
        "Private subjective reply memory needs an exact Phase63A World-only transaction.");
      error.code = "WORLD_REPLY_MEMORY_COMMIT_METADATA_INVALID";
      throw error;
    }
  }
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
          if (input.autonomous_reply_subjective_memory_encoding != null) {
            const meta = input.autonomous_reply_subjective_memory_encoding;
            const oldWorld = cloneJson(current.state);
            const newWorld = cloneJson(nextWorldState);
            const oldMemories = isObject(oldWorld.memories) ? oldWorld.memories : {};
            const newMemories = isObject(newWorld.memories) ? newWorld.memories : {};
            const oldList = Array.isArray(oldMemories[meta.character])
              ? oldMemories[meta.character] : [];
            const newList = Array.isArray(newMemories[meta.character])
              ? newMemories[meta.character] : [];
            const latest = newList.at(-1);
            delete oldWorld.memories;
            delete newWorld.memories;
            const priorEntries = cloneJson(oldMemories);
            const nextEntries = cloneJson(newMemories);
            delete priorEntries[meta.character];
            delete nextEntries[meta.character];
            if (hashAgentRunValue(oldWorld) !== hashAgentRunValue(newWorld)
              || hashAgentRunValue(priorEntries) !== hashAgentRunValue(nextEntries)
              || newList.length !== oldList.length + 1
              || hashAgentRunValue(newList.slice(0,-1)) !== hashAgentRunValue(oldList)
              || latest?.memory_id !== meta.memory_id
              || hashAgentRunValue(latest) !== meta.memory_hash
              || latest?.memory_type !== "episodic_direct_perception"
              || latest?.source?.kind !== "direct_perception"
              || latest?.source?.sense !== "auditory"
              || latest?.content?.kind !== "subjective_spoken_reply_interpretation"
              || hashAgentRunValue(latest?.content?.interpreted_content)
                !== meta.interpreted_content_hash
              || latest?.content?.interpretation_status !== meta.interpretation_status
              || latest?.content?.source_utterance_verified !== false
              || latest?.content?.world_truth_claimed !== false
              || latest?.subjective_memory_not_world_truth !== true
              || latest?.possibly_incorrect !== true
              || latest?.internal_provenance?.turn_id !== turnId
              || latest?.formation_stage !== "encoded_unconsolidated"
              || input.state_transitions[0].to == null
              || hashAgentRunValue(input.state_transitions[0].to)
                !== hashAgentRunValue(newList)
              || hashAgentRunValue(input.state_transitions[0].from)
                !== hashAgentRunValue(Array.isArray(oldMemories[meta.character])
                  ? oldList : null)) {
              const error = new Error(
                "Reply encoding must append one uncertain private memory, with no other World changes.");
              error.code = "WORLD_REPLY_MEMORY_STATE_MUTATION_INVALID";
              throw error;
            }
          }
          const now = new Date().toISOString();
          assertWorldSimulationSleepArousalCommitAuthority({
            world_state: current.state,
            world_state_revision: current.revision,
            world_state_hash: current.state_hash,
            next_world_state: nextWorldState,
            event: input.event,
            state_transitions: input.state_transitions,
            committed_history: await readJson(paths.history, "world simulation history"),
          });
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
          if (input.autonomous_listener_clarification_reply != null) {
            const meta = input.autonomous_listener_clarification_reply;
            const prior = arrayTurns(history).at(-1);
            const sourceMeta = prior?.autonomous_actor_initiated_action;
            const admitted = arrayTurns(history).length === meta.source_revision_to
              && Array.isArray(prior?.communication_observer_increment_admissions)
              && prior.communication_observer_increment_admissions.filter(item =>
                item?.observer === meta.character
                && item?.admission_status === "heard_acoustic_cues_only"
                && item?.observer_increment?.increment_ref === meta.observer_increment_ref
                && item?.audit?.source_action_id === meta.source_action_id
                && item?.audit?.source_speaker === meta.source_character).length === 1;
            if (!prior || prior.turn_id !== meta.source_turn_id
              || hashAgentRunValue(prior) !== meta.source_turn_hash
              || prior.revision_to !== meta.source_revision_to
              || prior.event !== null
              || sourceMeta?.version !== "world-actor-initiated-speech-v1"
              || sourceMeta.character !== meta.source_character
              || sourceMeta.action_id !== meta.source_action_id
              || sourceMeta.scene_id !== meta.scene_id
              || !admitted) {
              const error = new Error(
                "Listener clarification requires the exact immediately prior committed acoustic source.");
              error.code = "WORLD_LISTENER_REPLY_SOURCE_COMMIT_INVALID";
              throw error;
            }
          }
          if (input.autonomous_reply_subjective_memory_encoding != null) {
            const meta = input.autonomous_reply_subjective_memory_encoding;
            const prior = arrayTurns(history).at(-1);
            const lineage = prior?.autonomous_listener_clarification_reply;
            const admissions = prior?.communication_observer_increment_admissions;
            if (!prior || prior.turn_id !== meta.source_turn_id
              || prior.revision_to !== meta.source_revision_to
              || hashAgentRunValue(prior) !== meta.source_turn_hash
              || prior.event !== null
              || lineage?.version !== "world-listener-clarification-causal-reply-v1"
              || lineage.character !== meta.source_character
              || lineage.action_id !== meta.source_action_id
              || lineage.scene_id !== meta.scene_id
              || lineage.source_character !== meta.character
              || !Array.isArray(admissions)
              || admissions.filter(item =>
                item?.observer === meta.character
                && item?.admission_status === "heard_acoustic_cues_only"
                && item?.audit?.source_action_id === meta.source_action_id
                && item?.audit?.source_speaker === meta.source_character
                && item?.observer_increment?.increment_ref
                  === meta.observer_increment_ref).length !== 1
              || (input.subjective_memory_formation?.result?.character_updates ?? [])
                .filter(item => item?.character === meta.character
                  && item?.created_memory_count === 1
                  && item?.memory_records?.length === 1
                  && item.memory_records[0].memory_id === meta.memory_id
                  && hashAgentRunValue(item.memory_records[0]) === meta.memory_hash)
                .length !== 1) {
              const error = new Error(
                "Subjective memory must retain one exact prior committed acoustic reply source.");
              error.code = "WORLD_REPLY_MEMORY_SOURCE_COMMIT_INVALID";
              throw error;
            }
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
            ...(input.autonomous_cognition_goal_commitment != null
              ? { autonomous_cognition_goal_commitment:
                  input.autonomous_cognition_goal_commitment } : {}),
            ...(input.autonomous_cognition_plan_commitment != null
              ? { autonomous_cognition_plan_commitment:
                  input.autonomous_cognition_plan_commitment } : {}),
            ...(input.autonomous_actor_initiated_action != null
              ? { autonomous_actor_initiated_action:
                  input.autonomous_actor_initiated_action } : {}),
            ...(input.autonomous_listener_clarification_reply != null
              ? { autonomous_listener_clarification_reply:
                  input.autonomous_listener_clarification_reply } : {}),
            ...(input.autonomous_reply_subjective_memory_encoding != null
              ? { autonomous_reply_subjective_memory_encoding:
                  input.autonomous_reply_subjective_memory_encoding } : {}),
            selected_action_intents: input.selected_action_intents ?? [],
            subjective_choice_commitment_receipts:
              input.subjective_choice_commitment_receipts ?? null,
            ...(input.native_temporal_choice_evidence != null
              ? { native_temporal_choice_evidence:
                  input.native_temporal_choice_evidence }
              : {}),
            ...(input.native_temporal_preparation_evidence != null
              ? { native_temporal_preparation_evidence:
                  input.native_temporal_preparation_evidence }
              : {}),
            ...(input.native_acoustic_cancellation_evidence != null
              ? { native_acoustic_cancellation_evidence:
                  input.native_acoustic_cancellation_evidence }
              : {}),
            state_transitions: input.state_transitions ?? [],
            action_outcomes: input.action_outcomes ?? [],
            knowledge_transitions: input.knowledge_transitions ?? [],
            scheduled_events: input.scheduled_events ?? [],
            causal_timeline: input.causal_timeline ?? null,
            communication_observer_increment_admissions:
              input.communication_observer_increment_admissions ?? [],
            communication_turn_increment_handoff:
              input.communication_turn_increment_handoff ?? null,
            communication_floor_opportunity_ledger:
              input.communication_floor_opportunity_ledger ?? null,
            communication_turn_allocation_readiness:
              input.communication_turn_allocation_readiness ?? null,
            communication_selection_aware_readiness:
              input.communication_selection_aware_readiness ?? null,
            communication_speaker_next_turn_intent:
              input.communication_speaker_next_turn_intent ?? null,
            communication_source_lineage_reconciliation:
              input.communication_source_lineage_reconciliation ?? null,
            communication_floor_transition_admission:
              input.communication_floor_transition_admission ?? null,
            communication_public_turn_invitation:
              input.communication_public_turn_invitation ?? null,
            communication_public_invitation_uptake:
              input.communication_public_invitation_uptake ?? null,
            communication_nominated_transition_authorization:
              input.communication_nominated_transition_authorization ?? null,
            communication_open_floor_transition_authorization:
              input.communication_open_floor_transition_authorization ?? null,
            communication_authorized_floor_claim:
              input.communication_authorized_floor_claim ?? null,
            communication_speech_overlap_evidence:
              input.communication_speech_overlap_evidence ?? null,
            observer_microtick_release_ledger:
              input.observer_microtick_release_ledger ?? null,
            observer_tick_snapshot_readiness:
              input.observer_tick_snapshot_readiness ?? null,
            observer_tick_prefix_reconstruction:
              input.observer_tick_prefix_reconstruction ?? null,
            observer_tick_perception:
              input.observer_tick_perception ?? null,
            observer_tick_brain_ingress:
              input.observer_tick_brain_ingress ?? null,
            observer_lexical_increment:
              input.observer_lexical_increment ?? null,
            observer_meaning_increment:
              input.observer_meaning_increment ?? null,
            chronological_mutation_queue: input.chronological_mutation_queue ?? null,
            chronological_mutation_execution: input.chronological_mutation_execution ?? null,
            mutation_proposal_boundary: input.mutation_proposal_boundary ?? null,
            pure_proposal_producers: input.pure_proposal_producers ?? null,
            immutable_causal_evaluators: input.immutable_causal_evaluators ?? null,
            immutable_physics_effects: input.immutable_physics_effects ?? null,
            immutable_projectile_lifecycle: input.immutable_projectile_lifecycle ?? null,
            immutable_ability_field_lifecycle: input.immutable_ability_field_lifecycle ?? null,
            immutable_event_queries: input.immutable_event_queries ?? null,
            immutable_event_arbitration: input.immutable_event_arbitration ?? null,
            cross_layer_event_arbitration: input.cross_layer_event_arbitration ?? null,
            causal_epochs: input.causal_epochs ?? null,
            fixed_point_convergence: input.fixed_point_convergence ?? null,
            visibility_queries: input.visibility_queries ?? [],
            directional_height_visibility_queries: input.directional_height_visibility_queries ?? [],
            illumination_visibility_queries: input.illumination_visibility_queries ?? [],
            audibility_queries: input.audibility_queries ?? [],
            olfaction_queries: input.olfaction_queries ?? [],
            communication_listener_understanding_projections:
              input.communication_listener_understanding_projections ?? [],
            communication_speaker_recognition_projections:
              input.communication_speaker_recognition_projections ?? [],
            ...(input.dialogue_panel_quotes?.length ? {dialogue_panel_quotes: input.dialogue_panel_quotes} : {}),
            ...(input.dialogue_thread_anchors?.length ? {dialogue_thread_anchors: input.dialogue_thread_anchors} : {}),
            ...(input.dialogue_answer_followups?.length ? {dialogue_answer_followups: input.dialogue_answer_followups} : {}),
            ...(input.dialogue_clarification_requests?.length
              ? {dialogue_clarification_requests: input.dialogue_clarification_requests} : {}),
            communication_grounding_evidence_projections:
              input.communication_grounding_evidence_projections ?? [],
            listener_social_interpretation_projections:
              input.listener_social_interpretation_projections ?? [],
            person_targeted_social_appraisal_projections:
              input.person_targeted_social_appraisal_projections ?? [],
            communication_repair_initiation_projections:
              input.communication_repair_initiation_projections ?? [],
            communication_repair_speech_action_projections:
              input.communication_repair_speech_action_projections ?? [],
            communication_repair_response_projections:
              input.communication_repair_response_projections ?? [],
            communication_repair_resolution_projections:
              input.communication_repair_resolution_projections ?? [],
            social_appraisal_experience_bridge:
              input.social_appraisal_experience_bridge ?? null,
            social_relationship_evidence:
              input.social_relationship_evidence ?? null,
            social_relationship_evidence_mutation_queue:
              input.social_relationship_evidence_mutation_queue ?? null,
            social_relationship_evidence_mutation_execution:
              input.social_relationship_evidence_mutation_execution ?? null,
            memory_accessibility_queries: input.memory_accessibility_queries ?? [],
            subjective_memory_encoding_decisions: input.subjective_memory_encoding_decisions ?? null,
            subjective_memory_episode_bindings: input.subjective_memory_episode_bindings ?? null,
            subjective_memory_retrieval_persistence:
              input.subjective_memory_retrieval_persistence ?? null,
            subjective_memory_retrieval_mutation_queue:
              input.subjective_memory_retrieval_mutation_queue ?? null,
            subjective_memory_retrieval_mutation_execution:
              input.subjective_memory_retrieval_mutation_execution ?? null,
            retrieval_conditioned_memory_interpretation_adoption:
              input.retrieval_conditioned_memory_interpretation_adoption ?? null,
            retrieval_induced_forgetting_consequence:
              input.retrieval_induced_forgetting_consequence ?? null,
            retrieval_induced_forgetting_consequence_mutation_queue:
              input.retrieval_induced_forgetting_consequence_mutation_queue ?? null,
            retrieval_induced_forgetting_consequence_mutation_execution:
              input.retrieval_induced_forgetting_consequence_mutation_execution ?? null,
            subjective_memory_plasticity:
              input.subjective_memory_plasticity ?? null,
            subjective_memory_plasticity_mutation_queue:
              input.subjective_memory_plasticity_mutation_queue ?? null,
            subjective_memory_plasticity_mutation_execution:
              input.subjective_memory_plasticity_mutation_execution ?? null,
            adaptive_memory_consolidation:
              input.adaptive_memory_consolidation ?? null,
            adaptive_memory_consolidation_mutation_queue:
              input.adaptive_memory_consolidation_mutation_queue ?? null,
            adaptive_memory_consolidation_mutation_execution:
              input.adaptive_memory_consolidation_mutation_execution ?? null,
            memory_reconsolidation_lifecycle:
              input.memory_reconsolidation_lifecycle ?? null,
            memory_reconsolidation_lifecycle_mutation_queue:
              input.memory_reconsolidation_lifecycle_mutation_queue ?? null,
            memory_reconsolidation_lifecycle_mutation_execution:
              input.memory_reconsolidation_lifecycle_mutation_execution ?? null,
            subjective_memory_formation: input.subjective_memory_formation ?? null,
            subjective_memory_mutation_queue: input.subjective_memory_mutation_queue ?? null,
            subjective_memory_mutation_execution: input.subjective_memory_mutation_execution ?? null,
            subjective_episode_segmentation:
              input.subjective_episode_segmentation ?? null,
            subjective_episode_segmentation_mutation_queue:
              input.subjective_episode_segmentation_mutation_queue ?? null,
            subjective_episode_segmentation_mutation_execution:
              input.subjective_episode_segmentation_mutation_execution ?? null,
            autobiographical_life_event_organization_decision_resolution:
              input.autobiographical_life_event_organization_decision_resolution ?? null,
            autobiographical_life_event_organization:
              input.autobiographical_life_event_organization ?? null,
            autobiographical_life_event_organization_mutation_queue:
              input.autobiographical_life_event_organization_mutation_queue ?? null,
            autobiographical_life_event_organization_mutation_execution:
              input.autobiographical_life_event_organization_mutation_execution ?? null,
            multi_experience_schema_evidence:
              input.multi_experience_schema_evidence ?? null,
            relational_schema_induction:
              input.relational_schema_induction ?? null,
            relational_schema_promotion_resolution:
              input.relational_schema_promotion_resolution ?? null,
            relational_schema_semantic_promotion:
              input.relational_schema_semantic_promotion ?? null,
            relational_schema_semantic_promotion_mutation_queue:
              input.relational_schema_semantic_promotion_mutation_queue ?? null,
            relational_schema_semantic_promotion_mutation_execution:
              input.relational_schema_semantic_promotion_mutation_execution ?? null,
            personal_semantic_memory_decision_resolution:
              input.personal_semantic_memory_decision_resolution ?? null,
            personal_semantic_memory_derivation:
              input.personal_semantic_memory_derivation ?? null,
            personal_semantic_memory_mutation_queue:
              input.personal_semantic_memory_mutation_queue ?? null,
            personal_semantic_memory_mutation_execution:
              input.personal_semantic_memory_mutation_execution ?? null,
            autobiographical_life_period_organization_decision_resolution:
              input.autobiographical_life_period_organization_decision_resolution ?? null,
            autobiographical_life_period_organization:
              input.autobiographical_life_period_organization ?? null,
            autobiographical_life_period_organization_mutation_queue:
              input.autobiographical_life_period_organization_mutation_queue ?? null,
            autobiographical_life_period_organization_mutation_execution:
              input.autobiographical_life_period_organization_mutation_execution ?? null,
            experience_grounded_subjective_learning_interpretation_resolution:
              input.experience_grounded_subjective_learning_interpretation_resolution ?? null,
            experiential_knowledge_reentry_projections:
              input.experiential_knowledge_reentry_projections ?? null,
            experiential_method_transfer_projections:
              input.experiential_method_transfer_projections ?? null,
            experiential_method_competition_projections:
              input.experiential_method_competition_projections ?? null,
            experiential_method_competition_resolution_projections:
              input.experiential_method_competition_resolution_projections ?? null,
            experiential_method_competition_guidance_projections:
              input.experiential_method_competition_guidance_projections ?? null,
            experiential_method_impasse_deliberation_projections:
              input.experiential_method_impasse_deliberation_projections ?? null,
            experiential_method_impasse_discriminating_evidence_projections:
              input.experiential_method_impasse_discriminating_evidence_projections ?? null,
            experiential_method_impasse_reresolution_projections:
              input.experiential_method_impasse_reresolution_projections ?? null,
            experiential_method_impasse_precedent_reentry_projections:
              input.experiential_method_impasse_precedent_reentry_projections ?? null,
            analogical_experience_candidate_projections:
              input.analogical_experience_candidate_projections ?? null,
            experiential_method_impasse_precedent_reresolution_projections:
              input.experiential_method_impasse_precedent_reresolution_projections ?? null,
            experiential_method_candidate_attribution_projections:
              input.experiential_method_candidate_attribution_projections ?? null,
            selected_experiential_method_application_receipts:
              input.selected_experiential_method_application_receipts ?? null,
            experiential_method_impasse_resolution_application_lineage:
              input.experiential_method_impasse_resolution_application_lineage ?? null,
            analogical_experience_application_lineage:
              input.analogical_experience_application_lineage ?? null,
            analogical_experience_outcome_evidence:
              input.analogical_experience_outcome_evidence ?? null,
            analogical_experience_retention_capsules:
              input.analogical_experience_retention_capsules ?? null,
            analogical_experience_retention_reentry_projections:
              input.analogical_experience_retention_reentry_projections ?? null,
            analogical_experience_retention_reuse_projections:
              input.analogical_experience_retention_reuse_projections ?? null,
            experiential_method_outcome_credit_resolution:
              input.experiential_method_outcome_credit_resolution ?? null,
            experiential_method_impasse_resolution_outcome_evidence:
              input.experiential_method_impasse_resolution_outcome_evidence ?? null,
            experiential_method_semantic_revision:
              input.experiential_method_semantic_revision ?? null,
            experiential_method_semantic_revision_mutation_queue:
              input.experiential_method_semantic_revision_mutation_queue ?? null,
            experiential_method_semantic_revision_mutation_execution:
              input.experiential_method_semantic_revision_mutation_execution ?? null,
            contextual_schema_refinement_evidence:
              input.contextual_schema_refinement_evidence ?? null,
            contextual_schema_specialization_resolution:
              input.contextual_schema_specialization_resolution ?? null,
            contextual_schema_specialization_admission_resolution:
              input.contextual_schema_specialization_admission_resolution ?? null,
            contextual_schema_specialization_semantic_retention:
              input.contextual_schema_specialization_semantic_retention ?? null,
            contextual_schema_specialization_semantic_retention_mutation_queue:
              input.contextual_schema_specialization_semantic_retention_mutation_queue ?? null,
            contextual_schema_specialization_semantic_retention_mutation_execution:
              input.contextual_schema_specialization_semantic_retention_mutation_execution ?? null,
            subjective_claim_proposal_resolution:
              input.subjective_claim_proposal_resolution ?? null,
            subjective_claim_projection:
              input.subjective_claim_projection ?? null,
            subjective_claim_mutation_queue:
              input.subjective_claim_mutation_queue ?? null,
            subjective_claim_mutation_execution:
              input.subjective_claim_mutation_execution ?? null,
            subjective_claim_relation_proposal_resolution:
              input.subjective_claim_relation_proposal_resolution ?? null,
            subjective_claim_conflict_revision_projection:
              input.subjective_claim_conflict_revision_projection ?? null,
            subjective_claim_relation_mutation_queue:
              input.subjective_claim_relation_mutation_queue ?? null,
            subjective_claim_relation_mutation_execution:
              input.subjective_claim_relation_mutation_execution ?? null,
            coping_intention_commitments: input.coping_intention_commitments ?? null,
            affective_appraisal_record: input.affective_appraisal_record ?? null,
            memory_interpretation_turn: input.memory_interpretation_turn ?? null,
            memory_interpretation_mutation_queue: input.memory_interpretation_mutation_queue ?? null,
            memory_interpretation_mutation_execution: input.memory_interpretation_mutation_execution ?? null,
            subjective_belief_resolution:
              input.subjective_belief_resolution ?? null,
            subjective_belief_revision_projection:
              input.subjective_belief_revision_projection ?? null,
            subjective_belief_revision_mutation_queue:
              input.subjective_belief_revision_mutation_queue ?? null,
            subjective_belief_revision_mutation_execution:
              input.subjective_belief_revision_mutation_execution ?? null,
            committed_character_current_mind_projection:
              input.committed_character_current_mind_projection ?? null,
            post_outcome_subjective_perception_projection:
              input.post_outcome_subjective_perception_projection ?? null,
            post_outcome_counterfactual_alternative_evidence:
              input.post_outcome_counterfactual_alternative_evidence ?? null,
            post_outcome_counterfactual_appraisal:
              input.post_outcome_counterfactual_appraisal ?? null,
            post_outcome_counterfactual_reflection_retention:
              input.post_outcome_counterfactual_reflection_retention ?? null,
            counterfactual_reflection_reentry_projections:
              input.counterfactual_reflection_reentry_projections ?? null,
            counterfactual_linked_experience_reentry_projections:
              input.counterfactual_linked_experience_reentry_projections ?? null,
            counterfactual_linked_experience_reuse_outcome_reentry_projections:
              input.counterfactual_linked_experience_reuse_outcome_reentry_projections ?? null,
            counterfactual_linked_experience_longitudinal_case_reentry:
              input.counterfactual_linked_experience_longitudinal_case_reentry ?? null,
            counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections:
              input.counterfactual_linked_experience_longitudinal_case_deliberative_reuse_projections ?? null,
            counterfactual_linked_experience_longitudinal_case_selected_action_lineage:
              input.counterfactual_linked_experience_longitudinal_case_selected_action_lineage ?? null,
            counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence:
              input.counterfactual_linked_experience_longitudinal_case_selected_action_outcome_evidence ?? null,
            counterfactual_linked_experience_retained_longitudinal_case_outcome_evidence:
              input.counterfactual_linked_experience_retained_longitudinal_case_outcome_evidence ?? null,
            counterfactual_linked_experience_reuse_outcome_deliberation_projections:
              input.counterfactual_linked_experience_reuse_outcome_deliberation_projections ?? null,
            counterfactual_linked_experience_reuse_outcome_selected_action_lineage:
              input.counterfactual_linked_experience_reuse_outcome_selected_action_lineage ?? null,
            counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence:
              input.counterfactual_linked_experience_reuse_outcome_selected_action_outcome_evidence ?? null,
            counterfactual_linked_experience_longitudinal_reuse_outcome_evidence:
              input.counterfactual_linked_experience_longitudinal_reuse_outcome_evidence ?? null,
            counterfactual_linked_experience_longitudinal_reuse_outcome_variation:
              input.counterfactual_linked_experience_longitudinal_reuse_outcome_variation ?? null,
            counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal:
              input.counterfactual_linked_experience_longitudinal_reuse_outcome_appraisal ?? null,
            counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission:
              input.counterfactual_linked_experience_longitudinal_reuse_outcome_revise_retain_admission ?? null,
            counterfactual_linked_experience_reuse_projections:
              input.counterfactual_linked_experience_reuse_projections ?? null,
            counterfactual_linked_experience_selected_action_lineage:
              input.counterfactual_linked_experience_selected_action_lineage ?? null,
            counterfactual_linked_experience_reuse_outcome_evidence:
              input.counterfactual_linked_experience_reuse_outcome_evidence ?? null,
            counterfactual_linked_experience_reuse_outcome_retention:
              input.counterfactual_linked_experience_reuse_outcome_retention ?? null,
            counterfactual_preparative_revalidation_projections:
              input.counterfactual_preparative_revalidation_projections ?? null,
            counterfactual_preparative_selected_action_lineage:
              input.counterfactual_preparative_selected_action_lineage ?? null,
            counterfactual_selected_action_outcome_evidence:
              input.counterfactual_selected_action_outcome_evidence ?? null,
            counterfactual_linked_experience_retention:
              input.counterfactual_linked_experience_retention ?? null,
            post_outcome_subjective_memory_bridge:
              input.post_outcome_subjective_memory_bridge ?? null,
            post_outcome_subjective_memory_formation:
              input.post_outcome_subjective_memory_formation ?? null,
            post_outcome_subjective_memory_mutation_queue:
              input.post_outcome_subjective_memory_mutation_queue ?? null,
            post_outcome_subjective_memory_mutation_execution:
              input.post_outcome_subjective_memory_mutation_execution ?? null,
            committed_character_experience_projection:
              input.committed_character_experience_projection ?? null,
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
