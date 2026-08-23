# World Simulation Immutable Event Queries — Phase62R

Phase62R moves two event-discovery calculations behind deterministic read-only query boundaries:

- `projectile_collision_discovery` finds the projectile's next obstacle/character/bounds/lifetime/turn-window event from frozen cloned input.
- `ability_field_geometric_exposure` integrates piecewise actor motion through a static circular field for one deterministic tick window.

These queries do not return World State, mutation proposals, or state transitions. They only report causal observations. Identical input is evaluated twice and the output hash must match before the scheduler may consume the result.

The global projectile scheduler still owns chronological ordering and consumes query results programmatically. Ability-field damage still goes through the existing immutable combat-impact evaluator. Broader spatial pathfinding and scheduler arbitration are not claimed as immutable queries in this phase.

Character brains may choose action intent, aim targets, and ability centers when allowed by world state. They do not decide collision timestamps, geometric exposure duration, or query results.
