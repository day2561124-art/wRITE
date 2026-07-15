# External Brain Session Retirement and Historical Reconciliation

## State separation

`run.status` remains the execution result (`running`, `success`, `warning`, or `failed`).
`session_lifecycle_status` records the external-brain session lifecycle (`ACTIVE`, `COMPLETED`, `ABANDONED`, `FAILED`, or `BLOCKED`). The fields intentionally do not form two competing execution state machines.

New ChatGPT-owned sessions begin as `ACTIVE`. Persisted neural capability execution and successful raw-story sealing update `last_activity_at`. A successful final-polisher trace completes both the execution and the session lifecycle. A blocked or failed final-polisher does not imply completion.

## Stale activity

The production distribution at Phase 3B entry was 13 sessions below one day of inactivity, 22 from one to two days, and 43 from two to seven days; the oldest was about 3.96 days. The default `stale_active_session_days` is therefore two days. This protects normal same-day and next-day continuation while surfacing stopped multi-day sessions for review.

Liveness is computed from explicit persisted activity timestamps on runs, traces, neural outputs, and transaction metadata. The run-file mtime is reported as a diagnostic-only field; it never changes classification, reconciliation, retirement, or cleanup eligibility.

`STALE_ACTIVE_SESSION` is never directly cleanup-eligible. It requires explicit retirement. Governance and immutable acceptance evidence remain higher-priority hard pins.

## Explicit retirement

Retirement is a metadata-only operator action. It live-re-evaluates the lineage and rejects sessions with governance or acceptance-evidence pins. A successful retirement sets `session_lifecycle_status: ABANDONED`, `retired_at`, `retired_by`, and `retirement_reason`; it does not mark the run successful, fabricate final-polisher completion, create workflow records, or delete cognition data.

Abandoned sessions use a 30-day retention window. Reference authority wins first, lifecycle state second, and age third.

## Deterministic historical recovery

Historical run-to-bundle recovery accepts only explicit persisted evidence. Transaction evidence is valid only when one manifest metadata object contains both a schema-valid run ID and a schema-valid GPT writing-context bundle ID. Separate manifests, same-second timestamps, mtimes, directory order, and process proximity never form an edge.

Backfill requires one unique deterministic bundle. Conflicting candidates remain incomplete. The audit records the evidence source, IDs, before/after run metadata hashes, timestamp, and actor without context prose.

## Completion reconciliation

A running session may be reconciled to completed only when one exact successful `final_polisher` trace matches the run ID and the session's unique explicit bundle ID. Stale inactivity alone produces `RETIRE_RECOMMENDED`; it never causes automatic retirement.
