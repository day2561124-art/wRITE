# Troubleshooting

## `npm.cmd test` 失敗

查看第一個失敗步驟。修正後重新執行完整測試：

```powershell
npm.cmd test
echo $LASTEXITCODE
```

非 `0` 代表不可提交。

## Git 顯示 `data/backups/`

這通常是 Phase 11A runtime package、export 或 restore preview。不要 stage。
需要清理時先執行 dry-run：

```powershell
.\scripts\clean-runtime-backups.ps1
```

## Git 顯示 `data/visual_db/assets/`

Visual assets 可能是使用者刻意保留的未追蹤素材。不要刪除，也不要使用
`git add .`。只 stage 本次明確要求的檔案。

## Active Engine Hash 不符

停止 commit、activation、rollback 與 restore 流程。先檢查：

```powershell
git diff -- data/canon_db/active_engine.md
git status --short -- data/canon_db/active_engine.md
```

不要用任意 backup 覆寫。任何 activation、rollback 或未來 restore execution
都必須遵守 approval 流程。

## Git Pager 顯示 `(END)`

按 `q` 離開，或使用：

```powershell
git --no-pager log --oneline -5
```

## `LF will be replaced by CRLF`

這是行尾提示，不等於測試失敗。仍應執行 `git diff --check`。

## 測試 Timeout

確認沒有遺留 UI/Node process，再重跑單一失敗測試。不要跳過完整測試。

## PowerShell 顯示 `running scripts is disabled`

不要修改整台機器的 ExecutionPolicy。可對單次 process 使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\safe-status.ps1
```

這只影響該次 PowerShell process。

## Stage 了不該提交的檔案

先用 `git diff --cached --name-only` 確認範圍，再只取消錯誤的 staged paths。
不要破壞 working tree，尤其不要刪除 visual assets 或 runtime backup。
