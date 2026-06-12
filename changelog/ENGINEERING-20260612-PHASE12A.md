# Phase 12A: Docs & Daily Scripts

## Purpose

- Add daily workflow, safety, backup/restore, troubleshooting, and phase-map documentation.
- Add safe PowerShell helpers for status, health checks, pre-commit checks, runtime backup
  cleanup, and active engine hash verification.

## Safety

- Scripts do not stage, commit, tag, approve, activate, restore, or delete visual assets.
- `clean-runtime-backups.ps1` is dry-run by default and requires `-ConfirmClean`.
- Cleanup is allowlisted to the three Phase 11A runtime backup directories.
- `pre-commit-check.ps1` rejects staged backups, outputs, visual assets, and active engine.
- Phase 11A restore remains preview-only / approval-only; Phase 11B is not implemented.
- Phase 10A is explicitly marked undefined and unimplemented.

## Files

- Added five documents under `docs/`.
- Added five PowerShell scripts and `scripts/README.md`.
- Added `tests/scripts/daily-scripts.test.mjs`.
- Registered the new test in `tests/run-all.mjs`.

## Unchanged Boundaries

- No OpenAI API or external LLM API was added.
- `data/canon_db/active_engine.md` was not modified.
- `data/outputs/`, `data/backups/`, and visual assets were not modified or staged.

## Verification

- `npm.cmd test`: all tests passed
- Final `$LASTEXITCODE`: `0`
- `Get-FileHash .\data\canon_db\active_engine.md -Algorithm SHA256`
  returned `D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB`
- `git status --short`
- `git status --short --untracked-files=no`
- `git diff --stat`
