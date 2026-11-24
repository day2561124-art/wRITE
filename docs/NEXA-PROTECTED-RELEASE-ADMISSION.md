# Nexa protected release deployment

## Scope and incident

PR #101 was merged at `ac048f4a9a17f999296eadea1cd721f798841076` after six successful PR CI jobs. The live Windows runtime was still `7f9d4830210f05218cae92b9ae18f0f34fc08516`; its transaction health was degraded. The subsequent Pi host-maintenance preflight returned PERMISSION_DENIED. No formal deployment occurred.

The registered scoped administrator runner is intentionally not a general-purpose elevated shell. Its approved script capability requires operator-protected script bytes, an exact script ID/digest and a valid task grant. The new path must not weaken these rules or let a running Nexa version approve its own privileged replacement.

## Stage 1: independently authorized release admission

The pure `nexa-protected-release-admission.mjs` verifier accepts a canonical, bounded Ed25519-signed release ticket. The ticket binds the fixed repository and protected-stable channel, exact installed and proposed commits, independently reviewed artifact SHA-256 and byte length, CI run identity, a monotonically increasing reservation sequence, and a bounded validity window. No shell commands, arbitrary URLs, filesystem paths or extra keys are accepted.

The trusted key and current deployment state must be supplied only by an operator-protected host, not by MCP clients, a candidate release, repository-controlled code, or a caller-provided trust configuration. An independently controlled release issuer must verify CI for the exact release and artifact; a GitHub Actions result alone is not an approval or a signature. The signer cannot be accessible to an agent that can modify candidate code or workflows. The verifier is deliberately side-effect-free and returns `deployment_authorized: false`.

## Subsequent implementation and acceptance gates

1. Establish one-time operator-controlled bootstrap of the deployment controller, independent release trust key and task registration. Do not self-issue elevated grants. Preserve the existing dedicated standard dispatcher account and its ACLs. A repository commit alone cannot install or authorize this controller.
2. Establish a protected durable compare-and-swap reservation and single-owner lock. Validate the signed ticket, exact installed commit, expiration, anti-replay sequence and existing pending state before any effect. Consume a sequence on reservation, not only on success; retain interruption evidence, refuse conflicting requests and never replay an ambiguous cutover.
3. Stage the fixed approved artifact in a separate location. Validate bounded archive length and SHA-256, safe relative paths, absence of reparse points and duplicate/case-colliding entries, locked dependencies and protected ownership/DACLs. Reverify the actual immutable staged tree after installation. No privileged execution of downloaded or workspace-provided scripts. Preserve every old release.
4. Use an independent protected controller outside the MCP process being replaced. Quiesce dispatch, verify journal and active operations, verify exact scheduled task identity and listener owner, then switch the protected launcher atomically. Do not loosen permissions, delete maintenance locks or stop unrelated processes. A 45-second approved script runner may admit only bounded steps; long-running staging/cutover must be explicitly designed and durably supervised before deployment.
5. Verify startup, exact active commit, dispatcher identity, journal integrity, checkpoint and transaction health, Pi routing, and GM MCP functionality. If cutover fails, restore the previous verified pointer and restart the previous release only when journal compatibility is established; otherwise retain a fail-closed reconciliation state. Persist all outcome receipts outside the replaced runtime.
6. Test on isolated Windows fixtures with denied, corrupted, replayed, concurrent and interrupted requests before a protected installation. Verify the current deployed version and perform live acceptance separately. The Linux/Windows CI gate cannot substitute for host authorization or actual live acceptance.

No new high-risk capability, elevated script, signer, scheduler, launch pointer or Windows ACL is installed by stage 1. No production data is accessed or changed by the verifier. The present PR is a candidate and is not a completed autonomous deployment system.
