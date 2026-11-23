import { projectWorldSimulationOffscreenBreakpoint } from "./world-simulation-offscreen-breakpoint-service.mjs";
import { worldSimulationCommunicationAcousticBridgeVersion } from "./world-simulation-communication-acoustic-bridge-service.mjs";

export const worldSimulationOffscreenSceneBreakpointPlanVersion =
  "cb-c6f-multiscene-breakpoint-plan-v1";

const object = value => value && typeof value === "object" && !Array.isArray(value)
  ? value : {};
const array = value => Array.isArray(value) ? value : [];
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * Read-only cross-scene physical schedule evidence. Every active scene shares
 * ONE World-time frontier; even a scene with a later next event must be
 * accounted for when the global earliest breakpoint is reached.
 *
 * This planner does NOT authorize a physical step. The existing per-scene
 * continuous-physics evaluator and chronological executor have not yet been
 * combined into a proven atomic multi-scene writer.
 */
export function projectWorldSimulationOffscreenSceneBreakpointPlan({
  world_state, target_horizon = null,
} = {}) {
  const state = clone(object(world_state));
  const global = projectWorldSimulationOffscreenBreakpoint({
    world_state: state, target_horizon,
  });
  const fields = Object.entries(object(state.ability_fields))
    .filter(([, field]) => field?.active === true);
  const projectiles = Object.entries(object(state.projectiles))
    .filter(([, projectile]) => projectile?.active === true);
  const byScene = new Map();
  for (const [kind, entries] of [["field", fields], ["projectile", projectiles]]) {
    for (const [id, process] of entries) {
      const sceneId = typeof process.scene_id === "string" ? process.scene_id.trim() : "";
      const group = byScene.get(sceneId) ?? { fields: [], projectiles: [] };
      group[kind === "field" ? "fields" : "projectiles"].push([id, process]);
      byScene.set(sceneId, group);
    }
  }
  const globalDelta = global.breakpoint?.delta_ms ?? null;
  const scenes = [...byScene].sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([sceneId, group]) => {
      const sceneExists = Boolean(sceneId && Object.hasOwn(object(state.scenes), sceneId)
        && Object.keys(object(state.scenes)[sceneId]).length > 0);
      const scoped = {
        ...state,
        ability_fields: Object.fromEntries(group.fields),
        projectiles: Object.fromEntries(group.projectiles),
      };
      const local = sceneExists
        ? projectWorldSimulationOffscreenBreakpoint({
          world_state: scoped, target_horizon,
        }) : null;
      return {
        scene_id: sceneId,
        scene_exists: sceneExists,
        active_field_ids: group.fields.map(([id]) => id).sort(),
        active_projectile_ids: group.projectiles.map(([id]) => id).sort(),
        next_breakpoint: local?.breakpoint ?? null,
        local_unresolved_process_count: local?.unresolved_process_count ?? null,
        shares_global_time_frontier: globalDelta !== null,
        global_frontier_delta_ms: globalDelta,
        breakpoint_due_at_global_frontier: Boolean(local?.breakpoint
          && local.breakpoint.delta_ms === globalDelta),
        future_or_unresolved_at_global_frontier: Boolean(globalDelta !== null
          && (!local?.breakpoint || local.breakpoint.delta_ms > globalDelta)),
      };
    });

  const missingSceneIds = scenes.filter(item => !item.scene_exists)
    .map(item => item.scene_id);
  const pendingEventCount = array(state.event_queue).length;
  const pendingAcousticCount = array(state.sound_events)
    .filter(signal => signal?.schema_version === worldSimulationCommunicationAcousticBridgeVersion)
    .length;
  const blocked = pendingEventCount ? "queued_event_precedes_physical_step"
    : pendingAcousticCount ? "listener_acoustic_ingress_pending"
      : global.unresolved_process_count || missingSceneIds.length
        ? "unresolved_physical_authority"
        : globalDelta === null ? "no_confirmed_physical_breakpoint"
          : scenes.length > 1
            ? "atomic_multiscene_physical_executor_not_verified"
            : "single_active_scene_existing_owner_required";

  return Object.freeze({
    version: worldSimulationOffscreenSceneBreakpointPlanVersion,
    authority: "world_read_only_cross_scene_schedule_evidence",
    source_world_time: state.simulation_time,
    requested_target_horizon: target_horizon,
    global_breakpoint: global.breakpoint ? Object.freeze({ ...global.breakpoint }) : null,
    earliest_breakpoint_confirmed: global.earliest_breakpoint_confirmed
      && missingSceneIds.length === 0,
    active_scene_count: scenes.length,
    scenes: Object.freeze(scenes.map(scene => Object.freeze(scene))),
    missing_scene_ids: Object.freeze(missingSceneIds),
    unresolved_processes: global.unresolved_processes,
    pending_queued_event_count: pendingEventCount,
    pending_acoustic_ingress_count: pendingAcousticCount,
    admission_status: blocked,
    multi_scene_atomic_execution_authorized: false,
    source_world_mutated: false,
    world_time_advanced: false,
    brain_invoked: false,
    subjective_memory_created: false,
    physical_effect_adjudicated: false,
  });
}
