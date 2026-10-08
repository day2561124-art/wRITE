# Pi Runtime × Execution Policy integration preparation

2026-10-09 Asia/Taipei. This is an isolated candidate, not a production integration or SEALED milestone.

## Candidate and merge

Runtime `3f972024dec8f2c6c6a86943dcd0fefa749fb9c4` and Policy `5046c93fa18279bc08e0c234ad244a3c79cd1df5` share main base `fcfba25de3fc521ea73e326d190ab358ee58d513`. Both original candidate worktrees were clean and left untouched. New worktree: `E:\武裝學院的二三事\.pi-runtime-policy-integration`, branch `codex/pi-runtime-policy-integration`.

Merge commit `f7e9be18b22a3ee7436bde77c7250bde0697ff3e` retains both parents. The only conflict was the import block in `server/src/pi-production-execution-controller.mjs`: retain both Runtime's `traceSpan` and Policy's `admitPiLightweightRead`. `server/src/mcp-server.mjs` auto-merged; snapshot/tracing, trusted workspace resolution, compact intent adaptation, and mutation guard remain present. No version replaced the other wholesale.

Read-only Git preflight found no intersections between candidate changes and the observed main dirty overlay. Shared Journal/store files under other active engineering ownership were not modified. This is offline analysis, not a server-registered integration preflight/validation record.

## Original UNKNOWN operation: BLOCKED

Formal deployed HTTP MCP `dev_pi_execution_status` returned operation `pi_operation_ab4776c172b84bfa921ee99117a6728d`, EXECUTING, revision 7, last update `2026-10-08T14:54:01.379Z`. Durable owner is SDCP PID 6176, worker `pi_worker_e41b5d0cf75548a394fdad562e714c6d`; active mutation claim is step `begin`. There are zero completed receipts/tool results. Its checkpoint is a logical Pi projection checkpoint, not evidence of a physical Checkpoint Store recovery.

Host read-only liveness check found PID 6176 absent, with deployed parent PID 7348 present as a positive control. The owner record has no explicit expiry establishing a safe lease cutoff. Both original reconciliation keys returned `not_admitted`; automatic replay is prohibited. This provides no observed MCP admission/result, but does not authorize assuming that the whole operation failed or never had effects. Full independent history and all possible external side effects were not verified this round.

No resume, resubmission, replacement intent, state reset, fencing change, or cleanup was performed. Only owned read-only MCP sessions were closed. The known deployed timeout risk remains undeployed; repeating recovery is unsafe without an authoritative recovery decision. `pi-production-execution-route.mjs` rejects route changes when a durable owner exists, regardless of PID liveness. Safe isolation from deployment is therefore unproven: UNKNOWN is an integration blocker, not harmless technical debt. Other engineering operation IDs were not used.

## Verification

Focused integration run: **83/83 PASS**, 0 failures, 0 skips, 106,243.4367 ms. Serial Node focused files cover contract, production execution (including Policy checks), status snapshot, HTTP timeout reliability, tracing/privacy, Phase 1 checkpoint pressure, HTTP Pi/PowerShell fixture, guarded read-only entry, and introspection. Journal/Checkpoint/Transaction are isolated through existing test environment flags.

The actual isolated HTTP → adapter → MCP → Pi → PowerShell fixture made 11 physical dispatches. Lost-response recovery retrieved the same COMPLETED operation; duplicate intent reused its result with stdout `PI_PHASE2_OK`, stderr `PI_PHASE3_STDERR`, exit code 0, and no elevation. Correlation and trace privacy checks passed, and owned fixture processes drained. The helper's legacy Phase 2 baseline label is not source provenance: the enclosing evidence binds the executed merge commit and executable source hashes.

This verifies the HTTP fixture. Deployed local/HTTP PowerShell and ChatGPT production-path E2E are **not tested**. No new live intent was created while the original outcome remained unknown.

Formal suite selection requires **mcp + mcp_tunnel** under the existing conservative integration router. The first complete MCP runner attempt on merge commit f7e9be1 failed at `mcp-http-integration-control.test.mjs`: its explicit fixture copy list omitted `mcp-request-tracing.mjs`, newly required by the HTTP adapter. Earlier runner checks, including Journal and Checkpoint suites, passed. The Journal suite recorded a Windows file-symlink platform skip; this case is not claimed as verified.

The minimal regression fix adds that module to the fixture copy list only. No production behavior or security condition changes. Its targeted rerun passed **16/16**, 0 failures, 0 skips, 66,362.2331 ms. The first full-run failure remains preserved. Full MCP after this repair and mcp_tunnel are **not tested** within this lease; targeted success cannot replace those required gates. No authoritative exact-candidate formal validation record exists yet.

## Health and observation boundaries

Formal deployed read-only Journal status: healthy, chain verified, no dangling/active Journal operations. Checkpoint Store status: healthy. These do not settle the separate Pi operation. The fault-injection HTTP fixture preserves its Journal chain but reports degraded health with `ambiguous_terminal_operation_requires_reconciliation`, intentionally retaining an ambiguous failure for review; it is not an all-healthy production claim.

The single deployed status query took **95,296.166 ms**; Journal status took 2,586.2915 ms and Checkpoint status 3,555.062 ms. These are observed local HTTP MCP call durations, not ChatGPT end-to-end latency or a statistically valid before/after benchmark. The deployed service reports revision `23a1422db197bf73ad1e53fa37703da3962e2ee5b003e99b5bee34f4a1195896`, not either candidate. No production improvement is claimed and no new internal-stage root cause is inferred.

## Delivery and next action

Companion `PI-RUNTIME-POLICY-INTEGRATION.evidence.json` and compressed raw JSON contain status replies, liveness checks, reconciliation lookups, source hashes, Git preflight, required suite selection, focused TAP, full MCP first-failure log, fixture retest, and HTTP fixture durable results. The delivery SHA is the Git commit containing this report; it is reported separately to avoid self-referential commit content.

Git diff-check passed; the delivery procedure checks the staged candidate before committing. Integration Gate remains **BLOCKED** by the unresolved durable owner/outcome and incomplete required full validation. No integrate, push, cutover, routing change, runtime replacement, or SEALED claim occurred. Next lease: retain the original operation read-only pending authoritative Pi recovery decision; rerun full mcp and mcp_tunnel on the final isolated candidate, then obtain exact-candidate formal validation. Do not replay UNKNOWN mutation.
