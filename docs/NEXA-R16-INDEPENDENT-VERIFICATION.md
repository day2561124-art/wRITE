# R16 independent full verification

Status: implementation candidate, not a release approval or production trust configuration.

## Why a separate verifier

The installed dispatcher can only execute the explicitly fixed five-file AppContainer suite. The full test suites use network listeners, subprocesses, Git, dependency installation and platform-specific fixtures. Expanding the existing sandbox to allow those facilities would change its security boundary. Do not substitute hermetic success for full-gate success or execute full suites unconfined on the operator host.

Use disposable hosted verification for committed candidate objects. Preserve the original exact integration diff, risk-routed required suite plan and all original gate assertions. A separate trusted verifier must observe the actual checkout, reviewed workflow identity, job/attempt and outcome, not a candidate's self-reported JSON or stdout. Full release verification requires the original all suite and any independently required platform gates; focused integration verification remains governed by its own existing plan.

## Evidence consumer implemented on this branch

- `server/src/mcp-independent-verification-evidence.mjs` is a read-only verifier. Host-owned expected identity binds candidate ID, revision, integration commit, source and target heads, repository, issuer and required suite/platform/workflow hashes.
- Verify Ed25519 signatures over exact bytes using an independently pinned issuer public key. Enforce bounded, fresh receipts; reject partial, duplicate, failed, skipped, timed-out, stale and mismatched evidence. Do not accept a caller-supplied trust key or policy in an MCP tool.
- A positive result always has `execution_authorized:false`. There is no signing key, production trust configuration, new MCP operation, integration-state mutation or new grant in this branch.
- Tests use an ephemeral fixture key and synthetic signed results, not actual external verifier observations.

## Remaining implementation

1. Select an independently operated verification source with a pinned reviewed execution definition and a protected signing identity that candidate code cannot read, modify or invoke to sign arbitrary data. Reuse existing disposable GitHub CI where its actual exact checkout and required jobs can be independently verified; do not use candidate-controlled artifact text as the source of trust.
2. Implement the trusted source adapter, independent proof collection, issuer and policy configuration through the existing operator-approved host mechanism. No shared production credentials, live grant storage changes or operator data in the candidate runner.
3. Bind the verified evidence to the current server-owned integration candidate and existing Journal provenance; preserve freshness/CAS, dependency, diff and cleanup gates. Recheck immediately before any independently authorized application. Never publish a synthetic local test receipt as if a remote suite had run locally.
4. Exercise exact committed fixtures with full suite, failure/expiry/forgery, cleanup, duplicate and stale-candidate scenarios. Run the original platform and full gates; separately prove host adoption under existing authority.
5. A dirty uncommitted workspace is not an exact remote commit. Keep the full-workspace route unavailable until an appropriate independently verified snapshot mechanism exists; no inferred equivalence.

The current PR #137 remains unchanged while its full CI runs. This branch is stacked on 5723490d62b4fa44c71874da109e5877d8e9fff6. No production deployment or authorization change is made.
