# Phase 17I — Visual Link Approval Readiness Preview

目的
- 提供「Visual Link Approval Readiness Preview」，讀取 Phase 17H 的 visual asset registry preview 結果，對每個 visual asset 的 `linked_entity_candidate` 判斷是否具備送人工確認（human visual link review）的條件，並產生 deterministic 的 readiness items（只作為人類審查準備的報告）。

邊界與安全原則（Read-only / Dry-run）
- 本階段僅產生預覽（read-only、dry-run、candidate-readiness-only）。
- 嚴格禁止：寫入 Approval Queue、建立 approval item、建立 canon_visual_lock、寫入 Canon DB、修改 `active_engine.md`、修改 `data/visual_db/visual_index.jsonl`、產生 outputs artifact 或提交 runtime logs。
- 禁止任何 commit / tag / push / git add 操作。

不可做的行為（一覽）
- 不建立正式 visual link。  
- 不建立正式 visual card（角色/武裝/地點）。  
- 不寫入或修改任何 Canon DB 或 active_engine 內容。  
- 不寫入 Approval Queue 或建立 pending approval item。  

Decision 狀態（readiness decisions）
- `ready_for_human_visual_link_review`：候選唯一且具備 entity_id、entity_kind、entity_display_name，且為 candidate-only（requires_human_confirmation = true、canon_write_allowed = false、creates_canon_visual_lock = false）。
- `needs_more_visual_metadata`：候選缺少必要欄位（例如缺 entity_kind、entity_display_name）或需要更多證據。  
- `blocked_forbidden_status`：來源標記或狀態屬於禁止建立正式連結（例如 canon_visual_lock、canon、official、active、finalized、patched、compiled 等）。  
- `blocked_missing_entity_link`：visual asset 沒有任何 linked_entity_candidates。  
- `blocked_ambiguous_entity_link`：有多個候選且無法決定唯一最佳候選（例如最高信心值並列）。
- `blocked_no_visual_asset`：輸入或來源沒有可用 visual asset（例如 visual_index 未提供 explicit visual_asset metadata）。
- `blocked_canon_write_attempt` / `blocked_visual_index_write_attempt` / `blocked_unknown_reason`：其他錯誤或阻塞理由。

Readiness item 欄位（至少包含）
- `readiness_id`（deterministic）：由 `visual_asset_id + selected_entity_id + decision` 或相似 seed 產生的穩定 ID。  
- `visual_asset_id`, `asset_kind`, `display_name`, `file_path`, `status`。  
- `linked_entity_candidate_count`、`selected_entity_candidate_id` 或 `null`、`selected_entity_id` / `selected_entity_kind` / `selected_entity_display_name` / `link_confidence`（或 0）。  
- `decision`、`can_create_approval_item_now: false`、`requires_human_confirmation: true`、`canon_write_allowed: false`、`approval_queue_write_allowed: false`、`updates_canon_db: false`、`updates_active_engine: false`、`updates_visual_index: false`、`creates_canon_visual_lock: false`。  
- `missing_fields: []`、`warnings: []`、`blocking_warnings: []`、`sources: []`。

核心規則摘要
1. 若 `visual_asset_count === 0`，`summary_decision` 為 `blocked_no_visual_asset`，`readiness_items` 為空。  
2. 若 visual asset 無任何 linked candidates，決策為 `blocked_missing_entity_link`，`missing_fields` 包含 `linked_entity_candidate`。  
3. 若有多個候選且無唯一最佳候選（例如最高信心值並列），決策為 `blocked_ambiguous_entity_link`。  
4. 若有唯一候選且其 `entity_id`、`entity_kind`、`entity_display_name` 完整，且為 candidate-only（`requires_human_confirmation === true` 且 `canon_write_allowed === false`），決策為 `ready_for_human_visual_link_review`（但仍為 preview，不會產生 approval item 或變更）。  
5. 若來源顯式標記 forbidden 狀態（如 `canon_visual_lock`），即便 Phase 17H 可能已降級該狀態，仍視為 `blocked_forbidden_status`。  
6. `status = canon_link_candidate` 可為 `ready_for_human_visual_link_review`（仍為候選）。  
7. `rejected` / `superseded` 等狀態預設不自動 override，除非有 explicit override marker（本階段不處理 override）。

CLI 範例
- 以預設（從 `visual_index` 經 Phase 17H 預覽）並列印 summary：
  node .\\scripts\\visual-link-approval-readiness-preview.mjs
- 以 JSON 格式輸出：
  node .\\scripts\\visual-link-approval-readiness-preview.mjs --json
- 以文字標記產生單一 preview（character）：
  node .\\scripts\\visual-link-approval-readiness-preview.mjs --text "character_visual: 朝日奈千夜 | file: images/chiyo.png"
- 其他：`--text` 可提供多行標記；`--source-path <path>` 可讀取文字檔。

測試與驗證要點
- Config schema 與 read-only 標記必須正確（`canon_write_allowed: false`、`approval_queue_write_allowed: false` 等）。
- `active_engine` 的 LF-normalized SHA-256 必須與預期值匹配（防止非預期 engine 變更）。
- `visual_index` 不應被修改（git diff 必須為空）。
- 當 `visual_index` 無 explicit assets 時，`readiness_items` 為空且 `summary_decision = blocked_no_visual_asset`。
- 以 explicit markers 驗證 character / weapon / location 範例會產生 `ready_for_human_visual_link_review`（但仍為 candidate-only）。
- `canon_link_candidate` 可被標示為 ready（但不會建立 approval item）；`canon_visual_lock` 必須被判定為 blocked。  
- 普通句子或單獨 file path 不應觸發 readiness item。  
- duplicate visual_asset_id / duplicate visual-entity pair 必須合併，避免重複 readiness item。  
- CLI `--json` 必須可被 `JSON.parse`。  

相依關係
- 依賴 Phase 17H（`visual-asset-registry-preview`）輸出；請先產生 Phase 17H preview 再執行本階段。

嚴格限制重申
- 不 commit、tag、push、git add。  
- 不修改 `data/canon_db/active_engine.md`。  
- 不修改 `data/visual_db/visual_index.jsonl`。  
- 不修改 writing card / proofing card。  
- 不產生 outputs artifact。  
- 不提交 runtime logs。

文件參考
- config/visual-link-approval-readiness.json（此階段的 config）
- server/src/visual-link-approval-readiness-service.mjs（實作 service）
- scripts/visual-link-approval-readiness-preview.mjs（CLI）
- tests/engine/visual-link-approval-readiness-service.test.mjs（測試）
