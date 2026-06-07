# Canon Golden Tests

Run:

```text
node tests/golden/canon-golden.test.mjs
```

The seven JSONL fixtures verify:

- Canon retrieval preserves 夜星's formal stage from `active_engine.md`.
- Formal-stage and Canon-write locks remain in `docs/core_invariants.md`.
- Candidate prose cannot become Canon before adoption and settlement.
- Canon retrieval exposes the registered source trust level and Canon status.
- Repository JSON/JSONL code blocks remain parseable.
- CI continues to run the complete local test suite.
- The adopted longline active file, v1.1 version, and user-supplemented source transcription remain byte-for-byte identical.
- The adopted proofing card active file, v1.1 version, and attachment source remain byte-for-byte identical.

The complete test runner also validates all 15 registered source-trust records,
including the explicit T8 downgrade for the no-formal-errors compressed-rule placeholder. Any failure blocks CI
and engine activation.
