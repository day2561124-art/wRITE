# Phase 19B - Visual Import Rollback / Delete / Restore Safety

## Purpose

Phase 19B provides the safety core for confirmed-import rollback, controlled
visual deletion, and controlled visual restoration.

Every operation requires `--execute` and its exact confirmation text. The
default CLI performs no write.

## Operations

- `rollback-import` reads a Phase 19A rollback manifest and removes only its
  listed visual ids and copied assets.
- `delete` atomically removes one active index record and moves its asset into
  the configured trash root. It returns a complete delete manifest.
- `restore` reads a completed delete manifest and atomically restores its
  original record and asset.

Assets are staged or moved before the index update. Index, asset, or
post-operation validation failures restore both sides to the original state.
The visual index is always updated through a sibling temporary file and rename.

## Safety Boundary

Phase 19B:

- writes only the selected visual index, assets, trash, restore staging, and
  optional operation manifest paths;
- does not modify `active_engine.md`, Canon DB, or writing/proofing policy;
- does not write Approval Queue storage or create approval items;
- does not create `canon_visual_lock`;
- does not expose an MCP tool, UI route, or server route.

Development execution uses temporary sandbox paths. The formal visual library
remains at its empty baseline after verification.

## CLI

```powershell
node .\scripts\visual-library-rollback-delete-restore.mjs --json
node .\scripts\visual-library-rollback-delete-restore.mjs --pretty

node .\scripts\visual-library-rollback-delete-restore.mjs `
  --operation delete `
  --visual-id <visual_id> `
  --confirm-text "確認執行視覺刪除" `
  --execute `
  --pretty
```
