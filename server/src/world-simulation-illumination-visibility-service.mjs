import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  queryWorldSimulationObserverDirectionalHeightVisibility,
  worldSimulationDirectionalHeightVisibilityVersion,
} from "./world-simulation-directional-height-visibility-service.mjs";

export const worldSimulationIlluminationVisibilityVersion = "phase62y-illumination-visibility-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function object(value) { return isObject(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value ?? null)); }
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function nonNegativeNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 ? number : fallback;
}
function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}
function point(value) {
  const record = object(value);
  const x = finiteNumber(record.x);
  const y = finiteNumber(record.y);
  return x === null || y === null ? null : { x, y };
}
function rounded(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
function stableCompare(left, right) {
  return String(left).localeCompare(String(right), "en", { sensitivity: "base" });
}

const TIER_RANK = Object.freeze({ unresolved: 0, silhouette: 1, dim: 2, clear: 3 });

function visibilityProfile(scene, targetId, kind = "entity") {
  const common = object(scene.visibility_profiles)[targetId];
  const scoped = kind === "entity"
    ? object(scene.entity_visibility_profiles)[targetId]
    : object(scene.object_visibility_profiles)[targetId];
  return { ...object(common), ...object(scoped) };
}

function thresholdRecord(worldState, scene, observer) {
  const lighting = object(scene.lighting);
  const profile = visibilityProfile(scene, observer, "entity");
  const character = object(object(worldState.characters)[observer]);
  const raw = object(
    profile.illumination_thresholds_lux
      ?? profile.lighting_thresholds_lux
      ?? character.illumination_thresholds_lux
      ?? object(lighting.observer_thresholds_lux)[observer]
      ?? lighting.default_thresholds_lux,
  );
  if (!Object.keys(raw).length) return null;
  const silhouette = nonNegativeNumber(raw.silhouette_min_lux ?? raw.silhouette ?? raw.minimum_silhouette_lux);
  const dim = nonNegativeNumber(raw.dim_min_lux ?? raw.dim ?? raw.minimum_dim_lux);
  const clear = nonNegativeNumber(raw.clear_min_lux ?? raw.clear ?? raw.minimum_clear_lux);
  if ([silhouette, dim, clear].some((item) => item === null)) {
    const error = new Error("Illumination thresholds require explicit silhouette, dim, and clear lux values.");
    error.code = "WORLD_SIMULATION_ILLUMINATION_THRESHOLDS_INCOMPLETE";
    throw error;
  }
  if (!(silhouette <= dim && dim <= clear)) {
    const error = new Error("Illumination thresholds must satisfy silhouette <= dim <= clear.");
    error.code = "WORLD_SIMULATION_ILLUMINATION_THRESHOLDS_INVALID";
    throw error;
  }
  return { silhouette_min_lux: silhouette, dim_min_lux: dim, clear_min_lux: clear };
}

function rectangleFor(raw) {
  const value = object(raw);
  const xMin = finiteNumber(value.x_min ?? value.left);
  const xMax = finiteNumber(value.x_max ?? value.right);
  const yMin = finiteNumber(value.y_min ?? value.top);
  const yMax = finiteNumber(value.y_max ?? value.bottom);
  if ([xMin, xMax, yMin, yMax].every((item) => item !== null)) {
    return {
      xMin: Math.min(xMin, xMax), xMax: Math.max(xMin, xMax),
      yMin: Math.min(yMin, yMax), yMax: Math.max(yMin, yMax),
    };
  }
  const center = point(value.position ?? value.center);
  const width = positiveNumber(value.width_m ?? value.width);
  const depth = positiveNumber(value.depth_m ?? value.depth ?? value.length_m ?? value.length);
  if (!center || width === null || depth === null) return null;
  return {
    xMin: center.x - width / 2, xMax: center.x + width / 2,
    yMin: center.y - depth / 2, yMax: center.y + depth / 2,
  };
}
function pointInsideRectangle(position, rectangle) {
  return position.x >= rectangle.xMin && position.x <= rectangle.xMax
    && position.y >= rectangle.yMin && position.y <= rectangle.yMax;
}
function segmentIntersectsRectangle(from, to, rectangle) {
  if (pointInsideRectangle(from, rectangle) || pointInsideRectangle(to, rectangle)) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [
    [-dx, from.x - rectangle.xMin], [dx, rectangle.xMax - from.x],
    [-dy, from.y - rectangle.yMin], [dy, rectangle.yMax - from.y],
  ]) {
    if (Math.abs(p) <= 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return false;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return false;
      if (ratio < t1) t1 = ratio;
    }
  }
  return t0 <= t1 && t1 > 1e-9 && t0 < 1 - 1e-9;
}

