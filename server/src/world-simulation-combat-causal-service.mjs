import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";
import {
  positionAtWorldSimulationActorTrajectory,
} from "./world-simulation-actor-state-scheduler.mjs";
import {
  buildWorldSimulationImmutableCausalEvaluatorContract,
  projectWorldSimulationImmutableEvaluatorProposals,
  runWorldSimulationImmutableCausalEvaluator,
  worldSimulationImmutableCausalEvaluatorVersion,
} from "./world-simulation-immutable-causal-evaluator-service.mjs";

export const worldSimulationCombatCausalVersion = "phase62e-combat-causal-layer-v1";

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

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number >= 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function point(value) {
  const item = object(value);
  const x = finiteNumber(item.x);
  const y = finiteNumber(item.y);
  return x === null || y === null ? null : { x, y };
}

function positionFor(scene, entity) {
  return point(object(scene.entity_positions)[entity]);
}

function distance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function parseDurationMs(candidate, fallbackMs = 0) {
  const directMs = finiteNumber(candidate.duration_ms);
  if (directMs !== null && directMs >= 0) return directMs;
  const directSeconds = finiteNumber(candidate.duration_s ?? candidate.duration_seconds);
  if (directSeconds !== null && directSeconds >= 0) return directSeconds * 1000;
  const raw = candidate.duration_estimate ?? candidate.duration ?? null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw * 1000;
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(ms|s|sec|secs|second|seconds)$/);
    if (match) return match[2] === "ms" ? Number(match[1]) : Number(match[1]) * 1000;
  }
  return fallbackMs;
}

function pushOutcome(outcomes, actor, candidate, result, causalEvidence, extra = {}) {
  outcomes.push({
    actor,
    action_id: candidate.action_id ?? null,
    action: candidate.intent ?? null,
    result,
    causal_evidence: causalEvidence,
    adjudication: "programmatic_combat_causal_layer",
    combat_causal_version: worldSimulationCombatCausalVersion,
    ...extra,
  });
}

function pushTransition(transitions, entity, field, from, to, cause, extra = {}) {
  if (JSON.stringify(from) === JSON.stringify(to)) return;
  transitions.push({
    entity,
    field,
    from: cloneJson(from),
    to: cloneJson(to),
    cause,
    adjudication: "programmatic_combat_causal_layer",
    ...extra,
  });
}

function transitionTimeExtra(timeMs, extra = {}) {
  const value = finiteNumber(timeMs);
  return value === null ? extra : { ...extra, time_ms: Math.max(0, value) };
}

function candidateForCharacter(selectedActionIntents, character) {
  const selected = array(selectedActionIntents).find((item) => String(item?.character ?? "") === character);
  return selected ? object(selected.candidate) : {};
}

function resolvedOutcomeFor(outcomes, character, actionId) {
  return array(outcomes).find((item) => (
    String(item?.actor ?? "") === character
    && String(item?.action_id ?? "") === String(actionId ?? "")
  )) ?? null;
}

function movementDestination(candidate, start) {
  const movement = object(candidate.movement);
  const explicit = point(movement.to ?? movement.destination ?? candidate.target_position);
  if (explicit) return explicit;
  const dx = finiteNumber(movement.dx, 0);
  const dy = finiteNumber(movement.dy, 0);
  if (dx === 0 && dy === 0) return null;
  return { x: start.x + dx, y: start.y + dy };
}

function positionAtCombatTime(snapshotScene, character, candidate, existingOutcomes, timeMs, actorTrajectories = {}) {
  const trajectory = object(object(actorTrajectories)[character]);
  if (Object.keys(trajectory).length) {
    return positionAtWorldSimulationActorTrajectory(trajectory, timeMs);
  }
  const start = positionFor(snapshotScene, character);
  if (!start) return null;
  if (!isObject(candidate.movement)) return start;
  const movementOutcome = resolvedOutcomeFor(existingOutcomes, character, candidate.action_id);
  if (movementOutcome?.result !== "movement_completed") return start;
  const destination = movementDestination(candidate, start);
  if (!destination) return start;
  const durationMs = positiveNumber(
    movementOutcome.duration_ms,
    positiveNumber(parseDurationMs(candidate, 0), 1),
  );
  const defense = object(candidate.defense);
  const startMs = nonNegativeNumber(defense.start_ms ?? defense.start_delay_ms, 0);
  if (timeMs <= startMs) return start;
  const ratio = Math.min(1, Math.max(0, (timeMs - startMs) / durationMs));
  return {
    x: start.x + (destination.x - start.x) * ratio,
    y: start.y + (destination.y - start.y) * ratio,
  };
}

function combatMultiplier(worldState, actor) {
  const character = object(object(worldState.characters)[actor]);
  const physical = object(character.physical_state);
  if (physical.incapacitated === true || physical.unconscious === true) return 0;
  return Math.max(0.05, finiteNumber(physical.combat_multiplier ?? character.combat_multiplier, 1));
}

