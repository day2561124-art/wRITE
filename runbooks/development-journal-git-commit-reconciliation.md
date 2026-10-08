# Development Journal Git commit reconciliation

Use the trusted-host maintenance entry when an interrupted `dev_git_commit`
has an immutable ambiguous terminal and normal Pi admission is blocked. GPT
owns the decision; the resolver records verified execution facts. This entry
does not schedule Pi work or grant commit, integration, push or cutover authority.

Supply JSON on stdin to `node scripts/reconcile-development-git-commit.mjs
--inspect`. Review the evidence and then submit the **same JSON** with `--apply`.
PowerShell can pipe `Get-Content -Raw -LiteralPath <proof.json>` to Node.

The proof requires `resolution_kind: completed_git_commit`, `operation_id`,
`expected_terminal_hash`, the original `request_fingerprint_sha256` (including
null), `observed_commit`, `precommit_manifest`, `decision_owner: GPT`, a unique
`gpt-...` decision ID, and a reason. The manifest contains sorted entries with
`path`, `state`, `sha256`, `bytes`, and `artifact_type`. Its canonical
`{head: before_head, manifest}` SHA-256 must match the original admission.
The fingerprint cache may supply the manifest, but its contents are trusted
only after this hash check and physical verification.

The resolver requires dead same-host producer/recovery owners, no unrelated
pending Journal operations, a matching registered workspace, a clean current
HEAD, the exact single commit parent and changed paths, an adjacent HEAD reflog
commit transition within the operation interval, and file bytes matching the
admitted snapshot. Missing, partial or conflicting evidence stays degraded.
No commit retry is performed. Renames, deletions, subsequent HEAD movement,
missing reflog and unrelated precommit overlays need a separate reviewed proof;
this entry deliberately refuses them.

Apply appends one existing `pi_terminal_resolution` started/completed pair and a
commit provenance link. Original terminal/events remain immutable. Identical
decisions deduplicate; changed decisions are rejected. An interruption after
resolution admission can resume using the same proof, provided the physical
evidence still matches. Preserve the implementation for fresh readers of this
new proof kind.

Before refreshing an MCP process, verify other workstreams' durable checkpoints,
owner liveness and receipts, with Journal active/dangling zero. Child reload only
refreshes that child's module cache. A parent or another long-lived reader that
previously loaded the old Journal module also needs its own safe refresh before
reading the new resolution kind. Do not change the production route to perform
maintenance.

Verify from a fresh process and the active MCP connection:
`healthy`, `chain_verified=true`, `reconciliation_required=false`, active 0,
dangling 0. Compare the entire old event prefix byte digest, registry digest,
workspace HEAD/status and unrelated dirty-file hashes against the saved baseline.