function lightBlockers(scene) {
  const output = [];
  const push = (sourceKind, id, raw, dedicated = false) => {
    const record = object(raw);
    if (record.active === false || record.destroyed === true || record.transparent === true) return;
    if (!dedicated && record.blocks_light !== true) return;
    if (dedicated && record.blocks_light === false) return;
    if (sourceKind === "door" && record.open === true) return;
    const rectangle = rectangleFor(record);
    if (!rectangle) return;
    output.push({ blocker_id: String(id ?? `${sourceKind}_${output.length + 1}`), source_kind: sourceKind, rectangle });
  };
  array(scene.light_blockers).forEach((item, index) => push("light_blocker", item?.id ?? index, item, true));
  array(scene.visibility_blockers).forEach((item, index) => push("visibility_blocker", item?.id ?? index, item));
  array(scene.obstacles).forEach((item, index) => push("obstacle", item?.id ?? index, item));
  array(scene.structures).forEach((item, index) => push("structure", item?.id ?? index, item));
  for (const [id, door] of Object.entries(object(scene.doors))) push("door", id, door);
  return output.sort((a, b) => stableCompare(`${a.source_kind}:${a.blocker_id}`, `${b.source_kind}:${b.blocker_id}`));
}

function sourceLuxAtReference(raw) {
  const source = object(raw);
  const atOne = nonNegativeNumber(source.illuminance_lux_at_1m ?? source.lux_at_1m);
  if (atOne !== null) return { lux: atOne, reference_distance_m: 1 };
  const lux = nonNegativeNumber(source.illuminance_lux_at_reference ?? source.lux_at_reference);
  const reference = positiveNumber(source.reference_distance_m);
  return lux === null || reference === null ? null : { lux, reference_distance_m: reference };
}
function lightSources(scene) {
  const lighting = object(scene.lighting);
  const rawSources = [...array(lighting.light_sources), ...array(lighting.point_lights)];
  return rawSources.map((raw, index) => {
    const record = object(raw);
    if (record.active === false || record.destroyed === true) return null;
    const position = point(record.position ?? record.center ?? record);
    const reference = sourceLuxAtReference(record);
    if (!position || !reference) return null;
    return {
      light_id: String(record.light_id ?? record.id ?? `light_${index + 1}`),
      position,
      reference_lux: reference.lux,
      reference_distance_m: reference.reference_distance_m,
      max_range_m: positiveNumber(record.max_range_m),
      intensity_multiplier: nonNegativeNumber(record.intensity_multiplier, 1),
      occlusion_enabled: record.occlusion_enabled !== false,
    };
  }).filter(Boolean).sort((a, b) => stableCompare(a.light_id, b.light_id));
}

function explicitTargetLux(scene, kind, targetId) {
  const lighting = object(scene.lighting);
  const configured = object(lighting.target_illumination_lux ?? lighting.target_lux);
  const scoped = kind === "entity" ? object(configured.entities) : object(configured.objects);
  const value = Object.hasOwn(scoped, targetId) ? scoped[targetId] : configured[targetId];
  return nonNegativeNumber(value);
}
function targetPosition(worldState, scene, sceneId, kind, targetId) {
  if (kind === "entity") return point(object(scene.entity_positions)[targetId]);
  const scenePosition = point(object(scene.object_positions)[targetId]);
  if (scenePosition) return scenePosition;
  const record = object(object(worldState.objects)[targetId]);
  if (record.holder) return null;
  const targetScene = record.scene_id ?? record.location_id ?? null;
  if (sceneId && targetScene && String(sceneId) !== String(targetScene)) return null;
  return point(record.position);
}

