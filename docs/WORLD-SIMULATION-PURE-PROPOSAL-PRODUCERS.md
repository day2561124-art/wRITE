# World Simulation Pure Proposal Producers (Phase62M)

Phase62M removes world-state objects from the public return values of the five causal producer boundaries used by the built-in adjudicator:

- `spatial_rules`
- `continuous_actor_state_precombat`
- `combat`
- `continuous_physics`
- `continuous_actor_state_postphysics`

Each producer receives an executor-projected authoritative input state. A legacy solver may still mutate a private cloned preview while calculating consequences, but the preview is boundary-validated against its mutation proposals and discarded before the producer returns. The orchestration layer receives only mutation proposals plus causal metadata/outcomes, then reconstructs the next inter-subsystem state by applying the cumulative proposal queue.

This phase does **not** claim that every internal solver function is immutable. The remaining mutable drafts are implementation-private scratch state only. A later phase can refactor those solver internals into structurally immutable proposal calculation without changing the authoritative mutation model established here.
