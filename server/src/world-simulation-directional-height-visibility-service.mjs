import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  queryWorldSimulationObserverVisibility,
  worldSimulationVisibilityQueryVersion,
} from "./world-simulation-visibility-query-service.mjs";

export const worldSimulationDirectionalHeightVisibilityVersion = "phase62x-directional-height-visibility-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

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

function rectangleFor(raw) {
  const value = object(raw);
  const xMin = finiteNumber(value.x_min ?? value.left);
  const xMax = finiteNumber(value.x_max ?? value.right);
  const yMin = finiteNumber(value.y_min ?? value.top);
  const yMax = finiteNumber(value.y_max ?? value.bottom);
  if ([xMin, xMax, yMin, yMax].every((item) => item !== null)) {
    return {
      xMin: Math.min(xMin, xMax),
      xMax: Math.max(xMin, xMax),
      yMin: Math.min(yMin, yMax),
      yMax: Math.max(yMin, yMax),
    };
  }
  const center = point(value.position ?? value.center);
  const width = positiveNumber(value.width_m ?? value.width);
  const depth = positiveNumber(value.depth_m ?? value.depth ?? value.height_m ?? value.height);
  if (!center || width === null || depth === null) return null;
  return {
    xMin: center.x - width / 2,
    xMax: center.x + width / 2,
    yMin: center.y - depth / 2,
    yMax: center.y + depth / 2,
  };
}

function pointInsideRectangle(position, rectangle) {
  return position.x >= rectangle.xMin
    && position.x <= rectangle.xMax
    && position.y >= rectangle.yMin
    && position.y <= rectangle.yMax;
}

function segmentRectangleInterval(from, to, rectangle) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, from.x - rectangle.xMin],
    [dx, rectangle.xMax - from.x],
    [-dy, from.y - rectangle.yMin],
    [dy, rectangle.yMax - from.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) <= 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return null;
      if (ratio > t0) t0 = ratio;
    } else {
      if (ratio < t0) return null;
      if (ratio < t1) t1 = ratio;
    }
  }
  if (t0 > t1) return null;
  return {
    entry_ratio: Math.max(0, Math.min(1, t0)),
    exit_ratio: Math.max(0, Math.min(1, t1)),
  };
}

function blockerEnabled(value, sourceKind) {
  const record = object(value);
  if (record.active === false || record.destroyed === true) return false;
  if (record.blocks_vision === false || record.opaque === false || record.transparent === true) return false;
  if (sourceKind === "door" && record.open === true) return false;
  return true;
}

function verticalRangeForBlocker(raw) {
  const value = object(raw);
  const explicitBase = finiteNumber(value.base_z_m ?? value.bottom_z_m ?? value.floor_z_m);
  const explicitTop = finiteNumber(value.top_z_m ?? value.occlusion_top_z_m);
  if (explicitTop !== null) {
    const base = explicitBase ?? 0;
    if (explicitTop <= base) return null;
    return { min_z_m: base, max_z_m: explicitTop };
  }
  const verticalHeight = positiveNumber(
    value.occlusion_height_m
      ?? value.vertical_height_m
      ?? value.vision_height_m
      ?? value.height_m,
  );
  if (verticalHeight === null) return null;
  const base = explicitBase ?? 0;
  return { min_z_m: base, max_z_m: base + verticalHeight };
}

function blockerRecords(scene) {
  const records = [];
  const push = (sourceKind, id, raw) => {
    if (!blockerEnabled(raw, sourceKind)) return;
    const rectangle = rectangleFor(raw);
    if (!rectangle) return;
    records.push({
      blocker_id: String(id ?? `${sourceKind}_${records.length + 1}`),
      source_kind: sourceKind,
      rectangle,
      vertical_range: verticalRangeForBlocker(raw),
    });
  };
  array(scene.visibility_blockers).forEach((item, index) => {
    push("visibility_blocker", item?.id ?? item?.blocker_id ?? index, item);
  });
  array(scene.obstacles).forEach((item, index) => {
    push("obstacle", item?.id ?? item?.obstacle_id ?? index, item);
  });
  array(scene.structures).forEach((item, index) => {
    push("structure", item?.id ?? item?.structure_id ?? index, item);
  });
  for (const [id, door] of Object.entries(object(scene.doors))) push("door", id, door);
  return records.sort((left, right) => {
    const kind = stableCompare(left.source_kind, right.source_kind);
    return kind || stableCompare(left.blocker_id, right.blocker_id);
  });
}

