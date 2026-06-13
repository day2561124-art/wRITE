# Phase 17L - Visual Link Approval Queue Import Guard / UI Readiness Preview

## Purpose

Phase 17L consumes Phase 17K import dry-run items and prepares a deterministic
guard result plus a UI-ready review card. It is a read-only,
UI-readiness-preview-only phase. It does not import anything.

## Dependencies

- Phase 17H: Visual Asset Registry Preview
- Phase 17I: Visual Link Approval Readiness Preview
- Phase 17J: Visual Link Approval Queue Candidate Preview
- Phase 17K: Visual Link Approval Queue Import Dry Run

## Read-only boundaries

Phase 17L:

- does not write to Approval Queue;
- does not create approval items;
- does not create `canon_visual_lock`;
- does not modify `active_engine.md`;
- does not modify `visual_index.jsonl`;
- does not create a UI route or server route;
- does not expose a public MCP tool.

Every guard item keeps `can_import_now`, `can_write_approval_queue_now`,
`writes_approval_queue`, `creates_approval_item`, and all Canon write flags set
to `false`.

## Guard decisions

- `ui_guard_ready`: the Phase 17K item is complete and safe to render for
  manual review preview.
- `blocked_no_import_dry_run_item`: no Phase 17K items were produced.
- `blocked_import_dry_run_not_ready`: the source item is not
  `import_dry_run_ready`.
- `blocked_missing_payload_preview`: the approval payload preview is absent.
- `blocked_missing_lineage`: required 17H/17I/17J/17K lineage or evidence is
  incomplete.
- `blocked_missing_risk_summary`: the source risk summary is absent.
- `blocked_missing_confirmation_guard`: the mandatory human confirmation guard
  is absent or invalid.
- `blocked_forbidden_write_intent`: a source item or payload requests a write.
- `blocked_forbidden_status`: a canonical, active, finalized, patched, or
  compiled status is present.
- `blocked_missing_selected_entity`: no selected entity is available.
- `blocked_unknown_reason`: no recognized decision could be produced.

`canon_link_candidate` may produce `ui_guard_ready`, but only as a preview.
`canon_visual_lock` is always blocked and its risk summary is elevated to
`high` with `forbidden_status` listed as a blocking risk.

## UI readiness card

Each guard item includes `ui_readiness_card` with:

- visual asset and selected entity sections;
- lineage, risk, and confirmation guard sections;
- a no-write safety section;
- a preview-only status label and badges;
- blocking reasons when the guard is not ready.

Disabled actions:

- `write_approval_queue`
- `create_approval_item`
- `create_canon_visual_lock`
- `update_active_engine`
- `update_visual_index`

Allowed preview actions:

- `render_ui_readiness_card`
- `copy_payload_preview`
- `copy_lineage_summary`

## CLI

```powershell
node .\scripts\visual-link-approval-queue-import-guard-preview.mjs --json
node .\scripts\visual-link-approval-queue-import-guard-preview.mjs
node .\scripts\visual-link-approval-queue-import-guard-preview.mjs --text "character_visual: 朝日奈千夜 | file: images/chiyo.png" --json
node .\scripts\visual-link-approval-queue-import-guard-preview.mjs --source-path .\path\to\metadata.txt --json
```

The CLI writes only to stdout. It does not create output artifacts or temporary
preview JSON files.

## Verification

```powershell
node --check .\server\src\visual-link-approval-queue-import-guard-service.mjs
node .\tests\engine\visual-link-approval-queue-import-guard-service.test.mjs
npm.cmd test
```

The service test verifies deterministic IDs, all guard branches, UI card shape,
CLI JSON output, duplicate suppression, and unchanged engine and visual index
hashes.
