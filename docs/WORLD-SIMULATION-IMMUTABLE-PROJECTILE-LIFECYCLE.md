# Phase62P — Immutable Projectile Lifecycle Evaluators

Phase62P moves persistent projectile lifecycle state changes behind immutable deterministic causal evaluators.

## Migrated lifecycle effects

- `projectile_flight_advance`: position and `age_ms` advancement.
- `projectile_penetration_continuation`: remaining penetration energy, penetrated-obstacle history, and epsilon continuation after a successful cover penetration.
- `projectile_termination`: `active`, `termination_reason`, and optional penetration-energy exhaustion for lifetime, bounds, cover-stop, character-contact, and iteration-guard termination.

Each evaluator receives a cloned frozen projectile context, runs deterministic replay verification, and returns mutation proposals rather than world state. The global projectile scheduler still discovers the next collision/event time programmatically; it mechanically projects lifecycle proposals into its isolated private preview so later collision queries observe the updated projectile state.

This phase does **not** make collision-time discovery a separate pure evaluator, and it does not migrate ability-field lifecycle advancement. Those remain programmatic isolated-preview computations behind the existing pure proposal producer boundary.