function attackTimeline(worldState, actor, candidate, rules) {
  const attack = object(candidate.attack);
  const multiplier = combatMultiplier(worldState, actor);
  const fallbackTotal = positiveNumber(rules.attack_attempt_seconds, 0.5) * 1000;
  const explicitTotal = parseDurationMs(candidate, fallbackTotal);
  const baseWindup = nonNegativeNumber(attack.windup_ms, Math.min(200, explicitTotal * 0.4));
  const baseActive = positiveNumber(attack.active_ms, Math.max(50, explicitTotal * 0.3));
  const baseRecovery = nonNegativeNumber(
    attack.recovery_ms,
    Math.max(0, explicitTotal - baseWindup - baseActive),
  );
  if (multiplier <= 0) {
    return {
      canAct: false,
      multiplier,
      windupMs: Number.POSITIVE_INFINITY,
      activeMs: 0,
      recoveryMs: 0,
      totalMs: 0,
      contactTimeMs: Number.POSITIVE_INFINITY,
    };
  }
  const speedFactor = 1 / multiplier;
  const windupMs = baseWindup * speedFactor;
  const activeMs = baseActive * speedFactor;
  const recoveryMs = baseRecovery * speedFactor;
  return {
    canAct: true,
    multiplier,
    windupMs,
    activeMs,
    recoveryMs,
    totalMs: windupMs + activeMs + recoveryMs,
    contactTimeMs: windupMs + activeMs / 2,
  };
}

function weaponProfile(worldState, actor, attack, rules) {
  const objects = object(worldState.objects);
  const weaponId = String(attack.weapon_id ?? "").trim();
  const weapon = weaponId ? object(objects[weaponId]) : {};
  const character = object(object(worldState.characters)[actor]);
  const unarmed = object(object(character.combat_profile).unarmed);
  const combat = object(weapon.combat ?? weapon.weapon_profile);
  const damageRecord = object(weapon.damage);
  const weaponDamage = typeof weapon.damage === "number" ? weapon.damage : null;
  const baseDamage = nonNegativeNumber(
    combat.base_damage
      ?? combat.damage
      ?? weapon.base_damage
      ?? damageRecord.amount
      ?? weaponDamage
      ?? unarmed.base_damage
      ?? rules.default_attack_damage,
    0,
  );
  const rangeM = positiveNumber(
    combat.range_m
      ?? combat.reach_m
      ?? weapon.range_m
      ?? attack.range_m
      ?? unarmed.range_m,
    positiveNumber(rules.default_attack_range_m, 1.5),
  );
  return {
    weaponId: weaponId || null,
    weapon,
    combat,
    baseDamage,
    rangeM,
    damageType: String(
      combat.damage_type
        ?? weapon.damage_type
        ?? damageRecord.type
        ?? unarmed.damage_type
        ?? rules.default_damage_type
        ?? "impact",
    ),
    penetration: nonNegativeNumber(
      combat.penetration ?? weapon.penetration ?? unarmed.penetration,
      0,
    ),
  };
}

function validateWeapon(worldState, actor, profile) {
  if (!profile.weaponId) return { ok: true, reason: "unarmed_or_intrinsic_attack" };
  const objects = object(worldState.objects);
  if (!Object.hasOwn(objects, profile.weaponId)) {
    return { ok: false, reason: `required weapon ${profile.weaponId} does not exist` };
  }
  if (profile.weapon.holder !== actor) {
    return { ok: false, reason: `${actor} does not hold required weapon ${profile.weaponId}` };
  }
  if (profile.weapon.broken === true || profile.weapon.enabled === false || profile.weapon.state === "broken") {
    return { ok: false, reason: `required weapon ${profile.weaponId} is unusable` };
  }
  return { ok: true, reason: `${actor} holds usable weapon ${profile.weaponId}` };
}

function targetCollisionRadius(worldState, target, rules) {
  const character = object(object(worldState.characters)[target]);
  return positiveNumber(
    object(character.combat_profile).collision_radius_m
      ?? character.collision_radius_m,
    positiveNumber(rules.combat_target_radius_m ?? rules.collision_radius_m, 0.3),
  );
}

function attackEndpoint(actorPosition, targetStart, attack, rangeM) {
  const explicitAim = point(attack.aim_point ?? attack.target_point);
  const aim = explicitAim ?? targetStart;
  if (!aim) return null;
  const dx = aim.x - actorPosition.x;
  const dy = aim.y - actorPosition.y;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= 1e-9) return { x: actorPosition.x, y: actorPosition.y };
  return {
    x: actorPosition.x + (dx / magnitude) * rangeM,
    y: actorPosition.y + (dy / magnitude) * rangeM,
  };
}

function distancePointToSegment(position, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) {
    return { distance: distance(position, from), t: 0, nearest: from };
  }
  const rawT = ((position.x - from.x) * dx + (position.y - from.y) * dy) / lengthSquared;
  const t = Math.min(1, Math.max(0, rawT));
  const nearest = { x: from.x + dx * t, y: from.y + dy * t };
  return { distance: distance(position, nearest), t, nearest };
}

function resolveHitRegion(worldState, target, attack) {
  const strikeHeight = finiteNumber(attack.strike_height_m ?? attack.strike_height);
  if (strikeHeight === null) return "unspecified";
  const character = object(object(worldState.characters)[target]);
  const profile = object(character.combat_profile);
  const zones = array(profile.hit_zones);
  for (const raw of zones) {
    const zone = object(raw);
    const min = finiteNumber(zone.min_height_m ?? zone.min);
    const max = finiteNumber(zone.max_height_m ?? zone.max);
    if (min === null || max === null) continue;
    if (strikeHeight >= Math.min(min, max) && strikeHeight <= Math.max(min, max)) {
      return String(zone.region ?? zone.id ?? "unspecified");
    }
  }
  const height = positiveNumber(profile.height_m ?? character.height_m, 1.7);
  const ratio = strikeHeight / height;
  if (ratio >= 0.84) return "head";
  if (ratio >= 0.42) return "torso";
  if (ratio >= 0.12) return "legs";
  return "feet";
}

