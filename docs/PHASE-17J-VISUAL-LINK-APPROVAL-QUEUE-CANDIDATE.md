# Phase 17J — Visual Link Approval Queue Candidate Preview

Purpose
- Produce a read-only, candidate-only preview of Approval Queue items derived from Phase 17I readiness items.
- Convert `ready_for_human_visual_link_review` readiness items into queue candidate previews suitable for human review, without writing or creating any approval artifacts.

Dependencies
- Depends on Phase 17H (Visual Asset Registry Preview) and Phase 17I (Visual Link Approval Readiness Preview).

Read-only boundaries
- This phase is strictly preview / dry-run / candidate-only.
- Does not write to Approval Queue, does not create approval items, does not modify `active_engine.md`, `visual_index.jsonl`, or Canon DB.
- All `*_write_allowed` flags are false; `can_write_approval_queue_now` is always false; `creates_approval_item` is always false; `creates_canon_visual_lock` is always false.

Queue candidate decision rules
- `queue_candidate_preview_ready`: readiness item is `ready_for_human_visual_link_review` and no forbidden status.
- `blocked_no_readiness_item`: no readiness items available from Phase 17I.
- `blocked_readiness_not_ready`: readiness item not marked ready.
- `blocked_forbidden_status`: input status explicitly forbidden (e.g. `canon_visual_lock`, `canon`, `official`, `canon_lock`, `active`, `finalized`, `patched`, `compiled`) or 17I flagged forbidden.
- `blocked_missing_selected_entity`: missing selected entity fields.
- Other blocked reasons for write attempts or unknown reasons are enumerated but not used in preview.

Approval queue payload preview
- Each queue candidate includes an `approval_queue_payload_preview` object with fields:
  - `type: "visual_link_approval"`
  - `phase: "17J"`
  - `visual_asset_id`, `asset_kind`, `display_name`, `file_path`
  - `selected_entity_id`, `selected_entity_kind`, `selected_entity_display_name`
  - `link_confidence`, `requested_action: "review_visual_link_candidate"`
  - `writes_approval_queue: false`, `creates_approval_item: false`, `canon_write_allowed: false`, `creates_canon_visual_lock: false`

Determinism
- `queue_candidate_id` is deterministic and derived from a stable hash of `readiness_id|visual_asset_id|selected_entity_id`.
- Duplicate readiness items or repeated identical candidate definitions are deduplicated.

CLI examples
- `node .\scripts\visual-link-approval-queue-candidate-preview.mjs --json`
- `node .\scripts\visual-link-approval-queue-candidate-preview.mjs --text "character_visual: 朝日奈千夜 | file: images/chiyo.png" --json`

Testing & Verification
- A test harness runs the service in read-only mode and verifies the expected candidate decisions, selected entity fields, and that no write flags are enabled.
