import { hashAgentRunValue } from "./agent-run-service.mjs";
import { worldSimulationObserverTickPerceptionVersion } from "./world-simulation-observer-tick-perception-service.mjs";

export const worldSimulationObserverTickBrainIngressVersion =
  "cc7i-observer-tick-brain-ingress-v1";

const record = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
function reject(message) {
  const error = new Error(message);
  error.code = "CC7I_OBSERVER_TICK_BRAIN_INGRESS_INVALID";
  throw error;
}
function exactKeys(value, keys, label) {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)))
    reject(`${label} contains fields outside its allowlist.`);
}

export function buildWorldSimulationObserverTickBrainIngressContract() {
  return {
    version: worldSimulationObserverTickBrainIngressVersion,
    source: "cc7h_observer_scoped_exact_tick_perception",
    optional_resolver_only: true,
    one_observer_one_tick_per_invocation: true,
    future_tick_and_other_observer_views_exposed: false,
    source_world_snapshot_exposed: false,
    engine_target_or_action_ids_exposed: false,
    callback_input_cloned: true,
    response_status_and_attended_senses_only: true,
    subjective_response_has_no_causal_authority: true,
    no_resolver_means_no_brain_invocation: true,
    no_new_action_or_speech_decision_accepted: true,
    no_world_mutation_or_commit: true,
    post_causal_speculative_handoff_only: true,
    actual_mid_turn_world_action_replanning: false,
    persistent_audit_contains_views_or_response_text: false,
  };
}

const blank = (status, resolverUsed = false) => ({
  schema_version: worldSimulationObserverTickBrainIngressVersion,
  status,
  resolver_used: resolverUsed,
  invocation_count: 0,
  noticed_count: 0,
  audit: [],
  boundaries: buildWorldSimulationObserverTickBrainIngressContract(),
});

const validStatuses = new Set(["noticed", "uncertain", "no_noticing"]);
const validSenses = new Set(["visual", "auditory"]);

function validatedView(source) {
  exactKeys(source, [
    "schema_version", "observer", "release_time_ms", "visual",
    "heard_nonlexical", "world_truth_authority",
    "future_release_exposed", "world_snapshot_exposed",
  ], "CC-7H view");
  if (source.schema_version !== worldSimulationObserverTickPerceptionVersion
      || typeof source.observer !== "string" || !source.observer.trim()
      || [...source.observer].length > 240
      || !Number.isFinite(source.release_time_ms)
      || source.release_time_ms < 0
      || !Array.isArray(source.visual)
      || !Array.isArray(source.heard_nonlexical)
      || source.visual.length > 4096
      || source.heard_nonlexical.length > 4096
      || source.world_truth_authority !== false
      || source.future_release_exposed !== false
      || source.world_snapshot_exposed !== false)
    reject("CC-7I requires bounded, observer-scoped CC-7H perception.");
  for (const item of source.visual) {
    exactKeys(item, ["sense", "kind", "perceptual_label", "distance_m", "relative_position"], "visual cue");
    exactKeys(item.relative_position, ["dx_m", "dy_m"], "relative position");
    if (item.sense !== "visual"
        || !["visible_entity", "visible_object"].includes(item.kind)
        || typeof item.perceptual_label !== "string"
        || !item.perceptual_label.trim()
        || [...item.perceptual_label].length > 240
        || !Number.isFinite(item.distance_m) || item.distance_m < 0
        || !Number.isFinite(item.relative_position.dx_m)
        || !Number.isFinite(item.relative_position.dy_m))
      reject("CC-7I only accepts Phase62W visible allowlisted cues.");
  }
  for (const item of source.heard_nonlexical) {
    exactKeys(item, [
      "signal_phase", "perceived_cue_refs", "anonymous_voice_ref",
      "heard_surface_fragment", "speaker_identity_recognized",
      "lexical_intelligibility_attested",
    ], "auditory cue");
    if (!["ongoing", "locally_suspended", "acoustic_segment_ended"].includes(item.signal_phase)
        || !Array.isArray(item.perceived_cue_refs)
        || item.perceived_cue_refs.length !== 1
        || typeof item.perceived_cue_refs[0] !== "string"
        || !item.perceived_cue_refs[0].trim()
        || [...item.perceived_cue_refs[0]].length > 240
        || typeof item.anonymous_voice_ref !== "string"
        || !/^anonymous_voice_[a-f0-9]{24}$/.test(item.anonymous_voice_ref)
        || item.heard_surface_fragment !== null
        || item.speaker_identity_recognized !== false
        || item.lexical_intelligibility_attested !== false)
      reject("CC-7I accepts only verified nonlexical auditory cues.");
  }
  // Construct from the allowlisted source, never relay references to the
  // private World state, source ledger, or aggregate observer view list.
  return copy(source);
}

