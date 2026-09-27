import { getWorldSimulationState } from "./world-simulation-state-service.mjs";

export const worldSimulationBodyAuthorityVersion = "body-0a-objective-boundary-v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function position(value) {
  const point = object(value);
  const x = finite(point.x);
  const y = finite(point.y);
  return x === null || y === null ? null : { x, y };
}

function injuryEvidence(injury) {
  const record = object(injury);
  return {
    region: typeof record.region === "string" ? record.region : null,
    severity: finite(record.severity),
    source_action_id: typeof record.source_action_id === "string"
      ? record.source_action_id : null,
  };
}

// This pure projection must receive World state from the committed-state reader
// below in production. The private objective view is never a Character Brain
// packet; brain_evidence contains no diagnosis,
// numerical health, engine position, injury severity or subjective pain claim.
export function projectWorldSimulationBodyAuthority({
  world_state,
  scene_id,
  character,
} = {}) {
  const state = object(world_state);
  const actor = String(character ?? "").trim();
  if (!actor || !Object.hasOwn(object(state.characters), actor)) {
    throw new Error("BODY0A_CHARACTER_NOT_IN_COMMITTED_WORLD");
  }
  const characterState = object(state.characters[actor]);
  const physical = object(characterState.physical_state);
  const scene = object(object(state.scenes)[scene_id] ?? state.scene_state);
  const actualPosition = position(object(scene.entity_positions)[actor]);
  const injuries = array(physical.injuries).map(injuryEvidence);
  const movementRestricted =
    physical.incapacitated === true
    || physical.immobilized === true
    || physical.unconscious === true;
  const objective = {
    character: actor,
    actual_position: actualPosition,
    health_current: finite(physical.health_current),
    injuries,
    movement_restricted: movementRestricted,
    movement_multiplier: finite(physical.movement_multiplier),
  };
  return {
    version: worldSimulationBodyAuthorityVersion,
    authority: "derived_world_causal_state",
    objective_body_state: objective,
    brain_evidence: {
      version: worldSimulationBodyAuthorityVersion,
      character: actor,
      proprioceptive_access: actualPosition ? "position_signal_available" : "unavailable",
      nociceptive_signal: injuries.length > 0 ? "injury_signal_possible" : "none_from_recorded_injuries",
      movement_signal: movementRestricted ? "movement_restricted" : "movement_not_known_restricted",
      subjective_pain_asserted: false,
      diagnosis_asserted: false,
      movement_completed_asserted: false,
    },
  };
}

export async function readCommittedWorldSimulationBodyAuthority({
  session_id,
  scene_id,
  character,
  expected_revision,
  expected_state_hash,
} = {}, options = {}) {
  const envelope = await getWorldSimulationState(session_id, options);
  if (expected_revision !== undefined && envelope.revision !== expected_revision) {
    const error = new Error("BODY0A_COMMITTED_STATE_REVISION_CHANGED");
    error.code = "BODY0A_COMMITTED_STATE_REVISION_CHANGED";
    throw error;
  }
  if (expected_state_hash !== undefined && envelope.state_hash !== expected_state_hash) {
    const error = new Error("BODY0A_COMMITTED_STATE_HASH_CHANGED");
    error.code = "BODY0A_COMMITTED_STATE_HASH_CHANGED";
    throw error;
  }
  return {
    ...projectWorldSimulationBodyAuthority({
      world_state: envelope.state,
      scene_id,
      character,
    }),
    authority: "committed_world_causal_state",
    world_state_revision: envelope.revision,
    world_state_hash: envelope.state_hash,
  };
}

export function buildWorldSimulationBodyAuthorityContract() {
  return {
    version: worldSimulationBodyAuthorityVersion,
    objective_source: "committed_world_causal_state",
    production_entry: "readCommittedWorldSimulationBodyAuthority",
    committed_world_revision_and_hash_guard: true,
    brain_may_write_objective_body_state: false,
    brain_may_infer_injury_diagnosis_from_signal: false,
    injury_is_subjective_pain: false,
    motor_intention_is_completed_movement: false,
    scope: "BODY-0A read boundary; history, effectors and full interoception pending",
  };
}