function scopedVisibilityProfile(scene, targetId, kind) {
  const common = object(scene.visibility_profiles)[targetId];
  const scoped = kind === "entity"
    ? object(scene.entity_visibility_profiles)[targetId]
    : object(scene.object_visibility_profiles)[targetId];
  return { ...object(common), ...object(scoped) };
}

function targetVerticalInterval(worldState, scene, targetId, kind) {
  const profile = scopedVisibilityProfile(scene, targetId, kind);
  const registry = kind === "entity" ? object(worldState.characters) : object(worldState.objects);
  const state = object(registry[targetId]);
  const base = finiteNumber(
    profile.base_z_m
      ?? profile.elevation_m
      ?? state.base_z_m
      ?? state.elevation_m,
    0,
  );
  const height = positiveNumber(
    profile.visible_height_m
      ?? profile.posture_height_m
      ?? profile.height_m
      ?? state.visibility_height_m
      ?? state.posture_height_m
      ?? state.body_height_m
      ?? state.height_m,
  );
  if (height === null) return null;
  return {
    min_z_m: base,
    max_z_m: base + height,
    height_m: height,
    source: Object.keys(profile).length ? "scene_visibility_profile" : "world_target_state",
  };
}

function observerEyeZ(worldState, scene, observer) {
  const profile = scopedVisibilityProfile(scene, observer, "entity");
  const state = object(object(worldState.characters)[observer]);
  const eyeZ = finiteNumber(profile.eye_z_m ?? state.eye_z_m);
  if (eyeZ !== null) return { eye_z_m: eyeZ, source: "absolute_eye_z" };
  const eyeHeight = positiveNumber(profile.eye_height_m ?? state.eye_height_m);
  if (eyeHeight === null) return null;
  const base = finiteNumber(
    profile.base_z_m
      ?? profile.elevation_m
      ?? state.base_z_m
      ?? state.elevation_m,
    0,
  );
  return {
    eye_z_m: base + eyeHeight,
    source: Object.hasOwn(profile, "eye_height_m") ? "scene_visibility_profile" : "world_character_state",
  };
}

function normalizeDegrees(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return ((number % 360) + 360) % 360;
}

function facingDegrees(worldState, scene, observer) {
  const profile = scopedVisibilityProfile(scene, observer, "entity");
  const state = object(object(worldState.characters)[observer]);
  const mapped = object(scene.entity_facing_degrees)[observer];
  const degrees = normalizeDegrees(
    profile.facing_degrees
      ?? profile.heading_degrees
      ?? mapped
      ?? state.facing_degrees
      ?? state.heading_degrees,
  );
  if (degrees !== null) return { degrees, source: "degrees" };
  const vector = point(profile.facing_vector ?? object(scene.entity_facing_vectors)[observer] ?? state.facing_vector);
  if (!vector) return null;
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude <= 1e-12) {
    const error = new Error("Configured observer facing vector must be non-zero.");
    error.code = "WORLD_SIMULATION_VISIBILITY_FACING_INVALID";
    throw error;
  }
  return {
    degrees: normalizeDegrees(Math.atan2(vector.y, vector.x) * 180 / Math.PI),
    source: "vector",
  };
}

