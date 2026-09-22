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

The first batch does not persist long-term history or upload CI artifacts. These can be added using the same contract after provenance review. No network exporter, background process, or new runtime dependency is introduced.

Design reference: OpenTelemetry separates duration observations (count and sum) from categorical counters and recommends stable metric dimensions.