function actionTimeOverride(input, actionId) {
  return object(object(input?.action_time_overrides)[String(actionId ?? "")]);
}

function attackTimelineWithOverride(input, worldState, actor, candidate, rules) {
  const timeline = attackTimeline(worldState, actor, candidate, rules);
  const override = actionTimeOverride(input, candidate.action_id);
  const contactTimeMs = finiteNumber(override.contact_time_ms, timeline.contactTimeMs);
  const totalMs = finiteNumber(override.total_ms, timeline.totalMs);
  return {
    ...timeline,
    contactTimeMs,
    totalMs: Math.max(contactTimeMs, totalMs),
    timelineRefined: contactTimeMs !== timeline.contactTimeMs || totalMs !== timeline.totalMs,
  };
}

function defenseWindow(candidate, rules, override = {}) {
  const defense = object(candidate.defense);
  const nominalStartMs = nonNegativeNumber(defense.start_ms ?? defense.start_delay_ms, 0);
  const startMs = nonNegativeNumber(override.defense_start_ms, nominalStartMs);
  const activeMs = positiveNumber(
    defense.active_ms ?? defense.window_ms,
    positiveNumber(parseDurationMs(candidate, positiveNumber(rules.defense_action_seconds, 0.5) * 1000), 1),
  );
  return { startMs, endMs: startMs + activeMs, activeMs, nominalStartMs };
}

function defenseAtContact(worldState, resourceState, target, selectedActionIntents, contactTimeMs, rules, suppressedActionIds = new Set(), actionTimeOverrides = {}) {
  const candidate = candidateForCharacter(selectedActionIntents, target);
  if (suppressedActionIds.has(String(candidate.action_id ?? ""))) return null;
  const defense = object(candidate.defense);
  const type = String(defense.type ?? defense.mode ?? "").trim().toLowerCase();
  if (!type || type === "dodge" || type === "evade") return null;
  const window = defenseWindow(candidate, rules, object(actionTimeOverrides)[String(candidate.action_id ?? "")]);
  if (contactTimeMs < window.startMs || contactTimeMs > window.endMs) return null;
  if (type === "block" || type === "parry") {
    const objectId = String(defense.object_id ?? defense.weapon_id ?? defense.shield_id ?? "").trim();
    if (!objectId) {
      return {
        type,
        candidate,
        valid: true,
        absorption: nonNegativeNumber(rules.default_unarmed_block_absorption, 0),
        source: "unarmed_block",
      };
    }
    const item = object(object(worldState.objects)[objectId]);
    if (!Object.keys(item).length || item.holder !== target || item.broken === true || item.enabled === false) {
      return { type, candidate, valid: false, objectId, source: "invalid_block_object" };
    }
    const profile = object(item.combat ?? item.defense_profile);
    return {
      type,
      candidate,
      valid: true,
      objectId,
      absorption: nonNegativeNumber(
        profile.block_absorption ?? profile.absorption ?? item.block_absorption,
        nonNegativeNumber(rules.default_block_absorption, 0),
      ),
      mitigationFraction: Math.min(1, Math.max(0, finiteNumber(
        profile.block_mitigation_fraction ?? profile.mitigation_fraction,
        0,
      ))),
      source: `blocking_object:${objectId}`,
    };
  }
  if (type === "barrier" || type === "ability_barrier") {
    const abilityId = String(defense.ability_id ?? defense.barrier_id ?? "").trim();
    const character = object(object(worldState.characters)[target]);
    const ability = object(object(character.abilities)[abilityId]);
    const resourceCharacter = object(object(resourceState.characters)[target]);
    const resourceAbility = object(object(resourceCharacter.abilities)[abilityId]);
    if (!abilityId || !Object.keys(ability).length || ability.enabled === false || ability.available === false) {
      return { type, candidate, valid: false, abilityId, source: "invalid_barrier_ability" };
    }
    const capacity = nonNegativeNumber(
      resourceAbility.capacity_remaining
        ?? resourceAbility.remaining_capacity
        ?? resourceAbility.current_capacity
        ?? ability.capacity_remaining
        ?? ability.remaining_capacity
        ?? ability.current_capacity
        ?? ability.capacity,
      0,
    );
    const perHit = nonNegativeNumber(
      ability.absorption_per_hit ?? ability.damage_absorption ?? ability.absorption,
      capacity,
    );
    return {
      type,
      candidate,
      valid: true,
      abilityId,
      absorption: Math.min(capacity, perHit),
      mitigationFraction: Math.min(1, Math.max(0, finiteNumber(ability.mitigation_fraction, 0))),
      capacity,
      source: `barrier_ability:${abilityId}`,
    };
  }
  return null;
}

function armorProfile(worldState, target, hitRegion) {
  const character = object(object(worldState.characters)[target]);
  const directArmor = object(character.armor);
  const regionArmor = object(object(directArmor.regions)[hitRegion] ?? directArmor[hitRegion] ?? directArmor.default);
  const equipped = object(character.equipped_armor ?? object(character.equipment).armor);
  const objectId = String(equipped[hitRegion] ?? equipped.default ?? "").trim();
  const armorObject = objectId ? object(object(worldState.objects)[objectId]) : {};
  const objectArmor = object(armorObject.armor ?? armorObject.defense_profile ?? armorObject.combat);
  return {
    objectId: objectId || null,
    absorption: nonNegativeNumber(regionArmor.absorption ?? regionArmor.flat_absorption, 0)
      + nonNegativeNumber(objectArmor.armor_absorption ?? objectArmor.absorption ?? objectArmor.flat_absorption, 0),
    mitigationFraction: Math.min(1, Math.max(0,
      Math.max(
        finiteNumber(regionArmor.mitigation_fraction, 0),
        finiteNumber(objectArmor.armor_mitigation_fraction ?? objectArmor.mitigation_fraction, 0),
      ),
    )),
  };
}

