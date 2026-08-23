# World Simulation Continuous Physics — Phase62F

Phase62F extends the programmatic causal stack with persistent projectile entities, continuous collision timing, destructible cover, and persistent world-state ability fields.

## Authority boundary

The character brain may choose to fire, aim, or activate an ability. It does not choose projectile speed, damage, penetration, whether a projectile collides, whether cover breaks, the radius/damage/duration of an ability field, or whether resource payment succeeds.

Those values are read from persisted world truth and resolved by `world-simulation-continuous-physics-service.mjs`.

## Projectile state

A projectile is a persisted world entity with position, velocity, radius, age/lifetime, damage profile, and remaining penetration energy. If a turn ends before contact, the projectile remains active and continues from its persisted position on the next event.

Collision uses continuous relative motion between a projectile and a moving character. Static cover and scene-boundary contact are compared by event time. Cover contact can stop a projectile or consume penetration energy and permit continued travel.

## Destructible cover

Scene obstacles may expose `penetration_resistance` and `integrity_current`. Projectile energy can reduce integrity. When integrity reaches zero, the obstacle is marked `destroyed`, `passable`, and `collision_enabled=false`.

The Phase62D movement validator ignores such destroyed/non-colliding obstacles, so destruction changes later spatial causality instead of existing only as narration.

## Ability fields

Ability activation reads the character's formal world-state ability profile. Energy cost, field radius, duration, and damage are not accepted from the character brain as outcome facts.

Fields persist under `ability_fields`, lose duration as world time advances, and integrate exposure time for moving characters inside the field.

## Current boundary

Projectile and field contacts are continuous inside the Phase62F physics layer. Melee contacts from Phase62E still resolve in their existing combat layer before Phase62F is applied. A later phase may merge melee, projectile, and field timestamps into one global causal timeline.
