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

Formal integration receipts use exact candidate/source/target commit identity.
Standalone `dev_run_tests` receipts use the *workspace snapshot ID* and
snapshot HEAD, with `commit: null` and `evidence_identity: "workspace_snapshot"`.
An uncommitted working tree is never presented as an exact validated commit.
Standalone receipts contain actual suite outcome and Journal operation ID,
suite-granularity selection, snapshot changed paths, and a SHA-256 of the
manifest in the returned result, last-run record, and Journal terminal event.
The suite runner does not emit per-file receipts, so no per-file coverage is
claimed; a standalone run does not imply any skipped suite or certification.
Early failures before a verified snapshot or Journal operation have no
fabricated manifest and remain failed; persistent-result or Journal-terminal
errors never produce stable PASS. These receipts do not replace integration
preflight, exact candidate tests, Journal, or authoritative remote checks.

VA-7 first slice adds a bounded `failure_classification` to both integration
and standalone manifests. The vocabulary is PASS_STABLE, REGRESSION, FLAKY,
INFRA_FAILURE, ENVIRONMENT_FAILURE, TIMEOUT, LOCK_CONTENTION, UNKNOWN.
It is diagnostic and preserves the original gate outcome. PASS_STABLE means
only that this original gate passed, not a statistical guarantee of future
stability. TIMEOUT uses an actual timeout receipt; lock, environment and
infrastructure use explicit machine-readable error codes, not stderr text.
FLAKY needs a verified same-snapshot, same-suite pass/fail comparison;
REGRESSION needs a verified controlled baseline comparison with non-code
confounds excluded. Neither comparison is fabricated from one run. VA-8
controlled retries remain separate future diagnostic evidence, and may never
turn the original FAIL into PASS. Missing or ambiguous evidence is UNKNOWN.
The classifier is included in the existing manifest SHA-256 rather than
creating a new gate, retry authority, or per-test evidence claim.

VA-8 controlled retry (formal exact-candidate integration) runs at most one
**diagnostic** re-execution of the first failed required suite. The initial
suite's result and Journal operation remain the only gate-authoritative test
evidence. A retry is permitted only when the first failed run has a Journal
operation, exact candidate HEAD and workspace snapshot receipt; before the
retry the server independently recaptures the same clean isolated
integration worktree snapshot. The retry launches a fresh allowlisted test
child, acquires its own run lock, and gets a separate Journal operation.
A changed or dirty snapshot, missing provenance, or unavailable runner
results in a recorded skipped/inconclusive diagnostic, not an invented retry.
The suite plan still stops at the first required failure; retries never run
on an initially passing suite or recursively rerun a diagnostic failure.

The bounded `diagnostic_retries` and `diagnostic_attempt_count` appear in
the existing exact-candidate verification manifest, its SHA-256, and the
persisted validation report. FAIL then FAIL is recorded as
`stable_failure_observed_twice` (a two-observation diagnosis, not a promise
about all future runs); FAIL then PASS becomes
`flaky_or_infra_unstable` only with verified same-suite/snapshot/commit
and distinct Journal operation IDs. A second timeout or infrastructure
failure stays inconclusive, rather than being called a stable assertion failure.
The test runner returns the snapshot HEAD as well as recording it in its
persisted receipt, so the exact-commit comparison can actually be enforced.
Missing comparability is inconclusive.
None changes the original FAIL or permits integration. Standalone
`dev_run_tests` is unchanged and is not silently auto-retried. This
implementation reuses the server-owned isolated integration worktree with
a fresh child; it does not claim a separately materialized second worktree.

Research reference: SLSA build provenance records exact input identities
and resolved dependencies; GitHub attestation guidance distinguishes
recording provenance from verifying it. This is an internal unsigned
verification receipt, not a SLSA attestation or a claim of signature.
