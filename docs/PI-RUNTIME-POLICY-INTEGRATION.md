# Pi Runtime × Execution Policy integration preparation

2026-10-09 Asia/Taipei. This is an isolated candidate, not a production integration or SEALED milestone.

Latest result: **Integration Gate BLOCKED**. Complete MCP PASS on `7b6e7766e30458ea82368ccdeecdc503a66f97a5`; complete mcp_tunnel PASS remains valid through unchanged executable source. Original Runtime operation is EXECUTING revision 7, outcome UNKNOWN. No deployed non-dispatch reconciliation entrypoint is available, and deployment isolation is unproven.

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

## Final required Gate round — 2026-10-09 Asia/Taipei

Tested candidate: `d2a5143e343b6d35cbab0054c513ac38ef81712b`. Prior 83/83 focused and 16/16 affected results remain applicable: executable source hashes match, no product code changed this round.

- **mcp: FAIL**, exit 1, 764,768 ms; complete existing suite entrypoint, no test filtering.
- **mcp_tunnel: PASS**, exit 0, 136,494 ms; complete existing suite entrypoint, no test filtering.

The MCP failure is **test fixture/environment**, at its final `pi-bootstrap-wire` entrypoint: ENOENT while enumerating local worktree `node_modules`. Earlier scripts completed, including the repaired HTTP integration-control fixture. The fixture explicitly scans that directory instead of relying on parent Node resolution. Created an ignored junction in this owned worktree to existing main packages; no npm install, dependency changes or source modification. Targeted wire retest: **PASS**, exit 0. The complete-run FAIL remains preserved. A second complete MCP run would exceed this lease based on the observed first-run duration; full MCP after environment repair is **not tested**, not PASS.

Original operation remains **EXECUTING, revision 7, outcome UNKNOWN**. Formal read-only status/linked publication/keys are archived; completed receipts 0, tool results 0. PID 6176 remains absent with parent 7348 as positive control. This does not establish safe terminal outcome or deployment isolation. No resume/resubmit/replacement operation or durable-state edit was performed. Linked Journal publication completed only pi.execution.persist; the recorded Pi state is still EXECUTING.

Risk classification: **BLOCKED**. The retained durable owner triggers `ROUTE_ACTIVE_EXECUTION` for route change. Safety of runtime reload and every possible unrecorded side effect is not established; therefore SAFE_ISOLATED is not justified. The classification does not modify Pi state. Offline Git and tests are isolated from original durable state.

Live Journal: **healthy**, chain verified **true**. Live Checkpoint Store: **healthy**. The read-only Journal snapshot also reported two active Journal operations; their IDs were not used for recovery, inspection or cleanup. Other engineering state remained untouched. Windows file-symlink case skipped by existing Journal test; not recorded PASS. Journal health is distinct from Pi terminal recovery.

The deployed status read took 129548.340 ms; this is not ChatGPT E2E latency or proof of candidate production behavior. Deployed PowerShell E2E remains not tested.

Full required suite result: **FAIL**. Overall Integration Gate: **BLOCKED**, formal delivery conditions **not satisfied**. No integrate, push, cutover, runtime hot replacement or SEALED claim.

Companion final-gate compressed raw evidence SHA256: `dca23965c8d056bfa20492a25944ca647b83995472a0292a6eaf48f07f5dc1b7`. Original two candidate worktrees remain clean at their authorized HEADs; integration candidate has no unresolved Git paths. Final Git diff-check and document-only delivery commit are recorded separately.

Next action: Rerun only the required full MCP suite in the prepared environment next lease; preserve completed mcp_tunnel and focused evidence with exact source bindings. Retain original operation read-only pending Engineering Authority authorized Pi reconciliation or sufficient deployment-isolation proof. No integrate/push/cutover.

## Final Gate Closure — 2026-10-09 Asia/Taipei

- Complete official MCP entrypoint: **PASS**, exit 0, 851,176 ms, source `7b6e7766e30458ea82368ccdeecdc503a66f97a5`. No filtering or early-success substitution.
- Existing complete mcp_tunnel: **PASS_RETAINED**; no rerun. Prior full result/archive checksum valid, and only documentation changed since its tested commit. Existing 83/83 focused and 16/16 affected checks remain valid by unchanged source hashes.
- Both dependency junctions verified against expected installed main/root and Pi-runtime dependency directories; no installation or shared dependency change.

Original operation **pi_operation_ab4776c172b84bfa921ee99117a6728d** remains **EXECUTING, revision 7, outcome UNKNOWN**. Projection hash unchanged; receipts 0, tool results 0. Host probe: original PID 6176 absent, deployed parent 7348 present. Original keys and the fingerprint-qualified active begin lookup returned not_admitted; no other worker/child admission is observed, but unknown effects are not inferred to be absent. There is no explicit lease/heartbeat expiry to discard this claim.

**Reconciliation not completed; SAFE_ISOLATED not established.** Formal deployed tools/list exposes no reconcile-only or owner-fence-only Pi tool. `dev_workspace_recover_checkpoint` forks a checkpoint and is not operation-owner recovery. The production controller exposes execute/admit/inspect/status; the engine exposes execute only. Its private reconciliation can schedule retry after not_started or advance to pending mutations after completed. Owner release requires ownership and no active call. Calling execute or internal store commands is therefore not an authorized non-dispatch repair. No resume, replay, replacement intent, CAS/storage write, checkpoint recovery or installation action was performed. The original durable owner still conflicts with route changes; runtime reload/deployment isolation remains unproven.

The separately supplied roleplay operation evidence reports MCP begin completed with a real workstream while Pi remains EXECUTING revision 7. This reinforces the lifecycle convergence risk and forbids interpreting all missing Pi receipts as no effect. It is user-provided diagnostic evidence, not independently queried here, and was not mixed with Runtime receipts, owner or recovery decisions. No new lifecycle implementation is added.

Live Journal **healthy**, chain verified **true**; Checkpoint Store **healthy**. Existing Windows Journal file-symlink test skipped; not recorded PASS.

Final Integration Gate: **BLOCKED**, not READY_FOR_INTEGRATION. Only verification documents/evidence changed; no integrate, push, cutover, routing mutation or hot replacement. Full raw source/API audit, formal read-only responses and complete MCP log are archived in `PI-RUNTIME-POLICY-INTEGRATION.closure.raw.json.gz`, SHA256 `28dbb7881a4df8782d6ef3e16624622d028a545375b6096e8bf42f5376de6735`. Final diff-check/clean delivery SHA are reported after the documentation commit.

Next action: Full MCP Gate is closed. Stop additional tests/features. Engineering Authority must provide an existing formal non-dispatch reconciliation path or authoritative deployment-isolation evidence for the original operation; do not invoke execute to probe recovery.
