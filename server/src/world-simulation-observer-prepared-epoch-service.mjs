import { hashAgentRunValue } from "./agent-run-service.mjs";
import { readWorldSimulationObserverMicrotickRelease } from "./world-simulation-observer-microtick-ledger-service.mjs";
import { projectWorldSimulationObserverTickPerceptions } from "./world-simulation-observer-tick-perception-service.mjs";

export const worldSimulationObserverPreparedEpochVersion =
  "cc7ab-observer-prepared-epoch-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7AB_PREPARED_EPOCH_INVALID";
  throw error;
}
function identity(value, label) {
  if (typeof value !== "string" || !value.trim() || [...value].length > 240)
    reject(label + " must be bounded nonblank text.");
  return value;
}
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) reject(label + " must be a nonnegative integer.");
  return value;
}
function exact(value, keys, label) {
  if (!record(value) || Object.keys(value).sort().join("|") !== keys.slice().sort().join("|"))
    reject(label + " has non-contract fields.");
}

export function buildWorldSimulationObserverPreparedEpochContract() {
  return {
    version: worldSimulationObserverPreparedEpochVersion,
    source: "cc7e_release_cc7g_verified_prefix_cc7h_observer_view",
    engine_owned_inputs_only: true,
    observer_receives_current_release_only: true,
    future_release_exposed: false,
    world_snapshot_exposed: false,
    action_proposal_supported: false,
    character_brain_invoked: false,
    public_signal_emitted: false,
    world_mutation_performed: false,
    response_receipt_is_one_use_within_engine_state: true,
    response_does_not_claim_floor_grounding_or_comprehension: true,
  };
}

function verifiedEpoch(value) {
  exact(value, [
    "schema_version", "epoch_id", "session_id", "turn_id", "world_state_revision",
    "pre_turn_world_state_hash", "causal_epoch_hash", "ledger_hash",
    "release_cursor", "next_cursor", "release_time_ms", "observer",
    "observer_view", "source_prefix_hash", "boundaries",
  ], "prepared epoch");
  if (value.schema_version !== worldSimulationObserverPreparedEpochVersion
      || !record(value.observer_view)
      || value.observer_view.observer !== value.observer
      || value.observer_view.release_time_ms !== value.release_time_ms
      || value.observer_view.future_release_exposed !== false
      || value.observer_view.world_snapshot_exposed !== false
      || value.boundaries?.version !== worldSimulationObserverPreparedEpochVersion)
    reject("Prepared epoch must contain a current observer-only view.");
  const { epoch_id, ...payload } = value;
  if (epoch_id !== "prepared_epoch_" + hashAgentRunValue(payload).slice(0, 32))
    reject("Prepared epoch identity does not match its contents.");
  return value;
}

/**
 * Engine-only ingress. The caller supplies its actual session/turn/revision,
 * pre-turn World state, and exact CC-7G replay from the authoritative turn.
 * This service refuses an unverified tick or a skipped release. It does not
 * persist the speculative view or invoke the Character Brain.
 */
