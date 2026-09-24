import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationNominatedTransitionAuthorizationVersion as nominatedVersion,
} from "../../server/src/world-simulation-communication-nominated-transition-authorization-service.mjs";
import {
  worldSimulationOpenFloorTransitionAuthorizationVersion as openVersion,
} from "../../server/src/world-simulation-communication-open-floor-transition-authorization-service.mjs";
import {
  buildWorldSimulationTurnAuthorizationReentry as build,
  prioritizeWorldSimulationAuthorizedSpeakerDecision as prioritize,
} from "../../server/src/world-simulation-communication-turn-authorization-reentry-service.mjs";

const obs=(version,character)=>
  `observer_${hashAgentRunValue({version,value:character}).slice(0,24)}`;
const nominated=(character)=>({
  schema_version:nominatedVersion,
  status:"nominated_future_transition_authorized",
  convergent_nomination_candidate_count:1,
  next_speaker_selected:true,
  selected_transition:{
    authorization_ref:"nominated_transition_aaaaaaaaaaaaaaaaaaaaaaaa",
    source_ref:"source_aaaaaaaaaaaaaaaaaaaaaaaa",
    observer_ref:obs(nominatedVersion,character),
    public_signal_ref:"public_turn_signal_aaaaaaaaaaaaaaaaaaaaaaaa",
    release_time_ms:100,
    authorization:"future_nominated_turn_selected",
    actual_floor_awarded:false,
    response_emitted:false,
  },
  boundaries:{},
});
const open=(character)=>({
  schema_version:openVersion,
  status:"open_floor_future_transition_authorized",
  self_selection_candidate_count:1,
  distinct_candidate_observer_count:1,
  next_speaker_selected:true,
  selected_transition:{
    authorization_ref:"open_floor_transition_bbbbbbbbbbbbbbbbbbbbbbbb",
    source_ref:"source_bbbbbbbbbbbbbbbbbbbbbbbb",
    observer_ref:obs(openVersion,character),
    release_time_ms:100,
    authorization:"future_open_floor_self_selection",
    actual_floor_awarded:false,
    response_emitted:false,
  },
  boundaries:{},
});

const history=(turn)=>({turns:[{turn_id:"turn_1",...turn}]});
const selected=build({
  world_history:history({
    communication_nominated_transition_authorization:nominated("B"),
    communication_open_floor_transition_authorization:null,
  }),
  current_turn_id:"turn_2",
  current_characters:["A","B","C"],
});
assert.equal(selected.audit.status,"prior_next_speaker_authorization_reentered");
assert.equal(selected.audit.authorization_kind,"nominated");
assert.equal(selected.audit.participant_match_count,1);
assert.equal(selected.audit.decision_priority_applied,true);
assert.equal(selected.engine_private_reentry.selected_character,"B");
assert.equal(selected.engine_private_reentry.decision_priority_required,true);
assert.equal(selected.audit.boundaries.character_brain_input_modified,false);
assert.equal(selected.audit.boundaries.expression_forced,false);
assert.equal(selected.audit.boundaries.floor_claim_emitted,false);
assert.equal(JSON.stringify(selected.audit).includes('"B"'),false);
assert.equal(JSON.stringify(selected.audit).includes('"A"'),false);

const decisions=[
  {decision_kind:"action",character_input:{character:"A",secret:"a"}},
  {decision_kind:"action",character_input:{character:"B",secret:"b"}},
  {decision_kind:"action",character_input:{character:"C",secret:"c"}},
];
const ordered=prioritize({decision_inputs:decisions,reentry:selected});
assert.deepEqual(ordered.map(x=>x.character_input.character),["B","A","C"]);
assert.deepEqual(decisions.map(x=>x.character_input.character),["A","B","C"]);
assert.equal(ordered[0].character_input.turn_authorization,undefined);

const opened=build({
  world_history:history({
    communication_nominated_transition_authorization:null,
    communication_open_floor_transition_authorization:open("C"),
  }),
  current_turn_id:"turn_2",
  current_characters:["A","B","C"],
});
assert.equal(opened.audit.authorization_kind,"open_floor");
assert.equal(opened.engine_private_reentry.selected_character,"C");
assert.deepEqual(
  prioritize({decision_inputs:decisions,reentry:opened})
    .map(x=>x.character_input.character),
  ["C","A","B"],
);

const none=build({
  world_history:history({
    communication_nominated_transition_authorization:{
      ...nominated("B"),status:"no_nominated_transition_authorized",
      next_speaker_selected:false,selected_transition:null,
    },
    communication_open_floor_transition_authorization:{
      ...open("C"),status:"no_open_floor_transition_authorized",
      next_speaker_selected:false,selected_transition:null,
    },
  }),
  current_turn_id:"turn_2",
  current_characters:["A","B","C"],
});
assert.equal(none.audit.status,"no_prior_next_speaker_authorization");
assert.equal(none.engine_private_reentry.selected_character,null);
assert.deepEqual(prioritize({decision_inputs:decisions,reentry:none}),decisions);

const bootstrap=build({
  world_history:{turns:[]},
  current_turn_id:"turn_1",
  current_characters:["A","B"],
});
assert.equal(bootstrap.audit.status,"no_prior_committed_turn");

assert.throws(()=>build({
  world_history:history({
    communication_nominated_transition_authorization:nominated("B"),
    communication_open_floor_transition_authorization:open("C"),
  }),
  current_turn_id:"turn_2",current_characters:["A","B","C"],
}),/cannot authorize two next speakers/u);
assert.throws(()=>build({
  world_history:history({
    communication_nominated_transition_authorization:nominated("Z"),
    communication_open_floor_transition_authorization:null,
  }),
  current_turn_id:"turn_2",current_characters:["A","B"],
}),/match exactly one current participant/u);
assert.throws(()=>build({
  world_history:history({
    communication_nominated_transition_authorization:nominated("B"),
    communication_open_floor_transition_authorization:null,
  }),
  current_turn_id:"turn_1",current_characters:["A","B"],
}),/current turn/u);
assert.throws(()=>build({
  world_history:history({
    communication_nominated_transition_authorization:{
      ...nominated("B"),schema_version:"foreign",
    },
  }),
  current_turn_id:"turn_2",current_characters:["A","B"],
}),/not canonical/u);
assert.throws(()=>prioritize({
  decision_inputs:[decisions[0],decisions[2]],reentry:selected,
}),/exactly one formal decision input/u);

console.log("CC-7X committed turn authorization re-entry tests passed.");
