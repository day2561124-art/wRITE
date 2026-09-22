# VA-6 — Verification Manifest (exact-candidate integration slice)

Baseline: da8a4749916749c0894192173053202b2f79d6c1.

The candidate registry's existing `validation_report` now carries
`verification_manifest` and `verification_manifest_sha256`. The Journal
terminal integration-validation event records the manifest SHA-256 plus its
gate result and risk class. Existing `suites`, `passed`, provenance links,
candidate freshness, diff checks, dirty-main protection, and remote checks
remain in place. This schema is additive; it is not a substitute for them.

Each manifest binds the **exact integration commit** to the source HEAD,
target HEAD, workstream/workspace, exact target-to-candidate changed paths,
risk class and fallback reason, required suites, actual suite outcomes,
operation IDs (where provided), aggregate reported suite duration, and
certification/reliability requirement flags. `tests_selected` currently
means selected *suite scopes*, explicitly marked by
`test_selection_granularity: "suite"`: the suite runner does not yet
provide verified per-file execution receipts. No manifest claims per-file
coverage. `tests_skipped` only identifies the two legacy MCP gates when
not required and not actually executed; it is not an exhaustive inventory
of all unselected tests.

Gate PASS requires every required suite's result, no duplicate suite
receipts, no suite failure or timeout, successful diff check, and a clean
post-test integration worktree. Missing plan/runner evidence escalates
fail-closed; no inferred PASS and no retry-as-stable-PASS. The validation
report remains attached to the immutable candidate identity and is
preserved after the temporary integration worktree is removed.

This slice captures **formal integration** receipts, not yet all standalone
`dev_run_tests` invocations. A later VA-6 slice must extend manifest
coverage to standalone development gates without conflating working-tree
snapshots with committed candidate identity.

Research reference: SLSA build provenance records exact input identities
and resolved dependencies; GitHub attestation guidance distinguishes
recording provenance from verifying it. This is an internal unsigned
verification receipt, not a SLSA attestation or a claim of signature.
