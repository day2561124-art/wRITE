# Phase 18E - Visual Library Approval Queue Import Dry-Run / Guard Preview

## Purpose

Phase 18E consumes Phase 18D pending visual import readiness output and builds
read-only Approval Queue item payload previews and guard cards. A candidate may
reach `approval_queue_import_dry_run_ready` only when readiness, lineage, target
path, risk, empty-index baseline, no-write safety, and confirmation checks pass.

`approval_queue_import_dry_run_ready` is a dry-run result only. It is not
authorization to write Approval Queue storage, create an approval item, confirm
an import, copy an asset, or append the visual index.

## Guard Boundary

Every guard card has these capabilities disabled:

- write Approval Queue;
- create an approval item;
- confirm import;
- write the visual index;
- copy a visual asset;
- create `canon_visual_lock`.

Blocked Phase 18D readiness decisions remain blocked and preserve their reason.
Unsafe targets, incomplete lineage, non-empty visual index, and any no-write flag
violation are independently blocked by Phase 18E.

## Safety Boundary

Phase 18E:

- does not write Approval Queue storage or create approval items;
- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write visual assets;
- does not create `canon_visual_lock`;
- does not modify `active_engine.md`, Canon DB, or writing/proofing cards;
- does not add MCP tools, UI routes, server routes, or high-risk tools;
- creates no output artifact.

## CLI

```powershell
node .\scripts\visual-library-approval-queue-import-dry-run-preview.mjs --json
node .\scripts\visual-library-approval-queue-import-dry-run-preview.mjs --pretty
node .\scripts\visual-library-approval-queue-import-dry-run-preview.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pretty
```

A missing or empty default intake directory returns a successful empty dry-run
preview.

## Deferred Work

Phase 18F may add Approval Queue import guard UI readiness or a final acceptance
preview before any future controlled import. Phase 18E performs no real import.
