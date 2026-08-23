# World Simulation Continuous Actor State — Phase62I

Phase62I extends the global causal timeline with a programmatic continuous actor-state scheduler. It closes the gap where movement was validated at turn start but its final position could still be treated as an all-or-nothing destination after an injury or incapacitation occurred mid-route.

## Authority

The character brain may choose movement, attack, projectile, defense, and ability intents. It does not choose the actor's position after interruption, the rate change caused by injury, field exposure duration, or deterministic field tick damage.

The programmatic scheduler owns:

- piecewise movement trajectories,
- movement-rate changes after earlier injuries,
- stopping in-progress movement at the causal position of incapacitation,
- refined movement completion time,
- trajectory samples used by melee/projectile collision,
- deterministic ability-field exposure ticks.

## Piecewise movement

A validated movement action becomes a trajectory with time-bounded linear segments. The nominal segment uses the movement duration already validated by the spatial causal rule engine. Earlier injury events can reduce the remaining execution rate. Incapacitation stops the trajectory at the position reached at that timestamp instead of snapping the actor to the intended destination.

The scheduler participates in the existing fixed-point global timeline loop. Combat and continuous physics are replayed against the current trajectory until suppression, timing overrides, and actor trajectories stabilize.

## Ability fields

Persistent ability fields now advance through deterministic exposure ticks. The default tick interval is `world_rules.ability_field_tick_ms` (100 ms when unspecified). Each tick samples the actor's piecewise trajectory and applies only the damage corresponding to time actually spent inside the field during that interval.

Field tick injuries can become movement/combat rate events in the next fixed-point refinement pass. Fatal field ticks can also preempt later discrete actions.

For compatibility, each field still emits the existing turn-level `ability_field_applied` summary in addition to `ability_field_tick` events.

## Historical record

`causal_timeline` now persists:

- `actor_state_scheduler_version`,
- `actor_trajectories`,
- `movement_adjustments`,
- `movement_rate_adjusted`,
- `movement_completion_refined`,
- `movement_interrupted`,
- `ability_field_tick` entries.

These records are historical results. Playback may display them but may not recompute them.

## Boundary

Phase62I is still event-driven, not an infinitesimal-step general physics solver. Projectile collision scheduling is globally time-ordered and ability fields use deterministic ticks, but exact cross-type simultaneous mutation still uses deterministic subsystem reconciliation. The next refinement can unify more continuous processes under one chronological state-transition queue if needed.
