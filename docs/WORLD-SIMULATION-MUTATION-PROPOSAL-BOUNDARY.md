# World Simulation Mutation Proposal Boundary (Phase62L)

Phase62L removes mutable subsystem draft state from **inter-subsystem handoffs**.

The spatial, actor-state, combat, and continuous-physics solvers may still use isolated mutable drafts internally while calculating causal consequences. Their returned `next_world_state` is diagnostic preview only. Before another subsystem can read those changes, every declared state transition is normalized into the chronological mutation queue and replayed from the turn-start snapshot by the authoritative executor.

The executor-projected state is therefore the only state passed across subsystem boundaries:

`turn-start world -> isolated solver preview -> mutation proposals -> executor projection -> next solver`

If a solver changes its private preview without emitting a matching mutation proposal, the boundary fails with `WORLD_SIMULATION_UNQUEUED_STATE_MUTATION`; the hidden write never reaches a later subsystem or the final commit.

This phase does **not** yet require every internal solver function to be immutable. It establishes a proposal-only external interface and prevents one subsystem from passing an unverified mutable draft directly into another subsystem. A later refactor may replace the remaining internal preview mutation with structurally pure proposal generation.
