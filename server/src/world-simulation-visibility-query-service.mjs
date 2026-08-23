import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationVisibilityQueryVersion = "phase62w-visibility-occlusion-query-v1";

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
  const depth = positiveNumber(
    value.depth_m
      ?? value.depth
      ?? value.height_m
      ?? value.height,
  );
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

function segmentRectangleEntry(from, to, rectangle) {
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
  return t0 <= t1 ? Math.max(0, Math.min(1, t0)) : null;
}

function blockerEnabled(value, sourceKind) {
  const record = object(value);
  if (record.active === false || record.destroyed === true) return false;
  if (record.blocks_vision === false || record.opaque === false || record.transparent === true) return false;
  if (sourceKind === "door" && record.open === true) return false;
  return true;
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
  for (const [id, door] of Object.entries(object(scene.doors))) {
    push("door", id, door);
  }

  return records.sort((left, right) => {
    const byKind = stableCompare(left.source_kind, right.source_kind);
    return byKind || stableCompare(left.blocker_id, right.blocker_id);
  });
}

function firstOccluder(from, to, blockers) {
  let selected = null;
  for (const blocker of blockers) {
    if (pointInsideRectangle(from, blocker.rectangle)) continue;
    const entry = segmentRectangleEntry(from, to, blocker.rectangle);
    if (entry === null || entry >= 1 - 1e-9) continue;
    if (!selected || entry < selected.entry_ratio - 1e-12) {
      selected = { ...blocker, entry_ratio: entry };
      continue;
    }
    if (selected && Math.abs(entry - selected.entry_ratio) <= 1e-12) {
      const leftKey = `${blocker.source_kind}:${blocker.blocker_id}`;
      const rightKey = `${selected.source_kind}:${selected.blocker_id}`;
      if (stableCompare(leftKey, rightKey) < 0) {
        selected = { ...blocker, entry_ratio: entry };
      }
    }
  }
  return selected;
}

function observerVisionRange(worldState, scene, observer) {
  const character = object(object(worldState.characters)[observer]);
  const sceneVisibility = object(scene.visibility);
  const rules = object(worldState.world_rules ?? worldState.rules);
  return positiveNumber(
    character.vision_range_m,
    positiveNumber(
      sceneVisibility.default_range_m,
      positiveNumber(rules.default_vision_range_m, Number.POSITIVE_INFINITY),
    ),
  );
}

function sceneEntityPositions(scene) {
  return object(scene.entity_positions);
}

function sceneObjectPositions(worldState, scene, sceneId) {
  const positions = { ...cloneJson(object(scene.object_positions)) };
  for (const [objectId, raw] of Object.entries(object(worldState.objects))) {
    const record = object(raw);
    if (record.holder) continue;
    const objectSceneId = record.scene_id ?? record.location_id ?? null;
    if (sceneId && objectSceneId && String(objectSceneId) !== String(sceneId)) continue;
    const position = point(record.position);
    if (position && !Object.hasOwn(positions, objectId)) positions[objectId] = position;
  }
  return positions;
}

function visualLabel(scene, worldState, observer, targetId, targetKind) {
  const scoped = object(object(scene.perception_labels_by)[observer]);
  const scopedValue = scoped[targetId];
  if (typeof scopedValue === "string" && scopedValue.trim()) return scopedValue.trim();
  if (isObject(scopedValue)) {
    const scopedLabel = scopedValue.visual_label ?? scopedValue.label ?? scopedValue.visual;
    if (typeof scopedLabel === "string" && scopedLabel.trim()) return scopedLabel.trim();
  }

  const publicMap = targetKind === "entity"
    ? object(scene.entity_visual_labels ?? scene.visual_labels)
    : object(scene.object_visual_labels ?? scene.visual_labels);
  const publicValue = publicMap[targetId];
  if (typeof publicValue === "string" && publicValue.trim()) return publicValue.trim();
  if (isObject(publicValue)) {
    const publicLabel = publicValue.visual_label ?? publicValue.label ?? publicValue.visual;
    if (typeof publicLabel === "string" && publicLabel.trim()) return publicLabel.trim();
  }

  const registry = targetKind === "entity"
    ? object(worldState.characters)
    : object(worldState.objects);
  const target = object(registry[targetId]);
  const fallback = target.visual_label ?? target.observable_visual_label ?? null;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
}

