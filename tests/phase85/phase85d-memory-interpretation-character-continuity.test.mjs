import { fixture } from "./phase85-memory-interpretation-fixture.mjs";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { hashAgentRunValue } from "../../server/src/agent-run-service.mjs";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence } from "../../server/src/world-simulation-memory-reconsolidation-lability-candidate-evidence-service.mjs";
import { buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection } from "../../server/src/world-simulation-memory-reconsolidation-restabilization-update-projection-service.mjs";
import { buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents, validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory } from "../../server/src/world-simulation-memory-reconsolidation-interpretation-update-event-service.mjs";
import { projectWorldSimulationSubjectiveCognition, worldSimulationMemoryInterpretationMaxEntries } from "../../server/src/world-simulation-subjective-cognition-projection-service.mjs";
import { buildWorldSimulationCharacterBrainInput } from "../../server/src/world-simulation-character-brain-input-service.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { prepareWorldSimulationTurn } from "../../server/src/world-simulation-loop-service.mjs";

function rehash(value, field) { delete value[field]; value[field] = hashAgentRunValue(value); }
function project(world, character = "Alice", turn = "later") {
  return projectWorldSimulationSubjectiveCognition({ world_state: world, character, current_turn_id: turn });
}
function context(world, character, turn) { return project(world, character, turn).character_view.memory_interpretation_context; }

const world = fixture();
const before = hashAgentRunValue(world);
const view = context(world);
assert.deepEqual(view.interpretations, [{ prior_interpretation: "Alice believed the door was usually open.",
  later_interpretation: "Alice now suspects access is restricted 0", relation: "challenges",
  subjective_not_world_truth: true, candidate_relation_only: true, original_memory_preserved: true, belief_adoption_implied: false }]);
assert.equal(hashAgentRunValue(world), before, "Reading must not mutate memory, strength, or history.");
assert.equal(Object.isFrozen(view.interpretations[0]), true);
assert.deepEqual(context(JSON.parse(JSON.stringify(world))), view, "Reloading must reproduce the same subjective continuity.");
assert.deepEqual(context(world, "Alice", "update").interpretations, [], "No same-turn feedback.");
assert.deepEqual(context(world, "Bob").interpretations, [], "Another character cannot inherit this life history.");
assert.equal(context(world, "alice").interpretations.length, 1);
assert.equal(project({}).character_view.memory_interpretation_context, undefined, "Legacy worlds retain their original view.");

const bob = fixture("Bob");
const mixed = structuredClone(world);
for (const [key, value] of Object.entries(bob)) {
  if (Array.isArray(value)) mixed[key] = [...(mixed[key] ?? []), ...value];
  else if (value && typeof value === "object") mixed[key] = { ...mixed[key], ...value };
}
assert.deepEqual(context(mixed), view);
// Independent lives must remain writable after their streams share a world.
const mixedA = buildWorldSimulationMemoryReconsolidationLabilityCandidateEvidence({ world_state: mixed, character: "Alice", current_turn_id: "update" });
const mixedB = buildWorldSimulationMemoryReconsolidationRestabilizationUpdateProjection({ world_state: mixed, character: "Alice", current_turn_id: "update", phase85a_evidence: mixedA });
const mixedReplay = buildWorldSimulationMemoryReconsolidationInterpretationUpdateEvents({ world_state: mixed, character: "Alice", current_turn_id: "update", phase85a_evidence: mixedA, phase85b_projection: mixedB });
assert.equal(mixedReplay.result.created_event_count, 0);
assert.equal(mixedReplay.result.already_persisted_event_count, 1);
assert.deepEqual(mixedReplay.result.state_transitions, []);
assert.equal(JSON.stringify(context(mixed, "Bob")).includes("Alice"), false);
const many = fixture("Alice", 10);
assert.equal(context(many).interpretations.length, worldSimulationMemoryInterpretationMaxEntries);
assert.equal(context(many).truncated, true);
assert.ok(context(many).interpretations.some((entry) => entry.relation === "supersedes" && entry.belief_adoption_implied === false));
assert.deepEqual(context(fixture("Alice", 18)).interpretations, [], "A truncated prior claim cannot leak through the interpretation route.");

