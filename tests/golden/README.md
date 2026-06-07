# Canon Golden Tests

Run:

```text
node tests/golden/canon-golden.test.mjs
```

The five JSONL fixtures verify:

- Canon retrieval preserves 夜星's formal stage from `active_engine.md`.
- Formal-stage and Canon-write locks remain in `docs/core_invariants.md`.
- Candidate prose cannot become Canon before adoption and settlement.
- Repository JSON/JSONL code blocks remain parseable.
- CI continues to run the complete local test suite.

Any failure blocks CI and engine activation.
