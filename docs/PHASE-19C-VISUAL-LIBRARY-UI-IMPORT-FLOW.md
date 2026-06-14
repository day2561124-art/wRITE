# Phase 19C - Visual Library UI Import Flow / Review Screen

## Purpose

Phase 19C integrates the Phase 18B through Phase 19B visual-library workflow
into a server-side UI review model. It supplies wizard steps, phase review
cards, operation cards, a safety panel, and an action bar suitable for a future
client screen without adding a public route or MCP tool.

The default UI flow is preview-only. It never imports, rolls back, deletes, or
restores automatically.

## Execution Boundary

Write operations require:

- an explicit operation;
- an `--execute` equivalent request;
- every operation-specific exact confirmation;
- a ready preflight state;
- an active-engine hash recheck;
- rollback or operation manifests where applicable.

Phase 19C delegates confirmed writes to the Phase 19A and Phase 19B cores.
Development execution uses temporary sandbox index, asset, trash, and restore
paths.

## Safety Boundary

Phase 19C does not:

- modify `active_engine.md`, Canon DB, or writing/proofing policy;
- write Approval Queue storage;
- create approval items;
- create `canon_visual_lock`;
- expose an MCP tool, UI route, or server route.

The formal visual index and asset directory are snapshotted around every UI
flow. Tests leave the formal visual library at its empty baseline.

## CLI

```powershell
node .\scripts\visual-library-ui-import-flow-preview.mjs --json
node .\scripts\visual-library-ui-import-flow-preview.mjs --pretty

node .\scripts\visual-library-ui-import-flow-preview.mjs `
  --source-dir <path> `
  --operation preview `
  --confirm-text "確認模擬視覺匯入" `
  --pre-write-confirm-text "確認進入視覺正式匯入準備" `
  --pretty
```
