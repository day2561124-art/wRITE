# Phase 19H-Lite: Visual Library Persistent Import Operator Checklist

Phase 19H-Lite defines the operator checklist and readiness preview required
before a future persistent visual-library import changes the accepted formal
baseline from empty to non-empty.

This phase is preview-only. It does not execute an import, rollback, delete,
restore, baseline update, or any other write operation.

## Readiness Contract

The checklist is ready only when:

- `data/visual_db/visual_index.jsonl` has zero non-empty lines.
- `data/visual_db/assets` has zero image files.
- The active-engine LF-normalized SHA-256 matches the protected expected hash.
- The configuration preserves every no-write safety flag.

The preview reports source and baseline state, 15 required operator steps, four
future confirmation gates, pre-import checks, post-import checks, rollback
requirements, forbidden actions, and Phase 19H readiness.

## CLI

```powershell
node .\scripts\visual-library-persistent-import-operator-checklist-preview.mjs --pretty
```

Supported arguments are `--pretty`, `--json`, and `--help`.

Dangerous arguments such as `--execute`, `--confirm-text`, `--write`,
`--import`, `--rollback`, `--delete`, and `--restore` are rejected with
`blocked_forbidden_argument`.

## Safety Boundary

Phase 19H-Lite does not:

- Write the formal visual index or copy visual assets.
- Update the accepted visual-library baseline.
- Modify active engine, compressed rules, or Canon DB.
- Write Approval Queue or create an approval item.
- Create `canon_visual_lock`.
- Register an MCP tool or change the MCP tool count.

Persistent import execution and baseline transition remain deferred to a future
Phase 19H implementation with explicit confirmations and rollback protection.