function mitigateDamage(baseDamage, penetration, defense, armor) {
  let remaining = Math.max(0, baseDamage);
  const defenseAbsorption = defense?.valid ? nonNegativeNumber(defense.absorption, 0) : 0;
  const defenseMitigation = defense?.valid ? finiteNumber(defense.mitigationFraction, 0) : 0;
  remaining = Math.max(0, remaining - defenseAbsorption);
  remaining *= 1 - Math.min(1, Math.max(0, defenseMitigation));
  const effectiveArmorAbsorption = Math.max(0, nonNegativeNumber(armor.absorption, 0) - penetration);
  remaining = Math.max(0, remaining - effectiveArmorAbsorption);
  remaining *= 1 - Math.min(1, Math.max(0, finiteNumber(armor.mitigationFraction, 0)));
  return {
    baseDamage,
    defenseAbsorption,
    armorAbsorption: effectiveArmorAbsorption,
    finalDamage: Math.max(0, remaining),
  };
}

function severityForDamage(damage, maxHealth, rules) {
  if (damage <= 0) return "none";
  const ratio = maxHealth && maxHealth > 0 ? damage / maxHealth : null;
  const critical = finiteNumber(rules.critical_injury_ratio, 0.4);
  const severe = finiteNumber(rules.severe_injury_ratio, 0.25);
  const moderate = finiteNumber(rules.moderate_injury_ratio, 0.1);
  if (ratio !== null) {
    if (ratio >= critical) return "critical";
    if (ratio >= severe) return "severe";
    if (ratio >= moderate) return "moderate";
    return "minor";
  }
  if (damage >= 40) return "critical";
  if (damage >= 25) return "severe";
  if (damage >= 10) return "moderate";
  return "minor";
}

function injuryMultipliers(severity, rules) {
  const configured = object(object(rules.injury_function_multipliers)[severity]);
  const defaults = {
    none: { movement: 1, combat: 1 },
    minor: { movement: 1, combat: 0.98 },
    moderate: { movement: 0.85, combat: 0.9 },
    severe: { movement: 0.6, combat: 0.7 },
    critical: { movement: 0.3, combat: 0.4 },
  }[severity] ?? { movement: 1, combat: 1 };
  return {
    movement: Math.min(1, Math.max(0, finiteNumber(configured.movement, defaults.movement))),
    combat: Math.min(1, Math.max(0, finiteNumber(configured.combat, defaults.combat))),
  };
}

function healthSnapshot(character) {
  const physical = object(character.physical_state);
  const healthObject = object(character.health);
  const current = finiteNumber(
    physical.health_current ?? character.health_current ?? healthObject.current,
  );
  const max = finiteNumber(
    physical.health_max ?? character.health_max ?? healthObject.max,
  );
  return { current, max, physical, healthObject };
}

function overwritePrivatePreview(target, replacement) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, cloneJson(replacement));
  return target;
}

export function evaluateWorldSimulationBarrierCapacity(input = {}) {
  const worldState = object(input.world_state);
  const target = String(input.target ?? "").trim();
  const defense = object(input.defense);
  const usedAbsorption = nonNegativeNumber(input.used_absorption, 0);
  const cause = input.cause ?? null;
  const timeMs = input.time_ms ?? null;
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "barrier_capacity_depletion",
    context: {
      world_state: worldState,
      target,
      defense,
      used_absorption: usedAbsorption,
      cause,
      time_ms: timeMs,
    },
    evaluate: (context) => {
      const proposals = [];
      const frozenDefense = object(context.defense);
      if (!frozenDefense.valid || !frozenDefense.abilityId || context.used_absorption <= 0) {
        return {
          mutation_proposals: proposals,
          applied: false,
          capacity_before: null,
          capacity_after: null,
        };
      }
      const character = object(object(context.world_state.characters)[context.target]);
      const ability = object(object(character.abilities)[frozenDefense.abilityId]);
      const key = Object.hasOwn(ability, "capacity_remaining")
        ? "capacity_remaining"
        : Object.hasOwn(ability, "remaining_capacity")
          ? "remaining_capacity"
          : Object.hasOwn(ability, "current_capacity")
            ? "current_capacity"
            : null;
      if (!key) {
        return {
          mutation_proposals: proposals,
          applied: false,
          capacity_before: null,
          capacity_after: null,
        };
      }
      const before = nonNegativeNumber(ability[key], 0);
      const after = Math.max(0, before - context.used_absorption);
      pushTransition(
        proposals,
        context.target,
        `abilities.${frozenDefense.abilityId}.${key}`,
        before,
        after,
        context.cause,
        transitionTimeExtra(context.time_ms),
      );
      return {
        mutation_proposals: proposals,
        applied: true,
        ability_id: frozenDefense.abilityId,
        capacity_field: key,
        capacity_before: before,
        capacity_after: after,
      };
    },
  });
}

