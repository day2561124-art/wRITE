# World Simulation Authoritative Mutation Executor — Phase62K

Phase62K promotes the Phase62J chronological mutation queue from a historical ordering record into the sole writer of the **final turn world state**.

## Authority split

1. Character brains still choose action intent only.
2. Spatial/combat/continuous-physics/actor-state subsystems may mutate isolated **preview drafts** while computing causal proposals.
3. Those preview mutations are not commit authority.
4. Every committed world-state change must be represented by a timestamped queued mutation.
5. The authoritative executor rebuilds the final state from the persisted turn-start world state by applying queue batches in chronological order.
6. Any preview change that cannot be reproduced by the queue is rejected before world-state commit.

## Executor invariants

- Mutation preconditions (`from`) are checked against the executor's current state.
- Same-timestamp mutations remain one causal batch; deterministic write ordering inside the batch is replay machinery, not narrative precedence.
- Sparse semantic defaults (for example an omitted movement multiplier meaning `1`) are normalized without being treated as causal changes.
- Schema-only empty containers may be normalized without creating fictional world events.
- The executor emits an `execution_hash` linked to the queue hash and final world state.
- `world_history.json` stores both `chronological_mutation_queue` and `chronological_mutation_execution`.

## Failure modes

- `WORLD_SIMULATION_MUTATION_PATH_UNRESOLVED`: a queued mutation cannot be mapped to world state.
- `WORLD_SIMULATION_MUTATION_PRECONDITION_MISMATCH`: a queued mutation's declared `from` value does not match the executor state.
- `WORLD_SIMULATION_UNQUEUED_STATE_MUTATION`: subsystem preview state contains a change not reproduced by the authoritative queue.

## Boundary

Phase62K does not yet require each subsystem to emit a pure immutable proposal object internally. They may still use private cloned drafts for causal computation. The critical authority change is that those drafts are never committed directly: only the chronological mutation executor can produce the final turn state returned to the persistence layer.