function illuminationAtTarget({ scene, worldState, sceneId, kind, targetId, sources, blockers }) {
  const explicit = explicitTargetLux(scene, kind, targetId);
  if (explicit !== null) {
    return { total_lux: rounded(explicit), source: "explicit_target_illumination", ambient_lux: null, contributions: [] };
  }
  const lighting = object(scene.lighting);
  const ambientConfigured = lighting.ambient_lux !== undefined && lighting.ambient_lux !== null && lighting.ambient_lux !== "";
  const ambient = ambientConfigured ? nonNegativeNumber(lighting.ambient_lux) : 0;
  if (ambientConfigured && ambient === null) {
    const error = new Error("scene.lighting.ambient_lux must be a non-negative number.");
    error.code = "WORLD_SIMULATION_ILLUMINATION_AMBIENT_INVALID";
    throw error;
  }
  const target = targetPosition(worldState, scene, sceneId, kind, targetId);
  if (!target) return { total_lux: rounded(ambient), source: "ambient_only", ambient_lux: rounded(ambient), contributions: [] };
  const contributions = [];
  let total = ambient;
  for (const source of sources) {
    const distance = Math.hypot(target.x - source.position.x, target.y - source.position.y);
    if (source.max_range_m !== null && distance > source.max_range_m + 1e-9) {
      contributions.push({ light_id: source.light_id, distance_m: rounded(distance), occluded: false, contribution_lux: 0, reason: "outside_light_range" });
      continue;
    }
    const occluder = source.occlusion_enabled
      ? blockers.find((blocker) => segmentIntersectsRectangle(source.position, target, blocker.rectangle))
      : null;
    if (occluder) {
      contributions.push({ light_id: source.light_id, distance_m: rounded(distance), occluded: true, contribution_lux: 0, occluder: { blocker_id: occluder.blocker_id, source_kind: occluder.source_kind } });
      continue;
    }
    const effectiveDistance = Math.max(distance, source.reference_distance_m);
    const contribution = source.reference_lux
      * (source.reference_distance_m / effectiveDistance) ** 2
      * source.intensity_multiplier;
    total += contribution;
    contributions.push({ light_id: source.light_id, distance_m: rounded(distance), occluded: false, contribution_lux: rounded(contribution) });
  }
  return {
    total_lux: rounded(total),
    source: sources.length ? "ambient_plus_point_sources" : "ambient_only",
    ambient_lux: rounded(ambient),
    contributions,
  };
}

function tierForLux(lux, thresholds) {
  if (!thresholds) return "clear";
  if (lux + 1e-9 >= thresholds.clear_min_lux) return "clear";
  if (lux + 1e-9 >= thresholds.dim_min_lux) return "dim";
  if (lux + 1e-9 >= thresholds.silhouette_min_lux) return "silhouette";
  return "unresolved";
}

function perceptionLabel(scene, worldState, observer, targetId, kind, tier) {
  const scoped = object(object(scene.perception_labels_by)[observer]);
  const scopedValue = scoped[targetId];
  const publicMap = kind === "entity"
    ? object(scene.entity_visual_labels ?? scene.visual_labels)
    : object(scene.object_visual_labels ?? scene.visual_labels);
  const publicValue = publicMap[targetId];
  const registry = kind === "entity" ? object(worldState.characters) : object(worldState.objects);
  const target = object(registry[targetId]);
  const candidates = [scopedValue, publicValue, target];
  const fields = tier === "clear"
    ? ["clear_visual_label", "visual_label", "label", "visual", "observable_visual_label"]
    : tier === "dim"
      ? ["dim_visual_label", "low_light_label"]
      : ["silhouette_label"];
  for (const value of candidates) {
    if (typeof value === "string" && tier === "clear" && value.trim()) return value.trim();
    if (!isObject(value)) continue;
    for (const field of fields) {
      if (typeof value[field] === "string" && value[field].trim()) return value[field].trim();
    }
  }
  if (tier === "dim") return kind === "entity" ? "昏暗中的人影" : "昏暗中的物體輪廓";
  if (tier === "silhouette") return kind === "entity" ? "一道無法辨識身分的人形輪廓" : "一道無法辨識細節的物體輪廓";
  return null;
}