export function prepareWorldSimulationObserverTemporalEpoch({
  session_id, turn_id, world_state_revision, pre_turn_world_state,
  ledger, reconstruction, scene_id = null, observer, cursor = 0,
  previous_epoch = null,
} = {}) {
  identity(session_id, "session_id");
  identity(turn_id, "turn_id");
  identity(observer, "observer");
  integer(world_state_revision, "world_state_revision");
  integer(cursor, "cursor");
  if (!record(pre_turn_world_state)) reject("Actual pre-turn World state is required.");
  const preTurnHash = hashAgentRunValue(pre_turn_world_state);
  if (cursor === 0 && previous_epoch !== null)
    reject("The first tick cannot have a prior epoch.");
  let nextUnread = 0;
  if (previous_epoch !== null) {
    const prior = verifiedEpoch(previous_epoch);
    if (prior.session_id !== session_id || prior.turn_id !== turn_id
        || prior.world_state_revision !== world_state_revision
        || prior.pre_turn_world_state_hash !== preTurnHash
        || prior.observer !== observer || prior.next_cursor > cursor
        || prior.ledger_hash !== ledger?.ledger_hash
        || prior.causal_epoch_hash !== reconstruction?.audit?.source_execution_hash)
      reject("Next release must continue the same observer and causal epoch.");
    nextUnread = prior.next_cursor;
  }
  // World ticks with no admitted cue for this observer need no epoch. A
  // caller may advance over only those ticks, never over an unheard-to-code
  // but actually admitted observer release.
  for (let index = nextUnread; index < cursor; index += 1) {
    if (readWorldSimulationObserverMicrotickRelease({
      ledger, observer, cursor: index,
    }).perceived_increments.length)
      reject("An admitted observer release cannot be skipped.");
  }
  const release = readWorldSimulationObserverMicrotickRelease({ ledger, observer, cursor });
  if (release.completed) return null;
  const audit = reconstruction?.audit;
  const receipt = audit?.ticks?.[cursor];
  const snapshot = reconstruction?.engine_snapshots?.[cursor];
  if (audit?.status !== "engine_private_prefixes_reconstructed"
      || !identity(audit.source_execution_hash, "causal epoch hash")
      || !record(receipt) || !record(snapshot)
      || receipt.source_pre_turn_world_state_hash !== preTurnHash
      || receipt.reconstructed_world_state_hash !== hashAgentRunValue(snapshot.world_state)
      || receipt.release_time_ms !== release.release_time_ms
      || audit.readiness_ledger_hash !== ledger.ledger_hash)
    reject("Exact authoritative prefix and release lineage are required.");
  const projected = projectWorldSimulationObserverTickPerceptions({
    ledger, reconstruction, scene_id,
  });
  if (projected.audit.status !== "observer_views_engine_private")
    reject("Verified observer projection is unavailable.");
  const views = projected.engine_private_character_views.filter((item) =>
    item.observer === observer && item.release_time_ms === release.release_time_ms);
  if (release.perceived_increments.length === 0) {
    if (views.length) reject("Unexpected observer view without admitted cues.");
    return null;
  }
  if (views.length !== 1
      || views[0].heard_nonlexical.length !== release.perceived_increments.length
      || views[0].heard_nonlexical.some((cue, index) =>
        JSON.stringify(cue.perceived_cue_refs)
          !== JSON.stringify(release.perceived_increments[index].perceived_cue_refs)))
    reject("Observer view must match only the current admitted release.");
  const payload = {
    schema_version: worldSimulationObserverPreparedEpochVersion,
    session_id, turn_id, world_state_revision,
    pre_turn_world_state_hash: preTurnHash,
    causal_epoch_hash: audit.source_execution_hash,
    ledger_hash: ledger.ledger_hash,
    release_cursor: cursor,
    next_cursor: release.next_cursor,
    release_time_ms: release.release_time_ms,
    observer,
    observer_view: copy(views[0]),
    source_prefix_hash: receipt.reconstructed_world_state_hash,
    boundaries: buildWorldSimulationObserverPreparedEpochContract(),
  };
  return copy({
    epoch_id: "prepared_epoch_" + hashAgentRunValue(payload).slice(0, 32),
    ...payload,
  });
}

/**
 * Pure receipt check against a freshly computed current epoch. The engine
 * owns consumed_epoch_ids and must advance it atomically with its private
 * response state. Neither accepted decision is a World action.
 */
export function acceptWorldSimulationObserverPreparedEpochResponse({
  prepared_epoch, current_epoch, response, consumed_epoch_ids = [],
} = {}) {
  const prepared = verifiedEpoch(prepared_epoch);
  const current = verifiedEpoch(current_epoch);
  exact(response, ["epoch_id", "decision"], "epoch response");
  if (!Array.isArray(consumed_epoch_ids) || consumed_epoch_ids.length > 32
      || consumed_epoch_ids.some((id) => typeof id !== "string"))
    reject("Consumed epoch receipts must be bounded engine state.");
  if (prepared.epoch_id !== current.epoch_id
      || response.epoch_id !== current.epoch_id
      || JSON.stringify(prepared) !== JSON.stringify(current))
    reject("Stale or mismatched epoch response.");
  if (consumed_epoch_ids.includes(current.epoch_id))
    reject("Prepared epoch response has already been consumed.");
  if (!["wait", "revise_preparation"].includes(response.decision))
    reject("Read-only epoch cannot propose a public action.");
  return {
    accepted: true,
    decision: response.decision,
    consumed_epoch_ids: [...consumed_epoch_ids, current.epoch_id],
    public_signal_emitted: false,
    world_mutation_performed: false,
  };
}
