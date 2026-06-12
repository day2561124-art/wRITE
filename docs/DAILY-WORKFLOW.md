# Daily Workflow

## Phase 13C-Lite Operator UX

Use the overview's 「今日下一步」 card and workflow progress row to identify the
current stage. Status badges use Chinese labels and do not rely on color alone.
Technical IDs, hashes, traces, and raw state remain available under details.

The visual gallery diagnostics compare `visual_index` records with local PNG files
and explain that PNG assets remain ignored by Git. Phase 13B already provides the
reindex workflow; Phase 13C-Lite does not overwrite the index or stage assets.

This phase adds no core write capability. Approval confirmation, restore execution,
rollback execution, `active_engine`, and `compressed_rules` boundaries are unchanged.

## Phase 13A-Lite Feedback Learning Status

Writer Workbench includes a read-only Feedback Learning status panel. Use it to
inspect recent feedback artifacts and pending `compressed_rule_update`
approvals. Handle approvals in the existing Approval Queue.

The panel does not apply rules, edit `compressed_rules`, or modify
`active_engine`. Rollback/restore execution, MCP wrappers, and creative task
integration remain deferred.

本文件描述日常寫作與維護流程。所有會改動 Canon、採用正文、啟用
engine、rollback 或 restore 的動作，都必須走既有 approval queue。

## 開工前檢查

```powershell
.\scripts\safe-status.ps1
.\scripts\daily-health-check.ps1
```

確認 tracked worktree、完整測試、active engine SHA256 與未追蹤 visual assets。

## 寫作與驗稿流程

1. 建立 creative task 與 GPT writing context bundle。
2. 將 chat output 儲存為 writing candidate。
3. 建立 proofing context 與 proof report。
4. 建立 adoption request，並由使用者在 approval queue 確認。
5. 建立 settlement context、settlement report 與 pending engine candidate。
6. 建立 review 與 activation request。
7. 由使用者在 approval queue 確認 activation。

P0/P1 需要明確核准。P2 應先修正或留下可追蹤決策。P3/P4 可依工作目的
處理，但不得跳過 Canon 與 approval 規則。

## Feedback Learning

Phase 10A 可將使用者 feedback、proof report、settlement report 或 rejection
整理為 feedback item，再建立 deterministic digest、rule candidate 與 proposal。

Rule candidate 不會自動套用。Compressed rule update request 只建立 approval item；
Phase 10B 尚未實作實際套用。Feedback context bundle 可提供給外部 GPT 的 writing
或 proofing context，但不會在本機呼叫模型。

## 收工前檢查

```powershell
.\scripts\pre-commit-check.ps1
```

腳本會執行完整測試、顯示 staged stat、檢查 forbidden staged paths，並顯示
active engine hash。它不會自動 stage、commit 或 tag。

## Stage 與提交原則

逐一檢查並明確指定要 stage 的檔案。不要使用 `git add .`。

預設不要 stage：

- `data/visual_db/assets/`
- `data/backups/`
- `data/feedback_loop/`
- `data/outputs/`
- `data/canon_db/active_engine.md`

Visual assets 可能是刻意保留的未追蹤素材；除非本次工作明確要求，否則不要
刪除、stage 或納入 commit。Commit 與 tag 必須由使用者另行明確執行。

## 收工

```powershell
git status --short
git status --short --untracked-files=no
git diff --stat
.\scripts\show-active-engine-hash.ps1
```
