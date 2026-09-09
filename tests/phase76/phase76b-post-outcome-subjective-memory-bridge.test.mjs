import assert from "node:assert/strict";

import {
  buildWorldSimulationPostOutcomeSubjectiveMemoryBridgeContract,
  bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory,
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion,
} from "../../server/src/world-simulation-post-outcome-subjective-memory-bridge-service.mjs";
import {
  projectWorldSimulationPostOutcomeSubjectivePerception,
} from "../../server/src/world-simulation-post-outcome-subjective-perception-service.mjs";
import {
  buildWorldSimulationSubjectiveMemoryFormationContract,
  formWorldSimulationSubjectiveMemories,
} from "../../server/src/world-simulation-subjective-memory-formation-service.mjs";
import {
  buildWorldSimulationSubjectiveClaimResolverView,
} from "../../server/src/world-simulation-subjective-claim-projection-service.mjs";

const character = "伊萊亞斯・諾爾";
const turnId = "phase76b-turn-001";
const actionId = "phase76b-open-door";
const selected = [{
  character,
  selection: "candidate_action_intent",
  action_id: actionId,
  intent: "推開眼前的門",
}];

const phase76a = projectWorldSimulationPostOutcomeSubjectivePerception({
  turn_id: turnId,
  selected_action_intents: selected,
  action_outcomes: [{
    actor: character,
    action_id: actionId,
    result: "blocked_by_hidden_seventh_rank_seal",
    causal_evidence: "engine-only hidden seal truth",
    exact_force_newtons: 4321,
    character_experience: {
      performed: true,
      perceived_result: "門沒有打開",
      perceived_status: "受阻",
    },
  }, {
    actor: "夜",
    action_id: "private-other-action",
    result: "private_other_result",
    character_experience: {
      performed: true,
      perceived_result: "只有夜自己知道的結果",
    },
  }],
  state_transitions: [],
});

const bridge = bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
  turn_id: turnId,
  selected_action_intents: selected,
  post_outcome_subjective_perception_projection: phase76a,
});

assert.equal(bridge.version, worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion);
assert.equal(bridge.status, "bounded_post_outcome_subjective_memory_input_available");
assert.equal(bridge.memory_formation_packets.length, 1);
assert.equal(bridge.memory_formation_packets[0].character, character);
assert.equal(bridge.memory_formation_packets[0].perception.other_senses.length, 1);

const boundedExperience = bridge.memory_formation_packets[0].perception.other_senses[0];
assert.equal(boundedExperience.kind, "post_outcome_action_experience");
assert.equal(boundedExperience.action, "推開眼前的門");
assert.equal(boundedExperience.performed, true);
assert.equal(boundedExperience.perceived_result, "門沒有打開");
assert.equal(boundedExperience.perceived_status, "受阻");

const serializedBridge = JSON.stringify(bridge);
assert.equal(serializedBridge.includes("blocked_by_hidden_seventh_rank_seal"), false);
assert.equal(serializedBridge.includes("engine-only hidden seal truth"), false);
assert.equal(serializedBridge.includes("4321"), false);
assert.equal(serializedBridge.includes("private_other_result"), false);
assert.equal(serializedBridge.includes("只有夜自己知道的結果"), false);

const worldState = {
  simulation_time: "2026-09-09T04:00:00.000Z",
  characters: {
    [character]: {},
  },
  memories: {},
};
const event = {
  event_id: "phase76b-event-001",
  scene_id: "phase76b-scene-001",
  simulation_time: worldState.simulation_time,
};
const formation = formWorldSimulationSubjectiveMemories({
  world_state: worldState,
  turn_id: turnId,
  event,
  decision_packets: bridge.memory_formation_packets,
  encoding_decisions: [],
  episode_bindings: [],
});

