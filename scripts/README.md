# Daily PowerShell Scripts

所有腳本都以 repository root 為工作目錄，不會自動 stage、commit、tag、approve、
activate 或 restore。

| Script | 用途 |
| --- | --- |
| `safe-status.ps1` | 顯示完整/僅 tracked 狀態、diff stat 與 active engine hash |
| `daily-health-check.ps1` | 顯示近期版本資訊、執行完整測試與 hash 檢查 |
| `pre-commit-check.ps1` | 執行完整測試並拒絕 forbidden staged paths |
| `clean-runtime-backups.ps1` | 預覽或明確確認後清理三個 backup runtime 目錄 |
| `show-active-engine-hash.ps1` | 比對 active engine SHA256 基線 |

`clean-runtime-backups.ps1` 預設是 dry-run。只有明確加入 `-ConfirmClean` 才會刪除
`project_backups/`、`exports/` 與 `restore_previews/` 中的 runtime 項目。

腳本不會清理 Canon、outputs 或 visual assets。
