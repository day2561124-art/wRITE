import {
  getWorldSimulationHistory,
  getWorldSimulationState,
} from "./world-simulation-state-service.mjs";

export const worldSimulationBodyHistoryVersion = "body-0b-committed-history-v1";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function point(value) {
  const location = record(value);
  return Number.isFinite(location.x) && Number.isFinite(location.y)
    ? { x: location.x, y: location.y } : null;
}

function error(code) {
  const issue = new Error(code);
  issue.code = code;
  return issue;
}

// A private, bounded projection of the World ledger. Selected intents cannot
// assert actual movement; only a committed position transition can do that.
export function projectWorldSimulationBodyHistory({
  world_history,
  character,
  max_turns = 32,
} = {}) {
  const actor = String(character ?? "").trim();
  if (!actor) throw error("BODY0B_CHARACTER_REQUIRED");
  if (!Number.isSafeInteger(max_turns) || max_turns < 1 || max_turns > 128)
    throw error("BODY0B_HISTORY_LIMIT_INVALID");
  const turns = list(record(world_history).turns).slice(-max_turns).map((entry) => {
    const turn = record(entry);
    const intentions = list(turn.selected_action_intents)
      .filter((selected) => selected?.character === actor)
      .map((selected) => {
        const candidate = record(selected.candidate);
        const actionId = typeof candidate.action_id === "string" ? candidate.action_id : null;
        const outcome = list(turn.action_outcomes).find((item) =>
          item?.actor === actor && item?.action_id === actionId);
        return {
          action_id: actionId,
          selection: selected.selection === "reject_all" ? "reject_all" : "selected",
          motor_intention_recorded: selected.selection !== "reject_all"
            && (candidate.kind === "movement" || Boolean(candidate.movement)),
          world_outcome: typeof outcome?.result === "string" ? outcome.result : null,
        };
      });
    const transitions = list(turn.state_transitions)
      .filter((item) => item?.entity === actor);
    const movement = transitions.filter((item) => item.field === "position")
      .map((item) => ({ from: point(item.from), to: point(item.to) }))
      .filter((item) => item.from && item.to);
    const injuryChanges = transitions.filter((item) =>
      item.field === "physical_state.injuries")
      .map((item) => ({
        before_count: list(item.from).length,
        after_count: list(item.to).length,
      }));
    return {
      turn_id: typeof turn.turn_id === "string" ? turn.turn_id : null,
      revision_to: Number.isSafeInteger(turn.revision_to) ? turn.revision_to : null,
      intentions,
      actual_movement: movement,
      injury_changes: injuryChanges,
    };
  }).filter((turn) =>
    turn.intentions.length || turn.actual_movement.length || turn.injury_changes.length);
  return {
    version: worldSimulationBodyHistoryVersion,
    authority: "derived_world_committed_history",
    character: actor,
    turns,
  };
}

export async function readCommittedWorldSimulationBodyHistory({
  session_id,
  character,
  expected_revision,
  expected_state_hash,
  max_turns,
} = {}, options = {}) {
  const first = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && first.revision !== expected_revision)
    throw error("BODY0B_COMMITTED_STATE_REVISION_CHANGED");
  if (expected_state_hash !== undefined && first.state_hash !== expected_state_hash)
    throw error("BODY0B_COMMITTED_STATE_HASH_CHANGED");
  if (!Object.hasOwn(record(first.state?.characters), String(character ?? "").trim()))
    throw error("BODY0B_CHARACTER_NOT_IN_COMMITTED_WORLD");
  const history = await getWorldSimulationHistory(session_id, options);
  const last = list(history.turns).at(-1);
  const second = await getWorldSimulationState(session_id, options);
  if (second.revision !== first.revision || second.state_hash !== first.state_hash)
    throw error("BODY0B_COMMITTED_SNAPSHOT_CHANGED");
  if (first.revision === 0 ? Boolean(last) :
      last?.revision_to !== first.revision || last?.next_state_hash !== first.state_hash)
    throw error("BODY0B_HISTORY_STATE_MISMATCH");
  return {
    ...projectWorldSimulationBodyHistory({
      world_history: history, character, max_turns,
    }),
    authority: "committed_world_causal_history",
    world_state_revision: first.revision,
    world_state_hash: first.state_hash,
  };
}

export function buildWorldSimulationBodyHistoryContract() {
  return {
    version: worldSimulationBodyHistoryVersion,
    source: "committed_world_history_and_state",
    read_only_engine_private: true,
    motor_intention_is_completed_movement: false,
    actual_movement_requires_world_position_transition: true,
    separate_body_truth_authority: false,
  };
}