function geometryResultMap(base, kind) {
  const output = new Map();
  const visibleIds = kind === "entity" ? array(base.visible_entities) : array(base.visible_objects);
  const partial = kind === "entity" ? array(base.partially_visible_entities) : array(base.partially_visible_objects);
  const partialById = new Map(partial.map((item) => [String(kind === "entity" ? item.entity_id : item.object_id), item]));
  const occluded = kind === "entity" ? array(base.occluded_entities) : array(base.occluded_objects);
  for (const id of visibleIds) {
    const key = String(id);
    const p = partialById.get(key);
    output.set(key, {
      visible: true,
      reason: p?.reason ?? "geometry_visible",
      visibility_extent: p ? "partial" : "full",
      visible_fraction: p ? finiteNumber(p.visible_fraction, null) : 1,
    });
  }
  for (const item of occluded) {
    const id = kind === "entity" ? item?.entity_id : item?.object_id;
    if (id === null || id === undefined) continue;
    output.set(String(id), {
      visible: false,
      reason: item.reason ?? "geometry_occluded",
      visibility_extent: item.visibility_extent ?? "none",
      visible_fraction: finiteNumber(item.visible_fraction, 0),
      base: cloneJson(item),
    });
  }
  return output;
}

function observationTargetReference(value) {
  const record = object(value);
  const entityId = record.subject_entity_id ?? record.entity_id ?? null;
  if (entityId !== null && entityId !== undefined && String(entityId).trim()) return { kind: "entity", id: String(entityId).trim() };
  const objectId = record.subject_object_id ?? record.object_id ?? null;
  if (objectId !== null && objectId !== undefined && String(objectId).trim()) return { kind: "object", id: String(objectId).trim() };
  return null;
}
function stripEngineReferences(value) {
  if (!isObject(value)) return cloneJson(value);
  const output = cloneJson(value);
  for (const key of ["subject_entity_id", "entity_id", "subject_object_id", "object_id", "target_entity_id", "target_object_id"]) delete output[key];
  return output;
}
function minimumTierForDeclared(item) {
  const explicit = String(item.minimum_illumination_tier ?? item.required_illumination_tier ?? "").trim().toLowerCase();
  if (Object.hasOwn(TIER_RANK, explicit)) return explicit;
  if (item.allow_silhouette_visibility === true) return "silhouette";
  if (item.allow_dim_visibility === true) return "dim";
  return "clear";
}

function filterDeclaredVisuals(scene, observer, finalByKind) {
  const scoped = object(object(scene.observable_by)[observer] ?? object(scene.perception_by)[observer]);
  const declared = [...array(scene.public_visual), ...array(scoped.visual)];
  const visible = [];
  const dropped = [];
  for (const item of declared) {
    if (typeof item === "string") {
      visible.push(item);
      continue;
    }
    if (!isObject(item)) continue;
    const target = observationTargetReference(item);
    if (!target) {
      visible.push(stripEngineReferences(item));
      continue;
    }
    const result = finalByKind[target.kind]?.get(target.id);
    if (!result?.visible) {
      dropped.push({ target_kind: target.kind, target_id: target.id, reason: result?.reason ?? "target_not_visible" });
      continue;
    }
    if (result.visibility_extent === "partial") {
      const required = finiteNumber(item.required_visible_fraction);
      const explicitlyAllowed = item.allow_partial_visibility === true;
      if (!explicitlyAllowed && (required === null || result.visible_fraction + 1e-9 < required)) {
        dropped.push({ target_kind: target.kind, target_id: target.id, reason: "target_only_partially_visible" });
        continue;
      }
    }
    const requiredTier = minimumTierForDeclared(item);
    if (TIER_RANK[result.illumination_tier] < TIER_RANK[requiredTier]) {
      dropped.push({ target_kind: target.kind, target_id: target.id, reason: "insufficient_illumination_for_declared_visual", required_tier: requiredTier, actual_tier: result.illumination_tier });
      continue;
    }
    const sanitized = stripEngineReferences(item);
    sanitized.visibility_extent = result.visibility_extent;
    sanitized.illumination_tier = result.illumination_tier;
    sanitized.target_illumination_lux = result.target_illumination_lux;
    if (result.visible_fraction !== null) sanitized.visible_fraction = result.visible_fraction;
    visible.push(sanitized);
  }
  return { visible, dropped };
}

