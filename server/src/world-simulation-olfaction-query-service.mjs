import { hashAgentRunValue } from "./agent-run-service.mjs";

export const worldSimulationOlfactionQueryVersion = "body-1f-programmatic-olfaction-v1";
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const array = (value) => Array.isArray(value) ? value : [];
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function unit(value, code) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
    fail(code);
  return value;
}
function point(raw) {
  const value = object(raw);
  return Number.isFinite(value.x) && Number.isFinite(value.y)
    ? { x: value.x, y: value.y } : null;
}
function label(scene, observer, source) {
  const scoped = object(object(scene.olfactory_labels_by)[observer]);
  const value = scoped[source.id] ?? object(source.raw.olfactory_labels_by)[observer]
    ?? source.raw.generic_olfactory_label;
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160) : "unidentified_odor";
}
function solve(input) {
  const world = object(input.world_state);
  const scene = object(input.scene_state);
  const observer = typeof input.observer === "string" ? input.observer.trim() : "";
  if (!observer) fail("BODY1F_OBSERVER_REQUIRED");
  const sceneId = String(input.scene_id ?? scene.scene_id ?? scene.id ?? "");
  const observerPosition = point(object(scene.entity_positions)[observer]);
  const sceneProfile = object(object(scene.olfactory_profiles)[observer]);
  const characterProfile = object(object(world.characters)[observer]).olfactory_profile;
  const profile = { ...sceneProfile, ...object(characterProfile) };
  const enabled = profile.receptor_enabled === true;
  if (profile.receptor_enabled !== undefined && typeof profile.receptor_enabled !== "boolean")
    fail("BODY1F_RECEPTOR_INVALID");
  const threshold = enabled
    ? unit(profile.detection_threshold, "BODY1F_THRESHOLD_INVALID") : null;
  const rawSources = [
    ...array(scene.odor_sources),
    ...array(world.odor_sources).filter((raw) =>
      String(object(raw).scene_id ?? "") === sceneId && sceneId !== ""),
  ];
  if (rawSources.length > 64) fail("BODY1F_SOURCE_LIMIT");
  const observations = [];
  const sourceAudit = [];
  for (const [index, raw] of rawSources.entries()) {
    const source = object(raw);
    if (source.active === false || source.ended === true) continue;
    const id = String(source.id ?? source.odor_id ?? `odor_${index + 1}`);
    const strength = unit(source.strength, "BODY1F_STRENGTH_INVALID");
    const range = source.max_range_m;
    if (typeof range !== "number" || !Number.isFinite(range) || range <= 0 || range > 1000)
      fail("BODY1F_RANGE_INVALID");
    const position = point(source.position);
    if (!position) fail("BODY1F_SOURCE_POSITION_INVALID");
    const distance = observerPosition
      ? Math.hypot(observerPosition.x - position.x, observerPosition.y - position.y)
      : null;
    const received = distance === null || distance > range ? 0
      : strength / (1 + (distance / range) ** 2);
    const detected = enabled && observerPosition !== null
      && distance <= range && received >= threshold && strength > 0;
    sourceAudit.push({
      odor_id: id, source_position: position, distance_m: distance,
      received_strength: received, detected,
    });
    if (detected) observations.push({
      sense: "olfactory", kind: "detected_odor",
      perceptual_label: label(scene, observer, { id, raw: source }),
    });
  }
  return {
    status: "olfaction_resolved", observer, scene_id: sceneId,
    olfaction_enforced: enabled && observerPosition !== null,
    observer_position_available: observerPosition !== null,
    receptor_enabled: enabled,
    source_count: sourceAudit.length,
    detected_count: observations.length,
    source_audit: sourceAudit,
    perception_olfactory_observations: observations,
    olfaction_boundary: {
      explicit_receptor_and_threshold_required: true,
      same_scene_only: true, source_limit: 64,
      radial_bounded_distance_rule: "strength/(1+(distance/max_range)^2)",
      wind_and_obstacles_modeled: false,
      source_identity_inferred_from_engine_id: false,
      engine_source_id_and_exact_position_engine_only: true,
    },
  };
}
export function queryWorldSimulationObserverOlfaction(input = {}) {
  const context = clone({
    world_state: object(input.world_state), scene_state: object(input.scene_state),
    scene_id: input.scene_id ?? null, observer: input.observer ?? null,
  });
  const inputHash = hashAgentRunValue(context);
  const first = solve(context);
  const firstHash = hashAgentRunValue(first);
  if (input.verify_determinism !== false && firstHash !== hashAgentRunValue(solve(context)))
    fail("BODY1F_NONDETERMINISTIC");
  if (hashAgentRunValue(context) !== inputHash) fail("BODY1F_INPUT_MUTATION");
  return {
    olfaction_query_version: worldSimulationOlfactionQueryVersion,
    result: first,
    audit: {
      input_context_hash: inputHash, result_hash: firstHash,
      deterministic_replay_verified: input.verify_determinism !== false,
      read_only: true,
    },
  };
}
export function buildWorldSimulationOlfactionQueryContract() {
  return {
    version: worldSimulationOlfactionQueryVersion,
    owner: "programmatic_sensory_query", read_only: true,
    explicit_receptor_required: true, explicit_threshold_required: true,
    same_scene_only: true, source_limit: 64,
    brain_receives_engine_source_ids: false,
    brain_receives_exact_source_positions: false,
    brain_receives_exact_received_strength: false,
    wind_and_obstacles_modeled: false,
  };
}
