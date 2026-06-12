# ENGINEERING 2026-06-12 - PHASE 13D-LITE

## Purpose

Repair visual gallery thumbnails and provide a safe metadata recovery workflow.

## Changes

- Added `GET /api/visual-db/asset?path=...` for read-only PNG, JPEG, and WEBP serving.
- Restricted asset reads to `data/visual_db/assets/` with traversal and type checks.
- Updated gallery cards to use encoded API URLs with failure-only placeholders.
- Added title, character, category, tags, filename, and metadata status presentation.
- Added `metadata_source` values for fallback, manual mapping, and recovered metadata.
- Updated reindex fallback titles to omit extensions while preserving existing metadata.
- Added `scripts/update-visual-metadata.mjs` for validated JSON mapping updates.
- Added reindex, metadata mapping, endpoint, content type, and traversal tests.

## Recovery Result

Tracked Git history and repository logs did not contain the original metadata for
the 64 reindexed images. No names were inferred. All 64 records remain explicit
fallback records until updated through a user-supplied metadata mapping.

## Safety

- Image files remain ignored and are not committed.
- The metadata script changes only `visual_index.jsonl`.
- No changes to `active_engine`, `compressed_rules`, writing policy, proofing policy,
  or longline data.
- No restore, rollback, approval confirmation, external model, or image recognition
  capability was added.