function observerFovDegrees(worldState, scene, observer) {
  const profile = scopedVisibilityProfile(scene, observer, "entity");
  const state = object(object(worldState.characters)[observer]);
  const sceneVisibility = object(scene.visibility);
  const rules = object(worldState.world_rules ?? worldState.rules);
  const raw = profile.horizontal_fov_degrees
    ?? state.horizontal_fov_degrees
    ?? sceneVisibility.default_horizontal_fov_degrees
    ?? rules.default_horizontal_fov_degrees;
  if (raw === undefined || raw === null || raw === "") return null;
  const fov = finiteNumber(raw);
  if (fov === null || fov <= 0 || fov > 360) {
    const error = new Error("Configured horizontal_fov_degrees must be greater than 0 and at most 360.");
    error.code = "WORLD_SIMULATION_VISIBILITY_FOV_INVALID";
    throw error;
  }
  return fov;
}

function signedAngularDifference(targetDegrees, facing) {
  return ((targetDegrees - facing + 540) % 360) - 180;
}

function fovEvaluation(observerPosition, targetPosition, facing, fov) {
  const dx = targetPosition.x - observerPosition.x;
  const dy = targetPosition.y - observerPosition.y;
  if (Math.hypot(dx, dy) <= 1e-12 || facing === null || fov === null || fov >= 360 - 1e-9) {
    return {
      enforced: facing !== null && fov !== null,
      within_fov: true,
      target_bearing_degrees: null,
      angular_offset_degrees: 0,
    };
  }
  const bearing = normalizeDegrees(Math.atan2(dy, dx) * 180 / Math.PI);
  const offset = signedAngularDifference(bearing, facing);
  return {
    enforced: true,
    within_fov: Math.abs(offset) <= fov / 2 + 1e-9,
    target_bearing_degrees: rounded(bearing),
    angular_offset_degrees: rounded(offset),
  };
}

function intervalIntersection(left, right) {
  const start = Math.max(left[0], right[0]);
  const end = Math.min(left[1], right[1]);
  return end > start + 1e-12 ? [start, end] : null;
}

function targetIntervalsBlockedByPrism(observerEye, targetRange, segmentRange, blockerRange) {
  const a = Math.max(segmentRange.entry_ratio, 1e-9);
  const b = Math.max(a, segmentRange.exit_ratio);
  const z0 = observerEye;
  const B0 = blockerRange.min_z_m;
  const B1 = blockerRange.max_z_m;
  const target = [targetRange.min_z_m, targetRange.max_z_m];
  const output = [];

  const low = [
    z0 + (B0 - z0) / a,
    Math.min(z0, z0 + (B1 - z0) / b),
  ];
  const lowHit = intervalIntersection(low, target);
  if (lowHit) output.push(lowHit);

  const high = [
    Math.max(z0, z0 + (B0 - z0) / b),
    z0 + (B1 - z0) / a,
  ];
  const highHit = intervalIntersection(high, target);
  if (highHit) output.push(highHit);
  return output;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map((item) => [Math.min(item[0], item[1]), Math.max(item[0], item[1])])
    .filter((item) => item[1] > item[0] + 1e-12)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1] + 1e-12) merged.push([...interval]);
    else last[1] = Math.max(last[1], interval[1]);
  }
  return merged;
}

