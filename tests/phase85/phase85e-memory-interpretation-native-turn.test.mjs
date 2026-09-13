import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fixture } from "./phase85-memory-interpretation-fixture.mjs";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationMemoryInterpretationTurn } from "../../server/src/world-simulation-memory-interpretation-turn-service.mjs";
import { buildWorldSimulationChronologicalMutationQueue, executeWorldSimulationChronologicalMutationQueue } from "../../server/src/world-simulation-chronological-mutation-queue-service.mjs";
import { runWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState, getWorldSimulationHistory } from "../../server/src/world-simulation-state-service.mjs";

function merge(left, right) {
  const mixed = structuredClone(left);
  for (const [key, value] of Object.entries(right)) {
    if (Array.isArray(value)) mixed[key] = [...(mixed[key] ?? []), ...value];
    else if (value && typeof value === "object") mixed[key] = { ...mixed[key], ...value };
  }
  return mixed;
}
const combined = merge(fixture("Alice"), fixture("Bob"));
delete combined.memory_reconsolidation_interpretation_update_events;
delete combined.memory_reconsolidation_interpretation_update_history;
const aliases = merge(fixture("Alice"), fixture("alice"));
delete aliases.memory_reconsolidation_interpretation_update_events;
delete aliases.memory_reconsolidation_interpretation_update_history;
const aliasProjection = buildWorldSimulationMemoryInterpretationTurn({ world_state: aliases, current_turn_id: "update" });
assert.equal(aliasProjection.summary.processed_character_count,1,"Case variants of the same character must not create separate life streams.");
assert.equal(aliasProjection.summary.created_event_count,2,"Two distinct memories produce two updates, not duplicate updates per spelling.");
const before = hashAgentRunValue(combined);
const built = buildWorldSimulationMemoryInterpretationTurn({ world_state: combined, current_turn_id: "update" });
assert.equal(hashAgentRunValue(combined), before);
assert.equal(built.summary.created_event_count, 2);
assert.equal(built.result.state_transitions.filter((t) => t.field === "memory_reconsolidation_interpretation_update_history").length, 1);
const queue = buildWorldSimulationChronologicalMutationQueue({ turn_id: "update", world_state_hash: before, state_transitions: built.result.state_transitions, elapsed_ms: 0 });
const executed = executeWorldSimulationChronologicalMutationQueue({ world_state: combined, preview_world_state: built.result.preview_world_state, queue });
assert.deepEqual(executed.next_world_state, built.result.preview_world_state);
const replay = buildWorldSimulationMemoryInterpretationTurn({ world_state: executed.next_world_state, current_turn_id: "update" });
assert.equal(replay.summary.already_persisted_event_count, 2);
assert.deepEqual(replay.result.state_transitions, []);
const absent = buildWorldSimulationMemoryInterpretationTurn({ world_state: {}, current_turn_id: "empty" });
assert.deepEqual(absent.result.preview_world_state, {});
assert.equal(absent.summary.created_event_count, 0);

