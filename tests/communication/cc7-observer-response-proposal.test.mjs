import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "../../server/src/world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "../../server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs";
import { prepareWorldSimulationObserverTemporalEpoch } from "../../server/src/world-simulation-observer-prepared-epoch-service.mjs";
import {
  runWorldSimulationObserverResponseProposal,
  buildWorldSimulationObserverResponseProposalContract,
} from "../../server/src/world-simulation-observer-response-proposal-service.mjs";

const pre = { scene_state: { scene_id: "room" }, hidden: "WORLD_PRIVATE_SECRET" };
const cue = {
  observer: "B", signal_ref: "signal-B", increment_ref: "B_FIRST",
  signal_phase: "ongoing", perceived_cue_refs: ["B_FIRST"],
  heard_surface_fragment: null, perceived_speaker: null,
  lexical_intelligibility_attested: false, speaker_identity_recognized: false,
  no_future_increment_exposed: true,
};
const ledgerPayload = {
  schema_version: worldSimulationObserverMicrotickLedgerVersion,
  ticks: [{ release_time_ms: 100, observer_cues: [
    { observer: "B", observer_increment: cue },
  ] }],
  tick_count: 1, admitted_cue_count: 1, boundaries: {},
};
const ledger = { ...ledgerPayload, ledger_hash: hashAgentRunValue(ledgerPayload) };
const prefixHash = hashAgentRunValue(pre);
const reconstruction = {
  audit: {
    schema_version: worldSimulationObserverTickPrefixReconstructionVersion,
    status: "engine_private_prefixes_reconstructed",
    readiness_ledger_hash: ledger.ledger_hash,
    source_execution_hash: "causal-resolution-A",
    ticks: [{
      release_time_ms: 100, reconstructed_world_state_hash: prefixHash,
      source_pre_turn_world_state_hash: prefixHash, mutation_prefix_ref: "prefix-0",
    }],
  },
  engine_snapshots: [{
    release_time_ms: 100, world_state: pre,
    reconstructed_world_state_hash: prefixHash, mutation_prefix_ref: "prefix-0",
  }],
};
const epochContext = {
  session_id: "session-1", turn_id: "turn-8", world_state_revision: 7,
  pre_turn_world_state: pre, ledger, reconstruction, scene_id: "room",
  observer: "B",
};
const presented = prepareWorldSimulationObserverTemporalEpoch(epochContext);
const characterInput = {
  character: "B",
  cognition: {
    communication_goal: {
      character: "B", addressee: "A", purpose: "表達正在聽",
      mode: "direct", public_content: "嗯，我在聽。",
    },
    private_belief: "B_PRIVATE_BELIEF",
  },
};
const bind = (input, epoch = presented) => ({
  session_id: epoch.session_id,
  turn_id: epoch.turn_id,
  world_state_revision: epoch.world_state_revision,
  epoch_id: epoch.epoch_id,
  source_prefix_hash: epoch.source_prefix_hash,
  character_input_hash: hashAgentRunValue(input),
});
const calls = [];
const choose = async (view) => {
  calls.push(view);
  assert.equal(view.observer, "B");
  assert.deepEqual(view.observer_view.heard_nonlexical[0].perceived_cue_refs, ["B_FIRST"]);
  assert.equal(view.candidate_action_intents.length, 1);
  assert.equal(JSON.stringify(view).includes("WORLD_PRIVATE_SECRET"), false);
  assert.equal(JSON.stringify(view).includes("B_PRIVATE_BELIEF"), false);
  assert.equal(JSON.stringify(view).includes('"cognition":'), false);
  return { epoch_id: view.epoch_id, action_id: view.candidate_action_intents[0].action_id };
};
const args = {
  epoch_context: epochContext, presented_epoch: presented,
  character_input: characterInput, character_input_binding: bind(characterInput),
  selection_resolver: choose,
};
const result = await runWorldSimulationObserverResponseProposal(args);
assert.equal(calls.length, 1);
assert.equal(result.proposal_status, "selected_for_future_causal_resolution");
assert.equal(result.selected_candidate.communication.message.semantic_content, "嗯，我在聽。");
assert.equal(result.boundaries.world_causal_insertion_performed, false);
assert.equal(result.boundaries.selected_candidate_is_not_an_emitted_signal, true);
assert.equal(buildWorldSimulationObserverResponseProposalContract().floor_awarded, false);
assert.deepEqual(result.consumed_epoch_ids, [presented.epoch_id]);
assert.deepEqual(result, await runWorldSimulationObserverResponseProposal(args));
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, consumed_epoch_ids: result.consumed_epoch_ids,
}), /already consumed/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, epoch_context: { ...epochContext, world_state_revision: 8 },
}), /current exact observer epoch/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, character_input: { ...characterInput, character: "A" },
}), /same-character/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, character_input_binding: { ...bind(characterInput), turn_id: "old-turn" },
}), /freshly bound/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, character_input: {
    ...characterInput,
    cognition: { ...characterInput.cognition, private_belief: "ALTERED" },
  },
}), /freshly bound/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, selection_resolver: async () => ({
    epoch_id: presented.epoch_id, action_id: "communication_forged",
  }),
}), /not the current canonical/u);
await assert.rejects(() => runWorldSimulationObserverResponseProposal({
  ...args, selection_resolver: async () => ({
    epoch_id: presented.epoch_id, action_id: "communication_forged",
    result: "emitted",
  }),
}), /non-contract fields/u);
const noClaimBasis = {
  character: "B",
  cognition: { communication_goal: {
    character: "B", addressee: "A", purpose: "報告", mode: "direct",
    public_content: "我知道秘密", claim_kind: "sincere_assertion",
  }, known: [] },
};
const rejected = await runWorldSimulationObserverResponseProposal({
  ...args, character_input: noClaimBasis,
  character_input_binding: bind(noClaimBasis),
  selection_resolver: async (view) => {
    assert.deepEqual(view.candidate_action_intents, []);
    return { epoch_id: view.epoch_id, reject_all: true };
  },
});
assert.equal(rejected.proposal_status, "rejected_all");
assert.equal(rejected.selected_candidate, null);
assert.equal(rejected.boundaries.world_mutation_performed, false);
assert.deepEqual(pre, { scene_state: { scene_id: "room" }, hidden: "WORLD_PRIVATE_SECRET" });
console.log("CC-7AC observer response proposal tests passed.");
