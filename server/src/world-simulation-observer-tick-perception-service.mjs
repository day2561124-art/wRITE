import { hashAgentRunValue } from "./agent-run-service.mjs";
import { queryWorldSimulationObserverVisibility } from "./world-simulation-visibility-query-service.mjs";
import { worldSimulationObserverMicrotickLedgerVersion } from "./world-simulation-observer-microtick-ledger-service.mjs";
import { worldSimulationObserverTickPrefixReconstructionVersion } from "./world-simulation-observer-tick-prefix-reconstruction-service.mjs";

export const worldSimulationObserverTickPerceptionVersion =
  "cc7h-observer-scoped-tick-perception-v1";

const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
function fail(message) {
  const error = new Error(message);
  error.code = "CC7H_TICK_PERCEPTION_INVALID";
  throw error;
}
function name(v) {
  return typeof v === "string" && v.trim() && [...v].length <= 240 ? v : null;
}
export function buildWorldSimulationObserverTickPerceptionContract() {
  return {
    version: worldSimulationObserverTickPerceptionVersion,
    source: "cc7g_exact_prefix_and_phase62w_visibility_and_cc7e_heard_cues",
    reconstructed_world_state_engine_only: true,
    visibility_engine_target_ids_exposed: false,
    raw_visibility_query_exposed: false,
    other_character_private_state_exposed: false,
    unlabelled_entity_identity_inferred: false,
    visual_observations_allowlisted_only: true,
    acoustic_cues_nonlexical_only: true,
    other_observer_cues_exposed: false,
    future_releases_exposed: false,
    persistence_contains_character_views: false,
    character_brain_invoked: false,
    real_time_mid_turn_replanning: false,
    world_mutation: false,
  };
}
const empty = (reason) => ({
  audit: {
    schema_version: worldSimulationObserverTickPerceptionVersion,
    status: "not_projected",
    reason,
    tick_count: 0,
    character_view_count: 0,
    boundaries: buildWorldSimulationObserverTickPerceptionContract(),
  },
  engine_private_character_views: [],
});

function safeVisual(value) {
  if (!isRecord(value) || value.sense !== "visual"
    || !["visible_entity", "visible_object"].includes(value.kind)
    || !name(value.perceptual_label)
    || !Number.isFinite(value.distance_m) || value.distance_m < 0
    || !isRecord(value.relative_position)
    || !Number.isFinite(value.relative_position.dx_m)
    || !Number.isFinite(value.relative_position.dy_m))
    return null;
  return {
    sense: "visual",
    kind: value.kind,
    perceptual_label: value.perceptual_label,
    distance_m: value.distance_m,
    relative_position: {
      dx_m: value.relative_position.dx_m,
      dy_m: value.relative_position.dy_m,
    },
  };
}

/**
 * Engine-only, post-causal speculative observer views; do not persist or
 * forward these to Character Brain without a subsequent controlled ingress.
 * Only explicitly labelled Phase62W visible items and this observer's current
 * nonlexical CC7E acoustic cues survive. No future tick is folded in.
 */