function validateResponse(raw, view) {
  exactKeys(raw, ["noticing_status", "attended_senses"], "observer response");
  if (!validStatuses.has(raw.noticing_status)
      || !Array.isArray(raw.attended_senses)
      || raw.attended_senses.length > 2
      || new Set(raw.attended_senses).size !== raw.attended_senses.length
      || raw.attended_senses.some((sense) => !validSenses.has(sense)))
    reject("Observer response must contain bounded noticing and sensory kinds.");
  if ((raw.attended_senses.includes("visual") && !view.visual.length)
      || (raw.attended_senses.includes("auditory") && !view.heard_nonlexical.length)
      || (raw.noticing_status === "no_noticing" && raw.attended_senses.length))
    reject("Observer cannot claim attention to absent or unnoticed cues.");
  return {
    noticing_status: raw.noticing_status,
    attended_senses: [...raw.attended_senses].sort(),
  };
}

/**
 * A post-causal, opt-in Brain-facing observer perception handoff.
 * No selected actions are re-opened, no World snapshots or future observer
 * views are supplied, and only counts/statuses are persisted.
 */
export async function runWorldSimulationObserverTickBrainIngress({
  perception,
  resolver = null,
} = {}) {
  if (resolver != null && typeof resolver !== "function")
    reject("Resolver must be a callable observer-only adapter.");
  if (!resolver) return blank("resolver_not_installed");
  if (!record(perception)
      || perception.audit?.schema_version !== worldSimulationObserverTickPerceptionVersion
      || !Array.isArray(perception.engine_private_character_views))
    reject("CC-7I requires CC-7H engine-private character views.");
  if (perception.audit.status !== "observer_views_engine_private")
    return blank("no_verified_observer_views", true);
  const views = perception.engine_private_character_views;
  if (views.length !== perception.audit.character_view_count || views.length > 128)
    reject("CC-7I observer view count exceeds verified bound.");
  const seen = new Set();
  let previousTime = -Infinity;
  let previousObserver = "";
  const audit = [];
  let noticedCount = 0;
  for (const source of views) {
    const view = validatedView(source);
    const key = JSON.stringify([view.observer, view.release_time_ms]);
    if (seen.has(key)) reject("Duplicate observer/tick Brain ingress.");
    seen.add(key);
    if (view.release_time_ms < previousTime
        || (view.release_time_ms === previousTime
          && view.observer.localeCompare(previousObserver, "en") <= 0))
      reject("CC-7I requires causal tick order, then observer order.");
    previousTime = view.release_time_ms;
    previousObserver = view.observer;
    const packet = {
      schema_version: worldSimulationObserverTickBrainIngressVersion,
      observer: view.observer,
      release_time_ms: view.release_time_ms,
      perception: {
        visual: view.visual,
        heard_nonlexical: view.heard_nonlexical,
      },
      boundaries: {
        world_truth_authority: false,
        action_selection_available: false,
        world_effect_authority: false,
        future_tick_available: false,
      },
    };
    const raw = await resolver(copy(packet));
    const decision = raw == null
      ? { noticing_status: "no_noticing", attended_senses: [] }
      : validateResponse(raw, view);
    if (decision.noticing_status === "noticed") noticedCount += 1;
    audit.push({
      release_time_ms: view.release_time_ms,
      response_status: decision.noticing_status,
      attended_senses: decision.attended_senses,
      observer_ref: `observer_${hashAgentRunValue({
        version: worldSimulationObserverTickBrainIngressVersion,
        observer: view.observer,
      }).slice(0, 24)}`,
    });
  }
  return {
    schema_version: worldSimulationObserverTickBrainIngressVersion,
    status: "post_causal_subjective_noticing_only",
    resolver_used: true,
    invocation_count: audit.length,
    noticed_count: noticedCount,
    audit,
    boundaries: buildWorldSimulationObserverTickBrainIngressContract(),
  };
}
