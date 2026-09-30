import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../../server/src/project-paths.mjs";
import { beginWorldSimulationSession } from "../../server/src/world-simulation-session-service.mjs";
import { getWorldSimulationState } from "../../server/src/world-simulation-state-service.mjs";
import { projectWorldSimulationBodyAuthority, readCommittedWorldSimulationBodyAuthority } from "../../server/src/world-simulation-body-authority-service.mjs";

const version = "cb-c6b-sleep-arousal-record-v1";
function record(condition = "asleep") {
  return { version, character: "aria", condition, since_time_ms: 1200,
    source: { kind: "world_initialization", source_id: "initial-body-aria" },
    last_transition: null };
}
function world(sleep) {
  return { simulation_time: 2000, event_queue: [],
    characters: { aria: { physical_state: {
      health_current: 70, unconscious: true, incapacitated: true,
      ...(sleep === undefined ? {} : { sleep_arousal: sleep }),
    } }, bela: { physical_state: {} } },
    scenes: { yard: { entity_positions: { aria: { x: 2, y: 3 } } } } };
}
function view(state, character = "aria") {
  return projectWorldSimulationBodyAuthority({ world_state: state, scene_id: "yard", character });
}
const legacy = world();
assert.equal(view(legacy).objective_body_state.sleep_arousal.condition, "unknown");
assert.equal(view(legacy).objective_body_state.sleep_arousal.source, null);
assert.equal(view(legacy).objective_body_state.sleep_arousal.last_transition, null);
assert.equal(view(legacy).objective_body_state.movement_restricted, true);

for (const condition of ["awake", "asleep"]) {
  const state = world(record(condition));
  const before = structuredClone(state);
  const projection = view(state);
  const sleep = projection.objective_body_state.sleep_arousal;
  assert.equal(sleep.condition, condition);
  assert.equal(sleep.since_time_ms, 1200);
  assert.equal(sleep.source.source_id, "initial-body-aria");
  assert.equal(projection.objective_body_state.movement_restricted, true);
  assert.equal(view(state, "bela").objective_body_state.sleep_arousal.condition, "unknown");
  for (const privateValue of ["sleep_arousal", condition, "initial-body-aria", "1200"]) {
    assert.equal(JSON.stringify(projection.brain_evidence).includes(privateValue), false);
  }
  sleep.source.source_id = "changed-return-value";
  assert.deepEqual(state, before);
}
const transition = record("awake");
transition.source = { kind: "committed_world_transition", source_id: "event-wake-1" };
transition.last_transition = { transition_id: "transition-wake-1", event_id: "event-wake-1", time_ms: 1200 };
assert.equal(view(world(transition)).objective_body_state.sleep_arousal.last_transition.transition_id, "transition-wake-1");

const invalid = [
  null, [], "asleep", {},
  { ...record(), version: "unknown" },
  { ...record(), character: "bela" },
  { ...record(), condition: "unconscious" },
  { ...record(), since_time_ms: -1 },
  { ...record(), since_time_ms: NaN },
  { ...record(), since_time_ms: Infinity },
  { ...record(), since_time_ms: "1200" },
  { ...record(), source: { kind: "brain_intention", source_id: "intent-1" } },
  { ...record(), source: { kind: "world_initialization", source_id: "" } },
  { ...record(), last_transition: transition.last_transition },
  { ...transition, last_transition: null },
  { ...transition, last_transition: { ...transition.last_transition, event_id: "other-event" } },
  { ...transition, last_transition: { ...transition.last_transition, time_ms: 1300 } },
];
for (const candidate of invalid) {
  const state = world(candidate);
  const before = structuredClone(state);
  assert.throws(() => view(state), { code: "C6B_SLEEP_AROUSAL_RECORD_INVALID" });
  assert.deepEqual(state, before);
}
assert.throws(() => view(world(), "missing"), /BODY0A_CHARACTER_NOT_IN_COMMITTED_WORLD/);
const extra = record();
extra.hidden = "private-debug";
extra.source.hidden = "private-source-debug";
assert.equal(JSON.stringify(view(world(extra)).objective_body_state.sleep_arousal).includes("private-debug"), false);
assert.equal(JSON.stringify(view(world(extra)).objective_body_state.sleep_arousal).includes("private-source-debug"), false);

const fixtureRoot = path.join(projectRoot, "tests", ".tmp", `c6b-${process.pid}-${Date.now()}`);
const options = { fixtureRoot };
try {
  const initial = world(record());
  const session = await beginWorldSimulationSession({
    simulation_label: "C6-B committed objective sleep record",
    seed: "c6-b", rules: { event_driven: true, persistent_causality: true },
    initial_world_state: initial,
  }, options);
  const session_id = session.world_simulation_session_id;
  const stateBefore = await getWorldSimulationState(session_id, options);
  const params = { session_id, scene_id: "yard", character: "aria",
    expected_revision: stateBefore.revision, expected_state_hash: stateBefore.state_hash };
  const committed = await readCommittedWorldSimulationBodyAuthority(params, options);
  assert.equal(committed.objective_body_state.sleep_arousal.condition, "asleep");
  assert.equal(committed.authority, "committed_world_causal_state");
  assert.equal(committed.world_state_hash, stateBefore.state_hash);
  initial.characters.aria.physical_state.sleep_arousal.condition = "awake";
  committed.objective_body_state.sleep_arousal.source.source_id = "tampered-copy";
  assert.equal((await readCommittedWorldSimulationBodyAuthority(params, options)).objective_body_state.sleep_arousal.condition, "asleep");
  await assert.rejects(readCommittedWorldSimulationBodyAuthority({ ...params, expected_revision: 1 }, options),
    { code: "BODY0A_COMMITTED_STATE_REVISION_CHANGED" });
  await assert.rejects(readCommittedWorldSimulationBodyAuthority({ ...params, expected_state_hash: "forged" }, options),
    { code: "BODY0A_COMMITTED_STATE_HASH_CHANGED" });
  assert.deepEqual(await getWorldSimulationState(session_id, options), stateBefore);
  for (const privateValue of ["asleep", "initial-body-aria", stateBefore.state_hash]) {
    assert.equal(JSON.stringify(committed.brain_evidence).includes(privateValue), false);
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
console.log("CB-C6-B objective sleep/arousal reader tests passed.");
