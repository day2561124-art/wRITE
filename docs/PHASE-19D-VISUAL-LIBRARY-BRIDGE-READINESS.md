# Phase 19D - ChatGPT / MCP Bridge Readiness for Visual Library

## Purpose

Phase 19D provides a safe bridge payload for ChatGPT and MCP integration with
the visual library. It reuses the Phase 19C UI review model and reports the
formal visual-index baseline, visual-assets baseline, active-engine hash,
pipeline summaries, blockers, warnings, required human checks, action
availability, and safety state.

This phase provides a tool manifest preview only. It does not register a new
MCP tool, so the MCP tool count is unchanged.

## Safety Boundary

The bridge is strictly read-only and preview-only. It:

- always invokes Phase 19C with `operation: "preview"`;
- never forwards execute or confirmation arguments;
- does not expose confirmed import execution;
- does not expose rollback, delete, or restore execution;
- does not write `visual_index.jsonl` or copy, move, or delete visual assets;
- does not modify `active_engine.md` or Canon DB;
- does not write Approval Queue storage;
- does not create approval items or `canon_visual_lock`.

The CLI treats `--execute` and all write confirmation arguments as forbidden
and returns `blocked_forbidden_execute_argument`.

## CLI

```powershell
node .\scripts\visual-library-bridge-readiness-preview.mjs --json
node .\scripts\visual-library-bridge-readiness-preview.mjs --pretty
node .\scripts\visual-library-bridge-readiness-preview.mjs --execute --json
```

After tests, the formal visual library remains at its empty baseline:
`visual_index.jsonl` has zero records and `data/visual_db/assets` has no image
files.
