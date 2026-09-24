import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  buildWorldSimulationSubjectiveChoiceCommitmentReceipts,
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle,
} from "./world-simulation-subjective-choice-commitment-receipt-service.mjs";
import { assessWorldSimulationNativeCausalEpochSupersession } from "./world-simulation-native-causal-epoch-invalidation-service.mjs";
import { replayWorldSimulationNativeTemporalResponse } from "./world-simulation-native-temporal-replay-service.mjs";

export const worldSimulationNativeSourceReentryVersion =
  "cc7af-fresh-source-provisional-reentry-v1";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));
function reject(message) {
  const error = new Error(message);
  error.code = "CC7AF_FRESH_SOURCE_REENTRY_INVALID";
  throw error;
}
function validateStage({ session_id, turn_id, world_state_revision,
  world_state_hash, decision_packets, selected_action_intents, receipts,
}, label) {
  if (!Array.isArray(decision_packets) || !Array.isArray(selected_action_intents)
      || decision_packets.length !== selected_action_intents.length
      || decision_packets.length < 2 || decision_packets.length > 128)
    reject(label + " requires bounded, complete Character Brain decision packets.");
  const visited = new Set();
  for (const packet of decision_packets) {
    const character = packet?.character;
    if (typeof character !== "string" || !character || visited.has(character))
      reject(label + " duplicate or invalid character decision packet.");
    visited.add(character);
    const choices = selected_action_intents.filter(item => item?.character === character);
    if (choices.length !== 1) reject(label + " requires one selection per packet.");
    const selection = choices[0];
    if (selection.selection === "reject_all") {
      if (selection.action_id !== null || selection.candidate !== null
          || selection.intent !== null)
        reject(label + " reject_all cannot contain an action.");
    } else {
      if (selection.selection !== "candidate_action_intent"
          || !record(selection.candidate)
          || !Array.isArray(packet.candidate_action_intents)
          || !packet.candidate_action_intents.some(item =>
            JSON.stringify(item) === JSON.stringify(selection.candidate))
          || selection.action_id !== selection.candidate.action_id
          || JSON.stringify(selection.intent) !==
            JSON.stringify(selection.candidate.intent ?? null))
        reject(label + " selected action is not the exact prepared Character Brain candidate.");
    }
  }
  if (selected_action_intents.some(item => !visited.has(item.character)))
    reject(label + " selected actions and decision packets differ.");
  const expected = buildWorldSimulationSubjectiveChoiceCommitmentReceipts({
    world_simulation_session_id:session_id, turn_id,
    state_revision:world_state_revision, world_state_hash,
    decision_packets, selected_action_intents,
  });
  assertWorldSimulationSubjectiveChoiceCommitmentReceiptBundle(receipts, {
    world_simulation_session_id:session_id,turn_id,
    state_revision:world_state_revision,world_state_hash,
  });
  if (JSON.stringify(expected) !== JSON.stringify(receipts))
    reject(label + " Phase74D receipts do not match the exact current decision packets.");
  return expected.receipt_bundle_hash;
}

/**
 * Speculative proof only. This does NOT authorize a revision of an already
 * committed World turn. Both source stages must carry independently
 * recomputed Phase74D candidate lineage, and the old source must be absent
 * in the revised canonical causal execution. The fresh observer selection
 * runs on the REVISED World ledger with no previous private epoch/receipts
 * carried across. The final result MUST pass a separate native World
 * consistency and atomic commit, under genuine broker/World authority.
 */
