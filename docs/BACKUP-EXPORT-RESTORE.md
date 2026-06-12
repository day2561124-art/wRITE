# Backup, Export, And Restore

## Runtime 位置

```text
data/backups/project_backups/
data/backups/exports/
data/backups/restore_previews/
```

這些 Phase 11A runtime 資料不應納入一般 commit。

## Project Backup

`createProjectBackup()` 會建立 `backup.json`、`manifest.json`、`README.md` 與
`files/`。Manifest 保存相對路徑、大小與 SHA256。

Visual assets 預設不包含；只有明確設定 `includeVisualAssets: true` 才會包含
`data/visual_db`。

## Verify 與 Export

`verifyProjectBackup(backupId)` 重新計算 backup files 的 SHA256，不修改來源。

`createExportBundle({ export_type: "active_engine" })` 只複製 active engine 到
export bundle，不會啟用或修改它。

## Restore Preview

`previewRestoreFromBackup(backupId)` 是 preview-only。它只比較 backup 與目前
檔案，並建立 `preview.json` 與 `diff_summary.md`，不會寫回來源。

## Restore Request

`requestRestoreFromBackup(backupId)` 是 approval-only，只建立 high-risk approval
item，要求 second confirmation，並標記 `direct_restore_allowed: false`。

Phase 11A 不執行 restore。Phase 11B 尚未實作；不得把 approval request 描述成
已完成 restore，也不得手動複製 backup files 覆蓋 Canon 或 outputs。

## Runtime 清理

先預覽：

```powershell
.\scripts\clean-runtime-backups.ps1
```

明確確認後才執行：

```powershell
.\scripts\clean-runtime-backups.ps1 -ConfirmClean
```

腳本不會觸碰 `data/canon_db/`、`data/outputs/` 或 `data/visual_db/`。