function applyBarrierCapacity(nextWorldState, target, defense, usedAbsorption, transitions, cause, timeMs = null) {
  const evaluated = evaluateWorldSimulationBarrierCapacity({
    world_state: nextWorldState,
    target,
    defense,
    used_absorption: usedAbsorption,
    cause,
    time_ms: timeMs,
  });
  if (evaluated.mutation_proposals.length) {
    const projection = projectWorldSimulationImmutableEvaluatorProposals({
      world_state: nextWorldState,
      mutation_proposals: evaluated.mutation_proposals,
      elapsed_ms: nonNegativeNumber(timeMs, 0),
    });
    overwritePrivatePreview(nextWorldState, projection.projected_world_state);
    transitions.push(...cloneJson(evaluated.mutation_proposals));
  }
  return evaluated;
}

export function evaluateWorldSimulationCombatInjury(input = {}) {
  const worldState = object(input.world_state);
  const snapshot = object(input.snapshot_world_state ?? worldState);
  const target = String(input.target ?? "").trim();
  const hitRegion = String(input.hit_region ?? "torso").trim() || "torso";
  const damage = nonNegativeNumber(input.damage, 0);
  const damageType = String(input.damage_type ?? "impact");
  const source = String(input.source ?? "programmatic_impact");
  const rules = object(input.rules ?? snapshot.world_rules ?? snapshot.rules);
  const timeMs = input.time_ms ?? null;
  const sourceLayer = String(input.source_layer ?? "combat");
  return runWorldSimulationImmutableCausalEvaluator({
    evaluator: "combat_injury",
    context: {
      world_state: worldState,
      snapshot_world_state: snapshot,
      target,
      hit_region: hitRegion,
      damage,
      damage_type: damageType,
      source,
      rules,
      time_ms: timeMs,
      source_layer: sourceLayer,
    },
    evaluate: (context) => {
      const proposals = [];
      const currentCharacter = object(object(context.world_state.characters)[context.target]);
      const snapshotCharacter = object(object(context.snapshot_world_state.characters)[context.target]);
      const currentPhysical = object(currentCharacter.physical_state);
      if (context.damage <= 0) {
        return {
          mutation_proposals: proposals,
          severity: "none",
          healthBefore: null,
          healthAfter: null,
          movementMultiplierAfter: finiteNumber(currentPhysical.movement_multiplier, 1),
          combatMultiplierAfter: finiteNumber(currentPhysical.combat_multiplier, 1),
        };
      }

      const health = healthSnapshot(currentCharacter);
      const fallbackHealth = healthSnapshot(snapshotCharacter);
      const healthBefore = health.current ?? fallbackHealth.current;
      const healthMax = health.max ?? fallbackHealth.max;
      let healthAfter = null;
      if (healthBefore !== null) {
        healthAfter = Math.max(0, healthBefore - context.damage);
        pushTransition(
          proposals,
          context.target,
          "physical_state.health_current",
          healthBefore,
          healthAfter,
          `combat damage from ${context.source}`,
          transitionTimeExtra(context.time_ms, {
            hit_region: context.hit_region,
            damage_type: context.damage_type,
            source_layer: context.source_layer,
          }),
        );
      }

      const severity = severityForDamage(context.damage, healthMax, object(context.rules));
      const previousInjuries = array(
        currentPhysical.injuries
          ?? currentCharacter.injuries
          ?? object(snapshotCharacter.physical_state).injuries
          ?? snapshotCharacter.injuries,
      );
      const nextInjuries = [...previousInjuries, {
        injury_id: `injury_${hashAgentRunValue({
          target: context.target,
          hitRegion: context.hit_region,
          damage: context.damage,
          damageType: context.damage_type,
          source: context.source,
          count: previousInjuries.length,
        }).slice(0, 18)}`,
        region: context.hit_region,
        damage: context.damage,
        damage_type: context.damage_type,
        severity,
        source: context.source,
      }];
      pushTransition(
        proposals,
        context.target,
        "physical_state.injuries",
        previousInjuries,
        nextInjuries,
        `resolved combat contact applied ${context.damage.toFixed(3)} damage to ${context.hit_region}`,
        transitionTimeExtra(context.time_ms, { source_layer: context.source_layer }),
      );

      const multipliers = injuryMultipliers(severity, object(context.rules));
      const oldMovement = finiteNumber(
        currentPhysical.movement_multiplier
          ?? object(snapshotCharacter.physical_state).movement_multiplier,
        1,
      );
      const oldCombat = finiteNumber(
        currentPhysical.combat_multiplier
          ?? object(snapshotCharacter.physical_state).combat_multiplier,
        1,
      );
      const nextMovement = Math.min(oldMovement, multipliers.movement);
      const nextCombat = Math.min(oldCombat, multipliers.combat);
      pushTransition(
        proposals,
        context.target,
        "physical_state.movement_multiplier",
        oldMovement,
        nextMovement,
        `injury severity ${severity} limits movement`,
        transitionTimeExtra(context.time_ms, { source_layer: context.source_layer }),
      );
      pushTransition(
        proposals,
        context.target,
        "physical_state.combat_multiplier",
        oldCombat,
        nextCombat,
        `injury severity ${severity} limits combat execution`,
        transitionTimeExtra(context.time_ms, { source_layer: context.source_layer }),
      );

      if (healthAfter !== null && healthAfter <= 0) {
        const oldIncapacitated = currentPhysical.incapacitated === true;
        const oldImmobilized = currentPhysical.immobilized === true;
        pushTransition(
          proposals,
          context.target,
          "physical_state.incapacitated",
          oldIncapacitated,
          true,
          "health reached zero after resolved combat damage",
          transitionTimeExtra(context.time_ms, { source_layer: context.source_layer }),
        );
        pushTransition(
          proposals,
          context.target,
          "physical_state.immobilized",
          oldImmobilized,
          true,
          "health reached zero after resolved combat damage",
          transitionTimeExtra(context.time_ms, { source_layer: context.source_layer }),
        );
      }

      return {
        mutation_proposals: proposals,
        severity,
        healthBefore,
        healthAfter,
        movementMultiplierAfter: nextMovement,
        combatMultiplierAfter: nextCombat,
      };
    },
  });
}

