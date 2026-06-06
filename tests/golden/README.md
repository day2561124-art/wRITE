Golden tests placeholder

This directory will contain canonical example fixtures and golden tests that must pass before activation.

- Place canonical fixtures under `tests/golden/fixtures/`.
- Implement tests such as `tests/golden/canon_golden.test.js` that assert canonical queries always return expected canon fragments.

P0 failures in these tests must block activation.

Included: placeholder golden fixtures `golden1.jsonl` .. `golden5.jsonl` for initial CI skeleton.