function visibilityForTarget({ observerPosition, targetPosition, blockers, visionRange }) {
  const distanceM = Math.hypot(
    targetPosition.x - observerPosition.x,
    targetPosition.y - observerPosition.y,
  );
  if (Number.isFinite(visionRange) && distanceM > visionRange + 1e-9) {
    return {
      visible: false,
      reason: "out_of_range",
      distance_m: rounded(distanceM),
      occluder: null,
    };
  }
  const occluder = firstOccluder(observerPosition, targetPosition, blockers);
  if (occluder) {
    return {
      visible: false,
      reason: "occluded",
      distance_m: rounded(distanceM),
      occluder: {
        blocker_id: occluder.blocker_id,
        source_kind: occluder.source_kind,
        entry_ratio: rounded(occluder.entry_ratio),
      },
    };
  }
  return {
    visible: true,
    reason: "line_of_sight_clear",
    distance_m: rounded(distanceM),
    occluder: null,
  };
}

function safeObservation(kind, label, observerPosition, targetPosition, distanceM) {
  if (!label) return null;
  return {
    sense: "visual",
    kind: kind === "entity" ? "visible_entity" : "visible_object",
    perceptual_label: label,
    distance_m: distanceM,
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
  ]) {
    delete output[key];
  }
  return output;
}

function filterDeclaredVisuals(scene, observer, visibleEntityIds, visibleObjectIds, observerPosition, blockers, visionRange) {
  const visibleEntities = new Set(visibleEntityIds);
  const visibleObjects = new Set(visibleObjectIds);
  const scoped = object(object(scene.observable_by)[observer] ?? object(scene.perception_by)[observer]);
  const declared = [
    ...array(scene.public_visual),
    ...array(scoped.visual),
  ];
  const output = [];
  const dropped = [];
  for (const item of declared) {
    if (typeof item === "string") {
      output.push(item);
      continue;
    }
    if (!isObject(item)) continue;
    const target = observationTargetReference(item);
    if (target) {
      const visible = target.kind === "entity"
        ? visibleEntities.has(target.id)
        : visibleObjects.has(target.id);
      if (visible) output.push(stripEngineReferences(item));
      else dropped.push({ source: "declared_visual", target_kind: target.kind, target_id: target.id, reason: "target_not_visible" });
      continue;
    }
    const signalPosition = point(item.position ?? item.visual_position);
    if (signalPosition) {
      const visibility = visibilityForTarget({
        observerPosition,
        targetPosition: signalPosition,
        blockers,
        visionRange,
      });
      if (visibility.visible) output.push(stripEngineReferences(item));
      else dropped.push({ source: "declared_visual", target_kind: "position", target_id: null, reason: visibility.reason });
      continue;
    }
    output.push(stripEngineReferences(item));
  }
  return { visible: output, dropped };
}

