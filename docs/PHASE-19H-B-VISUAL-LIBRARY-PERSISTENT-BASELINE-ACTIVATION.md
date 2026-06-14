# Phase 19H-B: Visual Library Persistent Baseline Activation

Phase 19H-B activates the first persistent formal visual-library baseline from
the three reviewed character-sheet images in
`data/visual_db/intake/phase-19h-b-selected`.

The activation is guarded by an execute flag and four exact confirmation
texts. It verifies the empty `0/0` baseline, source hashes, safe unoccupied
targets, and protected-file state before writing.

On success:

- `data/visual_db/visual_index.jsonl` contains three formal records.
- `data/visual_db/assets/character_sheets` contains three matching images.
- A Phase 19B-compatible rollback manifest is written to
  `data/visual_db/phase-19h-b-rollback-manifest.json`.
- Active engine, Canon DB, compressed rules, and Approval Queue remain
  unchanged.
- MCP registration remains unchanged.

Any copy, index, manifest, or post-write validation failure restores the prior
visual index and removes copied assets.

## Activation CLI

```powershell
node .\scripts\visual-library-persistent-baseline-activation.mjs `
  --execute `
  --confirm-text "確認模擬視覺匯入" `
  --pre-write-confirm-text "確認進入視覺正式匯入準備" `
  --real-import-confirm-text "確認執行視覺正式匯入" `
  --transition-confirm-text "確認建立視覺圖庫非空正式基準" `
  --pretty
```
