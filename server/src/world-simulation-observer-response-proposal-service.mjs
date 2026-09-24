import { hashAgentRunValue } from "./agent-run-service.mjs";
import { buildCharacterCommunicationActionCandidate } from "./character-communication-foundation-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "./world-simulation-observer-prepared-epoch-service.mjs";

export const worldSimulationObserverResponseProposalVersion =
  "cc7ac-observer-response-proposal-v1";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value ?? null));

function reject(message) {
  const error = new Error(message);
  error.code = "CC7AC_OBSERVER_RESPONSE_PROPOSAL_INVALID";
  throw error;
}
function exact(value, keys, label) {
  if (!record(value) || Object.keys(value).sort().join("|") !== keys.slice().sort().join("|"))
    reject(label + " has non-contract fields.");
}
export function buildWorldSimulationObserverResponseProposalContract() {
  return {
    version: worldSimulationObserverResponseProposalVersion,
    current_epoch_recomputed_from_engine_evidence: true,
    character_candidate_uses_existing_communication_provenance_gate: true,
    fresh_character_packet_epoch_binding_required: true,
    character_selection_is_fresh_and_optional: true,
    raw_character_cognition_forwarded_to_resolver: false,
    other_observer_view_forwarded: false,
    selected_candidate_is_not_an_emitted_signal: true,
    floor_awarded: false,
    world_causal_insertion_performed: false,
    world_mutation_performed: false,
  };
}

/**
 * Engine-private proposal boundary. epoch_context must be the current
 * authoritative inputs used by CC-7AB; character_input must be the freshly
 * prepared same-character Brain packet, never a World or other-character
 * record. The selection resolver is the character decision boundary.
 * A later World-owned scheduler must revalidate and causally resolve any
 * selected candidate before it may become an emitted action.
 */
export async function runWorldSimulationObserverResponseProposal({
  epoch_context, presented_epoch, character_input, character_input_binding,
  selection_resolver, consumed_epoch_ids = [],
} = {}) {
  const current = prepareWorldSimulationObserverTemporalEpoch(epoch_context);
  if (!current || !record(presented_epoch)
      || JSON.stringify(current) !== JSON.stringify(presented_epoch))
    reject("Response proposal requires the current exact observer epoch.");
  if (!record(character_input)
      || character_input.character !== current.observer
      || !record(character_input.cognition))
    reject("Only a fresh same-character Brain input can propose a response.");
  exact(character_input_binding, [
    "session_id", "turn_id", "world_state_revision", "epoch_id",
    "source_prefix_hash", "character_input_hash",
  ], "engine character input binding");
  if (character_input_binding.session_id !== current.session_id
      || character_input_binding.turn_id !== current.turn_id
      || character_input_binding.world_state_revision !== current.world_state_revision
      || character_input_binding.epoch_id !== current.epoch_id
      || character_input_binding.source_prefix_hash !== current.source_prefix_hash
      || character_input_binding.character_input_hash !== hashAgentRunValue(character_input))
    reject("Character Brain packet must be freshly bound to this observer epoch.");
  if (!Array.isArray(consumed_epoch_ids) || consumed_epoch_ids.length >= 32
      || consumed_epoch_ids.some((id) => typeof id !== "string")
      || consumed_epoch_ids.includes(current.epoch_id))
    reject("Prepared epoch was already consumed or its receipt budget is invalid.");
  if (typeof selection_resolver !== "function")
    reject("A fresh character selection resolver is required.");

  // The existing planner checks same-character semantic provenance,
  // withheld content and bounded surface realization. Acoustic admission
  // alone never authors a claim or turns a cue into understood testimony.
  const candidate = buildCharacterCommunicationActionCandidate({
    character: current.observer,
    cognition: copy(character_input.cognition),
    ...(record(character_input.perception)
      ? { perception: copy(character_input.perception) } : {}),
  });
  const selectionView = {
    schema_version: worldSimulationObserverResponseProposalVersion,
    epoch_id: current.epoch_id,
    observer: current.observer,
    release_time_ms: current.release_time_ms,
    observer_view: copy(current.observer_view),
    candidate_action_intents: candidate ? [copy(candidate)] : [],
    selection_boundary: "Select the exact candidate action_id or reject all; neither choice emits a World signal.",
  };
  const selected = await selection_resolver(copy(selectionView));
  exact(selected, ["epoch_id", candidate && selected?.reject_all === true
    ? "reject_all" : candidate ? "action_id" : "reject_all"], "character response selection");
  if (selected.epoch_id !== current.epoch_id)
    reject("Character response selection belongs to a stale epoch.");
  if (selected.reject_all === true) {
    return copy({
      schema_version: worldSimulationObserverResponseProposalVersion,
      epoch_id: current.epoch_id,
      observer: current.observer,
      proposal_status: "rejected_all",
      selected_candidate: null,
      consumed_epoch_ids: [...consumed_epoch_ids, current.epoch_id],
      boundaries: buildWorldSimulationObserverResponseProposalContract(),
    });
  }
  if (!candidate || selected.action_id !== candidate.action_id)
    reject("Selected action is not the current canonical same-character candidate.");
  return copy({
    schema_version: worldSimulationObserverResponseProposalVersion,
    epoch_id: current.epoch_id,
    observer: current.observer,
    proposal_status: "selected_for_future_causal_resolution",
    proposal_id: "observer_proposal_" + hashAgentRunValue({
      version: worldSimulationObserverResponseProposalVersion,
      epoch_id: current.epoch_id,
      candidate_action_id: candidate.action_id,
      character_input_hash: hashAgentRunValue(character_input),
    }).slice(0, 32),
    selected_candidate: candidate,
    consumed_epoch_ids: [...consumed_epoch_ids, current.epoch_id],
    boundaries: buildWorldSimulationObserverResponseProposalContract(),
  });
}