function verticalOcclusion({ observerPosition, targetPosition, observerEye, targetRange, blockers }) {
  if (!observerEye || !targetRange) {
    return {
      evaluated: false,
      visible_fraction: null,
      visible_extent: null,
      blockers: [],
      legacy_unbounded_blocker_present: false,
    };
  }
  const covered = [];
  const hits = [];
  let legacyUnbounded = false;
  for (const blocker of blockers) {
    if (pointInsideRectangle(observerPosition, blocker.rectangle)) continue;
    const segment = segmentRectangleInterval(observerPosition, targetPosition, blocker.rectangle);
    if (!segment || segment.entry_ratio >= 1 - 1e-9 || segment.exit_ratio <= 1e-9) continue;
    if (!blocker.vertical_range) {
      legacyUnbounded = true;
      hits.push({
        blocker_id: blocker.blocker_id,
        source_kind: blocker.source_kind,
        vertical_geometry: "unbounded_legacy",
        entry_ratio: rounded(segment.entry_ratio),
        exit_ratio: rounded(segment.exit_ratio),
      });
      continue;
    }
    const intervals = targetIntervalsBlockedByPrism(
      observerEye.eye_z_m,
      targetRange,
      segment,
      blocker.vertical_range,
    );
    if (intervals.length) {
      covered.push(...intervals);
      hits.push({
        blocker_id: blocker.blocker_id,
        source_kind: blocker.source_kind,
        vertical_geometry: "bounded_prism",
        entry_ratio: rounded(segment.entry_ratio),
        exit_ratio: rounded(segment.exit_ratio),
        min_z_m: rounded(blocker.vertical_range.min_z_m),
        max_z_m: rounded(blocker.vertical_range.max_z_m),
      });
    }
  }
  if (legacyUnbounded) {
    return {
      evaluated: true,
      visible_fraction: 0,
      visible_extent: "none",
      blockers: hits,
      legacy_unbounded_blocker_present: true,
    };
  }
  const merged = mergeIntervals(covered);
  const coveredHeight = merged.reduce((sum, item) => sum + item[1] - item[0], 0);
  const fraction = Math.max(0, Math.min(1, 1 - coveredHeight / targetRange.height_m));
  return {
    evaluated: true,
    visible_fraction: rounded(fraction),
    visible_extent: fraction <= 1e-9 ? "none" : fraction >= 1 - 1e-9 ? "full" : "partial",
    blockers: hits,
    legacy_unbounded_blocker_present: false,
  };
}

