# Metadata-only Workstream stale-CAS reconciliation

The existing trusted-host `scripts/reconcile-development-git-commit.mjs`
entry also accepts `resolution_kind: workstream_stale_before_write`.
Use --inspect before submitting the same JSON to --apply.

Supply operation_id, expected_terminal_hash, request_fingerprint_sha256,
original_request (only workstream_id, expected_revision and metadata),
transaction_id, raw transaction_sha256, raw registry_sha256,
observed_workstream_revision, and the reviewed source contract SHA-256
(UTF-8 source with CRLF normalized to LF), plus GPT decision fields.

Inspect derives every path from the owning repository. It verifies the exact
request against the admitted fingerprint, dead same-host producer/recovery
owners, no child or unrelated pending operations, one matching transaction
in the operation interval, a pre-write stale-CAS rollback without errors,
registry checksum/revision/update time, and the reviewed implementation.
Other update shapes, unknown source versions, changed bytes, competing
transactions and caller path/force options are rejected.

Apply uses the existing append-only pi_terminal_resolution pair. It preserves
the failed event, records no_effect_observed, deduplicates identical decisions
and never retries the original update. Every owning Journal reader must support
this proof kind before formal apply. This supplement grants no installation,
Integration, reader refresh, Parent lifecycle or degraded-override authority.
Do not point isolated apply at a formal store.

The existing degraded Gate inhibits new writers, while no unrelated active or
dangling operation is required before resolution admission and completion.
Physical evidence is inspected on both sides of admission. An interruption
can resume only the same resolution proof; a change remains blocked.

An installation/bootstrap dependency requires a separately admitted maintenance
procedure. Adding this proof kind does not bypass that dependency. Inspection
is observational and issues no formal admission receipt.
