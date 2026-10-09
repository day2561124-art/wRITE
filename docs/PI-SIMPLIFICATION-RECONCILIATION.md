# Pi simplification: bounded reconciliation checkpoint

2026-10-09 Asia/Taipei. Lease started 17:59 UTC, stops before 18:24 UTC. Candidate only; no production cutover, integrate or push.

## Reused capabilities and smallest change

Runtime/Policy base is 16214c95d0dffe3dfe082e4413af0ef46558eafc. Preserve its full MCP/tunnel evidence for that base; new code requires a new exact-candidate Gate. Policy compact authorized requests, bounded lightweight reads and guarded commit routing were already implemented and are not rebuilt. Main remains fcfba25de3fc521ea73e326d190ab358ee58d513.

Add reconcileOnly to the existing engine/controller and request_kind=reconcile_only to the existing dev_pi_execute_intent ingress. This mode takes only original operation_id, context, expected_revision and the full expected_owner. Reuse the adapter's authoritative MCP lookup, deterministic reducer, owner liveness, append-lock CAS and existing owner/reconciliation commands. No new tool, executor, database, journal, state transition, lock or result contract. Validate the entire receipt/binding before owner takeover. Unknown/not-admitted/active results and uncertain/live owners retain original revision, owner and claim. Query at most once; never dispatch, admit or schedule retry. A completed receipt is recorded, the owner is formally released after the claim settles, and pending steps wait for GPT continuation. Interruption between writes remains recoverable through existing Journal publication and owner fencing; this is not an atomic multi-command transaction.

## Real faults and authority boundaries

Formal Runtime status still reports EXECUTING revision 7, owner PID 6176, original begin claim and zero receipts. Formal original begin lookup returns not_admitted with automatic_replay_allowed=false. This cannot settle the UNKNOWN operation or justify dropping its claim. No original mutation was replayed.

Formal roleplay status reports EXECUTING revision 7, owner PID 26424 and zero receipts. Separately the exact MCP begin lookup reports completed operation dev_operation_a19bfeedf5524c39aee7de0d6a62e7d3, bound key/fingerprint, workstream dev_workstream_20261008-171725_f6f8ff492487. This confirms lost result convergence. The candidate recognizes this scenario in durable fixtures and preserves isolate dependency order. It has NOT reconciled the production operation: the deployed ingress lacks this mode, and unvalidated hot replacement is not authorized. Owner expiry is not represented by this runtime; no synthetic lease expiry or force unlock is used.

Initial formal status calls returned CHECKPOINT_STORE_BUSY and HTTP504; bounded sequential read queries subsequently succeeded. Old production dev_git_diff still rejects with PI_EXECUTION_INTENT_REQUIRED. Do not claim candidate production latency or live workflow acceptance.

## Existing candidate and Stage 2B

Formal Journal Recovery candidate dev_integration_20261008-162204_adc0c3e3413f is ready revision 6, integrated_at=null, target fcfba25d, exact source/integration 2053fc74e5ebc40712ade4a2fc209b294ed90652. PASS_STABLE and exact MCP/tunnel evidence are retained; do not rerun or reimplement this candidate. Its target will require renewed preflight if Runtime integrates first.

Stage 2B worktree dev_workspace_e435cb0f22674a2fa370d67e retains its original three dirty files. Read-only Journal observation identifies pi_operation_6352b4290f37475bbcc89502103fefb5, WAITING_RETRY revision 12, WORKER_INTERRUPTED, no active call, original verification key uer-v1.2-stage2b-postprovenance-mcpcore-0021. This filesystem observation is not a new formal reconciliation. Existing focused Result Contract tests: 31/31 PASS, no skip, 23925.8175 ms. Required mcp_core and formal candidate validation remain outstanding. Its source was not edited or committed here. Shared tests/mcp/pi-reliable-execution.test.mjs must be merged with this candidate's new tests after ownership/preflight review.

## Verification and remaining Gate

Engine focused: 42/42 PASS, no skip, 20951.3701 ms. Production/Policy/actual MCP ingress: 41/41 PASS, no skip, 25711.2364 ms. Bootstrap: 8/8 PASS, no skip, 4631.2498 ms. Status snapshot: 4 PASS retained from combined regression; unchanged snapshot source. Real child-process exit after dispatch recognizes the existing physical effect once, clears only the settled claim, then explicit continuation completes with effect count still one. MCP wire reconcile_only preserves a live owner's exact projection.

Two combined runs recorded a single bootstrap fixture failure. The fixture originally returned a raw callback object; the official Journal extracts durable original_result from MCP content. Correcting the fixture to the actual MCP envelope passed all eight bootstrap tests. Both failed runs remain archived; they are not relabeled PASS. Sandbox-only Node realpath EPERM was resolved by authorized isolated test execution. No production guard was weakened.

Raw TAP files and exact hashes are in the companion verification evidence/archive. Git diff-check and offline Git merge-tree checks are recorded at delivery. Formal Integration Gate remains BLOCKED: new exact-candidate required suites/preflight not completed, production UNKNOWN unresolved, runtime worktree not formally registered, and live reconciliation mode not deployed. No global UNKNOWN gate was removed: independent operations are safe only when scope isolation is actually proven. Production main push and cutover boundaries remain unchanged.

## Minimal next_action

Next lease: register/bind this owned candidate through existing workstream mechanisms when the production route safely allows it; run existing exact-candidate MCP/tunnel Gate for the changed commit (do not duplicate base evidence). Review a bounded deployment path before activating the mode. Then reconcile only roleplay's completed begin with fresh revision/full owner guards; leave Runtime UNKNOWN fenced unless completed evidence appears. Renew Journal Recovery preflight against the actual target without reimplementation. Continue original Stage 2B mcp_core with its original intent/key only after authoritative retry/owner review, then commit/preflight/validate. Stop before formal integrate/push/cutover pending final authorization. Package installation remains outside this repair.
