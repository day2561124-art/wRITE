# Phase 18D - Visual Library Pending Import Candidate / Approval Readiness

## Purpose

Phase 18D consumes the Phase 18C import simulation plan and creates read-only
pending visual import candidate previews and approval readiness cards.
`simulated_import_ready` operations with complete lineage, safe targets, valid
categories, and an empty visual index become
`ready_for_human_visual_import_review`.

This decision means the payload is ready to be inspected by a person. It does
not mean that the import can be confirmed or submitted.

## Blocking Decisions

The readiness preview preserves or derives explicit blocking decisions for:

- confirmation gate not accepted;
- unknown category;
- duplicate secondary candidate;
- unsafe target path;
- missing source file;
- unsupported extension;
- incomplete lineage;
- non-empty visual index while append behavior is unsupported.

## Safety Boundary

Phase 18D:

- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write visual assets;
- does not write Approval Queue storage or create an approval item;
- does not create `canon_visual_lock`;
- does not modify `active_engine.md`, Canon DB, or writing/proofing cards;
- does not add MCP tools, UI routes, server routes, or high-risk tools;
- creates no output artifact.

Every readiness card has `can_submit_to_approval_queue: false` and
`can_confirm_import: false`.

## CLI

```powershell
node .\scripts\visual-library-pending-import-readiness-preview.mjs --json
node .\scripts\visual-library-pending-import-readiness-preview.mjs --pretty
node .\scripts\visual-library-pending-import-readiness-preview.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pretty
```

A missing or empty default intake directory returns a successful empty readiness
preview.

## Deferred Work

Phase 18E may add an Approval Queue import dry-run or guard preview. Phase 18D
does not write or submit anything to Approval Queue.
