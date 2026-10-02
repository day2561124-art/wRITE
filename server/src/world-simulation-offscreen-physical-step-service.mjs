import { getWorldSimulationState, commitWorldSimulationTurn } from "./world-simulation-state-service.mjs";
import { adjudicateWorldSimulationOffscreenPhysicalStep } from "./world-simulation-causal-rule-engine.mjs";

export const worldSimulationOffscreenPhysicalStepVersion = "cb-c6e4-physical-step-v1";

function invalid(message, code = "C6E_PHYSICAL_STEP_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/** One World-owned physical step; no Character Brain or subjective projection. */
export async function runWorldSimulationOffscreenPhysicalStep(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => ![
        "world_simulation_session_id", "expected_revision", "expected_state_hash", "target_horizon",
      ].includes(key))
      || typeof input.world_simulation_session_id !== "string"
      || !input.world_simulation_session_id.trim()
      || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0
      || typeof input.expected_state_hash !== "string" || !input.expected_state_hash)
    invalid("Physical step requires an exact session/revision/hash.");
  // Own every caller value before the first asynchronous boundary.
  input = structuredClone(input);
  if (Object.hasOwn(input, "target_horizon") && (
      typeof input.target_horizon !== "string"
      || !Number.isFinite(Date.parse(input.target_horizon))
      || new Date(Date.parse(input.target_horizon)).toISOString() !== input.target_horizon))
    invalid("Physical step horizon must be a canonical ISO World timestamp.");
  if (options.causalAdjudicator !== undefined || options.worldSimulationTimeCeiling !== undefined)
    invalid("Physical step owns its causal adjudicator and World-time boundary.");
  const sid = input.world_simulation_session_id;
  const snapshot = await getWorldSimulationState(sid, options);
  if (snapshot.revision !== input.expected_revision || snapshot.state_hash !== input.expected_state_hash)
    invalid("Physical step's committed World identity is stale.", "C6E_PHYSICAL_STEP_STALE");
  const resolution = await adjudicateWorldSimulationOffscreenPhysicalStep({
    world_simulation_session_id: sid, world_state: snapshot.state,
    world_state_revision: snapshot.revision, world_state_hash: snapshot.state_hash,
    target_horizon: input.target_horizon ?? null,
  });
  if (resolution.blocked_reason) return {
    version: worldSimulationOffscreenPhysicalStepVersion,
    world_simulation_session_id: sid, committed: false,
    blocked_reason: resolution.blocked_reason, discovery: resolution.discovery,
    reached_simulation_time: snapshot.state.simulation_time,
    previous_state_hash: snapshot.state_hash, next_state_hash: null,
    automatic_replay_allowed: false,
  };
  const committed = await commitWorldSimulationTurn(sid, {
    expected_revision: snapshot.revision, expected_state_hash: snapshot.state_hash,
    turn_id: resolution.turn_id, event: resolution.event,
    next_world_state: resolution.next_world_state,
    selected_action_intents: [], state_transitions: resolution.state_transitions,
    action_outcomes: resolution.action_outcomes, knowledge_transitions: [],
    scheduled_events: [], causal_timeline: resolution.causal_timeline,
    chronological_mutation_queue: resolution.chronological_mutation_queue,
    chronological_mutation_execution: resolution.chronological_mutation_execution,
    mutation_proposal_boundary: resolution.mutation_proposal_boundary,
    pure_proposal_producers: resolution.pure_proposal_producers,
    immutable_causal_evaluators: resolution.immutable_causal_evaluators,
    immutable_physics_effects: resolution.immutable_physics_effects,
    immutable_projectile_lifecycle: resolution.immutable_projectile_lifecycle,
    immutable_ability_field_lifecycle: resolution.immutable_ability_field_lifecycle,
    immutable_event_queries: resolution.immutable_event_queries,
    immutable_event_arbitration: resolution.immutable_event_arbitration,
    cross_layer_event_arbitration: resolution.cross_layer_event_arbitration,
    causal_epochs: resolution.causal_epochs, fixed_point_convergence: resolution.fixed_point_convergence,
  }, options);
  // Return the actual commit directly; a later read failure must never invite replay.
  return {
    ...committed, version: worldSimulationOffscreenPhysicalStepVersion, committed: true,
    world_simulation_session_id: sid, turn_id: resolution.turn_id,
    previous_state_hash: snapshot.state_hash,
    reached_simulation_time: resolution.next_world_state.simulation_time,
    discovery: resolution.discovery, automatic_replay_allowed: false,
  };
}
