# Committed Workstream update reconciliation candidate

This independent candidate adds a trusted-host proof to the existing Journal
resolver. It does not deploy itself, change production routing, install readers,
grant a degraded override or replay the original Workstream update.

The supported shape is an exact `declared_scope`, `state: active`,
`expected_revision`, `workstream_id` update, with one immutable STARTED and one
`operation_recovered` / `ambiguous_effect` terminal linked back to that STARTED.
The original request fingerprint and a preceding genuine Pi tool-call claim
bind the request, context, key and producer identity.

Inspection requires dead same-host producer/recovery owners, no unrelated
pending Journal operation, the reviewed CAS/write implementations, full Pi
history validation, one committed registry transaction during the operation,
no competing registry writer, an unchanged checksum-verified registry snapshot,
and the committed audit-completion transaction. The audit manifest's byte range
must select the unique success record. Its original request summary and complete
response SHA-256 must match the exact reconstructed registry response. Merely
incrementing a revision or submitting matching caller hashes is insufficient.
The transaction format does not retain a durable before-image; the accepted
pre-write revision is established by the reviewed locked CAS and its committed
transaction, rather than a fabricated registry backup.

The host script `scripts/reconcile-development-git-commit.mjs` accepts
`resolution_kind: workstream_committed_update`. Proof fields are operation_id,
expected_terminal_hash, request_fingerprint_sha256, original_request,
transaction_id/transaction_sha256, audit_transaction_id/audit_transaction_sha256,
audit_line_sha256, registry_sha256, pi_claim_event_hash, decision_owner: GPT,
decision_id and reason. Unknown fields and arbitrary evidence paths are refused.
Use --inspect and review its result before submitting the same proof to --apply.

Apply reuses the existing append-only `pi_terminal_resolution` pair, deterministic
key, proof fingerprint, terminal association and deduplication. Physical evidence
and liveness are checked before and after admission. It records
`intended_effect_observed`; the original ambiguous terminal stays immutable.
Interrupted admissions resume only the same proof. A changed decision or changed
physical evidence is refused. A fresh reader revalidates the stored proof's
Journal/claim identity without requiring the registry to remain frozen forever.
Existing Pi `reconcile_only` can consume the resolved receipt without dispatch;
continuing pending source actions remains a separate GPT decision.

Deployment prerequisite: all owning readers must support the new proof kind.
The existing stale-resolution contract explicitly prohibits isolated apply into
a formal store and requires a separately admitted installation/bootstrap
procedure. This proof capability itself grants no installation authority. Ordinary
commit/integration gates still require healthy Journal. Do not publish the new
resolution while older parent/child readers remain active. A single child reload
does not update its parent or other readers. The separate maintenance admission
must bind explicit authorization, exact before/after reader hashes, quiescent
owner checks, graceful refresh and the actual deployment transaction. Inspect
success alone is not an admission receipt. Verify restoration from both a fresh
owning-module process and the reloaded MCP reader, compare the complete old event
prefix and terminal cardinality, then retain the normal full final gate and
controlled commit/integration/push process. A maintenance deployment never
substitutes for the exact-candidate publication gates.
