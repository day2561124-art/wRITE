# Phase 18C - Visual Library Import Simulation / Confirm Gate

## Purpose

Phase 18C consumes the Phase 18B intake preview and produces a read-only import
simulation plan. Each supported intake candidate receives a simulated copy
operation, proposed target path, proposed visual index record, duplicate handling
decision, warnings, and risk summary. Unsupported files remain visible as
rejected operations.

## Confirmation Gate

The default state is `locked_by_confirmation_gate`. The exact confirmation text
is:

```text
確認模擬視覺匯入
```

An exact match changes eligible operation decisions to
`simulated_import_ready`. It does not copy a file, append an index record, or
authorize an import.

Unknown categories remain blocked for manual category review. Duplicate
secondary candidates remain blocked for manual duplicate review. Missing source
files and unsafe target paths remain blocked regardless of confirmation.

## Safety Boundary

Phase 18C:

- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write files under `data/visual_db/assets`;
- does not modify `data/canon_db/active_engine.md` or Canon DB;
- does not create `canon_visual_lock`;
- does not write to Approval Queue or create approval items;
- does not add MCP tools, UI routes, or server routes;
- creates no output artifact.

All proposed visual index records use `created_at: null`, `status:
simulated_only`, and `source: visual_library_import_simulation`.

## CLI

```powershell
node .\scripts\visual-library-import-simulation-preview.mjs --json
node .\scripts\visual-library-import-simulation-preview.mjs --pretty
node .\scripts\visual-library-import-simulation-preview.mjs `
  --source-dir <path> `
  --confirm-text "確認模擬視覺匯入" `
  --pretty
```

The default missing intake directory produces an empty simulation with exit 0.

## Deferred Work

Phase 18D may add a pending import candidate or Approval Queue readiness preview.
Phase 18C does not create either one.
