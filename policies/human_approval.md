# Human Approval Gates（人工確認待決項）

本文件節錄自 SKILL.md「Human Approval Gates」章節，為方便獨立管理與 CI 驗證，移至 `policies/human_approval.md`。

## Overview

以下事項不得由 AI、MCP tool、神經網路模組、Feedback Learning Loop、RAG / CAG 檢索結果或自動化流程自行定案。凡觸發以下任一條件，系統必須進入 `pending_user_review` 狀態，等待使用者明確確認。

### 41.1 active_engine 啟用與版本切換

以下操作必須人工確認：

- 啟用新版 `active_engine`
- 切換 active engine 版本
- 覆蓋或替換現行 `active_engine`
- 將章節結算結果寫入 Canon DB
- 將新版正式母本設為唯一啟用版本

規則：

- 系統可產生新版 engine 候選。
- 系統可產生章節結算建議。
- 系統可列出變更摘要與風險。
- 但不得自動啟用或覆蓋 `active_engine`。
- 啟用前必須備份舊版，並記錄版本、時間、來源、使用者確認狀態與變更摘要。

### 41.2 P0 / P1 / P2 類錯誤回報或 Commit

以下錯誤回報不得自動正式寫入長期錯誤報告庫：

- P0：正史硬錯
- P1：角色、能力、主戲、設定重大錯
- P2：章節結構、流程化、後座支付、長篇治理重大錯

規則：

- AI 可自動產生 `pending_error_report`。
- Feedback Learning Loop 可自動分析與分類。
- 但 P0 / P1 / P2 錯誤報告正式 commit 前，必須由使用者確認。
- 若錯誤報告可能影響長期寫作策略、角色解讀、戰鬥規則或 Canon Guard 判斷，必須人工確認。

### 41.3 涉及重大正史後果的候選決定

任何候選正文、系統建議、神經網路推論或章節結算提案，若涉及以下內容，必須人工確認：

- 死亡
- 長期失能
- 長期退賽
- 重大能力突破
- 生命本質重大進化
- 新型態正式成立
- 代表資格變更
- 正式名額變更
- 正式編組變更
- 重大關係翻轉
- 長期敵我關係定案
- 組織核心目的揭露
- 暗線核心真相揭露
- 足以改寫篇章方向或世界格局的結果

規則：

- 候選正文可以描寫短期傷勢、單場勝負、當場失敗、短期後座與小幅關係位移。
- 但上述重大正史後果不得由 AI 自動定案。
- 若正文自然成立必須先決定上述事項，系統應停止，列出待使用者決定項。

### 41.4 unknown 來源與多方衝突無法自動判定

以下情況必須人工確認：

- RAG / CAG 檢索結果來源標記為 `unknown`
- 檢索結果缺少 source、version、section 或 canon_status
- Story Graph 與 active_engine 衝突
- Memory 與 active_engine 衝突
- Error Report 與 active_engine 衝突
- active_writing_card 與 active_engine 衝突
- Timeline DB 與 active_engine 衝突
- Knowledge State DB 與 active_engine 衝突
- 多個資料來源互相矛盾，且系統無法依 Authority Hierarchy 自動判定
- 檢索結果可能來自未採用稿、退稿版本、非正史試鏡或外部研究資料，但無法確認狀態

規則：

- 若來源為 `unknown`，不得作為正史承接依據。
- 若多方資料衝突且無法自動判定，系統不得自行猜測。
- 系統應列出衝突來源、各自版本、衝突內容與建議人工判定項。
- 在使用者確認前，該資料不得寫入 Canon DB、Story Graph canon 節點、Timeline canon 事件或 Canon Memory。

### 41.5 Human Approval Gate 硬規則

1. 任何 active_engine 啟用、切換或覆蓋都必須人工確認。
2. P0 / P1 / P2 錯誤報告正式 commit 前必須人工確認。
3. 涉及死亡、長期失能、重大能力突破、代表資格變更等重大正史後果時，必須人工確認。
4. 來源為 unknown 的資料不得直接作為正史依據。
5. 多方資料衝突且無法依權限層級自動判定時，必須人工確認。
6. Human Approval Gate 觸發時，系統必須進入 `pending_user_review` 狀態。
7. pending 狀態資料不得進入 Canon DB。
8. pending 狀態資料不得更新 active_engine。
9. pending 狀態資料不得標記伏筆為 paid。
10. pending 狀態資料不得作為下一章正式承接依據。

---

請在 UI 或 MCP workflow 中使用此文件作為人工確認提示與核准條款來源，並在 Human Approval Gate 觸發時引用 `policies/human_approval.md` 作為顯示內容與可解析 JSON 摘要來源。