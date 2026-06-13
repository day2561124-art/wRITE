# Phase 17K — Visual Link Approval Queue Import Dry Run

Purpose
- Validate import-readiness for queue candidates produced by Phase 17J without performing any writes.
- Ensure each candidate has a complete approval payload preview, lineage, risk summary, confirmation guard, and obeys no-write safety contracts.

Dependencies
- Depends on Phase 17H / 17I / 17J.

Read-only boundaries
- This phase is strictly dry-run and will not write to Approval Queue, create approval items, modify `active_engine.md` or `visual_index.jsonl`, or create `canon_visual_lock`.

Decision rules
- `import_dry_run_ready`: queue candidate ready for import dry-run (preview only).
- `blocked_no_queue_candidate`: no queue candidates available.
- `blocked_queue_candidate_not_ready`: queue candidate not marked ready.
- `blocked_missing_payload_preview`: missing `approval_queue_payload_preview`.
- `blocked_missing_lineage`: missing essential lineage fields.
- `blocked_missing_confirmation_guard`: confirmation guard missing or invalid.
- `blocked_forbidden_status`: forbidden statuses block import.

Lineage, risk, confirmation guard
- Each import item includes deterministic `import_dry_run_id`, `lineage` (17H/17I/17J ids, evidence_hashes), `risk_summary`, and `confirmation_guard` (`確認送審`).

CLI examples
- `node .\scripts\visual-link-approval-queue-import-dry-run.mjs --json`
- `node .\scripts\visual-link-approval-queue-import-dry-run.mjs --text "character_visual: 朝日奈千夜 | file: images/chiyo.png" --json`

Testing & Verification
- Tests verify decisions, lineage completeness, confirmation guard presence, and that no write flags are enabled.
