import assert from "node:assert/strict";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import {
  worldSimulationNominatedTransitionAuthorizationVersion as nominatedVersion,
} from "../../server/src/world-simulation-communication-nominated-transition-authorization-service.mjs";
import {
  buildWorldSimulationTurnAuthorizationReentry,
} from "../../server/src/world-simulation-communication-turn-authorization-reentry-service.mjs";
import {
  buildWorldSimulationAuthorizedFloorClaim as build,
} from "../../server/src/world-simulation-communication-authorized-floor-claim-service.mjs";

const obs=(character)=>
  `observer_${hashAgentRunValue({
    version:nominatedVersion,value:character,
  }).slice(0,24)}`;

const authorization={
  schema_version:nominatedVersion,
  status:"nominated_future_transition_authorized",
  convergent_nomination_candidate_count:1,
  next_speaker_selected:true,
  selected_transition:{
    authorization_ref:"nominated_transition_aaaaaaaaaaaaaaaaaaaaaaaa",
    source_ref:"source_aaaaaaaaaaaaaaaaaaaaaaaa",
    observer_ref:obs("B"),
    public_signal_ref:"public_turn_signal_aaaaaaaaaaaaaaaaaaaaaaaa",
    release_time_ms:100,
    authorization:"future_nominated_turn_selected",
    actual_floor_awarded:false,
    response_emitted:false,
  },
  boundaries:{},
};
const worldHistory={turns:[{
  turn_id:"turn_1",
  communication_nominated_transition_authorization:authorization,
  communication_open_floor_transition_authorization:null,
}]};
const reentry=buildWorldSimulationTurnAuthorizationReentry({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
});

const actionId="communication_y_bbbbbbbbbbbbbbbb";
const selectedSpeech=[{
  character:"A",candidate:null,
},{
  character:"B",
  candidate:{
    action_id:actionId,
    communication:{
      channel:"speech",
      surface_realization_complete:true,
      message:{speech_act:"assert",semantic_content:"公開內容"},
    },
  },
}];
const emitted=[{
  actor:"B",action_id:actionId,result:"communication_emitted",
  communication_event:{
    actor:"B",channel:"speech",surface_text:"公開內容",
    surface_realization_complete:true,
    surface_realization:{
      source_action_id:actionId,
      surface_text:"公開內容",
    },
  },
}];

const awarded=build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:reentry,
  selected_action_intents:selectedSpeech,
  action_outcomes:emitted,
});
assert.deepEqual(awarded,build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:reentry,
  selected_action_intents:selectedSpeech,
  action_outcomes:emitted,
}));
assert.equal(awarded.audit.status,"authorized_floor_claim_awarded");
assert.equal(awarded.audit.authorized_speech_selected,true);
assert.equal(awarded.audit.communication_emitted,true);
assert.equal(awarded.audit.actual_floor_awarded,true);
assert.ok(awarded.audit.floor_claim_ref.startsWith("floor_claim_"));
assert.equal(awarded.engine_private_claim.selected_character,"B");
assert.equal(awarded.engine_private_claim.action_id,actionId);
assert.equal(awarded.engine_private_claim.authorization_consumed,true);
assert.equal(awarded.engine_private_claim.response_emitted,true);
assert.equal(awarded.audit.boundaries.floor_award_is_not_comprehension,true);
assert.equal(awarded.audit.boundaries.floor_award_is_not_grounding,true);
assert.equal(awarded.audit.boundaries.overlap_or_interruption_judged,false);
assert.equal(awarded.audit.boundaries.response_content_inferred,false);
assert.equal(JSON.stringify(awarded.audit).includes('"B"'),false);
assert.equal(JSON.stringify(awarded.audit).includes("公開內容"),false);

// A custom World adjudicator cannot turn a nominal emission into a floor
// claim when the public speech surface is absent or belongs to another action.
for(const event of [
  {...emitted[0].communication_event,surface_realization_complete:false},
  {...emitted[0].communication_event,surface_text:""},
  {...emitted[0].communication_event,surface_realization:{
    source_action_id:"foreign_action",surface_text:"公開內容",
  }},
  {...emitted[0].communication_event,surface_realization:{
    source_action_id:actionId,surface_text:"另一句話",
  }},
]) {
  const unverified=build({
    world_history:worldHistory,
    current_turn_id:"turn_2",
    current_characters:["A","B"],
    prepared_reentry:reentry,
    selected_action_intents:selectedSpeech,
    action_outcomes:[{...emitted[0],communication_event:event}],
  });
  assert.equal(unverified.audit.actual_floor_awarded,false);
  assert.equal(unverified.audit.communication_emitted,false);
  assert.equal(unverified.audit.status,"authorized_floor_claim_not_exercised");
}

// Authorization never forces expression. Rejecting all candidates consumes the
// one-turn opportunity without awarding the floor.
const declined=build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:reentry,
  selected_action_intents:[
    {character:"A",candidate:null},
    {character:"B",candidate:null},
  ],
  action_outcomes:[],
});
assert.equal(declined.audit.status,"authorized_floor_claim_not_exercised");
assert.equal(declined.audit.authorized_speech_selected,false);
assert.equal(declined.audit.communication_emitted,false);
assert.equal(declined.audit.actual_floor_awarded,false);
assert.equal(declined.engine_private_claim.authorization_consumed,true);

// Selecting speech is still insufficient if World did not emit that exact
// communication action.
const failedEmission=build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:reentry,
  selected_action_intents:selectedSpeech,
  action_outcomes:[{
    actor:"B",action_id:actionId,result:"communication_blocked",
  }],
});
assert.equal(failedEmission.audit.authorized_speech_selected,true);
assert.equal(failedEmission.audit.communication_emitted,false);
assert.equal(failedEmission.audit.actual_floor_awarded,false);

// A non-speech selected action cannot consume the conversational floor.
const nonSpeech=build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:reentry,
  selected_action_intents:[
    {character:"A",candidate:null},
    {character:"B",candidate:{action_id:"move_b",type:"move"}},
  ],
  action_outcomes:[{actor:"B",action_id:"move_b",result:"moved"}],
});
assert.equal(nonSpeech.audit.authorized_speech_selected,false);
assert.equal(nonSpeech.audit.actual_floor_awarded,false);

// Engine-side prepared lineage cannot be tampered between formal preparation
// and resolution.
assert.throws(()=>build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  prepared_reentry:{
    ...reentry,
    engine_private_reentry:{
      ...reentry.engine_private_reentry,
      selected_character:"A",
    },
  },
  selected_action_intents:selectedSpeech,
  action_outcomes:emitted,
}),/does not match committed history/u);

// Direct/native resolution may reconstruct CC-7X from committed history when
// no formal prepared re-entry object exists.
const nativeAward=build({
  world_history:worldHistory,
  current_turn_id:"turn_2",
  current_characters:["A","B"],
  selected_action_intents:selectedSpeech,
  action_outcomes:emitted,
});
assert.equal(nativeAward.audit.actual_floor_awarded,true);

const noPrior=build({
  world_history:{turns:[]},
  current_turn_id:"turn_1",
  current_characters:["A","B"],
  selected_action_intents:[
    {character:"A",candidate:null},
    {character:"B",candidate:null},
  ],
  action_outcomes:[],
});
assert.equal(noPrior.audit.status,"no_prior_authorization_to_consume");
assert.equal(noPrior.audit.actual_floor_awarded,false);
assert.equal(noPrior.engine_private_claim.authorization_consumed,false);

console.log("CC-7Y authorized floor claim execution tests passed.");
