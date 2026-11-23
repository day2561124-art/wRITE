import { hashAgentRunValue } from "./agent-run-service.mjs";
import {
  getWorldSimulationState, commitWorldSimulationTurn,
} from "./world-simulation-state-service.mjs";
import {
  projectWorldSimulationOffscreenSceneBreakpointPlan,
} from "./world-simulation-offscreen-scene-breakpoint-plan-service.mjs";
import {
  adjudicateWorldSimulationContinuousPhysics,
} from "./world-simulation-continuous-physics-service.mjs";
import {
  runWorldSimulationPureProposalProducer,
  projectWorldSimulationPureProposalTransitions,
} from "./world-simulation-pure-proposal-producer-service.mjs";
import {
  buildWorldSimulationChronologicalMutationQueue,
  projectWorldSimulationChronologicalMutationQueue,
  executeWorldSimulationChronologicalMutationQueue,
} from "./world-simulation-chronological-mutation-queue-service.mjs";

export const worldSimulationOffscreenStaggeredProjectileStepVersion =
  "cb-c6f-staggered-projectile-frontier-v1";

const object = value => value && typeof value === "object" && !Array.isArray(value)
  ? value : {};
const array = value => Array.isArray(value) ? value : [];
const copy = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === "number" && Number.isFinite(value);
const point = value => finite(value?.x) && finite(value?.y);

function invalid(message, code = "C6F_DUAL_PROJECTILE_CONTACT_INVALID") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function canonicalTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    && new Date(Date.parse(value)).toISOString() === value;
}

/**
 * Bounded staggered projectile frontier. One projectile hits first while
 * the second continues its exact immutable flight; the next World frontier
 * resolves the second contact. Both scenes use one CAS/atomic history writer.
 * No batch admission until independently verified.
 */
