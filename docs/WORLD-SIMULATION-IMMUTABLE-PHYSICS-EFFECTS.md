# World Simulation Immutable Physics Effects — Phase62O

Phase62O extends the immutable causal-evaluator pattern into selected continuous-physics effects.

## Migrated effects

- `projectile_ammo_consumption`
- `ability_energy_consumption`
- `projectile_spawn`
- `projectile_cover_structural_impact`

Each migrated evaluator receives a cloned/frozen causal context, returns mutation proposals plus causal metadata, and is determinism-checked by the Phase62N evaluator foundation. It may not return a world-state object.

The continuous-physics solver may mechanically project those proposals into its isolated private preview so legacy projectile/field scheduling can continue, but that projection has no causal authority. Final state authority remains the chronological mutation executor.

## Boundary

Projectile flight-state evolution, projectile termination/state aggregation, and ability-field lifecycle advancement still use isolated mutable solver previews behind the pure-proposal producer boundary. Phase62O does not claim those internals are immutable yet.