function solveIlluminationVisibility(context) {
  const worldState = object(context.world_state);
  const scene = object(context.scene_state);
  const observer = String(context.observer ?? "").trim();
  const sceneId = String(context.scene_id ?? scene.scene_id ?? scene.id ?? "").trim() || null;
  if (!observer) {
    const error = new Error("Illumination visibility query requires observer.");
    error.code = "WORLD_SIMULATION_VISIBILITY_OBSERVER_REQUIRED";
    throw error;
  }
  const baseQuery = queryWorldSimulationObserverDirectionalHeightVisibility({
    world_state: worldState,
    scene_state: scene,
    scene_id: sceneId,
    observer,
  });
  const base = object(baseQuery.result);
  const thresholds = thresholdRecord(worldState, scene, observer);
  const lighting = object(scene.lighting);
  const sources = lightSources(scene);
  const targetLux = object(lighting.target_illumination_lux ?? lighting.target_lux);
  const ambientConfigured = lighting.ambient_lux !== undefined && lighting.ambient_lux !== null && lighting.ambient_lux !== "";
  const lightingConfigured = ambientConfigured || sources.length > 0 || Object.keys(targetLux).length > 0;
  const lightingEnforced = Boolean(thresholds && lightingConfigured);
  const blockers = lightBlockers(scene);
  const entityGeometry = geometryResultMap(base, "entity");
  const objectGeometry = geometryResultMap(base, "object");
  const finalEntity = new Map();
  const finalObject = new Map();
  const visibleEntities = [];
  const occludedEntities = [];
  const visibleObjects = [];
  const occludedObjects = [];
  const clearEntities = [];
  const dimEntities = [];
  const silhouetteEntities = [];
  const clearObjects = [];
  const dimObjects = [];
  const silhouetteObjects = [];
  const safeObservations = [];
  const observerPosition = point(object(scene.entity_positions)[observer]);

  const process = (kind, geometryMap, finalMap, visibleIds, occludedItems, tierBuckets) => {
    for (const [targetId, geometry] of [...geometryMap.entries()].sort((a, b) => stableCompare(a[0], b[0]))) {
      if (!geometry.visible) {
        finalMap.set(targetId, { ...geometry, illumination_tier: "unresolved", target_illumination_lux: null, lighting_evaluated: false });
        occludedItems.push({ ...(kind === "entity" ? { entity_id: targetId } : { object_id: targetId }), reason: geometry.reason, visibility_extent: geometry.visibility_extent, visible_fraction: geometry.visible_fraction, lighting_evaluated: false });
        continue;
      }
      const illumination = lightingEnforced
        ? illuminationAtTarget({ scene, worldState, sceneId, kind, targetId, sources, blockers })
        : { total_lux: null, source: "lighting_not_enforced", ambient_lux: null, contributions: [] };
      const tier = lightingEnforced ? tierForLux(illumination.total_lux ?? 0, thresholds) : "clear";
      const visible = tier !== "unresolved";
      const result = {
        ...geometry,
        visible,
        reason: visible ? `illumination_${tier}` : "insufficient_illumination",
        illumination_tier: tier,
        target_illumination_lux: illumination.total_lux,
        lighting_evaluated: lightingEnforced,
        illumination: cloneJson(illumination),
      };
      finalMap.set(targetId, result);
      if (!visible) {
        occludedItems.push({ ...(kind === "entity" ? { entity_id: targetId } : { object_id: targetId }), reason: result.reason, visibility_extent: geometry.visibility_extent, visible_fraction: geometry.visible_fraction, illumination_tier: tier, target_illumination_lux: illumination.total_lux, illumination: cloneJson(illumination) });
        continue;
      }
      visibleIds.push(targetId);
      tierBuckets[tier].push(targetId);
      const targetPos = targetPosition(worldState, scene, sceneId, kind, targetId);
      const label = perceptionLabel(scene, worldState, observer, targetId, kind, tier);
      if (label) {
        safeObservations.push({
          sense: "visual",
          kind: kind === "entity" ? "visible_entity" : "visible_object",
          perceptual_label: label,
          illumination_tier: tier,
          target_illumination_lux: illumination.total_lux,
          visibility_extent: geometry.visibility_extent,
          ...(geometry.visible_fraction === null ? {} : { visible_fraction: geometry.visible_fraction }),
          ...(observerPosition && targetPos ? { relative_position: { dx_m: rounded(targetPos.x - observerPosition.x), dy_m: rounded(targetPos.y - observerPosition.y) } } : {}),
        });
      }
    }
  };

  process("entity", entityGeometry, finalEntity, visibleEntities, occludedEntities, { clear: clearEntities, dim: dimEntities, silhouette: silhouetteEntities });
  process("object", objectGeometry, finalObject, visibleObjects, occludedObjects, { clear: clearObjects, dim: dimObjects, silhouette: silhouetteObjects });
  const declared = filterDeclaredVisuals(scene, observer, { entity: finalEntity, object: finalObject });

  return {
    status: "illumination_visibility_resolved",
    observer,
    scene_id: sceneId,
    base_directional_height_visibility_version: worldSimulationDirectionalHeightVisibilityVersion,
    lighting_enforced: lightingEnforced,
    lighting_configured: lightingConfigured,
    observer_thresholds_lux: cloneJson(thresholds),
    light_source_count: sources.length,
    light_blocker_count: blockers.length,
    visible_entities: visibleEntities,
    clear_entities: clearEntities,
    dim_entities: dimEntities,
    silhouette_entities: silhouetteEntities,
    occluded_entities: occludedEntities,
    visible_objects: visibleObjects,
    clear_objects: clearObjects,
    dim_objects: dimObjects,
    silhouette_objects: silhouetteObjects,
    occluded_objects: occludedObjects,
    perception_visual_observations: [...declared.visible.map(cloneJson), ...safeObservations],
    filtered_declared_visual_count: declared.dropped.length,
    dropped_declared_visuals: declared.dropped,
    illumination_boundary: {
      geometry_visibility_resolved_before_lighting: true,
      lighting_requires_explicit_thresholds_and_lighting_inputs: true,
      no_hidden_observer_threshold_defaults: true,
      point_source_attenuation_model: "inverse_square_capped_at_reference_distance",
      dedicated_light_blockers_supported: true,
      existing_scene_geometry_blocks_light_only_when_explicit_blocks_light_true: true,
      vertical_light_transport_modeled: false,
      clear_visual_identity_labels_not_reused_for_dim_or_silhouette_without_explicit_low_light_label: true,
      target_bound_declared_visuals_default_to_clear_illumination_requirement: true,
      stealth_camouflage_modeled: false,
      sound_propagation_modeled: false,
    },
  };
}

