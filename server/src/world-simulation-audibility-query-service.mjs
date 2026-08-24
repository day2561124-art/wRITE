import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationAudibilityQueryVersion = "phase62z-audibility-propagation-v1";

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
function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function observerProfile(worldState, scene, observer) {
  const sceneProfiles = object(scene.audibility_profiles ?? scene.hearing_profiles);
  const character = object(object(worldState.characters)[observer]);
  const characterProfile = object(character.audibility_profile ?? character.hearing_profile);
  return { ...object(sceneProfiles[observer]), ...characterProfile };
}

function thresholdRecord(worldState, scene, observer) {
  const profile = observerProfile(worldState, scene, observer);
  const configured = profile.minimum_audible_db
    ?? profile.hearing_threshold_db
    ?? profile.minimum_sound_level_db
    ?? profile.audibility_threshold_db;
  if (configured === null || configured === undefined || configured === "") return null;
  const threshold = finiteNumber(configured);
  if (threshold === null) {
    const error = new Error("Audibility threshold must be a finite dB value.");
    error.code = "WORLD_SIMULATION_AUDIBILITY_THRESHOLD_INVALID";
    throw error;
  }
  const localizationMargin = profile.localization_min_margin_db === undefined
    ? null
    : nonNegativeNumber(profile.localization_min_margin_db);
  if (profile.localization_min_margin_db !== undefined && localizationMargin === null) {
    const error = new Error("localization_min_margin_db must be a non-negative number.");
    error.code = "WORLD_SIMULATION_AUDIBILITY_LOCALIZATION_MARGIN_INVALID";
    throw error;
  }
  const localizationSectorsRaw = profile.localization_sectors;
  let localizationSectors = null;
  if (localizationSectorsRaw !== undefined && localizationSectorsRaw !== null && localizationSectorsRaw !== "") {
    const parsed = Number(localizationSectorsRaw);
    if (![4, 8].includes(parsed)) {
      const error = new Error("localization_sectors must be 4 or 8 when configured.");
      error.code = "WORLD_SIMULATION_AUDIBILITY_LOCALIZATION_SECTORS_INVALID";
      throw error;
    }
    localizationSectors = parsed;
  }
  return {
    minimum_audible_db: threshold,
    localization_min_margin_db: localizationMargin,
    localization_sectors: localizationSectors,
  };
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

function blockerAcoustics(raw, dedicated = false) {
  const record = object(raw);
  if (record.active === false || record.destroyed === true || record.acoustically_transparent === true) return null;
  if (record.blocks_sound === false) return null;
  const attenuationConfigured = record.sound_attenuation_db !== undefined
    || record.acoustic_attenuation_db !== undefined
    || record.attenuation_db !== undefined;
  const hardBlock = record.blocks_sound === true && !attenuationConfigured;
  if (!dedicated && !attenuationConfigured && record.blocks_sound !== true) return null;
  if (dedicated && !attenuationConfigured && record.blocks_sound !== true) return null;
  const attenuation = attenuationConfigured
    ? nonNegativeNumber(record.sound_attenuation_db ?? record.acoustic_attenuation_db ?? record.attenuation_db)
    : 0;
  if (attenuationConfigured && attenuation === null) {
    const error = new Error("Sound blocker attenuation must be a non-negative dB value.");
    error.code = "WORLD_SIMULATION_SOUND_BLOCKER_ATTENUATION_INVALID";
    throw error;
  }
  return { hard_block: hardBlock, attenuation_db: attenuation ?? 0 };
}

function soundBlockers(scene) {
  const output = [];
  const push = (sourceKind, id, raw, dedicated = false) => {
    const record = object(raw);
    if (sourceKind === "door" && record.open === true) return;
    const acoustics = blockerAcoustics(record, dedicated);
    if (!acoustics) return;
    const rectangle = rectangleFor(record);
    if (!rectangle) return;
    output.push({
      blocker_id: String(id ?? `${sourceKind}_${output.length + 1}`),
      source_kind: sourceKind,
      rectangle,
      ...acoustics,
    });
  };
  array(scene.sound_blockers).forEach((item, index) => push("sound_blocker", item?.id ?? index, item, true));
  array(scene.visibility_blockers).forEach((item, index) => push("visibility_blocker", item?.id ?? index, item));
  array(scene.obstacles).forEach((item, index) => push("obstacle", item?.id ?? index, item));
  array(scene.structures).forEach((item, index) => push("structure", item?.id ?? index, item));
  for (const [id, door] of Object.entries(object(scene.doors))) push("door", id, door);
  return output.sort((a, b) => stableCompare(`${a.source_kind}:${a.blocker_id}`, `${b.source_kind}:${b.blocker_id}`));
}

function signalReferenceLevel(raw) {
  const signal = object(raw);
  const atOne = finiteNumber(signal.sound_level_db_at_1m ?? signal.source_db_at_1m ?? signal.db_at_1m);
  if (atOne !== null) return { level_db: atOne, reference_distance_m: 1 };
  const level = finiteNumber(
    signal.sound_level_db_at_reference
      ?? signal.source_db_at_reference
      ?? signal.db_at_reference,
  );
  const reference = positiveNumber(signal.reference_distance_m);
  return level === null || reference === null ? null : { level_db: level, reference_distance_m: reference };
}

function sourcePosition(worldState, scene, sceneId, signal) {
  const direct = point(signal.position ?? signal.center);
  if (direct) return direct;
  const entityId = String(signal.source_entity_id ?? signal.entity_id ?? "").trim();
  if (entityId) return point(object(scene.entity_positions)[entityId]);
  const objectId = String(signal.source_object_id ?? signal.object_id ?? "").trim();
  if (objectId) {
    const inScene = point(object(scene.object_positions)[objectId]);
    if (inScene) return inScene;
    const worldObject = object(object(worldState.objects)[objectId]);
    if (worldObject.holder) return null;
    const objectScene = worldObject.scene_id ?? worldObject.location_id ?? null;
    if (sceneId && objectScene && String(sceneId) !== String(objectScene)) return null;
    return point(worldObject.position);
  }
  return null;
}

function soundSignals(worldState, scene, sceneId) {
  const local = [
    ...array(scene.sound_events),
    ...array(scene.auditory_events),
    ...array(scene.sound_sources),
  ];
  const world = [
    ...array(worldState.sound_events),
    ...array(worldState.auditory_events),
  ].filter((item) => {
    const record = object(item);
    const signalScene = record.scene_id ?? record.location_id ?? null;
    return !sceneId || !signalScene || String(signalScene) === String(sceneId);
  });
  return [...local, ...world].map((raw, index) => {
    const record = object(raw);
    if (record.active === false || record.ended === true) return null;
    const reference = signalReferenceLevel(record);
    if (!reference) return null;
    const position = sourcePosition(worldState, scene, sceneId, record);
    if (!position) return null;
    return {
      sound_id: String(record.sound_id ?? record.id ?? `sound_${index + 1}`),
      position,
      source_entity_id: String(record.source_entity_id ?? record.entity_id ?? "").trim() || null,
      source_object_id: String(record.source_object_id ?? record.object_id ?? "").trim() || null,
      reference_level_db: reference.level_db,
      reference_distance_m: reference.reference_distance_m,
      max_range_m: positiveNumber(record.max_range_m),
      raw: record,
    };
  }).filter(Boolean).sort((a, b) => stableCompare(a.sound_id, b.sound_id));
}

function safeAuditoryLabel(scene, observer, signal) {
  const observerMap = object(object(scene.auditory_labels_by)[observer]);
  const signalByObserver = object(signal.raw.auditory_labels_by ?? signal.raw.perceptual_labels_by);
  const candidate = observerMap[signal.sound_id]
    ?? signalByObserver[observer]
    ?? signal.raw.generic_auditory_label
    ?? signal.raw.auditory_label
    ?? signal.raw.sound_label
    ?? null;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  if (isObject(candidate)) {
    const label = candidate.auditory_label ?? candidate.sound_label ?? candidate.perceptual_label ?? candidate.label;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return "unidentified_sound";
}

function observerFacing(scene, observer) {
  const common = object(object(scene.visibility_profiles)[observer]);
  const scoped = object(object(scene.entity_visibility_profiles)[observer]);
  return finiteNumber(scoped.facing_degrees ?? common.facing_degrees);
}
function normalizeDegrees(value) {
  let normalized = value % 360;
  if (normalized < -180) normalized += 360;
  if (normalized > 180) normalized -= 360;
  return normalized;
}
function localizationSector(relativeDegrees, sectors) {
  const angle = normalizeDegrees(relativeDegrees);
  if (sectors === 4) {
    if (angle >= -45 && angle <= 45) return "front";
    if (angle > 45 && angle < 135) return "left";
    if (angle < -45 && angle > -135) return "right";
    return "behind";
  }
  const labels = ["front", "front_left", "left", "back_left", "behind", "back_right", "right", "front_right"];
  const shifted = ((angle + 22.5 + 360) % 360);
  const index = Math.floor(shifted / 45) % 8;
  return labels[index];
}
function coarseRelativeDirection(scene, observer, observerPosition, source, profile, receivedDb) {
  if (!observerPosition || !profile || profile.localization_sectors === null || profile.localization_min_margin_db === null) return null;
  const margin = receivedDb - profile.minimum_audible_db;
  if (margin + 1e-9 < profile.localization_min_margin_db) return null;
  const facing = observerFacing(scene, observer);
  if (facing === null) return null;
  const worldAngle = Math.atan2(source.position.y - observerPosition.y, source.position.x - observerPosition.x) * 180 / Math.PI;
  return localizationSector(worldAngle - facing, profile.localization_sectors);
}

function propagationFor(observerPosition, signal, blockers) {
  const sourceDistance = distance(observerPosition, signal.position);
  if (signal.max_range_m !== null && sourceDistance > signal.max_range_m + 1e-9) {
    return {
      distance_m: rounded(sourceDistance),
      geometric_attenuation_db: null,
      blocker_attenuation_db: 0,
      received_level_db: null,
      hard_blocked: false,
      blocker_hits: [],
      out_of_range: true,
    };
  }
  const effectiveDistance = Math.max(sourceDistance, signal.reference_distance_m);
  const geometricAttenuation = 20 * Math.log10(effectiveDistance / signal.reference_distance_m);
  let blockerAttenuation = 0;
  let hardBlocked = false;
  const hits = [];
  for (const blocker of blockers) {
    if (!segmentIntersectsRectangle(observerPosition, signal.position, blocker.rectangle)) continue;
    hits.push({
      blocker_id: blocker.blocker_id,
      source_kind: blocker.source_kind,
      hard_block: blocker.hard_block,
      attenuation_db: blocker.attenuation_db,
    });
    if (blocker.hard_block) hardBlocked = true;
    else blockerAttenuation += blocker.attenuation_db;
  }
  const received = hardBlocked
    ? null
    : signal.reference_level_db - geometricAttenuation - blockerAttenuation;
  return {
    distance_m: rounded(sourceDistance),
    geometric_attenuation_db: rounded(geometricAttenuation),
    blocker_attenuation_db: rounded(blockerAttenuation),
    received_level_db: rounded(received),
    hard_blocked: hardBlocked,
    blocker_hits: hits,
    out_of_range: false,
  };
}

function solveAudibility(context) {
  const worldState = object(context.world_state);
  const scene = object(context.scene_state);
  const observer = String(context.observer ?? "").trim();
  const sceneId = String(context.scene_id ?? scene.scene_id ?? scene.id ?? "").trim() || null;
  if (!observer) {
    const error = new Error("Audibility query requires observer.");
    error.code = "WORLD_SIMULATION_AUDIBILITY_OBSERVER_REQUIRED";
    throw error;
  }
  const observerPosition = point(object(scene.entity_positions)[observer]);
  const profile = thresholdRecord(worldState, scene, observer);
  const signals = soundSignals(worldState, scene, sceneId);
  const blockers = soundBlockers(scene);
  const audibilityEnforced = Boolean(observerPosition && profile && signals.length > 0);
  const audibleSounds = [];
  const inaudibleSounds = [];
  const auditoryObservations = [];

  if (audibilityEnforced) {
    for (const signal of signals) {
      const propagation = propagationFor(observerPosition, signal, blockers);
      let audible = false;
      let reason = "below_hearing_threshold";
      if (propagation.out_of_range) reason = "outside_sound_range";
      else if (propagation.hard_blocked) reason = "sound_fully_blocked";
      else if (propagation.received_level_db !== null
        && propagation.received_level_db + 1e-9 >= profile.minimum_audible_db) {
        audible = true;
        reason = "audible";
      }
      const record = {
        sound_id: signal.sound_id,
        source_entity_id: signal.source_entity_id,
        source_object_id: signal.source_object_id,
        audible,
        reason,
        source_position: cloneJson(signal.position),
        reference_level_db: signal.reference_level_db,
        reference_distance_m: signal.reference_distance_m,
        minimum_audible_db: profile.minimum_audible_db,
        ...propagation,
      };
      if (audible) {
        const relativeDirection = coarseRelativeDirection(
          scene,
          observer,
          observerPosition,
          signal,
          profile,
          propagation.received_level_db,
        );
        record.relative_direction_sector = relativeDirection;
        audibleSounds.push(record);
        auditoryObservations.push({
          sense: "auditory",
          kind: "audible_sound",
          perceptual_label: safeAuditoryLabel(scene, observer, signal),
          ...(relativeDirection ? { relative_direction_sector: relativeDirection } : {}),
          localization_is_coarse: Boolean(relativeDirection),
        });
      } else {
        inaudibleSounds.push(record);
      }
    }
  }

  return {
    status: "audibility_resolved",
    observer,
    scene_id: sceneId,
    audibility_enforced: audibilityEnforced,
    observer_position_available: Boolean(observerPosition),
    observer_hearing_profile: cloneJson(profile),
    structured_sound_count: signals.length,
    sound_blocker_count: blockers.length,
    audible_sound_count: audibleSounds.length,
    inaudible_sound_count: inaudibleSounds.length,
    audible_sounds: audibleSounds,
    inaudible_sounds: inaudibleSounds,
    perception_auditory_observations: auditoryObservations,
    audibility_boundary: {
      hearing_threshold_requires_explicit_numeric_db: true,
      hidden_human_hearing_default_allowed: false,
      free_field_distance_attenuation_model: "20log10_distance_ratio_capped_at_reference_distance",
      existing_scene_geometry_affects_sound_only_with_explicit_acoustic_fields: true,
      closed_doors_affect_sound_only_with_explicit_acoustic_fields: true,
      open_doors_do_not_apply_closed_door_attenuation: true,
      direct_path_blocker_attenuation_is_additive_db: true,
      hard_sound_blockers_supported: true,
      same_scene_direct_path_only: true,
      cross_scene_room_graph_propagation_modeled: false,
      reflections_diffraction_reverberation_modeled: false,
      propagation_delay_modeled: false,
      vertical_sound_transport_modeled: false,
      source_identity_not_inferred_from_engine_id: true,
      exact_source_position_not_forwarded_to_character_brain: true,
      exact_received_db_not_forwarded_to_character_brain: true,
      coarse_relative_direction_requires_explicit_localization_profile_and_facing: true,
      speech_content_intelligibility_modeled: false,
    },
  };
}

export function queryWorldSimulationObserverAudibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    scene_state: object(input.scene_state),
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    observer: input.observer ?? null,
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveAudibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Audibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_AUDIBILITY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Audibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_AUDIBILITY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationAudibilityQueryVersion,
    observer: String(input.observer ?? "").trim() || null,
    scene_id: input.scene_id ?? input.scene_state?.scene_id ?? null,
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_audibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    character_brain_decides_audibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return { audibility_query_version: worldSimulationAudibilityQueryVersion, result: first, audit };
}

export function buildWorldSimulationAudibilityQueryContract() {
  return {
    version: worldSimulationAudibilityQueryVersion,
    owner: "programmatic_sensory_query",
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    explicit_hearing_threshold_db_required: true,
    hidden_human_hearing_default_allowed: false,
    structured_sound_source_level_required: true,
    free_field_distance_attenuation_supported: true,
    sound_blocker_attenuation_supported: true,
    closed_door_acoustic_attenuation_supported: true,
    unconfigured_visual_geometry_does_not_imply_sound_blocking: true,
    coarse_relative_direction_supported: true,
    localization_requires_explicit_profile_and_facing: true,
    brain_receives_engine_sound_ids: false,
    brain_receives_exact_source_positions: false,
    brain_receives_exact_received_db: false,
    source_identity_inference_from_engine_id_allowed: false,
    same_scene_direct_path_only: true,
    cross_scene_room_graph_propagation_modeled: false,
    reflections_diffraction_reverberation_modeled: false,
    propagation_delay_modeled: false,
    vertical_sound_transport_modeled: false,
    speech_content_intelligibility_modeled: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
  };
}
