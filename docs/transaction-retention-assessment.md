# Transaction Retention Assessment

## Production inventory assessed

Phase 3A read and classified all 63,731 manifests present in `data/outputs/logs/transactions` on 2026-07-15. It did not delete, compact, or rewrite any production manifest.

| Classification | Count | Meaning |
|---|---:|---|
| `SESSION_LINKED_TRANSACTION` | 35,811 | Explicit run, bundle, writing-context-bundle, or trace metadata. |
| `GOVERNANCE_TRANSACTION` | 20,428 | Candidate, approval, settlement, adoption, activation, rollback, or cleanup operation. |
| `PROTECTED_PATH_TRANSACTION` | 1,139 | Affected a protected Canon, approval-log, or writing-workflow path without a stronger class above. |
| `ORDINARY_RUNTIME_TRANSACTION` | 5,400 | Structurally valid runtime transaction with no stronger reference class. |
| `FAILED_OR_ROLLED_BACK_TRANSACTION` | 953 | The transaction failed and the in-process rollback completed. |
| `UNKNOWN_TRANSACTION` | 0 | No unclassifiable manifest was found. |

The status distribution was 62,778 `committed` and 953 `rolled_back`. Frequent linkage metadata included `run_id` (28,736), `trace_id` (11,656), `bundle_id` (7,075), `approval_item_id` (6,092), `context_bundle_id` (321), and `writing_context_bundle_id` (315).

## Rollback capability

`rollback_available: true` is not a durable, cross-process rollback promise.

`commitFileTransaction` reads the previous bytes into memory, prepares replacement files, and restores those in-memory buffers only if the same function invocation fails before it returns. The persisted manifest records paths plus `previous_bytes` and `next_bytes`; it does not persist previous file content or a content-addressed backup. After process exit, the manifest alone cannot reconstruct the old bytes.

The correct interpretation is therefore option B: the transaction had in-process rollback semantics at commit time. A committed manifest does not provide long-term rollback. A `rolled_back` manifest records that the immediate rollback completed; it is audit evidence, not a reusable restore package.

## Session linkage quality

Transaction metadata is useful corroborating lineage, but it is not a hard session-retention pin by itself:

- neural trace and cognition-output manifests commonly carry run/trace/bundle IDs;
- GPT context manifests carry a bundle ID but older context-build transactions do not necessarily carry the later run ID;
- agent-run manifests carry the run ID but historically did not persist the GPT bundle ID in `run.json`;
- governance manifests carry candidate/approval/settlement IDs and affected paths;
- many audit manifests carry only tool/audit IDs.

Keeping every session merely because a transaction manifest mentions it would make cleanup impossible. Transaction references therefore remain assessment metadata. Hard retention comes from the live session, persisted lineage objects, governance state, Canon/rollback state, or immutable acceptance evidence.

## Recommended later strategy

Transaction compaction should remain a separate maintenance phase after session lifecycle operation has been observed in production. That phase should:

1. classify manifests with the categories above;
2. retain governance and protected-path transactions longest;
3. retain failed/rolled-back manifests as compact audit evidence, without claiming reusable rollback;
4. align session-linked manifest age with the owning session only when an explicit ID edge exists;
5. compact ordinary runtime manifests independently;
6. never wildcard-delete transaction manifests as a side effect of session cleanup;
7. preserve aggregate counts, transaction IDs, status, affected paths, metadata, and error summaries while omitting unavailable previous content.

No transaction compaction is implemented in Phase 3A.
