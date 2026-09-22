# VA-14 — Verification Telemetry: first batch

This is a read-only, deterministic aggregate of VA-6 verification manifests and VA-13 selector-audit receipts. It does not become a second validation authority, routing gate, or Development Journal.

## Inputs

- A verification-manifest-v1 integration/development receipt.
- A ci-selection-audit-v1 scheduled receipt.
- A dev-run-tests.last.json containing a nested verification_manifest.

Example: node tests/run-verification-telemetry.mjs --manifest manifest.json --audit ci-selection-audit.last.json

The CLI reads files and prints JSON; it does not overwrite evidence or change source state. Duplicate exact evidence identities are rejected.

## Observed metrics and boundaries

- Gate/suite duration: count, sum, min, max, unavailable; units are milliseconds.
- Fallback-to-all counts only actual all selection or VA-13 full fallback. A routed mcp + mcp_tunnel escalation is NOT fallback-to-all.
- Failure classes preserve VA-7 classified evidence, rather than guessing from logs.
- A VA-13 SELECTOR_MISS_CANDIDATE is not a confirmed selection error without causal review.
- Cache hit/miss/bypass counts require explicit test_result_cache evidence. VA-6 currently has none; snapshot fingerprint-cache counters must NOT be substituted.
- Per-test-file durations are unavailable from suite-level evidence and are null, not zero.

The first batch did not persist long-term history or upload CI artifacts. The second batch below adds bounded CI receipt retention; multiple retained receipts can be supplied together to the aggregator for cross-run telemetry. No network exporter, background process, or new runtime dependency is introduced.

Design reference: OpenTelemetry separates duration observations (count and sum) from categorical counters and recommends stable metric dimensions.

## Second batch: structured cache evidence and CI retention

When a developer explicitly runs `node tests/run-communication.mjs --development-result-cache`, a successful full communication-suite run atomically writes `tests/.tmp/communication-result-cache.last.json`. It records an independent run UUID, optional CI commit SHA, completion time, enabled/PASS state, and the VA-11 parallel-shard hits/misses/bypasses. At the start of each cache-enabled run, a stale `last.json` is removed; a failing suite does not publish a new PASS receipt. Formal CI continues to run without development-result caching.

Supply this receipt using `--cache-receipt tests/.tmp/communication-result-cache.last.json`; the telemetry aggregator validates its schema, identity and nonnegative integer counters, and refuses duplicates. The optional commit SHA is **not** a substitute for the Journal's exact snapshot identity. These counters cover the reviewed parallel communication shard, not all tests in every subsystem. An unavailable receipt remains `null`, never a fabricated zero.

The scheduled Ubuntu/Node 24 selector-audit lane now derives a telemetry JSON summary from the VA-13 receipt and uploads **only** the audit and aggregate JSON files as a GitHub Actions artifact, including when the scheduled gate fails after writing its receipt. The artifact name includes run ID and attempt. Retention follows the repository / organization Actions policy instead of being shortened in workflow code; GitHub's default is 90 days, subject to repository or organization policy. Because files live in `tests/.tmp`, upload enables hidden-file handling only alongside two exact paths; unrelated temporary files are not included. If failure occurs before the audit receipt is produced, the uploader warns that there is no evidence rather than manufacturing one. The weekly Full x3 matrix and all formal validation gates remain intact.