export function applyWorldSimulationCombatInjury(nextWorldState, snapshot, target, hitRegion, damage, damageType, source, rules, transitions, timeMs = null, sourceLayer = "combat") {
  const evaluated = evaluateWorldSimulationCombatInjury({
    world_state: nextWorldState,
    snapshot_world_state: snapshot,
    target,
    hit_region: hitRegion,
    damage,
    damage_type: damageType,
    source,
    rules,
    time_ms: timeMs,
    source_layer: sourceLayer,
  });
  if (evaluated.mutation_proposals.length) {
    const projection = projectWorldSimulationImmutableEvaluatorProposals({
      world_state: nextWorldState,
      mutation_proposals: evaluated.mutation_proposals,
      elapsed_ms: nonNegativeNumber(timeMs, 0),
    });
    overwritePrivatePreview(nextWorldState, projection.projected_world_state);
    transitions.push(...cloneJson(evaluated.mutation_proposals));
  }
  return {
    ...evaluated.result,
    evaluator_audit: evaluated.audit,
  };
}

export function applyWorldSimulationCombatImpact(input = {}) {
  const snapshot = object(input.world_state);
  const nextWorldState = object(input.next_world_state);
  const target = String(input.target ?? "").trim();
  const hitRegion = String(input.hit_region ?? "torso").trim() || "torso";
  const baseDamage = nonNegativeNumber(input.base_damage, 0);
  const penetration = nonNegativeNumber(input.penetration, 0);
  const damageType = String(input.damage_type ?? "impact");
  const source = String(input.source ?? "programmatic_impact");
  const rules = object(snapshot.world_rules ?? snapshot.rules);
  const transitions = array(input.state_transitions);
  const armor = input.ignore_armor === true
    ? { absorption: 0, mitigationFraction: 0 }
    : armorProfile(snapshot, target, hitRegion);
  const mitigation = mitigateDamage(baseDamage, penetration, null, armor);
  const injury = applyWorldSimulationCombatInjury(
    nextWorldState,
    snapshot,
    target,
    hitRegion,
    mitigation.finalDamage,
    damageType,
    source,
    rules,
    transitions,
    input.time_ms ?? null,
    String(input.source_layer ?? "combat"),
  );
  return {
    base_damage: baseDamage,
    damage_applied: mitigation.finalDamage,
    armor_absorption: mitigation.armorAbsorption,
    armor_mitigation_fraction: armor.mitigationFraction,
    injury_severity: injury.severity,
    health_before: injury.healthBefore,
    health_after: injury.healthAfter,
    movement_multiplier_after: injury.movementMultiplierAfter,
    combat_multiplier_after: injury.combatMultiplierAfter,
    evaluator_audit: injury.evaluator_audit,
  };
}


export function buildWorldSimulationCombatTimelineEntries(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const rules = object(snapshot.world_rules ?? snapshot.rules);
  const suppressed = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  const entries = [];
  for (const selected of array(input.selected_action_intents)) {
    const actor = String(selected?.character ?? "").trim();
    const candidate = object(selected?.candidate);
    const actionId = String(candidate.action_id ?? "").trim();
    if (!actor || !actionId || suppressed.has(actionId)) continue;
    if (isObject(candidate.attack)) {
      const timeline = attackTimelineWithOverride(input, snapshot, actor, candidate, rules);
      if (Number.isFinite(timeline.contactTimeMs)) {
        entries.push({
          kind: "melee_contact",
          actor,
          action_id: actionId,
          time_ms: timeline.contactTimeMs,
          total_ms: timeline.totalMs,
          target: String(candidate.attack.target_character ?? candidate.attack.target ?? candidate.target ?? "").trim() || null,
        });
      }
    }
    if (isObject(candidate.defense)) {
      const window = defenseWindow(candidate, rules, actionTimeOverride(input, actionId));
      entries.push({
        kind: "defense_start",
        actor,
        action_id: actionId,
        time_ms: window.startMs,
        end_time_ms: window.endMs,
      });
    }
  }
  return entries.sort((left, right) => (
    left.time_ms - right.time_ms
    || left.kind.localeCompare(right.kind)
    || left.actor.localeCompare(right.actor, "zh-Hant-TW")
    || left.action_id.localeCompare(right.action_id)
  ));
}