export async function runWorldSimulationOffscreenStaggeredProjectileStep(
  input = {}, options = {},
) {
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
    invalid("Dual projectile step requires exact World CAS and an optional canonical ISO horizon.");
  if (options.causalAdjudicator !== undefined
    || options.worldSimulationTimeCeiling !== undefined
    || options.characterBrain !== undefined)
    invalid("Dual projectile contact may not override the causal owner or invoke Brain.");

  input = structuredClone(input);
  const sid = input.world_simulation_session_id;
  const snapshot = await getWorldSimulationState(sid, options);
  if (snapshot.revision !== input.expected_revision
    || snapshot.state_hash !== input.expected_state_hash)
    invalid("Dual projectile contact requires the current committed World identity.",
      "C6F_DUAL_PROJECTILE_CONTACT_STALE");

  const state = snapshot.state;
  const plan = projectWorldSimulationOffscreenSceneBreakpointPlan({
    world_state: state, target_horizon: input.target_horizon ?? null,
  });
  const blocked = reason => ({
    version: worldSimulationOffscreenStaggeredProjectileStepVersion,
    committed: false, world_simulation_session_id: sid,
    blocked_reason: reason, previous_state_hash: snapshot.state_hash,
    reached_simulation_time: state.simulation_time,
    scene_plan: plan, automatic_replay_allowed: false,
  });
  if (plan.pending_queued_event_count)
    return blocked("queued_event_precedes_physical_step");
  if (plan.pending_acoustic_ingress_count)
    return blocked("listener_acoustic_ingress_pending");
  if (!plan.earliest_breakpoint_confirmed)
    return blocked("staggered_physical_breakpoint_not_confirmed");
  const activeFields = Object.values(object(state.ability_fields))
    .filter(field => field?.active === true);
  if (activeFields.length)
    return blocked("active_ability_fields_not_yet_supported");
  const delta = plan.global_breakpoint?.delta_ms;
  if (!Number.isSafeInteger(delta) || delta <= 0
    || plan.global_breakpoint.kind !== "projectile_character")
    return blocked("positive_integer_character_contact_required");

  const projectiles = Object.entries(object(state.projectiles));
  const active = projectiles.filter(([, projectile]) => projectile?.active === true);
  const sceneIds = Object.keys(object(state.scenes)).sort((a, b) =>
    a.localeCompare(b, "en"));
  if (projectiles.length !== 2 || sceneIds.length !== 2
    || active.length < 1 || active.length > 2
    || new Set(projectiles.map(([, projectile]) => projectile?.scene_id)).size !== 2
    || projectiles.some(([, projectile]) => !sceneIds.includes(projectile?.scene_id)))
    return blocked("exactly_two_independent_projectile_scenes_required");
  const due = plan.scenes.filter(scene =>
    scene.active_projectile_ids.length === 1
    && scene.next_breakpoint?.kind === "projectile_character"
    && scene.next_breakpoint?.delta_ms === delta);
  if (due.length !== 1 || plan.active_scene_count !== active.length
    || plan.scenes.some(scene => scene.active_projectile_ids.length !== 1
      || scene.active_field_ids.length !== 0
      || scene.next_breakpoint?.kind !== "projectile_character"
      || !Number.isSafeInteger(scene.next_breakpoint?.delta_ms)
      || scene.next_breakpoint.delta_ms < delta)
    || (active.length === 2
      && !plan.scenes.some(scene => scene.next_breakpoint.delta_ms > delta))
    || (active.length === 1 && projectiles.some(([, projectile]) =>
      projectile.active !== true
      && (projectile.termination_reason !== "character_contact"
        || !Number.isFinite(projectile.age_ms))))
    return blocked("exactly_one_earliest_and_one_later_contact_required");

  const residentScene = new Map();
  for (const scene of plan.scenes) {
    const record = object(object(state.scenes)[scene.scene_id]);
    if (record.scene_id !== scene.scene_id
      || record.simulation_time !== state.simulation_time
      || !canonicalTimestamp(record.simulation_time)
      || array(record.obstacles).length)
      return blocked("scene_geometry_or_clock_authority_unresolved");
    for (const name of Object.keys(object(record.entity_positions))) {
      if (!Object.hasOwn(object(state.characters), name)) continue;
      if (residentScene.has(name))
        return blocked("cross_scene_character_identity_overlap");
      residentScene.set(name, scene.scene_id);
    }
  }
  for (const [id, projectile] of projectiles) {
    if (projectile.projectile_id !== id
      || !point(projectile.position) || !point(projectile.velocity_mps)
      || !finite(projectile.radius_m) || projectile.radius_m <= 0
      || !finite(projectile.base_damage)
      || projectile.base_damage <= 0 || projectile.base_damage > 100
      || !finite(projectile.age_ms) || projectile.age_ms < 0
      || !finite(projectile.max_lifetime_ms)
      || projectile.max_lifetime_ms <= projectile.age_ms
      || residentScene.get(projectile.owner) !== projectile.scene_id)
      return blocked("projectile_process_outside_staggered_slice");
  }

  const nextTime = new Date(Date.parse(state.simulation_time) + delta).toISOString();
  const turnId = "world_multiscene_projectile_staggered_"
    + hashAgentRunValue({
      session: sid, revision: snapshot.revision, hash: snapshot.state_hash,
      scene_ids: sceneIds, breakpoint: plan.global_breakpoint,
    }).slice(0, 24);
  const event = {
    event_id: turnId, type: "offscreen_multiscene_projectile_staggered_step",
    scene_ids: sceneIds, simulation_time: state.simulation_time,
    source_authority: plan.authority,
  };
  const causalTimeline = {
    entries: [], elapsed_ms: delta, scene_ids: sceneIds,
    physical_effects_only: true, action_selection_performed: false,
  };
  const transitions = [];
  const impacts = [];
  const timelineEntries = [];
  const producerAudits = [];
  const immutableAudits = [];
  const queryAudits = [];
  const arbitrationAudits = [];
  let projected = copy(state);
  for (const sceneId of sceneIds) {
    const [projectileId, currentProjectile] = projectiles.find(([, projectile]) =>
      projectile.scene_id === sceneId);
    if (currentProjectile.active !== true) continue;
    const produced = runWorldSimulationPureProposalProducer({
      producer: "continuous_physics",
      turn_id: turnId, world_state_hash: snapshot.state_hash,
      root_world_state: state,
      authoritative_world_state: projected,
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
    const residents = new Set([...residentScene].filter(([, id]) =>
      id === sceneId).map(([name]) => name));
    const projectileProposals = proposals.filter(item =>
      item.field === "projectile_state" && item.entity === projectileId);
    const bodyProposals = proposals.filter(item =>
      typeof item.field === "string"
      && item.field.startsWith("physical_state.") && residents.has(item.entity));
    const resolutions = array(result.projectile_resolutions);
    const outcomes = array(result.action_outcomes);
    const hitsNow = due[0].scene_id === sceneId;
    const endState = projectileProposals.at(-1)?.to;
    if (!projectileProposals.length
      || proposals.length !== projectileProposals.length
        + (hitsNow ? bodyProposals.length : 0)
      || array(result.ability_resolutions).length
      || !endState || endState.projectile_id !== projectileId)
      return blocked("staggered_projectile_mutation_outside_slice");

    if (hitsNow) {
      if (resolutions.length !== 1 || outcomes.length !== 1
        || resolutions[0].result !== "projectile_hit_character"
        || resolutions[0].projectile_id !== projectileId
        || !residents.has(resolutions[0].target)
        || !(resolutions[0].damage_applied > 0)
        || resolutions[0].time_ms !== delta
        || outcomes[0].result !== "projectile_hit_character"
        || outcomes[0].projectile_id !== projectileId
        || outcomes[0].target !== resolutions[0].target
        || outcomes[0].damage_applied !== resolutions[0].damage_applied
        || endState.active !== false
        || endState.termination_reason !== "character_contact")
        return blocked("earliest_projectile_contact_outside_slice");
      impacts.push({ ...outcomes[0], scene_id: sceneId });
      timelineEntries.push(...array(result.timeline_entries)
        .filter(item => item.kind === "projectile_resolution")
        .map(item => ({ ...item, scene_id: sceneId })));
    } else {
      const travelDistance = delta / 1000;
      const expectedX = currentProjectile.position.x
        + currentProjectile.velocity_mps.x * travelDistance;
      const expectedY = currentProjectile.position.y
        + currentProjectile.velocity_mps.y * travelDistance;
      if (resolutions.length || outcomes.length
        || endState.active !== true
        || Math.abs(endState.position?.x - expectedX) > 1e-7
        || Math.abs(endState.position?.y - expectedY) > 1e-7
        || Math.abs(endState.age_ms - (currentProjectile.age_ms + delta)) > 1e-7
        || array(result.timeline_entries).some(item =>
          item.kind === "projectile_resolution"))
        return blocked("later_projectile_must_remain_in_flight");
    }
    transitions.push(...proposals);
    producerAudits.push(produced.audit);
    immutableAudits.push(...array(result.immutable_causal_evaluator_audits));
    queryAudits.push(...array(result.immutable_causal_query_audits));
    arbitrationAudits.push(...array(result.immutable_event_arbitration_audits));
    projected = projectWorldSimulationPureProposalTransitions({
      root_world_state: state, turn_id: turnId,
      world_state_hash: snapshot.state_hash,
      state_transitions: transitions, causal_timeline: causalTimeline,
      elapsed_ms: delta,
    }).projected_world_state;
  }
  if (impacts.length !== 1)
    return blocked("exactly_one_contact_per_world_frontier_required");
  causalTimeline.entries = timelineEntries.sort((a, b) =>
    (a.time_ms ?? 0) - (b.time_ms ?? 0)
    || a.scene_id.localeCompare(b.scene_id, "en")
    || String(a.projectile_id).localeCompare(String(b.projectile_id), "en")
    || String(a.target).localeCompare(String(b.target), "en"));

  transitions.push({
    entity: "world", field: "simulation_time",
    from: state.simulation_time, to: nextTime,
    time_ms: delta, source_layer: "causal_resolution",
    adjudication: "world_offscreen_multiscene_projectile_staggered_step",
    cause: "World-owned joint projectile contact frontier +" + delta + "ms",
  });
  for (const sceneId of sceneIds) {
    transitions.push({
      entity: sceneId, field: "simulation_time", scene_id: sceneId,
      from: state.scenes[sceneId].simulation_time, to: nextTime,
      time_ms: delta, source_layer: "causal_resolution",
      adjudication: "world_offscreen_multiscene_projectile_staggered_step",
      cause: "scene " + sceneId + " advanced at shared projectile contact frontier",
    });
  }
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId, world_state_hash: snapshot.state_hash,
    state_transitions: transitions, causal_timeline: causalTimeline,
    elapsed_ms: delta,
  });
  if (queue.continuity_warning_count > 0 || queue.all_mutations_timed !== true)
    invalid("Dual projectile chronology has an unresolved mutation ordering.",
      "C6F_DUAL_PROJECTILE_CONTACT_CHRONOLOGY_INVALID");
  const preview = projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue,
  }).projected_world_state;
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: state, preview_world_state: preview, queue,
  });
  if (hashAgentRunValue(preview) !== hashAgentRunValue(execution.next_world_state)
    || execution.next_world_state.simulation_time !== nextTime)
    invalid("Dual projectile executor disagrees with its immutable projection.",
      "C6F_DUAL_PROJECTILE_CONTACT_EXECUTOR_MISMATCH");
  if (sceneIds.some(id =>
    execution.next_world_state.scenes[id]?.simulation_time !== nextTime))
    invalid("Dual projectile scenes did not reach the shared World frontier.",
      "C6F_DUAL_PROJECTILE_CONTACT_CLOCK_MISMATCH");

  const committed = await commitWorldSimulationTurn(sid, {
    expected_revision: snapshot.revision, expected_state_hash: snapshot.state_hash,
    turn_id: turnId, event, next_world_state: execution.next_world_state,
    selected_action_intents: [], state_transitions: transitions,
    action_outcomes: impacts, knowledge_transitions: [], scheduled_events: [],
    causal_timeline: causalTimeline,
    chronological_mutation_queue: queue,
    chronological_mutation_execution: execution.execution,
    pure_proposal_producers: {
      producer_outputs_contain_world_state: false,
      audit_count: producerAudits.length, audits: producerAudits,
    },
    immutable_causal_evaluators: {
      evaluator_outputs_contain_world_state: false,
      audit_count: immutableAudits.length, audits: immutableAudits,
    },
    immutable_event_queries: {
      audit_count: queryAudits.length, audits: queryAudits,
    },
    immutable_event_arbitration: {
      audit_count: arbitrationAudits.length, audits: arbitrationAudits,
    },
  }, options);
  return {
    ...committed, committed: true,
    version: worldSimulationOffscreenStaggeredProjectileStepVersion,
    world_simulation_session_id: sid, turn_id: turnId,
    previous_state_hash: snapshot.state_hash,
    reached_simulation_time: nextTime, elapsed_ms: delta,
    scene_ids: sceneIds, scene_plan: plan,
    automatic_replay_allowed: false,
  };
}
