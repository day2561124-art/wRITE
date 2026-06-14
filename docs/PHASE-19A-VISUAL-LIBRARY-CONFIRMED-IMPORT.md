# Phase 19A - Confirmed Visual Import Core

## Purpose

Phase 19A is the first confirmed visual import core. It reruns the Phase 18G
pre-write guard and rechecks the active engine, visual index state, source
identity and hash, target safety, and target occupancy immediately before any
write.

Writing requires all three exact confirmation texts plus `--execute`:

- `確認模擬視覺匯入`
- `確認進入視覺正式匯入準備`
- `確認執行視覺正式匯入`

Without `--execute`, the CLI returns `blocked_missing_execute_flag` and performs
no writes.

## Write Boundary

Confirmed import writes are limited to:

- copying accepted source images into `data/visual_db/assets`;
- atomically rewriting `data/visual_db/visual_index.jsonl` with validated JSONL
  records.

Phase 19A does not:

- modify `active_engine.md` or Canon DB;
- modify writing or proofing policy;
- write Approval Queue storage;
- create approval items;
- create `canon_visual_lock`;
- expose an MCP tool, UI route, or server route.

## Atomicity And Rollback

Assets are copied through a temporary sibling file, hash checked, and renamed
into place. The visual index is written to a temporary sibling file and renamed
into place.

The returned rollback manifest records the original and resulting index hashes,
copied assets, added record ids, rollback actions, and rollback completion.
Asset-copy, index-write, or post-write validation failures restore the original
index and remove every asset copied by the operation.

## CLI

```powershell
node .\scripts\visual-library-confirmed-import.mjs --json
node .\scripts\visual-library-confirmed-import.mjs --pretty

node .\scripts\visual-library-confirmed-import.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pre-write-confirm-text "確認進入視覺正式匯入準備" `
  --real-import-confirm-text "確認執行視覺正式匯入" `
  --execute `
  --pretty
```

Development tests execute only against temporary sandbox index and asset paths.
After Phase 19A verification, the formal visual library remains at its empty
baseline.
