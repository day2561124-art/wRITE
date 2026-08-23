# World Simulation Fixed-Point Convergence

Phase62V makes causal fixed-point termination explicit and deterministic.

- Convergence means the current and next derivation-context hashes are identical.
- A changed context requires another causal epoch, query pass, and arbitration pass.
- Revisiting an earlier noncurrent context is an oscillation and is rejected.
- Reaching the iteration limit without convergence is rejected; the final attempted iteration is never silently accepted.
- Diagnostics record each iteration's current/next context hashes and convergence status.
- The convergence guard is read-only and cannot mutate World State or choose causal outcomes.
- Character brains cannot decide convergence, iteration success, oscillation handling, or iteration-limit acceptance.

Persisted World revision/hash and Phase62U causal-epoch freshness remain separate concerns: Phase62V proves whether the within-turn derivation context has reached a fixed point.