export async function proveWorldSimulationNativeSourceReentry({
  session_id, turn_id, world_state, world_state_revision, world_state_hash,
  event, scene_analysis, observer,
  original_decision_packets, original_selected_action_intents, original_receipts,
  revised_decision_packets, revised_selected_action_intents, revised_receipts,
  character_input_resolver, selection_resolver, preparation_decision_resolver,
} = {}) {
  if (!record(world_state) || hashAgentRunValue(world_state) !== world_state_hash
      || typeof session_id !== "string" || !session_id
      || typeof turn_id !== "string" || !turn_id
      || !Number.isSafeInteger(world_state_revision) || world_state_revision < 0
      || typeof observer !== "string" || !observer
      || typeof character_input_resolver !== "function"
      || typeof selection_resolver !== "function"
      || (preparation_decision_resolver !== undefined
        && typeof preparation_decision_resolver !== "function"))
    reject("Reentry requires exact original World snapshot and fresh same-character resolvers.");
  const shared={session_id,turn_id,world_state_revision,world_state_hash};
  const originalReceiptHash=validateStage({
    ...shared,decision_packets:original_decision_packets,
    selected_action_intents:original_selected_action_intents,
    receipts:original_receipts,
  },"Original");
  const revisedReceiptHash=validateStage({
    ...shared,decision_packets:revised_decision_packets,
    selected_action_intents:revised_selected_action_intents,
    receipts:revised_receipts,
  },"Revised");
  if (originalReceiptHash === revisedReceiptHash)
    reject("Fresh source reentry needs a genuinely revised Character Brain decision.");
  const oldObserver=original_selected_action_intents.filter(item=>
    item.character===observer);
  const newObserver=revised_selected_action_intents.filter(item=>
    item.character===observer);
  if (oldObserver.length!==1 || newObserver.length!==1
      || oldObserver[0].selection!=="reject_all"
      || newObserver[0].selection!=="reject_all")
    reject("Observer must retain a distinct pre-cue reject_all receipt at both stages.");

  const invalidation=await assessWorldSimulationNativeCausalEpochSupersession({
    session_id,turn_id,world_state,world_state_revision,world_state_hash,
    event,scene_analysis,observer,
    original_selected_action_intents,revised_selected_action_intents,
  });
  if (invalidation.status!=="source_not_released_in_revised_execution"
      || invalidation.obsolete_preparation_must_not_authorize_new_action!==true)
    reject("The prior source must be absent from the revised canonical World execution.");

  // Deliberately pass no old epoch, consumed_epoch_ids, preparation or
  // old Character Brain packet: the revised source is a fresh World epoch.
  const replay=await replayWorldSimulationNativeTemporalResponse({
    session_id,turn_id,world_state,world_state_revision,world_state_hash,
    event,scene_analysis,observer,
    selected_action_intents:copy(revised_selected_action_intents),
    character_input_resolver,selection_resolver,
    ...(preparation_decision_resolver
      ? {preparation_decision_resolver} : {}),
  });
  if (replay.status!=="replayed_same_turn"
      || replay.initial_selected_action_intents === undefined
      || JSON.stringify(replay.initial_selected_action_intents)
        !== JSON.stringify(revised_selected_action_intents)
      || !record(replay.native_temporal_response)
      || replay.native_temporal_response.world_committed!==false
      || replay.native_temporal_response.source_pre_turn_state_hash!==world_state_hash)
    reject("Fresh revised source has no independently replayed same-turn selected response.");
  const payload={
    schema_version:worldSimulationNativeSourceReentryVersion,
    status:"provisional_new_observer_epoch_only",
    source_original_receipt_bundle_hash:originalReceiptHash,
    source_revised_receipt_bundle_hash:revisedReceiptHash,
    source_invalidation_audit_hash:invalidation.audit_hash,
    original_world_state_hash:world_state_hash,
    observer_ref:"observer_"+hashAgentRunValue(observer).slice(0,24),
    new_response_epoch_id:replay.native_temporal_response.source_epoch_id,
    new_response_action_id:replay.native_temporal_response.action_id,
    new_response_release_time_ms:replay.native_temporal_response.start_time_ms,
    old_preparation_reused:false,
    prior_committed_sound_retracted:false,
    world_commit_performed:false,
    requires_fresh_broker_world_authority:true,
  };
  return {
    audit:{...payload,audit_hash:hashAgentRunValue(payload)},
    engine_private_replay:replay,
  };
}