function solveVisibility(context) {
  const worldState = object(context.world_state);
  const scene = object(context.scene_state);
  const observer = String(context.observer ?? "").trim();
  const sceneId = String(context.scene_id ?? scene.scene_id ?? scene.id ?? "").trim() || null;
  if (!observer) {
    const error = new Error("Visibility query requires observer.");
    error.code = "WORLD_SIMULATION_VISIBILITY_OBSERVER_REQUIRED";
    throw error;
  }
  const observerPosition = point(sceneEntityPositions(scene)[observer]);
  if (!observerPosition) {
    return {
      status: "observer_position_missing",
      observer,
      scene_id: sceneId,
      observer_position: null,
      vision_range_m: null,
      visible_entities: [],
      occluded_entities: [],
      visible_objects: [],
      occluded_objects: [],
      perception_visual_observations: [],
      filtered_declared_visual_count: 0,
      line_of_sight_check_count: 0,
    };
  }

  const visionRange = observerVisionRange(worldState, scene, observer);
  const blockers = blockerRecords(scene);
  const visibleEntities = [];
  const occludedEntities = [];
  const visibleObjects = [];
  const occludedObjects = [];
  const safeObservations = [];
  const checks = [];

  const entityPositions = sceneEntityPositions(scene);
  for (const entityId of Object.keys(entityPositions).sort(stableCompare)) {
    if (entityId === observer) continue;
    const targetPosition = point(entityPositions[entityId]);
    if (!targetPosition) continue;
    const visibility = visibilityForTarget({
      observerPosition,
      targetPosition,
      blockers,
      visionRange,
    });
    checks.push({ target_kind: "entity", target_id: entityId, ...visibility });
    if (visibility.visible) {
      visibleEntities.push(entityId);
      const label = visualLabel(scene, worldState, observer, entityId, "entity");
      const safe = safeObservation("entity", label, observerPosition, targetPosition, visibility.distance_m);
      if (safe) safeObservations.push(safe);
    } else {
      occludedEntities.push({ entity_id: entityId, reason: visibility.reason, distance_m: visibility.distance_m, occluder: visibility.occluder });
    }
  }

  const objectPositions = sceneObjectPositions(worldState, scene, sceneId);
  for (const objectId of Object.keys(objectPositions).sort(stableCompare)) {
    const targetPosition = point(objectPositions[objectId]);
    if (!targetPosition) continue;
    const visibility = visibilityForTarget({
      observerPosition,
      targetPosition,
      blockers,
      visionRange,
    });
    checks.push({ target_kind: "object", target_id: objectId, ...visibility });
    if (visibility.visible) {
      visibleObjects.push(objectId);
      const label = visualLabel(scene, worldState, observer, objectId, "object");
      const safe = safeObservation("object", label, observerPosition, targetPosition, visibility.distance_m);
      if (safe) safeObservations.push(safe);
    } else {
      occludedObjects.push({ object_id: objectId, reason: visibility.reason, distance_m: visibility.distance_m, occluder: visibility.occluder });
    }
  }

  const declared = filterDeclaredVisuals(
    scene,
    observer,
    visibleEntities,
    visibleObjects,
    observerPosition,
    blockers,
    visionRange,
  );

  return {
    status: "visibility_resolved",
    observer,
    scene_id: sceneId,
    observer_position: observerPosition,
    vision_range_m: Number.isFinite(visionRange) ? rounded(visionRange) : null,
    visible_entities: visibleEntities,
    occluded_entities: occludedEntities,
    visible_objects: visibleObjects,
    occluded_objects: occludedObjects,
    perception_visual_observations: [
      ...declared.visible.map(cloneJson),
      ...safeObservations,
    ],
    filtered_declared_visual_count: declared.dropped.length,
    dropped_declared_visuals: declared.dropped,
    line_of_sight_check_count: checks.length,
    line_of_sight_checks: checks,
    blocker_count: blockers.length,
    visibility_boundary: {
      rectangular_occlusion_geometry: true,
      closed_doors_with_geometry_block_vision: true,
      destroyed_or_transparent_blockers_do_not_block: true,
      observer_vision_range_enforced_when_configured: true,
      target_identity_not_inferred_from_entity_id_for_character_perception: true,
      lighting_threshold_modeled: false,
      facing_field_of_view_modeled: false,
      stealth_camouflage_modeled: false,
      sound_propagation_modeled: false,
    },
  };
}

export function queryWorldSimulationObserverVisibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    scene_state: object(input.scene_state),
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    observer: input.observer ?? null,
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveVisibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Visibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_VISIBILITY_QUERY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Visibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_VISIBILITY_QUERY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationVisibilityQueryVersion,
    observer: String(input.observer ?? "").trim() || null,
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_visibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    character_brain_decides_visibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    visibility_query_version: worldSimulationVisibilityQueryVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationVisibilityQueryContract() {
  return {
    version: worldSimulationVisibilityQueryVersion,
    owner: "programmatic_sensory_query",
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    rectangular_occlusion_geometry: true,
    scene_obstacles_structures_visibility_blockers_supported: true,
    closed_doors_with_geometry_supported: true,
    observer_vision_range_supported: true,
    brain_receives_engine_target_ids: false,
    explicit_perception_labels_required_for_automatic_character_facing_visual_descriptions: true,
    structured_declared_visuals_for_occluded_targets_filtered: true,
    legacy_unbound_visual_strings_remain_observer_authored_inputs: true,
    lighting_threshold_modeled: false,
    facing_field_of_view_modeled: false,
    stealth_camouflage_modeled: false,
    sound_propagation_modeled: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
  };
}
