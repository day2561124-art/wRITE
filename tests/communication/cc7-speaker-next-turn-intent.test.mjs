import assert from "node:assert/strict";
import {
  runWorldSimulationSpeakerNextTurnIntent,
  buildWorldSimulationSpeakerNextTurnIntentContract,
  worldSimulationSpeakerNextTurnIntentVersion,
} from "../../server/src/world-simulation-communication-speaker-next-turn-intent-service.mjs";

function emitted(actor = "A", addressee = "B", actionId = "communication_abcd", surface = "私密原始語句") {
  return {
    actor, action_id: actionId,
    result: "communication_emitted", duration_ms: 250,
    communication_event: {
      schema_version: "cc1-world-communication-event-v1",
      actor, addressee, channel: "speech", speech_act: "question",
      semantic_content: "語意私密", surface_text: surface,
      surface_realization_complete: true,
      surface_realization: {
        source_action_id: actionId, surface_text: surface,
      },
    },
  };
}
const source = emitted();
const contract = buildWorldSimulationSpeakerNextTurnIntentContract();
assert.equal(contract.addressee_is_not_automatic_nomination, true);
assert.equal(contract.speech_act_is_not_automatic_nomination, true);
assert.equal(contract.nomination_requires_explicit_same_speaker_choice, true);
assert.equal(contract.actual_floor_awarded, false);
assert.equal(contract.actual_public_invitation_emitted, false);
assert.equal(contract.fixed_gap_threshold_used, false);

const noResolver = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [source],
});
assert.equal(noResolver.audit.eligible_emitted_speech_count, 1);
assert.equal(noResolver.audit.status, "resolver_not_installed");
assert.equal(noResolver.audit.nomination_count, 0);
assert.deepEqual(noResolver.engine_private_intentions, []);

const packets = [];
const nominate = () => runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [source],
  resolver: async (packet) => {
    packets.push(structuredClone(packet));
    return { mode: "nominate_addressee", target: "B" };
  },
});
const first = await nominate();
assert.deepEqual(first, await nominate());
assert.equal(first.audit.schema_version, worldSimulationSpeakerNextTurnIntentVersion);
assert.equal(first.audit.eligible_emitted_speech_count, 1);
assert.equal(first.audit.decision_count, 1);
assert.equal(first.audit.nomination_count, 1);
assert.equal(first.audit.decisions[0].world_floor_awarded, false);
assert.equal(first.audit.decisions[0].public_invitation_emitted, false);
assert.equal(first.engine_private_intentions[0].actor, "A");
assert.equal(first.engine_private_intentions[0].intended_next_speaker, "B");
assert.equal(first.engine_private_intentions[0].world_floor_awarded, false);
assert.equal(packets[0].actor, "A");
assert.equal(packets[0].current_public_addressee, "B");
assert.equal(packets[0].world_turn_status, "post_causal_precommit");
for (const value of [source.communication_event.surface_text,
  source.communication_event.semantic_content, '"speech_act":', '"surface_text":']) {
  assert.equal(JSON.stringify(packets[0]).includes(value), false);
  assert.equal(JSON.stringify(first.audit).includes(value), false);
}
const retain = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [source],
  resolver: async () => ({ mode: "retain_turn" }),
});
assert.equal(retain.audit.retain_turn_count, 1);
assert.equal(retain.audit.nomination_count, 0);
assert.equal(retain.engine_private_intentions[0].intended_next_speaker, null);
const yieldOpen = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [source],
  resolver: async () => ({ mode: "yield_open_floor" }),
});
assert.equal(yieldOpen.audit.open_floor_yield_count, 1);
assert.equal(yieldOpen.engine_private_intentions[0].intended_next_speaker, null);
assert.equal(yieldOpen.audit.boundaries.actual_floor_awarded, false);
const noDecision = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [source], resolver: async () => null,
});
assert.equal(noDecision.audit.decision_count, 0);
assert.equal(noDecision.audit.nomination_count, 0);

const legacyUnrealized = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [
    {...source, communication_event: {
      ...source.communication_event,
      surface_realization_complete: false, surface_realization: undefined,
      surface_text: undefined,
    }},
  ],
  resolver: async () => { throw Error("unrealized CC-1 speech must not invoke CC-7Q"); },
});
assert.equal(legacyUnrealized.audit.eligible_emitted_speech_count, 0);
assert.equal(legacyUnrealized.audit.decision_count, 0);
const filtered = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [
    { ...source, result: "blocked" },
    { ...source, communication_event: { ...source.communication_event,
      channel: "nonverbal" } },
  ],
  resolver: async () => { throw Error("non-speech callback should not fire"); },
});
assert.equal(filtered.audit.eligible_emitted_speech_count, 0);
assert.equal(filtered.audit.decision_count, 0);
const many = await runWorldSimulationSpeakerNextTurnIntent({
  action_outcomes: [
    emitted("C", "D", "z_action"), emitted("A", "B", "a_action"),
  ],
  resolver: async ({ actor, current_public_addressee }) => ({
    mode: "nominate_addressee", target: current_public_addressee,
  }),
});
assert.deepEqual(many.engine_private_intentions.map((e) => e.actor), ["A", "C"]);
assert.equal(many.audit.nomination_count, 2);
assert.equal(many.engine_private_intentions[0].world_action_replanned, false);
const rejects = async (outcomes, decision, pattern) => {
  await assert.rejects(
    runWorldSimulationSpeakerNextTurnIntent({
      action_outcomes: outcomes,
      resolver: async () => decision,
    }), pattern);
};
await rejects([source], { mode: "nominate_addressee" },
  /Only explicit nomination/u);
await rejects([source], { mode: "nominate_addressee", target: "C" },
  /Only explicit nomination/u);
await rejects([source], { mode: "retain_turn", target: "B" },
  /Only explicit nomination/u);
await rejects([source], { mode: "yield_open_floor", target: "B" },
  /Only explicit nomination/u);
await rejects([source], { mode: "nominate_addressee", target: "B",
  other_observer_state: "secret" }, /non-contract fields/u);
await rejects([source], { mode: "give_floor", target: "B" },
  /Unsupported speaker next-turn/u);
await rejects([source, source], { mode: "retain_turn" },
  /Duplicate selected speech action/u);
await rejects([emitted("A","A")], {mode:"retain_turn"},
  /internally linked emitted/u);
await rejects([{...source,communication_event:{
  ...source.communication_event,actor:"C",
}}],{mode:"retain_turn"},/internally linked emitted/u);
await rejects([{...source,communication_event:{
  ...source.communication_event, surface_realization:{
    ...source.communication_event.surface_realization,source_action_id:"foreign",
  },
}}],{mode:"retain_turn"},/internally linked emitted/u);
await rejects([{...source,duration_ms:0}],{mode:"retain_turn"},
  /internally linked emitted/u);
await assert.rejects(
  runWorldSimulationSpeakerNextTurnIntent({
    action_outcomes:[source],resolver:"not_function",
  }),/speaker-scoped function/u);

console.log("CC-7Q speaker-scoped next-turn intention tests passed.");
