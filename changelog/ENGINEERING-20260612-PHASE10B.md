# Phase 10B｜Compressed Rule Update Confirm

## Purpose

Phase 10B adds the approval-confirm execution path for compressed rule update proposals.

The workflow is:

feedback item
→ feedback digest
→ rule candidate
→ compressed rule update proposal
→ approval request
→ approval confirm
→ safe compressed_rules.md update

## Implemented

- Added compressed rule update confirm service.
- Added approval-confirm-only apply flow.
- Added append mode support after approval confirmation.
- Blocked pending approval apply.
- Blocked rejected approval apply.
- Blocked non-compressed_rule_update approval apply.
- Blocked proposal_id mismatch.
- Blocked current_target_sha256 mismatch.
- Blocked or deferred manual_review mode.
- Blocked or deferred replace_section mode.
- Created pre-apply backup artifact.
- Created application.json record after apply.
- Created diff_summary.md after apply.
- Created rollback.md metadata after apply.
- Added list/get application helpers.
- Added compressed rule update confirm service tests.
- Registered the new test in tests/run-all.mjs.

## Safety

- Proposal and request stages do not directly apply updates.
- Apply requires approval confirmation.
- Apply uses fixture workspace in tests.
- Formal repository data/error_report_db/compressed_rules.md must not retain test mutations.
- active_engine.md is not modified.
- writing card is not modified.
- proofing card is not modified.
- data/feedback_loop runtime artifacts are not committed.
- data/backups runtime artifacts are not committed.
- visual assets are not staged.

## Deferred

- MCP wrapper deferred.
- Creative task integration deferred.
- UI/API integration deferred.
- Restore/rollback execution deferred.

## External APIs

- No OpenAI API added.
- No external LLM API added.

## Verification

- npm.cmd test: All tests passed
- LASTEXITCODE: 0
- active_engine SHA256:
  D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB
