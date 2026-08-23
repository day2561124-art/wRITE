# World Simulation Immutable Causal Evaluators — Phase62N

Phase62N moves the first causal effect calculations out of mutable private-preview logic and into immutable evaluators.

## Migrated effect evaluators

- `combat_injury`
- `barrier_capacity_depletion`

Each evaluator receives a deep-cloned, frozen context. It may return causal metadata and mutation proposals, but it may not return a world-state object. Identical input is evaluated twice and the output hashes must match.

The evaluator does not apply its proposals. Projection/application is a separate mechanical step. Legacy combat internals may still project those proposals into an isolated private preview so older solver code can continue operating, but the evaluator itself has no write access and no world-state return value.

## Runtime guarantees

- evaluator input is immutable;
- evaluator output contains no world state;
- state changes are expressed only as mutation proposals;
- deterministic replay is verified for identical evaluator input;
- proposal projection is distinct from causal evaluation;
- the character brain does not choose mutation values or results.

## Boundary

Phase62N does **not** yet make every solver internal immutable. Projectile topology mutation, projectile state advancement, actor trajectory reconciliation, and other legacy private-preview mechanics remain behind the Phase62M pure-producer boundary. They can be migrated incrementally without weakening the authoritative Mutation Queue / Executor chain.
