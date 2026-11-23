import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationState, commitWorldSimulationTurn,
} from "./world-simulation-state-service.mjs";
import {
  projectWorldSimulationOffscreenSceneBreakpointPlan,
} from "./world-simulation-offscreen-scene-breakpoint-plan-service.mjs";
import { adjudicateWorldSimulationContinuousPhysics } from "./world-simulation-continuous-physics-service.mjs";
import {
  runWorldSimulationPureProposalProducer,
  projectWorldSimulationPureProposalTransitions,
} from "./world-simulation-pure-proposal-producer-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationOffscreenMultiSceneFieldStepVersion =
  "cb-c6f-two-scene-field-step-v1";

const object = value => value && typeof value === "object" && !Array.isArray(value)
  ? value : {};
const array = value => Array.isArray(value) ? value : [];
const copy = value => JSON.parse(JSON.stringify(value));

function invalid(message, code = "C6F_MULTI_SCENE_FIELD_STEP_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function canonicalTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    && new Date(Date.parse(value)).toISOString() === value;
}

/**
 * Exact-CAS, World-owned, two-scene field-only proof slice.
 * Reuses the existing per-scene continuous physics proposal owner, immutable
 * field lifecycle, one global chronological executor and the existing atomic
 * World state/history writer. No active projectiles, actor trajectories,
 * harmful fields, queued actions, acoustic ingress or subjective inference.
 */
