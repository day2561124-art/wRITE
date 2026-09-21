# Verification baseline (VA-0)

This is a historical, machine-readable preservation of committed verification behavior at
`5b2cf2f9c6b89dc6a670abdd721890274f804d44`. It is not a routing policy, certification renewal,
or a cached test result. VA-0 adds only this note, the manifest, and an explicit read-only verifier.
Existing runners, selector fallback, certification, reliability, CI and integration gates are unchanged.

## Reproduce and verify

Run `node scripts/verify-verification-baseline.mjs` from this checkout. It reconstructs the
manifest from exact baseline Git blobs, checks source SHA-256 values and script existence,
and compares every field. It never imports or executes the test runners. Bounded declaration
fragments are evaluated without filesystem, process or module access. The baseline commit must
be available locally; missing history or unexpected structure fails the check.

For review, `node scripts/verify-verification-baseline.mjs --generate <exact-HEAD>` prints a snapshot
to stdout. It does not overwrite the preserved manifest. Future phases must retain this historical
baseline rather than updating its HEAD to make changed behavior appear unchanged.

## Inventory and behavior

- 579 distinct test files directly referenced by the full runner; 188 grouped, all in that inventory
  (32.47%). There are 617 tracked `.test.mjs` files in total. These denominators differ: nested MCP
  tests and other tests outside direct run-all steps are listed separately, not silently counted as
  directly scheduled or assumed to be dead tests.
- Seven controlled suites: mcp, mcp_tunnel, affected, world_simulation, cognition, memory_retrieval, all.
- Full runner step order and argv, subsystem membership, certification membership, 24 sequential MCP
  scripts, per-suite and per-step timeouts, and the three CI environments are preserved in JSON.
- Each subsystem runner also starts with the test-suite-groups inventory contract.
- Affected selector v2 computes dependencies but the affected runner executes the entire selected
  subsystem. Unknown paths still fall back to all; ungrouped transitive tests can be deferred to the
  final all gate. VA-0 records this distinction without changing it.
- Formal candidate validation still runs mcp then mcp_tunnel against the exact integration commit.
  Full working-tree post-integration diff checks, freshness checks, dirty preservation, Journal,
  transactions, checkpoints and authoritative remote verification remain required.

## Authoritative observations at intake (2026-09-21 UTC)

Canonical HTTPS ls-remote main and local main both resolved to the baseline HEAD. Local tracking
origin/main was not treated as remote evidence. Workspace registry revision 1248 and storage were
healthy. Journal sequence 16492 had a verified chain, no dangling or active operations, and no
reconciliation requirement. Transaction status had zero active, recovery-required or integrity issues.
Checkpoint store was healthy with zero reclaimable bytes. These are intake observations, not reusable
claims about live external or process state.

The active CC-6D workstream was `dev_workstream_20260921-140157_0050047b0f56`, workspace
`dev_workspace_24a1bcccbf9840788bbcacd3`. Its declared scope is protected:

- server/src/character-communication-speaker-recognition-service.mjs
- server/src/world-simulation-loop-service.mjs
- server/src/world-simulation-state-service.mjs
- tests/communication/cc6-native-speaker-recognition.test.mjs
- tests/run-all.mjs

VA-0 uses a separate registered isolated workspace. It does not register its verifier in run-all
because that path is owned by CC-6D and VA-0 must not change validation behavior.

## Existing integration discrepancy

The latest three candidates at intake had passing exact-candidate MCP and tunnel reports but
state failed with POST_INTEGRATION_VERIFY_FAILED. The most recent was
`dev_integration_20260921-133102_0a9e4e9278a4`; its recorded HEAD matched, staged/conflicted counts
were zero, dirty bytes were preserved, and diff_check_passed was false.

A fresh main `git diff --check` independently reported existing whitespace errors at
`config/visual-library-final-e2e-acceptance.json:19` and
`tests/maintenance/mcp-tool-inventory-baseline-reconciliation.test.mjs:39,44`.
They are unrelated dirty files and are not changed by VA-0. Do not label intake integration healthy,
weaken the diff check, repair unrelated files, or repeat a known failing main advancement merely to
obtain a new failure record. Candidate validation and main application are separate outcomes.

VA-1 may begin only after VA-0 has successfully completed its required integration and canonical
remote exact-match verification. No later-stage capability is implemented here.