for (const forbidden of ["memory_id", "claim_event_id", "event_hash", "source_turn_id", "source_memory_ref", "retrieval_event_id", "confidence", "probability"]) {
  assert.equal(JSON.stringify(view).includes(forbidden), false, forbidden + " must stay engine-side.");
}
function expectCorruption(edit, code) {
  const bad = structuredClone(world);
  edit(bad);
  assert.throws(() => project(bad), (error) => error.code === code);
}
const historyKey = "memory_reconsolidation_interpretation_update_history";
const eventsKey = "memory_reconsolidation_interpretation_update_events";
expectCorruption((bad) => { bad[historyKey][0].previous_interpretation_update_event_hash = "forged"; }, "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_REFERENCE_MISMATCH");
expectCorruption((bad) => { bad[historyKey] = []; }, "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_HISTORY_INCOMPLETE");
expectCorruption((bad) => { bad[eventsKey] = []; }, "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_STORE_INVALID");
expectCorruption((bad) => { bad[eventsKey][bad[historyKey][0].interpretation_update_event_id].memory_id = "forged"; }, "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_EVENT_HASH_MISMATCH");
expectCorruption((bad) => {
  const event = bad[eventsKey][bad[historyKey][0].interpretation_update_event_id];
  event.source_projection.memory_id = "forged";
  rehash(event, "interpretation_update_event_hash");
  bad[historyKey][0].interpretation_update_event_hash = event.interpretation_update_event_hash;
}, "WORLD_SIMULATION_RECONSOLIDATION_INTERPRETATION_UPDATE_SOURCE_PROJECTION_MISMATCH");
expectCorruption((bad) => { delete bad.retrieval_events["Alice-retrieval"]; }, "WORLD_SIMULATION_MEMORY_INTERPRETATION_CHARACTER_LINEAGE_MISMATCH");
expectCorruption((bad) => {
  bad.retrieval_events["Alice-retrieval"].character = "Bob";
  rehash(bad.retrieval_events["Alice-retrieval"], "retrieval_event_hash");
}, "WORLD_SIMULATION_MEMORY_INTERPRETATION_CHARACTER_LINEAGE_MISMATCH");
assert.equal(validateWorldSimulationMemoryReconsolidationInterpretationUpdateHistory(world).history.length, 1);

// Native prepare executes the existing Action Proposer and constructs the same
// decision packet consumed by both in-process and formal Character Brain ingress.
const fixtureRoot = path.join(projectRoot, "tests", ".tmp", "phase85d-" + process.pid + "-" + Date.now());
const nativeWorld = structuredClone(world);
Object.assign(nativeWorld, {
  world_rules: { default_vision_range_m: 30 },
  event_queue: [{ event_id: "event85d", type: "reconsider_access", scene_id: "scene85d", participants: ["Alice"] }],
  scenes: { scene85d: { scene_id: "scene85d", dimensions: { width_m: 10, depth_m: 10 },
    entity_positions: { Alice: { x: 0, y: 0 } }, obstacles: [], lighting: { ambient_lux: 30 },
    sound_events: [], visibility_profiles: {}, perception_labels_by: {}, auditory_labels_by: {} } },
  characters: { Alice: { current_action: "observe", known: [] } }, objects: {},
  available_actions: { Alice: [{ action_id: "wait", intent: "Observe before deciding whether to enter" }] },
});
try {
  const session = await beginWorldSimulationSession({ simulation_label: "Phase85D interpretation continuity", seed: "phase85d", rules: { event_driven: true, persistent_causality: true }, initial_world_state: nativeWorld }, { fixtureRoot });
  const prepared = await prepareWorldSimulationTurn({ world_simulation_session_id: session.world_simulation_session_id, event_id: "event85d" }, { fixtureRoot });
  assert.equal(prepared.ok, true);
  const packet = prepared.decision_packets.find((entry) => entry.character === "Alice");
  assert.deepEqual(packet.cognition.subjective_cognition.memory_interpretation_context, view);
  assert.deepEqual(buildWorldSimulationCharacterBrainInput(packet).cognition.subjective_cognition.memory_interpretation_context, view);
} finally {
  // This literal child of tests/.tmp is generated only by this fixture.
  assert.equal(path.dirname(fixtureRoot), path.join(projectRoot, "tests", ".tmp"));
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("Phase85D memory interpretation character continuity: PASS");