// Bootstrap only existing life history: no interpretation update is preloaded.
const initial = structuredClone(combined);
initial.subjective_claim_history = initial.subjective_claim_history.filter((ref) => ref.source_turn_id === "prior");
initial.subjective_claim_events = Object.fromEntries(Object.entries(initial.subjective_claim_events).filter(([,event]) => event.source_turn_id === "prior"));
initial.subjective_claim_relation_history = [];
initial.subjective_claim_relation_events = {};
for (const character of ["Alice", "Bob"]) initial.memories[character] = initial.memories[character].filter((m) => m.memory_id === character + "old");
const originalMemories = structuredClone(initial.memories);
Object.assign(initial, {
  simulation_time: "2026-09-13T09:00:00+08:00", world_rules: { default_vision_range_m: 30 },
  event_queue: [1,2,3].map((i) => ({ event_id: "event85e-" + i, type: "observe_locked_door", scene_id: "scene85e", participants: ["Alice", "Bob"] })),
  scenes: { scene85e: { scene_id: "scene85e", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { Alice: { x: 0, y: 0 }, Bob: { x: 0, y: 1 }, Door: { x: 3, y: 0 } },
    visibility_profiles: Object.fromEntries(["Alice", "Bob"].map((name) => [name, { facing_degrees: 0, horizontal_fov_degrees: 120, eye_height_m: 1.6,
      illumination_thresholds_lux: { silhouette_min_lux: 1, dim_min_lux: 5, clear_min_lux: 20 } }])),
    perception_labels_by: { Alice: { Door: "Alice sees a locked door." }, Bob: { Door: "Bob sees a guarded door." } },
    obstacles: [], lighting: { ambient_lux: 30 }, sound_events: [], auditory_labels_by: {} } },
  characters: { Alice: { current_action: "observe", known: [] }, Bob: { current_action: "observe", known: [] } }, objects: { Door: {} },
  available_actions: Object.fromEntries(["Alice", "Bob"].map((name) => [name, [{ action_id: "wait", intent: "Observe before acting" }]])),
});
const fixtureRoot=path.join(projectRoot,"tests",".tmp","phase85e-"+process.pid+"-"+Date.now());
const options={fixtureRoot};
let round=1;
const brainViews=[];
const common={...options,
  characterBrain: async (packet) => { brainViews.push({ round, character: packet.character, context: structuredClone(packet.cognition.subjective_cognition.memory_interpretation_context ?? null) }); return { action_id: "wait" }; },
  subjectiveClaimResolver: async (input) => round > 2 ? [] : input.character_evidence.map((entry) => ({
    proposal_ref: entry.character + "-new-" + round, character: entry.character,
    proposition: entry.character + " reconsidered entry after observation " + round,
    evidence: [{ source_memory_ref: entry.memories[0].source_memory_ref, relation: "supports" }],
  })),
  subjectiveClaimRelationResolver: async (input) => round > 2 ? [] : input.character_claims.map((entry) => ({
    proposal_ref: entry.character + "-conflict-" + round, character: entry.character,
    source_claim_event_id: entry.current_turn_claims[0].claim_event_id,
    target_claim_event_id: entry.prior_claims.find((claim) => claim.proposition.includes("believed the door")).claim_event_id,
    relation: "challenges",
  })),
  causalAdjudicator: async (input) => {
    const next=structuredClone(input.world_state); next.event_queue=next.event_queue.slice(1);
    return { causal_resolution_id: "causal85e-"+input.event.event_id, next_world_state: next, state_transitions: [],
      action_outcomes: ["Alice","Bob"].map((actor)=>({actor,action_id:"wait",result:"observed",causal_evidence:"Fixture observations"})), knowledge_transitions: [], scheduled_events: [] };
  },
};
const priorMode=process.env.FILE_TRANSACTION_TEST_MODE;
try {
  const session=await beginWorldSimulationSession({ simulation_label:"Phase85E atomic continuity", seed:"phase85e", rules:{event_driven:true,persistent_causality:true}, initial_world_state:initial }, options);
  const id=session.world_simulation_session_id;
  const beforeState=await getWorldSimulationState(id,options);
  const beforeHistory=await getWorldSimulationHistory(id,options);
  process.env.FILE_TRANSACTION_TEST_MODE="1";
  await assert.rejects(()=>runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event85e-1"},{...common,testFailAfterTransactionCommits:1}), /Injected|injected|test.*fail/i);
  assert.deepEqual(await getWorldSimulationState(id,options),beforeState,"Failed transaction must restore state including memory and claims.");
  assert.deepEqual(await getWorldSimulationHistory(id,options),beforeHistory,"Failed transaction must restore turn history.");
  if(priorMode===undefined)delete process.env.FILE_TRANSACTION_TEST_MODE;else process.env.FILE_TRANSACTION_TEST_MODE=priorMode;
  const first=await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event85e-1"},common);
  assert.equal(first.committed,true);
  assert.equal(first.memory_interpretation_turn.created_event_count,2);
  assert.ok(brainViews.filter(v=>v.round===1).every(v=>!v.context || v.context.interpretations.length===0));
  const firstState=await getWorldSimulationState(id,options);
  const firstEvents=structuredClone(firstState.state.memory_reconsolidation_interpretation_update_events);
  assert.equal(Object.keys(firstEvents).length,2,"Retry must not double-append failed updates.");
  const firstHistory=await getWorldSimulationHistory(id,options);
  assert.equal(firstHistory.turns.at(-1).memory_interpretation_turn.created_event_count,2);
  const replayNative=buildWorldSimulationMemoryInterpretationTurn({world_state:firstState.state,current_turn_id:first.turn_id});
  assert.equal(replayNative.summary.already_persisted_event_count,2);
  assert.deepEqual(replayNative.result.state_transitions,[]);
  round=2;
  const second=await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event85e-2"},common);
  assert.equal(second.memory_interpretation_turn.created_event_count,2);
  for(const item of brainViews.filter(v=>v.round===2)) {
    assert.equal(item.context.interpretations.length,1);
    assert.ok(item.context.interpretations.every(entry=>entry.later_interpretation.startsWith(item.character)));
  }
  round=3;
  const third=await runWorldSimulationTurn({world_simulation_session_id:id,event_id:"event85e-3"},common);
  assert.equal(third.memory_interpretation_turn.created_event_count,0);
  for(const item of brainViews.filter(v=>v.round===3)) assert.equal(item.context.interpretations.length,2);
  const final=await getWorldSimulationState(id,options);
  for(const [eventId,event] of Object.entries(firstEvents)) assert.deepEqual(final.state.memory_reconsolidation_interpretation_update_events[eventId],event);
  for(const character of ["Alice","Bob"]) assert.deepEqual(final.state.memories[character].find(m=>m.memory_id===character+"old"),originalMemories[character][0]);
  assert.equal(Object.keys(final.state.memory_reconsolidation_interpretation_update_events).length,4);
} finally {
  if(priorMode===undefined)delete process.env.FILE_TRANSACTION_TEST_MODE;else process.env.FILE_TRANSACTION_TEST_MODE=priorMode;
  assert.equal(path.dirname(fixtureRoot),path.join(projectRoot,"tests",".tmp"));
  await rm(fixtureRoot,{recursive:true,force:true});
}
console.log("Phase85E native atomic memory interpretation continuity: PASS");
