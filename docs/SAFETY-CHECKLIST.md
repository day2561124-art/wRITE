# Safety Checklist

## Phase 13C-Lite Operator UX

- [ ] 「今日下一步」與流程進度只讀取既有 workflow state。
- [ ] 中文 badge 同時顯示文字，不只依賴顏色。
- [ ] Hash、run ID、trace ID 與 raw state 預設收在 details。
- [ ] Visual diagnostics 只讀取 index、PNG 數量與 `.gitignore`。
- [ ] PNG assets 仍由 Git ignore，沒有 stage `data/visual_db/assets/`。
- [ ] 沒有新增 apply、approval confirm、restore execution 或 rollback execution。
- [ ] 沒有修改 `active_engine`、`compressed_rules`、正式寫作卡、驗稿卡或長線。
- [ ] 讀取 UI state 沒有建立 `data/backups/`、`data/feedback_loop/` 或
  `data/outputs/current_prompt.md`。

## Phase 13A-Lite Feedback Learning UI

- [ ] Feedback Learning UI/API remains read-only.
- [ ] No apply, rollback, restore, approve, or `compressed_rules` editor was added.
- [ ] Pending `compressed_rule_update` approvals are handled in Approval Queue.
- [ ] Reading status did not modify `active_engine`, `compressed_rules`, writing
  card, or proofing card.
- [ ] Reading status did not create `data/feedback_loop` or `data/backups` artifacts.
- [ ] MCP wrapper and creative task integration remain deferred.

## Active Engine

- [ ] 執行 `.\scripts\show-active-engine-hash.ps1`。
- [ ] SHA256 應為
  `D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB`。
- [ ] 若 hash 不符，先調查原因，不要直接覆寫或還原。

## Git 狀態

- [ ] 檢查 tracked 與完整 status。
- [ ] 辨識未追蹤 visual assets，但不要自動 stage。
- [ ] 不使用 `git add .`。
- [ ] Commit 前執行 `.\scripts\pre-commit-check.ps1`。

## Runtime 資料

- [ ] `data/backups/` 是 runtime backup/export/preview 資料。
- [ ] `data/feedback_loop/` 是 feedback learning runtime artifact。
- [ ] `data/outputs/` 是 runtime output。
- [ ] 不刪除 `data/visual_db/assets/`。
- [ ] 清理 backup runtime 前先使用 dry-run。

## Approval

- [ ] Writing adoption、engine activation 與 rollback 都由 approval queue 確認。
- [ ] Compressed rule proposal 在 Phase 10A 只建立 approval request，不會套用。
- [ ] Restore request 只建立 approval item，不代表 restore 已執行。
- [ ] Phase 11A 不提供 direct restore execution。

## Feedback Learning

- [ ] Feedback item、digest、rule candidate 與 proposal 都是 runtime artifact。
- [ ] `data/error_report_db/compressed_rules.md` hash 未改變。
- [ ] Rule candidate 標記為 `not_applied`。
- [ ] Context bundle 只提供 context，不會修改 active engine 或 compressed rules。

## 驗稿風險

- [ ] P0/P1 必須停下並取得明確核准。
- [ ] P2 必須修正或留下可追蹤決策。
- [ ] P3/P4 不得被誤當成已完成 Canon 審查。

## 提交前

- [ ] 完整測試通過且 `$LASTEXITCODE` 為 `0`。
- [ ] Staged stat 僅包含本次預期檔案。
- [ ] 沒有 staged backups、outputs、visual assets 或 active engine。
- [ ] Commit 與 tag 由使用者明確執行。