export function projectWorldSimulationObserverTickPerceptions({
  ledger,
  reconstruction,
  scene_id = null,
} = {}) {
  if (!isRecord(ledger)
      || ledger.schema_version !== worldSimulationObserverMicrotickLedgerVersion
      || !Array.isArray(ledger.ticks)
      || ledger.tick_count !== ledger.ticks.length)
    fail("A bounded CC-7E release ledger is required.");
  const { ledger_hash, ...payload } = ledger;
  if (ledger_hash !== hashAgentRunValue(payload))
    fail("Refuse altered CC-7E release ledger.");
  const audit = reconstruction?.audit;
  const snapshots = reconstruction?.engine_snapshots;
  if (!isRecord(audit)
      || audit.schema_version !== worldSimulationObserverTickPrefixReconstructionVersion)
    fail("CC-7G reconstruction audit is required.");
  if (audit.status !== "engine_private_prefixes_reconstructed")
    return empty("no_verified_engine_private_prefix");
  if (audit.readiness_ledger_hash !== ledger_hash
      || !Array.isArray(audit.ticks)
      || !Array.isArray(snapshots)
      || audit.ticks.length !== snapshots.length
      || snapshots.length !== ledger.tick_count
      || snapshots.length > 32)
    fail("Tick reconstruction and CC-7E ledger lineage mismatch.");

  const views = [];
  const tickAudits = [];
  for (let i = 0; i < snapshots.length; i += 1) {
    const snapshot = snapshots[i];
    const tick = ledger.ticks[i];
    const receipt = audit.ticks[i];
    if (!isRecord(snapshot) || !isRecord(snapshot.world_state)
        || !isRecord(tick) || !isRecord(receipt)
        || tick.release_time_ms !== snapshot.release_time_ms
        || tick.release_time_ms !== receipt.release_time_ms
        || receipt.reconstructed_world_state_hash !==
          hashAgentRunValue(snapshot.world_state)
        || snapshot.reconstructed_world_state_hash !==
          receipt.reconstructed_world_state_hash
        || snapshot.mutation_prefix_ref !== receipt.mutation_prefix_ref)
      fail("Tick must be bound to its exact verified World prefix.");
    if (!Array.isArray(tick.observer_cues))
      fail("Observer cues must be a bounded array.");
    const grouped = new Map();
    for (const item of tick.observer_cues) {
      if (!isRecord(item) || !name(item.observer)
          || !isRecord(item.observer_increment)
          || item.observer_increment.observer !== item.observer
          || item.observer_increment.heard_surface_fragment !== null
          || item.observer_increment.no_future_increment_exposed !== true
          || item.observer_increment.lexical_intelligibility_attested !== false
          || item.observer_increment.speaker_identity_recognized !== false)
        fail("Only observer-scoped CC-7E nonlexical cues are allowed.");
      if (!grouped.has(item.observer)) grouped.set(item.observer, []);
      grouped.get(item.observer).push({
        signal_phase: item.observer_increment.signal_phase,
        perceived_cue_refs: copy(item.observer_increment.perceived_cue_refs),
        anonymous_voice_ref: `anonymous_voice_${hashAgentRunValue({
          observer: item.observer,
          signal: item.observer_increment.signal_ref,
        }).slice(0, 24)}`,
        heard_surface_fragment: null,
        speaker_identity_recognized: false,
        lexical_intelligibility_attested: false,
      });
    }
    for (const observer of [...grouped.keys()].sort((a, b) => a.localeCompare(b, "en"))) {
      const state = snapshot.world_state;
      const scene = scene_id && isRecord(state.scenes?.[scene_id])
        ? state.scenes[scene_id]
        : isRecord(state.scene_state) ? state.scene_state : null;
      // Do not infer a scene or geometry from a global World snapshot.
      const sceneMatches = scene && name(scene.scene_id ?? scene.id)
        && (!scene_id || (scene.scene_id ?? scene.id) === scene_id);
      let visual = [];
      if (sceneMatches) {
        const query = queryWorldSimulationObserverVisibility({
          world_state: state,
          scene_state: scene,
          scene_id: scene.scene_id ?? scene.id,
          observer,
        });
        visual = (query.result.perception_visual_observations ?? [])
          .map(safeVisual).filter(Boolean);
      }
      const view = {
        schema_version: worldSimulationObserverTickPerceptionVersion,
        observer,
        release_time_ms: tick.release_time_ms,
        visual,
        heard_nonlexical: grouped.get(observer),
        world_truth_authority: false,
        future_release_exposed: false,
        world_snapshot_exposed: false,
      };
      views.push(view);
    }
    tickAudits.push({
      release_time_ms: tick.release_time_ms,
      observer_view_count: grouped.size,
      source_prefix_hash: receipt.reconstructed_world_state_hash,
    });
  }
  return {
    audit: {
      schema_version: worldSimulationObserverTickPerceptionVersion,
      status: "observer_views_engine_private",
      tick_count: snapshots.length,
      character_view_count: views.length,
      ticks: tickAudits,
      boundaries: buildWorldSimulationObserverTickPerceptionContract(),
    },
    engine_private_character_views: views,
  };
}
