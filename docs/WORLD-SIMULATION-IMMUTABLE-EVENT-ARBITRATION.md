# Phase62S — Immutable Event Arbitration

Phase62S moves the projectile scheduler's queried candidate batch selection behind a deterministic, read-only arbitration boundary.

The boundary receives only event-query observations. It canonicalizes and freezes them, selects the earliest timestamp batch, verifies deterministic replay, and returns observations only. It never returns World State, mutation proposals, or state transitions.

Exact-timestamp candidates are selected as one simultaneous batch. Stable member ordering exists only for deterministic replay and does not create world-time causal precedence inside the batch. The scheduler freezes the selected set before applying any batch mutation, then re-runs all unresolved event queries on the resulting projected topology before choosing the next batch.

This phase covers queried projectile candidates. The broader cross-layer global timeline fixed point, combat/ability chronology, and mutation execution remain owned by their existing programmatic layers.
