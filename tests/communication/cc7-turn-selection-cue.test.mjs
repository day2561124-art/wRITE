import assert from "node:assert/strict";
import {
  projectCharacterCommunicationTurnProjection,
} from "../../server/src/character-communication-turn-projection-service.mjs";
import {
  projectCharacterCommunicationTurnSelectionCue,
  buildCharacterCommunicationTurnSelectionCueContract,
} from "../../server/src/character-communication-turn-selection-cue-service.mjs";
import {
  runWorldSimulationTurnIncrementHandoff,
  worldSimulationTurnIncrementHandoffVersion,
} from "../../server/src/world-simulation-communication-turn-increment-handoff-service.mjs";
import {
  buildWorldSimulationFloorOpportunityLedger,
} from "../../server/src/world-simulation-communication-floor-opportunity-ledger-service.mjs";

const observer = "B";
function projection(n, prior = null) {
  const cue = `heard_cue_${n}`;
  return projectCharacterCommunicationTurnProjection({
    observer,
    perceived_speech_increment: {
      schema_version: "cc7-observer-speech-increment-v1",
      observer, speaker: "anonymous_voice_B", signal_ref: "signal_B",
      increment_ref: `increment_${n}`,
      heard_surface_fragment: "你呢",
      signal_phase: "ongoing", perceived_cue_refs: [cue],
    },
    listener_decision: {
      turn_end_projection: "uncertain", projection_basis_refs: [],
      response_preparation: "none",
    },
    prior_state: prior,
  });
}
const p1 = projection(1);
const p2 = projection(2, p1);
const choose = (p, d, prior = null, meaning = null) =>
  projectCharacterCommunicationTurnSelectionCue({
    observer, turn_projection: p,
    meaning_interpretation: meaning,
    selection_decision: d,
    prior_state: prior,
  });
const contract = buildCharacterCommunicationTurnSelectionCueContract();
assert.equal(contract.selected_me_is_subjective_hypothesis_only, true);
assert.equal(contract.actual_floor_awarded, false);
assert.equal(contract.real_speaker_identity_available, false);
const first = choose(p1, {
  status: "selected_me", basis_refs: ["heard_cue_1"],
});
assert.deepEqual(first, choose(p1, {
  status: "selected_me", basis_refs: ["heard_cue_1"],
}));
assert.equal(first.status, "selected_me");
assert.equal(first.actual_speaker_intent_claimed, false);
assert.equal(first.addressee_established, false);
assert.equal(first.floor_awarded, false);
assert.equal(first.world_signal_emitted, false);
const second = choose(p2, {
  status: "uncertain", basis_refs: [],
}, first);
assert.equal(second.prior_selection_cue_id, first.selection_cue_id);
assert.equal(second.revises_prior_selection_cue, true);
assert.equal(second.floor_awarded, false);
const none = choose(p1, {
  status: "no_selection_evidence", basis_refs: [],
});
assert.equal(none.status, "no_selection_evidence");
const meaning = {
  interpretation_id: "observer_meaning_local",
  interpretation_status: "partial", interpreted_content: "似乎叫我",
  interpreted_interaction_function: "possible_next_turn",
  understanding_attested: false, prior_interpretation_id: null,
  revises_prior_interpretation: false, subjective_only: true,
  grounding_claimed: false, belief_updated: false,
};
const withMeaning = choose(p1, {
  status: "selected_me", basis_refs: [meaning.interpretation_id],
}, null, meaning);
assert.equal(withMeaning.source_meaning_interpretation_id,
  meaning.interpretation_id);
assert.equal(withMeaning.floor_awarded, false);
const throws = (p, d, prior, m, re) =>
  assert.throws(() => choose(p, d, prior, m), re);
throws(p1, {status:"selected_me",basis_refs:[]},null,null,
  /requires observer-perceived evidence/u);
throws(p1, {status:"selected_me",basis_refs:["future"]},null,null,
  /current release/u);
throws(p1, {status:"selected_other",basis_refs:["other_observer"]},null,null,
  /current release/u);
throws(p1, {status:"selected_me",basis_refs:["heard_cue_1","heard_cue_1"]},
  null,null,/distinct/u);
throws(p1, {status:"speaker_selected_B",basis_refs:["heard_cue_1"]},
  null,null,/Unsupported subjective selection/u);
