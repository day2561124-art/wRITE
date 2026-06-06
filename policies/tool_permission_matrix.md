# Tool Permission Matrix（工具權限矩陣）

本節整理 MCP / API 工具權限矩陣與合約測試要求，節錄自 SKILL.md 中的相關段落。

## 權限矩陣字段

每個工具應包含：

- `tool_name`
- `permission_level`（read_only / write_low_risk / write_medium_risk / write_high_risk / destructive）
- `read_or_write`
- `risk_level`
- `requires_user_confirmation`
- `requires_backup_before_write`
- `allowed_sources`
- `forbidden_sources`
- `can_modify_canon`
- `can_modify_active_engine`
- `can_modify_story_graph`
- `can_modify_memory`
- `can_commit_error_report`
- `log_required`

## 權限等級說明

1. `read_only`：僅讀取（例：`get_active_engine`）。
2. `write_low_risk`：可寫入草稿/候選（例：`save_draft`）。
3. `write_medium_risk`：可寫入長期輔助資料，需 trace（例：`commit_error_report`，P0/P1/P2 需人工確認）。
4. `write_high_risk`：可能影響正式資料，需人工確認與備份（例：`activate_writing_card_version`、`approve_settlement`、`activate_engine_version`）。
5. `destructive`：覆蓋或刪除重要資料，禁止自動執行（例：`overwrite_active_engine`、`purge_memory`）。

## 工具審計與合約測試

- 每個寫入工具都應記錄：`tool_name, called_at, actor, input_summary, affected_paths, previous_version, new_version, confirmation_id, result`。
- 每個 MCP tool 必須具備 input schema、output schema、permission scope、錯誤碼與測試案例，並通過 contract tests（見 tests/tools/ 目錄）。

## 範例工具權限清單（摘要）

- `get_active_engine`: `read_only`，不得修改 Canon。
- `save_draft`: `write_low_risk`，不得修改 Canon。
- `commit_error_report`: `write_medium_risk`，P0/P1/P2 需人工確認。
- `approve_settlement` / `activate_engine_version`: `write_high_risk`，需備份並人工確認。
- `overwrite_active_engine`: `destructive`，原則禁止自動使用。

---

將本文件放入 CI 驗證範疇（tools contract tests），並在工具註冊時要求提供完整的權限宣告 JSON。