export function buildWorldSimulationCombatCausalContract() {
  return {
    version: worldSimulationCombatCausalVersion,
    owner: "programmatic_combat_causal_adjudicator",
    inputs: "persisted_world_truth_plus_selected_machine_readable_intents",
    character_brain_may_choose: ["attack_intent", "aim_parameters", "dodge_intent", "block_intent", "barrier_intent"],
    character_brain_may_not_choose: ["hit", "miss", "damage", "injury", "armor_result", "barrier_result"],
    timing: {
      attack_windup_active_recovery_windows: true,
      defensive_window_overlap_required: true,
      same_turn_motion_sampled_at_contact_time: true,
      combat_contacts_resolve_in_contact_time_order: true,
    },
    contact: {
      attack_trajectory_is_programmatic: true,
      target_collision_radius_is_world_state: true,
      range_alone_does_not_imply_contact: true,
    },
    mitigation: {
      blocking_equipment_must_be_held_and_usable: true,
      barrier_ability_must_exist_and_be_available: true,
      armor_is_read_from_world_state: true,
      penetration_reduces_flat_armor_absorption: true,
    },
    injury: {
      damage_updates_persistent_physical_state: true,
      injury_severity_can_reduce_future_movement_and_combat_rate: true,
      zero_health_can_incapacitate: true,
    },
    immutable_causal_evaluators: buildWorldSimulationImmutableCausalEvaluatorContract(),
  };
}