throws(p1, {status:"selected_me",basis_refs:["heard_cue_1"],
  speaker_intent:"secret"},null,null,/non-contract fields/u);
throws(p2, {status:"uncertain",basis_refs:[]}, {...first,observer:"C"},
  null,/projection lineage/u);
throws(p2, {status:"uncertain",basis_refs:[]},
  {...first,source_signal_ref:"other"},null,/projection lineage/u);
throws(p1, {status:"selected_me",basis_refs:["observer_meaning_local"]},
  null,null,/current release/u);
throws(p1, {status:"selected_me",basis_refs:["heard_cue_1"]},
  null,{...meaning,belief_updated:true},/listener-subjective/u);
throws({...p1,observer:"C"}, {status:"uncertain",basis_refs:[]},
  null,null,/same-observer/u);

const admitted = [1,2].map((n) => ({
  schema_version: "cc7c-observer-speech-increment-acoustic-admission-v1",
  observer, admission_status:"heard_acoustic_cues_only",
  release_time_ms:n*100,
  observer_increment:{
    schema_version:"cc7-observer-speech-increment-v1",
    observer, signal_ref:"signal_B",
    increment_ref:`increment_${n}`,
    heard_surface_fragment:null, perceived_speaker:null,
    lexical_intelligibility_attested:false,
    speaker_identity_recognized:false,
    release_time_ms:n*100,
    signal_phase:"ongoing",
    perceived_cue_refs:[`heard_cue_${n}`],
    no_future_increment_exposed:true,
  },
}));
const packets=[];
const handoff=await runWorldSimulationTurnIncrementHandoff({
  admissions:admitted,
  resolver:async(view)=>{
    packets.push(structuredClone(view));
    return {
      listener_decision:{
        turn_end_projection:"uncertain",projection_basis_refs:[],
        response_preparation:"none",
      },
      selection_cue_decision:packets.length===1
        ? {status:"selected_me",basis_refs:["heard_cue_1"]}
        : {status:"uncertain",basis_refs:[]},
    };
  },
});
assert.equal(handoff.schema_version,worldSimulationTurnIncrementHandoffVersion);
assert.equal(handoff.projected_count,2);
assert.equal(packets[0].prior_selection_cue,null);
assert.equal(packets[1].prior_selection_cue.status,"selected_me");
assert.equal(handoff.projections[0].selection_cue.status,"selected_me");
assert.equal(handoff.projections[1].selection_cue.status,"uncertain");
assert.equal(handoff.projections[1].selection_cue.prior_selection_cue_id,
  handoff.projections[0].selection_cue.selection_cue_id);
assert(handoff.projections.every((v)=>
  v.selection_cue.floor_awarded===false &&
  v.selection_cue.actual_speaker_intent_claimed===false &&
  v.actual_world_action_replanned===false));
const ledger = buildWorldSimulationFloorOpportunityLedger({ handoff });
assert.equal(ledger.audit.entry_count, 2);
assert.equal(ledger.audit.active_request_count, 0);
assert.equal(ledger.audit.boundaries.floor_winner_selected, false);
assert.throws(() => buildWorldSimulationFloorOpportunityLedger({
  handoff: {...handoff, projections: [
    {...handoff.projections[0], selection_cue: {
      ...handoff.projections[0].selection_cue,
      actual_speaker_intent_claimed: true,
    }},
    handoff.projections[1],
  ]},
}), /exceeds observer authority/u);
assert.throws(() => buildWorldSimulationFloorOpportunityLedger({
  handoff: {...handoff, projections: [
    {...handoff.projections[0], selection_cue: {
      ...handoff.projections[0].selection_cue, selection_cue_id: "forged",
    }},
    handoff.projections[1],
  ]},
}), /identity does not match/u);
await assert.rejects(
  runWorldSimulationTurnIncrementHandoff({
    admissions:admitted.slice(0,1),
    resolver:async()=>({
      listener_decision:{
        turn_end_projection:"uncertain",projection_basis_refs:[],
        response_preparation:"none",
      },
      selection_cue_decision:{status:"selected_me",
        basis_refs:["engine_future"]}
    })
  }),/current release/u);
console.log("CC-7O observer selection cue admission tests passed.");
