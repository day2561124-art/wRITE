import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { beginWorldSimulationSession } from "../server/src/world-simulation-session-service.mjs";
import { projectRoot } from "../server/src/project-paths.mjs";
import {
  buildWorldSimulationBodyAuthorityContract,
  projectWorldSimulationBodyAuthority,
  readCommittedWorldSimulationBodyAuthority,
  worldSimulationBodyAuthorityVersion,
} from "../server/src/world-simulation-body-authority-service.mjs";

const world = {
  characters: { aria: { physical_state: {
    health_current: 70,
    injuries: [{ region: "left_arm", severity: 0.7, source_action_id: "strike-1", diagnosis: "fracture" }],
    movement_multiplier: 0.5,
    incapacitated: false,
    pain: "severe",
  } } },
  scenes: { yard: { entity_positions: { aria: { x: 2, y: 3 } } } },
};
const before = structuredClone(world);
const projection = projectWorldSimulationBodyAuthority({
  world_state: world, scene_id: "yard", character: "aria",
});
assert.equal(projection.version, worldSimulationBodyAuthorityVersion);
assert.equal(projection.authority, "derived_world_causal_state");
assert.deepEqual(projection.objective_body_state.actual_position, { x: 2, y: 3 });
assert.equal(projection.objective_body_state.health_current, 70);
assert.equal(projection.objective_body_state.injuries[0].severity, 0.7);
assert.equal(projection.brain_evidence.nociceptive_signal, "injury_signal_possible");
assert.equal(projection.brain_evidence.subjective_pain_asserted, false);
assert.equal(projection.brain_evidence.movement_completed_asserted, false);
for (const prohibited of ["fracture", "severe", "70", "left_arm", "strike-1"]) {
  assert.equal(JSON.stringify(projection.brain_evidence).includes(prohibited), false);
}
assert.deepEqual(world, before);

const altered = structuredClone(world);
altered.characters.aria.physical_state.immobilized = true;
altered.scenes.yard.entity_positions.aria = { x: 1, y: 3 };
const stopped = projectWorldSimulationBodyAuthority({
  world_state: altered, scene_id: "yard", character: "aria",
});
assert.deepEqual(stopped.objective_body_state.actual_position, { x: 1, y: 3 });
assert.equal(stopped.brain_evidence.movement_signal, "movement_restricted");
assert.equal(stopped.brain_evidence.movement_completed_asserted, false);
assert.equal(projection.objective_body_state.movement_restricted, false);
assert.throws(() => projectWorldSimulationBodyAuthority({
  world_state: world, scene_id: "yard", character: "unknown",
}), /BODY0A_CHARACTER_NOT_IN_COMMITTED_WORLD/);

const contract = buildWorldSimulationBodyAuthorityContract();
assert.equal(contract.brain_may_write_objective_body_state, false);
assert.equal(contract.injury_is_subjective_pain, false);
assert.equal(contract.motor_intention_is_completed_movement, false);
const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `body0a-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const session = await beginWorldSimulationSession({
    simulation_label: "BODY-0A committed state boundary fixture",
    seed: "body-0a",
    rules: { event_driven: true, persistent_causality: true },
    initial_world_state: { ...world, event_queue: [] },
  }, options);
  const sessionId = session.world_simulation_session_id;
  const committed = await readCommittedWorldSimulationBodyAuthority({
    session_id: sessionId, scene_id: "yard", character: "aria", expected_revision: 0,
  }, options);
  assert.equal(committed.authority, "committed_world_causal_state");
  assert.equal(committed.world_state_revision, 0);
  assert.equal(typeof committed.world_state_hash, "string");
  assert.deepEqual(committed.objective_body_state.actual_position, { x: 2, y: 3 });
  assert.equal(JSON.stringify(committed.brain_evidence).includes(committed.world_state_hash), false);
  world.scenes.yard.entity_positions.aria.x = 999;
  assert.deepEqual((await readCommittedWorldSimulationBodyAuthority({
    session_id: sessionId, scene_id: "yard", character: "aria",
  }, options)).objective_body_state.actual_position, { x: 2, y: 3 });
  await assert.rejects(readCommittedWorldSimulationBodyAuthority({
    session_id: sessionId, scene_id: "yard", character: "aria", expected_revision: 1,
  }, options), { code: "BODY0A_COMMITTED_STATE_REVISION_CHANGED" });
  await assert.rejects(readCommittedWorldSimulationBodyAuthority({
    session_id: sessionId, scene_id: "yard", character: "aria", expected_state_hash: "forged",
  }, options), { code: "BODY0A_COMMITTED_STATE_HASH_CHANGED" });
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("BODY-0A objective body authority boundary tests passed.");