export function adjudicateWorldSimulationCombat(input = {}) {
  const snapshot = cloneJson(object(input.world_state));
  const nextWorldState = cloneJson(object(input.next_world_state ?? snapshot));
  const sceneId = String(input.scene_id ?? input.event?.scene_id ?? "").trim();
  const snapshotScene = object(object(snapshot.scenes)[sceneId] ?? snapshot.scene_state);
  const rules = object(snapshot.world_rules ?? snapshot.rules);
  const selectedActionIntents = array(input.selected_action_intents);
  const existingOutcomes = array(input.resolved_action_outcomes);
  const suppressedActionIds = new Set(array(input.suppressed_action_ids).map((value) => String(value)));
  const outcomes = [];
  const transitions = [];
  const combatResolutions = [];
  const immutableCausalEvaluatorAudits = [];
  let elapsedMs = 0;

  const attackEntries = selectedActionIntents
    .map((selected) => {
      const actor = String(selected?.character ?? "").trim();
      const candidate = object(selected?.candidate);
      const actionId = String(candidate.action_id ?? "");
      if (!actor || suppressedActionIds.has(actionId) || !isObject(candidate.attack)) return null;
      const timeline = attackTimelineWithOverride(input, snapshot, actor, candidate, rules);
      return { selected, actor, candidate, timeline };
    })
    .filter(Boolean)
    .sort((a, b) => (
      a.timeline.contactTimeMs - b.timeline.contactTimeMs
      || a.actor.localeCompare(b.actor, "zh-Hant-TW")
      || String(a.candidate.action_id ?? "").localeCompare(String(b.candidate.action_id ?? ""))
    ));

  for (const entry of attackEntries) {
    const { actor, candidate, timeline } = entry;
    const attack = object(candidate.attack);
    const target = String(attack.target_character ?? attack.target ?? candidate.target ?? "").trim();
    elapsedMs = Math.max(elapsedMs, timeline.totalMs);
    if (!timeline.canAct) {
      pushOutcome(outcomes, actor, candidate, "actor_incapacitated", `${actor} cannot execute the attack because combat capacity is zero`, {
        target,
        contact_resolved: false,
      });
      continue;
    }
    const actorPosition = positionFor(snapshotScene, actor);
    const targetStart = positionFor(snapshotScene, target);
    if (!target || !actorPosition || !targetStart) {
      pushOutcome(outcomes, actor, candidate, "blocked", "attack requires actor and target positions", {
        target: target || null,
        contact_resolved: false,
      });
      continue;
    }
    const profile = weaponProfile(snapshot, actor, attack, rules);
    const weaponValidation = validateWeapon(snapshot, actor, profile);
    if (!weaponValidation.ok) {
      pushOutcome(outcomes, actor, candidate, "blocked", weaponValidation.reason, {
        target,
        weapon_id: profile.weaponId,
        contact_resolved: false,
      });
      continue;
    }
    const targetRadius = targetCollisionRadius(snapshot, target, rules);
    const initialSeparation = distance(actorPosition, targetStart);
    if (initialSeparation > profile.rangeM + targetRadius) {
      pushOutcome(outcomes, actor, candidate, "out_of_range", `target distance ${initialSeparation.toFixed(3)}m exceeds attack reach ${profile.rangeM.toFixed(3)}m plus collision radius`, {
        target,
        distance_m: initialSeparation,
        range_m: profile.rangeM,
        contact_resolved: false,
      });
      continue;
    }

    const targetCandidate = candidateForCharacter(selectedActionIntents, target);
    const targetAtContact = positionAtCombatTime(
      snapshotScene,
      target,
      targetCandidate,
      existingOutcomes,
      timeline.contactTimeMs,
      input.actor_trajectories,
    );
    const endpoint = attackEndpoint(actorPosition, targetStart, attack, profile.rangeM);
    if (!targetAtContact || !endpoint) {
      pushOutcome(outcomes, actor, candidate, "blocked", "attack trajectory could not be constructed", {
        target,
        contact_resolved: false,
      });
      continue;
    }
    const geometry = distancePointToSegment(targetAtContact, actorPosition, endpoint);
    const contact = geometry.distance <= targetRadius;
    const resolutionTrace = {
      attacker_position: actorPosition,
      target_start_position: targetStart,
      target_contact_position: targetAtContact,
      trajectory_endpoint: endpoint,
      collision_radius_m: targetRadius,
      nearest_trajectory_distance_m: geometry.distance,
      contact_time_ms: timeline.contactTimeMs,
      attack_window: {
        windup_ms: timeline.windupMs,
        active_ms: timeline.activeMs,
        recovery_ms: timeline.recoveryMs,
      },
    };
    if (!contact) {
      pushOutcome(outcomes, actor, candidate, "missed_due_to_motion", `target was ${geometry.distance.toFixed(3)}m from the attack trajectory at contact time`, {
        target,
        contact_resolved: true,
        hit: false,
        damage_applied: 0,
        resolution_trace: resolutionTrace,
      });
      combatResolutions.push({ actor, target, hit: false, reason: "trajectory_miss", resolution_trace: resolutionTrace });
      continue;
    }

    const hitRegion = resolveHitRegion(snapshot, target, attack);
    const defense = defenseAtContact(
      snapshot,
      nextWorldState,
      target,
      selectedActionIntents,
      timeline.contactTimeMs,
      rules,
      suppressedActionIds,
      input.action_time_overrides,
    );
    const armor = armorProfile(snapshot, target, hitRegion);
    const mitigation = mitigateDamage(profile.baseDamage, profile.penetration, defense, armor);
    const defenseAbsorptionUsed = Math.min(profile.baseDamage, mitigation.defenseAbsorption);
    const defenseCause = defense?.valid
      ? `${defense.source} overlapped attack contact at ${timeline.contactTimeMs.toFixed(3)}ms`
      : null;
    if (defense?.valid && defense.abilityId) {
      const barrierEvaluation = applyBarrierCapacity(nextWorldState, target, defense, defenseAbsorptionUsed, transitions, defenseCause, timeline.contactTimeMs);
      immutableCausalEvaluatorAudits.push(barrierEvaluation.audit);
    }

    const injury = applyWorldSimulationCombatInjury(
      nextWorldState,
      snapshot,
      target,
      hitRegion,
      mitigation.finalDamage,
      profile.damageType,
      profile.weaponId ?? actor,
      rules,
      transitions,
      timeline.contactTimeMs,
      "combat",
    );
    immutableCausalEvaluatorAudits.push(injury.evaluator_audit);
    const defenseEffective = Boolean(defense?.valid)
      && (mitigation.defenseAbsorption > 0 || finiteNumber(defense.mitigationFraction, 0) > 0);
    let result = "hit_resolved";
    if (defenseEffective && mitigation.finalDamage <= 0) result = "blocked_by_defense";
    else if (defenseEffective) result = "defense_reduced_hit";
    else if (defense?.valid && defense.type === "barrier" && mitigation.defenseAbsorption <= 0) result = "defense_exhausted_hit";
    else if (profile.baseDamage <= 0) result = "contact_without_damage_profile";
    else if (mitigation.finalDamage <= 0) result = "armor_stopped_hit";
    const bodyHit = !(defenseEffective && mitigation.finalDamage <= 0);
    const contactType = defenseEffective
      ? (mitigation.finalDamage > 0 ? "defense_then_body" : defense.type === "barrier" ? "barrier" : "blocking_object")
      : "body";

    const evidenceParts = [
      `trajectory contact distance ${geometry.distance.toFixed(3)}m <= radius ${targetRadius.toFixed(3)}m`,
      `base damage ${profile.baseDamage.toFixed(3)}`,
      `final damage ${mitigation.finalDamage.toFixed(3)}`,
    ];
    if (defenseCause) evidenceParts.push(defenseCause);
    if (armor.absorption > 0 || armor.mitigationFraction > 0) evidenceParts.push(`armor applied for ${hitRegion}`);
    pushOutcome(outcomes, actor, candidate, result, evidenceParts.join("; "), {
      target,
      hit: bodyHit,
      hit_region: bodyHit ? hitRegion : null,
      contact_type: contactType,
      contact_resolved: true,
      defense_resolved: defenseEffective,
      defense_type: defense?.valid ? defense.type : null,
      defense_effective: defenseEffective,
      base_damage: profile.baseDamage,
      damage_applied: mitigation.finalDamage,
      damage_type: profile.damageType,
      injury_severity: injury.severity,
      health_before: injury.healthBefore,
      health_after: injury.healthAfter,
      movement_multiplier_after: injury.movementMultiplierAfter,
      combat_multiplier_after: injury.combatMultiplierAfter,
      resolution_trace: resolutionTrace,
    });
    combatResolutions.push({
      actor,
      target,
      hit: bodyHit,
      hit_region: bodyHit ? hitRegion : null,
      contact_type: contactType,
      defense: defense?.valid ? defense.type : null,
      damage_applied: mitigation.finalDamage,
      injury_severity: injury.severity,
      resolution_trace: resolutionTrace,
    });
  }

  return {
    combat_causal_version: worldSimulationCombatCausalVersion,
    next_world_state: nextWorldState,
    next_world_state_authority: "ephemeral_preview_only",
    state_transitions: transitions,
    mutation_proposals: transitions,
    action_outcomes: outcomes,
    combat_resolutions: combatResolutions,
    immutable_causal_evaluator_version: worldSimulationImmutableCausalEvaluatorVersion,
    immutable_causal_evaluator_audits: immutableCausalEvaluatorAudits,
    timeline_entries: buildWorldSimulationCombatTimelineEntries({ ...input, world_state: snapshot, suppressed_action_ids: [...suppressedActionIds] }),
    elapsed_ms: elapsedMs,
    boundary: {
      character_brain_selected_intent_only: true,
      hit_or_miss_created_programmatically: true,
      damage_and_injury_created_programmatically: true,
      combat_injury_and_barrier_effects_evaluated_immutably: true,
      same_turn_target_motion_sampled_from_validated_movement: true,
    },
  };
}
