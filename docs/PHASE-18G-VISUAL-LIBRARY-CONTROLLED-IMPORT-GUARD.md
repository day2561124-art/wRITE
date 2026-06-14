# Phase 18G - Visual Library Controlled Import Guard

## Purpose

Phase 18G is the pre-write final gate before any real visual library import.
It consumes the Phase 18F final acceptance preview, rechecks source identity,
source hashes, proposed targets, the empty visual index baseline, target
occupancy, category and duplicate decisions, lineage, and no-write safety.

`ready_for_phase_19a_confirmed_import` means only that the Phase 19A
prerequisites passed. It is not a real import and is not write authorization.

## Confirmation Gates

The preview requires two exact confirmations for an item to become ready:

- `確認模擬視覺匯入`
- `確認進入視覺正式匯入準備`

Missing or incorrect text leaves the corresponding gate locked.

## Safety Boundary

Phase 18G:

- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write visual assets;
- does not write Approval Queue storage;
- does not create approval items;
- does not create `canon_visual_lock`;
- does not modify Canon DB or `active_engine.md`;
- does not confirm a real import;
- creates no persistent runtime or output artifact;
- adds no MCP tool, UI route, or server route.

Every UI guard card keeps all write, copy, creation, lock, and real-import
confirmation capabilities disabled, including ready items.

## CLI

```powershell
node .\scripts\visual-library-controlled-import-guard-preview.mjs --json
node .\scripts\visual-library-controlled-import-guard-preview.mjs --pretty
node .\scripts\visual-library-controlled-import-guard-preview.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pre-write-confirm-text "確認進入視覺正式匯入準備" `
  --pretty
```

A missing or empty source directory returns
`empty_controlled_import_guard_preview_passed` with exit code zero.

## Deferred Work

Phase 19A may begin designing the real confirmed import core. It must create a
pre-write snapshot, recheck protected hashes and paths, require exact user
confirmation, write atomically, and provide a rollback manifest. It must not
create `canon_visual_lock` or modify Canon DB or `active_engine.md`.
