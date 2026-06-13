# Phase 18F - Visual Library Final Acceptance Preview

## Purpose

Phase 18F connects the read-only Phase 18B through Phase 18E pipeline and
produces a consolidated final acceptance summary plus UI readiness card
previews. It verifies empty intake, confirmation gating, ready dry-run items,
manual category and duplicate blocks, unsafe targets, unsupported extensions,
lineage failures, and no-write safety failures.

`approval_queue_import_dry_run_ready` remains a dry-run result. It is not
authorization to write Approval Queue storage, create an approval item, confirm
an import, write the visual index, or copy an image.

## UI Readiness Boundary

Every Phase 18F UI readiness card disables:

- writing Approval Queue storage;
- creating approval items;
- confirming imports;
- writing `visual_index.jsonl`;
- copying visual assets;
- creating `canon_visual_lock`.

Allowed actions only display the final acceptance summary, proposed approval
payload, lineage, risk, guard, and no-write information. Phase 18F creates no UI
or server route.

## Safety Boundary

Phase 18F:

- does not write Approval Queue storage or create approval items;
- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write visual assets;
- does not create `canon_visual_lock`;
- does not modify Canon DB, `active_engine.md`, or writing/proofing cards;
- does not add MCP tools or high-risk tools;
- creates no output artifact.

The preview snapshots the visual index, visual asset tree, and active engine
before and after the pipeline. Any detected change fails final acceptance.

## CLI

```powershell
node .\scripts\visual-library-final-acceptance-preview.mjs --json
node .\scripts\visual-library-final-acceptance-preview.mjs --pretty
node .\scripts\visual-library-final-acceptance-preview.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pretty
```

A missing or empty source directory returns
`empty_final_acceptance_preview_passed` with exit code zero.

## Deferred Work

Phase 18G may add a controlled Approval Queue import guard UI or a
human-confirmed import tool. Such work must retain explicit confirmation and
write protections. Phase 18F performs no real import.