export async function runWorldSimulationOffscreenMultiSceneFieldStep(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => ![
      "world_simulation_session_id", "expected_revision",
      "expected_state_hash", "target_horizon",
    ].includes(key))
    || typeof input.world_simulation_session_id !== "string"
    || !input.world_simulation_session_id.trim()
    || !Number.isSafeInteger(input.expected_revision)
    || input.expected_revision < 0
    || typeof input.expected_state_hash !== "string"
    || !input.expected_state_hash
    || (Object.hasOwn(input, "target_horizon")
      && !canonicalTimestamp(input.target_horizon)))
    invalid("Two-scene field step requires canonical exact World CAS and optional ISO horizon.");
  if (options.causalAdjudicator !== undefined
    || options.worldSimulationTimeCeiling !== undefined
    || options.characterBrain !== undefined)
    invalid("Two-scene physical step cannot override the causal owner or invoke Brain.");

  input = structuredClone(input);
  const sid = input.world_simulation_session_id;
  const snapshot = await getWorldSimulationState(sid, options);
  if (snapshot.revision !== input.expected_revision
    || snapshot.state_hash !== input.expected_state_hash)
    invalid("Two-scene field step must use latest committed World identity.",
      "C6F_MULTI_SCENE_FIELD_STEP_STALE");

  const state = snapshot.state;
  const plan = projectWorldSimulationOffscreenSceneBreakpointPlan({
    world_state: state, target_horizon: input.target_horizon ?? null,
  });
  const blocked = reason => ({
    version: worldSimulationOffscreenMultiSceneFieldStepVersion,
    world_simulation_session_id: sid,
    committed: false, blocked_reason: reason,
    previous_state_hash: snapshot.state_hash,
    reached_simulation_time: state.simulation_time,
    scene_plan: plan, automatic_replay_allowed: false,
  });
  if (plan.pending_queued_event_count > 0)
    return blocked("queued_event_precedes_physical_step");
  if (plan.pending_acoustic_ingress_count > 0)
    return blocked("listener_acoustic_ingress_pending");
  if (plan.active_scene_count !== 2)
    return blocked("requires_exactly_two_active_field_scenes");
  if (!plan.earliest_breakpoint_confirmed)
    return blocked("unresolved_physical_authority");
  const delta = plan.global_breakpoint?.delta_ms;
  if (!Number.isSafeInteger(delta) || delta <= 0)
    return blocked("positive_whole_millisecond_field_boundary_required");
  if (Object.values(object(state.projectiles)).some(p => p?.active === true))
    return blocked("active_projectile_not_yet_supported");
  const activeFields = Object.entries(object(state.ability_fields))
    .filter(([, field]) => field?.active === true);
  if (!activeFields.length || plan.scenes.some(item =>
    !item.scene_exists || item.active_projectile_ids.length))
    return blocked("active_scene_scope_unresolved");

  // This slice excludes all combat effects; only field lifecycles advance.
  if (activeFields.some(([id, field]) => {
    const effect = object(field.effect);
    const scene = object(object(state.scenes)[field.scene_id]);
    return field.field_id !== id
      || !Number.isSafeInteger(field.remaining_ms) || field.remaining_ms <= 0
      || !Number.isFinite(field.center?.x) || !Number.isFinite(field.center?.y)
      || !Number.isFinite(field.radius_m) || field.radius_m <= 0
      || effect.damage_per_second !== 0
      || Object.keys(effect).some(key => key !== "damage_per_second")
      || !canonicalTimestamp(scene.simulation_time)
      || scene.simulation_time !== state.simulation_time
      || scene.scene_id !== field.scene_id
      || typeof field.scene_id !== "string"
      || !Object.hasOwn(object(state.scenes), field.scene_id);
  })) return blocked("nonharmful_field_lifecycle_authority_required");

  const nextTime = new Date(Date.parse(state.simulation_time) + delta).toISOString();
  const sceneIds = plan.scenes.map(item => item.scene_id);
  const turnId = "world_multiscene_field_" + hashAgentRunValue({
    session: sid, revision: snapshot.revision, hash: snapshot.state_hash,
    scene_ids: sceneIds, breakpoint: plan.global_breakpoint,
  }).slice(0, 24);
  const event = {
    event_id: turnId, type: "offscreen_multiscene_ability_field_step",
    scene_ids: sceneIds, simulation_time: state.simulation_time,
    source_authority: plan.authority,
  };
  const causalTimeline = {
    entries: [], elapsed_ms: delta, scene_ids: sceneIds,
    physical_effects_only: true, action_selection_performed: false,
  };
  const transitions = [];
  const producerAudits = [];
  const immutableAudits = [];
  let projected = copy(state);
  for (const sceneId of sceneIds) {
    const produced = runWorldSimulationPureProposalProducer({
      producer: "continuous_physics",
      turn_id: turnId, world_state_hash: snapshot.state_hash,
      root_world_state: state, authoritative_world_state: projected,
      existing_state_transitions: transitions,
      causal_timeline: causalTimeline, elapsed_ms: delta, scene_id: sceneId,
      solve: ({ isolated_preview_world_state }) =>
        adjudicateWorldSimulationContinuousPhysics({
          world_state: state,
          next_world_state: isolated_preview_world_state,
          scene_id: sceneId, event, turn_id: turnId,
          selected_action_intents: [], resolved_action_outcomes: [],
          elapsed_ms: delta,
        }),
    });
    const result = produced.result;
    const proposals = array(produced.proposal_package.mutation_proposals);
    const legalIds = new Set(plan.scenes.find(item =>
      item.scene_id === sceneId).active_field_ids);
    if (proposals.length !== legalIds.size
      || proposals.some(item => item.field !== "ability_field_state"
        || !legalIds.has(item.entity))
      || array(result.action_outcomes).length
      || array(result.projectile_resolutions).length
      || array(result.ability_resolutions).length)
      return blocked("two_scene_field_physics_proposal_outside_slice");
    for (const item of proposals) {
      if (item.from?.field_id !== item.entity
        || item.to?.field_id !== item.entity
        || item.to.remaining_ms !== Math.max(0, item.from.remaining_ms - delta)
        || item.to.active !== (item.to.remaining_ms > 0))
        return blocked("unexpected_immutable_field_lifecycle");
    }
    transitions.push(...proposals);
    producerAudits.push(produced.audit);
    immutableAudits.push(...array(result.immutable_causal_evaluator_audits));
    projected = projectWorldSimulationPureProposalTransitions({
      root_world_state: state, turn_id: turnId,
      world_state_hash: snapshot.state_hash,
      state_transitions: transitions, causal_timeline: causalTimeline,
      elapsed_ms: delta,
    }).projected_world_state;
  }

  transitions.push({
    entity: "world", field: "simulation_time",
    from: state.simulation_time, to: nextTime,
    time_ms: delta, source_layer: "causal_resolution",
    adjudication: "world_offscreen_multiscene_field_step",
    cause: "World-owned shared field frontier +" + delta + "ms",
  });
  for (const sceneId of sceneIds) {
    transitions.push({
      entity: sceneId, field: "simulation_time", scene_id: sceneId,
      from: state.scenes[sceneId].simulation_time, to: nextTime,
      time_ms: delta, source_layer: "causal_resolution",
      adjudication: "world_offscreen_multiscene_field_step",
      cause: "scene " + sceneId + " advanced at shared frontier +" + delta + "ms",
    });
  }
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId, world_state_hash: snapshot.state_hash,
    state_transitions: transitions, causal_timeline: causalTimeline,
    elapsed_ms: delta,
  });
  if (queue.continuity_warning_count > 0 || queue.all_mutations_timed !== true)
    invalid("Two-scene field chronology has unresolved mutation ordering.",
      "C6F_MULTI_SCENE_FIELD_STEP_CHRONOLOGY_INVALID");

  const preview = projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue,
  }).projected_world_state;
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: state, preview_world_state: preview, queue,
  });
  if (hashAgentRunValue(preview) !== hashAgentRunValue(execution.next_world_state)
    || execution.next_world_state.simulation_time !== nextTime)
    invalid("Two-scene physical execution disagrees with its World mutation projection.",
      "C6F_MULTI_SCENE_FIELD_STEP_EXECUTOR_MISMATCH");
  for (const sceneId of sceneIds) {
    if (execution.next_world_state.scenes[sceneId].simulation_time !== nextTime)
      invalid("Two-scene clocks diverged from the committed World frontier.",
        "C6F_MULTI_SCENE_FIELD_STEP_CLOCK_MISMATCH");
  }

  const actualAudits = immutableAudits.map(audit => copy(audit));
  const committed = await commitWorldSimulationTurn(sid, {
    expected_revision: snapshot.revision, expected_state_hash: snapshot.state_hash,
    turn_id: turnId, event, next_world_state: execution.next_world_state,
    selected_action_intents: [],
    state_transitions: transitions, action_outcomes: [],
    knowledge_transitions: [], scheduled_events: [],
    causal_timeline: causalTimeline,
    chronological_mutation_queue: queue,
    chronological_mutation_execution: execution.execution,
    pure_proposal_producers: {
      producer_outputs_contain_world_state: false,
      audit_count: producerAudits.length, audits: producerAudits,
    },
    immutable_causal_evaluators: {
      evaluator_outputs_contain_world_state: false,
      audit_count: actualAudits.length, audits: actualAudits,
    },
    immutable_ability_field_lifecycle: {
      audit_count: actualAudits.filter(audit =>
        audit?.evaluator === "ability_field_lifecycle_advance").length,
      audits: actualAudits.filter(audit =>
        audit?.evaluator === "ability_field_lifecycle_advance"),
    },
  }, options);

  return {
    ...committed, version: worldSimulationOffscreenMultiSceneFieldStepVersion,
    committed: true, world_simulation_session_id: sid, turn_id: turnId,
    previous_state_hash: snapshot.state_hash,
    reached_simulation_time: nextTime,
    elapsed_ms: delta, scene_ids: sceneIds, scene_plan: plan,
    automatic_replay_allowed: false,
  };
}
