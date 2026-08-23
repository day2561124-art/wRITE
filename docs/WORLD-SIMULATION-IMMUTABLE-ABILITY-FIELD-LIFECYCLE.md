# Phase62Q — Immutable Ability-Field Lifecycle

Phase62Q moves persistent ability-field creation and lifecycle advancement behind immutable deterministic causal evaluators.

The field evaluator receives a cloned, frozen field state and returns mutation proposals plus causal metadata. It does not return or mutate world state. The continuous-physics scheduler mechanically projects those proposals into its isolated compatibility preview.

Migrated lifecycle effects:

- `ability_field_spawn`
- `ability_field_lifecycle_advance`

`ability_field_lifecycle_advance` owns deterministic tick-window construction, `remaining_ms`, `active`, `termination_reason`, `last_advanced_ms`, and `tick_ms`. Duration expiration therefore becomes a proposal result rather than a direct scheduler write.

Geometric exposure calculation remains programmatic. Damage and injury caused by each tick continue through the immutable combat-impact evaluator path. Character brains select only ability intent and field center; they do not choose field duration, tick timing, expiration, damage, or lifecycle mutation values.
