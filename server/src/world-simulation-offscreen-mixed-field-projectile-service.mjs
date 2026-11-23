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

export const worldSimulationOffscreenMixedFieldProjectileVersion =
  "cb-c6f-independent-mixed-field-projectile-v1";

const obj = x => x && typeof x === "object" && !Array.isArray(x) ? x : {};
const arr = x => Array.isArray(x) ? x : [];
const copy = x => JSON.parse(JSON.stringify(x));
const finite = x => typeof x === "number" && Number.isFinite(x);
const point = x => finite(x?.x) && finite(x?.y);
const iso = x => typeof x === "string" && Number.isFinite(Date.parse(x))
  && new Date(Date.parse(x)).toISOString() === x;

function invalid(reason, code = "C6F_MIXED_PHYSICAL_STEP_INVALID") {
  const e = new Error(reason); e.code = code; throw e;
}

/**
 * Direct World-only proof of one independent persistent damaging field and
 * one projectile in a different scene. Field tick precedes, then coincides
 * with, projectile contact. No batch admission, cross-scene entity, actor
 * motion, obstacles, acoustic ingress or synthetic subjective state.
 *
 * Both scene clocks share one World frontier, a single mutation chronology
 * and one exact-CAS atomic World state/history transaction per frontier.
 */
export async function runWorldSimulationOffscreenMixedFieldProjectileStep(
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
      && !iso(input.target_horizon)))
    invalid("Mixed field/projectile step requires exact World CAS and ISO horizon.");
  if (options.causalAdjudicator !== undefined
    || options.worldSimulationTimeCeiling !== undefined
    || options.characterBrain !== undefined)
    invalid("Mixed physical step cannot override World authority or invoke Brain.");
  input = structuredClone(input);
  const sid = input.world_simulation_session_id;
  const before = await getWorldSimulationState(sid, options);
  if (before.revision !== input.expected_revision
    || before.state_hash !== input.expected_state_hash)
    invalid("Mixed field/projectile World identity is stale.",
      "C6F_MIXED_PHYSICAL_STEP_STALE");
  const state = before.state;
  const plan = projectWorldSimulationOffscreenSceneBreakpointPlan({
    world_state: state, target_horizon: input.target_horizon ?? null,
  });
  const blocked = blocked_reason => ({
    version: worldSimulationOffscreenMixedFieldProjectileVersion,
    world_simulation_session_id: sid, committed: false, blocked_reason,
    previous_state_hash: before.state_hash,
    reached_simulation_time: state.simulation_time,
    scene_plan: plan, automatic_replay_allowed: false,
  });
  if (plan.pending_queued_event_count) return blocked("queued_event_precedes_physical_step");
  if (plan.pending_acoustic_ingress_count) return blocked("listener_acoustic_ingress_pending");
  const fields = Object.entries(obj(state.ability_fields))
    .filter(([, p]) => p?.active === true);
  const shots = Object.entries(obj(state.projectiles))
    .filter(([, p]) => p?.active === true);
  const sceneIds = Object.keys(obj(state.scenes)).sort((a,b) => a.localeCompare(b,"en"));
  if (sceneIds.length !== 2 || fields.length !== 1 || shots.length !== 1
    || plan.active_scene_count !== 2
    || plan.scenes.length !== 2 || !plan.earliest_breakpoint_confirmed)
    return blocked("one_field_and_one_projectile_scene_required");
  const [fieldId, field] = fields[0];
  const [projectileId, projectile] = shots[0];
  if (!sceneIds.includes(field.scene_id) || !sceneIds.includes(projectile.scene_id)
    || field.scene_id === projectile.scene_id
    || field.field_id !== fieldId || projectile.projectile_id !== projectileId)
    return blocked("independent_scene_process_identity_required");

  const fieldScenePlan = plan.scenes.find(p => p.scene_id === field.scene_id);
  const shotScenePlan = plan.scenes.find(p => p.scene_id === projectile.scene_id);
  const delta = plan.global_breakpoint?.delta_ms;
  const tick = field.tick_ms;
  if (!Number.isSafeInteger(delta) || delta <= 0
    || !Number.isSafeInteger(tick) || tick <= 0
    || delta !== tick || delta > 1000
    || !Number.isSafeInteger(field.remaining_ms)
    || ![tick, tick * 2].includes(field.remaining_ms)
    || fieldScenePlan.active_field_ids.length !== 1
    || fieldScenePlan.active_projectile_ids.length
    || shotScenePlan.active_field_ids.length
    || shotScenePlan.active_projectile_ids.length !== 1
    || !["ability_field_tick","ability_field_expiration"]
      .includes(fieldScenePlan.next_breakpoint?.kind)
    || fieldScenePlan.next_breakpoint?.delta_ms !== delta
    || shotScenePlan.next_breakpoint?.kind !== "projectile_character"
    || !Number.isSafeInteger(shotScenePlan.next_breakpoint?.delta_ms)
    || (field.remaining_ms === tick * 2
      ? shotScenePlan.next_breakpoint.delta_ms !== 2 * tick
      : shotScenePlan.next_breakpoint.delta_ms !== tick))
    return blocked("mixed_two_tick_and_contact_frontier_required");

  const effect = obj(field.effect);
  if (!point(field.center) || !finite(field.radius_m) || field.radius_m <= 0
    || !finite(effect.damage_per_second)
    || effect.damage_per_second <= 0 || effect.damage_per_second > 100
    || Object.keys(effect).some(k => k !== "damage_per_second")
    || !point(projectile.position) || !point(projectile.velocity_mps)
    || !finite(projectile.radius_m) || projectile.radius_m <= 0
    || !finite(projectile.base_damage)
    || projectile.base_damage <= 0 || projectile.base_damage > 100
    || !finite(projectile.age_ms) || projectile.age_ms < 0
    || !finite(projectile.max_lifetime_ms)
    || projectile.max_lifetime_ms <= projectile.age_ms + delta)
    return blocked("mixed_physical_profile_outside_slice");

  const residentScene = new Map();
  for (const sceneId of sceneIds) {
    const scene = obj(state.scenes[sceneId]);
    if (scene.scene_id !== sceneId || scene.simulation_time !== state.simulation_time
      || !iso(scene.simulation_time) || arr(scene.obstacles).length)
      return blocked("scene_geometry_or_clock_unresolved");
    for (const name of Object.keys(obj(scene.entity_positions))) {
      if (!Object.hasOwn(obj(state.characters), name)) continue;
      if (residentScene.has(name))
        return blocked("cross_scene_character_identity_overlap");
      residentScene.set(name, sceneId);
    }
  }
  if (residentScene.get(field.owner) !== field.scene_id
    || residentScene.get(projectile.owner) !== projectile.scene_id)
    return blocked("independent_process_owner_not_resident");

  const nextTime = new Date(Date.parse(state.simulation_time) + delta).toISOString();
  const turnId = "world_mixed_field_projectile_" + hashAgentRunValue({
    session: sid, revision: before.revision, hash: before.state_hash,
    scene_ids: sceneIds, breakpoint: plan.global_breakpoint,
  }).slice(0, 24);
  const event = {
    event_id: turnId, type: "offscreen_mixed_field_projectile_step",
    scene_ids: sceneIds, simulation_time: state.simulation_time,
    source_authority: plan.authority,
  };
  const timeline = {
    entries: [], elapsed_ms: delta, scene_ids: sceneIds,
    physical_effects_only: true, action_selection_performed: false,
  };
  const transitions = [], outcomes = [], timelineEntries = [], producerAudits = [],
    immutableAudits = [], queryAudits = [], arbitrationAudits = [];
  let projected = copy(state);
  for (const sceneId of sceneIds) {
    const produced = runWorldSimulationPureProposalProducer({
      producer: "continuous_physics",
      turn_id: turnId, world_state_hash: before.state_hash,
      root_world_state: state, authoritative_world_state: projected,
      existing_state_transitions: transitions,
      causal_timeline: timeline, elapsed_ms: delta, scene_id: sceneId,
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
    const proposals = arr(produced.proposal_package.mutation_proposals);
    const members = new Set([...residentScene].filter(([, id]) =>
      id === sceneId).map(([name]) => name));
    const body = proposals.filter(p => typeof p.field === "string"
      && p.field.startsWith("physical_state.") && members.has(p.entity));
    const isField = sceneId === field.scene_id;
    if (isField) {
      const lifecycle = proposals.filter(p =>
        p.field === "ability_field_state" && p.entity === fieldId);
      const hits = arr(result.ability_resolutions);
      const tickOutcomes = arr(result.action_outcomes);
      if (lifecycle.length !== 1
        || proposals.length !== lifecycle.length + body.length
        || arr(result.projectile_resolutions).length
        || hits.length !== 1
        || hits[0].field_id !== fieldId || !members.has(hits[0].target)
        || hits[0].time_ms !== delta || !(hits[0].damage_applied > 0)
        || tickOutcomes.length !== 2
        || tickOutcomes.filter(o => o.result === "ability_field_tick"
          && o.target === hits[0].target).length !== 1
        || tickOutcomes.filter(o => o.result === "ability_field_applied"
          && o.target === hits[0].target).length !== 1
        || lifecycle[0].to?.remaining_ms !== field.remaining_ms - delta
        || lifecycle[0].to?.active !== (field.remaining_ms > delta))
        return blocked("mixed_field_damage_proposal_outside_slice");
      outcomes.push(...tickOutcomes.map(o => ({ ...o, scene_id: sceneId })));
      timelineEntries.push(...arr(result.timeline_entries)
        .filter(e => e.kind === "ability_field_tick")
        .map(e => ({ ...e, scene_id: sceneId })));
    } else {
      const lifecycles = proposals.filter(p =>
        p.field === "projectile_state" && p.entity === projectileId);
      const impacts = arr(result.projectile_resolutions);
      const actionOutcomes = arr(result.action_outcomes);
      const contactDue = field.remaining_ms === tick;
      const final = lifecycles.at(-1)?.to;
      if (!lifecycles.length
        || proposals.length !== lifecycles.length
          + (contactDue ? body.length : 0)
        || arr(result.ability_resolutions).length
        || !final || final.projectile_id !== projectileId)
        return blocked("mixed_projectile_lifecycle_outside_slice");
      if (contactDue) {
        if (impacts.length !== 1 || actionOutcomes.length !== 1
          || impacts[0].result !== "projectile_hit_character"
          || impacts[0].projectile_id !== projectileId
          || !members.has(impacts[0].target) || !(impacts[0].damage_applied > 0)
          || impacts[0].time_ms !== delta
          || actionOutcomes[0].result !== "projectile_hit_character"
          || actionOutcomes[0].target !== impacts[0].target
          || actionOutcomes[0].damage_applied !== impacts[0].damage_applied
          || final.active !== false
          || final.termination_reason !== "character_contact")
          return blocked("mixed_projectile_contact_outside_slice");
        outcomes.push({ ...actionOutcomes[0], scene_id: sceneId });
        timelineEntries.push(...arr(result.timeline_entries)
          .filter(e => e.kind === "projectile_resolution")
          .map(e => ({ ...e, scene_id: sceneId })));
      } else {
        const t = delta / 1000;
        if (impacts.length || actionOutcomes.length || final.active !== true
          || Math.abs(final.age_ms - (projectile.age_ms + delta)) > 1e-7
          || Math.abs(final.position?.x - (projectile.position.x
            + projectile.velocity_mps.x * t)) > 1e-7
          || Math.abs(final.position?.y - (projectile.position.y
            + projectile.velocity_mps.y * t)) > 1e-7
          || arr(result.timeline_entries).some(e =>
            e.kind === "projectile_resolution"))
          return blocked("mixed_later_projectile_not_in_flight");
      }
    }
    transitions.push(...proposals);
    producerAudits.push(produced.audit);
    immutableAudits.push(...arr(result.immutable_causal_evaluator_audits));
    queryAudits.push(...arr(result.immutable_causal_query_audits));
    arbitrationAudits.push(...arr(result.immutable_event_arbitration_audits));
    projected = projectWorldSimulationPureProposalTransitions({
      root_world_state: state, turn_id: turnId,
      world_state_hash: before.state_hash,
      state_transitions: transitions, causal_timeline: timeline,
      elapsed_ms: delta,
    }).projected_world_state;
  }
  timeline.entries = timelineEntries.sort((a,b) =>
    (a.time_ms ?? 0) - (b.time_ms ?? 0)
    || a.scene_id.localeCompare(b.scene_id,"en")
    || a.kind.localeCompare(b.kind,"en")
    || String(a.target).localeCompare(String(b.target),"en"));
  transitions.push({
    entity: "world", field: "simulation_time",
    from: state.simulation_time, to: nextTime,
    time_ms: delta, source_layer: "causal_resolution",
    adjudication: "world_offscreen_mixed_field_projectile_step",
    cause: "World-owned independent field/projectile frontier +" + delta + "ms",
  });
  for (const sceneId of sceneIds) {
    transitions.push({
      entity: sceneId, field: "simulation_time", scene_id: sceneId,
      from: state.scenes[sceneId].simulation_time, to: nextTime,
      time_ms: delta, source_layer: "causal_resolution",
      adjudication: "world_offscreen_mixed_field_projectile_step",
      cause: "scene " + sceneId + " advanced at joint physical frontier",
    });
  }
  const queue = buildWorldSimulationChronologicalMutationQueue({
    turn_id: turnId, world_state_hash: before.state_hash,
    state_transitions: transitions, causal_timeline: timeline,
    elapsed_ms: delta,
  });
  if (queue.continuity_warning_count > 0 || queue.all_mutations_timed !== true)
    invalid("Mixed physical chronology has unresolved mutation order.",
      "C6F_MIXED_PHYSICAL_CHRONOLOGY_INVALID");
  const preview = projectWorldSimulationChronologicalMutationQueue({
    world_state: state, queue,
  }).projected_world_state;
  const execution = executeWorldSimulationChronologicalMutationQueue({
    world_state: state, preview_world_state: preview, queue,
  });
  if (hashAgentRunValue(preview) !== hashAgentRunValue(execution.next_world_state)
    || execution.next_world_state.simulation_time !== nextTime
    || sceneIds.some(id =>
      execution.next_world_state.scenes[id]?.simulation_time !== nextTime))
    invalid("Mixed field/projectile timeline or clocks disagree with World execution.",
      "C6F_MIXED_PHYSICAL_EXECUTOR_MISMATCH");

  const committed = await commitWorldSimulationTurn(sid, {
    expected_revision: before.revision, expected_state_hash: before.state_hash,
    turn_id: turnId, event, next_world_state: execution.next_world_state,
    selected_action_intents: [], state_transitions: transitions,
    action_outcomes: outcomes, knowledge_transitions: [], scheduled_events: [],
    causal_timeline: timeline,
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
    version: worldSimulationOffscreenMixedFieldProjectileVersion,
    world_simulation_session_id: sid, turn_id: turnId,
    previous_state_hash: before.state_hash,
    reached_simulation_time: nextTime, elapsed_ms: delta,
    scene_ids: sceneIds, scene_plan: plan,
    automatic_replay_allowed: false,
  };
}