export function queryWorldSimulationObserverIlluminationVisibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    scene_state: object(input.scene_state),
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    observer: input.observer ?? null,
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveIlluminationVisibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Illumination visibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_ILLUMINATION_VISIBILITY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Illumination visibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_ILLUMINATION_VISIBILITY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationIlluminationVisibilityVersion,
    base_directional_height_visibility_version: worldSimulationDirectionalHeightVisibilityVersion,
    observer: String(input.observer ?? "").trim() || null,
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_visibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    character_brain_decides_illumination_visibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return { illumination_visibility_version: worldSimulationIlluminationVisibilityVersion, result: first, audit };
}

export function buildWorldSimulationIlluminationVisibilityContract() {
  return {
    version: worldSimulationIlluminationVisibilityVersion,
    owner: "programmatic_sensory_query",
    base_directional_height_visibility_version: worldSimulationDirectionalHeightVisibilityVersion,
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    explicit_lux_thresholds_required: true,
    hidden_threshold_defaults_allowed: false,
    ambient_lux_supported: true,
    explicit_target_illumination_lux_supported: true,
    point_light_inverse_square_attenuation_supported: true,
    point_light_reference_distance_required_unless_lux_at_1m_used: true,
    light_occlusion_supported: true,
    light_occlusion_is_2d_in_this_phase: true,
    clear_dim_silhouette_unresolved_tiers_supported: true,
    low_light_identity_detail_requires_explicit_low_light_label: true,
    target_bound_declared_visuals_default_to_clear_requirement: true,
    brain_receives_engine_target_ids: false,
    stealth_camouflage_modeled: false,
    sound_propagation_modeled: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
  };
}