function visualLabel(scene, worldState, observer, targetId, targetKind) {
  const scoped = object(object(scene.perception_labels_by)[observer]);
  const scopedValue = scoped[targetId];
  if (typeof scopedValue === "string" && scopedValue.trim()) return scopedValue.trim();
  if (isObject(scopedValue)) {
    const label = scopedValue.visual_label ?? scopedValue.label ?? scopedValue.visual;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  const publicMap = targetKind === "entity"
    ? object(scene.entity_visual_labels ?? scene.visual_labels)
    : object(scene.object_visual_labels ?? scene.visual_labels);
  const publicValue = publicMap[targetId];
  if (typeof publicValue === "string" && publicValue.trim()) return publicValue.trim();
  if (isObject(publicValue)) {
    const label = publicValue.visual_label ?? publicValue.label ?? publicValue.visual;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  const registry = targetKind === "entity" ? object(worldState.characters) : object(worldState.objects);
  const target = object(registry[targetId]);
  const fallback = target.visual_label ?? target.observable_visual_label ?? null;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
}

function safeObservation(kind, label, observerPosition, targetPosition, result) {
  if (!label) return null;
  return {
    sense: "visual",
    kind: kind === "entity" ? "visible_entity" : "visible_object",
    perceptual_label: label,
    distance_m: result.distance_m,
    visibility_extent: result.visibility_extent,
    ...(result.visible_fraction === null ? {} : { visible_fraction: result.visible_fraction }),
    relative_position: {
      dx_m: rounded(targetPosition.x - observerPosition.x),
      dy_m: rounded(targetPosition.y - observerPosition.y),
    },
  };
}

function observationTargetReference(value) {
  const record = object(value);
  const entityId = record.subject_entity_id ?? record.entity_id ?? null;
  if (entityId !== null && entityId !== undefined && String(entityId).trim()) {
    return { kind: "entity", id: String(entityId).trim() };
  }
  const objectId = record.subject_object_id ?? record.object_id ?? null;
  if (objectId !== null && objectId !== undefined && String(objectId).trim()) {
    return { kind: "object", id: String(objectId).trim() };
  }
  return null;
}

function stripEngineReferences(value) {
  if (!isObject(value)) return cloneJson(value);
  const output = cloneJson(value);
  for (const key of [
    "subject_entity_id",
    "entity_id",
    "subject_object_id",
    "object_id",
    "target_entity_id",
    "target_object_id",
  ]) delete output[key];
  return output;
}

function targetPositionMaps(worldState, scene, sceneId) {
  const entities = object(scene.entity_positions);
  const objects = { ...cloneJson(object(scene.object_positions)) };
  for (const [objectId, raw] of Object.entries(object(worldState.objects))) {
    const record = object(raw);
    if (record.holder) continue;
    const objectSceneId = record.scene_id ?? record.location_id ?? null;
    if (sceneId && objectSceneId && String(objectSceneId) !== String(sceneId)) continue;
    const position = point(record.position);
    if (position && !Object.hasOwn(objects, objectId)) objects[objectId] = position;
  }
  return { entities, objects };
}

function baseResultMap(base, kind) {
  const output = new Map();
  const visibleIds = kind === "entity" ? array(base.visible_entities) : array(base.visible_objects);
  const occluded = kind === "entity" ? array(base.occluded_entities) : array(base.occluded_objects);
  for (const id of visibleIds) output.set(String(id), { visible: true, reason: "line_of_sight_clear", occluder: null });
  for (const item of occluded) {
    const id = kind === "entity" ? item?.entity_id : item?.object_id;
    if (id === undefined || id === null) continue;
    output.set(String(id), {
      visible: false,
      reason: item.reason ?? "occluded",
      occluder: cloneJson(item.occluder ?? null),
    });
  }
  return output;
}

function evaluateTarget({ worldState, scene, kind, targetId, observerPosition, targetPosition, baseStatus, facing, fov, observerEye, blockers }) {
  const distanceM = rounded(Math.hypot(targetPosition.x - observerPosition.x, targetPosition.y - observerPosition.y));
  const fovResult = fovEvaluation(observerPosition, targetPosition, facing, fov);
  if (!fovResult.within_fov) {
    return {
      visible: false,
      reason: "outside_field_of_view",
      distance_m: distanceM,
      visibility_extent: "none",
      visible_fraction: 0,
      fov: fovResult,
      vertical_occlusion: { evaluated: false, visible_fraction: null, visible_extent: null, blockers: [] },
    };
  }
  if (!baseStatus || baseStatus.reason === "out_of_range") {
    return {
      visible: Boolean(baseStatus?.visible),
      reason: baseStatus?.reason ?? "not_in_base_visibility_query",
      distance_m: distanceM,
      visibility_extent: baseStatus?.visible ? "full" : "none",
      visible_fraction: baseStatus?.visible ? 1 : 0,
      fov: fovResult,
      vertical_occlusion: { evaluated: false, visible_fraction: null, visible_extent: null, blockers: [] },
    };
  }
  if (baseStatus.visible) {
    return {
      visible: true,
      reason: "line_of_sight_clear",
      distance_m: distanceM,
      visibility_extent: "full",
      visible_fraction: 1,
      fov: fovResult,
      vertical_occlusion: { evaluated: false, visible_fraction: 1, visible_extent: "full", blockers: [] },
    };
  }
  const targetRange = targetVerticalInterval(worldState, scene, targetId, kind);
  const vertical = verticalOcclusion({
    observerPosition,
    targetPosition,
    observerEye,
    targetRange,
    blockers,
  });
  if (!vertical.evaluated) {
    return {
      visible: false,
      reason: baseStatus.reason ?? "occluded",
      distance_m: distanceM,
      visibility_extent: "none",
      visible_fraction: 0,
      fov: fovResult,
      vertical_occlusion: vertical,
      base_occluder: cloneJson(baseStatus.occluder),
    };
  }
  if (vertical.visible_extent === "none") {
    return {
      visible: false,
      reason: vertical.legacy_unbounded_blocker_present ? "occluded" : "height_occluded",
      distance_m: distanceM,
      visibility_extent: "none",
      visible_fraction: 0,
      fov: fovResult,
      vertical_occlusion: vertical,
    };
  }
  return {
    visible: true,
    reason: vertical.visible_extent === "partial" ? "partially_visible_over_cover" : "vertical_line_of_sight_clear",
    distance_m: distanceM,
    visibility_extent: vertical.visible_extent,
    visible_fraction: vertical.visible_fraction,
    fov: fovResult,
    vertical_occlusion: vertical,
  };
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
    const sanitized = stripEngineReferences(item);
    sanitized.visibility_extent = result.visibility_extent;
    if (result.visible_fraction !== null) sanitized.visible_fraction = result.visible_fraction;
    visible.push(sanitized);
  }
  return { visible, dropped };
}

function solveDirectionalHeightVisibility(context) {
  const worldState = object(context.world_state);
  const scene = object(context.scene_state);
  const observer = String(context.observer ?? "").trim();
  const sceneId = String(context.scene_id ?? scene.scene_id ?? scene.id ?? "").trim() || null;
  if (!observer) {
    const error = new Error("Directional height visibility query requires observer.");
    error.code = "WORLD_SIMULATION_VISIBILITY_OBSERVER_REQUIRED";
    throw error;
  }
  const base = queryWorldSimulationObserverVisibility({
    world_state: worldState,
    scene_state: scene,
    scene_id: sceneId,
    observer,
  });
  const observerPosition = point(object(scene.entity_positions)[observer]);
  if (!observerPosition || base.result.status !== "visibility_resolved") {
    return {
      status: base.result.status,
      observer,
      scene_id: sceneId,
      base_visibility_version: worldSimulationVisibilityQueryVersion,
      facing_degrees: null,
      horizontal_fov_degrees: null,
      fov_enforced: false,
      observer_eye_z_m: null,
      height_occlusion_available: false,
      visible_entities: [],
      occluded_entities: [],
      visible_objects: [],
      occluded_objects: [],
      perception_visual_observations: [],
      filtered_declared_visual_count: 0,
    };
  }
  const facingRecord = facingDegrees(worldState, scene, observer);
  const fov = observerFovDegrees(worldState, scene, observer);
  const facing = facingRecord?.degrees ?? null;
  const fovEnforced = facing !== null && fov !== null;
  const observerEye = observerEyeZ(worldState, scene, observer);
  const blockers = blockerRecords(scene);
  const positions = targetPositionMaps(worldState, scene, sceneId);
  const baseEntity = baseResultMap(base.result, "entity");
  const baseObject = baseResultMap(base.result, "object");
  const finalEntity = new Map();
  const finalObject = new Map();
  const visibleEntities = [];
  const occludedEntities = [];
  const visibleObjects = [];
  const occludedObjects = [];
  const safeObservations = [];

  const process = (kind, map, baseMap, finalMap, visibleIds, occludedItems) => {
    for (const targetId of Object.keys(map).sort(stableCompare)) {
      if (kind === "entity" && targetId === observer) continue;
      const targetPosition = point(map[targetId]);
      if (!targetPosition) continue;
      const result = evaluateTarget({
        worldState,
        scene,
        kind,
        targetId,
        observerPosition,
        targetPosition,
        baseStatus: baseMap.get(targetId),
        facing: fovEnforced ? facing : null,
        fov: fovEnforced ? fov : null,
        observerEye,
        blockers,
      });
      finalMap.set(targetId, result);
      if (result.visible) {
        visibleIds.push(targetId);
        const label = visualLabel(scene, worldState, observer, targetId, kind);
        const safe = safeObservation(kind, label, observerPosition, targetPosition, result);
        if (safe) safeObservations.push(safe);
      } else {
        occludedItems.push({
          ...(kind === "entity" ? { entity_id: targetId } : { object_id: targetId }),
          reason: result.reason,
          distance_m: result.distance_m,
          visibility_extent: result.visibility_extent,
          visible_fraction: result.visible_fraction,
          fov: cloneJson(result.fov),
          vertical_occlusion: cloneJson(result.vertical_occlusion),
        });
      }
    }
  };

  process("entity", positions.entities, baseEntity, finalEntity, visibleEntities, occludedEntities);
  process("object", positions.objects, baseObject, finalObject, visibleObjects, occludedObjects);

  const declared = filterDeclaredVisuals(scene, observer, { entity: finalEntity, object: finalObject });
  const partialEntities = [...finalEntity.entries()]
    .filter(([, result]) => result.visible && result.visibility_extent === "partial")
    .map(([entity_id, result]) => ({ entity_id, visible_fraction: result.visible_fraction, reason: result.reason }));
  const partialObjects = [...finalObject.entries()]
    .filter(([, result]) => result.visible && result.visibility_extent === "partial")
    .map(([object_id, result]) => ({ object_id, visible_fraction: result.visible_fraction, reason: result.reason }));

  return {
    status: "directional_height_visibility_resolved",
    observer,
    scene_id: sceneId,
    base_visibility_version: worldSimulationVisibilityQueryVersion,
    observer_position: observerPosition,
    facing_degrees: facing,
    facing_source: facingRecord?.source ?? null,
    horizontal_fov_degrees: fov,
    fov_enforced: fovEnforced,
    observer_eye_z_m: observerEye ? rounded(observerEye.eye_z_m) : null,
    height_occlusion_available: Boolean(observerEye),
    visible_entities: visibleEntities,
    partially_visible_entities: partialEntities,
    occluded_entities: occludedEntities,
    visible_objects: visibleObjects,
    partially_visible_objects: partialObjects,
    occluded_objects: occludedObjects,
    perception_visual_observations: [
      ...declared.visible.map(cloneJson),
      ...safeObservations,
    ],
    filtered_declared_visual_count: declared.dropped.length,
    dropped_declared_visuals: declared.dropped,
    directional_height_boundary: {
      horizontal_fov_requires_explicit_facing_and_fov: true,
      angle_zero_points_positive_x: true,
      vertical_occlusion_requires_explicit_observer_eye_height: true,
      target_height_requires_explicit_numeric_height: true,
      posture_names_do_not_imply_hidden_height_constants: true,
      blockers_without_vertical_geometry_preserve_legacy_full_height_occlusion: true,
      partial_visibility_is_programmatic: true,
      target_bound_declared_visuals_require_full_visibility_unless_explicitly_partial_safe: true,
      lighting_threshold_modeled: false,
      stealth_camouflage_modeled: false,
      sound_propagation_modeled: false,
    },
  };
}

export function queryWorldSimulationObserverDirectionalHeightVisibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    scene_state: object(input.scene_state),
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    observer: input.observer ?? null,
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveDirectionalHeightVisibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Directional height visibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_DIRECTIONAL_HEIGHT_VISIBILITY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Directional height visibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_DIRECTIONAL_HEIGHT_VISIBILITY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationDirectionalHeightVisibilityVersion,
    base_visibility_version: worldSimulationVisibilityQueryVersion,
    observer: String(input.observer ?? "").trim() || null,
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_visibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    character_brain_decides_fov_or_height_visibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    directional_height_visibility_version: worldSimulationDirectionalHeightVisibilityVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationDirectionalHeightVisibilityContract() {
  return {
    version: worldSimulationDirectionalHeightVisibilityVersion,
    owner: "programmatic_sensory_query",
    base_visibility_version: worldSimulationVisibilityQueryVersion,
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    explicit_horizontal_fov_supported: true,
    explicit_observer_facing_supported: true,
    facing_zero_degrees_axis: "+x",
    bounded_vertical_occlusion_supported: true,
    partial_target_visibility_supported: true,
    explicit_eye_height_required_for_vertical_refinement: true,
    explicit_target_height_required_for_vertical_refinement: true,
    posture_label_to_height_inference_allowed: false,
    legacy_unbounded_blockers_preserve_full_occlusion: true,
    target_bound_partial_visuals_require_explicit_partial_safety: true,
    brain_receives_engine_target_ids: false,
    lighting_threshold_modeled: false,
    stealth_camouflage_modeled: false,
    sound_propagation_modeled: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
  };
}
