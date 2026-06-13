# Phase 18B - Visual Library Rebuild Intake Preview

## Purpose

Phase 18A established an empty visual library baseline: the tracked visual index
contains zero records while the existing asset files remain untouched. Phase 18B
adds a read-only intake preview for reviewing files before any rebuild import.

The preview scans a source directory, records each supported image's extension,
size, and SHA-256, proposes a category, visual id, and target path, and reports
duplicate groups, warnings, and risk. Missing default intake directories produce
a successful empty preview.

## Safety Boundary

Phase 18B:

- does not write `data/visual_db/visual_index.jsonl`;
- does not copy, move, delete, or write files under `data/visual_db/assets`;
- does not modify `data/canon_db/active_engine.md` or any Canon DB content;
- does not create `canon_visual_lock`;
- does not write to Approval Queue or create approval items;
- does not add MCP tools, UI routes, or server routes;
- produces preview output only and creates no output artifact.

Unknown categories remain valid preview candidates with a warning and medium
risk. Files with unsupported extensions are reported as rejected instead of
causing the scan to fail. Files with identical SHA-256 values form a duplicate
group with one stable primary candidate and the remaining duplicate candidates.

## CLI

```powershell
node .\scripts\visual-library-rebuild-intake-preview.mjs
node .\scripts\visual-library-rebuild-intake-preview.mjs --json
node .\scripts\visual-library-rebuild-intake-preview.mjs --pretty
node .\scripts\visual-library-rebuild-intake-preview.mjs --source-dir <path> --pretty
```

`--json` emits compact JSON. `--pretty` emits formatted JSON. Neither mode writes
an artifact.

## Deferred Work

Phase 18C may add an import simulation and explicit confirmation gate. Phase 18B
does not authorize or perform an import.
