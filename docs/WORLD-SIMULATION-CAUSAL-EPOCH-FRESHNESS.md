# World Simulation Causal Epoch Freshness (Phase62U)

Phase62U binds every cross-layer fixed-point candidate set to a causal epoch identified by the persisted World State revision/hash plus a deterministic derivation-context hash.

- A supplied `world_state_hash` must match the immutable snapshot used to open the epoch.
- Every candidate is stamped with `causal_epoch_id`, `world_state_revision`, `world_state_hash`, and `derivation_context_hash`.
- Candidates from an older epoch are rejected instead of being silently reused.
- Suppression changes, action-time refinement, or actor-trajectory changes invalidate the prior epoch even when the persisted World State revision is unchanged inside the turn.
- The next fixed-point iteration rebuilds subsystem queries and re-runs cross-layer arbitration under a new epoch.
- Stable same-time member order remains Replay-only and does not create causal precedence.

This phase does not make the entire fixed-point scheduler a pure function. It adds verifiable candidate freshness and snapshot lineage around the existing programmatic fixed-point orchestration.
