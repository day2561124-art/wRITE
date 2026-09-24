import { hashAgentRunValue } from "./agent-run-service.mjs";
import { adjudicateWorldSimulationCausality } from "./world-simulation-causal-rule-engine.mjs";
import { buildWorldSimulationObserverMicrotickLedger } from "./world-simulation-observer-microtick-ledger-service.mjs";

export const worldSimulationNativeCausalEpochInvalidationVersion =
  "cc7af-canonical-source-supersession-v1";
const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7AF_SOURCE_SUPERSESSION_INVALID";
  throw error;
}
function validSelected(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 128)
    reject("Source supersession requires bounded actual World action sets.");
  const seen = new Set();
  for (const item of items) {
    if (!record(item) || typeof item.character !== "string"
        || !item.character.trim() || seen.has(item.character))
      reject("Source supersession requires one World decision per character.");
    seen.add(item.character);
  }
}
function inputFor({
  session_id, turn_id, world_state, world_state_revision, world_state_hash,
  event, scene_analysis,
}, selected) {
  return {
    world_simulation_session_id:session_id, turn_id,
    world_state:copy(world_state), world_state_revision, world_state_hash,
    event:copy(event), scene_analysis:copy(scene_analysis),
    selected_action_intents:copy(selected),
  };
}
function ledgerOf(resolution) {
  return buildWorldSimulationObserverMicrotickLedger({
    causal_timeline:resolution.causal_timeline,
    admissions:resolution.communication_observer_increment_admissions,
  });
}
function sourceOf(resolution, observer, increment) {
  const matches=(resolution.communication_observer_increment_admissions ?? [])
    .filter(x=>x.observer === observer
      && x.admission_status === "heard_acoustic_cues_only"
      && x.observer_increment?.increment_ref === increment.increment_ref
      && x.release_time_ms === increment.release_time_ms);
  if (matches.length !== 1 || !record(matches[0].audit))
    reject("Original observer increment lacks one canonical source admission.");
  const source=matches[0].audit;
  return {
    observer, release_time_ms:increment.release_time_ms,
    observer_increment_ref:increment.increment_ref,
    observer_signal_ref:increment.signal_ref,
    source_action_id:source.source_action_id,
    source_stream_id:source.source_stream_id,
    source_speaker:source.source_speaker,
    source_sound_id:source.source_sound_id,
  };
}

/**
 * Read-only first-stage proof. BOTH causal executions are recalculated by
 * the canonical World adjudicator from one verified original pre-turn state.
 * A source that disappears from a revised execution cannot authorize its
 * pending preparation or response; historical committed sound is NOT erased.
 * This does not perform live cancellation, replan a Brain, or commit World.
 */
export async function assessWorldSimulationNativeCausalEpochSupersession({
  session_id, turn_id, world_state, world_state_revision, world_state_hash,
  event, scene_analysis, original_selected_action_intents,
  revised_selected_action_intents, observer, original_release_cursor = 0,
  expected_original_execution_hash, expected_original_ledger_hash,
} = {}) {
  if (typeof session_id !== "string" || !session_id
      || typeof turn_id !== "string" || !turn_id
      || !record(world_state)
      || hashAgentRunValue(world_state) !== world_state_hash
      || !Number.isSafeInteger(world_state_revision) || world_state_revision < 0
      || typeof observer !== "string" || !observer
      || !Number.isSafeInteger(original_release_cursor) || original_release_cursor < 0)
    reject("Exact original World state, observer and release cursor required.");
  validSelected(original_selected_action_intents);
  validSelected(revised_selected_action_intents);
  if (original_selected_action_intents.map(x=>x.character).sort().join("|")
      !== revised_selected_action_intents.map(x=>x.character).sort().join("|"))
    reject("Supersession may not silently introduce or remove World characters.");
  const common={
    session_id, turn_id, world_state, world_state_revision, world_state_hash,
    event, scene_analysis,
  };
  const original=await adjudicateWorldSimulationCausality(
    inputFor(common,original_selected_action_intents));
  const revised=await adjudicateWorldSimulationCausality(
    inputFor(common,revised_selected_action_intents));
  const oldLedger=ledgerOf(original);
  const nextLedger=ledgerOf(revised);
  if (original_release_cursor >= oldLedger.tick_count)
    reject("Original release cursor must refer to an actually admitted World tick.");
  const oldTick=oldLedger.ticks[original_release_cursor];
  const increments=oldTick.observer_cues.filter(x=>x.observer === observer)
    .map(x=>x.observer_increment);
  if (increments.length !== 1)
    reject("First-stage source supersession needs exactly one observer cue.");
  const oldSource=sourceOf(original,observer,increments[0]);
  const surviving=(revised.communication_observer_increment_admissions ?? [])
    .filter(x=>x.admission_status === "heard_acoustic_cues_only"
      && x.observer === observer
      && x.release_time_ms === oldSource.release_time_ms
      && x.observer_increment?.increment_ref === oldSource.observer_increment_ref
      && x.observer_increment?.signal_ref === oldSource.observer_signal_ref
      && x.audit?.source_action_id === oldSource.source_action_id
      && x.audit?.source_stream_id === oldSource.source_stream_id
      && x.audit?.source_speaker === oldSource.source_speaker
      && x.audit?.source_sound_id === oldSource.source_sound_id);
  const originalExecutionHash=
    original.chronological_mutation_execution?.execution_hash;
  const revisedExecutionHash=
    revised.chronological_mutation_execution?.execution_hash;
  if (typeof originalExecutionHash !== "string" || !originalExecutionHash
      || typeof revisedExecutionHash !== "string" || !revisedExecutionHash)
    reject("Both canonical executions require verified exact execution hashes.");
  if ((expected_original_execution_hash !== undefined
        && expected_original_execution_hash !== originalExecutionHash)
      || (expected_original_ledger_hash !== undefined
        && expected_original_ledger_hash !== oldLedger.ledger_hash))
    reject("Pending response belongs to a stale original observer causal epoch.");
  const sameEpoch=originalExecutionHash===revisedExecutionHash
    &&oldLedger.ledger_hash===nextLedger.ledger_hash;
  const status=surviving.length === 0?"source_not_released_in_revised_execution"
    :sameEpoch?"unchanged_epoch":"source_survives_but_epoch_changed";
  if (surviving.length > 1)
    reject("Revised World contains a duplicate source admission.");
  const audit={
    schema_version:worldSimulationNativeCausalEpochInvalidationVersion,
    status,observer_ref:"observer_"+hashAgentRunValue(observer).slice(0,24),
    original_world_state_hash:world_state_hash,
    original_execution_hash:original.chronological_mutation_execution.execution_hash,
    revised_execution_hash:revised.chronological_mutation_execution.execution_hash,
    original_ledger_hash:oldLedger.ledger_hash,
    revised_ledger_hash:nextLedger.ledger_hash,
    source_ref_hash:hashAgentRunValue(oldSource),
    original_release_time_ms:oldSource.release_time_ms,
    source_survives_revised_execution:surviving.length===1,
    obsolete_preparation_must_not_authorize_new_action:!sameEpoch || surviving.length===0,
    public_signal_emitted:false,world_mutation_performed:false,
    previously_committed_sound_retracted:false,
    interruption_or_floor_loss_inferred:false,
    boundaries:{
      canonical_world_re_adjudication_only:true,
      tentative_future_not_committed_history:true,
      private_observer_action_resolver_not_called:true,
      requires_later_native_world_adoption:true,
    },
  };
  return { ...audit, audit_hash:hashAgentRunValue(audit) };
}
