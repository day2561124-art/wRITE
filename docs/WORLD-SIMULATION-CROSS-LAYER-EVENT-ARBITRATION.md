# World Simulation Cross-Layer Event Arbitration

Phase62T adds an immutable deterministic arbitration boundary for point-event candidates originating from multiple causal layers.

The global timeline now canonicalizes scheduled combat events, continuous-physics execution events, and resolved incapacitation observations into exact-time batches before preemption analysis. Candidate order is non-semantic; same-timestamp members are simultaneous, and stable member ordering exists only for deterministic replay.

The arbitrator receives observation-only frozen clones and cannot return World State, state transitions, or mutation proposals. Strictly earlier batches may preempt later execution; an incapacitation in the same exact-time batch does not retroactively preempt a peer execution.

This phase does not replace the global fixed-point loop or subsystem adjudicators. Fixed-point recomputation, timeline refinement, actor trajectory rebuilding, and effect resolution remain programmatic orchestration.