assert.equal(formation.result.created_memory_count, 1);
const memory = formation.result.character_updates[0].memory_records[0];
assert.equal(memory.memory_type, "episodic_action_experience");
assert.equal(memory.source.kind, "post_outcome_subjective_experience");
assert.equal(memory.source.sense, "other");
assert.equal(memory.content.kind, "post_outcome_action_experience");
assert.equal(memory.content.action, "推開眼前的門");
assert.equal(memory.content.performed, true);
assert.equal(memory.content.perceived_result, "門沒有打開");
assert.equal(memory.content.perceived_status, "受阻");
assert.equal(memory.subjective_memory_not_world_truth, true);
assert.equal(memory.internal_provenance.post_outcome_bridge_version,
  worldSimulationPostOutcomeSubjectiveMemoryBridgeVersion);
assert.equal(
  memory.internal_provenance.post_outcome_subjective_perception_ref,
  phase76a.character_experiences[0].subjective_perception_ref,
);
assert.ok(memory.internal_provenance.post_outcome_subjective_perception_hash);

const serializedMemoryContent = JSON.stringify(memory.content);
assert.equal(serializedMemoryContent.includes(actionId), false);
assert.equal(serializedMemoryContent.includes("phase76a_post_outcome_"), false);
assert.equal(serializedMemoryContent.includes("internal_"), false);
assert.equal(serializedMemoryContent.includes("blocked_by_hidden_seventh_rank_seal"), false);
assert.equal(serializedMemoryContent.includes("engine-only hidden seal truth"), false);

const persistedState = {
  ...worldState,
  memories: {
    [character]: [memory],
  },
};
const claimResolverView = buildWorldSimulationSubjectiveClaimResolverView({
  world_state: persistedState,
  turn_id: turnId,
  source_memory_records: [{
    character,
    memory_record: memory,
  }],
});
assert.equal(claimResolverView.character_evidence.length, 1);
assert.equal(claimResolverView.character_evidence[0].memories.length, 1);
assert.equal(
  claimResolverView.character_evidence[0].memories[0].source.kind,
  "post_outcome_subjective_experience",
);
assert.equal(
  claimResolverView.character_evidence[0].memories[0].content.perceived_result,
  "門沒有打開",
);
assert.equal(JSON.stringify(claimResolverView).includes(actionId), false);
assert.equal(JSON.stringify(claimResolverView).includes("engine-only hidden seal truth"), false);

const tampered = structuredClone(phase76a);
tampered.character_experiences[0].experience.perceived_status = "被竄改";
assert.throws(
  () => bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
    turn_id: turnId,
    selected_action_intents: selected,
    post_outcome_subjective_perception_projection: tampered,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SOURCE_HASH_MISMATCH",
);

assert.throws(
  () => bridgeWorldSimulationPostOutcomeSubjectiveExperienceToMemory({
    turn_id: turnId,
    selected_action_intents: [{
      character,
      selection: "candidate_action_intent",
      action_id: "different-action",
      intent: "另一個行動",
    }],
    post_outcome_subjective_perception_projection: phase76a,
  }),
  (error) => error?.code
    === "WORLD_SIMULATION_POST_OUTCOME_SUBJECTIVE_MEMORY_SELECTION_UNRESOLVED",
);

const bridgeContract = buildWorldSimulationPostOutcomeSubjectiveMemoryBridgeContract();
assert.equal(bridgeContract.raw_action_outcomes_exposed, false);
assert.equal(bridgeContract.raw_world_state_exposed, false);
assert.equal(bridgeContract.direct_subjective_memory_write, false);
assert.equal(bridgeContract.direct_subjective_claim_or_belief_write, false);
assert.equal(bridgeContract.same_turn_character_brain_feedback_allowed, false);
assert.equal(bridgeContract.output_target, "existing_phase63_subjective_memory_formation");

const memoryContract = buildWorldSimulationSubjectiveMemoryFormationContract();
assert.equal(memoryContract.post_outcome_perception_capture_modeled, true);
assert.equal(memoryContract.same_turn_retroactive_memory_use_allowed, false);
assert.equal(memoryContract.persisted_memory_is_subjective_not_world_truth, true);

console.log("Phase76B post-outcome subjective memory bridge tests passed.");
