# R16 — full engineering lifecycle acceptance contract

Refs #106. Baseline: main 2de6808e8794a1df5c7f41e133acb8598dfe4267 (R15 merge). Status: review and implementation contract, not an authorization record or release approval.

## Confirmed baseline

- R14: actual native Git commit b8c5f47f4b2dabb50c4b65c9b04bda08eacc7063, exact one-file provenance, clean isolated workspace. Journal sequence 66462 verified, no pending/reconciliation operations.
- R15: PR #136 head de6d13f9e29d8b3676a41862952e2a41d5ee7aa9; workflow 45933567191 passed. Limited Session 0: actual native runner killed, guest terminated, provider handles closed, independent guardian cleanup receipt, profile re-creation succeeded (absence before fixture deletion), staging removed. Workflow 45933567220: all six executed jobs passed. Merged tree equals tested head. This proves a single native-runner termination, not concurrent guardian/host failure, or the pre-Job-assignment window.
- Main on GitHub is the merge above. Local main 2955dc448943443750d478aecdbd216b0a754a17 is dirty, tracking stale, remote object unavailable locally; do not fetch/overwrite/reset/push as part of an acceptance fixture. No R15 production deployment or post-merge push CI is certified.

## Scope

The operator should not need to repeat routine engineering instructions or transfer task IDs by hand. Existing independent authorization, authentication, confirmation, policy revocation, workspace boundaries and host protections remain authoritative. Do not issue or approve new authority from GPT/Pi, modify live grant storage, treat a request as a host policy, or route around a denial. A stage which cannot run under existing authority stays explicitly blocked.

Do not expand the ordinary standing capability list into an unrestricted lifecycle or privileged maintenance grant. The task-grant layer's requiresPiTaskGrant=false does not mean an operation is permitted; it means the operation has other applicable gates. Verify those gates independently.

## Required lifecycle evidence

| Step | Current typed route | Required acceptance |
| --- | --- | --- |
| Bootstrap | workspace.begin_workstream + workspace.create_isolated | Existing authenticated bootstrap route creates server-owned IDs and immutable base; durable binding; replay leaves one workstream/worktree; no arbitrary refs. |
| Read / modify | filesystem.read/list/write/patch | Existing independently approved scope binds; exact SHA mutation; no cross-scope paths; no task ID supplied by caller. |
| Checkpoint | workspace.create_checkpoint | Snapshot, exact workspace and durable receipt. |
| Focused verification | verification.focused / mcp_hermetic_core | Exact staged five-file manifest, isolated execution and cleanup; no substitution for broader gates. |
| Full verification | verification.full | Identify separately authorized, isolation-compatible full-gate route; fail closed if unavailable. |
| Commit | git.commit | Positive real commit evidence, exact expectedHead, exact paths, provenance, clean candidate. |
| Complete workstream | workspace.end_workstream | Correct revision and terminal outcome, retain history. |
| Integration preparation | dev_workspace_integration_preflight | Existing server-owned candidate gate. Not currently represented in CAPABILITY_DEFINITIONS; design a typed managed route with no caller-selected branch/commit/command. |
| Integration validation | dev_workspace_validate_integration | Existing fixed materialization/validation gate. Not currently represented in CAPABILITY_DEFINITIONS; design typed managed route bound to exact candidate ID/revision. |
| Integration | git.integrate | Exact ready candidate, fresh heads/dependencies and protected integration guard. |
| Push | git.push | Exact clean main, canonical destination and existing independent high-risk checks; no force or alternative transport. Test against disposable fixture remote only. |
| Maintenance / deployment | windows.service.ensure_running / windows.powershell.run_approved | Existing independently approved service/script targets and host verification. Do not turn ordinary standing policy into elevation or approve scripts on behalf of operator. No live installation in CI. |

## Implementation order

1. First prove the existing independently gated lifecycle routes in disposable fixtures, including the precise rejection layer for missing authority or invalid context. Do not assume all lifecycle stages are task-grant blocked. Reuse the existing bootstrap, integration, push and maintenance tests, recording what they actually establish.
2. Close missing managed orchestration/provenance links for candidate preparation and validation only after reviewing the existing tool-specific gates; preserve their required arguments, durable reconciliation, failure/timeout semantics and confirmation boundaries. No new privilege in this step.
3. Connect the existing independent approved routes under a consistent authenticated engineering entry, where permitted. Only separately trusted authorization sources can approve future policy changes. Test expiry/revocation after admission and before dispatch, duplicate/restart, stale candidate, dirty-main conflict, and failed full verification.
4. Exercise a complete isolated disposable lifecycle: bootstrap, read/patch, checkpoint, actual tests, commit, end, preflight, validate, integrate, push to a disposable remote and independently approved fixed maintenance fixture. Separate simulated vs real side effects in receipts. Do not use a synthetic success result as live evidence.
5. Run full regression and record exact candidate SHA. Compare merged tree; separately confirm main regression and actual deployment only under existing authority. Keep #106 open until all applicable acceptance evidence is present.

## Explicit non-goals

No permission escalation, auto-issuance of grants, wildcard policy, deletion of existing authorization requirements, production data or dirty worktree cleanup, force-push, or approval emulation. A human-required platform/host action that has no independently approved automated route must be reported rather than silently circumvented.
