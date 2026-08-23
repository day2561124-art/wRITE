# World Simulation Chronological Mutation Queue — Phase62J

Phase62J adds one persisted chronological mutation queue above the existing spatial, combat, projectile, ability, and continuous actor-state adjudicators.

## Authority

The character brain still selects intent only. It cannot create a state mutation, choose a mutation timestamp, reorder mutations, or decide the result of a same-time batch.

Resolved state transitions are normalized into turn-relative milliseconds and stored as batches:

`earlier batch commit -> later batch read -> later batch commit`

Mutations with the exact same timestamp belong to one causal batch. Their deterministic serialization order is for replay only and does not create retroactive preemption inside that timestamp.

## Timestamp policy

Phase62J prefers an exact timestamp emitted by the subsystem that created the mutation. Combat contacts, projectile launches/collisions, ability activation/ticks, cover destruction, and continuous actor-position changes now attach explicit times where available.

A transition that still has no exact timestamp is retained rather than fabricated away. It receives a documented `turn_end_inferred` timestamp so every committed mutation is represented in the queue. Actor position transitions may use the piecewise trajectory completion/interruption time.

## Replay chain

Every timestamp batch has:

- mutation revision before/after;
- chain hash before/after;
- the point events occurring at that same timestamp;
- all mutations committed in the batch;
- same-path deterministic reductions when multiple effects touch one field at the same timestamp.

The history turn persists the full queue and terminal queue hash. This gives later replay/debug layers one ordered mutation record rather than requiring them to reconstruct chronology from unrelated subsystem arrays.

## Phase boundary

Phase62J v1 centralizes and persists resolved mutations, but the existing programmatic subsystem adjudicators still compute the mutation contents. The queue is not yet the sole mutation executor. A later phase can move execution itself behind the queue without changing character-brain authority.
